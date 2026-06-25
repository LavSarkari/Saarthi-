import { mockFirestore, MockFieldValue } from "./localDb.js";
import fs from "fs";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { computeRiskScore, getHoursRemaining } from "../lib/riskEngine.js";
import { Task, Subtask } from "../types.js";
import { generateContentWithRetryAndFallback } from "./geminiCall.js";

// Initialize local DB mock (fully compatible with Firestore interface)
const dbAdmin = mockFirestore as any;
const FieldValue = MockFieldValue as any;

// Initialize the shared server-side Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

export class TelegramService {
  private activeAppUrl: string | undefined = undefined;
  private pollingActive: boolean = false;
  private offset: number = 0;

  private get token(): string | undefined {
    return process.env.TELEGRAM_BOT_TOKEN;
  }

  private get appUrl(): string | undefined {
    return process.env.APP_URL;
  }

  /**
   * Start the Telegram Bot long polling loop
   */
  async startPolling() {
    if (!this.token) {
      console.warn("TELEGRAM_BOT_TOKEN is not configured. Polling skipped.");
      return;
    }

    if (this.pollingActive) {
      console.log("Telegram Bot long polling is already active.");
      return;
    }

    this.pollingActive = true;
    console.log("Initializing Telegram Bot long polling (getUpdates loop)...");

    // Delete webhook first, as Telegram getUpdates doesn't work if webhook is active
    try {
      const deleteUrl = `https://api.telegram.org/bot${this.token}/deleteWebhook`;
      const delResponse = await fetch(deleteUrl);
      const delData: any = await delResponse.json();
      if (delData.ok) {
        console.log("Previous Telegram Webhook deleted successfully (required for getUpdates).");
      } else {
        console.warn("Could not delete Telegram Webhook (it might not be set):", delData.description);
      }
    } catch (err) {
      console.error("Error deleting Telegram Webhook:", err);
    }

    // Start polling loop
    this.poll();
  }

  /**
   * Polling loop execution
   */
  private async poll() {
    if (!this.pollingActive) return;

    try {
      const url = `https://api.telegram.org/bot${this.token}/getUpdates?offset=${this.offset}&timeout=5&limit=100`;
      const response = await fetch(url);
      const data: any = await response.json();

      if (data.ok && data.result && data.result.length > 0) {
        for (const update of data.result) {
          try {
            await this.handleUpdate(update);
          } catch (err) {
            console.error("Error processing polled update:", err, update);
          }
          this.offset = Math.max(this.offset, update.update_id + 1);
        }
      }
    } catch (err) {
      console.error("Error in Telegram polling loop:", err);
    }

    // Schedule next poll cycle after 2 seconds to avoid slamming the API in case of errors
    setTimeout(() => this.poll(), 2000);
  }

  /**
   * Register the webhook is now a legacy method that triggers polling instead
   */
  async registerWebhook(customUrl?: string): Promise<boolean> {
    if (customUrl && !this.isLocalHost(customUrl)) {
      this.activeAppUrl = customUrl;
    }
    
    // Auto-start polling if webhook is requested, since we are moving fully to polling mode
    this.startPolling().catch(err => {
      console.error("Failed to automatically start polling inside registerWebhook fallback:", err);
    });

    return true;
  }

  /**
   * Helper to determine if a URL string points to a local or reserved network host
   */
  private isLocalHost(urlStr: string): boolean {
    try {
      const normalized = urlStr.trim().startsWith("http") ? urlStr.trim() : "https://" + urlStr.trim();
      const parsed = new URL(normalized);
      const hostname = parsed.hostname.toLowerCase();
      return (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname === "::1" ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("172.16.") ||
        hostname.startsWith("172.17.") ||
        hostname.startsWith("172.18.") ||
        hostname.startsWith("172.19.") ||
        hostname.startsWith("172.2") ||
        hostname.startsWith("172.3")
      );
    } catch (e) {
      const lower = urlStr.toLowerCase();
      return lower.includes("localhost") || lower.includes("127.0.0.1") || lower.includes("0.0.0.0");
    }
  }

  /**
   * Helper to clean the URL by forcing HTTPS and stripping non-webhook ports
   */
  private cleanUrl(urlStr: string): string {
    let clean = urlStr.trim();
    if (clean.startsWith("http://")) {
      clean = clean.replace(/^http:\/\//, "https://");
    } else if (!clean.startsWith("https://")) {
      clean = "https://" + clean;
    }
    
    // Parse URL and strip non-webhook ports (Telegram webhook only supports 80, 88, 443, 8443)
    try {
      const parsed = new URL(clean);
      if (parsed.port && !["80", "88", "443", "8443"].includes(parsed.port)) {
        parsed.port = "";
      }
      clean = parsed.toString();
    } catch (e) {
      // Fallback regex to strip port
      clean = clean.replace(/:[0-9]+/, "");
    }
    
    return clean.replace(/\/$/, "");
  }

  /**
   * Helper to retrieve current live application URL with safe fallbacks
   */
  getLiveAppUrl(): string {
    const base = this.activeAppUrl || this.appUrl || "https://ais-pre-dcuiczk3hr2eo4w22wchok-62911805015.asia-southeast1.run.app";
    return this.cleanUrl(base);
  }

  // Webhook registration is fully bypassed in favor of secure getUpdates polling loop

  /**
   * Helper to send message to Telegram
   */
  async sendMessage(chatId: number | string, text: string, options: any = {}): Promise<boolean> {
    if (!this.token) {
      console.warn("TELEGRAM_BOT_TOKEN is missing. Cannot send message.");
      return false;
    }

    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown",
      ...options,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: any = await response.json();
      return !!data.ok;
    } catch (err) {
      console.error("Error sending Telegram message:", err);
      return false;
    }
  }

  /**
   * Find linked Saarthi user by Telegram Chat ID
   */
  async getUserByChatId(chatId: number | string): Promise<string | null> {
    try {
      const settingsSnap = await dbAdmin
        .collection("userSettings")
        .where("telegramChatId", "==", String(chatId))
        .limit(1)
        .get();

      if (settingsSnap.empty) {
        return null;
      }

      return settingsSnap.docs[0].id; // Document ID is user.uid
    } catch (error) {
      console.error("Error searching user by Telegram Chat ID:", error);
      return null;
    }
  }

  /**
   * Generates a unique 6-digit linking code, saves it in Firestore with 10-minute expiry
   */
  async generateLinkingCode(userId: string): Promise<{ code: string; expiresAt: string }> {
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    await dbAdmin.collection("telegramLinks").doc(code).set({
      code,
      userId,
      createdAt: new Date().toISOString(),
      expiresAt,
    });

    return { code, expiresAt };
  }

  /**
   * Unlinks a user's Telegram integration from userSettings
   */
  async unlinkAccount(userId: string): Promise<boolean> {
    try {
      const docRef = dbAdmin.collection("userSettings").doc(userId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        await docRef.update({
          telegramChatId: FieldValue.delete(),
          telegramUsername: FieldValue.delete(),
          telegramLinkedAt: FieldValue.delete(),
        });
      }
      return true;
    } catch (error) {
      console.error("Error unlinking Telegram account:", error);
      return false;
    }
  }

  /**
   * Answer a Telegram Callback Query to dismiss loading spinner
   */
  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    if (!this.token) return;
    const url = `https://api.telegram.org/bot${this.token}/answerCallbackQuery`;
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
        }),
      });
    } catch (err) {
      console.error("Error answering callback query:", err);
    }
  }

  /**
   * Edit an existing message text in Telegram
   */
  async editMessageText(chatId: number | string, messageId: number, text: string, options: any = {}): Promise<boolean> {
    if (!this.token) return false;
    const url = `https://api.telegram.org/bot${this.token}/editMessageText`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: "Markdown",
          ...options,
        }),
      });
      const data: any = await response.json();
      return !!data.ok;
    } catch (err) {
      console.error("Error editing message text:", err);
      return false;
    }
  }

  /**
   * Get the persistent Reply Keyboard for Saarthi Menu
   */
  private getMenuKeyboard() {
    return {
      keyboard: [
        [{ text: "📋 My Tasks" }, { text: "📅 Today" }],
        [{ text: "📊 Execution Health" }, { text: "🛟 Recovery Center" }],
        [{ text: "🤖 AI Assistant" }, { text: "⚙️ Settings" }, { text: "❓ Help" }]
      ],
      resize_keyboard: true,
      persistent: true
    };
  }

  /**
   * Handle incoming Telegram webhook/polled updates
   */
  async handleUpdate(update: any) {
    if (!update) return;

    // Route callback queries from inline keyboard buttons
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
      return;
    }

    if (!update.message && !update.edited_message) return;
    const message = update.message || update.edited_message;
    const chatId = message.chat.id;
    const text = (message.text || "").trim();
    const username = message.from?.username || message.from?.first_name || "User";

    if (!text) return;

    // Check if the user is linked
    const userId = await this.getUserByChatId(chatId);

    // 1. Check if the text matches a persistent Reply Keyboard button
    if (userId) {
      if (text === "📋 My Tasks") {
        await this.handleTasks(chatId, userId);
        return;
      } else if (text === "📅 Today") {
        await this.handleToday(chatId, userId);
        return;
      } else if (text === "📊 Execution Health") {
        await this.handleStatus(chatId, userId);
        return;
      } else if (text === "🛟 Recovery Center") {
        await this.handleRecovery(chatId, userId);
        return;
      } else if (text === "🤖 AI Assistant") {
        await this.sendMessage(chatId, `🤖 *Saarthi Premium AI Assistant* 🤖\n\nI am listening in plain text! Feel free to talk to me naturally. You don't need to memorize slash commands anymore.\n\n*Try sending:*\n• _"I finished DBMS Unit 3 study"_\n• _"Snooze my ML project by 2 days"_\n• _"What should I study next?"_\n• _"I'm feeling super exhausted today"_\n• _"Can you explain normal forms in DBMS?"_`);
        return;
      } else if (text === "⚙️ Settings") {
        await this.handleSettings(chatId, userId);
        return;
      } else if (text === "❓ Help") {
        await this.handleHelp(chatId, userId);
        return;
      }
    }

    // 2. Handle /start and /link account linking flows
    if (text.startsWith("/start") || text.startsWith("/link")) {
      const parts = text.split(" ");
      const code = parts[1] ? parts[1].trim() : null;

      if (!code) {
        if (userId) {
          // Send beautiful linked home greeting
          await this.sendMessage(
            chatId,
            `✨ *Namaste, ${username}!* Welcome back to Saarthi, your premium execution companion. ✨\n\nUse the persistent menu keyboard below to explore tasks, health status, settings, or talk directly to the AI Assistant.`,
            { reply_markup: this.getMenuKeyboard() }
          );
        } else {
          // Launch interactive premium onboarding flow
          const welcomeText = `✨ *Welcome to Saarthi!* ✨\n\nI am your intelligent conversational productivity companion native to Telegram. I work alongside your Saarthi dashboard to track milestones, predict deadline risk velocity, and provide recovery plans.\n\nLet's get you set up in less than 30 seconds!`;
          await this.sendMessage(chatId, welcomeText, {
            reply_markup: {
              inline_keyboard: [
                [{ text: "Begin Onboarding ➔", callback_data: "onboard_slide_1" }]
              ]
            }
          });
        }
        return;
      }

      // Process code verification
      await this.verifyAndLinkAccount(chatId, username, code);
      return;
    }

    // Reject other inputs if not linked
    if (!userId) {
      const appUrl = this.getLiveAppUrl();
      await this.sendMessage(
        chatId,
        `⚠️ *Telegram Connection Pending!*\n\nYou need to link your Telegram account first to interact with Saarthi:\n\n1. Please *login or signup* on Saarthi:\n🔗 *[Click Here to Login to Saarthi](${appUrl})*\n\n2. Navigate to *Settings* -> *Telegram Link*.\n3. Click *Generate Linking Code* to receive a 6-digit code.\n4. Send \`/link <code>\` right here to begin!`
      );
      return;
    }

    // 3. Handle linked slash command fallbacks
    if (text === "/status") {
      await this.handleStatus(chatId, userId);
    } else if (text === "/today") {
      await this.handleToday(chatId, userId);
    } else if (text === "/tasks") {
      await this.handleTasks(chatId, userId);
    } else if (text === "/confidence") {
      await this.handleConfidence(chatId, userId);
    } else if (text === "/recovery") {
      await this.handleRecovery(chatId, userId);
    } else if (text === "/briefing") {
      await this.handleBriefing(chatId, userId);
    } else {
      // 4. Default to premium conversational NLP processing (AI Companion Mode)
      await this.handleExecutionUpdate(chatId, userId, text);
    }
  }

  /**
   * Handle Telegram callback queries from inline buttons
   */
  async handleCallbackQuery(callback: any) {
    const callbackId = callback.id;
    const data = callback.data || "";
    const chatId = callback.message?.chat?.id;
    const messageId = callback.message?.message_id;

    if (!chatId || !messageId) {
      await this.answerCallbackQuery(callbackId, "Invalid callback context.");
      return;
    }

    const userId = await this.getUserByChatId(chatId);

    // If onboarding, allow clicks before user linking is finalized
    if (!userId && data.startsWith("onboard_")) {
      await this.handleOnboardingCallback(chatId, messageId, data, callbackId);
      return;
    }

    if (!userId) {
      await this.answerCallbackQuery(callbackId, "Please link your account first!");
      return;
    }

    try {
      if (data.startsWith("onboard_")) {
        await this.handleOnboardingCallback(chatId, messageId, data, callbackId);
      } else if (data === "tasks_list") {
        await this.answerCallbackQuery(callbackId, "Fetching active commitments...");
        await this.handleTasks(chatId, userId, messageId);
      } else if (data.startsWith("task_details:")) {
        const taskId = data.split(":")[1];
        await this.answerCallbackQuery(callbackId, "Opening task detail card...");
        await this.showRichTaskCard(chatId, userId, taskId, messageId);
      } else if (data.startsWith("milestones_list:")) {
        const taskId = data.split(":")[1];
        await this.answerCallbackQuery(callbackId, "Fetching milestones...");
        await this.showMilestonesListCard(chatId, userId, taskId, messageId);
      } else if (data.startsWith("toggle_subtask:")) {
        const [_, taskId, subtaskId] = data.split(":");
        await this.answerCallbackQuery(callbackId, "Toggling milestone status...");
        await this.toggleSubtaskStatus(chatId, userId, taskId, subtaskId, messageId);
      } else if (data.startsWith("task_snooze:")) {
        const taskId = data.split(":")[1];
        await this.answerCallbackQuery(callbackId, "Opening snooze menu...");
        await this.showSnoozeMenu(chatId, userId, taskId, messageId);
      } else if (data.startsWith("task_snooze_act:")) {
        const [_, __, taskId, daysStr] = data.split(":");
        const days = parseInt(daysStr, 10);
        await this.answerCallbackQuery(callbackId, `Snoozing task by ${days} days...`);
        await this.executeSnoozeTask(chatId, userId, taskId, days, messageId);
      } else if (data.startsWith("task_recovery:")) {
        const taskId = data.split(":")[1];
        await this.answerCallbackQuery(callbackId, "Generating recovery plan...");
        await this.executeTaskRecovery(chatId, userId, taskId, messageId);
      } else if (data.startsWith("apply_recovery_act:")) {
        const taskId = data.split(":")[1];
        await this.answerCallbackQuery(callbackId, "Recovery plan applied successfully!");
        await this.applyRecoveryPlan(chatId, userId, taskId, messageId);
      } else if (data.startsWith("toggle_setting:")) {
        const field = data.split(":")[1];
        await this.toggleUserSetting(chatId, userId, field, callbackId, messageId);
      } else if (data === "config_notifications") {
        await this.answerCallbackQuery(callbackId);
        await this.showNotificationConfig(chatId, userId, messageId);
      } else if (data.startsWith("set_notifications:")) {
        const level = data.split(":")[1];
        await this.updateNotificationLevel(chatId, userId, level, callbackId, messageId);
      } else if (data === "config_lang") {
        await this.answerCallbackQuery(callbackId);
        await this.showLanguageConfig(chatId, userId, messageId);
      } else if (data.startsWith("set_lang:")) {
        const lang = data.split(":")[1];
        await this.updateLanguageSetting(chatId, userId, lang, callbackId, messageId);
      } else if (data === "menu_today") {
        await this.answerCallbackQuery(callbackId);
        await this.handleToday(chatId, userId, messageId);
      } else if (data === "menu_recovery") {
        await this.answerCallbackQuery(callbackId);
        await this.handleRecovery(chatId, userId, messageId);
      } else if (data.startsWith("help_topic:")) {
        const topic = data.split(":")[1];
        await this.answerCallbackQuery(callbackId);
        if (topic === "settings_back") {
          await this.handleSettings(chatId, userId, messageId);
        } else {
          await this.showHelpTopic(chatId, topic, messageId);
        }
      } else if (data === "help_index") {
        await this.answerCallbackQuery(callbackId);
        await this.handleHelp(chatId, userId, messageId);
      } else {
        await this.answerCallbackQuery(callbackId, "Unknown callback action.");
      }
    } catch (err: any) {
      console.error("Error handling callback query:", err);
      await this.answerCallbackQuery(callbackId, `Error: ${err.message}`);
    }
  }

  /**
   * Onboarding slide processor
   */
  private async handleOnboardingCallback(chatId: number, messageId: number, data: string, callbackId: string) {
    const appUrl = this.getLiveAppUrl();
    await this.answerCallbackQuery(callbackId);

    if (data === "onboard_slide_0") {
      const text = `✨ *Welcome to Saarthi!* ✨\n\nI am your intelligent conversational productivity companion native to Telegram. I work alongside your Saarthi dashboard to track milestones, predict deadline risk velocity, and provide recovery plans.\n\nLet's get you set up in less than 30 seconds!`;
      await this.editMessageText(chatId, messageId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Begin Onboarding ➔", callback_data: "onboard_slide_1" }]
          ]
        }
      });
    } else if (data === "onboard_slide_1") {
      const text = `🔑 *Step 1: Link Your Account*\n\nTo manage your tasks right here, connect your Telegram to Saarthi:\n\n1. Login or signup on our secure web app:\n🔗 [Click here to Login](${appUrl})\n2. Go to *Settings* ⚙️ -> *Telegram Link*.\n3. Generate a secure 6-digit linking code.\n4. Type \`/link <code>\` in this chat!\n\n_Example: \`/link 123456\`_`;
      await this.editMessageText(chatId, messageId, text, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⬅️ Back", callback_data: "onboard_slide_0" },
              { text: "Skip & Next ➡️", callback_data: "onboard_slide_2" }
            ]
          ]
        }
      });
    } else if (data === "onboard_slide_2") {
      const text = `🔔 *Step 2: Intelligent Notification Alerts*\n\nSaarthi never spams. You will receive premium alerts only when they matter:\n\n🚨 *Risk Emergency Alerts* (When deadline confidence falls)\n☕ *Daily Morning Briefing* (At 8:00 AM local time)\n📝 *Evening Reflection* (Task metrics and daily summary)\n\nYou can easily customize or turn off these notifications under settings.`;
      await this.editMessageText(chatId, messageId, text, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⬅️ Back", callback_data: "onboard_slide_1" },
              { text: "Finalize Setup ➡️", callback_data: "onboard_slide_3" }
            ]
          ]
        }
      });
    } else if (data === "onboard_slide_3") {
      const text = `🚀 *You are Ready to Roll!*\n\nYou have unlocked Saarthi's full conversational experience on Telegram.\n\n💡 *Pro-Tips:*\n• Use the persistent keyboard menu below to quickly access sections.\n• Text me in natural language anytime: _"Completed DBMS part 2"_ or _"Feeling tired reschedule tomorrow"_\n• Ask the AI Assistant for planning advice or study roadmaps!`;
      await this.editMessageText(chatId, messageId, text, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⬅️ Back", callback_data: "onboard_slide_2" },
              { text: "Let's Go! 🚀", callback_data: "onboard_done" }
            ]
          ]
        }
      });
    } else if (data === "onboard_done") {
      const text = `✨ *Namaste! Welcome to Saarthi.* ✨\n\nYour account setup is completed! Use the menu below to explore your active commitments, check execution health, or consult the AI Assistant.\n\nHave a productive day! 🚀`;
      await this.sendMessage(chatId, text, {
        reply_markup: this.getMenuKeyboard()
      });
      try {
        const deleteUrl = `https://api.telegram.org/bot${this.token}/deleteMessage?chat_id=${chatId}&message_id=${messageId}`;
        await fetch(deleteUrl);
      } catch (e) {}
    }
  }

  /**
   * Verify generated link code and link Telegram Chat ID
   */
  private async verifyAndLinkAccount(chatId: number, username: string, code: string) {
    try {
      const linkDocRef = dbAdmin.collection("telegramLinks").doc(code);
      const linkSnap = await linkDocRef.get();

      if (!linkSnap.exists) {
        await this.sendMessage(
          chatId,
          `❌ *Invalid Code!* The code \`${code}\` is incorrect. Please check and regenerate a new 6-digit code from the Saarthi settings panel.`
        );
        return;
      }

      const linkData = linkSnap.data()!;
      const expiresAt = new Date(linkData.expiresAt).getTime();
      const now = Date.now();

      if (now > expiresAt) {
        await this.sendMessage(
          chatId,
          `⏳ *Expired Code!* The code \`${code}\` has expired. Link codes are valid for 10 minutes. Please generate a new one from Saarthi settings.`
        );
        return;
      }

      const userId = linkData.userId;

      // Update userSettings with Telegram details
      await dbAdmin.collection("userSettings").doc(userId).set(
        {
          telegramChatId: String(chatId),
          telegramUsername: username,
          telegramLinkedAt: new Date().toISOString(),
          telegramSettings: {
            notifications: "instant",
            dailyBriefing: true,
            eveningReview: true,
            calendarSync: true,
            language: "English"
          }
        },
        { merge: true }
      );

      // Keep link code but mark as completed so the frontend polling loop catches it
      await linkDocRef.set({
        ...linkData,
        telegramChatId: String(chatId),
        telegramUsername: username,
        status: "completed",
      });

      await this.sendMessage(
        chatId,
        `🎉 *Connection Successful!*\n\nSaarthi is now fully synced to this Telegram chat!\n\nI will monitor your deadlines and push real-time *Recovery Alerts* if execution risks rise. Feel free to type commands like /status or simply tell me what you completed (e.g., "Finished Unit 3") to update your dashboard instantly.`,
        { reply_markup: this.getMenuKeyboard() }
      );
    } catch (error: any) {
      console.error("Error linking account:", error);
      await this.sendMessage(chatId, `⚠️ An error occurred while linking: ${error.message}`);
    }
  }

  /**
   * List all active tasks
   */
  async handleTasks(chatId: number, userId: string, editMessageId?: number) {
    try {
      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const tasks = tasksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Task));
      const activeTasks = tasks.filter((t) => t.subtasks.some((s) => !s.done));

      if (activeTasks.length === 0) {
        const text = "📝 *No active tasks found.*\n\n🎉 All of your commitments are fully completed! Your execution slate is pristine. Fantastic job!";
        const opt = { reply_markup: { inline_keyboard: [[{ text: "➕ Open Web App to Create Task", url: this.getLiveAppUrl() }]] } };
        if (editMessageId) {
          await this.editMessageText(chatId, editMessageId, text, opt);
        } else {
          await this.sendMessage(chatId, text, opt);
        }
        return;
      }

      let text = `📋 *Saarthi - Your Active Commitments* 📋\n\n`;
      text += `You have *${activeTasks.length}* active commitments currently pending execution.\n\n`;
      text += `Select a task below to inspect detailed metrics, toggle subtasks, snooze deadlines, or trigger an AI recovery plan:`;

      const inline_keyboard: any[][] = [];
      activeTasks.forEach((t, i) => {
        const risk = computeRiskScore(t);
        const riskEmoji = risk.zone === "critical" ? "🚨" : risk.zone === "watch" ? "⚠️" : "✅";
        inline_keyboard.push([
          { text: `${riskEmoji} ${i + 1}. ${t.title} (${Math.round(risk.completionConfidence)}%)`, callback_data: `task_details:${t.id}` }
        ]);
      });

      const opt = { reply_markup: { inline_keyboard } };
      if (editMessageId) {
        await this.editMessageText(chatId, editMessageId, text, opt);
      } else {
        await this.sendMessage(chatId, text, opt);
      }
    } catch (error: any) {
      const errText = `⚠️ *Failed to fetch tasks:* ${error.message}`;
      if (editMessageId) {
        await this.editMessageText(chatId, editMessageId, errText);
      } else {
        await this.sendMessage(chatId, errText);
      }
    }
  }

  /**
   * Display rich task card with inline keyboard actions
   */
  private async showRichTaskCard(chatId: number, userId: string, taskId: string, editMessageId: number) {
    try {
      const docRef = dbAdmin.collection("tasks").doc(taskId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        await this.editMessageText(chatId, editMessageId, "❌ *Error:* Could not find the requested task.");
        return;
      }

      const t = { id: docSnap.id, ...docSnap.data() } as Task;
      const risk = computeRiskScore(t);
      const riskEmoji = risk.zone === "critical" ? "🚨" : risk.zone === "watch" ? "⚠️" : "✅";
      const compEmoji = t.complexity === "high" ? "🔥" : t.complexity === "medium" ? "⚡" : "🌱";
      
      const deadlineDate = new Date(t.deadline).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      });

      const hoursRemaining = getHoursRemaining(t.deadline);
      const daysRemaining = Math.max(0, Math.ceil(hoursRemaining / 24));
      
      const totalSubtasks = t.subtasks.length;
      const completedSubtasks = t.subtasks.filter(s => s.done).length;
      const remainingMinutes = t.subtasks.filter(s => !s.done).reduce((acc, s) => acc + (s.estimatedMinutes || 30), 0);

      const subtaskList = t.subtasks
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(s => `${s.done ? "✅" : "⬜"} ${s.title} (${s.estimatedMinutes || 30}m)`)
        .slice(0, 5)
        .join("\n");

      let card = `━━━━━━━━━━━━━━━━━━━━━━\n`;
      card += `🎯 *TASK:* ${t.title.toUpperCase()}\n`;
      card += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      card += `📝 *Description:* _${t.description || "No description provided."}_\n\n`;
      card += `📅 *Deadline:* ${deadlineDate} (${daysRemaining} days left)\n`;
      card += `⚡ *Complexity:* ${compEmoji} ${t.complexity.toUpperCase()}\n`;
      card += `⏱️ *Remaining Effort:* ~${Math.round(remainingMinutes)} mins\n\n`;
      card += `📊 *Execution Metrics:*\n`;
      card += `├─ Completion Confidence: *${Math.round(risk.completionConfidence)}%*\n`;
      card += `├─ Risk Zone: ${riskEmoji} *${risk.zone.toUpperCase()}* (Score: ${risk.score}/100)\n`;
      card += `└─ Progress: *${completedSubtasks}/${totalSubtasks}* milestones completed\n\n`;
      card += `📌 *Milestones Slate:*\n${subtaskList || "No subtasks defined."}\n`;
      if (totalSubtasks > 5) {
        card += `_...and ${totalSubtasks - 5} more milestones_\n`;
      }
      card += `━━━━━━━━━━━━━━━━━━━━━━`;

      const inline_keyboard = [
        [
          { text: "✅ Complete Milestone", callback_data: `milestones_list:${t.id}` },
          { text: "⏰ Snooze", callback_data: `task_snooze:${t.id}` }
        ],
        [
          { text: "📅 Reschedule", callback_data: `task_snooze:${t.id}` },
          { text: "🛟 Recovery Plan", callback_data: `task_recovery:${t.id}` }
        ],
        [
          { text: "⬅️ Back to Task List", callback_data: "tasks_list" }
        ]
      ];

      await this.editMessageText(chatId, editMessageId, card, {
        reply_markup: { inline_keyboard }
      });
    } catch (err: any) {
      await this.editMessageText(chatId, editMessageId, `⚠️ Error loading task details: ${err.message}`);
    }
  }

  /**
   * Display milestones list inside inline keyboard
   */
  private async showMilestonesListCard(chatId: number, userId: string, taskId: string, editMessageId: number) {
    try {
      const docRef = dbAdmin.collection("tasks").doc(taskId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) return;

      const t = { id: docSnap.id, ...docSnap.data() } as Task;
      
      let text = `📌 *Manage Milestones for: "${t.title}"*\n\n`;
      text += `Click any subtask milestone below to toggle its completion status:`;

      const inline_keyboard: any[][] = [];
      const sortedSubtasks = [...t.subtasks].sort((a, b) => (a.order || 0) - (b.order || 0));
      
      sortedSubtasks.forEach((s) => {
        const checkbox = s.done ? "✅" : "⬜";
        inline_keyboard.push([
          { text: `${checkbox} ${s.title} (${s.estimatedMinutes || 30}m)`, callback_data: `toggle_subtask:${t.id}:${s.id}` }
        ]);
      });

      inline_keyboard.push([
        { text: "⬅️ Back to Task Card", callback_data: `task_details:${t.id}` }
      ]);

      await this.editMessageText(chatId, editMessageId, text, {
        reply_markup: { inline_keyboard }
      });
    } catch (err: any) {
      await this.editMessageText(chatId, editMessageId, `⚠️ Error listing milestones: ${err.message}`);
    }
  }

  /**
   * Toggle completion of subtask milestone
   */
  private async toggleSubtaskStatus(chatId: number, userId: string, taskId: string, subtaskId: string, editMessageId: number) {
    try {
      const docRef = dbAdmin.collection("tasks").doc(taskId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) return;

      const task = { id: docSnap.id, ...docSnap.data() } as Task;
      let updatedSubtasks = [...task.subtasks];
      
      updatedSubtasks = updatedSubtasks.map((s) => 
        s.id === subtaskId ? { ...s, done: !s.done } : s
      );

      const completedCount = updatedSubtasks.filter((s) => s.done).length;
      const plannedCount = updatedSubtasks.length;

      const tempTask: Task = {
        ...task,
        subtasks: updatedSubtasks,
        sessionsCompleted: completedCount,
      };

      const risk = computeRiskScore(tempTask);

      const updateData: any = {
        subtasks: updatedSubtasks,
        sessionsCompleted: completedCount,
        riskScore: risk.score,
        riskZone: risk.zone,
      };

      if (completedCount === plannedCount) {
        updateData.googleCalendarSynced = false;
      }

      await docRef.update(updateData);

      // Re-render subtask selection list
      await this.showMilestonesListCard(chatId, userId, taskId, editMessageId);
    } catch (err: any) {
      await this.editMessageText(chatId, editMessageId, `⚠️ Error toggling milestone: ${err.message}`);
    }
  }

  /**
   * Display snooze duration options
   */
  private async showSnoozeMenu(chatId: number, userId: string, taskId: string, editMessageId: number) {
    try {
      const docRef = dbAdmin.collection("tasks").doc(taskId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) return;

      const t = { id: docSnap.id, ...docSnap.data() } as Task;

      let text = `⏰ *Adjust Deadline: "${t.title}"*\n\n`;
      text += `Choose a snooze duration to push back the target deadline and dynamically recalculate scheduling pressure:`;

      const inline_keyboard = [
        [
          { text: "➕ 1 Day Snooze", callback_data: `task_snooze_act:${t.id}:1` },
          { text: "➕ 3 Days Snooze", callback_data: `task_snooze_act:${t.id}:3` }
        ],
        [
          { text: "➕ 1 Week Snooze", callback_data: `task_snooze_act:${t.id}:7` },
          { text: "➕ 2 Weeks Snooze", callback_data: `task_snooze_act:${t.id}:14` }
        ],
        [
          { text: "⬅️ Back to Task Card", callback_data: `task_details:${t.id}` }
        ]
      ];

      await this.editMessageText(chatId, editMessageId, text, {
        reply_markup: { inline_keyboard }
      });
    } catch (err: any) {
      await this.editMessageText(chatId, editMessageId, `⚠️ Error loading snooze options: ${err.message}`);
    }
  }

  /**
   * Postpone deadline in Firestore and recalculate risk
   */
  private async executeSnoozeTask(chatId: number, userId: string, taskId: string, days: number, editMessageId: number) {
    try {
      const docRef = dbAdmin.collection("tasks").doc(taskId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) return;

      const task = { id: docSnap.id, ...docSnap.data() } as Task;
      
      const currentDeadline = new Date(task.deadline);
      currentDeadline.setDate(currentDeadline.getDate() + days);
      const newDeadlineStr = currentDeadline.toISOString();

      const tempTask: Task = {
        ...task,
        deadline: newDeadlineStr,
      };

      const risk = computeRiskScore(tempTask);

      await docRef.update({
        deadline: newDeadlineStr,
        riskScore: risk.score,
        riskZone: risk.zone,
        googleCalendarSynced: false
      });

      const text = `🎉 *Deadline Snoozed Successfully!*\n\n• Task: *"${task.title}"*\n• New Deadline: *${currentDeadline.toLocaleDateString()}*\n• Recalculated Confidence: *${Math.round(risk.completionConfidence)}%*\n• Risk Zone: *${risk.zone.toUpperCase()}*`;
      
      const inline_keyboard = [
        [{ text: "🔍 Open Task Card", callback_data: `task_details:${task.id}` }],
        [{ text: "📋 Back to Task List", callback_data: "tasks_list" }]
      ];

      await this.editMessageText(chatId, editMessageId, text, {
        reply_markup: { inline_keyboard }
      });
    } catch (err: any) {
      await this.editMessageText(chatId, editMessageId, `⚠️ Error adjusting deadline: ${err.message}`);
    }
  }

  /**
   * On-demand AI Recovery Plan compilation
   */
  private async executeTaskRecovery(chatId: number, userId: string, taskId: string, editMessageId: number) {
    try {
      await this.editMessageText(chatId, editMessageId, "🛟 *Formulating tactical AI Recovery strategy... Please wait.*");

      const docRef = dbAdmin.collection("tasks").doc(taskId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) return;

      const task = { id: docSnap.id, ...docSnap.data() } as Task;

      const hoursRemaining = getHoursRemaining(task.deadline);
      const subtasksLeft = task.subtasks.filter((s) => !s.done);
      const subtasksLeftNames = subtasksLeft.map((s) => s.title);

      const { recoveryService } = await import("./recoveryService.js");
      const plan = await recoveryService.generateRecoveryPlan(
        task.title,
        task.description,
        hoursRemaining,
        task.totalEffortMinutes,
        subtasksLeft.length,
        subtasksLeftNames,
        ai
      );

      const updatedPlan = {
        isRecovered: false,
        situationSummary: plan.situationSummary,
        messageToUser: plan.messageToUser,
        advice: plan.advice,
      };

      await docRef.update({
        recoveryPlan: updatedPlan,
      });

      let text = `━━━━━━ 🛟 *RECOVERY PLAN* ━━━━━━\n`;
      text += `🎯 *Task:* ${task.title.toUpperCase()}\n\n`;
      text += `⚠️ *Situation Diagnosis:*\n_${plan.situationSummary}_\n\n`;
      text += `🎯 *Motivational Priority:*\n*${plan.messageToUser}*\n\n`;
      text += `✂️ *Tactical Intervention Advice:*\n${plan.advice}\n\n`;
      text += `📈 *Expected Improvement:* +25% Confidence recovery upon applying these descaling guidelines.\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      const inline_keyboard = [
        [{ text: "✅ Apply Recovery Plan", callback_data: `apply_recovery_act:${task.id}` }],
        [{ text: "⏰ Snooze Deadline Instead", callback_data: `task_snooze:${task.id}` }],
        [{ text: "⬅️ Back to Task Card", callback_data: `task_details:${task.id}` }]
      ];

      await this.editMessageText(chatId, editMessageId, text, {
        reply_markup: { inline_keyboard }
      });
    } catch (err: any) {
      await this.editMessageText(chatId, editMessageId, `⚠️ Failed to formulate recovery plan: ${err.message}`);
    }
  }

  /**
   * Commit and apply recovery plan to task
   */
  private async applyRecoveryPlan(chatId: number, userId: string, taskId: string, editMessageId: number) {
    try {
      const docRef = dbAdmin.collection("tasks").doc(taskId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) return;

      const task = { id: docSnap.id, ...docSnap.data() } as Task;
      if (task.recoveryPlan) {
        await docRef.update({
          "recoveryPlan.isRecovered": true,
        });
      }

      const text = `🛡️ *Recovery Roadmap Activated!* 🛡️\n\nAwesome choice! You have successfully committed to this tactical AI recovery plan for *"${task.title}"*.\n\nNow, take immediate action:\n1. De-scope low priority targets as instructed.\n2. Open your workspace and start your first 15-minute focused execution block.\n\nI will monitor your progress closely! 🚀`;
      
      const inline_keyboard = [
        [{ text: "🔍 Open Task Card", callback_data: `task_details:${task.id}` }],
        [{ text: "📋 Back to Task List", callback_data: "tasks_list" }]
      ];

      await this.editMessageText(chatId, editMessageId, text, {
        reply_markup: { inline_keyboard }
      });
    } catch (err: any) {
      await this.editMessageText(chatId, editMessageId, `⚠️ Error applying recovery: ${err.message}`);
    }
  }

  /**
   * Command: /Status: Execution Health Summary
   */
  async handleStatus(chatId: number, userId: string, editMessageId?: number) {
    try {
      if (!editMessageId) {
        await this.sendMessage(chatId, "📊 *Analyzing and compiling your execution health metrics...*");
      }

      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const tasks = tasksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Task));
      const activeTasks = tasks.filter((t) => t.subtasks.some((s) => !s.done));

      if (activeTasks.length === 0) {
        const clearMsg = "🟢 *Execution Health: PERFECT* 🟢\n\n• Active Tasks: *0*\n• Average Confidence: *100%*\n\nAll milestones are completed! Outstanding velocity. Send /tasks or use settings to link new plans.";
        if (editMessageId) {
          await this.editMessageText(chatId, editMessageId, clearMsg);
        } else {
          await this.sendMessage(chatId, clearMsg);
        }
        return;
      }

      let totalConfidence = 0;
      let criticalCount = 0;
      let watchCount = 0;
      let safeCount = 0;
      let totalRemainingMinutes = 0;

      activeTasks.forEach((t) => {
        const risk = computeRiskScore(t);
        totalConfidence += risk.completionConfidence;
        if (risk.zone === "critical") criticalCount++;
        else if (risk.zone === "watch") watchCount++;
        else safeCount++;

        const taskRem = t.subtasks.filter((s) => !s.done).reduce((acc, s) => acc + (s.estimatedMinutes || 30), 0);
        totalRemainingMinutes += taskRem;
      });

      const avgConfidence = Math.round(totalConfidence / activeTasks.length);
      const totalRemainingHours = (totalRemainingMinutes / 60).toFixed(1);
      
      const overallStatusEmoji = avgConfidence >= 80 ? "🟢" : avgConfidence >= 50 ? "🟡" : "🔴";
      const overallStatusText = avgConfidence >= 80 ? "EXCELLENT & STABLE" : avgConfidence >= 50 ? "WATCHFUL PACING REQUIRED" : "CRITICAL RISK EXPOSURE";

      let dynamicInsight = "";
      if (criticalCount > 0) {
        dynamicInsight = `You have *${criticalCount}* task(s) in the critical high-risk zone. We highly recommend activating a strategic Rescue Plan to salvage your timelines.`;
      } else if (watchCount > 0) {
        dynamicInsight = `Pacing is slightly constrained on *${watchCount}* task(s). Minor timeline buffer adjustment or a quick 20-minute study sprint will put you back in the Safe Zone.`;
      } else {
        dynamicInsight = `Spectacular! All of your active goals are pacing safely within their schedules. Continue checking off milestones sequentially!`;
      }

      let text = `━━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `🟢 *SAARTHI EXECUTION HEALTH* 🟢\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      text += `🎯 *Velocity & Confidence:*\n`;
      text += `• Average Confidence: *${avgConfidence}%*\n`;
      text += `• Overall Status: ${overallStatusEmoji} *${overallStatusText}*\n\n`;
      text += `📉 *Commitment Breakdown:*\n`;
      text += `• Total Registered Tasks: *${tasks.length}*\n`;
      text += `• Active commitments: *${activeTasks.length}*\n`;
      text += `├─ 🚨 Critical Risk Zone: *${criticalCount}*\n`;
      text += `├─ ⚠️ Watch-Out Zone: *${watchCount}*\n`;
      text += `└─ ✅ Safe & Stable Zone: *${safeCount}*\n\n`;
      text += `⏳ *Time Investment:*\n`;
      text += `• Estimated Remaining Effort: *${totalRemainingHours} hours*\n\n`;
      text += `💡 *Saarthi AI Insight:*\n`;
      text += `_${dynamicInsight}_\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━━`;

      const inline_keyboard = [
        [
          { text: "📅 Today's Plan", callback_data: "menu_today" },
          { text: "🛟 Recovery Center", callback_data: "menu_recovery" }
        ],
        [
          { text: "🔗 Open Web Dashboard", url: this.getLiveAppUrl() }
        ]
      ];

      if (editMessageId) {
        await this.editMessageText(chatId, editMessageId, text, {
          reply_markup: { inline_keyboard }
        });
      } else {
        await this.sendMessage(chatId, text, {
          reply_markup: { inline_keyboard }
        });
      }
    } catch (error: any) {
      console.error("Error building execution health status:", error);
    }
  }

  /**
   * Command / Recovery: Rescue guidelines listing
   */
  async handleRecovery(chatId: number, userId: string, editMessageId?: number) {
    try {
      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const tasks = tasksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Task));
      
      const highRiskTasks = tasks.filter((t) => {
        const risk = computeRiskScore(t);
        return (risk.zone === "critical" || risk.zone === "watch") && t.subtasks.some((s) => !s.done);
      });

      if (highRiskTasks.length === 0) {
        const clearMsg = `🛡️ *Saarthi Recovery Center* 🛡️\n\n*All systems stable!* None of your active commitments are triggering risk flags. You're fully on-track to crush all deadlines. Continue your progress!`;
        if (editMessageId) {
          await this.editMessageText(chatId, editMessageId, clearMsg);
        } else {
          await this.sendMessage(chatId, clearMsg);
        }
        return;
      }

      let text = `🛟 *Saarthi Recovery Center* 🛟\n\n`;
      text += `When execution velocity falls, Saarthi crafts dynamic survival roadmaps to protect your milestones.\n\n`;
      text += `Select a high-risk commitment below to review or formulate its tactical rescue plan:`;

      const inline_keyboard: any[][] = [];
      highRiskTasks.forEach((t) => {
        const risk = computeRiskScore(t);
        inline_keyboard.push([
          { text: `🚨 Rescue: ${t.title} (${Math.round(risk.completionConfidence)}%)`, callback_data: `task_recovery:${t.id}` }
        ]);
      });

      if (editMessageId) {
        await this.editMessageText(chatId, editMessageId, text, {
          reply_markup: { inline_keyboard }
        });
      } else {
        await this.sendMessage(chatId, text, {
          reply_markup: { inline_keyboard }
        });
      }
    } catch (error: any) {
      console.error("Error in recovery list handler:", error);
    }
  }

  /**
   * Command / Today: Active agenda due today
   */
  async handleToday(chatId: number, userId: string, editMessageId?: number) {
    try {
      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const tasks = tasksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Task));

      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];

      const dueToday = tasks.filter((t) => t.deadline.startsWith(todayStr) && t.subtasks.some(s => !s.done));

      if (dueToday.length === 0) {
        const text = `📅 *No deadlines due today (${todayStr})!*\n\nKeep up the great work. Check your full list of active commitments or consult your AI Assistant for strategic advice!`;
        const inline_keyboard = [[{ text: "📋 View Active Tasks", callback_data: "tasks_list" }]];
        if (editMessageId) {
          await this.editMessageText(chatId, editMessageId, text, { reply_markup: { inline_keyboard } });
        } else {
          await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard } });
        }
        return;
      }

      let text = `📅 *Saarthi - Your Agenda For Today (${todayStr})* 📅\n\n`;
      text += `You have *${dueToday.length}* task(s) reaching their target deadlines today. Focus your energy here first:\n\n`;

      dueToday.forEach((t, i) => {
        const completed = t.subtasks.filter((s) => s.done).length;
        const total = t.subtasks.length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        text += `*${i + 1}. ${t.title}*\n`;
        text += `   • Progress: *${completed}/${total}* milestones completed (${pct}%)\n`;
        if (t.reminderContext?.nextLogicalStep) {
          text += `   • Next Step: _"${t.reminderContext.nextLogicalStep}"_\n`;
        }
        text += `\n`;
      });

      const inline_keyboard: any[][] = [];
      dueToday.forEach((t) => {
        inline_keyboard.push([
          { text: `🎯 Manage: "${t.title}"`, callback_data: `task_details:${t.id}` }
        ]);
      });

      if (editMessageId) {
        await this.editMessageText(chatId, editMessageId, text, {
          reply_markup: { inline_keyboard }
        });
      } else {
        await this.sendMessage(chatId, text, {
          reply_markup: { inline_keyboard }
        });
      }
    } catch (error: any) {
      console.error("Error in Today's plan handler:", error);
    }
  }

  /**
   * Command / Help: Help Center navigation
   */
  async handleHelp(chatId: number, userId: string, editMessageId?: number) {
    const text = `❓ *Saarthi Companion Help Center* ❓\n\nWelcome to your guide on getting the most out of Saarthi! Select a topic below to discover how I help you execute on your commitments:`;
    
    const inline_keyboard = [
      [
        { text: "🚀 Getting Started", callback_data: "help_topic:start" },
        { text: "📋 Core Features", callback_data: "help_topic:features" }
      ],
      [
        { text: "💡 Examples", callback_data: "help_topic:examples" },
        { text: "🔒 Privacy & Security", callback_data: "help_topic:privacy" }
      ],
      [
        { text: "🔑 Account Linking", callback_data: "help_topic:linking" },
        { text: "💬 FAQ & Support", callback_data: "help_topic:faq" }
      ]
    ];

    if (editMessageId) {
      await this.editMessageText(chatId, editMessageId, text, {
        reply_markup: { inline_keyboard }
      });
    } else {
      await this.sendMessage(chatId, text, {
        reply_markup: { inline_keyboard }
      });
    }
  }

  /**
   * Help Center Detailed content display
   */
  private async showHelpTopic(chatId: number, topic: string, editMessageId: number) {
    let text = "";
    if (topic === "start") {
      text = `🚀 *Getting Started with Saarthi*\n\n1. Use the Reply Keyboard buttons at the bottom of your chat to instantly browse sections.\n2. Tap *My Tasks* to view, toggle, or snooze active commitments.\n3. Type in natural language (e.g., _"Completed DBMS Unit 3 study"_) and Saarthi's AI will parse your message and update Firestore in real-time.\n4. Ask any study or scheduling question to get motivating, structured feedback!`;
    } else if (topic === "features") {
      text = `📋 *Saarthi Premium Features*\n\n• *Intelligent Risk Detection:* Continuously analyzes schedule buffer ratios and alerts you if execution pacing looks weak.\n• *Interactive Recovery Roadmaps:* Automatically generates compressed, viable execution compromise suggestions when deadlines are threatened.\n• *Morning Strategic Briefings:* Sends custom briefs to map your highest-priority milestones daily.\n• *Google Calendar & Tasks Sync:* Seamlessly syncs your timeline updates across devices.`;
    } else if (topic === "examples") {
      text = `💡 *Conversational Examples*\n\nTry sending these messages directly to me:\n\n• _"Finished DBMS Unit 3"_ (Marks milestone complete)\n• _"Snooze machine learning project by 3 days"_ (Updates deadline)\n• _"I'm feeling super overwhelmed today help me"_ (Generates emergency recovery roadmap)\n• _"What should I study next?"_ (AI suggests focus milestones)\n• _"Can you explain normal forms in database?"_ (AI explains study topics)`;
    } else if (topic === "privacy") {
      text = `🔒 *Privacy & Security Guarantee*\n\n• *Secure Isolation:* All data is isolated under your specific authenticated Saarthi account in Firestore.\n• *No Exposure:* Your Gemini API keys are hosted fully on secure, server-side infrastructure and are never transmitted to Telegram or the client browser.\n• *Zero Spam:* Saarthi only notifies you on critical risk escalations, morning briefs, or when actively requested.`;
    } else if (topic === "linking") {
      text = `🔑 *Account Linking Instructions*\n\n1. Sign in/sign up on the Saarthi web app.\n2. Tap the settings gear icon ⚙️ in the top right.\n3. Open the *Telegram Link* tab and generate your secure 6-digit link code.\n4. Copy the code and type \`/link <code>\` in this chat to complete synchronization.\n\n_Example: \`/link 123456\`_`;
    } else if (topic === "faq") {
      text = `💬 *FAQ & Companion Support*\n\n*Q: Why are my command buttons missing?*\nA: Click the keyboard layout icon in your Telegram chat box to bring back the persistent Saarthi menu buttons.\n\n*Q: How do I change my notifications?*\nA: Click *Settings* on the menu to customize daily briefing and alert frequencies.\n\n*Q: Where is my data saved?*\nA: All metrics sync instantly to your cloud-hosted Firestore database.`;
    }

    const inline_keyboard = [[{ text: "⬅️ Back to Help Center", callback_data: "help_index" }]];
    await this.editMessageText(chatId, editMessageId, text, {
      reply_markup: { inline_keyboard }
    });
  }

  /**
   * Command / Settings: Settings customization card
   */
  async handleSettings(chatId: number, userId: string, editMessageId?: number) {
    try {
      const docRef = dbAdmin.collection("userSettings").doc(userId);
      const docSnap = await docRef.get();
      const settings = docSnap.exists ? docSnap.data()! : {};
      
      const pref = settings.telegramSettings || {
        notifications: "instant",
        dailyBriefing: true,
        eveningReview: true,
        calendarSync: true,
        language: "English"
      };

      let text = `⚙️ *Saarthi Companion Settings* ⚙️\n\n`;
      text += `Customize your productivity assistant preferences below:\n\n`;
      text += `• *Alert Frequency:* *${pref.notifications.toUpperCase()}*\n`;
      text += `• *Morning Briefing:* *${pref.dailyBriefing ? "✅ ENABLED" : "❌ DISABLED"}*\n`;
      text += `• *Evening Reflection:* *${pref.eveningReview ? "✅ ENABLED" : "❌ DISABLED"}*\n`;
      text += `• *Calendar Sync:* *${pref.calendarSync ? "✅ ENABLED" : "❌ DISABLED"}*\n`;
      text += `• *Preferred Language:* *${pref.language || "English"}*\n\n`;
      text += `Select a preference below to adjust:`;

      const inline_keyboard = [
        [
          { text: `Morning Brief: ${pref.dailyBriefing ? "☕ ON" : "💤 OFF"}`, callback_data: "toggle_setting:dailyBriefing" },
          { text: `Evening Review: ${pref.eveningReview ? "📝 ON" : "💤 OFF"}`, callback_data: "toggle_setting:eveningReview" }
        ],
        [
          { text: `Calendar Sync: ${pref.calendarSync ? "📅 ON" : "💤 OFF"}`, callback_data: "toggle_setting:calendarSync" },
          { text: "🔔 Notification Alert Style", callback_data: "config_notifications" }
        ],
        [
          { text: "🌐 Assistant Language", callback_data: "config_lang" },
          { text: "🔗 Open Saarthi Web App", url: this.getLiveAppUrl() }
        ]
      ];

      if (editMessageId) {
        await this.editMessageText(chatId, editMessageId, text, {
          reply_markup: { inline_keyboard }
        });
      } else {
        await this.sendMessage(chatId, text, {
          reply_markup: { inline_keyboard }
        });
      }
    } catch (err: any) {
      console.error("Error loading settings:", err);
    }
  }

  /**
   * Toggle user Settings preference field
   */
  private async toggleUserSetting(chatId: number, userId: string, field: string, callbackId: string, editMessageId: number) {
    try {
      const docRef = dbAdmin.collection("userSettings").doc(userId);
      const docSnap = await docRef.get();
      const settings = docSnap.exists ? docSnap.data()! : {};
      
      const pref = settings.telegramSettings || {
        notifications: "instant",
        dailyBriefing: true,
        eveningReview: true,
        calendarSync: true,
        language: "English"
      };

      pref[field] = !pref[field];

      await docRef.set({
        telegramSettings: pref
      }, { merge: true });

      await this.answerCallbackQuery(callbackId, `Setting successfully updated!`);
      await this.handleSettings(chatId, userId, editMessageId);
    } catch (err: any) {
      await this.answerCallbackQuery(callbackId, `Error updating setting: ${err.message}`);
    }
  }

  /**
   * Display Notification level configs
   */
  private async showNotificationConfig(chatId: number, userId: string, editMessageId: number) {
    const text = `🔔 *Adjust Notification Alert Level*\n\nChoose when Saarthi should notify you:\n\n• *Instant:* Receive emergency risk level alerts as soon as pacing changes.\n• *Daily:* Consolidated morning & evening pacing updates.\n• *Weekly:* Weekly execution progress reflections.\n• *Off:* Silence all proactive notifications.`;
    
    const inline_keyboard = [
      [
        { text: "Instant 🚨", callback_data: "set_notifications:instant" },
        { text: "Daily 📅", callback_data: "set_notifications:daily" }
      ],
      [
        { text: "Weekly 📊", callback_data: "set_notifications:weekly" },
        { text: "Off 💤", callback_data: "set_notifications:off" }
      ],
      [{ text: "⬅️ Back to Settings", callback_data: "help_topic:settings_back" }]
    ];

    await this.editMessageText(chatId, editMessageId, text, {
      reply_markup: { inline_keyboard }
    });
  }

  /**
   * Save notification level preference
   */
  private async updateNotificationLevel(chatId: number, userId: string, level: string, callbackId: string, editMessageId: number) {
    try {
      const docRef = dbAdmin.collection("userSettings").doc(userId);
      await docRef.set({
        telegramSettings: {
          notifications: level
        }
      }, { merge: true });

      await this.answerCallbackQuery(callbackId, `Alert frequency set to ${level.toUpperCase()}!`);
      await this.handleSettings(chatId, userId, editMessageId);
    } catch (err: any) {
      await this.answerCallbackQuery(callbackId, `Error: ${err.message}`);
    }
  }

  /**
   * Display language selection config
   */
  private async showLanguageConfig(chatId: number, userId: string, editMessageId: number) {
    const text = `🌐 *Select Preferred Language*\n\nChoose the language you prefer Saarthi's AI Companion to communicate in:`;
    const inline_keyboard = [
      [
        { text: "English 🇬🇧", callback_data: "set_lang:English" },
        { text: "Hindi 🇮🇳", callback_data: "set_lang:Hindi" }
      ],
      [
        { text: "Spanish 🇪🇸", callback_data: "set_lang:Spanish" },
        { text: "German 🇩🇪", callback_data: "set_lang:German" }
      ],
      [{ text: "⬅️ Back to Settings", callback_data: "help_topic:settings_back" }]
    ];
    await this.editMessageText(chatId, editMessageId, text, {
      reply_markup: { inline_keyboard }
    });
  }

  /**
   * Save language preference
   */
  private async updateLanguageSetting(chatId: number, userId: string, lang: string, callbackId: string, editMessageId: number) {
    try {
      const docRef = dbAdmin.collection("userSettings").doc(userId);
      await docRef.set({
        telegramSettings: {
          language: lang
        }
      }, { merge: true });

      await this.answerCallbackQuery(callbackId, `Language changed to ${lang}!`);
      await this.handleSettings(chatId, userId, editMessageId);
    } catch (err: any) {
      await this.answerCallbackQuery(callbackId, `Error: ${err.message}`);
    }
  }

  /**
   * Command: /confidence Report
   */
  private async handleConfidence(chatId: number, userId: string) {
    try {
      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const tasks = tasksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Task));
      const activeTasks = tasks.filter((t) => t.subtasks.some((s) => !s.done));

      if (activeTasks.length === 0) {
        await this.sendMessage(chatId, "⭐ *100% Execution Confidence!* You are fully caught up with your commitments.");
        return;
      }

      let msg = `📊 *Detailed Saarthi Execution Confidence Report*\n\n`;

      activeTasks.forEach((t, i) => {
        const analysis = computeRiskScore(t);
        const emoji = analysis.zone === "critical" ? "🚨" : analysis.zone === "watch" ? "⚠️" : "✅";
        const zoneStr = analysis.zone.toUpperCase();

        msg += `*${i + 1}. ${t.title}*\n`;
        msg += `   • Risk Zone: ${emoji} *${zoneStr}* (Score: ${analysis.score}/100)\n`;
        msg += `   • Confidence: *${Math.round(analysis.completionConfidence)}%*\n`;
        msg += `   • Pacing Alert: _${analysis.explanation.primaryReason}_\n`;
        msg += `   • Detail: _${analysis.explanation.secondaryReason}_\n\n`;
      });

      await this.sendMessage(chatId, msg);
    } catch (error: any) {
      await this.sendMessage(chatId, `⚠️ Failed to compile confidence report: ${error.message}`);
    }
  }

  /**
   * Command / Evening Reflection Summary
   */
  async handleEveningReview(chatId: number, userId: string) {
    try {
      await this.sendMessage(chatId, "☕ *Reflecting on your daily progress... Please wait.*");

      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const tasks = tasksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Task));
      const activeTasks = tasks.filter((t) => t.subtasks.some((s) => !s.done));

      const completedSubtasksList = tasks.flatMap(t => t.subtasks.filter(s => s.done));
      const pendingSubtasksList = tasks.flatMap(t => t.subtasks.filter(s => !s.done));

      let text = `━━━━━━ 📝 *EVENING REFLECTION* ━━━━━━\n`;
      text += `Good Evening! Let's reflect on your achievements today:\n\n`;
      text += `📈 *Daily Progress Summary:*\n`;
      text += `• Total Tasks: *${tasks.length}*\n`;
      text += `• Completed Milestones: *${completedSubtasksList.length}*\n`;
      text += `• Pending Milestones left: *${pendingSubtasksList.length}*\n\n`;
      
      if (activeTasks.length > 0) {
        text += `🎯 *Focus Priorities For Tomorrow:*\n`;
        activeTasks.slice(0, 3).forEach((t, i) => {
          const nextS = t.subtasks.find(s => !s.done);
          text += `*${i + 1}. ${t.title}*\n`;
          text += `   👉 Next: ${nextS ? nextS.title : "None"}\n`;
        });
      } else {
        text += `🎉 *All clear!* You have completed all active commitments. Spectacular pacing!\n`;
      }
      
      text += `\n💡 *Saarthi Companion Tip:*\n`;
      text += `Getting a full night of rest protects your neuro-cognitive stamina. Relax tonight and wake up ready to conquer tomorrow!\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      const inline_keyboard = [
        [{ text: "📅 Today's Agenda", callback_data: "menu_today" }],
        [{ text: "📋 Full Active List", callback_data: "tasks_list" }]
      ];

      await this.sendMessage(chatId, text, {
        reply_markup: { inline_keyboard }
      });
    } catch (err: any) {
      console.error("Error in evening review:", err);
    }
  }

  /**
   * Command: /briefing (Generate AI-powered morning summary)
   */
  async handleBriefing(chatId: number, userId: string) {
    try {
      await this.sendMessage(chatId, "☕ *Brewing your strategic morning briefing... Please wait.*");

      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
      const activeTasks = tasks.filter((t) => t.subtasks.some((s) => !s.done));

      if (activeTasks.length === 0) {
        await this.sendMessage(
          chatId,
          "☕ *Good Morning!* You have no pending active commitments. A fully cleared execution slate! Enjoy your day or plan a new goal."
        );
        return;
      }

      const tasksPayload = activeTasks.map((t) => {
        const risk = computeRiskScore(t);
        return {
          title: t.title,
          description: t.description,
          deadline: t.deadline,
          complexity: t.complexity,
          progress: `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}`,
          riskScore: risk.score,
          riskZone: risk.zone,
          nextLogicalStep: t.reminderContext?.nextLogicalStep || "Not specified",
        };
      });

      const prompt = `You are Saarthi, a wise, structured, and deeply encouraging AI morning executive guide.
The user is starting their day. Please write a highly personalized, concise, and professional morning executive briefing.

Here is their active Saarthi commitments slate:
${JSON.stringify(tasksPayload, null, 2)}

Provide:
1. A warm, motivational morning greeting (mentioning coffee/focus).
2. A clear breakdown of the absolute highest-priority execution items for today.
3. Laser-focused advice to defeat procrastination on any high-risk tasks (mentioning the exact subtasks/next steps).
4. A concluding motivational quote or tough love boost.

Keep it structured, punchy, beautifully styled in Markdown (bold text, lists, and quotes), and under 400 words.`;

      const response = await generateContentWithRetryAndFallback(ai, {
        model: "gemini-3.1-flash-lite",
        contents: prompt,
      });

      const briefingText = response.text || "Failed to compile briefing. Keep focus!";
      await this.sendMessage(chatId, briefingText);
    } catch (error: any) {
      await this.sendMessage(chatId, `⚠️ Failed to compile morning briefing: ${error.message}`);
    }
  }

  /**
   * Send notification/alerts when a task's confidence falls or transitions to high-risk
   */
  async triggerRecoveryAlert(userId: string, task: Task) {
    try {
      const settingsSnap = await dbAdmin.collection("userSettings").doc(userId).get();
      if (!settingsSnap.exists) return;

      const data = settingsSnap.data()!;
      const chatId = data.telegramChatId;
      if (!chatId) return;

      const risk = computeRiskScore(task);
      if (risk.zone === "critical") {
        const text = `🚨 *SAARTHI RISK EMERGENCY ALERT* 🚨\n\nYour execution confidence on *"${task.title}"* has dropped critically to *${risk.completionConfidence}%*.\n\n• *Risk Index:* ${risk.score}/100\n• *Primary Obstacle:* _${risk.explanation.primaryReason}_\n• *Strategic Advice:* _${risk.explanation.secondaryReason}_\n\n👉 Send /recovery or open your Saarthi dashboard to enact a dynamic rescue plan and protect your commitments!`;
        await this.sendMessage(chatId, text);
      }
    } catch (error) {
      console.error("Failed to trigger recovery alert via Telegram:", error);
    }
  }

  /**
   * Parse natural language progress update (e.g., "Finished Unit 3")
   */
  private async handleExecutionUpdate(chatId: number, userId: string, messageText: string) {
    try {
      await this.sendMessage(chatId, "🤖 *Analyzing execution update...*");

      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
      const activeTasks = tasks.filter((t) => t.subtasks.some((s) => !s.done));

      if (activeTasks.length === 0) {
        await this.sendMessage(chatId, "🤔 You don't have any active tasks pending currently. Use /tasks to check.");
        return;
      }

      // Prepare payload of active tasks and subtasks for Gemini
      const activeSlate = activeTasks.map((t) => ({
        id: t.id,
        title: t.title,
        subtasks: t.subtasks.map((s) => ({ id: s.id, title: s.title, done: s.done, order: s.order })),
      }));

      const systemInstruction = `You are Saarthi's natural language updates processor.
The user sent a message indicating they finished or completed some work.
Your goal is to parse their message and determine if it matches any active tasks or subtasks.

Active Tasks and Subtasks List:
${JSON.stringify(activeSlate, null, 2)}

Match criteria:
- Look for keywords from the user's message (e.g. "Finished Unit 3" matches a subtask named "Unit 3 Study" or "Complete Unit 3").
- If the user says "Completed Task 1" or mentions the main task title, they might be marking the entire task or the first undone subtask.
- Be generous with natural matching, but if it is completely ambiguous, set matched: false.

You must respond strictly in JSON format matching this schema:
{
  "matched": boolean,
  "target": "subtask" | "task" | "none",
  "taskId": string | null,
  "subtaskId": string | null,
  "confidence": number, // confidence of match between 0.0 and 1.0
  "comment": string // A warm, supportive confirmation message like "Fantastic job! I've marked milestone 'Unit 3 Study' as completed."
}`;

      const response = await generateContentWithRetryAndFallback(ai, {
        model: "gemini-3.1-flash-lite",
        contents: `Analyze user update: "${messageText}"`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matched: { type: Type.BOOLEAN },
              target: { type: Type.STRING },
              taskId: { type: Type.STRING },
              subtaskId: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              comment: { type: Type.STRING },
            },
            required: ["matched", "target", "comment"],
          },
        },
      });

      const result = JSON.parse(response.text.trim());

      if (!result.matched || result.confidence < 0.5 || !result.taskId) {
        await this.sendMessage(
          chatId,
          `🤔 *I'm not completely sure which task you completed.* \n\nCould you clarify? Here are your current active milestones:\n\n` +
            activeTasks
              .map((t) => {
                const undone = t.subtasks.filter((s) => !s.done);
                return `• *${t.title}*:\n  ` + undone.map((s) => `  - "${s.title}"`).join("\n  ");
              })
              .join("\n")
        );
        return;
      }

      // Perform DB updates in Firestore!
      const taskId = result.taskId;
      const subtaskId = result.subtaskId;

      const taskDocRef = dbAdmin.collection("tasks").doc(taskId);
      const taskSnap = await taskDocRef.get();

      if (!taskSnap.exists) {
        await this.sendMessage(chatId, "⚠️ Could not find the matched task in the database.");
        return;
      }

      const task = { id: taskSnap.id, ...taskSnap.data() } as Task;
      let updatedSubtasks = [...task.subtasks];

      if (result.target === "subtask" && subtaskId) {
        updatedSubtasks = updatedSubtasks.map((s) => (s.id === subtaskId ? { ...s, done: true } : s));
      } else if (result.target === "task" || !subtaskId) {
        // If they completed the entire task, mark all subtasks as done
        updatedSubtasks = updatedSubtasks.map((s) => ({ ...s, done: true }));
      }

      const completedCount = updatedSubtasks.filter((s) => s.done).length;
      const plannedCount = updatedSubtasks.length;

      // Recalculate metrics
      const tempTask: Task = {
        ...task,
        subtasks: updatedSubtasks,
        sessionsCompleted: completedCount,
      };

      const risk = computeRiskScore(tempTask);

      // Save to Firestore!
      const updateData: any = {
        subtasks: updatedSubtasks,
        sessionsCompleted: completedCount,
        riskScore: risk.score,
        riskZone: risk.zone,
      };

      // If all done, update sync statuses
      if (completedCount === plannedCount) {
        updateData.googleCalendarSynced = false; // flag for resync if needed
      }

      await taskDocRef.update(updateData);

      // Send feedback message
      let replyMsg = `✅ *Milestone Synced!*\n\n${result.comment}\n\n📊 *Updated Task Status:*\n• Progress: ${completedCount}/${plannedCount} milestones\n• New Confidence: *${risk.completionConfidence}%*\n• Risk Level: *${risk.zone.toUpperCase()}*`;
      await this.sendMessage(chatId, replyMsg);
    } catch (error: any) {
      console.error("Error processing NLP execution update:", error);
      await this.sendMessage(chatId, `⚠️ Failed to process update: ${error.message}`);
    }
  }
}

export const telegramService = new TelegramService();

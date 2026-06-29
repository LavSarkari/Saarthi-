import { mockFirestore, MockFieldValue } from "./localDb.js";
import fs from "fs";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { computeRiskScore, getHoursRemaining } from "../lib/riskEngine.js";
import { Task, Subtask, ActivationSession } from "../types.js";
import { generateContentWithRetryAndFallback } from "./geminiCall.js";
import { activationService } from "./activationService.js";
import { engagementService } from "./engagementService.js";
import { behavioralIntelligenceService } from "./behavioralIntelligenceService.js";

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

  async sendChatAction(chatId: number | string, action: string = "typing") {
    if (!this.token) return;
    const url = `https://api.telegram.org/bot${this.token}/sendChatAction`;
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, action })
      });
    } catch (e) {}
  }

  
  async sendMessage(chatId: number | string, text: string, options: any = {}): Promise<any> {
    if (!this.token) {
      console.warn("TELEGRAM_BOT_TOKEN is missing. Cannot send message.");
      return null;
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
      return data.ok ? data.result : null;
    } catch (err) {
      console.error("Error sending Telegram message:", err);
      return null;
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
        [{ text: "🏠 Home" }, { text: "📋 Tasks" }],
        [{ text: "📅 Today" }, { text: "📈 Health" }],
        [{ text: "🛟 Recovery" }, { text: "🤖 Ask Saarthi" }],
        [{ text: "⚙️ Settings" }, { text: "❓ Help" }]
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

    if (userId) {
      try {
        await behavioralIntelligenceService.trackEvent({
          userId,
          eventType: "TELEGRAM_REPLY",
          confidence: 100
        });
      } catch (e) {
        console.error("Failed to track TELEGRAM_REPLY", e);
      }
    }

    if (userId) {
      await engagementService.recordInteraction(userId, "message").catch(err => {
        console.error("Failed to record Telegram message interaction:", err);
      });
    }

    
    // 1. Check if the text matches a persistent Reply Keyboard button
    if (userId) {
      if (text === "🏠 Home") {
        await this.handleHome(chatId, userId, username);
        return;
      } else if (text === "📋 Tasks") {
        await this.handleTasks(chatId, userId);
        return;
      } else if (text === "📅 Today") {
        await this.handleToday(chatId, userId);
        return;
      } else if (text === "📈 Health") {
        await this.handleStatus(chatId, userId);
        return;
      } else if (text === "🛟 Recovery") {
        await this.handleRecovery(chatId, userId);
        return;
      } else if (text === "🤖 Ask Saarthi") {
        await this.sendMessage(chatId, `🤖 *Saarthi Premium AI Assistant*\n\nI am listening in plain text! Feel free to talk to me naturally. You don't need to memorize slash commands anymore.\n\n*Try sending:*\n• _"I finished DBMS Unit 3 study"_\n• _"Snooze my ML project by 2 days"_\n• _"What should I study next?"_\n• _"I'm feeling super exhausted today"_`);
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
          await this.sendMessage(chatId, "Welcome back!", { reply_markup: this.getMenuKeyboard() }).catch(() => {});
          await this.handleHome(chatId, userId, username);
        } else {
          // Launch interactive premium onboarding flow
          const welcomeText = `✨ *Welcome.*\n\nI'm Saarthi, your personal execution companion.\n\nI help you track milestones, protect your time, and rescue slipping deadlines.`;
          await this.sendMessage(chatId, welcomeText, {
            reply_markup: {
              inline_keyboard: [
                [{ text: "Connect Account ➔", callback_data: "onboard_slide_1" }]
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
      // 3.5 Intercept "I'm stuck" / "help" / "overwhelmed"
      const lowerText = text.toLowerCase();
      
      if (lowerText.includes("behind") || lowerText.includes("failed") || lowerText.includes("messed up") || lowerText.includes("ruined my week") || lowerText.includes("missed everything")) {
        await this.handleRecovery(chatId, userId);
        return;
      }
      
      if (lowerText.includes("stuck") || lowerText.includes("overwhelmed") || lowerText.includes("tired") || lowerText.includes("can't do this") || lowerText.includes("don't know where to start")) {
        await this.handleActivationRequest(chatId, userId);
        return;
      }
      await this.handleGenericMessage(chatId, userId, text);
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

    await engagementService.recordInteraction(userId, "button_press").catch(err => {
      console.error("Failed to record Telegram button press interaction:", err);
    });

    try {
      if (data === "tasks_list") {
        await this.answerCallbackQuery(callbackId);
        await this.handleTasks(chatId, userId, messageId);
      } else if (data === "menu_home") {
        await this.answerCallbackQuery(callbackId);
        const username = callback.from?.username || callback.from?.first_name || "User";
        await this.handleHome(chatId, userId, username, messageId);
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
      } else if (data.startsWith("activation_start:")) {
        const sessionId = data.split(":")[1];
        await this.answerCallbackQuery(callbackId);
        await this.handleActivationCallback(chatId, userId, "start", sessionId, messageId);
      } else if (data.startsWith("activation_shrink:")) {
        const sessionId = data.split(":")[1];
        await this.answerCallbackQuery(callbackId);
        await this.handleActivationCallback(chatId, userId, "shrink", sessionId, messageId);
      } else if (data.startsWith("activation_complete:")) {
        const sessionId = data.split(":")[1];
        await this.answerCallbackQuery(callbackId);
        await this.handleActivationCallback(chatId, userId, "complete", sessionId, messageId);
      } else if (data.startsWith("activation_next:")) {
        const targetTaskId = data.split(":")[1];
        await this.answerCallbackQuery(callbackId);
        await this.handleActivationRequest(chatId, userId, targetTaskId);
      } else if (data === "help_index") {
        await this.answerCallbackQuery(callbackId);
        await this.handleHelp(chatId, userId, messageId);
      } else if (data.startsWith("task_details:")) {
        const taskId = data.split(":")[1];
        await this.answerCallbackQuery(callbackId);
        await this.showRichTaskCard(chatId, userId, taskId, messageId);
      } else if (data.startsWith("task_milestones:")) {
        const taskId = data.split(":")[1];
        await this.answerCallbackQuery(callbackId);
        await this.showMilestonesListCard(chatId, userId, taskId, messageId);
      } else if (data.startsWith("task_recovery:")) {
        const taskId = data.split(":")[1];
        await this.answerCallbackQuery(callbackId);
        await this.executeTaskRecovery(chatId, userId, taskId, messageId);
      } else if (data.startsWith("task_snooze_menu:")) {
        const taskId = data.split(":")[1];
        await this.answerCallbackQuery(callbackId);
        await this.showSnoozeMenu(chatId, userId, taskId, messageId);
      } else if (data.startsWith("task_snooze:")) {
        const parts = data.split(":");
        const taskId = parts[1];
        const days = parseInt(parts[2] || "0", 10);
        await this.answerCallbackQuery(callbackId);
        if (days > 0) {
          await this.executeSnoozeTask(chatId, userId, taskId, days, messageId);
        } else {
          await this.showSnoozeMenu(chatId, userId, taskId, messageId);
        }
      } else if (data.startsWith("toggle_subtask:")) {
        const parts = data.split(":");
        const taskId = parts[1];
        const subtaskId = parts[2];
        await this.answerCallbackQuery(callbackId);
        await this.toggleSubtaskStatus(chatId, userId, taskId, subtaskId, messageId);
      } else if (data.startsWith("toggle_setting:")) {
        const field = data.split(":")[1];
        await this.toggleUserSetting(chatId, userId, field, callbackId, messageId);
      } else if (data.startsWith("undo_tasks:")) {
        const taskIdsStr = data.split(":")[1];
        if (taskIdsStr) {
          const taskIds = taskIdsStr.split(",");
          const batch = dbAdmin.batch();
          for (const tid of taskIds) {
            batch.delete(dbAdmin.collection("tasks").doc(tid));
          }
          await batch.commit();
          await this.answerCallbackQuery(callbackId, "Tasks undone successfully.");
          await this.editMessageText(chatId, messageId, "↩️ Tasks creation undone. They have been deleted.");
        } else {
          await this.answerCallbackQuery(callbackId, "Nothing to undo.");
        }
      } else if (data === "config_notifications" || data === "config_lang") {
        await this.answerCallbackQuery(callbackId, "Please use the web dashboard to configure this setting.");
      } else if (data.startsWith("recover_accept_")) {
        const planId = data.replace("recover_accept_", "");
        await this.answerCallbackQuery(callbackId, "Rebuilding your week...");
        await this.editMessageText(chatId, messageId, "⏳ Executing recovery sequence. Adjusting commitments in the database...");
        
        try {
          const { recoveryService } = await import('./recoveryService.js');
          await recoveryService.executeRecoveryPlan(userId, planId);
          await this.editMessageText(chatId, messageId, "✅ **Week Rebuilt Successfully.**\n\nYour commitments have been adjusted, risk scores updated, and your confidence is restored. Let's move forward one step at a time.");
        } catch (error: any) {
          await this.editMessageText(chatId, messageId, `⚠️ Failed to execute recovery plan: ${error.message}`);
        }
      } else if (data === "recover_cancel") {
        await this.answerCallbackQuery(callbackId, "Recovery cancelled.");
        await this.editMessageText(chatId, messageId, "❌ Recovery cancelled. Your original commitments have not been changed.");
      } else {
        await this.answerCallbackQuery(callbackId, "Unknown callback action.");
      }
    } catch (err: any) {
      console.error("Error handling callback query:", err);
      await this.answerCallbackQuery(callbackId, "Error: " + err.message);
    }
  }

  private async handleOnboardingCallback(chatId: number, messageId: number, data: string, callbackId: string) {
    const appUrl = this.getLiveAppUrl();
    await this.answerCallbackQuery(callbackId);

    if (data === "onboard_slide_0") {
      const text = `✨ *Welcome.*\n\nI'm Saarthi, your personal execution companion.\n\nI help you track milestones, protect your time, and rescue slipping deadlines.`;
      await this.editMessageText(chatId, messageId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Connect Account ➔", callback_data: "onboard_slide_1" }]
          ]
        }
      });
    } else if (data === "onboard_slide_1") {
      const text = `🔑 *Link your account*\n\n1. Open your [Saarthi Dashboard](${appUrl})\n2. Go to **Settings** > **Telegram**\n3. Send your linking code here:\n\n\`/link 123456\``;
      await this.editMessageText(chatId, messageId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⬅️ Back", callback_data: "onboard_slide_0" }]
          ]
        }
      });
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
  
  /**
   * Home Screen Dashboard
   */
  async handleHome(chatId: number, userId: string, username: string, editMessageId?: number) {
    try {
      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const tasks = tasksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const activeTasks = tasks.filter((t: any) => t.subtasks.some((s: any) => !s.done));

      let totalConfidence = 0;
      activeTasks.forEach((t: any) => totalConfidence += computeRiskScore(t).completionConfidence);
      const avgConfidence = activeTasks.length > 0 ? Math.round(totalConfidence / activeTasks.length) : 100;
      
      const criticalCount = activeTasks.filter((t: any) => computeRiskScore(t).zone === "critical").length;
      
      let text = `🏠 *Saarthi Home*\n\n✨ Good to see you, ${username}.\n\n`;
      text += `━━━━━━━━━━━━━━\n`;
      text += `📈 *Execution Health*: ${avgConfidence}%\n`;
      text += `🎯 *Active Tasks*: ${activeTasks.length}\n`;
      if (criticalCount > 0) {
        text += `⚠️ *Recovery Alerts*: ${criticalCount} critical\n`;
      } else {
        text += `✅ *Recovery Alerts*: None\n`;
      }
      text += `━━━━━━━━━━━━━━\n\n`;
      
      // Get current focus
      const sortedTasks = [...activeTasks].sort((a: any, b: any) => new Date(a.deadline || a.dueDate).getTime() - new Date(b.deadline || b.dueDate).getTime());
      if (sortedTasks.length > 0) {
        text += `🎯 *Current Focus*\n${sortedTasks[0].title}\n\n`;
      } else {
        text += `🎯 *Current Focus*\nNone. Ready to plan?\n\n`;
      }
      
      text += `What would you like to do?`;
      
      const inline_keyboard = [
        [{ text: "📅 Today's Plan", callback_data: "menu_today" }, { text: "📋 All Tasks", callback_data: "tasks_list" }],
        [{ text: "🛟 Recovery Center", callback_data: "menu_recovery" }, { text: "⚙️ Settings", callback_data: "help_topic:settings_back" }]
      ];
      
      if (editMessageId) {
        await this.editMessageText(chatId, editMessageId, text, { reply_markup: { inline_keyboard } });
      } else {
        await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard } });
      }
    } catch (e: any) {
      console.error(e);
      await this.sendMessage(chatId, `⚠️ Could not load home.`);
    }
  }

  async handleTasks(chatId: number, userId: string, editMessageId?: number) {
    try {
      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const tasks = tasksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Task));
      const activeTasks = tasks.filter((t) => t.subtasks.some((s) => !s.done));

      
      if (activeTasks.length === 0) {
        const text = "📝 *No active tasks.*\n\nYour execution slate is pristine. Fantastic job!";
        const opt = { reply_markup: { inline_keyboard: [[{ text: "➕ Create Task (Web)", url: this.getLiveAppUrl() }]] } };
        if (editMessageId) {
          await this.editMessageText(chatId, editMessageId, text, opt);
        } else {
          await this.sendMessage(chatId, text, opt);
        }
        return;
      }

      let text = `📋 *Active Tasks*\n\nYou have ${activeTasks.length} commitments pending.\n\nSelect a task below:`;

      const inline_keyboard: any[][] = [];
      activeTasks.forEach((t: any) => {
        const risk = computeRiskScore(t);
        const riskEmoji = risk.zone === "critical" ? "🚨" : risk.zone === "watch" ? "⚠️" : "✅";
        inline_keyboard.push([
          { text: `${riskEmoji} ${t.title} (${Math.round(risk.completionConfidence)}%)`, callback_data: `task_details:${t.id}` }
        ]);
      });

      const opt = { reply_markup: { inline_keyboard } };
      if (editMessageId) {
        await this.editMessageText(chatId, editMessageId, text, opt);
      } else {
        await this.sendMessage(chatId, text, opt);
      }

    } catch (error: any) {
      const errText = `⚠️ Failed to load tasks.`;
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
        day: "numeric"
      });

      const hoursRemaining = getHoursRemaining(t.deadline);
      const daysRemaining = Math.max(0, Math.ceil(hoursRemaining / 24));
      
      const totalSubtasks = t.subtasks.length;
      const completedSubtasks = t.subtasks.filter((s: any) => s.done).length;
      const remainingMinutes = t.subtasks.filter((s: any) => !s.done).reduce((acc: any, s: any) => acc + (s.estimatedMinutes || 30), 0);

      let card = `━━━━━━━━━━━━━━\n`;
      card += `🎯 *${t.title.toUpperCase()}*\n`;
      card += `━━━━━━━━━━━━━━\n\n`;
      card += `📅 *Deadline*: ${deadlineDate} (${daysRemaining}d)\n`;
      card += `⏱️ *Time Left*: ~${Math.round(remainingMinutes)} mins\n\n`;
      card += `📊 *Health*: ${riskEmoji} ${risk.zone.toUpperCase()} (${Math.round(risk.completionConfidence)}%)\n`;
      card += `📈 *Progress*: ${completedSubtasks}/${totalSubtasks} completed\n\n`;
      card += `━━━━━━━━━━━━━━`;

      const inline_keyboard = [
        [
          { text: "✅ Check Milestones", callback_data: `milestones_list:${t.id}` }
        ],
        [
          { text: "📅 Reschedule", callback_data: `task_snooze:${t.id}` },
          { text: "🛟 Recovery", callback_data: `task_recovery:${t.id}` }
        ],
        [
          { text: "⬅️ Back", callback_data: "tasks_list" }
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
        lastUpdated: Date.now(),
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

      
      const text = `🎉 *Snoozed!*\n\n• Task: *${task.title}*\n• New Deadline: *${currentDeadline.toLocaleDateString()}*\n• Health: *${risk.zone.toUpperCase()}* (${Math.round(risk.completionConfidence)}%)`;

      
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
    // We now use the global full-week Recovery OS instead of task-specific recovery
    await this.handleRecovery(chatId, userId, editMessageId);
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
      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const tasks = tasksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const activeTasks = tasks.filter((t: any) => t.subtasks.some((s: any) => !s.done));

      let totalConfidence = 0;
      activeTasks.forEach((t: any) => totalConfidence += computeRiskScore(t).completionConfidence);
      const avgConfidence = activeTasks.length > 0 ? Math.round(totalConfidence / activeTasks.length) : 100;
      const criticalCount = activeTasks.filter((t: any) => computeRiskScore(t).zone === "critical").length;

      if (activeTasks.length === 0) {
        await this.sendMessage(chatId, "⭐ *100% Execution Confidence!* You are fully caught up.");
        return;
      }

      let text = `━━━━━━━━━━━━━━\n`;
      text += `📊 *Execution Health Report*\n\n`;
      text += `🎯 Confidence: *${avgConfidence}%*\n`;
      text += `📋 Active Tasks: *${activeTasks.length}*\n`;
      if (criticalCount > 0) text += `🚨 Critical Risk: *${criticalCount}*\n`;
      text += `\n━━━━━━━━━━━━━━\n\n`;
      text += `What would you like to review?`;

      const inline_keyboard = [
        [{ text: "🛟 Recovery Alerts", callback_data: "menu_recovery" }],
        [{ text: "📋 Active Tasks", callback_data: "tasks_list" }],
        [{ text: "🏠 Home", callback_data: "menu_home" }]
      ];

      if (editMessageId) {
         await this.editMessageText(chatId, editMessageId, text, { reply_markup: { inline_keyboard } });
      } else {
         await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard } });
      }

    } catch (error: any) {
      console.error(error);
    }
  }


  /**
   * Command / Recovery: Rescue guidelines listing
   */
  async handleRecovery(chatId: number, userId: string, editMessageId?: number) {
    try {
      if (editMessageId) {
        await this.editMessageText(chatId, editMessageId, "💜 _Analyzing your week and building a safe recovery plan..._");
      } else {
        await this.sendChatAction(chatId, "typing");
        const loadingMsg = await this.sendMessage(chatId, "💜 _Analyzing your week and building a safe recovery plan..._");
        editMessageId = loadingMsg?.message_id;
      }

      const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const { recoveryService } = await import('./recoveryService.js');
      const plan = await recoveryService.generateRecoveryPlan(userId, "balanced", aiClient);

      let text = `💜\n*Looks like life became more complicated than expected.*\n_${plan.situationSummary.message}_\n\n`;
      text += `*Recovery Plan Generated*\n━━━━━━━━━━━━━━\n`;
      text += `Rescued: ${plan.expectedRecovery.timeRecoveredHours}h\n`;
      text += `Adjusted: ${plan.suggestedTradeoffs.length} commitments\n`;
      text += `Confidence Restored: ${plan.expectedRecovery.confidenceBefore}% → ${plan.expectedRecovery.confidenceAfter}%\n━━━━━━━━━━━━━━\n\n`;

      if (plan.suggestedTradeoffs.length > 0) {
        text += `*Key Tradeoffs:*\n`;
        plan.suggestedTradeoffs.forEach(t => {
          text += `• ${t.originalTitle}: ${t.explanation}\n`;
        });
      }

      const inline_keyboard = [
        [{ text: "✅ Accept & Rebuild Week", callback_data: `recover_accept_${plan.id}` }],
        [{ text: "❌ Cancel", callback_data: "recover_cancel" }]
      ];

      if (editMessageId) {
        await this.editMessageText(chatId, editMessageId, text, { reply_markup: { inline_keyboard } });
      } else {
        await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard } });
      }
    } catch (error: any) {
      console.error("Error in recovery list handler:", error);
      if (editMessageId) {
        await this.editMessageText(chatId, editMessageId, `⚠️ Failed to formulate recovery plan: ${error.message}`);
      } else {
        await this.sendMessage(chatId, `⚠️ Failed to formulate recovery plan: ${error.message}`);
      }
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

      
      const dueToday = tasks.filter((t: any) => {
        if (!t.subtasks.some((s: any) => !s.done)) return false;
        const d = new Date(t.deadline || t.dueDate);
        const today = new Date();
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      });

      if (dueToday.length === 0) {
        let text = `📅 *Today's Agenda*\n\nNo deadlines today. You have space to focus deeply or rest.`;
        const inline_keyboard = [
          [{ text: "📋 View All Tasks", callback_data: "tasks_list" }],
          [{ text: "🏠 Home", callback_data: "menu_home" }]
        ];
        if (editMessageId) {
          await this.editMessageText(chatId, editMessageId, text, { reply_markup: { inline_keyboard } });
        } else {
          await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard } });
        }
        return;
      }

      let text = `📅 *Today's Agenda*\n\n`;
      const inline_keyboard: any[][] = [];
      dueToday.forEach((t: any) => {
        inline_keyboard.push([{ text: `🎯 ${t.title}`, callback_data: `task_details:${t.id}` }]);
      });
      inline_keyboard.push([{ text: "🏠 Home", callback_data: "menu_home" }]);
      
      if (editMessageId) {
        await this.editMessageText(chatId, editMessageId, text, { reply_markup: { inline_keyboard } });
      } else {
        await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard } });
      }

    } catch (error: any) {
      console.error(error);
    }
  }

  /**
   * Command / Help: Help Center navigation
   */
  
  async handleHelp(chatId: number, userId: string, editMessageId?: number) {
    const text = `👋 *Here to help.*\n\nWhat do you need assistance with?`;
    
    const inline_keyboard = [
      [
        { text: "🚀 Getting Started", callback_data: "help_topic:start" },
        { text: "📋 Features", callback_data: "help_topic:features" }
      ],
      [
        { text: "💬 Conversations", callback_data: "help_topic:examples" },
        { text: "🔗 Connect Dashboard", callback_data: "help_topic:linking" }
      ],
      [
        { text: "⚙️ Settings", callback_data: "help_topic:settings_back" },
        { text: "❓ FAQ", callback_data: "help_topic:faq" }
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
      text = `🚀 *Getting Started*\n\nI'm here to help you execute your tasks smoothly.\n\n• **Talk to me naturally.** Say "Finished my ML essay" or "I'm overwhelmed.\n• **Navigate with buttons.** Use the inline buttons to view tasks, check health, and get recovery plans.\n\nReady to begin?`;
    } else if (topic === "features") {
      text = `📋 *Core Capabilities*\n\n• **Risk Detection:** I monitor your schedule and alert you if deadlines slip.\n• **Recovery Plans:** If things go wrong, I provide structured rescue roadmaps.\n• **Daily Briefings:** Morning strategic briefs and evening reflections.`;
    } else if (topic === "examples") {
      text = `💡 *What to say*\n\nTry sending:\n\n• _"Finished DBMS Unit 3"_\n• _"Snooze my ML project by 2 days"_\n• _"I'm feeling overwhelmed today"_\n• _"What should I focus on next?"_`;
    } else if (topic === "privacy") {
      text = `🔒 *Privacy*\n\nYour data is safely isolated in your secure Firestore account. Your API keys are encrypted server-side and never exposed. I only notify you when requested or for critical risk alerts.`;
    } else if (topic === "linking") {
      text = `🔗 *Dashboard Link*\n\nI work in perfect sync with your Saarthi Web Dashboard. You can create tasks on the web and manage execution here.\n\n[Open Web Dashboard](${this.getLiveAppUrl()})`;
    } else if (topic === "faq") {
      text = `❓ *FAQ*\n\n**Q: How do I create a task?**\nA: Right now, task creation happens on the Web Dashboard.\n\n**Q: How do I turn off notifications?**\nA: Head over to Settings.\n\n**Q: Who built Saarthi?**\nA: You did, with AI Studio Build!`;
    } else {
      text = `No information found for this topic.`;
    }

    const inline_keyboard = [
      [{ text: "⬅️ Back to Help", callback_data: "help_index" }, { text: "🏠 Home", callback_data: "menu_home" }]
    ];

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

      let text = `⚙️ *Settings*\n\n`;
      text += `Configure your assistant.\n\n`;
      text += `• Alerts: *${pref.notifications.toUpperCase()}*\n`;
      text += `• Morning Brief: *${pref.dailyBriefing ? "ON" : "OFF"}*\n`;
      text += `• Evening Review: *${pref.eveningReview ? "ON" : "OFF"}*\n`;
      text += `• Sync: *${pref.calendarSync ? "ON" : "OFF"}*\n`;
      text += `• Language: *${pref.language || "English"}*\n`;

      const inline_keyboard = [
        [
          { text: `Morning Brief: ${pref.dailyBriefing ? "✅ ON" : "❌ OFF"}`, callback_data: "toggle_setting:dailyBriefing" },
          { text: `Evening Review: ${pref.eveningReview ? "✅ ON" : "❌ OFF"}`, callback_data: "toggle_setting:eveningReview" }
        ],
        [
          { text: `Calendar Sync: ${pref.calendarSync ? "✅ ON" : "❌ OFF"}`, callback_data: "toggle_setting:calendarSync" },
          { text: "🔔 Alert Style", callback_data: "config_notifications" }
        ],
        [
          { text: "🏠 Home", callback_data: "menu_home" },
          { text: "🔗 Web Dashboard", url: this.getLiveAppUrl() }
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
      await this.sendChatAction(chatId, "typing");
      const loadingMsg = await this.sendMessage(chatId, "☕ _Reflecting on your day..._");
      const loadingMsgId = loadingMsg?.message_id;

      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const tasks = tasksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Task));
      const activeTasks = tasks.filter((t) => t.subtasks.some((s) => !s.done));

      
      const completedSubtasksList = tasks.flatMap(t => t.subtasks.filter(s => s.done && t.lastUpdated > Date.now() - 24*60*60*1000));
      const pendingSubtasksList = tasks.flatMap(t => t.subtasks.filter(s => !s.done));

      let text = `🌙 *Nice work today.*\n\nYou completed:\n\n`;
      if (completedSubtasksList.length > 0) {
        completedSubtasksList.slice(0, 3).forEach(s => text += `✅ ${s.title}\n`);
      } else {
        text += `• Zero milestones today. That's okay, tomorrow is a new day.\n`;
      }
      
      if (pendingSubtasksList.length > 0) {
        text += `\nStill pending:\n`;
        pendingSubtasksList.slice(0, 3).forEach(s => text += `• ${s.title}\n`);
      }
      
      text += `\nRest well.\nWe'll continue tomorrow.`;

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
    let loadingMsgId: any = undefined;
    try {
      await this.sendChatAction(chatId, "typing");
      const loadingMsg = await this.sendMessage(chatId, "☕ _Preparing your briefing..._");
      loadingMsgId = loadingMsg?.message_id;

      let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      try {
        const userSettingsSnap = await dbAdmin.collection("userSettings").doc(userId).get();
        if (userSettingsSnap.exists) {
          const data = userSettingsSnap.data();
          if (data?.timezone) {
            timezone = data.timezone;
          }
        }
      } catch (err) {
        console.warn("Could not fetch user timezone", err);
      }

      let greeting = "☀️ *Good morning!*";
      let greetingLine = "Here's today's plan.";
      try {
        const timeFormatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false });
        const currentHour = parseInt(timeFormatter.format(new Date()), 10);
        if (currentHour >= 12 && currentHour < 17) {
          greeting = "👋 *Good afternoon!*";
          greetingLine = "Here's the plan for the rest of the day.";
        } else if (currentHour >= 17 || currentHour < 4) {
          greeting = "🌙 *Good evening!*";
          greetingLine = "Here's your current status.";
        }
      } catch (err) {
        console.error("Timezone greeting error", err);
      }

      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
      const activeTasks = tasks.filter((t) => t.subtasks.some((s) => !s.done));

      if (activeTasks.length === 0) {
        const msg = `${greeting}\n\nYour execution slate is pristine.\n\nEnjoy your time or plan a new goal.`; 
        if (loadingMsgId) await this.editMessageText(chatId, loadingMsgId, msg); 
        else await this.sendMessage(chatId, msg);
        return;
      }

      
      let totalRemainingMinutes = 0;
      activeTasks.forEach((t) => {
        const taskRem = t.subtasks.filter((s) => !s.done).reduce((acc, s) => acc + (s.estimatedMinutes || 30), 0);
        totalRemainingMinutes += taskRem;
      });
      const hours = Math.floor(totalRemainingMinutes / 60);
      const minutes = totalRemainingMinutes % 60;
      
      let totalConfidence = 0;
      activeTasks.forEach(t => totalConfidence += computeRiskScore(t).completionConfidence);
      const avgConfidence = activeTasks.length > 0 ? Math.round(totalConfidence / activeTasks.length) : 100;
      
      const criticalCount = activeTasks.filter(t => computeRiskScore(t).zone === "critical").length;

      let text = `${greeting}\n_${greetingLine}_\n\n━━━━━━━━━━━━━━\n\n`;
      text += `🎯 *Active Tasks:* ${activeTasks.length}\n`;
      text += `⏳ *Est. Focus Time:* ${hours}h ${minutes}m\n`;
      
      let healthEmoji = "🟢";
      if (avgConfidence < 80) healthEmoji = "🟡";
      if (avgConfidence < 50) healthEmoji = "🔴";
      text += `🧠 *Execution Health:* ${healthEmoji} ${avgConfidence}%\n`;
      
      if (criticalCount > 0) {
        text += `\n⚠️ *Action Required:* ${criticalCount} task${criticalCount > 1 ? 's' : ''} in critical zone\n`;
      }
      
      text += `\n━━━━━━━━━━━━━━\n\n*Ready to begin?*`;

      const inline_keyboard = [
        [{ text: "▶️ Start Focus", callback_data: "tasks_list" }, { text: "📅 Plan", callback_data: "menu_today" }],
        [{ text: "⏰ Schedule", callback_data: "menu_today" }, { text: "⚙️ Settings", callback_data: "menu_settings" }]
      ];

      if (loadingMsgId) {
        await this.editMessageText(chatId, loadingMsgId, text, { reply_markup: { inline_keyboard } });
      } else {
        await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard } });
      }
    } catch (error: any) {
      if (typeof loadingMsgId !== "undefined") {
        await this.editMessageText(chatId, loadingMsgId, `⚠️ Failed to compile morning briefing: ${error.message}`);
      } else {
        await this.sendMessage(chatId, `⚠️ Failed to compile morning briefing: ${error.message}`);
      }
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
      if (data.telegramAlertsEnabled === false) return;
      
      const companion = data.companionProfile?.activeCompanion || "guardian";

      const risk = computeRiskScore(task);
      
      if (risk.zone === "critical") {
        let text = `⚠️ *Heads up.*\n\nYour *${task.title}* is slipping behind schedule.\n\nNothing to panic about.\nI already have a recovery plan ready.`;
        
        if (companion === "commander") {
          text = `🛑 *Critical Alert.*\n\n*${task.title}* is off-track. We cannot afford this delay.\nExecute the recovery plan immediately.`;
        } else if (companion === "strategist") {
          text = `📊 *Risk Threshold Exceeded.*\n\n*${task.title}* has dropped below optimal completion probability.\nI have computed a strategic recovery plan.`;
        } else if (companion === "challenger") {
          text = `⚡ *Time to step up!*\n\nYour *${task.title}* is lagging. I know you can beat this deadline. Let's fix it right now!`;
        } else if (companion === "mentor") {
          text = `🌱 *Check-in.*\n\nIt looks like *${task.title}* is getting difficult. That's completely okay.\nLet's look at the recovery plan to get back on track.`;
        }

        const inline_keyboard = [
            [{ text: "🛟 View Recovery", callback_data: `task_recovery:${task.id}` }],
            [{ text: "⏰ Reschedule", callback_data: `task_snooze:${task.id}` }],
            [{ text: "🙈 Ignore", callback_data: "tasks_list" }]
        ];
        await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard } });
      }

    } catch (error) {
      console.error("Failed to trigger recovery alert via Telegram:", error);
    }
  }

  /**
   * Main Router for all generic text inputs (NLP routing / chat / on-topic discussion / automated commands)
   */
  private async handleGenericMessage(chatId: number, userId: string, messageText: string) {
    try {
      await this.sendChatAction(chatId, "typing");
      
      // Fetch user's tasks from Firestore for full conversational/snoozing/progress matching context
      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
      
      const compactTasks = tasks.map(t => ({
        id: t.id,
        title: t.title,
        deadline: t.deadline,
        isCompleted: t.subtasks.every(s => s.done),
        subtasks: t.subtasks.map(s => ({ id: s.id, title: s.title, done: s.done }))
      }));

      const systemInstruction = `You are Saarthi, the user's ultimate personal execution companion and productivity guide.
You are helping the user track milestones, protect their time, and rescue slipping deadlines.

Your current task is to analyze the user's message, understand their intent, and route/respond accordingly.
You have access to the user's active/completed tasks list:
${JSON.stringify(compactTasks, null, 2)}

Identify which intent matches the user's message.
Possible intents are:
1. "status" -> User wants to view their overall execution health, risk score, or risk levels. (e.g. "how is my task health?", "check my status", "what is my risk level?", "am I on track?")
2. "today" -> User wants to see what's planned for today, their schedule, or a daily overview. (e.g. "what do I have for today?", "show today's plan", "today's schedule")
3. "tasks" -> User wants to view or list all of their tasks, see their board, or commitments. (e.g. "show my tasks", "list my tasks", "what are my commitments?")
4. "confidence" -> User wants to analyze confidence levels, risk factors, or completion confidence. (e.g. "how confident am I?", "what is my confidence?", "show risk factors")
5. "recovery" -> User wants to access the recovery center, manage slipping deadlines, or view rescue recovery plans. (e.g. "open recovery center", "show recovery plans", "how do I rescue my deadlines?")
6. "briefing" -> User wants to hear their dynamic daily briefing or a quick brief. (e.g. "brief me", "give me my daily briefing", "morning briefing")
7. "help" -> User wants general help, feature explanations, or FAQ. (e.g. "help", "how does this work?", "show instructions", "help index")
8. "snooze" -> User wants to postpone or snooze a specific task by a number of days. (e.g. "snooze ML project by 2 days", "postpone chemistry assignment for 3 days", "push DBMS by 1 day").
   If "snooze" is matched, you MUST extract the taskId of the task they mentioned from the tasks list provided above, and the integer number of days to postpone it.
9. "progress_update" -> User wants to report progress, finish a specific task, or check off a milestone/subtask. (e.g. "Finished DBMS unit 3", "unit 2 done", "completed reading first section", "I just finished task 1").
10. "chat" -> User is making general, on-topic conversation, asking for productivity/study advice, talking about focus issues, feeling distracted or tired, or inquiring about Saarthi.
    For "chat", you MUST provide a friendly, encouraging, coaching response in the "chatResponse" property, written in Saarthi's voice, as a knowledgeable and supportive companion.
11. "off_topic" -> User is asking about completely unrelated things (e.g. "who is Einstein?", "how to bake a cake", "write a python program to scrape a website", "tell me a joke").
    For "off_topic", you MUST politely explain that you are their Saarthi (personal execution companion) and that you only focus on helping them manage and execute their tasks and hit their deadlines. Provide a warm correction and direct them back to task execution in the "chatResponse" property.
12. "create_tasks" -> User is doing a "Messy Brain Dump", listing out new tasks, commitments, assignments, deadlines, or just dumping what they have to do. (e.g. "Finish DBMS tomorrow", "I have AI assignment Friday and OS viva Monday", "Need to buy groceries tonight", "Remind me to call professor tomorrow").
13. "overwhelmed" -> User feels stuck, overwhelmed, paralyzed, tired or unable to begin tasks. (e.g. "I'm overwhelmed", "I don't know where to start", "I can't do this", "Help me begin").

Respond strictly in JSON matching the defined schema. Use 0.0 to 1.0 for confidence.`;

      const response = await generateContentWithRetryAndFallback(ai, {
        model: "gemini-2.5-flash",
        contents: `User message: "${messageText}"`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              snoozeInfo: {
                type: Type.OBJECT,
                properties: {
                  taskId: { type: Type.STRING },
                  days: { type: Type.INTEGER }
                },
                required: ["taskId", "days"]
              },
              chatResponse: { type: Type.STRING }
            },
            required: ["intent", "confidence"]
          }
        }
      });

      const result = JSON.parse(response.text.trim());

      // If confidence is too low (< 0.5), default to progress update or general chat
      if (result.confidence < 0.5) {
        await this.handleExecutionUpdate(chatId, userId, messageText);
        return;
      }

      switch (result.intent) {
        case "status":
          await this.handleStatus(chatId, userId);
          break;
        case "today":
          await this.handleToday(chatId, userId);
          break;
        case "tasks":
          await this.handleTasks(chatId, userId);
          break;
        case "confidence":
          await this.handleConfidence(chatId, userId);
          break;
        case "recovery":
          await this.handleRecovery(chatId, userId);
          break;
        case "briefing":
          await this.handleBriefing(chatId, userId);
          break;
        case "help":
          await this.handleHelp(chatId, userId);
          break;
        case "progress_update":
          await this.handleExecutionUpdate(chatId, userId, messageText);
          break;
        case "create_tasks":
          await this.handleCreateTasks(chatId, userId, messageText);
          break;
        case "overwhelmed":
          await this.handleActivationRequest(chatId, userId);
          break;
        case "snooze":
          if (result.snoozeInfo && result.snoozeInfo.taskId && result.snoozeInfo.days && result.snoozeInfo.days > 0) {
            const taskId = result.snoozeInfo.taskId;
            const days = result.snoozeInfo.days;

            const docRef = dbAdmin.collection("tasks").doc(taskId);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
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

              const confirmText = `⏰ *Task Postponed via Saarthi AI!*\n\nI have successfully snoozed your task *${task.title}* by *${days} days*.\n\n• *Old Deadline:* ${new Date(task.deadline).toLocaleDateString()}\n• *New Deadline:* ${currentDeadline.toLocaleDateString()}\n• *Risk Assessment:* *${risk.zone.toUpperCase()}* (${Math.round(risk.completionConfidence)}% confidence)`;

              const inline_keyboard = [
                [{ text: "🔍 Open Task Card", callback_data: `task_details:${task.id}` }],
                [{ text: "📋 Back to Task List", callback_data: "tasks_list" }]
              ];

              await this.sendMessage(chatId, confirmText, { reply_markup: { inline_keyboard } });
            } else {
              await this.sendMessage(chatId, "⚠️ I identified the request to snooze, but couldn't locate the matched task in your list. Please use the inline buttons on your tasks to reschedule.");
            }
          } else {
            await this.sendMessage(chatId, "⚠️ I identified the request to snooze, but couldn't extract the task or the number of days. Try saying something like: _'Snooze my ML project by 2 days'_");
          }
          break;
        case "chat":
        case "off_topic":
          if (result.chatResponse) {
            await this.sendMessage(chatId, result.chatResponse, { reply_markup: this.getMenuKeyboard() });
          } else {
            await this.sendMessage(chatId, "👋 I'm Saarthi, your personal execution companion! How can I help you manage your study, work, or milestones today?");
          }
          break;
        default:
          await this.handleExecutionUpdate(chatId, userId, messageText);
          break;
      }

    } catch (error: any) {
      console.error("Error in generic message router:", error);
      // Fallback to standard execution update if anything fails in NLU routing
      try {
        await this.handleExecutionUpdate(chatId, userId, messageText);
      } catch (innerError: any) {
        await this.sendMessage(chatId, `⚠️ Error processing message: ${innerError.message}`);
      }
    }
  }

  /**
   * Handle natural language brain dump for task creation (Phase 1)
   */
  private async handleCreateTasks(chatId: number, userId: string, messageText: string) {
    try {
      await this.sendChatAction(chatId, "typing");
      const loadingMsg = await this.sendMessage(chatId, "🧠 _Analyzing your thoughts..._");
      const loadingMsgId = loadingMsg?.message_id;

      let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      try {
        const userSettingsSnap = await dbAdmin.collection("userSettings").doc(userId).get();
        if (userSettingsSnap.exists) {
          const data = userSettingsSnap.data();
          if (data?.timezone) {
            timezone = data.timezone;
          }
        }
      } catch (err) {
        console.warn("Could not fetch user timezone", err);
      }
      const now = new Date();
      const currentDateTimeContext = now.toLocaleString("en-US", { timeZone: timezone });

      const systemInstruction = `You are Saarthi, an intelligent execution companion. The user has provided a "messy brain dump" of tasks, commitments, or deadlines.
Your job is to extract these commitments and structure them into highly actionable, specific tasks.

If a task is large or complex (e.g. "Finish DBMS assignment", "Prepare for OS viva"), you MUST aggressively decompose it into smaller, actionable subtasks (each taking < 60 minutes).
If a task is simple (e.g. "Buy groceries", "Pay bill"), 1 or 2 subtasks is enough.

Current Date/Time Context: ${currentDateTimeContext} (Timezone: ${timezone})
If the user says "tomorrow", "tonight", "Friday", calculate the correct absolute ISO string date based on the current date context. If time is not specified, default to 23:59:59 of that day.

Return a JSON array of extracted commitments.`;

      const response = await generateContentWithRetryAndFallback(ai, {
        model: "gemini-2.5-flash",
        contents: `User's Messy Brain Dump:\n\n${messageText}`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              commitments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    deadline: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ["low", "medium", "high"] },
                    effortEstimateMinutes: { type: Type.INTEGER },
                    projectGrouping: { type: Type.STRING },
                    notes: { type: Type.STRING },
                    subtasks: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          estimatedMinutes: { type: Type.INTEGER }
                        },
                        required: ["title"]
                      }
                    }
                  },
                  required: ["title", "deadline", "priority", "subtasks"]
                }
              }
            },
            required: ["commitments"]
          }
        }
      });

      const result = JSON.parse(response.text.trim());
      const commitments = result.commitments || [];

      if (commitments.length === 0) {
        const msg = "🤷 I couldn't extract any actionable tasks from that. Could you try rephrasing?";
        if (loadingMsgId) await this.editMessageText(chatId, loadingMsgId, msg); 
        else await this.sendMessage(chatId, msg);
        return;
      }

      let totalTasks = 0;
      let totalSubtasks = 0;
      let totalDeadlines = 0;

      const batch = dbAdmin.batch();
      
      const createdTasks: any[] = [];

      for (const commitment of commitments) {
        totalTasks++;
        if (commitment.deadline) totalDeadlines++;
        
        const subtasks = (commitment.subtasks || []).map((s: any, idx: number) => {
          totalSubtasks++;
          return {
            id: `sub_${Date.now()}_${idx}_${Math.random().toString(36).substring(2,7)}`,
            title: s.title,
            done: false,
            order: idx,
            estimatedMinutes: s.estimatedMinutes || 30
          };
        });

        if (subtasks.length === 0) {
          subtasks.push({
            id: `sub_${Date.now()}_0_${Math.random().toString(36).substring(2,7)}`,
            title: commitment.title,
            done: false,
            order: 0,
            estimatedMinutes: commitment.effortEstimateMinutes || 30
          });
          totalSubtasks++;
        }

        const taskRef = dbAdmin.collection("tasks").doc();
        const newTask: Task = {
          id: taskRef.id,
          userId: userId,
          title: commitment.title,
          description: commitment.notes || "",
          deadline: commitment.deadline || new Date(Date.now() + 86400000).toISOString(),
          complexity: commitment.priority === "high" ? "high" : commitment.priority === "low" ? "low" : "medium",
          priority: commitment.priority || "medium",
          totalEffortMinutes: commitment.effortEstimateMinutes || subtasks.reduce((acc: number, s: any) => acc + s.estimatedMinutes, 0),
          effortEstimateMinutes: commitment.effortEstimateMinutes || subtasks.reduce((acc: number, s: any) => acc + s.estimatedMinutes, 0),
          subtasks: subtasks,
          sessionsCompleted: 0,
          sessionsPlanned: 0,
          riskFactors: [],
          createdAt: new Date().toISOString(),
          googleCalendarSynced: false,
          googleTasksSynced: false,
          riskScore: 0,
          riskZone: "safe"
        };

        const risk = computeRiskScore(newTask);
        newTask.riskScore = risk.score;
        newTask.riskZone = risk.zone;

        batch.set(taskRef, newTask);
        createdTasks.push(newTask);
      }

      await batch.commit();

      const summaryCard = `━━━━━━━━━━━━━━
🧠 I understood your thoughts.

Created:
✅ ${totalTasks} commitment${totalTasks !== 1 ? 's' : ''}
🗓️ ${totalDeadlines} deadline${totalDeadlines !== 1 ? 's' : ''} detected
📅 Calendar updated
⚡ ${totalSubtasks} subtasks generated

Would you like to review them?
━━━━━━━━━━━━━━`;

      const inline_keyboard = [
        [{ text: "🖥️ Open Dashboard", url: this.getLiveAppUrl() }],
        [{ text: "📅 Today's Plan", callback_data: "menu_today" }],
        [{ text: "📋 View Tasks", callback_data: "tasks_list" }],
        [{ text: "↩️ Undo", callback_data: `undo_tasks:${createdTasks.map(t => t.id).join(",")}` }]
      ];

      if (loadingMsgId) {
        await this.editMessageText(chatId, loadingMsgId, summaryCard, { reply_markup: { inline_keyboard } });
      } else {
        await this.sendMessage(chatId, summaryCard, { reply_markup: { inline_keyboard } });
      }

    } catch (err: any) {
      console.error("Error in handleCreateTasks:", err);
      await this.sendMessage(chatId, `⚠️ Failed to parse your thoughts: ${err.message}`);
    }
  }

  /**
   * Parse natural language progress update (e.g., "Finished Unit 3")
   */
  private async handleExecutionUpdate(chatId: number, userId: string, messageText: string) {
    try {
      await this.sendChatAction(chatId, "typing");
      const loadingMsg = await this.sendMessage(chatId, "🤖 _Analyzing update..._");
      const loadingMsgId = loadingMsg?.message_id;

      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
      const activeTasks = tasks.filter((t) => t.subtasks.some((s) => !s.done));

      if (activeTasks.length === 0) {
        const msg = "🤔 You don't have any active tasks pending currently."; if (loadingMsgId) await this.editMessageText(chatId, loadingMsgId, msg); else await this.sendMessage(chatId, msg);
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
        let text = `✨ Nice!\n\nWhich one?\n`;
        
        const inline_keyboard: any[][] = [];
        activeTasks.slice(0, 4).forEach((t) => {
            inline_keyboard.push([{ text: t.title, callback_data: `task_details:${t.id}` }]);
        });
        inline_keyboard.push([{ text: "Something Else", callback_data: "tasks_list" }]);

        await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard } });
        return;
      }


      // Perform DB updates in Firestore!
      const taskId = result.taskId;
      const subtaskId = result.subtaskId;

      const taskDocRef = dbAdmin.collection("tasks").doc(taskId);
      const taskSnap = await taskDocRef.get();

      if (!taskSnap.exists) {
        const msg = "⚠️ Could not find the matched task in the database."; if (loadingMsgId) await this.editMessageText(chatId, loadingMsgId, msg); else await this.sendMessage(chatId, msg);
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
        lastUpdated: Date.now(),
      };

      // If all done, update sync statuses
      if (completedCount === plannedCount) {
        updateData.googleCalendarSynced = false; // flag for resync if needed
      }

      await taskDocRef.update(updateData);

      
      
      // Send feedback message
      let replyMsg = `🎉 *Nice!*\n\nMilestone completed.\n\nExecution Health\n📈 Confidence: *${risk.completionConfidence}%*\n\nYou're moving in the right direction.`;
      
      const inline_keyboard = [
        [{ text: "▶️ Next Task", callback_data: "tasks_list" }],
        [{ text: "📊 Dashboard", callback_data: "menu_today" }],
        [{ text: "☕ Take a Break", callback_data: "menu_today" }]
      ];
      if (loadingMsgId) await this.editMessageText(chatId, loadingMsgId, replyMsg, { reply_markup: { inline_keyboard } }); else await this.sendMessage(chatId, replyMsg, { reply_markup: { inline_keyboard } });

    } catch (error: any) {
      console.error("Error processing NLP execution update:", error);
      await this.sendMessage(chatId, `⚠️ Failed to process update: ${error.message}`);
    }
  }

  /**
   * Generates a micro action for a stuck task and sends an Activation Card
   */
  private async handleActivationRequest(chatId: number, userId: string, targetTaskId?: string) {
    try {
      await this.sendChatAction(chatId, "typing");
      
      let task: Task | undefined;
      let activeSubtask: Subtask | undefined;

      if (targetTaskId) {
        const taskSnap = await dbAdmin.collection("tasks").doc(targetTaskId).get();
        if (taskSnap.exists) {
          task = { id: taskSnap.id, ...taskSnap.data() } as Task;
        }
      } else {
        // Find a stuck task automatically
        const stuckTasks = await activationService.getStuckTasks(userId);
        if (stuckTasks.length > 0) {
          // Sort by deadline or risk to pick the most critical one
          stuckTasks.sort((a, b) => {
            const riskOrder = { critical: 3, watch: 2, safe: 1 };
            if (riskOrder[a.riskZone] !== riskOrder[b.riskZone]) {
              return riskOrder[b.riskZone] - riskOrder[a.riskZone];
            }
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          });
          task = stuckTasks[0];
        } else {
          // If no explicitly stuck task, just pick the next pending task
          const allTasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
          const activeTasks = allTasksSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Task))
            .filter(t => !t.subtasks.every(s => s.done))
            .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
          
          if (activeTasks.length > 0) {
            task = activeTasks[0];
          }
        }
      }

      if (!task) {
        await this.sendMessage(chatId, "💜 You actually don't have any pending tasks right now. You're completely clear. Take a rest!");
        return;
      }

      activeSubtask = task.subtasks.find(s => !s.done);
      
      const action = await activationService.generateMicroAction(task, activeSubtask);
      const session = await activationService.createActivationSession(userId, task.id, action.title, action.estimatedMinutes, activeSubtask?.id, 0);

      const msg = `💜 Saarthi noticed something.

That assignment looks heavier than it needs to.

Forget finishing it.

Can we just do ONE tiny step?

━━━━━━━━━━

Today's ${action.estimatedMinutes}-minute mission:

📖 *${action.title}*

Estimated time
${action.estimatedMinutes} minutes

━━━━━━━━━━`;

      const inline_keyboard = [
        [{ text: "🚀 Let's Start", callback_data: `activation_start:${session.id}` }],
        [{ text: "🧩 Make It Even Smaller", callback_data: `activation_shrink:${session.id}` }],
        [{ text: "😴 Snooze", callback_data: `task_snooze_menu:${task.id}` }],
        [{ text: "📅 Reschedule", callback_data: `task_snooze_menu:${task.id}` }]
      ];

      await this.sendMessage(chatId, msg, { reply_markup: { inline_keyboard } });

    } catch (err: any) {
      console.error("Activation request error:", err);
      await this.sendMessage(chatId, `⚠️ I ran into a small issue parsing your tasks. (Error: ${err.message})`);
    }
  }

  public async handleActivationCallback(chatId: number, userId: string, action: string, sessionId: string, messageId: number) {
    try {
      const sessionSnap = await dbAdmin.collection("activationSessions").doc(sessionId).get();
      if (!sessionSnap.exists) return;
      const session = sessionSnap.data() as ActivationSession;

      const taskSnap = await dbAdmin.collection("tasks").doc(session.taskId).get();
      const task = taskSnap.exists ? { id: taskSnap.id, ...taskSnap.data() } as Task : null;

      if (!task) {
        await this.sendMessage(chatId, "⚠️ Task not found anymore.");
        return;
      }

      if (action === "start") {
        await dbAdmin.collection("activationSessions").doc(sessionId).update({
          status: "active",
          startedAt: new Date().toISOString()
        });

        const activeMsg = `⏱️ *Focus Timer Started*\n\nMission: *${session.microMissionTitle}*\n\nI'll wait right here. Come back and tap when you're done.`;
        const inline_keyboard = [
          [{ text: "✅ Done", callback_data: `activation_complete:${sessionId}` }],
          [{ text: "🧩 Too Hard, Shrink It", callback_data: `activation_shrink:${sessionId}` }]
        ];

        await this.editMessageText(chatId, messageId, activeMsg, { reply_markup: { inline_keyboard } });
      } 
      else if (action === "shrink") {
        await this.sendChatAction(chatId, "typing");
        const subtask = task.subtasks.find(s => s.id === session.subtaskId);
        const newAction = await activationService.generateMicroAction(task, subtask, session.microMissionTitle);
        
        // Update session
        const newShrinkLevel = session.shrinkLevel + 1;
        await dbAdmin.collection("activationSessions").doc(sessionId).update({
          microMissionTitle: newAction.title,
          estimatedMinutes: newAction.estimatedMinutes,
          shrinkLevel: newShrinkLevel
        });

        const msg = `💜 Okay. We're breaking it down more.

━━━━━━━━━━

New Micro Mission:

📖 *${newAction.title}*

Estimated time
${newAction.estimatedMinutes} minutes

━━━━━━━━━━`;

        const inline_keyboard = [
          [{ text: "🚀 Let's Start", callback_data: `activation_start:${sessionId}` }],
          [{ text: "🧩 Even Smaller", callback_data: `activation_shrink:${sessionId}` }],
          [{ text: "😴 Snooze", callback_data: `task_snooze_menu:${task.id}` }]
        ];

        await this.editMessageText(chatId, messageId, msg, { reply_markup: { inline_keyboard } });
      }
      else if (action === "complete") {
        const analytics = await activationService.completeActivationSession(userId, sessionId);

        const msgs = [
          "Momentum restored.",
          "Nice. One step completed.",
          "That's how difficult work gets finished.",
          "Great job."
        ];
        const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];
        
        // Give a slight bump to confidence
        const oldRisk = computeRiskScore(task);
        // We simulate a confidence bump for visual celebration, the real confidence gets updated as subtasks are marked done.
        const confidenceBump = Math.min(100, Math.round(oldRisk.completionConfidence + 4));

        let replyMsg = `🎉 *${randomMsg}*\n\n`;
        replyMsg += `📈 Confidence increased to *${confidenceBump}%*\n`;
        replyMsg += `🔥 Streak: *${analytics.currentStreak}*\n`;
        replyMsg += `⚡ Momentum Score: *${analytics.momentumScore}*\n\n`;
        replyMsg += `Would you like to do one more tiny step, or check off the subtask?`;

        const inline_keyboard = [
          [{ text: "✅ Subtask is Done", callback_data: `toggle_subtask:${task.id}:${session.subtaskId}` }],
          [{ text: "▶️ Next Micro Step", callback_data: `activation_next:${task.id}` }],
          [{ text: "☕ I'm Done for Now", callback_data: "menu_home" }]
        ];

        await this.editMessageText(chatId, messageId, replyMsg, { reply_markup: { inline_keyboard } });
      }
    } catch (err: any) {
      console.error("Activation callback error:", err);
      await this.sendMessage(chatId, `⚠️ ${err.message}`);
    }
  }

}

export const telegramService = new TelegramService();

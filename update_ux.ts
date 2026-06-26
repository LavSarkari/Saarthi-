import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Update Keyboard
const keyboardReplacement = `  private getMenuKeyboard() {
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
  }`;
content = content.replace(/private getMenuKeyboard\(\) \{[\s\S]*?persistent: true\n\s*\};\n\s*\}/, keyboardReplacement);

// 2. Add handleHome
const handleHomeCode = `
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
      
      let text = \`🏠 *Saarthi Home*\\n\\n✨ Good to see you, \${username}.\\n\\n\`;
      text += \`━━━━━━━━━━━━━━\\n\`;
      text += \`📈 *Execution Health*: \${avgConfidence}%\\n\`;
      text += \`🎯 *Active Tasks*: \${activeTasks.length}\\n\`;
      if (criticalCount > 0) {
        text += \`⚠️ *Recovery Alerts*: \${criticalCount} critical\\n\`;
      } else {
        text += \`✅ *Recovery Alerts*: None\\n\`;
      }
      text += \`━━━━━━━━━━━━━━\\n\\n\`;
      
      // Get current focus
      const sortedTasks = [...activeTasks].sort((a: any, b: any) => new Date(a.deadline || a.dueDate).getTime() - new Date(b.deadline || b.dueDate).getTime());
      if (sortedTasks.length > 0) {
        text += \`🎯 *Current Focus*\\n\${sortedTasks[0].title}\\n\\n\`;
      } else {
        text += \`🎯 *Current Focus*\\nNone. Ready to plan?\\n\\n\`;
      }
      
      text += \`What would you like to do?\`;
      
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
      await this.sendMessage(chatId, \`⚠️ Could not load home.\`);
    }
  }
`;

if (!content.includes('async handleHome(')) {
    content = content.replace('async handleTasks(', handleHomeCode + '\n  async handleTasks(');
}


// 3. Update message handler logic
const messageHandlerUpdate = `
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
        await this.sendMessage(chatId, \`🤖 *Saarthi Premium AI Assistant*\\n\\nI am listening in plain text! Feel free to talk to me naturally. You don't need to memorize slash commands anymore.\\n\\n*Try sending:*\\n• _"I finished DBMS Unit 3 study"_\\n• _"Snooze my ML project by 2 days"_\\n• _"What should I study next?"_\\n• _"I'm feeling super exhausted today"_\\n• _"Can you explain normal forms in DBMS?"_\`);
        return;
      } else if (text === "⚙️ Settings") {
        await this.handleSettings(chatId, userId);
        return;
      } else if (text === "❓ Help") {
        await this.handleHelp(chatId, userId);
        return;
      }
    }
`;

content = content.replace(
  /\/\/ 1\. Check if the text matches a persistent Reply Keyboard button[\s\S]*?\/\/ 2\. Handle \/start and \/link account linking flows/,
  messageHandlerUpdate + '\n    // 2. Handle /start and /link account linking flows'
);

content = content.replace(
  /\/\/ Send beautiful linked home greeting\n\s*await this\.sendMessage\(\n\s*chatId,\n\s*`✨ \*Namaste, \$\{username\}!\* Welcome back to Saarthi, your premium execution companion\. ✨\\n\\nUse the persistent menu keyboard below to explore tasks, health status, settings, or talk directly to the AI Assistant\.`,\n\s*\{ reply_markup: this\.getMenuKeyboard\(\) \}\n\s*\);/,
  `// Send beautiful linked home greeting\n          await this.sendMessage(chatId, "Welcome back!", { reply_markup: this.getMenuKeyboard() }).catch(() => {});\n          await this.handleHome(chatId, userId, username);`
);

// 4. Update Handle Tasks
const tasksCode = `
      if (activeTasks.length === 0) {
        const text = "📝 *No active tasks.*\\n\\nYour execution slate is pristine. Fantastic job!";
        const opt = { reply_markup: { inline_keyboard: [[{ text: "➕ Create Task (Web)", url: this.getLiveAppUrl() }]] } };
        if (editMessageId) {
          await this.editMessageText(chatId, editMessageId, text, opt);
        } else {
          await this.sendMessage(chatId, text, opt);
        }
        return;
      }

      let text = \`📋 *Active Tasks*\\n\\nYou have \${activeTasks.length} commitments pending.\\n\\nSelect a task below:\`;

      const inline_keyboard: any[][] = [];
      activeTasks.forEach((t: any) => {
        const risk = computeRiskScore(t);
        const riskEmoji = risk.zone === "critical" ? "🚨" : risk.zone === "watch" ? "⚠️" : "✅";
        inline_keyboard.push([
          { text: \`\${riskEmoji} \${t.title} (\${Math.round(risk.completionConfidence)}%)\`, callback_data: \`task_details:\${t.id}\` }
        ]);
      });

      const opt = { reply_markup: { inline_keyboard } };
      if (editMessageId) {
        await this.editMessageText(chatId, editMessageId, text, opt);
      } else {
        await this.sendMessage(chatId, text, opt);
      }
`;
content = content.replace(
  /if \(activeTasks\.length === 0\) \{[\s\S]*?await this\.sendMessage\(chatId, errText\);\n\s*\}\n\s*\}/,
  tasksCode + '\n    } catch (error: any) {\n      const errText = `⚠️ Failed to load tasks.`;\n      if (editMessageId) {\n        await this.editMessageText(chatId, editMessageId, errText);\n      } else {\n        await this.sendMessage(chatId, errText);\n      }\n    }\n  }'
);

// 5. Rich Task Card
const richTaskCardCode = `
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

      let card = \`━━━━━━━━━━━━━━\\n\`;
      card += \`🎯 *\${t.title.toUpperCase()}*\\n\`;
      card += \`━━━━━━━━━━━━━━\\n\\n\`;
      card += \`📅 *Deadline*: \${deadlineDate} (\${daysRemaining}d)\\n\`;
      card += \`⏱️ *Time Left*: ~\${Math.round(remainingMinutes)} mins\\n\\n\`;
      card += \`📊 *Health*: \${riskEmoji} \${risk.zone.toUpperCase()} (\${Math.round(risk.completionConfidence)}%)\\n\`;
      card += \`📈 *Progress*: \${completedSubtasks}/\${totalSubtasks} completed\\n\\n\`;
      card += \`━━━━━━━━━━━━━━\`;

      const inline_keyboard = [
        [
          { text: "✅ Check Milestones", callback_data: \`milestones_list:\${t.id}\` }
        ],
        [
          { text: "📅 Reschedule", callback_data: \`task_snooze:\${t.id}\` },
          { text: "🛟 Recovery", callback_data: \`task_recovery:\${t.id}\` }
        ],
        [
          { text: "⬅️ Back", callback_data: "tasks_list" }
        ]
      ];

      await this.editMessageText(chatId, editMessageId, card, {
        reply_markup: { inline_keyboard }
      });
`;
content = content.replace(
  /const t = \{ id: docSnap\.id, \.\.\.docSnap\.data\(\) \} as Task;[\s\S]*?await this\.editMessageText\(chatId, editMessageId, card, \{\n\s*reply_markup: \{ inline_keyboard \}\n\s*\}\);\n/,
  richTaskCardCode + '\n'
);


fs.writeFileSync(filePath, content, 'utf-8');
console.log("TypeScript file updated successfully for Premium UX.");

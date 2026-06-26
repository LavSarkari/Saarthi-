import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Update Morning Briefing
const briefingCode = `
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

      let text = \`☀️ *Good morning!*\\n\\nHere's today's plan.\\n\\n━━━━━━━━━━━━━━\\n\\n\`;
      text += \`📋 *Tasks*\\n\${activeTasks.length}\\n\\n\`;
      text += \`⏰ *Focus Time*\\n\${hours}h \${minutes}m\\n\\n\`;
      text += \`📈 *Execution Health*\\n\${avgConfidence}%\\n\\n\`;
      if (criticalCount > 0) {
        text += \`⚠️ *Recovery Needed*\\n\${criticalCount} task\${criticalCount > 1 ? 's' : ''}\\n\\n\`;
      }
      text += \`━━━━━━━━━━━━━━\\n\\nReady?\`;
      
      const inline_keyboard = [
        [{ text: "▶️ Start Focus", callback_data: "tasks_list" }],
        [{ text: "📅 Today's Plan", callback_data: "menu_today" }],
        [{ text: "⏰ Reschedule", callback_data: "menu_today" }]
      ];

      await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard } });
`;

content = content.replace(
  /const tasksPayload = activeTasks\.map\(\(t\) => \{[\s\S]*?await this\.sendMessage\(chatId, briefingText\);\n/,
  briefingCode
);

// 2. Update Evening Review
const eveningCode = `
      const completedSubtasksList = tasks.flatMap(t => t.subtasks.filter(s => s.done && t.lastUpdated > Date.now() - 24*60*60*1000));
      const pendingSubtasksList = tasks.flatMap(t => t.subtasks.filter(s => !s.done));

      let text = \`🌙 *Nice work today.*\\n\\nYou completed:\\n\\n\`;
      if (completedSubtasksList.length > 0) {
        completedSubtasksList.slice(0, 3).forEach(s => text += \`✅ \${s.title}\\n\`);
      } else {
        text += \`• Zero milestones today. That's okay, tomorrow is a new day.\\n\`;
      }
      
      if (pendingSubtasksList.length > 0) {
        text += \`\\nStill pending:\\n\`;
        pendingSubtasksList.slice(0, 3).forEach(s => text += \`• \${s.title}\\n\`);
      }
      
      text += \`\\nRest well.\\nWe'll continue tomorrow.\`;

      const inline_keyboard = [
        [{ text: "📅 Today's Agenda", callback_data: "menu_today" }],
        [{ text: "📋 Full Active List", callback_data: "tasks_list" }]
      ];

      await this.sendMessage(chatId, text, {
        reply_markup: { inline_keyboard }
      });
`;

content = content.replace(
  /const completedSubtasksList = tasks\.flatMap[\s\S]*?await this\.sendMessage\(chatId, text, \{\n\s*reply_markup: \{ inline_keyboard \}\n\s*\}\);\n/,
  eveningCode
);

// 3. NLP Response
const nlpResponse = `
      // Send feedback message
      let replyMsg = \`🎉 *Nice!*\\n\\nMilestone updated: \${result.comment}\\n\\nExecution Health\\n📈 Confidence: *\${risk.completionConfidence}%*\`;
      
      const inline_keyboard = [
        [{ text: "▶️ Next Task", callback_data: "tasks_list" }],
        [{ text: "📊 Dashboard", callback_data: "menu_today" }]
      ];
      await this.sendMessage(chatId, replyMsg, { reply_markup: { inline_keyboard } });
`;

content = content.replace(
  /\/\/ Send feedback message\n\s*let replyMsg = `✅ \*Milestone Synced!\*[\s\S]*?await this\.sendMessage\(chatId, replyMsg\);/,
  nlpResponse
);

// 4. Alert Code
const alertCode = `
      if (risk.zone === "critical") {
        const text = \`⚠️ *Heads up.*\\n\\nYour *\${task.title}* is slipping behind schedule.\\n\\nNothing to panic about.\\nI already have a recovery plan ready.\`;
        const inline_keyboard = [
            [{ text: "🛟 View Recovery", callback_data: \`task_recovery:\${task.id}\` }],
            [{ text: "⏰ Reschedule", callback_data: \`task_snooze:\${task.id}\` }],
            [{ text: "🙈 Ignore", callback_data: "tasks_list" }]
        ];
        await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard } });
      }
`;

content = content.replace(
  /if \(risk\.zone === "critical"\) \{[\s\S]*?await this\.sendMessage\(chatId, text\);\n\s*\}/,
  alertCode
);

// 5. Status / Health Update
const statusCode = `
      const avgConfidence = Math.round(totalConfidence / activeTasks.length);
      const totalRemainingHours = (totalRemainingMinutes / 60).toFixed(1);

      let text = \`━━━━━━━━━━━━━━\\n\\n\`;
      text += \`📊 *Execution Health*\\n\\n\`;
      text += \`🎯 Confidence: *\${avgConfidence}%*\\n\`;
      text += \`📋 Active: *\${activeTasks.length} tasks*\\n\`;
      if (criticalCount > 0) text += \`🚨 Risk: *\${criticalCount} critical*\\n\`;
      text += \`\\n━━━━━━━━━━━━━━\\n\\n\`;
      text += \`What's next?\`;

      const inline_keyboard = [
        [
          { text: "▶️ Continue", callback_data: "tasks_list" },
          { text: "🛟 Need Help", callback_data: "menu_recovery" }
        ],
        [
          { text: "💤 Done for Today", callback_data: "tasks_list" }
        ]
      ];
`;

content = content.replace(
  /const avgConfidence = Math\.round\(totalConfidence \/ activeTasks\.length\);[\s\S]*?const inline_keyboard = \[[\s\S]*?\];\n/,
  statusCode
);

// 6. Help Capture
const helpCapture = `
    // 3.5 Intercept "I'm stuck" / "help" / "overwhelmed"
    const lowerText = text.toLowerCase();
    if (lowerText.includes("stuck") || lowerText.includes("overwhelmed") || lowerText.includes("help") || lowerText.includes("tired")) {
      const inline_keyboard = [
        [{ text: "🐞 Bug", callback_data: "tasks_list" }],
        [{ text: "🧠 Can't figure it out", callback_data: "tasks_list" }],
        [{ text: "😵 Overwhelmed", callback_data: "menu_recovery" }],
        [{ text: "📚 Don't know what to do", callback_data: "tasks_list" }]
      ];
      await this.sendMessage(chatId, \`💛 Happens to everyone.\\n\\nWhere are you stuck?\`, { reply_markup: { inline_keyboard } });
      return;
    }

    // 4. Default to premium conversational NLP processing
`;

content = content.replace("// 4. Default to premium conversational NLP processing (AI Companion Mode)", helpCapture);

// 7. Help Center
const helpCode = `
  async handleHelp(chatId: number, userId: string, editMessageId?: number) {
    const text = \`👋 *Here to help.*\\n\\nWhat do you need assistance with?\`;
    
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
`;

content = content.replace(
  /async handleHelp[\s\S]*?const inline_keyboard = \[[\s\S]*?\];\n/,
  helpCode
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log("TypeScript file updated successfully.");

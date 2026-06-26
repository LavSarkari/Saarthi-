import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const settingsCode = `
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

      let text = \`⚙️ *Settings*\\n\\n\`;
      text += \`Configure your assistant.\\n\\n\`;
      text += \`• Alerts: *\${pref.notifications.toUpperCase()}*\\n\`;
      text += \`• Morning Brief: *\${pref.dailyBriefing ? "ON" : "OFF"}*\\n\`;
      text += \`• Evening Review: *\${pref.eveningReview ? "ON" : "OFF"}*\\n\`;
      text += \`• Sync: *\${pref.calendarSync ? "ON" : "OFF"}*\\n\`;
      text += \`• Language: *\${pref.language || "English"}*\\n\`;

      const inline_keyboard = [
        [
          { text: \`Morning Brief: \${pref.dailyBriefing ? "✅ ON" : "❌ OFF"}\`, callback_data: "toggle_setting:dailyBriefing" },
          { text: \`Evening Review: \${pref.eveningReview ? "✅ ON" : "❌ OFF"}\`, callback_data: "toggle_setting:eveningReview" }
        ],
        [
          { text: \`Calendar Sync: \${pref.calendarSync ? "✅ ON" : "❌ OFF"}\`, callback_data: "toggle_setting:calendarSync" },
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
`;
content = content.replace(
  /async handleSettings\(chatId: number, userId: string, editMessageId\?: number\) \{[\s\S]*?console\.error\("Error loading settings:", err\);\n\s*\}\n\s*\}/,
  settingsCode
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log("TypeScript file updated for settings.");

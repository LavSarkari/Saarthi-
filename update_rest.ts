import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Update Today
const todayCode = `
      const dueToday = tasks.filter((t: any) => {
        if (!t.subtasks.some((s: any) => !s.done)) return false;
        const d = new Date(t.deadline || t.dueDate);
        const today = new Date();
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      });

      if (dueToday.length === 0) {
        let text = \`📅 *Today's Agenda*\\n\\nNo deadlines today. You have space to focus deeply or rest.\`;
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

      let text = \`📅 *Today's Agenda*\\n\\n\`;
      const inline_keyboard: any[][] = [];
      dueToday.forEach((t: any) => {
        inline_keyboard.push([{ text: \`🎯 \${t.title}\`, callback_data: \`task_details:\${t.id}\` }]);
      });
      inline_keyboard.push([{ text: "🏠 Home", callback_data: "menu_home" }]);
      
      if (editMessageId) {
        await this.editMessageText(chatId, editMessageId, text, { reply_markup: { inline_keyboard } });
      } else {
        await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard } });
      }
`;
content = content.replace(
  /const dueToday = tasks\.filter[\s\S]*?console\.error\("Error in Today's plan handler:", error\);\n\s*\}\n\s*\}/,
  todayCode + '\n    } catch (error: any) {\n      console.error(error);\n    }\n  }'
);

// 2. Update Status (Health)
const statusCode = `
      if (activeTasks.length === 0) {
        await this.sendMessage(chatId, "⭐ *100% Execution Confidence!* You are fully caught up.");
        return;
      }

      let text = \`━━━━━━━━━━━━━━\\n\`;
      text += \`📊 *Execution Health Report*\\n\\n\`;
      text += \`🎯 Confidence: *\${avgConfidence}%*\\n\`;
      text += \`📋 Active Tasks: *\${activeTasks.length}*\\n\`;
      if (criticalCount > 0) text += \`🚨 Critical Risk: *\${criticalCount}*\\n\`;
      text += \`\\n━━━━━━━━━━━━━━\\n\\n\`;
      text += \`What would you like to review?\`;

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
`;
// Wait, I need to match the original handleStatus carefully.
// Let's just find `async handleStatus`
const fullStatusCode = `
  async handleStatus(chatId: number, userId: string, editMessageId?: number) {
    try {
      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const tasks = tasksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const activeTasks = tasks.filter((t: any) => t.subtasks.some((s: any) => !s.done));

      let totalConfidence = 0;
      activeTasks.forEach((t: any) => totalConfidence += computeRiskScore(t).completionConfidence);
      const avgConfidence = activeTasks.length > 0 ? Math.round(totalConfidence / activeTasks.length) : 100;
      const criticalCount = activeTasks.filter((t: any) => computeRiskScore(t).zone === "critical").length;
` + statusCode + `
    } catch (error: any) {
      console.error(error);
    }
  }
`;
content = content.replace(
  /async handleStatus\(chatId: number, userId: string, editMessageId\?: number\) \{[\s\S]*?console\.error\("Error building execution health status:", error\);\n\s*\}\n\s*\}/,
  fullStatusCode
);

// 3. Update Recovery
const fullRecoveryCode = `
  async handleRecovery(chatId: number, userId: string, editMessageId?: number) {
    try {
      const tasksSnap = await dbAdmin.collection("tasks").where("userId", "==", userId).get();
      const tasks = tasksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      
      const highRiskTasks = tasks.filter((t: any) => {
        const risk = computeRiskScore(t);
        return (risk.zone === "critical" || risk.zone === "watch") && t.subtasks.some((s: any) => !s.done);
      });

      if (highRiskTasks.length === 0) {
        const clearMsg = \`🛟 *Recovery Center*\\n\\n*All systems stable!* None of your active commitments are triggering risk flags.\\n\\nContinue your progress!\`;
        const opt = { reply_markup: { inline_keyboard: [[{ text: "🏠 Home", callback_data: "menu_home" }]] } };
        if (editMessageId) {
          await this.editMessageText(chatId, editMessageId, clearMsg, opt);
        } else {
          await this.sendMessage(chatId, clearMsg, opt);
        }
        return;
      }

      let text = \`🛟 *Recovery Center*\\n\\n\`;
      text += \`These tasks need immediate attention.\\nSelect one to generate a rescue plan.\\n\\n\`;
      
      const inline_keyboard: any[][] = [];
      highRiskTasks.forEach((t: any) => {
         const risk = computeRiskScore(t);
         const icon = risk.zone === "critical" ? "🚨" : "⚠️";
         inline_keyboard.push([{ text: \`\${icon} \${t.title} (\${Math.round(risk.completionConfidence)}%)\`, callback_data: \`task_recovery:\${t.id}\` }]);
      });
      inline_keyboard.push([{ text: "🏠 Home", callback_data: "menu_home" }]);

      const opt = { reply_markup: { inline_keyboard } };
      if (editMessageId) {
         await this.editMessageText(chatId, editMessageId, text, opt);
      } else {
         await this.sendMessage(chatId, text, opt);
      }
    } catch (e) {
      console.error(e);
    }
  }
`;
content = content.replace(
  /async handleRecovery\(chatId: number, userId: string, editMessageId\?: number\) \{[\s\S]*?console\.error\("Error generating recovery list:", error\);\n\s*\}\n\s*\}/,
  fullRecoveryCode
);


fs.writeFileSync(filePath, content, 'utf-8');
console.log("TypeScript file updated successfully for other menus.");

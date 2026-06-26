import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const nlpResponse = `
      // Send feedback message
      let replyMsg = \`🎉 *Nice!*\\n\\nMilestone completed.\\n\\nExecution Health\\n📈 Confidence: *\${risk.completionConfidence}%*\\n\\nYou're moving in the right direction.\`;
      
      const inline_keyboard = [
        [{ text: "▶️ Next Task", callback_data: "tasks_list" }],
        [{ text: "📊 Dashboard", callback_data: "menu_today" }],
        [{ text: "☕ Take a Break", callback_data: "menu_today" }]
      ];
      await this.sendMessage(chatId, replyMsg, { reply_markup: { inline_keyboard } });
`;

content = content.replace(
  /\/\/ Send feedback message\n\s*let replyMsg = `🎉 \*Nice!\*[\s\S]*?await this\.sendMessage\(chatId, replyMsg, \{ reply_markup: \{ inline_keyboard \} \}\);/,
  nlpResponse
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log("TypeScript file updated successfully for celebrate message.");

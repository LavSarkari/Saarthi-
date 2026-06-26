import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const clarifyCode = `
      if (!result.matched || result.confidence < 0.5 || !result.taskId) {
        let text = \`✨ Nice!\\n\\nWhich one?\\n\`;
        
        const inline_keyboard: any[][] = [];
        activeTasks.slice(0, 4).forEach((t) => {
            inline_keyboard.push([{ text: t.title, callback_data: \`task_details:\${t.id}\` }]);
        });
        inline_keyboard.push([{ text: "Something Else", callback_data: "tasks_list" }]);

        await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard } });
        return;
      }
`;

content = content.replace(
  /if \(!result\.matched \|\| result\.confidence < 0\.5 \|\| !result\.taskId\) \{[\s\S]*?return;\n\s*\}/,
  clarifyCode
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log("TypeScript file updated successfully for clarify message.");

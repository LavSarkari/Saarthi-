import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const menuHomeAddition = `      } else if (data === "menu_home") {
        await this.answerCallbackQuery(callbackId);
        // Assuming we need username, we can fallback to "User" if not readily available in callback
        const username = callback.from?.username || callback.from?.first_name || "User";
        await this.handleHome(chatId, userId, username, messageId);
      } else if (data === "menu_today") {`;
content = content.replace(/\} else if \(data === "menu_today"\) \{/, menuHomeAddition);

fs.writeFileSync(filePath, content, 'utf-8');
console.log("menu_home mapped");

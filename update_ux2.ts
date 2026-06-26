import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const sendChatActionCode = `
  async sendChatAction(chatId: number | string, action: string = "typing") {
    if (!this.token) return;
    const url = \`https://api.telegram.org/bot\${this.token}/sendChatAction\`;
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, action })
      });
    } catch (e) {}
  }
`;
if (!content.includes('sendChatAction(')) {
    content = content.replace('  async sendMessage(', sendChatActionCode + '\n  async sendMessage(');
}

// Modify sendMessage to return result
const sendMessageCode = `
  async sendMessage(chatId: number | string, text: string, options: any = {}): Promise<any> {
    if (!this.token) {
      console.warn("TELEGRAM_BOT_TOKEN is missing. Cannot send message.");
      return null;
    }

    const url = \`https://api.telegram.org/bot\${this.token}/sendMessage\`;
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
`;
content = content.replace(
  /async sendMessage\(chatId: number \| string, text: string, options: any = \{\}\): Promise<boolean> \{[\s\S]*?return false;\n\s*\}\n\s*\}/,
  sendMessageCode
);

// 1. handleExecutionUpdate
const execUpdateRegex = /await this\.sendMessage\(chatId, "🤖 \*Analyzing execution update\.\.\.\*"\);/;
content = content.replace(execUpdateRegex, `await this.sendChatAction(chatId, "typing");\n      const loadingMsg = await this.sendMessage(chatId, "🤖 _Analyzing update..._");\n      const loadingMsgId = loadingMsg?.message_id;`);

content = content.replace(
  /await this\.sendMessage\(chatId, "🤔 You don't have any active tasks pending currently\. Use \/tasks to check\."\);/,
  `const msg = "🤔 You don't have any active tasks pending currently."; if (loadingMsgId) await this.editMessageText(chatId, loadingMsgId, msg); else await this.sendMessage(chatId, msg);`
);

content = content.replace(
  /await this\.sendMessage\(chatId, text, \{ reply_markup: \{ inline_keyboard \} \}\);/,
  `if (loadingMsgId) await this.editMessageText(chatId, loadingMsgId, text, { reply_markup: { inline_keyboard } }); else await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard } });`
);

content = content.replace(
  /await this\.sendMessage\(chatId, "⚠️ Could not find the matched task in the database\."\);/,
  `const msg = "⚠️ Could not find the matched task in the database."; if (loadingMsgId) await this.editMessageText(chatId, loadingMsgId, msg); else await this.sendMessage(chatId, msg);`
);

content = content.replace(
  /await this\.sendMessage\(chatId, replyMsg, \{ reply_markup: \{ inline_keyboard \} \}\);/,
  `if (loadingMsgId) await this.editMessageText(chatId, loadingMsgId, replyMsg, { reply_markup: { inline_keyboard } }); else await this.sendMessage(chatId, replyMsg, { reply_markup: { inline_keyboard } });`
);

// 2. handleBriefing
const briefingRegex = /await this\.sendMessage\(chatId, "☕ \*Brewing your strategic morning briefing\.\.\. Please wait\.\*"\);/;
content = content.replace(briefingRegex, `await this.sendChatAction(chatId, "typing");\n      const loadingMsg = await this.sendMessage(chatId, "☕ _Preparing morning briefing..._");\n      const loadingMsgId = loadingMsg?.message_id;`);

const briefingZeroTasks = /await this\.sendMessage\(\n\s*chatId,\n\s*"☕ \*Good Morning!\* You have no pending active commitments\. A fully cleared execution slate! Enjoy your day or plan a new goal\."\n\s*\);/;
content = content.replace(briefingZeroTasks, `const msg = "☕ *Good Morning!* Your execution slate is pristine.\\n\\nEnjoy your day or plan a new goal."; if (loadingMsgId) await this.editMessageText(chatId, loadingMsgId, msg); else await this.sendMessage(chatId, msg);`);

content = content.replace(
  /await this\.sendMessage\(chatId, text, \{ reply_markup: \{ inline_keyboard \} \}\);/,
  `if (loadingMsgId) await this.editMessageText(chatId, loadingMsgId, text, { reply_markup: { inline_keyboard } }); else await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard } });`
);


// 3. handleEveningReview
const eveningRegex = /await this\.sendMessage\(chatId, "☕ \*Reflecting on your daily progress\.\.\. Please wait\.\*"\);/;
content = content.replace(eveningRegex, `await this.sendChatAction(chatId, "typing");\n      const loadingMsg = await this.sendMessage(chatId, "☕ _Reflecting on your day..._");\n      const loadingMsgId = loadingMsg?.message_id;`);

const eveningZeroTasks = /await this\.sendMessage\(\n\s*chatId,\n\s*"🌙 \*Evening Reflection\*\n\nGreat job today! You have absolutely zero pending commitments left\.\nRest easy\!"\n\s*\);/;
content = content.replace(eveningZeroTasks, `const msg = "🌙 *Evening Reflection*\\n\\nGreat job today! Zero pending commitments left.\\n\\nRest easy!"; if (loadingMsgId) await this.editMessageText(chatId, loadingMsgId, msg); else await this.sendMessage(chatId, msg);`);

content = content.replace(
  /await this\.sendMessage\(chatId, text, \{\n\s*reply_markup: \{ inline_keyboard \}\n\s*\}\);\n/,
  `if (loadingMsgId) await this.editMessageText(chatId, loadingMsgId, text, { reply_markup: { inline_keyboard } }); else await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard } });\n`
);

// 4. Recovery
const recoveryGenRegex = /await this\.sendMessage\(chatId, "🛟 \*Analyzing your constraints and generating a viable AI recovery roadmap\.\.\. Please wait\.\*"\);/;
content = content.replace(recoveryGenRegex, `await this.sendChatAction(chatId, "typing");\n      const loadingMsg = await this.sendMessage(chatId, "🛟 _Generating recovery roadmap..._");\n      const loadingMsgId = loadingMsg?.message_id;`);

// Since there are multiple "await this.sendMessage(" in recovery, we will replace just the final one.
const recoverySend = /await this\.sendMessage\(chatId, planText, \{ reply_markup: \{ inline_keyboard \} \}\);/;
content = content.replace(recoverySend, `if (loadingMsgId) await this.editMessageText(chatId, loadingMsgId, planText, { reply_markup: { inline_keyboard } }); else await this.sendMessage(chatId, planText, { reply_markup: { inline_keyboard } });`);


fs.writeFileSync(filePath, content, 'utf-8');
console.log("TypeScript file updated for loading states.");

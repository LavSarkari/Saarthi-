import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const helpTopicCode = `
  private async showHelpTopic(chatId: number, topic: string, editMessageId: number) {
    let text = "";
    if (topic === "start") {
      text = \`🚀 *Getting Started*\\n\\nI'm here to help you execute your tasks smoothly.\\n\\n• **Talk to me naturally.** Say "Finished my ML essay" or "I'm overwhelmed.\\n• **Navigate with buttons.** Use the inline buttons to view tasks, check health, and get recovery plans.\\n\\nReady to begin?\`;
    } else if (topic === "features") {
      text = \`📋 *Core Capabilities*\\n\\n• **Risk Detection:** I monitor your schedule and alert you if deadlines slip.\\n• **Recovery Plans:** If things go wrong, I provide structured rescue roadmaps.\\n• **Daily Briefings:** Morning strategic briefs and evening reflections.\`;
    } else if (topic === "examples") {
      text = \`💡 *What to say*\\n\\nTry sending:\\n\\n• _"Finished DBMS Unit 3"_\\n• _"Snooze my ML project by 2 days"_\\n• _"I'm feeling overwhelmed today"_\\n• _"What should I focus on next?"_\`;
    } else if (topic === "privacy") {
      text = \`🔒 *Privacy*\\n\\nYour data is safely isolated in your secure Firestore account. Your API keys are encrypted server-side and never exposed. I only notify you when requested or for critical risk alerts.\`;
    } else if (topic === "linking") {
      text = \`🔗 *Dashboard Link*\\n\\nI work in perfect sync with your Saarthi Web Dashboard. You can create tasks on the web and manage execution here.\\n\\n[Open Web Dashboard](\${this.getLiveAppUrl()})\`;
    } else if (topic === "faq") {
      text = \`❓ *FAQ*\\n\\n**Q: How do I create a task?**\\nA: Right now, task creation happens on the Web Dashboard.\\n\\n**Q: How do I turn off notifications?**\\nA: Head over to Settings.\\n\\n**Q: Who built Saarthi?**\\nA: You did, with AI Studio Build!\`;
    } else {
      text = \`No information found for this topic.\`;
    }

    const inline_keyboard = [
      [{ text: "⬅️ Back to Help", callback_data: "help_index" }, { text: "🏠 Home", callback_data: "menu_home" }]
    ];

    await this.editMessageText(chatId, editMessageId, text, {
      reply_markup: { inline_keyboard }
    });
  }
`;
content = content.replace(
  /private async showHelpTopic\(chatId: number, topic: string, editMessageId: number\) \{[\s\S]*?reply_markup: \{ inline_keyboard \}\n\s*\}\);\n\s*\}/,
  helpTopicCode
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log("TypeScript file updated for Help Topics.");

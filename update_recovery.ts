import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const snoozeText = `
      const text = \`🎉 *Snoozed!*\\n\\n• Task: *\${task.title}*\\n• New Deadline: *\${currentDeadline.toLocaleDateString()}*\\n• Health: *\${risk.zone.toUpperCase()}* (\${Math.round(risk.completionConfidence)}%)\`;
`;
content = content.replace(
  /const text = `🎉 \*Deadline Snoozed Successfully![\s\S]*?Risk Zone: \*\$\{risk\.zone\.toUpperCase\(\)\}\*`;/,
  snoozeText
);


content = content.replace(
  /await this\.editMessageText\(chatId, editMessageId, "🛟 \*Formulating tactical AI Recovery strategy\.\.\. Please wait\.\*"\);/,
  `await this.editMessageText(chatId, editMessageId, "🛟 _Generating recovery strategy..._");\n      await this.sendChatAction(chatId, "typing");`
);

content = content.replace(
  /let text = `━━━━━━ 🛟 \*RECOVERY PLAN\* ━━━━━━\\n`;\n\s*text \+= `🎯 \*Task:\* \$\{task\.title\.toUpperCase\(\)\}\\n\\n`;\n\s*text \+= `⚠️ \*Situation Diagnosis:\*\\n_\$\{plan\.situationSummary\}_\\n\\n`;\n\s*text \+= `🎯 \*Motivational Priority:\*\\n\*\$\{plan\.messageToUser\}\*\\n\\n`;/,
  `let text = \`🛟 *Recovery Plan: \${task.title}*\\n\\n\`;
      text += \`_\${plan.situationSummary}_\\n\\n\`;
      text += \`*\${plan.messageToUser}*\\n\\n\`;`
);


fs.writeFileSync(filePath, content, 'utf-8');
console.log("TypeScript file updated for snooze & recovery formatting.");

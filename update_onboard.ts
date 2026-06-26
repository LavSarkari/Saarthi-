import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const onboardCode = `
  private async handleOnboardingCallback(chatId: number, messageId: number, data: string, callbackId: string) {
    const appUrl = this.getLiveAppUrl();
    await this.answerCallbackQuery(callbackId);

    if (data === "onboard_slide_0") {
      const text = \`✨ *Welcome.*\\n\\nI'm Saarthi, your personal execution companion.\\n\\nI help you track milestones, protect your time, and rescue slipping deadlines.\`;
      await this.editMessageText(chatId, messageId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Connect Account ➔", callback_data: "onboard_slide_1" }]
          ]
        }
      });
    } else if (data === "onboard_slide_1") {
      const text = \`🔑 *Link your account*\\n\\n1. Open your [Saarthi Dashboard](\${appUrl})\\n2. Go to **Settings** > **Telegram**\\n3. Send your linking code here:\\n\\n\`/link 123456\`\`;
      await this.editMessageText(chatId, messageId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⬅️ Back", callback_data: "onboard_slide_0" }]
          ]
        }
      });
    }
  }
`;
content = content.replace(
  /private async handleOnboardingCallback\(chatId: number, messageId: number, data: string, callbackId: string\) \{[\s\S]*?\}\n\s*\}/,
  onboardCode
);

const welcomeFlowCode = `
        } else {
          // Launch interactive premium onboarding flow
          const welcomeText = \`✨ *Welcome.*\\n\\nI'm Saarthi, your personal execution companion.\\n\\nI help you track milestones, protect your time, and rescue slipping deadlines.\`;
          await this.sendMessage(chatId, welcomeText, {
            reply_markup: {
              inline_keyboard: [
                [{ text: "Connect Account ➔", callback_data: "onboard_slide_1" }]
              ]
            }
          });
        }
`;
content = content.replace(
  /\}\ else \{\n\s*\/\/ Launch interactive premium onboarding flow[\s\S]*?\}\n\s*\}/,
  welcomeFlowCode
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log("TypeScript file updated for onboarding.");

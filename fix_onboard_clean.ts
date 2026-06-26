import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\\n');

let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('private async handleOnboardingCallback(')) {
    startIdx = i;
  }
  if (lines[i].includes('Verify generated link code and link Telegram Chat ID')) {
    endIdx = i - 1; // The line before /**
    break;
  }
}

if (startIdx !== -1 && endIdx !== -1) {
    const newFnLines = [
        "  private async handleOnboardingCallback(chatId: number, messageId: number, data: string, callbackId: string) {",
        "    const appUrl = this.getLiveAppUrl();",
        "    await this.answerCallbackQuery(callbackId);",
        "",
        "    if (data === 'onboard_slide_0') {",
        "      const text = '\\u2728 *Welcome.*\\n\\nI\\'m Saarthi, your personal execution companion.\\n\\nI help you track milestones, protect your time, and rescue slipping deadlines.';",
        "      await this.editMessageText(chatId, messageId, text, {",
        "        reply_markup: {",
        "          inline_keyboard: [",
        "            [{ text: 'Connect Account \\u2794', callback_data: 'onboard_slide_1' }]",
        "          ]",
        "        }",
        "      });",
        "    } else if (data === 'onboard_slide_1') {",
        "      const text = '\\ud83d\\udd11 *Link your account*\\n\\n1. Open your [Saarthi Dashboard](' + appUrl + ')\\n2. Go to **Settings** > **Telegram**\\n3. Send your linking code here:\\n\\n' + '\\`/link 123456\\`';",
        "      await this.editMessageText(chatId, messageId, text, {",
        "        reply_markup: {",
        "          inline_keyboard: [",
        "            [{ text: '\\u2b05\\ufe0f Back', callback_data: 'onboard_slide_0' }]",
        "          ]",
        "        }",
        "      });",
        "    }",
        "  }"
    ];

    const before = lines.slice(0, startIdx);
    const after = lines.slice(endIdx);
    
    const finalLines = [...before, ...newFnLines, ...after];
    fs.writeFileSync(filePath, finalLines.join('\\n'), 'utf-8');
    console.log("Onboarding finally fixed perfectly");
}

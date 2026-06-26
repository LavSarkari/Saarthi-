import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const startStr = "private async handleOnboardingCallback(chatId: number, messageId: number, data: string, callbackId: string) {";
const endStr = "  /**\\n   * Verify generated link code and link Telegram Chat ID";

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr);

const newFn = "  private async handleOnboardingCallback(chatId: number, messageId: number, data: string, callbackId: string) {\\n" +
"    const appUrl = this.getLiveAppUrl();\\n" +
"    await this.answerCallbackQuery(callbackId);\\n\\n" +
"    if (data === 'onboard_slide_0') {\\n" +
"      const text = '\\u2728 *Welcome.*\\n\\nI\\'m Saarthi, your personal execution companion.\\n\\nI help you track milestones, protect your time, and rescue slipping deadlines.';\\n" +
"      await this.editMessageText(chatId, messageId, text, {\\n" +
"        reply_markup: {\\n" +
"          inline_keyboard: [\\n" +
"            [{ text: 'Connect Account \\u2794', callback_data: 'onboard_slide_1' }]\\n" +
"          ]\\n" +
"        }\\n" +
"      });\\n" +
"    } else if (data === 'onboard_slide_1') {\\n" +
"      const text = '\\ud83d\\udd11 *Link your account*\\n\\n1. Open your [Saarthi Dashboard](' + appUrl + ')\\n2. Go to **Settings** > **Telegram**\\n3. Send your linking code here:\\n\\n' + '\\`/link 123456\\`';\\n" +
"      await this.editMessageText(chatId, messageId, text, {\\n" +
"        reply_markup: {\\n" +
"          inline_keyboard: [\\n" +
"            [{ text: '\\u2b05\\ufe0f Back', callback_data: 'onboard_slide_0' }]\\n" +
"          ]\\n" +
"        }\\n" +
"      });\\n" +
"    }\\n" +
"  }\\n\\n";

const newContent = content.substring(0, startIdx) + newFn + content.substring(endIdx);
fs.writeFileSync(filePath, newContent, 'utf-8');
console.log("Rewritten using simple concat");

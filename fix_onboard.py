import os
import re

file_path = "src/services/telegramService.ts"
with open(file_path, "r") as f:
    content = f.read()

# I will find the start and end of handleOnboardingCallback
start_str = "private async handleOnboardingCallback(chatId: number, messageId: number, data: string, callbackId: string) {"
end_str = "  /**\n   * Verify generated link code and link Telegram Chat ID"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

new_fn = """  private async handleOnboardingCallback(chatId: number, messageId: number, data: string, callbackId: string) {
    const appUrl = this.getLiveAppUrl();
    await this.answerCallbackQuery(callbackId);

    if (data === "onboard_slide_0") {
      const text = `✨ *Welcome.*\\n\\nI'm Saarthi, your personal execution companion.\\n\\nI help you track milestones, protect your time, and rescue slipping deadlines.`;
      await this.editMessageText(chatId, messageId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Connect Account ➔", callback_data: "onboard_slide_1" }]
          ]
        }
      });
    } else if (data === "onboard_slide_1") {
      const text = `🔑 *Link your account*\\n\\n1. Open your [Saarthi Dashboard](${appUrl})\\n2. Go to **Settings** > **Telegram**\\n3. Send your linking code here:\\n\\n\\`/link 123456\\``;
      await this.editMessageText(chatId, messageId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⬅️ Back", callback_data: "onboard_slide_0" }]
          ]
        }
      });
    }
  }

"""

new_content = content[:start_idx] + new_fn + content[end_idx:]

with open(file_path, "w") as f:
    f.write(new_content)

print("Rewritten using Python")

import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const lines = content.split('\\n');

let newLines = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('await this.sendMessage(chatId, \`💛 Happens to everyone.')) {
    skip = true;
    newLines.push('      await this.sendMessage(chatId, `💛 Happens to everyone.\\n\\nWhere are you stuck?`, { reply_markup: { inline_keyboard } });');
    newLines.push('      return;');
    newLines.push('    }');
    newLines.push('');
    newLines.push('    await this.handleExecutionUpdate(chatId, userId, text);');
    newLines.push('    }');
    newLines.push('  }');
  }
  
  if (skip) {
    if (lines[i].includes('private async verifyAndLinkAccount(')) {
      skip = false;
      newLines.push('  /**');
      newLines.push('   * Verify generated link code and link Telegram Chat ID');
      newLines.push('   */');
      newLines.push(lines[i]);
    }
  } else {
    newLines.push(lines[i]);
  }
}

fs.writeFileSync(filePath, newLines.join('\\n'), 'utf-8');
console.log("Fixed corrupted handleUpdate");

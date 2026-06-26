import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
const content = fs.readFileSync(filePath, 'utf-8');
const insertCode = fs.readFileSync('insert.txt', 'utf-8');

const lines = content.split('\\n');
let newLines = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Verify generated link code')) {
    newLines.push(insertCode);
  }
  newLines.push(lines[i]);
}

fs.writeFileSync(filePath, newLines.join('\\n'), 'utf-8');
console.log("Restored missing methods from text file");

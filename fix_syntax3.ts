import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// I will split by line and fix the specific block around 414-424
const lines = content.split('\\n');

let startIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('// Launch interactive premium onboarding flow')) {
    startIdx = i;
    break;
  }
}

if (startIdx !== -1) {
    // we want to find the stray ");" and remove it.
    for(let i=startIdx; i<startIdx+20; i++) {
        if (lines[i] && lines[i].trim() === ');') {
            lines[i] = ''; // blank it out
        }
    }
}

content = lines.join('\\n');
fs.writeFileSync(filePath, content, 'utf-8');
console.log("Stray ); removed");

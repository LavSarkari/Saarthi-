const fs = require('fs');
const content = fs.readFileSync('src/services/telegramService.ts', 'utf-8');
const lines = content.split('\\n');
const line = lines[1047]; // line 1048
console.log("Line 1048:");
console.log(line);
console.log("Char at 87:", line[87]);
console.log("Char at 86-90:", line.substring(86, 91));

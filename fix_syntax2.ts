import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

content = content.replace(
  /          \}\);\n        \}\n\);\n        \}\n        return;\n      \}/,
  '          });\\n        }\\n        return;\\n      }'
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log("Syntax fix applied 2");

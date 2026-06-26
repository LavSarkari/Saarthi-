import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// Replace literal "\n" strings with actual newlines
content = content.replace(/\\}\);\w*\\n\w*\\}\w*\\n\w*return;\w*\\n\w*\\}/g, "});\n        }\n        return;\n      }");
// To be safe, just replace the exact known string:
content = content.replace("          });\\n        }\\n        return;\\n      }", "          });\n        }\n        return;\n      }");

fs.writeFileSync(filePath, content, 'utf-8');
console.log("Newline fix applied");

import fs from 'fs';

const filePath = 'src/services/telegramService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const importStr = 'import { mockFirestore, MockFieldValue } from "./localDb.js";';
const firstImport = content.indexOf(importStr);
const secondImport = content.indexOf(importStr, firstImport + 1);

if (secondImport !== -1) {
    const originalFile = content.substring(secondImport);
    fs.writeFileSync(filePath, originalFile, 'utf-8');
    console.log("Restored original file from duplicated content");
} else {
    console.log("Could not find duplicated import");
}

const fs = require('fs');

const content = fs.readFileSync('frontend/src/data/evidenceDatasets.ts', 'utf8');

const regex = /{\s*id:\s*"([^"]+)",[\s\S]*?name:\s*"([^"]+)",[\s\S]*?category:\s*"([^"]+)",[\s\S]*?coverageScope:\s*"([^"]+)",[\s\S]*?available:\s*(true|false),[\s\S]*?integrationStatus:\s*"([^"]+)",/g;

let match;
let count = 0;
while ((match = regex.exec(content)) !== null) {
  count++;
  console.log(`${count}. ID: ${match[1].padEnd(28)} | Category: ${match[3].padEnd(22)} | Scope: ${match[4].padEnd(12)} | Status: ${match[6].padEnd(25)} | Name: ${match[2]}`);
}
console.log(`\nTotal matched: ${count}`);

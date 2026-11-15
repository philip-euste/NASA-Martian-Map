const fs = require('fs');

const content = fs.readFileSync('frontend/src/data/evidenceDatasets.ts', 'utf8');

const regex = /{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*integrationStatus:\s*"([^"]+)",\s*coverageScope:\s*"([^"]+)"/g;

let match;
const datasets = [];
while ((match = regex.exec(content)) !== null) {
  datasets.push({
    id: match[1],
    name: match[2],
    category: match[3],
    status: match[4],
    scope: match[5]
  });
}

console.log(`Found ${datasets.length} evidence datasets:\n`);
datasets.forEach(d => {
  console.log(`${d.id.padEnd(25)} | ${d.category.padEnd(22)} | ${d.status.padEnd(26)} | ${d.scope.padEnd(14)} | ${d.name}`);
});

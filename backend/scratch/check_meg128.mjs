import fs from 'node:fs';

const url = 'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/';
const res = await fetch(url);
const text = await res.text();
const regex = /HREF="([^"]+)"/gi;
const links = [];
let match;
while ((match = regex.exec(text)) !== null) {
  links.push(match[1]);
}
console.log('Total files:', links.length);
console.log('Sample links:', links.slice(0, 40));

const megtFiles = links.filter(l => l.includes('megt') && l.endsWith('.lbl'));
console.log('All megt LBL files:');
for (const f of megtFiles) {
  console.log(f.split('/').pop());
}

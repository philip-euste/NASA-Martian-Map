// backend/scratch/test_mola_extract.mjs
import fs from 'node:fs';

const url = 'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg128/megt00n090hb.img';
// Gale: rows 560 to 760 -> bytes 12902400 to 17533439
const startByte = 560 * 11520 * 2;
const endByte = (761 * 11520 * 2) - 1;

console.log(`Downloading Gale byte range: ${startByte} - ${endByte} (${((endByte - startByte) / 1024 / 1024).toFixed(2)} MB)...`);

const res = await fetch(url, {
  headers: {
    'Range': `bytes=${startByte}-${endByte}`
  }
});

if (!res.ok && res.status !== 206) {
  throw new Error(`HTTP ${res.status}`);
}

const buf = Buffer.from(await res.arrayBuffer());
console.log(`Downloaded ${buf.length} bytes.`);

// Check elevation at center of Gale Crater (Mount Sharp):
// Lat -5.37, Lon 137.81
// row = Math.round(5.37 * 128) = 687. Offset row in downloaded chunk = 687 - 560 = 127
// col = Math.round((137.81 - 90.0) * 128) = 6120
const rowOffset = Math.round(5.37 * 128) - 560;
const col = Math.round((137.81 - 90.0) * 128);
const sampleOffset = (rowOffset * 11520 + col) * 2;
const elevationM = buf.readInt16BE(sampleOffset);
console.log(`Elevation at Gale Crater center (Mount Sharp, -5.37°, 137.81°E): ${elevationM} meters`);

// Check min and max in Gale box (rows 563 to 755, cols 6003 to 6221)
let minElev = Infinity;
let maxElev = -Infinity;
for (let r = 563 - 560; r <= 755 - 560; r++) {
  for (let c = 6003; c <= 6221; c++) {
    const elev = buf.readInt16BE((r * 11520 + c) * 2);
    if (elev < minElev) minElev = elev;
    if (elev > maxElev) maxElev = elev;
  }
}
console.log(`Gale Crater elevation range: min ${minElev} m, max ${maxElev} m (relief: ${maxElev - minElev} m)`);

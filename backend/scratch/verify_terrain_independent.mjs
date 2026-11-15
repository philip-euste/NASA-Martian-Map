// backend/scratch/verify_terrain_independent.mjs
// Independent validation of MOLA raw binary extraction vs generated tiles

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SCRATCH_DIR = path.join(ROOT, 'backend/scratch');
const PUBLIC_DIR = path.join(ROOT, 'frontend/public');

console.log("===============================================================================");
console.log("INDEPENDENT SCIENTIFIC AUDIT: RAW MOLA BINARY VS GENERATED TILES");
console.log("===============================================================================\n");

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`PASS: ${msg}`);
    passed++;
  } else {
    console.error(`FAIL: ${msg}`);
    failed++;
  }
}

// 1. Verify Raw Binary Chunks
const CHECKS = [
  {
    id: "gale",
    name: "Gale Crater (Mount Sharp)",
    binFile: "gale_mola.bin",
    expectedBytes: 4631040,
    startRow: 560,
    isNorth: false,
    westLonOrigin: 90.0,
    // Test points: Bradbury Landing (~ -4.5895, 137.4417) and Mount Sharp Peak (~ -5.08, 137.85)
    testPoints: [
      { name: "Bradbury Landing", lat: -4.5895, lon: 137.4417, expElevRange: [-4550, -4350] },
      { name: "Mount Sharp Slope/Peak", lat: -5.08, lon: 137.85, expElevRange: [-500, 850] },
    ]
  },
  {
    id: "valles",
    name: "Valles Marineris (Melas Chasma)",
    binFile: "valles_mola.bin",
    expectedBytes: 10621440,
    startRow: 1020,
    isNorth: false,
    westLonOrigin: 270.0,
    // Test points: Melas Canyon Floor (~ -9.80, 283.60) and North Rim Scarp (~ -8.45, 283.20)
    testPoints: [
      { name: "Melas Chasma Central Floor", lat: -9.80, lon: 283.60, expElevRange: [-2500, -1500] },
      { name: "North Chasma Wall Intermediate Scarp", lat: -8.45, lon: 283.20, expElevRange: [-3500, -2500] },
    ]
  },
  {
    id: "olympus",
    name: "Olympus Mons (Summit Caldera)",
    binFile: "olympus_mola.bin",
    expectedBytes: 9815040,
    startRow: 3040,
    isNorth: true,
    westLonOrigin: 180.0,
    // Test points: Caldera Floor (~ 18.65, 226.20) and South Rim Peak (~ 18.15, 226.10)
    testPoints: [
      { name: "Caldera Central Floor", lat: 18.65, lon: 226.20, expElevRange: [19000, 20500] },
      { name: "South Rim Peak", lat: 18.15, lon: 226.10, expElevRange: [20000, 21300] },
    ]
  }
];

for (const check of CHECKS) {
  console.log(`--- Checking ${check.name} ---`);
  const binPath = path.join(SCRATCH_DIR, check.binFile);
  assert(fs.existsSync(binPath), `Raw MOLA chunk file exists: ${check.binFile}`);
  const stat = fs.statSync(binPath);
  assert(stat.size === check.expectedBytes, `Raw binary size is exact (${stat.size} == ${check.expectedBytes} bytes)`);

  const buf = fs.readFileSync(binPath);
  const manifestPath = path.join(PUBLIC_DIR, check.id, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Independent direct pixel lookup in raw big-endian MOLA chunk
  for (const tp of check.testPoints) {
    const rowInTile = check.isNorth ? (44.0 - tp.lat) * 128 : (0.0 - tp.lat) * 128;
    const colInTile = (tp.lon - check.westLonOrigin) * 128;
    const r = Math.round(rowInTile);
    const c = Math.round(colInTile);
    const rOff = r - check.startRow;
    const byteOffset = (rOff * 11520 + c) * 2;
    const rawElev = buf.readInt16BE(byteOffset);

    assert(
      rawElev >= tp.expElevRange[0] && rawElev <= tp.expElevRange[1],
      `${tp.name} raw MOLA sample at row ${r}, col ${c} = ${rawElev} m (within expected [${tp.expElevRange[0]} .. ${tp.expElevRange[1]}] m)`
    );

    // Now compare with decoded elevation in the generated 3D tiles!
    // Determine which tile (tx, ty) this point falls into:
    const gridR = ((manifest.proj.northLatDeg - tp.lat) / (manifest.proj.northLatDeg - manifest.proj.southLatDeg)) * 512;
    const gridC = ((tp.lon - manifest.proj.westLonDeg) / (manifest.proj.eastLonDeg - manifest.proj.westLonDeg)) * 512;
    const tx = Math.min(1, Math.floor(gridC / 256));
    const ty = Math.min(1, Math.floor(gridR / 256));
    const localR = Math.round(gridR - ty * 256);
    const localC = Math.round(gridC - tx * 256);

    const tilePath = path.join(PUBLIC_DIR, check.id, "height", `${tx}_${ty}.u16`);
    assert(fs.existsSync(tilePath), `Height tile exists: ${check.id}/height/${tx}_${ty}.u16`);
    const tileBuf = fs.readFileSync(tilePath);
    const tileU16 = new Uint16Array(tileBuf.buffer, tileBuf.byteOffset, tileBuf.byteLength / 2);
    const qVal = tileU16[localR * 257 + localC];
    const tileElev = manifest.heightMin + qVal * manifest.heightScale;

    const diff = Math.abs(tileElev - rawElev);
    assert(
      diff < 15.0,
      `${tp.name} generated tile decoded elevation (${tileElev.toFixed(1)} m) matches raw MOLA sample (${rawElev} m) within bilinear/quantization tolerance (diff = ${diff.toFixed(2)} m)`
    );
  }
}

// 2. Comprehensive Tile Completeness Audit
console.log("\n--- Comprehensive Tile Grid Verification (All Tiles for Gale, Valles, Olympus, Jezero) ---");
const ALL_REGIONS = ["gale", "valles", "olympus", "jezero"];
for (const regId of ALL_REGIONS) {
  const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, regId, "manifest.json"), 'utf8'));
  const tilesX = manifest.tilesX;
  const tilesY = manifest.tilesY;
  let totalHeightTiles = 0;
  let totalTexTiles = 0;

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const hPath = path.join(PUBLIC_DIR, regId, "height", `${tx}_${ty}.u16`);
      if (fs.existsSync(hPath) && fs.statSync(hPath).size === 132098) {
        totalHeightTiles++;
      }
      const tPath = path.join(PUBLIC_DIR, regId, "tex", `${tx}_${ty}.jpg`);
      if (fs.existsSync(tPath) && fs.statSync(tPath).size > 1000) {
        totalTexTiles++;
      }
    }
  }

  const expectedTiles = tilesX * tilesY;
  assert(
    totalHeightTiles === expectedTiles,
    `${regId.toUpperCase()}: All ${expectedTiles} height tiles exist with exact 132,098 bytes (found ${totalHeightTiles})`
  );
  assert(
    totalTexTiles === expectedTiles,
    `${regId.toUpperCase()}: All ${expectedTiles} texture tiles exist with valid non-zero JPEG sizes (found ${totalTexTiles})`
  );
}

console.log("\n===============================================================================");
console.log(`INDEPENDENT AUDIT: ${passed} PASSED, ${failed} FAILED`);
console.log("===============================================================================");

if (failed > 0) process.exit(1);

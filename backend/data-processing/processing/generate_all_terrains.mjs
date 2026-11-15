// backend/data-processing/processing/generate_all_terrains.mjs
// Phase 3.0 Emergency Sprint: Generate authentic 3D terrain elevation pyramids and textures
// for Gale Crater, Valles Marineris, and Olympus Mons from authentic NASA PDS MOLA 128 ppd data.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jpeg from '../../../frontend/node_modules/jpeg-js/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const SCRATCH_DIR = path.join(PROJECT_ROOT, 'backend/scratch');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'frontend/public');

const MARS_RADIUS = 3396190; // IAU 2000 Mars sphere radius in meters

const REGIONS = [
  {
    id: 'gale',
    name: 'Gale Crater (Mount Sharp)',
    chunkFile: 'gale_mola.bin',
    sourceDataset: 'MGS MOLA 128 ppd Topography (MEGT00N090HB.IMG)',
    credit: 'NASA / PDS Geosciences Node / MGS MOLA Science Team (Smith et al., 2003)',
    chunkStartRow: 560,
    isNorth: false,
    westLonOrigin: 90.0,
    bounds: {
      northLat: -4.40,
      southLat: -5.90,
      westLon: 136.90,
      eastLon: 138.60,
    },
    centerLat: -5.37,
    tint: { r: 228, g: 158, b: 118 }, // Warm ochre sedimentary sandstone
  },
  {
    id: 'valles',
    name: 'Valles Marineris (Melas Chasma)',
    chunkFile: 'valles_mola.bin',
    sourceDataset: 'MGS MOLA 128 ppd Topography (MEGT00N270HB.IMG)',
    credit: 'NASA / PDS Geosciences Node / MGS MOLA Science Team (Smith et al., 2003)',
    chunkStartRow: 1020,
    isNorth: false,
    westLonOrigin: 270.0,
    bounds: {
      northLat: -8.00,
      southLat: -11.50,
      westLon: 281.50, // -78.50°W
      eastLon: 285.80, // -74.20°W
    },
    centerLat: -9.80,
    tint: { r: 200, g: 125, b: 90 }, // Deep canyon rift basalt & wall strata
  },
  {
    id: 'olympus',
    name: 'Olympus Mons (Summit Caldera)',
    chunkFile: 'olympus_mola.bin',
    sourceDataset: 'MGS MOLA 128 ppd Topography (MEGT44N180HB.IMG)',
    credit: 'NASA / PDS Geosciences Node / MGS MOLA Science Team (Smith et al., 2003)',
    chunkStartRow: 3040,
    isNorth: true,
    westLonOrigin: 180.0,
    bounds: {
      northLat: 20.20,
      southLat: 17.00,
      westLon: 224.50, // -135.50°W
      eastLon: 228.00, // -132.00°W
    },
    centerLat: 18.65,
    tint: { r: 175, g: 130, b: 105 }, // Volcanic caldera basalt / tholoid lava
  }
];

function sampleMolaChunk(buf, startRow, isNorth, westLonOrigin, lat, lon) {
  const rowInTile = isNorth ? (44.0 - lat) * 128 : (0.0 - lat) * 128;
  const colInTile = (lon - westLonOrigin) * 128;

  const r0 = Math.floor(rowInTile);
  const c0 = Math.floor(colInTile);
  const r1 = r0 + 1;
  const c1 = c0 + 1;

  const fr = rowInTile - r0;
  const fc = colInTile - c0;

  function getPixel(r, c) {
    const rOff = r - startRow;
    const maxRows = Math.floor(buf.length / (11520 * 2));
    if (rOff < 0 || rOff >= maxRows || c < 0 || c >= 11520) return 0;
    return buf.readInt16BE((rOff * 11520 + c) * 2);
  }

  const p00 = getPixel(r0, c0);
  const p10 = getPixel(r0, c1);
  const p01 = getPixel(r1, c0);
  const p11 = getPixel(r1, c1);

  const top = p00 + (p10 - p00) * fc;
  const bot = p01 + (p11 - p01) * fc;
  return top + (bot - top) * fr;
}

function computeHillshade(elevGrid, width, height, cellX, cellZ, tint) {
  const sunDir = [-0.6, 0.55, -0.4];
  const sunLen = Math.hypot(...sunDir);
  const sx = sunDir[0] / sunLen;
  const sy = sunDir[1] / sunLen;
  const sz = sunDir[2] / sunLen;

  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      const xL = Math.max(0, x - 1);
      const xR = Math.min(width - 1, x + 1);
      const yU = Math.max(0, y - 1);
      const yD = Math.min(height - 1, y + 1);

      const dzdx = (elevGrid[y * width + xR] - elevGrid[y * width + xL]) / ((xR - xL) * cellX);
      const dzdy = (elevGrid[yD * width + x] - elevGrid[yU * width + x]) / ((yD - yU) * cellZ);

      // Normal vector (-dzdx, 1, -dzdy)
      const nx = -dzdx;
      const ny = 1.0;
      const nz = -dzdy;
      const nLen = Math.hypot(nx, ny, nz);

      const dot = Math.max(0.12, (nx * sx + ny * sy + nz * sz) / nLen);

      // Apply ambient + diffuse + tint
      const r = Math.min(255, Math.max(10, Math.round(tint.r * dot * 1.15)));
      const g = Math.min(255, Math.max(10, Math.round(tint.g * dot * 1.15)));
      const b = Math.min(255, Math.max(10, Math.round(tint.b * dot * 1.15)));

      const outIdx = (y * width + x) * 4;
      rgba[outIdx] = r;
      rgba[outIdx + 1] = g;
      rgba[outIdx + 2] = b;
      rgba[outIdx + 3] = 255;
    }
  }

  return rgba;
}

async function processRegion(region) {
  console.log(`\n======================================================`);
  console.log(`Processing Authentic 3D Terrain for ${region.name}...`);
  console.log(`======================================================`);

  const chunkPath = path.join(SCRATCH_DIR, region.chunkFile);
  if (!fs.existsSync(chunkPath)) {
    throw new Error(`Chunk file not found: ${chunkPath}`);
  }
  const chunkBuf = fs.readFileSync(chunkPath);
  console.log(`Loaded ${chunkBuf.length} bytes from ${region.chunkFile}`);

  const outDir = path.join(PUBLIC_DIR, region.id);
  const heightDir = path.join(outDir, 'height');
  const texDir = path.join(outDir, 'tex');

  fs.mkdirSync(heightDir, { recursive: true });
  fs.mkdirSync(texDir, { recursive: true });

  const GRID_SIZE = 513; // 2 tiles x 256 cells + 1 shared edge
  const TILE_SIZE = 256;
  const TILES_X = 2;
  const TILES_Y = 2;
  const OVERVIEW_STEP = 2;
  const OVR_COLS = 257;
  const OVR_ROWS = 257;

  const latCenter = region.centerLat;
  const cellX = ((region.bounds.eastLon - region.bounds.westLon) * (Math.PI / 180) * MARS_RADIUS * Math.cos(latCenter * (Math.PI / 180))) / (GRID_SIZE - 1);
  const cellZ = ((region.bounds.northLat - region.bounds.southLat) * (Math.PI / 180) * MARS_RADIUS) / (GRID_SIZE - 1);

  console.log(`Dimensions: ${GRID_SIZE} x ${GRID_SIZE} cells. Cell size: ${cellX.toFixed(1)} m x ${cellZ.toFixed(1)} m.`);

  // Sample elevation grid
  const elevGrid = new Float32Array(GRID_SIZE * GRID_SIZE);
  let minElev = Infinity;
  let maxElev = -Infinity;

  for (let r = 0; r < GRID_SIZE; r++) {
    const lat = region.bounds.northLat - (r / (GRID_SIZE - 1)) * (region.bounds.northLat - region.bounds.southLat);
    for (let c = 0; c < GRID_SIZE; c++) {
      const lon = region.bounds.westLon + (c / (GRID_SIZE - 1)) * (region.bounds.eastLon - region.bounds.westLon);
      const elev = sampleMolaChunk(chunkBuf, region.chunkStartRow, region.isNorth, region.westLonOrigin, lat, lon);
      elevGrid[r * GRID_SIZE + c] = elev;
      if (elev < minElev) minElev = elev;
      if (elev > maxElev) maxElev = elev;
    }
  }

  const heightMin = Number(minElev.toFixed(2));
  const heightMax = Number(maxElev.toFixed(2));
  const heightScale = Number(((heightMax - heightMin) / 65535).toFixed(6));

  console.log(`Elevation range: ${heightMin} m to ${heightMax} m (relief: ${(heightMax - heightMin).toFixed(1)} m). Scale: ${heightScale}`);

  // 1. Write overview.u16
  const overviewU16 = new Uint16Array(OVR_COLS * OVR_ROWS);
  for (let r = 0; r < OVR_ROWS; r++) {
    for (let c = 0; c < OVR_COLS; c++) {
      const srcR = r * OVERVIEW_STEP;
      const srcC = c * OVERVIEW_STEP;
      const elev = elevGrid[srcR * GRID_SIZE + srcC];
      const q = Math.min(65535, Math.max(0, Math.round((elev - heightMin) / heightScale)));
      overviewU16[r * OVR_COLS + c] = q;
    }
  }
  fs.writeFileSync(path.join(outDir, 'overview.u16'), Buffer.from(overviewU16.buffer));
  console.log(`Wrote overview.u16 (${overviewU16.byteLength} bytes)`);

  // 2. Write height tiles (2x2)
  for (let ty = 0; ty < TILES_Y; ty++) {
    for (let tx = 0; tx < TILES_X; tx++) {
      const tileU16 = new Uint16Array((TILE_SIZE + 1) * (TILE_SIZE + 1));
      for (let r = 0; r <= TILE_SIZE; r++) {
        for (let c = 0; c <= TILE_SIZE; c++) {
          const srcR = ty * TILE_SIZE + r;
          const srcC = tx * TILE_SIZE + c;
          const elev = elevGrid[srcR * GRID_SIZE + srcC];
          const q = Math.min(65535, Math.max(0, Math.round((elev - heightMin) / heightScale)));
          tileU16[r * (TILE_SIZE + 1) + c] = q;
        }
      }
      fs.writeFileSync(path.join(heightDir, `${tx}_${ty}.u16`), Buffer.from(tileU16.buffer));
    }
  }
  console.log(`Wrote 4 full-resolution height tiles in ${heightDir}`);

  // 3. Generate authentic hillshade orthophoto & textures
  console.log(`Generating authentic hillshaded orthophoto textures...`);
  const fullRgba = computeHillshade(elevGrid, GRID_SIZE, GRID_SIZE, cellX, cellZ, region.tint);

  // Overview JPEG
  const ovrJpeg = jpeg.encode({ data: fullRgba, width: GRID_SIZE, height: GRID_SIZE }, 85);
  fs.writeFileSync(path.join(outDir, 'overview.jpg'), ovrJpeg.data);
  console.log(`Wrote overview.jpg (${(ovrJpeg.data.length / 1024).toFixed(1)} KB)`);

  // Tile textures (256x256 or 512x512)
  const TEX_SIZE = 256;
  for (let ty = 0; ty < TILES_Y; ty++) {
    for (let tx = 0; tx < TILES_X; tx++) {
      const tileRgba = Buffer.alloc(TEX_SIZE * TEX_SIZE * 4);
      for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
          const srcX = Math.round(tx * TILE_SIZE + (x / TEX_SIZE) * TILE_SIZE);
          const srcY = Math.round(ty * TILE_SIZE + (y / TEX_SIZE) * TILE_SIZE);
          const srcIdx = (srcY * GRID_SIZE + srcX) * 4;
          const dstIdx = (y * TEX_SIZE + x) * 4;

          tileRgba[dstIdx] = fullRgba[srcIdx];
          tileRgba[dstIdx + 1] = fullRgba[srcIdx + 1];
          tileRgba[dstIdx + 2] = fullRgba[srcIdx + 2];
          tileRgba[dstIdx + 3] = fullRgba[srcIdx + 3];
        }
      }
      const tileJpeg = jpeg.encode({ data: tileRgba, width: TEX_SIZE, height: TEX_SIZE }, 85);
      fs.writeFileSync(path.join(texDir, `${tx}_${ty}.jpg`), tileJpeg.data);
    }
  }
  console.log(`Wrote 4 authentic surface texture tiles in ${texDir}`);

  // 4. Write manifest.json
  const manifest = {
    name: region.name,
    source: {
      dem: region.sourceDataset,
      ortho: "MOLA Derived Topographic Photometric Hillshade (Not Optical Imagery)",
      credit: region.credit
    },
    cols: GRID_SIZE,
    rows: GRID_SIZE,
    tileSize: TILE_SIZE,
    tilesX: TILES_X,
    tilesY: TILES_Y,
    cellX: Number(cellX.toFixed(2)),
    cellZ: Number(cellZ.toFixed(2)),
    heightMin,
    heightMax,
    heightScale,
    overview: {
      step: OVERVIEW_STEP,
      cols: OVR_COLS,
      rows: OVR_ROWS
    },
    textureSize: TEX_SIZE,
    textures: "1111",
    mapImage: "overview.jpg",
    proj: {
      westLonDeg: region.bounds.westLon,
      eastLonDeg: region.bounds.eastLon,
      northLatDeg: region.bounds.northLat,
      southLatDeg: region.bounds.southLat,
      radius: MARS_RADIUS,
      latCenterDeg: latCenter
    }
  };

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Wrote manifest.json for ${region.name} at: ${path.join(outDir, 'manifest.json')}`);
}

async function run() {
  for (const reg of REGIONS) {
    await processRegion(reg);
  }
  console.log(`\n>>> All 3 Regional 3D Terrains Successfully Built! <<<`);
}

run().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});

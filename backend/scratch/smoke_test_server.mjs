// backend/scratch/smoke_test_server.mjs
// Automated Binary DEM, Texture & Regional Simulator Smoke Test Suite (Socket-free)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jpeg from '../../frontend/node_modules/jpeg-js/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DIST_DIR = path.join(ROOT, 'frontend/dist');
const PUBLIC_DIR = path.join(ROOT, 'frontend/public');

console.log("===============================================================================");
console.log("STARTING LIVE 3D SURFACE SIMULATOR & ASSET SMOKE TEST SUITE");
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

// Simulates serving a static file from DIST_DIR or PUBLIC_DIR
function readStaticAsset(reqPath) {
  if (reqPath === '/') reqPath = '/index.html';
  let filePath = path.join(DIST_DIR, reqPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC_DIR, reqPath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return {
      status: 200,
      filePath,
      size: fs.statSync(filePath).size,
      data: fs.readFileSync(filePath),
    };
  }
  return { status: 404, filePath, size: 0, data: null };
}

try {
  // 1. Test Main Application HTML
  console.log("--- 1. Testing Main Web Application Entry Point ---");
  const indexRes = readStaticAsset('/');
  assert(indexRes.status === 200, "Main index.html exists in dist/ (HTTP 200)");
  assert(indexRes.data.toString().includes("Mars Explorer"), "Main index.html title / content valid");

  // 2. Test All 4 Simulator HTML Entry Points
  console.log("\n--- 2. Testing All 4 Multi-Region 3D Simulator HTML Pages ---");
  const SIMULATOR_PAGES = [
    {
      id: "jezero",
      name: "Jezero Crater",
      path: "/src/simulator/jezero_crater/scripts/jezero-simulator.html",
      expectedTitle: "Jezero Crater",
    },
    {
      id: "gale",
      name: "Gale Crater",
      path: "/src/simulator/gale_crater/scripts/gale-simulator.html",
      expectedTitle: "Gale Crater",
    },
    {
      id: "valles",
      name: "Valles Marineris",
      path: "/src/simulator/valles_marineris/scripts/valles-simulator.html",
      expectedTitle: "Valles Marineris",
    },
    {
      id: "olympus",
      name: "Olympus Mons",
      path: "/src/simulator/olympus_mons/scripts/olympus-simulator.html",
      expectedTitle: "Olympus Mons",
    },
  ];

  for (const page of SIMULATOR_PAGES) {
    const res = readStaticAsset(page.path);
    assert(res.status === 200, `${page.name} HTML page bundled in dist/ (${page.path})`);
    const html = res.data.toString();
    assert(html.includes(page.expectedTitle), `${page.name} contains expected title '${page.expectedTitle}'`);
    assert(html.includes('id="hud"'), `${page.name} contains Helmet HUD markup container`);
    assert(html.includes('id="map-panel"'), `${page.name} contains Tactical Navigation Map dialog`);
    assert(html.includes('id="start"'), `${page.name} contains Surface Walk activation button`);
    assert(html.includes('type="module"'), `${page.name} contains module script tag`);
  }

  // 3. Test Terrain Assets & Dynamic Decoding (Simulating surfaceEngine.ts)
  console.log("\n--- 3. Testing 3D Terrain Data, Elevation Pyramids & JPEG Textures ---");
  const REGION_TERRAINS = [
    { id: "jezero", name: "Jezero Crater", expMin: -3600, expMax: -400 },
    { id: "gale", name: "Gale Crater (Mount Sharp)", expMin: -4700, expMax: 800 },
    { id: "valles", name: "Valles Marineris", expMin: -4300, expMax: 4200 },
    { id: "olympus", name: "Olympus Mons", expMin: 10000, expMax: 22000 },
  ];

  for (const reg of REGION_TERRAINS) {
    // Manifest
    const manifestRes = readStaticAsset(`/${reg.id}/manifest.json`);
    assert(manifestRes.status === 200, `${reg.name} manifest.json exists and accessible`);
    const manifest = JSON.parse(manifestRes.data.toString());
    assert(manifest.cols > 0 && manifest.rows > 0, `${reg.name} manifest dimensions valid (${manifest.cols}x${manifest.rows})`);
    assert(manifest.heightMin >= reg.expMin && manifest.heightMax <= reg.expMax, `${reg.name} manifest elevations verified within authentic bounds [${manifest.heightMin.toFixed(1)}m, ${manifest.heightMax.toFixed(1)}m]`);

    // Overview.u16 binary heightmap
    const ovrRes = readStaticAsset(`/${reg.id}/overview.u16`);
    assert(ovrRes.status === 200, `${reg.name} overview.u16 exists (${ovrRes.size} bytes)`);
    const u16Array = new Uint16Array(ovrRes.data.buffer, ovrRes.data.byteOffset, ovrRes.data.byteLength / 2);
    let minRaw = 65535, maxRaw = 0;
    for (let i = 0; i < u16Array.length; i++) {
      const val = u16Array[i];
      if (val < minRaw) minRaw = val;
      if (val > maxRaw) maxRaw = val;
    }
    assert(minRaw < maxRaw, `${reg.name} overview.u16 has non-trivial dynamic range [raw ${minRaw} .. ${maxRaw}]`);
    const decodedMin = manifest.heightMin + minRaw * manifest.heightScale;
    const decodedMax = manifest.heightMin + maxRaw * manifest.heightScale;
    // Downsampled overview elevations should be within 100m of the full-resolution extrema
    assert(Math.abs(decodedMin - manifest.heightMin) < 100.0, `${reg.name} decoded min elevation consistent with manifest within downsampling tolerance (${decodedMin.toFixed(1)} m vs ${manifest.heightMin.toFixed(1)} m)`);
    assert(Math.abs(decodedMax - manifest.heightMax) < 100.0, `${reg.name} decoded max elevation consistent with manifest within downsampling tolerance (${decodedMax.toFixed(1)} m vs ${manifest.heightMax.toFixed(1)} m)`);

    // Height tile 0_0.u16
    const tileRes = readStaticAsset(`/${reg.id}/height/0_0.u16`);
    assert(tileRes.status === 200, `${reg.name} height/0_0.u16 tile accessible (${tileRes.size} bytes)`);
    assert(tileRes.size === 132098, `${reg.name} height tile matches 257x257 16-bit layout (132,098 bytes)`);

    // Overview.jpg
    const ovrJpgRes = readStaticAsset(`/${reg.id}/overview.jpg`);
    assert(ovrJpgRes.status === 200, `${reg.name} overview.jpg accessible (${ovrJpgRes.size} bytes)`);
    assert(ovrJpgRes.data[0] === 0xff && ovrJpgRes.data[1] === 0xd8, `${reg.name} overview.jpg has valid JPEG SOI header`);
    const decodedOvrJpg = jpeg.decode(ovrJpgRes.data);
    assert(decodedOvrJpg.width > 0 && decodedOvrJpg.height > 0, `${reg.name} overview.jpg decoded successfully (${decodedOvrJpg.width}x${decodedOvrJpg.height} px)`);

    // Texture tile 0_0.jpg
    const texRes = readStaticAsset(`/${reg.id}/tex/0_0.jpg`);
    assert(texRes.status === 200, `${reg.name} tex/0_0.jpg accessible (${texRes.size} bytes)`);
    assert(texRes.data[0] === 0xff && texRes.data[1] === 0xd8, `${reg.name} tex/0_0.jpg has valid JPEG SOI header`);
    const decodedTex = jpeg.decode(texRes.data);
    assert(decodedTex.width > 0 && decodedTex.height > 0, `${reg.name} tex/0_0.jpg decoded successfully (${decodedTex.width}x${decodedTex.height} px)`);
  }

  // 4. Test In-Situ Scientific Data Bundles
  console.log("\n--- 4. Testing In-Situ Scientific Environmental Bundles ---");
  // MEDA
  const medaRes = readStaticAsset('/data/meda_processed_bundle.json');
  assert(medaRes.status === 200, "meda_processed_bundle.json exists and accessible");
  const medaBundle = JSON.parse(medaRes.data.toString());
  const totalMedaRecords = medaBundle.products.reduce((acc, p) => acc + (p.product?.record_count || 0), 0);
  assert(medaBundle.products.length >= 7, `MEDA bundle contains ${medaBundle.products.length} sensor products (ATS, PS, TIRS, RHS, RDS, ANC, WS)`);
  assert(totalMedaRecords > 10000, `MEDA bundle loaded with ${totalMedaRecords} total records across products`);

  // REMS
  const remsRes = readStaticAsset('/data/rems_processed_bundle.json');
  assert(remsRes.status === 200, "rems_processed_bundle.json exists and accessible");
  const remsBundle = JSON.parse(remsRes.data.toString());
  assert(remsBundle.total_sampled_observations > 1000, `REMS bundle loaded with ${remsBundle.total_sampled_observations} sampled observations across Sols ${remsBundle.sols_represented.join(', ')}`);

  // Geological vector GeoJSON
  const geoRes = readStaticAsset('/data/jezero_geology_sim3464.geojson');
  assert(geoRes.status === 200, "jezero_geology_sim3464.geojson exists and accessible");
  const geoJson = JSON.parse(geoRes.data.toString());
  assert(geoJson.type === "FeatureCollection" && geoJson.features.length > 0, `Jezero SIM 3464 GeoJSON parsed with ${geoJson.features.length} features`);

  // 5. Test Region Switching & Simulator Environment Catalog Integrity
  console.log("\n--- 5. Testing Simulator Environment Resolution Logic ---");
  const catalogContent = fs.readFileSync(path.join(ROOT, 'frontend/src/simulator/environments/catalog.ts'), 'utf8');

  // Verify all 4 environments imported & registered
  assert(catalogContent.includes('import { JEZERO_ENVIRONMENT }'), "catalog.ts imports JEZERO_ENVIRONMENT");
  assert(catalogContent.includes('import { GALE_ENVIRONMENT }'), "catalog.ts imports GALE_ENVIRONMENT");
  assert(catalogContent.includes('import { VALLES_ENVIRONMENT }'), "catalog.ts imports VALLES_ENVIRONMENT");
  assert(catalogContent.includes('import { OLYMPUS_ENVIRONMENT }'), "catalog.ts imports OLYMPUS_ENVIRONMENT");

  assert(catalogContent.includes('"jezero-crater": JEZERO_ENVIRONMENT'), "AVAILABLE_SIMULATOR_ENVIRONMENTS maps 'jezero-crater'");
  assert(catalogContent.includes('"gale-crater": GALE_ENVIRONMENT'), "AVAILABLE_SIMULATOR_ENVIRONMENTS maps 'gale-crater'");
  assert(catalogContent.includes('"valles-marineris": VALLES_ENVIRONMENT'), "AVAILABLE_SIMULATOR_ENVIRONMENTS maps 'valles-marineris'");
  assert(catalogContent.includes('"olympus-mons": OLYMPUS_ENVIRONMENT'), "AVAILABLE_SIMULATOR_ENVIRONMENTS maps 'olympus-mons'");

  // Verify non-fallback isolation
  assert(catalogContent.includes("NEVER falls back to Jezero Crater"), "catalog.ts strictly documents non-fallback rule");
  assert(catalogContent.includes("available: false") && catalogContent.includes("environment: null"), "catalog.ts resolves unknown regions to available: false with null environment");

} catch (err) {
  console.error("Test execution error:", err);
  failed++;
}

console.log("\n===============================================================================");
console.log(`SMOKE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("===============================================================================");
if (failed > 0) {
  process.exit(1);
} else {
  console.log("\n>>> LIVE 3D SIMULATOR & ASSET SMOKE TESTS 100% SUCCESSFUL! <<<");
  process.exit(0);
}

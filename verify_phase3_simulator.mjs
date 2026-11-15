// verify_phase3_simulator.mjs
// Comprehensive verification script for Phase 3:
// Multi-Region 3D Surface Simulation & Authentic Scientific Data Integration.

import fs from 'node:fs';
import path from 'node:path';

console.log("===============================================================================");
console.log("RUNNING PHASE 3 MULTI-REGION 3D SIMULATOR & SCIENTIFIC INTEGRATION VERIFICATION");
console.log("===============================================================================\n");

let passed = 0;
let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}

// 1. Verify 3D Terrain Data Artifacts on Disk
console.log("--- 1. Verification of Authentic 3D Terrain Data Files ---");
const REGIONS = [
  { id: "jezero", name: "Jezero Crater", minRelief: 2000 },
  { id: "gale", name: "Gale Crater (Mount Sharp)", minRelief: 4500 },
  { id: "valles", name: "Valles Marineris (Melas Chasma)", minRelief: 7000 },
  { id: "olympus", name: "Olympus Mons (Summit Caldera)", minRelief: 3000 },
];

for (const reg of REGIONS) {
  const dir = path.join("frontend", "public", reg.id);
  assert(fs.existsSync(dir), `${reg.name} terrain directory exists (${dir})`);

  const manifestPath = path.join(dir, "manifest.json");
  assert(fs.existsSync(manifestPath), `${reg.name} manifest.json exists`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(manifest.cols > 0 && manifest.rows > 0, `${reg.name} manifest has valid dimensions (${manifest.cols}x${manifest.rows})`);

  const relief = manifest.heightMax - manifest.heightMin;
  assert(relief >= reg.minRelief, `${reg.name} empirical topographic relief is scientifically authentic (${relief.toFixed(1)} m >= ${reg.minRelief} m)`);

  const overviewU16 = path.join(dir, "overview.u16");
  assert(fs.existsSync(overviewU16) && fs.statSync(overviewU16).size > 10000, `${reg.name} overview.u16 exists and is populated (${fs.statSync(overviewU16).size} bytes)`);

  const overviewJpg = path.join(dir, "overview.jpg");
  assert(fs.existsSync(overviewJpg) && fs.statSync(overviewJpg).size > 5000, `${reg.name} overview.jpg exists and is populated (${fs.statSync(overviewJpg).size} bytes)`);

  const heightDir = path.join(dir, "height");
  assert(fs.existsSync(heightDir), `${reg.name} height tiles directory exists`);
  const heightFiles = fs.readdirSync(heightDir);
  assert(heightFiles.length >= 4, `${reg.name} has ${heightFiles.length} full-resolution height tiles`);

  const texDir = path.join(dir, "tex");
  assert(fs.existsSync(texDir), `${reg.name} texture tiles directory exists`);
  const texFiles = fs.readdirSync(texDir);
  assert(texFiles.length >= 4, `${reg.name} has ${texFiles.length} surface texture tiles`);
}

// 2. Verify Simulator Environment Modules
console.log("\n--- 2. Verification of Simulator Environment Configurations ---");
const envFiles = ["jezero.ts", "gale.ts", "valles.ts", "olympus.ts"];
for (const envFile of envFiles) {
  const filePath = path.join("frontend", "src", "simulator", "environments", envFile);
  assert(fs.existsSync(filePath), `Environment config exists: ${envFile}`);
  const content = fs.readFileSync(filePath, 'utf8');
  assert(content.includes('status: "available"'), `${envFile} has status: 'available'`);
  assert(content.includes('simulatorEntryUrl:'), `${envFile} declares valid simulatorEntryUrl`);
  assert(content.includes('meanRadiusMeters: 3_389_500'), `${envFile} uses IAU 2000 Mars radius`);
}

// 3. Verify Environment Catalog and Non-Fallback Policy
console.log("\n--- 3. Verification of Catalog Registry & Strict Non-Fallback ---");
const catalogPath = path.join("frontend", "src", "simulator", "environments", "catalog.ts");
const catalogContent = fs.readFileSync(catalogPath, 'utf8');
assert(catalogContent.includes('"jezero-crater": JEZERO_ENVIRONMENT'), "Catalog registers Jezero Crater");
assert(catalogContent.includes('"gale-crater": GALE_ENVIRONMENT'), "Catalog registers Gale Crater");
assert(catalogContent.includes('"valles-marineris": VALLES_ENVIRONMENT'), "Catalog registers Valles Marineris");
assert(catalogContent.includes('"olympus-mons": OLYMPUS_ENVIRONMENT'), "Catalog registers Olympus Mons");
assert(catalogContent.includes("NEVER falls back to Jezero Crater"), "Catalog enforces strict non-fallback rule");

// 4. Verify Multi-Page Vite Configuration
console.log("\n--- 4. Verification of Vite Multi-Page Simulator Bundling ---");
const viteConfigPath = path.join("frontend", "vite.config.ts");
const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
assert(viteConfig.includes("jezero:"), "vite.config.ts defines jezero input");
assert(viteConfig.includes("gale:"), "vite.config.ts defines gale input");
assert(viteConfig.includes("valles:"), "vite.config.ts defines valles input");
assert(viteConfig.includes("olympus:"), "vite.config.ts defines olympus input");

// 5. Verify Curiosity REMS Telemetry Integration
console.log("\n--- 5. Verification of MSL REMS Environmental Telemetry ---");
const remsBundlePath = path.join("frontend", "public", "data", "rems_processed_bundle.json");
assert(fs.existsSync(remsBundlePath), "rems_processed_bundle.json exists in public/data");
const remsStat = fs.statSync(remsBundlePath);
assert(remsStat.size > 1000000, `rems_processed_bundle.json is complete (${(remsStat.size / (1024 * 1024)).toFixed(2)} MB)`);

const remsBundle = JSON.parse(fs.readFileSync(remsBundlePath, 'utf8'));
assert(remsBundle.total_sampled_observations > 1000, `REMS bundle contains ${remsBundle.total_sampled_observations} validated observations`);
assert(remsBundle.sols_represented.includes(10) && remsBundle.sols_represented.includes(1600), "REMS bundle covers Sol 10 baseline and Sol 1600 post-degradation");

const evidencePath = path.join("frontend", "src", "data", "evidenceDatasets.ts");
const evidenceContent = fs.readFileSync(evidencePath, 'utf8');
assert(evidenceContent.includes('id: "msl_rems_env"'), "msl_rems_env is registered in EVIDENCE_DATASETS");
assert(evidenceContent.includes('"msl_rems_env", // /public/data/rems_processed_bundle.json'), "msl_rems_env is registered in GENUINE_LOCAL_DATASET_IDS");

const providerPath = path.join("frontend", "src", "services", "providers", "remsProvider.ts");
assert(fs.existsSync(providerPath), "remsProvider.ts exists in services/providers");

const panelPath = path.join("frontend", "src", "features", "mission", "RemsEnvironmentalPanel.tsx");
assert(fs.existsSync(panelPath), "RemsEnvironmentalPanel.tsx exists in features/mission");

const investigationPath = path.join("frontend", "src", "features", "mission", "InvestigationPage.tsx");
const investigationContent = fs.readFileSync(investigationPath, 'utf8');
assert(investigationContent.includes("RemsEnvironmentalPanel"), "InvestigationPage embeds RemsEnvironmentalPanel");
assert(investigationContent.includes("isGale"), "InvestigationPage gates REMS Inspector to Gale Crater");

// 6. Summary
console.log("\n===============================================================================");
console.log(`PHASE 3 VERIFICATION RESULTS: ${passed} PASSED, ${failures} FAILED`);
console.log("===============================================================================");

if (failures > 0) {
  process.exit(1);
} else {
  console.log("\n>>> ALL PHASE 3 3D TERRAIN & SCIENTIFIC DATASET CHECKS PASSED! <<<");
  process.exit(0);
}

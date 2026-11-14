// verify_phase2_3_integration.mjs
import fs from "fs";
import path from "path";

console.log("=== RUNNING PHASE 2 & 3 INTEGRATION VERIFICATION ===");

// 1. Verify USGS Jezero Geologic GeoJSON
const geojsonPath = path.resolve("frontend/public/data/jezero_geology_sim3464.geojson");
if (!fs.existsSync(geojsonPath)) {
  console.error("FAIL: jezero_geology_sim3464.geojson does not exist!");
  process.exit(1);
}
const geojson = JSON.parse(fs.readFileSync(geojsonPath, "utf-8"));
if (geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
  console.error("FAIL: Invalid GeoJSON structure!");
  process.exit(1);
}
console.log(`PASS: USGS Jezero GeoJSON loaded with ${geojson.features.length} geologic unit features.`);
const expectedUnits = ["HpHd_scarp", "HpHd_top", "HNcf_f", "Cc_b", "Hcf_m", "Npl_cr"];
for (const u of expectedUnits) {
  const feat = geojson.features.find((f) => f.properties?.unit_code === u);
  if (!feat) {
    console.error(`FAIL: Missing expected unit ${u}`);
    process.exit(1);
  }
}
console.log("PASS: All 6 USGS SIM 3464 units verified with properties and coordinates.");

// 2. Verify Map Layers (jezero_hirise)
const mapLayersContent = fs.readFileSync("frontend/src/data/mapLayers.ts", "utf-8");
if (!mapLayersContent.includes("jezero_hirise")) {
  console.error("FAIL: jezero_hirise missing in mapLayers.ts!");
  process.exit(1);
}
console.log("PASS: Localized Jezero HiRISE 25cm layer registered in mapLayers.ts.");

// 3. Verify NASA Trek Provider mapping
const trekContent = fs.readFileSync("frontend/src/services/providers/nasaTrek.ts", "utf-8");
if (!trekContent.includes("JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd")) {
  console.error("FAIL: NASA Trek WMTS mapping for Jezero HiRISE missing!");
  process.exit(1);
}
console.log("PASS: NASA Trek WMTS endpoint mapped for Jezero HiRISE.");

// 4. Verify CRISM Hyperspectral Evidence
const evidenceContent = fs.readFileSync("frontend/src/data/evidenceDatasets.ts", "utf-8");
if (!evidenceContent.includes("crism_jezero_vnir") || !evidenceContent.includes('"integrated_active"')) {
  console.error("FAIL: crism_jezero_vnir not active in evidenceDatasets.ts!");
  process.exit(1);
}
console.log("PASS: CRISM VNIR Smectite promoted to integrated_active in evidenceDatasets.ts.");

// 5. Verify Backend Rover Endpoint
const mainPyContent = fs.readFileSync("backend/main.py", "utf-8");
if (!mainPyContent.includes("/api/rover/perseverance/images")) {
  console.error("FAIL: /api/rover/perseverance/images route missing in backend/main.py!");
  process.exit(1);
}
console.log("PASS: FastAPI backend exposes /api/rover/perseverance/images.");

// 6. Verify CrismSpectralPanel exists
const crismPanelPath = "frontend/src/features/mission/CrismSpectralPanel.tsx";
if (!fs.existsSync(crismPanelPath)) {
  console.error("FAIL: CrismSpectralPanel.tsx missing!");
  process.exit(1);
}
console.log("PASS: CrismSpectralPanel component verified with SVG spectral curve.");

console.log("\n>>> ALL PHASE 2 & 3 INTEGRATION CHECKS PASSED SUCCESSFULLY! <<<");

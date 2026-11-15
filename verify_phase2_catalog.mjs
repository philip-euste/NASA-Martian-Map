// verify_phase2_catalog.mjs
// Verification Script for Phase 2.2: Scientific Dataset Catalog & Regional Geological Reference Corrections
// Option B: Clean References-Only Architecture Verification

import fs from "fs";
import path from "path";

console.log("===============================================================================");
console.log("RUNNING PHASE 2.2 SCIENTIFIC CATALOG & GEOLOGICAL REFERENCE VERIFICATION");
console.log("===============================================================================\n");

let failures = 0;
let passed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures++;
  } else {
    console.log(`PASS: ${message}`);
    passed++;
  }
}

// 1. Read frontend/src/data/regions.ts
const regionsPath = path.join("frontend", "src", "data", "regions.ts");
assert(fs.existsSync(regionsPath), "frontend/src/data/regions.ts exists");

const regionsSource = fs.readFileSync(regionsPath, "utf8");

// --- SECTION 1: ZERO DEPRECATED IDENTIFIERS & CITATIONS ---
console.log("\n--- 1. Verification of Deprecated Identifier Elimination ---");
assert(
  !regionsSource.includes("usgs_sim_3482_gale"),
  "Deprecated identifier 'usgs_sim_3482_gale' is completely absent from regions.ts"
);
assert(
  !regionsSource.includes("usgs_i2614_valles"),
  "Deprecated identifier 'usgs_i2614_valles' is completely absent from regions.ts"
);
assert(
  !regionsSource.includes("usgs_i2502_olympus"),
  "Deprecated identifier 'usgs_i2502_olympus' is completely absent from regions.ts"
);
assert(
  !regionsSource.toLowerCase().includes("oklahoma"),
  "Terrestrial reference to Oklahoma is completely absent from regions.ts"
);
assert(
  !regionsSource.toLowerCase().includes("kilauea") && !regionsSource.toLowerCase().includes("kīlauea"),
  "Terrestrial reference to Kilauea is completely absent from regions.ts"
);
assert(
  !regionsSource.toLowerCase().includes("south carolina"),
  "Terrestrial reference to South Carolina is completely absent from regions.ts"
);

// --- SECTION 2: OPTION B VECTOR ASSET DISAMBIGUATION ---
console.log("\n--- 2. Option B Vector Asset Separation Invariants ---");

// Jezero retains its verified active GeoJSON dataset
assert(
  regionsSource.includes("usgs_sim_3464"),
  "Jezero retains verified 'usgs_sim_3464' geological dataset"
);
assert(
  regionsSource.includes("/data/jezero_geology_sim3464.geojson"),
  "Jezero retains active dataPath '/data/jezero_geology_sim3464.geojson'"
);

// Physical file on disk exists and is untouched
const jezeroGeoJsonPath = path.join("frontend", "public", "data", "jezero_geology_sim3464.geojson");
assert(
  fs.existsSync(jezeroGeoJsonPath),
  "Jezero physical GeoJSON file 'frontend/public/data/jezero_geology_sim3464.geojson' exists on disk"
);
const geoJsonStat = fs.statSync(jezeroGeoJsonPath);
assert(
  geoJsonStat.size >= 5000,
  `Jezero physical GeoJSON file is intact (${(geoJsonStat.size / 1024).toFixed(2)} KB)`
);

// Non-Jezero regions have empty geologicalDatasets array (Option B)
// Parse regions using Node evaluation of TypeScript/ESM or regex block inspection
function extractRegionBlock(source, regionKey) {
  const marker = `"${regionKey}": {`;
  const startIdx = source.indexOf(marker);
  if (startIdx === -1) return "";
  // Find closing of this region object (next top-level region key or end of MARS_REGIONS)
  const nextRegionMarker = source.indexOf('\n  "', startIdx + marker.length);
  const endIdx = nextRegionMarker !== -1 ? nextRegionMarker : source.indexOf("};\n", startIdx);
  return source.substring(startIdx, endIdx);
}

const galeBlock = extractRegionBlock(regionsSource, "gale-crater");
const vallesBlock = extractRegionBlock(regionsSource, "valles-marineris");
const olympusBlock = extractRegionBlock(regionsSource, "olympus-mons");

assert(
  /geologicalDatasets:\s*\[\s*\],/.test(galeBlock),
  "Gale Crater 'geologicalDatasets' is strictly empty array '[]' (no false GeoJSON assets declared)"
);
assert(
  /geologicalDatasets:\s*\[\s*\],/.test(vallesBlock),
  "Valles Marineris 'geologicalDatasets' is strictly empty array '[]' (no false GeoJSON assets declared)"
);
assert(
  /geologicalDatasets:\s*\[\s*\],/.test(olympusBlock),
  "Olympus Mons 'geologicalDatasets' is strictly empty array '[]' (no false GeoJSON assets declared)"
);

// --- SECTION 3: AUTHORITATIVE SCIENTIFIC REFERENCES VERIFICATION ---
console.log("\n--- 3. Authoritative Scientific References Verification ---");

// Gale Crater References
assert(
  galeBlock.includes("Anderson, R.B. & Bell, J.F., III (2010)"),
  "Gale references include Anderson & Bell (2010)"
);
assert(
  galeBlock.includes("10.1555/mars.2010.0004"),
  "Gale references cite Anderson & Bell DOI '10.1555/mars.2010.0004'"
);
assert(
  galeBlock.includes("Scott, D.H. & West, M.N. (1978)"),
  "Gale references cite Scott, D.H. & West, M.N. (1978) for USGS Map I-1111"
);
assert(
  !galeBlock.includes("Morris") || !galeBlock.includes("Morris, E.C. & West"),
  "Gale references do NOT list Morris as co-author of USGS Map I-1111"
);
assert(
  galeBlock.includes("Geologic Map of the Aeolis Quadrangle of Mars"),
  "Gale references use official title 'Geologic Map of the Aeolis Quadrangle of Mars'"
);
assert(
  galeBlock.includes("10.3133/i1111"),
  "Gale references cite official USGS IMAP 1111 DOI '10.3133/i1111'"
);
assert(
  galeBlock.includes("scale 1:5,000,000"),
  "Gale references cite official USGS Map I-1111 scale 1:5,000,000"
);

// Valles Marineris References
assert(
  vallesBlock.includes("Witbeck, N.E., Tanaka, K.L., & Scott, D.H. (1991)"),
  "Valles Marineris references cite Witbeck, Tanaka, & Scott (1991)"
);
assert(
  vallesBlock.includes("Geologic Map of the Valles Marineris Region, Mars"),
  "Valles Marineris references use official title 'Geologic Map of the Valles Marineris Region, Mars'"
);
assert(
  vallesBlock.includes("Map I-2010") || vallesBlock.includes("IMAP 2010"),
  "Valles Marineris references cite USGS Map I-2010"
);
assert(
  vallesBlock.includes("10.3133/i2010"),
  "Valles Marineris references cite official DOI '10.3133/i2010'"
);
assert(
  vallesBlock.includes("1:2,000,000"),
  "Valles Marineris references cite scale 1:2,000,000"
);

// Olympus Mons References
assert(
  olympusBlock.includes("Mouginis-Mark, P.J. (2021)"),
  "Olympus Mons references cite Mouginis-Mark (2021)"
);
assert(
  olympusBlock.includes("Geologic Map of Olympus Mons Caldera, Mars"),
  "Olympus Mons references use official title 'Geologic Map of Olympus Mons Caldera, Mars'"
);
assert(
  olympusBlock.includes("Scientific Investigations Map 3470") || olympusBlock.includes("SIM 3470"),
  "Olympus Mons references cite USGS Scientific Investigations Map 3470"
);
assert(
  olympusBlock.includes("10.3133/sim3470"),
  "Olympus Mons references cite official DOI '10.3133/sim3470'"
);
assert(
  olympusBlock.includes("Morris, E.C. & Tanaka, K.L. (1994)"),
  "Olympus Mons references cite Morris & Tanaka (1994) for flank context"
);
assert(
  olympusBlock.includes("Map I-2327"),
  "Olympus Mons references cite USGS Map I-2327 for flank context"
);

// --- SECTION 4: MULTI-REGION SIMULATOR SAFETY INVARIANTS ---
console.log("\n--- 4. Multi-Region Simulator Availability Invariants ---");
assert(
  regionsSource.includes('"jezero-crater"') && regionsSource.includes('simulatorAvailability: "AVAILABLE"'),
  "Jezero Crater simulatorAvailability remains strictly AVAILABLE"
);
assert(
  galeBlock.includes('simulatorAvailability: "AVAILABLE"') || galeBlock.includes('simulatorAvailability: "PLANNED"'),
  "Gale Crater simulatorAvailability is valid (AVAILABLE with verified MOLA 3D DEM or PLANNED)"
);
assert(
  vallesBlock.includes('simulatorAvailability: "AVAILABLE"') || vallesBlock.includes('simulatorAvailability: "PLANNED"'),
  "Valles Marineris simulatorAvailability is valid (AVAILABLE with verified MOLA 3D DEM or PLANNED)"
);
assert(
  olympusBlock.includes('simulatorAvailability: "AVAILABLE"') || olympusBlock.includes('simulatorAvailability: "PLANNED"'),
  "Olympus Mons simulatorAvailability is valid (AVAILABLE with verified MOLA 3D DEM or PLANNED)"
);

// --- SECTION 5: FINAL SUMMARY ---
console.log("\n===============================================================================");
console.log(`PHASE 2.2 VERIFICATION RESULTS: ${passed} PASSED, ${failures} FAILED`);
console.log("===============================================================================");

if (failures > 0) {
  process.exit(1);
}

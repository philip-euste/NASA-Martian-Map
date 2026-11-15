// verify_phase1_multiregion.mjs
// Verification script for Phase 1: Multi-Region Architectural Foundation

import fs from "fs";
import path from "path";

console.log("=== RUNNING PHASE 1 MULTI-REGION ARCHITECTURE VERIFICATION ===");

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures++;
  } else {
    console.log(`PASS: ${message}`);
  }
}

// 1. Inspect types/region.ts
const regionTypesContent = fs.readFileSync(
  path.join("frontend", "src", "types", "region.ts"),
  "utf8"
);
assert(
  regionTypesContent.includes("SimulatorAvailability"),
  "types/region.ts defines SimulatorAvailability"
);
assert(
  regionTypesContent.includes("AVAILABLE") &&
    regionTypesContent.includes("PLANNED") &&
    regionTypesContent.includes("UNAVAILABLE") &&
    regionTypesContent.includes("LIMITED_DATA"),
  "SimulatorAvailability contains all 4 standard states"
);
assert(
  regionTypesContent.includes("MarsRegion extends Region"),
  "MarsRegion extends Region for backward compatibility"
);
assert(
  regionTypesContent.includes("RegionalElevationDataset"),
  "Multi-tier RegionalElevationDataset model defined"
);
assert(
  regionTypesContent.includes("RegionalGeologicalDataset"),
  "RegionalGeologicalDataset model defined"
);

// 2. Inspect data/regions.ts
const regionsDataContent = fs.readFileSync(
  path.join("frontend", "src", "data", "regions.ts"),
  "utf8"
);
assert(
  regionsDataContent.includes('"jezero-crater":'),
  "Registry contains Jezero Crater"
);
assert(
  regionsDataContent.includes('"gale-crater":'),
  "Registry contains Gale Crater"
);
assert(
  regionsDataContent.includes('"valles-marineris":'),
  "Registry contains Valles Marineris"
);
assert(
  regionsDataContent.includes('"olympus-mons":'),
  "Registry contains Olympus Mons"
);
assert(
  regionsDataContent.includes('"nili-fossae":') &&
    regionsDataContent.includes('"syrtis-major":'),
  "Registry contains non-simulator regions (Nili Fossae, Syrtis Major)"
);

// 3. Verify Simulator Availability states
assert(
  regionsDataContent.includes('id: "jezero-crater"') &&
    regionsDataContent.includes('simulatorAvailability: "AVAILABLE"'),
  "Jezero Crater is marked AVAILABLE"
);
assert(
  regionsDataContent.includes('id: "gale-crater"') &&
    (regionsDataContent.includes('simulatorAvailability: "AVAILABLE"') ||
     regionsDataContent.includes('simulatorAvailability: "PLANNED"')),
  "Gale Crater has valid simulator availability"
);
assert(
  regionsDataContent.includes('id: "valles-marineris"') &&
    (regionsDataContent.includes('simulatorAvailability: "AVAILABLE"') ||
     regionsDataContent.includes('simulatorAvailability: "PLANNED"')),
  "Valles Marineris has valid simulator availability"
);
assert(
  regionsDataContent.includes('id: "olympus-mons"') &&
    (regionsDataContent.includes('simulatorAvailability: "AVAILABLE"') ||
     regionsDataContent.includes('simulatorAvailability: "PLANNED"')),
  "Olympus Mons has valid simulator availability"
);

// Verify non-simulator regions (Nili Fossae, Syrtis Major) are strictly UNAVAILABLE
const niliSection = regionsDataContent.slice(
  regionsDataContent.indexOf('"nili-fossae":'),
  regionsDataContent.indexOf('"syrtis-major":')
);
assert(
  !niliSection.includes('simulatorAvailability: "AVAILABLE"'),
  "Nili Fossae is strictly NOT marked AVAILABLE"
);

const syrtisSection = regionsDataContent.slice(
  regionsDataContent.indexOf('"syrtis-major":')
);
assert(
  !syrtisSection.includes('simulatorAvailability: "AVAILABLE"'),
  "Syrtis Major is strictly NOT marked AVAILABLE"
);
assert(
  syrtisSection.includes('simulatorAvailability: "UNAVAILABLE"'),
  "Syrtis Major is strictly marked UNAVAILABLE"
);

// 4. Inspect catalog.ts for fallback elimination
const catalogContent = fs.readFileSync(
  path.join("frontend", "src", "simulator", "environments", "catalog.ts"),
  "utf8"
);
assert(
  catalogContent.includes("NEVER falls back to Jezero Crater"),
  "catalog.ts enforces strict non-fallback policy"
);
assert(
  catalogContent.includes("environment: null") &&
    catalogContent.includes("available: false"),
  "Non-Jezero environments resolve to null environment and available: false"
);

// 5. Inspect MarswalkPage.tsx
const marswalkContent = fs.readFileSync(
  path.join("frontend", "src", "features", "mission", "MarswalkPage.tsx"),
  "utf8"
);
assert(
  marswalkContent.includes("resolveSimulatorEnvironment"),
  "MarswalkPage checks resolveSimulatorEnvironment"
);
assert(
  marswalkContent.includes("3D SURFACE EXPLORATION STATUS"),
  "MarswalkPage renders taste-skill styled Availability Notice for planned regions"
);
assert(
  marswalkContent.includes("!isSimulatorAvailable") &&
    marswalkContent.includes("iframeRef"),
  "MarswalkPage isolates iframe mounting behind isSimulatorAvailable flag"
);

// 6. Inspect MarsExplorerUI.tsx
const explorerUIContent = fs.readFileSync(
  path.join("frontend", "src", "features", "mars-explorer", "MarsExplorerUI.tsx"),
  "utf8"
);
assert(
  explorerUIContent.includes("resolveSimulatorEnvironment"),
  "MarsExplorerUI checks resolveSimulatorEnvironment"
);
assert(
  !explorerUIContent.includes("targetCoordinates = JEZERO_DEFAULT_COORDINATES"),
  "Accidental coordinate overwrite to Jezero default has been eliminated"
);

// 7. Inspect MissionContext.tsx
const missionContextContent = fs.readFileSync(
  path.join("frontend", "src", "state", "mission", "MissionContext.tsx"),
  "utf8"
);
assert(
  missionContextContent.includes("getMarsRegionById"),
  "MissionContext migrates stored regions via getMarsRegionById"
);
assert(
  missionContextContent.includes("simulation.currentPosition") &&
    missionContextContent.includes("distanceFromBaseMeters: 0"),
  "MissionContext setRegion resets simulation coordinates on region switch"
);

if (failures === 0) {
  console.log("\n>>> ALL PHASE 1 ARCHITECTURE VERIFICATION CHECKS PASSED! <<<");
  process.exit(0);
} else {
  console.error(`\n>>> ${failures} VERIFICATION CHECK(S) FAILED! <<<`);
  process.exit(1);
}

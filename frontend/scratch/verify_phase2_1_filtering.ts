// frontend/scratch/verify_phase2_1_filtering.ts
// Automated Verification Suite for Phase 2.1: Region-Aware Dataset Model & Filtering

import {
  EVIDENCE_DATASETS,
  EVIDENCE_DATASETS_BY_ID,
  getDatasetsForRegion,
  getPlannedOrUnavailableDatasetsForRegion,
  isDatasetApplicableToRegion,
  isDatasetUsable,
  toMissionDataset,
  resolveDatasetMetadata,
  COVERAGE_SCOPE_LABELS,
  OPERATIONAL_STATUS_LABELS,
} from "../src/data/evidenceDatasets";
import { MARS_REGIONS } from "../src/data/regions";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    passedCount++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedCount++;
    console.error(`  [FAIL] ${testName}${details ? ` -> ${details}` : ""}`);
  }
}

console.log("===============================================================================");
console.log("PHASE 2.1 VERIFICATION SUITE — REGION-AWARE SCIENTIFIC DATASET MODEL & FILTERING");
console.log("===============================================================================\n");

// 1. DATASET METADATA & MODEL VALIDATION
console.log("TEST GROUP 1: Scientific Dataset Model & Metadata Consistency");
assert(
  EVIDENCE_DATASETS.length === 17,
  "All 17 empirical evidence datasets registered in catalog",
  `Found ${EVIDENCE_DATASETS.length}`
);

for (const ds of EVIDENCE_DATASETS) {
  assert(
    Boolean(ds.coverageScope) && ["GLOBAL", "REGIONAL", "LOCAL_INSITU", "UNKNOWN"].includes(ds.coverageScope),
    `Dataset '${ds.id}' has valid coverageScope: ${ds.coverageScope}`
  );

  assert(
    Array.isArray(ds.operationalStatus) && ds.operationalStatus.length > 0,
    `Dataset '${ds.id}' has non-empty operationalStatus array: [${ds.operationalStatus.join(", ")}]`
  );

  for (const st of ds.operationalStatus) {
    assert(
      ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED", "PLANNED", "UNAVAILABLE"].includes(st),
      `Dataset '${ds.id}' status '${st}' is a recognized operational status`
    );
  }
}

// 2. REGION APPLICABILITY & FILTERING
console.log("\nTEST GROUP 2: Region-Aware Dataset Filtering (Primary Exploration Regions)");

const primaryRegionIds = ["jezero-crater", "gale-crater", "valles-marineris", "olympus-mons"] as const;

// Jezero Crater
const jezeroUsable = getDatasetsForRegion("jezero-crater");
const jezeroPlanned = getPlannedOrUnavailableDatasetsForRegion("jezero-crater");

assert(
  jezeroUsable.length === 16,
  `Jezero Crater has exactly 16 usable datasets (10 global + 6 local/regional)`,
  `Found ${jezeroUsable.length}`
);

assert(
  jezeroPlanned.some((d) => d.id === "omega_vnir_regional"),
  "OMEGA VNIR regional dataset is classified as planned/unavailable for Jezero Crater"
);

assert(
  !jezeroUsable.some((d) => d.id === "omega_vnir_regional"),
  "OMEGA VNIR regional dataset is excluded from active usable datasets"
);

// Gale Crater
const galeUsable = getDatasetsForRegion("gale-crater");
const galePlanned = getPlannedOrUnavailableDatasetsForRegion("gale-crater");

assert(
  galeUsable.length === 10,
  `Gale Crater has exactly 10 usable global datasets`,
  `Found ${galeUsable.length}`
);

const jezeroSpecificIds = [
  "hirise_jezero_dtm",
  "ctx_jezero_dtm_20m",
  "jezero_hirise",
  "ctx_jezero_ortho_5m",
  "crism_jezero_vnir",
  "m2020_meda_env",
];

for (const jzId of jezeroSpecificIds) {
  assert(
    !galeUsable.some((d) => d.id === jzId),
    `Gale Crater does not contain Jezero-specific dataset '${jzId}'`
  );
}

// Valles Marineris
const vallesUsable = getDatasetsForRegion("valles-marineris");
assert(
  vallesUsable.length === 10,
  `Valles Marineris has exactly 10 usable global datasets`,
  `Found ${vallesUsable.length}`
);

for (const jzId of jezeroSpecificIds) {
  assert(
    !vallesUsable.some((d) => d.id === jzId),
    `Valles Marineris does not contain Jezero-specific dataset '${jzId}'`
  );
}

// Olympus Mons
const olympusUsable = getDatasetsForRegion("olympus-mons");
assert(
  olympusUsable.length === 10,
  `Olympus Mons has exactly 10 usable global datasets`,
  `Found ${olympusUsable.length}`
);

for (const jzId of jezeroSpecificIds) {
  assert(
    !olympusUsable.some((d) => d.id === jzId),
    `Olympus Mons does not contain Jezero-specific dataset '${jzId}'`
  );
}

// 3. GLOBAL LATITUDE BOUNDARY CONSTRAINTS
console.log("\nTEST GROUP 3: Global Dataset Latitude Boundary Constraints");
const tesSilicates = EVIDENCE_DATASETS_BY_ID["mars_tes_silicates"];
assert(
  Boolean(tesSilicates.latitudeLimits) &&
    tesSilicates.latitudeLimits?.minLat === -60 &&
    tesSilicates.latitudeLimits?.maxLat === 60,
  "TES Sheet Silicates has ±60° latitude constraints configured"
);

for (const rId of primaryRegionIds) {
  const reg = MARS_REGIONS[rId];
  assert(
    isDatasetApplicableToRegion(tesSilicates, rId),
    `TES Silicates is applicable to '${reg.name}' (lat ${reg.coordinates.latitude}° within ±60°)`
  );
}

// 4. TO MISSION DATASET BACKWARD COMPATIBILITY
console.log("\nTEST GROUP 4: Mission Dataset Conversion & Metadata Preservation");
const testEntry = EVIDENCE_DATASETS_BY_ID["hirise_jezero_dtm"];
const missionDs = toMissionDataset(testEntry);

assert(missionDs.id === testEntry.id, "toMissionDataset preserves dataset ID");
assert(missionDs.coverageScope === "REGIONAL", "toMissionDataset forwards coverageScope");
assert(
  Array.isArray(missionDs.supportedRegionIds) && missionDs.supportedRegionIds.includes("jezero-crater"),
  "toMissionDataset forwards supportedRegionIds"
);
assert(
  Array.isArray(missionDs.operationalStatus) && missionDs.operationalStatus.includes("INTEGRATED"),
  "toMissionDataset forwards operationalStatus"
);
assert(
  Boolean(missionDs.provenance) && missionDs.provenance?.source === testEntry.sourceReference,
  "toMissionDataset preserves provenance archive reference"
);

// 5. RESOLVE DATASET METADATA (BACKWARD COMPATIBILITY)
console.log("\nTEST GROUP 5: resolveDatasetMetadata Backward Compatibility");
const metaHiRISE = resolveDatasetMetadata("hirise_jezero_dtm");
assert(metaHiRISE.coverageScope === "REGIONAL", "resolveDatasetMetadata returns coverageScope for evidence");
assert(
  Array.isArray(metaHiRISE.operationalStatus) && metaHiRISE.operationalStatus.includes("INTEGRATED"),
  "resolveDatasetMetadata returns operationalStatus for evidence"
);

const metaLegacy = resolveDatasetMetadata("mars_global_mola");
assert(
  metaLegacy.isVisualizationOnlyLegacy === true,
  "resolveDatasetMetadata correctly marks legacy map layers as isVisualizationOnlyLegacy"
);
assert(metaLegacy.coverageScope === "GLOBAL", "resolveDatasetMetadata assigns GLOBAL to legacy map layers");

console.log("\n===============================================================================");
console.log(`VERIFICATION COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("===============================================================================");

if (failedCount > 0) {
  process.exit(1);
}

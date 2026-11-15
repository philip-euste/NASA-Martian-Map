// frontend/scratch/verify_phase2_1_2_corrections.ts
// Automated verification suite for Phase 2.1.2 corrections:
// 1. Region latitude containment against catalog latitude limits.
// 2. Strict DOWNLOADED status restriction to genuine pre-bundled local assets.
// 3. Scientific limitations and regional caveats (Olympus Mons dust obscuration on TES minerals).
// 4. Dataset lifecycle invariant validation function.
// 5. Selectable dataset counts preservation (Jezero: 16, Gale: 11, Valles: 10, Olympus: 10).

declare const process: { exit(code?: number): void };

import {
  EVIDENCE_DATASETS,
  EVIDENCE_DATASETS_BY_ID,
  GENUINE_LOCAL_DATASET_IDS,
  getDatasetsForRegion,
  isDatasetApplicableToRegion,
  isDatasetUsable,
  resolveDatasetMetadata,
  validateAllDatasetsLifecycle,
  validateDatasetLifecycle,
  type EvidenceDatasetEntry,
} from "../src/data/evidenceDatasets";
import { MARS_REGIONS } from "../src/data/regions";
import type { MarsRegion } from "../src/types";

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log("=== PHASE 2.1.2 AUTOMATED VERIFICATION SUITE ===\n");

// -------------------------------------------------------------
// TEST SUITE 1: FULL GEOGRAPHIC BOUNDS LATITUDE VALIDATION
// -------------------------------------------------------------
console.log("1. Region Latitude Containment:");

const tesSilicates = EVIDENCE_DATASETS_BY_ID["mars_tes_silicates"];
assert(
  Boolean(tesSilicates && tesSilicates.latitudeLimits?.minLat === -60 && tesSilicates.latitudeLimits?.maxLat === 60),
  "mars_tes_silicates has latitudeLimits [-60°, 60°]"
);

// All 4 primary regions must be fully inside [-60, 60]
const jezero = MARS_REGIONS["jezero-crater"];
const gale = MARS_REGIONS["gale-crater"];
const valles = MARS_REGIONS["valles-marineris"];
const olympus = MARS_REGIONS["olympus-mons"];

assert(
  isDatasetApplicableToRegion(tesSilicates, "jezero-crater") === true,
  `Jezero [${jezero.geographicBounds.southLatDeg}°, ${jezero.geographicBounds.northLatDeg}°] is fully applicable to TES ±60°`
);
assert(
  isDatasetApplicableToRegion(tesSilicates, "gale-crater") === true,
  `Gale [${gale.geographicBounds.southLatDeg}°, ${gale.geographicBounds.northLatDeg}°] is fully applicable to TES ±60°`
);
assert(
  isDatasetApplicableToRegion(tesSilicates, "valles-marineris") === true,
  `Valles Marineris [${valles.geographicBounds.southLatDeg}°, ${valles.geographicBounds.northLatDeg}°] is fully applicable to TES ±60°`
);
assert(
  isDatasetApplicableToRegion(tesSilicates, "olympus-mons") === true,
  `Olympus Mons [${olympus.geographicBounds.southLatDeg}°, ${olympus.geographicBounds.northLatDeg}°] is fully applicable to TES ±60°`
);

// Synthetic boundary tests
const northBoundaryCrossingRegion = {
  id: "synthetic-north-crossing",
  coordinates: { latitude: 59, longitude: 0 },
  geographicBounds: { southLatDeg: 55, northLatDeg: 65, westLonDeg: -10, eastLonDeg: 10 },
};
assert(
  isDatasetApplicableToRegion(tesSilicates, northBoundaryCrossingRegion as any) === false,
  "Synthetic region spanning 55°N to 65°N is NOT applicable to ±60° dataset (north boundary exceeded)"
);

const southBoundaryCrossingRegion = {
  id: "synthetic-south-crossing",
  coordinates: { latitude: -59, longitude: 0 },
  geographicBounds: { southLatDeg: -65, northLatDeg: -55, westLonDeg: -10, eastLonDeg: 10 },
};
assert(
  isDatasetApplicableToRegion(tesSilicates, southBoundaryCrossingRegion as any) === false,
  "Synthetic region spanning -65°S to -55°S is NOT applicable to ±60° dataset (south boundary exceeded)"
);

const completelyInsideSyntheticRegion = {
  id: "synthetic-inside",
  coordinates: { latitude: 0, longitude: 0 },
  geographicBounds: { southLatDeg: -59, northLatDeg: 59, westLonDeg: -10, eastLonDeg: 10 },
};
assert(
  isDatasetApplicableToRegion(tesSilicates, completelyInsideSyntheticRegion as any) === true,
  "Synthetic region spanning -59°S to 59°N IS applicable to ±60° dataset"
);

// Center-only failure trap check: center is 58°N (inside), but north edge is 62°N (outside)
const centerInsideBoundaryCrossingRegion = {
  id: "synthetic-center-inside-edge-outside",
  coordinates: { latitude: 58, longitude: 0 },
  geographicBounds: { southLatDeg: 54, northLatDeg: 62, westLonDeg: -10, eastLonDeg: 10 },
};
assert(
  isDatasetApplicableToRegion(tesSilicates, centerInsideBoundaryCrossingRegion as any) === false,
  "Synthetic region with center at 58°N but north bound at 62°N correctly evaluated as NOT applicable"
);

// -------------------------------------------------------------
// TEST SUITE 2: STRICT DOWNLOADED OPERATIONAL STATUS
// -------------------------------------------------------------
console.log("\n2. Strict DOWNLOADED Status Restriction:");

const downloadedDatasets = EVIDENCE_DATASETS.filter((d) =>
  d.operationalStatus.includes("DOWNLOADED")
).map((d) => d.id);

console.log("  Actual datasets with DOWNLOADED status:", downloadedDatasets);

assert(
  downloadedDatasets.length === 4,
  `Exactly 4 datasets have DOWNLOADED status (found ${downloadedDatasets.length})`
);

assert(
  downloadedDatasets.includes("ctx_jezero_dtm_20m") &&
  downloadedDatasets.includes("ctx_jezero_ortho_5m") &&
  downloadedDatasets.includes("m2020_meda_env") &&
  downloadedDatasets.includes("msl_rems_env"),
  "DOWNLOADED status belongs strictly to ctx_jezero_dtm_20m, ctx_jezero_ortho_5m, m2020_meda_env, and msl_rems_env"
);

// Verify remote WMTS streams and APIs do NOT have DOWNLOADED
const remoteDatasets = [
  "hirise_jezero_dtm",
  "jezero_hirise",
  "mars_mola_roughness",
  "mars_themis_night",
  "mars_themis_day",
  "mars_tes_thermal",
  "mars_tes_albedo",
  "mars_tes_silicates",
  "mars_tes_pyroxene",
  "mars_tes_plagioclase",
  "mars_tes_dust_index",
  "mars_tes_dust",
  "crism_jezero_vnir",
  "omega_vnir_regional",
];

for (const id of remoteDatasets) {
  const ds = EVIDENCE_DATASETS_BY_ID[id];
  assert(
    !ds.operationalStatus.includes("DOWNLOADED"),
    `Remote/API/streaming dataset '${id}' does NOT have DOWNLOADED status`
  );
}

// -------------------------------------------------------------
// TEST SUITE 3: LIFECYCLE INVARIANT VALIDATOR
// -------------------------------------------------------------
console.log("\n3. Dataset Lifecycle Invariant Validation:");

const allResults = validateAllDatasetsLifecycle();
assert(
  allResults.valid === true && allResults.totalErrors === 0,
  `All ${EVIDENCE_DATASETS.length} datasets pass lifecycle validation with zero errors (totalErrors: ${allResults.totalErrors})`
);

// Test deliberate invariant failures to ensure validator is effective
const fakePlannedIntegrated: EvidenceDatasetEntry = {
  ...tesSilicates,
  id: "fake_planned_integrated",
  operationalStatus: ["REGISTERED", "PLANNED", "INTEGRATED"],
};
const resFakePlanned = validateDatasetLifecycle(fakePlannedIntegrated);
assert(
  resFakePlanned.valid === false &&
  resFakePlanned.errors.some((e) => e.includes("cannot have both PLANNED and INTEGRATED")),
  "Validator detects conflicting PLANNED + INTEGRATED"
);

const fakeUnavailableIntegrated: EvidenceDatasetEntry = {
  ...tesSilicates,
  id: "fake_unavailable_integrated",
  operationalStatus: ["REGISTERED", "UNAVAILABLE", "INTEGRATED"],
};
const resFakeUnavailable = validateDatasetLifecycle(fakeUnavailableIntegrated);
assert(
  resFakeUnavailable.valid === false &&
  resFakeUnavailable.errors.some((e) => e.includes("cannot have both UNAVAILABLE and INTEGRATED")),
  "Validator detects conflicting UNAVAILABLE + INTEGRATED"
);

const fakeDownloadedUnavailable: EvidenceDatasetEntry = {
  ...tesSilicates,
  id: "ctx_jezero_dtm_20m",
  operationalStatus: ["REGISTERED", "DOWNLOADED", "UNAVAILABLE"],
};
const resFakeDownloadedUnavail = validateDatasetLifecycle(fakeDownloadedUnavailable);
assert(
  resFakeDownloadedUnavail.valid === false &&
  resFakeDownloadedUnavail.errors.some((e) => e.includes("cannot have both DOWNLOADED and UNAVAILABLE")),
  "Validator detects conflicting DOWNLOADED + UNAVAILABLE"
);

const fakeRemoteClaimingDownloaded: EvidenceDatasetEntry = {
  ...tesSilicates,
  id: "mars_themis_night",
  operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
};
const resFakeRemoteDownloaded = validateDatasetLifecycle(fakeRemoteClaimingDownloaded);
assert(
  resFakeRemoteDownloaded.valid === false &&
  resFakeRemoteDownloaded.errors.some((e) => e.includes("does not correspond to verified pre-bundled local files")),
  "Validator detects unverified remote dataset claiming DOWNLOADED"
);

const fakeAvailableFalseIntegrated: EvidenceDatasetEntry = {
  ...tesSilicates,
  id: "fake_unavail_integrated",
  available: false,
  operationalStatus: ["REGISTERED", "INTEGRATED"],
};
const resFakeAvailableFalse = validateDatasetLifecycle(fakeAvailableFalseIntegrated);
assert(
  resFakeAvailableFalse.valid === false &&
  resFakeAvailableFalse.errors.some((e) => e.includes("available=false but includes INTEGRATED")),
  "Validator detects available=false with INTEGRATED"
);

// -------------------------------------------------------------
// TEST SUITE 4: SELECTABLE DATASET COUNTS PER REGION
// -------------------------------------------------------------
console.log("\n4. Preserved Region Filtering Counts:");

const jezeroDatasets = getDatasetsForRegion("jezero-crater");
const galeDatasets = getDatasetsForRegion("gale-crater");
const vallesDatasets = getDatasetsForRegion("valles-marineris");
const olympusDatasets = getDatasetsForRegion("olympus-mons");

console.log(`  Jezero Crater selectable count: ${jezeroDatasets.length} (Expected: 16)`);
console.log(`  Gale Crater selectable count: ${galeDatasets.length} (Expected: 11)`);
console.log(`  Valles Marineris selectable count: ${vallesDatasets.length} (Expected: 10)`);
console.log(`  Olympus Mons selectable count: ${olympusDatasets.length} (Expected: 10)`);

assert(jezeroDatasets.length === 16, "Jezero Crater has exactly 16 selectable datasets");
assert(galeDatasets.length === 11, "Gale Crater has exactly 11 selectable datasets (10 global + 1 in-situ REMS)");
assert(vallesDatasets.length === 10, "Valles Marineris has exactly 10 selectable datasets");
assert(olympusDatasets.length === 10, "Olympus Mons has exactly 10 selectable datasets");

// Verify that all 10 selectable in Valles/Olympus are coverageScope GLOBAL, and Gale has 10 GLOBAL + 1 LOCAL_INSITU
assert(
  galeDatasets.filter((d) => d.coverageScope === "GLOBAL").length === 10 &&
  galeDatasets.some((d) => d.id === "msl_rems_env" && d.coverageScope === "LOCAL_INSITU"),
  "Gale Crater selectable datasets comprise 10 GLOBAL and 1 LOCAL_INSITU (msl_rems_env)"
);
assert(
  vallesDatasets.every((d) => d.coverageScope === "GLOBAL"),
  "All Valles Marineris selectable datasets have coverageScope GLOBAL"
);
assert(
  olympusDatasets.every((d) => d.coverageScope === "GLOBAL"),
  "All Olympus Mons selectable datasets have coverageScope GLOBAL"
);

// -------------------------------------------------------------
// TEST SUITE 5: REGIONAL CAVEATS FOR TES MINERALS ON OLYMPUS MONS
// -------------------------------------------------------------
console.log("\n5. Regional Caveats (Olympus Mons Dust Obscuration):");

const tesMineralIds = ["mars_tes_silicates", "mars_tes_pyroxene", "mars_tes_plagioclase"];

for (const id of tesMineralIds) {
  const entry = EVIDENCE_DATASETS_BY_ID[id];
  assert(
    Boolean(entry.regionalCaveats && entry.regionalCaveats["olympus-mons"]),
    `Dataset '${id}' has regionalCaveats for 'olympus-mons'`
  );

  const caveatText = entry.regionalCaveats!["olympus-mons"];
  assert(
    caveatText.includes("Bandfield") &&
    (caveatText.includes("Ruff & Christensen") || caveatText.includes("Rogers & Christensen")),
    `Dataset '${id}' Olympus Mons caveat cites Bandfield and Ruff/Rogers literature`
  );

  const metaOlympus = resolveDatasetMetadata(id, "olympus-mons");
  assert(
    Boolean(metaOlympus.activeRegionalCaveat && metaOlympus.activeRegionalCaveat === caveatText),
    `resolveDatasetMetadata('${id}', 'olympus-mons') returns activeRegionalCaveat`
  );

  const metaJezero = resolveDatasetMetadata(id, "jezero-crater");
  assert(
    metaJezero.activeRegionalCaveat === undefined,
    `resolveDatasetMetadata('${id}', 'jezero-crater') leaves activeRegionalCaveat undefined`
  );
}

// -------------------------------------------------------------
// FINAL SUMMARY
// -------------------------------------------------------------
console.log("\n=== TEST RUN SUMMARY ===");
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);

if (failedTests > 0) {
  console.error("\n❌ Phase 2.1.2 verification failed!");
  process.exit(1);
} else {
  console.log("\n✅ All Phase 2.1.2 verification checks passed cleanly!");
  process.exit(0);
}

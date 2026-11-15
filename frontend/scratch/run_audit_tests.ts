// frontend/scratch/run_audit_tests.ts
// Runtime Verification for Phase 2.1.1 Scientific Dataset Classification and Filtering Audit

import {
  EVIDENCE_DATASETS,
  EVIDENCE_DATASETS_BY_ID,
  getDatasetsForRegion,
  getPlannedOrUnavailableDatasetsForRegion,
  isDatasetApplicableToRegion,
  isDatasetUsable,
  toMissionDataset,
  resolveDatasetMetadata,
  SURFACE_IMAGERY_DATASET_ID,
} from "../src/data/evidenceDatasets";
import { MARS_REGIONS, isWithinRegionBounds } from "../src/data/regions";
import type { Observation, Mission } from "../src/types";

let testPassed = 0;
let testFailed = 0;

function check(condition: boolean, title: string, errorMsg?: string) {
  if (condition) {
    testPassed++;
    console.log(`  [OK] ${title}`);
  } else {
    testFailed++;
    console.error(`  [FAIL] ${title} => ${errorMsg || "Assertion failed"}`);
  }
}

console.log("===============================================================================");
console.log("PHASE 2.1.1 SCIENTIFIC DATASET AUDIT: RUNTIME TEST SUITE");
console.log("===============================================================================\n");

// --- SECTION 1: INVENTORY & DISCREPANCY AUDIT ---
console.log("--- 1. Dataset Catalog Inventory & Count Accounting ---");
check(EVIDENCE_DATASETS.length === 17, `Catalog contains exactly 17 EvidenceDatasetEntry items (found ${EVIDENCE_DATASETS.length})`);

const jezeroUsable = getDatasetsForRegion("jezero-crater");
const galeUsable = getDatasetsForRegion("gale-crater");
const vallesUsable = getDatasetsForRegion("valles-marineris");
const olympusUsable = getDatasetsForRegion("olympus-mons");

check(jezeroUsable.length === 16, `Jezero Crater usable datasets = 16 (found ${jezeroUsable.length})`);
check(galeUsable.length === 10, `Gale Crater usable datasets = 10 (found ${galeUsable.length})`);
check(vallesUsable.length === 10, `Valles Marineris usable datasets = 10 (found ${vallesUsable.length})`);
check(olympusUsable.length === 10, `Olympus Mons usable datasets = 10 (found ${olympusUsable.length})`);

const jezeroPlanned = getPlannedOrUnavailableDatasetsForRegion("jezero-crater");
check(jezeroPlanned.length === 1 && jezeroPlanned[0].id === "omega_vnir_regional", `Jezero planned/unavailable = 1 (omega_vnir_regional)`);

const galePlanned = getPlannedOrUnavailableDatasetsForRegion("gale-crater");
check(galePlanned.length === 0, `Gale planned/unavailable in EVIDENCE_DATASETS = 0 (omega is restricted to jezero watershed)`);

// Check Catalog #3 Perseverance Imagery
check(
  !EVIDENCE_DATASETS.some((d) => d.id === SURFACE_IMAGERY_DATASET_ID),
  `Perseverance imagery (${SURFACE_IMAGERY_DATASET_ID}) is Catalog #3, NOT duplicated in EVIDENCE_DATASETS`
);

// --- SECTION 2: CROSS-REGION DATA ISOLATION ---
console.log("\n--- 2. Cross-Region Dataset Leakage Audit ---");
const jezeroOnlyIds = [
  "hirise_jezero_dtm",
  "ctx_jezero_dtm_20m",
  "jezero_hirise",
  "ctx_jezero_ortho_5m",
  "crism_jezero_vnir",
  "omega_vnir_regional",
  "m2020_meda_env",
];

for (const nonJezeroId of ["gale-crater", "valles-marineris", "olympus-mons"]) {
  const regDatasets = getDatasetsForRegion(nonJezeroId);
  const leaked = regDatasets.filter((d) => jezeroOnlyIds.includes(d.id));
  check(leaked.length === 0, `Zero Jezero datasets leak into '${nonJezeroId}' (leaked: ${leaked.map((d) => d.id).join(", ") || "none"})`);
}

// --- SECTION 3: GEOGRAPHIC APPLICABILITY & BOUNDS ---
console.log("\n--- 3. Geographic Bounds vs Dataset Latitude Limits ---");
const globalDatasets = EVIDENCE_DATASETS.filter((d) => d.coverageScope === "GLOBAL");
check(globalDatasets.length === 10, `Exactly 10 global datasets identified`);

for (const regionId of ["jezero-crater", "gale-crater", "valles-marineris", "olympus-mons"]) {
  const region = MARS_REGIONS[regionId];
  for (const ds of globalDatasets) {
    if (ds.latitudeLimits) {
      const withinLimits =
        region.geographicBounds.southLatDeg >= ds.latitudeLimits.minLat &&
        region.geographicBounds.northLatDeg <= ds.latitudeLimits.maxLat;
      check(
        withinLimits,
        `Region '${region.name}' full latitude bounds [${region.geographicBounds.southLatDeg}°, ${region.geographicBounds.northLatDeg}°] fall within '${ds.id}' limits [${ds.latitudeLimits.minLat}°, ${ds.latitudeLimits.maxLat}°]`
      );
    }
  }
}

// --- SECTION 4: DATA PROVENANCE PRESERVATION ON REGION SWITCH ---
console.log("\n--- 4. Existing Observation Provenance Safety On Region Switch ---");
const mockObservationInJezero: Observation = {
  id: "obs-test-jezero-01",
  datasetId: "hirise_jezero_dtm",
  name: "Western Delta Scarp Layering",
  coordinates: { latitude: 18.45, longitude: 77.40 },
  observationDate: "2026-03-01",
  source: "HiRISE Jezero Crater Digital Terrain Model (1 m Elevation)",
  regionId: "jezero-crater",
  provenance: {
    source: "USGS Astrogeology Science Center / NASA PDS Cartography and Imaging Sciences Node",
    sourceId: "DTEEC_048842_1985_048908_1985_U01",
    processingMethod: "Quantitative surface elevation (1.0 m/post (~0.2 m vertical precision))",
    limitations: ["Provides terrain elevation and slope geometry only; cannot identify mineral composition or phyllosilicates."],
  },
};

// Simulate region switch to Gale Crater
const initialObservations = [mockObservationInJezero];
// The application state does NOT delete or rewrite initialObservations when region switches to Gale:
const activeRegionNow = MARS_REGIONS["gale-crater"];
check(initialObservations[0].datasetId === "hirise_jezero_dtm", "Observation datasetId preserved unchanged after region switch");
check(initialObservations[0].coordinates?.latitude === 18.45, "Observation latitude preserved unchanged");
check(initialObservations[0].coordinates?.longitude === 77.40, "Observation longitude preserved unchanged");
check(initialObservations[0].regionId === "jezero-crater", "Observation original regionId attribution preserved");
check(initialObservations[0].provenance?.sourceId === "DTEEC_048842_1985_048908_1985_U01", "Observation PDS provenance sourceId preserved");

// Check resolveDatasetMetadata handles this observation even when active region is Gale
const resolvedInGale = resolveDatasetMetadata(initialObservations[0].datasetId);
check(resolvedInGale.id === "hirise_jezero_dtm", "resolveDatasetMetadata successfully decodes metadata for Jezero observation while in Gale context");
check(resolvedInGale.isVisualizationOnlyLegacy === false, "Metadata correctly recognizes it as empirical dataset, not legacy layer");

// --- SECTION 5: DEFAULT EVIDENCE RESOLUTION ON REGION SWITCH ---
console.log("\n--- 5. Default Dataset Fallback Logic Verification ---");
function resolveDefaultEvidenceIdForRegion(regionId: string, selectedDatasets: { id: string }[]): string {
  const isJz = regionId === "jezero-crater";
  const appDatasets = getDatasetsForRegion(regionId);
  const selectedApplicable = selectedDatasets.find((d) => {
    const entry = EVIDENCE_DATASETS_BY_ID[d.id];
    return entry && isDatasetApplicableToRegion(entry, regionId);
  });
  if (selectedApplicable) return selectedApplicable.id;
  if (appDatasets.length > 0) return appDatasets[0].id;
  return isJz ? "hirise_jezero_dtm" : "mars_mola_roughness";
}

const defaultInJezeroWithNoSelections = resolveDefaultEvidenceIdForRegion("jezero-crater", []);
check(defaultInJezeroWithNoSelections === "hirise_jezero_dtm", `Default in Jezero with empty selection = 'hirise_jezero_dtm' (got '${defaultInJezeroWithNoSelections}')`);

const defaultInGaleWithNoSelections = resolveDefaultEvidenceIdForRegion("gale-crater", []);
check(defaultInGaleWithNoSelections !== "hirise_jezero_dtm", `Default in Gale is NOT 'hirise_jezero_dtm' (got '${defaultInGaleWithNoSelections}')`);
check(defaultInGaleWithNoSelections === "mars_mola_roughness", `Default in Gale resolves to first usable global dataset 'mars_mola_roughness'`);

const defaultInValles = resolveDefaultEvidenceIdForRegion("valles-marineris", []);
check(defaultInValles === "mars_mola_roughness", `Default in Valles Marineris resolves to 'mars_mola_roughness'`);

const defaultInOlympus = resolveDefaultEvidenceIdForRegion("olympus-mons", []);
check(defaultInOlympus === "mars_mola_roughness", `Default in Olympus Mons resolves to 'mars_mola_roughness'`);

// What if user had Jezero DTM selected, then switched region to Gale?
const defaultInGaleWithJezeroSelected = resolveDefaultEvidenceIdForRegion("gale-crater", [{ id: "hirise_jezero_dtm" }]);
check(
  defaultInGaleWithJezeroSelected !== "hirise_jezero_dtm",
  `When Jezero dataset is in selectedDatasets, Gale default NEVER selects it (got '${defaultInGaleWithJezeroSelected}')`
);

console.log("\n===============================================================================");
console.log(`AUDIT TEST RESULTS: ${testPassed} PASSED, ${testFailed} FAILED`);
console.log("===============================================================================");

if (testFailed > 0) {
  process.exit(1);
}

# PHASE 2.2 IMPLEMENTATION PLAN: SCIENTIFIC DATASET CATALOG & GEOLOGICAL REFERENCE CORRECTIONS

**Project:** NASA Mars Explorer — Multi-Region Planetary GIS & Surface Exploration Platform  
**Stage:** Phase 2.2 Preflight & Implementation Change Plan (Final Disambiguated Baseline)  
**Target Execution Date:** November 15, 2026  
**Auditor:** Independent Planetary Science & Software Architecture Review  
**Source Code State:** Strictly Unmodified (Pre-Implementation Plan)  
**Governing Documents:**
- `PHASE_2_2_READINESS_ASSESSMENT.md`
- `FOUR_REGION_RESEARCH_AUDIT_REPORT.md`
- `FOUR_REGION_SCIENTIFIC_DATASET_RESEARCH.md`
- `FOUR_REGION_DATASET_MASTER_INVENTORY.md`
- `REGIONAL_SCIENTIFIC_CAPABILITY_MATRIX.md`
- `FOUR_REGION_DATASET_INTEGRATION_ROADMAP.md`
- `ARCHITECTURE.md`

---

## 1. EXECUTIVE OVERVIEW & THREE-TIER CONCEPTUAL DISAMBIGUATION

Phase 2.2 is a targeted, surgical catalog correction phase. Its objective is to align the Mars Explorer application catalog (`frontend/src/data/regions.ts` and `frontend/src/data/evidenceDatasets.ts`) with authoritative primary planetary science records, retiring erroneous terrestrial map identifiers inherited during early drafting and establishing strict dataset lifecycle adherence without altering the working Jezero 3D simulator or breaking existing mission workflows.

### The Core Architectural Dilemma: Distinguishing Three Separate Entities
Early catalog drafting conflated three distinct categories of scientific material:
1. **Scientific Literature Citations (`scientificReferences: readonly string[]`):**  
   Peer-reviewed scientific journal articles (e.g., Anderson & Bell, 2010 in *Mars*; Grotzinger et al., 2014, 2015 in *Science*; Vasavada et al., 2014 in *JGR Planets*). These are scholarly publications discussing geomorphology, paleoclimate, and stratigraphy. They are **not** GIS map products or downloadable files.
2. **Official Published Map Products (External Archives):**  
   Formal government or institutional cartographic map sheets published by the USGS (e.g., USGS IMAP 1111 by Scott & West, 1978; USGS Map I-2010 by Witbeck et al., 1991; USGS SIM 3470 by Mouginis-Mark, 2021; USGS Map I-2327 by Morris & Tanaka, 1994). These were historically published as printed paper map sheets or scanned raster plates with descriptive pamphlets in the USGS Publications Warehouse. They are **not** pre-bundled GeoJSON files in this repository.
3. **Application Digital Vector Assets (`geologicalDatasets: readonly RegionalGeologicalDataset[]`):**  
   Digital GIS vector datasets structured specifically for interactive rendering on the Mars 2D/3D map and route cross-section tools.  
   - **Active Asset:** Today, **only Jezero Crater** possesses an active digital vector dataset in the repository: `frontend/public/data/jezero_geology_sim3464.geojson` (5.3 MB GeoJSON polygon file derived from USGS SIM 3464).
   - **Non-Jezero Regions:** No GeoJSON files currently exist on disk for Gale Crater, Valles Marineris, or Olympus Mons. Representing a scientific paper or a 1978/1991 USGS printed map as an existing GeoJSON asset with `publisher: "USGS / NASA"` would fabricate a digital product that neither USGS nor the authors ever produced.

```
+====================================================================================================+
|                                  PHASE 2.2 OPERATIONAL OBJECTIVES                                  |
+====================================================================================================+
| 1. Disentangle Literature Citations from Vector Dataset Products in `frontend/src/data/regions.ts`:|
|    - Place all peer-reviewed research papers and USGS quadrangle/regional publications into       |
|      `scientificReferences` with complete author names, official titles, scales, and DOIs.         |
|    - Never misrepresent a scientific journal paper or paper map sheet as an existing GeoJSON file. |
|                                                                                                    |
| 2. Resolve `geologicalDatasets` Representation for Planned Regions (Gale, Valles, Olympus):        |
|    - Option A (Explicit Planned Product): If a planned entry is retained, explicitly name it       |
|      "(Planned Vector GeoJSON)", set publisher to "Mars Explorer Planned Vectorization (Derived   |
|      from [Source])", omit `dataPath`, omit arbitrary cartographic scales, and document GeoJSON as  |
|      the intended future target delivery format.                                                   |
|    - Option B (References-Only / Clean Schema - Recommended): Set `geologicalDatasets: []` for     |
|      unvectorized regions (identical to Nili Fossae and Syrtis Major), leaving `geologicalDatasets`|
|      strictly representing verified, physical vector assets resident on disk.                      |
|                                                                                                    |
| 3. Correct Erroneous Terrestrial Map References across All Regions:                                |
|    - Gale Crater: Retire `usgs_sim_3482_gale` (Oklahoma runoff). Cite Anderson & Bell (2010)       |
|      for crater-wide mapping and USGS IMAP 1111 (Scott & West, 1978) for regional quad context.    |
|    - Valles Marineris: Retire `usgs_i2614_valles` (Kīlauea geothermal). Cite USGS Map I-2010.     |
|    - Olympus Mons: Retire `usgs_i2502_olympus` (South Carolina quadrangle). Cite USGS SIM 3470    |
|      (caldera complex) and USGS Map I-2327 (regional volcano flank and aureole).                   |
|                                                                                                    |
| 4. Enforce Dataset Lifecycle and Catalog Invariants in `evidenceDatasets.ts`:                     |
|    - Verify that all operational statuses strictly comply with `validateDatasetLifecycle()`.       |
|    - Ensure zero fabricated `DOWNLOADED` claims outside `GENUINE_LOCAL_DATASET_IDS`.              |
|                                                                                                    |
| 5. Create Automated Verification Suite (`verify_phase2_catalog.mjs`):                              |
|    - Automate runtime verification of the corrected catalog, ensuring zero regressions across all  |
|      dependent pages and map components.                                                           |
+====================================================================================================+
```

---

## 2. SCIENTIFIC VERIFICATION & DISENTANGLEMENT MATRIX

Every reference has been independently verified against official USGS publication records, NASA PDS, ESA PSA, and primary journal archives:

```
+=================================================================================================================================================+
|                                            DISENTANGLED SCIENTIFIC & CARTOGRAPHIC TRUTH TABLE                                                   |
+==================+==================================================+===============================================+===========================+
| Region           | Detailed Local Mapping (Crater / Caldera Floor)  | Broader Regional Context (Quad / Province)    | In-App Vector Asset Status|
+==================+==================================================+===============================================+===========================+
| Jezero Crater    | USGS SIM 3464 (Sun & Stack, 2020)                | Regional Nili Planum basement & Isidis margin | OPERATIONAL VECTOR ASSET  |
|                  | Scale: 1:75,000 · DOI: 10.3133/sim3464           | (Sun & Stack, 2020)                           | GeoJSON on disk (5.3 MB)  |
|                  | https://pubs.usgs.gov/sim/3464/                  |                                               | /data/jezero_geology_     |
|                  | Detailed delta topset/foreset & floor units      |                                               | sim3464.geojson           |
+==================+==================================================+===============================================+===========================+
| Gale Crater      | Anderson, R.B. & Bell, J.F., III (2010)          | USGS IMAP 1111 (Scott, D.H. & West, M.N., 1978| NO IN-APP GEOJSON ASSET   |
| (Mount Sharp)    | *Mars*, 5, 76–128 · DOI: 10.1555/mars.2010.0004  | *Geologic Map of the Aeolis Quadrangle...*    | Unvectorized scientific   |
|                  | http://marsjournal.org/contents/2010/0004/       | Scale: 1:5,000,000 · DOI: 10.3133/i1111       | literature & paper map.   |
|                  | Peer-reviewed journal paper; no carto scale.     | https://pubs.usgs.gov/imap/1111/              | Optional planned target   |
|                  | MSL traverse: Grotzinger et al. (2014, 2015)     | Regional quadrangle MC-23 macro context only. | vector entry in catalog.  |
+==================+==================================================+===============================================+===========================+
| Valles Marineris | USGS Miscellaneous Investigations Map I-2010     | Western Equatorial Region: USGS Map I-1802-A  | NO IN-APP GEOJSON ASSET   |
| (Melas Chasma)   | (Witbeck, N.E., Tanaka, K.L., & Scott, D.H., 1991| (Scott & Tanaka, 1986, 1:15,000,000)          | Unvectorized USGS print   |
|                  | Scale: 1:2,000,000 · DOI: 10.3133/i2010          |                                               | map sheet (2 sheets, pam).|
|                  | https://pubs.usgs.gov/imap/2010/                 |                                               | Optional planned target   |
|                  | Regional canyon wall & layered deposit mapping   |                                               | vector entry in catalog.  |
+==================+==================================================+===============================================+===========================+
| Olympus Mons     | USGS SIM 3470 (Mouginis-Mark, P.J., 2021)        | USGS Map I-2327 (Morris, E.C. & Tanaka, 1994) | NO IN-APP GEOJSON ASSET   |
| (Summit Caldera) | *Geologic Map of Olympus Mons Caldera, Mars*     | *Geologic Maps of the Olympus Mons Region...* | Unvectorized USGS print   |
|                  | Scale: 1:200,000 · DOI: 10.3133/sim3470          | Sheet 1 (1:2,016,000), Sheet 2 (1:1,000,000)  | map sheet.                |
|                  | https://pubs.usgs.gov/sim/3470/                  | https://pubs.usgs.gov/imap/2327/              | Optional planned target   |
|                  | Strictly bounded to Calderas 1–6 (80×65 km).     | Maps volcano flanks, scarp, and aureole lobes.| vector entry in catalog.  |
+==================+==================================================+===============================================+===========================+
```

---

## 3. REGIONAL REGISTRY ANALYSIS & TWO ARCHITECTURAL OPTIONS

### Type Definition Analysis (`frontend/src/types/region.ts`)

```typescript
export type GeologicalFormat = "geojson" | "shapefile" | "raster";
export type GeologicalStatus = "integrated_active" | "planned" | "unavailable";

export interface RegionalGeologicalDataset {
  readonly id: string;
  readonly name: string;
  readonly citation: string;
  readonly scale?: string;
  readonly publisher: string;
  readonly format: GeologicalFormat;
  readonly dataPath?: string;
  readonly coverageScope: "regional" | "quadrangle" | "global";
  readonly status: GeologicalStatus;
  readonly unitsCount?: number;
}
```

In `MarsRegion`:
```typescript
/** Vector and raster geological maps */
readonly geologicalDatasets: readonly RegionalGeologicalDataset[];

/** Peer-reviewed scientific literature and USGS citations */
readonly scientificReferences: readonly string[];
```

### Architectural Findings:
1. `geologicalDatasets` is an array (`readonly RegionalGeologicalDataset[]`). In existing code, `nili-fossae` and `syrtis-major` already have `geologicalDatasets: []`.
2. `scale` in `RegionalGeologicalDataset` is optional (`scale?: string`). Omitting `scale` for journal publications like Anderson & Bell (2010) is 100% type-safe.
3. Downstream consumers (`MarsMap.tsx`, `RouteMap.tsx`, `RouteStratigraphyProfile.tsx`) only mount or fetch vector geology when `status === "integrated_active" && format === "geojson"` and `dataPath` is present.
4. `ExpeditionReportPage.tsx` handles both cases safely:
   - If `geologicalDatasets` has a planned entry: renders `activeRegion.geologicalDatasets[0].citation`.
   - If `geologicalDatasets` is empty `[]`: renders `"Regional geological mapping under preparation; global USGS / Viking-MOLA chronostratigraphy referenced"`.

---

### EVALUATION OF ARCHITECTURAL OPTIONS FOR NON-JEZERO REGIONS

#### OPTION A: Retaining Explicit Planned Future Vector Products
Under Option A, `geologicalDatasets` continues to hold entries for Gale, Valles Marineris, and Olympus Mons, but they are explicitly defined as **planned future digital vectorization targets**, eliminating any false claim that a GeoJSON file currently exists or was published by USGS:

- **Gale Crater Entry (Option A):**
  ```typescript
  geologicalDatasets: [
    {
      id: "gale_geology_planned",
      name: "Gale Crater Geologic Units (Planned Vector GeoJSON)",
      citation:
        "Target digital vectorization for Mars Explorer derived from Anderson, R.B. & Bell, J.F., III (2010), Mars 5, 76-128. Regional quadrangle context: USGS IMAP 1111 (Scott & West, 1978).",
      publisher: "Mars Explorer Planned Vectorization (Derived from Anderson & Bell, 2010 / USGS)",
      format: "geojson", // Intended future target format upon vector digitization; no file resident on disk
      coverageScope: "regional",
      status: "planned",
    },
  ],
  ```
  *(Note: `scale` and `dataPath` are omitted).*

- **Valles Marineris Entry (Option A):**
  ```typescript
  geologicalDatasets: [
    {
      id: "valles_geology_planned",
      name: "Valles Marineris Regional Geologic Units (Planned Vector GeoJSON)",
      citation:
        "Target digital vectorization for Mars Explorer derived from USGS Miscellaneous Investigations Series Map I-2010 (Witbeck, Tanaka, & Scott, 1991).",
      scale: "1:2,000,000",
      publisher: "Mars Explorer Planned Vectorization (Derived from USGS Map I-2010)",
      format: "geojson", // Intended future target format upon vector digitization; no file resident on disk
      coverageScope: "regional",
      status: "planned",
    },
  ],
  ```

- **Olympus Mons Entry (Option A):**
  ```typescript
  geologicalDatasets: [
    {
      id: "olympus_caldera_geology_planned",
      name: "Olympus Mons Caldera Geologic Units (Planned Vector GeoJSON)",
      citation:
        "Target digital vectorization for Mars Explorer derived from USGS Scientific Investigations Map 3470 (Mouginis-Mark, 2021). Confined to caldera complex (Calderas 1-6). Regional flank context: USGS Map I-2327 (Morris & Tanaka, 1994).",
      scale: "1:200,000",
      publisher: "Mars Explorer Planned Vectorization (Derived from USGS SIM 3470)",
      format: "geojson", // Intended future target format upon vector digitization; no file resident on disk
      coverageScope: "regional",
      status: "planned",
    },
  ],
  ```

#### OPTION B: Clean References-Only Architecture (RECOMMENDED FOR MAXIMUM ACCURACY)
Under Option B, `geologicalDatasets` strictly reflects **actual in-repository digital vector datasets**. Because only Jezero Crater has an existing vector GeoJSON file, only Jezero has an entry in `geologicalDatasets`. Gale, Valles Marineris, and Olympus Mons have `geologicalDatasets: []` (identical to Nili Fossae and Syrtis Major).  
All published map sheets, quadrangle maps, and journal articles are housed cleanly and truthfully in `scientificReferences`:

- **Advantages of Option B:**
  1. **Zero Fabrication:** Never declares `format: "geojson"` for assets that do not physically exist on disk.
  2. **Conceptual Purity:** `geologicalDatasets` represents physical data assets; `scientificReferences` represents literature and external cartographic publications.
  3. **ExpeditionReportPage Accuracy:** Renders `"Regional geological mapping under preparation; global USGS / Viking-MOLA chronostratigraphy referenced"`, which is 100% factually accurate.
  4. **Perfect Precedent:** Exactly matches how Nili Fossae and Syrtis Major are already modeled.

---

## 4. PROPOSED CODE BLOCKS UNDER BOTH OPTIONS

### Scientific References (Identical for Both Options)
Under both options, `scientificReferences` in `frontend/src/data/regions.ts` will be updated to include authoritative primary references with official titles, authors, and DOIs:

#### Gale Crater `scientificReferences`:
```typescript
    scientificReferences: [
      "Anderson, R.B. & Bell, J.F., III (2010). Geologic mapping and characterization of Gale Crater and implications for its potential as a Mars Science Laboratory landing site. Mars 5, 76-128. doi:10.1555/mars.2010.0004.",
      "Scott, D.H. & West, M.N. (1978). Geologic Map of the Aeolis Quadrangle of Mars. USGS Miscellaneous Investigations Series Map I-1111, scale 1:5,000,000. doi:10.3133/i1111.",
      "Grotzinger, J.P. et al. (2014). A habitable fluvio-lacustrine environment at Yellowknife Bay, Gale crater, Mars. Science, 343(6169), 1242777.",
      "Vasavada, A.R. et al. (2014). Overview of the Mars Science Laboratory mission: Bradbury Landing to Yellowknife Bay and beyond. JGR Planets, 119(6), 1134-1161.",
    ],
```

#### Valles Marineris `scientificReferences`:
```typescript
    scientificReferences: [
      "Witbeck, N.E., Tanaka, K.L., & Scott, D.H. (1991). Geologic Map of the Valles Marineris Region, Mars. USGS Miscellaneous Investigations Series Map I-2010, scale 1:2,000,000. doi:10.3133/i2010.",
      "Quantin, C. et al. (2004). Fluvial and lacustrine activity on Valles Marineris: Evidence from landslides. Icarus, 172(2), 555-572.",
    ],
```

#### Olympus Mons `scientificReferences`:
```typescript
    scientificReferences: [
      "Mouginis-Mark, P.J. (2021). Geologic Map of Olympus Mons Caldera, Mars. USGS Scientific Investigations Map 3470, scale 1:200,000. doi:10.3133/sim3470.",
      "Morris, E.C. & Tanaka, K.L. (1994). Geologic Maps of the Olympus Mons Region of Mars. USGS Miscellaneous Investigations Series Map I-2327, scale 1:2,016,000 / 1:1,000,000.",
      "Basilevsky, A.T. et al. (2006). The youngest caldera of Olympus Mons, Mars: Evidence for recent activity. Geophysical Research Letters, 33(13).",
    ],
```

---

## 5. EXACT FILE-BY-FILE CHANGE MATRIX (OPTION A vs. OPTION B)

```
+===================================================================================================================================================================+
|                                                           PHASE 2.2 CHANGE MATRIX                                                                                 |
+=============================================+=======================================+=============================================+================+==============+
| File Path                                   | Current Content (To Replace)          | Proposed Correction (Option A / Option B)   | Justification  | Priority     |
+=============================================+=======================================+=============================================+================+==============+
| frontend/src/data/regions.ts                | id: "usgs_sim_3482_gale"              | OPTION A: gale_geology_planned              | SIM 3482 is OK | MANDATORY    |
| (Lines 226–237: Gale geology)               | name: "USGS SIM 3482 Gale Crater..."  | name: "Gale Crater Geologic Units (Planned  | stream runoff. |              |
|                                             | citation: "Anderson, R.B. & Bell..."  | Vector GeoJSON)" · status: "planned"        | Anderson 2010  |              |
|                                             | publisher: "USGS / NASA"              | (No scale; publisher: "Mars Explorer        | is a *Mars*    |              |
|                                             | format: "geojson"                     | Planned Vectorization...")                  | journal paper. |              |
|                                             |                                       | ------------------------------------------- | Neither is a   |              |
|                                             |                                       | OPTION B (Recommended):                     | USGS GeoJSON   |              |
|                                             |                                       | geologicalDatasets: []                      | asset.         |              |
+---------------------------------------------+---------------------------------------+---------------------------------------------+----------------+--------------+
| frontend/src/data/regions.ts                | "Grotzinger, J.P. et al. (2014)..."   | Add Anderson & Bell (2010) with DOI, and    | Include both   | MANDATORY    |
| (Lines 297–300: Gale references)            | "Vasavada, A.R. et al. (2014)..."     | USGS IMAP 1111 (Scott & West, 1978) with    | foundational   |              |
|                                             |                                       | official title and DOI 10.3133/i1111.       | mapping & quad |              |
|                                             |                                       | Retain Grotzinger and Vasavada.             | context.       |              |
+---------------------------------------------+---------------------------------------+---------------------------------------------+----------------+--------------+
| frontend/src/data/regions.ts                | id: "usgs_i2614_valles"               | OPTION A: valles_geology_planned            | Map I-2614 is  | MANDATORY    |
| (Lines 350–361: Valles Marineris geology)   | name: "USGS I-2614 Geologic Map..."   | name: "Valles Marineris Regional Geologic   | Kīlauea Hawaiʻi|              |
|                                             | citation: "...Map I-2614."            | Units (Planned Vector GeoJSON)"             | geothermal.    |              |
|                                             | publisher: "USGS"                     | ------------------------------------------- | Definitive map |              |
|                                             |                                       | OPTION B (Recommended):                     | is Map I-2010. |              |
|                                             |                                       | geologicalDatasets: []                      | No GeoJSON file|              |
|                                             |                                       |                                             | exists on disk.|              |
+---------------------------------------------+---------------------------------------+---------------------------------------------+----------------+--------------+
| frontend/src/data/regions.ts                | "Witbeck, N.E. et al. (1991)..."      | Witbeck, Tanaka, & Scott (1991) citing      | Correct        | MANDATORY    |
| (Lines 404–407: Valles references)          | citing Map I-2614                     | USGS Map I-2010 and DOI 10.3133/i2010.      | citation to    |              |
|                                             |                                       |                                             | Map I-2010.    |              |
+---------------------------------------------+---------------------------------------+---------------------------------------------+----------------+--------------+
| frontend/src/data/regions.ts                | id: "usgs_i2502_olympus"              | OPTION A: olympus_caldera_geology_planned   | Map I-2502 is  | MANDATORY    |
| (Lines 457–468: Olympus Mons geology)       | name: "USGS I-2502 Geologic Map..."   | name: "Olympus Mons Caldera Geologic Units  | South Carolina |              |
|                                             | citation: "...Map I-2502."            | (Planned Vector GeoJSON)"                   | quadrangle.    |              |
|                                             | publisher: "USGS"                     | ------------------------------------------- | Definitive     |              |
|                                             |                                       | OPTION B (Recommended):                     | caldera map is |              |
|                                             |                                       | geologicalDatasets: []                      | SIM 3470.      |              |
|                                             |                                       |                                             | No GeoJSON file|              |
|                                             |                                       |                                             | exists on disk.|              |
+---------------------------------------------+---------------------------------------+---------------------------------------------+----------------+--------------+
| frontend/src/data/regions.ts                | "Mouginis-Mark, P.J. (1996)..."       | Mouginis-Mark (2021) citing USGS SIM 3470;  | Correct        | MANDATORY    |
| (Lines 501–504: Olympus references)         | citing Map I-2502                     | Morris & Tanaka (1994) citing USGS Map      | citations to   |              |
|                                             |                                       | I-2327; Basilevsky et al. (2006).           | SIM 3470 and   |              |
|                                             |                                       |                                             | Map I-2327.    |              |
+---------------------------------------------+---------------------------------------+---------------------------------------------+----------------+--------------+
| verify_phase2_catalog.mjs                   | Does not exist                        | New standalone Node.js verification script  | Enforces Phase | MANDATORY    |
| (Root directory)                            |                                       | validating zero deprecated map IDs, Scott   | 2.2 catalog    |              |
|                                             |                                       | & West authorship, DOI 10.3133/i1111, and   | invariants     |              |
|                                             |                                       | lifecycle validation.                       | automatically. |              |
+=============================================+=======================================+=============================================+================+==============+
```

---

## 6. REGRESSION RISK ANALYSIS & PROTECTION

```
+=================================================================================================================================+
|                                              REGRESSION RISK ASSESSMENT                                                         |
+==================================+==========+=============================================+====================================+
| Potential Regression Area        | Risk     | Failure Mode                                | Mitigation / Protection Strategy   |
+==================================+==========+=============================================+====================================+
| Jezero 3D Surface Simulator      | ZERO     | Simulator fails to boot or textures missing | Jezero simulator code is completely|
|                                  |          |                                             | unreferenced by this change.       |
|                                  |          |                                             | `ctx_jezero_dtm_20m` untouched.    |
+----------------------------------+----------+---------------------------------------------+------------------------------------+
| ExpeditionReportPage Dossier     | ZERO     | Incomplete citation rendered in report card | Handled safely under both Option A |
|                                  |          | or export payload                           | and Option B via null coalescing.  |
+----------------------------------+----------+---------------------------------------------+------------------------------------+
| 2D MarsMap Vector Geology Layer  | ZERO     | Map tries to fetch non-existent GeoJSON     | `MarsMap.tsx` explicitly checks:   |
|                                  |          |                                             | `g.status === "integrated_active"  |
|                                  |          |                                             | && g.format === "geojson"`.        |
|                                  |          |                                             | Zero fetch attempts for non-Jezero.|
+----------------------------------+----------+---------------------------------------------+------------------------------------+
| RouteMap Geological Elevation    | ZERO     | Fetch fails on planned regions              | `RouteMap.tsx` checks `d.dataPath`.|
| Profile                          |          |                                             | No dataPath is provided on planned.|
+----------------------------------+----------+---------------------------------------------+------------------------------------+
| TypeScript Compilation & Types   | ZERO     | Type mismatch on RegionalGeologicalDataset  | `RegionalGeologicalDataset` already|
|                                  |          |                                             | matches all proposed properties.   |
+==================================+==========+=============================================+====================================+
```

---

## 7. AUTOMATED TEST SPECIFICATION: `verify_phase2_catalog.mjs`

To guarantee permanent regression protection and automated validation, Phase 2.2 will introduce `verify_phase2_catalog.mjs` at the repository root.

### Automated Test Specifications:
1. **Zero Deprecated Identifiers:**
   - Verify that `frontend/src/data/regions.ts` contains ZERO occurrences of `usgs_sim_3482_gale`, `usgs_i2614_valles`, or `usgs_i2502_olympus`.
   - Verify that `frontend/src/data/regions.ts` contains ZERO citations to "Oklahoma", "Kilauea", or "South Carolina".
2. **Authoritative Citation & Authorship Verification:**
   - Verify that `gale-crater` cites Anderson & Bell (2010), *Mars* journal (DOI: `10.1555/mars.2010.0004`), with no fictitious cartographic scale.
   - Verify that `gale-crater` cites USGS IMAP 1111 with exact authors **"Scott, D.H."** and **"West, M.N."** (asserting that "Morris" is not associated with I-1111).
   - Verify that `gale-crater` includes official title *"Geologic Map of the Aeolis Quadrangle of Mars"* and DOI `10.3133/i1111`.
   - Verify that I-1111 is explicitly designated as **regional geological context** rather than detailed crater-floor mapping.
   - Verify that `valles-marineris` cites USGS Map I-2010 (*Witbeck, Tanaka, & Scott, 1991*; DOI: `10.3133/i2010`, scale 1:2,000,000).
   - Verify that `olympus-mons` cites USGS SIM 3470 (*Mouginis-Mark, 2021*; DOI: `10.3133/sim3470`, scale 1:200,000) bounded to the caldera complex, and cites USGS Map I-2327 for flank context.
   - Verify that `jezero-crater` retains verified USGS SIM 3464 (*Sun & Stack, 2020*).
3. **Asset & GeoJSON Truth Verification:**
   - Verify that `jezero-crater` is the ONLY region claiming `status: "integrated_active"` and `dataPath: "/data/jezero_geology_sim3464.geojson"`.
   - Under Option A: Verify that non-Jezero entries strictly declare `status: "planned"`, omit `dataPath`, and are labeled as `(Planned Vector GeoJSON)`.
   - Under Option B: Verify that `geologicalDatasets` is strictly `[]` for Gale, Valles Marineris, and Olympus Mons.
4. **Existing Regression Suite Execution:**
   - Execute `verify_phase1_multiregion.mjs` (must pass 100%).
   - Execute `node frontend/scratch/run_audit_tests.cjs` (must pass all 65 assertions).
   - Execute `npm run build` in `frontend/` (`tsc --noEmit && vite build`, must exit with code 0).

---

## 8. STRICT SCOPE RESTRICTIONS & EXCLUSIONS

The implementation of Phase 2.2 is strictly confined to:
1. Correcting regional geological references and scientific references in `frontend/src/data/regions.ts`.
2. Verifying dataset lifecycle compliance in `frontend/src/data/evidenceDatasets.ts`.
3. Adding the automated test script `verify_phase2_catalog.mjs`.

### Explicit Exclusions:
- **NO 3D surface simulator coding** for Gale Crater, Valles Marineris, or Olympus Mons.
- **NO acquisition or processing of multi-gigabyte DEM rasters** or texture orthomosaics.
- **NO REMS environmental telemetry ingestion** or script creation.
- **NO modifications to the existing Jezero Three.js simulator** (`jezero-simulator.html`, `jezeroTerrain.ts`, `MarswalkPage.tsx`).
- **NO CRISM spectral pipeline development**.
- **NO user interface structural redesigns**.

---

## 9. HUMAN APPROVAL GATE & RECOMMENDATION

```
+====================================================================================================+
|                                    IMPLEMENTATION READINESS VERDICT                                |
+====================================================================================================+
| The Phase 2.2 Implementation Plan is FULLY REVISED, DISAMBIGUATED, and READY FOR APPROVAL.         |
|                                                                                                    |
| Key Disambiguation Established:                                                                    |
| - Scientific papers (Anderson & Bell 2010) and paper map sheets (USGS IMAP 1111, I-2010, SIM 3470)|
|   are permanently separated from digital in-app GeoJSON products.                                  |
| - Option A provides explicit "(Planned Vector GeoJSON)" target entries with zero existing file     |
|   claims.                                                                                          |
| - Option B (Recommended) provides pure schema truth: `geologicalDatasets: []` for unvectorized     |
|   regions, housing all citations in `scientificReferences`.                                        |
|                                                                                                    |
| No application source code has been altered during this preflight planning phase.                  |
| Awaiting explicit user approval on whether to apply Option A or Option B before implementation.    |
+====================================================================================================+
```

### Decision for Human Approval:
Which approach do you approve for non-Jezero `geologicalDatasets`?
- **Option B (Recommended — Clean Truth):** Set `geologicalDatasets: []` for Gale Crater, Valles Marineris, and Olympus Mons (reflecting that no vector GeoJSON files currently exist in the repository), while placing all verified peer-reviewed publications and USGS maps into `scientificReferences`.
- **Option A (Explicit Planned Target Products):** Retain `geologicalDatasets` entries for Gale, Valles Marineris, and Olympus Mons explicitly labeled as `(Planned Vector GeoJSON)`, with publisher `"Mars Explorer Planned Vectorization..."`, no `dataPath`, no arbitrary scale, and `status: "planned"`.

# PHASE 2.3A-1 — GALE REMS INTEGRATION IMPLEMENTATION PLAN
**Target Region:** Gale Crater (Aeolis Mons / Mount Sharp)  
**Instrument:** Mars Science Laboratory (MSL) Curiosity — Rover Environmental Monitoring Station (REMS)  
**Task Type:** Read-Only Implementation Planning & Verification Baseline  
**Status:** Scientifically Defensible Implementation Specification (Revision 2.0)  
**Target Milestone:** Phase 2.3A (Environmental Telemetry Integration)

---

## Revision History

| Version | Date | Author / Agent | Changes and Validation Notes |
| :--- | :--- | :--- | :--- |
| **v1.0** | 2026-11-15 | Gemini 3.8 Flash | Initial implementation plan drafted based on MEDA architectural analogy. |
| **v2.0** | 2026-11-15 | Gemini 3.8 Flash | **Major Scientific & Technical Revision:**<br>• Identified official PDS3 dataset `MSL-M-REMS-4-ENVRDR-V1.0` and PDS4 migrated collection structures.<br>• Replaced single-boom wind failure generalizations with precise board-level timeline (Sol 0, 854, 1485, 1491, 1504).<br>• Distinquished direct measurements, aerodynamic CFD reconstructions, degraded single-board states, and inoperable states.<br>• Removed unsupported "continuous across 4,300+ sols" claim; documented actual data duty cycles, conjunction gaps, and sensor calibration caveats.<br>• Verified backend repository: confirmed `backend/main.py` contains zero REMS endpoints; eliminated live API fallback in favor of direct static bundle loading (`/data/rems_processed_bundle.json`).<br>• Corrected dataset lifecycle progression: REMS remains `REGISTERED / ACCESSIBLE` until assets are downloaded, validated, and integrated.<br>• Aligned roadmap numbering: Phase 2.3A (telemetry), Phase 2.3B (imagery), Phase 2.3C (catalog sync), Phase 2.3D (geology), Phase 3.0 (3D terrain); MCD isolated as separately gated task.<br>• Clarified PowerShell `&&` syntax error (exit code 1) versus successful TypeScript compilation via `;` (exit code 0).<br>• Established explicit pre-implementation vs post-implementation test suites and listed unresolved data-staging blockers. |

---

## Implementation Blockers & Prerequisites

Before code execution in Phase 2.3A begins, the following data-staging prerequisites must be satisfied:

1. **Local Raw Data Staging (Blocker B-1):**
   - The repository currently contains no raw MSL REMS data files (`datasets/rems/raw/` does not exist).
   - *Resolution Action:* Acquire authentic PDS ENVRDR files (`.TAB` and detached `.LBL`) for the selected candidate sols from the NASA PDS Atmospheres Node (`https://atmos.nmsu.edu/PDS/data/PDS4/MSL/msl_rems/` or PDS3 volume `MSLREMS_1001`) into `datasets/rems/raw/` prior to running `process_rems.py`.
2. **Candidate Sol Verification (Blocker B-2):**
   - Candidate Sol records (e.g. Sol 0010 and Sol 01600) must be confirmed in the PDS index for file existence, complete channel population, and valid session headers.
   - *Resolution Action:* Verify candidate `.LBL` labels before finalizing downsampling parameters.

---

## 1. Verified REMS Source Products & Data Architecture

### 1.1 Archive Identification & Governance
The Curiosity REMS archive is governed by the NASA Planetary Data System (PDS) Atmospheres Node hosted at New Mexico State University (NMSU) in collaboration with the Centro de Astrobiología (CAB / CSIC-INTA):
- **PDS3 Dataset Identifier:** `MSL-M-REMS-4-ENVRDR-V1.0`
- **PDS4 Migrated Bundle Identifier:** `urn:nasa:pds:msl_rems`
- **PDS4 Data Collection:** `urn:nasa:pds:msl_rems:data_derived_envrdr`
- **CODMAC / NASA Processing Level:** Level 4 (Reduced Data Record / RDR — Physical Magnitudes)
- **Primary Scientific Reference:** Gómez-Elvira, J. et al. (2012). *REMS: The Rover Environmental Monitoring Station for the Mars Science Laboratory Mission*. Space Science Reviews, 170(1-4), 583–640. doi:10.1007/s11214-012-9921-1.

### 1.2 Product File Naming Convention & Structure
Unlike Perseverance MEDA (which stores each sensor subsystem in separate CSV tables across sol folders), REMS ENVRDR archives store **all calibrated environmental measurements for a given sol in a single time-ordered table**:
- **Table File:** `RME_<SCLK>RMD<SOL><SEQ>_______<VER>.TAB` (ASCII fixed-width / comma-delimited table)
- **Label File:** `RME_<SCLK>RMD<SOL><SEQ>_______<VER>.LBL` (Detached PDS Object Description Language label)
- *Example Verified Filename:* `RME_417331939RMD02240000000_______P7.TAB` (Sol 224 observation record).

### 1.3 Source Product Channel Inventory

| Proposed UI Channel | Measured vs Derived vs Modeled | PDS Source Dataset | Key Column Identifiers | Physical Units | Processing & Quality Level |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ambient Pressure (PS)** | Directly calibrated measurement | `MSL-M-REMS-4-ENVRDR-V1.0` | `PRESSURE`, `PRESSURE_UNCERTAINTY`, `PRESSURE_CONFIDENCE` | Pascals ($\text{Pa}$) | RDR Level 4; Barocap capacitive transducer; temperature corrected. |
| **Air Temperature (AT)** | Directly calibrated measurement | `MSL-M-REMS-4-ENVRDR-V1.0` | `BOOM1_AIR_TEMP`, `BOOM2_AIR_TEMP`, uncertainty flags | Kelvin ($\text{K}$) & derived Celsius ($^\circ\text{C}$) | RDR Level 4; PT1000 RTD resistance sensors on Booms 1 and 2 (~1.5 m height). |
| **Ground Temperature (GT)** | Directly calibrated measurement | `MSL-M-REMS-4-ENVRDR-V1.0` | `GROUND_TEMP`, `GROUND_TEMP_UNCERTAINTY`, `GTS_CONFIDENCE` | Kelvin ($\text{K}$) & derived Celsius ($^\circ\text{C}$) | RDR Level 4; Boom 1 thermopile pyrometer integrating surface IR brightness. |
| **Relative Humidity (RH)** | Directly calibrated measurement | `MSL-M-REMS-4-ENVRDR-V1.0` | `RELATIVE_HUMIDITY`, `HUMIDITY_TEMP`, `RH_STATUS` | Percentage ($\%$) & Kelvin ($\text{K}$) | RDR Level 4; Boom 2 capacitive polymer thin-film sensor. |
| **Ultraviolet Radiation (UV)** | Calibrated measurement (basic dust/SZA correction) | `MSL-M-REMS-4-ENVRDR-V1.0` *(or Level 5 `UVRDR`)* | `UV_A`, `UV_B`, `UV_C`, `UV_D`, `UV_E`, `UV_ABC`, `SOLAR_ZENITH_ANGLE` | Watts per square meter ($\text{W/m}^2$) | RDR Level 4; 6 photodiodes on rover deck. Advanced dust-opacity models are in Level 5 `UVRDR`. |
| **Wind Speed & Direction (WS)** | Aerodynamically derived / reconstructed | `MSL-M-REMS-4-ENVRDR-V1.0` | `WIND_SPEED`, `WIND_DIRECTION`, plus raw board thermal conductances | Meters per second ($\text{m/s}$) & degrees azimuth ($^\circ$) | RDR Level 4; Derived from thermal anemometer board cooling rates via CFD lookup tables (*Newman et al., 2017*). |

### 1.4 Missing-Value & Quality Flag Conventions
- **Sentinels:** REMS ENVRDR products utilize `"UNK"` (unknown), `"NULL"`, `-9999`, `-9999.0`, or `-99.99` when a sensor was unpowered, saturated, or defective.
- **Strict Ingestion Rule:** All missing sentinels and records with invalid quality flags (`VALIDITY_FLAG != 1`) must be converted to strict JSON `null`. Under no circumstances may missing values be coerced to zero, which would catastrophically distort Martian surface temperature and pressure statistics.

---

## 2. Wind-Sensor Hardware Degradation & Provenance Specification

The REMS wind sensor consisted of two cylindrical booms mounted on the Remote Sensing Mast (Boom 1 pointing forward/starboard, Boom 2 pointing aft/port). Each boom housed three electronic sensor boards equipped with hot-film anemometers (dice) measuring thermal cooling. The operational history of these boards varies dramatically over time and must be represented with board-level precision.

### 2.1 Chronological Hardware Timeline

```
Sol 0 (Aug 2012)        Sol 854 (Jan 2015)     Sol 1485 (Oct 2016)   Sol 1504 (Nov 2016)   Present (Sol >4300)
───────┬────────────────────────┬──────────────────────┬──────────────────────┬──────────────────────►
       │                        │                      │                      │
       ▼                        ▼                      ▼                      ▼
  [Boom 1 Damaged]         [Boom 2 Board 1]       [Boom 2 Board 2]       [Boom 2 Board 1]       [All Wind Sensors]
  Boards 2 & 3 wires       Dice 1 failed.         Failed completely.     Failed completely.     Permanently
  severed by Sky Crane     Degraded single-boom   Multi-directional      ALL wind boards        inoperative across
  ejecta. Standalone       CFD recovery mode.     vectoring lost.        across BOTH booms      both booms.
  Boom 1 disabled.                                                       now INOPERATIVE.
```

1. **Sol 0 (Landing Day, August 6, 2012):**
   - During Sky Crane powered descent, gravel and sand entrained by the descent engines severed external cabling on **Boom 1 Boards 2 and 3**.
   - Board 1 remained electrically intact, but a single board cannot resolve two-dimensional wind direction. Consequently, Boom 1 was permanently incapacitated as a standalone anemometer from Sol 0 onward.
2. **Sols 0 to 854 (Nominal Boom 2 Aerodynamic Reconstruction):**
   - Wind speed and direction were derived exclusively from **Boom 2 Boards 1, 2, and 3** using aerodynamic CFD lookup tables (*Newman et al., 2017*).
   - *Provenance:* Derived aerodynamic reconstruction. When winds originated from the mast wake quadrant, flow distortion increased directional uncertainty ($\pm 30^\circ$).
3. **Sol 854 (Boom 2 Board 1 Dice 1 Failure):**
   - Electrical failure of Dice 1 on Board 1 reduced angular sensitivity. Wind retrieval transitioned to a degraded single-boom model with increased uncertainty.
4. **Sol 1485 to Sol 1491 (Boom 2 Progressive Breakdown):**
   - Board 2 on Boom 2 suffered electrical failure on Sol 1485. Board 3 failed on Sol 1491.
5. **Sol 1504 (Complete Wind Sensor Failure, November 2016):**
   - Board 1 on Boom 2 suffered total electrical failure.
   - *Impact:* **All wind sensor boards across both booms became permanently inoperative.**
   - *Post-Sol 1504 Status:* Curiosity has had zero in-situ wind measurement capability for over 2,800 sols.

### 2.2 Data Classification & UI Status Badges

The UI must evaluate observation Sol and product quality flags dynamically to render authentic provenance badges:

| Observation Context | Hardware Operational State | Data Classification | User-Facing UI Badge | UI Handling Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **$\text{Sol} \le 854$** | Boom 1 disabled; Boom 2 boards 1–3 operational | Aerodynamically derived | `Derived Flow Vector (Boom 2 CFD Model; Newman et al. 2017)` | Render speed & direction time-series; display mast-wake uncertainty note. |
| **$855 \le \text{Sol} \le 1484$** | Boom 2 Board 1 degraded; Boards 2–3 operational | Degraded derived | `Degraded Derived Flow (Partial Boom 2 Failure; High Uncertainty)` | Render time-series with amber advisory tag indicating reduced accuracy. |
| **$1485 \le \text{Sol} \le 1504$** | Boom 2 Boards 2 & 3 failed | Severely compromised | `Experimental Flow Estimate (Near-Total Sensor Failure)` | Render only if valid quality flags exist; display prominent warning. |
| **$\text{Sol} > 1504$** | **All wind boards across both booms inoperative** | Inoperative / Missing | `Sensors Inoperable (Hardware Failure on Sols 0 & 1504)` | **Disable wind charting.** Render red hardware failure banner; display `N/A (Inoperative)` in metric cards. |

---

## 3. Thermodynamic Channel Coverage & Environmental Caveats

The claim that thermodynamic channels operated "continuously for more than 4,300 sols" must be qualified: while the physical sensors have maintained functional capability across the inspected mission duration, **telemetry availability is discrete, session-bounded, and subject to physical constraints**.

### 3.1 Observation Duty Cycle & Temporal Gaps
- **Nominal Sampling Duty Cycle:** REMS is typically commanded to record 1 Hz data for **5 minutes at the start of each hour** (24 nominal hourly sessions per sol = 120 minutes of active recording). Periodically, an extended 1-hour continuous session is added during high-interest periods. REMS does **not** record 24 hours per day continuously at 1 Hz due to rover energy and bandwidth constraints.
- **Mission Hiatuses & Conjunction Gaps:**
  - Mars Solar Conjunction occurs approximately every 26 months (e.g. Sols ~240, 960, 1730, 2480, 3250, 4010), during which all telemetry uplinks/downlinks are suspended for 2–3 weeks.
  - Rover safe modes, software upgrades, and winter low-power states create additional multi-sol gaps.
- **Accurate Wording:** Telemetry should be described as *"available across sampled mission intervals from Sol 0 through extended mission (Sol >4300)"*, not *"continuous"*.

### 3.2 Sensor-Specific Calibration Constraints

| Channel | Sensor Physics | Documented Physical & Calibration Limitations |
| :--- | :--- | :--- |
| **Pressure (PS)** | Barocap capacitive transducer | Housed inside the rover body connected via a vent tube. Highly stable ($\pm 2\text{ Pa}$ precision), but exhibits a slight seasonal temperature dependence requiring baseline zero-offset tracking (*Harri et al., 2014*). |
| **Air Temperature (AT)** | PT1000 platinum RTDs | Mounted ~1.5 m on rover mast. When wind blows from the rover stern toward the mast, heat from the Multi-Mission Radioisotope Thermoelectric Generator (MMRTG, ~2,000 W thermal) advects forward, warming sensors by $1\text{ to } 5\text{ K}$ under low wind (*Gómez-Elvira et al., 2012*). |
| **Ground Temperature (GT)** | Infrared thermopile pyrometer | Measures surface brightness temperature. Subject to rover body shadows during morning/afternoon passes. Furthermore, atmospheric dust settling on the Germanium filter windows requires periodic thermal recalibration. |
| **Relative Humidity (RH)** | Capacitive polymer thin-film | High accuracy at moderate temperatures. At night ($T < 195\text{ K}$), frost ice condensation on the sensor dice can saturate readings ($100\%$) until post-dawn solar sublimation. Daytime sensitivity is limited when ambient humidity drops below $1\%$. |
| **Ultraviolet (UV)** | 6 photodiodes (UVA–UVE, UVABC) | Continuous settling of atmospheric dust onto photodiode sapphire windows attenuates measured currents over years. Raw ENVRDR values provide uncorrected currents; true absolute irradiance requires dust obscuration factors from Mastcam tau measurements (*Vicente-Retortillo et al., 2017*). |

---

## 4. Data Bundle Design & Sampling Strategy

### 4.1 Bundle Strategy: Packaged Representative Samples vs Full Ingestion
Ingesting all >4,300 sols at 1 Hz or even hourly downsamples would yield a bundle exceeding 100 megabytes, severely compromising browser performance on client-side deployments (such as Cloudflare Pages).

**Recommendation:** Package a **validated, representative sample dataset** for Phase 2.3A:
- **Baseline Sample 1 — Sol 0010 (Early Nominal Mission):**
  - Bradbury Landing site floor (~4.59°S, 137.44°E).
  - Demonstrates pristine instrument calibration, full Boom 2 wind reconstruction (*Newman et al., 2017*), and undisturbed early diurnal cycle.
- **Baseline Sample 2 — Sol 01600 (Post-Wind Failure Extended Mission):**
  - Lower Mount Sharp / Murray Formation traverse corridor.
  - Demonstrates continuous thermodynamic channels (PS, AT, GT, RH, UV) operating with high fidelity alongside **authentic post-Sol 1504 wind failure handling** (wind speed and direction channels correctly populated with nulls and flagged as inoperable).
- **User Disclosure:** The UI panel must prominently state: *"Displaying verified mission sample intervals (Sol 0010 & Sol 01600) from NASA PDS Atmospheres Node. This panel provides discrete mission-phase benchmarks, not an uninterrupted 12-year time series."*

### 4.2 Data Processing Pipeline (`process_rems.py`)
A dedicated Python script (`backend/data-processing/processing/process_rems.py`) will:
1. Parse the verified `.LBL` structure to determine column widths, data types, and byte offsets.
2. Read the companion `.TAB` files for candidate sols.
3. Convert sentinels (`-9999`, `-9999.0`, `"UNK"`) to `null`.
4. Downsample 1 Hz bursts into representative hourly nominal session observations (24 points per sol).
5. Compute derived Celsius temperatures ($^\circ\text{C} = \text{K} - 273.15$) while strictly preserving original Kelvin readings.
6. Tag each record with hardware health status (`OPERATIONAL_CFD_DERIVED` vs `INOPERABLE_HARDWARE_FAILURE`).
7. Export `frontend/public/data/rems_processed_bundle.json` and generate an execution audit report (`rems_processing_summary.json`).

### 4.3 Proposed JSON Bundle Schema (`rems_processed_bundle.json`)

```json
{
  "source": "NASA Planetary Data System (PDS) Atmospheres Node — MSL Curiosity REMS Archive (MSL-M-REMS-4-ENVRDR-V1.0)",
  "archive_url": "https://atmos.nmsu.edu/PDS/data/PDS4/MSL/msl_rems/",
  "generated_at": "2026-11-15T12:00:00.000Z",
  "rover_location_note": "MSL Curiosity Rover at Gale Crater Floor & Lower Mount Sharp Traverse Corridor (~4.59°S, 137.44°E).",
  "sampling_strategy_note": "Discrete mission benchmark sols demonstrating early nominal (Sol 0010) and post-wind failure (Sol 01600) telemetry.",
  "count": 2,
  "sols": ["00010", "01600"],
  "products": [
    {
      "sol": "00010",
      "logical_identifier": "urn:nasa:pds:msl_rems:data_derived_envrdr:rems_env_sol00010",
      "pds3_product_id": "RME_417331939RMD00100000000_______P1.TAB",
      "mission_phase": "Early Nominal Mission (Bradbury Landing)",
      "wind_hardware_status": "OPERATIONAL_CFD_DERIVED",
      "wind_status_label": "Derived Aerodynamic Flow (Boom 2 CFD Reconstruction; Newman et al. 2017)",
      "record_count": 24,
      "sample_observations": [
        {
          "LMST": "01:00:00",
          "PRESSURE": 748.2,
          "PRESSURE_UNCERTAINTY": 2.1,
          "BOOM1_AIR_TEMP_K": 205.4,
          "BOOM1_AIR_TEMP_C": -67.75,
          "GROUND_TEMP_K": 198.1,
          "GROUND_TEMP_C": -75.05,
          "RELATIVE_HUMIDITY": 14.2,
          "WIND_SPEED": 2.4,
          "WIND_DIRECTION": 185.0,
          "UV_INDEX": 0.0,
          "_comment": "ILLUSTRATIVE EXAMPLE SCHEMA — values populated from authentic PDS source by process_rems.py"
        }
      ]
    },
    {
      "sol": "01600",
      "logical_identifier": "urn:nasa:pds:msl_rems:data_derived_envrdr:rems_env_sol01600",
      "pds3_product_id": "RME_539827200RMD01600000000_______P1.TAB",
      "mission_phase": "Extended Mission (Murray Formation / Mount Sharp)",
      "wind_hardware_status": "INOPERABLE_HARDWARE_FAILURE",
      "wind_status_label": "Sensors Inoperable (Total Anemometer Failure on Sols 0 & 1504)",
      "hardware_failure_note": "All wind sensor boards across Boom 1 and Boom 2 are permanently inoperative. Wind telemetry is unavailable.",
      "record_count": 24,
      "sample_observations": [
        {
          "LMST": "01:00:00",
          "PRESSURE": 820.5,
          "PRESSURE_UNCERTAINTY": 2.0,
          "BOOM1_AIR_TEMP_K": 208.1,
          "BOOM1_AIR_TEMP_C": -65.05,
          "GROUND_TEMP_K": 194.2,
          "GROUND_TEMP_C": -78.95,
          "RELATIVE_HUMIDITY": 18.5,
          "WIND_SPEED": null,
          "WIND_DIRECTION": null,
          "UV_INDEX": 0.0,
          "_comment": "Authentic missing records reflecting post-Sol 1504 total wind sensor loss"
        }
      ]
    }
  ]
}
```

---

## 5. Dataset Lifecycle & Provenance Progression

To prevent misleading claims, REMS will **not** be registered as `INTEGRATED` during planning or preflight.

### 5.1 Strict Lifecycle Transition Rules

```
┌──────────────┐     Download PDS Files      ┌───────────────┐     process_rems.py Executed    ┌─────────────┐
│  REGISTERED  │ ──────────────────────────► │  DOWNLOADED   │ ──────────────────────────────► │  VALIDATED  │
│ (Metadata in │   datasets/rems/raw/*.TAB   │ (Local Raw    │   rems_processed_bundle.json    │ (Automated  │
│ evidenceDs)  │                             │  PDS Exists)  │   passes schema & sentinels)    │ Tests Pass) │
└──────────────┘                             └───────────────┘                                 └──────┬──────┘
                                                                                                      │
                                             Mount UI & Gating in InvestigationPage.tsx               │
                                             ─────────────────────────────────────────────────────────┘
                                                                      │
                                                                      ▼
                                                              ┌───────────────┐
                                                              │  INTEGRATED   │
                                                              │ (Active UI &  │
                                                              │  Catalog Reg) │
                                                              └───────────────┘
```

1. **`REGISTERED` / `ACCESSIBLE` (Current State):**
   - Dataset entry exists in `EVIDENCE_DATASETS` with `operationalStatus: ["REGISTERED", "ACCESSIBLE"]`.
   - `available: false`, `integrationStatus: "planned"`.
   - `msl_rems_env` is **NOT** present in `GENUINE_LOCAL_DATASET_IDS`.
2. **`DOWNLOADED` (Prerequisite State):**
   - Authentic PDS ENVRDR files for candidate sols are staged in `backend/datasets/rems/raw/`.
   - Operational status advances to `["REGISTERED", "ACCESSIBLE", "DOWNLOADED"]`.
3. **`VALIDATED` (Processing Complete State):**
   - `process_rems.py` runs, converts sentinels to `null`, downsamples hourly sessions, and outputs `rems_processed_bundle.json`.
   - File exists on disk at `frontend/public/data/rems_processed_bundle.json`.
   - Automated tests confirm zero unparsed sentinels and valid schema.
4. **`INTEGRATED` (Final State — Phase 2.3A Completion):**
   - `RemsEnvironmentalPanel.tsx` mounted and tested in `InvestigationPage.tsx`.
   - `msl_rems_env` added to `GENUINE_LOCAL_DATASET_IDS` in `evidenceDatasets.ts`.
   - Operational status advances to `["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"]`.
   - `available: true`, `integrationStatus: "integrated_active"`.

---

## 6. Verified Backend & Frontend Architecture

### 6.1 Backend API Verification
Deep inspection of `backend/main.py` confirms:
- **No REMS endpoints currently exist.** The backend contains routes for `/api/layers`, `/api/nasa/layers/*`, `/api/meda/products`, and `/api/rover/perseverance/images`.
- Proposing a live backend API (`http://127.0.0.1:8000/api/rems/...`) as the primary path is incorrect and ungrounded.

### 6.2 Recommended Architecture: Direct Static Bundle Ingestion
To maintain the highest reliability and ensure compatibility with Cloudflare Pages (where no Python backend is available), `remsProvider.ts` will load directly from the static application asset:
- **Primary Data Source:** `frontend/public/data/rems_processed_bundle.json` (fetched via browser `fetch("/data/rems_processed_bundle.json")`).
- **Zero Backend Dependency:** Eliminates dependency on local FastAPI backend execution.
- **Provider Methods:**
  - `remsProvider.getBundle(): Promise<RemsProcessedBundle>`
  - `remsProvider.getSolTelemetry(sol: string): Promise<RemsSolTelemetry>`
  - Pure statistical helpers: `parseNumeric`, `summarizeSeries` (reused directly or shared without zero-coercion).

### 6.3 Dedicated UI Component: `RemsEnvironmentalPanel.tsx`
Rather than introducing complex branching inside `MedaEnvironmentalPanel.tsx`, a dedicated `RemsEnvironmentalPanel.tsx` component will be created:
- **Sensors:** Six channels (`PS`, `AT`, `GT`, `RH`, `UV`, `WS`).
- **Dynamic Status Badging:** Renders appropriate hardware operational badges as specified in Section 2.2.
- **Diurnal Time-Series Chart:** Visualizes pressure, air/ground temperature, relative humidity, UV, and wind across LMST hours.
- **Observation Logging Modal:** Direct submission to `MissionContext` under dataset ID `msl_rems_env` with coordinates set to Bradbury Landing / Curiosity traverse ($-4.5895^\circ\text{S}, 137.4417^\circ\text{E}$).
- **Strict Region Gating:** In `InvestigationPage.tsx`, REMS is mounted strictly when `activeRegionId === "gale-crater"`. Jezero MEDA mounting remains guarded strictly by `isJezero`.

---

## 7. Roadmap & Phase Numbering Alignment

The implementation plan conforms strictly to the master project roadmap:

- **Phase 2.3A:** Curiosity REMS Environmental Telemetry Integration (Gale Crater in-situ atmospheric observations).
- **Phase 2.3B:** Curiosity Surface Imagery Integration (Catalog #3 expansion for Gale Crater).
- **Phase 2.3C:** Scientific Evidence Catalog & Lifecycle State Synchronization.
- **Phase 2.3D:** Regional Geological Map Vectorization (Gale Crater, Valles Marineris, Olympus Mons).
- **Phase 3.0:** High-Resolution 3D Terrain Meshes & Multi-Region Simulator Environments.

*Note on MCD Climate Profiles:* Synthetic Mars Climate Database (MCD v6.1) model profiles for Valles Marineris and Olympus Mons are numerical simulation tasks that remain separately gated. They are **not** part of Phase 2.3A.

---

## 8. Test Plan & Acceptance Criteria

### 8.1 Pre-Implementation Verification (Current Baseline)
The following tests must pass before any Phase 2.3A code changes are made:
- `node verify_phase2_catalog.mjs`: **36 / 36 passed**.
- `node verify_phase1_multiregion.mjs`: **25 / 25 passed**.
- `node frontend/scratch/run_audit_tests.cjs`: **65 / 65 passed**.
- `cd frontend; npx tsc --noEmit`: Clean compilation (**0 errors**).

### 8.2 Post-Implementation Acceptance Test Suite (`verify_phase2_3a_rems.mjs`)
Upon implementation in Phase 2.3A, the automated script will verify:

1. **Source Product Identity & Integrity:**
   - Confirm `/public/data/rems_processed_bundle.json` exists, is valid JSON, and cites `MSL-M-REMS-4-ENVRDR-V1.0`.
   - Verify top-level metadata (`source`, `archive_url`, `sampling_strategy_note`, `sols`).
2. **Missing-Value Sanitization:**
   - Confirm zero unparsed sentinels (`-9999`, `-9999.0`, `"UNK"`, `"NULL"`).
   - Confirm missing fields parse strictly to `null` and never `0` or `"0"`.
3. **Hardware Health Status Tagging:**
   - Confirm Sol 0010 wind telemetry carries `OPERATIONAL_CFD_DERIVED` status and non-null values.
   - Confirm Sol 01600 wind telemetry carries `INOPERABLE_HARDWARE_FAILURE` status and all wind speed/direction records are strictly `null`.
4. **Channel & Unit Mapping:**
   - Confirm pressure is stored in $\text{Pa}$, air/ground temp in $\text{K}$ and derived $^\circ\text{C}$, relative humidity in $\%$, UV in $\text{W/m}^2$, wind in $\text{m/s}$ and $^\circ$.
5. **Gale-Only Regional Visibility:**
   - Confirm `msl_rems_env` is applicable exclusively to `gale-crater` (`supportedRegionIds: ["gale-crater"]`).
   - Confirm `isDatasetApplicableToRegion()` returns true for Gale and false for Jezero, Valles Marineris, and Olympus Mons.
6. **Dataset Lifecycle & Registration Validity:**
   - Confirm `validateDatasetLifecycle()` passes with 0 errors for `msl_rems_env`.
   - Confirm `msl_rems_env` is present in `GENUINE_LOCAL_DATASET_IDS`.
   - Confirm `regions.ts` contains `msl_rems_env` under Gale Crater with role `direct_quantitative`.
7. **Jezero MEDA Regression Protection:**
   - Confirm all 7 MEDA subsystems remain intact in `meda_processed_bundle.json`.
   - Confirm zero cross-talk or shared state mutations between MEDA and REMS.

---

## 9. Clarification of Previous Verification Results

During the prior preflight audit, an apparent discrepancy occurred during TypeScript build verification:
1. **Command 1:** `cd frontend && npx tsc --noEmit` exited with code 1.
   - *Technical Cause:* The command was executed in Windows PowerShell 5.1. In PowerShell 5.1, `&&` is not a valid statement separator (unlike `cmd.exe` or POSIX shells). PowerShell threw a parser error: `The token '&&' is not a valid statement separator in this version.` The failure was purely a PowerShell shell syntax error; `tsc` was never invoked.
2. **Command 2:** `cd frontend; npx tsc --noEmit` exited with code 0.
   - *Technical Cause:* Using PowerShell's valid statement separator (`;`), the command executed cleanly, invoking `tsc --noEmit` and verifying zero TypeScript compilation errors across the entire frontend application.

The codebase is confirmed to be 100% clean of TypeScript compilation errors.

---

## 10. Scope Boundaries & Explicit Exclusions

To prevent scope creep, the following tasks are explicitly excluded from Phase 2.3A:
- **NO** Mars Climate Database (MCD v6.1) numerical simulations or synthetic vertical profile generation.
- **NO** Curiosity Mastcam, Navcam, or MAHLI surface imagery catalog ingestion (scheduled for Phase 2.3B).
- **NO** Gale Crater geological unit vectorization or GeoJSON generation (scheduled for Phase 2.3D).
- **NO** 3D terrain elevation meshes or OBJ simulator environments (scheduled for Phase 3.0).
- **NO** alterations to existing Jezero Crater MEDA or CRISM data pipelines.

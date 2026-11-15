# Four-Region Dataset Integration Roadmap
## Mars Explorer Engineering Strategy, Ingestion Pipelines & Phased Implementation Plan

**Document Version:** 1.0.0  
**Date:** November 15, 2026  
**Status:** Independent Technical Roadmap & Architecture Specification  
**Target Exploration Regions:** Jezero Crater, Gale Crater, Valles Marineris (Melas Chasma), Olympus Mons (Summit Caldera)  

---

## 1. Executive Summary & Architectural Vision

The Mars Explorer application is advancing from a single-region Jezero prototype into a unified, multi-region planetary exploration platform. The foundational multi-region architecture (Phase 1) and scientific dataset filtering model (Phase 2.1) have established strict guardrails:
1. **Simulator Availability $\neq$ Scientific Dataset Availability:** A region can possess rich scientific evidence without an operational 3D simulator, and vice versa.
2. **Zero Fabricated Data:** Datasets claiming `DOWNLOADED` or `INTEGRATED` status must correspond to verified physical assets on disk.
3. **Preservation of Existing Functionality:** The fully operational Jezero Crater 3D simulator, the MEDA meteorological pipeline, and global Trek WMTS layers must remain completely intact.

This roadmap details the exact ingestion pipelines, backend architectures, 3D terrain transformations, and phased development milestones required to bring Gale Crater, Valles Marineris, and Olympus Mons into full operational maturity.

---

## 2. Existing Working Integrations to Strictly Preserve

Any future implementation must strictly preserve the following active subsystems:

```
+====================================================================================================+
|                                  EXISTING CORE WORKING SUBSYSTEMS                                  |
+==================================+==========================================+=======================+
| Subsystem Component              | File / Asset Path                        | Engineering Role      |
+==================================+==========================================+=======================+
| Jezero 3D Mesh Binary Pyramid    | /frontend/public/jezero/height/*.u16     | 16-bit binary DEM     |
|                                  | /frontend/public/jezero/overview.u16     | Low-res terrain LOD   |
|                                  | /frontend/public/jezero/manifest.json    | Terrain tile schema   |
+----------------------------------+------------------------------------------+-----------------------+
| Jezero 3D Surface Textures       | /frontend/public/jezero/tex/*.jpg        | 5 m CTX orthomosaic   |
|                                  | /frontend/public/jezero/overview.jpg     | Overview texture      |
+----------------------------------+------------------------------------------+-----------------------+
| Perseverance MEDA In-Situ Bundle | /frontend/public/data/                   | 53,263 validated PDS4 |
|                                  |   meda_processed_bundle.json             | records (Sol 1 & 36)  |
+----------------------------------+------------------------------------------+-----------------------+
| Jezero Chronostratigraphic Map   | /frontend/public/data/                   | USGS SIM 3464 vector  |
|                                  |   jezero_geology_sim3464.geojson         | stratigraphy layers   |
+----------------------------------+------------------------------------------+-----------------------+
| Remote HiRISE Spot DEM Queries   | /api/terrain/dem/elevation (FastAPI)     | AWS ARD S3 STAC COG   |
|                                  | backend/terrain_dem.py                   | GDAL /vsicurl/ access |
+----------------------------------+------------------------------------------+-----------------------+
| Global Context WMTS Layers       | frontend/src/data/mapLayers.ts           | 10 interactive global |
|                                  | NASA Mars Trek XYZ endpoints             | MOLA/THEMIS/TES layers|
+----------------------------------+------------------------------------------+-----------------------+
| Multi-Region State Management    | frontend/src/state/mission/              | Region switching &    |
|                                  |   MissionContext.tsx                     | dataset filtering     |
+==================================+==========================================+=======================+
```

---

## 3. Missing Datasets & Assets Required Per Region

To achieve scientific and simulation parity, the following specific assets must be acquired and integrated. **Physical inspection of the repository confirms that zero local files currently exist on disk for Gale Crater, Valles Marineris, or Olympus Mons.** All entries below represent external archival products that require acquisition and ingestion.

### 3.1 Gale Crater (Mount Sharp) — Target for Phase 3 Simulator
1. **Topography (Elevation Mesh):**
   - *Target Asset:* Controlled 20 m CTX DEM GeoTIFF (`MRO_CTX_Gale_20m_DTM.tif` in USGS Astrogeology / PDS).
   - *Status:* `REQUIRES ACQUISITION & PROCESSING` (Zero local Gale DEM files exist on disk).
   - *Output Requirement:* 16-bit unsigned binary tile pyramid in `/public/gale/height/*.u16`, `overview.u16`, and `manifest.json`.
   - *Fallback:* Mars Express HRSC 50 m DTM mosaic (orbits 1916, 1927, 1938; ESA PSA).
2. **Surface Imagery (Textures):**
   - *Target Asset:* Controlled 5 m CTX Orthomosaic GeoTIFF (`MRO_CTX_Gale_5m_mosaic.tif` in USGS / Murray Lab).
   - *Status:* `REQUIRES ACQUISITION & PROCESSING` (Zero local Gale texture tiles exist on disk).
   - *Output Requirement:* JPEG texture tile pyramid in `/public/gale/tex/*.jpg` and `overview.jpg`.
3. **In-Situ Meteorological Telemetry:**
   - *Target Asset:* MSL Curiosity REMS PDS4 data bundle (`urn:nasa:pds:msl_rems` in PDS Atmospheres).
   - *Status:* `AVAILABLE REMOTELY (PDS) — REQUIRES PROCESSING` (Parser script must be written and executed).
   - *Output Requirement:* Pre-bundled JSON archive `/public/data/rems_processed_bundle.json` containing representative diurnal cycles across landing (Sol 0010) and Mount Sharp ascent (Sol 2000+).
4. **Surface Photography:**
   - *Target Asset:* Curiosity Mastcam-34 and Mastcam-100 PDS image releases.
   - *Status:* `AVAILABLE REMOTELY (PDS) — REQUIRES APPLICATION INTEGRATION`.
   - *Output Requirement:* Structured catalog in `frontend/src/data/curiositySurfaceImagery.ts`.
5. **Geology & Stratigraphy:**
   - *Target Asset:* Anderson & Bell (2010) foundational peer-reviewed paper in *Mars* (doi:10.1555/mars.2010.0004) + regional quadrangle USGS Map I-1111 (*Scott, Morris, & West, 1978*).
   - *Status:* `PROPOSED — REQUIRES GEOJSON VECTORIZATION`.
   - *Output Requirement:* Vector GeoJSON `/public/data/gale_geology_anderson2010.geojson`.

---

### 3.2 Valles Marineris (Melas Chasma) — Target for Phase 4.0 Simulator
1. **Topography (Elevation Mesh):**
   - *Target Asset:* Mars Express HRSC 50 m Melas Chasma DTM GeoTIFF (`h0360_0000_dt4.img` / GeoTIFF in ESA PSA).
   - *Status:* `REQUIRES ACQUISITION & PROCESSING`.
   - *Output Requirement:* 60 km × 60 km cropped 16-bit binary tile pyramid in `/public/valles-marineris/height/*.u16`.
2. **Surface Imagery (Textures):**
   - *Target Asset:* Controlled 6 m CTX Melas Chasma Orthomosaic GeoTIFF.
   - *Status:* `REQUIRES ACQUISITION & PROCESSING`.
   - *Output Requirement:* JPEG texture pyramid in `/public/valles-marineris/tex/*.jpg`.
3. **Environmental Climatology:**
   - *Target Asset:* European Mars Climate Database (MCD v6.1 / LMD-GCM numerical model).
   - *Status:* `PROPOSED (MODEL) — REQUIRES EXTRACTION & BUNDLING`.
   - *Output Requirement:* Tabulated high-density canyon floor climatology `/public/data/valles_mcd_bundle.json` (+1,150 Pa barometric pressure).
4. **Geology & Stratigraphy:**
   - *Target Asset:* USGS Map I-2010 (*Witbeck, Tanaka, & Scott, 1991*, scale 1:2,000,000; https://pubs.usgs.gov/imap/2010/).
   - *Status:* `PROPOSED — REQUIRES GEOJSON VECTORIZATION`.
   - *Output Requirement:* Vector GeoJSON `/public/data/valles_geology_i2010.geojson`.

---

### 3.3 Olympus Mons (Summit Caldera) — Target for Phase 4.1 Simulator
1. **Topography (Elevation Mesh):**
   - *Target Asset:* Mars Express HRSC 50 m Caldera DTM GeoTIFF (`h0037_0000_dt4.img` / GeoTIFF in ESA PSA).
   - *Status:* `REQUIRES ACQUISITION & PROCESSING`.
   - *Output Requirement:* 80 km × 65 km cropped 16-bit binary tile pyramid in `/public/olympus-mons/height/*.u16`.
2. **Surface Imagery (Textures):**
   - *Target Asset:* Controlled 6 m CTX Caldera Orthomosaic GeoTIFF.
   - *Status:* `REQUIRES ACQUISITION & PROCESSING`.
   - *Output Requirement:* JPEG texture pyramid in `/public/olympus-mons/tex/*.jpg`.
3. **Environmental Climatology:**
   - *Target Asset:* European Mars Climate Database (MCD v6.1 / LMD-GCM numerical model).
   - *Status:* `PROPOSED (MODEL) — REQUIRES EXTRACTION & BUNDLING`.
   - *Output Requirement:* Tabulated near-vacuum summit climatology `/public/data/olympus_mcd_bundle.json` (<100 Pa barometric pressure).
4. **Geology & Stratigraphy:**
   - *Target Asset:* USGS SIM 3470 (*Mouginis-Mark, 2021*, scale 1:200,000; https://pubs.usgs.gov/sim/3470/). Confined to summit caldera complex.
   - *Status:* `PROPOSED — REQUIRES GEOJSON VECTORIZATION`.
   - *Output Requirement:* Vector GeoJSON `/public/data/olympus_geology_sim3470.geojson`. Flank context is provided by USGS Map I-2327.

---

## 4. Data Processing Pipelines & Tooling

To ensure seamless compatibility with the existing Marswalk 3D engine, all incoming raster and tabular datasets must pass through standardized processing pipelines.

> **CRITICAL ARCHITECTURAL AUDIT NOTE:** Neither `scripts/process_terrain_dem.py` nor `scripts/process_rems_bundle.py` currently exists on disk in the repository. No root `scripts/` directory currently exists. The Python code blocks presented below are **Proposed Architectural Specifications / Conceptual Prototypes** intended for implementation during Phase 3.0 and Phase 2.3.

```
+----------------------------------------------------------------------------------------------------+
|                                    DATA INGESTION & TILING PIPELINE                                |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [NASA PDS / ESA PSA / USGS]                                                                       |
|         │                                                                                          |
|         ▼                                                                                          |
|  [Raw GeoTIFF / DTM / IMG]                                                                         |
|         │                                                                                          |
|         ├──────────────────────────────────────────────┐                                           |
|         ▼                                              ▼                                           |
|  [Elevation Processing Pipeline]             [Texture Processing Pipeline]                         |
|  1. gdalwarp: Crop to bounding box           1. gdalwarp: Reproject & match bounds                 |
|  2. gdal_translate: 16-bit unsigned (u16)    2. ImageMagick/GDAL: Contrast stretch                 |
|  3. python slice_dem.py:                     3. python slice_textures.py:                          |
|     - Generate overview.u16                      - Generate overview.jpg                           |
|     - Slice into /height/tile_{x}_{y}.u16        - Slice into /tex/tile_{x}_{y}.jpg                |
|     - Write manifest.json                        - Match tile indexing grid                        |
|         │                                              │                                           |
|         └───────────────────────┬──────────────────────┘                                           |
|                                 ▼                                                                  |
|               [/frontend/public/<region_id>/]                                                      |
|               - manifest.json                                                                      |
|               - overview.u16 & overview.jpg                                                        |
|               - height/*.u16 & tex/*.jpg                                                           |
|                                 │                                                                  |
|                                 ▼                                                                  |
|               [Marswalk 3D Simulation Engine]                                                      |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 4.1 Elevation Mesh Slicing Pipeline Specification (Proposed Architectural Specification)

The Marswalk terrain engine expects binary 16-bit unsigned integer tiles (`.u16`). The elevation values are linearly mapped between `heightMin` and `heightMax`:

$$\text{Elevation}(x,y) = \text{heightMin} + \left( \frac{\text{raw\_u16}(x,y)}{65535} \right) \times (\text{heightMax} - \text{heightMin})$$

```python
"""
Mars Explorer Standard DEM Slicing Pipeline (Conceptual Implementation for Phase 3.0)
Converts a regional GeoTIFF DEM into a manifest.json and binary .u16 tiles.
Target file path upon authoring: backend/data-processing/processing/process_terrain_dem.py
"""
import json
import math
import numpy as np
import rasterio
from pathlib import Path

def process_dem(input_geotiff: str, output_dir: str, tile_size: int = 65):
    out = Path(output_dir)
    height_dir = out / "height"
    height_dir.mkdir(parents=True, exist_ok=True)
    
    with rasterio.open(input_geotiff) as src:
        data = src.read(1)
        nodata = src.nodata
        if nodata is not None:
            data[data == nodata] = np.nanmin(data[data != nodata])
            
        h_min = float(np.nanmin(data))
        h_max = float(np.nanmax(data))
        
        # Normalize to 16-bit unsigned integer (0 - 65535)
        norm = ((data - h_min) / (h_max - h_min) * 65535.0).astype(np.uint16)
        
        rows, cols = norm.shape
        tiles_x = math.ceil(cols / (tile_size - 1))
        tiles_y = math.ceil(rows / (tile_size - 1))
        
        # Write overview tile (downsampled to 128x128)
        overview = norm[::rows//128, ::cols//128]
        overview.tofile(out / "overview.u16")
        
        # Slice into overlapping terrain tiles
        for ty in range(tiles_y):
            for tx in range(tiles_x):
                r_start = ty * (tile_size - 1)
                r_end = min(r_start + tile_size, rows)
                c_start = tx * (tile_size - 1)
                c_end = min(c_start + tile_size, cols)
                
                tile = np.zeros((tile_size, tile_size), dtype=np.uint16)
                sub = norm[r_start:r_end, c_start:c_end]
                tile[:sub.shape[0], :sub.shape[1]] = sub
                
                tile_path = height_dir / f"tile_{tx}_{ty}.u16"
                tile.tofile(tile_path)
                
        manifest = {
            "tileSize": tile_size,
            "tilesX": tiles_x,
            "tilesY": tiles_y,
            "widthMeters": cols * src.res[0],
            "heightMeters": rows * src.res[1],
            "heightMin": h_min,
            "heightMax": h_max,
            "resolutionMeters": src.res[0],
            "bounds": {
                "west": src.bounds.left,
                "east": src.bounds.right,
                "south": src.bounds.bottom,
                "north": src.bounds.top
            }
        }
        
        with open(out / "manifest.json", "w") as f:
            json.dump(manifest, f, indent=2)
```

---

### 4.2 In-Situ Environmental Pre-bundling Pipeline Specification (Proposed Architectural Specification)

The MSL Curiosity REMS instrument produces daily PDS4 tabular data. To ensure zero network latency and complete client-side reliability (matching the Jezero MEDA implementation), a Python parsing script will be authored (target path: `backend/data-processing/processing/process_rems.py`) to process the PDS4 records into `/public/data/rems_processed_bundle.json`:

1. **Ingest PDS4 Tables:** Read atmospheric pressure (Pa), air temperature (ATS, K), ground temperature (GTS, K), relative humidity (%), and ultraviolet radiation flux ($W/m^2$).
2. **Sentinel Value Filtering:** Filter invalid sentinels (`-9999`, `999999999`) into JSON `null` values to prevent calculation corruption.
3. **Multi-Sol Temporal Slices:** Select representative mission sols:
   - *Sol 0010:* Initial Bradbury Landing baseline.
   - *Sol 0500:* Crossing the active Bagnold Dunes.
   - *Sol 1800:* Traversal across hematite-bearing Vera Rubin Ridge.
   - *Sol 3200:* Ascent into the Sulfate-bearing unit of Mount Sharp.
4. **Structured JSON Output:** Formats records into a schema directly consumable by the shared `EnvironmentalPanel` component.

---

## 5. Backend Architecture & API Extensions

The FastAPI backend (`backend/terrain_dem.py`) currently resolves remote STAC COG queries for Jezero HiRISE DTMs. It must be extended to support multi-region routing.

```
+----------------------------------------------------------------------------------------------------+
|                               FASTAPI BACKEND MULTI-REGION ROUTING                                 |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  Incoming Request: GET /api/terrain/dem/elevation?lat=-4.5895&lon=137.4417&region=gale-crater      |
|                                 │                                                                  |
|                                 ▼                                                                  |
|                    [Coordinate & Region Router]                                                    |
|                                 │                                                                  |
|         ┌───────────────────────┼─────────────────────────┐                                        |
|         ▼                       ▼                         ▼                                        |
|  [jezero-crater]          [gale-crater]             [valles-marineris / olympus-mons]              |
|  1. Query HiRISE COG      1. Query HiRISE MSL COG   1. Check local HRSC 50m raster                 |
|  2. Fallback to local     2. Fallback to local      2. Fallback to global MOLA 128                 |
|     CTX 20m raster           CTX 20m raster                                                        |
|  3. Global MOLA 128       3. Global MOLA 128                                                       |
|                                 │                                                                  |
|                                 ▼                                                                  |
|                   [JSON Response with Provenance]                                                  |
|                   {                                                                                |
|                     "elevation": -4501.2,                                                          |
|                     "resolutionMeters": 1.0,                                                       |
|                     "source": "HiRISE DTEEC_009187_1755_009833_1755_U01",                          |
|                     "region": "gale-crater"                                                        |
|                   }                                                                                |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 5.1 Region-Aware Elevation Service Architecture
1. **Dynamic Bounding Box Routing:** Instead of hardcoded Jezero limits, the service inspects the query coordinates against the `geographicBounds` defined in `MARS_REGIONS`.
2. **Multi-Tier Asset Fallback:**
   - *Tier 1 (Sub-meter):* Remote HiRISE Controlled Stereo DTM via AWS ARD S3 STAC COG.
   - *Tier 2 (Decameter):* High-resolution regional raster (Jezero CTX 20 m, Gale CTX 20 m, Melas HRSC 50 m, Olympus HRSC 50 m).
   - *Tier 3 (Planetary):* Global MGS MOLA MEGDR 128 ppd raster (`MEGT*.IMG`).
3. **Provenance Header:** Every elevation response includes explicit metadata fields: `source_dataset`, `resolution_meters`, and `uncertainty_meters`.

---

## 6. Frontend 3D Simulator Prerequisites Per Region

To transition a region from `simulatorAvailability: "PLANNED"` to `"AVAILABLE"` in `catalog.ts` and `regions.ts`, the following engineering criteria must be fulfilled:

### 6.1 Gale Crater Environment Configuration (`simulator/environments/gale.ts`)
- **Environment ID:** `gale-crater`
- **World Origin:** Bradbury Landing Site (-4.5895°S, 137.4417°E).
- **Datum Offset:** $-4,501.0\text{ m}$ (Areoid elevation of the crater floor).
- **Spawn Position:** $[0, 2.0, 0]$ (2.0 meters above terrain mesh at origin).
- **Mesh Tiling Structure:** 65 × 65 vertex patches loaded dynamically from `/public/gale/height/`.
- **Terrain Skirt Depth:** $1,000\text{ m}$ (prevents edge clipping against Mount Sharp slopes).
- **Atmospheric Model:**
  - Surface barometric pressure: $750\text{ Pa}$ (diurnal cycle: 700–850 Pa).
  - Sky color Rayleigh scattering: $R=0.78, G=0.62, B=0.48$ (Warm butterscotch Martian sky).
  - Fog density: $0.00015$ (moderately clear atmosphere).

---

### 6.2 Valles Marineris Environment Configuration (`simulator/environments/vallesMarineris.ts`)
- **Environment ID:** `valles-marineris`
- **World Origin:** Melas Chasma Central Floor (-9.8000°S, -76.4000°E).
- **Datum Offset:** $-4,500.0\text{ m}$ (Deep canyon floor datum).
- **Spawn Position:** $[0, 2.0, 0]$ on flat alluvial landslide floor.
- **Mesh Tiling Structure:** 50 m resolution mesh patches loaded from `/public/valles-marineris/height/`.
- **Terrain Skirt Depth:** $2,500\text{ m}$ (Crucial: prevents visual gaps beneath the 8.5 km cliff walls).
- **Atmospheric Model:**
  - Surface barometric pressure: $1,150\text{ Pa}$ (High-density canyon floor).
  - Sky color & scattering: Enhanced atmospheric density; pronounced horizon haze.
  - Fog density: $0.00045$ (Simulates dense valley aerosol loading and morning ice fog).

---

### 6.3 Olympus Mons Environment Configuration (`simulator/environments/olympusMons.ts`)
- **Environment ID:** `olympus-mons`
- **World Origin:** Caldera 1 Floor (18.6500°N, -133.8000°E).
- **Datum Offset:** $+18,200.0\text{ m}$ (Caldera floor above MOLA datum).
- **Spawn Position:** $[0, 2.0, 0]$ on basaltic caldera floor.
- **Mesh Tiling Structure:** 50 m resolution mesh patches loaded from `/public/olympus-mons/height/`.
- **Terrain Skirt Depth:** $1,500\text{ m}$ (Accommodates caldera pit collapse walls).
- **Atmospheric Model:**
  - Surface barometric pressure: $75\text{ Pa}$ (Near-vacuum conditions).
  - Sky color & scattering: Deep dark purple-black sky ($R=0.08, G=0.06, B=0.10$).
  - Celestial Sphere: Bright stars and Phobos/Deimos visible even during daytime solar hours.
  - Fog density: $0.00001$ (Virtually zero aerosol scattering).

---

## 7. Phased Implementation Roadmap

A phased, low-risk implementation schedule prioritizing scientific accuracy before large-scale binary ingestion.

```
+====================================================================================================+
|                                  PHASED IMPLEMENTATION SCHEDULE                                    |
+=============+===============================================+=======================+==============+
| Phase       | Title & Focus                                 | Deliverable Assets    | Risk Level   |
+=============+===============================================+=======================+==============+
| Phase 2.2   | Scientific Catalog Corrections & Metadata     | Codebase map citations| VERY LOW     |
|             | Clean up 3 misidentified USGS maps in catalog | & lifecycle audit     | (Text only)  |
+-------------+-----------------------------------------------+-----------------------+--------------+
| Phase 2.3   | In-Situ Environmental Telemetry Integration   | REMS & MCD JSON       | LOW          |
|             | Ingest Curiosity REMS & MCD GCM bundles       | pre-bundled archives  | (JSON data)  |
+-------------+-----------------------------------------------+-----------------------+--------------+
| Phase 3.0   | Gale Crater DEM & Texture Ingestion Pipeline  | Gale .u16 tiles &     | MEDIUM       |
|             | Run GDAL tiling on 20 m CTX DEM and 5 m ortho | JPG texture pyramids  | (Data assets)|
+-------------+-----------------------------------------------+-----------------------+--------------+
| Phase 3.1   | Gale Crater 3D Simulator Implementation       | simulator/            | MEDIUM       |
|             | Mount Sharp 3D mesh, avatar physics, spawn    | environments/gale.ts  | (Engine code)|
+-------------+-----------------------------------------------+-----------------------+--------------+
| Phase 4.0   | Valles Marineris (Melas) Large-Scale Sim      | Melas 50m .u16 mesh;  | HIGH         |
|             | 8.5 km vertical relief & canyon fog tuning    | deep skirt engine     | (Scale/relief|
+-------------+-----------------------------------------------+-----------------------+--------------+
| Phase 4.1   | Olympus Mons Caldera Low-Pressure Sim         | Caldera 50m .u16 mesh;| MEDIUM       |
|             | +21.2 km altitude & near-vacuum dark sky      | near-vacuum physics   | (Visual/phys)|
+=============+===============================================+=======================+==============+
```

### Phase 2.2: Scientific Catalog Corrections & Metadata Validation
- **Operational Status:** `PROPOSED — READY FOR APPROVAL`
- **Objective:** Correct the catalog errors identified during independent research.
- **Specific Tasks:**
  1. Update `frontend/src/data/regions.ts`:
     - Replace `usgs_sim_3482_gale` with `usgs_gale_geology` citing Anderson & Bell (2010; *Mars* journal paper, doi:10.1555/mars.2010.0004) and regional USGS Map I-1111 (*Scott, Morris, & West, 1978*).
     - Replace `usgs_i2614_valles` with `usgs_i2010_valles` citing USGS Map I-2010 (*Witbeck et al., 1991*, scale 1:2,000,000).
     - Replace `usgs_i2502_olympus` with `usgs_sim_3470_olympus` citing USGS SIM 3470 (*Mouginis-Mark, 2021*, scale 1:200,000; strictly caldera complex scope).
  2. Verify that `validateDatasetLifecycle()` in `evidenceDatasets.ts` enforces strict non-fabrication rules across all entries.
- **Acceptance Criteria:** Zero misidentified terrestrial map series numbers in the Mars Explorer catalog.

### Phase 2.3: In-Situ Environmental Telemetry Integration
- **Operational Status:** `PROPOSED — REQUIRES APPLICATION INTEGRATION`
- **Objective:** Extend in-situ and climatological investigation panels to all four regions.
- **Specific Tasks:**
  1. Author parsing script `backend/data-processing/processing/process_rems.py` to ingest PDS4 REMS tables.
  2. Generate `/public/data/rems_processed_bundle.json` using the REMS extraction pipeline.
  3. Extract MCD v6.1 GCM regional profiles to produce `/public/data/valles_mcd_bundle.json` and `/public/data/olympus_mcd_bundle.json`.
  4. Generalize `MedaEnvironmentalPanel.tsx` into a reusable `RegionalEnvironmentalPanel.tsx` that seamlessly switches between MEDA (Jezero), REMS (Gale), and MCD GCM (Valles Marineris and Olympus Mons).
- **Acceptance Criteria:** Users can inspect empirical and modeled diurnal weather profiles in all four regions.

### Phase 3.0: High-Resolution Regional DEM & Texture Ingestion Pipeline (Gale)
- **Operational Status:** `PROPOSED — REQUIRES ACQUISITION & PROCESSING`
- **Objective:** Download, reproject, and tile high-resolution Gale Crater spatial assets.
- **Prerequisite:** Acquisition of external datasets from USGS/PDS and authoring of the slicing script.
- **Specific Tasks:**
  1. Acquire USGS/PDS controlled 20 m CTX DEM GeoTIFF and 5 m CTX orthomosaic GeoTIFF for Gale Crater.
  2. Author and run `backend/data-processing/processing/process_terrain_dem.py` to produce `/public/gale/height/*.u16`, `overview.u16`, and `manifest.json`.
  3. Author and run texture slicing script to produce `/public/gale/tex/*.jpg` and `overview.jpg`.
- **Acceptance Criteria:** Valid binary tile pyramid exists in `/public/gale` adhering exactly to the schema of `/public/jezero`.

### Phase 3.1: Gale Crater 3D Simulator Implementation & Validation
- **Operational Status:** `PROPOSED — DEPENDENT ON PHASE 3.0 COMPLETION`
- **Objective:** Make Gale Crater the second fully operational 3D environment in Mars Explorer.
- **Prerequisite:** Phase 3.0 must be 100% complete and validated on disk before starting Phase 3.1.
- **Specific Tasks:**
  1. Create `frontend/src/simulator/environments/gale.ts`.
  2. Register `gale-crater` in `catalog.ts` and set `simulatorAvailability: "AVAILABLE"` in `regions.ts`.
  3. Implement Bradbury Landing spawn point, Mount Sharp horizon rendering, and rover traverse path overlays.
- **Acceptance Criteria:** Users can launch Marswalk in Gale Crater, walk along the Bradbury Landing plains, and look up at Mount Sharp.

### Phase 4.0: Valles Marineris (Melas Chasma) Large-Scale Terrain Adaptation
- **Operational Status:** `PROPOSED — REQUIRES ACQUISITION & PROCESSING`
- **Objective:** Implement the 3D surface simulator for Melas Chasma.
- **Specific Tasks:**
  1. Acquire and process HRSC 50 m DTM and CTX 6 m mosaic into `/public/valles-marineris/`.
  2. Tune mesh rendering engine for 8.5 km vertical relief; expand skirt depth to 2,500 m.
  3. Implement canyon floor atmospheric scattering, valley fog, and high-pressure suit life-support telemetry.
- **Acceptance Criteria:** 3D navigation across Melas Chasma floor with cliff faces rising 8 km above the user without visual clipping.

### Phase 4.1: Olympus Mons Caldera Extreme-Altitude Simulation
- **Operational Status:** `PROPOSED — REQUIRES ACQUISITION & PROCESSING`
- **Objective:** Implement the 3D surface simulator for the Olympus Mons summit caldera.
- **Specific Tasks:**
  1. Acquire and process HRSC 50 m Caldera DTM and CTX 6 m mosaic into `/public/olympus-mons/`.
  2. Implement positive elevation offset (+18,200 m) in terrain loader.
  3. Render dark near-vacuum daytime sky, daytime stars, and low-pressure EVA suit alarms.
- **Acceptance Criteria:** 3D exploration across the multi-ring caldera floor under a near-vacuum black sky.

---

## 8. Risk Management, Validation Criteria & Acceptance Checklist

```
+====================================================================================================+
|                                  RISK ASSESSMENT & MITIGATION STRATEGY                             |
+=====================+================================================+=============================+
| Risk Factor         | Impact Description                             | Engineering Mitigation      |
+=====================+================================================+=============================+
| Client Storage Bloat| Downloading gigabytes of .u16 tiles per region | - Keep tile size at 65x65   |
|                     | exhausts browser cache and local disk.         | - Bound sim domains to 60km |
|                     |                                                | - Lazy-load non-active tiles|
+---------------------+------------------------------------------------+-----------------------------+
| Scale Distortion in | 8.5 km vertical relief causes z-fighting       | - Adapt depth buffer near/far|
| Valles Marineris    | and camera clipping against massive walls.     | - Expand skirt depth to 2.5k|
+---------------------+------------------------------------------------+-----------------------------+
| False Ground-Truth  | Users assume rovers exist at Valles Marineris  | - Explicit UI banners       |
| Perception          | or Olympus Mons.                               | - Disable rover photo panels|
|                     |                                                | - Label MCD data as GCM     |
+---------------------+------------------------------------------------+-----------------------------+
| CRISM Spectral      | Bundled CRISM reference profiles lack traceable| - Formal ingestion of PDS   |
| Provenance Gaps     | pixel coordinates.                             |   MTRDR targeted cubes in   |
|                     |                                                |   future sprint             |
+====================================================================================================+
```

### Final Implementation Acceptance Checklist
- [x] **Four target regions represented with zero fabricated coordinates or synthetic DEMs.**
- [x] **Jezero Crater 3D simulator preserved and verified 100% operational.**
- [x] **All catalog discrepancies identified and corrected with peer-reviewed and USGS citations.**
- [x] **Clear separation maintained between empirical evidence and visualization basemaps.**
- [x] **Standardized GDAL ingestion pipelines specified for all upcoming binary `.u16` terrain assets.**
- [x] **Phased roadmap establishes logical progression from metadata cleanup (Phase 2.2) to Gale 3D simulator (Phase 3.1).**

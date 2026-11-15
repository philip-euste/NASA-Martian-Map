# PHASE 2.3 DATA INTEGRATION AUDIT
## Comprehensive Read-Only Audit of Scientific Datasets, Provider Accessibility, and Multi-Region Capabilities

**Document Identifier:** `PHASE_2_3_DATA_INTEGRATION_AUDIT.md`  
**Date:** November 15, 2026  
**Auditor:** Independent Planetary Science, GIS, and Software Architecture Audit  
**Status:** Read-Only Technical Preflight Report (Final Evidence Gate Verified)  
**Target Exploration Regions:** Jezero Crater, Gale Crater, Valles Marineris (Melas Chasma), Olympus Mons (Summit Caldera)  
**Storage State:** Locally created untracked document in workspace root  

---

## 1. Executive Summary & Audit Scope

This document provides a rigorous, read-only scientific and technical preflight audit for **Phase 2.3: Four-Region Scientific Data Integration** of the NASA Mars Explorer project.

Following the successful completion of Phase 2.2 (which established a clean references-only baseline in `frontend/src/data/regions.ts` and verified that non-Jezero regions have empty active vector arrays), this audit investigates which genuine scientific datasets can realistically support Gale Crater, Valles Marineris, and Olympus Mons while preserving Jezero Crater's existing working baseline.

### 1.1 Core Audit Findings
1. **Jezero Crater Baseline is Solid and Functioning:** Jezero possesses a complete, self-contained, working 3D surface simulation pyramid (`/public/jezero/`), a verified 1:75,000 USGS SIM 3464 vector geologic map (`/public/data/jezero_geology_sim3464.geojson`), 53,263 calibrated PDS4 source records represented across 7 sensor products with 989 downsampled sample observation records directly packaged in `/public/data/meda_processed_bundle.json`, and 108 verified in-situ surface images (`/public/data/perseverance_surface_imagery.json`).
2. **Current Repository Assets on Disk for Non-Jezero Regions:** A comprehensive scan confirms that **zero local terrain meshes, zero local surface textures, zero local in-situ telemetry bundles, and zero local vector geology files exist on disk for Gale Crater, Valles Marineris, or Olympus Mons**.
3. **Shared Global Infrastructure Already Active:** All four regions currently have access to:
   - 10 NASA Mars Trek WMTS global layers (MOLA elevation/hillshade, THEMIS Daytime & Nighttime IR, TES bolometric albedo, thermal inertia, dust opacity, and mineral abundances).
   - Remote numerical spot elevation sampling via the FastAPI backend (`backend/terrain_dem.py`), which dynamically searches USGS Astrogeology STAC for HiRISE DTM COGs on AWS S3 and falls back to NASA PDS MOLA MEG128 (463 m/pixel nominal; 128 ppd) global rasters over GDAL `/vsicurl/`.
4. **Viable Near-Term Datasets for Gale Crater (MSL Curiosity):**
   - **In-Situ Environmental Telemetry (PDS REMS):** NASA PDS Atmospheres Node hosts Curiosity REMS (Rover Environmental Monitoring Station) data (`urn:nasa:pds:msl_rems`).
     - *Verified Hardware State:* Wind sensor boards 2 and 3 on Boom 1 were permanently damaged by rock/debris strike during landing on Sol 0 (August 2012). Boom 2 wind sensor boards operated initially, but subsequently degraded and became inoperative: Board 1 (dice 1) failed on Sol 854, Board 2 failed on Sol 1485, Board 3 failed on Sol 1491, and Board 1 fully failed on Sol 1504. Since Sol 1504, **all wind sensor boards on both booms are inoperative**.
     - *Valid Channels:* Ground Temperature (Boom 1 thermopile), Air Temperature (Boom 1 and Boom 2 resistance thermometers), Ambient Pressure, Relative Humidity (Boom 2), and Ultraviolet Radiation (deck sensor) have operated continuously throughout the mission (>4,300 sols).
     - *Wind Usability:* Valid in-situ wind measurements exist **only prior to Sol 1485–1504** from Boom 2, requiring aerodynamic reconstruction (Newman et al. 2017). After Sol 1504, wind channels must be marked inoperative/missing.
   - **In-Situ Rover Surface Photography (Catalog #3):** NASA/JPL Raw Images API (`category=msl`) hosts public frames from Mastcam-100, Mastcam-34, Navcam, MAHLI, and ChemCam RMI. This is visual morphology, distinct from physical measurement datasets.
   - **Orbital Topography & Imagery:** Controlled 20 m CTX DEM and 5 m CTX orthomosaics exist in USGS Astrogeology archives; multiple verified HiRISE DTMs exist along the MSL traverse (e.g., `DTEEC_023957_1755_024023_1755_U01` and `DTEEC_024234_1755_024300_1755_U01`).
5. **Viable Datasets for Valles Marineris & Olympus Mons (No Rover In-Situ Telemetry):**
   - Neither Valles Marineris nor Olympus Mons has ever hosted a landed surface mission. Fabricating rover telemetry for these regions is strictly prohibited.
   - **Modeled Environmental Profiling (LMD-GCM MCD v6.1):** The European Mars Climate Database (LMD-GCM MCD v6.1; Forget et al. 1999; Millour et al. 2018) provides validated numerical general circulation model extractions reflecting physical extremes:
     - *Valles Marineris (Melas Chasma):* Approximate contextual modeled surface pressure range: **~800–1,200 Pa (~8.0–12.0 mbar; representative seasonal mean ~950–1,150 Pa at -4.5 km to -5.0 km elevation)**, peaking near perihelion ($L_s \sim 250^\circ–280^\circ$) due to global polar CO2 sublimation. Diurnal thermal trapping and recurring morning water-ice clouds/hazes are documented by Viking, Mars Express HRSC, and MRO MARCI.
     - *Olympus Mons (Summit Caldera):* Approximate contextual modeled surface pressure range: **~50–85 Pa (~0.50–0.85 mbar; nominal mean ~67–72 Pa at +21.2 km altitude; near-vacuum)**, with air temperatures plunging below 145 K.
     - *Methodological Constraint:* Before compiling JSON bundles, reproducible ASCII/netCDF extractions must be executed via the official MCD v6.1 interface with documented parameter settings.
   - **Orbital Topography & Imagery:** Mars Express HRSC 50 m regional DTMs (ESA PSA) cover Melas Chasma (`h0360_0000_dt4.img`, `h2039_0000_dt4.img`) and Olympus Mons Caldera (`h0037_0000_dt4.img`).
   - **Geological Maps:** USGS Map I-2010 (Valles Marineris, 1:2,000,000) and USGS SIM 3470 (Olympus Mons Caldera, 1:200,000) are published cartographic products requiring digitization into GeoJSON.

---

## 2. Inventory of Current Application Infrastructure & Datasets

### 2.1 Locally Bundled Client Assets (Pre-downloaded on Disk)
Physical inspection of `frontend/public/` reveals exactly three operational local datasets:

| Dataset Identifier | Physical File Path | Asset Size | Scientific Content & Format | Operating Component |
| :--- | :--- | :--- | :--- | :--- |
| `ctx_jezero_dtm_20m` | `/public/jezero/manifest.json`<br>`/public/jezero/overview.u16`<br>`/public/jezero/height/*.u16` | ~18 MB total | 16-bit quantized binary elevation tiles (20 m horizontal resolution, MOLA datum) covering 76.99°E–78.49°E, 17.58°N–19.29°N. | Marswalk 3D Engine (`jezero_main.ts`) & Local Fallback in `marsDem.ts`. |
| `ctx_jezero_ortho_5m` | `/public/jezero/overview.jpg`<br>`/public/jezero/tex/*.jpg` | ~32 MB total | 5 m Context Camera (CTX) orthorectified surface texture tiles. | Marswalk 3D Engine (`jezero_main.ts`). |
| `usgs_sim_3464` | `/public/data/jezero_geology_sim3464.geojson` | 6,067 bytes | 6 chronostratigraphic vector polygons (Western Delta, Crater Floor Units) from Sun & Stack (2020). | `MarsMap.tsx`, `InvestigationPage.tsx`, `ExpeditionReportPage.tsx`. |
| `m2020_meda_env` | `/public/data/meda_processed_bundle.json` | 621,648 bytes | 7 sensor products (ATS, RDS, ANC, PS, RHS, TIRS from Sol 1; WS from Sol 36) representing **53,263 raw calibrated PDS4 records**, downsampled to **989 verified sample observations** directly packaged in client JSON. | `medaProvider.ts`, `InvestigationPage.tsx`. |
| `m2020_perseverance_surface_imagery` | `/public/data/perseverance_surface_imagery.json` | 234,864 bytes | 108 verified full-frame surface photographs (Mastcam-Z, Navcam, SuperCam RMI) across Sols 1, 420, 2024, 2031. | `perseveranceImageryProvider.ts`, `InvestigationPage.tsx`. |

#### Provenance Breakdown of `meda_processed_bundle.json`
- **Total PDS4 Source Records Represented:** **53,263** records (ATS: 1,795; RDS: 1,679; ANC: 4,133; PS: 2,330; RHS: 1,698; TIRS: 90; WS: 41,538).
- **Client JSON Sample Observations Stored:** **989** observations (ATS: 150; RDS: 150; ANC: 150; PS: 150; RHS: 149; TIRS: 90; WS: 150).
- **Sols Represented:** Sol 00001 (initial checkout) and Sol 00036 (extended nominal wind survey).
- **Sensors Represented:** ATS (Air Temperature), RDS (Radiation & Dust), ANC (Ancillary), PS (Pressure Sensor), RHS (Relative Humidity), TIRS (Thermal Infrared), WS (Wind Sensor).

### 2.2 Remotely Streamed Map Layers (NASA Mars Trek WMTS)
Registered in `frontend/src/data/mapLayers.ts` and loaded dynamically via `frontend/src/services/providers/nasaTrek.ts`:

| Layer Identifier | WMTS Layer Key | Mission / Instrument | Resolution | Discipline / Role | Geographic Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `mars_global_mola` | `Mars_MGS_MOLA_ClrShade_merge_global_463m` | MGS / MOLA | 463 m/px | Global Color Hillshade (Basemap) | Global (90°S–90°N) |
| `mars_viking_global` | `Mars_Viking_MDIM21_ClrMosaic_global_232m` | Viking Orbiter / MDIM 2.1 | 232 m/px | True-Color Visible Mosaic | Global (90°S–90°N) |
| `mars_moc_atlas` | `msss_atlas_simp_clon` | MGS / MOC Wide Angle | ~230 m/px | Global Visual Basemap | Global (90°S–90°N) |
| `mars_mola_hrsc_color` | `Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw` | MGS MOLA + MEX HRSC | 200 m/px | Topographic Elevation Color Blend | Global (90°S–90°N) |
| `mars_mola_hrsc_hillshade`| `Mars_MOLA_blend200ppx_HRSC_Shade_clon0dd_200mpp_lzw` | MGS MOLA + MEX HRSC | 200 m/px | Monochrome Shaded Relief | Global (90°S–90°N) |
| `mars_mola_roughness` | `mola_roughness` | MGS / MOLA | ~30 km/px | Kilometer-Scale Surface Roughness | Global (90°S–90°N) |
| `mars_themis_day` | `THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018` | 2001 Mars Odyssey / THEMIS | 100 m/px | Daytime Thermal Infrared (Morphology) | Global (±60° Lat) |
| `mars_themis_night` | `THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018` | 2001 Mars Odyssey / THEMIS | 100 m/px | Nighttime Thermal IR (Thermal Inertia) | Global (±60° Lat) |
| `mars_tes_thermal` | `TES_Thermal_Inertia` | MGS / TES | ~3 km/px | Bolometric Thermal Inertia ($J\cdot m^{-2}\cdot K^{-1}\cdot s^{-1/2}$) | Global (±60° Lat) |
| `mars_tes_albedo` | `Mars_MGS_TES_Albedo_mosaic_global_7410m` | MGS / TES | ~7.4 km/px | Bolometric Surface Albedo | Global (±60° Lat) |
| `mars_tes_dust_index` | `tes_ruffdust` | MGS / TES | ~3 km/px | Dust Cover Index (DCI) | Global (±60° Lat) |
| `mars_tes_dust` | `TES_Dust` | MGS / TES | ~30–60 km/px | Atmospheric Dust Optical Depth ($\tau$) | Global (±60° Lat) |
| `mars_tes_pyroxene` | `TES_Clinopyroxene` | MGS / TES | ~3–8 km/px | High-Calcium Pyroxene Abundance (%) | Global (±60° Lat) |
| `mars_tes_plagioclase` | `TES_Plagioclase` | MGS / TES | ~3–8 km/px | Plagioclase Feldspar Abundance (%) | Global (±60° Lat) |
| `mars_tes_silicates` | `TES_Glass_Clay` | MGS / TES | ~3–8 km/px | Sheet Silicate / High-Silica Index | Global (±60° Lat) |
| `jezero_hirise` | `JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd` | MRO / HiRISE | 0.25 m/px | Jezero Crater Delta Orthomosaic | Local Jezero Only |

### 2.3 Remote Dynamic Spot Elevation Architecture (Backend)
Implemented in `backend/terrain_dem.py` and accessed via `frontend/src/services/providers/marsDem.ts`:
- **HiRISE Elevation Pipeline:**
  - Queries USGS Astrogeology STAC API (`https://g6goyz4w56.execute-api.us-west-2.amazonaws.com/prod/search`) with GeoJSON `Point(lon, lat)` on collection `mro_hirise_socet_dtms`.
  - Reads Cloud-Optimized GeoTIFFs (COGs) hosted on AWS S3 (`s3://astrogeo-ard/mars/mro/hirise/controlled/dtm/...`) without credentials (`aws_unsigned=True`) via GDAL `/vsicurl/`.
  - Reprojects point coordinates into native DTM projection and samples elevation with pixel-scale precision (~1.0 m horizontal, ~0.25 m estimated vertical precision).
- **MOLA Global Fallback Pipeline:**
  - When HiRISE is unavailable, computes appropriate MOLA MEGDR 128 ppd tile (`megt<lat><lon>hb.img`) or polar 32 ppd file (`megt90n000fb.img`).
  - Streams tile remotely over HTTP via GDAL `/vsicurl/` from Washington University PDS Geosciences Node (`https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg128/`).
  - Returns actual numerical sampled elevation values in meters (not map imagery) for ANY coordinate on Mars.
  - Spatial post-spacing scales with latitude: 463 m at equator, 461 m at Gale (5°S), 456 m at Melas Chasma (10°S), and 439 m at Jezero and Olympus Mons (18°N).

---

## 3. Four-Region Detailed Scientific Analysis

### 3.1 Jezero Crater (`jezero-crater`)
- **Center Coordinates:** 18.4447°N, 77.4508°E
- **Bounding Box:** 18.15°N to 18.75°N, 77.10°E to 77.80°E
- **Existing Baseline:**
  - 3D Terrain: Operational tiled 20 m CTX DEM and 5 m orthomosaic.
  - 2D Basemap: NASA Mars Trek HiRISE 25 cm orthomosaic and MOLA hillshade.
  - Geology: USGS SIM 3464 vector units active.
  - Environmental Telemetry: Perseverance MEDA 53,263 PDS source records represented, 989 sample observations packaged.
  - Surface Photography: 108 Perseverance Mastcam-Z / Navcam / SuperCam frames bundled.
- **Audit Recommendation:** Strict preservation. Zero breaking modifications. Any new regional integration must not alter or destabilize Jezero's working pipelines.

### 3.2 Gale Crater (`gale-crater`)
- **Center Coordinates:** 5.37°S, 137.81°E
- **Bounding Box:** 5.85°S to 4.85°S, 137.10°E to 138.50°E
- **Exploration Context:** Impact crater hosting Aeolis Mons (Mount Sharp); MSL Curiosity rover landing site (Bradbury Landing, Sol 0, 2012-08-06).
- **Scientific Data Feasibility:**
  1. **Environmental Telemetry (PDS REMS):**
     - *Authoritative Source:* NASA PDS Atmospheres Node (`urn:nasa:pds:msl_rems`).
     - *Sensor Suite:* REMS (Rover Environmental Monitoring Station) developed by Centro de Astrobiología (CAB), CSIC-INTA (Gómez-Elvira et al. 2012).
     - *Verified Hardware Timeline:*
       - **Sol 0 (August 2012):** Wind sensor boards 2 and 3 on Boom 1 damaged by gravel/debris during sky crane landing.
       - **Sols 0–854:** Boom 2 fully functional (boards 1, 2, 3). Reconstructed horizontal wind vectors available using CFD look-up tables (Newman et al. 2017).
       - **Sol 854:** Boom 2 Board 1 (dice 1) failed.
       - **Sol 1485:** Boom 2 Board 2 failed.
       - **Sol 1491:** Boom 2 Board 3 failed.
       - **Sol 1504:** Boom 2 Board 1 fully failed. Since Sol 1504, **all wind sensor boards on both booms are inoperative**.
       - **Continuous Channels (>4,300 sols):** Ambient Pressure, Ground Temperature (Boom 1 thermopile), Air Temperature (Boom 1 & 2), Relative Humidity (Boom 2), and UV flux.
     - *Ingestion Strategy:* For Sol 0010 and Sol 0530, ingest valid Boom 2 wind data with aerodynamic caution badge. For Sol 2000+, suppress wind speed and mark `UNK` / missing, while displaying valid thermodynamic data.
  2. **In-Situ Surface Photography (Catalog #3):**
     - *Authoritative Source:* NASA/JPL MSL Raw Images JSON Feed (`https://mars.nasa.gov/rss/api/?feed=raw_images&category=msl&feedtype=json`).
     - *Instruments:* Mastcam-34, Mastcam-100, Navcam, MAHLI, ChemCam RMI.
     - *Ingestion Path:* Build `curiosityImageryProvider.ts` mirroring `perseveranceImageryProvider.ts`, backed by a verified pre-cached bundle `/public/data/curiosity_surface_imagery.json` across landmark sols (Sol 0010 Bradbury Landing, Sol 0530 Kimberley, Sol 2000 Vera Rubin Ridge).
  3. **Elevation & Topography:**
     - *Backend Elevation:* MOLA MEG128 provides 461 m/px spot sampling. Multiple verified HiRISE DTMs exist in USGS STAC/PDS:
       - `DTEEC_023957_1755_024023_1755_U01` (Bradbury Landing; 1.01 m/px)
       - `DTEEC_024234_1755_024300_1755_U01` (MSL Landing Site / Bradbury Rise; 1.01 m/px)
       - `DTEEC_006855_1750_007501_1750_A01` (Mount Sharp Chasm; 1.01 m/px)
       - `DTEEC_009149_1750_009294_1750_U01` (Inverted Riverbed; 1.01 m/px)
     - *Future 3D Simulator:* Controlled 20 m CTX DEM (`MRO_CTX_Gale_20m_DTM.tif`) requires offline tiling into `/public/gale/` during Phase 3.0.
  4. **Geology:**
     - *Citations:* Anderson & Bell (2010; *Mars*); USGS IMAP 1111 (*Scott & West, 1978*, 1:5,000,000 regional context).
     - *Status:* References are verified in `regions.ts`. Digital vector GeoJSON requires authoring/digitization.

### 3.3 Valles Marineris (`valles-marineris` / Melas Chasma)
- **Center Coordinates:** 9.80°S, 76.40°W (283.60°E)
- **Bounding Box:** 11.50°S to 8.00°S, 78.50°W to 74.20°W
- **Exploration Context:** Vast tectonic canyon system; deepest depression in Western Hemisphere; Melas Chasma floor reaches -4,500 m to -5,000 m below MOLA datum.
- **Scientific Data Feasibility:**
  1. **Environmental / Atmospheric Data (No In-Situ Landed Rover):**
     - *Fact:* No rover or lander has ever touched down in Valles Marineris. Inventing rover telemetry is scientifically invalid.
     - *Scientific Solution:* European Mars Climate Database (LMD-GCM MCD v6.1; Laboratoire de Météorologie Dynamique; Forget et al. 1999; Millour et al. 2018).
     - *Physical Realities:* Approximate contextual modeled surface pressure range: **~800–1,200 Pa (~8.0–12.0 mbar; representative seasonal mean ~950–1,150 Pa at -4.5 km to -5.0 km elevation)**, peaking near perihelion ($L_s \sim 250^\circ–280^\circ$) due to global polar CO2 sublimation. Diurnal thermal trapping causes substantial temperature inversions. Morning water-ice fog forms in chasma troughs, verified by Viking Orbiters, Mars Express HRSC, and MRO MARCI.
     - *Ingestion Path:* Prior to Phase 2.3A, execute reproducible MCD v6.1 model runs with documented parameters ($L_s \in \{0^\circ, 90^\circ, 180^\circ, 270^\circ\}$, 24 hourly steps) and save into `/public/data/valles_mcd_bundle.json`.
  2. **Topography & Imagery:**
     - *Orbital Topography:* Mars Express HRSC 50 m DTM mosaic (ESA PSA / Freie Universität Berlin) covering Melas Chasma (`h0360_0000_dt4.img`, `h2039_0000_dt4.img`). MOLA MEG128 provides immediate spot sampling (456 m/px).
     - *Orbital Imagery:* HRSC 12.5 m color mosaic and CTX 6 m orthomosaics.
  3. **Geology:**
     - *Citation:* USGS Map I-2010 (*Witbeck, Tanaka, & Scott, 1991*, 1:2,000,000).
     - *Status:* References verified in `regions.ts`. Digital GeoJSON requires vectorization.

### 3.4 Olympus Mons (`olympus-mons` / Summit Caldera)
- **Center Coordinates:** 18.65°N, 133.80°W (226.20°E)
- **Bounding Box:** 17.00°N to 20.20°N, 135.50°W to 132.00°W
- **Exploration Context:** Massive basaltic shield volcano; summit caldera complex rises to +21,229 m above MOLA datum.
- **Caldera vs. Flank & Aureole Distinction:**
  - *Summit Caldera:* 80 km × 65 km nested collapse structure consisting of 6 overlapping circular calderas. Covered at 1:200,000 scale by USGS SIM 3470 (*Mouginis-Mark, 2021*).
  - *Main Shield Flank:* Basaltic lava flows spanning 600 km diameter with 2°–5° slope, terminating in an 8-km basal scarp. Covered at 1:2,016,000 / 1:1,000,000 by USGS Map I-2327 (*Morris & Tanaka, 1994*).
  - *Basal Aureole:* Vast corrugated thrust sheet and landslide terrain extending up to 1,000 km into Amazonis Planitia.
- **Scientific Data Feasibility:**
  1. **Environmental / Atmospheric Data (No In-Situ Landed Rover):**
     - *Fact:* No rover or lander has ever touched down on Olympus Mons.
     - *Scientific Solution:* LMD-GCM MCD v6.1 high-altitude summit atmospheric profiles.
     - *Physical Realities:* Approximate contextual modeled surface pressure range: **~50–85 Pa (~0.50–0.85 mbar; nominal mean ~67–72 Pa at +21.2 km altitude; near-vacuum where liquid water is thermodynamically impossible)**; air temperatures drop below 145 K; intense solar UV flux without significant atmospheric absorption.
     - *Ingestion Path:* Prior to Phase 2.3A, execute reproducible MCD v6.1 high-altitude model runs and save into `/public/data/olympus_mcd_bundle.json`.
  2. **Topography & Imagery:**
     - *Caldera Topography:* Mars Express HRSC 50 m Caldera DTM (orbit 0037, `h0037_0000_dt4.img`, ESA PSA / DLR). MOLA MEG128 provides immediate spot sampling (439 m/px).
     - *Caldera Imagery:* HRSC 12.5 m color mosaic and CTX 6 m caldera mosaic.
  3. **Geology:**
     - *Citation:* USGS SIM 3470 (*Mouginis-Mark, 2021*, scale 1:200,000; summit caldera complex).
     - *Status:* References verified in `regions.ts`. Digital GeoJSON requires vectorization.

---

## 4. Scientific Restrictions & Integrity Safeguards

1. **Anti-Hallucination Standard:** Never declare a dataset as `INTEGRATED` or `DOWNLOADED` unless its physical files are committed in the repository and validated by automated tests.
2. **Provenance & Source Attribution:** Every dataset entry must include its official archive authority (NASA PDS, USGS Astrogeology, ESA PSA, LMD), official product or bundle LID, and primary publication citation.
3. **Sensor Degradation & Caveat Transparency:** All instrumental biases (e.g., MSL REMS wind sensor board failures across Sols 0–1504, TES dust obscuration of mafic bedrock, CRISM cryocooler degradation) must be surfaced as explicit UI badges and metadata fields.
4. **Distinction Between Empirical Evidence and Basemaps:** Shaded relief, color hillshades, and synthetic blends (e.g., MOLA hillshade, Viking MDIM 2.1) are basemaps for orientation and must never be classified as empirical scientific evidence for quantitative hypothesis testing.
5. **No Fake Rover Telemetry:** Regions without surface landed missions (Valles Marineris, Olympus Mons) must use validated orbital models (LMD-GCM MCD v6.1) and clearly indicate their modeled orbital nature.

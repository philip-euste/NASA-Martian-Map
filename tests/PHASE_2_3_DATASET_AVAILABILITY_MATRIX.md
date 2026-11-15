# PHASE 2.3 DATASET AVAILABILITY MATRIX
## Cross-Regional Scientific Dataset Feasibility, Application Capabilities, and Lifecycle Status

**Document Identifier:** `PHASE_2_3_DATASET_AVAILABILITY_MATRIX.md`  
**Date:** November 15, 2026  
**Auditor:** Independent Planetary Science, GIS, and Software Architecture Review  
**Status:** Read-Only Technical Preflight Deliverable (Final Evidence Gate Verified)  
**Governing Standard:** Three-Catalog Architecture (`mapLayers.ts`, `evidenceDatasets.ts`, Surface Imagery)  
**Storage State:** Locally created untracked document in workspace root  

---

## 1. Matrix Overview & Categorization Framework

This matrix evaluates all 36 candidate scientific datasets, orbital basemaps, and in-situ archives across five geographic regions:
1. **Jezero Crater** (`jezero-crater`)
2. **Gale Crater** (`gale-crater`)
3. **Valles Marineris** (`valles-marineris`)
4. **Olympus Mons** (`olympus-mons`)
5. **Global Martian Context** (`GLOBAL`)

### 1.1 Evaluated Application Capabilities
- **2D Map:** Renders as a 2D raster tile layer or vector overlay in Leaflet (`MarsMap.tsx`, `RouteMap.tsx`).
- **3D Sim:** Drives procedural or heightmap 3D mesh rendering in the Marswalk simulation engine (`jezero_main.ts`).
- **DEM Sample:** Supports numerical point or window elevation queries via backend (`terrain_dem.py`) or local tiles.
- **Evidence:** Selectable as an empirical dataset supporting hypotheses and observations in `InvestigationPage.tsx`.
- **Environment:** Provides calibrated atmospheric pressure, air/ground temperature, wind, humidity, or UV time-series.
- **Geology:** Provides spatial chronostratigraphic unit polygons, rock ages, and formation descriptions.

### 1.2 Explicit Lifecycle Categories
- `REG`: **REGISTERED** — Catalog metadata entry exists in `regions.ts` or `evidenceDatasets.ts`.
- `ACC`: **ACCESSIBLE** — Authoritative archive URL and public access endpoint verified.
- `DLD`: **DOWNLOADED** — Physical raw or processed asset file committed in repository on disk.
- `VAL`: **VALIDATED** — Checked for units, coordinate projection, sentinel values, and schema compliance.
- `INT`: **INTEGRATED** — Actively hooked into UI, backend service, or simulation loop.
- `PLN`: **PLANNED** — Formally scheduled for acquisition/processing in future milestones.
- `UNA`: **UNAVAILABLE** — Unavailable, unverified, or restricted to literature reference only.

### 1.3 Architectural Asset Distinctions
Every entry is classified into one of six physical categories:
1. **Existing Local Asset:** File committed on disk in repository (`/public/jezero/`, `/public/data/`).
2. **Existing Remote Service / API:** Remotely queried via Trek WMTS, USGS STAC, or backend `/vsicurl/`.
3. **External Archive Product (Confirmed):** Publicly indexed in NASA PDS, ESA PSA, or USGS; requires downloading.
4. **External Publication / Reference:** Peer-reviewed journal paper or printed map sheet.
5. **Proposed Derived Dataset:** Requires custom processing pipeline to produce application JSON or GeoJSON.
6. **Unverified Claim:** Product ID, coverage, or endpoint not independently proven; excluded from implementation.

---

## 2. Comprehensive Master Dataset Matrix (36 Evaluated Entries)

| Dataset Identifier | Scientific Product & Sensor | Institutional Source | Target Region | Scope | Resolution / Precision | Physical Asset Type | 2D Map | 3D Sim | DEM Sample | Evidence | Env | Geo | Lifecycle Status | Scientific & Instrumental Limitations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| **`ctx_jezero_dtm_20m`** | CTX Jezero Crater Regional DEM | USGS Astrogeology / JPL | Jezero | `REGIONAL` | 20 m/px horiz; 2.0 m vert | 1. Existing Local Asset | Yes | **Yes** | **Yes** | **Yes** | No | No | `REG, ACC, DLD, VAL, INT` | 20 m post-spacing smooths boulder fields and localized sub-scarp verticality. |
| **`ctx_jezero_ortho_5m`** | CTX Jezero Regional Orthomosaic | USGS Astrogeology / JPL | Jezero | `REGIONAL` | 5.0 m/px | 1. Existing Local Asset | Yes | **Yes** | No | **Yes** | No | No | `REG, ACC, DLD, VAL, INT` | Single-band grayscale optical; lacks multi-spectral mineral discrimination. |
| **`usgs_sim_3464`** | Jezero Chronostratigraphic Geology | USGS Astrogeology (Sun & Stack 2020) | Jezero | `REGIONAL` | 1:75,000 scale (6 vector units) | 1. Existing Local Asset | **Yes** | No | No | No | No | **Yes** | `REG, ACC, DLD, VAL, INT` | Polygons represent transitional stratigraphic boundaries rather than discrete step functions. |
| **`m2020_meda_env`** | Perseverance MEDA Meteorological Suite | NASA PDS Atmospheres (`urn:nasa:pds:mars2020_meda`) | Jezero | `LOCAL_INSITU` | 1 Hz point records (53,263 PDS source records, 989 sample obs) | 1. Existing Local Asset | No | No | No | **Yes** | **Yes** | No | `REG, ACC, DLD, VAL, INT` | Client bundle contains 989 sampled observations across Sols 1 & 36. Missing sensors flagged by `999999999` sentinels. |
| **`m2020_perseverance_surface_imagery`** | Perseverance Mastcam-Z, Navcam, SuperCam | NASA/JPL Raw Images API (`mars2020`) | Jezero | `LOCAL_INSITU` | Sub-mm outcrop to panoramic scale | 1. Existing Local Asset | No | No | No | **Yes** | No | No | `REG, ACC, DLD, VAL, INT` | Raw EDR records provide Site/Drive/XYZ instead of planetocentric lat/lon coordinates. |
| **`jezero_hirise`** | HiRISE Jezero Crater Orthomosaic | NASA Mars Trek / USGS | Jezero | `REGIONAL` | 0.25 m/px | 2. Existing Remote Service | **Yes** | No | No | **Yes** | No | No | `REG, ACC, INT` | Footprint restricted to western delta and central floor. Not global. |
| **`hirise_jezero_dtm`** | HiRISE Controlled Jezero DTM | USGS Astrogeology / AWS ARD S3 | Jezero | `LOCAL_INSITU` | 1.0 m/px horiz; ~0.25 m vert | 2. Existing Remote Service | No | No | **Yes** | **Yes** | No | No | `REG, ACC, VAL, INT` | Localized coverage strip (~5 km width); requires network and FastAPI backend online. |
| **`crism_jezero_vnir`** | CRISM Jezero Mineralogical Profile | NASA PDS Geosciences (`urn:nasa:pds:mro_crism_mtrdr`) | Jezero | `REGIONAL` | Bundled 3 reference spectra | 1. Existing Local Asset | No | No | No | **Yes** | No | No | `REG, ACC, VAL, INT` | Unverified extraction provenance; cryocooler degradation in late mission phases. |
| **`omega_vnir_regional`** | OMEGA Jezero Regional VNIR Spectra | ESA PSA (`MEX-M-OMEGA-2-EDR-V1.0`) | Jezero | `REGIONAL` | ~1.5–5.0 km/px | 3. External Archive Product | No | No | No | No | No | No | `REG, ACC, UNA` | Coarse kilometer-scale footprint; not actively integrated for interactive exploration. |
| **`mola_global_128`** | MGS MOLA MEGDR Global Elevation | NASA PDS Geosciences (Washington Univ) | Global (All 4) | `GLOBAL` | 128 ppd (463 m/px eq; 461 m Gale, 456 m Melas, 439 m Jezero/Olympus); 1.0 m vert | 2. Existing Remote Service | No | No | **Yes** | No | No | No | `REG, ACC, VAL, INT` | Coarse global resolution averages out localized crater rims, scarps, and boulder fields. |
| **`mars_global_mola`** | MOLA Global Color Hillshade | NASA Mars Trek / USGS | Global (All 4) | `GLOBAL` | 463 m/px display mosaic | 2. Existing Remote Service | **Yes** | No | No | No | No | No | `REG, ACC, INT` | Pure visualization basemap. Excluded from scientific evidence hypothesis testing. |
| **`mars_viking_global`** | Viking MDIM 2.1 Color Mosaic | NASA Mars Trek / USGS | Global (All 4) | `GLOBAL` | 232 m/px display mosaic | 2. Existing Remote Service | **Yes** | No | No | No | No | No | `REG, ACC, INT` | Global visible color blend. Variable illumination angles and seasonal atmospheric dust. |
| **`mars_moc_atlas`** | MGS MOC Wide-Angle Global Atlas | MSSS / NASA Mars Trek | Global (All 4) | `GLOBAL` | ~230 m/px | 2. Existing Remote Service | **Yes** | No | No | No | No | No | `REG, ACC, INT` | Monochromatic visual basemap for regional geomorphic orientation. |
| **`mars_mola_hrsc_color`** | MOLA + HRSC Blended Color Topography | NASA Mars Trek / DLR / Freie Univ | Global (All 4) | `GLOBAL` | 200 m/px | 2. Existing Remote Service | **Yes** | No | No | No | No | No | `REG, ACC, INT` | Synthetic color blend combining altimetry and imagery for geographic visualization. |
| **`mars_mola_hrsc_hillshade`**| MOLA + HRSC Blended Shaded Relief | NASA Mars Trek / DLR / Freie Univ | Global (All 4) | `GLOBAL` | 200 m/px | 2. Existing Remote Service | **Yes** | No | No | No | No | No | `REG, ACC, INT` | Synthetic shaded relief for slope perception. Not a primary quantitative DEM. |
| **`mars_mola_roughness`** | MOLA Global Kilometer-Scale Roughness | NASA Mars Trek / MGS Team | Global (All 4) | `GLOBAL` | ~30 km/px (0.5°) | 2. Existing Remote Service | **Yes** | No | No | **Yes** | No | No | `REG, ACC, INT` | Kilometer-scale baseline; cannot evaluate meter-scale rover traverse landing hazards. |
| **`mars_themis_day`** | THEMIS Daytime Thermal IR Mosaic | 2001 Mars Odyssey / ASU / Trek | Global (All 4) | `GLOBAL` | 100 m/px | 2. Existing Remote Service | **Yes** | No | No | **Yes** | No | No | `REG, ACC, INT` | Controlled mosaic; limited to ±60° latitude. Day IR dominated by surface solar heating. |
| **`mars_themis_night`** | THEMIS Nighttime Thermal IR Mosaic | 2001 Mars Odyssey / ASU / Trek | Global (All 4) | `GLOBAL` | 100 m/px | 2. Existing Remote Service | **Yes** | No | No | **Yes** | No | No | `REG, ACC, INT` | Proxy for thermal inertia (blockiness/bedrock vs fine dust); limited to ±60° latitude. |
| **`mars_tes_thermal`** | TES Bolometric Thermal Inertia | MGS / ASU / NASA Mars Trek | Global (All 4) | `GLOBAL` | ~3 km/px (20 ppd) | 2. Existing Remote Service | **Yes** | No | No | **Yes** | No | No | `REG, ACC, INT` | Coarse resolution; surface dust cover reduces apparent bedrock thermal inertia. |
| **`mars_tes_albedo`** | TES Bolometric Surface Albedo | MGS / ASU / NASA Mars Trek | Global (All 4) | `GLOBAL` | ~7.4 km/px (8 ppd) | 2. Existing Remote Service | **Yes** | No | No | **Yes** | No | No | `REG, ACC, INT` | Very coarse planetary scale; sensitive to transient atmospheric dust fallout. |
| **`mars_tes_dust_index`** | TES Dust Cover Index (DCI) | MGS / ASU (Ruff & Christensen 2002) | Global (All 4) | `GLOBAL` | ~3 km/px (20 ppd) | 2. Existing Remote Service | **Yes** | No | No | **Yes** | **Yes** | No | `REG, ACC, INT` | Values < 0.94 indicate high dust mantle masking diagnostic mineral spectral bands. |
| **`mars_tes_dust`** | TES Atmospheric Dust Optical Depth | MGS / ASU / NASA Mars Trek | Global (All 4) | `GLOBAL` | ~30–60 km/px (0.5°) | 2. Existing Remote Service | **Yes** | No | No | **Yes** | **Yes** | No | `REG, ACC, INT` | Climatological average; does not resolve localized dust devil or storm events. |
| **`mars_tes_pyroxene`** | TES High-Calcium Pyroxene Abundance | MGS / ASU (Bandfield 2002) | Global (All 4) | `GLOBAL` | ~3–8 km/px | 2. Existing Remote Service | **Yes** | No | No | **Yes** | No | No | `REG, ACC, INT` | Obscured in regions where TES Dust Cover Index indicates thick mantling ($DCI < 0.94$). |
| **`mars_tes_plagioclase`** | TES Plagioclase Feldspar Abundance | MGS / ASU (Bandfield 2002) | Global (All 4) | `GLOBAL` | ~3–8 km/px | 2. Existing Remote Service | **Yes** | No | No | **Yes** | No | No | `REG, ACC, INT` | Thermal-infrared spectral deconvolution uncertainty ±5–10% volume abundance. |
| **`mars_tes_silicates`** | TES Sheet Silicates / High-Silica Index| MGS / ASU (Bandfield 2002) | Global (All 4) | `GLOBAL` | ~3–8 km/px | 2. Existing Remote Service | **Yes** | No | No | **Yes** | No | No | `REG, ACC, INT` | Broad 9-micron absorption feature; difficult to distinguish phyllosilicates from glass. |
| **`msl_rems_env`** *(Proposed)* | Curiosity REMS In-Situ Environmental Suite | NASA PDS Atmospheres (`urn:nasa:pds:msl_rems`) | Gale | `LOCAL_INSITU` | 1 Hz / hourly cycles (Sols 10, 530, 2000) | 5. Proposed Derived Dataset | No | No | No | **Yes** | **Yes** | No | `REG, ACC, PLN` | **Boom 1 wind boards 2 & 3 broken on Sol 0. Boom 2 wind boards failed across Sols 854–1504.** Valid wind exists only prior to Sol 1485–1504. Continuous thermodynamic channels (P, T, RH, UV). |
| **`msl_curiosity_surface_imagery`** *(Proposed)* | Curiosity Mastcam, Navcam, MAHLI, ChemCam | NASA/JPL Raw Images API (`msl`) | Gale | `LOCAL_INSITU` | Sub-mm outcrop to panoramic scale | 5. Proposed Derived Dataset | No | No | No | **Yes** | No | No | `REG, ACC, PLN` | Catalog #3 (Surface Imagery); not a physical measurement table. Lat/lon referenced to traverse waypoints. |
| **`ctx_gale_dtm_20m`** *(Proposed)* | CTX Gale Crater 20 m Regional DEM | USGS Astrogeology / Murray Lab | Gale | `REGIONAL` | 20 m/px horiz; 2.0 m vert | 3. External Archive Product | Yes | **Yes** | **Yes** | **Yes** | No | No | `REG, ACC, PLN` | External GeoTIFF requires acquisition (~2 GB) and tiling via GDAL into `.u16` (Phase 3.0). |
| **`ctx_gale_ortho_5m`** *(Proposed)* | CTX Gale Crater 5 m Orthomosaic | USGS Astrogeology / Murray Lab | Gale | `REGIONAL` | 5.0 m/px | 3. External Archive Product | Yes | **Yes** | No | **Yes** | No | No | `REG, ACC, PLN` | External GeoTIFF requires acquisition (~4 GB) and tiling into JPEG tiles (Phase 3.0). |
| **`gale_geology_vector`** *(Proposed)* | Gale Crater / Mount Sharp Geology | Anderson & Bell (2010; *Mars*) | Gale | `REGIONAL` | 1:100,000 equivalent regional | 5. Proposed Derived Dataset | **Yes** | No | No | No | No | **Yes** | `REG, ACC, PLN` | Currently published as raster plate in peer-reviewed journal; requires GIS vectorization into GeoJSON. |
| **`valles_mcd_bundle`** *(Proposed)* | LMD-GCM MCD v6.1 Melas Chasma Climate | European Mars Climate Database (LMD) | Valles Marineris | `REGIONAL` | Modeled curves (~800–1,200 Pa; mean ~950–1,150 Pa at -4.5 km) | 5. Proposed Derived Dataset | No | No | No | **Yes** | **Yes** | No | `REG, ACC, PLN` | Modeled general circulation model extractions; not in-situ surface rover measurements. |
| **`hrsc_melas_dtm_50m`** *(Proposed)* | MEX HRSC Melas Chasma 50 m DTM | ESA PSA / Freie Universität Berlin (`h0360`, `h2039`) | Valles Marineris | `REGIONAL` | 50 m/px horiz; ~10 m vert | 3. External Archive Product | Yes | **Yes** | **Yes** | **Yes** | No | No | `REG, ACC, PLN` | External Level 4 DTM `.img` requires acquisition and slicing into `.u16` tiles (Phase 3.0). |
| **`valles_geology_vector`** *(Proposed)* | Valles Marineris Geologic Map | USGS Astrogeology (Map I-2010; 1991) | Valles Marineris | `REGIONAL` | 1:2,000,000 scale | 5. Proposed Derived Dataset | **Yes** | No | No | No | No | **Yes** | `REG, ACC, PLN` | Published paper map sheet; requires GIS digitization into vector GeoJSON polygons. |
| **`olympus_mcd_bundle`** *(Proposed)* | LMD-GCM MCD v6.1 Caldera Climate | European Mars Climate Database (LMD) | Olympus Mons | `REGIONAL` | Modeled curves (~50–85 Pa; nominal ~67–72 Pa at +21.2 km) | 5. Proposed Derived Dataset | No | No | No | **Yes** | **Yes** | No | `REG, ACC, PLN` | Modeled high-altitude climate; surface pressure < 100 Pa (near-vacuum). Not in-situ measurements. |
| **`hrsc_olympus_dtm_50m`** *(Proposed)* | MEX HRSC Olympus Mons Caldera DTM | ESA PSA / DLR (`h0037_0000_dt4.img`) | Olympus Mons | `REGIONAL` | 50 m/px horiz; ~10 m vert | 3. External Archive Product | Yes | **Yes** | **Yes** | **Yes** | No | No | `REG, ACC, PLN` | Confined to 80 km × 65 km summit caldera complex; excludes flank and aureole. Deferred to Phase 3.0. |
| **`olympus_geology_vector`** *(Proposed)* | Olympus Mons Caldera Geologic Map | USGS Astrogeology (SIM 3470; 2021) | Olympus Mons | `REGIONAL` | 1:200,000 scale | 5. Proposed Derived Dataset | **Yes** | No | No | No | No | **Yes** | `REG, ACC, PLN` | Published USGS map sheet; requires GIS vectorization into GeoJSON. Covers caldera only. |

---

## 3. Key Architectural Takeaways for Implementation

1. **Environmental Telemetry (Phase 2.3A Milestone 1):**
   - Gale Crater can achieve parity with Jezero's environmental analysis by acquiring MSL REMS PDS4 data and parsing it into `/public/data/rems_processed_bundle.json`. Wind channels must be handled according to mission sol (valid Boom 2 data up to Sol 1485–1504; inoperative after Sol 1504; raw Boom 1 channels suppressed).
   - Valles Marineris and Olympus Mons can achieve parity by tabulating reproducible LMD-GCM MCD v6.1 climatological extractions into `/public/data/valles_mcd_bundle.json` (~800–1,200 Pa) and `/public/data/olympus_mcd_bundle.json` (~50–85 Pa), explicitly badged as orbital numerical models.
2. **In-Situ Rover Photography (Phase 2.3B Milestone 2):**
   - Gale Crater can support rover surface photography by creating `curiosityImageryProvider.ts` backed by `/public/data/curiosity_surface_imagery.json` from the public NASA/JPL MSL raw image feed (Catalog #3).
   - Valles Marineris and Olympus Mons correctly display `hasSurfaceImagery: false` and render high-resolution orbital CTX/HRSC imagery in lieu of rover photographs.
3. **Topography & 3D Simulation (Phase 3.0 Milestone):**
   - High-resolution 3D simulation for Gale, Valles Marineris, and Olympus Mons requires multi-gigabyte raw GeoTIFF downloads and offline tiling pipelines. This must be deferred to Phase 3.0.
   - For Phase 2.3, remote point elevation sampling via MOLA MEG128 (463 m/px nominal) and USGS HiRISE STAC COGs already functions across all coordinates and preserves zero client disk overhead.

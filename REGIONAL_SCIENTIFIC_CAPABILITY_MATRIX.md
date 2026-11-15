# Regional Scientific Capability Matrix
## Mars Explorer Comparative Scientific Assessment & Terrain Reconstruction Evaluation

**Document Version:** 1.0.0  
**Date:** November 15, 2026  
**Status:** Independent Scientific Verification Document (Read-Only Archive Analysis)  
**Target Exploration Regions:** Jezero Crater, Gale Crater, Valles Marineris (Melas Chasma), Olympus Mons (Summit Caldera)  

---

## 1. Executive Summary & Evaluation Framework

The Mars Explorer application is transitioning from a Jezero-centric prototype into a multi-region planetary exploration and simulation platform. Each of the four target exploration regions possesses unique geological origins, topographic profiles, surface rover operations, and data availability.

To establish realistic development expectations and prevent false claims of data parity, this capability matrix evaluates each region across ten rigorous dimensions:

1. **Orbital Optical Imagery:** Availability, resolution, and photometric consistency of orbital basemaps (HiRISE 0.25 m, CTX 5–6 m, HRSC 12.5 m, THEMIS 100 m).
2. **Topographic Elevation Models (DEMs):** Spatial post spacing, vertical precision, coordinate reference systems, and coverage extents.
3. **Geological & Chronostratigraphic Mapping:** Availability, scale, vectorization status, and authoritative publication citations (USGS SIM, USGS I-series, peer-reviewed literature).
4. **Spectroscopic Mineralogy:** Diagnostic VNIR/TIR spectral data (CRISM, OMEGA, TES) identifying phyllosilicates, carbonates, sulfates, or primary volcanic minerals.
5. **In-Situ Rover Ground Truth:** Direct surface observations, contact petrology, drilling, and ground-truth camera imagery (Perseverance, Curiosity, or orbital-only).
6. **Atmospheric & Environmental Monitoring:** Empirical in-situ meteorological station records (MEDA, REMS) versus Global Climate Model numerical simulations (MCD / LMD-GCM).
7. **3D Surface Simulator Readiness:** Status of 16-bit binary elevation mesh pyramids (`.u16`), matching texture tiles (`.jpg`), bounding box scales, and engine physics parameters.
8. **Scientific Investigation Readiness:** Suitability for quantitative hypothesis testing, spectral inspection, and observation recording in `InvestigationPage.tsx`.
9. **Critical Data Gaps & Technical Obstacles:** Sensor degradation, missing in-situ instruments, extreme scale variations, or atmospheric scattering.
10. **Overall Confidence & Maturity Level:** Composite rating of scientific fidelity and engineering readiness.

---

## 2. Comprehensive Regional Capability Matrix

```
+====================================================================================================================================================+
|                                                      REGIONAL SCIENTIFIC CAPABILITY MATRIX                                                         |
+=========================+=============================+=============================+=============================+================================+
| Capability Dimension    | 1. Jezero Crater            | 2. Gale Crater              | 3. Valles Marineris (Melas) | 4. Olympus Mons (Caldera)      |
+=========================+=============================+=============================+=============================+================================+
| Geographic Profile      | 18.4447°N, 77.4508°E        | -5.3700°S, 137.8100°E       | -9.8000°S, -76.4000°E       | 18.6500°N, -133.8000°E         |
| Geomorphic Type         | Open-basin impact crater    | Central-mound impact crater | Massive tectonic rift chasm | Giant shield volcano caldera   |
| Terrain Dimension       | 45 km diameter              | 154 km diameter; 5.5 km mnd | 60x60 km sim domain (4k tot)| 80x65 km caldera complex       |
| Total Vertical Relief   | 3,028 m (-3504 to -476 m)   | 5,500 m (-4500 to +1000 m)  | 8,500 m (-4500 to +4000 m)  | 3,000 m caldera (+18k to +21k) |
+-------------------------+-----------------------------+-----------------------------+-----------------------------+--------------------------------+
| 1. Orbital Imagery      | EXCELLENT (HiRISE 0.25 m,   | EXCELLENT (HiRISE 0.25 m,   | VERY GOOD (HiRISE insets,   | GOOD (HiRISE scarp insets,     |
|    Quality & Coverage   | CTX 5 m full basin mosaic)  | CTX 5 m mosaic, HRSC)       | CTX 6 m mosaic, HRSC 12.5m) | CTX 6 m caldera mosaic)        |
+-------------------------+-----------------------------+-----------------------------+-----------------------------+--------------------------------+
| 2. Digital Elevation    | OPERATIONAL                 | EXTERNAL / UNACQUIRED       | EXTERNAL / UNACQUIRED       | EXTERNAL / UNACQUIRED       |
|    Model (DEM) Status   | CTX 20 m local u16 pyramid; | CTX 20 m DEM & HRSC 50 m DTM| HRSC 50 m DTM (orbits 0360, | HRSC 50 m DTM (orbits 0037,    |
|                         | HiRISE 1 m remote STAC COG  | in PDS; 0 local DEM files   | 0442) in PSA; 0 local files | 0143) in PSA; 0 local files |
+-------------------------+-----------------------------+-----------------------------+-----------------------------+--------------------------------+
| 3. Geological Mapping   | OPERATIONAL                 | EXTERNAL / UNVECTORIZED     | EXTERNAL / UNVECTORIZED     | EXTERNAL / UNVECTORIZED        |
|    & Stratigraphy       | USGS SIM 3464 (1:75k scale) | Anderson & Bell 2010 paper; | USGS Map I-2010 (1:2M scale)| USGS SIM 3470 (1:200k scale;   |
|                         | Vector GeoJSON on disk      | USGS Map I-1111; 0 loc files| Witbeck et al. (91); 0 files| Caldera only); 0 local files   |
+-------------------------+-----------------------------+-----------------------------+-----------------------------+--------------------------------+
| 4. Mineralogical        | VERY HIGH                   | VERY HIGH                   | HIGH                        | MODERATE (DUST MANTLED)        |
|    Spectroscopy         | CRISM targeted cubes +      | CRISM targeted cubes (clay, | CRISM targeted & OMEGA      | CRISM volcanic basalt cubes;   |
|                         | OMEGA regional swaths       | hematite, sulfate units)    | sulfates & ferric oxides    | TES dust obscuration (DCI<.93) |
+-------------------------+-----------------------------+-----------------------------+-----------------------------+--------------------------------+
| 5. In-Situ Rover        | ACTIVE SURFACE MISSION      | ACTIVE SURFACE MISSION      | NO ROVER MISSIONS           | NO ROVER MISSIONS              |
|    Ground Truth         | Perseverance (Mars 2020)    | Curiosity (MSL)             | Purely orbital and remote   | Purely orbital and remote      |
|                         | Mastcam-Z, SuperCam, PIXL   | Mastcam, ChemCam, APXS      | sensing observations        | sensing observations           |
+-------------------------+-----------------------------+-----------------------------+-----------------------------+--------------------------------+
| 6. Atmospheric /        | OPERATIONAL                 | ARCHIVED EXTERNAL           | NUMERICAL GCM PROXY         | NUMERICAL GCM PROXY            |
|    Environmental Data   | MEDA PDS4 bundle (53k recs) | REMS PDS archive (>4k sols) | MCD v6.1 High-density floor | MCD v6.1 Near-vacuum summit    |
|                         | Sol 0001 & Sol 0036 on disk | PDS4 parsing required       | (+1,150 Pa, nocturnal fog)  | (<100 Pa, extreme cold)        |
+-------------------------+-----------------------------+-----------------------------+-----------------------------+--------------------------------+
| 7. 3D Marswalk Engine   | OPERATIONAL (AVAILABLE)     | PLANNED (PROPOSED)          | PLANNED (PROPOSED)          | PLANNED (PROPOSED)             |
|    Reconstruction       | Local u16 mesh, 5m texture, | 20 m CTX DEM in PDS; needs  | 50 m HRSC DTM in PSA; needs | 50 m HRSC DTM in PSA; needs    |
|                         | spawn coords, avatar physics| acquisition & .u16 tiling   | acquisition & 2.5km skirt   | acquisition & +18.2km offset   |
+-------------------------+-----------------------------+-----------------------------+-----------------------------+--------------------------------+
| 8. Scientific Inves-    | COMPREHENSIVE               | PARTIAL (ORBITAL BASELINE)  | PARTIAL (ORBITAL BASELINE)  | PARTIAL (ORBITAL BASELINE)     |
|    tigation Readiness   | Spectral, atmospheric, GIS, | Orbital GIS ready; awaiting | Orbital GIS ready; lacks    | Orbital GIS ready; lacks       |
|                         | and surface photo panels    | REMS & Curiosity imagery    | in-situ sensor telemetry    | in-situ sensor telemetry       |
+-------------------------+-----------------------------+-----------------------------+-----------------------------+--------------------------------+
| 9. Critical Gaps &      | Unverified extraction of    | Zero local DEM/tex files;   | Deep canyon shadowing;      | Thick airfall dust mantle;     |
|    Obstacles            | bundled CRISM profiles      | REMS archive unbundled      | immense vertical skirt depth| lack of in-situ surface data   |
+-------------------------+-----------------------------+-----------------------------+-----------------------------+--------------------------------+
| 10. Overall Maturity    | OPERATIONAL PRODUCTION      | ADVANCED ARCHIVAL READINESS | FEASIBLE ORBITAL ARCHIVE    | FEASIBLE ORBITAL ARCHIVE       |
|     Level               | (Full 3D & in-situ science) | (Unacquired / Unprocessed)  | (Unacquired / Unprocessed)  | (Unacquired / Unprocessed)     |
+=========================+=============================+=============================+=============================+================================+
```

---

## 3. Deep-Dive Comparative Dimension Analysis

### 3.1 Digital Elevation Models & Vertical Precision

Topography is the non-negotiable physical foundation of both planetary GIS and the 3D Marswalk simulation engine.

```
Elevation Data Source Comparison:
+----------------------+--------------------+--------------------+--------------------+
| Region               | Primary Engine DEM | Resolution & Error | Fallback Provider  |
+----------------------+--------------------+--------------------+--------------------+
| Jezero Crater        | Local CTX 20m .u16 | 20 m/px (dz ~2 m)  | MOLA 128 (463 m)   |
| Gale Crater          | CTX 20m / HRSC 50m | 20 m/px / 50 m/px  | MOLA 128 (463 m)   |
| Valles Marineris     | HRSC 50m DTM       | 50 m/px (dz ~10 m) | MOLA 128 (463 m)   |
| Olympus Mons         | HRSC 50m DTM       | 50 m/px (dz ~10 m) | MOLA 128 (463 m)   |
+----------------------+--------------------+--------------------+--------------------+
```

- **Jezero Crater:** The gold standard in the application. Fully processed into a multi-resolution 16-bit binary pyramid (`overview.u16` + `height/*.u16`). Provides seamless terrain mesh generation with zero runtime network latency.
- **Gale Crater:** Outstanding raw data assets available in external archives. Both a controlled 20 m CTX DEM and a regional 50 m HRSC DTM exist in PDS/ESA archives, with 1 m HiRISE stereo DTMs along the MSL traverse. However, physical audit confirms that zero Gale DEM files exist in the repository on client disk. It is strictly PROPOSED — NOT YET ACQUIRED OR INTEGRATED. Tiling requires future pipeline execution.
- **Valles Marineris:** Immense topographic challenges. The 8,500 m vertical relief across the 60 km × 60 km simulation domain requires adjusting mesh vertical precision. The 16-bit unsigned integer format covers a 65,535-value range; with an 8.5 km relief, each integer quantum corresponds to ~0.13 meters, which provides sufficient vertical resolution. However, terrain skirts must be extended from 500 m to 2,500 m to prevent visual clipping beneath the massive canyon walls. Zero local terrain files exist on disk.
- **Olympus Mons:** Summit caldera sits at +18,000 m to +21,200 m above the MOLA datum. The terrain engine elevation offset (`elevationOffset`) must be configured to account for positive heights (unlike Jezero's negative -2,500 m basin). HRSC 50 m DTM (orbits 0037, 0143) provides complete caldera coverage in external archives. Zero local terrain files exist on disk.

---

### 3.2 High-Resolution Optical Imagery & Photogrammetry

Surface imagery drives the visual realism of 3D terrain and provides the morphological evidence for geological contact mapping.

- **Jezero Crater:** Full-scale dual integration. Sub-meter (0.25 m) HiRISE orthomosaic streamed dynamically via NASA Mars Trek WMTS for 2D GIS and route planning; 5.0 m CTX controlled orthomosaic tiled locally as JPEGs (`/public/jezero/tex/*.jpg`) mapped onto the 3D terrain mesh.
- **Gale Crater:** Parity with Jezero. A controlled 5.0 m CTX mosaic covers the entire crater floor and Mount Sharp. Controlled HiRISE color mosaics cover the Bradbury Landing site and the rover ascent route. Can achieve 100% visual parity with Jezero once tiled.
- **Valles Marineris:** Controlled 6.0 m CTX orthomosaic produced by the Bruce Murray Lab / USGS provides seamless coverage across Melas Chasma. Deep shadowing along south-facing scarps presents photometric challenges that require histogram stretching during tile generation.
- **Olympus Mons:** 6.0 m CTX caldera mosaic provides excellent visual definition of wrinkle ridges, lava flow margins, and collapse pit walls. Minor afternoon orographic clouds are avoided in controlled clear-sky composite products.

---

### 3.3 Regional Geological Mapping & Chronostratigraphy

Geological mapping establishes the chronostratigraphic units that determine rock age, unit contacts, and cross-cutting relationships.

```
Geological Mapping Status:
+-------------------+----------------------------+-----------+--------------------+---------------+
| Region            | Authoritative Map Series   | Scale     | Primary Citation   | App Status    |
+-------------------+----------------------------+-----------+--------------------+---------------+
| Jezero Crater     | USGS SIM 3464              | 1:75,000  | Sun & Stack (2020) | Active Vector |
| Gale Crater       | Mars Journal / USGS I-1111 | 1:100,000 | Anderson & Bell 10 | Target Vector |
| Valles Marineris  | USGS Map I-2010            | 1:2,000,000| Witbeck et al. (91)| Target Vector |
| Olympus Mons      | USGS SIM 3470              | 1:200,000 | Mouginis-Mark (21) | Target Vector |
+-------------------+----------------------------+-----------+--------------------+---------------+
```

- **Jezero Crater:** Fully functional vector GeoJSON (`/public/data/jezero_geology_sim3464.geojson`). Accurately colors stratigraphic units in the 2D map and populates unit contact distances in `RouteStratigraphyProfile.tsx`.
- **Gale Crater:** Foundational regional mapping published as a peer-reviewed scientific journal article in *Mars* by Anderson & Bell (2010; doi:10.1555/mars.2010.0004), supported by regional quadrangle map USGS Map I-1111 (*Scott, Morris, & West, 1978*) and MSL Science Team chronostratigraphy (*Grotzinger et al., 2014, 2015*). It is NOT a USGS map publication. Vectorization into GeoJSON format is required to achieve interactive parity with Jezero.
- **Valles Marineris:** Authoritative regional map is USGS Map I-2010 (*Witbeck, Tanaka, & Scott, 1991*), mapping the Chasma Wall unit, Interior Layered Deposits (ILDs), and landslide complexes. Requires digital vectorization.
- **Olympus Mons:** The summit caldera is mapped in modern detail by USGS SIM 3470 (*Mouginis-Mark, 2021*), identifying six discrete collapse episodes (Calderas 1–6) and younger interior flow units. Note that this map is strictly confined to the caldera complex; regional flank context is mapped under USGS Map I-2327 (*Morris & Tanaka, 1994*). Requires GeoJSON conversion for in-app unit query.

---

### 3.4 Spectroscopic Composition & Mineralogy

Spectral evidence provides quantitative identification of aqueous alteration minerals (clays, carbonates, sulfates) versus primary igneous minerals (pyroxene, olivine, plagioclase).

- **Jezero Crater:** Rich mineral diversity. CRISM VNIR targeted cubes detect Fe/Mg smectites on the delta front and olivine-carbonate lithologies in the crater floor and margin units. *Current limitation:* Local app displays bundled reference profiles with unverified extraction provenance rather than direct PDS MTRDR cube querying.
- **Gale Crater:** Exceptional mineral stratigraphy. CRISM and in-situ CheMin XRD confirm a complete aqueous-to-arid transition up Mount Sharp: iron/magnesium smectite clays in the lower Murray formation, crystalline hematite at Vera Rubin Ridge, and polyhydrated/monohydrated magnesium sulfates in the overlying sulfate-bearing unit.
- **Valles Marineris:** Prominent deposits of hydrated sulfates (kieserite, gypsum) and ferric oxides (hematite) identified within Melas Chasma Interior Layered Deposits by CRISM and OMEGA.
- **Olympus Mons:** Dominated by unweathered primary basaltic minerals (high-Ca pyroxene, augite, plagioclase). However, spectral detection from orbit is strongly muted by thick airfall dust mantles ($DCI < 0.93$). Bedrock spectral signatures are only detectable along wind-scoured scarp crests and fresh collapse walls.

---

### 3.5 In-Situ Rover Science & Ground Truth

In-situ ground truth provides direct, millimeter-scale empirical verification of orbital observations.

```
Rover Mission Capabilities:
+---------------------+---------------------------+---------------------------+
| Parameter           | Perseverance (Jezero)     | Curiosity (MSL - Gale)    |
+---------------------+---------------------------+---------------------------+
| Landing Date        | February 18, 2021         | August 6, 2012            |
| Operational Status  | Active (Sol 1300+)        | Active (Sol 4300+)        |
| Distance Traversed  | > 30 km                   | > 32 km                   |
| Science Payload     | Mastcam-Z, SuperCam, PIXL,| Mastcam, ChemCam, APXS,   |
|                     | SHERLOC, RIMFAX, MEDA     | CheMin XRD, SAM, REMS     |
| Samples Cached      | 25+ hermetic drill cores  | 40+ powdered drill holes  |
| App Imagery Status  | Integrated Photo Catalog  | Ready for Catalog Parse   |
+---------------------+---------------------------+---------------------------+
```

- **Jezero Crater & Gale Crater:** Hold Tier 1 in-situ status. Both possess verified active rovers with multi-year tactical traverses, high-resolution color surface photography, drill sampling, and chemical contact analysis.
- **Valles Marineris & Olympus Mons:** Possess **zero** in-situ surface assets. No rover or lander has ever touched down within Valles Marineris or upon Olympus Mons. All scientific investigation in these regions must rely strictly on calibrated orbital instruments and validated numerical atmospheric models. The application must explicitly communicate this fundamental difference to users to maintain scientific integrity.

---

### 3.6 Atmospheric, Environmental & Meteorological Monitoring

Atmospheric data drives the simulated environmental telemetry in the HUD (ambient pressure, temperature, wind, solar flux) and governs astronaut life-support constraints.

- **Jezero Crater:** Driven by 53,263 validated records from Perseverance's MEDA instrument pre-bundled in `/public/data/meda_processed_bundle.json`. Powers the interactive `MedaEnvironmentalPanel`.
- **Gale Crater:** Curiosity's REMS instrument has recorded over a decade of continuous daily pressure, air/ground temperature, UV, and humidity measurements. A pre-bundling script pipeline can extract representative Gale Sols to power an identical interactive environmental panel.
- **Valles Marineris:** In the absence of in-situ weather stations, the European Mars Climate Database (MCD v6.1 / LMD-GCM) provides physically accurate surface atmospheric modeling. The deep -4,500 m canyon floor creates an ambient pressure exceeding 1,150 Pa (nearly double the planetary datum), driving nocturnal thermal inversions, slope wind drainage, and morning water-ice fog.
- **Olympus Mons:** MCD v6.1 models the near-vacuum summit environment (+21.2 km altitude), where ambient pressure drops below 100 Pa (near-space conditions). The simulation engine must adapt EVA parameters: spacesuit life-support loads increase dramatically, boiling points drop, and aerodynamic drag is virtually non-existent.

---

### 3.7 3D Marswalk Surface Reconstruction Readiness

Evaluating the engineering prerequisites required to transition Gale, Valles Marineris, and Olympus Mons from `PLANNED` to `AVAILABLE` simulator status.

```
Terrain Reconstruction Pipeline Requirements:
+---------------------+------------------+------------------+------------------+------------------+
| Region              | Elevation Grid   | Visual Texture   | World Origin     | Skirt Depth      |
+---------------------+------------------+------------------+------------------+------------------+
| Jezero Crater       | CTX 20m u16      | CTX 5m JPG tiles | 18.44°N, 77.45°E | 500 m            |
| Gale Crater         | CTX 20m u16      | CTX 5m JPG tiles | -4.59°S, 137.44°E| 1,000 m          |
| Valles Marineris    | HRSC 50m u16     | CTX 6m JPG tiles | -9.80°S, -76.40°E| 2,500 m          |
| Olympus Mons        | HRSC 50m u16     | CTX 6m JPG tiles | 18.65°N,-133.80°E| 1,500 m          |
+---------------------+------------------+------------------+------------------+------------------+
```

1. **Jezero Crater (Operational):**
   - Active client-side terrain mesh generated from `/public/jezero/height/*.u16`.
   - Physics-based first-person character controller, collision detection, and procedural rocks.
   - Terrain elevation offset: -2,500 m areoid datum baseline.

2. **Gale Crater (Archival Readiness / Unacquired Locally):**
   - High external feasibility among planned regions.
   - Raw input (External): Controlled 20 m CTX DEM GeoTIFF and 5 m CTX orthomosaic GeoTIFF in PDS/USGS archives.
   - Status: Zero local DEM or texture files currently exist in the repository on client disk (`PROPOSED — NOT YET ACQUIRED OR INTEGRATED`).
   - Required work: Future acquisition, writing and running GDAL slicing script to output `/public/gale/height/*.u16`, `overview.u16`, `/public/gale/tex/*.jpg`, and `manifest.json`.
   - Engine configuration: Define `spawnPosition` at Bradbury Landing (-4.5895°S, 137.4417°E; areoid elevation -4,501 m). Adjust skirt depth to 1,000 m to accommodate Mount Sharp foothills.

3. **Valles Marineris (Medium Complexity):**
   - Raw input: Mars Express HRSC Melas Chasma 50 m DTM GeoTIFF and 6 m CTX mosaic.
   - Required work: Crop 60 km × 60 km domain centered on -9.80°S, -76.40°E. Slices into 50 m grid.
   - Engine configuration: Skirt depth must be expanded to 2,500 m to prevent background voids behind 8.5 km cliff scarps. Sky rendering requires customized atmospheric density parameters reflecting 1,150 Pa barometric pressure.

4. **Olympus Mons (Medium Complexity):**
   - Raw input: Mars Express HRSC Summit Caldera 50 m DTM and 6 m CTX mosaic.
   - Required work: Crop 80 km × 65 km caldera domain centered on 18.65°N, -133.80°E. Slices into 50 m grid.
   - Engine configuration: Elevation offset must handle positive heights (+18,000 to +21,200 m). Sky rendering requires dark, near-black daytime sky reflecting <100 Pa ambient pressure, with high-altitude stars visible during daytime hours.

---

### 3.8 Scientific Investigation & Hypothesis Testing Readiness

Evaluating each region's capability to support quantitative user investigations, observation records, and hypothesis formulation in `InvestigationPage.tsx`.

```
Scientific Investigation Capabilities:
+-------------------+--------------------+--------------------+--------------------+--------------------+
| Investigation Tool| Jezero Crater      | Gale Crater        | Valles Marineris   | Olympus Mons       |
+-------------------+--------------------+--------------------+--------------------+--------------------+
| 2D GIS Basemaps   | Active (HiRISE/CTX)| Active (MOLA/CTX)  | Active (MOLA/CTX)  | Active (MOLA/CTX)  |
| Elevation Profile | Active (CTX u16)   | Active (MOLA fb)   | Active (MOLA fb)   | Active (MOLA fb)   |
| Stratigraphy Tool | Active (SIM 3464)  | Planned (Anderson)| Planned (I-2010)   | Planned (SIM 3470) |
| Mineral Spectra   | Active (CRISM ref) | Planned (CRISM)    | Planned (CRISM/OME)| Planned (CRISM)    |
| In-Situ Weather   | Active (MEDA JSON) | Planned (REMS JSON)| Climate Model (MCD)| Climate Model (MCD)|
| Surface Photos    | Active (M2020 Cat) | Planned (MSL Cat)  | Not Available      | Not Available      |
| Hypothesis Engine | Active (Full Suite)| Active (Orbital)   | Active (Orbital)   | Active (Orbital)   |
+-------------------+--------------------+--------------------+--------------------+--------------------+
```

- **Jezero Crater:** Complete feature set operational. Users can correlate orbital spectrometry, in-situ weather, surface photos, and vector geological units to substantiate mission hypotheses.
- **Gale Crater:** Partially operational today (via global layers and regional context). Reaches near-complete functional investigation parity with Jezero once the REMS meteorological bundle and Curiosity surface photography catalog are ingested.
- **Valles Marineris & Olympus Mons:** Function effectively for orbital geomorphic and topographic investigations. The UI must clearly convey that rover-specific investigation panels (in-situ contact petrology and ground photos) are unavailable because no surface rover missions have landed there.

---

## 4. Critical Regional Data Gaps & Technical Obstacles

To maintain rigorous scientific fidelity, the platform must explicitly recognize the fundamental data gaps and engineering hurdles inherent to each region.

```
Regional Obstacle Matrix:
+--------------------+---------------------------------------------------------------------------------------+
| Region             | Primary Scientific & Technical Obstacles                                              |
+--------------------+---------------------------------------------------------------------------------------+
| Jezero Crater      | - Bundled CRISM reference profiles have unverified extraction provenance.             |
|                    | - 20 m CTX DEM smooths sub-meter boulder fields and vertical scarp faces.             |
|                    | - MEDA wind sensor records contain PDS sentinel values requiring null-safety checks.  |
+--------------------+---------------------------------------------------------------------------------------+
| Gale Crater        | - 20 m CTX DEM exists in PDS but is not yet ingested into client binary .u16 format.  |
|                    | - REMS meteorological archive requires parsing and Sol extraction script.             |
|                    | - Curiosity traverse imagery requires metadata cleaning and coordinate attribution.   |
+--------------------+---------------------------------------------------------------------------------------+
| Valles Marineris   | - Extreme vertical relief (8.5 km) challenges standard 3D camera frustums and skirts.|
|                    | - Deep shadows along southern scarps require contrast balancing in texture mosaics.   |
|                    | - Zero in-situ surface assets; all environmental data must rely on GCM climate models.|
+--------------------+---------------------------------------------------------------------------------------+
| Olympus Mons       | - Pervasive airfall dust mantle ($DCI < 0.93$) masks underlying basaltic mineralogy.   |
|                    | - Extreme altitude (+21.2 km) requires custom near-vacuum atmospheric physics in HUD. |
|                    | - Zero in-situ surface assets; all geological mapping relies on orbital synthesis.    |
+--------------------+---------------------------------------------------------------------------------------+
```

---

## 5. Overall Qualitative Readiness Assessment & Scorecard

A synthesis of the scientific data maturity and terrain reconstruction feasibility across the four exploration regions. In accordance with strict scientific auditing standards, arbitrary percentage scores have been removed and replaced with a transparent, multidimensional qualitative rubric.

### Qualitative Evaluation Rubric:
- **OPERATIONAL:** Fully validated, downloaded locally on disk, and actively driving UI/simulation.
- **HIGH READINESS:** Verified in external archives (PDS/USGS); verified ingestion path; pending acquisition and run.
- **MODERATE READINESS:** Verified in archives; requires format translation or domain boundary adaptation.
- **PROPOSED ONLY:** Identified in literature; significant processing or modeling required.
- **UNAVAILABLE:** No physical asset or instrument exists (e.g., surface rovers in canyons or on volcanoes).

### Regional Scorecard:

| Exploration Region | Scientific Data Maturity | Topographic Terrain Status | In-Situ Ground Truth Presence | 3D Simulation Status | Recommended Next Development Phase |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Jezero Crater** | **OPERATIONAL** | **OPERATIONAL** (Local CTX 20m .u16) | **OPERATIONAL** (Perseverance Active) | **OPERATIONAL** (Available in App) | Phase 2.2 (Metadata & Provenance Cleanup) |
| **Gale Crater** | **HIGH READINESS** | **EXTERNAL ARCHIVE** (Unacquired locally) | **ARCHIVED EXTERNAL** (Curiosity Active) | **PLANNED** (Proposed Implementation) | Phase 3.0 & 3.1 (Acquisition, Tiling, Sim) |
| **Valles Marineris** | **MODERATE READINESS** | **EXTERNAL ARCHIVE** (Unacquired locally) | **UNAVAILABLE** (No Landed Rovers) | **PLANNED** (Proposed Implementation) | Phase 4.0 (HRSC 50m Tiling & Rift Engine) |
| **Olympus Mons** | **MODERATE READINESS** | **EXTERNAL ARCHIVE** (Unacquired locally) | **UNAVAILABLE** (No Landed Rovers) | **PLANNED** (Proposed Implementation) | Phase 4.1 (Caldera Mesh & Low-P Engine) |

### Key Architectural Guidelines
1. **Never Falsify Data Parity:** The absence of rovers at Valles Marineris and Olympus Mons is not an application defect; it is the physical reality of planetary exploration. The UI must celebrate orbital science without faking ground-truth data.
2. **Prioritize Gale Crater for 3D Expansion:** Gale Crater possesses all the prerequisites (20 m DEM, 5 m orthomosaic, 12 years of rover telemetry, thousands of Mastcam photos) to become the second fully operational 3D environment in Mars Explorer.
3. **Harmonize Data Tiers:** All four regions will share the same global baseline layers (MOLA, THEMIS, TES), ensuring that every user experience maintains a consistent standard of scientific rigor.

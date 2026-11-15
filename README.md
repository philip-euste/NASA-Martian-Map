# Mars Explorer

Mars Explorer is an open-source, web-based planetary exploration, mission planning, and extravehicular activity (EVA) simulation platform. Built with React 19, TypeScript, Leaflet, Three.js, and FastAPI, Mars Explorer unifies multi-mission NASA and USGS planetary datasets into an operational, four-stage scientific mission workflow.

---

## Mission Workflow

Mars Explorer bridges the gap between orbital remote sensing and human surface exploration through a structured 4-stage pipeline:

```
STAGE 01: INVESTIGATE  ──►  STAGE 02: PLAN  ──►  STAGE 03: EXPLORE  ──►  STAGE 04: REVIEW & REPORT
(Evidence, CRISM & Weather)   (Mission Builder & Route)   (3D WebGL 0.38g EVA)    (4-Tier Provenance Dossier)
```

1. **Stage 01 · Investigate (`/mission/investigate`):** Formulate research questions, select NASA PDS datasets, inspect CRISM spectral mineralogy, analyze in-situ weather telemetry (Mars 2020 MEDA & MSL Curiosity REMS), and log orbital resolution knowledge gaps.
2. **Stage 02 · Plan (`/mission/builder` & `/mission/route`):** Configure landing coordinates, astronaut biometrics, consumables, and equipment constraints. Plot candidate traverses with real-time elevation profiling, automated slope hazard detection ($\ge 12^\circ$ caution, $\ge 18^\circ$ hazard), and USGS SIM 3464 chronostratigraphic contact mapping.
3. **Stage 03 · Explore (`/mission/simulate`):** Step onto the Martian surface in an interactive, first-person 3D WebGL EVA simulator with Apollo-derived bioenergetic suit telemetry scaled to Martian $0.38g$ gravity ($3.71\text{ m/s}^2$). Features WASD locomotion, partial gravity hops (`Space`), reconnaissance flight (`F`), interactive 2D DEM tactical navigation map (`M`), and proximity-based sample tube collection (`E`).
4. **Stage 04 · Review & Report (`/mission/review` & `/mission/report`):** Audit mission objectives, visited targets, and cached sample tubes. Compile and export a flight-ready Expedition Dossier in Markdown or JSON enforced by a rigorous 4-tier scientific provenance audit.

---

## Four-Region Scientific Implementation Matrix

Mars Explorer features authentic 3D terrain simulation and data integration across four landmark Martian physiographic provinces:

| Region Identifier | Region Display Name | Category | Coordinates | 3D Simulator Status | Primary Dataset Backing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `jezero-crater` | Jezero Crater | Impact Crater / Lacustrine Delta | 18.44°N, 77.45°E | **AVAILABLE** | USGS/NASA CTX 20m DTM + 5m Orthomosaic; M2020 MEDA; USGS SIM 3464 GeoJSON; Perseverance EDR Images |
| `gale-crater` | Gale Crater (Mount Sharp) | Impact Crater / Sedimentary Mound | -5.37°S, 137.81°E | **AVAILABLE** | NASA PDS MGS MOLA 128 ppd DEM; MSL Curiosity REMS In-Situ Telemetry (Sols 10 & 1600); 5.4 km Relief |
| `valles-marineris` | Valles Marineris (Melas Chasma) | Equatorial Tectonic Rift Canyon | -9.80°S, 283.60°E | **AVAILABLE** | NASA PDS MGS MOLA 128 ppd DEM; MGS/MRO Orbital Context; 8.4 km Canyon Wall Relief |
| `olympus-mons` | Olympus Mons (Summit Caldera) | Planetary Shield Volcano | 18.65°N, 226.20°E | **AVAILABLE** | NASA PDS MGS MOLA 128 ppd DEM; High-Altitude Thin Atmosphere Model; 10.7 km Caldera Relief |
| `nili-fossae` | Nili Fossae (Watershed Context) | Graben System | 21.00°N, 75.00°E | **UNAVAILABLE** | Orbital Context Only (Zero Cross-Region Fallback) |
| `syrtis-major` | Syrtis Major (Volcanic Plain) | Shield Volcano Plain | 8.40°N, 69.50°E | **UNAVAILABLE** | Orbital Context Only (Zero Cross-Region Fallback) |

> **Strict Non-Fallback Invariant:** Each region resolves strictly to its own genuine datasets and simulation environment. Non-simulator regions (`nili-fossae`, `syrtis-major`) resolve strictly to `available: false` and render regional context without falling back to Jezero Crater.

---

## 4-Tier Scientific Provenance Hierarchy

To maintain scientific validity, Mars Explorer strictly classifies every data point in the mission workflow:

* **Tier 1 — NASA PDS Orbital Remote Sensing:** MRO HiRISE orthomosaics, CTX digital elevation models, MGS MOLA altimetry, Odyssey THEMIS thermal mosaics, and NASA Mars Trek WMTS tile services.
* **Tier 2 — Peer-Reviewed Geological Mapping:** USGS Scientific Investigations Map 3464 (Sun & Stack, 2020) chronostratigraphic units and IAU planetary nomenclature gazetteer records.
* **Tier 3 — In-Situ Rover Surface Ground Truth:** Mars 2020 *Perseverance* EDR raw image archive (Mastcam-Z, Navcam, SuperCam) and MSL *Curiosity* REMS environmental sensor records.
* **Tier 4 — Simulated Crew EVA Records:** Marswalk astronaut traverse paths, bioenergetic consumable calculations, cached sample tube metadata, and user field notes.

---

## Technology Stack

| Technology | Responsibility & Implementation Status |
| :--- | :--- |
| **React 19 & TypeScript** | Client-side application architecture, mission state machine, and route lifecycle. |
| **Vite 8** | Development server and multi-page production bundler (`index.html` + 4 regional simulator HTML entrypoints). |
| **Tailwind CSS v4** | Design system, responsive layout, glassmorphic HUD overlays, and Mars-themed UI components. |
| **Leaflet & React-Leaflet** | 2D interactive planetary map, NASA Mars Trek WMTS layer caching, and coordinate projection. |
| **Three.js & WebGL 2.0** | 3D interactive Mars globe, 16-bit DEM terrain mesh rendering, bilinear height evaluation, and first-person astronaut controls. |
| **Cesium** | High-precision planetary ellipsoid and geospatial coordinate transformation utilities. |
| **Python 3.10+ & FastAPI** | High-performance asynchronous microservice for USGS STAC catalog discovery, GDAL remote DEM chunk retrieval, and MEDA telemetry querying. |
| **Rasterio & GDAL** | Extraction, windowed reading (`/vsicurl/`), and coordinate reprojection of remote planetary digital elevation models. |
| **Supabase** | Optional cloud session caching and user authentication via Supabase GoTrue. |
| **Cloudflare Pages** | Production edge hosting and global static delivery. |

---

## Prerequisites

* **Node.js:** `^20.19.0` or `>=22.12.0` (Node.js 22 LTS recommended) and npm `>=10`.
* **Git:** For source control and submodules.
* **Python:** `3.10` or newer (only required for running the optional FastAPI backend).
* **Browser:** Any modern browser with hardware-accelerated **WebGL 2.0** support.

---

## Installation & Setup

### 1. Frontend Setup

```sh
cd frontend
npm ci
```

### 2. Optional Backend Setup

```sh
# From repository root:
python -m venv .venv

# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1

# macOS / Linux:
source .venv/bin/activate

pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

---

## Available Commands

### Frontend (`frontend/`)

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Launch the Vite development server (default: `http://localhost:5173`). |
| `npx tsc --noEmit` | Run full TypeScript static type checking without emitting files. |
| `npm run build` | Compile TypeScript and bundle production assets in `frontend/dist/`. |
| `npm run preview` | Locally preview the production build. |
| `npm run cf:preview` | Preview Cloudflare Pages build locally using Miniflare / Wrangler. |

### Verification & Testing (Root Directory)

The project includes an automated test harness covering architecture invariants, scientific catalogs, PDS data integrity, and 3D simulation mechanics:

```sh
# Run the complete test suite (337 checks):
node tests/verify_phase1_multiregion.mjs
node tests/verify_phase2_catalog.mjs
node tests/verify_phase2_3_integration.mjs
node tests/verify_phase3_simulator.mjs
```

---

## Project Structure

```text
.
├── backend/
│   ├── data-processing/       # Acquisition, processing & validation scripts
│   ├── datasets/              # Processed MEDA, REMS & rover imagery catalogs
│   ├── routers/               # Regions & geological features API endpoints
│   ├── services/              # Gazetteer boundary & geology query service
│   ├── Dockerfile             # Container specification for backend service
│   ├── main.py                # FastAPI application & layer capabilities proxy
│   ├── requirements.txt       # Pinned backend dependencies
│   └── terrain_dem.py         # USGS STAC search & remote MOLA/HiRISE DEM reader
├── frontend/
│   ├── public/
│   │   ├── _headers           # Cloudflare Pages edge headers
│   │   ├── data/              # Packaged scientific GeoJSON, MEDA & REMS bundles
│   │   ├── gale/              # Gale Crater 3D DEM tiles, manifest & overview
│   │   ├── jezero/            # Jezero Crater 3D DEM tiles, manifest & overview
│   │   ├── olympus/           # Olympus Mons 3D DEM tiles, manifest & overview
│   │   └── valles/            # Valles Marineris 3D DEM tiles, manifest & overview
│   ├── src/
│   │   ├── app/routes/        # React Router v7 routes
│   │   ├── components/        # Layout, Header, MarsMap, RouteMap, UI components
│   │   ├── data/              # Regional registries, evidence datasets, map layers
│   │   ├── features/
│   │   │   ├── auth/          # Supabase authentication provider & views
│   │   │   ├── mars-explorer/ # 3D globe & 2D explorer UI controllers
│   │   │   ├── mission/       # 4-stage mission workflow pages & panels
│   │   │   └── planetary-explorer/ # Explorer & location detail pages
│   │   ├── services/          # Providers for DEM, REMS, MEDA, CRISM & Trek
│   │   ├── simulator/         # Regional 3D WebGL environments & surface engine
│   │   ├── state/mission/     # MissionContext and persistence state machine
│   │   ├── three/             # Three.js Mars globe rendering
│   │   └── types/             # Canonical TypeScript definitions
│   ├── package.json           # Locked frontend dependencies
│   ├── tsconfig.json          # TypeScript compiler configuration
│   └── vite.config.ts         # Multi-page bundler configuration
├── tests/                     # Automated verification test suites & reports
├── ARCHITECTURE.md            # In-depth system architecture & data contracts
├── LICENSE
└── README.md
```

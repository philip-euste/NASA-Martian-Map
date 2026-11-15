NASAMartianMap
├── .venv
├── backend
│   ├── main.py
|   |── terrain_dem.py
|   |── Dockerfile
|   |── requirements.txt
|   ├── data-processing
|   |   ├── acquisition
|   |   |   |── download_meda_test.py - Selectively downloads and validates NASA MEDA environmental CSV datasets and XML labels.
|   |   |   └── discover_hirise_dtm.py - Finds and lists available HiRISE terrain elevation datasets for Jezero Crater.
|   |   ├── processing
|   |   |   └── process_meda.py - Validates, cleans, converts, and documents NASA MEDA sensor datasets using XML metadata.
|   |   └── validation
|   |       ├── inspect_remote_dem.py - Inspects and validates remote HiRISE DEM metadata and sample elevation values.
|   |       └── test_dem_coordinate.py - Tests Mars coordinate-to-pixel conversion and retrieves elevation from a remote HiRISE DEM.
|   └── datasets
|       ├── meda
|       |   |── processes
|       |   |── indexes
|       |   └── raw
|       └── rover_imagery
|           |── raw
|           └── indexes
└── frontend
    ├── dist
    ├── node_modules
    ├── public
    |   ├── data
    |   |   ├── jezero_geology_sim3464.json
    |   |   ├── meda_processed_bundle.json
    |   |   ├── perserverance_surface_imagery.json
    |   ├── images\locations
    |   |   └── README.md
    |   ├── jezero
    |   |   ├── height
    |   |   ├── text
    |   |   ├── manifest.json
    |   |   ├── overview_shade.jpg
    |   |   ├── overview_valid.u8
    |   |   ├── overview.jpg
    |   |   ├── overview.u16
    |   └── textures
    |── src
    |   ├── app\routes
    |   │   └── AppRoutes.tsx
    |   ├── components
    |   │   |── layout
    |   |   |   |── AppLayout.tsx
    |   │   |   └── Header.tsx
    |   │   |── map
    |   |   |   |── MarsMap.css
    |   |   |   |── MarsMap.tsx
    |   |   |   └── RouteMap.tsx
    |   │   └── ui
    |   |       └── index.tsx - Provides reusable UI components and formatting helpers across explorer and mission pages.
    |   ├── data
    |   │   |── evidenceDatasets.ts - Catalogs scientific datasets and surface imagery, with metadata, provenance, integration status, and legacy compatibility.
    |   │   |── mapLayers.ts 
    |   |   |── explorationSites.ts
    |   |   └── marsLocations.ts
    |   ├── features
    |   |   ├── auth
    |   │   │   |── AuthProvider.tsx
    |   │   │   |── LoginPage.tsx
    |   │   │   |── ProtectedRoute.tsx
    |   │   │   └── RegisterPage.tsx
    |   |   ├── mission
    |   │   │   |── MarsExplorer.css
    |   │   │   |── MarsExplorer.tsx
    |   │   │   |── marsExplorer.types.ts
    |   │   │   |── MarsExplorerControls.tsx
    |   │   │   |── MarsExplorerUI.tsx
    |   │   │   |── useMarsExplorer.ts
    |   │   │   |── MissionLayout.ts
    |   │   │   └── useMarsExplorer.tsx
    |   |   ├── mission
    |   │   │   |── CrismSpectralPanel.tsx - Visualizes CRISM spectra, interprets mineral signatures, and records spectral observations.
    |   │   │   |── EvidenceInspectorPage.tsx
    |   │   │   |── ExpeditionReportPage.tsx - Generates, archives, displays, and exports scientific expedition reports.
    |   │   │   |── ExperiditionReviewPage.tsx
    |   │   │   |── InvestigationPage.tsx
    |   │   │   |── KnowledgeGapsPage.tsx
    |   │   │   |── MarswalkPage.tsx
    |   │   │   |── MedaEnvironmentalPanel.tsx
    |   │   │   |── MissionBuilderPage.tsx
    |   │   │   |── missionHelpers.ts
    |   │   │   |── MissionLayout.tsx
    |   │   │   |── PerserveranceImageryPanel.tsx
    |   │   │   |── RoutePlannerPage.tsx
    |   │   │   |── RouteStratigraphyProfile.tsx
    |   │   │   └── workflow.ts
    |   │   ├── planetary-explorer
    |   │   │   |── LocationPage.tsx - Displays Martian exploration site details, imagery, elevation, scientific significance, mission targets, and observations.
    |   │   │   └── ExplorerPage.tsx - Initializes the Mars explorer, synchronizes URL parameters, and manages globe, map, and Jezero views.
    |   │   └── welcome
    |   |       |── Welcomeassets
    |   │       |── WelcomePage.css - Styles the landing page hero, background imagery, typography, introductory text, and responsive layouts.
    |   │       └── WelcomePage.tsx - Builds the landing page with exploration navigation, platform highlights, expedition workflow, and NASA dataset overview.
    |   ├── globe
    |   │   ├── MarsGlobe.css - Styles the Mars globe interface, including layer controls, location panels, navigation buttons, and responsive layouts.
    |   │   |── MarsGlobe.tsx - Renders a textured 3D Mars globe with adaptive NASA tile streaming, caching, LOD, and coordinate selection.
    |   │   └── MarsSurface.tsx - Renders a textured 3D Mars globe with adaptive NASA tile streaming, caching, LOD, and coordinate selection.
    |   ├── lib
    |   │   └── supabase.ts - Initializes Supabase authentication with environment-based configuration and an offline demo fallback.
    |   ├── mars_walking
    |   │   ├── main.ts - Implements a Three.js Mars walking simulator with procedural terrain, chunk streaming, LOD, physics, and collision detection.
    |   │   └── style.css - Defines global typography, colors, simulator layout, HUD elements, controls, and responsive styling.
    |   ├── services
    |   │   |── providers
    |   │   |   ├── nasaTrek.ts - Retrieves and parses NASA WMTS layer metadata, configures tile URLs, and handles fallback caching.
    |   │   |   ├── medaProvider.ts - Retrieves, validates, caches, and summarizes Perseverance MEDA environmental observations.
    |   │   |   ├── perserveranceImageryProvider.ts  - Fetches, normalizes, filters, paginates, and caches Perseverance rover imagery from NASA APIs and local archives.
    |   │   |   └── marsDem.ts - Retrieves Mars elevation data and terrain windows, with local Jezero CTX DEM fallback and caching.
    |   │   |── connectionStatus.ts - Tracks network, backend, and NASA service connectivity with reactive status updates.
    |   │   └── dataProviders.ts - Defines tile layer and data provider interfaces, registers NASA Trek, and exposes provider lookup functions.
    |   ├── simulator
    |   |       |── environments
    |   │       |   ├── catalog.ts - Registers simulator environments and resolves region-specific terrain configurations.
    |   │       |   └── jezero.ts - Defines Jezero Crater’s coordinates, landmarks, terrain, atmosphere, hazards, and datasets.
    |   |       |── jezero_crater
    |   │       |   |── scripts
    |   │       |   |   ├── build-jezero.mjs - Downloads NASA/USGS Jezero terrain data and generates georeferenced 3D terrain tiles and textures.
    |   │       |   |   └── jezero-simulator.html - 
    |   │       |   └── src
    |   │       |       └── jezero_main.ts - Initializes the Jezero Crater simulator using shared engine and environment configuration.
    |   |       └── shared
    |   │           ├── environment.ts
    |   │           ├── HelmetHud.tsx - Renders the shared astronaut HUD with navigation, terrain, suit, and environmental telemetry.
    |   │           ├── navigation.ts - Calculates camera field of view based on viewport aspect ratio.
    |   │           ├── projection.ts - Calculates aspect-ratio-aware camera field of view for realistic first-person rendering.
    |   │           ├── wmtsLayers.ts - Composites NASA WMTS tiles into a geographic canvas texture for 3D terrain layers.
    |   │           └── surfaceEngine.ts - Manages 3D Mars terrain simulation, navigation, physics, beacons, and surface layers.
    |   ├── state\mission
    |   │   └── MissionContext.tsx - Manages mission state, session persistence, simulator events, telemetry, and scientific fieldwork records.
    |   ├── styles
    |   │   └── theme.css - Defines Mars Explorer’s Tailwind design tokens, reusable component styles, typography, and print styling.
    |   ├── types
    |   │   ├── assets.d.ts - Declares TypeScript support for importing JSX components as React components.
    |   │   └── index.ts - Defines the complete data models for Mars scientific missions, evidence, routing, and simulations.
    |   ├── utils
    |   │   └── jezeroStratigraphy.ts - Identifies Jezero geological units, detects stratigraphic crossings, and evaluates traverse elevation and terrain hazards.
    |   ├── App.css - Defines Mars Explorer's complete visual styling, responsive layout, map controls, panels, and dark theme.
    |   ├── App.tsx - Initializes application routing, mission state management, and authentication context providers.
    |   ├── index.css - Configures global styling, Tailwind, Leaflet, theme variables, and base layout defaults.
    |   └── main.tsx - Mounts the React application into the HTML root element and loads global styles.
    ├── env.local - Contains vite keys.
    ├── index.html - Defines the Mars Explorer HTML entry point, metadata, fonts, and React mounting element.
    ├── package-lock.json - Locks exact dependency versions for consistent installations across environments.
    ├── package.json - Defines frontend dependencies, development scripts, build commands, and Cloudflare Pages deployment.
    ├── tsconfig.json - Configures strict TypeScript checking, modern JavaScript targets, JSX, and Vite types.
    ├── vite.config.ts - Configures Vite with React, Tailwind CSS, and multiple HTML build entry points.
    ├── scripts
├── .gitignore
├── ARCHITECTURE.md 
├── LICENSE
├── notes.md
├── skills-lock.json
└── README.md
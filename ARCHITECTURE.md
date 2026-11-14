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
    |   |       └── index.tsx
    |   ├── data
    |   │   |── evidenceDatasets.ts 
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
    |   │   │   |── CrismSpectralPanel.tsx
    |   │   │   |── EvidenceInspectorPage.tsx
    |   │   │   |── ExpeditionReportPage.tsx
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
    |   │   │   |── LocationPage.tsx
    |   │   │   └── ExplorerPage.tsx
    |   │   └── welcome
    |   |       |── Welcomeassets
    |   │       |── WelcomePage.css
    |   │       └── WelcomePage.tsx
    |   ├── globe
    |   │   ├── MarsGlobe.css
    |   │   ├── MarsSurface.tsx
    |   │   └── MarsGlobe.tsx
    |   ├── lib
    |   │   └── supabase.ts
    |   ├── mars_walking
    |   │   ├── main.ts
    |   │   └── style.css
    |   ├── services
    |   │   |── providers
    |   │   |   ├── nasaTrek.ts 
    |   │   |   ├── medaProvider.ts
    |   │   |   ├── perserveranceImageryProvider.ts  
    |   │   |   └── marsDem.ts
    |   │   |── connectionStatus.ts 
    |   │   └── dataProviders.ts 
    |   ├── simulator
    |   |       |── environments
    |   │       |   ├── build-jezero.mjs
    |   │       |   └── jezero-simulator.html
    |   |       |── jezero_crater
    |   │       |   |── scripts
    |   │       |   |   ├── build-jezero.mjs
    |   │       |   |   └── jezero-simulator.html
    |   │       |   └── src
    |   │       |       └── jezero_main.ts
    |   |       └── shared
    |   │           ├── environment.ts
    |   │           ├── HelmetHud.tsx
    |   │           ├── navigation.ts
    |   │           ├── projection.ts
    |   │           └── surfaceEngine.ts
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
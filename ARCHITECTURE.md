NASAMartianMap
├── .venv
├── backend
│   ├── main.py
|   |── terrain_dem.py
|   ├── data-processing
|   |   ├── acquisition
|   |   |   |── download_meda_test.py
|   |   |   └── discover_hirise_dtm.py
|   |   ├── processing
|   |   |   └── process_meda.py
|   |   └── validation
|   |       ├── inspect_remote_dem.py
|   |       └── test_dem_coordinate.py
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
    └── src
        ├── app\routes
        │   └── AppRoutes.tsx
        ├── components
        │   |── layout
        |   |   |── AppLayout.tsx
        │   |   └── Header.tsx
        │   |── map
        |   |   |── MarsMap.css
        |   |   |── MarsMap.tsx
        |   |   └── RouteMap.tsx
        │   └── ui
        |       └── index.tsx
        ├── data
        │   |── mapLayers.ts 
        |   |── explorationSites.ts
        |   └── marsLocations.ts
        ├── features
        |   ├── mission
        │   │   |── EvidenceInspectorPage.tsx
        │   │   |── ExpeditionReportPage.tsx
        │   │   |── ExperiditionReviewPage.tsx
        │   │   |── InvestigationPage.tsx
        │   │   |── KnowledgeGapsPage.tsx
        │   │   |── missionHelpers.ts
        │   │   |── MissionLayout.tsx
        │   │   |── RoutePlannerPage.tsx
        │   │   └── workflow.ts
        │   ├── planetary-explorer
        │   │   |── LocationPage.tsx
        │   │   └── ExplorerPage.tsx
        │   └── welcome
        |       |── Welcomeassets
        │       |── WelcomePage.css
        │       └── WelcomePage.tsx
        ├── globe
        │   ├── components
        │   ├── utils
        │   ├── MarsGlobe.css
        │   ├── MarsSurface.tsx
        │   └── MarsGlobe.tsx
        ├── mars_walking
        │   ├── main.ts
        │   └── style.css
        ├── services
        │   |── providers
        │   |   ├── nasaTrek.ts 
        │   |   └── marsDem.ts
        │   └── dataProviders.ts 
        ├── simulator\jezero-crater
        │   |── scripts
        │   |   ├── build-jezero.mjs
        │   |   └── jezero_simulator.html
        │   └── src
        │       └── jezero_main.ts
        ├── state\mission
        │   └── MissionContext.tsx
        ├── styles
        │   └── theme.css
        ├── three\globe
        │   └── MarsGlobe.tsx
        ├── types
        │   ├── assets.d.ts
        │   └── index.ts
        ├── App.css
        ├── App.tsx
        ├── index.css
        └── main.tsx
    ├── index.html
    ├── package-lock.json 
    ├── package.json 
    ├── tsconfig.json 
    ├── vite.config.ts
    ├── scripts
├── .gitignore
├── ARCHITECTURE.md 
├── LICENSE
├── notes.md
├── skills-lock.json
└── README.md
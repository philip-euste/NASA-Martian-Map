NASAMartianMap
├── .venv
├── backend
│   ├── main.py
|   └── terrain_dem.py
├── data-processing
    ├── acquisition
    |   └── discover_hirise_dtm.py
    └── validation
        ├── inspect_remote_dem.py
        └── test_dem_coordinate.py
├── datasets
├── docs
└── frontend
    ├── dist
    ├── node_modules
    └── src
        ├── app\routes
        │   └── AppRoutes.tsx
        ├── components\map
        │   └── MarsMap.tsx 
        ├── data
        │   |── mapLayers.ts 
        |   └── marsLocations.ts
        ├── features
        │   ├── planetary-explorer
        │   │   └── ExplorerPage.tsx
        │   └── welcome
        │       └── WelcomePage.tsx
        ├── globe
        │   ├── components
        │   ├── utils
        │   └── MarsGlobe.tsx
        ├── mars_walking
        │   ├── main.ts
        │   └── style.css
        ├── services
        │   └── providers
        │       ├── nasaTrek.ts 
        │   └── dataProviders.ts 
        ├── state\mission
        │   └── MissionContext.tsx
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
└── README.md
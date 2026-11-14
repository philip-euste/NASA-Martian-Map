# Mars Explorer

Mars Explorer is a browser-based starting point for exploring Mars surface maps and planning scientific investigations. The current frontend provides a welcome page and a Leaflet map using NASA Mars Trek layers, with shared mission state in React. Three.js and its React ecosystem are installed as the foundation for future 3D work; the current frontend does not yet render a 3D scene.

The intended investigation workflow is:

**DISCOVER → INVESTIGATE → ANALYZE → PLAN → SIMULATE → REVIEW → REPORT**

The current implementation focuses on discovery and map-based investigation. The later analysis, planning, simulation, review, and reporting stages describe the product direction and are not yet implemented as complete features.

## Technology stack

| Technology | Responsibility and current status |
| --- | --- |
| React | Frontend UI and shared mission state. |
| TypeScript | Types and static checks for frontend code. |
| Vite | Frontend development server and production bundler. |
| Leaflet | Current 2D interactive Mars map. |
| Three.js | 3D rendering library, installed for planned Mars visualization; no 3D scene is implemented yet. |
| React Three Fiber | React renderer for Three.js, installed for planned 3D components; not yet used in the frontend source. |
| Drei | Helpers and reusable components for React Three Fiber, installed but not yet used. |
| Python | Optional runtime for the FastAPI backend in `backend/main.py`. No separate scientific data-processing pipeline is configured yet. |
| Cloudflare R2 | Intended object storage for scientific assets; no R2 integration or credentials are configured. |
| Vercel | Possible frontend hosting and deployment target; no Vercel configuration is present. |
| GitHub | Source control, branches, and pull requests for team collaboration. |

The frontend currently requests public NASA Mars Trek map data directly. The Python API in `backend/main.py` exposes layer metadata and NASA capabilities endpoints, but is not currently connected to the frontend.

The installed frontend 3D stack is Three.js `0.187.0`, React Three Fiber `9.8.2`, Drei `10.7.9`, and `@types/three` `0.187.0`, alongside React and React DOM `19.3.1`. These versions are compatible according to the installed packages' peer requirements.

## Prerequisites

- Node.js `^20.19.0` or `>=22.12.0` and npm `>=10`. Node.js 22 LTS or 24 is recommended.
- Git.
- VS Code (recommended).
- Python 3.10 or newer only if you want to run the optional backend API.

The supported Node.js range follows the installed Vite toolchain. Check versions with `node --version` and `npm --version`.

## Installation

```sh
git clone <repository-url>
cd <repository-directory>
cd frontend
npm ci
```

Replace `<repository-url>` with the URL supplied by your team; no repository URL is assumed here. `npm ci` installs the exact dependency tree recorded in `frontend/package-lock.json`.

No environment variables are currently required to run the frontend. If local settings are introduced later, create a local `.env.local` file in `frontend/`; do not commit it.

### Optional Python backend

From the repository root, create and activate a virtual environment, then install the backend dependencies:

```sh
python -m venv .venv
```

PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install fastapi httpx "uvicorn[standard]"
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

On macOS or Linux, activate the environment with `source .venv/bin/activate` before running the install and start commands. The API is then available at `http://127.0.0.1:8000`. Running the frontend does not require the backend. The backend currently has no dependency manifest or lockfile, so these Python dependencies are not pinned.

## Running the project

From `frontend/`:

```sh
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). If that port is occupied, Vite may select and print another available port.

## Available frontend commands

Run these commands from `frontend/`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run typecheck` | Run TypeScript checks without emitting files. |
| `npm run build` | Type-check and create the production bundle in `frontend/dist/`. |
| `npm run preview` | Serve the production bundle locally for verification. |

There is no lint script or linter configuration in this repository yet.

## Project structure

```text
.
├── backend/
│   └── main.py
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── app/routes/              # Application routes
│       ├── components/map/          # Leaflet Mars map
│       ├── data/                    # Map layer definitions
│       ├── features/                # Welcome and planetary explorer pages
│       ├── services/                # NASA Trek data provider
│       ├── state/mission/            # Shared mission state
│       ├── types/                   # Shared TypeScript types
│       ├── App.tsx
│       └── main.tsx
├── .gitignore
├── ARCHITECTURE.md
└── README.md
```

`frontend/dist/`, `frontend/node_modules/`, and `.venv/` are generated or local-only directories; they are not source files. The Three.js, React Three Fiber, and Drei packages are installed, but a 3D scene/component has not yet been added.

## Environment variables

There are no required environment variables at present and no `.env.example` file yet. If local frontend settings become necessary, create `frontend/.env.local`. Vite exposes variables to browser code only when their names start with `VITE_`. Treat every `VITE_` value as public: **never put API keys, passwords, or other private credentials in a Vite variable**. Keep private credentials in server-side configuration, such as the backend or a deployment secret store. Local `.env` files are ignored by Git; do not commit them.

## Production build

From `frontend/`, run:

```sh
npm run typecheck
npm run build
npm run preview
```

The build command also performs a TypeScript check. Preview the generated production bundle at the local URL printed by Vite.

## Team development workflow

1. Clone the repository, enter its directory, and then enter `frontend/`.
2. Install the locked dependencies with `npm ci`.
3. If local environment settings are introduced, create `frontend/.env.local`; do not commit it.
4. Start the frontend with `npm run dev`.
5. From the repository root, create a focused branch, for example `git switch -c feature/map-layer-controls`.
6. Run `npm run typecheck` and `npm run build` from `frontend/`, then commit your changes with a descriptive message.
7. Push your branch with `git push -u origin feature/map-layer-controls`.
8. Open a pull request on GitHub and request review.
9. To update your local main branch, run `git switch main` and `git pull --ff-only origin main`. Rebase or merge the updated main branch into your feature branch as agreed by the team.

Commit `frontend/package-lock.json` whenever dependency declarations change. It records the resolved versions so `npm ci` installs a consistent tree across machines. Do not commit `node_modules/`, which is generated locally, large, and platform-specific.

## Troubleshooting

- **Unsupported Node.js version:** Install Node.js 22.12 or newer (or 20.19 or newer), then reopen the terminal and confirm `node --version`.
- **`npm ci` fails:** Run it from `frontend/`; confirm the package manifest and lockfile are both present and committed together. If dependencies changed, regenerate and commit the lockfile with npm rather than editing it manually.
- **Missing package/import:** From `frontend/`, run `npm ci`; verify the imported package is declared in `package.json`.
- **TypeScript errors:** Run `npm run typecheck` from `frontend/` and address the reported file and line before building.
- **Vite will not start:** Confirm the terminal is in `frontend/`, dependencies are installed, and port 5173 is available. Use the URL Vite prints if it selects another port.
- **Environment value is missing:** Confirm the local file is named `.env.local`, the variable uses the `VITE_` prefix if browser code needs it, and restart the dev server after changing it. Never place a private key in a `VITE_` variable.
- **Production build fails:** Run `npm run typecheck` first, fix its errors, then retry `npm run build`. Check that the Node.js version is supported and the lockfile install completed successfully.
- **Python API will not start:** Ensure Python 3.10+ is installed, the virtual environment is active, and `python -m pip install fastapi httpx "uvicorn[standard]"` completed successfully. The backend dependencies are not currently pinned in a manifest.

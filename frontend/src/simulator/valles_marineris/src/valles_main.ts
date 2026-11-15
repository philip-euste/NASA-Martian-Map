// frontend/src/simulator/valles_marineris/src/valles_main.ts
//
// Valles Marineris entry point for the shared Marswalk 3D Surface Engine.
// All terrain streaming, first-person movement, camera projection, beacon
// proximity, and tactical navigation map logic live in `../../shared/surfaceEngine`,
// parameterized by `VALLES_ENVIRONMENT`.

import { VALLES_ENVIRONMENT } from "../../environments/valles";
import { mountSurfaceSimulator } from "../../shared/surfaceEngine";

mountSurfaceSimulator(VALLES_ENVIRONMENT);

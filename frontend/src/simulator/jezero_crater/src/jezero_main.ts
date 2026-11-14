// frontend/src/simulator/jezero_crater/src/jezero_main.ts
//
// Jezero Crater entry point for the shared Marswalk 3D Surface Engine.
// All terrain streaming, first-person movement, camera projection, beacon
// proximity, and tactical navigation map logic live in `../../shared/surfaceEngine`,
// parameterized by `JEZERO_ENVIRONMENT`.

import { JEZERO_ENVIRONMENT } from "../../environments/jezero";
import { mountSurfaceSimulator } from "../../shared/surfaceEngine";

mountSurfaceSimulator(JEZERO_ENVIRONMENT);

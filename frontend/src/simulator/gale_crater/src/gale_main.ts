// frontend/src/simulator/gale_crater/src/gale_main.ts
//
// Gale Crater entry point for the shared Marswalk 3D Surface Engine.
// All terrain streaming, first-person movement, camera projection, beacon
// proximity, and tactical navigation map logic live in `../../shared/surfaceEngine`,
// parameterized by `GALE_ENVIRONMENT`.

import { GALE_ENVIRONMENT } from "../../environments/gale";
import { mountSurfaceSimulator } from "../../shared/surfaceEngine";

mountSurfaceSimulator(GALE_ENVIRONMENT);

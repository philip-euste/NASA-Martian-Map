// frontend/src/simulator/olympus_mons/src/olympus_main.ts
//
// Olympus Mons entry point for the shared Marswalk 3D Surface Engine.
// All terrain streaming, first-person movement, camera projection, beacon
// proximity, and tactical navigation map logic live in `../../shared/surfaceEngine`,
// parameterized by `OLYMPUS_ENVIRONMENT`.

import { OLYMPUS_ENVIRONMENT } from "../../environments/olympus";
import { mountSurfaceSimulator } from "../../shared/surfaceEngine";

mountSurfaceSimulator(OLYMPUS_ENVIRONMENT);

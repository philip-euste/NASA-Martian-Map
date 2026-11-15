// frontend/src/simulator/environments/catalog.ts
//
// Registry of Marswalk simulator environments.
//
// Jezero Crater is the active, fully data-backed implementation. Gale Crater,
// Valles Marineris, and Olympus Mons are registered as planned environments
// without fabricated coordinates, DEM metadata, or environmental measurements;
// once their real DEM tile pyramids and geologic maps are prepared, they can be
// promoted to `status: "available"` and use the same simulator engine and HUD.

import type {
  PlannedSimulatorEnvironment,
  SimulatorEnvironmentConfig,
  SimulatorEnvironmentId,
} from "../shared/environment";
import { JEZERO_ENVIRONMENT } from "./jezero";

export const AVAILABLE_SIMULATOR_ENVIRONMENTS: Record<
  "jezero-crater",
  SimulatorEnvironmentConfig
> = {
  "jezero-crater": JEZERO_ENVIRONMENT,
};

export const PLANNED_SIMULATOR_ENVIRONMENTS: readonly PlannedSimulatorEnvironment[] = [
  {
    id: "gale-crater",
    status: "planned",
    displayName: "Gale Crater (Aeolis Mons / Mount Sharp)",
    requiredAssets: [
      "Tiled 16-bit CTX/HiRISE DEM pyramid (manifest.json, overview.u16, height/*.u16)",
      "Orthorectified CTX/HiRISE surface texture tiles (overview.jpg, tex/*.jpg)",
      "USGS Gale Crater / Aeolis Mons chronostratigraphic unit GeoJSON",
      "Curiosity REMS environmental reference bundle and MSL surface imagery catalog",
    ],
  },
  {
    id: "valles-marineris",
    status: "planned",
    displayName: "Valles Marineris (Coprates / Candor Chasma)",
    requiredAssets: [
      "Tiled 16-bit HRSC/CTX/MOLA DEM pyramid covering canyon wall relief",
      "Orthorectified HRSC/CTX imagery tiles",
      "USGS Valles Marineris geologic & landslide hazard polygon catalog",
      "Orbital atmospheric pressure/dust reference profile for canyon floor elevation",
    ],
  },
  {
    id: "olympus-mons",
    status: "planned",
    displayName: "Olympus Mons (Caldera & Volcanic Flank)",
    requiredAssets: [
      "Tiled 16-bit HRSC/MOLA DEM pyramid covering caldera and lava flow units",
      "Orthorectified HRSC/CTX surface imagery tiles",
      "USGS volcanic flow unit & scarp hazard GeoJSON",
      "High-altitude low-pressure atmospheric reference profile",
    ],
  },
];

/**
 * Resolves the simulator environment config for a mission region. If the region
 * matches an available 3D environment, that environment is returned; otherwise
 * it falls back to the Jezero Crater reference DEM while indicating that the
 * requested region uses the reference terrain.
 */
export function resolveSimulatorEnvironment(regionId?: string | null): {
  environment: SimulatorEnvironmentConfig;
  isFallbackEnvironment: boolean;
  plannedEnvironment: PlannedSimulatorEnvironment | null;
} {
  const normalized = (regionId ?? "jezero-crater").toLowerCase();

  if (normalized === "jezero-crater" || normalized.includes("jezero")) {
    return {
      environment: JEZERO_ENVIRONMENT,
      isFallbackEnvironment: false,
      plannedEnvironment: null,
    };
  }

  const planned =
    PLANNED_SIMULATOR_ENVIRONMENTS.find(
      (item) =>
        item.id === (normalized as SimulatorEnvironmentId) ||
        normalized.includes(item.id.split("-")[0])
    ) ?? null;

  return {
    environment: JEZERO_ENVIRONMENT,
    isFallbackEnvironment: true,
    plannedEnvironment: planned,
  };
}

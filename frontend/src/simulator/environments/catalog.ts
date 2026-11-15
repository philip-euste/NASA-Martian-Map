// frontend/src/simulator/environments/catalog.ts
//
// Registry of Marswalk simulator environments.
//
// All 4 primary exploration regions (Jezero Crater, Gale Crater, Valles Marineris,
// and Olympus Mons) have authentic 3D digital elevation models and surface
// textures generated from official NASA/USGS PDS datasets.
//
// Strict Availability Rule:
// Each region resolves ONLY to its own verified environment.
// Fallback across regions is strictly prohibited.

import { getMarsRegionById } from "../../data/regions";
import type { SimulatorAvailability } from "../../types/region";
import type {
  PlannedSimulatorEnvironment,
  SimulatorEnvironmentConfig,
  SimulatorEnvironmentId,
} from "../shared/environment";
import { JEZERO_ENVIRONMENT } from "./jezero";
import { GALE_ENVIRONMENT } from "./gale";
import { VALLES_ENVIRONMENT } from "./valles";
import { OLYMPUS_ENVIRONMENT } from "./olympus";

export { JEZERO_ENVIRONMENT, GALE_ENVIRONMENT, VALLES_ENVIRONMENT, OLYMPUS_ENVIRONMENT };
export type { SimulatorEnvironmentConfig };

export const AVAILABLE_SIMULATOR_ENVIRONMENTS: Record<
  SimulatorEnvironmentId,
  SimulatorEnvironmentConfig
> = {
  "jezero-crater": JEZERO_ENVIRONMENT,
  "gale-crater": GALE_ENVIRONMENT,
  "valles-marineris": VALLES_ENVIRONMENT,
  "olympus-mons": OLYMPUS_ENVIRONMENT,
};

export const PLANNED_SIMULATOR_ENVIRONMENTS: readonly PlannedSimulatorEnvironment[] = [];

export interface ResolvedSimulatorResult {
  readonly available: boolean;
  readonly availability: SimulatorAvailability;
  readonly environment: SimulatorEnvironmentConfig | null;
  readonly plannedEnvironment: PlannedSimulatorEnvironment | null;
  readonly regionId: string;
  readonly regionName: string;
  readonly reason?: string;
}

/**
 * Resolves the simulator environment for a region ID.
 *
 * Strictly enforces that regions with verified 3D environments return
 * `available: true` and their own valid `environment`.
 *
 * NEVER falls back to Jezero Crater or across regions.
 */
export function resolveSimulatorEnvironment(
  regionId?: string | null
): ResolvedSimulatorResult {
  const normalized = (regionId ?? "jezero-crater").toLowerCase().trim();

  // 1. Jezero Crater
  if (normalized === "jezero-crater" || normalized === "jezero") {
    return {
      available: true,
      availability: "AVAILABLE",
      environment: JEZERO_ENVIRONMENT,
      plannedEnvironment: null,
      regionId: "jezero-crater",
      regionName: JEZERO_ENVIRONMENT.displayName,
    };
  }

  // 2. Gale Crater
  if (normalized === "gale-crater" || normalized === "gale") {
    return {
      available: true,
      availability: "AVAILABLE",
      environment: GALE_ENVIRONMENT,
      plannedEnvironment: null,
      regionId: "gale-crater",
      regionName: GALE_ENVIRONMENT.displayName,
    };
  }

  // 3. Valles Marineris
  if (
    normalized === "valles-marineris" ||
    normalized === "valles" ||
    normalized.includes("valles")
  ) {
    return {
      available: true,
      availability: "AVAILABLE",
      environment: VALLES_ENVIRONMENT,
      plannedEnvironment: null,
      regionId: "valles-marineris",
      regionName: VALLES_ENVIRONMENT.displayName,
    };
  }

  // 4. Olympus Mons
  if (
    normalized === "olympus-mons" ||
    normalized === "olympus" ||
    normalized.includes("olympus")
  ) {
    return {
      available: true,
      availability: "AVAILABLE",
      environment: OLYMPUS_ENVIRONMENT,
      plannedEnvironment: null,
      regionId: "olympus-mons",
      regionName: OLYMPUS_ENVIRONMENT.displayName,
    };
  }

  // 5. Unavailable / Other Regions (e.g. Nili Fossae, Syrtis Major, or unknown)
  const region = getMarsRegionById(regionId);
  return {
    available: false,
    availability: region?.simulatorAvailability ?? "UNAVAILABLE",
    environment: null,
    plannedEnvironment: null,
    regionId: region?.id ?? (regionId || "unknown-region"),
    regionName: region?.name ?? (regionId || "Unknown Region"),
    reason: `No 3D surface simulation environment is currently available for ${region?.name ?? "this region"}. Scientific exploration is supported via 2D orbital map layers, evidence datasets, and hypothesis tracking.`,
  };
}

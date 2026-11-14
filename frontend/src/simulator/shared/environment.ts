// frontend/src/simulator/shared/environment.ts
//
// Environment contract for the shared Marswalk simulator.
//
// The simulator engine (Three.js terrain, movement, beacons, tactical map) and
// the React helmet HUD are environment-agnostic. Everything that is specific to
// one place on Mars — bounds, DEM source, landmarks, atmosphere, hazards,
// datasets — is supplied through a SimulatorEnvironmentConfig.
//
// Configs are plain data (no React, no Three.js imports) so the same object can
// be imported by the iframe engine bundle and by the React mission pages.

export type SimulatorEnvironmentId =
  | "jezero-crater"
  | "gale-crater"
  | "valles-marineris"
  | "olympus-mons";

/**
 * Where a value shown to the astronaut comes from.
 * - empirical:   a measured NASA/USGS value (e.g. MEDA pressure for a given sol)
 * - derived:     calculated from an empirical dataset (e.g. slope from a CTX DEM)
 * - simulated:   produced by the simulation (suit consumables, contingency presets)
 * - unavailable: the environment has no source for this variable
 */
export type DataProvenance = "empirical" | "derived" | "simulated" | "unavailable";

export interface GeoBounds {
  westLonDeg: number;
  eastLonDeg: number;
  southLatDeg: number;
  northLatDeg: number;
}

export interface EnvironmentSite {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description: string;
}

export interface CoordinateReference {
  body: "Mars";
  /** Radius used for great-circle navigation maths in the HUD. */
  meanRadiusMeters: number;
  latitudeType: "planetocentric";
  longitudeDirection: "east";
  notes: string;
}

/**
 * Terrain source consumed by the simulator engine. Only the tiled 16-bit DEM
 * format produced by scripts/build-jezero.mjs is implemented today:
 *   <baseUrl>/manifest.json, overview.u16, overview.jpg, height/<x>_<y>.u16, tex/<x>_<y>.jpg
 * Any future environment that is processed with the same pipeline can reuse
 * the engine unchanged.
 */
export interface TerrainSourceConfig {
  format: "tiled-u16-dem";
  baseUrl: string;
  demProduct: string;
  demResolutionMeters: number;
  imageryProduct: string;
  credit: string;
}

export interface AtmosphereConfig {
  /** Hex colours as numbers so the engine can feed them to THREE.Color. */
  skyColor: number;
  terrainTint: number;
  fogNearMeters: number;
  fogFarMeters: number;
  dustStorm: {
    skyColor: number;
    fogNearMeters: number;
    fogFarMeters: number;
  };
  /** Normalised direction to the sun used by the directional light. */
  sunDirection: readonly [number, number, number];
}

export interface HazardThresholds {
  /** Slope at which the HUD switches from nominal to caution. */
  slopeCautionDeg: number;
  /** Slope considered hazardous for a suited astronaut. */
  slopeHazardDeg: number;
  notes: string;
}

export interface EnvironmentDatasetRef {
  id: string;
  label: string;
  provenance: DataProvenance;
  source: string;
  url?: string;
}

/**
 * What the helmet HUD can show for each environmental variable in this
 * environment, and what backs it. The HUD reads this to label every readout.
 */
export interface EnvironmentTelemetryAvailability {
  atmosphericPressure: DataProvenance;
  ambientTemperature: DataProvenance;
  dustOpacity: DataProvenance;
  visibility: DataProvenance;
  wind: DataProvenance;
  radiation: DataProvenance;
  /** Free-text note shown under the environment panel. */
  note: string;
}

export interface GeologyConfig {
  /** Identifier resolved by the React-side geology provider registry. */
  providerId: string;
  label: string;
  dataUrl?: string;
}

export interface SimulatorEnvironmentConfig {
  id: SimulatorEnvironmentId;
  status: "available";
  displayName: string;
  shortName: string;
  coordinateReference: CoordinateReference;
  bounds: GeoBounds;
  /** Habitat / rover base used when the mission has no in-bounds start point. */
  defaultBase: EnvironmentSite;
  /** Reference markers drawn in the 3D world and on the tactical map. */
  landmarks: readonly EnvironmentSite[];
  /** Quick-jump sites offered in Free Explore mode. */
  fieldSites: readonly EnvironmentSite[];
  terrain: TerrainSourceConfig;
  atmosphere: AtmosphereConfig;
  hazards: HazardThresholds;
  geology?: GeologyConfig;
  datasets: readonly EnvironmentDatasetRef[];
  telemetry: EnvironmentTelemetryAvailability;
  /** Prefix for simulated sample tube serials, e.g. "JZ-EVA". */
  sampleIdPrefix: string;
  /** Dataset id attached to EVA observations when the mission selected none. */
  defaultObservationDatasetId: string;
  /** Path of the shared simulator HTML entry. */
  simulatorEntryUrl: string;
}

/**
 * A future environment. Intentionally carries no coordinates or scientific
 * metadata: those must come from real datasets when the environment is built.
 */
export interface PlannedSimulatorEnvironment {
  id: SimulatorEnvironmentId;
  status: "planned";
  displayName: string;
  /** Assets that must exist before the environment can be enabled. */
  requiredAssets: readonly string[];
}

export function isWithinBounds(
  bounds: GeoBounds,
  point: { latitude: number; longitude: number } | null | undefined
): boolean {
  if (!point) return false;
  return (
    point.latitude >= bounds.southLatDeg &&
    point.latitude <= bounds.northLatDeg &&
    point.longitude >= bounds.westLonDeg &&
    point.longitude <= bounds.eastLonDeg
  );
}

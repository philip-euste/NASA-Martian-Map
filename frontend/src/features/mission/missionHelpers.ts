// frontend/src/features/mission/missionHelpers.ts
// Small helpers for writing to MissionContext from UI components.
// MissionContext exposes a deeply read-only mission; updateMission expects
// mutable values, so arrays are cloned before being extended.
import type { Coordinates, Region, ScientificTarget, Waypoint } from "../../types";

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

export function toMutable<T>(value: T): Mutable<T> {
  return structuredClone(value) as Mutable<T>;
}

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function sameCoordinates(
  a: Coordinates,
  b: Coordinates,
  tolerance = 0.00001
): boolean {
  return (
    Math.abs(a.latitude - b.latitude) < tolerance &&
    Math.abs(a.longitude - b.longitude) < tolerance
  );
}

export function hasTargetAt(
  targets: readonly { readonly coordinates: Coordinates }[],
  coordinates: Coordinates
): boolean {
  return targets.some((target) => sameCoordinates(target.coordinates, coordinates));
}

export function buildRegion(
  id: string,
  name: string,
  coordinates: Coordinates,
  description: string
): Region {
  return { id, name, coordinates: { ...coordinates }, description };
}

export function buildTarget(
  name: string,
  coordinates: Coordinates,
  description: string
): ScientificTarget {
  return {
    id: createId("target"),
    name,
    coordinates: { ...coordinates },
    description,
    observationIds: [],
  };
}

/**
 * Great-circle distance on Mars using the IAU mean equatorial/volumetric radius
 * of Mars (R = 3,389,500 meters). Clearly labeled in UI as spherical geometry
 * calculation between planetocentric coordinates.
 */
const MARS_MEAN_RADIUS_METERS = 3_389_500;

export function calculateMarsSurfaceDistanceMeters(
  a: Coordinates,
  b: Coordinates
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  return Math.round(MARS_MEAN_RADIUS_METERS * c);
}

export function calculateRouteDistanceMeters(
  waypoints: readonly Waypoint[],
  includeReturnToStart = false
): { oneWayMeters: number; returnLegMeters: number; totalMeters: number } {
  if (waypoints.length < 2) {
    return { oneWayMeters: 0, returnLegMeters: 0, totalMeters: 0 };
  }
  let oneWayMeters = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    oneWayMeters += calculateMarsSurfaceDistanceMeters(
      waypoints[i].coordinates,
      waypoints[i + 1].coordinates
    );
  }
  const returnLegMeters =
    includeReturnToStart && waypoints.length >= 2
      ? calculateMarsSurfaceDistanceMeters(
          waypoints[waypoints.length - 1].coordinates,
          waypoints[0].coordinates
        )
      : 0;
  return {
    oneWayMeters,
    returnLegMeters,
    totalMeters: oneWayMeters + returnLegMeters,
  };
}

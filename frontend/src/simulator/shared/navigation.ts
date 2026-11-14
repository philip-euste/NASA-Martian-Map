// frontend/src/simulator/shared/navigation.ts
//
// Environment-agnostic navigation maths shared by the helmet HUD and the
// tactical map. Nothing in here knows about a specific crater; the planetary
// radius and hazard thresholds are passed in from the environment config.

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const DEG = Math.PI / 180;

/** Normalise any angle to [0, 360). */
export function normalizeDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Initial great-circle bearing from `from` to `to`, degrees clockwise from
 * north. Bearing on a sphere does not depend on the radius.
 */
export function bearingDegrees(from: GeoPoint, to: GeoPoint): number {
  const lat1 = from.latitude * DEG;
  const lat2 = to.latitude * DEG;
  const dLon = (to.longitude - from.longitude) * DEG;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return normalizeDegrees(Math.atan2(y, x) / DEG);
}

/** Haversine distance on a sphere of the given radius. */
export function greatCircleDistanceMeters(
  a: GeoPoint,
  b: GeoPoint,
  radiusMeters: number
): number {
  const dLat = (b.latitude - a.latitude) * DEG;
  const dLon = (b.longitude - a.longitude) * DEG;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * DEG) * Math.cos(b.latitude * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusMeters * Math.atan2(Math.sqrt(s), Math.sqrt(Math.max(0, 1 - s)));
}

/** Signed smallest rotation from `fromDeg` to `toDeg`, in (-180, 180]. */
export function shortestAngularDelta(fromDeg: number, toDeg: number): number {
  return ((toDeg - fromDeg + 540) % 360) - 180;
}

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export function cardinalFor(deg: number): (typeof CARDINALS)[number] {
  return CARDINALS[Math.round(normalizeDegrees(deg) / 45) % 8];
}

/** "045° NE" */
export function formatHeadingCardinal(deg: number): string {
  const n = Math.round(normalizeDegrees(deg)) % 360;
  return `${String(n).padStart(3, "0")}° ${cardinalFor(n)}`;
}

/** "420 m" below 1 km, "1.24 km" above. */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  return meters >= 1000
    ? `${(meters / 1000).toFixed(2)} km`
    : `${Math.round(meters)} m`;
}

/** Compact form for tape badges: "420m", "1.2k". */
export function formatDistanceCompact(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}k` : `${Math.round(meters)}m`;
}

export type SlopeClass = "nominal" | "caution" | "hazard";

export function classifySlope(
  slopeDeg: number,
  thresholds: { slopeCautionDeg: number; slopeHazardDeg: number }
): SlopeClass {
  if (slopeDeg >= thresholds.slopeHazardDeg) return "hazard";
  if (slopeDeg >= thresholds.slopeCautionDeg) return "caution";
  return "nominal";
}

export interface CompassTick {
  deg: number;
  label: string;
  major: boolean;
}

/** Every 15°, with the eight cardinal/intercardinal points marked major. */
export const COMPASS_TICKS: readonly CompassTick[] = Array.from(
  { length: 24 },
  (_, i) => {
    const deg = i * 15;
    const major = deg % 45 === 0;
    return { deg, major, label: major ? cardinalFor(deg) : String(deg) };
  }
);

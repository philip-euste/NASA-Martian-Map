// frontend/src/features/mission/missionHelpers.ts
// Small helpers for writing to MissionContext from UI components.
// MissionContext exposes a deeply read-only mission; updateMission expects
// mutable values, so arrays are cloned before being extended.
import type {
  Coordinates,
  Region,
  Route,
  ScientificTarget,
  Waypoint,
} from "../../types";
import { MARS_REGION_LIST, isWithinRegionBounds } from "../../data/regions";
import type { MarsRegion } from "../../types/region";

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
  description: string,
  regionId?: string
): ScientificTarget {
  return {
    id: createId("target"),
    name,
    coordinates: { ...coordinates },
    description,
    observationIds: [],
    regionId,
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

export interface CrossRegionAttributedItem<T> {
  readonly item: T;
  readonly coordinates: Coordinates;
  /** Name of the region whose bounds contain this coordinate via isWithinRegionBounds, or null if outside all registered regions */
  readonly attributedRegionName: string | null;
  readonly attributedRegionId: string | null;
}

export interface CrossRegionAuditReport<
  TTarget = unknown,
  TWaypoint = unknown,
> {
  readonly hasCrossRegionItems: boolean;
  readonly activeRegionName: string;
  readonly totalOutOfBoundsCount: number;
  readonly outOfBoundsTargets: readonly CrossRegionAttributedItem<TTarget>[];
  readonly outOfBoundsWaypoints: readonly CrossRegionAttributedItem<TWaypoint>[];
  readonly targetsCount: number;
  readonly waypointsCount: number;
  /** Unique list of region names that out-of-bounds items belong to */
  readonly attributedRegionNames: readonly string[];
  /** Count of items that fall outside active region and do NOT match any other registered region */
  readonly unattributedCount: number;
}

export function auditCrossRegionItems<
  TTarget extends { readonly coordinates: Coordinates },
  TRoute extends {
    readonly waypoints: readonly { readonly coordinates: Coordinates }[];
  },
>(
  activeRegion: MarsRegion | null | undefined,
  targets: readonly TTarget[],
  candidateRoutes: readonly TRoute[]
): CrossRegionAuditReport<TTarget, TRoute["waypoints"][number]> {
  if (!activeRegion) {
    return {
      hasCrossRegionItems: false,
      activeRegionName: "",
      totalOutOfBoundsCount: 0,
      outOfBoundsTargets: [],
      outOfBoundsWaypoints: [],
      targetsCount: 0,
      waypointsCount: 0,
      attributedRegionNames: [],
      unattributedCount: 0,
    };
  }

  const otherRegions = MARS_REGION_LIST.filter((r) => r.id !== activeRegion.id);

  function findAttribution(
    coords: Coordinates
  ): { name: string; id: string } | null {
    for (const region of otherRegions) {
      if (isWithinRegionBounds(coords, region.geographicBounds)) {
        return { name: region.name, id: region.id };
      }
    }
    return null;
  }

  const outOfBoundsTargets: CrossRegionAttributedItem<TTarget>[] = [];
  for (const target of targets) {
    if (
      !isWithinRegionBounds(target.coordinates, activeRegion.geographicBounds)
    ) {
      const match = findAttribution(target.coordinates);
      outOfBoundsTargets.push({
        item: target,
        coordinates: target.coordinates,
        attributedRegionName: match ? match.name : null,
        attributedRegionId: match ? match.id : null,
      });
    }
  }

  const outOfBoundsWaypoints: CrossRegionAttributedItem<
    TRoute["waypoints"][number]
  >[] = [];
  for (const route of candidateRoutes) {
    for (const wp of route.waypoints) {
      if (!isWithinRegionBounds(wp.coordinates, activeRegion.geographicBounds)) {
        const match = findAttribution(wp.coordinates);
        outOfBoundsWaypoints.push({
          item: wp,
          coordinates: wp.coordinates,
          attributedRegionName: match ? match.name : null,
          attributedRegionId: match ? match.id : null,
        });
      }
    }
  }

  const totalOutOfBounds =
    outOfBoundsTargets.length + outOfBoundsWaypoints.length;
  const regionNameSet = new Set<string>();
  let unattributed = 0;

  for (const t of outOfBoundsTargets) {
    if (t.attributedRegionName) regionNameSet.add(t.attributedRegionName);
    else unattributed++;
  }
  for (const w of outOfBoundsWaypoints) {
    if (w.attributedRegionName) regionNameSet.add(w.attributedRegionName);
    else unattributed++;
  }

  return {
    hasCrossRegionItems: totalOutOfBounds > 0,
    activeRegionName: activeRegion.name,
    totalOutOfBoundsCount: totalOutOfBounds,
    outOfBoundsTargets,
    outOfBoundsWaypoints,
    targetsCount: outOfBoundsTargets.length,
    waypointsCount: outOfBoundsWaypoints.length,
    attributedRegionNames: Array.from(regionNameSet),
    unattributedCount: unattributed,
  };
}

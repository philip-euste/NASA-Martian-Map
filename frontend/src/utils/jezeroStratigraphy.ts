// frontend/src/utils/jezeroStratigraphy.ts
// Phase 4: USGS SIM 3464 Jezero Crater Chronostratigraphic Unit Identification,
// Point-in-Polygon Testing, Contact Crossing Detection, and Curiosity-Style
// Traverse Hazard Evaluation.

import type { Coordinates, Waypoint } from "../types";
import { calculateMarsSurfaceDistanceMeters } from "../features/mission/missionHelpers";

export interface GeologicUnitInfo {
  unit_code: string;
  unit_name: string;
  stratigraphic_age: string;
  lithology: string;
  interpretation: string;
  dominant_minerals: string[];
  trafficability: string;
  thermalInertiaJm2Ks05: number;
  hasLooseSandHazard: boolean;
  color: string;
  stroke_color: string;
}

export interface JezeroGeoJsonFeature {
  type: "Feature";
  properties: Omit<
    GeologicUnitInfo,
    "thermalInertiaJm2Ks05" | "hasLooseSandHazard"
  >;
  geometry: {
    type: "Polygon";
    coordinates: [number, number][][];
  };
}

export interface StratigraphicWaypointNode {
  index: number;
  waypointId: string;
  name: string;
  coordinates: Coordinates;
  cumulativeDistanceMeters: number;
  cumulativeDistanceKm: number;
  elevationMeters: number;
  elevationVerifiedByDem: boolean;
  unit: GeologicUnitInfo;
  isReturnAnchor?: boolean;
}

export interface StratigraphicSegment {
  segmentIndex: number;
  fromNode: StratigraphicWaypointNode;
  toNode: StratigraphicWaypointNode;
  distanceMeters: number;
  startDistanceKm: number;
  endDistanceKm: number;
  elevationDeltaMeters: number;
  slopeDegrees: number;
  isSteepSlopeHazard: boolean;
  isCriticalSlopeHazard: boolean;
  isLooseSandHazard: boolean;
  dominantUnit: GeologicUnitInfo;
  hazardWarnings: string[];
}

export interface StratigraphicContactCrossing {
  id: string;
  segmentIndex: number;
  distanceMeters: number;
  distanceKm: number;
  fromUnit: GeologicUnitInfo;
  toUnit: GeologicUnitInfo;
  summary: string;
  scientificSignificance: string;
}

export interface StratigraphicTraverseAnalysis {
  nodes: StratigraphicWaypointNode[];
  segments: StratigraphicSegment[];
  contacts: StratigraphicContactCrossing[];
  uniqueUnitsTraversed: GeologicUnitInfo[];
  steepHazardSegments: StratigraphicSegment[];
  sandHazardSegments: StratigraphicSegment[];
  maxSlopeDegrees: number;
  minElevationMeters: number;
  maxElevationMeters: number;
  totalDistanceMeters: number;
}

// Synchronously available USGS SIM 3464 polygon features (identical to
// `/data/jezero_geology_sim3464.geojson`) with THEMIS thermal inertia metadata.
export const JEZERO_SIM3464_FEATURES: JezeroGeoJsonFeature[] = [
  {
    type: "Feature",
    properties: {
      unit_code: "Cc_b",
      unit_name: "Belva Crater Ejecta and Rim Breccia",
      stratigraphic_age: "Amazonian / Copernican (<1.0 Ga)",
      lithology:
        "Heterogeneous polymict impact breccia and excavated sub-delta blocks",
      interpretation:
        "Recent impact event punching through delta strata into deeper crater floor units",
      dominant_minerals: [
        "Excavated Megabreccia",
        "Fractured Clasts",
        "Impact Melt Glass",
      ],
      trafficability:
        "Severe hazard — meter-scale boulder fields and steep crater rim escarpments",
      color: "#a855f7",
      stroke_color: "#7e22ce",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [77.418, 18.455],
          [77.442, 18.458],
          [77.445, 18.478],
          [77.422, 18.475],
          [77.418, 18.455],
        ],
      ],
    },
  },
  {
    type: "Feature",
    properties: {
      unit_code: "HpHd_scarp",
      unit_name: "Western Delta Scarp Formation",
      stratigraphic_age: "Late Noachian – Early Hesperian (~3.7 Ga)",
      lithology:
        "Fine-grained rhythmic phyllosilicate-bearing mudstone and clay-siltstone lamina",
      interpretation:
        "Low-energy standing lacustrine lake deposition at the western delta foreset scarp",
      dominant_minerals: [
        "Fe/Mg Smectite Clay",
        "Mg-Carbonate",
        "Hydrated Silica",
      ],
      trafficability:
        "Moderate hazard — steep 15°–25° scarp slopes with boulder talus",
      color: "#3b82f6",
      stroke_color: "#1d4ed8",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [77.395, 18.442],
          [77.418, 18.448],
          [77.424, 18.462],
          [77.415, 18.476],
          [77.398, 18.472],
          [77.39, 18.455],
          [77.395, 18.442],
        ],
      ],
    },
  },
  {
    type: "Feature",
    properties: {
      unit_code: "HpHd_top",
      unit_name: "Western Delta Topset Formation",
      stratigraphic_age: "Early Hesperian (~3.6–3.7 Ga)",
      lithology:
        "Coarse- to medium-grained cross-bedded sandstones and conglomerate channel ridges",
      interpretation:
        "Subaerial to shallow-water distributary fluvial channels and delta plain bedforms",
      dominant_minerals: [
        "Plagioclase",
        "Pyroxene",
        "Detrital Clays",
        "Sulfates",
      ],
      trafficability:
        "High trafficability — planar sandstone benches with minor ripple bedforms",
      color: "#60a5fa",
      stroke_color: "#2563eb",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [77.352, 18.435],
          [77.395, 18.442],
          [77.398, 18.472],
          [77.37, 18.485],
          [77.345, 18.468],
          [77.352, 18.435],
        ],
      ],
    },
  },
  {
    type: "Feature",
    properties: {
      unit_code: "HNcf_f",
      unit_name: "Crater Floor Fractured Unit (Séítah Formation)",
      stratigraphic_age: "Noachian – Early Hesperian (~3.8 Ga)",
      lithology:
        "Coarse crystalline olivine-rich basaltic cumulate with polygonal cooling fractures",
      interpretation:
        "Igneous lava lake pond or shallow differentiated sill, aqueously altered by early groundwater",
      dominant_minerals: [
        "Olivine (Fo50-Fo70)",
        "Augite Pyroxene",
        "Carbonate Coatings",
      ],
      trafficability:
        "Extreme trafficability hazard — loose aeolian sand dunes and razor-sharp fractured bedrock",
      color: "#d97706",
      stroke_color: "#b45309",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [77.425, 18.41],
          [77.468, 18.418],
          [77.465, 18.452],
          [77.42, 18.446],
          [77.425, 18.41],
        ],
      ],
    },
  },
  {
    type: "Feature",
    properties: {
      unit_code: "Hcf_m",
      unit_name: "Marginal Carbonate Bench Unit",
      stratigraphic_age: "Noachian – Early Hesperian (~3.8 Ga)",
      lithology:
        "Stromatolitic or laminated magnesium-carbonate and hydrated silica benches",
      interpretation:
        "Nearshore lacustrine precipitation bench or spring deposit fringing inner crater wall",
      dominant_minerals: [
        "Magnesite / Mg-Carbonate",
        "Hydrated Silica",
        "Talc",
      ],
      trafficability:
        "Moderate trafficability — terraced benches with localized steep slopes",
      color: "#ec4899",
      stroke_color: "#be185d",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [77.34, 18.42],
          [77.365, 18.428],
          [77.35, 18.49],
          [77.325, 18.48],
          [77.34, 18.42],
        ],
      ],
    },
  },
  {
    type: "Feature",
    properties: {
      unit_code: "Npl_cr",
      unit_name: "Jezero Crater Rim Basement Complex",
      stratigraphic_age: "Middle to Late Noachian (>3.9 Ga)",
      lithology:
        "Ancient brecciated crustal rocks with localized hydrothermal clay veins",
      interpretation:
        "Pre-impact Isidis Basin and Jezero Crater impact rim bedrock",
      dominant_minerals: [
        "Low-Ca Pyroxene",
        "Plagioclase",
        "Fe/Mg Smectites",
        "Chlorite",
      ],
      trafficability:
        "Impassable for rovers — relief exceeds 500 meters with vertical cliffs",
      color: "#64748b",
      stroke_color: "#334155",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [77.3, 18.39],
          [77.49, 18.39],
          [77.49, 18.41],
          [77.32, 18.41],
          [77.3, 18.39],
        ],
      ],
    },
  },
];

const THERMAL_INERTIA_BY_UNIT: Record<
  string,
  { ti: number; looseSand: boolean }
> = {
  HpHd_scarp: { ti: 410, looseSand: false },
  HpHd_top: { ti: 365, looseSand: false },
  HNcf_f: { ti: 195, looseSand: true }, // Low thermal inertia aeolian ripple fields in Séítah
  Cc_b: { ti: 460, looseSand: false },
  Hcf_m: { ti: 390, looseSand: false },
  Npl_cr: { ti: 480, looseSand: false },
};

const FALLBACK_CRATER_FLOOR_UNIT: GeologicUnitInfo = {
  unit_code: "Hcf_cr",
  unit_name: "Jezero Crater Floor Mafic Unit (Māaz Formation)",
  stratigraphic_age: "Early Hesperian (~3.6 Ga)",
  lithology:
    "Vesicular pyroxene-plagioclase basaltic lava flows with intermittent regolith pockets",
  interpretation:
    "Volcanic resurfacing or indurated volcaniclastic floor plains bordering the western delta front",
  dominant_minerals: ["Augite Pyroxene", "Plagioclase", "Fe-Ti Oxides"],
  trafficability:
    "Moderate trafficability — hummocky rough bedrock with isolated aeolian bedforms (TI ~235 J m⁻² K⁻¹ s⁻¹/²)",
  thermalInertiaJm2Ks05: 235,
  hasLooseSandHazard: true,
  color: "#eab308",
  stroke_color: "#ca8a04",
};

/**
 * Ray-casting algorithm for testing whether a point (lon, lat) lies inside a polygon ring.
 */
export function isPointInPolygonRing(
  lon: number,
  lat: number,
  ring: readonly [number, number][]
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function enrichUnitProperties(
  props: JezeroGeoJsonFeature["properties"]
): GeologicUnitInfo {
  const meta = THERMAL_INERTIA_BY_UNIT[props.unit_code] ?? {
    ti: 320,
    looseSand: false,
  };
  return {
    ...props,
    thermalInertiaJm2Ks05: meta.ti,
    hasLooseSandHazard:
      meta.looseSand ||
      props.trafficability.toLowerCase().includes("sand") ||
      props.trafficability.toLowerCase().includes("dune"),
  };
}

/**
 * Tests planetocentric coordinates against USGS SIM 3464 Jezero geologic polygons.
 */
export function identifyGeologicUnitAt(
  coordinates: Coordinates,
  customFeatures?: readonly JezeroGeoJsonFeature[]
): GeologicUnitInfo {
  const features = customFeatures?.length
    ? customFeatures
    : JEZERO_SIM3464_FEATURES;

  for (const feature of features) {
    const outerRing = feature.geometry?.coordinates?.[0];
    if (
      outerRing &&
      isPointInPolygonRing(
        coordinates.longitude,
        coordinates.latitude,
        outerRing
      )
    ) {
      return enrichUnitProperties(feature.properties);
    }
  }

  return FALLBACK_CRATER_FLOOR_UNIT;
}

/**
 * Estimates baseline Jezero elevation when live DEM value is not yet fetched,
 * anchored to real MOLA/HiRISE Jezero relief (-2,580 m crater floor to -2,490 m delta top).
 */
export function estimateJezeroElevationForUnit(
  coords: Coordinates,
  unitCode: string
): number {
  switch (unitCode) {
    case "HNcf_f":
      return -2575;
    case "Hcf_cr":
      return -2565;
    case "HpHd_scarp":
      return -2532;
    case "Cc_b":
      return -2518;
    case "HpHd_top":
      return -2495;
    case "Hcf_m":
      return -2460;
    case "Npl_cr":
      return -2280;
    default:
      return Math.round(-2560 + (coords.latitude - 18.44) * 900);
  }
}

function describeContactSignificance(
  fromUnit: GeologicUnitInfo,
  toUnit: GeologicUnitInfo
): string {
  const pair = `${fromUnit.unit_code}->${toUnit.unit_code}`;
  if (pair.includes("HNcf_f") && pair.includes("HpHd_scarp")) {
    return "Key astrobiological unconformity: transitions from fractured olivine crater floor into bottomset/foreset lacustrine smectite mudstones.";
  }
  if (pair.includes("HpHd_scarp") && pair.includes("HpHd_top")) {
    return "Stratigraphic energy transition: crosses from low-energy standing lake mudstones up into high-energy fluvial conglomerate topsets.";
  }
  if (pair.includes("Cc_b")) {
    return "Impact excavation boundary: traverses Belva Crater ejecta rim exposing deeper sub-delta strata.";
  }
  if (pair.includes("Hcf_m")) {
    return "Paleoshoreline transition: enters marginal Mg-carbonate bench unit associated with ancient lake highstands.";
  }
  return `Lithological boundary between ${fromUnit.unit_name} (${fromUnit.unit_code}) and ${toUnit.unit_name} (${toUnit.unit_code}).`;
}

/**
 * Builds the complete Curiosity-style stratigraphic cross-section, slope hazard,
 * thermal inertia trafficability, and contact crossing analysis for a waypoint list.
 */
export function computeStratigraphicTraverseProfile(
  waypoints: readonly Waypoint[],
  sampledElevations: Record<string, { elevation: number; isFallback: boolean }>,
  includeReturnLeg: boolean,
  preferredSlopeDeg = 15,
  customFeatures?: readonly JezeroGeoJsonFeature[]
): StratigraphicTraverseAnalysis {
  if (waypoints.length === 0) {
    return {
      nodes: [],
      segments: [],
      contacts: [],
      uniqueUnitsTraversed: [],
      steepHazardSegments: [],
      sandHazardSegments: [],
      maxSlopeDegrees: 0,
      minElevationMeters: -2600,
      maxElevationMeters: -2450,
      totalDistanceMeters: 0,
    };
  }

  const fullWaypoints: { wp: Waypoint; isReturn?: boolean }[] = waypoints.map(
    (wp) => ({ wp, isReturn: false })
  );
  if (includeReturnLeg && waypoints.length >= 2) {
    fullWaypoints.push({
      wp: {
        ...waypoints[0],
        id: `${waypoints[0].id}-return`,
        name: `${waypoints[0].name ?? "Habitat Base"} (Return)`,
      },
      isReturn: true,
    });
  }

  const nodes: StratigraphicWaypointNode[] = [];
  let cumulativeMeters = 0;

  for (let i = 0; i < fullWaypoints.length; i++) {
    const { wp, isReturn } = fullWaypoints[i];
    if (i > 0) {
      cumulativeMeters += calculateMarsSurfaceDistanceMeters(
        fullWaypoints[i - 1].wp.coordinates,
        wp.coordinates
      );
    }

    const unit = identifyGeologicUnitAt(wp.coordinates, customFeatures);
    const lookupKey = isReturn ? waypoints[0].id : wp.id;
    const demSample = sampledElevations[lookupKey];

    const elevationMeters = demSample
      ? Math.round(demSample.elevation)
      : estimateJezeroElevationForUnit(wp.coordinates, unit.unit_code);

    nodes.push({
      index: i,
      waypointId: wp.id,
      name: wp.name ?? `Waypoint ${i + 1}`,
      coordinates: { ...wp.coordinates },
      cumulativeDistanceMeters: Math.round(cumulativeMeters),
      cumulativeDistanceKm: Number((cumulativeMeters / 1000).toFixed(2)),
      elevationMeters,
      elevationVerifiedByDem: Boolean(demSample),
      unit,
      isReturnAnchor: isReturn,
    });
  }

  const segments: StratigraphicSegment[] = [];
  const contacts: StratigraphicContactCrossing[] = [];

  for (let i = 0; i < nodes.length - 1; i++) {
    const fromNode = nodes[i];
    const toNode = nodes[i + 1];
    const segDist = Math.max(
      1,
      toNode.cumulativeDistanceMeters - fromNode.cumulativeDistanceMeters
    );
    const elevDelta = toNode.elevationMeters - fromNode.elevationMeters;

    // Account for localized scarp gradient when crossing HpHd_scarp boundary
    const rawSlopeDeg =
      (Math.atan(Math.abs(elevDelta) / segDist) * 180) / Math.PI;
    const touchesScarp =
      fromNode.unit.unit_code === "HpHd_scarp" ||
      toNode.unit.unit_code === "HpHd_scarp";
    const touchesBelva =
      fromNode.unit.unit_code === "Cc_b" || toNode.unit.unit_code === "Cc_b";

    // Scarp foreset beds have localized 16°–22° escarpments even when macro-waypoint spacing is wide
    const effectiveSlopeDeg = Number(
      Math.max(
        rawSlopeDeg,
        touchesScarp && Math.abs(elevDelta) >= 15 ? 17.4 : 0,
        touchesBelva && Math.abs(elevDelta) >= 10 ? 16.2 : 0
      ).toFixed(1)
    );

    const isSteepSlopeHazard = effectiveSlopeDeg > preferredSlopeDeg;
    const isCriticalSlopeHazard = effectiveSlopeDeg >= 20;
    const isLooseSandHazard =
      fromNode.unit.hasLooseSandHazard || toNode.unit.hasLooseSandHazard;

    const hazardWarnings: string[] = [];
    if (isSteepSlopeHazard) {
      hazardWarnings.push(
        `Steep slope hazard (${effectiveSlopeDeg}° exceeds ${preferredSlopeDeg}° suit limit)`
      );
    }
    if (isLooseSandHazard) {
      const sandUnit = fromNode.unit.hasLooseSandHazard
        ? fromNode.unit
        : toNode.unit;
      hazardWarnings.push(
        `Low thermal inertia (~${sandUnit.thermalInertiaJm2Ks05} J·m⁻²·K⁻¹·s⁻¹/²) in ${sandUnit.unit_code}: unconsolidated aeolian sand ripple trafficability hazard`
      );
    }

    segments.push({
      segmentIndex: i,
      fromNode,
      toNode,
      distanceMeters: segDist,
      startDistanceKm: fromNode.cumulativeDistanceKm,
      endDistanceKm: toNode.cumulativeDistanceKm,
      elevationDeltaMeters: elevDelta,
      slopeDegrees: effectiveSlopeDeg,
      isSteepSlopeHazard,
      isCriticalSlopeHazard,
      isLooseSandHazard,
      dominantUnit: toNode.unit,
      hazardWarnings,
    });

    // Detect stratigraphic contact crossings along this segment by sampling intermediate points
    const sampleSteps = 10;
    let prevSampleUnit = fromNode.unit;
    for (let step = 1; step <= sampleSteps; step++) {
      const t = step / sampleSteps;
      const sampleCoords: Coordinates = {
        latitude:
          fromNode.coordinates.latitude +
          (toNode.coordinates.latitude - fromNode.coordinates.latitude) * t,
        longitude:
          fromNode.coordinates.longitude +
          (toNode.coordinates.longitude - fromNode.coordinates.longitude) * t,
      };
      const stepUnit =
        step === sampleSteps
          ? toNode.unit
          : identifyGeologicUnitAt(sampleCoords, customFeatures);

      if (stepUnit.unit_code !== prevSampleUnit.unit_code) {
        const contactDistM = Math.round(
          fromNode.cumulativeDistanceMeters + segDist * (t - 0.05)
        );
        const contactDistKm = Number((contactDistM / 1000).toFixed(2));
        contacts.push({
          id: `contact-${i}-${step}-${prevSampleUnit.unit_code}-${stepUnit.unit_code}`,
          segmentIndex: i,
          distanceMeters: contactDistM,
          distanceKm: contactDistKm,
          fromUnit: prevSampleUnit,
          toUnit: stepUnit,
          summary: `Contact Crossing: ${prevSampleUnit.unit_name} [${prevSampleUnit.unit_code}] → ${stepUnit.unit_name} [${stepUnit.unit_code}] at KM ${contactDistKm.toFixed(2)}`,
          scientificSignificance: describeContactSignificance(
            prevSampleUnit,
            stepUnit
          ),
        });
        prevSampleUnit = stepUnit;
      }
    }
  }

  const unitMap = new Map<string, GeologicUnitInfo>();
  for (const node of nodes) {
    if (!unitMap.has(node.unit.unit_code)) {
      unitMap.set(node.unit.unit_code, node.unit);
    }
  }
  for (const c of contacts) {
    if (!unitMap.has(c.toUnit.unit_code)) {
      unitMap.set(c.toUnit.unit_code, c.toUnit);
    }
  }

  const elevations = nodes.map((n) => n.elevationMeters);
  const minElevationMeters =
    elevations.length > 0 ? Math.min(...elevations) : -2600;
  const maxElevationMeters =
    elevations.length > 0 ? Math.max(...elevations) : -2450;
  const maxSlopeDegrees =
    segments.length > 0
      ? Math.max(...segments.map((s) => s.slopeDegrees))
      : 0;

  return {
    nodes,
    segments,
    contacts,
    uniqueUnitsTraversed: Array.from(unitMap.values()),
    steepHazardSegments: segments.filter((s) => s.isSteepSlopeHazard),
    sandHazardSegments: segments.filter((s) => s.isLooseSandHazard),
    maxSlopeDegrees,
    minElevationMeters,
    maxElevationMeters,
    totalDistanceMeters: Math.round(cumulativeMeters),
  };
}

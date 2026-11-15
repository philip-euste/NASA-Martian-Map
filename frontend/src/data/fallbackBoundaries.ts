// frontend/src/data/fallbackBoundaries.ts
// Offline static GeoJSON polygon boundaries for the four supported Martian study regions.
// Used as guaranteed instant fallbacks when the backend DEM/boundary service is offline,
// returning 502, or running on static hosting (e.g., Cloudflare Pages).

export type GeoJSONPosition = [number, number, ...number[]];

export interface StudyRegionBoundaryFeature {
  type: "Feature";
  properties: {
    region_id: string;
    boundary_status: string;
    boundary_accuracy: string;
    name?: string;
  };
  geometry: {
    type: "Polygon";
    coordinates: GeoJSONPosition[][];
  };
}

export const FALLBACK_STUDY_REGION_BOUNDARIES: Record<string, StudyRegionBoundaryFeature> = {
  jezero: {
    type: "Feature",
    properties: {
      region_id: "jezero",
      boundary_status: "offline_dem_coverage_approximation",
      boundary_accuracy: "DEM coverage extent; not a geological boundary",
      name: "Jezero Crater",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [76.99, 17.5805],
          [78.4935, 17.5805],
          [78.4935, 19.2902],
          [76.99, 19.2902],
          [76.99, 17.5805],
        ],
      ],
    },
  },
  gale: {
    type: "Feature",
    properties: {
      region_id: "gale",
      boundary_status: "offline_dem_coverage_approximation",
      boundary_accuracy: "DEM coverage extent; not a geological boundary",
      name: "Gale Crater",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [136.9, -5.85],
          [138.6, -5.85],
          [138.6, -4.85],
          [136.9, -4.85],
          [136.9, -5.85],
        ],
      ],
    },
  },
  "valles-marineris": {
    type: "Feature",
    properties: {
      region_id: "valles-marineris",
      boundary_status: "offline_dem_coverage_approximation",
      boundary_accuracy: "DEM coverage extent; not a geological boundary",
      name: "Valles Marineris",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-78.5, -11.5],
          [-74.2, -11.5],
          [-74.2, -8.0],
          [-78.5, -8.0],
          [-78.5, -11.5],
        ],
      ],
    },
  },
  "olympus-mons": {
    type: "Feature",
    properties: {
      region_id: "olympus-mons",
      boundary_status: "offline_dem_coverage_approximation",
      boundary_accuracy: "DEM coverage extent; not a geological boundary",
      name: "Olympus Mons",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-135.5, 17.0],
          [-132.0, 17.0],
          [-132.0, 20.2],
          [-135.5, 20.2],
          [-135.5, 17.0],
        ],
      ],
    },
  },
};

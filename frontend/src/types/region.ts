// frontend/src/types/region.ts
//
// Centralized Region Data Model & Simulator Availability System
// Phase 1 Architecture Foundation for Mars Explorer.
//
// Supports multi-tier datasets per region (global elevation vs high-resolution local DEMs)
// and strict simulator availability tracking without fabricated data or assumptions.

import type { Coordinates, Region } from "./index";

export type SimulatorAvailability =
  | "AVAILABLE"      // Verified, operational 3D surface simulator exists
  | "PLANNED"        // 3D environment designed; DEM tiles pending compilation
  | "UNAVAILABLE"    // No 3D environment planned; research via 2D/orbital GIS tools
  | "LIMITED_DATA";  // Incomplete scientific coverage; orbital analysis only

export interface RegionBounds {
  readonly westLonDeg: number;
  readonly eastLonDeg: number;
  readonly southLatDeg: number;
  readonly northLatDeg: number;
}

export type ElevationCoverageScope = "global" | "regional" | "local_inset";

export type ElevationAccessMode =
  | "tiled_3d_mesh"      // Pre-processed 16-bit binary DEM tiles (/manifest.json, /overview.u16)
  | "stac_cog"           // Remote Cloud-Optimized GeoTIFF via STAC / vsicurl
  | "pds_raster"         // NASA PDS binary raster (MOLA MEGDR, HRSC)
  | "wmts_visualization"; // Web Map Tile Service shaded relief (visual only)

export interface RegionalElevationDataset {
  readonly id: string;
  readonly name: string;
  readonly instrument: string;
  readonly mission: string;
  readonly coverageScope: ElevationCoverageScope;
  readonly horizontalResolutionMeters: number;
  readonly verticalPrecisionMeters?: number;
  readonly coordinateReferenceSystem: string;
  readonly verticalDatum: string; // e.g. "MOLA areoid (R = 3396.0 km)"
  readonly source: string;
  readonly accessMode: ElevationAccessMode;
  readonly isPrimaryForSimulator?: boolean;
}

export type GeologicalFormat = "geojson" | "shapefile" | "raster";
export type GeologicalStatus = "integrated_active" | "planned" | "unavailable";

export interface RegionalGeologicalDataset {
  readonly id: string;
  readonly name: string;
  readonly citation: string;
  readonly scale?: string;
  readonly publisher: string;
  readonly format: GeologicalFormat;
  readonly dataPath?: string; // Path under /public, e.g. "/data/jezero_geology_sim3464.geojson"
  readonly coverageScope: "regional" | "quadrangle" | "global";
  readonly status: GeologicalStatus;
  readonly unitsCount?: number;
}

export interface RegionalMapLayerRef {
  readonly layerId: string;
  readonly name: string;
  readonly role:
    | "primary_basemap"
    | "context_imagery"
    | "terrain_overlay"
    | "composition_overlay"
    | "thermal_overlay";
}

export interface RegionalEvidenceDatasetRef {
  readonly datasetId: string;
  readonly suitability: string;
  readonly role: "direct_quantitative" | "context_hazard" | "regional_context";
}

export interface RegionalRoverInfo {
  readonly missionName: string;
  readonly roverName: string;
  readonly landingDate: string;
  readonly landingCoordinates: Coordinates;
  readonly landingSiteName: string;
  readonly operationalStatus: "active" | "completed";
  readonly hasSurfaceImagery: boolean;
  readonly surfaceImageryCatalogId?: string;
  readonly atmosphericSensorSuite?: string;
}

export type RegionCategory =
  | "impact_crater"
  | "canyon_system"
  | "shield_volcano"
  | "tectonic_fracture"
  | "volcanic_plateau"
  | "outflow_channel";

export interface MarsRegion extends Region {
  readonly id: string;
  readonly name: string;
  readonly coordinates: Coordinates;
  readonly description: string;
  readonly regionLabel: string;
  readonly category: RegionCategory;
  readonly terrainType: string;
  readonly scientificSignificance: string;
  readonly geographicBounds: RegionBounds;
  readonly simulatorAvailability: SimulatorAvailability;
  readonly simulatorEnvironmentId?: string;

  /** Multi-tier elevation products (global MOLA vs local high-resolution DEMs) */
  readonly elevationDatasets: readonly RegionalElevationDataset[];

  /** Vector and raster geological maps */
  readonly geologicalDatasets: readonly RegionalGeologicalDataset[];

  /** Linked 2D/3D WMTS map layers */
  readonly mapLayers: readonly RegionalMapLayerRef[];

  /** Linked empirical scientific evidence datasets */
  readonly evidenceDatasets: readonly RegionalEvidenceDatasetRef[];

  /** Surface rover telemetry and imagery context (if a surface mission explored here) */
  readonly rover?: RegionalRoverInfo;

  /** Explicit scientific limitations and caveats */
  readonly dataLimitations: readonly string[];

  /** Peer-reviewed scientific literature and USGS citations */
  readonly scientificReferences: readonly string[];
}

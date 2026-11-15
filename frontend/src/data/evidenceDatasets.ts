// frontend/src/data/evidenceDatasets.ts
// Catalog #2: Scientific Evidence Dataset Catalog & Catalog #3: Surface Imagery Contract
// (Masterplan Phase 2, Task T-2.1).
//
// Three-Catalog Architecture:
// 1. Map Layer Catalog (`mapLayers.ts`): Background maps, shaded-relief hillshades,
//    color blends, and visualization overlays rendered on the 3D Globe and 2D Map.
//    Visualization-only basemaps (`VISUALIZATION_ONLY_LAYER_IDS`) are never exposed
//    as empirical evidence sources.
// 2. Scientific Evidence Dataset Catalog (`evidenceDatasets.ts` — this file):
//    Verifiable physical measurements and calibrated scientific products suitable
//    for supporting observations, analyses, and hypotheses, with explicit distinction
//    between actively integrated datasets and documented catalog reference datasets.
// 3. Surface Imagery Catalog (`SurfaceImageryCatalogItem` defined below; full rover
//    image retrieval and gallery integration scheduled for Task T-2.3):
//    Organizes verified surface photographs captured by Mars surface missions
//    (e.g., Perseverance Mastcam-Z, Navcam, SuperCam RMI).

import type {
  Dataset,
  DatasetOperationalStatus,
  GeographicCoverageScope,
  MarsRegion,
} from "../types";
import { MARS_REGIONS } from "./regions";
import {
  MAP_LAYERS,
  type MapLayerCategory,
  type MapLayerId,
} from "./mapLayers";

export type { DatasetOperationalStatus, GeographicCoverageScope };

export type CatalogRole =
  | "map_layer"
  | "scientific_evidence"
  | "surface_imagery";

export type EvidenceDatasetCategory =
  | "topography"
  | "optical_imagery"
  | "thermal_physical"
  | "composition"
  | "atmosphere_environment";

export type EvidenceSuitability =
  | "Direct Quantitative Analysis"
  | "Contextual & Hazard Analysis"
  | "Regional Context Only (Coarse Resolution)"
  | "Reference Only (Unverified Provenance)";

export type DatasetIntegrationStatus =
  | "integrated_active"
  | "integrated_backend"
  | "documented_not_integrated";

export const EVIDENCE_CATEGORY_LABELS: Record<
  EvidenceDatasetCategory,
  string
> = {
  topography: "Topography, Elevation & Slope",
  optical_imagery: "High-Resolution & Regional Optical Imagery",
  thermal_physical: "Thermal & Physical Surface Properties",
  composition: "Mineralogical & Spectral Composition",
  atmosphere_environment: "Atmosphere, Dust & Surface Environment",
};

export const INTEGRATION_STATUS_LABELS: Record<
  DatasetIntegrationStatus,
  string
> = {
  integrated_active: "Verified & Integrated (Live in App)",
  integrated_backend: "Verified & Integrated (Backend / Local Archive)",
  documented_not_integrated:
    "Verified Reference Only (Interactive Data Not Yet Integrated)",
};

export const COVERAGE_SCOPE_LABELS: Record<GeographicCoverageScope, string> = {
  GLOBAL: "Global Planetary Coverage",
  REGIONAL: "Regional Coverage",
  LOCAL_INSITU: "Local / In-Situ Footprint",
  UNKNOWN: "Unknown Coverage Extent",
};

export const OPERATIONAL_STATUS_LABELS: Record<DatasetOperationalStatus, string> = {
  REGISTERED: "Registered in Catalog",
  ACCESSIBLE: "PDS / Archive Accessible",
  DOWNLOADED: "Local Asset Cached",
  VALIDATED: "Calibrated & Validated",
  INTEGRATED: "Integrated in Application",
  PLANNED: "Planned for Future Integration",
  UNAVAILABLE: "Unavailable / Reference Only",
};

const TES_MINERAL_DUST_LIMITATION =
  "Surface dust can weaken bedrock features in TES thermal-infrared spectra. Treat weak or missing mineral signatures in dusty areas as inconclusive (Bandfield, 2002; Ruff & Christensen, 2002; Rogers & Christensen, 2007).";

export const CRISM_REFERENCE_DATASET_ID = "crism_jezero_vnir";
export const CRISM_MTRDR_BUNDLE_ID = "urn:nasa:pds:mro_crism_mtrdr";
export const CRISM_MTRDR_ARCHIVE_URL =
  "https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=urn%3Anasa%3Apds%3Amro_crism_mtrdr";
export const CRISM_REFERENCE_SOURCE = "Illustrative CRISM reference profile (synthetic values; archive reference only)";
export const CRISM_REFERENCE_LIMITATION =
  "The plotted curves are illustrative synthetic examples, not reflectance arrays extracted from CRISM PDS cubes. Archive IDs and annotated bands are references only; do not treat these curves as measured spectra.";
export const CRISM_REFERENCE_METHOD =
  "Plots bundled illustrative wavelength–reflectance pairs and preset band parameters; no CRISM spectral cube is parsed by this view.";

export interface EvidenceDatasetEntry {
  /** Stable dataset identifier used in Mission state and Observation records. */
  id: string;
  /** Human-readable scientific dataset title understandable to new users. */
  name: string;
  /** Instrument acronym and full name. */
  instrument: string;
  /** Spacecraft or rover mission name. */
  mission: string;
  /** Scientific evidence discipline category. */
  category: EvidenceDatasetCategory;
  /** Compatible discipline key for coverage matrices (`KnowledgeGapsPage`). */
  mapCategory: MapLayerCategory;
  /** Optional link if this dataset is also viewable as a 2D/3D Map Layer. */
  linkedMapLayerId?: MapLayerId;
  /** Concise description of the dataset. */
  description: string;
  /** Exact physical quantity or property measured/represented. */
  measurementProvided: string;
  /** Human-readable spatial resolution and vertical/spectral precision. */
  spatialResolutionLabel: string;
  /** Representative horizontal pixel size in meters (when applicable). */
  resolutionMeters?: number;
  /** Geographic coverage extent on Mars. */
  geographicCoverage: string;
  /** Structured geographic coverage scope. */
  coverageScope: GeographicCoverageScope;
  /** Specific region IDs this dataset applies to (if regional/local). Omitted for global. */
  supportedRegionIds?: readonly string[];
  /** Geographic bounding box for local/regional products (planetocentric degrees). */
  geographicBounds?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  /** Latitude boundary constraints for global/latitudinal products (e.g. ±60° for TES). */
  latitudeLimits?: {
    minLat: number;
    maxLat: number;
  };
  /** Explicit operational status tracking across lifecycle stages. */
  operationalStatus: readonly DatasetOperationalStatus[];
  /** Mission acquisition / temporal coverage window. */
  temporalCoverage: string;
  /** Appropriate scientific and operational uses in an investigation. */
  scientificPurpose: string;
  /** Suitability tier governing how evidence from this product may be interpreted. */
  suitability: EvidenceSuitability;
  /** Known instrumental, spatial, or environmental limitations. */
  limitations: string[];
  /** Region-specific operational or interpretive cautions (keyed by region ID). */
  regionalCaveats?: Record<string, string>;
  /** Authoritative NASA PDS / USGS / ESA PSA / Mars Trek archive reference. */
  sourceReference: string;
  /** Verified product or logical identifier in NASA PDS / Mars Trek / USGS. */
  pdsProductId: string;
  /** Whether the dataset is actively integrated for interactive querying/viewing in the app. */
  available: boolean;
  /** Explicit integration tier distinguishing integrated data from documented catalog references. */
  integrationStatus: DatasetIntegrationStatus;
  /** Human-readable integration status badge text. */
  integrationStatusLabel: string;
}

// =========================================================
// CATALOG #3: SURFACE IMAGERY CATALOG ARCHITECTURE (T-2.1 & T-2.3)
// =========================================================

export type SurfaceCameraInstrument =
  | "MCZ_LEFT"
  | "MCZ_RIGHT"
  | "NAVCAM_LEFT"
  | "NAVCAM_RIGHT"
  | "SUPERCAM_RMI"
  | "Mastcam-Z"
  | "Navcam"
  | "SuperCam RMI";

export type SurfaceCameraGroup = "MASTCAM_Z" | "NAVCAM" | "SUPERCAM_RMI";

/**
 * Surface Imagery Catalog contract (Catalog #3 — Task T-2.1 & T-2.3).
 * Keeps in-situ rover surface photographs separate from orbital map visualization
 * layers (Catalog #1) and orbital/environmental dataset tables (Catalog #2).
 */
export interface SurfaceImageryCatalogItem {
  readonly id: string;
  readonly catalogRole: "surface_imagery";
  readonly mission: string;
  readonly roverName: "Perseverance";
  readonly instrument: SurfaceCameraInstrument;
  readonly cameraGroup: SurfaceCameraGroup;
  readonly instrumentLabel: string;
  readonly sol: number;
  readonly dateTakenUtc: string | null;
  readonly dateTakenMars: string | null;
  readonly site: number | null;
  readonly drive: string | null;
  readonly xyzLocalMeters: string | null;
  readonly mastAzimuthDeg: number | null;
  readonly mastElevationDeg: number | null;
  readonly sclk: string | null;
  readonly dimensions: string | null;
  readonly sampleType: string;
  readonly filterName: string | null;
  readonly cameraModelType: string | null;
  /** Planetocentric coordinates only when explicitly verified; never fabricated from raw EDR records. */
  readonly coordinates?: { readonly latitude: number; readonly longitude: number };
  readonly coordinateStatusNote: string;
  readonly title: string;
  readonly caption: string;
  readonly credit: string;
  readonly imageUrl: string;
  readonly thumbnailUrl: string;
  readonly fullResUrl: string;
  readonly sourceUrl: string;
  readonly jsonApiUrl: string;
}

export const SURFACE_IMAGERY_DATASET_ID = "m2020_perseverance_surface_imagery";

/**
 * Map layers in `mapLayers.ts` that are pure visualization basemaps or synthetic
 * shaded-relief / color blends. These remain in the Map Layer Catalog for 3D Globe
 * and 2D Map rendering, but are excluded from the Scientific Evidence selector.
 */
export const VISUALIZATION_ONLY_LAYER_IDS: readonly MapLayerId[] = [
  "mars_global_mola",
  "mars_viking_global",
  "mars_moc_atlas",
  "mars_mola_hrsc_color",
  "mars_mola_hrsc_hillshade",
] as const;

export const EVIDENCE_DATASETS: readonly EvidenceDatasetEntry[] = [
  // =========================================================
  // 1. TOPOGRAPHY, ELEVATION & TERRAIN
  // =========================================================
  {
    id: "hirise_jezero_dtm",
    name: "HiRISE Jezero Crater Digital Terrain Model (1 m Elevation)",
    instrument: "HiRISE (High Resolution Imaging Science Experiment)",
    mission: "Mars Reconnaissance Orbiter (MRO)",
    category: "topography",
    mapCategory: "elevation",
    description:
      "High-resolution stereo photogrammetric Digital Terrain Model covering the Jezero Crater western delta and landing region.",
    measurementProvided:
      "Quantitative surface elevation (meters relative to Mars 2000 equipotential aeroid) and local terrain slope gradients. Provides elevation and terrain geometry, not mineralogical identification.",
    spatialResolutionLabel: "1.0 m/post (~0.2 m vertical precision)",
    resolutionMeters: 1,
    geographicCoverage:
      "Regional · Jezero Crater Stereo Strip (17.95°N–18.90°N, 76.95°E–78.05°E)",
    coverageScope: "REGIONAL",
    supportedRegionIds: ["jezero-crater"],
    geographicBounds: { minLat: 17.95, maxLat: 18.90, minLon: 76.95, maxLon: 78.05 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "2006–Present (MRO Primary & Extended Science Phases)",
    scientificPurpose:
      "Measure delta scarp relief, stratigraphic bed elevations, dip angles, and astronaut traverse slope hazards.",
    suitability: "Direct Quantitative Analysis",
    limitations: [
      "Provides terrain elevation and slope geometry only; cannot identify mineral composition or phyllosilicates.",
      "Spatial coverage is restricted to the controlled Jezero stereo pair footprint; sub-meter cobbles (<1 m) are below post spacing.",
      "Application data access: Quantitative spot elevation query via remote backend HiRISE DEM service (/api/dem/elevation), with local fallback to the verified 20 m CTX DEM. Multi-gigabyte raw DTM raster is not stored on local client disk.",
    ],
    sourceReference:
      "USGS Astrogeology Science Center / NASA PDS Cartography and Imaging Sciences Node",
    pdsProductId: "DTEEC_048842_1985_048908_1985_U01",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active,
  },
  {
    id: "ctx_jezero_dtm_20m",
    name: "CTX Jezero Crater Regional Digital Elevation Model (20 m DEM)",
    instrument: "CTX (Context Camera)",
    mission: "Mars Reconnaissance Orbiter (MRO)",
    category: "topography",
    mapCategory: "elevation",
    description:
      "Controlled regional stereo Digital Elevation Model of Jezero Crater and its western delta compiled for the Mars 2020 Science Investigation.",
    measurementProvided:
      "Regional surface elevation (heightMin -3504.6 m to heightMax -475.8 m relative to Mars 2000 aeroid) and 20 m terrain relief across the entire Jezero basin.",
    spatialResolutionLabel: "20.0 m/post (4456 × 5067 grid)",
    resolutionMeters: 20,
    geographicCoverage:
      "Regional · Jezero Crater Basin & Western Delta (17.58°N–19.29°N, 76.99°E–78.49°E)",
    coverageScope: "REGIONAL",
    supportedRegionIds: ["jezero-crater"],
    geographicBounds: { minLat: 17.58, maxLat: 19.29, minLon: 76.99, maxLon: 78.49 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "2006–2021 (USGS / NASA-JPL Mars 2020 Science Investigation Maps)",
    scientificPurpose:
      "Provide continuous regional elevation profiles, crater-rim-to-floor relief, Marswalk 3D terrain mesh heights, and local fallback elevation sampling.",
    suitability: "Direct Quantitative Analysis",
    limitations: [
      "Measures regional topography at 20 m post spacing; does not measure mineralogical composition.",
      "Steep meter-scale scarps and individual boulders are smoothed across 20 m posts.",
      "Application data access: Verified local DEM raster dataset stored in /jezero/manifest.json, /jezero/overview.u16, and /jezero/height/*.u16. Powers Marswalk 3D terrain mesh and local elevation sampling.",
    ],
    sourceReference:
      "USGS Astrogeology / NASA-JPL Mars 2020 Science Investigation CTX DEM (Calef, 2021; Mangold et al., 2021)",
    pdsProductId: "M20_JezeroCrater_CTXDEM_20m",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active,
  },
  {
    id: "mars_mola_roughness",
    name: "MOLA Global Surface Roughness (Kilometer-Scale)",
    instrument: "MOLA (Mars Orbiter Laser Altimeter)",
    mission: "Mars Global Surveyor (MGS)",
    category: "topography",
    mapCategory: "elevation",
    linkedMapLayerId: "mars_mola_roughness",
    description:
      "Global kilometer-scale surface roughness derived from 1064 nm laser altimeter pulse spreading and along-track slope baselines.",
    measurementProvided:
      "Root-mean-square (RMS) vertical terrain roughness at hectometer-to-kilometer baselines.",
    spatialResolutionLabel: "~30 km/pixel (0.5° global grid)",
    resolutionMeters: 30000,
    geographicCoverage: "Global (90°S–90°N, 180°W–180°E)",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -90, maxLat: 90 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "1997–2001 (MGS Mapping Mission)",
    scientificPurpose:
      "Broad regional characterization of physiographic provinces (smooth basin plains vs. heavily fractured highland terrain).",
    suitability: "Regional Context Only (Coarse Resolution)",
    limitations: [
      "CRITICAL RESOLUTION LIMITATION: Kilometer-scale statistical surface roughness derived from 1064 nm laser pulse spreading; NOT a high-resolution elevation DEM. Cannot resolve local crater rims, delta scarps, or meter-scale boulder hazards relevant to astronaut footing.",
      "Should be used only for broad regional geomorphic context, never as proof of local traverse safety or meter-scale surface texture.",
      "Application data access: Integrated as a global visual map overlay (NASA Mars Trek WMTS layer 'mola_roughness') and structured mission evidence citation source. Does not provide interactive numeric roughness sampling in this application.",
    ],
    sourceReference:
      "NASA PDS Geosciences Node / NASA Mars Trek WMTS (Neumann et al., 2003)",
    pdsProductId: "mola_roughness",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active,
  },

  // =========================================================
  // 2. HIGH-RESOLUTION & REGIONAL OPTICAL IMAGERY
  // =========================================================
  {
    id: "jezero_hirise",
    name: "HiRISE Jezero Crater Orthorectified Imagery (25 cm/px)",
    instrument: "HiRISE (High Resolution Imaging Science Experiment)",
    mission: "Mars Reconnaissance Orbiter (MRO)",
    category: "optical_imagery",
    mapCategory: "geology",
    description:
      "Sub-meter visible-light orthorectified image mosaic of the Jezero Crater landing ellipse and western delta front.",
    measurementProvided:
      "Visible red-band bidirectional reflectance showing meter-scale bedding, fracture networks, boulder fields, and aeolian bedforms. Supports morphological and geological interpretation, not direct mineralogical identification.",
    spatialResolutionLabel: "0.25 m/pixel (25 cm/pixel)",
    resolutionMeters: 0.25,
    geographicCoverage:
      "Regional · Jezero Crater Landing Ellipse & Western Delta",
    coverageScope: "REGIONAL",
    supportedRegionIds: ["jezero-crater"],
    geographicBounds: { minLat: 18.25, maxLat: 18.60, minLon: 77.25, maxLon: 77.65 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "2006–Present (MRO Orbital Archive)",
    scientificPurpose:
      "Identify fine-scale sedimentary stratification, truncated deltaic foreset/topset beds, polygonal fracturing, and boulder distributions.",
    suitability: "Direct Quantitative Analysis",
    limitations: [
      "Provides visible surface morphology and stratigraphic geometry only; does not directly measure mineralogical composition or hydration state.",
      "Surface dust veneers can mute visual contrast between distinct lithological units.",
      "Application data access: High-resolution visual orthomosaic served via remote NASA Mars Trek WMTS tile service (JEZ_hirise_soc_006). High-resolution image tiles are streamed on demand and not pre-downloaded to local client disk.",
    ],
    sourceReference: "NASA Mars Trek / USGS Astrogeology / MRO HiRISE Team",
    pdsProductId: "JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd",
    available: true,
    integrationStatus: "integrated_backend",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_backend,
  },
  {
    id: "ctx_jezero_ortho_5m",
    name: "CTX Jezero Crater Regional Orthomosaic Imagery (5 m/px)",
    instrument: "CTX (Context Camera)",
    mission: "Mars Reconnaissance Orbiter (MRO)",
    category: "optical_imagery",
    mapCategory: "geology",
    description:
      "Controlled 5 m/pixel panchromatic visible orthomosaic of Jezero Crater, Neretva Vallis inlet channel, and the western delta.",
    measurementProvided:
      "Panchromatic (500–700 nm) surface reflectance imagery capturing regional geomorphology, fluvial channels, delta lobes, and crater floor units.",
    spatialResolutionLabel: "5.0 m/pixel",
    resolutionMeters: 5,
    geographicCoverage:
      "Regional · Jezero Crater Basin & Inlet Channels (17.58°N–19.29°N, 76.99°E–78.49°E)",
    coverageScope: "REGIONAL",
    supportedRegionIds: ["jezero-crater"],
    geographicBounds: { minLat: 17.58, maxLat: 19.29, minLon: 76.99, maxLon: 78.49 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "2006–2021 (USGS / NASA-JPL Mars 2020 Science Investigation Maps)",
    scientificPurpose:
      "Support regional geological and geomorphological context, trace ancient fluvial feeder channels into the western delta, and map contact boundaries.",
    suitability: "Contextual & Hazard Analysis",
    limitations: [
      "Panchromatic visible imagery (5 m/pixel) supports regional geological and geomorphological context only; it cannot identify phyllosilicate mineralogy or sub-meter sedimentary laminations.",
      "Application data access: Verified local texture tiles stored in /jezero/overview.jpg and /jezero/tex/*.jpg. Powers Marswalk 3D surface visual textures.",
    ],
    sourceReference:
      "USGS Astrogeology / NASA-JPL Mars 2020 Science Investigation CTX Orthomosaic (Calef, 2021; Mangold et al., 2021)",
    pdsProductId: "M20_JezeroCrater_CTXortho_mosaic_5m",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active,
  },

  // =========================================================
  // 3. THERMAL & PHYSICAL SURFACE PROPERTIES
  // =========================================================
  {
    id: "mars_themis_night",
    name: "THEMIS Nighttime Thermal Infrared Mosaic (100 m/px)",
    instrument: "THEMIS (Thermal Emission Imaging System)",
    mission: "2001 Mars Odyssey",
    category: "thermal_physical",
    mapCategory: "thermal",
    linkedMapLayerId: "mars_themis_night",
    description:
      "Global pre-dawn (~3:00 AM LST) thermal infrared radiance mosaic sensitive to surface grain consolidation and exposed bedrock.",
    measurementProvided:
      "Nighttime thermal infrared brightness temperature (Band 9, 12.57 µm), serving as a high-resolution proxy for thermal inertia and physical grain consolidation.",
    spatialResolutionLabel: "100 m/pixel",
    resolutionMeters: 100,
    geographicCoverage: "Global (90°S–90°N, 180°W–180°E)",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -90, maxLat: 90 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "2002–Present (2001 Mars Odyssey)",
    scientificPurpose:
      "Distinguish competent, high-thermal-inertia bedrock outcrops (warm at night) from unconsolidated sand traps and thick dust mantles (cool at night).",
    suitability: "Contextual & Hazard Analysis",
    limitations: [
      "Describes thermal surface properties (physical induration, grain size, and rock abundance), NOT direct proof of phyllosilicates or specific mineral chemistry.",
      "At 100 m/pixel, sub-hectometer bedrock exposures are thermally averaged with surrounding regolith.",
      "Application data access: Integrated as a global visual map overlay (NASA Mars Trek WMTS layer 'themis_night') and structured mission evidence citation source. Does not provide interactive numeric temperature/inertia point-sampling in this application.",
    ],
    sourceReference:
      "ASU Mars Space Flight Facility / NASA PDS / Mars Trek (Christensen et al.)",
    pdsProductId: "THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active,
  },
  {
    id: "mars_themis_day",
    name: "THEMIS Daytime Thermal Infrared Mosaic (100 m/px)",
    instrument: "THEMIS (Thermal Emission Imaging System)",
    mission: "2001 Mars Odyssey",
    category: "thermal_physical",
    mapCategory: "thermal",
    linkedMapLayerId: "mars_themis_day",
    description:
      "Global afternoon (~3:00 PM LST) thermal infrared radiance mosaic capturing solar-heated surface morphology and regional landforms.",
    measurementProvided:
      "Daytime thermal infrared radiance (12.57 µm) reflecting combined solar insolation, slope orientation, and surface albedo.",
    spatialResolutionLabel: "100 m/pixel",
    resolutionMeters: 100,
    geographicCoverage: "Global (90°S–90°N, 180°W–180°E)",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -90, maxLat: 90 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "2002–Present (2001 Mars Odyssey)",
    scientificPurpose:
      "Examine regional geomorphology, channel continuity, crater ejecta blankets, and paired day/night thermal anomalies.",
    suitability: "Contextual & Hazard Analysis",
    limitations: [
      "Daytime infrared radiance is dominated by sun-facing topographic slope heating rather than intrinsic rock consolidation or mineral composition.",
      "Requires pairing with Nighttime IR or DTM slope data to separate topography from material properties.",
      "Application data access: Integrated as a global visual map overlay (NASA Mars Trek WMTS layer 'themis_day') and structured mission evidence citation source. Does not provide interactive numeric radiance point-sampling in this application.",
    ],
    sourceReference:
      "ASU Mars Space Flight Facility / NASA PDS / Mars Trek (Christensen et al.)",
    pdsProductId: "THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active,
  },
  {
    id: "mars_tes_thermal",
    name: "TES Bolometric Thermal Inertia (~3 km/px)",
    instrument: "TES (Thermal Emission Spectrometer)",
    mission: "Mars Global Surveyor (MGS)",
    category: "thermal_physical",
    mapCategory: "thermal",
    linkedMapLayerId: "mars_tes_thermal",
    description:
      "Global quantitative thermal inertia map derived from diurnal surface temperature curves.",
    measurementProvided:
      "Bulk thermal inertia (J·m⁻²·K⁻¹·s⁻¹/²) indexing effective particle size, induration, and rock abundance.",
    spatialResolutionLabel: "~3 km/pixel (20 pixels/degree)",
    resolutionMeters: 3000,
    geographicCoverage: "Global (90°S–90°N, 180°W–180°E)",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -90, maxLat: 90 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "1999–2006 (MGS Mapping Mission)",
    scientificPurpose:
      "Assess regional sediment consolidation (fine dust vs. indurated duricrust vs. coarse sand/bedrock).",
    suitability: "Regional Context Only (Coarse Resolution)",
    limitations: [
      "Measures physical heat capacity and particle consolidation, NOT mineralogical proof of phyllosilicates.",
      "Coarse ~3 km pixel footprint averages bedrock scarps, boulder fields, and aeolian dunes into a single bulk value.",
      "Application data access: Integrated as a global visual map overlay (NASA Mars Trek WMTS layer 'tes_thermal') and structured mission evidence citation source. Interactive numeric thermal inertia point-sampling is not provided in this application.",
    ],
    sourceReference:
      "NASA PDS Geosciences Node / Mars Trek (Mellon et al., 2000; Putzig & Mellon, 2007)",
    pdsProductId: "TES_Thermal_Inertia",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active,
  },
  {
    id: "mars_tes_albedo",
    name: "TES Bolometric Surface Albedo (~7.4 km/px)",
    instrument: "TES (Thermal Emission Spectrometer)",
    mission: "Mars Global Surveyor (MGS)",
    category: "thermal_physical",
    mapCategory: "thermal",
    linkedMapLayerId: "mars_tes_albedo",
    description:
      "Global solar-spectrum (0.3–2.9 µm) Lambertian reflectance map of the Martian surface.",
    measurementProvided:
      "Broadband bolometric albedo (dimensionless 0.0–1.0) corrected for solar incidence angle.",
    spatialResolutionLabel: "~7.4 km/pixel (8 pixels/degree)",
    resolutionMeters: 7410,
    geographicCoverage: "Global (90°S–90°N, 180°W–180°E)",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -90, maxLat: 90 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "1999–2006 (MGS Mapping Mission)",
    scientificPurpose:
      "Differentiate bright ferric dust-mantled regions from dark, wind-swept basaltic sand and bedrock.",
    suitability: "Regional Context Only (Coarse Resolution)",
    limitations: [
      "Broadband reflectance scalar only; contains no diagnostic absorption bands for mineral identification.",
      "Subject to temporal shifts following regional or global dust storms.",
      "Application data access: Integrated as a global visual map overlay (NASA Mars Trek WMTS layer 'tes_albedo') and structured mission evidence citation source. Interactive numeric albedo point-sampling is not provided in this application.",
    ],
    sourceReference:
      "NASA PDS Geosciences Node / Mars Trek (Christensen et al., 2001)",
    pdsProductId: "Mars_MGS_TES_Albedo_mosaic_global_7410m",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active,
  },

  // =========================================================
  // 4. MINERALOGICAL & SPECTRAL COMPOSITION
  // =========================================================
  {
    id: "mars_tes_silicates",
    name: "TES Sheet Silicate / High-Silica Phase Index (~3–8 km/px)",
    instrument: "TES (Thermal Emission Spectrometer)",
    mission: "Mars Global Surveyor (MGS)",
    category: "composition",
    mapCategory: "composition",
    linkedMapLayerId: "mars_tes_silicates",
    description:
      "Global thermal infrared spectral deconvolution map modeling high-silica phases (volcanic glass, amorphous silica coatings, or sheet silicates).",
    measurementProvided:
      "Modeled areal abundance fraction of high-silica / sheet-silicate spectral endmembers from 6–50 µm thermal emissivity.",
    spatialResolutionLabel: "~3–8 km/pixel (8–20 pixels/degree)",
    resolutionMeters: 3000,
    geographicCoverage: "Global map extent · app filters to 60°S–60°N · usable retrievals vary",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -60, maxLat: 60 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "1999–2006 (MGS Mapping Mission)",
    scientificPurpose:
      "Provide broad regional context for high-silica crustal provinces and weathered basaltic surfaces.",
    suitability: "Regional Context Only (Coarse Resolution)",
    limitations: [
      "CRITICAL SCIENTIFIC LIMITATION: Thermal infrared deconvolution at ~3–8 km/px cannot uniquely distinguish hydrated phyllosilicate clays (e.g., Fe/Mg smectite) from primary high-silica volcanic glass or amorphous silica coatings.",
      TES_MINERAL_DUST_LIMITATION,
      "A single ~3 km TES pixel spans nearly the entire western Jezero delta; this dataset CANNOT independently prove fine-grained lacustrine clay strata and must be supplemented by targeted VNIR spectroscopy (CRISM) or in-situ contact instruments.",
      "Application data access: Integrated as a global visual map overlay (NASA Mars Trek WMTS layer 'tes_glass_clay') and structured mission evidence citation source. Interactive numeric deconvolution point-sampling is not provided in this application.",
    ],
    regionalCaveats: {
      "olympus-mons": TES_MINERAL_DUST_LIMITATION,
    },
    sourceReference:
      "NASA PDS Geosciences Node / Mars Trek (Bandfield et al., 2000; Rogers & Christensen, 2007)",
    pdsProductId: "TES_Glass_Clay",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active,
  },
  {
    id: "mars_tes_pyroxene",
    name: "TES High-Calcium Pyroxene Abundance (~3–8 km/px)",
    instrument: "TES (Thermal Emission Spectrometer)",
    mission: "Mars Global Surveyor (MGS)",
    category: "composition",
    mapCategory: "composition",
    linkedMapLayerId: "mars_tes_pyroxene",
    description:
      "Global thermal infrared linear deconvolution map of clinopyroxene (high-Ca pyroxene) abundance.",
    measurementProvided:
      "Modeled areal abundance fraction of clinopyroxene in dust-free mafic surfaces.",
    spatialResolutionLabel: "~3–8 km/pixel",
    resolutionMeters: 3000,
    geographicCoverage: "Global map extent · app filters to 60°S–60°N · usable retrievals vary",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -60, maxLat: 60 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "1999–2006 (MGS Mapping Mission)",
    scientificPurpose:
      "Characterize regional mafic igneous crust and volcanic floor units surrounding impact basins.",
    suitability: "Regional Context Only (Coarse Resolution)",
    limitations: [
      "Coarse ~3–8 km spatial resolution cannot resolve individual crater-floor outcrops or thin sedimentary beds.",
      TES_MINERAL_DUST_LIMITATION,
      "Under the Dust Cover Index (DCI) convention of Ruff & Christensen (2002), lower values generally indicate dustier surfaces.",
      "Application data access: Integrated as a global visual map overlay (NASA Mars Trek WMTS layer 'tes_clinopyroxene') and structured mission evidence citation source. Interactive numeric mineral abundance point-sampling is not provided in this application.",
    ],
    regionalCaveats: {
      "olympus-mons": TES_MINERAL_DUST_LIMITATION,
    },
    sourceReference:
      "NASA PDS Geosciences Node / Mars Trek (Bandfield, 2002; Christensen et al.)",
    pdsProductId: "TES_Clinopyroxene",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active,
  },
  {
    id: "mars_tes_plagioclase",
    name: "TES Plagioclase Feldspar Abundance (~3–8 km/px)",
    instrument: "TES (Thermal Emission Spectrometer)",
    mission: "Mars Global Surveyor (MGS)",
    category: "composition",
    mapCategory: "composition",
    linkedMapLayerId: "mars_tes_plagioclase",
    description:
      "Global thermal infrared linear deconvolution map of primary plagioclase feldspar abundance.",
    measurementProvided:
      "Modeled areal abundance fraction of plagioclase feldspar from thermal infrared emissivity spectra.",
    spatialResolutionLabel: "~3–8 km/pixel",
    resolutionMeters: 3000,
    geographicCoverage: "Near-global map extent · app filters to 60°S–60°N · usable retrievals vary",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -60, maxLat: 60 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "1999–2006 (MGS Mapping Mission)",
    scientificPurpose:
      "Evaluate regional feldspathic crustal composition and primary igneous petrology.",
    suitability: "Regional Context Only (Coarse Resolution)",
    limitations: [
      "Coarse ~3–8 km spatial resolution cannot isolate outcrop-scale sedimentary strata or detrital mineral grains.",
      TES_MINERAL_DUST_LIMITATION,
      "Application data access: Integrated as a global visual map overlay (NASA Mars Trek WMTS layer 'tes_plagioclase') and structured mission evidence citation source. Interactive numeric mineral abundance point-sampling is not provided in this application.",
    ],
    regionalCaveats: {
      "olympus-mons": TES_MINERAL_DUST_LIMITATION,
    },
    sourceReference:
      "NASA PDS Geosciences Node / Mars Trek (Bandfield, 2002; Rogers & Christensen, 2007)",
    pdsProductId: "TES_Plagioclase",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active,
  },
  {
    id: CRISM_REFERENCE_DATASET_ID,
    name: "CRISM VNIR Reference Profiles (Jezero)",
    instrument: "CRISM (Compact Reconnaissance Imaging Spectrometer for Mars)",
    mission: "Mars Reconnaissance Orbiter (MRO)",
    category: "composition",
    mapCategory: "composition",
    description: CRISM_REFERENCE_LIMITATION,
    measurementProvided: "Preset wavelength–reflectance pairs and band parameters for reference.",
    spatialResolutionLabel: "Bundled profiles · extraction footprint unverified",
    geographicCoverage:
      "Jezero reference locations · extraction footprints unverified",
    coverageScope: "LOCAL_INSITU",
    supportedRegionIds: ["jezero-crater"],
    geographicBounds: { minLat: 18.35, maxLat: 18.55, minLon: 77.30, maxLon: 77.55 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "INTEGRATED"],
    temporalCoverage: "2006–2012 (NASA PDS MTRDR archive)",
    scientificPurpose:
      "Illustrate spectral features discussed in Jezero mineralogy studies and provide a reference to the NASA PDS archive.",
    suitability: "Reference Only (Unverified Provenance)",
    limitations: [
      CRISM_REFERENCE_LIMITATION,
      "The plotted values and preset band parameters are for reference. Quantitative interpretation requires traceable measurements from the archive.",
    ],
    sourceReference:
      "NASA PDS Geosciences Node (archive); Ehlmann et al. (2008), Goudge et al. (2015), Horgan et al. (2020) (Jezero scientific context)",
    pdsProductId: CRISM_MTRDR_BUNDLE_ID,
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: "Bundled Reference Profiles · Unverified Extraction",
  },
  {
    id: "omega_vnir_regional",
    name: "OMEGA Regional VNIR Spectral Observations (Catalog Reference)",
    instrument: "OMEGA (Observatoire pour la Minéralogie, l'Eau, les Glaces et l'Activité)",
    mission: "Mars Express (ESA)",
    category: "composition",
    mapCategory: "composition",
    description:
      "Regional visible and near-infrared (0.35–5.1 µm) imaging spectrometer observations mapping regional phyllosilicate-bearing terrains across Nili Fossae and Syrtis Major.",
    measurementProvided:
      "Regional VNIR reflectance spectra (352 spectral channels) identifying broad Fe/Mg-phyllosilicate, olivine, and pyroxene spectral signatures.",
    spatialResolutionLabel: "~300 m to 4.8 km/pixel",
    resolutionMeters: 1000,
    geographicCoverage:
      "Regional Swaths · Nili Fossae, Syrtis Major & Circum-Isidis Highlands",
    coverageScope: "REGIONAL",
    supportedRegionIds: ["jezero-crater"],
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "UNAVAILABLE"],
    temporalCoverage: "2004–Present (ESA Mars Express)",
    scientificPurpose:
      "Provide broader watershed-scale spectral context for hydrated silicate provinces feeding into the Jezero Crater basin.",
    suitability: "Regional Context Only (Coarse Resolution)",
    limitations: [
      "INTEGRATION STATUS: Documented reference entry only — interactive OMEGA spectral cubes are NOT currently integrated in this application.",
      "At ~300 m to 4.8 km/pixel, OMEGA resolves regional watershed mineralogy rather than individual deltaic beds or outcrop-scale strata inside Jezero Crater.",
    ],
    sourceReference:
      "ESA Planetary Science Archive (PSA) / NASA PDS (Bibring et al., 2005; Poulet et al., 2005; Carter et al., 2013)",
    pdsProductId: "MEX-M-OMEGA-2-EDR-FLIGHT-V1.0",
    available: false,
    integrationStatus: "documented_not_integrated",
    integrationStatusLabel:
      INTEGRATION_STATUS_LABELS.documented_not_integrated,
  },

  // =========================================================
  // 5. ATMOSPHERE, DUST & SURFACE ENVIRONMENT
  // =========================================================
  {
    id: "mars_tes_dust_index",
    name: "TES Surface Dust Cover Index (DCI ~3 km/px)",
    instrument: "TES (Thermal Emission Spectrometer)",
    mission: "Mars Global Surveyor (MGS)",
    category: "atmosphere_environment",
    mapCategory: "atmosphere",
    linkedMapLayerId: "mars_tes_dust_index",
    description:
      "Global map of fine silicate surface dust coating thickness derived from the 9 µm particle transparency feature.",
    measurementProvided:
      "Dust Cover Index (DCI, ~0.92–1.00), where lower values (<0.94) indicate dust-coated surfaces and higher values (>0.96) indicate dust-free rock/sand.",
    spatialResolutionLabel: "~3 km/pixel",
    resolutionMeters: 3000,
    geographicCoverage: "Global (90°S–90°N, 180°W–180°E)",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -90, maxLat: 90 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "1999–2006 (MGS Mapping Mission)",
    scientificPurpose:
      "Determine whether orbital thermal/spectral measurements in a study region are obscured by surface dust coatings, and assess dust adhesion hazards.",
    suitability: "Contextual & Hazard Analysis",
    limitations: [
      "Measures micron-scale surface dust coatings across ~3 km footprints; does not measure bedrock composition.",
      "High dust cover masks underlying mineral signatures in both VNIR and TIR orbital datasets.",
      "Application data access: Integrated as a global visual map overlay (NASA Mars Trek WMTS layer 'tes_ruffdust') and structured mission evidence citation source. Interactive numeric dust cover point-sampling is not provided in this application.",
    ],
    sourceReference:
      "NASA PDS Geosciences Node / Mars Trek (Ruff & Christensen, 2002)",
    pdsProductId: "tes_ruffdust",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active,
  },
  {
    id: "mars_tes_dust",
    name: "TES Atmospheric Dust Optical Depth Climatology",
    instrument: "TES (Thermal Emission Spectrometer)",
    mission: "Mars Global Surveyor (MGS)",
    category: "atmosphere_environment",
    mapCategory: "atmosphere",
    linkedMapLayerId: "mars_tes_dust",
    description:
      "Orbital climatology of column-integrated 9 µm atmospheric dust opacity across the Martian seasons.",
    measurementProvided:
      "Infrared atmospheric dust optical depth (τ at 1075 cm⁻¹ / 9.3 µm).",
    spatialResolutionLabel: "~30–60 km/pixel",
    resolutionMeters: 30000,
    geographicCoverage: "Global (90°S–90°N, 180°W–180°E)",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -90, maxLat: 90 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "1999–2006 (MGS Mapping Mission)",
    scientificPurpose:
      "Assess regional atmospheric dust loading, solar power attenuation, and orbital observation clarity.",
    suitability: "Regional Context Only (Coarse Resolution)",
    limitations: [
      "Historical orbital climatology; does not provide real-time local surface wind or visibility without in-situ station telemetry.",
      "Application data access: Integrated as a global visual map overlay (NASA Mars Trek WMTS layer 'tes_dust') and structured mission evidence citation source. Interactive numeric optical depth point-sampling is not provided in this application.",
    ],
    sourceReference:
      "NASA PDS Atmospheres Node / Mars Trek (Smith, 2004)",
    pdsProductId: "TES_Dust",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active,
  },
  {
    id: "m2020_meda_env",
    name: "Perseverance MEDA Surface Environmental Measurements (PDS4 Sol 0001 & Sol 0036)",
    instrument: "MEDA (Mars Environmental Dynamics Analyzer)",
    mission: "Mars 2020 Perseverance Rover",
    category: "atmosphere_environment",
    mapCategory: "atmosphere",
    description:
      "Validated in-situ meteorological and radiative measurements recorded on the floor of Jezero Crater by the Perseverance rover across all 7 MEDA sensor subsystems (PS, ATS, TIRS, RHS, WS, RDS, ANC).",
    measurementProvided:
      "Atmospheric pressure (PS, Pa), 5-boom local air temperatures (ATS, K & °C), ground surface temperature & IR irradiance (TIRS, K & W/m²), relative humidity & frost point (RHS, % & K), wind speed & direction (WS, m/s & deg), solar photodiode radiation (RDS, W/m²), and solar geometry (ANC, deg).",
    spatialResolutionLabel: "In-situ rover station (Octavia E. Butler Landing · 18.4447°N, 77.4508°E)",
    resolutionMeters: 1,
    geographicCoverage:
      "Local · Jezero Crater Floor (Octavia E. Butler Landing Site, ~2.2 km SE of Western Delta Front)",
    coverageScope: "LOCAL_INSITU",
    supportedRegionIds: ["jezero-crater"],
    geographicBounds: { minLat: 18.44, maxLat: 18.45, minLon: 77.44, maxLon: 77.46 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage:
      "Sol 0001 (2021-02-19, ATS/PS/TIRS/RHS/RDS/ANC) & Sol 0036 (2021-03-27, WS) · 53,263 validated PDS4 records",
    scientificPurpose:
      "Provide ground-truth surface barometric pressure, diurnal air/ground thermal extremes, relative humidity, solar radiation flux, and wind conditions for astronaut suit life-support and EVA traverse planning.",
    suitability: "Direct Quantitative Analysis",
    limitations: [
      "Environmental measurements only: MEDA characterizes modern meteorological conditions at the rover's Jezero Crater floor location (~2.2 km SE of the western delta front) and is NOT direct evidence of ancient lake deposits or phyllosilicate mineralogy.",
      "Archive subset covers Sol 0001 (ATS, PS, TIRS, RHS, RDS, ANC) and Sol 0036 (WS); 1,990 WS rows containing PDS invalid sentinel `999999999` are preserved as missing values (never interpreted as zero).",
      "Application data access: Verified local PDS4 processed bundle stored in /public/data/meda_processed_bundle.json (53,263 validated records across Sol 0001 & Sol 0036). Interactive environmental sensor queries execute locally against this pre-bundled archive.",
    ],
    sourceReference:
      "NASA PDS Atmospheres Node (https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/ · Rodriguez-Manfredi et al., 2021)",
    pdsProductId: "urn:nasa:pds:mars2020_meda",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active,
  },
  {
    id: "msl_rems_env",
    name: "Curiosity REMS Surface Environmental Telemetry (PDS Sol 10 & Sol 1600)",
    instrument: "REMS (Rover Environmental Monitoring Station)",
    mission: "Mars Science Laboratory (MSL) Curiosity",
    category: "atmosphere_environment",
    mapCategory: "atmosphere",
    description:
      "Validated in-situ meteorological measurements recorded on the floor of Gale Crater by the Curiosity rover across 6 sensor subsystems (Pressure, Air Temperature, Ground Temperature, Relative Humidity, Wind, and UV Radiation).",
    measurementProvided:
      "Atmospheric surface pressure (Barocap, Pa), dual-boom air temperatures (PT1000 RTD, K & °C), ground brightness temperature (thermopile, K & °C), relative humidity (capacitive thin-film, %), wind speed & direction (derived CFD flow vector, m/s & deg), and UV flux (photodiodes, W/m²).",
    spatialResolutionLabel: "In-situ rover station (Bradbury Landing / Mount Sharp traverse · 4.59°S, 137.44°E)",
    resolutionMeters: 1,
    geographicCoverage:
      "Local · Gale Crater Floor (Bradbury Landing to Aeolis Mons / Mount Sharp lower mound)",
    coverageScope: "LOCAL_INSITU",
    supportedRegionIds: ["gale-crater"],
    geographicBounds: { minLat: -5.85, maxLat: -4.0, minLon: 137.0, maxLon: 138.0 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage:
      "Sol 0010 (2012-08-15, pre-degradation baseline) & Sol 01600 (2017-02-04, post-wind degradation) · 44,459 raw PDS source table records; 1,081 packaged sampled observations in application bundle",
    scientificPurpose:
      "Characterize Gale Crater boundary-layer atmospheric pressure oscillations, ground/air thermal extremes, humidity cycles, and UV flux variations along the Mount Sharp exploration corridor.",
    suitability: "Direct Quantitative Analysis",
    limitations: [
      "Hardware Degradation Timeline: Boom 1 wind sensor damaged on landing (Sol 0) by Sky Crane ejecta; Boom 2 operational Sols 0–854; Boom 2 degraded Sols 854–1504; all wind sensor boards across both booms permanently failed on Sol 1504. Sol 1600 wind telemetry is inoperative.",
      "Sampling Cadence: REMS operates on a commanded duty cycle of 5 minutes at the start of each hour (120 minutes/sol active recording). Telemetry is discrete hourly bursts across LMST, not continuous 24-hour recording.",
      "Application data access: Verified local PDS processed bundle stored in /data/rems_processed_bundle.json (44,459 raw source records downsampled to 1,081 packaged observations across Sols 10 & 1600). Interactive queries execute locally against this pre-bundled archive.",
    ],
    sourceReference:
      "NASA PDS Atmospheres Node (https://pds-atmospheres.nmsu.edu/PDS/data/mslrem_1001/ · Gómez-Elvira et al., 2012; Newman et al., 2017)",
    pdsProductId: "urn:nasa:pds:msl_rems:data_derived_envrdr",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active,
  },
] as const;

export const EVIDENCE_DATASETS_BY_ID: Record<string, EvidenceDatasetEntry> =
  Object.fromEntries(EVIDENCE_DATASETS.map((entry) => [entry.id, entry]));

/**
 * Filter options for region-aware scientific dataset retrieval.
 */
export interface DatasetFilterOptions {
  /** If true, includes PLANNED and UNAVAILABLE datasets. Default false. */
  includePlannedOrUnavailable?: boolean;
  /** Filter by category */
  category?: EvidenceDatasetCategory | "all" | "selected";
  /** Additional search query */
  search?: string;
}

/**
 * Checks whether a dataset is applicable to a specific region based on its
 * geographic coverage scope, supportedRegionIds, and latitude limits.
 *
 * For GLOBAL datasets with latitude limits, checks the region's south and north
 * bounds or falls back to its center latitude. Other datasets use supported region
 * IDs. This filter does not verify longitude, product footprints, or usable pixels.
 */
export function isDatasetApplicableToRegion(
  entry: EvidenceDatasetEntry,
  regionOrId?:
    | string
    | MarsRegion
    | {
        coordinates: { latitude: number; longitude: number };
        geographicBounds?: {
          southLatDeg: number;
          northLatDeg: number;
          westLonDeg?: number;
          eastLonDeg?: number;
        };
        id?: string;
      }
): boolean {
  if (!regionOrId) return true;

  const region =
    typeof regionOrId === "string"
      ? MARS_REGIONS[regionOrId]
      : regionOrId;

  const regionId =
    typeof regionOrId === "string"
      ? regionOrId
      : "id" in regionOrId && regionOrId.id
        ? regionOrId.id
        : undefined;

  if (entry.coverageScope === "GLOBAL") {
    if (region && entry.latitudeLimits) {
      if (region.geographicBounds) {
        const { southLatDeg, northLatDeg } = region.geographicBounds;
        if (
          southLatDeg < entry.latitudeLimits.minLat ||
          northLatDeg > entry.latitudeLimits.maxLat
        ) {
          return false;
        }
      } else {
        const lat = region.coordinates.latitude;
        if (
          lat < entry.latitudeLimits.minLat ||
          lat > entry.latitudeLimits.maxLat
        ) {
          return false;
        }
      }
    }
    return true;
  }

  if (entry.supportedRegionIds && entry.supportedRegionIds.length > 0) {
    return regionId ? entry.supportedRegionIds.includes(regionId) : false;
  }

  return false;
}

/**
 * Checks whether a dataset is usable in active missions (integrated, accessible, and not unavailable).
 */
export function isDatasetUsable(entry: EvidenceDatasetEntry): boolean {
  if (!entry.available) return false;
  if (
    entry.operationalStatus.includes("UNAVAILABLE") ||
    entry.operationalStatus.includes("PLANNED")
  ) {
    return false;
  }
  return entry.operationalStatus.includes("INTEGRATED");
}

/**
 * Returns datasets that are applicable and usable for the specified region.
 */
export function getDatasetsForRegion(
  regionId?: string,
  options: DatasetFilterOptions = {}
): EvidenceDatasetEntry[] {
  return EVIDENCE_DATASETS.filter((entry) => {
    if (!isDatasetApplicableToRegion(entry, regionId)) return false;
    if (!options.includePlannedOrUnavailable && !isDatasetUsable(entry)) {
      return false;
    }
    if (
      options.category &&
      options.category !== "all" &&
      options.category !== "selected" &&
      entry.category !== options.category
    ) {
      return false;
    }
    if (options.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      const hay =
        `${entry.name} ${entry.instrument} ${entry.mission} ${entry.description} ${entry.measurementProvided} ${EVIDENCE_CATEGORY_LABELS[entry.category]}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Returns datasets that are planned, documented reference only, or unavailable
 * for the specified region (for future catalog references, not for active selection).
 */
export function getPlannedOrUnavailableDatasetsForRegion(
  regionId?: string
): EvidenceDatasetEntry[] {
  return EVIDENCE_DATASETS.filter((entry) => {
    if (!isDatasetApplicableToRegion(entry, regionId)) return false;
    return !isDatasetUsable(entry);
  });
}

/**
 * Converts a verified `EvidenceDatasetEntry` into a `Dataset` object for storage
 * in `Mission.selectedDatasets`, preserving full backward compatibility.
 */
export function toMissionDataset(entry: EvidenceDatasetEntry): Dataset {
  return {
    id: entry.id,
    name: entry.name,
    source:
      entry.id === CRISM_REFERENCE_DATASET_ID
        ? CRISM_REFERENCE_SOURCE
        : `${entry.instrument} · ${entry.mission}`,
    description: entry.description,
    resolutionMeters: entry.resolutionMeters,
    available: entry.available,
    instrument: entry.instrument,
    mission: entry.mission,
    category: entry.category,
    measurementProvided: entry.measurementProvided,
    spatialResolutionLabel: entry.spatialResolutionLabel,
    geographicCoverage: entry.geographicCoverage,
    coverageScope: entry.coverageScope,
    supportedRegionIds: entry.supportedRegionIds ? [...entry.supportedRegionIds] : undefined,
    operationalStatus: [...entry.operationalStatus],
    regionalCaveats: entry.regionalCaveats ? { ...entry.regionalCaveats } : undefined,
    temporalCoverage: entry.temporalCoverage,
    scientificPurpose: entry.scientificPurpose,
    suitability: entry.suitability,
    integrationStatus: entry.integrationStatus,
    integrationStatusLabel: entry.integrationStatusLabel,
    provenance: {
      source: entry.sourceReference,
      sourceId: entry.pdsProductId,
      processingMethod: `${entry.measurementProvided} (${entry.spatialResolutionLabel})`,
      limitations: [...entry.limitations],
    },
  };
}

/**
 * Genuine pre-bundled local dataset files resident on disk in the application repository.
 * Datasets claiming DOWNLOADED status MUST be in this list.
 */
export const GENUINE_LOCAL_DATASET_IDS: readonly string[] = [
  "ctx_jezero_dtm_20m", // /jezero/manifest.json, /jezero/overview.u16, /jezero/height/*.u16
  "ctx_jezero_ortho_5m", // /jezero/overview.jpg, /jezero/tex/*.jpg
  "m2020_meda_env", // /public/data/meda_processed_bundle.json
  "msl_rems_env", // /public/data/rems_processed_bundle.json
] as const;

export interface DatasetLifecycleValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates operational status and geographic consistency invariants for an EvidenceDatasetEntry.
 */
export function validateDatasetLifecycle(
  entry: EvidenceDatasetEntry
): DatasetLifecycleValidationResult {
  const errors: string[] = [];

  // 1. If operationalStatus includes DOWNLOADED, verify that genuine local files exist
  if (entry.operationalStatus.includes("DOWNLOADED")) {
    if (!GENUINE_LOCAL_DATASET_IDS.includes(entry.id)) {
      errors.push(
        `Dataset '${entry.id}' specifies DOWNLOADED status, but does not correspond to verified pre-bundled local files.`
      );
    }
  }

  // 2. A dataset cannot have both PLANNED and INTEGRATED
  if (
    entry.operationalStatus.includes("PLANNED") &&
    entry.operationalStatus.includes("INTEGRATED")
  ) {
    errors.push(
      `Dataset '${entry.id}' cannot have both PLANNED and INTEGRATED operational statuses.`
    );
  }

  // 3. A dataset cannot have both UNAVAILABLE and INTEGRATED
  if (
    entry.operationalStatus.includes("UNAVAILABLE") &&
    entry.operationalStatus.includes("INTEGRATED")
  ) {
    errors.push(
      `Dataset '${entry.id}' cannot have both UNAVAILABLE and INTEGRATED operational statuses.`
    );
  }

  // 4. A dataset cannot have both DOWNLOADED and UNAVAILABLE
  if (
    entry.operationalStatus.includes("DOWNLOADED") &&
    entry.operationalStatus.includes("UNAVAILABLE")
  ) {
    errors.push(
      `Dataset '${entry.id}' cannot have both DOWNLOADED and UNAVAILABLE operational statuses.`
    );
  }

  // 5. If available === false, operationalStatus must include UNAVAILABLE or PLANNED, and cannot include INTEGRATED
  if (!entry.available) {
    if (entry.operationalStatus.includes("INTEGRATED")) {
      errors.push(
        `Dataset '${entry.id}' has available=false but includes INTEGRATED operational status.`
      );
    }
    if (
      !entry.operationalStatus.includes("UNAVAILABLE") &&
      !entry.operationalStatus.includes("PLANNED")
    ) {
      errors.push(
        `Dataset '${entry.id}' has available=false but does not include UNAVAILABLE or PLANNED in operationalStatus.`
      );
    }
  }

  // 6. If operationalStatus includes INTEGRATED, available must be true
  if (entry.operationalStatus.includes("INTEGRATED") && !entry.available) {
    errors.push(
      `Dataset '${entry.id}' has INTEGRATED operational status but available is false.`
    );
  }

  // 7. Every dataset must have at least REGISTERED in its operationalStatus
  if (!entry.operationalStatus.includes("REGISTERED")) {
    errors.push(
      `Dataset '${entry.id}' must include REGISTERED in its operationalStatus.`
    );
  }

  // 8. If coverageScope is GLOBAL, supportedRegionIds should be undefined or empty
  if (
    entry.coverageScope === "GLOBAL" &&
    entry.supportedRegionIds &&
    entry.supportedRegionIds.length > 0
  ) {
    errors.push(
      `GLOBAL dataset '${entry.id}' must not define supportedRegionIds.`
    );
  }

  // 9. If coverageScope is REGIONAL or LOCAL_INSITU, supportedRegionIds must be non-empty
  if (
    (entry.coverageScope === "REGIONAL" || entry.coverageScope === "LOCAL_INSITU") &&
    (!entry.supportedRegionIds || entry.supportedRegionIds.length === 0)
  ) {
    errors.push(
      `${entry.coverageScope} dataset '${entry.id}' must specify at least one supportedRegionId.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates all datasets in EVIDENCE_DATASETS against lifecycle invariants.
 */
export function validateAllDatasetsLifecycle(): {
  valid: boolean;
  results: Record<string, DatasetLifecycleValidationResult>;
  totalErrors: number;
} {
  const results: Record<string, DatasetLifecycleValidationResult> = {};
  let totalErrors = 0;

  for (const entry of EVIDENCE_DATASETS) {
    const res = validateDatasetLifecycle(entry);
    results[entry.id] = res;
    totalErrors += res.errors.length;
  }

  return {
    valid: totalErrors === 0,
    results,
    totalErrors,
  };
}

/**
 * Resolves metadata for any dataset ID stored in an existing `Mission` or `Observation`,
 * including backward-compatible fallback for legacy visualization-only `MapLayerId`s
 * saved before the T-2.1 catalog separation. Optionally takes a regionId to resolve
 * active regional caveats.
 */
export function resolveDatasetMetadata(
  datasetId: string,
  regionId?: string
): {
  id: string;
  name: string;
  instrumentAndMission: string;
  categoryLabel: string;
  measurementProvided: string;
  spatialResolutionLabel: string;
  geographicCoverage: string;
  coverageScope?: GeographicCoverageScope;
  supportedRegionIds?: readonly string[];
  operationalStatus?: readonly DatasetOperationalStatus[];
  regionalCaveats?: Record<string, string>;
  activeRegionalCaveat?: string;
  scientificPurpose: string;
  suitability: string;
  integrationStatus: DatasetIntegrationStatus | "legacy_visualization_layer" | "custom_record";
  integrationStatusLabel: string;
  limitations: string[];
  pdsProductId: string;
  sourceReference: string;
  isVisualizationOnlyLegacy: boolean;
} {
  const evidence = EVIDENCE_DATASETS_BY_ID[datasetId];
  if (evidence) {
    const activeRegionalCaveat =
      regionId && evidence.regionalCaveats?.[regionId]
        ? evidence.regionalCaveats[regionId]
        : undefined;

    return {
      id: evidence.id,
      name: evidence.name,
      instrumentAndMission: `${evidence.instrument} (${evidence.mission})`,
      categoryLabel: EVIDENCE_CATEGORY_LABELS[evidence.category],
      measurementProvided: evidence.measurementProvided,
      spatialResolutionLabel: evidence.spatialResolutionLabel,
      geographicCoverage: evidence.geographicCoverage,
      coverageScope: evidence.coverageScope,
      supportedRegionIds: evidence.supportedRegionIds,
      operationalStatus: evidence.operationalStatus,
      regionalCaveats: evidence.regionalCaveats,
      activeRegionalCaveat,
      scientificPurpose: evidence.scientificPurpose,
      suitability: evidence.suitability,
      integrationStatus: evidence.integrationStatus,
      integrationStatusLabel: evidence.integrationStatusLabel,
      limitations: [...evidence.limitations],
      pdsProductId: evidence.pdsProductId,
      sourceReference: evidence.sourceReference,
      isVisualizationOnlyLegacy: false,
    };
  }

  if (
    datasetId === SURFACE_IMAGERY_DATASET_ID ||
    datasetId.startsWith("m2020_surface_")
  ) {
    return {
      id: datasetId,
      name: "Perseverance Surface Imagery Catalog (Mastcam-Z / Navcam / SuperCam RMI)",
      instrumentAndMission:
        "Mastcam-Z, Navcam & SuperCam RMI (Mars 2020 Perseverance Rover)",
      categoryLabel: "In-Situ Rover Surface Imagery (Catalog #3)",
      measurementProvided:
        "Direct surface optical photographs (outcrop morphology, sedimentary bedding, grain texture, and traverse context) with rover camera, Sol, UTC/LMST timestamp, and Site/Drive metadata.",
      spatialResolutionLabel:
        "Sub-millimeter to millimeter outcrop scale (in-situ surface camera)",
      geographicCoverage:
        "Local · Perseverance Traverse in Jezero Crater (Site/Drive & Local XYZ recorded; planetocentric lat/lon not embedded in raw EDR frames)",
      coverageScope: "LOCAL_INSITU",
      supportedRegionIds: ["jezero-crater"],
      operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
      scientificPurpose:
        "Document in-situ rock textures, outcrop bedding, and surface morphology along Perseverance's traverse to complement orbital imagery.",
      suitability: "Contextual & Hazard Analysis",
      integrationStatus: "integrated_active",
      integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active,
      limitations: [
        "Direct rover surface photograph (distinct from orbital imagery): visual texture and bedding morphology alone do not prove phyllosilicate or carbonate mineralogy without paired spectroscopic (SuperCam/SHERLOC/PIXL/CRISM) analysis.",
        "NASA raw image EDR metadata records rover Site, Drive, and local XYZ coordinates rather than planetocentric (lat, lon); do not assume an image belongs to the western delta unless verified by Sol/Site context.",
      ],
      pdsProductId: "urn:nasa:pds:mars2020_img",
      sourceReference:
        "NASA/JPL-Caltech Mars 2020 Perseverance Raw Images Service (mars.nasa.gov)",
      isVisualizationOnlyLegacy: false,
    };
  }

  const legacyMapLayer = MAP_LAYERS[datasetId as MapLayerId];
  if (legacyMapLayer) {
    return {
      id: legacyMapLayer.id,
      name: `${legacyMapLayer.name} (Map Visualization Layer)`,
      instrumentAndMission: "NASA Mars Trek Global Visualization Mosaic",
      categoryLabel: "Visualization Basemap (Map Layer Catalog)",
      measurementProvided:
        "Rendered visual hillshade or color-blended display mosaic for geographic context. Not a direct mineralogical or physical measurement.",
      spatialResolutionLabel: "Global WMTS display mosaic (~200–463 m/pixel)",
      geographicCoverage: "Global (90°S–90°N, 180°W–180°E)",
      coverageScope: "GLOBAL",
      operationalStatus: ["REGISTERED", "ACCESSIBLE", "INTEGRATED"],
      scientificPurpose:
        "Geographic orientation and visual basemap context on the 3D Globe and 2D Map.",
      suitability: "Visualization Only (Not Empirical Evidence)",
      integrationStatus: "legacy_visualization_layer",
      integrationStatusLabel: "Legacy Visualization Basemap (Map Layer Catalog)",
      limitations: [
        "Legacy observation linked to a map visualization layer (shaded-relief visualization mosaic); select an empirical dataset from the Scientific Evidence Catalog for quantitative measurements.",
      ],
      pdsProductId: legacyMapLayer.id,
      sourceReference: "NASA / JPL-Caltech / USGS Mars Trek WMTS",
      isVisualizationOnlyLegacy: true,
    };
  }

  return {
    id: datasetId,
    name: datasetId,
    instrumentAndMission: "User / Custom Mission Record",
    categoryLabel: "Recorded Observation Source",
    measurementProvided: "Recorded during mission investigation or EVA fieldwork.",
    spatialResolutionLabel: "Site-specific",
    geographicCoverage: "Selected study region",
    scientificPurpose: "Support mission investigation and field synthesis.",
    suitability: "Contextual & Hazard Analysis",
    integrationStatus: "custom_record",
    integrationStatusLabel: "User-Recorded Mission Source",
    limitations: ["Requires verification against primary NASA PDS instrument data."],
    pdsProductId: datasetId,
    sourceReference: "Mars Explorer Mission Workspace",
    isVisualizationOnlyLegacy: false,
  };
}

/**
 * Maps any dataset ID (from `EVIDENCE_DATASETS` or legacy `MAP_LAYERS`) to the
 * 6 discipline buckets used in `KnowledgeGapsPage.tsx`.
 */
export function getDatasetDisciplineCategory(
  datasetId: string
): MapLayerCategory | null {
  const evidence = EVIDENCE_DATASETS_BY_ID[datasetId];
  if (evidence) {
    return evidence.mapCategory;
  }
  if (
    datasetId === SURFACE_IMAGERY_DATASET_ID ||
    datasetId.startsWith("m2020_surface_")
  ) {
    return "geology";
  }
  const layer = MAP_LAYERS[datasetId as MapLayerId];
  if (layer) {
    return layer.category;
  }
  return null;
}

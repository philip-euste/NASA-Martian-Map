// frontend/src/data/regions.ts
//
// Centralized Mars Region Registry (Phase 1 Architecture Foundation)
//
// Single source of truth for all exploration regions on Mars.
// Explicitly tracks multi-tier elevation products, vector geology, rover presence,
// and simulator availability (AVAILABLE vs PLANNED vs UNAVAILABLE).
// Zero fabricated coordinates, DEM assets, or rover telemetry.

import type { Coordinates } from "../types";
import type {
  MarsRegion,
  RegionBounds,
  SimulatorAvailability,
} from "../types/region";

export const MARS_REGIONS: Record<string, MarsRegion> = {
  "jezero-crater": {
    id: "jezero-crater",
    name: "Jezero Crater",
    coordinates: { latitude: 18.4447, longitude: 77.4508 },
    description:
      "Ancient 45-km impact crater hosting an exposed river delta and lake basin with phyllosilicate clay and carbonate strata.",
    regionLabel: "Isidis Planitia / Nili Fossae",
    category: "impact_crater",
    terrainType: "Lacustrine delta & crater floor",
    scientificSignificance:
      "NASA Mars 2020 Perseverance landing site; prime candidate for ancient habitable lacustrine environments and biosignature preservation.",
    geographicBounds: {
      westLonDeg: 77.10,
      eastLonDeg: 77.80,
      southLatDeg: 18.15,
      northLatDeg: 18.75,
    },
    simulatorAvailability: "AVAILABLE",
    simulatorEnvironmentId: "jezero-crater",

    elevationDatasets: [
      {
        id: "ctx_jezero_dtm_20m",
        name: "Jezero CTX Digital Elevation Model (20 m)",
        instrument: "CTX (Context Camera)",
        mission: "Mars Reconnaissance Orbiter (MRO)",
        coverageScope: "regional",
        horizontalResolutionMeters: 20,
        verticalPrecisionMeters: 2.0,
        coordinateReferenceSystem: "Equirectangular Mars 2000 areocentric",
        verticalDatum: "MOLA areoid (R = 3396.0 km)",
        source: "NASA / USGS Astrogeology",
        accessMode: "tiled_3d_mesh",
        isPrimaryForSimulator: true,
      },
      {
        id: "hirise_jezero_dtm",
        name: "HiRISE Controlled DTM Mosaic (1 m)",
        instrument: "HiRISE",
        mission: "Mars Reconnaissance Orbiter (MRO)",
        coverageScope: "local_inset",
        horizontalResolutionMeters: 1.0,
        verticalPrecisionMeters: 0.25,
        coordinateReferenceSystem: "Equirectangular / Transverse Mercator",
        verticalDatum: "MOLA areoid",
        source: "USGS Astrogeology / AWS ARD S3",
        accessMode: "stac_cog",
      },
      {
        id: "mola_global_128",
        name: "MGS MOLA Global Topography (128 ppd)",
        instrument: "MOLA (Mars Orbiter Laser Altimeter)",
        mission: "Mars Global Surveyor (MGS)",
        coverageScope: "global",
        horizontalResolutionMeters: 463,
        verticalPrecisionMeters: 1.0,
        coordinateReferenceSystem: "IAU 2000 Mars planetocentric",
        verticalDatum: "MOLA areoid",
        source: "PDS Geosciences Node (Washington University in St. Louis)",
        accessMode: "pds_raster",
      },
    ],

    geologicalDatasets: [
      {
        id: "usgs_sim_3464",
        name: "USGS SIM 3464 Jezero Chronostratigraphic Units",
        citation:
          "Sun, V.Z. & Stack, K.M. (2020). Geologic map of Jezero crater and the Nili Planum region, Mars. USGS Scientific Investigations Map 3464.",
        scale: "1:75,000",
        publisher: "USGS Astrogeology Science Center",
        format: "geojson",
        dataPath: "/data/jezero_geology_sim3464.geojson",
        coverageScope: "regional",
        status: "integrated_active",
        unitsCount: 6,
      },
    ],

    mapLayers: [
      {
        layerId: "jezero_hirise",
        name: "Jezero Crater HiRISE Orthomosaic (25 cm)",
        role: "primary_basemap",
      },
      {
        layerId: "mars_global_mola",
        name: "MOLA Global Hillshade",
        role: "terrain_overlay",
      },
      {
        layerId: "mars_themis_night",
        name: "THEMIS Nighttime Infrared",
        role: "thermal_overlay",
      },
    ],

    evidenceDatasets: [
      {
        datasetId: "hirise_jezero_dtm",
        suitability: "Direct Quantitative Analysis",
        role: "direct_quantitative",
      },
      {
        datasetId: "ctx_jezero_dtm_20m",
        suitability: "Direct Quantitative Analysis",
        role: "direct_quantitative",
      },
      {
        datasetId: "jezero_hirise",
        suitability: "Contextual & Hazard Analysis",
        role: "context_hazard",
      },
      {
        datasetId: "crism_jezero_vnir",
        suitability: "Reference Only (Unverified Provenance)",
        role: "regional_context",
      },
      {
        datasetId: "m2020_meda_env",
        suitability: "Direct Quantitative Analysis",
        role: "direct_quantitative",
      },
    ],

    rover: {
      missionName: "Mars 2020",
      roverName: "Perseverance",
      landingDate: "2021-02-18",
      landingCoordinates: { latitude: 18.4447, longitude: 77.4508 },
      landingSiteName: "Octavia E. Butler Landing",
      operationalStatus: "active",
      hasSurfaceImagery: true,
      surfaceImageryCatalogId: "perseverance_surface_imagery",
      atmosphericSensorSuite: "MEDA (Mars Environmental Dynamics Analyzer)",
    },

    dataLimitations: [
      "20m CTX DEM smooths boulder fields and localized rover-scale scarp verticality.",
      "USGS geological units represent transitional stratigraphic boundaries rather than discrete step functions.",
    ],

    scientificReferences: [
      "Sun, V.Z. & Stack, K.M. (2020). Geologic map of Jezero crater and the Nili Planum region, Mars. USGS SIM 3464.",
      "Mangold, N. et al. (2021). Perseverance rover reveals an ancient delta-lake system and flood deposits at Jezero crater, Mars. Science, 374(6568), 711-717.",
      "Rodriguez-Manfredi, J.A. et al. (2021). The Mars Environmental Dynamics Analyzer (MEDA) Instrument Set on the Mars 2020 Rover. Space Science Reviews, 217(3).",
    ],
  },

  "gale-crater": {
    id: "gale-crater",
    name: "Gale Crater (Mount Sharp)",
    coordinates: { latitude: -5.37, longitude: 137.81 },
    description:
      "154-km impact crater containing Aeolis Mons (Mount Sharp), a 5-km sedimentary central mound preserving a prolonged record of aqueous and environmental change.",
    regionLabel: "Aeolis / Elysium Planitia Transition",
    category: "impact_crater",
    terrainType: "Central sedimentary mound & fluvio-lacustrine plains",
    scientificSignificance:
      "NASA MSL Curiosity landing site; confirmed ancient long-lived lake environments, groundwater diagenesis, and transitions to hyper-arid sulfate deposition.",
    geographicBounds: {
      westLonDeg: 137.10,
      eastLonDeg: 138.50,
      southLatDeg: -5.85,
      northLatDeg: -4.85,
    },
    simulatorAvailability: "AVAILABLE",
    simulatorEnvironmentId: "gale-crater",

    elevationDatasets: [
      {
        id: "mola_global_128",
        name: "MGS MOLA Global Topography (128 ppd)",
        instrument: "MOLA",
        mission: "Mars Global Surveyor (MGS)",
        coverageScope: "global",
        horizontalResolutionMeters: 463,
        coordinateReferenceSystem: "IAU 2000 Mars planetocentric",
        verticalDatum: "MOLA areoid",
        source: "PDS Geosciences Node",
        accessMode: "tiled_3d_mesh",
        isPrimaryForSimulator: true,
      },
      {
        id: "hrsc_gale_dtm",
        name: "Mars Express HRSC Gale Regional DTM (50 m)",
        instrument: "HRSC (High Resolution Stereo Camera)",
        mission: "Mars Express (ESA)",
        coverageScope: "regional",
        horizontalResolutionMeters: 50,
        coordinateReferenceSystem: "Sinusoidal / Equirectangular",
        verticalDatum: "MOLA areoid",
        source: "ESA Planetary Science Archive / PDS",
        accessMode: "pds_raster",
      },
      {
        id: "hirise_gale_traverse_dtm",
        name: "HiRISE MSL Traverse DTM Tiles (1 m)",
        instrument: "HiRISE",
        mission: "Mars Reconnaissance Orbiter (MRO)",
        coverageScope: "local_inset",
        horizontalResolutionMeters: 1.0,
        coordinateReferenceSystem: "Transverse Mercator",
        verticalDatum: "MOLA areoid",
        source: "USGS Astrogeology / PDS",
        accessMode: "stac_cog",
      },
    ],

    geologicalDatasets: [],

    mapLayers: [
      {
        layerId: "mars_global_mola",
        name: "MOLA Global Hillshade",
        role: "primary_basemap",
      },
      {
        layerId: "mars_themis_day",
        name: "THEMIS Daytime Infrared",
        role: "thermal_overlay",
      },
      {
        layerId: "mars_themis_night",
        name: "THEMIS Nighttime Infrared",
        role: "thermal_overlay",
      },
    ],

    evidenceDatasets: [
      {
        datasetId: "mars_mola_roughness",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context",
      },
      {
        datasetId: "mars_themis_day",
        suitability: "Contextual & Hazard Analysis",
        role: "context_hazard",
      },
      {
        datasetId: "mars_themis_night",
        suitability: "Contextual & Hazard Analysis",
        role: "context_hazard",
      },
      {
        datasetId: "mars_tes_thermal",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context",
      },
    ],

    rover: {
      missionName: "Mars Science Laboratory",
      roverName: "Curiosity",
      landingDate: "2012-08-06",
      landingCoordinates: { latitude: -4.5895, longitude: 137.4417 },
      landingSiteName: "Bradbury Landing",
      operationalStatus: "active",
      hasSurfaceImagery: true,
      surfaceImageryCatalogId: "curiosity_surface_imagery",
      atmosphericSensorSuite: "REMS (Rover Environmental Monitoring Station)",
    },

    dataLimitations: [
      "3D surface mesh generation in progress. High-resolution elevations currently sampled via MOLA / remote STAC HiRISE.",
      "Curiosity surface photography and REMS telemetry integration scheduled for Phase 3.",
    ],

    scientificReferences: [
      "Anderson, R.B. & Bell, J.F., III (2010). Geologic mapping and characterization of Gale Crater and implications for its potential as a Mars Science Laboratory landing site. Mars 5, 76-128. doi:10.1555/mars.2010.0004.",
      "Scott, D.H. & West, M.N. (1978). Geologic Map of the Aeolis Quadrangle of Mars. USGS Miscellaneous Investigations Series Map I-1111, scale 1:5,000,000. doi:10.3133/i1111.",
      "Grotzinger, J.P. et al. (2014). A habitable fluvio-lacustrine environment at Yellowknife Bay, Gale crater, Mars. Science, 343(6169), 1242777.",
      "Vasavada, A.R. et al. (2014). Overview of the Mars Science Laboratory mission: Bradbury Landing to Yellowknife Bay and beyond. JGR Planets, 119(6), 1134-1161.",
    ],
  },

  "valles-marineris": {
    id: "valles-marineris",
    name: "Valles Marineris (Melas Chasma)",
    coordinates: { latitude: -9.80, longitude: -76.40 },
    description:
      "Vast equatorial tectonic rift system spanning over 4,000 km, with depths reaching 9 km, exposing billions of years of crustal layering along monumental canyon scarps.",
    regionLabel: "Coprates Quadrangle / Equatorial Mars",
    category: "canyon_system",
    terrainType: "Chasma floor, massive landslides & sheer wall scarps",
    scientificSignificance:
      "Deepest exposed crustal cross-section on Mars; hosts interior layered deposits (ILDs), hydrated sulfate mounds, and evidence of groundwater sapping.",
    geographicBounds: {
      westLonDeg: -78.50,
      eastLonDeg: -74.20,
      southLatDeg: -11.50,
      northLatDeg: -8.00,
    },
    simulatorAvailability: "AVAILABLE",
    simulatorEnvironmentId: "valles-marineris",

    elevationDatasets: [
      {
        id: "mola_global_128",
        name: "MGS MOLA Global Topography (128 ppd)",
        instrument: "MOLA",
        mission: "Mars Global Surveyor (MGS)",
        coverageScope: "global",
        horizontalResolutionMeters: 463,
        coordinateReferenceSystem: "IAU 2000 Mars planetocentric",
        verticalDatum: "MOLA areoid",
        source: "PDS Geosciences Node",
        accessMode: "tiled_3d_mesh",
        isPrimaryForSimulator: true,
      },
      {
        id: "hrsc_melas_dtm",
        name: "Mars Express HRSC Melas Chasma DTM (50 m)",
        instrument: "HRSC",
        mission: "Mars Express (ESA)",
        coverageScope: "regional",
        horizontalResolutionMeters: 50,
        coordinateReferenceSystem: "Sinusoidal / Equirectangular",
        verticalDatum: "MOLA areoid",
        source: "ESA PSA / Freie Universität Berlin",
        accessMode: "pds_raster",
      },
    ],

    geologicalDatasets: [],

    mapLayers: [
      {
        layerId: "mars_global_mola",
        name: "MOLA Global Hillshade",
        role: "primary_basemap",
      },
      {
        layerId: "mars_mola_hrsc_color",
        name: "MOLA + HRSC Color Blend",
        role: "terrain_overlay",
      },
      {
        layerId: "mars_themis_night",
        name: "THEMIS Nighttime Infrared",
        role: "thermal_overlay",
      },
    ],

    evidenceDatasets: [
      {
        datasetId: "mars_mola_roughness",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context",
      },
      {
        datasetId: "mars_themis_night",
        suitability: "Contextual & Hazard Analysis",
        role: "context_hazard",
      },
      {
        datasetId: "mars_tes_thermal",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context",
      },
    ],

    dataLimitations: [
      "Immense vertical relief (up to 9 km canyon walls). No in-situ surface rover imagery exists.",
      "3D simulation domain will focus on a designated 60 km × 60 km sub-box across Melas Chasma floor deposits.",
    ],

    scientificReferences: [
      "Witbeck, N.E., Tanaka, K.L., & Scott, D.H. (1991). Geologic Map of the Valles Marineris Region, Mars. USGS Miscellaneous Investigations Series Map I-2010, scale 1:2,000,000. doi:10.3133/i2010.",
      "Quantin, C. et al. (2004). Fluvial and lacustrine activity on Valles Marineris: Evidence from landslides. Icarus, 172(2), 555-572.",
    ],
  },

  "olympus-mons": {
    id: "olympus-mons",
    name: "Olympus Mons (Summit Caldera)",
    coordinates: { latitude: 18.65, longitude: -133.80 },
    description:
      "Largest shield volcano in the Solar System, rising 21.2 km above datum with an 80-km multi-ring complex caldera and basal scarp reaching up to 8 km high.",
    regionLabel: "Tharsis Volcanic Province",
    category: "shield_volcano",
    terrainType: "Volcanic caldera floor, collapse pits & basaltic flanks",
    scientificSignificance:
      "Records prolonged effusive basaltic volcanism, crustal thermal evolution, and planetary outgassing over billions of years.",
    geographicBounds: {
      westLonDeg: -135.50,
      eastLonDeg: -132.00,
      southLatDeg: 17.00,
      northLatDeg: 20.20,
    },
    simulatorAvailability: "AVAILABLE",
    simulatorEnvironmentId: "olympus-mons",

    elevationDatasets: [
      {
        id: "mola_global_128",
        name: "MGS MOLA Global Topography (128 ppd)",
        instrument: "MOLA",
        mission: "Mars Global Surveyor (MGS)",
        coverageScope: "global",
        horizontalResolutionMeters: 463,
        coordinateReferenceSystem: "IAU 2000 Mars planetocentric",
        verticalDatum: "MOLA areoid",
        source: "PDS Geosciences Node",
        accessMode: "tiled_3d_mesh",
        isPrimaryForSimulator: true,
      },
      {
        id: "hrsc_olympus_caldera_dtm",
        name: "Mars Express HRSC Olympus Mons Caldera DTM (50 m)",
        instrument: "HRSC",
        mission: "Mars Express (ESA)",
        coverageScope: "regional",
        horizontalResolutionMeters: 50,
        coordinateReferenceSystem: "Sinusoidal / Equirectangular",
        verticalDatum: "MOLA areoid",
        source: "ESA PSA / DLR",
        accessMode: "pds_raster",
      },
    ],

    geologicalDatasets: [],

    mapLayers: [
      {
        layerId: "mars_global_mola",
        name: "MOLA Global Hillshade",
        role: "primary_basemap",
      },
      {
        layerId: "mars_viking_global",
        name: "Viking Global Color Mosaic",
        role: "context_imagery",
      },
    ],

    evidenceDatasets: [
      {
        datasetId: "mars_mola_roughness",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context",
      },
      {
        datasetId: "mars_themis_day",
        suitability: "Contextual & Hazard Analysis",
        role: "context_hazard",
      },
    ],

    dataLimitations: [
      "Extreme altitude results in ambient atmospheric pressure < 100 Pa (near-vacuum). Liquid water is thermodynamically impossible.",
      "No in-situ rover observations exist.",
    ],

    scientificReferences: [
      "Mouginis-Mark, P.J. (2021). Geologic Map of Olympus Mons Caldera, Mars. USGS Scientific Investigations Map 3470, scale 1:200,000. doi:10.3133/sim3470.",
      "Morris, E.C. & Tanaka, K.L. (1994). Geologic Maps of the Olympus Mons Region of Mars. USGS Miscellaneous Investigations Series Map I-2327, scale 1:2,016,000 / 1:1,000,000.",
      "Basilevsky, A.T. et al. (2006). The youngest caldera of Olympus Mons, Mars: Evidence for recent activity. Geophysical Research Letters, 33(13).",
    ],
  },

  "nili-fossae": {
    id: "nili-fossae",
    name: "Nili Fossae",
    coordinates: { latitude: 21.00, longitude: 74.00 },
    description:
      "Concentric graben system northwest of Isidis basin, exhibiting the most diverse mineralogical assemblage on Mars including Fe/Mg clays, carbonates, and olivine.",
    regionLabel: "Isidis Planitia Northwest Margin",
    category: "tectonic_fracture",
    terrainType: "Tectonic graben & ancient Noachian crust",
    scientificSignificance:
      "Premier window into ancient Martian crust and hydrothermal alteration; confirmed exposure of magnesite carbonates and serpentinization.",
    geographicBounds: {
      westLonDeg: 72.00,
      eastLonDeg: 76.50,
      southLatDeg: 19.00,
      northLatDeg: 23.00,
    },
    simulatorAvailability: "UNAVAILABLE",

    elevationDatasets: [
      {
        id: "mola_global_128",
        name: "MGS MOLA Global Topography (128 ppd)",
        instrument: "MOLA",
        mission: "Mars Global Surveyor (MGS)",
        coverageScope: "global",
        horizontalResolutionMeters: 463,
        coordinateReferenceSystem: "IAU 2000 Mars planetocentric",
        verticalDatum: "MOLA areoid",
        source: "PDS Geosciences Node",
        accessMode: "pds_raster",
      },
    ],

    geologicalDatasets: [],

    mapLayers: [
      {
        layerId: "mars_global_mola",
        name: "MOLA Global Hillshade",
        role: "primary_basemap",
      },
      {
        layerId: "mars_themis_day",
        name: "THEMIS Daytime Infrared",
        role: "thermal_overlay",
      },
    ],

    evidenceDatasets: [
      {
        datasetId: "omega_vnir_regional",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context",
      },
      {
        datasetId: "mars_mola_roughness",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context",
      },
    ],

    dataLimitations: [
      "No 3D surface simulation environment planned. Scientific exploration conducted via orbital map layers and evidence inspection.",
      "No in-situ surface rover mission has visited this site.",
    ],

    scientificReferences: [
      "Ehlmann, B.L. et al. (2008). Orbital identification of carbonate-bearing rocks on Mars. Science, 322(5909), 1828-1832.",
      "Mustard, J.F. et al. (2008). Hydrated silicate minerals on Mars observed by the Mars Reconnaissance Orbiter CRISM instrument. Nature, 454(7202), 305-309.",
    ],
  },

  "syrtis-major": {
    id: "syrtis-major",
    name: "Syrtis Major Planum",
    coordinates: { latitude: 8.40, longitude: 67.50 },
    description:
      "Low-relief basaltic volcanic shield characterized by dark mafic sand sheets, dacite/andesite caldera remnants, and pyroxene-rich lava flows.",
    regionLabel: "Syrtis Major Quadrangle",
    category: "volcanic_plateau",
    terrainType: "Volcanic shield plateau & dark aeolian sand sheets",
    scientificSignificance:
      "Classic low-albedo region; key reference for Mars volcanic stratigraphy and spectral calibration of pyroxene and olivine.",
    geographicBounds: {
      westLonDeg: 64.00,
      eastLonDeg: 71.00,
      southLatDeg: 5.00,
      northLatDeg: 12.00,
    },
    simulatorAvailability: "UNAVAILABLE",

    elevationDatasets: [
      {
        id: "mola_global_128",
        name: "MGS MOLA Global Topography (128 ppd)",
        instrument: "MOLA",
        mission: "Mars Global Surveyor (MGS)",
        coverageScope: "global",
        horizontalResolutionMeters: 463,
        coordinateReferenceSystem: "IAU 2000 Mars planetocentric",
        verticalDatum: "MOLA areoid",
        source: "PDS Geosciences Node",
        accessMode: "pds_raster",
      },
    ],

    geologicalDatasets: [],

    mapLayers: [
      {
        layerId: "mars_global_mola",
        name: "MOLA Global Hillshade",
        role: "primary_basemap",
      },
      {
        layerId: "mars_viking_global",
        name: "Viking Global Color Mosaic",
        role: "context_imagery",
      },
    ],

    evidenceDatasets: [
      {
        datasetId: "mars_tes_pyroxene",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context",
      },
      {
        datasetId: "mars_mola_roughness",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context",
      },
    ],

    dataLimitations: [
      "No 3D surface simulation environment planned.",
      "No in-situ rover observations exist.",
    ],

    scientificReferences: [
      "Hiesinger, H. & Head, J.W. (2004). The Syrtis Major volcanic province, Mars: Synthesis from Mars Global Surveyor data. JGR Planets, 109(E1).",
    ],
  },
};

export const MARS_REGION_LIST: readonly MarsRegion[] = Object.values(MARS_REGIONS);

/** Normalization map supporting legacy IDs and short names */
const REGION_ID_ALIASES: Record<string, string> = {
  jezero: "jezero-crater",
  "jezero-crater": "jezero-crater",
  gale: "gale-crater",
  "gale-crater": "gale-crater",
  valles: "valles-marineris",
  "valles-marineris": "valles-marineris",
  olympus: "olympus-mons",
  "olympus-mons": "olympus-mons",
  nili: "nili-fossae",
  "nili-fossae": "nili-fossae",
  syrtis: "syrtis-major",
  "syrtis-major": "syrtis-major",
};

export function getMarsRegionById(id?: string | null): MarsRegion | undefined {
  if (!id) return undefined;
  const normalized = id.toLowerCase().trim();
  const canonicalId = REGION_ID_ALIASES[normalized] ?? normalized;
  return MARS_REGIONS[canonicalId];
}

export function getMarsRegionByName(name?: string | null): MarsRegion | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase().trim();
  return MARS_REGION_LIST.find(
    (r) =>
      r.name.toLowerCase() === lower ||
      r.name.toLowerCase().includes(lower) ||
      lower.includes(r.name.toLowerCase())
  );
}

export function isWithinRegionBounds(
  coords: Coordinates,
  bounds: RegionBounds
): boolean {
  return (
    coords.longitude >= bounds.westLonDeg &&
    coords.longitude <= bounds.eastLonDeg &&
    coords.latitude >= bounds.southLatDeg &&
    coords.latitude <= bounds.northLatDeg
  );
}

export function getSimulatorAvailability(
  regionId?: string | null
): SimulatorAvailability {
  const region = getMarsRegionById(regionId);
  return region?.simulatorAvailability ?? "UNAVAILABLE";
}

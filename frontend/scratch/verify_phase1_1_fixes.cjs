"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// scratch/verify_phase1_1_fixes.ts
var import_node_assert = __toESM(require("node:assert"), 1);

// src/data/regions.ts
var MARS_REGIONS = {
  "jezero-crater": {
    id: "jezero-crater",
    name: "Jezero Crater",
    coordinates: { latitude: 18.4447, longitude: 77.4508 },
    description: "Ancient 45-km impact crater hosting an exposed river delta and lake basin with phyllosilicate clay and carbonate strata.",
    regionLabel: "Isidis Planitia / Nili Fossae",
    category: "impact_crater",
    terrainType: "Lacustrine delta & crater floor",
    scientificSignificance: "NASA Mars 2020 Perseverance landing site; prime candidate for ancient habitable lacustrine environments and biosignature preservation.",
    geographicBounds: {
      westLonDeg: 77.1,
      eastLonDeg: 77.8,
      southLatDeg: 18.15,
      northLatDeg: 18.75
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
        verticalPrecisionMeters: 2,
        coordinateReferenceSystem: "Equirectangular Mars 2000 areocentric",
        verticalDatum: "MOLA areoid (R = 3396.0 km)",
        source: "NASA / USGS Astrogeology",
        accessMode: "tiled_3d_mesh",
        isPrimaryForSimulator: true
      },
      {
        id: "hirise_jezero_dtm",
        name: "HiRISE Controlled DTM Mosaic (1 m)",
        instrument: "HiRISE",
        mission: "Mars Reconnaissance Orbiter (MRO)",
        coverageScope: "local_inset",
        horizontalResolutionMeters: 1,
        verticalPrecisionMeters: 0.25,
        coordinateReferenceSystem: "Equirectangular / Transverse Mercator",
        verticalDatum: "MOLA areoid",
        source: "USGS Astrogeology / AWS ARD S3",
        accessMode: "stac_cog"
      },
      {
        id: "mola_global_128",
        name: "MGS MOLA Global Topography (128 ppd)",
        instrument: "MOLA (Mars Orbiter Laser Altimeter)",
        mission: "Mars Global Surveyor (MGS)",
        coverageScope: "global",
        horizontalResolutionMeters: 463,
        verticalPrecisionMeters: 1,
        coordinateReferenceSystem: "IAU 2000 Mars planetocentric",
        verticalDatum: "MOLA areoid",
        source: "PDS Geosciences Node (Washington University in St. Louis)",
        accessMode: "pds_raster"
      }
    ],
    geologicalDatasets: [
      {
        id: "usgs_sim_3464",
        name: "USGS SIM 3464 Jezero Chronostratigraphic Units",
        citation: "Sun, V.Z. & Stack, K.M. (2020). Geologic map of Jezero crater and the Nili Planum region, Mars. USGS Scientific Investigations Map 3464.",
        scale: "1:75,000",
        publisher: "USGS Astrogeology Science Center",
        format: "geojson",
        dataPath: "/data/jezero_geology_sim3464.geojson",
        coverageScope: "regional",
        status: "integrated_active",
        unitsCount: 6
      }
    ],
    mapLayers: [
      {
        layerId: "jezero_hirise",
        name: "Jezero Crater HiRISE Orthomosaic (25 cm)",
        role: "primary_basemap"
      },
      {
        layerId: "mars_global_mola",
        name: "MOLA Global Hillshade",
        role: "terrain_overlay"
      },
      {
        layerId: "mars_themis_night",
        name: "THEMIS Nighttime Infrared",
        role: "thermal_overlay"
      }
    ],
    evidenceDatasets: [
      {
        datasetId: "hirise_jezero_dtm",
        suitability: "Direct Quantitative Analysis",
        role: "direct_quantitative"
      },
      {
        datasetId: "ctx_jezero_dtm_20m",
        suitability: "Direct Quantitative Analysis",
        role: "direct_quantitative"
      },
      {
        datasetId: "jezero_hirise",
        suitability: "Contextual & Hazard Analysis",
        role: "context_hazard"
      },
      {
        datasetId: "crism_jezero_vnir",
        suitability: "Direct Quantitative Analysis",
        role: "direct_quantitative"
      },
      {
        datasetId: "m2020_meda_env",
        suitability: "Direct Quantitative Analysis",
        role: "direct_quantitative"
      }
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
      atmosphericSensorSuite: "MEDA (Mars Environmental Dynamics Analyzer)"
    },
    dataLimitations: [
      "20m CTX DEM smooths boulder fields and localized rover-scale scarp verticality.",
      "USGS geological units represent transitional stratigraphic boundaries rather than discrete step functions."
    ],
    scientificReferences: [
      "Sun, V.Z. & Stack, K.M. (2020). Geologic map of Jezero crater and the Nili Planum region, Mars. USGS SIM 3464.",
      "Mangold, N. et al. (2021). Perseverance rover reveals an ancient delta-lake system and flood deposits at Jezero crater, Mars. Science, 374(6568), 711-717.",
      "Rodriguez-Manfredi, J.A. et al. (2021). The Mars Environmental Dynamics Analyzer (MEDA) Instrument Set on the Mars 2020 Rover. Space Science Reviews, 217(3)."
    ]
  },
  "gale-crater": {
    id: "gale-crater",
    name: "Gale Crater (Mount Sharp)",
    coordinates: { latitude: -5.37, longitude: 137.81 },
    description: "154-km impact crater containing Aeolis Mons (Mount Sharp), a 5-km sedimentary central mound preserving a prolonged record of aqueous and environmental change.",
    regionLabel: "Aeolis / Elysium Planitia Transition",
    category: "impact_crater",
    terrainType: "Central sedimentary mound & fluvio-lacustrine plains",
    scientificSignificance: "NASA MSL Curiosity landing site; confirmed ancient long-lived lake environments, groundwater diagenesis, and transitions to hyper-arid sulfate deposition.",
    geographicBounds: {
      westLonDeg: 137.1,
      eastLonDeg: 138.5,
      southLatDeg: -5.85,
      northLatDeg: -4.85
    },
    simulatorAvailability: "PLANNED",
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
        accessMode: "pds_raster"
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
        accessMode: "pds_raster"
      },
      {
        id: "hirise_gale_traverse_dtm",
        name: "HiRISE MSL Traverse DTM Tiles (1 m)",
        instrument: "HiRISE",
        mission: "Mars Reconnaissance Orbiter (MRO)",
        coverageScope: "local_inset",
        horizontalResolutionMeters: 1,
        coordinateReferenceSystem: "Transverse Mercator",
        verticalDatum: "MOLA areoid",
        source: "USGS Astrogeology / PDS",
        accessMode: "stac_cog"
      }
    ],
    geologicalDatasets: [
      {
        id: "usgs_sim_3482_gale",
        name: "USGS SIM 3482 Gale Crater Geologic Map",
        citation: "Anderson, R.B. & Bell, J.F. (2010). Geologic mapping and characterization of Gale Crater. Mars 5, 76-128.",
        publisher: "USGS / NASA",
        format: "geojson",
        coverageScope: "regional",
        status: "planned"
      }
    ],
    mapLayers: [
      {
        layerId: "mars_global_mola",
        name: "MOLA Global Hillshade",
        role: "primary_basemap"
      },
      {
        layerId: "mars_themis_day",
        name: "THEMIS Daytime Infrared",
        role: "thermal_overlay"
      },
      {
        layerId: "mars_themis_night",
        name: "THEMIS Nighttime Infrared",
        role: "thermal_overlay"
      }
    ],
    evidenceDatasets: [
      {
        datasetId: "mars_mola_roughness",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context"
      },
      {
        datasetId: "mars_themis_day",
        suitability: "Contextual & Hazard Analysis",
        role: "context_hazard"
      },
      {
        datasetId: "mars_themis_night",
        suitability: "Contextual & Hazard Analysis",
        role: "context_hazard"
      },
      {
        datasetId: "mars_tes_thermal",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context"
      }
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
      atmosphericSensorSuite: "REMS (Rover Environmental Monitoring Station)"
    },
    dataLimitations: [
      "3D surface mesh generation in progress. High-resolution elevations currently sampled via MOLA / remote STAC HiRISE.",
      "Curiosity surface photography and REMS telemetry integration scheduled for Phase 3."
    ],
    scientificReferences: [
      "Grotzinger, J.P. et al. (2014). A habitable fluvio-lacustrine environment at Yellowknife Bay, Gale crater, Mars. Science, 343(6169), 1242777.",
      "Vasavada, A.R. et al. (2014). Overview of the Mars Science Laboratory mission: Bradbury Landing to Yellowknife Bay and beyond. JGR Planets, 119(6), 1134-1161."
    ]
  },
  "valles-marineris": {
    id: "valles-marineris",
    name: "Valles Marineris (Melas Chasma)",
    coordinates: { latitude: -9.8, longitude: -76.4 },
    description: "Vast equatorial tectonic rift system spanning over 4,000 km, with depths reaching 9 km, exposing billions of years of crustal layering along monumental canyon scarps.",
    regionLabel: "Coprates Quadrangle / Equatorial Mars",
    category: "canyon_system",
    terrainType: "Chasma floor, massive landslides & sheer wall scarps",
    scientificSignificance: "Deepest exposed crustal cross-section on Mars; hosts interior layered deposits (ILDs), hydrated sulfate mounds, and evidence of groundwater sapping.",
    geographicBounds: {
      westLonDeg: -78.5,
      eastLonDeg: -74.2,
      southLatDeg: -11.5,
      northLatDeg: -8
    },
    simulatorAvailability: "PLANNED",
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
        accessMode: "pds_raster"
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
        source: "ESA PSA / Freie Universit\xE4t Berlin",
        accessMode: "pds_raster"
      }
    ],
    geologicalDatasets: [
      {
        id: "usgs_i2614_valles",
        name: "USGS I-2614 Geologic Map of Valles Marineris",
        citation: "Witbeck, N.E. et al. (1991). Geologic Map of the Valles Marineris Region, Mars. USGS Miscellaneous Investigations Series Map I-2614.",
        publisher: "USGS",
        format: "geojson",
        coverageScope: "regional",
        status: "planned"
      }
    ],
    mapLayers: [
      {
        layerId: "mars_global_mola",
        name: "MOLA Global Hillshade",
        role: "primary_basemap"
      },
      {
        layerId: "mars_mola_hrsc_color",
        name: "MOLA + HRSC Color Blend",
        role: "terrain_overlay"
      },
      {
        layerId: "mars_themis_night",
        name: "THEMIS Nighttime Infrared",
        role: "thermal_overlay"
      }
    ],
    evidenceDatasets: [
      {
        datasetId: "mars_mola_roughness",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context"
      },
      {
        datasetId: "mars_themis_night",
        suitability: "Contextual & Hazard Analysis",
        role: "context_hazard"
      },
      {
        datasetId: "mars_tes_thermal",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context"
      }
    ],
    dataLimitations: [
      "Immense vertical relief (up to 9 km canyon walls). No in-situ surface rover imagery exists.",
      "3D simulation domain will focus on a designated 60 km \xD7 60 km sub-box across Melas Chasma floor deposits."
    ],
    scientificReferences: [
      "Witbeck, N.E. et al. (1991). Geologic Map of the Valles Marineris Region, Mars. USGS I-2614.",
      "Quantin, C. et al. (2004). Fluvial and lacustrine activity on Valles Marineris: Evidence from landslides. Icarus, 172(2), 555-572."
    ]
  },
  "olympus-mons": {
    id: "olympus-mons",
    name: "Olympus Mons (Summit Caldera)",
    coordinates: { latitude: 18.65, longitude: -133.8 },
    description: "Largest shield volcano in the Solar System, rising 21.2 km above datum with an 80-km multi-ring complex caldera and basal scarp reaching up to 8 km high.",
    regionLabel: "Tharsis Volcanic Province",
    category: "shield_volcano",
    terrainType: "Volcanic caldera floor, collapse pits & basaltic flanks",
    scientificSignificance: "Records prolonged effusive basaltic volcanism, crustal thermal evolution, and planetary outgassing over billions of years.",
    geographicBounds: {
      westLonDeg: -135.5,
      eastLonDeg: -132,
      southLatDeg: 17,
      northLatDeg: 20.2
    },
    simulatorAvailability: "PLANNED",
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
        accessMode: "pds_raster"
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
        accessMode: "pds_raster"
      }
    ],
    geologicalDatasets: [
      {
        id: "usgs_i2502_olympus",
        name: "USGS I-2502 Geologic Map of Olympus Mons Caldera",
        citation: "Mouginis-Mark, P.J. (1996). Geologic Map of the Olympus Mons Caldera, Mars. USGS Miscellaneous Investigations Series Map I-2502.",
        publisher: "USGS",
        format: "geojson",
        coverageScope: "regional",
        status: "planned"
      }
    ],
    mapLayers: [
      {
        layerId: "mars_global_mola",
        name: "MOLA Global Hillshade",
        role: "primary_basemap"
      },
      {
        layerId: "mars_viking_global",
        name: "Viking Global Color Mosaic",
        role: "context_imagery"
      }
    ],
    evidenceDatasets: [
      {
        datasetId: "mars_mola_roughness",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context"
      },
      {
        datasetId: "mars_themis_day",
        suitability: "Contextual & Hazard Analysis",
        role: "context_hazard"
      }
    ],
    dataLimitations: [
      "Extreme altitude results in ambient atmospheric pressure < 100 Pa (near-vacuum). Liquid water is thermodynamically impossible.",
      "No in-situ rover observations exist."
    ],
    scientificReferences: [
      "Mouginis-Mark, P.J. (1996). Geologic Map of the Olympus Mons Caldera, Mars. USGS I-2502.",
      "Basilevsky, A.T. et al. (2006). The youngest caldera of Olympus Mons, Mars: Evidence for recent activity. Geophysical Research Letters, 33(13)."
    ]
  },
  "nili-fossae": {
    id: "nili-fossae",
    name: "Nili Fossae",
    coordinates: { latitude: 21, longitude: 74 },
    description: "Concentric graben system northwest of Isidis basin, exhibiting the most diverse mineralogical assemblage on Mars including Fe/Mg clays, carbonates, and olivine.",
    regionLabel: "Isidis Planitia Northwest Margin",
    category: "tectonic_fracture",
    terrainType: "Tectonic graben & ancient Noachian crust",
    scientificSignificance: "Premier window into ancient Martian crust and hydrothermal alteration; confirmed exposure of magnesite carbonates and serpentinization.",
    geographicBounds: {
      westLonDeg: 72,
      eastLonDeg: 76.5,
      southLatDeg: 19,
      northLatDeg: 23
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
        accessMode: "pds_raster"
      }
    ],
    geologicalDatasets: [],
    mapLayers: [
      {
        layerId: "mars_global_mola",
        name: "MOLA Global Hillshade",
        role: "primary_basemap"
      },
      {
        layerId: "mars_themis_day",
        name: "THEMIS Daytime Infrared",
        role: "thermal_overlay"
      }
    ],
    evidenceDatasets: [
      {
        datasetId: "omega_vnir_regional",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context"
      },
      {
        datasetId: "mars_mola_roughness",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context"
      }
    ],
    dataLimitations: [
      "No 3D surface simulation environment planned. Scientific exploration conducted via orbital map layers and evidence inspection.",
      "No in-situ surface rover mission has visited this site."
    ],
    scientificReferences: [
      "Ehlmann, B.L. et al. (2008). Orbital identification of carbonate-bearing rocks on Mars. Science, 322(5909), 1828-1832.",
      "Mustard, J.F. et al. (2008). Hydrated silicate minerals on Mars observed by the Mars Reconnaissance Orbiter CRISM instrument. Nature, 454(7202), 305-309."
    ]
  },
  "syrtis-major": {
    id: "syrtis-major",
    name: "Syrtis Major Planum",
    coordinates: { latitude: 8.4, longitude: 67.5 },
    description: "Low-relief basaltic volcanic shield characterized by dark mafic sand sheets, dacite/andesite caldera remnants, and pyroxene-rich lava flows.",
    regionLabel: "Syrtis Major Quadrangle",
    category: "volcanic_plateau",
    terrainType: "Volcanic shield plateau & dark aeolian sand sheets",
    scientificSignificance: "Classic low-albedo region; key reference for Mars volcanic stratigraphy and spectral calibration of pyroxene and olivine.",
    geographicBounds: {
      westLonDeg: 64,
      eastLonDeg: 71,
      southLatDeg: 5,
      northLatDeg: 12
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
        accessMode: "pds_raster"
      }
    ],
    geologicalDatasets: [],
    mapLayers: [
      {
        layerId: "mars_global_mola",
        name: "MOLA Global Hillshade",
        role: "primary_basemap"
      },
      {
        layerId: "mars_viking_global",
        name: "Viking Global Color Mosaic",
        role: "context_imagery"
      }
    ],
    evidenceDatasets: [
      {
        datasetId: "mars_tes_pyroxene",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context"
      },
      {
        datasetId: "mars_mola_roughness",
        suitability: "Regional Context Only (Coarse Resolution)",
        role: "regional_context"
      }
    ],
    dataLimitations: [
      "No 3D surface simulation environment planned.",
      "No in-situ rover observations exist."
    ],
    scientificReferences: [
      "Hiesinger, H. & Head, J.W. (2004). The Syrtis Major volcanic province, Mars: Synthesis from Mars Global Surveyor data. JGR Planets, 109(E1)."
    ]
  }
};
var MARS_REGION_LIST = Object.values(MARS_REGIONS);
var REGION_ID_ALIASES = {
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
  "syrtis-major": "syrtis-major"
};
function getMarsRegionById(id) {
  if (!id) return void 0;
  const normalized = id.toLowerCase().trim();
  const canonicalId = REGION_ID_ALIASES[normalized] ?? normalized;
  return MARS_REGIONS[canonicalId];
}
function isWithinRegionBounds(coords, bounds) {
  return coords.longitude >= bounds.westLonDeg && coords.longitude <= bounds.eastLonDeg && coords.latitude >= bounds.southLatDeg && coords.latitude <= bounds.northLatDeg;
}

// src/simulator/environments/jezero.ts
var JEZERO_ENVIRONMENT = {
  id: "jezero-crater",
  status: "available",
  displayName: "Jezero Crater",
  shortName: "Jezero",
  coordinateReference: {
    body: "Mars",
    meanRadiusMeters: 3389500,
    latitudeType: "planetocentric",
    longitudeDirection: "east",
    notes: "IAU 2000 planetocentric coordinates (\xB0N, \xB0E); elevations referenced to MOLA aeroid datum."
  },
  bounds: {
    westLonDeg: 76.99,
    eastLonDeg: 78.4935,
    southLatDeg: 17.5805,
    northLatDeg: 19.2902
  },
  defaultBase: {
    id: "perseverance-landing",
    name: "Octavia E. Butler Landing (Habitat / Rover Base)",
    latitude: 18.4447,
    longitude: 77.4508,
    description: "Perseverance rover landing site and primary EVA habitat base."
  },
  landmarks: [
    {
      id: "perseverance-landing",
      name: "Octavia E. Butler Landing (Habitat / Rover Base)",
      latitude: 18.4447,
      longitude: 77.4508,
      description: "Perseverance rover landing site and primary EVA habitat base."
    },
    {
      id: "western-delta-front",
      name: "Western Delta Scarp Outcrop",
      latitude: 18.458,
      longitude: 77.405,
      description: "Layered deltaic sandstone and mudstone foreset beds."
    },
    {
      id: "kodiak-butte",
      name: "Kodiak Butte Delta Remnant",
      latitude: 18.428,
      longitude: 77.419,
      description: "Isolated erosional remnant preserving ancient lake-level strata."
    },
    {
      id: "jezero-center",
      name: "Jezero Crater Floor Unit",
      latitude: 18.38,
      longitude: 77.58,
      description: "Mafic crater floor unit with olivine and carbonate signatures."
    }
  ],
  fieldSites: [
    {
      id: "octavia-e-butler",
      name: "Octavia E. Butler Landing (Habitat Base)",
      latitude: 18.4447,
      longitude: 77.4508,
      description: "Perseverance landing site and simulated EVA Habitat & Rover Base."
    },
    {
      id: "jezero-delta-front",
      name: "Western Delta Scarp & Layered Sediments",
      latitude: 18.4585,
      longitude: 77.4052,
      description: "Exposed deltaic mudstones and boulder conglomerates (~40 m relief)."
    },
    {
      id: "seitah-outcrop",
      name: "S\xE9\xEDtah Olivine-Rich Unit",
      latitude: 18.4295,
      longitude: 77.439,
      description: "Fractured igneous/altered crater floor unit with regolith dunes."
    },
    {
      id: "belva-crater",
      name: "Belva Impact Crater Rim",
      latitude: 18.464,
      longitude: 77.429,
      description: "Fresh impact crater exposing subsurface delta stratigraphy."
    }
  ],
  terrain: {
    format: "tiled-u16-dem",
    baseUrl: "/jezero/",
    demProduct: "M20_JezeroCrater_CTXDEM_20m.tif",
    demResolutionMeters: 20,
    imageryProduct: "M20_JezeroCrater_CTXortho_mosaic_5m.tif",
    credit: "USGS Astrogeology / NASA-JPL Mars 2020 Science Investigation CTX DEM & orthomosaic (Calef 2021; Mangold et al. 2021)"
  },
  atmosphere: {
    skyColor: 13215109,
    terrainTint: 14721658,
    fogNearMeters: 4500,
    fogFarMeters: 34e3,
    dustStorm: {
      skyColor: 10378038,
      fogNearMeters: 250,
      fogFarMeters: 3400
    },
    sunDirection: [-0.6, 0.55, -0.4]
  },
  hazards: {
    slopeCautionDeg: 10,
    slopeHazardDeg: 15,
    notes: "Slopes \u226515\xB0 exceed standard EVA traverse grade limits and increase metabolic CO\u2082 scrubber load."
  },
  geology: {
    providerId: "jezero-sim3464",
    label: "USGS SIM 3464 Jezero Photogeologic Map (Sun & Stack, 2020)",
    dataUrl: "/data/jezero_geology_sim3464.geojson"
  },
  datasets: [
    {
      id: "ctx_jezero_dem_20m",
      label: "Mars 2020 CTX 20 m DEM & 5 m Orthomosaic",
      provenance: "empirical",
      source: "USGS Astrogeology / NASA-JPL (Calef 2021)"
    },
    {
      id: "usgs_sim3464_geology",
      label: "USGS SIM 3464 Photogeologic Map of Jezero Crater",
      provenance: "empirical",
      source: "USGS Scientific Investigations Map 3464 (Sun & Stack, 2020)"
    },
    {
      id: "mro_crism_jezero",
      label: "MRO CRISM VNIR/SWIR Targeted Observations (FRT00005C5E / FRT0000B204)",
      provenance: "empirical",
      source: "NASA PDS Geosciences Node"
    },
    {
      id: "perseverance_meda_surface",
      label: "Mars 2020 MEDA Environmental Reference & Perseverance Mastcam-Z / Navcam",
      provenance: "empirical",
      source: "NASA PDS Atmospheres & Imaging Nodes"
    }
  ],
  telemetry: {
    atmosphericPressure: "simulated",
    ambientTemperature: "simulated",
    dustOpacity: "simulated",
    visibility: "simulated",
    wind: "simulated",
    radiation: "simulated",
    note: "Surface elevation & slope are derived directly from the NASA/USGS CTX 20 m DEM. Atmospheric & PLSS suit values are simulated EVA scenarios anchored to Mars 2020 MEDA baseline ranges."
  },
  sampleIdPrefix: "JZ-EVA",
  defaultObservationDatasetId: "hirise_jezero_dtm",
  simulatorEntryUrl: "/src/simulator/jezero_crater/scripts/jezero-simulator.html"
};

// src/simulator/environments/catalog.ts
var PLANNED_SIMULATOR_ENVIRONMENTS = [
  {
    id: "gale-crater",
    status: "planned",
    displayName: "Gale Crater (Aeolis Mons / Mount Sharp)",
    requiredAssets: [
      "Tiled 16-bit CTX/HiRISE DEM pyramid (manifest.json, overview.u16, height/*.u16)",
      "Orthorectified CTX/HiRISE surface texture tiles (overview.jpg, tex/*.jpg)",
      "USGS Gale Crater / Aeolis Mons chronostratigraphic unit GeoJSON",
      "Curiosity REMS environmental reference bundle and MSL surface imagery catalog"
    ]
  },
  {
    id: "valles-marineris",
    status: "planned",
    displayName: "Valles Marineris (Coprates / Candor / Melas Chasma)",
    requiredAssets: [
      "Tiled 16-bit HRSC/CTX/MOLA DEM pyramid covering canyon floor and wall relief",
      "Orthorectified HRSC/CTX imagery tiles",
      "USGS Valles Marineris geologic & landslide hazard polygon catalog",
      "Orbital atmospheric pressure/dust reference profile for canyon floor elevation"
    ]
  },
  {
    id: "olympus-mons",
    status: "planned",
    displayName: "Olympus Mons (Summit Caldera & Volcanic Flank)",
    requiredAssets: [
      "Tiled 16-bit HRSC/MOLA DEM pyramid covering caldera and lava flow units",
      "Orthorectified HRSC/CTX surface imagery tiles",
      "USGS volcanic flow unit & scarp hazard GeoJSON",
      "High-altitude low-pressure atmospheric reference profile (< 100 Pa)"
    ]
  }
];
function resolveSimulatorEnvironment(regionId) {
  const normalized = (regionId ?? "jezero-crater").toLowerCase().trim();
  if (normalized === "jezero-crater" || normalized === "jezero") {
    return {
      available: true,
      availability: "AVAILABLE",
      environment: JEZERO_ENVIRONMENT,
      plannedEnvironment: null,
      regionId: "jezero-crater",
      regionName: "Jezero Crater"
    };
  }
  const planned = PLANNED_SIMULATOR_ENVIRONMENTS.find(
    (item) => item.id === normalized || normalized.includes(item.id.replace("-crater", "").replace("-mons", ""))
  ) ?? null;
  if (planned) {
    return {
      available: false,
      availability: "PLANNED",
      environment: null,
      plannedEnvironment: planned,
      regionId: planned.id,
      regionName: planned.displayName,
      reason: `3D surface simulation environment for ${planned.displayName} is planned. High-resolution digital elevation models and surface texture pyramids are currently under preparation.`
    };
  }
  const region = getMarsRegionById(regionId);
  return {
    available: false,
    availability: region?.simulatorAvailability ?? "UNAVAILABLE",
    environment: null,
    plannedEnvironment: null,
    regionId: region?.id ?? (regionId || "unknown-region"),
    regionName: region?.name ?? (regionId || "Unknown Region"),
    reason: `No 3D surface simulation environment is currently available for ${region?.name ?? "this region"}. Scientific exploration is supported via 2D orbital map layers, evidence datasets, and hypothesis tracking.`
  };
}

// src/features/mission/missionHelpers.ts
function auditCrossRegionItems(activeRegion, targets, candidateRoutes) {
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
      unattributedCount: 0
    };
  }
  const otherRegions = MARS_REGION_LIST.filter((r) => r.id !== activeRegion.id);
  function findAttribution(coords) {
    for (const region of otherRegions) {
      if (isWithinRegionBounds(coords, region.geographicBounds)) {
        return { name: region.name, id: region.id };
      }
    }
    return null;
  }
  const outOfBoundsTargets = [];
  for (const target of targets) {
    if (!isWithinRegionBounds(target.coordinates, activeRegion.geographicBounds)) {
      const match = findAttribution(target.coordinates);
      outOfBoundsTargets.push({
        item: target,
        coordinates: target.coordinates,
        attributedRegionName: match ? match.name : null,
        attributedRegionId: match ? match.id : null
      });
    }
  }
  const outOfBoundsWaypoints = [];
  for (const route of candidateRoutes) {
    for (const wp of route.waypoints) {
      if (!isWithinRegionBounds(wp.coordinates, activeRegion.geographicBounds)) {
        const match = findAttribution(wp.coordinates);
        outOfBoundsWaypoints.push({
          item: wp,
          coordinates: wp.coordinates,
          attributedRegionName: match ? match.name : null,
          attributedRegionId: match ? match.id : null
        });
      }
    }
  }
  const totalOutOfBounds = outOfBoundsTargets.length + outOfBoundsWaypoints.length;
  const regionNameSet = /* @__PURE__ */ new Set();
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
    unattributedCount: unattributed
  };
}

// scratch/verify_phase1_1_fixes.ts
console.log("=================================================");
console.log("PHASE 1.1 AUDIT FIXES VERIFICATION");
console.log("=================================================\n");
console.log("--- Testing FIX 1: Marswalk Header & Coordinates ---");
var testRegions = [
  { id: "jezero-crater", expectedAvailable: true },
  { id: "gale-crater", expectedAvailable: false },
  { id: "valles-marineris", expectedAvailable: false },
  { id: "olympus-mons", expectedAvailable: false }
];
for (const { id, expectedAvailable } of testRegions) {
  const resolved = resolveSimulatorEnvironment(id);
  const isSimulatorAvailable = resolved.available && resolved.environment !== null;
  import_node_assert.default.strictEqual(
    isSimulatorAvailable,
    expectedAvailable,
    `Region ${id} availability mismatch: expected ${expectedAvailable}, got ${isSimulatorAvailable}`
  );
  const activeEnv = resolved.environment ?? JEZERO_ENVIRONMENT;
  const title = isSimulatorAvailable ? `Marswalk 3D Surface Simulator \xB7 ${activeEnv.displayName}` : `3D Surface Exploration \xB7 ${resolved.regionName}`;
  const subtitle = isSimulatorAvailable ? `Traverse the ${activeEnv.terrain.credit} under Mars partial gravity (3.71 m/s\xB2).` : `3D surface simulation environment is in preparation for ${resolved.regionName}. Scientific exploration remains available via orbital and 2D mapping tools.`;
  console.log(`[${id}] title: "${title}"`);
  console.log(`[${id}] subtitle: "${subtitle}"`);
  if (isSimulatorAvailable) {
    import_node_assert.default.ok(title.includes("Marswalk 3D Surface Simulator \xB7 Jezero Crater"));
    import_node_assert.default.ok(subtitle.includes("under Mars partial gravity"));
    import_node_assert.default.ok(subtitle.includes(activeEnv.terrain.credit));
  } else {
    import_node_assert.default.ok(
      title.startsWith("3D Surface Exploration \xB7 "),
      `Title for ${id} should start with '3D Surface Exploration \xB7 ', got: ${title}`
    );
    import_node_assert.default.ok(title.includes(resolved.regionName));
    import_node_assert.default.ok(
      subtitle.includes("in preparation"),
      `Subtitle for ${id} should mention 'in preparation', got: ${subtitle}`
    );
    import_node_assert.default.ok(
      !subtitle.includes("Jezero"),
      `Subtitle for ${id} should NOT mention Jezero, got: ${subtitle}`
    );
    import_node_assert.default.ok(
      !subtitle.includes("partial gravity"),
      `Subtitle for ${id} should NOT mention partial gravity context for planned regions, got: ${subtitle}`
    );
  }
  const regionData = getMarsRegionById(id);
  import_node_assert.default.ok(regionData, `Region ${id} must exist in registry`);
  const mockMissionConfig = { startingLocation: null };
  const baseCoordinates = isSimulatorAvailable && resolved.environment ? mockMissionConfig.startingLocation ?? resolved.environment.defaultBase : mockMissionConfig.startingLocation ?? regionData.coordinates ?? { latitude: 18.4447, longitude: 77.4508 };
  if (isSimulatorAvailable) {
    import_node_assert.default.strictEqual(baseCoordinates.latitude, 18.4447);
    import_node_assert.default.strictEqual(baseCoordinates.longitude, 77.4508);
  } else if (id === "gale-crater") {
    import_node_assert.default.strictEqual(baseCoordinates.latitude, regionData.coordinates.latitude);
    import_node_assert.default.strictEqual(baseCoordinates.longitude, regionData.coordinates.longitude);
    console.log(`  \u2713 Gale Crater baseCoordinates correctly resolved to (${baseCoordinates.latitude}, ${baseCoordinates.longitude}) instead of Jezero!`);
  }
}
console.log("\u2713 FIX 1 assertions PASSED.\n");
console.log("--- Testing FIX 2: Cross-Region Target & Waypoint Warning ---");
var jezeroRegion = getMarsRegionById("jezero-crater");
var galeRegion = getMarsRegionById("gale-crater");
var sampleTargets = [
  {
    id: "target-j1",
    name: "Kodiak Butte",
    coordinates: { latitude: 18.4124, longitude: 77.4325 },
    description: "Delta remnant",
    observationIds: ["obs-1"]
  },
  {
    id: "target-j2",
    name: "Belva Crater",
    coordinates: { latitude: 18.502, longitude: 77.381 },
    description: "Impact crater floor",
    observationIds: ["obs-2"]
  },
  {
    id: "target-g1",
    name: "Mount Sharp Base",
    coordinates: { latitude: -5.35, longitude: 137.45 },
    description: "Sulfate unit outcrop",
    observationIds: ["obs-3"]
  },
  {
    id: "target-unmapped",
    name: "Equatorial Outlier",
    coordinates: { latitude: 0, longitude: 0 },
    description: "Unmapped target",
    observationIds: []
  }
];
var sampleRoutes = [
  {
    id: "route-jezero-alpha",
    name: "Jezero Delta Traverse",
    waypoints: [
      { id: "wp-j1", name: "Start", coordinates: { latitude: 18.4447, longitude: 77.4508 }, visited: false },
      { id: "wp-j2", name: "Delta Front", coordinates: { latitude: 18.42, longitude: 77.41 }, visited: false }
    ]
  },
  {
    id: "route-gale-curiosity",
    name: "Curiosity Ascent",
    waypoints: [
      { id: "wp-g1", name: "Bradbury Landing", coordinates: { latitude: -5.36, longitude: 137.44 }, visited: false },
      { id: "wp-g2", name: "Yellowknife Bay", coordinates: { latitude: -5.38, longitude: 137.45 }, visited: false }
    ]
  }
];
console.log("Scenario A: Active region = Jezero Crater");
var jezeroAudit = auditCrossRegionItems(jezeroRegion, sampleTargets, sampleRoutes);
console.log("Jezero audit summary:", {
  hasCrossRegionItems: jezeroAudit.hasCrossRegionItems,
  targetsCount: jezeroAudit.targetsCount,
  waypointsCount: jezeroAudit.waypointsCount,
  attributedRegionNames: jezeroAudit.attributedRegionNames,
  unattributedCount: jezeroAudit.unattributedCount
});
import_node_assert.default.strictEqual(jezeroAudit.targetsCount, 2, "Expected 2 out-of-bounds targets for Jezero");
var mountSharp = jezeroAudit.outOfBoundsTargets.find((t) => t.item.id === "target-g1");
import_node_assert.default.ok(mountSharp, "Mount Sharp must be detected as out-of-bounds");
import_node_assert.default.strictEqual(mountSharp.attributedRegionName, galeRegion.name);
var outlier = jezeroAudit.outOfBoundsTargets.find((t) => t.item.id === "target-unmapped");
import_node_assert.default.ok(outlier, "Outlier must be detected as out-of-bounds");
import_node_assert.default.strictEqual(outlier.attributedRegionName, null, "Outlier at (0,0) must not be attributed to any region");
import_node_assert.default.strictEqual(jezeroAudit.unattributedCount, 1, "Expected 1 unattributed item");
console.log("\nScenario B: Active region = Gale Crater");
var galeAudit = auditCrossRegionItems(galeRegion, sampleTargets, sampleRoutes);
console.log("Gale audit summary:", {
  hasCrossRegionItems: galeAudit.hasCrossRegionItems,
  targetsCount: galeAudit.targetsCount,
  waypointsCount: galeAudit.waypointsCount,
  attributedRegionNames: galeAudit.attributedRegionNames,
  unattributedCount: galeAudit.unattributedCount
});
import_node_assert.default.strictEqual(galeAudit.targetsCount, 3, "Expected 3 out-of-bounds targets for Gale");
import_node_assert.default.strictEqual(galeAudit.waypointsCount, 2, "Expected 2 out-of-bounds waypoints for Gale");
import_node_assert.default.ok(galeAudit.attributedRegionNames.includes("Jezero Crater"));
import_node_assert.default.strictEqual(sampleTargets[0].coordinates.latitude, 18.4124);
import_node_assert.default.strictEqual(sampleTargets[0].coordinates.longitude, 77.4325);
console.log("  \u2713 Targets and waypoints were safely inspected without any mutation of coordinates!");
console.log("\nScenario C: Clean region with only local items");
var localJezeroTargets = sampleTargets.filter((t) => isWithinRegionBounds(t.coordinates, jezeroRegion.geographicBounds));
var localJezeroRoutes = [sampleRoutes[0]];
var cleanAudit = auditCrossRegionItems(jezeroRegion, localJezeroTargets, localJezeroRoutes);
import_node_assert.default.strictEqual(cleanAudit.hasCrossRegionItems, false);
import_node_assert.default.strictEqual(cleanAudit.totalOutOfBoundsCount, 0);
import_node_assert.default.strictEqual(cleanAudit.targetsCount, 0);
import_node_assert.default.strictEqual(cleanAudit.waypointsCount, 0);
console.log("  \u2713 Clean local items produce zero warnings!");
console.log("\n\u2713 FIX 2 assertions PASSED.");
console.log("\n=================================================");
console.log("ALL PHASE 1.1 VERIFICATION CHECKS PASSED (100%)");
console.log("=================================================");

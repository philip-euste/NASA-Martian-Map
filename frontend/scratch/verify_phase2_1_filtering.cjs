"use strict";

// frontend/src/data/regions.ts
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

// frontend/src/data/mapLayers.ts
var MAP_LAYERS = {
  // BASEMAPS & SHADED-RELIEF VISUALIZATIONS
  jezero_hirise: {
    id: "jezero_hirise",
    name: "Jezero Crater HiRISE Orthomosaic (25 cm)",
    description: "Controlled high-resolution 25 cm/pixel visible mosaic of Jezero Crater Western Delta and floor (JEZ_hirise_soc_006).",
    provider: "nasaTrek",
    category: "basemap",
    coverage: "regional",
    center: [18.45, 77.45],
    zoom: 7,
    visualizationOnly: false
  },
  mars_global_mola: {
    id: "mars_global_mola",
    name: "MOLA Global Hillshade",
    description: "Global shaded-relief terrain visualization derived from MGS MOLA altimetry (463 m/px display mosaic).",
    provider: "nasaTrek",
    category: "basemap",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: true
  },
  mars_viking_global: {
    id: "mars_viking_global",
    name: "Viking Global Color Mosaic",
    description: "Global visible-light surface mosaic from the Viking Orbiter MDIM 2.1 archive (232 m/px).",
    provider: "nasaTrek",
    category: "basemap",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: true
  },
  mars_moc_atlas: {
    id: "mars_moc_atlas",
    name: "MGS MOC Global Atlas",
    description: "Global Mars Orbiter Camera wide-angle visible image atlas for regional context.",
    provider: "nasaTrek",
    category: "basemap",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: true
  },
  mars_mola_hrsc_color: {
    id: "mars_mola_hrsc_color",
    name: "MOLA + HRSC Color Blend",
    description: "Blended MGS MOLA and Mars Express HRSC color-coded shaded relief visualization (200 m/px).",
    provider: "nasaTrek",
    category: "elevation",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: true
  },
  mars_mola_hrsc_hillshade: {
    id: "mars_mola_hrsc_hillshade",
    name: "MOLA + HRSC Hillshade",
    description: "Combined global MOLA and HRSC grayscale shaded-relief visualization (200 m/px).",
    provider: "nasaTrek",
    category: "elevation",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: true
  },
  // ELEVATION AND TERRAIN OVERLAYS
  mars_mola_roughness: {
    id: "mars_mola_roughness",
    name: "MOLA Surface Roughness",
    description: "Global kilometer-scale surface roughness visualization.",
    provider: "nasaTrek",
    category: "elevation",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: false
  },
  // TES DERIVED GLOBAL SURFACE PROPERTY OVERLAYS
  mars_tes_dust: {
    id: "mars_tes_dust",
    name: "TES Global Dust",
    description: "Global atmospheric dust optical depth visualization.",
    provider: "nasaTrek",
    category: "atmosphere",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: false
  },
  mars_tes_dust_index: {
    id: "mars_tes_dust_index",
    name: "TES Dust Cover Index",
    description: "Global surface dust cover index derived from TES observations.",
    provider: "nasaTrek",
    category: "atmosphere",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: false
  },
  mars_tes_thermal: {
    id: "mars_tes_thermal",
    name: "TES Thermal Inertia",
    description: "Global bolometric thermal inertia visualization (~3 km/px).",
    provider: "nasaTrek",
    category: "thermal",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: false
  },
  mars_tes_pyroxene: {
    id: "mars_tes_pyroxene",
    name: "TES High-Ca Pyroxene",
    description: "Global high-calcium pyroxene thermal IR deconvolution overlay.",
    provider: "nasaTrek",
    category: "composition",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: false
  },
  mars_tes_plagioclase: {
    id: "mars_tes_plagioclase",
    name: "TES Plagioclase",
    description: "Global plagioclase feldspar thermal IR deconvolution overlay.",
    provider: "nasaTrek",
    category: "composition",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: false
  },
  mars_tes_silicates: {
    id: "mars_tes_silicates",
    name: "TES Sheet Silicates / High-Si Glass",
    description: "Global high-silica glass / sheet silicate thermal IR deconvolution overlay.",
    provider: "nasaTrek",
    category: "composition",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: false
  },
  mars_tes_albedo: {
    id: "mars_tes_albedo",
    name: "TES Surface Albedo",
    description: "Global bolometric surface albedo observations (~7.4 km/px).",
    provider: "nasaTrek",
    category: "thermal",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: false
  },
  // THEMIS INFRARED IMAGERY OVERLAYS
  mars_themis_day: {
    id: "mars_themis_day",
    name: "THEMIS Daytime Infrared",
    description: "Global daytime thermal infrared mosaic from 2001 Mars Odyssey (100 m/px).",
    provider: "nasaTrek",
    category: "thermal",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: false
  },
  mars_themis_night: {
    id: "mars_themis_night",
    name: "THEMIS Nighttime Infrared",
    description: "Global nighttime thermal infrared mosaic from 2001 Mars Odyssey (100 m/px).",
    provider: "nasaTrek",
    category: "thermal",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: false
  }
};

// frontend/src/data/evidenceDatasets.ts
var EVIDENCE_CATEGORY_LABELS = {
  topography: "Topography, Elevation & Slope",
  optical_imagery: "High-Resolution & Regional Optical Imagery",
  thermal_physical: "Thermal & Physical Surface Properties",
  composition: "Mineralogical & Spectral Composition",
  atmosphere_environment: "Atmosphere, Dust & Surface Environment"
};
var INTEGRATION_STATUS_LABELS = {
  integrated_active: "Verified & Integrated (Live in App)",
  integrated_backend: "Verified & Integrated (Backend / Local Archive)",
  documented_not_integrated: "Verified Reference Only (Interactive Data Not Yet Integrated)"
};
var SURFACE_IMAGERY_DATASET_ID = "m2020_perseverance_surface_imagery";
var EVIDENCE_DATASETS = [
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
    description: "High-resolution stereo photogrammetric Digital Terrain Model covering the Jezero Crater western delta and landing region.",
    measurementProvided: "Quantitative surface elevation (meters relative to Mars 2000 equipotential aeroid) and local terrain slope gradients. Provides elevation and terrain geometry, not mineralogical identification.",
    spatialResolutionLabel: "1.0 m/post (~0.2 m vertical precision)",
    resolutionMeters: 1,
    geographicCoverage: "Regional \xB7 Jezero Crater Stereo Strip (17.95\xB0N\u201318.90\xB0N, 76.95\xB0E\u201378.05\xB0E)",
    coverageScope: "REGIONAL",
    supportedRegionIds: ["jezero-crater"],
    geographicBounds: { minLat: 17.95, maxLat: 18.9, minLon: 76.95, maxLon: 78.05 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "2006\u2013Present (MRO Primary & Extended Science Phases)",
    scientificPurpose: "Measure delta scarp relief, stratigraphic bed elevations, dip angles, and astronaut traverse slope hazards.",
    suitability: "Direct Quantitative Analysis",
    limitations: [
      "Provides terrain elevation and slope geometry only; cannot identify mineral composition or phyllosilicates.",
      "Spatial coverage is restricted to the controlled Jezero stereo pair footprint; sub-meter cobbles (<1 m) are below post spacing."
    ],
    sourceReference: "USGS Astrogeology Science Center / NASA PDS Cartography and Imaging Sciences Node",
    pdsProductId: "DTEEC_048842_1985_048908_1985_U01",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active
  },
  {
    id: "ctx_jezero_dtm_20m",
    name: "CTX Jezero Crater Regional Digital Elevation Model (20 m DEM)",
    instrument: "CTX (Context Camera)",
    mission: "Mars Reconnaissance Orbiter (MRO)",
    category: "topography",
    mapCategory: "elevation",
    description: "Controlled regional stereo Digital Elevation Model of Jezero Crater and its western delta compiled for the Mars 2020 Science Investigation.",
    measurementProvided: "Regional surface elevation (heightMin -3504.6 m to heightMax -475.8 m relative to Mars 2000 aeroid) and 20 m terrain relief across the entire Jezero basin.",
    spatialResolutionLabel: "20.0 m/post (4456 \xD7 5067 grid)",
    resolutionMeters: 20,
    geographicCoverage: "Regional \xB7 Jezero Crater Basin & Western Delta (17.58\xB0N\u201319.29\xB0N, 76.99\xB0E\u201378.49\xB0E)",
    coverageScope: "REGIONAL",
    supportedRegionIds: ["jezero-crater"],
    geographicBounds: { minLat: 17.58, maxLat: 19.29, minLon: 76.99, maxLon: 78.49 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "2006\u20132021 (USGS / NASA-JPL Mars 2020 Science Investigation Maps)",
    scientificPurpose: "Provide continuous regional elevation profiles, crater-rim-to-floor relief, Marswalk 3D terrain mesh heights, and local fallback elevation sampling.",
    suitability: "Direct Quantitative Analysis",
    limitations: [
      "Measures regional topography at 20 m post spacing; does not measure mineralogical composition.",
      "Steep meter-scale scarps and individual boulders are smoothed across 20 m posts."
    ],
    sourceReference: "USGS Astrogeology / NASA-JPL Mars 2020 Science Investigation CTX DEM (Calef, 2021; Mangold et al., 2021)",
    pdsProductId: "M20_JezeroCrater_CTXDEM_20m",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active
  },
  {
    id: "mars_mola_roughness",
    name: "MOLA Global Surface Roughness (Kilometer-Scale)",
    instrument: "MOLA (Mars Orbiter Laser Altimeter)",
    mission: "Mars Global Surveyor (MGS)",
    category: "topography",
    mapCategory: "elevation",
    linkedMapLayerId: "mars_mola_roughness",
    description: "Global kilometer-scale surface roughness derived from 1064 nm laser altimeter pulse spreading and along-track slope baselines.",
    measurementProvided: "Root-mean-square (RMS) vertical terrain roughness at hectometer-to-kilometer baselines.",
    spatialResolutionLabel: "~30 km/pixel (0.5\xB0 global grid)",
    resolutionMeters: 3e4,
    geographicCoverage: "Global (90\xB0S\u201390\xB0N, 180\xB0W\u2013180\xB0E)",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -90, maxLat: 90 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "1997\u20132001 (MGS Mapping Mission)",
    scientificPurpose: "Broad regional characterization of physiographic provinces (smooth basin plains vs. heavily fractured highland terrain).",
    suitability: "Regional Context Only (Coarse Resolution)",
    limitations: [
      "Coarse ~30 km grid resolution cannot resolve local crater rims, delta scarps, or meter-scale boulder hazards relevant to astronaut footing.",
      "Should be used only for regional geomorphic context, never as proof of local traverse safety."
    ],
    sourceReference: "NASA PDS Geosciences Node / NASA Mars Trek WMTS (Neumann et al., 2003)",
    pdsProductId: "mola_roughness",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active
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
    description: "Sub-meter visible-light orthorectified image mosaic of the Jezero Crater landing ellipse and western delta front.",
    measurementProvided: "Visible red-band bidirectional reflectance showing meter-scale bedding, fracture networks, boulder fields, and aeolian bedforms. Supports morphological and geological interpretation, not direct mineralogical identification.",
    spatialResolutionLabel: "0.25 m/pixel (25 cm/pixel)",
    resolutionMeters: 0.25,
    geographicCoverage: "Regional \xB7 Jezero Crater Landing Ellipse & Western Delta",
    coverageScope: "REGIONAL",
    supportedRegionIds: ["jezero-crater"],
    geographicBounds: { minLat: 18.25, maxLat: 18.6, minLon: 77.25, maxLon: 77.65 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "2006\u2013Present (MRO Orbital Archive)",
    scientificPurpose: "Identify fine-scale sedimentary stratification, truncated deltaic foreset/topset beds, polygonal fracturing, and boulder distributions.",
    suitability: "Direct Quantitative Analysis",
    limitations: [
      "Provides visible surface morphology and stratigraphic geometry only; does not directly measure mineralogical composition or hydration state.",
      "Surface dust veneers can mute visual contrast between distinct lithological units."
    ],
    sourceReference: "NASA Mars Trek / USGS Astrogeology / MRO HiRISE Team",
    pdsProductId: "JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd",
    available: true,
    integrationStatus: "integrated_backend",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_backend
  },
  {
    id: "ctx_jezero_ortho_5m",
    name: "CTX Jezero Crater Regional Orthomosaic Imagery (5 m/px)",
    instrument: "CTX (Context Camera)",
    mission: "Mars Reconnaissance Orbiter (MRO)",
    category: "optical_imagery",
    mapCategory: "geology",
    description: "Controlled 5 m/pixel panchromatic visible orthomosaic of Jezero Crater, Neretva Vallis inlet channel, and the western delta.",
    measurementProvided: "Panchromatic (500\u2013700 nm) surface reflectance imagery capturing regional geomorphology, fluvial channels, delta lobes, and crater floor units.",
    spatialResolutionLabel: "5.0 m/pixel",
    resolutionMeters: 5,
    geographicCoverage: "Regional \xB7 Jezero Crater Basin & Inlet Channels (17.58\xB0N\u201319.29\xB0N, 76.99\xB0E\u201378.49\xB0E)",
    coverageScope: "REGIONAL",
    supportedRegionIds: ["jezero-crater"],
    geographicBounds: { minLat: 17.58, maxLat: 19.29, minLon: 76.99, maxLon: 78.49 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "2006\u20132021 (USGS / NASA-JPL Mars 2020 Science Investigation Maps)",
    scientificPurpose: "Support regional geological and geomorphological context, trace ancient fluvial feeder channels into the western delta, and map contact boundaries.",
    suitability: "Contextual & Hazard Analysis",
    limitations: [
      "Panchromatic visible imagery (5 m/pixel) supports regional geological and geomorphological context only; it cannot identify phyllosilicate mineralogy or sub-meter sedimentary laminations."
    ],
    sourceReference: "USGS Astrogeology / NASA-JPL Mars 2020 Science Investigation CTX Orthomosaic (Calef, 2021; Mangold et al., 2021)",
    pdsProductId: "M20_JezeroCrater_CTXortho_mosaic_5m",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active
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
    description: "Global pre-dawn (~3:00 AM LST) thermal infrared radiance mosaic sensitive to surface grain consolidation and exposed bedrock.",
    measurementProvided: "Nighttime thermal infrared brightness temperature (Band 9, 12.57 \xB5m), serving as a high-resolution proxy for thermal inertia and physical grain consolidation.",
    spatialResolutionLabel: "100 m/pixel",
    resolutionMeters: 100,
    geographicCoverage: "Global (90\xB0S\u201390\xB0N, 180\xB0W\u2013180\xB0E)",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -90, maxLat: 90 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "2002\u2013Present (2001 Mars Odyssey)",
    scientificPurpose: "Distinguish competent, high-thermal-inertia bedrock outcrops (warm at night) from unconsolidated sand traps and thick dust mantles (cool at night).",
    suitability: "Contextual & Hazard Analysis",
    limitations: [
      "Describes thermal surface properties (physical induration, grain size, and rock abundance), NOT direct proof of phyllosilicates or specific mineral chemistry.",
      "At 100 m/pixel, sub-hectometer bedrock exposures are thermally averaged with surrounding regolith."
    ],
    sourceReference: "ASU Mars Space Flight Facility / NASA PDS / Mars Trek (Christensen et al.)",
    pdsProductId: "THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active
  },
  {
    id: "mars_themis_day",
    name: "THEMIS Daytime Thermal Infrared Mosaic (100 m/px)",
    instrument: "THEMIS (Thermal Emission Imaging System)",
    mission: "2001 Mars Odyssey",
    category: "thermal_physical",
    mapCategory: "thermal",
    linkedMapLayerId: "mars_themis_day",
    description: "Global afternoon (~3:00 PM LST) thermal infrared radiance mosaic capturing solar-heated surface morphology and regional landforms.",
    measurementProvided: "Daytime thermal infrared radiance (12.57 \xB5m) reflecting combined solar insolation, slope orientation, and surface albedo.",
    spatialResolutionLabel: "100 m/pixel",
    resolutionMeters: 100,
    geographicCoverage: "Global (90\xB0S\u201390\xB0N, 180\xB0W\u2013180\xB0E)",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -90, maxLat: 90 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "2002\u2013Present (2001 Mars Odyssey)",
    scientificPurpose: "Examine regional geomorphology, channel continuity, crater ejecta blankets, and paired day/night thermal anomalies.",
    suitability: "Contextual & Hazard Analysis",
    limitations: [
      "Daytime infrared radiance is dominated by sun-facing topographic slope heating rather than intrinsic rock consolidation or mineral composition.",
      "Requires pairing with Nighttime IR or DTM slope data to separate topography from material properties."
    ],
    sourceReference: "ASU Mars Space Flight Facility / NASA PDS / Mars Trek (Christensen et al.)",
    pdsProductId: "THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active
  },
  {
    id: "mars_tes_thermal",
    name: "TES Bolometric Thermal Inertia (~3 km/px)",
    instrument: "TES (Thermal Emission Spectrometer)",
    mission: "Mars Global Surveyor (MGS)",
    category: "thermal_physical",
    mapCategory: "thermal",
    linkedMapLayerId: "mars_tes_thermal",
    description: "Global quantitative thermal inertia map derived from diurnal surface temperature curves.",
    measurementProvided: "Bulk thermal inertia (J\xB7m\u207B\xB2\xB7K\u207B\xB9\xB7s\u207B\xB9/\xB2) indexing effective particle size, induration, and rock abundance.",
    spatialResolutionLabel: "~3 km/pixel (20 pixels/degree)",
    resolutionMeters: 3e3,
    geographicCoverage: "Global (90\xB0S\u201390\xB0N, 180\xB0W\u2013180\xB0E)",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -90, maxLat: 90 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "1999\u20132006 (MGS Mapping Mission)",
    scientificPurpose: "Assess regional sediment consolidation (fine dust vs. indurated duricrust vs. coarse sand/bedrock).",
    suitability: "Regional Context Only (Coarse Resolution)",
    limitations: [
      "Measures physical heat capacity and particle consolidation, NOT mineralogical proof of phyllosilicates.",
      "Coarse ~3 km pixel footprint averages bedrock scarps, boulder fields, and aeolian dunes into a single bulk value."
    ],
    sourceReference: "NASA PDS Geosciences Node / Mars Trek (Mellon et al., 2000; Putzig & Mellon, 2007)",
    pdsProductId: "TES_Thermal_Inertia",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active
  },
  {
    id: "mars_tes_albedo",
    name: "TES Bolometric Surface Albedo (~7.4 km/px)",
    instrument: "TES (Thermal Emission Spectrometer)",
    mission: "Mars Global Surveyor (MGS)",
    category: "thermal_physical",
    mapCategory: "thermal",
    linkedMapLayerId: "mars_tes_albedo",
    description: "Global solar-spectrum (0.3\u20132.9 \xB5m) Lambertian reflectance map of the Martian surface.",
    measurementProvided: "Broadband bolometric albedo (dimensionless 0.0\u20131.0) corrected for solar incidence angle.",
    spatialResolutionLabel: "~7.4 km/pixel (8 pixels/degree)",
    resolutionMeters: 7410,
    geographicCoverage: "Global (90\xB0S\u201390\xB0N, 180\xB0W\u2013180\xB0E)",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -90, maxLat: 90 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "1999\u20132006 (MGS Mapping Mission)",
    scientificPurpose: "Differentiate bright ferric dust-mantled regions from dark, wind-swept basaltic sand and bedrock.",
    suitability: "Regional Context Only (Coarse Resolution)",
    limitations: [
      "Broadband reflectance scalar only; contains no diagnostic absorption bands for mineral identification.",
      "Subject to temporal shifts following regional or global dust storms."
    ],
    sourceReference: "NASA PDS Geosciences Node / Mars Trek (Christensen et al., 2001)",
    pdsProductId: "Mars_MGS_TES_Albedo_mosaic_global_7410m",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active
  },
  // =========================================================
  // 4. MINERALOGICAL & SPECTRAL COMPOSITION
  // =========================================================
  {
    id: "mars_tes_silicates",
    name: "TES Sheet Silicate / High-Silica Phase Index (~3\u20138 km/px)",
    instrument: "TES (Thermal Emission Spectrometer)",
    mission: "Mars Global Surveyor (MGS)",
    category: "composition",
    mapCategory: "composition",
    linkedMapLayerId: "mars_tes_silicates",
    description: "Global thermal infrared spectral deconvolution map modeling high-silica phases (volcanic glass, amorphous silica coatings, or sheet silicates).",
    measurementProvided: "Modeled areal abundance fraction of high-silica / sheet-silicate spectral endmembers from 6\u201350 \xB5m thermal emissivity.",
    spatialResolutionLabel: "~3\u20138 km/pixel (8\u201320 pixels/degree)",
    resolutionMeters: 3e3,
    geographicCoverage: "Global (60\xB0S\u201360\xB0N, low-dust surfaces)",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -60, maxLat: 60 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "1999\u20132006 (MGS Mapping Mission)",
    scientificPurpose: "Provide broad regional context for high-silica crustal provinces and weathered basaltic surfaces.",
    suitability: "Regional Context Only (Coarse Resolution)",
    limitations: [
      "CRITICAL SCIENTIFIC LIMITATION: Thermal infrared deconvolution at ~3\u20138 km/px cannot uniquely distinguish hydrated phyllosilicate clays (e.g., Fe/Mg smectite) from primary high-silica volcanic glass or amorphous silica coatings.",
      "A single ~3 km TES pixel spans nearly the entire western Jezero delta; this dataset CANNOT independently prove fine-grained lacustrine clay strata and must be supplemented by targeted VNIR spectroscopy (CRISM) or in-situ contact instruments."
    ],
    sourceReference: "NASA PDS Geosciences Node / Mars Trek (Bandfield et al., 2000; Rogers & Christensen, 2007)",
    pdsProductId: "TES_Glass_Clay",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active
  },
  {
    id: "mars_tes_pyroxene",
    name: "TES High-Calcium Pyroxene Abundance (~3\u20138 km/px)",
    instrument: "TES (Thermal Emission Spectrometer)",
    mission: "Mars Global Surveyor (MGS)",
    category: "composition",
    mapCategory: "composition",
    linkedMapLayerId: "mars_tes_pyroxene",
    description: "Global thermal infrared linear deconvolution map of clinopyroxene (high-Ca pyroxene) abundance.",
    measurementProvided: "Modeled areal abundance fraction of clinopyroxene in dust-free mafic surfaces.",
    spatialResolutionLabel: "~3\u20138 km/pixel",
    resolutionMeters: 3e3,
    geographicCoverage: "Global (60\xB0S\u201360\xB0N, low-dust surfaces)",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -60, maxLat: 60 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "1999\u20132006 (MGS Mapping Mission)",
    scientificPurpose: "Characterize regional mafic igneous crust and volcanic floor units surrounding impact basins.",
    suitability: "Regional Context Only (Coarse Resolution)",
    limitations: [
      "Coarse ~3\u20138 km spatial resolution cannot resolve individual crater-floor outcrops or thin sedimentary beds.",
      "Spectral deconvolution is unreliable where the Surface Dust Cover Index (DCI) is high."
    ],
    sourceReference: "NASA PDS Geosciences Node / Mars Trek (Bandfield, 2002; Christensen et al.)",
    pdsProductId: "TES_Clinopyroxene",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active
  },
  {
    id: "mars_tes_plagioclase",
    name: "TES Plagioclase Feldspar Abundance (~3\u20138 km/px)",
    instrument: "TES (Thermal Emission Spectrometer)",
    mission: "Mars Global Surveyor (MGS)",
    category: "composition",
    mapCategory: "composition",
    linkedMapLayerId: "mars_tes_plagioclase",
    description: "Global thermal infrared linear deconvolution map of primary plagioclase feldspar abundance.",
    measurementProvided: "Modeled areal abundance fraction of plagioclase feldspar from thermal infrared emissivity spectra.",
    spatialResolutionLabel: "~3\u20138 km/pixel",
    resolutionMeters: 3e3,
    geographicCoverage: "Global (60\xB0S\u201360\xB0N, low-dust surfaces)",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -60, maxLat: 60 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "1999\u20132006 (MGS Mapping Mission)",
    scientificPurpose: "Evaluate regional feldspathic crustal composition and primary igneous petrology.",
    suitability: "Regional Context Only (Coarse Resolution)",
    limitations: [
      "Coarse ~3\u20138 km spatial resolution cannot isolate outcrop-scale sedimentary strata or detrital mineral grains.",
      "Masked in regions with moderate-to-thick ferric dust coatings."
    ],
    sourceReference: "NASA PDS Geosciences Node / Mars Trek (Bandfield, 2002; Rogers & Christensen, 2007)",
    pdsProductId: "TES_Plagioclase",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active
  },
  {
    id: "crism_jezero_vnir",
    name: "CRISM Targeted VNIR Spectral Observations (Jezero Delta)",
    instrument: "CRISM (Compact Reconnaissance Imaging Spectrometer for Mars)",
    mission: "Mars Reconnaissance Orbiter (MRO)",
    category: "composition",
    mapCategory: "composition",
    description: "Targeted visible and near-infrared (0.36\u20133.92 \xB5m) imaging spectroscopy resolving diagnostic vibrational absorption bands of hydrated phyllosilicates (smectite) and carbonates in Jezero Crater.",
    measurementProvided: "VNIR spectral reflectance (I/F) across 544 channels detecting 1.4 \xB5m OH, 1.9 \xB5m H\u2082O, 2.296 \xB5m Fe/Mg-OH (smectite clay), and 2.30 / 2.51 \xB5m Mg-carbonate overtones.",
    spatialResolutionLabel: "18\u201336 m/pixel (Targeted Full/Half Resolution)",
    resolutionMeters: 18,
    geographicCoverage: "Targeted Footprints \xB7 Jezero Western Delta & Margin (FRT00005C5E, HRL000040FF, FRT0000B204)",
    coverageScope: "LOCAL_INSITU",
    supportedRegionIds: ["jezero-crater"],
    geographicBounds: { minLat: 18.35, maxLat: 18.55, minLon: 77.3, maxLon: 77.55 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "2006\u20132023 (MRO CRISM Science Operations)",
    scientificPurpose: "Support mineralogical investigation of Fe/Mg-smectite phyllosilicates in bottomset/foreset delta beds vs. Mg-carbonate and olivine margin units.",
    suitability: "Direct Quantitative Analysis",
    limitations: [
      "INTEGRATION STATUS: Active interactive spectral inspection integrated (MRO CRISM MTRDR cubes FRT00005C5E, HRL000040FF, FRT0000B204).",
      "Even at 18 m/pixel, orbital VNIR spectroscopy cannot determine whether Jezero delta phyllosilicates formed authigenically in situ or were transported as detrital grains from the Nili Fossae watershed, nor can it resolve millimeter-scale laminations.",
      "Definitive confirmation of sustained standing water vs. episodic flooding requires in-situ textural/isotopic contact analysis (Perseverance or EVA sampling)."
    ],
    sourceReference: "NASA PDS Geosciences Node (urn:nasa:pds:crism_mtrdr; Ehlmann et al., 2008; Goudge et al., 2015; Horgan et al., 2020)",
    pdsProductId: "urn:nasa:pds:crism_mtrdr",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active
  },
  {
    id: "omega_vnir_regional",
    name: "OMEGA Regional VNIR Spectral Observations (Catalog Reference)",
    instrument: "OMEGA (Observatoire pour la Min\xE9ralogie, l'Eau, les Glaces et l'Activit\xE9)",
    mission: "Mars Express (ESA)",
    category: "composition",
    mapCategory: "composition",
    description: "Regional visible and near-infrared (0.35\u20135.1 \xB5m) imaging spectrometer observations mapping regional phyllosilicate-bearing terrains across Nili Fossae and Syrtis Major.",
    measurementProvided: "Regional VNIR reflectance spectra (352 spectral channels) identifying broad Fe/Mg-phyllosilicate, olivine, and pyroxene spectral signatures.",
    spatialResolutionLabel: "~300 m to 4.8 km/pixel",
    resolutionMeters: 1e3,
    geographicCoverage: "Regional Swaths \xB7 Nili Fossae, Syrtis Major & Circum-Isidis Highlands",
    coverageScope: "REGIONAL",
    supportedRegionIds: ["jezero-crater"],
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "UNAVAILABLE"],
    temporalCoverage: "2004\u2013Present (ESA Mars Express)",
    scientificPurpose: "Provide broader watershed-scale spectral context for hydrated silicate provinces feeding into the Jezero Crater basin.",
    suitability: "Regional Context Only (Coarse Resolution)",
    limitations: [
      "INTEGRATION STATUS: Documented reference entry only \u2014 interactive OMEGA spectral cubes are NOT currently integrated in this application.",
      "At ~300 m to 4.8 km/pixel, OMEGA resolves regional watershed mineralogy rather than individual deltaic beds or outcrop-scale strata inside Jezero Crater."
    ],
    sourceReference: "ESA Planetary Science Archive (PSA) / NASA PDS (Bibring et al., 2005; Poulet et al., 2005; Carter et al., 2013)",
    pdsProductId: "MEX-M-OMEGA-2-EDR-FLIGHT-V1.0",
    available: false,
    integrationStatus: "documented_not_integrated",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.documented_not_integrated
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
    description: "Global map of fine silicate surface dust coating thickness derived from the 9 \xB5m particle transparency feature.",
    measurementProvided: "Dust Cover Index (DCI, ~0.92\u20131.00), where lower values (<0.94) indicate dust-coated surfaces and higher values (>0.96) indicate dust-free rock/sand.",
    spatialResolutionLabel: "~3 km/pixel",
    resolutionMeters: 3e3,
    geographicCoverage: "Global (90\xB0S\u201390\xB0N, 180\xB0W\u2013180\xB0E)",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -90, maxLat: 90 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "1999\u20132006 (MGS Mapping Mission)",
    scientificPurpose: "Determine whether orbital thermal/spectral measurements in a study region are obscured by surface dust coatings, and assess dust adhesion hazards.",
    suitability: "Contextual & Hazard Analysis",
    limitations: [
      "Measures micron-scale surface dust coatings across ~3 km footprints; does not measure bedrock composition.",
      "High dust cover masks underlying mineral signatures in both VNIR and TIR orbital datasets."
    ],
    sourceReference: "NASA PDS Geosciences Node / Mars Trek (Ruff & Christensen, 2002)",
    pdsProductId: "tes_ruffdust",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active
  },
  {
    id: "mars_tes_dust",
    name: "TES Atmospheric Dust Optical Depth Climatology",
    instrument: "TES (Thermal Emission Spectrometer)",
    mission: "Mars Global Surveyor (MGS)",
    category: "atmosphere_environment",
    mapCategory: "atmosphere",
    linkedMapLayerId: "mars_tes_dust",
    description: "Orbital climatology of column-integrated 9 \xB5m atmospheric dust opacity across the Martian seasons.",
    measurementProvided: "Infrared atmospheric dust optical depth (\u03C4 at 1075 cm\u207B\xB9 / 9.3 \xB5m).",
    spatialResolutionLabel: "~30\u201360 km/pixel",
    resolutionMeters: 3e4,
    geographicCoverage: "Global (90\xB0S\u201390\xB0N, 180\xB0W\u2013180\xB0E)",
    coverageScope: "GLOBAL",
    latitudeLimits: { minLat: -90, maxLat: 90 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "1999\u20132006 (MGS Mapping Mission)",
    scientificPurpose: "Assess regional atmospheric dust loading, solar power attenuation, and orbital observation clarity.",
    suitability: "Regional Context Only (Coarse Resolution)",
    limitations: [
      "Historical orbital climatology; does not provide real-time local surface wind or visibility without in-situ station telemetry."
    ],
    sourceReference: "NASA PDS Atmospheres Node / Mars Trek (Smith, 2004)",
    pdsProductId: "TES_Dust",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active
  },
  {
    id: "m2020_meda_env",
    name: "Perseverance MEDA Surface Environmental Measurements (PDS4 Sol 0001 & Sol 0036)",
    instrument: "MEDA (Mars Environmental Dynamics Analyzer)",
    mission: "Mars 2020 Perseverance Rover",
    category: "atmosphere_environment",
    mapCategory: "atmosphere",
    description: "Validated in-situ meteorological and radiative measurements recorded on the floor of Jezero Crater by the Perseverance rover across all 7 MEDA sensor subsystems (PS, ATS, TIRS, RHS, WS, RDS, ANC).",
    measurementProvided: "Atmospheric pressure (PS, Pa), 5-boom local air temperatures (ATS, K & \xB0C), ground surface temperature & IR irradiance (TIRS, K & W/m\xB2), relative humidity & frost point (RHS, % & K), wind speed & direction (WS, m/s & deg), solar photodiode radiation (RDS, W/m\xB2), and solar geometry (ANC, deg).",
    spatialResolutionLabel: "In-situ rover station (Octavia E. Butler Landing \xB7 18.4447\xB0N, 77.4508\xB0E)",
    resolutionMeters: 1,
    geographicCoverage: "Local \xB7 Jezero Crater Floor (Octavia E. Butler Landing Site, ~2.2 km SE of Western Delta Front)",
    coverageScope: "LOCAL_INSITU",
    supportedRegionIds: ["jezero-crater"],
    geographicBounds: { minLat: 18.44, maxLat: 18.45, minLon: 77.44, maxLon: 77.46 },
    operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
    temporalCoverage: "Sol 0001 (2021-02-19, ATS/PS/TIRS/RHS/RDS/ANC) & Sol 0036 (2021-03-27, WS) \xB7 53,263 validated PDS4 records",
    scientificPurpose: "Provide ground-truth surface barometric pressure, diurnal air/ground thermal extremes, relative humidity, solar radiation flux, and wind conditions for astronaut suit life-support and EVA traverse planning.",
    suitability: "Direct Quantitative Analysis",
    limitations: [
      "Environmental measurements only: MEDA characterizes modern meteorological conditions at the rover's Jezero Crater floor location (~2.2 km SE of the western delta front) and is NOT direct evidence of ancient lake deposits or phyllosilicate mineralogy.",
      "Archive subset covers Sol 0001 (ATS, PS, TIRS, RHS, RDS, ANC) and Sol 0036 (WS); 1,990 WS rows containing PDS invalid sentinel `999999999` are preserved as missing values (never interpreted as zero)."
    ],
    sourceReference: "NASA PDS Atmospheres Node (https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/ \xB7 Rodriguez-Manfredi et al., 2021)",
    pdsProductId: "urn:nasa:pds:mars2020_meda",
    available: true,
    integrationStatus: "integrated_active",
    integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active
  }
];
var EVIDENCE_DATASETS_BY_ID = Object.fromEntries(EVIDENCE_DATASETS.map((entry) => [entry.id, entry]));
function isDatasetApplicableToRegion(entry, regionId) {
  if (!regionId) return true;
  if (entry.coverageScope === "GLOBAL") {
    const region = MARS_REGIONS[regionId];
    if (region && entry.latitudeLimits) {
      const lat = region.coordinates.latitude;
      if (lat < entry.latitudeLimits.minLat || lat > entry.latitudeLimits.maxLat) {
        return false;
      }
    }
    return true;
  }
  if (entry.supportedRegionIds && entry.supportedRegionIds.length > 0) {
    return entry.supportedRegionIds.includes(regionId);
  }
  return false;
}
function isDatasetUsable(entry) {
  if (!entry.available) return false;
  if (entry.operationalStatus.includes("UNAVAILABLE") || entry.operationalStatus.includes("PLANNED")) {
    return false;
  }
  return entry.operationalStatus.includes("INTEGRATED");
}
function getDatasetsForRegion(regionId, options = {}) {
  return EVIDENCE_DATASETS.filter((entry) => {
    if (!isDatasetApplicableToRegion(entry, regionId)) return false;
    if (!options.includePlannedOrUnavailable && !isDatasetUsable(entry)) {
      return false;
    }
    if (options.category && options.category !== "all" && options.category !== "selected" && entry.category !== options.category) {
      return false;
    }
    if (options.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      const hay = `${entry.name} ${entry.instrument} ${entry.mission} ${entry.description} ${entry.measurementProvided} ${EVIDENCE_CATEGORY_LABELS[entry.category]}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
function getPlannedOrUnavailableDatasetsForRegion(regionId) {
  return EVIDENCE_DATASETS.filter((entry) => {
    if (!isDatasetApplicableToRegion(entry, regionId)) return false;
    return !isDatasetUsable(entry);
  });
}
function toMissionDataset(entry) {
  return {
    id: entry.id,
    name: entry.name,
    source: `${entry.instrument} \xB7 ${entry.mission}`,
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
    supportedRegionIds: entry.supportedRegionIds ? [...entry.supportedRegionIds] : void 0,
    operationalStatus: [...entry.operationalStatus],
    temporalCoverage: entry.temporalCoverage,
    scientificPurpose: entry.scientificPurpose,
    suitability: entry.suitability,
    integrationStatus: entry.integrationStatus,
    integrationStatusLabel: entry.integrationStatusLabel,
    provenance: {
      source: entry.sourceReference,
      sourceId: entry.pdsProductId,
      processingMethod: `${entry.measurementProvided} (${entry.spatialResolutionLabel})`,
      limitations: [...entry.limitations]
    }
  };
}
function resolveDatasetMetadata(datasetId) {
  const evidence = EVIDENCE_DATASETS_BY_ID[datasetId];
  if (evidence) {
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
      scientificPurpose: evidence.scientificPurpose,
      suitability: evidence.suitability,
      integrationStatus: evidence.integrationStatus,
      integrationStatusLabel: evidence.integrationStatusLabel,
      limitations: [...evidence.limitations],
      pdsProductId: evidence.pdsProductId,
      sourceReference: evidence.sourceReference,
      isVisualizationOnlyLegacy: false
    };
  }
  if (datasetId === SURFACE_IMAGERY_DATASET_ID || datasetId.startsWith("m2020_surface_")) {
    return {
      id: datasetId,
      name: "Perseverance Surface Imagery Catalog (Mastcam-Z / Navcam / SuperCam RMI)",
      instrumentAndMission: "Mastcam-Z, Navcam & SuperCam RMI (Mars 2020 Perseverance Rover)",
      categoryLabel: "In-Situ Rover Surface Imagery (Catalog #3)",
      measurementProvided: "Direct surface optical photographs (outcrop morphology, sedimentary bedding, grain texture, and traverse context) with rover camera, Sol, UTC/LMST timestamp, and Site/Drive metadata.",
      spatialResolutionLabel: "Sub-millimeter to millimeter outcrop scale (in-situ surface camera)",
      geographicCoverage: "Local \xB7 Perseverance Traverse in Jezero Crater (Site/Drive & Local XYZ recorded; planetocentric lat/lon not embedded in raw EDR frames)",
      coverageScope: "LOCAL_INSITU",
      supportedRegionIds: ["jezero-crater"],
      operationalStatus: ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED"],
      scientificPurpose: "Document in-situ rock textures, outcrop bedding, and surface morphology along Perseverance's traverse to complement orbital imagery.",
      suitability: "Contextual & Hazard Analysis",
      integrationStatus: "integrated_active",
      integrationStatusLabel: INTEGRATION_STATUS_LABELS.integrated_active,
      limitations: [
        "Direct rover surface photograph (distinct from orbital imagery): visual texture and bedding morphology alone do not prove phyllosilicate or carbonate mineralogy without paired spectroscopic (SuperCam/SHERLOC/PIXL/CRISM) analysis.",
        "NASA raw image EDR metadata records rover Site, Drive, and local XYZ coordinates rather than planetocentric (lat, lon); do not assume an image belongs to the western delta unless verified by Sol/Site context."
      ],
      pdsProductId: "urn:nasa:pds:mars2020_img",
      sourceReference: "NASA/JPL-Caltech Mars 2020 Perseverance Raw Images Service (mars.nasa.gov)",
      isVisualizationOnlyLegacy: false
    };
  }
  const legacyMapLayer = MAP_LAYERS[datasetId];
  if (legacyMapLayer) {
    return {
      id: legacyMapLayer.id,
      name: `${legacyMapLayer.name} (Map Visualization Layer)`,
      instrumentAndMission: "NASA Mars Trek Global Visualization Mosaic",
      categoryLabel: "Visualization Basemap (Map Layer Catalog)",
      measurementProvided: "Rendered visual hillshade or color-blended display mosaic for geographic context. Not a direct mineralogical or physical measurement.",
      spatialResolutionLabel: "Global WMTS display mosaic (~200\u2013463 m/pixel)",
      geographicCoverage: "Global (90\xB0S\u201390\xB0N, 180\xB0W\u2013180\xB0E)",
      coverageScope: "GLOBAL",
      operationalStatus: ["REGISTERED", "ACCESSIBLE", "INTEGRATED"],
      scientificPurpose: "Geographic orientation and visual basemap context on the 3D Globe and 2D Map.",
      suitability: "Visualization Only (Not Empirical Evidence)",
      integrationStatus: "legacy_visualization_layer",
      integrationStatusLabel: "Legacy Visualization Basemap (Map Layer Catalog)",
      limitations: [
        "Legacy observation linked to a map visualization layer (shaded-relief visualization mosaic); select an empirical dataset from the Scientific Evidence Catalog for quantitative measurements."
      ],
      pdsProductId: legacyMapLayer.id,
      sourceReference: "NASA / JPL-Caltech / USGS Mars Trek WMTS",
      isVisualizationOnlyLegacy: true
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
    isVisualizationOnlyLegacy: false
  };
}

// frontend/scratch/verify_phase2_1_filtering.ts
var passedCount = 0;
var failedCount = 0;
function assert(condition, testName, details) {
  if (condition) {
    passedCount++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedCount++;
    console.error(`  [FAIL] ${testName}${details ? ` -> ${details}` : ""}`);
  }
}
console.log("===============================================================================");
console.log("PHASE 2.1 VERIFICATION SUITE \u2014 REGION-AWARE SCIENTIFIC DATASET MODEL & FILTERING");
console.log("===============================================================================\n");
console.log("TEST GROUP 1: Scientific Dataset Model & Metadata Consistency");
assert(
  EVIDENCE_DATASETS.length === 17,
  "All 17 empirical evidence datasets registered in catalog",
  `Found ${EVIDENCE_DATASETS.length}`
);
for (const ds of EVIDENCE_DATASETS) {
  assert(
    Boolean(ds.coverageScope) && ["GLOBAL", "REGIONAL", "LOCAL_INSITU", "UNKNOWN"].includes(ds.coverageScope),
    `Dataset '${ds.id}' has valid coverageScope: ${ds.coverageScope}`
  );
  assert(
    Array.isArray(ds.operationalStatus) && ds.operationalStatus.length > 0,
    `Dataset '${ds.id}' has non-empty operationalStatus array: [${ds.operationalStatus.join(", ")}]`
  );
  for (const st of ds.operationalStatus) {
    assert(
      ["REGISTERED", "ACCESSIBLE", "DOWNLOADED", "VALIDATED", "INTEGRATED", "PLANNED", "UNAVAILABLE"].includes(st),
      `Dataset '${ds.id}' status '${st}' is a recognized operational status`
    );
  }
}
console.log("\nTEST GROUP 2: Region-Aware Dataset Filtering (Primary Exploration Regions)");
var primaryRegionIds = ["jezero-crater", "gale-crater", "valles-marineris", "olympus-mons"];
var jezeroUsable = getDatasetsForRegion("jezero-crater");
var jezeroPlanned = getPlannedOrUnavailableDatasetsForRegion("jezero-crater");
assert(
  jezeroUsable.length === 16,
  `Jezero Crater has exactly 16 usable datasets (10 global + 6 local/regional)`,
  `Found ${jezeroUsable.length}`
);
assert(
  jezeroPlanned.some((d) => d.id === "omega_vnir_regional"),
  "OMEGA VNIR regional dataset is classified as planned/unavailable for Jezero Crater"
);
assert(
  !jezeroUsable.some((d) => d.id === "omega_vnir_regional"),
  "OMEGA VNIR regional dataset is excluded from active usable datasets"
);
var galeUsable = getDatasetsForRegion("gale-crater");
var galePlanned = getPlannedOrUnavailableDatasetsForRegion("gale-crater");
assert(
  galeUsable.length === 10,
  `Gale Crater has exactly 10 usable global datasets`,
  `Found ${galeUsable.length}`
);
var jezeroSpecificIds = [
  "hirise_jezero_dtm",
  "ctx_jezero_dtm_20m",
  "jezero_hirise",
  "ctx_jezero_ortho_5m",
  "crism_jezero_vnir",
  "m2020_meda_env"
];
for (const jzId of jezeroSpecificIds) {
  assert(
    !galeUsable.some((d) => d.id === jzId),
    `Gale Crater does not contain Jezero-specific dataset '${jzId}'`
  );
}
var vallesUsable = getDatasetsForRegion("valles-marineris");
assert(
  vallesUsable.length === 10,
  `Valles Marineris has exactly 10 usable global datasets`,
  `Found ${vallesUsable.length}`
);
for (const jzId of jezeroSpecificIds) {
  assert(
    !vallesUsable.some((d) => d.id === jzId),
    `Valles Marineris does not contain Jezero-specific dataset '${jzId}'`
  );
}
var olympusUsable = getDatasetsForRegion("olympus-mons");
assert(
  olympusUsable.length === 10,
  `Olympus Mons has exactly 10 usable global datasets`,
  `Found ${olympusUsable.length}`
);
for (const jzId of jezeroSpecificIds) {
  assert(
    !olympusUsable.some((d) => d.id === jzId),
    `Olympus Mons does not contain Jezero-specific dataset '${jzId}'`
  );
}
console.log("\nTEST GROUP 3: Global Dataset Latitude Boundary Constraints");
var tesSilicates = EVIDENCE_DATASETS_BY_ID["mars_tes_silicates"];
assert(
  Boolean(tesSilicates.latitudeLimits) && tesSilicates.latitudeLimits?.minLat === -60 && tesSilicates.latitudeLimits?.maxLat === 60,
  "TES Sheet Silicates has \xB160\xB0 latitude constraints configured"
);
for (const rId of primaryRegionIds) {
  const reg = MARS_REGIONS[rId];
  assert(
    isDatasetApplicableToRegion(tesSilicates, rId),
    `TES Silicates is applicable to '${reg.name}' (lat ${reg.coordinates.latitude}\xB0 within \xB160\xB0)`
  );
}
console.log("\nTEST GROUP 4: Mission Dataset Conversion & Metadata Preservation");
var testEntry = EVIDENCE_DATASETS_BY_ID["hirise_jezero_dtm"];
var missionDs = toMissionDataset(testEntry);
assert(missionDs.id === testEntry.id, "toMissionDataset preserves dataset ID");
assert(missionDs.coverageScope === "REGIONAL", "toMissionDataset forwards coverageScope");
assert(
  Array.isArray(missionDs.supportedRegionIds) && missionDs.supportedRegionIds.includes("jezero-crater"),
  "toMissionDataset forwards supportedRegionIds"
);
assert(
  Array.isArray(missionDs.operationalStatus) && missionDs.operationalStatus.includes("INTEGRATED"),
  "toMissionDataset forwards operationalStatus"
);
assert(
  Boolean(missionDs.provenance) && missionDs.provenance?.source === testEntry.sourceReference,
  "toMissionDataset preserves provenance archive reference"
);
console.log("\nTEST GROUP 5: resolveDatasetMetadata Backward Compatibility");
var metaHiRISE = resolveDatasetMetadata("hirise_jezero_dtm");
assert(metaHiRISE.coverageScope === "REGIONAL", "resolveDatasetMetadata returns coverageScope for evidence");
assert(
  Array.isArray(metaHiRISE.operationalStatus) && metaHiRISE.operationalStatus.includes("INTEGRATED"),
  "resolveDatasetMetadata returns operationalStatus for evidence"
);
var metaLegacy = resolveDatasetMetadata("mars_global_mola");
assert(
  metaLegacy.isVisualizationOnlyLegacy === true,
  "resolveDatasetMetadata correctly marks legacy map layers as isVisualizationOnlyLegacy"
);
assert(metaLegacy.coverageScope === "GLOBAL", "resolveDatasetMetadata assigns GLOBAL to legacy map layers");
console.log("\n===============================================================================");
console.log(`VERIFICATION COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("===============================================================================");
if (failedCount > 0) {
  process.exit(1);
}

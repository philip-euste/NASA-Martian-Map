// frontend/src/simulator/environments/jezero.ts
//
// Environment configuration for Jezero Crater (Mars 2020 Perseverance landing
// site). All coordinates, bounds, DEM parameters, and dataset references match
// the verified USGS Astrogeology / NASA PDS products already bundled in
// /public/jezero and /public/data.

import type { SimulatorEnvironmentConfig } from "../shared/environment";

export const JEZERO_ENVIRONMENT: SimulatorEnvironmentConfig = {
  id: "jezero-crater",
  status: "available",
  displayName: "Jezero Crater",
  shortName: "Jezero",
  coordinateReference: {
    body: "Mars",
    meanRadiusMeters: 3_389_500,
    latitudeType: "planetocentric",
    longitudeDirection: "east",
    notes: "IAU 2000 planetocentric coordinates (°N, °E); elevations referenced to MOLA aeroid datum.",
  },
  bounds: {
    westLonDeg: 76.99,
    eastLonDeg: 78.4935,
    southLatDeg: 17.5805,
    northLatDeg: 19.2902,
  },
  defaultBase: {
    id: "perseverance-landing",
    name: "Octavia E. Butler Landing (Habitat / Rover Base)",
    latitude: 18.4447,
    longitude: 77.4508,
    description: "Perseverance rover landing site and primary EVA habitat base.",
  },
  landmarks: [
    {
      id: "perseverance-landing",
      name: "Octavia E. Butler Landing (Habitat / Rover Base)",
      latitude: 18.4447,
      longitude: 77.4508,
      description: "Perseverance rover landing site and primary EVA habitat base.",
    },
    {
      id: "western-delta-front",
      name: "Western Delta Scarp Outcrop",
      latitude: 18.458,
      longitude: 77.405,
      description: "Layered deltaic sandstone and mudstone foreset beds.",
    },
    {
      id: "kodiak-butte",
      name: "Kodiak Butte Delta Remnant",
      latitude: 18.428,
      longitude: 77.419,
      description: "Isolated erosional remnant preserving ancient lake-level strata.",
    },
    {
      id: "jezero-center",
      name: "Jezero Crater Floor Unit",
      latitude: 18.38,
      longitude: 77.58,
      description: "Mafic crater floor unit with olivine and carbonate signatures.",
    },
  ],
  fieldSites: [
    {
      id: "octavia-e-butler",
      name: "Octavia E. Butler Landing (Habitat Base)",
      latitude: 18.4447,
      longitude: 77.4508,
      description: "Perseverance landing site and simulated EVA Habitat & Rover Base.",
    },
    {
      id: "jezero-delta-front",
      name: "Western Delta Scarp & Layered Sediments",
      latitude: 18.4585,
      longitude: 77.4052,
      description: "Exposed deltaic mudstones and boulder conglomerates (~40 m relief).",
    },
    {
      id: "seitah-outcrop",
      name: "Séítah Olivine-Rich Unit",
      latitude: 18.4295,
      longitude: 77.439,
      description: "Fractured igneous/altered crater floor unit with regolith dunes.",
    },
    {
      id: "belva-crater",
      name: "Belva Impact Crater Rim",
      latitude: 18.464,
      longitude: 77.429,
      description: "Fresh impact crater exposing subsurface delta stratigraphy.",
    },
  ],
  terrain: {
    format: "tiled-u16-dem",
    baseUrl: "/jezero/",
    demProduct: "M20_JezeroCrater_CTXDEM_20m.tif",
    demResolutionMeters: 20,
    imageryProduct: "M20_JezeroCrater_CTXortho_mosaic_5m.tif",
    credit:
      "USGS Astrogeology / NASA-JPL Mars 2020 Science Investigation CTX DEM & orthomosaic (Calef 2021; Mangold et al. 2021)",
  },
  atmosphere: {
    skyColor: 0xc9a585,
    terrainTint: 0xe0a27a,
    fogNearMeters: 4500,
    fogFarMeters: 34000,
    dustStorm: {
      skyColor: 0x9e5b36,
      fogNearMeters: 250,
      fogFarMeters: 3400,
    },
    sunDirection: [-0.6, 0.55, -0.4],
  },
  hazards: {
    slopeCautionDeg: 10,
    slopeHazardDeg: 15,
    notes: "Slopes ≥15° exceed standard EVA traverse grade limits and increase metabolic CO₂ scrubber load.",
  },
  geology: {
    providerId: "jezero-sim3464",
    label: "USGS SIM 3464 Jezero Photogeologic Map (Sun & Stack, 2020)",
    dataUrl: "/data/jezero_geology_sim3464.geojson",
  },
  datasets: [
    {
      id: "ctx_jezero_dem_20m",
      label: "Mars 2020 CTX 20 m DEM & 5 m Orthomosaic",
      provenance: "empirical",
      source: "USGS Astrogeology / NASA-JPL (Calef 2021)",
    },
    {
      id: "usgs_sim3464_geology",
      label: "USGS SIM 3464 Photogeologic Map of Jezero Crater",
      provenance: "empirical",
      source: "USGS Scientific Investigations Map 3464 (Sun & Stack, 2020)",
    },
    {
      id: "mro_crism_jezero",
      label: "MRO CRISM MTRDR Archive Reference (FRT00005C5E)",
      provenance: "empirical",
      source: "NASA PDS Geosciences Node",
    },
    {
      id: "perseverance_meda_surface",
      label: "Mars 2020 MEDA Environmental Reference & Perseverance Mastcam-Z / Navcam",
      provenance: "empirical",
      source: "NASA PDS Atmospheres & Imaging Nodes",
    },
  ],
  telemetry: {
    atmosphericPressure: "simulated",
    ambientTemperature: "simulated",
    dustOpacity: "simulated",
    visibility: "simulated",
    wind: "simulated",
    radiation: "simulated",
    note: "Surface elevation & slope are derived directly from the NASA/USGS CTX 20 m DEM. Atmospheric & PLSS suit values are simulated EVA scenarios anchored to Mars 2020 MEDA baseline ranges.",
  },
  sampleIdPrefix: "JZ-EVA",
  defaultObservationDatasetId: "hirise_jezero_dtm",
  simulatorEntryUrl: "/src/simulator/jezero_crater/scripts/jezero-simulator.html",
};

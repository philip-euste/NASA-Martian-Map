// frontend/src/simulator/environments/gale.ts
//
// Environment configuration for Gale Crater (Mars Science Laboratory Curiosity
// landing site & Aeolis Mons / Mount Sharp). All coordinates, bounds, DEM
// parameters, and dataset references match authentic NASA PDS MOLA 128 ppd
// topography in /public/gale and MSL REMS telemetry.

import type { SimulatorEnvironmentConfig } from "../shared/environment";

export const GALE_ENVIRONMENT: SimulatorEnvironmentConfig = {
  id: "gale-crater",
  status: "available",
  displayName: "Gale Crater (Mount Sharp / Aeolis Mons)",
  shortName: "Gale",
  coordinateReference: {
    body: "Mars",
    meanRadiusMeters: 3_389_500,
    latitudeType: "planetocentric",
    longitudeDirection: "east",
    notes:
      "IAU 2000 planetocentric coordinates (°N, °E); elevations referenced to MOLA aeroid datum.",
  },
  bounds: {
    westLonDeg: 136.9,
    eastLonDeg: 138.6,
    southLatDeg: -5.9,
    northLatDeg: -4.4,
  },
  defaultBase: {
    id: "bradbury-landing",
    name: "Bradbury Landing (Habitat / MSL Base)",
    latitude: -4.5895,
    longitude: 137.4417,
    description:
      "Curiosity rover landing site (Sol 0) and primary simulated EVA operations base.",
  },
  landmarks: [
    {
      id: "bradbury-landing",
      name: "Bradbury Landing Base",
      latitude: -4.5895,
      longitude: 137.4417,
      description: "MSL Curiosity touchdown location on the northern crater floor.",
    },
    {
      id: "yellowknife-bay",
      name: "Yellowknife Bay Mudstone Outcrop",
      latitude: -4.591,
      longitude: 137.448,
      description:
        "Lacustrine mudstone deposit confirming ancient habitable lake environment.",
    },
    {
      id: "bagnold-dunes",
      name: "Bagnold Dunes Active Field",
      latitude: -4.745,
      longitude: 137.385,
      description:
        "Active basaltic sand dune field skirting the northwestern base of Mount Sharp.",
    },
    {
      id: "vera-rubin-ridge",
      name: "Vera Rubin Ridge (Hematite Unit)",
      latitude: -4.725,
      longitude: 137.362,
      description:
        "Prominent erosional ridge bearing crystalline gray hematite spectral signatures.",
    },
    {
      id: "mount-sharp-base",
      name: "Mount Sharp (Aeolis Mons) Northern Flank",
      latitude: -5.08,
      longitude: 137.85,
      description:
        "Central sedimentary mound rising >5 km above the northern crater floor.",
    },
  ],
  fieldSites: [
    {
      id: "bradbury-landing",
      name: "Bradbury Landing (Habitat Base)",
      latitude: -4.5895,
      longitude: 137.4417,
      description: "Curiosity touchdown point and base habitat station.",
    },
    {
      id: "yellowknife-bay",
      name: "Yellowknife Bay Outcrops (Sheepbed Member)",
      latitude: -4.591,
      longitude: 137.448,
      description: "Smectite-rich mudstone drilled by Curiosity at John Klein & Cumberland.",
    },
    {
      id: "vera-rubin-ridge",
      name: "Vera Rubin Ridge Escarpment",
      latitude: -4.725,
      longitude: 137.362,
      description: "Resistant ridge with layered lacustrine-to-aeolian transition strata.",
    },
    {
      id: "mount-sharp-base",
      name: "Aeolis Mons Lower Sulfate Unit",
      latitude: -5.08,
      longitude: 137.85,
      description: "Hydrated magnesium and calcium sulfate-bearing strata of Mount Sharp.",
    },
  ],
  terrain: {
    format: "tiled-u16-dem",
    baseUrl: "/gale/",
    demProduct: "MGS MOLA 128 ppd Topography (MEGT00N090HB.IMG)",
    demResolutionMeters: 463,
    imageryProduct: "MOLA Topographic Derived Hillshade (Photometric Relief, Not Optical Imagery)",
    credit:
      "NASA / PDS Geosciences Node / MGS MOLA Science Team (Smith et al., 2003)",
  },
  atmosphere: {
    skyColor: 0xc49b78,
    terrainTint: 0xd88a58,
    fogNearMeters: 4000,
    fogFarMeters: 35000,
    dustStorm: {
      skyColor: 0x985532,
      fogNearMeters: 250,
      fogFarMeters: 3000,
    },
    sunDirection: [-0.65, 0.5, -0.4],
  },
  hazards: {
    slopeCautionDeg: 12,
    slopeHazardDeg: 18,
    notes:
      "Steep slopes on Mount Sharp scarp and Vera Rubin Ridge exceed rover traction and suited astronaut traverse limits.",
  },
  datasets: [
    {
      id: "mgs_mola_gale",
      label: "MGS MOLA 128 ppd High-Resolution Topographic Model",
      provenance: "empirical",
      source: "NASA PDS Geosciences Node (Smith et al., 2003)",
    },
    {
      id: "msl_rems_env",
      label: "Curiosity Rover REMS Environmental Monitoring Station Telemetry",
      provenance: "empirical",
      source: "NASA PDS Atmospheres Node (Gómez-Elvira et al., 2012)",
    },
  ],
  telemetry: {
    atmosphericPressure: "empirical",
    ambientTemperature: "empirical",
    dustOpacity: "simulated",
    visibility: "simulated",
    wind: "simulated",
    radiation: "simulated",
    note: "Surface elevation & slope are derived directly from NASA MGS MOLA 128 ppd DEM (463 m/px native resolution). Surface texture is a photometric hillshade derived from the DEM (not optical orbital photography). Atmospheric data backed by Curiosity REMS daily telemetry.",
  },
  sampleIdPrefix: "GL-EVA",
  defaultObservationDatasetId: "mgs_mola_gale",
  simulatorEntryUrl: "/src/simulator/gale_crater/scripts/gale-simulator.html",
};

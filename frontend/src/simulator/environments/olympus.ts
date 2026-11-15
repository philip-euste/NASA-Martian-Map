// frontend/src/simulator/environments/olympus.ts
//
// Environment configuration for Olympus Mons (Summit Caldera Complex — the
// tallest planetary volcanic shield in the Solar System). All coordinates, bounds,
// DEM parameters, and dataset references match authentic NASA PDS MOLA 128 ppd
// topography in /public/olympus.

import type { SimulatorEnvironmentConfig } from "../shared/environment";

export const OLYMPUS_ENVIRONMENT: SimulatorEnvironmentConfig = {
  id: "olympus-mons",
  status: "available",
  displayName: "Olympus Mons (Summit Caldera)",
  shortName: "Olympus",
  coordinateReference: {
    body: "Mars",
    meanRadiusMeters: 3_389_500,
    latitudeType: "planetocentric",
    longitudeDirection: "east",
    notes:
      "IAU 2000 planetocentric coordinates (°N, °E); elevations referenced to MOLA aeroid datum.",
  },
  bounds: {
    westLonDeg: 224.5,
    eastLonDeg: 228.0,
    southLatDeg: 17.0,
    northLatDeg: 20.2,
  },
  defaultBase: {
    id: "caldera-floor-base",
    name: "Olympus Caldera Expedition Base (Habitat Base)",
    latitude: 18.65,
    longitude: 226.2,
    description:
      "High-altitude summit research station established on the central caldera floor at 18.6 km elevation.",
  },
  landmarks: [
    {
      id: "caldera-floor-base",
      name: "Olympus Caldera Expedition Base",
      latitude: 18.65,
      longitude: 226.2,
      description: "Primary caldera research habitat and high-altitude EVA airlock.",
    },
    {
      id: "south-rim-peak",
      name: "Southern Caldera Rim Crest (+21,247 m)",
      latitude: 18.15,
      longitude: 226.1,
      description:
        "Highest topographic point on Mars, towering 21.2 km above the aeroid datum.",
    },
    {
      id: "central-pit-crater",
      name: "Nested Central Collapse Pit",
      latitude: 18.45,
      longitude: 226.55,
      description:
        "Youngest nested caldera collapse depression plunging ~2.5 km into the magma chamber.",
    },
    {
      id: "north-caldera-wall",
      name: "Northern Caldera Boundary Fault",
      latitude: 18.95,
      longitude: 226.15,
      description: "Extensional step faults and ring graben bounding the summit plateau.",
    },
    {
      id: "shield-flank-flow",
      name: "Upper Shield Basaltic Flow Channels",
      latitude: 19.4,
      longitude: 225.5,
      description: "Lava channels and levees descending the northern flank.",
    },
  ],
  fieldSites: [
    {
      id: "caldera-floor-base",
      name: "Olympus Caldera Central Floor",
      latitude: 18.65,
      longitude: 226.2,
      description: "Expedition habitat base.",
    },
    {
      id: "south-rim-peak",
      name: "Summit Rim Pinnacle Outcrop",
      latitude: 18.15,
      longitude: 226.1,
      description: "Solar System's highest geological outcrop.",
    },
    {
      id: "central-pit-crater",
      name: "Nested Pit Crater Terrace",
      latitude: 18.45,
      longitude: 226.55,
      description: "Exposed vertical stratigraphy of successive basaltic lava sheets.",
    },
    {
      id: "shield-flank-flow",
      name: "Northern Flank Basalt Levee",
      latitude: 19.4,
      longitude: 225.5,
      description: "Tholeiitic basalt flow fronts and pahoehoe-like surface crusts.",
    },
  ],
  terrain: {
    format: "tiled-u16-dem",
    baseUrl: "/olympus/",
    demProduct: "MGS MOLA 128 ppd Topography (MEGT44N180HB.IMG)",
    demResolutionMeters: 463,
    imageryProduct: "MOLA Topographic Derived Hillshade (Photometric Relief, Not Optical Imagery)",
    credit:
      "NASA / PDS Geosciences Node / MGS MOLA Science Team (Smith et al., 2003)",
  },
  atmosphere: {
    skyColor: 0x383042,
    terrainTint: 0xb56545,
    fogNearMeters: 15000,
    fogFarMeters: 80000,
    dustStorm: {
      skyColor: 0x5a3b30,
      fogNearMeters: 2000,
      fogFarMeters: 12000,
    },
    sunDirection: [-0.6, 0.65, -0.3],
  },
  hazards: {
    slopeCautionDeg: 12,
    slopeHazardDeg: 20,
    notes:
      "Caldera rim collapse scarps (up to 3.4 km vertical drop) and extreme near-vacuum atmospheric pressure (< 70 Pa).",
  },
  datasets: [
    {
      id: "mgs_mola_olympus",
      label: "MGS MOLA 128 ppd High-Resolution Topographic Model",
      provenance: "empirical",
      source: "NASA PDS Geosciences Node (Smith et al., 2003)",
    },
  ],
  telemetry: {
    atmosphericPressure: "unavailable",
    ambientTemperature: "unavailable",
    dustOpacity: "unavailable",
    visibility: "unavailable",
    wind: "unavailable",
    radiation: "unavailable",
    note: "Surface elevation & slope derived from MGS MOLA 128 ppd DEM (463 m/px native resolution). Surface texture is a photometric hillshade derived from the DEM (not optical orbital photography). Summit reaches 21,247 m elevation with near-vacuum atmospheric pressure (~50–80 Pa).",
  },
  sampleIdPrefix: "OM-EVA",
  defaultObservationDatasetId: "mgs_mola_olympus",
  simulatorEntryUrl: "/src/simulator/olympus_mons/scripts/olympus-simulator.html",
};

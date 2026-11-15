// frontend/src/simulator/environments/valles.ts
//
// Environment configuration for Valles Marineris (Melas Chasma — the deepest
// central canyon system of Mars). All coordinates, bounds, DEM parameters,
// and dataset references match authentic NASA PDS MOLA 128 ppd topography
// in /public/valles.

import type { SimulatorEnvironmentConfig } from "../shared/environment";

export const VALLES_ENVIRONMENT: SimulatorEnvironmentConfig = {
  id: "valles-marineris",
  status: "available",
  displayName: "Valles Marineris (Melas Chasma)",
  shortName: "Valles",
  coordinateReference: {
    body: "Mars",
    meanRadiusMeters: 3_389_500,
    latitudeType: "planetocentric",
    longitudeDirection: "east",
    notes:
      "IAU 2000 planetocentric coordinates (°N, °E); elevations referenced to MOLA aeroid datum.",
  },
  bounds: {
    westLonDeg: 281.5,
    eastLonDeg: 285.8,
    southLatDeg: -11.5,
    northLatDeg: -8.0,
  },
  defaultBase: {
    id: "melas-chasma-base",
    name: "Melas Chasma Floor Base (Habitat Base)",
    latitude: -9.8,
    longitude: 283.6,
    description:
      "Deep canyon floor expedition habitat located in the central rift depression of Valles Marineris.",
  },
  landmarks: [
    {
      id: "melas-chasma-base",
      name: "Melas Chasma Floor Base",
      latitude: -9.8,
      longitude: 283.6,
      description: "Primary canyon floor habitat and rover deployment station.",
    },
    {
      id: "north-wall-scarp",
      name: "Northern Melas Wall Escarpment",
      latitude: -8.45,
      longitude: 283.2,
      description:
        "Towering fault scarp exhibiting >8,000 meters of vertical stratigraphy.",
    },
    {
      id: "ild-sulfate-mound",
      name: "Interior Layered Deposits (ILD Sulfate Mound)",
      latitude: -9.5,
      longitude: 284.1,
      description:
        "Kilometer-thick light-toned layered deposits rich in hydrated polyhydrated sulfates.",
    },
    {
      id: "deep-floor-trough",
      name: "Melas Chasma Deepest Basin",
      latitude: -10.15,
      longitude: 283.45,
      description:
        "Sub-datum canyon basin at -4,200 m elevation with dense atmospheric column.",
    },
    {
      id: "landslide-apron",
      name: "Catastrophic Wall Collapse Debris Fan",
      latitude: -9.1,
      longitude: 282.8,
      description:
        "Massive sturzstrom landslide deposit spreading across tens of kilometers.",
    },
  ],
  fieldSites: [
    {
      id: "melas-chasma-base",
      name: "Melas Chasma Central Floor Base",
      latitude: -9.8,
      longitude: 283.6,
      description: "Central expedition base camp.",
    },
    {
      id: "ild-sulfate-mound",
      name: "Melas ILD Layered Sulfate Outcrop",
      latitude: -9.5,
      longitude: 284.1,
      description: "Finely laminated sulfate-bearing sedimentary beds.",
    },
    {
      id: "deep-floor-trough",
      name: "Deep Basin Alluvial Fan Floor",
      latitude: -10.15,
      longitude: 283.45,
      description: "Low-elevation canyon sediments at highest Mars ambient air pressure.",
    },
    {
      id: "landslide-apron",
      name: "Wall Scarp Talus & Landslide Hummocks",
      latitude: -9.1,
      longitude: 282.8,
      description: "Mega-breccia blocks and chaotic landslide debris.",
    },
  ],
  terrain: {
    format: "tiled-u16-dem",
    baseUrl: "/valles/",
    demProduct: "MGS MOLA 128 ppd Topography (MEGT00N270HB.IMG)",
    demResolutionMeters: 463,
    imageryProduct: "MOLA Topographic Derived Hillshade (Photometric Relief, Not Optical Imagery)",
    credit:
      "NASA / PDS Geosciences Node / MGS MOLA Science Team (Smith et al., 2003)",
  },
  atmosphere: {
    skyColor: 0xbaa08c,
    terrainTint: 0xc87d55,
    fogNearMeters: 5000,
    fogFarMeters: 50000,
    dustStorm: {
      skyColor: 0x904a25,
      fogNearMeters: 300,
      fogFarMeters: 4000,
    },
    sunDirection: [-0.5, 0.7, -0.4],
  },
  hazards: {
    slopeCautionDeg: 15,
    slopeHazardDeg: 25,
    notes:
      "Canyon wall escarpments exceed 30° slopes with catastrophic rockfall and steep talus hazard.",
  },
  datasets: [
    {
      id: "mgs_mola_valles",
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
    note: "Surface elevation & slope derived from MGS MOLA 128 ppd DEM (463 m/px native resolution). Surface texture is a photometric hillshade derived from the DEM (not optical orbital photography). Canyon floor experiences highest atmospheric pressure on Mars (~950–1050 Pa).",
  },
  sampleIdPrefix: "VM-EVA",
  defaultObservationDatasetId: "mgs_mola_valles",
  simulatorEntryUrl: "/src/simulator/valles_marineris/scripts/valles-simulator.html",
};

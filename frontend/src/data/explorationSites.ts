// frontend/src/data/explorationSites.ts
// Named exploration sites shared by the 3D globe, the 2D map and the
// location information pages.
//
// name / latitude / longitude / description were moved unchanged from
// src/globe/MarsGlobe.tsx (LOCATIONS). regionLabel, terrainType and
// significance are short, publicly documented context and should be
// reviewed by the science team. No measurements are hard-coded here:
// elevation is requested from the terrain API at runtime.
//
// images: intentionally empty until the team supplies licensed imagery
// (see frontend/public/images/locations/README.md).

export interface SiteImage {
  /** Path under /public, e.g. "/images/locations/jezero-crater/surface.jpg" */
  src: string;
  caption: string;
  credit: string;
}

export interface ExplorationSite {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description: string;
  regionLabel: string;
  terrainType: string;
  significance?: string;
  images: SiteImage[];
}

export const EXPLORATION_SITES: ExplorationSite[] = [
  {
    id: "jezero-crater",
    name: "Jezero Crater",
    latitude: 18.4,
    longitude: 77.5,
    description: "Ancient lake basin and Perseverance rover exploration site.",
    regionLabel: "Isidis Planitia",
    terrainType: "Impact crater",
    significance:
      "Landing site of NASA's Perseverance rover (Mars 2020), which studies the crater's ancient river delta and collects rock samples for possible return to Earth.",
    images: [],
  },
  {
    id: "gale-crater",
    name: "Gale Crater",
    latitude: -5.4,
    longitude: 137.8,
    description: "Exploration region of the Curiosity rover.",
    regionLabel: "Aeolis",
    terrainType: "Impact crater",
    significance:
      "NASA's Curiosity rover has explored Gale since 2012, studying the layered sediments of Aeolis Mons (Mount Sharp) for evidence of past habitable environments.",
    images: [],
  },
  {
    id: "valles-marineris",
    name: "Valles Marineris",
    latitude: -9.8,
    longitude: 283.6,
    description: "A vast canyon system near the Martian equator.",
    regionLabel: "Equatorial Mars",
    terrainType: "Canyon system",
    significance:
      "Its steep walls expose thick layered rock sequences that record a long span of Martian geological history.",
    images: [],
  },
  {
    id: "olympus-mons",
    name: "Olympus Mons",
    latitude: 18.65,
    longitude: -133.8,
    description: "One of the largest volcanoes in the Solar System.",
    regionLabel: "Tharsis",
    terrainType: "Shield volcano",
    significance:
      "Its scale and extensive lava flows inform models of Martian volcanism and the planet's thermal history.",
    images: [],
  },
];

export function getSiteById(id: string | undefined): ExplorationSite | undefined {
  return EXPLORATION_SITES.find((site) => site.id === id);
}

export function getSiteByName(name: string): ExplorationSite | undefined {
  return EXPLORATION_SITES.find((site) => site.name === name);
}

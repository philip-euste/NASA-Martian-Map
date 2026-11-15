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
// Images are locally stored NASA orbital products so location pages work offline.

export interface SiteImage {
  /** Path under /public, e.g. "/images/locations/jezero-crater/surface.jpg" */
  src: string;
  caption: string;
  credit: string;
  sourceUrl: string;
  title: string;
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
    images: [{ src: "/images/locations/jezero-crater.jpg", caption: "MRO CRISM and CTX view of Jezero Crater and its delta", title: "Jezero Crater, Mars 2020's Landing Site", credit: "NASA/JPL-Caltech/MSSS/JHU-APL", sourceUrl: "https://science.nasa.gov/photojournal/jezero-crater-mars-2020s-landing-site/" }],
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
    images: [{ src: "/images/locations/gale-crater.jpg", caption: "False-color Mars Odyssey THEMIS orbital mosaic of Gale Crater", title: "Gale Crater's Surface Materials", credit: "NASA/JPL-Caltech/ASU", sourceUrl: "https://science.nasa.gov/photojournal/gale-craters-surface-materials/" }],
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
    images: [{ src: "/images/locations/valles-marineris.jpg", caption: "Viking Orbiter mosaic of Valles Marineris", title: "Valles Marineris Hemisphere", credit: "NASA/JPL/USGS", sourceUrl: "https://science.nasa.gov/photojournal/valles-marineris-hemisphere/" }],
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
    images: [{ src: "/images/locations/olympus-mons.jpg", caption: "Viking 1 Orbiter color mosaic of Olympus Mons", title: "Color Mosaic of Olympus Mons", credit: "NASA/JPL", sourceUrl: "https://science.nasa.gov/photojournal/color-mosaic-of-olympus-mons/" }],
  },
];

export function getSiteById(id: string | undefined): ExplorationSite | undefined {
  return EXPLORATION_SITES.find((site) => site.id === id);
}

export function getSiteByName(name: string): ExplorationSite | undefined {
  return EXPLORATION_SITES.find((site) => site.name === name);
}

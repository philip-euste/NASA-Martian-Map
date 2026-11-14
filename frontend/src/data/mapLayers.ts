// frontend\src\data\mapLayers.ts

export type MapLayerCategory =
  | "basemap"
  | "elevation"
  | "geology"
  | "composition"
  | "atmosphere"
  | "thermal";

export interface MapLayer {
  id: string;
  name: string;
  description: string;
  provider: "nasaTrek";
  category: MapLayerCategory;
  coverage: "global";
  center: [number, number];
  zoom: number;
}

export const MAP_LAYERS = {
  // BASEMAPS

  mars_global_mola: {
    id: "mars_global_mola",
    name: "MOLA Global Hillshade",
    description: "Global shaded-relief terrain visualization.",
    provider: "nasaTrek",
    category: "basemap",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
  },

  mars_viking_global: {
    id: "mars_viking_global",
    name: "Viking Global Color Mosaic",
    description: "Global visible-light surface mosaic from the Viking orbiters.",
    provider: "nasaTrek",
    category: "basemap",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
  },

  mars_moc_atlas: {
    id: "mars_moc_atlas",
    name: "MGS MOC Global Atlas",
    description: "Global Mars Orbiter Camera image atlas.",
    provider: "nasaTrek",
    category: "basemap",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
  },

  mars_mola_hrsc_color: {
    id: "mars_mola_hrsc_color",
    name: "MOLA + HRSC Color Blend",
    description: "Combined MOLA elevation and HRSC color visualization.",
    provider: "nasaTrek",
    category: "elevation",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
  },

  mars_mola_hrsc_hillshade: {
    id: "mars_mola_hrsc_hillshade",
    name: "MOLA + HRSC Hillshade",
    description: "Combined global elevation and shaded-relief visualization.",
    provider: "nasaTrek",
    category: "elevation",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
  },

  // ELEVATION AND TERRAIN

  mars_mola_roughness: {
    id: "mars_mola_roughness",
    name: "MOLA Surface Roughness",
    description: "Global surface roughness visualization.",
    provider: "nasaTrek",
    category: "elevation",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
  },

  // TES SCIENTIFIC LAYERS

  mars_tes_dust: {
    id: "mars_tes_dust",
    name: "TES Global Dust",
    description: "Global dust-related surface observations.",
    provider: "nasaTrek",
    category: "atmosphere",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
  },

  mars_tes_dust_index: {
    id: "mars_tes_dust_index",
    name: "TES Dust Cover Index",
    description: "Global dust cover index derived from TES observations.",
    provider: "nasaTrek",
    category: "atmosphere",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
  },

  mars_tes_thermal: {
    id: "mars_tes_thermal",
    name: "TES Thermal Inertia",
    description: "Global thermal inertia visualization.",
    provider: "nasaTrek",
    category: "thermal",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
  },

  mars_tes_pyroxene: {
    id: "mars_tes_pyroxene",
    name: "TES High-Ca Pyroxene",
    description: "Global high-calcium pyroxene abundance.",
    provider: "nasaTrek",
    category: "composition",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
  },

  mars_tes_plagioclase: {
    id: "mars_tes_plagioclase",
    name: "TES Plagioclase",
    description: "Global plagioclase abundance.",
    provider: "nasaTrek",
    category: "composition",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
  },

  mars_tes_silicates: {
    id: "mars_tes_silicates",
    name: "TES Sheet Silicates / High-Si Glass",
    description: "Global sheet silicate and high-silica glass abundance.",
    provider: "nasaTrek",
    category: "composition",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
  },

  mars_tes_albedo: {
    id: "mars_tes_albedo",
    name: "TES Surface Albedo",
    description: "Global surface albedo observations.",
    provider: "nasaTrek",
    category: "thermal",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
  },

  // THEMIS INFRARED IMAGERY

  mars_themis_day: {
    id: "mars_themis_day",
    name: "THEMIS Daytime Infrared",
    description: "Global daytime infrared mosaic from Mars Odyssey.",
    provider: "nasaTrek",
    category: "thermal",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
  },

  mars_themis_night: {
    id: "mars_themis_night",
    name: "THEMIS Nighttime Infrared",
    description: "Global nighttime infrared mosaic from Mars Odyssey.",
    provider: "nasaTrek",
    category: "thermal",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
  },
} satisfies Record<string, MapLayer>;

export type MapLayerId = keyof typeof MAP_LAYERS;

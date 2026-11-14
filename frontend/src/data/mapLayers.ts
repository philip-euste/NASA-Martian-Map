// frontend/src/data/mapLayers.ts
// Catalog #1: Map Layer Catalog (Masterplan Phase 2, Task T-2.1).
//
// Purpose: Visualizing Mars and providing geographic context on the 3D Mars Globe,
// 2D Regional Map (`MarsMap.tsx`), and Route Planner (`RouteMap.tsx`).
//
// Architectural Boundary:
// These layers are visualization products and global WMTS display mosaics.
// They do NOT automatically become empirical scientific evidence sources in
// `InvestigationPage.tsx` — empirical evidence datasets are governed separately
// by `frontend/src/data/evidenceDatasets.ts` (Catalog #2).

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
  /** Identifies whether this layer is strictly a visualization basemap/hillshade. */
  visualizationOnly?: boolean;
}

export const MAP_LAYERS = {
  // BASEMAPS & SHADED-RELIEF VISUALIZATIONS

  mars_global_mola: {
    id: "mars_global_mola",
    name: "MOLA Global Hillshade",
    description:
      "Global shaded-relief terrain visualization derived from MGS MOLA altimetry (463 m/px display mosaic).",
    provider: "nasaTrek",
    category: "basemap",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: true,
  },

  mars_viking_global: {
    id: "mars_viking_global",
    name: "Viking Global Color Mosaic",
    description:
      "Global visible-light surface mosaic from the Viking Orbiter MDIM 2.1 archive (232 m/px).",
    provider: "nasaTrek",
    category: "basemap",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: true,
  },

  mars_moc_atlas: {
    id: "mars_moc_atlas",
    name: "MGS MOC Global Atlas",
    description:
      "Global Mars Orbiter Camera wide-angle visible image atlas for regional context.",
    provider: "nasaTrek",
    category: "basemap",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: true,
  },

  mars_mola_hrsc_color: {
    id: "mars_mola_hrsc_color",
    name: "MOLA + HRSC Color Blend",
    description:
      "Blended MGS MOLA and Mars Express HRSC color-coded shaded relief visualization (200 m/px).",
    provider: "nasaTrek",
    category: "elevation",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: true,
  },

  mars_mola_hrsc_hillshade: {
    id: "mars_mola_hrsc_hillshade",
    name: "MOLA + HRSC Hillshade",
    description:
      "Combined global MOLA and HRSC grayscale shaded-relief visualization (200 m/px).",
    provider: "nasaTrek",
    category: "elevation",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: true,
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
    visualizationOnly: false,
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
    visualizationOnly: false,
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
    visualizationOnly: false,
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
    visualizationOnly: false,
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
    visualizationOnly: false,
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
    visualizationOnly: false,
  },

  mars_tes_silicates: {
    id: "mars_tes_silicates",
    name: "TES Sheet Silicates / High-Si Glass",
    description:
      "Global high-silica glass / sheet silicate thermal IR deconvolution overlay.",
    provider: "nasaTrek",
    category: "composition",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: false,
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
    visualizationOnly: false,
  },

  // THEMIS INFRARED IMAGERY OVERLAYS

  mars_themis_day: {
    id: "mars_themis_day",
    name: "THEMIS Daytime Infrared",
    description:
      "Global daytime thermal infrared mosaic from 2001 Mars Odyssey (100 m/px).",
    provider: "nasaTrek",
    category: "thermal",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: false,
  },

  mars_themis_night: {
    id: "mars_themis_night",
    name: "THEMIS Nighttime Infrared",
    description:
      "Global nighttime thermal infrared mosaic from 2001 Mars Odyssey (100 m/px).",
    provider: "nasaTrek",
    category: "thermal",
    coverage: "global",
    center: [0, 0],
    zoom: 1,
    visualizationOnly: false,
  },
} satisfies Record<string, MapLayer>;

export type MapLayerId = keyof typeof MAP_LAYERS;

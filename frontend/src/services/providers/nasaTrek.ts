import type {
  TileLayerConfig,
  TileMatrixLevel,
  DataProvider,
} from "../dataProviders";

import type { MapLayerId } from "../../data/mapLayers";

const BASE_URL = "https://trek.nasa.gov/tiles/Mars/EQ";

interface NasaLayerDefinition {
  id: string;
  static?: boolean;
  tileUrlTemplate?: string;
  zoomOffset?: number;
}

const NASA_LAYERS: Record<MapLayerId, NasaLayerDefinition> = {
  // BASEMAPS

  mars_global_mola: {
    id: "Mars_MGS_MOLA_ClrShade_merge_global_463m",
    static: true,
    tileUrlTemplate:
      `${BASE_URL}/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`,
    zoomOffset: -1,
  },

  mars_viking_global: {
    id: "Mars_Viking_MDIM21_ClrMosaic_global_232m",
  },

  mars_moc_atlas: {
    id: "msss_atlas_simp_clon",
  },

  mars_mola_hrsc_color: {
    id: "Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw",
  },

  mars_mola_hrsc_hillshade: {
    id: "Mars_MOLA_blend200ppx_HRSC_Shade_clon0dd_200mpp_lzw",
  },

  // ELEVATION AND TERRAIN

  mars_mola_roughness: {
    id: "mola_roughness",
  },

  // TES SCIENTIFIC LAYERS

  mars_tes_dust: {
    id: "TES_Dust",
  },

  mars_tes_dust_index: {
    id: "tes_ruffdust",
  },

  mars_tes_thermal: {
    id: "TES_Thermal_Inertia",
  },

  mars_tes_pyroxene: {
    id: "TES_Clinopyroxene",
  },

  mars_tes_plagioclase: {
    id: "TES_Plagioclase",
  },

  mars_tes_silicates: {
    id: "TES_Glass_Clay",
  },

  mars_tes_albedo: {
    id: "Mars_MGS_TES_Albedo_mosaic_global_7410m",
  },

  // THEMIS INFRARED IMAGERY

  mars_themis_day: {
    id: "THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018",
  },

  mars_themis_night: {
    id: "THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018",
  },
};

function getText(
  element: Element | Document | null,
  name: string
): string | undefined {
  return element
    ?.getElementsByTagNameNS("*", name)[0]
    ?.textContent
    ?.trim();
}

function getElements(
  element: Element | Document,
  name: string
): Element[] {
  return Array.from(
    element.getElementsByTagNameNS("*", name)
  );
}

function getNumber(
  element: Element,
  name: string
): number {
  const value = Number(getText(element, name));

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid WMTS value: ${name}`);
  }

  return value;
}

function getTopLeftCoordinates(
  element: Element,
  supportedCRS: string
): { x: number; y: number } {
  const raw = getText(element, "TopLeftCorner");

  if (!raw) {
    throw new Error("Missing WMTS TopLeftCorner.");
  }

  const coordinates = raw
    .split(/\s+/)
    .map(Number);

  if (
    coordinates.length < 2 ||
    !coordinates.every(Number.isFinite)
  ) {
    throw new Error("Invalid WMTS TopLeftCorner.");
  }

  const crs = supportedCRS.toLowerCase();

  // EPSG:4326 has latitude/longitude axis order.
  // CRS84 uses longitude/latitude axis order.
  const isEPSG4326 =
    crs.includes("4326") &&
    !crs.includes("crs84");

  const [x, y] = isEPSG4326
    ? [coordinates[1], coordinates[0]]
    : [coordinates[0], coordinates[1]];

  // This globe renderer currently expects geographic degrees.
  if (
    Math.abs(x) > 360 ||
    Math.abs(y) > 180
  ) {
    throw new Error(
      `Unsupported WMTS coordinate system: ${supportedCRS}`
    );
  }

  return { x, y };
}

function getMolaFallback(): TileLayerConfig {
  return {
    tileUrlTemplate:
      NASA_LAYERS.mars_global_mola.tileUrlTemplate!,
    zoomOffset: -1,
    attribution: "NASA Mars Trek",
    matrixSet: "MOLA fallback",
    supportedCRS: "CRS84",
    matrixIds: ["0"],
    matrixLevels: [
      {
        id: "0",
        matrixWidth: 2,
        matrixHeight: 1,
        tileWidth: 256,
        tileHeight: 256,
        scaleDenominator: 1,
        topLeftX: -180,
        topLeftY: 90,
      },
    ],
  };
}

async function fetchCapabilities(
  layer: NasaLayerDefinition
): Promise<TileLayerConfig> {
  const url =
    `${BASE_URL}/${layer.id}/1.0.0/WMTSCapabilities.xml`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `NASA HTTP ${response.status}: ${layer.id}`
    );
  }

  const xmlText = await response.text();

  const xml = new DOMParser().parseFromString(
    xmlText,
    "application/xml"
  );

  if (xml.querySelector("parsererror")) {
    throw new Error("Invalid NASA WMTS XML.");
  }

  const matchingLayer = getElements(xml, "Layer").find(
    (item) => getText(item, "Identifier") === layer.id
  );

  if (!matchingLayer) {
    throw new Error(
      `Layer identifier not found: ${layer.id}`
    );
  }

  const styles = getElements(matchingLayer, "Style");

  const style =
    styles.find((item) =>
      ["true", "1"].includes(
        item.getAttribute("isDefault") ?? ""
      )
    ) ?? styles[0];

  const styleId = style
    ? getText(style, "Identifier")
    : undefined;

  if (!styleId) {
    throw new Error("No valid WMTS style found.");
  }

  const tileMatrixSetLink = getElements(
    matchingLayer,
    "TileMatrixSetLink"
  )[0];

  const matrixSetId = tileMatrixSetLink
    ? getText(tileMatrixSetLink, "TileMatrixSet")
    : undefined;

  if (!matrixSetId) {
    throw new Error("No tile matrix set reference found.");
  }

  const matrixSetDefinition = getElements(
    xml,
    "TileMatrixSet"
  ).find(
    (item) =>
      getText(item, "Identifier") === matrixSetId &&
      getElements(item, "TileMatrix").length > 0
  );

  if (!matrixSetDefinition) {
    throw new Error(
      `Matrix set definition not found: ${matrixSetId}`
    );
  }

  const supportedCRS =
    getText(matrixSetDefinition, "SupportedCRS");

  if (!supportedCRS) {
    throw new Error("WMTS matrix set has no SupportedCRS.");
  }

  const matrixElements = getElements(
    matrixSetDefinition,
    "TileMatrix"
  );

  const matrixLevels: TileMatrixLevel[] =
    matrixElements
      .map((item) => {
        const identifier = getText(item, "Identifier");

        if (!identifier) {
          throw new Error("Tile matrix has no identifier.");
        }

        const topLeft = getTopLeftCoordinates(
          item,
          supportedCRS
        );

        return {
          id: identifier,
          matrixWidth: getNumber(item, "MatrixWidth"),
          matrixHeight: getNumber(item, "MatrixHeight"),
          tileWidth: getNumber(item, "TileWidth"),
          tileHeight: getNumber(item, "TileHeight"),
          scaleDenominator: getNumber(
            item,
            "ScaleDenominator"
          ),
          topLeftX: topLeft.x,
          topLeftY: topLeft.y,
        };
      })
      .sort(
        (a, b) =>
          b.scaleDenominator - a.scaleDenominator
      );

  if (matrixLevels.length === 0) {
    throw new Error("No tile matrix levels found.");
  }

  const resources = getElements(
    matchingLayer,
    "ResourceURL"
  );

  const tileResource = resources.find(
    (item) => item.getAttribute("resourceType") === "tile"
  );

  const advertisedTemplate =
    tileResource?.getAttribute("template");

  const template =
    layer.static && layer.tileUrlTemplate
      ? layer.tileUrlTemplate
      : advertisedTemplate;

  if (!template) {
    throw new Error("No WMTS tile URL template found.");
  }

  const resolvedTileUrl = template
    .replaceAll("{Style}", styleId)
    .replaceAll("{TileMatrixSet}", matrixSetId)
    .replaceAll("{TileMatrix}", "{z}")
    .replaceAll("{TileRow}", "{y}")
    .replaceAll("{TileCol}", "{x}");

  return {
    tileUrlTemplate: resolvedTileUrl,
    zoomOffset: layer.zoomOffset ?? -1,
    attribution: "NASA Mars Trek",
    matrixSet: matrixSetId,
    supportedCRS,
    style: styleId,
    matrixIds: matrixLevels.map(
      (level) => level.id
    ),
    matrixLevels,
  };
}

export const nasaTrekProvider: DataProvider = {
  id: "nasaTrek",

  getAvailableLayers(): string[] {
    return Object.keys(NASA_LAYERS);
  },

  async getLayerConfig(
    layerId: string
  ): Promise<TileLayerConfig> {
    const layer = NASA_LAYERS[layerId as MapLayerId];

    if (!layer) {
      throw new Error(`Unknown NASA layer: ${layerId}`);
    }

    try {
      return await fetchCapabilities(layer);
    } catch (error) {
      if (
        layer.static &&
        layer.tileUrlTemplate
      ) {
        console.warn(
          "NASA capabilities unavailable; using static MOLA fallback.",
          error
        );

        return getMolaFallback();
      }

      throw error;
    }
  },
};
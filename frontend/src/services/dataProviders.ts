import { nasaTrekProvider } from "./providers/nasaTrek";

export interface TileMatrixLevel {
  id: string;
  matrixWidth: number;
  matrixHeight: number;
  tileWidth: number;
  tileHeight: number;
  scaleDenominator: number;
  topLeftX: number;
  topLeftY: number;
}

export interface TileLayerConfig {
  tileUrlTemplate: string;
  zoomOffset: number;
  attribution: string;
  matrixSet?: string;
  supportedCRS?: string;
  style?: string;
  matrixIds?: string[];
  matrixLevels?: TileMatrixLevel[];
  isFallbackConfig?: boolean;
}

export interface DataProvider {
  id: string;

  getAvailableLayers(): string[];

  getLayerConfig(
    layerId: string,
    options?: { forceRetry?: boolean }
  ): Promise<TileLayerConfig>;

  clearLayerCache?(layerId?: string): void;
}

const DATA_PROVIDERS = {
  nasaTrek: nasaTrekProvider,
} satisfies Record<string, DataProvider>;

export type DataProviderId = keyof typeof DATA_PROVIDERS;

export function getDataProvider(providerId: DataProviderId): DataProvider {
  const provider = DATA_PROVIDERS[providerId];

  if (!provider) {
    throw new Error(`Data provider not found: ${providerId}`);
  }

  return provider;
}

export function getAvailableProviders(): DataProviderId[] {
  return Object.keys(DATA_PROVIDERS) as DataProviderId[];
}

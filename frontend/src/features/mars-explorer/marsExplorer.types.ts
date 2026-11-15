import type { ExplorationSite } from "../../data/explorationSites";
import type { GeologicalFeature } from "../../data/geologicalFeatures";
import type { MapLayerId } from "../../data/mapLayers";
import type { TileLayerConfig } from "../../services/dataProviders";
import type { DemElevation } from "../../services/providers/marsDem";
import type { Coordinates, TemporalMode, TemporalState } from "../../types";

export type ExplorerViewMode = "globe" | "map" | "jezero";
export type ExplorerNavigationAction = "zoom-in" | "zoom-out" | "reset";

export type StudyRegionId =
  | "jezero"
  | "gale"
  | "valles-marineris"
  | "olympus-mons";

export const STUDY_REGIONS: Record<
  StudyRegionId,
  {
    id: StudyRegionId;
    name: string;
    category: string;
    center: Coordinates;
  }
> = {
  jezero: {
    id: "jezero",
    name: "Jezero Crater",
    category: "Impact Crater",
    center: { latitude: 18.41, longitude: 77.69 },
  },
  gale: {
    id: "gale",
    name: "Gale Crater",
    category: "Impact Crater",
    center: { latitude: -5.44, longitude: 137.7 },
  },
  "valles-marineris": {
    id: "valles-marineris",
    name: "Valles Marineris",
    category: "Canyon System",
    center: { latitude: -13.74, longitude: -59.2 },
  },
  "olympus-mons": {
    id: "olympus-mons",
    name: "Olympus Mons",
    category: "Shield Volcano",
    center: { latitude: 18.65, longitude: -133.8 },
  },
};

export interface SavedLocation extends Coordinates {
  id: number;
  name: string;
  description?: string;
}

export type SelectedLocationKind = "site" | "saved" | "custom" | "geological";

export interface SelectedExplorerLocation extends Coordinates {
  kind: SelectedLocationKind;
  key: string;
  name: string;
  description: string;
  terrainType?: string;
  regionLabel?: string;
  site?: ExplorationSite;
  geologicalFeature?: GeologicalFeature;
  savedId?: number;
}

export interface TransitionState {
  active: boolean;
  direction: "globe-to-map" | "map-to-globe" | null;
  progress: number;
}

export interface SearchResults {
  sites: ExplorationSite[];
  saved: SavedLocation[];
}

export interface MarsExplorerContextValue {
  viewMode: ExplorerViewMode;
  showGlobeLocations: boolean;
  setShowGlobeLocations: (show: boolean) => void;
  setViewMode: (mode: ExplorerViewMode) => void;
  transitionState: TransitionState;

  selectedStudyRegionId: StudyRegionId;
  setSelectedStudyRegionId: (regionId: StudyRegionId) => void;
  showStudyRegionBoundary: boolean;
  setShowStudyRegionBoundary: (show: boolean) => void;

  selectedLayerId: MapLayerId;
  setSelectedLayerId: (layerId: MapLayerId) => void;
  opacity: number;
  setOpacity: (opacity: number) => void;
  overlayLayerId: MapLayerId | null;
  setOverlayLayerId: (layerId: MapLayerId | null) => void;
  overlayOpacity: number;
  setOverlayOpacity: (opacity: number) => void;
  showGeologyOverlay: boolean;
  setShowGeologyOverlay: (show: boolean) => void;
  geologyOpacity: number;
  setGeologyOpacity: (opacity: number) => void;
  tileConfig: TileLayerConfig | null;
  layerLoading: boolean;
  layerError: string | null;
  retryLayer: () => void;
  textureStatus: string;
  setTextureStatus: (status: string) => void;

  focusCoordinates: Coordinates;
  updateCameraFocus: (coordinates: Coordinates) => void;
  focusRequestVersion: number;
  globeDistance: number;
  setGlobeDistance: (distance: number) => void;
  mapZoom: number;
  setMapZoom: (zoom: number) => void;

  navigationAction: ExplorerNavigationAction | null;
  navigationActionVersion: number;
  requestNavigationAction: (action: ExplorerNavigationAction) => void;

  selectedLocation: SelectedExplorerLocation | null;
  selectSite: (site: ExplorationSite, options?: { focus?: boolean }) => void;
  geologicalFeatures: GeologicalFeature[];
  geologicalLoading: boolean;
  geologicalError: string | null;
  selectGeologicalFeature: (feature: GeologicalFeature, options?: { focus?: boolean }) => void;
  selectCustomCoordinates: (coordinates: Coordinates, options?: { focus?: boolean }) => void;
  goToSavedLocation: (location: SavedLocation, options?: { focus?: boolean }) => void;
  clearSelection: () => void;

  savedLocations: SavedLocation[];
  locationNameDraft: string;
  setLocationNameDraft: (value: string) => void;
  saveSelectedLocation: () => void;
  removeLocation: (id: number) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  searchResults: SearchResults;

  elevation: DemElevation | null;
  elevationLoading: boolean;
  elevationError: string | null;
  retryElevation: () => void;

  temporal: Readonly<TemporalState>;
  todayUTC: string;
  setTemporalMode: (mode: TemporalMode) => void;
  setTemporalDate: (date: string) => void;
  setFutureSolHorizon: (value: string) => void;
  clampFutureSols: () => void;

  statusMessage: string;
  setStatusMessage: (message: string) => void;

  isSelectedRegion: boolean;
  isSelectedTarget: boolean;
  startExpeditionAtSelectedLocation: () => void;
  addSelectedAsTarget: () => void;

  openSelectedInMap: () => void;
  openSelectedInGlobe: () => void;
  triggerZoomInToMap: (focus?: Coordinates) => void;
  triggerZoomOutToGlobe: (focus?: Coordinates) => void;
  resetExplorerView: () => void;
}

export const JEZERO_DEM_BOUNDS = {
  westLonDeg: 76.99,
  eastLonDeg: 78.4935,
  southLatDeg: 17.5805,
  northLatDeg: 19.2902,
} as const;

export const JEZERO_DEFAULT_COORDINATES: Coordinates = {
  latitude: 18.4447,
  longitude: 77.4508,
};

export function normalizeCoordinates(coordinates: Coordinates): Coordinates | null {
  const { latitude, longitude } = coordinates;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    return null;
  }

  const normalizedLongitude =
    (((longitude + 180) % 360) + 360) % 360 - 180;

  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(normalizedLongitude.toFixed(6)),
  };
}

export function sameCoords(
  a: Coordinates | null | undefined,
  b: Coordinates | null | undefined,
  tolerance = 0.0001
): boolean {
  if (!a || !b) return false;

  return (
    Math.abs(a.latitude - b.latitude) <= tolerance &&
    Math.abs(a.longitude - b.longitude) <= tolerance
  );
}

export function isWithinJezeroDemBounds(
  coordinates: Coordinates | null | undefined
): boolean {
  if (!coordinates) return false;

  return (
    coordinates.latitude >= JEZERO_DEM_BOUNDS.southLatDeg &&
    coordinates.latitude <= JEZERO_DEM_BOUNDS.northLatDeg &&
    coordinates.longitude >= JEZERO_DEM_BOUNDS.westLonDeg &&
    coordinates.longitude <= JEZERO_DEM_BOUNDS.eastLonDeg
  );
}

// Shared LRU cache for NASA WMTS tile images across 3D Globe and 2D Map.
const MAX_SHARED_TILE_IMAGES = 320;
const sharedTileImageCache = new Map<string, HTMLImageElement>();
const sharedTileInFlight = new Map<string, Promise<HTMLImageElement>>();

export function getCachedTileImage(url: string): HTMLImageElement | undefined {
  const image = sharedTileImageCache.get(url);
  if (!image) return undefined;

  sharedTileImageCache.delete(url);
  sharedTileImageCache.set(url, image);

  return image;
}

function storeCachedTileImage(url: string, image: HTMLImageElement): void {
  sharedTileImageCache.delete(url);
  sharedTileImageCache.set(url, image);

  while (sharedTileImageCache.size > MAX_SHARED_TILE_IMAGES) {
    const oldestKey = sharedTileImageCache.keys().next().value;
    if (!oldestKey) break;
    sharedTileImageCache.delete(oldestKey);
  }
}

export function loadCachedTileImage(
  url: string,
  signal?: AbortSignal
): Promise<HTMLImageElement> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }

  const cached = getCachedTileImage(url);
  if (cached) return Promise.resolve(cached);

  const existing = sharedTileInFlight.get(url);
  if (existing && !signal) return existing;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";

    const onAbort = () => {
      image.onload = null;
      image.onerror = null;
      reject(new DOMException("Aborted", "AbortError"));
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    image.onload = () => {
      if (signal) signal.removeEventListener("abort", onAbort);

      storeCachedTileImage(url, image);
      sharedTileInFlight.delete(url);
      resolve(image);
    };

    image.onerror = () => {
      if (signal) signal.removeEventListener("abort", onAbort);

      sharedTileInFlight.delete(url);
      reject(new Error(`Failed to load NASA tile: ${url}`));
    };

    image.src = url;
  });

  if (!signal) sharedTileInFlight.set(url, promise);

  return promise;
}

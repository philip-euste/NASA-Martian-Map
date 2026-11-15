
import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  AttributionControl,
  useMap,
  useMapEvents,
  CircleMarker,
  Tooltip,
  GeoJSON,
} from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import "leaflet/dist/leaflet.css";

import { MAP_LAYERS, type MapLayerId } from "../../data/mapLayers";
import {
  getDataProvider,
  type TileLayerConfig,
  type TileMatrixLevel,
} from "../../services/dataProviders";
import { EXPLORATION_SITES, getSiteById } from "../../data/explorationSites";
import { getMarsRegionById } from "../../data/regions";
import type { Coordinates } from "../../types";
import {
  loadCachedTileImage,
  normalizeCoordinates,
} from "../../features/mars-explorer/marsExplorer.types";
import {
  MarsExplorerProvider,
  useMarsExplorer,
  useOptionalMarsExplorer,
} from "../../features/mars-explorer/useMarsExplorer";
import MarsExplorerControls from "../../features/mars-explorer/MarsExplorerControls";
import { MarsExplorerLocationPanel } from "../../features/mars-explorer/MarsExplorerUI";
import { formatCoordinates } from "../ui";

import "./MarsMap.css";
import { apiUrl } from "../../lib/api";

type RegionFeature = Feature<Geometry, Record<string, unknown>>;

type RegionFeatureCollection = FeatureCollection<
  Geometry,
  Record<string, unknown>
>;

interface MapControllerProps {
  layerId: MapLayerId;
  focusCoordinates: Coordinates;
  focusRequestVersion: number;
  navigationAction: "zoom-in" | "zoom-out" | "reset" | null;
  navigationActionVersion: number;
  onZoomOutToGlobe: (coordinates: Coordinates) => void;
}

interface MapClickHandlerProps {
  onSelect: (coordinates: Coordinates) => void;
}

interface MapViewportSyncProps {
  onMoveFocus: (coordinates: Coordinates) => void;
  onZoomChange: (zoom: number) => void;
  onZoomOutToGlobe: (coordinates: Coordinates) => void;
}

interface WmtsTileLayerProps {
  config: TileLayerConfig;
  opacity: number;
}

interface StudyRegion {
  readonly id: string;
  readonly name: string;
  readonly fallbackUrl: string;
}

const SUPPORTED_STUDY_REGIONS: readonly StudyRegion[] = [
  { id: "jezero", name: "Jezero Crater", fallbackUrl: "/data/boundaries/jezero.geojson" },
  { id: "gale", name: "Gale Crater", fallbackUrl: "/data/boundaries/gale.geojson" },
  { id: "valles-marineris", name: "Valles Marineris", fallbackUrl: "/data/boundaries/valles-marineris.geojson" },
  { id: "olympus-mons", name: "Olympus Mons", fallbackUrl: "/data/boundaries/olympus-mons.geojson" },
];

const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

const MAP_ZOOM_OUT_TO_GLOBE_THRESHOLD = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRegionFeature(value: unknown): value is RegionFeature {
  if (!isRecord(value)) return false;

  return value.type === "Feature" && "geometry" in value;
}

function getGeologyFeatureCollection(
  value: unknown
): RegionFeatureCollection | null {
  if (!isRecord(value) || !Array.isArray(value.features)) {
    return null;
  }

  const features = value.features.filter(isRegionFeature);

  return {
    type: "FeatureCollection",
    features,
  };
}

function getPropertyText(
  properties: Record<string, unknown> | null | undefined,
  key: string
): string | null {
  const value = properties?.[key];

  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

const GEOLOGY_COLORS = [
  "#c08457",
  "#d4a373",
  "#8f9b76",
  "#b77965",
  "#a78bba",
  "#7c9eae",
  "#c18caa",
  "#a6a16e",
  "#c58b54",
  "#8296a8",
];

function getGeologyColor(feature?: RegionFeature): string {
  const properties = feature?.properties;
  const identifier =
    getPropertyText(properties, "Unit") ??
    getPropertyText(properties, "OBJECTID") ??
    "unknown";

  return GEOLOGY_COLORS[
    hashString(identifier) % GEOLOGY_COLORS.length
  ];
}

function createGeologyTooltip(
  properties: Record<string, unknown> | null | undefined
): HTMLElement {
  const container = document.createElement("div");
  container.className = "mx-geology-tooltip";

  const unit = getPropertyText(properties, "Unit");
  const description = getPropertyText(properties, "UnitDesc");
  const area = getPropertyText(properties, "SphArea_km");
  const objectId = getPropertyText(properties, "OBJECTID");

  if (unit) {
    const heading = document.createElement("strong");
    heading.textContent = unit;
    container.appendChild(heading);
  }

  if (description) {
    const descriptionElement = document.createElement("div");
    descriptionElement.textContent = description;
    container.appendChild(descriptionElement);
  }

  if (area) {
    const areaElement = document.createElement("div");
    areaElement.textContent = `Spherical area: ${area} km²`;
    container.appendChild(areaElement);
  }

  if (objectId) {
    const idElement = document.createElement("div");
    idElement.textContent = `Feature ID: ${objectId}`;
    container.appendChild(idElement);
  }

  return container;
}

function getMatrixForZoom(
  levels: TileMatrixLevel[],
  zoom: number
): TileMatrixLevel {
  const available = levels.filter(
    (level) => level.matrixWidth <= 2 ** (zoom + 1)
  );

  if (available.length === 0) {
    return levels.reduce((smallest, current) =>
      current.matrixWidth < smallest.matrixWidth ? current : smallest
    );
  }

  return available.reduce((largest, current) =>
    current.matrixWidth > largest.matrixWidth ? current : largest
  );
}

class MarsWmtsGridLayer extends L.GridLayer {
  private mapInstance: L.Map;
  private config: TileLayerConfig;
  private levels: TileMatrixLevel[];

  constructor(
    map: L.Map,
    config: TileLayerConfig,
    levels: TileMatrixLevel[],
    opacity: number
  ) {
    const smallestMatrixWidth = Math.min(
      ...levels.map((level) => level.matrixWidth)
    );

    const largestMatrixWidth = Math.max(
      ...levels.map((level) => level.matrixWidth)
    );

    super({
      tileSize: 256,
      opacity,
      attribution: config.attribution,
      noWrap: true,
      keepBuffer: 4,
      updateWhenIdle: false,
      updateWhenZooming: false,
      bounds: L.latLngBounds([-90, -180], [90, 180]),
      minNativeZoom: Math.max(
        0,
        Math.ceil(Math.log2(smallestMatrixWidth)) - 1
      ),
      maxNativeZoom: Math.max(
        0,
        Math.floor(Math.log2(largestMatrixWidth)) - 1
      ),
      minZoom: 1,
      maxZoom: 12,
    });

    this.mapInstance = map;
    this.config = config;
    this.levels = levels;
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement("img");

    tile.alt = "";
    tile.setAttribute("role", "presentation");
    tile.decoding = "async";
    tile.width = 256;
    tile.height = 256;

    const matrix = getMatrixForZoom(this.levels, coords.z);

    const northWest = this.mapInstance.unproject(
      L.point(coords.x * 256, coords.y * 256),
      coords.z
    );

    const matrixTileWidth = 360 / matrix.matrixWidth;
    const matrixTileHeight = 180 / matrix.matrixHeight;

    const column = Math.floor(
      (northWest.lng - matrix.topLeftX) / matrixTileWidth + 1e-9
    );

    const row = Math.floor(
      (matrix.topLeftY - northWest.lat) / matrixTileHeight + 1e-9
    );

    const validTile =
      column >= 0 &&
      column < matrix.matrixWidth &&
      row >= 0 &&
      row < matrix.matrixHeight;

    if (!validTile) {
      tile.src = TRANSPARENT_PIXEL;
      done(undefined, tile);
      return tile;
    }

    const tileUrl = this.config.tileUrlTemplate
      .replaceAll("{z}", encodeURIComponent(matrix.id))
      .replaceAll("{x}", String(column))
      .replaceAll("{y}", String(row));

    loadCachedTileImage(tileUrl)
      .then((cachedImg) => {
        tile.src = cachedImg.src;
        done(undefined, tile);
      })
      .catch(() => {
        tile.onload = () => done(undefined, tile);

        tile.onerror = () => {
          tile.src = TRANSPARENT_PIXEL;
          done(undefined, tile);
        };

        tile.src = tileUrl;
      });

    return tile;
  }
}

function WmtsTileLayer({ config, opacity }: WmtsTileLayerProps) {
  const map = useMap();

  useEffect(() => {
    const levels = config.matrixLevels;

    if (!levels?.length) return;

    const gridLayer = new MarsWmtsGridLayer(
      map,
      config,
      levels,
      opacity
    );

    gridLayer.addTo(map);

    return () => {
      map.removeLayer(gridLayer);
    };
  }, [map, config, opacity]);

  return null;
}

function MapController({
  layerId,
  focusCoordinates,
  focusRequestVersion,
  navigationAction,
  navigationActionVersion,
  onZoomOutToGlobe,
}: MapControllerProps) {
  const map = useMap();

  const lastFocusVersionRef = useRef<number>(-1);
  const lastNavigationVersionRef = useRef<number>(0);

  useEffect(() => {
    if (
      navigationActionVersion !== lastNavigationVersionRef.current
    ) {
      lastNavigationVersionRef.current = navigationActionVersion;

      switch (navigationAction) {
        case "zoom-in":
          map.zoomIn();
          return;

        case "zoom-out":
          if (map.getZoom() <= MAP_ZOOM_OUT_TO_GLOBE_THRESHOLD) {
            const center = map.getCenter();

            const normalized = normalizeCoordinates({
              latitude: center.lat,
              longitude: center.lng,
            });

            onZoomOutToGlobe(normalized ?? focusCoordinates);
          } else {
            map.zoomOut();
          }
          return;

        case "reset": {
          const layer = MAP_LAYERS[layerId];

          lastFocusVersionRef.current = focusRequestVersion;

          map.setView(
            layer.center,
            Math.max(layer.zoom, 3),
            { animate: true }
          );

          return;
        }
      }
    }

    if (focusRequestVersion !== lastFocusVersionRef.current) {
      lastFocusVersionRef.current = focusRequestVersion;

      const valid = normalizeCoordinates(focusCoordinates);

      if (valid) {
        const nextZoom = Math.max(map.getZoom(), 4);

        map.flyTo(
          [valid.latitude, valid.longitude],
          nextZoom,
          { duration: 0.55 }
        );
      }
    }
  }, [
    layerId,
    focusCoordinates,
    focusRequestVersion,
    navigationAction,
    navigationActionVersion,
    onZoomOutToGlobe,
    map,
  ]);

  return null;
}

function MapViewportSync({
  onMoveFocus,
  onZoomChange,
  onZoomOutToGlobe,
}: MapViewportSyncProps) {
  const map = useMapEvents({
    moveend() {
      const center = map.getCenter();

      const normalized = normalizeCoordinates({
        latitude: center.lat,
        longitude: center.lng,
      });

      if (normalized) {
        onMoveFocus(normalized);
      }
    },

    zoomend() {
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    const container = map.getContainer();
    let zoomOutWheelAccum = 0;

    const handleWheel = (event: WheelEvent) => {
      if (
        event.deltaY > 0 &&
        map.getZoom() <= MAP_ZOOM_OUT_TO_GLOBE_THRESHOLD
      ) {
        zoomOutWheelAccum += event.deltaY;

        if (zoomOutWheelAccum >= 90) {
          zoomOutWheelAccum = 0;

          const center = map.getCenter();

          const normalized = normalizeCoordinates({
            latitude: center.lat,
            longitude: center.lng,
          });

          onZoomOutToGlobe(
            normalized ?? { latitude: 0, longitude: 0 }
          );
        }
      } else {
        zoomOutWheelAccum = 0;
      }
    };

    container.addEventListener("wheel", handleWheel, {
      passive: true,
    });

    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [map, onZoomOutToGlobe]);

  return null;
}

function MapClickHandler({ onSelect }: MapClickHandlerProps) {
  useMapEvents({
    click(event) {
      onSelect({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  return null;
}

function MarsMapInner({ focusSiteId }: { focusSiteId?: string }) {
  const {
    selectedLayerId,
    setSelectedLayerId,
    tileConfig,
    layerLoading,
    layerError,
    retryLayer,
    opacity,
    overlayLayerId,
    overlayOpacity,
    showGeologyOverlay,
    geologyOpacity,
    selectedStudyRegionId,
    showStudyRegionBoundary,
    focusCoordinates,
    focusRequestVersion,
    updateCameraFocus,
    mapZoom,
    setMapZoom,
    navigationAction,
    navigationActionVersion,
    selectedLocation,
    selectSite,
    selectCustomCoordinates,
    savedLocations,
    goToSavedLocation,
    statusMessage,
    triggerZoomOutToGlobe,
  } = useMarsExplorer();

  const layer = MAP_LAYERS[selectedLayerId];

  const [overlayTileConfig, setOverlayTileConfig] =
    useState<TileLayerConfig | null>(null);

  const [boundaryFeatures, setBoundaryFeatures] = useState<
    Record<string, RegionFeature>
  >({});

  const [geologyGeoJson, setGeologyGeoJson] =
    useState<RegionFeatureCollection | null>(null);

  const [boundaryLoading, setBoundaryLoading] = useState(false);
  const [geologyLoading, setGeologyLoading] = useState(false);

  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const [geologyError, setGeologyError] = useState<string | null>(null);

  // Load the secondary raster layer.
  useEffect(() => {
    if (!overlayLayerId) {
      setOverlayTileConfig(null);
      return;
    }

    const targetLayer = MAP_LAYERS[overlayLayerId];

    if (!targetLayer) {
      setOverlayTileConfig(null);
      return;
    }

    let cancelled = false;

    getDataProvider(targetLayer.provider)
      .getLayerConfig(overlayLayerId)
      .then((config) => {
        if (!cancelled) {
          setOverlayTileConfig(config);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOverlayTileConfig(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [overlayLayerId]);

  // Load all supported study-region boundaries independently.
  // This does not depend on selectedStudyRegionId.
  useEffect(() => {
    const controller = new AbortController();

    setBoundaryFeatures({});
    setBoundaryError(null);
    setBoundaryLoading(true);

    async function loadBoundaries() {
      const results = await Promise.all(
        SUPPORTED_STUDY_REGIONS.map(async (region) => {
          try {
            const response = await fetch(
              apiUrl(`/api/regions/${encodeURIComponent(region.id)}/boundary`),
              { signal: controller.signal }
            );

            const responseText = await response.text();

            if (!response.ok) {
              throw new Error(
                `HTTP ${response.status}: ${responseText.slice(0, 120)}`
              );
            }

            let payload: unknown;

            try {
              payload = JSON.parse(responseText);
            } catch {
              throw new Error("API returned HTML or invalid JSON.");
            }

            if (
              !isRecord(payload) ||
              !isRegionFeature(payload.feature)
            ) {
              throw new Error(
                "Response does not contain a valid GeoJSON feature."
              );
            }

            return {
              id: region.id,
              feature: payload.feature,
              error: null,
            };
          } catch (error: unknown) {
            if (controller.signal.aborted) return null;

            try {
              const response = await fetch(region.fallbackUrl, { signal: controller.signal });
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const payload: unknown = await response.json();
              if (!isRegionFeature(payload)) throw new Error("Invalid offline GeoJSON");
              return { id: region.id, feature: payload, error: `${region.name}: using approximate offline DEM coverage outline.` };
            } catch {
              if (controller.signal.aborted) return null;
            }

            return {
              id: region.id,
              feature: null,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown boundary loading error.",
            };
          }
        })
      );

      if (controller.signal.aborted) return;

      const loadedFeatures: Record<string, RegionFeature> = {};
      const failedRegions: string[] = [];

      for (const result of results) {
        if (!result) continue;

        if (result.feature) {
          loadedFeatures[result.id] = result.feature;
        }
        if (result.error) {
          const region = SUPPORTED_STUDY_REGIONS.find(
            (item) => item.id === result.id
          );

          failedRegions.push(
            `${region?.name ?? result.id}: ${result.error}`
          );
        }
      }

      setBoundaryFeatures(loadedFeatures);

      setBoundaryError(
        failedRegions.length > 0
          ? `Study-region boundary status:\n${failedRegions.join("\n")}`
          : null
      );

      setBoundaryLoading(false);
    }

    void loadBoundaries();

    return () => {
      controller.abort();
    };
  }, []);

  // Load the selected region's geology only while the geology overlay is enabled.
  useEffect(() => {
    if (!showGeologyOverlay) {
      setGeologyGeoJson(null);
      setGeologyError(null);
      setGeologyLoading(false);
      return;
    }

    const controller = new AbortController();

    setGeologyGeoJson(null);
    setGeologyError(null);
    setGeologyLoading(true);

    async function loadGeology() {
      try {
        const response = await fetch(
          apiUrl(`/api/regions/${encodeURIComponent(selectedStudyRegionId)}/geology`),
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(
            `Geology request failed: HTTP ${response.status}`
          );
        }

        const payload: unknown = await response.json();
        const featureCollection = getGeologyFeatureCollection(payload);

        if (!featureCollection) {
          throw new Error(
            "Geology API returned an invalid response. Expected a GeoJSON features array."
          );
        }

        setGeologyGeoJson(featureCollection);
      } catch (error: unknown) {
        if (controller.signal.aborted) return;

        // Try local static fallback for Jezero SIM-3464 if API is unreachable
        if (selectedStudyRegionId === "jezero") {
          try {
            const fallbackResp = await fetch("/data/jezero_geology_sim3464.geojson", { signal: controller.signal });
            if (fallbackResp.ok) {
              const fallbackPayload = await fallbackResp.json();
              const fc = getGeologyFeatureCollection(fallbackPayload);
              if (fc) {
                setGeologyGeoJson(fc);
                setGeologyError(null);
                return;
              }
            }
          } catch {
            // Ignore fallback error and report original error
          }
        }

        setGeologyGeoJson(null);

        setGeologyError(
          error instanceof Error
            ? error.message
            : "Unable to load the study region geology."
        );
      } finally {
        if (!controller.signal.aborted) {
          setGeologyLoading(false);
        }
      }
    }

    loadGeology();

    return () => {
      controller.abort();
    };
  }, [selectedStudyRegionId, showGeologyOverlay]);

  // Focus a requested exploration site.
  useEffect(() => {
    if (!focusSiteId) return;

    const site = getSiteById(focusSiteId);

    if (site) {
      selectSite(site, { focus: true });
    }
  }, [focusSiteId, selectSite]);

  return (
    <section className="mx-map relative h-full min-h-0 w-full">
      <div
        className="relative h-full min-h-0 w-full"
        style={{ background: "#141215" }}
      >
        <MapContainer
          center={[
            focusCoordinates.latitude,
            focusCoordinates.longitude,
          ]}
          zoom={Math.max(mapZoom, 3)}
          minZoom={1}
          maxZoom={12}
          zoomControl={false}
          attributionControl={false}
          crs={L.CRS.EPSG4326}
          maxBounds={[
            [-90, -180],
            [90, 180],
          ]}
          maxBoundsViscosity={0.85}
          worldCopyJump={false}
          zoomAnimation={true}
          style={{
            height: "100%",
            width: "100%",
          }}
        >
          <AttributionControl prefix={false} />

          <MapController
            layerId={selectedLayerId}
            focusCoordinates={focusCoordinates}
            focusRequestVersion={focusRequestVersion}
            navigationAction={navigationAction}
            navigationActionVersion={navigationActionVersion}
            onZoomOutToGlobe={triggerZoomOutToGlobe}
          />

          <MapViewportSync
            onMoveFocus={updateCameraFocus}
            onZoomChange={setMapZoom}
            onZoomOutToGlobe={triggerZoomOutToGlobe}
          />

          <MapClickHandler
            onSelect={(coordinates) =>
              selectCustomCoordinates(coordinates, { focus: false })
            }
          />

          {tileConfig?.matrixLevels?.length ? (
            <WmtsTileLayer
              key={selectedLayerId}
              config={tileConfig}
              opacity={opacity}
            />
          ) : tileConfig ? (
            <TileLayer
              key={selectedLayerId}
              url={tileConfig.tileUrlTemplate}
              attribution={tileConfig.attribution}
              zoomOffset={tileConfig.zoomOffset}
              noWrap
              opacity={opacity}
            />
          ) : null}

          {/* Secondary raster overlay */}
          {overlayLayerId && overlayTileConfig?.matrixLevels?.length ? (
            <WmtsTileLayer
              key={`overlay-${overlayLayerId}`}
              config={overlayTileConfig}
              opacity={overlayOpacity}
            />
          ) : overlayLayerId && overlayTileConfig ? (
            <TileLayer
              key={`overlay-${overlayLayerId}`}
              url={overlayTileConfig.tileUrlTemplate}
              attribution={overlayTileConfig.attribution}
              zoomOffset={overlayTileConfig.zoomOffset}
              noWrap
              opacity={overlayOpacity}
            />
          ) : null}

          {/* All supported study-region boundaries */}
          {SUPPORTED_STUDY_REGIONS.map((region) => {
            const feature = showStudyRegionBoundary && region.id === selectedStudyRegionId
              ? boundaryFeatures[region.id]
              : null;

            if (!feature) return null;

            return (
              <GeoJSON
                key={`region-boundary-${region.id}`}
                data={feature}
                style={{
                  color: "#38bdf8",
                  weight: 3,
                  opacity: 1,
                  fill: true,
                  fillColor: "#75b9c2",
                  fillOpacity: 0.16,
                  dashArray: "7 5",
                }}
              />
            );
          })}

          {/* Region-specific USGS geology polygons */}
          {showGeologyOverlay && geologyGeoJson && (
            <GeoJSON
              key={`region-geology-${selectedStudyRegionId}-${geologyOpacity}`}
              data={geologyGeoJson}
              style={(feature) => {
                const regionFeature = feature as RegionFeature;

                return {
                  color: "#f1e5d5",
                  weight: 1,
                  opacity: 0.85,
                  fillColor: getGeologyColor(regionFeature),
                  fillOpacity: geologyOpacity,
                };
              }}
              onEachFeature={(feature, featureLayer) => {
                const regionFeature = feature as RegionFeature;

                const tooltip = createGeologyTooltip(
                  regionFeature.properties
                );

                featureLayer.bindTooltip(tooltip, {
                  sticky: true,
                  className: "mx-site-label",
                });
              }}
            />
          )}

          {/* Exploration sites */}
          {EXPLORATION_SITES.map((site) => {
            const active =
              selectedLocation?.kind === "site" &&
              selectedLocation.site?.id === site.id;

            return (
              <CircleMarker
                key={`site-${site.id}-${active ? "active" : "idle"}`}
                center={[site.latitude, site.longitude]}
                radius={active ? 7.5 : 5.5}
                bubblingMouseEvents={false}
                pathOptions={{
                  opacity: 1,
                  fillOpacity: active ? 0.92 : 1,
                  color: active ? "#f47738" : "#f3efea",
                  weight: active ? 2.5 : 2,
                  fillColor: active ? "#f47738" : "#141215",
                }}
                eventHandlers={{
                  click: () => selectSite(site, { focus: true }),
                }}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className={`mx-site-label ${active ? "is-active" : ""}`}
                >
                  {site.name}
                </Tooltip>
              </CircleMarker>
            );
          })}

          {/* Saved locations */}
          {savedLocations.map((location) => {
            const active =
              selectedLocation?.kind === "saved" &&
              selectedLocation.savedId === location.id;

            return (
              <CircleMarker
                key={`saved-${location.id}-${active ? "active" : "idle"}`}
                center={[location.latitude, location.longitude]}
                radius={active ? 7.5 : 6}
                bubblingMouseEvents={false}
                pathOptions={{
                  opacity: 1,
                  fillOpacity: active ? 0.92 : 0.95,
                  color: active ? "#f47738" : "#d8b48f",
                  weight: active ? 2.5 : 2,
                  fillColor: active ? "#f47738" : "#141215",
                }}
                eventHandlers={{
                  click: () => goToSavedLocation(location, { focus: true }),
                }}
              >
                <Tooltip
                  permanent={active}
                  direction="top"
                  offset={[0, -10]}
                  className={`mx-site-label ${active ? "is-active" : ""}`}
                >
                  {location.name}
                </Tooltip>
              </CircleMarker>
            );
          })}

          {/* Custom selected coordinate */}
          {selectedLocation?.kind === "custom" && (
            <CircleMarker
              key={selectedLocation.key}
              center={[
                selectedLocation.latitude,
                selectedLocation.longitude,
              ]}
              radius={7}
              interactive={false}
              pathOptions={{
                color: "#f47738",
                weight: 2.5,
                fillColor: "#f47738",
                fillOpacity: 0.85,
              }}
            />
          )}
        </MapContainer>

        {/* Map coordinate and zoom information */}
        <div className="pointer-events-none absolute bottom-4 left-4 z-[1040] hidden items-center gap-3 rounded-md border border-mx-border bg-mx-bg/90 px-3 py-1.5 backdrop-blur sm:left-6 md:flex">
          <span className="mx-mono text-[11px] text-mx-text">
            {formatCoordinates(
              selectedLocation?.latitude ?? focusCoordinates.latitude,
              selectedLocation?.longitude ?? focusCoordinates.longitude
            )}
          </span>

          <span className="mx-mono text-[10px] text-mx-dim">
            ZOOM L{mapZoom} · {layer.id.replace("mars_", "").toUpperCase()}
          </span>
        </div>

        <MarsExplorerLocationPanel mode="map" />

        {/* Map status messages */}
        <div className="mx-map-status">
          {layerLoading && (
            <p className="mx-chip">Loading map layer...</p>
          )}

          {boundaryLoading && (
            <p className="mx-chip">
              Loading all study-region boundaries...
            </p>
          )}

          {geologyLoading && (
            <p className="mx-chip">
              Loading {selectedStudyRegionId} geology...
            </p>
          )}

          {boundaryError && (
            <p className="mx-chip whitespace-pre-line" role="alert">
              {boundaryError}
            </p>
          )}

          {geologyError && (
            <p className="mx-chip" role="alert">
              Geology: {geologyError}
            </p>
          )}

          {layerError && (
            <div
              className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/50 bg-mx-bg/95 px-3.5 py-2 text-xs text-mx-text shadow-lg backdrop-blur"
              role="alert"
            >
              <span>{layerError}</span>

              <button
                type="button"
                onClick={retryLayer}
                className="mx-btn mx-btn--secondary mx-btn--sm !min-h-7 !px-2.5 !py-1 text-[11px]"
              >
                Retry Layer
              </button>

              {selectedLayerId !== "mars_global_mola" && (
                <button
                  type="button"
                  onClick={() => setSelectedLayerId("mars_global_mola")}
                  className="mx-btn mx-btn--primary mx-btn--sm !min-h-7 !px-2.5 !py-1 text-[11px]"
                >
                  Use MOLA Basemap
                </button>
              )}
            </div>
          )}

          {statusMessage && (
            <p className="mx-chip" role="status">
              {statusMessage}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default function MarsMap({
  focusSiteId,
}: {
  focusSiteId?: string;
}) {
  const explorer = useOptionalMarsExplorer();

  if (!explorer) {
    return (
      <MarsExplorerProvider
        initialViewMode="map"
        initialSiteId={focusSiteId ?? null}
      >
        <div className="relative h-full w-full overflow-hidden">
          <MarsExplorerControls />
          <MarsMapInner focusSiteId={focusSiteId} />
        </div>
      </MarsExplorerProvider>
    );
  }

  return <MarsMapInner focusSiteId={focusSiteId} />;
}

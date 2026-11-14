import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  AttributionControl,
  useMap,
  useMapEvents,
  CircleMarker,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Globe, Minus, Plus } from "lucide-react";

import { MAP_LAYERS, type MapLayerId } from "../../data/mapLayers";
import {
  type TileLayerConfig,
  type TileMatrixLevel,
} from "../../services/dataProviders";
import { EXPLORATION_SITES, getSiteById } from "../../data/explorationSites";
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

interface MapControllerProps {
  layerId: MapLayerId;
  focusCoordinates: Coordinates;
  focusRequestVersion: number;
  resetCounter: number;
}

interface MapClickHandlerProps {
  onSelect: (coordinates: Coordinates) => void;
}

interface MapReferenceProps {
  onMapReady: (map: L.Map) => void;
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

const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
const MAP_ZOOM_OUT_TO_GLOBE_THRESHOLD = 2;

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
        tile.onerror = () =>
          done(
            new Error(`NASA tile failed: ${matrix.id}/${row}/${column}`),
            tile
          );
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

    const gridLayer = new MarsWmtsGridLayer(map, config, levels, opacity);
    gridLayer.addTo(map);

    return () => {
      map.removeLayer(gridLayer);
    };
  }, [map, config, opacity]);

  return null;
}

function MapReference({ onMapReady }: MapReferenceProps) {
  const map = useMap();

  useEffect(() => {
    onMapReady(map);

    const invalidate = () => {
      map.invalidateSize({ pan: false, animate: false });
    };

    const frame = requestAnimationFrame(invalidate);
    const secondFrame = requestAnimationFrame(invalidate);
    const observer = new ResizeObserver(invalidate);
    observer.observe(map.getContainer());

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(secondFrame);
      observer.disconnect();
    };
  }, [map, onMapReady]);

  return null;
}

function MapController({
  layerId,
  focusCoordinates,
  focusRequestVersion,
  resetCounter,
}: MapControllerProps) {
  const map = useMap();
  const lastFocusVersionRef = useRef<number>(-1);
  const lastResetRef = useRef<number>(resetCounter);

  useEffect(() => {
    const layer = MAP_LAYERS[layerId];

    if (resetCounter !== lastResetRef.current) {
      lastResetRef.current = resetCounter;
      map.setView(layer.center, Math.max(layer.zoom, 3), { animate: true });
      return;
    }

    if (focusRequestVersion !== lastFocusVersionRef.current) {
      lastFocusVersionRef.current = focusRequestVersion;
      const valid = normalizeCoordinates(focusCoordinates);
      if (valid) {
        const nextZoom = Math.max(map.getZoom(), 4);
        map.flyTo([valid.latitude, valid.longitude], nextZoom, {
          duration: 0.55,
        });
      }
    }
  }, [layerId, focusCoordinates, focusRequestVersion, resetCounter, map]);

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
      if (event.deltaY > 0 && map.getZoom() <= MAP_ZOOM_OUT_TO_GLOBE_THRESHOLD) {
        zoomOutWheelAccum += event.deltaY;
        if (zoomOutWheelAccum >= 90) {
          zoomOutWheelAccum = 0;
          const center = map.getCenter();
          const normalized = normalizeCoordinates({
            latitude: center.lat,
            longitude: center.lng,
          });
          onZoomOutToGlobe(normalized ?? { latitude: 0, longitude: 0 });
        }
      } else {
        zoomOutWheelAccum = 0;
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: true });
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
    tileConfig,
    layerLoading,
    layerError,
    opacity,
    focusCoordinates,
    focusRequestVersion,
    updateCameraFocus,
    mapZoom,
    setMapZoom,
    selectedLocation,
    selectSite,
    selectCustomCoordinates,
    savedLocations,
    goToSavedLocation,
    statusMessage,
    triggerZoomOutToGlobe,
  } = useMarsExplorer();

  const [resetCounter, setResetCounter] = useState(0);
  const [map, setMap] = useState<L.Map | null>(null);

  const layer = MAP_LAYERS[selectedLayerId];

  useEffect(() => {
    if (!focusSiteId) return;
    const site = getSiteById(focusSiteId);
    if (site) {
      selectSite(site, { focus: true });
    }
  }, [focusSiteId, selectSite]);

  function handleZoomOutButton() {
    if (!map) return;
    if (map.getZoom() <= MAP_ZOOM_OUT_TO_GLOBE_THRESHOLD) {
      const center = map.getCenter();
      triggerZoomOutToGlobe(
        normalizeCoordinates({
          latitude: center.lat,
          longitude: center.lng,
        }) ?? focusCoordinates
      );
      return;
    }
    map.zoomOut();
  }

  function handleResetView() {
    setResetCounter((current) => current + 1);
  }

  return (
    <section className="mx-map relative h-full min-h-0 w-full">
      <div
        className="relative h-full min-h-0 w-full"
        style={{ background: "#141215" }}
      >
        <MapContainer
          center={[focusCoordinates.latitude, focusCoordinates.longitude]}
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

          <MapReference onMapReady={setMap} />

          <MapController
            layerId={selectedLayerId}
            focusCoordinates={focusCoordinates}
            focusRequestVersion={focusRequestVersion}
            resetCounter={resetCounter}
          />

          <MapViewportSync
            onMoveFocus={updateCameraFocus}
            onZoomChange={setMapZoom}
            onZoomOutToGlobe={triggerZoomOutToGlobe}
          />

          <MapClickHandler
            onSelect={(coords) =>
              selectCustomCoordinates(coords, { focus: false })
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

        {/* 2D Map Navigation Toolbar */}
        <div className="mx-map-overlay left-4 top-[176px] flex flex-col gap-2 sm:left-6">
          <div
            className="flex flex-col gap-2"
            role="toolbar"
            aria-label="2D map navigation tools"
            aria-orientation="vertical"
          >
            <button
              type="button"
              className="mx-icon-btn"
              aria-label="Zoom in"
              title="Zoom in"
              onClick={() => map?.zoomIn()}
            >
              <Plus size={17} />
            </button>

            <button
              type="button"
              className="mx-icon-btn"
              aria-label="Zoom out"
              title={
                mapZoom <= MAP_ZOOM_OUT_TO_GLOBE_THRESHOLD
                  ? "Zoom out to 3D Globe"
                  : "Zoom out"
              }
              onClick={handleZoomOutButton}
            >
              <Minus size={17} />
            </button>

            <button
              type="button"
              className="mx-icon-btn"
              aria-label="Reset map view"
              title="Reset regional view"
              onClick={handleResetView}
            >
              <Crosshair size={17} />
            </button>

            <button
              type="button"
              className="mx-icon-btn"
              aria-label="Switch to 3D Mars Globe"
              title="Switch to 3D Mars Globe"
              onClick={() => triggerZoomOutToGlobe(focusCoordinates)}
            >
              <Globe size={16} />
            </button>
          </div>
        </div>

        {/* Bottom-left coordinate readout */}
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

        {/* Unified Selected Location Panel (2D Map mode) */}
        <MarsExplorerLocationPanel mode="map" />

        {/* Non-interactive map status messages */}
        <div className="mx-map-status">
          {layerLoading && <p className="mx-chip">Loading map layer...</p>}
          {layerError && (
            <p className="mx-chip" role="alert">
              {layerError}
            </p>
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

export default function MarsMap({ focusSiteId }: { focusSiteId?: string }) {
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

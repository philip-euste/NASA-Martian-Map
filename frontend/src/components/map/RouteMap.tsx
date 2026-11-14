// frontend/src/components/map/RouteMap.tsx
// Map component for the Route Planner (Section 3I, Figma: 2D Mars Map visual language).
// Reuses MAP_LAYERS and getDataProvider without modifying MarsMap's zero-prop interface.
import { useEffect, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Layers, Minus, Plus } from "lucide-react";
import { MAP_LAYERS, type MapLayerId } from "../../data/mapLayers";
import {
  getDataProvider,
  type TileLayerConfig,
} from "../../services/dataProviders";
import type { Coordinates, Waypoint } from "../../types";
import { formatCoordinates } from "../ui";
import "./MarsMap.css";

interface RouteTarget {
  readonly id: string;
  readonly name: string;
  readonly coordinates: Coordinates;
}

interface RouteItem {
  readonly id: string;
  readonly name: string;
  readonly waypoints: readonly {
    readonly id: string;
    readonly name?: string;
    readonly coordinates: Coordinates;
  }[];
}

interface RouteMapProps {
  center: [number, number];
  zoom?: number;
  startingLocation?: Coordinates | null;
  targets: readonly RouteTarget[];
  routes: readonly RouteItem[];
  activeRouteId: string | null;
  draftWaypoints: readonly Waypoint[];
  onAddWaypoint?: (coords: Coordinates, target?: RouteTarget) => void;
}

function CenterUpdater({
  center,
  zoom,
  resetCounter,
}: {
  center: [number, number];
  zoom: number;
  resetCounter: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, resetCounter, map]);
  return null;
}

function ClickCapture({
  onAddWaypoint,
}: {
  onAddWaypoint?: (coords: Coordinates) => void;
}) {
  useMapEvents({
    click(event) {
      onAddWaypoint?.({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });
  return null;
}

export default function RouteMap({
  center,
  zoom = 4,
  startingLocation,
  targets,
  routes,
  activeRouteId,
  draftWaypoints,
  onAddWaypoint,
}: RouteMapProps) {
  const [layerId, setLayerId] = useState<MapLayerId>("mars_global_mola");
  const [tileConfig, setTileConfig] = useState<TileLayerConfig | null>(null);
  const [layerError, setLayerError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [map, setMap] = useState<L.Map | null>(null);
  const [layerPickerOpen, setLayerPickerOpen] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);

  const layer = MAP_LAYERS[layerId];

  useEffect(() => {
    let cancelled = false;
    setLayerError(null);
    getDataProvider(layer.provider)
      .getLayerConfig(layerId, { forceRetry: retryToken > 0 })
      .then((cfg) => {
        if (!cancelled) {
          setTileConfig(cfg);
          setLayerError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLayerError(
            err instanceof Error
              ? err.message
              : "Selected NASA map layer is temporarily unavailable."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [layerId, layer.provider, retryToken]);

  return (
    <div className="mx-map relative h-full min-h-[480px] w-full overflow-hidden rounded-[10px] border border-mx-border">
      <MapContainer
        ref={setMap}
        center={center}
        zoom={zoom}
        minZoom={1}
        maxZoom={12}
        crs={L.CRS.EPSG4326}
        maxBounds={[
          [-90, -180],
          [90, 180],
        ]}
        maxBoundsViscosity={0.8}
        worldCopyJump={false}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <CenterUpdater
          center={center}
          zoom={zoom}
          resetCounter={resetCounter}
        />
        <ClickCapture onAddWaypoint={onAddWaypoint} />

        {tileConfig && (
          <TileLayer
            key={layerId}
            url={tileConfig.tileUrlTemplate}
            attribution={tileConfig.attribution}
            zoomOffset={tileConfig.zoomOffset}
          />
        )}

        {/* Saved candidate routes */}
        {routes.map((route) => {
          const isSelected = route.id === activeRouteId;
          const positions = route.waypoints.map(
            (wp) => [wp.coordinates.latitude, wp.coordinates.longitude] as [number, number]
          );
          if (positions.length < 2) return null;

          return (
            <Polyline
              key={route.id}
              positions={positions}
              pathOptions={{
                color: isSelected ? "#f47738" : "#d8b48f",
                weight: isSelected ? 3.5 : 2,
                opacity: isSelected ? 0.95 : 0.55,
                dashArray: isSelected ? undefined : "6 6",
              }}
            />
          );
        })}

        {/* Active route waypoints */}
        {routes
          .find((r) => r.id === activeRouteId)
          ?.waypoints.map((wp, index) => (
            <CircleMarker
              key={wp.id}
              center={[wp.coordinates.latitude, wp.coordinates.longitude]}
              radius={5}
              pathOptions={{
                color: "#f47738",
                weight: 2,
                fillColor: "#141215",
                fillOpacity: 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} className="mx-site-label">
                {wp.name ?? `WP ${index + 1}`}
              </Tooltip>
            </CircleMarker>
          ))}

        {/* Draft route being composed */}
        {draftWaypoints.length >= 2 && (
          <Polyline
            positions={draftWaypoints.map(
              (wp) =>
                [wp.coordinates.latitude, wp.coordinates.longitude] as [
                  number,
                  number,
                ]
            )}
            pathOptions={{
              color: "#93b98a",
              weight: 2.5,
              dashArray: "4 4",
            }}
          />
        )}

        {draftWaypoints.map((wp, idx) => (
          <CircleMarker
            key={wp.id}
            center={[wp.coordinates.latitude, wp.coordinates.longitude]}
            radius={4.5}
            pathOptions={{
              color: "#93b98a",
              weight: 2,
              fillColor: "#141215",
              fillOpacity: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} className="mx-site-label">
              {wp.name ?? `Draft WP ${idx + 1}`}
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Starting location marker */}
        {startingLocation && (
          <CircleMarker
            center={[startingLocation.latitude, startingLocation.longitude]}
            radius={7}
            pathOptions={{
              color: "#f3efea",
              weight: 2,
              fillColor: "#f47738",
              fillOpacity: 1,
            }}
          >
            <Tooltip
              permanent
              direction="top"
              offset={[0, -10]}
              className="mx-site-label is-active"
            >
              Start ({formatCoordinates(startingLocation.latitude, startingLocation.longitude)})
            </Tooltip>
          </CircleMarker>
        )}

        {/* Scientific targets */}
        {targets.map((target) => (
          <CircleMarker
            key={target.id}
            center={[target.coordinates.latitude, target.coordinates.longitude]}
            radius={6}
            bubblingMouseEvents={false}
            eventHandlers={{
              click: () => onAddWaypoint?.(target.coordinates, target),
            }}
            pathOptions={{
              color: "#d8b48f",
              weight: 2,
              fillColor: "#141215",
              fillOpacity: 1,
            }}
          >
            <Tooltip
              permanent
              direction="top"
              offset={[0, -10]}
              className="mx-site-label"
            >
              {target.name}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Floating controls (Figma 2D Mars Map toolbar) */}
      <div className="mx-map-overlay left-4 top-4 flex items-start gap-2.5">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="mx-icon-btn"
            aria-label="Zoom in"
            onClick={() => map?.zoomIn()}
          >
            <Plus size={17} />
          </button>
          <button
            type="button"
            className="mx-icon-btn"
            aria-label="Zoom out"
            onClick={() => map?.zoomOut()}
          >
            <Minus size={17} />
          </button>
          <button
            type="button"
            className="mx-icon-btn"
            aria-label="Reset map view"
            onClick={() => setResetCounter((c) => c + 1)}
          >
            <Crosshair size={17} />
          </button>
          <button
            type="button"
            className="mx-icon-btn"
            aria-label="Imagery layer"
            aria-pressed={layerPickerOpen}
            onClick={() => setLayerPickerOpen((o) => !o)}
          >
            <Layers size={17} />
          </button>
        </div>

        {layerPickerOpen && (
          <div className="mx-panel mx-panel--floating w-64 p-3.5">
            <label htmlFor="route-map-layer" className="mx-label">
              Basemap layer
            </label>
            <select
              id="route-map-layer"
              className="mx-input"
              value={layerId}
              onChange={(e) => setLayerId(e.target.value as MapLayerId)}
            >
              {Object.values(MAP_LAYERS).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {layerError && (
        <div
          className="mx-map-overlay right-4 top-4 flex flex-wrap items-center gap-2 rounded-md border border-amber-400/50 bg-mx-bg/95 px-3 py-1.5 text-xs text-mx-text shadow-lg"
          role="alert"
        >
          <span>{layerError}</span>
          <button
            type="button"
            onClick={() => setRetryToken((c) => c + 1)}
            className="mx-btn mx-btn--secondary mx-btn--sm !min-h-6 !px-2 !py-0.5 text-[11px]"
          >
            Retry
          </button>
          {layerId !== "mars_global_mola" && (
            <button
              type="button"
              onClick={() => setLayerId("mars_global_mola")}
              className="mx-btn mx-btn--primary mx-btn--sm !min-h-6 !px-2 !py-0.5 text-[11px]"
            >
              Use MOLA
            </button>
          )}
        </div>
      )}

      <div className="mx-map-overlay bottom-4 left-4 rounded-md border border-mx-border bg-mx-bg/90 px-3 py-1.5">
        <span className="mx-mono text-[11px] text-mx-muted">
          Click map or target pins to append waypoints to draft route
        </span>
      </div>
    </div>
  );
}

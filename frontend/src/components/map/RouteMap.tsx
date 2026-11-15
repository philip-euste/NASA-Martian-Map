
// frontend/src/components/map/RouteMap.tsx
// Map component for the Route Planner (Section 3I, Figma: 2D Mars Map visual language).
// Reuses MAP_LAYERS and getDataProvider without modifying MarsMap's zero-prop interface.
import { useEffect, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature } from "geojson";
import { Crosshair, Layers, Minus, Plus } from "lucide-react";
import { MAP_LAYERS, type MapLayerId } from "../../data/mapLayers";
import {
  getDataProvider,
  type TileLayerConfig,
} from "../../services/dataProviders";
import type { Coordinates, Waypoint } from "../../types";
import { useMission } from "../../state/mission/MissionContext";
import { identifyGeologicUnitAt } from "../../utils/jezeroStratigraphy";
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

interface StudyRegion {
  readonly id: string;
  readonly name: string;
}

const SUPPORTED_STUDY_REGIONS: readonly StudyRegion[] = [
  { id: "jezero", name: "Jezero Crater" },
  { id: "gale", name: "Gale Crater" },
  { id: "valles-marineris", name: "Valles Marineris" },
  { id: "olympus-mons", name: "Olympus Mons" },
];

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
  }, [center[0], center[1], zoom, resetCounter, map]);

  return null;
}

function BoundaryViewport({
  feature,
  regionId,
}: {
  feature: Feature;
  regionId: string;
}) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.geoJSON(feature).getBounds();

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [36, 36],
        maxZoom: 9,
      });
    }
  }, [feature, regionId, map]);

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
  const { mission } = useMission();
  const selectedStudyRegionId = mission.region?.id ?? null;

  const [layerId, setLayerId] = useState<MapLayerId>("mars_global_mola");
  const [tileConfig, setTileConfig] = useState<TileLayerConfig | null>(null);
  const [layerError, setLayerError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [map, setMap] = useState<L.Map | null>(null);
  const [layerPickerOpen, setLayerPickerOpen] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);
  const [showGeology, setShowGeology] = useState(true);
  const [geologyData, setGeologyData] = useState<any>(null);

  const [boundaryFeatures, setBoundaryFeatures] = useState<
    Record<string, Feature>
  >({});
  const [boundaryError, setBoundaryError] = useState<string | null>(null);

  const layer = MAP_LAYERS[layerId];

  // Fetch every supported study-region boundary independently.
  // A failed request for one region does not prevent the others from loading.
  useEffect(() => {
    const controller = new AbortController();

    async function loadBoundaries() {
      setBoundaryFeatures({});
      setBoundaryError(null);

      const results = await Promise.all(
        SUPPORTED_STUDY_REGIONS.map(async (region) => {
          try {
            const response = await fetch(
              `/api/regions/${encodeURIComponent(region.id)}/boundary`,
              { signal: controller.signal }
            );

            const responseText = await response.text();

            if (!response.ok) {
              throw new Error(
                `HTTP ${response.status}: ${responseText.slice(0, 120)}`
              );
            }

            let payload: { feature?: Feature };

            try {
              payload = JSON.parse(responseText) as {
                feature?: Feature;
              };
            } catch {
              throw new Error("API returned HTML or invalid JSON.");
            }

            const feature = payload.feature;

            if (
              !feature ||
              feature.type !== "Feature" ||
              !feature.geometry
            ) {
              throw new Error("Response does not contain valid GeoJSON.");
            }

            return {
              id: region.id,
              feature,
              error: null,
            };
          } catch (error) {
            if (controller.signal.aborted) {
              return null;
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

      const loadedFeatures: Record<string, Feature> = {};
      const failedRegions: string[] = [];

      for (const result of results) {
        if (!result) continue;

        if (result.feature) {
          loadedFeatures[result.id] = result.feature;
        } else if (result.error) {
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
          ? `Some study-region boundaries could not be loaded:\n${failedRegions.join("\n")}`
          : null
      );
    }

    void loadBoundaries();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!showGeology) return;

    let cancelled = false;

    fetch("/data/jezero_geology_sim3464.geojson")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setGeologyData(data);
      })
      .catch(() => {
        if (!cancelled) setGeologyData(null);
      });

    return () => {
      cancelled = true;
    };
  }, [showGeology]);

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

  const selectedBoundary = selectedStudyRegionId
    ? boundaryFeatures[selectedStudyRegionId]
    : null;

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

        {/* USGS SIM 3464 Jezero Geologic Units Overlay */}
        {showGeology && geologyData && (
          <GeoJSON
            key="route-usgs-geology"
            data={geologyData}
            style={(feature) => ({
              color: feature?.properties?.stroke_color || "#3b82f6",
              weight: 1.8,
              fillColor: feature?.properties?.color || "#3b82f6",
              fillOpacity: 0.32,
            })}
            onEachFeature={(feature, geoLayer) => {
              if (feature.properties) {
                const p = feature.properties;

                geoLayer.bindTooltip(
                  `<strong>${p.unit_code}</strong>: ${p.unit_name}<br/><span style="font-size:10px;color:#cbd5e1">${p.lithology}</span>`,
                  { sticky: true, className: "mx-site-label" }
                );
              }
            }}
          />
        )}

        {/* Automatically loaded boundaries for all supported study regions */}
        {selectedBoundary && selectedStudyRegionId && (
          <BoundaryViewport
            feature={selectedBoundary}
            regionId={selectedStudyRegionId}
          />
        )}

        {SUPPORTED_STUDY_REGIONS.map((region) => {
          const feature = boundaryFeatures[region.id];

          if (!feature) return null;

          const isSelected = region.id === selectedStudyRegionId;

          return (
            <GeoJSON
              key={`study-region-boundary-${region.id}`}
              data={feature}
              style={{
                color: isSelected ? "#f4a261" : "#75b9c2",
                weight: isSelected ? 3.5 : 2,
                opacity: isSelected ? 1 : 0.85,
                fill: false,
                fillOpacity: 0,
                dashArray: isSelected ? "7 5" : "4 6",
              }}
              onEachFeature={(_feature, featureLayer) => {
                featureLayer.bindTooltip(
                  `${region.name}${isSelected ? " — Selected study region" : " — Study region"}`,
                  {
                    sticky: true,
                    className: "mx-site-label",
                  }
                );
              }}
            />
          );
        })}

        {/* Saved candidate routes */}
        {routes.map((route) => {
          const isSelected = route.id === activeRouteId;

          const positions = route.waypoints.map(
            (wp) =>
              [
                wp.coordinates.latitude,
                wp.coordinates.longitude,
              ] as [number, number]
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
              center={[
                wp.coordinates.latitude,
                wp.coordinates.longitude,
              ]}
              radius={5}
              pathOptions={{
                color: "#f47738",
                weight: 2,
                fillColor: "#141215",
                fillOpacity: 1,
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -8]}
                className="mx-site-label"
              >
                {wp.name ?? `WP ${index + 1}`}
              </Tooltip>
            </CircleMarker>
          ))}

        {/* Draft route being composed */}
        {draftWaypoints.length >= 2 && (
          <Polyline
            positions={draftWaypoints.map(
              (wp) =>
                [
                  wp.coordinates.latitude,
                  wp.coordinates.longitude,
                ] as [number, number]
            )}
            pathOptions={{
              color: "#93b98a",
              weight: 2.5,
              dashArray: "4 4",
            }}
          />
        )}

        {draftWaypoints.map((wp, idx) => {
          const unit = identifyGeologicUnitAt(wp.coordinates);

          return (
            <CircleMarker
              key={wp.id}
              center={[
                wp.coordinates.latitude,
                wp.coordinates.longitude,
              ]}
              radius={5}
              pathOptions={{
                color: unit.color || "#93b98a",
                weight: 2.5,
                fillColor: "#141215",
                fillOpacity: 1,
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -6]}
                className="mx-site-label"
              >
                {wp.name ?? `Draft WP ${idx + 1}`} [{unit.unit_code}]
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* Starting location marker */}
        {startingLocation && (
          <CircleMarker
            center={[
              startingLocation.latitude,
              startingLocation.longitude,
            ]}
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
              Start (
              {formatCoordinates(
                startingLocation.latitude,
                startingLocation.longitude
              )}
              )
            </Tooltip>
          </CircleMarker>
        )}

        {/* Scientific targets */}
        {targets.map((target) => (
          <CircleMarker
            key={target.id}
            center={[
              target.coordinates.latitude,
              target.coordinates.longitude,
            ]}
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
          <div className="mx-panel mx-panel--floating w-64 space-y-3 p-3.5">
            <div>
              <label htmlFor="route-map-layer" className="mx-label">
                Basemap layer
              </label>

              <select
                id="route-map-layer"
                className="mx-input text-xs"
                value={layerId}
                onChange={(e) =>
                  setLayerId(e.target.value as MapLayerId)
                }
              >
                {Object.values(MAP_LAYERS).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-2 border-t border-mx-border pt-2.5 text-xs text-mx-text">
              <span>USGS SIM 3464 Geology</span>
              <input
                type="checkbox"
                className="mx-checkbox"
                checked={showGeology}
                onChange={(e) => setShowGeology(e.target.checked)}
              />
            </label>
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

      {boundaryError && (
        <div
          className="mx-map-overlay right-4 top-16 max-w-sm rounded-md border border-amber-400/50 bg-mx-bg/95 px-3 py-2 text-xs text-mx-text shadow-lg"
          role="alert"
        >
          <strong>Some study-region boundaries are unavailable</strong>
          <p className="mb-0 mt-1 whitespace-pre-line break-words">
            {boundaryError}
          </p>
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

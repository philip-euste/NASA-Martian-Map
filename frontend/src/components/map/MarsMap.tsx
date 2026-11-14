import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
  CircleMarker,
  Popup,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  Bookmark,
  Crosshair,
  Layers,
  Minus,
  Plus,
  Search,
  X,
} from "lucide-react";

import {
  MAP_LAYERS,
  type MapLayerId,
} from "../../data/mapLayers";

import {
  getDataProvider,
  type TileLayerConfig,
} from "../../services/dataProviders";

import { marsDemProvider } from "../../services/providers/marsDem";

import {
  EXPLORATION_SITES,
  getSiteById,
  type ExplorationSite,
} from "../../data/explorationSites";

import { useMission } from "../../state/mission/MissionContext";

import {
  buildRegion,
  buildTarget,
  hasTargetAt,
  toMutable,
} from "../../features/mission/missionHelpers";

import {
  DataField,
  ImagePending,
  formatCoordinates,
} from "../ui";

import "./MarsMap.css";

// ==========================================
// TYPES
// ==========================================

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface SavedLocation extends Coordinates {
  id: number;
  name: string;
}

interface MapControllerProps {
  layerId: MapLayerId;
  focusLocation: Coordinates | null;
  resetCounter: number;
}

interface MapClickHandlerProps {
  onSelect: (coordinates: Coordinates) => void;
}

interface MapReferenceProps {
  onMapReady: (map: L.Map) => void;
}

// ==========================================
// MAP HELPERS
// ==========================================

function MapReference({
  onMapReady,
}: MapReferenceProps) {
  const map = useMap();

  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);

  return null;
}

function MapController({
  layerId,
  focusLocation,
  resetCounter,
}: MapControllerProps) {
  const map = useMap();

  useEffect(() => {
    const layer = MAP_LAYERS[layerId];

    if (focusLocation) {
      map.flyTo(
        [
          focusLocation.latitude,
          focusLocation.longitude,
        ],
        Math.max(map.getZoom(), 4)
      );
    } else {
      map.setView(layer.center, layer.zoom);
    }
  }, [
    layerId,
    focusLocation,
    resetCounter,
    map,
  ]);

  return null;
}

function MapClickHandler({
  onSelect,
}: MapClickHandlerProps) {
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

// ==========================================
// MAIN MAP COMPONENT
// ==========================================

export default function MarsMap({
  focusSiteId,
}: {
  focusSiteId?: string;
}) {
  // ========================================
  // MAP STATE
  // ========================================

  const [selectedLayer, setSelectedLayer] =
    useState<MapLayerId>("mars_global_mola");

  const [tileConfig, setTileConfig] =
    useState<TileLayerConfig | null>(null);

  const [coordinates, setCoordinates] =
    useState<Coordinates | null>(null);

  const [focusLocation, setFocusLocation] =
    useState<Coordinates | null>(null);

  const [resetCounter, setResetCounter] =
    useState(0);

  const [map, setMap] =
    useState<L.Map | null>(null);

  // ========================================
  // ELEVATION STATE
  // ========================================

  const [elevation, setElevation] =
    useState<
      Awaited<
        ReturnType<typeof marsDemProvider.getElevation>
      > | null
    >(null);

  const [elevationLoading, setElevationLoading] =
    useState(false);

  const [elevationError, setElevationError] =
    useState<string | null>(null);

  // ========================================
  // SAVED LOCATION STATE
  // ========================================

  const [savedLocations, setSavedLocations] =
    useState<SavedLocation[]>([]);

  const [locationName, setLocationName] =
    useState("");

  // ========================================
  // UI STATE
  // ========================================

  const [opacity, setOpacity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [selectedSiteId, setSelectedSiteId] =
    useState<string | null>(null);

  const [layersOpen, setLayersOpen] =
    useState(false);

  const [savedOpen, setSavedOpen] =
    useState(false);

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] =
    useState(false);

  // ========================================
  // MISSION STATE
  // ========================================

  const { mission, setRegion, updateMission } =
    useMission();

  const layer = MAP_LAYERS[selectedLayer];

  const selectedSite = getSiteById(
    selectedSiteId ?? undefined
  );

  // ========================================
  // EXTERNAL SITE FOCUS
  // ========================================

  useEffect(() => {
    if (!focusSiteId) return;

    const site = getSiteById(focusSiteId);

    if (!site) return;

    setSelectedSiteId(site.id);

    setCoordinates({
      latitude: site.latitude,
      longitude: site.longitude,
    });

    setFocusLocation({
      latitude: site.latitude,
      longitude: site.longitude,
    });
  }, [focusSiteId]);

  // ========================================
  // LOAD ELEVATION
  // ========================================

  useEffect(() => {
    if (!coordinates) {
      setElevation(null);
      setElevationError(null);
      setElevationLoading(false);
      return;
    }

    let cancelled = false;

    async function loadElevation() {
      setElevationLoading(true);
      setElevation(null);
      setElevationError(null);

      try {
        const result =
          await marsDemProvider.getElevation(coordinates!);

        if (!cancelled) {
          setElevation(result);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setElevationError(
            err instanceof Error
              ? err.message
              : "Unable to retrieve elevation."
          );
        }
      } finally {
        if (!cancelled) {
          setElevationLoading(false);
        }
      }
    }

    loadElevation();

    return () => {
      cancelled = true;
    };
  }, [coordinates]);

  // ========================================
  // LOAD MAP LAYER
  // ========================================

  useEffect(() => {
    let cancelled = false;

    async function loadLayer() {
      setLoading(true);
      setError(null);
      setTileConfig(null);

      try {
        const provider = getDataProvider(layer.provider);

        const config =
          await provider.getLayerConfig(selectedLayer);

        if (!cancelled) {
          setTileConfig(config);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLayer();

    return () => {
      cancelled = true;
    };
  }, [selectedLayer, layer.provider]);

  // ========================================
  // MAP ACTIONS
  // ========================================

  function selectCoordinates(
    nextCoordinates: Coordinates
  ): void {
    setCoordinates(nextCoordinates);
    setSelectedSiteId(null);
    setFocusLocation(null);
  }

  function selectSite(site: ExplorationSite): void {
    setSelectedSiteId(site.id);

    setCoordinates({
      latitude: site.latitude,
      longitude: site.longitude,
    });

    setFocusLocation({
      latitude: site.latitude,
      longitude: site.longitude,
    });

    setQuery("");
    setSearchOpen(false);
  }

  function resetView(): void {
    setFocusLocation(null);
    setResetCounter((current) => current + 1);
  }

  function clearSelection(): void {
    setCoordinates(null);
    setSelectedSiteId(null);
    setFocusLocation(null);
  }

  // ========================================
  // SAVED LOCATIONS
  // ========================================

  function saveLocation(): void {
    if (!coordinates) return;

    const duplicate = savedLocations.some(
      (location) =>
        Math.abs(
          location.latitude - coordinates.latitude
        ) < 0.00001 &&
        Math.abs(
          location.longitude - coordinates.longitude
        ) < 0.00001
    );

    if (duplicate) {
      setMessage("This location has already been saved.");
      return;
    }

    const name =
      locationName.trim() ||
      `Location ${savedLocations.length + 1}`;

    const newLocation: SavedLocation = {
      id: Date.now(),
      name,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    };

    setSavedLocations((current) => [
      ...current,
      newLocation,
    ]);

    setLocationName("");
    setMessage(`${name} saved.`);
  }

  function removeLocation(id: number): void {
    setSavedLocations((current) =>
      current.filter((location) => location.id !== id)
    );

    setMessage("Location removed.");
  }

  function goToSavedLocation(
    location: SavedLocation
  ): void {
    setCoordinates({
      latitude: location.latitude,
      longitude: location.longitude,
    });

    setSelectedSiteId(null);

    setFocusLocation({
      latitude: location.latitude,
      longitude: location.longitude,
    });

    setSavedOpen(false);
  }

  // ========================================
  // SEARCH
  // ========================================

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) {
      return {
        sites: EXPLORATION_SITES,
        saved: savedLocations,
      };
    }

    return {
      sites: EXPLORATION_SITES.filter((site) =>
        `${site.name} ${site.regionLabel}`
          .toLowerCase()
          .includes(term)
      ),

      saved: savedLocations.filter((location) =>
        location.name.toLowerCase().includes(term)
      ),
    };
  }, [query, savedLocations]);

  // ========================================
  // MISSION ACTIONS
  // ========================================

  const selectedName =
    selectedSite?.name ||
    locationName.trim() ||
    "Custom location";

  const isRegion =
    !!coordinates &&
    !!mission.region &&
    Math.abs(
      mission.region.coordinates.latitude -
        coordinates.latitude
    ) < 0.00001 &&
    Math.abs(
      mission.region.coordinates.longitude -
        coordinates.longitude
    ) < 0.00001;

  const isTarget =
    !!coordinates &&
    hasTargetAt(
      mission.scientificTargets,
      coordinates
    );

  function setAsRegion(): void {
    if (!coordinates) return;

    setRegion(
      buildRegion(
        selectedSite?.id ??
          `point-${coordinates.latitude.toFixed(5)}-${coordinates.longitude.toFixed(5)}`,
        selectedName,
        coordinates,
        selectedSite?.description ??
          "Location selected on the 2D map."
      )
    );

    setMessage(
      `${selectedName} set as expedition region.`
    );
  }

  function addAsTarget(): void {
    if (!coordinates || isTarget) return;

    updateMission({
      scientificTargets: [
        ...toMutable(mission.scientificTargets),
        buildTarget(
          selectedName,
          coordinates,
          selectedSite?.description ??
            "Target selected on the 2D map."
        ),
      ],
    });

    setMessage(
      `${selectedName} added to scientific targets.`
    );
  }

  // ========================================
  // RENDER
  // ========================================

  return (
    <section className="relative h-full w-full">
      <div
        className="relative w-full"
        style={{
          height: "min(800px, 100%)",
          minHeight: "600px",
          background: "#171717",
        }}
      >
        <MapContainer
          center={layer.center}
          zoom={layer.zoom}
          minZoom={1}
          maxZoom={12}
          crs={L.CRS.EPSG4326}
          maxBounds={[
            [-90, -180],
            [90, 180],
          ]}
          maxBoundsViscosity={0.8}
          worldCopyJump={false}
          style={{
            height: "100%",
            width: "100%",
          }}
        >
          <MapReference
            onMapReady={setMap}
          />

          <MapController
            layerId={selectedLayer}
            focusLocation={focusLocation}
            resetCounter={resetCounter}
          />

          <MapClickHandler
            onSelect={selectCoordinates}
          />

          {tileConfig && (
            <TileLayer
              key={selectedLayer}
              url={tileConfig.tileUrlTemplate}
              attribution={tileConfig.attribution}
              zoomOffset={tileConfig.zoomOffset}
              opacity={opacity}
            />
          )}

          {/* Named exploration sites */}
          {EXPLORATION_SITES.map((site) => {
            const active = site.id === selectedSiteId;

            return (
              <CircleMarker
                key={site.id}
                center={[
                  site.latitude,
                  site.longitude,
                ]}
                radius={active ? 7 : 5.5}
                bubblingMouseEvents={false}
                pathOptions={{
                  color: active ? "#f47738" : "#f3efea",
                  weight: 2,
                  fillColor: active ? "#f47738" : "#141215",
                  fillOpacity: 1,
                }}
                eventHandlers={{
                  click: () => selectSite(site),
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

          {/* Selected arbitrary point */}
          {coordinates && !selectedSite && (
            <CircleMarker
              center={[
                coordinates.latitude,
                coordinates.longitude,
              ]}
              radius={6}
              interactive={false}
              pathOptions={{
                color: "#f47738",
                weight: 2,
                fillColor: "#f47738",
                fillOpacity: 0.35,
              }}
            />
          )}

          {/* Saved locations */}
          {savedLocations.map((location) => (
            <CircleMarker
              key={location.id}
              center={[
                location.latitude,
                location.longitude,
              ]}
              radius={7}
              pathOptions={{
                color: "#d8b48f",
                fillColor: "#d8b48f",
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <strong>{location.name}</strong>
                <br />
                Latitude: {location.latitude.toFixed(5)}°
                <br />
                Longitude: {location.longitude.toFixed(5)}°
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* ======================================
            TOP-LEFT CONTROLS
        ====================================== */}

        <div className="mx-map-overlay left-4 top-4 flex flex-col gap-3 sm:left-6 sm:top-5 max-lg:top-[76px]">
          <div className="flex items-start gap-2.5">
            <div className="relative w-[min(280px,calc(100vw-32px))]">
              <label
                htmlFor="mars-map-search"
                className="sr-only"
              >
                Search locations
              </label>

              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mx-muted"
                aria-hidden="true"
              />

              <input
                id="mars-map-search"
                type="search"
                className="mx-input !bg-mx-bg/95 pl-9"
                placeholder="Search sites or saved locations"
                value={query}
                autoComplete="off"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => {
                  window.setTimeout(
                    () => setSearchOpen(false),
                    150
                  );
                }}
              />

              {searchOpen && (
                <div className="mx-panel mx-panel--floating mx-scroll absolute left-0 right-0 top-[calc(100%+6px)] max-h-72 overflow-auto p-1.5">
                  {searchResults.sites.length === 0 &&
                    searchResults.saved.length === 0 && (
                      <p className="m-0 px-3 py-2.5 text-[13px] text-mx-dim">
                        No matching locations.
                      </p>
                    )}

                  {searchResults.sites.map((site) => (
                    <button
                      key={site.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left hover:bg-mx-panel-2"
                      onMouseDown={(event) =>
                        event.preventDefault()
                      }
                      onClick={() => selectSite(site)}
                    >
                      <span className="text-[13px] text-mx-text">
                        {site.name}
                      </span>

                      <span className="mx-mono text-[11px] text-mx-dim">
                        {site.terrainType}
                      </span>
                    </button>
                  ))}

                  {searchResults.saved.map((location) => (
                    <button
                      key={location.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left hover:bg-mx-panel-2"
                      onMouseDown={(event) =>
                        event.preventDefault()
                      }
                      onClick={() => {
                        goToSavedLocation(location);
                        setSearchOpen(false);
                      }}
                    >
                      <span className="text-[13px] text-mx-text">
                        {location.name}
                      </span>

                      <span className="mx-mono text-[11px] text-mx-dim">
                        Saved
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span
              className="mx-chip hidden h-10 sm:inline-flex"
              title={layer.name}
            >
              {layer.name}
            </span>
          </div>

          <div className="flex items-start gap-3">
            <div
              className="flex flex-col gap-2"
              role="toolbar"
              aria-label="Map tools"
              aria-orientation="vertical"
            >
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
                aria-label="Reset view"
                title="Reset View"
                onClick={resetView}
              >
                <Crosshair size={17} />
              </button>

              <button
                type="button"
                className="mx-icon-btn"
                aria-label="Imagery layers"
                aria-pressed={layersOpen}
                onClick={() => {
                  setLayersOpen((open) => !open);
                  setSavedOpen(false);
                }}
              >
                <Layers size={17} />
              </button>

              <button
                type="button"
                className="mx-icon-btn relative"
                aria-label={`Saved locations (${savedLocations.length})`}
                aria-pressed={savedOpen}
                onClick={() => {
                  setSavedOpen((open) => !open);
                  setLayersOpen(false);
                }}
              >
                <Bookmark size={16} />

                {savedLocations.length > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-mx-accent px-1 text-[10px] font-semibold text-[#1a0f08]">
                    {savedLocations.length}
                  </span>
                )}
              </button>
            </div>

            {/* Layer panel */}
            {layersOpen && (
              <div className="mx-panel mx-panel--floating w-[min(300px,calc(100vw-80px))] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="mx-eyebrow mx-eyebrow--accent">
                    Dataset layer
                  </span>

                  <button
                    type="button"
                    className="text-mx-muted hover:text-mx-text"
                    aria-label="Close layers"
                    onClick={() => setLayersOpen(false)}
                  >
                    <X size={16} />
                  </button>
                </div>

                <label
                  htmlFor="mars-map-layer"
                  className="mx-label"
                >
                  Imagery layer
                </label>

                <select
                  id="mars-map-layer"
                  className="mx-input"
                  value={selectedLayer}
                  onChange={(event) => {
                    setSelectedLayer(
                      event.target.value as MapLayerId
                    );
                    setFocusLocation(null);
                  }}
                >
                  {Object.values(MAP_LAYERS).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>

                <p className="mx-body m-0 mt-3 text-[13px]">
                  {layer.description}
                </p>

                {tileConfig && (
                  <div className="mt-4">
                    <label
                      htmlFor="layer-opacity"
                      className="mx-label flex justify-between"
                    >
                      <span>Layer opacity</span>

                      <span className="mx-mono text-mx-muted">
                        {Math.round(opacity * 100)}%
                      </span>
                    </label>

                    <input
                      id="layer-opacity"
                      className="mx-range"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={opacity}
                      onChange={(event) =>
                        setOpacity(
                          Number(event.target.value)
                        )
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {/* Saved locations panel */}
            {savedOpen && (
              <div className="mx-panel mx-panel--floating w-[min(300px,calc(100vw-80px))]">
                <div className="mx-panel__header !py-3">
                  <span className="mx-eyebrow mx-eyebrow--accent">
                    Saved Locations ({savedLocations.length})
                  </span>

                  <button
                    type="button"
                    className="text-mx-muted hover:text-mx-text"
                    aria-label="Close saved locations"
                    onClick={() => setSavedOpen(false)}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mx-scroll max-h-80 overflow-auto p-2">
                  {savedLocations.length === 0 ? (
                    <p className="m-0 px-2 py-3 text-[13px] text-mx-dim">
                      No saved locations yet. Select a point
                      on the map and save it.
                    </p>
                  ) : (
                    savedLocations.map((location) => (
                      <div
                        key={location.id}
                        className="flex items-center justify-between gap-2 rounded px-2 py-2.5 hover:bg-mx-panel-2"
                      >
                        <div className="min-w-0">
                          <strong className="block truncate text-[13px] font-medium text-mx-text">
                            {location.name}
                          </strong>

                          <span className="mx-mono text-[11px] text-mx-dim">
                            {location.latitude.toFixed(5)}°,{" "}
                            {location.longitude.toFixed(5)}°
                          </span>
                        </div>

                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            className="mx-btn mx-btn--secondary mx-btn--sm"
                            onClick={() =>
                              goToSavedLocation(location)
                            }
                          >
                            Go to
                          </button>

                          <button
                            type="button"
                            className="mx-icon-btn !h-8 !w-8"
                            aria-label={`Remove ${location.name}`}
                            onClick={() =>
                              removeLocation(location.id)
                            }
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ======================================
            SELECTED LOCATION PANEL
        ====================================== */}

        {coordinates && (
          <aside
            className="mx-map-overlay mx-panel mx-panel--floating mx-scroll bottom-4 right-4 flex max-h-[calc(100%-32px)] w-[min(340px,calc(100%-32px))] flex-col overflow-auto p-5 sm:right-6 sm:top-5 sm:bottom-auto max-lg:sm:top-[76px] max-sm:left-4 max-sm:max-h-[60%]"
            aria-label="Selected location"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="mx-eyebrow mx-eyebrow--accent">
                {selectedSite
                  ? "Selected location"
                  : "Selected point"}
              </span>

              <button
                type="button"
                className="text-mx-muted hover:text-mx-text"
                aria-label="Clear selection"
                onClick={clearSelection}
              >
                <X size={17} />
              </button>
            </div>

            {selectedSite &&
              (selectedSite.images[0] ? (
                <img
                  src={selectedSite.images[0].src}
                  alt={selectedSite.images[0].caption}
                  className="mb-4 aspect-[16/9] w-full rounded-md object-cover"
                />
              ) : (
                <ImagePending
                  className="mb-4 aspect-[16/9]"
                  detail="Site imagery to be supplied by the team."
                />
              ))}

            <div className="flex items-start justify-between gap-3">
              <h3 className="mx-heading m-0 text-2xl">
                {selectedName}
              </h3>

              {selectedSite && (
                <span className="mx-badge mt-1.5">
                  {selectedSite.terrainType}
                </span>
              )}
            </div>

            <p className="mx-mono m-0 mt-2 text-mx-text">
              {formatCoordinates(
                coordinates.latitude,
                coordinates.longitude
              )}
            </p>

            <div className="mt-4">
              {elevationLoading && (
                <DataField
                  label="Elevation"
                  value={
                    <span className="text-mx-muted">
                      Retrieving elevation from HiRISE DEM...
                    </span>
                  }
                />
              )}

              {elevationError && (
                <DataField
                  label="Elevation"
                  fallback={`Unavailable — ${elevationError}`}
                />
              )}

              {elevation && (
                <div>
                  <DataField
                    label="HiRISE Elevation"
                    value={`${elevation.elevation.toFixed(2)} ${elevation.unit}`}
                  />

                  <p className="mx-mono m-0 mt-2 text-[11px] text-mx-dim">
                    DEM product: {elevation.product_id}
                    <br />
                    Raster pixel: row {elevation.row},
                    column {elevation.column}
                  </p>
                </div>
              )}
            </div>

            {selectedSite && (
              <p className="mx-body m-0 mt-4">
                {selectedSite.description}
              </p>
            )}

            {/* Save location */}
            <div className="mt-5 flex gap-2">
              <label
                htmlFor="mars-location-name"
                className="sr-only"
              >
                Location name
              </label>

              <input
                id="mars-location-name"
                type="text"
                className="mx-input !min-h-9 !py-1.5 text-[13px]"
                value={locationName}
                onChange={(event) =>
                  setLocationName(event.target.value)
                }
                placeholder="Location name (optional)"
                maxLength={50}
              />

              <button
                type="button"
                className="mx-btn mx-btn--secondary mx-btn--sm"
                onClick={saveLocation}
              >
                Save
              </button>
            </div>

            {/* Mission actions */}
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                className="mx-btn mx-btn--secondary mx-btn--block"
                disabled={isRegion}
                onClick={setAsRegion}
              >
                {isRegion
                  ? "Expedition region selected"
                  : "Set as expedition region"}
              </button>

              <button
                type="button"
                className="mx-btn mx-btn--secondary mx-btn--block"
                disabled={isTarget}
                onClick={addAsTarget}
              >
                {isTarget
                  ? "Already a scientific target"
                  : "Add as scientific target"}
              </button>
            </div>
          </aside>
        )}

        {/* ======================================
            STATUS
        ====================================== */}

        <div className="mx-map-overlay bottom-4 left-4 flex flex-col gap-1">
          {loading && (
            <p className="mx-chip">
              Loading map layer...
            </p>
          )}

          {error && (
            <p className="mx-chip" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="mx-chip" role="status">
              {message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  EXPLORATION_SITES,
  getSiteById,
  type ExplorationSite,
} from "../../data/explorationSites";
import { MAP_LAYERS, type MapLayerId } from "../../data/mapLayers";
import { getDataProvider, type TileLayerConfig } from "../../services/dataProviders";
import { marsDemProvider, type DemElevation } from "../../services/providers/marsDem";
import { useMission } from "../../state/mission/MissionContext";
import {
  buildRegion,
  buildTarget,
  hasTargetAt,
  toMutable,
} from "../mission/missionHelpers";
import type { Coordinates, TemporalMode } from "../../types";
import {
  normalizeCoordinates,
  sameCoords,
  type ExplorerNavigationAction,
  type ExplorerViewMode,
  type MarsExplorerContextValue,
  type SavedLocation,
  type SelectedExplorerLocation,
  type TransitionState,
} from "./marsExplorer.types";

const EARLIEST_TEMPORAL_DATE = "1965-01-01";
const MAX_FUTURE_SOLS = 30;
const SAVED_LOCATIONS_STORAGE_KEY = "mars-explorer-saved-locations-v1";
const TRANSITION_DURATION_MS = 420;
const TRANSITION_COOLDOWN_MS = 700;

const MarsExplorerContext = createContext<MarsExplorerContextValue | null>(null);

function loadInitialSavedLocations(): SavedLocation[] {
  try {
    const raw = window.localStorage.getItem(SAVED_LOCATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedLocation =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "number" &&
        typeof item.name === "string" &&
        typeof item.latitude === "number" &&
        typeof item.longitude === "number"
    );
  } catch {
    return [];
  }
}

export function MarsExplorerProvider({
  initialViewMode = "globe",
  initialSiteId = null,
  children,
}: {
  initialViewMode?: ExplorerViewMode;
  initialSiteId?: string | null;
  children: ReactNode;
}) {
  const {
    mission,
    setRegion,
    updateMission,
    updateSimulation,
    updateTemporal,
  } = useMission();

  const [viewMode, setViewModeState] = useState<ExplorerViewMode>(initialViewMode);
  const [transitionState, setTransitionState] = useState<TransitionState>({
    active: false,
    direction: null,
    progress: 0,
  });

  const transitionCooldownUntil = useRef(0);
  const transitionRafRef = useRef<number | null>(null);

  const [selectedLayerId, setSelectedLayerIdState] = useState<MapLayerId>("mars_viking_global");
  const [opacity, setOpacity] = useState(1);
  const [overlayLayerId, setOverlayLayerId] = useState<MapLayerId | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.65);
  const [showGeologyOverlay, setShowGeologyOverlay] = useState(false);
  const [geologyOpacity, setGeologyOpacity] = useState(0.55);
  const [tileConfig, setTileConfig] = useState<TileLayerConfig | null>(null);
  const [layerLoading, setLayerLoading] = useState(false);
  const [layerError, setLayerError] = useState<string | null>(null);
  const [textureStatus, setTextureStatus] = useState("Loading NASA imagery...");

  const [focusCoordinates, setFocusCoordinates] = useState<Coordinates>(() => {
    const initialSite = initialSiteId ? getSiteById(initialSiteId) : undefined;
    if (initialSite) {
      return { latitude: initialSite.latitude, longitude: initialSite.longitude };
    }
    if (mission.region) {
      return { ...mission.region.coordinates };
    }
    return { latitude: 18.4, longitude: 77.5 };
  });

  const [focusRequestVersion, setFocusRequestVersion] = useState(1);
  const [globeDistance, setGlobeDistance] = useState(3.2);
  const [mapZoom, setMapZoom] = useState(initialSiteId ? 4 : 2);

  const [navigationAction, setNavigationAction] =
    useState<ExplorerNavigationAction | null>(null);
  const [navigationActionVersion, setNavigationActionVersion] = useState(0);

  const requestNavigationAction = useCallback(
    (action: ExplorerNavigationAction) => {
      setNavigationAction(action);
      setNavigationActionVersion((version) => version + 1);
    },
    []
  );

  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(loadInitialSavedLocations);
  const [locationNameDraft, setLocationNameDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const [selectedLocation, setSelectedLocation] = useState<SelectedExplorerLocation | null>(() => {
    const initialSite = initialSiteId ? getSiteById(initialSiteId) : undefined;
    if (!initialSite) return null;
    return {
      kind: "site",
      key: `site:${initialSite.id}`,
      name: initialSite.name,
      latitude: initialSite.latitude,
      longitude: initialSite.longitude,
      description: initialSite.description,
      terrainType: initialSite.terrainType,
      regionLabel: initialSite.regionLabel,
      site: initialSite,
    };
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const [elevation, setElevation] = useState<DemElevation | null>(null);
  const [elevationLoading, setElevationLoading] = useState(false);
  const [elevationError, setElevationError] = useState<string | null>(null);
  const [layerRetryCount, setLayerRetryCount] = useState(0);
  const [elevationRetryCount, setElevationRetryCount] = useState(0);

  const todayUTC = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const temporal = mission.temporal;

  const retryLayer = useCallback(() => {
    const layer = MAP_LAYERS[selectedLayerId];
    const provider = getDataProvider(layer.provider);
    provider.clearLayerCache?.(selectedLayerId);
    setLayerRetryCount((c) => c + 1);
  }, [selectedLayerId]);

  const retryElevation = useCallback(() => {
    marsDemProvider.resetBackendCooldown();
    setElevationRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SAVED_LOCATIONS_STORAGE_KEY, JSON.stringify(savedLocations));
    } catch {
      // Ignore storage quota errors
    }
  }, [savedLocations]);

  // Load WMTS layer configuration once per layer and share across 3D & 2D
  useEffect(() => {
    let cancelled = false;
    const layer = MAP_LAYERS[selectedLayerId];

    async function loadLayer() {
      setLayerLoading(true);
      setLayerError(null);

      try {
        const provider = getDataProvider(layer.provider);
        const config = await provider.getLayerConfig(selectedLayerId, {
          forceRetry: layerRetryCount > 0,
        });
        if (!cancelled) {
          setTileConfig(config);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setLayerError(
            err instanceof Error ? err.message : "Unable to load NASA layer configuration."
          );
        }
      } finally {
        if (!cancelled) {
          setLayerLoading(false);
        }
      }
    }

    loadLayer();
    return () => {
      cancelled = true;
    };
  }, [selectedLayerId, layerRetryCount]);

  // Query real DEM elevation whenever selectedLocation changes
  useEffect(() => {
    if (!selectedLocation) {
      setElevation(null);
      setElevationError(null);
      setElevationLoading(false);
      return;
    }

    const validCoordinates = normalizeCoordinates(selectedLocation);
    if (!validCoordinates) {
      setElevation(null);
      setElevationError("Invalid latitude or longitude.");
      setElevationLoading(false);
      return;
    }

    let cancelled = false;

    async function loadElevation() {
      setElevationLoading(true);
      setElevation(null);
      setElevationError(null);

      try {
        const result = await marsDemProvider.getElevation(validCoordinates!, {
          forceRetry: elevationRetryCount > 0,
        });
        if (!cancelled) {
          setElevation(result);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const isNetworkError =
            err instanceof TypeError && err.message.toLowerCase().includes("fetch");
          setElevationError(
            isNetworkError
              ? "Cannot reach the DEM API. Check that the FastAPI backend is running."
              : err instanceof Error
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
  }, [selectedLocation?.latitude, selectedLocation?.longitude, elevationRetryCount]);

  useEffect(() => {
    return () => {
      if (transitionRafRef.current !== null) {
        cancelAnimationFrame(transitionRafRef.current);
      }
    };
  }, []);

  const updateCameraFocus = useCallback((coordinates: Coordinates) => {
    const valid = normalizeCoordinates(coordinates);
    if (!valid) return;
    setFocusCoordinates((current) => (sameCoords(current, valid, 0.0005) ? current : valid));
  }, []);

  const setSelectedLayerId = useCallback((layerId: MapLayerId) => {
    setSelectedLayerIdState(layerId);
  }, []);

  const selectSite = useCallback(
    (site: ExplorationSite, options?: { focus?: boolean }) => {
      const valid = normalizeCoordinates({
        latitude: site.latitude,
        longitude: site.longitude,
      });
      if (!valid) return;

      setSelectedLocation({
        kind: "site",
        key: `site:${site.id}`,
        name: site.name,
        latitude: valid.latitude,
        longitude: valid.longitude,
        description: site.description,
        terrainType: site.terrainType,
        regionLabel: site.regionLabel,
        site,
      });
      setLocationNameDraft("");
      setStatusMessage("");

      if (options?.focus !== false) {
        setFocusCoordinates(valid);
        setMapZoom((current) => Math.max(current, 4));
        setGlobeDistance((current) => Math.min(Math.max(current, 1.9), 2.5));
        setFocusRequestVersion((v) => v + 1);
      }
    },
    []
  );

  const goToSavedLocation = useCallback(
    (location: SavedLocation, options?: { focus?: boolean }) => {
      const valid = normalizeCoordinates({
        latitude: location.latitude,
        longitude: location.longitude,
      });
      if (!valid) return;

      setSelectedLocation({
        kind: "saved",
        key: `saved:${location.id}`,
        name: location.name,
        latitude: valid.latitude,
        longitude: valid.longitude,
        description:
          location.description ??
          "Custom exploration location saved for orbital and surface analysis.",
        terrainType: "Custom location",
        regionLabel: "User Saved Coordinate",
        savedId: location.id,
      });
      setLocationNameDraft(location.name);
      setStatusMessage("");

      if (options?.focus !== false) {
        setFocusCoordinates(valid);
        setMapZoom((current) => Math.max(current, 4));
        setGlobeDistance((current) => Math.min(Math.max(current, 1.9), 2.5));
        setFocusRequestVersion((v) => v + 1);
      }
    },
    []
  );

  const selectCustomCoordinates = useCallback(
    (coordinates: Coordinates, options?: { focus?: boolean }) => {
      const valid = normalizeCoordinates(coordinates);
      if (!valid) {
        setStatusMessage("Selected point is outside Mars' valid latitude range.");
        return;
      }

      const matchingSite = EXPLORATION_SITES.find((site) =>
        sameCoords(site, valid, 0.05)
      );
      if (matchingSite) {
        selectSite(matchingSite, options);
        return;
      }

      const matchingSaved = savedLocations.find((loc) =>
        sameCoords(loc, valid, 0.01)
      );
      if (matchingSaved) {
        goToSavedLocation(matchingSaved, options);
        return;
      }

      setSelectedLocation({
        kind: "custom",
        key: `custom:${valid.latitude.toFixed(5)}:${valid.longitude.toFixed(5)}`,
        name: "Custom location",
        latitude: valid.latitude,
        longitude: valid.longitude,
        description:
          "Custom Martian surface coordinate selected for inspection, saving, or expedition targeting.",
        terrainType: "Custom point",
        regionLabel: "Martian Surface",
      });
      setLocationNameDraft("");
      setStatusMessage("");

      if (options?.focus) {
        setFocusCoordinates(valid);
        setMapZoom((current) => Math.max(current, 4));
        setFocusRequestVersion((v) => v + 1);
      } else {
        setFocusCoordinates(valid);
      }
    },
    [goToSavedLocation, savedLocations, selectSite]
  );

  const clearSelection = useCallback(() => {
    setSelectedLocation(null);
    setLocationNameDraft("");
    setStatusMessage("");
  }, []);

  const saveSelectedLocation = useCallback(() => {
    if (!selectedLocation) return;

    const existing = savedLocations.find((loc) =>
      sameCoords(loc, selectedLocation, 0.00001)
    );
    const trimmedName = locationNameDraft.trim();

    if (existing) {
      if (trimmedName && trimmedName !== existing.name) {
        const updated: SavedLocation = { ...existing, name: trimmedName };
        setSavedLocations((current) =>
          current.map((item) => (item.id === existing.id ? updated : item))
        );
        goToSavedLocation(updated, { focus: true });
        setStatusMessage(`Updated "${trimmedName}".`);
      } else {
        goToSavedLocation(existing, { focus: true });
        setStatusMessage("Location is already saved.");
      }
      return;
    }

    const name =
      trimmedName ||
      (selectedLocation.kind === "site"
        ? selectedLocation.name
        : `Custom Location ${savedLocations.length + 1}`);

    const newLocation: SavedLocation = {
      id: Date.now(),
      name,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      description: selectedLocation.description,
    };

    setSavedLocations((current) => [...current, newLocation]);
    setSelectedLocation({
      kind: "saved",
      key: `saved:${newLocation.id}`,
      name: newLocation.name,
      latitude: newLocation.latitude,
      longitude: newLocation.longitude,
      description:
        newLocation.description ??
        "Custom exploration location saved for orbital and surface analysis.",
      terrainType: "Custom location",
      regionLabel: "User Saved Coordinate",
      savedId: newLocation.id,
    });
    setFocusCoordinates({
      latitude: newLocation.latitude,
      longitude: newLocation.longitude,
    });
    setMapZoom((current) => Math.max(current, 4));
    setGlobeDistance((current) => Math.min(Math.max(current, 1.9), 2.5));
    setFocusRequestVersion((v) => v + 1);
    setStatusMessage(`"${name}" saved and focused.`);
  }, [goToSavedLocation, locationNameDraft, savedLocations, selectedLocation]);

  const removeLocation = useCallback((id: number) => {
    setSavedLocations((current) => current.filter((item) => item.id !== id));
    setSelectedLocation((current) => (current?.savedId === id ? null : current));
    setStatusMessage("Saved location removed.");
  }, []);

  const runViewTransition = useCallback(
    (
      direction: "globe-to-map" | "map-to-globe",
      targetMode: ExplorerViewMode,
      nextFocus?: Coordinates
    ) => {
      const now = performance.now();
      if (now < transitionCooldownUntil.current) {
        return;
      }
      transitionCooldownUntil.current = now + TRANSITION_COOLDOWN_MS;

      if (transitionRafRef.current !== null) {
        cancelAnimationFrame(transitionRafRef.current);
      }

      const validFocus = nextFocus ? normalizeCoordinates(nextFocus) : null;
      if (validFocus) {
        setFocusCoordinates(validFocus);
      }

      if (direction === "globe-to-map") {
        setMapZoom((current) => Math.max(current, 3));
        setGlobeDistance(1.52);
      } else {
        setGlobeDistance(2.15);
        setMapZoom(2);
      }

      setFocusRequestVersion((v) => v + 1);
      setTransitionState({ active: true, direction, progress: 0 });
      setViewModeState(targetMode);

      const start = performance.now();
      const step = (timestamp: number) => {
        const elapsed = timestamp - start;
        const progress = Math.min(1, elapsed / TRANSITION_DURATION_MS);
        setTransitionState({
          active: progress < 1,
          direction: progress < 1 ? direction : null,
          progress,
        });
        if (progress < 1) {
          transitionRafRef.current = requestAnimationFrame(step);
        } else {
          transitionRafRef.current = null;
        }
      };

      transitionRafRef.current = requestAnimationFrame(step);
    },
    []
  );

  const triggerZoomInToMap = useCallback(
    (focus?: Coordinates) => {
      if (viewMode !== "globe") return;
      const targetFocus =
        focus ??
        (selectedLocation
          ? { latitude: selectedLocation.latitude, longitude: selectedLocation.longitude }
          : focusCoordinates);
      runViewTransition("globe-to-map", "map", targetFocus);
    },
    [focusCoordinates, runViewTransition, selectedLocation, viewMode]
  );

  const triggerZoomOutToGlobe = useCallback(
    (focus?: Coordinates) => {
      if (viewMode !== "map") return;
      const targetFocus =
        focus ??
        (selectedLocation
          ? { latitude: selectedLocation.latitude, longitude: selectedLocation.longitude }
          : focusCoordinates);
      runViewTransition("map-to-globe", "globe", targetFocus);
    },
    [focusCoordinates, runViewTransition, selectedLocation, viewMode]
  );

  const setViewMode = useCallback(
    (nextMode: ExplorerViewMode) => {
      if (nextMode === viewMode) return;
      transitionCooldownUntil.current = performance.now() + 450;

      if (selectedLocation) {
        setFocusCoordinates({
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
        });
      }

      if (nextMode === "map") {
        setMapZoom((current) => (selectedLocation ? Math.max(current, 4) : Math.max(current, 2)));
        setFocusRequestVersion((v) => v + 1);
      } else if (nextMode === "globe") {
        setGlobeDistance((current) => Math.max(current, 2.2));
        setFocusRequestVersion((v) => v + 1);
      }

      setTransitionState({ active: false, direction: null, progress: 0 });
      setViewModeState(nextMode);
    },
    [selectedLocation, viewMode]
  );

  const openSelectedInMap = useCallback(() => {
    if (selectedLocation) {
      setFocusCoordinates({
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      });
      setMapZoom((current) => Math.max(current, 4));
      setFocusRequestVersion((v) => v + 1);
    }
    setViewMode("map");
  }, [selectedLocation, setViewMode]);

  const openSelectedInGlobe = useCallback(() => {
    if (selectedLocation) {
      setFocusCoordinates({
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      });
      setGlobeDistance(2.2);
      setFocusRequestVersion((v) => v + 1);
    }
    setViewMode("globe");
  }, [selectedLocation, setViewMode]);

  const resetExplorerView = useCallback(() => {
    const layer = MAP_LAYERS[selectedLayerId];
    setFocusCoordinates({
      latitude: layer.center[0],
      longitude: layer.center[1],
    });
    setMapZoom(2);
    setGlobeDistance(3.2);
    setFocusRequestVersion((v) => v + 1);
    requestNavigationAction("reset");
  }, [requestNavigationAction, selectedLayerId]);

  const setTemporalMode = useCallback(
    (mode: TemporalMode) => {
      updateTemporal({ mode });
    },
    [updateTemporal]
  );

  const setTemporalDate = useCallback(
    (date: string) => {
      if (!date || date < EARLIEST_TEMPORAL_DATE || date > todayUTC) return;
      updateTemporal({ selectedDate: date, mode: "past" });
    },
    [todayUTC, updateTemporal]
  );

  const setFutureSolHorizon = useCallback(
    (value: string) => {
      if (value.trim() === "") return;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return;
      updateTemporal({
        futureSols: Math.max(1, Math.min(MAX_FUTURE_SOLS, Math.round(parsed))),
        mode: "future",
      });
    },
    [updateTemporal]
  );

  const clampFutureSols = useCallback(() => {
    updateTemporal({
      futureSols: Math.max(
        1,
        Math.min(MAX_FUTURE_SOLS, Math.round(temporal.futureSols))
      ),
    });
  }, [temporal.futureSols, updateTemporal]);

  const searchResults = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) {
      return {
        sites: EXPLORATION_SITES,
        saved: savedLocations,
      };
    }

    return {
      sites: EXPLORATION_SITES.filter((site) =>
        `${site.name} ${site.regionLabel} ${site.terrainType}`
          .toLowerCase()
          .includes(term)
      ),
      saved: savedLocations.filter((location) =>
        location.name.toLowerCase().includes(term)
      ),
    };
  }, [savedLocations, searchQuery]);

  const isSelectedRegion = useMemo(() => {
    if (!selectedLocation || !mission.region) return false;
    if (selectedLocation.site && mission.region.id === selectedLocation.site.id) {
      return true;
    }
    return sameCoords(mission.region.coordinates, selectedLocation, 0.0001);
  }, [mission.region, selectedLocation]);

  const isSelectedTarget = useMemo(() => {
    if (!selectedLocation) return false;
    return hasTargetAt(mission.scientificTargets, selectedLocation);
  }, [mission.scientificTargets, selectedLocation]);

  const startExpeditionAtSelectedLocation = useCallback(() => {
    if (!selectedLocation) {
      setStatusMessage("Select a valid Martian location before starting an expedition.");
      return;
    }

    const validCoords = normalizeCoordinates(selectedLocation);
    if (!validCoords) {
      setStatusMessage("Invalid expedition coordinates.");
      return;
    }

    const regionName =
      locationNameDraft.trim() || selectedLocation.name || "Custom Location";
    const regionId =
      selectedLocation.site?.id ??
      (selectedLocation.savedId
        ? `saved-${selectedLocation.savedId}`
        : `expedition-${validCoords.latitude.toFixed(4)}-${validCoords.longitude.toFixed(4)}`);

    const nextRegion = buildRegion(
      regionId,
      regionName,
      validCoords,
      selectedLocation.description
    );

    setRegion(nextRegion);

    updateMission({
      region: nextRegion,
      configuration: {
        startingLocation: { ...validCoords },
        scientificTargetIds: mission.configuration
          ? [...mission.configuration.scientificTargetIds]
          : mission.scientificTargets.map((t) => t.id),
        missionDurationSols: mission.configuration?.missionDurationSols ?? 30,
        hypotheticalEVADurationHours:
          mission.configuration?.hypotheticalEVADurationHours ?? 6,
        terrainPreferences: mission.configuration?.terrainPreferences
          ? { ...mission.configuration.terrainPreferences }
          : {
              preferredSlopeDegrees: 15,
              preferredRoughness: 0.4,
              avoidKnownObstacles: true,
            },
        sciencePriorities: mission.configuration
          ? [...mission.configuration.sciencePriorities]
          : ["Astrobiology", "Sedimentary Stratigraphy"],
        explorationStrategy:
          mission.configuration?.explorationStrategy ??
          `Surface expedition initialized at ${regionName}`,
      },
    });

    updateSimulation({
      currentPosition: { ...validCoords },
      isActive: true,
    });

    setFocusCoordinates(validCoords);
    setStatusMessage(`Expedition initialized at ${regionName}.`);
    setTransitionState({ active: false, direction: null, progress: 0 });
    setViewModeState("jezero");
  }, [
    locationNameDraft,
    mission.configuration,
    mission.scientificTargets,
    selectedLocation,
    setRegion,
    updateMission,
    updateSimulation,
  ]);

  const addSelectedAsTarget = useCallback(() => {
    if (!selectedLocation || isSelectedTarget) return;
    const validCoords = normalizeCoordinates(selectedLocation);
    if (!validCoords) return;

    const targetName =
      locationNameDraft.trim() || selectedLocation.name || "Custom Target";

    updateMission({
      scientificTargets: [
        ...toMutable(mission.scientificTargets),
        buildTarget(targetName, validCoords, selectedLocation.description),
      ],
    });
    setStatusMessage(`"${targetName}" added to scientific targets.`);
  }, [
    isSelectedTarget,
    locationNameDraft,
    mission.scientificTargets,
    selectedLocation,
    updateMission,
  ]);

  const value = useMemo<MarsExplorerContextValue>(
    () => ({
      viewMode,
      setViewMode,
      transitionState,

      selectedLayerId,
      setSelectedLayerId,
      opacity,
      setOpacity,
      overlayLayerId,
      setOverlayLayerId,
      overlayOpacity,
      setOverlayOpacity,
      showGeologyOverlay,
      setShowGeologyOverlay,
      geologyOpacity,
      setGeologyOpacity,
      tileConfig,
      layerLoading,
      layerError,
      retryLayer,
      textureStatus,
      setTextureStatus,

      focusCoordinates,
      updateCameraFocus,
      focusRequestVersion,
      globeDistance,
      setGlobeDistance,
      mapZoom,
      setMapZoom,

      navigationAction,
      navigationActionVersion,
      requestNavigationAction,

      selectedLocation,
      selectSite,
      selectCustomCoordinates,
      goToSavedLocation,
      clearSelection,

      savedLocations,
      locationNameDraft,
      setLocationNameDraft,
      saveSelectedLocation,
      removeLocation,

      searchQuery,
      setSearchQuery,
      searchOpen,
      setSearchOpen,
      searchResults,

      elevation,
      elevationLoading,
      elevationError,
      retryElevation,

      temporal,
      todayUTC,
      setTemporalMode,
      setTemporalDate,
      setFutureSolHorizon,
      clampFutureSols,

      statusMessage,
      setStatusMessage,

      isSelectedRegion,
      isSelectedTarget,
      startExpeditionAtSelectedLocation,
      addSelectedAsTarget,

      openSelectedInMap,
      openSelectedInGlobe,
      triggerZoomInToMap,
      triggerZoomOutToGlobe,
      resetExplorerView,
    }),
    [
      addSelectedAsTarget,
      clampFutureSols,
      clearSelection,
      elevation,
      elevationError,
      elevationLoading,
      focusCoordinates,
      focusRequestVersion,
      globeDistance,
      goToSavedLocation,
      isSelectedRegion,
      isSelectedTarget,
      layerError,
      layerLoading,
      locationNameDraft,
      mapZoom,
      navigationAction,
      navigationActionVersion,
      opacity,
      openSelectedInGlobe,
      openSelectedInMap,
      removeLocation,
      requestNavigationAction,
      resetExplorerView,
      retryElevation,
      retryLayer,
      saveSelectedLocation,
      savedLocations,
      searchOpen,
      searchQuery,
      searchResults,
      selectCustomCoordinates,
      selectSite,
      selectedLayerId,
      selectedLocation,
      setFutureSolHorizon,
      setSelectedLayerId,
      setTemporalDate,
      setTemporalMode,
      setViewMode,
      startExpeditionAtSelectedLocation,
      statusMessage,
      temporal,
      textureStatus,
      tileConfig,
      todayUTC,
      transitionState,
      triggerZoomInToMap,
      triggerZoomOutToGlobe,
      updateCameraFocus,
      viewMode,
    ]
  );

  return (
    <MarsExplorerContext.Provider value={value}>
      {children}
    </MarsExplorerContext.Provider>
  );
}

export function useMarsExplorer(): MarsExplorerContextValue {
  const context = useContext(MarsExplorerContext);
  if (!context) {
    throw new Error("useMarsExplorer must be used inside MarsExplorerProvider");
  }
  return context;
}

export function useOptionalMarsExplorer(): MarsExplorerContextValue | null {
  return useContext(MarsExplorerContext);
}

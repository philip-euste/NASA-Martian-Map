import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Canvas,
  useFrame,
  useThree,
} from "@react-three/fiber";
import {
  OrbitControls,
  Stars,
} from "@react-three/drei";
import * as THREE from "three";
import {
  MAP_LAYERS,
  type MapLayer,
  type MapLayerCategory,
  type MapLayerId,
} from "../data/mapLayers";
import MarsSurface, {
  coordinatesToVector,
  vectorToCoordinates,
} from "./MarsSurface";
import {
  EXPLORATION_SITES,
  getSiteByName,
} from "../data/explorationSites";
import { useOptionalMarsExplorer } from "../features/mars-explorer/useMarsExplorer";
import { MarsExplorerLocationPanel } from "../features/mars-explorer/MarsExplorerUI";
import {
  sameCoords,
  type SavedLocation,
} from "../features/mars-explorer/marsExplorer.types";
import type { Coordinates } from "../types";
import type { TileLayerConfig } from "../services/dataProviders";
import "./MarsGlobe.css";

export type Location = {
  name: string;
  latitude: number;
  longitude: number;
  description: string;
};

type MarsGlobeProps = {
  renderLocationActions?: (location: Location) => ReactNode;
};

const LOCATIONS: Location[] = EXPLORATION_SITES;

const LAYER_OPTIONS = Object.entries(MAP_LAYERS) as [MapLayerId, MapLayer][];

const LAYER_CATEGORIES: MapLayerCategory[] = [
  "basemap",
  "elevation",
  "geology",
  "composition",
  "atmosphere",
  "thermal",
];

const CATEGORY_LABELS: Record<MapLayerCategory, string> = {
  basemap: "Basemaps",
  elevation: "Elevation and Terrain",
  geology: "Geology",
  composition: "Composition",
  atmosphere: "Atmosphere",
  thermal: "Thermal and Infrared",
};

const direction = new THREE.Vector3();
const rotation = new THREE.Quaternion();
const stepRotation = new THREE.Quaternion();

function PointMarker({
  coordinates,
  selected,
  color,
  selectedColor = "#ffffff",
  onSelect,
}: {
  coordinates: Coordinates;
  selected: boolean;
  color: string;
  selectedColor?: string;
  onSelect?: () => void;
}) {
  const position = coordinatesToVector(
    coordinates.latitude,
    coordinates.longitude,
    1.014
  );

  return (
    <group position={position}>
      <mesh
        renderOrder={5}
        onClick={(event) => {
          if (!onSelect) return;
          event.stopPropagation();
          onSelect();
        }}
      >
        <sphereGeometry args={[selected ? 0.022 : 0.014, 18, 18]} />
        <meshBasicMaterial color={selected ? selectedColor : color} />
      </mesh>
      {selected && (
        <mesh renderOrder={4}>
          <sphereGeometry args={[0.032, 18, 18]} />
          <meshBasicMaterial
            color="#f47738"
            transparent
            opacity={0.42}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

function GlobeScene({
  selectedLayerId,
  selectedLayerName,
  sharedConfig,
  focusCoordinates,
  focusRequestVersion,
  initialDistance,
  sites,
  savedLocations,
  selectedPoint,
  selectedKind,
  selectedSiteName,
  selectedSavedId,
  onSelectSite,
  onSelectSaved,
  onSelectSurfacePoint,
  onCameraUpdate,
  onTextureLoaded,
}: {
  selectedLayerId: MapLayerId;
  selectedLayerName: string;
  sharedConfig?: TileLayerConfig | null;
  focusCoordinates: Coordinates;
  focusRequestVersion: number;
  initialDistance: number;
  sites: Location[];
  savedLocations: SavedLocation[];
  selectedPoint: Coordinates | null;
  selectedKind: "site" | "saved" | "custom" | null;
  selectedSiteName: string | null;
  selectedSavedId: number | null;
  onSelectSite: (location: Location) => void;
  onSelectSaved: (location: SavedLocation) => void;
  onSelectSurfacePoint: (coordinates: Coordinates) => void;
  onCameraUpdate: (coordinates: Coordinates, distance: number) => void;
  onTextureLoaded: (message: string) => void;
}) {
  const { camera } = useThree();
  const flyToDirection = useRef<THREE.Vector3 | null>(null);
  const flyToDistance = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const lastReportRef = useRef(0);

  // Position camera directly over current focusCoordinates on first mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const startVector = coordinatesToVector(
      focusCoordinates.latitude,
      focusCoordinates.longitude,
      initialDistance
    );
    camera.position.copy(startVector);
    camera.lookAt(0, 0, 0);
  }, [camera, focusCoordinates.latitude, focusCoordinates.longitude, initialDistance]);

  // Smoothly animate camera orientation when focusRequestVersion updates
  useEffect(() => {
    flyToDirection.current = coordinatesToVector(
      focusCoordinates.latitude,
      focusCoordinates.longitude,
      1
    ).normalize();
    flyToDistance.current = Math.min(Math.max(initialDistance, 1.75), 3.4);
  }, [
    focusCoordinates.latitude,
    focusCoordinates.longitude,
    focusRequestVersion,
    initialDistance,
  ]);

  useFrame((_, delta) => {
    const goal = flyToDirection.current;

    if (goal) {
      const currentDist = camera.position.length();
      direction.copy(camera.position).normalize();

      const progress = 1 - Math.exp(-delta * 6.5);
      rotation.setFromUnitVectors(direction, goal);
      stepRotation.identity().slerp(rotation, progress);
      direction.applyQuaternion(stepRotation).normalize();

      const targetDist = flyToDistance.current ?? currentDist;
      const nextDist = THREE.MathUtils.lerp(currentDist, targetDist, progress);

      camera.position.copy(direction).multiplyScalar(nextDist);
      camera.lookAt(0, 0, 0);

      if (
        direction.dot(goal) > 0.99995 &&
        Math.abs(nextDist - targetDist) < 0.01
      ) {
        flyToDirection.current = null;
        flyToDistance.current = null;
      }
    }

    const now = performance.now();
    if (now - lastReportRef.current > 120) {
      lastReportRef.current = now;
      const coords = vectorToCoordinates(camera.position);
      onCameraUpdate(coords, camera.position.length());
    }
  });

  return (
    <>
      <MarsSurface
        layerId={selectedLayerId}
        layerName={selectedLayerName}
        sharedConfig={sharedConfig}
        onTextureLoaded={onTextureLoaded}
        onSelectSurfacePoint={onSelectSurfacePoint}
      />

      {sites.map((location) => {
        const isSelected =
          selectedKind === "site" && selectedSiteName === location.name;
        return (
          <PointMarker
            key={location.name}
            coordinates={location}
            selected={isSelected}
            color="#ff9c52"
            onSelect={() => onSelectSite(location)}
          />
        );
      })}

      {savedLocations.map((location) => {
        const isSelected =
          selectedKind === "saved" && selectedSavedId === location.id;
        return (
          <PointMarker
            key={location.id}
            coordinates={location}
            selected={isSelected}
            color="#d8b48f"
            onSelect={() => onSelectSaved(location)}
          />
        );
      })}

      {selectedKind === "custom" && selectedPoint && (
        <PointMarker
          coordinates={selectedPoint}
          selected
          color="#f47738"
          selectedColor="#f47738"
        />
      )}

      <Stars
        radius={80}
        depth={50}
        count={2500}
        factor={4}
        fade
      />

      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={1.42}
        maxDistance={5}
        rotateSpeed={0.5}
        zoomSpeed={0.75}
        onStart={() => {
          flyToDirection.current = null;
          flyToDistance.current = null;
        }}
      />
    </>
  );
}

export default function MarsGlobe({
  renderLocationActions,
}: MarsGlobeProps = {}) {
  const shared = useOptionalMarsExplorer();

  // Standalone state fallback when rendered outside MarsExplorerProvider
  const [localSelectedLocation, setLocalSelectedLocation] =
    useState<Location | null>(null);
  const [localLayerId, setLocalLayerId] =
    useState<MapLayerId>("mars_viking_global");
  const [localStatus, setLocalStatus] =
    useState("Loading NASA imagery...");
  const [localFocus, setLocalFocus] = useState<Coordinates>({
    latitude: 18.4,
    longitude: 77.5,
  });
  const [localFocusVersion, setLocalFocusVersion] = useState(1);

  const distanceRef = useRef(shared?.globeDistance ?? 3.2);
  const cameraCoordsRef = useRef<Coordinates>(
    shared?.focusCoordinates ?? localFocus
  );

  const selectedLayerId = shared ? shared.selectedLayerId : localLayerId;
  const selectedLayer = MAP_LAYERS[selectedLayerId];
  const textureStatus = shared ? shared.textureStatus : localStatus;

  const handleTextureLoaded = useCallback(
    (message: string) => {
      if (shared) {
        shared.setTextureStatus(message);
      } else {
        setLocalStatus(message);
      }
    },
    [shared]
  );

  const handleSelectSite = useCallback(
    (location: Location) => {
      if (shared) {
        const site = getSiteByName(location.name);
        if (site) {
          shared.selectSite(site, { focus: true });
        } else {
          shared.selectCustomCoordinates(location, { focus: true });
        }
      } else {
        setLocalSelectedLocation(location);
        setLocalFocus({
          latitude: location.latitude,
          longitude: location.longitude,
        });
        setLocalFocusVersion((v) => v + 1);
      }
    },
    [shared]
  );

  const handleSelectSaved = useCallback(
    (location: SavedLocation) => {
      if (shared) {
        shared.goToSavedLocation(location, { focus: true });
      }
    },
    [shared]
  );

  const handleSelectSurfacePoint = useCallback(
    (coordinates: Coordinates) => {
      if (shared) {
        shared.selectCustomCoordinates(coordinates, { focus: false });
      }
    },
    [shared]
  );

  const handleCameraUpdate = useCallback(
    (coordinates: Coordinates, distance: number) => {
      distanceRef.current = distance;
      cameraCoordsRef.current = coordinates;
      if (shared) {
        shared.updateCameraFocus(coordinates);
        shared.setGlobeDistance(distance);
      }
    },
    [shared]
  );

  // Seamless zoom-in transition from 3D Globe into 2D Map as user approaches surface
  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!shared) return;
      if (event.deltaY < 0 && distanceRef.current <= 1.54) {
        const sel = shared.selectedLocation;
        const target =
          sel && sameCoords(sel, cameraCoordsRef.current, 18)
            ? { latitude: sel.latitude, longitude: sel.longitude }
            : cameraCoordsRef.current;
        shared.triggerZoomInToMap(target);
      }
    },
    [shared]
  );

  const selectedKind = shared
    ? shared.selectedLocation?.kind ?? null
    : localSelectedLocation
      ? "site"
      : null;

  const selectedSiteName = shared
    ? shared.selectedLocation?.kind === "site"
      ? shared.selectedLocation.name
      : null
    : localSelectedLocation?.name ?? null;

  const selectedSavedId = shared
    ? shared.selectedLocation?.savedId ?? null
    : null;

  const selectedPoint = shared
    ? shared.selectedLocation
      ? {
          latitude: shared.selectedLocation.latitude,
          longitude: shared.selectedLocation.longitude,
        }
      : null
    : localSelectedLocation;

  const focusCoordinates = shared ? shared.focusCoordinates : localFocus;
  const focusRequestVersion = shared
    ? shared.focusRequestVersion
    : localFocusVersion;

  return (
    <div className="mars-globe" onWheel={handleWheel}>
      {/* Standalone controls are only shown when MarsGlobe is rendered outside MarsExplorer */}
      {!shared && (
        <>
          <div className="mars-globe-header">
            <div>
              <h2>Mars Explorer</h2>
              <p>Interactive 3D planetary view</p>
            </div>

            <div className="mars-globe-layer-control">
              <label htmlFor="mars-globe-layer">Surface layer</label>
              <select
                id="mars-globe-layer"
                value={selectedLayerId}
                onChange={(event) => {
                  setLocalLayerId(event.target.value as MapLayerId);
                }}
              >
                {LAYER_CATEGORIES.map((category) => {
                  const categoryLayers = LAYER_OPTIONS.filter(
                    ([, layer]) => layer.category === category
                  );
                  if (categoryLayers.length === 0) return null;
                  return (
                    <optgroup key={category} label={CATEGORY_LABELS[category]}>
                      {categoryLayers.map(([id, layer]) => (
                        <option key={id} value={id}>
                          {layer.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>

            <span className="mars-globe-status">{textureStatus}</span>
          </div>

          <div className="mars-globe-layer-description">
            {selectedLayer.description}
          </div>
        </>
      )}

      <div className="mars-globe-canvas">
        <Canvas
          camera={{
            position: [0, 0, 3.2],
            fov: 45,
            near: 0.05,
            far: 200,
          }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: false,
          }}
        >
          <color attach="background" args={["#05070d"]} />

          <GlobeScene
            selectedLayerId={selectedLayerId}
            selectedLayerName={selectedLayer.name}
            sharedConfig={shared?.tileConfig}
            focusCoordinates={focusCoordinates}
            focusRequestVersion={focusRequestVersion}
            initialDistance={shared?.globeDistance ?? 3.2}
            sites={LOCATIONS}
            savedLocations={shared?.savedLocations ?? []}
            selectedPoint={selectedPoint}
            selectedKind={selectedKind}
            selectedSiteName={selectedSiteName}
            selectedSavedId={selectedSavedId}
            onSelectSite={handleSelectSite}
            onSelectSaved={handleSelectSaved}
            onSelectSurfacePoint={handleSelectSurfacePoint}
            onCameraUpdate={handleCameraUpdate}
            onTextureLoaded={handleTextureLoaded}
          />
        </Canvas>

        <div className="mars-globe-controls">
          {LOCATIONS.map((location) => (
            <button
              key={location.name}
              type="button"
              onClick={() => handleSelectSite(location)}
              className={
                selectedKind === "site" && selectedSiteName === location.name
                  ? "active"
                  : ""
              }
            >
              {location.name}
            </button>
          ))}

          {shared?.savedLocations.map((location) => (
            <button
              key={location.id}
              type="button"
              onClick={() => handleSelectSaved(location)}
              className={
                selectedKind === "saved" && selectedSavedId === location.id
                  ? "active"
                  : ""
              }
            >
              {location.name}
            </button>
          ))}
        </div>

        {shared ? (
          <MarsExplorerLocationPanel mode="globe" />
        ) : (
          localSelectedLocation && (
            <div className="mars-globe-location">
              <button
                type="button"
                aria-label="Close selected location"
                onClick={() => setLocalSelectedLocation(null)}
              >
                ×
              </button>

              <h3>{localSelectedLocation.name}</h3>
              <p>{localSelectedLocation.description}</p>
              <small>
                {localSelectedLocation.latitude.toFixed(2)}° latitude,{" "}
                {localSelectedLocation.longitude.toFixed(2)}° longitude
              </small>

              {renderLocationActions && (
                <div className="mars-globe-location-actions">
                  {renderLocationActions(localSelectedLocation)}
                </div>
              )}
            </div>
          )
        )}

        <div className="mars-globe-hint">
          Drag to rotate · Scroll in to enter 2D surface map
        </div>
      </div>
    </div>
  );
}

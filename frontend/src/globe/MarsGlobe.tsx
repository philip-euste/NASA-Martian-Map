import {
  useCallback,
  useEffect,
  useMemo,
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
  Line,
  Billboard,
  Text,
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
import { featureColor, featureSymbol, visibleGeologicalFeatures, type GeologicalFeature } from "../data/geologicalFeatures";
import { useOptionalMarsExplorer } from "../features/mars-explorer/useMarsExplorer";
import { MarsExplorerLocationPanel } from "../features/mars-explorer/MarsExplorerUI";
import {
  sameCoords,
  type ExplorerNavigationAction,
  type SavedLocation,
} from "../features/mars-explorer/marsExplorer.types";
import type { Coordinates } from "../types";
import type { TileLayerConfig } from "../services/dataProviders";
import "./MarsGlobe.css";
import type { Mesh } from "three";
import { apiUrl } from "../lib/api";

type StudyRegion = {
  readonly id: string;
  readonly name: string;
  readonly fallbackUrl: string;
};

const SUPPORTED_STUDY_REGIONS: readonly StudyRegion[] = [
  { id: "jezero", name: "Jezero Crater", fallbackUrl: "/data/boundaries/jezero.geojson" },
  { id: "gale", name: "Gale Crater", fallbackUrl: "/data/boundaries/gale.geojson" },
  { id: "valles-marineris", name: "Valles Marineris", fallbackUrl: "/data/boundaries/valles-marineris.geojson" },
  { id: "olympus-mons", name: "Olympus Mons", fallbackUrl: "/data/boundaries/olympus-mons.geojson" },
];

type GeoJSONPosition = [number, number, ...number[]];

type RegionGeometry =
  | {
      type: "Polygon";
      coordinates: GeoJSONPosition[][];
    }
  | {
      type: "MultiPolygon";
      coordinates: GeoJSONPosition[][][];
    };

type RegionFeature = {
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry: RegionGeometry;
};

function isRegionFeature(value: unknown): value is RegionFeature {
  if (!value || typeof value !== "object") return false;

  const feature = value as Record<string, unknown>;

  if (feature.type !== "Feature") return false;
  if (!feature.geometry || typeof feature.geometry !== "object") {
    return false;
  }

  const geometry = feature.geometry as Record<string, unknown>;

  if (
    geometry.type !== "Polygon" &&
    geometry.type !== "MultiPolygon"
  ) {
    return false;
  }

  return Array.isArray(geometry.coordinates);
}

function getBoundaryRings(
  feature: RegionFeature
): GeoJSONPosition[][] {
  if (feature.geometry.type === "Polygon") {
    return feature.geometry.coordinates;
  }

  return feature.geometry.coordinates.flat();
}

const BOUNDARY_RADIUS = 1.025;
const MAX_SEGMENT_DEG = 0.5;

// GeoJSON rings are sparse (a box has 4 vertices). Joining them with straight
// segments makes chords that dip below the sphere once an edge spans more than
// ~25 degrees. Subdividing in lon/lat keeps every point on the sphere, and the
// edges follow parallels and meridians like the 2D map.
function densifyRing(ring: GeoJSONPosition[]): THREE.Vector3[] {
  if (ring.length < 2) return [];

  const out: THREE.Vector3[] = [];

  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];

    // Shortest way across the +/-180 wrap.
    const dLon = ((lon2 - lon1 + 540) % 360) - 180;
    const dLat = lat2 - lat1;

    const n = Math.min(
      256,
      Math.max(
        1,
        Math.ceil(
          Math.max(Math.abs(dLon), Math.abs(dLat)) / MAX_SEGMENT_DEG
        )
      )
    );

    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push(
        coordinatesToVector(
          lat1 + dLat * t,
          lon1 + dLon * t,
          BOUNDARY_RADIUS
        )
      );
    }
  }

  const [lastLon, lastLat] = ring[ring.length - 1];
  out.push(coordinatesToVector(lastLat, lastLon, BOUNDARY_RADIUS));

  return out;
}

// Filled interior, matching MarsMap's region style (fill #75b9c2 @ 0.16).
const FILL_RADIUS = 1.02; // below the outline (1.025), above the surface
const FILL_COLOR = "#75b9c2";
const FILL_OPACITY = 0.16;
const FILL_STEP_DEG = 1;
const FILL_MAX_DEPTH = 6;
const FILL_MAX_TRIANGLES = 150_000;

function getPolygons(feature: RegionFeature): GeoJSONPosition[][][] {
  return feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
}

// Triangulate in lon/lat, then 4-way subdivide each triangle until its longest
// edge is <= FILL_STEP_DEG and lift every vertex onto the sphere. Without the
// subdivision, a big triangle is flat and cuts through the planet just like the
// straight outline chords did.
function buildFillGeometry(feature: RegionFeature): THREE.BufferGeometry | null {
  const positions: number[] = [];
  let triangles = 0;

  const strip = (ring: GeoJSONPosition[]): THREE.Vector2[] => {
    const pts = ring.map(([lon, lat]) => new THREE.Vector2(lon, lat));
    if (pts.length > 1 && pts[0].equals(pts[pts.length - 1])) pts.pop();
    return pts;
  };

  const mid = (a: THREE.Vector2, b: THREE.Vector2) =>
    new THREE.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2);

  const emit = (
    a: THREE.Vector2,
    b: THREE.Vector2,
    c: THREE.Vector2,
    depth: number
  ) => {
    const longest = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));

    if (
      longest <= FILL_STEP_DEG ||
      depth >= FILL_MAX_DEPTH ||
      triangles >= FILL_MAX_TRIANGLES
    ) {
      for (const v of [a, b, c]) {
        const p = coordinatesToVector(v.y, v.x, FILL_RADIUS);
        positions.push(p.x, p.y, p.z);
      }
      triangles += 1;
      return;
    }

    const ab = mid(a, b);
    const bc = mid(b, c);
    const ca = mid(c, a);

    emit(a, ab, ca, depth + 1);
    emit(ab, b, bc, depth + 1);
    emit(ca, bc, c, depth + 1);
    emit(ab, bc, ca, depth + 1);
  };

  for (const rings of getPolygons(feature)) {
    const [outerRing, ...holeRings] = rings;
    if (!outerRing) continue;

    const contour = strip(outerRing);
    if (contour.length < 3) continue;

    const holes = holeRings.map(strip).filter((hole) => hole.length >= 3);
    const all = contour.concat(...holes);

    for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(contour, holes)) {
      emit(all[i], all[j], all[k], 0);
    }
  }

  if (positions.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  return geometry;
}

function RegionBoundary({
  region,
  feature,
}: {
  region: StudyRegion;
  feature: RegionFeature;
}) {
  const rings = useMemo(
    () => getBoundaryRings(feature).map(densifyRing),
    [feature]
  );

  const fillGeometry = useMemo(() => buildFillGeometry(feature), [feature]);

  useEffect(() => () => fillGeometry?.dispose(), [fillGeometry]);

  return (
    <group>
      {fillGeometry && (
        <mesh
          geometry={fillGeometry}
          renderOrder={1}
          raycast={() => null} // never block clicks on the surface underneath
        >
          <meshBasicMaterial
            color={FILL_COLOR}
            transparent
            opacity={FILL_OPACITY}
            side={THREE.DoubleSide}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )}

      {rings.map((points, index) => {
        if (points.length < 2) return null;

        return (
          <Line
            key={`${region.id}-${index}`}
            points={points}
            color="#38bdf8"
            lineWidth={2.5}
            dashed
            dashSize={0.025}
            gapSize={0.015}
            transparent
            opacity={1}
            depthWrite={false}
            renderOrder={2}
          />
        );
      })}
    </group>
  );
}

function RotatingMars() {
  const marsRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (marsRef.current) {
      marsRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <mesh ref={marsRef}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial color="#c1440e" roughness={0.9} metalness={0} />
    </mesh>
  );
}

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
const EMPTY_SAVED_LOCATIONS: SavedLocation[] = [];

const LAYER_OPTIONS = Object.entries(MAP_LAYERS) as [
  MapLayerId,
  MapLayer
][];

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

const MIN_GLOBE_DISTANCE = 1.42;
const MAX_GLOBE_DISTANCE = 5;
const DEFAULT_GLOBE_DISTANCE = 3.2;
const GLOBE_ZOOM_STEP = 0.35;

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
        <sphereGeometry
          args={[
            selected ? 0.022 : 0.014,
            12,
            12,
          ]}
        />

        <meshBasicMaterial
          color={selected ? selectedColor : color}
        />
      </mesh>

      {selected && (
        <mesh renderOrder={4}>
          <sphereGeometry args={[0.032, 12, 12]} />

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

function GeologicalMarker({ feature, selected, showLabel, onSelect }: {
  feature: GeologicalFeature;
  selected: boolean;
  showLabel: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const symbol = featureSymbol(feature.classification);
  const color = featureColor(feature.classification);
  const position = coordinatesToVector(feature.latitude, feature.longitude, 1.017);
  return <group position={position}>
    <mesh renderOrder={6} onClick={(event) => { event.stopPropagation(); onSelect(); }} onPointerOver={(event) => { event.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }} onPointerOut={() => { setHovered(false); document.body.style.cursor = ""; }}>
      {symbol === "▲" ? <coneGeometry args={[selected ? 0.024 : 0.017, selected ? 0.042 : 0.028, 5]} /> :
       symbol === "◎" ? <torusGeometry args={[selected ? 0.018 : 0.013, 0.004, 5, 12]} /> :
       symbol === "▰" ? <boxGeometry args={[0.028, 0.013, 0.012]} /> :
       symbol === "⌄" ? <octahedronGeometry args={[selected ? 0.024 : 0.017]} /> :
       <sphereGeometry args={[selected ? 0.02 : 0.014, 8, 8]} />}
      <meshBasicMaterial color={selected ? "#ffffff" : color} depthTest />
    </mesh>
    {(showLabel || selected || hovered) && <Billboard follow position={[0, 0.045, 0]}>
      <Text fontSize={selected ? 0.031 : 0.023} color="#ffffff" outlineWidth={0.004} outlineColor="#071013" anchorX="center" anchorY="middle" maxWidth={0.32}>
        {feature.name}{selected || hovered ? ` · ${feature.classification}` : ""}
      </Text>
    </Billboard>}
  </group>;
}

function GlobeScene({
  selectedLayerId,
  selectedLayerName,
  sharedConfig,
  overlayLayerId,
  overlayOpacity,
  focusCoordinates,
  focusRequestVersion,
  navigationAction,
  navigationActionVersion,
  initialDistance,
  sites,
  showLocations,
  geologicalFeatures,
  selectedFeatureId,
  onSelectGeologicalFeature,
  savedLocations,
  selectedPoint,
  selectedKind,
  selectedSiteName,
  selectedSavedId,
  selectedStudyRegionId,
  showStudyRegionBoundary,
  onSelectSite,
  onSelectSaved,
  onSelectSurfacePoint,
  onCameraUpdate,
  onTextureLoaded,
}: {
  selectedLayerId: MapLayerId;
  selectedLayerName: string;
  sharedConfig?: TileLayerConfig | null;
  overlayLayerId?: MapLayerId | null;
  overlayOpacity: number;
  focusCoordinates: Coordinates;
  focusRequestVersion: number;
  navigationAction: ExplorerNavigationAction | null;
  navigationActionVersion: number;
  initialDistance: number;
  sites: Location[];
  showLocations: boolean;
  geologicalFeatures: GeologicalFeature[];
  selectedFeatureId: string | null;
  onSelectGeologicalFeature: (feature: GeologicalFeature) => void;
  savedLocations: SavedLocation[];
  selectedPoint: Coordinates | null;
  selectedKind: "site" | "saved" | "custom" | "geological" | null;
  selectedSiteName: string | null;
  selectedSavedId: number | null;
  selectedStudyRegionId: string | null;
  showStudyRegionBoundary: boolean;
  onSelectSite: (location: Location) => void;
  onSelectSaved: (location: SavedLocation) => void;
  onSelectSurfacePoint: (coordinates: Coordinates) => void;
  onCameraUpdate: (
    coordinates: Coordinates,
    distance: number
  ) => void;
  onTextureLoaded: (message: string) => void;
}) {
  const { camera } = useThree();

  const [boundaryFeatures, setBoundaryFeatures] = useState<
    Record<string, RegionFeature>
  >({});

  const [boundaryErrors, setBoundaryErrors] = useState<string[]>([]);

  const flyToDirection = useRef<THREE.Vector3 | null>(null);
  const flyToDistance = useRef<number | null>(null);

  const initializedRef = useRef(false);

  const lastReportRef = useRef(0);

  const lastReportedDirectionRef = useRef(
    new THREE.Vector3()
  );

  const lastReportedDistanceRef = useRef<number | null>(
    null
  );

  const lastNavigationVersionRef = useRef(0);

  const latestFocusRef = useRef(focusCoordinates);
  const latestDistanceRef = useRef(initialDistance);

  latestFocusRef.current = focusCoordinates;
  latestDistanceRef.current = initialDistance;

  useEffect(() => {
    const controller = new AbortController();

    async function loadBoundaries() {
      const results = await Promise.all(
        SUPPORTED_STUDY_REGIONS.map(async (region) => {
          try {
            const response = await fetch(
              apiUrl(`/api/regions/${encodeURIComponent(region.id)}/boundary`),
              {
                signal: controller.signal,
                headers: {
                  Accept: "application/json",
                },
              }
            );

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const payload: unknown = await response.json();

            if (
              !payload ||
              typeof payload !== "object" ||
              !("feature" in payload) ||
              !isRegionFeature(payload.feature)
            ) {
              throw new Error("Invalid GeoJSON response");
            }

            return {
              region,
              feature: payload.feature,
              error: null,
            };
          } catch (error) {
            if (controller.signal.aborted) return null;

            try {
              const response = await fetch(region.fallbackUrl, { signal: controller.signal });
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const payload: unknown = await response.json();
              if (!isRegionFeature(payload)) throw new Error("Invalid offline GeoJSON");
              return { region, feature: payload, error: "Using approximate offline DEM coverage outline." };
            } catch {
              if (controller.signal.aborted) return null;
            }

            return {
              region,
              feature: null,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown error",
            };
          }
        })
      );

      if (controller.signal.aborted) return;

      const features: Record<string, RegionFeature> = {};
      const errors: string[] = [];

      for (const result of results) {
        if (!result) continue;

        if (result.feature) {
          features[result.region.id] = result.feature;
        }
        if (result.error) {
          errors.push(
            `${result.region.name}: ${result.error}`
          );
        }
      }

      setBoundaryFeatures(features);
      setBoundaryErrors(errors);
    }

    void loadBoundaries();

    return () => {
      controller.abort();
    };
  }, []);

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
  }, [camera, focusCoordinates, initialDistance]);

  useEffect(() => {
    const focus = latestFocusRef.current;

    flyToDirection.current = coordinatesToVector(
      focus.latitude,
      focus.longitude,
      1
    ).normalize();

    flyToDistance.current = Math.min(
      Math.max(latestDistanceRef.current, 1.75),
      3.4
    );
  }, [focusRequestVersion]);

  useEffect(() => {
    if (navigationActionVersion === lastNavigationVersionRef.current) {
      return;
    }

    lastNavigationVersionRef.current = navigationActionVersion;

    const currentDirection = camera.position.clone().normalize();
    const currentDistance = camera.position.length();

    switch (navigationAction) {
      case "zoom-in": {
        const nextDistance = THREE.MathUtils.clamp(
          currentDistance - GLOBE_ZOOM_STEP,
          MIN_GLOBE_DISTANCE,
          MAX_GLOBE_DISTANCE
        );

        flyToDirection.current = currentDirection;
        flyToDistance.current = nextDistance;
        break;
      }

      case "zoom-out": {
        const nextDistance = THREE.MathUtils.clamp(
          currentDistance + GLOBE_ZOOM_STEP,
          MIN_GLOBE_DISTANCE,
          MAX_GLOBE_DISTANCE
        );

        flyToDirection.current = currentDirection;
        flyToDistance.current = nextDistance;
        break;
      }

      case "reset": {
        const focus = latestFocusRef.current;

        flyToDirection.current = coordinatesToVector(
          focus.latitude,
          focus.longitude,
          1
        ).normalize();

        flyToDistance.current = DEFAULT_GLOBE_DISTANCE;
        break;
      }

      default:
        break;
    }
  }, [camera, navigationAction, navigationActionVersion]);

  useFrame((_, delta) => {
    const goal = flyToDirection.current;

    if (goal) {
      const currentDistance = camera.position.length();

      direction.copy(camera.position).normalize();

      const progress = 1 - Math.exp(-delta * 6.5);

      rotation.setFromUnitVectors(direction, goal);

      stepRotation.identity().slerp(
        rotation,
        progress
      );

      direction.applyQuaternion(stepRotation).normalize();

      const targetDistance =
        flyToDistance.current ?? currentDistance;

      const nextDistance = THREE.MathUtils.lerp(
        currentDistance,
        targetDistance,
        progress
      );

      camera.position
        .copy(direction)
        .multiplyScalar(nextDistance);

      camera.lookAt(0, 0, 0);

      if (
        direction.dot(goal) > 0.99995 &&
        Math.abs(nextDistance - targetDistance) < 0.01
      ) {
        flyToDirection.current = null;
        flyToDistance.current = null;
      }
    }

    const now = performance.now();

    if (now - lastReportRef.current < 250) {
      return;
    }

    lastReportRef.current = now;

    const currentDistance = camera.position.length();

    const currentDirection = direction
      .copy(camera.position)
      .normalize();

    const previousDirection =
      lastReportedDirectionRef.current;

    const previousDistance =
      lastReportedDistanceRef.current;

    const directionChanged =
      previousDistance === null ||
      currentDirection.angleTo(previousDirection) >
        THREE.MathUtils.degToRad(0.05);

    const distanceChanged =
      previousDistance === null ||
      Math.abs(currentDistance - previousDistance) > 0.008;

    if (!directionChanged && !distanceChanged) {
      return;
    }

    previousDirection.copy(currentDirection);

    lastReportedDistanceRef.current = currentDistance;

    const coordinates = vectorToCoordinates(
      camera.position
    );

    onCameraUpdate(
      coordinates,
      currentDistance
    );
  });

  const displayedFeatures = useMemo(() => {
    const detail = initialDistance < 2.1 ? "close" : initialDistance < 2.8 ? "regional" : "overview";
    const visible = visibleGeologicalFeatures(geologicalFeatures, detail);
    const selected = geologicalFeatures.find((feature) => feature.id === selectedFeatureId);
    return selected && !visible.some((feature) => feature.id === selected.id) ? [...visible, selected] : visible;
  }, [geologicalFeatures, initialDistance, selectedFeatureId]);

  return (
    <>
      <MarsSurface
        layerId={selectedLayerId}
        layerName={selectedLayerName}
        sharedConfig={sharedConfig}
        overlayLayerId={overlayLayerId}
        overlayOpacity={overlayOpacity}
        onTextureLoaded={onTextureLoaded}
        onSelectSurfacePoint={onSelectSurfacePoint}
      />

      {SUPPORTED_STUDY_REGIONS.map((region) => {
        const feature = showStudyRegionBoundary && region.id === selectedStudyRegionId
          ? boundaryFeatures[region.id]
          : null;

        if (!feature) return null;

        const selected = selectedStudyRegionId === region.id;

        return (
          <group key={region.id}>
            <RegionBoundary
              region={region}
              feature={feature}
            />
          </group>
        );
      })}

      {showLocations && sites.map((location) => {
        const isSelected =
          selectedKind === "site" &&
          selectedSiteName === location.name;

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

      {showLocations && displayedFeatures.map((feature, index) => <GeologicalMarker key={feature.id} feature={feature} selected={selectedFeatureId === feature.id} showLabel={initialDistance < 2.2 && index < 16} onSelect={() => onSelectGeologicalFeature(feature)} />)}

      {showLocations && savedLocations.map((location) => {
        const isSelected =
          selectedKind === "saved" &&
          selectedSavedId === location.id;

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
        count={1000}
        factor={3}
        fade
      />

      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={MIN_GLOBE_DISTANCE}
        maxDistance={MAX_GLOBE_DISTANCE}
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

  const sharedRef = useRef(shared);
  sharedRef.current = shared;

  const [localSelectedLocation, setLocalSelectedLocation] =
    useState<Location | null>(null);

  const [localLayerId, setLocalLayerId] =
    useState<MapLayerId>("mars_viking_global");

  const [localStatus, setLocalStatus] =
    useState("Loading NASA imagery...");

  const [localFocus, setLocalFocus] =
    useState<Coordinates>({
      latitude: 18.4,
      longitude: 77.5,
    });

  const [localFocusVersion, setLocalFocusVersion] =
    useState(1);

  const distanceRef = useRef(
    shared?.globeDistance ?? DEFAULT_GLOBE_DISTANCE
  );

  const cameraCoordsRef = useRef<Coordinates>(
    shared?.focusCoordinates ?? localFocus
  );

  const selectedLayerId = shared
    ? shared.selectedLayerId
    : localLayerId;

  const selectedLayer = MAP_LAYERS[selectedLayerId];

  const textureStatus = shared
    ? shared.textureStatus
    : localStatus;

  const handleTextureLoaded = useCallback(
    (message: string) => {
      const currentShared = sharedRef.current;

      if (currentShared) {
        currentShared.setTextureStatus(message);
      } else {
        setLocalStatus(message);
      }
    },
    []
  );

  const handleSelectSite = useCallback(
    (location: Location) => {
      const currentShared = sharedRef.current;

      if (currentShared) {
        const site = getSiteByName(location.name);

        if (site) {
          currentShared.selectSite(site, {
            focus: true,
          });
        } else {
          currentShared.selectCustomCoordinates(
            location,
            { focus: true }
          );
        }
      } else {
        setLocalSelectedLocation(location);

        setLocalFocus({
          latitude: location.latitude,
          longitude: location.longitude,
        });

        setLocalFocusVersion((version) => version + 1);
      }
    },
    []
  );

  const handleSelectSaved = useCallback(
    (location: SavedLocation) => {
      const currentShared = sharedRef.current;

      if (!currentShared) return;

      currentShared.goToSavedLocation(location, {
        focus: true,
      });
    },
    []
  );

  const handleSelectGeologicalFeature = useCallback((feature: GeologicalFeature) => {
    sharedRef.current?.selectGeologicalFeature(feature, { focus: true });
  }, []);

  const handleSelectSurfacePoint = useCallback(
    (coordinates: Coordinates) => {
      const currentShared = sharedRef.current;

      if (!currentShared) return;

      currentShared.selectCustomCoordinates(
        coordinates,
        { focus: false }
      );
    },
    []
  );

  const handleCameraUpdate = useCallback(
    (
      coordinates: Coordinates,
      distance: number
    ) => {
      distanceRef.current = distance;
      cameraCoordsRef.current = coordinates;

      const currentShared = sharedRef.current;

      if (!currentShared) return;

      currentShared.updateCameraFocus(coordinates);
      currentShared.setGlobeDistance(distance);
    },
    []
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const currentShared = sharedRef.current;

      if (!currentShared) return;

      if (
        event.deltaY < 0 &&
        distanceRef.current <= 1.54
      ) {
        const selectedLocation =
          currentShared.selectedLocation;

        const target =
          selectedLocation &&
          sameCoords(
            selectedLocation,
            cameraCoordsRef.current,
            18
          )
            ? {
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
              }
            : cameraCoordsRef.current;

        currentShared.triggerZoomInToMap(target);
      }
    },
    []
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

  const focusCoordinates = shared
    ? shared.focusCoordinates
    : localFocus;

  const focusRequestVersion = shared
    ? shared.focusRequestVersion
    : localFocusVersion;

  const savedLocations =
    shared?.savedLocations ?? EMPTY_SAVED_LOCATIONS;

  return (
    <div
      className="mars-globe"
      onWheel={handleWheel}
    >
      {!shared && (
        <>
          <div className="mars-globe-header">
            <div>
              <h2>Mars Explorer</h2>
              <p>Interactive 3D planetary view</p>
            </div>

            <div className="mars-globe-layer-control">
              <label htmlFor="mars-globe-layer">
                Surface layer
              </label>

              <select
                id="mars-globe-layer"
                value={selectedLayerId}
                onChange={(event) => {
                  setLocalLayerId(
                    event.target.value as MapLayerId
                  );
                }}
              >
                {LAYER_CATEGORIES.map((category) => {
                  const categoryLayers =
                    LAYER_OPTIONS.filter(
                      ([, layer]) =>
                        layer.category === category
                    );

                  if (categoryLayers.length === 0) {
                    return null;
                  }

                  return (
                    <optgroup
                      key={category}
                      label={CATEGORY_LABELS[category]}
                    >
                      {categoryLayers.map(([id, layer]) => (
                        <option
                          key={id}
                          value={id}
                        >
                          {layer.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>

            <span className="mars-globe-status">
              {textureStatus}
            </span>
          </div>

          <div className="mars-globe-layer-description">
            {selectedLayer.description}
          </div>
        </>
      )}

      <div className="mars-globe-canvas">
        <Canvas
          camera={{
            position: [0, 0, DEFAULT_GLOBE_DISTANCE],
            fov: 45,
            near: 0.05,
            far: 200,
          }}
          dpr={[1, 1.25]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          }}
        >
          <color
            attach="background"
            args={["#05070d"]}
          />

          <GlobeScene
            selectedLayerId={selectedLayerId}
            selectedLayerName={selectedLayer.name}
            sharedConfig={shared?.tileConfig}
            overlayLayerId={shared?.overlayLayerId}
            overlayOpacity={shared?.overlayOpacity ?? 0.65}
            focusCoordinates={focusCoordinates}
            focusRequestVersion={focusRequestVersion}
            navigationAction={shared?.navigationAction ?? null}
            navigationActionVersion={shared?.navigationActionVersion ?? 0}
            initialDistance={
              shared?.globeDistance ?? DEFAULT_GLOBE_DISTANCE
            }
            sites={LOCATIONS}
            showLocations={shared?.showGlobeLocations ?? true}
            geologicalFeatures={shared?.geologicalFeatures ?? []}
            selectedFeatureId={shared?.selectedLocation?.geologicalFeature?.id ?? null}
            onSelectGeologicalFeature={handleSelectGeologicalFeature}
            savedLocations={savedLocations}
            selectedPoint={selectedPoint}
            selectedKind={selectedKind}
            selectedSiteName={selectedSiteName}
            selectedSavedId={selectedSavedId}
            selectedStudyRegionId={
              shared?.selectedStudyRegionId ?? "jezero"
            }
            showStudyRegionBoundary={shared?.showStudyRegionBoundary ?? false}
            onSelectSite={handleSelectSite}
            onSelectSaved={handleSelectSaved}
            onSelectSurfacePoint={
              handleSelectSurfacePoint
            }
            onCameraUpdate={handleCameraUpdate}
            onTextureLoaded={handleTextureLoaded}
          />
        </Canvas>

        {shared ? (
          <MarsExplorerLocationPanel mode="globe" />
        ) : (
          localSelectedLocation && (
            <div className="mars-globe-location">
              <button
                type="button"
                aria-label="Close selected location"
                onClick={() => {
                  setLocalSelectedLocation(null);
                }}
              >
                ×
              </button>

              <h3>{localSelectedLocation.name}</h3>

              <p>
                {localSelectedLocation.description}
              </p>

              <small>
                {localSelectedLocation.latitude.toFixed(2)}°
                latitude,{" "}
                {localSelectedLocation.longitude.toFixed(2)}°
                longitude
              </small>

              {renderLocationActions && (
                <div className="mars-globe-location-actions">
                  {renderLocationActions(
                    localSelectedLocation
                  )}
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

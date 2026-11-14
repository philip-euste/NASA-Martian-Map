
import {
  useCallback,
  useEffect,
  useRef,
  useState,
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
} from "./MarsSurface";

// ==========================================
// TYPES
// ==========================================

type Location = {
  name: string;
  latitude: number;
  longitude: number;
  description: string;
};

type MarsGlobeProps = {
  selectedLocationName: string;
  onLocationSelect: (name: string) => void;
};

// ==========================================
// LOCATIONS
// ==========================================

const LOCATIONS: Location[] = [
  {
    name: "Jezero Crater",
    latitude: 18.4,
    longitude: 77.5,
    description:
      "Ancient lake basin and Perseverance rover exploration site.",
  },
  {
    name: "Gale Crater",
    latitude: -5.4,
    longitude: 137.8,
    description:
      "Exploration region of the Curiosity rover.",
  },
  {
    name: "Valles Marineris",
    latitude: -13.9,
    longitude: -59.2,
    description:
      "A vast canyon system near the Martian equator.",
  },
  {
    name: "Olympus Mons",
    latitude: 18.65,
    longitude: -133.8,
    description:
      "One of the largest volcanoes in the Solar System.",
  },
];

// ==========================================
// LAYER CONFIGURATION
// ==========================================

const LAYER_OPTIONS = Object.entries(
  MAP_LAYERS
) as [
  MapLayerId,
  MapLayer,
][];

const LAYER_CATEGORIES: MapLayerCategory[] = [
  "basemap",
  "elevation",
  "geology",
  "composition",
  "atmosphere",
  "thermal",
];

const CATEGORY_LABELS: Record<
  MapLayerCategory,
  string
> = {
  basemap: "Basemaps",
  elevation: "Elevation and Terrain",
  geology: "Geology",
  composition: "Composition",
  atmosphere: "Atmosphere",
  thermal: "Thermal and Infrared",
};

// ==========================================
// CAMERA UTILITIES
// ==========================================

const _direction = new THREE.Vector3();
const _fullQuaternion = new THREE.Quaternion();
const _stepQuaternion = new THREE.Quaternion();

// ==========================================
// LOCATION MARKER
// ==========================================

function LocationMarker({
  location,
  selected,
  onSelect,
}: {
  location: Location;
  selected: boolean;
  onSelect: (location: Location) => void;
}) {
  const position = coordinatesToVector(
    location.latitude,
    location.longitude,
    1.018
  );

  return (
    <group position={position}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(location);
        }}
      >
        <sphereGeometry
          args={[
            selected ? 0.025 : 0.016,
            16,
            16,
          ]}
        />

        <meshBasicMaterial
          color={
            selected
              ? "#ffffff"
              : "#ff9c52"
          }
        />
      </mesh>
    </group>
  );
}

// ==========================================
// GLOBE SCENE
// ==========================================

function GlobeScene({
  selectedLocation,
  selectedLayerId,
  selectedLayerName,
  onSelectLocation,
  onTextureLoaded,
}: {
  selectedLocation: Location | null;
  selectedLayerId: MapLayerId;
  selectedLayerName: string;
  onSelectLocation: (location: Location) => void;
  onTextureLoaded: (message: string) => void;
}) {
  const { camera } = useThree();

  const flyTo = useRef<THREE.Vector3 | null>(
    null
  );

  // ========================================
  // LOCATION CAMERA TARGET
  // ========================================

  useEffect(() => {
    flyTo.current = selectedLocation
      ? coordinatesToVector(
          selectedLocation.latitude,
          selectedLocation.longitude,
          1
        ).normalize()
      : null;
  }, [selectedLocation]);

  // ========================================
  // CAMERA ANIMATION
  // ========================================

  useFrame((_, delta) => {
    const goal = flyTo.current;

    if (!goal) return;

    _direction
      .copy(camera.position)
      .normalize();

    if (_direction.dot(goal) > 0.99999) {
      flyTo.current = null;
      return;
    }

    const t = 1 - Math.exp(-delta * 6);

    _fullQuaternion.setFromUnitVectors(
      _direction,
      goal
    );

    _stepQuaternion
      .identity()
      .slerp(_fullQuaternion, t);

    camera.position.applyQuaternion(
      _stepQuaternion
    );

    camera.lookAt(0, 0, 0);
  });

  // ========================================
  // SCENE
  // ========================================

  return (
    <>
      <MarsSurface
        layerId={selectedLayerId}
        layerName={selectedLayerName}
        onTextureLoaded={onTextureLoaded}
      />

      {LOCATIONS.map((location) => (
        <LocationMarker
          key={location.name}
          location={location}
          selected={
            selectedLocation?.name === location.name
          }
          onSelect={onSelectLocation}
        />
      ))}

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
        minDistance={1.5}
        maxDistance={5}
        rotateSpeed={0.5}
        zoomSpeed={0.7}
        onStart={() => {
          flyTo.current = null;
        }}
      />
    </>
  );
}

// ==========================================
// MAIN MARS GLOBE COMPONENT
// ==========================================

export default function MarsGlobe({
  selectedLocationName,
  onLocationSelect,
}: MarsGlobeProps) {
  const [selectedLayerId, setSelectedLayerId] =
    useState<MapLayerId>("mars_global_mola");

  const [textureStatus, setTextureStatus] =
    useState("Loading NASA imagery...");

  // ========================================
  // SELECTED LOCATION
  // ========================================

  const selectedLocation =
    LOCATIONS.find(
      (location) =>
        location.name === selectedLocationName
    ) ?? null;

  // ========================================
  // SELECTED LAYER
  // ========================================

  const selectedLayer =
    MAP_LAYERS[selectedLayerId];

  // ========================================
  // CALLBACKS
  // ========================================

  const handleTextureLoaded = useCallback(
    (message: string) => {
      setTextureStatus(message);
    },
    []
  );

  const handleSelectLocation = useCallback(
    (location: Location) => {
      onLocationSelect(location.name);
    },
    [onLocationSelect]
  );

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="mars-globe">

      {/* HEADER */}

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
              setSelectedLayerId(
                event.target.value as MapLayerId
              );
            }}
            style={{
              display: "block",
              minWidth: "230px",
              padding: "9px 12px",
              marginTop: "5px",
              color: "#ffffff",
              background: "#171c29",
              border: "1px solid #424b5e",
              borderRadius: "6px",
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
                  {categoryLayers.map(
                    ([id, layer]) => (
                      <option
                        key={id}
                        value={id}
                      >
                        {layer.name}
                      </option>
                    )
                  )}
                </optgroup>
              );
            })}
          </select>
        </div>

        <span className="mars-globe-status">
          {textureStatus}
        </span>
      </div>

      {/* LAYER DESCRIPTION */}

      <div
        className="mars-globe-layer-description"
        style={{
          margin: "8px 0 12px",
          color: "#aeb8c9",
          fontSize: "13px",
        }}
      >
        {selectedLayer.description}
      </div>

      {/* GLOBE CANVAS */}

      <div
        className="mars-globe-canvas"
        style={{
          width: "100%",
          height: "600px",
          position: "relative",
          overflow: "hidden",
          background: "#05070d",
          borderRadius: "12px",
        }}
      >
        <Canvas
          camera={{
            position: [0, 0, 3.2],
            fov: 45,
            near: 0.1,
            far: 200,
          }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: false,
          }}
        >
          <color
            attach="background"
            args={["#05070d"]}
          />

          <GlobeScene
            selectedLocation={selectedLocation}
            selectedLayerId={selectedLayerId}
            selectedLayerName={selectedLayer.name}
            onSelectLocation={handleSelectLocation}
            onTextureLoaded={handleTextureLoaded}
          />
        </Canvas>

        {/* LOCATION BUTTONS */}

        <div className="mars-globe-controls">
          {LOCATIONS.map((location) => (
            <button
              key={location.name}
              type="button"
              onClick={() =>
                handleSelectLocation(location)
              }
              className={
                selectedLocation?.name === location.name
                  ? "active"
                  : ""
              }
            >
              {location.name}
            </button>
          ))}
        </div>

        {/* SELECTED LOCATION INFORMATION */}

        {selectedLocation && (
          <div className="mars-globe-location">
            <h3>
              {selectedLocation.name}
            </h3>

            <p>
              {selectedLocation.description}
            </p>

            <small>
              {selectedLocation.latitude.toFixed(2)}°
              latitude,{" "}
              {selectedLocation.longitude.toFixed(2)}°
              longitude
            </small>
          </div>
        )}

        {/* INTERACTION HINT */}

        <div className="mars-globe-hint">
          Drag to rotate · Scroll to zoom
        </div>
      </div>
    </div>
  );
}

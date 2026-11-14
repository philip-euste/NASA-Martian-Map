
import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";

import {
  MAP_LAYERS,
  type MapLayer,
  type MapLayerCategory,
  type MapLayerId,
} from "../data/mapLayers";

import { getDataProvider } from "../services/dataProviders";

type Location = {
  name: string;
  latitude: number;
  longitude: number;
  description: string;
};

const LOCATIONS: Location[] = [
  {
    name: "Jezero Crater",
    latitude: 18.4,
    longitude: 77.5,
    description: "Ancient lake basin and Perseverance rover exploration site.",
  },
  {
    name: "Gale Crater",
    latitude: -5.4,
    longitude: 137.8,
    description: "Exploration region of the Curiosity rover.",
  },
  {
    name: "Valles Marineris",
    latitude: -13.9,
    longitude: -59.2,
    description: "A vast canyon system near the Martian equator.",
  },
  {
    name: "Olympus Mons",
    latitude: 18.65,
    longitude: -133.8,
    description: "One of the largest volcanoes in the Solar System.",
  },
];

const LAYER_OPTIONS = Object.entries(MAP_LAYERS) as [
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

const CATEGORY_LABELS: Record<MapLayerCategory, string> = {
  basemap: "Basemaps",
  elevation: "Elevation and Terrain",
  geology: "Geology",
  composition: "Composition",
  atmosphere: "Atmosphere",
  thermal: "Thermal and Infrared",
};

// Scratch objects for camera animation.
const _dir = new THREE.Vector3();
const _full = new THREE.Quaternion();
const _step = new THREE.Quaternion();

// Matches the equirectangular texture orientation.
function coordinatesToVector(
  latitude: number,
  longitude: number,
  radius = 1.015,
): THREE.Vector3 {
  const lat = THREE.MathUtils.degToRad(latitude);
  const lon = THREE.MathUtils.degToRad(longitude);

  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.crossOrigin = "anonymous";

    image.onload = () => resolve(image);

    image.onerror = () => {
      reject(new Error(`Failed to load NASA tile: ${url}`));
    };

    image.src = url;
  });
}

function buildTileUrl(
  template: string,
  matrixId: string,
  x: number,
): string {
  return template
    .replaceAll("{z}", matrixId)
    .replaceAll("{y}", "0")
    .replaceAll("{x}", String(x));
}

async function loadLayerTexture(
  layerId: MapLayerId,
): Promise<THREE.CanvasTexture> {
  const provider = getDataProvider("nasaTrek");

  // Retrieve the actual URL template from the existing NASA provider.
  const config = await provider.getLayerConfig(layerId);

  if (!config.tileUrlTemplate) {
    throw new Error(`No tile URL available for ${layerId}`);
  }

  // Use the first advertised WMTS matrix level.
  const matrixId = config.matrixIds?.[0] ?? "0";

  // Global equirectangular Mars tiles at the first matrix level.
  const leftUrl = buildTileUrl(
    config.tileUrlTemplate,
    matrixId,
    0,
  );

  const rightUrl = buildTileUrl(
    config.tileUrlTemplate,
    matrixId,
    1,
  );

  console.log(`Loading NASA layer: ${layerId}`, {
    matrixId,
    leftUrl,
    rightUrl,
  });

  const [leftTile, rightTile] = await Promise.all([
    loadImage(leftUrl),
    loadImage(rightUrl),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create 2D canvas context.");
  }

  context.drawImage(leftTile, 0, 0, 256, 256);
  context.drawImage(rightTile, 256, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);

  texture.mapping = THREE.UVMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return texture;
}

function MarsSurface({
  layerId,
  layerName,
  onTextureLoaded,
}: {
  layerId: MapLayerId;
  layerName: string;
  onTextureLoaded: (message: string) => void;
}) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    let active = true;
    let loadedTexture: THREE.CanvasTexture | null = null;

    setTexture(null);
    onTextureLoaded(`Loading ${layerName}...`);

    loadLayerTexture(layerId)
      .then((result) => {
        if (!active) {
          result.dispose();
          return;
        }

        loadedTexture = result;
        setTexture(result);

        onTextureLoaded(`${layerName} loaded`);

        console.log("NASA globe texture loaded:", {
          layerId,
          width: result.image.width,
          height: result.image.height,
          colorSpace: result.colorSpace,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;

        console.error(`Failed to load NASA layer ${layerId}:`, error);

        onTextureLoaded(`Failed to load ${layerName}`);
      });

    return () => {
      active = false;
      loadedTexture?.dispose();
    };
  }, [layerId, layerName, onTextureLoaded]);

  return (
    <mesh onClick={(event) => event.stopPropagation()}>
      <sphereGeometry args={[1, 128, 128]} />

      <meshBasicMaterial
        key={texture ? "textured" : "flat"}
        map={texture}
        color={texture ? "#ffffff" : "#b75c35"}
        toneMapped={false}
      />
    </mesh>
  );
}

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
  );

  return (
    <group position={position}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(location);
        }}
      >
        <sphereGeometry args={[selected ? 0.025 : 0.016, 16, 16]} />

        <meshBasicMaterial
          color={selected ? "#ffffff" : "#ff9c52"}
        />
      </mesh>
    </group>
  );
}

function RendererDiagnostics() {
  const { gl } = useThree();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      console.log("WebGL diagnostics:", {
        renderer: gl.getContext().getParameter(
          gl.getContext().RENDERER,
        ),
        maxTextureSize: gl.capabilities.maxTextureSize,
        webglError: gl.getContext().getError(),
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [gl]);

  return null;
}

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

  const flyTo = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    flyTo.current = selectedLocation
      ? coordinatesToVector(
          selectedLocation.latitude,
          selectedLocation.longitude,
          1,
        ).normalize()
      : null;
  }, [selectedLocation]);

  useFrame((_, delta) => {
    const goal = flyTo.current;

    if (!goal) return;

    _dir.copy(camera.position).normalize();

    if (_dir.dot(goal) > 0.99999) {
      flyTo.current = null;
      return;
    }

    const t = 1 - Math.exp(-delta * 6);

    _full.setFromUnitVectors(_dir, goal);
    _step.identity().slerp(_full, t);

    camera.position.applyQuaternion(_step);
    camera.lookAt(0, 0, 0);
  });

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
          selected={selectedLocation?.name === location.name}
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

      <RendererDiagnostics />
    </>
  );
}

export default function MarsGlobe() {
  const [selectedLocation, setSelectedLocation] =
    useState<Location | null>(null);

  const [selectedLayerId, setSelectedLayerId] =
    useState<MapLayerId>("mars_global_mola");

  const [textureStatus, setTextureStatus] =
    useState("Loading NASA imagery...");

  const selectedLayer = MAP_LAYERS[selectedLayerId];

  const handleTextureLoaded = useCallback((message: string) => {
    setTextureStatus(message);
  }, []);

  const handleSelectLocation = useCallback((location: Location) => {
    setSelectedLocation(location);
  }, []);

  return (
    <div className="mars-globe">
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
              setSelectedLayerId(event.target.value as MapLayerId);
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
              const categoryLayers = LAYER_OPTIONS.filter(
                ([, layer]) => layer.category === category,
              );

              if (categoryLayers.length === 0) return null;

              return (
                <optgroup
                  key={category}
                  label={CATEGORY_LABELS[category]}
                >
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

        <span className="mars-globe-status">
          {textureStatus}
        </span>
      </div>

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
          onCreated={({ gl }) => {
            console.log("Three.js renderer:", {
              renderer: gl.getContext().getParameter(
                gl.getContext().RENDERER,
              ),
              maxTextureSize: gl.capabilities.maxTextureSize,
            });
          }}
        >
          <color attach="background" args={["#05070d"]} />

          <GlobeScene
            selectedLocation={selectedLocation}
            selectedLayerId={selectedLayerId}
            selectedLayerName={selectedLayer.name}
            onSelectLocation={handleSelectLocation}
            onTextureLoaded={handleTextureLoaded}
          />
        </Canvas>

        <div className="mars-globe-controls">
          {LOCATIONS.map((location) => (
            <button
              key={location.name}
              type="button"
              onClick={() => handleSelectLocation(location)}
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

        {selectedLocation && (
          <div className="mars-globe-location">
            <button
              type="button"
              onClick={() => setSelectedLocation(null)}
              aria-label="Close selected location"
            >
              ×
            </button>

            <h3>{selectedLocation.name}</h3>
            <p>{selectedLocation.description}</p>

            <small>
              {selectedLocation.latitude.toFixed(2)}° latitude,{" "}
              {selectedLocation.longitude.toFixed(2)}° longitude
            </small>
          </div>
        )}

        <div className="mars-globe-hint">
          Drag to rotate · Scroll to zoom
        </div>
      </div>
    </div>
  );
}

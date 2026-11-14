
import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";

const TILE_BASE =
  "https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm";

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

function coordinatesToVector(
  latitude: number,
  longitude: number,
  radius = 1.015,
): THREE.Vector3 {
  const lat = THREE.MathUtils.degToRad(latitude);
  const lon = THREE.MathUtils.degToRad(longitude);

  return new THREE.Vector3(
    -radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load tile: ${url}`));
    image.src = url;
  });
}

async function loadMarsTexture(): Promise<THREE.CanvasTexture> {
  const [leftTile, rightTile] = await Promise.all([
    loadImage(`${TILE_BASE}/0/0/0.jpg`),
    loadImage(`${TILE_BASE}/0/0/1.jpg`),
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
  onTextureLoaded,
}: {
  onTextureLoaded: (message: string) => void;
}) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    let active = true;
    let loadedTexture: THREE.CanvasTexture | null = null;

    loadMarsTexture()
      .then((result) => {
        if (!active) {
          result.dispose();
          return;
        }

        loadedTexture = result;
        setTexture(result);
        onTextureLoaded("NASA MOLA imagery loaded");

        console.log("Sphere geometry and texture:", {
          textureWidth: result.image.width,
          textureHeight: result.image.height,
          mapping: result.mapping,
          flipY: result.flipY,
          colorSpace: result.colorSpace,
        });
      })
      .catch((error: unknown) => {
        console.error("Mars texture loading failed:", error);
        onTextureLoaded("NASA texture loading failed");
      });

    return () => {
      active = false;
      loadedTexture?.dispose();
    };
  }, [onTextureLoaded]);

  if (!texture) {
    return (
      <mesh>
        <sphereGeometry args={[1, 128, 128]} />
        <meshBasicMaterial color="#b75c35" />
      </mesh>
    );
  }

  return (
    <>
      {/* Main Mars sphere */}
      <mesh>
        <sphereGeometry args={[1, 128, 128]} />
        <meshBasicMaterial
          map={texture}
          color="#ffffff"
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* Diagnostic plane: uses exactly the same texture */}
      <mesh position={[1.7, 0, 0]}>
        <planeGeometry args={[1.4, 0.7]} />
        <meshBasicMaterial
          map={texture}
          color="#ffffff"
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </>
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
        <meshBasicMaterial color={selected ? "#ffffff" : "#ff9c52"} />
      </mesh>
    </group>
  );
}

function RendererDiagnostics() {
  const { gl } = useThree();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      console.log("WebGL diagnostics:", {
        renderer: gl.getContext().getParameter(gl.getContext().RENDERER),
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
  onSelectLocation,
  onTextureLoaded,
}: {
  selectedLocation: Location | null;
  onSelectLocation: (location: Location) => void;
  onTextureLoaded: (message: string) => void;
}) {
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (!selectedLocation || !controlsRef.current) return;

    const target = coordinatesToVector(
      selectedLocation.latitude,
      selectedLocation.longitude,
      1.8,
    );

    controlsRef.current.target.lerp(target, 0.35);
    controlsRef.current.update();
  }, [selectedLocation]);

  return (
    <>
      <MarsSurface onTextureLoaded={onTextureLoaded} />

      {LOCATIONS.map((location) => (
        <LocationMarker
          key={location.name}
          location={location}
          selected={selectedLocation?.name === location.name}
          onSelect={onSelectLocation}
        />
      ))}

      <Stars radius={80} depth={50} count={2500} factor={4} fade />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom
        minDistance={1.5}
        maxDistance={5}
        rotateSpeed={0.5}
        zoomSpeed={0.7}
      />

      <RendererDiagnostics />
    </>
  );
}

export default function MarsGlobe() {
  const [selectedLocation, setSelectedLocation] =
    useState<Location | null>(null);

  const [textureStatus, setTextureStatus] = useState("Loading NASA imagery...");

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

        <span className="mars-globe-status">{textureStatus}</span>
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
          gl={{ antialias: true, alpha: false }}
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
                selectedLocation?.name === location.name ? "active" : ""
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

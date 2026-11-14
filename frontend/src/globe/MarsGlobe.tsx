import {
  useCallback,
  useEffect,
  useMemo,
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

import {
  getDataProvider,
  type TileLayerConfig,
  type TileMatrixLevel,
} from "../services/dataProviders";

type Location = {
  name: string;
  latitude: number;
  longitude: number;
  description: string;
};

type DetailTile = {
  key: string;
  url: string;
  level: TileMatrixLevel;
  x: number;
  y: number;
};

type LoadedDetailTile = DetailTile & {
  texture: THREE.Texture;
};

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

const BASE_RADIUS = 1;
const DETAIL_RADIUS = 1.006;

const MAX_DETAIL_TILES = 24;
const DETAIL_CONCURRENCY = 6;

const imageCache = new Map<
  string,
  Promise<HTMLImageElement>
>();

const _direction = new THREE.Vector3();
const _fullQuaternion = new THREE.Quaternion();
const _stepQuaternion = new THREE.Quaternion();

function coordinatesToVector(
  latitude: number,
  longitude: number,
  radius = BASE_RADIUS
): THREE.Vector3 {
  const lat = THREE.MathUtils.degToRad(latitude);
  const lon = THREE.MathUtils.degToRad(longitude);

  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon)
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);

  if (cached) {
    return cached;
  }

  const promise = new Promise<HTMLImageElement>(
    (resolve, reject) => {
      const image = new Image();

      image.crossOrigin = "anonymous";

      image.onload = () => resolve(image);

      image.onerror = () => {
        imageCache.delete(url);
        reject(
          new Error(`Failed to load NASA tile: ${url}`)
        );
      };

      image.src = url;
    }
  );

  imageCache.set(url, promise);

  return promise;
}

function buildTileUrl(
  template: string,
  matrixId: string,
  x: number,
  y: number
): string {
  return template
    .replaceAll("{z}", matrixId)
    .replaceAll("{y}", String(y))
    .replaceAll("{x}", String(x));
}

async function runLimited<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] =
    new Array(items.length);

  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex++;

      if (index >= items.length) {
        return;
      }

      try {
        const value = await worker(items[index]);

        results[index] = {
          status: "fulfilled",
          value,
        };
      } catch (reason) {
        results[index] = {
          status: "rejected",
          reason,
        };
      }
    }
  }

  const workers = Array.from(
    {
      length: Math.min(concurrency, items.length),
    },
    () => runWorker()
  );

  await Promise.all(workers);

  return results;
}

function createCanvasTexture(
  canvas: HTMLCanvasElement
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);

  texture.mapping = THREE.UVMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  return texture;
}

function createImageTexture(
  image: HTMLImageElement
): THREE.Texture {
  const texture = new THREE.Texture(image);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return texture;
}

async function loadGlobalPreview(
  config: TileLayerConfig
): Promise<THREE.CanvasTexture> {
  const level = config.matrixLevels?.[0];

  if (!level) {
    throw new Error("NASA layer has no tile matrix metadata.");
  }

  const totalWidth =
    level.matrixWidth * level.tileWidth;

  const totalHeight =
    level.matrixHeight * level.tileHeight;

  if (
    totalWidth <= 0 ||
    totalHeight <= 0 ||
    totalWidth > 4096 ||
    totalHeight > 4096
  ) {
    throw new Error(
      `Invalid global preview dimensions: ${totalWidth}x${totalHeight}`
    );
  }

  const canvas = document.createElement("canvas");

  canvas.width = totalWidth;
  canvas.height = totalHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create preview canvas.");
  }

  const tiles: {
    url: string;
    x: number;
    y: number;
  }[] = [];

  for (let y = 0; y < level.matrixHeight; y++) {
    for (let x = 0; x < level.matrixWidth; x++) {
      tiles.push({
        url: buildTileUrl(
          config.tileUrlTemplate,
          level.id,
          x,
          y
        ),
        x,
        y,
      });
    }
  }

  const results = await runLimited(
    tiles,
    6,
    (tile) => loadImage(tile.url)
  );

  let successfulTiles = 0;

  results.forEach((result, index) => {
    if (result.status !== "fulfilled") {
      console.warn(
        "Global preview tile failed:",
        tiles[index].url,
        result.reason
      );

      return;
    }

    const tile = tiles[index];

    context.drawImage(
      result.value,
      tile.x * level.tileWidth,
      tile.y * level.tileHeight,
      level.tileWidth,
      level.tileHeight
    );

    successfulTiles++;
  });

  if (successfulTiles === 0) {
    throw new Error(
      "NASA returned no usable global preview tiles."
    );
  }

  console.log("Global preview loaded:", {
    layer: config.matrixSet,
    successfulTiles,
    totalTiles: tiles.length,
    width: canvas.width,
    height: canvas.height,
  });

  return createCanvasTexture(canvas);
}

function getTileCoordinates(
  level: TileMatrixLevel,
  x: number,
  y: number
) {
  const longitudeSpan = 360 / level.matrixWidth;
  const latitudeSpan = 180 / level.matrixHeight;

  const west =
    level.topLeftX + x * longitudeSpan;

  const east = west + longitudeSpan;

  const north =
    level.topLeftY - y * latitudeSpan;

  const south = north - latitudeSpan;

  return {
    west,
    east,
    north,
    south,
  };
}

function getVisibleTiles(
  config: TileLayerConfig,
  level: TileMatrixLevel,
  cameraPosition: THREE.Vector3
): DetailTile[] {
  const visible: {
    tile: DetailTile;
    score: number;
  }[] = [];

  const cameraDirection =
    cameraPosition.clone().normalize();

  for (let y = 0; y < level.matrixHeight; y++) {
    for (let x = 0; x < level.matrixWidth; x++) {
      const bounds = getTileCoordinates(
        level,
        x,
        y
      );

      const centerLatitude =
        (bounds.north + bounds.south) / 2;

      const centerLongitude =
        (bounds.west + bounds.east) / 2;

      const center = coordinatesToVector(
        centerLatitude,
        centerLongitude,
        1
      ).normalize();

      const score = center.dot(cameraDirection);

      // Skip tiles on the far side of the planet.
      if (score < -0.08) {
        continue;
      }

      const tile: DetailTile = {
        key: `${level.id}/${x}/${y}`,
        url: buildTileUrl(
          config.tileUrlTemplate,
          level.id,
          x,
          y
        ),
        level,
        x,
        y,
      };

      visible.push({
        tile,
        score,
      });
    }
  }

  visible.sort(
    (a, b) => b.score - a.score
  );

  return visible
    .slice(0, MAX_DETAIL_TILES)
    .map((item) => item.tile);
}

function createTileGeometry(
  level: TileMatrixLevel,
  x: number,
  y: number
): THREE.BufferGeometry {
  const bounds = getTileCoordinates(
    level,
    x,
    y
  );

  const segments = 16;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= segments; row++) {
    const vertical = row / segments;

    const latitude =
      bounds.north +
      (bounds.south - bounds.north) * vertical;

    for (
      let column = 0;
      column <= segments;
      column++
    ) {
      const horizontal = column / segments;

      const longitude =
        bounds.west +
        (bounds.east - bounds.west) * horizontal;

      const position = coordinatesToVector(
        latitude,
        longitude,
        DETAIL_RADIUS
      );

      positions.push(
        position.x,
        position.y,
        position.z
      );

      // The top of the tile image is its northern edge.
      uvs.push(horizontal, 1 - vertical);
    }
  }

  for (let row = 0; row < segments; row++) {
    for (
      let column = 0;
      column < segments;
      column++
    ) {
      const a = row * (segments + 1) + column;
      const b = a + segments + 1;

      indices.push(
        a,
        b,
        a + 1,
        b,
        b + 1,
        a + 1
      );
    }
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      positions,
      3
    )
  );

  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      uvs,
      2
    )
  );

  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

function DetailTileMesh({
  tile,
}: {
  tile: LoadedDetailTile;
}) {
  const geometry = useMemo(
    () =>
      createTileGeometry(
        tile.level,
        tile.x,
        tile.y
      ),
    [tile.level, tile.x, tile.y]
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      tile.texture.dispose();
    };
  }, [geometry, tile.texture]);

  return (
    <mesh
      geometry={geometry}
      renderOrder={2}
    >
      <meshBasicMaterial
        map={tile.texture}
        side={THREE.DoubleSide}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </mesh>
  );
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
  const { camera } = useThree();

  const [config, setConfig] =
    useState<TileLayerConfig | null>(null);

  const [previewTexture, setPreviewTexture] =
    useState<THREE.CanvasTexture | null>(null);

  const [detailTiles, setDetailTiles] =
    useState<LoadedDetailTile[]>([]);

  const [detailStatus, setDetailStatus] =
    useState("");

  const lastUpdate = useRef(0);

  const activeConfig = useRef<TileLayerConfig | null>(
    null
  );

  // Fetch NASA metadata and global preview.
  useEffect(() => {
    let active = true;

    let loadedPreview: THREE.CanvasTexture | null =
      null;

    activeConfig.current = null;

    setConfig(null);
    setPreviewTexture(null);
    setDetailTiles([]);
    setDetailStatus("");

    onTextureLoaded(`Loading ${layerName}...`);

    async function initialize() {
      const provider = getDataProvider("nasaTrek");

      const nextConfig =
        await provider.getLayerConfig(layerId);

      if (!active) return;

      if (
        !nextConfig.matrixLevels ||
        nextConfig.matrixLevels.length === 0
      ) {
        throw new Error(
          "NASA layer did not provide matrix levels."
        );
      }

      activeConfig.current = nextConfig;
      setConfig(nextConfig);

      const preview =
        await loadGlobalPreview(nextConfig);

      if (!active) {
        preview.dispose();
        return;
      }

      loadedPreview = preview;

      setPreviewTexture(preview);

      onTextureLoaded(
        `${layerName} preview loaded`
      );
    }

    initialize().catch((error: unknown) => {
      if (!active) return;

      console.error(
        `Failed to initialize NASA layer ${layerId}:`,
        error
      );

      onTextureLoaded(
        `Failed to load ${layerName}`
      );
    });

    return () => {
      active = false;
      activeConfig.current = null;

      loadedPreview?.dispose();
    };
  }, [layerId, layerName, onTextureLoaded]);

  // Determine the appropriate detail level as the camera zooms.
  useFrame(() => {
    const currentConfig = activeConfig.current;

    if (!currentConfig?.matrixLevels) return;

    const now = performance.now();

    // Avoid recalculating tile visibility every frame.
    if (now - lastUpdate.current < 500) {
      return;
    }

    lastUpdate.current = now;

    const levels = currentConfig.matrixLevels;

    if (levels.length < 2) {
      setDetailTiles([]);
      return;
    }

    const distance = camera.position.length();

    // Move through higher matrix levels as the user zooms in.
    const zoomProgress = Math.max(
      0,
      Math.log2(3.2 / distance)
    );

    const levelIndex = Math.min(
      levels.length - 1,
      Math.max(
        1,
        Math.floor(zoomProgress) + 1
      )
    );

    const selectedLevel = levels[levelIndex];

    const visibleTiles = getVisibleTiles(
      currentConfig,
      selectedLevel,
      camera.position
    );

    const nextKeys = visibleTiles
      .map((tile) => tile.key)
      .join("|");

    setDetailTiles((current) => {
      const currentKeys = current
        .map((tile) => tile.key)
        .join("|");

      if (currentKeys === nextKeys) {
        return current;
      }

      return current;
    });

    setDetailStatus(
      `${visibleTiles.length} detail tiles requested`
    );

    // Store requested tile list for the loading effect.
    requestedTiles.current = visibleTiles;
    setRequestVersion((version) => version + 1);
  });

  const requestedTiles = useRef<DetailTile[]>([]);
  const [requestVersion, setRequestVersion] =
    useState(0);

  // Fetch visible detail tiles with limited concurrency.
  useEffect(() => {
    const currentConfig = activeConfig.current;

    if (!currentConfig || requestVersion === 0) {
      return;
    }

    let active = true;

    const requested = requestedTiles.current;

    async function loadDetails() {
      const results = await runLimited(
        requested,
        DETAIL_CONCURRENCY,
        async (tile): Promise<LoadedDetailTile> => {
          const image = await loadImage(tile.url);

          return {
            ...tile,
            texture: createImageTexture(image),
          };
        }
      );

      if (!active) {
        results.forEach((result) => {
          if (result.status === "fulfilled") {
            result.value.texture.dispose();
          }
        });

        return;
      }

      const successful = results
        .filter(
          (
            result
          ): result is PromiseFulfilledResult<LoadedDetailTile> =>
            result.status === "fulfilled"
        )
        .map((result) => result.value);

      const failed = results.length - successful.length;

      setDetailTiles((previous) => {
        const nextMap = new Map(
          successful.map((tile) => [
            tile.key,
            tile,
          ])
        );

        // Preserve already loaded tiles still in the requested view.
        for (const tile of previous) {
          if (
            requested.some(
              (requestedTile) =>
                requestedTile.key === tile.key
            ) &&
            !nextMap.has(tile.key)
          ) {
            nextMap.set(tile.key, tile);
          }
        }

        const next = Array.from(nextMap.values());

        // Dispose textures that are no longer displayed.
        for (const tile of previous) {
          if (!nextMap.has(tile.key)) {
            tile.texture.dispose();
          }
        }

        return next;
      });

      setDetailStatus(
        failed > 0
          ? `${successful.length} detail tiles loaded · ${failed} unavailable`
          : `${successful.length} detail tiles loaded`
      );
    }

    loadDetails().catch((error: unknown) => {
      if (active) {
        console.error(
          "Detail tile loading failed:",
          error
        );
      }
    });

    return () => {
      active = false;
    };
  }, [requestVersion]);

  return (
    <>
      <mesh>
        <sphereGeometry args={[BASE_RADIUS, 128, 128]} />

        <meshBasicMaterial
          key={previewTexture ? "preview" : "flat"}
          map={previewTexture}
          color={
            previewTexture
              ? "#ffffff"
              : "#b75c35"
          }
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {detailTiles.map((tile) => (
        <DetailTileMesh
          key={tile.key}
          tile={tile}
        />
      ))}
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

  useEffect(() => {
    flyTo.current = selectedLocation
      ? coordinatesToVector(
          selectedLocation.latitude,
          selectedLocation.longitude,
          1
        ).normalize()
      : null;
  }, [selectedLocation]);

  useFrame((_, delta) => {
    const goal = flyTo.current;

    if (!goal) return;

    _direction.copy(camera.position).normalize();

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

export default function MarsGlobe() {
  const [selectedLocation, setSelectedLocation] =
    useState<Location | null>(null);

  const [selectedLayerId, setSelectedLayerId] =
    useState<MapLayerId>("mars_global_mola");

  const [textureStatus, setTextureStatus] =
    useState("Loading NASA imagery...");

  const selectedLayer = MAP_LAYERS[selectedLayerId];

  const handleTextureLoaded = useCallback(
    (message: string) => {
      setTextureStatus(message);
    },
    []
  );

  const handleSelectLocation = useCallback(
    (location: Location) => {
      setSelectedLocation(location);
    },
    []
  );

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
              const categoryLayers = LAYER_OPTIONS.filter(
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
              {selectedLocation.latitude.toFixed(2)}°
              latitude,{" "}
              {selectedLocation.longitude.toFixed(2)}°
              longitude
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
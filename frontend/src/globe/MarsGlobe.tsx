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

// --------------------------------------------------
// TYPES AND CONFIGURATION
// --------------------------------------------------

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
  prefetch: boolean;
};

const BASE_RADIUS = 1;
const DETAIL_RADIUS = 1.006;

const MAX_VISIBLE_TILES = 48;
const MAX_PREFETCH_TILES = 16;

const TILE_CACHE_LIMIT = 96;
const MAX_CONCURRENT_REQUESTS = 6;

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

// --------------------------------------------------
// TILE CACHE AND REQUEST CONCURRENCY
// --------------------------------------------------

const bitmapCache = new Map<string, ImageBitmap>();

type RequestWaiter = {
  signal: AbortSignal;
  resolve: (release: () => void) => void;
  reject: (reason: unknown) => void;
  onAbort: () => void;
};

let activeRequests = 0;

const requestWaiters: RequestWaiter[] = [];

function releaseRequestSlot(): void {
  activeRequests--;

  while (requestWaiters.length > 0) {
    const waiter = requestWaiters.shift()!;

    waiter.signal.removeEventListener(
      "abort",
      waiter.onAbort
    );

    if (waiter.signal.aborted) {
      continue;
    }

    activeRequests++;

    waiter.resolve(releaseRequestSlot);

    break;
  }
}

function acquireRequestSlot(
  signal: AbortSignal
): Promise<() => void> {
  if (signal.aborted) {
    return Promise.reject(
      new DOMException("Request aborted", "AbortError")
    );
  }

  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests++;

    return Promise.resolve(releaseRequestSlot);
  }

  return new Promise((resolve, reject) => {
    const waiter: RequestWaiter = {
      signal,
      resolve,
      reject,
      onAbort: () => {
        const index = requestWaiters.indexOf(waiter);

        if (index !== -1) {
          requestWaiters.splice(index, 1);
        }

        reject(
          new DOMException(
            "Request aborted",
            "AbortError"
          )
        );
      },
    };

    requestWaiters.push(waiter);

    signal.addEventListener(
      "abort",
      waiter.onAbort,
      { once: true }
    );
  });
}

function getCachedBitmap(
  url: string
): ImageBitmap | undefined {
  const bitmap = bitmapCache.get(url);

  if (!bitmap) {
    return undefined;
  }

  // Move recently used entries to the end.
  bitmapCache.delete(url);
  bitmapCache.set(url, bitmap);

  return bitmap;
}

function cacheBitmap(
  url: string,
  bitmap: ImageBitmap
): void {
  bitmapCache.delete(url);
  bitmapCache.set(url, bitmap);

  while (bitmapCache.size > TILE_CACHE_LIMIT) {
    const oldestKey = bitmapCache.keys().next().value;

    if (!oldestKey) break;

    // Remove the cache reference. Do not close the bitmap:
    // an active Three.js texture may still be using it.
    bitmapCache.delete(oldestKey);
  }
}

async function loadTileBitmap(
  url: string,
  signal: AbortSignal
): Promise<ImageBitmap> {
  const cached = getCachedBitmap(url);

  if (cached) {
    return cached;
  }

  const release = await acquireRequestSlot(signal);

  try {
    const response = await fetch(url, {
      signal,
      mode: "cors",
    });

    if (!response.ok) {
      throw new Error(
        `Tile request failed: HTTP ${response.status}`
      );
    }

    const blob = await response.blob();

    if (signal.aborted) {
      throw new DOMException(
        "Request aborted",
        "AbortError"
      );
    }

    const bitmap = await createImageBitmap(blob);

    if (signal.aborted) {
      bitmap.close();

      throw new DOMException(
        "Request aborted",
        "AbortError"
      );
    }

    cacheBitmap(url, bitmap);

    return bitmap;
  } finally {
    release();
  }
}

// --------------------------------------------------
// COORDINATE AND TILE UTILITIES
// --------------------------------------------------

function coordinatesToVector(
  latitude: number,
  longitude: number,
  radius = BASE_RADIUS
): THREE.Vector3 {
  const lat = THREE.MathUtils.degToRad(
    THREE.MathUtils.clamp(latitude, -90, 90)
  );

  const lon = THREE.MathUtils.degToRad(longitude);

  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon)
  );
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

function getTileBounds(
  level: TileMatrixLevel,
  x: number,
  y: number
) {
  // Mars Trek's EQ matrix is treated as a global
  // equirectangular grid: 360 degrees by 180 degrees.
  const longitudeSpan =
    360 / level.matrixWidth;

  const latitudeSpan =
    180 / level.matrixHeight;

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

function createTileGeometry(
  level: TileMatrixLevel,
  x: number,
  y: number
): THREE.BufferGeometry {
  const bounds = getTileBounds(level, x, y);

  const segments = 12;

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

      // The top of the image corresponds to north.
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

// --------------------------------------------------
// SCREEN-SPACE LEVEL OF DETAIL
// --------------------------------------------------

function chooseMatrixLevel(
  levels: TileMatrixLevel[],
  camera: THREE.Camera,
  viewportHeight: number
): TileMatrixLevel {
  const perspectiveCamera =
    camera as THREE.PerspectiveCamera;

  const distance = Math.max(
    camera.position.length(),
    BASE_RADIUS + 0.01
  );

  const fovRadians = THREE.MathUtils.degToRad(
    perspectiveCamera.fov
  );

  const focalPixels =
    viewportHeight / (2 * Math.tan(fovRadians / 2));

  const distanceToTangent = Math.sqrt(
    Math.max(
      0.001,
      distance * distance -
        BASE_RADIUS * BASE_RADIUS
    )
  );

  const projectedPlanetDiameter =
    (2 * BASE_RADIUS * focalPixels) /
    distanceToTangent;

  // Slightly oversample the visible globe to reduce blur.
  const targetTextureWidth =
    projectedPlanetDiameter * 1.15;

  let bestLevel = levels[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const level of levels) {
    const availableTextureWidth =
      level.matrixWidth * level.tileWidth;

    const score = Math.abs(
      Math.log2(
        availableTextureWidth /
          targetTextureWidth
      )
    );

    if (score < bestScore) {
      bestScore = score;
      bestLevel = level;
    }
  }

  return bestLevel;
}

// --------------------------------------------------
// CAMERA-FRUSTUM TILE SELECTION
// --------------------------------------------------

function getTileBoundingSphere(
  level: TileMatrixLevel,
  x: number,
  y: number
): THREE.Sphere {
  const bounds = getTileBounds(level, x, y);

  const points: THREE.Vector3[] = [];

  const samples = 4;

  for (let row = 0; row <= samples; row++) {
    const vertical = row / samples;

    const latitude =
      bounds.north +
      (bounds.south - bounds.north) * vertical;

    for (
      let column = 0;
      column <= samples;
      column++
    ) {
      const horizontal = column / samples;

      const longitude =
        bounds.west +
        (bounds.east - bounds.west) * horizontal;

      points.push(
        coordinatesToVector(
          latitude,
          longitude,
          DETAIL_RADIUS
        )
      );
    }
  }

  const center = new THREE.Vector3();

  for (const point of points) {
    center.add(point);
  }

  center.divideScalar(points.length);

  const radius = Math.max(
    ...points.map((point) =>
      point.distanceTo(center)
    )
  ) + 0.002;

  return new THREE.Sphere(center, radius);
}

function getVisibleTiles(
  config: TileLayerConfig,
  camera: THREE.Camera,
  viewportWidth: number,
  viewportHeight: number
): DetailTile[] {
  const levels = config.matrixLevels;

  if (!levels || levels.length === 0) {
    return [];
  }

  const level = chooseMatrixLevel(
    levels,
    camera,
    viewportHeight
  );

  camera.updateMatrixWorld();

  const viewProjectionMatrix =
    new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );

  const frustum = new THREE.Frustum();

  frustum.setFromProjectionMatrix(
    viewProjectionMatrix
  );

  const cameraDirection = camera.position
    .clone()
    .normalize();

  const visible: {
    tile: DetailTile;
    score: number;
  }[] = [];

  for (
    let y = 0;
    y < level.matrixHeight;
    y++
  ) {
    for (
      let x = 0;
      x < level.matrixWidth;
      x++
    ) {
      const sphere = getTileBoundingSphere(
        level,
        x,
        y
      );

      const centerDirection = sphere.center
        .clone()
        .normalize();

      const score = centerDirection.dot(
        cameraDirection
      );

      // Reject the far side of Mars.
      if (score < -0.15) {
        continue;
      }

      // Only request tiles intersecting the camera view.
      if (!frustum.intersectsSphere(sphere)) {
        continue;
      }

      visible.push({
        score,
        tile: {
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
          prefetch: false,
        },
      });
    }
  }

  visible.sort(
    (a, b) => b.score - a.score
  );

  const selectedVisible = visible
    .slice(0, MAX_VISIBLE_TILES)
    .map((item) => item.tile);

  // Prefetch nearby tiles so small rotations are quicker.
  const visibleKeys = new Set(
    selectedVisible.map((tile) => tile.key)
  );

  const neighbors: DetailTile[] = [];
  const neighborKeys = new Set<string>();

  for (const tile of selectedVisible.slice(0, 16)) {
    for (const offsetY of [-1, 0, 1]) {
      for (const offsetX of [-1, 0, 1]) {
        if (offsetX === 0 && offsetY === 0) {
          continue;
        }

        const neighborY = tile.y + offsetY;

        if (
          neighborY < 0 ||
          neighborY >= level.matrixHeight
        ) {
          continue;
        }

        // Longitude wraps around the planet.
        const neighborX =
          (tile.x + offsetX + level.matrixWidth) %
          level.matrixWidth;

        const key =
          `${level.id}/${neighborX}/${neighborY}`;

        if (
          visibleKeys.has(key) ||
          neighborKeys.has(key)
        ) {
          continue;
        }

        neighborKeys.add(key);

        neighbors.push({
          key,
          url: buildTileUrl(
            config.tileUrlTemplate,
            level.id,
            neighborX,
            neighborY
          ),
          level,
          x: neighborX,
          y: neighborY,
          prefetch: true,
        });

        if (
          neighbors.length >= MAX_PREFETCH_TILES
        ) {
          break;
        }
      }

      if (
        neighbors.length >= MAX_PREFETCH_TILES
      ) {
        break;
      }
    }

    if (
      neighbors.length >= MAX_PREFETCH_TILES
    ) {
      break;
    }
  }

  console.log("Mars tile selection:", {
    matrix: level.id,
    matrixWidth: level.matrixWidth,
    matrixHeight: level.matrixHeight,
    visibleTiles: selectedVisible.length,
    prefetchedTiles: neighbors.length,
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
    },
  });

  return [
    ...selectedVisible,
    ...neighbors,
  ];
}

// --------------------------------------------------
// GLOBAL PREVIEW
// --------------------------------------------------

async function loadGlobalPreview(
  config: TileLayerConfig,
  signal: AbortSignal
): Promise<THREE.CanvasTexture> {
  const level = config.matrixLevels?.[0];

  if (!level) {
    throw new Error(
      "NASA layer has no tile matrix metadata."
    );
  }

  const originalWidth =
    level.matrixWidth * level.tileWidth;

  const originalHeight =
    level.matrixHeight * level.tileHeight;

  if (
    originalWidth <= 0 ||
    originalHeight <= 0 ||
    originalWidth > 8192 ||
    originalHeight > 8192
  ) {
    throw new Error(
      `Invalid preview dimensions: ${originalWidth}x${originalHeight}`
    );
  }

  const scale = Math.min(
    1,
    2048 / originalWidth,
    1024 / originalHeight
  );

  const canvas = document.createElement("canvas");

  canvas.width = Math.max(
    1,
    Math.floor(originalWidth * scale)
  );

  canvas.height = Math.max(
    1,
    Math.floor(originalHeight * scale)
  );

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Unable to create preview canvas."
    );
  }

  const tiles: {
    url: string;
    x: number;
    y: number;
  }[] = [];

  for (
    let y = 0;
    y < level.matrixHeight;
    y++
  ) {
    for (
      let x = 0;
      x < level.matrixWidth;
      x++
    ) {
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

  const results = await Promise.allSettled(
    tiles.map(async (tile) => {
      const bitmap = await loadTileBitmap(
        tile.url,
        signal
      );

      if (signal.aborted) {
        throw new DOMException(
          "Request aborted",
          "AbortError"
        );
      }

      context.drawImage(
        bitmap,
        tile.x * level.tileWidth * scale,
        tile.y * level.tileHeight * scale,
        level.tileWidth * scale,
        level.tileHeight * scale
      );
    })
  );

  if (signal.aborted) {
    throw new DOMException(
      "Request aborted",
      "AbortError"
    );
  }

  const successfulTiles = results.filter(
    (result) => result.status === "fulfilled"
  ).length;

  if (successfulTiles === 0) {
    throw new Error(
      "NASA returned no usable global preview tiles."
    );
  }

  console.log("Global preview:", {
    successfulTiles,
    totalTiles: tiles.length,
    width: canvas.width,
    height: canvas.height,
  });

  const texture = new THREE.CanvasTexture(canvas);

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

// --------------------------------------------------
// DETAIL TILE COMPONENTS
// --------------------------------------------------

function DetailTileMesh({
  tile,
}: {
  tile: DetailTile;
}) {
  const [texture, setTexture] =
    useState<THREE.Texture | null>(null);

  const geometry = useMemo(
    () =>
      createTileGeometry(
        tile.level,
        tile.x,
        tile.y
      ),
    [
      tile.level,
      tile.x,
      tile.y,
    ]
  );

  useEffect(() => {
    const controller = new AbortController();

    let active = true;
    let loadedTexture: THREE.Texture | null = null;

    loadTileBitmap(
      tile.url,
      controller.signal
    )
      .then((bitmap) => {
        if (!active) return;

        const nextTexture = new THREE.Texture(bitmap);

        nextTexture.colorSpace = THREE.SRGBColorSpace;
        nextTexture.wrapS = THREE.ClampToEdgeWrapping;
        nextTexture.wrapT = THREE.ClampToEdgeWrapping;
        nextTexture.minFilter =
          THREE.LinearMipmapLinearFilter;
        nextTexture.magFilter = THREE.LinearFilter;
        nextTexture.generateMipmaps = true;
        nextTexture.anisotropy = 4;
        nextTexture.needsUpdate = true;

        loadedTexture = nextTexture;

        setTexture(nextTexture);
      })
      .catch((error: unknown) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.warn(
          "Detail tile unavailable; retaining preview:",
          tile.url,
          error
        );
      });

    return () => {
      active = false;
      controller.abort();

      loadedTexture?.dispose();
    };
  }, [tile.url]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  if (!texture) {
    return null;
  }

  return (
    <mesh
      geometry={geometry}
      renderOrder={2}
    >
      <meshBasicMaterial
        map={texture}
        side={THREE.DoubleSide}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </mesh>
  );
}

function TilePreloader({
  tile,
}: {
  tile: DetailTile;
}) {
  useEffect(() => {
    const controller = new AbortController();

    loadTileBitmap(
      tile.url,
      controller.signal
    ).catch((error: unknown) => {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      console.warn(
        "Neighbor prefetch failed:",
        tile.url,
        error
      );
    });

    return () => {
      controller.abort();
    };
  }, [tile.url]);

  return null;
}

// --------------------------------------------------
// MARS SURFACE
// --------------------------------------------------

function MarsSurface({
  layerId,
  layerName,
  onTextureLoaded,
}: {
  layerId: MapLayerId;
  layerName: string;
  onTextureLoaded: (message: string) => void;
}) {
  const { camera, size } = useThree();

  const configRef =
    useRef<TileLayerConfig | null>(null);

  const lastSelectionKey = useRef("");

  const lastUpdate = useRef(0);

  const [previewTexture, setPreviewTexture] =
    useState<THREE.CanvasTexture | null>(null);

  const [tileSelection, setTileSelection] =
    useState<DetailTile[]>([]);

  // Load metadata and global preview.
  useEffect(() => {
    const controller = new AbortController();

    let active = true;

    let loadedPreview: THREE.CanvasTexture | null =
      null;

    configRef.current = null;
    lastSelectionKey.current = "";

    setPreviewTexture(null);
    setTileSelection([]);

    onTextureLoaded(`Loading ${layerName}...`);

    async function initialize() {
      const provider = getDataProvider("nasaTrek");

      const config =
        await provider.getLayerConfig(layerId);

      if (!active) return;

      if (
        !config.matrixLevels ||
        config.matrixLevels.length === 0
      ) {
        throw new Error(
          "NASA layer has no matrix levels."
        );
      }

      configRef.current = config;

      const preview = await loadGlobalPreview(
        config,
        controller.signal
      );

      if (!active) {
        preview.dispose();
        return;
      }

      loadedPreview = preview;

      setPreviewTexture(preview);

      onTextureLoaded(
        `${layerName} preview loaded · streaming details`
      );
    }

    initialize().catch((error: unknown) => {
      if (!active) return;

      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      console.error(
        `Failed to initialize ${layerId}:`,
        error
      );

      onTextureLoaded(
        `Failed to load ${layerName}`
      );
    });

    return () => {
      active = false;
      controller.abort();

      configRef.current = null;

      loadedPreview?.dispose();
    };
  }, [
    layerId,
    layerName,
    onTextureLoaded,
  ]);

  // Recalculate visible tiles after camera movement.
  useFrame(() => {
    const config = configRef.current;

    if (!config) return;

    const now = performance.now();

    if (now - lastUpdate.current < 350) {
      return;
    }

    lastUpdate.current = now;

    const nextTiles = getVisibleTiles(
      config,
      camera,
      size.width,
      size.height
    );

    const nextKey = nextTiles
      .map((tile) => tile.key)
      .join("|");

    if (nextKey === lastSelectionKey.current) {
      return;
    }

    lastSelectionKey.current = nextKey;

    setTileSelection(nextTiles);
  });

  const visibleTiles = tileSelection.filter(
    (tile) => !tile.prefetch
  );

  const prefetchTiles = tileSelection.filter(
    (tile) => tile.prefetch
  );

  return (
    <>
      {/* Always keep the global preview beneath detail tiles. */}
      <mesh>
        <sphereGeometry
          args={[BASE_RADIUS, 128, 128]}
        />

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

      {/* Visible detail tiles load independently. */}
      {visibleTiles.map((tile) => (
        <DetailTileMesh
          key={tile.key}
          tile={tile}
        />
      ))}

      {/* Nearby tiles are cached before they are needed. */}
      {prefetchTiles.map((tile) => (
        <TilePreloader
          key={tile.key}
          tile={tile}
        />
      ))}
    </>
  );
}

// --------------------------------------------------
// LOCATION MARKERS
// --------------------------------------------------

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

// --------------------------------------------------
// GLOBE SCENE
// --------------------------------------------------

const _direction = new THREE.Vector3();
const _fullQuaternion = new THREE.Quaternion();
const _stepQuaternion = new THREE.Quaternion();

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

// --------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------

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
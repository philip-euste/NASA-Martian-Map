import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import * as THREE from "three";
import type { MapLayerId } from "../data/mapLayers";
import {
  getDataProvider,
  type TileLayerConfig,
  type TileMatrixLevel,
} from "../services/dataProviders";
import { loadCachedTileImage } from "../features/mars-explorer/marsExplorer.types";
import type { Coordinates } from "../types";

type DetailTile = {
  key: string;
  url: string;
  level: TileMatrixLevel;
  levelIndex: number;
  x: number;
  y: number;
  score: number;
};

type LoadedDetailTile = DetailTile & {
  texture: THREE.Texture;
  loadedAt: number;
};

const BASE_RADIUS = 1;
const DETAIL_RADIUS = 1.0008;

const MAX_DETAIL_TILES = 16;
const DETAIL_CONCURRENCY = 4;
const MAX_TEXTURE_CACHE = 64;

const TILE_GEOMETRY_SEGMENTS = 12;
const DETAIL_CHECK_INTERVAL = 300;

const textureCache = new Map<string, THREE.Texture>();
const tileSphereCache = new Map<string, THREE.Sphere>();

export function coordinatesToVector(
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

export function vectorToCoordinates(vector: THREE.Vector3): Coordinates {
  const normalized = vector.clone().normalize();

  const latitude = THREE.MathUtils.radToDeg(
    Math.asin(THREE.MathUtils.clamp(normalized.y, -1, 1))
  );

  const longitude = THREE.MathUtils.radToDeg(
    Math.atan2(-normalized.z, normalized.x)
  );

  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  };
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
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex++;

      if (index >= items.length) {
        return;
      }

      try {
        const value = await worker(items[index]);
        results[index] = { status: "fulfilled", value };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
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
  texture.anisotropy = 2;
  texture.needsUpdate = true;

  return texture;
}

function getOrCreateTileTexture(
  key: string,
  image: HTMLImageElement
): THREE.Texture {
  const existing = textureCache.get(key);

  if (existing) {
    textureCache.delete(key);
    textureCache.set(key, existing);
    return existing;
  }

  const texture = new THREE.Texture(image);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 2;
  texture.needsUpdate = true;

  textureCache.set(key, texture);

  while (textureCache.size > MAX_TEXTURE_CACHE) {
    const oldestKey = textureCache.keys().next().value;

    if (!oldestKey) break;

    const oldest = textureCache.get(oldestKey);

    textureCache.delete(oldestKey);
    oldest?.dispose();
  }

  return texture;
}

async function stitchGlobalLevelToCanvas(
  config: TileLayerConfig,
  level: TileMatrixLevel,
  baseCanvas: HTMLCanvasElement | null,
  signal: AbortSignal
): Promise<HTMLCanvasElement> {
  const rawWidth = level.matrixWidth * level.tileWidth;
  const rawHeight = level.matrixHeight * level.tileHeight;

  const scale = Math.min(
    1,
    2048 / rawWidth,
    1024 / rawHeight
  );

  const targetWidth = Math.max(1, Math.round(rawWidth * scale));
  const targetHeight = Math.max(1, Math.round(rawHeight * scale));

  const canvas = document.createElement("canvas");

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create global preview canvas.");
  }

  if (baseCanvas) {
    context.drawImage(
      baseCanvas,
      0,
      0,
      targetWidth,
      targetHeight
    );
  }

  const tiles: { url: string; x: number; y: number }[] = [];

  for (let y = 0; y < level.matrixHeight; y++) {
    for (let x = 0; x < level.matrixWidth; x++) {
      tiles.push({
        url: buildTileUrl(config.tileUrlTemplate, level.id, x, y),
        x,
        y,
      });
    }
  }

  const results = await runLimited(
    tiles,
    DETAIL_CONCURRENCY,
    (tile) => loadCachedTileImage(tile.url, signal)
  );

  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  let successfulTiles = 0;

  const drawWidth = targetWidth / level.matrixWidth;
  const drawHeight = targetHeight / level.matrixHeight;

  results.forEach((result, index) => {
    if (result.status !== "fulfilled") return;

    const tile = tiles[index];

    context.drawImage(
      result.value,
      tile.x * drawWidth,
      tile.y * drawHeight,
      drawWidth + 0.35,
      drawHeight + 0.35
    );

    successfulTiles++;
  });

  if (successfulTiles === 0 && !baseCanvas) {
    throw new Error("NASA returned no usable global preview tiles.");
  }

  return canvas;
}

function getTileCoordinates(
  level: TileMatrixLevel,
  x: number,
  y: number
) {
  const longitudeSpan = 360 / level.matrixWidth;
  const latitudeSpan = 180 / level.matrixHeight;

  const west = level.topLeftX + x * longitudeSpan;
  const east = west + longitudeSpan;

  const north = level.topLeftY - y * latitudeSpan;
  const south = north - latitudeSpan;

  return { west, east, north, south };
}

function getTileBoundingSphere(
  level: TileMatrixLevel,
  x: number,
  y: number
): THREE.Sphere {
  const cacheKey = `${level.id}:${level.matrixWidth}:${level.matrixHeight}:${x}:${y}`;

  const cached = tileSphereCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const bounds = getTileCoordinates(level, x, y);

  const center = new THREE.Vector3();
  const points: THREE.Vector3[] = [];

  const samples = 3;

  for (let row = 0; row <= samples; row++) {
    const vertical = row / samples;

    const latitude =
      bounds.north +
      (bounds.south - bounds.north) * vertical;

    for (let column = 0; column <= samples; column++) {
      const horizontal = column / samples;

      const longitude =
        bounds.west +
        (bounds.east - bounds.west) * horizontal;

      const point = coordinatesToVector(
        latitude,
        longitude,
        DETAIL_RADIUS
      );

      points.push(point);
      center.add(point);
    }
  }

  center.divideScalar(points.length);

  let maxDistance = 0;

  for (const point of points) {
    maxDistance = Math.max(
      maxDistance,
      point.distanceTo(center)
    );
  }

  const sphere = new THREE.Sphere(
    center,
    maxDistance + 0.004
  );

  if (tileSphereCache.size > 12000) {
    tileSphereCache.clear();
  }

  tileSphereCache.set(cacheKey, sphere);

  return sphere;
}

function chooseDetailLevelIndex(
  levels: TileMatrixLevel[],
  camera: THREE.Camera,
  viewportHeight: number,
  baseLevelIndex: number
): number {
  const distance = Math.max(
    camera.position.length(),
    BASE_RADIUS + 0.05
  );

  if (
    distance > 2.45 ||
    levels.length <= baseLevelIndex + 1
  ) {
    return -1;
  }

  const perspective = camera as THREE.PerspectiveCamera;

  const fovRad = THREE.MathUtils.degToRad(
    perspective.fov || 45
  );

  const focalPixels =
    viewportHeight / (2 * Math.tan(fovRad / 2));

  const surfaceDistance = Math.max(
    0.15,
    distance - BASE_RADIUS
  );

  const desiredWidth =
    (2 * Math.PI * BASE_RADIUS * focalPixels) /
    surfaceDistance;

  let chosenIndex = baseLevelIndex + 1;

  for (
    let i = baseLevelIndex + 1;
    i < levels.length;
    i++
  ) {
    const levelWidth =
      levels[i].matrixWidth * levels[i].tileWidth;

    chosenIndex = i;

    if (levelWidth >= desiredWidth * 0.85) {
      break;
    }
  }

  return Math.min(chosenIndex, levels.length - 1);
}

function getVisibleTiles(
  config: TileLayerConfig,
  level: TileMatrixLevel,
  levelIndex: number,
  camera: THREE.Camera
): DetailTile[] {
  camera.updateMatrixWorld();

  const viewProjection = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );

  const frustum = new THREE.Frustum();

  frustum.setFromProjectionMatrix(viewProjection);

  const cameraDirection = camera.position.clone().normalize();
  const distance = camera.position.length();

  const horizonDot = Math.max(
    0.08,
    (BASE_RADIUS / Math.max(distance, 1.05)) * 0.72
  );

  const visible: DetailTile[] = [];

  for (let y = 0; y < level.matrixHeight; y++) {
    for (let x = 0; x < level.matrixWidth; x++) {
      const bounds = getTileCoordinates(level, x, y);

      const centerLatitude =
        (bounds.north + bounds.south) / 2;

      const centerLongitude =
        (bounds.west + bounds.east) / 2;

      const centerNormal = coordinatesToVector(
        centerLatitude,
        centerLongitude,
        1
      ).normalize();

      const score = centerNormal.dot(cameraDirection);

      if (score < horizonDot) {
        continue;
      }

      const sphere = getTileBoundingSphere(level, x, y);

      if (!frustum.intersectsSphere(sphere)) {
        continue;
      }

      visible.push({
        key: `${level.id}/${x}/${y}`,
        url: buildTileUrl(
          config.tileUrlTemplate,
          level.id,
          x,
          y
        ),
        level,
        levelIndex,
        x,
        y,
        score,
      });
    }
  }

  visible.sort((a, b) => b.score - a.score);

  return visible.slice(0, MAX_DETAIL_TILES);
}

function createTileGeometry(
  level: TileMatrixLevel,
  x: number,
  y: number,
  radiusOffset = 0
): THREE.BufferGeometry {
  const bounds = getTileCoordinates(level, x, y);

  const segments = TILE_GEOMETRY_SEGMENTS;
  const radius = DETAIL_RADIUS + radiusOffset;

  const positions: number[] = [];
  const uvs: number[] = [];
  const alphas: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= segments; row++) {
    const vertical = row / segments;

    const latitude =
      bounds.north +
      (bounds.south - bounds.north) * vertical;

    for (let column = 0; column <= segments; column++) {
      const horizontal = column / segments;

      const longitude =
        bounds.west +
        (bounds.east - bounds.west) * horizontal;

      const position = coordinatesToVector(
        latitude,
        longitude,
        radius
      );

      positions.push(
        position.x,
        position.y,
        position.z
      );

      uvs.push(horizontal, 1 - vertical);

      const edgeDist = Math.min(
        horizontal,
        1 - horizontal,
        vertical,
        1 - vertical
      );

      const edgeFactor = THREE.MathUtils.smoothstep(
        edgeDist,
        0,
        0.04
      );

      alphas.push(0.92 + 0.08 * edgeFactor);
    }
  }

  for (let row = 0; row < segments; row++) {
    for (let column = 0; column < segments; column++) {
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
    new THREE.Float32BufferAttribute(positions, 3)
  );

  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(uvs, 2)
  );

  geometry.setAttribute(
    "alpha",
    new THREE.Float32BufferAttribute(alphas, 1)
  );

  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

function DetailTileMesh({
  tile,
  isCurrentLevel,
}: {
  tile: LoadedDetailTile;
  isCurrentLevel: boolean;
}) {
  const materialRef = useRef<THREE.MeshBasicMaterial | null>(null);

  const geometry = useMemo(
    () =>
      createTileGeometry(
        tile.level,
        tile.x,
        tile.y,
        isCurrentLevel ? 0.0002 : 0
      ),
    [
      isCurrentLevel,
      tile.level,
      tile.x,
      tile.y,
    ]
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame(() => {
    const material = materialRef.current;

    if (!material) return;

    const elapsed = performance.now() - tile.loadedAt;
    const targetOpacity = Math.min(1, elapsed / 180);

    if (Math.abs(material.opacity - targetOpacity) > 0.01) {
      material.opacity = targetOpacity;
    }
  });

  return (
    <mesh
      geometry={geometry}
      renderOrder={isCurrentLevel ? 3 : 2}
    >
      <meshBasicMaterial
        ref={materialRef}
        map={tile.texture}
        side={THREE.FrontSide}
        transparent
        opacity={0.05}
        depthWrite={false}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={isCurrentLevel ? -2 : -1}
        polygonOffsetUnits={isCurrentLevel ? -2 : -1}
      />
    </mesh>
  );
}

export default function MarsSurface({
  layerId,
  layerName,
  sharedConfig,
  overlayLayerId,
  overlayOpacity = 0.65,
  onTextureLoaded,
  onSelectSurfacePoint,
}: {
  layerId: MapLayerId;
  layerName: string;
  sharedConfig?: TileLayerConfig | null;
  overlayLayerId?: MapLayerId | null;
  overlayOpacity?: number;
  onTextureLoaded: (message: string) => void;
  onSelectSurfacePoint?: (coordinates: Coordinates) => void;
}) {
  const { camera, size } = useThree();

  const [previewTexture, setPreviewTexture] =
    useState<THREE.CanvasTexture | null>(null);
  const [offlineTexture, setOfflineTexture] = useState<THREE.Texture | null>(null);
  const [overlayTexture, setOverlayTexture] = useState<THREE.CanvasTexture | null>(null);

  const [detailTiles, setDetailTiles] =
    useState<LoadedDetailTile[]>([]);

  const [activeLevelIndex, setActiveLevelIndex] =
    useState<number>(-1);

  const activeConfigRef = useRef<TileLayerConfig | null>(null);
  const baseLevelIndexRef = useRef(0);

  const lastCheckTimeRef = useRef(0);
  const lastRequestedKeysRef = useRef("");

  const detailAbortRef = useRef<AbortController | null>(null);

  const pointerDownPosRef = useRef<{
    x: number;
    y: number;
  } | null>(null);

  const lastCameraPositionRef = useRef(new THREE.Vector3());
  const lastCameraQuaternionRef = useRef(new THREE.Quaternion());
  const lastCameraSnapshotRef = useRef(false);

  // Keep the latest callback without restarting the NASA loading effect.
  const onTextureLoadedRef = useRef(onTextureLoaded);
  onTextureLoadedRef.current = onTextureLoaded;

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    let active = true;
    let loadedTexture: THREE.Texture | null = null;
    loader.load("/textures/mars-color.png", (texture) => {
      if (!active) { texture.dispose(); return; }
      loadedTexture = texture;
      texture.colorSpace = THREE.SRGBColorSpace;
      setOfflineTexture(texture);
    });
    return () => { active = false; loadedTexture?.dispose(); };
  }, []);

  useEffect(() => {
    let active = true;
    let texture: THREE.CanvasTexture | null = null;
    setOverlayTexture(null);
    if (!overlayLayerId || overlayLayerId === layerId) return;
    const controller = new AbortController();
    void getDataProvider("nasaTrek").getLayerConfig(overlayLayerId)
      .then(async (config) => {
        const level = config.matrixLevels?.[0];
        if (!level) throw new Error("Overlay has no global tile level.");
        const canvas = await stitchGlobalLevelToCanvas(config, level, null, controller.signal);
        if (!active) return;
        texture = createCanvasTexture(canvas);
        setOverlayTexture(texture);
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          console.error(`Failed to load 3D comparative overlay ${overlayLayerId}:`, error);
        }
      });
    return () => {
      active = false;
      controller.abort();
      texture?.dispose();
    };
  }, [overlayLayerId, layerId]);

  useEffect(() => {
    const controller = new AbortController();

    let active = true;

    const createdTextures: THREE.CanvasTexture[] = [];

    activeConfigRef.current = null;
    baseLevelIndexRef.current = 0;
    lastRequestedKeysRef.current = "";

    lastCameraSnapshotRef.current = false;

    setDetailTiles([]);
    setActiveLevelIndex(-1);

    onTextureLoadedRef.current(`Loading ${layerName}...`);

    async function initialize() {
      const config =
        sharedConfig ??
        (await getDataProvider("nasaTrek").getLayerConfig(layerId));

      if (!active || controller.signal.aborted) return;

      const levels = config.matrixLevels;

      if (!levels || levels.length === 0) {
        throw new Error("NASA layer did not provide matrix levels.");
      }

      activeConfigRef.current = config;

      const maxGlobalIndex = levels.reduce(
        (acc, level, index) => {
          const count =
            level.matrixWidth * level.matrixHeight;

          return count <= 32 ? index : acc;
        },
        0
      );

      let currentCanvas: HTMLCanvasElement | null = null;

      for (let index = 0; index <= maxGlobalIndex; index++) {
        if (!active || controller.signal.aborted) return;

        const level = levels[index];

        try {
          currentCanvas = await stitchGlobalLevelToCanvas(
            config,
            level,
            currentCanvas,
            controller.signal
          );

          if (!active || controller.signal.aborted) return;

          const nextTexture = createCanvasTexture(currentCanvas);

          createdTextures.push(nextTexture);

          baseLevelIndexRef.current = index;

          setPreviewTexture(nextTexture);

          onTextureLoadedRef.current(
            index === maxGlobalIndex
              ? `${layerName} ready`
              : `${layerName} preview loaded · refining surface...`
          );
        } catch (error) {
          if (index === 0) {
            throw error;
          }

          break;
        }
      }
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
        `Failed to initialize NASA layer ${layerId}:`,
        error
      );

      onTextureLoadedRef.current(
        `Failed to load ${layerName}`
      );
    });

    return () => {
      active = false;

      controller.abort();
      detailAbortRef.current?.abort();

      activeConfigRef.current = null;

      createdTextures.forEach((texture) => {
        texture.dispose();
      });
    };
  }, [layerId, layerName, sharedConfig]);

  // Stream detailed tiles only when the camera has actually moved.
  useFrame(() => {
    const config = activeConfigRef.current;

    if (!config?.matrixLevels) return;

    const now = performance.now();

    if (
      now - lastCheckTimeRef.current <
      DETAIL_CHECK_INTERVAL
    ) {
      return;
    }

    lastCheckTimeRef.current = now;

    const positionChanged =
      !lastCameraSnapshotRef.current ||
      camera.position.distanceToSquared(
        lastCameraPositionRef.current
      ) > 0.00004;

    const rotationChanged =
      !lastCameraSnapshotRef.current ||
      camera.quaternion.angleTo(
        lastCameraQuaternionRef.current
      ) > 0.006;

    if (!positionChanged && !rotationChanged) {
      return;
    }

    lastCameraPositionRef.current.copy(camera.position);
    lastCameraQuaternionRef.current.copy(camera.quaternion);
    lastCameraSnapshotRef.current = true;

    const levels = config.matrixLevels;

    const chosenIndex = chooseDetailLevelIndex(
      levels,
      camera,
      size.height,
      baseLevelIndexRef.current
    );

    if (chosenIndex < 0) {
      if (lastRequestedKeysRef.current !== "") {
        lastRequestedKeysRef.current = "";

        detailAbortRef.current?.abort();

        setDetailTiles([]);
        setActiveLevelIndex(-1);
      }

      return;
    }

    const level = levels[chosenIndex];

    const visible = getVisibleTiles(
      config,
      level,
      chosenIndex,
      camera
    );

    const nextKeySignature =
      `${chosenIndex}:` +
      visible.map((tile) => tile.key).join("|");

    if (
      nextKeySignature === lastRequestedKeysRef.current
    ) {
      return;
    }

    lastRequestedKeysRef.current = nextKeySignature;

    setActiveLevelIndex(chosenIndex);

    detailAbortRef.current?.abort();

    const controller = new AbortController();

    detailAbortRef.current = controller;

    runLimited(
      visible,
      DETAIL_CONCURRENCY,
      async (tile): Promise<LoadedDetailTile> => {
        const image = await loadCachedTileImage(
          tile.url,
          controller.signal
        );

        const texture = getOrCreateTileTexture(
          `${layerId}:${tile.key}`,
          image
        );

        return {
          ...tile,
          texture,
          loadedAt: performance.now(),
        };
      }
    )
      .then((results) => {
        if (controller.signal.aborted) return;

        const fulfilled = results
          .filter(
            (
              result
            ): result is PromiseFulfilledResult<LoadedDetailTile> =>
              result.status === "fulfilled"
          )
          .map((result) => result.value);

        const requestedKeySet = new Set(
          visible.map((tile) => tile.key)
        );

        setDetailTiles((previous) => {
          const nextByKey = new Map<
            string,
            LoadedDetailTile
          >();

          for (const previousTile of previous) {
            if (requestedKeySet.has(previousTile.key)) {
              nextByKey.set(
                previousTile.key,
                previousTile
              );
            }
          }

          for (const loadedTile of fulfilled) {
            if (!nextByKey.has(loadedTile.key)) {
              nextByKey.set(
                loadedTile.key,
                loadedTile
              );
            }
          }

          if (fulfilled.length < visible.length) {
            for (const previousTile of previous) {
              if (
                previousTile.levelIndex !== chosenIndex &&
                nextByKey.size < MAX_DETAIL_TILES + 8
              ) {
                nextByKey.set(
                  previousTile.key,
                  previousTile
                );
              }
            }
          }

          return Array.from(nextByKey.values());
        });
      })
      .catch(() => {
        // Aborted tile batches are expected when the camera moves.
      });
  });

  const handlePointerDown = (
    event: ThreeEvent<PointerEvent>
  ) => {
    pointerDownPosRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handleClick = (
    event: ThreeEvent<MouseEvent>
  ) => {
    if (!onSelectSurfacePoint) return;

    const down = pointerDownPosRef.current;

    if (down) {
      const moved = Math.hypot(
        event.clientX - down.x,
        event.clientY - down.y
      );

      if (moved > 5) return;
    }

    event.stopPropagation();

    const coordinates = vectorToCoordinates(event.point);

    onSelectSurfacePoint(coordinates);
  };

  return (
    <>
      <mesh
        renderOrder={1}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        <sphereGeometry
          args={[BASE_RADIUS, 64, 64]}
        />

        <meshBasicMaterial
          key={previewTexture ? "preview" : offlineTexture ? "offline" : "flat"}
          map={previewTexture ?? offlineTexture}
          color={previewTexture || offlineTexture ? "#ffffff" : "#b75c35"}
          side={THREE.FrontSide}
          toneMapped={false}
        />
      </mesh>

      {overlayTexture && (
        <mesh renderOrder={2}>
          <sphereGeometry args={[BASE_RADIUS + 0.0015, 64, 64]} />
          <meshBasicMaterial map={overlayTexture} transparent opacity={overlayOpacity} depthWrite={false} side={THREE.FrontSide} toneMapped={false} />
        </mesh>
      )}

      {detailTiles.map((tile) => (
        <DetailTileMesh
          key={tile.key}
          tile={tile}
          isCurrentLevel={
            tile.levelIndex === activeLevelIndex
          }
        />
      ))}
    </>
  );
}

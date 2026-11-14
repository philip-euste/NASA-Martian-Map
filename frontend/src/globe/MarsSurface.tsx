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
const MAX_DETAIL_TILES = 28;
const DETAIL_CONCURRENCY = 6;
const MAX_TEXTURE_CACHE = 96;

const textureCache = new Map<string, THREE.Texture>();

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

function createCanvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
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
  texture.anisotropy = 4;
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
  const scale = Math.min(1, 2048 / rawWidth, 1024 / rawHeight);
  const targetWidth = Math.max(1, Math.round(rawWidth * scale));
  const targetHeight = Math.max(1, Math.round(rawHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create global preview canvas.");
  }

  // Paint previous resolution underneath so any missing tile retains valid imagery
  if (baseCanvas) {
    context.drawImage(baseCanvas, 0, 0, targetWidth, targetHeight);
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

  const results = await runLimited(tiles, DETAIL_CONCURRENCY, (tile) =>
    loadCachedTileImage(tile.url, signal)
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

function getTileCoordinates(level: TileMatrixLevel, x: number, y: number) {
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
  const bounds = getTileCoordinates(level, x, y);
  const points: THREE.Vector3[] = [];
  const samples = 3;

  for (let row = 0; row <= samples; row++) {
    const vertical = row / samples;
    const latitude = bounds.north + (bounds.south - bounds.north) * vertical;
    for (let column = 0; column <= samples; column++) {
      const horizontal = column / samples;
      const longitude = bounds.west + (bounds.east - bounds.west) * horizontal;
      points.push(coordinatesToVector(latitude, longitude, DETAIL_RADIUS));
    }
  }

  const center = new THREE.Vector3();
  for (const point of points) {
    center.add(point);
  }
  center.divideScalar(points.length);

  let maxDistance = 0;
  for (const point of points) {
    const d = point.distanceTo(center);
    if (d > maxDistance) maxDistance = d;
  }

  return new THREE.Sphere(center, maxDistance + 0.004);
}

function chooseDetailLevelIndex(
  levels: TileMatrixLevel[],
  camera: THREE.Camera,
  viewportHeight: number,
  baseLevelIndex: number
): number {
  const distance = Math.max(camera.position.length(), BASE_RADIUS + 0.05);
  // At broader orbital distances, the stitched 2048x1024 global canvas already
  // provides a continuous gap-free surface; only stream detail tiles when zooming closer.
  if (distance > 2.45 || levels.length <= baseLevelIndex + 1) {
    return -1;
  }

  const perspective = camera as THREE.PerspectiveCamera;
  const fovRad = THREE.MathUtils.degToRad(perspective.fov || 45);
  const focalPixels = viewportHeight / (2 * Math.tan(fovRad / 2));
  const surfaceDistance = Math.max(0.15, distance - BASE_RADIUS);
  const desiredWidth = (2 * Math.PI * BASE_RADIUS * focalPixels) / surfaceDistance;

  let chosenIndex = baseLevelIndex + 1;
  for (let i = baseLevelIndex + 1; i < levels.length; i++) {
    const levelWidth = levels[i].matrixWidth * levels[i].tileWidth;
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
  // Horizon dot-product threshold tightens as camera approaches the surface
  const horizonDot = Math.max(0.08, (BASE_RADIUS / Math.max(distance, 1.05)) * 0.72);

  const visible: DetailTile[] = [];

  for (let y = 0; y < level.matrixHeight; y++) {
    for (let x = 0; x < level.matrixWidth; x++) {
      const bounds = getTileCoordinates(level, x, y);
      const centerLatitude = (bounds.north + bounds.south) / 2;
      const centerLongitude = (bounds.west + bounds.east) / 2;
      const centerNormal = coordinatesToVector(centerLatitude, centerLongitude, 1).normalize();
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
        url: buildTileUrl(config.tileUrlTemplate, level.id, x, y),
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
  const segments = 24;
  const radius = DETAIL_RADIUS + radiusOffset;

  const positions: number[] = [];
  const uvs: number[] = [];
  const alphas: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= segments; row++) {
    const vertical = row / segments;
    const latitude = bounds.north + (bounds.south - bounds.north) * vertical;

    for (let column = 0; column <= segments; column++) {
      const horizontal = column / segments;
      const longitude = bounds.west + (bounds.east - bounds.west) * horizontal;

      const position = coordinatesToVector(latitude, longitude, radius);
      positions.push(position.x, position.y, position.z);
      uvs.push(horizontal, 1 - vertical);

      // Subtle feather at outer perimeter vertices to blend smoothly with base globe
      const edgeDist = Math.min(horizontal, 1 - horizontal, vertical, 1 - vertical);
      const edgeFactor = THREE.MathUtils.smoothstep(edgeDist, 0, 0.04);
      alphas.push(0.92 + 0.08 * edgeFactor);
    }
  }

  for (let row = 0; row < segments; row++) {
    for (let column = 0; column < segments; column++) {
      const a = row * (segments + 1) + column;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("alpha", new THREE.Float32BufferAttribute(alphas, 1));
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
    [isCurrentLevel, tile.level, tile.x, tile.y]
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame(() => {
    const mat = materialRef.current;
    if (!mat) return;
    const elapsed = performance.now() - tile.loadedAt;
    const targetOpacity = Math.min(1, elapsed / 180);
    if (Math.abs(mat.opacity - targetOpacity) > 0.01) {
      mat.opacity = targetOpacity;
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
  onTextureLoaded,
  onSelectSurfacePoint,
}: {
  layerId: MapLayerId;
  layerName: string;
  sharedConfig?: TileLayerConfig | null;
  onTextureLoaded: (message: string) => void;
  onSelectSurfacePoint?: (coordinates: Coordinates) => void;
}) {
  const { camera, size } = useThree();

  const [previewTexture, setPreviewTexture] =
    useState<THREE.CanvasTexture | null>(null);
  const [detailTiles, setDetailTiles] = useState<LoadedDetailTile[]>([]);
  const [activeLevelIndex, setActiveLevelIndex] = useState<number>(-1);

  const activeConfigRef = useRef<TileLayerConfig | null>(null);
  const baseLevelIndexRef = useRef(0);
  const lastCheckTimeRef = useRef(0);
  const lastRequestedKeysRef = useRef("");
  const detailAbortRef = useRef<AbortController | null>(null);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);

  // Load and progressively refine the continuous global base texture (level 0 -> 1 -> 2)
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const createdTextures: THREE.CanvasTexture[] = [];

    activeConfigRef.current = null;
    baseLevelIndexRef.current = 0;
    lastRequestedKeysRef.current = "";
    setDetailTiles([]);
    setActiveLevelIndex(-1);

    onTextureLoaded(`Loading ${layerName}...`);

    async function initialize() {
      const config =
        sharedConfig ??
        (await getDataProvider("nasaTrek").getLayerConfig(layerId));

      if (!active) return;

      const levels = config.matrixLevels;
      if (!levels || levels.length === 0) {
        throw new Error("NASA layer did not provide matrix levels.");
      }

      activeConfigRef.current = config;

      // Determine progressive global canvas levels whose total tile count <= 32
      const maxGlobalIndex = levels.reduce((acc, lvl, idx) => {
        const count = lvl.matrixWidth * lvl.matrixHeight;
        return count <= 32 ? idx : acc;
      }, 0);

      let currentCanvas: HTMLCanvasElement | null = null;

      for (let idx = 0; idx <= maxGlobalIndex; idx++) {
        if (!active || controller.signal.aborted) return;
        const level = levels[idx];
        try {
          currentCanvas = await stitchGlobalLevelToCanvas(
            config,
            level,
            currentCanvas,
            controller.signal
          );
          if (!active || controller.signal.aborted) return;

          const nextTex = createCanvasTexture(currentCanvas);
          createdTextures.push(nextTex);
          baseLevelIndexRef.current = idx;
          setPreviewTexture(nextTex);

          onTextureLoaded(
            idx === maxGlobalIndex
              ? `${layerName} ready`
              : `${layerName} preview loaded · refining surface...`
          );
        } catch (err) {
          if (idx === 0) throw err;
          break;
        }
      }
    }

    initialize().catch((error: unknown) => {
      if (!active) return;
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error(`Failed to initialize NASA layer ${layerId}:`, error);
      onTextureLoaded(`Failed to load ${layerName}`);
    });

    return () => {
      active = false;
      controller.abort();
      detailAbortRef.current?.abort();
      activeConfigRef.current = null;
      createdTextures.forEach((tex) => tex.dispose());
    };
  }, [layerId, layerName, onTextureLoaded, sharedConfig]);

  // Progressive detail tile streaming for close-up camera views
  useFrame(() => {
    const config = activeConfigRef.current;
    if (!config?.matrixLevels) return;

    const now = performance.now();
    if (now - lastCheckTimeRef.current < 220) {
      return;
    }
    lastCheckTimeRef.current = now;

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
    const visible = getVisibleTiles(config, level, chosenIndex, camera);
    const nextKeySignature = `${chosenIndex}:${visible.map((t) => t.key).join("|")}`;

    if (nextKeySignature === lastRequestedKeysRef.current) {
      return;
    }

    lastRequestedKeysRef.current = nextKeySignature;
    setActiveLevelIndex(chosenIndex);

    detailAbortRef.current?.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;

    runLimited(visible, DETAIL_CONCURRENCY, async (tile): Promise<LoadedDetailTile> => {
      const image = await loadCachedTileImage(tile.url, controller.signal);
      const texture = getOrCreateTileTexture(`${layerId}:${tile.key}`, image);
      return {
        ...tile,
        texture,
        loadedAt: performance.now(),
      };
    })
      .then((results) => {
        if (controller.signal.aborted) return;

        const fulfilled = results
          .filter(
            (r): r is PromiseFulfilledResult<LoadedDetailTile> =>
              r.status === "fulfilled"
          )
          .map((r) => r.value);

        const requestedKeySet = new Set(visible.map((t) => t.key));

        setDetailTiles((previous) => {
          const nextByKey = new Map<string, LoadedDetailTile>();

          // Retain already-loaded tiles from the current request so theirloadedAt timestamp stays intact
          for (const prev of previous) {
            if (requestedKeySet.has(prev.key)) {
              nextByKey.set(prev.key, prev);
            }
          }

          for (const loaded of fulfilled) {
            if (!nextByKey.has(loaded.key)) {
              nextByKey.set(loaded.key, loaded);
            }
          }

          // If some requested tiles failed or are still missing, keep fallback tiles from the previous level
          if (fulfilled.length < visible.length) {
            for (const prev of previous) {
              if (prev.levelIndex !== chosenIndex && nextByKey.size < MAX_DETAIL_TILES + 8) {
                nextByKey.set(prev.key, prev);
              }
            }
          }

          return Array.from(nextByKey.values());
        });
      })
      .catch(() => {
        // Ignore aborted batches
      });
  });

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    pointerDownPosRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!onSelectSurfacePoint) return;
    const down = pointerDownPosRef.current;
    if (down) {
      const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
      if (moved > 5) return;
    }
    event.stopPropagation();
    const coords = vectorToCoordinates(event.point);
    onSelectSurfacePoint(coords);
  };

  return (
    <>
      <mesh
        renderOrder={1}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        <sphereGeometry args={[BASE_RADIUS, 128, 128]} />
        <meshBasicMaterial
          key={previewTexture ? "preview" : "flat"}
          map={previewTexture}
          color={previewTexture ? "#ffffff" : "#b75c35"}
          side={THREE.FrontSide}
          toneMapped={false}
        />
      </mesh>

      {detailTiles.map((tile) => (
        <DetailTileMesh
          key={tile.key}
          tile={tile}
          isCurrentLevel={tile.levelIndex === activeLevelIndex}
        />
      ))}
    </>
  );
}

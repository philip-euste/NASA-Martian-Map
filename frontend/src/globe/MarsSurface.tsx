
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useFrame,
  useThree,
} from "@react-three/fiber";

import * as THREE from "three";

import {
  type MapLayerId,
} from "../data/mapLayers";

import {
  getDataProvider,
  type TileLayerConfig,
  type TileMatrixLevel,
} from "../services/dataProviders";

// ==========================================
// TYPES
// ==========================================

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

// ==========================================
// CONFIGURATION
// ==========================================

const BASE_RADIUS = 1;
const DETAIL_RADIUS = 1.006;

const MAX_DETAIL_TILES = 24;
const DETAIL_CONCURRENCY = 6;

// ==========================================
// CACHES AND REUSABLE OBJECTS
// ==========================================

const imageCache = new Map<
  string,
  Promise<HTMLImageElement>
>();

// ==========================================
// COORDINATE UTILITIES
// ==========================================

export function coordinatesToVector(
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

// ==========================================
// IMAGE LOADING
// ==========================================

function loadImage(
  url: string
): Promise<HTMLImageElement> {
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

// ==========================================
// CONCURRENT REQUEST HANDLING
// ==========================================

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

// ==========================================
// TEXTURE CREATION
// ==========================================

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

// ==========================================
// GLOBAL PREVIEW
// ==========================================

async function loadGlobalPreview(
  config: TileLayerConfig
): Promise<THREE.CanvasTexture> {
  const level = config.matrixLevels?.[0];

  if (!level) {
    throw new Error(
      "NASA layer has no tile matrix metadata."
    );
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

// ==========================================
// TILE COORDINATES
// ==========================================

function getTileCoordinates(
  level: TileMatrixLevel,
  x: number,
  y: number
) {
  const longitudeSpan =
    360 / level.matrixWidth;

  const latitudeSpan =
    180 / level.matrixHeight;

  const west =
    level.topLeftX + x * longitudeSpan;

  const east =
    west + longitudeSpan;

  const north =
    level.topLeftY - y * latitudeSpan;

  const south =
    north - latitudeSpan;

  return {
    west,
    east,
    north,
    south,
  };
}

// ==========================================
// VISIBLE TILE SELECTION
// ==========================================

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

// ==========================================
// DETAIL TILE GEOMETRY
// ==========================================

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

  for (
    let row = 0;
    row <= segments;
    row++
  ) {
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
      uvs.push(
        horizontal,
        1 - vertical
      );
    }
  }

  for (
    let row = 0;
    row < segments;
    row++
  ) {
    for (
      let column = 0;
      column < segments;
      column++
    ) {
      const a =
        row * (segments + 1) + column;

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

// ==========================================
// DETAIL TILE MESH
// ==========================================

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
    [
      tile.level,
      tile.x,
      tile.y,
    ]
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      tile.texture.dispose();
    };
  }, [
    geometry,
    tile.texture,
  ]);

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

// ==========================================
// MARS SURFACE
// ==========================================

export default function MarsSurface({
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

  const activeConfig =
    useRef<TileLayerConfig | null>(null);

  const requestedTiles =
    useRef<DetailTile[]>([]);

  const lastRequestedKeys =
    useRef("");

  const [requestVersion, setRequestVersion] =
    useState(0);

  // ========================================
  // FETCH NASA METADATA AND GLOBAL PREVIEW
  // ========================================

  useEffect(() => {
    let active = true;

    let loadedPreview: THREE.CanvasTexture | null =
      null;

    activeConfig.current = null;
    lastRequestedKeys.current = "";

    setConfig(null);
    setPreviewTexture(null);
    setDetailTiles([]);
    setDetailStatus("");

    onTextureLoaded(
      `Loading ${layerName}...`
    );

    async function initialize() {
      const provider =
        getDataProvider("nasaTrek");

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

    initialize().catch(
      (error: unknown) => {
        if (!active) return;

        console.error(
          `Failed to initialize NASA layer ${layerId}:`,
          error
        );

        onTextureLoaded(
          `Failed to load ${layerName}`
        );
      }
    );

    return () => {
      active = false;

      activeConfig.current = null;

      loadedPreview?.dispose();
    };
  }, [
    layerId,
    layerName,
    onTextureLoaded,
  ]);

  // ========================================
  // DETERMINE DETAIL LEVEL BASED ON CAMERA
  // ========================================

  useFrame(() => {
    const currentConfig =
      activeConfig.current;

    if (!currentConfig?.matrixLevels) {
      return;
    }

    const now = performance.now();

    // Avoid recalculating tile visibility every frame.
    if (now - lastUpdate.current < 500) {
      return;
    }

    lastUpdate.current = now;

    const levels =
      currentConfig.matrixLevels;

    if (levels.length < 2) {
      return;
    }

    const distance =
      camera.position.length();

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

    const selectedLevel =
      levels[levelIndex];

    const visibleTiles = getVisibleTiles(
      currentConfig,
      selectedLevel,
      camera.position
    );

    const nextKeys = visibleTiles
      .map((tile) => tile.key)
      .join("|");

    // Do not request the same set of tiles repeatedly.
    if (lastRequestedKeys.current === nextKeys) {
      return;
    }

    lastRequestedKeys.current = nextKeys;

    // Store requested tile list for the loading effect.
    requestedTiles.current = visibleTiles;

    setDetailStatus(
      `${visibleTiles.length} detail tiles requested`
    );

    setRequestVersion(
      (version) => version + 1
    );
  });

  // ========================================
  // FETCH VISIBLE DETAIL TILES
  // ========================================

  useEffect(() => {
    const currentConfig =
      activeConfig.current;

    if (
      !currentConfig ||
      requestVersion === 0
    ) {
      return;
    }

    let active = true;

    const requested =
      requestedTiles.current;

    async function loadDetails() {
      const results = await runLimited(
        requested,
        DETAIL_CONCURRENCY,
        async (
          tile
        ): Promise<LoadedDetailTile> => {
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

      const failed =
        results.length - successful.length;

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

        const next =
          Array.from(nextMap.values());

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

    loadDetails().catch(
      (error: unknown) => {
        if (active) {
          console.error(
            "Detail tile loading failed:",
            error
          );
        }
      }
    );

    return () => {
      active = false;
    };
  }, [requestVersion]);

  // ========================================
  // RENDER
  // ========================================

  return (
    <>
      {/* Base planetary sphere */}
      <mesh>
        <sphereGeometry
          args={[
            BASE_RADIUS,
            128,
            128,
          ]}
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

      {/* Higher-resolution surface tiles */}
      {detailTiles.map((tile) => (
        <DetailTileMesh
          key={tile.key}
          tile={tile}
        />
      ))}
    </>
  );
}

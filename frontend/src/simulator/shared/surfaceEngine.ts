// frontend/src/simulator/shared/surfaceEngine.ts
//
// Shared Three.js + 2D Tactical Map surface simulation engine.
//
// Driven by a `SimulatorEnvironmentConfig` so Jezero Crater today — and Gale
// Crater, Valles Marineris, and Olympus Mons in the future — share the same
// first-person physics, camera projection, seamless LOD terrain streaming,
// beacon proximity system, and edge-to-edge tactical navigation map.

import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import type { SimulatorEnvironmentConfig } from "./environment";
import { verticalFovForAspect } from "./projection";

export type SurfaceLayer = "imagery" | "hillshade" | "elevation" | "slope";

export interface Manifest {
  name: string;
  source: { dem: string; ortho: string | null; credit: string };
  cols: number;
  rows: number;
  tileSize: number;
  tilesX: number;
  tilesY: number;
  cellX: number;
  cellZ: number;
  heightMin: number;
  heightMax: number;
  heightScale: number;
  overview: { step: number; cols: number; rows: number };
  textureSize: number;
  textures: string;
  mapImage: string;
  proj: {
    westLonDeg: number;
    eastLonDeg: number;
    northLatDeg: number;
    southLatDeg: number;
    radius: number;
    latCenterDeg: number;
  };
}

interface Tile {
  tx: number;
  ty: number;
  mesh: THREE.Mesh | null;
  lod: number;
  edgeKey: string;
  full: Uint16Array | null;
  tex: THREE.Texture | null;
  texKey: string;
  loading: boolean;
  texLoading: boolean;
}

export interface MissionTargetBeacon {
  id: string;
  name: string;
  lat: number;
  lon: number;
  description?: string;
  visited?: boolean;
  isBase?: boolean;
  group?: THREE.Group;
}

interface ExpeditionTargetMessage {
  type:
    | "mars-explorer:expedition"
    | "mars-explorer:targets"
    | "mars-explorer:teleport"
    | "mars-explorer:return-base"
    | "mars-explorer:contingency"
    | "mars-explorer:modal-state"
    | "mars-explorer:toggle-map"
    | "mars-explorer:toggle-flight"
    | "mars-explorer:set-layer";
  regionId?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  withinJezeroDem?: boolean;
  withinDem?: boolean;
  open?: boolean;
  layer?: SurfaceLayer;
  targets?: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    description?: string;
    visited?: boolean;
    kind?: string;
  }[];
  contingency?: string | null;
}

export function mountSurfaceSimulator(envConfig: SimulatorEnvironmentConfig): void {
  const CONFIG = {
    dataUrl: envConfig.terrain.baseUrl,
    nearTileRadius: 1,
    lodDistances: [2800, 6400, 13000],
    lodSteps: [1, 2, 4, 8],
    farStep: 8,
    skirtDepth: 85,
    eyeHeight: 1.72,
    walkSpeed: 4.8,
    sprintSpeed: 11.5,
    suitAcceleration: 9.5,
    suitDamping: 7.0,
    flySpeed: 250,
    flySprintSpeed: 1200,
    jumpSpeed: 3.4,
    gravity: 3.71,
    maxConcurrentLoads: 6,
    marsTint: new THREE.Color(envConfig.atmosphere.terrainTint),
    groundOffset: 0,
    /** Margin in DEM cells trimmed from outer edges where ortho/DEM clamping occurs. */
    edgeTrimCells: 20,
  };

  const LANDMARKS = envConfig.landmarks.map((lm) => ({
    id: lm.id,
    name: lm.name,
    lat: lm.latitude,
    lon: lm.longitude,
    description: lm.description,
  }));

  const $ = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;

  if (window.parent && window.parent !== window) {
    document.body.classList.add("hosted-visor");
  }

  const overlay = $("overlay");
  const startBtn = $<HTMLButtonElement>("start");
  const statusEl = $("status");
  const proximityEl = $("proximity-prompt");
  const hudPos = $("hud-pos");
  const hudSlope = $("hud-slope");
  const hudBase = $("hud-base");
  const hudTiles = $("hud-tiles");
  const hudMode = $("hud-mode");
  const loadingEl = $("loading");
  const mapPanel = $("map-panel");
  const mapCanvas = $<HTMLCanvasElement>("map-canvas");
  const mapInfo = $("map-info");
  const mapGo = $<HTMLButtonElement>("map-go");
  const mapClose = $<HTMLButtonElement>("map-close");
  const mapZoomIn = document.getElementById("map-zoom-in") as HTMLButtonElement | null;
  const mapZoomOut = document.getElementById("map-zoom-out") as HTMLButtonElement | null;
  const mapZoomReset = document.getElementById("map-zoom-reset") as HTMLButtonElement | null;
  const mapCenterPlayer = document.getElementById("map-center-player") as HTMLButtonElement | null;
  const mapZoomLabel = document.getElementById("map-zoom-label") as HTMLElement | null;
  const openMapBtn = $<HTMLButtonElement>("open-map");
  const layerBtn = document.getElementById("layer-btn") as HTMLButtonElement | null;
  const creditEl = $("credit");

  let externalModalOpen = false;

  // ------------------------------------------------------------ renderer & camera
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    logarithmicDepthBuffer: true,
    powerPreference: "high-performance",
  });

  const getViewportSize = () => ({
    width: Math.max(1, document.documentElement.clientWidth || window.innerWidth),
    height: Math.max(1, document.documentElement.clientHeight || window.innerHeight),
  });

  const initVp = getViewportSize();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(initVp.width, initVp.height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const nominalSkyColor = new THREE.Color(envConfig.atmosphere.skyColor);
  const dustStormSkyColor = new THREE.Color(envConfig.atmosphere.dustStorm.skyColor);

  scene.background = nominalSkyColor.clone();

  const sceneFog = new THREE.Fog(
    nominalSkyColor.clone(),
    envConfig.atmosphere.fogNearMeters,
    envConfig.atmosphere.fogFarMeters
  );
  scene.fog = sceneFog;

  const initAspect = initVp.width / initVp.height;
  const camera = new THREE.PerspectiveCamera(
    verticalFovForAspect(initAspect),
    initAspect,
    0.4,
    80000
  );
  // Use YXZ Euler order to match PointerLockControls and prevent horizon roll.
  camera.rotation.order = "YXZ";

  scene.add(new THREE.HemisphereLight(0xf3d6bd, 0x5a3a28, 0.92));

  const sun = new THREE.DirectionalLight(0xfff1e0, 1.75);
  sun.position
    .set(
      envConfig.atmosphere.sunDirection[0],
      envConfig.atmosphere.sunDirection[1],
      envConfig.atmosphere.sunDirection[2]
    )
    .normalize();
  scene.add(sun);

  const controls = new PointerLockControls(camera, renderer.domElement);
  controls.pointerSpeed = 0.25;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI - 0.15;

  const MAX_DELTA = 250;
  document.addEventListener(
    "mousemove",
    (ev) => {
      if (Math.abs(ev.movementX) > MAX_DELTA || Math.abs(ev.movementY) > MAX_DELTA) {
        ev.stopImmediatePropagation();
      }
    },
    true
  );

  // ------------------------------------------------------------ state
  let M: Manifest;
  let overview: Uint16Array;
  let overviewTex: THREE.Texture | null = null;
  let mapImg: HTMLImageElement | null = null;

  const tiles: Tile[] = [];

  let activeLoads = 0;
  let halfW = 0;
  let halfD = 0;
  let validColMin = 20;
  let validColMax = 4436;
  let validRowMin = 20;
  let validRowMax = 5047;

  let initialCameraViewSet = false;
  let baseWorldPos = new THREE.Vector3(0, 0, 0);
  let baseLatLon = {
    lat: LANDMARKS[0].lat,
    lon: LANDMARKS[0].lon,
  };

  const beaconGroup = new THREE.Group();
  scene.add(beaconGroup);

  let missionBeacons: MissionTargetBeacon[] = [];
  let nearestBeacon: {
    beacon: MissionTargetBeacon;
    distMeters: number;
  } | null = null;

  const player = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    horizVel: new THREE.Vector2(0, 0),
    onGround: false,
    fly: false,
    totalTraverseMeters: 0,
    elapsedSeconds: 0,
    currentSlopeDeg: 0,
  };

  const keys = new Set<string>();

  // ------------------------------------------------------------ coords
  function lonLatToColRow(lon: number, lat: number) {
    const p = M.proj;
    return {
      col:
        ((lon - p.westLonDeg) / (p.eastLonDeg - p.westLonDeg)) * M.cols - 0.5,
      row:
        ((p.northLatDeg - lat) / (p.northLatDeg - p.southLatDeg)) * M.rows - 0.5,
    };
  }

  function colRowToLonLat(col: number, row: number) {
    const p = M.proj;
    return {
      lon:
        p.westLonDeg +
        ((col + 0.5) / M.cols) * (p.eastLonDeg - p.westLonDeg),
      lat:
        p.northLatDeg -
        ((row + 0.5) / M.rows) * (p.northLatDeg - p.southLatDeg),
    };
  }

  const colToX = (c: number) => c * M.cellX - halfW;
  const rowToZ = (r: number) => r * M.cellZ - halfD;
  const xToCol = (x: number) => (x + halfW) / M.cellX;
  const zToRow = (z: number) => (z + halfD) / M.cellZ;

  function isLonLatInsideManifest(lon: number, lat: number): boolean {
    if (!M) return false;
    const p = M.proj;
    return (
      lon >= p.westLonDeg &&
      lon <= p.eastLonDeg &&
      lat >= p.southLatDeg &&
      lat <= p.northLatDeg
    );
  }

  // ------------------------------------------------------------ height & slope sampling
  function overviewH(oc: number, or: number) {
    const o = M.overview;
    const maxOc = Math.min(o.cols - 1, Math.floor(validColMax / o.step));
    const maxOr = Math.min(o.rows - 1, Math.floor(validRowMax / o.step));
    oc = Math.min(Math.max(oc, 0), maxOc);
    or = Math.min(Math.max(or, 0), maxOr);
    return overview[or * o.cols + oc];
  }

  function sampleOverviewBilinear(col: number, row: number): number {
    const s = M.overview.step;
    const clampedCol = Math.min(Math.max(col, validColMin), validColMax);
    const clampedRow = Math.min(Math.max(row, validRowMin), validRowMax);
    const fc = clampedCol / s;
    const fr = clampedRow / s;
    const c0 = Math.floor(fc);
    const r0 = Math.floor(fr);
    const ax = fc - c0;
    const ay = fr - r0;
    return (
      (overviewH(c0, r0) * (1 - ax) + overviewH(c0 + 1, r0) * ax) * (1 - ay) +
      (overviewH(c0, r0 + 1) * (1 - ax) + overviewH(c0 + 1, r0 + 1) * ax) * ay
    );
  }

  function sampleQ(col: number, row: number): number {
    const T = M.tileSize;
    col = Math.min(Math.max(Math.round(col), validColMin), validColMax);
    row = Math.min(Math.max(Math.round(row), validRowMin), validRowMax);

    const tx = Math.min(Math.floor(col / T), M.tilesX - 1);
    const ty = Math.min(Math.floor(row / T), M.tilesY - 1);
    const t = tiles[ty * M.tilesX + tx];

    if (t && t.full) {
      const lc = col - tx * T;
      const lr = row - ty * T;
      if (lc >= 0 && lc <= T && lr >= 0 && lr <= T) {
        const i = lr * (T + 1) + lc;
        if (i >= 0 && i < t.full.length) {
          return t.full[i];
        }
      }
    }

    return sampleOverviewBilinear(col, row);
  }

  function groundY(x: number, z: number): number {
    const c = Math.min(Math.max(xToCol(x), validColMin), validColMax);
    const r = Math.min(Math.max(zToRow(z), validRowMin), validRowMax);

    const c0 = Math.floor(c);
    const r0 = Math.floor(r);
    const ax = c - c0;
    const ay = r - r0;

    const q =
      (sampleQ(c0, r0) * (1 - ax) + sampleQ(c0 + 1, r0) * ax) * (1 - ay) +
      (sampleQ(c0, r0 + 1) * (1 - ax) + sampleQ(c0 + 1, r0 + 1) * ax) * ay;

    return q * M.heightScale;
  }

  function sampleSlopeDegrees(x: number, z: number): number {
    const step = 4;
    const hx1 = groundY(x + step, z);
    const hx0 = groundY(x - step, z);
    const hz1 = groundY(x, z + step);
    const hz0 = groundY(x, z - step);

    const dIdx = (hx1 - hx0) / (2 * step);
    const dIdz = (hz1 - hz0) / (2 * step);
    const grad = Math.hypot(dIdx, dIdz);

    return (Math.atan(grad) * 180) / Math.PI;
  }

  /**
   * Computes a continuous global vertex normal from the DEM heightfield so
   * adjacent tiles share identical normals across tile boundaries regardless
   * of tile boundaries or LOD transitions.
   */
  function computeAnalyticalNormal(
    col: number,
    row: number,
    out: Float32Array,
    offset: number
  ) {
    const delta = 4;
    const hR = sampleQ(col + delta, row) * M.heightScale;
    const hL = sampleQ(col - delta, row) * M.heightScale;
    const hD = sampleQ(col, row + delta) * M.heightScale;
    const hU = sampleQ(col, row - delta) * M.heightScale;

    const dx = (hR - hL) / (2 * delta * M.cellX);
    const dz = (hD - hU) / (2 * delta * M.cellZ);

    const nx = -dx;
    const ny = 1.0;
    const nz = -dz;
    const invLen = 1.0 / Math.hypot(nx, ny, nz);

    out[offset] = nx * invLen;
    out[offset + 1] = ny * invLen;
    out[offset + 2] = nz * invLen;
  }

  // ------------------------------------------------------------ 3D Beacons
  function createBeaconMesh(isBase: boolean, visited: boolean): THREE.Group {
    const g = new THREE.Group();
    const primaryColor = isBase ? 0x38bdf8 : visited ? 0x93b98a : 0xf47738;

    if (isBase) {
      const padGeo = new THREE.CylinderGeometry(7, 8.5, 0.8, 16);
      const padMat = new THREE.MeshLambertMaterial({ color: 0x45404a });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.y = 0.4;
      g.add(pad);

      const domeGeo = new THREE.SphereGeometry(
        4.2,
        16,
        12,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2
      );
      const domeMat = new THREE.MeshLambertMaterial({ color: 0xe5e0d8 });
      const dome = new THREE.Mesh(domeGeo, domeMat);
      dome.position.y = 0.8;
      g.add(dome);
    } else {
      const baseGeo = new THREE.CylinderGeometry(1.8, 2.2, 0.6, 12);
      const baseMat = new THREE.MeshLambertMaterial({ color: primaryColor });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = 0.3;
      g.add(baseMesh);
    }

    const beamGeo = new THREE.CylinderGeometry(
      0.45,
      0.45,
      isBase ? 180 : 120,
      8
    );
    const beamMat = new THREE.MeshBasicMaterial({
      color: primaryColor,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });

    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = isBase ? 90 : 60;
    g.add(beam);

    return g;
  }

  function rebuildBeacons(customTargets?: MissionTargetBeacon[]) {
    if (!M) return;

    while (beaconGroup.children.length > 0) {
      const child = beaconGroup.children[0];
      beaconGroup.remove(child);
    }

    const list: MissionTargetBeacon[] = [
      {
        id: "habitat-base",
        name: "Habitat / Rover Base Station",
        lat: baseLatLon.lat,
        lon: baseLatLon.lon,
        description: "Primary EVA deployment and return base.",
        isBase: true,
      },
    ];

    if (customTargets && customTargets.length > 0) {
      for (const t of customTargets) {
        list.push(t);
      }
    } else {
      for (const lm of LANDMARKS.slice(1)) {
        list.push({
          id: lm.id,
          name: lm.name,
          lat: lm.lat,
          lon: lm.lon,
          description: lm.description,
          visited: false,
        });
      }
    }

    missionBeacons = list.map((b) => {
      const inside = isLonLatInsideManifest(b.lon, b.lat);
      const coords = inside
        ? lonLatToColRow(b.lon, b.lat)
        : lonLatToColRow(baseLatLon.lon + 0.012, baseLatLon.lat + 0.008);

      const clampedCol = Math.min(Math.max(coords.col, validColMin), validColMax);
      const clampedRow = Math.min(Math.max(coords.row, validRowMin), validRowMax);
      const wx = colToX(clampedCol);
      const wz = rowToZ(clampedRow);
      const wy = groundY(wx, wz);

      const meshGroup = createBeaconMesh(Boolean(b.isBase), Boolean(b.visited));
      meshGroup.position.set(wx, wy, wz);
      beaconGroup.add(meshGroup);

      return {
        ...b,
        group: meshGroup,
      };
    });
  }

  function updateBeaconsHeightAndProximity() {
    if (!M || missionBeacons.length === 0) return;

    let closest: {
      beacon: MissionTargetBeacon;
      distMeters: number;
    } | null = null;

    for (const b of missionBeacons) {
      if (!b.group) continue;

      b.group.position.y = groundY(b.group.position.x, b.group.position.z);

      const dist = Math.hypot(
        player.pos.x - b.group.position.x,
        player.pos.z - b.group.position.z
      );

      if (!closest || dist < closest.distMeters) {
        closest = {
          beacon: b,
          distMeters: dist,
        };
      }

      if (!b.isBase && !b.visited && dist <= 45) {
        b.visited = true;
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            {
              type: "marswalk:visit-target",
              targetId: b.id,
              name: b.name,
            },
            "*"
          );
        }
      }
    }

    nearestBeacon = closest;

    if (closest && closest.distMeters <= 85) {
      proximityEl.classList.remove("hidden");
      if (closest.beacon.isBase) {
        proximityEl.innerHTML =
          `<strong>${closest.beacon.name}</strong> ` +
          `(${Math.round(closest.distMeters)} m) · ` +
          `Press <strong>[R]</strong> to Complete EVA Return`;
      } else {
        proximityEl.innerHTML =
          `Approaching <strong>${closest.beacon.name}</strong> ` +
          `(${Math.round(closest.distMeters)} m) · ` +
          `Press <strong>[E]</strong> to Open Fieldwork &amp; Sampling`;
      }
    } else {
      proximityEl.classList.add("hidden");
    }
  }

  // ------------------------------------------------------------ surface layers
  const LAYER_ORDER: SurfaceLayer[] = ["imagery", "hillshade", "elevation", "slope"];
  const LAYER_LABEL: Record<SurfaceLayer, string> = {
    imagery: "CTX Imagery",
    hillshade: "Hillshade",
    elevation: "Elevation",
    slope: "Slope",
  };
  let surfaceLayer: SurfaceLayer = "imagery";

  // THREE.Color(hex) converts to the linear working space, so lerping here is
  // correct for vertexColors.
  const ELEV_STOPS = [0x2b3a67, 0x3f8f8a, 0xc9b458, 0xb5683a, 0xf2ede6].map(
    (h) => new THREE.Color(h)
  );
  const SLOPE_STOPS = [0x3d7a4a, 0xd9a441, 0xc2362b, 0x6b1a2e].map(
    (h) => new THREE.Color(h)
  );
  const RAD2DEG = 180 / Math.PI;

  function lerpStops(
    stops: THREE.Color[],
    i: number,
    f: number,
    out: Float32Array,
    o: number
  ) {
    const a = stops[i];
    const b = stops[i + 1];
    out[o] = a.r + (b.r - a.r) * f;
    out[o + 1] = a.g + (b.g - a.g) * f;
    out[o + 2] = a.b + (b.b - a.b) * f;
  }

  function elevColor(t: number, out: Float32Array, o: number) {
    const x = Math.min(Math.max(t, 0), 1) * (ELEV_STOPS.length - 1);
    const i = Math.min(Math.floor(x), ELEV_STOPS.length - 2);
    lerpStops(ELEV_STOPS, i, x - i, out, o);
  }

  // Knots follow the environment's hazard thresholds so colours match the HUD
  // classes. Assumes 0 < slopeCautionDeg < slopeHazardDeg.
  const SLOPE_KNOTS = [
    0,
    envConfig.hazards.slopeCautionDeg,
    envConfig.hazards.slopeHazardDeg,
    envConfig.hazards.slopeHazardDeg * 1.5,
  ];

  function slopeColor(deg: number, out: Float32Array, o: number) {
    let i = 0;
    while (i < 2 && deg > SLOPE_KNOTS[i + 1]) i++;
    const f = Math.min(
      Math.max((deg - SLOPE_KNOTS[i]) / (SLOPE_KNOTS[i + 1] - SLOPE_KNOTS[i]), 0),
      1
    );
    lerpStops(SLOPE_STOPS, i, f, out, o);
  }

  const fallbackMat = new THREE.MeshLambertMaterial({
    color: CONFIG.marsTint,
  });
  const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true });

  let overviewMat: THREE.MeshLambertMaterial = fallbackMat;

  function pickMaterial(t: Tile): THREE.Material {
    switch (surfaceLayer) {
      case "hillshade":
        return fallbackMat; // flat tint, lit by the analytic normals
      case "elevation":
      case "slope":
        return vcMat;
      default:
        return t.tex
          ? new THREE.MeshLambertMaterial({ map: t.tex, color: CONFIG.marsTint })
          : overviewMat;
    }
  }

  const isSharedMat = (m: THREE.Material) =>
    m === overviewMat || m === fallbackMat || m === vcMat;

  function bindLayerColor(geo: THREE.BufferGeometry) {
    geo.setAttribute(
      "color",
      geo.getAttribute(surfaceLayer === "slope" ? "colorSlope" : "colorElev")
    );
  }

  // ------------------------------------------------------------ meshing
  function getTileStep(tx: number, ty: number): number {
    if (tx < 0 || ty < 0 || tx >= M.tilesX || ty >= M.tilesY) {
      return CONFIG.farStep;
    }
    const t = tiles[ty * M.tilesX + tx];
    if (!t || t.lod < 0) return CONFIG.farStep;
    return CONFIG.lodSteps[t.lod] ?? CONFIG.farStep;
  }

  function getNeighbourEdgeSignature(t: Tile, step: number): string {
    const nStep = Math.max(step, getTileStep(t.tx, t.ty - 1));
    const sStep = Math.max(step, getTileStep(t.tx, t.ty + 1));
    const wStep = Math.max(step, getTileStep(t.tx - 1, t.ty));
    const eStep = Math.max(step, getTileStep(t.tx + 1, t.ty));
    return `${nStep},${sStep},${wStep},${eStep}`;
  }

  /**
   * Builds a seamless tile mesh:
   * 1. Clamps vertex columns/rows to the valid DEM + ortho footprint so the
   *    clamped eastern/southern border streaks and black overview margins are
   *    never rendered.
   * 2. Stitches boundary vertices along any edge that borders a coarser-LOD
   *    neighbour so there are zero T-junction cracks between LOD transitions.
   * 3. Computes analytical global DEM vertex normals so lighting is 100%
   *    continuous across tile boundaries.
   * 4. Places vertical skirts only on the outer perimeter of the DEM domain,
   *    eliminating interior skirt Z-fighting lines at shallow viewing angles.
   * 5. Bakes elevation and slope colour attributes so layer switching only
   *    swaps a material / attribute binding and never rebuilds geometry.
   */
  function buildTileGeometry(t: Tile, step: number): THREE.BufferGeometry {
    const T = M.tileSize;
    const n = T / step + 1;

    const c0 = t.tx * T;
    const r0 = t.ty * T;

    const isOuterWest = t.tx === 0;
    const isOuterEast = t.tx === M.tilesX - 1;
    const isOuterNorth = t.ty === 0;
    const isOuterSouth = t.ty === M.tilesY - 1;

    const outerEdges: number[][] = [];
    if (isOuterNorth) {
      outerEdges.push(Array.from({ length: n }, (_, j) => j));
    }
    if (isOuterSouth) {
      outerEdges.push(Array.from({ length: n }, (_, j) => (n - 1) * n + (n - 1 - j)));
    }
    if (isOuterWest) {
      outerEdges.push(Array.from({ length: n }, (_, i) => (n - 1 - i) * n));
    }
    if (isOuterEast) {
      outerEdges.push(Array.from({ length: n }, (_, i) => i * n + n - 1));
    }

    const vCount = n * n + outerEdges.length * 2 * n;
    const pos = new Float32Array(vCount * 3);
    const norm = new Float32Array(vCount * 3);
    const uv = new Float32Array(vCount * 2);
    const colE = new Float32Array(vCount * 3);
    const colS = new Float32Array(vCount * 3);
    const idx: number[] = [];

    const copyColors = (dst: number, src: number) => {
      for (let c = 0; c < 3; c++) {
        colE[dst * 3 + c] = colE[src * 3 + c];
        colS[dst * 3 + c] = colS[src * 3 + c];
      }
    };

    const useTile = !!t.tex;
    const halfTexel = useTile ? 0.5 / Math.max(256, M.textureSize) : 0;
    const hs = M.heightScale;
    const hRange = Math.max(1e-6, M.heightMax - M.heightMin);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const k = i * n + j;

        const rawCol = c0 + j * step;
        const rawRow = r0 + i * step;

        const col = Math.min(Math.max(rawCol, validColMin), validColMax);
        const row = Math.min(Math.max(rawRow, validRowMin), validRowMax);

        pos[k * 3] = colToX(col);
        pos[k * 3 + 1] = sampleQ(col, row) * hs;
        pos[k * 3 + 2] = rowToZ(row);

        computeAnalyticalNormal(col, row, norm, k * 3);

        elevColor(pos[k * 3 + 1] / hRange, colE, k * 3);
        slopeColor(Math.acos(Math.min(1, norm[k * 3 + 1])) * RAD2DEG, colS, k * 3);

        if (useTile) {
          const fracU = (col - c0) / T;
          const fracV = (row - r0) / T;
          uv[k * 2] = halfTexel + fracU * (1 - 2 * halfTexel);
          uv[k * 2 + 1] = 1 - (halfTexel + fracV * (1 - 2 * halfTexel));
        } else {
          uv[k * 2] = col / (M.tilesX * T);
          uv[k * 2 + 1] = 1 - row / (M.tilesY * T);
        }
      }
    }

    // Stitch boundary vertex heights to match coarser-LOD neighbours so adjacent
    // tiles meet with zero cracks without needing interior vertical skirts.
    const stitchRowEdge = (rowIdx: number, neighbourStep: number) => {
      const ratio = Math.round(neighbourStep / step);
      if (ratio <= 1) return;
      for (let j = 0; j < n; j++) {
        const rem = j % ratio;
        if (rem === 0) continue;
        const j0 = j - rem;
        const j1 = Math.min(n - 1, j0 + ratio);
        const alpha = rem / Math.max(1, j1 - j0);
        const k = rowIdx * n + j;
        const k0 = rowIdx * n + j0;
        const k1 = rowIdx * n + j1;
        pos[k * 3 + 1] = pos[k0 * 3 + 1] * (1 - alpha) + pos[k1 * 3 + 1] * alpha;
      }
    };

    const stitchColEdge = (colIdx: number, neighbourStep: number) => {
      const ratio = Math.round(neighbourStep / step);
      if (ratio <= 1) return;
      for (let i = 0; i < n; i++) {
        const rem = i % ratio;
        if (rem === 0) continue;
        const i0 = i - rem;
        const i1 = Math.min(n - 1, i0 + ratio);
        const alpha = rem / Math.max(1, i1 - i0);
        const k = i * n + colIdx;
        const k0 = i0 * n + colIdx;
        const k1 = i1 * n + colIdx;
        pos[k * 3 + 1] = pos[k0 * 3 + 1] * (1 - alpha) + pos[k1 * 3 + 1] * alpha;
      }
    };

    if (!isOuterNorth) {
      stitchRowEdge(0, Math.max(step, getTileStep(t.tx, t.ty - 1)));
    }
    if (!isOuterSouth) {
      stitchRowEdge(n - 1, Math.max(step, getTileStep(t.tx, t.ty + 1)));
    }
    if (!isOuterWest) {
      stitchColEdge(0, Math.max(step, getTileStep(t.tx - 1, t.ty)));
    }
    if (!isOuterEast) {
      stitchColEdge(n - 1, Math.max(step, getTileStep(t.tx + 1, t.ty)));
    }

    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - 1; j++) {
        const a = i * n + j;
        const b = a + 1;
        const c = a + n;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }

    // Outer-perimeter skirts with dedicated vertices so surface normals stay pure.
    let sk = n * n;
    for (const e of outerEdges) {
      const topBase = sk;
      for (const g of e) {
        pos[sk * 3] = pos[g * 3];
        pos[sk * 3 + 1] = pos[g * 3 + 1] - 0.25;
        pos[sk * 3 + 2] = pos[g * 3 + 2];
        norm[sk * 3] = norm[g * 3];
        norm[sk * 3 + 1] = norm[g * 3 + 1];
        norm[sk * 3 + 2] = norm[g * 3 + 2];
        uv[sk * 2] = uv[g * 2];
        uv[sk * 2 + 1] = uv[g * 2 + 1];
        copyColors(sk, g);
        sk++;
      }
      const botBase = sk;
      for (const g of e) {
        pos[sk * 3] = pos[g * 3];
        pos[sk * 3 + 1] = pos[g * 3 + 1] - CONFIG.skirtDepth;
        pos[sk * 3 + 2] = pos[g * 3 + 2];
        norm[sk * 3] = norm[g * 3];
        norm[sk * 3 + 1] = norm[g * 3 + 1];
        norm[sk * 3 + 2] = norm[g * 3 + 2];
        uv[sk * 2] = uv[g * 2];
        uv[sk * 2 + 1] = uv[g * 2 + 1];
        copyColors(sk, g);
        sk++;
      }

      for (let m = 0; m < n - 1; m++) {
        const a = topBase + m;
        const b = topBase + m + 1;
        const c = botBase + m;
        const d = botBase + m + 1;
        idx.push(a, b, c, b, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(norm, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setAttribute("colorElev", new THREE.BufferAttribute(colE, 3));
    geo.setAttribute("colorSlope", new THREE.BufferAttribute(colS, 3));
    bindLayerColor(geo);
    geo.setIndex(idx);
    geo.computeBoundingSphere();

    return geo;
  }

  function setTileMesh(t: Tile, lod: number) {
    const step = lod < 0 ? CONFIG.farStep : CONFIG.lodSteps[lod];
    const useTile = !!t.tex;
    const texKey = useTile ? "t" : "o";
    const edgeKey = getNeighbourEdgeSignature(t, step);

    if (
      t.mesh &&
      t.lod === lod &&
      t.texKey === texKey &&
      t.edgeKey === edgeKey
    ) {
      return;
    }

    t.lod = lod;
    t.texKey = texKey;
    t.edgeKey = edgeKey;

    const geo = buildTileGeometry(t, step);
    const mat = pickMaterial(t);

    if (t.mesh) {
      t.mesh.geometry.dispose();
      const old = t.mesh.material as THREE.Material;
      if (!isSharedMat(old) && old !== mat) {
        old.dispose();
      }
      t.mesh.geometry = geo;
      t.mesh.material = mat;
    } else {
      t.mesh = new THREE.Mesh(geo, mat);
      t.mesh.matrixAutoUpdate = false;
      scene.add(t.mesh);
    }
  }

  function setSurfaceLayer(layer: SurfaceLayer) {
    surfaceLayer = layer;
    for (const t of tiles) {
      if (!t.mesh) continue;
      const old = t.mesh.material as THREE.Material;
      const mat = pickMaterial(t);
      t.mesh.material = mat;
      if (!isSharedMat(old) && old !== mat) {
        old.dispose();
      }
      bindLayerColor(t.mesh.geometry);
    }
    if (layerBtn) {
      layerBtn.textContent = `Layer: ${LAYER_LABEL[layer]} [L]`;
    }
    emitTelemetrySync();
  }

  function cycleSurfaceLayer() {
    setSurfaceLayer(
      LAYER_ORDER[(LAYER_ORDER.indexOf(surfaceLayer) + 1) % LAYER_ORDER.length]
    );
  }

  // ------------------------------------------------------------ loading
  async function fetchBuffer(url: string) {
    const r = await fetch(url);
    if (!r.ok) {
      throw new Error(`${r.status} ${url}`);
    }
    return r.arrayBuffer();
  }

  const texLoader = new THREE.TextureLoader();

  function loadTexture(url: string): Promise<THREE.Texture> {
    return new Promise((res, rej) =>
      texLoader.load(
        url,
        (tx) => {
          tx.colorSpace = THREE.SRGBColorSpace;
          tx.anisotropy = renderer.capabilities.getMaxAnisotropy();
          tx.wrapS = tx.wrapT = THREE.ClampToEdgeWrapping;
          tx.minFilter = THREE.LinearMipmapLinearFilter;
          tx.magFilter = THREE.LinearFilter;
          res(tx);
        },
        undefined,
        rej
      )
    );
  }

  function tileDistance(t: Tile, x: number, z: number) {
    const T = M.tileSize;
    const x0 = colToX(t.tx * T);
    const x1 = colToX((t.tx + 1) * T);
    const z0 = rowToZ(t.ty * T);
    const z1 = rowToZ((t.ty + 1) * T);
    const dx = Math.max(x0 - x, 0, x - x1);
    const dz = Math.max(z0 - z, 0, z - z1);
    return Math.hypot(dx, dz);
  }

  function requestFull(t: Tile) {
    if (t.full || t.loading || activeLoads >= CONFIG.maxConcurrentLoads) {
      return;
    }
    t.loading = true;
    activeLoads++;

    fetchBuffer(`${CONFIG.dataUrl}height/${t.tx}_${t.ty}.u16`)
      .then((buf) => {
        t.full = new Uint16Array(buf);
        rebuildNeighbourhood(t);
      })
      .catch((e) => console.warn("height tile failed", e))
      .finally(() => {
        t.loading = false;
        activeLoads--;
      });
  }

  function requestTex(t: Tile) {
    if (
      t.tex ||
      t.texLoading ||
      M.textures[t.ty * M.tilesX + t.tx] !== "1"
    ) {
      return;
    }
    if (activeLoads >= CONFIG.maxConcurrentLoads) {
      return;
    }
    t.texLoading = true;
    activeLoads++;

    loadTexture(`${CONFIG.dataUrl}tex/${t.tx}_${t.ty}.jpg`)
      .then((tx) => {
        t.tex = tx;
        setTileMesh(t, t.lod);
      })
      .catch((e) => console.warn("texture failed", e))
      .finally(() => {
        t.texLoading = false;
        activeLoads--;
      });
  }

  function rebuildNeighbourhood(t: Tile) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = t.tx + dx;
        const ny = t.ty + dy;
        if (nx < 0 || ny < 0 || nx >= M.tilesX || ny >= M.tilesY) {
          continue;
        }
        const n = tiles[ny * M.tilesX + nx];
        if (n.mesh) {
          setTileMesh(n, n.lod);
        }
      }
    }
  }

  function unloadTile(t: Tile) {
    t.full = null;
    if (t.tex) {
      t.tex.dispose();
      t.tex = null;
    }
    setTileMesh(t, -1);
    rebuildNeighbourhood(t);
  }

  // ------------------------------------------------------------ streaming
  let lastStreamTile = "";
  let streamTimer = 0;

  function updateStreaming(dt: number) {
    streamTimer -= dt;

    const T = M.tileSize;
    const ptx = Math.floor(xToCol(player.pos.x) / T);
    const pty = Math.floor(zToRow(player.pos.z) / T);
    const key = `${ptx},${pty}`;

    if (streamTimer > 0 && key === lastStreamTile) {
      return;
    }

    streamTimer = 0.5;
    lastStreamTile = key;

    const order = [...tiles].sort(
      (a, b) =>
        tileDistance(a, player.pos.x, player.pos.z) -
        tileDistance(b, player.pos.x, player.pos.z)
    );

    let full = 0;
    const changedTiles: Tile[] = [];

    for (const t of order) {
      const d = tileDistance(t, player.pos.x, player.pos.z);

      const near =
        Math.abs(t.tx - ptx) <= CONFIG.nearTileRadius &&
        Math.abs(t.ty - pty) <= CONFIG.nearTileRadius;

      const keep =
        Math.abs(t.tx - ptx) <= CONFIG.nearTileRadius + 1 &&
        Math.abs(t.ty - pty) <= CONFIG.nearTileRadius + 1;

      if (near) {
        requestFull(t);
        requestTex(t);
      } else if (!keep && (t.full || t.tex)) {
        unloadTile(t);
      }

      if (t.full) {
        full++;
      }

      let lod = -1;
      if (t.full) {
        lod = CONFIG.lodSteps.length - 1;
        for (let i = 0; i < CONFIG.lodDistances.length; i++) {
          if (d < CONFIG.lodDistances[i]) {
            lod = i;
            break;
          }
        }
      }

      if (lod !== t.lod) {
        t.lod = lod;
        changedTiles.push(t);
      }
    }

    if (changedTiles.length > 0) {
      const rebuildSet = new Set<Tile>();
      for (const ct of changedTiles) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = ct.tx + dx;
            const ny = ct.ty + dy;
            if (nx >= 0 && ny >= 0 && nx < M.tilesX && ny < M.tilesY) {
              rebuildSet.add(tiles[ny * M.tilesX + nx]);
            }
          }
        }
      }
      for (const rt of rebuildSet) {
        setTileMesh(rt, rt.lod);
      }
    }

    hudTiles.textContent = `TILES ${full}/${tiles.length}`;
    updateBeaconsHeightAndProximity();
  }

  // ------------------------------------------------------------ player & physics
  let pendingSnap = 0;

  function teleport(col: number, row: number) {
    col = Math.min(Math.max(col, validColMin + 4), validColMax - 4);
    row = Math.min(Math.max(row, validRowMin + 4), validRowMax - 4);

    player.pos.set(colToX(col), 0, rowToZ(row));
    player.pos.y = groundY(player.pos.x, player.pos.z) + CONFIG.eyeHeight;

    player.vel.set(0, 0, 0);
    player.horizVel.set(0, 0);

    camera.position.copy(player.pos);

    lastStreamTile = "";
    streamTimer = 0;
    pendingSnap = 3;
  }

  function applyExpeditionSpawn(
    lat: number | null,
    lon: number | null,
    name?: string | null
  ) {
    if (!M) return;

    const hasValidCoords =
      lat !== null &&
      lon !== null &&
      Number.isFinite(lat) &&
      Number.isFinite(lon);

    if (hasValidCoords && isLonLatInsideManifest(lon!, lat!)) {
      baseLatLon = { lat: lat!, lon: lon! };
      const target = lonLatToColRow(lon!, lat!);
      teleport(target.col, target.row);
      baseWorldPos.copy(player.pos);

      const label = name?.trim() || "Selected Expedition Site";
      statusEl.textContent = `BASE: ${label} · ${lat!.toFixed(4)}°N ${lon!.toFixed(4)}°E`;
      rebuildBeacons();
      return;
    }

    baseLatLon = {
      lat: LANDMARKS[0].lat,
      lon: LANDMARKS[0].lon,
    };

    const fallback = lonLatToColRow(LANDMARKS[0].lon, LANDMARKS[0].lat);
    teleport(fallback.col, fallback.row);
    baseWorldPos.copy(player.pos);

    if (name?.trim()) {
      statusEl.textContent = `${name.trim()} (${envConfig.displayName} Reference DEM · ${LANDMARKS[0].name})`;
    } else {
      statusEl.textContent = `BASE: ${envConfig.displayName} · ${LANDMARKS[0].name}`;
    }

    rebuildBeacons();
  }

  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();

  let telemetryTimer = 0;

  function updatePlayer(dt: number) {
    const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");

    camera.getWorldDirection(fwd);
    if (!player.fly) {
      fwd.y = 0;
    }
    fwd.normalize();
    right.crossVectors(fwd, camera.up).normalize();

    move.set(0, 0, 0);
    if (keys.has("KeyW") || keys.has("ArrowUp")) move.add(fwd);
    if (keys.has("KeyS") || keys.has("ArrowDown")) move.sub(fwd);
    if (keys.has("KeyD") || keys.has("ArrowRight")) move.add(right);
    if (keys.has("KeyA") || keys.has("ArrowLeft")) move.sub(right);
    if (move.lengthSq() > 0) move.normalize();

    const ground = groundY(player.pos.x, player.pos.z);
    const slopeDeg = sampleSlopeDegrees(player.pos.x, player.pos.z);
    player.currentSlopeDeg = slopeDeg;

    const prevX = player.pos.x;
    const prevZ = player.pos.z;

    if (player.fly) {
      const sp = sprint ? CONFIG.flySprintSpeed : CONFIG.flySpeed;
      if (keys.has("Space")) move.y += 1;
      if (keys.has("KeyC") || keys.has("ControlLeft")) move.y -= 1;

      player.pos.addScaledVector(move, sp * dt);
      player.pos.y = Math.max(player.pos.y, ground + CONFIG.eyeHeight);
      player.vel.set(0, 0, 0);
      player.horizVel.set(0, 0);
    } else {
      const slopeFactor = Math.max(
        0.42,
        1 - Math.max(0, slopeDeg - 8) * 0.025
      );
      const targetSpeed =
        (sprint ? CONFIG.sprintSpeed : CONFIG.walkSpeed) * slopeFactor;
      const targetVx = move.x * targetSpeed;
      const targetVz = move.z * targetSpeed;
      const rate =
        move.lengthSq() > 0 ? CONFIG.suitAcceleration : CONFIG.suitDamping;

      player.horizVel.x = THREE.MathUtils.damp(
        player.horizVel.x,
        targetVx,
        rate,
        dt
      );
      player.horizVel.y = THREE.MathUtils.damp(
        player.horizVel.y,
        targetVz,
        rate,
        dt
      );

      player.vel.x = player.horizVel.x;
      player.vel.z = player.horizVel.y;
      player.vel.y -= CONFIG.gravity * dt;

      if (player.onGround && keys.has("Space")) {
        player.vel.y = CONFIG.jumpSpeed;
        player.onGround = false;
      }

      player.pos.addScaledVector(player.vel, dt);

      const g = groundY(player.pos.x, player.pos.z) + CONFIG.eyeHeight;
      if (player.pos.y <= g || pendingSnap > 0) {
        player.pos.y = g;
        player.vel.y = 0;
        player.onGround = true;
      } else if (player.pos.y - g > 0.05) {
        if (
          player.onGround &&
          player.vel.y <= 0 &&
          player.pos.y - g < targetSpeed * dt * 1.5
        ) {
          player.pos.y = g;
        } else {
          player.onGround = false;
        }
      }
    }

    const minWorldX = colToX(validColMin + 4);
    const maxWorldX = colToX(validColMax - 4);
    const minWorldZ = rowToZ(validRowMin + 4);
    const maxWorldZ = rowToZ(validRowMax - 4);

    player.pos.x = Math.min(Math.max(player.pos.x, minWorldX), maxWorldX);
    player.pos.z = Math.min(Math.max(player.pos.z, minWorldZ), maxWorldZ);

    camera.position.copy(player.pos);

    const stepDist = Math.hypot(player.pos.x - prevX, player.pos.z - prevZ);
    if (stepDist > 0.001 && stepDist < 50) {
      player.totalTraverseMeters += stepDist;
    }

    player.elapsedSeconds += dt;

    if (pendingSnap > 0 && activeLoads === 0) {
      pendingSnap--;
    }

    const { lon, lat } = colRowToLonLat(
      xToCol(player.pos.x),
      zToRow(player.pos.z)
    );
    const elev = CONFIG.groundOffset + (player.pos.y - CONFIG.eyeHeight);
    const distFromBase = Math.hypot(
      player.pos.x - baseWorldPos.x,
      player.pos.z - baseWorldPos.z
    );

    hudPos.textContent = `${lat.toFixed(4)}°N ${lon.toFixed(4)}°E · ELEV ${elev.toFixed(0)} m`;
    hudSlope.textContent = `SLOPE ${slopeDeg.toFixed(1)}°`;
    hudBase.textContent = `BASE ${
      distFromBase >= 1000
        ? `${(distFromBase / 1000).toFixed(2)} km`
        : `${Math.round(distFromBase)} m`
    }`;

    telemetryTimer += dt;
    if (telemetryTimer >= 0.14) {
      telemetryTimer = 0;
      updateBeaconsHeightAndProximity();
      emitTelemetrySync();
    }
  }

  function getHeadingDegrees(): number {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const rad = Math.atan2(dir.x, -dir.z);
    return Math.round(((rad * 180) / Math.PI + 360) % 360);
  }

  function emitTelemetrySync() {
    if (!M || !window.parent || window.parent === window) return;

    const { lon, lat } = colRowToLonLat(
      xToCol(player.pos.x),
      zToRow(player.pos.z)
    );
    const elev = CONFIG.groundOffset + (player.pos.y - CONFIG.eyeHeight);
    const slopeDeg = sampleSlopeDegrees(player.pos.x, player.pos.z);
    const distFromBase = Math.hypot(
      player.pos.x - baseWorldPos.x,
      player.pos.z - baseWorldPos.z
    );
    const headingDegrees = getHeadingDegrees();

    window.parent.postMessage(
      {
        type: "marswalk:telemetry-sync",
        environmentId: envConfig.id,
        latitude: Number(lat.toFixed(5)),
        longitude: Number(lon.toFixed(5)),
        elevationMeters: Math.round(elev),
        elevation: Math.round(elev),
        slopeDegrees: Number(slopeDeg.toFixed(1)),
        slopeDeg: Number(slopeDeg.toFixed(1)),
        headingDegrees,
        distanceFromBaseMeters: Math.round(distFromBase),
        totalTraverseMeters: Math.round(player.totalTraverseMeters),
        elapsedTimeSeconds: Math.round(player.elapsedSeconds),
        flyMode: player.fly,
        surfaceLayer,
        isPointerLocked: controls.isLocked,
        mapOpen: !mapPanel.classList.contains("hidden"),
        nearestTarget: nearestBeacon
          ? {
              id: nearestBeacon.beacon.id,
              name: nearestBeacon.beacon.name,
              distanceMeters: Math.round(nearestBeacon.distMeters),
              isBase: Boolean(nearestBeacon.beacon.isBase),
            }
          : null,
      },
      "*"
    );
  }

  // ------------------------------------------------------------ 2D Tactical Map (Edge-to-Edge, Isotropic Scale, Zoomable & Pannable)
  let mapSel: { col: number; row: number } | null = null;
  let mapZoom = 1.0;
  let mapPanX = 0;
  let mapPanY = 0;
  let mapDragging = false;
  let mapDragStartX = 0;
  let mapDragStartY = 0;
  let mapDragOriginPanX = 0;
  let mapDragOriginPanY = 0;
  let mapDragMovedDist = 0;

  /**
   * Computes a visible DEM window (`colMin..colMin+visCols`, `rowMin..rowMin+visRows`)
   * that fills the canvas 100% edge-to-edge while preserving 1:1 isotropic ground
   * meters per pixel so craters and routes are never stretched or squashed, and
   * staying strictly inside the valid (non-black) ortho/DEM footprint.
   */
  function getMapViewBounds() {
    const totalCols = M.tilesX * M.tileSize;
    const totalRows = M.tilesY * M.tileSize;

    const spanCols = Math.max(100, validColMax - validColMin);
    const spanRows = Math.max(100, validRowMax - validRowMin);

    const rect = mapCanvas.getBoundingClientRect();
    const canvasAspect =
      rect.width > 10 && rect.height > 10 ? rect.width / rect.height : 1.5;

    const demMetersW = spanCols * M.cellX;
    const demMetersH = spanRows * M.cellZ;
    const demAspect = demMetersW / demMetersH;

    let visCols: number;
    let visRows: number;

    if (canvasAspect >= demAspect) {
      visCols = spanCols / mapZoom;
      visRows = (visCols * M.cellX) / (canvasAspect * M.cellZ);
      if (visRows > spanRows) {
        visRows = spanRows;
        visCols = (visRows * canvasAspect * M.cellZ) / M.cellX;
      }
    } else {
      visRows = spanRows / mapZoom;
      visCols = (visRows * canvasAspect * M.cellZ) / M.cellX;
      if (visCols > spanCols) {
        visCols = spanCols;
        visRows = (visCols * M.cellX) / (canvasAspect * M.cellZ);
      }
    }

    if (mapPanX === 0 && mapPanY === 0) {
      mapPanX = xToCol(player.pos.x);
      mapPanY = zToRow(player.pos.z);
    }

    const halfVisCols = visCols / 2;
    const halfVisRows = visRows / 2;

    mapPanX = Math.min(
      Math.max(mapPanX, validColMin + halfVisCols),
      validColMax - halfVisCols
    );
    mapPanY = Math.min(
      Math.max(mapPanY, validRowMin + halfVisRows),
      validRowMax - halfVisRows
    );

    return {
      colMin: mapPanX - halfVisCols,
      rowMin: mapPanY - halfVisRows,
      visCols,
      visRows,
      totalCols,
      totalRows,
    };
  }

  function setMapZoom(nextZoom: number) {
    mapZoom = Math.min(6.0, Math.max(1.0, Number(nextZoom.toFixed(2))));
    if (mapZoomLabel) {
      mapZoomLabel.textContent = `${mapZoom.toFixed(1)}×`;
    }
    drawMap();
  }

  function centerMapOnPlayer() {
    if (!M) return;
    mapPanX = xToCol(player.pos.x);
    mapPanY = zToRow(player.pos.z);
    drawMap();
  }

  function drawMap() {
    if (!M || mapPanel.classList.contains("hidden")) return;
    const ctx = mapCanvas.getContext("2d")!;

    const rect = mapCanvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.max(1, Math.round(rect.width * dpr));
    const targetH = Math.max(1, Math.round(rect.height * dpr));

    if (mapCanvas.width !== targetW || mapCanvas.height !== targetH) {
      mapCanvas.width = targetW;
      mapCanvas.height = targetH;
    }

    const W = mapCanvas.width;
    const H = mapCanvas.height;

    ctx.fillStyle = "#16110e";
    ctx.fillRect(0, 0, W, H);

    const { colMin, rowMin, visCols, visRows, totalCols, totalRows } =
      getMapViewBounds();

    const colToPx = (col: number) => ((col - colMin) / visCols) * W;
    const rowToPy = (row: number) => ((row - rowMin) / visRows) * H;

    if (mapImg && mapImg.complete && mapImg.naturalWidth > 0) {
      const sx = (colMin / totalCols) * mapImg.naturalWidth;
      const sy = (rowMin / totalRows) * mapImg.naturalHeight;
      const sw = (visCols / totalCols) * mapImg.naturalWidth;
      const sh = (visRows / totalRows) * mapImg.naturalHeight;
      ctx.drawImage(mapImg, sx, sy, sw, sh, 0, 0, W, H);
    }

    // Subtle coordinate graticule grid with lat/lon labels
    ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
    ctx.lineWidth = 1 * dpr;
    ctx.font = `500 ${10 * dpr}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillStyle = "rgba(243, 239, 234, 0.65)";

    for (let i = 1; i <= 4; i++) {
      const gx = (W * i) / 5;
      const gy = (H * i) / 5;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, H);
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();

      const gCol = colMin + (visCols * i) / 5;
      const gRow = rowMin + (visRows * i) / 5;
      const gCoords = colRowToLonLat(gCol, gRow);
      ctx.fillText(`${gCoords.lon.toFixed(2)}°E`, gx + 4 * dpr, 13 * dpr);
      ctx.fillText(`${gCoords.lat.toFixed(2)}°N`, 6 * dpr, gy - 4 * dpr);
    }

    const dot = (col: number, row: number, color: string, r: number) => {
      const px = colToPx(col);
      const py = rowToPy(row);
      ctx.beginPath();
      ctx.arc(px, py, r * dpr, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1.6 * dpr;
      ctx.strokeStyle = "#0e0b0a";
      ctx.stroke();
    };

    // Planned route polyline connecting base & beacons
    const validBeacons = missionBeacons.filter((b) =>
      isLonLatInsideManifest(b.lon, b.lat)
    );
    if (validBeacons.length >= 2) {
      ctx.save();
      ctx.beginPath();
      validBeacons.forEach((b, idx) => {
        const p = lonLatToColRow(b.lon, b.lat);
        const px = colToPx(p.col);
        const py = rowToPy(p.row);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = "rgba(56, 189, 248, 0.72)";
      ctx.lineWidth = 2.2 * dpr;
      ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.stroke();
      ctx.restore();
    }

    // Reference landmarks
    for (const lm of LANDMARKS) {
      const already = validBeacons.some(
        (b) => Math.hypot(b.lat - lm.lat, b.lon - lm.lon) < 0.003
      );
      if (already || !isLonLatInsideManifest(lm.lon, lm.lat)) continue;
      const p = lonLatToColRow(lm.lon, lm.lat);
      dot(p.col, p.row, "#94a3b8", 4);
    }

    ctx.font = `600 ${11 * dpr}px Inter, system-ui, sans-serif`;

    for (const b of validBeacons) {
      const p = lonLatToColRow(b.lon, b.lat);
      const px = colToPx(p.col);
      const py = rowToPy(p.row);

      dot(
        p.col,
        p.row,
        b.isBase ? "#38bdf8" : b.visited ? "#10b981" : "#f47738",
        b.isBase ? 6.5 : 5.5
      );

      const label = b.name;
      const textW = ctx.measureText(label).width;
      const labelX =
        px + 12 * dpr + textW + 10 * dpr > W
          ? px - textW - 16 * dpr
          : px + 8 * dpr;
      ctx.fillStyle = "rgba(16, 14, 18, 0.85)";
      ctx.fillRect(labelX, py - 9 * dpr, textW + 8 * dpr, 16 * dpr);
      ctx.fillStyle = b.isBase ? "#bae6fd" : b.visited ? "#a7f3d0" : "#f3efea";
      ctx.fillText(label, labelX + 4 * dpr, py + 3 * dpr);
    }

    // Astronaut position & heading cone/vector
    const pc = xToCol(player.pos.x);
    const pr = zToRow(player.pos.z);
    const ppx = colToPx(pc);
    const ppy = rowToPy(pr);

    camera.getWorldDirection(fwd);
    const dirLen = 28 * dpr;
    const dirAngle = Math.atan2(fwd.z, fwd.x);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ppx, ppy);
    ctx.arc(ppx, ppy, dirLen * 1.35, dirAngle - 0.42, dirAngle + 0.42);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 211, 107, 0.24)";
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(ppx, ppy);
    ctx.lineTo(
      ppx + Math.cos(dirAngle) * dirLen,
      ppy + Math.sin(dirAngle) * dirLen
    );
    ctx.strokeStyle = "#ffd36b";
    ctx.lineWidth = 2.2 * dpr;
    ctx.stroke();

    dot(pc, pr, "#ffd36b", 5.5);

    if (mapSel) {
      const spx = colToPx(mapSel.col);
      const spy = rowToPy(mapSel.row);
      ctx.beginPath();
      ctx.arc(spx, spy, 9 * dpr, 0, Math.PI * 2);
      ctx.strokeStyle = "#ff4d3a";
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();
      dot(mapSel.col, mapSel.row, "#ff4d3a", 4.5);
    }
  }

  function selectOnMap(e: MouseEvent) {
    if (mapDragMovedDist > 6) {
      return;
    }
    const rect = mapCanvas.getBoundingClientRect();
    const { colMin, rowMin, visCols, visRows } = getMapViewBounds();

    const col = colMin + ((e.clientX - rect.left) / rect.width) * visCols;
    const row = rowMin + ((e.clientY - rect.top) / rect.height) * visRows;

    if (col < validColMin || row < validRowMin || col > validColMax || row > validRowMax) {
      return;
    }

    mapSel = { col, row };

    const { lon, lat } = colRowToLonLat(col, row);
    const elev =
      CONFIG.groundOffset +
      sampleQ(Math.round(col), Math.round(row)) * M.heightScale;

    const selWorldX = colToX(col);
    const selWorldZ = rowToZ(row);
    const distFromPlayer = Math.hypot(
      selWorldX - player.pos.x,
      selWorldZ - player.pos.z
    );

    let snappedBeacon: MissionTargetBeacon | null = null;
    for (const b of missionBeacons) {
      if (!isLonLatInsideManifest(b.lon, b.lat)) continue;
      const bp = lonLatToColRow(b.lon, b.lat);
      if (Math.hypot(bp.col - col, bp.row - row) < 28 / mapZoom) {
        snappedBeacon = b;
        mapSel = { col: bp.col, row: bp.row };
        break;
      }
    }

    mapInfo.textContent = snappedBeacon
      ? `Selected: ${snappedBeacon.name} (${snappedBeacon.lat.toFixed(4)}°N, ${snappedBeacon.lon.toFixed(4)}°E · Elev ≈ ${elev.toFixed(0)} m · ${Math.round(distFromPlayer)} m away)`
      : `Selected: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E · Elevation ≈ ${elev.toFixed(0)} m · ${Math.round(distFromPlayer)} m from astronaut`;

    mapGo.disabled = false;
    drawMap();
  }

  function openMap() {
    if (!M || !tiles.length) {
      return;
    }

    controls.unlock();
    overlay.classList.add("hidden");
    mapPanel.classList.remove("hidden");

    if (mapPanX === 0 && mapPanY === 0) {
      mapPanX = xToCol(player.pos.x);
      mapPanY = zToRow(player.pos.z);
    }

    // Clear any legacy inline size overrides so CSS width:100% / height:100%
    // fills `.map-canvas-wrap` edge-to-edge.
    mapCanvas.style.removeProperty("width");
    mapCanvas.style.removeProperty("height");

    requestAnimationFrame(() => {
      drawMap();
    });
    drawMap();
    emitTelemetrySync();
  }

  function closeMap() {
    mapPanel.classList.add("hidden");
    emitTelemetrySync();
  }

  // ------------------------------------------------------------ input & messaging
  document.addEventListener("keydown", (e) => {
    if (externalModalOpen && e.code !== "Escape" && e.code !== "KeyE") {
      return;
    }

    keys.add(e.code);

    if (e.code === "KeyM" && M) {
      if (mapPanel.classList.contains("hidden")) {
        openMap();
      } else {
        closeMap();
        if (!externalModalOpen) {
          controls.lock();
        }
      }
    }

    if (e.code === "KeyF" && M) {
      player.fly = !player.fly;
      hudMode.textContent = player.fly ? "RECON FLIGHT" : "MARS 0.38G WALK";
      emitTelemetrySync();
    }

    if (e.code === "KeyL" && M && !e.repeat) {
      cycleSurfaceLayer();
    }

    if (e.code === "KeyE" && M) {
      externalModalOpen = true;
      keys.clear();
      overlay.classList.add("hidden");
      closeMap();
      controls.unlock();

      if (window.parent && window.parent !== window) {
        const { lon, lat } = colRowToLonLat(
          xToCol(player.pos.x),
          zToRow(player.pos.z)
        );
        window.parent.postMessage(
          {
            type: "marswalk:open-fieldwork",
            latitude: Number(lat.toFixed(5)),
            longitude: Number(lon.toFixed(5)),
            targetId:
              nearestBeacon && !nearestBeacon.beacon.isBase
                ? nearestBeacon.beacon.id
                : undefined,
            targetName:
              nearestBeacon && !nearestBeacon.beacon.isBase
                ? nearestBeacon.beacon.name
                : undefined,
          },
          "*"
        );
      }
    }

    if (e.code === "KeyR" && M) {
      externalModalOpen = true;
      keys.clear();
      overlay.classList.add("hidden");
      closeMap();

      const baseColRow = lonLatToColRow(baseLatLon.lon, baseLatLon.lat);
      teleport(baseColRow.col, baseColRow.row);
      controls.unlock();

      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: "marswalk:return-to-base",
            totalTraverseMeters: Math.round(player.totalTraverseMeters),
            elapsedTimeSeconds: Math.round(player.elapsedSeconds),
          },
          "*"
        );
      }
    }
  });

  document.addEventListener("keyup", (e) => {
    keys.delete(e.code);
  });

  startBtn.addEventListener("click", () => {
    externalModalOpen = false;
    controls.lock();
  });

  renderer.domElement.addEventListener("click", () => {
    if (M && mapPanel.classList.contains("hidden") && !externalModalOpen) {
      controls.lock();
    }
  });

  controls.addEventListener("lock", () => {
    externalModalOpen = false;
    overlay.classList.add("hidden");
    closeMap();
    emitTelemetrySync();
  });

  controls.addEventListener("unlock", () => {
    keys.clear();
    if (mapPanel.classList.contains("hidden") && !externalModalOpen) {
      overlay.classList.remove("hidden");
    }
    emitTelemetrySync();
  });

  openMapBtn.addEventListener("click", openMap);
  layerBtn?.addEventListener("click", cycleSurfaceLayer);

  mapCanvas.addEventListener("mousedown", (e) => {
    mapDragging = true;
    mapDragMovedDist = 0;
    mapDragStartX = e.clientX;
    mapDragStartY = e.clientY;
    getMapViewBounds();
    mapDragOriginPanX = mapPanX;
    mapDragOriginPanY = mapPanY;
  });

  window.addEventListener("mousemove", (e) => {
    if (!mapDragging || mapPanel.classList.contains("hidden") || !M) return;
    const dx = e.clientX - mapDragStartX;
    const dy = e.clientY - mapDragStartY;
    mapDragMovedDist = Math.hypot(dx, dy);
    if (mapDragMovedDist > 3) {
      const rect = mapCanvas.getBoundingClientRect();
      const { visCols, visRows } = getMapViewBounds();
      mapPanX = mapDragOriginPanX - (dx / Math.max(1, rect.width)) * visCols;
      mapPanY = mapDragOriginPanY - (dy / Math.max(1, rect.height)) * visRows;
      drawMap();
    }
  });

  window.addEventListener("mouseup", () => {
    mapDragging = false;
  });

  mapCanvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      setMapZoom(mapZoom * factor);
    },
    { passive: false }
  );

  mapCanvas.addEventListener("click", selectOnMap);

  mapZoomIn?.addEventListener("click", () => setMapZoom(mapZoom * 1.35));
  mapZoomOut?.addEventListener("click", () => setMapZoom(mapZoom / 1.35));
  mapZoomReset?.addEventListener("click", () => {
    if (M) {
      mapPanX = xToCol(player.pos.x);
      mapPanY = zToRow(player.pos.z);
    }
    setMapZoom(1.0);
  });
  mapCenterPlayer?.addEventListener("click", () => {
    if (mapZoom < 1.8) {
      mapZoom = 2.0;
      if (mapZoomLabel) mapZoomLabel.textContent = "2.0×";
    }
    centerMapOnPlayer();
  });

  mapGo.addEventListener("click", () => {
    if (!mapSel) {
      return;
    }
    teleport(mapSel.col, mapSel.row);
    closeMap();
    emitTelemetrySync();
    controls.lock();
  });

  mapClose.addEventListener("click", () => {
    closeMap();
    if (!externalModalOpen && !controls.isLocked) {
      overlay.classList.remove("hidden");
    }
  });

  function syncViewportProjection() {
    const vp = getViewportSize();
    const aspect = vp.width / vp.height;
    camera.aspect = aspect;
    camera.fov = verticalFovForAspect(aspect);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(vp.width, vp.height, false);

    if (!mapPanel.classList.contains("hidden")) {
      drawMap();
    }
  }

  window.addEventListener("resize", syncViewportProjection);

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => {
      syncViewportProjection();
    });
    ro.observe(document.documentElement);
    const wrap = mapCanvas.parentElement;
    if (wrap) {
      ro.observe(wrap);
    }
  }

  window.addEventListener(
    "message",
    (event: MessageEvent<ExpeditionTargetMessage>) => {
      const data = event.data;
      if (!data || typeof data.type !== "string") {
        return;
      }

      if (data.type === "mars-explorer:modal-state") {
        externalModalOpen = Boolean(data.open);
        if (externalModalOpen) {
          keys.clear();
          overlay.classList.add("hidden");
          closeMap();
          controls.unlock();
        }
        emitTelemetrySync();
        return;
      }

      if (data.type === "mars-explorer:toggle-map" && M) {
        if (mapPanel.classList.contains("hidden")) {
          openMap();
        } else {
          closeMap();
        }
        return;
      }

      if (data.type === "mars-explorer:toggle-flight" && M) {
        player.fly = !player.fly;
        hudMode.textContent = player.fly ? "RECON FLIGHT" : "MARS 0.38G WALK";
        emitTelemetrySync();
        return;
      }

      if (data.type === "mars-explorer:set-layer" && M) {
        if (data.layer && LAYER_ORDER.includes(data.layer)) {
          setSurfaceLayer(data.layer);
        } else {
          cycleSurfaceLayer();
        }
        return;
      }

      if (data.type === "mars-explorer:expedition") {
        applyExpeditionSpawn(
          typeof data.latitude === "number" ? data.latitude : null,
          typeof data.longitude === "number" ? data.longitude : null,
          data.name ?? null
        );

        if (Array.isArray(data.targets)) {
          rebuildBeacons(
            data.targets.map((t) => ({
              id: t.id,
              name: t.name,
              lat: t.latitude,
              lon: t.longitude,
              description: t.description,
              visited: t.visited,
            }))
          );
        }
        emitTelemetrySync();
      } else if (
        data.type === "mars-explorer:targets" &&
        Array.isArray(data.targets)
      ) {
        rebuildBeacons(
          data.targets.map((t) => ({
            id: t.id,
            name: t.name,
            lat: t.latitude,
            lon: t.longitude,
            description: t.description,
            visited: t.visited,
          }))
        );
        emitTelemetrySync();
      } else if (
        data.type === "mars-explorer:teleport" &&
        typeof data.latitude === "number" &&
        typeof data.longitude === "number" &&
        M
      ) {
        if (isLonLatInsideManifest(data.longitude, data.latitude)) {
          const c = lonLatToColRow(data.longitude, data.latitude);
          teleport(c.col, c.row);
          emitTelemetrySync();
        }
      } else if (data.type === "mars-explorer:return-base" && M) {
        const baseColRow = lonLatToColRow(baseLatLon.lon, baseLatLon.lat);
        teleport(baseColRow.col, baseColRow.row);
        emitTelemetrySync();
      } else if (data.type === "mars-explorer:contingency") {
        if (data.contingency === "dust-squall") {
          scene.background = dustStormSkyColor.clone();
          sceneFog.color.copy(dustStormSkyColor);
          sceneFog.near = envConfig.atmosphere.dustStorm.fogNearMeters;
          sceneFog.far = envConfig.atmosphere.dustStorm.fogFarMeters;
        } else {
          scene.background = nominalSkyColor.clone();
          sceneFog.color.copy(nominalSkyColor);
          sceneFog.near = envConfig.atmosphere.fogNearMeters;
          sceneFog.far = envConfig.atmosphere.fogFarMeters;
        }
      }
    }
  );

  // ------------------------------------------------------------ boot
  async function boot() {
    try {
      const r = await fetch(`${CONFIG.dataUrl}manifest.json`);
      if (!r.ok) {
        throw new Error("manifest missing");
      }

      M = await r.json();

      CONFIG.farStep = M.overview.step;
      CONFIG.groundOffset = M.heightMin;

      validColMin = CONFIG.edgeTrimCells;
      validColMax = Math.max(validColMin + 64, M.cols - CONFIG.edgeTrimCells);
      validRowMin = CONFIG.edgeTrimCells;
      validRowMax = Math.max(validRowMin + 64, M.rows - CONFIG.edgeTrimCells);

      halfW = (M.tilesX * M.tileSize * M.cellX) / 2;
      halfD = (M.tilesY * M.tileSize * M.cellZ) / 2;

      overview = new Uint16Array(
        await fetchBuffer(`${CONFIG.dataUrl}overview.u16`)
      );
    } catch {
      loadingEl.innerHTML =
        `${envConfig.displayName} 3D elevation data is unavailable.<br>` +
        `Verify that <code>${CONFIG.dataUrl}manifest.json</code> and ` +
        `<code>${CONFIG.dataUrl}overview.u16</code> are present, then reload.`;

      statusEl.textContent = "Terrain elevation data unavailable";
      startBtn.disabled = true;

      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: "jezero-simulation-error",
            environmentId: envConfig.id,
            message: `Unable to load ${envConfig.displayName} 3D terrain elevation data (${CONFIG.dataUrl}manifest.json or ${CONFIG.dataUrl}overview.u16).`,
          },
          "*"
        );
      }
      return;
    }

    creditEl.textContent = `Terrain: ${M.source.credit}`;

    try {
      overviewTex = await loadTexture(`${CONFIG.dataUrl}${M.mapImage}`);
      overviewMat = new THREE.MeshLambertMaterial({
        map: overviewTex,
        color: CONFIG.marsTint,
      });
    } catch {
      console.warn("overview image missing; using flat colour");
    }

    mapImg = new Image();
    mapImg.onload = () => {
      if (!mapPanel.classList.contains("hidden")) {
        drawMap();
      }
    };
    mapImg.src = `${CONFIG.dataUrl}${M.mapImage}`;

    for (let ty = 0; ty < M.tilesY; ty++) {
      for (let tx = 0; tx < M.tilesX; tx++) {
        const t: Tile = {
          tx,
          ty,
          mesh: null,
          lod: -2,
          edgeKey: "",
          full: null,
          tex: null,
          texKey: "",
          loading: false,
          texLoading: false,
        };
        tiles.push(t);
      }
    }

    for (const t of tiles) {
      setTileMesh(t, -1);
    }

    const params = new URLSearchParams(window.location.search);
    const paramLat = params.has("lat") ? Number(params.get("lat")) : null;
    const paramLon = params.has("lon") ? Number(params.get("lon")) : null;
    const paramName = params.get("name");

    applyExpeditionSpawn(paramLat, paramLon, paramName);

    // Set initial horizontal viewing direction (315° NW toward the delta scarp)
    // using pure yaw in YXZ order so the horizon is 100% level with zero roll.
    if (!initialCameraViewSet) {
      camera.rotation.set(0, Math.PI / 4, 0);
      initialCameraViewSet = true;
    }

    syncViewportProjection();

    loadingEl.classList.add("hidden");
    startBtn.disabled = false;

    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "jezero-simulation-ready",
          environmentId: envConfig.id,
        },
        "*"
      );
      emitTelemetrySync();
    }
  }

  const clock = new THREE.Clock();

  function frame() {
    requestAnimationFrame(frame);

    const dt = Math.min(clock.getDelta(), 0.1);

    if (M && tiles.length) {
      if (controls.isLocked) {
        updatePlayer(dt);
      } else if (pendingSnap > 0) {
        player.pos.y = groundY(player.pos.x, player.pos.z) + CONFIG.eyeHeight;
        camera.position.copy(player.pos);

        if (activeLoads === 0) {
          pendingSnap--;
        }
      }

      updateStreaming(dt);
    }

    renderer.render(scene, camera);
  }

  boot();
  frame();
}
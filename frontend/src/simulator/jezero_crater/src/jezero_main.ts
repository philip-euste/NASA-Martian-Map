// frontend\src\simulator\jezero_crater\src\jezero_main.ts
// Marswalk — Jezero Crater Astronaut Surface Explorer (Phase 5)
// Real-terrain renderer driven by the USGS/NASA CTX DEM built by
// scripts/build-jezero.mjs. Supports Free Exploration and Mission EVA Mode,
// Mars partial gravity (3.71 m/s², ~0.38g), suit movement inertia, slope
// physics, 3D Habitat/Rover base & Science Target beacons, and postMessage
// fieldwork synchronization with the parent React MissionContext.

import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

// ------------------------------------------------------------ config
const CONFIG = {
  dataUrl: "/jezero/",
  nearTileRadius: 1,
  lodDistances: [2500, 6000, 12000],
  lodSteps: [1, 2, 4, 8],
  farStep: 8,
  skirtDepth: 60,
  eyeHeight: 1.72,
  walkSpeed: 4.8,
  sprintSpeed: 11.5,
  suitAcceleration: 9.5, // Pressurized EVA suit horizontal inertia
  suitDamping: 7.0,
  flySpeed: 250,
  flySprintSpeed: 1200,
  jumpSpeed: 3.4, // ~1.55m apex in 3.71 m/s² Mars gravity
  gravity: 3.71, // Mars surface gravity (0.38g), m/s²
  maxConcurrentLoads: 6,
  marsTint: new THREE.Color(0xe0a27a),
  groundOffset: 0,
};

const LANDMARKS = [
  {
    id: "perseverance-landing",
    name: "Octavia E. Butler Landing (Habitat / Rover Base)",
    lat: 18.4447,
    lon: 77.4508,
    description: "Perseverance rover landing site and primary EVA habitat base.",
  },
  {
    id: "western-delta-front",
    name: "Western Delta Scarp Outcrop",
    lat: 18.458,
    lon: 77.405,
    description: "Layered deltaic sandstone and mudstone foreset beds.",
  },
  {
    id: "kodiak-butte",
    name: "Kodiak Butte Delta Remnant",
    lat: 18.428,
    lon: 77.419,
    description: "Isolated erosional remnant preserving ancient lake-level strata.",
  },
  {
    id: "jezero-center",
    name: "Jezero Crater Floor Unit",
    lat: 18.38,
    lon: 77.58,
    description: "Mafic crater floor unit with olivine and carbonate signatures.",
  },
];

// ------------------------------------------------------------ types
interface Manifest {
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
  full: Uint16Array | null;
  tex: THREE.Texture | null;
  texKey: string;
  loading: boolean;
  texLoading: boolean;
}

interface MissionTargetBeacon {
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
    | "mars-explorer:contingency";
  regionId?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  withinJezeroDem?: boolean;
  targets?: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    description?: string;
    visited?: boolean;
  }[];
  contingency?: string | null;
}

// ------------------------------------------------------------ dom
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
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
const openMapBtn = $<HTMLButtonElement>("open-map");
const creditEl = $("credit");

// ------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const nominalSkyColor = new THREE.Color(0xc9a585);
const dustStormSkyColor = new THREE.Color(0x9e5b36);
scene.background = nominalSkyColor.clone();
const sceneFog = new THREE.Fog(nominalSkyColor.clone(), 4000, 30000);
scene.fog = sceneFog;

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.3, 80000);
scene.add(new THREE.HemisphereLight(0xf3d6bd, 0x5a3a28, 0.9));
const sun = new THREE.DirectionalLight(0xfff1e0, 1.8);
sun.position.set(-0.6, 0.55, -0.4).normalize();
scene.add(sun);

const controls = new PointerLockControls(camera, renderer.domElement);

// ------------------------------------------------------------ state
let M: Manifest;
let overview: Uint16Array;
let overviewTex: THREE.Texture | null = null;
let mapImg: HTMLImageElement | null = null;
const tiles: Tile[] = [];
let activeLoads = 0;
let halfW = 0, halfD = 0;

// Habitat / Rover Base world coordinates
let baseWorldPos = new THREE.Vector3(0, 0, 0);
let baseLatLon = { lat: LANDMARKS[0].lat, lon: LANDMARKS[0].lon };

// Beacons in 3D scene
const beaconGroup = new THREE.Group();
scene.add(beaconGroup);
let missionBeacons: MissionTargetBeacon[] = [];
let nearestBeacon: { beacon: MissionTargetBeacon; distMeters: number } | null = null;

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
    col: ((lon - p.westLonDeg) / (p.eastLonDeg - p.westLonDeg)) * M.cols - 0.5,
    row: ((p.northLatDeg - lat) / (p.northLatDeg - p.southLatDeg)) * M.rows - 0.5,
  };
}
function colRowToLonLat(col: number, row: number) {
  const p = M.proj;
  return {
    lon: p.westLonDeg + ((col + 0.5) / M.cols) * (p.eastLonDeg - p.westLonDeg),
    lat: p.northLatDeg - ((row + 0.5) / M.rows) * (p.northLatDeg - p.southLatDeg),
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
  oc = Math.min(Math.max(oc, 0), o.cols - 1);
  or = Math.min(Math.max(or, 0), o.rows - 1);
  return overview[or * o.cols + oc];
}

function sampleQ(col: number, row: number): number {
  const T = M.tileSize;
  col = Math.min(Math.max(Math.round(col), 0), M.cols - 1);
  row = Math.min(Math.max(Math.round(row), 0), M.rows - 1);
  const tx = Math.min(Math.floor(col / T), M.tilesX - 1);
  const ty = Math.min(Math.floor(row / T), M.tilesY - 1);
  const t = tiles[ty * M.tilesX + tx];
  if (t && t.full) {
    const i = (row - ty * T) * (T + 1) + (col - tx * T);
    if (i >= 0 && i < t.full.length) return t.full[i];
  }
  const s = M.overview.step;
  const fc = col / s, fr = row / s;
  const c0 = Math.floor(fc), r0 = Math.floor(fr);
  const ax = fc - c0, ay = fr - r0;
  return (
    (overviewH(c0, r0) * (1 - ax) + overviewH(c0 + 1, r0) * ax) * (1 - ay) +
    (overviewH(c0, r0 + 1) * (1 - ax) + overviewH(c0 + 1, r0 + 1) * ax) * ay
  );
}

function groundY(x: number, z: number): number {
  const c = xToCol(x), r = zToRow(z);
  const c0 = Math.floor(c), r0 = Math.floor(r);
  const ax = c - c0, ay = r - r0;
  const q =
    (sampleQ(c0, r0) * (1 - ax) + sampleQ(c0 + 1, r0) * ax) * (1 - ay) +
    (sampleQ(c0, r0 + 1) * (1 - ax) + sampleQ(c0 + 1, r0 + 1) * ax) * ay;
  return q * M.heightScale;
}

/** Local terrain slope in degrees at world (x, z) sampled over a 6 m baseline */
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

// ------------------------------------------------------------ 3D Beacons (Habitat & Targets)
function createBeaconMesh(isBase: boolean, visited: boolean): THREE.Group {
  const g = new THREE.Group();
  const primaryColor = isBase ? 0x38bdf8 : visited ? 0x93b98a : 0xf47738;

  if (isBase) {
    // Habitat / Rover Base Structure
    const padGeo = new THREE.CylinderGeometry(7, 8.5, 0.8, 16);
    const padMat = new THREE.MeshLambertMaterial({ color: 0x45404a });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.y = 0.4;
    g.add(pad);

    const domeGeo = new THREE.SphereGeometry(4.2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshLambertMaterial({ color: 0xe5e0d8 });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 0.8;
    g.add(dome);
  } else {
    // Science Target Marker
    const baseGeo = new THREE.CylinderGeometry(1.8, 2.2, 0.6, 12);
    const baseMat = new THREE.MeshLambertMaterial({ color: primaryColor });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.3;
    g.add(baseMesh);
  }

  // Vertical light pillar so the astronaut can spot waypoints across Jezero craters/scarps
  const beamGeo = new THREE.CylinderGeometry(0.45, 0.45, isBase ? 180 : 120, 8);
  const beamMat = new THREE.MeshBasicMaterial({
    color: primaryColor,
    transparent: true,
    opacity: 0.38,
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
    // Default Jezero geological points of interest for Free Exploration
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
    const wx = colToX(coords.col);
    const wz = rowToZ(coords.row);
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

  let closest: { beacon: MissionTargetBeacon; distMeters: number } | null = null;

  for (const b of missionBeacons) {
    if (!b.group) continue;
    // Keep beacon anchored to latest streamed tile height
    b.group.position.y = groundY(b.group.position.x, b.group.position.z);
    const dist = Math.hypot(
      player.pos.x - b.group.position.x,
      player.pos.z - b.group.position.z
    );
    if (!closest || dist < closest.distMeters) {
      closest = { beacon: b, distMeters: dist };
    }

    // Auto-visit target if within 45 meters
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
      proximityEl.innerHTML = `<strong>${closest.beacon.name}</strong> (${Math.round(
        closest.distMeters
      )} m) · Press <strong>[R]</strong> to Complete EVA Return`;
    } else {
      proximityEl.innerHTML = `Approaching <strong>${
        closest.beacon.name
      }</strong> (${Math.round(
        closest.distMeters
      )} m) · Press <strong>[E]</strong> to Open Fieldwork &amp; Sampling`;
    }
  } else {
    proximityEl.classList.add("hidden");
  }
}

// ------------------------------------------------------------ meshing
function buildTileGeometry(t: Tile, step: number): THREE.BufferGeometry {
  const T = M.tileSize;
  const n = T / step + 1;
  const c0 = t.tx * T, r0 = t.ty * T;
  const vCount = n * n + 4 * n;
  const pos = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx: number[] = [];

  const useTile = !!t.tex;
  const u0 = useTile ? 0 : t.tx / M.tilesX, u1 = useTile ? 1 : (t.tx + 1) / M.tilesX;
  const v0 = useTile ? 1 : 1 - t.ty / M.tilesY, v1 = useTile ? 0 : 1 - (t.ty + 1) / M.tilesY;

  const hs = M.heightScale;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const k = i * n + j;
      const col = c0 + j * step, row = r0 + i * step;
      pos[k * 3] = colToX(col);
      pos[k * 3 + 1] = sampleQ(col, row) * hs;
      pos[k * 3 + 2] = rowToZ(row);
      uv[k * 2] = u0 + (u1 - u0) * (j / (n - 1));
      uv[k * 2 + 1] = v0 + (v1 - v0) * (i / (n - 1));
    }
  for (let i = 0; i < n - 1; i++)
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j, b = a + 1, c = a + n, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }

  const edges: number[][] = [
    Array.from({ length: n }, (_, j) => j),
    Array.from({ length: n }, (_, j) => (n - 1) * n + (n - 1 - j)),
    Array.from({ length: n }, (_, i) => (n - 1 - i) * n),
    Array.from({ length: n }, (_, i) => i * n + n - 1),
  ];
  let sk = n * n;
  for (const e of edges) {
    const base = sk;
    for (const g of e) {
      pos[sk * 3] = pos[g * 3];
      pos[sk * 3 + 1] = pos[g * 3 + 1] - CONFIG.skirtDepth;
      pos[sk * 3 + 2] = pos[g * 3 + 2];
      uv[sk * 2] = uv[g * 2];
      uv[sk * 2 + 1] = uv[g * 2 + 1];
      sk++;
    }
    for (let m = 0; m < n - 1; m++) {
      const a = e[m], b = e[m + 1], c = base + m, d = base + m + 1;
      idx.push(a, b, c, b, d, c, a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

const fallbackMat = new THREE.MeshLambertMaterial({ color: CONFIG.marsTint });
let overviewMat: THREE.MeshLambertMaterial = fallbackMat;

function setTileMesh(t: Tile, lod: number) {
  const step = lod < 0 ? CONFIG.farStep : CONFIG.lodSteps[lod];
  const useTile = !!t.tex;
  const texKey = useTile ? "t" : "o";
  if (t.mesh && t.lod === lod && t.texKey === texKey) return;
  const geo = buildTileGeometry(t, step);
  let mat: THREE.Material = overviewMat;
  if (t.tex) mat = new THREE.MeshLambertMaterial({ map: t.tex, color: CONFIG.marsTint });
  if (t.mesh) {
    t.mesh.geometry.dispose();
    const old = t.mesh.material as THREE.Material;
    if (old !== overviewMat && old !== fallbackMat && old !== mat) old.dispose();
    t.mesh.geometry = geo;
    t.mesh.material = mat;
  } else {
    t.mesh = new THREE.Mesh(geo, mat);
    t.mesh.matrixAutoUpdate = false;
    scene.add(t.mesh);
  }
  t.lod = lod;
  t.texKey = texKey;
}

// ------------------------------------------------------------ loading
async function fetchBuffer(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
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
        res(tx);
      },
      undefined,
      rej,
    ),
  );
}

function tileDistance(t: Tile, x: number, z: number) {
  const T = M.tileSize;
  const x0 = colToX(t.tx * T), x1 = colToX((t.tx + 1) * T);
  const z0 = rowToZ(t.ty * T), z1 = rowToZ((t.ty + 1) * T);
  const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
  return Math.hypot(dx, dz);
}

function requestFull(t: Tile) {
  if (t.full || t.loading || activeLoads >= CONFIG.maxConcurrentLoads) return;
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
  if (t.tex || t.texLoading || M.textures[t.ty * M.tilesX + t.tx] !== "1") return;
  if (activeLoads >= CONFIG.maxConcurrentLoads) return;
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
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = t.tx + dx, ny = t.ty + dy;
      if (nx < 0 || ny < 0 || nx >= M.tilesX || ny >= M.tilesY) continue;
      const n = tiles[ny * M.tilesX + nx];
      if (n.mesh) setTileMesh(n, n.lod);
    }
}

function unloadTile(t: Tile) {
  t.full = null;
  if (t.tex) {
    t.tex.dispose();
    t.tex = null;
  }
  setTileMesh(t, -1);
}

// ------------------------------------------------------------ streaming
let lastStreamTile = "";
let streamTimer = 0;
function updateStreaming(dt: number) {
  streamTimer -= dt;
  const T = M.tileSize;
  const ptx = Math.floor(xToCol(player.pos.x) / T), pty = Math.floor(zToRow(player.pos.z) / T);
  const key = `${ptx},${pty}`;
  if (streamTimer > 0 && key === lastStreamTile) return;
  streamTimer = 0.5;
  lastStreamTile = key;

  const order = [...tiles].sort(
    (a, b) => tileDistance(a, player.pos.x, player.pos.z) - tileDistance(b, player.pos.x, player.pos.z),
  );
  let full = 0;
  for (const t of order) {
    const d = tileDistance(t, player.pos.x, player.pos.z);
    const near = Math.abs(t.tx - ptx) <= CONFIG.nearTileRadius && Math.abs(t.ty - pty) <= CONFIG.nearTileRadius;
    const keep = Math.abs(t.tx - ptx) <= CONFIG.nearTileRadius + 1 && Math.abs(t.ty - pty) <= CONFIG.nearTileRadius + 1;

    if (near) {
      requestFull(t);
      requestTex(t);
    } else if (!keep && (t.full || t.tex)) {
      unloadTile(t);
    }
    if (t.full) full++;

    let lod = -1;
    if (t.full) {
      lod = CONFIG.lodSteps.length - 1;
      for (let i = 0; i < CONFIG.lodDistances.length; i++)
        if (d < CONFIG.lodDistances[i]) {
          lod = i;
          break;
        }
    }
    if (lod !== t.lod) setTileMesh(t, lod);
  }
  hudTiles.textContent = `TILES ${full}/${tiles.length}`;
  updateBeaconsHeightAndProximity();
}

// ------------------------------------------------------------ player & physics
function teleport(col: number, row: number) {
  col = Math.min(Math.max(col, 1), M.cols - 2);
  row = Math.min(Math.max(row, 1), M.rows - 2);
  player.pos.set(colToX(col), 0, rowToZ(row));
  player.pos.y = groundY(player.pos.x, player.pos.z) + CONFIG.eyeHeight;
  player.vel.set(0, 0, 0);
  player.horizVel.set(0, 0);
  lastStreamTile = "";
  streamTimer = 0;
  pendingSnap = 3;
}
let pendingSnap = 0;

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
    camera.position.copy(player.pos);
    camera.lookAt(player.pos.x - 100, player.pos.y, player.pos.z - 100);
    const label = name?.trim() || "Selected Expedition Site";
    statusEl.textContent = `BASE: ${label} · ${lat!.toFixed(4)}°N ${lon!.toFixed(4)}°E`;
    rebuildBeacons();
    return;
  }

  baseLatLon = { lat: LANDMARKS[0].lat, lon: LANDMARKS[0].lon };
  const fallback = lonLatToColRow(LANDMARKS[0].lon, LANDMARKS[0].lat);
  teleport(fallback.col, fallback.row);
  baseWorldPos.copy(player.pos);
  camera.position.copy(player.pos);
  camera.lookAt(player.pos.x - 100, player.pos.y, player.pos.z - 100);

  if (name?.trim()) {
    statusEl.textContent = `${name.trim()} (Jezero Crater Reference DEM · Octavia E. Butler Base)`;
  } else {
    statusEl.textContent = "BASE: Jezero Crater · Octavia E. Butler Landing";
  }
  rebuildBeacons();
}

const fwd = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3();
let telemetryTimer = 0;

function updatePlayer(dt: number) {
  const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
  camera.getWorldDirection(fwd);
  if (!player.fly) fwd.y = 0;
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
    // Slope penalty: slopes > 12° progressively reduce astronaut walking speed
    const slopeFactor = Math.max(0.42, 1 - Math.max(0, slopeDeg - 8) * 0.025);
    const targetSpeed = (sprint ? CONFIG.sprintSpeed : CONFIG.walkSpeed) * slopeFactor;

    const targetVx = move.x * targetSpeed;
    const targetVz = move.z * targetSpeed;
    const rate = move.lengthSq() > 0 ? CONFIG.suitAcceleration : CONFIG.suitDamping;

    // Smooth pressurized-suit horizontal inertia
    player.horizVel.x = THREE.MathUtils.damp(player.horizVel.x, targetVx, rate, dt);
    player.horizVel.y = THREE.MathUtils.damp(player.horizVel.y, targetVz, rate, dt);

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
      if (player.onGround && player.vel.y <= 0 && player.pos.y - g < targetSpeed * dt * 1.5) {
        player.pos.y = g;
      } else {
        player.onGround = false;
      }
    }
  }

  // Keep inside DEM bounds
  player.pos.x = Math.min(Math.max(player.pos.x, -halfW + 30), halfW - 30);
  player.pos.z = Math.min(Math.max(player.pos.z, -halfD + 30), halfD - 30);
  camera.position.copy(player.pos);

  const stepDist = Math.hypot(player.pos.x - prevX, player.pos.z - prevZ);
  if (stepDist > 0.001 && stepDist < 50) {
    player.totalTraverseMeters += stepDist;
  }
  player.elapsedSeconds += dt;

  if (pendingSnap > 0 && activeLoads === 0) pendingSnap--;

  const { lon, lat } = colRowToLonLat(xToCol(player.pos.x), zToRow(player.pos.z));
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

  // Periodically sync telemetry with parent React window
  telemetryTimer += dt;
  if (telemetryTimer >= 1.0) {
    telemetryTimer = 0;
    updateBeaconsHeightAndProximity();
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "marswalk:telemetry-sync",
          latitude: Number(lat.toFixed(5)),
          longitude: Number(lon.toFixed(5)),
          elevationMeters: Math.round(elev),
          slopeDegrees: Number(slopeDeg.toFixed(1)),
          distanceFromBaseMeters: Math.round(distFromBase),
          totalTraverseMeters: Math.round(player.totalTraverseMeters),
          elapsedTimeSeconds: Math.round(player.elapsedSeconds),
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
  }
}

// ------------------------------------------------------------ 2D map
let mapSel: { col: number; row: number } | null = null;

function drawMap() {
  const ctx = mapCanvas.getContext("2d")!;
  const rect = mapCanvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio, 2);
  mapCanvas.width = Math.round(rect.width * dpr);
  mapCanvas.height = Math.round(rect.height * dpr);
  const W = mapCanvas.width, H = mapCanvas.height;
  ctx.fillStyle = "#120b08";
  ctx.fillRect(0, 0, W, H);
  if (mapImg) ctx.drawImage(mapImg, 0, 0, W, H);

  const sx = W / (M.tilesX * M.tileSize), sy = H / (M.tilesY * M.tileSize);
  const dot = (col: number, row: number, color: string, r: number) => {
    ctx.beginPath();
    ctx.arc(col * sx, row * sy, r * dpr, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeStyle = "#000";
    ctx.stroke();
  };
  ctx.font = `${11.5 * dpr}px system-ui, sans-serif`;

  // Draw landmarks & mission beacons
  for (const b of missionBeacons) {
    if (!isLonLatInsideManifest(b.lon, b.lat)) continue;
    const p = lonLatToColRow(b.lon, b.lat);
    dot(p.col, p.row, b.isBase ? "#38bdf8" : b.visited ? "#93b98a" : "#f47738", 5.5);
    ctx.fillStyle = "#f3efea";
    ctx.fillText(b.name, p.col * sx + 8 * dpr, p.row * sy + 4 * dpr);
  }

  // Player heading
  const pc = xToCol(player.pos.x), pr = zToRow(player.pos.z);
  camera.getWorldDirection(fwd);
  ctx.beginPath();
  ctx.moveTo(pc * sx, pr * sy);
  ctx.lineTo((pc + fwd.x * 60) * sx, (pr + fwd.z * 60) * sy);
  ctx.strokeStyle = "#ffd36b";
  ctx.lineWidth = 2 * dpr;
  ctx.stroke();
  dot(pc, pr, "#ffd36b", 5);
  if (mapSel) dot(mapSel.col, mapSel.row, "#ff4d3a", 7);
}

function selectOnMap(e: MouseEvent) {
  const rect = mapCanvas.getBoundingClientRect();
  const col = ((e.clientX - rect.left) / rect.width) * M.tilesX * M.tileSize;
  const row = ((e.clientY - rect.top) / rect.height) * M.tilesY * M.tileSize;
  if (col >= M.cols || row >= M.rows) return;
  mapSel = { col, row };
  const { lon, lat } = colRowToLonLat(col, row);
  const elev = CONFIG.groundOffset + sampleQ(Math.round(col), Math.round(row)) * M.heightScale;
  mapInfo.textContent = `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E · elevation ≈ ${elev.toFixed(0)} m`;
  mapGo.disabled = false;
  drawMap();
}

function openMap() {
  if (!M || !tiles.length) return;
  controls.unlock();
  overlay.classList.add("hidden");
  mapPanel.classList.remove("hidden");
  const aspect = (M.tilesX * M.tileSize * M.cellX) / (M.tilesY * M.tileSize * M.cellZ);
  const maxW = window.innerWidth * 0.9, maxH = window.innerHeight * 0.72;
  let w = maxW, h = w / aspect;
  if (h > maxH) { h = maxH; w = h * aspect; }
  mapCanvas.style.width = `${w}px`;
  mapCanvas.style.height = `${h}px`;
  drawMap();
}
function closeMap() {
  mapPanel.classList.add("hidden");
}

// ------------------------------------------------------------ input & messaging
document.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "KeyM" && M) {
    if (mapPanel.classList.contains("hidden")) openMap();
    else { closeMap(); controls.lock(); }
  }
  if (e.code === "KeyF" && controls.isLocked) {
    player.fly = !player.fly;
    hudMode.textContent = player.fly ? "RECON FLIGHT" : "MARS 0.38G WALK";
  }
  if (e.code === "KeyE" && M) {
    controls.unlock();
    if (window.parent && window.parent !== window) {
      const { lon, lat } = colRowToLonLat(xToCol(player.pos.x), zToRow(player.pos.z));
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
    // Return to Habitat Base
    const baseColRow = lonLatToColRow(baseLatLon.lon, baseLatLon.lat);
    teleport(baseColRow.col, baseColRow.row);
    controls.unlock();
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "marswalk:returned-to-base",
          totalTraverseMeters: Math.round(player.totalTraverseMeters),
          elapsedTimeSeconds: Math.round(player.elapsedSeconds),
        },
        "*"
      );
    }
  }
});
document.addEventListener("keyup", (e) => keys.delete(e.code));
startBtn.addEventListener("click", () => controls.lock());
renderer.domElement.addEventListener("click", () => {
  if (M && mapPanel.classList.contains("hidden")) controls.lock();
});
controls.addEventListener("lock", () => {
  overlay.classList.add("hidden");
  closeMap();
});
controls.addEventListener("unlock", () => {
  keys.clear();
  if (mapPanel.classList.contains("hidden")) overlay.classList.remove("hidden");
});
openMapBtn.addEventListener("click", openMap);
mapCanvas.addEventListener("click", selectOnMap);
mapGo.addEventListener("click", () => {
  if (!mapSel) return;
  teleport(mapSel.col, mapSel.row);
  closeMap();
  controls.lock();
});
mapClose.addEventListener("click", () => {
  closeMap();
  overlay.classList.remove("hidden");
});
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (!mapPanel.classList.contains("hidden")) openMap();
});

window.addEventListener("message", (event: MessageEvent<ExpeditionTargetMessage>) => {
  const data = event.data;
  if (!data || typeof data.type !== "string") return;

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
  } else if (data.type === "mars-explorer:targets" && Array.isArray(data.targets)) {
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
  } else if (
    data.type === "mars-explorer:teleport" &&
    typeof data.latitude === "number" &&
    typeof data.longitude === "number" &&
    M
  ) {
    if (isLonLatInsideManifest(data.longitude, data.latitude)) {
      const c = lonLatToColRow(data.longitude, data.latitude);
      teleport(c.col, c.row);
    }
  } else if (data.type === "mars-explorer:return-base" && M) {
    const baseColRow = lonLatToColRow(baseLatLon.lon, baseLatLon.lat);
    teleport(baseColRow.col, baseColRow.row);
  } else if (data.type === "mars-explorer:contingency") {
    if (data.contingency === "dust-squall") {
      scene.background = dustStormSkyColor.clone();
      sceneFog.color.copy(dustStormSkyColor);
      sceneFog.near = 250;
      sceneFog.far = 3400;
    } else {
      scene.background = nominalSkyColor.clone();
      sceneFog.color.copy(nominalSkyColor);
      sceneFog.near = 4000;
      sceneFog.far = 30000;
    }
  }
});

// ------------------------------------------------------------ boot
async function boot() {
  try {
    const r = await fetch(`${CONFIG.dataUrl}manifest.json`);
    if (!r.ok) throw new Error("manifest missing");
    M = await r.json();
  } catch {
    loadingEl.innerHTML =
      "Jezero terrain data not found.<br>Run <code>npm run build:map</code> once, then reload.";
    statusEl.textContent = "Map data missing — see README";
    startBtn.disabled = true;
    return;
  }
  CONFIG.farStep = M.overview.step;
  CONFIG.groundOffset = M.heightMin;
  halfW = (M.tilesX * M.tileSize * M.cellX) / 2;
  halfD = (M.tilesY * M.tileSize * M.cellZ) / 2;
  overview = new Uint16Array(await fetchBuffer(`${CONFIG.dataUrl}overview.u16`));

  creditEl.textContent = `Terrain: ${M.source.credit}`;

  try {
    overviewTex = await loadTexture(`${CONFIG.dataUrl}${M.mapImage}`);
    overviewMat = new THREE.MeshLambertMaterial({ map: overviewTex, color: CONFIG.marsTint });
  } catch {
    console.warn("overview image missing; using flat colour");
  }
  mapImg = new Image();
  mapImg.src = `${CONFIG.dataUrl}${M.mapImage}`;

  for (let ty = 0; ty < M.tilesY; ty++)
    for (let tx = 0; tx < M.tilesX; tx++) {
      const t: Tile = { tx, ty, mesh: null, lod: -2, full: null, tex: null, texKey: "", loading: false, texLoading: false };
      tiles.push(t);
      setTileMesh(t, -1);
    }

  const params = new URLSearchParams(window.location.search);
  const paramLat = params.has("lat") ? Number(params.get("lat")) : null;
  const paramLon = params.has("lon") ? Number(params.get("lon")) : null;
  const paramName = params.get("name");

  applyExpeditionSpawn(paramLat, paramLon, paramName);

  loadingEl.classList.add("hidden");
  startBtn.disabled = false;

  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "jezero-simulation-ready" }, "*");
  }
}

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  if (M && tiles.length) {
    if (controls.isLocked) updatePlayer(dt);
    else if (pendingSnap > 0) {
      player.pos.y = groundY(player.pos.x, player.pos.z) + CONFIG.eyeHeight;
      camera.position.copy(player.pos);
      if (activeLoads === 0) pendingSnap--;
    }
    updateStreaming(dt);
  }
  renderer.render(scene, camera);
}

boot();
frame();

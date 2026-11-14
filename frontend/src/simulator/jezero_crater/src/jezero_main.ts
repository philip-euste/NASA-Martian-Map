// frontend\src\simulator\jezero_crater\src\jezero_main.ts
// Marswalk — Jezero Crater Explorer
// Real-terrain renderer driven by the USGS/NASA CTX DEM built by
// scripts/build-jezero.mjs (see README). Three.js, first-person.
//
// World frame (metres):
//   +X = east, +Z = south, +Y = up
//   (0, 0) = centre of the DEM; Y = areoid elevation - heightMin
// Jezero lies ~2,500 m below the Mars datum, so Y is offset to keep
// numbers small; the HUD shows true elevation.

import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

// ------------------------------------------------------------ config
const CONFIG = {
  dataUrl: "/jezero/",
  nearTileRadius: 1, // tiles around the player loaded at full detail (radius 1 => 3x3)
  lodDistances: [2500, 6000, 12000], // m from player to tile edge
  lodSteps: [1, 2, 4, 8], // DEM cell stride per LOD (1 = full 20 m)
  farStep: 8, // overview stride (must equal manifest.overview.step)
  skirtDepth: 60,
  eyeHeight: 1.7,
  walkSpeed: 5,
  sprintSpeed: 25,
  flySpeed: 250,
  flySprintSpeed: 1200,
  jumpSpeed: 4.5,
  gravity: 3.71, // Mars, m/s^2
  maxConcurrentLoads: 6,
  marsTint: new THREE.Color(0xe0a27a),
  // Areoid elevation of the raster's lowest sample, filled in from the
  // manifest at startup. Not a constant: see HUD readout.
  groundOffset: 0,
};

const LANDMARKS = [
  { name: "Octavia E. Butler Landing (Perseverance)", lat: 18.4447, lon: 77.4508 },
  { name: "Jezero crater centre", lat: 18.38, lon: 77.58 },
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
  lod: number; // -1 = far (overview), -2 = nothing built yet
  full: Uint16Array | null; // full-res heights when loaded
  tex: THREE.Texture | null;
  texKey: string; // which texture source the current geometry uses
  loading: boolean;
  texLoading: boolean;
}

interface ExpeditionTargetMessage {
  type: "mars-explorer:expedition";
  regionId?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  withinJezeroDem?: boolean;
}

// ------------------------------------------------------------ dom
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const overlay = $("overlay");
const startBtn = $<HTMLButtonElement>("start");
const statusEl = $("status");
const hudPos = $("hud-pos");
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
const skyColor = new THREE.Color(0xc9a585);
scene.background = skyColor;
scene.fog = new THREE.Fog(skyColor, 4000, 30000);

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
let halfW = 0, halfD = 0; // world half-extent

const player = {
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  onGround: false,
  fly: false,
};
const keys = new Set<string>();

// ------------------------------------------------------------ coords
// Linear planetocentric mapping from the manifest's anchored bounds. The
// manifest decides where the raster sits on Mars; this class never sees the
// source GeoTIFF's own (inconsistent) coordinate metadata.
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

// ------------------------------------------------------------ height sampling
function overviewH(oc: number, or: number) {
  const o = M.overview;
  oc = Math.min(Math.max(oc, 0), o.cols - 1);
  or = Math.min(Math.max(or, 0), o.rows - 1);
  return overview[or * o.cols + oc];
}

/** Quantized height at integer DEM sample (col,row), best available. */
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
  // bilinear from overview
  const s = M.overview.step;
  const fc = col / s, fr = row / s;
  const c0 = Math.floor(fc), r0 = Math.floor(fr);
  const ax = fc - c0, ay = fr - r0;
  return (
    (overviewH(c0, r0) * (1 - ax) + overviewH(c0 + 1, r0) * ax) * (1 - ay) +
    (overviewH(c0, r0 + 1) * (1 - ax) + overviewH(c0 + 1, r0 + 1) * ax) * ay
  );
}

/** World-space ground height (Y) at world x,z, bilinear. */
function groundY(x: number, z: number): number {
  const c = xToCol(x), r = zToRow(z);
  const c0 = Math.floor(c), r0 = Math.floor(r);
  const ax = c - c0, ay = r - r0;
  const q =
    (sampleQ(c0, r0) * (1 - ax) + sampleQ(c0 + 1, r0) * ax) * (1 - ay) +
    (sampleQ(c0, r0 + 1) * (1 - ax) + sampleQ(c0 + 1, r0 + 1) * ax) * ay;
  return q * M.heightScale;
}

// ------------------------------------------------------------ meshing
function buildTileGeometry(t: Tile, step: number): THREE.BufferGeometry {
  const T = M.tileSize;
  const n = T / step + 1;
  const c0 = t.tx * T, r0 = t.ty * T;
  const vCount = n * n + 4 * n; // grid + skirt ring
  const pos = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx: number[] = [];

  // UVs: per-tile texture (0..1) or sub-rect of the overview image
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

  // Skirts hide cracks between tiles at different LODs.
  const edges: number[][] = [
    Array.from({ length: n }, (_, j) => j), // north
    Array.from({ length: n }, (_, j) => (n - 1) * n + (n - 1 - j)), // south (reversed)
    Array.from({ length: n }, (_, i) => (n - 1 - i) * n), // west
    Array.from({ length: n }, (_, i) => i * n + n - 1), // east
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
      idx.push(a, b, c, b, d, c, a, c, b, b, c, d); // double-sided
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
  // Edges of neighbours sample this tile, so refresh them too.
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

  // Nearest first
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
  hudTiles.textContent = `TILES ${full} / ${tiles.length}`;
}

// ------------------------------------------------------------ player
function teleport(col: number, row: number) {
  col = Math.min(Math.max(col, 1), M.cols - 2);
  row = Math.min(Math.max(row, 1), M.rows - 2);
  player.pos.set(colToX(col), 0, rowToZ(row));
  player.pos.y = groundY(player.pos.x, player.pos.z) + CONFIG.eyeHeight;
  player.vel.set(0, 0, 0);
  lastStreamTile = "";
  streamTimer = 0;
  // Ground snaps again once full-res data arrives (see updatePlayer).
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
    const target = lonLatToColRow(lon!, lat!);
    teleport(target.col, target.row);
    camera.position.copy(player.pos);
    camera.lookAt(player.pos.x - 100, player.pos.y, player.pos.z - 100);
    const label = name?.trim() || "Selected Expedition Site";
    statusEl.textContent = `${label} · ${lat!.toFixed(4)}°N ${lon!.toFixed(4)}°E`;
    return;
  }

  const fallback = lonLatToColRow(LANDMARKS[0].lon, LANDMARKS[0].lat);
  teleport(fallback.col, fallback.row);
  camera.position.copy(player.pos);
  camera.lookAt(player.pos.x - 100, player.pos.y, player.pos.z - 100);

  if (name?.trim()) {
    statusEl.textContent = `${name.trim()} (Jezero Crater Reference DEM · Octavia E. Butler Landing)`;
  } else {
    statusEl.textContent = "Jezero crater · Octavia E. Butler Landing";
  }
}

const fwd = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3();
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

  if (player.fly) {
    const sp = sprint ? CONFIG.flySprintSpeed : CONFIG.flySpeed;
    if (keys.has("Space")) move.y += 1;
    if (keys.has("KeyC") || keys.has("ControlLeft")) move.y -= 1;
    player.pos.addScaledVector(move, sp * dt);
    player.pos.y = Math.max(player.pos.y, ground + CONFIG.eyeHeight);
    player.vel.set(0, 0, 0);
  } else {
    const sp = sprint ? CONFIG.sprintSpeed : CONFIG.walkSpeed;
    player.vel.x = move.x * sp;
    player.vel.z = move.z * sp;
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
      // Stay glued when walking downhill instead of hopping
      if (player.onGround && player.vel.y <= 0 && player.pos.y - g < sp * dt * 1.5) player.pos.y = g;
      else player.onGround = false;
    }
  }

  // Keep inside the DEM
  player.pos.x = Math.min(Math.max(player.pos.x, -halfW + 30), halfW - 30);
  player.pos.z = Math.min(Math.max(player.pos.z, -halfD + 30), halfD - 30);
  camera.position.copy(player.pos);

  if (pendingSnap > 0 && activeLoads === 0) pendingSnap--;

  const { lon, lat } = colRowToLonLat(xToCol(player.pos.x), zToRow(player.pos.z));
  const elev = CONFIG.groundOffset + (player.pos.y - CONFIG.eyeHeight);
  hudPos.textContent = `${lat.toFixed(4)}°N ${lon.toFixed(4)}°E · ELEV ${elev.toFixed(0)} m`;
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

  // map covers tilesX*T columns x tilesY*T rows
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
  ctx.font = `${12 * dpr}px system-ui, sans-serif`;
  for (const l of LANDMARKS) {
    const p = lonLatToColRow(l.lon, l.lat);
    dot(p.col, p.row, "#7fd1ff", 5);
    ctx.fillStyle = "#fff";
    ctx.fillText(l.name, p.col * sx + 8 * dpr, p.row * sy + 4 * dpr);
  }
  // player heading
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
  // keep aspect ratio of the DEM grid
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
    hudMode.textContent = player.fly ? "FLY" : "WALK";
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
  if (!data || data.type !== "mars-explorer:expedition") return;
  applyExpeditionSpawn(
    typeof data.latitude === "number" ? data.latitude : null,
    typeof data.longitude === "number" ? data.longitude : null,
    data.name ?? null
  );
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

  // Overview texture + map image
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

  // Add ?debug=1 to the URL to watch tile loading state.
  const debug = params.has("debug");
  if (debug) {
    setInterval(() => {
      const withTex = tiles.filter((t) => t.tex).length;
      const withH = tiles.filter((t) => t.full).length;
      const errs = (window as unknown as { __mwErrors?: string[] }).__mwErrors ?? [];
      console.log(
        `[marswalk] grid ${M.tilesX}x${M.tilesY} | full-res ${withH} | textured ${withTex}/${withH} | loading ${activeLoads} | pos ${player.pos.x.toFixed(0)},${player.pos.y.toFixed(0)},${player.pos.z.toFixed(0)}`,
      );
      if (errs.length) console.warn("[marswalk] errors:", errs);
    }, 2000);
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

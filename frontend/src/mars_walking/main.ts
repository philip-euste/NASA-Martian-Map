// frontend\src\mars_walking\main.ts

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import './style.css';

// -----------------------------------------------------------------------------
// Marswalk baseline
// - Deterministic procedural terrain (placeholder until real Jezero DTM is wired)
// - Distance-based chunk LOD and chunk streaming
// - Pointer-lock first-person controls
// - Terrain-following movement, jump, gravity, and rock collision
// -----------------------------------------------------------------------------

const CONFIG = {
  chunkSize: 96,
  renderRadius: 3,          // chunks in each direction
  lodDistances: [115, 235], // near / medium / far thresholds
  lodSegments: [48, 24, 12],
  maxDelta: 0.05,
  walkSpeed: 8.0,
  sprintSpeed: 13.5,
  acceleration: 34,
  friction: 22,
  gravity: 22,
  jumpVelocity: 8.2,
  eyeHeight: 1.72,
  playerRadius: 0.42,
  worldSeed: 17,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb66f50);
scene.fog = new THREE.FogExp2(0xb66f50, 0.00165);

const camera = new THREE.PerspectiveCamera(76, innerWidth / innerHeight, 0.1, 1800);
camera.position.set(0, 8, 14);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.querySelector<HTMLDivElement>('#app')!.prepend(renderer.domElement);

const controls = new PointerLockControls(camera, renderer.domElement);
controls.pointerSpeed = 0.75;

const sun = new THREE.DirectionalLight(0xffd5b2, 2.2);
sun.position.set(-120, 180, 90);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100;
sun.shadow.camera.bottom = -100;
sun.shadow.bias = -0.00015;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xd7a88e, 0x34221b, 1.35));

const terrainMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 1,
  metalness: 0,
  vertexColors: true,
});
const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x79513d, roughness: 1 });
const rockDarkMaterial = new THREE.MeshStandardMaterial({ color: 0x543b31, roughness: 1 });

const hint = document.querySelector<HTMLDivElement>('#hint')!;
const startButton = document.querySelector<HTMLButtonElement>('#start')!;
const crosshair = document.querySelector<HTMLDivElement>('#crosshair')!;
const positionLabel = document.querySelector<HTMLSpanElement>('#position')!;
const chunkLabel = document.querySelector<HTMLSpanElement>('#chunks')!;
const speedLabel = document.querySelector<HTMLSpanElement>('#speed')!;
const loadingLabel = document.querySelector<HTMLDivElement>('#loading')!;

startButton.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => {
  hint.classList.add('hidden');
  crosshair.style.opacity = '1';
});
controls.addEventListener('unlock', () => {
  hint.classList.remove('hidden');
  crosshair.style.opacity = '0';
});

// Seeded deterministic noise helpers. Every chunk samples the same continuous
// height function, so adjacent chunk edges meet even when generated separately.
function hash2(x: number, z: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(z, 668265263) + CONFIG.worldSeed * 1442695041;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function smooth(t: number): number { return t * t * (3 - 2 * t); }
function valueNoise(x: number, z: number, scale: number): number {
  const gx = x / scale, gz = z / scale;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  const fx = smooth(gx - ix), fz = smooth(gz - iz);
  const a = THREE.MathUtils.lerp(hash2(ix, iz), hash2(ix + 1, iz), fx);
  const b = THREE.MathUtils.lerp(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), fx);
  return THREE.MathUtils.lerp(a, b, fz) * 2 - 1;
}
function terrainHeight(x: number, z: number): number {
  const broad = valueNoise(x, z, 190) * 8.5;
  const medium = valueNoise(x + 51, z - 37, 64) * 3.2;
  const fine = valueNoise(x - 13, z + 91, 22) * 0.95;
  const ridge = Math.abs(valueNoise(x + 300, z - 200, 105));
  const dune = Math.sin(x * 0.018 + valueNoise(x, z, 80)) *
               Math.cos(z * 0.014) * 1.15;
  return broad + medium + fine + ridge * 1.7 + dune;
}

type Obstacle = { x: number; z: number; radius: number; height: number };
type Chunk = {
  key: string;
  cx: number;
  cz: number;
  mesh: THREE.Mesh;
  rocks: THREE.Group;
  lod: number;
  obstacles: Obstacle[];
};

const chunks = new Map<string, Chunk>();
const chunkGroup = new THREE.Group();
scene.add(chunkGroup);

function chunkKey(cx: number, cz: number): string { return `${cx},${cz}`; }

function makeTerrainGeometry(cx: number, cz: number, segments: number): THREE.BufferGeometry {
  const size = CONFIG.chunkSize;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  const color = new THREE.Color();

  for (let i = 0; i < positions.count; i++) {
    const localX = positions.getX(i);
    const localZ = positions.getZ(i);
    const worldX = cx * size + localX;
    const worldZ = cz * size + localZ;
    const h = terrainHeight(worldX, worldZ);
    positions.setY(i, h);

    const variation = THREE.MathUtils.clamp((h + 12) / 30, 0, 1);
    const noiseTint = valueNoise(worldX, worldZ, 13) * 0.045;
    color.setRGB(
      0.43 + variation * 0.13 + noiseTint,
      0.245 + variation * 0.065 + noiseTint * 0.55,
      0.17 + variation * 0.035
    );
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createRock(x: number, z: number, scale: number): THREE.Mesh {
  const geo = new THREE.DodecahedronGeometry(1, 0);
  // Slightly irregular boulder; scale is the approximate radius.
  const mesh = new THREE.Mesh(geo, Math.random() > 0.45 ? rockMaterial : rockDarkMaterial);
  mesh.position.set(x, terrainHeight(x, z) + scale * 0.45, z);
  mesh.scale.set(scale * 1.15, scale * 0.75, scale);
  mesh.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.4);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildObstacles(cx: number, cz: number): { group: THREE.Group; items: Obstacle[] } {
  const group = new THREE.Group();
  const items: Obstacle[] = [];
  const size = CONFIG.chunkSize;
  // Deterministic rock positions: use hash values rather than Math.random so
  // revisiting a streamed chunk recreates its obstacle layout.
  const count = 13;
  for (let i = 0; i < count; i++) {
    const a = hash2(cx * 31 + i * 7, cz * 17 - i * 11);
    const b = hash2(cx * 13 - i * 19, cz * 29 + i * 5);
    const x = cx * size + (a - 0.5) * (size - 10);
    const z = cz * size + (b - 0.5) * (size - 10);
    const radius = 0.65 + hash2(i + cx * 5, cz * 3 - i) * 1.55;
    // Keep the starting area clear.
    if (Math.hypot(x, z) < 13) continue;
    group.add(createRock(x, z, radius));
    items.push({ x, z, radius: radius * 0.9, height: radius * 1.5 });
  }
  return { group, items };
}

function createChunk(cx: number, cz: number, lod: number): Chunk {
  const mesh = new THREE.Mesh(
    makeTerrainGeometry(cx, cz, CONFIG.lodSegments[lod]),
    terrainMaterial
  );
  mesh.position.set(cx * CONFIG.chunkSize, 0, cz * CONFIG.chunkSize);
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;

  const rockData = buildObstacles(cx, cz);
  const chunk = { key: chunkKey(cx, cz), cx, cz, mesh, rocks: rockData.group, lod, obstacles: rockData.items };
  chunkGroup.add(mesh, rockData.group);
  return chunk;
}

function replaceChunkLOD(chunk: Chunk, lod: number): void {
  if (chunk.lod === lod) return;
  chunkGroup.remove(chunk.mesh);
  chunk.mesh.geometry.dispose();
  chunk.mesh = new THREE.Mesh(
    makeTerrainGeometry(chunk.cx, chunk.cz, CONFIG.lodSegments[lod]),
    terrainMaterial
  );
  chunk.mesh.position.set(chunk.cx * CONFIG.chunkSize, 0, chunk.cz * CONFIG.chunkSize);
  chunk.mesh.receiveShadow = true;
  chunkGroup.add(chunk.mesh);
  chunk.lod = lod;
}

function desiredLOD(cx: number, cz: number): number {
  const centerX = (cx + 0.5) * CONFIG.chunkSize;
  const centerZ = (cz + 0.5) * CONFIG.chunkSize;
  const distance = Math.hypot(centerX - player.x, centerZ - player.z);
  if (distance < CONFIG.lodDistances[0]) return 0;
  if (distance < CONFIG.lodDistances[1]) return 1;
  return 2;
}

function updateChunks(): void {
  const pcx = Math.floor(player.x / CONFIG.chunkSize);
  const pcz = Math.floor(player.z / CONFIG.chunkSize);
  const wanted = new Set<string>();

  for (let dz = -CONFIG.renderRadius; dz <= CONFIG.renderRadius; dz++) {
    for (let dx = -CONFIG.renderRadius; dx <= CONFIG.renderRadius; dx++) {
      const cx = pcx + dx, cz = pcz + dz;
      const key = chunkKey(cx, cz);
      wanted.add(key);
      const lod = desiredLOD(cx, cz);
      const existing = chunks.get(key);
      if (!existing) chunks.set(key, createChunk(cx, cz, lod));
      else replaceChunkLOD(existing, lod);
    }
  }

  for (const [key, chunk] of chunks) {
    if (!wanted.has(key)) {
      chunkGroup.remove(chunk.mesh, chunk.rocks);
      chunk.mesh.geometry.dispose();
      chunks.delete(key);
    }
  }
  chunkLabel.textContent = `TILES ${chunks.size}`;
  loadingLabel.textContent = `LOD ${[...chunks.values()].filter(c => c.lod === 0).length} NEAR · ${chunks.size} TILES`;
}

// Player physics uses a horizontal circle against boulders and samples the
// heightfield for ground contact. This is intentionally lightweight and stable.
const player = {
  x: 0, z: 0, y: terrainHeight(0, 0) + CONFIG.eyeHeight,
  vx: 0, vz: 0, vy: 0, grounded: true,
};
camera.position.set(player.x, player.y, player.z);

const keys = new Set<string>();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

function collidesWithRock(x: number, z: number): boolean {
  const cx = Math.floor(x / CONFIG.chunkSize);
  const cz = Math.floor(z / CONFIG.chunkSize);
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const chunk = chunks.get(chunkKey(cx + dx, cz + dz));
      if (!chunk) continue;
      for (const rock of chunk.obstacles) {
        const minDistance = CONFIG.playerRadius + rock.radius;
        if ((x - rock.x) ** 2 + (z - rock.z) ** 2 < minDistance ** 2) return true;
      }
    }
  }
  return false;
}

function updatePlayer(dt: number): void {
  const forwardInput = Number(keys.has('KeyW') || keys.has('ArrowUp')) -
                      Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const sideInput = Number(keys.has('KeyD') || keys.has('ArrowRight')) -
                   Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const inputLength = Math.hypot(forwardInput, sideInput);
  const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
  speedLabel.textContent = sprinting && inputLength > 0 ? 'SPRINT' : 'WALK';

  // Derive horizontal forward/right vectors from camera yaw.
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const desired = new THREE.Vector3()
    .addScaledVector(forward, forwardInput)
    .addScaledVector(right, sideInput);

  if (inputLength > 0) desired.normalize().multiplyScalar(sprinting ? CONFIG.sprintSpeed : CONFIG.walkSpeed);
  const accel = inputLength > 0 ? CONFIG.acceleration : CONFIG.friction;
  player.vx = THREE.MathUtils.damp(player.vx, desired.x, accel, dt);
  player.vz = THREE.MathUtils.damp(player.vz, desired.z, accel, dt);

  const nextX = player.x + player.vx * dt;
  const nextZ = player.z + player.vz * dt;

  // Axis-separated resolution allows sliding along boulder sides.
  if (!collidesWithRock(nextX, player.z)) player.x = nextX;
  else player.vx = 0;
  if (!collidesWithRock(player.x, nextZ)) player.z = nextZ;
  else player.vz = 0;

  const groundY = terrainHeight(player.x, player.z) + CONFIG.eyeHeight;
  if (keys.has('Space') && player.grounded) {
    player.vy = CONFIG.jumpVelocity;
    player.grounded = false;
  }
  player.vy -= CONFIG.gravity * dt;
  player.y += player.vy * dt;
  if (player.y <= groundY) {
    player.y = groundY;
    player.vy = 0;
    player.grounded = true;
  }

  camera.position.set(player.x, player.y, player.z);
}

let previousTime = performance.now();
let chunkUpdateTimer = 0;

function animate(now: number): void {
  requestAnimationFrame(animate);
  const dt = Math.min((now - previousTime) / 1000, CONFIG.maxDelta);
  previousTime = now;

  if (controls.isLocked) updatePlayer(dt);
  chunkUpdateTimer += dt;
  if (chunkUpdateTimer > 0.18) {
    updateChunks();
    chunkUpdateTimer = 0;
  }

  positionLabel.textContent = `X ${player.x.toFixed(1)} · Z ${player.z.toFixed(1)}`;
  renderer.render(scene, camera);
}

updateChunks();
requestAnimationFrame(animate);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
});

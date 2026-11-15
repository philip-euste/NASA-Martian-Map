// frontend/src/simulator/shared/wmtsLayers.ts
//
// Composites NASA Mars Trek WMTS tiles covering a lon/lat box into one canvas.
// No three.js dependency: the engine wraps the canvas in a texture.
//
// Assumption (verify with the console.info line below): TileMatrix
// ScaleDenominator follows the OGC convention for EPSG:4326 / CRS84 matrix
// sets, i.e. degrees/pixel = scaleDenominator * 0.00028 / 111319.49079327358.
// For a global layer, matrixWidth * tileWidth * degPerPx should equal ~360.

import { nasaTrekProvider } from "../../services/providers/nasaTrek";
import type { TileMatrixLevel } from "../../services/dataProviders";

export interface GeoBox {
  westLonDeg: number;
  eastLonDeg: number;
  southLatDeg: number;
  northLatDeg: number;
  radius: number;
}

export interface ComposeOptions {
  /** Max WMTS tiles to fetch for the whole box. */
  maxTiles?: number;
  /** Max canvas width/height in pixels. */
  maxPx?: number;
  concurrency?: number;
}

export interface ComposeResult {
  canvas: HTMLCanvasElement;
  levelId: string;
  metersPerPixel: number;
  loaded: number;
  total: number;
}

const DEG_PER_M_OGC = 111319.49079327358;
const PIXEL_M = 0.00028;
const degPerPx = (l: TileMatrixLevel) =>
  (l.scaleDenominator * PIXEL_M) / DEG_PER_M_OGC;

interface Plan {
  lv: TileMatrixLevel;
  d: number;
  c0: number;
  c1: number;
  r0: number;
  r1: number;
}

// Levels are sorted coarse -> fine by the provider. Take the finest one that
// still fits the tile and pixel budgets.
function pickLevel(
  levels: TileMatrixLevel[],
  b: GeoBox,
  maxTiles: number,
  maxPx: number
): Plan | null {
  let best: Plan | null = null;
  for (const lv of levels) {
    const d = degPerPx(lv);
    const tw = lv.tileWidth * d;
    const th = lv.tileHeight * d;
    const c0 = Math.max(0, Math.floor((b.westLonDeg - lv.topLeftX) / tw));
    const c1 = Math.min(lv.matrixWidth - 1, Math.floor((b.eastLonDeg - lv.topLeftX) / tw));
    const r0 = Math.max(0, Math.floor((lv.topLeftY - b.northLatDeg) / th));
    const r1 = Math.min(lv.matrixHeight - 1, Math.floor((lv.topLeftY - b.southLatDeg) / th));
    if (c1 < c0 || r1 < r0) continue; // box outside this matrix
    const count = (c1 - c0 + 1) * (r1 - r0 + 1);
    const wpx = (b.eastLonDeg - b.westLonDeg) / d;
    const hpx = (b.northLatDeg - b.southLatDeg) / d;
    if (count > maxTiles || wpx > maxPx || hpx > maxPx) {
      if (best) break;
      continue;
    }
    best = { lv, d, c0, c1, r0, r1 };
  }
  return best;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // required for WebGL upload; needs ACAO on the tile server
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, n) }, async () => {
      while (i < items.length) await fn(items[i++]);
    })
  );
}

export async function composeWmtsCanvas(
  layerId: string,
  b: GeoBox,
  opts: ComposeOptions = {}
): Promise<ComposeResult> {
  const { maxTiles = 120, maxPx = 4096, concurrency = 8 } = opts;
  const cfg = await nasaTrekProvider.getLayerConfig(layerId);
  if (!cfg.matrixLevels?.length) {
    throw new Error("layer config has no tile matrix levels");
  }
  const plan = pickLevel(cfg.matrixLevels, b, maxTiles, maxPx);
  if (!plan) throw new Error("layer has no tiles covering this area");

  const { lv, d, c0, c1, r0, r1 } = plan;
  const wpx = Math.max(1, Math.round((b.eastLonDeg - b.westLonDeg) / d));
  const hpx = Math.max(1, Math.round((b.northLatDeg - b.southLatDeg) / d));

  console.info(
    `[wmts] ${layerId} level ${lv.id}: ${d.toExponential(4)} deg/px, ` +
      `matrix spans ${(lv.matrixWidth * lv.tileWidth * d).toFixed(2)} deg lon, ` +
      `canvas ${wpx}x${hpx}`
  );

  const canvas = document.createElement("canvas");
  canvas.width = wpx;
  canvas.height = hpx;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#2a2320"; // visible "no data" colour for gaps
  ctx.fillRect(0, 0, wpx, hpx);

  const jobs: { c: number; r: number }[] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) jobs.push({ c, r });

  let loaded = 0;
  await pool(jobs, concurrency, async ({ c, r }) => {
    const url = cfg.tileUrlTemplate
      .replaceAll("{z}", lv.id)
      .replaceAll("{y}", String(r))
      .replaceAll("{x}", String(c));
    const img = await loadImage(url);
    if (!img) return;
    const lon0 = lv.topLeftX + c * lv.tileWidth * d;
    const lat0 = lv.topLeftY - r * lv.tileHeight * d;
    ctx.drawImage(
      img,
      Math.round((lon0 - b.westLonDeg) / d),
      Math.round((b.northLatDeg - lat0) / d),
      lv.tileWidth,
      lv.tileHeight
    );
    loaded++;
  });

  if (loaded === 0) {
    throw new Error(
      "no tiles loaded (CORS blocked, offline, or outside layer coverage)"
    );
  }

  return {
    canvas,
    levelId: lv.id,
    metersPerPixel: d * (Math.PI / 180) * b.radius,
    loaded,
    total: jobs.length,
  };
}
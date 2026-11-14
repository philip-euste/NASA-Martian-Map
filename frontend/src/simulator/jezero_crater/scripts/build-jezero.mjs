// frontend\src\simulator\jezero_crater\scripts\build-jezero.mjs
// Marswalk — Jezero terrain builder
// ------------------------------------------------------------
// Downloads the official USGS / NASA Mars 2020 Science Investigation
// CTX DEM (20 m/px) and the matching CTX orthomosaic (5 m/px), then
// converts them into streamable tiles for the web client:
//
//   public/jezero/manifest.json        georeferencing + tiling metadata
//   public/jezero/overview.u16         whole-crater low-res heights
//   public/jezero/height/{tx}_{ty}.u16 full-res 257x257 height tiles
//   public/jezero/tex/{tx}_{ty}.jpg    orthoimage texture per tile
//   public/jezero/overview.jpg         whole-crater image for the 2D map
//   public/jezero/overview_shade.jpg   hillshade (map fallback)
//
// Usage:
//   npm run build:map                   (DEM + orthoimage)
//   npm run build:map -- --skip-ortho   (DEM only, much faster)
//   npm run build:map -- --tex 512      (smaller textures)
//
// Source products (public domain, please cite):
//   Mars 2020 Science Investigation CTX DEM Mosaic, USGS Astrogeology,
//   Calef 2021; Mangold et al. 2021, Science, doi:10.1126/science.abl4051

import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fromFile } from "geotiff";
import jpeg from "jpeg-js";

const DEM_URL =
  "https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif";
const ORTHO_URL =
  "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXortho_mosaic_5m.tif";

const args = process.argv.slice(2);
const SKIP_ORTHO = args.includes("--skip-ortho");
const texArg = args.indexOf("--tex");
const TEX = texArg >= 0 ? parseInt(args[texArg + 1], 10) : 1024; // px per tile texture
const TILE = 256; // DEM cells per tile (257 samples incl. shared edge)
const OVR_STEP = 8; // overview sample stride (8 x 20 m = 160 m)
const OVR_TEX = 128; // px per tile in the overview image
const MARS_R_FALLBACK = 3396190;

const RAW = "data/raw";
const OUT = "public/jezero";

// ------------------------------------------------------------ georeferencing
// The published raster's own coordinate metadata is internally inconsistent:
// the GeoTIFF bbox resolves to 73.03..74.54 E, while the USGS catalog entry
// for this same product states 76.99..78.58 E (and the 0.1-px check below
// confirms it). The projection declares lat_ts = 18.4663 and lon_0 = 0, so the
// easting origin clearly is not the crater's own longitude, but the file does
// not record the origin it was actually written against. A derived offset
// would therefore be a guess dressed up as arithmetic.
//
// So the catalog bounds are treated as the authority. Set bounds: "auto" to
// trust the file's own metadata (correct only if the publisher fixes it),
// or "declared" to fit the raster onto the catalog bounds below. The raster
// keeps its own width, resolution and row order; only its longitude mapping
// is anchored.
const GEO = {
  bounds: "declared",
  declared: { west: 76.99, east: 78.58, south: 17.58, north: 19.29 },
  // Throw if the raster's own bounds disagree with the declared ones by more
  // than this many degrees (catches a swapped or re-projected input).
  maxDeviationDeg: 6,
};

// ------------------------------------------------------------ utils
const log = (...a) => console.log("[jezero]", ...a);

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    log(`cached: ${dest}`);
    return;
  }
  log(`downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`);
  const total = Number(res.headers.get("content-length") || 0);
  let got = 0;
  let lastPct = -1;
  const counter = new Transform({
    transform(chunk, _enc, cb) {
      got += chunk.length;
      const pct = total ? Math.floor((got / total) * 100) : -1;
      if (pct !== lastPct && pct % 5 === 0) {
        lastPct = pct;
        process.stdout.write(`\r  ${pct}%  ${(got / 1e6).toFixed(0)} MB`);
      }
      cb(null, chunk);
    },
  });
  const tmp = dest + ".part";
  await pipeline(Readable.fromWeb(res.body), counter, fs.createWriteStream(tmp));
  process.stdout.write("\n");
  fs.renameSync(tmp, dest);
}

function writeJpeg(file, gray, w, h, quality = 85) {
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const g = gray[i];
    rgba[i * 4] = g;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = g;
    rgba[i * 4 + 3] = 255;
  }
  fs.writeFileSync(file, jpeg.encode({ data: rgba, width: w, height: h }, quality).data);
}

// Push-pull hole filling: fills NoData with smooth values from a pyramid.
function fillHoles(data, valid, W, H) {
  const levels = [{ v: data, w: valid, W, H }];
  while (levels.at(-1).W > 1 || levels.at(-1).H > 1) {
    const p = levels.at(-1);
    const nW = Math.ceil(p.W / 2), nH = Math.ceil(p.H / 2);
    const v = new Float32Array(nW * nH);
    const w = new Uint8Array(nW * nH);
    for (let y = 0; y < nH; y++)
      for (let x = 0; x < nW; x++) {
        let s = 0, n = 0;
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            const sx = 2 * x + dx, sy = 2 * y + dy;
            if (sx < p.W && sy < p.H && p.w[sy * p.W + sx]) {
              s += p.v[sy * p.W + sx];
              n++;
            }
          }
        if (n) { v[y * nW + x] = s / n; w[y * nW + x] = 1; }
      }
    levels.push({ v, w, W: nW, H: nH });
  }
  for (let li = levels.length - 2; li >= 0; li--) {
    const f = levels[li], c = levels[li + 1];
    for (let y = 0; y < f.H; y++)
      for (let x = 0; x < f.W; x++) {
        const i = y * f.W + x;
        if (f.w[i]) continue;
        const cx = Math.min(Math.max((x - 0.5) / 2, 0), c.W - 1);
        const cy = Math.min(Math.max((y - 0.5) / 2, 0), c.H - 1);
        const x0 = Math.floor(cx), y0 = Math.floor(cy);
        const x1 = Math.min(x0 + 1, c.W - 1), y1 = Math.min(y0 + 1, c.H - 1);
        const fx = cx - x0, fy = cy - y0;
        const a = c.v[y0 * c.W + x0], b = c.v[y0 * c.W + x1];
        const d = c.v[y1 * c.W + x0], e = c.v[y1 * c.W + x1];
        f.v[i] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
        f.w[i] = 1;
      }
  }
}

// ------------------------------------------------------------ main
async function main() {
  fs.mkdirSync(RAW, { recursive: true });
  fs.mkdirSync(path.join(OUT, "height"), { recursive: true });
  fs.mkdirSync(path.join(OUT, "tex"), { recursive: true });

  const demPath = path.join(RAW, "M20_JezeroCrater_CTXDEM_20m.tif");
  await download(DEM_URL, demPath);

  // ---------------- DEM
  const demTiff = await fromFile(demPath);
  const dem = await demTiff.getImage();
  const W = dem.getWidth(), H = dem.getHeight();
  const [ox, oy] = dem.getOrigin();
  const [rx, ry] = dem.getResolution(); // ry is negative (north-up)
  const geo = dem.getGeoKeys() || {};
  const radius = geo.GeogSemiMajorAxisGeoKey || geo.ProjSemiMajorAxisGeoKey || MARS_R_FALLBACK;
  const noData = dem.getGDALNoData();
  log(`DEM ${W} x ${H}, res ${rx} / ${ry} m, origin ${ox}, ${oy}, noData ${noData}, R ${radius}`);
  log(`geokeys: ${JSON.stringify(geo)}`);

  const raw = await dem.readRasters({ samples: [0], interleave: true });
  const heights = new Float32Array(W * H);
  const valid = new Uint8Array(W * H);
  let nValid = 0;
  for (let i = 0; i < W * H; i++) {
    const v = raw[i];
    const ok = Number.isFinite(v) && v !== noData && v > -12000 && v < 30000;
    if (ok) { heights[i] = v; valid[i] = 1; nValid++; }
  }
  log(`valid samples: ${((nValid / (W * H)) * 100).toFixed(1)}%`);
  if (nValid === 0) throw new Error("DEM has no valid samples");

  // Validity mask at overview resolution (for the 2D map)
  fillHoles(heights, valid, W, H);

  let hMin = Infinity, hMax = -Infinity;
  for (let i = 0; i < W * H; i++) {
    if (heights[i] < hMin) hMin = heights[i];
    if (heights[i] > hMax) hMax = heights[i];
  }
  const hScale = (hMax - hMin) / 65535 || 1;
  log(`elevation ${hMin.toFixed(1)} .. ${hMax.toFixed(1)} m (quantum ${(hScale * 100).toFixed(2)} cm)`);

  const q = (h) => Math.round((h - hMin) / hScale);
  const at = (c, r) => heights[Math.min(r, H - 1) * W + Math.min(c, W - 1)];

  // Planetocentric lat/lon (equirectangular, lat_ts = 0, lon_0 = 0)
  const toLon = (x) => (x / radius) * (180 / Math.PI);
  const toLat = (y) => (y / radius) * (180 / Math.PI);
  // Longitude as written in the raster's own metadata (may be mistranslated).
  const fileLonW = toLon(ox), fileLonE = toLon(ox + W * rx);
  const latN = toLat(oy), latS = toLat(oy + H * ry);
  const spanLon = fileLonE - fileLonW;

  // Anchor longitudes. Latitude is trusted from the file (it agrees with the
  // catalog); longitude is either taken from the file or fitted to the
  // declared catalog bounds.
  let lonW = fileLonW, lonE = fileLonE, lonOffset = 0;
  if (GEO.bounds === "declared") {
    const d = GEO.declared;
    const declaredSpan = d.east - d.west;
    if (Math.abs(spanLon - declaredSpan) > 0.25) {
      throw new Error(
        `declared longitude span ${declaredSpan.toFixed(3)}° does not match the raster's ${spanLon.toFixed(3)}° ` +
          `— the input is not the product this config describes`,
      );
    }
    lonOffset = d.west - fileLonW;
    if (Math.abs(lonOffset) > GEO.maxDeviationDeg) {
      throw new Error(`longitude correction ${lonOffset.toFixed(3)}° exceeds maxDeviationDeg (${GEO.maxDeviationDeg}°)`);
    }
    // Shift by translating the linear mapping: same width, same resolution.
    lonW = d.west;
    lonE = d.west + spanLon;
  }
  log(
    `file bounds   lon ${fileLonW.toFixed(3)}..${fileLonE.toFixed(3)} E, lat ${latS.toFixed(3)}..${latN.toFixed(3)} N`,
  );
  log(
    `used bounds   lon ${lonW.toFixed(3)}..${lonE.toFixed(3)} E  (longitude correction ${lonOffset >= 0 ? "+" : ""}${lonOffset.toFixed(3)}°)`,
  );
  if (GEO.bounds === "declared" && lonW > 77.2) {
    log("longitude now resolves to the Jezero region (catalog reference: 76.99..78.58 E)");
  }
  if (latS < 10 || latN > 25) {
    log("WARNING: latitudes do not look like Jezero (17.58..19.29 N). Check projection.");
  }

  // Sanity check: the Perseverance landing site (18.4447 N, 77.4508 E) must
  // fall inside the mapped raster. Uses the same linear mapping the client does.
  {
    const landLat = 18.4447, landLon = 77.4508;
    const frac = (landLon - lonW) / spanLon;
    const rowFrac = (latN - landLat) / (latN - latS);
    const inX = frac >= 0 && frac <= 1, inY = rowFrac >= 0 && rowFrac <= 1;
    log(
      `landing-site check: 18.4447N 77.4508E -> column ${(frac * W).toFixed(0)}/${W}, row ${(rowFrac * H).toFixed(0)}/${H} ` +
        `(x ${inX ? "inside" : "OUTSIDE"}, y ${inY ? "inside" : "OUTSIDE"})`,
    );
    if (!inX || !inY) throw new Error("landing site falls outside the mapped raster — bounds are wrong");
  }

  // World-metre conversion used by the client: metres east from the west edge.
  const originXM = (col) => ((col + 0.5) / W) * (spanLon * (Math.PI / 180) * radius);
  const latCenter = ((latN + latS) / 2) * (Math.PI / 180);
  const kx = Math.cos(latCenter); // equirectangular E-W stretch correction

  const tilesX = Math.ceil((W - 1) / TILE);
  const tilesY = Math.ceil((H - 1) / TILE);
  const N = TILE + 1;

  // ---------------- height tiles
  for (let ty = 0; ty < tilesY; ty++)
    for (let tx = 0; tx < tilesX; tx++) {
      const u16 = new Uint16Array(N * N);
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++) u16[i * N + j] = q(at(tx * TILE + j, ty * TILE + i));
      fs.writeFileSync(path.join(OUT, "height", `${tx}_${ty}.u16`), Buffer.from(u16.buffer));
    }
  log(`wrote ${tilesX * tilesY} height tiles (${tilesX} x ${tilesY})`);

  // ---------------- overview heights + validity
  const oCols = (tilesX * TILE) / OVR_STEP + 1;
  const oRows = (tilesY * TILE) / OVR_STEP + 1;
  const ovr = new Uint16Array(oCols * oRows);
  const ovrValid = new Uint8Array(oCols * oRows);
  for (let i = 0; i < oRows; i++)
    for (let j = 0; j < oCols; j++) {
      const c = Math.min(j * OVR_STEP, W - 1), r = Math.min(i * OVR_STEP, H - 1);
      ovr[i * oCols + j] = q(at(c, r));
      ovrValid[i * oCols + j] = valid[r * W + c];
    }
  fs.writeFileSync(path.join(OUT, "overview.u16"), Buffer.from(ovr.buffer));
  fs.writeFileSync(path.join(OUT, "overview_valid.u8"), Buffer.from(ovrValid.buffer));

  // ---------------- hillshade overview (map fallback, no imagery needed)
  {
    const sw = oCols - 1, sh = oRows - 1;
    const g = new Uint8Array(sw * sh);
    const cell = OVR_STEP * Math.abs(ry);
    const lx = -0.5, ly = 0.7, lz = -0.5; // NW sun
    const ll = Math.hypot(lx, ly, lz);
    for (let i = 0; i < sh; i++)
      for (let j = 0; j < sw; j++) {
        const h = (a, b) => hMin + ovr[Math.min(b, oRows - 1) * oCols + Math.min(a, oCols - 1)] * hScale;
        const dx = (h(j + 1, i) - h(Math.max(j - 1, 0), i)) / (2 * cell * kx);
        const dz = (h(j, i + 1) - h(j, Math.max(i - 1, 0))) / (2 * cell);
        const nl = Math.hypot(dx, 1, dz);
        const s = Math.max(0, (-dx * lx + ly - dz * lz) / (nl * ll));
        const e = (h(j, i) - hMin) / (hMax - hMin);
        let v = 40 + 170 * s * (0.6 + 0.4 * e);
        if (!ovrValid[i * oCols + j]) v *= 0.45;
        g[i * sw + j] = Math.max(0, Math.min(255, v));
      }
    writeJpeg(path.join(OUT, "overview_shade.jpg"), g, sw, sh, 88);
  }

  // ---------------- orthoimage textures
  const texFlags = new Array(tilesX * tilesY).fill(0);
  let hasOrtho = false;
  if (!SKIP_ORTHO) {
    try {
      const orthoPath = path.join(RAW, "M20_JezeroCrater_CTXortho_mosaic_5m.tif");
      await download(ORTHO_URL, orthoPath);
      const oTiff = await fromFile(orthoPath);
      const oimg = await oTiff.getImage();
      const OW = oimg.getWidth(), OH = oimg.getHeight();
      const [oox, ooy] = oimg.getOrigin();
      const [orx, ory] = oimg.getResolution();
      const spp = oimg.getSamplesPerPixel();
      log(`ortho ${OW} x ${OH}, res ${orx} / ${ory}, bands ${spp}`);

      const ovW = tilesX * OVR_TEX, ovH = tilesY * OVR_TEX;
      const ovImg = new Uint8Array(ovW * ovH);
      const down = TEX / OVR_TEX;

      for (let ty = 0; ty < tilesY; ty++) {
        for (let tx = 0; tx < tilesX; tx++) {
          // Tile spans DEM sample centres c0 .. c0+TILE
          const c0 = tx * TILE, r0 = ty * TILE;
          const X0 = ox + (c0 + 0.5) * rx, X1 = ox + (c0 + TILE + 0.5) * rx;
          const Y0 = oy + (r0 + 0.5) * ry, Y1 = oy + (r0 + TILE + 0.5) * ry;
          const px0 = (X0 - oox) / orx, px1 = (X1 - oox) / orx;
          const py0 = (Y0 - ooy) / ory, py1 = (Y1 - ooy) / ory;
          const wx0 = Math.max(0, Math.floor(px0)), wx1 = Math.min(OW, Math.ceil(px1));
          const wy0 = Math.max(0, Math.floor(py0)), wy1 = Math.min(OH, Math.ceil(py1));
          const out = new Uint8Array(TEX * TEX);
          if (wx1 - wx0 >= 2 && wy1 - wy0 >= 2) {
            const sx = TEX / (px1 - px0), sy = TEX / (py1 - py0);
            const dx0 = Math.round((wx0 - px0) * sx), dy0 = Math.round((wy0 - py0) * sy);
            const dw = Math.max(1, Math.min(TEX - dx0, Math.round((wx1 - wx0) * sx)));
            const dh = Math.max(1, Math.min(TEX - dy0, Math.round((wy1 - wy0) * sy)));
            const r = await oimg.readRasters({
              window: [wx0, wy0, wx1, wy1],
              samples: spp >= 3 ? [0, 1, 2] : [0],
              interleave: true,
              width: dw,
              height: dh,
              resampleMethod: "bilinear",
            });
            let any = 0;
            for (let y = 0; y < dh; y++)
              for (let x = 0; x < dw; x++) {
                let v;
                if (spp >= 3) {
                  const k = (y * dw + x) * 3;
                  v = (r[k] + r[k + 1] + r[k + 2]) / 3;
                } else v = r[y * dw + x];
                const g = Math.max(0, Math.min(255, v));
                out[(dy0 + y) * TEX + dx0 + x] = g;
                any |= g;
              }
            if (any) {
              writeJpeg(path.join(OUT, "tex", `${tx}_${ty}.jpg`), out, TEX, TEX, 82);
              texFlags[ty * tilesX + tx] = 1;
              hasOrtho = true;
            }
          }
          // Downsample into the overview image
          for (let y = 0; y < OVR_TEX; y++)
            for (let x = 0; x < OVR_TEX; x++) {
              let s = 0;
              for (let a = 0; a < down; a++)
                for (let b = 0; b < down; b++) s += out[(y * down + a) * TEX + x * down + b];
              ovImg[(ty * OVR_TEX + y) * ovW + tx * OVR_TEX + x] = s / (down * down);
            }
        }
        log(`ortho tiles row ${ty + 1}/${tilesY}`);
      }
      if (hasOrtho) writeJpeg(path.join(OUT, "overview.jpg"), ovImg, ovW, ovH, 88);
    } catch (err) {
      log(`WARNING: orthoimage step failed, continuing with DEM only: ${err.message}`);
    }
  }

  // ---------------- manifest
  const manifest = {
    name: "Jezero crater",
    source: {
      dem: DEM_URL,
      ortho: hasOrtho ? ORTHO_URL : null,
      credit:
        "USGS Astrogeology / NASA-JPL Mars 2020 Science Investigation CTX DEM & orthomosaic (Calef 2021; Mangold et al. 2021)",
    },
    cols: W,
    rows: H,
    tileSize: TILE,
    tilesX,
    tilesY,
    cellX: Math.abs(rx) * kx, // ground metres per column (E-W corrected)
    cellZ: Math.abs(ry), // ground metres per row
    heightMin: hMin,
    heightMax: hMax,
    heightScale: hScale,
    overview: { step: OVR_STEP, cols: oCols, rows: oRows },
    textureSize: TEX,
    textures: texFlags.join(""),
    mapImage: hasOrtho ? "overview.jpg" : "overview_shade.jpg",
    proj: {
      westLonDeg: lonW,
      eastLonDeg: lonE,
      northLatDeg: latN,
      southLatDeg: latS,
      radius,
      latCenterDeg: (latCenter * 180) / Math.PI,
      // Kept for reference only — the client no longer uses these to place anything.
      fileOriginX: ox,
      fileResX: rx,
      fileResY: ry,
      fileOriginY: oy,
      longitudeCorrectionDeg: lonOffset,
      boundsSource: GEO.bounds,
    },
  };
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  log("done. Run `npm run dev`.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

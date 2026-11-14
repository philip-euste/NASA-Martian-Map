// frontend/src/services/providers/marsDem.ts
// Client for the FastAPI Mars DEM router (backend/terrain_dem.py) with
// request timeouts, response caching, cooldown protection, and automatic
// fallback to the verified local USGS/NASA Mars 2020 Jezero CTX DEM
// (/jezero/manifest.json + /jezero/overview.u16) when the backend or remote
// HiRISE COG service is unavailable.

import type { Coordinates } from "../../types";
import { reportBackendStatus } from "../connectionStatus";

const DEFAULT_API_BASE = "http://127.0.0.1:8000";
const REQUEST_TIMEOUT_MS = 7000;
const BACKEND_FAILURE_COOLDOWN_MS = 15000;

function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return (configured ?? DEFAULT_API_BASE).replace(/\/+$/, "");
}

export interface DemInfo {
  readonly product_id: string;
  readonly width: number;
  readonly height: number;
  readonly bands: number;
  readonly data_type: string;
  readonly crs: string;
  readonly resolution: readonly [number, number];
  readonly nodata: number | null;
  readonly elevation_unit: string;
  readonly vertical_reference: string;
  readonly access: string;
}

export interface DemElevation {
  readonly longitude: number;
  readonly latitude: number;
  readonly projected_x: number;
  readonly projected_y: number;
  readonly row: number;
  readonly column: number;
  readonly elevation: number;
  readonly unit: string;
  readonly product_id: string;
  readonly isFallback?: boolean;
}

export interface DemElevationWindow {
  readonly center: {
    readonly longitude: number;
    readonly latitude: number;
    readonly projected_x: number;
    readonly projected_y: number;
  };
  readonly dimensions: {
    readonly width: number;
    readonly height: number;
  };
  readonly pixel_origin: {
    readonly row: number;
    readonly column: number;
  };
  readonly resolution: readonly [number, number];
  readonly elevations: readonly (readonly (number | null)[])[];
  readonly unit: string;
  readonly product_id: string;
  readonly isFallback?: boolean;
}

interface LocalJezeroProjection {
  readonly name?: string;
  readonly westLonDeg: number;
  readonly eastLonDeg: number;
  readonly southLatDeg: number;
  readonly northLatDeg: number;
}

interface LocalJezeroManifest {
  readonly cols: number;
  readonly rows: number;
  readonly cellX: number;
  readonly cellZ: number;
  readonly heightMin: number;
  readonly heightMax: number;
  readonly heightScale: number;
  readonly proj?: LocalJezeroProjection;
  readonly projection?: LocalJezeroProjection;
  readonly overview: {
    readonly step: number;
    readonly cols: number;
    readonly rows: number;
  };
}

interface LocalJezeroDemAsset {
  readonly manifest: LocalJezeroManifest;
  readonly overview: Uint16Array;
}

let cachedLocalDemPromise: Promise<LocalJezeroDemAsset | null> | null = null;
let backendOfflineUntil = 0;
const elevationCache = new Map<string, DemElevation>();

function getCoordinateCacheKey(coords: Coordinates): string {
  return `${coords.latitude.toFixed(5)}:${coords.longitude.toFixed(5)}`;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loadLocalJezeroDem(): Promise<LocalJezeroDemAsset | null> {
  if (cachedLocalDemPromise) {
    return cachedLocalDemPromise;
  }

  cachedLocalDemPromise = (async () => {
    try {
      if (typeof fetch === "function") {
        const [manifestRes, overviewRes] = await Promise.all([
          fetchWithTimeout("/jezero/manifest.json", 5000),
          fetchWithTimeout("/jezero/overview.u16", 5000),
        ]);
        if (manifestRes.ok && overviewRes.ok) {
          const manifest = (await manifestRes.json()) as LocalJezeroManifest;
          const buffer = await overviewRes.arrayBuffer();
          return {
            manifest,
            overview: new Uint16Array(buffer),
          };
        }
      }
    } catch {
      // Ignore fallback load failure
    }

    cachedLocalDemPromise = null;
    return null;
  })();

  return cachedLocalDemPromise;
}

function getManifestProj(manifest: LocalJezeroManifest): LocalJezeroProjection {
  return (
    manifest.proj ??
    manifest.projection ?? {
      name: "Equirectangular Mars 2000",
      westLonDeg: 76.99,
      eastLonDeg: 78.49350830495523,
      southLatDeg: 17.580519910544755,
      northLatDeg: 19.29018700686615,
    }
  );
}

function isWithinLocalManifest(
  manifest: LocalJezeroManifest,
  coords: Coordinates
): boolean {
  const { westLonDeg, eastLonDeg, southLatDeg, northLatDeg } =
    getManifestProj(manifest);
  return (
    coords.longitude >= westLonDeg &&
    coords.longitude <= eastLonDeg &&
    coords.latitude >= southLatDeg &&
    coords.latitude <= northLatDeg
  );
}

function sampleLocalJezeroElevation(
  asset: LocalJezeroDemAsset,
  coords: Coordinates
): DemElevation | null {
  const { manifest, overview } = asset;
  if (!isWithinLocalManifest(manifest, coords)) {
    return null;
  }

  const { westLonDeg, eastLonDeg, southLatDeg, northLatDeg } =
    getManifestProj(manifest);
  const u = (coords.longitude - westLonDeg) / (eastLonDeg - westLonDeg);
  const v = (northLatDeg - coords.latitude) / (northLatDeg - southLatDeg);

  const fullCol = u * (manifest.cols - 1);
  const fullRow = v * (manifest.rows - 1);

  const ovCol = Math.min(
    Math.max(fullCol / manifest.overview.step, 0),
    manifest.overview.cols - 1
  );
  const ovRow = Math.min(
    Math.max(fullRow / manifest.overview.step, 0),
    manifest.overview.rows - 1
  );

  const c0 = Math.floor(ovCol);
  const r0 = Math.floor(ovRow);
  const c1 = Math.min(c0 + 1, manifest.overview.cols - 1);
  const r1 = Math.min(r0 + 1, manifest.overview.rows - 1);
  const fx = ovCol - c0;
  const fy = ovRow - r0;

  const stride = manifest.overview.cols;
  const q00 = overview[r0 * stride + c0] ?? 0;
  const q10 = overview[r0 * stride + c1] ?? q00;
  const q01 = overview[r1 * stride + c0] ?? q00;
  const q11 = overview[r1 * stride + c1] ?? q00;

  const qTop = q00 + (q10 - q00) * fx;
  const qBottom = q01 + (q11 - q01) * fx;
  const q = qTop + (qBottom - qTop) * fy;

  const elevationMeters = manifest.heightMin + q * manifest.heightScale;

  return {
    longitude: coords.longitude,
    latitude: coords.latitude,
    projected_x: Number((fullCol * manifest.cellX).toFixed(2)),
    projected_y: Number((fullRow * manifest.cellZ).toFixed(2)),
    row: Math.round(fullRow),
    column: Math.round(fullCol),
    elevation: Number(elevationMeters.toFixed(2)),
    unit: "metres",
    product_id: "M20_JezeroCrater_CTXDEM_20m (Local Fallback)",
    isFallback: true,
  };
}

class BackendUnavailableError extends Error {
  readonly statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "BackendUnavailableError";
    this.statusCode = statusCode;
  }
}

async function fetchJson<T>(
  path: string,
  options?: { forceRetry?: boolean }
): Promise<T> {
  if (!options?.forceRetry && Date.now() < backendOfflineUntil) {
    throw new BackendUnavailableError(
      "Backend DEM service is temporarily unreachable (cooldown active)."
    );
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(`${getApiBaseUrl()}${path}`);
  } catch (err: unknown) {
    backendOfflineUntil = Date.now() + BACKEND_FAILURE_COOLDOWN_MS;
    const isTimeout =
      err instanceof Error &&
      (err.name === "AbortError" ||
        err.message.toLowerCase().includes("abort") ||
        err.message.toLowerCase().includes("timeout"));
    throw new BackendUnavailableError(
      isTimeout
        ? "The backend elevation service timed out."
        : "Cannot reach the backend DEM server."
    );
  }

  if (!response.ok) {
    let detail = `DEM request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body?.detail) {
        detail = body.detail;
      }
    } catch {
      // keep default message
    }

    if (response.status >= 500) {
      backendOfflineUntil = Date.now() + BACKEND_FAILURE_COOLDOWN_MS;
      throw new BackendUnavailableError(detail, response.status);
    }

    throw new Error(detail);
  }

  backendOfflineUntil = 0;
  reportBackendStatus("online", null);
  return (await response.json()) as T;
}

export class MarsDemProvider {
  resetBackendCooldown(): void {
    backendOfflineUntil = 0;
  }

  clearCache(): void {
    elevationCache.clear();
  }

  async getInfo(options?: { forceRetry?: boolean }): Promise<DemInfo> {
    try {
      return await fetchJson<DemInfo>("/api/terrain/dem/info", options);
    } catch (err: unknown) {
      const localAsset = await loadLocalJezeroDem();
      if (localAsset) {
        reportBackendStatus(
          "fallback",
          "Using local Jezero CTX DEM (backend DEM service offline)"
        );
        return {
          product_id: "M20_JezeroCrater_CTXDEM_20m (Local Fallback)",
          width: localAsset.manifest.cols,
          height: localAsset.manifest.rows,
          bands: 1,
          data_type: "uint16 (quantized elevation)",
          crs: getManifestProj(localAsset.manifest).name ?? "Equirectangular Mars 2000",
          resolution: [localAsset.manifest.cellX, localAsset.manifest.cellZ],
          nodata: null,
          elevation_unit: "metres",
          vertical_reference: "Mars 2000",
          access: "Local Verified Jezero CTX DEM Fallback",
        };
      }
      reportBackendStatus(
        "offline",
        "Backend DEM service is currently unavailable"
      );
      throw err instanceof Error
        ? err
        : new Error("Unable to retrieve DEM metadata.");
    }
  }

  async getElevation(
    coordinates: Coordinates,
    options?: { forceRetry?: boolean }
  ): Promise<DemElevation> {
    const cacheKey = getCoordinateCacheKey(coordinates);
    if (!options?.forceRetry) {
      const cached = elevationCache.get(cacheKey);
      if (cached && (!cached.isFallback || Date.now() < backendOfflineUntil)) {
        return cached;
      }
    }

    const params = new URLSearchParams({
      longitude: String(coordinates.longitude),
      latitude: String(coordinates.latitude),
    });

    let backendErr: unknown = null;
    try {
      const primary = await fetchJson<DemElevation>(
        `/api/terrain/dem/elevation?${params.toString()}`,
        options
      );
      elevationCache.set(cacheKey, primary);
      return primary;
    } catch (err: unknown) {
      backendErr = err;
    }

    // Attempt local verified Jezero CTX DEM fallback
    const localAsset = await loadLocalJezeroDem();
    if (localAsset) {
      const fallbackSample = sampleLocalJezeroElevation(
        localAsset,
        coordinates
      );
      if (fallbackSample) {
        if (backendErr instanceof BackendUnavailableError) {
          reportBackendStatus(
            "fallback",
            "Using local Jezero CTX DEM (backend DEM service offline)"
          );
        }
        elevationCache.set(cacheKey, fallbackSample);
        return fallbackSample;
      }
    }

    if (backendErr instanceof BackendUnavailableError) {
      reportBackendStatus(
        "offline",
        "Backend DEM service is offline; coordinate outside local Jezero DEM"
      );
      throw new Error(
        "Elevation data unavailable: the backend DEM service is offline and this location is outside the local Jezero Crater DEM."
      );
    }

    throw new Error(
      "This location is outside available high-resolution DEM coverage (Jezero Crater region: 17.58°N–19.29°N, 76.99°E–78.49°E)."
    );
  }

  async getElevationWindow(
    coordinates: Coordinates,
    width = 32,
    height = 32,
    options?: { forceRetry?: boolean }
  ): Promise<DemElevationWindow> {
    const params = new URLSearchParams({
      longitude: String(coordinates.longitude),
      latitude: String(coordinates.latitude),
      width: String(width),
      height: String(height),
    });

    try {
      return await fetchJson<DemElevationWindow>(
        `/api/terrain/dem/window?${params.toString()}`,
        options
      );
    } catch (err: unknown) {
      const localAsset = await loadLocalJezeroDem();
      if (localAsset && isWithinLocalManifest(localAsset.manifest, coordinates)) {
        const centerSample = sampleLocalJezeroElevation(localAsset, coordinates);
        if (centerSample) {
          const { manifest } = localAsset;
          const proj = getManifestProj(manifest);
          const lonStep =
            (proj.eastLonDeg - proj.westLonDeg) /
            Math.max(1, manifest.cols - 1);
          const latStep =
            (proj.northLatDeg - proj.southLatDeg) /
            Math.max(1, manifest.rows - 1);

          const halfW = Math.floor(width / 2);
          const halfH = Math.floor(height / 2);
          const elevations: (number | null)[][] = [];

          for (let r = 0; r < height; r++) {
            const rowValues: (number | null)[] = [];
            const lat = coordinates.latitude + (halfH - r) * latStep;
            for (let c = 0; c < width; c++) {
              const lon = coordinates.longitude + (c - halfW) * lonStep;
              const s = sampleLocalJezeroElevation(localAsset, {
                latitude: lat,
                longitude: lon,
              });
              rowValues.push(s ? s.elevation : null);
            }
            elevations.push(rowValues);
          }

          if (err instanceof BackendUnavailableError) {
            reportBackendStatus(
              "fallback",
              "Using local Jezero CTX DEM (backend DEM service offline)"
            );
          }

          return {
            center: {
              longitude: coordinates.longitude,
              latitude: coordinates.latitude,
              projected_x: centerSample.projected_x,
              projected_y: centerSample.projected_y,
            },
            dimensions: { width, height },
            pixel_origin: {
              row: Math.max(0, centerSample.row - halfH),
              column: Math.max(0, centerSample.column - halfW),
            },
            resolution: [manifest.cellX, manifest.cellZ],
            elevations,
            unit: "metres",
            product_id: "M20_JezeroCrater_CTXDEM_20m (Local Fallback)",
            isFallback: true,
          };
        }
      }

      if (err instanceof BackendUnavailableError) {
        reportBackendStatus(
          "offline",
          "Backend DEM service is currently unavailable"
        );
        throw new Error(
          "Terrain window unavailable: backend DEM service is offline and this coordinate is outside local Jezero Crater DEM coverage."
        );
      }

      throw new Error(
        "Requested terrain window lies outside available DEM coverage."
      );
    }
  }
}

export const marsDemProvider = new MarsDemProvider();

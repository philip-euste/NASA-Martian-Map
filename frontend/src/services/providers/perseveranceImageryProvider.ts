// frontend/src/services/providers/perseveranceImageryProvider.ts
// Phase 2, Task T-2.3: Perseverance Surface Imagery Provider (Catalog #3).
//
// Official Source:
// NASA/JPL-Caltech Mars 2020 Perseverance Raw Images Service
// Endpoint: https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json
//
// Supported Cameras:
// - Mastcam-Z (`MCZ_LEFT`, `MCZ_RIGHT`)
// - Navigation Camera (`NAVCAM_LEFT`, `NAVCAM_RIGHT`)
// - SuperCam Remote Micro-Imager (`SUPERCAM_RMI`)
//
// Retrieval Modes:
// 1. `live_backend`: FastAPI backend `/api/rover/perseverance/images`
// 2. `live_nasa_api`: Direct query to NASA Mars 2020 Raw Images JSON feed
// 3. `local_verified_archive`: Locally cached NASA raw image archive
//    (`/data/perseverance_surface_imagery.json`, 108 verified Full-frame images
//    across Sol 1, Sol 420, Sol 2024, and Sol 2031).

import type {
  SurfaceCameraGroup,
  SurfaceCameraInstrument,
  SurfaceImageryCatalogItem,
} from "../../data/evidenceDatasets";
import {
  getConnectionStatus,
  reportBackendStatus,
} from "../connectionStatus";

export type SurfaceCameraFilter =
  | "ALL"
  | "MASTCAM_Z"
  | "MCZ_LEFT"
  | "MCZ_RIGHT"
  | "NAVCAM"
  | "NAVCAM_LEFT"
  | "NAVCAM_RIGHT"
  | "SUPERCAM_RMI";

export type ImageryRetrievalMode =
  | "live_backend"
  | "live_nasa_api"
  | "local_verified_archive";

export interface SurfaceImageryQueryOptions {
  camera?: SurfaceCameraFilter;
  sol?: number | "ALL";
  page?: number;
  perPage?: number;
  preferLiveNasaApi?: boolean;
  forceRetry?: boolean;
}

export interface SurfaceImageryPageResult {
  items: SurfaceImageryCatalogItem[];
  totalMatching: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasMore: boolean;
  availableSols: number[];
  summaryByCamera: Record<string, number>;
  retrievalMode: ImageryRetrievalMode;
  retrievalLabel: string;
  sourceAttribution: string;
}

export const CAMERA_FILTER_OPTIONS: {
  value: SurfaceCameraFilter;
  label: string;
  shortLabel: string;
  description: string;
}[] = [
  {
    value: "ALL",
    label: "All Supported Rover Cameras",
    shortLabel: "All Cameras",
    description:
      "Mastcam-Z (Left/Right), Navcam (Left/Right), and SuperCam RMI.",
  },
  {
    value: "MASTCAM_Z",
    label: "Mastcam-Z Stereo Pair (MCZ_LEFT + MCZ_RIGHT)",
    shortLabel: "Mastcam-Z (All)",
    description:
      "Mast-mounted zoomable panoramic & multispectral stereo cameras.",
  },
  {
    value: "MCZ_LEFT",
    label: "Mastcam-Z — Left Eye (MCZ_LEFT)",
    shortLabel: "MCZ Left",
    description: "Left stereo channel of Mastcam-Z on the Remote Sensing Mast.",
  },
  {
    value: "MCZ_RIGHT",
    label: "Mastcam-Z — Right Eye (MCZ_RIGHT)",
    shortLabel: "MCZ Right",
    description:
      "Right stereo channel of Mastcam-Z on the Remote Sensing Mast.",
  },
  {
    value: "NAVCAM",
    label: "Navigation Cameras (NAVCAM_LEFT + NAVCAM_RIGHT)",
    shortLabel: "Navcam (All)",
    description:
      "Wide-field stereo engineering cameras used for terrain hazard assessment and rover traverse planning.",
  },
  {
    value: "NAVCAM_LEFT",
    label: "Navigation Camera — Left (NAVCAM_LEFT)",
    shortLabel: "Navcam Left",
    description: "Left wide-field Navigation Camera on the rover mast.",
  },
  {
    value: "NAVCAM_RIGHT",
    label: "Navigation Camera — Right (NAVCAM_RIGHT)",
    shortLabel: "Navcam Right",
    description: "Right wide-field Navigation Camera on the rover mast.",
  },
  {
    value: "SUPERCAM_RMI",
    label: "SuperCam Remote Micro-Imager (SUPERCAM_RMI)",
    shortLabel: "SuperCam RMI",
    description:
      "High-resolution telescopic context micro-imager co-aligned with SuperCam LIBS/Raman/VISIR spectroscopy.",
  },
];

const SUPPORTED_INSTRUMENTS = new Set<string>([
  "MCZ_LEFT",
  "MCZ_RIGHT",
  "NAVCAM_LEFT",
  "NAVCAM_RIGHT",
  "SUPERCAM_RMI",
]);

const CAMERA_GROUP_MAP: Record<string, SurfaceCameraGroup> = {
  MCZ_LEFT: "MASTCAM_Z",
  MCZ_RIGHT: "MASTCAM_Z",
  NAVCAM_LEFT: "NAVCAM",
  NAVCAM_RIGHT: "NAVCAM",
  SUPERCAM_RMI: "SUPERCAM_RMI",
};

const CAMERA_DISPLAY_NAMES: Record<string, string> = {
  MCZ_LEFT: "Mastcam-Z — Left Eye (Zoomable Panoramic Multispectral Camera)",
  MCZ_RIGHT: "Mastcam-Z — Right Eye (Zoomable Panoramic Multispectral Camera)",
  NAVCAM_LEFT: "Navigation Camera — Left (Engineering Stereo Navcam)",
  NAVCAM_RIGHT: "Navigation Camera — Right (Engineering Stereo Navcam)",
  SUPERCAM_RMI: "SuperCam Remote Micro-Imager (RMI Telephoto Context Camera)",
};

const API_BASE_URL = "http://127.0.0.1:8000";
const NASA_RAW_FEED_URL =
  "https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json";
const LOCAL_ARCHIVE_URL = "/data/perseverance_surface_imagery.json";
const BACKEND_TIMEOUT_MS = 3500;
const NASA_API_TIMEOUT_MS = 8000;
const BACKEND_COOLDOWN_MS = 15000;

let lastBackendFailureAt = 0;

interface LocalImageryArchive {
  source: string;
  endpoint: string;
  generatedAt: string;
  totalCatalogued: number;
  supportedCameras: string[];
  solsIncluded: number[];
  summaryByCamera: Record<string, number>;
  summaryBySol: Record<string, number>;
  items: SurfaceImageryCatalogItem[];
}

let localArchivePromise: Promise<LocalImageryArchive> | null = null;
const liveNasaSolCache = new Map<number, SurfaceImageryCatalogItem[]>();

async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeNasaRawImageRecord(
  raw: Record<string, unknown>
): SurfaceImageryCatalogItem | null {
  const camObj = raw.camera as Record<string, unknown> | undefined;
  const instrument =
    typeof camObj?.instrument === "string" ? camObj.instrument : "";
  if (!SUPPORTED_INSTRUMENTS.has(instrument)) return null;

  const sampleType =
    typeof raw.sample_type === "string" ? raw.sample_type : "Full";
  if (sampleType !== "Full") return null;

  const imageid = typeof raw.imageid === "string" ? raw.imageid : "";
  const sol = typeof raw.sol === "number" ? raw.sol : NaN;
  if (!imageid || !Number.isFinite(sol)) return null;

  const imageFiles =
    (raw.image_files as Record<string, string | undefined>) ?? {};
  const imageUrl =
    imageFiles.large || imageFiles.medium || imageFiles.full_res || "";
  const thumbnailUrl = imageFiles.small || imageFiles.medium || imageUrl;
  if (!imageUrl) return null;

  const ext = (raw.extended as Record<string, string | undefined>) ?? {};

  return {
    id: imageid,
    catalogRole: "surface_imagery",
    mission: "Mars 2020 Perseverance Rover",
    roverName: "Perseverance",
    instrument: instrument as SurfaceCameraInstrument,
    cameraGroup: CAMERA_GROUP_MAP[instrument],
    instrumentLabel: CAMERA_DISPLAY_NAMES[instrument] ?? instrument,
    sol,
    dateTakenUtc:
      typeof raw.date_taken_utc === "string" ? raw.date_taken_utc : null,
    dateTakenMars:
      typeof raw.date_taken_mars === "string" ? raw.date_taken_mars : null,
    site: typeof raw.site === "number" ? raw.site : null,
    drive:
      raw.drive !== undefined && raw.drive !== null ? String(raw.drive) : null,
    xyzLocalMeters: ext.xyz && ext.xyz !== "UNK" ? ext.xyz : null,
    mastAzimuthDeg:
      ext.mastAz && ext.mastAz !== "UNK" ? Number(ext.mastAz) : null,
    mastElevationDeg:
      ext.mastEl && ext.mastEl !== "UNK" ? Number(ext.mastEl) : null,
    sclk: ext.sclk ?? null,
    dimensions: ext.dimension ?? null,
    sampleType,
    filterName:
      typeof camObj?.filter_name === "string" && camObj.filter_name !== "UNK"
        ? camObj.filter_name
        : null,
    cameraModelType:
      typeof camObj?.camera_model_type === "string"
        ? camObj.camera_model_type
        : null,
    coordinates: undefined,
    coordinateStatusNote:
      "Planetocentric lat/lon not embedded in NASA raw EDR image metadata; rover localization recorded as Site/Drive and local XYZ frame.",
    title:
      typeof raw.title === "string" && raw.title.trim()
        ? raw.title
        : `Mars Perseverance Sol ${sol}: ${instrument}`,
    caption:
      typeof raw.caption === "string"
        ? raw.caption.replace(/\s+/g, " ").trim()
        : "",
    credit:
      typeof raw.credit === "string" && raw.credit.trim()
        ? raw.credit
        : "NASA/JPL-Caltech",
    imageUrl,
    thumbnailUrl,
    fullResUrl: imageFiles.full_res || imageUrl,
    sourceUrl:
      typeof raw.link === "string" && raw.link.trim()
        ? raw.link
        : `https://mars.nasa.gov/mars2020/multimedia/raw-images/${imageid}`,
    jsonApiUrl:
      typeof raw.json_link === "string" && raw.json_link.trim()
        ? raw.json_link
        : `${NASA_RAW_FEED_URL}&id=${imageid}`,
  };
}

async function loadLocalImageryArchive(): Promise<LocalImageryArchive> {
  if (!localArchivePromise) {
    localArchivePromise = (async () => {
      const response = await fetch(LOCAL_ARCHIVE_URL);
      if (!response.ok) {
        throw new Error(
          `Local Perseverance surface imagery archive unavailable (HTTP ${response.status}).`
        );
      }
      return (await response.json()) as LocalImageryArchive;
    })();
  }
  try {
    return await localArchivePromise;
  } catch (err) {
    localArchivePromise = null;
    throw err;
  }
}

function matchesCameraFilter(
  item: SurfaceImageryCatalogItem,
  camera: SurfaceCameraFilter
): boolean {
  if (!camera || camera === "ALL") return true;
  return item.instrument === camera || item.cameraGroup === camera;
}

export const perseveranceImageryProvider = {
  resetCooldown(): void {
    lastBackendFailureAt = 0;
  },

  clearCache(): void {
    localArchivePromise = null;
    liveNasaSolCache.clear();
  },

  async queryImages(
    options?: SurfaceImageryQueryOptions
  ): Promise<SurfaceImageryPageResult> {
    const camera = options?.camera ?? "ALL";
    const sol = options?.sol ?? "ALL";
    const page = Math.max(1, options?.page ?? 1);
    const perPage = Math.max(1, Math.min(48, options?.perPage ?? 9));

    if (options?.forceRetry) {
      lastBackendFailureAt = 0;
    }

    const networkOnline = getConnectionStatus().networkOnline;

    // 1. Optional live query directly to NASA's Mars 2020 Raw Images JSON service
    // when user requests a custom Sol or explicitly requests live NASA API fetch.
    if (
      networkOnline &&
      options?.preferLiveNasaApi &&
      typeof sol === "number" &&
      sol >= 0
    ) {
      try {
        let solItems = liveNasaSolCache.get(sol);
        if (!solItems || options.forceRetry) {
          const url = `${NASA_RAW_FEED_URL}&num=60&sol=${encodeURIComponent(
            String(sol)
          )}`;
          const res = await fetchWithTimeout(url, NASA_API_TIMEOUT_MS);
          if (res.ok) {
            const rawData = (await res.json()) as {
              images?: Record<string, unknown>[];
            };
            const parsed: SurfaceImageryCatalogItem[] = [];
            for (const rawImg of rawData.images ?? []) {
              const norm = normalizeNasaRawImageRecord(rawImg);
              if (norm) parsed.push(norm);
            }
            solItems = parsed;
            liveNasaSolCache.set(sol, parsed);
          }
        }

        if (solItems && solItems.length > 0) {
          const filtered = solItems.filter((item) =>
            matchesCameraFilter(item, camera)
          );
          const totalMatching = filtered.length;
          const totalPages = Math.max(1, Math.ceil(totalMatching / perPage));
          const safePage = Math.min(page, totalPages);
          const offset = (safePage - 1) * perPage;
          const paged = filtered.slice(offset, offset + perPage);

          const summaryByCamera: Record<string, number> = {};
          for (const item of solItems) {
            summaryByCamera[item.instrument] =
              (summaryByCamera[item.instrument] || 0) + 1;
          }

          return {
            items: paged,
            totalMatching,
            page: safePage,
            perPage,
            totalPages,
            hasMore: offset + paged.length < totalMatching,
            availableSols: [sol, 1, 420, 2024, 2031].filter(
              (v, i, a) => a.indexOf(v) === i
            ),
            summaryByCamera,
            retrievalMode: "live_nasa_api",
            retrievalLabel: `Live NASA Mars 2020 Raw Images Service (Sol ${sol} · mars.nasa.gov)`,
            sourceAttribution:
              "NASA/JPL-Caltech / ASU (Mastcam-Z) / LANL-CNES-IRAP (SuperCam)",
          };
        }
      } catch {
        // Fall through to backend or local verified archive
      }
    }

    // 2. Try FastAPI backend `/api/rover/perseverance/images` if online and not in cooldown
    const now = Date.now();
    const withinCooldown =
      lastBackendFailureAt > 0 &&
      now - lastBackendFailureAt < BACKEND_COOLDOWN_MS;

    if (networkOnline && !withinCooldown) {
      try {
        const params = new URLSearchParams({
          page: String(page),
          per_page: String(perPage),
        });
        if (camera !== "ALL") params.set("camera", camera);
        if (typeof sol === "number") params.set("sol", String(sol));

        const res = await fetchWithTimeout(
          `${API_BASE_URL}/api/rover/perseverance/images?${params.toString()}`,
          BACKEND_TIMEOUT_MS
        );
        if (res.ok) {
          const data = (await res.json()) as {
            source: string;
            total_matching: number;
            page: number;
            per_page: number;
            has_more: boolean;
            sols_included: number[];
            items: SurfaceImageryCatalogItem[];
          };
          reportBackendStatus("online", null);
          const totalMatching = data.total_matching ?? data.items.length;
          const totalPages = Math.max(1, Math.ceil(totalMatching / perPage));
          return {
            items: data.items,
            totalMatching,
            page: data.page,
            perPage: data.per_page,
            totalPages,
            hasMore: data.has_more,
            availableSols: data.sols_included ?? [1, 420, 2024, 2031],
            summaryByCamera: {},
            retrievalMode: "live_backend",
            retrievalLabel:
              "Live Backend API (/api/rover/perseverance/images · Verified NASA Archive)",
            sourceAttribution:
              "NASA/JPL-Caltech / ASU (Mastcam-Z) / LANL-CNES-IRAP (SuperCam)",
          };
        }
      } catch {
        lastBackendFailureAt = Date.now();
      }
    }

    // 3. Fallback to locally cached verified NASA Mars 2020 raw image archive
    const archive = await loadLocalImageryArchive();
    const filtered = archive.items.filter((item) => {
      if (!matchesCameraFilter(item, camera)) return false;
      if (typeof sol === "number" && item.sol !== sol) return false;
      return true;
    });

    const totalMatching = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalMatching / perPage));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * perPage;
    const paged = filtered.slice(offset, offset + perPage);

    return {
      items: paged,
      totalMatching,
      page: safePage,
      perPage,
      totalPages,
      hasMore: offset + paged.length < totalMatching,
      availableSols: archive.solsIncluded,
      summaryByCamera: archive.summaryByCamera,
      retrievalMode: "local_verified_archive",
      retrievalLabel: `Locally Cached NASA Mars 2020 Raw Image Archive (${archive.totalCatalogued} verified frames)`,
      sourceAttribution:
        "NASA/JPL-Caltech / ASU (Mastcam-Z) / LANL-CNES-IRAP (SuperCam)",
    };
  },
};

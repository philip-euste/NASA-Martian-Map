// frontend/src/services/providers/medaProvider.ts
// Phase 2, Task T-2.2: Perseverance MEDA Environmental Data Provider.
//
// Official Source:
// NASA Planetary Data System (PDS4) Atmospheres Node — Mars 2020 MEDA Archive
// Archive URL: https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/
// Bundle LID: urn:nasa:pds:mars2020_meda
//
// Retrieval Architecture:
// 1. Primary Live Backend API (`http://127.0.0.1:8000/api/meda/products` &
//    `/api/meda/products/{sensor}/{sol}`), which reads validated PDS4 CSV and
//    XML report products from `datasets/meda/processed/`.
// 2. Local PDS4 Validated Archive Fallback (`/data/meda_processed_bundle.json`),
//    generated from the exact same PDS4 XML + CSV products when the local Python
//    backend server is offline.
// 3. Clearly distinguishes live backend retrieval (`live_backend`) from locally
//    cached PDS4 archive data (`local_pds_archive`), preserves original PDS4
//    units and timestamps (UTC / LMST / LTST / SCLK), and never coerces missing
//    or sentinel (`999999999`) values to zero.

import {
  getConnectionStatus,
  reportBackendStatus,
} from "../connectionStatus";

export type MedaSensorCode =
  | "PS"
  | "ATS"
  | "TIRS"
  | "RHS"
  | "WS"
  | "RDS"
  | "ANC";

export type MedaRetrievalMode = "live_backend" | "local_pds_archive";

export interface MedaFieldDefinition {
  name: string;
  unit: string | null;
  data_type: string | null;
  description: string | null;
}

export interface MedaProductSummary {
  sensor: MedaSensorCode;
  sol: string;
  sol_folder?: string;
  title: string;
  logical_identifier: string;
  processing_level: string;
  product_version: string;
  start_time: string;
  stop_time: string;
  record_count: number;
  invalid_values_replaced?: number;
  processing?: string[];
  fields: MedaFieldDefinition[];
  validation: string;
}

export interface MedaObservationsResponse {
  product: MedaProductSummary;
  pagination: {
    limit: number;
    offset: number;
    total_records: number;
    returned_records: number;
    has_more: boolean;
  };
  observations: Record<string, string>[];
  retrievalMode: MedaRetrievalMode;
  retrievalLabel: string;
  retrievedAt: string;
}

export interface MedaCatalogResponse {
  count: number;
  products: MedaProductSummary[];
  retrievalMode: MedaRetrievalMode;
  retrievalLabel: string;
  retrievedAt: string;
  roverLocationNote: string;
}

export interface MedaNumericSeriesSummary {
  fieldName: string;
  displayLabel: string;
  unit: string;
  validCount: number;
  missingCount: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  points: {
    index: number;
    lmst: string;
    ltst: string;
    sclk: string;
    value: number | null;
  }[];
}

export const MEDA_SENSOR_METADATA: Record<
  MedaSensorCode,
  {
    name: string;
    categoryLabel: string;
    summary: string;
    primaryColumns: {
      column: string;
      label: string;
      unit: string;
      note?: string;
    }[];
    scientificContext: string;
    geologicalDistinctionNote: string;
  }
> = {
  PS: {
    name: "Pressure Sensor (PS)",
    categoryLabel: "Atmospheric Pressure",
    summary:
      "Derived ambient atmospheric surface pressure measured by MEDA Barocap® capacitive pressure transducers inside the rover body.",
    primaryColumns: [
      {
        column: "PRESSURE",
        label: "Atmospheric Pressure",
        unit: "Pa",
      },
      {
        column: "PRESSURE_UNCERTAINTY",
        label: "Pressure Uncertainty",
        unit: "Pa",
      },
    ],
    scientificContext:
      "Tracks diurnal thermal tides, seasonal CO₂ condensation/sublimation cycles, and transient convective vortices (dust devils) at Jezero Crater floor.",
    geologicalDistinctionNote:
      "Present-day atmospheric pressure (~710–760 Pa) describes modern Martian meteorology and suit/EVA engineering constraints; it does not measure ancient lake water depth or mineral composition.",
  },
  ATS: {
    name: "Air Temperature Sensor (ATS)",
    categoryLabel: "Atmospheric Temperature",
    summary:
      "Calibrated local air temperature readings from five fine-wire thermocouples mounted around the rover Remote Sensing Mast (ATS1–ATS3 at 1.45 m height) and front body (ATS4–ATS5 at 0.84 m height).",
    primaryColumns: [
      {
        column: "ATS_LOCAL_TEMP1_C",
        label: "Air Temp Boom 1 (Derived °C)",
        unit: "°C",
        note: "Converted from ATS_LOCAL_TEMP1 (K - 273.15); no cross-sensor averaging.",
      },
      {
        column: "ATS_LOCAL_TEMP1",
        label: "Air Temp Boom 1 (Original K)",
        unit: "K",
      },
      {
        column: "ATS_LOCAL_TEMP2",
        label: "Air Temp Boom 2 (Original K)",
        unit: "K",
      },
      {
        column: "ATS_LOCAL_TEMP3",
        label: "Air Temp Boom 3 (Original K)",
        unit: "K",
      },
      {
        column: "ATS_LOCAL_TEMP4",
        label: "Air Temp Body Left (Original K)",
        unit: "K",
      },
      {
        column: "ATS_LOCAL_TEMP5",
        label: "Air Temp Body Right (Original K)",
        unit: "K",
      },
    ],
    scientificContext:
      "Captures near-surface vertical temperature gradients and convective turbulence across the Martian diurnal cycle.",
    geologicalDistinctionNote:
      "Describes modern boundary-layer air temperature at the Octavia E. Butler landing site; not an indicator of ancient paleoclimate or sedimentary composition.",
  },
  TIRS: {
    name: "Thermal Infrared Sensor (TIRS)",
    categoryLabel: "Ground & Air Temperature / IR Irradiance",
    summary:
      "Derived upward/downward longwave and shortwave irradiance, ground surface brightness temperature, and near-surface air temperature.",
    primaryColumns: [
      {
        column: "SURFACE_TEMPERATURE",
        label: "Ground Surface Temperature",
        unit: "K",
      },
      {
        column: "AIR_TEMPERATURE",
        label: "TIRS Air Temperature",
        unit: "K",
      },
      {
        column: "DOWNWARD_SW_IRRADIANCE",
        label: "Downward Solar SW Irradiance",
        unit: "W/m²",
      },
      {
        column: "UPWARD_LW_IRRADIANCE",
        label: "Upward Ground LW Irradiance",
        unit: "W/m²",
      },
      {
        column: "DOWNWARD_LW_IRRADIANCE",
        label: "Downward Sky LW Irradiance",
        unit: "W/m²",
      },
    ],
    scientificContext:
      "Directly constrains surface energy balance and local regolith thermal inertia at the rover footprint.",
    geologicalDistinctionNote:
      "Measures modern radiative flux and ground skin temperature at the Sol 1 landing site; does not directly identify phyllosilicates or western delta stratigraphy.",
  },
  RHS: {
    name: "Relative Humidity Sensor (RHS)",
    categoryLabel: "Relative Humidity & Frost Point",
    summary:
      "Derived local relative humidity, water vapor volume mixing ratio, and frost point temperature from Humicap® capacitive polymer sensors.",
    primaryColumns: [
      {
        column: "RELATIVE_HUMIDITY",
        label: "Relative Humidity",
        unit: "%",
      },
      {
        column: "FROST_POINT_TEMP",
        label: "Frost Point Temperature",
        unit: "K",
      },
      {
        column: "VOLUME_MIXING_RATIO",
        label: "Water Vapor Mixing Ratio",
        unit: "ppm",
      },
      {
        column: "LOCAL_TEMP",
        label: "RHS Internal Sensor Temp",
        unit: "K",
      },
    ],
    scientificContext:
      "Quantifies modern near-surface water vapor exchange between the atmosphere and regolith.",
    geologicalDistinctionNote:
      "Describes trace modern atmospheric water vapor; cannot substitute for CRISM/rover mineralogical detection of ancient hydrated clay strata.",
  },
  WS: {
    name: "Wind Sensor (WS)",
    categoryLabel: "Horizontal & Vertical Wind",
    summary:
      "Derived horizontal wind speed, vertical wind speed, and wind direction from hot-film anemometer booms (Sol 0036 product; PDS sentinel 999999999 treated as missing).",
    primaryColumns: [
      {
        column: "HORIZONTAL_WIND_SPEED",
        label: "Horizontal Wind Speed",
        unit: "m/s",
      },
      {
        column: "WIND_DIRECTION",
        label: "Wind Direction",
        unit: "deg",
      },
      {
        column: "VERTICAL_WIND_SPEED",
        label: "Vertical Wind Speed",
        unit: "m/s",
      },
    ],
    scientificContext:
      "Characterizes aeolian wind regimes, slope winds inside Jezero Crater, and EVA dust/wind hazard thresholds.",
    geologicalDistinctionNote:
      "Records modern aeolian winds on Sol 36; rows where boom sensors were flagged invalid (`999999999`) are preserved as missing values (never zero).",
  },
  RDS: {
    name: "Radiation and Dust Sensor (RDS)",
    categoryLabel: "Solar Radiation & Dust Photodiodes",
    summary:
      "Calibrated top-looking and lateral-looking photodiode irradiance channels measuring solar ultraviolet/visible/near-IR sky brightness and dust scattering.",
    primaryColumns: [
      {
        column: "TOP_1",
        label: "Top Channel 1 (Total Sky UV/VIS)",
        unit: "W/m²",
      },
      {
        column: "TOP_7",
        label: "Top Channel 7 (Direct + Diffuse)",
        unit: "W/m²",
      },
      {
        column: "LAT_1",
        label: "Lateral Channel 1",
        unit: "W/m²",
      },
    ],
    scientificContext:
      "Constrains atmospheric aerosol scattering, solar irradiance at the surface, and dust optical depth.",
    geologicalDistinctionNote:
      "Measures atmospheric solar irradiance and suspended dust; not a measurement of surface rock composition.",
  },
  ANC: {
    name: "Ancillary Environment Data (ANC)",
    categoryLabel: "Solar Geometry & Rover Attitude",
    summary:
      "Derived solar zenith angle, solar azimuth, Mars areocentric solar longitude (Ls), and rover frame orientation.",
    primaryColumns: [
      {
        column: "LS",
        label: "Solar Longitude (Ls)",
        unit: "deg",
      },
      {
        column: "SOLAR_ZENITH_ANGLE",
        label: "Solar Zenith Angle",
        unit: "deg",
      },
      {
        column: "SOLAR_AZIMUTH_ANGLE",
        label: "Solar Azimuth Angle",
        unit: "deg",
      },
    ],
    scientificContext:
      "Provides orbital season (Ls) and illumination geometry context for all Sol 1 MEDA environmental measurements.",
    geologicalDistinctionNote:
      "Rover-relative attitude and solar geometry metadata; PDS4 ANC products do not convert rover frame offsets into planetocentric lat/lon.",
  },
};

const API_BASE_URL = "http://127.0.0.1:8000";
const LOCAL_BUNDLE_URL = "/data/meda_processed_bundle.json";
const BACKEND_TIMEOUT_MS = 3500;
const BACKEND_COOLDOWN_MS = 15000;

let lastBackendFailureAt = 0;
let cachedCatalog: MedaCatalogResponse | null = null;
const cachedObservations = new Map<string, MedaObservationsResponse>();

interface LocalMedaBundle {
  source: string;
  archive_url: string;
  generated_at: string;
  rover_location_note: string;
  count: number;
  products: {
    product: MedaProductSummary;
    sample_observations: Record<string, string>[];
  }[];
}

let localBundlePromise: Promise<LocalMedaBundle> | null = null;

async function loadLocalMedaBundle(): Promise<LocalMedaBundle> {
  if (!localBundlePromise) {
    localBundlePromise = (async () => {
      const response = await fetch(LOCAL_BUNDLE_URL);
      if (!response.ok) {
        throw new Error(
          `Local PDS4 MEDA archive bundle unavailable (HTTP ${response.status}).`
        );
      }
      return (await response.json()) as LocalMedaBundle;
    })();
  }
  try {
    return await localBundlePromise;
  } catch (err) {
    localBundlePromise = null;
    throw err;
  }
}

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

/**
 * Safely parses a MEDA CSV cell value into a finite number or `null`.
 * Never interprets empty strings, whitespace, or PDS sentinel `999999999` as zero.
 */
export function parseMedaNumeric(rawValue: string | undefined | null): number | null {
  if (rawValue === undefined || rawValue === null) return null;
  const trimmed = String(rawValue).trim();
  if (
    trimmed === "" ||
    trimmed === "999999999" ||
    trimmed === "999999999.0" ||
    trimmed === "-999999" ||
    trimmed.toUpperCase() === "NULL" ||
    trimmed.toUpperCase() === "UNK" ||
    trimmed.toUpperCase() === "NAN"
  ) {
    return null;
  }
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

/**
 * Computes summary statistics (min, max, mean, validCount, missingCount) and
 * time-series points for a given column across MEDA observation rows.
 * Missing values are preserved as `null` and excluded from min/max/mean calculations.
 */
export function summarizeMedaSeries(
  observations: Record<string, string>[],
  fieldName: string,
  displayLabel: string,
  unit: string
): MedaNumericSeriesSummary {
  let validCount = 0;
  let missingCount = 0;
  let min: number | null = null;
  let max: number | null = null;
  let sum = 0;
  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;

  const points: MedaNumericSeriesSummary["points"] = [];

  for (let index = 0; index < observations.length; index++) {
    const row = observations[index];
    const lmst = (row["LMST"] ?? "").trim();
    const ltst = (row["LTST"] ?? "").trim();
    const sclk = (row["SCLK"] ?? "").trim();
    const value = parseMedaNumeric(row[fieldName]);

    if (value !== null) {
      validCount++;
      sum += value;
      if (min === null || value < min) min = value;
      if (max === null || value > max) max = value;
      const ts = lmst || ltst || sclk;
      if (ts) {
        if (firstTimestamp === null) firstTimestamp = ts;
        lastTimestamp = ts;
      }
    } else {
      missingCount++;
    }

    points.push({
      index,
      lmst,
      ltst,
      sclk,
      value,
    });
  }

  return {
    fieldName,
    displayLabel,
    unit,
    validCount,
    missingCount,
    min: min !== null ? Number(min.toFixed(4)) : null,
    max: max !== null ? Number(max.toFixed(4)) : null,
    mean: validCount > 0 ? Number((sum / validCount).toFixed(4)) : null,
    firstTimestamp,
    lastTimestamp,
    points,
  };
}

export const medaProvider = {
  resetCooldown(): void {
    lastBackendFailureAt = 0;
  },

  clearCache(): void {
    cachedCatalog = null;
    cachedObservations.clear();
    localBundlePromise = null;
  },

  async getProducts(options?: {
    forceRetry?: boolean;
  }): Promise<MedaCatalogResponse> {
    if (cachedCatalog && !options?.forceRetry) {
      return cachedCatalog;
    }

    if (options?.forceRetry) {
      lastBackendFailureAt = 0;
    }

    const now = Date.now();
    const networkOnline = getConnectionStatus().networkOnline;
    const withinCooldown =
      lastBackendFailureAt > 0 &&
      now - lastBackendFailureAt < BACKEND_COOLDOWN_MS;

    if (networkOnline && !withinCooldown) {
      try {
        const res = await fetchWithTimeout(
          `${API_BASE_URL}/api/meda/products`,
          BACKEND_TIMEOUT_MS
        );
        if (res.ok) {
          const data = (await res.json()) as {
            count: number;
            products: MedaProductSummary[];
          };
          if (Array.isArray(data.products) && data.products.length > 0) {
            reportBackendStatus("online", null);
            const result: MedaCatalogResponse = {
              count: data.count,
              products: data.products,
              retrievalMode: "live_backend",
              retrievalLabel:
                "Live Backend API (/api/meda/products · PDS4 Validated)",
              retrievedAt: new Date().toISOString(),
              roverLocationNote:
                "Perseverance Rover at Octavia E. Butler Landing Site, Jezero Crater Floor (~18.4447°N, 77.4508°E), ~2.2 km SE of the western delta front.",
            };
            cachedCatalog = result;
            return result;
          }
        }
      } catch {
        lastBackendFailureAt = Date.now();
      }
    }

    // Fallback to locally cached PDS4-validated bundle
    const bundle = await loadLocalMedaBundle();
    reportBackendStatus(
      "fallback",
      "Backend server unreachable — serving locally cached NASA PDS4 MEDA & Jezero DEM products."
    );

    const result: MedaCatalogResponse = {
      count: bundle.count,
      products: bundle.products.map((p) => p.product),
      retrievalMode: "local_pds_archive",
      retrievalLabel:
        "Locally Cached NASA PDS4 Validated Archive (/data/meda_processed_bundle.json)",
      retrievedAt: bundle.generated_at,
      roverLocationNote: bundle.rover_location_note,
    };
    cachedCatalog = result;
    return result;
  },

  async getObservations(
    sensor: MedaSensorCode,
    solNumberOrFolder: string | number,
    options?: {
      limit?: number;
      offset?: number;
      forceRetry?: boolean;
    }
  ): Promise<MedaObservationsResponse> {
    const solNum = String(solNumberOrFolder).replace(/^sol_0*/i, "") || "1";
    const solFolder = `sol_${solNum.padStart(4, "0")}`;
    const limit = options?.limit ?? 120;
    const offset = options?.offset ?? 0;
    const cacheKey = `${sensor}:${solFolder}:${limit}:${offset}`;

    if (cachedObservations.has(cacheKey) && !options?.forceRetry) {
      return cachedObservations.get(cacheKey)!;
    }

    const now = Date.now();
    const networkOnline = getConnectionStatus().networkOnline;
    const withinCooldown =
      lastBackendFailureAt > 0 &&
      now - lastBackendFailureAt < BACKEND_COOLDOWN_MS;

    if (networkOnline && !withinCooldown) {
      try {
        const url = `${API_BASE_URL}/api/meda/products/${encodeURIComponent(
          sensor
        )}/${encodeURIComponent(solFolder)}?limit=${limit}&offset=${offset}`;
        const res = await fetchWithTimeout(url, BACKEND_TIMEOUT_MS);
        if (res.ok) {
          const data = (await res.json()) as Omit<
            MedaObservationsResponse,
            "retrievalMode" | "retrievalLabel" | "retrievedAt"
          >;
          reportBackendStatus("online", null);
          const result: MedaObservationsResponse = {
            ...data,
            retrievalMode: "live_backend",
            retrievalLabel: `Live Backend API (/api/meda/products/${sensor}/${solFolder})`,
            retrievedAt: new Date().toISOString(),
          };
          cachedObservations.set(cacheKey, result);
          return result;
        }
      } catch {
        lastBackendFailureAt = Date.now();
      }
    }

    const bundle = await loadLocalMedaBundle();
    const match = bundle.products.find(
      (item) =>
        item.product.sensor.toUpperCase() === sensor.toUpperCase() &&
        (item.product.sol_folder === solFolder ||
          String(item.product.sol) === solNum)
    );

    if (!match) {
      throw new Error(
        `No validated MEDA PDS4 product found for sensor ${sensor} on ${solFolder}.`
      );
    }

    const sliced = match.sample_observations.slice(offset, offset + limit);
    const result: MedaObservationsResponse = {
      product: match.product,
      pagination: {
        limit,
        offset,
        total_records: match.product.record_count,
        returned_records: sliced.length,
        has_more: offset + sliced.length < match.sample_observations.length,
      },
      observations: sliced,
      retrievalMode: "local_pds_archive",
      retrievalLabel: `Locally Cached PDS4 Archive (${match.product.logical_identifier} · ${sliced.length} sampled rows of ${match.product.record_count.toLocaleString()} validated records)`,
      retrievedAt: bundle.generated_at,
    };
    cachedObservations.set(cacheKey, result);
    return result;
  },
};

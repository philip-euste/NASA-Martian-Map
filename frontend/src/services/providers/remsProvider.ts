// frontend/src/services/providers/remsProvider.ts
// Phase 2.3A: Curiosity REMS Environmental Data Provider (Gale Crater).
//
// Official Source:
// NASA Planetary Data System (PDS) Atmospheres Node — MSL REMS Archive
// Archive URL: https://pds-atmospheres.nmsu.edu/PDS/data/mslrem_1001/
// Dataset ID: MSL-M-REMS-5-MODRDR-V1.0 / PDS4 Bundle: urn:nasa:pds:msl_rems
//
// Hardware Status & Scientific Provenance:
// - Direct measurements: Pressure (Barocap), Air Temperature (PT1000 on Booms 1 & 2),
//   Ground Temperature (thermopile pyrometer), Relative Humidity (capacitive thin-film),
//   Ultraviolet Radiation (6 photodiodes).
// - Derived values: Wind speed & direction via aerodynamic CFD lookup tables (Newman et al., 2017).
// - Hardware Degradation Timeline:
//   * Sol 0: Boom 1 Boards 2 & 3 wires severed by Sky Crane ejecta. Standalone Boom 1 wind disabled.
//   * Sols 0–854: Boom 2 operational via aerodynamic reconstruction tables.
//   * Sols 854–1504: Progressive failure of Boom 2 boards.
//   * Sol 1504+: All wind sensor boards across both booms permanently inoperable.
// - Strict Sentinel Handling: Sentinels (-999, -9999, "UNK", "NULL", "XXXXXX") are
//   converted to null. Missing values are never coerced to zero.

export type RemsSensorChannel =
  | "PS"
  | "AT"
  | "GT"
  | "RH"
  | "WS"
  | "UV";

export type RemsWindHardwareStatus =
  | "operational_boom2"
  | "degraded_boom2"
  | "all_wind_inoperable";

export interface RemsFieldDefinition {
  name: string;
  unit: string | null;
  dataType: string | null;
  description: string;
}

export interface RemsProductSummary {
  sol: number;
  dataset_id: string;
  bundle_lid: string;
  collection_lid: string;
  source_table: string;
  source_label: string;
  start_time: string | null;
  stop_time: string | null;
  release_id: string | null;
  software_version: string | null;
  raw_record_count: number;
  sampled_record_count: number;
  sample_step: number;
  invalid_values_replaced: number;
  wind_hardware_status: RemsWindHardwareStatus;
  wind_ui_badge: string;
  wind_chartable: boolean;
  wind_failure_notes: string;
  duty_cycle_notes: string;
  validation: string;
}

export interface RemsObservation {
  TIMESTAMP: number | null;
  LMST: string | null;
  LTST: string | null;
  HORIZONTAL_WIND_SPEED: number | null;
  VERTICAL_WIND_SPEED: number | null;
  WIND_DIRECTION: number | null;
  WS_CONFIDENCE_LEVEL: string | null;
  BRIGHTNESS_TEMP: number | null;
  BRIGHTNESS_TEMP_C: number | null;
  BRIGHTNESS_TEMP_LONG_TERM_UNCERTAINTY: number | null;
  BRIGHTNESS_TEMP_SHORT_TERM_UNCERTAINTY: number | null;
  GTS_CONFIDENCE_LEVEL: string | null;
  BOOM1_LOCAL_AIR_TEMP: number | null;
  BOOM1_LOCAL_AIR_TEMP_C: number | null;
  ATS_BOOM1_CONFIDENCE_LEVEL: string | null;
  BOOM2_LOCAL_AIR_TEMP: number | null;
  BOOM2_LOCAL_AIR_TEMP_C: number | null;
  ATS_BOOM2_CONFIDENCE_LEVEL: string | null;
  AMBIENT_TEMP: number | null;
  AMBIENT_TEMP_C: number | null;
  AMBIENT_TEMP_CONFIDENCE_LEVEL: string | null;
  UV_A: number | null;
  UV_B: number | null;
  UV_C: number | null;
  UV_ABC: number | null;
  UV_D: number | null;
  UV_E: number | null;
  UVS_CONFIDENCE_LEVEL: string | null;
  LOCAL_RELATIVE_HUMIDITY: number | null;
  HS_TEMP: number | null;
  LOCAL_RELATIVE_HUMIDITY_UNCERTAINTY: number | null;
  VOLUME_MIXING_RATIO: number | null;
  VOLUME_MIXING_RATIO_UNCERTAINTY: number | null;
  HS_CONFIDENCE_LEVEL: string | null;
  PS_CONFIGURATION: string | null;
  PRESSURE: number | null;
  PRESSURE_UNCERTAINTY: number | null;
  PS_CONFIDENCE_LEVEL: string | null;
  [key: string]: unknown;
}

export interface RemsObservationsResponse {
  product: RemsProductSummary;
  observations: RemsObservation[];
}

export interface RemsCatalogResponse {
  source: string;
  archive_url: string;
  instrument: string;
  target_region: string;
  generated_at: string;
  rover_location_note: string;
  sols_represented: number[];
  total_sampled_observations: number;
  fields: RemsFieldDefinition[];
  products: Array<{
    product: RemsProductSummary;
    observations: RemsObservation[];
  }>;
}

export interface RemsNumericSeriesSummary {
  count: number;
  validCount: number;
  nullCount: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  latest: number | null;
}

export const REMS_CHANNEL_METADATA: Record<
  RemsSensorChannel,
  {
    name: string;
    fullName: string;
    primaryColumn: keyof RemsObservation;
    primaryUnit: string;
    celsiusColumn?: keyof RemsObservation;
    description: string;
    sensorLocation: string;
    caveats: string;
  }
> = {
  PS: {
    name: "Pressure",
    fullName: "Ambient Atmospheric Surface Pressure",
    primaryColumn: "PRESSURE",
    primaryUnit: "Pa",
    description: "Surface pressure recorded by Vaisala Barocap capacitive pressure sensor.",
    sensorLocation: "Rover body avionics chassis, vented via manifold tube",
    caveats: "Highly stable baseline (~2 Pa repeatability); minor seasonal thermal drift."
  },
  AT: {
    name: "Air Temp",
    fullName: "Ambient Local Air Temperature",
    primaryColumn: "AMBIENT_TEMP_C",
    primaryUnit: "°C",
    celsiusColumn: "AMBIENT_TEMP_C",
    description: "Air temperature measured at ~1.5 m elevation on the Remote Sensing Mast.",
    sensorLocation: "Remote Sensing Mast Booms 1 and 2 (PT1000 RTD resistance elements)",
    caveats: "Boom 1 and Boom 2 can diverge when rover deck thermal boundary layer warms mast."
  },
  GT: {
    name: "Ground Temp",
    fullName: "Surface Ground Brightness Temperature",
    primaryColumn: "BRIGHTNESS_TEMP_C",
    primaryUnit: "°C",
    celsiusColumn: "BRIGHTNESS_TEMP_C",
    description: "Surface brightness temperature measured via infrared thermopile pyrometer.",
    sensorLocation: "Boom 1, pointing down at terrain to the right/front of rover",
    caveats: "Measures radiative surface temperature; sensitive to shadow from rover."
  },
  RH: {
    name: "Humidity",
    fullName: "Atmospheric Relative Humidity",
    primaryColumn: "LOCAL_RELATIVE_HUMIDITY",
    primaryUnit: "%",
    description: "Relative humidity measured by capacitive polymer sensor inside Boom 2 chamber.",
    sensorLocation: "Boom 2 humidity sensor slot",
    caveats: "Very low Martian absolute water content; humidity peaks before dawn at low temperatures."
  },
  WS: {
    name: "Wind Flow",
    fullName: "Horizontal Wind Speed & Vector",
    primaryColumn: "HORIZONTAL_WIND_SPEED",
    primaryUnit: "m/s",
    description: "Horizontal wind speed reconstructed from hot-film thermal anemometer cooling rates.",
    sensorLocation: "Remote Sensing Mast Booms 1 and 2",
    caveats: "Aerodynamic CFD reconstruction (Newman et al. 2017). Boom 1 severed Sol 0; Boom 2 degraded Sol 854; all wind boards failed permanently Sol 1504."
  },
  UV: {
    name: "UV Radiation",
    fullName: "Ultraviolet Flux (ABC Band)",
    primaryColumn: "UV_ABC",
    primaryUnit: "W/m²",
    description: "Ultraviolet radiation flux integrated across UV-A, UV-B, and UV-C photodiodes.",
    sensorLocation: "Curiosity Rover Deck UV Sensor Assembly",
    caveats: "Corrected for solar zenith angle; optical dust deposition causes gradual signal reduction."
  }
};

export function parseRemsNumeric(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (Number.isNaN(num)) return null;
  if (num === -999 || num === -9999 || num === -99.99) return null;
  return num;
}

export function summarizeRemsSeries(
  values: Array<number | null>
): RemsNumericSeriesSummary | null {
  if (!values || values.length === 0) return null;
  let validCount = 0;
  let sum = 0;
  let min: number | null = null;
  let max: number | null = null;
  let latest: number | null = null;

  for (const v of values) {
    if (v !== null && !Number.isNaN(v)) {
      validCount++;
      sum += v;
      if (min === null || v < min) min = v;
      if (max === null || v > max) max = v;
      latest = v;
    }
  }

  return {
    count: values.length,
    validCount,
    nullCount: values.length - validCount,
    min,
    max,
    mean: validCount > 0 ? +(sum / validCount).toFixed(2) : null,
    latest
  };
}

class RemsProvider {
  private cachedCatalog: RemsCatalogResponse | null = null;
  private loadingPromise: Promise<RemsCatalogResponse> | null = null;

  public async fetchCatalog(): Promise<RemsCatalogResponse> {
    if (this.cachedCatalog) {
      return this.cachedCatalog;
    }
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = (async () => {
      try {
        const response = await fetch("/data/rems_processed_bundle.json", {
          headers: { Accept: "application/json" }
        });
        if (!response.ok) {
          throw new Error(
            `Failed to load REMS bundle (/data/rems_processed_bundle.json): HTTP ${response.status}`
          );
        }
        const data = (await response.json()) as RemsCatalogResponse;
        this.cachedCatalog = data;
        return data;
      } finally {
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  public getCachedCatalog(): RemsCatalogResponse | null {
    return this.cachedCatalog;
  }

  public async fetchObservations(
    sol: number
  ): Promise<RemsObservationsResponse | null> {
    const catalog = await this.fetchCatalog();
    const entry = catalog.products.find((p) => p.product.sol === sol);
    if (!entry) return null;
    return {
      product: entry.product,
      observations: entry.observations
    };
  }

  public getCachedObservations(sol: number): RemsObservationsResponse | null {
    if (!this.cachedCatalog) return null;
    const entry = this.cachedCatalog.products.find((p) => p.product.sol === sol);
    if (!entry) return null;
    return {
      product: entry.product,
      observations: entry.observations
    };
  }
}

export const remsProvider = new RemsProvider();

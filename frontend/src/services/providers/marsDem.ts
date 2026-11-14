/*frontend\src\services\providers\marsDem.ts */
import type { Coordinates } from "../../types";

/* =========================================================
   CONFIGURATION
   ========================================================= */

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

const DEM_ENDPOINT = `${API_BASE_URL}/api/terrain/dem`;

/* =========================================================
   RESPONSE TYPES
   ========================================================= */

export interface DemInfo {
  product_id: string;
  width: number;
  height: number;
  bands: number;
  data_type: string;
  crs: string;
  resolution: number[];
  nodata: number;
  elevation_unit: string;
  vertical_reference: string;
  access: string;
}

export interface DemElevation {
  longitude: number;
  latitude: number;
  projected_x: number;
  projected_y: number;
  row: number;
  column: number;
  elevation: number;
  unit: string;
  product_id: string;
}

export interface DemWindow {
  center: {
    longitude: number;
    latitude: number;
    projected_x: number;
    projected_y: number;
  };

  dimensions: {
    width: number;
    height: number;
  };

  pixel_origin: {
    row: number;
    column: number;
  };

  resolution: number[];

  elevations: (number | null)[][];

  unit: string;
  product_id: string;
}

/* =========================================================
   REQUEST HANDLING
   ========================================================= */

async function request<T>(
  endpoint: string
): Promise<T> {
  const response = await fetch(`${DEM_ENDPOINT}${endpoint}`);

  if (!response.ok) {
    let message = `DEM API error: HTTP ${response.status}`;

    try {
      const error = await response.json();
      message = error.detail ?? message;
    } catch {
      // Keep the default error message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

/* =========================================================
   MARS DEM PROVIDER
   ========================================================= */

export const marsDemProvider = {
  /**
   * Retrieve DEM metadata.
   */
  async getInfo(): Promise<DemInfo> {
    return request<DemInfo>("/info");
  },

  /**
   * Retrieve elevation at a Mars coordinate.
   */
  async getElevation(
    coordinates: Coordinates
  ): Promise<DemElevation> {
    const params = new URLSearchParams({
      longitude: String(coordinates.longitude),
      latitude: String(coordinates.latitude),
    });

    return request<DemElevation>(
      `/elevation?${params.toString()}`
    );
  },

  /**
   * Retrieve a rectangular elevation grid.
   */
  async getWindow(
    coordinates: Coordinates,
    width = 32,
    height = 32
  ): Promise<DemWindow> {
    const params = new URLSearchParams({
      longitude: String(coordinates.longitude),
      latitude: String(coordinates.latitude),
      width: String(width),
      height: String(height),
    });

    return request<DemWindow>(
      `/window?${params.toString()}`
    );
  },
};

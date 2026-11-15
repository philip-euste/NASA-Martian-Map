import { apiUrl } from "../lib/api";

export interface GeologicalFeature {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  classification: string;
  quadrangle: string;
  diameterKm: number;
  sourceUrl: string;
  description: string;
}

export function featureSymbol(classification: string): string {
  const term = classification.split(",")[0].toLowerCase();
  if (term === "crater") return "◎";
  if (["mons", "tholus", "patera"].includes(term)) return "▲";
  if (["chasma", "vallis", "fossa", "cavus"].includes(term)) return "⌄";
  if (["dorsum", "rupes", "scopulus", "sulcus"].includes(term)) return "⌁";
  if (["planitia", "planum", "terra", "mensa"].includes(term)) return "▰";
  if (term === "unda") return "≋";
  return "◇";
}

export function featureColor(classification: string): string {
  const symbol = featureSymbol(classification);
  if (symbol === "◎") return "#89bed0";
  if (symbol === "▲") return "#eaa36c";
  if (symbol === "⌄") return "#8fb9aa";
  if (symbol === "⌁") return "#c8add6";
  if (symbol === "▰") return "#d1bd90";
  if (symbol === "≋") return "#e4c995";
  return "#b7b9bd";
}

export function visibleGeologicalFeatures(features: GeologicalFeature[], detail: "overview" | "regional" | "close"): GeologicalFeature[] {
  const limit = detail === "overview" ? 2 : detail === "regional" ? 6 : Number.POSITIVE_INFINITY;
  const counts = new Map<string, number>();
  return [...features]
    .sort((a, b) => b.diameterKm - a.diameterKm)
    .filter((feature) => {
      const count = counts.get(feature.classification) ?? 0;
      if (count >= limit) return false;
      counts.set(feature.classification, count + 1);
      return true;
    });
}

function normalizeFeatures(value: unknown): GeologicalFeature[] {
  if (!Array.isArray(value)) throw new Error("Invalid geological feature catalog");
  const seen = new Set<string>();
  return value.filter((item): item is GeologicalFeature => {
    if (!item || typeof item !== "object") return false;
    const f = item as Record<string, unknown>;
    if (typeof f.id !== "string" || seen.has(f.id) ||
        typeof f.name !== "string" || typeof f.classification !== "string" ||
        typeof f.latitude !== "number" || typeof f.longitude !== "number" ||
        !Number.isFinite(f.latitude) || !Number.isFinite(f.longitude) ||
        Math.abs(f.latitude) > 90 || Math.abs(f.longitude) > 180) return false;
    seen.add(f.id);
    return true;
  });
}

let catalogPromise: Promise<GeologicalFeature[]> | null = null;

export function loadGeologicalFeatures(): Promise<GeologicalFeature[]> {
  if (catalogPromise) return catalogPromise;
  catalogPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 3500);
      try {
        const response = await fetch(apiUrl("/api/geological-features"), { signal: controller.signal });
        if (!response.ok) throw new Error(`Geological API HTTP ${response.status}`);
        const payload = await response.json();
        const features = normalizeFeatures(payload.features);
        if (!features.length) throw new Error("Empty geological API response");
        return features;
      } finally {
        window.clearTimeout(timeout);
      }
    } catch {
      const response = await fetch("/data/planetary/mars-features.json");
      if (!response.ok) throw new Error(`Local geological catalog HTTP ${response.status}`);
      return normalizeFeatures(await response.json());
    }
  })();
  catalogPromise.catch(() => { catalogPromise = null; });
  return catalogPromise;
}

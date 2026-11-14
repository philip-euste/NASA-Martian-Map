// frontend/src/simulator/shared/HelmetHud.tsx
//
// Standardized Astronaut Helmet-Mounted Display (HUD) shared across all
// Marswalk simulator environments (Jezero Crater, and future Gale Crater,
// Valles Marineris, and Olympus Mons environments).
//
// Enforces strict provenance labeling (Empirical/Derived DEM & USGS Geology vs
// Simulated PLSS & Atmospheric Scenarios) and eliminates UI overlap by
// yielding the viewport cleanly whenever the Tactical Map [M] or an EVA modal
// is open.

import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Home,
  MapPin,
  Navigation,
  ShieldAlert,
  ShieldCheck,
  Wind,
  Wrench,
  X,
} from "lucide-react";
import { formatCoordinates } from "../../components/ui";
import type {
  Coordinates,
  MarsEnvironmentConditions,
  SuitTelemetry,
} from "../../types";
import type { GeologicUnitInfo } from "../../utils/jezeroStratigraphy";
import type {
  DataProvenance,
  SimulatorEnvironmentConfig,
} from "./environment";
import {
  COMPASS_TICKS,
  classifySlope,
  formatDistance,
  formatDistanceCompact,
  formatHeadingCardinal,
  shortestAngularDelta,
} from "./navigation";

export interface HudScientificTarget {
  readonly id: string;
  readonly name: string;
  readonly coordinates: {
    readonly latitude: number;
    readonly longitude: number;
  };
  readonly description?: string;
  readonly observationIds?: readonly string[];
}

export interface CompassMarkerItem {
  id: string;
  shortName: string;
  fullName: string;
  coordinates: Coordinates;
  bearingDeg: number;
  deltaDeg: number;
  distanceMeters: number;
  kind: "base" | "target" | "landmark";
  visited: boolean;
}

export interface NearestBeaconInfo {
  id: string;
  name: string;
  coordinates: Coordinates;
  distanceMeters: number;
  isMissionTarget: boolean;
}

export interface HelmetHudProps {
  environment: SimulatorEnvironmentConfig;
  isFallbackEnvironment?: boolean;
  requestedRegionName?: string | null;
  explorationMode: "mission" | "free";
  currentPos: Coordinates;
  baseCoordinates: Coordinates;
  liveElevationM: number;
  liveSlopeDeg: number;
  liveHeadingDeg: number;
  liveFlyMode: boolean;
  liveMapOpen: boolean;
  anyModalOpen: boolean;
  totalTraverseMeters: number;
  distanceFromBaseMeters: number;
  elapsedTimeSeconds: number;
  visitedCount: number;
  totalTargets: number;
  visitedTargetIds: readonly string[];
  scientificTargets: readonly HudScientificTarget[];
  selectedTargetId: string;
  currentGeologicUnit: GeologicUnitInfo;
  compassMarkers: readonly CompassMarkerItem[];
  primaryGuideMarker: CompassMarkerItem | null;
  baseMarker: CompassMarkerItem | null;
  nearestBeacon: NearestBeaconInfo | null;
  isApproachingBeacon: boolean;
  activeGroundTruthSol: number;
  suit: SuitTelemetry;
  envConditions: MarsEnvironmentConditions;
  isRotaryDrillEquipped: boolean;
  equippedToolsCount: number;
  observationsCount: number;
  samplesCount: number;
  feedbackBanner: string | null;
  simulatorError: string | null;
  onDismissFeedback: () => void;
  onRetrySimulator: () => void;
  onSelectMode: (mode: "mission" | "free") => void;
  onSelectTarget: (targetId: string) => void;
  onTeleportTo: (lat: number, lon: number, label: string) => void;
  onToggleFieldwork: () => void;
  onOpenBeaconFieldwork: () => void;
  onToggleMap: () => void;
  onToggleFlight: () => void;
  onOpenSuitCheck: () => void;
  onOpenContingency: () => void;
  onTriggerReturn: () => void;
}

function provenanceTag(prov: DataProvenance): string {
  switch (prov) {
    case "empirical":
      return "EMPIRICAL";
    case "derived":
      return "DERIVED DEM";
    case "simulated":
      return "SIMULATED";
    case "unavailable":
      return "UNAVAILABLE";
  }
}

export default function HelmetHud({
  environment,
  isFallbackEnvironment = false,
  requestedRegionName,
  explorationMode,
  currentPos,
  baseCoordinates,
  liveElevationM,
  liveSlopeDeg,
  liveHeadingDeg,
  liveFlyMode,
  liveMapOpen,
  anyModalOpen,
  totalTraverseMeters,
  distanceFromBaseMeters,
  elapsedTimeSeconds,
  visitedCount,
  totalTargets,
  visitedTargetIds,
  scientificTargets,
  currentGeologicUnit,
  compassMarkers,
  primaryGuideMarker,
  baseMarker,
  nearestBeacon,
  isApproachingBeacon,
  activeGroundTruthSol,
  suit,
  envConditions,
  isRotaryDrillEquipped,
  equippedToolsCount,
  observationsCount,
  samplesCount,
  feedbackBanner,
  simulatorError,
  onDismissFeedback,
  onRetrySimulator,
  onSelectMode,
  onSelectTarget,
  onTeleportTo,
  onToggleFieldwork,
  onOpenBeaconFieldwork,
  onToggleMap,
  onToggleFlight,
  onOpenSuitCheck,
  onOpenContingency,
  onTriggerReturn,
}: HelmetHudProps) {
  // Yield the viewport when the Tactical Map [M] or any modal dialog is active
  // so no HUD panels overlap the map canvas, toolbar, or modal controls.
  if (liveMapOpen || anyModalOpen) {
    return null;
  }

  const elapsedMin = Math.floor(elapsedTimeSeconds / 60);
  const elapsedSec = elapsedTimeSeconds % 60;

  const slopeStatus = classifySlope(liveSlopeDeg, environment.hazards);
  const terrainConditionLabel =
    slopeStatus === "hazard"
      ? `STEEP GRADE (≥${environment.hazards.slopeHazardDeg}°)`
      : slopeStatus === "caution"
        ? `MODERATE GRADE (${environment.hazards.slopeCautionDeg}–${environment.hazards.slopeHazardDeg}°)`
        : currentGeologicUnit.hasLooseSandHazard
          ? "AEOLIAN SAND HAZARD"
          : "NOMINAL FOOTING";

  // De-overlap compass markers: sort by priority (active target -> base -> unvisited -> landmark)
  // and suppress markers whose angular position is within 13° of an already-placed marker
  // so badges on the bottom track never collide horizontally.
  const visibleTapeMarkers = (() => {
    const inFov = compassMarkers.filter((m) => Math.abs(m.deltaDeg) <= 56);
    const prioritized = [...inFov].sort((a, b) => {
      const rank = (m: CompassMarkerItem) => {
        if (primaryGuideMarker && m.id === primaryGuideMarker.id) return 0;
        if (m.kind === "base") return 1;
        if (m.kind === "target" && !m.visited) return 2;
        if (m.kind === "target") return 3;
        return 4;
      };
      return rank(a) - rank(b) || a.distanceMeters - b.distanceMeters;
    });

    const placed: CompassMarkerItem[] = [];
    for (const candidate of prioritized) {
      const collides = placed.some(
        (existing) => Math.abs(existing.deltaDeg - candidate.deltaDeg) < 13
      );
      if (!collides) {
        placed.push(candidate);
      }
    }
    return placed;
  })();

  const telAvail = environment.telemetry;

  return (
    <>
      {/* ================================================================
          ASTRONAUT HELMET HUD — TOP PERIMETER
          (Left: Terrain & Geology | Center: 360° Compass Tape | Right: Mission & Waypoints)
          ================================================================ */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-[25] grid grid-cols-1 items-start gap-2.5 lg:grid-cols-12">
        {/* TOP LEFT (Cols 1-3): Coordinates, Terrain Condition & Stratigraphy */}
        <div className="pointer-events-auto rounded-xl border border-white/12 bg-[#141215]/88 px-3.5 py-2.5 text-xs shadow-lg backdrop-blur-md lg:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <span className="mx-eyebrow mx-eyebrow--accent flex items-center gap-1">
              <MapPin size={11} className="text-mx-accent" />
              TERRAIN · DERIVED DEM
            </span>
            <span
              className="rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold"
              style={{
                borderColor: currentGeologicUnit.color,
                backgroundColor: `${currentGeologicUnit.color}28`,
                color: "#f8fafc",
              }}
              title={`${currentGeologicUnit.unit_name} (${currentGeologicUnit.stratigraphic_age})`}
            >
              {currentGeologicUnit.unit_code}
            </span>
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[12px] font-semibold text-mx-text">
            <span>{formatCoordinates(currentPos.latitude, currentPos.longitude)}</span>
            <span className="text-[10px] font-normal text-mx-muted">
              {environment.shortName}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-mx-muted">
            <span>
              Elev{" "}
              <strong className="text-mx-text">
                {liveElevationM.toFixed(0)} m
              </strong>
            </span>
            <span
              className={
                slopeStatus === "hazard"
                  ? "font-semibold text-amber-300"
                  : slopeStatus === "caution"
                    ? "text-amber-200"
                    : "text-mx-muted"
              }
            >
              Slope{" "}
              <strong
                className={
                  slopeStatus === "hazard"
                    ? "text-amber-300"
                    : slopeStatus === "caution"
                      ? "text-amber-200"
                      : "text-mx-text"
                }
              >
                {liveSlopeDeg.toFixed(1)}°
              </strong>
              {slopeStatus === "hazard" ? " ⚠" : ""}
            </span>
            <span>
              Traverse{" "}
              <strong className="text-mx-text">
                {formatDistance(totalTraverseMeters)}
              </strong>
            </span>
          </div>

          <div className="mt-1 flex items-center justify-between gap-2 border-t border-white/8 pt-1 text-[10px]">
            <span className="truncate text-mx-muted" title={currentGeologicUnit.unit_name}>
              {currentGeologicUnit.unit_name}
            </span>
            <span
              className={`shrink-0 font-mono text-[9.5px] font-semibold ${
                slopeStatus === "hazard"
                  ? "text-amber-300"
                  : currentGeologicUnit.hasLooseSandHazard
                    ? "text-amber-200"
                    : "text-emerald-300"
              }`}
            >
              {terrainConditionLabel}
            </span>
          </div>
        </div>

        {/* TOP CENTER (Cols 4-9): Two-Track Horizontal Navigation Compass Tape */}
        <div className="pointer-events-auto flex flex-col items-center lg:col-span-6">
          <div
            className="relative w-full max-w-[640px] overflow-hidden rounded-xl border border-white/15 bg-[#121014]/90 px-3 pt-2 pb-2 shadow-xl backdrop-blur-md"
            aria-label="Astronaut Horizontal Navigation Compass"
          >
            {/* Top digital heading, target bearing & return-to-base bearing strip */}
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
              <span className="text-mx-muted">
                MODE:{" "}
                <strong className="text-mx-text">
                  {liveFlyMode ? "RECON FLIGHT [F]" : "0.38G SURFACE WALK"}
                </strong>
              </span>

              <span className="rounded border border-mx-accent/50 bg-mx-accent/15 px-2 py-0.5 text-[11px] font-bold text-[#ff9d66]">
                HDG {formatHeadingCardinal(liveHeadingDeg)}
              </span>

              {primaryGuideMarker ? (
                <span className="truncate text-sky-300">
                  DEST: <strong>{primaryGuideMarker.shortName}</strong> (
                  {formatDistance(primaryGuideMarker.distanceMeters)} ·{" "}
                  {String(primaryGuideMarker.bearingDeg).padStart(3, "0")}°)
                </span>
              ) : (
                <span className="text-mx-dim">
                  {environment.shortName.toUpperCase()} COMPASS
                </span>
              )}
            </div>

            {/* Two-Track Sliding Horizontal Compass Tape (Top: Ticks, Bottom: Beacons) */}
            <div className="relative h-11 w-full overflow-hidden rounded-md border border-white/10 bg-black/50">
              {/* Center Lubber Line / Reticle */}
              <div
                className="pointer-events-none absolute inset-y-0 left-1/2 z-[15] w-0.5 -translate-x-1/2 bg-mx-accent"
                aria-hidden="true"
              />

              {/* Rear-Turn Indicators when Primary Destination is outside +/-58° FOV */}
              {primaryGuideMarker && primaryGuideMarker.deltaDeg < -58 && (
                <button
                  type="button"
                  onClick={() =>
                    onTeleportTo(
                      primaryGuideMarker.coordinates.latitude,
                      primaryGuideMarker.coordinates.longitude,
                      primaryGuideMarker.fullName
                    )
                  }
                  className="absolute left-1.5 bottom-1 z-[16] inline-flex items-center gap-0.5 rounded border border-mx-accent/60 bg-[#1a120e]/95 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#ff9d66]"
                  title={`Turn left toward ${primaryGuideMarker.fullName} (Click to teleport)`}
                >
                  <ChevronLeft size={10} />
                  {primaryGuideMarker.shortName}
                </button>
              )}
              {primaryGuideMarker && primaryGuideMarker.deltaDeg > 58 && (
                <button
                  type="button"
                  onClick={() =>
                    onTeleportTo(
                      primaryGuideMarker.coordinates.latitude,
                      primaryGuideMarker.coordinates.longitude,
                      primaryGuideMarker.fullName
                    )
                  }
                  className="absolute right-1.5 bottom-1 z-[16] inline-flex items-center gap-0.5 rounded border border-mx-accent/60 bg-[#1a120e]/95 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#ff9d66]"
                  title={`Turn right toward ${primaryGuideMarker.fullName} (Click to teleport)`}
                >
                  {primaryGuideMarker.shortName}
                  <ChevronRight size={10} />
                </button>
              )}

              {/* Track 1 (Top 0..20px): Cardinal & Degree Ticks within +/-65° */}
              {COMPASS_TICKS.map((tick) => {
                const delta = shortestAngularDelta(liveHeadingDeg, tick.deg);
                if (Math.abs(delta) > 65) return null;
                const leftPct = 50 + (delta / 65) * 46;
                return (
                  <div
                    key={tick.deg}
                    className="pointer-events-none absolute top-0 flex -translate-x-1/2 flex-col items-center"
                    style={{ left: `${leftPct}%` }}
                  >
                    <div
                      className={`w-px ${
                        tick.major ? "h-2 bg-white/75" : "h-1.5 bg-white/30"
                      }`}
                    />
                    <span
                      className={`mt-0.5 font-mono leading-none ${
                        tick.major
                          ? tick.label === "N"
                            ? "text-[9.5px] font-bold text-mx-accent"
                            : "text-[9.5px] font-bold text-white"
                          : "text-[8px] text-white/45"
                      }`}
                    >
                      {tick.label}
                    </span>
                  </div>
                );
              })}

              {/* Track 2 (Bottom 22..44px): De-overlapped Waypoint & Landmark Markers */}
              {visibleTapeMarkers.map((m) => {
                const leftPct = 50 + (m.deltaDeg / 65) * 46;
                const badgeColor =
                  m.kind === "base"
                    ? "border-sky-400/70 bg-sky-950/90 text-sky-200"
                    : m.visited
                      ? "border-emerald-400/70 bg-emerald-950/90 text-emerald-200"
                      : m.kind === "target"
                        ? "border-mx-accent/80 bg-[#2a160d]/95 text-[#ffd2b8]"
                        : "border-white/30 bg-[#1c191d]/90 text-mx-text";
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (m.kind === "target") {
                        onSelectTarget(m.id);
                      }
                      onTeleportTo(
                        m.coordinates.latitude,
                        m.coordinates.longitude,
                        m.fullName
                      );
                    }}
                    style={{ left: `${leftPct}%` }}
                    className={`common-compass-marker absolute bottom-1 z-[14] -translate-x-1/2 whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[8.5px] font-semibold leading-none transition hover:scale-105 ${badgeColor}`}
                    title={`${m.fullName} — Bearing ${m.bearingDeg}°, Distance ${m.distanceMeters} m (Click to jump)`}
                  >
                    {m.shortName}{" "}
                    <span className="opacity-80">
                      {formatDistanceCompact(m.distanceMeters)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fallback Environment Notice when user selected a non-Jezero landing region */}
          {isFallbackEnvironment && requestedRegionName && (
            <div className="mt-1.5 rounded-lg border border-amber-500/40 bg-[#1a1410]/90 px-3 py-1 font-mono text-[10px] text-amber-200 shadow backdrop-blur-md">
              Region <strong>{requestedRegionName}</strong> 3D DEM tiles are planned;
              operating on verified <strong>{environment.displayName}</strong> 20 m CTX reference DEM.
            </div>
          )}

          {/* Transient Feedback Notification Banner */}
          {feedbackBanner && (
            <div
              className="mt-2 flex w-full max-w-[640px] items-center justify-between gap-3 rounded-lg border border-emerald-500/45 bg-emerald-950/90 px-3.5 py-1.5 text-xs text-emerald-200 shadow-lg backdrop-blur-md"
              role="status"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2
                  size={13}
                  className="shrink-0 text-emerald-400"
                />
                <span>{feedbackBanner}</span>
              </div>
              <button
                type="button"
                onClick={onDismissFeedback}
                className="text-emerald-300 hover:text-white"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {simulatorError && (
            <div
              className="mt-2 flex w-full max-w-[640px] items-center justify-between gap-3 rounded-lg border border-red-500/50 bg-red-950/90 px-3.5 py-2 text-xs text-red-100 shadow-lg"
              role="alert"
            >
              <span>{simulatorError}</span>
              <button
                type="button"
                onClick={onRetrySimulator}
                className="mx-btn mx-btn--secondary mx-btn--sm"
              >
                Retry Terrain Load
              </button>
            </div>
          )}
        </div>

        {/* TOP RIGHT (Cols 10-12): EVA Timer, Base Return Vector & Quick-Jump Waypoints */}
        <div className="pointer-events-auto rounded-xl border border-white/12 bg-[#141215]/88 px-3.5 py-2.5 text-xs shadow-lg backdrop-blur-md lg:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <div
              className="inline-flex rounded-md border border-mx-border bg-mx-bg/90 p-0.5"
              role="group"
              aria-label="Marswalk exploration mode"
            >
              <button
                type="button"
                onClick={() => onSelectMode("mission")}
                className={`rounded px-2 py-0.5 text-[10.5px] font-semibold transition ${
                  explorationMode === "mission"
                    ? "bg-mx-accent text-[#1a0f08]"
                    : "text-mx-muted hover:text-mx-text"
                }`}
              >
                Mission EVA
              </button>
              <button
                type="button"
                onClick={() => onSelectMode("free")}
                className={`rounded px-2 py-0.5 text-[10.5px] font-semibold transition ${
                  explorationMode === "free"
                    ? "bg-mx-accent text-[#1a0f08]"
                    : "text-mx-muted hover:text-mx-text"
                }`}
              >
                Free Explore
              </button>
            </div>

            <span className="font-mono text-[11px] text-emerald-300">
              <strong>
                {visitedCount}/{Math.max(1, totalTargets)}
              </strong>{" "}
              Targets
            </span>
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[11px] text-mx-muted">
            <span>
              EVA{" "}
              <strong className="text-mx-text">
                {String(elapsedMin).padStart(2, "0")}:
                {String(elapsedSec).padStart(2, "0")}
              </strong>
            </span>
            <span title="Great-circle distance and bearing back to Habitat / Rover Base">
              Base{" "}
              <strong className="text-sky-300">
                {formatDistance(distanceFromBaseMeters)}
              </strong>
              {baseMarker ? ` · ${String(baseMarker.bearingDeg).padStart(3, "0")}°` : ""}
            </span>
          </div>

          {/* Quick-Jump Waypoint Strip */}
          <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-white/10 pt-1.5">
            <button
              type="button"
              onClick={() =>
                onTeleportTo(
                  baseCoordinates.latitude,
                  baseCoordinates.longitude,
                  environment.defaultBase.name
                )
              }
              className="rounded border border-sky-400/40 bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] text-sky-200 hover:bg-sky-500/25"
            >
              Habitat Base
            </button>

            {explorationMode === "free"
              ? environment.fieldSites.slice(1).map((site) => (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() =>
                      onTeleportTo(site.latitude, site.longitude, site.name)
                    }
                    className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] text-mx-muted hover:border-mx-accent hover:text-mx-text"
                  >
                    {site.name.split(" ")[0]} {site.name.split(" ")[1]}
                  </button>
                ))
              : scientificTargets.slice(0, 4).map((t, idx) => {
                  const isVisited = visitedTargetIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onSelectTarget(t.id);
                        onTeleportTo(
                          t.coordinates.latitude,
                          t.coordinates.longitude,
                          t.name
                        );
                      }}
                      className={`rounded border px-1.5 py-0.5 text-[10px] transition ${
                        isVisited
                          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                          : "border-white/15 bg-white/5 text-mx-text hover:border-mx-accent"
                      }`}
                    >
                      {isVisited ? "✓ " : `T${idx + 1}: `}
                      {t.name.slice(0, 14)}
                    </button>
                  );
                })}
          </div>
        </div>
      </div>

      {/* ================================================================
          PROXIMITY CALLOUT CARD (<150 m to Target / Beacon)
          Positioned above the bottom-right environment panel with clear margin
          ================================================================ */}
      {isApproachingBeacon && nearestBeacon && (
        <div className="pointer-events-auto absolute bottom-28 right-3 z-[25] max-w-[330px] rounded-xl border border-emerald-500/45 bg-[#141215]/92 p-3 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              <Camera size={12} />
              BEACON IN RANGE ({nearestBeacon.distanceMeters} m)
            </span>
            <span
              className="rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold"
              style={{
                borderColor: currentGeologicUnit.color,
                backgroundColor: `${currentGeologicUnit.color}28`,
                color: "#f8fafc",
              }}
            >
              {currentGeologicUnit.unit_code}
            </span>
          </div>
          <p className="m-0 mt-1 text-xs font-semibold text-white">
            {nearestBeacon.name}
          </p>
          <p className="m-0 mt-0.5 text-[10px] text-mx-muted">
            Perseverance Sol {activeGroundTruthSol} Ground-Truth Outcrop &amp;
            CRISM/HiRISE Orbital Telemetry ready.
          </p>
          <button
            type="button"
            onClick={onOpenBeaconFieldwork}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
          >
            <Camera size={12} />
            Open Fieldwork Terminal [E]
          </button>
        </div>
      )}

      {/* ================================================================
          ASTRONAUT HELMET HUD — BOTTOM PERIMETER
          (Left: PLSS Suit, Loadout & Action Strip | Right: Environment Telemetry)
          ================================================================ */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[25] flex flex-wrap items-end justify-between gap-2.5">
        {/* BOTTOM LEFT: Suit Life-Support Systems, Equipment Status & Action Controls */}
        <div className="pointer-events-auto flex max-w-full flex-col gap-1.5 rounded-xl border border-white/12 bg-[#141215]/90 px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-md">
          {/* Suit Life-Support Gauges (Explicitly labeled SIMULATED PLSS) */}
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
            <span className="mx-eyebrow mx-eyebrow--accent">
              PLSS SUIT (SIMULATED)
            </span>
            <span className="text-mx-muted">
              O₂{" "}
              <strong className="text-emerald-300">
                {suit.oxygenPercent.toFixed(1)}%
              </strong>
            </span>
            <span className="text-mx-muted">
              Press{" "}
              <strong className="text-mx-text">
                {suit.suitPressureKpa.toFixed(1)} kPa
              </strong>
            </span>
            <span className="text-mx-muted">
              CO₂ Bed{" "}
              <strong
                className={
                  suit.co2ScrubberPercent < 80
                    ? "text-amber-300"
                    : "text-emerald-300"
                }
              >
                {suit.co2ScrubberPercent.toFixed(0)}%
              </strong>
            </span>
            <span className="text-mx-muted">
              Batt{" "}
              <strong className="text-mx-text">
                {suit.batteryPercent.toFixed(0)}%
              </strong>
            </span>
            <span className="text-mx-muted">
              Comms{" "}
              <strong
                className={
                  suit.commsStatus === "Nominal"
                    ? "text-emerald-300"
                    : "text-amber-300"
                }
              >
                {suit.commsStatus}
              </strong>
            </span>
            <span className="hidden text-mx-border sm:inline">|</span>
            <span
              className="inline-flex items-center gap-1 text-[10.5px] text-mx-muted"
              title="Assigned EVA field tools from Mission Builder"
            >
              <Wrench size={11} className="text-mx-accent" />
              {equippedToolsCount} Tools (
              <strong
                className={
                  isRotaryDrillEquipped ? "text-emerald-300" : "text-amber-300"
                }
              >
                {isRotaryDrillEquipped ? "Core Drill Ready" : "No Core Drill"}
              </strong>
              )
            </span>
          </div>

          {/* Interactive Visor Action Strip */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleFieldwork}
              className="mx-btn mx-btn--secondary mx-btn--sm"
            >
              <FlaskConical size={13} className="text-mx-accent" />
              Fieldwork &amp; Samples [E]
              <span className="mx-badge ml-0.5">
                {observationsCount + samplesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleMap}
              className="mx-btn mx-btn--secondary mx-btn--sm"
            >
              <Navigation size={13} className="text-sky-300" />
              Terrain Map [M]
            </button>

            <button
              type="button"
              onClick={onToggleFlight}
              className={`mx-btn mx-btn--sm ${
                liveFlyMode ? "mx-btn--primary" : "mx-btn--secondary"
              }`}
            >
              Recon Flight [F]
            </button>

            <button
              type="button"
              onClick={onOpenSuitCheck}
              className={`mx-btn mx-btn--sm ${
                suit.readinessVerified
                  ? "mx-btn--secondary border-emerald-500/40 text-emerald-200"
                  : "mx-btn--secondary border-amber-400/50 text-amber-200"
              }`}
            >
              {suit.readinessVerified ? (
                <ShieldCheck size={13} className="text-emerald-400" />
              ) : (
                <ShieldAlert size={13} className="text-amber-400" />
              )}
              Suit Check
            </button>

            <button
              type="button"
              onClick={onTriggerReturn}
              className="mx-btn mx-btn--primary mx-btn--sm"
            >
              <Home size={13} />
              Return Base [R]
            </button>
          </div>
        </div>

        {/* BOTTOM RIGHT: Environmental Telemetry & Contingency Trigger */}
        <div className="pointer-events-auto flex flex-col gap-1.5 rounded-xl border border-white/12 bg-[#141215]/90 px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <span
              className="mx-eyebrow mx-eyebrow--accent"
              title={telAvail.note}
            >
              ENV TELEMETRY ({provenanceTag(telAvail.atmosphericPressure)})
            </span>
            <button
              type="button"
              onClick={onOpenContingency}
              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10.5px] font-semibold transition ${
                envConditions.contingencyActive
                  ? "border-amber-400/60 bg-amber-500/20 text-amber-200"
                  : "border-white/15 bg-white/5 text-mx-muted hover:border-mx-accent hover:text-mx-text"
              }`}
            >
              <Wind size={11} />
              {envConditions.contingencyActive
                ? envConditions.contingencyActive
                : "Env & Contingencies"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-mx-muted">
            <span title={`Provenance: ${provenanceTag(telAvail.ambientTemperature)}`}>
              Temp{" "}
              <strong className="text-mx-text">
                {telAvail.ambientTemperature === "unavailable"
                  ? "N/A"
                  : `${envConditions.surfaceTempCelsius}°C`}
              </strong>
            </span>
            <span title={`Provenance: ${provenanceTag(telAvail.atmosphericPressure)}`}>
              Atm{" "}
              <strong className="text-mx-text">
                {telAvail.atmosphericPressure === "unavailable"
                  ? "N/A"
                  : `${envConditions.atmosphericPressurePa} Pa`}
              </strong>
            </span>
            <span title={`Provenance: ${provenanceTag(telAvail.dustOpacity)}`}>
              Dust τ{" "}
              <strong
                className={
                  envConditions.dustOpticalDepthTau > 1.0
                    ? "text-amber-300"
                    : "text-mx-text"
                }
              >
                {telAvail.dustOpacity === "unavailable"
                  ? "N/A"
                  : envConditions.dustOpticalDepthTau.toFixed(2)}
              </strong>
            </span>
            <span title={`Provenance: ${provenanceTag(telAvail.visibility)}`}>
              Vis{" "}
              <strong className="text-mx-text">
                {telAvail.visibility === "unavailable"
                  ? "N/A"
                  : `${envConditions.visibilityKm.toFixed(1)} km`}
              </strong>
            </span>
            <span title={`Provenance: ${provenanceTag(telAvail.wind)}`}>
              Wind{" "}
              <strong className="text-mx-text">
                {telAvail.wind === "unavailable"
                  ? "N/A"
                  : `${envConditions.windSpeedMetersPerSec.toFixed(1)} m/s`}
              </strong>
            </span>
            <span title={`Provenance: ${provenanceTag(telAvail.radiation)}`}>
              Rad{" "}
              <strong className="text-mx-text">
                {telAvail.radiation === "unavailable"
                  ? "N/A"
                  : `${envConditions.radiationDoseRateMicroSvPerHour} µSv/h`}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

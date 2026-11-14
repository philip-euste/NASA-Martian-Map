// frontend/src/features/mission/RouteStratigraphyProfile.tsx
// Phase 4: Curiosity-Style Stratigraphic Cross-Section & Elevation Profile.
//
// Architectural Reference:
// Modeled after NASA's "Curiosity's Proposed Path Up Mount Sharp" (Hematite Ridge ->
// Clay-Bearing Unit -> Sulfate-Bearing Unit), connecting each route waypoint and
// traverse leg to USGS SIM 3464 Jezero chronostratigraphic units, HiRISE/CTX DEM
// elevation gradients, slope limits (>15°), and THEMIS thermal inertia sand hazards.

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Compass,
  Layers,
  Loader2,
  Mountain,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { formatCoordinates, formatDistance } from "../../components/ui";
import { isWithinJezeroDemBounds } from "../mars-explorer/marsExplorer.types";
import { marsDemProvider } from "../../services/providers/marsDem";
import type { Waypoint } from "../../types";
import {
  computeStratigraphicTraverseProfile,
  type JezeroGeoJsonFeature,
} from "../../utils/jezeroStratigraphy";

interface RouteStratigraphyProfileProps {
  waypoints: readonly Waypoint[];
  includeReturnLeg: boolean;
  preferredSlopeDegrees?: number;
  routeTitle?: string;
  onLoadReferenceTraverse?: () => void;
}

export default function RouteStratigraphyProfile({
  waypoints,
  includeReturnLeg,
  preferredSlopeDegrees = 15,
  routeTitle = "Active Draft Traverse",
  onLoadReferenceTraverse,
}: RouteStratigraphyProfileProps) {
  const [geoJsonFeatures, setGeoJsonFeatures] = useState<
    JezeroGeoJsonFeature[] | undefined
  >(undefined);
  const [sampledElevations, setSampledElevations] = useState<
    Record<string, { elevation: number; isFallback: boolean }>
  >({});
  const [sampling, setSampling] = useState(false);
  const [resampleVersion, setResampleVersion] = useState(0);

  // Load `/data/jezero_geology_sim3464.geojson` for live polygon verification
  useEffect(() => {
    let cancelled = false;
    fetch("/data/jezero_geology_sim3464.geojson")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.features)) {
          setGeoJsonFeatures(data.features as JezeroGeoJsonFeature[]);
        }
      })
      .catch(() => {
        // Uses synchronous JEZERO_SIM3464_FEATURES fallback in jezeroStratigraphy.ts
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Automatically sample elevations along waypoints via marsDemProvider
  useEffect(() => {
    if (waypoints.length === 0) return;
    let cancelled = false;
    setSampling(true);

    async function sampleAll() {
      const nextSamples: Record<
        string,
        { elevation: number; isFallback: boolean }
      > = {};
      for (const wp of waypoints) {
        if (isWithinJezeroDemBounds(wp.coordinates)) {
          try {
            const res = await marsDemProvider.getElevation(wp.coordinates);
            nextSamples[wp.id] = {
              elevation: res.elevation,
              isFallback: Boolean(res.isFallback),
            };
          } catch {
            // Leave unsampled to use stratigraphic elevation baseline
          }
        }
      }
      if (!cancelled) {
        setSampledElevations(nextSamples);
        setSampling(false);
      }
    }

    void sampleAll();
    return () => {
      cancelled = true;
    };
  }, [waypoints, resampleVersion]);

  const analysis = useMemo(
    () =>
      computeStratigraphicTraverseProfile(
        waypoints,
        sampledElevations,
        includeReturnLeg,
        preferredSlopeDegrees,
        geoJsonFeatures
      ),
    [
      waypoints,
      sampledElevations,
      includeReturnLeg,
      preferredSlopeDegrees,
      geoJsonFeatures,
    ]
  );

  // SVG Cross-Section Dimensions
  const svgWidth = 760;
  const svgHeight = 250;
  const padLeft = 58;
  const padRight = 24;
  const padTop = 28;
  const padBottom = 46;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const minElev = Math.floor((analysis.minElevationMeters - 20) / 10) * 10;
  const maxElev = Math.ceil((analysis.maxElevationMeters + 20) / 10) * 10;
  const elevSpan = Math.max(40, maxElev - minElev);
  const totalDistM = Math.max(100, analysis.totalDistanceMeters);

  function toSvgX(distMeters: number): number {
    return padLeft + (distMeters / totalDistM) * plotWidth;
  }

  function toSvgY(elevMeters: number): number {
    return (
      padTop + plotHeight - ((elevMeters - minElev) / elevSpan) * plotHeight
    );
  }

  return (
    <section
      className="mx-panel p-6"
      aria-label="Curiosity-style stratigraphic cross-section and elevation profile"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-mx-border pb-4">
        <div>
          <span className="mx-eyebrow mx-eyebrow--accent">
            Curiosity Mount Sharp Traverse Model · USGS SIM 3464 Stratigraphy
          </span>
          <h2 className="mx-heading m-0 mt-1 flex items-center gap-2 text-xl">
            <Mountain size={18} className="text-mx-accent" />
            Stratigraphic Cross-Section &amp; Traverse Hazard Profile
          </h2>
          <p className="mx-body m-0 mt-1 text-xs text-mx-muted">
            Correlates waypoint elevations (HiRISE / CTX DEM) with USGS Jezero
            chronostratigraphic units, contact crossings, slope limits (&gt;
            {preferredSlopeDegrees}°), and THEMIS thermal inertia sand hazards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onLoadReferenceTraverse && (
            <button
              type="button"
              onClick={onLoadReferenceTraverse}
              className="mx-btn mx-btn--secondary mx-btn--sm"
              title="Load 4-waypoint stratigraphic traverse from Crater Floor across Delta Scarp to Delta Topset"
            >
              <Sparkles size={13} className="text-mx-accent" />
              Load Jezero Stratigraphic Traverse
            </button>
          )}
          <button
            type="button"
            onClick={() => setResampleVersion((v) => v + 1)}
            disabled={sampling || waypoints.length === 0}
            className="mx-btn mx-btn--secondary mx-btn--sm"
          >
            {sampling ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
            {sampling ? "Sampling DEM…" : "Re-sample DEM"}
          </button>
        </div>
      </div>

      {analysis.nodes.length < 2 ? (
        <div className="mt-4 rounded-lg border border-dashed border-mx-border-strong bg-mx-bg p-5 text-center text-xs text-mx-muted">
          Plot at least 2 waypoints on the map above (or click{" "}
          <strong className="text-mx-text">
            Load Jezero Stratigraphic Traverse
          </strong>
          ) to generate the Curiosity-style geological cross-section and hazard
          profile.
        </div>
      ) : (
        <>
          {/* Summary KPI Strip */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-mx-border bg-mx-bg p-3">
              <span className="font-mono text-[10px] uppercase text-mx-dim">
                Traverse Distance ({routeTitle})
              </span>
              <strong className="mt-0.5 block font-mono text-sm text-mx-text">
                {formatDistance(analysis.totalDistanceMeters)}
              </strong>
            </div>
            <div className="rounded-lg border border-mx-border bg-mx-bg p-3">
              <span className="font-mono text-[10px] uppercase text-mx-dim">
                Geologic Units Crossed
              </span>
              <strong className="mt-0.5 block font-mono text-sm text-emerald-300">
                {analysis.uniqueUnitsTraversed.length} Formations (
                {analysis.contacts.length} Contacts)
              </strong>
            </div>
            <div className="rounded-lg border border-mx-border bg-mx-bg p-3">
              <span className="font-mono text-[10px] uppercase text-mx-dim">
                Peak Segment Slope
              </span>
              <strong
                className={`mt-0.5 block font-mono text-sm ${
                  analysis.maxSlopeDegrees > preferredSlopeDegrees
                    ? "text-amber-300"
                    : "text-mx-text"
                }`}
              >
                {analysis.maxSlopeDegrees.toFixed(1)}° (Limit{" "}
                {preferredSlopeDegrees}°)
              </strong>
            </div>
            <div className="rounded-lg border border-mx-border bg-mx-bg p-3">
              <span className="font-mono text-[10px] uppercase text-mx-dim">
                Hazard Segments Flagged
              </span>
              <strong
                className={`mt-0.5 block font-mono text-sm ${
                  analysis.steepHazardSegments.length > 0 ||
                  analysis.sandHazardSegments.length > 0
                    ? "text-amber-300"
                    : "text-emerald-300"
                }`}
              >
                {analysis.steepHazardSegments.length} Slope ·{" "}
                {analysis.sandHazardSegments.length} Sand/TI
              </strong>
            </div>
          </div>

          {/* SVG Stratigraphic Cross-Section Chart */}
          <div className="mt-4 rounded-lg border border-mx-border bg-[#0d0c0e] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="font-mono text-mx-muted">
                ELEVATION (MOLA / HiRISE DTM m) vs. CUMULATIVE TRAVERSE DISTANCE
                (KM)
              </span>
              <div className="flex flex-wrap items-center gap-3 font-mono text-[10px]">
                <span className="flex items-center gap-1 text-amber-300">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                  Steep Slope (&gt;{preferredSlopeDegrees}°)
                </span>
                <span className="flex items-center gap-1 text-orange-300">
                  <span className="inline-block h-2 w-3 border border-orange-400 bg-orange-500/30" />
                  Low Thermal Inertia (Loose Sand)
                </span>
              </div>
            </div>

            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="h-auto max-h-64 w-full select-none"
              role="img"
              aria-label="Stratigraphic elevation cross-section chart"
            >
              {/* Horizontal Elevation Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const elevVal = Math.round(minElev + elevSpan * t);
                const y = toSvgY(elevVal);
                return (
                  <g key={t}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgWidth - padRight}
                      y2={y}
                      stroke="#27272a"
                      strokeDasharray="3,3"
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 3}
                      fill="#a1a1aa"
                      fontSize="10"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {elevVal}m
                    </text>
                  </g>
                );
              })}

              {/* Colored Geological Formation Cross-Section Polygons Under Each Segment */}
              {analysis.segments.map((seg) => {
                const x1 = toSvgX(seg.fromNode.cumulativeDistanceMeters);
                const y1 = toSvgY(seg.fromNode.elevationMeters);
                const x2 = toSvgX(seg.toNode.cumulativeDistanceMeters);
                const y2 = toSvgY(seg.toNode.elevationMeters);
                const baseY = padTop + plotHeight;
                const polyPoints = `${x1.toFixed(1)},${baseY} ${x1.toFixed(
                  1
                )},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(
                  1
                )} ${x2.toFixed(1)},${baseY}`;

                return (
                  <g key={`seg-poly-${seg.segmentIndex}`}>
                    <polygon
                      points={polyPoints}
                      fill={seg.fromNode.unit.color}
                      fillOpacity={0.26}
                    />
                    {/* Loose Sand / Low Thermal Inertia Stipple Band at Base */}
                    {seg.isLooseSandHazard && (
                      <rect
                        x={x1}
                        y={baseY - 8}
                        width={Math.max(2, x2 - x1)}
                        height={8}
                        fill="#f97316"
                        fillOpacity={0.55}
                      />
                    )}
                    {/* Profile Segment Line */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={
                        seg.isCriticalSlopeHazard
                          ? "#ef4444"
                          : seg.isSteepSlopeHazard
                            ? "#f59e0b"
                            : seg.fromNode.unit.color
                      }
                      strokeWidth={seg.isSteepSlopeHazard ? 3.5 : 2.5}
                    />
                    {/* Mid-segment Slope / Unit Callout */}
                    {x2 - x1 > 48 && (
                      <text
                        x={(x1 + x2) / 2}
                        y={(y1 + y2) / 2 - 8}
                        fill={seg.isSteepSlopeHazard ? "#fcd34d" : "#e4e4e7"}
                        fontSize="9"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {seg.slopeDegrees.toFixed(1)}°
                        {seg.isSteepSlopeHazard ? " ⚠" : ""}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Vertical Stratigraphic Contact Crossing Dashed Lines */}
              {analysis.contacts.map((contact) => {
                const cx = toSvgX(contact.distanceMeters);
                return (
                  <g key={contact.id}>
                    <line
                      x1={cx}
                      y1={padTop}
                      x2={cx}
                      y2={padTop + plotHeight}
                      stroke="#f47738"
                      strokeWidth="1.2"
                      strokeDasharray="4,3"
                    />
                    <text
                      x={cx}
                      y={padTop - 6}
                      fill="#f47738"
                      fontSize="8.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {contact.fromUnit.unit_code}∣{contact.toUnit.unit_code}
                    </text>
                  </g>
                );
              })}

              {/* Waypoint Nodes */}
              {analysis.nodes.map((node) => {
                const cx = toSvgX(node.cumulativeDistanceMeters);
                const cy = toSvgY(node.elevationMeters);
                return (
                  <g key={`${node.waypointId}-${node.index}`}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill={node.unit.color}
                      stroke="#141215"
                      strokeWidth="2"
                    />
                    <text
                      x={cx}
                      y={padTop + plotHeight + 16}
                      fill="#d4d4d8"
                      fontSize="9.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {node.cumulativeDistanceKm.toFixed(2)} km
                    </text>
                    <text
                      x={cx}
                      y={padTop + plotHeight + 29}
                      fill="#a1a1aa"
                      fontSize="8.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      WP{node.index + 1} ({node.unit.unit_code})
                    </text>
                  </g>
                );
              })}

              {/* Axes */}
              <line
                x1={padLeft}
                y1={padTop}
                x2={padLeft}
                y2={padTop + plotHeight}
                stroke="#52525b"
                strokeWidth="1.5"
              />
              <line
                x1={padLeft}
                y1={padTop + plotHeight}
                x2={svgWidth - padRight}
                y2={padTop + plotHeight}
                stroke="#52525b"
                strokeWidth="1.5"
              />
            </svg>

            {/* Stratigraphic Legend Chips */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-mx-border pt-2.5 text-[11px]">
              <span className="font-mono text-[10px] uppercase text-mx-dim">
                Traversed USGS Units:
              </span>
              {analysis.uniqueUnitsTraversed.map((u) => (
                <span
                  key={u.unit_code}
                  className="inline-flex items-center gap-1.5 rounded border border-mx-border bg-mx-surface px-2 py-0.5 text-xs"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: u.color }}
                  />
                  <strong className="font-mono text-mx-text">
                    {u.unit_code}
                  </strong>
                  <span className="text-mx-muted">{u.unit_name}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Grid: Stratigraphic Contact Crossings + Traversal Hazard Warnings */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Stratigraphic Contact Boundaries */}
            <div className="rounded-lg border border-mx-border bg-mx-bg p-4">
              <h3 className="mx-heading m-0 flex items-center gap-2 text-sm">
                <Layers size={15} className="text-mx-accent" />
                Stratigraphic Contact Crossings ({analysis.contacts.length})
              </h3>
              {analysis.contacts.length === 0 ? (
                <p className="mx-body m-0 mt-2 text-xs text-mx-muted">
                  All current waypoints lie within{" "}
                  <strong className="text-mx-text">
                    {analysis.nodes[0]?.unit.unit_name} (
                    {analysis.nodes[0]?.unit.unit_code})
                  </strong>
                  . Plot waypoints across the Western Delta Scarp or Belva
                  Crater to inspect geological unit transitions.
                </p>
              ) : (
                <ul className="m-0 mt-2.5 list-none space-y-2 p-0 text-xs">
                  {analysis.contacts.map((c) => (
                    <li
                      key={c.id}
                      className="rounded border border-mx-border bg-mx-surface/70 p-2.5"
                    >
                      <div className="font-mono font-semibold text-mx-accent">
                        {c.summary}
                      </div>
                      <p className="m-0 mt-1 text-[11px] text-mx-muted">
                        {c.scientificSignificance}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Slope & Thermal Inertia Hazard Callouts */}
            <div className="rounded-lg border border-mx-border bg-mx-bg p-4">
              <h3 className="mx-heading m-0 flex items-center gap-2 text-sm">
                <ShieldAlert size={15} className="text-amber-400" />
                Traversal Hazard Zones (Slope &amp; Thermal Inertia)
              </h3>
              {analysis.steepHazardSegments.length === 0 &&
              analysis.sandHazardSegments.length === 0 ? (
                <p className="mx-body m-0 mt-2 text-xs text-emerald-300">
                  ✓ All traverse segments are below the {preferredSlopeDegrees}°
                  suit slope threshold and cross high-thermal-inertia competent
                  substrates.
                </p>
              ) : (
                <ul className="m-0 mt-2.5 list-none space-y-2 p-0 text-xs">
                  {analysis.segments
                    .filter((s) => s.hazardWarnings.length > 0)
                    .map((seg) => (
                      <li
                        key={`haz-${seg.segmentIndex}`}
                        className={`rounded border p-2.5 ${
                          seg.isCriticalSlopeHazard
                            ? "border-red-500/40 bg-red-950/20 text-red-200"
                            : "border-amber-500/40 bg-amber-950/20 text-amber-200"
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono text-[11px] font-semibold">
                          <span>
                            Leg {seg.segmentIndex + 1}: {seg.fromNode.name} →{" "}
                            {seg.toNode.name}
                          </span>
                          <span>
                            KM {seg.startDistanceKm.toFixed(2)}–
                            {seg.endDistanceKm.toFixed(2)}
                          </span>
                        </div>
                        <ul className="m-0 mt-1 list-disc space-y-0.5 pl-4 text-[11px]">
                          {seg.hazardWarnings.map((w, idx) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>

          {/* Waypoint-by-Waypoint Curiosity-Style Science & Unit Log */}
          <div className="mt-4 overflow-x-auto rounded-lg border border-mx-border bg-mx-bg">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-mx-border font-mono text-[10px] uppercase text-mx-dim">
                  <th className="px-3 py-2.5">Waypoint</th>
                  <th className="px-3 py-2.5">Dist (KM)</th>
                  <th className="px-3 py-2.5">Elev (DEM)</th>
                  <th className="px-3 py-2.5">USGS Unit</th>
                  <th className="px-3 py-2.5">Lithology &amp; Dominant Minerals</th>
                  <th className="px-3 py-2.5">Thermal Inertia / Trafficability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mx-border">
                {analysis.nodes.map((n) => (
                  <tr key={`${n.waypointId}-${n.index}`}>
                    <td className="px-3 py-2 font-medium text-mx-text">
                      <div>
                        <span className="font-mono text-mx-accent">
                          WP{String(n.index + 1).padStart(2, "0")}
                        </span>{" "}
                        {n.name}
                      </div>
                      <span className="font-mono text-[10px] text-mx-dim">
                        {formatCoordinates(
                          n.coordinates.latitude,
                          n.coordinates.longitude
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-mx-muted">
                      {n.cumulativeDistanceKm.toFixed(2)} km
                    </td>
                    <td className="px-3 py-2 font-mono text-mx-text">
                      {n.elevationMeters} m{" "}
                      <span className="block text-[10px] text-mx-dim">
                        {n.elevationVerifiedByDem
                          ? "HiRISE/CTX DEM"
                          : "Unit Baseline"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-[11px] font-semibold"
                        style={{
                          backgroundColor: `${n.unit.color}22`,
                          color: n.unit.color,
                          border: `1px solid ${n.unit.color}55`,
                        }}
                      >
                        {n.unit.unit_code}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-mx-muted">
                        {n.unit.unit_name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-mx-muted">
                      <div>{n.unit.lithology}</div>
                      <span className="text-[10px] text-emerald-300">
                        Minerals: {n.unit.dominant_minerals.join(", ")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px]">
                      <span
                        className={`font-mono font-semibold ${
                          n.unit.hasLooseSandHazard
                            ? "text-amber-300"
                            : "text-emerald-300"
                        }`}
                      >
                        ~{n.unit.thermalInertiaJm2Ks05} J·m⁻²·K⁻¹·s⁻¹/²
                      </span>
                      <span className="block text-mx-muted">
                        {n.unit.trafficability}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

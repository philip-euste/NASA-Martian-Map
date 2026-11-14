// frontend/src/features/mission/RoutePlannerPage.tsx
// Route Planner interface (Phase 4): connected to Mission Builder and Marswalk.
// Computes spherical Mars distances (R = 3,389.5 km), queries real HiRISE DEM
// waypoint elevations when available, and clearly distinguishes NASA-derived
// measurements from geometric estimates without fabricating safety claims.
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Footprints,
  MapPin,
  Plus,
  RotateCcw,
  Route as RouteIcon,
  Sparkles,
  Trash2,
} from "lucide-react";
import RouteMap from "../../components/map/RouteMap";
import {
  DataField,
  EmptyState,
  SectionHeading,
  formatCoordinates,
  formatDistance,
} from "../../components/ui";
import { EXPLORATION_SITES } from "../../data/explorationSites";
import { isWithinJezeroDemBounds } from "../mars-explorer/marsExplorer.types";
import { marsDemProvider } from "../../services/providers/marsDem";
import { useMission } from "../../state/mission/MissionContext";
import type { Coordinates, Route, Waypoint } from "../../types";
import { identifyGeologicUnitAt } from "../../utils/jezeroStratigraphy";
import MissionLayout from "./MissionLayout";
import RouteStratigraphyProfile from "./RouteStratigraphyProfile";
import {
  calculateMarsSurfaceDistanceMeters,
  calculateRouteDistanceMeters,
  createId,
  toMutable,
} from "./missionHelpers";

export default function RoutePlannerPage() {
  const { mission, updateMission } = useMission();
  const navigate = useNavigate();

  const startingLocation =
    mission.configuration?.startingLocation ??
    mission.region?.coordinates ??
    null;

  const mapCenter: [number, number] = startingLocation
    ? [startingLocation.latitude, startingLocation.longitude]
    : [EXPLORATION_SITES[0].latitude, EXPLORATION_SITES[0].longitude];

  const [routeName, setRouteName] = useState("");
  const [includeReturnLeg, setIncludeReturnLeg] = useState<boolean>(
    mission.configuration?.requireReturnToBase ?? true
  );
  const [samplingDem, setSamplingDem] = useState(false);

  const [draftWaypoints, setDraftWaypoints] = useState<Waypoint[]>(() =>
    startingLocation
      ? [
          {
            id: createId("wp"),
            name: "Habitat / Landing Start",
            coordinates: { ...startingLocation },
            visited: false,
          },
        ]
      : []
  );

  function addWaypoint(
    coords: Coordinates,
    linkedTarget?: { readonly id: string; readonly name: string }
  ): void {
    const nextWp: Waypoint = {
      id: createId("wp"),
      name: linkedTarget?.name ?? `Waypoint ${draftWaypoints.length + 1}`,
      targetId: linkedTarget?.id,
      coordinates: { ...coords },
      visited: false,
    };

    setDraftWaypoints((current) => [...current, nextWp]);
  }

  function addAllTargetsToDraft(): void {
    const startWp: Waypoint[] = startingLocation
      ? [
          {
            id: createId("wp"),
            name: "Habitat / Landing Start",
            coordinates: { ...startingLocation },
            visited: false,
          },
        ]
      : [];

    const targetWps: Waypoint[] = mission.scientificTargets.map((target) => ({
      id: createId("wp"),
      name: target.name,
      targetId: target.id,
      coordinates: { ...target.coordinates },
      visited: false,
    }));

    setDraftWaypoints([...startWp, ...targetWps]);
  }

  function removeDraftWaypoint(id: string): void {
    setDraftWaypoints((current) => current.filter((wp) => wp.id !== id));
  }

  function loadJezeroStratigraphicReferenceTraverse(): void {
    const presetWaypoints: Waypoint[] = [
      {
        id: createId("wp"),
        name: "Octavia E. Butler Habitat (Crater Floor)",
        coordinates: { latitude: 18.4447, longitude: 77.4508 },
        visited: false,
      },
      {
        id: createId("wp"),
        name: "Séítah Olivine Cumulate Outcrop",
        coordinates: { latitude: 18.4295, longitude: 77.439 },
        visited: false,
      },
      {
        id: createId("wp"),
        name: "Western Delta Foreset Scarp (Smectite Clay)",
        coordinates: { latitude: 18.4585, longitude: 77.4052 },
        visited: false,
      },
      {
        id: createId("wp"),
        name: "Western Delta Topset Channel Ridge",
        coordinates: { latitude: 18.46, longitude: 77.375 },
        visited: false,
      },
    ];
    setDraftWaypoints(presetWaypoints);
    if (!routeName.trim()) {
      setRouteName("Jezero Floor-to-Delta Stratigraphic Traverse");
    }
  }

  const draftDistanceInfo = calculateRouteDistanceMeters(
    draftWaypoints,
    includeReturnLeg
  );

  async function handleSaveCandidateRoute(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (draftWaypoints.length < 2) return;

    setSamplingDem(true);

    const reachedTargetIds = Array.from(
      new Set(
        draftWaypoints
          .map((wp) => wp.targetId)
          .filter((id): id is string => Boolean(id))
      )
    );

    const dist = calculateRouteDistanceMeters(draftWaypoints, includeReturnLeg);

    // Attempt to query real HiRISE DEM elevations at waypoints if inside Jezero bounds
    let elevGain: number | undefined = undefined;
    let elevLoss: number | undefined = undefined;
    let maxSlopeDeg: number | undefined = undefined;
    let avgSlopeDeg: number | undefined = undefined;
    let demPointsSampled = 0;
    let usedLocalFallbackDem = false;

    const allWaypointsForProfile = includeReturnLeg
      ? [...draftWaypoints, draftWaypoints[0]]
      : [...draftWaypoints];

    try {
      const elevations: (number | null)[] = [];
      for (const wp of allWaypointsForProfile) {
        if (isWithinJezeroDemBounds(wp.coordinates)) {
          try {
            const res = await marsDemProvider.getElevation(wp.coordinates);
            elevations.push(res.elevation);
            demPointsSampled++;
            if (res.isFallback) {
              usedLocalFallbackDem = true;
            }
          } catch {
            elevations.push(null);
          }
        } else {
          elevations.push(null);
        }
      }

      if (demPointsSampled >= 2) {
        let gain = 0;
        let loss = 0;
        const segmentSlopes: number[] = [];
        for (let i = 0; i < allWaypointsForProfile.length - 1; i++) {
          const e1 = elevations[i];
          const e2 = elevations[i + 1];
          if (e1 !== null && e2 !== null) {
            const diff = e2 - e1;
            if (diff > 0) gain += diff;
            else loss += Math.abs(diff);

            const segDist = calculateMarsSurfaceDistanceMeters(
              allWaypointsForProfile[i].coordinates,
              allWaypointsForProfile[i + 1].coordinates
            );
            if (segDist > 1) {
              const slope =
                (Math.atan(Math.abs(diff) / segDist) * 180) / Math.PI;
              segmentSlopes.push(slope);
            }
          }
        }
        elevGain = Math.round(gain);
        elevLoss = Math.round(loss);
        if (segmentSlopes.length > 0) {
          maxSlopeDeg = Number(Math.max(...segmentSlopes).toFixed(1));
          avgSlopeDeg = Number(
            (
              segmentSlopes.reduce((a, b) => a + b, 0) / segmentSlopes.length
            ).toFixed(1)
          );
        }
      }
    } finally {
      setSamplingDem(false);
    }

    const insideJezeroCount = draftWaypoints.filter((wp) =>
      isWithinJezeroDemBounds(wp.coordinates)
    ).length;
    const coverageRatio = Math.round(
      (insideJezeroCount / draftWaypoints.length) * 100
    );

    // Estimate walking duration at ~2.2 km/h nominal EVA traverse rate
    const estimatedDurationHours = Number(
      (dist.totalMeters / 2200).toFixed(1)
    );

    const newRoute: Route = {
      id: createId("route"),
      name:
        routeName.trim() ||
        `Candidate Route ${mission.candidateRoutes.length + 1}`,
      waypoints: draftWaypoints,
      distanceMeters: dist.totalMeters,
      returnRouteIncluded: includeReturnLeg,
      returnDistanceMeters: dist.returnLegMeters,
      estimatedDurationHours,
      elevationGainMeters: elevGain,
      elevationLossMeters: elevLoss,
      measurementSource:
        demPointsSampled >= 2
          ? usedLocalFallbackDem
            ? "Jezero CTX DEM (Local) + Spherical Geometry"
            : "HiRISE DEM + Spherical Geometry"
          : "Spherical Geometry (Orbital Estimate)",
      terrainMetrics: {
        averageSlopeDegrees: avgSlopeDeg,
        maximumSlopeDegrees: maxSlopeDeg,
        dataCoverage: coverageRatio,
        knownObstacles: mission.configuration?.terrainPreferences
          .avoidKnownObstacles
          ? [
              "Sub-meter boulders and unconsolidated drift pockets require in-situ visual avoidance during Marswalk.",
            ]
          : ["Obstacle avoidance disabled in Mission Builder."],
        uncertaintyNotes:
          demPointsSampled >= 2
            ? [
                "Distances computed via spherical Mars geometry (R = 3,389.5 km); elevations sampled at waypoints from HiRISE DTM.",
                "Intermediate slopes between waypoints are straight-line interpolations and do not certify astronaut path safety.",
              ]
            : [
                "Horizontal distance computed via spherical Mars geometry (R = 3,389.5 km).",
                "HiRISE DEM elevation profile unavailable (API offline or outside Jezero DTM footprint); vertical relief is unverified.",
              ],
        assumptions: [
          "Nominal EVA walking speed of ~2.2 km/h excluding contact science station stops.",
        ],
      },
      reachedTargetIds,
    };

    const nextRoutes = [...toMutable(mission.candidateRoutes), newRoute];
    updateMission({
      candidateRoutes: nextRoutes,
      selectedRouteId: mission.selectedRouteId ?? newRoute.id,
    });

    setRouteName("");
    setDraftWaypoints(
      startingLocation
        ? [
            {
              id: createId("wp"),
              name: "Habitat / Landing Start",
              coordinates: { ...startingLocation },
              visited: false,
            },
          ]
        : []
    );
  }

  function selectRoute(id: string): void {
    updateMission({ selectedRouteId: id });
  }

  function removeRoute(id: string): void {
    const next = toMutable(mission.candidateRoutes).filter((r) => r.id !== id);
    updateMission({
      candidateRoutes: next,
      selectedRouteId:
        mission.selectedRouteId === id
          ? (next[0]?.id ?? null)
          : mission.selectedRouteId,
    });
  }

  const selectedRoute =
    mission.candidateRoutes.find((r) => r.id === mission.selectedRouteId) ??
    null;

  return (
    <MissionLayout
      stage="Stage 02 · Plan"
      title="Route Planner"
      subtitle="Plot candidate traverse waypoints on the regional Mars map, compare route alternatives and return-route distances, and confirm a primary route for Marswalk."
      nextStepHint="After confirming a route, proceed to Stage 03 (Marswalk Simulator) to walk the traverse in 3D or jump to Mission Review."
      actions={
        <>
          <Link to="/mission/builder" className="mx-btn mx-btn--secondary">
            <ArrowLeft size={15} aria-hidden="true" />
            Mission Builder
          </Link>
          <button
            type="button"
            onClick={() => navigate("/mission/simulate")}
            className="mx-btn mx-btn--primary"
          >
            <Footprints size={15} aria-hidden="true" />
            Launch Marswalk Simulator
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left 8 cols: Large regional map + Route Comparison Table */}
        <div className="flex flex-col gap-8 lg:col-span-8">
          <div className="h-[500px]">
            <RouteMap
              center={mapCenter}
              zoom={4}
              startingLocation={startingLocation}
              targets={mission.scientificTargets}
              routes={mission.candidateRoutes}
              activeRouteId={mission.selectedRouteId}
              draftWaypoints={draftWaypoints}
              onAddWaypoint={addWaypoint}
            />
          </div>

          {/* Curiosity-style Stratigraphic Cross-Section & Hazard Profile */}
          <RouteStratigraphyProfile
            waypoints={
              draftWaypoints.length >= 2
                ? draftWaypoints
                : (selectedRoute?.waypoints ?? draftWaypoints)
            }
            includeReturnLeg={
              draftWaypoints.length >= 2
                ? includeReturnLeg
                : (selectedRoute?.returnRouteIncluded ?? includeReturnLeg)
            }
            preferredSlopeDegrees={
              mission.configuration?.terrainPreferences.preferredSlopeDegrees ??
              15
            }
            routeTitle={
              draftWaypoints.length >= 2
                ? routeName.trim() || "Draft Route"
                : (selectedRoute?.name ?? "Draft Route")
            }
            onLoadReferenceTraverse={loadJezeroStratigraphicReferenceTraverse}
          />

          {/* Route comparison panel */}
          <section className="mx-panel p-6" aria-label="Route comparison">
            <SectionHeading
              eyebrow={`Route alternatives (${mission.candidateRoutes.length})`}
              title="Route Comparison & Terrain Metrics"
              icon={<RouteIcon size={18} />}
            />

            <p className="mx-body m-0 mb-4 text-xs">
              Compare candidate routes by total distance, targets reached,
              return-to-base inclusion, and DEM coverage.{" "}
              <strong className="text-mx-text">Data provenance note:</strong>{" "}
              Horizontal distances are calculated from planetocentric
              coordinates (R = 3,389.5 km). Elevation and slope values are
              shown only when sampled from the NASA HiRISE DEM API; routes are
              planning models and are not certified astronaut-safe.
            </p>

            {mission.candidateRoutes.length === 0 ? (
              <EmptyState
                compact
                title="No candidate routes saved yet"
                action={
                  mission.scientificTargets.length > 0 && (
                    <button
                      type="button"
                      onClick={addAllTargetsToDraft}
                      className="mx-btn mx-btn--secondary mx-btn--sm"
                    >
                      <Sparkles size={13} aria-hidden="true" />
                      Auto-fill Draft with All Targets
                    </button>
                  )
                }
              >
                Click on the map or click target chips on the right to assemble
                waypoints, then save a candidate route to compare alternatives.
              </EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-mx-border text-[11px] font-mono uppercase tracking-wider text-mx-dim">
                      <th className="py-3 pr-4">Route</th>
                      <th className="px-3 py-3">Targets</th>
                      <th className="px-3 py-3">Total Distance</th>
                      <th className="px-3 py-3">Return Leg</th>
                      <th className="px-3 py-3">Elevation (+ / −)</th>
                      <th className="px-3 py-3">Measurement Source</th>
                      <th className="py-3 pl-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mx-border">
                    {mission.candidateRoutes.map((route) => {
                      const active = route.id === mission.selectedRouteId;
                      const elevText =
                        route.elevationGainMeters !== undefined ||
                        route.elevationLossMeters !== undefined
                          ? `+${route.elevationGainMeters ?? 0} m / -${
                              route.elevationLossMeters ?? 0
                            } m`
                          : "Unverified (DEM offline)";

                      return (
                        <tr
                          key={route.id}
                          className={active ? "bg-mx-panel-2" : ""}
                        >
                          <td className="py-3.5 pr-4 font-display font-semibold text-mx-text">
                            <div>
                              {route.name}
                              {active && (
                                <span className="mx-badge mx-badge--accent ml-2">
                                  Confirmed
                                </span>
                              )}
                            </div>
                            <span className="mx-mono text-[11px] font-normal text-mx-dim">
                              {route.waypoints.length} waypoints · ~
                              {route.estimatedDurationHours ?? "—"} h walk
                            </span>
                          </td>
                          <td className="mx-mono px-3 py-3.5 text-mx-muted">
                            {route.reachedTargetIds.length} /{" "}
                            {mission.scientificTargets.length}
                          </td>
                          <td className="mx-mono px-3 py-3.5 text-mx-text">
                            {formatDistance(route.distanceMeters) ??
                              "Calculated on save"}
                          </td>
                          <td className="mx-mono px-3 py-3.5 text-mx-muted">
                            {route.returnRouteIncluded
                              ? `Included (${
                                  formatDistance(route.returnDistanceMeters) ??
                                  "0 m"
                                })`
                              : "One-way"}
                          </td>
                          <td className="mx-mono px-3 py-3.5 text-mx-dim">
                            {elevText}
                          </td>
                          <td className="px-3 py-3.5 text-xs text-mx-dim">
                            <span className="mx-badge">
                              {route.measurementSource ??
                                "Spherical Geometry"}
                            </span>
                          </td>
                          <td className="py-3.5 pl-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => selectRoute(route.id)}
                                className={`mx-btn mx-btn--sm ${
                                  active
                                    ? "mx-btn--primary"
                                    : "mx-btn--secondary"
                                }`}
                              >
                                {active ? (
                                  <>
                                    <Check size={13} aria-hidden="true" />{" "}
                                    Selected
                                  </>
                                ) : (
                                  "Select"
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeRoute(route.id)}
                                className="mx-icon-btn !h-8 !w-8"
                                aria-label={`Delete ${route.name}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right 4 cols: Draft Route Composer + Active Route Details */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          {/* Compose candidate route */}
          <section
            className="mx-panel p-6"
            aria-label="Compose candidate route"
          >
            <SectionHeading
              eyebrow="Step 01 · Compose Route"
              title="Draft Waypoints & Targets"
              icon={<MapPin size={18} />}
            />

            <form onSubmit={handleSaveCandidateRoute} className="grid gap-4">
              <div>
                <label htmlFor="route-name" className="mx-label">
                  Route name
                </label>
                <input
                  id="route-name"
                  type="text"
                  className="mx-input"
                  placeholder={`Candidate Route ${
                    mission.candidateRoutes.length + 1
                  }`}
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                />
              </div>

              {/* Quick-append scientific targets as waypoints */}
              {mission.scientificTargets.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="mx-label !mb-0">
                      Append scientific target
                    </span>
                    <button
                      type="button"
                      onClick={addAllTargetsToDraft}
                      className="text-xs text-mx-accent hover:underline"
                    >
                      Add all targets
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {mission.scientificTargets.map((target) => (
                      <button
                        key={target.id}
                        type="button"
                        onClick={() =>
                          addWaypoint(target.coordinates, target)
                        }
                        className="mx-chip"
                      >
                        <Plus size={11} aria-hidden="true" />
                        {target.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Return-to-base consideration */}
              <label className="flex cursor-pointer items-center gap-2.5 rounded border border-mx-border bg-mx-bg px-3 py-2.5 text-xs text-mx-text">
                <input
                  type="checkbox"
                  className="mx-checkbox"
                  checked={includeReturnLeg}
                  onChange={(e) => setIncludeReturnLeg(e.target.checked)}
                />
                <span>
                  <RotateCcw size={12} className="mr-1 inline text-mx-accent" />
                  Include Return-to-Habitat Leg (
                  {formatDistance(draftDistanceInfo.returnLegMeters) ?? "0 m"})
                </span>
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="mx-label !mb-0">
                    Draft Waypoints ({draftWaypoints.length}) ·{" "}
                    <span className="mx-mono text-mx-accent">
                      {formatDistance(draftDistanceInfo.totalMeters)}
                    </span>
                  </span>
                  {draftWaypoints.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDraftWaypoints([])}
                      className="text-xs text-mx-muted hover:text-mx-text"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {draftWaypoints.length === 0 ? (
                  <p className="mx-body m-0 rounded border border-dashed border-mx-border-strong p-3 text-xs">
                    Click on the map or a target chip above to add waypoints.
                  </p>
                ) : (
                  <ol className="m-0 flex max-h-52 list-none flex-col gap-2 overflow-auto p-0">
                    {draftWaypoints.map((wp, idx) => {
                      const wpUnit = identifyGeologicUnitAt(wp.coordinates);
                      return (
                        <li
                          key={wp.id}
                          className="flex items-center justify-between gap-2 rounded border border-mx-border bg-mx-bg px-3 py-2 text-xs"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="mx-mono text-mx-accent">
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                              <strong className="text-mx-text">
                                {wp.name ?? `Waypoint ${idx + 1}`}
                              </strong>
                              <span
                                className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                                style={{
                                  backgroundColor: `${wpUnit.color}22`,
                                  color: wpUnit.color,
                                  border: `1px solid ${wpUnit.color}55`,
                                }}
                              >
                                {wpUnit.unit_code}
                              </span>
                            </div>
                            <span className="mx-mono mt-0.5 block text-[11px] text-mx-dim">
                              {formatCoordinates(
                                wp.coordinates.latitude,
                                wp.coordinates.longitude
                              )}{" "}
                              · {wpUnit.unit_name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDraftWaypoint(wp.id)}
                            className="text-mx-muted hover:text-mx-text"
                            aria-label={`Remove ${wp.name ?? "waypoint"}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>

              <button
                type="submit"
                disabled={draftWaypoints.length < 2 || samplingDem}
                className="mx-btn mx-btn--primary mx-btn--block"
              >
                <Plus size={15} aria-hidden="true" />
                {samplingDem
                  ? "Computing Route & Querying DEM…"
                  : "Save Candidate Route (min 2 waypoints)"}
              </button>
            </form>
          </section>

          {/* Selected route details & confirm action */}
          <section className="mx-panel p-6" aria-label="Confirmed route">
            <span className="mx-eyebrow mx-eyebrow--accent">
              Step 02 · Selected Route Summary
            </span>
            {selectedRoute ? (
              <>
                <h3 className="mx-display m-0 mt-2 text-2xl">
                  {selectedRoute.name}
                </h3>
                <div className="my-4 grid grid-cols-2 gap-3.5 border-y border-mx-border py-4">
                  <DataField
                    label="Waypoints"
                    value={`${selectedRoute.waypoints.length} stops`}
                  />
                  <DataField
                    label="Targets Reached"
                    value={`${selectedRoute.reachedTargetIds.length} of ${mission.scientificTargets.length}`}
                  />
                  <DataField
                    label="Total Distance (Geometry)"
                    value={formatDistance(selectedRoute.distanceMeters)}
                  />
                  <DataField
                    label="Return-to-Base Leg"
                    value={
                      selectedRoute.returnRouteIncluded
                        ? formatDistance(selectedRoute.returnDistanceMeters)
                        : "Not included"
                    }
                  />
                  <DataField
                    label="HiRISE DEM Elevation"
                    value={
                      selectedRoute.elevationGainMeters !== undefined
                        ? `+${selectedRoute.elevationGainMeters} m / -${
                            selectedRoute.elevationLossMeters ?? 0
                          } m`
                        : undefined
                    }
                    fallback="Unverified (DEM offline)"
                  />
                  <DataField
                    label="Jezero DEM Coverage"
                    value={
                      selectedRoute.terrainMetrics?.dataCoverage !== undefined
                        ? `${selectedRoute.terrainMetrics.dataCoverage}% of waypoints`
                        : "Unverified"
                    }
                  />
                </div>

                {selectedRoute.terrainMetrics?.uncertaintyNotes &&
                  selectedRoute.terrainMetrics.uncertaintyNotes.length > 0 && (
                    <div className="mb-4 rounded border border-mx-border bg-mx-bg p-3 text-xs text-mx-muted">
                      <strong className="flex items-center gap-1.5 text-mx-text">
                        <AlertTriangle size={13} className="text-mx-accent" />
                        Terrain &amp; Measurement Uncertainty
                      </strong>
                      <ul className="m-0 mt-1.5 list-disc space-y-1 pl-4">
                        {selectedRoute.terrainMetrics.uncertaintyNotes.map(
                          (note, idx) => (
                            <li key={idx}>{note}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => navigate("/mission/simulate")}
                    className="mx-btn mx-btn--primary mx-btn--block min-h-11"
                  >
                    <Footprints size={15} aria-hidden="true" />
                    Confirm Route &amp; Launch Marswalk EVA
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/mission/review")}
                    className="mx-btn mx-btn--secondary mx-btn--block"
                  >
                    Skip to Mission Review
                  </button>
                </div>
              </>
            ) : (
              <p className="mx-body m-0 mt-2 text-xs">
                Save and select a candidate route above to confirm your
                traverse plan before launching Marswalk.
              </p>
            )}
          </section>
        </div>
      </div>
    </MissionLayout>
  );
}

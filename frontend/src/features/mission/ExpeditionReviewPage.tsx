// frontend/src/features/mission/ExpeditionReviewPage.tsx
// Expedition Review dashboard (Phase 6).
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CircleAlert,
  ClipboardCheck,
  Compass,
  FlaskConical,
  Layers,
  NotebookPen,
  Plus,
  Route as RouteIcon,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import {
  DataField,
  EmptyState,
  ImagePending,
  SectionHeading,
  formatCoordinates,
  formatDistance,
} from "../../components/ui";
import { useMission } from "../../state/mission/MissionContext";
import type { FieldNote } from "../../types";
import {
  computeStratigraphicTraverseProfile,
  identifyGeologicUnitAt,
} from "../../utils/jezeroStratigraphy";
import MissionLayout from "./MissionLayout";
import { createId, toMutable } from "./missionHelpers";

export default function ExpeditionReviewPage() {
  const { mission, updateMission, updateSimulation } = useMission();
  const isJezero = mission.region?.id === "jezero-crater";

  const [noteContent, setNoteContent] = useState("");
  const [noteTargetId, setNoteTargetId] = useState<string>("");
  const [noteLat, setNoteLat] = useState("");
  const [noteLon, setNoteLon] = useState("");

  const selectedRoute =
    mission.candidateRoutes.find((r) => r.id === mission.selectedRouteId) ??
    mission.candidateRoutes[0] ??
    null;

  const visitedSet = new Set(mission.simulation.visitedTargetIds);
  const simulatedSamples = mission.simulation.simulatedSamples ?? [];
  const suit = mission.simulation.suit;
  const env = mission.simulation.environment;

  const stratigraphicProfile = useMemo(() => {
    const waypoints =
      selectedRoute && selectedRoute.waypoints.length >= 2
        ? selectedRoute.waypoints
        : mission.scientificTargets.map((t, idx) => ({
            id: t.id,
            name: t.name || `Target ${idx + 1}`,
            coordinates: t.coordinates,
            targetId: t.id,
            visited: visitedSet.has(t.id),
          }));

    if (waypoints.length < 2) return null;
    return computeStratigraphicTraverseProfile(
      waypoints,
      {},
      selectedRoute?.returnRouteIncluded ?? false,
      mission.configuration?.terrainPreferences.preferredSlopeDegrees ?? 15
    );
  }, [
    mission.configuration?.terrainPreferences.preferredSlopeDegrees,
    mission.scientificTargets,
    selectedRoute,
    visitedSet,
  ]);

  function toggleTargetVisited(targetId: string): void {
    const current = [...mission.simulation.visitedTargetIds];
    const next = current.includes(targetId)
      ? current.filter((id) => id !== targetId)
      : [...current, targetId];

    const total = mission.scientificTargets.length;
    const progress =
      total > 0 ? Math.round((next.length / total) * 100) : 0;

    updateSimulation({
      visitedTargetIds: next,
      progressPercentage: progress,
    });
  }

  function handleAddFieldNote(event: FormEvent): void {
    event.preventDefault();
    if (!noteContent.trim()) return;

    const linkedTarget = mission.scientificTargets.find(
      (t) => t.id === noteTargetId
    );
    const parsedLat = noteLat.trim() !== "" ? Number(noteLat) : NaN;
    const parsedLon = noteLon.trim() !== "" ? Number(noteLon) : NaN;

    const coordinates =
      Number.isFinite(parsedLat) && Number.isFinite(parsedLon)
        ? { latitude: parsedLat, longitude: parsedLon }
        : linkedTarget?.coordinates ??
          mission.simulation.currentPosition ??
          mission.region?.coordinates ?? { latitude: 18.4447, longitude: 77.4508 };

    const note: FieldNote = {
      id: createId("note"),
      missionId: mission.id,
      content: noteContent.trim(),
      coordinates: { ...coordinates },
      relatedTargetId: linkedTarget?.id,
      createdAt: new Date().toISOString(),
    };

    updateMission({
      fieldNotes: [...toMutable(mission.fieldNotes), note],
    });

    setNoteContent("");
    setNoteLat("");
    setNoteLon("");
  }

  function removeFieldNote(id: string): void {
    updateMission({
      fieldNotes: toMutable(mission.fieldNotes).filter((n) => n.id !== id),
    });
  }

  return (
    <MissionLayout
      stage="Stage 04 · Review"
      title="Mission Review & Post-EVA Assessment"
      subtitle="Verify completed objectives, visited scientific targets, recorded observations, simulated EVA samples, traverse telemetry, and remaining knowledge gaps before generating your final report."
      actions={
        <>
          <Link to="/mission/simulate" className="mx-btn mx-btn--secondary">
            <ArrowLeft size={15} aria-hidden="true" />
            Marswalk Simulator
          </Link>
          <Link to="/mission/report" className="mx-btn mx-btn--primary">
            Generate Expedition Report
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </>
      }
    >
      {/* Data Provenance Classification Banner (Phase 6 Requirement) */}
      <section
        className="mx-panel mb-6 p-4"
        aria-label="Scientific data provenance classification"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="mx-eyebrow mx-eyebrow--accent">
            SCIENTIFIC PROVENANCE & DATA INTEGRITY CLASSIFICATION
          </span>
          <span className="text-[11px] text-mx-muted">
            All mission records are categorized by origin
          </span>
        </div>
        <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 p-2.5">
            <span className="font-semibold text-sky-300">
              1. Actual NASA-Derived Data
            </span>
            <p className="m-0 mt-1 text-[11px] text-mx-muted">
              PDS orbital datasets ({mission.selectedDatasets.length}), HiRISE
              DEM elevations, and USGS/NASA CTX Jezero terrain tiles.
            </p>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2.5">
            <span className="font-semibold text-emerald-300">
              2. User-Recorded Observations
            </span>
            <p className="m-0 mt-1 text-[11px] text-mx-muted">
              Investigator observations ({mission.selectedObservations.length}),
              field notes ({mission.fieldNotes.length}), and interpretations (
              {mission.interpretations.length}).
            </p>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5">
            <span className="font-semibold text-amber-300">
              3. Simulated EVA Activities
            </span>
            <p className="m-0 mt-1 text-[11px] text-mx-muted">
              Marswalk traverse ({Math.round(mission.simulation.totalTraverseMeters ?? 0)}{" "}
              m), suit telemetry, and simulated samples ({simulatedSamples.length}).
            </p>
          </div>
          <div className="rounded-lg border border-mx-accent/35 bg-mx-accent/10 p-2.5">
            <span className="font-semibold text-[#ff9d66]">
              4. Generated Mission Summaries
            </span>
            <p className="m-0 mt-1 text-[11px] text-mx-muted">
              Synthesized readiness percentages, route comparisons, and compiled
              Expedition Dossiers ({mission.reports.length}).
            </p>
          </div>
        </div>
      </section>

      {/* Top KPI / Expedition Summary Strip */}
      <section className="mx-panel mb-8 p-6" aria-label="Expedition summary">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-6">
          <DataField label="Expedition" value={mission.name} />
          <DataField
            label="Study Region"
            value={mission.region?.name}
            fallback="Jezero Crater (Default)"
          />
          <DataField
            label="Visited Targets"
            value={`${mission.simulation.visitedTargetIds.length} / ${mission.scientificTargets.length}`}
          />
          <DataField
            label="Simulated Samples"
            value={`${simulatedSamples.length} cached`}
          />
          <DataField
            label="Evidence Items"
            value={`${mission.selectedObservations.length} obs · ${mission.derivedAnalyses.length} analyses`}
          />
          <DataField
            label="EVA Return Status"
            value={
              mission.simulation.returnedToBase
                ? "Returned to Habitat"
                : mission.simulation.isActive
                  ? "On Surface Traverse"
                  : "Pre-EVA / Planned"
            }
          />
        </div>

        <div className="mt-6 grid gap-6 border-t border-mx-border pt-5 lg:grid-cols-2">
          <DataField
            label="Mission Objective"
            value={mission.objective}
            fallback="No mission objective recorded."
          />
          <DataField
            label="Investigation Question"
            value={mission.question}
            fallback="No investigation question recorded."
          />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left 6 cols: Visited Targets, Simulated Samples & Field Notes */}
        <div className="flex flex-col gap-8 lg:col-span-6">
          {/* Completed objectives & visited targets */}
          <section className="mx-panel p-6" aria-label="Visited targets">
            <SectionHeading
              eyebrow="Target checklist"
              title="Visited Scientific Targets"
              icon={<Target size={18} />}
            />

            {mission.scientificTargets.length === 0 ? (
              <EmptyState compact title="No scientific targets in mission">
                Add targets in the Investigation workspace or Mission Builder.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-2.5">
                {mission.scientificTargets.map((target) => {
                  const visited = visitedSet.has(target.id);
                  const targetUnit = isJezero ? identifyGeologicUnitAt(target.coordinates) : null;
                  return (
                    <div
                      key={target.id}
                      className={`flex items-center justify-between gap-3 rounded-lg border p-3.5 ${
                        visited
                          ? "border-mx-accent bg-mx-panel-2"
                          : "border-mx-border bg-mx-bg"
                      }`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="mx-heading m-0 text-sm">
                            {target.name}
                          </h3>
                          {targetUnit && <span
                            className="rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold"
                            style={{
                              borderColor: targetUnit.color,
                              backgroundColor: `${targetUnit.color}28`,
                              color: "#f8fafc",
                            }}
                            title={targetUnit.unit_name}
                          >
                            {targetUnit.unit_code}
                          </span>}
                          <span className="mx-badge text-[10px]">
                            {visited ? "EVA Visited" : "Pending Visit"}
                          </span>
                        </div>
                        <p className="mx-mono m-0 mt-0.5 text-[11px] text-mx-dim">
                          {formatCoordinates(
                            target.coordinates.latitude,
                            target.coordinates.longitude
                          )}{" "}
                          {targetUnit ? ` · ${targetUnit.unit_name}` : " · Regional geology unavailable"}
                        </p>
                        {target.description && (
                          <p className="m-0 mt-1 text-xs text-mx-muted">
                            {target.description}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleTargetVisited(target.id)}
                        className={`mx-btn mx-btn--sm shrink-0 ${
                          visited ? "mx-btn--primary" : "mx-btn--secondary"
                        }`}
                      >
                        {visited ? (
                          <>
                            <Check size={13} aria-hidden="true" /> Visited
                          </>
                        ) : (
                          "Mark Visited"
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Simulated Samples Collected */}
          <section
            className="mx-panel p-6"
            aria-label="Simulated samples collected"
          >
            <SectionHeading
              eyebrow={`Simulated EVA activity (${simulatedSamples.length})`}
              title="Simulated Surface Samples Collected"
              icon={<FlaskConical size={18} />}
            />

            {simulatedSamples.length === 0 ? (
              <EmptyState compact title="No simulated samples collected yet">
                Enter the{" "}
                <Link to="/mission/simulate" className="text-mx-accent underline">
                  Marswalk 3D Simulator
                </Link>{" "}
                and press <code>[E]</code> to collect simulated rock cores,
                regolith scoops, or float rock samples.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-2.5">
                {simulatedSamples.map((sample, idx) => {
                  const targetName = mission.scientificTargets.find(
                    (t) => t.id === sample.targetId
                  )?.name;
                  const unitCode =
                    sample.geologicUnitCode ??
                    (isJezero ? identifyGeologicUnitAt(sample.coordinates).unit_code : "Unavailable");
                  const tubeSerial =
                    sample.tubeId ??
                    `JZ-EVA-${String(idx + 1).padStart(2, "0")}`;
                  return (
                    <div
                      key={sample.id}
                      className="rounded-lg border border-amber-500/30 bg-amber-950/15 p-3.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm text-mx-text">
                          {sample.name}
                        </strong>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded border border-cyan-500/35 bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyan-200">
                            {tubeSerial}
                          </span>
                          <span className="rounded border border-white/20 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white">
                            {unitCode}
                          </span>
                          <span className="mx-badge">{sample.sampleType}</span>
                          <span className="mx-badge border-amber-500/40 font-mono text-[10px] text-amber-300">
                            {sample.provenanceTier ?? "SIMULATED_EVA_ACTIVITY"}
                          </span>
                        </div>
                      </div>
                      <p className="mx-mono m-0 mt-1 text-[11px] text-mx-muted">
                        {formatCoordinates(
                          sample.coordinates.latitude,
                          sample.coordinates.longitude
                        )}
                        {targetName ? ` · Target: ${targetName}` : ""}
                      </p>
                      <p className="m-0 mt-1.5 text-xs text-mx-text">
                        {sample.geologicalContext}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Field Notes */}
          <section className="mx-panel p-6" aria-label="Field notes">
            <SectionHeading
              eyebrow={`User-recorded field notes (${mission.fieldNotes.length})`}
              title="Expedition Field Notes"
              icon={<NotebookPen size={18} />}
            />

            <form
              onSubmit={handleAddFieldNote}
              className="mb-5 grid gap-3 rounded-lg border border-mx-border bg-mx-bg p-4"
            >
              <div>
                <label htmlFor="field-note-content" className="mx-label">
                  Field note entry
                </label>
                <textarea
                  id="field-note-content"
                  required
                  className="mx-input"
                  placeholder="Record geological observations, outcrop textures, or traverse conditions…"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                />
              </div>

              <div className="grid gap-2.5 sm:grid-cols-3">
                <div>
                  <label htmlFor="field-note-target" className="mx-label">
                    Related target
                  </label>
                  <select
                    id="field-note-target"
                    className="mx-input"
                    value={noteTargetId}
                    onChange={(e) => setNoteTargetId(e.target.value)}
                  >
                    <option value="">None / General</option>
                    {mission.scientificTargets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="field-note-lat" className="mx-label">
                    Latitude (°)
                  </label>
                  <input
                    id="field-note-lat"
                    type="number"
                    step="any"
                    className="mx-input"
                    placeholder="Auto"
                    value={noteLat}
                    onChange={(e) => setNoteLat(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="field-note-lon" className="mx-label">
                    Longitude (°)
                  </label>
                  <input
                    id="field-note-lon"
                    type="number"
                    step="any"
                    className="mx-input"
                    placeholder="Auto"
                    value={noteLon}
                    onChange={(e) => setNoteLon(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className="mx-btn mx-btn--primary">
                <Plus size={15} aria-hidden="true" />
                Add Field Note
              </button>
            </form>

            {mission.fieldNotes.length === 0 ? (
              <EmptyState compact title="No field notes recorded yet">
                Log field notes above or during Marswalk EVA to include them in
                the final Expedition Report.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-2.5">
                {mission.fieldNotes.map((note) => {
                  const targetName = mission.scientificTargets.find(
                    (t) => t.id === note.relatedTargetId
                  )?.name;
                  return (
                    <div
                      key={note.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-mx-border bg-mx-bg p-3.5"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="mx-mono text-[11px] text-mx-accent">
                            {formatCoordinates(
                              note.coordinates.latitude,
                              note.coordinates.longitude
                            )}
                          </span>
                          {targetName && (
                            <span className="mx-badge">{targetName}</span>
                          )}
                          <span className="mx-badge border-emerald-500/30 text-emerald-300 text-[10px]">
                            USER NOTE
                          </span>
                        </div>
                        <p className="m-0 mt-1.5 text-sm text-mx-text">
                          {note.content}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFieldNote(note.id)}
                        className="mx-icon-btn !h-8 !w-8 shrink-0"
                        aria-label="Remove field note"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right 6 cols: Evidence Examined, Route & EVA Conditions, Knowledge Gaps */}
        <div className="flex flex-col gap-8 lg:col-span-6">
          {/* Evidence examined */}
          <section className="mx-panel p-6" aria-label="Evidence examined">
            <SectionHeading
              eyebrow="Evidence synthesis"
              title="NASA Datasets & Recorded Observations"
              icon={<ScanSearch size={18} />}
            />

            {mission.selectedDatasets.length > 0 && (
              <div className="mb-4 rounded-lg border border-sky-500/30 bg-sky-950/15 p-3.5">
                <span className="mx-eyebrow text-sky-300">
                  ACTUAL NASA-DERIVED ORBITAL DATASETS (
                  {mission.selectedDatasets.length})
                </span>
                <ul className="m-0 mt-2 list-disc space-y-1 pl-4 text-xs text-mx-text">
                  {mission.selectedDatasets.map((ds) => (
                    <li key={ds.id}>
                      <strong>{ds.name}</strong> ({ds.source})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {mission.selectedObservations.length === 0 &&
            mission.interpretations.length === 0 ? (
              <EmptyState compact title="No observations or interpretations">
                Record observations and interpretations in the Investigation,
                Evidence Inspector, or Marswalk workspaces.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-3">
                {mission.selectedObservations.map((obs) => (
                  <div
                    key={obs.id}
                    className="rounded-lg border border-mx-border bg-mx-bg p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="mx-eyebrow mx-eyebrow--accent">
                        {obs.source}
                      </span>
                      <span className="mx-badge border-emerald-500/30 text-emerald-300 text-[10px]">
                        USER OBSERVATION
                      </span>
                    </div>
                    <h4 className="mx-heading m-0 mt-1 text-sm">{obs.name}</h4>
                    {obs.coordinates && (
                      <p className="mx-mono m-0 mt-0.5 text-[11px] text-mx-dim">
                        {formatCoordinates(
                          obs.coordinates.latitude,
                          obs.coordinates.longitude
                        )}
                      </p>
                    )}
                    {obs.description && (
                      <p className="mx-body m-0 mt-1 text-xs">
                        {obs.description}
                      </p>
                    )}

                    {/* Attached Perseverance Ground-Truth Outcrop Frame */}
                    {obs.surfaceImage && (
                      <div className="mt-2.5 rounded-lg border border-cyan-500/30 bg-cyan-950/15 p-2.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-cyan-300">
                            <Camera size={11} />
                            PERSEVERANCE GROUND-TRUTH (SOL{" "}
                            {obs.surfaceImage.sol} ·{" "}
                            {obs.surfaceImage.instrument})
                          </span>
                          <span className="font-mono text-[10px] text-mx-muted">
                            Site {obs.surfaceImage.site ?? "—"} / Drive{" "}
                            {obs.surfaceImage.drive ?? "—"}
                          </span>
                        </div>
                        <p className="m-0 mt-1 text-[11px] text-mx-muted">
                          {obs.surfaceImage.caption}
                        </p>
                      </div>
                    )}
                  </div>
                ))}

                {mission.interpretations.map((interp) => (
                  <div
                    key={interp.id}
                    className="rounded-lg border border-mx-border bg-mx-panel-2 p-3.5"
                  >
                    <span className="mx-eyebrow">
                      Scientific Interpretation ({interp.generatedBy})
                    </span>
                    <p className="m-0 mt-1 text-xs text-mx-text">
                      {interp.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Route & EVA Telemetry Information */}
          <section
            className="mx-panel p-6"
            aria-label="Route and EVA conditions"
          >
            <SectionHeading
              eyebrow="Traverse & suit telemetry"
              title="Route Taken & Simulated EVA Conditions"
              icon={<RouteIcon size={18} />}
            />

            {!selectedRoute ? (
              <EmptyState compact title="No primary route planned">
                Select or create a route in the Route Planner.
              </EmptyState>
            ) : (
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-mx-border bg-mx-bg p-4 sm:grid-cols-3">
                <DataField label="Route Name" value={selectedRoute.name} />
                <DataField
                  label="Waypoints"
                  value={`${selectedRoute.waypoints.length} stops`}
                />
                <DataField
                  label="Targets Reached"
                  value={`${selectedRoute.reachedTargetIds.length}`}
                />
                <DataField
                  label="Planned Distance"
                  value={formatDistance(selectedRoute.distanceMeters)}
                  fallback="Pending"
                />
                <DataField
                  label="Return Route"
                  value={
                    selectedRoute.returnRouteIncluded
                      ? `Included (+${formatDistance(selectedRoute.returnDistanceMeters)})`
                      : "One-way traverse"
                  }
                />
                <DataField
                  label="Elevation Gain / Loss"
                  value={
                    selectedRoute.elevationGainMeters !== undefined
                      ? `+${selectedRoute.elevationGainMeters} m / -${
                          selectedRoute.elevationLossMeters ?? 0
                        } m`
                      : undefined
                  }
                  fallback="Spherical Geometry Estimate"
                />
              </div>
            )}

            {/* Phase 4/6: Traversed USGS SIM 3464 Stratigraphic Column & Contact Crossings */}
            {stratigraphicProfile && (
              <div className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-950/15 p-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                    <Layers size={12} />
                    TRAVERSED USGS SIM 3464 STRATIGRAPHIC COLUMN
                  </span>
                  <span className="font-mono text-[10px] text-cyan-200">
                    {stratigraphicProfile.uniqueUnitsTraversed.length} Formations ·{" "}
                    {stratigraphicProfile.contacts.length} Contacts
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {stratigraphicProfile.uniqueUnitsTraversed.map((unit, idx) => (
                    <div key={unit.unit_code} className="flex items-center gap-1.5">
                      <span
                        className="rounded border px-2 py-0.5 font-mono text-[10px] font-bold"
                        style={{
                          borderColor: unit.color,
                          backgroundColor: `${unit.color}28`,
                          color: "#f8fafc",
                        }}
                      >
                        [{unit.unit_code}] {unit.unit_name}
                      </span>
                      {idx < stratigraphicProfile.uniqueUnitsTraversed.length - 1 && (
                        <span className="font-mono text-mx-muted">→</span>
                      )}
                    </div>
                  ))}
                </div>

                {stratigraphicProfile.contacts.length > 0 && (
                  <ul className="m-0 mt-2.5 list-disc space-y-1 pl-4 text-[11px] text-mx-muted">
                    {stratigraphicProfile.contacts.map((c) => (
                      <li key={c.id} className="text-mx-text">
                        {c.summary}
                      </li>
                    ))}
                  </ul>
                )}

                {(stratigraphicProfile.steepHazardSegments.length > 0 ||
                  stratigraphicProfile.sandHazardSegments.length > 0) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-cyan-500/20 pt-2 text-[11px] text-amber-200">
                    <AlertTriangle size={12} className="text-amber-400" />
                    <span>
                      <strong>
                        {stratigraphicProfile.steepHazardSegments.length +
                          stratigraphicProfile.sandHazardSegments.length}{" "}
                        Traversal Hazard Zone(s) Evaluated:
                      </strong>{" "}
                      {stratigraphicProfile.steepHazardSegments.length} steep slope
                      (&gt;15°) · {stratigraphicProfile.sandHazardSegments.length}{" "}
                      low-thermal-inertia sand unit(s).
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Simulated Marswalk Suit & Environmental Conditions Summary */}
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/10 p-4 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="mx-eyebrow text-amber-300">
                  SIMULATED MARSWALK EVA & SUIT CONDITIONS
                </span>
                <span className="mx-badge border-amber-500/40 text-amber-300">
                  SIMULATED TELEMETRY
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <span className="text-mx-muted">EVA Traverse</span>
                  <p className="mx-mono m-0 mt-0.5 font-semibold text-mx-text">
                    {Math.round(mission.simulation.totalTraverseMeters ?? 0)} m
                  </p>
                </div>
                <div>
                  <span className="text-mx-muted">Suit O₂ / Pressure</span>
                  <p className="mx-mono m-0 mt-0.5 font-semibold text-mx-text">
                    {suit?.oxygenPercent.toFixed(1) ?? "98.0"}% ·{" "}
                    {suit?.suitPressureKpa ?? 29.6} kPa
                  </p>
                </div>
                <div>
                  <span className="text-mx-muted">Ambient Env</span>
                  <p className="mx-mono m-0 mt-0.5 font-semibold text-mx-text">
                    {env?.surfaceTempCelsius ?? -58}°C ·{" "}
                    {env?.atmosphericPressurePa ?? 735} Pa
                  </p>
                </div>
                <div>
                  <span className="text-mx-muted">Dust / Contingency</span>
                  <p className="mx-mono m-0 mt-0.5 font-semibold text-mx-text">
                    {env?.contingencyActive ??
                      `Nominal (τ=${env?.dustOpticalDepthTau ?? 0.45})`}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Knowledge gaps */}
          <section className="mx-panel p-6" aria-label="Knowledge gaps">
            <SectionHeading
              eyebrow={`Open uncertainties (${mission.knowledgeGaps.length})`}
              title="Remaining Knowledge Gaps"
              icon={<CircleAlert size={18} />}
            />

            {mission.knowledgeGaps.length === 0 ? (
              <EmptyState compact title="No open knowledge gaps recorded">
                Use the Knowledge Gap Inspector to document unresolved questions
                or data limitations.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-2.5">
                {mission.knowledgeGaps.map((gap) => (
                  <div
                    key={gap.id}
                    className="rounded-lg border border-mx-border bg-mx-bg p-3.5"
                  >
                    <h4 className="mx-heading m-0 text-sm">
                      {gap.description}
                    </h4>
                    <p className="mx-body m-0 mt-1 text-xs">
                      Cause: {gap.reason}
                    </p>
                    {gap.significance && (
                      <p className="m-0 mt-1 text-xs text-mx-muted">
                        <strong>Why it matters:</strong> {gap.significance}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex justify-end">
            <Link
              to="/mission/report"
              className="mx-btn mx-btn--primary min-h-11"
            >
              <ClipboardCheck size={16} aria-hidden="true" />
              Proceed to Expedition Report
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </MissionLayout>
  );
}

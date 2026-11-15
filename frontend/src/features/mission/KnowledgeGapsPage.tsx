// frontend/src/features/mission/KnowledgeGapsPage.tsx
// Knowledge Gap Inspector (Phase 3D): groups gaps by investigation question or
// scientific target, explains why each gap matters for surface fieldwork, and
// provides contextual actions back to Investigation, Evidence, or Mission Builder.
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Database,
  Layers,
  Plus,
  ScanSearch,
  Target,
  Trash2,
} from "lucide-react";
import {
  DataField,
  EmptyState,
  SectionHeading,
} from "../../components/ui";
import { getDatasetDisciplineCategory } from "../../data/evidenceDatasets";
import { type MapLayerCategory } from "../../data/mapLayers";
import { useMission } from "../../state/mission/MissionContext";
import type { KnowledgeGap } from "../../types";
import MissionLayout from "./MissionLayout";
import { createId, toMutable } from "./missionHelpers";

const COVERAGE_CATEGORIES: {
  id: MapLayerCategory;
  label: string;
  typicalResolution: string;
  surfaceImplication: string;
}[] = [
  {
    id: "basemap",
    label: "Visible & Shaded Relief Basemaps",
    typicalResolution: "Global WMTS (~230–460 m/px)",
    surfaceImplication:
      "Cannot resolve meter-scale boulders, bedding planes, or fracture networks.",
  },
  {
    id: "elevation",
    label: "Elevation & Surface Roughness",
    typicalResolution: "MOLA Global (~463 m/px) · HiRISE Jezero DTM (~1 m/px)",
    surfaceImplication:
      "Local scarps and regolith traction hazards below 1 m require astronaut visual assessment.",
  },
  {
    id: "composition",
    label: "Mineralogical Composition (TES)",
    typicalResolution: "Global TES (~3–8 km/px)",
    surfaceImplication:
      "Averages spectral signatures across entire landforms; requires contact spectroscopy on outcrops.",
  },
  {
    id: "thermal",
    label: "Thermal Inertia & Night/Day IR (TES / THEMIS)",
    typicalResolution: "THEMIS IR (~100 m/px) · TES (~3 km/px)",
    surfaceImplication:
      "Indicates bulk grain consolidation but cannot distinguish thin dust veneers from indurated crust.",
  },
  {
    id: "atmosphere",
    label: "Dust Cover & Atmospheric Opacity (TES)",
    typicalResolution: "Global TES (~3–8 km/px)",
    surfaceImplication:
      "Surface dust coatings obscure primary rock mineralogy until abraded or cored in situ.",
  },
  {
    id: "geology",
    label: "Contact & Stratigraphic Mapping",
    typicalResolution: "Requires surface / rover follow-up",
    surfaceImplication:
      "Fine-scale sedimentary structures (cross-bedding, mudcracks) require field inspection.",
  },
];

export default function KnowledgeGapsPage() {
  const { mission, updateMission } = useMission();

  const [showGapForm, setShowGapForm] = useState(
    mission.knowledgeGaps.length === 0
  );
  const [gapDescription, setGapDescription] = useState("");
  const [gapReason, setGapReason] = useState("");
  const [gapSignificance, setGapSignificance] = useState("");
  const [relatedTargetId, setRelatedTargetId] = useState<string>("");
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<string[]>([]);
  const [selectedObsIds, setSelectedObsIds] = useState<string[]>([]);

  function handleAddGap(event: FormEvent): void {
    event.preventDefault();
    if (!gapDescription.trim() || !gapReason.trim()) return;

    const next: KnowledgeGap = {
      id: createId("gap"),
      description: gapDescription.trim(),
      reason: gapReason.trim(),
      significance:
        gapSignificance.trim() ||
        "Requires targeted surface EVA inspection or contact sampling to resolve orbital ambiguity.",
      relatedTargetId: relatedTargetId || undefined,
      relatedDatasetIds: selectedDatasetIds,
      relatedObservationIds: selectedObsIds,
    };

    updateMission({
      knowledgeGaps: [...toMutable(mission.knowledgeGaps), next],
    });

    setGapDescription("");
    setGapReason("");
    setGapSignificance("");
    setRelatedTargetId("");
    setSelectedDatasetIds([]);
    setSelectedObsIds([]);
    setShowGapForm(false);
  }

  function removeGap(id: string): void {
    updateMission({
      knowledgeGaps: toMutable(mission.knowledgeGaps).filter(
        (g) => g.id !== id
      ),
    });
  }

  // Gather all limitations recorded across datasets, observations, and interpretations
  const aggregatedUncertainties: { source: string; note: string }[] = [];
  for (const ds of mission.selectedDatasets) {
    for (const lim of ds.provenance?.limitations ?? []) {
      aggregatedUncertainties.push({
        source: `Dataset · ${ds.name}`,
        note: lim,
      });
    }
  }
  for (const obs of mission.selectedObservations) {
    for (const lim of obs.provenance?.limitations ?? []) {
      aggregatedUncertainties.push({
        source: `Observation · ${obs.name}`,
        note: lim,
      });
    }
  }
  for (const interp of mission.interpretations) {
    for (const lim of interp.limitations) {
      aggregatedUncertainties.push({
        source: "Scientific Interpretation",
        note: lim,
      });
    }
  }

  // Group knowledge gaps by Investigation Question (general) vs. Scientific Targets
  const questionLevelGaps = mission.knowledgeGaps.filter(
    (g) => !g.relatedTargetId
  );
  const targetGroups = mission.scientificTargets
    .map((target) => ({
      target,
      gaps: mission.knowledgeGaps.filter(
        (g) => g.relatedTargetId === target.id
      ),
    }))
    .filter((group) => group.gaps.length > 0);

  return (
    <MissionLayout
      stage="Stage 01 · Investigate"
      title="Knowledge Gaps"
      subtitle="Identify what orbital remote sensing cannot answer due to spatial resolution, dust cover, or missing instrumentation—establishing the scientific rationale for your surface expedition."
      nextStepHint="Once knowledge gaps are documented, proceed to Stage 02 (Mission Builder) to configure an EVA expedition that addresses them."
      actions={
        <>
          <Link to="/mission/evidence" className="mx-btn mx-btn--secondary">
            <ArrowLeft size={15} aria-hidden="true" />
            Evidence Inspector
          </Link>
          <Link to="/mission/builder" className="mx-btn mx-btn--primary">
            Proceed to Mission Builder
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left 6 cols: Coverage Matrix, Why Gaps Matter & Aggregated Uncertainties */}
        <div className="flex flex-col gap-8 lg:col-span-6">
          {/* 1. Available vs. Missing Discipline Coverage */}
          <section className="mx-panel p-6" aria-label="Available evidence">
            <SectionHeading
              eyebrow="Orbital vs. In-Situ Capability"
              title="Dataset Coverage & Resolution Limits"
              icon={<Database size={18} />}
              action={
                <Link
                  to="/mission/investigate"
                  className="text-xs text-mx-accent no-underline hover:underline"
                >
                  Manage Datasets →
                </Link>
              }
            />

            <p className="mx-body m-0 mb-4 text-xs">
              Why knowledge gaps matter: Orbital datasets provide broad
              planetary context, but their spatial footprint and atmospheric
              dust interference leave critical questions unanswered until an
              astronaut or rover inspects the outcrop in situ.
            </p>

            <div className="grid grid-cols-2 gap-4 rounded-lg border border-mx-border bg-mx-bg p-4 sm:grid-cols-4">
              <DataField
                label="Selected Datasets"
                value={String(mission.selectedDatasets.length)}
              />
              <DataField
                label="Observations"
                value={String(mission.selectedObservations.length)}
              />
              <DataField
                label="Derived Analyses"
                value={String(mission.derivedAnalyses.length)}
              />
              <DataField
                label="Identified Gaps"
                value={String(mission.knowledgeGaps.length)}
              />
            </div>

            {/* Category coverage matrix */}
            <div className="mt-5 flex flex-col gap-2.5">
              <span className="mx-field__label">
                Discipline Coverage &amp; Surface Fieldwork Rationale
              </span>
              {COVERAGE_CATEGORIES.map((cat) => {
                const matchingInMission = mission.selectedDatasets.filter(
                  (ds) => getDatasetDisciplineCategory(ds.id) === cat.id
                );

                const covered = matchingInMission.length > 0;

                return (
                  <div
                    key={cat.id}
                    className="rounded-lg border border-mx-border bg-mx-bg px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="m-0 text-sm font-medium text-mx-text">
                          {cat.label}
                        </p>
                        <p className="mx-mono m-0 mt-0.5 text-[11px] text-mx-dim">
                          {cat.typicalResolution}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`mx-badge ${
                            covered ? "mx-badge--success" : "mx-badge--danger"
                          }`}
                        >
                          {covered
                            ? `${matchingInMission.length} active`
                            : "Missing coverage"}
                        </span>
                        {!covered && cat.id !== "geology" && (
                          <Link
                            to="/mission/investigate"
                            className="font-mono text-[11px] text-mx-accent no-underline hover:underline"
                          >
                            Select
                          </Link>
                        )}
                      </div>
                    </div>
                    <p className="mx-body m-0 mt-1.5 text-xs">
                      <strong>Orbital limit:</strong> {cat.surfaceImplication}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. Aggregated Uncertainties with quick-convert to Knowledge Gap */}
          <section className="mx-panel p-6" aria-label="Uncertainty log">
            <SectionHeading
              eyebrow={`Recorded constraints (${aggregatedUncertainties.length})`}
              title="Provenance & Measurement Uncertainties"
              icon={<Layers size={18} />}
            />

            {aggregatedUncertainties.length === 0 ? (
              <EmptyState
                compact
                title="No dataset or observation uncertainties logged yet"
              >
                Select datasets in the Investigation workspace or record
                measurement limitations in the Evidence Inspector.
              </EmptyState>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {aggregatedUncertainties.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start justify-between gap-3 rounded-lg border border-mx-border bg-mx-bg p-3.5"
                  >
                    <div>
                      <span className="mx-eyebrow">{item.source}</span>
                      <p className="mx-body m-0 mt-1 text-xs">{item.note}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setGapDescription(item.note);
                        setGapReason(`Constraint from ${item.source}`);
                        setShowGapForm(true);
                      }}
                      className="mx-btn mx-btn--secondary mx-btn--sm shrink-0"
                    >
                      Promote to Gap
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right 6 cols: Grouped Knowledge Gaps & Contextual Actions */}
        <div className="flex flex-col gap-8 lg:col-span-6">
          <section className="mx-panel p-6" aria-label="Knowledge gaps">
            <SectionHeading
              eyebrow={`Knowledge gaps (${mission.knowledgeGaps.length})`}
              title="Identified Knowledge Gaps"
              icon={<CircleAlert size={18} />}
              action={
                <button
                  type="button"
                  onClick={() => setShowGapForm((prev) => !prev)}
                  aria-expanded={showGapForm}
                  className={`mx-btn mx-btn--sm ${
                    showGapForm ? "mx-btn--secondary" : "mx-btn--primary"
                  }`}
                >
                  {showGapForm ? (
                    <>
                      <ChevronUp size={14} /> Hide Form
                    </>
                  ) : (
                    <>
                      <Plus size={14} /> Record Gap
                    </>
                  )}
                </button>
              }
            />

            {showGapForm && (
              <form
                onSubmit={handleAddGap}
                className="mb-6 grid gap-3.5 rounded-lg border border-mx-border-strong bg-mx-bg p-4"
              >
                <div>
                  <label htmlFor="gap-desc" className="mx-label">
                    Missing observation or unanswered question *
                  </label>
                  <textarea
                    id="gap-desc"
                    required
                    className="mx-input"
                    placeholder="e.g., Sub-meter grain size and hydration state of the basal delta beds cannot be resolved from orbit."
                    value={gapDescription}
                    onChange={(e) => setGapDescription(e.target.value)}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="gap-reason" className="mx-label">
                      Root cause (resolution, dust cover, etc.) *
                    </label>
                    <input
                      id="gap-reason"
                      type="text"
                      required
                      className="mx-input"
                      placeholder="e.g., TES footprint (~3 km) averages across distinct lobes"
                      value={gapReason}
                      onChange={(e) => setGapReason(e.target.value)}
                    />
                  </div>

                  <div>
                    <label htmlFor="gap-target" className="mx-label">
                      Group by scientific target (optional)
                    </label>
                    <select
                      id="gap-target"
                      className="mx-input"
                      value={relatedTargetId}
                      onChange={(e) => setRelatedTargetId(e.target.value)}
                    >
                      <option value="">
                        General / Investigation Question Level
                      </option>
                      {mission.scientificTargets.map((t) => (
                        <option key={t.id} value={t.id}>
                          Target: {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="gap-sig" className="mx-label">
                    Why this gap matters for the expedition
                  </label>
                  <input
                    id="gap-sig"
                    type="text"
                    className="mx-input"
                    placeholder="e.g., Determines whether basal beds preserve clay-bound organic biosignatures during EVA sampling"
                    value={gapSignificance}
                    onChange={(e) => setGapSignificance(e.target.value)}
                  />
                </div>

                {mission.selectedDatasets.length > 0 && (
                  <div>
                    <label htmlFor="gap-datasets" className="mx-label">Related datasets</label>
                    <select id="gap-datasets" multiple size={Math.min(6, mission.selectedDatasets.length)} className="mx-input min-h-24" value={selectedDatasetIds} onChange={(event) => setSelectedDatasetIds(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>
                      {mission.selectedDatasets.map((ds) => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
                    </select>
                    <p className="mx-hint">Use Ctrl (Windows) or Command (Mac) to select multiple items.</p>
                  </div>
                )}

                {mission.selectedObservations.length > 0 && (
                  <div>
                    <label htmlFor="gap-observations" className="mx-label">Related observations</label>
                    <select id="gap-observations" multiple size={Math.min(6, mission.selectedObservations.length)} className="mx-input min-h-24" value={selectedObsIds} onChange={(event) => setSelectedObsIds(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>
                      {mission.selectedObservations.map((obs) => <option key={obs.id} value={obs.id}>{obs.name}</option>)}
                    </select>
                    <p className="mx-hint">Use Ctrl (Windows) or Command (Mac) to select multiple items.</p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  {mission.knowledgeGaps.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowGapForm(false)}
                      className="mx-btn mx-btn--secondary mx-btn--sm"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    className="mx-btn mx-btn--primary mx-btn--sm"
                  >
                    <Plus size={14} aria-hidden="true" />
                    Save Knowledge Gap
                  </button>
                </div>
              </form>
            )}

            {mission.knowledgeGaps.length === 0 ? (
              <EmptyState
                icon={<ScanSearch size={24} />}
                compact
                title="No knowledge gaps documented yet"
              >
                Document missing observations, coverage gaps, or spatial
                resolution limits here so the Mission Builder and Marswalk EVA
                can target them.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-5">
                {/* Group 1: Investigation-level Knowledge Gaps */}
                {questionLevelGaps.length > 0 && (
                  <div>
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="mx-eyebrow mx-eyebrow--accent">
                        Investigation Question Gaps ({questionLevelGaps.length})
                      </span>
                      {mission.question && (
                        <span className="truncate max-w-xs text-[11px] text-mx-dim">
                          {mission.question}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {questionLevelGaps.map((gap) => (
                        <GapCard
                          key={gap.id}
                          gap={gap}
                          onRemove={() => removeGap(gap.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Group 2: Target-specific Knowledge Gaps */}
                {targetGroups.map(({ target, gaps }) => (
                  <div key={target.id}>
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="mx-eyebrow mx-eyebrow--accent flex items-center gap-1.5">
                        <Target size={12} />
                        Target: {target.name} ({gaps.length})
                      </span>
                      <Link
                        to="/mission/builder"
                        className="text-xs text-mx-accent no-underline hover:underline"
                      >
                        Include in Mission →
                      </Link>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {gaps.map((gap) => (
                        <GapCard
                          key={gap.id}
                          gap={gap}
                          onRemove={() => removeGap(gap.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Next Stage Transition Banner */}
            <div className="mt-6 rounded-lg border border-mx-border bg-mx-bg p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="mx-eyebrow mx-eyebrow--accent">
                    Stage 01 Complete → Ready for Stage 02 (Plan)
                  </span>
                  <p className="mx-body m-0 mt-1 text-xs">
                    Carry your targets and knowledge gaps into the{" "}
                    <strong>Mission Builder</strong> to configure your surface
                    expedition.
                  </p>
                </div>
                <Link
                  to="/mission/builder"
                  className="mx-btn mx-btn--primary mx-btn--sm"
                >
                  Open Mission Builder
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </MissionLayout>
  );
}

function GapCard({
  gap,
  onRemove,
}: {
  gap: {
    readonly id: string;
    readonly description: string;
    readonly reason: string;
    readonly relatedDatasetIds: readonly string[];
    readonly relatedObservationIds: readonly string[];
    readonly relatedTargetId?: string;
    readonly significance?: string;
  };
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-mx-border bg-mx-bg p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mx-badge mx-badge--accent">Knowledge Gap</span>
          {(gap.relatedDatasetIds.length > 0 ||
            gap.relatedObservationIds.length > 0) && (
            <span className="mx-mono text-[11px] text-mx-dim">
              {gap.relatedDatasetIds.length} dataset(s) ·{" "}
              {gap.relatedObservationIds.length} obs
            </span>
          )}
        </div>
        <h3 className="mx-heading m-0 mt-2 text-sm">{gap.description}</h3>
        <p className="mx-body m-0 mt-1 text-xs">
          <strong className="text-mx-text">Root cause:</strong> {gap.reason}
        </p>
        {gap.significance && (
          <p className="mx-body m-0 mt-1 text-xs">
            <strong className="text-mx-text">Why it matters:</strong>{" "}
            {gap.significance}
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap gap-3 text-xs">
          <Link
            to="/mission/investigate"
            className="text-mx-muted no-underline hover:text-mx-text"
          >
            Revisit Datasets →
          </Link>
          <Link
            to="/mission/evidence"
            className="text-mx-muted no-underline hover:text-mx-text"
          >
            Inspect Evidence →
          </Link>
          <Link
            to="/mission/builder"
            className="text-mx-accent no-underline hover:underline"
          >
            Address in Mission Plan →
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="mx-icon-btn !h-8 !w-8 shrink-0"
        aria-label="Remove knowledge gap"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

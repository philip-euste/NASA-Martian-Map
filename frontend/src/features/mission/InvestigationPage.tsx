// frontend/src/features/mission/InvestigationPage.tsx
// Guided Scientific Investigation Workspace (Phase 3C).
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Database,
  FlaskConical,
  Info,
  MapPin,
  Pencil,
  Plus,
  ScanSearch,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import {
  DataField,
  EmptyState,
  SectionHeading,
  formatCoordinates,
} from "../../components/ui";
import { EXPLORATION_SITES } from "../../data/explorationSites";
import {
  EVIDENCE_CATEGORY_LABELS,
  EVIDENCE_DATASETS,
  EVIDENCE_DATASETS_BY_ID,
  resolveDatasetMetadata,
  toMissionDataset,
  type EvidenceDatasetCategory,
  type EvidenceDatasetEntry,
} from "../../data/evidenceDatasets";
import { useMission } from "../../state/mission/MissionContext";
import type { Observation, UserHypothesis } from "../../types";
import MissionLayout from "./MissionLayout";
import MedaEnvironmentalPanel from "./MedaEnvironmentalPanel";
import PerseveranceImageryPanel from "./PerseveranceImageryPanel";
import {
  buildRegion,
  buildTarget,
  createId,
  toMutable,
} from "./missionHelpers";

const EXAMPLE_QUESTIONS: { label: string; question: string; regionId: string }[] = [
  {
    label: "Jezero Delta Habitability",
    regionId: "jezero-crater",
    question:
      "Does the western delta of Jezero Crater preserve fine-grained phyllosilicate-bearing strata deposited in a persistent standing lake?",
  },
  {
    label: "Gale Crater Sedimentary History",
    regionId: "gale-crater",
    question:
      "How do thermal inertia and mineralogical transitions across lower Aeolis Mons record the shift from lacustrine to sulfate-rich arid conditions?",
  },
  {
    label: "Valles Marineris Wall Stratigraphy",
    regionId: "valles-marineris",
    question:
      "What does exposed canyon wall layering reveal about early Martian crustal composition and subsurface volatile release?",
  },
];

export default function InvestigationPage() {
  const { mission, setRegion, updateMission } = useMission();

  // Question draft with explicit save/unsaved tracking + immediate sync
  const [questionDraft, setQuestionDraft] = useState(mission.question);
  useEffect(() => {
    setQuestionDraft(mission.question);
  }, [mission.question]);

  const questionHasUnsavedChanges = questionDraft !== mission.question;

  function saveQuestionNow(): void {
    updateMission({ question: questionDraft });
  }

  // Dataset filtering & progressive disclosure
  const [categoryFilter, setCategoryFilter] = useState<
    EvidenceDatasetCategory | "all" | "selected"
  >("all");
  const [datasetSearch, setDatasetSearch] = useState("");
  const [expandedDatasetIds, setExpandedDatasetIds] = useState<Set<string>>(
    () => new Set()
  );

  // Progressive disclosure toggles for forms
  const [showObsForm, setShowObsForm] = useState(
    mission.selectedObservations.length === 0
  );
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [showHypotheses, setShowHypotheses] = useState(false);
  const [showMedaInspector, setShowMedaInspector] = useState(false);
  const [showRoverImagery, setShowRoverImagery] = useState(false);

  // Observation draft state — default to first selected empirical evidence dataset
  const defaultEvidenceId =
    mission.selectedDatasets.find((d) => d.id in EVIDENCE_DATASETS_BY_ID)?.id ??
    "hirise_jezero_dtm";

  const [obsName, setObsName] = useState("");
  const [obsDatasetId, setObsDatasetId] = useState<string>(defaultEvidenceId);
  const [obsLat, setObsLat] = useState("");
  const [obsLon, setObsLon] = useState("");
  const [obsDescription, setObsDescription] = useState("");
  const [obsLimitation, setObsLimitation] = useState("");
  const [obsValidationMsg, setObsValidationMsg] = useState<string | null>(null);
  const [editingObsId, setEditingObsId] = useState<string | null>(null);

  const [obsDate, setObsDate] = useState(mission.temporal.selectedDate);
  const [obsDateManuallyChanged, setObsDateManuallyChanged] = useState(false);

  useEffect(() => {
    if (!obsDateManuallyChanged) {
      setObsDate(mission.temporal.selectedDate);
    }
  }, [mission.temporal.selectedDate, obsDateManuallyChanged]);

  // Target draft state
  const [targetName, setTargetName] = useState("");
  const [targetLat, setTargetLat] = useState("");
  const [targetLon, setTargetLon] = useState("");
  const [targetDesc, setTargetDesc] = useState("");
  const [targetValidationMsg, setTargetValidationMsg] = useState<string | null>(
    null
  );

  // Hypothesis draft state
  const [hypothesisText, setHypothesisText] = useState("");

  const selectedDatasetIds = useMemo(
    () => new Set(mission.selectedDatasets.map((d) => d.id)),
    [mission.selectedDatasets]
  );

  const filteredDatasets = useMemo(() => {
    return EVIDENCE_DATASETS.filter((entry) => {
      if (categoryFilter === "selected") {
        if (!selectedDatasetIds.has(entry.id)) return false;
      } else if (categoryFilter !== "all" && entry.category !== categoryFilter) {
        return false;
      }
      if (datasetSearch.trim()) {
        const q = datasetSearch.trim().toLowerCase();
        const hay =
          `${entry.name} ${entry.instrument} ${entry.mission} ${entry.description} ${entry.measurementProvided} ${EVIDENCE_CATEGORY_LABELS[entry.category]}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [categoryFilter, datasetSearch, selectedDatasetIds]);

  function toggleDataset(entry: EvidenceDatasetEntry): void {
    const current = toMutable(mission.selectedDatasets);
    const exists = current.some((d) => d.id === entry.id);
    const next = exists
      ? current.filter((d) => d.id !== entry.id)
      : [...current, toMissionDataset(entry)];

    updateMission({ selectedDatasets: next });
  }

  function toggleDatasetDetails(id: string): void {
    setExpandedDatasetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAddObservation(event: FormEvent): void {
    event.preventDefault();
    setObsValidationMsg(null);

    if (!obsName.trim()) {
      setObsValidationMsg("Please provide a descriptive observation title.");
      return;
    }
    if (!obsDate) {
      setObsValidationMsg("Please specify an observation date (UTC).");
      return;
    }

    const latNum = obsLat.trim() !== "" ? Number(obsLat) : NaN;
    const lonNum = obsLon.trim() !== "" ? Number(obsLon) : NaN;
    if (
      (obsLat.trim() !== "" || obsLon.trim() !== "") &&
      (!Number.isFinite(latNum) ||
        !Number.isFinite(lonNum) ||
        latNum < -90 ||
        latNum > 90 ||
        lonNum < -180 ||
        lonNum > 180)
    ) {
      setObsValidationMsg(
        "Coordinates must be valid numbers: Latitude (-90° to 90°) and Longitude (-180° to 180°)."
      );
      return;
    }

    const hasCoords = Number.isFinite(latNum) && Number.isFinite(lonNum);
    const catalogEntry = EVIDENCE_DATASETS_BY_ID[obsDatasetId];
    const resolvedMeta = resolveDatasetMetadata(obsDatasetId);

    const obsRecord: Observation = {
      id: editingObsId ?? createId("obs"),
      datasetId: obsDatasetId,
      name: obsName.trim(),
      source: catalogEntry?.name ?? resolvedMeta.name,
      coordinates: hasCoords
        ? { latitude: latNum, longitude: lonNum }
        : mission.region
          ? { ...mission.region.coordinates }
          : undefined,
      observationDate: obsDate,
      description: obsDescription.trim() || undefined,
      provenance: {
        source: catalogEntry
          ? `${catalogEntry.instrument} · ${catalogEntry.mission} (${catalogEntry.sourceReference})`
          : `${resolvedMeta.instrumentAndMission} (${resolvedMeta.sourceReference})`,
        sourceId: catalogEntry?.pdsProductId ?? resolvedMeta.pdsProductId,
        processingMethod: catalogEntry
          ? `${catalogEntry.measurementProvided} (${catalogEntry.spatialResolutionLabel})`
          : `${resolvedMeta.measurementProvided} (${resolvedMeta.spatialResolutionLabel})`,
        limitations: obsLimitation.trim()
          ? [
              obsLimitation.trim(),
              ...(catalogEntry?.limitations ?? resolvedMeta.limitations),
            ]
          : [...(catalogEntry?.limitations ?? resolvedMeta.limitations)],
      },
    };

    const currentObsList = toMutable(mission.selectedObservations);
    const existingEditingObs = editingObsId
      ? currentObsList.find((o) => o.id === editingObsId)
      : undefined;

    if (existingEditingObs?.surfaceImage) {
      obsRecord.surfaceImage = { ...existingEditingObs.surfaceImage };
    }

    const nextObservations = editingObsId
      ? currentObsList.map((o) => (o.id === editingObsId ? obsRecord : o))
      : [...currentObsList, obsRecord];

    const nextDatasets = toMutable(mission.selectedDatasets);
    if (catalogEntry && !nextDatasets.some((d) => d.id === catalogEntry.id)) {
      nextDatasets.push(toMissionDataset(catalogEntry));
    }

    updateMission({
      selectedObservations: nextObservations,
      selectedDatasets: nextDatasets,
    });

    setEditingObsId(null);
    setObsName("");
    setObsDescription("");
    setObsLimitation("");
    setObsDate(mission.temporal.selectedDate);
    setObsDateManuallyChanged(false);
    setShowObsForm(false);
  }

  function startEditingObservation(
    obs: (typeof mission.selectedObservations)[number]
  ): void {
    setEditingObsId(obs.id);
    setObsName(obs.name);
    setObsDatasetId(obs.datasetId);
    setObsLat(
      obs.coordinates ? String(obs.coordinates.latitude) : ""
    );
    setObsLon(
      obs.coordinates ? String(obs.coordinates.longitude) : ""
    );
    setObsDate(obs.observationDate || mission.temporal.selectedDate);
    setObsDateManuallyChanged(true);
    setObsDescription(obs.description ?? "");
    const catalogLimits =
      EVIDENCE_DATASETS_BY_ID[obs.datasetId]?.limitations ??
      resolveDatasetMetadata(obs.datasetId).limitations;
    const customLim = (obs.provenance?.limitations ?? []).find(
      (lim) => !catalogLimits.includes(lim)
    );
    setObsLimitation(customLim ?? "");
    setObsValidationMsg(null);
    setShowObsForm(true);
  }

  function cancelObservationForm(): void {
    setEditingObsId(null);
    setObsName("");
    setObsDescription("");
    setObsLimitation("");
    setObsValidationMsg(null);
    setShowObsForm(false);
  }

  function removeObservation(id: string): void {
    if (editingObsId === id) {
      cancelObservationForm();
    }
    updateMission({
      selectedObservations: toMutable(mission.selectedObservations).filter(
        (obs) => obs.id !== id
      ),
    });
  }

  function handleAddTarget(event: FormEvent): void {
    event.preventDefault();
    setTargetValidationMsg(null);

    const lat =
      targetLat.trim() !== ""
        ? Number(targetLat)
        : mission.region?.coordinates.latitude ?? NaN;
    const lon =
      targetLon.trim() !== ""
        ? Number(targetLon)
        : mission.region?.coordinates.longitude ?? NaN;

    if (!targetName.trim()) {
      setTargetValidationMsg("Please enter a target name.");
      return;
    }
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      setTargetValidationMsg(
        "Please enter valid Martian latitude (-90 to 90) and longitude (-180 to 180)."
      );
      return;
    }

    updateMission({
      scientificTargets: [
        ...toMutable(mission.scientificTargets),
        buildTarget(
          targetName.trim(),
          { latitude: lat, longitude: lon },
          targetDesc.trim() || "Scientific target logged during investigation."
        ),
      ],
    });

    setTargetName("");
    setTargetLat("");
    setTargetLon("");
    setTargetDesc("");
    setShowTargetForm(false);
  }

  function removeTarget(id: string): void {
    updateMission({
      scientificTargets: toMutable(mission.scientificTargets).filter(
        (t) => t.id !== id
      ),
    });
  }

  function handleAddHypothesis(event: FormEvent): void {
    event.preventDefault();
    if (!hypothesisText.trim()) return;

    const next: UserHypothesis = {
      id: createId("hyp"),
      statement: hypothesisText.trim(),
      relatedEvidenceIds: mission.selectedObservations.map((o) => o.id),
      createdAt: new Date().toISOString(),
    };

    updateMission({
      hypotheses: [...toMutable(mission.hypotheses), next],
    });
    setHypothesisText("");
  }

  function removeHypothesis(id: string): void {
    updateMission({
      hypotheses: toMutable(mission.hypotheses).filter((h) => h.id !== id),
    });
  }

  return (
    <MissionLayout
      stage="Stage 01 · Investigate"
      title="Scientific Investigation"
      subtitle="A structured planetary science workflow: frame a research question, select NASA orbital datasets, log observations, and designate surface targets."
      nextStepHint="After framing your investigation and logging observations, proceed to the Evidence Inspector to examine dataset provenance and sample DEM elevations."
      actions={
        <>
          <Link to="/explorer?view=map" className="mx-btn mx-btn--secondary">
            <Compass size={15} aria-hidden="true" />
            Explore on 2D Map
          </Link>
          <Link to="/mission/evidence" className="mx-btn mx-btn--primary">
            Inspect Evidence
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Main Guided Workflow Column (8 cols) */}
        <div className="flex flex-col gap-8 lg:col-span-8">
          {/* STEP 1: INVESTIGATION SETUP */}
          <section
            className="mx-panel p-6"
            aria-labelledby="step1-setup-heading"
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-mx-border pb-4">
              <div>
                <span className="mx-eyebrow mx-eyebrow--accent">
                  Step 01 of 04 · Investigation Setup
                </span>
                <h2
                  id="step1-setup-heading"
                  className="mx-heading m-0 mt-1 flex items-center gap-2 text-xl"
                >
                  <FlaskConical size={18} className="text-mx-accent" />
                  Research Question &amp; Study Region
                </h2>
                <p className="mx-body m-0 mt-1 text-xs">
                  Scientific investigation begins with a specific, testable
                  question about Martian geology, climate history, or
                  habitability anchored to a defined study region.
                </p>
              </div>
              {mission.region && mission.question.trim() ? (
                <span className="mx-badge mx-badge--success">
                  <Check size={12} className="mr-1" aria-hidden="true" />
                  Setup Complete
                </span>
              ) : (
                <span className="mx-badge mx-badge--accent">Action Needed</span>
              )}
            </div>

            {/* Study Region Selector */}
            <div className="mb-6">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="mx-label !mb-0">
                  1A. Select Study Region on Mars
                </span>
                <Link
                  to="/explorer?view=map"
                  className="text-xs text-mx-accent no-underline hover:underline"
                >
                  Or pick custom coordinates on 2D Map →
                </Link>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {EXPLORATION_SITES.map((site) => {
                  const active = mission.region?.id === site.id;
                  return (
                    <button
                      key={site.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setRegion(
                          buildRegion(
                            site.id,
                            site.name,
                            {
                              latitude: site.latitude,
                              longitude: site.longitude,
                            },
                            site.description
                          )
                        )
                      }
                      className={`flex flex-col items-start rounded-lg border p-3.5 text-left transition ${
                        active
                          ? "border-mx-accent bg-mx-panel-2"
                          : "border-mx-border bg-mx-bg hover:border-mx-muted"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="font-display text-sm font-semibold text-mx-text">
                          {site.name}
                        </span>
                        <span className="mx-mono text-[11px] text-mx-accent">
                          {formatCoordinates(site.latitude, site.longitude)}
                        </span>
                      </div>
                      <span className="mx-body mt-1 text-xs line-clamp-2">
                        {site.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              {mission.region && (
                <div className="mt-3 grid gap-4 rounded-lg border border-mx-border bg-mx-bg p-4 sm:grid-cols-3">
                  <DataField
                    label="Selected Study Region"
                    value={mission.region.name}
                  />
                  <DataField
                    label="Planetocentric Coordinates"
                    value={formatCoordinates(
                      mission.region.coordinates.latitude,
                      mission.region.coordinates.longitude
                    )}
                  />
                  <DataField
                    label="Regional Context"
                    value={mission.region.description}
                  />
                </div>
              )}
            </div>

            {/* Research Question Input */}
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="mission-question" className="mx-label !mb-0">
                  1B. Define Primary Research Question
                </label>
                <span className="mx-mono text-[11px] text-mx-dim">
                  {questionHasUnsavedChanges ? (
                    <span className="text-mx-accent">● Unsaved edits</span>
                  ) : mission.question.trim() ? (
                    <span className="text-mx-success">
                      ✓ Saved to mission record
                    </span>
                  ) : (
                    "Not yet entered"
                  )}
                </span>
              </div>

              <textarea
                id="mission-question"
                className="mx-input"
                placeholder="e.g., Does the western delta of Jezero Crater preserve fine-grained phyllosilicate-bearing strata deposited in a standing lake?"
                value={questionDraft}
                onChange={(event) => {
                  setQuestionDraft(event.target.value);
                  updateMission({ question: event.target.value });
                }}
                onBlur={saveQuestionNow}
              />

              {/* Quick sample questions for first-time users */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="mx-mono text-[11px] text-mx-dim mr-1">
                  <Sparkles size={11} className="inline mr-1 text-mx-accent" />
                  Example templates:
                </span>
                {EXAMPLE_QUESTIONS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setQuestionDraft(preset.question);
                      updateMission({ question: preset.question });
                      const matchingSite = EXPLORATION_SITES.find(
                        (s) => s.id === preset.regionId
                      );
                      if (matchingSite && !mission.region) {
                        setRegion(
                          buildRegion(
                            matchingSite.id,
                            matchingSite.name,
                            {
                              latitude: matchingSite.latitude,
                              longitude: matchingSite.longitude,
                            },
                            matchingSite.description
                          )
                        );
                      }
                    }}
                    className="mx-chip !py-1 !px-2 !text-[10px]"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* STEP 2: SELECT SCIENTIFIC DATASETS */}
          <section
            className="mx-panel p-6"
            aria-labelledby="step2-datasets-heading"
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-mx-border pb-4">
              <div>
                <span className="mx-eyebrow mx-eyebrow--accent">
                  Step 02 of 04 · Select Scientific Evidence Datasets
                </span>
                <h2
                  id="step2-datasets-heading"
                  className="mx-heading m-0 mt-1 flex items-center gap-2 text-xl"
                >
                  <Database size={18} className="text-mx-accent" />
                  Scientific Evidence Dataset Catalog
                </h2>
                <p className="mx-body m-0 mt-1 text-xs">
                  Select verifiable NASA physical measurements and calibrated
                  products (topography, high-resolution visible imagery, thermal
                  inertia, spectral deconvolution, and surface weather) to
                  support your investigation. Visualization-only basemaps (MOLA
                  Hillshade, Viking Color, MOC Atlas) remain in the 2D/3D Map
                  Layer selector and are excluded from empirical evidence.
                </p>
              </div>

              <span
                className={`mx-badge ${
                  mission.selectedDatasets.length > 0
                    ? "mx-badge--success"
                    : "mx-badge--accent"
                }`}
              >
                {mission.selectedDatasets.length} of {EVIDENCE_DATASETS.length}{" "}
                selected
              </span>
            </div>

            {/* Category Filter & Search Controls */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label="Filter evidence datasets by discipline"
              >
                {(
                  [
                    ["all", `All (${EVIDENCE_DATASETS.length})`],
                    [
                      "selected",
                      `Selected (${mission.selectedDatasets.length})`,
                    ],
                    ["topography", "Topography & DEM"],
                    ["optical_imagery", "Optical Imagery"],
                    ["thermal_physical", "Thermal & Physical"],
                    ["composition", "Mineral Composition"],
                    ["atmosphere_environment", "Atmosphere & Dust"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={categoryFilter === key}
                    onClick={() => setCategoryFilter(key)}
                    className={`mx-chip !py-1 !px-2.5 ${
                      categoryFilter === key ? "mx-chip--active" : ""
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-56">
                <label htmlFor="dataset-search" className="sr-only">
                  Filter datasets by name or instrument
                </label>
                <input
                  id="dataset-search"
                  type="search"
                  className="mx-input !min-h-8 !py-1 text-xs"
                  placeholder="Filter by name or instrument…"
                  value={datasetSearch}
                  onChange={(e) => setDatasetSearch(e.target.value)}
                />
              </div>
            </div>

            {filteredDatasets.length === 0 ? (
              <EmptyState compact title="No datasets match your current filter">
                Try switching back to “All” or clearing the search filter.
              </EmptyState>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredDatasets.map((entry) => {
                  const selected = selectedDatasetIds.has(entry.id);
                  const expanded = expandedDatasetIds.has(entry.id);

                  return (
                    <div
                      key={entry.id}
                      className={`flex flex-col justify-between rounded-lg border p-4 transition ${
                        selected
                          ? "border-mx-accent bg-mx-panel-2"
                          : "border-mx-border bg-mx-bg hover:border-mx-border-strong"
                      }`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="mx-eyebrow">
                            {EVIDENCE_CATEGORY_LABELS[entry.category]}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {selected && (
                              <span className="mx-badge mx-badge--accent">
                                Selected
                              </span>
                            )}
                            <span
                              className={`mx-badge ${
                                entry.integrationStatus === "integrated_active"
                                  ? "mx-badge--success"
                                  : entry.integrationStatus ===
                                      "integrated_backend"
                                    ? "mx-badge--accent"
                                    : ""
                              }`}
                              title={entry.integrationStatusLabel}
                            >
                              {entry.integrationStatus === "integrated_active"
                                ? "Live Integrated"
                                : entry.integrationStatus ===
                                    "integrated_backend"
                                  ? "Backend / Archive Verified"
                                  : "Verified Catalog Reference"}
                            </span>
                            <span
                              className={`mx-badge ${
                                entry.suitability ===
                                "Direct Quantitative Analysis"
                                  ? "mx-badge--success"
                                  : "mx-badge--accent"
                              }`}
                            >
                              {entry.suitability}
                            </span>
                          </div>
                        </div>

                        <h3 className="mx-heading m-0 mt-2 text-[15px]">
                          {entry.name}
                        </h3>
                        <p className="mx-mono m-0 mt-1 text-[11px] text-mx-accent">
                          {entry.instrument} · {entry.mission}
                        </p>
                        <p className="mx-body m-0 mt-1.5 text-xs">
                          {entry.description}
                        </p>

                        {/* Core Dataset Metadata */}
                        <div className="mt-3 grid grid-cols-2 gap-2 rounded border border-mx-border bg-mx-panel/60 p-2.5 text-[11px]">
                          <div>
                            <span className="block font-mono text-[10px] uppercase text-mx-dim">
                              Spatial Resolution
                            </span>
                            <span className="text-mx-text">
                              {entry.spatialResolutionLabel}
                            </span>
                          </div>
                          <div>
                            <span className="block font-mono text-[10px] uppercase text-mx-dim">
                              Geographic Coverage
                            </span>
                            <span className="text-mx-text">
                              {entry.geographicCoverage.split("·")[0]}
                            </span>
                          </div>
                          <div className="col-span-2 border-t border-mx-border/60 pt-1.5">
                            <span className="block font-mono text-[10px] uppercase text-mx-dim">
                              Actual Measurement Provided
                            </span>
                            <span className="text-mx-text">
                              {entry.measurementProvided}
                            </span>
                          </div>
                        </div>

                        {/* Progressive Disclosure: Advanced Provenance & Metadata */}
                        {expanded && (
                          <div className="mt-2.5 rounded border border-mx-border bg-mx-bg p-3 text-xs text-mx-muted">
                            <div className="grid gap-1.5">
                              <div>
                                <strong className="text-mx-text">
                                  Availability &amp; Integration Status:
                                </strong>{" "}
                                {entry.integrationStatusLabel}
                              </div>
                              <div>
                                <strong className="text-mx-text">
                                  Scientific Purpose:
                                </strong>{" "}
                                {entry.scientificPurpose}
                              </div>
                              <div>
                                <strong className="text-mx-text">
                                  Temporal Coverage:
                                </strong>{" "}
                                {entry.temporalCoverage}
                              </div>
                              <div>
                                <strong className="text-mx-text">
                                  PDS / Source ID:
                                </strong>{" "}
                                <span className="mx-mono text-[11px]">
                                  {entry.pdsProductId}
                                </span>
                              </div>
                              <div>
                                <strong className="text-mx-text">
                                  Archive Reference:
                                </strong>{" "}
                                {entry.sourceReference}
                              </div>
                              {entry.limitations.length > 0 && (
                                <div>
                                  <strong className="text-mx-text">
                                    Known Limitations:
                                  </strong>{" "}
                                  {entry.limitations.join(" ")}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-3.5 flex items-center justify-between border-t border-mx-border pt-3">
                        <button
                          type="button"
                          onClick={() => toggleDatasetDetails(entry.id)}
                          className="inline-flex items-center gap-1 text-xs text-mx-muted hover:text-mx-text"
                        >
                          <Info size={12} aria-hidden="true" />
                          {expanded ? "Hide metadata" : "Details & limits"}
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleDataset(entry)}
                          className={`mx-btn mx-btn--sm ${
                            selected ? "mx-btn--primary" : "mx-btn--secondary"
                          }`}
                        >
                          {selected ? (
                            <>
                              <Check size={13} aria-hidden="true" /> Selected
                            </>
                          ) : (
                            <>
                              <Plus size={13} aria-hidden="true" /> Select
                              Dataset
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* T-2.2: Interactive MEDA Environmental Measurements Inspector */}
            <div className="mt-5 border-t border-mx-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="mx-eyebrow mx-eyebrow--accent">
                    In-Situ Rover Environmental Telemetry · MEDA (`m2020_meda_env`)
                  </span>
                  <p className="m-0 mt-0.5 text-xs text-mx-muted">
                    Inspect real Perseverance MEDA pressure, air/ground
                    temperature, relative humidity, wind, and solar radiation
                    from NASA PDS4 (Sol 0001 &amp; Sol 0036).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMedaInspector((prev) => !prev)}
                  aria-expanded={showMedaInspector}
                  className="mx-btn mx-btn--secondary mx-btn--sm"
                >
                  {showMedaInspector ? (
                    <>
                      <ChevronUp size={14} aria-hidden="true" /> Hide MEDA
                      Inspector
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} aria-hidden="true" /> Inspect MEDA
                      Measurements
                    </>
                  )}
                </button>
              </div>

              {(showMedaInspector ||
                selectedDatasetIds.has("m2020_meda_env")) && (
                <div className="mt-4">
                  <MedaEnvironmentalPanel
                    onLogObservation={(params) => {
                      const medaEntry =
                        EVIDENCE_DATASETS_BY_ID["m2020_meda_env"];
                      const newObs: Observation = {
                        id: createId("obs"),
                        datasetId: "m2020_meda_env",
                        name: params.name,
                        source:
                          medaEntry?.name ??
                          "Perseverance MEDA Surface Environmental Measurements",
                        coordinates: {
                          latitude: 18.4447,
                          longitude: 77.4508,
                        },
                        observationDate: params.observationDate,
                        description: params.description,
                        provenance: {
                          source: `${medaEntry?.instrument ?? "MEDA"} · ${
                            medaEntry?.mission ?? "Mars 2020 Perseverance"
                          } (${medaEntry?.sourceReference ?? "NASA PDS4"})`,
                          sourceId: params.sourceId,
                          processingMethod: params.processingMethod,
                          limitations: [
                            params.limitation,
                            ...(medaEntry?.limitations ?? []),
                          ],
                        },
                      };
                      const nextDatasets = toMutable(mission.selectedDatasets);
                      if (
                        medaEntry &&
                        !nextDatasets.some((d) => d.id === medaEntry.id)
                      ) {
                        nextDatasets.push(toMissionDataset(medaEntry));
                      }
                      updateMission({
                        selectedObservations: [
                          ...toMutable(mission.selectedObservations),
                          newObs,
                        ],
                        selectedDatasets: nextDatasets,
                      });
                    }}
                  />
                </div>
              )}
            </div>
          </section>

          {/* STEP 3: RECORD OBSERVATIONS */}
          <section
            className="mx-panel p-6"
            aria-labelledby="step3-observations-heading"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-mx-border pb-4">
              <div>
                <span className="mx-eyebrow mx-eyebrow--accent">
                  Step 03 of 04 · Record Observations
                </span>
                <h2
                  id="step3-observations-heading"
                  className="mx-heading m-0 mt-1 flex items-center gap-2 text-xl"
                >
                  <ScanSearch size={18} className="text-mx-accent" />
                  Logged Scientific Observations (
                  {mission.selectedObservations.length})
                </h2>
                <p className="mx-body m-0 mt-1 text-xs">
                  Record specific geological features, thermal inertia
                  signatures, or elevation measurements observed in verifiable
                  NASA evidence datasets.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowObsForm((prev) => !prev)}
                aria-expanded={showObsForm}
                className={`mx-btn mx-btn--sm ${
                  showObsForm ? "mx-btn--secondary" : "mx-btn--primary"
                }`}
              >
                {showObsForm ? (
                  <>
                    <ChevronUp size={14} aria-hidden="true" /> Hide Form
                  </>
                ) : (
                  <>
                    <Plus size={14} aria-hidden="true" /> Log Observation
                  </>
                )}
              </button>
            </div>

            {/* Contextual / Expandable Observation Creation Form */}
            {showObsForm && (
              <form
                onSubmit={handleAddObservation}
                className="mb-5 grid gap-3.5 rounded-lg border border-mx-border-strong bg-mx-bg p-4"
              >
                <div className="flex items-center justify-between border-b border-mx-border pb-2.5">
                  <span className="font-display text-sm font-semibold text-mx-text">
                    {editingObsId
                      ? "Edit Observation Record"
                      : "New Observation Record"}
                  </span>
                  {mission.region && (
                    <button
                      type="button"
                      onClick={() => {
                        setObsLat(String(mission.region!.coordinates.latitude));
                        setObsLon(
                          String(mission.region!.coordinates.longitude)
                        );
                      }}
                      className="text-xs text-mx-accent hover:underline"
                    >
                      Use {mission.region.name} coordinates
                    </button>
                  )}
                </div>

                {obsValidationMsg && (
                  <p className="mx-alert mx-alert--danger m-0" role="alert">
                    {obsValidationMsg}
                  </p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="obs-name" className="mx-label">
                      Observation title *
                    </label>
                    <input
                      id="obs-name"
                      type="text"
                      required
                      className="mx-input"
                      placeholder="e.g., Western delta fan layered outcrop"
                      value={obsName}
                      onChange={(e) => setObsName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label htmlFor="obs-dataset" className="mx-label">
                      Source NASA evidence dataset *
                    </label>
                    <select
                      id="obs-dataset"
                      className="mx-input"
                      value={obsDatasetId}
                      onChange={(e) => setObsDatasetId(e.target.value)}
                    >
                      {!(obsDatasetId in EVIDENCE_DATASETS_BY_ID) && (
                        <optgroup label="Legacy Observation Source (Migrate to Evidence Dataset)">
                          <option value={obsDatasetId}>
                            ⚠ {resolveDatasetMetadata(obsDatasetId).name} (Legacy Map Layer)
                          </option>
                        </optgroup>
                      )}
                      {mission.selectedDatasets.some(
                        (d) => d.id in EVIDENCE_DATASETS_BY_ID
                      ) && (
                        <optgroup label="Selected in Your Investigation">
                          {EVIDENCE_DATASETS.filter((entry) =>
                            selectedDatasetIds.has(entry.id)
                          ).map((entry) => (
                            <option key={`sel-${entry.id}`} value={entry.id}>
                              ★ {entry.name} ({entry.spatialResolutionLabel})
                              {entry.integrationStatus ===
                              "documented_not_integrated"
                                ? " [Catalog Reference]"
                                : ""}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {(
                        Object.keys(
                          EVIDENCE_CATEGORY_LABELS
                        ) as EvidenceDatasetCategory[]
                      ).map((catKey) => (
                        <optgroup
                          key={catKey}
                          label={EVIDENCE_CATEGORY_LABELS[catKey]}
                        >
                          {EVIDENCE_DATASETS.filter(
                            (entry) => entry.category === catKey
                          ).map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name} ({entry.spatialResolutionLabel})
                              {entry.integrationStatus ===
                              "documented_not_integrated"
                                ? " [Catalog Reference]"
                                : ""}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Live Scientific Context Card for Selected Source Dataset */}
                {(() => {
                  const activeDs = resolveDatasetMetadata(obsDatasetId);
                  return (
                    <div className="rounded-lg border border-mx-border bg-mx-panel/70 p-3 text-xs">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-semibold text-mx-accent">
                            {activeDs.instrumentAndMission}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`mx-badge ${
                                activeDs.integrationStatus ===
                                "integrated_active"
                                  ? "mx-badge--success"
                                  : activeDs.integrationStatus ===
                                      "integrated_backend"
                                    ? "mx-badge--accent"
                                    : activeDs.isVisualizationOnlyLegacy
                                      ? "mx-badge--danger"
                                      : ""
                              }`}
                            >
                              {activeDs.integrationStatusLabel}
                            </span>
                            <span className="mx-badge">
                              {activeDs.suitability} ·{" "}
                              {activeDs.spatialResolutionLabel}
                            </span>
                          </div>
                        </div>
                        <p className="m-0 text-mx-text">
                          <strong>Measures:</strong>{" "}
                          {activeDs.measurementProvided}
                        </p>
                        <p className="m-0 text-mx-muted">
                          <strong>Scientific Purpose:</strong>{" "}
                          {activeDs.scientificPurpose}
                        </p>
                        <p className="m-0 text-amber-200/90">
                          <strong>Limitations:</strong>{" "}
                          {activeDs.limitations[0]}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="obs-date" className="mx-label">
                      Observation date (UTC) *
                    </label>
                    <input
                      id="obs-date"
                      type="date"
                      required
                      className="mx-input"
                      value={obsDate}
                      onChange={(e) => {
                        setObsDate(e.target.value);
                        setObsDateManuallyChanged(true);
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor="obs-lat" className="mx-label">
                      Latitude (°)
                    </label>
                    <input
                      id="obs-lat"
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      className="mx-input"
                      placeholder={
                        mission.region
                          ? String(mission.region.coordinates.latitude)
                          : "18.38"
                      }
                      value={obsLat}
                      onChange={(e) => setObsLat(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="obs-lon" className="mx-label">
                      Longitude (°)
                    </label>
                    <input
                      id="obs-lon"
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      className="mx-input"
                      placeholder={
                        mission.region
                          ? String(mission.region.coordinates.longitude)
                          : "77.58"
                      }
                      value={obsLon}
                      onChange={(e) => setObsLon(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="obs-desc" className="mx-label">
                      Observation notes
                    </label>
                    <input
                      id="obs-desc"
                      type="text"
                      className="mx-input"
                      placeholder="Morphology, thermal signature, or mineralogical note"
                      value={obsDescription}
                      onChange={(e) => setObsDescription(e.target.value)}
                    />
                  </div>

                  <div>
                    <label htmlFor="obs-lim" className="mx-label">
                      Additional site-specific limitation (optional)
                    </label>
                    <input
                      id="obs-lim"
                      type="text"
                      className="mx-input"
                      placeholder="e.g., Dust cover obscures spectral features"
                      value={obsLimitation}
                      onChange={(e) => setObsLimitation(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  {(mission.selectedObservations.length > 0 || editingObsId) && (
                    <button
                      type="button"
                      onClick={cancelObservationForm}
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
                    {editingObsId ? "Update Observation" : "Save Observation"}
                  </button>
                </div>
              </form>
            )}

            {mission.selectedObservations.length === 0 ? (
              <EmptyState
                compact
                title="No observations logged yet"
                action={
                  !showObsForm && (
                    <button
                      type="button"
                      onClick={() => setShowObsForm(true)}
                      className="mx-btn mx-btn--primary mx-btn--sm"
                    >
                      <Plus size={14} aria-hidden="true" /> Log First
                      Observation
                    </button>
                  )
                }
              >
                Observations link your selected NASA evidence datasets to
                specific Martian coordinates and feed directly into the Evidence
                Inspector.
              </EmptyState>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {mission.selectedObservations.map((obs) => {
                  const meta = resolveDatasetMetadata(obs.datasetId);
                  return (
                    <div
                      key={obs.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-mx-border bg-mx-bg p-3.5"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="mx-eyebrow mx-eyebrow--accent">
                            {obs.source}
                          </span>
                          <span className="mx-badge text-[10px]">
                            {meta.spatialResolutionLabel}
                          </span>
                          {meta.isVisualizationOnlyLegacy && (
                            <span className="mx-badge mx-badge--danger text-[10px]">
                              Legacy Map Layer
                            </span>
                          )}
                          {obs.surfaceImage && (
                            <span className="mx-badge mx-badge--success text-[10px]">
                              Rover Image: {obs.surfaceImage.instrument} (Sol{" "}
                              {obs.surfaceImage.sol})
                            </span>
                          )}
                        </div>
                        <h3 className="mx-heading m-0 mt-1 text-sm">
                          {obs.name}
                        </h3>
                        <p className="mx-mono m-0 mt-1 text-[11px] text-mx-dim">
                          Date: {obs.observationDate ?? "Date unavailable"}
                          {obs.coordinates &&
                            ` · ${formatCoordinates(
                              obs.coordinates.latitude,
                              obs.coordinates.longitude
                            )}`}
                        </p>
                        {obs.description && (
                          <p className="mx-body m-0 mt-1.5 text-xs">
                            {obs.description}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditingObservation(obs)}
                          className="mx-icon-btn !h-8 !w-8"
                          aria-label={`Edit ${obs.name}`}
                          title="Edit observation"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeObservation(obs.id)}
                          className="mx-icon-btn !h-8 !w-8"
                          aria-label={`Remove ${obs.name}`}
                          title="Remove observation"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* T-2.3: Perseverance Surface Imagery Catalog (Catalog #3) */}
            <div className="mt-6 border-t border-mx-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="mx-eyebrow mx-eyebrow--accent">
                    Surface Imagery Catalog (Catalog #3) · Perseverance Rover Photographs
                  </span>
                  <p className="m-0 mt-0.5 text-xs text-mx-muted">
                    Browse authentic Mastcam-Z, Navcam, and SuperCam RMI surface
                    photographs from NASA&apos;s Perseverance rover and reference
                    them in your scientific observations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRoverImagery((prev) => !prev)}
                  aria-expanded={showRoverImagery}
                  className="mx-btn mx-btn--secondary mx-btn--sm"
                >
                  {showRoverImagery ? (
                    <>
                      <ChevronUp size={14} aria-hidden="true" /> Hide Rover
                      Imagery Catalog
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} aria-hidden="true" /> Browse
                      Perseverance Surface Imagery
                    </>
                  )}
                </button>
              </div>

              {showRoverImagery && (
                <div className="mt-4">
                  <PerseveranceImageryPanel
                    onLogObservationWithImage={(params) => {
                      const newObs: Observation = {
                        id: createId("obs"),
                        datasetId: params.datasetId,
                        name: params.name,
                        source: `${params.surfaceImage.roverName} ${params.surfaceImage.instrument} (Surface Imagery Catalog)`,
                        // Raw EDR records do not provide planetocentric (lat, lon); never invent coordinates.
                        coordinates: undefined,
                        observationDate: params.observationDate,
                        description: params.description,
                        provenance: {
                          source: `${params.surfaceImage.instrumentLabel} · Mars 2020 Perseverance (${params.surfaceImage.credit})`,
                          sourceId: params.sourceId,
                          sourceUrl: params.sourceUrl,
                          processingMethod: params.processingMethod,
                          limitations: [params.limitation],
                        },
                        surfaceImage: params.surfaceImage,
                      };
                      updateMission({
                        selectedObservations: [
                          ...toMutable(mission.selectedObservations),
                          newObs,
                        ],
                      });
                    }}
                  />
                </div>
              )}
            </div>
          </section>

          {/* STEP 4: MANAGE SCIENTIFIC TARGETS & HYPOTHESES */}
          <section
            className="mx-panel p-6"
            aria-labelledby="step4-targets-heading"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-mx-border pb-4">
              <div>
                <span className="mx-eyebrow mx-eyebrow--accent">
                  Step 04 of 04 · Manage Scientific Targets
                </span>
                <h2
                  id="step4-targets-heading"
                  className="mx-heading m-0 mt-1 flex items-center gap-2 text-xl"
                >
                  <Target size={18} className="text-mx-accent" />
                  Scientific Targets ({mission.scientificTargets.length})
                </h2>
                <p className="mx-body m-0 mt-1 text-xs">
                  Designate high-priority surface sites to visit during route
                  planning and the Marswalk EVA simulation.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowTargetForm((prev) => !prev)}
                aria-expanded={showTargetForm}
                className={`mx-btn mx-btn--sm ${
                  showTargetForm ? "mx-btn--secondary" : "mx-btn--primary"
                }`}
              >
                {showTargetForm ? (
                  <>
                    <ChevronUp size={14} aria-hidden="true" /> Hide Target Form
                  </>
                ) : (
                  <>
                    <Plus size={14} aria-hidden="true" /> Add Scientific Target
                  </>
                )}
              </button>
            </div>

            {showTargetForm && (
              <form
                onSubmit={handleAddTarget}
                className="mb-5 grid gap-3 rounded-lg border border-mx-border-strong bg-mx-bg p-4"
              >
                <div className="flex items-center justify-between border-b border-mx-border pb-2">
                  <span className="font-display text-sm font-semibold text-mx-text">
                    New Scientific Target
                  </span>
                  {mission.region && (
                    <button
                      type="button"
                      onClick={() => {
                        setTargetLat(
                          String(
                            Number(
                              (
                                mission.region!.coordinates.latitude + 0.015
                              ).toFixed(4)
                            )
                          )
                        );
                        setTargetLon(
                          String(
                            Number(
                              (
                                mission.region!.coordinates.longitude - 0.02
                              ).toFixed(4)
                            )
                          )
                        );
                      }}
                      className="text-xs text-mx-accent hover:underline"
                    >
                      Pre-fill near {mission.region.name}
                    </button>
                  )}
                </div>

                {targetValidationMsg && (
                  <p className="mx-alert mx-alert--danger m-0" role="alert">
                    {targetValidationMsg}
                  </p>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="target-name" className="mx-label">
                      Target name *
                    </label>
                    <input
                      id="target-name"
                      type="text"
                      required
                      className="mx-input"
                      placeholder="e.g., Kodiak Butte delta remnant"
                      value={targetName}
                      onChange={(e) => setTargetName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="target-lat" className="mx-label">
                      Latitude (°) *
                    </label>
                    <input
                      id="target-lat"
                      type="number"
                      required
                      step="any"
                      min="-90"
                      max="90"
                      className="mx-input"
                      placeholder="18.38"
                      value={targetLat}
                      onChange={(e) => setTargetLat(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="target-lon" className="mx-label">
                      Longitude (°) *
                    </label>
                    <input
                      id="target-lon"
                      type="number"
                      required
                      step="any"
                      min="-180"
                      max="180"
                      className="mx-input"
                      placeholder="77.58"
                      value={targetLon}
                      onChange={(e) => setTargetLon(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="target-desc" className="mx-label">
                    Scientific rationale
                  </label>
                  <input
                    id="target-desc"
                    type="text"
                    className="mx-input"
                    placeholder="Why this target should be sampled or visited during EVA"
                    value={targetDesc}
                    onChange={(e) => setTargetDesc(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTargetForm(false)}
                    className="mx-btn mx-btn--secondary mx-btn--sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="mx-btn mx-btn--primary mx-btn--sm"
                  >
                    <Plus size={14} aria-hidden="true" /> Save Target
                  </button>
                </div>
              </form>
            )}

            {mission.scientificTargets.length === 0 ? (
              <EmptyState
                compact
                title="No scientific targets selected yet"
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTargetForm(true)}
                      className="mx-btn mx-btn--primary mx-btn--sm"
                    >
                      <Plus size={14} aria-hidden="true" /> Add Target Here
                    </button>
                    <Link
                      to="/explorer?view=map"
                      className="mx-btn mx-btn--secondary mx-btn--sm"
                    >
                      Pick on 2D Map
                    </Link>
                  </div>
                }
              >
                Add scientific targets here or select any coordinate on the 2D
                Mars Map and click “Add as scientific target”.
              </EmptyState>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {mission.scientificTargets.map((target) => (
                  <div
                    key={target.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-mx-border bg-mx-bg p-3.5"
                  >
                    <div>
                      <h3 className="mx-heading m-0 text-sm">{target.name}</h3>
                      <p className="mx-mono m-0 mt-1 text-[11px] text-mx-accent">
                        <MapPin
                          size={11}
                          className="mr-1 inline"
                          aria-hidden="true"
                        />
                        {formatCoordinates(
                          target.coordinates.latitude,
                          target.coordinates.longitude
                        )}
                      </p>
                      <p className="mx-body m-0 mt-1 text-xs">
                        {target.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTarget(target.id)}
                      className="mx-icon-btn !h-8 !w-8 shrink-0"
                      aria-label={`Remove ${target.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Collapsible Working Hypotheses */}
            <div className="mt-6 border-t border-mx-border pt-4">
              <button
                type="button"
                onClick={() => setShowHypotheses((prev) => !prev)}
                aria-expanded={showHypotheses}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <span className="mx-eyebrow">
                    Optional · Working Hypotheses ({mission.hypotheses.length})
                  </span>
                  <p className="m-0 mt-0.5 text-xs text-mx-muted">
                    Link your orbital observations to a testable scientific
                    hypothesis.
                  </p>
                </div>
                {showHypotheses ? (
                  <ChevronUp size={16} className="text-mx-muted" />
                ) : (
                  <ChevronDown size={16} className="text-mx-muted" />
                )}
              </button>

              {(showHypotheses || mission.hypotheses.length > 0) && (
                <div className="mt-3">
                  <form
                    onSubmit={handleAddHypothesis}
                    className="mb-3 flex gap-2"
                  >
                    <label htmlFor="hypothesis-input" className="sr-only">
                      Hypothesis statement
                    </label>
                    <input
                      id="hypothesis-input"
                      type="text"
                      className="mx-input"
                      placeholder="Record a testable hypothesis from current evidence…"
                      value={hypothesisText}
                      onChange={(e) => setHypothesisText(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="mx-btn mx-btn--secondary shrink-0"
                    >
                      Add
                    </button>
                  </form>

                  {mission.hypotheses.length > 0 && (
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                      {mission.hypotheses.map((hyp) => (
                        <li
                          key={hyp.id}
                          className="flex items-start justify-between gap-2 rounded-lg border border-mx-border bg-mx-bg px-3.5 py-2.5 text-xs text-mx-text"
                        >
                          <span>{hyp.statement}</span>
                          <button
                            type="button"
                            onClick={() => removeHypothesis(hyp.id)}
                            className="text-mx-muted hover:text-mx-text"
                            aria-label="Remove hypothesis"
                          >
                            <Trash2 size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right 4 cols: Sticky Investigation Summary & Next Step Guidance */}
        <div className="lg:col-span-4">
          <aside
            className="mx-panel sticky top-6 p-6"
            aria-label="Investigation summary"
          >
            <span className="mx-eyebrow mx-eyebrow--accent">
              Step 05 · Investigation Summary
            </span>
            <h2 className="mx-display m-0 mt-2 text-2xl">{mission.name}</h2>

            {/* Checklist of investigation readiness */}
            <ul className="my-5 flex list-none flex-col gap-2.5 border-y border-mx-border py-4 p-0 text-xs">
              <li className="flex items-center justify-between">
                <span className="text-mx-muted">1. Study Region</span>
                {mission.region ? (
                  <span className="font-semibold text-mx-success">
                    ✓ {mission.region.name}
                  </span>
                ) : (
                  <span className="text-mx-dim">Pending</span>
                )}
              </li>
              <li className="flex items-center justify-between">
                <span className="text-mx-muted">2. Research Question</span>
                {mission.question.trim() ? (
                  <span className="font-semibold text-mx-success">
                    ✓ Framed
                  </span>
                ) : (
                  <span className="text-mx-dim">Pending</span>
                )}
              </li>
              <li className="flex items-center justify-between">
                <span className="text-mx-muted">3. NASA Datasets</span>
                <span
                  className={
                    mission.selectedDatasets.length > 0
                      ? "font-semibold text-mx-success"
                      : "text-mx-dim"
                  }
                >
                  {mission.selectedDatasets.length} selected
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-mx-muted">4. Logged Observations</span>
                <span
                  className={
                    mission.selectedObservations.length > 0
                      ? "font-semibold text-mx-success"
                      : "text-mx-dim"
                  }
                >
                  {mission.selectedObservations.length} recorded
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-mx-muted">5. Scientific Targets</span>
                <span
                  className={
                    mission.scientificTargets.length > 0
                      ? "font-semibold text-mx-success"
                      : "text-mx-dim"
                  }
                >
                  {mission.scientificTargets.length} target(s)
                </span>
              </li>
            </ul>

            {mission.question.trim() && (
              <div className="mb-4 rounded-lg border border-mx-border bg-mx-bg p-3.5">
                <span className="mx-field__label">Active Research Question</span>
                <p className="m-0 mt-1.5 text-xs text-mx-text leading-relaxed">
                  “{mission.question}”
                </p>
              </div>
            )}

            <div className="mb-5 rounded-lg border border-mx-border bg-mx-bg p-3.5">
              <span className="mx-eyebrow mx-eyebrow--accent">
                What happens next?
              </span>
              <p className="mx-body m-0 mt-1.5 text-xs">
                In the <strong>Evidence Inspector</strong>, you will inspect the
                provenance of your logged observations, query real HiRISE DEM
                spot elevations, and document scientific interpretations before
                identifying knowledge gaps.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <Link
                to="/mission/evidence"
                className="mx-btn mx-btn--primary mx-btn--block min-h-11"
              >
                Continue to Evidence Inspector
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                to="/mission/gaps"
                className="mx-btn mx-btn--secondary mx-btn--block"
              >
                Review Knowledge Gaps
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </MissionLayout>
  );
}

// frontend/src/features/mission/EvidenceInspectorPage.tsx
// Evidence Inspector (Phase 3D): separates Evidence Browsing from Evidence
// Inspection, clearly distinguishes available vs. missing evidence, and
// preserves HiRISE DEM sampling, derived analyses, and interpretations.
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Database,
  FileText,
  FlaskConical,
  MapPin,
  Mountain,
  Plus,
  ScanSearch,
  Trash2,
} from "lucide-react";
import {
  DataField,
  EmptyState,
  ImagePending,
  SectionHeading,
  formatCoordinates,
} from "../../components/ui";
import { marsDemProvider } from "../../services/providers/marsDem";
import { resolveDatasetMetadata } from "../../data/evidenceDatasets";
import { useMission } from "../../state/mission/MissionContext";
import type { DerivedAnalysis, ScientificInterpretation } from "../../types";
import MissionLayout from "./MissionLayout";
import MedaEnvironmentalPanel from "./MedaEnvironmentalPanel";
import PerseveranceImageryPanel from "./PerseveranceImageryPanel";
import CrismSpectralPanel from "./CrismSpectralPanel";
import { createId, toMutable } from "./missionHelpers";

export default function EvidenceInspectorPage() {
  const { mission, updateMission } = useMission();

  const [selectedObsId, setSelectedObsId] = useState<string | null>(
    mission.selectedObservations[0]?.id ?? null
  );

  // Progressive disclosure toggles for forms
  const [showAnalysisForm, setShowAnalysisForm] = useState(false);
  const [showInterpForm, setShowInterpForm] = useState(false);
  const [showRoverGallery, setShowRoverGallery] = useState(false);
  const [cutoutImgFailed, setCutoutImgFailed] = useState(false);

  // Derived measurement form state
  const [analysisName, setAnalysisName] = useState("");
  const [analysisMethod, setAnalysisMethod] = useState("");
  const [analysisValue, setAnalysisValue] = useState("");
  const [analysisUnit, setAnalysisUnit] = useState("m");
  const [analysisLimitation, setAnalysisLimitation] = useState("");
  const [demQueryLoading, setDemQueryLoading] = useState(false);
  const [demQueryError, setDemQueryError] = useState<string | null>(null);

  // Scientific interpretation form state
  const [interpText, setInterpText] = useState("");
  const [interpLimitation, setInterpLimitation] = useState("");

  const activeObservation =
    mission.selectedObservations.find((o) => o.id === selectedObsId) ??
    mission.selectedObservations[0] ??
    null;

  const relatedDataset = activeObservation
    ? mission.selectedDatasets.find(
        (d) => d.id === activeObservation.datasetId
      )
    : undefined;

  const relatedAnalyses = activeObservation
    ? mission.derivedAnalyses.filter((a) =>
        a.inputObservationIds.includes(activeObservation.id)
      )
    : mission.derivedAnalyses;

  const relatedInterpretations = activeObservation
    ? mission.interpretations.filter((i) =>
        i.supportingEvidenceIds.includes(activeObservation.id)
      )
    : mission.interpretations;

  // Distinguish datasets that have observations vs. selected datasets missing observations
  const observedDatasetIds = new Set(
    mission.selectedObservations.map((o) => o.datasetId)
  );
  const datasetsMissingObservations = mission.selectedDatasets.filter(
    (ds) => !observedDatasetIds.has(ds.id)
  );

  async function sampleDemElevationForObservation(): Promise<void> {
    if (!activeObservation?.coordinates) return;
    setDemQueryLoading(true);
    setDemQueryError(null);

    try {
      const result = await marsDemProvider.getElevation(
        activeObservation.coordinates
      );
      const isLocalCtx = Boolean(result.isFallback);
      const analysis: DerivedAnalysis = {
        id: createId("analysis"),
        name: `${
          isLocalCtx ? "Jezero CTX DEM" : "HiRISE DEM"
        } spot elevation (${activeObservation.name})`,
        description: `Sampled at row ${result.row}, column ${result.column} from ${result.product_id}.`,
        inputObservationIds: [activeObservation.id],
        method: `${
          isLocalCtx ? "Local Jezero CTX DEM" : "HiRISE DTM"
        } raster query (${result.product_id})`,
        value: Number(result.elevation.toFixed(2)),
        unit: result.unit,
        limitations: [
          isLocalCtx
            ? "Sampled from local verified USGS/NASA Mars 2020 CTX DEM (~20 m/post)."
            : "Vertical precision depends on stereo DTM resolution (~1 m/post).",
        ],
      };

      updateMission({
        derivedAnalyses: [...toMutable(mission.derivedAnalyses), analysis],
      });
    } catch (err: unknown) {
      setDemQueryError(
        err instanceof Error
          ? err.message
          : "Unable to query HiRISE DEM at these coordinates."
      );
    } finally {
      setDemQueryLoading(false);
    }
  }

  function handleAddAnalysis(event: FormEvent): void {
    event.preventDefault();
    if (!analysisName.trim() || !activeObservation) return;

    const parsedVal =
      analysisValue.trim() !== "" ? Number(analysisValue) : undefined;

    const analysis: DerivedAnalysis = {
      id: createId("analysis"),
      name: analysisName.trim(),
      description: `Derived from observation "${activeObservation.name}".`,
      inputObservationIds: [activeObservation.id],
      method: analysisMethod.trim() || "Manual scientific measurement",
      value: Number.isFinite(parsedVal) ? parsedVal : undefined,
      unit: analysisUnit.trim() || undefined,
      limitations: analysisLimitation.trim()
        ? [analysisLimitation.trim()]
        : ["Subject to orbital spatial resolution constraints."],
    };

    updateMission({
      derivedAnalyses: [...toMutable(mission.derivedAnalyses), analysis],
    });

    setAnalysisName("");
    setAnalysisMethod("");
    setAnalysisValue("");
    setAnalysisLimitation("");
    setShowAnalysisForm(false);
  }

  function removeAnalysis(id: string): void {
    updateMission({
      derivedAnalyses: toMutable(mission.derivedAnalyses).filter(
        (a) => a.id !== id
      ),
    });
  }

  function handleAddInterpretation(event: FormEvent): void {
    event.preventDefault();
    if (!interpText.trim() || !activeObservation) return;

    const next: ScientificInterpretation = {
      id: createId("interp"),
      description: interpText.trim(),
      supportingEvidenceIds: [activeObservation.id],
      limitations: interpLimitation.trim()
        ? [interpLimitation.trim()]
        : ["Requires in-situ surface verification."],
      generatedBy: "User",
    };

    updateMission({
      interpretations: [...toMutable(mission.interpretations), next],
    });

    setInterpText("");
    setInterpLimitation("");
    setShowInterpForm(false);
  }

  function removeInterpretation(id: string): void {
    updateMission({
      interpretations: toMutable(mission.interpretations).filter(
        (i) => i.id !== id
      ),
    });
  }

  return (
    <MissionLayout
      stage="Stage 01 · Investigate"
      title="Evidence Inspector"
      subtitle="Browse logged observations on the left and inspect dataset provenance, derived measurements, scientific interpretations, and evidentiary limitations on the right."
      nextStepHint="After inspecting available evidence, proceed to Knowledge Gaps to document what orbital data cannot resolve."
      actions={
        <>
          <Link to="/mission/investigate" className="mx-btn mx-btn--secondary">
            <ArrowLeft size={15} aria-hidden="true" />
            Investigation Setup
          </Link>
          <Link to="/mission/gaps" className="mx-btn mx-btn--primary">
            Knowledge Gaps
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </>
      }
    >
      {mission.selectedObservations.length === 0 ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <EmptyState
              icon={<ScanSearch size={28} />}
              title="No observations available to inspect yet"
              action={
                <Link
                  to="/mission/investigate"
                  className="mx-btn mx-btn--primary"
                >
                  <FlaskConical size={15} aria-hidden="true" />
                  Log Observations in Investigation
                </Link>
              }
            >
              The Evidence Inspector separates evidence browsing from detailed
              provenance inspection. Log at least one observation in your
              Scientific Investigation workspace to inspect its metadata, sample
              HiRISE DEM elevations, and record interpretations.
            </EmptyState>
          </div>

          <aside className="mx-panel p-6 lg:col-span-4">
            <span className="mx-eyebrow mx-eyebrow--accent">
              Evidence Coverage Status
            </span>
            <h2 className="mx-heading m-0 mt-1 text-lg">
              Available vs. Missing Evidence
            </h2>
            <p className="mx-body m-0 mt-2 text-xs">
              You have selected{" "}
              <strong>{mission.selectedDatasets.length}</strong> NASA dataset(s)
              but logged <strong>0</strong> observations.
            </p>
            {mission.selectedDatasets.length > 0 && (
              <ul className="m-0 mt-4 list-none space-y-2 p-0 text-xs">
                {mission.selectedDatasets.map((ds) => (
                  <li
                    key={ds.id}
                    className="flex items-center justify-between gap-2 rounded border border-mx-border bg-mx-bg px-3 py-2"
                  >
                    <span className="truncate text-mx-text">{ds.name}</span>
                    <span className="mx-badge mx-badge--danger">
                      Missing Obs
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-12">
          {/* LEFT 4 COLS: EVIDENCE BROWSER (Available vs. Missing Evidence) */}
          <aside
            className="flex flex-col gap-6 lg:col-span-4"
            aria-label="Evidence browser"
          >
            <section className="mx-panel p-5">
              <SectionHeading
                eyebrow={`Available Evidence (${mission.selectedObservations.length})`}
                title="Observation Browser"
                icon={<ScanSearch size={17} />}
                action={
                  <Link
                    to="/mission/investigate"
                    className="text-xs text-mx-accent no-underline hover:underline"
                  >
                    + Add More
                  </Link>
                }
              />

              <div className="flex flex-col gap-2">
                {mission.selectedObservations.map((obs) => {
                  const active = obs.id === activeObservation?.id;
                  const obsAnalyses = mission.derivedAnalyses.filter((a) =>
                    a.inputObservationIds.includes(obs.id)
                  ).length;
                  const obsInterps = mission.interpretations.filter((i) =>
                    i.supportingEvidenceIds.includes(obs.id)
                  ).length;
                  const evaluated = obsAnalyses > 0 || obsInterps > 0;

                  return (
                    <button
                      key={obs.id}
                      type="button"
                      onClick={() => setSelectedObsId(obs.id)}
                      className={`flex flex-col items-start rounded-lg border p-3.5 text-left transition ${
                        active
                          ? "border-mx-accent bg-mx-panel-2"
                          : "border-mx-border bg-mx-bg hover:border-mx-border-strong"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="mx-eyebrow mx-eyebrow--accent truncate">
                          {obs.source}
                        </span>
                        <span
                          className={`mx-badge ${
                            evaluated ? "mx-badge--success" : ""
                          }`}
                        >
                          {evaluated ? (
                            <>
                              <Check size={10} className="mr-1" /> Inspected
                            </>
                          ) : (
                            "Needs Review"
                          )}
                        </span>
                      </div>
                      <strong className="mt-1 font-display text-sm text-mx-text">
                        {obs.name}
                      </strong>
                      <span className="mx-mono mt-1 text-[11px] text-mx-dim">
                        {obs.observationDate ?? "No date"}
                        {obs.coordinates &&
                          ` · ${formatCoordinates(
                            obs.coordinates.latitude,
                            obs.coordinates.longitude
                          )}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Missing / Unobserved Datasets Callout */}
            <section className="mx-panel p-5">
              <SectionHeading
                eyebrow="Coverage Check"
                title="Available vs. Missing Evidence"
                icon={<Database size={17} />}
              />

              <div className="mb-3 grid grid-cols-2 gap-2.5 rounded-lg border border-mx-border bg-mx-bg p-3">
                <DataField
                  label="Observed Datasets"
                  value={`${observedDatasetIds.size} of ${mission.selectedDatasets.length}`}
                />
                <DataField
                  label="Missing Observations"
                  value={`${datasetsMissingObservations.length} dataset(s)`}
                />
              </div>

              {datasetsMissingObservations.length === 0 ? (
                <p className="mx-body m-0 text-xs text-mx-success">
                  ✓ Every selected dataset in your investigation has at least
                  one logged observation.
                </p>
              ) : (
                <div>
                  <p className="mx-body m-0 mb-2.5 text-xs">
                    These selected datasets do not have logged observations yet:
                  </p>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {datasetsMissingObservations.map((ds) => (
                      <li
                        key={ds.id}
                        className="flex items-center justify-between gap-2 rounded border border-mx-border bg-mx-bg px-3 py-2 text-xs"
                      >
                        <span className="truncate text-mx-text">{ds.name}</span>
                        <Link
                          to="/mission/investigate"
                          className="shrink-0 font-mono text-[11px] text-mx-accent no-underline hover:underline"
                        >
                          Log obs →
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </aside>

          {/* RIGHT 8 COLS: ACTIVE EVIDENCE INSPECTOR */}
          {activeObservation && (
            <div className="flex flex-col gap-6 lg:col-span-8">
              {/* 1. Observation Provenance & Source Card */}
              <section
                className="mx-panel overflow-hidden p-6"
                aria-label="Observation provenance"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="mx-eyebrow mx-eyebrow--accent">
                      Active Evidence Record · {activeObservation.source}
                    </p>
                    <h2 className="mx-display m-0 mt-1.5 text-2xl sm:text-3xl">
                      {activeObservation.name}
                    </h2>
                  </div>

                  <Link
                    to="/mission/investigate"
                    className="mx-btn mx-btn--secondary mx-btn--sm"
                  >
                    Revisit in Investigation
                  </Link>
                </div>

                {activeObservation.coordinates && (
                  <p className="mx-mono m-0 mt-2.5 inline-flex items-center gap-2 text-mx-muted">
                    <MapPin
                      size={14}
                      className="text-mx-accent"
                      aria-hidden="true"
                    />
                    {formatCoordinates(
                      activeObservation.coordinates.latitude,
                      activeObservation.coordinates.longitude
                    )}
                  </p>
                )}

                <div className="mt-5 grid gap-6 md:grid-cols-12">
                  <div className="md:col-span-5">
                    {activeObservation.surfaceImage ? (
                      <div className="flex h-full flex-col justify-between rounded-lg border border-mx-border bg-mx-bg p-3">
                        <div className="overflow-hidden rounded border border-mx-border bg-mx-panel">
                          {!cutoutImgFailed ? (
                            <img
                              key={activeObservation.surfaceImage.imageUrl}
                              src={activeObservation.surfaceImage.imageUrl}
                              alt={activeObservation.surfaceImage.caption || activeObservation.name}
                              onError={() => setCutoutImgFailed(true)}
                              className="aspect-[16/10] w-full object-contain bg-black/40"
                            />
                          ) : (
                            <ImagePending
                              className="aspect-[16/10] border-0"
                              label={`Perseverance ${activeObservation.surfaceImage.instrument} (Sol ${activeObservation.surfaceImage.sol})`}
                              detail={`Verified NASA Image ID: ${activeObservation.surfaceImage.imageId}. Remote image stream offline.`}
                            />
                          )}
                        </div>
                        <div className="mt-2.5 space-y-1 text-[11px]">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className="mx-badge mx-badge--success">
                              In-Situ Rover Surface Photograph
                            </span>
                            <a
                              href={activeObservation.surfaceImage.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-mx-accent hover:underline"
                            >
                              NASA Source →
                            </a>
                          </div>
                          <div className="font-mono text-mx-text truncate">
                            ID: {activeObservation.surfaceImage.imageId}
                          </div>
                          <div className="text-mx-muted">
                            {activeObservation.surfaceImage.instrumentLabel} · Sol{" "}
                            {activeObservation.surfaceImage.sol}
                            {activeObservation.surfaceImage.site !== null
                              ? ` · Site ${activeObservation.surfaceImage.site}, Drive ${
                                  activeObservation.surfaceImage.drive ?? "—"
                                }`
                              : ""}
                          </div>
                          <div className="text-mx-dim">
                            Credit: {activeObservation.surfaceImage.credit}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <ImagePending
                        className="h-full min-h-[170px]"
                        label="Observation Cutout Frame"
                        detail={`Dataset ID: ${activeObservation.datasetId}. Attach a Perseverance surface photograph below or connect orbital cutouts.`}
                      />
                    )}
                  </div>

                  <div className="flex flex-col justify-between md:col-span-7">
                    {(() => {
                      const dsMeta = resolveDatasetMetadata(
                        activeObservation.datasetId
                      );
                      return (
                        <div className="grid grid-cols-2 gap-4 rounded-lg border border-mx-border bg-mx-bg p-4">
                          <DataField
                            label="Dataset Identifier"
                            value={activeObservation.datasetId}
                          />
                          <DataField
                            label="Instrument & Mission"
                            value={dsMeta.instrumentAndMission}
                          />
                          <DataField
                            label="Observation Date (UTC)"
                            value={activeObservation.observationDate}
                          />
                          <DataField
                            label="Spatial Resolution"
                            value={
                              relatedDataset?.spatialResolutionLabel ??
                              dsMeta.spatialResolutionLabel
                            }
                          />
                          <DataField
                            label="Scientific Suitability"
                            value={dsMeta.suitability}
                          />
                          <DataField
                            label="Integration Status"
                            value={dsMeta.integrationStatusLabel}
                          />
                          <DataField
                            label="Geographic Coverage"
                            value={dsMeta.geographicCoverage}
                            className="col-span-2"
                          />
                          <DataField
                            label="Actual Measurement / Method"
                            value={
                              activeObservation.provenance?.processingMethod ??
                              dsMeta.measurementProvided
                            }
                            className="col-span-2"
                          />
                        </div>
                      );
                    })()}

                    {activeObservation.description && (
                      <div className="mt-4 rounded-lg border border-mx-border bg-mx-bg p-3.5">
                        <span className="mx-field__label">
                          Observation Notes
                        </span>
                        <p className="mx-body m-0 mt-1 text-[13px] text-mx-text">
                          {activeObservation.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Evidence Limitations */}
                <div className="mt-5 rounded-lg border border-mx-border bg-mx-bg p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="mx-heading m-0 flex items-center gap-2 text-sm">
                      <CircleAlert
                        size={15}
                        className="text-mx-accent"
                        aria-hidden="true"
                      />
                      Evidentiary Limitations &amp; Provenance Constraints
                    </h3>
                    <Link
                      to="/mission/gaps"
                      className="text-xs text-mx-accent no-underline hover:underline"
                    >
                      Escalate to Knowledge Gap →
                    </Link>
                  </div>
                  {activeObservation.provenance?.limitations &&
                  activeObservation.provenance.limitations.length > 0 ? (
                    <ul className="m-0 mt-2 list-disc space-y-1 pl-5 text-xs text-mx-muted">
                      {activeObservation.provenance.limitations.map(
                        (lim, i) => (
                          <li key={i}>{lim}</li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p className="mx-body m-0 mt-2 text-xs">
                      No explicit limitations recorded for this observation.
                    </p>
                  )}
                </div>

                {/* T-2.3: Attach or Inspect Perseverance Surface Imagery */}
                <div className="mt-4 border-t border-mx-border pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-mx-muted">
                      {activeObservation.surfaceImage
                        ? `Linked Rover Photograph: ${activeObservation.surfaceImage.imageId} (${activeObservation.surfaceImage.instrument}, Sol ${activeObservation.surfaceImage.sol})`
                        : "Have supporting Perseverance surface imagery (Mastcam-Z, Navcam, or SuperCam RMI) for this observation?"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowRoverGallery((prev) => !prev)}
                      className="mx-btn mx-btn--secondary mx-btn--sm"
                    >
                      {showRoverGallery
                        ? "Hide Perseverance Imagery Catalog"
                        : activeObservation.surfaceImage
                          ? "Change / Inspect Rover Image"
                          : "Browse & Attach Rover Image"}
                    </button>
                  </div>

                  {showRoverGallery && (
                    <div className="mt-4">
                      <PerseveranceImageryPanel
                        activeObservationName={activeObservation.name}
                        onAttachToObservation={(surfaceImage) => {
                          setCutoutImgFailed(false);
                          const updatedObs = toMutable(
                            mission.selectedObservations
                          ).map((obs) => {
                            if (obs.id !== activeObservation.id) return obs;
                            return {
                              ...obs,
                              surfaceImage,
                            };
                          });
                          updateMission({
                            selectedObservations: updatedObs,
                          });
                        }}
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* 2. Derived Measurements */}
              {activeObservation.datasetId === "crism_jezero_vnir" && (
                <CrismSpectralPanel />
              )}

              {activeObservation.datasetId === "m2020_meda_env" && (
                <MedaEnvironmentalPanel
                  onLogDerivedMeasurement={(params) => {
                    const analysis: DerivedAnalysis = {
                      id: createId("analysis"),
                      name: params.name,
                      description: `Derived from MEDA PDS4 environmental dataset for observation "${activeObservation.name}".`,
                      inputObservationIds: [activeObservation.id],
                      method: params.method,
                      value: params.value,
                      unit: params.unit,
                      limitations: [params.limitation],
                    };
                    updateMission({
                      derivedAnalyses: [
                        ...toMutable(mission.derivedAnalyses),
                        analysis,
                      ],
                    });
                  }}
                />
              )}

              <section
                className="mx-panel p-6"
                aria-label="Derived measurements"
              >
                <SectionHeading
                  eyebrow={`Quantitative Evidence (${relatedAnalyses.length})`}
                  title="Derived Terrain & Spectral Measurements"
                  icon={<Mountain size={18} />}
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      {activeObservation.coordinates && (
                        <button
                          type="button"
                          disabled={demQueryLoading}
                          onClick={sampleDemElevationForObservation}
                          className="mx-btn mx-btn--secondary mx-btn--sm"
                        >
                          {demQueryLoading
                            ? "Querying DEM…"
                            : "Sample HiRISE DEM"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowAnalysisForm((prev) => !prev)}
                        aria-expanded={showAnalysisForm}
                        className={`mx-btn mx-btn--sm ${
                          showAnalysisForm
                            ? "mx-btn--secondary"
                            : "mx-btn--primary"
                        }`}
                      >
                        {showAnalysisForm ? (
                          <>
                            <ChevronUp size={14} /> Hide Form
                          </>
                        ) : (
                          <>
                            <Plus size={14} /> Add Measurement
                          </>
                        )}
                      </button>
                    </div>
                  }
                />

                {demQueryError && (
                  <p className="mx-alert mx-alert--danger mb-4">
                    HiRISE DEM query: {demQueryError}
                  </p>
                )}

                {showAnalysisForm && (
                  <form
                    onSubmit={handleAddAnalysis}
                    className="mb-5 grid gap-3 rounded-lg border border-mx-border-strong bg-mx-bg p-4"
                  >
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <div>
                        <label htmlFor="analysis-name" className="mx-label">
                          Measurement parameter *
                        </label>
                        <input
                          id="analysis-name"
                          type="text"
                          required
                          className="mx-input"
                          placeholder="e.g., Delta scarp relief"
                          value={analysisName}
                          onChange={(e) => setAnalysisName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="analysis-method" className="mx-label">
                          Method / instrument
                        </label>
                        <input
                          id="analysis-method"
                          type="text"
                          className="mx-input"
                          placeholder="e.g., MOLA / HiRISE profile"
                          value={analysisMethod}
                          onChange={(e) => setAnalysisMethod(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="col-span-2">
                        <label htmlFor="analysis-val" className="mx-label">
                          Measured value (optional)
                        </label>
                        <input
                          id="analysis-val"
                          type="number"
                          step="any"
                          className="mx-input"
                          placeholder="e.g., 42.5"
                          value={analysisValue}
                          onChange={(e) => setAnalysisValue(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="analysis-unit" className="mx-label">
                          Unit
                        </label>
                        <input
                          id="analysis-unit"
                          type="text"
                          className="mx-input"
                          placeholder="m, deg, TIU"
                          value={analysisUnit}
                          onChange={(e) => setAnalysisUnit(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="analysis-lim" className="mx-label">
                        Measurement uncertainty / limitation
                      </label>
                      <input
                        id="analysis-lim"
                        type="text"
                        className="mx-input"
                        placeholder="e.g., ±2 m vertical uncertainty"
                        value={analysisLimitation}
                        onChange={(e) => setAnalysisLimitation(e.target.value)}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAnalysisForm(false)}
                        className="mx-btn mx-btn--secondary mx-btn--sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="mx-btn mx-btn--primary mx-btn--sm"
                      >
                        <Plus size={14} aria-hidden="true" />
                        Save Measurement
                      </button>
                    </div>
                  </form>
                )}

                {relatedAnalyses.length === 0 ? (
                  <EmptyState
                    compact
                    title="No derived measurements recorded for this observation"
                  >
                    Click “Sample HiRISE DEM” (when coordinates fall inside
                    Jezero DTM coverage) or “+ Add Measurement” to log a
                    quantitative parameter.
                  </EmptyState>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {relatedAnalyses.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-mx-border bg-mx-bg p-3.5"
                      >
                        <div>
                          <span className="mx-eyebrow">{item.method}</span>
                          <h4 className="mx-heading m-0 mt-1 text-sm">
                            {item.name}
                          </h4>
                          {item.value !== undefined && (
                            <p className="mx-mono m-0 mt-1 text-sm text-mx-accent">
                              {item.value} {item.unit ?? ""}
                            </p>
                          )}
                          {item.limitations.length > 0 && (
                            <p className="mx-body m-0 mt-1 text-xs">
                              Limitation: {item.limitations.join("; ")}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAnalysis(item.id)}
                          className="mx-icon-btn !h-8 !w-8 shrink-0"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 3. Scientific Interpretations */}
              <section
                className="mx-panel p-6"
                aria-label="Scientific interpretation"
              >
                <SectionHeading
                  eyebrow={`Interpretations (${relatedInterpretations.length})`}
                  title="Scientific Interpretation"
                  icon={<FileText size={18} />}
                  action={
                    <button
                      type="button"
                      onClick={() => setShowInterpForm((prev) => !prev)}
                      aria-expanded={showInterpForm}
                      className={`mx-btn mx-btn--sm ${
                        showInterpForm
                          ? "mx-btn--secondary"
                          : "mx-btn--primary"
                      }`}
                    >
                      {showInterpForm ? (
                        <>
                          <ChevronUp size={14} /> Hide Form
                        </>
                      ) : (
                        <>
                          <Plus size={14} /> Add Interpretation
                        </>
                      )}
                    </button>
                  }
                />

                {showInterpForm && (
                  <form
                    onSubmit={handleAddInterpretation}
                    className="mb-5 grid gap-3 rounded-lg border border-mx-border-strong bg-mx-bg p-4"
                  >
                    <div>
                      <label htmlFor="interp-text" className="mx-label">
                        Interpretation supported by this observation *
                      </label>
                      <textarea
                        id="interp-text"
                        required
                        className="mx-input"
                        placeholder="State what the observation and derived measurements imply for your research question…"
                        value={interpText}
                        onChange={(e) => setInterpText(e.target.value)}
                      />
                    </div>

                    <div>
                      <label htmlFor="interp-lim" className="mx-label">
                        Key caveat or alternative explanation
                      </label>
                      <input
                        id="interp-lim"
                        type="text"
                        className="mx-input"
                        placeholder="e.g., Could also result from volcanic ash fall rather than lacustrine deposition"
                        value={interpLimitation}
                        onChange={(e) => setInterpLimitation(e.target.value)}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowInterpForm(false)}
                        className="mx-btn mx-btn--secondary mx-btn--sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="mx-btn mx-btn--primary mx-btn--sm"
                      >
                        <Plus size={14} aria-hidden="true" />
                        Save Interpretation
                      </button>
                    </div>
                  </form>
                )}

                {relatedInterpretations.length === 0 ? (
                  <EmptyState
                    compact
                    title="No interpretations recorded for this observation"
                  >
                    Document how this evidence bears on your research question
                    and note any caveats requiring surface fieldwork.
                  </EmptyState>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {relatedInterpretations.map((interp) => (
                      <div
                        key={interp.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-mx-border bg-mx-bg p-3.5"
                      >
                        <div>
                          <span className="mx-badge mx-badge--accent">
                            Author: {interp.generatedBy} (User Interpretation)
                          </span>
                          <p className="m-0 mt-2 text-sm text-mx-text">
                            {interp.description}
                          </p>
                          {interp.limitations.length > 0 && (
                            <p className="mx-body m-0 mt-1.5 text-xs">
                              Caveat: {interp.limitations.join("; ")}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeInterpretation(interp.id)}
                          className="mx-icon-btn !h-8 !w-8 shrink-0"
                          aria-label="Remove interpretation"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      )}
    </MissionLayout>
  );
}

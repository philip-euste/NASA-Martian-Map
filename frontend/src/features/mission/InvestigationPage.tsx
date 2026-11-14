
// frontend/src/features/mission/InvestigationPage.tsx
// Scientific Investigation Workspace (Section 3E).
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Database,
  FlaskConical,
  MapPin,
  Plus,
  ScanSearch,
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
  MAP_LAYERS,
  type MapLayer,
  type MapLayerCategory,
} from "../../data/mapLayers";
import { useMission } from "../../state/mission/MissionContext";
import type { Dataset, Observation, UserHypothesis } from "../../types";
import MissionLayout from "./MissionLayout";
import {
  buildRegion,
  buildTarget,
  createId,
  toMutable,
} from "./missionHelpers";

const CATEGORY_LABELS: Record<MapLayerCategory, string> = {
  basemap: "Basemap",
  elevation: "Elevation & Terrain",
  geology: "Geology",
  composition: "Composition",
  atmosphere: "Atmosphere",
  thermal: "Thermal & Infrared",
};

function mapLayerToDataset(layer: MapLayer): Dataset {
  return {
    id: layer.id,
    name: layer.name,
    source: "NASA Mars Trek WMTS",
    description: layer.description,
    available: true,
    provenance: {
      source: "NASA / JPL-Caltech / USGS Mars Trek",
      sourceId: layer.id,
      processingMethod: `Global ${layer.category} WMTS mosaic (${layer.coverage})`,
      limitations: [
        "Orbital remote-sensing mosaic; small-scale surface hazards below pixel resolution require rover or HiRISE follow-up.",
      ],
    },
  };
}

const CATALOG_DATASETS: { dataset: Dataset; category: MapLayerCategory }[] = [
  ...Object.values(MAP_LAYERS).map((layer) => ({
    dataset: mapLayerToDataset(layer),
    category: layer.category,
  })),
  {
    dataset: {
      id: "hirise_jezero_dtm",
      name: "MRO HiRISE — Jezero Controlled DTM",
      source: "USGS Astrogeology / NASA PDS (Terrain API)",
      description:
        "High-resolution digital terrain model covering the Jezero Crater landing region.",
      resolutionMeters: 1,
      available: true,
      provenance: {
        source: "MRO HiRISE / USGS Astrogeology",
        sourceId: "DTEEC_048842_1985_048908_1985_U01",
        processingMethod: "Stereo photogrammetric Digital Terrain Model",
        limitations: [
          "Spatial coverage is restricted to the Jezero stereo pair footprint; queries outside coverage or when the local terrain API is offline return unavailable.",
        ],
      },
    },
    category: "elevation",
  },
];

export default function InvestigationPage() {
  const { mission, setRegion, updateMission } = useMission();

  // Observation draft state
  const [obsName, setObsName] = useState("");
  const [obsDatasetId, setObsDatasetId] = useState<string>(
    mission.selectedDatasets[0]?.id ?? "mars_global_mola"
  );
  const [obsLat, setObsLat] = useState("");
  const [obsLon, setObsLon] = useState("");
  const [obsDescription, setObsDescription] = useState("");
  const [obsLimitation, setObsLimitation] = useState("");

  // Observation date follows the shared temporal date until manually edited.
  const [obsDate, setObsDate] = useState(
    mission.temporal.selectedDate
  );
  const [obsDateManuallyChanged, setObsDateManuallyChanged] =
    useState(false);

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

  // Hypothesis draft state
  const [hypothesisText, setHypothesisText] = useState("");

  const selectedDatasetIds = new Set(
    mission.selectedDatasets.map((d) => d.id)
  );

  function toggleDataset(dataset: Dataset): void {
    const current = toMutable(mission.selectedDatasets);
    const exists = current.some((d) => d.id === dataset.id);
    const next = exists
      ? current.filter((d) => d.id !== dataset.id)
      : [...current, dataset];

    updateMission({ selectedDatasets: next });
  }

  function handleAddObservation(event: FormEvent): void {
    event.preventDefault();
    if (!obsName.trim() || !obsDate) return;

    const catalogMatch = CATALOG_DATASETS.find(
      (item) => item.dataset.id === obsDatasetId
    )?.dataset;

    const latNum = obsLat.trim() !== "" ? Number(obsLat) : NaN;
    const lonNum = obsLon.trim() !== "" ? Number(obsLon) : NaN;
    const hasCoords = Number.isFinite(latNum) && Number.isFinite(lonNum);

    const newObs: Observation = {
      id: createId("obs"),
      datasetId: obsDatasetId,
      name: obsName.trim(),
      source: catalogMatch?.name ?? obsDatasetId,
      coordinates: hasCoords
        ? { latitude: latNum, longitude: lonNum }
        : mission.region
          ? { ...mission.region.coordinates }
          : undefined,
      observationDate: obsDate,
      description: obsDescription.trim() || undefined,
      provenance: {
        source: catalogMatch?.source ?? "NASA Mars Trek",
        sourceId: obsDatasetId,
        processingMethod:
          catalogMatch?.provenance?.processingMethod ??
          "User-logged observation from orbital layer",
        limitations: obsLimitation.trim()
          ? [obsLimitation.trim()]
          : catalogMatch?.provenance?.limitations
            ? [...catalogMatch.provenance.limitations]
            : [],
      },
    };

    const nextObservations = [
      ...toMutable(mission.selectedObservations),
      newObs,
    ];

    // Also ensure the referenced dataset is in selectedDatasets.
    const nextDatasets = toMutable(mission.selectedDatasets);
    if (catalogMatch && !nextDatasets.some((d) => d.id === catalogMatch.id)) {
      nextDatasets.push(catalogMatch);
    }

    updateMission({
      selectedObservations: nextObservations,
      selectedDatasets: nextDatasets,
    });

    setObsName("");
    setObsDescription("");
    setObsLimitation("");

    // Reset the date to the shared temporal selection for the next entry.
    setObsDate(mission.temporal.selectedDate);
    setObsDateManuallyChanged(false);
  }

  function removeObservation(id: string): void {
    updateMission({
      selectedObservations: toMutable(mission.selectedObservations).filter(
        (obs) => obs.id !== id
      ),
    });
  }

  function handleAddTarget(event: FormEvent): void {
    event.preventDefault();
    const lat = Number(targetLat);
    const lon = Number(targetLon);
    if (!targetName.trim() || !Number.isFinite(lat) || !Number.isFinite(lon)) {
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

  return (
    <MissionLayout
      stage="Stage 02 · Investigate"
      title="Scientific Investigation"
      subtitle="Define your investigation question, select orbital and terrain datasets from the NASA catalog, and log observations and scientific targets."
      actions={
        <>
          <Link to="/explorer?view=map" className="mx-btn mx-btn--secondary">
            Explore on Map
          </Link>
          <Link to="/mission/evidence" className="mx-btn mx-btn--primary">
            Inspect Evidence
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left 7 cols: Question, Region, Dataset Selection */}
        <div className="flex flex-col gap-8 lg:col-span-7">
          {/* 1. Investigation question & region */}
          <section className="mx-panel p-6" aria-labelledby="question-heading">
            <SectionHeading
              eyebrow="Investigation framing"
              title="Research Question & Study Region"
              icon={<FlaskConical size={18} />}
            />

            <div className="mb-5">
              <label htmlFor="mission-question" className="mx-label">
                Primary scientific question
              </label>
              <textarea
                id="mission-question"
                className="mx-input"
                placeholder="e.g., Does the western delta of Jezero Crater preserve fine-grained phyllosilicate-bearing strata deposited in a standing lake?"
                value={mission.question}
                onChange={(event) =>
                  updateMission({ question: event.target.value })
                }
              />
              <p className="mx-hint">
                Stored in shared mission state and carried into your Evidence
                Inspector and Expedition Report.
              </p>
            </div>

            <div>
              <span className="mx-label">Study region</span>
              <div className="flex flex-wrap gap-2">
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
                      className={`mx-chip ${active ? "mx-chip--active" : ""}`}
                    >
                      <MapPin size={12} aria-hidden="true" />
                      {site.name}
                    </button>
                  );
                })}
              </div>

              {mission.region && (
                <div className="mt-4 grid gap-4 rounded-lg border border-mx-border bg-mx-bg p-4 sm:grid-cols-3">
                  <DataField label="Active region" value={mission.region.name} />
                  <DataField
                    label="Coordinates"
                    value={formatCoordinates(
                      mission.region.coordinates.latitude,
                      mission.region.coordinates.longitude
                    )}
                  />
                  <DataField
                    label="Summary"
                    value={mission.region.description}
                  />
                </div>
              )}
            </div>
          </section>

          {/* 2. Dataset selection */}
          <section className="mx-panel p-6" aria-labelledby="datasets-heading">
            <SectionHeading
              eyebrow={`Dataset catalog (${mission.selectedDatasets.length} selected)`}
              title="Available NASA Planetary Datasets"
              icon={<Database size={18} />}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              {CATALOG_DATASETS.map(({ dataset, category }) => {
                const selected = selectedDatasetIds.has(dataset.id);
                return (
                  <div
                    key={dataset.id}
                    className={`flex flex-col justify-between rounded-lg border p-4 transition ${
                      selected
                        ? "border-mx-accent bg-mx-panel-2"
                        : "border-mx-border bg-mx-bg"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="mx-eyebrow">
                          {CATEGORY_LABELS[category]}
                        </span>
                        <span
                          className={`mx-badge ${
                            dataset.available
                              ? "mx-badge--success"
                              : "mx-badge--danger"
                          }`}
                        >
                          {dataset.available ? "Available" : "Unavailable"}
                        </span>
                      </div>

                      <h3 className="mx-heading m-0 mt-2 text-[15px]">
                        {dataset.name}
                      </h3>
                      <p className="mx-body m-0 mt-1.5 text-xs">
                        {dataset.description}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-mx-border pt-3">
                      <span className="mx-mono text-[11px] text-mx-dim">
                        {dataset.resolutionMeters
                          ? `${dataset.resolutionMeters} m/px`
                          : "Global WMTS"}
                      </span>

                      <button
                        type="button"
                        onClick={() => toggleDataset(dataset)}
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
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right 5 cols: Observations, Scientific Targets, Working Hypotheses */}
        <div className="flex flex-col gap-8 lg:col-span-5">
          {/* 3. Observations */}
          <section className="mx-panel p-6" aria-label="Observations">
            <SectionHeading
              eyebrow={`Observations (${mission.selectedObservations.length})`}
              title="Observation Listings"
              icon={<ScanSearch size={18} />}
              action={
                <Link
                  to="/mission/evidence"
                  className="mx-btn mx-btn--ghost mx-btn--sm"
                >
                  Open Inspector →
                </Link>
              }
            />

            <form
              onSubmit={handleAddObservation}
              className="mb-5 grid gap-3 rounded-lg border border-mx-border bg-mx-bg p-4"
            >
              <div>
                <label htmlFor="obs-name" className="mx-label">
                  Observation title
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
                  Source dataset
                </label>
                <select
                  id="obs-dataset"
                  className="mx-input"
                  value={obsDatasetId}
                  onChange={(e) => setObsDatasetId(e.target.value)}
                >
                  {CATALOG_DATASETS.map(({ dataset }) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Observation date */}
              <div>
                <label htmlFor="obs-date" className="mx-label">
                  Observation date (UTC)
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
                <p className="mx-hint">
                  Initially follows the date selected in the temporal map
                  controls. You can change it for this observation.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
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
                  Known limitation (optional)
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

              <button type="submit" className="mx-btn mx-btn--primary">
                <Plus size={15} aria-hidden="true" />
                Log Observation
              </button>
            </form>

            {mission.selectedObservations.length === 0 ? (
              <EmptyState
                compact
                title="No observations logged yet"
              >
                Use the form above to record observations from your selected
                datasets.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-2.5">
                {mission.selectedObservations.map((obs) => (
                  <div
                    key={obs.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-mx-border bg-mx-bg p-3.5"
                  >
                    <div className="min-w-0">
                      <span className="mx-eyebrow mx-eyebrow--accent">
                        {obs.source}
                      </span>
                      <h4 className="mx-heading m-0 mt-1 text-sm">
                        {obs.name}
                      </h4>
                      <p className="mx-mono m-0 mt-1 text-[11px] text-mx-dim">
                        Observed: {obs.observationDate ?? "Date unavailable"}
                      </p>
                      {obs.coordinates && (
                        <p className="mx-mono m-0 mt-1 text-[11px] text-mx-dim">
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
                    </div>
                    <button
                      type="button"
                      onClick={() => removeObservation(obs.id)}
                      className="mx-icon-btn !h-8 !w-8 shrink-0"
                      aria-label={`Remove ${obs.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 4. Scientific Targets */}
          <section className="mx-panel p-6" aria-label="Scientific targets">
            <SectionHeading
              eyebrow={`Scientific targets (${mission.scientificTargets.length})`}
              title="Target Locations"
              icon={<Target size={18} />}
            />

            <form
              onSubmit={handleAddTarget}
              className="mb-4 grid gap-3 rounded-lg border border-mx-border bg-mx-bg p-4"
            >
              <div>
                <label htmlFor="target-name" className="mx-label">
                  Target name
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

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="target-lat" className="mx-label">
                    Latitude (°)
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
                    Longitude (°)
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
                  placeholder="Why this target should be sampled or visited"
                  value={targetDesc}
                  onChange={(e) => setTargetDesc(e.target.value)}
                />
              </div>

              <button type="submit" className="mx-btn mx-btn--secondary">
                <Plus size={15} aria-hidden="true" />
                Add Scientific Target
              </button>
            </form>

            {mission.scientificTargets.length === 0 ? (
              <EmptyState compact title="No scientific targets selected">
                Add targets here or click any point on the 2D Mars Map and
                choose “Add target”.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-2.5">
                {mission.scientificTargets.map((target) => (
                  <div
                    key={target.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-mx-border bg-mx-bg p-3.5"
                  >
                    <div>
                      <h4 className="mx-heading m-0 text-sm">{target.name}</h4>
                      <p className="mx-mono m-0 mt-1 text-[11px] text-mx-accent">
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
          </section>

          {/* 5. Working Hypotheses / Evidence Summary */}
          <section className="mx-panel p-6" aria-label="Hypotheses">
            <SectionHeading
              eyebrow={`Working hypotheses (${mission.hypotheses.length})`}
              title="Evidence Summaries & Hypotheses"
            />

            <form onSubmit={handleAddHypothesis} className="mb-4 flex gap-2">
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

            {mission.hypotheses.length === 0 ? (
              <p className="mx-body m-0 text-xs">
                No hypotheses recorded yet. Add one to link your observations to
                a testable interpretation.
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {mission.hypotheses.map((hyp) => (
                  <li
                    key={hyp.id}
                    className="rounded border border-mx-border bg-mx-bg p-3 text-xs text-mx-text"
                  >
                    {hyp.statement}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </MissionLayout>
  );
}

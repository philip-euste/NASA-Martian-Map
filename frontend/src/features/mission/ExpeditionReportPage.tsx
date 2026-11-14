// frontend/src/features/mission/ExpeditionReportPage.tsx
// Expedition Report generation and viewing (Phase 6).
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  Download,
  FileCode2,
  FileText,
  Layers,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import {
  DataField,
  EmptyState,
  SectionHeading,
  formatCoordinates,
  formatDistance,
} from "../../components/ui";
import { resolveDatasetMetadata } from "../../data/evidenceDatasets";
import { useMission } from "../../state/mission/MissionContext";
import type { ExpeditionReport } from "../../types";
import {
  computeStratigraphicTraverseProfile,
  identifyGeologicUnitAt,
} from "../../utils/jezeroStratigraphy";
import MissionLayout from "./MissionLayout";
import { createId, toMutable } from "./missionHelpers";

export default function ExpeditionReportPage() {
  const { mission, updateMission } = useMission();

  const [reportTitle, setReportTitle] = useState(
    `${mission.name} — Scientific Expedition Report`
  );
  const [summaryText, setSummaryText] = useState(
    mission.objective ||
      mission.question ||
      "Synthesis of orbital dataset analysis, traverse planning, simulated Marswalk EVA fieldwork, and geological interpretations."
  );
  const [conclusionsInput, setConclusionsInput] = useState("");
  const [recommendationsInput, setRecommendationsInput] = useState("");
  const [activeReportId, setActiveReportId] = useState<string | null>(
    mission.reports[0]?.id ?? null
  );

  const simulatedSamples = mission.simulation.simulatedSamples ?? [];

  function collectLimitations(): string[] {
    const items = new Set<string>();
    for (const ds of mission.selectedDatasets) {
      for (const lim of ds.provenance?.limitations ?? []) {
        items.add(`${ds.name}: ${lim}`);
      }
    }
    for (const obs of mission.selectedObservations) {
      for (const lim of obs.provenance?.limitations ?? []) {
        items.add(`${obs.name}: ${lim}`);
      }
    }
    for (const analysis of mission.derivedAnalyses) {
      for (const lim of analysis.limitations) {
        items.add(`${analysis.name}: ${lim}`);
      }
    }
    if (simulatedSamples.length > 0 || mission.simulation.isActive) {
      items.add(
        "Marswalk EVA traverse telemetry, suit life-support metrics, and cached sample canisters are simulated educational models anchored to USGS/NASA CTX & HiRISE Jezero DEM terrain."
      );
    }
    return Array.from(items);
  }

  function handleGenerateReport(event: FormEvent): void {
    event.preventDefault();

    const conclusions = conclusionsInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const recommendedInvestigations = recommendationsInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const newReport: ExpeditionReport = {
      id: createId("report"),
      missionId: mission.id,
      title: reportTitle.trim() || `${mission.name} Report`,
      summary: summaryText.trim(),
      datasetIds: mission.selectedDatasets.map((d) => d.id),
      observationIds: mission.selectedObservations.map((o) => o.id),
      scientificTargetIds: mission.scientificTargets.map((t) => t.id),
      candidateRouteIds: mission.candidateRoutes.map((r) => r.id),
      selectedRouteId: mission.selectedRouteId ?? undefined,
      fieldNotes: toMutable(mission.fieldNotes),
      knowledgeGaps: toMutable(mission.knowledgeGaps),
      limitations: collectLimitations(),
      conclusions:
        conclusions.length > 0
          ? conclusions
          : mission.interpretations.map((i) => i.description),
      recommendedInvestigations:
        recommendedInvestigations.length > 0
          ? recommendedInvestigations
          : mission.knowledgeGaps.map(
              (g) => `Resolve gap: ${g.description} (${g.reason})`
            ),
      simulatedSampleIds: simulatedSamples.map((s) => s.id),
      generatedAt: new Date().toISOString(),
    };

    const nextReports = [newReport, ...toMutable(mission.reports)];
    updateMission({ reports: nextReports });
    setActiveReportId(newReport.id);
  }

  function removeReport(id: string): void {
    const next = toMutable(mission.reports).filter((r) => r.id !== id);
    updateMission({ reports: next });
    if (activeReportId === id) {
      setActiveReportId(next[0]?.id ?? null);
    }
  }

  const activeReport =
    mission.reports.find((r) => r.id === activeReportId) ??
    mission.reports[0] ??
    null;

  const activeRoute = activeReport?.selectedRouteId
    ? mission.candidateRoutes.find((r) => r.id === activeReport.selectedRouteId)
    : mission.candidateRoutes[0];

  const stratigraphicProfile = useMemo(() => {
    const waypoints =
      activeRoute && activeRoute.waypoints.length >= 2
        ? activeRoute.waypoints
        : mission.scientificTargets.map((t, idx) => ({
            id: t.id,
            name: t.name || `Target ${idx + 1}`,
            coordinates: t.coordinates,
            targetId: t.id,
            visited: mission.simulation.visitedTargetIds.includes(t.id),
          }));

    if (waypoints.length < 2) return null;
    return computeStratigraphicTraverseProfile(
      waypoints,
      {},
      activeRoute?.returnRouteIncluded ?? false,
      mission.configuration?.terrainPreferences.preferredSlopeDegrees ?? 15
    );
  }, [
    activeRoute,
    mission.configuration?.terrainPreferences.preferredSlopeDegrees,
    mission.scientificTargets,
    mission.simulation.visitedTargetIds,
  ]);

  function handleExportMarkdown(): void {
    if (!activeReport) return;
    const lines: string[] = [
      `# ${activeReport.title}`,
      `**Report ID:** \`${activeReport.id}\` | **Generated:** ${new Date(activeReport.generatedAt).toISOString()}`,
      `**Study Region:** ${mission.region?.name ?? "Jezero Crater"}`,
      "",
      "## 1. Executive Summary & Research Framing",
      activeReport.summary,
      mission.question ? `\n**Research Question:** ${mission.question}` : "",
      "",
      "## 2. 4-Tier Scientific Provenance Audit",
      "- **Tier 1 (NASA_PDS_ORBITAL):** NASA PDS Orbital & Mars Trek WMTS Products (MRO HiRISE, CRISM VNIR, MGS MOLA/TES, Odyssey THEMIS)",
      "- **Tier 2 (USGS_SIM3464_MAP):** USGS Scientific Investigations Map 3464 (Sun & Stack, 2020) Jezero Crater Chronostratigraphic Units",
      "- **Tier 3 (PERSEVERANCE_EDR_SURFACE):** Mars 2020 Perseverance Rover EDR Surface Imagery (Mastcam-Z, Navcam, SuperCam RMI)",
      "- **Tier 4 (SIMULATED_EVA_ACTIVITY):** Simulated Marswalk Astronaut EVA Traverse, Suit Telemetry & Cached Sample Tubes (`JZ-EVA-XX`)",
      "",
      `## 3. NASA Datasets (${activeReport.datasetIds.length}) & Recorded Observations (${activeReport.observationIds.length})`,
      "### NASA Orbital Datasets",
      ...(activeReport.datasetIds.length > 0
        ? activeReport.datasetIds.map((id) => {
            const ds = mission.selectedDatasets.find((d) => d.id === id);
            const meta = resolveDatasetMetadata(id);
            return `- **${ds?.name ?? meta.name}** (${ds?.source ?? meta.instrumentAndMission})`;
          })
        : ["- None recorded."]),
      "",
      "### User-Recorded Observations & Attached Rover Ground Truth",
      ...(activeReport.observationIds.length > 0
        ? activeReport.observationIds.map((id) => {
            const obs = mission.selectedObservations.find((o) => o.id === id);
            if (!obs) return `- ${id}`;
            const roverStr = obs.surfaceImage
              ? ` | Attached Perseverance Ground Truth: Sol ${obs.surfaceImage.sol} ${obs.surfaceImage.instrument} (Site ${obs.surfaceImage.site ?? "—"}, Drive ${obs.surfaceImage.drive ?? "—"})`
              : "";
            return `- **${obs.name}** (${obs.source})${roverStr}${obs.description ? ` — ${obs.description}` : ""}`;
          })
        : ["- None recorded."]),
      "",
      "## 4. Traverse Stratigraphy (USGS SIM 3464) & Simulated EVA Fieldwork",
      activeRoute
        ? `- **Planned Route:** ${activeRoute.name} (${formatDistance(activeRoute.distanceMeters)}, ${activeRoute.waypoints.length} waypoints)`
        : "- **Planned Route:** None confirmed",
      ...(stratigraphicProfile
        ? [
            `- **Stratigraphic Sequence:** ${stratigraphicProfile.uniqueUnitsTraversed.map((u) => `[${u.unit_code}] ${u.unit_name}`).join(" -> ")}`,
            ...stratigraphicProfile.contacts.map((c) => `  - ${c.summary}`),
          ]
        : []),
      `- **Simulated EVA Traverse:** ${Math.round(mission.simulation.totalTraverseMeters ?? 0)} m`,
      "",
      `### Cached Simulated EVA Samples (${simulatedSamples.length})`,
      ...(simulatedSamples.length > 0
        ? simulatedSamples.map((s, idx) => {
            const serial =
              s.tubeId ?? `JZ-EVA-${String(idx + 1).padStart(2, "0")}`;
            const unit =
              s.geologicUnitCode ??
              identifyGeologicUnitAt(s.coordinates).unit_code;
            return `- **[${serial}] ${s.name}** (${s.sampleType} | Unit: \`${unit}\` | Provenance: \`${s.provenanceTier ?? "SIMULATED_EVA_ACTIVITY"}\`) — ${s.geologicalContext}`;
          })
        : ["- None cached."]),
      "",
      "## 5. Scientific Conclusions",
      ...(activeReport.conclusions.length > 0
        ? activeReport.conclusions.map((c) => `- ${c}`)
        : ["- None recorded."]),
      "",
      "## 6. Knowledge Gaps & Evidentiary Limitations",
      ...activeReport.knowledgeGaps.map(
        (g) => `- **Gap (${g.description}):** ${g.reason}`
      ),
      ...activeReport.limitations.map((l) => `- ${l}`),
      "",
      "## 7. Recommended Follow-Up Investigations",
      ...(activeReport.recommendedInvestigations.length > 0
        ? activeReport.recommendedInvestigations.map((r) => `- ${r}`)
        : ["- None specified."]),
    ];

    const blob = new Blob([lines.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeReport.id}-expedition-dossier.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportJson(): void {
    if (!activeReport) return;
    const payload = {
      dossierSchemaVersion: "NASA-SpaceApps-2026-MartianMap-v1.0",
      exportedAt: new Date().toISOString(),
      provenanceClassification: {
        tier1_orbital: "NASA_PDS_ORBITAL",
        tier2_geologicMap: "USGS_SIM3464_MAP",
        tier3_roverSurface: "PERSEVERANCE_EDR_SURFACE",
        tier4_simulatedEva: "SIMULATED_EVA_ACTIVITY",
      },
      report: activeReport,
      stratigraphicSummary: stratigraphicProfile
        ? {
            distinctUnits: stratigraphicProfile.uniqueUnitsTraversed.map((u) => ({
              unit_code: u.unit_code,
              unit_name: u.unit_name,
              stratigraphic_age: u.stratigraphic_age,
            })),
            contactCrossings: stratigraphicProfile.contacts.map(
              (c) => c.summary
            ),
            hazardZonesCount:
              stratigraphicProfile.steepHazardSegments.length +
              stratigraphicProfile.sandHazardSegments.length,
          }
        : null,
      simulatedSamples: simulatedSamples.map((s, idx) => ({
        ...s,
        tubeId: s.tubeId ?? `JZ-EVA-${String(idx + 1).padStart(2, "0")}`,
        geologicUnitCode:
          s.geologicUnitCode ?? identifyGeologicUnitAt(s.coordinates).unit_code,
        provenanceTier: s.provenanceTier ?? "SIMULATED_EVA_ACTIVITY",
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeReport.id}-expedition-dossier.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <MissionLayout
      stage="Stage 04 · Report"
      title="Expedition Report"
      subtitle="Compile your mission datasets, user-recorded observations, traverse plan, simulated Marswalk EVA samples, field notes, limitations, and conclusions into a citable scientific expedition dossier."
      actions={
        <>
          <Link to="/mission/review" className="mx-btn mx-btn--secondary">
            <ArrowLeft size={15} aria-hidden="true" />
            Mission Review
          </Link>
          {activeReport && (
            <>
              <button
                type="button"
                onClick={handleExportMarkdown}
                className="mx-btn mx-btn--secondary"
              >
                <Download size={15} aria-hidden="true" />
                Export .MD
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="mx-btn mx-btn--secondary"
              >
                <FileCode2 size={15} aria-hidden="true" />
                Export .JSON
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="mx-btn mx-btn--primary"
              >
                <Printer size={15} aria-hidden="true" />
                Print / Export PDF
              </button>
            </>
          )}
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left 5 cols: Report Generator Form & Saved Reports List (hidden in print) */}
        <div className="mx-no-print flex flex-col gap-6 lg:col-span-5">
          <section className="mx-panel p-6" aria-label="Compile report">
            <SectionHeading
              eyebrow="Report compiler"
              title="Generate Expedition Report"
              icon={<FileText size={18} />}
            />

            <form onSubmit={handleGenerateReport} className="grid gap-4">
              <div>
                <label htmlFor="report-title" className="mx-label">
                  Report title
                </label>
                <input
                  id="report-title"
                  type="text"
                  required
                  className="mx-input"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="report-summary" className="mx-label">
                  Executive summary (Generated Mission Summary)
                </label>
                <textarea
                  id="report-summary"
                  required
                  className="mx-input"
                  value={summaryText}
                  onChange={(e) => setSummaryText(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="report-conclusions" className="mx-label">
                  Conclusions (one per line; defaults to recorded interpretations)
                </label>
                <textarea
                  id="report-conclusions"
                  className="mx-input"
                  placeholder="Enter key findings supported by your evidence…"
                  value={conclusionsInput}
                  onChange={(e) => setConclusionsInput(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="report-recommendations" className="mx-label">
                  Recommended follow-up investigations (one per line)
                </label>
                <textarea
                  id="report-recommendations"
                  className="mx-input"
                  placeholder="Specify future orbital or rover observations needed…"
                  value={recommendationsInput}
                  onChange={(e) => setRecommendationsInput(e.target.value)}
                />
              </div>

              <button type="submit" className="mx-btn mx-btn--primary">
                <Plus size={15} aria-hidden="true" />
                Compile Report from Mission State
              </button>
            </form>
          </section>

          {mission.reports.length > 0 && (
            <section className="mx-panel p-6" aria-label="Generated reports">
              <SectionHeading
                eyebrow={`Report archive (${mission.reports.length})`}
                title="Compiled Reports"
              />
              <div className="flex flex-col gap-2">
                {mission.reports.map((rep) => {
                  const active = rep.id === activeReport?.id;
                  return (
                    <div
                      key={rep.id}
                      className={`flex items-center justify-between gap-2 rounded-lg border p-3 ${
                        active
                          ? "border-mx-accent bg-mx-panel-2"
                          : "border-mx-border bg-mx-bg"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveReportId(rep.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <strong className="block truncate text-sm text-mx-text">
                          {rep.title}
                        </strong>
                        <span className="mx-mono text-[11px] text-mx-dim">
                          {new Date(rep.generatedAt).toLocaleString()}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeReport(rep.id)}
                        className="mx-icon-btn !h-8 !w-8 shrink-0"
                        aria-label={`Delete ${rep.title}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Right 7 cols: Formatted Scientific Report Document */}
        <div className="lg:col-span-7">
          {!activeReport ? (
            <EmptyState
              icon={<FileText size={28} />}
              title="No expedition report generated yet"
            >
              Use the compiler on the left to assemble a snapshot of your
              mission’s NASA datasets, user-recorded observations, targets,
              routes, simulated EVA samples, field notes, and knowledge gaps.
            </EmptyState>
          ) : (
            <article
              className="mx-panel mx-print-surface p-8"
              aria-label="Expedition report document"
            >
              <header className="border-b border-mx-border pb-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="mx-eyebrow mx-eyebrow--accent">
                    Mars Explorer · Scientific Expedition Dossier
                  </span>
                  <span className="mx-badge text-[10px]">
                    PROVENANCE-VERIFIED DOSSIER
                  </span>
                </div>
                <h2 className="mx-display m-0 mt-2 text-3xl">
                  {activeReport.title}
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <DataField
                    label="Report ID"
                    value={activeReport.id.slice(0, 14)}
                  />
                  <DataField
                    label="Generated"
                    value={new Date(
                      activeReport.generatedAt
                    ).toLocaleDateString()}
                  />
                  <DataField
                    label="Study Region"
                    value={mission.region?.name}
                    fallback="Jezero Crater"
                  />
                  <DataField
                    label="Selected Route"
                    value={activeRoute?.name}
                    fallback="None confirmed"
                  />
                </div>
              </header>

              {/* 1. Summary & Framing */}
              <section className="mt-6 border-b border-mx-border pb-6">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="mx-heading m-0 text-base">
                    1. Executive Summary &amp; Research Framing
                  </h3>
                  <span className="mx-badge text-[10px]">
                    GENERATED MISSION SUMMARY
                  </span>
                </div>
                <p className="mx-body m-0 mt-2">{activeReport.summary}</p>
                {mission.question && (
                  <p className="mx-body m-0 mt-2 text-xs">
                    <strong>Research Question:</strong> {mission.question}
                  </p>
                )}
              </section>

              {/* 4-Tier Scientific Provenance Audit Matrix */}
              <section className="mt-6 border-b border-mx-border pb-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="mx-heading m-0 text-base">
                    4-Tier Scientific Provenance Audit Matrix
                  </h3>
                  <span className="font-mono text-[10px] text-mx-muted">
                    NASA Space Apps 2026 Provenance Standard
                  </span>
                </div>
                <div className="mt-3 grid gap-2.5 text-xs sm:grid-cols-2">
                  <div className="rounded border border-sky-500/30 bg-sky-950/15 p-2.5">
                    <span className="font-mono text-[10px] font-bold text-sky-300">
                      TIER 1 · NASA_PDS_ORBITAL
                    </span>
                    <p className="m-0 mt-1 text-[11px] text-mx-muted">
                      MRO HiRISE DTM (`DTEEC_048842_1985`), CRISM Targeted VNIR
                      (`FRT00005C5E`), MGS MOLA/TES, and Odyssey THEMIS.
                    </p>
                  </div>
                  <div className="rounded border border-cyan-500/30 bg-cyan-950/15 p-2.5">
                    <span className="font-mono text-[10px] font-bold text-cyan-300">
                      TIER 2 · USGS_SIM3464_MAP
                    </span>
                    <p className="m-0 mt-1 text-[11px] text-mx-muted">
                      USGS Scientific Investigations Map 3464 (Sun &amp; Stack,
                      2020) Jezero chronostratigraphic formations.
                    </p>
                  </div>
                  <div className="rounded border border-emerald-500/30 bg-emerald-950/15 p-2.5">
                    <span className="font-mono text-[10px] font-bold text-emerald-300">
                      TIER 3 · PERSEVERANCE_EDR_SURFACE
                    </span>
                    <p className="m-0 mt-1 text-[11px] text-mx-muted">
                      Mars 2020 Perseverance Rover EDR catalog (108 verified
                      frames across Sol 1, Sol 420, Sol 2024, Sol 2031 in Rover
                      Site/Drive frame).
                    </p>
                  </div>
                  <div className="rounded border border-amber-500/30 bg-amber-950/15 p-2.5">
                    <span className="font-mono text-[10px] font-bold text-amber-300">
                      TIER 4 · SIMULATED_EVA_ACTIVITY
                    </span>
                    <p className="m-0 mt-1 text-[11px] text-mx-muted">
                      Simulated Marswalk 3D traverse, suit vitals, and cached
                      sample tubes (`JZ-EVA-01`…) explicitly segregated from
                      flight data.
                    </p>
                  </div>
                </div>
              </section>

              {/* 2. Actual NASA Datasets & User-Recorded Observations */}
              <section className="mt-6 border-b border-mx-border pb-6">
                <h3 className="mx-heading m-0 text-base">
                  2. Actual NASA Datasets ({activeReport.datasetIds.length}) &amp;
                  User-Recorded Observations ({activeReport.observationIds.length})
                </h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-sky-500/25 bg-sky-950/10 p-3">
                    <span className="mx-field__label text-sky-300">
                      Actual NASA-Derived Datasets
                    </span>
                    {activeReport.datasetIds.length === 0 ? (
                      <p className="mx-body m-0 mt-1 text-xs">None recorded.</p>
                    ) : (
                      <ul className="m-0 mt-1.5 list-disc space-y-1 pl-4 text-xs text-mx-text">
                        {activeReport.datasetIds.map((id) => {
                          const ds = mission.selectedDatasets.find(
                            (d) => d.id === id
                          );
                          const fallbackMeta = resolveDatasetMetadata(id);
                          return (
                            <li key={id}>
                              <strong>{ds?.name ?? fallbackMeta.name}</strong>
                              {ds?.source
                                ? ` (${ds.source})`
                                : ` (${fallbackMeta.instrumentAndMission})`}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/10 p-3">
                    <span className="mx-field__label text-emerald-300">
                      User-Recorded Observations &amp; Rover Ground Truth
                    </span>
                    {activeReport.observationIds.length === 0 ? (
                      <p className="mx-body m-0 mt-1 text-xs">None recorded.</p>
                    ) : (
                      <ul className="m-0 mt-1.5 list-disc space-y-2 pl-4 text-xs text-mx-text">
                        {activeReport.observationIds.map((id) => {
                          const obs = mission.selectedObservations.find(
                            (o) => o.id === id
                          );
                          return (
                            <li key={id}>
                              <div>
                                <strong>{obs ? obs.name : id}</strong>
                                {obs && (
                                  <span className="text-mx-muted">
                                    {" "}
                                    ({obs.source})
                                  </span>
                                )}
                              </div>
                              {obs?.surfaceImage && (
                                <div className="mt-1 rounded border border-cyan-500/30 bg-cyan-950/20 px-2 py-1 text-[11px] text-cyan-200">
                                  <span className="inline-flex items-center gap-1 font-mono font-semibold">
                                    <Camera size={10} />
                                    Perseverance Ground Truth: Sol{" "}
                                    {obs.surfaceImage.sol}{" "}
                                    {obs.surfaceImage.instrument} (Site{" "}
                                    {obs.surfaceImage.site ?? "—"} / Drive{" "}
                                    {obs.surfaceImage.drive ?? "—"})
                                  </span>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </section>

              {/* 3. Traverse Route, USGS SIM 3464 Stratigraphy & Simulated Marswalk EVA Activities */}
              <section className="mt-6 border-b border-mx-border pb-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="mx-heading m-0 text-base">
                    3. Traverse Stratigraphy (USGS SIM 3464) &amp; Simulated
                    Marswalk EVA Fieldwork
                  </h3>
                  <span className="mx-badge border-amber-500/40 text-amber-300 text-[10px]">
                    SIMULATED EVA &amp; ROUTE MODEL
                  </span>
                </div>

                {activeRoute && (
                  <div className="mt-3 rounded border border-mx-border bg-mx-bg p-3 text-xs">
                    <strong>Planned Route: {activeRoute.name}</strong> · Distance:{" "}
                    {formatDistance(activeRoute.distanceMeters)} · Waypoints:{" "}
                    {activeRoute.waypoints.length} · Source:{" "}
                    {activeRoute.measurementSource ??
                      "Spherical Geometry (R = 3389.5 km)"}
                  </div>
                )}

                {stratigraphicProfile && (
                  <div className="mt-3 rounded border border-cyan-500/30 bg-cyan-950/15 p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase text-cyan-300">
                        <Layers size={12} />
                        Traversed Chronostratigraphic Sequence (USGS SIM 3464)
                      </span>
                      <span className="font-mono text-[10px] text-cyan-200">
                        {stratigraphicProfile.uniqueUnitsTraversed.length} Formations ·{" "}
                        {stratigraphicProfile.contacts.length} Contact Crossings
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {stratigraphicProfile.uniqueUnitsTraversed.map((unit, idx) => (
                        <div
                          key={unit.unit_code}
                          className="flex items-center gap-1.5"
                        >
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
                          {idx <
                            stratigraphicProfile.uniqueUnitsTraversed.length - 1 && (
                            <span className="font-mono text-mx-muted">→</span>
                          )}
                        </div>
                      ))}
                    </div>
                    {stratigraphicProfile.contacts.length > 0 && (
                      <ul className="m-0 mt-2 list-disc space-y-1 pl-4 text-[11px] text-mx-muted">
                        {stratigraphicProfile.contacts.map((c) => (
                          <li key={c.id} className="text-mx-text">
                            {c.summary}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <p className="m-0 mt-2.5 text-xs text-mx-muted">
                  Visited Targets:{" "}
                  <strong className="text-mx-text">
                    {mission.simulation.visitedTargetIds.length} /{" "}
                    {activeReport.scientificTargetIds.length}
                  </strong>{" "}
                  · Simulated Surface Traverse:{" "}
                  <strong className="text-mx-text">
                    {Math.round(mission.simulation.totalTraverseMeters ?? 0)} m
                  </strong>{" "}
                  · Cached Simulated Samples:{" "}
                  <strong className="text-amber-300">
                    {simulatedSamples.length}
                  </strong>
                </p>

                {simulatedSamples.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <span className="mx-field__label">
                      Cached Simulated EVA Samples (Provenance:{" "}
                      <code>SIMULATED_EVA_ACTIVITY</code>)
                    </span>
                    {simulatedSamples.map((sample, idx) => {
                      const tubeSerial =
                        sample.tubeId ??
                        `JZ-EVA-${String(idx + 1).padStart(2, "0")}`;
                      const unitCode =
                        sample.geologicUnitCode ??
                        identifyGeologicUnitAt(sample.coordinates).unit_code;
                      return (
                        <div
                          key={sample.id}
                          className="rounded border border-amber-500/30 bg-amber-950/15 p-2.5 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded border border-cyan-500/35 bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyan-200">
                                {tubeSerial}
                              </span>
                              <span className="rounded border border-white/20 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white">
                                {unitCode}
                              </span>
                              <strong className="text-mx-text">
                                {sample.name}
                              </strong>
                            </div>
                            <span className="mx-mono text-[11px] text-amber-300">
                              {sample.sampleType} ·{" "}
                              {formatCoordinates(
                                sample.coordinates.latitude,
                                sample.coordinates.longitude
                              )}{" "}
                              ·{" "}
                              {sample.provenanceTier ??
                                "SIMULATED_EVA_ACTIVITY"}
                            </span>
                          </div>
                          <p className="m-0 mt-1 text-mx-muted">
                            {sample.geologicalContext}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* 4. Scientific Targets & Field Notes */}
              <section className="mt-6 border-b border-mx-border pb-6">
                <h3 className="mx-heading m-0 text-base">
                  4. Scientific Targets ({activeReport.scientificTargetIds.length}
                  ) &amp; Investigator Field Notes ({activeReport.fieldNotes.length})
                </h3>

                {activeReport.fieldNotes.length === 0 ? (
                  <p className="mx-body m-0 mt-2 text-xs">
                    No field notes were logged for this report.
                  </p>
                ) : (
                  <ul className="m-0 mt-3 list-none space-y-2 p-0">
                    {activeReport.fieldNotes.map((note) => (
                      <li
                        key={note.id}
                        className="rounded border border-mx-border bg-mx-bg p-3 text-xs"
                      >
                        <span className="mx-mono text-mx-accent">
                          {formatCoordinates(
                            note.coordinates.latitude,
                            note.coordinates.longitude
                          )}
                        </span>
                        <p className="m-0 mt-1 text-mx-text">{note.content}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* 5. Conclusions */}
              <section className="mt-6 border-b border-mx-border pb-6">
                <h3 className="mx-heading m-0 text-base">
                  5. Scientific Conclusions (User / Synthesized)
                </h3>
                {activeReport.conclusions.length === 0 ? (
                  <p className="mx-body m-0 mt-2 text-xs">
                    No conclusions recorded.
                  </p>
                ) : (
                  <ul className="m-0 mt-2 list-disc space-y-1.5 pl-5 text-xs text-mx-text">
                    {activeReport.conclusions.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                )}
              </section>

              {/* 6. Knowledge Gaps & Limitations */}
              <section className="mt-6 border-b border-mx-border pb-6">
                <h3 className="mx-heading m-0 text-base">
                  6. Knowledge Gaps &amp; Evidentiary Limitations
                </h3>

                {activeReport.knowledgeGaps.length === 0 &&
                activeReport.limitations.length === 0 ? (
                  <p className="mx-body m-0 mt-2 text-xs">
                    No explicit gaps or limitations recorded.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2 text-xs text-mx-muted">
                    {activeReport.knowledgeGaps.map((g) => (
                      <p key={g.id} className="m-0">
                        <strong className="text-mx-text">
                          Gap — {g.description}:
                        </strong>{" "}
                        {g.reason}
                      </p>
                    ))}
                    {activeReport.limitations.map((lim, i) => (
                      <p key={i} className="m-0">
                        • {lim}
                      </p>
                    ))}
                  </div>
                )}
              </section>

              {/* 7. Recommended Investigations */}
              <section className="mt-6">
                <h3 className="mx-heading m-0 text-base">
                  7. Recommended Follow-Up Investigations
                </h3>
                {activeReport.recommendedInvestigations.length === 0 ? (
                  <p className="mx-body m-0 mt-2 text-xs">
                    No follow-up investigations specified.
                  </p>
                ) : (
                  <ul className="m-0 mt-2 list-disc space-y-1.5 pl-5 text-xs text-mx-text">
                    {activeReport.recommendedInvestigations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                )}
              </section>
            </article>
          )}
        </div>
      </div>
    </MissionLayout>
  );
}

// frontend/src/features/mission/MedaEnvironmentalPanel.tsx
// Phase 2, Task T-2.2: Perseverance MEDA Environmental Data Inspector.
// Allows users to inspect authentic NASA PDS4 MEDA measurements (PS, ATS, TIRS,
// RHS, WS, RDS, ANC), view units/timestamps/sol metadata, inspect missing-value
// handling, and log environmental observations or derived measurements without
// conflating modern meteorology with geological or mineralogical evidence.

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CircleAlert,
  CloudSun,
  Database,
  Plus,
  RefreshCw,
  Table,
  Thermometer,
  Wind,
} from "lucide-react";
import { DataField, EmptyState, SectionHeading } from "../../components/ui";
import { useMission } from "../../state/mission/MissionContext";
import { filterProductsThroughDate } from "../../utils/temporalFilters";
import {
  MEDA_SENSOR_METADATA,
  medaProvider,
  parseMedaNumeric,
  summarizeMedaSeries,
  type MedaCatalogResponse,
  type MedaObservationsResponse,
  type MedaSensorCode,
} from "../../services/providers/medaProvider";

interface MedaEnvironmentalPanelProps {
  onLogObservation?: (params: {
    name: string;
    description: string;
    observationDate: string;
    limitation: string;
    sourceId: string;
    processingMethod: string;
  }) => void;
  onLogDerivedMeasurement?: (params: {
    name: string;
    method: string;
    value: number;
    unit: string;
    limitation: string;
  }) => void;
}

const SENSOR_ORDER: MedaSensorCode[] = [
  "PS",
  "ATS",
  "TIRS",
  "RHS",
  "WS",
  "RDS",
  "ANC",
];

export default function MedaEnvironmentalPanel({
  onLogObservation,
  onLogDerivedMeasurement,
}: MedaEnvironmentalPanelProps) {
  const { mission } = useMission();
  const [catalog, setCatalog] = useState<MedaCatalogResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [selectedSensor, setSelectedSensor] = useState<MedaSensorCode>("PS");
  const [selectedColumn, setSelectedColumn] = useState<string>("PRESSURE");

  const [obsData, setObsData] = useState<MedaObservationsResponse | null>(null);
  const [obsLoading, setObsLoading] = useState(false);
  const [obsError, setObsError] = useState<string | null>(null);
  const [showRawTable, setShowRawTable] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  async function loadCatalog(forceRetry = false): Promise<void> {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await medaProvider.getProducts({ forceRetry });
      setCatalog(res);
    } catch (err: unknown) {
      setCatalogError(
        err instanceof Error
          ? err.message
          : "Unable to load MEDA environmental product catalog."
      );
    } finally {
      setCatalogLoading(false);
    }
  }

  useEffect(() => {
    void loadCatalog(false);
  }, []);

  const temporalProducts = useMemo(() => {
    if (!catalog) return null;
    if (mission.temporal.mode === "future") return [];
    return mission.temporal.mode === "past"
      ? filterProductsThroughDate(catalog.products, mission.temporal.selectedDate)
      : catalog.products;
  }, [catalog, mission.temporal.mode, mission.temporal.selectedDate]);

  const activeProductSummary = temporalProducts?.find((p) => p.sensor === selectedSensor) ?? null;

  // Keep selectedColumn synchronized with the active sensor's primary columns
  useEffect(() => {
    const sensorMeta = MEDA_SENSOR_METADATA[selectedSensor];
    if (sensorMeta && sensorMeta.primaryColumns.length > 0 && !sensorMeta.primaryColumns.some((column) => column.column === selectedColumn)) {
      setSelectedColumn(sensorMeta.primaryColumns[0].column);
    }
    setActionFeedback(null);
  }, [selectedSensor]);

  useEffect(() => {
    if (!activeProductSummary) {
      setObsData(null);
      setObsError(null);
      setObsLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchSensorRows(): Promise<void> {
      setObsLoading(true);
      setObsError(null);
      try {
        const res = await medaProvider.getObservations(
          activeProductSummary!.sensor,
          activeProductSummary!.sol,
          { limit: 150, offset: 0 }
        );
        if (!cancelled) {
          setObsData(res);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setObsError(
            err instanceof Error
              ? err.message
              : `Unable to load MEDA ${activeProductSummary!.sensor} measurements.`
          );
        }
      } finally {
        if (!cancelled) {
          setObsLoading(false);
        }
      }
    }

    void fetchSensorRows();
    return () => {
      cancelled = true;
    };
  }, [activeProductSummary]);

  const sensorMeta = MEDA_SENSOR_METADATA[selectedSensor];
  const activeColConfig =
    sensorMeta.primaryColumns.find((c) => c.column === selectedColumn) ??
    sensorMeta.primaryColumns[0];

  const seriesSummary = useMemo(() => {
    if (!obsData || !activeColConfig) return null;
    return summarizeMedaSeries(
      obsData.observations,
      activeColConfig.column,
      activeColConfig.label,
      activeColConfig.unit
    );
  }, [obsData, activeColConfig]);

  // Build SVG polyline points for valid numeric values
  const svgChart = useMemo(() => {
    if (
      !seriesSummary ||
      seriesSummary.validCount < 2 ||
      seriesSummary.min === null ||
      seriesSummary.max === null
    ) {
      return null;
    }
    const width = 560;
    const height = 110;
    const padX = 10;
    const padY = 12;
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;
    const range = Math.max(1e-6, seriesSummary.max - seriesSummary.min);
    const totalPts = Math.max(1, seriesSummary.points.length - 1);

    const segments: string[] = [];
    let currentSegment: string[] = [];

    for (const pt of seriesSummary.points) {
      if (pt.value === null) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment.join(" "));
          currentSegment = [];
        }
        continue;
      }
      const x = padX + (pt.index / totalPts) * plotW;
      const y =
        padY + plotH - ((pt.value - seriesSummary.min) / range) * plotH;
      currentSegment.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    if (currentSegment.length > 0) {
      segments.push(currentSegment.join(" "));
    }

    return { width, height, segments };
  }, [seriesSummary]);

  function handleRecordObservation(): void {
    if (!onLogObservation || !activeProductSummary || !seriesSummary) return;
    const solNum = Number(activeProductSummary.sol) || 1;
    const dateStr = (activeProductSummary.start_time || "2021-02-19").slice(
      0,
      10
    );
    const rangeStr =
      seriesSummary.min !== null && seriesSummary.max !== null
        ? `${seriesSummary.min} to ${seriesSummary.max} ${seriesSummary.unit} (mean ${seriesSummary.mean} ${seriesSummary.unit} across ${seriesSummary.validCount} valid samples)`
        : "No valid numeric samples in selected window";

    onLogObservation({
      name: `MEDA ${selectedSensor} Sol ${solNum}: ${seriesSummary.displayLabel}`,
      description: `Perseverance MEDA ${sensorMeta.name} on Sol ${solNum} (${activeProductSummary.logical_identifier}): ${seriesSummary.displayLabel} ranged from ${rangeStr} between LMST ${seriesSummary.firstTimestamp ?? "N/A"} and ${seriesSummary.lastTimestamp ?? "N/A"}.`,
      observationDate: dateStr,
      limitation: `${sensorMeta.geologicalDistinctionNote} Recorded at Octavia E. Butler Landing Site (~18.4447°N, 77.4508°E), ~2.2 km SE of the western Jezero delta front.`,
      sourceId: activeProductSummary.logical_identifier,
      processingMethod: `NASA PDS4 ${activeProductSummary.processing_level} MEDA ${selectedSensor} (${activeColConfig.column}, ${seriesSummary.unit})`,
    });
    setActionFeedback(
      `Logged MEDA ${selectedSensor} (${seriesSummary.displayLabel}) observation to mission record.`
    );
  }

  function handleRecordDerivedMean(): void {
    if (
      !onLogDerivedMeasurement ||
      !activeProductSummary ||
      !seriesSummary ||
      seriesSummary.mean === null
    ) {
      return;
    }
    const solNum = Number(activeProductSummary.sol) || 1;
    onLogDerivedMeasurement({
      name: `MEDA ${selectedSensor} Sol ${solNum} Mean ${seriesSummary.displayLabel}`,
      method: `PDS4 ${activeProductSummary.logical_identifier} (${seriesSummary.validCount} valid samples; min ${seriesSummary.min}, max ${seriesSummary.max} ${seriesSummary.unit})`,
      value: seriesSummary.mean,
      unit: seriesSummary.unit,
      limitation: sensorMeta.geologicalDistinctionNote,
    });
    setActionFeedback(
      `Recorded derived mean (${seriesSummary.mean} ${seriesSummary.unit}) in quantitative measurements.`
    );
  }

  return (
    <section
      className="mx-panel p-6"
      aria-labelledby="meda-environmental-heading"
    >
      <SectionHeading
        eyebrow="Phase 2 · T-2.2 · Authentic NASA PDS4 Environmental Data"
        title="Perseverance MEDA Environmental Measurements"
        icon={<CloudSun size={18} />}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {catalog && (
              <span
                className={`mx-badge ${
                  catalog.retrievalMode === "live_backend"
                    ? "mx-badge--success"
                    : "mx-badge--accent"
                }`}
                title={catalog.retrievalLabel}
              >
                {catalog.retrievalMode === "live_backend"
                  ? "Live Backend API (PDS4 Validated)"
                  : "Local PDS4 Validated Archive"}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                medaProvider.resetCooldown();
                void loadCatalog(true);
              }}
              disabled={catalogLoading}
              className="mx-btn mx-btn--secondary mx-btn--sm"
            >
              <RefreshCw size={13} aria-hidden="true" />
              {catalogLoading ? "Loading…" : "Refresh Source"}
            </button>
          </div>
        }
      />

      {mission.temporal.mode !== "present" && (
        <p className="mb-4 rounded border border-amber-500/30 bg-amber-950/15 p-3 text-xs text-amber-200" role="status">
          {mission.temporal.mode === "future"
            ? "Future MEDA telemetry is unavailable; no forecast is generated."
            : `Showing validated MEDA products acquired on or before ${mission.temporal.selectedDate}. These are modern Jezero rover measurements, not a reconstruction of ancient Mars.`}
        </p>
      )}

      {/* Scientific Boundary Callout (Requirement Part 2.E) */}
      <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-950/15 p-3.5 text-xs">
        <div className="flex items-start gap-2">
          <CircleAlert
            size={15}
            className="mt-0.5 shrink-0 text-amber-300"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <strong className="text-amber-200">
              Scientific Interpretation &amp; Geographic Boundary (Environmental vs. Geological Evidence):
            </strong>
            <p className="m-0 text-mx-muted">
              MEDA measurements characterize{" "}
              <strong className="text-mx-text">
                modern Martian surface meteorology and radiation
              </strong>{" "}
              at Perseverance&apos;s Octavia E. Butler Landing Site (`18.4447°N,
              77.4508°E` on Sol 0001 and crater-floor traverse on Sol 0036, ~2.2
              km SE of the western Jezero Delta front). They support EVA hazard
              and thermal modeling and{" "}
              <strong className="text-amber-200">
                must not be interpreted as direct evidence of ancient lake
                deposits or phyllosilicate mineralogy
              </strong>
              .
            </p>
          </div>
        </div>
      </div>

      {catalogLoading ? (
        <EmptyState compact title="Loading NASA PDS4 MEDA products…">
          Connecting to MEDA product catalog (`urn:nasa:pds:mars2020_meda`)…
        </EmptyState>
      ) : catalogError ? (
        <EmptyState
          compact
          title="MEDA Environmental Data Unavailable"
          action={
            <button
              type="button"
              onClick={() => void loadCatalog(true)}
              className="mx-btn mx-btn--primary mx-btn--sm"
            >
              Retry MEDA Retrieval
            </button>
          }
        >
          {catalogError}
        </EmptyState>
      ) : !catalog || catalog.products.length === 0 ? (
        <EmptyState compact title="No validated MEDA products found">
          Run the PDS4 MEDA processor to populate validated environmental
          products.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {/* Sensor Selector Tabs */}
          <div>
            <span className="mx-label">
              1. Select MEDA Subsystem Sensor ({temporalProducts?.length ?? 0} Validated
              PDS4 Products)
            </span>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Select MEDA environmental sensor"
            >
              {SENSOR_ORDER.map((sensorCode) => {
                const prod = temporalProducts?.find(
                  (p) => p.sensor === sensorCode
                );
                if (!prod) return null;
                const active = selectedSensor === sensorCode;
                const meta = MEDA_SENSOR_METADATA[sensorCode];
                return (
                  <button
                    key={sensorCode}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedSensor(sensorCode)}
                    className={`mx-chip !py-1.5 !px-3 ${
                      active ? "mx-chip--active" : ""
                    }`}
                  >
                    <span className="font-mono font-semibold">{sensorCode}</span>
                    <span className="ml-1 text-[11px] opacity-85">
                      · {meta.categoryLabel} (Sol {Number(prod.sol)})
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Solar geometry measurements">
              {[["LS", "Solar Longitude (Ls)"], ["SOLAR_ZENITH_ANGLE", "Solar Zenith Angle"], ["SOLAR_AZIMUTH_ANGLE", "Solar Azimuth Angle"]].map(([column, label]) => (
                <button key={column} type="button" className={`mx-chip !py-1 !px-2.5 text-xs ${selectedSensor === "ANC" && selectedColumn === column ? "mx-chip--active" : ""}`} disabled={!temporalProducts?.some((product) => product.sensor === "ANC")} onClick={() => { setSelectedSensor("ANC"); setSelectedColumn(column); }}>{label}</button>
              ))}
            </div>
          </div>

          {!activeProductSummary && (
            <EmptyState compact title="No MEDA product for this temporal selection">
              {mission.temporal.mode === "past"
                ? "No measurement from this sensor was acquired on or before the selected date."
                : "No future MEDA measurements are available."}
            </EmptyState>
          )}

          {/* Active Sensor Metadata & PDS4 Provenance */}
          {activeProductSummary && (
            <div className="rounded-lg border border-mx-border bg-mx-bg p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-mx-border pb-3">
                <div>
                  <span className="mx-eyebrow mx-eyebrow--accent">
                    {sensorMeta.name} · PDS4 {activeProductSummary.processing_level}{" "}
                    Product
                  </span>
                  <h3 className="mx-heading m-0 mt-1 text-base">
                    {activeProductSummary.title}
                  </h3>
                  <p className="mx-body m-0 mt-1 text-xs">
                    {sensorMeta.summary}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {onLogObservation && seriesSummary && (
                    <button
                      type="button"
                      onClick={handleRecordObservation}
                      className="mx-btn mx-btn--primary mx-btn--sm"
                    >
                      <Plus size={13} aria-hidden="true" />
                      Log as Environmental Observation
                    </button>
                  )}
                  {onLogDerivedMeasurement &&
                    seriesSummary &&
                    seriesSummary.mean !== null && (
                      <button
                        type="button"
                        onClick={handleRecordDerivedMean}
                        className="mx-btn mx-btn--secondary mx-btn--sm"
                      >
                        <Plus size={13} aria-hidden="true" />
                        Record Mean in Analyses
                      </button>
                    )}
                </div>
              </div>

              {actionFeedback && (
                <p className="mt-3 mb-0 rounded border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-300">
                  ✓ {actionFeedback}
                </p>
              )}

              <div className="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DataField
                  label="PDS4 Logical Identifier"
                  value={activeProductSummary.logical_identifier}
                />
                <DataField
                  label="Martian Sol & Version"
                  value={`Sol ${Number(activeProductSummary.sol)} (v${
                    activeProductSummary.product_version
                  })`}
                />
                <DataField
                  label="UTC Acquisition Window"
                  value={`${activeProductSummary.start_time.slice(
                    0,
                    19
                  )}Z → ${activeProductSummary.stop_time.slice(11, 19)}Z`}
                />
                <DataField
                  label="Total Validated PDS4 Rows"
                  value={`${activeProductSummary.record_count.toLocaleString()} records (${
                    activeProductSummary.invalid_values_replaced ?? 0
                  } sentinel values → null)`}
                />
              </div>

              <p className="m-0 mt-3 text-[11px] text-amber-200/90">
                <strong>Evidentiary Distinction:</strong>{" "}
                {sensorMeta.geologicalDistinctionNote}
              </p>
            </div>
          )}

          {/* Parameter Selector & Time-Series Summary */}
          {obsLoading ? (
            <EmptyState
              compact
              title={`Loading ${selectedSensor} measurements…`}
            />
          ) : obsError ? (
            <EmptyState compact title="Measurement retrieval error">
              {obsError}
            </EmptyState>
          ) : (
            obsData &&
            seriesSummary && (
              <div className="rounded-lg border border-mx-border bg-mx-bg p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mx-border pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mx-label !mb-0">
                      2. Inspect Measurement Column:
                    </span>
                    {sensorMeta.primaryColumns.map((col) => (
                      <button
                        key={col.column}
                        type="button"
                        onClick={() => setSelectedColumn(col.column)}
                        className={`mx-chip !py-1 !px-2.5 text-xs ${
                          selectedColumn === col.column ? "mx-chip--active" : ""
                        }`}
                      >
                        {col.label} ({col.unit})
                      </button>
                    ))}
                  </div>

                  <span className="mx-mono text-[11px] text-mx-dim">
                    {obsData.retrievalLabel}
                  </span>
                </div>

                {activeColConfig?.note && (
                  <p className="m-0 mt-2.5 text-[11px] text-mx-accent">
                    Transformation note: {activeColConfig.note}
                  </p>
                )}

                {/* Summary Metrics Grid */}
                <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <DataField
                    label={`Minimum (${seriesSummary.unit})`}
                    value={
                      seriesSummary.min !== null
                        ? `${seriesSummary.min} ${seriesSummary.unit}`
                        : "All missing"
                    }
                  />
                  <DataField
                    label={`Maximum (${seriesSummary.unit})`}
                    value={
                      seriesSummary.max !== null
                        ? `${seriesSummary.max} ${seriesSummary.unit}`
                        : "All missing"
                    }
                  />
                  <DataField
                    label={`Mean (${seriesSummary.unit})`}
                    value={
                      seriesSummary.mean !== null
                        ? `${seriesSummary.mean} ${seriesSummary.unit}`
                        : "All missing"
                    }
                  />
                  <DataField
                    label="Valid Samples"
                    value={`${seriesSummary.validCount} of ${obsData.observations.length}`}
                  />
                  <DataField
                    label="Missing / Sentinel"
                    value={
                      seriesSummary.missingCount > 0
                        ? `${seriesSummary.missingCount} (excluded, not 0)`
                        : "0 missing"
                    }
                  />
                  <DataField
                    label="LMST Span (Sampled)"
                    value={
                      seriesSummary.firstTimestamp && seriesSummary.lastTimestamp
                        ? `${seriesSummary.firstTimestamp.slice(-12)} → ${seriesSummary.lastTimestamp.slice(-12)}`
                        : "SCLK indexed"
                    }
                  />
                </div>

                {/* Diurnal / Time-Series Profile SVG */}
                {svgChart ? (
                  <div className="mt-4 rounded border border-mx-border bg-mx-panel/70 p-3">
                    <div className="mb-1.5 flex items-center justify-between text-[11px] text-mx-muted">
                      <span className="inline-flex items-center gap-1.5 font-mono text-mx-text">
                        {selectedSensor === "ATS" ||
                        selectedSensor === "TIRS" ? (
                          <Thermometer size={13} className="text-mx-accent" />
                        ) : selectedSensor === "WS" ? (
                          <Wind size={13} className="text-mx-accent" />
                        ) : (
                          <Activity size={13} className="text-mx-accent" />
                        )}
                        {seriesSummary.displayLabel} Profile (Sol{" "}
                        {Number(obsData.product.sol)})
                      </span>
                      <span className="font-mono">
                        Range: {seriesSummary.min} → {seriesSummary.max}{" "}
                        {seriesSummary.unit}
                      </span>
                    </div>
                    <svg
                      viewBox={`0 0 ${svgChart.width} ${svgChart.height}`}
                      className="h-28 w-full overflow-visible"
                      role="img"
                      aria-label={`Time series chart for ${seriesSummary.displayLabel}`}
                    >
                      <line
                        x1="10"
                        y1="12"
                        x2={svgChart.width - 10}
                        y2="12"
                        stroke="currentColor"
                         className="text-mx-border"
                        strokeDasharray="3 3"
                      />
                      <line
                        x1="10"
                        y1={svgChart.height - 12}
                        x2={svgChart.width - 10}
                        y2={svgChart.height - 12}
                        stroke="currentColor"
                        className="text-mx-border"
                        strokeDasharray="3 3"
                      />
                      {svgChart.segments.map((pts, idx) => (
                        <polyline
                          key={idx}
                          fill="none"
                          stroke="#e46b39"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={pts}
                        />
                      ))}
                    </svg>
                  </div>
                ) : (
                  <p className="m-0 mt-3 text-xs text-mx-muted">
                    No valid numeric values in the current window to plot (all
                    sampled rows for this column are flagged as missing/sentinel).
                  </p>
                )}

                {/* Collapsible Raw PDS4 Table */}
                <div className="mt-4 border-t border-mx-border pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-mx-muted">
                      <Database
                        size={12}
                        className="mr-1 inline text-mx-accent"
                      />
                      Original PDS4 CSV columns &amp; units preserved (`SCLK`,
                      `LMST`, `LTST`, `{activeColConfig.column}`)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowRawTable((prev) => !prev)}
                      className="mx-btn mx-btn--secondary mx-btn--sm"
                    >
                      <Table size={13} aria-hidden="true" />
                      {showRawTable
                        ? "Hide Raw PDS4 Table"
                        : `Inspect Raw PDS4 Rows (${Math.min(
                            25,
                            obsData.observations.length
                          )} shown)`}
                    </button>
                  </div>

                  {showRawTable && (
                    <div className="mt-3 max-h-64 overflow-auto rounded border border-mx-border bg-mx-panel">
                      <table className="w-full border-collapse text-left font-mono text-[11px]">
                        <thead>
                          <tr className="border-b border-mx-border bg-mx-bg text-mx-dim">
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">SCLK</th>
                            <th className="px-3 py-2">LMST (Local Mars Time)</th>
                            <th className="px-3 py-2">LTST</th>
                            {sensorMeta.primaryColumns.map((col) => (
                              <th key={col.column} className="px-3 py-2">
                                {col.column} ({col.unit})
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {obsData.observations.slice(0, 25).map((row, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-mx-border/50 text-mx-text"
                            >
                              <td className="px-3 py-1.5 text-mx-dim">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-1.5">
                                {row["SCLK"] || "—"}
                              </td>
                              <td className="px-3 py-1.5">
                                {row["LMST"] || "—"}
                              </td>
                              <td className="px-3 py-1.5">
                                {row["LTST"] || "—"}
                              </td>
                              {sensorMeta.primaryColumns.map((col) => {
                                const parsed = parseMedaNumeric(row[col.column]);
                                return (
                                  <td key={col.column} className="px-3 py-1.5">
                                    {parsed !== null ? (
                                      <span>{parsed}</span>
                                    ) : (
                                      <span className="text-amber-300/80">
                                        Missing (null)
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}

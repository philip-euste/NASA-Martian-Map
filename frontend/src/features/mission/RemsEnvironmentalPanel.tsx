// frontend/src/features/mission/RemsEnvironmentalPanel.tsx
// Phase 2.3A: Curiosity REMS Environmental Telemetry Inspector (Gale Crater).
//
// Allows users to inspect authentic NASA PDS REMS measurements for Gale Crater,
// inspect diurnal atmospheric cycles, view hardware status and board-level wind
// sensor degradation timelines, and log scientifically grounded observations.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CircleAlert,
  Compass,
  Database,
  Gauge,
  Plus,
  RefreshCw,
  Sun,
  Table,
  Thermometer,
  Wind,
} from "lucide-react";
import { DataField, EmptyState, SectionHeading } from "../../components/ui";
import {
  REMS_CHANNEL_METADATA,
  remsProvider,
  summarizeRemsSeries,
  type RemsCatalogResponse,
  type RemsObservation,
  type RemsObservationsResponse,
  type RemsSensorChannel,
} from "../../services/providers/remsProvider";

interface RemsEnvironmentalPanelProps {
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

const CHANNELS: RemsSensorChannel[] = ["PS", "AT", "GT", "RH", "WS", "UV"];

export default function RemsEnvironmentalPanel({
  onLogObservation,
  onLogDerivedMeasurement,
}: RemsEnvironmentalPanelProps) {
  const [catalog, setCatalog] = useState<RemsCatalogResponse | null>(null);
  const [selectedSol, setSelectedSol] = useState<number>(10);
  const [selectedChannel, setSelectedChannel] = useState<RemsSensorChannel>("PS");
  const [activeTab, setActiveTab] = useState<"chart" | "table" | "provenance">("chart");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [observationNotes, setObservationNotes] = useState<string>("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const cat = await remsProvider.fetchCatalog();
        if (!cancelled) {
          setCatalog(cat);
          if (cat.sols_represented.length > 0 && !cat.sols_represented.includes(selectedSol)) {
            setSelectedSol(cat.sols_represented[0]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeProductEntry = useMemo(() => {
    if (!catalog) return null;
    return catalog.products.find((p) => p.product.sol === selectedSol) || null;
  }, [catalog, selectedSol]);

  const channelMeta = REMS_CHANNEL_METADATA[selectedChannel];

  // Extract series for active channel
  const seriesData = useMemo(() => {
    if (!activeProductEntry) return [];
    const obs = activeProductEntry.observations;
    const colName = channelMeta.primaryColumn;

    return obs.map((o) => {
      const val = o[colName] as number | null;
      return {
        timestamp: o.TIMESTAMP,
        lmst: o.LMST || "N/A",
        ltst: o.LTST || "N/A",
        value: typeof val === "number" && !Number.isNaN(val) ? val : null,
      };
    });
  }, [activeProductEntry, channelMeta]);

  const seriesSummary = useMemo(() => {
    return summarizeRemsSeries(seriesData.map((d) => d.value));
  }, [seriesData]);

  const isWindInoperable =
    selectedChannel === "WS" &&
    activeProductEntry?.product.wind_hardware_status === "all_wind_inoperable";

  // Canvas rendering for diurnal chart
  useEffect(() => {
    if (activeTab !== "chart" || !canvasRef.current || seriesData.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (isWindInoperable) {
      // Wind inoperable message
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#f87171";
      ctx.font = "14px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        "WIND SENSORS INOPERABLE (HARDWARE FAILURE ON SOLS 0 & 1504)",
        width / 2,
        height / 2 - 10
      );
      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px sans-serif";
      ctx.fillText(
        "All wind sensor boards across Booms 1 and 2 permanently failed prior to Sol 1600.",
        width / 2,
        height / 2 + 14
      );
      return;
    }

    const padding = { top: 30, right: 30, bottom: 40, left: 60 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Background & grid
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    const gridRows = 5;
    for (let i = 0; i <= gridRows; i++) {
      const y = padding.top + (chartH / gridRows) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
    }

    const validPoints = seriesData.filter((d) => d.value !== null);
    if (validPoints.length === 0) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No valid measurements for this channel/sol", width / 2, height / 2);
      return;
    }

    const values = validPoints.map((d) => d.value as number);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const valRange = maxVal === minVal ? 1 : maxVal - minVal;

    // Y-axis labels
    ctx.fillStyle = "#64748b";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";
    for (let i = 0; i <= gridRows; i++) {
      const y = padding.top + (chartH / gridRows) * i;
      const v = maxVal - (valRange / gridRows) * i;
      ctx.fillText(v.toFixed(1) + " " + channelMeta.primaryUnit, padding.left - 8, y + 4);
    }

    // X-axis (LMST) labels
    ctx.textAlign = "center";
    const xLabels = 6;
    for (let i = 0; i <= xLabels; i++) {
      const idx = Math.floor((seriesData.length - 1) * (i / xLabels));
      const pt = seriesData[idx];
      const x = padding.left + (chartW / xLabels) * i;
      if (pt && pt.lmst) {
        // e.g. "00010M00:00:48" -> "00:00"
        const timePart = pt.lmst.includes("M") ? pt.lmst.split("M")[1].slice(0, 5) : pt.lmst.slice(0, 5);
        ctx.fillText(timePart, x, height - padding.bottom + 18);
      }
    }
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Local Mean Solar Time (LMST)", padding.left + chartW / 2, height - 8);

    // Plot line
    ctx.beginPath();
    ctx.strokeStyle =
      selectedChannel === "PS"
        ? "#38bdf8"
        : selectedChannel === "AT" || selectedChannel === "GT"
        ? "#f97316"
        : selectedChannel === "RH"
        ? "#34d399"
        : selectedChannel === "WS"
        ? "#a855f7"
        : "#eab308";
    ctx.lineWidth = 2;

    let first = true;
    for (let i = 0; i < seriesData.length; i++) {
      const pt = seriesData[i];
      if (pt.value === null) {
        first = true;
        continue;
      }
      const x = padding.left + (i / (seriesData.length - 1)) * chartW;
      const y = padding.top + (1 - (pt.value - minVal) / valRange) * chartH;
      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Data points
    ctx.fillStyle = ctx.strokeStyle;
    for (let i = 0; i < seriesData.length; i++) {
      const pt = seriesData[i];
      if (pt.value === null) continue;
      const x = padding.left + (i / (seriesData.length - 1)) * chartW;
      const y = padding.top + (1 - (pt.value - minVal) / valRange) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [seriesData, activeTab, isWindInoperable, selectedChannel, channelMeta]);

  const handleLogObservationSubmit = () => {
    if (!onLogObservation || !activeProductEntry) return;
    const prod = activeProductEntry.product;
    onLogObservation({
      name: `REMS ${channelMeta.name} Diurnal Survey (Sol ${selectedSol})`,
      description: `Curiosity REMS ${channelMeta.fullName} recorded across Sol ${selectedSol} in Gale Crater. ${
        seriesSummary
          ? `Min: ${seriesSummary.min} ${channelMeta.primaryUnit}, Max: ${seriesSummary.max} ${channelMeta.primaryUnit}, Mean: ${seriesSummary.mean} ${channelMeta.primaryUnit}.`
          : ""
      } ${observationNotes}`.trim(),
      observationDate: prod.start_time || new Date().toISOString(),
      limitation: `${prod.wind_failure_notes} ${channelMeta.caveats} ${prod.duty_cycle_notes}`,
      sourceId: `msl_rems_env:${prod.source_table}`,
      processingMethod: `PDS4 RDR Level 4 (${prod.dataset_id}) with sentinel filtering and thermodynamic calibration.`
    });
    setShowLogModal(false);
    setObservationNotes("");
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 text-slate-200 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <Activity className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">
                Curiosity REMS Environmental Telemetry
              </h3>
              <p className="text-xs text-slate-400">
                Rover Environmental Monitoring Station · Gale Crater (Mount Sharp) · NASA PDS
              </p>
            </div>
          </div>
        </div>

        {/* Sol Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 uppercase tracking-wider font-mono">
            Observation Sol:
          </label>
          <div className="flex gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {catalog?.sols_represented.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSol(s)}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition ${
                  selectedSol === s
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Sol {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12 text-slate-400 gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
          <span>Loading authentic PDS REMS dataset...</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-sm flex items-center gap-3">
          <CircleAlert className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="font-medium">Failed to load REMS telemetry</p>
            <p className="text-xs text-red-400/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && activeProductEntry && (
        <>
          {/* Hardware & Provenance Status Banner */}
          <div
            className={`p-3.5 rounded-lg border text-xs flex items-start gap-3 ${
              activeProductEntry.product.wind_hardware_status === "all_wind_inoperable"
                ? "bg-amber-950/30 border-amber-800/60 text-amber-200"
                : "bg-cyan-950/30 border-cyan-800/50 text-cyan-200"
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-mono">
                <span className="font-semibold uppercase tracking-wider">
                  Hardware Status:
                </span>
                <span className="px-2 py-0.5 rounded bg-black/40 border border-current text-[11px]">
                  {activeProductEntry.product.wind_ui_badge}
                </span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {activeProductEntry.product.wind_failure_notes}
              </p>
            </div>
          </div>

          {/* Channel Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {CHANNELS.map((ch) => {
              const meta = REMS_CHANNEL_METADATA[ch];
              const isSelected = selectedChannel === ch;
              return (
                <button
                  key={ch}
                  onClick={() => setSelectedChannel(ch)}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    isSelected
                      ? "bg-slate-800 border-cyan-500/80 text-white shadow-sm ring-1 ring-cyan-500/30"
                      : "bg-slate-950/50 border-slate-800 hover:bg-slate-800/50 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400">
                      {ch}
                    </span>
                    {ch === "PS" && <Gauge className="w-3.5 h-3.5 text-sky-400" />}
                    {ch === "AT" && <Thermometer className="w-3.5 h-3.5 text-orange-400" />}
                    {ch === "GT" && <Thermometer className="w-3.5 h-3.5 text-amber-500" />}
                    {ch === "RH" && <Activity className="w-3.5 h-3.5 text-emerald-400" />}
                    {ch === "WS" && <Wind className="w-3.5 h-3.5 text-purple-400" />}
                    {ch === "UV" && <Sun className="w-3.5 h-3.5 text-yellow-400" />}
                  </div>
                  <div className="font-semibold text-xs mt-1 text-slate-200">
                    {meta.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {meta.primaryUnit}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">
                Latest Reading
              </span>
              <span className="text-base font-bold font-mono text-slate-200 mt-1 block">
                {isWindInoperable
                  ? "N/A (Inoperable)"
                  : seriesSummary?.latest !== null && seriesSummary?.latest !== undefined
                  ? `${seriesSummary.latest} ${channelMeta.primaryUnit}`
                  : "N/A"}
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">
                Diurnal Minimum
              </span>
              <span className="text-base font-bold font-mono text-cyan-400 mt-1 block">
                {isWindInoperable
                  ? "N/A"
                  : seriesSummary?.min !== null && seriesSummary?.min !== undefined
                  ? `${seriesSummary.min} ${channelMeta.primaryUnit}`
                  : "N/A"}
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">
                Diurnal Maximum
              </span>
              <span className="text-base font-bold font-mono text-orange-400 mt-1 block">
                {isWindInoperable
                  ? "N/A"
                  : seriesSummary?.max !== null && seriesSummary?.max !== undefined
                  ? `${seriesSummary.max} ${channelMeta.primaryUnit}`
                  : "N/A"}
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">
                Diurnal Mean
              </span>
              <span className="text-base font-bold font-mono text-slate-300 mt-1 block">
                {isWindInoperable
                  ? "N/A"
                  : seriesSummary?.mean !== null && seriesSummary?.mean !== undefined
                  ? `${seriesSummary.mean} ${channelMeta.primaryUnit}`
                  : "N/A"}
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">
                Sampled Points
              </span>
              <span className="text-base font-bold font-mono text-slate-400 mt-1 block">
                {seriesSummary?.validCount ?? 0} / {seriesSummary?.count ?? 0}
              </span>
            </div>
          </div>

          {/* Sub-view switcher: Chart vs Table vs Provenance */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("chart")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === "chart"
                    ? "bg-slate-800 text-cyan-400 border border-slate-700"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Diurnal Chart
              </button>
              <button
                onClick={() => setActiveTab("table")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === "table"
                    ? "bg-slate-800 text-cyan-400 border border-slate-700"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Data Table ({seriesData.length})
              </button>
              <button
                onClick={() => setActiveTab("provenance")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === "provenance"
                    ? "bg-slate-800 text-cyan-400 border border-slate-700"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                PDS Metadata & Provenance
              </button>
            </div>

            {onLogObservation && (
              <button
                onClick={() => setShowLogModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-medium transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Environmental Observation</span>
              </button>
            )}
          </div>

          {/* Tab 1: Chart */}
          {activeTab === "chart" && (
            <div className="space-y-3">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex justify-center">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={320}
                  className="w-full max-w-full h-auto rounded"
                />
              </div>
              <p className="text-xs text-slate-400 italic">
                * {channelMeta.description} ({channelMeta.caveats})
              </p>
            </div>
          )}

          {/* Tab 2: Table */}
          {activeTab === "table" && (
            <div className="max-h-72 overflow-y-auto border border-slate-800 rounded-lg">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="text-[11px] uppercase bg-slate-950 text-slate-400 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">SCLK</th>
                    <th className="py-2 px-3">LMST</th>
                    <th className="py-2 px-3">LTST</th>
                    <th className="py-2 px-3">
                      {channelMeta.name} ({channelMeta.primaryUnit})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {seriesData.slice(0, 100).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/40">
                      <td className="py-1.5 px-3 text-slate-400">{row.timestamp ?? "null"}</td>
                      <td className="py-1.5 px-3 text-slate-300">{row.lmst}</td>
                      <td className="py-1.5 px-3 text-slate-400">{row.ltst}</td>
                      <td className="py-1.5 px-3 text-cyan-300">
                        {row.value !== null ? row.value : <span className="text-slate-600">null</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 3: Provenance */}
          {activeTab === "provenance" && (
            <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 font-mono uppercase block text-[10px]">
                    Dataset Identifier
                  </span>
                  <span className="font-mono text-slate-200">
                    {activeProductEntry.product.dataset_id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-mono uppercase block text-[10px]">
                    PDS4 Bundle LID
                  </span>
                  <span className="font-mono text-slate-200">
                    {activeProductEntry.product.bundle_lid}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-mono uppercase block text-[10px]">
                    Source Table File
                  </span>
                  <span className="font-mono text-slate-200">
                    {activeProductEntry.product.source_table}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-mono uppercase block text-[10px]">
                    Source Label File
                  </span>
                  <span className="font-mono text-slate-200">
                    {activeProductEntry.product.source_label}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-mono uppercase block text-[10px]">
                    Observation UTC Window
                  </span>
                  <span className="font-mono text-slate-200">
                    {activeProductEntry.product.start_time} → {activeProductEntry.product.stop_time}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-mono uppercase block text-[10px]">
                    Record Sampling
                  </span>
                  <span className="font-mono text-slate-200">
                    {activeProductEntry.product.raw_record_count} raw records →{" "}
                    {activeProductEntry.product.sampled_record_count} downsampled points
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800 text-slate-400 text-[11px] leading-relaxed">
                <p>
                  <strong>Sampling Cadence Disclosure:</strong>{" "}
                  {activeProductEntry.product.duty_cycle_notes}
                </p>
                <p className="mt-1">
                  <strong>Scientific Citation:</strong> Gómez-Elvira, J. et al. (2012). REMS: The Rover
                  Environmental Monitoring Station for the Mars Science Laboratory Mission. Space
                  Science Reviews, 170(1-4), 583–640. doi:10.1007/s11214-012-9921-1.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Observation Modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-lg w-full space-y-4 shadow-2xl">
            <h4 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-cyan-400" />
              <span>Log Environmental Observation to Mission</span>
            </h4>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Target Observation</label>
                <input
                  type="text"
                  readOnly
                  value={`Curiosity REMS ${channelMeta.name} (Sol ${selectedSol})`}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Summary Value</label>
                <input
                  type="text"
                  readOnly
                  value={
                    seriesSummary
                      ? `Mean: ${seriesSummary.mean} ${channelMeta.primaryUnit} (Min: ${seriesSummary.min}, Max: ${seriesSummary.max})`
                      : "N/A"
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Scientific Notes / Mission Context</label>
                <textarea
                  rows={3}
                  value={observationNotes}
                  onChange={(e) => setObservationNotes(e.target.value)}
                  placeholder="Record local atmospheric boundary layer phenomena, sol-to-sol comparison, or rover traverse context..."
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowLogModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleLogObservationSubmit}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition shadow-sm"
              >
                Save to Mission Evidence
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

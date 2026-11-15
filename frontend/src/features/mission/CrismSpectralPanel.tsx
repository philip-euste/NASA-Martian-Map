// frontend/src/features/mission/CrismSpectralPanel.tsx
// Phase 3, Task T-3.3: Interactive MRO CRISM Targeted VNIR Spectral Inspector.
//
// The bundled values and annotations have unverified extraction provenance.
// Archive references identify published products independently of the plotted values.

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
} from "lucide-react";
import { formatCoordinates } from "../../components/ui";
import {
  CRISM_MTRDR_ARCHIVE_URL,
  CRISM_REFERENCE_DATASET_ID,
  CRISM_REFERENCE_LIMITATION,
  CRISM_REFERENCE_METHOD,
  CRISM_REFERENCE_SOURCE,
} from "../../data/evidenceDatasets";
import { useMission } from "../../state/mission/MissionContext";
import type { Observation } from "../../types";
import { createId, toMutable } from "./missionHelpers";

interface SpectralTargetProfile {
  id: string;
  name: string;
  referencedObservationId: string;
  archiveProduct?: string;
  coordinates: { latitude: number; longitude: number };
  geologicUnit: string;
  mineralogy: string;
  parameters: {
    d2300: number;
    bd1900: number;
    bd1400: number;
    olindex3: number;
    minWavelengthUm: number;
  };
  /** Normalized reflectance data points: [wavelength_um, reflectance_ratio] */
  dataPoints: [number, number][];
}

const CRISM_SPECTRA: Record<string, SpectralTargetProfile> = {
  jezero_delta_smectite: {
    id: "jezero_delta_smectite",
    name: "Western Delta Scarp — Fe/Mg Smectite Phyllosilicate",
    referencedObservationId: "FRT00005C5E",
    archiveProduct: "frt00005c5e_07_if166j_mtr3::1.0",
    coordinates: { latitude: 18.4585, longitude: 77.4052 },
    geologicUnit: "HpHd_scarp (Western Delta Scarp Formation)",
    mineralogy: "Fe/Mg Smectite (Nontronite / Saponite) with Hydrated Silica",
    parameters: {
      d2300: 0.042,
      bd1900: 0.068,
      bd1400: 0.035,
      olindex3: 0.008,
      minWavelengthUm: 2.296,
    },
    dataPoints: [
      [1.0, 0.28],
      [1.1, 0.31],
      [1.2, 0.33],
      [1.3, 0.35],
      [1.38, 0.355],
      [1.41, 0.332], // 1.4 µm OH dip
      [1.45, 0.35],
      [1.5, 0.365],
      [1.6, 0.38],
      [1.7, 0.39],
      [1.8, 0.395],
      [1.88, 0.385],
      [1.93, 0.32], // 1.9 µm H2O dip
      [2.0, 0.375],
      [2.1, 0.395],
      [2.2, 0.402],
      [2.25, 0.405],
      [2.296, 0.345], // 2.296 µm Fe/Mg-OH smectite dip
      [2.35, 0.39],
      [2.4, 0.38],
      [2.5, 0.36],
      [2.6, 0.34],
    ],
  },

  jezero_marginal_carbonate: {
    id: "jezero_marginal_carbonate",
    name: "Western Margin — Magnesite / Mg-Carbonate Bench",
    referencedObservationId: "HRL000040FF",
    archiveProduct: "hrl000040ff_07_if183j_mtr3::1.0",
    coordinates: { latitude: 18.472, longitude: 77.345 },
    geologicUnit: "Hcf_m (Marginal Carbonate Bench Unit)",
    mineralogy: "Magnesite (Mg-Carbonate) with Talc & Amorphous Silica",
    parameters: {
      d2300: 0.058,
      bd1900: 0.024,
      bd1400: 0.018,
      olindex3: 0.012,
      minWavelengthUm: 2.302,
    },
    dataPoints: [
      [1.0, 0.26],
      [1.1, 0.28],
      [1.2, 0.31],
      [1.3, 0.33],
      [1.4, 0.34],
      [1.5, 0.35],
      [1.6, 0.36],
      [1.7, 0.375],
      [1.8, 0.385],
      [1.9, 0.38],
      [2.0, 0.39],
      [2.1, 0.40],
      [2.2, 0.405],
      [2.28, 0.395],
      [2.302, 0.338], // 2.30 µm CO3 dip
      [2.36, 0.38],
      [2.45, 0.375],
      [2.512, 0.325], // 2.51 µm secondary CO3 dip
      [2.58, 0.35],
      [2.6, 0.34],
    ],
  },

  jezero_seitah_olivine: {
    id: "jezero_seitah_olivine",
    name: "Séítah Formation — Olivine Cumulate Bedrock",
    referencedObservationId: "FRT0000B204",
    coordinates: { latitude: 18.4295, longitude: 77.439 },
    geologicUnit: "HNcf_f (Crater Floor Fractured Unit)",
    mineralogy: "Forsteritic Olivine (Fo60) with Augite Pyroxene",
    parameters: {
      d2300: 0.005,
      bd1900: 0.008,
      bd1400: 0.004,
      olindex3: 0.065,
      minWavelengthUm: 1.05,
    },
    dataPoints: [
      [1.0, 0.19],
      [1.05, 0.165], // Broad 1.05 µm Fe2+ olivine absorption
      [1.15, 0.18],
      [1.25, 0.22],
      [1.4, 0.27],
      [1.5, 0.29],
      [1.6, 0.31],
      [1.7, 0.32],
      [1.8, 0.33],
      [1.9, 0.335],
      [2.0, 0.34],
      [2.1, 0.345],
      [2.2, 0.348],
      [2.3, 0.35],
      [2.4, 0.35],
      [2.5, 0.345],
      [2.6, 0.34],
    ],
  },
};

export default function CrismSpectralPanel({
  onRecordObservation,
}: {
  onRecordObservation?: (obs: Observation) => void;
}) {
  const { mission, updateMission } = useMission();
  const [selectedKey, setSelectedKey] = useState<string>("jezero_delta_smectite");
  const [showLimitations, setShowLimitations] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const activeProfile = CRISM_SPECTRA[selectedKey] ?? CRISM_SPECTRA.jezero_delta_smectite;

  // SVG Chart Dimensions
  const svgWidth = 600;
  const svgHeight = 220;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;

  const minWave = 1.0;
  const maxWave = 2.6;
  const minRefl = 0.14;
  const maxRefl = 0.44;

  function toSvgX(wave: number) {
    return padLeft + ((wave - minWave) / (maxWave - minWave)) * (svgWidth - padLeft - padRight);
  }

  function toSvgY(refl: number) {
    return (
      svgHeight -
      padBottom -
      ((refl - minRefl) / (maxRefl - minRefl)) * (svgHeight - padTop - padBottom)
    );
  }

  const polylinePoints = activeProfile.dataPoints
    .map(([w, r]) => `${toSvgX(w).toFixed(1)},${toSvgY(r).toFixed(1)}`)
    .join(" ");

  function handleLogSpectralObservation() {
    const newObs: Observation = {
      id: createId("obs"),
      name: `CRISM reference · ${activeProfile.name}`,
      datasetId: CRISM_REFERENCE_DATASET_ID,
      coordinates: { ...activeProfile.coordinates },
      observationDate: new Date().toISOString().slice(0, 10),
      source: CRISM_REFERENCE_SOURCE,
      provenance: {
        source: CRISM_REFERENCE_SOURCE,
        sourceId: activeProfile.id,
        sourceUrl: CRISM_MTRDR_ARCHIVE_URL,
        processingMethod: CRISM_REFERENCE_METHOD,
        limitations: [CRISM_REFERENCE_LIMITATION],
      },
      description: `Bundled reference profile ${activeProfile.id}. Referenced observation ID ${activeProfile.referencedObservationId}.`,
    };

    if (onRecordObservation) {
      onRecordObservation(newObs);
    } else {
      updateMission({
        selectedObservations: [...toMutable(mission.selectedObservations), newObs],
      });
    }

    setSaveSuccess(true);
    window.setTimeout(() => setSaveSuccess(false), 3000);
  }

  return (
    <section
      className="rounded-lg border border-mx-border bg-mx-surface/80 p-5 backdrop-blur"
      aria-label="CRISM VNIR Reference Inspector"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-mx-border pb-4">
        <div>
          <span className="mx-eyebrow text-emerald-400">
            CRISM VNIR REFERENCE INSPECTOR
          </span>
          <h3 className="mx-display m-0 mt-1 text-lg sm:text-xl text-mx-text">
            Jezero Crater Reference Profiles
          </h3>
          <p className="m-0 mt-1 text-xs text-mx-muted">
            {CRISM_REFERENCE_LIMITATION}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {Object.keys(CRISM_SPECTRA).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKey(key)}
              className={`mx-btn mx-btn--xs ${
                selectedKey === key
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300 font-semibold"
                  : "mx-btn--secondary"
              }`}
            >
              {key === "jezero_delta_smectite"
                ? "Delta Smectite Clay"
                : key === "jezero_marginal_carbonate"
                ? "Marginal Carbonate"
                : "Séítah Olivine"}
            </button>
          ))}
        </div>
      </div>

      {mission.temporal.mode !== "present" && <p className="mt-3 rounded border border-amber-500/30 bg-amber-950/15 p-3 text-xs text-amber-200" role="status">
        {mission.temporal.mode === "past"
          ? `No date-matched CRISM spectrum is available for ${mission.temporal.selectedDate}. Illustrative curves are hidden because measured cube arrays and acquisition timestamps are not loaded.`
          : "Future CRISM spectra are unavailable; no forecast is generated and no illustrative curve is shown."}
      </p>}

      {/* Target Profile Metadata Banner */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4 rounded border border-mx-border bg-mx-bg p-3.5 text-xs">
        <div>
          <span className="text-mx-dim block text-[10px] uppercase font-mono">Reference Unit</span>
          <span className="font-semibold text-mx-text">{activeProfile.geologicUnit}</span>
        </div>
        <div>
          <span className="text-mx-dim block text-[10px] uppercase font-mono">Profile Annotation</span>
          <span className="font-semibold text-emerald-300">{activeProfile.mineralogy}</span>
        </div>
        <div>
          <span className="text-mx-dim block text-[10px] uppercase font-mono">Reference Coordinates</span>
          <span className="font-mono text-mx-text">
            {formatCoordinates(activeProfile.coordinates.latitude, activeProfile.coordinates.longitude)}
          </span>
        </div>
        <div>
          <span className="text-mx-dim block text-[10px] uppercase font-mono">Referenced Observation ID</span>
          <span className="font-mono">{activeProfile.referencedObservationId}</span>
          <span className="mt-1 block break-all font-mono text-[11px] text-mx-muted">
            {activeProfile.archiveProduct
              ? `Archive product ${activeProfile.archiveProduct}`
              : "Archive product unconfirmed"}
          </span>
          <a className="mt-1 inline-flex items-center gap-1 text-mx-accent underline" href={CRISM_MTRDR_ARCHIVE_URL} target="_blank" rel="noreferrer">
            NASA PDS MTRDR archive <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Interactive SVG Spectral Plot */}
      {mission.temporal.mode === "present" ? <div className="mt-4 rounded border border-mx-border bg-[#0d0c0e] p-3">
        <div className="mb-2 flex items-center justify-between text-[11px]">
          <span className="text-mx-muted font-mono">
            VNIR Relative Reflectance (I/F) vs. Wavelength (µm)
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-400 font-mono">
              <span className="inline-block h-2 w-3 rounded-sm bg-emerald-400" />
              Bundled reference profile
            </span>
            <span className="text-amber-400 font-mono">▼ Reference band marker</span>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto max-h-56 select-none"
        >
          {/* Grid lines */}
          {[1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4].map((wave) => (
            <line
              key={wave}
              x1={toSvgX(wave)}
              y1={padTop}
              x2={toSvgX(wave)}
              y2={svgHeight - padBottom}
              stroke="#27272a"
              strokeDasharray="2,2"
            />
          ))}
          {[0.2, 0.3, 0.4].map((refl) => (
            <line
              key={refl}
              x1={padLeft}
              y1={toSvgY(refl)}
              x2={svgWidth - padRight}
              y2={toSvgY(refl)}
              stroke="#27272a"
              strokeDasharray="2,2"
            />
          ))}

          {/* Axes */}
          <line
            x1={padLeft}
            y1={svgHeight - padBottom}
            x2={svgWidth - padRight}
            y2={svgHeight - padBottom}
            stroke="#52525b"
            strokeWidth="1.5"
          />
          <line
            x1={padLeft}
            y1={padTop}
            x2={padLeft}
            y2={svgHeight - padBottom}
            stroke="#52525b"
            strokeWidth="1.5"
          />

          {/* Axis Labels */}
          {[1.0, 1.4, 1.8, 2.2, 2.6].map((wave) => (
            <text
              key={wave}
              x={toSvgX(wave)}
              y={svgHeight - 12}
              fill="#a1a1aa"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="middle"
            >
              {wave.toFixed(1)} µm
            </text>
          ))}
          {[0.2, 0.3, 0.4].map((refl) => (
            <text
              key={refl}
              x={padLeft - 6}
              y={toSvgY(refl) + 3}
              fill="#a1a1aa"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="end"
            >
              {refl.toFixed(1)}
            </text>
          ))}

          {/* Diagnostic Band Highlights */}
          {selectedKey === "jezero_delta_smectite" && (
            <>
              {/* 1.9 µm H2O */}
              <line
                x1={toSvgX(1.93)}
                y1={padTop}
                x2={toSvgX(1.93)}
                y2={toSvgY(0.32)}
                stroke="#38bdf8"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <text
                x={toSvgX(1.93)}
                y={padTop + 12}
                fill="#38bdf8"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
              >
                1.9 µm (H₂O)
              </text>

              {/* 2.296 µm Fe/Mg Smectite */}
              <line
                x1={toSvgX(2.296)}
                y1={padTop}
                x2={toSvgX(2.296)}
                y2={toSvgY(0.345)}
                stroke="#34d399"
                strokeWidth="1.5"
                strokeDasharray="3,3"
              />
              <text
                x={toSvgX(2.296)}
                y={padTop + 24}
                fill="#34d399"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
              >
                2.296 µm (Smectite)
              </text>
            </>
          )}

          {selectedKey === "jezero_marginal_carbonate" && (
            <>
              {/* 2.30 µm CO3 */}
              <line
                x1={toSvgX(2.302)}
                y1={padTop}
                x2={toSvgX(2.302)}
                y2={toSvgY(0.338)}
                stroke="#ec4899"
                strokeWidth="1.5"
                strokeDasharray="3,3"
              />
              <text
                x={toSvgX(2.302)}
                y={padTop + 14}
                fill="#ec4899"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
              >
                2.30 µm (Mg-CO₃)
              </text>

              {/* 2.51 µm CO3 */}
              <line
                x1={toSvgX(2.512)}
                y1={padTop}
                x2={toSvgX(2.512)}
                y2={toSvgY(0.325)}
                stroke="#ec4899"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <text
                x={toSvgX(2.512)}
                y={padTop + 26}
                fill="#ec4899"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
              >
                2.51 µm (CO₃)
              </text>
            </>
          )}

          {selectedKey === "jezero_seitah_olivine" && (
            <>
              <line
                x1={toSvgX(1.05)}
                y1={padTop}
                x2={toSvgX(1.05)}
                y2={toSvgY(0.165)}
                stroke="#fbbf24"
                strokeWidth="1.5"
                strokeDasharray="3,3"
              />
              <text
                x={toSvgX(1.05) + 30}
                y={padTop + 14}
                fill="#fbbf24"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
              >
                1.05 µm (Fe²⁺ Olivine)
              </text>
            </>
          )}

          {/* Main Curve */}
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePoints}
          />

          {/* Data Points */}
          {activeProfile.dataPoints.map(([w, r], idx) => (
            <circle
              key={idx}
              cx={toSvgX(w)}
              cy={toSvgY(r)}
              r="3.5"
              fill="#10b981"
              stroke="#0d0c0e"
              strokeWidth="1.5"
            />
          ))}
        </svg>
      </div> : <div className="mt-4 rounded border border-dashed border-mx-border p-8 text-center text-sm text-mx-muted" role="status">No measured CRISM spectrum is loaded for this temporal selection.</div>}

      {/* Band Parameters & Action Grid */}
      {mission.temporal.mode === "present" ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="rounded border border-mx-border bg-mx-bg px-2.5 py-1">
            <span className="text-mx-dim font-mono text-[10px]">D2300 (Clay Depth): </span>
            <strong className="text-emerald-300 font-mono">
              {activeProfile.parameters.d2300.toFixed(3)}
            </strong>
          </div>
          <div className="rounded border border-mx-border bg-mx-bg px-2.5 py-1">
            <span className="text-mx-dim font-mono text-[10px]">BD1900 (Hydration): </span>
            <strong className="text-sky-300 font-mono">
              {activeProfile.parameters.bd1900.toFixed(3)}
            </strong>
          </div>
          <div className="rounded border border-mx-border bg-mx-bg px-2.5 py-1">
            <span className="text-mx-dim font-mono text-[10px]">OLINDEX3 (Olivine): </span>
            <strong className="text-amber-300 font-mono">
              {activeProfile.parameters.olindex3.toFixed(3)}
            </strong>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogSpectralObservation}
          className="mx-btn mx-btn--primary mx-btn--sm"
        >
          {saveSuccess ? (
            <>
              <Check size={14} className="text-emerald-300" />
              Logged to Mission State
            </>
          ) : (
            <>
              <Plus size={14} />
              Record Reference Profile
            </>
          )}
        </button>
      </div> : <p className="mt-4 mb-0 text-xs text-mx-muted">Illustrative band indices and reference profiles are unavailable outside Present mode.</p>}

      {/* Accordion for Evidentiary Limitations */}
      <div className="mt-4 border-t border-mx-border pt-3">
        <button
          type="button"
          onClick={() => setShowLimitations(!showLimitations)}
          className="flex w-full items-center justify-between text-xs text-mx-muted hover:text-mx-text"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <AlertTriangle size={13} className="text-amber-400" />
            Planetary Science Provenance &amp; Limitations Notice
          </span>
          {showLimitations ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showLimitations && (
          <div className="mt-2.5 rounded border border-amber-500/30 bg-amber-950/20 p-3 text-[11px] text-amber-200/90 leading-relaxed">
            <p className="m-0 font-medium text-amber-300">
              Interpreting the reference profiles
            </p>
            <ul className="m-0 mt-1.5 list-disc pl-4 space-y-1">
              <li>
                {CRISM_REFERENCE_METHOD}
              </li>
              <li>
                The profile annotations describe spectral features for reference. Identifying minerals at these locations requires traceable measurements.
              </li>
              <li>
                A traceable orbital spectrum can constrain mineralogy. Interpreting how a deposit formed also requires geologic context.
              </li>
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FlaskConical,
  Home,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wind,
  X,
} from "lucide-react";
import { formatCoordinates } from "../../components/ui";
import {
  JEZERO_DEFAULT_COORDINATES,
  isWithinJezeroDemBounds,
} from "../mars-explorer/marsExplorer.types";
import { useMission } from "../../state/mission/MissionContext";
import type {
  FieldNote,
  Observation,
  SimulatedSample,
} from "../../types";
import MissionLayout from "./MissionLayout";
import { toMutable } from "./missionHelpers";

const FREE_EXPLORATION_SITES = [
  {
    id: "octavia-e-butler",
    name: "Octavia E. Butler Landing (Habitat Base)",
    latitude: 18.4447,
    longitude: 77.4508,
    note: "Perseverance landing site and simulated EVA Habitat & Rover Base.",
  },
  {
    id: "jezero-delta-front",
    name: "Western Delta Scarp & Layered Sediments",
    latitude: 18.4585,
    longitude: 77.4052,
    note: "Exposed deltaic mudstones and boulder conglomerates (~40 m relief).",
  },
  {
    id: "seitah-outcrop",
    name: "Séítah Olivine-Rich Unit",
    latitude: 18.4295,
    longitude: 77.439,
    note: "Fractured igneous/altered crater floor unit with regolith dunes.",
  },
  {
    id: "belva-crater",
    name: "Belva Impact Crater Rim",
    latitude: 18.464,
    longitude: 77.429,
    note: "Fresh impact crater exposing subsurface delta stratigraphy.",
  },
];

type ContingencyPreset = {
  id: string;
  label: string;
  severity: "nominal" | "warning" | "critical";
  summary: string;
  recommendedAction: string;
  suitPatch: {
    co2ScrubberPercent: number;
    commsStatus: "Nominal" | "Degraded" | "Relay Only";
    dustExposureIndex: number;
  };
  envPatch: {
    dustOpticalDepthTau: number;
    visibilityKm: number;
    windSpeedMetersPerSec: number;
    contingencyActive: string | null;
  };
  iframeMode: "nominal" | "dust-squall";
};

const CONTINGENCY_PRESETS: ContingencyPreset[] = [
  {
    id: "nominal",
    label: "Nominal EVA Conditions",
    severity: "nominal",
    summary:
      "Clear Jezero atmosphere (τ = 0.45), nominal PLSS O₂/CO₂ scrubbing, and direct UHF link to Habitat & Mars Reconnaissance Orbiter.",
    recommendedAction: "Proceed with surface traverse and target sampling.",
    suitPatch: {
      co2ScrubberPercent: 96,
      commsStatus: "Nominal",
      dustExposureIndex: 12,
    },
    envPatch: {
      dustOpticalDepthTau: 0.45,
      visibilityKm: 18.5,
      windSpeedMetersPerSec: 6.4,
      contingencyActive: null,
    },
    iframeMode: "nominal",
  },
  {
    id: "dust-squall",
    label: "Regional Dust Squall (Reduced Visibility)",
    severity: "warning",
    summary:
      "Convective dust front increases atmospheric optical depth to τ = 1.85, reducing surface visibility and increasing suit seal dust load.",
    recommendedAction:
      "Maintain visual lock on 3D Target Beacons and Habitat Base beacon; limit traverse distance from base.",
    suitPatch: {
      co2ScrubberPercent: 94,
      commsStatus: "Nominal",
      dustExposureIndex: 58,
    },
    envPatch: {
      dustOpticalDepthTau: 1.85,
      visibilityKm: 3.2,
      windSpeedMetersPerSec: 19.5,
      contingencyActive: "Regional Dust Squall (τ = 1.85)",
    },
    iframeMode: "dust-squall",
  },
  {
    id: "co2-load",
    label: "Elevated Metabolic CO₂ Scrubber Load",
    severity: "warning",
    summary:
      "Sustained uphill traverse on >10° slope increases astronaut metabolic workload and LiOH/amine scrubber saturation.",
    recommendedAction:
      "Reduce pace on steep slopes, pause for in-situ logging, or switch to secondary scrubber bed before returning to Habitat.",
    suitPatch: {
      co2ScrubberPercent: 72,
      commsStatus: "Nominal",
      dustExposureIndex: 24,
    },
    envPatch: {
      dustOpticalDepthTau: 0.55,
      visibilityKm: 16.0,
      windSpeedMetersPerSec: 8.2,
      contingencyActive: "Elevated CO₂ Scrubber Load",
    },
    iframeMode: "nominal",
  },
  {
    id: "comms-handover",
    label: "Orbital Relay Handover (Comms Relay Only)",
    severity: "warning",
    summary:
      "Orbiter passes below local crater rim horizon; telemetry routes via local Habitat surface antenna only.",
    recommendedAction:
      "Avoid deep crater-wall shadow zones; store high-volume observation notes locally until relay reacquisition.",
    suitPatch: {
      co2ScrubberPercent: 95,
      commsStatus: "Relay Only",
      dustExposureIndex: 18,
    },
    envPatch: {
      dustOpticalDepthTau: 0.48,
      visibilityKm: 18.0,
      windSpeedMetersPerSec: 7.0,
      contingencyActive: "Orbital Relay Handover (Line-of-Sight Only)",
    },
    iframeMode: "nominal",
  },
];

export default function MarswalkPage() {
  const navigate = useNavigate();
  const {
    mission,
    updateMission,
    updateSimulation,
  } = useMission();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [simulatorError, setSimulatorError] = useState<string | null>(null);
  const [liveSlopeDeg, setLiveSlopeDeg] = useState<number>(1.8);
  const [liveElevationM, setLiveElevationM] = useState<number>(-2546);

  // Active modals / drawers
  const [showSuitCheckModal, setShowSuitCheckModal] = useState(false);
  const [showFieldworkDrawer, setShowFieldworkDrawer] = useState(false);
  const [showContingencyDrawer, setShowContingencyDrawer] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  // Fieldwork form state
  const [activeFieldworkTab, setActiveFieldworkTab] = useState<
    "target" | "observation" | "sample"
  >("target");
  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    mission.scientificTargets[0]?.id ?? ""
  );
  const [fieldNoteText, setFieldNoteText] = useState("");
  const [obsTitle, setObsTitle] = useState("");
  const [obsCategory, setObsCategory] = useState("Stratigraphy & Outcrop");
  const [obsDescription, setObsDescription] = useState("");
  const [sampleName, setSampleName] = useState("");
  const [sampleType, setSampleType] =
    useState<SimulatedSample["sampleType"]>("Rock Core");
  const [sampleContext, setSampleContext] = useState("");
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const explorationMode = mission.simulation.mode ?? "mission";
  const suit = mission.simulation.suit ?? {
    oxygenPercent: 98,
    suitPressureKpa: 29.6,
    co2ScrubberPercent: 96,
    suitTemperatureCelsius: 21.4,
    ventilationNominal: true,
    hydrationPercent: 95,
    batteryPercent: 96,
    commsStatus: "Nominal" as const,
    dustExposureIndex: 12,
    readinessVerified: false,
  };
  const env = mission.simulation.environment ?? {
    surfaceTempCelsius: -58,
    atmosphericPressurePa: 735,
    dustOpticalDepthTau: 0.45,
    visibilityKm: 18.5,
    radiationDoseRateMicroSvPerHour: 21.2,
    windSpeedMetersPerSec: 6.4,
    contingencyActive: null,
  };

  const selectedRoute = useMemo(
    () =>
      mission.candidateRoutes.find((r) => r.id === mission.selectedRouteId) ??
      mission.candidateRoutes[0] ??
      null,
    [mission.candidateRoutes, mission.selectedRouteId]
  );

  const baseCoordinates = useMemo(() => {
    if (
      mission.configuration?.startingLocation &&
      isWithinJezeroDemBounds(mission.configuration.startingLocation)
    ) {
      return mission.configuration.startingLocation;
    }
    if (
      mission.region?.coordinates &&
      isWithinJezeroDemBounds(mission.region.coordinates)
    ) {
      return mission.region.coordinates;
    }
    return JEZERO_DEFAULT_COORDINATES;
  }, [mission.configuration?.startingLocation, mission.region?.coordinates]);

  const withinJezeroDem = useMemo(() => {
    if (!mission.region) return true;
    return (
      mission.region.id === "jezero-crater" ||
      isWithinJezeroDemBounds(mission.region.coordinates)
    );
  }, [mission.region]);

  const targetName =
    explorationMode === "free"
      ? "Jezero Crater Open-World Surface"
      : mission.region?.name ?? "Jezero Crater";

  const simulatorSrc = useMemo(() => {
    const params = new URLSearchParams({
      lat: baseCoordinates.latitude.toFixed(5),
      lon: baseCoordinates.longitude.toFixed(5),
      name: targetName,
      regionId: mission.region?.id ?? "jezero-crater",
      withinDem: withinJezeroDem ? "1" : "0",
    });
    return `/src/simulator/jezero_crater/scripts/jezero-simulator.html?${params.toString()}`;
  }, [
    baseCoordinates.latitude,
    baseCoordinates.longitude,
    mission.region?.id,
    targetName,
    withinJezeroDem,
  ]);

  const syncTargetsToIframe = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const beaconList = [
      ...mission.scientificTargets.map((t) => ({
        id: t.id,
        name: t.name,
        latitude: t.coordinates.latitude,
        longitude: t.coordinates.longitude,
        kind: "target",
      })),
      ...(selectedRoute?.waypoints.map((wp, index) => ({
        id: wp.id,
        name: wp.name ?? `Waypoint ${index + 1}`,
        latitude: wp.coordinates.latitude,
        longitude: wp.coordinates.longitude,
        kind: "waypoint",
      })) ?? []),
    ];
    win.postMessage(
      {
        type: "mars-explorer:expedition",
        name: targetName,
        regionId: mission.region?.id ?? "jezero-crater",
        latitude: baseCoordinates.latitude,
        longitude: baseCoordinates.longitude,
        withinDem: withinJezeroDem,
        targets: beaconList,
      },
      "*"
    );
  };

  useEffect(() => {
    setInitializing(true);
    const timer = window.setTimeout(() => setInitializing(false), 1800);

    function handleMessage(event: MessageEvent) {
      if (!event.data || typeof event.data !== "object") return;
      const msg = event.data as Record<string, unknown>;

      if (msg.type === "jezero-simulation-ready") {
        setInitializing(false);
        setSimulatorError(null);
        syncTargetsToIframe();
      } else if (msg.type === "jezero-simulation-error") {
        setInitializing(false);
        setSimulatorError(
          typeof msg.message === "string"
            ? msg.message
            : "Jezero Crater 3D terrain data is unavailable."
        );
      } else if (msg.type === "marswalk:telemetry-sync") {
        if (typeof msg.slopeDeg === "number") {
          setLiveSlopeDeg(msg.slopeDeg);
        }
        if (typeof msg.elevation === "number") {
          setLiveElevationM(msg.elevation);
        }
      } else if (msg.type === "marswalk:open-fieldwork") {
        if (typeof msg.targetId === "string" && msg.targetId) {
          setSelectedTargetId(msg.targetId);
        }
        setShowFieldworkDrawer(true);
      } else if (msg.type === "marswalk:return-to-base") {
        updateSimulation({
          returnedToBase: true,
          completedAt: new Date().toISOString(),
        });
        setShowReturnModal(true);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", handleMessage);
    };
  }, [simulatorSrc, mission.scientificTargets, selectedRoute]);

  useEffect(() => {
    syncTargetsToIframe();
  }, [mission.scientificTargets, selectedRoute]);

  const showTransientFeedback = (text: string) => {
    setFeedbackBanner(text);
    window.setTimeout(() => {
      setFeedbackBanner((curr) => (curr === text ? null : curr));
    }, 4000);
  };

  const handleTeleportTo = (
    latitude: number,
    longitude: number,
    label: string
  ) => {
    const win = iframeRef.current?.contentWindow;
    if (win) {
      win.postMessage(
        {
          type: "mars-explorer:expedition",
          name: label,
          regionId: "jezero-crater",
          latitude,
          longitude,
          withinDem: true,
          targets: mission.scientificTargets.map((t) => ({
            id: t.id,
            name: t.name,
            latitude: t.coordinates.latitude,
            longitude: t.coordinates.longitude,
            kind: "target",
          })),
        },
        "*"
      );
    }
    updateSimulation({
      currentPosition: { latitude, longitude },
      isActive: true,
    });
    showTransientFeedback(
      `Translated astronaut position to ${label} (${formatCoordinates(latitude, longitude)})`
    );
  };

  const handleVerifySuitReadiness = () => {
    updateSimulation({
      isActive: true,
      suit: {
        ...suit,
        readinessVerified: true,
      },
    });
    setShowSuitCheckModal(false);
    showTransientFeedback(
      "Pre-EVA Spacesuit & Life-Support Readiness verified. Surface exploration active."
    );
  };

  const handleMarkTargetVisitedAndLogNote = () => {
    const target = mission.scientificTargets.find(
      (t) => t.id === selectedTargetId
    );
    const coords =
      target?.coordinates ??
      mission.simulation.currentPosition ??
      baseCoordinates;

    if (target) {
      const nextVisited = mission.simulation.visitedTargetIds.includes(
        target.id
      )
        ? [...mission.simulation.visitedTargetIds]
        : [...mission.simulation.visitedTargetIds, target.id];
      const pct = Math.min(
        100,
        Math.round(
          (nextVisited.length /
            Math.max(1, mission.scientificTargets.length)) *
            100
        )
      );
      updateSimulation({
        visitedTargetIds: nextVisited,
        progressPercentage: pct,
        isActive: true,
      });
    }

    if (fieldNoteText.trim()) {
      const note: FieldNote = {
        id: `note-eva-${Date.now()}`,
        missionId: mission.id,
        content: fieldNoteText.trim(),
        coordinates: { ...coords },
        relatedTargetId: target?.id,
        createdAt: new Date().toISOString(),
      };
      updateMission({
        fieldNotes: [...toMutable(mission.fieldNotes), note],
      });
      setFieldNoteText("");
    }

    showTransientFeedback(
      target
        ? `Target "${target.name}" marked visited${fieldNoteText.trim() ? " and field note saved" : ""}.`
        : "Surface field note saved to mission log."
    );
  };

  const handleSaveObservation = () => {
    if (!obsTitle.trim()) return;
    const coords =
      mission.simulation.currentPosition ?? baseCoordinates;
    const obs: Observation = {
      id: `obs-eva-${Date.now()}`,
      datasetId:
        mission.selectedDatasets[0]?.id ?? "hirise_jezero_dtm",
      name: `${obsTitle.trim()} (${obsCategory})`,
      coordinates: { ...coords },
      observationDate: new Date().toISOString().slice(0, 10),
      description:
        obsDescription.trim() ||
        `In-situ Marswalk EVA surface observation recorded at ${formatCoordinates(coords.latitude, coords.longitude)} (Elev ${liveElevationM.toFixed(0)} m, Slope ${liveSlopeDeg.toFixed(1)}°).`,
      source: "Marswalk In-Situ EVA Observation (User Recorded)",
      provenance: {
        source: "Simulated Astronaut EVA Fieldwork (CTX / HiRISE Reference DEM)",
        sourceId: "marswalk-eva",
        processingMethod: "Visual and instrument inspection during surface traverse",
        limitations: [
          "Simulated EVA surface observation; requires real rover/orbital verification for physical sample properties.",
        ],
      },
    };
    updateMission({
      selectedObservations: [...toMutable(mission.selectedObservations), obs],
    });
    setObsTitle("");
    setObsDescription("");
    showTransientFeedback(
      `Surface observation "${obs.name}" recorded to Mission Evidence.`
    );
  };

  const handleCollectSample = () => {
    if (!sampleName.trim()) return;
    const coords =
      mission.simulation.currentPosition ?? baseCoordinates;
    const sample: SimulatedSample = {
      id: `sample-eva-${Date.now()}`,
      name: sampleName.trim(),
      sampleType,
      coordinates: { ...coords },
      targetId: selectedTargetId || undefined,
      geologicalContext:
        sampleContext.trim() ||
        `Collected during simulated EVA at ${formatCoordinates(coords.latitude, coords.longitude)} (Slope ${liveSlopeDeg.toFixed(1)}°).`,
      collectedAt: new Date().toISOString(),
      isSimulated: true,
    };
    const existing = toMutable(mission.simulation.simulatedSamples ?? []);
    updateSimulation({
      isActive: true,
      simulatedSamples: [...existing, sample],
    });
    setSampleName("");
    setSampleContext("");
    showTransientFeedback(
      `Simulated ${sample.sampleType} sample "${sample.name}" cached in EVA sample return canister.`
    );
  };

  const handleApplyContingency = (preset: ContingencyPreset) => {
    updateSimulation({
      suit: {
        ...suit,
        ...preset.suitPatch,
      },
      environment: {
        ...env,
        ...preset.envPatch,
      },
    });
    const win = iframeRef.current?.contentWindow;
    if (win) {
      win.postMessage(
        {
          type: "mars-explorer:contingency",
          contingency: preset.iframeMode,
        },
        "*"
      );
    }
    showTransientFeedback(`Applied EVA condition: ${preset.label}`);
  };

  const currentPos = mission.simulation.currentPosition ?? baseCoordinates;
  const visitedCount = mission.simulation.visitedTargetIds.length;
  const totalTargets = mission.scientificTargets.length;
  const collectedSamples = mission.simulation.simulatedSamples ?? [];
  const elapsedMin = Math.floor(mission.simulation.elapsedTimeSeconds / 60);
  const elapsedSec = mission.simulation.elapsedTimeSeconds % 60;

  return (
    <MissionLayout
      stage="Stage 03 · Explore"
      title="Marswalk 3D Surface Simulator"
      subtitle="Traverse the USGS/NASA CTX & HiRISE 3D elevation model of Jezero Crater under Mars partial gravity (3.71 m/s²), monitor astronaut suit telemetry, inspect targets, and log surface observations."
      actions={
        <>
          <Link to="/mission/route" className="mx-btn mx-btn--secondary">
            <ArrowLeft size={15} aria-hidden="true" />
            Route Planner
          </Link>
          <Link to="/mission/review" className="mx-btn mx-btn--primary">
            Proceed to Mission Review
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {simulatorError && (
          <div
            className="mx-alert mx-alert--danger flex flex-wrap items-center justify-between gap-3"
            role="alert"
          >
            <span>{simulatorError}</span>
            <button
              type="button"
              onClick={() => {
                setSimulatorError(null);
                setInitializing(true);
                iframeRef.current?.contentWindow?.location.reload();
              }}
              className="mx-btn mx-btn--secondary mx-btn--sm"
            >
              Retry Terrain Load
            </button>
          </div>
        )}
        {/* Top EVA Command & Telemetry Bar */}
        <div className="mx-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Exploration Mode Switcher */}
            <div
              className="inline-flex rounded-lg border border-mx-border bg-mx-bg/90 p-0.5"
              role="group"
              aria-label="Marswalk exploration mode"
            >
              <button
                type="button"
                onClick={() => updateSimulation({ mode: "mission" })}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  explorationMode === "mission"
                    ? "bg-mx-accent text-[#fffaf7] shadow-sm"
                    : "text-mx-muted hover:text-mx-text"
                }`}
              >
                Mission EVA Mode
              </button>
              <button
                type="button"
                onClick={() => updateSimulation({ mode: "free" })}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  explorationMode === "free"
                    ? "bg-mx-accent text-[#fffaf7] shadow-sm"
                    : "text-mx-muted hover:text-mx-text"
                }`}
              >
                Free Exploration Mode
              </button>
            </div>

            <div className="hidden h-5 w-px bg-mx-border sm:block" />

            {/* Live Astronaut Position & Telemetry Summary */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span
                className="mx-mono text-mx-text"
                title="Current surface coordinates"
              >
                <MapPin size={13} className="mr-1 inline text-mx-accent" />
                {formatCoordinates(currentPos.latitude, currentPos.longitude)}
              </span>
              <span className="mx-mono text-mx-muted">
                Elev{" "}
                <strong className="text-mx-text">
                  {liveElevationM.toFixed(0)} m
                </strong>
              </span>
              <span
                className={`mx-mono ${
                  liveSlopeDeg >= 15
                    ? "font-semibold text-amber-300"
                    : "text-mx-muted"
                }`}
              >
                Slope{" "}
                <strong className="text-mx-text">
                  {liveSlopeDeg.toFixed(1)}°
                </strong>
              </span>
              <span className="mx-mono text-mx-muted">
                Base Dist{" "}
                <strong className="text-mx-text">
                  {Math.round(mission.simulation.distanceFromBaseMeters ?? 0)} m
                </strong>
              </span>
              <span className="mx-mono text-mx-muted">
                EVA{" "}
                <strong className="text-mx-text">
                  {String(elapsedMin).padStart(2, "0")}:
                  {String(elapsedSec).padStart(2, "0")}
                </strong>
              </span>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSuitCheckModal(true)}
              className={`mx-btn mx-btn--sm ${
                suit.readinessVerified
                  ? "mx-btn--secondary border-emerald-500/40 text-emerald-200"
                  : "mx-btn--secondary border-amber-400/50 text-amber-200"
              }`}
            >
              {suit.readinessVerified ? (
                <ShieldCheck size={14} className="text-emerald-400" />
              ) : (
                <ShieldAlert size={14} className="text-amber-400" />
              )}
              Suit Systems ({suit.oxygenPercent.toFixed(0)}% O₂)
            </button>

            <button
              type="button"
              onClick={() => setShowFieldworkDrawer((prev) => !prev)}
              className="mx-btn mx-btn--secondary mx-btn--sm"
            >
              <FlaskConical size={14} className="text-mx-accent" />
              Fieldwork & Samples [E]
              <span className="mx-badge ml-1">
                {mission.selectedObservations.length + collectedSamples.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowContingencyDrawer((prev) => !prev)}
              className={`mx-btn mx-btn--sm ${
                env.contingencyActive
                  ? "border-amber-400/60 bg-amber-500/15 text-amber-200"
                  : "mx-btn--secondary"
              }`}
            >
              <Wind size={14} />
              {env.contingencyActive
                ? "Contingency Active"
                : "Env & Contingencies"}
            </button>

            <button
              type="button"
              onClick={() => {
                updateSimulation({
                  returnedToBase: true,
                  completedAt: new Date().toISOString(),
                });
                setShowReturnModal(true);
              }}
              className="mx-btn mx-btn--primary mx-btn--sm"
            >
              <Home size={14} />
              Return & Debrief [R]
            </button>
          </div>
        </div>

        {/* Suit & Environment Live Micro-Telemetry Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-mx-border bg-[#120e10]/90 px-3.5 py-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="mx-eyebrow mx-eyebrow--accent">
              SIMULATED EVA TELEMETRY
            </span>
            <span className="mx-mono text-mx-muted">
              O₂:{" "}
              <strong className="text-emerald-300">
                {suit.oxygenPercent.toFixed(1)}%
              </strong>
            </span>
            <span className="mx-mono text-mx-muted">
              Suit:{" "}
              <strong className="text-mx-text">
                {suit.suitPressureKpa.toFixed(1)} kPa
              </strong>
            </span>
            <span className="mx-mono text-mx-muted">
              CO₂ Bed:{" "}
              <strong
                className={
                  suit.co2ScrubberPercent < 80
                    ? "text-amber-300"
                    : "text-emerald-300"
                }
              >
                {suit.co2ScrubberPercent.toFixed(0)}%
              </strong>
            </span>
            <span className="mx-mono text-mx-muted">
              Battery:{" "}
              <strong className="text-mx-text">
                {suit.batteryPercent.toFixed(0)}%
              </strong>
            </span>
            <span className="mx-mono text-mx-muted">
              Comms:{" "}
              <strong
                className={
                  suit.commsStatus === "Nominal"
                    ? "text-emerald-300"
                    : "text-amber-300"
                }
              >
                {suit.commsStatus}
              </strong>
            </span>
            <span className="text-mx-border">|</span>
            <span className="mx-mono text-mx-muted">
              Amb Temp:{" "}
              <strong className="text-mx-text">
                {env.surfaceTempCelsius}°C
              </strong>
            </span>
            <span className="mx-mono text-mx-muted">
              Atm:{" "}
              <strong className="text-mx-text">
                {env.atmosphericPressurePa} Pa
              </strong>
            </span>
            <span className="mx-mono text-mx-muted">
              Dust τ:{" "}
              <strong
                className={
                  env.dustOpticalDepthTau > 1.0
                    ? "text-amber-300"
                    : "text-mx-text"
                }
              >
                {env.dustOpticalDepthTau.toFixed(2)}
              </strong>{" "}
              (Vis {env.visibilityKm.toFixed(1)} km)
            </span>
            <span className="mx-mono text-mx-muted">
              Rad:{" "}
              <strong className="text-mx-text">
                {env.radiationDoseRateMicroSvPerHour} µSv/h
              </strong>
            </span>
          </div>

          {/* Waypoint / Site Quick-Jump Bar */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-mx-dim">
              {explorationMode === "free" ? "Jezero Landmarks:" : "Jump to:"}
            </span>
            <button
              type="button"
              onClick={() =>
                handleTeleportTo(
                  baseCoordinates.latitude,
                  baseCoordinates.longitude,
                  "EVA Habitat & Rover Base"
                )
              }
              className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200 hover:bg-emerald-500/20"
            >
              Habitat Base
            </button>

            {explorationMode === "free"
              ? FREE_EXPLORATION_SITES.slice(1).map((site) => (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() =>
                      handleTeleportTo(
                        site.latitude,
                        site.longitude,
                        site.name
                      )
                    }
                    className="rounded border border-mx-border bg-mx-surface px-2 py-0.5 text-[11px] text-mx-muted hover:border-mx-accent hover:text-mx-text"
                  >
                    {site.name.split(" ")[0]} {site.name.split(" ")[1]}
                  </button>
                ))
              : mission.scientificTargets.map((t, idx) => {
                  const isVisited =
                    mission.simulation.visitedTargetIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTargetId(t.id);
                        handleTeleportTo(
                          t.coordinates.latitude,
                          t.coordinates.longitude,
                          t.name
                        );
                      }}
                      className={`rounded border px-2 py-0.5 text-[11px] transition ${
                        isVisited
                          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                          : "border-mx-border bg-mx-surface text-mx-text hover:border-mx-accent"
                      }`}
                    >
                      {isVisited ? "✓ " : `T${idx + 1}: `}
                      {t.name}
                    </button>
                  );
                })}
          </div>
        </div>

        {/* Transient Feedback Notification */}
        {feedbackBanner && (
          <div
            className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-4 py-2 text-xs text-emerald-200"
            role="status"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
              <span>{feedbackBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-emerald-300 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Out-of-bounds Regional Notice when user selected a non-Jezero study region */}
        {!withinJezeroDem && explorationMode === "mission" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-2.5 text-xs text-amber-100">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={15} className="shrink-0 text-amber-400" />
              <span>
                Study region <strong>{mission.region?.name}</strong> is
                preserved in your expedition plan. High-resolution 3D DEM
                surface tiles cover <strong>Jezero Crater</strong> (USGS/NASA
                CTX + HiRISE DTM), so this 3D surface walk is anchored at the
                Jezero landing basin.
              </span>
            </div>
          </div>
        )}

        {/* Main 3D Simulator Viewport + Contextual Side Drawers */}
        <div className="relative h-[calc(100vh-300px)] min-h-[540px] w-full overflow-hidden rounded-xl border border-mx-border bg-[#0c0806] shadow-2xl">
          {initializing && (
            <div
              className="pointer-events-none absolute inset-0 z-[40] flex flex-col items-center justify-center gap-3 bg-[#0c0806]/85 backdrop-blur-sm"
              role="status"
            >
              <Loader2 size={28} className="animate-spin text-mx-accent" />
              <div className="text-center">
                <p className="mx-eyebrow mx-eyebrow--accent m-0">
                  Initializing 3D Mars Surface Engine (g = 3.71 m/s²)
                </p>
                <p className="mx-mono m-0 mt-1 text-xs text-mx-muted">
                  {targetName} ·{" "}
                  {formatCoordinates(
                    baseCoordinates.latitude,
                    baseCoordinates.longitude
                  )}
                </p>
              </div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            key={simulatorSrc}
            title="Marswalk 3D Surface Exploration Simulator"
            src={simulatorSrc}
            onLoad={() => setInitializing(false)}
            className="h-full w-full border-0"
            allow="fullscreen; pointer-lock"
          />

          {/* Mission Objectives Overlay Pill (Bottom-Left of Viewport) */}
          <div className="pointer-events-auto absolute bottom-4 left-4 z-[30] max-w-sm rounded-lg border border-mx-border bg-mx-bg/90 p-3 text-xs backdrop-blur-md">
            <div className="flex items-center justify-between gap-2">
              <span className="mx-eyebrow mx-eyebrow--accent">
                {explorationMode === "free"
                  ? "OPEN-WORLD SURFACE WALK"
                  : "ACTIVE EVA MISSION BRIEF"}
              </span>
              <span className="mx-mono text-[11px] text-emerald-300">
                {visitedCount}/{Math.max(1, totalTargets)} Targets Visited
              </span>
            </div>
            <p className="m-0 mt-1 line-clamp-2 text-[12px] text-mx-text">
              {explorationMode === "free"
                ? "Click inside the 3D viewport to engage pointer-lock look, use WASD to walk across the real Jezero DEM, Space to jump in 0.38g, and press [E] to record discoveries."
                : mission.objective ||
                  mission.question ||
                  "Navigate to your scientific target beacons on the 3D terrain, press [E] to record observations or collect simulated samples, and press [R] at Habitat Base to debrief."}
            </p>
          </div>

          {/* Contextual Drawer: Scientific Fieldwork & Sample Collection [E] */}
          {showFieldworkDrawer && (
            <aside
              className="absolute bottom-3 right-3 top-3 z-[35] flex w-[min(420px,calc(100%-24px))] flex-col overflow-hidden rounded-xl border border-mx-border-strong bg-mx-bg/95 shadow-2xl backdrop-blur-md"
              aria-label="In-Situ Scientific Fieldwork and Sampling"
            >
              <div className="flex items-center justify-between border-b border-mx-border px-4 py-3">
                <div>
                  <span className="mx-eyebrow mx-eyebrow--accent">
                    IN-SITU FIELDWORK STATION [E]
                  </span>
                  <h3 className="mx-heading m-0 text-base">
                    Target Inspection, Observations & Sampling
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFieldworkDrawer(false)}
                  className="text-mx-muted hover:text-mx-text"
                  aria-label="Close fieldwork drawer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Sub-tabs */}
              <div className="grid grid-cols-3 border-b border-mx-border bg-mx-surface/60 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveFieldworkTab("target")}
                  className={`rounded py-1.5 font-medium ${
                    activeFieldworkTab === "target"
                      ? "bg-mx-accent text-white"
                      : "text-mx-muted hover:text-mx-text"
                  }`}
                >
                  Targets & Notes
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFieldworkTab("observation")}
                  className={`rounded py-1.5 font-medium ${
                    activeFieldworkTab === "observation"
                      ? "bg-mx-accent text-white"
                      : "text-mx-muted hover:text-mx-text"
                  }`}
                >
                  Log Observation
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFieldworkTab("sample")}
                  className={`rounded py-1.5 font-medium ${
                    activeFieldworkTab === "sample"
                      ? "bg-mx-accent text-white"
                      : "text-mx-muted hover:text-mx-text"
                  }`}
                >
                  Collect Sample
                </button>
              </div>

              <div className="mx-scroll flex-1 space-y-4 overflow-y-auto p-4 text-xs">
                {activeFieldworkTab === "target" && (
                  <>
                    <div>
                      <label
                        htmlFor="marswalk-target-select"
                        className="mb-1 block font-medium text-mx-text"
                      >
                        Select Scientific Target
                      </label>
                      {mission.scientificTargets.length > 0 ? (
                        <select
                          id="marswalk-target-select"
                          className="mx-input text-xs"
                          value={selectedTargetId}
                          onChange={(e) => setSelectedTargetId(e.target.value)}
                        >
                          {mission.scientificTargets.map((t) => (
                            <option key={t.id} value={t.id}>
                              {mission.simulation.visitedTargetIds.includes(
                                t.id
                              )
                                ? "✓ "
                                : ""}
                              {t.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="rounded border border-mx-border bg-mx-surface p-2.5 text-mx-muted">
                          No formal targets defined yet. You can still log
                          surface field notes at your current coordinates (
                          {formatCoordinates(
                            currentPos.latitude,
                            currentPos.longitude
                          )}
                          ).
                        </p>
                      )}
                    </div>

                    {mission.scientificTargets.find(
                      (t) => t.id === selectedTargetId
                    ) && (
                      <div className="rounded-lg border border-mx-border bg-mx-surface p-3">
                        {(() => {
                          const t = mission.scientificTargets.find(
                            (item) => item.id === selectedTargetId
                          )!;
                          const visited =
                            mission.simulation.visitedTargetIds.includes(t.id);
                          return (
                            <>
                              <div className="flex items-center justify-between gap-2">
                                <strong className="text-sm text-mx-text">
                                  {t.name}
                                </strong>
                                <span
                                  className={`mx-badge ${
                                    visited
                                      ? "border-emerald-500/40 text-emerald-300"
                                      : ""
                                  }`}
                                >
                                  {visited ? "Visited" : "Unvisited"}
                                </span>
                              </div>
                              <p className="mx-mono m-0 mt-1 text-[11px] text-mx-muted">
                                {formatCoordinates(
                                  t.coordinates.latitude,
                                  t.coordinates.longitude
                                )}
                              </p>
                              <p className="m-0 mt-2 text-mx-muted">
                                {t.description}
                              </p>
                              <div className="mt-2.5 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleTeleportTo(
                                      t.coordinates.latitude,
                                      t.coordinates.longitude,
                                      t.name
                                    )
                                  }
                                  className="mx-btn mx-btn--secondary mx-btn--sm"
                                >
                                  <Navigation size={12} />
                                  Move to Target in 3D
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* Linked Orbital Datasets & Open Gaps Context */}
                    <div className="rounded-lg border border-mx-border bg-mx-surface/50 p-3">
                      <span className="mx-eyebrow">
                        ORBITAL EVIDENCE & KNOWLEDGE GAPS AT SITE
                      </span>
                      <p className="m-0 mt-1 text-[11px] text-mx-muted">
                        Active NASA Datasets:{" "}
                        <strong className="text-mx-text">
                          {mission.selectedDatasets.length > 0
                            ? mission.selectedDatasets
                                .map((d) => d.name)
                                .join(", ")
                            : "HiRISE DTM / CTX Base"}
                        </strong>
                      </p>
                      {mission.knowledgeGaps.length > 0 && (
                        <ul className="m-0 mt-2 list-disc space-y-1 pl-4 text-[11px] text-amber-200/90">
                          {mission.knowledgeGaps.slice(0, 2).map((gap) => (
                            <li key={gap.id}>{gap.description}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="marswalk-field-note"
                        className="mb-1 block font-medium text-mx-text"
                      >
                        Astronaut Field Note (Optional)
                      </label>
                      <textarea
                        id="marswalk-field-note"
                        rows={3}
                        className="mx-input text-xs"
                        placeholder="Describe grain size, bedding attitude, fracture coatings, or outcrop accessibility..."
                        value={fieldNoteText}
                        onChange={(e) => setFieldNoteText(e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleMarkTargetVisitedAndLogNote}
                      className="mx-btn mx-btn--primary mx-btn--block"
                    >
                      <Check size={15} />
                      Mark Target Visited & Save Note
                    </button>
                  </>
                )}

                {activeFieldworkTab === "observation" && (
                  <>
                    <div className="rounded-lg border border-mx-border bg-mx-surface/60 p-3">
                      <span className="mx-eyebrow mx-eyebrow--accent">
                        USER-RECORDED EVA OBSERVATION
                      </span>
                      <p className="m-0 mt-1 text-[11px] text-mx-muted">
                        Logged at{" "}
                        <strong className="mx-mono text-mx-text">
                          {formatCoordinates(
                            currentPos.latitude,
                            currentPos.longitude
                          )}
                        </strong>{" "}
                        (Elev {liveElevationM.toFixed(0)} m, Slope{" "}
                        {liveSlopeDeg.toFixed(1)}°). Synced directly to
                        Scientific Investigation & Evidence Inspector.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="marswalk-obs-title"
                        className="mb-1 block font-medium text-mx-text"
                      >
                        Observation Title
                      </label>
                      <input
                        id="marswalk-obs-title"
                        type="text"
                        className="mx-input text-xs"
                        placeholder="e.g., Cross-bedded sandstone exposure on delta scarp"
                        value={obsTitle}
                        onChange={(e) => setObsTitle(e.target.value)}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="marswalk-obs-category"
                        className="mb-1 block font-medium text-mx-text"
                      >
                        Geological / Environmental Category
                      </label>
                      <select
                        id="marswalk-obs-category"
                        className="mx-input text-xs"
                        value={obsCategory}
                        onChange={(e) => setObsCategory(e.target.value)}
                      >
                        <option value="Stratigraphy & Outcrop">
                          Stratigraphy & Outcrop
                        </option>
                        <option value="Mineralogy & Alteration">
                          Mineralogy & Alteration
                        </option>
                        <option value="Geomorphology & Slope Hazard">
                          Geomorphology & Slope Hazard
                        </option>
                        <option value="Regolith & Aeolian Bedform">
                          Regolith & Aeolian Bedform
                        </option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="marswalk-obs-desc"
                        className="mb-1 block font-medium text-mx-text"
                      >
                        Scientific Description & Measurements
                      </label>
                      <textarea
                        id="marswalk-obs-desc"
                        rows={3}
                        className="mx-input text-xs"
                        placeholder="Document contact relationships, lamina thickness, or comparison with orbital HiRISE/CRISM data..."
                        value={obsDescription}
                        onChange={(e) => setObsDescription(e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={!obsTitle.trim()}
                      onClick={handleSaveObservation}
                      className="mx-btn mx-btn--primary mx-btn--block"
                    >
                      <Plus size={15} />
                      Record Observation to Mission State
                    </button>
                  </>
                )}

                {activeFieldworkTab === "sample" && (
                  <>
                    <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
                      <span className="mx-eyebrow text-amber-300">
                        SIMULATED EVA SAMPLE COLLECTION
                      </span>
                      <p className="m-0 mt-1 text-[11px] text-amber-100/80">
                        Samples collected here are explicitly tagged as{" "}
                        <strong>Simulated EVA Samples</strong> to distinguish
                        them from actual NASA Perseverance cached tubes or
                        orbital datasets.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="marswalk-sample-name"
                        className="mb-1 block font-medium text-mx-text"
                      >
                        Sample Tube / Label Name
                      </label>
                      <input
                        id="marswalk-sample-name"
                        type="text"
                        className="mx-input text-xs"
                        placeholder="e.g., JZ-EVA-01 Carbonate-Bearing Mudstone Core"
                        value={sampleName}
                        onChange={(e) => setSampleName(e.target.value)}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="marswalk-sample-type"
                        className="mb-1 block font-medium text-mx-text"
                      >
                        Sample Type
                      </label>
                      <select
                        id="marswalk-sample-type"
                        className="mx-input text-xs"
                        value={sampleType}
                        onChange={(e) =>
                          setSampleType(
                            e.target.value as SimulatedSample["sampleType"]
                          )
                        }
                      >
                        <option value="Rock Core">
                          Rock Core (Rotary Drill)
                        </option>
                        <option value="Regolith">
                          Regolith Scoop (Loose Fines)
                        </option>
                        <option value="Float Rock">
                          Float Rock Grab Sample
                        </option>
                        <option value="Atmospheric Gas">
                          Atmospheric / Headspace Gas
                        </option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="marswalk-sample-context"
                        className="mb-1 block font-medium text-mx-text"
                      >
                        Geological Context & Target Link
                      </label>
                      <textarea
                        id="marswalk-sample-context"
                        rows={2}
                        className="mx-input text-xs"
                        placeholder="Why is this sample prioritized for laboratory return?"
                        value={sampleContext}
                        onChange={(e) => setSampleContext(e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={!sampleName.trim()}
                      onClick={handleCollectSample}
                      className="mx-btn mx-btn--primary mx-btn--block"
                    >
                      <Sparkles size={15} />
                      Cache Simulated Sample
                    </button>

                    {collectedSamples.length > 0 && (
                      <div className="space-y-1.5 border-t border-mx-border pt-3">
                        <span className="mx-eyebrow">
                          CACHED SIMULATED SAMPLES ({collectedSamples.length})
                        </span>
                        {collectedSamples.map((s) => (
                          <div
                            key={s.id}
                            className="rounded border border-mx-border bg-mx-surface px-2.5 py-2"
                          >
                            <div className="flex items-center justify-between">
                              <strong className="text-mx-text">{s.name}</strong>
                              <span className="mx-badge">{s.sampleType}</span>
                            </div>
                            <p className="mx-mono m-0 mt-0.5 text-[10px] text-mx-muted">
                              {formatCoordinates(
                                s.coordinates.latitude,
                                s.coordinates.longitude
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </aside>
          )}

          {/* Contextual Drawer: Environmental & Contingency Simulator */}
          {showContingencyDrawer && (
            <aside
              className="absolute bottom-3 left-3 top-3 z-[35] flex w-[min(400px,calc(100%-24px))] flex-col overflow-hidden rounded-xl border border-mx-border-strong bg-mx-bg/95 shadow-2xl backdrop-blur-md"
              aria-label="EVA Environmental and Contingency Simulator"
            >
              <div className="flex items-center justify-between border-b border-mx-border px-4 py-3">
                <div>
                  <span className="mx-eyebrow mx-eyebrow--accent">
                    ENVIRONMENTAL & SUIT CONTINGENCIES
                  </span>
                  <h3 className="mx-heading m-0 text-base">
                    Mars Surface Conditions Simulator
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowContingencyDrawer(false)}
                  className="text-mx-muted hover:text-mx-text"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mx-scroll flex-1 space-y-3 overflow-y-auto p-4 text-xs">
                <p className="m-0 text-mx-muted">
                  Test how Martian environmental hazards and spacesuit workload
                  affect visibility, telemetry, and astronaut decision-making
                  during surface traverses.
                </p>

                {CONTINGENCY_PRESETS.map((preset) => {
                  const isSelected =
                    (preset.id === "nominal" && !env.contingencyActive) ||
                    env.contingencyActive === preset.envPatch.contingencyActive;
                  return (
                    <div
                      key={preset.id}
                      className={`rounded-lg border p-3 transition ${
                        isSelected
                          ? "border-mx-accent bg-mx-accent/10"
                          : "border-mx-border bg-mx-surface/80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-mx-text">{preset.label}</strong>
                        <span
                          className={`mx-badge ${
                            preset.severity === "nominal"
                              ? "border-emerald-500/40 text-emerald-300"
                              : "border-amber-500/40 text-amber-300"
                          }`}
                        >
                          {preset.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="m-0 mt-1.5 text-[11px] text-mx-muted">
                        {preset.summary}
                      </p>
                      <p className="m-0 mt-1.5 text-[11px] text-mx-text">
                        <strong>Protocol:</strong> {preset.recommendedAction}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleApplyContingency(preset)}
                        className={`mx-btn mx-btn--sm mx-btn--block mt-2.5 ${
                          isSelected ? "mx-btn--primary" : "mx-btn--secondary"
                        }`}
                      >
                        {isSelected
                          ? "Active Condition"
                          : "Simulate This Condition"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </aside>
          )}
        </div>

        {/* Modal: Pre-EVA Astronaut & Spacesuit Readiness Check */}
        {showSuitCheckModal && (
          <div
            className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="suit-check-title"
          >
            <div className="mx-panel w-full max-w-2xl p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-mx-border pb-4">
                <div>
                  <span className="mx-eyebrow mx-eyebrow--accent">
                    PRE-EVA ASTRONAUT & PLSS CHECKLIST (SIMULATED)
                  </span>
                  <h2
                    id="suit-check-title"
                    className="mx-heading m-0 mt-1 text-xl"
                  >
                    Spacesuit Systems & Mission Loadout Verification
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSuitCheckModal(false)}
                  className="text-mx-muted hover:text-mx-text"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                <div className="rounded-lg border border-mx-border bg-mx-surface p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-mx-text">
                      Primary O₂ Supply & Suit Pressure
                    </span>
                    <span className="mx-badge border-emerald-500/40 text-emerald-300">
                      NOMINAL
                    </span>
                  </div>
                  <p className="mx-mono m-0 mt-1 text-sm text-mx-text">
                    {suit.oxygenPercent.toFixed(1)}% O₂ · {suit.suitPressureKpa}{" "}
                    kPa (4.3 psi)
                  </p>
                  <p className="m-0 mt-1 text-[11px] text-mx-muted">
                    Pure oxygen operating pressure balances joint mobility
                    against zero-prebreathe decompression safety.
                  </p>
                </div>

                <div className="rounded-lg border border-mx-border bg-mx-surface p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-mx-text">
                      CO₂ Removal & Ventilation Loop
                    </span>
                    <span
                      className={`mx-badge ${
                        suit.co2ScrubberPercent >= 80
                          ? "border-emerald-500/40 text-emerald-300"
                          : "border-amber-500/40 text-amber-300"
                      }`}
                    >
                      {suit.co2ScrubberPercent >= 80
                        ? "NOMINAL"
                        : "ELEVATED LOAD"}
                    </span>
                  </div>
                  <p className="mx-mono m-0 mt-1 text-sm text-mx-text">
                    Scrubber Capacity: {suit.co2ScrubberPercent.toFixed(0)}% ·
                    Airflow {suit.ventilationNominal ? "4.5 CFM" : "Reduced"}
                  </p>
                  <p className="m-0 mt-1 text-[11px] text-mx-muted">
                    Helmet anti-fog and amine swing-bed CO₂ scrubbing verified
                    for 0.38g surface exertion.
                  </p>
                </div>

                <div className="rounded-lg border border-mx-border bg-mx-surface p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-mx-text">
                      Thermal Control & Hydration
                    </span>
                    <span className="mx-badge border-emerald-500/40 text-emerald-300">
                      NOMINAL
                    </span>
                  </div>
                  <p className="mx-mono m-0 mt-1 text-sm text-mx-text">
                    Internal {suit.suitTemperatureCelsius}°C (Ext{" "}
                    {env.surfaceTempCelsius}°C) · Drink Bag{" "}
                    {suit.hydrationPercent}%
                  </p>
                  <p className="m-0 mt-1 text-[11px] text-mx-muted">
                    Liquid Cooling & Ventilation Garment (LCVG) insulated
                    against thin 735 Pa CO₂ atmosphere.
                  </p>
                </div>

                <div className="rounded-lg border border-mx-border bg-mx-surface p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-mx-text">
                      Battery, Comms & Dust Mitigation
                    </span>
                    <span className="mx-badge border-emerald-500/40 text-emerald-300">
                      {suit.commsStatus.toUpperCase()}
                    </span>
                  </div>
                  <p className="mx-mono m-0 mt-1 text-sm text-mx-text">
                    Power {suit.batteryPercent.toFixed(0)}% · Dust Index{" "}
                    {suit.dustExposureIndex}/100
                  </p>
                  <p className="m-0 mt-1 text-[11px] text-mx-muted">
                    Electrostatic dust-repellent outer layer and UHF Habitat
                    transceiver online.
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-mx-border bg-mx-surface/60 p-3 text-xs">
                <span className="mx-eyebrow">
                  ASSIGNED FIELD EQUIPMENT LOADOUT
                </span>
                <p className="m-0 mt-1 text-mx-text">
                  {mission.configuration?.equipment &&
                  mission.configuration.equipment.length > 0
                    ? mission.configuration.equipment.join(" · ")
                    : "Rotary Core Drill · Handheld XRF/Raman Spectrometer · Sample Return Canisters · Stereo Mast Camera"}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSuitCheckModal(false)}
                  className="mx-btn mx-btn--secondary"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleVerifySuitReadiness}
                  className="mx-btn mx-btn--primary"
                >
                  <ShieldCheck size={16} />
                  Confirm Pre-EVA Suit Readiness
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Return to Habitat & Post-EVA Assessment [R] */}
        {showReturnModal && (
          <div
            className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="return-modal-title"
          >
            <div className="mx-panel w-full max-w-2xl p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-mx-border pb-4">
                <div>
                  <span className="mx-eyebrow mx-eyebrow--accent">
                    POST-EVA AIRLOCK INGRESS & DEBRIEF
                  </span>
                  <h2
                    id="return-modal-title"
                    className="mx-heading m-0 mt-1 text-xl"
                  >
                    Habitat Base Return & Surface EVA Summary
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="text-mx-muted hover:text-mx-text"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div className="rounded-lg border border-mx-border bg-mx-surface p-3">
                  <span className="text-mx-muted">Targets Visited</span>
                  <p className="mx-mono m-0 mt-1 text-lg font-semibold text-emerald-300">
                    {visitedCount} / {Math.max(1, totalTargets)}
                  </p>
                </div>
                <div className="rounded-lg border border-mx-border bg-mx-surface p-3">
                  <span className="text-mx-muted">Observations Logged</span>
                  <p className="mx-mono m-0 mt-1 text-lg font-semibold text-mx-text">
                    {mission.selectedObservations.length}
                  </p>
                </div>
                <div className="rounded-lg border border-mx-border bg-mx-surface p-3">
                  <span className="text-mx-muted">Simulated Samples</span>
                  <p className="mx-mono m-0 mt-1 text-lg font-semibold text-amber-300">
                    {collectedSamples.length}
                  </p>
                </div>
                <div className="rounded-lg border border-mx-border bg-mx-surface p-3">
                  <span className="text-mx-muted">Total Traverse</span>
                  <p className="mx-mono m-0 mt-1 text-lg font-semibold text-mx-text">
                    {Math.round(mission.simulation.totalTraverseMeters ?? 0)} m
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-mx-border bg-mx-surface/70 p-3.5 text-xs">
                <span className="mx-eyebrow">EXPEDITION OBJECTIVE STATUS</span>
                <p className="m-0 mt-1 text-mx-text">
                  <strong>Objective:</strong>{" "}
                  {mission.objective ||
                    mission.question ||
                    "Jezero Crater geological surface reconnaissance."}
                </p>
                <p className="m-0 mt-1.5 text-mx-muted">
                  Airlock dust mitigation cycle complete. Suit O₂ reserve at{" "}
                  <strong>{suit.oxygenPercent.toFixed(1)}%</strong>, battery at{" "}
                  <strong>{suit.batteryPercent.toFixed(0)}%</strong>. All
                  recorded observations, field notes (
                  {mission.fieldNotes.length}), and simulated samples (
                  {collectedSamples.length}) are synchronized with Mission
                  Review.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="mx-btn mx-btn--secondary"
                >
                  Resume Surface Walk
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/mission/review")}
                  className="mx-btn mx-btn--primary"
                >
                  Proceed to Stage 04: Mission Review
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MissionLayout>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Layers,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { ImagePending, formatCoordinates } from "../../components/ui";
import { MAP_LAYERS, type MapLayerId } from "../../data/mapLayers";
import type { SurfaceImageryCatalogItem } from "../../data/evidenceDatasets";
import { perseveranceImageryProvider } from "../../services/providers/perseveranceImageryProvider";
import { getMarsRegionById } from "../../data/regions";
import {
  JEZERO_ENVIRONMENT,
  resolveSimulatorEnvironment,
} from "../../simulator/environments/catalog";
import { isWithinBounds } from "../../simulator/shared/environment";
import HelmetHud, {
  type CompassMarkerItem,
} from "../../simulator/shared/HelmetHud";
import {
  bearingDegrees,
  greatCircleDistanceMeters,
  shortestAngularDelta,
} from "../../simulator/shared/navigation";
import { useMission } from "../../state/mission/MissionContext";
import type {
  Coordinates,
  FieldNote,
  Observation,
  SimulatedSample,
} from "../../types";
import { identifyGeologicUnitAt } from "../../utils/jezeroStratigraphy";
import type { GeologicUnitInfo } from "../../utils/jezeroStratigraphy";
import MissionLayout from "./MissionLayout";
import { toMutable } from "./missionHelpers";

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

function hasValidCoordinates(point: Coordinates | null | undefined): point is Coordinates {
  return Boolean(point && Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90 && Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 360);
}

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
    setRegion,
  } = useMission();

  const resolvedSimulator = useMemo(
    () => resolveSimulatorEnvironment(mission.region?.id),
    [mission.region?.id]
  );
  const isSimulatorAvailable =
    resolvedSimulator.available && resolvedSimulator.environment !== null;
  const activeEnv = resolvedSimulator.environment ?? JEZERO_ENVIRONMENT;

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [surfaceOverlayLayer, setSurfaceOverlayLayer] = useState<MapLayerId | "">("");
  const [surfaceOverlayOpacity, setSurfaceOverlayOpacity] = useState(0.55);
  const [surfaceOverlayStatus, setSurfaceOverlayStatus] = useState("");
  const [simulatorError, setSimulatorError] = useState<string | null>(null);
  const [liveSlopeDeg, setLiveSlopeDeg] = useState<number>(1.8);
  const [liveElevationM, setLiveElevationM] = useState<number>(-2546);
  const [liveHeadingDeg, setLiveHeadingDeg] = useState<number>(315);
  const [liveFlyMode, setLiveFlyMode] = useState<boolean>(false);
  const [liveMapOpen, setLiveMapOpen] = useState<boolean>(false);

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
    if (isSimulatorAvailable && resolvedSimulator.environment) {
      const simEnv = resolvedSimulator.environment;
      if (
        mission.configuration?.startingLocation &&
        isWithinBounds(simEnv.bounds, mission.configuration.startingLocation)
      ) {
        return mission.configuration.startingLocation;
      }
      if (
        mission.region?.coordinates &&
        isWithinBounds(simEnv.bounds, mission.region.coordinates)
      ) {
        return mission.region.coordinates;
      }
      return {
        latitude: simEnv.defaultBase.latitude,
        longitude: simEnv.defaultBase.longitude,
      };
    }
    return (
      mission.configuration?.startingLocation ??
      mission.region?.coordinates ?? { latitude: 18.4447, longitude: 77.4508 }
    );
  }, [
    isSimulatorAvailable,
    resolvedSimulator.environment,
    mission.configuration?.startingLocation,
    mission.region?.coordinates,
  ]);

  const withinEnvironmentDem = useMemo(() => {
    if (!activeEnv || !mission.region) return true;
    return (
      mission.region.id === activeEnv.id ||
      isWithinBounds(activeEnv.bounds, mission.region.coordinates)
    );
  }, [activeEnv, mission.region]);

  const targetName =
    explorationMode === "free"
      ? activeEnv
        ? `${activeEnv.displayName} Open-World Surface`
        : mission.region?.name ?? "Mars Surface"
      : mission.region?.name ?? activeEnv?.displayName ?? "Mars Surface";

  const simulatorSrc = useMemo(() => {
    if (!activeEnv) return "";
    const params = new URLSearchParams({
      lat: baseCoordinates.latitude.toFixed(5),
      lon: baseCoordinates.longitude.toFixed(5),
      name: targetName,
      regionId: mission.region?.id ?? activeEnv.id,
      withinDem: withinEnvironmentDem ? "1" : "0",
    });
    return `${activeEnv.simulatorEntryUrl}?${params.toString()}`;
  }, [
    activeEnv,
    baseCoordinates.latitude,
    baseCoordinates.longitude,
    mission.region?.id,
    targetName,
    withinEnvironmentDem,
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
        regionId: mission.region?.id ?? activeEnv.id,
        latitude: baseCoordinates.latitude,
        longitude: baseCoordinates.longitude,
        withinDem: withinEnvironmentDem,
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
        const nextSlope =
          typeof msg.slopeDegrees === "number"
            ? msg.slopeDegrees
            : typeof msg.slopeDeg === "number"
              ? msg.slopeDeg
              : null;
        if (nextSlope !== null && Number.isFinite(nextSlope)) {
          setLiveSlopeDeg(nextSlope);
        }
        const nextElev =
          typeof msg.elevationMeters === "number"
            ? msg.elevationMeters
            : typeof msg.elevation === "number"
              ? msg.elevation
              : null;
        if (nextElev !== null && Number.isFinite(nextElev)) {
          setLiveElevationM(nextElev);
        }
        if (typeof msg.headingDegrees === "number" && Number.isFinite(msg.headingDegrees)) {
          setLiveHeadingDeg(msg.headingDegrees);
        }
        if (typeof msg.flyMode === "boolean") {
          setLiveFlyMode(msg.flyMode);
        }
        if (typeof msg.mapOpen === "boolean") {
          setLiveMapOpen(msg.mapOpen);
        }
        if (
          typeof msg.latitude === "number" && Number.isFinite(msg.latitude) && msg.latitude >= -90 && msg.latitude <= 90 &&
          typeof msg.longitude === "number" && Number.isFinite(msg.longitude) && msg.longitude >= -180 && msg.longitude <= 360
        ) {
          updateSimulation({
            currentPosition: {
              latitude: msg.latitude,
              longitude: msg.longitude,
            },
            distanceFromBaseMeters:
              typeof msg.distanceFromBaseMeters === "number"
                ? msg.distanceFromBaseMeters
                : mission.simulation.distanceFromBaseMeters,
            totalTraverseMeters:
              typeof msg.totalTraverseMeters === "number"
                ? msg.totalTraverseMeters
                : mission.simulation.totalTraverseMeters,
            elapsedTimeSeconds:
              typeof msg.elapsedTimeSeconds === "number"
                ? msg.elapsedTimeSeconds
                : mission.simulation.elapsedTimeSeconds,
            isActive: true,
          });
        }
      } else if (msg.type === "marswalk:overlay-status") {
        setSurfaceOverlayStatus(typeof msg.message === "string" ? msg.message : "");
      } else if (msg.type === "marswalk:visit-target") {
        if (typeof msg.targetId === "string" && msg.targetId) {
          const nextVisited = mission.simulation.visitedTargetIds.includes(
            msg.targetId
          )
            ? [...mission.simulation.visitedTargetIds]
            : [...mission.simulation.visitedTargetIds, msg.targetId];
          updateSimulation({
            visitedTargetIds: nextVisited,
            isActive: true,
          });
        }
      } else if (msg.type === "marswalk:open-fieldwork" || msg.type === "marswalk:toggle-fieldwork") {
        if (typeof msg.targetId === "string" && msg.targetId) {
          setSelectedTargetId(msg.targetId);
        }
        setShowFieldworkDrawer(true);
      } else if (msg.type === "marswalk:close-modal") {
        setShowFieldworkDrawer(false);
      } else if (msg.type === "marswalk:open-notepad") {
        setActiveFieldworkTab("observation");
        setShowFieldworkDrawer(true);
      } else if (
        msg.type === "marswalk:return-to-base" ||
        msg.type === "marswalk:returned-to-base"
      ) {
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

  const anyModalOpen =
    showFieldworkDrawer ||
    showSuitCheckModal ||
    showContingencyDrawer ||
    showReturnModal;

  useEffect(() => {
    if (initializing) return;
    iframeRef.current?.contentWindow?.postMessage({
      type: "mars-explorer:set-overlay",
      overlayLayer: surfaceOverlayLayer || null,
      opacity: surfaceOverlayOpacity,
    }, "*");
  }, [initializing, surfaceOverlayLayer, surfaceOverlayOpacity]);

  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: "mars-explorer:modal-state",
        open: anyModalOpen,
      },
      "*"
    );
  }, [anyModalOpen]);

  useEffect(() => {
    function handleWindowKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isInput =
        tag === "input" || tag === "textarea" || tag === "select";

      if (e.key === "Escape" && anyModalOpen) {
        e.preventDefault();
        setShowFieldworkDrawer(false);
        setShowSuitCheckModal(false);
        setShowContingencyDrawer(false);
        setShowReturnModal(false);
        return;
      }

      if (!isInput && !e.repeat && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        setShowFieldworkDrawer((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [anyModalOpen]);

  const handleToggleIframeMap = () => {
    setShowFieldworkDrawer(false);
    setShowContingencyDrawer(false);
    setShowSuitCheckModal(false);
    setShowReturnModal(false);
    iframeRef.current?.contentWindow?.postMessage(
      { type: "mars-explorer:toggle-map" },
      "*"
    );
  };

  const handleToggleIframeFlight = () => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "mars-explorer:toggle-flight" },
      "*"
    );
  };

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
    if (!isWithinBounds(activeEnv.bounds, { latitude, longitude })) {
      showTransientFeedback(`${label} is outside the active ${activeEnv.displayName} terrain coverage.`);
      return;
    }
    const win = iframeRef.current?.contentWindow;
    if (win) {
      win.postMessage(
        {
          type: "mars-explorer:teleport",
          latitude,
          longitude,
        },
        "*"
      );
    }
    updateSimulation({ currentPosition: { latitude, longitude }, isActive: true });
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
    if (!hasValidCoordinates(coords)) return;

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

  const currentPos = mission.simulation.currentPosition ?? baseCoordinates;
  const visitedCount = mission.simulation.visitedTargetIds.length;
  const totalTargets = mission.scientificTargets.length;
  const collectedSamples = mission.simulation.simulatedSamples ?? [];
  const planetRadiusMeters = activeEnv.coordinateReference.meanRadiusMeters;

  // Phase 5: Nearest Beacon Proximity (<150 m) & Stratigraphic Context
  const activeTargetObj = useMemo(
    () =>
      mission.scientificTargets.find((t) => t.id === selectedTargetId) ??
      mission.scientificTargets[0] ??
      null,
    [mission.scientificTargets, selectedTargetId]
  );

  const nearestBeacon = useMemo(() => {
    const candidates = [
      ...mission.scientificTargets.map((t) => ({
        id: t.id,
        name: t.name,
        coordinates: t.coordinates,
        isMissionTarget: true,
      })),
      ...activeEnv.fieldSites.map((s: { id: string; name: string; latitude: number; longitude: number }) => ({
        id: s.id,
        name: s.name,
        coordinates: { latitude: s.latitude, longitude: s.longitude },
        isMissionTarget: false,
      })),
    ];

    let best: {
      id: string;
      name: string;
      coordinates: Coordinates;
      distanceMeters: number;
      isMissionTarget: boolean;
    } | null = null;

    for (const c of candidates) {
      const dist = greatCircleDistanceMeters(
        currentPos,
        c.coordinates,
        planetRadiusMeters
      );
      if (!best || dist < best.distanceMeters) {
        best = { ...c, distanceMeters: Math.round(dist) };
      }
    }
    return best;
  }, [
    activeEnv.fieldSites,
    currentPos,
    mission.scientificTargets,
    planetRadiusMeters,
  ]);

  const isApproachingBeacon =
    nearestBeacon !== null && nearestBeacon.distanceMeters < 150;

  const inspectionCoords = useMemo(() => {
    if (isApproachingBeacon && nearestBeacon) {
      return nearestBeacon.coordinates;
    }
    if (activeTargetObj) {
      return activeTargetObj.coordinates;
    }
    return currentPos;
  }, [activeTargetObj, currentPos, isApproachingBeacon, nearestBeacon]);

  const inspectionLabel = useMemo(() => {
    if (isApproachingBeacon && nearestBeacon) {
      return nearestBeacon.name;
    }
    if (activeTargetObj) {
      return activeTargetObj.name;
    }
    return "Current Astronaut Surface Station";
  }, [activeTargetObj, isApproachingBeacon, nearestBeacon]);

  const currentGeologicUnit = useMemo<GeologicUnitInfo>(() => activeEnv.id === "jezero-crater"
    ? identifyGeologicUnitAt(inspectionCoords)
    : {
        unit_code: "Unavailable", unit_name: "Regional geology not loaded",
        stratigraphic_age: "Unavailable", lithology: "No region-specific geology dataset is configured.",
        interpretation: "Do not infer a geological unit from Jezero data.", dominant_minerals: [],
        trafficability: "Unavailable", thermalInertiaJm2Ks05: 0, hasLooseSandHazard: false,
        color: "#94a3b8", stroke_color: "#64748b",
      }, [activeEnv.id, inspectionCoords]);

  // Correlate active target / beacon coordinates with verified Perseverance Sols (Sol 1, 420, 2024, 2031)
  const groundTruthCorrelation = useMemo(() => {
    if (activeEnv.id !== "jezero-crater") return {
      sol: 0, altSol: 0, zoneLabel: "No rover ground-truth available",
      rationale: activeEnv.id === "gale-crater" ? "Curiosity and REMS context is available through the Gale datasets; Perseverance imagery does not apply." : "No rover telemetry is available for this region; use orbital and regional context.",
      orbitalLink: "Region-specific orbital references only.",
    };
    const lowerLabel = inspectionLabel.toLowerCase();
    const unitCode = currentGeologicUnit.unit_code;
    const distFromLanding = greatCircleDistanceMeters(
      inspectionCoords,
      {
        latitude: activeEnv.defaultBase.latitude,
        longitude: activeEnv.defaultBase.longitude,
      },
      planetRadiusMeters
    );

    if (
      lowerLabel.includes("delta") ||
      lowerLabel.includes("scarp") ||
      lowerLabel.includes("kodiak") ||
      lowerLabel.includes("topset") ||
      lowerLabel.includes("mudstone") ||
      lowerLabel.includes("smectite") ||
      lowerLabel.includes("phyllosilicate") ||
      unitCode === "HpHd_scarp" ||
      unitCode === "HpHd_top" ||
      unitCode === "Hcf_m"
    ) {
      return {
        sol: 420,
        altSol: 420,
        zoneLabel: "Western Jezero Delta Scarp & Three Forks Arrival (Sol 420)",
        rationale:
          "Correlated with Perseverance Sol 420 Mastcam-Z & SuperCam RMI telephoto captures of fine-grained delta scarp laminations.",
        orbitalLink:
          "CRISM archive reference FRT00005C5E and HiRISE 25 cm imagery. The bundled smectite reference profile has unverified extraction provenance.",
      };
    }

    if (
      lowerLabel.includes("octavia") ||
      lowerLabel.includes("butler") ||
      lowerLabel.includes("habitat") ||
      lowerLabel.includes("landing") ||
      distFromLanding < 110
    ) {
      return {
        sol: 1,
        altSol: 1,
        zoneLabel: "Octavia E. Butler Landing Base (Sol 1)",
        rationale:
          "Correlated with Perseverance Sol 1 Mastcam-Z & Navcam surface panoramas at the Octavia E. Butler touchdown zone.",
        orbitalLink:
          "THEMIS Nighttime IR & HiRISE DTM (-2,565 m crater floor benchmark).",
      };
    }

    return {
      sol: 2024,
      altSol: 2031,
      zoneLabel:
        "Séítah & Fractured Olivine Cumulate Bedrock (Sol 2024 / Sol 2031)",
      rationale:
        "Correlated with Perseverance Sol 2024 / Sol 2031 Mastcam-Z captures of fractured olivine-rich crater floor bedrock.",
      orbitalLink:
        "Bundled Séítah olivine reference profile. The referenced observation FRT0000B204 and the profile extraction remain unverified.",
    };
  }, [
    activeEnv.id,
    activeEnv.defaultBase.latitude,
    activeEnv.defaultBase.longitude,
    currentGeologicUnit.unit_code,
    inspectionCoords,
    inspectionLabel,
    planetRadiusMeters,
  ]);

  const [groundTruthSolOverride, setGroundTruthSolOverride] = useState<
    number | null
  >(null);
  const activeGroundTruthSol =
    groundTruthSolOverride ?? groundTruthCorrelation.sol;

  const [groundTruthImages, setGroundTruthImages] = useState<
    SurfaceImageryCatalogItem[]
  >([]);
  const [groundTruthIdx, setGroundTruthIdx] = useState(0);
  const [groundTruthImgError, setGroundTruthImgError] = useState(false);
  const [attachRoverImgToObs, setAttachRoverImgToObs] = useState(true);

  useEffect(() => {
    setGroundTruthSolOverride(null);
  }, [groundTruthCorrelation.sol]);

  useEffect(() => {
    let cancelled = false;
    setGroundTruthImgError(false);
    if (activeEnv.id !== "jezero-crater") {
      setGroundTruthImages([]);
      return () => { cancelled = true; };
    }
    perseveranceImageryProvider
      .queryImages({
        sol: activeGroundTruthSol,
        camera: "ALL",
        perPage: 24,
      })
      .then((res) => {
        if (!cancelled) {
          setGroundTruthImages(res.items);
          setGroundTruthIdx(0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGroundTruthImages([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeEnv.id, activeGroundTruthSol]);

  const activeGroundTruthImage =
    groundTruthImages[groundTruthIdx] ?? groundTruthImages[0] ?? null;

  // Phase 5: Equipment-Gated Sample Collection
  const equippedTools = useMemo(() => {
    const raw =
      mission.configuration?.equipmentLoadout ??
      mission.configuration?.equipment;
    if (Array.isArray(raw)) return raw;
    return [
      "Core Drill & Sample Tubes",
      "Field UV/Raman Spectrometer",
      "Stereo Mast / Field Camera",
      "MEDA-Class Env & Radiation Sensor",
    ];
  }, [
    mission.configuration?.equipment,
    mission.configuration?.equipmentLoadout,
  ]);

  const isRotaryDrillEquipped = useMemo(
    () =>
      equippedTools.some(
        (tool) =>
          tool.toLowerCase().includes("drill") ||
          tool.toLowerCase().includes("core")
      ),
    [equippedTools]
  );

  const toggleRotaryDrillInLoadout = () => {
    const nextEquipment = isRotaryDrillEquipped
      ? equippedTools.filter(
          (t) =>
            !t.toLowerCase().includes("drill") &&
            !t.toLowerCase().includes("core")
        )
      : ["Core Drill & Sample Tubes", ...equippedTools];

    updateMission({
      configuration: {
        startingLocation:
          mission.configuration?.startingLocation ?? baseCoordinates,
        scientificTargetIds: toMutable(
          mission.configuration?.scientificTargetIds ??
            mission.scientificTargets.map((t) => t.id)
        ),
        missionDurationSols: mission.configuration?.missionDurationSols ?? 14,
        hypotheticalEVADurationHours:
          mission.configuration?.hypotheticalEVADurationHours ?? 6,
        terrainPreferences: mission.configuration?.terrainPreferences ?? {
          preferredSlopeDegrees: 15,
          preferredRoughness: 0.35,
          avoidKnownObstacles: true,
        },
        sciencePriorities: toMutable(
          mission.configuration?.sciencePriorities ?? [
            "Stratigraphy",
            "Hydrated minerals",
          ]
        ),
        explorationStrategy:
          mission.configuration?.explorationStrategy ??
          "Surface EVA traverse",
        equipment: nextEquipment,
        equipmentLoadout: nextEquipment,
        missionConstraints: mission.configuration?.missionConstraints
          ? toMutable(mission.configuration.missionConstraints)
          : undefined,
        requireReturnToBase: mission.configuration?.requireReturnToBase ?? true,
      },
    });
  };

  const nextTubeSerialId = `${activeEnv.sampleIdPrefix}-${String(
    collectedSamples.length + 1
  ).padStart(2, "0")}`;

  const handleSaveObservation = () => {
    if (!obsTitle.trim()) return;
    const coords =
      mission.simulation.currentPosition ?? baseCoordinates;
    if (!hasValidCoordinates(coords)) return;
    const obs: Observation = {
      id: `obs-eva-${Date.now()}`,
      datasetId:
        mission.selectedDatasets[0]?.id ?? activeEnv.defaultObservationDatasetId,
      name: `${obsTitle.trim()} (${obsCategory})`,
      coordinates: { ...coords },
      observationDate: new Date().toISOString().slice(0, 10),
      regionId: activeEnv.id,
      description:
        obsDescription.trim() ||
        `In-situ Marswalk EVA surface observation recorded at ${formatCoordinates(coords.latitude, coords.longitude)} in ${activeEnv.id === "jezero-crater" ? `USGS unit ${currentGeologicUnit.unit_code}` : "unclassified regional geology"} (Elev ${liveElevationM.toFixed(0)} m, Slope ${liveSlopeDeg.toFixed(1)}°).`,
      source: "Marswalk In-Situ EVA Observation (User Recorded)",
      provenance: {
        source: `Simulated Astronaut EVA Fieldwork (${activeEnv.displayName} Reference DEM)`,
        sourceId: "marswalk-eva",
        processingMethod: `Visual and instrument inspection during surface traverse across ${currentGeologicUnit.unit_code} (${currentGeologicUnit.unit_name})`,
        limitations: [
          "Simulated EVA surface observation; requires real rover/orbital verification for physical sample properties.",
        ],
      },
      surfaceImage:
        attachRoverImgToObs && activeGroundTruthImage
          ? {
              imageId: activeGroundTruthImage.id,
              roverName: activeGroundTruthImage.roverName,
              instrument: activeGroundTruthImage.instrument,
              instrumentLabel: activeGroundTruthImage.instrumentLabel,
              sol: activeGroundTruthImage.sol,
              dateTakenUtc: activeGroundTruthImage.dateTakenUtc,
              dateTakenMars: activeGroundTruthImage.dateTakenMars,
              site: activeGroundTruthImage.site,
              drive: activeGroundTruthImage.drive,
              xyzLocalMeters: activeGroundTruthImage.xyzLocalMeters,
              imageUrl: activeGroundTruthImage.imageUrl,
              thumbnailUrl: activeGroundTruthImage.thumbnailUrl,
              sourceUrl: activeGroundTruthImage.sourceUrl,
              caption: activeGroundTruthImage.caption,
              credit: activeGroundTruthImage.credit,
            }
          : undefined,
    };
    updateMission({
      selectedObservations: [...toMutable(mission.selectedObservations), obs],
    });
    setObsTitle("");
    setObsDescription("");
    showTransientFeedback(
      `Surface observation "${obs.name}" recorded to Mission Evidence${
        obs.surfaceImage ? ` with Sol ${obs.surfaceImage.sol} rover ground-truth image` : ""
      }.`
    );
  };

  const handleCollectSample = () => {
    if (sampleType === "Rock Core" && !isRotaryDrillEquipped) {
      return;
    }
    const coords =
      mission.simulation.currentPosition ?? baseCoordinates;
    if (!hasValidCoordinates(coords)) return;
    const rawName = sampleName.trim();
    const formattedName = rawName
      ? rawName.startsWith(`${activeEnv.sampleIdPrefix}-`)
        ? rawName
        : `${nextTubeSerialId} · ${rawName}`
      : `${nextTubeSerialId} · ${currentGeologicUnit.unit_code} ${sampleType}`;

    const sample: SimulatedSample = {
      id: `sample-eva-${Date.now()}`,
      tubeId: nextTubeSerialId,
      name: formattedName,
      sampleType,
      coordinates: { ...coords },
      targetId: selectedTargetId || undefined,
      geologicUnitCode: currentGeologicUnit.unit_code,
      geologicalContext:
        sampleContext.trim() ||
        `${activeEnv.id === "jezero-crater" ? `Collected in USGS unit ${currentGeologicUnit.unit_code} (${currentGeologicUnit.unit_name})` : "Regional geology classification unavailable"} at ${formatCoordinates(coords.latitude, coords.longitude)} (Slope ${liveSlopeDeg.toFixed(1)}°).`,
      collectedAt: new Date().toISOString(),
      isSimulated: true,
      provenanceTier: "SIMULATED_EVA_ACTIVITY",
    };
    const existing = toMutable(mission.simulation.simulatedSamples ?? []);
    updateSimulation({
      isActive: true,
      simulatedSamples: [...existing, sample],
    });
    setSampleName("");
    setSampleContext("");
    showTransientFeedback(
      `Simulated ${sample.sampleType} sample "${sample.name}" (${nextTubeSerialId}) cached under SIMULATED_EVA_ACTIVITY provenance.`
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

  // Compute spherical bearings and distances for the shared Helmet Navigation Compass
  const compassMarkers = useMemo<CompassMarkerItem[]>(() => {
    const items: CompassMarkerItem[] = [];

    const addMarker = (
      id: string,
      shortName: string,
      fullName: string,
      coords: Coordinates,
      kind: "base" | "target" | "landmark",
      visited = false
    ) => {
      const dist = Math.round(
        greatCircleDistanceMeters(currentPos, coords, planetRadiusMeters)
      );
      const bearing = Math.round(bearingDegrees(currentPos, coords)) % 360;
      const delta = shortestAngularDelta(liveHeadingDeg, bearing);
      items.push({
        id,
        shortName,
        fullName,
        coordinates: coords,
        bearingDeg: bearing,
        deltaDeg: delta,
        distanceMeters: dist,
        kind,
        visited,
      });
    };

    addMarker(
      "habitat-base",
      "Habitat Base",
      activeEnv.defaultBase.name,
      baseCoordinates,
      "base",
      false
    );

    mission.scientificTargets.forEach((t, idx) => {
      addMarker(
        t.id,
        `T${idx + 1}: ${t.name.slice(0, 14)}`,
        t.name,
        t.coordinates,
        "target",
        mission.simulation.visitedTargetIds.includes(t.id)
      );
    });

    const landmarkShorts: Record<string, string> = {
      "jezero-delta-front": "Western Delta",
      "seitah-outcrop": "Séítah Olivine",
      "belva-crater": "Belva Impact",
    };

    activeEnv.fieldSites.slice(1).forEach((site: { id: string; name: string; latitude: number; longitude: number }) => {
      const dup = mission.scientificTargets.some(
        (t) =>
          Math.hypot(
            t.coordinates.latitude - site.latitude,
            t.coordinates.longitude - site.longitude
          ) < 0.003
      );
      if (!dup) {
        addMarker(
          site.id,
          landmarkShorts[site.id] ?? site.name.slice(0, 14),
          site.name,
          { latitude: site.latitude, longitude: site.longitude },
          "landmark",
          false
        );
      }
    });

    return items;
  }, [
    activeEnv.defaultBase.name,
    activeEnv.fieldSites,
    baseCoordinates,
    currentPos,
    liveHeadingDeg,
    mission.scientificTargets,
    mission.simulation.visitedTargetIds,
    planetRadiusMeters,
  ]);

  const primaryGuideMarker = useMemo(() => {
    const unvisitedTarget = compassMarkers.find(
      (m) => m.kind === "target" && !m.visited
    );
    if (unvisitedTarget) return unvisitedTarget;
    return (
      compassMarkers.find((m) => m.id === selectedTargetId) ??
      compassMarkers.find((m) => m.kind === "landmark") ??
      compassMarkers[0] ??
      null
    );
  }, [compassMarkers, selectedTargetId]);

  const baseMarker = useMemo(
    () => compassMarkers.find((m) => m.kind === "base") ?? null,
    [compassMarkers]
  );

  return (
    <MissionLayout
      fullscreenCanvas
      stage="Stage 03 · Explore"
      title={
        isSimulatorAvailable
          ? `Marswalk 3D Surface Simulator · ${activeEnv.displayName}`
          : `3D Surface Exploration · ${resolvedSimulator.regionName}`
      }
      subtitle={
        isSimulatorAvailable
          ? `Traverse the ${activeEnv.terrain.credit} under Mars partial gravity (3.71 m/s²).`
          : `3D surface simulation environment is in preparation for ${resolvedSimulator.regionName}. Scientific exploration remains available via orbital and 2D mapping tools.`
      }
      actions={
        <>
          <Link
            to="/mission/route"
            className="mx-btn mx-btn--secondary mx-btn--sm"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            Route Planner
          </Link>
          <Link
            to="/mission/review"
            className="mx-btn mx-btn--primary mx-btn--sm"
          >
            Mission Review
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </>
      }
    >
      {/* Fullscreen 3D Visor Viewport OR Non-Available Simulator Workstation */}
      <div className="relative h-full w-full overflow-hidden bg-[#0c0806]">
        {!isSimulatorAvailable || !activeEnv ? (
          <div className="mx-scroll flex h-full w-full flex-col items-center justify-center overflow-y-auto p-6 text-center">
            <div className="mx-panel w-full max-w-2xl border border-mx-border-strong bg-mx-bg/95 p-6 text-left shadow-2xl sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mx-border pb-4">
                <div>
                  <span className="mx-eyebrow mx-eyebrow--accent">
                    STAGE 03 · 3D SURFACE EXPLORATION STATUS
                  </span>
                  <h2 className="mx-heading m-0 mt-1 text-2xl font-bold">
                    {resolvedSimulator.regionName}
                  </h2>
                </div>
                <span
                  className={`mx-badge px-2.5 py-1 font-mono text-xs uppercase tracking-wider ${
                    resolvedSimulator.availability === "PLANNED"
                      ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                      : "border-slate-500/50 bg-slate-500/15 text-slate-300"
                  }`}
                >
                  3D Simulator {resolvedSimulator.availability}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 font-mono text-xs text-mx-muted">
                <span className="inline-flex items-center gap-1.5 text-mx-text">
                  <MapPin size={13} className="text-mx-accent" />
                  Target Coordinates:{" "}
                  {formatCoordinates(
                    baseCoordinates.latitude,
                    baseCoordinates.longitude
                  )}
                </span>
                <span>•</span>
                <span>Vertical Reference: MOLA Areoid</span>
              </div>

              <div className="mt-4 rounded-lg border border-mx-border bg-mx-surface/60 p-4 text-sm leading-relaxed text-mx-text">
                {resolvedSimulator.reason}
              </div>

              {resolvedSimulator.plannedEnvironment?.requiredAssets && (
                <div className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-4">
                  <span className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                    Required 3D Simulation Assets (Compilation In Progress)
                  </span>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-cyan-100/80">
                    {resolvedSimulator.plannedEnvironment.requiredAssets.map(
                      (asset, i) => (
                        <li key={i}>{asset}</li>
                      )
                    )}
                  </ul>
                </div>
              )}

              <div className="mt-6 rounded-lg border border-mx-border bg-mx-surface/30 p-3.5 text-xs text-mx-muted">
                <strong className="text-mx-text">
                  Active Scientific Capabilities:
                </strong>{" "}
                You can continue investigating orbital datasets, verifying
                spectral and thermal measurements, analyzing knowledge gaps,
                planning candidate routes, and compiling your research dossier.
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-mx-border pt-4">
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/mission/investigate"
                    className="mx-btn mx-btn--secondary mx-btn--sm"
                  >
                    <ArrowLeft size={13} />
                    Investigation Workspace
                  </Link>
                  <Link
                    to="/mission/builder"
                    className="mx-btn mx-btn--secondary mx-btn--sm"
                  >
                    Mission Builder
                  </Link>
                  <Link
                    to="/mission/review"
                    className="mx-btn mx-btn--primary mx-btn--sm"
                  >
                    Proceed to Review
                    <ArrowRight size={13} />
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const jezero = getMarsRegionById("jezero-crater");
                    if (jezero) setRegion(jezero);
                  }}
                  className="mx-btn mx-btn--secondary mx-btn--sm border-emerald-500/40 text-emerald-300 hover:border-emerald-400"
                >
                  Switch to Jezero Crater for Live 3D EVA
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
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

            <div className="absolute right-3 top-16 z-[30] w-64 rounded-lg border border-mx-border bg-mx-bg/95 p-3 shadow-xl backdrop-blur">
              <label htmlFor="marswalk-surface-overlay" className="mx-label">Comparative surface overlay</label>
              <select id="marswalk-surface-overlay" className="mx-input mt-1 text-xs" value={surfaceOverlayLayer} onChange={(event) => setSurfaceOverlayLayer(event.target.value as MapLayerId | "")}>
                <option value="">None</option>
                {Object.values(MAP_LAYERS).map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}
              </select>
              {surfaceOverlayLayer && <label className="mt-2 block text-[11px] text-mx-muted" htmlFor="marswalk-overlay-opacity">Blend opacity · {Math.round(surfaceOverlayOpacity * 100)}%</label>}
              {surfaceOverlayLayer && <input id="marswalk-overlay-opacity" className="mx-range mt-1" type="range" min="0.1" max="0.9" step="0.05" value={surfaceOverlayOpacity} onChange={(event) => setSurfaceOverlayOpacity(Number(event.target.value))} />}
              {surfaceOverlayStatus && <p className="m-0 mt-1 text-[10px] text-mx-muted" role="status">{surfaceOverlayStatus}</p>}
            </div>

            {/* Subtle Astronaut Helmet Visor Frame Vignette */}
            <div
              className="pointer-events-none absolute inset-0 z-[10] shadow-[inset_0_0_90px_rgba(8,6,7,0.22)]"
              aria-hidden="true"
            />

            {/* Standardized Shared Astronaut Helmet HUD */}
            <HelmetHud
              environment={activeEnv}
              isFallbackEnvironment={false}
              requestedRegionName={mission.region?.name ?? null}
              explorationMode={explorationMode}
              currentPos={currentPos}
              baseCoordinates={baseCoordinates}
              liveElevationM={liveElevationM}
              liveSlopeDeg={liveSlopeDeg}
              liveHeadingDeg={liveHeadingDeg}
              liveFlyMode={liveFlyMode}
              liveMapOpen={liveMapOpen}
              anyModalOpen={anyModalOpen}
              totalTraverseMeters={mission.simulation.totalTraverseMeters ?? 0}
              distanceFromBaseMeters={
                mission.simulation.distanceFromBaseMeters ?? 0
              }
              elapsedTimeSeconds={mission.simulation.elapsedTimeSeconds}
              visitedCount={visitedCount}
              totalTargets={totalTargets}
              visitedTargetIds={mission.simulation.visitedTargetIds}
              scientificTargets={mission.scientificTargets}
              selectedTargetId={selectedTargetId}
              currentGeologicUnit={currentGeologicUnit}
              compassMarkers={compassMarkers}
              primaryGuideMarker={primaryGuideMarker}
              baseMarker={baseMarker}
              nearestBeacon={nearestBeacon}
              isApproachingBeacon={isApproachingBeacon}
              activeGroundTruthSol={activeGroundTruthSol}
              suit={suit}
              envConditions={env}
              isRotaryDrillEquipped={isRotaryDrillEquipped}
              equippedToolsCount={equippedTools.length}
              observationsCount={mission.selectedObservations.length}
              samplesCount={collectedSamples.length}
              feedbackBanner={feedbackBanner}
              simulatorError={simulatorError}
              onDismissFeedback={() => setFeedbackBanner(null)}
              onRetrySimulator={() => {
                setSimulatorError(null);
                setInitializing(true);
                iframeRef.current?.contentWindow?.location.reload();
              }}
              onSelectMode={(mode) => updateSimulation({ mode })}
              onSelectTarget={(id) => setSelectedTargetId(id)}
              onTeleportTo={handleTeleportTo}
              onToggleFieldwork={() => {
                setShowContingencyDrawer(false);
                setShowSuitCheckModal(false);
                setShowReturnModal(false);
                setShowFieldworkDrawer((prev) => !prev);
              }}
              onOpenBeaconFieldwork={() => {
                if (nearestBeacon?.isMissionTarget) {
                  setSelectedTargetId(nearestBeacon.id);
                }
                setActiveFieldworkTab("target");
                setShowContingencyDrawer(false);
                setShowSuitCheckModal(false);
                setShowReturnModal(false);
                setShowFieldworkDrawer(true);
              }}
              onToggleMap={handleToggleIframeMap}
              onToggleFlight={handleToggleIframeFlight}
              onOpenSuitCheck={() => {
                setShowFieldworkDrawer(false);
                setShowContingencyDrawer(false);
                setShowReturnModal(false);
                setShowSuitCheckModal(true);
              }}
              onOpenContingency={() => {
                setShowFieldworkDrawer(false);
                setShowSuitCheckModal(false);
                setShowReturnModal(false);
                setShowContingencyDrawer((prev) => !prev);
              }}
              onTriggerReturn={() => {
                setShowFieldworkDrawer(false);
                setShowContingencyDrawer(false);
                setShowSuitCheckModal(false);
                updateSimulation({
                  returnedToBase: true,
                  completedAt: new Date().toISOString(),
                });
                setShowReturnModal(true);
              }}
            />
          </>
        )}

        {/* ================================================================
            CENTERED MODAL: IN-SITU FIELDWORK STATION [E] · NOTEPAD [N]
            (Contained inside the Marswalk visor viewport below the mission header)
            ================================================================ */}
        {showFieldworkDrawer && (
          <div
            className="absolute inset-0 z-[50] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="In-Situ Scientific Fieldwork and Sampling"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowFieldworkDrawer(false);
              }
            }}
          >
            <div className="flex max-h-[84vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-mx-border-strong bg-mx-bg/96 shadow-2xl">
              <div className="flex items-center justify-between border-b border-mx-border px-5 py-3.5">
                <div>
                  <span className="mx-eyebrow mx-eyebrow--accent">
                    IN-SITU FIELDWORK STATION [E] · LIVE 3D SURFACE TERMINAL
                  </span>
                  <h3 className="mx-heading m-0 text-base sm:text-lg">
                    Target Inspection, Observations &amp; Sample Caching
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFieldworkDrawer(false)}
                  className="rounded-md border border-mx-border bg-mx-surface px-2.5 py-1 text-xs text-mx-muted hover:border-mx-accent hover:text-mx-text"
                  aria-label="Close fieldwork modal"
                >
                  Close [Esc / E]
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
                  Targets & Outcrop
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
                          No formal targets defined yet. Inspecting nearest
                          beacon or current surface coordinates (
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

                    {/* Phase 5: Perseverance Ground-Truth Outcrop Preview + Orbital CRISM/HiRISE Telemetry */}
                    {activeEnv.id === "jezero-crater" && <div className="rounded-lg border border-cyan-500/35 bg-mx-surface/80 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                          <Camera size={12} />
                          PERSEVERANCE GROUND-TRUTH OUTCROP PREVIEW
                        </span>
                        <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200">
                          Sol {activeGroundTruthSol} · {groundTruthImages.length}{" "}
                          Frames
                        </span>
                      </div>

                      <p className="m-0 mt-1 text-[11px] font-semibold text-white">
                        {groundTruthCorrelation.zoneLabel}
                      </p>
                      <p className="m-0 mt-0.5 text-[10px] text-mx-muted">
                        {groundTruthCorrelation.rationale}
                      </p>

                      {/* Sol Switcher (Sol 1 Landing, Sol 420 Delta, Sol 2024/2031 Séítah) */}
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {[
                          { sol: 420, label: "Sol 420 (Delta Scarp)" },
                          { sol: 2024, label: "Sol 2024 (Séítah Olivine)" },
                          { sol: 2031, label: "Sol 2031 (Bedrock)" },
                          { sol: 1, label: "Sol 1 (Landing Site)" },
                        ].map((opt) => (
                          <button
                            key={opt.sol}
                            type="button"
                            onClick={() => setGroundTruthSolOverride(opt.sol)}
                            className={`rounded border px-2 py-0.5 text-[10px] font-medium transition ${
                              activeGroundTruthSol === opt.sol
                                ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                                : "border-mx-border bg-mx-bg/50 text-mx-muted hover:text-mx-text"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* Authentic Rover Image Display */}
                      <div className="mt-2.5 overflow-hidden rounded-lg border border-mx-border bg-black/50">
                        {activeGroundTruthImage && !groundTruthImgError ? (
                          <div className="relative">
                            <img
                              src={activeGroundTruthImage.imageUrl}
                              alt={activeGroundTruthImage.caption}
                              onError={() => setGroundTruthImgError(true)}
                              className="h-44 w-full object-cover"
                            />
                            <div className="flex items-center justify-between bg-black/80 px-2.5 py-1.5 text-[10px]">
                              <span className="font-mono text-cyan-300">
                                {activeGroundTruthImage.instrument} · Sol{" "}
                                {activeGroundTruthImage.sol} · Site{" "}
                                {activeGroundTruthImage.site ?? "—"} / Drive{" "}
                                {activeGroundTruthImage.drive ?? "—"}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGroundTruthImgError(false);
                                    setGroundTruthIdx((prev) =>
                                      groundTruthImages.length > 0
                                        ? (prev - 1 + groundTruthImages.length) %
                                          groundTruthImages.length
                                        : 0
                                    );
                                  }}
                                  className="rounded border border-white/20 px-1.5 py-0.5 text-[9px] text-white hover:bg-white/10"
                                >
                                  Prev
                                </button>
                                <span className="font-mono text-[9px] text-mx-muted">
                                  {groundTruthIdx + 1}/
                                  {Math.max(1, groundTruthImages.length)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGroundTruthImgError(false);
                                    setGroundTruthIdx((prev) =>
                                      groundTruthImages.length > 0
                                        ? (prev + 1) % groundTruthImages.length
                                        : 0
                                    );
                                  }}
                                  className="rounded border border-white/20 px-1.5 py-0.5 text-[9px] text-white hover:bg-white/10"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2">
                            <ImagePending
                              label={`Perseverance Sol ${activeGroundTruthSol} (${activeGroundTruthImage?.instrumentLabel ?? "Mastcam-Z"})`}
                              detail="NASA/JPL-Caltech PDS image endpoint offline or unreachable in current sandbox"
                            />
                          </div>
                        )}
                      </div>

                      {activeGroundTruthImage && (
                        <p className="m-0 mt-1.5 text-[10px] leading-relaxed text-mx-muted">
                          <strong className="text-mx-text">
                            {activeGroundTruthImage.instrumentLabel}:
                          </strong>{" "}
                          {activeGroundTruthImage.caption}
                        </p>
                      )}

                      {/* Correlated USGS SIM 3464 Unit & CRISM/HiRISE Orbital Telemetry */}
                      <div className="mt-2.5 rounded border border-mx-border bg-mx-bg/70 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                            <Layers size={11} />
                            USGS SIM 3464 &amp; ORBITAL TELEMETRY
                          </span>
                          <span
                            className="rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold"
                            style={{
                              borderColor: currentGeologicUnit.color,
                              backgroundColor: `${currentGeologicUnit.color}28`,
                              color: "#f8fafc",
                            }}
                          >
                            {currentGeologicUnit.unit_code}
                          </span>
                        </div>
                        <p className="m-0 mt-1 text-[11px] font-medium text-white">
                          {currentGeologicUnit.unit_name} (
                          {currentGeologicUnit.stratigraphic_age})
                        </p>
                        <p className="m-0 mt-0.5 text-[10px] text-mx-muted">
                          <strong className="text-mx-text"> Lithology:</strong>{" "}
                          {currentGeologicUnit.lithology}
                        </p>
                        <p className="m-0 mt-1 text-[10px] text-cyan-200/90">
                          <strong className="text-cyan-300">
                            Orbital CRISM / HiRISE:
                          </strong>{" "}
                          {groundTruthCorrelation.orbitalLink}
                        </p>
                      </div>
                    </div>}

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
                        in USGS unit{" "}
                        <strong className="mx-mono text-white">
                          [{currentGeologicUnit.unit_code}]
                        </strong>{" "}
                        (Elev {liveElevationM.toFixed(0)} m, Slope{" "}
                        {liveSlopeDeg.toFixed(1)}°). Synced directly to
                        Scientific Investigation & Evidence Inspector.
                      </p>
                    </div>

                    {activeGroundTruthImage && (
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-2.5 text-[11px]">
                        <input
                          type="checkbox"
                          checked={attachRoverImgToObs}
                          onChange={(e) =>
                            setAttachRoverImgToObs(e.target.checked)
                          }
                          className="mt-0.5 rounded border-mx-border"
                        />
                        <span>
                          <strong className="text-cyan-200">
                            Attach Perseverance Ground-Truth Image:
                          </strong>{" "}
                          <span className="text-mx-muted">
                            Sol {activeGroundTruthImage.sol}{" "}
                            {activeGroundTruthImage.instrument} (Site{" "}
                            {activeGroundTruthImage.site ?? "—"}, Drive{" "}
                            {activeGroundTruthImage.drive ?? "—"})
                          </span>
                        </span>
                      </label>
                    )}

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
                      <div className="flex items-center justify-between gap-2">
                        <span className="mx-eyebrow text-amber-300">
                          SIMULATED EVA SAMPLE COLLECTION
                        </span>
                        <span className="rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-200">
                          SIMULATED_EVA_ACTIVITY
                        </span>
                      </div>
                      <p className="m-0 mt-1 text-[11px] text-amber-100/80">
                        Samples collected here are explicitly tagged with{" "}
                        <code className="text-amber-200">
                          SIMULATED_EVA_ACTIVITY
                        </code>{" "}
                        provenance to distinguish them from actual NASA
                        Perseverance cached tubes or orbital datasets.
                      </p>
                    </div>

                    {/* Phase 5: Mission Equipment Loadout Gate */}
                    <div className="rounded-lg border border-mx-border bg-mx-surface/80 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-mx-text">
                          <Wrench size={12} className="text-mx-accent" />
                          Mission Equipment Loadout Check
                        </span>
                        <button
                          type="button"
                          onClick={toggleRotaryDrillInLoadout}
                          className={`rounded border px-2 py-0.5 text-[10px] font-semibold transition ${
                            isRotaryDrillEquipped
                              ? "border-emerald-500/45 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                              : "border-rose-500/45 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"
                          }`}
                        >
                          {isRotaryDrillEquipped
                            ? "✓ Rotary Core Drill Equipped"
                            : "✕ Rotary Core Drill Unequipped"}
                        </button>
                      </div>
                      <p className="m-0 mt-1 text-[10px] text-mx-muted">
                        Active Loadout:{" "}
                        <span className="text-mx-text">
                          {equippedTools.length > 0
                            ? equippedTools.join(" · ")
                            : "Standard EVA Scoop Only"}
                        </span>
                      </p>
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label
                          htmlFor="marswalk-sample-type"
                          className="block font-medium text-mx-text"
                        >
                          Sample Type
                        </label>
                        <span className="font-mono text-[10px] text-cyan-300">
                          Next Tube Serial: <strong>{nextTubeSerialId}</strong>
                        </span>
                      </div>
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

                    {/* Equipment Gate Warning when Rock Core selected without Rotary Core Drill */}
                    {sampleType === "Rock Core" && !isRotaryDrillEquipped && (
                      <div
                        role="alert"
                        className="rounded-lg border border-rose-500/50 bg-rose-950/35 p-3 text-[11px] text-rose-200"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle
                            size={15}
                            className="mt-0.5 shrink-0 text-rose-400"
                          />
                          <div>
                            <strong className="block text-rose-300">
                              Equipment Interlock Active
                            </strong>
                            <p className="m-0 mt-0.5 leading-relaxed">
                              Requires Rotary Core Drill in Mission Equipment
                              Loadout. Only loose regolith scoops or surface
                              float rocks can be collected.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

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
                        placeholder={`e.g., ${nextTubeSerialId} · ${currentGeologicUnit.unit_code} Carbonate-Bearing Core`}
                        value={sampleName}
                        onChange={(e) => setSampleName(e.target.value)}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="marswalk-sample-context"
                        className="mb-1 block font-medium text-mx-text"
                      >
                        Geological Context & Target Link (
                        {currentGeologicUnit.unit_code})
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
                      disabled={
                        sampleType === "Rock Core" && !isRotaryDrillEquipped
                      }
                      onClick={handleCollectSample}
                      className="mx-btn mx-btn--primary mx-btn--block disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Sparkles size={15} />
                      {sampleType === "Rock Core" && !isRotaryDrillEquipped
                        ? "Rotary Core Drill Required for Rock Core"
                        : `Cache Simulated Sample (${nextTubeSerialId})`}
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
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <strong className="text-mx-text">{s.name}</strong>
                              <div className="flex items-center gap-1">
                                {s.tubeId && (
                                  <span className="rounded border border-cyan-500/35 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200">
                                    {s.tubeId}
                                  </span>
                                )}
                                {s.geologicUnitCode && (
                                  <span className="rounded border border-white/20 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-white">
                                    {s.geologicUnitCode}
                                  </span>
                                )}
                                <span className="mx-badge">{s.sampleType}</span>
                              </div>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-mx-muted">
                              <span className="mx-mono">
                                {formatCoordinates(
                                  s.coordinates.latitude,
                                  s.coordinates.longitude
                                )}
                              </span>
                              <span className="font-mono text-[9px] text-amber-300/90">
                                {s.provenanceTier ?? "SIMULATED_EVA_ACTIVITY"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Centered Modal: Environmental & Contingency Simulator */}
        {showContingencyDrawer && (
          <div
            className="fixed inset-0 z-[1250] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="EVA Environmental and Contingency Simulator"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowContingencyDrawer(false);
              }
            }}
          >
            <div className="flex max-h-[82vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-mx-border-strong bg-mx-bg/96 shadow-2xl">
              <div className="flex items-center justify-between border-b border-mx-border px-5 py-3.5">
                <div>
                  <span className="mx-eyebrow mx-eyebrow--accent">
                    ENVIRONMENTAL &amp; SUIT CONTINGENCIES
                  </span>
                  <h3 className="mx-heading m-0 text-base sm:text-lg">
                    Mars Surface Conditions Simulator
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowContingencyDrawer(false)}
                  className="rounded-md border border-mx-border bg-mx-surface px-2.5 py-1 text-xs text-mx-muted hover:border-mx-accent hover:text-mx-text"
                >
                  Close [Esc]
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
            </div>
          </div>
        )}

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

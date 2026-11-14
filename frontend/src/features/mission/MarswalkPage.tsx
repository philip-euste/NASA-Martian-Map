import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Home,
  Layers,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wind,
  Wrench,
  X,
} from "lucide-react";
import { ImagePending, formatCoordinates } from "../../components/ui";
import type { SurfaceImageryCatalogItem } from "../../data/evidenceDatasets";
import {
  JEZERO_DEFAULT_COORDINATES,
  isWithinJezeroDemBounds,
} from "../mars-explorer/marsExplorer.types";
import { perseveranceImageryProvider } from "../../services/providers/perseveranceImageryProvider";
import { useMission } from "../../state/mission/MissionContext";
import type {
  Coordinates,
  FieldNote,
  Observation,
  SimulatedSample,
} from "../../types";
import { identifyGeologicUnitAt } from "../../utils/jezeroStratigraphy";
import MissionLayout from "./MissionLayout";
import {
  calculateMarsSurfaceDistanceMeters,
  toMutable,
} from "./missionHelpers";

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

const COMPASS_TICKS = [
  { deg: 0, label: "N", major: true },
  { deg: 15, label: "15", major: false },
  { deg: 30, label: "30", major: false },
  { deg: 45, label: "NE", major: true },
  { deg: 60, label: "60", major: false },
  { deg: 75, label: "75", major: false },
  { deg: 90, label: "E", major: true },
  { deg: 105, label: "105", major: false },
  { deg: 120, label: "120", major: false },
  { deg: 135, label: "SE", major: true },
  { deg: 150, label: "150", major: false },
  { deg: 165, label: "165", major: false },
  { deg: 180, label: "S", major: true },
  { deg: 195, label: "195", major: false },
  { deg: 210, label: "210", major: false },
  { deg: 225, label: "SW", major: true },
  { deg: 240, label: "240", major: false },
  { deg: 255, label: "255", major: false },
  { deg: 270, label: "W", major: true },
  { deg: 285, label: "285", major: false },
  { deg: 300, label: "300", major: false },
  { deg: 315, label: "NW", major: true },
  { deg: 330, label: "330", major: false },
  { deg: 345, label: "345", major: false },
];

function calculateMarsBearingDegrees(from: Coordinates, to: Coordinates): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return Math.round((((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360);
}

function shortestAngularDelta(fromDeg: number, toDeg: number): number {
  return ((toDeg - fromDeg + 540) % 360) - 180;
}

function formatHeadingCardinal(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return `${String(Math.round(((deg % 360) + 360) % 360)).padStart(3, "0")}° ${dirs[idx]}`;
}

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
        const nextSlope =
          typeof msg.slopeDegrees === "number"
            ? msg.slopeDegrees
            : typeof msg.slopeDeg === "number"
              ? msg.slopeDeg
              : null;
        if (nextSlope !== null) {
          setLiveSlopeDeg(nextSlope);
        }
        const nextElev =
          typeof msg.elevationMeters === "number"
            ? msg.elevationMeters
            : typeof msg.elevation === "number"
              ? msg.elevation
              : null;
        if (nextElev !== null) {
          setLiveElevationM(nextElev);
        }
        if (typeof msg.headingDegrees === "number") {
          setLiveHeadingDeg(msg.headingDegrees);
        }
        if (typeof msg.flyMode === "boolean") {
          setLiveFlyMode(msg.flyMode);
        }
        if (typeof msg.mapOpen === "boolean") {
          setLiveMapOpen(msg.mapOpen);
        }
        if (
          typeof msg.latitude === "number" &&
          typeof msg.longitude === "number"
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
      } else if (msg.type === "marswalk:open-fieldwork") {
        if (typeof msg.targetId === "string" && msg.targetId) {
          setSelectedTargetId(msg.targetId);
        }
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

      if (!isInput && (e.key === "e" || e.key === "E")) {
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

  const currentPos = mission.simulation.currentPosition ?? baseCoordinates;
  const visitedCount = mission.simulation.visitedTargetIds.length;
  const totalTargets = mission.scientificTargets.length;
  const collectedSamples = mission.simulation.simulatedSamples ?? [];
  const elapsedMin = Math.floor(mission.simulation.elapsedTimeSeconds / 60);
  const elapsedSec = mission.simulation.elapsedTimeSeconds % 60;

  // Phase 5: Nearest Beacon Proximity (<150 m) & USGS SIM 3464 Stratigraphic Context
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
      ...FREE_EXPLORATION_SITES.map((s) => ({
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
      const dist = calculateMarsSurfaceDistanceMeters(
        currentPos,
        c.coordinates
      );
      if (!best || dist < best.distanceMeters) {
        best = { ...c, distanceMeters: Math.round(dist) };
      }
    }
    return best;
  }, [currentPos, mission.scientificTargets]);

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

  const currentGeologicUnit = useMemo(
    () => identifyGeologicUnitAt(inspectionCoords),
    [inspectionCoords]
  );

  // Correlate active target / beacon coordinates with verified Perseverance Sols (Sol 1, 420, 2024, 2031)
  const groundTruthCorrelation = useMemo(() => {
    const lowerLabel = inspectionLabel.toLowerCase();
    const unitCode = currentGeologicUnit.unit_code;
    const distFromLanding = calculateMarsSurfaceDistanceMeters(
      inspectionCoords,
      { latitude: 18.4447, longitude: 77.4508 }
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
          "MRO CRISM FRT00005C5E (2.296 µm Fe/Mg smectite clay absorption, D2300 = 0.042) + HiRISE 25 cm rhythmic bedding.",
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
        "MRO CRISM FRT0000B204 (1.05 µm Fe²⁺ olivine crystal-field absorption, OLINDEX3 = 0.065).",
    };
  }, [currentGeologicUnit.unit_code, inspectionCoords, inspectionLabel]);

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
  }, [activeGroundTruthSol]);

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

  const nextTubeSerialId = `JZ-EVA-${String(collectedSamples.length + 1).padStart(2, "0")}`;

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
        `In-situ Marswalk EVA surface observation recorded at ${formatCoordinates(coords.latitude, coords.longitude)} in USGS unit ${currentGeologicUnit.unit_code} (Elev ${liveElevationM.toFixed(0)} m, Slope ${liveSlopeDeg.toFixed(1)}°).`,
      source: "Marswalk In-Situ EVA Observation (User Recorded)",
      provenance: {
        source: "Simulated Astronaut EVA Fieldwork (CTX / HiRISE Reference DEM)",
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
    const rawName = sampleName.trim();
    const formattedName = rawName
      ? rawName.startsWith("JZ-EVA-")
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
        `Collected in USGS unit ${currentGeologicUnit.unit_code} (${currentGeologicUnit.unit_name}) at ${formatCoordinates(coords.latitude, coords.longitude)} (Slope ${liveSlopeDeg.toFixed(1)}°).`,
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

  // Compute real spherical bearings and distances for the Helmet Navigation Compass
  const compassMarkers = useMemo(() => {
    const items: {
      id: string;
      shortName: string;
      fullName: string;
      coordinates: Coordinates;
      bearingDeg: number;
      deltaDeg: number;
      distanceMeters: number;
      kind: "base" | "target" | "landmark";
      visited: boolean;
    }[] = [];

    const addMarker = (
      id: string,
      shortName: string,
      fullName: string,
      coords: Coordinates,
      kind: "base" | "target" | "landmark",
      visited = false
    ) => {
      const dist = Math.round(
        calculateMarsSurfaceDistanceMeters(currentPos, coords)
      );
      const bearing = calculateMarsBearingDegrees(currentPos, coords);
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
      "Octavia E. Butler Habitat & Rover Base",
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

    FREE_EXPLORATION_SITES.slice(1).forEach((site) => {
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
    baseCoordinates,
    currentPos,
    liveHeadingDeg,
    mission.scientificTargets,
    mission.simulation.visitedTargetIds,
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

  return (
    <MissionLayout
      fullscreenCanvas
      stage="Stage 03 · Explore"
      title="Marswalk 3D Surface Simulator"
      subtitle="Traverse the USGS/NASA CTX & HiRISE 3D elevation model of Jezero Crater under Mars partial gravity (3.71 m/s²)."
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
      {/* Fullscreen 3D Visor Viewport */}
      <div className="relative h-full w-full overflow-hidden bg-[#0c0806]">
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

        {/* Subtle Astronaut Helmet Visor Frame Vignette */}
        <div
          className="pointer-events-none absolute inset-0 z-[10] shadow-[inset_0_0_90px_rgba(8,6,7,0.68)]"
          aria-hidden="true"
        />

        {/* ================================================================
            ASTRONAUT HELMET HUD — TOP ROW (Left Location, Center Compass, Right Mission)
            ================================================================ */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[25] grid grid-cols-1 items-start gap-2.5 lg:grid-cols-12">
          {/* TOP LEFT (Cols 1-3): Location, Orientation & Active Stratigraphy */}
          <div className="pointer-events-auto rounded-xl border border-white/12 bg-[#141215]/86 px-3.5 py-2.5 text-xs shadow-lg backdrop-blur-md lg:col-span-3">
            <div className="flex items-center justify-between gap-2">
              <span className="mx-eyebrow mx-eyebrow--accent flex items-center gap-1">
                <MapPin size={11} className="text-mx-accent" />
                SURFACE TELEMETRY
              </span>
              <span
                className="rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold"
                style={{
                  borderColor: currentGeologicUnit.color,
                  backgroundColor: `${currentGeologicUnit.color}28`,
                  color: "#f8fafc",
                }}
                title={`${currentGeologicUnit.unit_name} (${currentGeologicUnit.stratigraphic_age})`}
              >
                {currentGeologicUnit.unit_code}
              </span>
            </div>

            <div className="mt-1.5 font-mono text-[12px] font-semibold text-mx-text">
              {formatCoordinates(currentPos.latitude, currentPos.longitude)}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-mx-muted">
              <span>
                Elev{" "}
                <strong className="text-mx-text">
                  {liveElevationM.toFixed(0)} m
                </strong>
              </span>
              <span
                className={
                  liveSlopeDeg >= 15
                    ? "font-semibold text-amber-300"
                    : "text-mx-muted"
                }
              >
                Slope{" "}
                <strong
                  className={
                    liveSlopeDeg >= 15 ? "text-amber-300" : "text-mx-text"
                  }
                >
                  {liveSlopeDeg.toFixed(1)}°
                </strong>
                {liveSlopeDeg >= 15 ? " ⚠" : ""}
              </span>
              <span>
                Traverse{" "}
                <strong className="text-mx-text">
                  {Math.round(mission.simulation.totalTraverseMeters ?? 0)} m
                </strong>
              </span>
            </div>

            <div className="mt-1 truncate text-[10px] text-mx-dim">
              Unit:{" "}
              <span className="text-mx-muted">
                {currentGeologicUnit.unit_name}
              </span>
            </div>
          </div>

          {/* TOP CENTER (Cols 4-9): Interactive Horizontal Navigation Compass Tape */}
          <div className="pointer-events-auto flex flex-col items-center lg:col-span-6">
            <div
              className="relative w-full max-w-[620px] overflow-hidden rounded-xl border border-white/15 bg-[#121014]/88 px-3 pt-2 pb-2.5 shadow-xl backdrop-blur-md"
              aria-label="Astronaut Horizontal Navigation Compass"
            >
              {/* Top digital heading & active target bearing strip */}
              <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-mono">
                <span className="text-mx-muted">
                  MODE:{" "}
                  <strong className="text-mx-text">
                    {liveFlyMode ? "RECON FLIGHT [F]" : "0.38G SURFACE WALK"}
                  </strong>
                </span>
                <span className="rounded border border-mx-accent/50 bg-mx-accent/15 px-2 py-0.5 text-[11px] font-bold text-[#ff9d66]">
                  HDG {formatHeadingCardinal(liveHeadingDeg)}
                </span>
                {primaryGuideMarker ? (
                  <span className="truncate text-sky-300">
                    DEST: <strong>{primaryGuideMarker.shortName}</strong> (
                    {primaryGuideMarker.distanceMeters >= 1000
                      ? `${(primaryGuideMarker.distanceMeters / 1000).toFixed(2)} km`
                      : `${primaryGuideMarker.distanceMeters} m`}{" "}
                    · {primaryGuideMarker.bearingDeg}°)
                  </span>
                ) : (
                  <span className="text-mx-dim">JEZERO DEM COMPASS</span>
                )}
              </div>

              {/* Sliding Horizontal Compass Tape */}
              <div className="relative h-9 w-full overflow-hidden rounded-md border border-white/10 bg-black/45">
                {/* Center Lubber Line / Reticle */}
                <div
                  className="pointer-events-none absolute inset-y-0 left-1/2 z-[15] w-0.5 -translate-x-1/2 bg-mx-accent"
                  aria-hidden="true"
                />

                {/* Rear-Turn Indicators when Primary Destination is outside +/-62° FOV */}
                {primaryGuideMarker && primaryGuideMarker.deltaDeg < -62 && (
                  <button
                    type="button"
                    onClick={() =>
                      handleTeleportTo(
                        primaryGuideMarker.coordinates.latitude,
                        primaryGuideMarker.coordinates.longitude,
                        primaryGuideMarker.fullName
                      )
                    }
                    className=" absolute left-1.5 top-1/2 z-[16] -translate-y-1/2 inline-flex items-center gap-1 rounded bg-mx-accent/25 border border-mx-accent/60 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-[#ff9d66]"
                    title={`Turn left toward ${primaryGuideMarker.fullName} (Click to teleport)`}
                  >
                    <ChevronLeft size={11} />
                    {primaryGuideMarker.shortName}
                  </button>
                )}
                {primaryGuideMarker && primaryGuideMarker.deltaDeg > 62 && (
                  <button
                    type="button"
                    onClick={() =>
                      handleTeleportTo(
                        primaryGuideMarker.coordinates.latitude,
                        primaryGuideMarker.coordinates.longitude,
                        primaryGuideMarker.fullName
                      )
                    }
                    className="absolute right-1.5 top-1/2 z-[16] -translate-y-1/2 inline-flex items-center gap-1 rounded bg-mx-accent/25 border border-mx-accent/60 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-[#ff9d66]"
                    title={`Turn right toward ${primaryGuideMarker.fullName} (Click to teleport)`}
                  >
                    {primaryGuideMarker.shortName}
                    <ChevronRight size={11} />
                  </button>
                )}

                {/* Cardinal & Degree Ticks within +/-65° of current heading */}
                {COMPASS_TICKS.map((tick) => {
                  const delta = shortestAngularDelta(liveHeadingDeg, tick.deg);
                  if (Math.abs(delta) > 66) return null;
                  const leftPct = 50 + (delta / 65) * 46;
                  return (
                    <div
                      key={tick.deg}
                      className="pointer-events-none absolute top-0 flex -translate-x-1/2 flex-col items-center"
                      style={{ left: `${leftPct}%` }}
                    >
                      <div
                        className={`w-px ${
                          tick.major ? "h-2.5 bg-white/70" : "h-1.5 bg-white/30"
                        }`}
                      />
                      <span
                        className={`mt-0.5 font-mono leading-none ${
                          tick.major
                            ? tick.label === "N"
                              ? "text-[10px] font-bold text-mx-accent"
                              : "text-[10px] font-bold text-white"
                            : "text-[8.5px] text-white/45"
                        }`}
                      >
                        {tick.label}
                      </span>
                    </div>
                  );
                })}

                {/* Waypoint & Landmark Markers on the Compass Tape */}
                {compassMarkers.map((m) => {
                  if (Math.abs(m.deltaDeg) > 60) return null;
                  const leftPct = 50 + (m.deltaDeg / 65) * 46;
                  const badgeColor =
                    m.kind === "base"
                      ? "border-sky-400/70 bg-sky-500/25 text-sky-200"
                      : m.visited
                        ? "border-emerald-400/70 bg-emerald-500/25 text-emerald-200"
                        : m.kind === "target"
                          ? "border-mx-accent/80 bg-mx-accent/25 text-[#ffd2b8]"
                          : "border-white/30 bg-white/10 text-mx-text";
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        if (m.kind === "target") {
                          setSelectedTargetId(m.id);
                        }
                        handleTeleportTo(
                          m.coordinates.latitude,
                          m.coordinates.longitude,
                          m.fullName
                        );
                      }}
                      style={{ left: `${leftPct}%` }}
                      className={` common-compass-marker absolute bottom-0.5 z-[14] -translate-x-1/2 whitespace-nowrap rounded border px-1.5 py-0.2 font-mono text-[8.5px] font-semibold transition hover:scale-105 ${badgeColor}`}
                      title={`${m.fullName} — Bearing ${m.bearingDeg}°, Distance ${m.distanceMeters} m (Click to jump)`}
                    >
                      {m.shortName}{" "}
                      <span className="opacity-80">
                        {m.distanceMeters >= 1000
                          ? `${(m.distanceMeters / 1000).toFixed(1)}k`
                          : `${m.distanceMeters}m`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transient Feedback Notification Banner */}
            {feedbackBanner && (
              <div
                className="mt-2 flex w-full max-w-[620px] items-center justify-between gap-3 rounded-lg border border-emerald-500/45 bg-emerald-950/85 px-3.5 py-1.5 text-xs text-emerald-200 shadow-lg backdrop-blur-md"
                role="status"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    size={13}
                    className="shrink-0 text-emerald-400"
                  />
                  <span>{feedbackBanner}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedbackBanner(null)}
                  className="text-emerald-300 hover:text-white"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {simulatorError && (
              <div
                className="mt-2 flex w-full max-w-[620px] items-center justify-between gap-3 rounded-lg border border-red-500/50 bg-red-950/90 px-3.5 py-2 text-xs text-red-100 shadow-lg"
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
          </div>

          {/* TOP RIGHT (Cols 10-12): Mission Status, Mode Switcher & Quick-Jump Waypoints */}
          <div className="pointer-events-auto rounded-xl border border-white/12 bg-[#141215]/86 px-3.5 py-2.5 text-xs shadow-lg backdrop-blur-md lg:col-span-3">
            <div className="flex items-center justify-between gap-2">
              <div
                className="inline-flex rounded-md border border-mx-border bg-mx-bg/90 p-0.5"
                role="group"
                aria-label="Marswalk exploration mode"
              >
                <button
                  type="button"
                  onClick={() => updateSimulation({ mode: "mission" })}
                  className={`rounded px-2 py-0.5 text-[10.5px] font-semibold transition ${
                    explorationMode === "mission"
                      ? "bg-mx-accent text-[#1a0f08]"
                      : "text-mx-muted hover:text-mx-text"
                  }`}
                >
                  Mission EVA
                </button>
                <button
                  type="button"
                  onClick={() => updateSimulation({ mode: "free" })}
                  className={`rounded px-2 py-0.5 text-[10.5px] font-semibold transition ${
                    explorationMode === "free"
                      ? "bg-mx-accent text-[#1a0f08]"
                      : "text-mx-muted hover:text-mx-text"
                  }`}
                >
                  Free Explore
                </button>
              </div>

              <span className="font-mono text-[11px] text-emerald-300">
                <strong>
                  {visitedCount}/{Math.max(1, totalTargets)}
                </strong>{" "}
                Targets
              </span>
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-[11px] text-mx-muted">
              <span>
                EVA{" "}
                <strong className="text-mx-text">
                  {String(elapsedMin).padStart(2, "0")}:
                  {String(elapsedSec).padStart(2, "0")}
                </strong>
              </span>
              <span>
                Base Dist{" "}
                <strong className="text-sky-300">
                  {Math.round(mission.simulation.distanceFromBaseMeters ?? 0)} m
                </strong>
              </span>
            </div>

            {/* Quick-Jump Waypoint Strip */}
            <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-white/10 pt-1.5">
              <button
                type="button"
                onClick={() =>
                  handleTeleportTo(
                    baseCoordinates.latitude,
                    baseCoordinates.longitude,
                    "EVA Habitat & Rover Base"
                  )
                }
                className="rounded border border-sky-400/40 bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] text-sky-200 hover:bg-sky-500/25"
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
                      className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] text-mx-muted hover:border-mx-accent hover:text-mx-text"
                    >
                      {site.name.split(" ")[0]} {site.name.split(" ")[1]}
                    </button>
                  ))
                : mission.scientificTargets.slice(0, 4).map((t, idx) => {
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
                        className={`rounded border px-1.5 py-0.5 text-[10px] transition ${
                          isVisited
                            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                            : "border-white/15 bg-white/5 text-mx-text hover:border-mx-accent"
                        }`}
                      >
                        {isVisited ? "✓ " : `T${idx + 1}: `}
                        {t.name.slice(0, 14)}
                      </button>
                    );
                  })}
            </div>
          </div>
        </div>

        {/* Phase 5: Nearest Beacon (<150 m) Proximity Ground-Truth Callout */}
        {isApproachingBeacon && nearestBeacon && !anyModalOpen && (
          <div className="pointer-events-auto absolute bottom-28 right-3 z-[25] max-w-[330px] rounded-xl border border-emerald-500/45 bg-[#141215]/92 p-3 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                <Camera size={12} />
                BEACON IN RANGE ({nearestBeacon.distanceMeters} m)
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
            <p className="m-0 mt-1 text-xs font-semibold text-white">
              {nearestBeacon.name}
            </p>
            <p className="m-0 mt-0.5 text-[10px] text-mx-muted">
              Perseverance Sol {activeGroundTruthSol} Ground-Truth Outcrop &amp;
              CRISM/HiRISE Orbital Telemetry ready.
            </p>
            <button
              type="button"
              onClick={() => {
                if (nearestBeacon.isMissionTarget) {
                  setSelectedTargetId(nearestBeacon.id);
                }
                setActiveFieldworkTab("target");
                setShowFieldworkDrawer(true);
                setShowContingencyDrawer(false);
              }}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
            >
              <Camera size={12} />
              Open Fieldwork Terminal [E]
            </button>
          </div>
        )}

        {/* ================================================================
            ASTRONAUT HELMET HUD — BOTTOM ROW (Left Suit & Controls, Right Env Telemetry)
            ================================================================ */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[25] flex flex-wrap items-end justify-between gap-2.5">
          {/* BOTTOM LEFT: Suit Life-Support Systems & Interactive EVA Controls */}
          <div className="pointer-events-auto flex max-w-full flex-col gap-1.5 rounded-xl border border-white/12 bg-[#141215]/88 px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-md">
            {/* Suit Life-Support Gauges */}
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
              <span className="mx-eyebrow mx-eyebrow--accent">PLSS SUIT</span>
              <span className="text-mx-muted">
                O₂{" "}
                <strong className="text-emerald-300">
                  {suit.oxygenPercent.toFixed(1)}%
                </strong>
              </span>
              <span className="text-mx-muted">
                Press{" "}
                <strong className="text-mx-text">
                  {suit.suitPressureKpa.toFixed(1)} kPa
                </strong>
              </span>
              <span className="text-mx-muted">
                CO₂ Bed{" "}
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
              <span className="text-mx-muted">
                Batt{" "}
                <strong className="text-mx-text">
                  {suit.batteryPercent.toFixed(0)}%
                </strong>
              </span>
              <span className="text-mx-muted">
                Comms{" "}
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
              <span className="hidden text-mx-border sm:inline">|</span>
              <span className="hidden text-[10.5px] text-mx-dim xl:inline">
                [WASD] Walk · [Shift] Stride · [Space] 0.38g Hop
              </span>
            </div>

            {/* Interactive Visor Action Strip */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowFieldworkDrawer((prev) => !prev)}
                className={`mx-btn mx-btn--sm ${
                  showFieldworkDrawer ? "mx-btn--primary" : "mx-btn--secondary"
                }`}
              >
                <FlaskConical size={13} className="text-mx-accent" />
                Fieldwork &amp; Samples [E]
                <span className="mx-badge ml-0.5">
                  {mission.selectedObservations.length + collectedSamples.length}
                </span>
              </button>

              <button
                type="button"
                onClick={handleToggleIframeMap}
                className={`mx-btn mx-btn--sm ${
                  liveMapOpen ? "mx-btn--primary" : "mx-btn--secondary"
                }`}
              >
                <Navigation size={13} className="text-sky-300" />
                Terrain Map [M]
              </button>

              <button
                type="button"
                onClick={handleToggleIframeFlight}
                className={`mx-btn mx-btn--sm ${
                  liveFlyMode ? "mx-btn--primary" : "mx-btn--secondary"
                }`}
              >
                Recon Flight [F]
              </button>

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
                  <ShieldCheck size={13} className="text-emerald-400" />
                ) : (
                  <ShieldAlert size={13} className="text-amber-400" />
                )}
                Suit Check
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
                <Home size={13} />
                Return Base [R]
              </button>
            </div>
          </div>

          {/* BOTTOM RIGHT: Environmental Telemetry & Contingency Trigger */}
          <div className="pointer-events-auto flex flex-col gap-1.5 rounded-xl border border-white/12 bg-[#141215]/88 px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <span className="mx-eyebrow mx-eyebrow--accent">
                SIMULATED ENV TELEMETRY
              </span>
              <button
                type="button"
                onClick={() => setShowContingencyDrawer((prev) => !prev)}
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10.5px] font-semibold transition ${
                  env.contingencyActive
                    ? "border-amber-400/60 bg-amber-500/20 text-amber-200"
                    : "border-white/15 bg-white/5 text-mx-muted hover:border-mx-accent hover:text-mx-text"
                }`}
              >
                <Wind size={11} />
                {env.contingencyActive
                  ? env.contingencyActive
                  : "Env & Contingencies"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-mx-muted">
              <span>
                Temp{" "}
                <strong className="text-mx-text">
                  {env.surfaceTempCelsius}°C
                </strong>
              </span>
              <span>
                Atm{" "}
                <strong className="text-mx-text">
                  {env.atmosphericPressurePa} Pa
                </strong>
              </span>
              <span>
                Dust τ{" "}
                <strong
                  className={
                    env.dustOpticalDepthTau > 1.0
                      ? "text-amber-300"
                      : "text-mx-text"
                  }
                >
                  {env.dustOpticalDepthTau.toFixed(2)}
                </strong>
              </span>
              <span>
                Vis{" "}
                <strong className="text-mx-text">
                  {env.visibilityKm.toFixed(1)} km
                </strong>
              </span>
              <span>
                Rad{" "}
                <strong className="text-mx-text">
                  {env.radiationDoseRateMicroSvPerHour} µSv/h
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* ================================================================
            CENTERED MODAL: IN-SITU FIELDWORK STATION [E]
            (Centered over live 3D scene without freezing WebGL loop)
            ================================================================ */}
        {showFieldworkDrawer && (
          <div
            className="fixed inset-0 z-[1250] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
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
                    <div className="rounded-lg border border-cyan-500/35 bg-mx-surface/80 p-3">
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
                    </div>

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

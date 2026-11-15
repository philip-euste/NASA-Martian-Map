import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  CRISM_MTRDR_ARCHIVE_URL,
  CRISM_REFERENCE_DATASET_ID,
  CRISM_REFERENCE_LIMITATION,
  CRISM_REFERENCE_METHOD,
  CRISM_REFERENCE_SOURCE,
  EVIDENCE_DATASETS_BY_ID,
  getDatasetsForRegion,
  resolveDatasetMetadata,
  toMissionDataset,
} from "../../data/evidenceDatasets";
import { getMarsRegionById } from "../../data/regions";
import type {
  ExpeditionReport,
  FieldNote,
  KnowledgeGap,
  MarsEnvironmentConditions,
  MarsRegion,
  Mission,
  Observation,
  Region,
  Route,
  ScientificTarget,
  SimulatedSample,
  SimulationState,
  SuitTelemetry,
  TemporalState,
  Waypoint,
} from "../../types";

type DeepReadonly<T> = T extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T;

export type MissionUpdate = Partial<
  Omit<
    Mission,
    "id" | "createdAt" | "updatedAt" | "simulation" | "temporal"
  >
>;

interface MissionContextValue {
  mission: DeepReadonly<Mission>;
  archivedExpeditions: readonly DeepReadonly<Mission>[];
  updateMission: (updates: MissionUpdate) => void;
  updateSimulation: (updates: Partial<SimulationState>) => void;
  updateTemporal: (updates: Partial<TemporalState>) => void;
  setRegion: (region: MarsRegion | Region | null) => void;
  resetMission: () => void;
  createNewExpedition: (region?: MarsRegion | Region | null, name?: string) => void;
  abandonExpedition: () => void;
  loadExpedition: (id: string) => void;
  loadFeaturedDemo: () => void;
}

const MISSION_STORAGE_KEY = "mars-explorer-active-mission-v1";
const ARCHIVE_STORAGE_KEY = "mars-explorer-archived-expeditions-v1";

function getCurrentUTCDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createDefaultSuitTelemetry(): SuitTelemetry {
  return {
    oxygenPercent: 100,
    suitPressureKpa: 29.6,
    co2ScrubberPercent: 100,
    suitTemperatureCelsius: 21.4,
    ventilationNominal: true,
    hydrationPercent: 100,
    batteryPercent: 100,
    commsStatus: "Nominal",
    dustExposureIndex: 4,
    readinessVerified: false,
  };
}

export function createDefaultEnvironment(): MarsEnvironmentConditions {
  return {
    surfaceTempCelsius: -58,
    atmosphericPressurePa: 735,
    dustOpticalDepthTau: 0.45,
    visibilityKm: 18.5,
    radiationDoseRateMicroSvPerHour: 21.2,
    windSpeedMetersPerSec: 4.8,
    contingencyActive: null,
  };
}

function createInitialMission(): Mission {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name: "Untitled Expedition",
    objective: "",
    question: "",

    region: null,
    configuration: null,

    selectedDatasets: [],
    selectedObservations: [],
    scientificTargets: [],
    knowledgeGaps: [],

    derivedAnalyses: [],
    interpretations: [],
    hypotheses: [],

    candidateRoutes: [],
    selectedRouteId: null,

    simulation: {
      currentPosition: null,
      visitedTargetIds: [],
      elapsedTimeSeconds: 0,
      progressPercentage: 0,
      isActive: false,
      mode: "free",
      returnedToBase: false,
      completedAt: null,
      distanceFromBaseMeters: 0,
      totalTraverseMeters: 0,
      simulatedSamples: [],
      suit: createDefaultSuitTelemetry(),
      environment: createDefaultEnvironment(),
    },

    temporal: {
      mode: "present",
      selectedDate: getCurrentUTCDate(),
      futureSols: 1,
    },

    fieldNotes: [],
    reports: [],

    createdAt: now,
    updatedAt: now,
  };
}

export function createFeaturedDemoMission(): Mission {
  const now = new Date().toISOString();
  const jezeroRegion = getMarsRegionById("jezero-crater") ?? null;
  const target1Id = "target-octavia-butler";
  const target2Id = "target-kodiak-butte";
  const target3Id = "target-delta-scarp";
  const target4Id = "target-belva-rim";
  const routeId = "route-western-delta-traverse";
  const reportId = "report-jezero-benchmark";

  const targets: ScientificTarget[] = [
    {
      id: target1Id,
      name: "Octavia E. Butler Landing (Base)",
      coordinates: { latitude: 18.4447, longitude: 77.4508 },
      description: "Initial surface exploration base and rover touchdown calibration benchmark.",
      observationIds: ["obs-m2020-delta-crossbedding"],
      regionId: "jezero-crater",
    },
    {
      id: target2Id,
      name: "Kodiak Butte Isolated Remnant",
      coordinates: { latitude: 18.4180, longitude: 77.4120 },
      description: "Steeply dipping deltaic bottomset-to-topset foreset beds indicating past lake level stages.",
      observationIds: ["obs-m2020-delta-crossbedding"],
      regionId: "jezero-crater",
    },
    {
      id: target3Id,
      name: "Delta Front Scarp (Hawksbill Gap)",
      coordinates: { latitude: 18.4350, longitude: 77.4200 },
      description: "Exposed smectite clay and carbonate-rich mudstone strata with high biosignature preservation potential.",
      observationIds: ["obs-crism-phyllosilicates"],
      regionId: "jezero-crater",
    },
    {
      id: target4Id,
      name: "Belva Crater Impact Ejecta",
      coordinates: { latitude: 18.4850, longitude: 77.3850 },
      description: "Deep excavated crustal olivine-bearing basaltic megabreccia blocks.",
      observationIds: [],
      regionId: "jezero-crater",
    },
  ];

  const waypoints: Waypoint[] = [
    {
      id: "wp-1",
      name: "Octavia E. Butler Base",
      coordinates: { latitude: 18.4447, longitude: 77.4508 },
      targetId: target1Id,
      visited: true,
    },
    {
      id: "wp-2",
      name: "Māaz-Séítah Floor Contact",
      coordinates: { latitude: 18.4400, longitude: 77.4350 },
      visited: true,
    },
    {
      id: "wp-3",
      name: "Delta Front Lower Scarp",
      coordinates: { latitude: 18.4350, longitude: 77.4200 },
      targetId: target3Id,
      visited: true,
    },
    {
      id: "wp-4",
      name: "Western Delta Upper Topset",
      coordinates: { latitude: 18.4300, longitude: 77.4050 },
      visited: true,
    },
  ];

  const route: Route = {
    id: routeId,
    name: "Western Delta Astrobiology Traverse",
    waypoints,
    distanceMeters: 3420,
    elevationGainMeters: 68,
    elevationLossMeters: 12,
    reachedTargetIds: [target1Id, target3Id],
    returnRouteIncluded: true,
    returnDistanceMeters: 3420,
    terrainMetrics: {
      averageSlopeDegrees: 4.8,
      maximumSlopeDegrees: 13.9,
      averageRoughness: 0.18,
      uncertaintyNotes: ["CTX 20m DEM smooths localized meter-scale scarp verticality."],
      assumptions: ["Astronaut traverse speed maintained at 1.8 km/h under Martian 0.38g gravity."],
    },
  };

  const observations: Observation[] = [
    {
      id: "obs-m2020-delta-crossbedding",
      name: "Perseverance Sol 172 Mastcam-Z Delta Strata Crossbedding",
      coordinates: { latitude: 18.4447, longitude: 77.4508 },
      source: "NASA Mars 2020 Perseverance Rover Navcam / Mastcam-Z",
      regionId: "jezero-crater",
      observationDate: "2021-08-15",
      datasetId: "m2020_perseverance_surface_imagery",
      description: "Steeply dipping foreset beds confirming vigorous fluvial discharge into standing lacustrine lake.",
      provenance: {
        source: "NASA Planetary Data System (PDS) Cartography and Imaging Sciences Node",
        sourceId: "urn:nasa:pds:mars2020_perseverance_imagery:sol0172",
        sourceUrl: "https://pds-imaging.jpl.nasa.gov/data/mars2020/",
        processingMethod: "Mastcam-Z calibrated radiance EDR surface mosaic",
        limitations: ["Localized ground-level perspective subject to boulder shadows and atmospheric dust scattering."],
      },
    },
    {
      id: "obs-crism-phyllosilicates",
      name: "CRISM Western Delta Smectite/Carbonate Absorption",
      coordinates: { latitude: 18.4350, longitude: 77.4200 },
      source: CRISM_REFERENCE_SOURCE,
      regionId: "jezero-crater",
      datasetId: CRISM_REFERENCE_DATASET_ID,
      description: "2.3 µm and 1.9 µm vibrational overtone bands diagnostic of Fe/Mg smectite clays (nontronite/saponite).",
      provenance: {
        source: CRISM_REFERENCE_SOURCE,
        sourceId: "urn:nasa:pds:mro_crism:mtrdr:frt00005850_07",
        sourceUrl: CRISM_MTRDR_ARCHIVE_URL,
        processingMethod: CRISM_REFERENCE_METHOD,
        limitations: [CRISM_REFERENCE_LIMITATION],
      },
    },
  ];

  const fieldNotes: FieldNote[] = [
    {
      id: "note-delta-contact",
      missionId: "featured-jezero-expedition",
      content: "Sharp stratigraphic transition observed between rough crater floor basalt and lighter-toned layered delta sediments. Lamination dip angle is ~12 degrees eastward.",
      createdAt: now,
      coordinates: { latitude: 18.4350, longitude: 77.4200 },
      relatedTargetId: target3Id,
    },
  ];

  const knowledgeGaps: KnowledgeGap[] = [
    {
      id: "gap-1",
      description: "Exact timing of late-stage flood boulder deposition on upper delta topsets.",
      reason: "Requires in-situ radiometric dating of basaltic boulders excavated by Belva impact event.",
      relatedDatasetIds: ["ctx_jezero_dtm_20m"],
      relatedObservationIds: ["obs-m2020-delta-crossbedding"],
      significance: "Determines whether Jezero Lake had multiple prolonged wet intervals or short-lived deluge events.",
    },
  ];

  const report: ExpeditionReport = {
    id: reportId,
    missionId: "featured-jezero-expedition",
    title: "Jezero Crater Western Delta Astrobiology Traverse — Benchmark Dossier",
    generatedAt: now,
    summary: "Synthesis of orbital HiRISE/CTX DTM data, CRISM spectral mineralogy, and Perseverance ground-truth imaging across the Jezero lacustrine-deltaic sequence. Confirms clear contact transition from olivine-bearing crater floor mafic units (Hcf_cr) to fine-grained clay-rich delta deposits (Njd_w).",
    datasetIds: ["ctx_jezero_dtm_20m", "hirise_jezero_dtm", "crism_jezero_mtrdr", "m2020_perseverance_surface_imagery", "m2020_meda_weather"],
    observationIds: ["obs-m2020-delta-crossbedding", "obs-crism-phyllosilicates"],
    scientificTargetIds: [target1Id, target2Id, target3Id, target4Id],
    candidateRouteIds: [routeId],
    selectedRouteId: routeId,
    fieldNotes,
    knowledgeGaps,
    limitations: [
      "Simulated EVA metabolic drawdowns reflect Apollo/Artemis baseline models (NASA SP-2008-548).",
      "Orbital remote sensing spatial resolution is 20m for CTX DTM and 25cm for HiRISE orthomosaics.",
    ],
    conclusions: [
      "The Jezero Western Delta represents a multi-phase deltaic deposit with robust preservation potential for organic biosignatures.",
      "The contact crossing between the Māaz formation floor and the delta scarp exhibits low slope hazards (<15°), confirming traverse safety for astronaut EVA.",
      "Fine-grained smectite clays sampled at Target 3 correlate with CRISM orbital absorption bands, validating the 4-tier evidentiary pipeline.",
    ],
    recommendedInvestigations: [
      "Perform high-precision laser-induced breakdown spectroscopy (LIBS) on Kodiak Butte basal contact strata.",
      "Cache sample canisters from both the low-energy mudstones and high-energy conglomerate channels for Mars Sample Return.",
    ],
    simulatedSampleIds: ["sample-jz-eva-01", "sample-jz-eva-02"],
  };

  return {
    id: "featured-jezero-expedition",
    name: "Jezero Delta Astrobiology Expedition (Featured)",
    objective: "Reconstruct the lacustrine-deltaic depositional sequence of Jezero Crater and evaluate biosignature preservation potential across the Western Delta front.",
    question: "Did the lacustrine-deltaic sequence in Jezero Crater preserve biosignatures within smectite clay-bearing strata of the Western Delta scarp?",
    region: jezeroRegion,
    configuration: {
      startingLocation: { latitude: 18.4447, longitude: 77.4508 },
      scientificTargetIds: [target1Id, target2Id, target3Id, target4Id],
      missionDurationSols: 3,
      hypotheticalEVADurationHours: 6.5,
      nominalTraverseSpeedKmh: 1.8,
      astronautWeightKg: 80,
      astronautHeightCm: 180,
      oxygenConsumptionLitersPerHour: 48,
      terrainPreferences: {
        preferredSlopeDegrees: 15,
        preferredRoughness: 0.5,
        avoidKnownObstacles: true,
      },
      sciencePriorities: ["Biosignature preservation in smectite clay", "Delta topset/foreset contact mapping"],
      explorationStrategy: "Walk out and return loop from Octavia E. Butler base across delta scarp.",
      equipment: ["rock_hammer", "portable_xrf", "sample_canisters", "handheld_multispectral_imager"],
      equipmentLoadout: ["rock_hammer", "portable_xrf", "sample_canisters", "handheld_multispectral_imager"],
      missionConstraints: ["Max traverse slope < 15 degrees", "Return to base reserve O2 > 20%"],
      requireReturnToBase: true,
    },
    selectedDatasets: getDatasetsForRegion("jezero-crater")
      .slice(0, 5)
      .map(toMissionDataset),
    selectedObservations: observations,
    scientificTargets: targets,
    knowledgeGaps,
    derivedAnalyses: [],
    interpretations: [],
    hypotheses: [],
    candidateRoutes: [route],
    selectedRouteId: routeId,
    simulation: {
      currentPosition: { latitude: 18.4350, longitude: 77.4200 },
      visitedTargetIds: [target1Id, target2Id, target3Id, target4Id],
      elapsedTimeSeconds: 5240,
      progressPercentage: 100,
      isActive: false,
      mode: "free",
      returnedToBase: true,
      completedAt: now,
      distanceFromBaseMeters: 2840,
      totalTraverseMeters: 3420,
      simulatedSamples: [
        {
          id: "sample-jz-eva-01",
          tubeId: "JZ-EVA-01",
          name: "Delta Scarp Fine-Grained Clay Mudstone",
          sampleType: "Rock Core",
          coordinates: { latitude: 18.4350, longitude: 77.4200 },
          targetId: target3Id,
          geologicUnitCode: "Njd_w",
          geologicalContext: "Harvested from low-energy laminated lacustrine mudstone at the base of the Western Delta front.",
          collectedAt: now,
          isSimulated: true,
          provenanceTier: "SIMULATED_EVA_ACTIVITY",
        },
        {
          id: "sample-jz-eva-02",
          tubeId: "JZ-EVA-02",
          name: "Crater Floor Mafic Regolith Transition",
          sampleType: "Regolith",
          coordinates: { latitude: 18.4400, longitude: 77.4350 },
          targetId: target1Id,
          geologicUnitCode: "Hcf_cr",
          geologicalContext: "Floor unit basaltic sand and pyroxene-rich gravel near the Séítah formation boundary.",
          collectedAt: now,
          isSimulated: true,
          provenanceTier: "SIMULATED_EVA_ACTIVITY",
        },
      ],
      suit: {
        oxygenPercent: 88.4,
        suitPressureKpa: 29.6,
        co2ScrubberPercent: 91,
        suitTemperatureCelsius: 21.2,
        ventilationNominal: true,
        hydrationPercent: 84,
        batteryPercent: 79,
        commsStatus: "Nominal",
        dustExposureIndex: 3,
        readinessVerified: true,
      },
      environment: createDefaultEnvironment(),
    },
    temporal: {
      mode: "present",
      selectedDate: getCurrentUTCDate(),
      futureSols: 1,
    },
    fieldNotes,
    reports: [report],
    createdAt: now,
    updatedAt: now,
  };
}

function loadStoredMission(): Mission {
  const fallback = createInitialMission();
  try {
    const raw = window.sessionStorage.getItem(MISSION_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Mission>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.id !== "string") {
      return fallback;
    }
    const migratedDatasets = Array.isArray(parsed.selectedDatasets)
      ? parsed.selectedDatasets.map((ds) => {
          const catalogEntry = ds?.id
            ? EVIDENCE_DATASETS_BY_ID[ds.id]
            : undefined;
          if (catalogEntry?.id === CRISM_REFERENCE_DATASET_ID) {
            return { ...toMissionDataset(catalogEntry), regionId: ds.regionId };
          }
          return catalogEntry
            ? {
                ...toMissionDataset(catalogEntry),
                ...ds,
                integrationStatus: catalogEntry.integrationStatus,
                integrationStatusLabel: catalogEntry.integrationStatusLabel,
                provenance: toMissionDataset(catalogEntry).provenance,
              }
            : ds;
        })
      : fallback.selectedDatasets;

    const migratedObservations = Array.isArray(parsed.selectedObservations)
      ? parsed.selectedObservations.map((obs) => {
          if (!obs || typeof obs !== "object") return obs;
          if (
            obs.datasetId === CRISM_REFERENCE_DATASET_ID &&
            obs.source === "MRO CRISM Targeted Spectral Cube"
          ) {
            return {
              ...obs,
              source: CRISM_REFERENCE_SOURCE,
              observationDate: obs.observationDate === "2021-04-15" ? undefined : obs.observationDate,
              description: obs.description
                ? `Unverified reference-profile notes — ${obs.description}`
                : undefined,
              provenance: {
                source: CRISM_REFERENCE_SOURCE,
                sourceUrl: CRISM_MTRDR_ARCHIVE_URL,
                processingMethod: CRISM_REFERENCE_METHOD,
                limitations: [CRISM_REFERENCE_LIMITATION],
              },
            };
          }
          const dsMeta = resolveDatasetMetadata(obs.datasetId || "");
          return {
            ...obs,
            source: obs.source || dsMeta.name,
            provenance: obs.provenance ?? {
              source: `${dsMeta.instrumentAndMission} (${dsMeta.sourceReference})`,
              sourceId: dsMeta.pdsProductId,
              processingMethod: `${dsMeta.measurementProvided} (${dsMeta.spatialResolutionLabel})`,
              limitations: [...dsMeta.limitations],
            },
          };
        })
      : fallback.selectedObservations;

    const rawRegion = parsed.region as Region | undefined;
    const migratedRegion = rawRegion?.id
      ? (getMarsRegionById(rawRegion.id) ?? rawRegion)
      : fallback.region;

    return {
      ...fallback,
      ...parsed,
      region: migratedRegion,
      selectedDatasets: migratedDatasets,
      selectedObservations: migratedObservations,
      simulation: {
        ...fallback.simulation,
        ...(parsed.simulation ?? {}),
        suit: {
          ...createDefaultSuitTelemetry(),
          ...(parsed.simulation?.suit ?? {}),
        },
        environment: {
          ...createDefaultEnvironment(),
          ...(parsed.simulation?.environment ?? {}),
        },
        simulatedSamples: Array.isArray(parsed.simulation?.simulatedSamples)
          ? parsed.simulation.simulatedSamples
          : [],
      },
      temporal: {
        ...fallback.temporal,
        ...(parsed.temporal ?? {}),
      },
    };
  } catch {
    return fallback;
  }
}

function loadArchivedExpeditions(): Mission[] {
  try {
    const raw =
      window.localStorage.getItem(ARCHIVE_STORAGE_KEY) ||
      window.sessionStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const MissionContext =
  createContext<MissionContextValue | null>(null);

export function MissionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [mission, setMission] = useState<Mission>(loadStoredMission);
  const [archivedExpeditions, setArchivedExpeditions] = useState<Mission[]>(loadArchivedExpeditions);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(mission));
    } catch {
      // Ignore storage quota errors
    }
  }, [mission]);

  function archiveMission(target: Mission) {
    const hasWork = Boolean(
      target.region ||
      target.scientificTargets.length > 0 ||
      target.selectedObservations.length > 0 ||
      target.candidateRoutes.length > 0 ||
      target.fieldNotes.length > 0 ||
      target.reports.length > 0
    );
    if (!hasWork) return;

    setArchivedExpeditions((prev) => {
      const filtered = prev.filter((m) => m.id !== target.id);
      const next = [target, ...filtered].slice(0, 25);
      try {
        window.localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(next));
        window.sessionStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  function createNewExpedition(region?: MarsRegion | Region | null, name?: string): void {
    archiveMission(mission);
    const fresh = createInitialMission();
    if (region) {
      fresh.region = region as MarsRegion;
    }
    if (name?.trim()) {
      fresh.name = name.trim();
    } else if (region) {
      fresh.name = `${region.name} Expedition`;
    }
    setMission(fresh);
    try {
      window.sessionStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(fresh));
    } catch {}
  }

  function abandonExpedition(): void {
    const fresh = createInitialMission();
    setMission(fresh);
    try {
      window.sessionStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(fresh));
    } catch {}
  }

  function loadExpedition(id: string): void {
    const found = archivedExpeditions.find((m) => m.id === id);
    if (found) {
      archiveMission(mission);
      setMission(found);
      try {
        window.sessionStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(found));
      } catch {}
    }
  }

  function loadFeaturedDemo(): void {
    archiveMission(mission);
    const demo = createFeaturedDemoMission();
    setMission(demo);
    try {
      window.sessionStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(demo));
    } catch {}
  }

  // Listen for scientific fieldwork events emitted by the Marswalk 3D simulator iframe
  useEffect(() => {
    function handleSimulatorMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object" || typeof data.type !== "string") {
        return;
      }

      if (data.type === "marswalk:visit-target" && typeof data.targetId === "string") {
        setMission((current) => {
          if (current.simulation.visitedTargetIds.includes(data.targetId)) {
            return current;
          }
          const nextVisited = [...current.simulation.visitedTargetIds, data.targetId];
          const total = Math.max(1, current.scientificTargets.length);
          const progress = Math.min(100, Math.round((nextVisited.length / total) * 100));
          return {
            ...current,
            simulation: {
              ...current.simulation,
              visitedTargetIds: nextVisited,
              progressPercentage: progress,
            },
            updatedAt: new Date().toISOString(),
          };
        });
      } else if (data.type === "marswalk:record-note" && typeof data.content === "string") {
        const noteContent = data.content.trim();
        if (!noteContent) return;
        const latitude = data.latitude;
        const longitude = data.longitude;
        if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 360) return;
        setMission((current) => {
          const newNote: FieldNote = {
            id: `note-${crypto.randomUUID()}`,
            missionId: current.id,
            content: noteContent,
            coordinates: {
              latitude,
              longitude,
            },
            relatedTargetId: typeof data.targetId === "string" ? data.targetId : undefined,
            createdAt: new Date().toISOString(),
          };
          return {
            ...current,
            fieldNotes: [...current.fieldNotes, newNote],
            updatedAt: new Date().toISOString(),
          };
        });
      } else if (data.type === "marswalk:record-observation" && typeof data.name === "string") {
        const obsName = data.name.trim();
        if (!obsName) return;
        const latitude = data.latitude;
        const longitude = data.longitude;
        if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 360) return;
        setMission((current) => {
          const regionElevationDatasetId =
            (current.region as any)?.elevationDatasets?.[0]?.id ??
            (current.region?.id === "jezero-crater" ? "hirise_jezero_dtm" : "mola_global_128");
          const newObs: Observation = {
            id: `obs-${crypto.randomUUID()}`,
            datasetId: regionElevationDatasetId,
            name: obsName,
            source: current.region
              ? `Marswalk Surface EVA · ${current.region.name}`
              : "Marswalk Surface EVA (Simulated In-Situ Observation)",
            coordinates: {
              latitude,
              longitude,
            },
            observationDate: current.temporal.selectedDate,
            regionId: current.region?.id,
            description:
              typeof data.description === "string" && data.description.trim()
                ? data.description.trim()
                : "In-situ geological observation recorded during simulated Marswalk traverse.",
            provenance: {
              source: `Simulated Astronaut EVA Fieldwork (${current.region?.name ?? "Surface"} Reference DEM)`,
              sourceId: "marswalk-eva",
              processingMethod: "Simulated visual and instrument inspection during surface traverse",
              limitations: [
                "Simulated EVA surface observation; requires real rover/orbital verification for physical sample properties.",
              ],
            },
          };
          return {
            ...current,
            selectedObservations: [...current.selectedObservations, newObs],
            updatedAt: new Date().toISOString(),
          };
        });
      } else if (data.type === "marswalk:collect-sample" && typeof data.name === "string") {
        const latitude = data.latitude;
        const longitude = data.longitude;
        if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 360) return;
        setMission((current) => {
          const newSample: SimulatedSample = {
            id: `sample-${crypto.randomUUID()}`,
            name: data.name.trim() || "Simulated Core Sample",
            sampleType: data.sampleType || "Rock Core",
            coordinates: {
              latitude,
              longitude,
            },
            targetId: typeof data.targetId === "string" ? data.targetId : undefined,
            geologicalContext:
              typeof data.geologicalContext === "string" && data.geologicalContext.trim()
                ? data.geologicalContext.trim()
                : "Surface outcrop sampled during simulated EVA.",
            collectedAt: new Date().toISOString(),
            isSimulated: true,
          };
          const existingSamples = current.simulation.simulatedSamples ?? [];
          return {
            ...current,
            simulation: {
              ...current.simulation,
              simulatedSamples: [...existingSamples, newSample],
            },
            updatedAt: new Date().toISOString(),
          };
        });
      } else if (data.type === "marswalk:telemetry-sync") {
        setMission((current) => ({
          ...current,
          simulation: {
            ...current.simulation,
            currentPosition:
              typeof data.latitude === "number" && Number.isFinite(data.latitude) && data.latitude >= -90 && data.latitude <= 90 && typeof data.longitude === "number" && Number.isFinite(data.longitude) && data.longitude >= -180 && data.longitude <= 360
                ? { latitude: data.latitude, longitude: data.longitude }
                : current.simulation.currentPosition,
            elapsedTimeSeconds:
              typeof data.elapsedTimeSeconds === "number" && Number.isFinite(data.elapsedTimeSeconds) && data.elapsedTimeSeconds >= 0
                ? data.elapsedTimeSeconds
                : current.simulation.elapsedTimeSeconds,
            distanceFromBaseMeters:
              typeof data.distanceFromBaseMeters === "number" && Number.isFinite(data.distanceFromBaseMeters) && data.distanceFromBaseMeters >= 0
                ? data.distanceFromBaseMeters
                : current.simulation.distanceFromBaseMeters,
            totalTraverseMeters:
              typeof data.totalTraverseMeters === "number" && Number.isFinite(data.totalTraverseMeters) && data.totalTraverseMeters >= 0
                ? data.totalTraverseMeters
                : current.simulation.totalTraverseMeters,
            returnedToBase:
              typeof data.returnedToBase === "boolean"
                ? data.returnedToBase
                : current.simulation.returnedToBase,
            suit: data.suit
              ? { ...(current.simulation.suit ?? createDefaultSuitTelemetry()), ...data.suit }
              : current.simulation.suit,
          },
          updatedAt: new Date().toISOString(),
        }));
      }
    }

    window.addEventListener("message", handleSimulatorMessage);
    return () => window.removeEventListener("message", handleSimulatorMessage);
  }, []);

  function updateMission(
    updates: MissionUpdate
  ): void {
    const updatedAt = new Date().toISOString();

    setMission((current) => ({
      ...current,
      ...updates,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt,
    }));
  }

  function updateSimulation(
    updates: Partial<SimulationState>
  ): void {
    const updatedAt = new Date().toISOString();

    setMission((current) => ({
      ...current,
      simulation: {
        ...current.simulation,
        ...updates,
      },
      id: current.id,
      createdAt: current.createdAt,
      updatedAt,
    }));
  }

  function updateTemporal(
    updates: Partial<TemporalState>
  ): void {
    const updatedAt = new Date().toISOString();

    setMission((current) => ({
      ...current,
      temporal: {
        ...current.temporal,
        ...updates,
      },
      id: current.id,
      createdAt: current.createdAt,
      updatedAt,
    }));
  }

  function setRegion(region: MarsRegion | Region | null): void {
    if (!region) {
      updateMission({ region: null });
      return;
    }
    const canonical = getMarsRegionById(region.id) ?? region;
    setMission((current) => {
      const isDifferentRegion = Boolean(
        current.region && current.region.id !== canonical.id
      );
      return {
        ...current,
        region: canonical,
        simulation: isDifferentRegion
          ? {
              ...current.simulation,
              currentPosition: null,
              visitedTargetIds: [],
              simulatedSamples: [],
              distanceFromBaseMeters: 0,
              totalTraverseMeters: 0,
            }
          : current.simulation,
        ...(isDifferentRegion ? {
          selectedDatasets: [], scientificTargets: [],
          knowledgeGaps: [], derivedAnalyses: [], interpretations: [], hypotheses: [],
          candidateRoutes: [], selectedRouteId: null, fieldNotes: [],
        } : {}),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function resetMission(): void {
    const fresh = createInitialMission();
    setMission(fresh);
  }

  return (
    <MissionContext.Provider
      value={{
        mission,
        archivedExpeditions,
        setRegion,
        updateMission,
        updateSimulation,
        updateTemporal,
        resetMission,
        createNewExpedition,
        abandonExpedition,
        loadExpedition,
        loadFeaturedDemo,
      }}
    >
      {children}
    </MissionContext.Provider>
  );
}

export function useMission(): MissionContextValue {
  const context = useContext(MissionContext);

  if (!context) {
    throw new Error(
      "useMission must be used inside MissionProvider"
    );
  }

  return context;
}

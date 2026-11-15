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
  resolveDatasetMetadata,
  toMissionDataset,
} from "../../data/evidenceDatasets";
import { getMarsRegionById } from "../../data/regions";
import type {
  FieldNote,
  MarsEnvironmentConditions,
  MarsRegion,
  Mission,
  Observation,
  Region,
  SimulatedSample,
  SimulationState,
  SuitTelemetry,
  TemporalState,
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
  updateMission: (updates: MissionUpdate) => void;
  updateSimulation: (updates: Partial<SimulationState>) => void;
  updateTemporal: (updates: Partial<TemporalState>) => void;
  setRegion: (region: MarsRegion | Region | null) => void;
  resetMission: () => void;
}

const MISSION_STORAGE_KEY = "mars-explorer-active-mission-v1";

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

const MissionContext =
  createContext<MissionContextValue | null>(null);

export function MissionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [mission, setMission] = useState<Mission>(loadStoredMission);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(mission));
    } catch {
      // Ignore storage quota errors
    }
  }, [mission]);

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
        setMission((current) => {
          const newNote: FieldNote = {
            id: `note-${crypto.randomUUID()}`,
            missionId: current.id,
            content: noteContent,
            coordinates: {
              latitude: Number(data.latitude) || current.region?.coordinates.latitude || 18.4447,
              longitude: Number(data.longitude) || current.region?.coordinates.longitude || 77.4508,
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
              latitude: Number(data.latitude) || current.region?.coordinates.latitude || 18.4447,
              longitude: Number(data.longitude) || current.region?.coordinates.longitude || 77.4508,
            },
            observationDate: current.temporal.selectedDate,
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
        setMission((current) => {
          const newSample: SimulatedSample = {
            id: `sample-${crypto.randomUUID()}`,
            name: data.name.trim() || "Simulated Core Sample",
            sampleType: data.sampleType || "Rock Core",
            coordinates: {
              latitude: Number(data.latitude) || current.region?.coordinates.latitude || 18.4447,
              longitude: Number(data.longitude) || current.region?.coordinates.longitude || 77.4508,
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
              typeof data.latitude === "number" && typeof data.longitude === "number"
                ? { latitude: data.latitude, longitude: data.longitude }
                : current.simulation.currentPosition,
            elapsedTimeSeconds:
              typeof data.elapsedTimeSeconds === "number"
                ? data.elapsedTimeSeconds
                : current.simulation.elapsedTimeSeconds,
            distanceFromBaseMeters:
              typeof data.distanceFromBaseMeters === "number"
                ? data.distanceFromBaseMeters
                : current.simulation.distanceFromBaseMeters,
            totalTraverseMeters:
              typeof data.totalTraverseMeters === "number"
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
              distanceFromBaseMeters: 0,
              totalTraverseMeters: 0,
            }
          : current.simulation,
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
        setRegion,
        updateMission,
        updateSimulation,
        updateTemporal,
        resetMission,
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

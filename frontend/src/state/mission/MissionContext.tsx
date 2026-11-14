
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import type {
  Mission,
  Region,
  SimulationState,
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
  setRegion: (region: Region | null) => void;
}

function getCurrentUTCDate(): string {
  return new Date().toISOString().slice(0, 10);
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

const MissionContext =
  createContext<MissionContextValue | null>(null);

export function MissionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [mission, setMission] = useState<Mission>(
    createInitialMission
  );

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

  function setRegion(region: Region | null): void {
    updateMission({ region });
  }

  return (
    <MissionContext.Provider
      value={{
        mission,
        setRegion,
        updateMission,
        updateSimulation,
        updateTemporal,
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

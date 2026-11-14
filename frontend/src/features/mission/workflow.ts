// frontend/src/features/mission/workflow.ts
// Structured 4-stage expedition workflow:
// STAGE 01 — INVESTIGATE (Scientific Investigation, Evidence Inspector, Knowledge Gaps)
// STAGE 02 — PLAN (Mission Builder, Route Planner)
// STAGE 03 — EXPLORE (Marswalk Simulator)
// STAGE 04 — REVIEW (Mission Review, Expedition Report)

import type { Mission } from "../../types";

export interface WorkflowStep {
  id: string;
  stage: string;
  label: string;
  summary: string;
  path: string | null;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "discover",
    stage: "Discover",
    label: "Open 3D & 2D Explorer",
    summary:
      "Browse Mars on the 3D globe and NASA Mars Trek WMTS layers to select a study region.",
    path: "/explorer",
  },
  {
    id: "investigate",
    stage: "Stage 01 · Investigate",
    label: "Frame investigation",
    summary:
      "Define a scientific question, select orbital datasets, inspect evidence provenance, and record knowledge gaps.",
    path: "/mission/investigate",
  },
  {
    id: "plan",
    stage: "Stage 02 · Plan",
    label: "Build mission & route",
    summary:
      "Configure mission objectives, EVA constraints, and compare candidate traverse routes across the terrain.",
    path: "/mission/builder",
  },
  {
    id: "simulate",
    stage: "Stage 03 · Explore",
    label: "Launch Marswalk EVA",
    summary:
      "Conduct a first-person surface exploration or guided EVA traverse in Jezero Crater with suit telemetry and fieldwork.",
    path: "/mission/simulate",
  },
  {
    id: "review",
    stage: "Stage 04 · Review & Report",
    label: "Review & compile report",
    summary:
      "Synthesize NASA dataset evidence, field observations, simulated samples, and unresolved gaps into a citable report.",
    path: "/mission/review",
  },
];

export type MissionStageGroupId = "investigate" | "plan" | "explore" | "review";

export interface MissionPage {
  id: string;
  path: string;
  label: string;
  shortLabel: string;
  stage: string;
  stageGroupId: MissionStageGroupId;
  stageNumber: string;
  purpose: string;
}

export interface MissionStageGroup {
  id: MissionStageGroupId;
  number: string;
  title: string;
  subtitle: string;
  pages: MissionPage[];
}

export const MISSION_PAGES: MissionPage[] = [
  {
    id: "investigate",
    path: "/mission/investigate",
    label: "Scientific Investigation",
    shortLabel: "Investigation",
    stage: "Stage 01 · Investigate",
    stageGroupId: "investigate",
    stageNumber: "01",
    purpose: "Define your research question, select NASA datasets, and log observations & targets.",
  },
  {
    id: "evidence",
    path: "/mission/evidence",
    label: "Evidence Inspector",
    shortLabel: "Evidence",
    stage: "Stage 01 · Investigate",
    stageGroupId: "investigate",
    stageNumber: "01",
    purpose: "Verify dataset provenance, sample HiRISE DEM elevations, and record interpretations.",
  },
  {
    id: "gaps",
    path: "/mission/gaps",
    label: "Knowledge Gaps",
    shortLabel: "Knowledge Gaps",
    stage: "Stage 01 · Investigate",
    stageGroupId: "investigate",
    stageNumber: "01",
    purpose: "Identify missing coverage and orbital resolution limits that require surface fieldwork.",
  },
  {
    id: "builder",
    path: "/mission/builder",
    label: "Mission Builder",
    shortLabel: "Mission Builder",
    stage: "Stage 02 · Plan",
    stageGroupId: "plan",
    stageNumber: "02",
    purpose: "Configure mission objectives, landing coordinates, duration, equipment, and constraints.",
  },
  {
    id: "route",
    path: "/mission/route",
    label: "Route Planner",
    shortLabel: "Route Planner",
    stage: "Stage 02 · Plan",
    stageGroupId: "plan",
    stageNumber: "02",
    purpose: "Plot traverse waypoints, compare route alternatives, and evaluate terrain profiles.",
  },
  {
    id: "simulate",
    path: "/mission/simulate",
    label: "Marswalk Simulator",
    shortLabel: "Marswalk EVA",
    stage: "Stage 03 · Explore",
    stageGroupId: "explore",
    stageNumber: "03",
    purpose: "Explore Martian terrain in Free Exploration or guided Mission EVA mode with suit systems.",
  },
  {
    id: "review",
    path: "/mission/review",
    label: "Mission Review",
    shortLabel: "Mission Review",
    stage: "Stage 04 · Review",
    stageGroupId: "review",
    stageNumber: "04",
    purpose: "Audit completed objectives, visited targets, field notes, and simulated samples.",
  },
  {
    id: "report",
    path: "/mission/report",
    label: "Expedition Report",
    shortLabel: "Expedition Report",
    stage: "Stage 04 · Review",
    stageGroupId: "review",
    stageNumber: "04",
    purpose: "Compile a structured scientific dossier separating NASA data from simulated EVA records.",
  },
];

export const MISSION_STAGE_GROUPS: MissionStageGroup[] = [
  {
    id: "investigate",
    number: "01",
    title: "Investigate",
    subtitle: "Question, Evidence & Gaps",
    pages: MISSION_PAGES.filter((p) => p.stageGroupId === "investigate"),
  },
  {
    id: "plan",
    number: "02",
    title: "Plan",
    subtitle: "Mission & Traverse Route",
    pages: MISSION_PAGES.filter((p) => p.stageGroupId === "plan"),
  },
  {
    id: "explore",
    number: "03",
    title: "Explore",
    subtitle: "Marswalk Surface EVA",
    pages: MISSION_PAGES.filter((p) => p.stageGroupId === "explore"),
  },
  {
    id: "review",
    number: "04",
    title: "Review",
    subtitle: "Assessment & Dossier",
    pages: MISSION_PAGES.filter((p) => p.stageGroupId === "review"),
  },
];

type DeepReadonlyMission = {
  readonly name: string;
  readonly objective: string;
  readonly question: string;
  readonly region: unknown;
  readonly configuration: unknown;
  readonly selectedDatasets: readonly unknown[];
  readonly selectedObservations: readonly unknown[];
  readonly scientificTargets: readonly unknown[];
  readonly knowledgeGaps: readonly unknown[];
  readonly derivedAnalyses: readonly unknown[];
  readonly interpretations: readonly unknown[];
  readonly candidateRoutes: readonly unknown[];
  readonly selectedRouteId: string | null;
  readonly fieldNotes: readonly unknown[];
  readonly reports: readonly unknown[];
  readonly simulation: {
    readonly visitedTargetIds: readonly string[];
    readonly elapsedTimeSeconds: number;
    readonly returnedToBase?: boolean;
    readonly simulatedSamples?: readonly unknown[];
  };
};

export function isPageCompleted(pageId: string, mission: DeepReadonlyMission): boolean {
  switch (pageId) {
    case "investigate":
      return Boolean(
        mission.region &&
          mission.question.trim().length > 0 &&
          mission.selectedDatasets.length > 0
      );
    case "evidence":
      return (
        mission.selectedObservations.length > 0 &&
        (mission.derivedAnalyses.length > 0 || mission.interpretations.length > 0)
      );
    case "gaps":
      return mission.knowledgeGaps.length > 0;
    case "builder":
      return Boolean(mission.configuration && mission.objective.trim().length > 0);
    case "route":
      return Boolean(mission.selectedRouteId && mission.candidateRoutes.length > 0);
    case "simulate":
      return Boolean(
        mission.simulation.visitedTargetIds.length > 0 ||
          mission.simulation.elapsedTimeSeconds > 10 ||
          (mission.simulation.simulatedSamples && mission.simulation.simulatedSamples.length > 0) ||
          mission.simulation.returnedToBase
      );
    case "review":
      return Boolean(
        mission.fieldNotes.length > 0 || mission.simulation.visitedTargetIds.length > 0
      );
    case "report":
      return mission.reports.length > 0;
    default:
      return false;
  }
}

export function isStageGroupCompleted(
  groupId: MissionStageGroupId,
  mission: DeepReadonlyMission
): boolean {
  const group = MISSION_STAGE_GROUPS.find((g) => g.id === groupId);
  if (!group) return false;
  if (groupId === "investigate") {
    return isPageCompleted("investigate", mission);
  }
  if (groupId === "plan") {
    return isPageCompleted("builder", mission) && isPageCompleted("route", mission);
  }
  if (groupId === "explore") {
    return isPageCompleted("simulate", mission);
  }
  if (groupId === "review") {
    return isPageCompleted("report", mission);
  }
  return false;
}

export function getMissionCompletionPercentage(mission: DeepReadonlyMission): number {
  let completed = 0;
  const checks = [
    Boolean(mission.region),
    Boolean(mission.question.trim()),
    mission.selectedDatasets.length > 0,
    mission.selectedObservations.length > 0,
    mission.scientificTargets.length > 0,
    mission.knowledgeGaps.length > 0,
    Boolean(mission.configuration),
    Boolean(mission.selectedRouteId),
    isPageCompleted("simulate", mission),
    mission.reports.length > 0,
  ];
  for (const c of checks) {
    if (c) completed++;
  }
  return Math.round((completed / checks.length) * 100);
}

export function getMissionStatusLabel(mission: DeepReadonlyMission): string {
  if (mission.reports.length > 0) return "Expedition Report Compiled";
  if (mission.simulation.returnedToBase) return "EVA Complete · Ready for Review";
  if (mission.selectedRouteId) return "Traverse Planned · Ready for Marswalk";
  if (mission.configuration) return "Mission Configured · Plotting Route";
  if (mission.knowledgeGaps.length > 0 || mission.interpretations.length > 0)
    return "Evidence Analyzed · Ready to Plan";
  if (mission.selectedDatasets.length > 0 || mission.question.trim())
    return "Investigation in Progress";
  if (mission.region) return "Region Selected · Frame Question";
  return "New Expedition · Setup Required";
}

export function getNextRecommendedAction(
  mission: DeepReadonlyMission,
  currentPath: string
): { label: string; path: string; reason: string } {
  if (!mission.region || !mission.question.trim() || mission.selectedDatasets.length === 0) {
    return {
      label:
        currentPath === "/mission/investigate"
          ? "Complete Setup Below"
          : "Frame Investigation",
      path: "/mission/investigate",
      reason: "Select a study region, state a research question, and pick NASA datasets.",
    };
  }
  if (mission.selectedObservations.length === 0) {
    return {
      label: "Log First Observation",
      path: "/mission/investigate",
      reason: "Record at least one orbital observation to anchor your evidence record.",
    };
  }
  if (mission.derivedAnalyses.length === 0 && mission.interpretations.length === 0) {
    return {
      label: "Inspect Evidence",
      path: "/mission/evidence",
      reason: "Verify dataset provenance and add a measurement or interpretation.",
    };
  }
  if (mission.knowledgeGaps.length === 0) {
    return {
      label: "Identify Knowledge Gaps",
      path: "/mission/gaps",
      reason: "Document what orbital data cannot resolve so surface EVA can target it.",
    };
  }
  if (!mission.configuration || !mission.objective.trim()) {
    return {
      label: "Configure Mission Builder",
      path: "/mission/builder",
      reason: "Set landing coordinates, mission duration, and EVA constraints.",
    };
  }
  if (!mission.selectedRouteId) {
    return {
      label: "Plot Traverse Route",
      path: "/mission/route",
      reason: "Connect your landing site and scientific targets on the regional map.",
    };
  }
  if (!isPageCompleted("simulate", mission)) {
    return {
      label: "Launch Marswalk EVA",
      path: "/mission/simulate",
      reason: "Walk the planned traverse, monitor suit systems, and log surface fieldwork.",
    };
  }
  if (mission.reports.length === 0) {
    return {
      label:
        currentPath === "/mission/review"
          ? "Compile Expedition Report"
          : "Review & Generate Report",
      path: currentPath === "/mission/review" ? "/mission/report" : "/mission/review",
      reason: "Review mission outcomes and generate your final citable dossier.",
    };
  }
  return {
    label: "View Expedition Report",
    path: "/mission/report",
    reason: "Your expedition dossier is compiled and ready to print or update.",
  };
}

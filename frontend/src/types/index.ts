
/* =========================================================
   GEOGRAPHIC TYPES
   ========================================================= */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Region {
  id: string;
  name: string;
  coordinates: Coordinates;
  description: string;
}

/* =========================================================
   SCIENTIFIC DATA AND EVIDENCE
   ========================================================= */

export interface EvidenceProvenance {
  source: string;
  sourceId?: string;
  sourceUrl?: string;
  processingMethod?: string;
  processingDate?: string;
  limitations?: string[];
}

export interface Dataset {
  id: string;
  name: string;
  source: string;
  description: string;
  resolutionMeters?: number;
  available: boolean;
  provenance?: EvidenceProvenance;
}

export interface Observation {
  id: string;
  datasetId: string;
  name: string;
  coordinates?: Coordinates;
  observationDate?: string;
  source: string;
  description?: string;
  provenance?: EvidenceProvenance;
}

export interface ScientificTarget {
  id: string;
  name: string;
  coordinates: Coordinates;
  description: string;
  observationIds: string[];
}

export interface KnowledgeGap {
  id: string;
  description: string;
  reason: string;
  relatedDatasetIds: string[];
  relatedObservationIds: string[];
  relatedTargetId?: string;
  significance?: string;
}

/* =========================================================
   EVIDENCE INTERPRETATION
   ========================================================= */

export interface DerivedAnalysis {
  id: string;
  name: string;
  description: string;
  inputObservationIds: string[];
  method: string;
  value?: number;
  unit?: string;
  limitations: string[];
}

export interface ScientificInterpretation {
  id: string;
  description: string;
  supportingEvidenceIds: string[];
  limitations: string[];
  generatedBy: "AI" | "User";
}

export interface UserHypothesis {
  id: string;
  statement: string;
  relatedEvidenceIds: string[];
  createdAt: string;
}

/* =========================================================
   MISSION CONFIGURATION
   ========================================================= */

export interface TerrainPreferences {
  preferredSlopeDegrees?: number;
  preferredRoughness?: number;
  avoidKnownObstacles: boolean;
}

export interface MissionConfiguration {
  startingLocation: Coordinates;
  scientificTargetIds: string[];
  missionDurationSols: number;
  hypotheticalEVADurationHours: number;
  terrainPreferences: TerrainPreferences;
  sciencePriorities: string[];
  explorationStrategy: string;
  equipment?: string[];
  missionConstraints?: string[];
  requireReturnToBase?: boolean;
}

/* =========================================================
   ROUTE PLANNING
   ========================================================= */

export interface Waypoint {
  id: string;
  coordinates: Coordinates;
  targetId?: string;
  name?: string;
  visited: boolean;
}

export interface RouteTerrainMetrics {
  slopeDistribution?: Record<string, number>;
  averageSlopeDegrees?: number;
  maximumSlopeDegrees?: number;
  averageRoughness?: number;
  knownObstacles?: string[];
  dataCoverage?: number;
  uncertaintyNotes: string[];
  assumptions: string[];
}

export interface Route {
  id: string;
  name: string;
  waypoints: Waypoint[];
  distanceMeters?: number;
  elevationGainMeters?: number;
  elevationLossMeters?: number;
  terrainMetrics?: RouteTerrainMetrics;
  reachedTargetIds: string[];
  returnRouteIncluded?: boolean;
  returnDistanceMeters?: number;
  estimatedDurationHours?: number;
  measurementSource?:
    | "HiRISE DEM + Spherical Geometry"
    | "Spherical Geometry (Orbital Estimate)";
}

/* =========================================================
   SIMULATION STATE & ASTRONAUT SYSTEMS
   ========================================================= */

export interface SimulatedSample {
  id: string;
  name: string;
  sampleType: "Regolith" | "Rock Core" | "Float Rock" | "Atmospheric Gas";
  coordinates: Coordinates;
  targetId?: string;
  geologicalContext: string;
  collectedAt: string;
  isSimulated: true;
}

export interface SuitTelemetry {
  oxygenPercent: number;
  suitPressureKpa: number;
  co2ScrubberPercent: number;
  suitTemperatureCelsius: number;
  ventilationNominal: boolean;
  hydrationPercent: number;
  batteryPercent: number;
  commsStatus: "Nominal" | "Degraded" | "Relay Only";
  dustExposureIndex: number;
  readinessVerified: boolean;
}

export interface MarsEnvironmentConditions {
  surfaceTempCelsius: number;
  atmosphericPressurePa: number;
  dustOpticalDepthTau: number;
  visibilityKm: number;
  radiationDoseRateMicroSvPerHour: number;
  windSpeedMetersPerSec: number;
  contingencyActive?: string | null;
}

export interface SimulationState {
  currentPosition: Coordinates | null;
  visitedTargetIds: string[];
  elapsedTimeSeconds: number;
  progressPercentage: number;
  isActive: boolean;
  mode?: "free" | "mission";
  returnedToBase?: boolean;
  completedAt?: string | null;
  distanceFromBaseMeters?: number;
  totalTraverseMeters?: number;
  simulatedSamples?: SimulatedSample[];
  suit?: SuitTelemetry;
  environment?: MarsEnvironmentConditions;
}

/* =========================================================
   TEMPORAL STATE
   ========================================================= */

export type TemporalMode = "past" | "present" | "future";

export interface TemporalState {
  mode: TemporalMode;

  /** Earth calendar date, stored as YYYY-MM-DD. */
  selectedDate: string;

  /** Provisional future simulation horizon, measured in Martian sols. */
  futureSols: number;
}

/* =========================================================
   MISSION STATE
   ========================================================= */

export interface Mission {
  id: string;
  name: string;
  objective: string;
  question: string;

  region: Region | null;
  configuration: MissionConfiguration | null;

  selectedDatasets: Dataset[];
  selectedObservations: Observation[];
  scientificTargets: ScientificTarget[];
  knowledgeGaps: KnowledgeGap[];

  derivedAnalyses: DerivedAnalysis[];
  interpretations: ScientificInterpretation[];
  hypotheses: UserHypothesis[];

  candidateRoutes: Route[];
  selectedRouteId: string | null;

  simulation: SimulationState;
  temporal: TemporalState;

  fieldNotes: FieldNote[];
  reports: ExpeditionReport[];

  createdAt: string;
  updatedAt: string;
}

/* =========================================================
   FIELD NOTES
   ========================================================= */

export interface FieldNote {
  id: string;
  missionId: string;
  content: string;
  coordinates: Coordinates;
  relatedTargetId?: string;
  createdAt: string;
}

/* =========================================================
   EXPEDITION REPORT
   ========================================================= */

export interface ExpeditionReport {
  id: string;
  missionId: string;
  title: string;
  summary: string;

  datasetIds: string[];
  observationIds: string[];
  scientificTargetIds: string[];

  candidateRouteIds: string[];
  selectedRouteId?: string;

  fieldNotes: FieldNote[];
  knowledgeGaps: KnowledgeGap[];
  limitations: string[];
  conclusions: string[];
  recommendedInvestigations: string[];
  simulatedSampleIds?: string[];

  generatedAt: string;
}

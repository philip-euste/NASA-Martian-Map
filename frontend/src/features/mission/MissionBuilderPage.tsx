// frontend/src/features/mission/MissionBuilderPage.tsx
// Mission Builder (Phase 4): progressive disclosure separating Essential
// Mission Setup from Advanced Equipment, Terrain & Operational Constraints.
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  MapPin,
  ShieldAlert,
  Sliders,
  Target,
  Wrench,
} from "lucide-react";
import {
  DataField,
  EmptyState,
  SectionHeading,
  formatCoordinates,
} from "../../components/ui";
import { EXPLORATION_SITES } from "../../data/explorationSites";
import { useMission } from "../../state/mission/MissionContext";
import type { MissionConfiguration } from "../../types";
import { isWithinBounds } from "../../simulator/shared/environment";
import { resolveSimulatorEnvironment } from "../../simulator/environments/catalog";
import MissionLayout from "./MissionLayout";
import { buildRegion } from "./missionHelpers";

const AVAILABLE_EQUIPMENT: {
  id: string;
  name: string;
  purpose: string;
}[] = [
  {
    id: "Core Drill & Sample Tubes",
    name: "Core Drill & Sample Tubes",
    purpose: "Collects simulated rock cores and regolith samples at targets.",
  },
  {
    id: "Field UV/Raman Spectrometer",
    name: "Field UV/Raman Spectrometer",
    purpose: "Identifies hydrated minerals, carbonates, and organic compounds.",
  },
  {
    id: "Stereo Mast / Field Camera",
    name: "Stereo Mast / Field Camera",
    purpose: "Captures high-resolution outcrop stratigraphy and textures.",
  },
  {
    id: "MEDA-Class Env & Radiation Sensor",
    name: "MEDA-Class Env & Radiation Sensor",
    purpose: "Monitors surface temperature, pressure, dust opacity, and radiation.",
  },
  {
    id: "Laser Rangefinder & Inclinometer",
    name: "Laser Rangefinder & Inclinometer",
    purpose: "Measures local scarp slopes and waypoint distances during EVA.",
  },
];

const DEFAULT_CONSTRAINTS = [
  "Return to Habitat / Lander required before suit O₂ or battery reaches 20%",
  "Maintain UHF relay link with rover/habitat base station",
  "Avoid slopes exceeding preferred threshold without visual hazard check",
];

export default function MissionBuilderPage() {
  const { mission, setRegion, updateMission } = useMission();
  const navigate = useNavigate();

  const existing = mission.configuration;
  const defaultStart =
    existing?.startingLocation ??
    mission.region?.coordinates ?? {
      latitude: EXPLORATION_SITES[0].latitude,
      longitude: EXPLORATION_SITES[0].longitude,
    };

  const [startLat, setStartLat] = useState(String(defaultStart.latitude));
  const [startLon, setStartLon] = useState(String(defaultStart.longitude));
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>(
    existing?.scientificTargetIds
      ? [...existing.scientificTargetIds]
      : mission.scientificTargets.map((t) => t.id)
  );
  const [durationSols, setDurationSols] = useState(
    String(existing?.missionDurationSols ?? 14)
  );
  const [evaHours, setEvaHours] = useState(
    String(existing?.hypotheticalEVADurationHours ?? 6)
  );
  const [traverseSpeedKmh, setTraverseSpeedKmh] = useState(String(existing?.nominalTraverseSpeedKmh ?? 2.2));
  const [astronautWeightKg, setAstronautWeightKg] = useState(String(existing?.astronautWeightKg ?? ""));
  const [astronautHeightCm, setAstronautHeightCm] = useState(String(existing?.astronautHeightCm ?? ""));
  const [oxygenConsumptionRate, setOxygenConsumptionRate] = useState(String(existing?.oxygenConsumptionLitersPerHour ?? ""));
  const [requireReturnToBase, setRequireReturnToBase] = useState(
    existing?.requireReturnToBase ?? true
  );

  // Advanced configuration options (placed inside progressive disclosure section)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxSlope, setMaxSlope] = useState(
    existing?.terrainPreferences.preferredSlopeDegrees !== undefined
      ? String(existing.terrainPreferences.preferredSlopeDegrees)
      : "15"
  );
  const [roughness, setRoughness] = useState(
    existing?.terrainPreferences.preferredRoughness !== undefined
      ? String(existing.terrainPreferences.preferredRoughness)
      : "0.35"
  );
  const [avoidObstacles, setAvoidObstacles] = useState(
    existing?.terrainPreferences.avoidKnownObstacles ?? true
  );
  const [prioritiesText, setPrioritiesText] = useState(
    existing?.sciencePriorities.join(", ") ??
      "Stratigraphy, Hydrated minerals, Biosignature preservation"
  );
  const [strategy, setStrategy] = useState(
    existing?.explorationStrategy ??
      "Progressive traverse from landing zone across delta front with contact science at each waypoint."
  );
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(
    existing?.equipment
      ? [...existing.equipment]
      : [
          "Core Drill & Sample Tubes",
          "Field UV/Raman Spectrometer",
          "Stereo Mast / Field Camera",
          "MEDA-Class Env & Radiation Sensor",
        ]
  );
  const [constraintsText, setConstraintsText] = useState(
    existing?.missionConstraints?.join("\n") ?? DEFAULT_CONSTRAINTS.join("\n")
  );
  const [savedNotice, setSavedNotice] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const activeEnvironment = resolveSimulatorEnvironment(mission.region?.id).environment;

  function toggleTargetId(id: string): void {
    setSelectedTargetIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleEquipment(id: string): void {
    setSelectedEquipment((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function applyConfiguration(): MissionConfiguration | null {
    const lat = Number(startLat);
    const lon = Number(startLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 360) {
      setValidationError("Enter finite latitude and longitude values within geographic limits.");
      return null;
    }
    if (activeEnvironment && !isWithinBounds(activeEnvironment.bounds, { latitude: lat, longitude: lon })) {
      setValidationError(`Starting coordinates are outside the ${activeEnvironment.displayName} DEM coverage.`);
      return null;
    }
    const optionalValues = [astronautWeightKg, astronautHeightCm, oxygenConsumptionRate].filter((value) => value.trim()).map(Number);
    if (!Number.isFinite(Number(traverseSpeedKmh)) || Number(traverseSpeedKmh) <= 0 || optionalValues.some((value) => !Number.isFinite(value) || value <= 0)) {
      setValidationError("Traverse speed and any supplied astronaut planning values must be positive finite numbers.");
      return null;
    }
    setValidationError(null);

    const parsedSlope = maxSlope.trim() !== "" ? Number(maxSlope) : undefined;
    const parsedRough =
      roughness.trim() !== "" ? Number(roughness) : undefined;

    const config: MissionConfiguration = {
      startingLocation: { latitude: lat, longitude: lon },
      scientificTargetIds: selectedTargetIds,
      missionDurationSols: Math.max(1, Number(durationSols) || 1),
      hypotheticalEVADurationHours: Math.max(1, Number(evaHours) || 1),
      nominalTraverseSpeedKmh: Number(traverseSpeedKmh),
      astronautWeightKg: optionalPositive(astronautWeightKg),
      astronautHeightCm: optionalPositive(astronautHeightCm),
      oxygenConsumptionLitersPerHour: optionalPositive(oxygenConsumptionRate),
      requireReturnToBase,
      terrainPreferences: {
        preferredSlopeDegrees: Number.isFinite(parsedSlope)
          ? parsedSlope
          : undefined,
        preferredRoughness: Number.isFinite(parsedRough)
          ? parsedRough
          : undefined,
        avoidKnownObstacles: avoidObstacles,
      },
      sciencePriorities: prioritiesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      explorationStrategy: strategy.trim(),
      equipment: selectedEquipment,
      missionConstraints: constraintsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    updateMission({ configuration: config });
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2500);
    return config;
  }

  function optionalPositive(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  function handleSubmitAndContinue(event: FormEvent): void {
    event.preventDefault();
    const saved = applyConfiguration();
    if (saved) {
      navigate("/mission/route");
    }
  }

  return (
    <MissionLayout
      stage="Stage 02 · Plan"
      title="Mission Builder"
      subtitle="Configure your surface expedition: define the mission objective, select your landing/habitat base coordinates, assign scientific targets, and set operational parameters."
      nextStepHint="Next: Proceed to the Route Planner to connect your starting habitat and assigned targets into candidate traverse routes."
      actions={
        <>
          <Link to="/mission/gaps" className="mx-btn mx-btn--secondary">
            <ArrowLeft size={15} aria-hidden="true" />
            Knowledge Gaps
          </Link>
          <Link to="/mission/route" className="mx-btn mx-btn--primary">
            Route Planner
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </>
      }
    >
      <form
        onSubmit={handleSubmitAndContinue}
        className="mx-mission-builder grid gap-6 lg:grid-cols-12 lg:gap-8"
      >
        <nav className="mx-mission-builder__steps lg:col-span-12" aria-label="Mission builder sections">
          {[
            ["mission-objective-section", "01", "Objective", "Purpose and duration"],
            ["mission-start-section", "02", "Starting point", "Region and habitat"],
            ["mission-targets-section", "03", "Targets", "Science destinations"],
            ["mission-advanced-section", "04", "Parameters", "Equipment and constraints"],
          ].map(([id, number, label, detail]) => (
            <a key={id} href={`#${id}`} className="mx-mission-builder__step">
              <span className="mx-mission-builder__step-number">{number}</span>
              <span><strong>{label}</strong><small>{detail}</small></span>
            </a>
          ))}
        </nav>
        {/* Left 7 cols: Essential Setup first, then Progressive Disclosure for Advanced Options */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          {/* 1. Basic Mission Identity & Objective */}
          <section id="mission-objective-section" className="mx-panel p-5 sm:p-6" aria-label="Mission objective">
            <SectionHeading
              eyebrow="Step 01 · Core Mission Definition"
              title="Expedition Identity & Objective"
              icon={<Compass size={18} />}
            />

            <p className="mx-body m-0 mb-4 text-xs">
              State what this surface expedition aims to accomplish and how it
              addresses the research question and knowledge gaps from Stage 01.
            </p>

            <div className="mb-4">
              <label htmlFor="mission-name-input" className="mx-label">
                Mission / Expedition Name
              </label>
              <input
                id="mission-name-input"
                type="text"
                className="mx-input"
                value={mission.name}
                onChange={(e) => updateMission({ name: e.target.value })}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="mission-objective" className="mx-label">
                Primary Mission Objective
              </label>
              <textarea
                id="mission-objective"
                className="mx-input"
                placeholder="e.g., Sample basal and topset beds along the western Jezero delta front to constrain lake longevity and organic preservation potential."
                value={mission.objective}
                onChange={(e) => updateMission({ objective: e.target.value })}
              />
              <p className="mx-hint">
                Displayed in the Marswalk EVA HUD and evaluated in your final
                Mission Review.
              </p>
            </div>

            <div className="mx-mission-builder__subsection">
              <div className="mb-4">
                <h3 className="mx-heading m-0 text-sm">Time &amp; traverse assumptions</h3>
                <p className="mx-hint m-0 mt-1">Editable planning inputs. Route duration and oxygen are estimates.</p>
              </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <label htmlFor="duration-sols" className="mx-label">
                  Expedition Duration (Martian Sols)
                </label>
                <input
                  id="duration-sols"
                  type="number"
                  min="1"
                  required
                  className="mx-input"
                  value={durationSols}
                  onChange={(e) => setDurationSols(e.target.value)}
                />
                <p className="mx-hint">
                  Total surface campaign length (1 Sol ≈ 24h 39m).
                </p>
              </div>

              <div>
                <label htmlFor="eva-hours" className="mx-label">
                  Max EVA Window per Traverse (Hours)
                </label>
                <input
                  id="eva-hours"
                  type="number"
                  min="1"
                  max="12"
                  step="0.5"
                  required
                  className="mx-input"
                  value={evaHours}
                  onChange={(e) => setEvaHours(e.target.value)}
                />
                <p className="mx-hint">
                  Constrains suit life-support consumables and maximum walk
                  radius.
                </p>
              </div>
              <div>
                <label htmlFor="traverse-speed" className="mx-label">Nominal walking speed (km/hour)</label>
                <input id="traverse-speed" type="number" min="0.1" step="0.1" required className="mx-input" value={traverseSpeedKmh} onChange={(e) => setTraverseSpeedKmh(e.target.value)} />
                <p className="mx-hint">Used for a straight-line planning estimate; slope, stops, and terrain resistance are not modeled.</p>
              </div>
            </div>
            </div>
            <div className="mx-mission-builder__subsection mt-4">
              <h3 className="mx-label">Optional astronaut planning inputs</h3>
              <p className="mx-hint">User-entered values only; these do not model suit physiology. Oxygen reserve is estimated from the entered rate and nominal traverse time.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="mx-label">Weight (kg)<input type="number" min="1" step="any" className="mx-input mt-1" value={astronautWeightKg} onChange={(e) => setAstronautWeightKg(e.target.value)} /></label>
                <label className="mx-label">Height (cm)<input type="number" min="1" step="any" className="mx-input mt-1" value={astronautHeightCm} onChange={(e) => setAstronautHeightCm(e.target.value)} /></label>
                <label className="mx-label">O₂ use (L/hour)<input type="number" min="0.1" step="any" className="mx-input mt-1" value={oxygenConsumptionRate} onChange={(e) => setOxygenConsumptionRate(e.target.value)} /></label>
              </div>
            </div>
          </section>

          {/* 2. Region & Starting Habitat / Landing Location */}
          <section id="mission-start-section" className="mx-panel p-5 sm:p-6" aria-label="Starting location">
            <SectionHeading
              eyebrow="Step 02 · Insertion & Habitat Base"
              title="Region & Starting Coordinates"
              icon={<MapPin size={18} />}
            />

            <p className="mx-body m-0 mb-4 text-xs">
              Select the landing site or surface habitat coordinates where the
              astronaut deploys from and returns to at the end of the EVA.
            </p>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="mx-eyebrow mr-1">Landing site presets:</span>
              {EXPLORATION_SITES.map((site) => {
                const active = mission.region?.id === site.id;
                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => {
                      setStartLat(String(site.latitude));
                      setStartLon(String(site.longitude));
                      setRegion(
                        buildRegion(
                          site.id,
                          site.name,
                          {
                            latitude: site.latitude,
                            longitude: site.longitude,
                          },
                          site.description
                        )
                      );
                    }}
                    className={`mx-chip ${active ? "mx-chip--active" : ""}`}
                  >
                    {site.name}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="start-lat" className="mx-label">
                  Starting latitude (°)
                </label>
                <input
                  id="start-lat"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  required
                  className="mx-input"
                  value={startLat}
                  onChange={(e) => setStartLat(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="start-lon" className="mx-label">
                  Starting longitude (°)
                </label>
                <input
                  id="start-lon"
                  type="number"
                  step="any"
                  min="-180"
                  max="360"
                  required
                  className="mx-input"
                  value={startLon}
                  onChange={(e) => setStartLon(e.target.value)}
                />
              </div>
            </div>
            {validationError && <p className="mx-alert mx-alert--danger mt-3" role="alert">{validationError}</p>}

            <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-lg border border-mx-border bg-mx-bg p-3 text-xs text-mx-text">
              <input
                type="checkbox"
                className="mx-checkbox"
                checked={requireReturnToBase}
                onChange={(e) => setRequireReturnToBase(e.target.checked)}
              />
              <div>
                <strong className="block">
                  Require Return-to-Habitat / Rover Base Objective
                </strong>
                <span className="text-mx-muted">
                  Includes return traverse considerations in Route Planner and
                  requires returning to the starting beacon in Marswalk Mission
                  Mode.
                </span>
              </div>
            </label>
          </section>

          {/* 3. Assigned Scientific Targets */}
          <section id="mission-targets-section" className="mx-panel p-5 sm:p-6" aria-label="Target selection">
            <SectionHeading
              eyebrow={`Step 03 · Assigned Targets (${selectedTargetIds.length} / ${mission.scientificTargets.length})`}
              title="Scientific Targets Included in Expedition"
              icon={<Target size={18} />}
              action={
                <Link
                  to="/mission/investigate"
                  className="mx-btn mx-btn--ghost mx-btn--sm"
                >
                  + Add / Manage Targets →
                </Link>
              }
            />

            <p className="mx-body m-0 mb-4 text-xs">
              Choose which scientific targets from your investigation will be
              visited along this expedition’s route.
            </p>

            {mission.scientificTargets.length === 0 ? (
              <EmptyState compact title="No scientific targets defined yet">
                Add targets in the Scientific Investigation workspace or on the
                2D Mars Map to include them in this mission configuration.
              </EmptyState>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {mission.scientificTargets.map((target) => {
                  const checked = selectedTargetIds.includes(target.id);
                  const linkedGaps = mission.knowledgeGaps.filter(
                    (g) => g.relatedTargetId === target.id
                  ).length;

                  return (
                    <label
                      key={target.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition ${
                        checked
                          ? "border-mx-accent bg-mx-panel-2"
                          : "border-mx-border bg-mx-bg"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mx-checkbox mt-0.5"
                        checked={checked}
                        onChange={() => toggleTargetId(target.id)}
                      />
                      <div>
                        <span className="block font-display text-sm font-semibold text-mx-text">
                          {target.name}
                        </span>
                        <span className="mx-mono block text-[11px] text-mx-accent">
                          {formatCoordinates(
                            target.coordinates.latitude,
                            target.coordinates.longitude
                          )}
                        </span>
                        <span className="mx-body mt-1 block text-xs">
                          {target.description}
                        </span>
                        {linkedGaps > 0 && (
                          <span className="mx-badge mx-badge--accent mt-1.5">
                            Addresses {linkedGaps} knowledge gap(s)
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          {/* 4. Progressive Disclosure: Advanced Equipment, Terrain & Constraints */}
          <section id="mission-advanced-section" className="mx-panel p-5 sm:p-6" aria-label="Advanced mission parameters">
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              aria-expanded={showAdvanced}
            className="flex w-full flex-wrap items-center justify-between gap-4 text-left"
            >
              <div>
                <span className="mx-eyebrow mx-eyebrow--accent">
                  Step 04 · Advanced Configuration (Optional)
                </span>
                <h2 className="mx-heading m-0 mt-1 flex items-center gap-2 text-lg">
                  <Sliders size={18} className="text-mx-accent" />
                  Scientific Equipment, Terrain Thresholds &amp; Constraints
                </h2>
                <p className="mx-body m-0 mt-1 text-xs">
                  Pre-configured with standard Mars surface EVA defaults (
                  {selectedEquipment.length} instruments, {maxSlope}° max slope).
                  Expand to customize.
                </p>
              </div>
              <span className="mx-btn mx-btn--secondary mx-btn--sm shrink-0">
                {showAdvanced ? (
                  <>
                    Hide <ChevronUp size={14} />
                  </>
                ) : (
                  <>
                    Configure <ChevronDown size={14} />
                  </>
                )}
              </span>
            </button>

            {showAdvanced && (
              <div className="mt-6 flex flex-col gap-6 border-t border-mx-border pt-5">
                {/* Equipment Loadout */}
                <div>
                  <h3 className="mx-heading m-0 mb-2 flex items-center gap-2 text-sm">
                    <Wrench size={15} className="text-mx-accent" />
                    EVA Scientific Equipment Loadout
                  </h3>
                  <p className="mx-body m-0 mb-3 text-xs">
                    Select portable instruments carried by the astronaut during
                    Marswalk fieldwork.
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {AVAILABLE_EQUIPMENT.map((item) => {
                      const active = selectedEquipment.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-xs transition ${
                            active
                              ? "border-mx-accent bg-mx-panel-2"
                              : "border-mx-border bg-mx-bg"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mx-checkbox mt-0.5"
                            checked={active}
                            onChange={() => toggleEquipment(item.id)}
                          />
                          <div>
                            <strong className="block text-mx-text">
                              {item.name}
                            </strong>
                            <span className="text-mx-muted">{item.purpose}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Terrain Preferences */}
                <div>
                  <h3 className="mx-heading m-0 mb-2 text-sm">
                    Terrain &amp; Slope Preferences
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="pref-slope" className="mx-label">
                        Preferred max slope (°)
                      </label>
                      <input
                        id="pref-slope"
                        type="number"
                        min="0"
                        max="45"
                        step="0.5"
                        className="mx-input"
                        value={maxSlope}
                        onChange={(e) => setMaxSlope(e.target.value)}
                      />
                      <p className="mx-hint">
                        Slopes above ~15° increase astronaut metabolic exertion
                        and slip risk.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="pref-roughness" className="mx-label">
                        Preferred max surface roughness index (0–1)
                      </label>
                      <input
                        id="pref-roughness"
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        className="mx-input"
                        value={roughness}
                        onChange={(e) => setRoughness(e.target.value)}
                      />
                      <p className="mx-hint">
                        MOLA/HiRISE roughness threshold for boulder fields.
                      </p>
                    </div>
                  </div>

                  <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-xs text-mx-text">
                    <input
                      type="checkbox"
                      className="mx-checkbox"
                      checked={avoidObstacles}
                      onChange={(e) => setAvoidObstacles(e.target.checked)}
                    />
                    Flag scarps, boulder fields, and steep dune slip-faces for manual review
                  </label>
                  <p className="mx-hint">Candidate routes still connect waypoints in straight lines; automated obstacle avoidance is not implemented.</p>
                </div>

                {/* Exploration Strategy & Priorities */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="science-priorities" className="mx-label">
                      Science priorities (comma-separated)
                    </label>
                    <input
                      id="science-priorities"
                      type="text"
                      className="mx-input"
                      value={prioritiesText}
                      onChange={(e) => setPrioritiesText(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="mission-strategy" className="mx-label">
                      Exploration strategy
                    </label>
                    <input
                      id="mission-strategy"
                      type="text"
                      className="mx-input"
                      value={strategy}
                      onChange={(e) => setStrategy(e.target.value)}
                    />
                  </div>
                </div>

                {/* Operational Constraints */}
                <div>
                  <label
                    htmlFor="mission-constraints"
                    className="mx-label flex items-center gap-1.5"
                  >
                    <ShieldAlert size={14} className="text-mx-accent" />
                    Operational &amp; Safety Constraints (one per line)
                  </label>
                  <textarea
                    id="mission-constraints"
                    className="mx-input"
                    value={constraintsText}
                    onChange={(e) => setConstraintsText(e.target.value)}
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Live summary stays alongside editable inputs on wide screens. */}
        <div className="lg:col-span-4">
          <aside
            className="mx-panel mx-mission-builder__summary p-5 sm:p-6 lg:sticky lg:top-44"
            aria-label="Mission summary"
          >
            <span className="mx-eyebrow mx-eyebrow--accent">
              Stage 02 · Expedition Plan Summary
            </span>
            <h2 className="mx-display m-0 mt-2 text-2xl">{mission.name}</h2>
            <p className="mx-body m-0 mt-2 text-[13px]">
              {mission.objective || "No primary objective entered yet."}
            </p>
            <p className="mx-mission-builder__summary-note">Live summary · save to apply these settings to the route planner</p>

            <div className="mx-mission-builder__summary-grid">
              <DataField
                label="Study Region"
                value={mission.region?.name}
                fallback="Not selected"
              />
              <DataField
                label="Habitat / Start Base"
                value={
                  Number.isFinite(Number(startLat)) &&
                  Number.isFinite(Number(startLon))
                    ? formatCoordinates(Number(startLat), Number(startLon))
                    : undefined
                }
              />
              <DataField
                label="Campaign Duration"
                value={`${durationSols || "—"} Sols (${evaHours || "—"} h/Sol)`}
              />
              <DataField
                label="Assigned Targets"
                value={`${selectedTargetIds.length} of ${mission.scientificTargets.length} target(s)`}
              />
              <DataField
                label="EVA Equipment"
                value={`${selectedEquipment.length} instrument(s)`}
              />
              <DataField
                label="Return to Base"
                value={
                  requireReturnToBase ? "Required (Loop)" : "One-Way Traverse"
                }
              />
            </div>

            {savedNotice && (
              <p className="mx-alert mb-4 items-center text-mx-success">
                <Check size={15} aria-hidden="true" />
                Mission configuration saved to shared mission record.
              </p>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                type="submit"
                className="mx-btn mx-btn--primary mx-btn--block min-h-11"
              >
                Save &amp; Continue to Route Planner
                <ArrowRight size={16} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={applyConfiguration}
                className="mx-btn mx-btn--secondary mx-btn--block"
              >
                Save Configuration Only
              </button>
            </div>
          </aside>
        </div>
      </form>
    </MissionLayout>
  );
}

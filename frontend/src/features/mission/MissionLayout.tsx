// frontend/src/features/mission/MissionLayout.tsx
// Shared layout header, Mission Overview drawer, and 4-stage grouped workflow
// navigation for all mission workspace screens.
import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Edit3,
  MapPin,
  Sparkles,
} from "lucide-react";
import AppLayout from "../../components/layout/AppLayout";
import { DataField, formatCoordinates } from "../../components/ui";
import { useMission } from "../../state/mission/MissionContext";
import {
  MISSION_PAGES,
  MISSION_STAGE_GROUPS,
  getMissionCompletionPercentage,
  getMissionStatusLabel,
  getNextRecommendedAction,
  isPageCompleted,
  isStageGroupCompleted,
} from "./workflow";

interface MissionLayoutProps {
  title: string;
  stage: string;
  subtitle?: string;
  nextStepHint?: string;
  actions?: ReactNode;
  /** Fullscreen viewport mode for immersive 3D tools (Marswalk EVA). */
  fullscreenCanvas?: boolean;
  children: ReactNode;
}

export default function MissionLayout({
  title,
  stage,
  subtitle,
  nextStepHint,
  actions,
  fullscreenCanvas = false,
  children,
}: MissionLayoutProps) {
  const { mission, updateMission } = useMission();
  const location = useLocation();
  const [overviewOpen, setOverviewOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);

  const currentPage =
    MISSION_PAGES.find((p) => location.pathname.startsWith(p.path)) ??
    MISSION_PAGES[0];

  const completionPct = getMissionCompletionPercentage(mission);
  const statusLabel = getMissionStatusLabel(mission);
  const nextAction = getNextRecommendedAction(mission, location.pathname);

  const activeGroupIndex = MISSION_STAGE_GROUPS.findIndex(
    (g) => g.id === currentPage.stageGroupId
  );

  if (fullscreenCanvas) {
    return (
      <AppLayout fullscreen theme={false}>
        <div className="flex h-full w-full flex-col overflow-hidden bg-[#0c0908]">
          {/* Ultra-compact persistent stage & mission bar for fullscreen Marswalk EVA */}
          <div className="mx-no-print z-[950] flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-mx-border bg-mx-bg/95 px-4 py-1.5 backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mx-eyebrow mx-eyebrow--accent hidden sm:inline">
                {stage}
              </span>
              <span className="font-display text-xs font-semibold uppercase tracking-wider text-mx-text">
                {title}
              </span>
              <span className="hidden text-mx-border md:inline">|</span>
              <nav
                aria-label="Compact mission stages"
                className="hidden items-center gap-1 md:flex"
              >
                {MISSION_STAGE_GROUPS.map((group) => {
                  const isCurrentGroup = group.id === currentPage.stageGroupId;
                  const isGroupDone = isStageGroupCompleted(group.id, mission);
                  const firstPage = group.pages[0];
                  return (
                    <Link
                      key={group.id}
                      to={firstPage.path}
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] no-underline transition ${
                        isCurrentGroup
                          ? "border border-mx-accent/60 bg-mx-accent/20 font-semibold text-mx-text"
                          : isGroupDone
                            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                            : "border border-transparent text-mx-muted hover:bg-mx-panel hover:text-mx-text"
                      }`}
                      title={`Stage ${group.number}: ${group.title} — ${group.subtitle}`}
                    >
                      {isGroupDone ? (
                        <Check size={11} className="text-emerald-400" />
                      ) : (
                        <span className="mx-mono text-[10px] opacity-75">
                          {group.number}
                        </span>
                      )}
                      <span>{group.title}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="hidden items-center gap-2 rounded border border-mx-border bg-mx-panel px-2.5 py-0.5 sm:flex"
                title="Overall mission workflow progress"
              >
                <span className="mx-mono text-[10px] text-mx-muted">
                  Mission
                </span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-mx-panel-2">
                  <div
                    className="h-full rounded-full bg-mx-accent transition-all duration-300"
                    style={{ width: `${Math.max(4, completionPct)}%` }}
                  />
                </div>
                <span className="mx-mono text-[10px] font-semibold text-mx-text">
                  {completionPct}%
                </span>
              </div>
              {actions && (
                <div className="flex items-center gap-1.5">{actions}</div>
              )}
            </div>
          </div>

          {/* True Fullscreen Canvas Container */}
          <div className="relative min-h-0 flex-1 w-full overflow-hidden">
            {children}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Row 1: Mission Identity, Region & Expandable Brief */}
      <div className="mx-no-print border-b border-mx-border bg-mx-bg-raised">
        <div className="mx-auto max-w-[1440px] px-5 pt-3.5 pb-3 sm:px-8 lg:px-14">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Expedition Name + Region + Status */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2 rounded-md border border-mx-border bg-mx-bg px-2.5 py-1 focus-within:border-mx-accent">
                <span className="mx-eyebrow mx-eyebrow--accent">Expedition</span>
                <input
                  type="text"
                  aria-label="Expedition name"
                  value={mission.name}
                  onChange={(event) =>
                    updateMission({ name: event.target.value })
                  }
                  className="w-44 bg-transparent font-display text-[14px] font-semibold text-mx-text focus:outline-none sm:w-52"
                />
                <Edit3
                  size={12}
                  className="pointer-events-none shrink-0 text-mx-dim"
                  aria-hidden="true"
                />
              </div>

              {mission.region ? (
                <Link
                  to={`/explorer?view=map&site=${mission.region.id}`}
                  className="mx-badge border border-mx-border bg-mx-panel px-2.5 py-1 text-mx-text no-underline hover:border-mx-muted"
                  title="View region on 2D Mars Map"
                >
                  <MapPin
                    size={12}
                    className="mr-1.5 text-mx-accent"
                    aria-hidden="true"
                  />
                  <span className="font-medium">{mission.region.name}</span>
                  <span className="mx-mono ml-1.5 text-[10px] text-mx-dim">
                    (
                    {formatCoordinates(
                      mission.region.coordinates.latitude,
                      mission.region.coordinates.longitude
                    )}
                    )
                  </span>
                </Link>
              ) : (
                <Link
                  to="/explorer?view=map"
                  className="mx-badge mx-badge--accent border border-mx-accent/40 px-2.5 py-1 no-underline hover:border-mx-accent"
                >
                  <Compass size={12} className="mr-1.5" aria-hidden="true" />
                  Select Mars Region
                </Link>
              )}

              <span className="mx-badge hidden border border-mx-border bg-mx-bg px-2.5 py-1 sm:inline-flex">
                <span
                  className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                    completionPct >= 80
                      ? "bg-mx-success"
                      : completionPct > 0
                        ? "bg-mx-accent"
                        : "bg-mx-dim"
                  }`}
                />
                {statusLabel}
              </span>
            </div>

            {/* Right: Progress Indicator, Overview Drawer Toggle & Recommended Action */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-2 rounded-md border border-mx-border bg-mx-bg px-3 py-1"
                title="Overall mission workflow progress"
              >
                <span className="mx-mono text-[11px] text-mx-muted">
                  Progress
                </span>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-mx-panel-2">
                  <div
                    className="h-full rounded-full bg-mx-accent transition-all duration-300"
                    style={{ width: `${Math.max(4, completionPct)}%` }}
                  />
                </div>
                <span className="mx-mono text-[11px] font-semibold text-mx-text">
                  {completionPct}%
                </span>
              </div>

              <button
                type="button"
                onClick={() => setOverviewOpen((prev) => !prev)}
                aria-expanded={overviewOpen}
                className={`mx-btn mx-btn--sm ${
                  overviewOpen ? "mx-btn--primary" : "mx-btn--secondary"
                }`}
              >
                Mission Overview
                {overviewOpen ? (
                  <ChevronUp size={14} aria-hidden="true" />
                ) : (
                  <ChevronDown size={14} aria-hidden="true" />
                )}
              </button>

              {nextAction.path !== location.pathname && (
                <Link
                  to={nextAction.path}
                  className="mx-btn mx-btn--primary mx-btn--sm"
                  title={nextAction.reason}
                >
                  <Sparkles size={13} aria-hidden="true" />
                  Next: {nextAction.label}
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>

          {/* Expandable Mission Overview Drawer (Progressive Disclosure) */}
          {overviewOpen && (
            <section
              aria-label="Mission overview details"
              className="mt-3.5 rounded-lg border border-mx-border-strong bg-mx-bg p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-mx-border pb-4">
                <div className="max-w-2xl">
                  <span className="mx-eyebrow mx-eyebrow--accent">
                    Expedition Brief &amp; Telemetry
                  </span>
                  <h2 className="mx-heading m-0 mt-1 text-lg">
                    {mission.name} · {statusLabel}
                  </h2>
                  <p className="mx-body m-0 mt-1.5 text-xs">
                    {mission.question
                      ? `Research Question: "${mission.question}"`
                      : "No research question framed yet. Define your primary question in Stage 01 (Scientific Investigation)."}
                  </p>
                </div>

                <div className="rounded-md border border-mx-border bg-mx-panel px-3.5 py-2.5 text-xs">
                  <span className="mx-eyebrow block text-mx-accent">
                    Recommended Next Step
                  </span>
                  <p className="m-0 mt-1 font-medium text-mx-text">
                    {nextAction.reason}
                  </p>
                  <Link
                    to={nextAction.path}
                    onClick={() => setOverviewOpen(false)}
                    className="mt-2 inline-flex items-center gap-1 font-semibold text-mx-accent no-underline hover:underline"
                  >
                    {nextAction.label}
                    <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <DataField
                  label="Selected Region"
                  value={mission.region?.name}
                  fallback="Not selected"
                />
                <DataField
                  label="Current Stage"
                  value={`Stage ${currentPage.stageNumber} · ${currentPage.shortLabel}`}
                />
                <DataField
                  label="NASA Datasets"
                  value={`${mission.selectedDatasets.length} selected`}
                />
                <DataField
                  label="Observations"
                  value={`${mission.selectedObservations.length} logged`}
                />
                <DataField
                  label="Science Targets"
                  value={`${mission.scientificTargets.length} targets (${mission.simulation.visitedTargetIds.length} visited)`}
                />
                <DataField
                  label="Knowledge Gaps"
                  value={`${mission.knowledgeGaps.length} identified`}
                />
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Row 2: 4-Stage Workflow Navigator */}
      <div className="mx-no-print mx-workflow-nav border-b border-mx-border bg-mx-bg shadow-sm">
        <div className="mx-auto max-w-[1440px] px-5 py-2.5 sm:px-8 lg:px-14">
          <nav
            aria-label="Expedition workflow stages"
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
          >
            {MISSION_STAGE_GROUPS.map((group, groupIdx) => {
              const isCurrentGroup = group.id === currentPage.stageGroupId;
              const isGroupDone = isStageGroupCompleted(group.id, mission);
              const isPastGroup = groupIdx < activeGroupIndex;
              const completedSubPages = group.pages.filter((p) =>
                isPageCompleted(p.id, mission)
              ).length;

              return (
                <div
                  key={group.id}
                  className={`flex flex-col justify-between rounded-lg border px-3 py-2 transition ${
                    isCurrentGroup
                      ? "border-mx-accent bg-mx-panel-2 shadow-sm"
                      : isGroupDone
                        ? "border-emerald-500/35 bg-emerald-950/15"
                        : isPastGroup
                          ? "border-mx-border-strong bg-mx-panel/70"
                          : "border-mx-border bg-mx-bg/60 opacity-85 hover:opacity-100"
                  }`}
                >
                  {/* Stage Group Header */}
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-mono font-semibold ${
                          isCurrentGroup
                            ? "bg-mx-accent text-[#1a0f08]"
                            : isGroupDone
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-mx-panel-2 text-mx-dim"
                        }`}
                      >
                        {isGroupDone ? (
                          <Check size={12} aria-hidden="true" />
                        ) : (
                          group.number
                        )}
                      </span>
                      <span
                        className={`font-display text-xs font-semibold uppercase tracking-wider ${
                          isCurrentGroup || isGroupDone
                            ? "text-mx-text"
                            : "text-mx-muted"
                        }`}
                      >
                        Stage {group.number} — {group.title}
                      </span>
                    </div>

                    <span
                      className={`mx-mono text-[10px] uppercase ${
                        isCurrentGroup
                          ? "font-semibold text-mx-accent"
                          : isGroupDone
                            ? "text-emerald-300"
                            : "text-mx-dim"
                      }`}
                    >
                      {isCurrentGroup
                        ? `Active (${completedSubPages}/${group.pages.length})`
                        : isGroupDone
                          ? "Completed"
                          : `${completedSubPages}/${group.pages.length}`}
                    </span>
                  </div>

                  {/* Sub-pages within this stage */}
                  <div className="flex flex-wrap gap-1">
                    {group.pages.map((page) => {
                      const pageDone = isPageCompleted(page.id, mission);
                      return (
                        <NavLink
                          key={page.id}
                          to={page.path}
                          title={page.purpose}
                          className={({ isActive }) =>
                            `inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs no-underline transition ${
                              isActive
                                ? "bg-mx-accent font-semibold text-[#1a0f08]"
                                : pageDone
                                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                                  : "text-mx-muted hover:bg-mx-bg hover:text-mx-text"
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              {pageDone && !isActive && (
                                <Check
                                  size={11}
                                  className="text-emerald-400"
                                  aria-hidden="true"
                                />
                              )}
                              <span>{page.shortLabel}</span>
                            </>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Page Heading & Main Content */}
      <main className="mx-mission-content mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-14">
        <header className="mx-no-print mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-mx-border pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="mx-eyebrow mx-eyebrow--accent m-0">{stage}</p>
              <span className="text-mx-dim">·</span>
              <span className="mx-mono text-[11px] text-mx-dim">
                {currentPage.purpose}
              </span>
            </div>
            <h1 className="mx-display m-0 mt-2 text-3xl sm:text-4xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mx-body m-0 mt-2 max-w-2xl">{subtitle}</p>
            )}
            {nextStepHint && (
              <p className="mx-mono m-0 mt-2 text-xs text-mx-muted">
                ↳ {nextStepHint}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
        </header>

        {children}
      </main>
    </AppLayout>
  );
}

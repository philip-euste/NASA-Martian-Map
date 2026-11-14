import { Compass, Globe, Map as MapIcon } from "lucide-react";
import MarsGlobe from "../../globe/MarsGlobe";
import MarsMap from "../../components/map/MarsMap";
import { useMission } from "../../state/mission/MissionContext";
import { useMarsExplorer } from "./useMarsExplorer";
import MarsExplorerControls from "./MarsExplorerControls";
import { JezeroExpeditionView } from "./MarsExplorerUI";
import "./MarsExplorer.css";

export default function MarsExplorer() {
  const {
    viewMode,
    setViewMode,
    focusCoordinates,
    triggerZoomInToMap,
    triggerZoomOutToGlobe,
    transitionState,
  } = useMarsExplorer();

  const { mission } = useMission();
  const hasExpedition = Boolean(mission.region);

  const tabClass = (active: boolean) =>
    `mx-chip ${active ? "mx-chip--active" : ""}`;

  const transitionClass = transitionState.active
    ? transitionState.direction === "globe-to-map"
      ? "mx-explorer-stage--to-map"
      : "mx-explorer-stage--to-globe"
    : "";

  return (
    <div className="mx-explorer-root relative h-full w-full overflow-hidden bg-[#0e0d10]">
      {viewMode !== "jezero" && (
        <>
          <div
            className="mx-explorer-mode-bar absolute left-1/2 top-5 z-[1150] flex -translate-x-1/2 items-center gap-1 rounded-lg border border-mx-border bg-mx-bg/92 p-1 shadow-lg backdrop-blur"
            role="group"
            aria-label="Explorer view mode"
          >
            <button
              type="button"
              className={tabClass(viewMode === "globe")}
              aria-pressed={viewMode === "globe"}
              onClick={() => triggerZoomOutToGlobe(focusCoordinates)}
            >
              <Globe size={13} aria-hidden="true" />
              3D Globe
            </button>

            <button
              type="button"
              className={tabClass(viewMode === "map")}
              aria-pressed={viewMode === "map"}
              onClick={() => triggerZoomInToMap(focusCoordinates)}
            >
              <MapIcon size={13} aria-hidden="true" />
              2D Map
            </button>

            {hasExpedition && (
              <button
                type="button"
                className={tabClass(false)}
                aria-pressed={false}
                onClick={() => setViewMode("jezero")}
              >
                <Compass size={13} aria-hidden="true" />
                Expedition Sim
              </button>
            )}
          </div>

          <MarsExplorerControls />
        </>
      )}

      {transitionState.active && (
        <div
          className="pointer-events-none absolute left-1/2 top-[68px] z-[1160] -translate-x-1/2"
          role="status"
          aria-live="polite"
        >
          <span className="mx-chip border-mx-accent/60 bg-mx-bg/95 text-mx-accent shadow-md">
            {transitionState.direction === "globe-to-map"
              ? "Transitioning to 2D regional map..."
              : "Transitioning to 3D planetary globe..."}
          </span>
        </div>
      )}

      <div className={`mx-explorer-stage h-full w-full ${transitionClass}`}>
        {viewMode === "globe" ? (
          <MarsGlobe />
        ) : viewMode === "map" ? (
          <MarsMap />
        ) : (
          <JezeroExpeditionView />
        )}
      </div>
    </div>
  );
}

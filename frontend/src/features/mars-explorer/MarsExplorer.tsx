
import {
  Compass,
  Eye,
  EyeOff,
  Globe,
  Map as MapIcon,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
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
    requestNavigationAction,
    resetExplorerView,
    showGlobeLocations,
    setShowGlobeLocations,
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

  const handleSwitchView = () => {
    if (viewMode === "globe") {
      triggerZoomInToMap(focusCoordinates);
    } else if (viewMode === "map") {
      triggerZoomOutToGlobe(focusCoordinates);
    }
  };

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

            <button
              type="button"
              className={tabClass(false)}
              aria-pressed={false}
              onClick={() => setViewMode("jezero")}
            >
              <Compass size={13} aria-hidden="true" />
              {hasExpedition ? "Expedition Sim" : "3D Surface Walk"}
            </button>
          </div>

          <MarsExplorerControls />

          <div className="absolute bottom-24 left-4 z-[1200] flex flex-col gap-2 sm:left-6">
            <div
              className="flex flex-col gap-2"
              role="toolbar"
              aria-label="Mars explorer navigation"
              aria-orientation="vertical"
            >
              <button
                type="button"
                className="mx-icon-btn"
                aria-label="Zoom in"
                title="Zoom in"
                onClick={() => requestNavigationAction("zoom-in")}
              >
                <Plus size={17} aria-hidden="true" />
              </button>

              <button
                type="button"
                className="mx-icon-btn"
                aria-label="Zoom out"
                title="Zoom out"
                onClick={() => requestNavigationAction("zoom-out")}
              >
                <Minus size={17} aria-hidden="true" />
              </button>

              <button
                type="button"
                className="mx-icon-btn"
                aria-label="Reset view"
                title="Reset view"
                onClick={resetExplorerView}
              >
                <RotateCcw size={17} aria-hidden="true" />
              </button>

              {viewMode === "globe" && (
                <button
                  type="button"
                  className="mx-icon-btn"
                  aria-label="Show globe bookmarks and locations"
                  aria-pressed={showGlobeLocations}
                  title={showGlobeLocations ? "Hide globe bookmarks and locations" : "Show globe bookmarks and locations"}
                  onClick={() => setShowGlobeLocations(!showGlobeLocations)}
                >
                  {showGlobeLocations ? <Eye size={17} aria-hidden="true" /> : <EyeOff size={17} aria-hidden="true" />}
                </button>
              )}

              <button
                type="button"
                className="mx-icon-btn"
                aria-label={
                  viewMode === "globe"
                    ? "Switch to 2D map"
                    : "Switch to 3D globe"
                }
                title={
                  viewMode === "globe"
                    ? "Switch to 2D map"
                    : "Switch to 3D globe"
                }
                onClick={handleSwitchView}
              >
                {viewMode === "globe" ? (
                  <MapIcon size={17} aria-hidden="true" />
                ) : (
                  <Globe size={17} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
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
        <div className={`absolute inset-0 ${viewMode === "globe" ? "" : "invisible pointer-events-none"}`} aria-hidden={viewMode !== "globe"}>
          <MarsGlobe />
        </div>
        {viewMode === "map" ? (
          <MarsMap />
        ) : viewMode === "jezero" ? (
          <JezeroExpeditionView />
        ) : null}
      </div>
    </div>
  );
}


import { useState } from "react";
import {
  Bookmark,
  CalendarDays,
  Clock3,
  Layers,
  Search,
  Telescope,
  X,
} from "lucide-react";

import {
  MAP_LAYERS,
  type MapLayerId,
} from "../../data/mapLayers";

import { useMarsExplorer } from "./useMarsExplorer";

const EARLIEST_TEMPORAL_DATE = "1965-01-01";
const MAX_FUTURE_SOLS = 30;

export default function MarsExplorerControls() {
  const [savedOpen, setSavedOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);

  const {
    selectedLayerId,
    setSelectedLayerId,
    opacity,
    setOpacity,
    searchQuery,
    setSearchQuery,
    searchOpen,
    setSearchOpen,
    searchResults,
    savedLocations,
    goToSavedLocation,
    removeLocation,
    selectSite,
    temporal,
    todayUTC,
    setTemporalMode,
    setTemporalDate,
    setFutureSolHorizon,
    clampFutureSols,
  } = useMarsExplorer();

  const selectedLayer = MAP_LAYERS[selectedLayerId];

  function chooseSite(site: (typeof searchResults.sites)[number]) {
    selectSite(site);
    setSearchQuery("");
    setSearchOpen(false);
  }

  function chooseSavedLocation(
    location: (typeof savedLocations)[number]
  ) {
    goToSavedLocation(location);
    setSavedOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
  }

  return (
    <>
      {/* Search and location controls: upper-left */}
      <div className="mx-explorer-search-controls">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mx-muted"
              aria-hidden="true"
            />

            <input
              id="mars-explorer-search"
              type="search"
              className="mx-input min-w-0 !bg-mx-bg/95 pl-9"
              placeholder="Search sites or saved locations"
              value={searchQuery}
              autoComplete="off"
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setSearchOpen(false), 150);
              }}
            />

            {searchOpen && (
              <div className="mx-panel mx-panel--floating mx-scroll absolute left-0 right-0 top-[calc(100%+6px)] z-[1300] max-h-72 overflow-auto p-1.5">
                {searchResults.sites.length === 0 &&
                  searchResults.saved.length === 0 && (
                    <p className="m-0 px-3 py-2.5 text-[13px] text-mx-dim">
                      No matching locations.
                    </p>
                  )}

                {searchResults.sites.map((site) => (
                  <button
                    key={site.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left hover:bg-mx-panel-2"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseSite(site)}
                  >
                    <span className="text-[13px] text-mx-text">
                      {site.name}
                    </span>
                    <span className="mx-mono text-[11px] text-mx-dim">
                      {site.terrainType}
                    </span>
                  </button>
                ))}

                {searchResults.saved.map((location) => (
                  <button
                    key={location.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left hover:bg-mx-panel-2"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseSavedLocation(location)}
                  >
                    <span className="text-[13px] text-mx-text">
                      {location.name}
                    </span>
                    <span className="mx-mono text-[11px] text-mx-dim">
                      Saved
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className="mx-icon-btn relative shrink-0"
            aria-label={`Saved locations (${savedLocations.length})`}
            aria-pressed={savedOpen}
            title="Saved locations"
            onClick={() => {
              setSavedOpen((open) => !open);
              setLayersOpen(false);
              setSearchOpen(false);
            }}
          >
            <Bookmark size={16} />
            {savedLocations.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-mx-accent px-1 text-[10px] font-semibold text-[#1a0f08]">
                {savedLocations.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className="mx-icon-btn shrink-0"
            aria-label="Dataset layers"
            aria-pressed={layersOpen}
            title="Dataset layers"
            onClick={() => {
              setLayersOpen((open) => !open);
              setSavedOpen(false);
              setSearchOpen(false);
            }}
          >
            <Layers size={17} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="mx-chip min-w-0 flex-1 truncate"
            title={selectedLayer.name}
          >
            {selectedLayer.name}
          </span>
        </div>

        {savedOpen && (
          <div className="mx-panel mx-panel--floating mx-explorer-floating-panel">
            <div className="mx-panel__header !py-3">
              <span className="mx-eyebrow mx-eyebrow--accent">
                Saved Locations ({savedLocations.length})
              </span>
              <button
                type="button"
                className="text-mx-muted hover:text-mx-text"
                aria-label="Close saved locations"
                onClick={() => setSavedOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mx-scroll max-h-64 overflow-auto p-2">
              {savedLocations.length === 0 ? (
                <p className="m-0 px-2 py-3 text-[13px] text-mx-dim">
                  No saved locations yet. Select a point and save it
                  from its location panel.
                </p>
              ) : (
                savedLocations.map((location) => (
                  <div
                    key={location.id}
                    className="flex items-center justify-between gap-2 rounded px-2 py-2.5 hover:bg-mx-panel-2"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => chooseSavedLocation(location)}
                    >
                      <strong className="block truncate text-[13px] font-medium text-mx-text">
                        {location.name}
                      </strong>
                      <span className="mx-mono text-[11px] text-mx-dim">
                        {location.latitude.toFixed(5)}°,{" "}
                        {location.longitude.toFixed(5)}°
                      </span>
                    </button>

                    <button
                      type="button"
                      className="mx-icon-btn !h-8 !w-8 shrink-0"
                      aria-label={`Remove ${location.name}`}
                      onClick={() => removeLocation(location.id)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dataset controls: upper-right, separate from navigation */}
      {layersOpen && (
        <div className="mx-panel mx-panel--floating mx-explorer-layer-panel">
          <div className="mb-3 flex items-center justify-between">
            <span className="mx-eyebrow mx-eyebrow--accent">
              Dataset layer
            </span>
            <button
              type="button"
              className="text-mx-muted hover:text-mx-text"
              aria-label="Close layers"
              onClick={() => setLayersOpen(false)}
            >
              <X size={16} />
            </button>
          </div>

          <label htmlFor="mars-shared-layer" className="mx-label">
            Surface layer
          </label>

          <select
            id="mars-shared-layer"
            className="mx-input"
            value={selectedLayerId}
            onChange={(event) =>
              setSelectedLayerId(event.target.value as MapLayerId)
            }
          >
            {Object.values(MAP_LAYERS).map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.name}
              </option>
            ))}
          </select>

          <p className="mx-body m-0 mt-3 text-[13px]">
            {selectedLayer.description}
          </p>

          <div className="mt-4">
            <label
              htmlFor="mars-shared-opacity"
              className="mx-label flex justify-between"
            >
              <span>Map layer opacity</span>
              <span className="mx-mono text-mx-muted">
                {Math.round(opacity * 100)}%
              </span>
            </label>

            <input
              id="mars-shared-opacity"
              className="mx-range"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(event) => setOpacity(Number(event.target.value))}
            />

            <p className="mx-body m-0 mt-1 text-[11px] text-mx-dim">
              Opacity applies to the 2D map layer.
            </p>
          </div>
        </div>
      )}

      {/* Temporal controls: bottom-right */}
      <div
        className="mx-temporal-toolbar"
        role="region"
        aria-label="Temporal exploration controls"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="mx-eyebrow mx-eyebrow--accent">
            Temporal exploration
          </span>
          <span className="mx-mono text-[10px] text-mx-dim">
            MARS TIME CONTROLS
          </span>
        </div>

        <div
          className="mx-temporal-mode-list"
          role="group"
          aria-label="Select temporal mode"
        >
          <button
            type="button"
            className={`mx-temporal-mode-button ${
              temporal.mode === "past" ? "is-active" : ""
            }`}
            aria-pressed={temporal.mode === "past"}
            onClick={() => setTemporalMode("past")}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <CalendarDays size={13} />
              Past
            </span>
          </button>

          <button
            type="button"
            className={`mx-temporal-mode-button ${
              temporal.mode === "present" ? "is-active" : ""
            }`}
            aria-pressed={temporal.mode === "present"}
            onClick={() => setTemporalMode("present")}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Clock3 size={13} />
              Present
            </span>
          </button>

          <button
            type="button"
            className={`mx-temporal-mode-button ${
              temporal.mode === "future" ? "is-active" : ""
            }`}
            aria-pressed={temporal.mode === "future"}
            onClick={() => setTemporalMode("future")}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Telescope size={13} />
              Future
            </span>
          </button>
        </div>

        {temporal.mode === "past" && (
          <div className="mx-temporal-content">
            <p className="mx-temporal-description m-0">
              Choose an Earth date to define the historical period
              you want to investigate.
            </p>
            <div className="mx-temporal-control">
              <label htmlFor="mars-past-date">Date</label>
              <input
                id="mars-past-date"
                type="date"
                min={EARLIEST_TEMPORAL_DATE}
                max={todayUTC}
                value={temporal.selectedDate}
                onChange={(event) => setTemporalDate(event.target.value)}
              />
            </div>
          </div>
        )}

        {temporal.mode === "present" && (
          <div className="mx-temporal-content">
            <div className="mx-temporal-status">
              <span className="mx-temporal-status-dot" />
              <span>Latest available observations</span>
            </div>
            <p className="mx-temporal-description m-0">
              Uses the currently configured datasets. This is not a
              live Mars feed.
            </p>
          </div>
        )}

        {temporal.mode === "future" && (
          <div className="mx-temporal-content">
            <p className="mx-temporal-description m-0">
              Set a planning horizon. This does not yet generate a
              scientific forecast.
            </p>
            <div className="mx-temporal-control">
              <label htmlFor="mars-future-sols">Horizon (sols)</label>
              <input
                id="mars-future-sols"
                type="number"
                min={1}
                max={MAX_FUTURE_SOLS}
                step={1}
                value={temporal.futureSols}
                onChange={(event) =>
                  setFutureSolHorizon(event.target.value)
                }
                onBlur={clampFutureSols}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}


import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  Check,
  Compass,
  FlaskConical,
  Globe,
  Loader2,
  Map as MapIcon,
  MapPin,
  Target,
  X,
} from "lucide-react";
import {
  DataField,
  ImagePending,
  formatCoordinates,
} from "../../components/ui";
import { useMission } from "../../state/mission/MissionContext";
import {
  JEZERO_DEFAULT_COORDINATES,
  isWithinJezeroDemBounds,
} from "./marsExplorer.types";
import { useMarsExplorer } from "./useMarsExplorer";
import { getSiteById } from "../../data/explorationSites";
import { getMarsRegionById } from "../../data/regions";
import { resolveSimulatorEnvironment } from "../../simulator/environments/catalog";

export function MarsExplorerLocationPanel({
  mode,
}: {
  mode: "globe" | "map";
}) {
  const {
    selectedLocation,
    clearSelection,
    elevation,
    elevationLoading,
    elevationError,
    retryElevation,
    locationNameDraft,
    setLocationNameDraft,
    saveSelectedLocation,
    isSelectedRegion,
    isSelectedTarget,
    startExpeditionAtSelectedLocation,
    addSelectedAsTarget,
    openSelectedInMap,
    openSelectedInGlobe,
  } = useMarsExplorer();
  const [panelImageFailed, setPanelImageFailed] = useState(false);
  useEffect(() => { setPanelImageFailed(false); }, [selectedLocation?.key]);

  if (!selectedLocation) {
    return null;
  }

  const site = selectedLocation.site;
  const displayName =
    selectedLocation.kind === "custom" && locationNameDraft.trim()
      ? locationNameDraft.trim()
      : selectedLocation.name;

  const eyebrowLabel =
    selectedLocation.kind === "site"
      ? "Selected location"
      : selectedLocation.kind === "geological"
        ? "IAU named geological feature · map only"
      : selectedLocation.kind === "saved"
        ? "Saved custom location"
        : "Selected surface point";

  return (
    <aside
      className="mx-explorer-location-panel mx-panel mx-panel--floating mx-scroll"
      aria-label="Selected location"
    >
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <span className="mx-eyebrow mx-eyebrow--accent">{eyebrowLabel}</span>

        <button
          type="button"
          className="text-mx-muted hover:text-mx-text"
          aria-label="Close selected location"
          onClick={clearSelection}
        >
          <X size={17} />
        </button>
      </div>

      {site &&
        (site.images[0] && !panelImageFailed ? (
          <img
            src={site.images[0].src}
            alt={site.images[0].caption}
            onError={() => setPanelImageFailed(true)}
            className="mb-3.5 aspect-[16/9] w-full rounded-md object-cover"
          />
        ) : (
          <ImagePending
            className="mb-3.5 aspect-[16/9]"
            detail="Verified local NASA image unavailable."
          />
        ))}
      {selectedLocation.geologicalFeature && <ImagePending className="mb-3.5 aspect-[16/9]" label="No verified feature image" detail="The USGS Gazetteer provides coordinates and names, but no image for this selected feature." />}

      <div className="flex items-start justify-between gap-3">
        <h3 className="mx-heading m-0 text-2xl">{displayName}</h3>

        {selectedLocation.terrainType && (
          <span className="mx-badge mt-1 shrink-0">
            {selectedLocation.terrainType}
          </span>
        )}
      </div>

      <p className="mx-mono m-0 mt-1.5 text-[12px] text-mx-text">
        {formatCoordinates(selectedLocation.latitude, selectedLocation.longitude)}
      </p>

      <div className="mt-3.5">
        {elevationLoading && (
          <DataField
            label="Elevation"
            value={
              <span className="text-mx-muted">
                Querying Mars DEM…
              </span>
            }
          />
        )}

        {elevationError && (
          <div>
            <DataField
              label="Elevation"
              fallback={`Unavailable — ${elevationError}`}
            />
            <button
              type="button"
              onClick={retryElevation}
              className="mx-btn mx-btn--secondary mx-btn--sm mt-2 !min-h-7 !px-2.5 !py-1 text-[11px]"
            >
              Retry Elevation Query
            </button>
          </div>
        )}

        {elevation && (
          <div>
            <DataField
              label="Elevation"
              value={`${elevation.elevation.toFixed(2)} ${elevation.unit}`}
            />
            <p className="mx-mono m-0 mt-1.5 break-all text-[11px] text-mx-dim">
              DEM product: {elevation.product_id || "Unknown"} · row{" "}
              {elevation.row}, col {elevation.column}
            </p>
          </div>
        )}
      </div>

      <p className="mx-body m-0 mt-3.5 text-[13px]">
        {selectedLocation.description}
      </p>
      {selectedLocation.geologicalFeature && <p className="mx-mono m-0 mt-2 text-[11px] text-mx-muted">
        {selectedLocation.regionLabel} · <a href={selectedLocation.geologicalFeature.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-mx-accent hover:underline">USGS Gazetteer record</a>
      </p>}

      <div className="mt-4 flex gap-2">
        <label htmlFor={`mars-location-name-${mode}`} className="sr-only">
          Location name
        </label>

        <input
          id={`mars-location-name-${mode}`}
          type="text"
          className="mx-input !min-h-9 !py-1.5 text-[13px]"
          value={locationNameDraft}
          onChange={(event) => setLocationNameDraft(event.target.value)}
          placeholder={
            selectedLocation.kind === "saved"
              ? "Rename saved location"
              : "Custom location name (optional)"
          }
          maxLength={50}
        />

        <button
          type="button"
          className="mx-btn mx-btn--secondary mx-btn--sm shrink-0"
          onClick={saveSelectedLocation}
        >
          <Bookmark size={14} aria-hidden="true" />
          Save
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-mx-border pt-4">
        {mode === "globe" ? (
          <button
            type="button"
            className="mx-btn mx-btn--primary mx-btn--block"
            onClick={openSelectedInMap}
          >
            <MapIcon size={15} aria-hidden="true" />
            Open in 2D Map
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="mx-btn mx-btn--primary mx-btn--block"
            onClick={openSelectedInGlobe}
          >
            <Globe size={15} aria-hidden="true" />
            Open in 3D Globe
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        )}

        {selectedLocation.kind !== "geological" && <button
          type="button"
          className="mx-btn mx-btn--secondary mx-btn--block"
          onClick={startExpeditionAtSelectedLocation}
        >
          {isSelectedRegion ? (
            <>
              <Check size={15} aria-hidden="true" />
              Launch Expedition Simulation
            </>
          ) : (
            <>
              <MapPin size={15} aria-hidden="true" />
              Set as Expedition
            </>
          )}
        </button>}

        <button
          type="button"
          className="mx-btn mx-btn--secondary mx-btn--block"
          disabled={isSelectedTarget}
          onClick={addSelectedAsTarget}
        >
          {isSelectedTarget ? (
            <>
              <Check size={15} aria-hidden="true" />
              Already a scientific target
            </>
          ) : (
            <>
              <Target size={15} aria-hidden="true" />
              Add as scientific target
            </>
          )}
        </button>

        <Link
          to="/mission/investigate"
          className="mx-btn mx-btn--secondary mx-btn--block"
        >
          <FlaskConical size={15} aria-hidden="true" />
          Log Observation in Investigation
        </Link>

        {site && (
          <Link
            to={`/explorer/location/${site.id}`}
            className="mx-btn mx-btn--ghost mx-btn--sm self-center"
          >
            View location information
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
    </aside>
  );
}

export function JezeroExpeditionView() {
  const { mission } = useMission();
  const { selectedLocation, setViewMode, selectSite } = useMarsExplorer();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [initializing, setInitializing] = useState(true);

  const activeRegion = mission.region;
  const targetCoordinates = useMemo(() => {
    if (activeRegion?.coordinates) {
      return activeRegion.coordinates;
    }
    if (selectedLocation) {
      return {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      };
    }
    return JEZERO_DEFAULT_COORDINATES;
  }, [activeRegion, selectedLocation]);

  const targetName =
    activeRegion?.name ?? selectedLocation?.name ?? "Jezero Crater";
  const targetRegionId =
    activeRegion?.id ?? selectedLocation?.site?.id ?? selectedLocation?.key;

  const resolved = useMemo(
    () => resolveSimulatorEnvironment(targetRegionId),
    [targetRegionId]
  );

  const withinJezeroDem =
    resolved.available &&
    (targetRegionId === "jezero-crater" ||
      isWithinJezeroDemBounds(targetCoordinates));

  const simulatorSrc = useMemo(() => {
    if (!resolved.available) return "";
    const params = new URLSearchParams({
      lat: targetCoordinates.latitude.toFixed(5),
      lon: targetCoordinates.longitude.toFixed(5),
      name: targetName,
      regionId: activeRegion?.id ?? "jezero-crater",
      withinDem: withinJezeroDem ? "1" : "0",
      playerHeight: "1.75",
      suitWeight: "195",
    });
    return `/src/simulator/jezero_crater/scripts/jezero-simulator.html?${params.toString()}`;
  }, [
    activeRegion?.id,
    resolved.available,
    targetCoordinates.latitude,
    targetCoordinates.longitude,
    targetName,
    withinJezeroDem,
  ]);

  useEffect(() => {
    if (!resolved.available) return;
    setInitializing(true);
    const timeout = window.setTimeout(() => {
      setInitializing(false);
    }, 1800);

    function handleMessage(event: MessageEvent) {
      if (
        event.origin &&
        event.origin !== window.location.origin &&
        event.origin !== "https://nasa-martian-map.pages.dev" &&
        !event.origin.endsWith(".nasa-martian-map.pages.dev") &&
        !/^http:\/\/(localhost|127\.0\.0\.1):(5173|4173|3000)$/.test(event.origin)
      ) {
        return;
      }
      if (
        event.data &&
        typeof event.data === "object" &&
        event.data.type === "jezero-simulation-ready"
      ) {
        setInitializing(false);
      }
      if (
        event.data &&
        typeof event.data === "object" &&
        event.data.type === "marswalk:exit"
      ) {
        setViewMode("map");
      }
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
    };
  }, [resolved.available, simulatorSrc]);

  useEffect(() => {
    if (!resolved.available) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: "mars-explorer:expedition",
        name: targetName,
        regionId: activeRegion?.id ?? "jezero-crater",
        latitude: targetCoordinates.latitude,
        longitude: targetCoordinates.longitude,
        requestedLatitude: targetCoordinates.latitude,
        requestedLongitude: targetCoordinates.longitude,
        withinDem: withinJezeroDem,
        playerHeight: 1.75,
        suitWeight: 195,
        targets: mission.scientificTargets.map((t) => ({
          id: t.id,
          name: t.name,
          latitude: t.coordinates.latitude,
          longitude: t.coordinates.longitude,
          kind: "target",
        })),
      },
      window.location.origin
    );
  }, [
    activeRegion?.id,
    mission.scientificTargets,
    resolved.available,
    targetCoordinates.latitude,
    targetCoordinates.longitude,
    targetName,
    withinJezeroDem,
  ]);

  // If 3D surface simulation is not available for this region, render clean availability card without loading Jezero
  if (!resolved.available) {
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#0c0806] p-6 text-center">
        <div className="mx-panel w-full max-w-xl border border-mx-border-strong bg-mx-bg/95 p-6 text-left shadow-2xl sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mx-border pb-4">
            <div>
              <span className="mx-eyebrow mx-eyebrow--accent">
                MARS EXPLORER · 3D SURFACE SIMULATOR STATUS
              </span>
              <h2 className="mx-heading m-0 mt-1 text-2xl font-bold">
                {targetName}
              </h2>
            </div>
            <span
              className={`mx-badge px-2.5 py-1 font-mono text-xs uppercase tracking-wider ${
                resolved.availability === "PLANNED"
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                  : "border-slate-500/50 bg-slate-500/15 text-slate-300"
              }`}
            >
              3D Simulator {resolved.availability}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 font-mono text-xs text-mx-muted">
            <span className="inline-flex items-center gap-1.5 text-mx-text">
              <MapPin size={13} className="text-mx-accent" />
              Target Coordinates:{" "}
              {formatCoordinates(
                targetCoordinates.latitude,
                targetCoordinates.longitude
              )}
            </span>
            <span>•</span>
            <span>Vertical Reference: MOLA Areoid</span>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-mx-text">
            {resolved.reason}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-mx-border pt-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="mx-btn mx-btn--secondary mx-btn--sm"
                onClick={() => setViewMode("map")}
              >
                <MapIcon size={13} />
                2D Regional Map
              </button>
              <button
                type="button"
                className="mx-btn mx-btn--secondary mx-btn--sm"
                onClick={() => setViewMode("globe")}
              >
                <Globe size={13} />
                3D Globe
              </button>
            </div>

            <button
              type="button"
              className="mx-btn mx-btn--secondary mx-btn--sm border-emerald-500/40 text-emerald-300 hover:border-emerald-400"
              onClick={() => {
                const jezeroSite = getSiteById("jezero-crater");
                if (jezeroSite) selectSite(jezeroSite, { focus: true });
                setViewMode("jezero");
              }}
            >
              Switch to Jezero 3D Surface
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#120b08]">
      {initializing && (
        <div
          className="pointer-events-none absolute inset-0 z-[1120] flex flex-col items-center justify-center gap-3 bg-[#0c0806]/80 backdrop-blur-sm transition-opacity"
          role="status"
          aria-live="polite"
        >
          <Loader2 size={28} className="animate-spin text-mx-accent" />
          <div className="text-center">
            <p className="mx-eyebrow mx-eyebrow--accent m-0">
              Initializing Expedition Simulation
            </p>
            <p className="mx-mono m-0 mt-1 text-xs text-mx-muted">
              {targetName} ·{" "}
              {formatCoordinates(
                targetCoordinates.latitude,
                targetCoordinates.longitude
              )}
            </p>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        key={simulatorSrc}
        title="Jezero Crater First-Person Surface Simulation"
        src={simulatorSrc}
        onLoad={() => setInitializing(false)}
        className="absolute inset-0 h-full w-full border-0"
        allow="fullscreen; pointer-lock"
      />
    </div>
  );
}

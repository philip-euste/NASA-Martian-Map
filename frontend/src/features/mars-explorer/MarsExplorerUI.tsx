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
        (site.images[0] ? (
          <img
            src={site.images[0].src}
            alt={site.images[0].caption}
            className="mb-3.5 aspect-[16/9] w-full rounded-md object-cover"
          />
        ) : (
          <ImagePending
            className="mb-3.5 aspect-[16/9]"
            detail="Site imagery to be supplied by the team."
          />
        ))}

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
                Retrieving elevation from HiRISE DEM...
              </span>
            }
          />
        )}

        {elevationError && (
          <DataField
            label="Elevation"
            fallback={`Unavailable — ${elevationError}`}
          />
        )}

        {elevation && (
          <div>
            <DataField
              label="HiRISE Elevation"
              value={`${elevation.elevation.toFixed(2)} ${elevation.unit}`}
            />
            <p className="mx-mono m-0 mt-1.5 text-[11px] text-mx-dim">
              DEM product: {elevation.product_id} · row {elevation.row}, col{" "}
              {elevation.column}
            </p>
          </div>
        )}
      </div>

      <p className="mx-body m-0 mt-3.5 text-[13px]">
        {selectedLocation.description}
      </p>

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

        <button
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
        </button>

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
  const { selectedLocation, setViewMode } = useMarsExplorer();
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
  const withinJezeroDem =
    activeRegion?.id === "jezero-crater" ||
    selectedLocation?.site?.id === "jezero-crater" ||
    isWithinJezeroDemBounds(targetCoordinates);

  const simulatorCoords = withinJezeroDem
    ? targetCoordinates
    : JEZERO_DEFAULT_COORDINATES;

  const simulatorSrc = useMemo(() => {
    const params = new URLSearchParams({
      lat: simulatorCoords.latitude.toFixed(5),
      lon: simulatorCoords.longitude.toFixed(5),
      name: targetName,
      regionId: activeRegion?.id ?? "jezero-crater",
      withinDem: withinJezeroDem ? "1" : "0",
    });
    return `/src/simulator/jezero_crater/scripts/jezero-simulator.html?${params.toString()}`;
  }, [
    activeRegion?.id,
    simulatorCoords.latitude,
    simulatorCoords.longitude,
    targetName,
    withinJezeroDem,
  ]);

  useEffect(() => {
    setInitializing(true);
    const timeout = window.setTimeout(() => {
      setInitializing(false);
    }, 1800);

    function handleMessage(event: MessageEvent) {
      if (
        event.data &&
        typeof event.data === "object" &&
        event.data.type === "jezero-simulation-ready"
      ) {
        setInitializing(false);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
    };
  }, [simulatorSrc]);

  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: "mars-explorer:expedition",
        name: targetName,
        regionId: activeRegion?.id ?? "jezero-crater",
        latitude: simulatorCoords.latitude,
        longitude: simulatorCoords.longitude,
        requestedLatitude: targetCoordinates.latitude,
        requestedLongitude: targetCoordinates.longitude,
        withinDem: withinJezeroDem,
      },
      "*"
    );
  }, [
    activeRegion?.id,
    simulatorCoords.latitude,
    simulatorCoords.longitude,
    targetCoordinates.latitude,
    targetCoordinates.longitude,
    targetName,
    withinJezeroDem,
  ]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#120b08]">
      {!withinJezeroDem && (
        <div
          className="absolute left-1/2 top-20 z-[1150] flex w-[min(640px,calc(100vw-32px))] -translate-x-1/2 flex-wrap items-center justify-between gap-3 rounded-lg border border-mx-border-strong bg-mx-bg/95 px-4 py-2.5 text-xs shadow-lg backdrop-blur"
          role="status"
        >
          <div className="flex items-center gap-2.5 text-mx-text">
            <AlertTriangle size={15} className="shrink-0 text-mx-accent" />
            <span>
              <strong>{targetName}</strong> (
              {formatCoordinates(
                targetCoordinates.latitude,
                targetCoordinates.longitude
              )}
              ) is saved as your active expedition region. High-resolution 3D
              surface walk DEM tiles cover Jezero Crater; simulation anchored at
              Jezero landing coordinates.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="mx-btn mx-btn--secondary mx-btn--sm"
              onClick={() => setViewMode("map")}
            >
              <Compass size={13} aria-hidden="true" />
              View on 2D Map
            </button>

            <Link
              to="/mission/investigate"
              className="mx-btn mx-btn--primary mx-btn--sm no-underline"
            >
              <FlaskConical size={13} aria-hidden="true" />
              Mission Workspace
            </Link>
          </div>
        </div>
      )}

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

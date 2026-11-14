// frontend/src/features/mission/PerseveranceImageryPanel.tsx
// Phase 2, Task T-2.3: Perseverance Surface Imagery Catalog & Inspector (Catalog #3).
// Lets users browse, filter (by camera & Sol), paginate, and inspect authentic
// NASA Mars 2020 Perseverance rover photographs (Mastcam-Z, Navcam, SuperCam RMI),
// and reference them in scientific investigation observations with full metadata
// and provenance.

import { useEffect, useState, type FormEvent } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Link2,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  DataField,
  EmptyState,
  ImagePending,
  SectionHeading,
} from "../../components/ui";
import {
  SURFACE_IMAGERY_DATASET_ID,
  type SurfaceImageryCatalogItem,
} from "../../data/evidenceDatasets";
import {
  CAMERA_FILTER_OPTIONS,
  perseveranceImageryProvider,
  type SurfaceCameraFilter,
  type SurfaceImageryPageResult,
} from "../../services/providers/perseveranceImageryProvider";
import type { SurfaceImageAttachment } from "../../types";

interface PerseveranceImageryPanelProps {
  onLogObservationWithImage?: (params: {
    datasetId: string;
    name: string;
    description: string;
    observationDate: string;
    limitation: string;
    sourceId: string;
    sourceUrl: string;
    processingMethod: string;
    surfaceImage: SurfaceImageAttachment;
  }) => void;
  onAttachToObservation?: (surfaceImage: SurfaceImageAttachment) => void;
  activeObservationName?: string;
}

const SOL_PRESETS: { value: number | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Sols (108 Verified Frames)" },
  { value: 1, label: "Sol 1 · Octavia E. Butler Landing (2021-02-19)" },
  { value: 420, label: "Sol 420 · Western Delta Front / Three Forks (2022-04-26)" },
  { value: 2024, label: "Sol 2024 · Upper Crater Rim Traverse" },
  { value: 2031, label: "Sol 2031 · Latest Mission Telemetry" },
];

export function toSurfaceImageAttachment(
  item: SurfaceImageryCatalogItem
): SurfaceImageAttachment {
  return {
    imageId: item.id,
    roverName: item.roverName,
    instrument: item.instrument,
    instrumentLabel: item.instrumentLabel,
    sol: item.sol,
    dateTakenUtc: item.dateTakenUtc,
    dateTakenMars: item.dateTakenMars,
    site: item.site,
    drive: item.drive,
    xyzLocalMeters: item.xyzLocalMeters,
    imageUrl: item.imageUrl,
    thumbnailUrl: item.thumbnailUrl,
    sourceUrl: item.sourceUrl,
    credit: item.credit,
    caption: item.caption,
  };
}

export default function PerseveranceImageryPanel({
  onLogObservationWithImage,
  onAttachToObservation,
  activeObservationName,
}: PerseveranceImageryPanelProps) {
  const [cameraFilter, setCameraFilter] = useState<SurfaceCameraFilter>("ALL");
  const [solFilter, setSolFilter] = useState<number | "ALL">("ALL");
  const [customSolInput, setCustomSolInput] = useState("");
  const [preferLiveNasa, setPreferLiveNasa] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 6;

  const [pageResult, setPageResult] = useState<SurfaceImageryPageResult | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(
    () => new Set()
  );
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function fetchPage(options?: {
    targetPage?: number;
    forceRetry?: boolean;
    liveNasa?: boolean;
    overrideSol?: number | "ALL";
  }): Promise<void> {
    const nextPage = options?.targetPage ?? page;
    const targetSol = options?.overrideSol ?? solFilter;
    const useLive = options?.liveNasa ?? preferLiveNasa;

    setLoading(true);
    setError(null);
    try {
      const res = await perseveranceImageryProvider.queryImages({
        camera: cameraFilter,
        sol: targetSol,
        page: nextPage,
        perPage,
        preferLiveNasaApi: useLive,
        forceRetry: options?.forceRetry,
      });
      setPageResult(res);
      if (res.items.length > 0) {
        const stillPresent = res.items.some((i) => i.id === selectedImageId);
        if (!stillPresent) {
          setSelectedImageId(res.items[0].id);
        }
      } else {
        setSelectedImageId(null);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Perseverance surface imagery catalog."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchPage({ targetPage: page });
  }, [cameraFilter, solFilter, page, preferLiveNasa]);

  function handleCameraChange(nextCamera: SurfaceCameraFilter): void {
    setCameraFilter(nextCamera);
    setPage(1);
    setActionMessage(null);
  }

  function handleSolPresetChange(nextSol: number | "ALL"): void {
    setPreferLiveNasa(false);
    setSolFilter(nextSol);
    setPage(1);
    setActionMessage(null);
  }

  function handleCustomSolSubmit(event: FormEvent): void {
    event.preventDefault();
    const parsed = Number(customSolInput.trim());
    if (!Number.isInteger(parsed) || parsed < 0) return;
    setPreferLiveNasa(true);
    setSolFilter(parsed);
    setPage(1);
    setActionMessage(null);
  }

  function markImageUrlFailed(url: string): void {
    setFailedImageUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }

  const activeItem: SurfaceImageryCatalogItem | null =
    pageResult?.items.find((i) => i.id === selectedImageId) ??
    pageResult?.items[0] ??
    null;

  function handleLogObservationFromImage(): void {
    if (!activeItem || !onLogObservationWithImage) return;
    const dateStr = (activeItem.dateTakenUtc || "2021-02-19").slice(0, 10);
    const siteDriveStr =
      activeItem.site !== null
        ? `Site ${activeItem.site}, Drive ${activeItem.drive ?? "N/A"}${
            activeItem.xyzLocalMeters
              ? `, Local XYZ ${activeItem.xyzLocalMeters} m`
              : ""
          }`
        : "Site/Drive not recorded";

    onLogObservationWithImage({
      datasetId: SURFACE_IMAGERY_DATASET_ID,
      name: `Perseverance ${activeItem.instrument} Sol ${activeItem.sol} (${activeItem.id.slice(
        0,
        18
      )}…)`,
      description: `In-situ Perseverance rover surface photograph (${activeItem.instrumentLabel}) acquired on Sol ${activeItem.sol} (${activeItem.dateTakenMars ?? "LMST N/A"}, ${siteDriveStr}). ${activeItem.caption}`,
      observationDate: dateStr,
      limitation:
        "Direct rover surface photograph (distinct from orbital imagery): visual outcrop texture alone does not prove clay/carbonate mineralogy without paired spectroscopy, and raw EDR metadata records Site/Drive/Local XYZ rather than planetocentric lat/lon.",
      sourceId: activeItem.id,
      sourceUrl: activeItem.sourceUrl,
      processingMethod: `NASA Mars 2020 ${activeItem.instrument} Full-Frame EDR (${
        activeItem.dimensions ?? "Native resolution"
      })`,
      surfaceImage: toSurfaceImageAttachment(activeItem),
    });

    setActionMessage(
      `Logged observation referencing Perseverance image ${activeItem.id} (Sol ${activeItem.sol}).`
    );
  }

  function handleAttachImage(): void {
    if (!activeItem || !onAttachToObservation) return;
    onAttachToObservation(toSurfaceImageAttachment(activeItem));
    setActionMessage(
      `Attached Perseverance ${activeItem.instrument} image (${activeItem.id}) to "${
        activeObservationName ?? "active observation"
      }".`
    );
  }

  return (
    <section
      className="mx-panel p-6"
      aria-labelledby="perseverance-imagery-heading"
    >
      <SectionHeading
        eyebrow="Phase 2 · T-2.3 · Surface Imagery Catalog (Catalog #3)"
        title="Perseverance Rover Surface Imagery (Mastcam-Z, Navcam & SuperCam RMI)"
        icon={<Camera size={18} />}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {pageResult && (
              <span
                className={`mx-badge ${
                  pageResult.retrievalMode === "live_nasa_api" ||
                  pageResult.retrievalMode === "live_backend"
                    ? "mx-badge--success"
                    : "mx-badge--accent"
                }`}
                title={pageResult.retrievalLabel}
              >
                {pageResult.retrievalMode === "live_nasa_api"
                  ? "Live NASA Raw Images API"
                  : pageResult.retrievalMode === "live_backend"
                    ? "Live Backend API"
                    : "Local Verified NASA Archive"}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                perseveranceImageryProvider.resetCooldown();
                void fetchPage({ forceRetry: true });
              }}
              disabled={loading}
              className="mx-btn mx-btn--secondary mx-btn--sm"
            >
              <RefreshCw size={13} aria-hidden="true" />
              {loading ? "Loading…" : "Refresh Catalog"}
            </button>
          </div>
        }
      />

      {/* Scientific & Geographic Provenance Boundary Notice (Part 3.C & 3.E) */}
      <div className="mb-4 rounded-lg border border-sky-500/30 bg-sky-950/15 p-3.5 text-xs">
        <div className="flex items-start gap-2">
          <CircleAlert
            size={15}
            className="mt-0.5 shrink-0 text-sky-300"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <strong className="text-sky-200">
              In-Situ Rover Surface Imagery vs. Orbital Imagery &amp; Coordinate Provenance:
            </strong>
            <p className="m-0 text-mx-muted">
              These photographs are{" "}
              <strong className="text-mx-text">
                direct ground-level images captured by NASA&apos;s Perseverance
                rover
              </strong>{" "}
              (`MCZ_LEFT`, `MCZ_RIGHT`, `NAVCAM_LEFT`, `NAVCAM_RIGHT`,
              `SUPERCAM_RMI`). Visual morphology in rover photographs supports
              outcrop bedding and grain-scale texture interpretation, but{" "}
              <strong className="text-sky-200">
                does not by itself prove phyllosilicate mineralogy
              </strong>
              . Raw EDR image metadata provides rover `Site`, `Drive`, and local
              `XYZ` offsets rather than planetocentric `(lat, lon)`; Mars
              Explorer preserves this exact provenance without fabricating map
              coordinates.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Controls: Camera + Sol + Custom Sol Query */}
      <div className="mb-5 grid gap-3.5 rounded-lg border border-mx-border bg-mx-bg p-4">
        <div>
          <span className="mx-label">
            1. Filter by Rover Camera / Instrument
          </span>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Filter Perseverance images by camera"
          >
            {CAMERA_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={cameraFilter === opt.value}
                onClick={() => handleCameraChange(opt.value)}
                title={opt.description}
                className={`mx-chip !py-1 !px-2.5 text-xs ${
                  cameraFilter === opt.value ? "mx-chip--active" : ""
                }`}
              >
                {opt.shortLabel}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-mx-border pt-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="mx-label">2. Filter by Martian Sol</span>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Filter Perseverance images by Sol"
            >
              {SOL_PRESETS.map((preset) => (
                <button
                  key={String(preset.value)}
                  type="button"
                  aria-pressed={solFilter === preset.value}
                  onClick={() => handleSolPresetChange(preset.value)}
                  className={`mx-chip !py-1 !px-2.5 text-xs ${
                    solFilter === preset.value ? "mx-chip--active" : ""
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleCustomSolSubmit}
            className="flex items-center gap-1.5"
          >
            <label htmlFor="custom-rover-sol" className="sr-only">
              Query specific Sol
            </label>
            <input
              id="custom-rover-sol"
              type="number"
              min="0"
              max="3000"
              placeholder="Sol # (e.g. 420)"
              value={customSolInput}
              onChange={(e) => setCustomSolInput(e.target.value)}
              className="mx-input !min-h-8 w-36 !py-1 text-xs"
            />
            <button
              type="submit"
              className="mx-btn mx-btn--secondary mx-btn--sm"
              title="Query this Sol (attempts live NASA Mars 2020 Raw Images API when online, with local archive fallback)"
            >
              <Search size={13} aria-hidden="true" />
              Query Sol
            </button>
          </form>
        </div>
      </div>

      {loading ? (
        <EmptyState compact title="Loading Perseverance surface imagery…">
          Retrieving verified rover camera metadata (`MCZ`, `NAVCAM`,
          `SUPERCAM_RMI`)…
        </EmptyState>
      ) : error ? (
        <EmptyState
          compact
          title="Surface Imagery Catalog Unavailable"
          action={
            <button
              type="button"
              onClick={() => void fetchPage({ forceRetry: true })}
              className="mx-btn mx-btn--primary mx-btn--sm"
            >
              Retry Imagery Retrieval
            </button>
          }
        >
          {error}
        </EmptyState>
      ) : !pageResult || pageResult.items.length === 0 ? (
        <EmptyState
          compact
          title="No Perseverance images match the current Camera / Sol filter"
          action={
            <button
              type="button"
              onClick={() => {
                setCameraFilter("ALL");
                setSolFilter("ALL");
                setPreferLiveNasa(false);
                setPage(1);
              }}
              className="mx-btn mx-btn--secondary mx-btn--sm"
            >
              Reset Camera &amp; Sol Filters
            </button>
          }
        >
          Try selecting “All Cameras” or one of the verified archive Sols (Sol 1,
          Sol 420, Sol 2024, Sol 2031).
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* LEFT 6 COLS: THUMBNAIL GRID & PAGINATION */}
          <div className="flex flex-col justify-between lg:col-span-6">
            <div>
              <div className="mb-2.5 flex items-center justify-between text-xs text-mx-muted">
                <span>
                  Showing <strong>{pageResult.items.length}</strong> of{" "}
                  <strong>{pageResult.totalMatching}</strong> verified images
                </span>
                <span className="mx-mono text-[11px]">
                  Page {pageResult.page} of {pageResult.totalPages}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {pageResult.items.map((item) => {
                  const isSelected = activeItem?.id === item.id;
                  const thumbFailed = failedImageUrls.has(item.thumbnailUrl);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedImageId(item.id);
                        setActionMessage(null);
                      }}
                      className={`group flex flex-col overflow-hidden rounded-lg border text-left transition ${
                        isSelected
                          ? "border-mx-accent bg-mx-panel-2"
                          : "border-mx-border bg-mx-bg hover:border-mx-border-strong"
                      }`}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-mx-panel">
                        {!thumbFailed ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            loading="lazy"
                            onError={() => markImageUrlFailed(item.thumbnailUrl)}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center">
                            <Camera
                              size={16}
                              className="text-mx-dim"
                              aria-hidden="true"
                            />
                            <span className="mt-1 font-mono text-[10px] text-mx-dim">
                              {item.instrument}
                            </span>
                            <span className="text-[9px] text-mx-dim">
                              Remote image offline
                            </span>
                          </div>
                        )}
                        <span className="mx-mono absolute top-1.5 left-1.5 rounded bg-mx-bg/90 px-1.5 py-0.5 text-[10px] text-mx-accent">
                          {item.instrument}
                        </span>
                        <span className="mx-mono absolute bottom-1.5 right-1.5 rounded bg-mx-bg/90 px-1.5 py-0.5 text-[10px] text-mx-text">
                          Sol {item.sol}
                        </span>
                      </div>

                      <div className="p-2">
                        <div className="truncate font-mono text-[10px] text-mx-text">
                          {item.id}
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-mx-dim">
                          {item.dateTakenUtc
                            ? `${item.dateTakenUtc.slice(0, 10)} UTC`
                            : `Sol ${item.sol}`}
                          {item.site !== null ? ` · Site ${item.site}` : ""}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pagination Bar */}
            <div className="mt-4 flex items-center justify-between border-t border-mx-border pt-3">
              <button
                type="button"
                disabled={pageResult.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="mx-btn mx-btn--secondary mx-btn--sm"
              >
                <ChevronLeft size={14} aria-hidden="true" />
                Previous
              </button>

              <span className="mx-mono text-xs text-mx-muted">
                Page {pageResult.page} / {pageResult.totalPages}
              </span>

              <button
                type="button"
                disabled={!pageResult.hasMore}
                onClick={() => setPage((p) => p + 1)}
                className="mx-btn mx-btn--secondary mx-btn--sm"
              >
                Next
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* RIGHT 6 COLS: SELECTED ROVER IMAGE METADATA & OBSERVATION LINKING */}
          {activeItem && (
            <div className="flex flex-col justify-between rounded-lg border border-mx-border bg-mx-bg p-4 lg:col-span-6">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-mx-border pb-3">
                  <div>
                    <span className="mx-eyebrow mx-eyebrow--accent">
                      {activeItem.roverName} Rover · {activeItem.instrument} · Sol{" "}
                      {activeItem.sol}
                    </span>
                    <h3 className="mx-heading m-0 mt-1 text-base">
                      {activeItem.title}
                    </h3>
                  </div>

                  <a
                    href={activeItem.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mx-btn mx-btn--secondary mx-btn--sm no-underline"
                  >
                    NASA Raw Page
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </div>

                {/* Main Image Preview with Graceful Offline / Error Handling */}
                <div className="relative mt-3 overflow-hidden rounded-lg border border-mx-border bg-mx-panel">
                  {!failedImageUrls.has(activeItem.imageUrl) ? (
                    <img
                      src={activeItem.imageUrl}
                      alt={activeItem.caption || activeItem.title}
                      onError={() => markImageUrlFailed(activeItem.imageUrl)}
                      className="aspect-[16/10] w-full object-contain bg-black/40"
                    />
                  ) : (
                    <ImagePending
                      className="aspect-[16/10] border-0"
                      label={`Remote NASA Image Host Unreachable (${activeItem.instrument} · Sol ${activeItem.sol})`}
                      detail={`Verified NASA Image ID: ${activeItem.id}. Metadata is loaded from the local NASA Mars 2020 archive; connect to the internet to stream full-resolution JPEG/PNG frames from mars.nasa.gov.`}
                    />
                  )}
                </div>

                {actionMessage && (
                  <p className="mt-3 mb-0 rounded border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-300">
                    ✓ {actionMessage}
                  </p>
                )}

                {/* Authentic NASA Metadata Grid */}
                <div className="mt-3.5 grid grid-cols-2 gap-3 rounded border border-mx-border bg-mx-panel/60 p-3 text-xs">
                  <DataField
                    label="NASA Image Identifier"
                    value={activeItem.id}
                    className="col-span-2"
                  />
                  <DataField
                    label="Camera / Instrument"
                    value={activeItem.instrumentLabel}
                    className="col-span-2"
                  />
                  <DataField
                    label="Sol & Sample Type"
                    value={`Sol ${activeItem.sol} (${activeItem.sampleType} Frame · ${
                      activeItem.dimensions ?? "Native"
                    })`}
                  />
                  <DataField
                    label="UTC Acquisition Time"
                    value={
                      activeItem.dateTakenUtc
                        ? `${activeItem.dateTakenUtc} UTC`
                        : "Not recorded"
                    }
                  />
                  <DataField
                    label="Local Mars Time (LMST)"
                    value={activeItem.dateTakenMars ?? "Not recorded"}
                  />
                  <DataField
                    label="Spacecraft Clock (SCLK)"
                    value={activeItem.sclk ?? "Not recorded"}
                  />
                  <DataField
                    label="Rover Site / Drive / Local XYZ"
                    value={
                      activeItem.site !== null
                        ? `Site ${activeItem.site}, Drive ${
                            activeItem.drive ?? "—"
                          }${
                            activeItem.xyzLocalMeters
                              ? `, XYZ ${activeItem.xyzLocalMeters} m`
                              : ""
                          }`
                        : "Not recorded"
                    }
                  />
                  <DataField
                    label="Mast Pointing (Az / El)"
                    value={
                      activeItem.mastAzimuthDeg !== null &&
                      activeItem.mastElevationDeg !== null
                        ? `Az ${activeItem.mastAzimuthDeg.toFixed(
                            1
                          )}°, El ${activeItem.mastElevationDeg.toFixed(1)}°`
                        : "Not recorded"
                    }
                  />
                  <DataField
                    label="Planetocentric Coordinates"
                    value={
                      activeItem.coordinates
                        ? `${activeItem.coordinates.latitude}°N, ${activeItem.coordinates.longitude}°E`
                        : "Not embedded in raw EDR metadata (see Site/Drive)"
                    }
                    className="col-span-2"
                  />
                  <DataField
                    label="Source Attribution"
                    value={activeItem.credit}
                    className="col-span-2"
                  />
                </div>

                {activeItem.caption && (
                  <p className="mx-body m-0 mt-3 text-xs">
                    <strong>NASA Mission Caption:</strong> {activeItem.caption}
                  </p>
                )}
              </div>

              {/* Connect Imagery to Scientific Investigation Actions */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-mx-border pt-3">
                <span className="mx-mono text-[11px] text-mx-dim">
                  {pageResult.retrievalLabel}
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  {onAttachToObservation && (
                    <button
                      type="button"
                      onClick={handleAttachImage}
                      className="mx-btn mx-btn--secondary mx-btn--sm"
                    >
                      <Link2 size={13} aria-hidden="true" />
                      Attach to Active Observation
                    </button>
                  )}
                  {onLogObservationWithImage && (
                    <button
                      type="button"
                      onClick={handleLogObservationFromImage}
                      className="mx-btn mx-btn--primary mx-btn--sm"
                    >
                      <Plus size={13} aria-hidden="true" />
                      Log Observation with Rover Image
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

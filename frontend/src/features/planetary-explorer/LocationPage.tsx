
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Compass,
  FlaskConical,
  MapPin,
  ScanSearch,
  Target,
} from "lucide-react";
import AppLayout, { SiteFooter } from "../../components/layout/AppLayout";
import {
  DataField,
  EmptyState,
  ImagePending,
  formatCoordinates,
} from "../../components/ui";
import {
  EXPLORATION_SITES,
  getSiteById,
} from "../../data/explorationSites";
import {
  marsDemProvider,
  type DemElevation,
} from "../../services/providers/marsDem";
import { useMission } from "../../state/mission/MissionContext";
import {
  buildRegion,
  buildTarget,
  createId,
  hasTargetAt,
  toMutable,
} from "../mission/missionHelpers";
import PerseveranceImageryPanel from "../mission/PerseveranceImageryPanel";
import type { Observation } from "../../types";

export default function LocationPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const site = getSiteById(siteId);
  const { mission, setRegion, updateMission } = useMission();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [elevation, setElevation] = useState<DemElevation | null>(null);
  const [elevationLoading, setElevationLoading] = useState(false);
  const [elevationError, setElevationError] = useState<string | null>(null);
  const [elevationRetryCount, setElevationRetryCount] = useState(0);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [siteId]);

  // Retrieve elevation from the FastAPI DEM endpoint.
  useEffect(() => {
    if (!site) {
      setElevation(null);
      setElevationLoading(false);
      setElevationError(null);
      return;
    }

    const selectedSite = site;
    let cancelled = false;

    async function loadElevation() {
      setElevationLoading(true);
      setElevation(null);
      setElevationError(null);

      try {
        const result = await marsDemProvider.getElevation(
          {
            latitude: selectedSite.latitude,
            longitude: selectedSite.longitude,
          },
          { forceRetry: elevationRetryCount > 0 }
        );

        if (!cancelled) {
          setElevation(result);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setElevationError(
            err instanceof Error
              ? err.message
              : "Unable to retrieve elevation."
          );
        }
      } finally {
        if (!cancelled) {
          setElevationLoading(false);
        }
      }
    }

    loadElevation();

    return () => {
      cancelled = true;
    };
  }, [site, elevationRetryCount]);

  if (!site) {
    return (
      <AppLayout>
        <main className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-14">
          <EmptyState
            icon={<Compass size={26} />}
            title="Location not found"
            action={
              <Link
                to="/explorer?view=map"
                className="mx-btn mx-btn--primary"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Back to Mars map
              </Link>
            }
          >
            Select one of the catalogued Martian exploration sites from the
            globe or 2D map.
          </EmptyState>
        </main>
      </AppLayout>
    );
  }

  // Stable reference after the not-found guard.
  const selectedSite = site;

  const coordinates = {
    latitude: selectedSite.latitude,
    longitude: selectedSite.longitude,
  };

  const isRegion = mission.region?.id === selectedSite.id;
  const isTarget = hasTargetAt(mission.scientificTargets, coordinates);
  const activeImage = selectedSite.images[activeImageIndex];

  const siteObservations = mission.selectedObservations.filter(
    (obs) =>
      obs.coordinates &&
      Math.abs(obs.coordinates.latitude - selectedSite.latitude) < 2 &&
      Math.abs(obs.coordinates.longitude - selectedSite.longitude) < 2
  );

  function startInvestigationAtSite(): void {
    setRegion(
      buildRegion(
        selectedSite.id,
        selectedSite.name,
        coordinates,
        selectedSite.description
      )
    );
    navigate("/mission/investigate");
  }

  function addSiteAsTarget(): void {
    if (isTarget) return;

    updateMission({
      scientificTargets: [
        ...toMutable(mission.scientificTargets),
        buildTarget(
          selectedSite.name,
          coordinates,
          selectedSite.description
        ),
      ],
    });
  }

  return (
    <AppLayout
      footer={
        <SiteFooter
          left="Mars Explorer / Location Archive"
          right="Source: NASA Planetary Data / Mars Trek"
        />
      }
    >
      <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-14">
        {/* Breadcrumb */}
        <nav
          className="mb-6 flex flex-wrap items-center justify-between gap-4"
          aria-label="Breadcrumb"
        >
          <div className="flex items-center gap-2 text-sm">
            <Link
              to={`/explorer?view=map&site=${selectedSite.id}`}
              className="inline-flex items-center gap-2 text-mx-muted no-underline hover:text-mx-text"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Mars map
            </Link>

            <span className="text-mx-dim">/</span>
            <span className="font-medium text-mx-text">
              {selectedSite.name}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {EXPLORATION_SITES.map((item) => (
              <Link
                key={item.id}
                to={`/explorer/location/${item.id}`}
                className={`mx-chip no-underline ${
                  item.id === selectedSite.id ? "mx-chip--active" : ""
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </nav>

        {/* Main content */}
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Location imagery */}
          <section className="lg:col-span-7" aria-label="Location imagery">
            <div className="relative overflow-hidden rounded-[10px] border border-mx-border bg-mx-panel">
              {activeImage ? (
                <img
                  src={activeImage.src}
                  alt={activeImage.caption}
                  className="aspect-[16/10] w-full object-cover"
                />
              ) : (
                <ImagePending
                  className="aspect-[16/10] border-0"
                  label={`${selectedSite.name} — Surface & Orbital Imagery Pending`}
                  detail={`Supply licensed NASA/JPL photographs in public/images/locations/${selectedSite.id}/ to populate this gallery.`}
                />
              )}

              <span className="mx-mono absolute bottom-3 right-3 rounded bg-mx-bg/90 px-2.5 py-1 text-[11px] text-mx-text">
                {selectedSite.images.length > 0
                  ? `${String(activeImageIndex + 1).padStart(2, "0")} / ${String(
                      selectedSite.images.length
                    ).padStart(2, "0")}`
                  : "00 / 00"}
              </span>
            </div>

            {selectedSite.images.length > 0 ? (
              <div className="mt-3.5 grid grid-cols-3 gap-3">
                {selectedSite.images.map((image, idx) => (
                  <button
                    key={image.src}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`group relative overflow-hidden rounded-lg border text-left transition ${
                      idx === activeImageIndex
                        ? "border-mx-accent"
                        : "border-mx-border hover:border-mx-muted"
                    }`}
                  >
                    <img
                      src={image.src}
                      alt={image.caption}
                      className="aspect-[16/9] w-full object-cover"
                    />

                    <span className="absolute bottom-2 left-2 rounded bg-mx-bg/85 px-2 py-0.5 text-[11px] text-mx-text">
                      {image.caption}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3.5 grid grid-cols-3 gap-3">
                {["Surface panorama", "Orbital view", "Geological context"].map(
                  (slot) => (
                    <div
                      key={slot}
                      className="flex aspect-[16/9] items-end rounded-lg border border-dashed border-mx-border-strong bg-mx-panel/60 p-2.5"
                    >
                      <span className="rounded bg-mx-bg/90 px-2 py-0.5 text-[11px] text-mx-dim">
                        {slot} · pending
                      </span>
                    </div>
                  )
                )}
              </div>
            )}

            <p className="mx-eyebrow mt-3 text-mx-dim">
              {selectedSite.name} · Surface &amp; orbital views · NASA / JPL
            </p>
          </section>

          {/* Location information */}
          <section
            className="flex flex-col lg:col-span-5"
            aria-label="Location details"
          >
            <p className="mx-eyebrow">{selectedSite.regionLabel} / Mars</p>

            <h1 className="mx-display m-0 mt-2 text-4xl sm:text-5xl">
              {selectedSite.name}
            </h1>

            <p className="mx-mono m-0 mt-3 inline-flex items-center gap-2 text-mx-muted">
              <MapPin
                size={14}
                className="text-mx-accent"
                aria-hidden="true"
              />
              {formatCoordinates(
                selectedSite.latitude,
                selectedSite.longitude
              )}
            </p>

            {/* Elevation information */}
            <div className="my-6 grid grid-cols-2 gap-6 border-y border-mx-border py-4">
              <div>
                <DataField
                  label="Elevation"
                  value={
                    elevationLoading
                      ? "Querying Mars DEM…"
                      : elevation
                        ? `${elevation.elevation.toFixed(2)} ${elevation.unit}`
                        : undefined
                  }
                  fallback={
                    elevationError
                      ? "Elevation query failed"
                      : "Not available"
                  }
                />

                {elevation && (
                  <p className="mx-mono mt-2 break-all text-[11px] text-mx-accent">
                    DEM product: {elevation.product_id || "Unknown"} · row{" "}
                    {elevation.row}, col {elevation.column}
                  </p>
                )}

                {elevationError && (
                  <div className="mt-2">
                    <p className="text-[10px] text-mx-dim">
                      {elevationError}
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        marsDemProvider.resetBackendCooldown();
                        setElevationRetryCount((count) => count + 1);
                      }}
                      className="mt-1.5 text-[11px] font-mono text-mx-accent hover:underline"
                    >
                      Retry DEM query
                    </button>
                  </div>
                )}
              </div>

              <DataField
                label="Terrain Type"
                value={selectedSite.terrainType}
              />
            </div>

            {/* About */}
            <div>
              <h2 className="mx-heading m-0 text-base">
                About This Location
              </h2>

              <p className="mx-body m-0 mt-2.5">
                {selectedSite.description}
              </p>
            </div>

            {/* Scientific significance */}
            {selectedSite.significance && (
              <div className="mt-6">
                <h2 className="mx-heading m-0 flex items-center gap-2 text-base">
                  <ScanSearch
                    size={16}
                    className="text-mx-accent"
                    aria-hidden="true"
                  />
                  Scientific Significance
                </h2>

                <p className="mx-body m-0 mt-2.5">
                  {selectedSite.significance}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={startInvestigationAtSite}
                className="mx-btn mx-btn--primary mx-btn--block min-h-11"
              >
                {isRegion
                  ? "Continue Scientific Investigation"
                  : "Investigate This Region"}

                <ArrowUpRight size={16} aria-hidden="true" />
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={addSiteAsTarget}
                  disabled={isTarget}
                  className="mx-btn mx-btn--secondary"
                >
                  {isTarget ? (
                    <>
                      <Check size={15} aria-hidden="true" />
                      Target Added
                    </>
                  ) : (
                    <>
                      <Target size={15} aria-hidden="true" />
                      Add as Target
                    </>
                  )}
                </button>

                <Link
                  to={`/explorer?view=map&site=${selectedSite.id}`}
                  className="mx-btn mx-btn--secondary"
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                  Back to Map
                </Link>
              </div>

              <Link
                to="/mission/simulate"
                onClick={() => {
                  if (!isRegion) {
                    setRegion(
                      buildRegion(
                        selectedSite.id,
                        selectedSite.name,
                        coordinates,
                        selectedSite.description
                      )
                    );
                  }
                }}
                className="mx-btn mx-btn--secondary mx-btn--block"
              >
                <Compass size={15} aria-hidden="true" />
                Launch 3D Surface Walk (Marswalk)
              </Link>
            </div>
          </section>
        </div>

        {/* Perseverance surface imagery */}
        {selectedSite.id === "jezero-crater" && (
          <div className="mt-12">
            <PerseveranceImageryPanel
              onLogObservationWithImage={(params) => {
                const newObs: Observation = {
                  id: createId("obs"),
                  datasetId: params.datasetId,
                  name: params.name,
                  source: `${params.surfaceImage.roverName} ${params.surfaceImage.instrument} (Surface Imagery Catalog)`,
                  coordinates: undefined,
                  observationDate: params.observationDate,
                  description: params.description,
                  provenance: {
                    source: `${params.surfaceImage.instrumentLabel} · Mars 2020 Perseverance (${params.surfaceImage.credit})`,
                    sourceId: params.sourceId,
                    sourceUrl: params.sourceUrl,
                    processingMethod: params.processingMethod,
                    limitations: [params.limitation],
                  },
                  surfaceImage: params.surfaceImage,
                };

                updateMission({
                  selectedObservations: [
                    ...toMutable(mission.selectedObservations),
                    newObs,
                  ],
                });
              }}
            />
          </div>
        )}

        {/* Recorded observations */}
        <section
          className="mt-12 border-t border-mx-border pt-8"
          aria-labelledby="site-observations-heading"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mx-eyebrow">Observation details</p>

              <h2
                id="site-observations-heading"
                className="mx-heading m-0 mt-1 text-lg"
              >
                Recorded observations near {selectedSite.name}
              </h2>
            </div>

            <Link
              to="/mission/investigate"
              className="mx-btn mx-btn--secondary mx-btn--sm"
            >
              <FlaskConical size={14} aria-hidden="true" />
              Open investigation workspace
            </Link>
          </div>

          {siteObservations.length === 0 ? (
            <EmptyState
              compact
              title="No observations logged for this location yet"
            >
              Record orbital or surface observations in the Scientific
              Investigation workspace to associate them with {selectedSite.name}.
            </EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {siteObservations.map((obs) => (
                <div key={obs.id} className="mx-panel p-4">
                  <span className="mx-eyebrow mx-eyebrow--accent">
                    {obs.source}
                  </span>

                  <h3 className="mx-heading m-0 mt-1 text-base">
                    {obs.name}
                  </h3>

                  {obs.description && (
                    <p className="mx-body m-0 mt-1.5 text-[13px]">
                      {obs.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppLayout>
  );
}

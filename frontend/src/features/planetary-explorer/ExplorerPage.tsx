import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Globe,
  Map as MapIcon,
  MapPin,
} from "lucide-react";

import MarsGlobe from "../../globe/MarsGlobe";
import MarsMap from "../../components/map/MarsMap";
import AppLayout from "../../components/layout/AppLayout";
import { useMission } from "../../state/mission/MissionContext";
import { getSiteByName } from "../../data/explorationSites";

// ==========================================
// TYPES
// ==========================================

type ExplorerView = "globe" | "map";

// ==========================================
// MAIN PAGE
// ==========================================

export default function ExplorerPage() {
  const [searchParams] = useSearchParams();

  const [view, setView] = useState<ExplorerView>(
    searchParams.get("view") === "map" ? "map" : "globe"
  );

  const [focusSiteId, setFocusSiteId] = useState<string | null>(
    searchParams.get("site")
  );

  const { mission, setRegion } = useMission();

  // Keep deep-link state synchronized when the URL changes.
  useEffect(() => {
    const requestedView = searchParams.get("view");
    const requestedSite = searchParams.get("site");

    setView(requestedView === "map" ? "map" : "globe");
    setFocusSiteId(requestedSite);
  }, [searchParams]);

  const tabClass = (active: boolean) =>
    `mx-chip ${active ? "mx-chip--active" : ""}`;

  return (
    <AppLayout fullscreen>
      <main className="relative h-full w-full overflow-hidden bg-[#05070d]">
        <div
          className="absolute left-1/2 top-5 z-[1050] flex -translate-x-1/2 gap-1 rounded-lg border border-mx-border bg-mx-bg/90 p-1 backdrop-blur"
          role="group"
          aria-label="Explorer view"
        >
          <button
            type="button"
            className={tabClass(view === "globe")}
            aria-pressed={view === "globe"}
            onClick={() => setView("globe")}
          >
            <Globe size={13} aria-hidden="true" />
            3D Globe
          </button>

          <button
            type="button"
            className={tabClass(view === "map")}
            aria-pressed={view === "map"}
            onClick={() => setView("map")}
          >
            <MapIcon size={13} aria-hidden="true" />
            2D Map
          </button>
        </div>

        <div className="h-full w-full">
          {view === "globe" ? (
            <MarsGlobe
              renderLocationActions={(location) => {
                const site = getSiteByName(location.name);

                if (!site) return null;

                const isRegion = mission.region?.id === site.id;

                return (
                  <>
                    <button
                      type="button"
                      className="mx-btn mx-btn--primary mx-btn--block"
                      onClick={() => {
                        setFocusSiteId(site.id);
                        setView("map");
                      }}
                    >
                      Explore regional map
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>

                    <Link
                      to={`/explorer/location/${site.id}`}
                      className="mx-btn mx-btn--secondary mx-btn--block"
                    >
                      View location information
                    </Link>

                    <button
                      type="button"
                      className="mx-btn mx-btn--ghost mx-btn--sm self-center"
                      disabled={isRegion}
                      onClick={() => {
                        setRegion({
                          id: site.id,
                          name: site.name,
                          coordinates: {
                            latitude: site.latitude,
                            longitude: site.longitude,
                          },
                          description: site.description,
                        });
                      }}
                    >
                      {isRegion ? (
                        <>
                          <Check size={14} aria-hidden="true" />
                          Expedition region
                        </>
                      ) : (
                        <>
                          <MapPin size={14} aria-hidden="true" />
                          Set as expedition region
                        </>
                      )}
                    </button>
                  </>
                );
              }}
            />
          ) : (
            <MarsMap
              focusSiteId={focusSiteId ?? undefined}
            />
          )}
        </div>
      </main>
    </AppLayout>
  );
}
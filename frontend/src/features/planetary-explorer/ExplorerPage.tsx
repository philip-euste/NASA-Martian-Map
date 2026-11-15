import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import { getSiteById } from "../../data/explorationSites";
import MarsExplorer from "../mars-explorer/MarsExplorer";
import type { ExplorerViewMode } from "../mars-explorer/marsExplorer.types";
import {
  MarsExplorerProvider,
  useMarsExplorer,
} from "../mars-explorer/useMarsExplorer";

function parseViewParam(value: string | null): ExplorerViewMode {
  if (value === "map") return "map";
  if (value === "jezero") return "jezero";
  return "globe";
}

function ExplorerUrlSync() {
  const [searchParams] = useSearchParams();
  const { setViewMode, selectSite } = useMarsExplorer();
  const lastAppliedView = useRef<string | null>(null);
  const lastAppliedSite = useRef<string | null>(null);

  useEffect(() => {
    const requestedView = searchParams.get("view");
    const requestedSite = searchParams.get("site");

    if (requestedView && requestedView !== lastAppliedView.current) {
      lastAppliedView.current = requestedView;
      setViewMode(parseViewParam(requestedView));
    }

    if (requestedSite && requestedSite !== lastAppliedSite.current) {
      lastAppliedSite.current = requestedSite;
      const site = getSiteById(requestedSite);
      if (site) {
        selectSite(site, { focus: true });
      }
    }
  }, [searchParams, setViewMode, selectSite]);

  return null;
}

export default function ExplorerPage() {
  const [searchParams] = useSearchParams();
  const initialViewMode = parseViewParam(searchParams.get("view"));
  const initialSiteId = searchParams.get("site");

  return (
    <AppLayout fullscreen>
      <main className="relative h-full w-full overflow-hidden bg-[#0e0d10]">
        <MarsExplorerProvider
          initialViewMode={initialViewMode}
          initialSiteId={initialSiteId}
        >
          <ExplorerUrlSync />
          <MarsExplorer />
        </MarsExplorerProvider>
      </main>
    </AppLayout>
  );
}

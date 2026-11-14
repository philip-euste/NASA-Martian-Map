// frontend\src\features\planetary-explorer\ExplorerPage.tsx

import { useState } from "react";
import MarsGlobe from "../../globe/MarsGlobe";
import MarsMap from "../../components/map/MarsMap";

type ExplorerView = "globe" | "map";

export default function ExplorerPage() {
  const [view, setView] = useState<ExplorerView>("globe");

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "9px 16px",
    border: "1px solid #ffffff25",
    borderRadius: 7,
    background: active ? "#a84f32" : "#101827",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  });

  return (
    <main
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        minHeight: 600,
        overflow: "hidden",
        background: "#080b14",
      }}
    >
      <div
        style={{
          position: "absolute",
          zIndex: 20,
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 6,
          padding: 5,
          border: "1px solid #ffffff20",
          borderRadius: 10,
          background: "#101827dd",
          backdropFilter: "blur(12px)",
        }}
      >
        <button
          type="button"
          style={tabStyle(view === "globe")}
          onClick={() => setView("globe")}
        >
          3D Globe
        </button>

        <button
          type="button"
          style={tabStyle(view === "map")}
          onClick={() => setView("map")}
        >
          2D Map
        </button>
      </div>

      <div
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        {view === "globe" ? <MarsGlobe /> : <MarsMap />}
      </div>
    </main>
  );
}

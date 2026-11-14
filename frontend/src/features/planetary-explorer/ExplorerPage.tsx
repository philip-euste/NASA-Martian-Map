// frontend\src\features\planetary-explorer\ExplorerPage.tsx
import { useMemo, useState } from "react";

import MarsGlobe from "../../globe/MarsGlobe";
import MarsMap from "../../components/map/MarsMap";

import {
  MARS_LOCATIONS,
  type MarsLocation,
} from "../../data/marsLocations";

type MapMode = "2D MAP" | "ORBITAL";

type Coordinates = {
  latitude: number;
  longitude: number;
};

function formatCoordinate(
  value: number,
  positive: string,
  negative: string
) {
  return `${Math.abs(value).toFixed(2)}° ${
    value >= 0 ? positive : negative
  }`;
}

export default function ExplorerPage() {
  const [selectedLocation, setSelectedLocation] =
    useState<MarsLocation>(MARS_LOCATIONS[0]);

  const [searchQuery, setSearchQuery] =
    useState("Jezero Crater");

  const [mapMode, setMapMode] =
    useState<MapMode>("ORBITAL");

  const [isSidebarOpen, setIsSidebarOpen] =
    useState(true);

  const [mapCoordinates, setMapCoordinates] =
    useState<Coordinates | null>(null);

  const filteredLocations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return MARS_LOCATIONS;

    return MARS_LOCATIONS.filter((location) =>
      location.name.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const selectLocation = (location: MarsLocation) => {
    setSelectedLocation(location);
    setMapCoordinates({
      latitude: location.latitude,
      longitude: location.longitude,
    });
    setSearchQuery(location.name);
    setIsSidebarOpen(true);
  };

  const coordinates = `${formatCoordinate(
    selectedLocation.latitude,
    "N",
    "S"
  )}  ${formatCoordinate(
    selectedLocation.longitude,
    "E",
    "W"
  )}`;

  return (
    <main className={`mars-explorer ${mapMode === "ORBITAL" ? "orbital-mode" : "surface-mode"}`}>
      <header className="mars-topbar">
        <nav className="mars-nav">
          <button type="button">Home</button>

          <button type="button" className="active">
            Explore
          </button>

          <button type="button">About</button>
        </nav>

        <button
          type="button"
          className="mars-get-started"
          onClick={() => setMapMode("ORBITAL")}
        >
          Get Started <span>↗</span>
        </button>
      </header>

      <section className="mars-map-stage">
        <div className="mars-map-renderer">
          {mapMode === "ORBITAL" ? (
            <MarsGlobe
              selectedLocationName={selectedLocation.name}
              onLocationSelect={(name) => {
                const location = MARS_LOCATIONS.find(
                  (item) => item.name === name
                );

                if (location) {
                  selectLocation(location);
                }
              }}
            />
          ) : (
            <MarsMap
              focusLocation={mapCoordinates}
              onLocationSelect={(coordinates) => {
                setMapCoordinates(coordinates);

                const matchingLocation = MARS_LOCATIONS.find(
                  (location) =>
                    Math.abs(location.latitude - coordinates.latitude) < 0.01 &&
                    Math.abs(location.longitude - coordinates.longitude) < 0.01
                );

                if (matchingLocation) {
                  setSelectedLocation(matchingLocation);
                  setSearchQuery(matchingLocation.name);
                }

                setIsSidebarOpen(true);
              }}
            />
          )}
        </div>

        <div className="mars-floating-controls">
          <div className="mars-search-container">
            <span className="mars-search-icon">⌕</span>

            <input
              type="text"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder="Search Martian locations..."
              aria-label="Search Martian locations"
            />

            {searchQuery && (
              <div className="mars-search-results">
                {filteredLocations.length > 0 ? (
                  filteredLocations.map((location) => (
                    <button
                      type="button"
                      key={location.id}
                      onClick={() => selectLocation(location)}
                    >
                      {location.name}
                    </button>
                  ))
                ) : (
                  <span>No matching locations</span>
                )}
              </div>
            )}
          </div>

          <div className="mars-mode-switcher">
            <button
              type="button"
              className={mapMode === "2D MAP" ? "active" : ""}
              onClick={() => setMapMode("2D MAP")}
            >
              2D MAP
            </button>

            <button
              type="button"
              className={mapMode === "ORBITAL" ? "active" : ""}
              onClick={() => setMapMode("ORBITAL")}
            >
              ORBITAL
            </button>
          </div>
        </div>

        <aside className="mars-map-toolbar">
          <button
            type="button"
            onClick={() => setMapMode("ORBITAL")}
            title="Orbital view"
          >
            ◉
          </button>

          <button
            type="button"
            onClick={() => setMapMode("2D MAP")}
            title="Surface map"
          >
            ⌖
          </button>

          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            title="Show selected location"
          >
            ☰
          </button>
        </aside>

        {isSidebarOpen && (
          <aside className="mars-location-panel">
            <div className="mars-panel-header">
              <span>SELECTED LOCATION</span>

              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                aria-label="Close selected location panel"
              >
                ×
              </button>
            </div>

            <div className="mars-location-preview">
              <div className="preview-caption">
                MARTIAN TERRAIN
              </div>
            </div>

            <div className="mars-location-title">
              <h2>{selectedLocation.name}</h2>
              <span>{selectedLocation.category}</span>
            </div>

            <p className="mars-location-coordinates">
              {coordinates}
            </p>

            <p className="mars-location-description">
              {selectedLocation.description}
            </p>

            <button
              type="button"
              className="mars-simulation-button"
              onClick={() => setMapMode(
                mapMode === "ORBITAL" ? "2D MAP" : "ORBITAL"
              )}
            >
              {mapMode === "ORBITAL"
                ? "View on Surface Map"
                : "Return to Orbital View"}
              <span>↗</span>
            </button>

            <button
              type="button"
              className="mars-location-information"
              onClick={() => setSearchQuery(selectedLocation.name)}
            >
              View location information →
            </button>
          </aside>
        )}

        <footer className="mars-map-footer">
          <div className="mars-coordinate-display">
            <span>{coordinates}</span>

            {mapMode === "2D MAP" && (
              <div className="mars-scale">
                <span />
                <small>Map scale varies with zoom</small>
              </div>
            )}
          </div>

          <span className="mars-map-credit">
            TERRAIN: NASA / JPL-CALTECH / USGS
          </span>
        </footer>
      </section>
    </main>
  );
}

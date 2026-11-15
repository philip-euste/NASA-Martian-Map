import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const source = await readFile(new URL("../src/simulator/shared/environment.ts", import.meta.url), "utf8");
const { code } = await transform(source, { loader: "ts", format: "esm" });
const { isWithinBounds, normalizeEastLongitude } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);
const melasBounds = { westLonDeg: 281.5, eastLonDeg: 285.8, southLatDeg: -11.5, northLatDeg: -8 };

assert.equal(normalizeEastLongitude(-76.4), 283.6);
assert.equal(normalizeEastLongitude(283.6), 283.6);
assert.equal(isWithinBounds(melasBounds, { latitude: -9.8, longitude: -76.4 }), true);
assert.equal(isWithinBounds(melasBounds, { latitude: -13.9, longitude: -59.2 }), false);
assert.equal(isWithinBounds(melasBounds, { latitude: Number.NaN, longitude: 283.6 }), false);
assert.equal(isWithinBounds(melasBounds, { latitude: -9.8, longitude: Number.POSITIVE_INFINITY }), false);

const temporalSource = await readFile(new URL("../src/utils/temporalFilters.ts", import.meta.url), "utf8");
const temporalCode = await transform(temporalSource, { loader: "ts", format: "esm" });
const { filterProductsThroughDate } = await import(
  `data:text/javascript;base64,${Buffer.from(temporalCode.code).toString("base64")}`
);
const medaProducts = [
  { start_time: "2021-02-19T21:00:00Z", stop_time: "2021-02-19T22:00:00Z", id: "sol-1" },
  { start_time: "2021-03-01T23:55:00Z", stop_time: "2021-03-02T00:05:00Z", id: "crosses-cutoff" },
  { start_time: "2021-03-26T21:00:00Z", stop_time: "2021-03-26T22:00:00Z", id: "sol-36" },
  { start_time: "not-a-date", stop_time: "not-a-date", id: "invalid" },
];
assert.deepEqual(filterProductsThroughDate(medaProducts, "2021-03-01").map((p) => p.id), ["sol-1"]);
assert.deepEqual(filterProductsThroughDate(medaProducts, "not-a-date"), []);

for (const file of ["jezero", "gale", "valles-marineris", "olympus-mons"]) {
  const geojson = JSON.parse(await readFile(new URL(`../public/data/boundaries/${file}.geojson`, import.meta.url), "utf8"));
  assert.equal(geojson.type, "Feature");
  assert.equal(geojson.geometry.type, "Polygon");
  const ring = geojson.geometry.coordinates[0];
  assert.deepEqual(ring[0], ring.at(-1));
  assert.match(geojson.properties.boundary_accuracy, /not a geological boundary/);
}

console.log("Mars audit self-check passed (24 assertions across coordinates, MEDA date filtering, and fallback GeoJSON).");

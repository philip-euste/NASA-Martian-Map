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

console.log("Mars coordinate self-check passed (6 assertions).");

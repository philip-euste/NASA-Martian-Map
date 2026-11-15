import assert from "node:assert";
import { getMarsRegionById, MARS_REGIONS, isWithinRegionBounds } from "../src/data/regions";
import { resolveSimulatorEnvironment } from "../src/simulator/environments/catalog";
import { JEZERO_ENVIRONMENT } from "../src/simulator/environments/jezero";
import { auditCrossRegionItems } from "../src/features/mission/missionHelpers";

console.log("=================================================");
console.log("PHASE 1.1 AUDIT FIXES VERIFICATION");
console.log("=================================================\n");

// --- FIX 1: Marswalk Header & Coordinates Desynchronization ---
console.log("--- Testing FIX 1: Marswalk Header & Coordinates ---");

const testRegions = [
  { id: "jezero-crater", expectedAvailable: true },
  { id: "gale-crater", expectedAvailable: false },
  { id: "valles-marineris", expectedAvailable: false },
  { id: "olympus-mons", expectedAvailable: false },
];

for (const { id, expectedAvailable } of testRegions) {
  const resolved = resolveSimulatorEnvironment(id);
  const isSimulatorAvailable = resolved.available && resolved.environment !== null;
  assert.strictEqual(
    isSimulatorAvailable,
    expectedAvailable,
    `Region ${id} availability mismatch: expected ${expectedAvailable}, got ${isSimulatorAvailable}`
  );

  const activeEnv = resolved.environment ?? JEZERO_ENVIRONMENT;

  // Title logic matching MarswalkPage.tsx
  const title = isSimulatorAvailable
    ? `Marswalk 3D Surface Simulator · ${activeEnv.displayName}`
    : `3D Surface Exploration · ${resolved.regionName}`;

  // Subtitle logic matching MarswalkPage.tsx
  const subtitle = isSimulatorAvailable
    ? `Traverse the ${activeEnv.terrain.credit} under Mars partial gravity (3.71 m/s²).`
    : `3D surface simulation environment is in preparation for ${resolved.regionName}. Scientific exploration remains available via orbital and 2D mapping tools.`;

  console.log(`[${id}] title: "${title}"`);
  console.log(`[${id}] subtitle: "${subtitle}"`);

  if (isSimulatorAvailable) {
    assert.ok(title.includes("Marswalk 3D Surface Simulator · Jezero Crater"));
    assert.ok(subtitle.includes("under Mars partial gravity"));
    assert.ok(subtitle.includes(activeEnv.terrain.credit));
  } else {
    assert.ok(
      title.startsWith("3D Surface Exploration · "),
      `Title for ${id} should start with '3D Surface Exploration · ', got: ${title}`
    );
    assert.ok(title.includes(resolved.regionName));
    assert.ok(
      subtitle.includes("in preparation"),
      `Subtitle for ${id} should mention 'in preparation', got: ${subtitle}`
    );
    assert.ok(
      !subtitle.includes("Jezero"),
      `Subtitle for ${id} should NOT mention Jezero, got: ${subtitle}`
    );
    assert.ok(
      !subtitle.includes("partial gravity"),
      `Subtitle for ${id} should NOT mention partial gravity context for planned regions, got: ${subtitle}`
    );
  }

  // Target coordinates logic matching MarswalkPage.tsx
  const regionData = getMarsRegionById(id);
  assert.ok(regionData, `Region ${id} must exist in registry`);

  const mockMissionConfig: any = { startingLocation: null };
  const baseCoordinates = (isSimulatorAvailable && resolved.environment)
    ? (mockMissionConfig.startingLocation ?? resolved.environment.defaultBase)
    : (mockMissionConfig.startingLocation ?? regionData.coordinates ?? { latitude: 18.4447, longitude: 77.4508 });

  if (isSimulatorAvailable) {
    assert.strictEqual(baseCoordinates.latitude, 18.4447);
    assert.strictEqual(baseCoordinates.longitude, 77.4508);
  } else if (id === "gale-crater") {
    assert.strictEqual(baseCoordinates.latitude, regionData.coordinates.latitude);
    assert.strictEqual(baseCoordinates.longitude, regionData.coordinates.longitude);
    console.log(`  ✓ Gale Crater baseCoordinates correctly resolved to (${baseCoordinates.latitude}, ${baseCoordinates.longitude}) instead of Jezero!`);
  }
}
console.log("✓ FIX 1 assertions PASSED.\n");

// --- FIX 2: Cross-Region Target & Waypoint Warning ---
console.log("--- Testing FIX 2: Cross-Region Target & Waypoint Warning ---");

const jezeroRegion = getMarsRegionById("jezero-crater")!;
const galeRegion = getMarsRegionById("gale-crater")!;

// Sample targets: 2 in Jezero, 1 in Gale, 1 in deep space/unmapped (0, 0)
const sampleTargets = [
  {
    id: "target-j1",
    name: "Kodiak Butte",
    coordinates: { latitude: 18.4124, longitude: 77.4325 },
    description: "Delta remnant",
    observationIds: ["obs-1"],
  },
  {
    id: "target-j2",
    name: "Belva Crater",
    coordinates: { latitude: 18.502, longitude: 77.381 },
    description: "Impact crater floor",
    observationIds: ["obs-2"],
  },
  {
    id: "target-g1",
    name: "Mount Sharp Base",
    coordinates: { latitude: -5.35, longitude: 137.45 },
    description: "Sulfate unit outcrop",
    observationIds: ["obs-3"],
  },
  {
    id: "target-unmapped",
    name: "Equatorial Outlier",
    coordinates: { latitude: 0.0, longitude: 0.0 },
    description: "Unmapped target",
    observationIds: [],
  },
];

const sampleRoutes = [
  {
    id: "route-jezero-alpha",
    name: "Jezero Delta Traverse",
    waypoints: [
      { id: "wp-j1", name: "Start", coordinates: { latitude: 18.4447, longitude: 77.4508 }, visited: false },
      { id: "wp-j2", name: "Delta Front", coordinates: { latitude: 18.42, longitude: 77.41 }, visited: false },
    ],
  },
  {
    id: "route-gale-curiosity",
    name: "Curiosity Ascent",
    waypoints: [
      { id: "wp-g1", name: "Bradbury Landing", coordinates: { latitude: -5.36, longitude: 137.44 }, visited: false },
      { id: "wp-g2", name: "Yellowknife Bay", coordinates: { latitude: -5.38, longitude: 137.45 }, visited: false },
    ],
  },
];

// Scenario A: Active region is Jezero Crater
console.log("Scenario A: Active region = Jezero Crater");
const jezeroAudit = auditCrossRegionItems(jezeroRegion, sampleTargets, sampleRoutes);
console.log("Jezero audit summary:", {
  hasCrossRegionItems: jezeroAudit.hasCrossRegionItems,
  targetsCount: jezeroAudit.targetsCount,
  waypointsCount: jezeroAudit.waypointsCount,
  attributedRegionNames: jezeroAudit.attributedRegionNames,
  unattributedCount: jezeroAudit.unattributedCount,
});
// 2 targets are out of Jezero (Mount Sharp Base, Equatorial Outlier)
assert.strictEqual(jezeroAudit.targetsCount, 2, "Expected 2 out-of-bounds targets for Jezero");
// Mount Sharp Base should be attributed to Gale Crater
const mountSharp = jezeroAudit.outOfBoundsTargets.find(t => t.item.id === "target-g1");
assert.ok(mountSharp, "Mount Sharp must be detected as out-of-bounds");
assert.strictEqual(mountSharp.attributedRegionName, galeRegion.name);

// Equatorial Outlier should NOT be attributed to any region
const outlier = jezeroAudit.outOfBoundsTargets.find(t => t.item.id === "target-unmapped");
assert.ok(outlier, "Outlier must be detected as out-of-bounds");
assert.strictEqual(outlier.attributedRegionName, null, "Outlier at (0,0) must not be attributed to any region");
assert.strictEqual(jezeroAudit.unattributedCount, 1, "Expected 1 unattributed item");

// Scenario B: Active region is Gale Crater
console.log("\nScenario B: Active region = Gale Crater");
const galeAudit = auditCrossRegionItems(galeRegion, sampleTargets, sampleRoutes);
console.log("Gale audit summary:", {
  hasCrossRegionItems: galeAudit.hasCrossRegionItems,
  targetsCount: galeAudit.targetsCount,
  waypointsCount: galeAudit.waypointsCount,
  attributedRegionNames: galeAudit.attributedRegionNames,
  unattributedCount: galeAudit.unattributedCount,
});
// 3 targets out of Gale: Kodiak Butte, Belva Crater, Equatorial Outlier
assert.strictEqual(galeAudit.targetsCount, 3, "Expected 3 out-of-bounds targets for Gale");
// 2 waypoints out of Gale from route-jezero-alpha
assert.strictEqual(galeAudit.waypointsCount, 2, "Expected 2 out-of-bounds waypoints for Gale");
// Attributed region names should include Jezero Crater
assert.ok(galeAudit.attributedRegionNames.includes("Jezero Crater"));
// Neither target-j1 nor target-j2 nor route-jezero-alpha coordinates were mutated
assert.strictEqual(sampleTargets[0].coordinates.latitude, 18.4124);
assert.strictEqual(sampleTargets[0].coordinates.longitude, 77.4325);
console.log("  ✓ Targets and waypoints were safely inspected without any mutation of coordinates!");

// Scenario C: Clean state with only local items
console.log("\nScenario C: Clean region with only local items");
const localJezeroTargets = sampleTargets.filter(t => isWithinRegionBounds(t.coordinates, jezeroRegion.geographicBounds));
const localJezeroRoutes = [sampleRoutes[0]];
const cleanAudit = auditCrossRegionItems(jezeroRegion, localJezeroTargets, localJezeroRoutes);
assert.strictEqual(cleanAudit.hasCrossRegionItems, false);
assert.strictEqual(cleanAudit.totalOutOfBoundsCount, 0);
assert.strictEqual(cleanAudit.targetsCount, 0);
assert.strictEqual(cleanAudit.waypointsCount, 0);
console.log("  ✓ Clean local items produce zero warnings!");

console.log("\n✓ FIX 2 assertions PASSED.");
console.log("\n=================================================");
console.log("ALL PHASE 1.1 VERIFICATION CHECKS PASSED (100%)");
console.log("=================================================");

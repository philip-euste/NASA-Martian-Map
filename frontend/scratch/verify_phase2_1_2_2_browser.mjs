// Run against the production build with Node's test runner and playwright-core.
// Set MARTIAN_BROWSER_EXECUTABLE to the path of a local Chromium browser.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { preview } from "vite";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const executablePath = process.env.MARTIAN_BROWSER_EXECUTABLE;
assert.ok(executablePath, "Set MARTIAN_BROWSER_EXECUTABLE to a local Chromium executable");

const dustWarning = "Surface dust can weaken bedrock features in TES thermal-infrared spectra. Treat weak or missing mineral signatures in dusty areas as inconclusive";
const unverifiedSource = "Bundled CRISM reference profile (unverified extraction)";
const bundleId = "urn:nasa:pds:mro_crism_mtrdr";
const tesDatasets = [/TES Sheet Silicate/, /TES High-Calcium Pyroxene/, /TES Plagioclase Feldspar/];

function datasetCard(page, name) {
  return page.getByRole("heading", { name }).locator(
    "xpath=ancestor::div[.//button[contains(., 'Details & limits') or contains(., 'Hide metadata')]][1]"
  );
}

test("Phase 2.1.2.2 production browser verification", async (suite) => {
  const server = await preview({
    root: fileURLToPath(new URL("../", import.meta.url)),
    preview: { host: "127.0.0.1", port: 0 },
    logLevel: "error",
  });
  suite.after(() => server.close());
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const browser = await chromium.launch({ executablePath, headless: true });
  suite.after(() => browser.close());
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(8000);
  // Exercise local interactions independently of remote map tiles and API availability.
  await page.route("**/*", (route) =>
    route.request().url().startsWith(origin + "/") ? route.continue() : route.abort()
  );
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const investigate = () => page.goto(origin + "/mission/investigate");
  const selectRegion = (name) => page.getByRole("button", { name }).and(page.locator("[aria-pressed]")).click();
  const openObservationForm = async () => {
    if (!(await page.locator("#obs-dataset").isVisible())) {
      await page.getByRole("button", { name: "Log Observation", exact: true }).click();
    }
  };
  const openReport = async () => {
    await page.goto(origin + "/mission/report");
    await page.getByRole("button", { name: "Compile Report from Mission State" }).click();
  };
  const reportMarkdown = async () => {
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export .MD" }).click();
    const download = await downloadEvent;
    return readFile(await download.path(), "utf8");
  };

  await suite.test("Investigation TES badges and expanded limitations", async () => {
    await investigate();
    await selectRegion(/^Olympus Mons/);
    for (const name of tesDatasets) {
      const card = datasetCard(page, name);
      assert.match(await card.innerText(), /Regional Caveat/);
      await card.getByRole("button", { name: "Details & limits" }).click();
      const details = await card.innerText();
      assert.ok(details.includes(dustWarning));
      assert.doesNotMatch(details, /wind-scoured|tens of microns|thick airfall|dominated by dust cover/i);
    }
    assert.match(await datasetCard(page, tesDatasets[1]).innerText(), /lower values generally indicate dustier surfaces/);
  });

  await suite.test("Olympus live context card and saved TES record", async () => {
    await openObservationForm();
    await page.locator("#obs-dataset").selectOption("mars_tes_pyroxene");
    const card = page.getByText(/Regional Interpretive Caveat \(Olympus Mons/);
    assert.ok((await card.locator("..").innerText()).includes(dustWarning));
    await page.getByLabel("Observation title *", { exact: true }).fill("Olympus TES verification");
    await page.getByRole("button", { name: "Save Observation", exact: true }).click();
    await page.getByText("Olympus TES verification", { exact: true }).waitFor();
  });

  await suite.test("Evidence Inspector displays the Olympus TES caveat", async () => {
    await page.goto(origin + "/mission/evidence");
    const caveat = page.getByText(/Regional Caveat \(Olympus Mons/);
    assert.ok((await caveat.locator("..").innerText()).includes(dustWarning));
  });

  await suite.test("Olympus TES report and downloaded Markdown agree", async () => {
    await openReport();
    const name = "TES High-Calcium Pyroxene Abundance (~3–8 km/px)";
    const row = page.getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) });
    const source = "TES (Thermal Emission Spectrometer) · Mars Global Surveyor (MGS)";
    assert.equal(await row.innerText(), `${name} (${source})`);
    assert.ok((await reportMarkdown()).includes(`- **${name}** (${source})`));
  });

  await suite.test("Jezero CRISM catalog, archive identifier, and live context", async () => {
    await investigate();
    await selectRegion(/^Jezero Crater/);
    for (const name of tesDatasets) {
      assert.doesNotMatch(await datasetCard(page, name).innerText(), /Regional Caveat/);
    }
    const card = datasetCard(page, "CRISM VNIR Reference Profiles (Jezero)");
    assert.match(await card.innerText(), /Bundled Reference Profiles/);
    await card.getByRole("button", { name: "Details & limits" }).click();
    const details = await card.innerText();
    assert.ok(details.includes(bundleId));
    assert.match(details, /unverified extraction provenance/);
    await openObservationForm();
    await page.locator("#obs-dataset").selectOption("crism_jezero_vnir");
    assert.match(await page.getByText("Profile contents", { exact: false }).locator("..").innerText(), /Preset wavelength/);
    await page.getByText("Bundled Reference Profiles · Unverified Extraction", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Hide Form", exact: true }).click();
  });

  await suite.test("Jezero CRISM profile labels, sample counts, and Inspector provenance", async () => {
    await page.getByRole("button", { name: "Inspect CRISM Spectra" }).click();
    const panel = page.getByRole("region", { name: "CRISM VNIR Reference Inspector" });
    assert.match(await panel.innerText(), /unverified extraction provenance/);
    for (const [button, observation, archive, count] of [
      ["Delta Smectite Clay", "FRT00005C5E", "frt00005c5e_07_if166j_mtr3::1.0", 22],
      ["Marginal Carbonate", "HRL000040FF", "hrl000040ff_07_if183j_mtr3::1.0", 20],
      ["Séítah Olivine", "FRT0000B204", "Archive product unconfirmed", 17],
    ]) {
      await panel.getByRole("button", { name: button, exact: true }).click();
      const text = await panel.innerText();
      assert.ok(text.includes(observation));
      assert.ok(text.includes(archive));
      assert.equal(await panel.locator("svg[viewBox='0 0 600 220'] circle").count(), count);
    }
    await panel.getByRole("button", { name: "Planetary Science Provenance & Limitations Notice" }).click();
    await panel.getByText("Interpreting the reference profiles", { exact: true }).waitFor();
    await panel.getByRole("button", { name: "Record Reference Profile" }).click();
    await page.getByText("CRISM reference · Séítah Formation — Olivine Cumulate Bedrock", { exact: true }).waitFor();

    await page.goto(origin + "/mission/evidence");
    await page.getByRole("button", { name: /CRISM reference · Séítah Formation/ }).click();
    const record = page.getByRole("region", { name: "Observation provenance" });
    await record.getByRole("heading", { name: /CRISM reference · Séítah Formation/ }).waitFor();
    const provenance = await record.textContent();
    assert.ok(provenance.includes(unverifiedSource));
    assert.match(provenance, /Reference Profile \/ Method/);
    assert.doesNotMatch(provenance, /544-channel|Targeted Spectral Cube/);
    await page.getByRole("region", { name: "CRISM VNIR Reference Inspector" }).waitFor();
  });

  await suite.test("Jezero CRISM report, downloaded Markdown, and narrow layout", async () => {
    await openReport();
    const name = "CRISM VNIR Reference Profiles (Jezero)";
    const row = page.getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) });
    const source = `${unverifiedSource} · NASA PDS MTRDR archive ${bundleId}`;
    assert.equal(await row.innerText(), `${name} (${source})`);
    const markdown = await reportMarkdown();
    assert.ok(markdown.includes(`- **${name}** (${source})`));
    assert.ok(markdown.includes(`**CRISM reference · Séítah Formation — Olivine Cumulate Bedrock** (${unverifiedSource})`));
    assert.doesNotMatch(markdown, /Targeted Spectral Cube|if166l_mtr3/);

    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await row.evaluate((element) => element.scrollWidth <= element.clientWidth + 1));
    await investigate();
    const panel = page.getByRole("region", { name: "CRISM VNIR Reference Inspector" });
    await panel.waitFor();
    assert.ok(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1));
  });

  assert.deepEqual(errors, [], "The audited pages should render without uncaught browser errors");
});

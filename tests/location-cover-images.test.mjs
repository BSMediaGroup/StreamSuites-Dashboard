import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const workspaceRoot = resolve(repoRoot, "..");
const manifest = JSON.parse(await readFile(new URL("../docs/shared/data/location-cover-images.json", import.meta.url), "utf8"));
const siblingManifest = JSON.parse(await readFile(resolve(workspaceRoot, "DanielClancy-Admin", "assets/data/location-cover-images.json"), "utf8"));
const analyticsJs = await readFile(new URL("../docs/js/analytics.js", import.meta.url), "utf8");
const componentsCss = await readFile(new URL("../docs/css/components.css", import.meta.url), "utf8");

const requiredLocations = [
  "us:oregon:portland",
  "us:california:los-angeles",
  "us:california:santa-clara",
  "us:virginia:ashburn",
  "gb:england:london",
  "ls:maseru-district:maseru",
  "dk:capital-region:copenhagen",
  "pt:lisbon",
  "pt:faro:portimao",
  "us:oregon:boardman",
  "au:new-south-wales:sydney",
  "au:victoria:melbourne",
  "ca:ontario:toronto",
  "br:sao-paulo:sao-paulo",
  "br:rio-de-janeiro:rio-de-janeiro"
];

const requiredCountries = ["us", "gb", "ls", "dk", "pt", "au", "ca", "br", "de", "fr", "nl", "jp", "sg", "ie", "nz"];
const allowedImageExt = /\.(webp|jpe?g|png)$/i;

function localAssetPath(imagePath) {
  return join(repoRoot, "docs", imagePath.replace(/^\/assets\//, "assets/"));
}

function allEntries(sourceManifest = manifest) {
  return [
    sourceManifest.defaultFallbackMeta,
    ...Object.values(sourceManifest.locations || {}),
    ...Object.values(sourceManifest.countryFallbacks || {})
  ];
}

function analyticsMapHelpers() {
  const sandboxWindow = {
    StreamSuitesCountryFlags: {
      renderFlagSlotHtml(code) {
        return `<span data-ss-country-flag-slot="${code}"></span>`;
      },
      upgradeFlagSlots() {}
    }
  };
  const sandbox = {
    window: sandboxWindow,
    document: {
      getElementById() {
        return null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      }
    },
    console,
    Intl,
    setTimeout,
    clearTimeout,
    requestAnimationFrame() {
      return 0;
    },
    cancelAnimationFrame() {},
    HTMLElement: class HTMLElement {},
    HTMLButtonElement: class HTMLButtonElement {},
    HTMLTableRowElement: class HTMLTableRowElement {},
    HTMLTableCellElement: class HTMLTableCellElement {},
    HTMLSelectElement: class HTMLSelectElement {}
  };
  vm.runInNewContext(analyticsJs, sandbox);
  return sandboxWindow.StreamSuitesAnalyticsMapLocationDebug;
}

test("location cover manifest has required raster city and country-capital coverage", () => {
  assert.equal(manifest.schemaVersion, "location-cover-images.v2");
  assert.deepEqual(manifest.sourcesSearched, ["Wikimedia Commons", "Openverse"]);
  for (const key of requiredLocations) {
    assert.ok(manifest.locations[key], `${key} missing`);
    assert.equal(manifest.locations[key].sourceQuality, "real_raster", `${key} must use real raster`);
  }
  for (const key of requiredCountries) {
    assert.ok(manifest.countryFallbacks[key], `${key} country fallback missing`);
    assert.equal(manifest.countryFallbacks[key].sourceQuality, "real_raster", `${key} fallback must use real raster`);
  }
});

test("location cover entries are local raster files with complete attribution metadata", () => {
  for (const entry of allEntries()) {
    assert.ok(entry.imagePath, "imagePath missing");
    assert.equal(/^https?:\/\//i.test(entry.imagePath), false, `${entry.title} imagePath hotlinks`);
    assert.match(entry.imagePath, allowedImageExt, `${entry.title} must use webp/jpg/png`);
    assert.doesNotMatch(entry.imagePath, /\.svg$/i, `${entry.title} must not use generated SVG`);
    assert.ok(existsSync(localAssetPath(entry.imagePath)), `${entry.title} local file missing: ${entry.imagePath}`);
    assert.ok(entry.sourceQuality, `${entry.title} sourceQuality missing`);
    assert.ok(entry.kind, `${entry.title} kind missing`);
    assert.ok(entry.notes, `${entry.title} notes missing`);
    if (entry.sourceQuality === "real_raster") {
      assert.match(entry.sourceUrl, /^https?:\/\//i, `${entry.title} sourceUrl missing`);
      assert.match(entry.sourcePageUrl, /^https?:\/\//i, `${entry.title} sourcePageUrl missing`);
      assert.ok(entry.license, `${entry.title} license missing`);
      assert.match(entry.licenseUrl, /^https?:\/\//i, `${entry.title} licenseUrl missing`);
      assert.ok(entry.credit, `${entry.title} credit missing`);
      assert.ok(entry.author, `${entry.title} author missing`);
      assert.ok(entry.dateAccessed, `${entry.title} dateAccessed missing`);
    } else {
      assert.equal(entry.kind, "fallback_illustration", `${entry.title} fallback kind mismatch`);
      assert.match(entry.notes, /fallback/i, `${entry.title} fallback notes missing`);
      assert.ok((manifest.warnings || []).some((warning) => /fallback/i.test(warning)), "fallback warning missing");
    }
  }
});

test("cover helpers resolve required local raster covers", () => {
  const helpers = analyticsMapHelpers();
  assert.match(helpers.getLocationCoverImage({ city: "Portland", region: "Oregon", countryCode: "US" }).imagePath, /city-us-oregon-portland\.webp$/);
  assert.match(helpers.getLocationCoverImage({ city: "Maseru", region: "Maseru District", countryCode: "LS" }).imagePath, /city-ls-maseru-district-maseru\.webp$/);
  assert.match(helpers.getLocationCoverImage({ city: "Rio de Janeiro", region: "Rio de Janeiro", countryCode: "BR" }).imagePath, /city-br-rio-de-janeiro-rio-de-janeiro\.webp$/);
  assert.match(helpers.getCountryFallbackCover("LS").imagePath, /capital-ls-maseru-district-maseru\.webp$/);
  assert.match(helpers.getCountryFallbackCover("US").title, /Washington/);
  assert.match(helpers.getDefaultLocationCover().imagePath, /default-location-cover\.webp$/);
});

test("dashboard repos have equivalent required location cover coverage", () => {
  assert.deepEqual(Object.keys(manifest.locations).sort(), Object.keys(siblingManifest.locations).sort());
  assert.deepEqual(Object.keys(manifest.countryFallbacks).sort(), Object.keys(siblingManifest.countryFallbacks).sort());
  for (const key of requiredLocations) {
    assert.equal(manifest.locations[key].imagePath, siblingManifest.locations[key].imagePath, `${key} image path differs`);
    assert.equal(manifest.locations[key].sourceQuality, siblingManifest.locations[key].sourceQuality, `${key} source quality differs`);
  }
  for (const key of requiredCountries) {
    assert.equal(manifest.countryFallbacks[key].imagePath, siblingManifest.countryFallbacks[key].imagePath, `${key} image path differs`);
    assert.equal(manifest.countryFallbacks[key].sourceQuality, siblingManifest.countryFallbacks[key].sourceQuality, `${key} source quality differs`);
  }
});

test("popup and sidebar cover UI has bounded frames and MapLibre popup overrides", () => {
  assert.match(analyticsJs, /figure\.className = "ss-map-popup-cover"/);
  assert.match(analyticsJs, /class="ss-analytics-map-selected-cover"/);
  assert.match(componentsCss, /\.ss-map-popup \.maplibregl-popup-content\s*\{[\s\S]*max-width:\s*min\(420px,\s*calc\(100vw - 32px\)\)\s*!important/);
  assert.match(componentsCss, /\.ss-map-popup \.maplibregl-popup-close-button\s*\{[\s\S]*z-index:\s*3[\s\S]*color:\s*#f7fbff/);
  assert.match(componentsCss, /\.ss-map-popup-cover\s*\{[\s\S]*aspect-ratio:\s*16 \/ 9/);
  assert.match(componentsCss, /\.ss-map-popup-cover img\s*\{[\s\S]*object-fit:\s*cover[\s\S]*object-position:\s*center/);
  assert.match(componentsCss, /\.ss-analytics-map-selected-cover\s*\{[\s\S]*aspect-ratio:\s*16 \/ 9/);
  assert.match(componentsCss, /\.ss-analytics-map-selected-cover img\s*\{[\s\S]*object-fit:\s*cover[\s\S]*object-position:\s*center/);
});

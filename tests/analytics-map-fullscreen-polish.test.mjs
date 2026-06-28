import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const analyticsJs = await readFile(new URL("../docs/js/analytics.js", import.meta.url), "utf8");
const analyticsHtml = await readFile(new URL("../docs/views/analytics.html", import.meta.url), "utf8");
const componentsCss = await readFile(new URL("../docs/css/components.css", import.meta.url), "utf8");
const coverManifest = JSON.parse(await readFile(new URL("../docs/shared/data/location-cover-images.json", import.meta.url), "utf8"));

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

test("fullscreen map exposes dot/glow controls and selected-location sidebar controls", () => {
  assert.match(analyticsHtml, /data-map-layer-toggle="dots"/);
  assert.match(analyticsHtml, /data-map-layer-toggle="glow"/);
  assert.match(analyticsHtml, /id="analytics-map-fullscreen-sidebar-toggle"/);
  assert.match(analyticsHtml, /id="analytics-map-fullscreen-sidebar-restore"/);
  assert.match(analyticsHtml, /data-analytics-map-sidebar-section="selected"/);
  assert.match(analyticsJs, /setMapLayerToggle\(layer, !state\.mapLayerVisibility\[layer\]\)/);
  assert.match(analyticsJs, /setMapLayerVisibilityForMap\(map, LAYERS\.requestsBackdrop,[\s\S]*state\.mapLayerVisibility\.glow/);
  assert.match(analyticsJs, /setMapLayerVisibilityForMap\(map, LAYERS\.activityCore,[\s\S]*state\.mapLayerVisibility\.dots/);
  assert.match(analyticsJs, /selectMapFeature\(feature, map, event\?\.lngLat\)/);
  assert.match(analyticsJs, /data-map-location-select=/);
});

test("fullscreen popup and sidebar styling keep dark close icon, covers, flags, and collapse polish", () => {
  assert.match(componentsCss, /\.ss-map-popup \.maplibregl-popup-close-button\s*\{[\s\S]*color:\s*#f7fbff/);
  assert.doesNotMatch(componentsCss, /\.ss-map-popup \.maplibregl-popup-close-button\s*\{[\s\S]*color:\s*black/);
  assert.match(componentsCss, /\.ss-map-popup-cover/);
  assert.match(componentsCss, /\.ss-analytics-map-selected-card/);
  assert.match(componentsCss, /\.ss-analytics-map-fullscreen-body\.is-sidebar-collapsed/);
  assert.match(componentsCss, /\.ss-analytics-map-sidebar-location-button/);
  assert.match(analyticsJs, /Select a map location to inspect details\./);
  assert.match(analyticsJs, /mapFeatureTitleHtml/);
  assert.match(analyticsJs, /countryFlagSlotHtml/);
});

test("location cover helpers resolve city, country fallback, and default covers", () => {
  const helpers = analyticsMapHelpers();
  assert.equal(helpers.buildLocationCoverKey("Portland", "Oregon", "US"), "us:oregon:portland");
  assert.match(helpers.getLocationCoverImage({ city: "Maseru", region: "Maseru District", countryCode: "LS" }).imagePath, /city-ls-maseru-district-maseru\.webp$/);
  assert.match(helpers.getCountryFallbackCover("LS").imagePath, /capital-ls-maseru-district-maseru\.webp$/);
  assert.match(helpers.getCountryFallbackCover("US").title, /Washington/);
  assert.match(helpers.getDefaultLocationCover().imagePath, /default-location-cover\.webp$/);
});

test("location cover manifest covers required keys with local files and attribution", () => {
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
  assert.equal(coverManifest.schemaVersion, "location-cover-images.v2");
  for (const key of requiredLocations) {
    assert.ok(coverManifest.locations[key], `${key} missing`);
  }
  for (const key of requiredCountries) {
    assert.ok(coverManifest.countryFallbacks[key], `${key} fallback missing`);
  }
  const entries = [
    coverManifest.defaultFallbackMeta,
    ...Object.values(coverManifest.locations),
    ...Object.values(coverManifest.countryFallbacks)
  ];
  for (const entry of entries) {
    assert.ok(entry.imagePath.startsWith("/assets/analytics/location-covers/"), entry.imagePath);
    assert.equal(/^https?:\/\//.test(entry.imagePath), false, entry.imagePath);
    assert.ok(entry.sourceQuality, entry.title);
    assert.ok(entry.credit);
    assert.ok(entry.license);
    assert.ok(existsSync(join(repoRoot, "docs", entry.imagePath.replace(/^\/assets\//, "assets/"))), entry.imagePath);
  }
  assert.ok(existsSync(new URL("../docs/assets/analytics/location-covers/city-ls-maseru-district-maseru.webp", import.meta.url)));
});

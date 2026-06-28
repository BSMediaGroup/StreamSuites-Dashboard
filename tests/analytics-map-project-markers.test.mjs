import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const analyticsJs = await readFile(new URL("../docs/js/analytics.js", import.meta.url), "utf8");
const analyticsHtml = await readFile(new URL("../docs/views/analytics.html", import.meta.url), "utf8");
const componentsCss = await readFile(new URL("../docs/css/components.css", import.meta.url), "utf8");

function analyticsMapHelpers() {
  const sandboxWindow = {};
  const sandbox = {
    window: sandboxWindow,
    document: {
      getElementById() {
        return null;
      },
      querySelector() {
        return null;
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

function locationRow(overrides = {}) {
  return {
    city: "Portland",
    region: "Oregon",
    country: "United States",
    country_code: "US",
    requests: 1,
    sessions: 1,
    project: "streamsuites",
    source_namespace: "streamsuites",
    ...overrides
  };
}

function featureByCity(collection, city) {
  return collection.features.find((feature) => feature.properties.city === city);
}

function countryFallbackFeature(collection, countryCode) {
  return collection.features.find((feature) =>
    feature.properties.country === countryCode &&
    feature.properties.plottedPrecision === "country_fallback"
  );
}

function coordinatesOf(feature) {
  return Array.from(feature?.geometry?.coordinates || []);
}

test("analytics map distinguishes DanielClancy markers without changing scaling expressions", () => {
  assert.match(analyticsJs, /await updateMap\(data\?\.by_location/);
  assert.match(analyticsJs, /countryRows: data\?\.by_country_markers \|\| data\?\.by_country/);
  assert.match(analyticsJs, /normalizeProject\(entry\?\.project\)/);
  assert.match(analyticsJs, /\["==", \["get", "project"\], "danielclancy"\]/);
  assert.match(analyticsJs, /"#ffd166"/);
  assert.match(analyticsJs, /"#d6b8ff"/);
  assert.match(analyticsJs, /\["coalesce", \["get", "requests"\], 0\]/);
  assert.match(analyticsJs, /\["coalesce", \["get", "sessions"\], 0\]/);
});

test("analytics popup and legend label DanielClancy.net", () => {
  assert.match(analyticsJs, /Project:/);
  assert.match(analyticsJs, /Source:/);
  assert.match(analyticsJs, /Surface:/);
  assert.match(analyticsJs, /DanielClancy\.net/);
  assert.match(analyticsHtml, /ss-analytics-map-legend/);
  assert.match(analyticsHtml, /StreamSuites/);
  assert.match(analyticsHtml, /DanielClancy\.net/);
  assert.match(componentsCss, /\.ss-analytics-map-legend-swatch\.is-danielclancy/);
  assert.match(componentsCss, /\.ss-analytics-map-legend-swatch\.is-streamsuites/);
});

test("analytics map plots city lookup rows including Maseru before country fallback", () => {
  const helpers = analyticsMapHelpers();
  const collection = helpers.buildLocationFeatures([
    locationRow({ city: "Maseru", region: "Maseru District", country: "Lesotho", country_code: "LS" }),
    locationRow({ city: "Santa Clara", region: "California", country_code: "US" }),
    locationRow({ city: "Ashburn", region: "Virginia", country_code: "US" }),
    locationRow({ city: "London", region: "England", country: "United Kingdom", country_code: "GB" })
  ]);

  assert.equal(collection.metadata.unmappedRows.length, 0);
  assert.equal(collection.metadata.cityMarkers, 4);
  assert.equal(featureByCity(collection, "Maseru")?.properties.coordinateSource, "city_lookup");
  assert.deepEqual(coordinatesOf(featureByCity(collection, "Maseru")), [27.48, -29.31]);
  assert.deepEqual(coordinatesOf(featureByCity(collection, "Santa Clara")), [-121.9552, 37.3541]);
  assert.deepEqual(coordinatesOf(featureByCity(collection, "Ashburn")), [-77.4874, 39.0438]);
  assert.deepEqual(coordinatesOf(featureByCity(collection, "London")), [-0.1276, 51.5072]);
});

test("analytics map uses honest country fallback and leaves only invalid rows unmapped", () => {
  const helpers = analyticsMapHelpers();
  const collection = helpers.buildLocationFeatures([
    locationRow({ city: "Unknown LS City", region: "Unknown District", country: "Lesotho", country_code: "LS", requests: 4 }),
    locationRow({ city: "Unknown US City", region: "Unknown", country_code: "US", requests: 5 }),
    locationRow({ city: "No Country City", region: "Nowhere", country: "", country_code: "", requests: 6 })
  ]);

  const ls = countryFallbackFeature(collection, "LS");
  const us = countryFallbackFeature(collection, "US");
  assert.equal(collection.features.length, 2);
  assert.equal(collection.metadata.countryFallbackMarkers, 2);
  assert.equal(collection.metadata.unmappedRows.length, 1);
  assert.equal(collection.metadata.unmappedRows[0].reason, "missing_country_code");
  assert.equal(ls.properties.plottedPrecision, "country_fallback");
  assert.equal(ls.properties.precision, "country fallback");
  assert.notEqual(ls.properties.precision, "city");
  assert.deepEqual(coordinatesOf(ls), [28.2336, -29.61]);
  assert.deepEqual(coordinatesOf(us), [-98.5795, 39.8283]);
});

test("analytics map preserves marker scaling and DanielClancy visual distinction in fullscreen modal", () => {
  assert.match(analyticsJs, /\["coalesce", \["get", "requests"\], 0\]/);
  assert.match(analyticsJs, /\["coalesce", \["get", "sessions"\], 0\]/);
  assert.match(analyticsHtml, /id="analytics-map-fullscreen-toggle"/);
  assert.match(analyticsHtml, /id="analytics-map-fullscreen-modal"/);
  assert.match(analyticsHtml, /id="analytics-fullscreen-world-map"/);
  assert.match(analyticsHtml, /id="analytics-map-fullscreen-sidebar"/);
  for (const section of ["summary", "mapped", "unmapped", "source", "precision", "marker"]) {
    assert.match(analyticsHtml, new RegExp(`data-analytics-map-sidebar-section="${section}"`));
  }
  assert.match(analyticsJs, /initFullscreenMap\(\)/);
  assert.match(analyticsJs, /destroyFullscreenMap\(\)/);
  assert.match(analyticsJs, /renderMapFullscreenSidebar\(\)/);
  assert.match(componentsCss, /\.ss-analytics-map-fullscreen-modal/);
  assert.match(componentsCss, /\.ss-analytics-map-fullscreen-sidebar/);
});

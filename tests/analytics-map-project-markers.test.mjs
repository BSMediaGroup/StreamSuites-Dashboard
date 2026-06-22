import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const analyticsJs = await readFile(new URL("../docs/js/analytics.js", import.meta.url), "utf8");
const analyticsHtml = await readFile(new URL("../docs/views/analytics.html", import.meta.url), "utf8");
const componentsCss = await readFile(new URL("../docs/css/components.css", import.meta.url), "utf8");

test("analytics map distinguishes DanielClancy markers without changing scaling expressions", () => {
  assert.match(analyticsJs, /by_country_markers \|\| data\?\.by_country/);
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

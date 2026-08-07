import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("Admin status widget retains the inline footer mount in both shell entry points", () => {
  for (const relativePath of ["index.html", "docs/index.html"]) {
    const html = read(relativePath);
    assert.match(html, /<footer id="app-footer"/);
    assert.match(html, /id="app-status"[^>]*footer-active-pill/);
    assert.match(html, /data-status-slot data-status-slot-mode="inline"/);
    assert.match(html, /\/css\/status-widget\.css/);
    assert.match(html, /\/js\/status-widget\.js/);
  }
});

test("Admin detailed panel exposes the complete public-read information contract", () => {
  const script = read("docs/js/status-widget.js");
  assert.match(script, /groupComponents/);
  assert.match(script, /source\.filter\(\(component\) => !component\?\.group\)/);
  assert.match(script, /Active incidents/);
  assert.match(script, /Scheduled maintenance/);
  assert.match(script, /lastSuccessfulData/);
  assert.match(script, /stale:\s*Boolean\(lastSuccessfulData\)/);
  assert.match(script, /latencyMs/);
  assert.match(script, /Full StreamSuites status/);
  assert.match(script, /ss-status-details-visible/);
  assert.match(script, /https:\/\/streamsuites\.app\/status/);
  assert.match(script, /https:\/\/streamsuites\.statuspage\.io\//);
  assert.match(script, /\/assets\/icons\/ui\/plus\.svg/);
  assert.match(script, /\/assets\/icons\/ui\/cross\.svg/);
  assert.match(script, /mouseenter/);
  assert.match(script, /focusin/);
  assert.match(script, /event\.key !== "Escape"/);
  assert.match(script, /pointerdown/);
});

test("Admin status reads only public Atlassian endpoints with bounded polling", () => {
  const script = read("docs/js/status-widget.js");
  assert.match(script, /v0hwlmly3pd2\.statuspage\.io\/api\/v2/);
  assert.match(script, /summary\.json/);
  assert.match(script, /incidents\.json/);
  assert.match(script, /scheduled-maintenances\.json/);
  assert.match(script, /cache:\s*"no-store"/);
  assert.match(script, /REQUEST_TIMEOUT_MS\s*=\s*8000/);
  assert.match(script, /POLL_INTERVAL_MS\s*=\s*60000/);
  assert.match(script, /visibilitychange/);
  assert.doesNotMatch(script, /manage\.statuspage|api[_-]?key|method:\s*["'](?:POST|PUT|PATCH|DELETE)|localStorage|\?demo=/i);
});

test("Admin status colours distinguish operational, degraded, partial, critical, maintenance, and unknown", () => {
  const css = read("docs/css/status-widget.css");
  for (const token of ["operational", "degraded", "partial", "critical", "maintenance", "unknown"]) {
    assert.match(css, new RegExp(`--ss-status-${token}`));
  }
  assert.match(css, /data-layout="inline"|data-layout='inline'|\.ss-status-indicator/);
  assert.match(css, /@media \(max-width:\s*680px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

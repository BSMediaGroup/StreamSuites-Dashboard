import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("final visual layer provides muted operator tokens and responsive auth layout", () => {
  const theme = read("docs/css/theme-dark.css");
  const finalLayer = read("docs/css/studio-first-system.css");

  assert.match(theme, /--bg-root:\s*#06080b/);
  assert.match(theme, /--accent-shell:\s*#7298c1/);
  assert.match(finalLayer, /\.admin-auth-page-main/);
  assert.match(finalLayer, /\.admin-auth-provider-button/);
  assert.match(finalLayer, /@media \(max-width: 720px\)/);
});

test("standalone and shell auth providers use one neutral provider treatment", () => {
  for (const relativePath of ["docs/auth/login.html", "index.html", "docs/index.html"]) {
    const html = read(relativePath);
    const providers = [...html.matchAll(/<button class="([^"]+)" data-admin-auth-provider=/g)];
    assert.equal(providers.length, 5, `${relativePath} should retain all five providers`);
    for (const provider of providers) {
      assert.match(provider[1], /admin-auth-provider-button/);
      assert.doesNotMatch(provider[1], /ss-btn-primary/);
    }
  }
});

test("API usage chart preserves missing data and uses one-time reveal plus fast live interpolation", () => {
  const source = read("docs/js/api-usage.js");
  const view = read("docs/views/api-usage.html");

  assert.match(source, /rawCount === null \|\| rawCount === undefined/);
  assert.match(source, /createLinearGradient/);
  assert.match(source, /isInitialReveal \? 360/);
  assert.match(source, /options\.trigger === "poll" \? 150/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /ctx\.arc\(current\.x, current\.y/);
  assert.match(view, /id="api-usage-chart-current"/);
  assert.match(view, /id="api-usage-chart-tooltip"/);
});

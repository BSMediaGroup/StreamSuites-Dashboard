import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("admin triggers route is runtime/Auth-backed and unload-safe", () => {
  const appJs = read("docs/js/app.js");
  const triggersJs = read("docs/js/triggers.js");
  const triggersHtml = read("docs/views/triggers.html");

  assert.match(appJs, /registerView\("triggers"/);
  assert.match(appJs, /onUnload:\s*\(\)\s*=>\s*window\.TriggersView\?\.destroy\?\.\(\)/);
  assert.match(triggersJs, /requestJson\("\/api\/livechat\/registry-summary", \{ signal \}\)/);
  assert.match(triggersJs, /requestJson\("\/api\/livechat\/triggers", \{ signal \}\)/);
  assert.match(triggersJs, /requestJson\("\/api\/livechat\/games", \{ signal \}\)/);
  assert.match(triggersJs, /requestJson\("\/api\/livechat\/capabilities", \{ signal \}\)/);
  assert.match(triggersJs, /requestJson\("\/api\/livechat\/game-assets", \{ signal \}\)/);
  assert.match(triggersJs, /requestJson\("\/api\/admin\/livechat\/custom-triggers", \{ signal \}\)/);
  assert.match(triggersJs, /state\.abortController = new AbortController\(\)/);
  assert.match(triggersJs, /destroy\(\) \{/);
  assert.match(triggersHtml, /Authoritative Runtime Registry/);
  assert.match(triggersHtml, /Trigger Definitions/);
  assert.match(triggersHtml, /read-only and does not mutate trigger, game, transport, or creator configuration state/);
  assert.match(triggersHtml, /Creator-Owned Custom Triggers/);
  assert.match(triggersHtml, /No playable game engine, persistence, or transport execution is implemented/);
});

test("admin trigger oversight exposes technical read-only registry metadata", () => {
  const triggersJs = read("docs/js/triggers.js");
  const triggersHtml = read("docs/views/triggers.html");

  assert.match(triggersJs, /actor_resolution/);
  assert.match(triggersJs, /mention_behavior/);
  assert.match(triggersJs, /identity_required/);
  assert.match(triggersJs, /profile_binding/);
  assert.match(triggersJs, /role_gate_source/);
  assert.match(triggersJs, /platformCapsSummary/);
  assert.doesNotMatch(triggersJs, /\/api\/admin\/runtime\/rumble-dispatch/);
  assert.match(triggersHtml, /Actor \/ Identity/);
  assert.match(triggersHtml, /creator custom trigger configs are a separate runtime-owned management layer/);
});

test("admin trigger oversight hydrates custom configs from runtime/Auth and mutates only account-scoped custom rows", () => {
  const triggersJs = read("docs/js/triggers.js");
  const triggersHtml = read("docs/views/triggers.html");

  assert.match(triggersJs, /state\.customItems/);
  assert.match(triggersJs, /filteredCustomTriggers/);
  assert.match(triggersJs, /\/api\/admin\/livechat\/custom-triggers/);
  assert.match(triggersJs, /\/api\/admin\/accounts\/\$\{encodeURIComponent\(creatorId\)\}\/creator-triggers\/\$\{encodeURIComponent\(triggerId\)\}/);
  assert.match(triggersJs, /data-custom-trigger-toggle/);
  assert.match(triggersJs, /data-custom-trigger-delete/);
  assert.match(triggersHtml, /Admin edits\/deletes use runtime\/Auth account-scoped trigger endpoints/);
  assert.match(triggersHtml, /future dispatch/);
  assert.doesNotMatch(triggersJs, /localStorage/);
});

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
  assert.match(triggersJs, /state\.abortController = new AbortController\(\)/);
  assert.match(triggersJs, /destroy\(\) \{/);
  assert.match(triggersHtml, /Authoritative Runtime Registry/);
  assert.match(triggersHtml, /Trigger Definitions/);
  assert.match(triggersHtml, /read-only and does not mutate trigger, game, transport, or creator configuration state/);
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
  assert.match(triggersHtml, /Creator\/Admin trigger configuration controls are future managed phases/);
});

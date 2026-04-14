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
  assert.match(triggersJs, /requestJson\("\/api\/admin\/creator-integrations"\)/);
  assert.match(triggersJs, /requestJson\("\/api\/admin\/creators"\)/);
  assert.match(triggersJs, /requestJson\(`\/api\/admin\/users\/\$\{encodeURIComponent\(state\.selectedUserCode\)\}`\)/);
  assert.match(triggersJs, /state\.abortController = new AbortController\(\)/);
  assert.match(triggersJs, /destroy\(\) \{/);
  assert.match(triggersHtml, /Trigger Oversight/);
  assert.match(triggersHtml, /runtime\/Auth-backed oversight for creator-configured Rumble text triggers in phase one/);
});

test("admin trigger oversight distinguishes admin, creator, and automatic dispatch rows", () => {
  const triggersJs = read("docs/js/triggers.js");

  assert.match(triggersJs, /source === "trigger_runtime"/);
  assert.match(triggersJs, /source === "creator_dashboard"/);
  assert.match(triggersJs, /"Manual admin send"/);
  assert.match(triggersJs, /"Manual creator send"/);
  assert.match(triggersJs, /"Automatic trigger reply"/);
  assert.match(triggersJs, /\/api\/admin\/runtime\/rumble-dispatch/);
});

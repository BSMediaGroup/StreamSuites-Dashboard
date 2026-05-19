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
  assert.match(triggersJs, /ADMIN_TRIGGER_EDITOR_ENDPOINT = "\/api\/admin\/livechat\/trigger-editor"/);
  assert.match(triggersJs, /requestJson\(ADMIN_TRIGGER_EDITOR_ENDPOINT, \{ signal \}\)/);
  assert.match(triggersJs, /state\.abortController = new AbortController\(\)/);
  assert.match(triggersJs, /destroy\(\) \{/);
  assert.match(triggersHtml, /Authoritative Runtime Registry/);
  assert.match(triggersHtml, /Trigger Definitions/);
  assert.match(triggersHtml, /normalized StreamSuites runtime\/Auth trigger editor contract/);
  assert.match(triggersHtml, /Creator-Owned Custom Triggers/);
  assert.match(triggersHtml, /Effective Command List/);
  assert.match(triggersHtml, /No playable game engine, persistence, or transport execution is implemented/);
});

test("admin trigger oversight exposes normalized read-only editor metadata", () => {
  const triggersJs = read("docs/js/triggers.js");
  const triggersHtml = read("docs/views/triggers.html");

  assert.match(triggersJs, /permission/);
  assert.match(triggersJs, /validation/);
  assert.match(triggersJs, /response_preview_text/);
  assert.match(triggersJs, /role_gate_source/);
  assert.match(triggersJs, /platformCapsSummary/);
  assert.match(triggersJs, /renderEffectiveCommandList/);
  assert.match(triggersJs, /read_only/);
  assert.match(triggersJs, /module_status/);
  assert.doesNotMatch(triggersJs, /\/api\/admin\/runtime\/rumble-dispatch/);
  assert.match(triggersHtml, /Permission \/ Validation/);
  assert.match(triggersHtml, /creator custom trigger configs are a separate runtime-owned management layer/);
});

test("admin trigger oversight hydrates custom configs from runtime/Auth and mutates only account-scoped custom rows", () => {
  const triggersJs = read("docs/js/triggers.js");
  const triggersHtml = read("docs/views/triggers.html");

  assert.match(triggersJs, /state\.customItems/);
  assert.match(triggersJs, /filteredCustomTriggers/);
  assert.match(triggersJs, /ADMIN_TRIGGER_EDITOR_VALIDATE_ENDPOINT/);
  assert.match(triggersJs, /ADMIN_TRIGGER_EDITOR_DRY_RUN_ENDPOINT/);
  assert.match(triggersJs, /runPreview/);
  assert.match(triggersJs, /\/api\/admin\/accounts\/\$\{encodeURIComponent\(creatorId\)\}\/creator-triggers\/\$\{encodeURIComponent\(triggerId\)\}/);
  assert.match(triggersJs, /data-custom-trigger-toggle/);
  assert.match(triggersJs, /data-custom-trigger-delete/);
  assert.match(triggersHtml, /Admin edits\/deletes use runtime\/Auth account-scoped trigger endpoints/);
  assert.match(triggersHtml, /Custom Trigger Preview Diagnostics/);
  assert.match(triggersHtml, /Dry-run preview only/);
  assert.match(triggersHtml, /validates the selected definition/);
  assert.match(triggersHtml, /triggers-preview-form/);
  assert.match(triggersHtml, /future dispatch/);
  assert.doesNotMatch(triggersJs, /localStorage/);
  assert.doesNotMatch(triggersJs, /rumble-dispatch/);
});

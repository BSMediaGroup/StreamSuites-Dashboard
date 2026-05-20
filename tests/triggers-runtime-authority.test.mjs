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
  assert.match(triggersJs, /ADMIN_CUSTOM_TRIGGERS_ENDPOINT = "\/api\/admin\/livechat\/custom-triggers"/);
  assert.match(triggersJs, /requestJson\(ADMIN_TRIGGER_EDITOR_ENDPOINT, \{ signal \}\)/);
  assert.match(triggersJs, /state\.abortController = new AbortController\(\)/);
  assert.match(triggersJs, /destroy\(\) \{/);
  assert.match(triggersHtml, /Trigger Command Center/);
  assert.match(triggersHtml, /Global Trigger Library/);
  assert.match(triggersHtml, /Runtime\/Auth editor contract/);
  assert.match(triggersHtml, /Creator Scoped Custom Triggers/);
  assert.match(triggersHtml, /Effective Command Set/);
  assert.match(triggersHtml, /Planned Modules Roadmap/);
});

test("admin trigger oversight exposes grouped active and planned runtime metadata", () => {
  const triggersJs = read("docs/js/triggers.js");
  const triggersHtml = read("docs/views/triggers.html");

  assert.match(triggersJs, /CATEGORY_DEFS/);
  assert.match(triggersJs, /Active Built-in \/ Core Bot Commands/);
  assert.match(triggersJs, /Active XP \/ Rank Commands/);
  assert.match(triggersJs, /System \/ Admin Commands/);
  assert.match(triggersJs, /Planned Economy \/ Inventory Commands/);
  assert.match(triggersJs, /Planned Game Commands/);
  assert.match(triggersJs, /Planned Clips \/ FFmpeg Commands/);
  assert.match(triggersJs, /categoryForTrigger/);
  assert.match(triggersJs, /xp.*rank.*progression.*level/);
  assert.match(triggersJs, /clip.*ffmpeg/);
  assert.match(triggersJs, /permission/);
  assert.match(triggersJs, /validation/);
  assert.match(triggersJs, /response_preview_text/);
  assert.match(triggersJs, /module_status/);
  assert.match(triggersJs, /renderEffectiveCommandList/);
  assert.match(triggersJs, /renderValidationOutput/);
  assert.match(triggersJs, /renderGameRows/);
  assert.match(triggersJs, /read_only/);
  assert.match(triggersJs, /Total effective triggers/);
  assert.match(triggersJs, /Active triggers/);
  assert.match(triggersJs, /Custom triggers/);
  assert.match(triggersJs, /Staged \/ planned/);
  assert.match(triggersJs, /Validation warnings/);
  assert.match(triggersHtml, /triggers-category-filter/);
  assert.match(triggersHtml, /triggers-creator-filter/);
  assert.match(triggersHtml, /Validation \/ Warnings/);
  assert.doesNotMatch(triggersJs, /\/api\/admin\/runtime\/rumble-dispatch/);
});

test("admin trigger oversight hydrates custom configs from runtime/Auth and mutates only account-scoped custom rows", () => {
  const triggersJs = read("docs/js/triggers.js");
  const triggersHtml = read("docs/views/triggers.html");

  assert.match(triggersJs, /state\.customItems/);
  assert.match(triggersJs, /state\.customError/);
  assert.match(triggersJs, /state\.customLoading/);
  assert.match(triggersJs, /filteredCustomTriggers/);
  assert.match(triggersJs, /loadCustomTriggers/);
  assert.match(triggersJs, /Promise\.allSettled\(\[loadEditor\(\), loadCustomTriggers\(\)\]\)/);
  assert.match(triggersJs, /Runtime\/Auth custom trigger configs are unavailable/);
  assert.match(triggersJs, /data-custom-trigger-retry/);
  assert.match(triggersJs, /Runtime\/Auth returned no creator-scoped custom trigger config rows/);
  assert.match(triggersJs, /ADMIN_TRIGGER_EDITOR_VALIDATE_ENDPOINT/);
  assert.match(triggersJs, /ADMIN_TRIGGER_EDITOR_DRY_RUN_ENDPOINT/);
  assert.match(triggersJs, /runPreview/);
  assert.match(triggersJs, /\/api\/admin\/accounts\/\$\{encodeURIComponent\(creatorId\)\}\/creator-triggers\/\$\{encodeURIComponent\(triggerId\)\}/);
  assert.match(triggersJs, /data-custom-trigger-toggle/);
  assert.match(triggersJs, /data-custom-trigger-delete/);
  assert.match(triggersHtml, /account-scoped authority identifiers/);
  assert.match(triggersHtml, /Preview \/ Dry Run/);
  assert.match(triggersHtml, /Runtime-backed matching, validation, permissions, cooldown, and response preview/);
  assert.match(triggersHtml, /triggers-preview-form/);
  assert.match(triggersHtml, /triggers-preview-role/);
  assert.doesNotMatch(triggersJs, /localStorage/);
  assert.doesNotMatch(triggersJs, /rumble-dispatch/);
});

test("admin trigger command center keeps dry-run and selected effective set runtime-backed", () => {
  const triggersJs = read("docs/js/triggers.js");
  const triggersHtml = read("docs/views/triggers.html");

  assert.match(triggersJs, /requestJson\(ADMIN_TRIGGER_EDITOR_ENDPOINT, \{ signal \}\)/);
  assert.match(triggersJs, /renderAll\(\)/);
  assert.match(triggersJs, /renderCustomRows\(\)/);
  assert.match(triggersJs, /requestJson\(ADMIN_TRIGGER_EDITOR_VALIDATE_ENDPOINT/);
  assert.match(triggersJs, /requestJson\(ADMIN_TRIGGER_EDITOR_DRY_RUN_ENDPOINT/);
  assert.match(triggersJs, /posted.*no-send/s);
  assert.match(triggersJs, /would dispatch/);
  assert.match(triggersJs, /blocked \/ no match/);
  assert.match(triggersJs, /No preview run yet\. Try !bot, !xp, or !clip/);
  assert.match(triggersHtml, /Effective Command Set/);
  assert.match(triggersHtml, /what will actually match/i);
  assert.match(triggersHtml, /!bot/);
  assert.match(triggersHtml, /Pilled planned\/disabled/);
  assert.match(triggersHtml, /FFmpeg/);
  assert.doesNotMatch(triggersJs, /dispatchEndpoint|livePost|transportSend/);
});

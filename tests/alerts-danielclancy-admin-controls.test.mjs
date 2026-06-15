import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const alertsHtml = readFileSync(new URL("../docs/views/alerts.html", import.meta.url), "utf8");
const alertsJs = readFileSync(new URL("../docs/js/analytics-alerting.js", import.meta.url), "utf8");

test("alerts editor exposes DanielClancy project and surface controls", () => {
  assert.match(alertsHtml, /id="analytics-alerts-rule-project"/);
  assert.match(alertsHtml, />StreamSuites<\/option>/);
  assert.match(alertsHtml, />DanielClancy<\/option>/);

  assert.match(alertsJs, /ALERT_PROJECTS/);
  assert.match(alertsJs, /danielclancy_public:\s*"DanielClancy\.net"/);
  assert.match(alertsJs, /danielclancy_admin:\s*"DanielClancy Admin"/);
  assert.match(alertsJs, /projectForEventMeta/);
  assert.match(alertsJs, /eventTypesForProject/);
  assert.match(alertsJs, /DANIELCLANCY_REQUIRED_EVENT_TYPES/);
  assert.match(alertsJs, /key:\s*"danielclancy_page_visit"/);
  assert.match(alertsJs, /trigger_type:\s*"page_visit"/);
  assert.match(alertsJs, /Alert when a tracked public\/admin page visit event is received\./);
  assert.match(alertsJs, /mergeRequiredDanielClancyEventTypes\(extractItems\(eventTypesPayload\)\)/);
  assert.match(alertsJs, /handleRuleProjectChange/);
  assert.match(alertsJs, /source_namespace/);
});

test("DanielClancy alert rules default to backend-owned event and scope metadata", () => {
  assert.match(alertsJs, /projectForEventMeta\(meta\) === "danielclancy"/);
  assert.match(alertsJs, /meta\?\.surface_defaults/);
  assert.match(alertsJs, /defaults = \{ surface: surfaces \}/);
  assert.match(alertsJs, /autoEnable = true/);
  assert.doesNotMatch(alertsJs, /localStorage\.setItem\([^)]*alert/i);
});

test("DanielClancy rule IDs and saves are namespace-safe", () => {
  assert.match(alertsJs, /function ensureDanielClancyRuleId/);
  assert.match(alertsJs, /return \/\^\(dc_\|danielclancy_\)\/i\.test\(candidate\) \? candidate : `dc_\$\{candidate\}`;/);
  assert.match(alertsJs, /id: ensureDanielClancyRuleId\(existingRule\?\.id \|\| generateUuid\(\), eventType\)/);
  assert.match(alertsJs, /sourceNamespace = isDanielClancyEventType\(eventType\) \? "danielclancy" : "streamsuites"/);
  assert.match(alertsJs, /source_namespace: sourceNamespace/);
  assert.match(alertsJs, /project: sourceNamespace/);
});

test("DanielClancy imports are messaged as additive, not replacement authority", () => {
  assert.match(alertsJs, /mergeImportedConfigurationIntoCurrent/);
  assert.match(alertsJs, /DanielClancy-only imports are merged by rule ID and must not replace StreamSuites rules/);
  assert.match(alertsHtml, /Save changes/);
  assert.match(alertsJs, /const snapshot = buildConfigurationSnapshot\(\);/);
  assert.match(alertsJs, /validateConfigurationSnapshotForSave\(snapshot\)/);
  assert.match(alertsJs, /updateAdminAlertConfiguration\(snapshot\)/);
});

test("Dashboard blocks partial or DanielClancy-only destructive saves", () => {
  assert.match(alertsJs, /function validateConfigurationSnapshotForSave/);
  assert.match(alertsJs, /DanielClancy-only alert saves cannot replace the canonical StreamSuites rule list\./);
  assert.match(alertsJs, /Alert save would drop existing canonical rules\./);
  assert.match(alertsJs, /Alert save would drop existing StreamSuites rule IDs/);
});

test("Dashboard preserves protected minimum rule IDs", () => {
  assert.match(alertsJs, /PROTECTED_ALERT_RULE_IDS/);
  assert.match(alertsJs, /e8eaaca5-95bf-4f1c-a195-54b3d96f2955/);
  assert.match(alertsJs, /05d097bf-dfc6-4902-93f4-2fe7e3056724/);
  assert.match(alertsJs, /Alert save would drop protected minimum rule IDs/);
});

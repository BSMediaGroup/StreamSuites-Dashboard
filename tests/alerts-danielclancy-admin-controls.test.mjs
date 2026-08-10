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

test("ordinary alert edits use granular APIs and preserve unrelated configuration", () => {
  assert.match(alertsJs, /updateAdminAlertPreferences\(readPreferencesPayload\(\)\)/);
  assert.match(alertsJs, /updateAdminAlertRule\(editingRuleId, payload\)/);
  assert.match(alertsJs, /createAdminAlertRule\(payload\)/);
  assert.match(alertsJs, /setAdminAlertRuleEnabled\(ruleId, !rule\.enabled\)/);
  assert.match(alertsJs, /deleteAdminAlertRule\(ruleId\)/);
  assert.match(alertsHtml, /Save delivery settings/);
  assert.equal([...alertsJs.matchAll(/updateAdminAlertConfiguration\(/g)].length, 1);
});

test("full configuration apply is reserved for a staged import", () => {
  assert.match(alertsJs, /function validateConfigurationSnapshotForSave/);
  assert.match(alertsHtml, /Apply imported configuration/);
  assert.match(alertsJs, /expected_revision: state\.configuration\?\.configuration_revision/);
  assert.match(alertsJs, /operator_confirmed_rule_delete: state\.importAllowsDeletions === true/);
  assert.match(alertsJs, /The backend configuration changed after this import was staged\. Nothing was overwritten/);
  assert.match(alertsJs, /preferences \$\{preferencesIncluded \? "included" : "preserved"\}/);
});

test("Runtime protection metadata and System Status context drive the alert UI", () => {
  assert.doesNotMatch(alertsJs, /PROTECTED_ALERT_RULE_IDS/);
  assert.match(alertsJs, /rule\.protected/);
  assert.match(alertsHtml, /System Status alerts/);
  assert.match(alertsHtml, /Primary watchdog transitions enter the normal Runtime alert pipeline/);
  assert.match(alertsJs, /system_status_change/);
  assert.match(alertsJs, /system_monitor_state/);
  assert.match(alertsJs, /status_source/);
  assert.match(alertsJs, /status_change_kind/);
  assert.match(alertsJs, /component_key/);
  assert.match(alertsJs, /System \/ Status/);
  assert.match(alertsHtml, /analytics-alerts-history-family-filter/);
  assert.match(alertsHtml, /System Status only/);
  assert.match(alertsJs, /state\.historyFilters\.family/);
});

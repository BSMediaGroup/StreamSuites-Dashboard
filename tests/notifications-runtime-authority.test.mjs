import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("admin notifications hydrate and mutate through the runtime contract instead of local read-id storage", () => {
  const js = read("docs/js/notifications.js");
  const html = read("docs/views/notifications.html");

  assert.match(js, /const NOTIFICATIONS_ENDPOINT_PATH = "\/api\/admin\/notifications";/);
  assert.match(js, /method:\s*"PATCH"/);
  assert.match(js, /await loadNotifications\(\{ showLoader: false \}\);/);
  assert.doesNotMatch(js, /READ_IDS_STORAGE_KEY/);
  assert.doesNotMatch(js, /persistReadIds/);
  assert.match(html, /runtime notification contract for the signed-in operator/);
});

test("admin creator integration surfaces expose rumble managed-session transport state from the runtime contract", () => {
  const integrationsJs = read("docs/js/creator-integrations.js");
  const userDetailJs = read("docs/js/user-detail.js");

  assert.match(integrationsJs, /item\?\.managed_session/);
  assert.match(integrationsJs, /Auto-deploy enabled/);
  assert.match(integrationsJs, /Last attach attempt/);
  assert.match(integrationsJs, /Last attach success/);
  assert.match(integrationsJs, /Stream key only/);
  assert.match(integrationsJs, /Open watch target/);

  assert.match(userDetailJs, /item\?\.managed_session/);
  assert.match(userDetailJs, /Transport error/);
  assert.match(userDetailJs, /Open watch target/);
  assert.match(userDetailJs, /Chat auth missing/);
});

test("admin bots surface distinguishes managed sessions and transport posture", () => {
  const botsHtml = read("docs/views/bots.html");
  const botsJs = read("docs/js/bots.js");

  assert.match(botsHtml, /<th>Session<\/th>/);
  assert.match(botsHtml, /<th>Lifecycle<\/th>/);
  assert.match(botsHtml, /<th>Transport<\/th>/);
  assert.match(botsHtml, /<th>Blocking \/ Error<\/th>/);
  assert.match(botsJs, /session_type/);
  assert.match(botsJs, /Managed/);
  assert.match(botsJs, /renderTargetCell/);
  assert.match(botsJs, /renderBlockingCell/);
  assert.match(botsJs, /Open watch target/);
});

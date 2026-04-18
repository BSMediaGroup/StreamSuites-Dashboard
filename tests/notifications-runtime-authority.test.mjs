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
  assert.match(integrationsJs, /Waiting for live stream/);
  assert.match(integrationsJs, /Open watch target/);

  assert.match(userDetailJs, /item\?\.managed_session/);
  assert.match(userDetailJs, /Transport error/);
  assert.match(userDetailJs, /Live target pending/);
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
  assert.match(botsJs, /const globalStatus = String\(runtime\?\.globalStatus \|\| runtime\?\.status \|\| ""\)/);
  assert.match(botsJs, /const sessionStatus = String\(runtime\?\.sessionStatus \|\| runtime\?\.details\?\.session_status \|\| ""\)/);
  assert.match(botsJs, /sessionStatus === "awaiting_live"/);
  assert.match(botsJs, /sessionStatus === "live_target_unresolved"/);
  assert.match(botsJs, /creator-managed session/);
});

test("admin rumble platform view reads live runtime posture instead of a hardcoded paused scaffold", () => {
  const rumbleHtml = read("docs/views/platforms/rumble.html");
  const rumbleJs = read("docs/js/platforms/rumble.js");

  assert.match(rumbleHtml, /Runtime Posture/);
  assert.match(rumbleHtml, /\/api\/admin\/bots\/status/);
  assert.match(rumbleHtml, /This surface mirrors runtime-owned Rumble bot availability/);
  assert.match(rumbleJs, /const BOTS_STATUS_ENDPOINT = "\/api\/admin\/bots\/status";/);
  assert.match(rumbleJs, /global_status \|\| platformRow\?\.status/);
  assert.match(rumbleJs, /creator-managed Rumble session/);
  assert.doesNotMatch(rumbleJs, /Rumble ingest is paused by the runtime/);
});

test("admin overview platform cards prefer global runtime posture over creator-session blockers", () => {
  const overviewJs = read("docs/js/overview.js");

  assert.match(overviewJs, /platform\.global_status \|\| platform\.status/);
  assert.match(overviewJs, /platform\.session_status_reason/);
  assert.match(overviewJs, /if \(status === "ready" \|\| status === "connected"\) return "success";/);
});

test("admin compact profile surfaces use the canonical social registry and restrained overflow handling", () => {
  const helperJs = read("docs/assets/js/ss-social-platforms.js");
  const hovercardJs = read("docs/assets/js/ss-profile-hovercard.js");
  const hovercardCss = read("docs/assets/css/ss-profile-hovercard.css");
  const accountsJs = read("docs/js/accounts.js");
  const userDetailJs = read("docs/js/user-detail.js");
  const shellHtml = read("docs/index.html");

  assert.match(shellHtml, /assets\/js\/ss-social-platforms\.js/);
  assert.match(helperJs, /whatsappchannels/);
  assert.match(helperJs, /icon: "\/assets\/icons\/whatsapp\.svg"/);
  assert.match(helperJs, /applepodcasts/);
  assert.match(helperJs, /aliases: \["x", "twitter"\]/);
  assert.match(helperJs, /aliases: \["website", "site", "web", "url", "homepage"\]/);
  assert.doesNotMatch(helperJs, /dlive/i);
  assert.match(hovercardJs, /getSocialPlatformApi/);
  assert.match(hovercardJs, /collectOrderedSocialEntries/);
  assert.match(hovercardJs, /links\.slice\(0, 8\)/);
  assert.match(hovercardJs, /social-overflow-indicator/);
  assert.match(accountsJs, /buildCompactSocialMarkup/);
  assert.match(accountsJs, /entries\.slice\(0, 8\)/);
  assert.match(userDetailJs, /buildCompactSocialMarkup/);
  assert.match(hovercardCss, /\.social-overflow-indicator/);
});

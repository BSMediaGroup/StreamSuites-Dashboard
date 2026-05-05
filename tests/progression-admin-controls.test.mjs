import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("progression admin route is registered and loaded by the dashboard shell", () => {
  const routes = read("docs/js/admin-routes.js");
  const pagesFunction = read("functions/[[path]].js");
  const app = read("docs/js/app.js");
  const root = read("index.html");
  const docsRoot = read("docs/index.html");

  assert.match(routes, /progression:\s*\{\s*canonical:\s*"\/progression"/);
  assert.match(routes, /aliases:\s*\["\/xp",\s*"\/ranks"\]/);
  assert.match(pagesFunction, /"\/progression"/);
  assert.match(pagesFunction, /"\/xp"/);
  assert.match(pagesFunction, /"\/ranks"/);
  assert.match(app, /registerView\("progression"/);
  assert.match(app, /window\.ProgressionAdminView\?\.init\?\.\(\)/);
  assert.match(root, /data-view="progression">XP \/ Level Controls/);
  assert.match(root, /"js\/progression\.js"/);
  assert.match(docsRoot, /data-view="progression">XP \/ Level Controls/);
  assert.match(docsRoot, /"js\/progression\.js"/);
});

test("progression view exposes the required admin control sections", () => {
  const html = read("docs/views/progression.html");

  assert.match(html, /Progression Overview \/ Search/);
  assert.match(html, /Level Definitions/);
  assert.match(html, /XP Rules/);
  assert.match(html, /Identity Progression Inspector/);
  assert.match(html, /apply manual ledger controls/);
  assert.match(html, /Leaderboard Hygiene/);
  assert.match(html, /LEVEL0 through LEVEL24/);
  assert.match(html, /Suppression affects public leaderboard display only/);
  assert.match(html, /Creator-private analytics remain separate/);
  assert.match(html, /ss-admin-control-section/);
  assert.match(html, /data-collapse-target="progression-rules"/);
  assert.match(html, /ss-progression-master-detail/);
  assert.doesNotMatch(html, /<div class="ss-progression-grid">/);
});

test("progression controller uses only runtime authority endpoints", () => {
  const js = read("docs/js/progression.js");

  assert.match(js, /CONFIG_RANKS = "\/api\/admin\/progression\/ranks"/);
  assert.match(js, /CONFIG_RULES = "\/api\/admin\/progression\/rules"/);
  assert.match(js, /IDENTITIES = "\/api\/admin\/progression\/identities"/);
  assert.match(js, /IDENTITY_EVENTS = \(identityCode\) => `\/api\/admin\/progression\/identities\/\$\{encodeURIComponent\(identityCode\)\}\/events`/);
  assert.match(js, /EVENT_REVERSE = \(eventCode\) => `\/api\/admin\/progression\/events\/\$\{encodeURIComponent\(eventCode\)\}\/reverse`/);
  assert.match(js, /LEADERBOARD = \(identityCode\) => `\/api\/admin\/progression\/identities\/\$\{encodeURIComponent\(identityCode\)\}\/leaderboard`/);
  assert.match(js, /function identityUserCode/);
  assert.match(js, /identity\.user_code \|\|[\s\S]*identity\.canonical_user_code \|\|[\s\S]*identity\.account_user_code/);
  assert.match(js, /function renderIdentityAvatar/);
  assert.match(js, /ss-progression-avatar has-image/);
  assert.match(js, /XP_ICON_PATH = "\/assets\/games\/xpstar\.webp"/);
  assert.match(js, /function renderLevelChip/);
  assert.match(js, /<span>\$\{escapeHtml\(level\.label\)\}<\/span>/);
  assert.doesNotMatch(js, /<span>Level \$\{escapeHtml\(level\.label\)\}<\/span>/);
  assert.match(js, /function renderXpValue/);
  assert.match(js, /User code:/);
  assert.match(js, /level_color_hex/);
  assert.match(js, /level_icon_path/);
  assert.match(js, /Public identity:/);
  assert.match(js, /validateRanks/);
  assert.match(js, /LEVEL0 threshold must stay 0/);
  assert.match(js, /Manual XP actions require a reason/);
  assert.match(js, /Leaderboard suppression requires a reason/);
  assert.match(js, /Reversal requires a reason/);
  assert.match(js, /LEVEL_PAGE_SIZE = 6/);
  assert.match(js, /IDENTITY_PAGE_SIZE = 10/);
  assert.match(js, /EVENT_PAGE_SIZE = 8/);
  assert.match(js, /data-progress-page/);
  assert.match(js, /data-collapse-target/);
  assert.doesNotMatch(js, /localStorage/);
  assert.doesNotMatch(js, /creator-scoped leaderboard/i);
});

test("progression styling includes compact avatar cells for identity rows", () => {
  const css = read("docs/css/components.css");

  assert.match(css, /\.ss-progression-identity\s*\{[\s\S]*grid-template-columns:\s*38px minmax\(0,\s*1fr\) auto/);
  assert.match(css, /\.ss-progression-avatar\s*\{/);
  assert.match(css, /\.ss-progression-avatar img\s*\{[\s\S]*object-fit:\s*cover/);
  assert.match(css, /\.ss-progression-level-chip/);
  assert.match(css, /\.ss-progression-xp-icon/);
  assert.match(css, /\.ss-progression-level-chip::before,[\s\S]*\.ss-progression-rank-chip::before\s*\{/);
  assert.match(css, /\.ss-progression-level-chip:hover::before,[\s\S]*\.ss-progression-rank-chip:focus-visible::before\s*\{[\s\S]*animation:\s*ss-progression-rank-chip-sheen 3\.2s/);
  assert.match(css, /@keyframes ss-progression-rank-chip-sheen/);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*\.ss-progression-rank-chip::before/);
  assert.match(css, /\.ss-admin-collapsible\.is-collapsed \.ss-admin-collapsible-body/);
  assert.match(css, /\.ss-admin-pager\s*\{/);
  assert.match(css, /\.ss-progression-master-detail\s*\{[\s\S]*grid-template-columns:\s*minmax\(430px,\s*1\.15fr\) minmax\(360px,\s*0\.85fr\)/);
  assert.match(css, /\.ss-progression-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(260px,\s*1\.2fr\)/);
});

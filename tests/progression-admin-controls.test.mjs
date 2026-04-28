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
  const app = read("docs/js/app.js");
  const root = read("index.html");
  const docsRoot = read("docs/index.html");

  assert.match(routes, /progression:\s*\{\s*canonical:\s*"\/progression"/);
  assert.match(routes, /aliases:\s*\["\/xp",\s*"\/ranks"\]/);
  assert.match(app, /registerView\("progression"/);
  assert.match(app, /window\.ProgressionAdminView\?\.init\?\.\(\)/);
  assert.match(root, /data-view="progression">XP \/ Rank Controls/);
  assert.match(root, /"js\/progression\.js"/);
  assert.match(docsRoot, /data-view="progression">XP \/ Rank Controls/);
  assert.match(docsRoot, /"js\/progression\.js"/);
});

test("progression view exposes the required admin control sections", () => {
  const html = read("docs/views/progression.html");

  assert.match(html, /Progression Overview \/ Search/);
  assert.match(html, /Rank Definitions/);
  assert.match(html, /XP Rules/);
  assert.match(html, /Identity Progression Inspector/);
  assert.match(html, /Manual Actions/);
  assert.match(html, /Leaderboard Hygiene/);
  assert.match(html, /RANK0 through RANK10/);
  assert.match(html, /Suppression affects public leaderboard display only/);
  assert.match(html, /Creator-private analytics remain separate/);
});

test("progression controller uses only runtime authority endpoints", () => {
  const js = read("docs/js/progression.js");

  assert.match(js, /CONFIG_RANKS = "\/api\/admin\/progression\/ranks"/);
  assert.match(js, /CONFIG_RULES = "\/api\/admin\/progression\/rules"/);
  assert.match(js, /IDENTITIES = "\/api\/admin\/progression\/identities"/);
  assert.match(js, /IDENTITY_EVENTS = \(identityCode\) => `\/api\/admin\/progression\/identities\/\$\{encodeURIComponent\(identityCode\)\}\/events`/);
  assert.match(js, /EVENT_REVERSE = \(eventCode\) => `\/api\/admin\/progression\/events\/\$\{encodeURIComponent\(eventCode\)\}\/reverse`/);
  assert.match(js, /LEADERBOARD = \(identityCode\) => `\/api\/admin\/progression\/identities\/\$\{encodeURIComponent\(identityCode\)\}\/leaderboard`/);
  assert.match(js, /validateRanks/);
  assert.match(js, /RANK0 threshold must stay 0/);
  assert.match(js, /Manual XP actions require a reason/);
  assert.match(js, /Leaderboard suppression requires a reason/);
  assert.match(js, /Reversal requires a reason/);
  assert.doesNotMatch(js, /localStorage/);
  assert.doesNotMatch(js, /creator-scoped leaderboard/i);
});

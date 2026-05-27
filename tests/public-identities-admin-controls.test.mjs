import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("public identities route is registered and script loads before app mount", () => {
  const routes = read("docs/js/admin-routes.js");
  const app = read("docs/js/app.js");
  const root = read("index.html");
  const docsRoot = read("docs/index.html");
  const pagesFunction = read("functions/[[path]].js");
  const docsPagesFunction = read("docs/functions/[[path]].js");

  assert.match(routes, /"public-identities":\s*\{\s*canonical:\s*"\/public-identities"/);
  assert.match(routes, /aliases:\s*\["\/accounts\/public-identities"\]/);
  assert.match(app, /registerView\("public-identities"/);
  assert.match(app, /window\.PublicIdentitiesView\?\.init\?\.\(\)/);
  assert.match(app, /"public-identities":\s*"\/assets\/icons\/ui\/identity\.svg"/);
  assert.match(root, /data-view="public-identities">Public Identities/);
  assert.match(docsRoot, /data-view="public-identities">Public Identities/);
  assert.match(root, /"js\/public-identities\.js",\s*"js\/app\.js"/);
  assert.match(docsRoot, /"js\/public-identities\.js",\s*"js\/app\.js"/);
  assert.match(pagesFunction, /"\/public-identities"/);
  assert.match(pagesFunction, /"\/accounts\/public-identities"/);
  assert.match(docsPagesFunction, /"\/public-identities"/);
});

test("public identities view exposes filters, states, diagnostics, and assignment controls", () => {
  const html = read("docs/views/public-identities.html");

  assert.match(html, /Runtime\/Auth is authoritative/);
  assert.match(html, /data-public-identities-status="review"/);
  assert.match(html, /data-public-identities-status="unresolved"/);
  assert.match(html, /data-public-identities-status="ambiguous"/);
  assert.match(html, /data-public-identities-status="resolved"/);
  assert.match(html, /data-public-identities-status="ignored"/);
  assert.match(html, /id="public-identities-platform"/);
  assert.match(html, /id="public-identities-scope"/);
  assert.match(html, /id="public-identities-query"/);
  assert.match(html, /id="public-identities-list"/);
  assert.match(html, /id="public-identities-empty"/);
  assert.match(html, /id="public-identities-error"/);
  assert.match(html, /id="public-identities-assignment"/);
  assert.match(html, /Historical ledger rows are not deleted/);
});

test("public identities controller uses Runtime/Auth endpoints and conflict-aware assignment", () => {
  const js = read("docs/js/public-identities.js");

  assert.match(js, /RECONCILIATION = "\/api\/admin\/public-identities\/reconciliation"/);
  assert.match(js, /ASSIGN = "\/api\/admin\/public-identities\/reconciliation\/assign"/);
  assert.match(js, /UNASSIGN = "\/api\/admin\/public-identities\/reconciliation\/unassign"/);
  assert.match(js, /REVIEW = "\/api\/admin\/public-identities\/reconciliation\/review"/);
  assert.match(js, /ACCOUNT_SEARCH = "\/api\/admin\/accounts\/search"/);
  assert.match(js, /params\.set\("status",\s*state\.status\)/);
  assert.match(js, /function renderDiagnostics/);
  assert.match(js, /resolver\.candidates/);
  assert.match(js, /function searchAccounts/);
  assert.match(js, /public-identities-account-query/);
  assert.match(js, /function assignSelected/);
  assert.match(js, /Reassignment requires explicit confirmation/);
  assert.match(js, /reassign,\s*force:\s*reassign/);
  assert.match(js, /assignment_note:\s*note/);
  assert.match(js, /participant_key:\s*record\.participant_key/);
  assert.match(js, /platform_user_id:\s*record\.platform_user_id \|\| record\.sender_user_id/);
  assert.match(js, /function unassignSelected/);
  assert.match(js, /function identityChip/);
  assert.match(js, /data-public-identities-unassign-chip/);
  assert.match(js, /Required reason\/note/);
  assert.match(js, /body: JSON\.stringify\(\{ identity_code: identityCode, account_id: accountId \|\| record\?\.account_id, reason \}\)/);
  assert.match(js, /function reviewSelected/);
  assert.match(js, /review_status:\s*reviewStatus/);
  assert.doesNotMatch(js, /localStorage/);
});

test("public identities styling is compact and responsive", () => {
  const css = read("docs/css/components.css");

  assert.match(css, /\.ss-public-identities-toolbar\s*\{[\s\S]*grid-template-columns:/);
  assert.match(css, /\.ss-public-identities-row-main\s*\{[\s\S]*grid-template-columns:/);
  assert.match(css, /\.ss-public-identities-assignment-grid\s*\{[\s\S]*grid-template-columns:/);
  assert.match(css, /\.ss-public-identities-chip\.is-warning/);
  assert.match(css, /\.ss-public-identity-chip-row/);
  assert.match(css, /button\.ss-public-identity-chip:hover/);
  assert.match(css, /\.ss-public-identities-account-results\s*\{[\s\S]*max-height:\s*260px/);
  assert.match(css, /@media \(max-width:\s*1100px\)[\s\S]*\.ss-public-identities-toolbar/);
});

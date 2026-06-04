import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("standalone admin login includes inline turnstile wiring", () => {
  const html = read("docs/auth/login.html");
  const js = read("docs/js/admin-login.js");

  assert.match(html, /admin-login-turnstile-panel/);
  assert.match(html, /<script src="\/js\/turnstile-inline\.js" defer><\/script>/);
  assert.match(html, /<script src="\/js\/admin-login\.js" defer><\/script>/);
  assert.match(js, /const baseUrl = getMetaContent\("streamsuites-auth-base"\);/);
  assert.match(js, /const turnstileConfigUrl = base \? `\$\{base\}\/auth\/turnstile\/config` : "\/auth\/turnstile\/config";/);
  assert.doesNotMatch(js, /configUrl:\s*"\/auth\/turnstile\/config"/);
  assert.match(js, /requireToken/);
  assert.match(js, /turnstile_token/);
});

test("admin overlay markup keeps parity links and turnstile slot", () => {
  for (const relativePath of ["docs/index.html", "index.html"]) {
    const html = read(relativePath);
    assert.match(html, /admin-auth-turnstile-panel/);
    assert.match(html, /Login to other surfaces/);
    assert.doesNotMatch(html, /Elsewhere/);
    assert.match(html, /Creator Dashboard/);
    assert.match(html, /Developer Console/);
    assert.match(html, /admin-user-overview-name/);
    assert.match(html, /admin-user-overview-email/);
    assert.match(html, /admin-user-overview-role/);
    assert.match(html, /admin-user-overview-tier/);
    assert.ok(
      html.indexOf("Login to other surfaces") < html.indexOf("admin-auth-turnstile-status"),
      `${relativePath} should keep the Turnstile block below alternate surface links`
    );
  }

  const standaloneHtml = read("docs/auth/login.html");
  assert.match(standaloneHtml, /admin-login-turnstile-panel/);
  assert.match(standaloneHtml, /Login to other surfaces/);
  assert.doesNotMatch(standaloneHtml, /Elsewhere/);
  assert.match(standaloneHtml, /Creator Dashboard/);
  assert.match(standaloneHtml, /Developer Console/);
});

test("admin overlay auth controller now explicitly initializes inline turnstile", () => {
  const js = read("docs/js/admin-auth.js");
  const helper = read("docs/js/turnstile-inline.js");

  assert.match(js, /TURNSTILE_HELPER_URL/);
  assert.match(js, /loadTurnstileHelper/);
  assert.match(js, /createController/);
  assert.match(js, /ensureTurnstileInitialized/);
  assert.match(js, /syncTurnstileRuntimeNotice/);
  assert.match(js, /isRuntimeDisabled/);
  assert.match(js, /requireToken/);
  assert.match(js, /turnstile_token/);
  assert.match(helper, /runtime_enabled/);
  assert.match(helper, /configured/);
  assert.match(helper, /panel\.hidden = !state\.enabled/);
  assert.match(helper, /if \(!state\.enabled\) \{\s*setStatus\(status, ""\);/);
  assert.match(helper, /isRuntimeDisabled\(\)/);
});

test("admin auth status region fully collapses when empty and clears stale state", () => {
  const standaloneJs = read("docs/js/admin-login.js");
  const overlayJs = read("docs/js/admin-auth.js");
  const css = read("docs/css/base.css");

  assert.match(css, /\.admin-auth-status\s*\{[\s\S]*display:\s*none;/);
  assert.match(css, /\.admin-auth-status:not\(:empty\)\s*\{[\s\S]*margin-top:\s*14px;/);
  assert.match(css, /\.admin-auth-status\[data-state=\\\"warning\\\"\]/);
  assert.match(standaloneJs, /delete elements\.status\.dataset\.state;/);
  assert.match(overlayJs, /delete this\.elements\.status\.dataset\.state;/);
  assert.match(standaloneJs, /Cloudflare Turnstile is disabled by runtime env\./);
  assert.match(overlayJs, /Cloudflare Turnstile is disabled by runtime env\./);
});

test("admin session consumer hydrates the dropdown overview card", () => {
  const js = read("docs/js/admin-auth.js");
  const css = read("docs/css/base.css");

  assert.match(js, /overviewName/);
  assert.match(js, /overviewEmail/);
  assert.match(js, /overviewRole/);
  assert.match(js, /overviewTier/);
  assert.match(css, /ss-user-menu-overview/);
});

test("admin account/avatar surfaces consume normalized runtime image metadata", () => {
  const authJs = read("docs/js/admin-auth.js");
  const gateJs = read("docs/js/admin-gate.js");
  const accountsJs = read("docs/js/accounts.js");
  const creatorsJs = read("docs/js/creators.js");
  const userDetailJs = read("docs/js/user-detail.js");

  for (const js of [authJs, gateJs, accountsJs, creatorsJs, userDetailJs]) {
    assert.match(js, /normalizedImageContract/);
    assert.match(js, /stableImageUrl/);
    assert.match(js, /provider_picture/);
    assert.match(js, /profile_photo_url/);
    assert.match(js, /public_avatar_url/);
    const stableImageHelper = js.match(/function stableImageUrl\(url, cacheKey\)[\s\S]*?\n  }\n\n  function normalizedImageContract/)?.[0] || "";
    assert.doesNotMatch(stableImageHelper, /Date\.now\(\)/);
    assert.match(stableImageHelper, /parsed\.origin !== window\.location\.origin\) return source/);
  }
  assert.match(authJs, /const imageContract = normalizedImageContract\(payload, payload\?\.user \|\| \{\}\)/);
  assert.match(gateJs, /avatarUrl: normalizedImageContract\(payload, payload\.user \|\| \{\}\)/);
  assert.match(accountsJs, /const imageContract = normalizedImageContract\(raw, publicProfile\)/);
  assert.match(creatorsJs, /const imageContract = normalizedImageContract\(entry, account\)/);
  assert.match(userDetailJs, /const imageContract = normalizedImageContract\(account, publicProfile\)/);
  assert.match(accountsJs, /onerror="this\.closest\('\.accounts-table-avatar'\)\?\.classList\.remove\('has-image'\)/);
});

test("admin sidebar keeps the desktop rail tight and centers collapsed nav icons", () => {
  const css = read("docs/css/base.css");

  assert.match(css, /--app-sidebar-width:\s*258px;/);
  assert.match(css, /html\.ss-sidebar-collapsed #app-nav \.nav-shell,[\s\S]*padding-inline:\s*0;/);
  assert.match(css, /html\.ss-sidebar-collapsed #app-nav #app-nav-list,[\s\S]*align-items:\s*center !important;[\s\S]*padding-left:\s*0;[\s\S]*scrollbar-gutter:\s*auto;/);
  assert.match(css, /html\.ss-sidebar-collapsed #app-nav #app-nav-list > li\[data-view\],[\s\S]*width:\s*calc\(var\(--app-sidebar-collapsed-width\) - 24px\) !important;[\s\S]*justify-content:\s*center;[\s\S]*gap:\s*0;[\s\S]*padding-left:\s*0;[\s\S]*padding-right:\s*0;/);
  assert.match(css, /@media \(max-width:\s*980px\)[\s\S]*html\.ss-sidebar-collapsed #app-nav \.nav-shell,[\s\S]*padding-inline:\s*0;/);
});

test("account management uses dedicated developer access controls instead of developer tier options", () => {
  const accountsJs = read("docs/js/accounts.js");
  const userDetailJs = read("docs/js/user-detail.js");
  const css = read("docs/css/components.css");

  assert.doesNotMatch(accountsJs, /"DEVELOPER"\]/);
  assert.match(accountsJs, /Grant Developer/);
  assert.match(accountsJs, /Revoke Developer/);
  assert.match(accountsJs, /developer-access/);
  assert.match(accountsJs, /data-account-public-handle-save/);
  assert.match(accountsJs, /\/api\/admin\/accounts\/\$\{encodeURIComponent\(accountId\)\}\/public-profile-slug/);
  assert.match(accountsJs, /public_slug_taken/);
  assert.match(accountsJs, /function renderPublicIdentityChips/);
  assert.match(accountsJs, /data-public-identity-unassign-chip/);
  assert.match(accountsJs, /Public identity unassign requires a reason\/note/);
  assert.match(accountsJs, /\/api\/admin\/public-identities\/reconciliation\/unassign/);

  assert.doesNotMatch(userDetailJs, /<option value="DEVELOPER"/);
  assert.match(userDetailJs, /Grant Developer/);
  assert.match(userDetailJs, /Revoke Developer/);
  assert.match(userDetailJs, /developer-access/);
  assert.match(userDetailJs, /function renderPublicIdentityChips/);
  assert.match(userDetailJs, /data-public-identity-unassign-chip/);
  assert.match(userDetailJs, /Required reason\/note/);
  assert.match(userDetailJs, /\/api\/admin\/public-identities\/reconciliation\/unassign/);
  assert.match(css, /\.ss-public-identity-chip\.is-primary/);
});

test("account badge governance drawer uses compact summary and modal editor", () => {
  const accountsView = read("docs/views/accounts.html");
  const accountsJs = read("docs/js/accounts.js");
  const componentsCss = read("docs/css/components.css");

  assert.match(accountsView, /accounts-badge-governance-modal/);
  assert.match(accountsView, /role="dialog"/);
  assert.match(accountsView, /aria-modal="true"/);

  assert.match(accountsJs, /renderAccountBadgeGovernanceSummary/);
  assert.match(accountsJs, /renderAccountBadgeGovernanceEditor/);
  assert.match(accountsJs, /data-account-badge-governance-open/);
  assert.match(accountsJs, /Edit badge governance/);
  assert.match(accountsJs, /openBadgeGovernanceModal/);
  assert.match(accountsJs, /refreshOpenBadgeGovernanceSurfaces/);
  assert.match(accountsJs, /resolveBadgeVisibilityOverrideMode/);
  assert.match(accountsJs, /data-account-badge-governance-close/);
  assert.match(accountsJs, /saveAccountBadgeGovernance\(user, el\.badgeGovernanceModal/);

  assert.match(componentsCss, /accounts-badge-governance-summary-card/);
  assert.match(componentsCss, /accounts-badge-governance-modal-body/);
  assert.match(componentsCss, /max-height: min\(88dvh, 920px\)/);
  assert.match(componentsCss, /overflow: auto/);
  assert.match(componentsCss, /accounts-badge-governance-modal-body \.badge-governance-summary-grid \.badge-governance-matrix-card/);
  assert.match(componentsCss, /grid-column: 1 \/ -1/);
  assert.match(componentsCss, /min-width: max\(100%, 960px\)/);
});

test("accounts list hydration is deduped and classifies failures without retry storms", () => {
  const accountsJs = read("docs/js/accounts.js");

  assert.match(accountsJs, /accountsHydrationRequest/);
  assert.match(accountsJs, /if \(state\.accountsHydrationRequest\) \{/);
  assert.match(accountsJs, /performLoadUsers\(options\)\.finally/);
  assert.match(accountsJs, /requestAccountList\(\{ retry: options\.retry === true \}\)/);
  assert.match(accountsJs, /createAccountsHydrationError\("unauthorized"/);
  assert.match(accountsJs, /createAccountsHydrationError\("forbidden"/);
  assert.match(accountsJs, /createAccountsHydrationError\("malformed"/);
  assert.match(accountsJs, /createAccountsHydrationError\("client_render"/);
  assert.match(accountsJs, /Runtime account response did not match the Dashboard contract/);
  assert.match(accountsJs, /Runtime API unavailable\. Showing last loaded accounts\./);
  assert.match(accountsJs, /retryLoadUsers/);
  assert.match(accountsJs, /state\.bannerDedupe/);
  assert.doesNotMatch(accountsJs, /catch \(err\) \{\s*console\.warn\("\[Accounts\] Failed to load runtime accounts"/);
});

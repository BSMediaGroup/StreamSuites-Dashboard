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

test("account management uses dedicated developer access controls instead of developer tier options", () => {
  const accountsJs = read("docs/js/accounts.js");
  const userDetailJs = read("docs/js/user-detail.js");

  assert.doesNotMatch(accountsJs, /"DEVELOPER"\]/);
  assert.match(accountsJs, /Grant Developer/);
  assert.match(accountsJs, /Revoke Developer/);
  assert.match(accountsJs, /developer-access/);
  assert.match(accountsJs, /data-account-public-handle-save/);
  assert.match(accountsJs, /\/api\/admin\/accounts\/\$\{encodeURIComponent\(accountId\)\}\/public-profile-slug/);
  assert.match(accountsJs, /public_slug_taken/);

  assert.doesNotMatch(userDetailJs, /<option value="DEVELOPER"/);
  assert.match(userDetailJs, /Grant Developer/);
  assert.match(userDetailJs, /Revoke Developer/);
  assert.match(userDetailJs, /developer-access/);
});

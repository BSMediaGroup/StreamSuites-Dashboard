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
  assert.match(js, /auth\/turnstile\/config/);
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
  }

  const standaloneHtml = read("docs/auth/login.html");
  assert.match(standaloneHtml, /admin-login-turnstile-panel/);
  assert.match(standaloneHtml, /Login to other surfaces/);
  assert.doesNotMatch(standaloneHtml, /Elsewhere/);
  assert.match(standaloneHtml, /Creator Dashboard/);
  assert.match(standaloneHtml, /Developer Console/);
});

test("account management uses dedicated developer access controls instead of developer tier options", () => {
  const accountsJs = read("docs/js/accounts.js");
  const userDetailJs = read("docs/js/user-detail.js");

  assert.doesNotMatch(accountsJs, /"DEVELOPER"\]/);
  assert.match(accountsJs, /Grant Developer/);
  assert.match(accountsJs, /Revoke Developer/);
  assert.match(accountsJs, /developer-access/);

  assert.doesNotMatch(userDetailJs, /<option value="DEVELOPER"/);
  assert.match(userDetailJs, /Grant Developer/);
  assert.match(userDetailJs, /Revoke Developer/);
  assert.match(userDetailJs, /developer-access/);
});

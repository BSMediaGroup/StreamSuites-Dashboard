import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("Studio access route, navigation, scripts, and deep-route fallbacks are registered", () => {
  const routes = read("docs/js/admin-routes.js");
  const app = read("docs/js/app.js");
  const rootShell = read("index.html");
  const docsShell = read("docs/index.html");
  const rootFunction = read("functions/[[path]].js");
  const docsFunction = read("docs/functions/[[path]].js");

  assert.match(routes, /studio:\s*\{\s*canonical:\s*"\/studio",\s*aliases:\s*\["\/studio\/access"\]/);
  assert.match(app, /registerView\("studio",\s*\{[\s\S]*StudioAccessView\?\.init/);
  assert.match(app, /studio:\s*"\/assets\/icons\/ui\/media\.svg"/);
  for (const shell of [rootShell, docsShell]) {
    assert.match(shell, /data-view="studio">Studio<\/li>/);
    assert.match(shell, /"js\/studio-access-api\.js"/);
    assert.match(shell, /"js\/studio\.js"/);
  }
  for (const source of [rootFunction, docsFunction]) {
    assert.match(source, /"\/studio"/);
    assert.match(source, /"\/studio\/access"/);
  }
});

test("Studio API adapter delegates exact Runtime/Auth contracts to the shared credentialed client", async () => {
  const calls = [];
  const sandbox = {
    window: {
      StreamSuitesApi: {
        apiFetch: async (requestPath, options = {}) => {
          calls.push({ requestPath, options });
          return { success: true };
        }
      }
    }
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(read("docs/js/studio-access-api.js"), sandbox);
  const api = sandbox.window.StreamSuitesStudioAccessApi;

  await api.getStudioAccess();
  await api.createStudioAccess("account-1", "Initial tester");
  await api.updateStudioAccess("account/2", { enabled: true });
  await api.revokeStudioAccess("account/2");
  await api.getAdminAccounts();

  assert.equal(calls[0].requestPath, "/api/admin/studio/access");
  assert.equal(calls[1].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].options.body), { account_id: "account-1", note: "Initial tester" });
  assert.equal(calls[2].requestPath, "/api/admin/studio/access/account%2F2");
  assert.equal(calls[2].options.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[2].options.body), { enabled: true });
  assert.equal(calls[3].options.method, "DELETE");
  assert.equal(calls[4].requestPath, "/admin/accounts");
});

test("Studio controller maps confirmed errors and reuses authoritative account selection", () => {
  const sandbox = { window: {}, document: { readyState: "loading", addEventListener() {} }, console, Intl, URLSearchParams, AbortController, setTimeout, clearTimeout };
  sandbox.window.window = sandbox.window;
  sandbox.window.addEventListener = () => {};
  sandbox.window.setTimeout = setTimeout;
  vm.createContext(sandbox);
  vm.runInContext(read("docs/js/studio.js"), sandbox);
  const view = sandbox.window.StudioAccessView;

  assert.equal(view.classifyError({ status: 401 }).kind, "session");
  assert.equal(view.classifyError({ status: 403 }).kind, "forbidden");
  assert.match(view.classifyError({ status: 409, payload: { error_code: "studio_access_tester_limit_reached" } }).message, /limit has been reached/i);
  assert.match(view.classifyError({ status: 409, payload: { error_code: "studio_access_account_ineligible" } }).message, /not eligible/i);

  const account = view.normalizeAccount({
    internal_id: "stable-id",
    display_name: "Tester",
    email: "tester@example.com",
    role: "creator",
    tier: "pro",
    account_status: "active",
    email_verified: true
  });
  assert.equal(account.id, "stable-id");
  assert.equal(account.accountType, "creator");
  assert.equal(account.emailVerified, true);

  const source = read("docs/js/studio.js");
  assert.match(source, /active_invited_tester_count/);
  assert.match(source, /maximum_invited_tester_count/);
  assert.match(source, /revokeStudioAccess/);
  assert.match(source, /updateStudioAccess\(accountId, \{ enabled: true \}/);
  assert.match(source, /Admin accounts already receive Studio access automatically/);
  assert.match(source, /streamsuites:view-hydration/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});

test("Studio view exposes truthful summary, accessible grant controls, and no room/media controls", () => {
  const html = read("docs/views/studio.html");
  assert.match(html, /Closed ALPHA Access/);
  assert.match(html, /id="studio-active-count"/);
  assert.match(html, /id="studio-limit"/);
  assert.match(html, /id="studio-remaining"/);
  assert.match(html, /Admin accounts are automatically eligible and never consume invited tester slots/);
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(html, /<caption class="sr-only">StreamSuites Studio ALPHA access grants<\/caption>/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /No rooms, destinations, scenes, guests, recordings, broadcasting, or media configuration controls/);
  assert.doesNotMatch(html, /data-studio-action="(room|record|broadcast|destination)"/);
});

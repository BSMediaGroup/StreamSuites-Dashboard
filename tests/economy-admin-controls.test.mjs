import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("economy admin route is registered and loaded by the dashboard shell", () => {
  const routes = read("docs/js/admin-routes.js");
  const pagesFunction = read("functions/[[path]].js");
  const docsPagesFunction = read("docs/functions/[[path]].js");
  const app = read("docs/js/app.js");
  const root = read("index.html");
  const docsRoot = read("docs/index.html");

  assert.match(routes, /economy:\s*\{\s*canonical:\s*"\/economy"/);
  assert.match(routes, /aliases:\s*\["\/economy-inventory",\s*"\/inventory"\]/);
  assert.match(pagesFunction, /"\/economy"/);
  assert.match(pagesFunction, /"\/economy-inventory"/);
  assert.match(pagesFunction, /"\/inventory"/);
  assert.match(docsPagesFunction, /"\/economy"/);
  assert.match(app, /registerView\("economy"/);
  assert.match(app, /window\.EconomyInventoryAdminView\?\.init\?\.\(\)/);
  assert.match(app, /economy:\s*"\/assets\/games\/sscoin\.webp"/);
  assert.match(root, /data-view="economy">Economy \/ Inventory/);
  assert.match(root, /"js\/economy\.js"/);
  assert.match(docsRoot, /data-view="economy">Economy \/ Inventory/);
  assert.match(docsRoot, /"js\/economy\.js"/);
});

test("economy view exposes required control sections and boundary copy", () => {
  const html = read("docs/views/economy.html");

  assert.match(html, /Economy Overview \/ Identity Search/);
  assert.match(html, /Wallet Inspector/);
  assert.match(html, /Economy Ledger/);
  assert.match(html, /Manual Economy Actions/);
  assert.match(html, /Inventory Inspector/);
  assert.match(html, /Manual Inventory Actions/);
  assert.match(html, /Inventory Events/);
  assert.match(html, /Item Definitions/);
  assert.match(html, /Reversal rows are new ledger events/);
  assert.match(html, /No storefront, trading, transfers, consumption loop/);
});

test("economy controller uses runtime authority endpoints and canonical coin asset", () => {
  const js = read("docs/js/economy.js");

  assert.match(js, /IDENTITIES = "\/api\/admin\/economy\/identities"/);
  assert.match(js, /ECONOMY_EVENTS = \(identityCode\) => `\/api\/admin\/economy\/identities\/\$\{encodeURIComponent\(identityCode\)\}\/events`/);
  assert.match(js, /ECONOMY_EVENT_REVERSE = \(eventCode\) => `\/api\/admin\/economy\/events\/\$\{encodeURIComponent\(eventCode\)\}\/reverse`/);
  assert.match(js, /INVENTORY_EVENT_CREATE = \(identityCode\) => `\/api\/admin\/inventory\/identities\/\$\{encodeURIComponent\(identityCode\)\}\/events`/);
  assert.match(js, /INVENTORY_EVENT_REVERSE = \(eventCode\) => `\/api\/admin\/inventory\/events\/\$\{encodeURIComponent\(eventCode\)\}\/reverse`/);
  assert.match(js, /ITEM_DEFINITIONS = "\/api\/admin\/inventory\/items"/);
  assert.match(js, /COIN_ICON_PATH = "\/assets\/games\/sscoin\.webp"/);
  assert.match(js, /function identityUserCode/);
  assert.match(js, /identity\.user_code \|\|[\s\S]*identity\.canonical_user_code \|\|[\s\S]*identity\.account_user_code/);
  assert.match(js, /Manual economy actions require a reason/);
  assert.match(js, /Economy reversal requires an event code and reason/);
  assert.match(js, /Manual inventory actions require a reason/);
  assert.match(js, /Inventory reversal requires an event code and reason/);
  assert.match(js, /Item definition metadata changes require a reason/);
  assert.doesNotMatch(js, /localStorage/);
  assert.doesNotMatch(js, /storefront|trading|transfer|consume item/i);
});

test("economy styling includes compact identity rows and sscoin icon treatment", () => {
  const css = read("docs/css/components.css");

  assert.match(css, /\.ss-economy-identity\s*\{[\s\S]*grid-template-columns:\s*38px minmax\(0,\s*1fr\) auto/);
  assert.match(css, /\.ss-economy-avatar img,[\s\S]*\.ss-economy-item-icon img\s*\{[\s\S]*object-fit:\s*cover/);
  assert.match(css, /\.ss-economy-coin-icon\s*\{[\s\S]*object-fit:\s*contain/);
  assert.match(css, /\.ss-economy-coin-value--compact \.ss-economy-coin-icon\s*\{[\s\S]*width:\s*16px/);
  assert.match(css, /\.ss-economy-state-reversed,[\s\S]*\.ss-economy-state-reversal/);
});

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
  assert.match(app, /economy:\s*"\/assets\/icons\/economy\.svg"/);
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
  assert.match(html, /ss-admin-control-section/);
  assert.match(html, /ss-economy-master-detail/);
  assert.match(html, /data-collapse-target="economy-ledger"/);
  assert.match(html, /data-collapse-target="economy-actions"/);
  assert.match(html, /data-collapse-target="inventory-actions"/);
  assert.match(html, /id="economy-identity-search-section"/);
  assert.match(html, /id="economy-wallet-section"/);
  assert.match(html, /id="economy-ledger-section"/);
  assert.match(html, /id="economy-actions-section"/);
  assert.match(html, /id="economy-inventory-section"/);
  assert.match(html, /id="economy-inventory-events-section"/);
  assert.match(html, /id="economy-inventory-actions-section"/);
  assert.match(html, /id="economy-item-definitions-section"/);
  assert.doesNotMatch(html, /<div class="ss-economy-grid">/);
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
  assert.match(js, /activeFieldValue\("#economy-actions \.ss-economy-action-grid", "#economy-action-reason"\)/);
  assert.match(js, /body: JSON\.stringify\(\{ event_type: eventType, amount_delta: amount, reason_text: reason \}\)/);
  assert.match(js, /activeFieldValue\("#economy-inventory-actions \.ss-economy-action-grid", "#inventory-action-reason"\)/);
  assert.match(js, /body: JSON\.stringify\(\{ event_type: eventType, item_code: itemCode, quantity_delta: quantity, reason_text: reason \}\)/);
  assert.match(js, /activeFieldValue\("#economy-actions \.ss-economy-reversal-box", "#economy-reversal-reason"\)/);
  assert.match(js, /body: JSON\.stringify\(\{ reason_text: reason \}\)/);
  assert.match(js, /activeFieldValue\("#economy-inventory-actions \.ss-economy-reversal-box", "#inventory-reversal-reason"\)/);
  assert.match(js, /IDENTITY_PAGE_SIZE = 10/);
  assert.match(js, /EVENT_PAGE_SIZE = 8/);
  assert.match(js, /ITEM_PAGE_SIZE = 6/);
  assert.match(js, /data-economy-page/);
  assert.match(js, /ss-economy-item-editor/);
  assert.match(js, /category: readField\("category"\)/);
  assert.match(js, /is_enabled: readField\("is_enabled"\) !== "false"/);
  assert.doesNotMatch(js, /localStorage/);
  assert.doesNotMatch(js, /storefront|trading|transfer|consume item/i);
});

test("economy manual and reversal controls read visible reason fields", () => {
  const js = read("docs/js/economy.js");

  assert.match(js, /function activeFieldValue\(formSelector, fieldSelector\)/);
  assert.match(js, /const reason = activeFieldValue\("#economy-actions \.ss-economy-action-grid", "#economy-action-reason"\);/);
  assert.match(js, /const reason = activeFieldValue\("#economy-inventory-actions \.ss-economy-action-grid", "#inventory-action-reason"\);/);
  assert.match(js, /const reason = activeFieldValue\("#economy-actions \.ss-economy-reversal-box", "#economy-reversal-reason"\);/);
  assert.match(js, /const reason = activeFieldValue\("#economy-inventory-actions \.ss-economy-reversal-box", "#inventory-reversal-reason"\);/);
  assert.match(js, /const eventType = activeFieldValue\("#economy-actions \.ss-economy-action-grid", "#economy-action-type"\);/);
  assert.match(js, /<option value="grant">Grant<\/option><option value="penalty">Penalty<\/option><option value="adjustment">Adjustment<\/option>/);
  assert.match(js, /const eventType = activeFieldValue\("#economy-inventory-actions \.ss-economy-action-grid", "#inventory-action-type"\);/);
  assert.match(js, /<option value="grant">Grant<\/option><option value="remove">Remove<\/option><option value="adjustment">Adjust<\/option>/);
});

test("economy collapsible sections default expanded", () => {
  const html = read("docs/views/economy.html");

  assert.match(html, /data-collapse-target="economy-ledger" aria-expanded="true">Collapse/);
  assert.match(html, /data-collapse-target="economy-actions" aria-expanded="true">Collapse/);
  assert.match(html, /data-collapse-target="inventory-actions" aria-expanded="true">Collapse/);
  assert.match(html, /data-collapse-target="inventory-events" aria-expanded="true">Collapse/);
  assert.match(html, /ss-admin-collapse-toggle/);
  assert.match(html, /ss-admin-collapsible-body/);
  assert.doesNotMatch(html, /data-collapse-target="(?:economy-ledger|economy-actions|inventory-actions|inventory-events)" aria-expanded="false"/);
});

test("economy route uses the shared top-bar section anchor row", () => {
  const app = read("docs/js/app.js");

  assert.match(app, /economy:\s*Object\.freeze\(\{/);
  assert.match(app, /storageKey:\s*"ss_economy_shell_tabs_collapsed"/);
  assert.match(app, /toggleLabel:\s*"economy section tabs"/);
  assert.match(app, /\{ id: "economy-identity-search-section", label: "Identity Search" \}/);
  assert.match(app, /\{ id: "economy-wallet-section", label: "Wallet" \}/);
  assert.match(app, /\{ id: "economy-ledger-section", label: "Economy Ledger" \}/);
  assert.match(app, /\{ id: "economy-actions-section", label: "Manual Economy Actions" \}/);
  assert.match(app, /\{ id: "economy-inventory-section", label: "Inventory" \}/);
  assert.match(app, /\{ id: "economy-inventory-events-section", label: "Inventory Events" \}/);
  assert.match(app, /\{ id: "economy-inventory-actions-section", label: "Manual Inventory Actions" \}/);
  assert.match(app, /\{ id: "economy-item-definitions-section", label: "Item Definitions" \}/);
  assert.match(app, /data-accounts-shell-anchor="\$\{section\.id\}"/);
  assert.match(app, /scrollToAccountsShellSection\(sectionId\)/);
  assert.match(app, /if \(!resolveSectionShellConfig\(App\.currentView\)\) return;/);
});

test("economy styling includes compact identity rows and sscoin icon treatment", () => {
  const css = read("docs/css/components.css");

  assert.match(css, /\.ss-economy-identity\s*\{[\s\S]*grid-template-columns:\s*38px minmax\(0,\s*1fr\) auto/);
  assert.match(css, /\.ss-economy-avatar img,[\s\S]*\.ss-economy-item-icon img\s*\{[\s\S]*object-fit:\s*cover/);
  assert.match(css, /\.ss-economy-coin-icon\s*\{[\s\S]*object-fit:\s*contain/);
  assert.match(css, /\.ss-economy-coin-value--compact \.ss-economy-coin-icon\s*\{[\s\S]*width:\s*16px/);
  assert.match(css, /\.ss-economy-state-reversed,[\s\S]*\.ss-economy-state-reversal/);
  assert.match(css, /\.ss-economy-master-detail\s*\{[\s\S]*grid-template-columns:\s*minmax\(440px,\s*1\.35fr\) minmax\(320px,\s*0\.85fr\)/);
  assert.match(css, /\.ss-economy-item-definition-summary\s*\{[\s\S]*grid-template-columns:\s*38px minmax\(0,\s*1fr\) auto/);
  assert.match(css, /\.ss-economy-item-editor\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.ss-admin-pager\s*\{/);
});

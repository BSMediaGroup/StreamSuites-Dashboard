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
  assert.match(html, /Economy Settings/);
  assert.match(html, /Denominations/);
  assert.match(html, /Wallet Inspector/);
  assert.match(html, /Economy Ledger/);
  assert.match(html, /Manual Economy Actions/);
  assert.match(html, /Inventory Inspector/);
  assert.match(html, /Manual Inventory Actions/);
  assert.match(html, /Gem \/ Diamond Exchange/);
  assert.match(html, /Inventory Events/);
  assert.match(html, /Item Definitions/);
  assert.match(html, /Danger Zone/);
  assert.match(html, /id="economy-item-create-form"/);
  assert.match(html, /id="economy-danger-zone"/);
  assert.match(html, /Reversal rows are new ledger events/);
  assert.match(html, /No storefront, trading, transfers, consumption loop/);
  assert.match(html, /ss-admin-control-section/);
  assert.match(html, /ss-economy-master-detail/);
  assert.match(html, /data-collapse-target="economy-ledger"/);
  assert.match(html, /data-collapse-target="economy-actions"/);
  assert.match(html, /data-collapse-target="inventory-actions"/);
  assert.match(html, /id="economy-identity-search-section"/);
  assert.match(html, /id="economy-settings-section"/);
  assert.match(html, /id="economy-denominations-section"/);
  assert.match(html, /id="economy-wallet-section"/);
  assert.match(html, /id="economy-ledger-section"/);
  assert.match(html, /id="economy-actions-section"/);
  assert.match(html, /id="economy-inventory-section"/);
  assert.match(html, /id="economy-inventory-events-section"/);
  assert.match(html, /id="economy-inventory-actions-section"/);
  assert.match(html, /id="economy-exchange-section"/);
  assert.match(html, /id="economy-item-definitions-section"/);
  assert.match(html, /id="economy-danger-zone-section"/);
  assert.doesNotMatch(html, /<div class="ss-economy-grid">/);
});

test("economy controller uses runtime authority endpoints and configurable currency model", () => {
  const js = read("docs/js/economy.js");

  assert.match(js, /IDENTITIES = "\/api\/admin\/economy\/identities"/);
  assert.match(js, /ECONOMY_EVENTS = \(identityCode\) => `\/api\/admin\/economy\/identities\/\$\{encodeURIComponent\(identityCode\)\}\/events`/);
  assert.match(js, /ECONOMY_EXCHANGE = \(identityCode\) => `\/api\/admin\/economy\/identities\/\$\{encodeURIComponent\(identityCode\)\}\/exchange`/);
  assert.match(js, /ECONOMY_EVENT_REVERSE = \(eventCode\) => `\/api\/admin\/economy\/events\/\$\{encodeURIComponent\(eventCode\)\}\/reverse`/);
  assert.match(js, /INVENTORY_EVENT_CREATE = \(identityCode\) => `\/api\/admin\/inventory\/identities\/\$\{encodeURIComponent\(identityCode\)\}\/events`/);
  assert.match(js, /INVENTORY_EVENT_REVERSE = \(eventCode\) => `\/api\/admin\/inventory\/events\/\$\{encodeURIComponent\(eventCode\)\}\/reverse`/);
  assert.match(js, /ITEM_DEFINITIONS = "\/api\/admin\/inventory\/items"/);
  assert.match(js, /ECONOMY_SETTINGS = "\/api\/admin\/economy\/settings"/);
  assert.match(js, /ECONOMY_DENOMINATIONS = "\/api\/admin\/economy\/denominations"/);
  assert.match(js, /PUBLIC_GAME_BACKUP = "\/api\/admin\/public-game-authority\/backup"/);
  assert.match(js, /PUBLIC_GAME_RESET = "\/api\/admin\/public-game-authority\/reset"/);
  assert.match(js, /currency_unit_label:\s*"Credit"/);
  assert.match(js, /currency_symbol_path:\s*"assets\/games\/currencyunit\.svg"/);
  assert.match(js, /function identityUserCode/);
  assert.match(js, /identity\.user_code \|\|[\s\S]*identity\.canonical_user_code \|\|[\s\S]*identity\.account_user_code/);
  assert.match(js, /Manual economy actions require a reason/);
  assert.match(js, /Economy reversal requires an event code and reason/);
  assert.match(js, /Manual inventory actions require a reason/);
  assert.match(js, /Inventory reversal requires an event code and reason/);
  assert.match(js, /Item definition metadata changes require a reason/);
  assert.match(js, /New item definitions require a reason/);
  assert.match(js, /Reset requires the exact confirmation phrase and a reason/);
  assert.match(js, /Economy settings changes require a reason/);
  assert.match(js, /activeFieldValue\("#economy-actions \.ss-economy-action-grid", "#economy-action-reason"\)/);
  assert.match(js, /body: JSON\.stringify\(\{ event_type: eventType, amount_delta: amount, reason_text: reason \}\)/);
  assert.match(js, /activeFieldValue\("#economy-inventory-actions \.ss-economy-action-grid", "#inventory-action-reason"\)/);
  assert.match(js, /body: JSON\.stringify\(\{ event_type: eventType, item_code: itemCode, quantity_delta: quantity, reason_text: reason \}\)/);
  assert.match(js, /activeFieldValue\("#economy-exchange-actions \.ss-economy-exchange-grid", "#economy-exchange-reason"\)/);
  assert.match(js, /body: JSON\.stringify\(\{ identity_code: state\.selectedIdentityCode, item_code: itemCode, quantity, reason_text: reason \}\)/);
  assert.match(js, /activeFieldValue\("#economy-actions \.ss-economy-reversal-box", "#economy-reversal-reason"\)/);
  assert.match(js, /body: JSON\.stringify\(\{ reason_text: reason \}\)/);
  assert.match(js, /activeFieldValue\("#economy-inventory-actions \.ss-economy-reversal-box", "#inventory-reversal-reason"\)/);
  assert.match(js, /IDENTITY_PAGE_SIZE = 10/);
  assert.match(js, /EVENT_PAGE_SIZE = 8/);
  assert.match(js, /DEFAULT_ITEM_PAGE_SIZE = 20/);
  assert.match(js, /ITEM_PAGE_SIZE_OPTIONS = \[5, 10, 20, 50, 100\]/);
  assert.match(js, /itemPageSize: DEFAULT_ITEM_PAGE_SIZE/);
  assert.match(js, /data-economy-page/);
  assert.match(js, /ss-economy-item-editor/);
  assert.match(js, /renderDenominationBreakdown\(wallet\)/);
  assert.match(js, /wallet\.balance_total_credits \?\? wallet\.balance_current/);
  assert.match(js, /wallet\.cash_balance_credits \?\? wallet\.balance_current/);
  assert.match(js, /wallet\.held_value_credits \?\? 0/);
  assert.match(js, /category: readField\("category"\)/);
  assert.match(js, /categoryPresets/);
  assert.match(js, /rarityPresets/);
  assert.match(js, /function presetOptions/);
  assert.match(js, /GAME_ASSETS = "\/api\/admin\/economy\/assets\/games"/);
  assert.match(js, /GAME_ASSET_DEFINITIONS = "\/api\/admin\/economy\/assets\/games\/definitions"/);
  assert.match(js, /GAME_ASSET_UPLOAD = "\/api\/admin\/economy\/assets\/games\/upload"/);
  assert.match(js, /GAME_ASSET_FILES = "\/assets\/games\/asset-files\.json"/);
  assert.match(js, /GAME_ASSET_CATALOG = "\/assets\/games\/asset-catalog\.json"/);
  assert.match(js, /IMAGE_EXTENSION_PATTERN = \/\\\.\(bmp\|gif\|jpe\?g\|png\|svg\|webp\)/);
  assert.match(js, /function normalizeItemIconPath\(path\)/);
  assert.ok(js.includes('replace(/\\\\/g, "/")'));
  assert.ok(js.includes('replace(/^docs\\\\/i, "")') || js.includes('replace(/^docs\\/+'));
  assert.ok(js.includes('assets\\/games\\/(.+)'));
  assert.match(js, /function renderAssetPicker\(\)/);
  assert.match(js, /function renderAssetSourceTab\(mode, label\)/);
  assert.match(js, /document\.querySelectorAll\("#economy-asset-picker"\)/);
  assert.match(js, /aria-label="Close asset selector"/);
  assert.match(js, /ss-economy-asset-close"[\s\S]*<span aria-hidden="true"><\/span>/);
  assert.match(js, /data-asset-close>Cancel<\/button>/);
  assert.match(js, /event\.key === "Escape" && state\.assetPicker\.open/);
  assert.match(js, /role="tab" aria-selected="\$\{active \? "true" : "false"\}"/);
  assert.match(js, /renderAssetSourceTab\("bundled", "Choose existing asset"\)/);
  assert.match(js, /renderAssetSourceTab\("define", "Define\/upload new asset"\)/);
  assert.match(js, /renderAssetSourceTab\("reconcile", "Reconcile existing files"\)/);
  assert.match(js, /renderAssetSourceTab\("custom", "External URL"\)/);
  assert.match(js, /data-asset-mode="\$\{escapeHtml\(mode\)\}"/);
  assert.match(js, /data-asset-save-definition/);
  assert.match(js, /data-asset-upload/);
  assert.match(js, /data-asset-define-path/);
  assert.match(js, /data-asset-use/);
  assert.match(js, /const canUseAsset = Boolean\(useValue\)/);
  assert.match(js, /function renderItemDefinitionsToolbar\(pageInfo\)/);
  assert.match(js, /id="economy-item-page-size"/);
  assert.match(js, /state\.itemPageSize = ITEM_PAGE_SIZE_OPTIONS\.includes\(nextSize\) \? nextSize : DEFAULT_ITEM_PAGE_SIZE/);
  assert.match(js, /state\.itemPage = 1/);
  assert.match(js, /isLikelyImageUrl/);
  assert.match(js, /function saveAssetDefinitionFromPicker\(\)/);
  assert.match(js, /function uploadAssetFromPicker\(\)/);
  assert.match(js, /Runtime\/Auth asset upload API is unavailable/);
  assert.match(js, /item_code: text\(\$\(("#economy-item-create-code"|'economy-item-create-code')\)/);
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

test("item definition save reads the visible editor reason and sends reason_text", () => {
  const js = read("docs/js/economy.js");

  assert.match(js, /const row = button\.closest\("\.ss-economy-item-definition"\);/);
  assert.match(js, /const readField = \(field\) => text\(row\?\.querySelector\(`\[data-item-field="\$\{field\}"\]`\)\?\.value\);/);
  assert.match(js, /const reason = readField\("reason_text"\);/);
  assert.match(js, /reason_text: reason/);
  assert.match(js, /Category<select data-item-field="category">/);
  assert.match(js, /Rarity<select data-item-field="rarity">/);
  assert.match(js, /icon_path: normalizeItemIconPath\(readField\("icon_path"\)\)/);
  assert.match(js, /icon_path: normalizeItemIconPath\(\$\(("#economy-item-create-icon"|'economy-item-create-icon')\)\?\.value\)/);
  assert.ok(js.includes("ss-economy-asset-browse"));
  assert.match(js, /Browse assets/);
  assert.match(js, /ss-economy-item-create-shell/);
  assert.match(js, /ss-economy-item-create-card--icon/);
  assert.match(js, /No icon configured/);
  assert.match(js, /Preview unavailable/);
  assert.doesNotMatch(js, /button\.closest\("\[data-item-code\]"\)/);
});

test("game asset catalog manifest lists bundled dashboard image assets", () => {
  const fileManifest = JSON.parse(read("docs/assets/games/asset-files.json"));
  const manifest = JSON.parse(read("docs/assets/games/asset-catalog.json"));

  assert.equal(fileManifest.asset_root, "assets/games");
  assert.ok(Array.isArray(fileManifest.items));
  assert.ok(fileManifest.supported_extensions.includes("webp"));
  assert.ok(fileManifest.supported_extensions.includes("gif"));
  assert.ok(fileManifest.supported_extensions.includes("png"));
  assert.ok(fileManifest.supported_extensions.includes("jpg"));
  assert.ok(fileManifest.supported_extensions.includes("jpeg"));
  assert.ok(fileManifest.supported_extensions.includes("bmp"));
  assert.ok(fileManifest.supported_extensions.includes("svg"));
  assert.ok(fileManifest.items.some((item) => item.path === "assets/games/sscoin.webp"));
  assert.ok(fileManifest.items.some((item) => item.path === "assets/games/currencyunit.svg"));
  assert.ok(fileManifest.items.every((item) => item.path.startsWith("assets/games/")));
  assert.ok(fileManifest.items.every((item) => item.filename !== "asset-catalog.json" && item.filename !== "asset-files.json"));
  assert.equal(manifest.asset_root, "assets/games");
  assert.ok(Array.isArray(manifest.items));
  assert.ok(manifest.items.length >= 1);
  assert.ok(manifest.items.some((item) => item.path === "assets/games/sscoin.webp"));
  assert.ok(manifest.items.every((item) => item.path.startsWith("assets/games/")));
  assert.ok(manifest.items.every((item) => item.filename && item.extension && item.label));
});

test("economy settings controls and denomination rendering are wired", () => {
  const js = read("docs/js/economy.js");

  assert.match(js, /function renderEconomySettings\(\)/);
  assert.match(js, /id="economy-setting-label"/);
  assert.match(js, /id="economy-setting-plural"/);
  assert.match(js, /id="economy-setting-symbol"/);
  assert.match(js, /id="economy-setting-reason"/);
  assert.match(js, /body: JSON\.stringify\(\{ settings, reason_text: reason \}\)/);
  assert.match(js, /function renderDenominations\(\)/);
  assert.match(js, /always_show_in_balance \? "Always shown in balance" : "Shown only when nonzero"/);
  assert.match(js, /is_high_value_unit \? "High-value unit" : "Base unit"/);
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
  assert.match(app, /\{ id: "economy-settings-section", label: "Economy Settings" \}/);
  assert.match(app, /\{ id: "economy-denominations-section", label: "Denominations" \}/);
  assert.match(app, /\{ id: "economy-identity-search-section", label: "Identity Search" \}/);
  assert.match(app, /\{ id: "economy-wallet-section", label: "Wallet" \}/);
  assert.match(app, /\{ id: "economy-ledger-section", label: "Economy Ledger" \}/);
  assert.match(app, /\{ id: "economy-actions-section", label: "Manual Economy Actions" \}/);
  assert.match(app, /\{ id: "economy-inventory-section", label: "Inventory" \}/);
  assert.match(app, /\{ id: "economy-inventory-events-section", label: "Inventory Events" \}/);
  assert.match(app, /\{ id: "economy-inventory-actions-section", label: "Manual Inventory Actions" \}/);
  assert.match(app, /\{ id: "economy-exchange-section", label: "Gem \/ Diamond Exchange" \}/);
  assert.match(app, /\{ id: "economy-item-definitions-section", label: "Item Definitions" \}/);
  assert.match(app, /\{ id: "economy-danger-zone-section", label: "Danger Zone" \}/);
  assert.match(app, /data-accounts-shell-anchor="\$\{section\.id\}"/);
  assert.match(app, /scrollToAccountsShellSection\(sectionId\)/);
  assert.match(app, /if \(!resolveSectionShellConfig\(App\.currentView\)\) return;/);
});

test("economy styling includes compact identity rows and currency/denomination treatments", () => {
  const css = read("docs/css/components.css");

  assert.match(css, /\.ss-economy-identity\s*\{[\s\S]*grid-template-columns:\s*38px minmax\(0,\s*1fr\) auto/);
  assert.match(css, /\.ss-economy-avatar img,[\s\S]*\.ss-economy-item-icon img\s*\{[\s\S]*object-fit:\s*cover/);
  assert.match(css, /\.ss-economy-currency-symbol\s*\{[\s\S]*mask:\s*var\(--economy-currency-symbol\) center \/ contain no-repeat/);
  assert.match(css, /\.ss-economy-credit-value--compact \.ss-economy-currency-symbol/);
  assert.match(css, /\.ss-economy-denomination-breakdown\s*\{/);
  assert.match(css, /\.ss-economy-denomination-chip img\s*\{[\s\S]*object-fit:\s*contain/);
  assert.match(css, /\.ss-economy-item-chip\s*\{/);
  assert.match(css, /\.ss-economy-state-reversed,[\s\S]*\.ss-economy-state-reversal/);
  assert.match(css, /\.ss-economy-master-detail\s*\{[\s\S]*grid-template-columns:\s*minmax\(440px,\s*1\.35fr\) minmax\(320px,\s*0\.85fr\)/);
  assert.match(css, /\.ss-economy-item-definition-summary\s*\{[\s\S]*grid-template-columns:\s*38px minmax\(0,\s*1fr\) auto/);
  assert.match(css, /\.ss-economy-item-create-shell\s*\{/);
  assert.match(css, /\.ss-economy-item-create-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(280px,\s*0\.62fr\) minmax\(260px,\s*0\.62fr\)/);
  assert.match(css, /\.ss-economy-item-create-card--icon \.ss-economy-icon-preview\s*\{[\s\S]*min-height:\s*92px/);
  assert.match(css, /\.ss-economy-item-list-toolbar\s*\{/);
  assert.match(css, /\.ss-economy-item-page-size select\s*\{[\s\S]*min-width:\s*82px/);
  assert.match(css, /\.ss-economy-item-editor\s*\{[\s\S]*grid-template-columns:\s*minmax\(210px,\s*0\.74fr\) minmax\(0,\s*1\.26fr\)/);
  assert.match(css, /\.ss-economy-icon-field\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto minmax\(190px,\s*0\.55fr\)/);
  assert.match(css, /\.ss-economy-asset-modal\s*\{/);
  assert.match(css, /\.ss-economy-asset-dialog\s*\{[\s\S]*width:\s*min\(1160px,\s*100%\)/);
  assert.match(css, /\.ss-economy-asset-head\s*\{[\s\S]*grid-row:\s*1/);
  assert.match(css, /\.ss-economy-asset-close span\s*\{[\s\S]*-webkit-mask-image:\s*url\("\/assets\/icons\/ui\/cross\.svg"\)/);
  assert.match(css, /\.ss-economy-asset-close:hover,[\s\S]*\.ss-economy-asset-close:focus-visible/);
  assert.match(css, /\.ss-economy-asset-close:focus-visible\s*\{[\s\S]*box-shadow:\s*0 0 0 3px/);
  assert.match(css, /\.ss-economy-asset-tab\s*\{/);
  assert.match(css, /\.ss-economy-asset-tab\.is-active,[\s\S]*\.ss-economy-asset-tab\[aria-selected="true"\]/);
  assert.match(css, /\.ss-economy-asset-search,[\s\S]*\.ss-economy-asset-custom\s*\{[\s\S]*grid-row:\s*3/);
  assert.match(css, /\.ss-economy-asset-grid\s*\{[\s\S]*grid-column:\s*1 \/ 2/);
  assert.match(css, /\.ss-economy-asset-grid\s*\{[\s\S]*grid-row:\s*4/);
  assert.match(css, /\.ss-economy-asset-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(168px,\s*1fr\)\)/);
  assert.match(css, /\.ss-economy-asset-preview\s*\{[\s\S]*grid-column:\s*2 \/ 3/);
  assert.match(css, /\.ss-economy-asset-preview\s*\{[\s\S]*position:\s*sticky/);
  assert.match(css, /\.ss-economy-asset-thumb\.is-unavailable::after\s*\{[\s\S]*Preview unavailable/);
  assert.match(css, /\.ss-economy-asset-tile\.is-selected/);
  assert.match(css, /\.ss-economy-icon-preview-placeholder/);
  assert.match(css, /\.ss-economy-exchange-grid\s*\{/);
  assert.match(css, /\.ss-admin-pager\s*\{/);
});

test("economy exchange controls preview held gem and diamond values", () => {
  const js = read("docs/js/economy.js");
  const css = read("docs/css/components.css");

  assert.match(js, /function renderExchangeActions\(\)/);
  assert.match(js, /state\.detail\?\.exchangeable_items/);
  assert.match(js, /No exchangeable held gems or diamonds/);
  assert.match(js, /Gems and diamonds cannot be purchased here/);
  assert.match(js, /id="economy-exchange-item"/);
  assert.match(js, /id="economy-exchange-quantity"/);
  assert.match(js, /id="economy-exchange-value"/);
  assert.match(js, /id="economy-exchange-reason"/);
  assert.match(js, /function syncExchangePreview\(\)/);
  assert.match(js, /quantity \* Number\(item\.value_in_credits \|\| 0\)/);
  assert.match(js, /await requestJson\(ECONOMY_EXCHANGE\(state\.selectedIdentityCode\)/);
  assert.match(css, /\.ss-economy-exchange-preview/);
});

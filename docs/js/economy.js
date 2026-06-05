/* ============================================================
   StreamSuites Dashboard - Economy / Inventory admin controls
   ============================================================ */

(() => {
  "use strict";

  const IDENTITIES = "/api/admin/economy/identities";
  const ECONOMY_DETAIL = (identityCode) => `/api/admin/economy/identities/${encodeURIComponent(identityCode)}`;
  const PUBLIC_IDENTITY_UNASSIGN = "/api/admin/public-identities/reconciliation/unassign";
  const ECONOMY_EVENTS = (identityCode) => `/api/admin/economy/identities/${encodeURIComponent(identityCode)}/events`;
  const ECONOMY_EXCHANGE = (identityCode) => `/api/admin/economy/identities/${encodeURIComponent(identityCode)}/exchange`;
  const ECONOMY_EVENT_REVERSE = (eventCode) => `/api/admin/economy/events/${encodeURIComponent(eventCode)}/reverse`;
  const INVENTORY_EVENTS = (identityCode) => `/api/admin/inventory/identities/${encodeURIComponent(identityCode)}/events`;
  const INVENTORY_EVENT_CREATE = (identityCode) => `/api/admin/inventory/identities/${encodeURIComponent(identityCode)}/events`;
  const INVENTORY_EVENT_REVERSE = (eventCode) => `/api/admin/inventory/events/${encodeURIComponent(eventCode)}/reverse`;
  const ITEM_DEFINITIONS = "/api/admin/inventory/items";
  const ITEM_DEFINITION = (itemCode) => `/api/admin/inventory/items/${encodeURIComponent(itemCode)}`;
  const MARKET_GOVERNANCE = "/api/admin/economy/market";
  const MARKET_GOVERNANCE_ITEM = (itemCode) => `/api/admin/economy/market/items/${encodeURIComponent(itemCode)}`;
  const CATEGORY_LABEL_OVERRIDES = {
    armor: "Armor",
    combat_vehicle: "Combat Vehicles",
    fish_treasure: "Fish & Treasures",
    platform_badge: "Platform Badges",
    weapon: "Weapons",
    weapons: "Weapons"
  };
  const PARTICIPATION_EXCLUSIONS = "/api/admin/exclusions";
  const PARTICIPATION_EXCLUSIONS_SUMMARY = "/api/admin/exclusions/summary";
  const PARTICIPATION_EXCLUSION_TARGET_SEARCH = "/api/admin/exclusions/targets/search";
  const PARTICIPATION_EXCLUSION_TARGET = (targetType, targetId) => `/api/admin/exclusions/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`;
  const ECONOMY_SETTINGS = "/api/admin/economy/settings";
  const ECONOMY_DENOMINATIONS = "/api/admin/economy/denominations";
  const ECONOMY_DENOMINATION = (denominationCode) => `/api/admin/economy/denominations/${encodeURIComponent(denominationCode)}`;
  const PUBLIC_GAME_BACKUP = "/api/admin/public-game-authority/backup";
  const PUBLIC_GAME_RESET = "/api/admin/public-game-authority/reset";
  const GAME_ASSETS = "/api/admin/economy/assets/games";
  const GAME_ASSET_DEFINITIONS = "/api/admin/economy/assets/games/definitions";
  const GAME_ASSET_DEFINITION = (assetPathValue) => `/api/admin/economy/assets/games/definitions/${encodeURIComponent(assetPathValue)}`;
  const GAME_ASSET_UPLOAD = "/api/admin/economy/assets/games/upload";
  const GAME_ASSET_FILES = "/assets/games/asset-files.json";
  const GAME_ASSET_CATALOG = "/assets/games/asset-catalog.json";
  const IMAGE_EXTENSION_PATTERN = /\.(bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;
  const IDENTITY_PAGE_SIZE = 10;
  const IDENTITY_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
  const EVENT_PAGE_SIZE = 8;
  const DEFAULT_ITEM_PAGE_SIZE = 20;
  const ITEM_PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];
  const ITEM_CREATE_EDITOR_CODE = "__create_item_definition__";
  const EXCLUSION_SCOPE_DEFS = Object.freeze([
    ["all_bot_replies", "Block all bot replies"],
    ["all_counters", "Block all counters"],
    ["xp_progression", "Block XP / progression"],
    ["wallet_economy", "Block wallet / economy"],
    ["market_exchange", "Block market / exchange"],
    ["clips", "Block clips"],
    ["clipping", "Block clipping"],
    ["polls", "Block polls"],
    ["wheels", "Block wheels"],
    ["tallies", "Block tallies"],
    ["games", "Block games"],
    ["leaderboards", "Block leaderboards"],
    ["livechat", "Block livechat module"]
  ]);

  const state = {
    identities: [],
    selectedIdentityCode: "",
    detail: null,
    itemDefinitions: [],
    itemCategories: [],
    categoryPresets: [],
    rarityPresets: [],
    economySettings: {
      currency_unit_label: "Credit",
      currency_unit_plural_label: "Credits",
      currency_symbol_path: "assets/games/currencyunit.svg"
    },
    denominations: [],
    identityPage: 1,
    identityPageSize: IDENTITY_PAGE_SIZE,
    inventorySearch: "",
    inventoryViewMode: "cards",
    manualInventorySearch: "",
    manualInventorySuggestionsOpen: false,
    manualInventoryHighlightedIndex: 0,
    economyEventPage: 1,
    inventoryEventPage: 1,
    auditDrawer: "",
    identitySelectorOpen: false,
    itemPage: 1,
    itemPageSize: DEFAULT_ITEM_PAGE_SIZE,
    itemSearch: "",
    itemViewMode: "cards",
    itemEditorCode: "",
    bulkEditor: {
      type: "",
      search: "",
      selected: [],
      drafts: {},
      dirty: {},
      errors: {},
      results: {},
      reason: "",
      applying: false
    },
    marketItems: [],
    marketEditorCode: "",
    marketSearch: "",
    marketViewMode: "cards",
    marketPage: 1,
    marketPageSize: DEFAULT_ITEM_PAGE_SIZE,
    marketFilters: {
      purchasable: false,
      exchangeable: false,
      disabled: false
    },
    participationExclusions: {
      policies: [],
      policySearch: "",
      allowedScopes: EXCLUSION_SCOPE_DEFS.map(([scope]) => scope),
      targetType: "public_identity",
      targetId: "",
      searchQuery: "",
      searchResults: [],
      searchLoading: false,
      searchError: "",
      searchTimer: null,
      searchToken: 0,
      selectedTarget: null,
      current: null,
      effective: null,
      reason: "",
      loading: false,
      saving: false,
      policyModalOpen: false,
      error: ""
    },
    denominationEditorCode: "",
    denominationErrors: {},
    itemEditorSection: "details",
    itemEditorDrafts: {},
    assetCatalog: [],
    assetFiles: [],
    unresolvedAssets: [],
    assetWritable: false,
    assetWritableMessage: "",
    supportedAssetExtensions: ["webp", "gif", "png", "jpg", "jpeg", "bmp", "svg"],
    assetUploadPreviewUrl: "",
    assetCatalogLoaded: false,
    assetCatalogError: "",
    assetPicker: {
      open: false,
      target: "",
      selectedPath: "",
      filter: "",
      mode: "bundled",
      customUrl: "",
      definition: {},
      editingPath: "",
      errors: {},
      uploadFile: null,
      uploadError: ""
    },
    itemCreateErrors: {},
    token: 0,
    saving: false,
    bound: false
  };

  const el = {};

  function $(id) {
    const value = String(id || "");
    return document.getElementById(value.startsWith("#") ? value.slice(1) : value);
  }

  function text(value) {
    return value === undefined || value === null ? "" : String(value).trim();
  }

  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function apiBase() {
    const base =
      window.StreamSuitesAdminAuth?.config?.baseUrl ||
      document.querySelector('meta[name="streamsuites-auth-base"]')?.getAttribute("content") ||
      "";
    return base ? String(base).replace(/\/+$/, "") : "";
  }

  function apiUrl(path) {
    if (/^https?:\/\//i.test(String(path || ""))) return path;
    const base = apiBase();
    return base ? `${base}${path.startsWith("/") ? path : `/${path}`}` : path;
  }

  async function requestJson(path, options = {}) {
    const response = await fetch(apiUrl(path), {
      cache: "no-store",
      credentials: "include",
      method: "GET",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
      err.payload = payload;
      err.fieldErrors = payload?.field_errors || payload?.fieldErrors || [];
      throw err;
    }
    return payload;
  }

  function fieldErrorMap(err) {
    const list = Array.isArray(err?.fieldErrors) ? err.fieldErrors : [];
    return list.reduce((acc, item) => {
      if (item?.field) acc[item.field] = item.message || item.code || "Invalid value.";
      return acc;
    }, {});
  }

  function fieldErrorText(errors, field) {
    return text(errors?.[field] || "");
  }

  function setStatus(message, tone = "info") {
    if (el.status) el.status.textContent = message || "";
    if (message && tone !== "info") {
      const notify = tone === "error" ? "error" : tone === "success" ? "success" : "warning";
      window.StreamSuitesToast?.[notify]?.(message, { key: "economy-admin", title: "Economy" });
    }
  }

  function formatNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number.toLocaleString() : "0";
  }

  function formatCompactNumber(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return "0";
    const sign = number < 0 ? "-" : "";
    const absolute = Math.abs(number);
    const units = [
      { suffix: "T", value: 1_000_000_000_000 },
      { suffix: "B", value: 1_000_000_000 },
      { suffix: "M", value: 1_000_000 },
      { suffix: "K", value: 1_000 },
    ];
    const unit = units.find((item) => absolute >= item.value);
    if (!unit) return formatNumber(number);
    const compact = absolute / unit.value;
    return `${sign}${compact.toFixed(1).replace(/\.0$/, "")}${unit.suffix}`;
  }

  function formatLabel(value) {
    return text(value).replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function slugCode(value) {
    return text(value)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function itemCategoryOptions(selected = "") {
    const categories = Array.isArray(state.itemCategories) && state.itemCategories.length
      ? state.itemCategories
      : state.categoryPresets.map((label) => ({
          code: slugCode(label),
          label,
          default_item_code_prefix: slugCode(label)
        }));
    const selectedValue = text(selected);
    const normalizedCategories = [];
    const seenLabels = new Set();
    categories.forEach((category) => {
      const value = text(category.code || category.id || category.label);
      const label = text(category.label || category.code || value);
      const normalizedLabel = slugCode(CATEGORY_LABEL_OVERRIDES[slugCode(value)] || label);
      const normalizedValue = slugCode(value);
      const key = normalizedLabel || normalizedValue;
      if (!value || !key || seenLabels.has(key)) return;
      if (normalizedValue === "weapon" && categories.some((candidate) => slugCode(candidate.code || candidate.id || candidate.label) === "weapons")) return;
      seenLabels.add(key);
      normalizedCategories.push(category);
    });
    const options = normalizedCategories
      .map((category) => {
        const value = text(category.code || category.id || category.label);
        const label = text(category.label || category.code || value);
        const description = text(category.description);
        return `<option value="${escapeHtml(value)}" ${value === selectedValue || label === selectedValue ? "selected" : ""} title="${escapeHtml(description)}">${escapeHtml(label)}</option>`;
      })
      .join("");
    if (!selectedValue || normalizedCategories.some((category) => text(category.code || category.label) === selectedValue || text(category.label) === selectedValue)) return options;
    return `${options}<option value="${escapeHtml(selectedValue)}" selected>${escapeHtml(CATEGORY_LABEL_OVERRIDES[selectedValue] || formatLabel(selectedValue))}</option>`;
  }

  function categoryDisplayLabel(value = "", fallback = "") {
    const raw = text(value || fallback);
    if (!raw) return "Uncategorized";
    const normalized = slugCode(raw);
    const option = (state.itemCategories || []).find((category) => {
      const code = slugCode(category.code || category.id || category.label);
      const label = slugCode(category.label || category.code || "");
      return normalized && (normalized === code || normalized === label);
    });
    return text(option?.label) || CATEGORY_LABEL_OVERRIDES[normalized] || formatLabel(raw);
  }

  function selectedItemCategory() {
    const selected = text($("#economy-item-create-category")?.value);
    return (state.itemCategories || []).find((category) => text(category.code || category.label) === selected || text(category.label) === selected) || null;
  }

  function generatedItemCode(categoryValue = text($("#economy-item-create-category")?.value), nameValue = text($("#economy-item-create-label")?.value)) {
    const category = (state.itemCategories || []).find((item) => text(item.code || item.label) === categoryValue || text(item.label) === categoryValue) || {};
    const prefix = slugCode(category.default_item_code_prefix || category.code || category.label || categoryValue);
    const nameSlug = slugCode(nameValue);
    return prefix && nameSlug ? `${prefix}.${nameSlug}` : "";
  }

  function categoryCodePrefix(categoryValue = "") {
    const category = (state.itemCategories || []).find((item) => text(item.code || item.label) === text(categoryValue) || text(item.label) === text(categoryValue)) || {};
    return slugCode(category.default_item_code_prefix || category.code || category.label || categoryValue);
  }

  function itemCodeSuffix(itemCode = "") {
    const raw = text(itemCode);
    return raw.includes(".") ? raw.split(".").slice(1).join(".") : raw;
  }

  function generatedEditorItemCode(row) {
    const category = text(row?.querySelector('[data-item-field="category"]')?.value);
    const suffix = slugCode(row?.querySelector('[data-item-field="item_code_suffix"]')?.value);
    const prefix = categoryCodePrefix(category);
    return prefix && suffix ? `${prefix}.${suffix}` : "";
  }

  function syncItemEditorCodePreview(row) {
    if (!row) return;
    const category = text(row.querySelector('[data-item-field="category"]')?.value);
    const prefix = categoryCodePrefix(category);
    const suffixInput = row.querySelector('[data-item-field="item_code_suffix"]');
    const prefixNode = row.querySelector("[data-item-code-prefix]");
    const previewNode = row.querySelector("[data-item-code-preview]");
    const statusNode = row.querySelector("[data-item-code-status]");
    const suffix = slugCode(suffixInput?.value);
    if (suffixInput && suffixInput.value !== suffix) suffixInput.value = suffix;
    const nextCode = prefix && suffix ? `${prefix}.${suffix}` : "";
    const currentCode = text(row.dataset.itemCode);
    const duplicate = nextCode && nextCode !== currentCode && state.itemDefinitions.some((item) => text(item.item_code) === nextCode);
    if (prefixNode) prefixNode.textContent = prefix || "category";
    if (previewNode) previewNode.textContent = nextCode || "Choose a category and suffix.";
    if (statusNode) {
      statusNode.textContent = duplicate
        ? "Duplicate item code. Choose another suffix before saving."
        : nextCode && nextCode !== currentCode
          ? "Preview only: existing item-code renames are blocked until Runtime/Auth can migrate references."
          : "Current item code remains unchanged.";
      statusNode.className = `muted ss-economy-item-code-status${duplicate ? " is-error" : nextCode ? " is-ok" : ""}`;
    }
  }

  function generatedItemCodeState() {
    const label = text($("#economy-item-create-label")?.value);
    const category = text($("#economy-item-create-category")?.value);
    const itemCode = generatedItemCode(category, label);
    const collision = itemCode && state.itemDefinitions.some((item) => text(item.item_code) === itemCode);
    return { label, category, itemCode, collision };
  }

  function generatedItemCodeDraftState(draft = createItemEditorDraft()) {
    const label = text(draft.label);
    const category = text(draft.category);
    const itemCode = generatedItemCode(category, label);
    const collision = itemCode && state.itemDefinitions.some((item) => text(item.item_code) === itemCode);
    return { label, category, itemCode, collision };
  }

  function itemEditorSteps() {
    return ["details", "assets", "copy", "admin"];
  }

  function itemEditorStepIndex() {
    const steps = itemEditorSteps();
    return Math.max(0, steps.indexOf(state.itemEditorSection));
  }

  function normalizeChatAlias(value) {
    return text(value).toLowerCase();
  }

  function chatAliasLooksValid(value) {
    const alias = normalizeChatAlias(value);
    return !alias || /^[a-z0-9][a-z0-9_-]{0,63}$/.test(alias);
  }

  function syncGeneratedItemCodePreview() {
    const input = $("#economy-item-create-code");
    const preview = $("#economy-item-code-preview");
    const status = $("#economy-item-code-status");
    const draft = createItemEditorDraft();
    const mountedState = generatedItemCodeState();
    const draftState = generatedItemCodeDraftState(draft);
    const label = mountedState.label || draftState.label;
    const category = mountedState.category || draftState.category;
    const itemCode = mountedState.itemCode || draftState.itemCode;
    const collision = Boolean(mountedState.collision || draftState.collision);
    if (input) input.value = itemCode;
    if (preview) preview.textContent = itemCode || "Select a category and enter an item name.";
    if (status) {
      status.textContent = !category || !label
        ? "Waiting for category and item name."
        : collision
          ? "Collision: this generated item code already exists."
          : "Generated by Runtime/Auth-compatible category and name normalization.";
      status.className = `muted ss-economy-item-code-status${collision ? " is-error" : itemCode ? " is-ok" : ""}`;
    }
    const button = $("#economy-item-create-submit");
    if (button) button.disabled = state.saving || !itemCode || collision || !text($("#economy-item-create-reason")?.value || draft.reason_text);
  }

  function updateItemCreateFieldErrors(errors = state.itemCreateErrors) {
    const fields = ["label", "item_name", "category", "item_code", "rarity", "chat_alias", "short_description", "tooltip_description", "reason_text", "reason"];
    fields.forEach((field) => {
      const target = $(`economy-item-create-error-${field}`);
      if (target) target.textContent = fieldErrorText(errors, field);
    });
    const labelTarget = $("economy-item-create-error-label");
    if (labelTarget && !labelTarget.textContent) labelTarget.textContent = fieldErrorText(errors, "item_name");
    const reasonTarget = $("economy-item-create-error-reason_text");
    if (reasonTarget && !reasonTarget.textContent) reasonTarget.textContent = fieldErrorText(errors, "reason");
  }

  function normalizeItemIconPath(path) {
    const value = text(path);
    if (!value) return "";
    if (/^(https?:\/\/|blob:|data:image\/)/i.test(value)) return value;
    const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
    const publicPath = normalized.replace(/^docs\/+/i, "");
    const gameAssetMatch = publicPath.match(/(?:^|\/)assets\/games\/(.+)$/i);
    if (gameAssetMatch) {
      const cleanParts = gameAssetMatch[1].split(/[?#]/, 1)[0].split("/").filter((part) => part && part !== "." && part !== "..");
      return cleanParts.length ? `assets/games/${cleanParts.join("/")}` : "";
    }
    return publicPath;
  }

  function assetPath(path) {
    const value = normalizeItemIconPath(path);
    if (!value) return "";
    return value.startsWith("/") || /^(https?:\/\/|blob:|data:image\/)/i.test(value) ? value : `/${value.replace(/^\/+/, "")}`;
  }

  function isLikelyImageUrl(path) {
    const value = text(path);
    return /^https?:\/\//i.test(value) && IMAGE_EXTENSION_PATTERN.test(value);
  }

  function isSupportedAssetPath(path) {
    const value = normalizeItemIconPath(path);
    return IMAGE_EXTENSION_PATTERN.test(value);
  }

  function assetPreviewLabel(path) {
    const value = normalizeItemIconPath(path);
    if (!value) return "No icon configured";
    if (/^https?:\/\//i.test(value) && !isLikelyImageUrl(value)) return "Preview unavailable: external URL should end with an image file extension.";
    return "";
  }

  function currencyPluralLabel(value = 0) {
    const singular = text(state.economySettings.currency_unit_label) || "Credit";
    const plural = text(state.economySettings.currency_unit_plural_label) || `${singular}s`;
    return Math.abs(Number(value || 0)) === 1 ? singular : plural;
  }

  function clampPage(page, totalItems, pageSize) {
    const max = Math.max(1, Math.ceil((totalItems || 0) / pageSize));
    return Math.min(Math.max(1, Number(page) || 1), max);
  }

  function pageSlice(items, page, pageSize) {
    const list = Array.isArray(items) ? items : [];
    const current = clampPage(page, list.length, pageSize);
    return {
      page: current,
      totalPages: Math.max(1, Math.ceil(list.length / pageSize)),
      totalItems: list.length,
      items: list.slice((current - 1) * pageSize, current * pageSize)
    };
  }

  function renderPager(kind, pageInfo, label) {
    if (!pageInfo || pageInfo.totalPages <= 1) return "";
    return `
      <div class="ss-admin-pager" data-pager-kind="${escapeHtml(kind)}">
        <span class="muted">${escapeHtml(label)} ${formatNumber(pageInfo.page)} of ${formatNumber(pageInfo.totalPages)} · ${formatNumber(pageInfo.totalItems)} total</span>
        <div class="pager-controls">
          <button class="ss-btn ss-btn-secondary" type="button" data-economy-page="${escapeHtml(kind)}" data-page="${pageInfo.page - 1}" ${pageInfo.page <= 1 ? "disabled" : ""}>Previous</button>
          <button class="ss-btn ss-btn-secondary" type="button" data-economy-page="${escapeHtml(kind)}" data-page="${pageInfo.page + 1}" ${pageInfo.page >= pageInfo.totalPages ? "disabled" : ""}>Next</button>
        </div>
      </div>
    `;
  }

  function itemPageSizeOptions() {
    return ITEM_PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${state.itemPageSize === size ? "selected" : ""}>${size}</option>`).join("");
  }

  function marketPageSizeOptions() {
    return ITEM_PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${state.marketPageSize === size ? "selected" : ""}>${size}</option>`).join("");
  }

  function identityPageSizeOptions() {
    return IDENTITY_PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${state.identityPageSize === size ? "selected" : ""}>${size}</option>`).join("");
  }

  function resetBulkEditor(type = "") {
    state.bulkEditor = {
      type,
      search: "",
      selected: [],
      drafts: {},
      dirty: {},
      errors: {},
      results: {},
      reason: "",
      applying: false
    };
  }

  function openBulkEditor(type) {
    resetBulkEditor(type);
    renderAll();
  }

  function closeBulkEditor() {
    resetBulkEditor("");
    renderAll();
  }

  function bulkSourceItems() {
    return state.bulkEditor.type === "market"
      ? (Array.isArray(state.marketItems) ? state.marketItems : [])
      : (Array.isArray(state.itemDefinitions) ? state.itemDefinitions : []);
  }

  function bulkItemKey(item = {}) {
    return text(item.item_code);
  }

  function bulkDraftFor(item = {}) {
    const key = bulkItemKey(item);
    if (state.bulkEditor.drafts[key]) return state.bulkEditor.drafts[key];
    if (state.bulkEditor.type === "market") {
      return {
        item_type: marketItemType(item),
        market_enabled: marketEnabled(item) ? "true" : "false",
        market_price_stekels: String(marketPrice(item)),
        exchange_enabled: exchangeEnabled(item) ? "true" : "false",
        exchange_value_stekels: String(exchangeValue(item)),
        unlimited_stock: item.unlimited_stock ? "true" : "false",
        stock: item.stock ?? "",
        stock_limit: item.stock_limit ?? item.max_quantity ?? "",
        market_label: text(item.market_label || item.short_label || item.label),
        short_label: text(item.short_label || item.market_label || "")
      };
    }
    const model = itemDefinitionViewModel(item);
    return {
      label: text(item.label || item.item_name || item.item_code),
      category: text(item.category || model.categoryRaw || ""),
      rarity: text(item.rarity || ""),
      is_enabled: item.is_enabled === false ? "false" : "true",
      public_tooltip_enabled: item.public_tooltip_enabled === false ? "false" : "true",
      chat_alias: model.chatAlias || "",
      icon_path: model.normalizedIcon || "",
      short_description: text(item.short_description || item.short_public_description || item.metadata?.short_description || ""),
      tooltip_description: text(item.tooltip_description || item.tooltip_public_description || item.metadata?.tooltip_description || ""),
      contextual_public_note: text(item.contextual_public_note || item.contextual_note || item.metadata?.contextual_public_note || ""),
      metadata_notes: text(item.metadata?.notes || item.notes || "")
    };
  }

  function filteredBulkItems() {
    const query = text(state.bulkEditor.search).toLowerCase();
    return bulkSourceItems().filter((item) => {
      if (!query) return true;
      const model = state.bulkEditor.type === "market" ? null : itemDefinitionViewModel(item);
      const haystack = [
        item.item_code,
        item.label,
        item.display_name,
        item.market_label,
        item.short_label,
        item.category,
        item.category_label,
        item.rarity,
        item.item_type,
        model?.chatAlias
      ].map((value) => text(value).toLowerCase()).join(" ");
      return haystack.includes(query);
    });
  }

  function bulkSelectionSet() {
    return new Set(state.bulkEditor.selected.map(text).filter(Boolean));
  }

  function updateBulkDraft(row) {
    const key = text(row?.dataset?.bulkItemCode);
    if (!key) return;
    const draft = { ...bulkDraftFor({ item_code: key }) };
    row.querySelectorAll("[data-bulk-field]").forEach((input) => {
      draft[input.dataset.bulkField] = input.value;
    });
    state.bulkEditor.drafts[key] = draft;
    state.bulkEditor.dirty[key] = true;
  }

  function readBulkNumber(draft, field) {
    const raw = text(draft[field]);
    if (raw === "") return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be a non-negative number.`);
    return value;
  }

  function validateBulkItem(key, draft) {
    if (state.bulkEditor.type === "market") {
      readBulkNumber(draft, "market_price_stekels");
      readBulkNumber(draft, "exchange_value_stekels");
      readBulkNumber(draft, "stock");
      readBulkNumber(draft, "stock_limit");
      return "";
    }
    const alias = normalizeChatAlias(draft.chat_alias);
    if (!chatAliasLooksValid(alias)) return "Chat alias must use letters, numbers, hyphens, or underscores with no spaces.";
    if (!text(draft.label)) return "Item name is required.";
    return "";
  }

  function renderBulkResult(key) {
    const result = state.bulkEditor.results[key];
    const error = state.bulkEditor.errors[key];
    if (result === "success") return `<span class="ss-economy-bulk-state is-success">Saved</span>`;
    if (error) return `<span class="ss-economy-bulk-state is-error">${escapeHtml(error)}</span>`;
    if (state.bulkEditor.dirty[key]) return `<span class="ss-economy-bulk-state is-dirty">Dirty</span>`;
    return `<span class="muted">Clean</span>`;
  }

  function renderMarketBulkCells(item, draft) {
    return `
      <td><select data-bulk-field="market_enabled"><option value="true" ${draft.market_enabled === "true" ? "selected" : ""}>On sale</option><option value="false" ${draft.market_enabled === "true" ? "" : "selected"}>Off sale</option></select></td>
      <td><input data-bulk-field="market_price_stekels" type="number" min="0" step="1" value="${escapeHtml(draft.market_price_stekels)}" /></td>
      <td><select data-bulk-field="exchange_enabled"><option value="true" ${draft.exchange_enabled === "true" ? "selected" : ""}>Exchangeable</option><option value="false" ${draft.exchange_enabled === "true" ? "" : "selected"}>No exchange</option></select></td>
      <td><input data-bulk-field="exchange_value_stekels" type="number" min="0" step="1" value="${escapeHtml(draft.exchange_value_stekels)}" /></td>
      <td><select data-bulk-field="item_type">${itemCategoryOptions(draft.item_type)}</select></td>
      <td><input data-bulk-field="stock" type="number" min="0" step="1" value="${escapeHtml(draft.stock)}" placeholder="blank" /></td>
      <td><input data-bulk-field="stock_limit" type="number" min="0" step="1" value="${escapeHtml(draft.stock_limit)}" placeholder="blank" /></td>
      <td><select data-bulk-field="unlimited_stock"><option value="true" ${draft.unlimited_stock === "true" ? "selected" : ""}>Unlimited</option><option value="false" ${draft.unlimited_stock === "true" ? "" : "selected"}>Track</option></select></td>
      <td><input data-bulk-field="market_label" value="${escapeHtml(draft.market_label)}" /></td>
      <td><input data-bulk-field="short_label" value="${escapeHtml(draft.short_label)}" /></td>
    `;
  }

  function renderInventoryBulkCells(item, draft) {
    return `
      <td><input data-bulk-field="label" value="${escapeHtml(draft.label)}" /></td>
      <td><select data-bulk-field="category">${itemCategoryOptions(draft.category)}</select></td>
      <td><select data-bulk-field="rarity">${presetOptions(state.rarityPresets, draft.rarity)}</select></td>
      <td><select data-bulk-field="is_enabled"><option value="true" ${draft.is_enabled === "false" ? "" : "selected"}>Enabled</option><option value="false" ${draft.is_enabled === "false" ? "selected" : ""}>Disabled</option></select></td>
      <td><select data-bulk-field="public_tooltip_enabled"><option value="true" ${draft.public_tooltip_enabled === "false" ? "" : "selected"}>Tooltip on</option><option value="false" ${draft.public_tooltip_enabled === "false" ? "selected" : ""}>Tooltip off</option></select></td>
      <td><input data-bulk-field="chat_alias" value="${escapeHtml(draft.chat_alias)}" /></td>
      <td><input data-bulk-field="icon_path" value="${escapeHtml(draft.icon_path)}" /></td>
      <td><textarea data-bulk-field="short_description" rows="2">${escapeHtml(draft.short_description)}</textarea></td>
      <td><textarea data-bulk-field="tooltip_description" rows="2">${escapeHtml(draft.tooltip_description)}</textarea></td>
      <td><textarea data-bulk-field="contextual_public_note" rows="2">${escapeHtml(draft.contextual_public_note)}</textarea></td>
      <td><textarea data-bulk-field="metadata_notes" rows="2">${escapeHtml(draft.metadata_notes)}</textarea></td>
    `;
  }

  function renderBulkEditorModal() {
    const type = state.bulkEditor.type;
    if (!type) return "";
    const title = type === "market" ? "Bulk Edit Market Items" : "Bulk Edit Inventory Items";
    const rows = filteredBulkItems();
    const selection = bulkSelectionSet();
    const selectedDirtyCount = state.bulkEditor.selected.filter((key) => state.bulkEditor.dirty[key]).length;
    const dirtyTotal = Object.keys(state.bulkEditor.dirty || {}).length;
    const subtitle = type === "market"
      ? "Edit sale status, pricing, exchange values, stock, and market labels for selected Runtime/Auth item definitions."
      : "Edit item labels, category metadata, public copy, icons, tooltip controls, and admin notes for selected inventory definitions.";
    const header = type === "market"
      ? `<th>Sale</th><th>Price</th><th>Exchange</th><th>Value</th><th>Type/category</th><th>Stock</th><th>Limit</th><th>Availability</th><th>Market label</th><th>Short label</th>`
      : `<th>Name</th><th>Category</th><th>Rarity</th><th>Status</th><th>Tooltip</th><th>Chat alias</th><th>Icon path</th><th>Short description</th><th>Tooltip details</th><th>Public note</th><th>Admin notes</th>`;
    return `
      <div class="ss-economy-item-editor-modal ss-economy-bulk-modal" role="dialog" aria-modal="true" aria-labelledby="economy-bulk-editor-title" data-bulk-modal>
        <div class="ss-economy-item-editor-dialog ss-economy-bulk-dialog">
          <header class="ss-economy-bulk-head">
            <div class="ss-economy-bulk-title">
              <span class="ss-subtitle">${type === "market" ? "Market Governance" : "Inventory Definitions"}</span>
              <h3 id="economy-bulk-editor-title">${escapeHtml(title)}</h3>
              <p>${escapeHtml(subtitle)}</p>
              <div class="ss-economy-bulk-chip-row">
                <span>${formatNumber(state.bulkEditor.selected.length)} selected</span>
                <span>${formatNumber(selectedDirtyCount)} dirty selected</span>
                <span>${formatNumber(dirtyTotal)} dirty total</span>
                <span>${formatNumber(rows.length)} visible rows</span>
              </div>
            </div>
            <button class="ss-economy-item-modal-close ss-economy-bulk-close" type="button" aria-label="Close bulk editor" data-bulk-close><span aria-hidden="true"></span></button>
          </header>
          <div class="ss-economy-bulk-toolbar">
            <label>Search/filter<input id="economy-bulk-search" type="search" value="${escapeHtml(state.bulkEditor.search)}" placeholder="Item code, name, category, alias" /></label>
            <label>Shared reason<input id="economy-bulk-reason" value="${escapeHtml(state.bulkEditor.reason)}" placeholder="Required before apply" /></label>
            <div class="ss-inline-actions">
              <button class="ss-btn ss-btn-secondary" type="button" data-bulk-select-visible>Select visible</button>
              <button class="ss-btn ss-btn-secondary" type="button" data-bulk-clear-selection>Clear selection</button>
            </div>
          </div>
          <div class="ss-economy-bulk-table-wrap">
            <table class="ss-economy-bulk-table">
              <thead>
                <tr><th>Select</th><th>Item</th>${header}<th>State</th></tr>
              </thead>
              <tbody>
                ${rows.map((item) => {
                  const key = bulkItemKey(item);
                  const draft = bulkDraftFor(item);
                  return `
                    <tr data-bulk-item-code="${escapeHtml(key)}" class="${state.bulkEditor.dirty[key] ? "is-dirty" : ""}">
                      <td><input type="checkbox" data-bulk-select="${escapeHtml(key)}" ${selection.has(key) ? "checked" : ""} /></td>
                      <td><strong>${escapeHtml(item.label || item.display_name || key)}</strong><span class="muted">${escapeHtml(key)}</span></td>
                      ${type === "market" ? renderMarketBulkCells(item, draft) : renderInventoryBulkCells(item, draft)}
                      <td>${renderBulkResult(key)}</td>
                    </tr>
                  `;
                }).join("") || `<tr><td colspan="14"><div class="ss-empty ss-empty-compact">No items match this bulk editor filter.</div></td></tr>`}
              </tbody>
            </table>
          </div>
          <footer class="ss-economy-item-editor-foot">
            <button class="ss-btn ss-btn-secondary" type="button" data-bulk-close>Cancel</button>
            <button class="ss-btn" type="button" data-bulk-apply ${state.bulkEditor.applying ? "disabled" : ""}>${state.bulkEditor.applying ? "Applying..." : "Validate & apply selected rows"}</button>
          </footer>
        </div>
      </div>
    `;
  }

  function economyOverlayOpen() {
    return Boolean(
      state.itemEditorCode ||
      state.marketEditorCode ||
      state.bulkEditor.type ||
      state.auditDrawer ||
      state.participationExclusions.policyModalOpen
    );
  }

  function renderItemDefinitionsToolbar(pageInfo) {
    const first = pageInfo.totalItems ? ((pageInfo.page - 1) * state.itemPageSize) + 1 : 0;
    const last = Math.min(pageInfo.totalItems, pageInfo.page * state.itemPageSize);
    return `
      <div class="ss-economy-management-toolbar ss-economy-item-list-toolbar">
        <div class="ss-economy-management-head">
          <div>
            <span class="ss-subtitle">Inventory definitions</span>
            <strong>Item Definitions</strong>
            <span class="muted">Metadata, categories, icons, rarity, enabled state, and public-safe notes.</span>
          </div>
          <span class="ss-economy-management-count">Showing ${formatNumber(first)}-${formatNumber(last)} of ${formatNumber(pageInfo.totalItems)}</span>
        </div>
        <div class="ss-economy-management-search">
          <label>
            Search inventory
            <input id="economy-item-search" type="search" value="${escapeHtml(state.itemSearch)}" placeholder="Item code, name, category, rarity" />
          </label>
        </div>
        <div class="ss-economy-management-controls">
          <div class="ss-economy-management-controls-left">
            <div class="ss-economy-view-toggle" aria-label="Inventory browser view">
              <button class="ss-btn ss-btn-secondary ${state.itemViewMode === "cards" ? "is-active" : ""}" type="button" data-item-view="cards" aria-pressed="${state.itemViewMode === "cards"}">Card Grid</button>
              <button class="ss-btn ss-btn-secondary ${state.itemViewMode === "list" ? "is-active" : ""}" type="button" data-item-view="list" aria-pressed="${state.itemViewMode === "list"}">List</button>
            </div>
          </div>
          <div class="ss-economy-management-controls-right">
            <button class="ss-btn ss-btn-secondary" type="button" data-bulk-open="inventory">Bulk edit items</button>
            <label class="ss-economy-item-page-size">
              Items per page
              <select id="economy-item-page-size">${itemPageSizeOptions()}</select>
            </label>
          </div>
        </div>
      </div>
    `;
  }

  function filteredItemDefinitions() {
    const query = text(state.itemSearch).toLowerCase();
    return (Array.isArray(state.itemDefinitions) ? state.itemDefinitions : []).filter((item) => {
      const haystack = [
        item.item_code,
        item.label,
        item.category,
        item.category_label,
        item.rarity,
        item.short_description,
        item.tooltip_description
      ].map((value) => text(value).toLowerCase()).join(" ");
      return !query || haystack.includes(query);
    });
  }

  function identityUserCode(identity = {}, wallet = {}) {
    identity = identity || {};
    wallet = wallet || {};
    return text(
      identity.user_code ||
        identity.canonical_user_code ||
        identity.account_user_code ||
        wallet.user_code ||
        wallet.account_user_code ||
        identity.identity_code ||
        wallet.identity_code
    );
  }

  function identityFallbackCode(identity = {}, wallet = {}) {
    identity = identity || {};
    wallet = wallet || {};
    return text(identity.public_identity_code || identity.fallback_public_identity_code || identity.identity_code || wallet.public_identity_code || wallet.identity_code);
  }

  function publicIdentityChipItems(identity = {}, wallet = {}) {
    identity = identity || {};
    wallet = wallet || {};
    const sourceCodes = Array.isArray(wallet.source_identity_codes) ? wallet.source_identity_codes : [];
    const primaryCode = text(identity.identity_code || wallet.identity_code || wallet.public_identity_code);
    const codes = Array.from(new Set([primaryCode, ...sourceCodes.map((code) => text(code))].filter(Boolean)));
    return codes.map((code) => ({
      identity_code: code,
      primary: code === primaryCode,
      removable_by_admin: code !== primaryCode,
      account_id: text(identity.account_id || wallet.account_id),
      account_user_code: text(identity.account_user_code || wallet.account_user_code || identity.user_code || wallet.user_code),
      assignment_source: code === primaryCode ? "primary" : "assigned secondary",
    }));
  }

  function renderPublicIdentityChips(identities = [], accountLabel = "") {
    if (!identities.length) return `<span class="muted">No public IDs returned.</span>`;
    return `<span class="ss-public-identity-chip-row">${identities.map((identity) => {
      const code = text(identity.identity_code || identity.public_identity_code);
      const primary = identity.primary === true || identity.is_primary === true;
      const title = [
        primary ? "Primary public identity" : "Assigned secondary public identity",
        accountLabel ? `Account: ${accountLabel}` : "",
        identity.assignment_source ? `Source: ${identity.assignment_source}` : "",
        identity.assigned_at ? `Assigned: ${identity.assigned_at}` : "",
      ].filter(Boolean).join(" · ");
      if (primary) {
        return `<span class="ss-public-identity-chip is-primary" title="${escapeHtml(title)}"><span class="chip-icon" style="background-color:#FEF3C7;-webkit-mask-image:url('/assets/icons/ui/padlockclosed.svg');mask-image:url('/assets/icons/ui/padlockclosed.svg');"></span><span class="chip-icon" style="background-color:#FEF3C7;-webkit-mask-image:url('/assets/icons/ui/star.svg');mask-image:url('/assets/icons/ui/star.svg');"></span>${escapeHtml(code)}</span>`;
      }
      return `<button class="ss-public-identity-chip is-secondary" type="button" title="${escapeHtml(`${title} · Click to unassign`)}" data-public-identity-unassign-chip="${escapeHtml(code)}" data-public-identity-account-id="${escapeHtml(identity.account_id || "")}" data-public-identity-account-label="${escapeHtml(accountLabel)}">${escapeHtml(code)}<span class="chip-icon unassign-icon" style="background-color:#DFF7FF;-webkit-mask-image:url('/assets/icons/ui/backspace.svg');mask-image:url('/assets/icons/ui/backspace.svg');"></span></button>`;
    }).join("")}</span>`;
  }

  async function unassignPublicIdentityChip(button) {
    const identityCode = text(button?.dataset?.publicIdentityUnassignChip);
    const accountId = text(button?.dataset?.publicIdentityAccountId);
    const accountLabel = text(button?.dataset?.publicIdentityAccountLabel || accountId);
    if (!identityCode) return;
    const reason = text(window.prompt?.(`Unassign ${identityCode} from ${accountLabel || "this account"}?\n\nHistorical ledger rows are not deleted.\n\nRequired reason/note:`) || "");
    if (!reason) {
      setStatus("Public identity unassign requires a reason/note.", "error");
      return;
    }
    setStatus(`Unassigning ${identityCode} through Runtime/Auth...`);
    await requestJson(PUBLIC_IDENTITY_UNASSIGN, {
      method: "POST",
      body: JSON.stringify({ identity_code: identityCode, account_id: accountId, reason }),
    });
    setStatus(`Unassigned ${identityCode}.`, "success");
    await refresh();
  }

  function identityAvatar(identity = {}) {
    const profileMedia = identity?.profile_media || identity?.profileMedia || {};
    const image = identity?.image || profileMedia.avatar || {};
    const media = identity?.media || {};
    const usableImageUrl = (value) => {
      const source = text(value);
      if (!source) return false;
      if (source.startsWith("data:") || source.startsWith("blob:")) return true;
      if (/^https?:\/\//i.test(source)) return true;
      if (source.startsWith("//")) return true;
      if (source.startsWith("/") && !source.includes("/assets/icons/ui/profile.svg")) return true;
      return false;
    };
    const avatarUrl = [
      image.avatar_url, image.profile_image_url, image.profile_photo_url, image.url, image.image_url, image.picture,
      image.provider_picture, image.provider_avatar_url, image.display_avatar_url, image.public_avatar_url,
      profileMedia.avatar_url, profileMedia.profile_image_url, profileMedia.profile_photo_url, profileMedia.public_url,
      profileMedia.provider_picture, profileMedia.provider_avatar_url, profileMedia.display_avatar_url, profileMedia.public_avatar_url,
      media.avatar_url, media.profile_image_url, media.profile_photo_url, media.picture, media.provider_picture,
      identity.profile_image_url, identity.profileImageUrl, identity.profile_photo_url, identity.profilePhotoUrl,
      identity.avatar_url, identity.avatarUrl, identity.avatar, identity.picture, identity.image_url, identity.imageUrl,
      identity.provider_avatar_url, identity.providerAvatarUrl, identity.provider_picture, identity.providerPicture,
      identity.display_avatar_url, identity.displayAvatarUrl, identity.public_avatar_url, identity.publicAvatarUrl
    ].map(text).find(usableImageUrl) || "";
    const cacheKey = text(
      image.image_version ||
        image.cache_key ||
        profileMedia.image_version ||
        profileMedia.cache_key ||
        identity.image_version ||
        identity.imageVersion
    );
    if (!avatarUrl || !cacheKey || avatarUrl.startsWith("data:") || avatarUrl.startsWith("blob:")) return avatarUrl;
    try {
      const parsed = new URL(avatarUrl, window.location.origin);
      if (/^https?:\/\//i.test(avatarUrl) && parsed.origin !== window.location.origin) return avatarUrl;
      if (!parsed.searchParams.has("v")) parsed.searchParams.set("v", cacheKey);
      return parsed.origin === window.location.origin && avatarUrl.startsWith("/")
        ? `${parsed.pathname}${parsed.search}${parsed.hash}`
        : parsed.toString();
    } catch (_) {
      return avatarUrl;
    }
  }

  function renderAvatar(identity = {}, wallet = {}) {
    const avatarUrl = identityAvatar(identity);
    const displayName = text(identity.display_name || wallet.display_name || identityUserCode(identity, wallet) || "Identity");
    const fallbackValue = text(identity.fallback_display_initial || identity.fallbackDisplayInitial) || (displayName || "?").slice(0, 1).toUpperCase();
    const fallback = escapeHtml(fallbackValue);
    const fallbackJsText = escapeHtml(JSON.stringify(fallbackValue));
    if (avatarUrl) {
      return `<span class="ss-economy-avatar has-image"><img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)} avatar" loading="lazy" decoding="async" onerror="this.closest('.ss-economy-avatar')?.classList.remove('has-image');this.replaceWith(document.createTextNode(${fallbackJsText}));" /></span>`;
    }
    return `<span class="ss-economy-avatar" aria-hidden="true">${fallback}</span>`;
  }

  function renderCurrencySymbol(options = {}) {
    const path = assetPath(state.economySettings.currency_symbol_path || "assets/games/currencyunit.svg");
    return `<span class="ss-economy-currency-symbol${options.compact ? " ss-economy-currency-symbol--compact" : ""}" style="--economy-currency-symbol: url('${escapeHtml(path)}')" aria-hidden="true"></span>`;
  }

  function renderCreditValue(value, options = {}) {
    return `
      <span class="ss-economy-credit-value${options.compact ? " ss-economy-credit-value--compact" : ""}${options.prominent ? " ss-economy-credit-value--prominent" : ""}">
        ${renderCurrencySymbol(options)}
        <span>${formatNumber(value)} ${escapeHtml(currencyPluralLabel(value))}</span>
      </span>
    `;
  }

  function renderWalletMoneyValue(value, options = {}) {
    const number = Number(value || 0);
    const exact = formatNumber(number);
    return `
      <span class="ss-economy-wallet-money${options.prominent ? " ss-economy-wallet-money--prominent" : ""}">
        <span class="ss-economy-wallet-money-main">
          ${renderCurrencySymbol(options)}
          <span>${escapeHtml(formatCompactNumber(number))}</span>
        </span>
        <small>(${escapeHtml(exact)})</small>
      </span>
    `;
  }

  function renderDenominationBreakdown(wallet = {}) {
    const breakdown = Array.isArray(wallet.denomination_breakdown) ? wallet.denomination_breakdown : [];
    const visible = breakdown.filter((item) => item?.should_display || item?.always_show_in_balance || Number(item?.count || 0) > 0);
    if (!visible.length) return `<div class="ss-empty ss-empty-compact">No denomination breakdown returned.</div>`;
    return `
      <div class="ss-economy-denomination-breakdown">
        ${visible.map((item) => `
          <button class="ss-economy-denomination-chip" type="button" title="${escapeHtml(formatNumber(item.value_in_credits || 0))} credits each" data-item-detail-open data-item-detail-kind="wallet" data-item-detail-code="${escapeHtml(item.denomination_code || item.item_code || item.label)}" aria-label="Open ${escapeHtml(item.label || item.plural_label || "wallet unit")} details">
            <img src="${escapeHtml(assetPath(item.icon_path))}" alt="" loading="lazy" decoding="async" />
            <strong>${formatNumber(item.count || 0)}</strong>
            <span>${escapeHtml(Number(item.count || 0) === 1 ? item.label : item.plural_label || item.label)}</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  function itemDefinitionFor(itemCode) {
    return state.itemDefinitions.find((item) => item.item_code === itemCode) || null;
  }

  function itemLabel(item = {}) {
    const definition = item.definition || itemDefinitionFor(item.item_code) || {};
    return text(definition.label || item.label || item.item_code || "Item");
  }

  function itemCategory(item = {}) {
    const definition = item.definition || itemDefinitionFor(item.item_code) || {};
    return categoryDisplayLabel(definition.category_label || definition.category || item.category_label || item.category || "Uncategorized");
  }

  function itemIcon(item = {}) {
    const definition = item.definition || itemDefinitionFor(item.item_code) || {};
    return text(definition.icon_path || item.icon_path);
  }

  function manualInventorySelectedItem() {
    const select = $("#inventory-action-item");
    const selectedCode = text(select?.value) || text(state.itemDefinitions?.[0]?.item_code);
    return itemDefinitionFor(selectedCode) || state.itemDefinitions?.[0] || null;
  }

  function manualInventorySearchText(item = {}) {
    return [
      item.item_code,
      item.slug,
      item.label,
      item.display_name,
      item.name,
      item.category,
      item.category_label,
      item.item_type,
      item.type,
      item.subtype,
      item.rarity,
      item.tier,
      item.alias,
      item.chat_alias,
      item.command_alias,
      item.short_description,
      item.description,
      item.tags,
      item.attributes
    ].flatMap((value) => Array.isArray(value) ? value : [value]).map(text).join(" ").toLowerCase();
  }

  function manualInventorySuggestionItems() {
    const query = text(state.manualInventorySearch).toLowerCase();
    const rows = Array.isArray(state.itemDefinitions) ? state.itemDefinitions : [];
    const filtered = query ? rows.filter((item) => manualInventorySearchText(item).includes(query)) : rows;
    return filtered.slice(0, 12);
  }

  function selectManualInventoryItem(itemCode, options = {}) {
    const select = $("#inventory-action-item");
    if (select) select.value = itemCode;
    const item = itemDefinitionFor(itemCode) || {};
    state.manualInventorySearch = options.keepSearch ? state.manualInventorySearch : text(item.label || item.display_name || item.item_code);
    state.manualInventorySuggestionsOpen = false;
    state.manualInventoryHighlightedIndex = 0;
    renderManualInventoryPreview();
  }

  function renderManualInventorySuggestions() {
    const list = $("#inventory-action-item-suggestions");
    if (!list) return;
    const results = manualInventorySuggestionItems();
    if (!state.manualInventorySuggestionsOpen) {
      list.hidden = true;
      list.innerHTML = "";
      return;
    }
    list.hidden = false;
    if (!results.length) {
      list.innerHTML = `<div class="ss-economy-item-picker-empty">No item matches this search.</div>`;
      return;
    }
    state.manualInventoryHighlightedIndex = Math.max(0, Math.min(state.manualInventoryHighlightedIndex, results.length - 1));
    list.innerHTML = results.map((item, index) => `
      <button class="ss-economy-item-picker-result${index === state.manualInventoryHighlightedIndex ? " is-highlighted" : ""}" type="button" data-inventory-action-pick="${escapeHtml(item.item_code)}" role="option" aria-selected="${index === state.manualInventoryHighlightedIndex ? "true" : "false"}">
        ${renderItemIcon(item)}
        <span><strong>${escapeHtml(item.label || item.display_name || item.item_code)}</strong><small>${escapeHtml([item.item_code, item.category_label || item.category, item.rarity || item.tier].filter(Boolean).join(" · "))}</small></span>
      </button>
    `).join("");
  }

  function renderManualInventoryPreview() {
    const host = $("#inventory-action-item-preview");
    if (!host) return;
    const item = manualInventorySelectedItem();
    if (!item) {
      host.innerHTML = `<div class="ss-empty ss-empty-compact">Select an item to preview the existing definition before applying an inventory action.</div>`;
      return;
    }
    const valueRows = [
      item.market_price_stekels != null ? `Price ${formatNumber(item.market_price_stekels)} Stekels` : "",
      item.value_in_credits != null ? `Value ${formatNumber(item.value_in_credits)} ${currencyPluralLabel(item.value_in_credits)}` : "",
      item.exchange_value_stekels != null ? `Exchange ${formatNumber(item.exchange_value_stekels)} Stekels` : ""
    ].filter(Boolean);
    const statusRows = [
      item.is_enabled === false ? "Disabled" : item.is_enabled === true ? "Enabled" : "",
      item.market_enabled != null || item.purchasable != null || item.can_buy != null ? (marketEnabled(item) ? "On sale" : "Off sale") : "",
      item.exchange_enabled != null || item.exchangeable != null || item.can_exchange != null ? (exchangeEnabled(item) ? "Exchangeable" : "No exchange") : ""
    ].filter(Boolean);
    const tags = [item.alias, item.chat_alias, item.command_alias, ...(Array.isArray(item.tags) ? item.tags : []), ...(Array.isArray(item.attributes) ? item.attributes : [])].map(text).filter(Boolean);
    host.innerHTML = `
      <article class="ss-economy-manual-item-preview-card">
        ${renderItemIcon(item)}
        <div class="ss-economy-manual-item-preview-body">
          <strong>${escapeHtml(item.label || item.display_name || item.item_code)}</strong>
          <code>${escapeHtml(item.item_code || "")}</code>
          <span class="muted">${escapeHtml([item.category_label || item.category || item.item_type || item.type, item.subtype, item.rarity || item.tier].filter(Boolean).join(" · "))}</span>
          ${text(item.short_description || item.description) ? `<p>${escapeHtml(text(item.short_description || item.description))}</p>` : ""}
          ${valueRows.length ? `<div class="ss-economy-item-chip-row">${valueRows.map((row) => `<span class="ss-economy-item-chip">${escapeHtml(row)}</span>`).join("")}</div>` : ""}
          ${statusRows.length ? `<div class="ss-economy-item-chip-row">${statusRows.map((row) => `<span class="ss-economy-state ${row === "Enabled" || row === "On sale" || row === "Exchangeable" ? "ss-economy-state-active" : ""}">${escapeHtml(row)}</span>`).join("")}</div>` : ""}
          ${tags.length ? `<span class="muted">Aliases/tags: ${escapeHtml(tags.join(", "))}</span>` : ""}
        </div>
      </article>
    `;
  }

  function marketEnabled(item = {}) {
    return Boolean(item.market_enabled || item.purchasable || item.can_buy);
  }

  function exchangeEnabled(item = {}) {
    return Boolean(item.exchange_enabled || item.exchangeable || item.can_exchange);
  }

  function marketItemType(item = {}) {
    return text(item.item_type || item.type || item.category || "Uncategorized");
  }

  function marketItemTypeLabel(item = {}) {
    return categoryDisplayLabel(item.item_type_label || item.type_label || item.category_label || item.item_type || item.type || item.category || "Uncategorized");
  }

  function marketPrice(item = {}) {
    return Number(item.market_price_stekels ?? item.market_price_credits ?? 0) || 0;
  }

  function exchangeValue(item = {}) {
    return Number(item.exchange_value_stekels ?? item.exchange_value_credits ?? 0) || 0;
  }

  function presetOptions(values = [], selected = "") {
    return (Array.isArray(values) ? values : [])
      .map((value) => `<option value="${escapeHtml(value)}" ${text(value) === text(selected) ? "selected" : ""}>${escapeHtml(value)}</option>`)
      .join("");
  }

  function catalogAssetPath(item = {}) {
    return normalizeItemIconPath(item.path || item.url || item.icon_path || "");
  }

  function definitionComplete(item = {}) {
    return Boolean(text(item.label) && text(item.category || item.type));
  }

  function normalizeAssetCatalog(items = [], fallbackDefinitions = []) {
    const definitionByPath = new Map(
      (Array.isArray(fallbackDefinitions) ? fallbackDefinitions : [])
        .map((item) => [catalogAssetPath(item), item])
        .filter(([path]) => path && isSupportedAssetPath(path))
    );
    const normalized = (Array.isArray(items) ? items : [])
      .map((item) => {
        const path = catalogAssetPath(item);
        if (!path || !isSupportedAssetPath(path)) return null;
        const definition = definitionByPath.get(path) || {};
        const filename = text(item.filename || path.split("/").pop());
        const extension = text(item.extension || filename.split(".").pop()).toLowerCase();
        return {
          ...item,
          ...definition,
          path,
          filename,
          extension,
          label: text(definition.label || item.label || formatLabel(filename.replace(/\.[^.]+$/, ""))),
          category: text(definition.category || definition.type || item.category || item.type || ""),
          tags: Array.isArray(definition.tags || item.tags) ? (definition.tags || item.tags) : [],
          notes: text(definition.notes || item.notes || item.description || ""),
          size_bytes: Number(item.size_bytes || definition.size_bytes || 0),
          present_on_disk: item.present_on_disk !== false,
          definition_complete: definitionComplete({ ...item, ...definition })
        };
      })
      .filter(Boolean);
    for (const [path, definition] of definitionByPath.entries()) {
      if (normalized.some((item) => item.path === path)) continue;
      const filename = text(definition.filename || path.split("/").pop());
      normalized.push({
        ...definition,
        path,
        filename,
        extension: text(definition.extension || filename.split(".").pop()).toLowerCase(),
        label: text(definition.label || formatLabel(filename.replace(/\.[^.]+$/, ""))),
        category: text(definition.category || definition.type || ""),
        present_on_disk: false,
        definition_complete: definitionComplete(definition)
      });
    }
    return normalized.sort((a, b) => a.path.localeCompare(b.path));
  }

  async function loadAssetCatalog() {
    if (state.assetCatalogLoaded) return;
    state.assetCatalogLoaded = true;
    try {
      const payload = await requestJson(GAME_ASSETS);
      const definitions = Array.isArray(payload.definitions) ? payload.definitions : [];
      const files = Array.isArray(payload.files) ? payload.files : [];
      state.assetFiles = normalizeAssetCatalog(files);
      state.assetCatalog = normalizeAssetCatalog(payload.assets || files, definitions);
      state.unresolvedAssets = normalizeAssetCatalog(payload.unresolved || state.assetCatalog.filter((item) => item.present_on_disk && !item.definition_complete));
      state.assetWritable = Boolean(payload.writable);
      state.supportedAssetExtensions = Array.isArray(payload.supported_extensions) && payload.supported_extensions.length
        ? payload.supported_extensions
        : state.supportedAssetExtensions;
      state.assetWritableMessage = state.assetWritable ? "" : "Upload is unavailable because Runtime/Auth has no writable game asset root configured.";
      state.assetCatalogError = state.assetCatalog.length ? "" : "No bundled game assets were listed in the catalog.";
    } catch (err) {
      try {
        const [filesResponse, catalogResponse] = await Promise.all([
          fetch(GAME_ASSET_FILES, { cache: "no-store" }),
          fetch(GAME_ASSET_CATALOG, { cache: "no-store" })
        ]);
        const filesPayload = filesResponse.ok ? await filesResponse.json() : {};
        const catalogPayload = catalogResponse.ok ? await catalogResponse.json() : {};
        const files = filesPayload.items || filesPayload.files || [];
        const definitions = catalogPayload.items || catalogPayload.assets || [];
        state.assetFiles = normalizeAssetCatalog(files);
        state.assetCatalog = normalizeAssetCatalog(files.length ? files : definitions, definitions);
        state.unresolvedAssets = state.assetCatalog.filter((item) => item.present_on_disk && !item.definition_complete);
        state.assetWritable = false;
        state.assetWritableMessage = "Runtime/Auth asset upload API is unavailable; using the static Dashboard manifest.";
        state.assetCatalogError = state.assetCatalog.length ? "" : (err?.message || "Asset catalog unavailable.");
      } catch (fallbackErr) {
        state.assetCatalog = [];
        state.assetFiles = [];
        state.unresolvedAssets = [];
        state.assetWritable = false;
        state.assetWritableMessage = "Runtime/Auth asset upload API is unavailable.";
        state.assetCatalogError = fallbackErr?.message || err?.message || "Asset catalog unavailable.";
      }
    }
  }

  function iconInputForTarget(target = state.assetPicker.target) {
    if (target === "create") return $("#economy-item-create-icon");
    if (text(target).startsWith("denomination:")) {
      const code = text(target).slice("denomination:".length);
      const row = code ? document.querySelector(`.ss-economy-denomination-row[data-denomination-code="${CSS.escape(code)}"]`) : null;
      return row?.querySelector('[data-denomination-field="icon_path"]') || null;
    }
    const row = target
      ? document.querySelector(`.ss-economy-item-editor-modal .ss-economy-item-definition[data-item-code="${CSS.escape(target)}"]`) ||
        document.querySelector(`.ss-economy-item-definition[data-item-code="${CSS.escape(target)}"]`)
      : null;
    return row?.querySelector('[data-item-field="icon_path"]') || null;
  }

  function currentIconInputValue(target = state.assetPicker.target) {
    return normalizeItemIconPath(iconInputForTarget(target)?.value || "");
  }

  function renderIconPathControl({ itemCode = "", value = "", create = false } = {}) {
    const normalized = normalizeItemIconPath(value);
    const target = create ? "create" : itemCode;
    return `
      <div class="ss-economy-icon-field ss-economy-wide">
        <label>Icon path<input ${create ? 'id="economy-item-create-icon"' : 'data-item-field="icon_path"'} value="${escapeHtml(normalized)}" placeholder="assets/games/sscoin.webp" /></label>
        <button class="ss-btn ss-btn-secondary ss-economy-asset-browse" type="button" data-asset-target="${escapeHtml(target)}">Browse assets</button>
        <div class="ss-economy-icon-preview" data-icon-preview="${escapeHtml(target)}">
          ${renderIconPreview(normalized)}
        </div>
      </div>
    `;
  }

  function renderDenominationIconPathControl(item = {}) {
    const normalized = normalizeItemIconPath(item.icon_path || item.image_asset_key || "");
    const target = `denomination:${item.denomination_code || ""}`;
    const errors = state.denominationErrors[item.denomination_code] || {};
    return `
      <div class="ss-economy-icon-field ss-economy-wide">
        <label>Image asset<input data-denomination-field="icon_path" value="${escapeHtml(normalized)}" placeholder="assets/games/ssdiamond.webp" /></label>
        <button class="ss-btn ss-btn-secondary ss-economy-asset-browse" type="button" data-asset-target="${escapeHtml(target)}">Browse assets</button>
        <div class="ss-economy-icon-preview" data-icon-preview="${escapeHtml(target)}">
          ${renderIconPreview(normalized)}
        </div>
        <span class="ss-field-error">${escapeHtml(fieldErrorText(errors, "path") || fieldErrorText(errors, "icon_path"))}</span>
      </div>
    `;
  }

  function renderIconPreview(path) {
    const normalized = normalizeItemIconPath(path);
    const fallback = assetPreviewLabel(normalized);
    if (!normalized || fallback) {
      return `<span class="ss-economy-icon-preview-placeholder">${escapeHtml(fallback || "No icon configured")}</span>`;
    }
    return `<img src="${escapeHtml(assetPath(normalized))}" alt="" loading="lazy" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement('span'), { className: 'ss-economy-icon-preview-placeholder', textContent: 'Preview unavailable' }))" /><span>${escapeHtml(normalized)}</span>`;
  }

  function syncIconPreview(input) {
    const denominationCode = text(input?.closest(".ss-economy-denomination-row")?.dataset?.denominationCode);
    const target = input?.id === "economy-item-create-icon"
      ? "create"
      : denominationCode
        ? `denomination:${denominationCode}`
        : text(input?.closest(".ss-economy-item-definition")?.dataset?.itemCode);
    const preview = document.querySelector(`[data-icon-preview="${CSS.escape(target)}"]`);
    if (preview) preview.innerHTML = renderIconPreview(input.value);
  }

  function assetDefinitionDraft(path = state.assetPicker.selectedPath) {
    const normalizedPath = normalizeItemIconPath(path);
    const existing = state.assetCatalog.find((item) => item.path === normalizedPath) || {};
    const filename = text(existing.filename || normalizedPath.split("/").pop());
    return {
      path: normalizedPath,
      label: text(state.assetPicker.definition?.label || existing.label || formatLabel(filename.replace(/\.[^.]+$/, ""))),
      category: text(state.assetPicker.definition?.category || existing.category || "item"),
      tags: text(state.assetPicker.definition?.tags || (Array.isArray(existing.tags) ? existing.tags.join(", ") : "")),
      notes: text(state.assetPicker.definition?.notes || existing.notes || ""),
      reason_text: text(state.assetPicker.definition?.reason_text || "")
    };
  }

  function renderAssetDefinitionFields(prefix, draft = assetDefinitionDraft()) {
    return `
      <div class="ss-economy-asset-definition-fields">
        <label>Friendly name<input id="${prefix}-label" data-asset-definition-field="label" value="${escapeHtml(draft.label)}" placeholder="Potion" /></label>
        <label>Category / type<input id="${prefix}-category" data-asset-definition-field="category" value="${escapeHtml(draft.category)}" placeholder="consumable" /></label>
        <label class="ss-economy-wide">Tags or notes<input id="${prefix}-tags" data-asset-definition-field="tags" value="${escapeHtml(draft.tags)}" placeholder="potion, health, event" /></label>
        <label class="ss-economy-wide">Normalized asset path<input id="${prefix}-path" data-asset-definition-field="path" value="${escapeHtml(draft.path)}" placeholder="assets/games/potion.webp" /></label>
        <label class="ss-economy-wide">Notes<textarea id="${prefix}-notes" data-asset-definition-field="notes" rows="3">${escapeHtml(draft.notes)}</textarea></label>
        <label class="ss-economy-wide">Reason<input id="${prefix}-reason" data-asset-definition-field="reason_text" value="${escapeHtml(draft.reason_text)}" placeholder="Required for edit or remove" /></label>
        ${fieldErrorText(state.assetPicker.errors, "reason_text") ? `<p class="ss-field-error ss-economy-wide">${escapeHtml(fieldErrorText(state.assetPicker.errors, "reason_text"))}</p>` : ""}
        ${fieldErrorText(state.assetPicker.errors, "path") ? `<p class="ss-field-error ss-economy-wide">${escapeHtml(fieldErrorText(state.assetPicker.errors, "path"))}</p>` : ""}
      </div>
    `;
  }

  function renderAssetSourceTab(mode, label) {
    const active = state.assetPicker.mode === mode;
    return `<button class="ss-economy-asset-tab${active ? " is-active" : ""}" type="button" role="tab" aria-selected="${active ? "true" : "false"}" data-asset-mode="${escapeHtml(mode)}">${escapeHtml(label)}</button>`;
  }

  function renderBundledAssetGrid(assets, selectedPath) {
    return `
      <div class="ss-economy-asset-grid" data-asset-results>
       ${
         assets.length
           ? assets.map((item) => `
               <article class="ss-economy-asset-tile${item.path === selectedPath ? " is-selected" : ""}">
               <button class="ss-economy-asset-tile-main" type="button" data-asset-path="${escapeHtml(item.path)}">
                 <span class="ss-economy-asset-thumb"><img src="${escapeHtml(assetPath(item.path))}" alt="" loading="lazy" decoding="async" onerror="this.closest('.ss-economy-asset-thumb')?.classList.add('is-unavailable'); this.remove();" /></span>
                 <strong>${escapeHtml(item.label)}</strong>
                 <span>${escapeHtml(item.definition_complete ? item.path : `${item.path} · needs definition`)}</span>
               </button>
               <span class="ss-economy-asset-row-actions">
                 <button class="ss-btn ss-btn-secondary" type="button" data-asset-edit-definition="${escapeHtml(item.path)}">${item.definition_complete ? "Edit" : "Define"}</button>
                 <button class="ss-btn ss-btn-danger" type="button" data-asset-remove-definition="${escapeHtml(item.path)}" title="Remove definition listing only. Physical files are not deleted." ${item.definition_complete ? "" : "disabled"}>Remove listing</button>
               </span>
               </article>
             `).join("")
           : `<div class="ss-empty ss-empty-compact">${escapeHtml(state.assetCatalogError || "No matching assets.")}</div>`
       }
      </div>
    `;
  }

  function renderUnresolvedAssetList(unresolved) {
    return `
      <div class="ss-economy-asset-reconcile" data-asset-results>
       ${
         unresolved.length
           ? unresolved.map((item) => `
               <article class="ss-economy-asset-reconcile-row">
                 <span class="ss-economy-asset-thumb"><img src="${escapeHtml(assetPath(item.path))}" alt="" loading="lazy" decoding="async" onerror="this.closest('.ss-economy-asset-thumb')?.classList.add('is-unavailable'); this.remove();" /></span>
                 <div>
                   <strong>${escapeHtml(item.filename)}</strong>
                   <span class="muted">${escapeHtml(item.extension.toUpperCase())} · ${escapeHtml(item.path)}</span>
                   <span class="ss-economy-state ss-economy-state-reversal">Needs definition</span>
                 </div>
                 <button class="ss-btn ss-btn-secondary" type="button" data-asset-define-path="${escapeHtml(item.path)}">Define</button>
               </article>
             `).join("")
           : `<div class="ss-empty ss-empty-compact">No unresolved bundled image files.</div>`
       }
      </div>
    `;
  }

  function renderAssetPreviewAside(previewPath) {
    return `
      <aside class="ss-economy-asset-preview" data-asset-preview>
        <strong>Selected preview</strong>
        <div class="ss-economy-asset-preview-frame">${renderIconPreview(previewPath)}</div>
        <code>${escapeHtml(normalizeItemIconPath(previewPath) || "No icon configured")}</code>
      </aside>
    `;
  }

  function itemEditorKey() {
    return state.itemEditorCode === ITEM_CREATE_EDITOR_CODE ? ITEM_CREATE_EDITOR_CODE : text(state.itemEditorCode);
  }

  function isItemAssetTarget(target = state.assetPicker.target) {
    const normalized = text(target);
    return Boolean(normalized && !normalized.startsWith("denomination:") && (normalized === "create" || normalized === state.itemEditorCode));
  }

  function usesUnifiedItemAssetSection() {
    return Boolean(state.itemEditorCode && isItemAssetTarget());
  }

  function shouldEmbedAssetPicker() {
    const target = text(state.assetPicker.target);
    if (!state.itemEditorCode || !target || target.startsWith("denomination:")) return false;
    return target === "create" || target === state.itemEditorCode;
  }

  function renderAssetPickerSurface({ integrated = false } = {}) {
    const selectedPath = normalizeItemIconPath(state.assetPicker.selectedPath || currentIconInputValue());
    const customUrl = text(state.assetPicker.customUrl || (/^https?:\/\//i.test(selectedPath) ? selectedPath : ""));
    const query = text(state.assetPicker.filter).toLowerCase();
    const assets = state.assetCatalog.filter((item) => {
      if (!query) return true;
      return `${item.filename} ${item.path} ${item.label} ${item.category} ${item.extension}`.toLowerCase().includes(query);
    });
    const selectedAsset = state.assetCatalog.find((item) => item.path === selectedPath) || assets[0] || null;
    const definitionDraft = assetDefinitionDraft();
    const previewPath = state.assetPicker.mode === "custom"
      ? customUrl
      : state.assetPicker.mode === "upload"
        ? state.assetUploadPreviewUrl || selectedPath
        : selectedPath || selectedAsset?.path || "";
    const useValue = state.assetPicker.mode === "custom"
      ? normalizeItemIconPath(customUrl)
      : normalizeItemIconPath(selectedPath);
    const canUseAsset = Boolean(useValue) && (state.assetPicker.mode !== "custom" || isLikelyImageUrl(customUrl));
    const unresolved = state.unresolvedAssets.filter((item) => {
      if (!query) return true;
      return `${item.filename} ${item.path} ${item.extension}`.toLowerCase().includes(query);
    });
    return `
      <div class="ss-economy-asset-dialog${integrated ? " ss-economy-asset-dialog--integrated" : ""}">
        ${integrated ? "" : `
          <header class="ss-economy-asset-head">
            <div>
              <span class="ss-subtitle">Icon & Assets</span>
              <h3 id="economy-asset-picker-title">Choose item asset</h3>
              <p>Pick a bundled game image, define a missing catalog entry, upload through Runtime/Auth when available, or use an external image URL.</p>
            </div>
            <button class="ss-icon-btn ss-economy-asset-close" type="button" aria-label="Close asset selector" data-asset-close><span aria-hidden="true"></span></button>
          </header>
        `}
        <div class="ss-economy-asset-tabs" role="tablist" aria-label="Asset source">
          ${renderAssetSourceTab("bundled", "Choose existing asset")}
          ${renderAssetSourceTab("define", "Define/upload new asset")}
          ${renderAssetSourceTab("reconcile", "Reconcile existing files")}
          ${renderAssetSourceTab("custom", "External URL")}
        </div>
        ${
          state.assetPicker.mode === "custom"
            ? `<div class="ss-economy-asset-custom">
                <label>External image URL<input id="economy-asset-custom-url" value="${escapeHtml(customUrl)}" placeholder="https://example.com/icon.webp" /></label>
                <p class="muted">Use bundled assets from the browser when possible. External URLs can be pasted here when the image is hosted elsewhere and ends with a normal image extension.</p>
              </div>`
            : state.assetPicker.mode === "define"
              ? `<div class="ss-economy-asset-define">
                  <div class="ss-alert ${state.assetWritable ? "" : "ss-alert-warning"}">${escapeHtml(state.assetWritable ? (state.assetPicker.editingPath ? "Edit this Runtime/Auth image asset definition listing. Physical image files are not changed." : "Save a catalog definition for a bundled image, or choose a local file to upload through Runtime/Auth.") : state.assetWritableMessage || "Upload is unavailable because no writable asset root is configured.")}</div>
                  ${renderAssetDefinitionFields("economy-asset-definition", definitionDraft)}
                  <label class="ss-economy-wide">Upload image file<input id="economy-asset-upload-file" type="file" accept="${state.supportedAssetExtensions.map((ext) => `.${ext}`).join(",")}" ${state.assetWritable ? "" : "disabled"} /></label>
                  <button class="ss-btn ss-btn-secondary" type="button" data-asset-save-definition>${state.assetPicker.editingPath ? "Save listing edit" : "Save definition"}</button>
                  <button class="ss-btn" type="button" data-asset-upload ${state.assetWritable ? "" : "disabled"}>Upload and use asset</button>
                </div>`
              : state.assetPicker.mode === "reconcile"
                ? `<label class="ss-economy-asset-search">Search unresolved files<input id="economy-asset-filter" value="${escapeHtml(state.assetPicker.filter)}" placeholder="potion, svg, crate..." /></label>
                   ${renderUnresolvedAssetList(unresolved)}`
            : `<label class="ss-economy-asset-search">Search assets<input id="economy-asset-filter" value="${escapeHtml(state.assetPicker.filter)}" placeholder="coin, gem, crate..." /></label>
               ${renderBundledAssetGrid(assets, selectedPath)}`
        }
        ${renderAssetPreviewAside(previewPath)}
        <footer class="ss-economy-asset-actions">
          ${integrated ? `<button class="ss-btn ss-btn-secondary" type="button" data-item-editor-section="details">Return to Details</button>` : `<button class="ss-btn ss-btn-secondary" type="button" data-asset-close>Cancel</button>`}
          <button class="ss-btn" type="button" data-asset-use ${canUseAsset ? "" : "disabled"}>Use selected asset</button>
        </footer>
      </div>
    `;
  }

  function readAssetDefinitionDraft(prefix = "economy-asset-definition") {
    return {
      label: text($(`${prefix}-label`)?.value),
      category: text($(`${prefix}-category`)?.value),
      tags: text($(`${prefix}-tags`)?.value).split(",").map((tag) => text(tag)).filter(Boolean),
      path: normalizeItemIconPath($(`${prefix}-path`)?.value || state.assetPicker.selectedPath),
      notes: text($(`${prefix}-notes`)?.value),
      reason_text: text($(`${prefix}-reason`)?.value)
    };
  }

  function updateAssetStateFromPayload(payload = {}) {
    const definitions = Array.isArray(payload.definitions) ? payload.definitions : [];
    const files = Array.isArray(payload.files) ? payload.files : [];
    if (Array.isArray(payload.assets)) state.assetCatalog = normalizeAssetCatalog(payload.assets, definitions);
    if (files.length) state.assetFiles = normalizeAssetCatalog(files);
    state.unresolvedAssets = Array.isArray(payload.unresolved)
      ? normalizeAssetCatalog(payload.unresolved)
      : state.assetCatalog.filter((item) => item.present_on_disk && !item.definition_complete);
    if (typeof payload.writable === "boolean") state.assetWritable = payload.writable;
    if (payload.path) state.assetPicker.selectedPath = normalizeItemIconPath(payload.path);
  }

  function refreshAssetPickerView() {
    if (usesUnifiedItemAssetSection()) {
      renderItemDefinitions();
    } else {
      renderAssetPicker();
    }
  }

  function refreshIntegratedAssetFilterResults() {
    if (!usesUnifiedItemAssetSection()) return false;
    const container = document.querySelector(".ss-economy-asset-dialog--integrated");
    const results = container?.querySelector("[data-asset-results]");
    const preview = container?.querySelector("[data-asset-preview]");
    if (!container || !results || !preview) return false;
    const query = text(state.assetPicker.filter).toLowerCase();
    const selectedPath = normalizeItemIconPath(state.assetPicker.selectedPath || currentIconInputValue());
    if (state.assetPicker.mode === "reconcile") {
      const unresolved = state.unresolvedAssets.filter((item) => {
        if (!query) return true;
        return `${item.filename} ${item.path} ${item.extension}`.toLowerCase().includes(query);
      });
      results.outerHTML = renderUnresolvedAssetList(unresolved);
    } else if (state.assetPicker.mode === "bundled") {
      const assets = state.assetCatalog.filter((item) => {
        if (!query) return true;
        return `${item.filename} ${item.path} ${item.label} ${item.category} ${item.extension}`.toLowerCase().includes(query);
      });
      results.outerHTML = renderBundledAssetGrid(assets, selectedPath);
    } else {
      return false;
    }
    const selectedAsset = state.assetCatalog.find((item) => item.path === selectedPath) || null;
    const previewPath = selectedPath || selectedAsset?.path || "";
    preview.outerHTML = renderAssetPreviewAside(previewPath);
    return true;
  }

  function renderAssetPicker() {
    const modals = Array.from(document.querySelectorAll("#economy-asset-picker"));
    const existing = modals[0] || null;
    modals.slice(1).forEach((modal) => modal.remove());
    if (!state.assetPicker.open || usesUnifiedItemAssetSection()) {
      existing?.remove();
      return;
    }
    const modal = existing || document.createElement("div");
    const activeElement = document.activeElement;
    const restoreFocusId = activeElement?.id === "economy-asset-filter" || activeElement?.id === "economy-asset-custom-url"
      ? activeElement.id
      : "";
    const restoreSelectionStart = typeof activeElement?.selectionStart === "number" ? activeElement.selectionStart : null;
    const restoreSelectionEnd = typeof activeElement?.selectionEnd === "number" ? activeElement.selectionEnd : null;
    modal.id = "economy-asset-picker";
    modal.className = "ss-economy-asset-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "economy-asset-picker-title");
    modal.innerHTML = renderAssetPickerSurface();
    if (!existing) {
      document.body.appendChild(modal);
    } else if (existing.parentElement !== document.body) {
      document.body.appendChild(existing);
    }
    setTimeout(() => {
      const target = restoreFocusId ? $(restoreFocusId) : ($("#economy-asset-filter") || $("#economy-asset-custom-url") || modal.querySelector("[data-asset-close]"));
      target?.focus?.();
      if (restoreFocusId && typeof target?.setSelectionRange === "function" && restoreSelectionStart !== null && restoreSelectionEnd !== null) {
        target.setSelectionRange(restoreSelectionStart, restoreSelectionEnd);
      }
    }, 0);
  }

  function renderItemIcon(item = {}) {
    const icon = normalizeItemIconPath(itemIcon(item));
    const fallbackLabel = assetPreviewLabel(icon);
    if (icon && !fallbackLabel) {
      return `<span class="ss-economy-item-icon has-image"><img src="${escapeHtml(assetPath(icon))}" alt="" loading="lazy" decoding="async" onerror="this.closest('.ss-economy-item-icon')?.classList.add('is-unavailable'); this.remove();" /><span class="ss-economy-item-icon-fallback">Preview unavailable</span></span>`;
    }
    return `<span class="ss-economy-item-icon" title="${escapeHtml(fallbackLabel || "No icon configured")}" aria-label="${escapeHtml(fallbackLabel || "No icon configured")}">${escapeHtml((itemLabel(item) || "?").slice(0, 1).toUpperCase())}</span>`;
  }

  function firstPresent(...values) {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        if (value.length) return value;
        continue;
      }
      if (typeof value === "object") return value;
      const stringValue = text(value);
      if (stringValue) return value;
    }
    return "";
  }

  function detailValue(value) {
    if (value === true) return "Yes";
    if (value === false) return "No";
    if (Array.isArray(value)) return value.map(detailValue).filter(Boolean).join(", ");
    if (value && typeof value === "object") {
      return Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && text(entryValue))
        .map(([key, entryValue]) => `${formatLabel(key)}: ${detailValue(entryValue)}`)
        .join(" / ");
    }
    if (typeof value === "number") return formatNumber(value);
    return text(value);
  }

  function itemDetailModel(item = {}, kind = "item") {
    const definition = item.definition || itemDefinitionFor(item.item_code) || {};
    const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
    const publicCopy = item.public_copy && typeof item.public_copy === "object" ? item.public_copy : {};
    const title = text(firstPresent(item.label, item.display_name, item.item_name, item.plural_label, definition.label, definition.display_name, item.item_code, item.denomination_code, "Item"));
    const description = text(firstPresent(item.short_description, item.description, definition.short_description, definition.description, publicCopy.short_description, metadata.short_description, item.tooltip_description, definition.tooltip_description));
    const details = text(firstPresent(item.tooltip_public_details, item.tooltip_description, item.public_details, item.details, definition.tooltip_public_details, definition.tooltip_description, publicCopy.tooltip_description, metadata.tooltip_description, item.contextual_public_note, definition.contextual_public_note));
    const code = text(firstPresent(item.item_code, item.denomination_code, item.asset_code, definition.item_code));
    const category = text(firstPresent(item.category_label, item.category, definition.category_label, definition.category, item.item_type, item.type));
    const rarity = text(firstPresent(item.rarity, item.tier, item.grade, definition.rarity, definition.tier, definition.grade));
    const icon = normalizeItemIconPath(firstPresent(item.icon_path, item.icon_url, item.image_asset_key, definition.icon_path, definition.icon_url));
    const chips = [
      kind === "wallet" ? "Wallet" : kind === "market" ? "Market" : kind === "definition" ? "Definition" : "Inventory",
      category ? categoryDisplayLabel(category) : "",
      rarity ? formatLabel(rarity) : ""
    ].filter(Boolean);
    const stats = [];
    const addStat = (label, value) => {
      const formatted = detailValue(value);
      if (formatted) stats.push({ label, value: formatted });
    };
    addStat(kind === "wallet" ? "Count" : "Held", firstPresent(item.count, item.quantity, item.held_quantity));
    addStat("Balance / value", firstPresent(item.value_total_credits, item.balance_total_credits, item.balance_current, item.value_in_credits));
    addStat("Market price", firstPresent(item.market_price_stekels, item.market_price_credits, item.price));
    addStat("Exchange value", firstPresent(item.exchange_value_stekels, item.exchange_value_credits, item.exchange_value));
    addStat("Stock", item.unlimited_stock ? "Unlimited" : firstPresent(item.stock, item.stock_limit, item.max_quantity, item.purchase_limit));
    const meta = [];
    const addMeta = (label, value) => {
      const formatted = detailValue(value);
      if (formatted) meta.push({ label, value: formatted });
    };
    addMeta("Item code", code);
    addMeta("Category / type", category ? categoryDisplayLabel(category) : "");
    addMeta("Rarity / tier", rarity ? formatLabel(rarity) : "");
    addMeta("Chat alias", firstPresent(item.chat_alias, definition.chat_alias, metadata.chat_alias));
    addMeta("Enabled", firstPresent(item.is_enabled, definition.is_enabled, item.public_tooltip_enabled, definition.public_tooltip_enabled));
    addMeta("Sale state", kind === "market" ? (marketEnabled(item) ? "On sale" : "Not sold") : "");
    addMeta("Exchange state", kind === "market" ? (exchangeEnabled(item) ? "Exchange enabled" : "No exchange") : "");
    addMeta("Source", firstPresent(item.source, item.provider, item.origin, item.source_domain, item.source_action));
    addMeta("Version", firstPresent(item.version, item.export_version, item.schema_version, metadata.version));
    addMeta("Updated", firstPresent(item.updated_at, item.modified_at, item.created_at, item.exported_at));
    addMeta("Tags / attributes", firstPresent(item.tags, item.attributes, item.chips, metadata.tags));
    return { title, description, details, icon, chips, stats, meta };
  }

  function renderItemDetailModalContent(item = {}, kind = "item") {
    const model = itemDetailModel(item, kind);
    const iconItem = { ...item, label: model.title, icon_path: model.icon };
    return `
      <div class="ss-economy-item-detail-modal" role="dialog" aria-modal="true" aria-labelledby="economy-item-detail-title" data-item-detail-modal>
        <div class="ss-economy-item-detail-dialog">
          <button class="ss-economy-item-modal-close ss-economy-item-detail-close" type="button" aria-label="Close item detail modal" data-item-detail-close><span aria-hidden="true"></span></button>
          <section class="ss-economy-item-detail-hero">
            ${renderItemIcon(iconItem)}
          </section>
          <section class="ss-economy-item-detail-body">
            <div class="ss-economy-item-detail-chips">${model.chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}</div>
            <h3 id="economy-item-detail-title">${escapeHtml(model.title)}</h3>
            <p>${escapeHtml(model.description || "No public description has been added yet.")}</p>
            ${model.details ? `<p class="ss-economy-item-detail-copy">${escapeHtml(model.details)}</p>` : ""}
            ${model.stats.length ? `<div class="ss-economy-item-detail-stats">${model.stats.map((stat) => `<div><span>${escapeHtml(stat.label)}</span><strong>${escapeHtml(stat.value)}</strong></div>`).join("")}</div>` : ""}
            ${model.meta.length ? `<dl class="ss-economy-item-detail-meta">${model.meta.map((row) => `<dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd>`).join("")}</dl>` : ""}
          </section>
        </div>
      </div>
    `;
  }

  function closeItemDetailModal() {
    const modal = document.querySelector("[data-item-detail-modal]");
    modal?.remove();
    document.body?.classList?.toggle("ss-economy-modal-open", economyOverlayOpen());
    const target = state.itemDetailReturnFocus;
    state.itemDetailReturnFocus = null;
    target?.focus?.({ preventScroll: true });
  }

  function openItemDetailModal(item = {}, kind = "item", sourceElement = null) {
    document.querySelector("[data-item-detail-modal]")?.remove();
    state.itemDetailReturnFocus = sourceElement || document.activeElement;
    const wrap = document.createElement("div");
    wrap.innerHTML = renderItemDetailModalContent(item, kind);
    const modal = wrap.firstElementChild;
    document.body?.appendChild(modal);
    document.body?.classList?.add("ss-economy-modal-open");
    modal.querySelector("[data-item-detail-close]")?.focus?.({ preventScroll: true });
  }

  function resolveItemDetailTarget(trigger) {
    const kind = text(trigger?.dataset?.itemDetailKind || "");
    const code = text(trigger?.dataset?.itemDetailCode || "");
    if (kind === "wallet") {
      const rows = Array.isArray(state.detail?.wallet?.denomination_breakdown) ? state.detail.wallet.denomination_breakdown : [];
      return { kind, item: rows.find((item) => text(item.denomination_code || item.item_code || item.label) === code) || {} };
    }
    if (kind === "inventory") {
      const rows = Array.isArray(state.detail?.inventory) ? state.detail.inventory : [];
      return { kind, item: rows.find((item) => text(item.item_code) === code) || {} };
    }
    if (kind === "market") return { kind, item: state.marketItems.find((item) => text(item.item_code) === code) || {} };
    if (kind === "definition") return { kind, item: state.itemDefinitions.find((item) => text(item.item_code) === code) || {} };
    return { kind: "item", item: {} };
  }

  function eventState(event = {}) {
    if (event.is_reversal || event.reversal_of_event_code) return "reversal";
    if (event.is_reversed || event.reversed_by_event_code) return "reversed";
    return "active";
  }

  function renderEconomyEvent(event = {}) {
    const stateLabel = eventState(event);
    return `
      <article class="ss-economy-event" data-economy-event-code="${escapeHtml(event.economy_event_code)}">
        <div class="ss-economy-event-main">
          <strong>${escapeHtml(event.economy_event_code || "event")}</strong>
          <span class="muted">${escapeHtml(formatLabel(event.event_type))} · ${escapeHtml(event.source_domain || "unknown")}/${escapeHtml(event.source_action || "event")}</span>
          <span>${escapeHtml(event.reason_text || "No reason supplied")}</span>
          <span class="muted">${escapeHtml(event.created_at || "No timestamp")}</span>
        </div>
        <div class="ss-economy-event-side">
          ${renderCreditValue(event.amount_delta || 0, { compact: true })}
          <span class="ss-economy-state ss-economy-state-${escapeHtml(stateLabel)}">${escapeHtml(formatLabel(stateLabel))}</span>
          <span class="muted">After ${formatNumber(event.balance_after || 0)}</span>
          <button class="ss-btn ss-btn-secondary ss-economy-reverse-economy" type="button" data-event-code="${escapeHtml(event.economy_event_code)}" ${stateLabel !== "active" ? "disabled" : ""}>Reverse</button>
        </div>
      </article>
    `;
  }

  function renderInventoryEvent(event = {}) {
    const stateLabel = eventState(event);
    const item = itemDefinitionFor(event.item_code) || { item_code: event.item_code };
    return `
      <article class="ss-economy-event" data-inventory-event-code="${escapeHtml(event.inventory_event_code)}">
        <div class="ss-economy-event-main">
          <strong>${escapeHtml(event.inventory_event_code || "event")}</strong>
          <span class="muted">${escapeHtml(itemLabel(item))} · ${escapeHtml(event.item_code || "item")}</span>
          <span>${escapeHtml(formatLabel(event.event_type))} · ${escapeHtml(event.source_domain || "unknown")}/${escapeHtml(event.source_action || "event")}</span>
          <span>${escapeHtml(event.reason_text || "No reason supplied")}</span>
          <span class="muted">${escapeHtml(event.created_at || "No timestamp")}</span>
        </div>
        <div class="ss-economy-event-side">
          <strong>${formatNumber(event.quantity_delta || 0)}</strong>
          <span class="ss-economy-state ss-economy-state-${escapeHtml(stateLabel)}">${escapeHtml(formatLabel(stateLabel))}</span>
          <span class="muted">After ${formatNumber(event.quantity_after || 0)}</span>
          <button class="ss-btn ss-btn-secondary ss-economy-reverse-inventory" type="button" data-event-code="${escapeHtml(event.inventory_event_code)}" ${stateLabel !== "active" ? "disabled" : ""}>Reverse</button>
        </div>
      </article>
    `;
  }

  function renderIdentities() {
    if (!el.identitiesList) return;
    el.identityCount.textContent = formatNumber(state.identities.length);
    el.identitiesEmpty?.classList.toggle("hidden", state.identities.length > 0);
    const workspace = document.querySelector(".ss-economy-identity-finder");
    workspace?.classList.toggle("is-selector-open", Boolean(state.identitySelectorOpen));
    const pageInfo = pageSlice(state.identities, state.identityPage, state.identityPageSize);
    state.identityPage = pageInfo.page;
    const first = pageInfo.totalItems ? ((pageInfo.page - 1) * state.identityPageSize) + 1 : 0;
    const last = Math.min(pageInfo.totalItems, pageInfo.page * state.identityPageSize);
    el.identitiesList.innerHTML = `
      <div class="ss-economy-identity-selector-head">
        <div>
          <span class="ss-subtitle">Results</span>
          <strong>Identity results</strong>
          <span class="muted">${formatNumber(first)}-${formatNumber(last)} of ${formatNumber(pageInfo.totalItems)} identities</span>
        </div>
        <button class="ss-btn ss-btn-secondary ss-economy-selector-close" type="button" data-identity-selector-close>Close</button>
        <label>Page size<select id="economy-identity-page-size">${identityPageSizeOptions()}</select></label>
      </div>
    ` + pageInfo.items
      .map((entry) => {
        const identity = entry.identity || {};
        const wallet = entry.wallet || {};
        const identityCode = identity.public_identity_code || identity.identity_code || wallet.identity_code || "";
        const displayName = text(identity.display_name || wallet.display_name || identityUserCode(identity, wallet) || identityCode);
        const userCode = identityUserCode(identity, wallet);
        const fallbackCode = identityFallbackCode(identity, wallet);
        const sourceCodes = Array.isArray(entry.source_identity_codes || wallet.source_identity_codes) ? (entry.source_identity_codes || wallet.source_identity_codes) : [];
        const chips = renderPublicIdentityChips(publicIdentityChipItems(identity, { ...wallet, source_identity_codes: sourceCodes }), userCode || displayName);
        const selected = state.selectedIdentityCode === identityCode;
        return `
          <article class="ss-economy-identity${selected ? " is-selected" : ""}" role="button" tabindex="0" data-identity-code="${escapeHtml(identityCode)}">
            ${renderAvatar(identity, wallet)}
            <span class="ss-economy-identity-main">
              <strong>${escapeHtml(displayName)}</strong>
              <span>User code: ${escapeHtml(userCode || "Unclaimed")}</span>
              <span>Public identity: ${escapeHtml(fallbackCode || identityCode)}</span>
              ${chips}
            </span>
            <span class="ss-economy-identity-side">
              ${renderCreditValue(wallet.balance_total_credits ?? wallet.balance_current ?? 0, { compact: true })}
              <span>${formatNumber(entry.inventory_item_count || 0)} items</span>
            </span>
          </article>
        `;
      })
      .join("") + renderPager("identities", pageInfo, "Identity page");
  }

  function selectedIdentityDisplay(detail = state.detail || {}) {
    const identity = detail.identity || {};
    const wallet = detail.wallet || {};
    return text(identity.display_name || wallet.display_name || identityUserCode(identity, wallet) || identityFallbackCode(identity, wallet) || state.selectedIdentityCode || "Selected identity");
  }

  function renderCombinedInventoryItems(inventory = []) {
    const query = text(state.inventorySearch).toLowerCase();
    const filtered = inventory.filter((item) => {
      if (!query) return true;
      const definition = item.definition || itemDefinitionFor(item.item_code) || {};
      return [
        item.item_code,
        item.label,
        definition.label,
        definition.category,
        definition.category_label,
        definition.rarity
      ].map((value) => text(value).toLowerCase()).join(" ").includes(query);
    });
    if (!filtered.length) return `<div class="ss-empty ss-empty-compact">No held inventory rows match this filter.</div>`;
    const cards = filtered.map((item) => {
      const definition = item.definition || itemDefinitionFor(item.item_code) || {};
      const iconSource = { ...definition, ...item, icon_path: itemIcon(item) };
      return `
        <article class="ss-economy-inventory-card" role="button" tabindex="0" data-item-detail-open data-item-detail-kind="inventory" data-item-detail-code="${escapeHtml(item.item_code)}" aria-label="Open ${escapeHtml(itemLabel(item))} details">
          ${renderItemIcon(iconSource)}
          <div class="ss-economy-inventory-card-main">
            <strong>${escapeHtml(itemLabel(item))}</strong>
            <span class="muted">${escapeHtml(item.item_code || "No item code")}</span>
            <span class="ss-economy-item-chip-row">
              <span class="ss-economy-item-chip">Qty ${formatNumber(item.quantity || 0)}</span>
              <span class="ss-economy-item-chip">${escapeHtml(itemCategory(item))}</span>
              ${definition.rarity || item.rarity ? `<span class="ss-economy-item-chip">${escapeHtml(definition.rarity || item.rarity)}</span>` : ""}
            </span>
          </div>
        </article>
      `;
    }).join("");
    return `<div class="${state.inventoryViewMode === "list" ? "ss-economy-inventory-list-view" : "ss-economy-inventory-gallery"}">${cards}</div>`;
  }

  function renderWallet() {
    if (!el.walletInspector) return;
    const detail = state.detail || {};
    const wallet = detail.wallet || null;
    const identity = detail.identity || {};
    if (!wallet) {
      el.walletInspector.className = "ss-economy-inspector ss-empty";
      el.walletInspector.textContent = "Select an identity to inspect wallet and inventory state.";
      return;
    }
    const sourceCodes = Array.isArray(wallet.source_identity_codes) ? wallet.source_identity_codes : [];
    const chips = renderPublicIdentityChips(publicIdentityChipItems(identity, { ...wallet, source_identity_codes: sourceCodes }), identityUserCode(identity, wallet) || identity.display_name || wallet.display_name);
    const inventory = Array.isArray(detail.inventory) ? detail.inventory : [];
    el.walletInspector.className = "ss-economy-inspector";
    el.walletInspector.innerHTML = `
      <section class="ss-economy-selected-identity-summary">
        ${renderAvatar(identity, wallet)}
        <div>
          <strong>${escapeHtml(selectedIdentityDisplay(detail))}</strong>
          <span class="muted">User code: ${escapeHtml(identityUserCode(identity, wallet) || "Unclaimed")}</span>
          <span class="muted">Public identity: ${escapeHtml(identityFallbackCode(identity, wallet))}</span>
          <span class="muted">Account UUID: ${escapeHtml(identity.account_uuid || identity.account_id || wallet.account_uuid || wallet.account_id || "None returned")}</span>
          ${chips}
        </div>
      </section>
      <section class="ss-economy-inspector-panel ss-economy-wallet-panel">
        <div class="ss-economy-browser-header">
          <div>
            <strong>Wallet</strong>
            <span class="muted">Runtime/Auth wallet summary</span>
          </div>
          <div class="ss-inline-actions">
            <button class="ss-btn ss-btn-secondary" type="button" data-audit-drawer-open="ledger">Ledger</button>
            <button class="ss-btn ss-btn-secondary" type="button" data-audit-drawer-open="inventory-events">Inventory Events</button>
          </div>
        </div>
        <div class="ss-economy-kpis">
          <div><span>Total balance</span><strong>${renderWalletMoneyValue(wallet.balance_total_credits ?? wallet.balance_current ?? 0, { prominent: true })}</strong></div>
          <div><span>Cash balance</span><strong>${renderWalletMoneyValue(wallet.cash_balance_credits ?? wallet.balance_current ?? 0)}</strong></div>
          <div><span>Held item value</span><strong>${renderWalletMoneyValue(wallet.held_value_credits ?? 0)}</strong></div>
          <div><span>Earned lifetime</span><strong>${formatNumber(wallet.earned_lifetime || 0)}</strong></div>
          <div><span>Spent lifetime</span><strong>${formatNumber(wallet.spent_lifetime || 0)}</strong></div>
          <div><span>Adjusted total</span><strong>${formatNumber(wallet.adjusted_total || 0)}</strong></div>
          <div><span>Last event</span><strong>${escapeHtml(wallet.last_event_at || "No events")}</strong></div>
        </div>
        ${renderDenominationBreakdown(wallet)}
      </section>
      <section class="ss-economy-inspector-panel ss-economy-inventory-panel">
        <div class="ss-economy-browser-header">
          <div>
            <strong>Inventory</strong>
            <span class="muted">${formatNumber(inventory.length)} positive-quantity held rows</span>
          </div>
          <div class="ss-economy-view-toggle" aria-label="Inventory inspector view">
            <button class="ss-btn ss-btn-secondary ${state.inventoryViewMode === "cards" ? "is-active" : ""}" type="button" data-inspector-inventory-view="cards" aria-pressed="${state.inventoryViewMode === "cards"}">Gallery</button>
            <button class="ss-btn ss-btn-secondary ${state.inventoryViewMode === "list" ? "is-active" : ""}" type="button" data-inspector-inventory-view="list" aria-pressed="${state.inventoryViewMode === "list"}">List</button>
          </div>
        </div>
        <label class="ss-economy-wide">Held item search<input id="economy-inspector-inventory-search" type="search" value="${escapeHtml(state.inventorySearch)}" placeholder="Item code, name, category, rarity" /></label>
        ${renderCombinedInventoryItems(inventory)}
      </section>
    `;
  }

  function exclusionTargetLabel(policy = {}) {
    const type = text(policy.target_type || policy.targetType);
    const id = text(policy.target_id || policy.targetId);
    return `${type === "account" ? "Account" : "Public identity"}: ${id || "not selected"}`;
  }

  function exclusionScopeSet(source) {
    const scopes = Array.isArray(source?.scopes) ? source.scopes : [];
    return new Set(scopes.map(text).filter(Boolean));
  }

  function renderExclusionSwitch(scope, label, active) {
    return `
      <label class="ss-economy-exclusion-switch">
        <span class="switch-button" aria-label="${escapeHtml(label)} toggle">
          <span class="switch-scale">
            <span class="switch-outer">
              <input type="checkbox" data-exclusion-scope="${escapeHtml(scope)}" ${active.has(scope) ? "checked" : ""} />
              <span class="ss-switch-inner">
                <span class="ss-switch-toggle"></span>
                <span class="ss-switch-indicator"></span>
              </span>
            </span>
          </span>
        </span>
        <span class="ss-economy-exclusion-toggle-text">
          <strong>${escapeHtml(label.replace(/^Block\s+/i, ""))}</strong>
          <small>${active.has(scope) ? "Active block" : "Allowed"}</small>
        </span>
      </label>
    `;
  }

  function renderExclusionScopeToggles(activeScopes) {
    const active = activeScopes instanceof Set ? activeScopes : new Set();
    const groups = [
      ["Bot Replies", ["all_bot_replies", "livechat"]],
      ["Counters & Progression", ["all_counters", "xp_progression", "tallies", "leaderboards"]],
      ["Economy & Market", ["wallet_economy", "market_exchange", "games"]],
      ["Modules", ["clips", "clipping", "polls", "wheels"]]
    ];
    const labels = new Map(EXCLUSION_SCOPE_DEFS);
    return groups.map(([group, scopes]) => `
      <fieldset class="ss-economy-exclusion-toggle-group">
        <legend>${escapeHtml(group)}</legend>
        <div class="ss-economy-exclusion-switch-grid">
          ${scopes.filter((scope) => labels.has(scope)).map((scope) => renderExclusionSwitch(scope, labels.get(scope), active)).join("")}
        </div>
      </fieldset>
    `).join("");
  }

  function exclusionTargetChips(items, keys) {
    const source = Array.isArray(items) ? items : [];
    const values = source
      .map((item) => {
        const data = item && typeof item === "object" ? item : {};
        return keys.map((key) => text(data[key])).find(Boolean);
      })
      .filter(Boolean);
    return values.length
      ? values.slice(0, 5).map((value) => `<span class="ss-chip">${escapeHtml(value)}</span>`).join("")
      : `<span class="muted">None reported</span>`;
  }

  function exclusionPolicySummaryText(policy) {
    if (!policy) return "No direct policy saved";
    const scopes = Array.isArray(policy.scopes) ? policy.scopes : [];
    return `${policy.enabled ? "Active" : "Disabled"} · ${scopes.length ? scopes.map(formatLabel).join(", ") : "No scopes"}`;
  }

  function renderExclusionTargetAvatar(target) {
    const name = text(target?.display_name || target?.username || target?.label || target?.target_id || "?");
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
    return target?.avatar_url
      ? `<span class="ss-economy-exclusion-avatar"><img src="${escapeHtml(target.avatar_url)}" alt="" loading="lazy" /></span>`
      : `<span class="ss-economy-exclusion-avatar" aria-hidden="true">${escapeHtml(initials)}</span>`;
  }

  function renderExclusionTargetResult(candidate, index) {
    const publicIds = Array.isArray(candidate.attached_public_identities) ? candidate.attached_public_identities : [];
    const accounts = Array.isArray(candidate.attached_accounts) ? candidate.attached_accounts : [];
    const attached = candidate.target_type === "account"
      ? `${publicIds.length} public ID${publicIds.length === 1 ? "" : "s"}`
      : accounts.length ? `Attached to ${accounts[0]?.display_name || accounts[0]?.user_code || accounts[0]?.account_id}` : "No attached account";
    return `
      <button class="ss-economy-exclusion-result" type="button" data-exclusion-target-index="${index}">
        ${renderExclusionTargetAvatar(candidate)}
        <span class="ss-economy-exclusion-result-main">
          <strong>${escapeHtml(candidate.display_name || candidate.label || candidate.username || candidate.target_id)}</strong>
          <small>${escapeHtml(candidate.public_identity_code || candidate.user_code || candidate.account_uuid || candidate.target_id)}</small>
          <small>${escapeHtml(attached)}</small>
        </span>
        <span class="ss-chip">${escapeHtml(candidate.target_type === "account" ? "Account" : "Public ID")}</span>
      </button>
    `;
  }

  function renderExclusionSearchResults(stateSlice) {
    const results = Array.isArray(stateSlice.searchResults) ? stateSlice.searchResults : [];
    if (stateSlice.searchLoading) {
      return `<div class="ss-economy-exclusion-results"><div class="ss-empty ss-empty-compact">Searching Runtime/Auth targets...</div></div>`;
    }
    if (stateSlice.searchError) {
      return `<div class="ss-economy-exclusion-results"><div class="ss-empty ss-empty-compact">${escapeHtml(stateSlice.searchError)}</div></div>`;
    }
    if (!text(stateSlice.searchQuery) || text(stateSlice.searchQuery).length < 2) return "";
    return `
      <div class="ss-economy-exclusion-results">
        ${results.length
          ? results.map((candidate, index) => renderExclusionTargetResult(candidate, index)).join("")
          : `<div class="ss-empty ss-empty-compact">No matching accounts or public identities found.</div>`}
      </div>
    `;
  }

  function renderSelectedExclusionTarget(target, effective) {
    if (!target) {
      return `<div class="ss-empty ss-empty-compact">Select a Runtime/Auth target to inspect direct and inherited exclusion context.</div>`;
    }
    const direct = target.direct_policy || null;
    const effectiveScopes = exclusionScopeSet(target.effective || effective || {});
    return `
      <article class="ss-economy-exclusion-context">
        <div class="ss-economy-exclusion-context-head">
          ${renderExclusionTargetAvatar(target)}
          <div>
            <strong>${escapeHtml(target.display_name || target.label || target.username || target.target_id)}</strong>
            <span class="muted">${escapeHtml(target.target_type === "account" ? "Account target" : "Public identity target")}</span>
          </div>
          <span class="ss-chip">${escapeHtml(target.target_type === "account" ? "Account" : "Public ID")}</span>
        </div>
        <div class="ss-economy-exclusion-facts">
          <div><span>Target ID</span><strong>${escapeHtml(target.target_id || "Not selected")}</strong></div>
          <div><span>Account UUID</span><strong>${escapeHtml(target.account_uuid || "None")}</strong></div>
          <div><span>Admin identifier</span><strong>${escapeHtml(target.account_email || target.safe_admin_identifier || "None")}</strong></div>
          <div><span>User code</span><strong>${escapeHtml(target.user_code || target.username || "None")}</strong></div>
          <div><span>Public ID</span><strong>${escapeHtml(target.public_identity_code || "None")}</strong></div>
          <div><span>Public slug</span><strong>${escapeHtml(target.public_slug || "None")}</strong></div>
        </div>
        <div class="ss-economy-exclusion-linkage">
          <div>
            <strong>Attached accounts</strong>
            <div class="ss-chip-row">${exclusionTargetChips(target.attached_accounts, ["display_name", "user_code", "account_id"])}</div>
          </div>
          <div>
            <strong>Attached public IDs</strong>
            <div class="ss-chip-row">${exclusionTargetChips(target.attached_public_identities, ["public_identity_code", "identity_code", "user_code"])}</div>
          </div>
        </div>
        <div class="ss-economy-exclusion-policy-line">
          <span>Direct policy</span>
          <strong>${escapeHtml(exclusionPolicySummaryText(direct))}</strong>
        </div>
        <div class="ss-economy-exclusion-policy-line">
          <span>Effective blocks</span>
          <strong>${effectiveScopes.size ? Array.from(effectiveScopes).map(formatLabel).join(", ") : "No effective blocks"}</strong>
        </div>
        <div class="ss-economy-exclusion-policy-line">
          <span>Last updated / note</span>
          <strong>${escapeHtml(direct?.updated_at || direct?.updated_by || direct?.reason || "None supplied")}</strong>
        </div>
      </article>
    `;
  }

  function renderExclusionPolicySummary(label, policy) {
    if (!policy) {
      return `
        <article class="ss-economy-event">
          <div class="ss-economy-event-main">
            <strong>${escapeHtml(label)}</strong>
            <span class="muted">No direct policy saved.</span>
          </div>
        </article>
      `;
    }
    const scopes = Array.isArray(policy.scopes) ? policy.scopes : [];
    return `
      <article class="ss-economy-event">
        <div class="ss-economy-event-main">
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(exclusionTargetLabel(policy))}</span>
          <span class="muted">${policy.enabled ? "Active" : "Disabled"} · ${scopes.length ? scopes.map(formatLabel).join(", ") : "No scopes"}</span>
          <span>${escapeHtml(policy.reason || "No admin note")}</span>
        </div>
      </article>
    `;
  }

  function policyDisplayName(policy = {}) {
    return text(policy.display_name || policy.label || policy.user_code || policy.public_identity_code || policy.account_uuid || policy.target_id || policy.targetId);
  }

  function renderExistingExclusionPolicies(stateSlice) {
    const query = text(stateSlice.policySearch).toLowerCase();
    const policies = (Array.isArray(stateSlice.policies) ? stateSlice.policies : []).filter((policy) => {
      if (!query) return true;
      return [
        policy.target_type,
        policy.target_id,
        policy.display_name,
        policy.label,
        policy.user_code,
        policy.public_identity_code,
        policy.account_uuid,
        policy.reason,
        ...(Array.isArray(policy.scopes) ? policy.scopes : [])
      ].map(text).join(" ").toLowerCase().includes(query);
    });
    return `
      <section class="ss-economy-exclusion-existing">
        <div class="ss-economy-browser-header">
          <div>
            <strong>Existing blocking policies</strong>
            <span class="muted">${formatNumber(policies.length)} visible of ${formatNumber((stateSlice.policies || []).length)} returned</span>
          </div>
          <label>Filter policies<input id="economy-exclusion-policy-search" value="${escapeHtml(stateSlice.policySearch || "")}" placeholder="Target, user code, scope, note" /></label>
        </div>
        <div class="ss-economy-exclusion-policy-list">
          ${policies.length ? policies.map((policy, index) => {
            const scopes = Array.isArray(policy.scopes) ? policy.scopes : [];
            const displayName = policyDisplayName(policy);
            return `
              <article class="ss-economy-exclusion-policy-card">
                <div class="ss-economy-exclusion-context-head">
                  ${renderExclusionTargetAvatar(policy)}
                  <div>
                    <strong>${escapeHtml(displayName || exclusionTargetLabel(policy))}</strong>
                    <span class="muted">${escapeHtml(policy.target_id || policy.targetId || "No target ID")}</span>
                  </div>
                  <span class="ss-chip">${escapeHtml(text(policy.target_type) === "account" ? "Account" : "Public ID")}</span>
                </div>
                <div class="ss-economy-exclusion-policy-meta">
                  <span>${escapeHtml(scopes.length ? scopes.map(formatLabel).join(", ") : "No scopes")}</span>
                  <span>${escapeHtml(policy.inherited ? "Inherited" : "Direct")}</span>
                  <span>${escapeHtml(policy.updated_at || policy.updated_by || "No timestamp")}</span>
                </div>
                <p class="muted">${escapeHtml(policy.reason || "No admin note")}</p>
                <button class="ss-btn ss-btn-secondary" type="button" data-exclusion-policy-target-type="${escapeHtml(policy.target_type || policy.targetType || "public_identity")}" data-exclusion-policy-target-id="${escapeHtml(policy.target_id || policy.targetId || "")}">Load/Edit</button>
              </article>
            `;
          }).join("") : `<div class="ss-empty ss-empty-compact">No existing participation exclusion policies match this filter.</div>`}
        </div>
      </section>
    `;
  }

  function renderParticipationPolicyModal(stateSlice, selectedTarget, effective, policy, activeScopes) {
    if (!stateSlice.policyModalOpen) return "";
    const targetType = text(stateSlice.targetType || "public_identity");
    const targetId = text(stateSlice.targetId || "");
    const effectiveScopes = exclusionScopeSet(effective);
    const inherited = effective.inherited_from_account ? "Inherited account policy applies to this public identity." : "No inherited account policy reported.";
    const target = selectedTarget || { target_type: targetType, target_id: targetId };
    return `
      <div class="ss-economy-item-editor-modal ss-economy-policy-modal" role="dialog" aria-modal="true" aria-labelledby="economy-policy-modal-title" data-policy-modal>
        <div class="ss-economy-item-editor-dialog ss-economy-policy-dialog">
          <header class="ss-economy-item-editor-head">
            <div class="ss-economy-item-editor-title">
              ${renderExclusionTargetAvatar(target)}
              <div>
                <span class="ss-subtitle">Participation Policy</span>
                <h3 id="economy-policy-modal-title">${escapeHtml(selectedTarget?.display_name || selectedTarget?.label || selectedTarget?.username || targetId || "Selected target")}</h3>
                <code>${escapeHtml(targetType === "account" ? "Account" : "Public identity")}: ${escapeHtml(targetId || "No target selected")}</code>
                <span class="ss-economy-item-editor-chip-row">
                  ${renderEditorChip("Direct", exclusionPolicySummaryText(policy))}
                  ${renderEditorChip("Effective", effectiveScopes.size ? `${formatNumber(effectiveScopes.size)} active` : "No active blocks")}
                </span>
              </div>
            </div>
            <button class="ss-economy-item-modal-close" type="button" aria-label="Close participation policy editor" data-policy-modal-close><span aria-hidden="true"></span></button>
          </header>
          <div class="ss-economy-item-editor-body">
            <div class="ss-economy-policy-modal-body">
              <section class="ss-economy-exclusion-summary-grid">
                ${renderExclusionPolicySummary("Direct policy", policy)}
                ${renderExclusionPolicySummary("Inherited account policy", effective.account_policy)}
                <article class="ss-economy-event">
                  <div class="ss-economy-event-main">
                    <strong>Effective summary</strong>
                    <span>${effectiveScopes.size ? Array.from(effectiveScopes).map(formatLabel).join(", ") : "No effective blocks"}</span>
                    <span class="muted">${escapeHtml(inherited)}</span>
                  </div>
                </article>
              </section>
              <input id="economy-exclusion-target-type" type="hidden" value="${escapeHtml(targetType)}" />
              <input id="economy-exclusion-target-id" type="hidden" value="${escapeHtml(targetId)}" />
              <div class="ss-economy-exclusion-toggles">
                ${renderExclusionScopeToggles(activeScopes)}
              </div>
              <label class="ss-economy-wide">Admin note
                <input id="economy-exclusion-reason" value="${escapeHtml(stateSlice.reason || policy?.reason || "")}" placeholder="Reason or admin note" />
              </label>
              <span class="muted">${escapeHtml(stateSlice.error || (stateSlice.loading ? "Loading policy..." : ""))}</span>
            </div>
          </div>
          <footer class="ss-economy-item-editor-foot">
            <button class="ss-btn ss-btn-secondary" type="button" data-policy-modal-close>Cancel</button>
            <button class="ss-btn ss-btn-danger" type="button" id="economy-exclusion-clear" ${targetId && !stateSlice.saving ? "" : "disabled"}>Clear policy</button>
            <button class="ss-btn" type="button" id="economy-exclusion-save" ${targetId && !stateSlice.saving ? "" : "disabled"}>Save policy</button>
          </footer>
        </div>
      </div>
    `;
  }

  function renderParticipationExclusions() {
    if (!el.participationExclusions) return;
    const stateSlice = state.participationExclusions;
    const effective = stateSlice.effective || {};
    const selectedTarget = stateSlice.selectedTarget || null;
    const direct = stateSlice.current || selectedTarget?.direct_policy || {};
    const activeScopes = exclusionScopeSet(direct.policy || direct);
    const effectiveScopes = exclusionScopeSet(effective);
    const targetType = text(stateSlice.targetType || "public_identity");
    const targetId = text(stateSlice.targetId || (state.selectedIdentityCode && targetType === "public_identity" ? state.selectedIdentityCode : ""));
    const policy = direct.policy || (direct.target_id ? direct : null);
    const inherited = effective.inherited_from_account ? "Inherited account policy applies to this public identity." : "No inherited account policy reported.";
    const policies = Array.isArray(stateSlice.policies) ? stateSlice.policies : [];
    el.participationExclusions.className = "ss-economy-actions ss-economy-exclusion-governance";
    el.participationExclusions.innerHTML = `
      <div class="ss-economy-exclusion-layout">
        <section class="ss-economy-exclusion-target-panel">
          <div class="ss-economy-browser-header">
            <div>
              <strong>Target</strong>
              <span class="muted">Search Runtime/Auth accounts and public identities</span>
            </div>
            <button class="ss-btn ss-btn-secondary" type="button" id="economy-exclusion-use-selected" ${state.selectedIdentityCode ? "" : "disabled"}>Use selected identity</button>
          </div>
          <label>Target search
            <input id="economy-exclusion-target-search" value="${escapeHtml(stateSlice.searchQuery || "")}" placeholder="Search public ID, user code, UUID, username, display name, or slug" autocomplete="off" />
            ${renderExclusionSearchResults(stateSlice)}
          </label>
          <div class="ss-economy-exclusion-target-fields">
            <label>Target type
              <select id="economy-exclusion-target-type-main">
                <option value="public_identity" ${targetType === "public_identity" ? "selected" : ""}>Public identity</option>
                <option value="account" ${targetType === "account" ? "selected" : ""}>Account</option>
              </select>
            </label>
            <label>Target ID
              <input id="economy-exclusion-target-id-main" value="${escapeHtml(targetId)}" placeholder="${targetType === "account" ? "Account UUID" : "Public identity code"}" />
            </label>
            <button class="ss-btn ss-btn-secondary" type="button" id="economy-exclusion-load">Load policy</button>
          </div>
          ${renderSelectedExclusionTarget(selectedTarget, effective)}
        </section>
        ${renderExistingExclusionPolicies(stateSlice)}
        <section class="ss-economy-exclusion-selected-panel">
          <div class="ss-economy-browser-header">
            <div>
              <strong>Selected target policy</strong>
              <span class="muted">${escapeHtml(inherited)}</span>
            </div>
            <span class="ss-chip">${effectiveScopes.size ? `${formatNumber(effectiveScopes.size)} active` : "No active blocks"}</span>
          </div>
          <p class="muted">Use the dedicated policy editor modal to change blocking scopes. The main page remains a target finder and policy browser.</p>
          <div class="ss-economy-exclusion-policy-line">
            <span>Direct policy</span>
            <strong>${escapeHtml(exclusionPolicySummaryText(policy))}</strong>
          </div>
          <button class="ss-btn" type="button" id="economy-exclusion-edit-policy" ${targetId ? "" : "disabled"}>Edit policy</button>
        </section>
      </div>
      ${renderParticipationPolicyModal(stateSlice, selectedTarget, effective, policy, activeScopes)}
    `;
    document.body?.classList?.toggle("ss-economy-modal-open", economyOverlayOpen());
  }

  function renderInventory() {
    if (!el.inventoryList) return;
    el.inventoryList.innerHTML = "";
  }

  function renderEvents() {
    document.querySelectorAll("[data-audit-drawer]").forEach((panel) => {
      const open = panel.dataset.auditDrawer === state.auditDrawer;
      panel.classList.toggle("is-open", open);
      panel.setAttribute("aria-hidden", String(!open));
    });
    document.body?.classList?.toggle("ss-economy-modal-open", economyOverlayOpen());
    const detail = state.detail || {};
    const economyEvents = Array.isArray(detail.economy_events) ? detail.economy_events : [];
    const inventoryEvents = Array.isArray(detail.inventory_events) ? detail.inventory_events : [];
    const economyPage = pageSlice(economyEvents, state.economyEventPage, EVENT_PAGE_SIZE);
    const inventoryPage = pageSlice(inventoryEvents, state.inventoryEventPage, EVENT_PAGE_SIZE);
    state.economyEventPage = economyPage.page;
    state.inventoryEventPage = inventoryPage.page;
    el.ledgerList.innerHTML = economyEvents.length
      ? economyPage.items.map(renderEconomyEvent).join("") + renderPager("economy-events", economyPage, "Ledger page")
      : `<div class="ss-empty ss-empty-compact">No economy ledger events yet.</div>`;
    el.inventoryEventsList.innerHTML = inventoryEvents.length
      ? inventoryPage.items.map(renderInventoryEvent).join("") + renderPager("inventory-events", inventoryPage, "Inventory event page")
      : `<div class="ss-empty ss-empty-compact">No inventory history events yet.</div>`;
  }

  function renderEconomySettings() {
    if (!el.settingsForm) return;
    const settings = state.economySettings || {};
    el.settingsForm.className = "ss-economy-actions";
    el.settingsForm.innerHTML = `
      <div class="ss-economy-action-grid ss-economy-settings-grid">
        <label>Currency unit label<input id="economy-setting-label" type="text" value="${escapeHtml(settings.currency_unit_label || "Credit")}" /></label>
        <label>Plural label<input id="economy-setting-plural" type="text" value="${escapeHtml(settings.currency_unit_plural_label || "Credits")}" /></label>
        <label class="ss-economy-wide">Currency symbol path<input id="economy-setting-symbol" type="text" value="${escapeHtml(settings.currency_symbol_path || "assets/games/currencyunit.svg")}" /></label>
        <label class="ss-economy-wide">Reason<input id="economy-setting-reason" type="text" placeholder="Required settings update note" /></label>
        <button id="economy-setting-submit" class="ss-btn" type="button">Save economy settings</button>
      </div>
    `;
  }

  function renderDenominations() {
    if (!el.denominationsList) return;
    const denominations = Array.isArray(state.denominations) ? state.denominations : [];
    el.denominationsList.innerHTML = denominations.length
      ? denominations.map((item) => {
        const isEditing = state.denominationEditorCode === item.denomination_code;
        const errors = state.denominationErrors[item.denomination_code] || {};
        const linkedItem = item.item_code ? itemDefinitionFor(item.item_code) : null;
        const assetKey = normalizeItemIconPath(item.image_asset_key || item.icon_path || "");
        return `
          <article class="ss-economy-denomination-row${isEditing ? " is-editing" : ""}" data-denomination-code="${escapeHtml(item.denomination_code)}">
            ${renderItemIcon({ label: item.label, icon_path: item.icon_path })}
            <div class="ss-economy-denomination-main">
              <strong>${escapeHtml(item.label || item.denomination_code)}</strong>
              <span class="muted">${escapeHtml(item.denomination_code)} · ${formatNumber(item.value_in_credits || 0)} ${escapeHtml(currencyPluralLabel(item.value_in_credits || 0))}</span>
              <span class="muted">${item.always_show_in_balance ? "Always shown in balance" : "Shown only when nonzero"} · ${item.is_high_value_unit ? "High-value unit" : "Base unit"} · ${item.is_enabled ? "Enabled" : "Disabled"}</span>
              <span class="muted ss-economy-item-path">${escapeHtml(assetKey || "No image asset configured")}</span>
              ${linkedItem ? `<span class="ss-economy-item-chip">Linked item: ${escapeHtml(linkedItem.item_code)}</span>` : ""}
              ${fieldErrorText(errors, "payload") ? `<span class="ss-field-error">${escapeHtml(fieldErrorText(errors, "payload"))}</span>` : ""}
            </div>
            <span class="ss-economy-state ${item.is_enabled ? "ss-economy-state-active" : "ss-economy-state-reversed"}">${escapeHtml(item.is_enabled ? "Enabled" : "Disabled")}</span>
            <button class="ss-btn ss-btn-secondary ss-economy-denomination-edit" type="button" data-denomination-code="${escapeHtml(item.denomination_code)}">${isEditing ? "Close" : "Edit Icon"}</button>
            ${
              isEditing
                ? `<div class="ss-economy-item-editor ss-economy-denomination-editor">
                    <section class="ss-economy-item-editor-card ss-economy-icon-card">
                      ${renderDenominationIconPathControl(item)}
                    </section>
                    <section class="ss-economy-item-editor-card">
                      <label class="ss-economy-wide">Reason<input data-denomination-field="reason_text" placeholder="Required before save" /></label>
                      <span class="ss-field-error">${escapeHtml(fieldErrorText(errors, "reason_text"))}</span>
                      <button class="ss-btn ss-economy-denomination-save" type="button" data-denomination-code="${escapeHtml(item.denomination_code)}">Save icon</button>
                    </section>
                  </div>`
                : ""
            }
          </article>
        `;
      }).join("")
      : `<div class="ss-empty">No denomination definitions returned by runtime.</div>`;
  }

  function renderActions() {
    const identityCode = state.selectedIdentityCode;
    if (!identityCode) {
      el.economyActions.className = "ss-economy-actions ss-empty";
      el.economyActions.textContent = "Select an identity to apply manual economy controls.";
      el.inventoryActions.className = "ss-economy-actions ss-empty";
      el.inventoryActions.textContent = "Select an identity to apply manual inventory controls.";
      if (el.exchangeActions) {
        el.exchangeActions.className = "ss-economy-actions ss-empty";
        el.exchangeActions.textContent = "Select an identity with held gems or diamonds to exchange.";
      }
      return;
    }
    el.economyActions.className = "ss-economy-actions";
    el.economyActions.innerHTML = `
      <div class="ss-economy-action-grid">
        <label>Action<select id="economy-action-type"><option value="grant">Grant</option><option value="penalty">Penalty</option><option value="adjustment">Adjustment</option></select></label>
        <label>Amount<input id="economy-action-amount" type="number" step="1" value="0" /></label>
        <label class="ss-economy-wide">Reason<input id="economy-action-reason" type="text" placeholder="Required manual action note" /></label>
        <button id="economy-action-submit" class="ss-btn" type="button">Apply economy action</button>
      </div>
      <div class="ss-economy-reversal-box">
        <label>Selected event code<input id="economy-reversal-code" type="text" placeholder="eco_..." /></label>
        <label>Reversal reason<input id="economy-reversal-reason" type="text" placeholder="Required reversal note" /></label>
        <button id="economy-reversal-submit" class="ss-btn ss-btn-secondary" type="button">Create economy reversal</button>
      </div>
    `;
    el.inventoryActions.className = "ss-economy-actions";
    const selectedInventoryItem = manualInventorySelectedItem() || state.itemDefinitions[0] || {};
    if (!state.manualInventorySearch) state.manualInventorySearch = text(selectedInventoryItem.label || selectedInventoryItem.display_name || selectedInventoryItem.item_code);
    el.inventoryActions.innerHTML = `
      <div class="ss-economy-action-grid">
        <label>Action<select id="inventory-action-type"><option value="grant">Grant</option><option value="remove">Remove</option><option value="adjustment">Adjust</option></select></label>
        <label class="ss-economy-item-picker-label">Item search
          <input id="inventory-action-item-search" type="search" value="${escapeHtml(state.manualInventorySearch)}" placeholder="Search name, code, category, rarity, alias" autocomplete="off" role="combobox" aria-controls="inventory-action-item-suggestions" aria-expanded="${state.manualInventorySuggestionsOpen ? "true" : "false"}" />
          <div id="inventory-action-item-suggestions" class="ss-economy-item-picker-results" role="listbox" ${state.manualInventorySuggestionsOpen ? "" : "hidden"}></div>
        </label>
        <label>Item<select id="inventory-action-item">${state.itemDefinitions.map((item) => `<option value="${escapeHtml(item.item_code)}" ${item.item_code === selectedInventoryItem.item_code ? "selected" : ""}>${escapeHtml(item.item_code)} - ${escapeHtml(item.label || item.item_code)}</option>`).join("")}</select></label>
        <label>Quantity<input id="inventory-action-quantity" type="number" step="1" value="0" /></label>
        <label class="ss-economy-wide">Reason<input id="inventory-action-reason" type="text" placeholder="Required manual action note" /></label>
        <button id="inventory-action-submit" class="ss-btn" type="button">Apply inventory action</button>
      </div>
      <div id="inventory-action-item-preview" class="ss-economy-manual-item-preview" aria-live="polite"></div>
      <div class="ss-economy-reversal-box">
        <label>Selected event code<input id="inventory-reversal-code" type="text" placeholder="inv_..." /></label>
        <label>Reversal reason<input id="inventory-reversal-reason" type="text" placeholder="Required reversal note" /></label>
        <button id="inventory-reversal-submit" class="ss-btn ss-btn-secondary" type="button">Create inventory reversal</button>
      </div>
    `;
    renderManualInventorySuggestions();
    renderManualInventoryPreview();
    renderExchangeActions();
  }

  function renderExchangeActions() {
    if (!el.exchangeActions) return;
    const exchangeable = Array.isArray(state.detail?.exchangeable_items)
      ? state.detail.exchangeable_items.filter((item) => Number(item?.quantity || 0) > 0)
      : [];
    if (!state.selectedIdentityCode) {
      el.exchangeActions.className = "ss-economy-actions ss-empty";
      el.exchangeActions.textContent = "Select an identity with held gems or diamonds to exchange.";
      return;
    }
    if (!exchangeable.length) {
      el.exchangeActions.className = "ss-economy-actions ss-empty";
      el.exchangeActions.textContent = "No exchangeable held gems or diamonds were returned for this identity.";
      return;
    }
    el.exchangeActions.className = "ss-economy-actions";
    const options = exchangeable.map((item) => `
      <option value="${escapeHtml(item.item_code)}" data-value-credits="${escapeHtml(item.value_in_credits || 0)}" data-quantity="${escapeHtml(item.quantity || 0)}">
        ${escapeHtml(item.label || item.item_code)} - ${formatNumber(item.quantity || 0)} held
      </option>
    `).join("");
    el.exchangeActions.innerHTML = `
      <div class="ss-alert">
        Gems and diamonds cannot be purchased here. This control only exchanges value-bearing items already held by the selected identity.
      </div>
      <div class="ss-economy-action-grid ss-economy-exchange-grid">
        <label>Held item<select id="economy-exchange-item">${options}</select></label>
        <label>Quantity<input id="economy-exchange-quantity" type="number" min="1" step="1" value="1" /></label>
        <div class="ss-economy-exchange-preview"><span>Credit value</span><strong id="economy-exchange-value">0</strong></div>
        <label class="ss-economy-wide">Reason<input id="economy-exchange-reason" type="text" placeholder="Required exchange note" /></label>
        <button id="economy-exchange-submit" class="ss-btn" type="button">Exchange held item</button>
      </div>
    `;
    syncExchangePreview();
  }

  function filteredMarketItems() {
    const query = text(state.marketSearch).toLowerCase();
    return (Array.isArray(state.marketItems) ? state.marketItems : []).filter((item) => {
      const haystack = [
        item.item_code,
        item.label,
        item.display_name,
        item.market_label,
        item.short_label,
        item.category,
        item.item_type,
        item.type
      ].map((value) => text(value).toLowerCase()).join(" ");
      if (query && !haystack.includes(query)) return false;
      if (state.marketFilters.purchasable && !marketEnabled(item)) return false;
      if (state.marketFilters.exchangeable && !exchangeEnabled(item)) return false;
      if (state.marketFilters.disabled && item.is_enabled !== false && marketEnabled(item)) return false;
      return true;
    });
  }

  function renderMarketGovernanceModal() {
    const item = state.marketEditorCode
      ? state.marketItems.find((candidate) => text(candidate.item_code) === state.marketEditorCode)
      : null;
    if (!item) return "";
    const icon = normalizeItemIconPath(item.icon_path || item.icon_url || "");
    const type = marketItemType(item);
    const typeLabel = marketItemTypeLabel(item);
    const categoryLabel = categoryDisplayLabel(item.category_label || item.category || type);
    const stock = item.unlimited_stock ? "Unlimited" : item.stock !== null && item.stock !== undefined ? formatNumber(item.stock) : "Untracked";
    const description = text(item.short_description || item.tooltip_description || item.description || item.metadata?.short_description || item.metadata?.tooltip_description || "");
    return `
      <div class="ss-economy-item-editor-modal ss-economy-market-modal" role="dialog" aria-modal="true" aria-labelledby="economy-market-editor-title" data-market-modal>
        <div class="ss-economy-item-editor-dialog ss-economy-market-dialog ss-economy-market-row" data-market-item-code="${escapeHtml(item.item_code)}">
          <header class="ss-economy-item-editor-head">
            <div class="ss-economy-item-editor-title">
              <span class="ss-economy-item-icon${icon ? "" : " is-unavailable"}">${icon ? `<img src="${escapeHtml(assetPath(icon))}" alt="" loading="lazy" decoding="async" />` : `<span class="ss-economy-item-icon-fallback">No icon</span>`}</span>
              <div>
                <span class="ss-subtitle">Market Governance</span>
                <h3 id="economy-market-editor-title">${escapeHtml(item.label || item.display_name || item.item_code)}</h3>
                <code>${escapeHtml(item.item_code)}</code>
                <span class="ss-economy-item-editor-chip-row">
                  ${renderEditorChip("Category", categoryLabel)}
                  ${renderEditorChip("Type", typeLabel)}
                  ${renderEditorChip("Sale", marketEnabled(item) ? "On sale" : "Off sale")}
                  ${renderEditorChip("Exchange", exchangeEnabled(item) ? "Exchangeable" : "No exchange")}
                  ${renderEditorChip("Stock", stock)}
                </span>
              </div>
            </div>
            <button class="ss-economy-item-modal-close" type="button" aria-label="Close market governance editor" data-market-modal-close><span aria-hidden="true"></span></button>
          </header>
          <div class="ss-economy-item-editor-body">
            <div class="ss-economy-market-editor-modal-body">
              <section class="ss-economy-item-editor-card">
                <h4>Market Sale Controls</h4>
                <label>Sale status<select data-market-field="market_enabled"><option value="true" ${marketEnabled(item) ? "selected" : ""}>On sale</option><option value="false" ${marketEnabled(item) ? "" : "selected"}>Off sale</option></select></label>
                <label>Sale price<input data-market-field="market_price_stekels" type="number" min="0" step="1" value="${escapeHtml(marketPrice(item))}" /></label>
                <label>Market label<input data-market-field="market_label" value="${escapeHtml(item.market_label || item.short_label || item.label || "")}" /></label>
                <label>Short label<input data-market-field="short_label" value="${escapeHtml(item.short_label || item.market_label || "")}" /></label>
              </section>
              <section class="ss-economy-item-editor-card">
                <h4>Exchange Controls</h4>
                <label>Exchange status<select data-market-field="exchange_enabled"><option value="true" ${exchangeEnabled(item) ? "selected" : ""}>Exchangeable</option><option value="false" ${exchangeEnabled(item) ? "" : "selected"}>No exchange</option></select></label>
                <label>Exchange value<input data-market-field="exchange_value_stekels" type="number" min="0" step="1" value="${escapeHtml(exchangeValue(item))}" /></label>
              </section>
              <section class="ss-economy-item-editor-card">
                <h4>Stock / Availability</h4>
                <label>Availability<select data-market-field="unlimited_stock"><option value="true" ${item.unlimited_stock ? "selected" : ""}>Unlimited stock</option><option value="false" ${item.unlimited_stock ? "" : "selected"}>Track stock</option></select></label>
                <label>Stock<input data-market-field="stock" type="number" min="0" step="1" value="${escapeHtml(item.stock ?? "")}" placeholder="blank for untracked" /></label>
                <label>Stock limit<input data-market-field="stock_limit" type="number" min="0" step="1" value="${escapeHtml(item.stock_limit ?? item.max_quantity ?? "")}" placeholder="optional per-purchase cap" /></label>
              </section>
              <section class="ss-economy-item-editor-card ss-economy-market-reason-card">
                <h4>Admin Reason / Save Note</h4>
                <label class="ss-economy-wide">Reason<input data-market-field="reason_text" placeholder="Required before save" /></label>
              </section>
              <section class="ss-economy-item-editor-card ss-economy-market-context-card">
                <h4>Item Context</h4>
                <div class="ss-economy-market-context-grid">
                  <div><span>Category</span><strong>${escapeHtml(categoryLabel)}</strong></div>
                  <div><span>Rarity</span><strong>${escapeHtml(item.rarity || "No rarity")}</strong></div>
                  <div><span>Icon path</span><strong>${escapeHtml(icon || "No icon configured")}</strong></div>
                </div>
                <div class="ss-economy-icon-preview">${renderIconPreview(icon)}</div>
                <p class="muted">${escapeHtml(description || "No public item description is currently returned for this definition.")}</p>
                <label>Type/category<select data-market-field="item_type">${itemCategoryOptions(type)}</select></label>
              </section>
            </div>
          </div>
          <footer class="ss-economy-item-editor-foot">
            <button class="ss-btn ss-btn-secondary" type="button" data-market-modal-close>Cancel</button>
            <button class="ss-btn" type="button" data-market-save="${escapeHtml(item.item_code)}">Save market controls</button>
          </footer>
        </div>
      </div>
    `;
  }

  function renderMarketGovernance() {
    if (!el.marketGovernance) return;
    const rows = filteredMarketItems();
    const pageInfo = pageSlice(rows, state.marketPage, state.marketPageSize);
    state.marketPage = pageInfo.page;
    const filterSummary = [
      state.marketFilters.purchasable ? "on sale" : "",
      state.marketFilters.exchangeable ? "exchangeable" : "",
      state.marketFilters.disabled ? "disabled/off sale" : ""
    ].filter(Boolean).join(", ");
    el.marketGovernance.innerHTML = `
      <div class="ss-economy-management-toolbar ss-economy-market-toolbar">
        <div class="ss-economy-management-head">
          <div>
            <span class="ss-subtitle">Market authority</span>
            <strong>Market Governance</strong>
            <span class="muted">Sale status, Stekel prices, exchange values, type/category, and stock metadata.</span>
          </div>
          <span class="ss-economy-management-count">${formatNumber(rows.length)} of ${formatNumber(state.marketItems.length)} items${filterSummary ? ` · ${escapeHtml(filterSummary)}` : ""}</span>
        </div>
        <div class="ss-economy-management-search">
          <label>Search items<input id="economy-market-search" type="search" value="${escapeHtml(state.marketSearch)}" placeholder="Item code, display name, or type" /></label>
        </div>
        <div class="ss-economy-market-filter-row">
          <div class="ss-economy-market-filter-group" aria-label="Market filters">
            <label class="ss-economy-market-filter ss-checkbox-wrapper"><input id="economy-market-filter-purchasable" type="checkbox" ${state.marketFilters.purchasable ? "checked" : ""} /><div class="ss-checkbox"></div><span class="ss-checkbox-text">On sale</span></label>
            <label class="ss-economy-market-filter ss-checkbox-wrapper"><input id="economy-market-filter-exchangeable" type="checkbox" ${state.marketFilters.exchangeable ? "checked" : ""} /><div class="ss-checkbox"></div><span class="ss-checkbox-text">Exchangeable</span></label>
            <label class="ss-economy-market-filter ss-checkbox-wrapper"><input id="economy-market-filter-disabled" type="checkbox" ${state.marketFilters.disabled ? "checked" : ""} /><div class="ss-checkbox"></div><span class="ss-checkbox-text">Disabled</span></label>
          </div>
        </div>
        <div class="ss-economy-management-controls ss-economy-browser-controls">
          <div class="ss-economy-management-controls-left">
            <div class="ss-economy-view-toggle" aria-label="Market Governance browser view">
              <button class="ss-btn ss-btn-secondary ${state.marketViewMode === "cards" ? "is-active" : ""}" type="button" data-market-view="cards" aria-pressed="${state.marketViewMode === "cards"}">Card Grid</button>
              <button class="ss-btn ss-btn-secondary ${state.marketViewMode === "list" ? "is-active" : ""}" type="button" data-market-view="list" aria-pressed="${state.marketViewMode === "list"}">List</button>
            </div>
          </div>
          <div class="ss-economy-management-controls-right">
            <button class="ss-btn ss-btn-secondary" type="button" data-bulk-open="market">Bulk edit market</button>
            <label class="ss-economy-item-page-size">Items per page<select id="economy-market-page-size">${marketPageSizeOptions()}</select></label>
          </div>
        </div>
      </div>
      <div class="ss-economy-market-list ${state.marketViewMode === "cards" ? "ss-economy-card-grid" : "ss-economy-list-view"}">
        ${pageInfo.items.map((item) => {
          const icon = normalizeItemIconPath(item.icon_path || item.icon_url || "");
          const type = marketItemType(item);
          const typeLabel = marketItemTypeLabel(item);
          const categoryLabel = categoryDisplayLabel(item.category_label || item.category || type);
          const stock = item.unlimited_stock ? "Unlimited" : item.stock !== null && item.stock !== undefined ? formatNumber(item.stock) : "Untracked";
          return `
            <article class="ss-economy-market-row${state.marketViewMode === "cards" ? " ss-economy-browser-card" : ""}" data-market-item-code="${escapeHtml(item.item_code)}" role="button" tabindex="0" data-item-detail-open data-item-detail-kind="market" data-item-detail-code="${escapeHtml(item.item_code)}" aria-label="Open ${escapeHtml(item.label || item.display_name || item.item_code)} details">
              <div class="ss-economy-market-summary">
                <span class="ss-economy-item-icon${icon ? "" : " is-unavailable"}">${icon ? `<img src="${escapeHtml(assetPath(icon))}" alt="" loading="lazy" decoding="async" />` : `<span class="ss-economy-item-icon-fallback">No icon</span>`}</span>
                <div class="ss-economy-market-main">
                  <strong>${escapeHtml(item.label || item.display_name || item.item_code)}</strong>
                  <span class="muted">item_code: ${escapeHtml(item.item_code)} · ${escapeHtml(typeLabel)} · ${escapeHtml(categoryLabel)}</span>
                  <span class="muted">Sale: ${marketEnabled(item) ? `${formatNumber(marketPrice(item))} Stekels` : "off"} · Exchange: ${exchangeEnabled(item) ? `${formatNumber(exchangeValue(item))} Stekels` : "off"} · Stock: ${escapeHtml(stock)}</span>
                </div>
                <div class="ss-economy-market-flags">
                  <span class="ss-economy-state ${marketEnabled(item) ? "ss-economy-state-active" : ""}">${marketEnabled(item) ? "On sale" : "Not sold"}</span>
                  <span class="ss-economy-state ${exchangeEnabled(item) ? "ss-economy-state-active" : ""}">${exchangeEnabled(item) ? "Exchange" : "No exchange"}</span>
                  <button class="ss-btn ss-btn-secondary" type="button" data-market-edit="${escapeHtml(item.item_code)}">Edit</button>
                </div>
              </div>
            </article>
          `;
        }).join("") || `<div class="ss-empty ss-empty-compact">No market governance items match the current filters.</div>`}
      </div>
      ${renderPager("market", pageInfo, "Market page")}
      ${renderMarketGovernanceModal()}
      ${state.bulkEditor.type === "market" ? renderBulkEditorModal() : ""}
    `;
    document.body?.classList?.toggle("ss-economy-modal-open", economyOverlayOpen());
  }

  function itemDefinitionViewModel(item = {}) {
    const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
    const publicCopy = item.public_copy && typeof item.public_copy === "object" ? item.public_copy : {};
    const metadataPublicCopy = metadata.public_copy && typeof metadata.public_copy === "object" ? metadata.public_copy : {};
    const notes = text(item.metadata_notes || item.admin_notes || item.admin_note || item.save_note || item.reason_text || metadata.notes || metadata.admin_notes || metadata.admin_note || metadata.note || metadata.save_note || "");
    const shortDescription = text(
      item.short_description ||
      item.short_public_description ||
      item.public_short_description ||
      item.description ||
      publicCopy.short_description ||
      publicCopy.short_public_description ||
      metadata.short_description ||
      metadata.short_public_description ||
      metadata.public_short_description ||
      metadata.description ||
      metadataPublicCopy.short_description ||
      metadataPublicCopy.short_public_description ||
      ""
    );
    const tooltipDescription = text(
      item.tooltip_description ||
      item.tooltip_public_description ||
      item.tooltip_public_details ||
      item.public_details ||
      item.details ||
      item.long_description ||
      item.public_description ||
      publicCopy.tooltip_description ||
      publicCopy.tooltip_public_description ||
      publicCopy.tooltip_public_details ||
      publicCopy.public_details ||
      metadata.tooltip_description ||
      metadata.tooltip_public_description ||
      metadata.tooltip_public_details ||
      metadata.public_details ||
      metadata.details ||
      metadata.public_description ||
      metadata.long_description ||
      metadataPublicCopy.tooltip_description ||
      metadataPublicCopy.tooltip_public_description ||
      metadataPublicCopy.tooltip_public_details ||
      metadataPublicCopy.public_details ||
      ""
    );
    const contextualPublicNote = text(item.contextual_public_note || item.contextual_note || item.public_note || publicCopy.contextual_public_note || publicCopy.contextual_note || publicCopy.public_note || metadata.contextual_public_note || metadata.contextual_note || metadata.public_note || metadata.context_note || metadataPublicCopy.contextual_public_note || metadataPublicCopy.contextual_note || metadataPublicCopy.public_note || "");
    const chatAlias = text(item.chat_alias || metadata.chat_alias || "");
    const publicTooltipEnabled = item.public_tooltip_enabled !== false && metadata.public_tooltip_enabled !== false;
    const systemType = text(metadata.system_asset_type || metadata.denomination_code || "");
    return {
      metadata,
      notes,
      shortDescription,
      tooltipDescription,
      contextualPublicNote,
      chatAlias,
      publicTooltipEnabled,
      assetChip: systemType ? (metadata.wallet_balance_unit ? "Currency unit" : "Denomination") : "Inventory item",
      isArchived: item.is_enabled === false,
      normalizedIcon: normalizeItemIconPath(item.icon_path || ""),
      categoryLabel: categoryDisplayLabel(item.category_label || item.category || "Uncategorized"),
      codePrefix: categoryCodePrefix(item.category || ""),
      codeSuffix: itemCodeSuffix(item.item_code)
    };
  }

  function captureItemEditorDraft() {
    const row = document.querySelector(".ss-economy-item-editor-modal .ss-economy-item-definition");
    if (!row || !state.itemEditorCode) return;
    const key = itemEditorKey();
    const existing = state.itemEditorDrafts[key] || {};
    const readMounted = (selector) => {
      const field = row.querySelector(selector);
      return field ? text(field.value) : undefined;
    };
    const mergeMounted = (selectors) => {
      const next = { ...existing };
      Object.entries(selectors).forEach(([field, selector]) => {
        const value = readMounted(selector);
        if (value !== undefined) next[field] = value;
      });
      return next;
    };
    if (state.itemEditorCode === ITEM_CREATE_EDITOR_CODE) {
      state.itemEditorDrafts[key] = mergeMounted({
        label: "#economy-item-create-label",
        category: "#economy-item-create-category",
        rarity: "#economy-item-create-rarity",
        is_enabled: "#economy-item-create-enabled",
        public_tooltip_enabled: "#economy-item-create-public-tooltip",
        chat_alias: "#economy-item-create-chat-alias",
        icon_path: "#economy-item-create-icon",
        short_description: "#economy-item-create-short-description",
        tooltip_description: "#economy-item-create-tooltip-description",
        contextual_public_note: "#economy-item-create-contextual-note",
        metadata_notes: "#economy-item-create-notes",
        reason_text: "#economy-item-create-reason"
      });
      return;
    }
    state.itemEditorDrafts[key] = mergeMounted({
      label: '[data-item-field="label"]',
      category: '[data-item-field="category"]',
      rarity: '[data-item-field="rarity"]',
      is_enabled: '[data-item-field="is_enabled"]',
      public_tooltip_enabled: '[data-item-field="public_tooltip_enabled"]',
      chat_alias: '[data-item-field="chat_alias"]',
      item_code_suffix: '[data-item-field="item_code_suffix"]',
      icon_path: '[data-item-field="icon_path"]',
      short_description: '[data-item-field="short_description"]',
      tooltip_description: '[data-item-field="tooltip_description"]',
      contextual_public_note: '[data-item-field="contextual_public_note"]',
      metadata_notes: '[data-item-field="metadata_notes"]',
      reason_text: '[data-item-field="reason_text"]'
    });
  }

  function createItemEditorDraft() {
    return {
      label: "",
      category: "",
      rarity: "",
      is_enabled: "true",
      public_tooltip_enabled: "true",
      chat_alias: "",
      icon_path: "",
      short_description: "",
      tooltip_description: "",
      contextual_public_note: "",
      metadata_notes: "",
      reason_text: "",
      ...(state.itemEditorDrafts[ITEM_CREATE_EDITOR_CODE] || {})
    };
  }

  function editItemEditorDraft(item = {}, model = itemDefinitionViewModel(item)) {
    return {
      label: text(item.label),
      category: text(item.category),
      rarity: text(item.rarity),
      is_enabled: item.is_enabled === false ? "false" : "true",
      public_tooltip_enabled: model.publicTooltipEnabled ? "true" : "false",
      chat_alias: model.chatAlias,
      item_code_suffix: model.codeSuffix,
      icon_path: model.normalizedIcon,
      short_description: model.shortDescription,
      tooltip_description: model.tooltipDescription,
      contextual_public_note: model.contextualPublicNote,
      metadata_notes: model.notes,
      reason_text: "",
      ...(state.itemEditorDrafts[text(item.item_code)] || {})
    };
  }

  function renderItemEditorNav() {
    const sections = [
      ["details", "Details"],
      ["assets", "Icon & Assets"],
      ["copy", "Public Copy"],
      ["admin", "Admin Notes"]
    ];
    return `
      <nav class="ss-economy-item-editor-nav" aria-label="Item definition editor sections">
        ${sections.map(([section, label]) => {
          const active = state.itemEditorSection === section;
          return `<button class="ss-economy-item-editor-tab${active ? " is-active" : ""}" type="button" data-item-editor-section="${escapeHtml(section)}" aria-pressed="${active ? "true" : "false"}">${escapeHtml(label)}</button>`;
        }).join("")}
      </nav>
    `;
  }

  function renderEditorChip(label, value) {
    if (!text(value)) return "";
    return `<span class="ss-economy-item-editor-chip"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></span>`;
  }

  function renderUnifiedItemEditorFields({ create = false, item = {}, model = {}, draft = {} } = {}) {
    if (create) {
      return {
        details: `
          <section class="ss-economy-item-editor-card ss-economy-item-editor-card--identity">
            <h4>Identity</h4>
            <label>Item name<input id="economy-item-create-label" type="text" value="${escapeHtml(draft.label)}" placeholder="Iron Ore" /><span id="economy-item-create-error-label" class="ss-field-error">${escapeHtml(fieldErrorText(state.itemCreateErrors, "label") || fieldErrorText(state.itemCreateErrors, "item_name"))}</span></label>
            <label>Category<select id="economy-item-create-category">${itemCategoryOptions(draft.category)}</select><span id="economy-item-create-error-category" class="ss-field-error">${escapeHtml(fieldErrorText(state.itemCreateErrors, "category"))}</span></label>
            <label>Rarity<select id="economy-item-create-rarity">${presetOptions(state.rarityPresets, draft.rarity)}</select><span id="economy-item-create-error-rarity" class="ss-field-error">${escapeHtml(fieldErrorText(state.itemCreateErrors, "rarity"))}</span></label>
            <label>Enabled<select id="economy-item-create-enabled"><option value="true" ${draft.is_enabled === "false" ? "" : "selected"}>Enabled</option><option value="false" ${draft.is_enabled === "false" ? "selected" : ""}>Disabled</option></select></label>
            <label>Public tooltip<select id="economy-item-create-public-tooltip"><option value="true" ${draft.public_tooltip_enabled === "false" ? "" : "selected"}>Enabled</option><option value="false" ${draft.public_tooltip_enabled === "false" ? "selected" : ""}>Disabled</option></select></label>
            <label>Chat alias<input id="economy-item-create-chat-alias" type="text" value="${escapeHtml(draft.chat_alias)}" placeholder="lumber" /><span class="muted">Short unique code users can type in livechat, e.g. <code>!buy lumber</code></span><span id="economy-item-create-error-chat_alias" class="ss-field-error">${escapeHtml(fieldErrorText(state.itemCreateErrors, "chat_alias"))}</span></label>
          </section>
          <section class="ss-economy-item-editor-card ss-economy-item-editor-card--code">
            <h4>Item Code</h4>
            <label>Category-derived prefix<span class="ss-economy-code-prefix" id="economy-item-create-prefix">${escapeHtml(categoryCodePrefix(draft.category) || "category")}</span></label>
            <label>Editable suffix<input id="economy-item-create-label-mirror" value="${escapeHtml(draft.label)}" readonly /></label>
            <div class="ss-economy-wide ss-economy-code-preview"><span>Generated full code preview</span><code id="economy-item-code-preview">Select a category and enter an item name.</code><p id="economy-item-code-status" class="muted ss-economy-item-code-status">Runtime/Auth validates the generated code before saving.</p></div>
            <input id="economy-item-create-code" type="hidden" readonly />
            <span id="economy-item-create-error-item_code" class="ss-field-error">${escapeHtml(fieldErrorText(state.itemCreateErrors, "item_code"))}</span>
          </section>
          <section class="ss-economy-item-editor-card ss-economy-icon-card">
            <h4>Icon Summary</h4>
            ${renderIconPathControl({ create: true, value: draft.icon_path })}
          </section>
        `,
        copy: `
          <section class="ss-economy-item-editor-card ss-economy-item-editor-card--copy ss-economy-item-editor-card--wide">
            <h4>Public Copy</h4>
            <label class="ss-economy-wide">Short public description<textarea id="economy-item-create-short-description" rows="5">${escapeHtml(draft.short_description)}</textarea><span id="economy-item-create-error-short_description" class="ss-field-error">${escapeHtml(fieldErrorText(state.itemCreateErrors, "short_description"))}</span></label>
            <label class="ss-economy-wide">Tooltip public details<textarea id="economy-item-create-tooltip-description" rows="8">${escapeHtml(draft.tooltip_description)}</textarea><span id="economy-item-create-error-tooltip_description" class="ss-field-error">${escapeHtml(fieldErrorText(state.itemCreateErrors, "tooltip_description"))}</span></label>
            <label class="ss-economy-wide">Contextual public note<textarea id="economy-item-create-contextual-note" rows="4" placeholder="Optional public-safe context">${escapeHtml(draft.contextual_public_note)}</textarea></label>
            <p class="muted ss-economy-wide">Public fields are saved with the item definition metadata returned by Runtime/Auth and shown by consumer surfaces when available.</p>
          </section>
        `,
        admin: `
          <section class="ss-economy-item-editor-card ss-economy-item-editor-card--admin ss-economy-item-editor-card--wide">
            <h4>Admin Notes</h4>
            <label class="ss-economy-wide">Metadata notes<textarea id="economy-item-create-notes" rows="6">${escapeHtml(draft.metadata_notes)}</textarea></label>
            <label class="ss-economy-wide">Reason<input id="economy-item-create-reason" type="text" value="${escapeHtml(draft.reason_text)}" placeholder="Required creation note" /><span id="economy-item-create-error-reason_text" class="ss-field-error">${escapeHtml(fieldErrorText(state.itemCreateErrors, "reason_text"))}</span></label>
          </section>
        `
      };
    }
    return {
      details: `
        <section class="ss-economy-item-editor-card ss-economy-item-editor-card--identity">
          <h4>Identity</h4>
          <label>Item name<input data-item-field="label" value="${escapeHtml(draft.label)}" /></label>
          <label>Category<select data-item-field="category">${itemCategoryOptions(draft.category)}</select></label>
          <label>Rarity<select data-item-field="rarity">${presetOptions(state.rarityPresets, draft.rarity)}</select></label>
          <label>Enabled<select data-item-field="is_enabled"><option value="true" ${draft.is_enabled === "false" ? "" : "selected"}>Enabled</option><option value="false" ${draft.is_enabled === "false" ? "selected" : ""}>Disabled</option></select></label>
          <label>Public tooltip<select data-item-field="public_tooltip_enabled"><option value="true" ${draft.public_tooltip_enabled === "false" ? "" : "selected"}>Enabled</option><option value="false" ${draft.public_tooltip_enabled === "false" ? "selected" : ""}>Disabled</option></select></label>
          <label>Chat alias<input data-item-field="chat_alias" value="${escapeHtml(draft.chat_alias)}" placeholder="lumber" /><span class="muted">Short unique code users can type in livechat, e.g. <code>!buy lumber</code></span></label>
        </section>
        <section class="ss-economy-item-editor-card ss-economy-item-editor-card--code">
          <h4>Item Code</h4>
          <label>Category-derived prefix<span class="ss-economy-code-prefix" data-item-code-prefix>${escapeHtml(categoryCodePrefix(draft.category) || model.codePrefix || "category")}</span></label>
          <label>Editable suffix<input data-item-field="item_code_suffix" value="${escapeHtml(draft.item_code_suffix)}" autocomplete="off" /></label>
          <div class="ss-economy-wide ss-economy-code-preview"><span>Generated full code preview</span><code data-item-code-preview>${escapeHtml(item.item_code)}</code><p class="muted ss-economy-item-code-status" data-item-code-status>Current item code remains unchanged.</p></div>
          <p class="muted ss-economy-wide">Existing item-code renames remain blocked until Runtime/Auth can safely migrate references.</p>
        </section>
        <section class="ss-economy-item-editor-card ss-economy-icon-card">
          <h4>Icon Summary</h4>
          ${renderIconPathControl({ itemCode: item.item_code, value: draft.icon_path })}
        </section>
      `,
      copy: `
        <section class="ss-economy-item-editor-card ss-economy-item-editor-card--copy ss-economy-item-editor-card--wide">
          <h4>Public Copy</h4>
          <label class="ss-economy-wide">Short public description<textarea data-item-field="short_description" rows="5">${escapeHtml(draft.short_description)}</textarea></label>
          <label class="ss-economy-wide">Tooltip public details<textarea data-item-field="tooltip_description" rows="8">${escapeHtml(draft.tooltip_description)}</textarea></label>
          <label class="ss-economy-wide">Contextual public note<textarea data-item-field="contextual_public_note" rows="4" placeholder="Optional scope, source, or usage context">${escapeHtml(draft.contextual_public_note)}</textarea></label>
          <p class="muted ss-economy-wide">Public copy is passed through the existing item definition save payload without Dashboard-owned fallback text.</p>
        </section>
      `,
      admin: `
        <section class="ss-economy-item-editor-card ss-economy-item-editor-card--admin ss-economy-item-editor-card--wide">
          <h4>Admin Notes</h4>
          <label class="ss-economy-wide">Metadata notes<textarea data-item-field="metadata_notes" rows="6">${escapeHtml(draft.metadata_notes)}</textarea></label>
          <label class="ss-economy-wide">Reason / save note<input data-item-field="reason_text" value="${escapeHtml(draft.reason_text)}" placeholder="Required before save" /></label>
          <div class="ss-alert ss-alert-warning ss-economy-wide">Archive keeps historical inventory rows and disables future purchase flows for this definition.</div>
        </section>
      `
    };
  }

  function renderUnifiedItemEditorBody({ create = false, item = {}, model = {}, draft = {} } = {}) {
    const fields = renderUnifiedItemEditorFields({ create, item, model, draft });
    const active = ["details", "assets", "copy", "admin"].includes(state.itemEditorSection) ? state.itemEditorSection : "details";
    if (active === "assets") {
      if (!state.assetPicker.open || !isItemAssetTarget()) {
        const target = create ? "create" : text(item.item_code);
        state.assetPicker = {
          open: true,
          target,
          selectedPath: normalizeItemIconPath(draft.icon_path),
          filter: state.assetPicker.filter || "",
          mode: /^https?:\/\//i.test(draft.icon_path) ? "custom" : state.assetPicker.mode || "bundled",
          customUrl: /^https?:\/\//i.test(draft.icon_path) ? draft.icon_path : state.assetPicker.customUrl || "",
          definition: state.assetPicker.definition || {},
          editingPath: state.assetPicker.editingPath || "",
          errors: state.assetPicker.errors || {},
          uploadFile: state.assetPicker.uploadFile || null,
          uploadError: state.assetPicker.uploadError || ""
        };
      }
      return `<section class="ss-economy-item-editor-section ss-economy-item-editor-section--assets">${renderAssetPickerSurface({ integrated: true })}</section>`;
    }
    const content = active === "copy" ? fields.copy : active === "admin" ? fields.admin : fields.details;
    return `<section class="ss-economy-item-editor-section ss-economy-item-editor-section--${escapeHtml(active)}">${content}</section>`;
  }

  function renderItemDefinitionModal() {
    if (!state.itemEditorCode) return "";
    const create = state.itemEditorCode === ITEM_CREATE_EDITOR_CODE;
    const item = create ? {} : state.itemDefinitions.find((candidate) => text(candidate.item_code) === state.itemEditorCode);
    if (!create && !item) return "";
    const model = create ? {
      isArchived: false,
      normalizedIcon: normalizeItemIconPath(createItemEditorDraft().icon_path),
      categoryLabel: "Uncategorized",
      codePrefix: "",
      codeSuffix: "",
      chatAlias: "",
      publicTooltipEnabled: true
    } : itemDefinitionViewModel(item);
    const draft = create ? createItemEditorDraft() : editItemEditorDraft(item, model);
    const steps = itemEditorSteps();
    const stepIndex = itemEditorStepIndex();
    const finalStep = stepIndex >= steps.length - 1;
    const createCodeState = create ? generatedItemCodeDraftState(draft) : null;
    const createReady = createCodeState ? Boolean(createCodeState.itemCode && !createCodeState.collision && text(draft.reason_text)) : false;
    const title = create ? (draft.label || "New inventory item") : (draft.label || item.item_code);
    const code = create ? generatedItemCode(draft.category, draft.label).itemCode : item.item_code;
    const iconItem = create
      ? { label: title, icon_path: draft.icon_path, item_code: code }
      : { ...item, label: draft.label, icon_path: draft.icon_path };
    const chipMarkup = [
      renderEditorChip("Category", create ? categoryDisplayLabel(draft.category || "Uncategorized") : categoryDisplayLabel(draft.category || model.categoryLabel)),
      renderEditorChip("Rarity", draft.rarity || "No rarity"),
      renderEditorChip("Status", draft.is_enabled === "false" ? "Disabled" : "Enabled")
    ].join("");
    return `
      <div class="ss-economy-item-editor-modal" role="dialog" aria-modal="true" aria-labelledby="economy-item-editor-title" data-item-modal>
        <div class="ss-economy-item-editor-dialog ss-economy-item-definition${model.isArchived ? " is-archived" : ""}" data-item-code="${escapeHtml(create ? "" : item.item_code)}" data-item-editor-kind="${create ? "create" : "edit"}">
          <header class="ss-economy-item-editor-head">
            <div class="ss-economy-item-editor-title">
              ${renderItemIcon(iconItem)}
              <div>
                <span class="ss-subtitle">${create ? "Create definition" : "Edit item definition"}</span>
                <h3 id="economy-item-editor-title">${escapeHtml(title)}</h3>
                <code>${escapeHtml(code || "Generated after category and name are entered")}</code>
                <span class="ss-economy-item-editor-chip-row">${chipMarkup}</span>
              </div>
            </div>
            <button class="ss-economy-item-modal-close" type="button" aria-label="Close item definition editor" data-item-modal-close><span aria-hidden="true"></span></button>
          </header>
          ${renderItemEditorNav()}
          <div class="ss-economy-item-editor-body">
            ${renderUnifiedItemEditorBody({ create, item, model, draft })}
          </div>
          <footer class="ss-economy-item-editor-foot">
            <button class="ss-btn ss-btn-secondary" type="button" data-item-modal-close>Cancel</button>
            ${stepIndex > 0 ? `<button class="ss-btn ss-btn-secondary" type="button" data-item-editor-step="previous">Previous</button>` : ""}
            ${!finalStep ? `<button class="ss-btn" type="button" data-item-editor-step="next">Next</button>` : ""}
            ${create ? "" : `<button class="ss-btn ss-btn-danger ss-economy-item-delete" type="button" data-item-code="${escapeHtml(item.item_code)}" ${model.isArchived ? `disabled title="This item definition is already archived / disabled."` : ""}>${model.isArchived ? "Archived" : "Archive"}</button>`}
            ${finalStep ? (create ? `<button id="economy-item-create-submit" class="ss-btn" type="button" ${createReady ? "" : "disabled"}>Create item definition</button>` : `<button class="ss-btn ss-economy-item-save" type="button" data-item-code="${escapeHtml(item.item_code)}">Save metadata</button>`) : ""}
          </footer>
        </div>
      </div>
    `;
  }

  function renderItemDefinitions() {
    if (!el.itemDefinitions) return;
    captureItemEditorDraft();
    el.itemCount.textContent = formatNumber(state.itemDefinitions.length);
    const filteredItems = filteredItemDefinitions();
    const pageInfo = pageSlice(filteredItems, state.itemPage, state.itemPageSize);
    state.itemPage = pageInfo.page;
    const itemsMarkup = pageInfo.items
      .map((item) => {
        const model = itemDefinitionViewModel(item);
        const isEditing = state.itemEditorCode === item.item_code;
        return `
          <article class="ss-economy-item-definition${isEditing ? " is-editing" : ""}${model.isArchived ? " is-archived" : ""}${state.itemViewMode === "cards" ? " ss-economy-browser-card" : ""}" data-item-code="${escapeHtml(item.item_code)}" role="button" tabindex="0" data-item-detail-open data-item-detail-kind="definition" data-item-detail-code="${escapeHtml(item.item_code)}" aria-label="Open ${escapeHtml(item.label || item.item_code)} details">
            <div class="ss-economy-item-definition-summary">
              ${renderItemIcon(item)}
              <div class="ss-economy-item-definition-main">
                <strong>${escapeHtml(item.label || item.item_code)}</strong>
                <span class="muted">item_code: ${escapeHtml(item.item_code)} · ${escapeHtml(model.categoryLabel)} · ${escapeHtml(item.rarity || "No rarity")} · ${model.isArchived ? "archived / disabled" : "enabled"}</span>
                ${model.chatAlias ? `<span class="muted">Chat alias: ${escapeHtml(model.chatAlias)}</span>` : ""}
                <span class="ss-economy-item-chip-row">
                  <span class="ss-economy-item-chip">${escapeHtml(model.assetChip)}</span>
                  ${model.isArchived ? `<span class="ss-economy-item-chip ss-economy-item-chip-archived">Archived / Disabled</span>` : ""}
                </span>
                <span class="muted ss-economy-item-path">${escapeHtml(model.normalizedIcon || "No icon configured")}</span>
                ${model.shortDescription ? `<span class="muted ss-economy-item-notes">${escapeHtml(model.shortDescription)}</span>` : model.notes ? `<span class="muted ss-economy-item-notes">${escapeHtml(model.notes)}</span>` : ""}
              </div>
              <div class="ss-inline-actions">
                <button class="ss-btn ss-btn-secondary ss-economy-item-edit" type="button" data-item-code="${escapeHtml(item.item_code)}">${isEditing ? "Editing" : "Edit"}</button>
                <button class="ss-btn ss-btn-danger ss-economy-item-delete" type="button" data-item-code="${escapeHtml(item.item_code)}" ${model.isArchived ? `disabled title="This item definition is already archived / disabled."` : ""}>${model.isArchived ? "Archived" : "Archive"}</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
    el.itemDefinitions.innerHTML = `
      ${renderItemDefinitionsToolbar(pageInfo)}
      <div class="${state.itemViewMode === "cards" ? "ss-economy-card-grid" : "ss-economy-list-view"}">
        ${itemsMarkup || `<div class="ss-empty ss-empty-compact">No item definitions match the current search.</div>`}
      </div>
      ${renderPager("items", pageInfo, "Item page")}
      ${renderItemDefinitionModal()}
      ${state.bulkEditor.type === "inventory" ? renderBulkEditorModal() : ""}
    `;
    document.body?.classList?.toggle("ss-economy-modal-open", economyOverlayOpen());
    document.querySelectorAll(".ss-economy-item-editor-modal .ss-economy-item-definition").forEach((row) => syncItemEditorCodePreview(row));
    if (state.itemEditorCode === ITEM_CREATE_EDITOR_CODE) {
      syncGeneratedItemCodePreview();
      updateItemCreateFieldErrors();
    }
  }

  function renderItemCreateForm() {
    if (!el.itemCreateForm) return;
    el.itemCreateForm.innerHTML = `
      <div class="ss-economy-item-create-shell">
        <header class="ss-economy-item-create-head">
          <div>
            <span class="ss-subtitle">Create definition</span>
            <h3>New inventory item</h3>
          </div>
          <button class="ss-btn" type="button" id="economy-item-create-open">Create item definition</button>
        </header>
        <p class="muted">Create uses the same large item definition editor as card and list edits, with Runtime/Auth-owned validation and save behavior.</p>
      </div>
    `;
  }

  function renderDangerZone() {
    if (!el.dangerZone) return;
    el.dangerZone.innerHTML = `
      <div class="ss-alert ss-alert-danger">
        Export creates a JSON backup of XP, economy, inventory, item definition, and denomination tables. Reset creates append-only correction events to zero selected state; identity/profile records are not changed.
      </div>
      <div class="ss-economy-action-grid">
        <label>Scope<select id="economy-danger-scope"><option value="all">All public game state</option><option value="progression">XP / progression only</option><option value="economy">Wallet economy only</option><option value="inventory">Inventory only</option></select></label>
        <label class="ss-economy-wide">Reason<input id="economy-danger-reason" type="text" placeholder="Required reset reason" /></label>
        <label class="ss-economy-wide">Type RESET PUBLIC GAME STATE<input id="economy-danger-confirmation" type="text" autocomplete="off" /></label>
        <button id="economy-backup-export" class="ss-btn ss-btn-secondary" type="button">Export backup JSON</button>
        <button id="economy-reset-submit" class="ss-btn ss-btn-danger" type="button">Reset selected state</button>
      </div>
    `;
  }

  function activeFieldValue(formSelector, fieldSelector) {
    const form = document.querySelector(formSelector);
    const field = form?.querySelector(fieldSelector);
    return text(field?.value);
  }

  function currentExchangeItem() {
    const itemCode = activeFieldValue("#economy-exchange-actions .ss-economy-exchange-grid", "#economy-exchange-item");
    const exchangeable = Array.isArray(state.detail?.exchangeable_items) ? state.detail.exchangeable_items : [];
    return exchangeable.find((item) => text(item.item_code) === itemCode) || exchangeable[0] || null;
  }

  function syncExchangePreview() {
    const item = currentExchangeItem();
    const quantityInput = $("#economy-exchange-quantity");
    const valueOutput = $("#economy-exchange-value");
    if (!item || !quantityInput || !valueOutput) return;
    const maxQuantity = Math.max(1, Number(item.quantity || 1));
    quantityInput.max = String(maxQuantity);
    const quantity = Math.max(1, Math.min(maxQuantity, Number(quantityInput.value || 1)));
    if (String(quantity) !== String(quantityInput.value)) quantityInput.value = String(quantity);
    valueOutput.textContent = `${formatNumber(quantity * Number(item.value_in_credits || 0))} ${escapeHtml(currencyPluralLabel(quantity * Number(item.value_in_credits || 0)))}`;
  }

  function renderAll() {
    renderEconomySettings();
    renderDenominations();
    renderIdentities();
    renderWallet();
    renderParticipationExclusions();
    renderInventory();
    renderEvents();
    renderActions();
    renderMarketGovernance();
    renderItemDefinitions();
    renderItemCreateForm();
    renderDangerZone();
  }

  async function loadIdentities() {
    const query = text(el.searchInput?.value);
    const payload = await requestJson(`${IDENTITIES}?limit=50${query ? `&q=${encodeURIComponent(query)}` : ""}`);
    state.identities = Array.isArray(payload.identities) ? payload.identities : [];
    state.identityPage = 1;
  }

  async function loadItems() {
    const payload = await requestJson(MARKET_GOVERNANCE);
    state.itemDefinitions = Array.isArray(payload.item_definitions) ? payload.item_definitions : [];
    state.marketItems = Array.isArray(payload.item_definitions) ? payload.item_definitions : [];
    state.itemCategories = Array.isArray(payload.item_categories)
      ? payload.item_categories
      : Array.isArray(payload.category_options)
        ? payload.category_options
        : [];
    state.categoryPresets = Array.isArray(payload.category_presets) ? payload.category_presets : [];
    state.rarityPresets = Array.isArray(payload.rarity_presets) ? payload.rarity_presets : [];
  }

  async function loadParticipationExclusions() {
    const payload = await requestJson(PARTICIPATION_EXCLUSIONS);
    state.participationExclusions.policies = Array.isArray(payload.policies) ? payload.policies : [];
    state.participationExclusions.allowedScopes = Array.isArray(payload.allowed_scopes)
      ? payload.allowed_scopes
      : EXCLUSION_SCOPE_DEFS.map(([scope]) => scope);
  }

  async function searchParticipationExclusionTargets(query) {
    const stateSlice = state.participationExclusions;
    const normalizedQuery = text(query);
    const token = ++stateSlice.searchToken;
    stateSlice.searchQuery = normalizedQuery;
    stateSlice.searchError = "";
    if (normalizedQuery.length < 2) {
      stateSlice.searchResults = [];
      stateSlice.searchLoading = false;
      renderParticipationExclusions();
      return;
    }
    stateSlice.searchLoading = true;
    renderParticipationExclusions();
    try {
      const payload = await requestJson(`${PARTICIPATION_EXCLUSION_TARGET_SEARCH}?q=${encodeURIComponent(normalizedQuery)}&target_type=any&limit=12`, { timeoutMs: 15000 });
      if (token !== stateSlice.searchToken) return;
      stateSlice.searchResults = Array.isArray(payload.items) ? payload.items : [];
      stateSlice.allowedScopes = Array.isArray(payload.allowed_scopes) ? payload.allowed_scopes : stateSlice.allowedScopes;
    } catch (err) {
      if (token !== stateSlice.searchToken) return;
      const message = text(err?.message);
      stateSlice.searchError = /abort/i.test(message)
        ? "Target search timed out before Runtime/Auth responded. Manual target ID still works; try a more exact public ID, user code, account UUID, or slug."
        : message || "Target search failed.";
      stateSlice.searchResults = [];
    } finally {
      if (token === stateSlice.searchToken) {
        stateSlice.searchLoading = false;
        renderParticipationExclusions();
      }
    }
  }

  function scheduleParticipationExclusionTargetSearch(query) {
    const stateSlice = state.participationExclusions;
    stateSlice.searchQuery = text(query);
    if (stateSlice.searchTimer) window.clearTimeout(stateSlice.searchTimer);
    stateSlice.searchTimer = window.setTimeout(() => {
      stateSlice.searchTimer = null;
      searchParticipationExclusionTargets(stateSlice.searchQuery);
    }, 250);
  }

  async function selectParticipationExclusionTarget(candidate) {
    if (!candidate) return;
    state.participationExclusions.selectedTarget = candidate;
    state.participationExclusions.targetType = text(candidate.target_type || "public_identity");
    state.participationExclusions.targetId = text(candidate.target_id);
    state.participationExclusions.searchQuery = text(candidate.label || candidate.display_name || candidate.username || candidate.target_id);
    state.participationExclusions.searchResults = [];
    state.participationExclusions.current = candidate.direct_policy || null;
    state.participationExclusions.effective = candidate.effective || null;
    state.participationExclusions.reason = candidate.direct_policy?.reason || "";
    renderParticipationExclusions();
    await loadParticipationExclusionSummary();
  }

  async function loadParticipationExclusionSummary() {
    const targetType = text($("#economy-exclusion-target-type-main")?.value || $("#economy-exclusion-target-type")?.value || state.participationExclusions.targetType || "public_identity");
    const targetId = text($("#economy-exclusion-target-id-main")?.value || $("#economy-exclusion-target-id")?.value || state.participationExclusions.targetId);
    state.participationExclusions.targetType = targetType;
    state.participationExclusions.targetId = targetId;
    state.participationExclusions.error = "";
    if (!targetType || !targetId) {
      state.participationExclusions.current = null;
      state.participationExclusions.effective = null;
      state.participationExclusions.selectedTarget = null;
      renderParticipationExclusions();
      return;
    }
    state.participationExclusions.loading = true;
    renderParticipationExclusions();
    try {
      const payload = await requestJson(`${PARTICIPATION_EXCLUSIONS_SUMMARY}?target_type=${encodeURIComponent(targetType)}&target_id=${encodeURIComponent(targetId)}`);
      state.participationExclusions.current = payload.effective?.identity_policy || payload.effective?.account_policy || null;
      if (payload.target?.target_type === targetType) {
        state.participationExclusions.current = targetType === "account"
          ? payload.effective?.account_policy
          : payload.effective?.identity_policy;
      }
      state.participationExclusions.selectedTarget = payload.target || state.participationExclusions.selectedTarget;
      state.participationExclusions.effective = payload.effective || null;
      state.participationExclusions.allowedScopes = Array.isArray(payload.allowed_scopes) ? payload.allowed_scopes : state.participationExclusions.allowedScopes;
      state.participationExclusions.reason = state.participationExclusions.current?.reason || "";
    } catch (err) {
      state.participationExclusions.error = err?.message || "Unable to load exclusion policy.";
    } finally {
      state.participationExclusions.loading = false;
      renderParticipationExclusions();
    }
  }

  async function loadEconomyConfig() {
    const [settingsPayload, denominationPayload] = await Promise.all([
      requestJson(ECONOMY_SETTINGS),
      requestJson(ECONOMY_DENOMINATIONS)
    ]);
    state.economySettings = settingsPayload.settings || state.economySettings;
    state.denominations = Array.isArray(denominationPayload.denominations)
      ? denominationPayload.denominations
      : Array.isArray(settingsPayload.denominations)
        ? settingsPayload.denominations
        : [];
  }

  async function loadDetail(identityCode = state.selectedIdentityCode) {
    if (!identityCode) {
      state.detail = null;
      return;
    }
    const payload = await requestJson(`${ECONOMY_DETAIL(identityCode)}?limit=50`);
    state.detail = payload;
    state.selectedIdentityCode = identityCode;
    state.economyEventPage = 1;
    state.inventoryEventPage = 1;
  }

  async function saveAssetDefinitionFromPicker() {
    const definition = readAssetDefinitionDraft("economy-asset-definition");
    if (!definition.path || !definition.label || !definition.category) {
      setStatus("Asset definition requires a path, friendly name, and category.", "error");
      return false;
    }
    const editingPath = normalizeItemIconPath(state.assetPicker.editingPath);
    if (editingPath && !definition.reason_text) {
      setStatus("Editing an asset definition listing requires a reason.", "error");
      return false;
    }
    try {
      const payload = await requestJson(editingPath ? GAME_ASSET_DEFINITION(editingPath) : GAME_ASSET_DEFINITIONS, {
        method: editingPath ? "PATCH" : "POST",
        body: JSON.stringify({ definition, reason_text: definition.reason_text })
      });
      updateAssetStateFromPayload(payload);
      state.assetPicker.selectedPath = definition.path;
      state.assetPicker.definition = {};
      state.assetPicker.editingPath = "";
      state.assetPicker.errors = {};
      setStatus(editingPath ? "Asset definition listing updated." : "Asset definition saved.", "success");
      return true;
    } catch (err) {
      state.assetPicker.errors = fieldErrorMap(err);
      setStatus(err?.message || "Runtime/Auth could not save the asset definition.", "error");
      return false;
    }
  }

  async function removeAssetDefinitionListing(pathValue) {
    const assetPathValue = normalizeItemIconPath(pathValue);
    const reason = text(window.prompt?.("Reason for removing this definition listing? Physical image files are not deleted.", "") || "");
    if (!assetPathValue || !reason) {
      setStatus("Removing an asset definition listing requires a path and reason.", "error");
      return false;
    }
    try {
      const payload = await requestJson(GAME_ASSET_DEFINITION(assetPathValue), {
        method: "DELETE",
        body: JSON.stringify({ reason_text: reason })
      });
      updateAssetStateFromPayload(payload);
      state.assetPicker.selectedPath = "";
      setStatus("Asset definition listing removed. The physical image file was not deleted.", "success");
      return true;
    } catch (err) {
      setStatus(err?.message || "Runtime/Auth could not remove the asset definition listing.", "error");
      return false;
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });
  }

  async function uploadAssetFromPicker() {
    const file = state.assetPicker.uploadFile;
    if (!file) {
      setStatus("Choose an image file before uploading.", "error");
      return false;
    }
    const definition = readAssetDefinitionDraft("economy-asset-definition");
    if (!definition.label || !definition.category) {
      setStatus("Uploaded assets require a friendly name and category.", "error");
      return false;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const payload = await requestJson(GAME_ASSET_UPLOAD, {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type,
          base64_data: dataUrl,
          definition,
          overwrite: false
        })
      });
      updateAssetStateFromPayload(payload);
      const input = iconInputForTarget();
      const value = normalizeItemIconPath(payload.path || payload.asset_definition?.path || definition.path);
      if (input && value) {
        input.value = value;
        syncIconPreview(input);
      }
      state.assetPicker.mode = "bundled";
      state.assetPicker.uploadFile = null;
      state.assetPicker.definition = {};
      if (state.assetUploadPreviewUrl) URL.revokeObjectURL(state.assetUploadPreviewUrl);
      state.assetUploadPreviewUrl = "";
      setStatus("Asset uploaded and selected.", "success");
      return true;
    } catch (err) {
      setStatus(err?.message || "Runtime/Auth could not upload the asset.", "error");
      return false;
    }
  }

  function selectedExclusionScopes() {
    return Array.from(document.querySelectorAll("[data-exclusion-scope]:checked"))
      .map((input) => text(input.dataset.exclusionScope))
      .filter(Boolean);
  }

  async function saveParticipationExclusion() {
    const targetType = text($("#economy-exclusion-target-type")?.value || $("#economy-exclusion-target-type-main")?.value || state.participationExclusions.targetType);
    const targetId = text($("#economy-exclusion-target-id")?.value || $("#economy-exclusion-target-id-main")?.value || state.participationExclusions.targetId);
    const reason = text($("#economy-exclusion-reason")?.value || state.participationExclusions.reason);
    const scopes = selectedExclusionScopes();
    if (!targetType || !targetId) {
      setStatus("Choose an account or public identity target before saving exclusions.", "error");
      return;
    }
    state.participationExclusions.saving = true;
    state.participationExclusions.error = "";
    try {
      const payload = await requestJson(PARTICIPATION_EXCLUSION_TARGET(targetType, targetId), {
        method: "PATCH",
        body: JSON.stringify({ enabled: true, scopes, reason })
      });
      state.participationExclusions.targetType = targetType;
      state.participationExclusions.targetId = targetId;
      state.participationExclusions.selectedTarget = payload.target || state.participationExclusions.selectedTarget;
      state.participationExclusions.current = payload.policy || null;
      state.participationExclusions.effective = payload.effective || null;
      state.participationExclusions.reason = payload.policy?.reason || reason;
      await loadParticipationExclusions();
      renderParticipationExclusions();
      setStatus("Participation exclusion policy saved.", "success");
    } catch (err) {
      state.participationExclusions.error = err?.message || "Exclusion save failed.";
      renderParticipationExclusions();
      setStatus(state.participationExclusions.error, "error");
    } finally {
      state.participationExclusions.saving = false;
    }
  }

  async function clearParticipationExclusion() {
    const targetType = text($("#economy-exclusion-target-type")?.value || $("#economy-exclusion-target-type-main")?.value || state.participationExclusions.targetType);
    const targetId = text($("#economy-exclusion-target-id")?.value || $("#economy-exclusion-target-id-main")?.value || state.participationExclusions.targetId);
    if (!targetType || !targetId) {
      setStatus("Choose an account or public identity target before clearing exclusions.", "error");
      return;
    }
    state.participationExclusions.saving = true;
    state.participationExclusions.error = "";
    try {
      const payload = await requestJson(PARTICIPATION_EXCLUSION_TARGET(targetType, targetId), { method: "DELETE" });
      state.participationExclusions.selectedTarget = payload.target || state.participationExclusions.selectedTarget;
      state.participationExclusions.current = payload.policy || null;
      state.participationExclusions.effective = payload.effective || null;
      state.participationExclusions.reason = "";
      await loadParticipationExclusions();
      renderParticipationExclusions();
      setStatus("Participation exclusion policy cleared.", "success");
    } catch (err) {
      state.participationExclusions.error = err?.message || "Exclusion clear failed.";
      renderParticipationExclusions();
      setStatus(state.participationExclusions.error, "error");
    } finally {
      state.participationExclusions.saving = false;
    }
  }

  async function refresh(options = {}) {
    const token = ++state.token;
    setStatus("Loading economy controls...");
    try {
      await Promise.all([loadEconomyConfig(), loadItems(), loadIdentities(), loadAssetCatalog(), loadParticipationExclusions()]);
      if (state.selectedIdentityCode) {
        await loadDetail(state.selectedIdentityCode);
      }
      if (token !== state.token) return;
      renderAll();
      announceApiHydration();
      setStatus(options.silent ? "" : "Economy controls loaded.", "success");
    } catch (err) {
      setStatus(err?.message || "Failed to load economy controls.", "error");
    }
  }

  function announceApiHydration() {
    try {
      window.dispatchEvent(new CustomEvent("streamsuites:admin-live-data", {
        detail: { view: "economy", source: "api", ok: true }
      }));
    } catch (err) {
      console.warn("[EconomyAdmin] API hydration event failed", err);
    }
  }

  function highlightInspectorSelection() {
    const inspector = document.getElementById("economy-wallet-inventory-section");
    if (!inspector) return;
    inspector.classList.remove("is-selection-highlighted");
    inspector.setAttribute("tabindex", "-1");
    inspector.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => {
      inspector.focus?.({ preventScroll: true });
      inspector.classList.add("is-selection-highlighted");
      window.setTimeout(() => {
        inspector.classList.remove("is-selection-highlighted");
      }, 1600);
    });
  }

  async function applyEconomyAction() {
    if (!state.selectedIdentityCode || state.saving) return;
    const eventType = activeFieldValue("#economy-actions .ss-economy-action-grid", "#economy-action-type");
    const amount = Number(activeFieldValue("#economy-actions .ss-economy-action-grid", "#economy-action-amount") || 0);
    const reason = activeFieldValue("#economy-actions .ss-economy-action-grid", "#economy-action-reason");
    if (!reason) {
      setStatus("Manual economy actions require a reason.", "error");
      return;
    }
    state.saving = true;
    try {
      await requestJson(ECONOMY_EVENTS(state.selectedIdentityCode), {
        method: "POST",
        body: JSON.stringify({ event_type: eventType, amount_delta: amount, reason_text: reason })
      });
      await loadDetail();
      renderAll();
      setStatus("Economy action recorded.", "success");
    } catch (err) {
      setStatus(err?.message || "Economy action failed.", "error");
    } finally {
      state.saving = false;
    }
  }

  async function reverseEconomyEvent(code = text($("#economy-reversal-code")?.value)) {
    const reason = activeFieldValue("#economy-actions .ss-economy-reversal-box", "#economy-reversal-reason");
    if (!code || !reason) {
      setStatus("Economy reversal requires an event code and reason.", "error");
      return;
    }
    await requestJson(ECONOMY_EVENT_REVERSE(code), {
      method: "POST",
      body: JSON.stringify({ reason_text: reason })
    });
    await loadDetail();
    renderAll();
    setStatus("Economy reversal recorded.", "success");
  }

  async function applyInventoryAction() {
    if (!state.selectedIdentityCode || state.saving) return;
    const eventType = activeFieldValue("#economy-inventory-actions .ss-economy-action-grid", "#inventory-action-type");
    const itemCode = activeFieldValue("#economy-inventory-actions .ss-economy-action-grid", "#inventory-action-item");
    const quantity = Number(activeFieldValue("#economy-inventory-actions .ss-economy-action-grid", "#inventory-action-quantity") || 0);
    const reason = activeFieldValue("#economy-inventory-actions .ss-economy-action-grid", "#inventory-action-reason");
    if (!reason) {
      setStatus("Manual inventory actions require a reason.", "error");
      return;
    }
    state.saving = true;
    try {
      await requestJson(INVENTORY_EVENT_CREATE(state.selectedIdentityCode), {
        method: "POST",
        body: JSON.stringify({ event_type: eventType, item_code: itemCode, quantity_delta: quantity, reason_text: reason })
      });
      await loadDetail();
      renderAll();
      setStatus("Inventory action recorded.", "success");
    } catch (err) {
      setStatus(err?.message || "Inventory action failed.", "error");
    } finally {
      state.saving = false;
    }
  }

  async function applyExchangeAction() {
    if (!state.selectedIdentityCode || state.saving) return;
    const item = currentExchangeItem();
    const itemCode = text(item?.item_code || activeFieldValue("#economy-exchange-actions .ss-economy-exchange-grid", "#economy-exchange-item"));
    const quantity = Number(activeFieldValue("#economy-exchange-actions .ss-economy-exchange-grid", "#economy-exchange-quantity") || 0);
    const reason = activeFieldValue("#economy-exchange-actions .ss-economy-exchange-grid", "#economy-exchange-reason");
    if (!itemCode || !quantity || quantity <= 0 || !reason) {
      setStatus("Gem/diamond exchange requires an item, positive quantity, and reason.", "error");
      return;
    }
    state.saving = true;
    try {
      await requestJson(ECONOMY_EXCHANGE(state.selectedIdentityCode), {
        method: "POST",
        body: JSON.stringify({ identity_code: state.selectedIdentityCode, item_code: itemCode, quantity, reason_text: reason })
      });
      await loadDetail();
      renderAll();
      setStatus("Held gem/diamond exchanged into credits.", "success");
    } catch (err) {
      setStatus(err?.message || "Gem/diamond exchange failed.", "error");
    } finally {
      state.saving = false;
    }
  }

  async function reverseInventoryEvent(code = text($("#inventory-reversal-code")?.value)) {
    const reason = activeFieldValue("#economy-inventory-actions .ss-economy-reversal-box", "#inventory-reversal-reason");
    if (!code || !reason) {
      setStatus("Inventory reversal requires an event code and reason.", "error");
      return;
    }
    await requestJson(INVENTORY_EVENT_REVERSE(code), {
      method: "POST",
      body: JSON.stringify({ reason_text: reason })
    });
    await loadDetail();
    renderAll();
    setStatus("Inventory reversal recorded.", "success");
  }

  async function saveEconomySettings() {
    const reason = activeFieldValue("#economy-settings-form .ss-economy-settings-grid", "#economy-setting-reason");
    if (!reason) {
      setStatus("Economy settings changes require a reason.", "error");
      return;
    }
    const settings = {
      currency_unit_label: activeFieldValue("#economy-settings-form .ss-economy-settings-grid", "#economy-setting-label"),
      currency_unit_plural_label: activeFieldValue("#economy-settings-form .ss-economy-settings-grid", "#economy-setting-plural"),
      currency_symbol_path: activeFieldValue("#economy-settings-form .ss-economy-settings-grid", "#economy-setting-symbol")
    };
    const payload = await requestJson(ECONOMY_SETTINGS, {
      method: "PATCH",
      body: JSON.stringify({ settings, reason_text: reason })
    });
    state.economySettings = payload.settings || state.economySettings;
    await loadDetail();
    renderAll();
    setStatus("Economy settings saved.", "success");
  }

  async function saveItemDefinition(button) {
    captureItemEditorDraft();
    const row = button.closest(".ss-economy-item-definition");
    const itemCode = text(row?.dataset?.itemCode);
    const item = state.itemDefinitions.find((candidate) => text(candidate.item_code) === itemCode) || {};
    const draft = editItemEditorDraft(item, itemDefinitionViewModel(item));
    const readField = (field) => text(row?.querySelector(`[data-item-field="${field}"]`)?.value || draft[field]);
    const reason = readField("reason_text");
    if (!itemCode || !reason) {
      setStatus("Item definition metadata changes require a reason.", "error");
      return;
    }
    const nextItemCode = generatedEditorItemCode(row);
    const duplicateItemCode = nextItemCode && nextItemCode !== itemCode && state.itemDefinitions.some((item) => text(item.item_code) === nextItemCode);
    if (duplicateItemCode) {
      setStatus("Duplicate item code. Choose another suffix before saving.", "error");
      return;
    }
    if (row?.querySelector('[data-item-field="item_code_suffix"]') && !slugCode(readField("item_code_suffix"))) {
      setStatus("Item code suffix is required and must use safe characters.", "error");
      return;
    }
    const chatAlias = normalizeChatAlias(readField("chat_alias"));
    if (!chatAliasLooksValid(chatAlias)) {
      setStatus("Chat alias must use letters, numbers, hyphens, or underscores with no spaces.", "error");
      return;
    }
    await requestJson(ITEM_DEFINITION(itemCode), {
      method: "PATCH",
      body: JSON.stringify({
        label: readField("label"),
        category: readField("category"),
        icon_path: normalizeItemIconPath(readField("icon_path")),
        rarity: readField("rarity"),
        is_enabled: readField("is_enabled") !== "false",
        public_tooltip_enabled: readField("public_tooltip_enabled") !== "false",
        chat_alias: chatAlias,
        short_description: readField("short_description"),
        tooltip_description: readField("tooltip_description"),
        contextual_public_note: readField("contextual_public_note"),
        metadata: {
          notes: readField("metadata_notes"),
          chat_alias: chatAlias,
          public_tooltip_enabled: readField("public_tooltip_enabled") !== "false",
          short_description: readField("short_description"),
          tooltip_description: readField("tooltip_description"),
          contextual_public_note: readField("contextual_public_note")
        },
        reason_text: reason
      })
    });
    await loadItems();
    state.itemEditorCode = "";
    delete state.itemEditorDrafts[itemCode];
    renderAll();
    setStatus(nextItemCode && nextItemCode !== itemCode ? "Item metadata saved. Existing item-code rename is blocked until Runtime/Auth can safely migrate references." : "Item definition metadata saved.", "success");
  }

  async function deleteItemDefinition(button) {
    const itemCode = text(button?.dataset?.itemCode || button?.closest(".ss-economy-item-definition")?.dataset?.itemCode);
    if (!itemCode) return;
    const reason = text(window.prompt?.(`Archive item definition ${itemCode}?\n\nHistorical inventory rows are preserved, but this item will be disabled and no longer purchasable by chat alias.\n\nRequired reason/note:`) || "");
    if (!reason) {
      setStatus("Item definition archive requires a reason.", "error");
      return;
    }
    if (!window.confirm?.(`Archive ${itemCode}? This disables the definition and removes it from new purchase flows.`)) return;
    await requestJson(ITEM_DEFINITION(itemCode), {
      method: "DELETE",
      body: JSON.stringify({ reason_text: reason })
    });
    state.itemDefinitions = state.itemDefinitions.filter((item) => text(item.item_code) !== itemCode);
    if (state.itemEditorCode === itemCode) state.itemEditorCode = "";
    await loadItems();
    renderAll();
    setStatus("Item definition archived. Historical inventory rows were preserved.", "success");
  }

  async function saveMarketGovernance(button) {
    const row = button.closest(".ss-economy-market-row");
    const itemCode = text(row?.dataset?.marketItemCode);
    const readField = (field) => text(row?.querySelector(`[data-market-field="${field}"]`)?.value);
    const reason = readField("reason_text");
    if (!itemCode || !reason) {
      setStatus("Market governance changes require a reason.", "error");
      return;
    }
    const optionalNumber = (field) => {
      const value = readField(field);
      return value === "" ? null : Number(value);
    };
    const item = {
      item_type: readField("item_type"),
      market_enabled: readField("market_enabled") === "true",
      market_price_stekels: optionalNumber("market_price_stekels"),
      exchange_enabled: readField("exchange_enabled") === "true",
      exchange_value_stekels: optionalNumber("exchange_value_stekels"),
      stock: optionalNumber("stock"),
      stock_limit: optionalNumber("stock_limit"),
      unlimited_stock: readField("unlimited_stock") === "true",
      market_label: readField("market_label"),
      short_label: readField("short_label")
    };
    await requestJson(MARKET_GOVERNANCE_ITEM(itemCode), {
      method: "PATCH",
      body: JSON.stringify({ item, reason_text: reason })
    });
    await loadItems();
    state.marketEditorCode = "";
    renderAll();
    setStatus("Market governance saved.", "success");
  }

  async function applyBulkEditor() {
    const type = state.bulkEditor.type;
    const selected = state.bulkEditor.selected.map(text).filter(Boolean);
    const reason = text(state.bulkEditor.reason);
    if (!type || !selected.length) {
      setStatus("Choose at least one bulk editor row before applying changes.", "error");
      return;
    }
    if (!reason) {
      setStatus("Bulk editor changes require a shared reason.", "error");
      return;
    }
    const nextErrors = {};
    const dirtySelected = selected.filter((key) => state.bulkEditor.dirty[key]);
    dirtySelected.forEach((key) => {
      const source = bulkSourceItems().find((item) => bulkItemKey(item) === key) || { item_code: key };
      const draft = bulkDraftFor(source);
      try {
        const error = validateBulkItem(key, draft);
        if (error) nextErrors[key] = error;
      } catch (err) {
        nextErrors[key] = err?.message || "Invalid row.";
      }
    });
    state.bulkEditor.errors = nextErrors;
    renderAll();
    if (Object.keys(nextErrors).length) {
      setStatus("Bulk editor validation failed. Fix the marked rows before applying.", "error");
      return;
    }
    if (!dirtySelected.length) {
      setStatus("No selected bulk editor rows have pending changes.", "error");
      return;
    }
    const label = type === "market" ? "market governance" : "inventory item definition";
    if (!window.confirm?.(`Apply ${dirtySelected.length} ${label} row change(s) through Runtime/Auth?`)) return;
    state.bulkEditor.applying = true;
    state.bulkEditor.results = {};
    renderAll();
    for (const key of dirtySelected) {
      const source = bulkSourceItems().find((item) => bulkItemKey(item) === key) || { item_code: key };
      const draft = bulkDraftFor(source);
      try {
        if (type === "market") {
          const item = {
            item_type: text(draft.item_type),
            market_enabled: draft.market_enabled === "true",
            market_price_stekels: readBulkNumber(draft, "market_price_stekels"),
            exchange_enabled: draft.exchange_enabled === "true",
            exchange_value_stekels: readBulkNumber(draft, "exchange_value_stekels"),
            stock: readBulkNumber(draft, "stock"),
            stock_limit: readBulkNumber(draft, "stock_limit"),
            unlimited_stock: draft.unlimited_stock === "true",
            market_label: text(draft.market_label),
            short_label: text(draft.short_label)
          };
          await requestJson(MARKET_GOVERNANCE_ITEM(key), {
            method: "PATCH",
            body: JSON.stringify({ item, reason_text: reason })
          });
        } else {
          const chatAlias = normalizeChatAlias(draft.chat_alias);
          await requestJson(ITEM_DEFINITION(key), {
            method: "PATCH",
            body: JSON.stringify({
              label: text(draft.label),
              category: text(draft.category),
              icon_path: normalizeItemIconPath(draft.icon_path),
              rarity: text(draft.rarity),
              is_enabled: draft.is_enabled !== "false",
              public_tooltip_enabled: draft.public_tooltip_enabled !== "false",
              chat_alias: chatAlias,
              short_description: text(draft.short_description),
              tooltip_description: text(draft.tooltip_description),
              contextual_public_note: text(draft.contextual_public_note),
              metadata: {
                notes: text(draft.metadata_notes),
                chat_alias: chatAlias,
                public_tooltip_enabled: draft.public_tooltip_enabled !== "false",
                short_description: text(draft.short_description),
                tooltip_description: text(draft.tooltip_description),
                contextual_public_note: text(draft.contextual_public_note)
              },
              reason_text: reason
            })
          });
        }
        state.bulkEditor.results[key] = "success";
        delete state.bulkEditor.errors[key];
        delete state.bulkEditor.dirty[key];
      } catch (err) {
        state.bulkEditor.errors[key] = err?.message || "Save failed.";
        state.bulkEditor.results[key] = "error";
      }
    }
    state.bulkEditor.applying = false;
    await loadItems();
    renderAll();
    const saved = Object.values(state.bulkEditor.results).filter((value) => value === "success").length;
    const failed = Object.values(state.bulkEditor.results).filter((value) => value === "error").length;
    setStatus(`Bulk editor applied ${formatNumber(saved)} row(s)${failed ? ` with ${formatNumber(failed)} error(s)` : ""}.`, failed ? "error" : "success");
  }

  async function saveDenominationIcon(button) {
    const row = button.closest(".ss-economy-denomination-row");
    const denominationCode = text(row?.dataset?.denominationCode);
    const readField = (field) => text(row?.querySelector(`[data-denomination-field="${field}"]`)?.value);
    const reason = readField("reason_text");
    if (!denominationCode || !reason) {
      state.denominationErrors = {
        ...state.denominationErrors,
        [denominationCode]: { reason_text: "A reason is required." }
      };
      renderDenominations();
      setStatus("Denomination icon changes require a reason.", "error");
      return;
    }
    try {
      const payload = await requestJson(ECONOMY_DENOMINATION(denominationCode), {
        method: "PATCH",
        body: JSON.stringify({
          denomination: {
            icon_path: normalizeItemIconPath(readField("icon_path"))
          },
          reason_text: reason
        })
      });
      state.denominationErrors = { ...state.denominationErrors, [denominationCode]: {} };
      await Promise.all([loadEconomyConfig(), loadItems(), loadDetail()]);
      state.denominationEditorCode = "";
      renderAll();
      setStatus(`Denomination icon saved for ${payload.denomination?.label || denominationCode}.`, "success");
    } catch (err) {
      state.denominationErrors = {
        ...state.denominationErrors,
        [denominationCode]: fieldErrorMap(err)
      };
      renderDenominations();
      setStatus(err?.message || "Denomination icon save failed.", "error");
    }
  }

  async function createItemDefinition() {
    captureItemEditorDraft();
    const draft = createItemEditorDraft();
    const reason = text($("#economy-item-create-reason")?.value || draft.reason_text);
    const generated = generatedItemCodeDraftState(draft);
    if (!reason) {
      state.itemCreateErrors = { reason_text: "A reason is required." };
      updateItemCreateFieldErrors();
      setStatus("New item definitions require a reason.", "error");
      return;
    }
    if (!generated.itemCode || generated.collision) {
      state.itemCreateErrors = { item_code: generated.collision ? "An item definition already uses this generated code." : "Item code could not be generated." };
      updateItemCreateFieldErrors();
      setStatus(generated.collision ? "Generated item code already exists. Choose a different item name." : "Choose a category and item name before creating an item definition.", "error");
      return;
    }
    const chatAlias = normalizeChatAlias($("#economy-item-create-chat-alias")?.value || draft.chat_alias);
    if (!chatAliasLooksValid(chatAlias)) {
      state.itemCreateErrors = { chat_alias: "Use lowercase letters, numbers, hyphens, or underscores with no spaces." };
      updateItemCreateFieldErrors();
      setStatus("Chat alias must use letters, numbers, hyphens, or underscores with no spaces.", "error");
      return;
    }
    state.itemCreateErrors = {};
    updateItemCreateFieldErrors();
    try {
      await requestJson(ITEM_DEFINITIONS, {
        method: "POST",
        body: JSON.stringify({
          item: {
            item_code: generated.itemCode,
            item_name: generated.label,
            label: generated.label,
            category: generated.category,
            rarity: text($("#economy-item-create-rarity")?.value || draft.rarity),
            icon_path: normalizeItemIconPath($("#economy-item-create-icon")?.value || draft.icon_path),
            is_enabled: text($("#economy-item-create-enabled")?.value || draft.is_enabled) !== "false",
            public_tooltip_enabled: text($("#economy-item-create-public-tooltip")?.value || draft.public_tooltip_enabled) !== "false",
            chat_alias: chatAlias,
            short_description: text($("#economy-item-create-short-description")?.value || draft.short_description),
            tooltip_description: text($("#economy-item-create-tooltip-description")?.value || draft.tooltip_description),
            contextual_public_note: text($("#economy-item-create-contextual-note")?.value || draft.contextual_public_note),
            metadata: {
              notes: text($("#economy-item-create-notes")?.value || draft.metadata_notes),
              chat_alias: chatAlias,
              public_tooltip_enabled: text($("#economy-item-create-public-tooltip")?.value || draft.public_tooltip_enabled) !== "false",
              short_description: text($("#economy-item-create-short-description")?.value || draft.short_description),
              tooltip_description: text($("#economy-item-create-tooltip-description")?.value || draft.tooltip_description),
              contextual_public_note: text($("#economy-item-create-contextual-note")?.value || draft.contextual_public_note)
            }
          },
          reason_text: reason
        })
      });
    } catch (err) {
      state.itemCreateErrors = fieldErrorMap(err);
      updateItemCreateFieldErrors();
      throw err;
    }
    state.itemCreateErrors = {};
    await loadItems();
    state.itemEditorCode = "";
    state.itemEditorDrafts[ITEM_CREATE_EDITOR_CODE] = {};
    renderAll();
    setStatus("Item definition created.", "success");
  }

  async function exportBackup() {
    const payload = await requestJson(PUBLIC_GAME_BACKUP);
    const blob = new Blob([JSON.stringify(payload.backup || payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `streamsuites-public-game-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("Public game authority backup exported.", "success");
  }

  async function resetPublicGameState() {
    const confirmation = text($("#economy-danger-confirmation")?.value);
    const reason = text($("#economy-danger-reason")?.value);
    if (confirmation !== "RESET PUBLIC GAME STATE" || !reason) {
      setStatus("Reset requires the exact confirmation phrase and a reason.", "error");
      return;
    }
    await requestJson(PUBLIC_GAME_RESET, {
      method: "POST",
      body: JSON.stringify({
        scope: text($("#economy-danger-scope")?.value) || "all",
        confirmation,
        reason_text: reason
      })
    });
    await refresh();
    setStatus("Reset correction events were recorded.", "success");
  }

  function setCollapsed(sectionKey, collapsed) {
    const section = document.querySelector(`[data-collapsible-section="${sectionKey}"]`);
    const button = document.querySelector(`[data-collapse-target="${sectionKey}"]`);
    if (!section || !button) return;
    section.classList.toggle("is-collapsed", collapsed);
    button.setAttribute("aria-expanded", collapsed ? "false" : "true");
    button.textContent = collapsed ? "Expand" : "Collapse";
  }

  function initializeCollapsibles() {
    document.querySelectorAll("[data-collapse-target]").forEach((button) => {
      const key = button.dataset.collapseTarget;
      setCollapsed(key, button.getAttribute("aria-expanded") === "false");
    });
  }

  function bind() {
    if (state.bound) return;
    state.bound = true;
    el.refresh?.addEventListener("click", () => refresh());
    el.searchSubmit?.addEventListener("click", () => refresh());
    el.searchInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") refresh();
    });
    window.addEventListener("streamsuites:economy-audit-drawer", (event) => {
      state.auditDrawer = text(event.detail?.drawer);
      renderEvents();
    });
    document.addEventListener("click", async (event) => {
      const browseButton = event.target.closest?.(".ss-economy-asset-browse");
      if (browseButton) {
        captureItemEditorDraft();
        await loadAssetCatalog();
        const target = text(browseButton.dataset.assetTarget);
        const current = currentIconInputValue(target);
        state.assetPicker = {
          open: true,
          target,
          selectedPath: current,
          filter: "",
          mode: /^https?:\/\//i.test(current) ? "custom" : "bundled",
          customUrl: /^https?:\/\//i.test(current) ? current : "",
          definition: {},
          editingPath: "",
          errors: {},
          uploadFile: null,
          uploadError: ""
        };
        if (isItemAssetTarget(target)) {
          state.itemEditorSection = "assets";
          renderItemDefinitions();
        } else {
          renderAssetPicker();
        }
        return;
      }
      const itemEditorSectionButton = event.target.closest?.("[data-item-editor-section]");
      if (itemEditorSectionButton) {
        captureItemEditorDraft();
        const section = text(itemEditorSectionButton.dataset.itemEditorSection);
        state.itemEditorSection = ["details", "assets", "copy", "admin"].includes(section) ? section : "details";
        if (state.itemEditorSection === "assets") await loadAssetCatalog();
        renderItemDefinitions();
        return;
      }
      if (event.target.closest?.("[data-asset-close]")) {
        state.assetPicker.open = false;
        refreshAssetPickerView();
        return;
      }
      const modeButton = event.target.closest?.("[data-asset-mode]");
      if (modeButton) {
        const mode = modeButton.dataset.assetMode;
        state.assetPicker.mode = ["bundled", "define", "reconcile", "custom"].includes(mode) ? mode : "bundled";
        state.assetPicker.definition = {};
        state.assetPicker.editingPath = "";
        state.assetPicker.errors = {};
        refreshAssetPickerView();
        return;
      }
      const defineButton = event.target.closest?.("[data-asset-define-path]");
      if (defineButton) {
        const path = normalizeItemIconPath(defineButton.dataset.assetDefinePath);
        const asset = state.assetCatalog.find((item) => item.path === path) || {};
        state.assetPicker.selectedPath = path;
        state.assetPicker.definition = {
          path,
          label: text(asset.label || formatLabel((asset.filename || path.split("/").pop() || "").replace(/\.[^.]+$/, ""))),
          category: text(asset.category || "item"),
          tags: Array.isArray(asset.tags) ? asset.tags.join(", ") : "",
          notes: text(asset.notes),
          reason_text: ""
        };
        state.assetPicker.editingPath = "";
        state.assetPicker.errors = {};
        state.assetPicker.mode = "define";
        refreshAssetPickerView();
        return;
      }
      const editAssetButton = event.target.closest?.("[data-asset-edit-definition]");
      if (editAssetButton) {
        const path = normalizeItemIconPath(editAssetButton.dataset.assetEditDefinition);
        const asset = state.assetCatalog.find((item) => item.path === path) || {};
        state.assetPicker.selectedPath = path;
        state.assetPicker.editingPath = asset.definition_complete ? path : "";
        state.assetPicker.definition = {
          path,
          label: text(asset.label || formatLabel((asset.filename || path.split("/").pop() || "").replace(/\.[^.]+$/, ""))),
          category: text(asset.category || "item"),
          tags: Array.isArray(asset.tags) ? asset.tags.join(", ") : "",
          notes: text(asset.notes),
          reason_text: ""
        };
        state.assetPicker.errors = {};
        state.assetPicker.mode = "define";
        refreshAssetPickerView();
        return;
      }
      const removeAssetButton = event.target.closest?.("[data-asset-remove-definition]");
      if (removeAssetButton) {
        if (window.confirm?.("Remove this image asset definition listing? The physical image file will not be deleted.") === false) return;
        const removed = await removeAssetDefinitionListing(removeAssetButton.dataset.assetRemoveDefinition);
        if (removed) refreshAssetPickerView();
        return;
      }
      const assetTile = event.target.closest?.("[data-asset-path]");
      if (assetTile) {
        state.assetPicker.selectedPath = normalizeItemIconPath(assetTile.dataset.assetPath);
        state.assetPicker.definition = {};
        state.assetPicker.editingPath = "";
        state.assetPicker.errors = {};
        refreshAssetPickerView();
        return;
      }
      if (event.target.closest?.("[data-asset-save-definition]")) {
        const saved = await saveAssetDefinitionFromPicker();
        if (saved) refreshAssetPickerView();
        return;
      }
      if (event.target.closest?.("[data-asset-upload]")) {
        const uploaded = await uploadAssetFromPicker();
        if (uploaded) refreshAssetPickerView();
        return;
      }
      if (event.target.closest?.("[data-asset-use]")) {
        const input = iconInputForTarget();
        const value = state.assetPicker.mode === "custom"
          ? normalizeItemIconPath(state.assetPicker.customUrl)
          : normalizeItemIconPath(state.assetPicker.selectedPath);
        if (input && value) {
          input.value = value;
          syncIconPreview(input);
          captureItemEditorDraft();
        } else if (usesUnifiedItemAssetSection() && value) {
          const key = itemEditorKey();
          state.itemEditorDrafts[key] = {
            ...(state.itemEditorDrafts[key] || {}),
            icon_path: value
          };
        }
        if (usesUnifiedItemAssetSection()) {
          state.itemEditorSection = "details";
          renderItemDefinitions();
        } else {
          state.assetPicker.open = false;
          renderAssetPicker();
        }
        return;
      }
      if (event.target.closest?.("[data-identity-selector-open]")) {
        state.identitySelectorOpen = true;
        renderIdentities();
        return;
      }
      if (event.target.closest?.("[data-identity-selector-close]")) {
        state.identitySelectorOpen = false;
        renderIdentities();
        return;
      }
      const auditOpenButton = event.target.closest?.("[data-audit-drawer-open]");
      if (auditOpenButton) {
        state.auditDrawer = text(auditOpenButton.dataset.auditDrawerOpen);
        renderEvents();
        return;
      }
      if (event.target.closest?.("[data-audit-drawer-close]")) {
        state.auditDrawer = "";
        renderEvents();
        return;
      }
      const publicIdentityChip = event.target.closest?.("[data-public-identity-unassign-chip]");
      if (publicIdentityChip) {
        event.preventDefault();
        event.stopPropagation();
        await unassignPublicIdentityChip(publicIdentityChip);
        return;
      }
      if (event.target.closest?.("a, button, input, select, textarea")) {
        const interactiveIdentity = event.target.closest?.(".ss-economy-identity");
        if (interactiveIdentity && !event.target.closest?.("[data-public-identity-unassign-chip]")) {
          return;
        }
      }
      const identityButton = event.target.closest?.(".ss-economy-identity");
      if (identityButton) {
        state.selectedIdentityCode = text(identityButton.dataset.identityCode);
        state.identitySelectorOpen = false;
        await loadDetail(state.selectedIdentityCode);
        renderAll();
        highlightInspectorSelection();
        return;
      }
      const collapseButton = event.target.closest?.("[data-collapse-target]");
      if (collapseButton) {
        const key = collapseButton.dataset.collapseTarget;
        const expanded = collapseButton.getAttribute("aria-expanded") === "true";
        setCollapsed(key, expanded);
        return;
      }
      const pageButton = event.target.closest?.("[data-economy-page]");
      if (pageButton) {
        const kind = pageButton.dataset.economyPage;
        const nextPage = Number(pageButton.dataset.page || 1);
        if (kind === "identities") {
          state.identityPage = nextPage;
          renderIdentities();
        } else if (kind === "economy-events") {
          state.economyEventPage = nextPage;
          renderEvents();
        } else if (kind === "inventory-events") {
          state.inventoryEventPage = nextPage;
          renderEvents();
        } else if (kind === "items") {
          state.itemPage = nextPage;
          renderItemDefinitions();
        } else if (kind === "market") {
          state.marketPage = nextPage;
          renderMarketGovernance();
        }
        return;
      }
      const inventoryPickButton = event.target.closest?.("[data-inventory-action-pick]");
      if (inventoryPickButton) {
        selectManualInventoryItem(text(inventoryPickButton.dataset.inventoryActionPick));
        $("#inventory-action-item-search")?.focus();
        return;
      }
      if (event.target.closest?.("#economy-action-submit")) {
        await applyEconomyAction();
        return;
      }
      if (event.target.closest?.("#inventory-action-submit")) {
        await applyInventoryAction();
        return;
      }
      if (event.target.closest?.("#economy-exchange-submit")) {
        await applyExchangeAction();
        return;
      }
      const economyReverseButton = event.target.closest?.(".ss-economy-reverse-economy");
      if (economyReverseButton) {
        const input = $("#economy-reversal-code");
        if (input) input.value = economyReverseButton.dataset.eventCode || "";
        setCollapsed("economy-actions", false);
        return;
      }
      const inventoryReverseButton = event.target.closest?.(".ss-economy-reverse-inventory");
      if (inventoryReverseButton) {
        const input = $("#inventory-reversal-code");
        if (input) input.value = inventoryReverseButton.dataset.eventCode || "";
        setCollapsed("inventory-actions", false);
        return;
      }
      if (event.target.closest?.("#economy-reversal-submit")) {
        try {
          await reverseEconomyEvent();
        } catch (err) {
          setStatus(err?.message || "Economy reversal failed.", "error");
        }
        return;
      }
      if (event.target.closest?.("#inventory-reversal-submit")) {
        try {
          await reverseInventoryEvent();
        } catch (err) {
          setStatus(err?.message || "Inventory reversal failed.", "error");
        }
        return;
      }
      if (event.target.closest?.("#economy-setting-submit")) {
        try {
          await saveEconomySettings();
        } catch (err) {
          setStatus(err?.message || "Economy settings save failed.", "error");
        }
        return;
      }
      const exclusionTargetResult = event.target.closest?.("[data-exclusion-target-index]");
      if (exclusionTargetResult) {
        const index = Number(exclusionTargetResult.dataset.exclusionTargetIndex);
        const candidate = state.participationExclusions.searchResults[index];
        await selectParticipationExclusionTarget(candidate);
        return;
      }
      const exclusionPolicyButton = event.target.closest?.("[data-exclusion-policy-target-id]");
      if (exclusionPolicyButton) {
        state.participationExclusions.targetType = text(exclusionPolicyButton.dataset.exclusionPolicyTargetType || "public_identity");
        state.participationExclusions.targetId = text(exclusionPolicyButton.dataset.exclusionPolicyTargetId);
        state.participationExclusions.selectedTarget = null;
        await loadParticipationExclusionSummary();
        state.participationExclusions.policyModalOpen = true;
        renderParticipationExclusions();
        return;
      }
      if (event.target.closest?.("#economy-exclusion-use-selected")) {
        state.participationExclusions.targetType = "public_identity";
        state.participationExclusions.targetId = state.selectedIdentityCode || "";
        state.participationExclusions.selectedTarget = null;
        await loadParticipationExclusionSummary();
        return;
      }
      if (event.target.closest?.("#economy-exclusion-load")) {
        await loadParticipationExclusionSummary();
        return;
      }
      if (event.target.closest?.("#economy-exclusion-edit-policy")) {
        state.participationExclusions.policyModalOpen = true;
        renderParticipationExclusions();
        return;
      }
      if (event.target.closest?.("[data-policy-modal-close]")) {
        state.participationExclusions.policyModalOpen = false;
        renderParticipationExclusions();
        return;
      }
      if (event.target.closest?.("#economy-exclusion-save")) {
        await saveParticipationExclusion();
        return;
      }
      if (event.target.closest?.("#economy-exclusion-clear")) {
        await clearParticipationExclusion();
        return;
      }
      if (event.target.closest?.("#economy-item-create-submit")) {
        try {
          await createItemDefinition();
        } catch (err) {
          setStatus(err?.message || "Item definition create failed.", "error");
        }
        return;
      }
      if (event.target.closest?.("#economy-item-create-open")) {
        state.itemCreateErrors = {};
        state.itemEditorSection = "details";
        state.itemEditorDrafts[ITEM_CREATE_EDITOR_CODE] = {};
        state.assetPicker.open = false;
        state.itemEditorCode = ITEM_CREATE_EDITOR_CODE;
        renderItemDefinitions();
        return;
      }
      if (event.target.closest?.("[data-item-modal-close]")) {
        state.itemEditorCode = "";
        state.itemCreateErrors = {};
        state.itemEditorSection = "details";
        state.assetPicker.open = false;
        renderItemDefinitions();
        return;
      }
      const itemStepButton = event.target.closest?.("[data-item-editor-step]");
      if (itemStepButton) {
        captureItemEditorDraft();
        const steps = itemEditorSteps();
        const currentIndex = itemEditorStepIndex();
        const direction = itemStepButton.dataset.itemEditorStep === "previous" ? -1 : 1;
        state.itemEditorSection = steps[Math.min(Math.max(currentIndex + direction, 0), steps.length - 1)];
        renderItemDefinitions();
        return;
      }
      if (event.target.closest?.("#economy-backup-export")) {
        try {
          await exportBackup();
        } catch (err) {
          setStatus(err?.message || "Backup export failed.", "error");
        }
        return;
      }
      if (event.target.closest?.("#economy-reset-submit")) {
        try {
          await resetPublicGameState();
        } catch (err) {
          setStatus(err?.message || "Reset failed.", "error");
        }
        return;
      }
      const itemSaveButton = event.target.closest?.(".ss-economy-item-save");
      if (itemSaveButton) {
        try {
          await saveItemDefinition(itemSaveButton);
        } catch (err) {
          setStatus(err?.message || "Item definition save failed.", "error");
        }
        return;
      }
      const itemDeleteButton = event.target.closest?.(".ss-economy-item-delete");
      if (itemDeleteButton) {
        try {
          await deleteItemDefinition(itemDeleteButton);
        } catch (err) {
          setStatus(err?.message || "Item definition archive failed.", "error");
        }
        return;
      }
      const bulkOpenButton = event.target.closest?.("[data-bulk-open]");
      if (bulkOpenButton) {
        openBulkEditor(text(bulkOpenButton.dataset.bulkOpen));
        return;
      }
      if (event.target.closest?.("[data-bulk-close]")) {
        closeBulkEditor();
        return;
      }
      if (event.target.closest?.("[data-bulk-select-visible]")) {
        const visible = filteredBulkItems().map(bulkItemKey).filter(Boolean);
        state.bulkEditor.selected = Array.from(new Set([...state.bulkEditor.selected, ...visible]));
        renderAll();
        return;
      }
      if (event.target.closest?.("[data-bulk-clear-selection]")) {
        state.bulkEditor.selected = [];
        renderAll();
        return;
      }
      if (event.target.closest?.("[data-bulk-apply]")) {
        await applyBulkEditor();
        return;
      }
      const marketSaveButton = event.target.closest?.("[data-market-save]");
      if (marketSaveButton) {
        try {
          await saveMarketGovernance(marketSaveButton);
          state.marketEditorCode = "";
        } catch (err) {
          setStatus(err?.message || "Market governance save failed.", "error");
        }
        return;
      }
      if (event.target.closest?.("[data-market-modal-close]")) {
        state.marketEditorCode = "";
        renderMarketGovernance();
        return;
      }
      const marketEditButton = event.target.closest?.("[data-market-edit]");
      if (marketEditButton) {
        const code = text(marketEditButton.dataset.marketEdit);
        state.marketEditorCode = code;
        renderMarketGovernance();
        return;
      }
      const itemViewButton = event.target.closest?.("[data-item-view]");
      if (itemViewButton) {
        state.itemViewMode = itemViewButton.dataset.itemView === "list" ? "list" : "cards";
        state.itemPage = 1;
        renderItemDefinitions();
        return;
      }
      const marketViewButton = event.target.closest?.("[data-market-view]");
      if (marketViewButton) {
        state.marketViewMode = marketViewButton.dataset.marketView === "list" ? "list" : "cards";
        state.marketPage = 1;
        renderMarketGovernance();
        return;
      }
      const inspectorInventoryViewButton = event.target.closest?.("[data-inspector-inventory-view]");
      if (inspectorInventoryViewButton) {
        state.inventoryViewMode = inspectorInventoryViewButton.dataset.inspectorInventoryView === "list" ? "list" : "cards";
        renderWallet();
        return;
      }
      const denominationSaveButton = event.target.closest?.(".ss-economy-denomination-save");
      if (denominationSaveButton) {
        await saveDenominationIcon(denominationSaveButton);
        return;
      }
      const denominationEditButton = event.target.closest?.(".ss-economy-denomination-edit");
      if (denominationEditButton) {
        const code = text(denominationEditButton.dataset.denominationCode);
        state.denominationEditorCode = state.denominationEditorCode === code ? "" : code;
        state.denominationErrors = { ...state.denominationErrors, [code]: {} };
        renderDenominations();
        return;
      }
      const itemEditButton = event.target.closest?.(".ss-economy-item-edit");
      if (itemEditButton) {
        const code = text(itemEditButton.dataset.itemCode);
        state.itemEditorSection = "details";
        state.assetPicker.open = false;
        state.itemEditorCode = code;
        renderItemDefinitions();
        return;
      }
      if (event.target.closest?.("[data-item-detail-close]") || event.target.matches?.("[data-item-detail-modal]")) {
        closeItemDetailModal();
        return;
      }
      const detailTrigger = event.target.closest?.("[data-item-detail-open]");
      const interactive = event.target.closest?.("button, a, input, select, textarea, [data-market-edit], .ss-inline-actions");
      if (detailTrigger && (!interactive || interactive === detailTrigger)) {
        const target = resolveItemDetailTarget(detailTrigger);
        openItemDetailModal(target.item, target.kind, detailTrigger);
        return;
      }
    });
    document.addEventListener("input", (event) => {
      if (event.target.matches?.("#inventory-action-item-search")) {
        state.manualInventorySearch = event.target.value;
        state.manualInventorySuggestionsOpen = true;
        state.manualInventoryHighlightedIndex = 0;
        renderManualInventorySuggestions();
        return;
      }
      if (event.target.closest?.("#economy-exchange-actions")) {
        syncExchangePreview();
      }
      if (event.target.matches?.('[data-item-field="icon_path"], [data-denomination-field="icon_path"], #economy-item-create-icon')) {
        const normalized = normalizeItemIconPath(event.target.value);
        if (event.target.value !== normalized) event.target.value = normalized;
        syncIconPreview(event.target);
        captureItemEditorDraft();
      }
      if (event.target.closest?.(".ss-economy-item-editor-modal .ss-economy-item-definition")) {
        captureItemEditorDraft();
      }
      if (event.target.matches?.("#economy-item-create-label, #economy-item-create-category, #economy-item-create-reason")) {
        state.itemCreateErrors = {};
        updateItemCreateFieldErrors({});
        syncGeneratedItemCodePreview();
      }
      if (event.target.matches?.("#economy-item-search")) {
        const selectionStart = event.target.selectionStart;
        const selectionEnd = event.target.selectionEnd;
        state.itemSearch = event.target.value;
        state.itemPage = 1;
        renderItemDefinitions();
        const search = $("#economy-item-search");
        if (search) {
          search.focus();
          search.setSelectionRange(selectionStart, selectionEnd);
        }
      }
      if (event.target.matches?.("#economy-bulk-search")) {
        const selectionStart = event.target.selectionStart;
        const selectionEnd = event.target.selectionEnd;
        state.bulkEditor.search = event.target.value;
        renderAll();
        const search = $("#economy-bulk-search");
        if (search) {
          search.focus();
          search.setSelectionRange(selectionStart, selectionEnd);
        }
      }
      if (event.target.matches?.("#economy-bulk-reason")) {
        state.bulkEditor.reason = event.target.value;
      }
      if (event.target.matches?.("[data-bulk-field]")) {
        updateBulkDraft(event.target.closest("[data-bulk-item-code]"));
      }
      if (event.target.matches?.("#economy-inspector-inventory-search")) {
        const selectionStart = event.target.selectionStart;
        const selectionEnd = event.target.selectionEnd;
        state.inventorySearch = event.target.value;
        renderWallet();
        const search = $("#economy-inspector-inventory-search");
        if (search) {
          search.focus();
          search.setSelectionRange(selectionStart, selectionEnd);
        }
      }
      if (event.target.matches?.('[data-item-field="category"], [data-item-field="item_code_suffix"]')) {
        syncItemEditorCodePreview(event.target.closest(".ss-economy-item-definition"));
      }
      if (event.target.matches?.("#economy-asset-filter")) {
        state.assetPicker.filter = event.target.value;
        if (!refreshIntegratedAssetFilterResults()) refreshAssetPickerView();
      }
      if (event.target.matches?.("#economy-asset-custom-url")) {
        state.assetPicker.customUrl = event.target.value;
        state.assetPicker.selectedPath = normalizeItemIconPath(event.target.value);
        refreshAssetPickerView();
      }
      if (event.target.matches?.("[data-asset-definition-field]")) {
        state.assetPicker.definition = {
          ...state.assetPicker.definition,
          [event.target.dataset.assetDefinitionField]: event.target.value
        };
        if (event.target.dataset.assetDefinitionField === "path") {
          state.assetPicker.selectedPath = normalizeItemIconPath(event.target.value);
          const preview = document.querySelector(".ss-economy-asset-preview-frame");
          if (preview) preview.innerHTML = renderIconPreview(state.assetPicker.selectedPath);
        }
      }
      if (event.target.matches?.("#economy-asset-upload-file")) {
        const file = event.target.files?.[0] || null;
        state.assetPicker.uploadFile = file;
        if (state.assetUploadPreviewUrl) URL.revokeObjectURL(state.assetUploadPreviewUrl);
        state.assetUploadPreviewUrl = file ? URL.createObjectURL(file) : "";
        state.assetPicker.definition = {
          ...state.assetPicker.definition,
          path: file ? `assets/games/${file.name}` : state.assetPicker.selectedPath,
          label: state.assetPicker.definition?.label || (file ? formatLabel(file.name.replace(/\.[^.]+$/, "")) : ""),
          category: state.assetPicker.definition?.category || "item"
        };
        refreshAssetPickerView();
      }
      if (event.target.matches?.("#economy-market-search")) {
        const selectionStart = event.target.selectionStart;
        const selectionEnd = event.target.selectionEnd;
        state.marketSearch = event.target.value;
        state.marketPage = 1;
        renderMarketGovernance();
        const search = $("#economy-market-search");
        if (search) {
          search.focus();
          search.setSelectionRange(selectionStart, selectionEnd);
        }
      }
      if (event.target.matches?.("#economy-exclusion-target-search")) {
        scheduleParticipationExclusionTargetSearch(event.target.value);
      }
      if (event.target.matches?.("#economy-exclusion-policy-search")) {
        state.participationExclusions.policySearch = event.target.value;
        renderParticipationExclusions();
      }
      if (event.target.matches?.("#economy-exclusion-target-id-main, #economy-exclusion-target-id, #economy-exclusion-reason")) {
        state.participationExclusions.targetId = text($("#economy-exclusion-target-id-main")?.value || $("#economy-exclusion-target-id")?.value);
        state.participationExclusions.reason = text($("#economy-exclusion-reason")?.value);
        if (event.target.matches?.("#economy-exclusion-target-id-main, #economy-exclusion-target-id")) {
          state.participationExclusions.selectedTarget = null;
          state.participationExclusions.current = null;
          state.participationExclusions.effective = null;
        }
      }
    });
    document.addEventListener("change", (event) => {
      if (event.target.matches?.("#inventory-action-item")) {
        selectManualInventoryItem(text(event.target.value));
        return;
      }
      if (event.target.closest?.("#economy-exchange-actions")) {
        syncExchangePreview();
      }
      if (event.target.matches?.("[data-bulk-select]")) {
        const key = text(event.target.dataset.bulkSelect);
        const selected = bulkSelectionSet();
        if (event.target.checked) selected.add(key);
        else selected.delete(key);
        state.bulkEditor.selected = Array.from(selected);
        return;
      }
      if (event.target.matches?.("[data-bulk-field]")) {
        updateBulkDraft(event.target.closest("[data-bulk-item-code]"));
        return;
      }
      if (event.target.matches?.("#economy-item-page-size")) {
        const nextSize = Number(event.target.value);
        state.itemPageSize = ITEM_PAGE_SIZE_OPTIONS.includes(nextSize) ? nextSize : DEFAULT_ITEM_PAGE_SIZE;
        state.itemPage = 1;
        renderItemDefinitions();
      }
      if (event.target.matches?.("#economy-market-page-size")) {
        const nextSize = Number(event.target.value);
        state.marketPageSize = ITEM_PAGE_SIZE_OPTIONS.includes(nextSize) ? nextSize : DEFAULT_ITEM_PAGE_SIZE;
        state.marketPage = 1;
        renderMarketGovernance();
      }
      if (event.target.matches?.("#economy-identity-page-size")) {
        const nextSize = Number(event.target.value);
        state.identityPageSize = IDENTITY_PAGE_SIZE_OPTIONS.includes(nextSize) ? nextSize : IDENTITY_PAGE_SIZE;
        state.identityPage = 1;
        renderIdentities();
      }
      if (event.target.matches?.('[data-item-field="category"]')) {
        syncItemEditorCodePreview(event.target.closest(".ss-economy-item-definition"));
      }
      if (event.target.matches?.("#economy-item-create-category")) {
        syncGeneratedItemCodePreview();
      }
      if (event.target.matches?.("#economy-market-filter-purchasable, #economy-market-filter-exchangeable, #economy-market-filter-disabled")) {
        state.marketFilters = {
          purchasable: Boolean($("#economy-market-filter-purchasable")?.checked),
          exchangeable: Boolean($("#economy-market-filter-exchangeable")?.checked),
          disabled: Boolean($("#economy-market-filter-disabled")?.checked)
        };
        renderMarketGovernance();
      }
      if (event.target.matches?.("#economy-exclusion-target-type-main, #economy-exclusion-target-type")) {
        state.participationExclusions.targetType = text(event.target.value || "public_identity");
        state.participationExclusions.current = null;
        state.participationExclusions.effective = null;
        state.participationExclusions.selectedTarget = null;
        renderParticipationExclusions();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.target?.matches?.("#inventory-action-item-search")) {
        const results = manualInventorySuggestionItems();
        if (event.key === "ArrowDown") {
          event.preventDefault();
          state.manualInventorySuggestionsOpen = true;
          state.manualInventoryHighlightedIndex = results.length ? Math.min(state.manualInventoryHighlightedIndex + 1, results.length - 1) : 0;
          renderManualInventorySuggestions();
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          state.manualInventorySuggestionsOpen = true;
          state.manualInventoryHighlightedIndex = results.length ? Math.max(state.manualInventoryHighlightedIndex - 1, 0) : 0;
          renderManualInventorySuggestions();
          return;
        }
        if (event.key === "Enter") {
          if (state.manualInventorySuggestionsOpen && results[state.manualInventoryHighlightedIndex]) {
            event.preventDefault();
            selectManualInventoryItem(text(results[state.manualInventoryHighlightedIndex].item_code));
          }
          return;
        }
        if (event.key === "Escape") {
          state.manualInventorySuggestionsOpen = false;
          renderManualInventorySuggestions();
          return;
        }
      }
      if (event.key === "Escape" && document.querySelector("[data-item-detail-modal]")) {
        closeItemDetailModal();
        return;
      }
      if (event.key === "Tab" && document.querySelector("[data-item-detail-modal]")) {
        const modal = document.querySelector("[data-item-detail-modal]");
        const focusable = Array.from(modal.querySelectorAll("button, [href], [tabindex]:not([tabindex='-1'])")).filter((node) => !node.disabled && !node.hidden);
        if (focusable.length) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
      if ((event.key === "Enter" || event.key === " ") && event.target?.matches?.("[data-item-detail-open]")) {
        event.preventDefault();
        const target = resolveItemDetailTarget(event.target);
        openItemDetailModal(target.item, target.kind, event.target);
        return;
      }
      if (event.key === "Escape" && state.assetPicker.open) {
        state.assetPicker.open = false;
        refreshAssetPickerView();
        return;
      }
      if (event.key === "Escape" && state.bulkEditor.type) {
        closeBulkEditor();
        return;
      }
      if (event.key === "Escape" && state.auditDrawer) {
        state.auditDrawer = "";
        renderEvents();
        return;
      }
      if (event.key === "Escape" && state.itemEditorCode) {
        state.itemEditorCode = "";
        state.itemCreateErrors = {};
        renderItemDefinitions();
        return;
      }
      if (event.key === "Escape" && state.participationExclusions.policyModalOpen) {
        state.participationExclusions.policyModalOpen = false;
        renderParticipationExclusions();
        return;
      }
      if (event.key === "Escape" && state.marketEditorCode) {
        state.marketEditorCode = "";
        renderMarketGovernance();
        return;
      }
    });
  }

  function cacheElements() {
    el.status = $("economy-status");
    el.refresh = $("economy-refresh");
    el.searchInput = $("economy-search-input");
    el.searchSubmit = $("economy-search-submit");
    el.identityCount = $("economy-identity-count");
    el.itemCount = $("economy-item-count");
    el.identitiesList = $("economy-identities-list");
    el.identitiesEmpty = $("economy-identities-empty");
    el.walletInspector = $("economy-wallet-inspector");
    el.ledgerList = $("economy-ledger-list");
    el.economyActions = $("economy-actions");
    el.inventoryList = $("economy-inventory-list");
    el.inventoryActions = $("economy-inventory-actions");
    el.exchangeActions = $("economy-exchange-actions");
    el.inventoryEventsList = $("economy-inventory-events-list");
    el.marketGovernance = $("economy-market-governance");
    el.participationExclusions = $("economy-participation-exclusions");
    el.itemDefinitions = $("economy-item-definitions");
    el.itemCreateForm = $("economy-item-create-form");
    el.dangerZone = $("economy-danger-zone");
    el.settingsForm = $("economy-settings-form");
    el.denominationsList = $("economy-denominations-list");
  }

  window.EconomyInventoryAdminView = {
    async init() {
      cacheElements();
      bind();
      initializeCollapsibles();
      renderAll();
      await loadAssetCatalog();
      await refresh({ silent: true });
    },
    destroy() {
      state.token += 1;
      document.body?.classList?.remove("ss-economy-modal-open");
    }
  };
})();

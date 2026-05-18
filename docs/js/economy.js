/* ============================================================
   StreamSuites Dashboard - Economy / Inventory admin controls
   ============================================================ */

(() => {
  "use strict";

  const IDENTITIES = "/api/admin/economy/identities";
  const ECONOMY_DETAIL = (identityCode) => `/api/admin/economy/identities/${encodeURIComponent(identityCode)}`;
  const ECONOMY_EVENTS = (identityCode) => `/api/admin/economy/identities/${encodeURIComponent(identityCode)}/events`;
  const ECONOMY_EXCHANGE = (identityCode) => `/api/admin/economy/identities/${encodeURIComponent(identityCode)}/exchange`;
  const ECONOMY_EVENT_REVERSE = (eventCode) => `/api/admin/economy/events/${encodeURIComponent(eventCode)}/reverse`;
  const INVENTORY_EVENTS = (identityCode) => `/api/admin/inventory/identities/${encodeURIComponent(identityCode)}/events`;
  const INVENTORY_EVENT_CREATE = (identityCode) => `/api/admin/inventory/identities/${encodeURIComponent(identityCode)}/events`;
  const INVENTORY_EVENT_REVERSE = (eventCode) => `/api/admin/inventory/events/${encodeURIComponent(eventCode)}/reverse`;
  const ITEM_DEFINITIONS = "/api/admin/inventory/items";
  const ITEM_DEFINITION = (itemCode) => `/api/admin/inventory/items/${encodeURIComponent(itemCode)}`;
  const ECONOMY_SETTINGS = "/api/admin/economy/settings";
  const ECONOMY_DENOMINATIONS = "/api/admin/economy/denominations";
  const PUBLIC_GAME_BACKUP = "/api/admin/public-game-authority/backup";
  const PUBLIC_GAME_RESET = "/api/admin/public-game-authority/reset";
  const GAME_ASSET_CATALOG = "/assets/games/asset-catalog.json";
  const IMAGE_EXTENSION_PATTERN = /\.(avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;
  const IDENTITY_PAGE_SIZE = 10;
  const EVENT_PAGE_SIZE = 8;
  const ITEM_PAGE_SIZE = 6;

  const state = {
    identities: [],
    selectedIdentityCode: "",
    detail: null,
    itemDefinitions: [],
    categoryPresets: [],
    rarityPresets: [],
    economySettings: {
      currency_unit_label: "Credit",
      currency_unit_plural_label: "Credits",
      currency_symbol_path: "assets/games/currencyunit.svg"
    },
    denominations: [],
    identityPage: 1,
    economyEventPage: 1,
    inventoryEventPage: 1,
    itemPage: 1,
    itemEditorCode: "",
    assetCatalog: [],
    assetCatalogLoaded: false,
    assetCatalogError: "",
    assetPicker: {
      open: false,
      target: "",
      selectedPath: "",
      filter: "",
      mode: "bundled",
      customUrl: ""
    },
    token: 0,
    saving: false,
    bound: false
  };

  const el = {};

  function $(id) {
    return document.getElementById(id);
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
      throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
    }
    return payload;
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

  function formatLabel(value) {
    return text(value).replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function normalizeItemIconPath(path) {
    const value = text(path);
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
    const publicPath = normalized.replace(/^docs\/+/i, "");
    const gameAssetMatch = publicPath.match(/(?:^|\/)assets\/games\/([^/?#]+)$/i);
    if (gameAssetMatch) return `assets/games/${gameAssetMatch[1]}`;
    return publicPath;
  }

  function assetPath(path) {
    const value = normalizeItemIconPath(path);
    if (!value) return "";
    return value.startsWith("/") || /^https?:\/\//i.test(value) ? value : `/${value.replace(/^\/+/, "")}`;
  }

  function isLikelyImageUrl(path) {
    const value = text(path);
    return /^https?:\/\//i.test(value) && IMAGE_EXTENSION_PATTERN.test(value);
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

  function identityUserCode(identity = {}, wallet = {}) {
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
    return text(identity.public_identity_code || identity.fallback_public_identity_code || identity.identity_code || wallet.public_identity_code || wallet.identity_code);
  }

  function identityAvatar(identity = {}) {
    return text(identity.avatar_url);
  }

  function renderAvatar(identity = {}, wallet = {}) {
    const avatarUrl = identityAvatar(identity);
    const displayName = text(identity.display_name || wallet.display_name || identityUserCode(identity, wallet) || "Identity");
    if (avatarUrl) {
      return `<span class="ss-economy-avatar has-image"><img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)} avatar" loading="lazy" decoding="async" /></span>`;
    }
    return `<span class="ss-economy-avatar" aria-hidden="true">${escapeHtml((displayName || "?").slice(0, 1).toUpperCase())}</span>`;
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

  function renderDenominationBreakdown(wallet = {}) {
    const breakdown = Array.isArray(wallet.denomination_breakdown) ? wallet.denomination_breakdown : [];
    const visible = breakdown.filter((item) => item?.should_display || item?.always_show_in_balance || Number(item?.count || 0) > 0);
    if (!visible.length) return `<div class="ss-empty ss-empty-compact">No denomination breakdown returned.</div>`;
    return `
      <div class="ss-economy-denomination-breakdown">
        ${visible.map((item) => `
          <span class="ss-economy-denomination-chip" title="${escapeHtml(formatNumber(item.value_in_credits || 0))} credits each">
            <img src="${escapeHtml(assetPath(item.icon_path))}" alt="" loading="lazy" decoding="async" />
            <strong>${formatNumber(item.count || 0)}</strong>
            <span>${escapeHtml(Number(item.count || 0) === 1 ? item.label : item.plural_label || item.label)}</span>
          </span>
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
    return text(definition.category || item.category || "Uncategorized");
  }

  function itemIcon(item = {}) {
    const definition = item.definition || itemDefinitionFor(item.item_code) || {};
    return text(definition.icon_path || item.icon_path);
  }

  function presetOptions(values = [], selected = "") {
    return (Array.isArray(values) ? values : [])
      .map((value) => `<option value="${escapeHtml(value)}" ${text(value) === text(selected) ? "selected" : ""}>${escapeHtml(value)}</option>`)
      .join("");
  }

  function catalogAssetPath(item = {}) {
    return normalizeItemIconPath(item.path || item.url || item.icon_path || "");
  }

  function normalizeAssetCatalog(items = []) {
    return (Array.isArray(items) ? items : [])
      .map((item) => {
        const path = catalogAssetPath(item);
        if (!path) return null;
        const filename = text(item.filename || path.split("/").pop());
        const extension = text(item.extension || filename.split(".").pop()).toLowerCase();
        return {
          path,
          filename,
          extension,
          label: text(item.label || formatLabel(filename.replace(/\.[^.]+$/, ""))),
          category: text(item.category || "game"),
          size_bytes: Number(item.size_bytes || 0)
        };
      })
      .filter(Boolean);
  }

  async function loadAssetCatalog() {
    if (state.assetCatalogLoaded) return;
    state.assetCatalogLoaded = true;
    try {
      const response = await fetch(GAME_ASSET_CATALOG, { cache: "no-store" });
      if (!response.ok) throw new Error(`Asset catalog unavailable (${response.status})`);
      const payload = await response.json();
      state.assetCatalog = normalizeAssetCatalog(payload.items || payload.assets || []);
      state.assetCatalogError = state.assetCatalog.length ? "" : "No bundled game assets were listed in the catalog.";
    } catch (err) {
      state.assetCatalog = [];
      state.assetCatalogError = err?.message || "Asset catalog unavailable.";
    }
  }

  function iconInputForTarget(target = state.assetPicker.target) {
    if (target === "create") return $("#economy-item-create-icon");
    const row = target ? document.querySelector(`.ss-economy-item-definition[data-item-code="${CSS.escape(target)}"]`) : null;
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

  function renderIconPreview(path) {
    const normalized = normalizeItemIconPath(path);
    const fallback = assetPreviewLabel(normalized);
    if (!normalized || fallback) {
      return `<span class="ss-economy-icon-preview-placeholder">${escapeHtml(fallback || "No icon configured")}</span>`;
    }
    return `<img src="${escapeHtml(assetPath(normalized))}" alt="" loading="lazy" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement('span'), { className: 'ss-economy-icon-preview-placeholder', textContent: 'Preview unavailable' }))" /><span>${escapeHtml(normalized)}</span>`;
  }

  function syncIconPreview(input) {
    const target = input?.id === "economy-item-create-icon" ? "create" : text(input?.closest(".ss-economy-item-definition")?.dataset?.itemCode);
    const preview = document.querySelector(`[data-icon-preview="${CSS.escape(target)}"]`);
    if (preview) preview.innerHTML = renderIconPreview(input.value);
  }

  function renderAssetPicker() {
    const modals = Array.from(document.querySelectorAll("#economy-asset-picker"));
    const existing = modals[0] || null;
    modals.slice(1).forEach((modal) => modal.remove());
    if (!state.assetPicker.open) {
      existing?.remove();
      return;
    }
    const selectedPath = normalizeItemIconPath(state.assetPicker.selectedPath || currentIconInputValue());
    const customUrl = text(state.assetPicker.customUrl || (/^https?:\/\//i.test(selectedPath) ? selectedPath : ""));
    const query = text(state.assetPicker.filter).toLowerCase();
    const assets = state.assetCatalog.filter((item) => {
      if (!query) return true;
      return `${item.filename} ${item.path} ${item.label} ${item.category}`.toLowerCase().includes(query);
    });
    const selectedAsset = state.assetCatalog.find((item) => item.path === selectedPath) || assets[0] || null;
    const previewPath = state.assetPicker.mode === "custom" ? customUrl : selectedPath || selectedAsset?.path || "";
    const modal = existing || document.createElement("div");
    modal.id = "economy-asset-picker";
    modal.className = "ss-economy-asset-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "economy-asset-picker-title");
    modal.innerHTML = `
      <div class="ss-economy-asset-dialog">
        <header class="ss-economy-asset-head">
          <div>
            <span class="ss-subtitle">Item Icon</span>
            <h3 id="economy-asset-picker-title">Choose asset</h3>
          </div>
          <button class="ss-icon-btn ss-economy-asset-close" type="button" aria-label="Close asset picker" data-asset-close>&times;</button>
        </header>
        <div class="ss-economy-asset-tabs" role="tablist" aria-label="Asset source">
          <button class="ss-btn ${state.assetPicker.mode === "bundled" ? "" : "ss-btn-secondary"}" type="button" data-asset-mode="bundled">Bundled assets</button>
          <button class="ss-btn ${state.assetPicker.mode === "custom" ? "" : "ss-btn-secondary"}" type="button" data-asset-mode="custom">External URL</button>
        </div>
        ${
          state.assetPicker.mode === "custom"
            ? `<div class="ss-economy-asset-custom">
                <label>External image URL<input id="economy-asset-custom-url" value="${escapeHtml(customUrl)}" placeholder="https://example.com/icon.webp" /></label>
                <p class="muted">Use bundled assets from the browser when possible. External URLs can be pasted here when the image is hosted elsewhere and ends with a normal image extension.</p>
              </div>`
            : `<label class="ss-economy-asset-search">Search assets<input id="economy-asset-filter" value="${escapeHtml(state.assetPicker.filter)}" placeholder="coin, gem, crate..." /></label>
               <div class="ss-economy-asset-grid">
                ${
                  assets.length
                    ? assets.map((item) => `
                        <button class="ss-economy-asset-tile${item.path === selectedPath ? " is-selected" : ""}" type="button" data-asset-path="${escapeHtml(item.path)}">
                          <img src="${escapeHtml(assetPath(item.path))}" alt="" loading="lazy" decoding="async" />
                          <strong>${escapeHtml(item.label)}</strong>
                          <span>${escapeHtml(item.path)}</span>
                        </button>
                      `).join("")
                    : `<div class="ss-empty ss-empty-compact">${escapeHtml(state.assetCatalogError || "No matching assets.")}</div>`
                }
               </div>`
        }
        <aside class="ss-economy-asset-preview">
          <strong>Preview</strong>
          <div class="ss-economy-asset-preview-frame">${renderIconPreview(previewPath)}</div>
          <code>${escapeHtml(normalizeItemIconPath(previewPath) || "No icon configured")}</code>
        </aside>
        <footer class="ss-economy-asset-actions">
          <button class="ss-btn ss-btn-secondary" type="button" data-asset-close>Cancel</button>
          <button class="ss-btn" type="button" data-asset-use ${state.assetPicker.mode === "custom" && customUrl && !isLikelyImageUrl(customUrl) ? "disabled" : ""}>Use selected asset</button>
        </footer>
      </div>
    `;
    if (!existing) document.body.appendChild(modal);
    setTimeout(() => ($("#economy-asset-filter") || $("#economy-asset-custom-url") || modal.querySelector("[data-asset-close]"))?.focus?.(), 0);
  }

  function renderItemIcon(item = {}) {
    const icon = normalizeItemIconPath(itemIcon(item));
    const fallbackLabel = assetPreviewLabel(icon);
    if (icon && !fallbackLabel) {
      return `<span class="ss-economy-item-icon has-image"><img src="${escapeHtml(assetPath(icon))}" alt="" loading="lazy" decoding="async" onerror="this.closest('.ss-economy-item-icon')?.classList.add('is-unavailable'); this.remove();" /><span class="ss-economy-item-icon-fallback">Preview unavailable</span></span>`;
    }
    return `<span class="ss-economy-item-icon" title="${escapeHtml(fallbackLabel || "No icon configured")}" aria-label="${escapeHtml(fallbackLabel || "No icon configured")}">${escapeHtml((itemLabel(item) || "?").slice(0, 1).toUpperCase())}</span>`;
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
    const pageInfo = pageSlice(state.identities, state.identityPage, IDENTITY_PAGE_SIZE);
    state.identityPage = pageInfo.page;
    el.identitiesList.innerHTML = pageInfo.items
      .map((entry) => {
        const identity = entry.identity || {};
        const wallet = entry.wallet || {};
        const identityCode = identity.public_identity_code || identity.identity_code || wallet.identity_code || "";
        const displayName = text(identity.display_name || wallet.display_name || identityUserCode(identity, wallet) || identityCode);
        const userCode = identityUserCode(identity, wallet);
        const fallbackCode = identityFallbackCode(identity, wallet);
        const selected = state.selectedIdentityCode === identityCode;
        return `
          <button class="ss-economy-identity${selected ? " is-selected" : ""}" type="button" data-identity-code="${escapeHtml(identityCode)}">
            ${renderAvatar(identity, wallet)}
            <span class="ss-economy-identity-main">
              <strong>${escapeHtml(displayName)}</strong>
              <span>User code: ${escapeHtml(userCode || "Unclaimed")}</span>
              <span>Public identity: ${escapeHtml(fallbackCode || identityCode)}</span>
            </span>
            <span class="ss-economy-identity-side">
              ${renderCreditValue(wallet.balance_total_credits ?? wallet.balance_current ?? 0, { compact: true })}
              <span>${formatNumber(entry.inventory_item_count || 0)} items</span>
            </span>
          </button>
        `;
      })
      .join("") + renderPager("identities", pageInfo, "Identity page");
  }

  function renderWallet() {
    if (!el.walletInspector) return;
    const detail = state.detail || {};
    const wallet = detail.wallet || null;
    const identity = detail.identity || {};
    if (!wallet) {
      el.walletInspector.className = "ss-economy-inspector ss-empty";
      el.walletInspector.textContent = "Select an identity to inspect wallet state.";
      return;
    }
    el.walletInspector.className = "ss-economy-inspector";
    el.walletInspector.innerHTML = `
      <div class="ss-economy-wallet-head">
        ${renderAvatar(identity, wallet)}
        <div>
          <strong>${escapeHtml(identity.display_name || wallet.display_name || identityUserCode(identity, wallet))}</strong>
          <span class="muted">Public identity: ${escapeHtml(identityFallbackCode(identity, wallet))}</span>
        </div>
      </div>
      <div class="ss-economy-kpis">
        <div><span>Total balance</span><strong>${renderCreditValue(wallet.balance_total_credits ?? wallet.balance_current ?? 0, { prominent: true })}</strong></div>
        <div><span>Cash balance</span><strong>${renderCreditValue(wallet.cash_balance_credits ?? wallet.balance_current ?? 0)}</strong></div>
        <div><span>Held item value</span><strong>${renderCreditValue(wallet.held_value_credits ?? 0)}</strong></div>
        <div><span>Earned lifetime</span><strong>${formatNumber(wallet.earned_lifetime || 0)}</strong></div>
        <div><span>Spent lifetime</span><strong>${formatNumber(wallet.spent_lifetime || 0)}</strong></div>
        <div><span>Adjusted total</span><strong>${formatNumber(wallet.adjusted_total || 0)}</strong></div>
        <div><span>Last event</span><strong>${escapeHtml(wallet.last_event_at || "No events")}</strong></div>
      </div>
      ${renderDenominationBreakdown(wallet)}
    `;
  }

  function renderInventory() {
    const detail = state.detail || {};
    const inventory = Array.isArray(detail.inventory) ? detail.inventory : [];
    el.inventoryList.innerHTML = inventory.length
      ? inventory
          .map((item) => `
            <article class="ss-economy-item-row">
              ${renderItemIcon(item)}
              <div>
                <strong>${escapeHtml(itemLabel(item))}</strong>
                <span class="muted">${escapeHtml(item.item_code)} · ${escapeHtml(itemCategory(item))}</span>
              </div>
              <strong>${formatNumber(item.quantity || 0)}</strong>
            </article>
          `)
          .join("")
      : `<div class="ss-empty">No positive-quantity inventory rows for this identity.</div>`;
  }

  function renderEvents() {
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
      ? denominations.map((item) => `
          <article class="ss-economy-denomination-row">
            ${renderItemIcon({ label: item.label, icon_path: item.icon_path })}
            <div class="ss-economy-denomination-main">
              <strong>${escapeHtml(item.label || item.denomination_code)}</strong>
              <span class="muted">${escapeHtml(item.denomination_code)} · ${formatNumber(item.value_in_credits || 0)} ${escapeHtml(currencyPluralLabel(item.value_in_credits || 0))}</span>
              <span class="muted">${item.always_show_in_balance ? "Always shown in balance" : "Shown only when nonzero"} · ${item.is_high_value_unit ? "High-value unit" : "Base unit"} · ${item.is_enabled ? "Enabled" : "Disabled"}</span>
            </div>
            <span class="ss-economy-state ${item.is_enabled ? "ss-economy-state-active" : "ss-economy-state-reversed"}">${escapeHtml(item.is_enabled ? "Enabled" : "Disabled")}</span>
          </article>
        `).join("")
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
    el.inventoryActions.innerHTML = `
      <div class="ss-economy-action-grid">
        <label>Action<select id="inventory-action-type"><option value="grant">Grant</option><option value="remove">Remove</option><option value="adjustment">Adjust</option></select></label>
        <label>Item<select id="inventory-action-item">${state.itemDefinitions.map((item) => `<option value="${escapeHtml(item.item_code)}">${escapeHtml(item.item_code)} - ${escapeHtml(item.label || item.item_code)}</option>`).join("")}</select></label>
        <label>Quantity<input id="inventory-action-quantity" type="number" step="1" value="0" /></label>
        <label class="ss-economy-wide">Reason<input id="inventory-action-reason" type="text" placeholder="Required manual action note" /></label>
        <button id="inventory-action-submit" class="ss-btn" type="button">Apply inventory action</button>
      </div>
      <div class="ss-economy-reversal-box">
        <label>Selected event code<input id="inventory-reversal-code" type="text" placeholder="inv_..." /></label>
        <label>Reversal reason<input id="inventory-reversal-reason" type="text" placeholder="Required reversal note" /></label>
        <button id="inventory-reversal-submit" class="ss-btn ss-btn-secondary" type="button">Create inventory reversal</button>
      </div>
    `;
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

  function renderItemDefinitions() {
    if (!el.itemDefinitions) return;
    el.itemCount.textContent = formatNumber(state.itemDefinitions.length);
    const pageInfo = pageSlice(state.itemDefinitions, state.itemPage, ITEM_PAGE_SIZE);
    state.itemPage = pageInfo.page;
    el.itemDefinitions.innerHTML = pageInfo.items
      .map((item) => {
        const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
        const notes = text(metadata.notes || metadata.admin_notes || metadata.description || "");
        const systemType = text(metadata.system_asset_type || metadata.denomination_code || "");
        const assetChip = systemType
          ? (metadata.wallet_balance_unit ? "Currency unit" : "Denomination")
          : "Inventory item";
        const isEditing = state.itemEditorCode === item.item_code;
        const normalizedIcon = normalizeItemIconPath(item.icon_path || "");
        return `
          <article class="ss-economy-item-definition${isEditing ? " is-editing" : ""}" data-item-code="${escapeHtml(item.item_code)}">
            <div class="ss-economy-item-definition-summary">
              ${renderItemIcon(item)}
              <div class="ss-economy-item-definition-main">
                <strong>${escapeHtml(item.label || item.item_code)}</strong>
                <span class="muted">item_code: ${escapeHtml(item.item_code)} · ${escapeHtml(item.category || "Uncategorized")} · ${escapeHtml(item.rarity || "No rarity")} · ${item.is_enabled === false ? "disabled" : "enabled"}</span>
                <span class="ss-economy-item-chip">${escapeHtml(assetChip)}</span>
                <span class="muted ss-economy-item-path">${escapeHtml(normalizedIcon || "No icon configured")}</span>
                ${notes ? `<span class="muted ss-economy-item-notes">${escapeHtml(notes)}</span>` : ""}
              </div>
              <button class="ss-btn ss-btn-secondary ss-economy-item-edit" type="button" data-item-code="${escapeHtml(item.item_code)}">${isEditing ? "Close" : "Edit"}</button>
            </div>
            ${
              isEditing
                ? `<div class="ss-economy-item-editor">
                    <section class="ss-economy-item-editor-card ss-economy-item-editor-card--title">
                      ${renderItemIcon(item)}
                      <div>
                        <span class="muted">Editing item definition</span>
                        <strong>${escapeHtml(item.label || item.item_code)}</strong>
                        <code>${escapeHtml(item.item_code)}</code>
                      </div>
                    </section>
                    <section class="ss-economy-item-editor-card">
                      <label>Label<input data-item-field="label" value="${escapeHtml(item.label || "")}" /></label>
                      <label>Category<select data-item-field="category">${presetOptions(state.categoryPresets, item.category || "")}</select></label>
                      <label>Rarity<select data-item-field="rarity">${presetOptions(state.rarityPresets, item.rarity || "")}</select></label>
                      <label>Enabled<select data-item-field="is_enabled"><option value="true" ${item.is_enabled === false ? "" : "selected"}>Enabled</option><option value="false" ${item.is_enabled === false ? "selected" : ""}>Disabled</option></select></label>
                    </section>
                    <section class="ss-economy-item-editor-card ss-economy-icon-card">
                      ${renderIconPathControl({ itemCode: item.item_code, value: normalizedIcon })}
                    </section>
                    <section class="ss-economy-item-editor-card">
                      <label class="ss-economy-wide">Metadata notes<textarea data-item-field="metadata_notes" rows="3">${escapeHtml(notes)}</textarea></label>
                      <label class="ss-economy-wide">Reason<input data-item-field="reason_text" placeholder="Required before save" /></label>
                      <button class="ss-btn ss-economy-item-save" type="button" data-item-code="${escapeHtml(item.item_code)}">Save metadata</button>
                    </section>
                  </div>`
                : ""
            }
          </article>
        `;
      })
      .join("") + renderPager("items", pageInfo, "Item page");
  }

  function renderItemCreateForm() {
    if (!el.itemCreateForm) return;
    el.itemCreateForm.innerHTML = `
      <div class="ss-economy-action-grid ss-economy-item-create-grid">
        <label>Item code<input id="economy-item-create-code" type="text" placeholder="category.item_name" /></label>
        <label>Label<input id="economy-item-create-label" type="text" placeholder="Display label" /></label>
        <label>Category<select id="economy-item-create-category">${presetOptions(state.categoryPresets)}</select></label>
        <label>Rarity<select id="economy-item-create-rarity">${presetOptions(state.rarityPresets)}</select></label>
        <label>Enabled<select id="economy-item-create-enabled"><option value="true">Enabled</option><option value="false">Disabled</option></select></label>
        ${renderIconPathControl({ create: true })}
        <label class="ss-economy-wide">Metadata notes<textarea id="economy-item-create-notes" rows="3"></textarea></label>
        <label class="ss-economy-wide">Reason<input id="economy-item-create-reason" type="text" placeholder="Required creation note" /></label>
        <button id="economy-item-create-submit" class="ss-btn" type="button">Create item definition</button>
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
    renderInventory();
    renderEvents();
    renderActions();
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
    const payload = await requestJson(ITEM_DEFINITIONS);
    state.itemDefinitions = Array.isArray(payload.item_definitions) ? payload.item_definitions : [];
    state.categoryPresets = Array.isArray(payload.category_presets) ? payload.category_presets : [];
    state.rarityPresets = Array.isArray(payload.rarity_presets) ? payload.rarity_presets : [];
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

  async function refresh(options = {}) {
    const token = ++state.token;
    setStatus("Loading economy controls...");
    try {
      await Promise.all([loadEconomyConfig(), loadItems(), loadIdentities(), loadAssetCatalog()]);
      if (state.selectedIdentityCode) {
        await loadDetail(state.selectedIdentityCode);
      }
      if (token !== state.token) return;
      renderAll();
      setStatus(options.silent ? "" : "Economy controls loaded.", "success");
    } catch (err) {
      setStatus(err?.message || "Failed to load economy controls.", "error");
    }
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
    const row = button.closest(".ss-economy-item-definition");
    const itemCode = text(row?.dataset?.itemCode);
    const readField = (field) => text(row?.querySelector(`[data-item-field="${field}"]`)?.value);
    const reason = readField("reason_text");
    if (!itemCode || !reason) {
      setStatus("Item definition metadata changes require a reason.", "error");
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
        metadata: {
          notes: readField("metadata_notes")
        },
        reason_text: reason
      })
    });
    await loadItems();
    renderAll();
    setStatus("Item definition metadata saved.", "success");
  }

  async function createItemDefinition() {
    const reason = text($("#economy-item-create-reason")?.value);
    if (!reason) {
      setStatus("New item definitions require a reason.", "error");
      return;
    }
    await requestJson(ITEM_DEFINITIONS, {
      method: "POST",
      body: JSON.stringify({
        item: {
          item_code: text($("#economy-item-create-code")?.value),
          label: text($("#economy-item-create-label")?.value),
          category: text($("#economy-item-create-category")?.value),
          rarity: text($("#economy-item-create-rarity")?.value),
          icon_path: normalizeItemIconPath($("#economy-item-create-icon")?.value),
          is_enabled: text($("#economy-item-create-enabled")?.value) !== "false",
          metadata: { notes: text($("#economy-item-create-notes")?.value) }
        },
        reason_text: reason
      })
    });
    await loadItems();
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
    document.addEventListener("click", async (event) => {
      const browseButton = event.target.closest?.(".ss-economy-asset-browse");
      if (browseButton) {
        await loadAssetCatalog();
        const target = text(browseButton.dataset.assetTarget);
        const current = currentIconInputValue(target);
        state.assetPicker = {
          open: true,
          target,
          selectedPath: current,
          filter: "",
          mode: /^https?:\/\//i.test(current) ? "custom" : "bundled",
          customUrl: /^https?:\/\//i.test(current) ? current : ""
        };
        renderAssetPicker();
        return;
      }
      if (event.target.closest?.("[data-asset-close]")) {
        state.assetPicker.open = false;
        renderAssetPicker();
        return;
      }
      const modeButton = event.target.closest?.("[data-asset-mode]");
      if (modeButton) {
        state.assetPicker.mode = modeButton.dataset.assetMode === "custom" ? "custom" : "bundled";
        renderAssetPicker();
        return;
      }
      const assetTile = event.target.closest?.("[data-asset-path]");
      if (assetTile) {
        state.assetPicker.selectedPath = normalizeItemIconPath(assetTile.dataset.assetPath);
        renderAssetPicker();
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
        }
        state.assetPicker.open = false;
        renderAssetPicker();
        return;
      }
      const identityButton = event.target.closest?.(".ss-economy-identity");
      if (identityButton) {
        state.selectedIdentityCode = text(identityButton.dataset.identityCode);
        await loadDetail(state.selectedIdentityCode);
        renderAll();
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
        }
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
      if (event.target.closest?.("#economy-item-create-submit")) {
        try {
          await createItemDefinition();
        } catch (err) {
          setStatus(err?.message || "Item definition create failed.", "error");
        }
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
      }
      const itemEditButton = event.target.closest?.(".ss-economy-item-edit");
      if (itemEditButton) {
        const code = text(itemEditButton.dataset.itemCode);
        state.itemEditorCode = state.itemEditorCode === code ? "" : code;
        renderItemDefinitions();
      }
    });
    document.addEventListener("input", (event) => {
      if (event.target.closest?.("#economy-exchange-actions")) {
        syncExchangePreview();
      }
      if (event.target.matches?.('[data-item-field="icon_path"], #economy-item-create-icon')) {
        const normalized = normalizeItemIconPath(event.target.value);
        if (event.target.value !== normalized) event.target.value = normalized;
        syncIconPreview(event.target);
      }
      if (event.target.matches?.("#economy-asset-filter")) {
        state.assetPicker.filter = event.target.value;
        renderAssetPicker();
      }
      if (event.target.matches?.("#economy-asset-custom-url")) {
        state.assetPicker.customUrl = event.target.value;
        state.assetPicker.selectedPath = normalizeItemIconPath(event.target.value);
        renderAssetPicker();
      }
    });
    document.addEventListener("change", (event) => {
      if (event.target.closest?.("#economy-exchange-actions")) {
        syncExchangePreview();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.assetPicker.open) {
        state.assetPicker.open = false;
        renderAssetPicker();
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
    }
  };
})();

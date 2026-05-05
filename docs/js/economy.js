/* ============================================================
   StreamSuites Dashboard - Economy / Inventory admin controls
   ============================================================ */

(() => {
  "use strict";

  const IDENTITIES = "/api/admin/economy/identities";
  const ECONOMY_DETAIL = (identityCode) => `/api/admin/economy/identities/${encodeURIComponent(identityCode)}`;
  const ECONOMY_EVENTS = (identityCode) => `/api/admin/economy/identities/${encodeURIComponent(identityCode)}/events`;
  const ECONOMY_EVENT_REVERSE = (eventCode) => `/api/admin/economy/events/${encodeURIComponent(eventCode)}/reverse`;
  const INVENTORY_EVENTS = (identityCode) => `/api/admin/inventory/identities/${encodeURIComponent(identityCode)}/events`;
  const INVENTORY_EVENT_CREATE = (identityCode) => `/api/admin/inventory/identities/${encodeURIComponent(identityCode)}/events`;
  const INVENTORY_EVENT_REVERSE = (eventCode) => `/api/admin/inventory/events/${encodeURIComponent(eventCode)}/reverse`;
  const ITEM_DEFINITIONS = "/api/admin/inventory/items";
  const ITEM_DEFINITION = (itemCode) => `/api/admin/inventory/items/${encodeURIComponent(itemCode)}`;
  const COIN_ICON_PATH = "/assets/games/sscoin.webp";
  const IDENTITY_PAGE_SIZE = 10;
  const EVENT_PAGE_SIZE = 8;
  const ITEM_PAGE_SIZE = 6;

  const state = {
    identities: [],
    selectedIdentityCode: "",
    detail: null,
    itemDefinitions: [],
    identityPage: 1,
    economyEventPage: 1,
    inventoryEventPage: 1,
    itemPage: 1,
    itemEditorCode: "",
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

  function renderCoinValue(value, options = {}) {
    return `
      <span class="ss-economy-coin-value${options.compact ? " ss-economy-coin-value--compact" : ""}">
        <img class="ss-economy-coin-icon" src="${COIN_ICON_PATH}" alt="" loading="lazy" decoding="async" />
        <span>${formatNumber(value)} coins</span>
      </span>
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

  function renderItemIcon(item = {}) {
    const icon = itemIcon(item);
    if (icon) {
      const path = icon.startsWith("/") || /^https?:\/\//i.test(icon) ? icon : `/${icon.replace(/^\/+/, "")}`;
      return `<span class="ss-economy-item-icon has-image"><img src="${escapeHtml(path)}" alt="" loading="lazy" decoding="async" /></span>`;
    }
    return `<span class="ss-economy-item-icon" aria-hidden="true">${escapeHtml((itemLabel(item) || "?").slice(0, 1).toUpperCase())}</span>`;
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
          ${renderCoinValue(event.amount_delta || 0, { compact: true })}
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
              ${renderCoinValue(wallet.balance_current || 0, { compact: true })}
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
        <div><span>Current balance</span><strong>${renderCoinValue(wallet.balance_current || 0)}</strong></div>
        <div><span>Earned lifetime</span><strong>${formatNumber(wallet.earned_lifetime || 0)}</strong></div>
        <div><span>Spent lifetime</span><strong>${formatNumber(wallet.spent_lifetime || 0)}</strong></div>
        <div><span>Adjusted total</span><strong>${formatNumber(wallet.adjusted_total || 0)}</strong></div>
        <div><span>Last event</span><strong>${escapeHtml(wallet.last_event_at || "No events")}</strong></div>
      </div>
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

  function renderActions() {
    const identityCode = state.selectedIdentityCode;
    if (!identityCode) {
      el.economyActions.className = "ss-economy-actions ss-empty";
      el.economyActions.textContent = "Select an identity to apply manual economy controls.";
      el.inventoryActions.className = "ss-economy-actions ss-empty";
      el.inventoryActions.textContent = "Select an identity to apply manual inventory controls.";
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
        <label>Item<select id="inventory-action-item">${state.itemDefinitions.map((item) => `<option value="${escapeHtml(item.item_code)}">${escapeHtml(item.label || item.item_code)}</option>`).join("")}</select></label>
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
        const isEditing = state.itemEditorCode === item.item_code;
        return `
          <article class="ss-economy-item-definition${isEditing ? " is-editing" : ""}" data-item-code="${escapeHtml(item.item_code)}">
            <div class="ss-economy-item-definition-summary">
              ${renderItemIcon(item)}
              <div class="ss-economy-item-definition-main">
                <strong>${escapeHtml(item.label || item.item_code)}</strong>
                <span class="muted">${escapeHtml(item.item_code)} · ${escapeHtml(item.category || "Uncategorized")} · ${escapeHtml(item.rarity || "No rarity")} · ${item.is_enabled === false ? "disabled" : "enabled"}</span>
                <span class="muted ss-economy-item-path">${escapeHtml(item.icon_path || "No icon path configured")}</span>
                ${notes ? `<span class="muted ss-economy-item-notes">${escapeHtml(notes)}</span>` : ""}
              </div>
              <button class="ss-btn ss-btn-secondary ss-economy-item-edit" type="button" data-item-code="${escapeHtml(item.item_code)}">${isEditing ? "Close" : "Edit"}</button>
            </div>
            ${
              isEditing
                ? `<div class="ss-economy-item-editor">
                    <label>Label<input data-item-field="label" value="${escapeHtml(item.label || "")}" /></label>
                    <label>Category<input data-item-field="category" value="${escapeHtml(item.category || "")}" /></label>
                    <label>Rarity<input data-item-field="rarity" value="${escapeHtml(item.rarity || "")}" /></label>
                    <label>Enabled<select data-item-field="is_enabled"><option value="true" ${item.is_enabled === false ? "" : "selected"}>Enabled</option><option value="false" ${item.is_enabled === false ? "selected" : ""}>Disabled</option></select></label>
                    <label class="ss-economy-wide">Icon path<input data-item-field="icon_path" value="${escapeHtml(item.icon_path || "")}" placeholder="assets/games/sscoin.webp" /></label>
                    <label class="ss-economy-wide">Metadata notes<textarea data-item-field="metadata_notes" rows="3">${escapeHtml(notes)}</textarea></label>
                    <label class="ss-economy-wide">Reason<input data-item-field="reason_text" placeholder="Required before save" /></label>
                    <button class="ss-btn ss-economy-item-save" type="button" data-item-code="${escapeHtml(item.item_code)}">Save metadata</button>
                  </div>`
                : ""
            }
          </article>
        `;
      })
      .join("") + renderPager("items", pageInfo, "Item page");
  }

  function renderAll() {
    renderIdentities();
    renderWallet();
    renderInventory();
    renderEvents();
    renderActions();
    renderItemDefinitions();
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
      await Promise.all([loadItems(), loadIdentities()]);
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
    const eventType = text($("#economy-action-type")?.value);
    const amount = Number($("#economy-action-amount")?.value || 0);
    const reason = text($("#economy-action-reason")?.value);
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
    const reason = text($("#economy-reversal-reason")?.value);
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
    const eventType = text($("#inventory-action-type")?.value);
    const itemCode = text($("#inventory-action-item")?.value);
    const quantity = Number($("#inventory-action-quantity")?.value || 0);
    const reason = text($("#inventory-action-reason")?.value);
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

  async function reverseInventoryEvent(code = text($("#inventory-reversal-code")?.value)) {
    const reason = text($("#inventory-reversal-reason")?.value);
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

  async function saveItemDefinition(button) {
    const row = button.closest("[data-item-code]");
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
        icon_path: readField("icon_path"),
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
    el.inventoryEventsList = $("economy-inventory-events-list");
    el.itemDefinitions = $("economy-item-definitions");
  }

  window.EconomyInventoryAdminView = {
    async init() {
      cacheElements();
      bind();
      initializeCollapsibles();
      renderAll();
      await refresh({ silent: true });
    },
    destroy() {
      state.token += 1;
    }
  };
})();

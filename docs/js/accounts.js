/* ============================================================
   StreamSuites Dashboard — Accounts view (admin actions)
   ============================================================ */

(() => {
  "use strict";

  const RUNTIME_ENDPOINT = "/admin/accounts";
  const ANALYTICS_ENDPOINT = "/api/admin/analytics";
  const ANALYTICS_WINDOW = "5m";
  const ANALYTICS_CACHE_TTL_MS = 8000;
  const COLUMN_WIDTH_STORAGE_KEY = "ss_admin_accounts_colwidths_v2";
  const ROW_CLICK_DELAY_MS = 240;
  const SEARCH_FIELDS = [
    "userCode",
    "email",
    "displayName",
    "role",
    "tier",
    "accountStatus",
    "onboardingStatus",
    "emailVerifiedLabel",
    "supporterLabel"
  ];

  const state = {
    raw: [],
    manager: null,
    sourceLabel: "—",
    selfId: "",
    selfEmail: "",
    canManage: false,
    sourceMode: "runtime",
    exportLoading: false,
    donationStats: new Map(),
    donationsLoaded: false,
    openDrawerId: "",
    columnResize: null,
    columnResizeHydrated: false,
    escapeBound: false,
    rowClickTimer: null,
    drawerCloseTimer: null
  };

  const el = {
    banner: null,
    status: null,
    source: null,
    count: null,
    body: null,
    table: null,
    tableScroll: null,
    appMain: null,
    pagination: null,
    empty: null,
    search: null,
    roleFilter: null,
    tierFilter: null,
    providerFilter: null,
    idToggle: null,
    exportJson: null,
    exportCsv: null,
    exportStatus: null,
    detailsBackdrop: null,
    detailsDrawer: null,
    detailsContent: null,
    detailsClose: null,
    detailsTitle: null,
    detailsSubtitle: null,
    detailsProfile: null,
    detailsActions: null,
    detailsProfileSection: null,
    detailsActionsSection: null,
    detailsActionsHeading: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    if (value === undefined || value === null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatBadgeLabel(value) {
    if (value === undefined || value === null) return "Unknown";
    const text = String(value).trim();
    if (!text || text === "-" || text === "—") return "Unknown";
    return text
      .replace(/[_-]+/g, " ")
      .split(" ")
      .map((part) =>
        part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : ""
      )
      .join(" ");
  }

  function normalizeTierLabel(value) {
    if (value === undefined || value === null) return "";
    const text = String(value).trim();
    if (!text) return "";
    const normalized = text.toLowerCase();
    if (normalized === "open") return "Core";
    return text;
  }

  function resolveTierData(value) {
    if (value === undefined || value === null) return "";
    const text = String(value).trim().toLowerCase();
    if (!text) return "";
    if (text === "open" || text === "core") return "CORE";
    if (text === "gold") return "GOLD";
    if (text === "pro") return "PRO";
    return "";
  }

  function badgeToneForStatus(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized || normalized === "-" || normalized === "—") return "";
    if (["active", "enabled", "completed"].includes(normalized)) {
      return "ss-badge-success";
    }
    if (["suspended", "disabled", "deleted", "blocked", "banned"].includes(normalized)) {
      return "ss-badge-danger";
    }
    if (["required", "pending", "incomplete"].includes(normalized)) {
      return "ss-badge-warning";
    }
    return "";
  }

  function renderBadge(value, tone) {
    const classes = ["ss-badge", tone].filter(Boolean).join(" ");
    const tier = resolveTierData(value);
    const tierAttr = tier ? ` data-tier="${tier}"` : "";
    return `<span class="${classes}"${tierAttr}>${escapeHtml(formatBadgeLabel(value))}</span>`;
  }

  function resolveEmailVerifiedLabel(value) {
    if (value === true) return "Verified";
    if (value === false) return "Not Verified";
    return "Unknown";
  }

  function renderEmailVerified(value) {
    if (value === true) return renderBadge("Verified", "ss-badge-success");
    if (value === false) return renderBadge("Not Verified", "ss-badge-warning");
    return renderBadge("Unknown", "");
  }

  function formatTimestamp(value) {
    if (typeof window.StreamSuitesState?.formatTimestamp === "function") {
      return window.StreamSuitesState.formatTimestamp(value) || "—";
    }
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return date.toISOString().replace("T", " ").replace("Z", " UTC");
  }

  function redactId(value) {
    if (!value) return "";
    const text = String(value);
    if (text.length <= 6) return text;
    return `${text.slice(0, 3)}…${text.slice(-2)}`;
  }

  function resolveProviders(rawProviders) {
    if (!rawProviders) return [];
    if (Array.isArray(rawProviders)) {
      return rawProviders
        .map((entry) => {
          if (typeof entry === "string") return { label: entry };
          if (entry && typeof entry === "object") {
            return {
              label: entry.provider || entry.type || entry.name || "provider",
              id: entry.id || entry.providerId || entry.uid || ""
            };
          }
          return null;
        })
        .filter(Boolean);
    }
    if (typeof rawProviders === "object") {
      return Object.keys(rawProviders).map((key) => ({
        label: key,
        id: rawProviders[key]?.id || rawProviders[key]?.uid || ""
      }));
    }
    return [];
  }

function normalizeUser(raw = {}) {
    const providers = resolveProviders(raw.providers || raw.authProviders || raw.auth_providers);
    let internalId =
      raw.internal_id || raw.internalId || raw.id || raw.uuid || raw.user_id || raw.userId || "";
    if (!String(internalId || "").trim() || String(internalId).trim() === "—") {
      internalId =
        raw.user_code ||
        raw.userCode ||
        raw.email ||
        raw.email_address ||
        raw.username ||
        "";
    }
    if (!String(internalId || "").trim()) {
      internalId = "—";
    }
    const emailVerifiedRaw =
      typeof raw.email_verified === "boolean"
        ? raw.email_verified
        : typeof raw.emailVerified === "boolean"
        ? raw.emailVerified
        : typeof raw.email_verified === "number"
        ? raw.email_verified === 1
        : typeof raw.emailVerified === "number"
        ? raw.emailVerified === 1
        : null;
    return {
      id: internalId,
      userCode: raw.user_code || raw.userCode || raw.code || raw.handle || "—",
      email: raw.email || raw.email_address || raw.username || "—",
      emailVerified: emailVerifiedRaw,
      emailVerifiedLabel: resolveEmailVerifiedLabel(emailVerifiedRaw),
      displayName: raw.display_name || raw.displayName || raw.name || "—",
      role: raw.role || raw.account_role || "—",
      tier: normalizeTierLabel(raw.tier || raw.account_tier || raw.plan || "Core"),
      accountStatus: raw.account_status || raw.accountStatus || raw.status || "—",
      onboardingStatus: raw.onboarding_status || raw.onboardingStatus || raw.onboarding || "—",
      providers,
      providersLabel: providers
        .map((provider) => {
          const label = provider.label || "provider";
          const id = provider.id ? ` (${redactId(provider.id)})` : "";
          return `${label}${id}`;
        })
        .join(", ") || "—",
      createdAt: raw.created_at || raw.createdAt || raw.created || null,
      lastLogin:
        raw.last_login_at ||
        raw.lastLoginAt ||
        raw.last_login ||
        raw.lastLogin ||
        raw.last_seen ||
        null,
      donationCount: 0,
      donationTotal: 0,
      supporterLabel: "No"
    };
  }

  function resolveSessionEndpoint() {
    return (
      window.StreamSuitesAdminAuth?.config?.endpoints?.session ||
      document.querySelector('meta[name="streamsuites-auth-session"]')?.getAttribute("content") ||
      ""
    );
  }

  function resolveApiBase() {
    if (window.StreamSuitesApi?.getApiBase) {
      return window.StreamSuitesApi.getApiBase();
    }
    const base = window.StreamSuitesAdminAuth?.config?.baseUrl || "";
    return base ? String(base).replace(/\/$/, "") : "";
  }

  function buildApiUrl(path, baseOverride) {
    if (window.StreamSuitesApi?.buildApiUrl) {
      return window.StreamSuitesApi.buildApiUrl(path, baseOverride || resolveApiBase());
    }
    const base = typeof baseOverride === "string" ? baseOverride.replace(/\/$/, "") : resolveApiBase();
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalized}`;
  }

  function promptAdminReauth() {
    if (typeof window.StreamSuitesAdminGate?.logout === "function") {
      window.StreamSuitesAdminGate.logout();
      return true;
    }
    if (typeof window.StreamSuitesAdminAuth?.logout === "function") {
      window.StreamSuitesAdminAuth.logout();
      return true;
    }
    return false;
  }

  function setInlineError(message, options = {}) {
    setStatus(message);
    setBanner(message, true, options);
  }

  async function readErrorMessage(res) {
    if (!res) return "";
    const contentType = res.headers?.get("content-type") || "";
    try {
      if (contentType.includes("application/json")) {
        const payload = await res.json();
        if (typeof payload?.message === "string") return payload.message;
        if (typeof payload?.error === "string") return payload.error;
      }
      const text = await res.text();
      return text.trim();
    } catch (err) {
      return "";
    }
  }

  async function loadAdminIdentity() {
    const endpoint = resolveSessionEndpoint();
    if (!endpoint) return;
    try {
      const res = await fetchJson(endpoint, { method: "GET" });
      if (!res.ok) return;
      const payload = await res.json();
      const user = payload?.user || payload?.session?.user || payload?.session || {};
      state.selfId = String(user.internal_id || user.id || user.user_id || "").trim();
      const email = (user.email || "").toString().trim().toLowerCase();
      state.selfEmail = email;
      applyFilters();
    } catch (err) {
      console.warn("[Accounts] Admin session introspection failed", err);
    }
  }

  function normalizeStatus(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isSelfAccount(user) {
    if (!user) return false;
    if (state.selfId && user.id === state.selfId) return true;
    const email = String(user.email || "").trim().toLowerCase();
    if (state.selfEmail && email && email === state.selfEmail) return true;
    return false;
  }

  function normalizeAccountId(value) {
    if (value === undefined || value === null) return "";
    return String(value).trim();
  }

  function renderActionButton({ label, action, tone, disabled, title, accountId }) {
    const classes = ["ss-btn", "ss-btn-small", tone].filter(Boolean).join(" ");
    const disabledAttr = disabled ? " disabled" : "";
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    const accountAttr = accountId ? ` data-account-id="${escapeHtml(accountId)}"` : "";
    return `
      <button
        type="button"
        class="${classes}"
        data-account-action="${action}"
       ${accountAttr}
       ${disabledAttr}
       ${titleAttr}
      >${escapeHtml(label)}</button>
    `;
  }

  function renderActions(user) {
    const status = normalizeStatus(user.accountStatus);
    const isDeleted = status === "deleted";
    const isSuspended = status === "suspended";
    const isActive = status === "active";
    const isSelf = isSelfAccount(user);
    const manageDisabled = !state.canManage;
    const isEmailVerified = user.emailVerified === true;
    const hasEmail = Boolean(user.email && user.email !== "—");
    const tiers = ["CORE", "GOLD", "PRO"];
    const currentTier = String(user.tier || "CORE").toUpperCase();
    const accountId = normalizeAccountId(user.id);

    const actions = [];
    if (isActive) {
      actions.push(
        renderActionButton({
          label: "Suspend",
          action: "suspend",
          tone: "ss-btn-secondary",
          disabled: manageDisabled || isDeleted,
          accountId
        })
      );
    } else if (isSuspended) {
      actions.push(
        renderActionButton({
          label: "Unsuspend",
          action: "unsuspend",
          tone: "ss-btn-secondary",
          disabled: manageDisabled || isDeleted,
          accountId
        })
      );
    } else {
      actions.push(
        renderActionButton({
          label: "Suspend",
          action: "suspend",
          tone: "ss-btn-secondary",
          disabled: true,
          title: "Suspend only available for active accounts.",
          accountId
        })
      );
    }

    actions.push(
      renderActionButton({
        label: "Reset Onboarding",
        action: "reset-onboarding",
        tone: "ss-btn-secondary",
        disabled: manageDisabled || isDeleted,
        title: isDeleted ? "Cannot reset a deleted account." : "",
        accountId
      })
    );

    actions.push(
      renderActionButton({
        label: "Force Email Reverify",
        action: "force-email-reverify",
        tone: "ss-btn-secondary",
        disabled: manageDisabled || isDeleted || !hasEmail,
        title: !hasEmail ? "No email on file." : "",
        accountId
      })
    );

    actions.push(
      renderActionButton({
        label: "Mark Email Verified",
        action: "mark-email-verified",
        tone: "ss-btn-secondary",
        disabled: manageDisabled || isDeleted || !hasEmail || isEmailVerified,
        title: isEmailVerified ? "Email already verified." : !hasEmail ? "No email on file." : "",
        accountId
      })
    );

    actions.push(
      renderActionButton({
        label: "Force Logout",
        action: "invalidate-sessions",
        tone: "ss-btn-secondary",
        disabled: manageDisabled,
        accountId
      })
    );

    actions.push(
      renderActionButton({
        label: "Delete",
        action: "delete",
        tone: "ss-btn-danger",
        disabled: manageDisabled || isDeleted || isSelf,
        title: isSelf ? "Cannot delete your own account." : isDeleted ? "Account already deleted." : "",
        accountId
      })
    );

    return `
      <div class="accounts-row-actions-grid">
        <div class="accounts-row-actions-tier">
          <select class="ss-input" data-account-tier data-account-id="${escapeHtml(accountId)}" ${manageDisabled || isDeleted ? "disabled" : ""}>
          ${tiers
            .map((tier) => `<option value="${tier}"${tier === currentTier ? " selected" : ""}>${tier}</option>`)
            .join("")}
          </select>
        ${renderActionButton({
          label: "Update Tier",
          action: "tier",
          tone: "ss-btn-primary",
          disabled: manageDisabled || isDeleted,
          title: isDeleted ? "Cannot change tier on deleted accounts." : "",
          accountId
        })}
        </div>
        <div class="accounts-row-actions-buttons">
        ${actions.join("")}
        </div>
      </div>
    `;
  }

  function extractUsers(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.users)) return payload.users;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
  }

  function setBanner(message, visible, options = {}) {
    if (!el.banner) return;
    el.banner.innerHTML = "";
    if (visible) {
      const text = document.createElement("span");
      text.textContent = message;
      el.banner.appendChild(text);
      if (options.retryAction) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ss-btn ss-btn-secondary ss-btn-small";
        button.setAttribute("data-accounts-retry", options.retryAction);
        button.textContent = "Retry";
        el.banner.appendChild(document.createTextNode(" "));
        el.banner.appendChild(button);
      }
    }
    el.banner.classList.toggle("hidden", !visible);
  }

  function setStatus(message) {
    if (el.status) el.status.textContent = message;
  }

  function setSource(label) {
    state.sourceLabel = label;
    if (el.source) el.source.textContent = label;
  }

  function setExportStatus(message) {
    if (!el.exportStatus) return;
    el.exportStatus.textContent = message;
  }

  function setExportButtonsLoading(isLoading) {
    state.exportLoading = isLoading;
    [el.exportJson, el.exportCsv].forEach((button) => {
      if (!button) return;
      if (isLoading) {
        button.dataset.originalLabel = button.textContent || "";
        button.disabled = true;
        button.textContent = "Exporting...";
      } else {
        const original = button.dataset.originalLabel;
        if (original !== undefined) {
          button.textContent = original;
          delete button.dataset.originalLabel;
        }
        button.disabled = false;
      }
    });
  }

  function updateEmptyStateMessage(filteredCount) {
    if (!el.empty) return;
    const hasFilters =
      Boolean(el.roleFilter?.value) ||
      Boolean(el.tierFilter?.value) ||
      Boolean(el.providerFilter?.value) ||
      Boolean(el.search?.value);
    if (state.raw.length === 0) {
      el.empty.textContent =
        "No accounts available yet. Confirm the runtime is connected, then refresh.";
      return;
    }
    if (filteredCount === 0 && hasFilters) {
      el.empty.textContent = "No accounts match these filters. Clear filters or search to see all accounts.";
      return;
    }
    el.empty.textContent = "No accounts to display right now.";
  }

  function updateFilterOptions(items) {
    const roles = new Set();
    const tiers = new Set();
    const providers = new Set();

    items.forEach((item) => {
      if (item.role && item.role !== "—") roles.add(item.role);
      if (item.tier && item.tier !== "—") tiers.add(item.tier);
      (item.providers || []).forEach((provider) => {
        if (provider?.label) providers.add(provider.label);
      });
    });

    fillSelect(el.roleFilter, roles, "All roles");
    fillSelect(el.tierFilter, tiers, "All tiers");
    fillSelect(el.providerFilter, providers, "All providers");
  }

  function fillSelect(selectEl, values, placeholder) {
    if (!selectEl) return;
    const current = selectEl.value;
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
    Array.from(values)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        selectEl.appendChild(option);
      });
    selectEl.value = current || "";
  }

  function getFilteredData() {
    const role = el.roleFilter?.value || "";
    const tier = el.tierFilter?.value || "";
    const provider = el.providerFilter?.value || "";

    return state.raw.filter((item) => {
      if (role && String(item.role).toLowerCase() !== role.toLowerCase()) {
        return false;
      }
      if (tier && String(item.tier).toLowerCase() !== tier.toLowerCase()) {
        return false;
      }
      if (provider) {
        const hasProvider = (item.providers || []).some((p) =>
          String(p.label || "").toLowerCase() === provider.toLowerCase()
        );
        if (!hasProvider) return false;
      }
      return true;
    });
  }

  function getSearchFilteredCount(baseItems) {
    const term = el.search?.value || "";
    if (window.SearchPagination?.filterData) {
      return window.SearchPagination.filterData(baseItems, term, SEARCH_FIELDS).length;
    }
    return baseItems.length;
  }

  function applyFilters() {
    const filtered = getFilteredData();
    state.manager?.setData(filtered);
    updateEmptyStateMessage(getSearchFilteredCount(filtered));
  }

  function toggleIdColumn(show) {
    if (!el.table) return;
    const columns = el.table.querySelectorAll(".accounts-id-column");
    columns.forEach((col) => col.classList.toggle("hidden", !show));
    const idCol = el.table.querySelector('col[data-col-key="internalId"]');
    if (idCol) {
      idCol.classList.toggle("hidden", !show);
    }
  }

  function renderTextValue(value, fallback = "—") {
    const normalized =
      value === undefined || value === null || String(value).trim() === ""
        ? fallback
        : String(value);
    return `<span class="accounts-cell-ellipsis" title="${escapeHtml(normalized)}">${escapeHtml(
      normalized
    )}</span>`;
  }

  function renderActionsToggle(user) {
    const accountId = normalizeAccountId(user.id);
    return `
      <button
        type="button"
        class="ss-btn ss-btn-small ss-btn-secondary accounts-actions-toggle"
        data-account-open-actions
        data-account-id="${escapeHtml(accountId)}"
        aria-expanded="false"
        aria-controls="accounts-details-drawer"
      >
        Actions
      </button>
    `;
  }

  function renderRow(user) {
    const accountId = normalizeAccountId(user.id);
    return `
      <td class="accounts-id-column" data-account-id="${escapeHtml(accountId)}">${renderTextValue(
        accountId || "—"
      )}</td>
      <td>${renderTextValue(user.userCode)}</td>
      <td>${renderTextValue(user.email)}</td>
      <td>${renderEmailVerified(user.emailVerified)}</td>
      <td>${renderTextValue(user.displayName)}</td>
      <td>${renderBadge(user.role)}</td>
      <td>${renderBadge(user.tier)}</td>
      <td>${renderBadge(user.supporterLabel, user.supporterLabel === "Yes" ? "ss-badge-success" : "")}</td>
      <td>${renderBadge(user.accountStatus, badgeToneForStatus(user.accountStatus))}</td>
      <td>${renderBadge(user.onboardingStatus, badgeToneForStatus(user.onboardingStatus))}</td>
      <td>${renderTextValue(user.providersLabel)}</td>
      <td>${renderTextValue(formatTimestamp(user.createdAt))}</td>
      <td>${renderTextValue(formatTimestamp(user.lastLogin))}</td>
      <td class="align-right accounts-actions-cell">${renderActionsToggle({ ...user, id: accountId })}</td>
    `;
  }

  function getUserById(accountId) {
    const id = normalizeAccountId(accountId);
    if (!id) return null;
    return state.raw.find((entry) => normalizeAccountId(entry?.id) === id) || null;
  }

  function getBaseRowByAccountId(accountId) {
    const id = normalizeAccountId(accountId);
    if (!el.body || !id) return null;
    const rows = el.body.querySelectorAll('tr[data-row-type="account"][data-account-id]');
    for (const row of rows) {
      if (normalizeAccountId(row.getAttribute("data-account-id")) === id) {
        return row;
      }
    }
    const triggers = el.body.querySelectorAll("[data-account-open-actions]");
    for (const trigger of triggers) {
      if (normalizeAccountId(trigger.getAttribute("data-account-id")) !== id) continue;
      return trigger.closest("tr");
    }
    return null;
  }

  function setDrawerToggleState(row, isOpen) {
    if (!row) return;
    const trigger = row.querySelector("[data-account-open-actions]");
    if (!(trigger instanceof HTMLButtonElement)) return;
    trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    trigger.classList.toggle("is-open", isOpen);
  }

  function isDetailsDrawerOpen() {
    return Boolean(el.detailsDrawer && !el.detailsDrawer.classList.contains("hidden"));
  }

  function syncDrawerToggleStates() {
    if (!el.body) return;
    const rows = el.body.querySelectorAll('tr[data-row-type="account"]');
    rows.forEach((row) => {
      const rowId = normalizeAccountId(row.getAttribute("data-account-id"));
      const isSelected = isDetailsDrawerOpen() && Boolean(state.openDrawerId) && rowId === state.openDrawerId;
      setDrawerToggleState(row, isSelected);
    });
  }

  function syncSelectedRowState() {
    if (!el.body) return;
    const rows = el.body.querySelectorAll('tr[data-row-type="account"]');
    rows.forEach((row) => {
      const rowId = normalizeAccountId(row.getAttribute("data-account-id"));
      const isSelected = isDetailsDrawerOpen() && Boolean(state.openDrawerId) && rowId === state.openDrawerId;
      row.classList.toggle("accounts-row-selected", isSelected);
    });
    syncDrawerToggleStates();
  }

  function clearRowClickTimer() {
    if (!state.rowClickTimer) return;
    clearTimeout(state.rowClickTimer);
    state.rowClickTimer = null;
  }

  function clearDrawerCloseTimer() {
    if (!state.drawerCloseTimer) return;
    clearTimeout(state.drawerCloseTimer);
    state.drawerCloseTimer = null;
  }

  function resolveRoleList(roleValue) {
    const normalized = String(roleValue || "").trim();
    if (!normalized || normalized === "—") return ["Unknown"];
    const roles = normalized
      .split(/[|,]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    return roles.length > 0 ? roles : [normalized];
  }

  function resolveAvatarInitials(user) {
    const preferred = String(user.displayName || user.userCode || user.email || "").trim();
    if (!preferred) return "NA";
    const parts = preferred.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  function renderDrawerProfileSummary(user) {
    const title = user.displayName || user.userCode || user.email || "Account";
    const subtitle = user.userCode || "—";
    const roleBadges = resolveRoleList(user.role).map((role) => renderBadge(role)).join("");
    return `
      <article class="accounts-details-profile-card glass-card">
        <div class="accounts-details-profile-head">
          <div class="accounts-details-avatar" aria-hidden="true">${escapeHtml(
            resolveAvatarInitials(user)
          )}</div>
          <div class="accounts-details-identity">
            <strong class="accounts-details-name">${escapeHtml(title)}</strong>
            <span class="accounts-details-user-code">${escapeHtml(subtitle)}</span>
            <div class="accounts-details-role-row">${roleBadges}</div>
          </div>
        </div>
        <div class="accounts-details-meta-grid">
          <div><span class="label">Tier</span><span class="value">${renderBadge(user.tier || "—")}</span></div>
          <div><span class="label">Status</span><span class="value">${renderBadge(
            user.accountStatus || "—",
            badgeToneForStatus(user.accountStatus)
          )}</span></div>
          <div><span class="label">Onboarding</span><span class="value">${renderBadge(
            user.onboardingStatus || "—",
            badgeToneForStatus(user.onboardingStatus)
          )}</span></div>
          <div><span class="label">Email</span><span class="value">${escapeHtml(user.email || "—")}</span></div>
          <div><span class="label">Created</span><span class="value">${escapeHtml(
            formatTimestamp(user.createdAt)
          )}</span></div>
          <div><span class="label">Last Login</span><span class="value">${escapeHtml(
            formatTimestamp(user.lastLogin)
          )}</span></div>
        </div>
      </article>
      <div class="accounts-details-placeholder-group">
        <div class="accounts-details-placeholder-block">
          <div class="accounts-details-placeholder-title">Admin Notes</div>
          <div class="accounts-details-placeholder-value">No admin notes yet.</div>
        </div>
        <div class="accounts-details-placeholder-block">
          <div class="accounts-details-placeholder-title">Security Flags</div>
          <div class="accounts-details-placeholder-value">No risk flags captured.</div>
        </div>
        <div class="accounts-details-placeholder-block">
          <div class="accounts-details-placeholder-title">Billing Snapshot</div>
          <div class="accounts-details-placeholder-value">No billing snapshot attached.</div>
        </div>
      </div>
    `;
  }

  function renderDrawerForAccount(user) {
    if (!el.detailsDrawer) return;
    const title = user.displayName || user.userCode || user.email || "Account";
    const subtitle = user.email || user.userCode || "—";
    if (el.detailsTitle) {
      el.detailsTitle.textContent = title;
    }
    if (el.detailsSubtitle) {
      el.detailsSubtitle.textContent = subtitle;
    }
    if (el.detailsProfile) {
      el.detailsProfile.innerHTML = renderDrawerProfileSummary(user);
    }
    if (el.detailsActions) {
      el.detailsActions.innerHTML = renderActions(user);
    }
  }

  function closeOpenDrawer(options = {}) {
    const keepState = options.keepState === true;
    clearDrawerCloseTimer();
    if (el.detailsDrawer) {
      el.detailsDrawer.classList.remove("is-open");
      el.detailsDrawer.setAttribute("aria-hidden", "true");
    }
    if (el.detailsBackdrop) {
      el.detailsBackdrop.classList.remove("is-open");
      el.detailsBackdrop.setAttribute("aria-hidden", "true");
    }
    state.drawerCloseTimer = setTimeout(() => {
      if (el.detailsDrawer && !el.detailsDrawer.classList.contains("is-open")) {
        el.detailsDrawer.classList.add("hidden");
      }
      if (el.detailsBackdrop && !el.detailsBackdrop.classList.contains("is-open")) {
        el.detailsBackdrop.classList.add("hidden");
      }
      state.drawerCloseTimer = null;
    }, 220);
    if (!keepState) {
      state.openDrawerId = "";
    }
    syncSelectedRowState();
  }

  function focusProfileSection() {
    if (el.detailsContent) {
      el.detailsContent.scrollTo({ top: 0, behavior: "auto" });
    }
    el.detailsDrawer?.focus({ preventScroll: true });
  }

  function focusActionsSection() {
    if (el.detailsActionsSection) {
      el.detailsActionsSection.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    }
    el.detailsActionsHeading?.focus({ preventScroll: true });
  }

  function openDrawer(accountId, options = {}) {
    const id = normalizeAccountId(accountId);
    if (!id || !el.detailsDrawer || !el.detailsBackdrop) return;
    const user = getUserById(id);
    if (!user) {
      state.openDrawerId = "";
      closeOpenDrawer({ keepState: false });
      return;
    }

    state.openDrawerId = id;
    clearDrawerCloseTimer();
    renderDrawerForAccount(user);
    el.detailsBackdrop.classList.remove("hidden");
    el.detailsBackdrop.setAttribute("aria-hidden", "false");
    el.detailsDrawer.classList.remove("hidden");
    el.detailsDrawer.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(() => {
      el.detailsBackdrop?.classList.add("is-open");
      el.detailsDrawer?.classList.add("is-open");
    });
    syncSelectedRowState();

    if (options.focusActions) {
      window.requestAnimationFrame(() => {
        focusActionsSection();
      });
      return;
    }
    if (!options.preserveScroll) {
      focusProfileSection();
    }
  }

  function restoreOpenDrawer() {
    if (!state.openDrawerId) {
      closeOpenDrawer({ keepState: true });
      return;
    }
    openDrawer(state.openDrawerId, { preserveScroll: true });
  }

  function isBaseAccountRow(row) {
    if (!(row instanceof HTMLTableRowElement)) return false;
    const rowType = row.getAttribute("data-row-type");
    if (rowType) {
      return rowType === "account";
    }
    return true;
  }

  function getAccountIdFromBaseRow(row) {
    if (!isBaseAccountRow(row)) return "";
    const rowAccountId = row.getAttribute("data-account-id");
    if (rowAccountId) return normalizeAccountId(rowAccountId);
    const idCell = row.querySelector(".accounts-id-column[data-account-id]");
    if (!(idCell instanceof HTMLElement)) return "";
    return normalizeAccountId(idCell.getAttribute("data-account-id"));
  }

  function isInteractiveRowTarget(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        "button, a, input, select, textarea, label, [data-account-action], [data-account-open-actions], [data-account-close-details], [data-account-tier]"
      )
    );
  }

  function getEventTargetElement(event) {
    return event?.target instanceof Element ? event.target : null;
  }

  async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(url, {
        cache: "no-store",
        credentials: "include",
        ...options,
        signal: controller.signal
      });
      if (res.status === 401 || res.status === 403) {
        promptAdminReauth();
      }
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  
  async function loadUsers() {
    setStatus("Loading live accounts...");
    setBanner("", false);

    try {
      const res = await fetchJson(buildApiUrl(RUNTIME_ENDPOINT));
      if (res.status === 401 || res.status === 403) {
        setStatus("Admin session required. Sign in to view accounts.");
        setSource("Unauthorized");
        state.raw = [];
        state.canManage = false;
        state.sourceMode = "unauthorized";
        state.manager?.setData([]);
        updateEmptyStateMessage(0);
        setBanner("Your admin session is missing or expired. Sign in to continue.", true);
        return;
      }
      if (!res.ok) throw new Error(`Runtime error ${res.status}`);
      const payload = await res.json();
      const normalized = extractUsers(payload).map(normalizeUser);
      state.raw = normalized;
      state.canManage = true;
      state.sourceMode = "runtime";
      applyDonationStats();
      updateFilterOptions(normalized);
      applyFilters();
      setBanner("", false);
      setStatus("Live runtime data");
      setSource("Runtime API");
    } catch (err) {
      console.warn("[Accounts] Failed to load runtime accounts", err);
      setStatus("Runtime API unavailable. Retry or contact an admin.");
      setSource("Unavailable");
      state.raw = [];
      state.canManage = false;
      state.sourceMode = "unavailable";
      state.manager?.setData([]);
      updateEmptyStateMessage(0);
      setBanner("Runtime API unavailable. Retry or check runtime connectivity.", true);
    }
  }

  function coerceNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") return null;
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function resolveDonationAmountCents(entry) {
    if (!entry || typeof entry !== "object") return 0;
    const meta = entry.meta && typeof entry.meta === "object" ? entry.meta : {};
    const metadata = entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {};
    const explicitCents = coerceNumber(
      entry.amount_total ??
        entry.amountTotal ??
        entry.amount_cents ??
        entry.amountCents ??
        meta.amount_total ??
        meta.amount_cents ??
        metadata.amount_total ??
        metadata.amount_cents
    );
    if (explicitCents !== null) return Math.round(explicitCents);
    const amount = coerceNumber(
      entry.amount ??
        entry.total_amount ??
        entry.totalAmount ??
        meta.amount ??
        meta.total_amount ??
        metadata.amount ??
        metadata.total_amount
    );
    if (amount === null) return 0;
    if (amount >= 1000) return Math.round(amount);
    return Math.round(amount * 100);
  }

  function collectDonationKeys(entry) {
    const keys = [];
    if (!entry || typeof entry !== "object") return keys;
    const meta = entry.meta && typeof entry.meta === "object" ? entry.meta : {};
    const metadata = entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {};
    [
      entry.customer_email,
      entry.customerEmail,
      entry.email,
      entry.email_address,
      entry.actor,
      meta.email,
      meta.customer_email,
      meta.actor,
      meta.account_id,
      meta.user_id,
      meta.user_code,
      metadata.email,
      metadata.customer_email,
      entry.account_id,
      entry.accountId,
      entry.user_id,
      entry.userId,
      entry.internal_id,
      entry.internalId,
      metadata.account_id,
      metadata.user_id,
      entry.user_code,
      entry.userCode,
      metadata.user_code,
      metadata.userCode
    ].forEach((value) => {
      if (!value) return;
      const normalized = String(value).trim().toLowerCase();
      if (normalized) keys.push(normalized);
    });
    return keys;
  }

  function buildDonationStats(entries) {
    const stats = new Map();
    if (!Array.isArray(entries)) return stats;
    entries.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const amountCents = resolveDonationAmountCents(entry);
      const keys = collectDonationKeys(entry);
      if (keys.length === 0) return;
      const uniqueKeys = new Set(keys);
      uniqueKeys.forEach((key) => {
        const current = stats.get(key) || { donationCount: 0, donationTotalCents: 0 };
        current.donationCount += 1;
        current.donationTotalCents += amountCents;
        stats.set(key, current);
      });
    });
    return stats;
  }

  function resolveDonationStatsForUser(user) {
    if (!user) return null;
    const emailKey = String(user.email || "").trim().toLowerCase();
    if (emailKey && state.donationStats.has(emailKey)) {
      return state.donationStats.get(emailKey);
    }
    const idKey = String(user.id || "").trim().toLowerCase();
    if (idKey && state.donationStats.has(idKey)) {
      return state.donationStats.get(idKey);
    }
    const codeKey = String(user.userCode || "").trim().toLowerCase();
    if (codeKey && state.donationStats.has(codeKey)) {
      return state.donationStats.get(codeKey);
    }
    return null;
  }

  function applyDonationStats() {
    if (!Array.isArray(state.raw) || state.raw.length === 0) return;
    state.raw = state.raw.map((user) => {
      const stats = resolveDonationStatsForUser(user);
      const donationCount = stats?.donationCount || 0;
      const donationTotalCents = stats?.donationTotalCents || 0;
      const donationTotal = donationTotalCents / 100;
      return {
        ...user,
        donationCount,
        donationTotal,
        supporterLabel: donationCount > 0 ? "Yes" : "No"
      };
    });
  }

  async function loadDonations(options = {}) {
    try {
      let payload = null;
      if (window.StreamSuitesApi?.getAdminAnalytics) {
        payload = await window.StreamSuitesApi.getAdminAnalytics(ANALYTICS_WINDOW, {
          ttlMs: ANALYTICS_CACHE_TTL_MS,
          forceRefresh: options.forceReload === true
        });
      } else {
        const endpoint = `${ANALYTICS_ENDPOINT}?window=${encodeURIComponent(ANALYTICS_WINDOW)}`;
        payload = await window.StreamSuitesApi?.apiFetch?.(endpoint, {
          cacheTtlMs: ANALYTICS_CACHE_TTL_MS,
          cacheKey: `admin-analytics:${ANALYTICS_WINDOW}`,
          forceRefresh: options.forceReload === true
        });
      }
      const dataset = Array.isArray(payload?.data?.donations) ? payload.data.donations : [];
      state.donationStats = buildDonationStats(dataset);
      state.donationsLoaded = true;
      applyDonationStats();
      applyFilters();
      setBanner("", false);
      if (!dataset.length) {
        setStatus("No events in selected window.");
      }
    } catch (err) {
      if (err?.status === 401 || err?.status === 403 || err?.isAuthError) {
        promptAdminReauth();
        setInlineError("Admin session expired. Sign in again to continue.");
        return;
      }
      console.warn("[Accounts] Failed to load donation analytics", err);
      state.donationStats = new Map();
      state.donationsLoaded = false;
      applyDonationStats();
      applyFilters();
      setInlineError("Analytics API unavailable for donation stats.", {
        retryAction: "donations"
      });
    }
  }

  function ensureSupporterColumn() {
    if (!el.table) return;
    const headerRow = el.table.querySelector("thead tr");
    if (!headerRow || headerRow.querySelector("[data-supporter-column]")) return;
    const th = document.createElement("th");
    th.textContent = "Supporter";
    th.setAttribute("data-sort", "supporterLabel");
    th.setAttribute("data-col-key", "supporter");
    th.setAttribute("data-supporter-column", "true");
    const statusHeader = headerRow.querySelector('th[data-sort="accountStatus"]');
    if (statusHeader) {
      headerRow.insertBefore(th, statusHeader);
    } else {
      const actionHeader = headerRow.querySelector("th.align-right");
      if (actionHeader) {
        headerRow.insertBefore(th, actionHeader);
      } else {
        headerRow.appendChild(th);
      }
    }
  }

  function getActionPrompt(action, user) {
    const name = user.displayName || user.email || user.userCode || "this account";
    if (action === "suspend") {
      return `Suspend ${name}?`;
    }
    if (action === "unsuspend") {
      return `Unsuspend ${name}?`;
    }
    if (action === "reset-onboarding") {
      return `Reset onboarding for ${name}? This forces the user to complete onboarding again.`;
    }
    if (action === "force-email-reverify") {
      return `Force email re-verification for ${name}? This logs them out and sends a verification email.`;
    }
    if (action === "mark-email-verified") {
      return `Mark ${name} as email verified?`;
    }
    if (action === "delete") {
      return `Delete ${name}? This is a destructive action and will soft-delete the account.`;
    }
    return "";
  }

  function shouldConfirmAction(action) {
    return [
      "suspend",
      "unsuspend",
      "reset-onboarding",
      "force-email-reverify",
      "mark-email-verified",
      "delete"
    ].includes(action);
  }

  function updateUserAfterAction(userId, action, payload) {
    const index = state.raw.findIndex((item) => item.id === userId);
    if (index === -1) return;
    const current = state.raw[index];
    const next = { ...current };

    if (action === "suspend") {
      next.accountStatus = payload?.account_status || "suspended";
    } else if (action === "unsuspend") {
      next.accountStatus = payload?.account_status || "active";
    } else if (action === "delete") {
      next.accountStatus = payload?.account_status || "deleted";
    } else if (action === "reset-onboarding") {
      next.onboardingStatus = payload?.onboarding_status || "required";
    } else if (action === "force-email-reverify") {
      next.emailVerified = false;
      next.emailVerifiedLabel = resolveEmailVerifiedLabel(false);
    } else if (action === "mark-email-verified") {
      next.emailVerified = true;
      next.emailVerifiedLabel = resolveEmailVerifiedLabel(true);
    } else if (action === "tier") {
      next.tier = normalizeTierLabel(payload?.tier || next.tier);
    }

    state.raw[index] = next;
  }

  function setRowActionLoading(row, activeButton, isLoading) {
    if (!row) return;
    const buttons = row.querySelectorAll("[data-account-action]");
    const tierSelect = row.querySelector("[data-account-tier]");
    buttons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      if (isLoading) {
        button.dataset.originalDisabled = button.disabled ? "true" : "false";
        button.disabled = true;
        if (button === activeButton) {
          button.dataset.originalLabel = button.textContent || "";
          button.textContent = "Working...";
        }
      } else {
        if (button.dataset.originalDisabled === undefined) {
          return;
        }
        const wasDisabled = button.dataset.originalDisabled === "true";
        button.disabled = wasDisabled;
        delete button.dataset.originalDisabled;
        if (button.dataset.originalLabel !== undefined) {
          button.textContent = button.dataset.originalLabel;
          delete button.dataset.originalLabel;
        }
      }
    });
    if (tierSelect instanceof HTMLSelectElement) {
      if (isLoading) {
        tierSelect.dataset.originalDisabled = tierSelect.disabled ? "true" : "false";
        tierSelect.disabled = true;
      } else {
        if (tierSelect.dataset.originalDisabled === undefined) {
          return;
        }
        tierSelect.disabled = tierSelect.dataset.originalDisabled === "true";
        delete tierSelect.dataset.originalDisabled;
      }
    }
  }

  
  async function handleAccountAction(user, action, row, button) {
    if (!user || !action) return;
    if (!state.canManage) return;

    if (shouldConfirmAction(action)) {
      const message = getActionPrompt(action, user);
      if (message && !window.confirm(message)) return;
    }

    const base = "/admin/accounts";
    const endpoint =
      action === "delete"
        ? `${base}/${encodeURIComponent(user.id)}`
        : `${base}/${encodeURIComponent(user.id)}/${action}`;
    const forceApiBase =
      action === "force-email-reverify" || action === "mark-email-verified"
        ? "https://api.streamsuites.app"
        : null;
    try {
      let method = "POST";
      let body = null;
      if (action === "delete") {
        method = "DELETE";
      } else if (action === "tier") {
        const tierSelect = row?.querySelector("[data-account-tier]");
        const selectedTier = tierSelect?.value || "";
        if (!selectedTier) {
          setStatus("Select a tier before updating.");
          return;
        }
        method = "PATCH";
        body = JSON.stringify({ tier: selectedTier });
      }
      setStatus(`Applying ${action.replace("-", " ")}...`);
      setBanner("", false);
      setRowActionLoading(row, button, true);
      const res = await fetchJson(buildApiUrl(endpoint, forceApiBase), {
        method,
        body,
        headers: body ? { "Content-Type": "application/json" } : undefined
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setInlineError("Admin session expired. Sign in again to continue.");
          return;
        }
        const message = await readErrorMessage(res);
        console.warn("[Accounts] Action failed", action, message || res.status);
        const detail = message ? ` (${message})` : "";
        setInlineError(`Action failed${detail}. Retry or refresh your admin session.`);
        return;
      }
      let payload = null;
      try {
        payload = await res.json();
      } catch (err) {
        payload = null;
      }
      updateUserAfterAction(user.id, action, payload);
      applyFilters();
      setStatus("Action complete. Refreshing...");
      await loadUsers();
    } catch (err) {
      console.warn("[Accounts] Action error", action, err);
      setInlineError("Action failed. Retry or contact an admin if it persists.");
    } finally {
      setRowActionLoading(row, button, false);
    }
  }

  function parseFilename(headers, fallback) {
    const disposition = headers.get("content-disposition") || "";
    const match = disposition.match(/filename\*?=\"?([^\";]+)\"?/i);
    if (match && match[1]) return match[1];
    return fallback;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  
  async function triggerExport(format) {
    if (!el.exportStatus) return;
    const endpoint = `/admin/accounts/export.${format}`;
    setExportStatus("Exporting...");
    setExportButtonsLoading(true);

    try {
      const res = await fetch(buildApiUrl(endpoint), {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json, text/csv, application/octet-stream"
        }
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setExportStatus("Admin session required to export.");
          return;
        }
        throw new Error(`Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const filename = parseFilename(res.headers, `users.${format}`);
      downloadBlob(blob, filename);
      setExportStatus("Export ready");
    } catch (err) {
      console.warn("[Accounts] Export failed", err);
      setExportStatus("Export failed. Retry or contact an admin.");
    } finally {
      setExportButtonsLoading(false);
    }
  }

  function bindEvents() {
    el.roleFilter?.addEventListener("change", applyFilters);
    el.tierFilter?.addEventListener("change", applyFilters);
    el.providerFilter?.addEventListener("change", applyFilters);
    el.search?.addEventListener("input", () => {
      const filtered = getFilteredData();
      updateEmptyStateMessage(getSearchFilteredCount(filtered));
    });
    el.idToggle?.addEventListener("change", (event) => {
      toggleIdColumn(event.target.checked);
    });
    el.exportJson?.addEventListener("click", () => triggerExport("json"));
    el.exportCsv?.addEventListener("click", () => triggerExport("csv"));
    el.banner?.addEventListener("click", (event) => {
      const retryButton = event.target.closest("[data-accounts-retry]");
      if (!retryButton) return;
      const action = retryButton.getAttribute("data-accounts-retry");
      if (action === "donations") {
        void loadDonations({ forceReload: true });
      }
    });

    if (!state.escapeBound) {
      state.escapeBound = true;
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (state.openDrawerId) {
          closeOpenDrawer();
        }
      });
    }

    el.body?.addEventListener("dblclick", (event) => {
      const target = getEventTargetElement(event);
      if (!target) return;
      if (isInteractiveRowTarget(target)) return;
      const row = target.closest("tr");
      if (!isBaseAccountRow(row)) return;
      const accountId = getAccountIdFromBaseRow(row);
      if (!accountId) return;
      clearRowClickTimer();
      openDrawer(accountId, { focusActions: true });
    });

    el.body?.addEventListener("click", (event) => {
      const target = getEventTargetElement(event);
      if (!target) return;
      const drawerToggle = target.closest("[data-account-open-actions]");
      if (drawerToggle) {
        event.preventDefault();
        clearRowClickTimer();
        const accountId = normalizeAccountId(drawerToggle.getAttribute("data-account-id"));
        openDrawer(accountId, { focusActions: true });
        return;
      }
      if (isInteractiveRowTarget(target)) return;
      const row = target.closest("tr");
      if (!isBaseAccountRow(row)) return;
      const accountId = getAccountIdFromBaseRow(row);
      if (!accountId) return;
      clearRowClickTimer();
      state.rowClickTimer = setTimeout(() => {
        state.rowClickTimer = null;
        openDrawer(accountId);
      }, ROW_CLICK_DELAY_MS);
    });

    el.detailsBackdrop?.addEventListener("click", () => {
      clearRowClickTimer();
      closeOpenDrawer();
    });

    el.detailsClose?.addEventListener("click", (event) => {
      event.preventDefault();
      clearRowClickTimer();
      closeOpenDrawer();
    });

    el.detailsDrawer?.addEventListener("click", (event) => {
      const target = getEventTargetElement(event);
      if (!target) return;
      const closeButton = target.closest("[data-account-close-details]");
      if (closeButton) {
        event.preventDefault();
        closeOpenDrawer();
        return;
      }

      const button = target.closest("[data-account-action]");
      if (!button) return;
      if (button.disabled) return;
      const action = button.getAttribute("data-account-action") || "";
      const accountId = normalizeAccountId(button.getAttribute("data-account-id"));
      const user = getUserById(accountId);
      if (!user || !action) return;
      const scope = el.detailsActions || el.detailsDrawer;
      void handleAccountAction(user, action, scope, button);
    });
  }

  function markRenderedAccountRows(renderedItems = []) {
    if (!el.body) return;
    const rows = Array.from(el.body.querySelectorAll("tr"));
    rows.forEach((row, index) => {
      if (!(row instanceof HTMLTableRowElement)) return;
      const item = renderedItems[index];
      const accountId = normalizeAccountId(item?.id) || getAccountIdFromBaseRow(row);
      row.setAttribute("data-row-type", "account");
      if (accountId) {
        row.setAttribute("data-account-id", accountId);
      }
    });
    syncSelectedRowState();
  }

  function handleTableRender(renderedItems = []) {
    markRenderedAccountRows(renderedItems);
    restoreOpenDrawer();
    toggleIdColumn(el.idToggle?.checked !== false);
    if (!state.columnResizeHydrated && renderedItems.length > 0) {
      state.columnResizeHydrated = true;
      state.columnResize?.refresh?.();
    }
  }

  function initColumnResize() {
    if (!el.table || !window.TableResize?.initResizableTable) return;
    state.columnResize = window.TableResize.initResizableTable({
      table: el.table,
      storageKey: COLUMN_WIDTH_STORAGE_KEY,
      minWidth: 0,
      maxWidth: 980,
      skipLastHandle: false,
      excludedColumnKeys: ["actions"],
      defaultColumnWidths: {
        actions: 132
      }
    });
  }

  function initTable() {
    if (!window.SearchPagination) return;
    state.manager = window.SearchPagination.createTableManager({
      data: [],
      searchFields: SEARCH_FIELDS,
      defaultSortField: "createdAt",
      defaultSortDirection: "desc",
      pageSize: 10,
      table: el.table,
      tableBody: el.body,
      emptyState: el.empty,
      countLabel: el.count,
      paginationContainer: el.pagination,
      searchInput: el.search,
      renderRow,
      onRender: handleTableRender
    });
  }

  async function init() {
    el.banner = $("accounts-snapshot-banner");
    el.status = $("accounts-status");
    el.source = $("accounts-source");
    el.count = $("accounts-count");
    el.body = $("accounts-body");
    el.table = $("accounts-table");
    el.tableScroll = $("accounts-table-scroll");
    el.appMain = $("app-main");
    el.pagination = $("accounts-pagination");
    el.empty = $("accounts-empty");
    el.search = $("accounts-search");
    el.roleFilter = $("accounts-role-filter");
    el.tierFilter = $("accounts-tier-filter");
    el.providerFilter = $("accounts-provider-filter");
    el.idToggle = $("accounts-id-toggle");
    el.exportJson = $("accounts-export-json");
    el.exportCsv = $("accounts-export-csv");
    el.exportStatus = $("accounts-export-status");
    el.detailsBackdrop = $("accounts-details-backdrop");
    el.detailsDrawer = $("accounts-details-drawer");
    el.detailsContent = $("accounts-details-content");
    el.detailsClose = $("accounts-details-close");
    el.detailsTitle = $("accounts-details-title");
    el.detailsSubtitle = $("accounts-details-subtitle");
    el.detailsProfile = $("accounts-details-profile");
    el.detailsActions = $("accounts-details-actions");
    el.detailsProfileSection = $("accounts-details-profile-section");
    el.detailsActionsSection = $("accounts-details-actions-section");
    el.detailsActionsHeading = $("accounts-details-actions-heading");
    state.openDrawerId = "";
    state.columnResizeHydrated = false;
    clearRowClickTimer();
    closeOpenDrawer({ keepState: true });

    ensureSupporterColumn();
    initTable();
    if (state.columnResize?.destroy) {
      state.columnResize.destroy();
    }
    state.columnResize = null;
    initColumnResize();
    bindEvents();
    toggleIdColumn(true);
    if (window.StreamSuitesGlobalLoader?.trackAsync) {
      await window.StreamSuitesGlobalLoader.trackAsync(
        () => Promise.all([loadAdminIdentity(), loadUsers(), loadDonations()]),
        "Hydrating accounts..."
      );
      return;
    }

    await Promise.all([loadAdminIdentity(), loadUsers(), loadDonations()]);
  }

  window.AccountsView = {
    init
  };
})();

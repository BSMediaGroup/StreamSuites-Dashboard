/* ============================================================
   StreamSuites Dashboard — Accounts view (admin actions)
   ============================================================ */

(() => {
  "use strict";

  const RUNTIME_ENDPOINT = "/admin/accounts";
  const SEARCH_FIELDS = [
    "userCode",
    "email",
    "displayName",
    "role",
    "tier",
    "accountStatus",
    "onboardingStatus"
  ];

  const state = {
    raw: [],
    manager: null,
    sourceLabel: "—",
    selfId: "",
    selfEmail: "",
    canManage: false,
    sourceMode: "runtime",
    exportLoading: false
  };

  const el = {
    banner: null,
    status: null,
    source: null,
    count: null,
    body: null,
    table: null,
    pagination: null,
    empty: null,
    search: null,
    roleFilter: null,
    tierFilter: null,
    providerFilter: null,
    idToggle: null,
    exportJson: null,
    exportCsv: null,
    exportStatus: null
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
    return `<span class="${classes}">${escapeHtml(formatBadgeLabel(value))}</span>`;
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
    return {
      id: raw.id || raw.uuid || raw.user_id || raw.userId || "—",
      userCode: raw.user_code || raw.userCode || raw.code || raw.handle || "—",
      email: raw.email || raw.email_address || raw.username || "—",
      displayName: raw.display_name || raw.displayName || raw.name || "—",
      role: raw.role || raw.account_role || "—",
      tier: raw.tier || raw.account_tier || raw.plan || "OPEN",
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
      lastLogin: raw.last_login || raw.lastLogin || raw.last_seen || null
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
    const base =
      window.StreamSuitesAdminAuth?.config?.baseUrl ||
      document.querySelector('meta[name="streamsuites-auth-base"]')?.getAttribute("content") ||
      "";
    return base ? base.replace(/\/$/, "") : "";
  }

  function buildApiUrl(path) {
    const base = resolveApiBase();
    if (!base) return path;
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalized}`;
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

  function renderActionButton({ label, action, tone, disabled, title }) {
    const classes = ["ss-btn", "ss-btn-small", tone].filter(Boolean).join(" ");
    const disabledAttr = disabled ? " disabled" : "";
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    return `
      <button
        class="${classes}"
        data-account-action="${action}"
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

    const actions = [];
    if (isActive) {
      actions.push(
        renderActionButton({
          label: "Suspend",
          action: "suspend",
          tone: "ss-btn-secondary",
          disabled: manageDisabled || isDeleted
        })
      );
    } else if (isSuspended) {
      actions.push(
        renderActionButton({
          label: "Unsuspend",
          action: "unsuspend",
          tone: "ss-btn-secondary",
          disabled: manageDisabled || isDeleted
        })
      );
    } else {
      actions.push(
        renderActionButton({
          label: "Suspend",
          action: "suspend",
          tone: "ss-btn-secondary",
          disabled: true,
          title: "Suspend only available for active accounts."
        })
      );
    }

    actions.push(
      renderActionButton({
        label: "Reset Onboarding",
        action: "reset-onboarding",
        tone: "ss-btn-secondary",
        disabled: manageDisabled || isDeleted,
        title: isDeleted ? "Cannot reset a deleted account." : ""
      })
    );

    actions.push(
      renderActionButton({
        label: "Force Logout",
        action: "invalidate-sessions",
        tone: "ss-btn-secondary",
        disabled: manageDisabled
      })
    );

    actions.push(
      renderActionButton({
        label: "Delete",
        action: "delete",
        tone: "ss-btn-danger",
        disabled: manageDisabled || isDeleted || isSelf,
        title: isSelf ? "Cannot delete your own account." : isDeleted ? "Account already deleted." : ""
      })
    );

    return `
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
        ${actions.join("")}
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

  function setBanner(message, visible) {
    if (!el.banner) return;
    el.banner.textContent = message;
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
  }

  function renderRow(user) {
    return `
      <td class="accounts-id-column">${escapeHtml(user.id)}</td>
      <td>${escapeHtml(user.userCode)}</td>
      <td>${escapeHtml(user.email)}</td>
      <td>${escapeHtml(user.displayName)}</td>
      <td>${renderBadge(user.role)}</td>
      <td>${renderBadge(user.tier)}</td>
      <td>${renderBadge(user.accountStatus, badgeToneForStatus(user.accountStatus))}</td>
      <td>${renderBadge(user.onboardingStatus, badgeToneForStatus(user.onboardingStatus))}</td>
      <td>${escapeHtml(user.providersLabel)}</td>
      <td>${escapeHtml(formatTimestamp(user.createdAt))}</td>
      <td>${escapeHtml(formatTimestamp(user.lastLogin))}</td>
      <td class="align-right">${renderActions(user)}</td>
    `;
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
    if (action === "delete") {
      return `Delete ${name}? This is a destructive action and will soft-delete the account.`;
    }
    return "";
  }

  function shouldConfirmAction(action) {
    return ["suspend", "unsuspend", "reset-onboarding", "delete"].includes(action);
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
    }

    state.raw[index] = next;
  }

  function setRowActionLoading(row, activeButton, isLoading) {
    if (!row) return;
    const buttons = row.querySelectorAll("[data-account-action]");
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
        const wasDisabled = button.dataset.originalDisabled === "true";
        button.disabled = wasDisabled;
        delete button.dataset.originalDisabled;
        if (button.dataset.originalLabel !== undefined) {
          button.textContent = button.dataset.originalLabel;
          delete button.dataset.originalLabel;
        }
      }
    });
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
    setStatus(`Applying ${action.replace("-", " ")}...`);
    setRowActionLoading(row, button, true);
    try {
      const method = action === "delete" ? "DELETE" : "POST";
      const res = await fetchJson(buildApiUrl(endpoint), { method });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setStatus("Admin session expired. Sign in again to continue.");
          return;
        }
        const message = await res.text();
        console.warn("[Accounts] Action failed", action, message);
        setStatus("Action failed. Retry or refresh your admin session.");
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
      setStatus("Action complete.");
    } catch (err) {
      console.warn("[Accounts] Action error", action, err);
      setStatus("Action failed. Retry or contact an admin if it persists.");
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
    const endpoint = `/admin/export/users.${format}`;
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
    el.body?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-account-action]");
      if (!button) return;
      if (button.disabled) return;
      const action = button.getAttribute("data-account-action") || "";
      const row = button.closest("tr");
      if (!row) return;
      const idCell = row.querySelector(".accounts-id-column");
      const accountId = idCell?.textContent?.trim() || "";
      const user = state.raw.find((entry) => entry.id === accountId);
      if (!user || !action) return;
      void handleAccountAction(user, action, row, button);
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
      renderRow
    });
  }

  async function init() {
    el.banner = $("accounts-snapshot-banner");
    el.status = $("accounts-status");
    el.source = $("accounts-source");
    el.count = $("accounts-count");
    el.body = $("accounts-body");
    el.table = $("accounts-table");
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

    initTable();
    bindEvents();
    toggleIdColumn(true);
    await Promise.all([loadAdminIdentity(), loadUsers()]);
  }

  window.AccountsView = {
    init
  };
})();

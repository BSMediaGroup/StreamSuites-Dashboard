/* ============================================================
   StreamSuites Dashboard — Accounts view (read-only)
   ============================================================ */

(() => {
  "use strict";

  const RUNTIME_ENDPOINT = "/admin/users";
  const SNAPSHOT_PATH = `${window.ADMIN_BASE_PATH}/exports/admin/users/users.json`;

  const state = {
    raw: [],
    manager: null,
    sourceLabel: "—"
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

  function applyFilters() {
    const role = el.roleFilter?.value || "";
    const tier = el.tierFilter?.value || "";
    const provider = el.providerFilter?.value || "";

    const filtered = state.raw.filter((item) => {
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

    state.manager?.setData(filtered);
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
      <td>${escapeHtml(user.role)}</td>
      <td>${escapeHtml(user.tier)}</td>
      <td>${escapeHtml(user.providersLabel)}</td>
      <td>${escapeHtml(formatTimestamp(user.createdAt))}</td>
      <td>${escapeHtml(formatTimestamp(user.lastLogin))}</td>
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
    setStatus("Loading runtime users…");
    setBanner("", false);

    let payload = null;
    let source = "runtime";

    try {
      const res = await fetchJson(RUNTIME_ENDPOINT);
      if (!res.ok) throw new Error(`Runtime error ${res.status}`);
      payload = await res.json();
      source = "runtime";
    } catch (err) {
      try {
        const snapshotRes = await fetchJson(SNAPSHOT_PATH, { credentials: "omit" });
        if (!snapshotRes.ok) throw new Error(`Snapshot error ${snapshotRes.status}`);
        payload = await snapshotRes.json();
        source = "snapshot";
      } catch (snapshotErr) {
        console.warn("[Accounts] Failed to load runtime or snapshot", err, snapshotErr);
        setStatus("Offline (no snapshot available)");
        setSource("Unavailable");
        state.raw = [];
        state.manager?.setData([]);
        setBanner("Runtime offline and no snapshot available.", true);
        return;
      }
    }

    const normalized = extractUsers(payload).map(normalizeUser);
    state.raw = normalized;
    updateFilterOptions(normalized);
    applyFilters();

    if (source === "snapshot") {
      setBanner("Viewing last exported snapshot (runtime offline)", true);
      setStatus("Snapshot mode");
      setSource("Snapshot export");
    } else {
      setBanner("", false);
      setStatus("Live runtime data");
      setSource("Runtime API");
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
    const endpoint = `/admin/export/users?format=${format}`;
    setExportStatus("Exporting…");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json, text/csv, application/octet-stream"
        }
      });

      if (!res.ok) {
        throw new Error(`Export failed (${res.status})`);
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const payload = await res.json();
        const redirectUrl = payload?.url || payload?.downloadUrl || payload?.download_url;
        if (redirectUrl) {
          window.location.assign(redirectUrl);
        }
        setExportStatus("Export triggered");
        return;
      }

      const blob = await res.blob();
      const filename = parseFilename(res.headers, `users.${format}`);
      downloadBlob(blob, filename);
      setExportStatus("Export ready");
    } catch (err) {
      console.warn("[Accounts] Export failed", err);
      setExportStatus("Export failed");
    }
  }

  function bindEvents() {
    el.roleFilter?.addEventListener("change", applyFilters);
    el.tierFilter?.addEventListener("change", applyFilters);
    el.providerFilter?.addEventListener("change", applyFilters);
    el.idToggle?.addEventListener("change", (event) => {
      toggleIdColumn(event.target.checked);
    });
    el.exportJson?.addEventListener("click", () => triggerExport("json"));
    el.exportCsv?.addEventListener("click", () => triggerExport("csv"));
  }

  function initTable() {
    if (!window.SearchPagination) return;
    state.manager = window.SearchPagination.createTableManager({
      data: [],
      searchFields: ["userCode", "email", "displayName", "role", "tier"],
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

  function init() {
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
    loadUsers();
  }

  window.AccountsView = {
    init
  };
})();

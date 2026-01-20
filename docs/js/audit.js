/* ============================================================
   StreamSuites Dashboard — Audit Logs view (read-only)
   ============================================================ */

(() => {
  "use strict";

  const RUNTIME_ENDPOINT = "/admin/audit";

  const state = {
    raw: [],
    manager: null
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
    actionFilter: null,
    actorFilter: null,
    startDate: null,
    endDate: null,
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

  function formatTimestamp(value) {
    if (typeof window.StreamSuitesState?.formatTimestamp === "function") {
      return window.StreamSuitesState.formatTimestamp(value) || "—";
    }
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return date.toISOString().replace("T", " ").replace("Z", " UTC");
  }

  function normalizeEntry(raw = {}) {
    const metadata = raw.metadata || raw.meta || raw.details || raw.context || null;
    return {
      timestamp: raw.timestamp || raw.time || raw.created_at || raw.createdAt || null,
      action: raw.action || raw.event || raw.type || "—",
      actorUserCode:
        raw.actor_user_code || raw.actorUserCode || raw.actor || raw.actor_id || "—",
      actorRole: raw.actor_role || raw.actorRole || raw.role || "—",
      targetUserCode:
        raw.target_user_code || raw.targetUserCode || raw.target || raw.target_id || "—",
      metadata
    };
  }

  function extractEntries(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.events)) return payload.events;
    if (Array.isArray(payload.audit)) return payload.audit;
    if (Array.isArray(payload.logs)) return payload.logs;
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
    if (el.source) el.source.textContent = label;
  }

  function setExportStatus(message) {
    if (el.exportStatus) el.exportStatus.textContent = message;
  }

  function updateActionFilter(items) {
    const actions = new Set();
    items.forEach((item) => {
      if (item.action && item.action !== "—") actions.add(item.action);
    });

    if (!el.actionFilter) return;
    const current = el.actionFilter.value;
    el.actionFilter.innerHTML = '<option value="">All actions</option>';
    Array.from(actions)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .forEach((action) => {
        const option = document.createElement("option");
        option.value = action;
        option.textContent = action;
        el.actionFilter.appendChild(option);
      });
    el.actionFilter.value = current || "";
  }

  function withinDateRange(timestamp, start, end) {
    if (!timestamp) return true;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return true;
    if (start) {
      const startDate = new Date(`${start}T00:00:00Z`);
      if (date < startDate) return false;
    }
    if (end) {
      const endDate = new Date(`${end}T23:59:59Z`);
      if (date > endDate) return false;
    }
    return true;
  }

  function applyFilters() {
    const action = el.actionFilter?.value || "";
    const actor = el.actorFilter?.value || "";
    const start = el.startDate?.value || "";
    const end = el.endDate?.value || "";

    const filtered = state.raw.filter((item) => {
      if (action && String(item.action).toLowerCase() !== action.toLowerCase()) {
        return false;
      }
      if (actor) {
        const actorMatch = String(item.actorUserCode || "")
          .toLowerCase()
          .includes(actor.toLowerCase());
        if (!actorMatch) return false;
      }
      if (!withinDateRange(item.timestamp, start, end)) {
        return false;
      }
      return true;
    });

    state.manager?.setData(filtered);
  }

  function renderMetadata(metadata) {
    if (!metadata) return "<span class=\"muted\">—</span>";
    const formatted =
      typeof metadata === "string"
        ? metadata
        : JSON.stringify(metadata, null, 2);
    return `
      <details>
        <summary class="muted">View</summary>
        <pre class="muted" style="white-space: pre-wrap;">${escapeHtml(formatted)}</pre>
      </details>
    `;
  }

  function renderRow(entry) {
    return `
      <td>${escapeHtml(formatTimestamp(entry.timestamp))}</td>
      <td>${escapeHtml(entry.action)}</td>
      <td>${escapeHtml(entry.actorUserCode)}</td>
      <td>${escapeHtml(entry.actorRole)}</td>
      <td>${escapeHtml(entry.targetUserCode)}</td>
      <td>${renderMetadata(entry.metadata)}</td>
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

  
  async function loadAuditLogs() {
    setStatus("Loading live audit logs...");
    setBanner("", false);

    try {
      const res = await fetchJson(buildApiUrl(RUNTIME_ENDPOINT));
      if (res.status === 401 || res.status === 403) {
        setStatus("Admin session required. Sign in to view audit logs.");
        setSource("Unauthorized");
        state.raw = [];
        state.manager?.setData([]);
        setBanner("Your admin session is missing or expired. Sign in to continue.", true);
        return;
      }
      if (!res.ok) throw new Error(`Runtime error ${res.status}`);
      const payload = await res.json();
      const normalized = extractEntries(payload).map(normalizeEntry);
      state.raw = normalized;
      updateActionFilter(normalized);
      applyFilters();
      setBanner("", false);
      setStatus("Live runtime data");
      setSource("Runtime API");
    } catch (err) {
      console.warn("[Audit] Failed to load runtime audit logs", err);
      setStatus("Runtime API unavailable. Retry or contact an admin.");
      setSource("Unavailable");
      state.raw = [];
      state.manager?.setData([]);
      setBanner("Runtime API unavailable. Retry or check runtime connectivity.", true);
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
    setExportStatus("Exporting...");

    try {
      const res = await fetch(buildApiUrl(`/admin/export/audit.${format}`), {
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
      const filename = parseFilename(res.headers, `audit.${format}`);
      downloadBlob(blob, filename);
      setExportStatus("Export ready");
    } catch (err) {
      console.warn("[Audit] Export failed", err);
      setExportStatus("Export failed");
    }
  }

  function bindEvents() {
    el.actionFilter?.addEventListener("change", applyFilters);
    el.actorFilter?.addEventListener("input", applyFilters);
    el.startDate?.addEventListener("change", applyFilters);
    el.endDate?.addEventListener("change", applyFilters);
    el.exportJson?.addEventListener("click", () => triggerExport("json"));
    el.exportCsv?.addEventListener("click", () => triggerExport("csv"));
  }

  function initTable() {
    if (!window.SearchPagination) return;
    state.manager = window.SearchPagination.createTableManager({
      data: [],
      searchFields: ["action", "actorUserCode", "targetUserCode", "actorRole"],
      defaultSortField: "timestamp",
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
    el.banner = $("audit-snapshot-banner");
    el.status = $("audit-status");
    el.source = $("audit-source");
    el.count = $("audit-count");
    el.body = $("audit-body");
    el.table = $("audit-table");
    el.pagination = $("audit-pagination");
    el.empty = $("audit-empty");
    el.search = $("audit-search");
    el.actionFilter = $("audit-action-filter");
    el.actorFilter = $("audit-actor-filter");
    el.startDate = $("audit-start-date");
    el.endDate = $("audit-end-date");
    el.exportJson = $("audit-export-json");
    el.exportCsv = $("audit-export-csv");
    el.exportStatus = $("audit-export-status");

    initTable();
    bindEvents();
    loadAuditLogs();
  }

  window.AuditLogsView = {
    init
  };
})();

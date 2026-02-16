/* ============================================================
   StreamSuites Dashboard - creators.js (runtime-backed)
   ============================================================ */

(() => {
  "use strict";

  const CREATORS_ENDPOINT = "/api/admin/creators";

  const el = {
    tableBody: null,
    emptyState: null,
    btnRefresh: null,
    btnAddCreator: null,
    btnImport: null,
    btnExport: null,
    editorPanel: null
  };

  const state = {
    creators: [],
    onRefreshClick: null,
    onTableClick: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resolveApiBase() {
    const base =
      window.StreamSuitesAdminAuth?.config?.baseUrl ||
      document
        .querySelector('meta[name="streamsuites-auth-base"]')
        ?.getAttribute("content") ||
      "";
    return base ? base.replace(/\/$/, "") : "";
  }

  function buildApiUrl(path) {
    const base = resolveApiBase();
    if (!base) return path;
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalized}`;
  }

  async function readJsonSafe(response) {
    try {
      return await response.json();
    } catch (err) {
      return null;
    }
  }

  function normalizedCreators(payload) {
    const rows = Array.isArray(payload?.creators) ? payload.creators : [];
    return rows
      .map((entry) => {
        const creatorId = String(entry?.creator_id || "").trim();
        if (!creatorId) return null;
        const displayName = String(entry?.display_name || creatorId).trim() || creatorId;
        const tier = String(entry?.tier || "").trim().toLowerCase() || "core";
        const status =
          String(entry?.status || "").trim().toLowerCase() ||
          (entry?.active === false ? "inactive" : "active");
        const updatedAt =
          entry?.updated_at || entry?.last_seen || entry?.created_at || null;
        return {
          creator_id: creatorId,
          display_name: displayName,
          tier,
          status,
          updated_at: updatedAt
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.creator_id.localeCompare(b.creator_id));
  }

  function formatTimestamp(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    try {
      return date.toLocaleString(undefined, { hour12: false });
    } catch (err) {
      return String(value);
    }
  }

  function renderStatus(status) {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "active") {
      return '<span class="status-pill success">Active</span>';
    }
    if (normalized === "paused") {
      return '<span class="status-pill warning">Paused</span>';
    }
    if (normalized === "inactive") {
      return '<span class="muted">Inactive</span>';
    }
    return `<span class="muted">${escapeHtml(normalized || "-")}</span>`;
  }

  function renderCreators() {
    if (!el.tableBody) return;
    el.tableBody.innerHTML = "";

    if (!state.creators.length) {
      el.emptyState?.classList.remove("hidden");
      return;
    }
    el.emptyState?.classList.add("hidden");

    state.creators.forEach((creator) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><code>${escapeHtml(creator.creator_id)}</code></td>
        <td>${escapeHtml(creator.tier || "-")}</td>
        <td>${renderStatus(creator.status)}</td>
        <td>${escapeHtml(formatTimestamp(creator.updated_at))}</td>
        <td class="align-right">
          <button class="ss-btn ss-btn-small ss-btn-secondary" data-copy-creator-id="${escapeHtml(
            creator.creator_id
          )}">
            Copy Creator ID
          </button>
        </td>
      `;
      el.tableBody.appendChild(tr);
    });
  }

  async function copyCreatorId(creatorId) {
    const text = String(creatorId || "").trim();
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch (err) {
      // Fallback below for locked clipboard APIs.
    }
    const temp = document.createElement("input");
    temp.type = "text";
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    temp.remove();
  }

  async function hydrateCreators() {
    try {
      const response = await fetch(buildApiUrl(CREATORS_ENDPOINT), {
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      const payload = await readJsonSafe(response);
      if (!response.ok || payload?.success === false) {
        state.creators = [];
        renderCreators();
        return;
      }
      state.creators = normalizedCreators(payload);
      renderCreators();
    } catch (err) {
      state.creators = [];
      renderCreators();
    }
  }

  function wireReadOnlyUi() {
    [el.btnAddCreator, el.btnImport, el.btnExport].forEach((button) => {
      if (!button) return;
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
      button.title = "Runtime creators registry is read-only in this view.";
    });
    if (el.editorPanel) {
      el.editorPanel.classList.add("hidden");
    }
  }

  function init() {
    el.tableBody = $("creators-table-body");
    el.emptyState = $("creators-empty");
    el.btnRefresh = $("btn-refresh-creators");
    el.btnAddCreator = $("btn-add-creator");
    el.btnImport = $("btn-import-creators");
    el.btnExport = $("btn-export-creators");
    el.editorPanel = $("creator-editor");

    wireReadOnlyUi();

    state.onRefreshClick = () => {
      void hydrateCreators();
    };
    el.btnRefresh?.addEventListener("click", state.onRefreshClick);

    state.onTableClick = (event) => {
      const button = event.target.closest("[data-copy-creator-id]");
      if (!(button instanceof HTMLButtonElement)) return;
      const creatorId = button.getAttribute("data-copy-creator-id") || "";
      void copyCreatorId(creatorId);
    };
    el.tableBody?.addEventListener("click", state.onTableClick);

    void hydrateCreators();
  }

  function destroy() {
    if (state.onRefreshClick && el.btnRefresh) {
      el.btnRefresh.removeEventListener("click", state.onRefreshClick);
    }
    if (state.onTableClick && el.tableBody) {
      el.tableBody.removeEventListener("click", state.onTableClick);
    }
    state.creators = [];
    state.onRefreshClick = null;
    state.onTableClick = null;
  }

  function exportCreators() {
    // Keep method for existing view-scoped handlers; creators are runtime-authoritative.
  }

  function importCreatorsFromFile() {
    // Keep method for existing view-scoped handlers; creators are runtime-authoritative.
  }

  window.CreatorsView = {
    init,
    destroy,
    exportCreators,
    importCreatorsFromFile
  };
})();


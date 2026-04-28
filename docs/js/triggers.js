(() => {
  "use strict";

  const state = {
    registry: { triggers: [], games: [], capabilities: [], assets: [], schemas: [], summary: null },
    filters: { module: "", status: "", platform: "", search: "" },
    abortController: null,
  };

  const el = {};

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    if (value === undefined || value === null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resolveApiBase() {
    const base =
      window.StreamSuitesAdminAuth?.config?.baseUrl ||
      document.querySelector('meta[name="streamsuites-auth-base"]')?.getAttribute("content") ||
      "";
    return base ? String(base).replace(/\/+$/, "") : "";
  }

  function buildApiUrl(path) {
    const base = resolveApiBase();
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return base ? `${base}${normalized}` : normalized;
  }

  async function requestJson(path, options = {}) {
    const response = await fetch(buildApiUrl(path), {
      cache: "no-store",
      credentials: "include",
      signal: options.signal,
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (_err) {
      payload = null;
    }
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
    }
    return payload || {};
  }

  function formatTimestamp(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, { hour12: false, month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function setBanner(message, tone = "") {
    if (!(el.banner instanceof HTMLElement)) return;
    el.banner.textContent = message || "";
    el.banner.className = message ? "ss-alert" : "ss-alert hidden";
    if (tone === "danger" || tone === "warning") el.banner.classList.add("ss-alert-danger");
    if (tone === "success") el.banner.classList.add("ss-alert-success");
  }

  function humanizePlatform(platform) {
    const normalized = String(platform || "").trim().toLowerCase();
    if (normalized === "youtube") return "YouTube";
    if (normalized === "streamsuites_unified") return "StreamSuites unified";
    return normalized ? normalized.replace(/\b\w/g, (char) => char.toUpperCase()) : "Unknown";
  }

  function platformCapsSummary() {
    return state.registry.capabilities
      .map((item) => `${humanizePlatform(item.platform)} ${item.max_chars}${item.enabled === false ? " planned/disabled" : ""}`)
      .join(", ");
  }

  function renderSummary() {
    const summary = state.registry.summary || {};
    const counts = summary.counts || {};
    const gameTriggers = state.registry.triggers.filter((item) => String(item?.module || "").toUpperCase() === "GAMES").length;
    const cards = [
      { label: "Triggers", value: counts.trigger_count || state.registry.triggers.length, note: `${gameTriggers} Games-module rows` },
      { label: "Games", value: counts.game_count || state.registry.games.length, note: "Registry definitions only" },
      { label: "Assets", value: counts.asset_count || state.registry.assets.length, note: "Catalog metadata" },
      { label: "Platform caps", value: state.registry.capabilities.length, note: platformCapsSummary() },
      { label: "Authority", value: summary.authority || "StreamSuites", note: summary.source || "runtime" },
      { label: "Served", value: formatTimestamp(summary.served_at), note: "Cache disabled" },
    ];
    if (el.summary instanceof HTMLElement) {
      el.summary.innerHTML = cards.map((item) => `
        <article class="ss-stat-card">
          <div class="muted">${escapeHtml(item.label)}</div>
          <strong>${escapeHtml(item.value)}</strong>
          <span class="muted">${escapeHtml(item.note)}</span>
        </article>
      `).join("");
    }
  }

  function rowSearchText(item) {
    return [
      item.id,
      item.module,
      item.status,
      item.type,
      item.trigger,
      item.prefix,
      ...(Array.isArray(item.aliases) ? item.aliases : []),
    ].join(" ").toLowerCase();
  }

  function filteredTriggers() {
    const moduleValue = state.filters.module.toLowerCase();
    const statusValue = state.filters.status.toLowerCase();
    const platformValue = state.filters.platform.toLowerCase();
    const searchValue = state.filters.search.toLowerCase();
    return state.registry.triggers.filter((item) => {
      const platforms = Array.isArray(item?.eligible_platforms) ? item.eligible_platforms.map((platform) => String(platform).toLowerCase()) : [];
      if (moduleValue && String(item?.module || "").toLowerCase() !== moduleValue) return false;
      if (statusValue && String(item?.status || "").toLowerCase() !== statusValue) return false;
      if (platformValue && !platforms.includes(platformValue)) return false;
      if (searchValue && !rowSearchText(item).includes(searchValue)) return false;
      return true;
    });
  }

  function renderFilters() {
    const modules = Array.from(new Set(state.registry.triggers.map((item) => item.module).filter(Boolean))).sort();
    const statuses = Array.from(new Set(state.registry.triggers.map((item) => item.status).filter(Boolean))).sort();
    const platforms = Array.from(new Set(state.registry.capabilities.map((item) => item.platform).filter(Boolean))).sort();
    if (el.moduleFilter instanceof HTMLSelectElement) {
      el.moduleFilter.innerHTML = `<option value="">All modules</option>${modules.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
    }
    if (el.statusFilter instanceof HTMLSelectElement) {
      el.statusFilter.innerHTML = `<option value="">All statuses</option>${statuses.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
    }
    if (el.platformFilter instanceof HTMLSelectElement) {
      el.platformFilter.innerHTML = `<option value="">All platforms</option>${platforms.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(humanizePlatform(item))}</option>`).join("")}`;
    }
  }

  function renderRows() {
    if (!(el.tableBody instanceof HTMLElement)) return;
    const items = filteredTriggers();
    if (!items.length) {
      el.tableBody.innerHTML = "";
      el.empty?.classList.remove("hidden");
      return;
    }
    el.empty?.classList.add("hidden");
    el.tableBody.innerHTML = items.map((item) => {
      const platforms = Array.isArray(item.eligible_platforms) ? item.eligible_platforms : [];
      return `
        <tr>
          <td>
            <strong>${escapeHtml(item.id)}</strong>
            <div class="muted">${escapeHtml(`${item.prefix || ""}${item.trigger || ""}`)}</div>
            <div class="muted">${escapeHtml(Array.isArray(item.aliases) && item.aliases.length ? `Aliases: ${item.aliases.join(", ")}` : "Aliases: none")}</div>
          </td>
          <td>${escapeHtml(item.module || "-")}</td>
          <td><span class="ss-badge ${item.status === "active" ? "ss-badge-success" : "ss-badge-warning"}">${escapeHtml(item.status || "planned")}</span></td>
          <td>${escapeHtml(item.type || "-")}</td>
          <td>${escapeHtml(platforms.map(humanizePlatform).join(", "))}</td>
          <td>
            <div>${escapeHtml(item.response_mode || "-")}</div>
            <div class="muted">${escapeHtml(item.cooldown || "-")}</div>
          </td>
          <td>
            <div>Actor: ${escapeHtml(item.actor_resolution || "-")}</div>
            <div>Mention: ${escapeHtml(item.mention_behavior || "-")}</div>
            <div>Identity: ${escapeHtml(item.identity_required || "-")}</div>
            <div>Profile: ${escapeHtml(item.profile_binding || "-")}</div>
            <div>Role gate: ${escapeHtml(item.role_gate_source || "-")}</div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderGameRows() {
    if (!(el.games instanceof HTMLElement)) return;
    const rows = state.registry.games.slice(0, 12).map((item) => `
      <li>
        <strong>${escapeHtml(item.id)}</strong>
        <span> - ${escapeHtml(item.status || "planned")} - ${escapeHtml(item.trigger || "")}</span>
      </li>
    `);
    el.games.innerHTML = rows.length
      ? rows.join("")
      : "<li>No game registry rows were returned by runtime/Auth.</li>";
  }

  function renderAll() {
    renderSummary();
    renderFilters();
    renderRows();
    renderGameRows();
    if (el.runtimeState instanceof HTMLElement) {
      const pilled = state.registry.capabilities.find((item) => item.platform === "pilled");
      el.runtimeState.textContent = pilled?.enabled === false
        ? "Hydrated from runtime/Auth. Read-only foundation; Pilled is planned/disabled and no playable game engine or trigger transport is implied."
        : "Hydrated from runtime/Auth. Read-only foundation.";
    }
  }

  async function refreshAll() {
    setBanner("");
    if (el.runtimeState instanceof HTMLElement) el.runtimeState.textContent = "Loading authoritative runtime registry...";
    const signal = state.abortController?.signal;
    const [summary, triggers, games, capabilities, assets, schemas] = await Promise.all([
      requestJson("/api/livechat/registry-summary", { signal }),
      requestJson("/api/livechat/triggers", { signal }),
      requestJson("/api/livechat/games", { signal }),
      requestJson("/api/livechat/capabilities", { signal }),
      requestJson("/api/livechat/game-assets", { signal }),
      requestJson("/api/livechat/game-schemas", { signal }),
    ]);
    state.registry = {
      summary,
      triggers: Array.isArray(triggers.items) ? triggers.items : [],
      games: Array.isArray(games.items) ? games.items : [],
      capabilities: Array.isArray(capabilities.items) ? capabilities.items : [],
      assets: Array.isArray(assets.items) ? assets.items : [],
      schemas: Array.isArray(schemas.items) ? schemas.items : [],
    };
    renderAll();
  }

  async function init() {
    if (state.abortController) state.abortController.abort();
    state.abortController = new AbortController();
    const signal = state.abortController.signal;
    el.banner = $("triggers-banner");
    el.runtimeState = $("triggers-runtime-state");
    el.summary = $("triggers-registry-summary");
    el.moduleFilter = $("triggers-module-filter");
    el.statusFilter = $("triggers-status-filter");
    el.platformFilter = $("triggers-platform-filter");
    el.search = $("triggers-search");
    el.tableBody = $("triggers-table-body");
    el.empty = $("triggers-empty");
    el.games = $("triggers-games-list");
    $("btn-refresh-triggers")?.addEventListener("click", () => void refreshAll().catch((err) => setBanner(err?.message || "Unable to refresh registry.", "danger")), { signal });
    [el.moduleFilter, el.statusFilter, el.platformFilter, el.search].forEach((control) => {
      control?.addEventListener("input", () => {
        state.filters.module = el.moduleFilter?.value || "";
        state.filters.status = el.statusFilter?.value || "";
        state.filters.platform = el.platformFilter?.value || "";
        state.filters.search = el.search?.value || "";
        renderRows();
      }, { signal });
    });
    try {
      await refreshAll();
    } catch (err) {
      setBanner(err?.message || "Unable to load runtime registry.", "danger");
      if (el.runtimeState instanceof HTMLElement) el.runtimeState.textContent = "Registry hydration failed.";
    }
  }

  window.TriggersView = {
    init,
    destroy() {
      if (state.abortController) {
        state.abortController.abort();
        state.abortController = null;
      }
      state.registry = { triggers: [], games: [], capabilities: [], assets: [], schemas: [], summary: null };
    },
  };
})();

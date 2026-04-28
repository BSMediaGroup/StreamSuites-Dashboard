(() => {
  "use strict";

  const state = {
    registry: { triggers: [], games: [], capabilities: [], assets: [], schemas: [], summary: null },
    filters: { module: "", status: "", platform: "", search: "" },
    customItems: [],
    customFilters: { creator: "", status: "", platform: "", search: "" },
    previewResult: null,
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

  function customRowSearchText(item) {
    return [
      item.id,
      item.custom_trigger_id,
      item.creator_id,
      item.creator_account_id,
      item.owner_user_code,
      item.status,
      item.trigger,
      item.command_text,
      ...(Array.isArray(item.aliases) ? item.aliases : []),
    ].join(" ").toLowerCase();
  }

  function filteredCustomTriggers() {
    const creatorValue = state.customFilters.creator.toLowerCase();
    const statusValue = state.customFilters.status.toLowerCase();
    const platformValue = state.customFilters.platform.toLowerCase();
    const searchValue = state.customFilters.search.toLowerCase();
    return state.customItems.filter((item) => {
      const haystack = customRowSearchText(item);
      const platforms = Array.isArray(item?.eligible_platforms)
        ? item.eligible_platforms.map((platform) => String(platform).toLowerCase())
        : [];
      if (creatorValue && !haystack.includes(creatorValue)) return false;
      if (statusValue && String(item?.status || "").toLowerCase() !== statusValue && String(Boolean(item?.enabled)).toLowerCase() !== statusValue) return false;
      if (platformValue && !platforms.includes(platformValue)) return false;
      if (searchValue && !haystack.includes(searchValue)) return false;
      return true;
    });
  }

  function renderCustomRows() {
    if (!(el.customTableBody instanceof HTMLElement)) return;
    const items = filteredCustomTriggers();
    if (el.customState instanceof HTMLElement) {
      el.customState.textContent = `Custom triggers: creator-owned runtime config (${state.customItems.length} loaded). Execution/transport is a later phase.`;
    }
    if (!items.length) {
      el.customTableBody.innerHTML = "";
      el.customEmpty?.classList.remove("hidden");
      return;
    }
    el.customEmpty?.classList.add("hidden");
    el.customTableBody.innerHTML = items.map((item) => {
      const platforms = Array.isArray(item.eligible_platforms) ? item.eligible_platforms : [];
      const creatorId = item.creator_id || item.creator_account_id || "";
      const id = item.id || item.custom_trigger_id || "";
      const canMutate = Boolean(creatorId && id);
      return `
        <tr>
          <td>
            <strong>${escapeHtml(id)}</strong>
            <div class="muted">${escapeHtml(creatorId)}</div>
            <div class="muted">${escapeHtml(item.owner_user_code || "-")}</div>
          </td>
          <td>
            <span class="ss-badge ${item.enabled ? "ss-badge-success" : "ss-badge-warning"}">${escapeHtml(item.enabled ? "Enabled" : "Disabled")}</span>
            <div class="muted">${escapeHtml(item.status || "-")}</div>
          </td>
          <td>
            <strong>${escapeHtml(item.command_text || `${item.prefix || ""}${item.trigger || ""}`)}</strong>
            <div class="muted">${escapeHtml(Array.isArray(item.aliases) && item.aliases.length ? `Aliases: ${item.aliases.join(", ")}` : "Aliases: none")}</div>
          </td>
          <td>${escapeHtml(platforms.map(humanizePlatform).join(", "))}</td>
          <td>
            <div>${escapeHtml(item.response_mode || "-")}</div>
            <div class="muted">${escapeHtml((item.cooldown_seconds || item.cooldown?.user_seconds || 5) + "s user cooldown")}</div>
          </td>
          <td>
            <div>${escapeHtml(item.access || "everyone")}</div>
            <div class="muted">Actor: ${escapeHtml(item.actor_resolution || "-")}</div>
            <div class="muted">Role gate: ${escapeHtml(item.role_gate_source || "-")}</div>
          </td>
          <td>
            <div>${escapeHtml(formatTimestamp(item.created_at))}</div>
            <div class="muted">${escapeHtml(formatTimestamp(item.updated_at))}</div>
          </td>
          <td>
            ${canMutate ? `
              <button class="ss-btn ss-btn-secondary ss-btn-small" type="button" data-custom-trigger-toggle="${escapeHtml(id)}" data-creator-id="${escapeHtml(creatorId)}" data-next-enabled="${item.enabled ? "false" : "true"}">${escapeHtml(item.enabled ? "Disable" : "Enable")}</button>
              <button class="ss-btn ss-btn-danger ss-btn-small" type="button" data-custom-trigger-delete="${escapeHtml(id)}" data-creator-id="${escapeHtml(creatorId)}">Delete</button>
            ` : `<span class="muted">Admin mutation later</span>`}
          </td>
        </tr>
      `;
    }).join("");
    renderPreviewTriggerOptions();
  }

  function renderPreviewTriggerOptions() {
    if (!(el.previewTrigger instanceof HTMLSelectElement)) return;
    const selected = el.previewTrigger.value;
    el.previewTrigger.innerHTML = `<option value="">Match simulated message</option>${state.customItems.map((item) => {
      const id = item.id || item.custom_trigger_id || "";
      return `<option value="${escapeHtml(id)}" data-creator-id="${escapeHtml(item.creator_id || item.creator_account_id || "")}">${escapeHtml(item.command_text || id)} - ${escapeHtml(item.owner_user_code || item.creator_id || "")}</option>`;
    }).join("")}`;
    if (selected && state.customItems.some((item) => String(item.id || item.custom_trigger_id || "") === selected)) {
      el.previewTrigger.value = selected;
    }
  }

  function selectedPreviewTrigger() {
    const id = el.previewTrigger?.value || "";
    return state.customItems.find((item) => String(item.id || item.custom_trigger_id || "") === id) || null;
  }

  function renderPreviewResult(payload) {
    if (!(el.previewResult instanceof HTMLElement)) return;
    if (!payload) {
      el.previewResult.textContent = "No preview run yet. Dry-run responses will show no-send flags, match metadata, variables, and split pages here.";
      return;
    }
    const pages = Array.isArray(payload.pages) ? payload.pages : [];
    const warnings = Array.isArray(payload.validation_warnings) ? payload.validation_warnings : [];
    const variables = payload.variables_used && typeof payload.variables_used === "object" ? payload.variables_used : {};
    el.previewResult.innerHTML = `
      <div class="ss-grid ss-grid-3">
        <article class="ss-stat-card"><div class="muted">Dry run</div><strong>${escapeHtml(String(payload.dry_run))}</strong><span class="muted">posted: ${escapeHtml(String(payload.posted))}</span></article>
        <article class="ss-stat-card"><div class="muted">Would post</div><strong>${escapeHtml(String(payload.would_post))}</strong><span class="muted">${escapeHtml(payload.blocked_reason || "not blocked")}</span></article>
        <article class="ss-stat-card"><div class="muted">Match</div><strong>${escapeHtml(payload.trigger_id || "none")}</strong><span class="muted">${escapeHtml(payload.match_reason || "no_match")}</span></article>
      </div>
      <table class="ss-table ss-table-compact" style="margin-top:16px;">
        <tbody>
          <tr><th>Creator</th><td>${escapeHtml(payload.creator_id || selectedPreviewTrigger()?.creator_id || "-")}</td></tr>
          <tr><th>Custom trigger ID</th><td>${escapeHtml(payload.custom_trigger_id || "-")}</td></tr>
          <tr><th>Platform max chars</th><td>${escapeHtml(payload.platform || "-")} / ${escapeHtml(payload.platform_max_chars || "-")}</td></tr>
          <tr><th>Response mode</th><td>${escapeHtml(payload.response_mode || "-")}</td></tr>
          <tr><th>Variables used</th><td>${escapeHtml(JSON.stringify(variables))}</td></tr>
          <tr><th>Actor</th><td>${escapeHtml(JSON.stringify(payload.actor || {}))}</td></tr>
          <tr><th>Warnings</th><td>${escapeHtml(warnings.join(", ") || "none")}</td></tr>
          <tr><th>Rendered text</th><td>${escapeHtml(payload.rendered_text || "")}</td></tr>
        </tbody>
      </table>
      <div style="margin-top:16px;">
        <strong>Pages (${escapeHtml(pages.length)})</strong>
        ${pages.length ? pages.map((page) => `<p class="muted">${escapeHtml(page.page_index)}/${escapeHtml(page.total_pages)} ${escapeHtml(page.text)}</p>`).join("") : `<p class="muted">No pages returned.</p>`}
      </div>
    `;
  }

  async function runPreview() {
    const selected = selectedPreviewTrigger();
    const creatorId = selected?.creator_id || selected?.creator_account_id || "";
    const payload = {
      creator_id: creatorId,
      custom_trigger_id: el.previewTrigger?.value || undefined,
      platform: el.previewPlatform?.value || "rumble",
      message: el.previewMessage?.value || "",
      actor: {
        display_name: el.previewDisplay?.value || "Preview Viewer",
        handle: el.previewHandle?.value || "previewviewer",
      },
      stream_context: {
        stream_title: el.previewStreamTitle?.value || "",
      },
    };
    if (!payload.creator_id && state.customItems.length) {
      payload.creator_id = state.customItems[0].creator_id || state.customItems[0].creator_account_id || "";
    }
    state.previewResult = await requestJson("/api/admin/livechat/custom-triggers/preview", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });
    renderPreviewResult(state.previewResult);
  }

  function renderAll() {
    renderSummary();
    renderFilters();
    renderRows();
    renderGameRows();
    renderCustomRows();
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
    const [summary, triggers, games, capabilities, assets, schemas, customTriggers] = await Promise.all([
      requestJson("/api/livechat/registry-summary", { signal }),
      requestJson("/api/livechat/triggers", { signal }),
      requestJson("/api/livechat/games", { signal }),
      requestJson("/api/livechat/capabilities", { signal }),
      requestJson("/api/livechat/game-assets", { signal }),
      requestJson("/api/livechat/game-schemas", { signal }),
      requestJson("/api/admin/livechat/custom-triggers", { signal }),
    ]);
    state.registry = {
      summary,
      triggers: Array.isArray(triggers.items) ? triggers.items : [],
      games: Array.isArray(games.items) ? games.items : [],
      capabilities: Array.isArray(capabilities.items) ? capabilities.items : [],
      assets: Array.isArray(assets.items) ? assets.items : [],
      schemas: Array.isArray(schemas.items) ? schemas.items : [],
    };
    state.customItems = Array.isArray(customTriggers.items) ? customTriggers.items : [];
    renderAll();
  }

  async function updateCustomTrigger(creatorId, triggerId, enabled) {
    await requestJson(`/api/admin/accounts/${encodeURIComponent(creatorId)}/creator-triggers/${encodeURIComponent(triggerId)}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
      headers: { "Content-Type": "application/json" },
    });
    await refreshAll();
  }

  async function deleteCustomTrigger(creatorId, triggerId) {
    await requestJson(`/api/admin/accounts/${encodeURIComponent(creatorId)}/creator-triggers/${encodeURIComponent(triggerId)}`, {
      method: "DELETE",
    });
    await refreshAll();
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
    el.customState = $("triggers-custom-state");
    el.customCreatorFilter = $("triggers-custom-creator-filter");
    el.customStatusFilter = $("triggers-custom-status-filter");
    el.customPlatformFilter = $("triggers-custom-platform-filter");
    el.customSearch = $("triggers-custom-search");
    el.customTableBody = $("triggers-custom-table-body");
    el.customEmpty = $("triggers-custom-empty");
    el.previewForm = $("triggers-preview-form");
    el.previewTrigger = $("triggers-preview-trigger");
    el.previewPlatform = $("triggers-preview-platform");
    el.previewMessage = $("triggers-preview-message");
    el.previewDisplay = $("triggers-preview-display");
    el.previewHandle = $("triggers-preview-handle");
    el.previewStreamTitle = $("triggers-preview-stream-title");
    el.previewResult = $("triggers-preview-result");
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
    [el.customCreatorFilter, el.customStatusFilter, el.customPlatformFilter, el.customSearch].forEach((control) => {
      control?.addEventListener("input", () => {
        state.customFilters.creator = el.customCreatorFilter?.value || "";
        state.customFilters.status = el.customStatusFilter?.value || "";
        state.customFilters.platform = el.customPlatformFilter?.value || "";
        state.customFilters.search = el.customSearch?.value || "";
        renderCustomRows();
      }, { signal });
    });
    el.customTableBody?.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const toggle = target.closest("[data-custom-trigger-toggle]");
      if (toggle) {
        void updateCustomTrigger(
          toggle.getAttribute("data-creator-id") || "",
          toggle.getAttribute("data-custom-trigger-toggle") || "",
          toggle.getAttribute("data-next-enabled") === "true",
        ).catch((err) => setBanner(err?.message || "Unable to update custom trigger.", "danger"));
      }
      const deleteButton = target.closest("[data-custom-trigger-delete]");
      if (deleteButton) {
        void deleteCustomTrigger(
          deleteButton.getAttribute("data-creator-id") || "",
          deleteButton.getAttribute("data-custom-trigger-delete") || "",
        ).catch((err) => setBanner(err?.message || "Unable to delete custom trigger.", "danger"));
      }
    }, { signal });
    el.previewForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      void runPreview().catch((err) => setBanner(err?.message || "Unable to run custom trigger preview.", "danger"));
    }, { signal });
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
      state.customItems = [];
      state.previewResult = null;
    },
  };
})();

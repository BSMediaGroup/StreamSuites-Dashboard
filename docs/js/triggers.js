(() => {
  "use strict";

  const state = {
    registry: { triggers: [], games: [], capabilities: [], assets: [], schemas: [], summary: null },
    editor: null,
    filters: { module: "", status: "", platform: "", search: "" },
    customItems: [],
    customFilters: { creator: "", status: "", platform: "", search: "" },
    previewResult: null,
    abortController: null,
  };

  const ADMIN_TRIGGER_EDITOR_ENDPOINT = "/api/admin/livechat/trigger-editor";
  const ADMIN_TRIGGER_EDITOR_DRY_RUN_ENDPOINT = "/api/admin/livechat/trigger-editor/dry-run";
  const ADMIN_TRIGGER_EDITOR_VALIDATE_ENDPOINT = "/api/admin/livechat/trigger-editor/validate";

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
      const validation = item.validation || {};
      const errors = Array.isArray(validation.errors) ? validation.errors : [];
      const warnings = Array.isArray(validation.warnings) ? validation.warnings : [];
      const permission = item.permission || {};
      return `
        <tr>
          <td>
            <strong>${escapeHtml(item.command_text || item.id)}</strong>
            <div class="muted">${escapeHtml(item.id || item.trigger_id || "-")}</div>
            <div class="muted">${escapeHtml(Array.isArray(item.aliases) && item.aliases.length ? `Aliases: ${item.aliases.join(", ")}` : "Aliases: none")}</div>
          </td>
          <td>
            <div>${escapeHtml(item.module || "-")}</div>
            <div class="muted">${escapeHtml(item.source || "-")}${item.read_only ? " / read-only" : ""}</div>
          </td>
          <td>
            <span class="ss-badge ${item.enabled && item.status === "active" ? "ss-badge-success" : "ss-badge-warning"}">${escapeHtml(item.status || "planned")}</span>
            ${item.module_status ? `<div class="muted">${escapeHtml(item.module_status)}</div>` : ""}
          </td>
          <td>${escapeHtml(item.type || "-")}</td>
          <td>${escapeHtml(platforms.map(humanizePlatform).join(", "))}</td>
          <td>
            <div>${escapeHtml(item.response_mode || "-")}</div>
            <div class="muted">${escapeHtml(item.cooldown_seconds ? `${item.cooldown_seconds}s` : item.cooldown?.label || "-")}</div>
            <div class="muted">${escapeHtml(item.response_preview_text || "")}</div>
          </td>
          <td>
            <div>Access: ${escapeHtml(permission.access || item.access || "everyone")}</div>
            <div>Role gate: ${escapeHtml(permission.role_gate_source || item.role_gate_source || "-")}</div>
            <div>Validation: ${escapeHtml(errors.length ? errors.map((err) => err.code || err).join(", ") : warnings.length ? warnings.map((warn) => warn.code || warn).join(", ") : "clear")}</div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderGameRows() {
    if (!(el.games instanceof HTMLElement)) return;
    const planned = state.editor?.planned_module_triggers || state.registry.games || [];
    const rows = planned.slice(0, 18).map((item) => `
      <li>
        <strong>${escapeHtml(item.command_text || item.id)}</strong>
        <span> - ${escapeHtml(item.module || "planned")} - ${escapeHtml(item.module_status || item.status || "unavailable")}</span>
      </li>
    `);
    el.games.innerHTML = rows.length
      ? rows.join("")
      : "<li>No planned module rows were returned by runtime/Auth.</li>";
  }

  function renderEffectiveCommandList() {
    if (!(el.effectiveList instanceof HTMLElement)) return;
    const rows = Array.isArray(state.editor?.effective_triggers) ? state.editor.effective_triggers : [];
    const platform = state.filters.platform || "kick";
    const commands = rows
      .filter((item) => {
        const platforms = Array.isArray(item.eligible_platforms) ? item.eligible_platforms.map((value) => String(value).toLowerCase()) : [];
        return !platform || platforms.includes(platform) || item.source === "planned";
      })
      .slice(0, 80);
    el.effectiveList.innerHTML = commands.length
      ? commands.map((item) => `
        <div>
          <strong>${escapeHtml(item.command_text || item.id)}</strong>
          <span> - ${escapeHtml(item.source || "runtime")} - ${escapeHtml(item.enabled ? "enabled" : item.module_status || item.status || "disabled")}${item.read_only ? " - read-only" : ""}</span>
        </div>
      `).join("")
      : "No effective commands were returned for this creator.";
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
    const rows = Array.isArray(state.editor?.effective_triggers) ? state.editor.effective_triggers : state.customItems;
    el.previewTrigger.innerHTML = `<option value="">Match simulated message</option>${rows.map((item) => {
      const id = item.id || item.custom_trigger_id || item.trigger_id || "";
      const command = item.command_text || `${item.prefix || ""}${item.trigger || ""}`;
      return `<option value="${escapeHtml(id)}" data-command="${escapeHtml(command)}" data-creator-id="${escapeHtml(item.creator_id || item.creator_account_id || state.editor?.creator?.account_id || "")}">${escapeHtml(command || id)} - ${escapeHtml(item.source || item.owner_user_code || "runtime")}</option>`;
    }).join("")}`;
    if (selected && rows.some((item) => String(item.id || item.custom_trigger_id || item.trigger_id || "") === selected)) {
      el.previewTrigger.value = selected;
    }
  }

  function selectedPreviewTrigger() {
    const id = el.previewTrigger?.value || "";
    const rows = Array.isArray(state.editor?.effective_triggers) ? state.editor.effective_triggers : state.customItems;
    return rows.find((item) => String(item.id || item.custom_trigger_id || item.trigger_id || "") === id) || null;
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
    const matched = payload.matched_trigger || {};
    const diagnostics = payload.diagnostics || {};
    el.previewResult.innerHTML = `
      <div class="ss-grid ss-grid-3">
        <article class="ss-stat-card"><div class="muted">Dry run</div><strong>${escapeHtml(String(payload.dry_run))}</strong><span class="muted">posted: ${escapeHtml(String(payload.posted))}</span></article>
        <article class="ss-stat-card"><div class="muted">Would dispatch</div><strong>${escapeHtml(String(payload.action_summary?.would_dispatch || payload.would_post || false))}</strong><span class="muted">${escapeHtml(payload.no_match_reason || payload.blocked_reason || diagnostics.final_outcome || "not blocked")}</span></article>
        <article class="ss-stat-card"><div class="muted">Match</div><strong>${escapeHtml(matched.command_text || payload.trigger_id || "none")}</strong><span class="muted">${escapeHtml(diagnostics.match_type || payload.match_reason || "no_match")}</span></article>
      </div>
      <table class="ss-table ss-table-compact" style="margin-top:16px;">
        <tbody>
          <tr><th>Creator</th><td>${escapeHtml(state.editor?.creator?.account_id || payload.creator_id || selectedPreviewTrigger()?.creator_id || "-")}</td></tr>
          <tr><th>Trigger ID</th><td>${escapeHtml(matched.id || payload.custom_trigger_id || "-")}</td></tr>
          <tr><th>Permission</th><td>${escapeHtml(JSON.stringify(payload.permission || {}))}</td></tr>
          <tr><th>Cooldown</th><td>${escapeHtml(JSON.stringify(payload.cooldown || {}))}</td></tr>
          <tr><th>Response mode</th><td>${escapeHtml(matched.response_mode || payload.response_mode || "-")}</td></tr>
          <tr><th>Variables used</th><td>${escapeHtml(JSON.stringify(variables))}</td></tr>
          <tr><th>Actor</th><td>${escapeHtml(JSON.stringify(payload.actor || {}))}</td></tr>
          <tr><th>Warnings</th><td>${escapeHtml(warnings.join(", ") || "none")}</td></tr>
          <tr><th>Rendered text</th><td>${escapeHtml(payload.generated_reply || payload.rendered_text || "")}</td></tr>
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
    const creatorId = selected?.creator_id || selected?.creator_account_id || state.editor?.creator?.account_id || "";
    const selectedCommand = selected?.command_text || "";
    const payload = {
      creator_id: creatorId,
      trigger_id: selected?.id || selected?.trigger_id || undefined,
      platform: el.previewPlatform?.value || "rumble",
      message: el.previewMessage?.value || selectedCommand || "",
      sender_role: "viewer",
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
    await requestJson(ADMIN_TRIGGER_EDITOR_VALIDATE_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({
        creator_id: creatorId,
        source: selected?.source || "custom",
        command_text: selectedCommand || payload.message,
        aliases: selected?.aliases || [],
        eligible_platforms: selected?.eligible_platforms || [payload.platform],
        response_template: selected?.response_preview_text || "",
        read_only: Boolean(selected?.read_only),
      }),
      headers: { "Content-Type": "application/json" },
    });
    state.previewResult = await requestJson(ADMIN_TRIGGER_EDITOR_DRY_RUN_ENDPOINT, {
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
    renderEffectiveCommandList();
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
    const editor = await requestJson(ADMIN_TRIGGER_EDITOR_ENDPOINT, { signal });
    state.editor = editor;
    state.registry = {
      summary: {
        counts: {
          trigger_count: Array.isArray(editor.effective_triggers) ? editor.effective_triggers.length : 0,
          game_count: Array.isArray(editor.planned_module_triggers) ? editor.planned_module_triggers.filter((item) => String(item.module || "").toUpperCase() === "GAMES").length : 0,
          asset_count: 0,
        },
        authority: editor.authority,
        source: editor.source,
        served_at: editor.generated_at,
      },
      triggers: Array.isArray(editor.effective_triggers) ? editor.effective_triggers : [],
      games: Array.isArray(editor.planned_module_triggers) ? editor.planned_module_triggers : [],
      capabilities: Array.isArray(editor.available_platforms) ? editor.available_platforms : [],
      assets: [],
      schemas: [],
    };
    state.customItems = Array.isArray(editor.creator_custom_triggers) ? editor.creator_custom_triggers : [];
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
    el.effectiveList = $("triggers-effective-list");
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
        renderEffectiveCommandList();
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
      state.editor = null;
      state.customItems = [];
      state.previewResult = null;
    },
  };
})();

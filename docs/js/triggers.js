(() => {
  "use strict";

  const ADMIN_TRIGGER_EDITOR_ENDPOINT = "/api/admin/livechat/trigger-editor";
  const ADMIN_TRIGGER_EDITOR_DRY_RUN_ENDPOINT = "/api/admin/livechat/trigger-editor/dry-run";
  const ADMIN_TRIGGER_EDITOR_VALIDATE_ENDPOINT = "/api/admin/livechat/trigger-editor/validate";
  const ADMIN_CUSTOM_TRIGGERS_ENDPOINT = "/api/admin/livechat/custom-triggers";

  const CATEGORY_DEFS = [
    { key: "core", title: "Active Built-in / Core Bot Commands", note: "Protected runtime seed commands that are available now." },
    { key: "xp_rank", title: "Active XP / Rank Commands", note: "Progression commands marked active by Runtime/Auth." },
    { key: "system", title: "System / Admin Commands", note: "Admin/system rows are visible for oversight and remain protected." },
    { key: "economy", title: "Planned Economy / Inventory Commands", note: "Roadmap rows only until Runtime/Auth enables the modules." },
    { key: "games", title: "Planned Game Commands", note: "Game registry foundation rows without playable execution." },
    { key: "clips", title: "Planned Clips / FFmpeg Commands", note: "Staged clip rows remain unavailable and must not fake success." },
    { key: "custom", title: "Creator-scoped Custom Triggers", note: "Creator-owned config rows from Runtime/Auth." },
    { key: "other", title: "Other Runtime Rows", note: "Additional runtime-authored editor rows." },
  ];

  const CATEGORY_BY_KEY = Object.fromEntries(CATEGORY_DEFS.map((item) => [item.key, item]));

  const state = {
    editor: null,
    filters: { category: "", status: "", platform: "", creator: "", search: "" },
    customItems: [],
    customError: "",
    customLoading: false,
    editorError: "",
    loadPhase: "booting view",
    diagnostics: [],
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

  function enrichRequestError(error, details = {}) {
    const err = error instanceof Error ? error : new Error(String(error || "Request failed"));
    Object.entries(details).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") err[key] = value;
    });
    return err;
  }

  async function requestJson(path, options = {}) {
    const endpoint = buildApiUrl(path);
    let response = null;
    try {
      response = await fetch(endpoint, {
      cache: "no-store",
      credentials: "include",
      signal: options.signal,
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
      });
    } catch (err) {
      throw enrichRequestError(err, {
        endpoint: path,
        status: "network",
        section: options.section || "runtime/auth",
      });
    }
    let payload = null;
    try {
      payload = await response.json();
    } catch (_err) {
      payload = null;
    }
    if (!response.ok || payload?.success === false) {
      throw enrichRequestError(
        new Error(payload?.error || payload?.message || `Request failed (${response.status})`),
        {
          endpoint: path,
          status: response.status,
          errorCode: payload?.error_code || payload?.code || payload?.error,
          section: options.section || "runtime/auth",
        },
      );
    }
    return payload || {};
  }

  function normalizeEditorPayload(payload) {
    const source =
      payload?.trigger_editor ||
      payload?.editor_contract ||
      payload?.editor ||
      payload?.contract ||
      payload ||
      {};
    const editor = { ...source };
    [
      "built_in_triggers",
      "system_triggers",
      "creator_custom_triggers",
      "planned_module_triggers",
      "effective_triggers",
      "validation_warnings",
    ].forEach((key) => {
      editor[key] = normalizeArray(editor[key]);
    });
    editor.available_platforms = Array.isArray(editor.available_platforms)
      ? editor.available_platforms
      : [];
    return editor;
  }

  function setRuntimePhase(phase, tone = "") {
    state.loadPhase = phase;
    if (!(el.runtimeState instanceof HTMLElement)) return;
    el.runtimeState.classList.toggle("is-error", tone === "error");
    el.runtimeState.classList.toggle("is-partial", tone === "partial");
    el.runtimeState.textContent = phase;
  }

  function clearDiagnostics() {
    state.diagnostics = [];
    renderDiagnostics();
  }

  function recordDiagnostic(section, endpoint, error, fallbackActive = true) {
    state.diagnostics.push({
      section,
      endpoint: endpoint || error?.endpoint || "unknown",
      status: error?.status || "unknown",
      code: error?.errorCode || error?.code || "",
      message: error?.message || "Runtime/Auth request failed.",
      fallbackActive,
    });
    renderDiagnostics();
  }

  function renderDiagnostics() {
    if (!(el.diagnostics instanceof HTMLElement)) return;
    if (!state.diagnostics.length) {
      el.diagnostics.classList.add("hidden");
      el.diagnostics.innerHTML = "";
      return;
    }
    el.diagnostics.classList.remove("hidden");
    el.diagnostics.innerHTML = `
      <h2>Trigger editor Runtime/Auth diagnostics</h2>
      <ul>
        ${state.diagnostics.map((entry) => `
          <li>
            <strong>${escapeHtml(entry.section)}</strong>
            <span>endpoint <code>${escapeHtml(entry.endpoint)}</code></span>
            <span>status ${escapeHtml(entry.status)}</span>
            ${entry.code ? `<span>code ${escapeHtml(entry.code)}</span>` : ""}
            <span>${escapeHtml(entry.message)}</span>
            <span>${entry.fallbackActive ? "partial/fallback render active" : "no fallback active"}</span>
          </li>
        `).join("")}
      </ul>
      <button class="ss-btn ss-btn-secondary ss-btn-small" type="button" data-trigger-retry-runtime>Retry Runtime/Auth Load</button>
    `;
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

  function commandText(item) {
    return item.command_text || `${item.prefix || ""}${item.trigger || ""}` || item.id || item.trigger_id || "-";
  }

  function allGlobalRows() {
    const effective = Array.isArray(state.editor?.effective_triggers) ? state.editor.effective_triggers : [];
    const planned = Array.isArray(state.editor?.planned_module_triggers) ? state.editor.planned_module_triggers : [];
    const seen = new Set();
    return [...effective, ...planned].filter((item) => {
      const key = item.id || item.trigger_id || `${item.module}:${commandText(item)}:${item.status}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function availablePlatforms() {
    return Array.isArray(state.editor?.available_platforms) ? state.editor.available_platforms : [];
  }

  function normalizeStatus(item) {
    if (item.enabled && item.status === "active") return "active";
    if (item.status) return String(item.status).toLowerCase();
    if (item.enabled === false) return "disabled";
    return item.module_status || "staged";
  }

  function categoryForTrigger(item) {
    const text = [
      item.category,
      item.module_family,
      item.module,
      item.type,
      item.source,
      item.id,
      item.trigger_id,
      item.trigger,
      item.command_text,
      item.module_status,
      item.status,
    ].join(" ").toLowerCase();
    if (text.includes("clip") || text.includes("ffmpeg")) return "clips";
    if (text.includes("economy") || text.includes("inventory") || text.includes("wallet") || text.includes("shop")) return "economy";
    if (text.includes("game") || text.includes("wheel")) return "games";
    if (text.includes("xp") || text.includes("rank") || text.includes("progression") || text.includes("level")) return "xp_rank";
    if (text.includes("admin") || text.includes("system")) return "system";
    if (text.includes("custom") || item.creator_id || item.creator_account_id) return "custom";
    if (item.read_only || text.includes("builtin") || text.includes("built-in") || text.includes("core") || item.source === "runtime") return "core";
    return "other";
  }

  function rowSearchText(item) {
    return [
      item.id,
      item.trigger_id,
      item.module,
      item.module_status,
      item.status,
      item.type,
      item.source,
      item.trigger,
      item.command_text,
      item.response_preview_text,
      ...(Array.isArray(item.aliases) ? item.aliases : []),
    ].join(" ").toLowerCase();
  }

  function platformList(item) {
    return Array.isArray(item?.eligible_platforms) ? item.eligible_platforms : [];
  }

  function normalizeArray(value) {
    return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
  }

  function filteredGlobalRows() {
    const categoryValue = state.filters.category;
    const statusValue = state.filters.status.toLowerCase();
    const platformValue = state.filters.platform.toLowerCase();
    const searchValue = state.filters.search.toLowerCase();
    return allGlobalRows().filter((item) => {
      const platforms = platformList(item).map((platform) => String(platform).toLowerCase());
      if (categoryValue && categoryForTrigger(item) !== categoryValue) return false;
      if (statusValue && normalizeStatus(item) !== statusValue) return false;
      if (platformValue && platforms.length && !platforms.includes(platformValue)) return false;
      if (searchValue && !rowSearchText(item).includes(searchValue)) return false;
      return true;
    });
  }

  function statusTone(item) {
    const status = normalizeStatus(item);
    if (status === "active" || status === "enabled") return "is-active";
    if (status === "disabled") return "is-disabled";
    if (status === "unavailable") return "is-unavailable";
    return "is-staged";
  }

  function statusLabel(item) {
    const parts = [normalizeStatus(item)];
    if (item.module_status && item.module_status !== parts[0]) parts.push(item.module_status);
    if (item.read_only) parts.push("read-only");
    if (item.creator_editable) parts.push("creator-editable");
    if (item.admin_only || item.system_only || categoryForTrigger(item) === "system") parts.push("admin/system only");
    return parts.filter(Boolean).join(" / ");
  }

  function renderMiniPill(label, className = "") {
    return `<span class="ss-trigger-pill ${escapeHtml(className)}">${escapeHtml(label)}</span>`;
  }

  function renderTriggerCard(item) {
    const platforms = platformList(item);
    const permission = item.permission || {};
    const validation = item.validation || {};
    const errors = Array.isArray(validation.errors) ? validation.errors : [];
    const warnings = Array.isArray(validation.warnings) ? validation.warnings : [];
    const validationLabel = errors.length
      ? `errors: ${errors.map((err) => err.code || err).join(", ")}`
      : warnings.length
        ? `warnings: ${warnings.map((warn) => warn.code || warn).join(", ")}`
        : "validation clear";
    const aliases = Array.isArray(item.aliases) && item.aliases.length ? item.aliases.join(", ") : "none";
    return `
      <article class="ss-trigger-card ${statusTone(item)}" data-trigger-card="${escapeHtml(item.id || item.trigger_id || commandText(item))}">
        <div class="ss-trigger-card-main">
          <div class="ss-trigger-command-line">
            <strong>${escapeHtml(commandText(item))}</strong>
            ${renderMiniPill(item.source || "runtime", "is-source")}
            ${renderMiniPill(statusLabel(item), statusTone(item))}
          </div>
          <div class="ss-trigger-card-meta">
            <span>ID: ${escapeHtml(item.id || item.trigger_id || "-")}</span>
            <span>Aliases: ${escapeHtml(aliases)}</span>
            <span>Module: ${escapeHtml(item.module || item.module_family || "-")}</span>
          </div>
          <p>${escapeHtml(item.response_preview_text || item.default_response || item.notes || "Runtime-authored trigger definition.")}</p>
        </div>
        <div class="ss-trigger-card-side">
          <div class="ss-trigger-chip-row">
            ${platforms.length ? platforms.map((platform) => renderMiniPill(humanizePlatform(platform))).join("") : renderMiniPill("all platforms")}
          </div>
          <dl>
            <div><dt>Access</dt><dd>${escapeHtml(permission.access || item.access || "everyone")}</dd></div>
            <div><dt>Cooldown</dt><dd>${escapeHtml(item.cooldown_seconds ? `${item.cooldown_seconds}s` : item.cooldown?.label || "-")}</dd></div>
            <div><dt>Validation</dt><dd>${escapeHtml(validationLabel)}</dd></div>
          </dl>
        </div>
      </article>
    `;
  }

  function renderSummary() {
    if (!(el.summary instanceof HTMLElement)) return;
    const globals = allGlobalRows();
    const active = globals.filter((item) => normalizeStatus(item) === "active").length;
    const planned = globals.filter((item) => ["staged", "planned", "unavailable"].includes(normalizeStatus(item)) || item.source === "planned").length;
    const warnings = globals.reduce((count, item) => {
      const validation = item.validation || {};
      return count + (Array.isArray(validation.warnings) ? validation.warnings.length : 0) + (Array.isArray(validation.errors) ? validation.errors.length : 0);
    }, 0);
    const cards = [
      ["Total effective triggers", globals.length],
      ["Active triggers", active],
      ["Custom triggers", state.customItems.length],
      ["Staged / planned", planned],
      ["Validation warnings", warnings],
    ];
    el.summary.innerHTML = cards.map(([label, value]) => `
      <article class="ss-trigger-summary-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </article>
    `).join("");
  }

  function renderFilters() {
    const statuses = Array.from(new Set(allGlobalRows().map(normalizeStatus).filter(Boolean))).sort();
    const platforms = Array.from(new Set(availablePlatforms().map((item) => {
      if (typeof item === "string") return item;
      return item?.platform || item?.key || item?.id || "";
    }).filter(Boolean))).sort();
    if (el.categoryFilter instanceof HTMLSelectElement) {
      const current = el.categoryFilter.value;
      el.categoryFilter.innerHTML = `<option value="">All categories</option>${CATEGORY_DEFS.map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.title)}</option>`).join("")}`;
      el.categoryFilter.value = current;
    }
    if (el.statusFilter instanceof HTMLSelectElement) {
      const current = el.statusFilter.value;
      el.statusFilter.innerHTML = `<option value="">All statuses</option>${statuses.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
      el.statusFilter.value = current;
    }
    if (el.platformFilter instanceof HTMLSelectElement) {
      const current = el.platformFilter.value;
      el.platformFilter.innerHTML = `<option value="">All platforms</option>${platforms.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(humanizePlatform(item))}</option>`).join("")}`;
      el.platformFilter.value = current;
    }
  }

  function renderLibraryGroups() {
    if (!(el.libraryGroups instanceof HTMLElement)) return;
    const rows = filteredGlobalRows();
    el.empty?.classList.toggle("hidden", rows.length > 0);
    const byCategory = new Map();
    rows.forEach((item) => {
      const category = categoryForTrigger(item);
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category).push(item);
    });
    el.libraryGroups.innerHTML = CATEGORY_DEFS
      .filter((category) => byCategory.has(category.key))
      .map((category) => {
        const items = byCategory.get(category.key) || [];
        const active = items.filter((item) => normalizeStatus(item) === "active").length;
        return `
          <section class="ss-trigger-family" data-trigger-category="${escapeHtml(category.key)}">
            <header>
              <div>
                <h3>${escapeHtml(category.title)}</h3>
                <p>${escapeHtml(category.note)}</p>
              </div>
              <span>${escapeHtml(active)} active / ${escapeHtml(items.length)} total</span>
            </header>
            <div class="ss-trigger-card-list">
              ${items.map(renderTriggerCard).join("")}
            </div>
          </section>
        `;
      }).join("");
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
      item.response_template,
      ...(Array.isArray(item.aliases) ? item.aliases : []),
    ].join(" ").toLowerCase();
  }

  function filteredCustomTriggers() {
    const creatorValue = state.customFilters.creator.toLowerCase() || state.filters.creator.toLowerCase();
    const statusValue = state.customFilters.status.toLowerCase();
    const platformValue = state.customFilters.platform.toLowerCase();
    const searchValue = state.customFilters.search.toLowerCase();
    return state.customItems.filter((item) => {
      const haystack = customRowSearchText(item);
      const platforms = platformList(item).map((platform) => String(platform).toLowerCase());
      if (creatorValue && !haystack.includes(creatorValue)) return false;
      if (statusValue && String(item?.status || "").toLowerCase() !== statusValue && String(Boolean(item?.enabled)).toLowerCase() !== statusValue) return false;
      if (platformValue && platforms.length && !platforms.includes(platformValue)) return false;
      if (searchValue && !haystack.includes(searchValue)) return false;
      return true;
    });
  }

  function renderCustomRows() {
    if (!(el.customList instanceof HTMLElement)) return;
    const items = filteredCustomTriggers();
    if (el.customState instanceof HTMLElement) {
      const creator = state.editor?.creator?.account_id || state.editor?.creator?.user_code || state.filters.creator || "selected creator";
      if (state.customLoading) {
        el.customState.textContent = "Loading creator custom trigger configs from Runtime/Auth...";
        el.customState.classList.remove("is-error");
      } else if (state.customError) {
        el.customState.innerHTML = `
          <span>Runtime/Auth custom trigger configs are unavailable: ${escapeHtml(state.customError)}</span>
          <button class="ss-btn ss-btn-secondary ss-btn-small" type="button" data-custom-trigger-retry>Retry</button>
        `;
        el.customState.classList.add("is-error");
      } else {
        el.customState.textContent = state.customItems.length
          ? `Runtime/Auth returned ${state.customItems.length} creator-scoped custom trigger config rows for ${creator}.`
          : `Runtime/Auth returned no creator-scoped custom trigger config rows for ${creator}.`;
        el.customState.classList.remove("is-error");
      }
    }
    el.customEmpty?.classList.toggle("hidden", state.customLoading || Boolean(state.customError) || items.length > 0);
    el.customList.innerHTML = items.map((item) => {
      const creatorId = item.creator_id || item.creator_account_id || "";
      const id = item.id || item.custom_trigger_id || "";
      const canMutate = Boolean(creatorId && id);
      return `
        <article class="ss-trigger-custom-card ${item.enabled ? "is-active" : "is-disabled"}">
          <div>
            <div class="ss-trigger-command-line">
              <strong>${escapeHtml(commandText(item))}</strong>
              ${renderMiniPill(item.enabled ? "creator-editable enabled" : "creator-editable disabled", item.enabled ? "is-active" : "is-disabled")}
              ${renderMiniPill(item.status || "custom config", "is-source")}
            </div>
            <div class="ss-trigger-card-meta">
              <span>ID: ${escapeHtml(id || "-")}</span>
              <span>Creator: ${escapeHtml(creatorId || "-")}</span>
              <span>Updated: ${escapeHtml(formatTimestamp(item.updated_at))}</span>
            </div>
            <p>${escapeHtml(item.response_template || item.response_preview_text || "Creator-owned runtime config.")}</p>
            <div class="ss-trigger-chip-row">${platformList(item).map((platform) => renderMiniPill(humanizePlatform(platform))).join("")}</div>
          </div>
          <div class="ss-trigger-card-actions">
            ${canMutate ? `
              <button class="ss-btn ss-btn-secondary ss-btn-small" type="button" data-custom-trigger-toggle="${escapeHtml(id)}" data-creator-id="${escapeHtml(creatorId)}" data-next-enabled="${item.enabled ? "false" : "true"}">${escapeHtml(item.enabled ? "Disable" : "Enable")}</button>
              <button class="ss-btn ss-btn-danger ss-btn-small" type="button" data-custom-trigger-delete="${escapeHtml(id)}" data-creator-id="${escapeHtml(creatorId)}">Delete</button>
            ` : `<span class="muted">No account-scoped mutation path in payload</span>`}
          </div>
        </article>
      `;
    }).join("");
    renderPreviewTriggerOptions();
  }

  function renderEffectiveCommandList() {
    if (!(el.effectiveList instanceof HTMLElement)) return;
    const platform = state.filters.platform || el.previewPlatform?.value || "kick";
    const creator = state.filters.creator || state.editor?.creator?.account_id || state.editor?.creator?.user_code || "selected creator";
    const rows = allGlobalRows().filter((item) => {
      const platforms = platformList(item).map((value) => String(value).toLowerCase());
      if (!platform) return true;
      return platforms.includes(platform) || !platforms.length;
    });
    const activeRows = rows.filter((item) => normalizeStatus(item) === "active" && item.enabled !== false);
    el.effectiveList.innerHTML = `
      <div class="ss-trigger-effective-heading">
        <strong>${escapeHtml(humanizePlatform(platform))}</strong>
        <span>${escapeHtml(creator)}</span>
      </div>
      <div class="ss-trigger-effective-count">${escapeHtml(activeRows.length)} active commands from ${escapeHtml(rows.length)} visible rows</div>
      <div class="ss-trigger-effective-scroll">
        ${rows.slice(0, 80).map((item) => `
          <div class="ss-trigger-effective-row ${statusTone(item)}">
            <div class="ss-trigger-effective-main">
              <strong>${escapeHtml(commandText(item))}</strong>
              <small>${escapeHtml(item.module || item.module_family || item.source || "runtime")}</small>
            </div>
            <span>${escapeHtml(statusLabel(item))}</span>
          </div>
        `).join("") || `<p class="muted">No effective commands were returned for this creator/platform.</p>`}
      </div>
    `;
  }

  function renderValidationOutput() {
    if (!(el.validationOutput instanceof HTMLElement)) return;
    const rows = allGlobalRows().map((item) => {
      const validation = item.validation || {};
      const errors = Array.isArray(validation.errors) ? validation.errors : [];
      const warnings = Array.isArray(validation.warnings) ? validation.warnings : [];
      return { item, errors, warnings };
    }).filter((entry) => entry.errors.length || entry.warnings.length || normalizeStatus(entry.item) !== "active");
    el.validationOutput.innerHTML = rows.length
      ? rows.slice(0, 20).map((entry) => {
        const issue = entry.errors.length
          ? entry.errors.map((err) => err.message || err.code || err).join(", ")
          : entry.warnings.length
            ? entry.warnings.map((warn) => warn.message || warn.code || warn).join(", ")
            : statusLabel(entry.item);
        return `
          <div class="ss-trigger-warning-row ${entry.errors.length ? "is-error" : "is-warning"}">
            <strong>${escapeHtml(commandText(entry.item))}</strong>
            <span>${escapeHtml(issue)}</span>
          </div>
        `;
      }).join("")
      : `<div class="ss-trigger-warning-row is-clear"><strong>Clear</strong><span>No validation warnings returned by Runtime/Auth.</span></div>`;
  }

  function renderGameRows() {
    if (!(el.games instanceof HTMLElement)) return;
    const rows = allGlobalRows().filter((item) => ["xp_rank", "clips", "economy", "games"].includes(categoryForTrigger(item)));
    const fallback = CATEGORY_DEFS.filter((item) => ["xp_rank", "clips", "economy", "games"].includes(item.key));
    el.games.innerHTML = (rows.length ? rows : fallback).slice(0, 40).map((item) => {
      const isCategory = !("id" in item) && item.key;
      const category = isCategory ? item : CATEGORY_BY_KEY[categoryForTrigger(item)] || CATEGORY_BY_KEY.other;
      const status = isCategory ? "staged" : statusLabel(item);
      const command = isCategory ? category.title : commandText(item);
      return `
        <article class="ss-trigger-roadmap-card ${isCategory ? "is-staged" : statusTone(item)}">
          <span>${escapeHtml(category.title)}</span>
          <strong>${escapeHtml(command)}</strong>
          <p>${escapeHtml(isCategory ? category.note : status)}</p>
        </article>
      `;
    }).join("");
  }

  function renderPreviewTriggerOptions() {
    if (!(el.previewTrigger instanceof HTMLSelectElement)) return;
    const selected = el.previewTrigger.value;
    const rows = [...allGlobalRows(), ...state.customItems];
    el.previewTrigger.innerHTML = `<option value="">Match simulated message</option>${rows.map((item) => {
      const id = item.id || item.custom_trigger_id || item.trigger_id || "";
      const command = commandText(item);
      return `<option value="${escapeHtml(id)}" data-command="${escapeHtml(command)}" data-creator-id="${escapeHtml(item.creator_id || item.creator_account_id || state.editor?.creator?.account_id || "")}">${escapeHtml(command)} - ${escapeHtml(statusLabel(item))}</option>`;
    }).join("")}`;
    if (selected && rows.some((item) => String(item.id || item.custom_trigger_id || item.trigger_id || "") === selected)) {
      el.previewTrigger.value = selected;
    }
  }

  function selectedPreviewTrigger() {
    const id = el.previewTrigger?.value || "";
    const rows = [...allGlobalRows(), ...state.customItems];
    return rows.find((item) => String(item.id || item.custom_trigger_id || item.trigger_id || "") === id) || null;
  }

  function renderPreviewResult(payload) {
    if (!(el.previewResult instanceof HTMLElement)) return;
    if (!payload) {
      el.previewResult.textContent = "No preview run yet. Try !bot, !xp, or !clip to inspect match and module-status output.";
      return;
    }
    const pages = Array.isArray(payload.pages) ? payload.pages : [];
    const warnings = Array.isArray(payload.validation_warnings) ? payload.validation_warnings : [];
    const matched = payload.matched_trigger || {};
    const diagnostics = payload.diagnostics || {};
    const wouldDispatch = Boolean(payload.action_summary?.would_dispatch || payload.would_post);
    el.previewResult.innerHTML = `
      <div class="ss-trigger-preview-top">
        ${renderMiniPill(payload.dry_run ? "dry-run" : "not dry-run", "is-source")}
        ${renderMiniPill(payload.posted ? "posted" : "no-send", payload.posted ? "is-unavailable" : "is-staged")}
        ${renderMiniPill(wouldDispatch ? "would dispatch" : "blocked / no match", wouldDispatch ? "is-active" : "is-unavailable")}
      </div>
      <dl class="ss-trigger-preview-dl">
        <div><dt>Matched trigger</dt><dd>${escapeHtml(matched.command_text || payload.trigger_id || "none")}</dd></div>
        <div><dt>Outcome</dt><dd>${escapeHtml(payload.no_match_reason || payload.blocked_reason || diagnostics.final_outcome || "not blocked")}</dd></div>
        <div><dt>Permissions</dt><dd>${escapeHtml(JSON.stringify(payload.permission || {}))}</dd></div>
        <div><dt>Cooldown</dt><dd>${escapeHtml(JSON.stringify(payload.cooldown || {}))}</dd></div>
        <div><dt>Warnings</dt><dd>${escapeHtml(warnings.join(", ") || "none")}</dd></div>
        <div><dt>Generated reply</dt><dd>${escapeHtml(payload.generated_reply || payload.rendered_text || "")}</dd></div>
      </dl>
      <div class="ss-trigger-preview-pages">
        ${pages.length ? pages.map((page) => `<p>${escapeHtml(page.page_index)}/${escapeHtml(page.total_pages)} ${escapeHtml(page.text)}</p>`).join("") : `<p>No split pages returned.</p>`}
      </div>
    `;
  }

  async function runPreview() {
    const selected = selectedPreviewTrigger();
    const creatorId = selected?.creator_id || selected?.creator_account_id || state.editor?.creator?.account_id || "";
    const selectedCommand = selected ? commandText(selected) : "";
    const payload = {
      creator_id: creatorId || state.customItems[0]?.creator_id || state.customItems[0]?.creator_account_id || "",
      trigger_id: selected?.id || selected?.trigger_id || undefined,
      platform: el.previewPlatform?.value || "kick",
      message: el.previewMessage?.value || selectedCommand || "",
      sender_role: el.previewRole?.value || "viewer",
      actor: {
        display_name: el.previewDisplay?.value || "Preview Viewer",
        handle: el.previewHandle?.value || "previewviewer",
      },
      stream_context: {
        stream_title: el.previewStreamTitle?.value || "",
      },
    };
    await requestJson(ADMIN_TRIGGER_EDITOR_VALIDATE_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({
        creator_id: payload.creator_id,
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
    renderLibraryGroups();
    renderEffectiveCommandList();
    renderValidationOutput();
    renderGameRows();
    renderPreviewTriggerOptions();
    if (el.runtimeState instanceof HTMLElement) {
      if (!state.editor) {
        setRuntimePhase(state.loadPhase || "booting view", "");
      } else if (state.editorError) {
        setRuntimePhase("partial failure: editor contract failed; rendered empty safe sections", "error");
      } else if (state.customError) {
        const served = formatTimestamp(state.editor?.generated_at);
        setRuntimePhase(`partial failure: editor contract ready from ${state.editor?.authority || "StreamSuites"} ${state.editor?.source || "runtime"} at ${served}; creator scoped triggers failed`, "partial");
      } else {
        const served = formatTimestamp(state.editor?.generated_at);
        setRuntimePhase(`ready: hydrated from ${state.editor?.authority || "StreamSuites"} ${state.editor?.source || "runtime"} at ${served}`, "");
      }
    }
  }

  async function loadEditor() {
    setBanner("");
    setRuntimePhase("loading editor contract");
    const signal = state.abortController?.signal;
    try {
      const editor = await requestJson(ADMIN_TRIGGER_EDITOR_ENDPOINT, { signal, section: "editor contract" });
      state.editor = normalizeEditorPayload(editor);
      state.editorError = "";
    } catch (err) {
      state.editor = normalizeEditorPayload({});
      state.editorError = err?.message || "Unable to load Runtime/Auth trigger editor contract.";
      recordDiagnostic("editor contract", ADMIN_TRIGGER_EDITOR_ENDPOINT, err, true);
    } finally {
      renderAll();
    }
  }

  async function loadCustomTriggers() {
    state.customLoading = true;
    state.customError = "";
    setRuntimePhase("loading creator scoped triggers");
    renderCustomRows();
    const query = new URLSearchParams();
    const creator = state.customFilters.creator || state.filters.creator;
    if (creator) query.set("creator", creator);
    if (state.customFilters.status) query.set("status", state.customFilters.status);
    if (state.customFilters.platform) query.set("platform", state.customFilters.platform);
    if (state.customFilters.search) query.set("search", state.customFilters.search);
    const path = query.toString() ? `${ADMIN_CUSTOM_TRIGGERS_ENDPOINT}?${query.toString()}` : ADMIN_CUSTOM_TRIGGERS_ENDPOINT;
    try {
      const payload = await requestJson(path, { signal: state.abortController?.signal, section: "creator scoped triggers" });
      state.customItems = normalizeArray(payload.items || payload.creator_custom_triggers);
      state.customError = "";
    } catch (err) {
      state.customError = err?.message || "Unable to load creator-scoped custom trigger configs.";
      recordDiagnostic("creator scoped triggers", path, err, true);
    } finally {
      state.customLoading = false;
      renderSummary();
      renderCustomRows();
      renderPreviewTriggerOptions();
      renderAll();
    }
  }

  async function refreshAll() {
    clearDiagnostics();
    setRuntimePhase("booting view");
    await loadEditor();
    setRuntimePhase("loading effective command set");
    await loadCustomTriggers();
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

  function cacheElements() {
    el.banner = $("triggers-banner");
    el.diagnostics = $("triggers-diagnostics");
    el.runtimeState = $("triggers-runtime-state");
    el.summary = $("triggers-registry-summary");
    el.effectiveList = $("triggers-effective-list");
    el.categoryFilter = $("triggers-category-filter");
    el.statusFilter = $("triggers-status-filter");
    el.platformFilter = $("triggers-platform-filter");
    el.creatorFilter = $("triggers-creator-filter");
    el.search = $("triggers-search");
    el.libraryGroups = $("triggers-library-groups");
    el.empty = $("triggers-empty");
    el.games = $("triggers-games-list");
    el.validationOutput = $("triggers-validation-output");
    el.customState = $("triggers-custom-state");
    el.customCreatorFilter = $("triggers-custom-creator-filter");
    el.customStatusFilter = $("triggers-custom-status-filter");
    el.customPlatformFilter = $("triggers-custom-platform-filter");
    el.customSearch = $("triggers-custom-search");
    el.customList = $("triggers-custom-list");
    el.customEmpty = $("triggers-custom-empty");
    el.previewForm = $("triggers-preview-form");
    el.previewTrigger = $("triggers-preview-trigger");
    el.previewPlatform = $("triggers-preview-platform");
    el.previewMessage = $("triggers-preview-message");
    el.previewRole = $("triggers-preview-role");
    el.previewDisplay = $("triggers-preview-display");
    el.previewHandle = $("triggers-preview-handle");
    el.previewStreamTitle = $("triggers-preview-stream-title");
    el.previewResult = $("triggers-preview-result");
  }

  async function init() {
    if (state.abortController) state.abortController.abort();
    state.abortController = new AbortController();
    const signal = state.abortController.signal;
    cacheElements();
    $("btn-refresh-triggers")?.addEventListener("click", () => void refreshAll().catch((err) => setBanner(err?.message || "Unable to refresh registry.", "danger")), { signal });
    el.diagnostics?.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("[data-trigger-retry-runtime]")) return;
      void refreshAll().catch((err) => setBanner(err?.message || "Unable to refresh registry.", "danger"));
    }, { signal });
    [el.categoryFilter, el.statusFilter, el.platformFilter, el.creatorFilter, el.search].forEach((control) => {
      control?.addEventListener("input", () => {
        state.filters.category = el.categoryFilter?.value || "";
        state.filters.status = el.statusFilter?.value || "";
        state.filters.platform = el.platformFilter?.value || "";
        state.filters.creator = el.creatorFilter?.value || "";
        state.filters.search = el.search?.value || "";
        renderLibraryGroups();
        renderCustomRows();
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
    el.customList?.addEventListener("click", (event) => {
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
      if (target.closest("[data-custom-trigger-retry]")) {
        void loadCustomTriggers();
      }
    }, { signal });
    el.previewTrigger?.addEventListener("change", () => {
      const selected = selectedPreviewTrigger();
      if (selected && el.previewMessage instanceof HTMLInputElement) el.previewMessage.value = commandText(selected);
    }, { signal });
    el.previewPlatform?.addEventListener("change", () => {
      state.filters.platform = el.platformFilter?.value || "";
      renderEffectiveCommandList();
    }, { signal });
    el.previewForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      void runPreview().catch((err) => setBanner(err?.message || "Unable to run custom trigger preview.", "danger"));
    }, { signal });
    renderPreviewResult(null);
    setRuntimePhase("booting view");
    renderAll();
    try {
      await refreshAll();
    } catch (err) {
      setBanner(err?.message || "Unable to load runtime trigger editor.", "danger");
      setRuntimePhase("partial failure: trigger editor hydration failed", "error");
    }
  }

  window.TriggersView = {
    init,
    destroy() {
      if (state.abortController) {
        state.abortController.abort();
        state.abortController = null;
      }
      state.editor = null;
      state.customItems = [];
      state.previewResult = null;
    },
  };
})();

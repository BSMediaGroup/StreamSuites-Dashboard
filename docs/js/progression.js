/* ============================================================
   StreamSuites Dashboard - XP / Level admin controls
   ============================================================ */

(() => {
  "use strict";

  const CONFIG_RANKS = "/api/admin/progression/ranks";
  const CONFIG_RULES = "/api/admin/progression/xp-rules";
  const CONFIG_RULES_VALIDATE = "/api/admin/progression/xp-rules/validate";
  const CONFIG_RULES_RESET = "/api/admin/progression/xp-rules/reset-defaults";
  const IDENTITIES = "/api/admin/progression/identities";
  const IDENTITY_DETAIL = (identityCode) => `/api/admin/progression/identities/${encodeURIComponent(identityCode)}`;
  const PUBLIC_IDENTITY_UNASSIGN = "/api/admin/public-identities/reconciliation/unassign";
  const IDENTITY_EVENTS = (identityCode) => `/api/admin/progression/identities/${encodeURIComponent(identityCode)}/events`;
  const EVENT_REVERSE = (eventCode) => `/api/admin/progression/events/${encodeURIComponent(eventCode)}/reverse`;
  const LEADERBOARD = (identityCode) => `/api/admin/progression/identities/${encodeURIComponent(identityCode)}/leaderboard`;
  const XP_ICON_PATH = "/assets/games/xpstar.webp";
  const LEVEL_PAGE_SIZE = 6;
  const RULE_PAGE_SIZE = 5;
  const IDENTITY_PAGE_SIZE = 10;
  const EVENT_PAGE_SIZE = 8;

  const state = {
    ranks: [],
    originalRanks: [],
    rules: [],
    originalRules: [],
    identities: [],
    selectedIdentityCode: "",
    detail: null,
    levelPage: 1,
    rulePage: 1,
    identityPage: 1,
    eventPage: 1,
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

  function clone(value) {
    return JSON.parse(JSON.stringify(value || []));
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
      window.StreamSuitesToast?.[notify]?.(message, { key: "progression-admin", title: "Progression" });
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
          <button class="ss-btn ss-btn-secondary" type="button" data-progress-page="${escapeHtml(kind)}" data-page="${pageInfo.page - 1}" ${pageInfo.page <= 1 ? "disabled" : ""}>Previous</button>
          <button class="ss-btn ss-btn-secondary" type="button" data-progress-page="${escapeHtml(kind)}" data-page="${pageInfo.page + 1}" ${pageInfo.page >= pageInfo.totalPages ? "disabled" : ""}>Next</button>
        </div>
      </div>
    `;
  }

  function identityUserCode(identity = {}, summary = {}) {
    identity = identity || {};
    summary = summary || {};
    return text(
      identity.user_code ||
        identity.canonical_user_code ||
        identity.account_user_code ||
        summary.user_code ||
        summary.account_user_code ||
        identity.identity_code ||
        summary.identity_code
    );
  }

  function identityFallbackCode(identity = {}, summary = {}) {
    identity = identity || {};
    summary = summary || {};
    return text(identity.public_identity_code || identity.fallback_public_identity_code || identity.identity_code || summary.public_identity_code || summary.identity_code);
  }

  function publicIdentityChipItems(identity = {}, summary = {}) {
    identity = identity || {};
    summary = summary || {};
    const sourceCodes = Array.isArray(summary.source_identity_codes) ? summary.source_identity_codes : [];
    const primaryCode = text(identity.identity_code || summary.identity_code || summary.public_identity_code);
    const codes = Array.from(new Set([primaryCode, ...sourceCodes.map((code) => text(code))].filter(Boolean)));
    return codes.map((code) => ({
      identity_code: code,
      primary: code === primaryCode,
      removable_by_admin: code !== primaryCode,
      account_id: text(identity.account_id || summary.account_id),
      account_user_code: text(identity.account_user_code || summary.account_user_code || identity.user_code || summary.user_code),
      assignment_source: code === primaryCode ? "primary" : "assigned secondary",
    }));
  }

  function renderPublicIdentityChips(identities = [], accountLabel = "") {
    if (!identities.length) return `<span class="muted">No public IDs returned.</span>`;
    return `<span class="ss-public-identity-chip-row">${identities.map((identity) => {
      const code = text(identity.identity_code || identity.public_identity_code);
      const primary = identity.primary === true || identity.is_primary === true;
      const title = [
        primary ? "Primary public identity" : "Assigned secondary public identity",
        accountLabel ? `Account: ${accountLabel}` : "",
        identity.assignment_source ? `Source: ${identity.assignment_source}` : "",
        identity.assigned_at ? `Assigned: ${identity.assigned_at}` : "",
      ].filter(Boolean).join(" · ");
      if (primary) {
        return `<span class="ss-public-identity-chip is-primary" title="${escapeHtml(title)}"><span class="chip-icon" style="background-color:#FEF3C7;-webkit-mask-image:url('/assets/icons/ui/padlockclosed.svg');mask-image:url('/assets/icons/ui/padlockclosed.svg');"></span>${escapeHtml(code)}<span class="chip-icon" style="background-color:#FEF3C7;-webkit-mask-image:url('/assets/icons/ui/star.svg');mask-image:url('/assets/icons/ui/star.svg');"></span></span>`;
      }
      return `<button class="ss-public-identity-chip is-secondary" type="button" title="${escapeHtml(`${title} · Click to unassign`)}" data-public-identity-unassign-chip="${escapeHtml(code)}" data-public-identity-account-id="${escapeHtml(identity.account_id || "")}" data-public-identity-account-label="${escapeHtml(accountLabel)}">${escapeHtml(code)}<span class="chip-icon unassign-icon" style="background-color:#DFF7FF;-webkit-mask-image:url('/assets/icons/ui/backspace.svg');mask-image:url('/assets/icons/ui/backspace.svg');"></span></button>`;
    }).join("")}</span>`;
  }

  async function unassignPublicIdentityChip(button) {
    const identityCode = text(button?.dataset?.publicIdentityUnassignChip);
    const accountId = text(button?.dataset?.publicIdentityAccountId);
    const accountLabel = text(button?.dataset?.publicIdentityAccountLabel || accountId);
    if (!identityCode) return;
    const reason = text(window.prompt?.(`Unassign ${identityCode} from ${accountLabel || "this account"}?\n\nHistorical ledger rows are not deleted.\n\nRequired reason/note:`) || "");
    if (!reason) {
      setStatus("Public identity unassign requires a reason/note.", "error");
      return;
    }
    setStatus(`Unassigning ${identityCode} through Runtime/Auth...`);
    await requestJson(PUBLIC_IDENTITY_UNASSIGN, {
      method: "POST",
      body: JSON.stringify({ identity_code: identityCode, account_id: accountId, reason }),
    });
    setStatus(`Unassigned ${identityCode}.`, "success");
    await refresh();
  }

  function identityAvatar(identity = {}, summary = {}) {
    return text(identity.avatar_url || summary.avatar_url);
  }

  function normalizeAssetPath(path) {
    const clean = text(path).replace(/\\/g, "/");
    if (!clean) return "";
    if (/^https?:\/\//i.test(clean) || clean.startsWith("/")) return clean;
    return `/${clean.replace(/^\/+/, "")}`;
  }

  function normalizeLevelColor(value) {
    const color = text(value);
    return /^#[0-9a-f]{6}$/i.test(color) ? color : "#8F4700";
  }

  function levelPresentation(summary = {}) {
    const rank = summary?.rank && typeof summary.rank === "object" ? summary.rank : summary || {};
    return {
      code: text(summary.current_level_code || summary.level_code || rank.level_code || summary.current_rank_code || rank.rank_code || "LEVEL0"),
      label: text(summary.current_level_label || summary.level_label || rank.level_label || summary.rank_label || rank.rank_label || rank.label || "Stone"),
      color: normalizeLevelColor(summary.level_color_hex || rank.level_color_hex || rank.color_hex || summary.color_hex || "#38382E"),
      icon: normalizeAssetPath(summary.level_icon_path || rank.level_icon_path || rank.icon_path || summary.icon_path || "assets/games/00-stone.webp"),
      visibility: text(summary.level_visibility || rank.level_visibility || "public"),
      isSecret: Boolean(summary.level_is_secret || rank.level_is_secret)
    };
  }

  function renderLevelChip(summary = {}, options = {}) {
    const level = levelPresentation(summary);
    return `
      <span class="ss-progression-level-chip ss-progression-rank-chip${options.compact ? " ss-progression-level-chip--compact ss-progression-rank-chip--compact" : ""}${level.isSecret ? " is-secret-level" : ""}" style="--ss-level-color:${escapeHtml(level.color)};--ss-rank-color:${escapeHtml(level.color)}" title="${escapeHtml(`${level.label} (${level.code})`)}">
        <img class="ss-progression-level-icon ss-progression-rank-icon" src="${escapeHtml(level.icon)}" alt="" loading="lazy" decoding="async" />
        <span>${escapeHtml(level.label)}</span>
      </span>
    `;
  }

  const renderRankChip = renderLevelChip;

  function renderXpValue(value, options = {}) {
    return `
      <span class="ss-progression-xp-value${options.compact ? " ss-progression-xp-value--compact" : ""}">
        <img class="ss-progression-xp-icon" src="${XP_ICON_PATH}" alt="" loading="lazy" decoding="async" />
        <span>${formatNumber(value)} XP</span>
      </span>
    `;
  }

  function renderIdentityAvatar(identity = {}, summary = {}) {
    const avatarUrl = identityAvatar(identity, summary);
    const displayName = text(identity.display_name || summary.display_name || identityUserCode(identity, summary) || "Identity");
    if (avatarUrl) {
      return `<span class="ss-progression-avatar has-image"><img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)} avatar" loading="lazy" decoding="async" /></span>`;
    }
    return `<span class="ss-progression-avatar" aria-hidden="true">${escapeHtml((displayName || "?").slice(0, 1).toUpperCase())}</span>`;
  }

  function rankDirty() {
    return JSON.stringify(state.ranks) !== JSON.stringify(state.originalRanks);
  }

  function rulesDirty() {
    return JSON.stringify(state.rules) !== JSON.stringify(state.originalRules);
  }

  function validateRules() {
    const seen = new Set();
    for (const rule of state.rules) {
      const action = text(rule.action_key || rule.rule_code);
      if (!action) return "Every XP rule needs an action key.";
      if (seen.has(action)) return "XP rule action keys must be unique.";
      seen.add(action);
      const amount = Number(rule.xp_delta ?? 0);
      const cooldown = rule.cooldown_seconds === null || rule.cooldown_seconds === "" ? 0 : Number(rule.cooldown_seconds);
      const dailyCap = rule.daily_cap === null || rule.daily_cap === "" ? 0 : Number(rule.daily_cap);
      if (!Number.isInteger(amount) || amount < 0) return "XP amounts must be non-negative whole numbers.";
      if (!Number.isInteger(cooldown) || cooldown < 0) return "Cooldown seconds must be non-negative whole numbers.";
      if (!Number.isInteger(dailyCap) || dailyCap < 0) return "Caps must be non-negative whole numbers.";
    }
    return "";
  }

  function validateRanks() {
    let previous = -1;
    for (const rank of state.ranks) {
      const threshold = Number(rank.level_xp_min ?? rank.threshold_xp);
      const color = text(rank.level_color_hex || rank.color_hex);
      if (!(rank.level_label || rank.label) || !Number.isInteger(threshold) || threshold < 0) {
        return "Every level needs a label and non-negative integer threshold.";
      }
      if (!/^#[0-9a-f]{6}$/i.test(color)) {
        return "Every level color must be a valid #RRGGBB hex value.";
      }
      if ((rank.level_code || rank.rank_code) === "LEVEL0" && threshold !== 0) {
        return "LEVEL0 threshold must stay 0.";
      }
      if (threshold <= previous) {
        return "Level thresholds must stay strictly increasing.";
      }
      previous = threshold;
    }
    return "";
  }

  function updateSaveState() {
    const rankError = validateRanks();
    if (el.ranksStatus) {
      el.ranksStatus.textContent = rankError || (rankDirty() ? "Unsaved level changes" : "No pending changes");
    }
    if (el.ranksSave) {
      el.ranksSave.disabled = Boolean(rankError) || !rankDirty() || state.saving;
    }
    if (el.rulesStatus) {
      const ruleError = validateRules();
      el.rulesStatus.textContent = ruleError || (rulesDirty() ? "Unsaved rule changes" : "No pending changes");
    }
    if (el.rulesSave) {
      el.rulesSave.disabled = Boolean(validateRules()) || !rulesDirty() || state.saving;
    }
  }

  function renderRanks() {
    if (!el.ranksList) return;
    const pageInfo = pageSlice(state.ranks, state.levelPage, LEVEL_PAGE_SIZE);
    state.levelPage = pageInfo.page;
    el.ranksList.innerHTML = pageInfo.items
      .map(
        (rank, pageIndex) => {
          const index = (pageInfo.page - 1) * LEVEL_PAGE_SIZE + pageIndex;
          return `
          <article class="ss-progression-row">
            <div>
              <strong>${escapeHtml(rank.level_code || rank.rank_code)}</strong>
              ${renderLevelChip(rank, { compact: true })}
              <span class="muted">${escapeHtml(rank.level_visibility || "public")} · ${escapeHtml(rank.level_color_hex || rank.color_hex || "No color configured")} · ${escapeHtml(rank.level_icon_path || rank.icon_path || "No icon configured")}</span>
            </div>
            <div class="ss-form-row">
              <label for="progression-rank-label-${index}">Label</label>
              <input id="progression-rank-label-${index}" data-rank-index="${index}" data-rank-field="level_label" value="${escapeHtml(rank.level_label || rank.label)}" />
            </div>
            <div class="ss-form-row">
              <label for="progression-rank-threshold-${index}">Threshold XP</label>
              <input id="progression-rank-threshold-${index}" data-rank-index="${index}" data-rank-field="level_xp_min" type="number" min="0" step="1" value="${escapeHtml(rank.level_xp_min ?? rank.threshold_xp)}" ${(rank.level_code || rank.rank_code) === "LEVEL0" ? "readonly" : ""} />
            </div>
            <div class="ss-form-row">
              <label for="progression-rank-visibility-${index}">Visibility</label>
              <select id="progression-rank-visibility-${index}" data-rank-index="${index}" data-rank-field="level_visibility">
                <option value="public" ${(rank.level_visibility || "public") === "public" ? "selected" : ""}>Public</option>
                <option value="secret" ${(rank.level_visibility || "") === "secret" ? "selected" : ""}>Secret</option>
              </select>
            </div>
            <div class="ss-form-row">
              <label for="progression-rank-color-picker-${index}">Color</label>
              <input id="progression-rank-color-picker-${index}" data-rank-index="${index}" data-rank-field="level_color_hex" data-rank-color-kind="picker" type="color" value="${escapeHtml(normalizeLevelColor(rank.level_color_hex || rank.color_hex))}" />
            </div>
            <div class="ss-form-row">
              <label for="progression-rank-color-text-${index}">Hex color</label>
              <input id="progression-rank-color-text-${index}" data-rank-index="${index}" data-rank-field="level_color_hex" data-rank-color-kind="text" value="${escapeHtml(normalizeLevelColor(rank.level_color_hex || rank.color_hex))}" />
            </div>
            <div class="ss-form-row ss-progression-wide">
              <label for="progression-rank-icon-${index}">Icon asset path</label>
              <input id="progression-rank-icon-${index}" data-rank-index="${index}" data-rank-field="level_icon_path" value="${escapeHtml(rank.level_icon_path || rank.icon_path || "")}" />
            </div>
          </article>
        `;
        }
      )
      .join("") + renderPager("levels", pageInfo, "Level page");
    updateSaveState();
  }

  function renderRules() {
    if (!el.rulesList) return;
    const pageInfo = pageSlice(state.rules, state.rulePage, RULE_PAGE_SIZE);
    state.rulePage = pageInfo.page;
    el.rulesList.innerHTML = pageInfo.items
      .map(
        (rule, pageIndex) => {
          const index = (pageInfo.page - 1) * RULE_PAGE_SIZE + pageIndex;
          const actionKey = rule.action_key || rule.rule_code || "";
          const isChatMessage = actionKey === "chat_message" || rule.source_action === "chat_message";
          return `
          <article class="ss-progression-row ss-progression-rule-row${isChatMessage ? " ss-progression-rule-row--primary" : ""}">
            <div>
              <strong>${escapeHtml(rule.display_label || formatLabel(actionKey))}</strong>
              <span class="muted">${escapeHtml(actionKey)} · ${escapeHtml(rule.source_domain)} / ${escapeHtml(rule.source_action || "default")} · applies to ${escapeHtml(rule.applies_to || "global")}</span>
              ${isChatMessage ? `<small class="muted">Effective chat message award: ${formatNumber(rule.xp_delta)} XP every ${formatNumber(rule.cooldown_seconds ?? 0)} seconds.</small>` : ""}
            </div>
            <label class="ss-progression-toggle">
              <input type="checkbox" data-rule-index="${index}" data-rule-field="enabled" ${rule.enabled ? "checked" : ""} />
              Enabled
            </label>
            <div class="ss-form-row">
              <label>XP amount</label>
              <input data-rule-index="${index}" data-rule-field="xp_delta" type="number" step="1" value="${escapeHtml(rule.xp_delta)}" />
            </div>
            <div class="ss-form-row">
              <label>Cooldown seconds</label>
              <input data-rule-index="${index}" data-rule-field="cooldown_seconds" type="number" min="0" step="1" value="${escapeHtml(rule.cooldown_seconds ?? "")}" />
            </div>
            <div class="ss-form-row">
              <label>Daily cap</label>
              <input data-rule-index="${index}" data-rule-field="daily_cap" type="number" min="0" step="1" value="${escapeHtml(rule.daily_cap ?? "")}" />
            </div>
            <div class="ss-form-row">
              <label>Applies to</label>
              <select data-rule-index="${index}" data-rule-field="applies_to">
                <option value="global" ${(rule.applies_to || "global") === "global" ? "selected" : ""}>Global</option>
                <option value="scoped" ${(rule.applies_to || "") === "scoped" ? "selected" : ""}>Scoped</option>
                <option value="both" ${(rule.applies_to || "") === "both" ? "selected" : ""}>Both</option>
              </select>
            </div>
            <div class="ss-form-row ss-progression-wide">
              <label>Reason text</label>
              <input data-rule-index="${index}" data-rule-field="reason_text" value="${escapeHtml(rule.reason_text)}" />
            </div>
          </article>
        `;
        }
      )
      .join("") + renderPager("rules", pageInfo, "Rule page");
    updateSaveState();
  }

  function selectedSummary() {
    return state.detail?.summary || null;
  }

  function renderIdentities() {
    if (!el.identitiesList) return;
    if (el.identityCount) el.identityCount.textContent = formatNumber(state.identities.length);
    if (el.identitiesEmpty) el.identitiesEmpty.classList.toggle("hidden", state.identities.length > 0);
    const pageInfo = pageSlice(state.identities, state.identityPage, IDENTITY_PAGE_SIZE);
    state.identityPage = pageInfo.page;
    el.identitiesList.innerHTML = pageInfo.items
      .map((item) => {
        const identity = item.identity || {};
        const summary = item.summary || {};
        const code = identity.identity_code || summary.identity_code || "";
        const displayCode = identityUserCode(identity, summary);
        const fallbackCode = identityFallbackCode(identity, summary);
        const sourceCodes = Array.isArray(summary.source_identity_codes) ? summary.source_identity_codes : [];
        const chips = renderPublicIdentityChips(publicIdentityChipItems(identity, summary), displayCode || identity.display_name || summary.display_name);
        const diagnostic = displayCode && fallbackCode && displayCode !== fallbackCode ? `Public identity: ${fallbackCode}` : fallbackCode;
        const selected = code && code === state.selectedIdentityCode;
        return `
          <article class="ss-progression-identity${selected ? " is-selected" : ""}" role="button" tabindex="0" data-identity-code="${escapeHtml(code)}">
            ${renderIdentityAvatar(identity, summary)}
            <span>
              <strong>${escapeHtml(identity.display_name || summary.display_name || identity.source_display_name || displayCode)}</strong>
              <small>User code: ${escapeHtml(displayCode || "Not linked")}</small>
              ${diagnostic && diagnostic !== displayCode ? `<small>${escapeHtml(diagnostic)}</small>` : ""}
              ${chips}
            </span>
            <span>
              <strong>${renderXpValue(summary.xp_total, { compact: true })}</strong>
              ${renderLevelChip(summary, { compact: true })}
            </span>
          </article>
        `;
      })
      .join("") + renderPager("identities", pageInfo, "Identity page");
  }

  function renderHistory(events) {
    const pageInfo = pageSlice(events || [], state.eventPage, EVENT_PAGE_SIZE);
    state.eventPage = pageInfo.page;
    const rows = pageInfo.items.map(
      (event) => `
        <tr>
          <td>${escapeHtml(event.xp_event_code)}</td>
          <td>${escapeHtml(formatLabel(event.event_type))}</td>
          <td>${formatNumber(event.xp_delta)}</td>
          <td>${escapeHtml(event.reason_text || event.reason)}</td>
          <td>${escapeHtml(event.created_at)}</td>
          <td>
            <button class="ss-btn ss-btn-ghost" type="button" data-reverse-event="${escapeHtml(event.xp_event_code)}">Reverse</button>
          </td>
        </tr>
      `
    );
    return `
      <div class="ss-progression-table-wrap">
        <table class="ss-table ss-table-compact">
          <thead><tr><th>Event</th><th>Type</th><th>Delta</th><th>Reason</th><th>Created</th><th></th></tr></thead>
          <tbody>${rows.join("") || `<tr><td colspan="6" class="muted">No XP history yet.</td></tr>`}</tbody>
        </table>
      </div>
      ${renderPager("events", pageInfo, "XP event page")}
    `;
  }

  function renderInspector() {
    const summary = selectedSummary();
    if (!summary || !el.inspector) return;
    const identity = state.detail?.identity || {};
    const displayCode = identityUserCode(identity, summary);
    const fallbackCode = identityFallbackCode(identity, summary);
    const sourceCodes = Array.isArray(summary.source_identity_codes) ? summary.source_identity_codes : [];
    const chips = renderPublicIdentityChips(publicIdentityChipItems(identity, summary), displayCode || identity.display_name || summary.display_name);
    el.inspector.classList.remove("ss-empty");
    el.inspector.innerHTML = `
      <div class="ss-progression-summary">
        <div><span class="muted">User code</span><strong>${escapeHtml(displayCode || fallbackCode)}</strong></div>
        <div><span class="muted">Display name</span><strong>${escapeHtml(identity.display_name || summary.display_name || identity.source_display_name || displayCode || fallbackCode)}</strong></div>
        <div><span class="muted">Public identity</span><strong>${escapeHtml(fallbackCode || "Not available")}</strong></div>
        <div><span class="muted">Public identities</span><strong>${chips}</strong></div>
        <div><span class="muted">XP total</span><strong>${renderXpValue(summary.xp_total)}</strong></div>
        <div><span class="muted">Current level</span><strong>${renderLevelChip(summary)}</strong></div>
        <div><span class="muted">Leaderboard</span><strong>${summary.is_leaderboard_visible ? "Visible" : "Suppressed"}</strong></div>
      </div>
      <form id="progression-manual-form" class="ss-progression-action-form">
        <div class="ss-form-row">
          <label for="progression-action-type">Action</label>
          <select id="progression-action-type" name="event_type">
            <option value="grant">Grant XP</option>
            <option value="penalty">Penalty XP</option>
            <option value="adjustment">Neutral/manual adjustment</option>
          </select>
        </div>
        <div class="ss-form-row">
          <label for="progression-action-delta">XP amount</label>
          <input id="progression-action-delta" name="xp_delta" type="number" step="1" required />
        </div>
        <div class="ss-form-row ss-progression-wide">
          <label for="progression-action-reason">Reason / note</label>
          <textarea id="progression-action-reason" name="reason_text" rows="3" required></textarea>
        </div>
        <button class="ss-btn" type="submit">Create ledger event</button>
      </form>
      ${renderHistory(state.detail?.events || [])}
    `;
  }

  function renderHygiene() {
    const summary = selectedSummary();
    if (!summary || !el.hygiene) return;
    el.hygiene.classList.remove("ss-empty");
    el.hygiene.innerHTML = `
      <form id="progression-leaderboard-form" class="ss-progression-action-form">
        <div class="ss-form-row">
          <label for="progression-leaderboard-visible">Public leaderboard visibility</label>
          <select id="progression-leaderboard-visible" name="is_leaderboard_visible">
            <option value="true" ${summary.is_leaderboard_visible ? "selected" : ""}>Visible</option>
            <option value="false" ${summary.is_leaderboard_visible ? "" : "selected"}>Suppressed</option>
          </select>
        </div>
        <div class="ss-form-row">
          <label for="progression-leaderboard-reason">Suppression reason</label>
          <input id="progression-leaderboard-reason" name="reason" value="${escapeHtml(summary.leaderboard_suppression_reason || "")}" />
        </div>
        <div class="ss-form-row ss-progression-wide">
          <label for="progression-leaderboard-note">Moderation note</label>
          <textarea id="progression-leaderboard-note" name="moderation_note" rows="3">${escapeHtml(summary.leaderboard_moderation_note || "")}</textarea>
        </div>
        <button class="ss-btn" type="submit">Update leaderboard visibility</button>
      </form>
      <p class="muted" style="margin:10px 0 0;">This control does not delete XP history or edit previous ledger events.</p>
    `;
  }

  async function loadConfig() {
    const [payload, rulesPayload] = await Promise.all([
      requestJson(CONFIG_RANKS),
      requestJson(CONFIG_RULES)
    ]);
    state.ranks = clone(payload.level_definitions || payload.rank_definitions || []);
    state.originalRanks = clone(state.ranks);
    state.rules = clone(rulesPayload.rules || payload.rules || []);
    state.originalRules = clone(state.rules);
    if (el.rulesErrors) el.rulesErrors.classList.add("hidden");
    if (el.scope) el.scope.textContent = payload.scope || "global";
    if (el.rankCount) el.rankCount.textContent = formatNumber(state.ranks.length);
    if (el.ruleCount) el.ruleCount.textContent = formatNumber(state.rules.length);
    renderRanks();
    renderRules();
  }

  async function searchIdentities() {
    const query = text(el.searchInput?.value);
    const params = query ? `?q=${encodeURIComponent(query)}&limit=25` : "?limit=25";
    const payload = await requestJson(`${IDENTITIES}${params}`);
    state.identities = payload.identities || [];
    state.identityPage = 1;
    if (!state.selectedIdentityCode && state.identities[0]?.summary?.identity_code) {
      state.selectedIdentityCode = state.identities[0].summary.identity_code;
      await loadIdentity(state.selectedIdentityCode, { renderList: false });
    }
    renderIdentities();
  }

  async function loadIdentity(identityCode, options = {}) {
    const payload = await requestJson(`${IDENTITY_DETAIL(identityCode)}?limit=50`);
    state.selectedIdentityCode = identityCode;
    state.detail = payload;
    state.eventPage = 1;
    renderInspector();
    renderHygiene();
    if (options.renderList !== false) renderIdentities();
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

  async function refresh() {
    const token = ++state.token;
    setStatus("Loading progression controls...");
    try {
      await loadConfig();
      await searchIdentities();
      if (token === state.token) setStatus("Progression controls loaded.", "success");
    } catch (err) {
      if (token === state.token) setStatus(err.message || "Progression load failed.", "error");
    }
  }

  async function saveRanks() {
    const error = validateRanks();
    if (error) {
      setStatus(error, "warning");
      return;
    }
    state.saving = true;
    updateSaveState();
    try {
      const payload = await requestJson(CONFIG_RANKS, {
        method: "PATCH",
        body: JSON.stringify({ level_definitions: state.ranks })
      });
      state.ranks = clone(payload.level_definitions || payload.rank_definitions || []);
      state.originalRanks = clone(state.ranks);
      renderRanks();
      setStatus("Level definitions saved.", "success");
      if (state.selectedIdentityCode) await loadIdentity(state.selectedIdentityCode);
    } catch (err) {
      setStatus(err.message || "Level save failed.", "error");
    } finally {
      state.saving = false;
      updateSaveState();
    }
  }

  async function saveRules() {
    const error = validateRules();
    if (error) {
      setStatus(error, "warning");
      return;
    }
    state.saving = true;
    updateSaveState();
    try {
      const validation = await requestJson(CONFIG_RULES_VALIDATE, {
        method: "POST",
        body: JSON.stringify({ rules: state.rules })
      });
      if (validation.validation_errors?.length) {
        const message = validation.validation_errors.map((item) => item.error || item.message).filter(Boolean).join("; ");
        if (el.rulesErrors) {
          el.rulesErrors.textContent = message || "Runtime/Auth rejected the XP rules.";
          el.rulesErrors.classList.remove("hidden");
        }
        setStatus(message || "Runtime/Auth rejected the XP rules.", "error");
        return;
      }
      const payload = await requestJson(CONFIG_RULES, {
        method: "PUT",
        body: JSON.stringify({ rules: state.rules })
      });
      state.rules = clone(payload.rules || []);
      state.originalRules = clone(state.rules);
      if (el.rulesErrors) el.rulesErrors.classList.add("hidden");
      renderRules();
      setStatus("XP rules saved.", "success");
    } catch (err) {
      setStatus(err.message || "Rule save failed.", "error");
    } finally {
      state.saving = false;
      updateSaveState();
    }
  }

  async function resetRules() {
    if (!window.confirm?.("Reset XP rules to Runtime/Auth defaults? Unsaved rule edits will be discarded.")) return;
    state.saving = true;
    updateSaveState();
    try {
      const payload = await requestJson(CONFIG_RULES_RESET, { method: "POST", body: JSON.stringify({}) });
      state.rules = clone(payload.rules || []);
      state.originalRules = clone(state.rules);
      if (el.rulesErrors) el.rulesErrors.classList.add("hidden");
      renderRules();
      setStatus("XP rules reset to Runtime/Auth defaults.", "success");
    } catch (err) {
      setStatus(err.message || "Rule reset failed.", "error");
    } finally {
      state.saving = false;
      updateSaveState();
    }
  }

  async function submitManualAction(form) {
    if (!state.selectedIdentityCode) return;
    const data = new FormData(form);
    const reason = text(data.get("reason_text"));
    if (!reason) {
      setStatus("Manual XP actions require a reason.", "warning");
      return;
    }
    await requestJson(IDENTITY_EVENTS(state.selectedIdentityCode), {
      method: "POST",
      body: JSON.stringify({
        event_type: text(data.get("event_type")),
        xp_delta: Number(data.get("xp_delta") || 0),
        reason_text: reason
      })
    });
    form.reset();
    await loadIdentity(state.selectedIdentityCode);
    await searchIdentities();
    setStatus("Manual XP ledger event created.", "success");
  }

  async function submitLeaderboard(form) {
    if (!state.selectedIdentityCode) return;
    const data = new FormData(form);
    const visible = text(data.get("is_leaderboard_visible")) === "true";
    const reason = text(data.get("reason"));
    if (!visible && !reason) {
      setStatus("Leaderboard suppression requires a reason.", "warning");
      return;
    }
    await requestJson(LEADERBOARD(state.selectedIdentityCode), {
      method: "PATCH",
      body: JSON.stringify({
        is_leaderboard_visible: visible,
        reason,
        moderation_note: text(data.get("moderation_note"))
      })
    });
    await loadIdentity(state.selectedIdentityCode);
    await searchIdentities();
    setStatus("Leaderboard visibility updated.", "success");
  }

  async function reverseEvent(eventCode) {
    const reason = window.prompt("Reason for reversal");
    if (!text(reason)) {
      setStatus("Reversal requires a reason.", "warning");
      return;
    }
    await requestJson(EVENT_REVERSE(eventCode), {
      method: "POST",
      body: JSON.stringify({ reason_text: reason })
    });
    await loadIdentity(state.selectedIdentityCode);
    await searchIdentities();
    setStatus("Reversal ledger event created.", "success");
  }

  function bindEvents() {
    if (state.bound) return;
    state.bound = true;
    el.refresh?.addEventListener("click", refresh);
    el.searchSubmit?.addEventListener("click", searchIdentities);
    el.searchInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") searchIdentities();
    });
    el.ranksSave?.addEventListener("click", saveRanks);
    el.rulesSave?.addEventListener("click", saveRules);
    el.rulesReset?.addEventListener("click", resetRules);
    el.ranksList?.addEventListener("input", (event) => {
      const target = event.target;
      const index = Number(target?.dataset?.rankIndex);
      const field = target?.dataset?.rankField;
      if (!Number.isInteger(index) || !field || !state.ranks[index]) return;
      state.ranks[index][field] = field === "threshold_xp" || field === "level_xp_min" ? Number(target.value || 0) : target.value;
      if (field === "level_color_hex" && /^#[0-9a-f]{6}$/i.test(target.value)) {
        el.ranksList.querySelectorAll(`[data-rank-index="${index}"][data-rank-field="level_color_hex"]`).forEach((input) => {
          if (input !== target) input.value = target.value;
        });
      }
      updateSaveState();
    });
    el.ranksList?.addEventListener("change", (event) => {
      const target = event.target;
      const index = Number(target?.dataset?.rankIndex);
      const field = target?.dataset?.rankField;
      if (!Number.isInteger(index) || !field || !state.ranks[index]) return;
      state.ranks[index][field] = target.value;
      updateSaveState();
    });
    el.rulesList?.addEventListener("input", (event) => {
      const target = event.target;
      const index = Number(target?.dataset?.ruleIndex);
      const field = target?.dataset?.ruleField;
      if (!Number.isInteger(index) || !field || !state.rules[index]) return;
      if (field === "enabled") {
        state.rules[index][field] = Boolean(target.checked);
      } else if (["xp_delta", "cooldown_seconds", "daily_cap"].includes(field)) {
        state.rules[index][field] = target.value === "" ? null : Number(target.value);
      } else {
        state.rules[index][field] = target.value;
      }
      updateSaveState();
    });
    el.identitiesList?.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-public-identity-unassign-chip]");
      if (chip) {
        event.preventDefault();
        event.stopPropagation();
        unassignPublicIdentityChip(chip).catch((err) => setStatus(err.message, "error"));
        return;
      }
      const button = event.target.closest("[data-identity-code]");
      if (button) loadIdentity(button.dataset.identityCode);
    });

    // Hover icon swap for unassign chips (backspace -> backspace-fill)
    document.addEventListener("mouseover", (event) => {
      const chip = event.target.closest("[data-public-identity-unassign-chip]");
      if (chip) {
        const icon = chip.querySelector(".unassign-icon");
        if (icon) icon.style.maskImage = "url('/assets/icons/ui/backspace-fill.svg')";
      }
    });
    document.addEventListener("mouseout", (event) => {
      const chip = event.target.closest("[data-public-identity-unassign-chip]");
      if (chip) {
        const icon = chip.querySelector(".unassign-icon");
        if (icon) icon.style.maskImage = "url('/assets/icons/ui/backspace.svg')";
      }
    });
    document.addEventListener("submit", (event) => {
      if (event.target?.id === "progression-manual-form") {
        event.preventDefault();
        submitManualAction(event.target).catch((err) => setStatus(err.message, "error"));
      }
      if (event.target?.id === "progression-leaderboard-form") {
        event.preventDefault();
        submitLeaderboard(event.target).catch((err) => setStatus(err.message, "error"));
      }
    });
    document.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-public-identity-unassign-chip]");
      if (chip) {
        event.preventDefault();
        unassignPublicIdentityChip(chip).catch((err) => setStatus(err.message, "error"));
        return;
      }
      const collapseButton = event.target.closest("[data-collapse-target]");
      if (collapseButton) {
        const key = collapseButton.dataset.collapseTarget;
        const expanded = collapseButton.getAttribute("aria-expanded") === "true";
        setCollapsed(key, expanded);
        return;
      }
      const pageButton = event.target.closest("[data-progress-page]");
      if (pageButton) {
        const kind = pageButton.dataset.progressPage;
        const nextPage = Number(pageButton.dataset.page || 1);
        if (kind === "levels") {
          state.levelPage = nextPage;
          renderRanks();
        } else if (kind === "rules") {
          state.rulePage = nextPage;
          renderRules();
        } else if (kind === "identities") {
          state.identityPage = nextPage;
          renderIdentities();
        } else if (kind === "events") {
          state.eventPage = nextPage;
          renderInspector();
        }
        return;
      }
      const button = event.target.closest("[data-reverse-event]");
      if (button) {
        reverseEvent(button.dataset.reverseEvent).catch((err) => setStatus(err.message, "error"));
      }
    });
  }

  function cacheElements() {
    el.status = $("progression-status");
    el.refresh = $("progression-refresh");
    el.searchInput = $("progression-search-input");
    el.searchSubmit = $("progression-search-submit");
    el.scope = $("progression-scope");
    el.rankCount = $("progression-rank-count");
    el.ruleCount = $("progression-rule-count");
    el.identityCount = $("progression-identity-count");
    el.ranksStatus = $("progression-ranks-status");
    el.ranksSave = $("progression-ranks-save");
    el.ranksList = $("progression-ranks-list");
    el.rulesStatus = $("progression-rules-status");
    el.rulesSave = $("progression-rules-save");
    el.rulesReset = $("progression-rules-reset");
    el.rulesErrors = $("progression-rules-errors");
    el.rulesList = $("progression-rules-list");
    el.identitiesList = $("progression-identities-list");
    el.identitiesEmpty = $("progression-identities-empty");
    el.inspector = $("progression-inspector");
    el.hygiene = $("progression-leaderboard-hygiene");
  }

  window.ProgressionAdminView = {
    init() {
      cacheElements();
      bindEvents();
      initializeCollapsibles();
      return refresh();
    },
    destroy() {
      state.token += 1;
      state.bound = false;
    }
  };
})();

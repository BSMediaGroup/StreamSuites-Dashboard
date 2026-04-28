/* ============================================================
   StreamSuites Dashboard - XP / Rank admin controls
   ============================================================ */

(() => {
  "use strict";

  const CONFIG_RANKS = "/api/admin/progression/ranks";
  const CONFIG_RULES = "/api/admin/progression/rules";
  const IDENTITIES = "/api/admin/progression/identities";
  const IDENTITY_DETAIL = (identityCode) => `/api/admin/progression/identities/${encodeURIComponent(identityCode)}`;
  const IDENTITY_EVENTS = (identityCode) => `/api/admin/progression/identities/${encodeURIComponent(identityCode)}/events`;
  const EVENT_REVERSE = (eventCode) => `/api/admin/progression/events/${encodeURIComponent(eventCode)}/reverse`;
  const LEADERBOARD = (identityCode) => `/api/admin/progression/identities/${encodeURIComponent(identityCode)}/leaderboard`;

  const state = {
    ranks: [],
    originalRanks: [],
    rules: [],
    originalRules: [],
    identities: [],
    selectedIdentityCode: "",
    detail: null,
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

  function rankDirty() {
    return JSON.stringify(state.ranks) !== JSON.stringify(state.originalRanks);
  }

  function rulesDirty() {
    return JSON.stringify(state.rules) !== JSON.stringify(state.originalRules);
  }

  function validateRanks() {
    let previous = -1;
    for (const rank of state.ranks) {
      const threshold = Number(rank.threshold_xp);
      if (!rank.label || !Number.isInteger(threshold) || threshold < 0) {
        return "Every rank needs a label and non-negative integer threshold.";
      }
      if (rank.rank_code === "RANK0" && threshold !== 0) {
        return "RANK0 threshold must stay 0.";
      }
      if (threshold <= previous) {
        return "Rank thresholds must stay strictly increasing.";
      }
      previous = threshold;
    }
    return "";
  }

  function updateSaveState() {
    const rankError = validateRanks();
    if (el.ranksStatus) {
      el.ranksStatus.textContent = rankError || (rankDirty() ? "Unsaved rank changes" : "No pending changes");
    }
    if (el.ranksSave) {
      el.ranksSave.disabled = Boolean(rankError) || !rankDirty() || state.saving;
    }
    if (el.rulesStatus) {
      el.rulesStatus.textContent = rulesDirty() ? "Unsaved rule changes" : "No pending changes";
    }
    if (el.rulesSave) {
      el.rulesSave.disabled = !rulesDirty() || state.saving;
    }
  }

  function renderRanks() {
    if (!el.ranksList) return;
    el.ranksList.innerHTML = state.ranks
      .map(
        (rank, index) => `
          <article class="ss-progression-row">
            <div>
              <strong>${escapeHtml(rank.rank_code)}</strong>
              <span class="muted">Fixed internal code</span>
            </div>
            <div class="ss-form-row">
              <label for="progression-rank-label-${index}">Label</label>
              <input id="progression-rank-label-${index}" data-rank-index="${index}" data-rank-field="label" value="${escapeHtml(rank.label)}" />
            </div>
            <div class="ss-form-row">
              <label for="progression-rank-threshold-${index}">Threshold XP</label>
              <input id="progression-rank-threshold-${index}" data-rank-index="${index}" data-rank-field="threshold_xp" type="number" min="0" step="1" value="${escapeHtml(rank.threshold_xp)}" ${rank.rank_code === "RANK0" ? "readonly" : ""} />
            </div>
          </article>
        `
      )
      .join("");
    updateSaveState();
  }

  function renderRules() {
    if (!el.rulesList) return;
    el.rulesList.innerHTML = state.rules
      .map(
        (rule, index) => `
          <article class="ss-progression-row ss-progression-rule-row">
            <div>
              <strong>${escapeHtml(rule.rule_code)}</strong>
              <span class="muted">${escapeHtml(rule.source_domain)} / ${escapeHtml(rule.source_action || "default")}</span>
            </div>
            <label class="ss-progression-toggle">
              <input type="checkbox" data-rule-index="${index}" data-rule-field="enabled" ${rule.enabled ? "checked" : ""} />
              Enabled
            </label>
            <div class="ss-form-row">
              <label>XP delta</label>
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
            <div class="ss-form-row ss-progression-wide">
              <label>Reason text</label>
              <input data-rule-index="${index}" data-rule-field="reason_text" value="${escapeHtml(rule.reason_text)}" />
            </div>
          </article>
        `
      )
      .join("");
    updateSaveState();
  }

  function selectedSummary() {
    return state.detail?.summary || null;
  }

  function renderIdentities() {
    if (!el.identitiesList) return;
    if (el.identityCount) el.identityCount.textContent = formatNumber(state.identities.length);
    if (el.identitiesEmpty) el.identitiesEmpty.classList.toggle("hidden", state.identities.length > 0);
    el.identitiesList.innerHTML = state.identities
      .map((item) => {
        const identity = item.identity || {};
        const summary = item.summary || {};
        const code = identity.identity_code || summary.identity_code || "";
        const selected = code && code === state.selectedIdentityCode;
        return `
          <button class="ss-progression-identity${selected ? " is-selected" : ""}" type="button" data-identity-code="${escapeHtml(code)}">
            <span>
              <strong>${escapeHtml(identity.display_name || identity.source_display_name || code)}</strong>
              <small>${escapeHtml(code)}</small>
            </span>
            <span>
              <strong>${formatNumber(summary.xp_total)} XP</strong>
              <small>${escapeHtml(summary.rank_label || summary.current_rank_code || "RANK0")}</small>
            </span>
          </button>
        `;
      })
      .join("");
  }

  function renderHistory(events) {
    const rows = (events || []).map(
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
    `;
  }

  function renderInspector() {
    const summary = selectedSummary();
    if (!summary || !el.inspector) return;
    const identity = state.detail?.identity || {};
    el.inspector.classList.remove("ss-empty");
    el.inspector.innerHTML = `
      <div class="ss-progression-summary">
        <div><span class="muted">Identity</span><strong>${escapeHtml(identity.display_name || identity.source_display_name || summary.identity_code)}</strong></div>
        <div><span class="muted">XP total</span><strong>${formatNumber(summary.xp_total)}</strong></div>
        <div><span class="muted">Current rank</span><strong>${escapeHtml(summary.rank_label || summary.current_rank_code)}</strong></div>
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
    const payload = await requestJson(CONFIG_RANKS);
    state.ranks = clone(payload.rank_definitions || []);
    state.originalRanks = clone(state.ranks);
    state.rules = clone(payload.rules || []);
    state.originalRules = clone(state.rules);
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
    renderInspector();
    renderHygiene();
    if (options.renderList !== false) renderIdentities();
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
        body: JSON.stringify({ rank_definitions: state.ranks })
      });
      state.ranks = clone(payload.rank_definitions || []);
      state.originalRanks = clone(state.ranks);
      renderRanks();
      setStatus("Rank definitions saved.", "success");
      if (state.selectedIdentityCode) await loadIdentity(state.selectedIdentityCode);
    } catch (err) {
      setStatus(err.message || "Rank save failed.", "error");
    } finally {
      state.saving = false;
      updateSaveState();
    }
  }

  async function saveRules() {
    state.saving = true;
    updateSaveState();
    try {
      const payload = await requestJson(CONFIG_RULES, {
        method: "PATCH",
        body: JSON.stringify({ rules: state.rules })
      });
      state.rules = clone(payload.rules || []);
      state.originalRules = clone(state.rules);
      renderRules();
      setStatus("XP rules saved.", "success");
    } catch (err) {
      setStatus(err.message || "Rule save failed.", "error");
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
    el.ranksList?.addEventListener("input", (event) => {
      const target = event.target;
      const index = Number(target?.dataset?.rankIndex);
      const field = target?.dataset?.rankField;
      if (!Number.isInteger(index) || !field || !state.ranks[index]) return;
      state.ranks[index][field] = field === "threshold_xp" ? Number(target.value || 0) : target.value;
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
      const button = event.target.closest("[data-identity-code]");
      if (button) loadIdentity(button.dataset.identityCode);
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
      return refresh();
    },
    destroy() {
      state.token += 1;
    }
  };
})();

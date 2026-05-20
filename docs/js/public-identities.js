/* ============================================================
   StreamSuites Dashboard - Public identity reconciliation
   ============================================================ */

(() => {
  "use strict";

  const RECONCILIATION = "/api/admin/public-identities/reconciliation";
  const ASSIGN = "/api/admin/public-identities/reconciliation/assign";
  const ACCOUNT_SEARCH = "/api/admin/accounts/search";

  const state = {
    status: "unresolved",
    platform: "",
    scopeKey: "",
    query: "",
    items: [],
    selectedKey: "",
    selectedAccount: null,
    accounts: [],
    loading: false,
    assigning: false,
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
      const error = new Error(payload?.message || payload?.error || `Request failed (${response.status})`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function setStatus(message, tone = "info") {
    if (el.status) el.status.textContent = message || "";
    if (message && tone !== "info") {
      const notify = tone === "error" ? "error" : tone === "success" ? "success" : "warning";
      window.StreamSuitesToast?.[notify]?.(message, { key: "public-identities", title: "Public Identities" });
    }
  }

  function formatLabel(value) {
    return text(value).replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number.toLocaleString() : "0";
  }

  function recordKey(record = {}) {
    return text(record.participant_key || record.identity_key || record.identity_code);
  }

  function selectedRecord() {
    return state.items.find((item) => recordKey(item) === state.selectedKey) || null;
  }

  function chip(value, tone = "") {
    const label = formatLabel(value || "unknown");
    return `<span class="ss-public-identities-chip${tone ? ` is-${escapeHtml(tone)}` : ""}">${escapeHtml(label)}</span>`;
  }

  function accountLabel(account = {}) {
    return text(account.display_name || account.public_slug || account.user_code || account.email || account.account_id);
  }

  function renderDiagnostics(record = {}) {
    const resolver = record.resolver || {};
    const candidates = Array.isArray(resolver.candidates) ? resolver.candidates : [];
    const rows = candidates.length
      ? candidates
          .map(
            (candidate) => `
              <li>
                <strong>${escapeHtml(accountLabel(candidate) || candidate.account_id)}</strong>
                <span class="muted">${escapeHtml(candidate.public_slug ? `@${candidate.public_slug}` : candidate.user_code || candidate.account_id || "")}</span>
              </li>
            `
          )
          .join("")
      : `<li class="muted">No resolver candidates returned.</li>`;
    return `
      <div class="ss-public-identities-diagnostics">
        <div>${chip(resolver.matched_by || "no_match")} ${chip(resolver.confidence || "none", resolver.ambiguous ? "warning" : "info")} ${resolver.ambiguous ? chip("ambiguous", "warning") : ""}</div>
        <div class="ss-public-identities-normalized">
          <span>Platform handle: ${escapeHtml(resolver.normalized_platform_handle || "-")}</span>
          <span>Public handle: ${escapeHtml(resolver.normalized_public_handle || "-")}</span>
        </div>
        <ul>${rows}</ul>
      </div>
    `;
  }

  function renderList() {
    if (!el.list || !el.empty || !el.error || !el.count) return;
    el.error.classList.add("hidden");
    el.count.textContent = `${formatNumber(state.items.length)} records`;
    if (!state.items.length) {
      el.list.innerHTML = "";
      el.empty.classList.remove("hidden");
      renderAssignment();
      return;
    }
    el.empty.classList.add("hidden");
    el.list.innerHTML = state.items
      .map((record) => {
        const key = recordKey(record);
        const account = record.current_account || {};
        const selected = key === state.selectedKey;
        return `
          <article class="ss-public-identities-row${selected ? " is-selected" : ""}" data-public-identity-key="${escapeHtml(key)}">
            <button class="ss-public-identities-row-main" type="button" data-public-identity-select="${escapeHtml(key)}">
              <span class="ss-public-identities-primary">
                <strong>${escapeHtml(record.display_name || record.sender_username || record.identity_code || "Unknown identity")}</strong>
                <span class="muted">${escapeHtml(record.sender_username ? `@${record.sender_username}` : record.identity_code || key)}</span>
              </span>
              <span class="ss-public-identities-meta">
                ${chip(record.status, record.status === "ambiguous" ? "warning" : record.status === "resolved" ? "success" : "danger")}
                ${chip(record.platform || "unknown")}
                ${chip(record.identity_kind || "unassigned")}
              </span>
              <span class="ss-public-identities-stats">${formatNumber(record.xp)} XP · ${formatNumber(record.message_count)} messages</span>
              <span class="ss-public-identities-account">${escapeHtml(accountLabel(account) || "No assigned account")}</span>
            </button>
            <div class="ss-public-identities-row-details">
              <span>${escapeHtml(record.identity_code || "-")}</span>
              <span>${escapeHtml(record.sender_user_id || record.platform_user_id || "-")}</span>
              <span>${escapeHtml(record.scope_key || "-")}</span>
            </div>
          </article>
        `;
      })
      .join("");
    if (!selectedRecord()) {
      state.selectedKey = recordKey(state.items[0]);
    }
    renderAssignment();
  }

  function renderAccountResults() {
    if (!state.accounts.length) {
      return `<div class="ss-empty">Search accounts by display name, user code, email, slug, or UUID.</div>`;
    }
    return state.accounts
      .map((account) => {
        const selected = state.selectedAccount?.account_id === account.account_id;
        const aliases = Array.isArray(account.platform_aliases) ? account.platform_aliases : [];
        return `
          <button class="ss-public-identities-account-result${selected ? " is-selected" : ""}" type="button" data-public-identities-account="${escapeHtml(account.account_id)}">
            <strong>${escapeHtml(accountLabel(account))}</strong>
            <span>${escapeHtml(account.public_slug ? `@${account.public_slug}` : account.user_code || account.account_id)}</span>
            <small>${escapeHtml(aliases.map((alias) => `${alias.platform}:${alias.handle || alias.platform_user_id || alias.chat_id}`).filter(Boolean).join(", ") || account.email || "")}</small>
          </button>
        `;
      })
      .join("");
  }

  function renderAssignment() {
    if (!el.assignment) return;
    const record = selectedRecord();
    if (!record) {
      el.assignment.className = "ss-public-identities-assignment ss-empty";
      el.assignment.innerHTML = "Select an identity to review diagnostics and assign it to a StreamSuites account.";
      return;
    }
    const account = record.current_account || {};
    const isResolved = record.status === "resolved" || Boolean(record.account_id);
    el.assignment.className = "ss-public-identities-assignment";
    el.assignment.innerHTML = `
      <div class="ss-public-identities-assignment-grid">
        <div class="ss-public-identities-detail">
          <h3>${escapeHtml(record.display_name || record.sender_username || record.identity_code || "Identity")}</h3>
          <div class="ss-meta-row">
            <div><strong>Identity:</strong> ${escapeHtml(record.identity_code || "-")}</div>
            <div><strong>Platform user:</strong> ${escapeHtml(record.sender_user_id || record.platform_user_id || "-")}</div>
            <div><strong>Scope:</strong> ${escapeHtml(record.scope_key || "-")}</div>
            <div><strong>Current account:</strong> ${escapeHtml(accountLabel(account) || "Unassigned")}</div>
          </div>
          ${renderDiagnostics(record)}
        </div>
        <div class="ss-public-identities-assign-box">
          <label class="ss-form-row">
            <span>Account search</span>
            <input id="public-identities-account-query" type="search" placeholder="Search StreamSuites accounts" />
          </label>
          <button id="public-identities-account-search" class="ss-btn ss-btn-secondary" type="button">Search accounts</button>
          <div id="public-identities-account-results" class="ss-public-identities-account-results">${renderAccountResults()}</div>
          <label class="ss-form-row">
            <span>Assignment note</span>
            <textarea id="public-identities-assignment-note" rows="3" placeholder="Why this identity belongs to the selected account"></textarea>
          </label>
          <label class="ss-public-identities-reassign">
            <input id="public-identities-reassign" type="checkbox" />
            <span>${isResolved ? "Reassign this identity. Future matching changes; historical ledger rows are not deleted." : "Allow conflict-aware reassignment if Runtime/Auth reports an existing link."}</span>
          </label>
          <button id="public-identities-assign" class="ss-btn" type="button" ${state.selectedAccount ? "" : "disabled"}>${isResolved ? "Reassign identity" : "Assign identity"}</button>
        </div>
      </div>
    `;
  }

  function syncFiltersFromDom() {
    state.platform = text(el.platform?.value).toLowerCase();
    state.scopeKey = text(el.scope?.value);
    state.query = text(el.query?.value);
  }

  async function loadRecords() {
    syncFiltersFromDom();
    state.loading = true;
    setStatus("Loading identities...");
    const params = new URLSearchParams();
    params.set("status", state.status);
    params.set("limit", "100");
    if (state.platform) params.set("platform", state.platform);
    if (state.scopeKey) params.set("scope_key", state.scopeKey);
    if (state.query) params.set("q", state.query);
    try {
      const payload = await requestJson(`${RECONCILIATION}?${params.toString()}`);
      state.items = Array.isArray(payload.items) ? payload.items : [];
      state.selectedKey = state.items.some((item) => recordKey(item) === state.selectedKey)
        ? state.selectedKey
        : recordKey(state.items[0] || {});
      state.selectedAccount = null;
      setStatus("Loaded identity reconciliation records.");
      renderList();
    } catch (err) {
      state.items = [];
      if (el.error) {
        el.error.textContent = err.status === 404 ? "Runtime/Auth does not expose identity reconciliation on this build." : err.message;
        el.error.classList.remove("hidden");
      }
      setStatus(err.message || "Failed to load identities.", "error");
      renderList();
    } finally {
      state.loading = false;
    }
  }

  async function searchAccounts() {
    const input = $("public-identities-account-query");
    const query = text(input?.value);
    if (!query) return;
    const payload = await requestJson(`${ACCOUNT_SEARCH}?q=${encodeURIComponent(query)}&limit=20`);
    state.accounts = Array.isArray(payload.items) ? payload.items : [];
    const results = $("public-identities-account-results");
    if (results) results.innerHTML = renderAccountResults();
  }

  async function assignSelected() {
    const record = selectedRecord();
    if (!record || !state.selectedAccount || state.assigning) return;
    const reassign = $("public-identities-reassign")?.checked === true;
    if ((record.status === "resolved" || record.account_id) && !reassign) {
      setStatus("Reassignment requires explicit confirmation.", "warning");
      return;
    }
    const note = text($("public-identities-assignment-note")?.value);
    state.assigning = true;
    setStatus("Submitting assignment...");
    try {
      await requestJson(ASSIGN, {
        method: "POST",
        body: JSON.stringify({
          identity_code: record.identity_code,
          participant_key: record.participant_key,
          platform: record.platform,
          platform_user_id: record.platform_user_id || record.sender_user_id,
          sender_user_id: record.sender_user_id || record.platform_user_id,
          chat_id: record.chat_id,
          sender_username: record.sender_username || record.handle,
          handle: record.handle || record.sender_username,
          display_name: record.display_name,
          scope_key: record.scope_key,
          account_id: state.selectedAccount.account_id,
          assignment_note: note,
          reassign,
          force: reassign
        })
      });
      setStatus("Assignment saved in Runtime/Auth.", "success");
      await loadRecords();
    } catch (err) {
      setStatus(err.message || "Assignment failed.", "error");
    } finally {
      state.assigning = false;
    }
  }

  function bindEvents() {
    if (state.bound) return;
    state.bound = true;
    el.refresh?.addEventListener("click", loadRecords);
    el.search?.addEventListener("click", loadRecords);
    document.addEventListener("click", (event) => {
      const statusButton = event.target.closest("[data-public-identities-status]");
      if (statusButton) {
        state.status = statusButton.getAttribute("data-public-identities-status") || "unresolved";
        document.querySelectorAll("[data-public-identities-status]").forEach((button) => {
          button.classList.toggle("is-active", button === statusButton);
        });
        loadRecords();
        return;
      }
      const selectButton = event.target.closest("[data-public-identity-select]");
      if (selectButton) {
        state.selectedKey = selectButton.getAttribute("data-public-identity-select") || "";
        state.selectedAccount = null;
        renderList();
        return;
      }
      const accountButton = event.target.closest("[data-public-identities-account]");
      if (accountButton) {
        const accountId = accountButton.getAttribute("data-public-identities-account") || "";
        state.selectedAccount = state.accounts.find((account) => account.account_id === accountId) || null;
        renderAssignment();
        return;
      }
      if (event.target.closest("#public-identities-account-search")) {
        searchAccounts().catch((err) => setStatus(err.message || "Account search failed.", "error"));
        return;
      }
      if (event.target.closest("#public-identities-assign")) {
        assignSelected();
      }
    });
  }

  function cacheElements() {
    el.status = $("public-identities-status");
    el.refresh = $("public-identities-refresh");
    el.platform = $("public-identities-platform");
    el.scope = $("public-identities-scope");
    el.query = $("public-identities-query");
    el.search = $("public-identities-search-submit");
    el.list = $("public-identities-list");
    el.empty = $("public-identities-empty");
    el.error = $("public-identities-error");
    el.count = $("public-identities-count");
    el.assignment = $("public-identities-assignment");
  }

  function init() {
    cacheElements();
    bindEvents();
    loadRecords();
  }

  function destroy() {
    state.items = [];
    state.selectedKey = "";
    state.selectedAccount = null;
    state.accounts = [];
  }

  window.PublicIdentitiesView = { init, destroy };
})();

/* ======================================================================
   StreamSuites Dashboard - Studio closed-ALPHA access management view.
   ====================================================================== */

(() => {
  "use strict";

  const STUDIO_URL = "https://studio.streamsuites.app";
  const NOTE_LIMIT = 240;
  const state = {
    grants: [],
    summary: null,
    accounts: [],
    selectedAccountId: "",
    loading: false,
    accountsLoading: false,
    submitting: false,
    mounted: false,
    abortController: null,
    lastFocus: null,
    keydownHandler: null
  };

  const el = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function text(value, fallback = "—") {
    if (value === undefined || value === null) return fallback;
    const normalized = String(value).trim();
    return normalized || fallback;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function labelize(value) {
    return text(value, "Unknown")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function formatTimestamp(value) {
    const normalized = text(value, "");
    if (!normalized) return "—";
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return normalized;
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function badge(value, tone = "") {
    return `<span class="ss-badge${tone ? ` ${tone}` : ""}">${escapeHtml(labelize(value))}</span>`;
  }

  function toneForStatus(value) {
    const normalized = text(value, "").toLowerCase();
    if (["active", "enabled"].includes(normalized)) return "ss-badge-success";
    if (["revoked", "inactive", "suspended", "deleted"].includes(normalized)) return "ss-badge-danger";
    return "ss-badge-warning";
  }

  function extractAccountRows(payload) {
    if (Array.isArray(payload)) return payload;
    for (const key of ["users", "accounts", "items", "data"]) {
      if (Array.isArray(payload?.[key])) return payload[key];
    }
    return [];
  }

  function normalizeAccount(raw = {}) {
    const accountType = text(
      raw.account_type || raw.accountType || raw.access_class || raw.accessClass || raw.role || raw.account_role,
      "public"
    ).toLowerCase();
    const id = text(raw.internal_id || raw.internalId || raw.id || raw.uuid || raw.user_id || raw.userId, "");
    return {
      id,
      userCode: text(raw.user_code || raw.userCode || raw.code || raw.handle, ""),
      displayName: text(raw.display_name || raw.displayName || raw.name, ""),
      email: text(raw.email || raw.email_address, ""),
      accountType,
      role: text(raw.access_class || raw.accessClass || raw.role || raw.account_role || accountType, accountType),
      tier: text(raw.tier || raw.account_tier || raw.plan, "Core"),
      status: text(raw.account_status || raw.accountStatus || raw.status, "unknown").toLowerCase(),
      emailVerified: raw.email_verified === true || raw.emailVerified === true || raw.email_verified === 1 || raw.emailVerified === 1
    };
  }

  function activeCount() {
    return Number(state.summary?.active_invited_tester_count);
  }

  function testerLimit() {
    return Number(state.summary?.maximum_invited_tester_count);
  }

  function remainingSlots() {
    const count = activeCount();
    const limit = testerLimit();
    if (!Number.isFinite(count) || !Number.isFinite(limit)) return null;
    return Math.max(0, limit - count);
  }

  function isAtCapacity() {
    return remainingSlots() === 0;
  }

  function setRuntimeStatus(message, tone = "muted") {
    if (!el.runtimeStatus) return;
    el.runtimeStatus.textContent = message;
    el.runtimeStatus.className = `ss-chip ss-chip-${tone}`;
  }

  function setBanner(message, options = {}) {
    if (!el.banner) return;
    el.banner.textContent = message || "";
    el.banner.className = `ss-alert${options.tone ? ` ss-alert-${options.tone}` : ""}${message ? "" : " hidden"}`;
    if (message && options.toast !== false) {
      const toastTone = options.tone === "danger" ? "error" : options.tone || "warning";
      window.StreamSuitesToast?.[toastTone]?.(message, {
        key: options.key || "studio-access-state",
        title: options.title || "Studio access"
      });
    }
  }

  function clearBanner() {
    setBanner("", { toast: false });
    window.StreamSuitesToast?.dismiss?.("studio-access-state");
  }

  function updateSummary() {
    const count = activeCount();
    const limit = testerLimit();
    const remaining = remainingSlots();
    if (el.stage) el.stage.textContent = text(state.summary?.stage);
    if (el.activeCount) el.activeCount.textContent = Number.isFinite(count) ? String(count) : "—";
    if (el.limit) el.limit.textContent = Number.isFinite(limit) ? String(limit) : "—";
    if (el.remaining) el.remaining.textContent = Number.isFinite(remaining) ? String(remaining) : "—";
    if (el.addButton) {
      el.addButton.disabled = state.loading || state.submitting || isAtCapacity();
      el.addButton.title = isAtCapacity()
        ? "All invited tester slots are in use. Admin accounts remain automatically eligible."
        : "Select an existing account for Studio ALPHA access.";
    }
  }

  function grantSearchText(grant) {
    return [
      grant?.account_id,
      grant?.account?.id,
      grant?.account?.display_name,
      grant?.account?.user_code,
      grant?.account?.role,
      grant?.account?.tier,
      grant?.account?.account_status,
      grant?.note
    ].map((value) => text(value, "").toLowerCase()).join(" ");
  }

  function visibleGrants() {
    const query = text(el.search?.value, "").toLowerCase();
    const status = el.statusFilter?.value || "all";
    return state.grants.filter((grant) => {
      if (status === "active" && grant?.enabled !== true) return false;
      if (status === "revoked" && grant?.enabled === true) return false;
      return !query || grantSearchText(grant).includes(query);
    });
  }

  function administratorLabel(grant) {
    const actor = grant?.updated_by || grant?.granted_by || {};
    return text(actor.display_name || actor.user_code || actor.account_id || grant?.updated_by_account_id || grant?.granted_by_account_id);
  }

  function renderGrantRow(grant) {
    const account = grant?.account || {};
    const accountId = text(grant?.account_id || account.id, "");
    const enabled = grant?.enabled === true;
    const status = enabled ? "Active" : "Revoked";
    const timestamp = grant?.revoked_at || grant?.updated_at || grant?.granted_at;
    const action = enabled
      ? `<button type="button" class="ss-btn ss-btn-small ss-btn-danger" data-studio-action="revoke" data-account-id="${escapeHtml(accountId)}">Revoke</button>`
      : `<button type="button" class="ss-btn ss-btn-small ss-btn-primary" data-studio-action="reenable" data-account-id="${escapeHtml(accountId)}"${isAtCapacity() ? " disabled title=\"Tester cap reached\"" : ""}>Re-enable</button>`;
    return `
      <tr>
        <td><strong>${escapeHtml(text(account.display_name, "Unnamed account"))}</strong><small class="ss-studio-cell-secondary">${escapeHtml(text(account.user_code))}</small></td>
        <td><code class="ss-studio-account-id">${escapeHtml(accountId || "—")}</code></td>
        <td><div class="ss-studio-badge-row">${badge(account.role || "unknown")}${badge(account.tier || "unknown")}</div></td>
        <td>${badge(account.account_status || "unknown", toneForStatus(account.account_status))}</td>
        <td>${badge(status, toneForStatus(status))}</td>
        <td><span>${escapeHtml(formatTimestamp(grant?.granted_at))}</span><small class="ss-studio-cell-secondary">Updated ${escapeHtml(formatTimestamp(timestamp))}</small></td>
        <td>${escapeHtml(administratorLabel(grant))}</td>
        <td class="ss-studio-note-cell">${escapeHtml(text(grant?.note))}</td>
        <td class="align-right"><div class="ss-studio-row-actions">${action}</div></td>
      </tr>`;
  }

  function renderGrants() {
    if (!el.body || !el.empty) return;
    const rows = visibleGrants();
    el.body.innerHTML = rows.map(renderGrantRow).join("");
    el.empty.classList.toggle("hidden", rows.length > 0);
    if (rows.length === 0) {
      const filtered = state.grants.length > 0;
      el.empty.textContent = filtered
        ? "No Studio grants match the current search or status filter."
        : "No Studio grant records were returned. Admin accounts still receive automatic policy access.";
    }
    if (el.visibleCount) {
      el.visibleCount.textContent = `${rows.length} of ${state.grants.length} grant record${state.grants.length === 1 ? "" : "s"}`;
    }
  }

  function classifyError(error) {
    const status = Number(error?.status || 0);
    const code = text(error?.payload?.error_code, "");
    if (status === 401) return { kind: "session", message: "Your admin session is missing or expired. Sign in again to manage Studio access." };
    if (status === 403) return { kind: "forbidden", message: "This account is authenticated but is not authorized to manage Studio access." };
    const known = {
      studio_access_account_not_found: "The selected Runtime/Auth account no longer exists.",
      studio_access_grant_not_found: "The Studio access grant no longer exists. Refresh the list.",
      studio_access_account_ineligible: "The account is not eligible for Studio access. It may be suspended, inactive, deleted, or unverified.",
      studio_access_admin_automatic: "Admin accounts already receive Studio access automatically and do not consume tester slots.",
      studio_access_grant_already_exists: "A Studio access grant already exists for this account. Refresh the list to manage it.",
      studio_access_tester_limit_reached: "The active invited tester limit has been reached. Admin accounts remain automatically eligible.",
      studio_access_invalid_account_id: "Select a valid existing account.",
      studio_access_invalid_note: `The administrative note must be ${NOTE_LIMIT} characters or fewer.`
    };
    if (known[code]) return { kind: code, message: known[code] };
    if (status === 400) return { kind: "validation", message: text(error?.message, "Runtime/Auth rejected the submitted values.") };
    if (status >= 500 || status === 0 || error instanceof TypeError) {
      return { kind: "unavailable", message: "Runtime/Auth is unavailable. Studio access was not changed; retry when connectivity returns." };
    }
    return { kind: "request", message: text(error?.message, "Studio access request failed.") };
  }

  async function loadGrants(options = {}) {
    if (state.loading) return;
    state.loading = true;
    updateSummary();
    setRuntimeStatus(options.refresh ? "Refreshing Runtime/Auth…" : "Checking Runtime/Auth…", "muted");
    clearBanner();
    try {
      const payload = await window.StreamSuitesStudioAccessApi.getStudioAccess({ signal: state.abortController?.signal });
      if (!payload || !Array.isArray(payload.items) || !payload.summary) {
        throw Object.assign(new Error("Runtime/Auth returned an unsupported Studio access response."), { status: 502 });
      }
      state.grants = payload.items;
      state.summary = payload.summary;
      setRuntimeStatus("Runtime/Auth available", "success");
      if (el.lastRefresh) el.lastRefresh.textContent = `Last successful refresh: ${formatTimestamp(new Date().toISOString())}`;
      renderGrants();
    } catch (error) {
      if (error?.isAbort) return;
      const classified = classifyError(error);
      setRuntimeStatus(classified.kind === "forbidden" ? "Unauthorized" : classified.kind === "session" ? "Session expired" : "Runtime/Auth unavailable", "danger");
      setBanner(classified.message, { tone: "danger", key: "studio-access-state" });
      if (!state.summary) {
        state.grants = [];
        renderGrants();
      }
    } finally {
      state.loading = false;
      updateSummary();
    }
  }

  function existingGrantIds() {
    return new Set(state.grants.map((grant) => text(grant?.account_id || grant?.account?.id, "")).filter(Boolean));
  }

  function accountEligibility(account) {
    if (account.accountType === "admin" || account.role.toLowerCase() === "admin") return "Admin access is automatic";
    if (existingGrantIds().has(account.id)) return "Grant record already exists";
    if (account.status !== "active") return `Account is ${account.status || "ineligible"}`;
    if (!account.emailVerified) return "Email is not verified";
    return "";
  }

  function accountSearchText(account) {
    return [account.id, account.userCode, account.displayName, account.email, account.accountType, account.role, account.tier, account.status]
      .join(" ").toLowerCase();
  }

  function renderAccounts() {
    if (!el.accountResults) return;
    const query = text(el.accountSearch?.value, "").toLowerCase();
    const matches = state.accounts.filter((account) => !query || accountSearchText(account).includes(query)).slice(0, 50);
    el.accountResults.innerHTML = matches.map((account) => {
      const reason = accountEligibility(account);
      const selected = state.selectedAccountId === account.id;
      return `<button type="button" class="ss-studio-account-option${selected ? " is-selected" : ""}" role="option" aria-selected="${selected}" data-studio-account-id="${escapeHtml(account.id)}"${reason ? " disabled" : ""}>
        <span><strong>${escapeHtml(text(account.displayName, "Unnamed account"))}</strong><small>${escapeHtml(text(account.email || account.userCode))}</small></span>
        <span class="ss-studio-account-option-meta">${escapeHtml(labelize(account.accountType))} · ${escapeHtml(labelize(account.tier))} · ${escapeHtml(labelize(account.status))}${reason ? `<small>${escapeHtml(reason)}</small>` : ""}</span>
      </button>`;
    }).join("");
    if (el.accountStatus) {
      el.accountStatus.textContent = state.accountsLoading
        ? "Loading the authoritative account directory…"
        : `${matches.length} matching account${matches.length === 1 ? "" : "s"}; ineligible and existing-grant rows are disabled.`;
    }
  }

  function renderSelectedAccount() {
    const account = state.accounts.find((item) => item.id === state.selectedAccountId);
    if (!el.selectedAccount || !el.submitButton) return;
    el.selectedAccount.classList.toggle("hidden", !account);
    el.selectedAccount.innerHTML = account ? `
      <strong>${escapeHtml(text(account.displayName, account.userCode))}</strong>
      <code>${escapeHtml(account.id)}</code>
      <div class="ss-studio-badge-row">${badge(account.accountType)}${badge(account.role)}${badge(account.tier)}${badge(account.status, toneForStatus(account.status))}</div>` : "";
    el.submitButton.disabled = !account || state.submitting || isAtCapacity();
  }

  async function loadAccounts() {
    if (state.accountsLoading) return;
    state.accountsLoading = true;
    renderAccounts();
    try {
      const payload = await window.StreamSuitesStudioAccessApi.getAdminAccounts({ signal: state.abortController?.signal });
      const rows = extractAccountRows(payload);
      if (!Array.isArray(rows)) throw new Error("Runtime/Auth returned an unsupported account list.");
      state.accounts = rows.map(normalizeAccount).filter((account) => account.id);
    } catch (error) {
      const classified = classifyError(error);
      setBanner(`Account selection unavailable: ${classified.message}`, { tone: "danger", key: "studio-account-source" });
      if (el.accountStatus) el.accountStatus.textContent = "The Runtime/Auth account directory could not be loaded.";
    } finally {
      state.accountsLoading = false;
      renderAccounts();
    }
  }

  function openModal() {
    if (!el.modal || !el.backdrop || isAtCapacity()) return;
    state.lastFocus = document.activeElement;
    state.selectedAccountId = "";
    if (el.note) el.note.value = "";
    if (el.accountSearch) el.accountSearch.value = "";
    renderSelectedAccount();
    el.modal.classList.remove("hidden");
    el.backdrop.classList.remove("hidden");
    el.modal.setAttribute("aria-hidden", "false");
    el.backdrop.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      el.modal.classList.add("is-open");
      el.backdrop.classList.add("is-open");
      el.accountSearch?.focus();
    });
    void loadAccounts();
  }

  function closeModal() {
    if (!el.modal || !el.backdrop || state.submitting) return;
    el.modal.classList.remove("is-open");
    el.backdrop.classList.remove("is-open");
    el.modal.setAttribute("aria-hidden", "true");
    el.backdrop.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      el.modal?.classList.add("hidden");
      el.backdrop?.classList.add("hidden");
      if (state.lastFocus instanceof HTMLElement) state.lastFocus.focus({ preventScroll: true });
    }, 180);
  }

  async function submitGrant() {
    if (state.submitting || !state.selectedAccountId) return;
    state.submitting = true;
    renderSelectedAccount();
    try {
      await window.StreamSuitesStudioAccessApi.createStudioAccess(state.selectedAccountId, el.note?.value || "", { signal: state.abortController?.signal });
      window.StreamSuitesToast?.success?.("Studio ALPHA access was granted by Runtime/Auth.", { title: "Tester added" });
      state.submitting = false;
      closeModal();
      await loadGrants({ refresh: true });
    } catch (error) {
      const classified = classifyError(error);
      setBanner(classified.message, { tone: "danger", key: "studio-grant-failed" });
    } finally {
      state.submitting = false;
      renderSelectedAccount();
    }
  }

  async function changeGrant(accountId, action, button) {
    if (state.submitting || !accountId) return;
    if (action === "revoke") {
      const confirmed = window.confirm("Revoke this account's Studio ALPHA eligibility? This does not delete or suspend the account and does not change its role or tier.");
      if (!confirmed) return;
    }
    state.submitting = true;
    if (button) button.disabled = true;
    try {
      if (action === "revoke") {
        await window.StreamSuitesStudioAccessApi.revokeStudioAccess(accountId, { signal: state.abortController?.signal });
        window.StreamSuitesToast?.success?.("Studio ALPHA access was revoked by Runtime/Auth.", { title: "Access revoked" });
      } else {
        await window.StreamSuitesStudioAccessApi.updateStudioAccess(accountId, { enabled: true }, { signal: state.abortController?.signal });
        window.StreamSuitesToast?.success?.("Studio ALPHA access was re-enabled by Runtime/Auth.", { title: "Access re-enabled" });
      }
      await loadGrants({ refresh: true });
    } catch (error) {
      const classified = classifyError(error);
      setBanner(classified.message, { tone: "danger", key: `studio-${action}-failed` });
    } finally {
      state.submitting = false;
      renderGrants();
      updateSummary();
    }
  }

  function cacheElements() {
    Object.assign(el, {
      banner: byId("studio-banner"), runtimeStatus: byId("studio-runtime-status"), stage: byId("studio-stage"),
      activeCount: byId("studio-active-count"), limit: byId("studio-limit"), remaining: byId("studio-remaining"),
      lastRefresh: byId("studio-last-refresh"), refreshButton: byId("studio-refresh"), addButton: byId("studio-add-tester"),
      search: byId("studio-search"), statusFilter: byId("studio-status-filter"), visibleCount: byId("studio-visible-count"),
      body: byId("studio-grants-body"), empty: byId("studio-empty"), backdrop: byId("studio-modal-backdrop"),
      modal: byId("studio-add-modal"), modalClose: byId("studio-modal-close"), modalCancel: byId("studio-modal-cancel"),
      submitButton: byId("studio-modal-submit"), accountSearch: byId("studio-account-search"), accountStatus: byId("studio-account-status"),
      accountResults: byId("studio-account-results"), selectedAccount: byId("studio-selected-account"), note: byId("studio-note")
    });
  }

  function bindEvents() {
    el.refreshButton?.addEventListener("click", () => void loadGrants({ refresh: true }));
    el.addButton?.addEventListener("click", openModal);
    el.search?.addEventListener("input", renderGrants);
    el.statusFilter?.addEventListener("change", renderGrants);
    el.modalClose?.addEventListener("click", closeModal);
    el.modalCancel?.addEventListener("click", closeModal);
    el.backdrop?.addEventListener("click", closeModal);
    el.accountSearch?.addEventListener("input", renderAccounts);
    el.submitButton?.addEventListener("click", () => void submitGrant());
    el.accountResults?.addEventListener("click", (event) => {
      const option = event.target.closest("[data-studio-account-id]");
      if (!option || option.disabled) return;
      state.selectedAccountId = text(option.getAttribute("data-studio-account-id"), "");
      renderAccounts();
      renderSelectedAccount();
    });
    el.body?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-studio-action]");
      if (!button || button.disabled) return;
      void changeGrant(text(button.getAttribute("data-account-id"), ""), text(button.getAttribute("data-studio-action"), ""), button);
    });
    state.keydownHandler = (event) => {
      if (event.key === "Escape" && el.modal?.getAttribute("aria-hidden") === "false") closeModal();
    };
    window.addEventListener("keydown", state.keydownHandler);
  }

  async function init() {
    if (state.mounted && el.body?.isConnected) return;
    destroy();
    cacheElements();
    if (!el.body) return;
    state.mounted = true;
    state.abortController = new AbortController();
    state.grants = [];
    state.summary = null;
    state.accounts = [];
    state.selectedAccountId = "";
    bindEvents();
    renderGrants();
    updateSummary();
    await loadGrants();
  }

  function destroy() {
    state.mounted = false;
    state.abortController?.abort();
    state.abortController = null;
    if (state.keydownHandler) window.removeEventListener("keydown", state.keydownHandler);
    state.keydownHandler = null;
    state.loading = false;
    state.accountsLoading = false;
    state.submitting = false;
  }

  window.StudioAccessView = Object.freeze({
    init,
    destroy,
    refresh: () => loadGrants({ refresh: true }),
    classifyError,
    extractAccountRows,
    normalizeAccount,
    STUDIO_URL
  });

  function scheduleHydration() {
    window.setTimeout(() => {
      if (state.mounted) return;
      if (window.StreamSuitesAdminShell?.getCurrentView?.() !== "studio") return;
      if (!document.getElementById("studio-page-root")) return;
      void init();
    }, 0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleHydration, { once: true });
  } else {
    scheduleHydration();
  }
  window.addEventListener("streamsuites:view-hydration", (event) => {
    if (event?.detail?.view === "studio" && event?.detail?.loading !== true) scheduleHydration();
  });
  window.addEventListener("streamsuites:routechange", (event) => {
    if (event?.detail?.route?.view === "studio") scheduleHydration();
  });
})();

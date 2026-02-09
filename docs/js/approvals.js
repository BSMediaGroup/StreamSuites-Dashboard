/* ============================================================
   StreamSuites Dashboard — Approvals view (admin moderation)
   ============================================================ */

(() => {
  "use strict";

  const PENDING_REQUESTS_ENDPOINT = "/api/admin/approvals/requests";
  const APPROVE_ENDPOINT = (id) =>
    `/api/admin/approvals/requests/${encodeURIComponent(String(id || ""))}/approve`;
  const DENY_ENDPOINT = (id) =>
    `/api/admin/approvals/requests/${encodeURIComponent(String(id || ""))}/deny`;
  const PUBLIC_REQUESTS_ENDPOINT = "/api/public/requests";
  const IMPLEMENTED_ENDPOINT = (id) =>
    `/api/admin/requests/${encodeURIComponent(String(id || ""))}/implemented`;

  const PENDING_TERMINAL_STATUSES = new Set([
    "approved",
    "denied",
    "rejected",
    "implemented",
    "closed"
  ]);
  const APPROVED_STATUSES = new Set(["approved", "implemented", "live"]);

  const state = {
    pending: [],
    approved: [],
    pendingUi: new Map(),
    approvedUi: new Map(),
    notes: new Map(),
    adminAccessDenied: false,
    loadingPending: false,
    loadingApproved: false,
    viewToken: 0,
    listeners: []
  };

  const el = {
    adminError: null,
    pendingStatus: null,
    pendingCount: null,
    pendingList: null,
    pendingEmpty: null,
    approvedStatus: null,
    approvedCount: null,
    approvedList: null,
    approvedEmpty: null,
    refreshPending: null,
    refreshApproved: null
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
    if (typeof path !== "string" || !path.trim()) return path;
    if (/^https?:\/\//i.test(path)) return path;
    const base = resolveApiBase();
    if (!base) return path;
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalized}`;
  }

  function parseBoolean(value) {
    if (value === true || value === false) return value;
    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "implemented", "approved"].includes(normalized)) return true;
      if (["false", "0", "no", "not_implemented"].includes(normalized)) return false;
    }
    return null;
  }

  function normalizeStatus(value) {
    if (value === undefined || value === null) return "";
    return String(value).trim().toLowerCase();
  }

  function readText(value) {
    if (value === undefined || value === null) return "";
    return String(value).trim();
  }

  function readCreatorName(raw = {}) {
    const creator =
      raw.creator ||
      raw.creator_profile ||
      raw.creatorProfile ||
      raw.submitter ||
      raw.user ||
      raw.author ||
      {};

    const direct =
      raw.creator_display_name ||
      raw.creatorDisplayName ||
      raw.creator_name ||
      raw.creatorName ||
      raw.display_name ||
      raw.displayName ||
      raw.user_name ||
      raw.userName ||
      raw.author_name ||
      raw.authorName ||
      raw.username ||
      raw.handle ||
      "";
    if (readText(direct)) return readText(direct);

    if (creator && typeof creator === "object") {
      const nested =
        creator.display_name ||
        creator.displayName ||
        creator.name ||
        creator.username ||
        creator.user_name ||
        creator.userName ||
        creator.handle ||
        "";
      if (readText(nested)) return readText(nested);
    }

    return "Unknown creator";
  }

  function normalizeRequest(raw = {}) {
    const id =
      raw.id ||
      raw.request_id ||
      raw.requestId ||
      raw.feature_request_id ||
      raw.featureRequestId ||
      raw.uuid ||
      "";
    const status = normalizeStatus(raw.status || raw.moderation_status || raw.moderationStatus);
    const approved =
      parseBoolean(raw.approved ?? raw.is_approved ?? raw.isApproved ?? raw.moderated) ||
      APPROVED_STATUSES.has(status);
    const implementedRaw = parseBoolean(
      raw.implemented ?? raw.is_implemented ?? raw.isImplemented
    );

    return {
      id: readText(id),
      title: readText(raw.title || raw.request_title || raw.requestTitle || "Untitled request"),
      body: readText(
        raw.body ||
          raw.description ||
          raw.content ||
          raw.request_body ||
          raw.requestBody ||
          raw.details ||
          ""
      ),
      creatorDisplayName: readCreatorName(raw),
      submittedAt: readText(
        raw.submitted_at ||
          raw.submittedAt ||
          raw.created_at ||
          raw.createdAt ||
          raw.timestamp ||
          raw.requested_at ||
          raw.requestedAt ||
          ""
      ),
      status,
      approved: approved === true,
      implemented: implementedRaw === true
    };
  }

  function extractRequests(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.requests)) return payload.requests;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.results)) return payload.results;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.data?.requests)) return payload.data.requests;
    if (Array.isArray(payload.data?.items)) return payload.data.items;
    return [];
  }

  function isPendingRequest(request) {
    if (!request || !request.id) return false;
    if (request.approved) return false;
    if (!request.status) return true;
    return !PENDING_TERMINAL_STATUSES.has(request.status);
  }

  function isApprovedRequest(request) {
    if (!request || !request.id) return false;
    if (request.approved) return true;
    if (!request.status) return false;
    return APPROVED_STATUSES.has(request.status);
  }

  function sortByNewest(items) {
    return items.sort((a, b) => {
      const left = a?.submittedAt ? Date.parse(String(a.submittedAt)) : Number.NaN;
      const right = b?.submittedAt ? Date.parse(String(b.submittedAt)) : Number.NaN;
      if (!Number.isNaN(left) && !Number.isNaN(right) && left !== right) return right - left;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });
  }

  function formatTimestamp(value) {
    if (typeof window.StreamSuitesState?.formatTimestamp === "function") {
      return window.StreamSuitesState.formatTimestamp(value) || "—";
    }
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return escapeHtml(value);
    return parsed.toISOString().replace("T", " ").replace("Z", " UTC");
  }

  async function fetchJson(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const mergedHeaders = {
      Accept: "application/json",
      ...(options.headers || {})
    };

    try {
      return await fetch(buildApiUrl(path), {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        ...options,
        headers: mergedHeaders,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function readErrorMessage(response) {
    if (!response) return "";
    const contentType = response.headers?.get("content-type") || "";
    try {
      if (contentType.includes("application/json")) {
        const payload = await response.json();
        if (typeof payload?.message === "string" && payload.message.trim()) return payload.message;
        if (typeof payload?.error === "string" && payload.error.trim()) return payload.error;
      }
      const text = await response.text();
      return text.trim();
    } catch (error) {
      return "";
    }
  }

  function setAdminErrorVisible(visible) {
    state.adminAccessDenied = visible === true;
    if (el.adminError) {
      el.adminError.classList.toggle("hidden", !state.adminAccessDenied);
      el.adminError.textContent = "Admin access required.";
    }
  }

  function setPendingStatus(message) {
    if (el.pendingStatus) el.pendingStatus.textContent = message;
  }

  function setApprovedStatus(message) {
    if (el.approvedStatus) el.approvedStatus.textContent = message;
  }

  function getPendingUi(requestId) {
    const key = String(requestId || "");
    if (!state.pendingUi.has(key)) {
      state.pendingUi.set(key, { busy: false, action: "", error: "", message: "" });
    }
    return state.pendingUi.get(key);
  }

  function getApprovedUi(requestId) {
    const key = String(requestId || "");
    if (!state.approvedUi.has(key)) {
      state.approvedUi.set(key, { busy: false, error: "", message: "" });
    }
    return state.approvedUi.get(key);
  }

  function renderPendingList() {
    if (!el.pendingList || !el.pendingEmpty) return;

    const items = state.pending.slice();
    if (el.pendingCount) {
      el.pendingCount.textContent = String(items.length);
    }

    if (!items.length) {
      el.pendingList.innerHTML = "";
      el.pendingEmpty.classList.remove("hidden");
      return;
    }

    el.pendingEmpty.classList.add("hidden");
    el.pendingList.innerHTML = items
      .map((request) => {
        const requestId = String(request.id || "");
        const ui = getPendingUi(requestId);
        const noteValue = state.notes.get(requestId) || "";
        const approveLabel = ui.busy && ui.action === "approve" ? "Approving..." : "Approve";
        const denyLabel = ui.busy && ui.action === "deny" ? "Denying..." : "Deny";
        const disabledAttr = ui.busy || state.adminAccessDenied ? " disabled" : "";
        const inlineClass = ui.error ? "ss-approvals-inline ss-approvals-inline-error" : "ss-approvals-inline muted";
        const inlineText = ui.error || ui.message || "";

        return `
          <article class="ss-approvals-request" data-request-id="${escapeHtml(requestId)}">
            <div class="ss-approvals-request-head">
              <h3>${escapeHtml(request.title || "Untitled request")}</h3>
              <div class="ss-approvals-meta">
                <span><strong>Creator:</strong> ${escapeHtml(request.creatorDisplayName || "Unknown creator")}</span>
                <span><strong>Submitted:</strong> ${escapeHtml(formatTimestamp(request.submittedAt))}</span>
              </div>
            </div>
            <div class="ss-approvals-body">${escapeHtml(request.body || "No request details provided.")}</div>
            <div class="ss-form-row ss-approvals-notes-row">
              <label for="approvals-note-${escapeHtml(requestId)}">Moderation notes (optional)</label>
              <textarea
                id="approvals-note-${escapeHtml(requestId)}"
                class="ss-approvals-notes"
                data-note-id="${escapeHtml(requestId)}"
                rows="3"
                placeholder="Add deny reason or internal moderation notes"
                ${disabledAttr}
              >${escapeHtml(noteValue)}</textarea>
            </div>
            <div class="ss-approvals-actions">
              <button
                class="ss-btn ss-btn-primary"
                type="button"
                data-approvals-action="approve"
                data-request-id="${escapeHtml(requestId)}"
                ${disabledAttr}
              >
                ${escapeHtml(approveLabel)}
              </button>
              <button
                class="ss-btn ss-btn-danger"
                type="button"
                data-approvals-action="deny"
                data-request-id="${escapeHtml(requestId)}"
                ${disabledAttr}
              >
                ${escapeHtml(denyLabel)}
              </button>
            </div>
            <div class="${inlineClass}">${escapeHtml(inlineText)}</div>
          </article>
        `;
      })
      .join("");
  }

  function renderApprovedList() {
    if (!el.approvedList || !el.approvedEmpty) return;

    const items = state.approved.slice();
    if (el.approvedCount) {
      el.approvedCount.textContent = String(items.length);
    }

    if (!items.length) {
      el.approvedList.innerHTML = "";
      el.approvedEmpty.classList.remove("hidden");
      return;
    }

    el.approvedEmpty.classList.add("hidden");
    el.approvedList.innerHTML = items
      .map((request) => {
        const requestId = String(request.id || "");
        const ui = getApprovedUi(requestId);
        const disabledAttr = ui.busy || state.adminAccessDenied ? " disabled" : "";
        const nextLabel = request.implemented ? "Unmark implemented" : "Mark implemented";
        const buttonLabel = ui.busy ? "Saving..." : nextLabel;
        const badgeClass = request.implemented ? "ss-badge ss-badge-success" : "ss-badge ss-badge-warning";
        const badgeLabel = request.implemented ? "Implemented" : "Not Implemented";
        const inlineClass = ui.error ? "ss-approvals-inline ss-approvals-inline-error" : "ss-approvals-inline muted";
        const inlineText = ui.error || ui.message || "";

        return `
          <article class="ss-approvals-request ss-approvals-request-approved" data-request-id="${escapeHtml(requestId)}">
            <div class="ss-approvals-request-head">
              <h3>${escapeHtml(request.title || "Untitled request")}</h3>
              <div class="ss-approvals-meta">
                <span><strong>Creator:</strong> ${escapeHtml(request.creatorDisplayName || "Unknown creator")}</span>
                <span><strong>Submitted:</strong> ${escapeHtml(formatTimestamp(request.submittedAt))}</span>
              </div>
            </div>
            <div class="ss-approvals-actions">
              <span class="${badgeClass}">${escapeHtml(badgeLabel)}</span>
              <button
                class="ss-btn ss-btn-secondary"
                type="button"
                data-approvals-action="toggle-implemented"
                data-request-id="${escapeHtml(requestId)}"
                ${disabledAttr}
              >
                ${escapeHtml(buttonLabel)}
              </button>
            </div>
            <div class="${inlineClass}">${escapeHtml(inlineText)}</div>
          </article>
        `;
      })
      .join("");
  }

  function pruneTransientState() {
    const pendingIds = new Set(state.pending.map((item) => String(item.id || "")));
    const approvedIds = new Set(state.approved.map((item) => String(item.id || "")));

    Array.from(state.pendingUi.keys()).forEach((id) => {
      if (!pendingIds.has(id)) state.pendingUi.delete(id);
    });
    Array.from(state.approvedUi.keys()).forEach((id) => {
      if (!approvedIds.has(id)) state.approvedUi.delete(id);
    });
    Array.from(state.notes.keys()).forEach((id) => {
      if (!pendingIds.has(id)) state.notes.delete(id);
    });
  }

  async function loadPendingRequests() {
    if (state.loadingPending) return;
    const token = state.viewToken;
    state.loadingPending = true;
    setPendingStatus("Loading pending requests...");

    try {
      const response = await fetchJson(PENDING_REQUESTS_ENDPOINT, { method: "GET" });
      if (token !== state.viewToken) return;

      if (response.status === 401 || response.status === 403) {
        state.pending = [];
        setAdminErrorVisible(true);
        setPendingStatus("Admin access required.");
        pruneTransientState();
        renderPendingList();
        return;
      }

      if (!response.ok) {
        const detail = await readErrorMessage(response);
        throw new Error(detail || `Request failed (${response.status})`);
      }

      const payload = await response.json().catch(() => null);
      const requests = sortByNewest(
        extractRequests(payload).map(normalizeRequest).filter(isPendingRequest)
      );
      state.pending = requests;
      setAdminErrorVisible(false);
      setPendingStatus(requests.length ? "Pending queue loaded." : "No pending requests.");
      pruneTransientState();
      renderPendingList();
    } catch (error) {
      if (token !== state.viewToken) return;
      console.warn("[Approvals] Failed to load pending requests", error);
      state.pending = [];
      setPendingStatus("Failed to load pending requests. Retry.");
      pruneTransientState();
      renderPendingList();
    } finally {
      if (token === state.viewToken) {
        state.loadingPending = false;
      }
    }
  }

  async function loadApprovedRequests() {
    if (state.loadingApproved) return;
    const token = state.viewToken;
    state.loadingApproved = true;
    setApprovedStatus("Loading approved requests...");

    try {
      const response = await fetchJson(PUBLIC_REQUESTS_ENDPOINT, { method: "GET" });
      if (token !== state.viewToken) return;

      if (!response.ok) {
        const detail = await readErrorMessage(response);
        throw new Error(detail || `Request failed (${response.status})`);
      }

      const payload = await response.json().catch(() => null);
      const requests = sortByNewest(
        extractRequests(payload).map(normalizeRequest).filter(isApprovedRequest)
      );
      state.approved = requests;
      setApprovedStatus(requests.length ? "Approved requests loaded." : "No approved requests.");
      pruneTransientState();
      renderApprovedList();
    } catch (error) {
      if (token !== state.viewToken) return;
      console.warn("[Approvals] Failed to load approved requests", error);
      state.approved = [];
      setApprovedStatus("Failed to load approved requests. Retry.");
      pruneTransientState();
      renderApprovedList();
    } finally {
      if (token === state.viewToken) {
        state.loadingApproved = false;
      }
    }
  }

  function mergeApprovedRequest(requestId, fallbackRequest, payload) {
    const parsed = normalizeRequest(payload?.request || payload?.data || payload || {});
    const fallback = fallbackRequest || {};
    const merged = {
      ...fallback,
      ...parsed,
      id: String(requestId || parsed.id || fallback.id || ""),
      approved: true,
      status: parsed.status || fallback.status || "approved",
      implemented:
        typeof parsed.implemented === "boolean" ? parsed.implemented : Boolean(fallback.implemented)
    };

    const idx = state.approved.findIndex((item) => item.id === merged.id);
    if (idx >= 0) {
      state.approved[idx] = { ...state.approved[idx], ...merged };
    } else {
      state.approved.unshift(merged);
    }
  }

  async function handlePendingAction(requestId, action) {
    const id = String(requestId || "");
    if (!id || (action !== "approve" && action !== "deny")) return;
    if (state.adminAccessDenied) return;

    const request = state.pending.find((item) => item.id === id);
    if (!request) return;

    const ui = getPendingUi(id);
    if (ui.busy) return;

    ui.busy = true;
    ui.action = action;
    ui.error = "";
    ui.message = action === "approve" ? "Approving request..." : "Denying request...";
    renderPendingList();

    const note = readText(state.notes.get(id));
    const endpoint = action === "approve" ? APPROVE_ENDPOINT(id) : DENY_ENDPOINT(id);
    const body =
      action === "deny" && note
        ? JSON.stringify({ deny_reason: note, moderation_notes: note })
        : null;

    try {
      const response = await fetchJson(endpoint, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body || undefined
      });

      if (response.status === 401 || response.status === 403) {
        ui.busy = false;
        ui.action = "";
        ui.error = "Admin access required.";
        ui.message = "";
        setAdminErrorVisible(true);
        setPendingStatus("Admin access required.");
        renderPendingList();
        return;
      }

      if (!response.ok) {
        const detail = await readErrorMessage(response);
        ui.busy = false;
        ui.action = "";
        ui.error = detail ? `Action failed: ${detail}` : "Action failed.";
        ui.message = "";
        renderPendingList();
        return;
      }

      let payload = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      if (action === "approve") {
        mergeApprovedRequest(id, request, payload);
        setApprovedStatus("Approved request updated.");
        renderApprovedList();
      }

      state.pending = state.pending.filter((item) => item.id !== id);
      state.notes.delete(id);
      state.pendingUi.delete(id);
      pruneTransientState();
      renderPendingList();
      setPendingStatus(action === "approve" ? "Request approved." : "Request denied.");
    } catch (error) {
      console.warn(`[Approvals] ${action} request failed`, error);
      ui.busy = false;
      ui.action = "";
      ui.error = "Action failed. Retry.";
      ui.message = "";
      renderPendingList();
    }
  }

  async function handleImplementedToggle(requestId) {
    const id = String(requestId || "");
    if (!id || state.adminAccessDenied) return;

    const request = state.approved.find((item) => item.id === id);
    if (!request) return;

    const ui = getApprovedUi(id);
    if (ui.busy) return;

    const nextImplemented = !request.implemented;
    ui.busy = true;
    ui.error = "";
    ui.message = nextImplemented ? "Marking implemented..." : "Unmarking implemented...";
    renderApprovedList();

    try {
      const response = await fetchJson(IMPLEMENTED_ENDPOINT(id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ implemented: nextImplemented })
      });

      if (response.status === 401 || response.status === 403) {
        ui.busy = false;
        ui.error = "Admin access required.";
        ui.message = "";
        setAdminErrorVisible(true);
        setApprovedStatus("Admin access required.");
        renderApprovedList();
        return;
      }

      if (!response.ok) {
        const detail = await readErrorMessage(response);
        ui.busy = false;
        ui.error = detail ? `Action failed: ${detail}` : "Action failed.";
        ui.message = "";
        renderApprovedList();
        return;
      }

      let payload = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      const normalized = normalizeRequest(payload?.request || payload?.data || payload || {});
      request.implemented =
        typeof normalized.implemented === "boolean" ? normalized.implemented : nextImplemented;
      if (normalized.status) {
        request.status = normalized.status;
      }

      ui.busy = false;
      ui.error = "";
      ui.message = request.implemented ? "Marked implemented." : "Marked not implemented.";
      setApprovedStatus("Approved request updated.");
      renderApprovedList();
    } catch (error) {
      console.warn("[Approvals] Failed to toggle implemented status", error);
      ui.busy = false;
      ui.error = "Action failed. Retry.";
      ui.message = "";
      renderApprovedList();
    }
  }

  function bindEvent(target, eventName, handler) {
    if (!target || typeof target.addEventListener !== "function") return;
    target.addEventListener(eventName, handler);
    state.listeners.push(() => target.removeEventListener(eventName, handler));
  }

  function bindEvents() {
    bindEvent(el.refreshPending, "click", () => {
      void loadPendingRequests();
    });

    bindEvent(el.refreshApproved, "click", () => {
      void loadApprovedRequests();
    });

    bindEvent(el.pendingList, "input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement)) return;
      const requestId = target.getAttribute("data-note-id") || "";
      if (!requestId) return;
      state.notes.set(String(requestId), target.value || "");
    });

    bindEvent(el.pendingList, "click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button[data-approvals-action]");
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;
      const action = button.getAttribute("data-approvals-action") || "";
      const requestId = button.getAttribute("data-request-id") || "";
      if (!requestId) return;
      void handlePendingAction(requestId, action);
    });

    bindEvent(el.approvedList, "click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button[data-approvals-action='toggle-implemented']");
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;
      const requestId = button.getAttribute("data-request-id") || "";
      if (!requestId) return;
      void handleImplementedToggle(requestId);
    });
  }

  function cacheElements() {
    el.adminError = $("approvals-admin-error");
    el.pendingStatus = $("approvals-pending-status");
    el.pendingCount = $("approvals-pending-count");
    el.pendingList = $("approvals-pending-list");
    el.pendingEmpty = $("approvals-pending-empty");
    el.approvedStatus = $("approvals-approved-status");
    el.approvedCount = $("approvals-approved-count");
    el.approvedList = $("approvals-approved-list");
    el.approvedEmpty = $("approvals-approved-empty");
    el.refreshPending = $("approvals-refresh-pending");
    el.refreshApproved = $("approvals-refresh-approved");
  }

  function resetState() {
    state.pending = [];
    state.approved = [];
    state.pendingUi.clear();
    state.approvedUi.clear();
    state.notes.clear();
    state.adminAccessDenied = false;
    state.loadingPending = false;
    state.loadingApproved = false;
    setAdminErrorVisible(false);
  }

  function removeListeners() {
    state.listeners.splice(0).forEach((remove) => {
      try {
        remove();
      } catch (error) {
        // Ignore stale listener detach failures.
      }
    });
  }

  function hasViewElements() {
    return Boolean(
      el.pendingStatus &&
        el.pendingCount &&
        el.pendingList &&
        el.pendingEmpty &&
        el.approvedStatus &&
        el.approvedCount &&
        el.approvedList &&
        el.approvedEmpty
    );
  }

  async function init() {
    state.viewToken += 1;
    removeListeners();
    cacheElements();
    if (!hasViewElements()) return;

    resetState();
    setPendingStatus("Loading pending requests...");
    setApprovedStatus("Loading approved requests...");
    if (el.pendingCount) el.pendingCount.textContent = "—";
    if (el.approvedCount) el.approvedCount.textContent = "—";
    renderPendingList();
    renderApprovedList();

    bindEvents();
    await Promise.all([loadPendingRequests(), loadApprovedRequests()]);
  }

  function destroy() {
    state.viewToken += 1;
    removeListeners();
    state.loadingPending = false;
    state.loadingApproved = false;
  }

  window.ApprovalsView = {
    init,
    destroy
  };
})();

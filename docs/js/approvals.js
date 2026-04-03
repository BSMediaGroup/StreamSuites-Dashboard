(() => {
  "use strict";

  const PENDING = "/api/admin/approvals/requests";
  const APPROVE = (id) => `/api/admin/approvals/requests/${encodeURIComponent(id)}/approve`;
  const DENY = (id) => `/api/admin/approvals/requests/${encodeURIComponent(id)}/deny`;
  const APPROVED = "/api/public/requests";
  const IMPLEMENTED = (id) => `/api/admin/requests/${encodeURIComponent(id)}/implemented`;
  const INTAKES = {
    feedback: { list: "/api/admin/intake/feedback", detail: "/api/admin/intake/feedback/" },
    beta: { list: "/api/admin/intake/beta", detail: "/api/admin/intake/beta/" },
    reports: { list: "/api/admin/intake/reports", detail: "/api/admin/intake/reports/" }
  };

  const PENDING_TERMINAL = new Set(["approved", "denied", "rejected", "implemented", "closed"]);
  const APPROVED_STATES = new Set(["approved", "implemented", "live"]);

  const state = {
    pending: [],
    approved: [],
    notes: new Map(),
    pendingUi: new Map(),
    approvedUi: new Map(),
    intakes: {
      feedback: { items: [], detail: null },
      beta: { items: [], detail: null },
      reports: { items: [], detail: null }
    },
    listeners: [],
    token: 0,
    denied: false
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
    refreshApproved: null,
    overviewFeedbackCount: null,
    overviewBetaCount: null,
    overviewReportsCount: null,
    intake: { feedback: {}, beta: {}, reports: {} }
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

  function text(value) {
    return value === undefined || value === null ? "" : String(value).trim();
  }

  function lower(value) {
    return text(value).toLowerCase();
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

  function formatTime(value) {
    if (typeof window.StreamSuitesState?.formatTimestamp === "function") {
      return window.StreamSuitesState.formatTimestamp(value) || "—";
    }
    if (!value) return "—";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? escapeHtml(value)
      : parsed.toISOString().replace("T", " ").replace("Z", " UTC");
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      return await fetch(apiUrl(path), {
        cache: "no-store",
        credentials: "include",
        method: "GET",
        ...options,
        headers: { Accept: "application/json", ...(options.headers || {}) },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function errorText(response) {
    const type = response.headers?.get("content-type") || "";
    try {
      if (type.includes("application/json")) {
        const payload = await response.json();
        return payload?.message || payload?.error || "";
      }
      return await response.text();
    } catch {
      return "";
    }
  }

  function setDenied(visible) {
    state.denied = visible === true;
    if (el.adminError) el.adminError.classList.toggle("hidden", !state.denied);
  }

  function countOverview() {
    if (el.overviewFeedbackCount) el.overviewFeedbackCount.textContent = String(state.intakes.feedback.items.length);
    if (el.overviewBetaCount) el.overviewBetaCount.textContent = String(state.intakes.beta.items.length);
    if (el.overviewReportsCount) el.overviewReportsCount.textContent = String(state.intakes.reports.items.length);
  }

  function normalizeRequest(raw = {}) {
    const status = lower(raw.status || raw.moderation_status);
    const approved = raw.approved === true || raw.is_approved === true || APPROVED_STATES.has(status);
    return {
      id: text(raw.id || raw.request_id || raw.uuid),
      title: text(raw.title || raw.request_title) || "Untitled request",
      body: text(raw.body || raw.description || raw.request_body || raw.details),
      creator: text(raw.creator_display_name || raw.display_name || raw.username || raw.creator?.display_name) || "Unknown creator",
      submittedAt: text(raw.submitted_at || raw.created_at || raw.timestamp),
      status,
      approved,
      implemented: raw.implemented === true || raw.is_implemented === true
    };
  }

  function extractRequests(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.requests)) return payload.requests;
    if (Array.isArray(payload?.data?.items)) return payload.data.items;
    return [];
  }

  function sortNewest(items, key) {
    return items.sort((a, b) => {
      const left = Date.parse(String(a?.[key] || ""));
      const right = Date.parse(String(b?.[key] || ""));
      if (!Number.isNaN(left) && !Number.isNaN(right) && left !== right) return right - left;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });
  }

  function renderPending() {
    const items = state.pending.slice();
    if (el.pendingCount) el.pendingCount.textContent = String(items.length);
    if (!items.length) {
      el.pendingList.innerHTML = "";
      el.pendingEmpty.classList.remove("hidden");
      return;
    }
    el.pendingEmpty.classList.add("hidden");
    el.pendingList.innerHTML = items
      .map((item) => {
        const ui = state.pendingUi.get(item.id) || {};
        const note = state.notes.get(item.id) || "";
        const disabled = ui.busy || state.denied ? " disabled" : "";
        const inlineClass = ui.error ? "ss-approvals-inline ss-approvals-inline-error" : "ss-approvals-inline muted";
        return `
          <article class="ss-approvals-request">
            <div class="ss-approvals-request-head">
              <h3>${escapeHtml(item.title)}</h3>
              <div class="ss-approvals-meta">
                <span><strong>Creator:</strong> ${escapeHtml(item.creator)}</span>
                <span><strong>Submitted:</strong> ${escapeHtml(formatTime(item.submittedAt))}</span>
              </div>
            </div>
            <div class="ss-approvals-body">${escapeHtml(item.body || "No request details provided.")}</div>
            <div class="ss-form-row ss-approvals-notes-row">
              <label for="approvals-note-${escapeHtml(item.id)}">Moderation notes (optional)</label>
              <textarea id="approvals-note-${escapeHtml(item.id)}" class="ss-approvals-notes" data-note-id="${escapeHtml(item.id)}" rows="3" ${disabled}>${escapeHtml(note)}</textarea>
            </div>
            <div class="ss-approvals-actions">
              <button class="ss-btn ss-btn-primary" type="button" data-action="approve" data-request-id="${escapeHtml(item.id)}" ${disabled}>${ui.busy && ui.action === "approve" ? "Approving..." : "Approve"}</button>
              <button class="ss-btn ss-btn-danger" type="button" data-action="deny" data-request-id="${escapeHtml(item.id)}" ${disabled}>${ui.busy && ui.action === "deny" ? "Denying..." : "Deny"}</button>
            </div>
            <div class="${inlineClass}">${escapeHtml(ui.error || ui.message || "")}</div>
          </article>
        `;
      })
      .join("");
  }

  function renderApproved() {
    const items = state.approved.slice();
    if (el.approvedCount) el.approvedCount.textContent = String(items.length);
    if (!items.length) {
      el.approvedList.innerHTML = "";
      el.approvedEmpty.classList.remove("hidden");
      return;
    }
    el.approvedEmpty.classList.add("hidden");
    el.approvedList.innerHTML = items
      .map((item) => {
        const ui = state.approvedUi.get(item.id) || {};
        const disabled = ui.busy || state.denied ? " disabled" : "";
        const inlineClass = ui.error ? "ss-approvals-inline ss-approvals-inline-error" : "ss-approvals-inline muted";
        return `
          <article class="ss-approvals-request ss-approvals-request-approved">
            <div class="ss-approvals-request-head">
              <h3>${escapeHtml(item.title)}</h3>
              <div class="ss-approvals-meta">
                <span><strong>Creator:</strong> ${escapeHtml(item.creator)}</span>
                <span><strong>Submitted:</strong> ${escapeHtml(formatTime(item.submittedAt))}</span>
              </div>
            </div>
            <div class="ss-approvals-actions">
              <span class="${item.implemented ? "ss-badge ss-badge-success" : "ss-badge ss-badge-warning"}">${item.implemented ? "Implemented" : "Not Implemented"}</span>
              <button class="ss-btn ss-btn-secondary" type="button" data-toggle-implemented="${escapeHtml(item.id)}" ${disabled}>${ui.busy ? "Saving..." : item.implemented ? "Unmark implemented" : "Mark implemented"}</button>
            </div>
            <div class="${inlineClass}">${escapeHtml(ui.error || ui.message || "")}</div>
          </article>
        `;
      })
      .join("");
  }

  function normalizeSubmission(kind, raw = {}) {
    const submitter = raw.submitter || {};
    const contact = raw.contact || {};
    return {
      id: text(raw.id),
      kind,
      title: text(raw.title) || (kind === "beta" ? text(contact.name) || "Beta application" : "Untitled submission"),
      summary: text(raw.summary || raw.body || raw.beta_motivation || raw.actual_result),
      status: lower(raw.status || "submitted"),
      createdAt: text(raw.created_at),
      updatedAt: text(raw.updated_at),
      submitterName: text(submitter.display_name || contact.name || submitter.email) || "Unknown",
      submitterEmail: text(contact.email || submitter.email),
      authenticated: !!submitter.authenticated,
      developerCapable: !!submitter.developer_capable,
      artifactCount: Number(raw.artifact_count || 0),
      feedbackType: text(raw.feedback_type),
      category: text(raw.category),
      severity: text(raw.severity),
      affectedArea: text(raw.affected_area),
      body: text(raw.body),
      betaMotivation: text(raw.beta_motivation),
      experienceSummary: text(raw.experience_summary),
      testingEnvironment: text(raw.testing_environment),
      reproductionSteps: text(raw.reproduction_steps),
      expectedResult: text(raw.expected_result),
      actualResult: text(raw.actual_result),
      environmentDetails: text(raw.environment_details),
      platformDetails: text(raw.platform_details),
      accountContext: text(raw.account_context),
      extraMetadata: raw.extra_metadata && typeof raw.extra_metadata === "object" ? raw.extra_metadata : {},
      artifacts: Array.isArray(raw.artifacts) ? raw.artifacts : []
    };
  }

  function renderArtifacts(artifacts) {
    if (!artifacts.length) return `<div class="ss-empty">No artifacts attached.</div>`;
    return artifacts
      .map((artifact) => {
        const download = text(artifact.download_url);
        return `
          <article class="ss-approvals-request">
            <div class="ss-approvals-request-head">
              <h3>${escapeHtml(text(artifact.download_filename) || "artifact.bin")}</h3>
              <div class="ss-approvals-meta">
                <span><strong>MIME:</strong> ${escapeHtml(text(artifact.mime_type) || "application/octet-stream")}</span>
                <span><strong>Size:</strong> ${escapeHtml(String(Number(artifact.size_bytes || 0)))} bytes</span>
                <span><strong>Uploaded:</strong> ${escapeHtml(formatTime(artifact.uploaded_at))}</span>
              </div>
            </div>
            ${download ? `<div class="ss-approvals-actions"><a class="ss-btn ss-btn-secondary" href="${escapeHtml(download)}">Download</a></div>` : ""}
          </article>
        `;
      })
      .join("");
  }

  function detailBlock(label, value) {
    const safe = text(value);
    if (!safe) return "";
    return `<div class="ss-approvals-body"><strong>${escapeHtml(label)}</strong><br />${escapeHtml(safe)}</div>`;
  }

  function metaLine(label, value) {
    const safe = text(value);
    return safe ? `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(safe)}</div>` : "";
  }

  function renderIntake(kind) {
    const bucket = state.intakes[kind];
    const ui = el.intake[kind];
    if (ui.count) ui.count.textContent = String(bucket.items.length);
    if (!bucket.items.length) {
      ui.list.innerHTML = "";
      ui.empty.classList.remove("hidden");
      ui.detail.innerHTML = `Select an item to inspect detail.`;
      countOverview();
      return;
    }
    ui.empty.classList.add("hidden");
    ui.list.innerHTML = bucket.items
      .map((item) => `
        <article class="ss-approvals-request${bucket.detail?.id === item.id ? " ss-approvals-request-approved" : ""}">
          <div class="ss-approvals-request-head">
            <h3>${escapeHtml(item.title)}</h3>
            <div class="ss-approvals-meta">
              <span><strong>Status:</strong> ${escapeHtml(item.status || "submitted")}</span>
              <span><strong>Submitted:</strong> ${escapeHtml(formatTime(item.createdAt))}</span>
              <span><strong>Submitter:</strong> ${escapeHtml(item.submitterName)}</span>
            </div>
          </div>
          <div class="ss-approvals-body">${escapeHtml(item.summary || "No summary provided.")}</div>
          <div class="ss-approvals-actions">
            <span class="ss-badge ss-badge-secondary">${escapeHtml(String(item.artifactCount))} artifacts</span>
            <button class="ss-btn ss-btn-secondary" type="button" data-open-intake="${escapeHtml(kind)}" data-intake-id="${escapeHtml(item.id)}">Inspect</button>
          </div>
        </article>
      `)
      .join("");

    const detail = bucket.detail;
    if (!detail) {
      ui.detail.innerHTML = "Select an item to inspect detail.";
      countOverview();
      return;
    }
    let body = "";
    if (kind === "feedback") {
      body = detailBlock("Feedback type", detail.feedbackType) + detailBlock("Message", detail.body);
    } else if (kind === "beta") {
      body =
        detailBlock("Motivation", detail.betaMotivation) +
        detailBlock("Experience", detail.experienceSummary) +
        detailBlock("Testing environment", detail.testingEnvironment);
    } else {
      body =
        detailBlock("Reproduction steps", detail.reproductionSteps) +
        detailBlock("Expected result", detail.expectedResult) +
        detailBlock("Actual result", detail.actualResult) +
        detailBlock("Environment", detail.environmentDetails) +
        detailBlock("Platform details", detail.platformDetails) +
        detailBlock("Account context", detail.accountContext) +
        detailBlock("Detailed notes", detail.body) +
        `<div class="ss-approvals-body"><strong>Artifacts</strong><br />${renderArtifacts(detail.artifacts)}</div>`;
    }
    const meta =
      metaLine("Status", detail.status) +
      metaLine("Submitted", formatTime(detail.createdAt)) +
      metaLine("Updated", formatTime(detail.updatedAt)) +
      metaLine("Submitter", detail.submitterName) +
      metaLine("Email", detail.submitterEmail) +
      metaLine("Authenticated", detail.authenticated ? "yes" : "no") +
      metaLine("Developer capable", detail.developerCapable ? "yes" : "no") +
      metaLine("Category", detail.category) +
      metaLine("Severity", detail.severity) +
      metaLine("Affected area", detail.affectedArea);
    const extra = Object.keys(detail.extraMetadata).length
      ? `<div class="ss-approvals-body"><strong>Extra metadata</strong><pre>${escapeHtml(JSON.stringify(detail.extraMetadata, null, 2))}</pre></div>`
      : "";

    ui.detail.innerHTML = `
      <article class="ss-approvals-request ss-approvals-request-approved">
        <div class="ss-approvals-request-head">
          <h3>${escapeHtml(detail.title)}</h3>
          <div class="ss-approvals-meta">
            <span><strong>ID:</strong> ${escapeHtml(detail.id)}</span>
            <span><strong>Artifacts:</strong> ${escapeHtml(String(detail.artifactCount))}</span>
          </div>
        </div>
        <div class="ss-meta-row">${meta}</div>
        ${body}
        ${extra}
      </article>
    `;
    countOverview();
  }

  async function loadPending() {
    el.pendingStatus.textContent = "Loading pending requests...";
    const response = await request(PENDING);
    if (response.status === 401 || response.status === 403) {
      setDenied(true);
      state.pending = [];
      el.pendingStatus.textContent = "Admin access required.";
      renderPending();
      return;
    }
    if (!response.ok) throw new Error((await errorText(response)) || `Request failed (${response.status})`);
    const payload = await response.json().catch(() => null);
    state.pending = sortNewest(extractRequests(payload).map(normalizeRequest).filter((item) => item.id && !item.approved && !PENDING_TERMINAL.has(item.status)), "submittedAt");
    setDenied(false);
    el.pendingStatus.textContent = state.pending.length ? "Pending queue loaded." : "No pending requests.";
    renderPending();
  }

  async function loadApproved() {
    el.approvedStatus.textContent = "Loading approved requests...";
    const response = await request(APPROVED);
    if (!response.ok) throw new Error((await errorText(response)) || `Request failed (${response.status})`);
    const payload = await response.json().catch(() => null);
    state.approved = sortNewest(extractRequests(payload).map(normalizeRequest).filter((item) => item.id && (item.approved || APPROVED_STATES.has(item.status))), "submittedAt");
    el.approvedStatus.textContent = state.approved.length ? "Approved requests loaded." : "No approved requests.";
    renderApproved();
  }

  async function mutatePending(id, action) {
    const ui = state.pendingUi.get(id) || { busy: false, action: "", error: "", message: "" };
    if (ui.busy) return;
    ui.busy = true;
    ui.action = action;
    ui.error = "";
    ui.message = action === "approve" ? "Approving request..." : "Denying request...";
    state.pendingUi.set(id, ui);
    renderPending();
    const note = text(state.notes.get(id));
    const body = action === "deny" && note ? JSON.stringify({ deny_reason: note, moderation_notes: note }) : null;
    try {
      const response = await request(action === "approve" ? APPROVE(id) : DENY(id), {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body || undefined
      });
      if (response.status === 401 || response.status === 403) {
        setDenied(true);
        ui.busy = false;
        ui.error = "Admin access required.";
        ui.message = "";
        renderPending();
        return;
      }
      if (!response.ok) throw new Error((await errorText(response)) || "Action failed");
      let payload = null;
      try { payload = await response.json(); } catch {}
      if (action === "approve") {
        const normalized = normalizeRequest(payload?.request || payload?.data || payload || {});
        const existing = state.pending.find((item) => item.id === id) || {};
        state.approved.unshift({
          ...existing,
          ...normalized,
          id,
          approved: true,
          status: normalized.status || "approved",
          implemented: normalized.implemented === true
        });
        renderApproved();
      }
      state.pending = state.pending.filter((item) => item.id !== id);
      state.pendingUi.delete(id);
      state.notes.delete(id);
      el.pendingStatus.textContent = action === "approve" ? "Request approved." : "Request denied.";
      renderPending();
    } catch (error) {
      ui.busy = false;
      ui.action = "";
      ui.error = error?.message || "Action failed.";
      ui.message = "";
      state.pendingUi.set(id, ui);
      renderPending();
    }
  }

  async function toggleImplemented(id) {
    const item = state.approved.find((entry) => entry.id === id);
    if (!item) return;
    const ui = state.approvedUi.get(id) || { busy: false, error: "", message: "" };
    if (ui.busy) return;
    ui.busy = true;
    ui.error = "";
    ui.message = item.implemented ? "Unmarking implemented..." : "Marking implemented...";
    state.approvedUi.set(id, ui);
    renderApproved();
    try {
      const response = await request(IMPLEMENTED(id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ implemented: !item.implemented })
      });
      if (response.status === 401 || response.status === 403) {
        setDenied(true);
        ui.busy = false;
        ui.error = "Admin access required.";
        ui.message = "";
        renderApproved();
        return;
      }
      if (!response.ok) throw new Error((await errorText(response)) || "Action failed");
      let payload = null;
      try { payload = await response.json(); } catch {}
      const normalized = normalizeRequest(payload?.request || payload?.data || payload || {});
      item.implemented = normalized.implemented === true ? true : !item.implemented;
      if (normalized.status) item.status = normalized.status;
      ui.busy = false;
      ui.error = "";
      ui.message = item.implemented ? "Marked implemented." : "Marked not implemented.";
      renderApproved();
    } catch (error) {
      ui.busy = false;
      ui.error = error?.message || "Action failed.";
      ui.message = "";
      renderApproved();
    }
  }

  async function loadIntake(kind) {
    const ui = el.intake[kind];
    ui.status.textContent = "Loading...";
    const response = await request(INTAKES[kind].list);
    if (response.status === 401 || response.status === 403) {
      setDenied(true);
      ui.status.textContent = "Admin access required.";
      state.intakes[kind] = { items: [], detail: null };
      renderIntake(kind);
      return;
    }
    if (!response.ok) throw new Error((await errorText(response)) || `Request failed (${response.status})`);
    const payload = await response.json().catch(() => null);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    state.intakes[kind].items = items.map((item) => normalizeSubmission(kind, item));
    state.intakes[kind].detail = state.intakes[kind].items[0] || null;
    ui.status.textContent = state.intakes[kind].items.length ? "Queue loaded." : "No items available.";
    renderIntake(kind);
    if (state.intakes[kind].detail?.id) await loadIntakeDetail(kind, state.intakes[kind].detail.id);
  }

  async function loadIntakeDetail(kind, id) {
    const response = await request(`${INTAKES[kind].detail}${encodeURIComponent(id)}`);
    if (response.status === 401 || response.status === 403) {
      setDenied(true);
      el.intake[kind].status.textContent = "Admin access required.";
      return;
    }
    if (!response.ok) throw new Error((await errorText(response)) || `Request failed (${response.status})`);
    const payload = await response.json().catch(() => null);
    state.intakes[kind].detail = normalizeSubmission(kind, payload?.submission || payload || {});
    el.intake[kind].status.textContent = "Detail loaded.";
    renderIntake(kind);
  }

  function bind(target, eventName, handler) {
    if (!target) return;
    target.addEventListener(eventName, handler);
    state.listeners.push(() => target.removeEventListener(eventName, handler));
  }

  function cache() {
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
    el.overviewFeedbackCount = $("approvals-intake-feedback-count");
    el.overviewBetaCount = $("approvals-intake-beta-count");
    el.overviewReportsCount = $("approvals-intake-reports-count");
    el.intake.feedback = { refresh: $("approvals-refresh-feedback"), status: $("approvals-feedback-status"), count: $("approvals-feedback-count"), list: $("approvals-feedback-list"), empty: $("approvals-feedback-empty"), detail: $("approvals-feedback-detail") };
    el.intake.beta = { refresh: $("approvals-refresh-beta"), status: $("approvals-beta-status"), count: $("approvals-beta-count"), list: $("approvals-beta-list"), empty: $("approvals-beta-empty"), detail: $("approvals-beta-detail") };
    el.intake.reports = { refresh: $("approvals-refresh-reports"), status: $("approvals-reports-status"), count: $("approvals-reports-count"), list: $("approvals-reports-list"), empty: $("approvals-reports-empty"), detail: $("approvals-reports-detail") };
  }

  function unbindAll() {
    state.listeners.splice(0).forEach((remove) => {
      try { remove(); } catch {}
    });
  }

  function initBindings() {
    bind(el.refreshPending, "click", () => void loadPending().catch((error) => { el.pendingStatus.textContent = error.message || "Failed to load pending requests."; renderPending(); }));
    bind(el.refreshApproved, "click", () => void loadApproved().catch((error) => { el.approvedStatus.textContent = error.message || "Failed to load approved requests."; renderApproved(); }));
    bind(el.pendingList, "input", (event) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement) state.notes.set(target.getAttribute("data-note-id") || "", target.value || "");
    });
    bind(el.pendingList, "click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button[data-action]");
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;
      void mutatePending(button.getAttribute("data-request-id") || "", button.getAttribute("data-action") || "");
    });
    bind(el.approvedList, "click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button[data-toggle-implemented]");
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;
      void toggleImplemented(button.getAttribute("data-toggle-implemented") || "");
    });
    Object.keys(INTAKES).forEach((kind) => {
      bind(el.intake[kind].refresh, "click", () => void loadIntake(kind).catch((error) => { el.intake[kind].status.textContent = error.message || "Failed to load."; renderIntake(kind); }));
      bind(el.intake[kind].list, "click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = target.closest("button[data-open-intake]");
        if (!(button instanceof HTMLButtonElement)) return;
        const id = button.getAttribute("data-intake-id") || "";
        state.intakes[kind].detail = state.intakes[kind].items.find((item) => item.id === id) || null;
        renderIntake(kind);
        if (id) void loadIntakeDetail(kind, id).catch((error) => { el.intake[kind].status.textContent = error.message || "Failed to load detail."; renderIntake(kind); });
      });
    });
  }

  async function init() {
    state.token += 1;
    unbindAll();
    cache();
    if (!el.pendingList || !el.approvedList) return;
    setDenied(false);
    renderPending();
    renderApproved();
    renderIntake("feedback");
    renderIntake("beta");
    renderIntake("reports");
    initBindings();
    await Promise.all([
      loadPending().catch((error) => { el.pendingStatus.textContent = error.message || "Failed to load pending requests."; renderPending(); }),
      loadApproved().catch((error) => { el.approvedStatus.textContent = error.message || "Failed to load approved requests."; renderApproved(); }),
      loadIntake("feedback").catch((error) => { el.intake.feedback.status.textContent = error.message || "Failed to load."; renderIntake("feedback"); }),
      loadIntake("beta").catch((error) => { el.intake.beta.status.textContent = error.message || "Failed to load."; renderIntake("beta"); }),
      loadIntake("reports").catch((error) => { el.intake.reports.status.textContent = error.message || "Failed to load."; renderIntake("reports"); })
    ]);
  }

  function destroy() {
    state.token += 1;
    unbindAll();
  }

  window.ApprovalsView = { init, destroy };
})();

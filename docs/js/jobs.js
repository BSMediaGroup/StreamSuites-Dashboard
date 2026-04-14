(() => {
  "use strict";

  const state = {
    abortController: null
  };

  const els = {
    banner: document.getElementById("jobs-banner"),
    error: document.getElementById("jobs-error"),
    feedStatus: document.getElementById("jobs-feed-status"),
    sourceMode: document.getElementById("jobs-source-mode"),
    total: document.getElementById("jobs-total"),
    modulesEnabled: document.getElementById("jobs-modules-enabled"),
    modulesDisabled: document.getElementById("jobs-modules-disabled"),
    restartPosture: document.getElementById("jobs-restart-posture"),
    readonlyPosture: document.getElementById("jobs-readonly-posture"),
    modulesBody: document.getElementById("jobs-modules-body"),
    modulesEmpty: document.getElementById("jobs-modules-empty"),
    latestBody: document.getElementById("jobs-latest-body"),
    latestEmpty: document.getElementById("jobs-latest-empty"),
    statusBody: document.getElementById("jobs-status-body"),
    statusEmpty: document.getElementById("jobs-status-empty"),
    typeBody: document.getElementById("jobs-type-body"),
    typeEmpty: document.getElementById("jobs-type-empty"),
    creatorBody: document.getElementById("jobs-creator-body"),
    creatorEmpty: document.getElementById("jobs-creator-empty"),
    emptyState: document.getElementById("jobs-empty-state"),
    restartNotes: document.getElementById("jobs-restart-notes")
  };

  function hasRequiredElements() {
    return Object.values(els).every(Boolean);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setText(el, value) {
    if (!el) return;
    el.textContent = value ?? "";
  }

  function setHtml(el, value) {
    if (!el) return;
    el.innerHTML = value ?? "";
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle("hidden", hidden);
  }

  function showError(message) {
    if (!els.error) return;
    els.error.textContent = message;
    els.error.classList.remove("hidden");
  }

  function hideError() {
    if (!els.error) return;
    els.error.textContent = "";
    els.error.classList.add("hidden");
  }

  function labelize(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "Unknown";
    return raw
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function pickString(...values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  function pickBoolean(...values) {
    for (const value of values) {
      if (value === true) return true;
      if (value === false) return false;
    }
    return null;
  }

  function parseTimestamp(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) {
      if (value > 10_000_000_000) return value;
      return value * 1000;
    }
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatTimestamp(value) {
    const epoch = parseTimestamp(value);
    if (!epoch) return "—";
    try {
      return new Date(epoch).toLocaleString();
    } catch (_err) {
      return "—";
    }
  }

  function formatCount(value, fallback = "—") {
    return Number.isFinite(value) ? value.toLocaleString() : fallback;
  }

  function normalizeJobsList(raw) {
    const list = Array.isArray(raw?.jobs)
      ? raw.jobs
      : Array.isArray(raw?.items)
        ? raw.items
        : [];

    return list.map((entry, index) => normalizeJob(entry, index)).filter(Boolean);
  }

  function normalizeJob(raw, index) {
    if (!raw || typeof raw !== "object") return null;

    const status = pickString(raw.status, raw.state) || "unknown";
    const type = pickString(raw.type, raw.job_type, raw.name) || "unknown";
    const creator = pickString(raw.creator_id, raw.creatorId, raw.creator, raw.owner_creator_id);
    const reason = pickString(
      raw.reason,
      raw.disable_reason,
      raw.disabled_reason,
      raw.error,
      raw.last_error
    );
    const activityAt =
      parseTimestamp(raw.updated_at) ??
      parseTimestamp(raw.finished_at) ??
      parseTimestamp(raw.completed_at) ??
      parseTimestamp(raw.started_at) ??
      parseTimestamp(raw.created_at) ??
      parseTimestamp(raw.last_run) ??
      parseTimestamp(raw.next_run);

    return {
      id: pickString(raw.id, raw.job_id) || `job-${index + 1}`,
      status,
      type,
      creator,
      enabled: pickBoolean(raw.enabled, raw.enable),
      reason,
      createdAt: raw.created_at ?? raw.createdAt ?? raw.last_run ?? null,
      updatedAt:
        raw.updated_at ??
        raw.finished_at ??
        raw.completed_at ??
        raw.started_at ??
        raw.next_run ??
        null,
      activityAt
    };
  }

  function normalizeRuntimeModules(raw) {
    const list = Array.isArray(raw?.jobs) ? raw.jobs : [];
    return list
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        return {
          key: pickString(entry.name, entry.key, entry.type) || "unknown",
          enabled: pickBoolean(entry.enabled),
          applied: pickBoolean(entry.applied),
          reason: pickString(entry.reason, entry.note, entry.message)
        };
      })
      .filter(Boolean);
  }

  function normalizeRestartIntent(raw) {
    if (!raw || typeof raw !== "object") return null;
    const pending = raw.pending && typeof raw.pending === "object" ? raw.pending : {};
    const notes = Array.isArray(raw.notes)
      ? raw.notes.filter((entry) => typeof entry === "string" && entry.trim())
      : [];
    return {
      required: pickBoolean(raw.required),
      pending: {
        system: pending.system === true,
        creators: pending.creators === true,
        triggers: pending.triggers === true,
        platforms: pending.platforms === true
      },
      notes
    };
  }

  function tallyBy(items, selector) {
    const counts = {};
    items.forEach((item) => {
      const key = selector(item);
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([key, count]) => ({ key, count }))
      .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
  }

  function buildJobsViewModel({ jobsData, runtimeData, jobsError, runtimeError }) {
    const jobs = normalizeJobsList(jobsData);
    const runtimeModules = normalizeRuntimeModules(runtimeData);
    const restartIntent = normalizeRestartIntent(runtimeData?.restart_intent);
    const runtimeModuleFeedAvailable = Array.isArray(runtimeData?.jobs);

    const feedStatus = jobsError
      ? "error"
      : jobsData === null
        ? "missing"
        : jobsData && typeof jobsData === "object"
          ? "available"
          : "unavailable";

    const moduleEnabledCount = runtimeModules.filter((item) => item.enabled === true).length;
    const moduleDisabledCount = runtimeModules.filter((item) => item.enabled === false).length;
    const pendingApplyCount = runtimeModules.filter((item) => item.applied === false).length;

    const restartRequired =
      restartIntent?.required === true || pendingApplyCount > 0;

    const latestJobs = [...jobs]
      .sort((left, right) => (right.activityAt || 0) - (left.activityAt || 0))
      .slice(0, 8);

    const creatorsWithData = jobs.filter((item) => item.creator);

    return {
      jobs,
      runtimeModules,
      restartIntent,
      latestJobs,
      feedStatus,
      jobsError,
      runtimeError,
      statusGroups: tallyBy(jobs, (item) => labelize(item.status)),
      typeGroups: tallyBy(jobs, (item) => labelize(item.type)),
      creatorGroups: tallyBy(
        creatorsWithData.length ? creatorsWithData : jobs,
        (item) => (item.creator ? item.creator : "Unknown / Unassigned")
      ),
      moduleEnabledCount,
      moduleDisabledCount,
      pendingApplyCount,
      runtimeModuleFeedAvailable,
      restartRequired,
      sourceMode:
        window.__RUNTIME_AVAILABLE__ === true
          ? "Live runtime connection detected"
          : "Published export mode",
      emptyStateVisible: feedStatus === "available" && jobs.length === 0,
      feedAvailable: feedStatus === "available"
    };
  }

  function renderBanner(model) {
    els.banner.className = "ss-alert";

    if (model.feedStatus === "available") {
      els.banner.classList.add(model.jobs.length ? "ss-alert-success" : "ss-alert-warning");
      setText(
        els.banner,
        model.jobs.length
          ? `Published jobs feed available. Showing ${formatCount(model.jobs.length, "0")} runtime-authored job record(s).`
          : "Published jobs feed available, but no runtime job records exist yet."
      );
      return;
    }

    if (model.feedStatus === "missing") {
      els.banner.classList.add("ss-alert-warning");
      setText(
        els.banner,
        "No published jobs feed is available yet. Runtime module posture can still be inspected below."
      );
      return;
    }

    els.banner.classList.add("ss-alert-danger");
    setText(
      els.banner,
      "The authoritative jobs export could not be read. Runtime posture may still be partially visible if the runtime snapshot loaded."
    );
  }

  function renderMetrics(model) {
    const feedLabel =
      model.feedStatus === "available"
        ? "Available"
        : model.feedStatus === "missing"
          ? "Missing"
          : "Unavailable";

    setText(els.feedStatus, feedLabel);
    setText(els.sourceMode, model.sourceMode);
    setText(els.total, model.feedAvailable ? formatCount(model.jobs.length, "0") : "—");
    setText(
      els.modulesEnabled,
      model.runtimeModuleFeedAvailable ? formatCount(model.moduleEnabledCount, "0") : "—"
    );
    setText(
      els.modulesDisabled,
      model.runtimeModuleFeedAvailable ? formatCount(model.moduleDisabledCount, "0") : "—"
    );
    setText(
      els.restartPosture,
      model.restartRequired
        ? "Restart required"
        : model.restartIntent || model.runtimeModules.length
          ? "Clear"
          : "Unavailable"
    );
    setText(els.readonlyPosture, "Runtime-owned");

    const notes = [];
    if (model.restartIntent?.required === true) {
      notes.push("Runtime restart intent is reporting staged changes.");
    }
    if (model.pendingApplyCount > 0) {
      notes.push(`${formatCount(model.pendingApplyCount, "0")} module(s) are waiting for apply/restart.`);
    }
    if (!notes.length) {
      notes.push("This surface is read-only. Canonical job state remains runtime-owned.");
    }
    setHtml(
      els.restartNotes,
      notes.map((note) => `<span class="ss-chip ss-chip-muted">${escapeHtml(note)}</span>`).join("")
    );
  }

  function renderTableRows(target, emptyEl, rows, rowBuilder) {
    if (!rows.length) {
      setHtml(target, "");
      setHidden(emptyEl, false);
      return;
    }
    setHidden(emptyEl, true);
    setHtml(target, rows.map(rowBuilder).join(""));
  }

  function toneClass(enabled) {
    if (enabled === true) return "ss-badge-success";
    if (enabled === false) return "ss-badge-danger";
    return "ss-badge-warning";
  }

  function renderModules(model) {
    renderTableRows(els.modulesBody, els.modulesEmpty, model.runtimeModules, (item) => {
      const appliedLabel =
        item.applied === false ? "Pending restart" : item.applied === true ? "Applied" : "Unknown";
      const enabledLabel =
        item.enabled === true ? "Enabled" : item.enabled === false ? "Disabled" : "Unknown";
      return `
        <tr>
          <td>${escapeHtml(labelize(item.key))}</td>
          <td><span class="ss-badge ${toneClass(item.enabled)}">${escapeHtml(enabledLabel)}</span></td>
          <td>${escapeHtml(appliedLabel)}</td>
          <td>${escapeHtml(item.reason || "—")}</td>
        </tr>
      `;
    });
  }

  function renderLatest(model) {
    renderTableRows(els.latestBody, els.latestEmpty, model.latestJobs, (job) => `
      <tr>
        <td>${escapeHtml(job.id)}</td>
        <td>${escapeHtml(labelize(job.type))}</td>
        <td>${escapeHtml(job.creator || "—")}</td>
        <td>${escapeHtml(labelize(job.status))}</td>
        <td>${escapeHtml(formatTimestamp(job.updatedAt || job.createdAt))}</td>
      </tr>
    `);
  }

  function renderSummary(model) {
    renderTableRows(els.statusBody, els.statusEmpty, model.statusGroups, (row) => `
      <tr><td>${escapeHtml(row.key)}</td><td>${escapeHtml(formatCount(row.count, "0"))}</td></tr>
    `);
    renderTableRows(els.typeBody, els.typeEmpty, model.typeGroups, (row) => `
      <tr><td>${escapeHtml(row.key)}</td><td>${escapeHtml(formatCount(row.count, "0"))}</td></tr>
    `);
    renderTableRows(els.creatorBody, els.creatorEmpty, model.creatorGroups, (row) => `
      <tr><td>${escapeHtml(row.key)}</td><td>${escapeHtml(formatCount(row.count, "0"))}</td></tr>
    `);
  }

  function renderEmptyState(model) {
    setHidden(els.emptyState, !model.emptyStateVisible);
  }

  function render(model) {
    renderBanner(model);
    renderMetrics(model);
    renderModules(model);
    renderLatest(model);
    renderSummary(model);
    renderEmptyState(model);

    if (model.jobsError) {
      showError("Unable to hydrate job records from the authoritative export path.");
      return;
    }

    if (model.runtimeError && !model.runtimeModules.length) {
      showError("Runtime snapshot details were unavailable, so module posture may be incomplete.");
      return;
    }

    hideError();
  }

  async function loadAndRender(signal) {
    const loadState = window.StreamSuitesState?.loadStateJson;
    if (typeof loadState !== "function") {
      const model = buildJobsViewModel({
        jobsData: undefined,
        runtimeData: undefined,
        jobsError: new Error("State loader unavailable"),
        runtimeError: new Error("State loader unavailable")
      });
      render(model);
      return model;
    }

    const [jobsResult, runtimeResult] = await Promise.allSettled([
      loadState("jobs.json", {
        signal,
        loaderReason: "Hydrating jobs export..."
      }),
      loadState("runtime_snapshot.json", {
        signal,
        loaderReason: "Hydrating runtime snapshot..."
      })
    ]);

    const jobsData = jobsResult.status === "fulfilled" ? jobsResult.value : undefined;
    const runtimeData = runtimeResult.status === "fulfilled" ? runtimeResult.value : undefined;
    const model = buildJobsViewModel({
      jobsData,
      runtimeData,
      jobsError: jobsResult.status === "rejected" ? jobsResult.reason : null,
      runtimeError: runtimeResult.status === "rejected" ? runtimeResult.reason : null
    });

    render(model);
    return model;
  }

  async function init() {
    if (!hasRequiredElements()) return null;
    destroy();
    state.abortController = new AbortController();
    return loadAndRender(state.abortController.signal);
  }

  function destroy() {
    if (state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }
  }

  window.JobsView = {
    init,
    destroy
  };
})();

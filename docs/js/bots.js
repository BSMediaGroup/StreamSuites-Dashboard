/* ============================================================
   StreamSuites Dashboard - Bots view (admin/debug)
   ============================================================ */

(() => {
  "use strict";

  const POLL_INTERVAL_MS = 5000;
  const BOTS_STATUS_ENDPOINT = "/api/admin/bots/status";
  const MANUAL_DEPLOY_ENDPOINT = "/api/admin/runtime/manual-deploy";
  const PLATFORM_DISPLAY = {
    twitch: "Twitch",
    kick: "Kick",
    youtube: "YouTube",
    rumble: "Rumble",
    pilled: "Pilled"
  };

  const state = {
    pollHandle: null,
    tickHandle: null,
    lastPayload: null,
    lastRuntimeSnapshot: null,
    platformSummary: Object.create(null),
    lastReceivedAt: null,
    sourceUrl: null,
    rowUi: Object.create(null),
    onBodyClick: null,
    onManualToggleClick: null,
    onManualCancelClick: null,
    onManualFormSubmit: null,
    onManualFormChange: null,
    manualFormOpen: false,
    manualDeploy: {
      pending: false,
      error: ""
    }
  };

  const el = {
    status: null,
    count: null,
    generatedAt: null,
    source: null,
    error: null,
    platformsStatus: null,
    platformsGrid: null,
    manualToggle: null,
    manualForm: null,
    manualCreator: null,
    manualCreatorList: null,
    manualPlatform: null,
    manualTarget: null,
    manualSubmit: null,
    manualCancel: null,
    manualNote: null,
    manualError: null,
    body: null,
    empty: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return "-";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function encodeData(value) {
    return encodeURIComponent(String(value || ""));
  }

  function decodeData(value) {
    try {
      return decodeURIComponent(String(value || ""));
    } catch (err) {
      return String(value || "");
    }
  }

  function normalizePlatformKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function platformDisplayName(platform) {
    const key = normalizePlatformKey(platform);
    return PLATFORM_DISPLAY[key] || key || "-";
  }

  function listPlatformsFromConfig(config) {
    if (!config || typeof config !== "object") return [];
    const platforms = config.platforms;
    if (!platforms || typeof platforms !== "object") return [];
    return Object.keys(platforms)
      .map((platform) => normalizePlatformKey(platform))
      .filter(Boolean);
  }

  function sortPlatformKeys(keys) {
    return Array.from(new Set(keys.filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  function parseBoolean(value) {
    if (value === true || value === false) return value;
    return null;
  }

  function formatTimestamp(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    try {
      return date.toLocaleString(undefined, { hour12: false });
    } catch (err) {
      return String(value);
    }
  }

  function asFiniteNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  function formatUptime(seconds) {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const days = Math.floor(safe / 86400);
    const hours = Math.floor((safe % 86400) / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;

    if (days > 0) return `${days}d ${hours}h ${mins}m ${secs}s`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  function resolveApiBase() {
    const base =
      window.StreamSuitesAdminAuth?.config?.baseUrl ||
      document.querySelector('meta[name="streamsuites-auth-base"]')?.getAttribute("content") ||
      "";
    return base ? base.replace(/\/$/, "") : "";
  }

  function buildApiUrl(path) {
    const base = resolveApiBase();
    if (!base) return path;
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalized}`;
  }

  function isRuntimeAvailable() {
    return window.__RUNTIME_AVAILABLE__ === true;
  }

  function setRuntimeAvailable(value) {
    window.__RUNTIME_AVAILABLE__ = value === true;
  }

  async function probeRuntimeAvailability() {
    try {
      const response = await fetch(buildApiUrl(BOTS_STATUS_ENDPOINT), {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json"
        }
      });
      const available = response.ok;
      setRuntimeAvailable(available);
      return available;
    } catch (err) {
      setRuntimeAvailable(false);
      return false;
    }
  }

  function normalizePayload(payload) {
    const supportedPlatformsRaw =
      payload?.supported_platforms ||
      payload?.supportedPlatforms ||
      payload?.platforms_supported ||
      payload?.platformsSupported ||
      null;
    const supportedPlatforms = Array.isArray(supportedPlatformsRaw)
      ? supportedPlatformsRaw
      : supportedPlatformsRaw && typeof supportedPlatformsRaw === "object"
        ? Object.keys(supportedPlatformsRaw)
        : [];
    const bots = Array.isArray(payload?.bots) ? payload.bots.slice() : [];
    bots.sort((a, b) => {
      const creatorCompare = String(a?.creator_id || "").localeCompare(String(b?.creator_id || ""));
      if (creatorCompare !== 0) return creatorCompare;
      return String(a?.platform || "").localeCompare(String(b?.platform || ""));
    });

    return {
      schemaVersion: payload?.schema_version || null,
      generatedAt: payload?.generated_at || null,
      count: typeof payload?.count === "number" ? payload.count : bots.length,
      supportedPlatforms: sortPlatformKeys(
        supportedPlatforms.map((platform) => normalizePlatformKey(platform))
      ),
      bots
    };
  }

  function statusTone(status) {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "online" || normalized === "running" || normalized === "active") {
      return "ss-bot-status-online";
    }
    if (normalized === "offline" || normalized === "disabled" || normalized === "unavailable") {
      return "ss-bot-status-offline";
    }
    if (normalized === "error") return "ss-bot-status-error";
    if (normalized === "paused") return "ss-bot-status-paused";
    return "";
  }

  function statusLabel(status) {
    const text = String(status || "").trim();
    return text ? text : "-";
  }

  function renderStatus(status) {
    const tone = statusTone(status);
    const classes = ["ss-bot-status", tone].filter(Boolean).join(" ");
    return `<span class="${classes}">${escapeHtml(statusLabel(status))}</span>`;
  }

  function rowKey(creatorId, platform) {
    return `${String(creatorId || "")}::${String(platform || "").toLowerCase()}`;
  }

  function getRowUi(creatorId, platform) {
    const key = rowKey(creatorId, platform);
    if (!state.rowUi[key]) {
      state.rowUi[key] = { pending: false, pendingAction: "", error: "" };
    }
    return state.rowUi[key];
  }

  function isBotAttached(bot) {
    const status = String(bot?.status || "").trim().toLowerCase();
    const activeTarget = String(bot?.active_target || "").trim();
    const hasActiveTarget = Boolean(activeTarget && activeTarget !== "-");
    return status === "online" || status === "connecting" || hasActiveTarget;
  }

  function canAttach(bot) {
    return !isBotAttached(bot);
  }

  function canDetach(bot) {
    const status = String(bot?.status || "").trim().toLowerCase();
    if (status === "offline") return false;
    return isBotAttached(bot);
  }

  function renderManualOverride(value) {
    if (value === true) {
      return '<span class="ss-badge ss-badge-warning">Manual ON</span>';
    }
    return '<span class="ss-badge">Manual OFF</span>';
  }

  function normalizeRuntimePlatforms(snapshot) {
    const normalized = Object.create(null);
    const source = snapshot?.platforms;
    const entries = Array.isArray(source)
      ? source
      : source && typeof source === "object"
        ? Object.keys(source).map((platform) => ({
          platform,
          ...(source[platform] || {})
        }))
        : [];

    entries.forEach((entry) => {
      const platform = normalizePlatformKey(entry?.platform || entry?.id || entry?.name);
      if (!platform) return;

      const status = String(
        entry?.status || entry?.state || entry?.connection_status || "unknown"
      )
        .trim()
        .toLowerCase();
      const pausedReason =
        entry?.pausedReason ||
        entry?.paused_reason ||
        entry?.pause_reason ||
        null;
      const paused = entry?.paused === true || status === "paused" || Boolean(pausedReason);
      const enabled = parseBoolean(entry?.enabled);
      const active =
        paused !== true &&
        (status === "online" ||
          status === "running" ||
          status === "active" ||
          status === "connecting");
      const availability = paused
        ? "paused"
        : active || enabled === true
          ? "active"
          : "unavailable";
      const label =
        String(entry?.name || "").trim() || platformDisplayName(platform);

      normalized[platform] = {
        platform,
        label,
        status,
        availability,
        paused,
        pausedReason:
          typeof pausedReason === "string" && pausedReason.trim()
            ? pausedReason.trim()
            : "",
        error:
          typeof entry?.error === "string" && entry.error.trim()
            ? entry.error.trim()
            : typeof entry?.last_error === "string" && entry.last_error.trim()
              ? entry.last_error.trim()
              : ""
      };
    });

    return normalized;
  }

  function buildPlatformSummary(normalizedPayload, runtimeSnapshot, platformConfig) {
    const runtimePlatforms = normalizeRuntimePlatforms(runtimeSnapshot);
    const payloadSupported = Array.isArray(normalizedPayload?.supportedPlatforms)
      ? normalizedPayload.supportedPlatforms
      : [];
    const keys = new Set(
      payloadSupported.map((platform) => normalizePlatformKey(platform)).filter(Boolean)
    );
    const lockToRuntimeSupported = keys.size > 0;
    if (!lockToRuntimeSupported) {
      listPlatformsFromConfig(platformConfig).forEach((platform) => keys.add(platform));
      Object.keys(runtimePlatforms).forEach((platform) => keys.add(platform));
      (normalizedPayload?.bots || []).forEach((bot) => {
        const platform = normalizePlatformKey(bot?.platform);
        if (platform) keys.add(platform);
      });
    }

    const summary = Object.create(null);
    sortPlatformKeys(Array.from(keys)).forEach((platform) => {
      const runtime = runtimePlatforms[platform] || null;
      const availability = runtime?.availability || "unavailable";
      const reason =
        runtime?.paused
          ? runtime.pausedReason || "Paused by runtime control."
          : availability === "unavailable"
            ? "No active runtime availability reported."
            : "Runtime available.";

      summary[platform] = {
        platform,
        label: runtime?.label || platformDisplayName(platform),
        availability,
        status: runtime?.status || "unknown",
        paused: runtime?.paused === true,
        pausedReason: runtime?.pausedReason || "",
        reason
      };
    });

    return summary;
  }

  function renderPlatformSummary(platformSummary) {
    if (!el.platformsGrid) return;

    const entries = sortPlatformKeys(Object.keys(platformSummary || {})).map((platform) => (
      platformSummary[platform] || {
        platform,
        label: platformDisplayName(platform),
        availability: "unavailable",
        status: "unknown",
        paused: false,
        pausedReason: "",
        reason: "No runtime availability reported."
      }
    ));

    el.platformsGrid.innerHTML = entries
      .map((entry) => {
        const availability = String(entry.availability || "unavailable").toLowerCase();
        const stateClass =
          availability === "paused"
            ? "is-paused"
            : availability === "active"
              ? "is-active"
              : "is-unavailable";
        const badgeLabel =
          availability === "paused"
            ? "Paused"
            : availability === "active"
              ? "Active"
              : "Unavailable";
        return `
          <article class="ss-bots-platform-chip ${stateClass}">
            <div class="ss-bots-platform-name">${escapeHtml(entry.label)}</div>
            <div>${renderStatus(badgeLabel)}</div>
            <div class="ss-bot-platform-note">${escapeHtml(entry.reason)}</div>
          </article>
        `;
      })
      .join("");

    if (el.platformsStatus) {
      const pausedCount = entries.filter((entry) => entry.availability === "paused").length;
      const activeCount = entries.filter((entry) => entry.availability === "active").length;
      const unavailableCount = entries.filter(
        (entry) => entry.availability === "unavailable"
      ).length;
      el.platformsStatus.textContent = `Active ${activeCount} | Paused ${pausedCount} | Unavailable ${unavailableCount}`;
    }
  }

  function renderActionCell(bot, platformState) {
    const creatorId = String(bot?.creator_id || "");
    const platform = String(bot?.platform || "");
    const ui = getRowUi(creatorId, platform);
    const runtimeOffline = !isRuntimeAvailable();
    const runtimePaused = platformState?.paused === true;
    const attachDisabled = ui.pending || runtimeOffline || runtimePaused || !canAttach(bot);
    const detachDisabled = ui.pending || runtimeOffline || !canDetach(bot);
    const attachLabel =
      ui.pending && ui.pendingAction === "attach" ? "Deploying..." : "Manual Deploy";
    const detachLabel = ui.pending && ui.pendingAction === "detach" ? "Detaching..." : "Detach";
    const rowError = String(ui.error || "");
    const pausedMessage = runtimePaused
      ? platformState?.pausedReason || "Paused by runtime control."
      : "";
    const runtimeOfflineMessage = runtimeOffline
      ? "Runtime is offline."
      : "";

    return `
      <div class="ss-bot-actions">
        <div class="ss-bot-actions-row">
          <button
            class="ss-btn ss-btn-small ss-btn-primary"
            data-bot-action="attach"
            data-creator-id="${encodeData(creatorId)}"
            data-platform="${encodeData(platform)}"
            ${attachDisabled ? "disabled" : ""}
          >${attachLabel}</button>
          <button
            class="ss-btn ss-btn-small ss-btn-danger"
            data-bot-action="detach"
            data-creator-id="${encodeData(creatorId)}"
            data-platform="${encodeData(platform)}"
            ${detachDisabled ? "disabled" : ""}
          >${detachLabel}</button>
        </div>
        ${runtimeOffline
          ? `<div class="ss-bot-actions-row-note">${escapeHtml(runtimeOfflineMessage)}</div>`
          : ""}
        ${runtimePaused
          ? `<div class="ss-bot-actions-row-note">${escapeHtml(`Paused: ${pausedMessage}`)}</div>`
          : ""}
        <div class="ss-bot-row-error ${rowError ? "has-error" : ""}">${escapeHtml(
          rowError || "-"
        )}</div>
      </div>
    `;
  }

  function getDisplayUptimeSeconds(bot, payloadGeneratedAt, receivedAt) {
    const base = asFiniteNumber(bot?.uptime_seconds);
    if (base === null) return null;

    if (String(bot?.status || "").toLowerCase() !== "online") {
      return Math.max(0, Math.floor(base));
    }

    const generated = payloadGeneratedAt ? new Date(payloadGeneratedAt).getTime() : null;
    if (!generated || Number.isNaN(generated)) {
      return Math.max(0, Math.floor(base));
    }

    const elapsed = Math.max(0, (receivedAt - generated) / 1000);
    return Math.max(0, Math.floor(base + elapsed));
  }

  function renderRows(normalized, receivedAt, platformSummary) {
    const rows = normalized.bots.map((bot) => {
      const status = String(bot?.status || "").trim().toLowerCase();
      const platformKey = normalizePlatformKey(bot?.platform);
      const platformState = platformSummary?.[platformKey] || null;
      const isPaused = status === "paused" || platformState?.paused === true;
      const effectiveStatus = isPaused ? "paused" : bot?.status;
      const lastError = bot?.last_error;
      const hasError = typeof lastError === "string" && lastError.trim() !== "";
      const uptimeSeconds = getDisplayUptimeSeconds(bot, normalized.generatedAt, receivedAt);
      const uptimeLabel = uptimeSeconds === null ? "-" : formatUptime(uptimeSeconds);
      const rowClass = isPaused ? "ss-bots-row-paused" : "";
      const errorClass = hasError ? "ss-bots-last-error has-error" : "ss-bots-last-error";

      return `
        <tr class="${rowClass}">
          <td>${escapeHtml(bot?.creator_id)}</td>
          <td>${escapeHtml(platformDisplayName(bot?.platform))}</td>
          <td>${renderStatus(effectiveStatus)}</td>
          <td>${escapeHtml(bot?.active_target)}</td>
          <td>${renderManualOverride(bot?.manual_override === true)}</td>
          <td>${escapeHtml(formatTimestamp(bot?.connected_at))}</td>
          <td>${escapeHtml(uptimeLabel)}</td>
          <td class="${errorClass}">${escapeHtml(hasError ? lastError : "-")}</td>
          <td>${renderActionCell(bot, platformState)}</td>
        </tr>
      `;
    });

    return rows.join("");
  }

  function setError(message) {
    if (!el.error) return;
    if (!message) {
      el.error.textContent = "";
      el.error.classList.add("hidden");
      return;
    }
    el.error.textContent = message;
    el.error.classList.remove("hidden");
  }

  function setManualError(message) {
    const text = String(message || "").trim();
    state.manualDeploy.error = text;
    if (!el.manualError) return;
    if (!text) {
      el.manualError.textContent = "";
      el.manualError.classList.add("hidden");
      return;
    }
    el.manualError.textContent = text;
    el.manualError.classList.remove("hidden");
  }

  function manualFormValues() {
    return {
      creatorId: String(el.manualCreator?.value || "").trim(),
      platform: normalizePlatformKey(el.manualPlatform?.value),
      targetIdentifier: String(el.manualTarget?.value || "").trim()
    };
  }

  function getPausedPlatformMessage(platform) {
    if (!platform) return "";
    const platformState = state.platformSummary?.[platform] || null;
    if (!platformState || platformState.paused !== true) return "";
    const reason = String(platformState.pausedReason || "").trim();
    if (reason) {
      return `Platform is paused: ${reason}`;
    }
    return "Platform is paused by runtime control.";
  }

  function getManualDeployBlockedReason(platform) {
    if (!isRuntimeAvailable()) return "Runtime is offline.";
    return getPausedPlatformMessage(platform);
  }

  function updateManualCreatorSuggestions() {
    if (!el.manualCreatorList) return;
    const creatorIds = sortPlatformKeys(
      (state.lastPayload?.bots || [])
        .map((bot) => String(bot?.creator_id || "").trim())
        .filter(Boolean)
    );
    el.manualCreatorList.innerHTML = creatorIds
      .map((creatorId) => `<option value="${escapeHtml(creatorId)}"></option>`)
      .join("");
  }

  function updateManualDeployUi() {
    if (!el.manualToggle || !el.manualForm) return;

    const formOpen = state.manualFormOpen === true;
    el.manualForm.classList.toggle("hidden", !formOpen);
    el.manualToggle.textContent = formOpen ? "Hide Manual Deploy" : "Manual Deploy Bot";

    const values = manualFormValues();
    const blockedReason = getManualDeployBlockedReason(values.platform);
    const hasRequiredFields = Boolean(
      values.creatorId && values.platform && values.targetIdentifier
    );
    const submitDisabled = state.manualDeploy.pending || Boolean(blockedReason) || !hasRequiredFields;

    if (el.manualSubmit) {
      el.manualSubmit.disabled = submitDisabled;
      el.manualSubmit.textContent = state.manualDeploy.pending ? "Deploying..." : "Deploy Bot";
    }

    if (el.manualCreator) {
      el.manualCreator.disabled = state.manualDeploy.pending;
    }
    if (el.manualPlatform) {
      el.manualPlatform.disabled = state.manualDeploy.pending;
    }
    if (el.manualTarget) {
      el.manualTarget.disabled = state.manualDeploy.pending;
    }
    if (el.manualCancel) {
      el.manualCancel.disabled = state.manualDeploy.pending;
    }

    if (el.manualNote) {
      const note =
        blockedReason ||
        (values.platform
          ? "Manual deploy will create bot instance if needed."
          : "Choose creator, platform, and target.");
      el.manualNote.textContent = note;
    }
  }

  function toggleManualForm(forceOpen) {
    if (!el.manualForm) return;
    if (typeof forceOpen === "boolean") {
      state.manualFormOpen = forceOpen;
    } else {
      state.manualFormOpen = !state.manualFormOpen;
    }
    updateManualDeployUi();
  }

  async function submitManualDeploy(event) {
    event.preventDefault();

    const values = manualFormValues();
    const blockedReason = getManualDeployBlockedReason(values.platform);
    if (blockedReason) {
      setManualError(blockedReason);
      updateManualDeployUi();
      return;
    }

    if (!values.creatorId || !values.platform || !values.targetIdentifier) {
      setManualError("Creator, platform, and target identifier are required.");
      updateManualDeployUi();
      return;
    }

    state.manualDeploy.pending = true;
    setManualError("");
    updateManualDeployUi();

    try {
      const payload = {
        action: "attach",
        creator_id: values.creatorId,
        platform: values.platform,
        target_identifier: values.targetIdentifier
      };

      const response = await fetch(buildApiUrl(MANUAL_DEPLOY_ENDPOINT), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorPayload = await readJsonSafe(response);
        const detail =
          errorPayload?.error ||
          errorPayload?.message ||
          `Manual deploy failed (HTTP ${response.status}).`;
        setManualError(String(detail));
        return;
      }

      setManualError("");
      if (el.manualTarget) {
        el.manualTarget.value = "";
      }
      await refresh();
    } catch (err) {
      const detail = err?.message ? String(err.message) : "Manual deploy failed.";
      setManualError(detail);
    } finally {
      state.manualDeploy.pending = false;
      updateManualDeployUi();
    }
  }

  function updateMeta(normalized, receivedAt) {
    if (el.count) {
      const rowCount = Array.isArray(normalized?.bots) ? normalized.bots.length : 0;
      el.count.textContent = `${rowCount} rows`;
    }
    if (el.generatedAt) {
      el.generatedAt.textContent = `Generated: ${formatTimestamp(normalized?.generatedAt)}`;
    }
    if (el.status) {
      const received = formatTimestamp(new Date(receivedAt).toISOString());
      el.status.textContent = `Live runtime snapshot (${received})`;
    }
  }

  async function fetchPayload() {
    const endpoint = buildApiUrl(BOTS_STATUS_ENDPOINT);
    const res = await fetch(endpoint, {
      cache: "no-store",
      credentials: "include"
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const payload = await res.json();
    state.sourceUrl = endpoint;
    return normalizePayload(payload);
  }

  async function fetchRuntimeSnapshot() {
    try {
      if (window.ConfigState?.loadRuntimeSnapshot) {
        return (await window.ConfigState.loadRuntimeSnapshot({ forceReload: true })) || null;
      }
      if (window.Telemetry?.loadSnapshot) {
        return (await window.Telemetry.loadSnapshot(true)) || null;
      }
    } catch (err) {
      return null;
    }
    return null;
  }

  async function fetchPlatformConfig() {
    try {
      if (window.ConfigState?.loadPlatforms) {
        return (await window.ConfigState.loadPlatforms()) || null;
      }
    } catch (err) {
      return null;
    }
    return null;
  }

  function render(normalized, runtimeSnapshot, platformConfig) {
    const now = Date.now();
    state.lastPayload = normalized;
    state.lastRuntimeSnapshot = runtimeSnapshot || null;
    state.platformSummary = buildPlatformSummary(
      normalized,
      runtimeSnapshot || null,
      platformConfig || null
    );
    state.lastReceivedAt = now;

    if (el.source) {
      el.source.textContent = `Source: ${state.sourceUrl || buildApiUrl(BOTS_STATUS_ENDPOINT)}`;
    }

    updateMeta(normalized, now);

    renderPlatformSummary(state.platformSummary);
    updateManualCreatorSuggestions();
    updateManualDeployUi();

    const hasRows = normalized && Array.isArray(normalized.bots) && normalized.bots.length > 0;

    if (el.body) {
      el.body.innerHTML = hasRows ? renderRows(normalized, now, state.platformSummary) : "";
    }
    if (el.empty) {
      el.empty.classList.toggle("hidden", hasRows);
    }
  }

  async function refresh() {
    if (!(await probeRuntimeAvailability())) {
      renderRuntimeOffline();
      return;
    }

    try {
      const [normalized, runtimeSnapshot, platformConfig] = await Promise.all([
        fetchPayload(),
        fetchRuntimeSnapshot(),
        fetchPlatformConfig()
      ]);
      setError("");
      render(normalized, runtimeSnapshot, platformConfig);
    } catch (err) {
      setRuntimeAvailable(false);
      state.lastPayload = { bots: [], supportedPlatforms: [], generatedAt: null };
      state.lastRuntimeSnapshot = null;
      state.platformSummary = buildPlatformSummary({ bots: [] }, null, null);
      state.lastReceivedAt = Date.now();
      if (el.status) {
        el.status.textContent = "Unable to load runtime bot status.";
      }
      if (el.count) {
        el.count.textContent = "-- rows";
      }
      if (el.generatedAt) {
        el.generatedAt.textContent = "Generated: --";
      }
      if (el.body) {
        el.body.innerHTML = "";
      }
      renderPlatformSummary(state.platformSummary);
      if (el.empty) {
        el.empty.classList.remove("hidden");
      }
      updateManualCreatorSuggestions();
      updateManualDeployUi();
      const detail = err?.message ? ` (${err.message})` : "";
      setError(`Unable to load bot status from runtime API${detail}`);
    }
  }

  function renderRuntimeOffline() {
    stopPolling();
    state.lastPayload = { bots: [], supportedPlatforms: [], generatedAt: null };
    state.lastRuntimeSnapshot = null;
    state.platformSummary = buildPlatformSummary({ bots: [] }, null, null);
    state.lastReceivedAt = Date.now();
    if (el.status) {
      el.status.textContent = "Runtime offline - bot status unavailable";
    }
    if (el.count) {
      el.count.textContent = "-- rows";
    }
    if (el.generatedAt) {
      el.generatedAt.textContent = "Generated: --";
    }
    if (el.source) {
      el.source.textContent = `Source: ${buildApiUrl(BOTS_STATUS_ENDPOINT)}`;
    }
    if (el.body) {
      el.body.innerHTML = "";
    }
    renderPlatformSummary(state.platformSummary);
    if (el.empty) {
      el.empty.classList.remove("hidden");
    }
    updateManualCreatorSuggestions();
    updateManualDeployUi();
    setError("");
  }

  function tick() {
    if (!state.lastPayload || !state.lastReceivedAt) return;
    if (el.body) {
      el.body.innerHTML = renderRows(
        state.lastPayload,
        Date.now(),
        state.platformSummary
      );
    }
    updateMeta(state.lastPayload, state.lastReceivedAt);
  }

  async function readJsonSafe(response) {
    try {
      return await response.json();
    } catch (err) {
      return null;
    }
  }

  async function applyManualAction(action, creatorId, platform) {
    if (!state.lastPayload || !Array.isArray(state.lastPayload.bots)) return;

    const bot = state.lastPayload.bots.find(
      (entry) =>
        String(entry?.creator_id || "") === creatorId &&
        String(entry?.platform || "").toLowerCase() === platform.toLowerCase()
    );
    if (!bot) return;

    const ui = getRowUi(creatorId, platform);
    if (ui.pending) return;
    const platformState = state.platformSummary?.[normalizePlatformKey(platform)] || null;
    if (platformState?.paused) {
      ui.error = platformState.pausedReason || "Platform is paused by runtime control.";
      if (el.body) {
        el.body.innerHTML = renderRows(state.lastPayload, Date.now(), state.platformSummary);
      }
      return;
    }

    let targetIdentifier = null;
    if (action === "attach") {
      const currentTarget = String(bot?.active_target || "").trim();
      const promptDefault = currentTarget && currentTarget !== "-" ? currentTarget : "";
      const prompted = window.prompt(
        `Manual deploy target for ${creatorId} (${platform}):\nEnter channel name or stream identifier.`,
        promptDefault
      );
      if (prompted === null) return;
      const trimmed = String(prompted || "").trim();
      if (!trimmed) {
        ui.error = "Target identifier is required for manual deploy.";
        if (el.body) {
          el.body.innerHTML = renderRows(state.lastPayload, Date.now(), state.platformSummary);
        }
        return;
      }
      targetIdentifier = trimmed;
    } else if (action === "detach") {
      const currentTarget = String(bot?.active_target || "").trim();
      targetIdentifier = currentTarget && currentTarget !== "-" ? currentTarget : null;
    }

    ui.pending = true;
    ui.pendingAction = action;
    ui.error = "";
    if (el.body) {
      el.body.innerHTML = renderRows(state.lastPayload, Date.now(), state.platformSummary);
    }

    try {
      const payload = {
        action,
        platform,
        creator_id: creatorId,
        target_identifier: targetIdentifier
      };

      const response = await fetch(buildApiUrl(MANUAL_DEPLOY_ENDPOINT), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorPayload = await readJsonSafe(response);
        const detail =
          errorPayload?.error ||
          errorPayload?.message ||
          `Manual ${action} failed (HTTP ${response.status}).`;
        ui.error = String(detail);
        return;
      }

      ui.error = "";
      await refresh();
    } catch (err) {
      ui.error = err?.message ? String(err.message) : `Manual ${action} failed.`;
    } finally {
      ui.pending = false;
      ui.pendingAction = "";
      if (state.lastPayload && el.body) {
        el.body.innerHTML = renderRows(state.lastPayload, Date.now(), state.platformSummary);
      }
    }
  }

  function onBodyClick(event) {
    const button = event.target.closest("[data-bot-action]");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;

    const action = String(button.dataset.botAction || "").trim().toLowerCase();
    if (action !== "attach" && action !== "detach") return;

    const creatorId = decodeData(button.dataset.creatorId || "");
    const platform = decodeData(button.dataset.platform || "");
    if (!creatorId || !platform) return;

    void applyManualAction(action, creatorId, platform);
  }

  function onManualToggleClick() {
    toggleManualForm();
  }

  function onManualCancelClick() {
    setManualError("");
    toggleManualForm(false);
  }

  function onManualFormChange() {
    if (state.manualDeploy.error) {
      setManualError("");
    }
    updateManualDeployUi();
  }

  function startPolling() {
    void startPollingAsync();
  }

  async function startPollingAsync() {
    stopPolling();
    if (!(await probeRuntimeAvailability())) {
      renderRuntimeOffline();
      return;
    }
    await refresh();
    state.pollHandle = setInterval(refresh, POLL_INTERVAL_MS);
    state.tickHandle = setInterval(tick, 1000);
  }

  function stopPolling() {
    if (state.pollHandle) {
      clearInterval(state.pollHandle);
      state.pollHandle = null;
    }
    if (state.tickHandle) {
      clearInterval(state.tickHandle);
      state.tickHandle = null;
    }
  }

  function init() {
    el.status = $("bots-status");
    el.count = $("bots-count");
    el.generatedAt = $("bots-generated-at");
    el.source = $("bots-source");
    el.error = $("bots-error");
    el.platformsStatus = $("bots-platforms-status");
    el.platformsGrid = $("bots-platforms-grid");
    el.manualToggle = $("bots-manual-toggle");
    el.manualForm = $("bots-manual-form");
    el.manualCreator = $("bots-manual-creator");
    el.manualCreatorList = $("bots-manual-creator-list");
    el.manualPlatform = $("bots-manual-platform");
    el.manualTarget = $("bots-manual-target");
    el.manualSubmit = $("bots-manual-submit");
    el.manualCancel = $("bots-manual-cancel");
    el.manualNote = $("bots-manual-note");
    el.manualError = $("bots-manual-error");
    el.body = $("bots-table-body");
    el.empty = $("bots-empty");

    state.onBodyClick = onBodyClick;
    el.body?.addEventListener("click", state.onBodyClick);
    state.onManualToggleClick = onManualToggleClick;
    state.onManualCancelClick = onManualCancelClick;
    state.onManualFormSubmit = submitManualDeploy;
    state.onManualFormChange = onManualFormChange;
    el.manualToggle?.addEventListener("click", state.onManualToggleClick);
    el.manualCancel?.addEventListener("click", state.onManualCancelClick);
    el.manualForm?.addEventListener("submit", state.onManualFormSubmit);
    el.manualForm?.addEventListener("input", state.onManualFormChange);
    el.manualForm?.addEventListener("change", state.onManualFormChange);
    state.manualFormOpen = false;
    setManualError("");
    updateManualCreatorSuggestions();
    updateManualDeployUi();

    startPolling();
  }

  function destroy() {
    stopPolling();
    if (state.onBodyClick && el.body) {
      el.body.removeEventListener("click", state.onBodyClick);
    }
    if (state.onManualToggleClick && el.manualToggle) {
      el.manualToggle.removeEventListener("click", state.onManualToggleClick);
    }
    if (state.onManualCancelClick && el.manualCancel) {
      el.manualCancel.removeEventListener("click", state.onManualCancelClick);
    }
    if (state.onManualFormSubmit && el.manualForm) {
      el.manualForm.removeEventListener("submit", state.onManualFormSubmit);
    }
    if (state.onManualFormChange && el.manualForm) {
      el.manualForm.removeEventListener("input", state.onManualFormChange);
      el.manualForm.removeEventListener("change", state.onManualFormChange);
    }
    state.onBodyClick = null;
    state.onManualToggleClick = null;
    state.onManualCancelClick = null;
    state.onManualFormSubmit = null;
    state.onManualFormChange = null;
    state.manualFormOpen = false;
    state.manualDeploy = { pending: false, error: "" };
    state.lastPayload = null;
    state.lastRuntimeSnapshot = null;
    state.platformSummary = Object.create(null);
    state.lastReceivedAt = null;
    state.sourceUrl = null;
    state.rowUi = Object.create(null);
  }

  window.BotsView = {
    init,
    destroy
  };
})();

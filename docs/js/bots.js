/* ============================================================
   StreamSuites Dashboard - Bots view (admin/debug)
   ============================================================ */

(() => {
  "use strict";

  const POLL_INTERVAL_MS = 5000;
  const BOTS_STATUS_ENDPOINT = "/api/admin/bots/status";
  const CREATORS_ENDPOINT = "/api/admin/creators";
  const MANUAL_DEPLOY_ENDPOINT = "/api/admin/runtime/manual-deploy";
  const MANUAL_RESUME_ENDPOINT = "/api/admin/runtime/manual-resume";
  const MANUAL_CLEAR_ENDPOINT = "/api/admin/runtime/manual-instance";
  const PLATFORM_DISPLAY = {
    twitch: "Twitch",
    kick: "Kick",
    youtube: "YouTube",
    rumble: "Rumble",
    pilled: "Pilled"
  };
  const PLATFORM_ICON_PATHS = Object.freeze({
    twitch: "/assets/icons/twitch.svg",
    kick: "/assets/icons/kick.svg",
    youtube: "/assets/icons/youtube.svg",
    rumble: "/assets/icons/rumble.svg",
    pilled: "/assets/icons/pilled.svg"
  });
  const DEPLOY_PLATFORM_SCHEMA_FALLBACK = {
    twitch: {
      platform: "twitch",
      label: "Twitch",
      deployEnabled: true,
      staged: false,
      blockedReason: "",
      targetLabel: "Target Channel Login",
      targetPlaceholder: "e.g. danclancy",
      targetHelp: "Twitch IRC channel login (without #).",
      extraHelp:
        "Bot nickname and OAuth token come from runtime config/secrets. If missing, runtime returns a deploy error."
    },
    youtube: {
      platform: "youtube",
      label: "YouTube",
      deployEnabled: true,
      staged: false,
      blockedReason: "",
      targetLabel: "Live Chat ID",
      targetPlaceholder: "e.g. Cg0KC...",
      targetHelp:
        "Live Chat ID required by runtime manual deploy for YouTube chat workers.",
      extraHelp: ""
    },
    rumble: {
      platform: "rumble",
      label: "Rumble",
      deployEnabled: true,
      staged: false,
      blockedReason: "",
      targetLabel: "Stream Watch URL",
      targetPlaceholder: "https://rumble.com/...",
      targetHelp: "Rumble stream watch URL consumed by runtime manual deploy.",
      extraHelp: ""
    },
    kick: {
      platform: "kick",
      label: "Kick",
      deployEnabled: true,
      staged: false,
      blockedReason: "",
      targetLabel: "Channel Login",
      targetPlaceholder: "e.g. creatorname",
      targetHelp: "Kick channel login used for runtime manual deploy.",
      extraHelp: ""
    },
    pilled: {
      platform: "pilled",
      label: "Pilled",
      deployEnabled: false,
      staged: true,
      blockedReason: "Pilled manual deploy is staged/disabled in runtime.",
      targetLabel: "",
      targetPlaceholder: "",
      targetHelp: "",
      extraHelp: ""
    }
  };

  const state = {
    pollHandle: null,
    tickHandle: null,
    lastPayload: null,
    deployPlatformSchemas: Object.create(null),
    creators: [],
    platformSummary: Object.create(null),
    lastReceivedAt: null,
    sourceUrl: null,
    hydrationLive: false,
    hydrationLabel: "Waiting for runtime status...",
    rowUi: Object.create(null),
    onBodyClick: null,
    onManualToggleClick: null,
    onManualCancelClick: null,
    onManualFormSubmit: null,
    onManualFormChange: null,
    manualFormOpen: false,
    manualDeploy: {
      pending: false,
      error: "",
      renderedPlatform: ""
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
    liveTotal: null,
    manualToggle: null,
    manualForm: null,
    manualCreator: null,
    manualPlatform: null,
    manualPlatformFields: null,
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

  function platformIconPath(platform) {
    const key = normalizePlatformKey(platform);
    return PLATFORM_ICON_PATHS[key] || "/assets/icons/ui/bot.svg";
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

  function parseBooleanLike(value) {
    if (value === true || value === false) return value;
    if (typeof value !== "string") return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (["1", "true", "yes", "on", "enabled", "supported"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off", "disabled", "unsupported"].includes(normalized)) {
      return false;
    }
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

  function formatTimestampCompact(value) {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    try {
      return date.toLocaleTimeString(undefined, {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch (err) {
      return String(value);
    }
  }

  function truncateForCard(value, max = 120) {
    const text = String(value || "").trim();
    if (!text) return "";
    return text.length > max ? `${text.slice(0, max - 1)}...` : text;
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

  function normalizePayload(payload) {
    const supportedPlatformsRaw =
      payload?.supported_platforms ||
      payload?.supportedPlatforms ||
      payload?.platforms_supported ||
      payload?.platformsSupported ||
      null;
    const platformCapabilitiesRaw =
      payload?.platform_capabilities ||
      payload?.platformCapabilities ||
      payload?.deploy_platforms ||
      payload?.deployPlatforms ||
      payload?.manual_deploy_platforms ||
      payload?.manualDeployPlatforms ||
      null;
    const supportedPlatforms = Array.isArray(supportedPlatformsRaw)
      ? supportedPlatformsRaw
      : supportedPlatformsRaw && typeof supportedPlatformsRaw === "object"
        ? Object.keys(supportedPlatformsRaw)
        : [];
    const platformRowsRaw = Array.isArray(payload?.platforms)
      ? payload.platforms
      : payload?.platforms && typeof payload.platforms === "object"
        ? Object.keys(payload.platforms).map((key) => ({
          platform: key,
          ...(payload.platforms[key] || {})
        }))
        : [];

    const platformRows = platformRowsRaw
      .map((entry) => {
        const key = normalizePlatformKey(entry?.platform || entry?.name || entry?.id);
        if (!key) return null;
        const status = String(entry?.status || "unknown").trim().toLowerCase();
        const rawSeverity = String(
          entry?.last_log?.severity || entry?.lastLog?.severity || ""
        )
          .trim()
          .toLowerCase();
        const severity = ["info", "warning", "error"].includes(rawSeverity)
          ? rawSeverity
          : "info";
        const logMessage = String(
          entry?.last_log?.message || entry?.lastLog?.message || ""
        ).trim();

        return {
          platform: key,
          label: String(entry?.label || entry?.name || platformDisplayName(key)).trim() ||
            platformDisplayName(key),
          available: entry?.available === true,
          status,
          paused: entry?.paused === true || status === "paused",
          pausedReason: String(entry?.paused_reason || entry?.pausedReason || "").trim(),
          error: String(entry?.error || "").trim(),
          staged: entry?.staged === true || status === "staged",
          disabledReason: String(entry?.disabled_reason || entry?.disabledReason || "").trim(),
          lastLog: logMessage
            ? {
              timestamp: entry?.last_log?.timestamp || entry?.lastLog?.timestamp || null,
              severity,
              message: logMessage
            }
            : null
        };
      })
      .filter(Boolean);

    const bots = Array.isArray(payload?.bots) ? payload.bots.slice() : [];
    bots.sort((a, b) => {
      const creatorCompare = String(a?.creator_id || "").localeCompare(String(b?.creator_id || ""));
      if (creatorCompare !== 0) return creatorCompare;
      return String(a?.platform || "").localeCompare(String(b?.platform || ""));
    });

    return {
      schemaVersion: payload?.schema_version || null,
      generatedAt: payload?.generated_at || null,
      serverGeneratedAt: payload?.server_generated_at || payload?.generated_at || null,
      count: typeof payload?.count === "number" ? payload.count : bots.length,
      supportedPlatforms: sortPlatformKeys(
        supportedPlatforms.map((platform) => normalizePlatformKey(platform))
      ),
      platformCapabilitiesRaw,
      platformRows,
      bots
    };
  }

  function defaultDeploySchema(platform) {
    const key = normalizePlatformKey(platform);
    if (!key) return null;
    const fallback = DEPLOY_PLATFORM_SCHEMA_FALLBACK[key];
    if (fallback) {
      return { ...fallback };
    }
    return {
      platform: key,
      label: platformDisplayName(key),
      deployEnabled: true,
      staged: false,
      blockedReason: "",
      targetLabel: "Target Identifier",
      targetPlaceholder: "Target identifier",
      targetHelp: "Identifier consumed by runtime manual deploy endpoint.",
      extraHelp: ""
    };
  }

  function buildFallbackDeploySchemas() {
    const schemas = Object.create(null);
    Object.keys(DEPLOY_PLATFORM_SCHEMA_FALLBACK).forEach((platform) => {
      schemas[platform] = defaultDeploySchema(platform);
    });
    return schemas;
  }

  function normalizeDeploySchemaEntry(entry, platformHint = "") {
    const raw = entry && typeof entry === "object" ? entry : {};
    const platform = normalizePlatformKey(
      platformHint || raw.platform || raw.id || raw.name
    );
    if (!platform) return null;

    const base = defaultDeploySchema(platform);
    if (!base) return null;
    const explicitDeploy = parseBooleanLike(
      raw.manual_deploy ??
        raw.manualDeploy ??
        raw.manual_deploy_enabled ??
        raw.manualDeployEnabled ??
        raw.deploy_enabled ??
        raw.deployEnabled ??
        raw.supports_manual_deploy ??
        raw.supportsManualDeploy ??
        raw.supported
    );
    const explicitStaged = parseBooleanLike(
      raw.staged ?? raw.is_staged ?? raw.planned ?? raw.disabled
    );
    const deployEnabled = explicitDeploy === null ? base.deployEnabled : explicitDeploy;
    const staged = explicitStaged === null ? base.staged || !deployEnabled : explicitStaged;
    const blockedReason =
      String(
        raw.disabled_reason ||
          raw.disabledReason ||
          raw.reason ||
          raw.note ||
          (deployEnabled ? "" : base.blockedReason || "Platform deploy is disabled.")
      ).trim();

    return {
      ...base,
      platform,
      label: String(raw.label || raw.display_name || raw.displayName || base.label).trim() || base.label,
      deployEnabled,
      staged,
      blockedReason,
      targetLabel:
        String(raw.target_label || raw.targetLabel || base.targetLabel).trim() || base.targetLabel,
      targetPlaceholder:
        String(raw.target_placeholder || raw.targetPlaceholder || base.targetPlaceholder).trim() ||
        base.targetPlaceholder,
      targetHelp: String(raw.target_help || raw.targetHelp || base.targetHelp).trim() || base.targetHelp,
      extraHelp: String(raw.extra_help || raw.extraHelp || base.extraHelp).trim() || base.extraHelp
    };
  }

  function resolveDeployPlatformSchemas(normalizedPayload) {
    const schemas = Object.create(null);
    const rawCapabilities = normalizedPayload?.platformCapabilitiesRaw;
    if (Array.isArray(rawCapabilities)) {
      rawCapabilities.forEach((entry) => {
        const normalized = normalizeDeploySchemaEntry(entry);
        if (!normalized) return;
        schemas[normalized.platform] = normalized;
      });
    } else if (rawCapabilities && typeof rawCapabilities === "object") {
      Object.keys(rawCapabilities).forEach((platformKey) => {
        const entry = rawCapabilities[platformKey];
        if (entry && typeof entry === "object") {
          const normalized = normalizeDeploySchemaEntry(entry, platformKey);
          if (!normalized) return;
          schemas[normalized.platform] = normalized;
          return;
        }
        if (typeof entry === "boolean") {
          const base = defaultDeploySchema(platformKey);
          if (!base) return;
          schemas[base.platform] = {
            ...base,
            deployEnabled: entry,
            staged: !entry || base.staged,
            blockedReason:
              entry ? "" : base.blockedReason || "Platform deploy is disabled."
          };
        }
      });
    }

    const supportedPlatforms = Array.isArray(normalizedPayload?.supportedPlatforms)
      ? normalizedPayload.supportedPlatforms
      : [];
    supportedPlatforms.forEach((platform) => {
      const key = normalizePlatformKey(platform);
      if (!key) return;
      const base = schemas[key] || defaultDeploySchema(key);
      if (!base) return;
      schemas[key] = {
        ...base,
        deployEnabled: true,
        staged: false,
        blockedReason: ""
      };
    });

    if (Object.keys(schemas).length > 0) {
      return schemas;
    }
    return buildFallbackDeploySchemas();
  }

  function getDeployPlatformSchema(platform) {
    const key = normalizePlatformKey(platform);
    if (!key) return null;
    return state.deployPlatformSchemas?.[key] || null;
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

  function buildPlatformSummary(normalizedPayload, deployPlatformSchemas, options = {}) {
    const runtimePlatforms = Object.create(null);
    const runtimeRows = Array.isArray(normalizedPayload?.platformRows)
      ? normalizedPayload.platformRows
      : [];
    runtimeRows.forEach((row) => {
      runtimePlatforms[row.platform] = row;
    });
    const keys = sortPlatformKeys(
      Object.keys({
        ...(deployPlatformSchemas || {}),
        ...runtimePlatforms
      })
    );
    const fallbackMode = options?.fallback === true;
    const fallbackReason =
      options?.fallbackReason || "STALE / FALLBACK: runtime platform status unavailable.";

    const summary = Object.create(null);
    keys.forEach((platform) => {
      const schema = deployPlatformSchemas?.[platform] || null;
      const runtime = runtimePlatforms[platform] || null;
      const deployEnabled = schema?.deployEnabled === true;
      let availability = "unavailable";
      let reason = "No active runtime availability reported.";
      if (!deployEnabled) {
        availability = "staged";
        reason = schema?.blockedReason || "Staged/disabled for runtime manual deploy.";
      } else if (fallbackMode) {
        availability = "unavailable";
        reason = fallbackReason;
      } else if (runtime?.paused) {
        availability = "paused";
        reason = runtime.pausedReason || "Paused by runtime control.";
      } else if (
        runtime?.available === true ||
        runtime?.status === "connected" ||
        runtime?.status === "online" ||
        runtime?.status === "active" ||
        runtime?.status === "running"
      ) {
        availability = "active";
        reason = "Runtime available.";
      } else if (runtime?.status === "error" || runtime?.error) {
        availability = "unavailable";
        reason = runtime?.error || "Runtime reported an error.";
      } else if (runtime?.status === "staged") {
        availability = "staged";
        reason = runtime?.disabledReason || schema?.blockedReason || "Staged/disabled.";
      }

      summary[platform] = {
        platform,
        label: schema?.label || runtime?.label || platformDisplayName(platform),
        deployEnabled,
        staged: schema?.staged === true || !deployEnabled,
        availability,
        status: !deployEnabled ? "staged" : runtime?.status || (fallbackMode ? "fallback" : "unknown"),
        paused: runtime?.paused === true,
        pausedReason: runtime?.pausedReason || "",
        reason,
        lastLog: runtime?.lastLog || null,
        isFallback: fallbackMode
      };
    });

    return summary;
  }

  function buildLiveBotCounts(normalizedPayload, platformSummary) {
    const byPlatform = Object.create(null);
    const bots = Array.isArray(normalizedPayload?.bots) ? normalizedPayload.bots : [];
    bots.forEach((bot) => {
      const key = normalizePlatformKey(bot?.platform);
      if (!key) return;
      byPlatform[key] = (byPlatform[key] || 0) + 1;
    });
    Object.keys(platformSummary || {}).forEach((platform) => {
      if (!Number.isFinite(byPlatform[platform])) {
        byPlatform[platform] = 0;
      }
    });
    return {
      byPlatform,
      total: bots.length
    };
  }

  function severityBadgeClass(severity) {
    const normalized = String(severity || "").trim().toLowerCase();
    if (normalized === "error") return "ss-badge-danger";
    if (normalized === "warning") return "ss-badge-warning";
    return "ss-badge-success";
  }

  function renderPlatformSummary(platformSummary, options = {}) {
    if (!el.platformsGrid) return;
    const liveCounts = options?.liveCounts || { byPlatform: Object.create(null), total: 0 };

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
              : availability === "staged"
                ? "is-staged"
              : "is-unavailable";
        const badgeLabel =
          availability === "paused"
            ? "Paused"
            : availability === "active"
              ? "Ready"
              : availability === "staged"
                ? "Staged/Disabled"
              : "Unavailable";
        const liveCount = Number.isFinite(liveCounts.byPlatform?.[entry.platform])
          ? liveCounts.byPlatform[entry.platform]
          : 0;
        const lastLog = entry?.lastLog;
        const hasLog = Boolean(lastLog && String(lastLog.message || "").trim());
        const runtimeMessageFallback =
          String(entry?.error || "").trim() ||
          String(entry?.pausedReason || "").trim() ||
          String(entry?.reason || "").trim();
        const logMessage = hasLog
          ? String(lastLog.message || "").trim()
          : runtimeMessageFallback || "No runtime log reported.";
        const logSeverity = hasLog
          ? String(lastLog.severity || "info").trim().toLowerCase()
          : entry?.error
            ? "error"
            : entry?.pausedReason
              ? "warning"
              : "info";
        const logTimestamp = hasLog
          ? formatTimestampCompact(lastLog.timestamp)
          : "--";
        const logPreview = truncateForCard(logMessage, 110);
        return `
          <article class="ss-bots-platform-chip ${stateClass}">
            <img class="ss-bots-platform-logo" src="${escapeHtml(
          platformIconPath(entry.platform)
        )}" alt="${escapeHtml(entry.label)} logo" loading="lazy" decoding="async" />
            <div class="ss-bots-platform-name">${escapeHtml(entry.label)}</div>
            <div>${renderStatus(badgeLabel)}</div>
            <div class="ss-bots-platform-live">LIVE: ${escapeHtml(String(liveCount))}</div>
            <div class="ss-bot-platform-note">${escapeHtml(entry.reason)}</div>
            <div class="ss-bot-platform-log">
              <span class="ss-badge ${severityBadgeClass(logSeverity)}">${escapeHtml(
          logSeverity.toUpperCase()
        )}</span>
              <span class="ss-bot-platform-log-time">${escapeHtml(logTimestamp)}</span>
            </div>
            <div class="ss-bot-platform-log-message" title="${escapeHtml(logMessage)}">${escapeHtml(
          logPreview
        )}</div>
          </article>
        `;
      })
      .join("");

    if (el.platformsStatus) {
      const modeLabel = options?.live === true ? "Live" : "STALE / FALLBACK";
      const updatedLabel = formatTimestamp(options?.updatedAt || null);
      const pausedCount = entries.filter((entry) => entry.availability === "paused").length;
      const activeCount = entries.filter((entry) => entry.availability === "active").length;
      const stagedCount = entries.filter((entry) => entry.availability === "staged").length;
      const unavailableCount = entries.filter(
        (entry) => entry.availability === "unavailable"
      ).length;
      el.platformsStatus.textContent =
        `${modeLabel} | Last updated ${updatedLabel} | Ready ${activeCount} | Paused ${pausedCount} | ` +
        `Unavailable ${unavailableCount} | Staged ${stagedCount}`;
    }
    if (el.liveTotal) {
      const totalLive = Number.isFinite(liveCounts.total) ? liveCounts.total : 0;
      el.liveTotal.textContent = `TOTAL LIVE BOTS: ${totalLive}`;
    }
  }

  function renderActionCell(bot, platformState) {
    const creatorId = String(bot?.creator_id || "");
    const platform = String(bot?.platform || "");
    const ui = getRowUi(creatorId, platform);
    const deploySchema = getDeployPlatformSchema(platform);
    const deploySupported = deploySchema?.deployEnabled === true;
    const runtimeOffline = !isRuntimeAvailable();
    const runtimePaused = platformState?.paused === true;
    const deployBlockedMessage = !deploySupported
      ? deploySchema?.blockedReason || "Manual deploy is unavailable for this platform."
      : "";
    const attachDisabled =
      ui.pending ||
      runtimeOffline ||
      runtimePaused ||
      !deploySupported ||
      !canAttach(bot);
    const detachDisabled = ui.pending || runtimeOffline || !deploySupported || !canDetach(bot);
    const botPauseReason = String(bot?.pause_reason || "").trim();
    const pauseReason = botPauseReason || String(platformState?.pausedReason || "").trim();
    const isPaused = String(bot?.status || "").trim().toLowerCase() === "paused" || runtimePaused;
    const resumeDisabled =
      ui.pending ||
      runtimeOffline ||
      !deploySupported ||
      !isPaused ||
      !String(bot?.active_target || "").trim();
    const clearDisabled = ui.pending || runtimeOffline || !isPaused;
    const attachLabel =
      ui.pending && ui.pendingAction === "attach" ? "Deploying..." : "Manual Deploy";
    const detachLabel = ui.pending && ui.pendingAction === "detach" ? "Detaching..." : "Detach";
    const resumeLabel = ui.pending && ui.pendingAction === "resume" ? "Resuming..." : "Resume";
    const clearLabel = ui.pending && ui.pendingAction === "clear" ? "Clearing..." : "Clear";
    const rowError = String(ui.error || "");
    const pausedMessage = isPaused
      ? pauseReason || "Paused by runtime control."
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
        ${isPaused
          ? `
        <div class="ss-bot-actions-row">
          <button
            class="ss-btn ss-btn-small ss-btn-secondary"
            data-bot-action="resume"
            data-creator-id="${encodeData(creatorId)}"
            data-platform="${encodeData(platform)}"
            ${resumeDisabled ? "disabled" : ""}
          >${resumeLabel}</button>
          <button
            class="ss-btn ss-btn-small ss-btn-danger"
            data-bot-action="clear"
            data-creator-id="${encodeData(creatorId)}"
            data-platform="${encodeData(platform)}"
            ${clearDisabled ? "disabled" : ""}
          >${clearLabel}</button>
        </div>`
          : ""}
        ${runtimeOffline
          ? `<div class="ss-bot-actions-row-note">${escapeHtml(runtimeOfflineMessage)}</div>`
          : ""}
        ${isPaused
          ? `<div class="ss-bot-actions-row-note">${escapeHtml(`Paused: ${pausedMessage}`)}</div>`
          : ""}
        ${deployBlockedMessage
          ? `<div class="ss-bot-actions-row-note">${escapeHtml(deployBlockedMessage)}</div>`
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
      const lastError =
        String(bot?.last_error || "").trim() ||
        String(bot?.pause_reason || "").trim() ||
        String(platformState?.pausedReason || "").trim();
      const hasError = Boolean(lastError);
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
          <td class="${errorClass}">${escapeHtml(hasError ? lastError : "—")}</td>
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
    const platform = normalizePlatformKey(el.manualPlatform?.value);
    const schema = getDeployPlatformSchema(platform);
    const creatorId = String(el.manualCreator?.value || "").trim();
    return {
      creatorId,
      platform,
      schema,
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

  function hasManualCreatorOptions() {
    return Array.isArray(state.creators) && state.creators.length > 0;
  }

  function getManualDeployBlockedReason(platform, creatorId = "") {
    if (!hasManualCreatorOptions()) {
      return "No runtime creators available. Manual deploy is disabled.";
    }
    if (creatorId) {
      const exists = state.creators.some(
        (creator) => String(creator?.creator_id || "").trim() === creatorId
      );
      if (!exists) {
        return "Selected creator is not in runtime creators registry.";
      }
    }
    if (!platform) return "";
    const schema = getDeployPlatformSchema(platform);
    if (!schema) {
      return "Platform is not available for runtime manual deploy.";
    }
    if (schema.deployEnabled !== true) {
      return schema.blockedReason || "Platform deploy is staged/disabled.";
    }
    if (!isRuntimeAvailable()) return "Runtime is offline.";
    return getPausedPlatformMessage(platform);
  }

  function updateManualCreatorSuggestions() {
    if (!el.manualCreator) return;
    const selected = String(el.manualCreator.value || "").trim();
    const options = (state.creators || [])
      .map((creator) => ({
        creator_id: String(creator?.creator_id || "").trim(),
        display_name: String(creator?.display_name || "").trim()
      }))
      .filter((creator) => creator.creator_id)
      .sort((a, b) => a.creator_id.localeCompare(b.creator_id));

    const optionMarkup = options
      .map((creator) => {
        const label = creator.display_name
          ? `${creator.creator_id} - ${creator.display_name}`
          : creator.creator_id;
        return `<option value="${escapeHtml(creator.creator_id)}">${escapeHtml(label)}</option>`;
      })
      .join("");

    el.manualCreator.innerHTML = `<option value="">Select creator</option>${optionMarkup}`;
    if (selected && options.some((creator) => creator.creator_id === selected)) {
      el.manualCreator.value = selected;
    } else {
      el.manualCreator.value = "";
    }
  }

  function renderManualPlatformOptions() {
    if (!el.manualPlatform) return;
    const selected = normalizePlatformKey(el.manualPlatform.value);
    const options = sortPlatformKeys(Object.keys(state.deployPlatformSchemas || {}));
    const optionMarkup = options
      .map((platform) => {
        const schema = state.deployPlatformSchemas[platform];
        if (!schema) return "";
        const suffix = schema.deployEnabled ? "" : " (Staged/Disabled)";
        return `<option value="${escapeHtml(platform)}">${escapeHtml(
          `${schema.label || platformDisplayName(platform)}${suffix}`
        )}</option>`;
      })
      .join("");
    el.manualPlatform.innerHTML = `<option value="">Select platform</option>${optionMarkup}`;
    if (selected && state.deployPlatformSchemas[selected]) {
      el.manualPlatform.value = selected;
    } else {
      el.manualPlatform.value = "";
    }
  }

  function renderManualPlatformFieldset(platform) {
    if (!el.manualPlatformFields) return;
    const key = normalizePlatformKey(platform);
    if (state.manualDeploy.renderedPlatform === key && (key ? true : !el.manualTarget)) {
      return;
    }
    state.manualDeploy.renderedPlatform = key;

    if (!key) {
      el.manualPlatformFields.innerHTML = "";
      el.manualTarget = null;
      return;
    }

    const schema = getDeployPlatformSchema(key);
    if (!schema) {
      el.manualPlatformFields.innerHTML = "";
      el.manualTarget = null;
      return;
    }

    if (schema.deployEnabled !== true) {
      const blockedReason = schema.blockedReason || "Manual deploy is not available.";
      el.manualPlatformFields.innerHTML = `
        <fieldset class="ss-bots-manual-fieldset" data-platform-fieldset="${escapeHtml(key)}">
          <p class="muted ss-bots-manual-field-help">${escapeHtml(blockedReason)}</p>
        </fieldset>
      `;
      el.manualTarget = null;
      return;
    }

    el.manualPlatformFields.innerHTML = `
      <fieldset class="ss-bots-manual-fieldset" data-platform-fieldset="${escapeHtml(key)}">
        <div class="ss-form-row">
          <label for="bots-manual-target">${escapeHtml(schema.targetLabel)}</label>
          <input
            id="bots-manual-target"
            name="target_identifier"
            type="text"
            autocomplete="off"
            placeholder="${escapeHtml(schema.targetPlaceholder)}"
            required
          />
          <div class="muted ss-bots-manual-field-help">${escapeHtml(schema.targetHelp)}</div>
          ${
            schema.extraHelp
              ? `<div class="muted ss-bots-manual-field-help">${escapeHtml(schema.extraHelp)}</div>`
              : ""
          }
        </div>
      </fieldset>
    `;
    el.manualTarget = $("bots-manual-target");
    if (el.manualTarget) {
      el.manualTarget.disabled = state.manualDeploy.pending;
    }
  }

  function updateManualDeployUi() {
    if (!el.manualToggle || !el.manualForm) return;

    const creatorsAvailable = hasManualCreatorOptions();
    const formOpen = state.manualFormOpen === true;
    el.manualForm.classList.toggle("hidden", !formOpen);
    el.manualToggle.textContent = formOpen ? "Hide Manual Deploy" : "Manual Deploy Bot";
    el.manualToggle.disabled = !creatorsAvailable;
    el.manualToggle.setAttribute("aria-disabled", creatorsAvailable ? "false" : "true");

    const values = manualFormValues();
    renderManualPlatformFieldset(values.platform);
    const refreshed = manualFormValues();
    const requiresTarget = refreshed.schema?.deployEnabled === true;
    const blockedReason = getManualDeployBlockedReason(refreshed.platform, refreshed.creatorId);
    const hasRequiredFields = Boolean(
      refreshed.creatorId &&
        refreshed.platform &&
        (!requiresTarget || refreshed.targetIdentifier)
    );
    const submitDisabled = state.manualDeploy.pending || Boolean(blockedReason) || !hasRequiredFields;

    if (el.manualSubmit) {
      el.manualSubmit.disabled = submitDisabled;
      el.manualSubmit.textContent = state.manualDeploy.pending ? "Deploying..." : "Deploy Bot";
    }

    if (el.manualCreator) {
      el.manualCreator.disabled = state.manualDeploy.pending || !creatorsAvailable;
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
        (refreshed.schema?.deployEnabled === true
          ? "Manual deploy will create bot instance if needed."
          : refreshed.platform
            ? refreshed.schema?.blockedReason || "Platform deploy is staged/disabled."
          : "Choose creator, platform, and target.");
      el.manualNote.textContent = note;
    }
  }

  function getManualRequiredTargetMessage(schema) {
    if (!schema || schema.deployEnabled !== true) return "Target identifier is required.";
    const label = String(schema.targetLabel || "Target identifier").trim();
    return `${label} is required.`;
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
    const blockedReason = getManualDeployBlockedReason(values.platform, values.creatorId);
    if (blockedReason) {
      setManualError(blockedReason);
      updateManualDeployUi();
      return;
    }

    if (!values.creatorId || !values.platform) {
      setManualError("Creator and platform are required.");
      updateManualDeployUi();
      return;
    }

    if (!values.schema) {
      setManualError("Selected platform is unavailable for manual deploy.");
      updateManualDeployUi();
      return;
    }

    if (values.schema.deployEnabled !== true) {
      setManualError(values.schema.blockedReason || "Selected platform deploy is disabled.");
      updateManualDeployUi();
      return;
    }

    if (!values.targetIdentifier) {
      setManualError(getManualRequiredTargetMessage(values.schema));
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
        target_identifier: values.targetIdentifier,
        target: values.targetIdentifier
      };
      if (values.platform === "twitch") {
        payload.channel_login = values.targetIdentifier;
      }

      const response = await fetch(buildApiUrl(MANUAL_DEPLOY_ENDPOINT), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });

      const responsePayload = await readJsonSafe(response);
      if (!response.ok || responsePayload?.success === false) {
        const detail =
          responsePayload?.error ||
          responsePayload?.message ||
          `Manual deploy failed (HTTP ${response.status}).`;
        setManualError(String(detail));
        return;
      }

      const result = responsePayload?.result || null;
      const pausedOnDeploy = String(result?.status || "").trim().toLowerCase() === "paused";
      if (pausedOnDeploy) {
        const pausedDetail =
          String(result?.pause_reason || "").trim() ||
          String(result?.last_error || "").trim() ||
          "Instance paused by runtime control.";
        setManualError(`Deploy created a paused instance: ${pausedDetail}`);
      } else {
        setManualError("");
      }
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
      if (state.hydrationLive) {
        const received = formatTimestamp(new Date(receivedAt).toISOString());
        el.status.textContent = `Live runtime API (${received})`;
      } else {
        el.status.textContent = state.hydrationLabel || "Runtime unreachable - bot status unavailable";
      }
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

  function normalizeCreatorsPayload(payload) {
    const rows = Array.isArray(payload?.creators) ? payload.creators : [];
    return rows
      .map((entry) => {
        const creatorId = String(entry?.creator_id || "").trim();
        if (!creatorId) return null;
        return {
          creator_id: creatorId,
          display_name: String(entry?.display_name || creatorId).trim() || creatorId,
          tier: String(entry?.tier || "").trim().toLowerCase(),
          status: String(entry?.status || "").trim().toLowerCase()
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.creator_id.localeCompare(b.creator_id));
  }

  async function fetchCreators() {
    const endpoint = buildApiUrl(CREATORS_ENDPOINT);
    const res = await fetch(endpoint, {
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const payload = await res.json();
    if (payload?.success === false) {
      const detail = String(payload?.error || payload?.message || "Creators endpoint failed");
      throw new Error(detail);
    }
    return normalizeCreatorsPayload(payload);
  }

  function render(normalized) {
    const now = Date.now();
    const hasLivePlatformRows =
      Array.isArray(normalized?.platformRows) && normalized.platformRows.length > 0;
    state.lastPayload = normalized;
    state.deployPlatformSchemas = resolveDeployPlatformSchemas(normalized);
    state.platformSummary = buildPlatformSummary(
      normalized,
      state.deployPlatformSchemas,
      {
        fallback: !hasLivePlatformRows,
        fallbackReason: "STALE / FALLBACK: runtime API did not return platform availability."
      }
    );
    state.lastReceivedAt = now;
    state.hydrationLive = hasLivePlatformRows;
    state.hydrationLabel = hasLivePlatformRows
      ? "Live runtime API"
      : "Runtime API reachable - STALE / FALLBACK platform availability";
    setRuntimeAvailable(true);

    if (el.source) {
      el.source.textContent = `Source: ${state.sourceUrl || buildApiUrl(BOTS_STATUS_ENDPOINT)}`;
    }

    updateMeta(normalized, now);
    const liveCounts = buildLiveBotCounts(normalized, state.platformSummary);

    renderPlatformSummary(state.platformSummary, {
      live: hasLivePlatformRows,
      updatedAt: normalized?.serverGeneratedAt || normalized?.generatedAt || null,
      liveCounts
    });
    renderManualPlatformOptions();
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
    try {
      const [normalized, creators] = await Promise.all([fetchPayload(), fetchCreators()]);
      state.creators = Array.isArray(creators) ? creators : [];
      setError("");
      render(normalized);
    } catch (err) {
      setRuntimeAvailable(false);
      state.creators = [];
      state.lastPayload = { bots: [], supportedPlatforms: [], generatedAt: null };
      state.deployPlatformSchemas = buildFallbackDeploySchemas();
      state.platformSummary = buildPlatformSummary(null, state.deployPlatformSchemas, {
        fallback: true,
        fallbackReason: "STALE / FALLBACK: runtime API unreachable."
      });
      state.lastReceivedAt = Date.now();
      state.hydrationLive = false;
      state.hydrationLabel = "Runtime unreachable - bot status unavailable";
      if (el.status) {
        el.status.textContent = state.hydrationLabel;
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
      renderPlatformSummary(state.platformSummary, {
        live: false,
        updatedAt: null,
        liveCounts: buildLiveBotCounts(state.lastPayload, state.platformSummary)
      });
      renderManualPlatformOptions();
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
    state.creators = [];
    state.lastPayload = { bots: [], supportedPlatforms: [], generatedAt: null };
    state.deployPlatformSchemas = buildFallbackDeploySchemas();
    state.platformSummary = buildPlatformSummary(null, state.deployPlatformSchemas, {
      fallback: true,
      fallbackReason: "STALE / FALLBACK: runtime unavailable."
    });
    state.lastReceivedAt = Date.now();
    state.hydrationLive = false;
    state.hydrationLabel = "Runtime offline - bot status unavailable";
    if (el.status) {
      el.status.textContent = state.hydrationLabel;
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
    renderPlatformSummary(state.platformSummary, {
      live: false,
      updatedAt: null,
      liveCounts: buildLiveBotCounts(state.lastPayload, state.platformSummary)
    });
    renderManualPlatformOptions();
    if (el.empty) {
      el.empty.classList.remove("hidden");
    }
    updateManualCreatorSuggestions();
    updateManualDeployUi();
    setError("");
  }

  function tick() {
    if (!state.lastPayload || !state.lastReceivedAt) return;
    renderRowsAndCountersFromState(Date.now());
    updateMeta(state.lastPayload, state.lastReceivedAt);
  }

  function renderRowsAndCountersFromState(receivedAt = Date.now()) {
    if (!state.lastPayload) return;
    const hasRows = Array.isArray(state.lastPayload.bots) && state.lastPayload.bots.length > 0;
    if (el.body) {
      el.body.innerHTML = hasRows
        ? renderRows(state.lastPayload, receivedAt, state.platformSummary)
        : "";
    }
    if (el.empty) {
      el.empty.classList.toggle("hidden", hasRows);
    }
    renderPlatformSummary(state.platformSummary, {
      live: state.hydrationLive,
      updatedAt: state.lastPayload?.serverGeneratedAt || state.lastPayload?.generatedAt || null,
      liveCounts: buildLiveBotCounts(state.lastPayload, state.platformSummary)
    });
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
    const deploySchema = getDeployPlatformSchema(platform);
    if (!deploySchema || deploySchema.deployEnabled !== true) {
      ui.error = deploySchema?.blockedReason || "Manual deploy is unavailable for this platform.";
      renderRowsAndCountersFromState();
      return;
    }
    const platformState = state.platformSummary?.[normalizePlatformKey(platform)] || null;
    if (platformState?.paused && action === "attach") {
      ui.error = platformState.pausedReason || "Platform is paused by runtime control.";
      renderRowsAndCountersFromState();
      return;
    }

    let targetIdentifier = null;
    if (action === "attach") {
      const currentTarget = String(bot?.active_target || "").trim();
      const promptDefault = currentTarget && currentTarget !== "-" ? currentTarget : "";
      const promptTargetLabel = String(
        deploySchema.targetLabel || "target identifier"
      ).trim();
      const prompted = window.prompt(
        `Manual deploy target for ${creatorId} (${deploySchema.label}):\nEnter ${promptTargetLabel}.`,
        promptDefault
      );
      if (prompted === null) return;
      const trimmed = String(prompted || "").trim();
      if (!trimmed) {
        ui.error = getManualRequiredTargetMessage(deploySchema);
        renderRowsAndCountersFromState();
        return;
      }
      targetIdentifier = trimmed;
      if (platform.toLowerCase() === "twitch") {
        targetIdentifier = targetIdentifier.replace(/^#/, "").trim();
      }
    } else if (action === "detach") {
      const currentTarget = String(bot?.active_target || "").trim();
      targetIdentifier = currentTarget && currentTarget !== "-" ? currentTarget : null;
    } else if (action === "resume") {
      const currentTarget = String(bot?.active_target || "").trim();
      targetIdentifier = currentTarget && currentTarget !== "-" ? currentTarget : null;
      if (!targetIdentifier) {
        ui.error = "Cannot resume: missing target identifier.";
        renderRowsAndCountersFromState();
        return;
      }
    } else if (action === "clear") {
      targetIdentifier = null;
    }

    ui.pending = true;
    ui.pendingAction = action;
    ui.error = "";
    renderRowsAndCountersFromState();

    try {
      let response;
      if (action === "clear") {
        const query = `?creator_id=${encodeURIComponent(creatorId)}&platform=${encodeURIComponent(platform)}`;
        response = await fetch(buildApiUrl(`${MANUAL_CLEAR_ENDPOINT}${query}`), {
          method: "DELETE",
          credentials: "include",
          headers: {
            Accept: "application/json"
          }
        });
      } else {
        const endpoint = action === "resume" ? MANUAL_RESUME_ENDPOINT : MANUAL_DEPLOY_ENDPOINT;
        const payload = {
          action,
          platform,
          creator_id: creatorId,
          target_identifier: targetIdentifier
        };
        if (action === "attach") {
          payload.target = targetIdentifier;
          if (platform.toLowerCase() === "twitch") {
            payload.channel_login = targetIdentifier;
          }
        }
        response = await fetch(buildApiUrl(endpoint), {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(payload)
        });
      }

      const responsePayload = await readJsonSafe(response);
      if (!response.ok || responsePayload?.success === false) {
        const detail =
          responsePayload?.error ||
          responsePayload?.message ||
          `Manual ${action} failed (HTTP ${response.status}).`;
        ui.error = String(detail);
        return;
      }

      const result = responsePayload?.result || null;
      const paused =
        String(result?.status || "").trim().toLowerCase() === "paused" ||
        String(result?.pause_reason || "").trim() !== "";
      if (paused && action !== "clear") {
        ui.error =
          String(result?.pause_reason || "").trim() ||
          String(result?.last_error || "").trim() ||
          "Paused by runtime control.";
      } else {
        ui.error = "";
      }
      await refresh();
    } catch (err) {
      ui.error = err?.message ? String(err.message) : `Manual ${action} failed.`;
    } finally {
      ui.pending = false;
      ui.pendingAction = "";
      renderRowsAndCountersFromState();
    }
  }

  function onBodyClick(event) {
    const button = event.target.closest("[data-bot-action]");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;

    const action = String(button.dataset.botAction || "").trim().toLowerCase();
    if (!["attach", "detach", "resume", "clear"].includes(action)) return;

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
    el.liveTotal = $("bots-live-total");
    el.manualToggle = $("bots-manual-toggle");
    el.manualForm = $("bots-manual-form");
    el.manualCreator = $("bots-manual-creator");
    el.manualPlatform = $("bots-manual-platform");
    el.manualPlatformFields = $("bots-manual-platform-fields");
    el.manualTarget = null;
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
    state.deployPlatformSchemas = buildFallbackDeploySchemas();
    renderManualPlatformOptions();
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
    state.manualDeploy = { pending: false, error: "", renderedPlatform: "" };
    state.lastPayload = null;
    state.deployPlatformSchemas = Object.create(null);
    state.creators = [];
    state.platformSummary = Object.create(null);
    state.lastReceivedAt = null;
    state.sourceUrl = null;
    state.hydrationLive = false;
    state.hydrationLabel = "Waiting for runtime status...";
    state.rowUi = Object.create(null);
  }

  window.BotsView = {
    init,
    destroy
  };
})();

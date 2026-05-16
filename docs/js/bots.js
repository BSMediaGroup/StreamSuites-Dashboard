/* ============================================================
   StreamSuites Dashboard - Bots view (admin/debug)
   ============================================================ */

(() => {
  "use strict";

  const POLL_INTERVAL_MS = 8000;
  const BOTS_STATUS_ENDPOINT = "/api/admin/bots/status";
  const BOTS_DEBUG_ENDPOINT = "/api/admin/bots/debug";
  const BOTS_DEBUG_PROBE_ENDPOINT = "/api/admin/bots/debug/probe";
  const CREATORS_ENDPOINT = "/api/admin/creators";
  const MANUAL_DEPLOY_ENDPOINT = "/api/admin/bots/deploy";
  const MANUAL_DETACH_ENDPOINT = "/api/admin/bots/detach";
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
  const PLACEHOLDER_REASON_CODES = new Set([
    "auto_deploy_disabled",
    "creator_disabled",
    "disabled",
    "no_target_exported",
    "not_configured",
    "rumble_not_connected",
    "unconfigured"
  ]);
  const PLACEHOLDER_LIFECYCLE_STATES = new Set([
    "",
    "blocked",
    "disabled",
    "not_desired",
    "offline",
    "paused",
    "stopped"
  ]);
  const WAITING_STATE_CODES = new Set([
    "awaiting_chat_room",
    "awaiting_first_webhook_event",
    "awaiting_livestream",
    "lifecycle_awaiting_livestream",
    "runner_awaiting_livestream",
    "transport_awaiting_livestream"
  ]);

  const state = {
    pollHandle: null,
    refreshInFlight: null,
    refreshAbortController: null,
    mounted: false,
    lastPayload: null,
    deployPlatformSchemas: Object.create(null),
    creators: [],
    platformSummary: Object.create(null),
    lastReceivedAt: null,
    sourceUrl: null,
    hydrationLive: false,
    hydrationLabel: "Waiting for runtime status...",
    rowUi: Object.create(null),
    expandedCreators: Object.create(null),
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
    },
    renderCache: {
      rowSignature: "",
      platformSignature: "",
      creatorsSignature: "",
      manualPlatformSignature: ""
    }
  };

  const el = {
    status: null,
    count: null,
    generatedAt: null,
    source: null,
    error: null,
    hiddenNote: null,
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

  function stableStringify(value) {
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
    }
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  function normalizeReasonCode(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isWaitingStateCode(value) {
    const normalized = normalizeReasonCode(value);
    return WAITING_STATE_CODES.has(normalized);
  }

  function hasExportedTarget(bot) {
    if (String(bot?.active_target || "").trim()) return true;
    const target = bot?.resolved_target && typeof bot.resolved_target === "object" ? bot.resolved_target : {};
    return Object.keys(target).some((key) => String(target[key] || "").trim());
  }

  function hasAttemptEvidence(bot) {
    return Boolean(
      bot?.last_attach_attempt_at ||
        bot?.last_dispatch_attempt_at ||
        bot?.last_subscription_attempt_at ||
        bot?.last_transport_heartbeat_at ||
        bot?.last_message_at ||
        bot?.connected_at
    );
  }

  function hasPlaceholderReasonOnly(bot) {
    const reasonValues = [
      bot?.pause_reason,
      bot?.last_error,
      bot?.status_reason,
      bot?.runner_state,
      bot?.blocking_reason,
      bot?.session_blocking_code
    ]
      .map((value) => normalizeReasonCode(value))
      .filter(Boolean);
    if (!reasonValues.length) return false;
    return reasonValues.every((value) => (
      PLACEHOLDER_REASON_CODES.has(value) ||
      Array.from(PLACEHOLDER_REASON_CODES).some((code) => value.includes(code))
    ));
  }

  function isHiddenPlaceholderBot(bot) {
    if (bot?.visible_in_admin === true || bot?.actionable === true) return false;
    if (bot?.visible_in_admin === false || bot?.session_origin === "placeholder") return true;
    const platform = normalizePlatformKey(bot?.platform);
    if (!["kick", "rumble"].includes(platform)) return false;
    if (bot?.manual_override === true) return false;
    if (bot?.desired === true) return false;
    if (hasExportedTarget(bot)) return false;
    if (hasAttemptEvidence(bot)) return false;
    const lifecycle = normalizeReasonCode(bot?.lifecycle_state || bot?.status);
    const configurationState = normalizeReasonCode(bot?.configuration_state);
    return (
      (configurationState === "unconfigured" || !configurationState) &&
      PLACEHOLDER_LIFECYCLE_STATES.has(lifecycle) &&
      hasPlaceholderReasonOnly(bot)
    );
  }

  function uniqueReasonCodes(values) {
    return Array.from(
      new Set(
        (Array.isArray(values) ? values : [])
          .map((value) => normalizeReasonCode(value))
          .filter(Boolean)
      )
    ).sort();
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

  function canManageRuntime() {
    return (
      window.StreamSuitesDashboardPermissions?.has?.("admin.dashboard.manage.runtime") ===
      true
    );
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
          disabledReason: String(entry?.disabled_reason || entry?.disabledReason || "").trim(),
          details: entry?.details && typeof entry.details === "object" ? { ...entry.details } : {},
          staged: entry?.staged === true || status === "staged",
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

    const rawBots = Array.isArray(payload?.bots) ? payload.bots.slice() : [];
    const hiddenPlaceholderCount = rawBots.filter((bot) => isHiddenPlaceholderBot(bot)).length;
    const platformHiddenCount = platformRows.reduce((total, row) => {
      const direct = Number(row?.hidden_placeholder_count);
      const nested = Number(row?.details?.hidden_placeholder_count);
      if (Number.isFinite(direct)) return total + direct;
      if (Number.isFinite(nested)) return total + nested;
      return total;
    }, 0);
    const bots = rawBots.filter((bot) => !isHiddenPlaceholderBot(bot));
    bots.sort((a, b) => {
      const creatorCompare = String(a?.creator_id || "").localeCompare(String(b?.creator_id || ""));
      if (creatorCompare !== 0) return creatorCompare;
      return String(a?.platform || "").localeCompare(String(b?.platform || ""));
    });

    return {
      schemaVersion: payload?.schema_version || null,
      generatedAt: payload?.generated_at || null,
      serverGeneratedAt: payload?.server_generated_at || payload?.generated_at || null,
      count: bots.length,
      hiddenPlaceholderCount: hiddenPlaceholderCount + platformHiddenCount,
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
    if (["ready", "online", "running", "active", "attached", "listening", "connected"].includes(normalized)) {
      return "ss-bot-status-online";
    }
    if (["offline", "disabled", "unavailable", "stopped"].includes(normalized)) {
      return "ss-bot-status-offline";
    }
    if (["error", "transport_error", "auth_failed", "target_unresolved", "blocked", "stale"].includes(normalized)) {
      return "ss-bot-status-error";
    }
    if (["mixed", "pending", "paused", "desired", "starting", "attaching", "awaiting_transport"].includes(normalized)) {
      return "ss-bot-status-paused";
    }
    return "";
  }

  function statusLabel(status) {
    const text = String(status || "").trim().replace(/_/g, " ");
    return text ? text : "-";
  }

  function renderStatus(status) {
    const tone = statusTone(status);
    const classes = ["ss-bot-status", tone].filter(Boolean).join(" ");
    return `<span class="${classes}">${escapeHtml(statusLabel(status))}</span>`;
  }

  function creatorKey(value) {
    const text = String(value || "").trim();
    return text || "unknown";
  }

  function rowKey(creatorId, platform) {
    return `${String(creatorId || "")}::${String(platform || "").toLowerCase()}`;
  }

  function getRowUi(creatorId, platform) {
    const key = rowKey(creatorId, platform);
    if (!state.rowUi[key]) {
      state.rowUi[key] = {
        pending: false,
        pendingAction: "",
        error: "",
        debugOpen: false,
        debugPending: false,
        debugProbePending: false,
        debugError: "",
        debugPayload: null
      };
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

  function renderBadge(label, tone = "") {
    const classes = ["ss-badge", tone].filter(Boolean).join(" ");
    return `<span class="${classes}">${escapeHtml(label)}</span>`;
  }

  function renderCompactChip(label, tone = "") {
    const classes = ["ss-bot-chip", tone].filter(Boolean).join(" ");
    return `<span class="${classes}">${escapeHtml(label)}</span>`;
  }

  function renderSessionCell(bot) {
    const sessionType = String(bot?.session_type || "manual").trim().toLowerCase() || "manual";
    const badges = [
      renderBadge(sessionType === "auto" ? "Managed" : "Manual", sessionType === "auto" ? "ss-badge-warning" : ""),
      renderManualOverride(bot?.manual_override === true)
    ];
    if (bot?.session_id) {
      badges.push(renderBadge(`ID ${String(bot.session_id).slice(0, 16)}`, ""));
    }
    return `
      <div class="ss-bot-cell-stack">
        <div class="ss-bot-badge-stack">${badges.join("")}</div>
        <div class="muted">${escapeHtml(bot?.creator_id || "-")}</div>
      </div>
    `;
  }

  function renderLifecycleCell(bot) {
    const status = String(bot?.status || "").trim().toLowerCase();
    const lifecycle = String(bot?.lifecycle_state || "").trim().toLowerCase();
    const statusLine = renderStatus(status || lifecycle || "unknown");
    const lifecycleLine = lifecycle
      ? renderBadge(`Lifecycle ${statusLabel(lifecycle)}`, managedSessionTone(lifecycle))
      : '<span class="muted">No lifecycle export</span>';
    const desiredLine = renderBadge(bot?.desired ? "Desired" : "Not desired", bot?.desired ? "ss-badge-success" : "");
    return `
      <div class="ss-bot-cell-stack">
        <div class="ss-bot-badge-stack">${statusLine}${lifecycleLine}${desiredLine}</div>
        <div class="muted">${escapeHtml(bot?.status_reason || "No lifecycle note.")}</div>
        ${bot?.is_stale ? `<div class="ss-bot-row-error has-error">Stale/debug warning: ${escapeHtml(bot?.stale_reason || "export state is stale")}</div>` : ""}
        ${bot?.debug_trace_source === "reconstructed" ? '<div class="muted">Debug trace will be reconstructed from export until a live trace is recorded.</div>' : ""}
      </div>
    `;
  }

  function managedSessionTone(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (["attached", "listening", "running", "listening_via_webhook", "transport_not_required_webhook_mode", "webhook_active"].includes(normalized)) return "ss-badge-success";
    if (["desired", "starting", "attaching", "awaiting_transport", "awaiting_livestream", "awaiting_chat_room", "awaiting_first_webhook_event", "subscription_pending"].includes(normalized)) return "ss-badge-warning";
    if (["blocked", "auth_failed", "target_unresolved", "transport_error", "stale", "subscription_failed"].includes(normalized)) {
      return "ss-badge-danger";
    }
    return "";
  }

  function renderTransportCell(bot) {
    const transport = String(bot?.runner_state || bot?.status || "").trim().toLowerCase();
    const transportStatus = String(bot?.status || "").trim().toLowerCase();
    const badges = [
      renderBadge(`Transport ${statusLabel(transportStatus)}`, managedSessionTone(transportStatus))
    ];
    if (bot?.runner_state) {
      badges.push(renderBadge(`Runner ${statusLabel(bot.runner_state)}`, managedSessionTone(bot.runner_state)));
    }
    return `
      <div class="ss-bot-cell-stack">
        <div class="ss-bot-badge-stack">${badges.join("")}</div>
        <div class="muted">${escapeHtml(formatTimestamp(bot?.last_transition_at))}</div>
      </div>
    `;
  }

  function renderTargetCell(bot) {
    const resolvedTarget = bot?.resolved_target && typeof bot.resolved_target === "object" ? bot.resolved_target : {};
    const watchUrl = String(resolvedTarget.watch_url || bot?.active_target || "").trim();
    const bits = [];
    if (watchUrl) {
      const label = /^https?:\/\//i.test(watchUrl) ? "Open watch target" : watchUrl;
      bits.push(
        /^https?:\/\//i.test(watchUrl)
          ? `<a class="creator-integrations-platform-link" href="${escapeHtml(watchUrl)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`
          : `<span>${escapeHtml(label)}</span>`
      );
    }
    if (resolvedTarget.channel_handle) bits.push(`<span>${escapeHtml(String(resolvedTarget.channel_handle))}</span>`);
    if (resolvedTarget.chat_id) bits.push(`<span>chat ${escapeHtml(String(resolvedTarget.chat_id))}</span>`);
    if (resolvedTarget.video_id) bits.push(`<span>video ${escapeHtml(String(resolvedTarget.video_id))}</span>`);
    return bits.length
      ? `<div class="ss-bot-cell-stack">${bits.join("")}</div>`
      : '<span class="muted">No target exported.</span>';
  }

  function renderHeartbeatCell(bot) {
    const uptimeSeconds = getDisplayUptimeSeconds(bot);
    const uptimeLabel = uptimeSeconds === null ? "-" : formatUptime(uptimeSeconds);
    return `
      <div class="ss-bot-cell-stack">
        <span>${escapeHtml(formatTimestamp(bot?.last_heartbeat_at || bot?.last_evaluated_at || bot?.connected_at))}</span>
        <span class="muted">Uptime ${escapeHtml(uptimeLabel)}</span>
      </div>
    `;
  }

  function renderBlockingCell(bot, platformState) {
    const entries = [
      String(bot?.last_error || "").trim(),
      String(bot?.pause_reason || "").trim(),
      String(platformState?.pausedReason || "").trim()
    ].filter((entry) => entry && !isWaitingStateCode(entry));
    const statusReason = String(bot?.status_reason || "").trim();
    const waitingPosture = [
      bot?.status,
      bot?.lifecycle_state,
      bot?.runner_state,
      bot?.transport_status,
      bot?.readiness_status,
      platformState?.sessionStatus
    ].some((value) => isWaitingStateCode(value));
    if (statusReason && !waitingPosture) {
      entries.push(statusReason);
    }
    if (!entries.length) {
      return '<span class="muted">No blocking/error reason.</span>';
    }
    return `
      <div class="ss-bot-cell-stack">
        ${entries.map((entry) => `<span class="ss-bot-blocking-text">${escapeHtml(entry)}</span>`).join("")}
      </div>
    `;
  }

  function debugValue(payload, path, fallback = "-") {
    let current = payload;
    for (const key of path) {
      if (!current || typeof current !== "object") return fallback;
      current = current[key];
    }
    if (current === null || current === undefined || current === "") return fallback;
    if (typeof current === "boolean") return current ? "true" : "false";
    return String(current);
  }

  function renderDebugTimeline(payload) {
    const timeline = Array.isArray(payload?.diagnostics?.timeline)
      ? payload.diagnostics.timeline
      : [];
    if (!timeline.length) {
      const message =
        payload?.diagnostics?.summary?.message ||
        "No diagnostic trace has been recorded for this bot instance yet.";
      return `<div class="muted">${escapeHtml(message)}</div>`;
    }
    return `
      <ol class="ss-bot-debug-timeline">
        ${timeline
          .map((event) => `
            <li>
              <div class="ss-bot-debug-event-head">
                <span>${escapeHtml(formatTimestamp(event.timestamp))}</span>
                <span class="ss-badge ${severityBadgeClass(event.severity)}">${escapeHtml(String(event.severity || "debug").toUpperCase())}</span>
                <span>${escapeHtml(event.phase || "-")}</span>
                <span>${escapeHtml(event.step || "-")}</span>
              </div>
              <div class="ss-bot-debug-event-message">${escapeHtml(event.message || "-")}</div>
              ${event.code ? `<div class="muted">code: ${escapeHtml(event.code)}</div>` : ""}
              ${event.correlation_id ? `<div class="muted">correlation: ${escapeHtml(event.correlation_id)}</div>` : ""}
            </li>
          `)
          .join("")}
      </ol>
    `;
  }

  function renderDebugPanel(bot, ui) {
    if (!ui.debugOpen) return "";
    const payload = ui.debugPayload || null;
    const diagnostics = payload?.diagnostics || {};
    const detection = diagnostics?.detection || {};
    const lastException = diagnostics?.last_exception || null;
    const lastManual = diagnostics?.last_manual_deploy || null;
    const jsonText = payload ? JSON.stringify(payload, null, 2) : "";
    return `
      <section class="ss-bot-debug-panel">
        <div class="ss-bot-debug-head">
          <div>
            <div class="ss-bot-field-label">Debug</div>
            <div class="ss-bot-debug-title">${escapeHtml(platformDisplayName(bot?.platform))} instance diagnostics</div>
          </div>
          <button
            class="ss-btn ss-btn-small ss-btn-secondary"
            type="button"
            data-bot-debug-copy="1"
            data-creator-id="${encodeData(String(bot?.creator_id || ""))}"
            data-platform="${encodeData(String(bot?.platform || ""))}"
            ${payload ? "" : "disabled"}
          >Copy Debug JSON</button>
          <button
            class="ss-btn ss-btn-small ss-btn-primary"
            type="button"
            data-bot-debug-probe="1"
            data-creator-id="${encodeData(String(bot?.creator_id || ""))}"
            data-platform="${encodeData(String(bot?.platform || ""))}"
            data-session-id="${encodeData(String(bot?.session_id || ""))}"
            data-target="${encodeData(String(bot?.active_target || bot?.target_normalized || ""))}"
            ${ui.debugProbePending ? "disabled" : ""}
          >${ui.debugProbePending ? "Probing..." : "Probe Now"}</button>
        </div>
        ${ui.debugPending ? '<div class="muted">Loading debug payload...</div>' : ""}
        ${ui.debugError ? `<div class="ss-alert ss-alert-danger">${escapeHtml(ui.debugError)}</div>` : ""}
        ${payload
          ? `
            <div class="ss-bot-debug-chip-row">
              ${renderCompactChip(`Lifecycle ${debugValue(payload, ["bot", "lifecycle_status"])}`, managedSessionTone(debugValue(payload, ["bot", "lifecycle_status"])))}
              ${renderCompactChip(`Transport ${debugValue(payload, ["bot", "transport_status"])}`, managedSessionTone(debugValue(payload, ["bot", "transport_status"])))}
              ${renderCompactChip(`Runner ${debugValue(payload, ["bot", "runner_status"])}`, managedSessionTone(debugValue(payload, ["bot", "runner_status"])))}
              ${renderCompactChip(`Trace ${debugValue(payload, ["diagnostics", "summary", "event_count"], "0")}`, "")}
              ${renderCompactChip(`Source ${debugValue(payload, ["diagnostics", "summary", "trace_source"])}`, "")}
              ${debugValue(payload, ["diagnostics", "summary", "is_stale"], "false") === "true" ? renderCompactChip("Stale", "ss-badge-danger") : ""}
            </div>
            <div class="ss-bot-debug-grid">
              <div><span class="ss-bot-field-label">Target</span><strong>${escapeHtml(debugValue(payload, ["bot", "target"]))}</strong></div>
              <div><span class="ss-bot-field-label">Correlation</span><strong>${escapeHtml(debugValue(payload, ["diagnostics", "summary", "latest_correlation_id"]))}</strong></div>
              <div><span class="ss-bot-field-label">Trace source</span><strong>${escapeHtml(debugValue(payload, ["diagnostics", "summary", "trace_source"]))}</strong></div>
              <div><span class="ss-bot-field-label">Runtime control</span><strong>${escapeHtml(debugValue(payload, ["diagnostics", "summary", "runtime_control", "failure"], debugValue(payload, ["probe", "runtime_control_reachable"], "-")))}</strong></div>
              <div><span class="ss-bot-field-label">Detection</span><strong>${escapeHtml(debugValue({ detection }, ["detection", "detection_status"], detection.detection_attempted ? "attempted" : "not attempted"))}</strong></div>
              <div><span class="ss-bot-field-label">Next step</span><strong>${escapeHtml(debugValue({ detection }, ["detection", "next_required_step"]))}</strong></div>
              <div><span class="ss-bot-field-label">Subscription</span><strong>${escapeHtml(debugValue(payload, ["probe", "subscription_status"], debugValue(payload, ["diagnostics", "exports", "session_snapshot", "subscription_status"])))}</strong></div>
              <div><span class="ss-bot-field-label">Subscription HTTP</span><strong>${escapeHtml(debugValue(payload, ["probe", "subscription_http_status"], debugValue(payload, ["diagnostics", "exports", "session_snapshot", "subscription_http_status"])))}</strong></div>
              <div><span class="ss-bot-field-label">Subscription message</span><strong>${escapeHtml(debugValue(payload, ["probe", "subscription_response_message"], debugValue(payload, ["diagnostics", "exports", "session_snapshot", "subscription_response_message"])))}</strong></div>
              <div><span class="ss-bot-field-label">Dispatch</span><strong>${escapeHtml(debugValue(payload, ["probe", "dispatch_status"], debugValue(payload, ["diagnostics", "exports", "session_snapshot", "dispatch_status"])))}</strong></div>
              <div><span class="ss-bot-field-label">Credential posture</span><strong>${escapeHtml(debugValue(payload, ["diagnostics", "summary", "latest_error_code"], "No trace error"))}</strong></div>
              <div><span class="ss-bot-field-label">Last manual deploy</span><strong>${escapeHtml(lastManual?.code || lastManual?.phase || "-")}</strong></div>
              <div><span class="ss-bot-field-label">Last exception</span><strong>${escapeHtml(lastException?.code || lastException?.details?.exception_type || "-")}</strong></div>
              <div><span class="ss-bot-field-label">Awaiting explanation</span><strong>${escapeHtml(detection.detection_skipped_reason || detection.next_required_step || debugValue(payload, ["bot", "readiness_reason"]))}</strong></div>
            </div>
            ${renderDebugTimeline(payload)}
            <pre class="ss-bot-debug-json" aria-label="Redacted debug JSON">${escapeHtml(jsonText)}</pre>
          `
          : !ui.debugPending && !ui.debugError
            ? '<div class="muted">Debug payload has not been loaded.</div>'
            : ""}
      </section>
    `;
  }

  function botStatusRank(bot, platformState) {
    const values = [
      bot?.status,
      bot?.lifecycle_state,
      bot?.runner_state,
      platformState?.availability,
      platformState?.status
    ]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);
    const platformAvailability = String(platformState?.availability || "").trim().toLowerCase();
    const platformError =
      Boolean(String(platformState?.error || "").trim()) &&
      !["pending", "blocked", "active"].includes(platformAvailability);
    if (platformError || values.some((value) => ["error", "transport_error", "auth_failed", "subscription_failed"].includes(value))) {
      return { label: "Error", rank: 6, tone: "ss-badge-danger" };
    }
    if (values.some((value) => ["blocked", "target_unresolved", "stale", "live_target_unresolved"].includes(value))) {
      return { label: "Blocked", rank: 5, tone: "ss-badge-danger" };
    }
    if (values.some((value) => ["disabled", "offline", "stopped", "unavailable", "staged"].includes(value))) {
      return { label: "Disabled", rank: 4, tone: "" };
    }
    if (values.some((value) => ["pending", "desired", "starting", "attaching", "awaiting_transport", "awaiting_live", "awaiting_livestream", "awaiting_chat_room", "awaiting_first_webhook_event", "subscription_pending"].includes(value))) {
      return { label: "Pending", rank: 3, tone: "ss-badge-warning" };
    }
    if (values.some((value) => ["ready", "online", "running", "active", "attached", "listening", "connected", "listening_via_webhook", "transport_not_required_webhook_mode", "webhook_active"].includes(value))) {
      return { label: "Ready", rank: 1, tone: "ss-badge-success" };
    }
    return { label: "Pending", rank: 2, tone: "ss-badge-warning" };
  }

  function botLastCheckValue(bot) {
    return (
      bot?.last_heartbeat_at ||
      bot?.last_transport_heartbeat_at ||
      bot?.last_evaluated_at ||
      bot?.last_transition_at ||
      bot?.connected_at ||
      null
    );
  }

  function timestampMs(value) {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function collectBotReasons(bot, platformState) {
    return [
      String(bot?.status_reason || "").trim(),
      String(bot?.last_error || "").trim(),
      String(bot?.pause_reason || "").trim(),
      String(platformState?.error || "").trim(),
      String(platformState?.pausedReason || "").trim(),
      String(platformState?.reason || "").trim()
    ].filter(Boolean);
  }

  function buildCreatorGroups(normalized, platformSummary) {
    const groups = Object.create(null);
    const creatorLabels = Object.create(null);
    (Array.isArray(state.creators) ? state.creators : []).forEach((creator) => {
      const id = creatorKey(creator?.creator_id);
      creatorLabels[id] = String(creator?.display_name || id).trim() || id;
    });

    (Array.isArray(normalized?.bots) ? normalized.bots : []).forEach((bot) => {
      const id = creatorKey(bot?.creator_id || bot?.creator_account_id || bot?.account_id);
      if (!groups[id]) {
        groups[id] = {
          creatorId: id,
          label: creatorLabels[id] || id,
          bots: [],
          platforms: [],
          platformStates: Object.create(null),
          posture: { label: "Pending", rank: 0, tone: "ss-badge-warning" },
          hasMixedPosture: false,
          activeManagedCount: 0,
          blockedErrorCount: 0,
          lastCheck: null,
          reason: ""
        };
      }
      const group = groups[id];
      const platform = normalizePlatformKey(bot?.platform);
      const platformState = platformSummary?.[platform] || null;
      const posture = botStatusRank(bot, platformState);
      const reasons = collectBotReasons(bot, platformState);
      const lastCheck = botLastCheckValue(bot);
      const sessionType = String(bot?.session_type || "manual").trim().toLowerCase();

      group.bots.push(bot);
      if (platform && !group.platforms.includes(platform)) {
        group.platforms.push(platform);
      }
      if (platform) {
        group.platformStates[platform] = platformState;
      }
      if (posture.rank > group.posture.rank) {
        group.posture = posture;
        group.reason = reasons[0] || String(bot?.status_reason || "").trim() || platformState?.reason || "";
      } else if (!group.reason && reasons.length) {
        group.reason = reasons[0];
      }
      if (sessionType === "auto" || isBotAttached(bot)) {
        group.activeManagedCount += 1;
      }
      if (["Blocked", "Error"].includes(posture.label)) {
        group.blockedErrorCount += 1;
      }
      if (timestampMs(lastCheck) > timestampMs(group.lastCheck)) {
        group.lastCheck = lastCheck;
      }
    });

    const rows = Object.values(groups).map((group) => {
      group.platforms = sortPlatformKeys(group.platforms);
      const labels = new Set(
        group.bots.map((bot) => botStatusRank(bot, group.platformStates[normalizePlatformKey(bot?.platform)]).label)
      );
      group.hasMixedPosture = labels.size > 1;
      if (group.hasMixedPosture && group.posture.rank < 5) {
        group.posture = { label: "Mixed", rank: 3, tone: "ss-badge-warning" };
      }
      group.reason = group.reason || "No blocking/error reason.";
      return group;
    });

    return rows.sort((a, b) => a.label.localeCompare(b.label) || a.creatorId.localeCompare(b.creatorId));
  }

  function buildCreatorGroupSignature(normalized, platformSummary) {
    const groups = buildCreatorGroups(normalized, platformSummary);
    return stableStringify(
      groups.map((group) => ({
        creatorId: group.creatorId,
        label: group.label,
        platforms: group.platforms,
        posture: group.posture,
        activeManagedCount: group.activeManagedCount,
        blockedErrorCount: group.blockedErrorCount,
        lastCheck: group.lastCheck,
        reason: group.reason,
        expanded: state.expandedCreators[group.creatorId] === true,
        bots: group.bots.map((bot) => {
          const platform = normalizePlatformKey(bot?.platform);
          return {
            bot,
            platformState: group.platformStates[platform] || null,
            ui: getRowUi(String(bot?.creator_id || group.creatorId), platform)
          };
        })
      }))
    );
  }

  function buildPlatformSummarySignature(platformSummary, options = {}) {
    const liveCounts = options?.liveCounts || { byPlatform: {}, total: 0 };
    const rows = sortPlatformKeys(Object.keys(platformSummary || {})).map((platform) => {
      const entry = platformSummary?.[platform] || {};
      return {
        platform,
        availability: String(entry.availability || ""),
        reason: String(entry.reason || ""),
        status: String(entry.status || ""),
        sessionStatus: String(entry.sessionStatus || ""),
        paused: entry.paused === true,
        pausedReason: String(entry.pausedReason || ""),
        error: String(entry.error || ""),
        details: entry.details || {},
        lastLog: entry.lastLog || null,
        liveCount: Number.isFinite(liveCounts.byPlatform?.[platform]) ? liveCounts.byPlatform[platform] : 0
      };
    });
    return stableStringify({
      live: options?.live === true,
      updatedAt: options?.updatedAt || null,
      totalLive: Number.isFinite(liveCounts.total) ? liveCounts.total : 0,
      rows
    });
  }

  function buildRowsSignature(normalized, platformSummary) {
    return buildCreatorGroupSignature(normalized, platformSummary);
  }

  function buildCreatorsSignature(creators) {
    return stableStringify(
      (Array.isArray(creators) ? creators : []).map((creator) => ({
        creator_id: String(creator?.creator_id || "").trim(),
        display_name: String(creator?.display_name || "").trim(),
        tier: String(creator?.tier || "").trim(),
        status: String(creator?.status || "").trim()
      }))
    );
  }

  function buildManualPlatformSignature() {
    return stableStringify(state.deployPlatformSchemas || {});
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

  function isProbeDegradedReasonCode(code) {
    return [
      "browse_live_request_failed",
      "sample_browse_live_request_failed",
      "creator_channel_probe_failed",
      "creator_page_probe_failed"
    ].includes(normalizeReasonCode(code));
  }

  function hasProbeDegradedReason(runtime) {
    const detailCodes = uniqueReasonCodes(runtime?.details?.session_blocking_codes);
    if (detailCodes.some((code) => isProbeDegradedReasonCode(code))) {
      return true;
    }
    const reason = String(runtime?.details?.session_status_reason || runtime?.error || "").trim().toLowerCase();
    return (
      reason.includes("trustworthy offline result could be established") ||
      reason.includes("browse/live detection failed") ||
      reason.includes("live probe failed")
    );
  }

  function getProbeDegradedSummaryReason(runtime, blockedCount) {
    const exportedReason = String(runtime?.details?.session_status_reason || runtime?.error || "").trim();
    if (blockedCount > 0) {
      return (
        `Runtime is globally enabled, but ${blockedCount} creator-managed session${blockedCount === 1 ? "" : "s"} ` +
        `is still awaiting trustworthy live verification.`
      );
    }
    return exportedReason || "Runtime is globally enabled and awaiting trustworthy live verification.";
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
      const globalStatus = String(runtime?.globalStatus || runtime?.status || "").trim().toLowerCase();
      const sessionStatus = String(runtime?.sessionStatus || runtime?.details?.session_status || "").trim().toLowerCase();
      const blockedCount = Number(runtime?.details?.bot_blocked_count || 0);
      const pendingCount = Number(runtime?.details?.bot_desired_count || 0);
      const probeDegraded = hasProbeDegradedReason(runtime);
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
        globalStatus === "connected" ||
        globalStatus === "online" ||
        globalStatus === "active" ||
        globalStatus === "running" ||
        globalStatus === "ready" ||
        (runtime?.available === true && runtime?.status !== "not_configured")
      ) {
        availability = "active";
        if (sessionStatus === "awaiting_live" && blockedCount > 0) {
          availability = "pending";
          reason =
            runtime?.details?.session_status_reason ||
            `${blockedCount} creator-managed session${blockedCount === 1 ? "" : "s"} is waiting for a creator to go live.`;
        } else if (sessionStatus === "live_target_unresolved" && blockedCount > 0) {
          availability = "pending";
          reason =
            runtime?.details?.session_status_reason ||
            `${blockedCount} creator-managed session${blockedCount === 1 ? "" : "s"} is live but still waiting for a concrete live target.`;
        } else if (sessionStatus === "attach_identity_incomplete" && blockedCount > 0) {
          availability = "blocked";
          reason =
            runtime?.details?.session_status_reason ||
            `${blockedCount} creator-managed session${blockedCount === 1 ? "" : "s"} is live but still missing attach identity.`;
        } else if (sessionStatus === "subscription_failed") {
          availability = "blocked";
          reason =
            runtime?.details?.session_status_reason ||
            runtime?.error ||
            "Kick webhook subscription reconciliation failed.";
        } else if (sessionStatus === "subscription_pending") {
          availability = "pending";
          reason =
            runtime?.details?.session_status_reason ||
            "Kick webhook subscription reconciliation is pending.";
        } else if (sessionStatus === "awaiting_first_webhook_event") {
          availability = "pending";
          reason =
            runtime?.details?.session_status_reason ||
            "Kick webhook subscription is active; waiting for the first webhook event.";
        } else if (["listening_via_webhook", "webhook_active"].includes(sessionStatus)) {
          availability = "active";
          reason =
            runtime?.details?.session_status_reason ||
            "Kick inbound chat is listening through official webhooks.";
        } else if (["awaiting_livestream", "awaiting_chat_room"].includes(sessionStatus)) {
          availability = "pending";
          reason =
            runtime?.details?.session_status_reason ||
            "Kick session is waiting for livestream/chat room before transport attach.";
        } else if (sessionStatus === "blocked" && blockedCount > 0 && probeDegraded) {
          availability = "pending";
          reason = getProbeDegradedSummaryReason(runtime, blockedCount);
        } else if (sessionStatus === "blocked" && blockedCount > 0) {
          availability = "blocked";
          reason =
            runtime?.details?.session_status_reason ||
            runtime?.error ||
            `${blockedCount} creator-managed session${blockedCount === 1 ? "" : "s"} is blocked by creator-level prerequisites.`;
        } else if (sessionStatus === "managed_pending" && pendingCount > 0) {
          availability = "pending";
          reason = `${pendingCount} creator-managed session${pendingCount === 1 ? "" : "s"} is still attaching.`;
        } else {
          reason =
            globalStatus === "ready"
              ? "Runtime is globally enabled and ready for deployment."
              : "Runtime is globally enabled and currently serving live sessions.";
        }
      } else if (globalStatus === "error" || runtime?.error) {
        availability = "unavailable";
        reason = runtime?.error || "Runtime reported an error.";
      } else if (globalStatus === "staged") {
        availability = "staged";
        reason = runtime?.disabledReason || schema?.blockedReason || "Staged/disabled.";
      }

      summary[platform] = {
        platform,
        label: schema?.label || runtime?.label || platformDisplayName(platform),
        deployEnabled,
        staged: schema?.staged === true || !deployEnabled,
        availability,
        status: !deployEnabled ? "staged" : globalStatus || (fallbackMode ? "fallback" : "unknown"),
        sessionStatus,
        details: runtime?.details || {},
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
    const signature = buildPlatformSummarySignature(platformSummary, options);

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

    if (signature !== state.renderCache.platformSignature) {
      el.platformsGrid.innerHTML = entries
        .map((entry) => {
        const availability = String(entry.availability || "unavailable").toLowerCase();
        const stateClass =
          availability === "paused"
            ? "is-paused"
            : availability === "blocked"
              ? "is-blocked"
              : availability === "pending"
                ? "is-pending"
            : availability === "active"
              ? "is-active"
              : availability === "staged"
                ? "is-staged"
              : "is-unavailable";
        const badgeLabel =
          availability === "paused"
            ? "Paused"
            : availability === "blocked"
              ? "Blocked"
              : availability === "pending"
                ? "Pending"
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
      state.renderCache.platformSignature = signature;
    }

    if (el.platformsStatus) {
      const modeLabel = options?.live === true ? "Live" : "STALE / FALLBACK";
      const updatedLabel = formatTimestamp(options?.updatedAt || null);
      const pausedCount = entries.filter((entry) => entry.availability === "paused").length;
      const blockedCount = entries.filter((entry) => entry.availability === "blocked").length;
      const pendingCount = entries.filter((entry) => entry.availability === "pending").length;
      const activeCount = entries.filter((entry) => entry.availability === "active").length;
      const stagedCount = entries.filter((entry) => entry.availability === "staged").length;
      const unavailableCount = entries.filter(
        (entry) => entry.availability === "unavailable"
      ).length;
      el.platformsStatus.textContent =
        `${modeLabel} | Last updated ${updatedLabel} | Ready ${activeCount} | Pending ${pendingCount} | ` +
        `Blocked ${blockedCount} | Paused ${pausedCount} | Unavailable ${unavailableCount} | Staged ${stagedCount}`;
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
    const manageAllowed = canManageRuntime();
    const runtimeOffline = !isRuntimeAvailable();
    const runtimePaused = platformState?.paused === true;
    const deployBlockedMessage = !manageAllowed
      ? "Runtime controls are view-only for this account."
      : !deploySupported
        ? deploySchema?.blockedReason || "Manual deploy is unavailable for this platform."
        : "";
    const attachDisabled =
      ui.pending ||
      !manageAllowed ||
      runtimeOffline ||
      runtimePaused ||
      !deploySupported ||
      !canAttach(bot);
    const detachDisabled =
      ui.pending || !manageAllowed || runtimeOffline || !deploySupported || !canDetach(bot);
    const botPauseReason = String(bot?.pause_reason || "").trim();
    const pauseReason = botPauseReason || String(platformState?.pausedReason || "").trim();
    const isPaused = String(bot?.status || "").trim().toLowerCase() === "paused" || runtimePaused;
    const resumeDisabled =
      ui.pending ||
      !manageAllowed ||
      runtimeOffline ||
      !deploySupported ||
      !isPaused ||
      !String(bot?.active_target || "").trim();
    const clearDisabled = ui.pending || !manageAllowed || runtimeOffline || !isPaused;
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
          <button
            class="ss-btn ss-btn-small ss-btn-secondary"
            data-bot-debug="1"
            data-creator-id="${encodeData(creatorId)}"
            data-platform="${encodeData(platform)}"
            data-session-id="${encodeData(String(bot?.session_id || ""))}"
            ${ui.debugPending ? "disabled" : ""}
          >${ui.debugPending ? "Loading..." : "Debug"}</button>
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

  function getDisplayUptimeSeconds(bot) {
    const base = asFiniteNumber(bot?.uptime_seconds);
    if (base === null) return null;
    return Math.max(0, Math.floor(base));
  }

  function renderCreatorSummaryCell(group) {
    const secondary = group.label !== group.creatorId ? group.creatorId : "Runtime creator";
    return `
      <div class="ss-bot-creator-summary">
        <div class="ss-bot-creator-name">${escapeHtml(group.label)}</div>
        <div class="muted">${escapeHtml(secondary)}</div>
      </div>
    `;
  }

  function renderPlatformSummaryChips(group) {
    if (!group.platforms.length) {
      return '<span class="muted">No platform exported.</span>';
    }
    return `
      <div class="ss-bot-platform-list">
        ${group.platforms
          .map((platform) => {
            const label = platformDisplayName(platform);
            return `
              <span class="ss-bot-platform-chip-small">
                <img src="${escapeHtml(platformIconPath(platform))}" alt="" loading="lazy" decoding="async" />
                ${escapeHtml(label)}
              </span>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderCreatorCounts(group) {
    return `
      <div class="ss-bot-counts">
        ${renderCompactChip(`${group.activeManagedCount} active/managed`, group.activeManagedCount > 0 ? "ss-badge-success" : "")}
        ${renderCompactChip(`${group.blockedErrorCount} blocked/error`, group.blockedErrorCount > 0 ? "ss-badge-danger" : "")}
        ${renderCompactChip(`${group.bots.length} total`, "")}
      </div>
    `;
  }

  function renderCreatorDrawer(group) {
    const detailId = `bots-detail-${encodeData(group.creatorId)}`;
    return `
      <tr class="ss-bots-detail-row" id="${escapeHtml(detailId)}">
        <td colspan="7">
          <div class="ss-bots-detail-drawer">
            ${group.bots
              .map((bot) => {
                const platformKey = normalizePlatformKey(bot?.platform);
                const platformState = group.platformStates[platformKey] || null;
                return `
                  <article class="ss-bot-instance-card">
                    <div class="ss-bot-instance-head">
                      <div class="ss-bot-instance-platform">
                        <img src="${escapeHtml(platformIconPath(platformKey))}" alt="" loading="lazy" decoding="async" />
                        <span>${escapeHtml(platformDisplayName(platformKey))}</span>
                      </div>
                      ${renderActionCell(bot, platformState)}
                    </div>
                    <div class="ss-bot-instance-grid">
                      <div>
                        <div class="ss-bot-field-label">Session</div>
                        ${renderSessionCell(bot)}
                      </div>
                      <div>
                        <div class="ss-bot-field-label">Lifecycle</div>
                        ${renderLifecycleCell(bot)}
                      </div>
                      <div>
                        <div class="ss-bot-field-label">Transport / Runner</div>
                        ${renderTransportCell(bot)}
                      </div>
                      <div>
                        <div class="ss-bot-field-label">Target</div>
                        ${renderTargetCell(bot)}
                      </div>
                      <div>
                        <div class="ss-bot-field-label">Heartbeat / Check</div>
                        ${renderHeartbeatCell(bot)}
                      </div>
                      <div>
                        <div class="ss-bot-field-label">Blocking / Error</div>
                        ${renderBlockingCell(bot, platformState)}
                      </div>
                    </div>
                    ${renderDebugPanel(bot, getRowUi(String(bot?.creator_id || group.creatorId), platformKey))}
                  </article>
                `;
              })
              .join("")}
          </div>
        </td>
      </tr>
    `;
  }

  function renderRows(normalized, receivedAt, platformSummary) {
    const groups = buildCreatorGroups(normalized, platformSummary);
    const rows = groups.map((group) => {
      const expanded = state.expandedCreators[group.creatorId] === true;
      const rowClass = group.posture.label === "Disabled" ? "ss-bots-row-paused" : "";
      const issue = truncateForCard(group.reason, 150);
      const detailId = `bots-detail-${encodeData(group.creatorId)}`;

      return `
        <tr class="ss-bots-creator-row ${rowClass}">
          <td>${renderCreatorSummaryCell(group)}</td>
          <td>${renderPlatformSummaryChips(group)}</td>
          <td>${renderStatus(group.posture.label)}</td>
          <td>${renderCreatorCounts(group)}</td>
          <td>${escapeHtml(formatTimestamp(group.lastCheck))}</td>
          <td><span class="ss-bot-issue-summary" title="${escapeHtml(group.reason)}">${escapeHtml(issue)}</span></td>
          <td>
            <button
              class="ss-btn ss-btn-small ss-btn-secondary ss-bot-expand"
              type="button"
              data-bot-expand="${encodeData(group.creatorId)}"
              aria-expanded="${expanded ? "true" : "false"}"
              aria-controls="${escapeHtml(detailId)}"
            >${expanded ? "Hide" : "Show"}</button>
          </td>
        </tr>
        ${expanded ? renderCreatorDrawer(group) : ""}
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
    if (!isRuntimeAvailable()) return "Auth/runtime status API is unavailable.";
    return getPausedPlatformMessage(platform);
  }

  function updateManualCreatorSuggestions() {
    if (!el.manualCreator) return;
    const signature = buildCreatorsSignature(state.creators);
    const selected = String(el.manualCreator.value || "").trim();
    const options = (state.creators || [])
      .map((creator) => ({
        creator_id: String(creator?.creator_id || "").trim(),
        display_name: String(creator?.display_name || "").trim()
      }))
      .filter((creator) => creator.creator_id)
      .sort((a, b) => a.display_name.localeCompare(b.display_name) || a.creator_id.localeCompare(b.creator_id));

    const optionMarkup = options
      .map((creator) => {
        const label = creator.display_name
          ? `${creator.display_name} - ${creator.creator_id}`
          : creator.creator_id;
        return `<option value="${escapeHtml(creator.creator_id)}">${escapeHtml(label)}</option>`;
      })
      .join("");

    if (signature !== state.renderCache.creatorsSignature) {
      el.manualCreator.innerHTML = `<option value="">Select creator</option>${optionMarkup}`;
      state.renderCache.creatorsSignature = signature;
    }
    if (selected && options.some((creator) => creator.creator_id === selected)) {
      el.manualCreator.value = selected;
    } else {
      el.manualCreator.value = "";
    }
  }

  function renderManualPlatformOptions() {
    if (!el.manualPlatform) return;
    const signature = buildManualPlatformSignature();
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
    if (signature !== state.renderCache.manualPlatformSignature) {
      el.manualPlatform.innerHTML = `<option value="">Select platform</option>${optionMarkup}`;
      state.renderCache.manualPlatformSignature = signature;
    }
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
    const manageAllowed = canManageRuntime();
    const formOpen = state.manualFormOpen === true;
    el.manualForm.classList.toggle("hidden", !formOpen);
    el.manualToggle.textContent = formOpen ? "Hide Manual Deploy" : "Manual Deploy Bot";
    el.manualToggle.disabled = !creatorsAvailable || !manageAllowed;
    el.manualToggle.setAttribute(
      "aria-disabled",
      creatorsAvailable && manageAllowed ? "false" : "true"
    );

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
    const submitDisabled =
      state.manualDeploy.pending || !manageAllowed || Boolean(blockedReason) || !hasRequiredFields;

    if (el.manualSubmit) {
      el.manualSubmit.disabled = submitDisabled;
      el.manualSubmit.textContent = state.manualDeploy.pending ? "Deploying..." : "Deploy Bot";
    }

    if (el.manualCreator) {
      el.manualCreator.disabled = state.manualDeploy.pending || !creatorsAvailable || !manageAllowed;
    }
    if (el.manualPlatform) {
      el.manualPlatform.disabled = state.manualDeploy.pending || !manageAllowed;
    }
    if (el.manualTarget) {
      el.manualTarget.disabled = state.manualDeploy.pending || !manageAllowed;
    }
    if (el.manualCancel) {
      el.manualCancel.disabled = state.manualDeploy.pending || !manageAllowed;
    }

    if (el.manualNote) {
      const note =
        (!manageAllowed ? "Runtime management is disabled for this account." : "") ||
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
      if (values.platform === "twitch" || values.platform === "kick") {
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
        const correlation = String(responsePayload?.correlation_id || "").trim();
        const detail =
          responsePayload?.message ||
          responsePayload?.error ||
          `Manual deploy failed (HTTP ${response.status}).`;
        setManualError(correlation ? `${String(detail)} (correlation ${correlation})` : String(detail));
        if (responsePayload?.session_id || responsePayload?.details?.session_id) {
          await reloadBotsSafely();
        }
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
      const creatorCount = buildCreatorGroups(normalized, state.platformSummary).length;
      const rowCount = Array.isArray(normalized?.bots) ? normalized.bots.length : 0;
      el.count.textContent = `${creatorCount} creator${creatorCount === 1 ? "" : "s"} / ${rowCount} bot${rowCount === 1 ? "" : "s"}`;
    }
    if (el.generatedAt) {
      el.generatedAt.textContent = `Generated: ${formatTimestamp(normalized?.generatedAt)}`;
    }
    if (el.hiddenNote) {
      const hiddenCount = Number(normalized?.hiddenPlaceholderCount || 0);
      el.hiddenNote.textContent = hiddenCount > 0
        ? `Unconfigured platform placeholders are hidden (${hiddenCount}).`
        : "Unconfigured platform placeholders are hidden.";
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

  async function fetchPayload(signal) {
    const endpoint = buildApiUrl(BOTS_STATUS_ENDPOINT);
    const res = await fetch(endpoint, {
      cache: "no-store",
      credentials: "include",
      signal
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
        const account = entry?.account && typeof entry.account === "object" ? entry.account : {};
        const displayName = String(entry?.display_name || account?.display_name || creatorId).trim() || creatorId;
        const role = String(account?.role || entry?.role || "").trim().toLowerCase();
        const status = String(entry?.status || "").trim().toLowerCase();
        const accountStatus = String(account?.account_status || entry?.account_status || "").trim().toLowerCase();
        const isSystem =
          role === "system" ||
          creatorId.toLowerCase() === "system" ||
          displayName.toLowerCase() === "system" ||
          Boolean(entry?.internal || account?.internal || entry?.system || account?.system);
        const deployableRole = !role || ["creator", "developer", "admin"].includes(role);
        const activeIdentity = !status || status === "active";
        const activeAccount = !accountStatus || ["active", "enabled", "verified"].includes(accountStatus);
        if (isSystem || !deployableRole || !activeIdentity || !activeAccount || entry?.orphaned === true) {
          return null;
        }
        return {
          creator_id: creatorId,
          display_name: displayName,
          account_id: String(entry?.account_id || account?.account_id || "").trim(),
          role,
          tier: String(entry?.tier || "").trim().toLowerCase(),
          status
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.display_name.localeCompare(b.display_name) || a.creator_id.localeCompare(b.creator_id));
  }

  async function fetchCreators(signal) {
    const endpoint = buildApiUrl(CREATORS_ENDPOINT);
    const res = await fetch(endpoint, {
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" },
      signal
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
    const rowSignature = buildRowsSignature(normalized, state.platformSummary);

    if (el.body && rowSignature !== state.renderCache.rowSignature) {
      el.body.innerHTML = hasRows ? renderRows(normalized, now, state.platformSummary) : "";
      state.renderCache.rowSignature = rowSignature;
    }
    if (el.empty) {
      el.empty.classList.toggle("hidden", hasRows);
    }
  }

  async function refresh() {
    if (!state.mounted) return;
    if (state.refreshInFlight) return state.refreshInFlight;
    state.refreshAbortController?.abort();
    state.refreshAbortController = new AbortController();
    try {
      state.refreshInFlight = Promise.all([fetchPayload(state.refreshAbortController.signal), fetchCreators(state.refreshAbortController.signal)])
        .then(([normalized, creators]) => {
          if (!state.mounted) return;
          state.creators = Array.isArray(creators) ? creators : [];
          setError("");
          render(normalized);
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
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
          state.renderCache.rowSignature = "";
          state.renderCache.platformSignature = "";
          state.renderCache.creatorsSignature = "";
          state.renderCache.manualPlatformSignature = "";
          if (el.status) {
            el.status.textContent = state.hydrationLabel;
          }
          if (el.count) {
            el.count.textContent = "-- creators";
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
        })
        .finally(() => {
          state.refreshInFlight = null;
        });
      await state.refreshInFlight;
    } catch (err) {
      if (err?.name !== "AbortError") {
        throw err;
      }
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
    state.renderCache.rowSignature = "";
    state.renderCache.platformSignature = "";
    state.renderCache.creatorsSignature = "";
    state.renderCache.manualPlatformSignature = "";
    if (el.status) {
      el.status.textContent = state.hydrationLabel;
    }
    if (el.count) {
      el.count.textContent = "-- creators";
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

  function renderRowsAndCountersFromState(receivedAt = Date.now()) {
    if (!state.lastPayload) return;
    const hasRows = Array.isArray(state.lastPayload.bots) && state.lastPayload.bots.length > 0;
    const rowSignature = buildRowsSignature(state.lastPayload, state.platformSummary);
    if (el.body) {
      if (rowSignature !== state.renderCache.rowSignature) {
        el.body.innerHTML = hasRows
          ? renderRows(state.lastPayload, receivedAt, state.platformSummary)
          : "";
        state.renderCache.rowSignature = rowSignature;
      }
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
    if (!canManageRuntime()) {
      const ui = getRowUi(creatorId, platform);
      ui.error = "Runtime controls are not permitted for this account.";
      renderRowsAndCountersFromState();
      return;
    }

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
        const endpoint =
          action === "resume"
            ? MANUAL_RESUME_ENDPOINT
            : action === "detach"
              ? MANUAL_DETACH_ENDPOINT
              : MANUAL_DEPLOY_ENDPOINT;
        const payload = {
          action,
          platform,
          creator_id: creatorId,
          target_identifier: targetIdentifier
        };
        if (action === "attach") {
          payload.target = targetIdentifier;
          if (platform.toLowerCase() === "twitch" || platform.toLowerCase() === "kick") {
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
        const correlation = String(responsePayload?.correlation_id || "").trim();
        const code = String(responsePayload?.error_code || responsePayload?.error || "").trim();
        const detail =
          responsePayload?.message ||
          responsePayload?.error ||
          `Manual ${action} failed (HTTP ${response.status}).`;
        const codePart = code ? ` [${code}]` : "";
        ui.error = correlation ? `${String(detail)}${codePart} (correlation ${correlation})` : `${String(detail)}${codePart}`;
        if (responsePayload?.debug_lookup) {
          ui.debugOpen = true;
          ui.debugPayload = {
            success: false,
            generated_at: new Date().toISOString(),
            bot: {
              platform,
              creator_id: creatorId,
              session_id: responsePayload.debug_lookup.session_id || responsePayload.session_id || ""
            },
            diagnostics: {
              summary: {
                event_count: 1,
                has_trace: true,
                latest_correlation_id: correlation,
                latest_error_code: code,
                trace_source: "structured_error"
              },
              timeline: [{
                timestamp: new Date().toISOString(),
                severity: "error",
                phase: "manual_deploy_error",
                step: "dashboard_response",
                message: String(detail),
                code,
                correlation_id: correlation
              }],
              detection: {
                detection_attempted: false,
                next_required_step: "Open Debug or run Probe Now for this correlation."
              }
            }
          };
        }
        if (responsePayload?.session_id || responsePayload?.details?.session_id) {
          await reloadBotsSafely();
        }
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

  async function loadBotDebug(creatorId, platform, sessionId = "") {
    const ui = getRowUi(creatorId, platform);
    if (ui.debugPending) return;
    ui.debugOpen = true;
    ui.debugPending = true;
    ui.debugError = "";
    renderRowsAndCountersFromState();
    try {
      const params = new URLSearchParams();
      const normalizedPlatform = normalizePlatformKey(platform);
      if (normalizedPlatform) params.set("platform", normalizedPlatform);
      if (creatorId) params.set("creator_id", creatorId);
      if (sessionId) params.set("session_id", sessionId);
      const endpoint = `${BOTS_DEBUG_ENDPOINT}?${params.toString()}`;
      const response = await fetch(buildApiUrl(endpoint), {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      const payload = await readJsonSafe(response);
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || payload?.error || `Debug request failed (HTTP ${response.status}).`);
      }
      ui.debugPayload = payload;
    } catch (err) {
      ui.debugError = err?.message ? String(err.message) : "Debug request failed.";
    } finally {
      ui.debugPending = false;
      renderRowsAndCountersFromState();
    }
  }

  async function copyBotDebugJson(creatorId, platform) {
    const ui = getRowUi(creatorId, platform);
    if (!ui.debugPayload) return;
    const text = JSON.stringify(ui.debugPayload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      ui.debugError = "";
    } catch (err) {
      ui.debugError = "Clipboard copy failed.";
    }
    renderRowsAndCountersFromState();
  }

  async function reloadBotsSafely() {
    try {
      if (typeof refresh === "function") {
        await refresh();
        return true;
      }
    } catch (err) {
      console.warn("Bot status reload failed after action", err);
      return false;
    }
    try {
      renderRowsAndCountersFromState();
    } catch (err) {
      console.warn("Bot status fallback render failed after action", err);
    }
    return false;
  }

  async function runBotDebugProbe(creatorId, platform, sessionId = "", target = "") {
    const ui = getRowUi(creatorId, platform);
    if (ui.debugProbePending) return;
    ui.debugOpen = true;
    ui.debugProbePending = true;
    ui.debugError = "";
    renderRowsAndCountersFromState();
    try {
      const response = await fetch(buildApiUrl(BOTS_DEBUG_PROBE_ENDPOINT), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          platform: normalizePlatformKey(platform),
          creator_id: creatorId,
          session_id: sessionId || null,
          target: target || null
        })
      });
      const payload = await readJsonSafe(response);
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || payload?.error || `Debug probe failed (HTTP ${response.status}).`);
      }
      ui.debugPayload = payload;
      await reloadBotsSafely();
    } catch (err) {
      ui.debugError = err?.message ? String(err.message) : "Debug probe failed.";
    } finally {
      ui.debugProbePending = false;
      renderRowsAndCountersFromState();
    }
  }

  function onBodyClick(event) {
    const expandButton = event.target.closest("[data-bot-expand]");
    if (expandButton instanceof HTMLButtonElement && !expandButton.disabled) {
      const creatorId = decodeData(expandButton.dataset.botExpand || "");
      if (!creatorId) return;
      state.expandedCreators[creatorId] = state.expandedCreators[creatorId] !== true;
      state.renderCache.rowSignature = "";
      renderRowsAndCountersFromState();
      return;
    }

    const debugCopyButton = event.target.closest("[data-bot-debug-copy]");
    if (debugCopyButton instanceof HTMLButtonElement && !debugCopyButton.disabled) {
      const creatorId = decodeData(debugCopyButton.dataset.creatorId || "");
      const platform = decodeData(debugCopyButton.dataset.platform || "");
      if (creatorId && platform) {
        void copyBotDebugJson(creatorId, platform);
      }
      return;
    }

    const debugProbeButton = event.target.closest("[data-bot-debug-probe]");
    if (debugProbeButton instanceof HTMLButtonElement && !debugProbeButton.disabled) {
      const creatorId = decodeData(debugProbeButton.dataset.creatorId || "");
      const platform = decodeData(debugProbeButton.dataset.platform || "");
      const sessionId = decodeData(debugProbeButton.dataset.sessionId || "");
      const target = decodeData(debugProbeButton.dataset.target || "");
      if (creatorId && platform) {
        void runBotDebugProbe(creatorId, platform, sessionId, target);
      }
      return;
    }

    const debugButton = event.target.closest("[data-bot-debug]");
    if (debugButton instanceof HTMLButtonElement && !debugButton.disabled) {
      const creatorId = decodeData(debugButton.dataset.creatorId || "");
      const platform = decodeData(debugButton.dataset.platform || "");
      const sessionId = decodeData(debugButton.dataset.sessionId || "");
      if (!creatorId || !platform) return;
      const ui = getRowUi(creatorId, platform);
      if (ui.debugOpen && ui.debugPayload) {
        ui.debugOpen = false;
        renderRowsAndCountersFromState();
        return;
      }
      void loadBotDebug(creatorId, platform, sessionId);
      return;
    }

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
    if (!state.mounted) return;
    state.pollHandle = window.setTimeout(async () => {
      state.pollHandle = null;
      await startPollingAsync();
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (state.pollHandle) {
      clearTimeout(state.pollHandle);
      state.pollHandle = null;
    }
    state.refreshAbortController?.abort();
    state.refreshAbortController = null;
    state.refreshInFlight = null;
  }

  function init() {
    if (state.mounted) {
      stopPolling();
    }
    state.mounted = true;
    el.status = $("bots-status");
    el.count = $("bots-count");
    el.generatedAt = $("bots-generated-at");
    el.source = $("bots-source");
    el.error = $("bots-error");
    el.hiddenNote = $("bots-hidden-note");
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
    state.mounted = false;
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
    state.expandedCreators = Object.create(null);
    state.renderCache = {
      rowSignature: "",
      platformSignature: "",
      creatorsSignature: "",
      manualPlatformSignature: ""
    };
  }

  window.BotsView = {
    init,
    destroy
  };
})();

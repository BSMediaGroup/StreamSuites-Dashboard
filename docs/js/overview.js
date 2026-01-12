(() => {
  "use strict";

  const REFRESH_INTERVAL_MS = 15000;
  const TELEMETRY_REFRESH_MS = 15000;
  const TELEMETRY_MAX_EVENTS = 10;
  const TELEMETRY_MAX_ERRORS = 8;
  const TELEMETRY_MAX_METRICS = 6;
  const ADMIN_ACTIVITY_MAX = 8;

  let refreshHandle = null;
  let quotaRefreshHandle = null;
  let telemetryHandle = null;
  let adminActivityHandle = null;

  const el = {};

  /* ============================================================
     ELEMENT CACHE
     ============================================================ */

  function cacheElements() {
    el.dashboardState = document.getElementById("ov-dashboard-state");
    el.storageState = document.getElementById("ov-storage-state");
    el.creatorsCount = document.getElementById("ov-creators-count");
    el.triggersCount = document.getElementById("ov-triggers-count");

    el.rumbleEnabledCount = document.getElementById("ov-rumble-enabled-count");
    el.kickEnabledCount = document.getElementById("ov-kick-enabled-count");
    el.pilledEnabledCount = document.getElementById("ov-pilled-enabled-count");
    el.twitchEnabledCount = document.getElementById("ov-twitch-enabled-count");
    el.youtubeEnabledCount = document.getElementById("ov-youtube-enabled-count");

    el.discordRuntime = document.getElementById("ov-discord-runtime");
    el.discordConnection = document.getElementById("ov-discord-connection");
    el.discordHeartbeat = document.getElementById("ov-discord-heartbeat");
    el.discordGuilds = document.getElementById("ov-discord-guilds");
    el.discordPresence = document.getElementById("ov-discord-presence");
    el.discordBotStatus = document.getElementById("ov-discord-bot");

    el.rumbleConfig = document.getElementById("ov-rumble-config");
    el.rumbleRuntime = document.getElementById("ov-rumble-runtime");

    el.kickConfig = document.getElementById("ov-kick-config");
    el.kickRuntime = document.getElementById("ov-kick-runtime");

    el.pilledConfig = document.getElementById("ov-pilled-config");
    el.pilledRuntime = document.getElementById("ov-pilled-runtime");

    el.twitchConfig = document.getElementById("ov-twitch-config");
    el.twitchRuntime = document.getElementById("ov-twitch-runtime");
    el.youtubeConfig = document.getElementById("ov-youtube-config");
    el.youtubeRuntime = document.getElementById("ov-youtube-runtime");

    /* Platform badges */
    el.badgeDiscord = document.getElementById("badge-discord");
    el.badgeRumble = document.getElementById("badge-rumble");
    el.badgeKick = document.getElementById("badge-kick");
    el.badgePilled = document.getElementById("badge-pilled");
    el.badgeTwitch = document.getElementById("badge-twitch");
    el.badgeYouTube = document.getElementById("badge-youtube");

    /* Quota bars (Overview placeholders) */
    const fills = document.querySelectorAll(".ss-quota-row .ss-quota-fill");
    el.quotaDailyFill = fills[0] || null;
    el.quotaMinuteFill = fills[1] || null;

    /* Telemetry */
    el.telemetryEmpty = document.getElementById("telemetry-empty");
    el.telemetry = {
      youtube: {
        status: document.getElementById("telemetry-youtube-status"),
        last: document.getElementById("telemetry-youtube-last"),
        error: document.getElementById("telemetry-youtube-error")
      },
      twitch: {
        status: document.getElementById("telemetry-twitch-status"),
        last: document.getElementById("telemetry-twitch-last"),
        error: document.getElementById("telemetry-twitch-error")
      },
      kick: {
        status: document.getElementById("telemetry-kick-status"),
        last: document.getElementById("telemetry-kick-last"),
        error: document.getElementById("telemetry-kick-error")
      },
      pilled: {
        status: document.getElementById("telemetry-pilled-status"),
        last: document.getElementById("telemetry-pilled-last"),
        error: document.getElementById("telemetry-pilled-error")
      },
      rumble: {
        status: document.getElementById("telemetry-rumble-status"),
        last: document.getElementById("telemetry-rumble-last"),
        error: document.getElementById("telemetry-rumble-error")
      },
      discord: {
        status: document.getElementById("telemetry-discord-status"),
        last: document.getElementById("telemetry-discord-last"),
        error: document.getElementById("telemetry-discord-error")
      }
    };

    /* Telemetry detail panels */
    el.telemetryEventsBody = document.getElementById("telemetry-events-body");
    el.telemetryEventsEmpty = document.getElementById("telemetry-events-empty");
    el.telemetryEventsWarning = document.getElementById(
      "telemetry-events-warning"
    );

    el.telemetryRatesGrid = document.getElementById("telemetry-rates-grid");
    el.telemetryRatesEmpty = document.getElementById("telemetry-rates-empty");
    el.telemetryRatesWindow = document.getElementById("telemetry-rates-window");
    el.telemetryRatesWarning = document.getElementById(
      "telemetry-rates-warning"
    );

    el.telemetryErrorsBody = document.getElementById("telemetry-errors-body");
    el.telemetryErrorsEmpty = document.getElementById("telemetry-errors-empty");
    el.telemetryErrorsWarning = document.getElementById(
      "telemetry-errors-warning"
    );

    /* Admin activity */
    el.adminActivityBody = document.getElementById("admin-activity-body");
    el.adminActivityEmpty = document.getElementById("admin-activity-empty");
  }

  /* ============================================================
     UTILITIES
     ============================================================ */

  function setText(target, value) {
    if (!target) return;
    target.textContent = value;
  }

  function toggleEmptyState(node, visible) {
    if (!node) return;
    node.classList[visible ? "remove" : "add"]("hidden");
  }

  function formatTime(value) {
    return window.Telemetry?.formatTimestamp?.(value) || "—";
  }

  function isRuntimeAvailable() {
    return window.__RUNTIME_AVAILABLE__ === true;
  }

  function getAppStorage() {
    if (
      typeof window.App === "object" &&
      window.App?.storage &&
      typeof window.App.storage.loadFromLocalStorage === "function"
    ) {
      return window.App.storage;
    }
    return null;
  }

  /* ============================================================
     LOCAL CONFIG METRICS
     ============================================================ */

  async function updateLocalMetrics() {
    let creatorsArr = [];
    let platformState = null;

    try {
      creatorsArr =
        (await window.ConfigState?.loadCreators?.()) ||
        [];
    } catch (err) {
      console.warn("[Overview] Failed to hydrate creators", err);
      const storage = getAppStorage();
      const stored = storage?.loadFromLocalStorage?.("creators", []);
      creatorsArr = Array.isArray(stored) ? stored : [];
    }

    try {
      platformState =
        (await window.ConfigState?.loadPlatforms?.()) || null;
    } catch (err) {
      console.warn("[Overview] Failed to hydrate platforms", err);
    }

    setText(el.creatorsCount, String(creatorsArr.length));

    let rumbleEnabled = 0;
    let kickEnabled = 0;
    let pilledEnabled = 0;
    let twitchEnabled = 0;
    let youtubeEnabled = 0;

    for (const c of creatorsArr) {
      if (c?.platforms?.rumble === true || c?.platforms?.rumble?.enabled)
        rumbleEnabled++;
      if (c?.platforms?.kick === true || c?.platforms?.kick?.enabled)
        kickEnabled++;
      if (c?.platforms?.pilled === true || c?.platforms?.pilled?.enabled)
        pilledEnabled++;
      if (c?.platforms?.twitch === true || c?.platforms?.twitch?.enabled)
        twitchEnabled++;
      if (c?.platforms?.youtube === true || c?.platforms?.youtube?.enabled)
        youtubeEnabled++;
    }

    setText(el.rumbleEnabledCount, String(rumbleEnabled));
    setText(el.kickEnabledCount, String(kickEnabled));
    setText(el.pilledEnabledCount, String(pilledEnabled));
    setText(el.twitchEnabledCount, String(twitchEnabled));
    setText(el.youtubeEnabledCount, String(youtubeEnabled));

    const storage = getAppStorage();
    const chatBehaviour = storage?.loadFromLocalStorage?.("chat_behaviour", {});
    const triggers = Array.isArray(chatBehaviour?.triggers)
      ? chatBehaviour.triggers
      : [];
    setText(el.triggersCount, String(triggers.length));

    setText(
      el.rumbleConfig,
      describePlatformState(platformState, "rumble", rumbleEnabled)
    );

    setText(
      el.kickConfig,
      describePlatformState(platformState, "kick", kickEnabled)
    );

    setText(
      el.pilledConfig,
      describePlatformState(platformState, "pilled", pilledEnabled)
    );

    setText(
      el.twitchConfig,
      describePlatformState(platformState, "twitch", twitchEnabled)
    );

    setText(
      el.youtubeConfig,
      describePlatformState(platformState, "youtube", youtubeEnabled)
    );
  }

  function describePlatformState(platformState, key, creatorCount) {
    const platform = platformState?.platforms?.[key];
    if (!platform) {
      return creatorCount
        ? `enabled for ${creatorCount} creator${creatorCount === 1 ? "" : "s"}`
        : "not configured";
    }

    if (platform.enabled === false) return "disabled globally";

    if (creatorCount > 0) {
      return `enabled for ${creatorCount} creator${creatorCount === 1 ? "" : "s"}`;
    }

    return "enabled (no creators flagged)";
  }

  /* ============================================================
     DISCORD SNAPSHOT (READ-ONLY)
     ============================================================ */

  function formatPresence(runtime) {
    const parts = [];
    if (runtime?.statusEmoji) parts.push(runtime.statusEmoji);
    if (runtime?.statusText) parts.push(runtime.statusText);
    return parts.length ? parts.join(" ") : "Not available";
  }

  function formatHeartbeat(runtime) {
    return (
      window.StreamSuitesState?.formatTimestamp?.(runtime?.lastHeartbeat) ||
      "Not available"
    );
  }

  function formatGuildCount(runtime) {
    return Number.isInteger(runtime?.guildCount)
      ? String(runtime.guildCount)
      : "Not available";
  }

  function formatConnection(runtime) {
    return (
      window.StreamSuitesState?.describeDiscordConnection?.(runtime) ||
      "Unknown"
    );
  }

  function formatConnectionDetail(runtime) {
    if (!runtime) return "Not running";
    if (runtime.connected === true) return "Connected";
    if (runtime.connected === false) return "Disconnected";
    if (runtime.running === false) return "Not running";
    return "Unknown";
  }

  function setStatusBadge(target, status) {
    if (!target) return;
    const normalized = (status || "").toLowerCase();
    target.classList.remove("online", "offline");
    target.classList.add("badge");

    if (normalized === "online") {
      target.classList.add("online");
      target.textContent = "Online";
      return;
    }

    if (normalized === "offline" || normalized === "not running") {
      target.classList.add("offline");
      target.textContent = "Offline";
      return;
    }

    target.textContent = status || "Unknown";
  }

  function renderDiscordUnavailable() {
    const unavailable = "Unavailable";
    setText(el.discordRuntime, unavailable);
    setText(el.discordConnection, unavailable);
    setText(el.discordHeartbeat, "—");
    setText(el.discordGuilds, "—");
    setText(el.discordPresence, "—");
    setStatusBadge(el.discordBotStatus, unavailable);
    if (el.badgeDiscord) {
      el.badgeDiscord.textContent = "Unavailable";
    }
  }

  async function refreshDiscord() {
    if (window.__DISCORD_FEATURES_ENABLED__ === false) {
      renderDiscordUnavailable();
      return;
    }
    const runtime =
      (await window.StreamSuitesState?.loadDiscordRuntimeSnapshot?.()) || null;

    const runtimeStatus = formatConnection(runtime);

    setText(el.discordRuntime, runtimeStatus);
    setText(el.discordConnection, formatConnectionDetail(runtime));
    setText(el.discordHeartbeat, formatHeartbeat(runtime));
    setText(el.discordGuilds, formatGuildCount(runtime));
    setText(el.discordPresence, formatPresence(runtime));
    setStatusBadge(el.discordBotStatus, runtimeStatus);

    if (el.badgeDiscord) {
      el.badgeDiscord.textContent =
        runtime && runtime.running ? "Foundation" : "Offline";
    }
  }

  /* ============================================================
     ADMIN ACTIVITY
     ============================================================ */

  function formatActivityTimestamp(value) {
    return window.StreamSuitesState?.formatTimestamp?.(value) || "—";
  }

  function renderAdminActivity(activity) {
    const body = el.adminActivityBody;
    if (!body) return;

    const events = Array.isArray(activity?.events) ? activity.events : [];
    body.innerHTML = "";

    if (!events.length) {
      toggleEmptyState(el.adminActivityEmpty, true);
      return;
    }

    toggleEmptyState(el.adminActivityEmpty, false);

    events.slice(0, ADMIN_ACTIVITY_MAX).forEach((event) => {
      const row = document.createElement("tr");

      const timeCell = document.createElement("td");
      timeCell.textContent = formatActivityTimestamp(event.timestamp);
      row.appendChild(timeCell);

      const sourceCell = document.createElement("td");
      sourceCell.textContent = event.source || "—";
      row.appendChild(sourceCell);

      const userCell = document.createElement("td");
      userCell.textContent = event.user || "—";
      row.appendChild(userCell);

      const actionCell = document.createElement("td");
      actionCell.textContent = event.action || "—";
      row.appendChild(actionCell);

      body.appendChild(row);
    });
  }

  async function refreshAdminActivity() {
    try {
      const activity =
        (await window.StreamSuitesState?.loadAdminActivity?.({
          forceReload: true
        })) || null;
      renderAdminActivity(activity);
    } catch (err) {
      console.warn("[Overview] Admin activity refresh failed", err);
      renderAdminActivity(null);
    }
  }

  /* ============================================================
     API QUOTA — RUNTIME-BACKED
     ============================================================ */

  function animateQuotaBar(fillEl, used, max, status) {
    if (!fillEl || !max) return;

    const percent = Math.min((used / max) * 100, 100);

    fillEl.classList.remove("warn", "danger");
    fillEl.style.transition = "none";
    fillEl.style.width = "0%";

    void fillEl.offsetWidth;

    fillEl.style.transition =
      "width 1200ms cubic-bezier(0.19, 1, 0.22, 1)";
    fillEl.style.width = percent + "%";

    if (status === "exhausted") {
      fillEl.classList.add("danger");
    } else if (status === "buffer") {
      fillEl.classList.add("warn");
    }
  }

  function updateQuotaFromRuntime() {
    const snap = window.App?.state?.quotas?.getSnapshot?.();
    if (!snap || typeof snap !== "object") return;

    // Current scope: YouTube daily units
    if (snap.platform !== "youtube") return;

    animateQuotaBar(
      el.quotaDailyFill,
      snap.used,
      snap.max,
      snap.status
    );
  }

  /* ============================================================
     SYSTEM STATUS
     ============================================================ */

  function updateSystemStatus() {
    setText(el.dashboardState, "active");

    try {
      localStorage.setItem("__ss_test__", "1");
      localStorage.removeItem("__ss_test__");
      setText(el.storageState, "available");
    } catch {
      setText(el.storageState, "unavailable");
    }
  }

  function renderRuntimeDisconnected() {
    const placeholder = "Runtime not connected";

    setText(el.dashboardState, "static mode");

    setText(el.discordRuntime, placeholder);
    setText(el.discordConnection, placeholder);
    setText(el.discordHeartbeat, placeholder);
    setText(el.discordGuilds, "—");
    setText(el.discordPresence, "—");

    if (el.discordBotStatus) {
      el.discordBotStatus.classList.remove("online");
      el.discordBotStatus.classList.add("offline");
      el.discordBotStatus.textContent = "Disconnected";
    }

    setText(el.rumbleRuntime, placeholder);
    setText(el.kickRuntime, placeholder);
    setText(el.pilledRuntime, placeholder);
    setText(el.twitchRuntime, placeholder);
    setText(el.youtubeRuntime, placeholder);

    if (el.adminActivityBody) el.adminActivityBody.innerHTML = "";
    if (el.adminActivityEmpty) {
      el.adminActivityEmpty.textContent = placeholder;
      toggleEmptyState(el.adminActivityEmpty, true);
    }

    if (el.telemetryEmpty) {
      el.telemetryEmpty.textContent = placeholder;
      toggleEmptyState(el.telemetryEmpty, true);
    }
    if (el.telemetryEventsBody) el.telemetryEventsBody.innerHTML = "";
    if (el.telemetryEventsEmpty) {
      el.telemetryEventsEmpty.textContent = placeholder;
      toggleEmptyState(el.telemetryEventsEmpty, true);
    }
    if (el.telemetryRatesGrid) el.telemetryRatesGrid.innerHTML = "";
    if (el.telemetryRatesEmpty) {
      el.telemetryRatesEmpty.textContent = placeholder;
      toggleEmptyState(el.telemetryRatesEmpty, true);
    }
    if (el.telemetryErrorsBody) el.telemetryErrorsBody.innerHTML = "";
    if (el.telemetryErrorsEmpty) {
      el.telemetryErrorsEmpty.textContent = placeholder;
      toggleEmptyState(el.telemetryErrorsEmpty, true);
    }
  }

  function bindBadgeClicks() {
    const map = {
      badgeDiscord: "discord",
      badgeRumble: "rumble",
      badgeKick: "kick",
      badgePilled: "pilled",
      badgeTwitch: "twitch",
      badgeYouTube: "youtube"
    };

    Object.entries(map).forEach(([key, view]) => {
      const node = el[key];
      if (!node) return;

      node.style.cursor = "pointer";
      node.title = `Open ${view} module`;

      node.addEventListener("click", (e) => {
        e.stopPropagation();
        if (window.App?.views?.[view]) {
          window.location.hash = `#${view}`;
        }
      });
    });
  }

  /* ============================================================
     RUNTIME TELEMETRY
     ============================================================ */

  function setTelemetryRows(status, last, error) {
    if (!el.telemetry) return;
    const keys = window.Telemetry?.PLATFORM_KEYS || [
      "youtube",
      "twitch",
      "kick",
      "pilled",
      "rumble",
      "discord"
    ];

    keys.forEach((key) => {
      const row = el.telemetry[key];
      if (!row) return;
      setText(row.status, status);
      setText(row.last, last);
      setText(row.error, error);
    });
  }

  function renderTelemetry(snapshot) {
    const hasData = snapshot && snapshot.platforms;

    if (!hasData) {
      el.telemetryEmpty?.classList.remove("hidden");
      setTelemetryRows("unknown", "—", "No runtime snapshot available");
      return;
    }

    el.telemetryEmpty?.classList.add("hidden");

    const keys = window.Telemetry?.PLATFORM_KEYS || Object.keys(snapshot.platforms);
    const runtimeTargets = {
      rumble: el.rumbleRuntime,
      kick: el.kickRuntime,
      pilled: el.pilledRuntime,
      twitch: el.twitchRuntime,
      youtube: el.youtubeRuntime
    };

    const badgeTargets = {
      rumble: el.badgeRumble,
      kick: el.badgeKick,
      pilled: el.badgePilled,
      twitch: el.badgeTwitch,
      youtube: el.badgeYouTube
    };

    keys.forEach((key) => {
      const desc =
        window.Telemetry?.describePlatform?.(key, snapshot) || {};
      const row = el.telemetry[key];
      if (!row) return;

      const enabledPrefix = desc.enabled === false ? "DISABLED — " : "";
      const statusText = desc.paused ? "paused" : desc.status || "unknown";

      setText(row.status, `${enabledPrefix}${statusText}`.trim());
      setText(row.last, desc.last_seen || "—");
      setText(row.error, desc.error_state || "—");

      const runtimeNode = runtimeTargets[key];
      if (runtimeNode) {
        const runtimeLabel = `${enabledPrefix}${statusText}`.trim() || "unknown";
        setText(runtimeNode, runtimeLabel);
      }

      const badgeNode = badgeTargets[key];
      if (badgeNode) {
        if (key === "kick") {
          badgeNode.textContent =
            desc.enabled === false ? "Disabled in Runtime" : "Scaffold (Runtime Export)";
        } else if (key === "pilled") {
          badgeNode.textContent = desc.enabled === false
            ? "Control-Plane Locked"
            : "Ingest-Only (Control-Plane Unavailable)";
        } else if (key === "rumble") {
          badgeNode.textContent = desc.status
            ? `${desc.status}`.replace(/^\w/, (c) => c.toUpperCase())
            : "Architecture Solved (SSE-first)";
        }
      }
    });
  }

  function renderTelemetryWarning(target, health, missingMessage) {
    if (!target) return;
    if (!health || health.status === "fresh") {
      target.classList.add("hidden");
      target.textContent = "";
      return;
    }

    const messages = {
      missing: missingMessage || "Telemetry snapshot missing — updates pending.",
      stale: "Telemetry snapshot is stale — values may be outdated.",
      invalid: "Telemetry snapshot invalid — unable to trust telemetry data."
    };

    target.textContent = messages[health.status] || missingMessage || "Telemetry unavailable.";
    target.classList.remove("hidden");
  }

  function buildSeverityBadge(severity, labelOverride) {
    const badge = document.createElement("span");
    const level = (severity || "info").toLowerCase();
    badge.className = `telemetry-severity telemetry-${level}`;

    const dot = document.createElement("span");
    dot.className = "telemetry-severity-dot";
    badge.appendChild(dot);

    const label = document.createElement("span");
    label.textContent = labelOverride || level;
    badge.appendChild(label);

    return badge;
  }

  function renderTelemetryEvents(snapshot, health) {
    const body = el.telemetryEventsBody;
    if (!body) return;

    renderTelemetryWarning(
      el.telemetryEventsWarning,
      health,
      "No telemetry events exported yet."
    );

    const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
    body.innerHTML = "";

    if (!events.length) {
      toggleEmptyState(el.telemetryEventsEmpty, true);
      return;
    }

    toggleEmptyState(el.telemetryEventsEmpty, false);

    events.slice(0, TELEMETRY_MAX_EVENTS).forEach((evt) => {
      const row = document.createElement("tr");

      const severityCell = document.createElement("td");
      severityCell.appendChild(buildSeverityBadge(evt.severity));
      row.appendChild(severityCell);

      const tsCell = document.createElement("td");
      tsCell.className = "align-right";
      tsCell.textContent = formatTime(evt.timestamp);
      row.appendChild(tsCell);

      const sourceCell = document.createElement("td");
      sourceCell.textContent = evt.source || "—";
      row.appendChild(sourceCell);

      const messageCell = document.createElement("td");
      messageCell.textContent = evt.message || "—";
      row.appendChild(messageCell);

      body.appendChild(row);
    });
  }

  function humanizeMetricLabel(label) {
    if (!label) return "Metric";
    return label
      .replace(/[._]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function renderTelemetryRates(snapshot, health) {
    renderTelemetryWarning(
      el.telemetryRatesWarning,
      health,
      "No rate telemetry exported yet."
    );

    const metrics = Array.isArray(snapshot?.metrics) ? snapshot.metrics : [];
    const windowLabel = snapshot?.window || "Recent window";
    setText(el.telemetryRatesWindow, `Window: ${windowLabel}`);

    const grid = el.telemetryRatesGrid;
    if (!grid) return;

    grid.innerHTML = "";

    if (!metrics.length) {
      toggleEmptyState(el.telemetryRatesEmpty, true);
      return;
    }

    toggleEmptyState(el.telemetryRatesEmpty, false);

    metrics.slice(0, TELEMETRY_MAX_METRICS).forEach((metric) => {
      const card = document.createElement("div");
      card.className = "telemetry-rate-card";

      const value = document.createElement("div");
      value.className = "telemetry-rate-value";
      value.textContent = metric.value ?? "—";
      card.appendChild(value);

      const label = document.createElement("div");
      label.className = "telemetry-rate-label";

      const labelSpan = document.createElement("span");
      labelSpan.textContent = humanizeMetricLabel(metric.label || metric.key);
      label.appendChild(labelSpan);

      const unitSpan = document.createElement("span");
      unitSpan.textContent = metric.unit || "";
      label.appendChild(unitSpan);

      card.appendChild(label);
      grid.appendChild(card);
    });
  }

  function renderTelemetryErrors(snapshot, health) {
    const body = el.telemetryErrorsBody;
    if (!body) return;

    renderTelemetryWarning(
      el.telemetryErrorsWarning,
      health,
      "No errors reported in telemetry exports."
    );

    const errors = Array.isArray(snapshot?.errors) ? snapshot.errors : [];
    body.innerHTML = "";

    if (!errors.length) {
      toggleEmptyState(el.telemetryErrorsEmpty, true);
      return;
    }

    toggleEmptyState(el.telemetryErrorsEmpty, false);

    errors.slice(0, TELEMETRY_MAX_ERRORS).forEach((err) => {
      const row = document.createElement("tr");
      if (err.active) row.classList.add("telemetry-error-active");

      const statusCell = document.createElement("td");
      const statusBadge = buildSeverityBadge(
        err.active ? "error" : "info",
        err.active ? "active" : "cleared"
      );
      statusCell.appendChild(statusBadge);
      row.appendChild(statusCell);

      const subsystemCell = document.createElement("td");
      subsystemCell.textContent = err.subsystem || "Unknown subsystem";
      row.appendChild(subsystemCell);

      const lastSeenCell = document.createElement("td");
      lastSeenCell.className = "align-right";
      lastSeenCell.textContent = formatTime(err.last_seen || err.timestamp);
      row.appendChild(lastSeenCell);

      const messageCell = document.createElement("td");
      messageCell.textContent = err.message || "—";
      row.appendChild(messageCell);

      body.appendChild(row);
    });
  }

  async function refreshTelemetry() {
    try {
      const [snapshot, events, rates, errors] = await Promise.all([
        window.Telemetry?.loadSnapshot?.(true),
        window.Telemetry?.loadEvents?.({ forceReload: true }),
        window.Telemetry?.loadRates?.({ forceReload: true }),
        window.Telemetry?.loadErrors?.({ forceReload: true })
      ]);

      const [eventsHealth, ratesHealth, errorsHealth] = await Promise.all([
        window.Telemetry?.evaluateSnapshotHealth?.(events),
        window.Telemetry?.evaluateSnapshotHealth?.(rates),
        window.Telemetry?.evaluateSnapshotHealth?.(errors)
      ]);

      renderTelemetry(snapshot);
      renderTelemetryEvents(events, eventsHealth);
      renderTelemetryRates(rates, ratesHealth);
      renderTelemetryErrors(errors, errorsHealth);
    } catch (err) {
      console.warn("[Overview] Telemetry refresh failed", err);
      renderTelemetry(null);
      renderTelemetryEvents(null, null);
      renderTelemetryRates(null, null);
      renderTelemetryErrors(null, null);
    }
  }

  /* ============================================================
     VIEW LIFECYCLE
     ============================================================ */

  function init() {
    cacheElements();
    updateSystemStatus();

    setText(el.rumbleRuntime, "offline / unknown");
    setText(el.kickRuntime, "offline / unknown");
    setText(el.pilledRuntime, "ingest-only / planned");
    setText(el.twitchRuntime, "offline / unknown");
    setText(el.youtubeRuntime, "offline / not connected");

    bindBadgeClicks();

    if (!isRuntimeAvailable()) {
      renderRuntimeDisconnected();
      console.info("[Dashboard] Runtime unavailable. Polling disabled.");
      return;
    }

    setTimeout(() => {
      void updateLocalMetrics();
      void refreshDiscord();
      void refreshAdminActivity();
      void refreshTelemetry();
      updateQuotaFromRuntime();
    }, 0);

    updateQuotaFromRuntime();
    quotaRefreshHandle = setInterval(updateQuotaFromRuntime, 3000);

    if (refreshHandle) clearInterval(refreshHandle);
    refreshHandle = setInterval(refreshDiscord, REFRESH_INTERVAL_MS);

    if (telemetryHandle) clearInterval(telemetryHandle);
    telemetryHandle = setInterval(refreshTelemetry, TELEMETRY_REFRESH_MS);

    if (adminActivityHandle) clearInterval(adminActivityHandle);
    adminActivityHandle = setInterval(refreshAdminActivity, REFRESH_INTERVAL_MS);
  }

  function destroy() {
    if (refreshHandle) {
      clearInterval(refreshHandle);
      refreshHandle = null;
    }
    if (quotaRefreshHandle) {
      clearInterval(quotaRefreshHandle);
      quotaRefreshHandle = null;
    }
    if (telemetryHandle) {
      clearInterval(telemetryHandle);
      telemetryHandle = null;
    }
    if (adminActivityHandle) {
      clearInterval(adminActivityHandle);
      adminActivityHandle = null;
    }
  }

  window.OverviewView = {
    init,
    destroy
  };
})();

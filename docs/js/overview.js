(() => {
  "use strict";

  const REFRESH_INTERVAL_MS = 15000;
  const TELEMETRY_REFRESH_MS = 15000;

  let refreshHandle = null;
  let quotaRefreshHandle = null;
  let telemetryHandle = null;

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
    el.twitchEnabledCount = document.getElementById("ov-twitch-enabled-count");
    el.youtubeEnabledCount = document.getElementById("ov-youtube-enabled-count");

    el.discordRuntime = document.getElementById("ov-discord-runtime");
    el.discordConnection = document.getElementById("ov-discord-connection");
    el.discordHeartbeat = document.getElementById("ov-discord-heartbeat");
    el.discordGuilds = document.getElementById("ov-discord-guilds");
    el.discordPresence = document.getElementById("ov-discord-presence");

    el.rumbleConfig = document.getElementById("ov-rumble-config");
    el.rumbleRuntime = document.getElementById("ov-rumble-runtime");

    el.twitchConfig = document.getElementById("ov-twitch-config");
    el.twitchRuntime = document.getElementById("ov-twitch-runtime");
    el.youtubeConfig = document.getElementById("ov-youtube-config");
    el.youtubeRuntime = document.getElementById("ov-youtube-runtime");

    /* Platform badges */
    el.badgeDiscord = document.getElementById("badge-discord");
    el.badgeRumble = document.getElementById("badge-rumble");
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
  }

  /* ============================================================
     UTILITIES
     ============================================================ */

  function setText(target, value) {
    if (!target) return;
    target.textContent = value;
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
    let twitchEnabled = 0;
    let youtubeEnabled = 0;

    for (const c of creatorsArr) {
      if (c?.platforms?.rumble === true || c?.platforms?.rumble?.enabled)
        rumbleEnabled++;
      if (c?.platforms?.twitch === true || c?.platforms?.twitch?.enabled)
        twitchEnabled++;
      if (c?.platforms?.youtube === true || c?.platforms?.youtube?.enabled)
        youtubeEnabled++;
    }

    setText(el.rumbleEnabledCount, String(rumbleEnabled));
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

  async function refreshDiscord() {
    const runtime =
      (await window.StreamSuitesState?.loadDiscordRuntimeSnapshot?.()) || null;

    setText(el.discordRuntime, formatConnection(runtime));
    setText(el.discordConnection, formatConnectionDetail(runtime));
    setText(el.discordHeartbeat, formatHeartbeat(runtime));
    setText(el.discordGuilds, formatGuildCount(runtime));
    setText(el.discordPresence, formatPresence(runtime));

    if (el.badgeDiscord) {
      el.badgeDiscord.textContent =
        runtime && runtime.running ? "Foundation" : "Offline";
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

  function bindBadgeClicks() {
    const map = {
      badgeDiscord: "discord",
      badgeRumble: "rumble",
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
    });
  }

  async function refreshTelemetry() {
    try {
      const snapshot = await window.Telemetry?.loadSnapshot?.(true);
      renderTelemetry(snapshot);
    } catch (err) {
      console.warn("[Overview] Telemetry refresh failed", err);
      renderTelemetry(null);
    }
  }

  /* ============================================================
     VIEW LIFECYCLE
     ============================================================ */

  async function init() {
    cacheElements();
    updateSystemStatus();
    await updateLocalMetrics();
    refreshDiscord();
    refreshTelemetry();

    setText(el.rumbleRuntime, "offline / unknown");
    setText(el.twitchRuntime, "offline / unknown");
    setText(el.youtubeRuntime, "offline / not connected");

    bindBadgeClicks();

    updateQuotaFromRuntime();
    quotaRefreshHandle = setInterval(updateQuotaFromRuntime, 3000);

    if (refreshHandle) clearInterval(refreshHandle);
    refreshHandle = setInterval(refreshDiscord, REFRESH_INTERVAL_MS);

    if (telemetryHandle) clearInterval(telemetryHandle);
    telemetryHandle = setInterval(refreshTelemetry, TELEMETRY_REFRESH_MS);
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
  }

  window.OverviewView = {
    init,
    destroy
  };
})();

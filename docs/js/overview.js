(() => {
  "use strict";

  const REFRESH_INTERVAL_MS = 15000;

  let refreshHandle = null;

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
    el.quotaDailyFill = document.querySelector(
      ".ss-quota-row .ss-quota-fill"
    );
    el.quotaMinuteFill = document.querySelectorAll(
      ".ss-quota-row .ss-quota-fill"
    )[1];
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

  function updateLocalMetrics() {
    const storage = getAppStorage();
    if (!storage) {
      setText(el.creatorsCount, "Not available");
      setText(el.triggersCount, "Not available");
      setText(el.rumbleEnabledCount, "Not available");
      setText(el.twitchEnabledCount, "Not available");
      setText(el.youtubeEnabledCount, "Not available");
      setText(el.rumbleConfig, "Not available");
      setText(el.twitchConfig, "Not available");
      setText(el.youtubeConfig, "Not available");
      return;
    }

    const creators = storage.loadFromLocalStorage("creators", []);
    const creatorsArr = Array.isArray(creators) ? creators : [];
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

    const chatBehaviour = storage.loadFromLocalStorage("chat_behaviour", {});
    const triggers = Array.isArray(chatBehaviour?.triggers)
      ? chatBehaviour.triggers
      : [];
    setText(el.triggersCount, String(triggers.length));

    setText(
      el.rumbleConfig,
      rumbleEnabled
        ? `enabled for ${rumbleEnabled} creator${rumbleEnabled === 1 ? "" : "s"}`
        : "disabled / not configured"
    );

    setText(
      el.twitchConfig,
      twitchEnabled
        ? `enabled for ${twitchEnabled} creator${twitchEnabled === 1 ? "" : "s"}`
        : "disabled / not configured"
    );

    setText(
      el.youtubeConfig,
      youtubeEnabled
        ? `enabled for ${youtubeEnabled} creator${youtubeEnabled === 1 ? "" : "s"}`
        : "disabled / not configured"
    );
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
     API QUOTA (DEV PLACEHOLDER)
     ============================================================ */

  function animateQuotaBar(fillEl, used, max) {
    if (!fillEl) return;

    const percent = Math.min((used / max) * 100, 100);

    fillEl.classList.remove("warn", "danger");
    fillEl.style.transition = "none";
    fillEl.style.width = "0%";

    void fillEl.offsetWidth;

    fillEl.style.transition =
      "width 1200ms cubic-bezier(0.19, 1, 0.22, 1)";
    fillEl.style.width = percent + "%";

    if (used >= max - 10000) {
      fillEl.classList.add("danger");
    } else if (used >= max - 50000) {
      fillEl.classList.add("warn");
    }
  }

  function updateQuotaPlaceholders() {
    /* DEV-ONLY simulated values */
    const DAILY_MAX = 200000;
    const simulatedDailyUsed = 82000; // change freely for testing
    const simulatedPerMinuteUsed = 120;

    animateQuotaBar(el.quotaDailyFill, simulatedDailyUsed, DAILY_MAX);
    animateQuotaBar(el.quotaMinuteFill, simulatedPerMinuteUsed, 1000);
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
     VIEW LIFECYCLE
     ============================================================ */

  function init() {
    cacheElements();
    updateSystemStatus();
    updateLocalMetrics();
    refreshDiscord();
    updateQuotaPlaceholders();

    setText(el.rumbleRuntime, "offline / unknown");
    setText(el.twitchRuntime, "offline / unknown");
    setText(el.youtubeRuntime, "offline / not connected");

    bindBadgeClicks();

    if (refreshHandle) clearInterval(refreshHandle);
    refreshHandle = setInterval(refreshDiscord, REFRESH_INTERVAL_MS);
  }

  function destroy() {
    if (refreshHandle) {
      clearInterval(refreshHandle);
      refreshHandle = null;
    }
  }

  window.OverviewView = {
    init,
    destroy
  };
})();

(() => {
  "use strict";

  const REFRESH_INTERVAL_MS = 15000;

  let refreshHandle = null;

  const el = {};

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
  }

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
      const pr = c?.platforms?.rumble;
      if (pr === true || pr?.enabled === true) {
        rumbleEnabled += 1;
      }

      const tw = c?.platforms?.twitch;
      if (tw === true || tw?.enabled === true) {
        twitchEnabled += 1;
      }

      const yt = c?.platforms?.youtube;
      if (yt === true || yt?.enabled === true) {
        youtubeEnabled += 1;
      }
    }

    setText(el.rumbleEnabledCount, String(rumbleEnabled));
    setText(el.twitchEnabledCount, String(twitchEnabled));
    setText(el.youtubeEnabledCount, String(youtubeEnabled));

    const chatBehaviour = storage.loadFromLocalStorage("chat_behaviour", {});
    const triggers = Array.isArray(chatBehaviour?.triggers)
      ? chatBehaviour.triggers
      : [];
    setText(el.triggersCount, String(triggers.length));

    if (el.rumbleConfig) {
      if (rumbleEnabled > 0) {
        setText(
          el.rumbleConfig,
          `enabled for ${rumbleEnabled} creator${rumbleEnabled === 1 ? "" : "s"}`
        );
      } else {
        setText(el.rumbleConfig, "disabled / not configured");
      }
    }

    if (el.twitchConfig) {
      if (twitchEnabled > 0) {
        setText(
          el.twitchConfig,
          `enabled for ${twitchEnabled} creator${twitchEnabled === 1 ? "" : "s"}`
        );
      } else {
        setText(el.twitchConfig, "disabled / not configured");
      }
    }

    if (el.youtubeConfig) {
      if (youtubeEnabled > 0) {
        setText(
          el.youtubeConfig,
          `enabled for ${youtubeEnabled} creator${youtubeEnabled === 1 ? "" : "s"}`
        );
      } else {
        setText(el.youtubeConfig, "disabled / not configured");
      }
    }
  }

  function formatPresence(runtime) {
    const parts = [];
    if (runtime?.statusEmoji) parts.push(runtime.statusEmoji);
    if (runtime?.statusText) parts.push(runtime.statusText);
    if (parts.length === 0) return "Not available";
    return parts.join(" ");
  }

  function formatHeartbeat(runtime) {
    return (
      window.StreamSuitesState?.formatTimestamp?.(runtime?.lastHeartbeat) ||
      "Not available"
    );
  }

  function formatGuildCount(runtime) {
    if (Number.isInteger(runtime?.guildCount)) {
      return String(runtime.guildCount);
    }
    return "Not available";
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
  }

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

  function init() {
    cacheElements();
    updateSystemStatus();
    updateLocalMetrics();
    refreshDiscord();

    setText(el.rumbleRuntime, "offline / unknown");
    setText(el.twitchRuntime, "offline / unknown");
    setText(el.youtubeRuntime, "offline / not connected");

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

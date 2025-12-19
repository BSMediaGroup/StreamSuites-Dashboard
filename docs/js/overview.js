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

    el.discordRuntime = document.getElementById("ov-discord-runtime");
    el.discordConnection = document.getElementById("ov-discord-connection");
    el.discordHeartbeat = document.getElementById("ov-discord-heartbeat");
    el.discordGuilds = document.getElementById("ov-discord-guilds");
    el.discordPresence = document.getElementById("ov-discord-presence");
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
      return;
    }

    const creators = storage.loadFromLocalStorage("creators", []);
    const creatorsArr = Array.isArray(creators) ? creators : [];
    setText(el.creatorsCount, String(creatorsArr.length));

    let rumbleEnabled = 0;
    for (const c of creatorsArr) {
      const pr = c?.platforms?.rumble;
      if (pr === true || pr?.enabled === true) {
        rumbleEnabled += 1;
      }
    }
    setText(el.rumbleEnabledCount, String(rumbleEnabled));

    const chatBehaviour = storage.loadFromLocalStorage("chat_behaviour", {});
    const triggers = Array.isArray(chatBehaviour?.triggers)
      ? chatBehaviour.triggers
      : [];
    setText(el.triggersCount, String(triggers.length));
  }

  function formatPresence(runtime) {
    const parts = [];
    if (runtime?.statusEmoji) parts.push(runtime.statusEmoji);
    if (runtime?.statusText) parts.push(runtime.statusText);
    if (parts.length === 0) return "Not available";
    return parts.join(" ");
  }

  function formatHeartbeat(runtime) {
    const formatted =
      window.StreamSuitesState?.formatTimestamp?.(runtime?.lastHeartbeat) ||
      "Not available";
    return formatted;
  }

  function formatGuildCount(runtime) {
    if (Number.isInteger(runtime?.guildCount)) {
      return String(runtime.guildCount);
    }
    return "Not available";
  }

  function formatConnection(runtime) {
    const label =
      window.StreamSuitesState?.describeDiscordConnection?.(runtime) ||
      "Unknown";
    return label;
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

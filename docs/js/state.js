(() => {
  "use strict";

  const STATE_ROOT = "./shared/state/";

  function buildStateUrl(relativePath) {
    try {
      return new URL(`${STATE_ROOT}${relativePath}`, document.baseURI);
    } catch (err) {
      console.warn("[Dashboard][State] Failed to build URL", err);
      return null;
    }
  }

  async function loadStateJson(relativePath) {
    const url = buildStateUrl(relativePath);
    if (!url) return null;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.warn(`[Dashboard][State] Unable to load ${relativePath}`, err);
      return null;
    }
  }

  function pickString(...values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim() !== "") {
        return value;
      }
    }
    return null;
  }

  function pickBoolean(...values) {
    for (const value of values) {
      if (value === true || value === false) {
        return value;
      }
    }
    return null;
  }

  function pickInteger(...values) {
    for (const value of values) {
      if (Number.isInteger(value)) {
        return value;
      }
    }
    return null;
  }

  function formatTimestamp(timestamp) {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return null;
    try {
      return date.toLocaleString(undefined, { hour12: false });
    } catch (err) {
      console.warn("[Dashboard][State] Failed to format timestamp", err);
      return timestamp;
    }
  }

  function normalizeDiscordRuntime(raw) {
    if (!raw || typeof raw !== "object") return null;

    const heartbeat =
      raw.heartbeat && typeof raw.heartbeat === "object"
        ? raw.heartbeat
        : {};

    const status =
      raw.status && typeof raw.status === "object"
        ? raw.status
        : {};

    const presence =
      raw.presence && typeof raw.presence === "object"
        ? raw.presence
        : {};

    return {
      running: pickBoolean(raw.running),
      connected: pickBoolean(raw.connected, heartbeat.connected),
      guildCount: pickInteger(raw.guild_count),
      taskCount: pickInteger(raw.task_count, raw.tasks),
      lastHeartbeat: pickString(raw.last_heartbeat_ts, heartbeat.last_tick_at),
      startedAt: pickString(heartbeat.started_at, raw.started_at),
      statusText: pickString(status.text, presence.status_text),
      statusEmoji: pickString(status.emoji, presence.status_emoji),
      heartbeat
    };
  }

  function describeDiscordConnection(runtime) {
    if (!runtime) return "Not running";

    if (runtime.running === false) return "Not running";
    if (runtime.connected === true) return "Online";
    if (runtime.connected === false) return "Offline";
    if (runtime.running === true) return "Unknown";

    return "Unknown";
  }

  async function loadDiscordRuntimeSnapshot() {
    const data = await loadStateJson("discord/runtime.json");
    return normalizeDiscordRuntime(data);
  }

  window.StreamSuitesState = {
    formatTimestamp,
    loadStateJson,
    loadDiscordRuntimeSnapshot,
    normalizeDiscordRuntime,
    describeDiscordConnection
  };
})();

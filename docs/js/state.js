(() => {
  "use strict";

  const DEFAULT_STATE_ROOTS = [
    "./shared/state/",
    // Runtime repo fallback (read-only, GitHub raw)
    "https://raw.githubusercontent.com/BSMediaGroup/StreamSuites/main/shared/state/"
  ];

  const STORAGE_KEY = "streamsuites.stateRootOverride";

  function normalizeRoot(root) {
    if (typeof root !== "string" || !root.trim()) return null;
    return root.trim().replace(/\/+$/, "/");
  }

  function getConfiguredStateRoots() {
    const roots = [];

    try {
      const params = new URLSearchParams(window.location.search);
      const overrideParam = normalizeRoot(params.get("stateRoot"));
      if (overrideParam) {
        localStorage.setItem(STORAGE_KEY, overrideParam);
        roots.push(overrideParam);
      }

      const storedOverride = normalizeRoot(localStorage.getItem(STORAGE_KEY));
      if (storedOverride && !roots.includes(storedOverride)) {
        roots.push(storedOverride);
      }
    } catch (err) {
      console.warn("[Dashboard][State] Failed to read state root override", err);
    }

    for (const root of DEFAULT_STATE_ROOTS) {
      const normalized = normalizeRoot(root);
      if (normalized && !roots.includes(normalized)) {
        roots.push(normalized);
      }
    }

    return roots;
  }

  function buildStateUrl(root, relativePath) {
    try {
      return new URL(`${root}${relativePath}`, document.baseURI);
    } catch (err) {
      console.warn("[Dashboard][State] Failed to build URL", err);
      return null;
    }
  }

  async function loadStateJson(relativePath) {
    const roots = getConfiguredStateRoots();

    for (const root of roots) {
      const url = buildStateUrl(root, relativePath);
      if (!url) continue;

      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          console.warn(
            `[Dashboard][State] ${relativePath} from ${url} failed: HTTP ${res.status}`
          );
          continue;
        }
        return await res.json();
      } catch (err) {
        console.warn(
          `[Dashboard][State] Error loading ${relativePath} from ${url}`,
          err
        );
      }
    }

    console.warn(
      `[Dashboard][State] Unable to load ${relativePath} from any configured state roots.`
    );
    return null;
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

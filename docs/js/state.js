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

/* =====================================================================
   CONFIG STATE LAYER (LOCAL + JSON DATA FALLBACKS)
   - Provides normalized access to creators, platforms, and dashboard state
   - Uses localStorage as a staging layer
   - Falls back to docs/data/*.json when no draft is present
   - Exposed as window.ConfigState
   ===================================================================== */

(() => {
  "use strict";

  const PLATFORM_KEYS = ["youtube", "twitch", "rumble", "discord"];

  const DATA_PATHS = {
    creators: "data/creators.json",
    platforms: "data/platforms.json",
    dashboard: "data/dashboard_state.json",
    runtimeSnapshot: "data/runtime_snapshot.json"
  };

  const DEFAULT_CREATORS = [
    {
      creator_id: "daniel",
      display_name: "Daniel",
      notes: "Seed creator imported from runtime state.",
      disabled: false,
      platforms_enabled: {
        youtube: false,
        twitch: false,
        rumble: true,
        discord: true
      },
      platforms: {
        youtube: { enabled: false },
        twitch: { enabled: false },
        rumble: {
          enabled: true,
          watch_url: "https://rumble.com/vXXXX-demo-live.html"
        },
        discord: { enabled: true }
      }
    }
  ];

  const DEFAULT_PLATFORMS = {
    schema: "streamsuites.platforms.v1",
    platforms: {
      youtube: {
        enabled: true,
        telemetry_enabled: true,
        notes: "Primary VOD + live ingestion."
      },
      twitch: {
        enabled: false,
        telemetry_enabled: true,
        notes: "Enable when Twitch credentials are provisioned."
      },
      rumble: {
        enabled: true,
        telemetry_enabled: true,
        notes: "SSE-preferred chat ingest with DOM/API fallbacks; live testing complete."
      },
      discord: {
        enabled: true,
        telemetry_enabled: true,
        notes: "Control-plane routing for admin commands."
      }
    }
  };

  const DEFAULT_DASHBOARD_STATE = {
    schema: "streamsuites.dashboard_state.v1",
    last_loaded_at: null,
    last_export_at: null,
    draft_sources: {
      creators: DATA_PATHS.creators,
      platforms: DATA_PATHS.platforms
    }
  };

  const cache = {
    creators: null,
    platforms: null,
    dashboard: null,
    runtimeSnapshot: null
  };

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeNowIso() {
    try {
      return new Date().toISOString();
    } catch {
      return null;
    }
  }

  async function fetchJson(path) {
    try {
      const res = await fetch(new URL(path, document.baseURI), {
        cache: "no-store"
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn("[Dashboard][Config] Failed to fetch", path, err);
      return null;
    }
  }

  function normalizePlatformEntry(entry) {
    const enabled = entry?.enabled === true;
    const telemetry =
      entry?.telemetry_enabled === true || entry?.telemetry_enabled === false
        ? entry.telemetry_enabled
        : enabled;

    return {
      enabled,
      telemetry_enabled: telemetry,
      notes: typeof entry?.notes === "string" ? entry.notes : ""
    };
  }

  function normalizePlatforms(raw) {
    const sourcePlatforms =
      (raw && typeof raw === "object" && raw.platforms) || raw || {};
    const normalized = {};

    PLATFORM_KEYS.forEach((key) => {
      normalized[key] = normalizePlatformEntry(sourcePlatforms[key]);
    });

    return normalized;
  }

  function validateCreatorShape(entry) {
    if (!entry || typeof entry !== "object") return false;
    if (typeof entry.creator_id !== "string") return false;
    if ("display_name" in entry && typeof entry.display_name !== "string") {
      return false;
    }
    if ("platforms_enabled" in entry) {
      const pe = entry.platforms_enabled;
      if (!pe || typeof pe !== "object") return false;
    }
    return true;
  }

  function normalizeCreator(raw) {
    if (!validateCreatorShape(raw)) return null;

    const creator = {
      creator_id: raw.creator_id.trim(),
      display_name: (raw.display_name || raw.creator_id || "").trim(),
      notes: typeof raw.notes === "string" ? raw.notes : "",
      disabled: raw.disabled === true,
      platforms_enabled: {},
      platforms: {}
    };

    PLATFORM_KEYS.forEach((platform) => {
      const fromEnabled =
        raw.platforms_enabled && raw.platforms_enabled[platform] === true;

      const platformConfig =
        raw.platforms && typeof raw.platforms === "object"
          ? raw.platforms[platform]
          : null;

      const enabled =
        fromEnabled ||
        platformConfig === true ||
        (platformConfig && platformConfig.enabled === true);

      creator.platforms_enabled[platform] = !!enabled;

      const normalizedPlatform =
        platformConfig && typeof platformConfig === "object"
          ? { ...platformConfig }
          : {};

      normalizedPlatform.enabled = !!enabled;
      creator.platforms[platform] = normalizedPlatform;
    });

    return creator;
  }

  function normalizeCreators(list) {
    if (!Array.isArray(list)) return [];
    const normalized = list
      .map(normalizeCreator)
      .filter((entry) => entry && entry.creator_id);

    normalized.sort((a, b) =>
      a.creator_id.localeCompare(b.creator_id, undefined, {
        sensitivity: "base"
      })
    );

    return normalized;
  }

  function deriveCreatorsPayload(raw) {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object" && Array.isArray(raw.creators)) {
      return raw.creators;
    }
    return null;
  }

  async function loadCreators(options = {}) {
    if (cache.creators && !options.forceReload) {
      return deepClone(cache.creators);
    }

    const localDraft = App.storage.loadFromLocalStorage("creators", null);
    const draftPayload = deriveCreatorsPayload(localDraft) ?? localDraft;
    const draftCreators = normalizeCreators(draftPayload || []);
    if (draftCreators.length || Array.isArray(draftPayload)) {
      cache.creators = draftCreators;
      return deepClone(cache.creators);
    }

    const fileData = await fetchJson(DATA_PATHS.creators);
    const filePayload = deriveCreatorsPayload(fileData) ?? fileData;
    const fileCreators = normalizeCreators(filePayload || []);
    if (fileCreators.length) {
      cache.creators = fileCreators;
      return deepClone(cache.creators);
    }

    cache.creators = normalizeCreators(DEFAULT_CREATORS);
    return deepClone(cache.creators);
  }

  function saveCreators(list) {
    const normalized = normalizeCreators(list || []);
    cache.creators = normalized;
    App.storage.saveToLocalStorage("creators", normalized);
    updateDashboardState({
      last_loaded_at: safeNowIso()
    });
    return deepClone(cache.creators);
  }

  function exportCreatorsFile(dataOverride = null) {
    const payload = dataOverride ? normalizeCreators(dataOverride) : cache.creators;
    const creators = Array.isArray(payload) ? payload : [];

    App.storage.downloadJson("creators.json", {
      schema: "streamsuites.creators.v1",
      creators
    });
  }

  async function loadPlatforms(options = {}) {
    if (cache.platforms && !options.forceReload) {
      return deepClone(cache.platforms);
    }

    const localDraft = App.storage.loadFromLocalStorage("platforms", null);
    if (localDraft && typeof localDraft === "object") {
      cache.platforms = {
        schema: localDraft.schema || "streamsuites.platforms.v1",
        platforms: normalizePlatforms(localDraft)
      };
      return deepClone(cache.platforms);
    }

    const fileData = await fetchJson(DATA_PATHS.platforms);
    if (fileData && typeof fileData === "object") {
      cache.platforms = {
        schema: fileData.schema || "streamsuites.platforms.v1",
        platforms: normalizePlatforms(fileData)
      };
      return deepClone(cache.platforms);
    }

    cache.platforms = {
      schema: "streamsuites.platforms.v1",
      platforms: normalizePlatforms(DEFAULT_PLATFORMS)
    };
    return deepClone(cache.platforms);
  }

  function savePlatforms(platforms) {
    const normalized = {
      schema: "streamsuites.platforms.v1",
      platforms: normalizePlatforms(platforms || {})
    };
    cache.platforms = normalized;
    App.storage.saveToLocalStorage("platforms", normalized);
    updateDashboardState({
      last_loaded_at: safeNowIso()
    });
    return deepClone(cache.platforms);
  }

  function exportPlatformsFile(dataOverride = null) {
    const payload =
      dataOverride && typeof dataOverride === "object"
        ? dataOverride
        : cache.platforms;
    const normalized = {
      schema: "streamsuites.platforms.v1",
      platforms: normalizePlatforms(payload || {})
    };
    App.storage.downloadJson("platforms.json", normalized);
  }

  async function loadDashboardState(options = {}) {
    if (cache.dashboard && !options.forceReload) {
      return deepClone(cache.dashboard);
    }

    const local = App.storage.loadFromLocalStorage("dashboard_state", null);
    if (local && typeof local === "object") {
      cache.dashboard = { ...DEFAULT_DASHBOARD_STATE, ...local };
      return deepClone(cache.dashboard);
    }

    const fileData = await fetchJson(DATA_PATHS.dashboard);
    if (fileData && typeof fileData === "object") {
      cache.dashboard = { ...DEFAULT_DASHBOARD_STATE, ...fileData };
      return deepClone(cache.dashboard);
    }

    cache.dashboard = deepClone(DEFAULT_DASHBOARD_STATE);
    return deepClone(cache.dashboard);
  }

  function updateDashboardState(partial) {
    const next = { ...(cache.dashboard || DEFAULT_DASHBOARD_STATE), ...partial };
    cache.dashboard = next;
    App.storage.saveToLocalStorage("dashboard_state", next);
    return deepClone(cache.dashboard);
  }

  async function loadRuntimeSnapshot(options = {}) {
    if (cache.runtimeSnapshot && !options.forceReload) {
      return deepClone(cache.runtimeSnapshot);
    }

    const data = await fetchJson(DATA_PATHS.runtimeSnapshot);
    if (!data || typeof data !== "object" || !data.platforms) {
      cache.runtimeSnapshot = null;
      return null;
    }

    const normalized = { generated_at: data.generated_at || null, platforms: {} };

    PLATFORM_KEYS.forEach((key) => {
      const entry = data.platforms[key] || {};
      normalized.platforms[key] = {
        last_seen: entry.last_seen || null,
        status: entry.status || "unknown",
        error_state:
          entry.error_state === null || typeof entry.error_state === "string"
            ? entry.error_state
            : null
      };
    });

    cache.runtimeSnapshot = normalized;
    return deepClone(cache.runtimeSnapshot);
  }

  async function exportAllConfigs() {
    const [creators, platforms] = await Promise.all([
      loadCreators(),
      loadPlatforms()
    ]);

    exportCreatorsFile(creators);
    exportPlatformsFile(platforms);
    updateDashboardState({
      last_export_at: safeNowIso()
    });
  }

  function applyCreatorsImport(payload) {
    const sourceCreators =
      deriveCreatorsPayload(payload) ?? (payload && payload.creators);
    const normalized = normalizeCreators(sourceCreators || []);
    cache.creators = normalized;
    App.storage.saveToLocalStorage("creators", normalized);
    return deepClone(cache.creators);
  }

  function applyPlatformsImport(payload) {
    const normalized = {
      schema: "streamsuites.platforms.v1",
      platforms: normalizePlatforms(payload || {})
    };
    cache.platforms = normalized;
    App.storage.saveToLocalStorage("platforms", normalized);
    return deepClone(cache.platforms);
  }

  async function importConfigBundle(file) {
    const parsed = await App.storage.importJsonFromFile(file);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid config bundle");
    }

    const creatorsPart =
      Array.isArray(parsed) || parsed.creators ? parsed : parsed.payload;
    if (creatorsPart && (Array.isArray(creatorsPart) || creatorsPart.creators)) {
      applyCreatorsImport(creatorsPart);
    }

    if (parsed.platforms) {
      applyPlatformsImport(parsed.platforms);
    }

    updateDashboardState({
      last_loaded_at: safeNowIso()
    });
  }

  window.ConfigState = {
    loadCreators,
    saveCreators,
    exportCreatorsFile,
    applyCreatorsImport,
    loadPlatforms,
    savePlatforms,
    exportPlatformsFile,
    applyPlatformsImport,
    loadDashboardState,
    updateDashboardState,
    loadRuntimeSnapshot,
    exportAllConfigs,
    importConfigBundle
  };
})();

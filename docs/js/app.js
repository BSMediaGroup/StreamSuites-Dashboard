// ==========================================================
// StreamSuites SAFE MODE (Non-blocking)
// ==========================================================

let streamsuitesCoreStylesLogged = false;
const checkCoreStylesLoaded = () => {
  if (streamsuitesCoreStylesLogged) return;
  if (!document?.documentElement) return;

  const rootStyle = window.getComputedStyle(document.documentElement);
  const bgRoot = rootStyle.getPropertyValue("--bg-root").trim();

  if (!bgRoot) {
    streamsuitesCoreStylesLogged = true;
    console.warn("[Dashboard] Core CSS appears missing (theme variables not set).");
  }
};

window.addEventListener("load", checkCoreStylesLoaded, { once: true });

window.__STREAMSUITES_SAFE_MODE__ = true;
console.warn("[SAFE MODE] Soft guard enabled (non-blocking).");

// ----------------------------------------------------------
// Timers — LOG ONLY (NO BLOCKING)
// ----------------------------------------------------------
if (window.__STREAMSUITES_SAFE_MODE__) {
  const _setInterval = window.setInterval;
  const _setTimeout = window.setTimeout;
  const _requestAnimationFrame = window.requestAnimationFrame?.bind(window);

  window.setInterval = function (fn, t) {
    if (typeof t === "number" && t < 5000) {
      console.warn("[SAFE MODE] setInterval requested under 5000ms", t);
    }
    return _setInterval(fn, t);
  };

  window.setTimeout = function (fn, t) {
    if (t === 0) {
      console.warn("[SAFE MODE] setTimeout(0) invoked");
    }
    return _setTimeout(fn, t);
  };

  if (_requestAnimationFrame) {
    window.requestAnimationFrame = function (callback) {
      if (typeof callback === "function") {
        console.warn("[SAFE MODE] requestAnimationFrame invoked");
      }
      return _requestAnimationFrame(callback);
    };
  }
}


/* ======================================================================
   StreamSuites™ Dashboard — app.js
   Project: StreamSuites™
   Owner: Daniel Clancy
   Copyright: © 2026 Brainstream Media Group
   Central bootstrap + lightweight view router + storage layer
   ====================================================================== */

/*
  DESIGN GOALS:
  - Zero frameworks
  - Deterministic load order
  - Works on GitHub Pages + iframe embeds (Wix)
  - All feature logic lives in per-view files
   - Storage abstraction supports JSON import/export
*/

/* ----------------------------------------------------------------------
   Global App State
   ---------------------------------------------------------------------- */

const streamsuitesPathname = window.location?.pathname || "";
if (streamsuitesPathname.includes("/livechat/")) {
  // Guard: never bootstrap the dashboard runtime inside LiveChat.
} else {
if (!window.__STREAMSUITES_APP_MODE__) {
  window.__STREAMSUITES_APP_MODE__ = "BOOT";
}

if (typeof window.__RUNTIME_AVAILABLE__ === "undefined") {
  window.__RUNTIME_AVAILABLE__ = false;
}

const RUNTIME_PROBE_ENDPOINT = "/api/admin/bots/status";

if (!window.StreamSuitesAppMode) {
  window.StreamSuitesAppMode = {
    get() {
      return window.__STREAMSUITES_APP_MODE__ || "BOOT";
    },
    set(mode, detail = {}) {
      window.__STREAMSUITES_APP_MODE__ = mode;
      try {
        window.dispatchEvent(
          new CustomEvent("streamsuites:app-mode", { detail: { mode, ...detail } })
        );
      } catch (err) {
        console.warn("[Dashboard] App mode broadcast failed", err);
      }
    }
  };
}

function shouldBlockDashboardRuntime() {
  const guard = window.StreamSuitesDashboardGuard;
  if (guard && typeof guard.shouldBlock === "boolean") {
    return guard.shouldBlock;
  }

  const pathname = (window.location?.pathname || "").toLowerCase();
  const standaloneFlagDefined = typeof window.__STREAMSUITES_STANDALONE__ !== "undefined";
  const isLivechatPath =
    pathname.startsWith("/streamsuites-dashboard/livechat") ||
    pathname.endsWith("/livechat/") ||
    pathname.endsWith("/livechat/index.html");

  return standaloneFlagDefined || isLivechatPath;
}

let adminAuthorizedBootstrapInFlight = false;

window.addEventListener("streamsuites:admin-authorized", () => {
  if (App.initialized || adminAuthorizedBootstrapInFlight) return;

  if (!shouldBlockDashboardRuntime()) {
    adminAuthorizedBootstrapInFlight = true;
    Promise.resolve()
      .then(() => initApp())
      .catch((err) => {
        console.error("[Dashboard] Admin-authorized bootstrap failed", err);
      })
      .finally(() => {
        if (!App.initialized) {
          adminAuthorizedBootstrapInFlight = false;
        }
      });
  }
});

function isRuntimeAvailable() {
  return window.__RUNTIME_AVAILABLE__ === true;
}

function markRuntimeUnavailable() {
  window.__RUNTIME_AVAILABLE__ = false;
}

function markRuntimeAvailable() {
  window.__RUNTIME_AVAILABLE__ = true;
}

function resolveAdminApiBase() {
  const base =
    window.StreamSuitesAdminAuth?.config?.baseUrl ||
    document.querySelector('meta[name="streamsuites-auth-base"]')?.getAttribute("content") ||
    "";
  return base ? String(base).replace(/\/+$/, "") : "";
}

function buildAdminApiUrl(path) {
  const base = resolveAdminApiBase();
  if (!base) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

async function probeRuntimeAvailability() {
  const endpoint = buildAdminApiUrl(RUNTIME_PROBE_ENDPOINT);
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (response.ok) {
      markRuntimeAvailable();
      return true;
    }
  } catch (err) {
    // Probe failure keeps runtime gated offline.
  }
  markRuntimeUnavailable();
  return false;
}

const App = {
  currentView: null,
  views: {},
  initialized: false,
  storage: {},
  state: {}, // ✅ ADDITIVE — read-only runtime snapshots live here
  boot: {
    firstViewName: null,
    firstViewMounted: false,
    deadlockTimer: null
  },
  creatorContext: {
    creatorId: null,
    permissions: {
      mode: "admin",
      readOnly: false
    },
    platformScopes: []
  },
  mode: {
    current: "static",
    reason: "static-first default",
    isLocalhost: false,
    snapshotDetected: false
  },

  // ✅ ADDITIVE — deferred anchor scroll support
  pendingAnchor: null
};

// Expose the App object on window for cross-file access (e.g., Overview view)
window.App = App;

/* ----------------------------------------------------------------------
   Fetch timeout safety
   ---------------------------------------------------------------------- */

const DEFAULT_FETCH_TIMEOUT_MS = 1500;

if (!window.__STREAMSUITES_FETCH_TIMEOUT_PATCHED__) {
  window.__STREAMSUITES_FETCH_TIMEOUT_PATCHED__ = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
    const hasSignal = Boolean(init?.signal);
    const timeoutMs =
      typeof init?.timeoutMs === "number" ? init.timeoutMs : DEFAULT_FETCH_TIMEOUT_MS;

    if (!timeoutMs || timeoutMs <= 0) {
      return originalFetch(input, init);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let signal = controller.signal;
    if (hasSignal && typeof AbortSignal !== "undefined" && AbortSignal.any) {
      signal = AbortSignal.any([init.signal, controller.signal]);
    } else if (hasSignal) {
      signal = init.signal;
    }

    const nextInit = {
      ...init,
      signal
    };

    return originalFetch(input, nextInit).finally(() => {
      clearTimeout(timer);
    });
  };
}

/* ----------------------------------------------------------------------
   DOM Helpers
   ---------------------------------------------------------------------- */

function $(selector, scope = document) {
  return scope.querySelector(selector);
}

function $all(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

function getAppMode() {
  return window.StreamSuitesAppMode?.get?.() || window.__STREAMSUITES_APP_MODE__ || "BOOT";
}

function setAppMode(mode, detail = {}) {
  if (window.StreamSuitesAppMode?.set) {
    window.StreamSuitesAppMode.set(mode, detail);
  } else {
    window.__STREAMSUITES_APP_MODE__ = mode;
    try {
      window.dispatchEvent(
        new CustomEvent("streamsuites:app-mode", { detail: { mode, ...detail } })
      );
    } catch (err) {
      console.warn("[Dashboard] App mode broadcast failed", err);
    }
  }
}

function waitForAppMode() {
  const current = getAppMode();
  if (current !== "BOOT") return Promise.resolve(current);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("streamsuites:app-mode", onModeChange);
      resolve(getAppMode());
    }, 2000);
    const onModeChange = (event) => {
      if (event?.detail?.mode) {
        clearTimeout(timeout);
        resolve(event.detail.mode);
      }
    };
    window.addEventListener("streamsuites:app-mode", onModeChange, { once: true });
  });
}

/* ----------------------------------------------------------------------
   CONNECTED MODE DETECTION (READ-ONLY)
   ---------------------------------------------------------------------- */

const LOCALHOST_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0"
]);

function setModeIndicator(modeState) {
  const indicator = document.getElementById("app-mode");
  if (!indicator) return;

  indicator.classList.remove("idle", "active", "warning", "critical");

  if (modeState.current === "connected") {
    indicator.classList.add("active");
    indicator.textContent = `● connected mode (${modeState.reason})`;
  } else {
    indicator.classList.add("warning");
    indicator.textContent = `● static mode (${modeState.reason})`;
  }
}

function setModeDataset(target) {
  if (!target) return;
  target.dataset.appMode = App.mode?.current || "static";
  target.dataset.appModeReason = App.mode?.reason || "static-first default";
}

function applyModeState(modeState) {
  const previous = App.mode || {};
  const changed =
    previous.current !== modeState.current ||
    previous.reason !== modeState.reason ||
    previous.snapshotDetected !== modeState.snapshotDetected;

  App.mode = modeState;
  setModeIndicator(modeState);
  setModeDataset(document.getElementById("app"));
  setModeDataset(document.getElementById("view-container"));

  // Broadcast the current mode so platform views can mirror state even when
  // loaded later in the session.
  try {
    window.dispatchEvent(new CustomEvent("streamsuites:modechange", { detail: modeState }));
  } catch (err) {
    console.warn("[Dashboard] Mode broadcast failed", err);
  }

  if (App.currentView) {
    const activeContainerId = App.views[App.currentView]?.containerId || "view-container";
    setModeDataset(document.getElementById(activeContainerId));
  }

  if (changed && App.currentView && App.views[App.currentView]?.onModeChange) {
    try {
      App.views[App.currentView].onModeChange(modeState);
    } catch (err) {
      console.warn("[Dashboard] View mode change handler failed", err);
    }
  }
}

async function detectConnectedMode(options = {}) {
  const hostname = window.location?.hostname || "";
  const params = new URLSearchParams(window.location.search);
  const forcedMode = params.get("mode");
  const injectedSnapshot = options.snapshot || null;
  const sourceLabel = options.sourceLabel || "";

  const modeState = {
    current: "static",
    reason: "static-first default",
    isLocalhost: LOCALHOST_HOSTNAMES.has(hostname),
    snapshotDetected: false,
    hostname,
    source: null
  };

  if (forcedMode === "static") {
    applyModeState(modeState);
    return modeState;
  }

  let snapshot = injectedSnapshot;
  let snapshotSource = sourceLabel;

  const runtimeState = window.App?.state?.runtimeSnapshot;

  if (!snapshot && runtimeState?.getSnapshot) {
    const normalizedPolled = window.StreamSuitesState?.normalizeRuntimeSnapshot?.(
      runtimeState.getSnapshot()
    );
    if (normalizedPolled && Object.keys(normalizedPolled.platforms || {}).length) {
      snapshot = normalizedPolled;
      snapshotSource = runtimeState.lastSource || "runtime:polled";
    }
  }

  if (!snapshot) {
    try {
      snapshot = await window.StreamSuitesState?.loadRuntimeSnapshot?.({ forceReload: true });
      snapshotSource = "runtime:auto";
    } catch (err) {
      console.warn("[Dashboard] Connected mode detection failed", err);
    }
  }

  modeState.snapshotDetected = !!(snapshot && typeof snapshot === "object");
  const runtimeDerived =
    (snapshotSource && snapshotSource.includes("shared/state")) ||
    Boolean(snapshot?.runtime) ||
    Boolean(snapshot?.system || snapshot?.platforms);

  if (snapshotSource) {
    modeState.source = snapshotSource;
  }

  if (forcedMode === "connected") {
    modeState.current = "connected";
    modeState.reason = "query override: connected";
  } else if (modeState.snapshotDetected && runtimeDerived) {
    modeState.current = "connected";
    const isRuntimePath = snapshotSource?.includes("shared/state") || snapshotSource?.includes("runtime_snapshot");
    if (modeState.isLocalhost && isRuntimePath) {
      modeState.reason = "runtime exports detected on localhost";
    } else if (modeState.isLocalhost) {
      modeState.reason = "localhost detected with snapshot (read-only)";
    } else if (isRuntimePath) {
      modeState.reason = "runtime exports detected (read-only)";
    } else {
      modeState.reason = "snapshot detected (read-only)";
    }
  } else if (modeState.isLocalhost) {
    modeState.reason = "localhost detected; static fallback";
  } else if (modeState.snapshotDetected) {
    modeState.reason = "bundled snapshot detected (static preview)";
  } else {
    modeState.reason = "static-first deployment (no runtime exports)";
  }

  applyModeState(modeState);
  return modeState;
}

/* ----------------------------------------------------------------------
   STORAGE LAYER (AUTHORITATIVE)
   ---------------------------------------------------------------------- */

App.storage = {
  /* ------------------------------------------------------------
     Legacy / Low-level helpers (DO NOT REMOVE)
     ------------------------------------------------------------ */

  load(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.error("[Dashboard][Storage] Load failed:", err);
      return fallback;
    }
  },

  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value, null, 2));
    } catch (err) {
      console.error("[Dashboard][Storage] Save failed:", err);
    }
  },

  downloadJson(filename, data) {
    try {
      const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: "application/json" }
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[Dashboard][Storage] Download failed:", err);
    }
  },

  uploadJson(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("No file provided"));
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  },

  /* ------------------------------------------------------------
     Shared Dashboard Storage Utilities (AUTHORITATIVE)
     Namespace: streamsuites.*
     ------------------------------------------------------------ */

  namespace: "streamsuites",

  buildKey(key) {
    return `${this.namespace}.${key}`;
  },

  loadFromLocalStorage(key, fallback = null) {
    return this.load(this.buildKey(key), fallback);
  },

  saveToLocalStorage(key, value) {
    this.save(this.buildKey(key), value);
  },

  exportJsonToDownload(filename, data) {
    this.downloadJson(filename, {
      meta: {
        exportedAt: new Date().toISOString(),
        source: "StreamSuites-Dashboard"
      },
      payload: data
    });
  },

  importJsonFromFile(file) {
    return this.uploadJson(file).then((data) => {
      if (data && typeof data === "object" && "payload" in data) {
        return data.payload;
      }
      return data;
    });
  }
};

/* ======================================================================
   ADDITIVE: RUNTIME SNAPSHOT FEED (READ-ONLY) — QUOTAS
   ====================================================================== */

App.state.quotas = {
  latest: null,
  lastFetchedAt: null,
  lastError: null,
  intervalMs: 3000,
  _timer: null,

  async fetchOnce() {
    if (!isRuntimeAvailable()) return;
    try {
      const url = new URL("shared/state/quotas.json", document.baseURI);
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        markRuntimeUnavailable();
        this.stop();
        return;
      }

      const data = await res.json();
      markRuntimeAvailable();

      this.latest = data;
      this.lastFetchedAt = Date.now();
      this.lastError = null;
    } catch (e) {
      this.lastError = String(e);
      markRuntimeUnavailable();
      this.stop();
    }
  },

  start() {
    if (getAppMode() !== "NORMAL") {
      console.info("[Dashboard] Polling disabled in blocked mode.");
      return;
    }
    if (!isRuntimeAvailable()) return;
    if (this._timer) return;
    this.fetchOnce();
    this._timer = setInterval(() => {
      this.fetchOnce();
    }, this.intervalMs);
  },

  stop() {
    if (!this._timer) return;
    clearInterval(this._timer);
    this._timer = null;
  },

  getSnapshot() {
    return this.latest;
  }
};

/* ======================================================================
   ADDITIVE: RUNTIME SNAPSHOT FEED (READ-ONLY)
   ====================================================================== */

App.state.runtimeSnapshot = {
  latest: null,
  lastFetchedAt: null,
  lastError: null,
  intervalMs: 4000,
  _timer: null,
  lastSource: null,

  async fetchOnce() {
    if (!isRuntimeAvailable()) return;
    const sources = [
      new URL("shared/state/runtime_snapshot.json", document.baseURI),
      new URL("data/runtime_snapshot.json", document.baseURI)
    ];

    let fetched = false;
    for (const url of sources) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          this.lastError = `HTTP ${res.status} for ${url}`;
          continue;
        }

        const data = await res.json();
        fetched = true;
        this.latest = data;
        this.lastSource = url.toString();
        this.lastFetchedAt = Date.now();
        this.lastError = null;
        markRuntimeAvailable();
        try {
          window.dispatchEvent(
            new CustomEvent("streamsuites:runtimeSnapshot", {
              detail: {
                snapshot: data,
                source: this.lastSource,
                fetchedAt: this.lastFetchedAt
              }
            })
          );
        } catch (err) {
          console.warn("[Dashboard] Runtime snapshot event dispatch failed", err);
        }
        detectConnectedMode({ snapshot: data, sourceLabel: url.pathname });
        return;
      } catch (err) {
        this.lastError = String(err);
      }
    }

    if (!fetched) {
      markRuntimeUnavailable();
      this.stop();
    }
  },

  start() {
    if (getAppMode() !== "NORMAL") {
      console.info("[Dashboard] Polling disabled in blocked mode.");
      return;
    }
    if (!isRuntimeAvailable()) return;
    if (this._timer) return;
    this.fetchOnce();
    this._timer = setInterval(() => {
      this.fetchOnce();
    }, this.intervalMs);
  },

  stop() {
    if (!this._timer) return;
    clearInterval(this._timer);
    this._timer = null;
  },

  getSnapshot() {
    return this.latest;
  }
};

const RestartIndicator = {
  el: null,
  timer: null,
  intervalMs: 4000,

  init() {
    if (getAppMode() !== "NORMAL") {
      console.info("[Dashboard] Polling disabled in blocked mode.");
      return;
    }
    this.el = document.getElementById("restart-required-banner");
    this.refresh();

    if (this.timer) return;
    this.timer = setInterval(() => this.refresh(), this.intervalMs);
  },

  refresh() {
    if (!this.el) {
      this.el = document.getElementById("restart-required-banner");
      if (!this.el) return;
    }

    const raw = App.state?.runtimeSnapshot?.getSnapshot?.();
    const normalized = window.StreamSuitesState?.normalizeRuntimeSnapshot?.(raw);
    const intent = normalized?.restartIntent;
    const required = intent?.required === true;

    const categories = intent?.pending
      ? Object.entries(intent.pending)
          .filter(([, value]) => value)
          .map(([key]) => {
            if (key === "platforms") return "platform enable flags";
            if (key === "triggers") return "triggers";
            if (key === "creators") return "creator configuration";
            if (key === "system") return "system settings";
            return key;
          })
      : [];

    const textEl = this.el.querySelector(".ss-restart-banner-text");
    const subEl = this.el.querySelector(".ss-restart-banner-subtext");

    if (textEl) {
      textEl.textContent =
        "Pending changes detected — restart required to apply";
    }

    if (subEl) {
      if (intent) {
        const categoryText = categories.length
          ? `Pending: ${categories.join(", ")}.`
          : "Pending changes require restart.";
        subEl.textContent = `${categoryText} Changes will take effect when StreamSuites is restarted.`;
      } else {
        subEl.textContent =
          "Restart intent unavailable. Changes apply after a manual restart.";
      }
    }

    if (required) {
      this.el.classList.remove("hidden");
    } else {
      this.el.classList.add("hidden");
    }
  }
};

/* ----------------------------------------------------------------------
   View Registration
   ---------------------------------------------------------------------- */

function registerView(name, config) {
  App.views[name] = {
    name,
    onLoad: config.onLoad || (() => {}),
    onUnload: config.onUnload || (() => {}),
    onModeChange: config.onModeChange || null,
    containerId: config.containerId || "view-container",
    templatePath: config.templatePath || name
  };
}

/* ----------------------------------------------------------------------
   View Loader
   ---------------------------------------------------------------------- */

const VIEW_FETCH_TIMEOUT_MS = 1500;

async function fetchWithTimeout(url, options = {}, timeoutMs = VIEW_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      timeoutMs: 0
    });
  } finally {
    clearTimeout(timer);
  }
}

function markFirstViewMounted(name) {
  if (App.boot?.firstViewMounted) return;
  if (App.boot?.firstViewName && App.boot.firstViewName !== name) return;
  App.boot.firstViewMounted = true;
  console.log("[BOOT:70] first view mounted", performance.now());
  if (App.boot?.deadlockTimer) {
    clearTimeout(App.boot.deadlockTimer);
    App.boot.deadlockTimer = null;
  }
}

async function loadView(name) {
  if (shouldBlockDashboardRuntime()) return;
  const view = App.views[name];
  if (!view) {
    console.warn(`[Dashboard] Unknown view: ${name}`);
    return;
  }

  if (App.currentView && App.views[App.currentView]) {
    try {
      App.views[App.currentView].onUnload();
    } catch (e) {
      console.warn(`[Dashboard] View unload error (${App.currentView})`, e);
    }
  }

  const container = $("#" + view.containerId);
  if (!container) {
    console.error(`[Dashboard] Missing container: #${view.containerId}`);
    return;
  }

  const viewPath = `${window.ADMIN_BASE_PATH}/views/${view.templatePath}.html`;
  const viewUrl = new URL(viewPath, window.location.origin);
  const viewPathLower = viewUrl.pathname.toLowerCase();
  if (
    viewPathLower.includes("/livechat/") ||
    viewPathLower.endsWith("/livechat/index.html")
  ) {
    console.warn("[Dashboard] LiveChat path excluded from view loader.", viewUrl.pathname);
    return;
  }

  const loaderToken =
    window.StreamSuitesGlobalLoader?.startLoading?.(`Loading ${name} view...`) || null;

  try {
    const res = await fetchWithTimeout(viewUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    container.innerHTML = html;

    setModeDataset(container);

    App.currentView = name;

    try {
      const result = view.onLoad(App.mode);
      if (result && typeof result.then === "function") {
        await result;
      }
    } catch (e) {
      console.error(`[Dashboard] View load error (${name})`, e);
    }

    // ✅ ADDITIVE — perform deferred anchor scroll AFTER DOM exists
    if (App.pendingAnchor) {
      requestAnimationFrame(() => {
        const el = document.getElementById(App.pendingAnchor);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        App.pendingAnchor = null;
      });
    }

    updateNavActiveState(name);

    if (window.Versioning?.stampFooters) {
      window.Versioning.stampFooters();
    }
    markFirstViewMounted(name);
  } catch (err) {
    console.error(`[Dashboard] Failed to load view ${name}`, err);
    container.innerHTML = `
      <div class="panel">
        <h3>${name}</h3>
        <div class="ss-alert ss-alert-danger">
          Failed to load this view. Please refresh and try again.
        </div>
        <p class="text-muted" style="margin-top: 0.5rem;">
          Expected partial: ${viewUrl.pathname}
        </p>
      </div>
    `;
    markFirstViewMounted(name);
  } finally {
    if (loaderToken) {
      window.StreamSuitesGlobalLoader?.stopLoading?.(loaderToken);
    }
  }
}

/* ----------------------------------------------------------------------
   Navigation Handling
   ---------------------------------------------------------------------- */

const SIDEBAR_COLLAPSE_STORAGE_KEY = "ss_admin_sidebar_collapsed";
const SIDEBAR_MOBILE_BREAKPOINT = 980;
const SIDEBAR_COLLAPSED_CLASS = "ss-sidebar-collapsed";
const SIDEBAR_ICON_FALLBACK = "/assets/icons/ui/cog.svg";

const SIDEBAR_VIEW_ICON_MAP = Object.freeze({
  overview: "/assets/icons/ui/dashboard.svg",
  creators: "/assets/icons/ui/profile.svg",
  accounts: "/assets/icons/ui/identity.svg",
  tiers: "/assets/icons/ui/cards.svg",
  audit: "/assets/icons/ui/admin.svg",
  approvals: "/assets/icons/ui/switch.svg",
  "api-usage": "/assets/icons/ui/api.svg",
  triggers: "/assets/icons/ui/tune.svg",
  jobs: "/assets/icons/ui/automation.svg",
  clips: "/assets/icons/ui/widget.svg",
  polls: "/assets/icons/ui/clickpoint.svg",
  tallies: "/assets/icons/ui/storage.svg",
  scoreboards: "/assets/icons/ui/dashboard.svg",
  "data-signals": "/assets/icons/ui/devices.svg",
  bots: "/assets/icons/ui/bot.svg",
  notifications: "/assets/icons/ui/portal.svg",
  ratelimits: "/assets/icons/ui/memory.svg",
  settings: "/assets/icons/ui/cog.svg",
  "chat-replay": "/assets/icons/ui/uiscreen.svg",
  rumble: "/assets/icons/ui/globe.svg",
  youtube: "/assets/icons/ui/globe.svg",
  twitch: "/assets/icons/ui/globe.svg",
  kick: "/assets/icons/ui/globe.svg",
  pilled: "/assets/icons/ui/globe.svg",
  twitter: "/assets/icons/ui/globe.svg",
  discord: "/assets/icons/ui/globe.svg",
  updates: "/assets/icons/ui/package.svg",
  design: "/assets/icons/ui/ui.svg"
});

const sidebarShell = {
  hasStoredPreference: false,
  resizeBound: false
};

const PLATFORM_NAV_ITEMS = Object.freeze([
  { view: "rumble", label: "Rumble" },
  { view: "youtube", label: "YouTube" },
  { view: "twitch", label: "Twitch" },
  { view: "kick", label: "Kick" },
  { view: "pilled", label: "Pilled" },
  { view: "twitter", label: "Twitter" },
  { view: "discord", label: "Discord", discordLocked: true }
]);

function readSidebarCollapsedPreference() {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch (err) {
    // Local storage can fail in private/restricted contexts.
  }
  return null;
}

function getSidebarIconForView(viewName) {
  return SIDEBAR_VIEW_ICON_MAP[viewName] || SIDEBAR_ICON_FALLBACK;
}

function ensurePlatformNavItems() {
  const navList = $("#app-nav-list");
  if (!navList) return;

  const systemSection = navList.querySelector("li.nav-section:last-of-type");
  PLATFORM_NAV_ITEMS.forEach((item) => {
    if (navList.querySelector(`li[data-view="${item.view}"]`)) return;

    const li = document.createElement("li");
    li.dataset.view = item.view;
    li.textContent = item.label;
    if (item.discordLocked) {
      li.setAttribute("data-discord-nav", "");
      li.setAttribute("data-discord-locked", "");
    }

    if (systemSection) {
      navList.insertBefore(li, systemSection);
    } else {
      navList.appendChild(li);
    }
  });
}

function disableLegacyNavOverflowUi() {
  const overflowContainer = $("#app-nav-overflow");
  if (overflowContainer) {
    overflowContainer.remove();
  }
}

function ensureSidebarNavDecorated() {
  const navItems = $all("#app-nav-list li[data-view]");
  navItems.forEach((item) => {
    const viewName = item.dataset.view || "";
    const iconPath = item.dataset.navIcon || getSidebarIconForView(viewName);
    const existingLabel = item.querySelector(".nav-label");
    if (!item.dataset.navBaseTitle && item.hasAttribute("title")) {
      item.dataset.navBaseTitle = item.getAttribute("title") || "";
    }

    if (!existingLabel) {
      const labelText = (item.dataset.navLabel || item.textContent || "").trim();
      item.dataset.navLabel = labelText;
      item.textContent = "";

      const icon = document.createElement("span");
      icon.className = "nav-icon";
      icon.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.className = "nav-label";
      label.textContent = labelText;

      item.append(icon, label);
    } else if (!item.dataset.navLabel) {
      item.dataset.navLabel = (existingLabel.textContent || "").trim();
    }

    item.style.setProperty("--nav-icon", `url("${iconPath}")`);
    if (!item.hasAttribute("tabindex")) {
      item.setAttribute("tabindex", "0");
    }
    if (!item.hasAttribute("role")) {
      item.setAttribute("role", "button");
    }
  });
}

function isSidebarCollapsed() {
  return document.documentElement.classList.contains(SIDEBAR_COLLAPSED_CLASS);
}

function updateSidebarNavTitles() {
  const collapsed = isSidebarCollapsed();
  $all("#app-nav-list li[data-view]").forEach((item) => {
    const label = (item.dataset.navLabel || "").trim();
    const baseTitle = (item.dataset.navBaseTitle || "").trim();
    if (!label) return;
    if (collapsed) {
      item.setAttribute("title", label);
    } else if (baseTitle) {
      item.setAttribute("title", baseTitle);
    } else {
      item.removeAttribute("title");
    }
  });
}

function updateSidebarToggleState() {
  const toggle = $("#sidebar-collapse-toggle");
  if (!toggle) return;
  const collapsed = isSidebarCollapsed();
  const actionLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.setAttribute("aria-label", actionLabel);
  toggle.setAttribute("title", actionLabel);
}

function setSidebarCollapsed(collapsed, options = {}) {
  const persist = options.persist !== false;
  document.documentElement.classList.toggle(SIDEBAR_COLLAPSED_CLASS, collapsed);
  document.body?.classList.toggle(SIDEBAR_COLLAPSED_CLASS, collapsed);
  updateSidebarNavTitles();
  updateSidebarToggleState();

  if (!persist) return;
  try {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSE_STORAGE_KEY,
      collapsed ? "1" : "0"
    );
    sidebarShell.hasStoredPreference = true;
  } catch (err) {
    // Local storage can fail in private/restricted contexts.
  }
}

function applyAutoSidebarCollapse() {
  if (sidebarShell.hasStoredPreference) return;
  const shouldCollapse = window.innerWidth <= SIDEBAR_MOBILE_BREAKPOINT;
  setSidebarCollapsed(shouldCollapse, { persist: false });
}

function bindSidebarToggle() {
  const toggle = $("#sidebar-collapse-toggle");
  if (!toggle) return;
  if (toggle.dataset.sidebarBound === "1") return;
  toggle.dataset.sidebarBound = "1";
  toggle.addEventListener("click", () => {
    setSidebarCollapsed(!isSidebarCollapsed(), { persist: true });
  });
}

function initSidebarShell() {
  disableLegacyNavOverflowUi();
  ensurePlatformNavItems();
  ensureSidebarNavDecorated();
  const storedPreference = readSidebarCollapsedPreference();
  sidebarShell.hasStoredPreference = storedPreference !== null;
  const initialCollapsed =
    storedPreference !== null
      ? storedPreference
      : window.innerWidth <= SIDEBAR_MOBILE_BREAKPOINT;

  setSidebarCollapsed(initialCollapsed, { persist: false });
  bindSidebarToggle();

  if (!sidebarShell.resizeBound) {
    sidebarShell.resizeBound = true;
    window.addEventListener(
      "resize",
      () => {
        applyAutoSidebarCollapse();
      },
      { passive: true }
    );
  }
}

const navOverflow = {
  list: null,
  toggle: null,
  container: null,
  shell: null,
  resizeHandler: null,
  resizeTimer: null,
  bound: false
};

function initNavOverflowElements() {
  navOverflow.list = $("#app-nav-list");
  navOverflow.toggle = $("#app-nav-overflow-toggle");
  navOverflow.container = $("#app-nav-overflow");
  navOverflow.shell = $("#app-nav .nav-shell");

  return Boolean(
    navOverflow.list &&
    navOverflow.toggle &&
    navOverflow.container &&
    navOverflow.shell
  );
}

function syncNavOverflowActiveIndicator() {
  if (!navOverflow.toggle) return;
  navOverflow.toggle.classList.remove("active");
}

function redistributeNavItems() {
  if (!initNavOverflowElements()) return;
  navOverflow.toggle.classList.add("is-hidden");
  if (navOverflow.container) {
    navOverflow.container.setAttribute("aria-hidden", "true");
  }
  syncNavOverflowActiveIndicator();
}

// Defensive: keep alias to prevent ReferenceError from stale calls
function scheduleNavRedistribute() {
  redistributeNavItems();
}

function bindNavOverflow() {
  if (!initNavOverflowElements()) return;
  if (navOverflow.bound) {
    scheduleNavRedistribute();
    return;
  }

  navOverflow.resizeHandler = () => {
    if (navOverflow.resizeTimer) {
      clearTimeout(navOverflow.resizeTimer);
    }
    navOverflow.resizeTimer = setTimeout(() => {
      redistributeNavItems();
    }, 120);
  };
  window.addEventListener("resize", navOverflow.resizeHandler);

  navOverflow.bound = true;
  scheduleNavRedistribute();
  window.requestAnimationFrame(() => {
    scheduleNavRedistribute();
  });

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      scheduleNavRedistribute();
    });
  }

  if (navOverflow.list) {
    navOverflow.list.addEventListener("scroll", () => {
      scheduleNavRedistribute();
    }, { passive: true });
  }
}

const adminUserMenu = {
  initialized: false,
  root: null,
  toggle: null,
  menu: null,
  isOpen: false,
  raf: 0
};

function resolveAdminMenuThemeToggle() {
  if (typeof window.StreamSuitesTheme?.toggle === "function") {
    return () => window.StreamSuitesTheme.toggle();
  }
  if (typeof window.StreamSuitesThemeToggle?.toggle === "function") {
    return () => window.StreamSuitesThemeToggle.toggle();
  }
  const domToggle = document.querySelector("[data-theme-toggle], #theme-toggle");
  if (domToggle) {
    return () => domToggle.click();
  }
  return null;
}

function navigateToDashboardView(viewName) {
  if (!viewName) return;

  const navTarget = document.querySelector(`[data-view="${viewName}"]`);
  if (navTarget) {
    navTarget.click();
    return;
  }

  const normalized = String(viewName).replace(/^#+/, "");
  if (window.location.hash.replace(/^#/, "") === normalized) {
    window.dispatchEvent(new Event("hashchange"));
    return;
  }
  window.location.hash = `#${normalized}`;
}

function scheduleAdminUserMenuPosition() {
  if (!adminUserMenu.isOpen || !adminUserMenu.menu || !adminUserMenu.toggle) return;
  if (adminUserMenu.raf) {
    window.cancelAnimationFrame(adminUserMenu.raf);
  }

  adminUserMenu.raf = window.requestAnimationFrame(() => {
    adminUserMenu.raf = 0;
    if (!adminUserMenu.isOpen || !adminUserMenu.menu || !adminUserMenu.toggle) return;

    const menuEl = adminUserMenu.menu;
    const toggleRect = adminUserMenu.toggle.getBoundingClientRect();
    const margin = 10;
    const gap = 8;

    menuEl.style.maxHeight = `${Math.max(180, window.innerHeight - margin * 2)}px`;
    const menuWidth = menuEl.offsetWidth || 260;
    const menuHeight = menuEl.offsetHeight || 260;

    let left = toggleRect.right - menuWidth;
    left = Math.min(left, window.innerWidth - menuWidth - margin);
    left = Math.max(margin, left);

    const belowTop = toggleRect.bottom + gap;
    const aboveTop = toggleRect.top - menuHeight - gap;
    const spaceBelow = window.innerHeight - belowTop - margin;
    const spaceAbove = toggleRect.top - gap - margin;

    let top = belowTop;
    let placement = "bottom";
    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      top = Math.max(margin, aboveTop);
      placement = "top";
    }

    if (top + menuHeight > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - menuHeight - margin);
    }

    menuEl.dataset.placement = placement;
    menuEl.style.left = `${Math.round(left)}px`;
    menuEl.style.top = `${Math.round(top)}px`;
    menuEl.style.right = "auto";
  });
}

function setAdminUserMenuOpen(nextOpen) {
  if (!adminUserMenu.root || !adminUserMenu.toggle || !adminUserMenu.menu) return;
  const shouldOpen = Boolean(nextOpen);
  if (adminUserMenu.isOpen === shouldOpen) return;

  adminUserMenu.isOpen = shouldOpen;
  adminUserMenu.root.classList.toggle("is-open", shouldOpen);
  adminUserMenu.toggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  adminUserMenu.menu.classList.toggle("hidden", !shouldOpen);

  if (!shouldOpen) {
    if (adminUserMenu.raf) {
      window.cancelAnimationFrame(adminUserMenu.raf);
      adminUserMenu.raf = 0;
    }
    return;
  }

  adminUserMenu.menu.style.visibility = "hidden";
  scheduleAdminUserMenuPosition();
  window.requestAnimationFrame(() => {
    if (!adminUserMenu.isOpen || !adminUserMenu.menu) return;
    adminUserMenu.menu.style.visibility = "";
  });
}

function initAdminUserMenu() {
  if (adminUserMenu.initialized) return;

  const root = document.getElementById("admin-auth-indicator");
  const toggle = document.getElementById("admin-user-menu-toggle");
  const menu = document.getElementById("admin-user-menu");
  if (!root || !toggle || !menu) return;

  adminUserMenu.initialized = true;
  adminUserMenu.root = root;
  adminUserMenu.toggle = toggle;
  adminUserMenu.menu = menu;

  const themeToggle = resolveAdminMenuThemeToggle();
  const themeItem = menu.querySelector('[data-admin-user-action="theme"]');
  if (themeItem && themeToggle) {
    themeItem.disabled = false;
    themeItem.classList.remove("is-disabled");
    themeItem.removeAttribute("aria-disabled");
    const themeLabel = themeItem.querySelector("span:last-child");
    if (themeLabel) {
      themeLabel.textContent = "Theme";
    }
  }

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setAdminUserMenuOpen(!adminUserMenu.isOpen);
  });

  menu.addEventListener("click", (event) => {
    event.stopPropagation();
    const target = event.target.closest("[data-admin-user-action]");
    if (!target) return;

    const action = target.getAttribute("data-admin-user-action") || "";
    if (action === "account") {
      setAdminUserMenuOpen(false);
      navigateToDashboardView("accounts");
      return;
    }
    if (action === "settings") {
      setAdminUserMenuOpen(false);
      navigateToDashboardView("settings");
      return;
    }
    if (action === "theme") {
      if (target.hasAttribute("disabled")) return;
      themeToggle?.();
      setAdminUserMenuOpen(false);
      return;
    }
    if (action === "logout") {
      setAdminUserMenuOpen(false);
    }
  });

  document.addEventListener("click", (event) => {
    if (!adminUserMenu.isOpen) return;
    if (adminUserMenu.root?.contains(event.target)) return;
    setAdminUserMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!adminUserMenu.isOpen) return;
    setAdminUserMenuOpen(false);
    adminUserMenu.toggle?.focus();
  });

  window.addEventListener("resize", () => {
    scheduleAdminUserMenuPosition();
  }, { passive: true });

  window.addEventListener("scroll", () => {
    scheduleAdminUserMenuPosition();
  }, { passive: true, capture: true });
}

function updateNavActiveState(viewName) {
  $all("[data-view]").forEach((el) => {
    if (el.dataset.view === viewName) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });
  syncNavOverflowActiveIndicator();
}

function bindNavigation() {
  $all("[data-view]").forEach((el) => {
    el.addEventListener("click", () => {
      const view = el.dataset.view;
      if (view) loadView(view);
    });
    el.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const view = el.dataset.view;
      if (view) loadView(view);
    });
  });
}

function ensureActiveNavVisibility() {
  if (!navOverflow.list) return;
  const active = navOverflow.list.querySelector("li.active");
  if (!active) return;
  active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
}

/* ----------------------------------------------------------------------
   ADDITIVE: Delegated navigation for dynamically injected views
   ---------------------------------------------------------------------- */

function bindDelegatedNavigation() {
  const container = $("#view-container");
  if (!container) return;

  container.addEventListener("click", (e) => {
    const target = e.target.closest("[data-view]");
    if (!target) return;

    const view = target.dataset.view;
    if (view) loadView(view);
  });
}

/* ----------------------------------------------------------------------
   URL Hash Routing (MINIMALLY EXTENDED)
   ---------------------------------------------------------------------- */

function resolveInitialView() {
  const hash = window.location.hash.replace("#", "");

  if (hash && App.views[hash]) {
    return hash;
  }
  return "overview";
}

function bindHashChange() {
  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace("#", "");

    if (App.views[hash]) {
      loadView(hash);
    }
  });
}

/* ----------------------------------------------------------------------
   App Init
   ---------------------------------------------------------------------- */

async function initApp() {
  if (shouldBlockDashboardRuntime()) return;
  if (App.initialized) return;

  if (window.StreamSuitesAdminAuth?.init) {
    const authState = await window.StreamSuitesAdminAuth.init();
    if (!authState || authState.authorized !== true) {
      return;
    }
  }

  console.log("[BOOT:10] initApp start", performance.now());
  App.boot.deadlockTimer = setTimeout(() => {
    console.error("[BOOT:DEADLOCK] Bootstrap exceeded 2000ms. Dumping state...");
    console.error("APP_MODE", window.__STREAMSUITES_APP_MODE__);
    console.error("DISCORD_FEATURES", window.__DISCORD_FEATURES_ENABLED__);
    console.error("RUNTIME_AVAILABLE", window.__RUNTIME_AVAILABLE__);
  }, 2000);

  const watchdog = setTimeout(() => {
    console.error(
      "[Dashboard] INIT WATCHDOG TRIPPED: init exceeded 3000ms; forcing abort UI."
    );
    const root =
      document.getElementById("app") ||
      document.getElementById("root") ||
      document.body;
    root.innerHTML =
      "<div style='padding:16px;font-family:system-ui;color:#fff;background:#111'>Dashboard init watchdog tripped. Check console for the last log line.</div>";
  }, 3000);

  console.log("[BOOT:20] auth complete", performance.now());
  console.log("[BOOT:30] discord init begin", performance.now());
  const discordInit = window.StreamSuitesDiscordGuild?.init;
  if (typeof discordInit === "function") {
    discordInit()
      .then(() => console.log("[BOOT:DG] init completed", performance.now()))
      .catch((e) => console.warn("[BOOT:DG] init failed (non-blocking)", e));
  } else {
    console.warn("[BOOT:DG] init unavailable");
  }

  async function initDashboard() {
    console.log("[BOOT:40] dashboard init begin", performance.now());
    const resolvedMode = await waitForAppMode();
    if (resolvedMode === "BOOT") {
      setAppMode("NORMAL", { reason: "boot-timeout" });
    }
    if (getAppMode() !== "NORMAL") {
      setAppMode("NORMAL", { reason: "init-start" });
    }
    console.info("[Dashboard] Initializing StreamSuites dashboard");

    try {
      window.StreamSuitesState?.loadCreatorContext?.();
    } catch (err) {
      console.warn("[Dashboard] Creator context load skipped", err);
    }

    await probeRuntimeAvailability();

    await detectConnectedMode();

    setModeDataset(document.getElementById("app"));
    setModeDataset(document.getElementById("view-container"));

    initSidebarShell();
    initAdminUserMenu();
    bindNavigation();
    bindDelegatedNavigation();
    bindHashChange();

    console.log("[BOOT:50] router begin", performance.now());
    const initialView = resolveInitialView();
    App.boot.firstViewName = initialView;
    console.log("[BOOT:55] Router ready", performance.now());
    console.log("[BOOT:60] first view mount begin", performance.now());
    loadView(initialView);

    App.initialized = true;
  }

  try {
    await initDashboard();
    maybeStartRuntimePolling();
    clearTimeout(watchdog);
  } catch (err) {
    clearTimeout(watchdog);
    throw err;
  }
}

function maybeStartRuntimePolling() {
  if (window.__RUNTIME_AVAILABLE__ !== true) {
    console.info("[Dashboard] Runtime offline. Polling not started.");
    return;
  }

  console.info("[Dashboard] Starting runtime polling.");
  App.state.quotas.start();
  App.state.runtimeSnapshot.start();
  RestartIndicator.init();
}

/* ----------------------------------------------------------------------
   Register Views
   ---------------------------------------------------------------------- */

registerView("overview", {
  onLoad: () => {
    window.OverviewView?.init?.();
  },
  onUnload: () => {
    window.OverviewView?.destroy?.();
  }
});

registerView("creators", {
  onLoad: () => {
    if (window.CreatorsView?.init) {
      window.CreatorsView.init();
    }
  },
  onUnload: () => {
    window.CreatorsView?.destroy?.();
  }
});
  registerView("accounts", {
    onLoad: () => {
      window.AccountsView?.init?.();
    }
  });
  registerView("tiers", {
    onLoad: () => {
      window.TiersView?.init?.();
    }
  });
  registerView("audit", {
    templatePath: "audit",
    onLoad: () => {
    window.AuditLogsView?.init?.();
  }
});
registerView("approvals", {
  templatePath: "approvals",
  onLoad: () => {
    window.ApprovalsView?.init?.();
  },
  onUnload: () => {
    window.ApprovalsView?.destroy?.();
  }
});
registerView("api-usage", {
  templatePath: "api-usage",
  onLoad: () => {
    window.ApiUsageView?.init?.();
  },
  onUnload: () => {
    window.ApiUsageView?.destroy?.();
  }
});

registerView("triggers", {
  onLoad: () => {
    if (window.TriggersView?.init) {
      window.TriggersView.init();
    }
  }
});

registerView("jobs", {
  onLoad: () => {
    if (window.JobsView?.init) {
      window.JobsView.init();
    }
  }
});

registerView("clips", {
  onLoad: () => {
    window.ClipsView?.init?.();
  },
  onUnload: () => {
    window.ClipsView?.destroy?.();
  }
});
registerView("polls", {});
registerView("tallies", {});
registerView("scoreboards", {});
registerView("scoreboard-management", {});
registerView("data-signals", {
  templatePath: "data-signals",
  onLoad: () => {
    window.DataSignalsView?.init?.();
  },
  onUnload: () => {
    window.DataSignalsView?.destroy?.();
  }
});
registerView("bots", {
  onLoad: () => {
    window.BotsView?.init?.();
  },
  onUnload: () => {
    window.BotsView?.destroy?.();
  }
});
registerView("rumble", { templatePath: "platforms/rumble" });
registerView("youtube", {
  templatePath: "platforms/youtube",
  onLoad: () => {
    window.YouTubeView?.init?.();
  },
  onUnload: () => {
    window.YouTubeView?.destroy?.();
  }
});
registerView("twitch", {
  templatePath: "platforms/twitch",
  onLoad: () => {
    window.TwitchView?.init?.();
  },
  onUnload: () => {
    window.TwitchView?.destroy?.();
  }
});
registerView("kick", {
  templatePath: "platforms/kick",
  onLoad: (mode) => {
    window.KickView?.init?.(mode);
  },
  onUnload: () => {
    window.KickView?.destroy?.();
  },
  onModeChange: (mode) => {
    window.KickView?.onModeChange?.(mode);
  }
});
registerView("pilled", {
  templatePath: "platforms/pilled",
  onLoad: (mode) => {
    window.PilledView?.init?.(mode);
  },
  onUnload: () => {
    window.PilledView?.destroy?.();
  },
  onModeChange: (mode) => {
    window.PilledView?.onModeChange?.(mode);
  }
});
registerView("twitter", { templatePath: "platforms/twitter" });
registerView("discord", {
  templatePath: "platforms/discord",
  onLoad: () => {
    window.DiscordView?.init?.();
  },
  onUnload: () => {
    window.DiscordView?.destroy?.();
  }
});

registerView("ratelimits", {
  onLoad: () => {
    window.RatelimitsView?.init?.();
  }
});

registerView("settings", {
  onLoad: () => {
    window.SettingsView?.init?.();
  },
  onUnload: () => {
    window.SettingsView?.destroy?.();
  }
});
registerView("chat-replay", {});
registerView("design", {});
registerView("updates", {
  onLoad: () => {
    window.UpdatesView?.init?.();
  },
  onUnload: () => {
    window.UpdatesView?.destroy?.();
  }
});
registerView("notifications", {
  onLoad: () => {
    window.StreamSuitesNotifications?.initCenter?.();
  },
  onUnload: () => {
    window.StreamSuitesNotifications?.destroyCenter?.();
  }
});

/* ----------------------------------------------------------------------
   Boot
   ---------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", initApp);
if (document.readyState !== "loading") {
  initApp();
}

/* ======================================================================
   ADDITIVE: RUNTIME EXPORT (DO NOT REMOVE OR INLINE)
   ====================================================================== */

App.exportRuntimeCreators = async function () {
  const creators =
    (await window.ConfigState?.loadCreators?.()) ||
    App.storage.loadFromLocalStorage("creators", []);

  const runtime = {
    creators: creators
      .filter((c) => c && c.creator_id)
      .map((c) => {
        const out = {
          creator_id: c.creator_id,
          display_name: c.display_name || c.creator_id,
          enabled: c.disabled ? false : true,
          platforms: {},
          limits: c.limits || {}
        };

        if (c.tier) out.tier = c.tier;

        if (c.platforms?.rumble?.enabled) {
          out.platforms.rumble = true;
          out.rumble_manual_watch_url = c.platforms.rumble.watch_url || "";
        }

        if (c.platforms?.youtube?.enabled) {
          out.platforms.youtube = true;
        }

        if (c.platforms?.twitch?.enabled) {
          out.platforms.twitch = true;
        }

        if (c.platforms?.discord?.enabled) {
          out.platforms.discord = true;
        }

        if (c.rumble_channel_url) {
          out.rumble_channel_url = c.rumble_channel_url;
        }

        if (c.rumble_livestream_api_env_key) {
          out.rumble_livestream_api_env_key =
            c.rumble_livestream_api_env_key;
        }

        return out;
      })
  };

  App.storage.downloadJson("creators.json", runtime);
};
}

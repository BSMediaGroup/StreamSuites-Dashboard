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

function buildPublishedStateUrls(relativePath) {
  const normalized = String(relativePath || "").replace(/^\/+/, "");
  const pathname = String(window.location?.pathname || "").toLowerCase();
  const candidates = [new URL(`shared/state/${normalized}`, document.baseURI)];

  if (!pathname.startsWith("/docs")) {
    candidates.push(new URL(`docs/shared/state/${normalized}`, document.baseURI));
  }

  return candidates.filter(
    (url, index, list) => list.findIndex((entry) => entry.href === url.href) === index
  );
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

function getAdminAccessState() {
  return window.StreamSuitesDashboardGuard?.adminAccess || window.StreamSuitesAdminSession?.adminAccess || null;
}

function getAdminRoleState() {
  return String(
    window.StreamSuitesDashboardGuard?.adminRole ||
      window.StreamSuitesAdminSession?.role ||
      ""
  )
    .trim()
    .toLowerCase();
}

function getAdminPermissionState(permissionKey) {
  const normalized = String(permissionKey || "").trim();
  if (!normalized) return null;
  const access = getAdminAccessState();
  if (!access || !access.permissions || typeof access.permissions !== "object") {
    return null;
  }
  return access.permissions[normalized] || null;
}

function hasDashboardPermission(permissionKey) {
  const normalizedRole = getAdminRoleState();
  if (normalizedRole === "admin") return true;
  const access = getAdminAccessState();
  if (!access || access.allowed !== true) return false;
  const permissionState = getAdminPermissionState(permissionKey);
  return permissionState?.allowed === true;
}

function hasAnyDashboardPermission(permissionKeys = []) {
  return (Array.isArray(permissionKeys) ? permissionKeys : []).some((permissionKey) =>
    hasDashboardPermission(permissionKey)
  );
}

function normalizeDashboardViewName(viewLike) {
  const normalized = String(viewLike || "").trim().toLowerCase();
  if (!normalized) return "";
  const router = window.StreamSuitesAdminRoutes;
  if (typeof router?.resolveViewName === "function") {
    return router.resolveViewName(normalized) || normalized;
  }
  return normalized;
}

function getPermissionKeysForView(viewName) {
  const normalized = String(viewName || "").trim().toLowerCase();
  if (!normalized) return [];
  if (normalized === "user-detail") {
    return [
      "admin.dashboard.manage.accounts",
      "admin.dashboard.manage.creator_integrations"
    ];
  }
  return [];
}

function isDashboardViewAllowed(viewName) {
  const normalized = normalizeDashboardViewName(viewName);
  if (!normalized) return false;
  const normalizedRole = getAdminRoleState();
  if (normalizedRole === "admin") {
    return true;
  }
  const access = getAdminAccessState();
  if (!access || access.allowed !== true) {
    return false;
  }
  const allowedViews = Array.isArray(access.allowedViews)
    ? access.allowedViews.map((entry) => normalizeDashboardViewName(entry)).filter(Boolean)
    : [];
  if (allowedViews.includes(normalized)) {
    return true;
  }
  return hasAnyDashboardPermission(getPermissionKeysForView(normalized));
}

function getFirstAllowedDashboardView() {
  const preferred = ["overview", "analytics", "api-usage", "creator-integrations", "accounts", "permissions"];
  const registered = Object.keys(App.views || {});
  const ordered = [...preferred, ...registered.filter((view) => !preferred.includes(view))];
  return ordered.find((viewName) => isDashboardViewAllowed(viewName)) || "overview";
}

function renderRestrictedDashboardView(container, viewName) {
  if (!container) return;
  container.innerHTML = `
    <section class="ss-panel">
      <div class="ss-panel-header">
        <h2>Restricted view</h2>
        <p>This route is blocked by the authoritative dashboard permission policy from StreamSuites.</p>
      </div>
      <div class="ss-empty-state">
        <p><code>${String(viewName || "view").replace(/</g, "&lt;")}</code> is not available for the current account.</p>
      </div>
    </section>
  `;
}

function renderMissingDashboardRoute(container, route = App.currentRoute) {
  if (!container) return;
  const pathname = String(route?.pathname || window.location.pathname || "/").trim() || "/";
  const query = String(route?.query || "").trim();
  const requestedRoute = `${pathname}${query}`.replace(/</g, "&lt;");
  container.innerHTML = `
    <section class="ss-panel">
      <div class="ss-panel-header">
        <h2>Route not found</h2>
        <p>This admin route is not mapped by the dashboard shell.</p>
      </div>
      <div class="ss-empty-state">
        <p><code>${requestedRoute}</code> did not resolve to a known admin view.</p>
      </div>
    </section>
  `;
}

window.StreamSuitesDashboardPermissions = {
  getAccess: getAdminAccessState,
  getPermission: getAdminPermissionState,
  has: hasDashboardPermission,
  hasAny: hasAnyDashboardPermission,
  canView: isDashboardViewAllowed,
  firstAllowedView: getFirstAllowedDashboardView
};

const App = {
  currentView: null,
  currentRoute: null,
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
  viewHydration: {
    requestId: 0,
    activeRequestId: 0,
    activeView: "",
    inFlight: false,
    isRefresh: false,
    abortController: null
  },
  title: {
    base: "Overview",
    override: ""
  },

  // ✅ ADDITIVE — deferred anchor scroll support
  pendingAnchor: null
};

// Expose the App object on window for cross-file access (e.g., Overview view)
window.App = App;

/* ----------------------------------------------------------------------
   Fetch timeout safety
   ---------------------------------------------------------------------- */

const DEFAULT_FETCH_TIMEOUT_MS = 6000;

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
      const [url] = buildPublishedStateUrls("quotas.json");
      if (!url) {
        markRuntimeUnavailable();
        this.stop();
        return;
      }
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
      ...buildPublishedStateUrls("runtime_snapshot.json"),
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
    dataSource: config.dataSource || "",
    containerId: config.containerId || "view-container",
    templatePath: config.templatePath || name
  };
}

/* ----------------------------------------------------------------------
   View Loader
   ---------------------------------------------------------------------- */

const VIEW_FETCH_TIMEOUT_MS = 6000;
const VIEW_FETCH_RETRY_COUNT = 1;
const VIEW_FETCH_RETRY_DELAY_MS = 240;
const SECTION_SHELL_CONFIG = Object.freeze({
  overview: Object.freeze({
    storageKey: "ss_overview_shell_tabs_collapsed",
    toggleLabel: "overview section tabs",
    sections: Object.freeze([
      { id: "overview-command-section", label: "Overview" },
      { id: "overview-snapshot-section", label: "Snapshot" },
      { id: "overview-posture-section", label: "Posture" },
      { id: "overview-platforms-section", label: "Platforms" },
      { id: "overview-accounts-section", label: "Accounts" },
      { id: "overview-signals-section", label: "Signals" },
      { id: "overview-publication-section", label: "Contracts" }
    ])
  }),
  accounts: Object.freeze({
    storageKey: "ss_accounts_shell_tabs_collapsed",
    toggleLabel: "accounts section tabs",
    sections: Object.freeze([
      { id: "accounts-table-section", label: "Accounts" },
      { id: "badge-governance-section", label: "Badge Governance" },
      { id: "billing-codes-section", label: "Billing Codes" }
    ])
  }),
  "public-identities": Object.freeze({
    storageKey: "ss_public_identities_shell_tabs_collapsed",
    toggleLabel: "public identities section tabs",
    sections: Object.freeze([
      { id: "public-identities-reconciliation-section", label: "Filters" },
      { id: "public-identities-list-section", label: "Review Queue" },
      { id: "public-identities-assignment-section", label: "Assignment" }
    ])
  }),
  economy: Object.freeze({
    storageKey: "ss_economy_shell_tabs_collapsed",
    toggleLabel: "economy section tabs",
    sections: Object.freeze([
      { id: "economy-settings-section", label: "Economy Settings" },
      { id: "economy-denominations-section", label: "Denominations" },
      { id: "economy-identity-search-section", label: "Wallet & Inventory" },
      { id: "economy-participation-exclusions-section", label: "Participation Exclusions" },
      { id: "economy-ledger-section", label: "Economy Ledger" },
      { id: "economy-actions-section", label: "Manual Economy Actions" },
      { id: "economy-inventory-events-section", label: "Inventory Events" },
      { id: "economy-inventory-actions-section", label: "Manual Inventory Actions" },
      { id: "economy-exchange-section", label: "Gem / Diamond Exchange" },
      { id: "economy-market-governance-section", label: "Market Governance" },
      { id: "economy-item-definitions-section", label: "Item Definitions" },
      { id: "economy-danger-zone-section", label: "Danger Zone" }
    ])
  }),
  alerts: Object.freeze({
    storageKey: "ss_alerts_shell_tabs_collapsed",
    toggleLabel: "alerts section tabs",
    sections: Object.freeze([
      { id: "alerts-overview-section", label: "Overview" },
      { id: "alerts-rules-section", label: "Rules" },
      { id: "alerts-preferences-section", label: "Defaults" },
      { id: "alerts-test-section", label: "Test" },
      { id: "alerts-targets-section", label: "Channels" },
      { id: "alerts-history-section", label: "Activity" }
    ])
  }),
  settings: Object.freeze({
    storageKey: "ss_settings_shell_tabs_collapsed",
    toggleLabel: "settings section tabs",
    sections: Object.freeze([
      { id: "settings-overview-section", label: "Overview" },
      { id: "settings-runtime-section", label: "Runtime" },
      { id: "settings-access-section", label: "Access" },
      { id: "settings-data-section", label: "Data" },
      { id: "settings-alerts-section", label: "Alerts" },
      { id: "settings-roadmap-section", label: "Scaffolds" }
    ])
  }),
  permissions: Object.freeze({
    storageKey: "ss_permissions_shell_tabs_collapsed",
    toggleLabel: "permissions section tabs",
    sections: Object.freeze([
      { id: "permissions-overview-section", label: "Overview" },
      { id: "permissions-matrix-section", label: "Matrix" },
      { id: "permissions-accounts-section", label: "Accounts" },
      { id: "permissions-scaffolds-section", label: "Scaffolds" }
    ])
  })
});

const sectionShellOverrides = new Map();

function normalizeSectionShellSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections
    .map((section) => ({
      id: String(section?.id || "").trim(),
      label: String(section?.label || "").trim()
    }))
    .filter((section) => section.id && section.label);
}

function resolveSectionShellConfig(viewName) {
  const baseConfig = SECTION_SHELL_CONFIG[viewName] || null;
  if (!baseConfig) return null;
  return sectionShellOverrides.get(viewName) || baseConfig;
}

function setSectionShellSections(viewName, sections) {
  const normalizedViewName = String(viewName || "").trim();
  const baseConfig = SECTION_SHELL_CONFIG[normalizedViewName] || null;
  if (!baseConfig) return;

  const normalizedSections = normalizeSectionShellSections(sections);
  if (!normalizedSections.length) {
    sectionShellOverrides.delete(normalizedViewName);
  } else {
    sectionShellOverrides.set(
      normalizedViewName,
      Object.freeze({
        storageKey: baseConfig.storageKey,
        toggleLabel: baseConfig.toggleLabel,
        sections: Object.freeze(
          normalizedSections.map((section) =>
            Object.freeze({
              id: section.id,
              label: section.label
            })
          )
        )
      })
    );
  }

  if (App.currentView === normalizedViewName) {
    syncAccountsShellForView(normalizedViewName);
  }
}

function resetSectionShellSections(viewName) {
  const normalizedViewName = String(viewName || "").trim();
  if (!normalizedViewName) return;
  sectionShellOverrides.delete(normalizedViewName);
  if (App.currentView === normalizedViewName) {
    syncAccountsShellForView(normalizedViewName);
  }
}

const accountsShell = {
  initialized: false,
  activeView: "",
  activeConfig: null,
  toggle: null,
  rail: null,
  viewport: null,
  track: null,
  prevButton: null,
  nextButton: null,
  tabs: [],
  appMain: null,
  sections: [],
  visible: false,
  collapsed: false,
  currentSection: "",
  collapsePreferenceLoaded: false,
  scrollBound: false,
  resizeBound: false
};

async function fetchWithTimeout(url, options = {}, timeoutMs = VIEW_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let signal = controller.signal;

  if (options?.signal && typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
    signal = AbortSignal.any([options.signal, controller.signal]);
  } else if (options?.signal) {
    signal = options.signal;
  }

  try {
    return await fetch(url, {
      ...options,
      signal,
      timeoutMs: 0
    });
  } finally {
    clearTimeout(timer);
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isRetryableViewStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isRetryableViewError(err) {
  return err?.name === "AbortError" || err?.message === "Failed to fetch";
}

const TITLE_NOISE_WORDS = new Set([
  "streamsuites",
  "admin",
  "control",
  "dashboard",
  "page",
  "view",
  "surface"
]);

const TITLE_DESCRIPTOR_WORDS = new Set([
  "platform",
  "integration",
  "integrations",
  "logs",
  "log",
  "inbox",
  "statistics",
  "stats",
  "preview",
  "management",
  "workspace",
  "center"
]);

function normalizeTitleText(value, options = {}) {
  const stripDescriptors = options.stripDescriptors === true;
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !TITLE_NOISE_WORDS.has(token))
    .filter((token) => !(stripDescriptors && TITLE_DESCRIPTOR_WORDS.has(token)))
    .join(" ");
}

function isRedundantViewHeading(candidate, title) {
  const normalizedCandidate = normalizeTitleText(candidate);
  const normalizedTitle = normalizeTitleText(title);
  if (!normalizedCandidate || !normalizedTitle) return false;
  if (normalizedCandidate === normalizedTitle) return true;

  const normalizedCandidateCore = normalizeTitleText(candidate, { stripDescriptors: true });
  const normalizedTitleCore = normalizeTitleText(title, { stripDescriptors: true });
  if (!normalizedCandidateCore || !normalizedTitleCore) return false;
  return normalizedCandidateCore === normalizedTitleCore;
}

function removeIfEmpty(element) {
  if (!(element instanceof HTMLElement)) return;
  if (element.querySelector("img, button, input, select, textarea, a[href], [role=\"button\"]")) return;
  if (element.textContent.trim()) return;
  element.remove();
}

function pruneTopLevelViewTitle(container, viewTitle) {
  if (!(container instanceof HTMLElement) || !viewTitle) return;

  const header = container.querySelector(".ss-header");
  if (header) {
    const titleEl = header.querySelector(".ss-title, h1");
    const subtitleEl = header.querySelector(".ss-subtitle");
    const subtitleMatches = subtitleEl && isRedundantViewHeading(subtitleEl.textContent, viewTitle);

    if (titleEl) {
      titleEl.remove();
    }

    if (subtitleMatches) {
      subtitleEl.remove();
    }

    header
      .querySelectorAll(
        ".ss-accounts-header-title-row, .ss-header-left, .ss-header-right, .ss-alerts-header-copy, .ss-accounts-header-copy"
      )
      .forEach(removeIfEmpty);

    if (!header.textContent.trim() && !header.querySelector("img, button, input, select, textarea")) {
      header.remove();
    }
  }

  const panelHeader =
    container.querySelector(".ss-panel > .ss-panel-header") ||
    container.querySelector(".ss-panel-header");
  if (!panelHeader) return;

  const panelTitle = panelHeader.querySelector("h1, h2");
  if (panelTitle && isRedundantViewHeading(panelTitle.textContent, viewTitle)) {
    panelTitle.remove();
    panelHeader.querySelectorAll(".ss-panel-header-main").forEach(removeIfEmpty);
    if (!panelHeader.textContent.trim() && !panelHeader.querySelector("img, button, input, select, textarea")) {
      panelHeader.remove();
    }
  }
}

const shellUi = {
  title: null,
  refreshButton: null
};

function ensureShellUi() {
  if (!shellUi.title) {
    shellUi.title = document.getElementById("topbar-view-title");
  }
  if (!shellUi.refreshButton) {
    shellUi.refreshButton = document.getElementById("topbar-refresh-button");
  }
}

function renderTopbarTitle() {
  ensureShellUi();
  const nextTitle = App.title.override || App.title.base || "Overview";
  if (shellUi.title) {
    shellUi.title.textContent = nextTitle;
  }
  document.title = `${nextTitle} | StreamSuites Admin`;
}

function setTopbarTitleBase(title) {
  App.title.base = String(title || "Overview").trim() || "Overview";
  renderTopbarTitle();
}

function setTopbarTitleOverride(title) {
  App.title.override = String(title || "").trim();
  renderTopbarTitle();
}

function clearTopbarTitleOverride() {
  if (!App.title.override) return;
  App.title.override = "";
  renderTopbarTitle();
}

function updateViewRefreshButton() {
  ensureShellUi();
  if (!shellUi.refreshButton) return;

  const isLoading = App.viewHydration.inFlight === true;
  const label = isLoading ? "Refreshing current view" : "Refresh current view";
  shellUi.refreshButton.disabled = isLoading;
  shellUi.refreshButton.setAttribute("aria-busy", isLoading ? "true" : "false");
  shellUi.refreshButton.setAttribute("aria-label", label);
  shellUi.refreshButton.setAttribute("title", label);
  shellUi.refreshButton.classList.toggle("is-loading", isLoading);
}

function broadcastViewHydrationState() {
  updateViewRefreshButton();
  try {
    window.dispatchEvent(
      new CustomEvent("streamsuites:view-hydration", {
        detail: {
          view: App.viewHydration.activeView,
          requestId: App.viewHydration.activeRequestId,
          loading: App.viewHydration.inFlight,
          refresh: App.viewHydration.isRefresh
        }
      })
    );
  } catch (err) {
    console.warn("[Dashboard] View hydration event dispatch failed", err);
  }
}

function broadcastAdminLiveData(viewName, source = "api") {
  const detail = {
    view: viewName || App.currentView || "",
    route: App.currentRoute?.pathname || window.location.pathname || "",
    source,
    status_source: source,
    ok: true
  };
  try {
    window.__STREAMSUITES_ADMIN_LIVE_DATA__ = detail;
    window.StreamSuitesSnapshotHealth?.handleAdminLiveData?.(detail);
  } catch (err) {
    console.warn("[Dashboard] Admin live-data replay failed", err);
  }
  try {
    window.dispatchEvent(
      new CustomEvent("streamsuites:admin-live-data", {
        detail
      })
    );
  } catch (err) {
    console.warn("[Dashboard] Admin live-data event dispatch failed", err);
  }
}

function setViewHydrationState(nextState) {
  App.viewHydration = {
    ...App.viewHydration,
    ...nextState
  };
  broadcastViewHydrationState();
}

async function fetchViewMarkup(viewUrl, options = {}) {
  let lastError = null;

  for (let attempt = 0; attempt <= VIEW_FETCH_RETRY_COUNT; attempt += 1) {
    if (options.signal?.aborted) {
      const abortedError = new DOMException("View load aborted", "AbortError");
      throw abortedError;
    }

    try {
      const response = await fetchWithTimeout(
        viewUrl,
        {
          cache: "no-store",
          signal: options.signal
        },
        VIEW_FETCH_TIMEOUT_MS
      );

      if (!response.ok) {
        if (attempt < VIEW_FETCH_RETRY_COUNT && isRetryableViewStatus(response.status)) {
          await delay(VIEW_FETCH_RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (err) {
      lastError = err;
      if (options.signal?.aborted || !isRetryableViewError(err) || attempt >= VIEW_FETCH_RETRY_COUNT) {
        throw err;
      }
      await delay(VIEW_FETCH_RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError || new Error("View fetch failed");
}

function resolveViewTitle(name, route = App.currentRoute) {
  return (
    window.StreamSuitesAdminRoutes?.getTitleForView?.(name, route?.params || {}) ||
    "Overview"
  );
}

async function refreshCurrentView(options = {}) {
  const route = App.currentRoute || resolveDashboardRoute();
  const targetView =
    route?.view && App.views[route.view]
      ? route.view
      : App.currentView && App.views[App.currentView]
        ? App.currentView
        : "overview";

  return loadView(targetView, {
    force: true,
    refresh: true,
    reason: options.reason || `Refreshing ${resolveViewTitle(targetView, route)}...`
  });
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

function initAccountsShellElements() {
  if (accountsShell.initialized) return true;

  accountsShell.toggle = document.getElementById("accounts-tabs-toggle");
  accountsShell.rail = document.getElementById("accounts-shell-tabs");
  accountsShell.viewport = document.getElementById("accounts-shell-tabs-viewport");
  accountsShell.track = document.getElementById("accounts-shell-tabs-inner");
  accountsShell.prevButton = document.getElementById("accounts-shell-tabs-prev");
  accountsShell.nextButton = document.getElementById("accounts-shell-tabs-next");
  accountsShell.appMain = document.getElementById("app-main");
  accountsShell.tabs = Array.from(
    accountsShell.track?.querySelectorAll("[data-accounts-shell-anchor]") || []
  );

  if (
    !accountsShell.toggle ||
    !accountsShell.rail ||
    !accountsShell.viewport ||
    !accountsShell.track ||
    !accountsShell.prevButton ||
    !accountsShell.nextButton ||
    !accountsShell.appMain
  ) {
    return false;
  }

  accountsShell.initialized = true;
  return true;
}

function readAccountsShellCollapsedPreference() {
  const storageKey = accountsShell.activeConfig?.storageKey;
  if (!storageKey) return false;
  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch (_err) {
    return false;
  }
}

function persistAccountsShellCollapsed(collapsed) {
  const storageKey = accountsShell.activeConfig?.storageKey;
  if (!storageKey) return;
  try {
    window.localStorage.setItem(storageKey, collapsed ? "1" : "0");
  } catch (_err) {
    // Storage can be unavailable in restricted contexts.
  }
}

function updateAccountsShellToggleState() {
  if (!accountsShell.toggle) return;
  const labelStem = accountsShell.activeConfig?.toggleLabel || "section tabs";
  const label = accountsShell.collapsed
    ? `Show ${labelStem}`
    : `Collapse ${labelStem}`;
  accountsShell.toggle.setAttribute("aria-expanded", String(!accountsShell.collapsed));
  accountsShell.toggle.setAttribute("aria-label", label);
  accountsShell.toggle.setAttribute("title", label);
  accountsShell.toggle.classList.toggle("is-collapsed", accountsShell.collapsed);
}

function setAccountsShellActiveSection(sectionId, options = {}) {
  const normalizedSectionId = String(sectionId || "").trim();
  accountsShell.currentSection = normalizedSectionId;

  accountsShell.tabs.forEach((tab) => {
    const targetId = tab.getAttribute("data-accounts-shell-anchor") || "";
    const isActive = normalizedSectionId && targetId === normalizedSectionId;
    tab.classList.toggle("is-active", isActive);
    if (isActive) {
      tab.setAttribute("aria-current", "true");
    } else {
      tab.removeAttribute("aria-current");
    }
  });

  if (!options.updateHash || !normalizedSectionId) return;

  const url = new URL(window.location.href);
  if (url.hash === `#${normalizedSectionId}`) return;
  url.hash = normalizedSectionId;
  window.history.replaceState(window.history.state, "", url.toString());
}

function resolveActiveAccountsSection() {
  if (!accountsShell.appMain || !accountsShell.sections.length) return "";
  const rootTop = accountsShell.appMain.getBoundingClientRect().top;
  const threshold = 132;
  let activeId = accountsShell.sections[0]?.id || "";

  accountsShell.sections.forEach((section) => {
    const topOffset = section.getBoundingClientRect().top - rootTop;
    if (topOffset <= threshold) {
      activeId = section.id;
    }
  });

  return activeId;
}

function refreshAccountsShellSections() {
  const sectionIds = Array.isArray(accountsShell.activeConfig?.sections)
    ? accountsShell.activeConfig.sections.map((section) => section.id)
    : [];
  accountsShell.sections = sectionIds
    .map((id) => document.getElementById(id))
    .filter(Boolean);
}

function renderAccountsShellTabs() {
  if (!accountsShell.track) return;
  const sections = Array.isArray(accountsShell.activeConfig?.sections)
    ? accountsShell.activeConfig.sections
    : [];
  accountsShell.track.innerHTML = sections
    .map(
      (section) => `
        <a
          class="accounts-shell-tab"
          href="#${section.id}"
          data-accounts-shell-anchor="${section.id}"
        >
          ${section.label}
        </a>
      `
    )
    .join("");
  accountsShell.tabs = Array.from(
    accountsShell.track.querySelectorAll("[data-accounts-shell-anchor]")
  );
}

function setAccountsShellScrollButtonVisibility(button, visible) {
  if (!button) return;
  button.classList.toggle("hidden", !visible);
  button.hidden = !visible;
  button.setAttribute("aria-hidden", String(!visible));
}

function updateAccountsShellOverflowState() {
  if (!accountsShell.track || !accountsShell.visible || accountsShell.collapsed) {
    setAccountsShellScrollButtonVisibility(accountsShell.prevButton, false);
    setAccountsShellScrollButtonVisibility(accountsShell.nextButton, false);
    accountsShell.rail?.classList.remove("has-overflow", "show-left-fade", "show-right-fade");
    return;
  }

  const maxScrollLeft = Math.max(
    0,
    accountsShell.track.scrollWidth - accountsShell.track.clientWidth
  );
  const hasOverflow = maxScrollLeft > 6;
  const showLeft = hasOverflow && accountsShell.track.scrollLeft > 4;
  const showRight =
    hasOverflow && accountsShell.track.scrollLeft < maxScrollLeft - 4;

  accountsShell.rail.classList.toggle("has-overflow", hasOverflow);
  accountsShell.rail.classList.toggle("show-left-fade", showLeft);
  accountsShell.rail.classList.toggle("show-right-fade", showRight);
  setAccountsShellScrollButtonVisibility(accountsShell.prevButton, showLeft);
  setAccountsShellScrollButtonVisibility(accountsShell.nextButton, showRight);
}

function syncAccountsShellScrollState() {
  if (!accountsShell.visible || accountsShell.collapsed) return;
  const activeId = resolveActiveAccountsSection();
  if (activeId) {
    setAccountsShellActiveSection(activeId);
  }
}

function scrollAccountsShellRail(direction) {
  if (!accountsShell.track) return;
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const distance = Math.max(160, Math.round(accountsShell.track.clientWidth * 0.5));
  accountsShell.track.scrollBy({
    left: direction * distance,
    behavior: prefersReducedMotion ? "auto" : "smooth"
  });
}

function scrollToAccountsShellSection(sectionId, options = {}) {
  if (
    App.currentView === "economy" &&
    (sectionId === "economy-ledger-section" || sectionId === "economy-inventory-events-section")
  ) {
    const drawer = sectionId === "economy-ledger-section" ? "ledger" : "inventory-events";
    window.dispatchEvent(new CustomEvent("streamsuites:economy-audit-drawer", { detail: { drawer } }));
    setAccountsShellActiveSection(sectionId, { updateHash: options.updateHash !== false });
    return;
  }
  const target =
    typeof sectionId === "string" ? document.getElementById(sectionId) : null;
  if (!target) return;
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  target.scrollIntoView({
    behavior: options.behavior || (prefersReducedMotion ? "auto" : "smooth"),
    block: "start"
  });
  setAccountsShellActiveSection(target.id, { updateHash: options.updateHash !== false });
}

function applyAccountsShellHashTarget() {
  const hashId = window.location.hash.replace(/^#/, "").trim();
  if (!hashId) {
    syncAccountsShellScrollState();
    return;
  }
  if (!accountsShell.sections.some((section) => section.id === hashId)) {
    return;
  }
  scrollToAccountsShellSection(hashId, {
    behavior: "auto",
    updateHash: false
  });
}

function setAccountsShellCollapsed(collapsed, options = {}) {
  if (!initAccountsShellElements()) return;

  accountsShell.collapsed = Boolean(collapsed);
  updateAccountsShellToggleState();

  const showRail = accountsShell.visible && !accountsShell.collapsed;
  accountsShell.rail.classList.toggle("hidden", !showRail);
  accountsShell.rail.hidden = !showRail;
  accountsShell.rail.setAttribute("aria-hidden", String(!showRail));

  document.documentElement.classList.toggle("ss-accounts-shell-visible", showRail);
  document.body?.classList.toggle("ss-accounts-shell-visible", showRail);
  document.documentElement.classList.toggle("ss-accounts-shell-collapsed", accountsShell.visible && accountsShell.collapsed);
  document.body?.classList.toggle("ss-accounts-shell-collapsed", accountsShell.visible && accountsShell.collapsed);

  if (options.persist !== false) {
    persistAccountsShellCollapsed(accountsShell.collapsed);
  }

  if (showRail) {
    syncAccountsShellScrollState();
    updateAccountsShellOverflowState();
    return;
  }

  updateAccountsShellOverflowState();
}

function bindAccountsShell() {
  if (!initAccountsShellElements()) return;
  if (accountsShell.toggle.dataset.bound === "1") return;

  accountsShell.toggle.dataset.bound = "1";
  accountsShell.toggle.addEventListener("click", () => {
    setAccountsShellCollapsed(!accountsShell.collapsed, { persist: true });
  });

  accountsShell.prevButton.addEventListener("click", () => {
    scrollAccountsShellRail(-1);
  });

  accountsShell.nextButton.addEventListener("click", () => {
    scrollAccountsShellRail(1);
  });

  accountsShell.rail.addEventListener("click", (event) => {
    const target = event.target.closest("[data-accounts-shell-anchor]");
    if (!target) return;
    event.preventDefault();
    const sectionId = target.getAttribute("data-accounts-shell-anchor") || "";
    if (!sectionId) return;
    scrollToAccountsShellSection(sectionId);
  });

  accountsShell.track.addEventListener(
    "scroll",
    () => {
      updateAccountsShellOverflowState();
    },
    { passive: true }
  );

  if (!accountsShell.scrollBound) {
    accountsShell.scrollBound = true;
    accountsShell.appMain.addEventListener(
      "scroll",
      () => {
        syncAccountsShellScrollState();
      },
      { passive: true }
    );
    window.addEventListener("hashchange", () => {
      if (!resolveSectionShellConfig(App.currentView)) return;
      refreshAccountsShellSections();
      applyAccountsShellHashTarget();
      updateAccountsShellOverflowState();
    });
  }

  if (!accountsShell.resizeBound) {
    accountsShell.resizeBound = true;
    window.addEventListener(
      "resize",
      () => {
        updateAccountsShellOverflowState();
      },
      { passive: true }
    );
  }
}

function syncAccountsShellForView(viewName) {
  if (!initAccountsShellElements()) return;

  bindAccountsShell();

  const nextConfig = resolveSectionShellConfig(viewName);
  if (accountsShell.activeView !== viewName || accountsShell.activeConfig !== nextConfig) {
    accountsShell.activeView = viewName;
    accountsShell.activeConfig = nextConfig;
    accountsShell.collapsePreferenceLoaded = false;
    renderAccountsShellTabs();
  }

  refreshAccountsShellSections();
  const shouldShow = Boolean(nextConfig);
  const hasRenderableSections = accountsShell.sections.length > 0;
  accountsShell.visible = shouldShow && hasRenderableSections;

  accountsShell.toggle.classList.toggle("hidden", !accountsShell.visible);
  accountsShell.toggle.hidden = !accountsShell.visible;

  if (!accountsShell.collapsePreferenceLoaded) {
    accountsShell.collapsePreferenceLoaded = true;
    accountsShell.collapsed = readAccountsShellCollapsedPreference();
  }

  if (!accountsShell.visible) {
    setAccountsShellActiveSection("");
    setAccountsShellCollapsed(accountsShell.collapsed, { persist: false });
    document.documentElement.classList.remove("ss-accounts-shell-visible", "ss-accounts-shell-collapsed");
    document.body?.classList.remove("ss-accounts-shell-visible", "ss-accounts-shell-collapsed");
    return;
  }

  setAccountsShellCollapsed(accountsShell.collapsed, { persist: false });
  window.requestAnimationFrame(() => {
    refreshAccountsShellSections();
    applyAccountsShellHashTarget();
    syncAccountsShellScrollState();
    updateAccountsShellOverflowState();
  });
}

async function loadView(name, options = {}) {
  if (shouldBlockDashboardRuntime()) return;
  const view = App.views[name];
  if (!view) {
    console.warn(`[Dashboard] Unknown view: ${name}`);
    return;
  }

  const activeRoute = options.route || App.currentRoute || resolveDashboardRoute();
  const viewTitle = resolveViewTitle(name, activeRoute);
  setTopbarTitleBase(viewTitle);
  if (!options.preserveTitleOverride) {
    clearTopbarTitleOverride();
  }

  App.viewHydration.abortController?.abort();
  const loadController = new AbortController();
  const requestId = App.viewHydration.requestId + 1;
  setViewHydrationState({
    requestId,
    activeRequestId: requestId,
    activeView: name,
    inFlight: true,
    isRefresh: options.refresh === true,
    abortController: loadController
  });

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
  if (!isDashboardViewAllowed(name)) {
    App.currentView = name;
    renderRestrictedDashboardView(container, name);
    syncAccountsShellForView(name);
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
    window.StreamSuitesGlobalLoader?.startLoading?.(
      options.reason || `${options.refresh ? "Refreshing" : "Loading"} ${viewTitle}...`
    ) || null;

  try {
    window.StreamSuitesToast?.clearAll?.();
    const html = await fetchViewMarkup(viewUrl, { signal: loadController.signal });
    if (requestId !== App.viewHydration.activeRequestId || loadController.signal.aborted) {
      return;
    }

    container.innerHTML = html;
    pruneTopLevelViewTitle(container, viewTitle);
    markFirstViewMounted(name);

    setModeDataset(container);

    App.currentView = name;

    try {
      const result = view.onLoad(App.mode);
      if (result && typeof result.then === "function") {
        await result;
      }
      if (view.dataSource === "api") {
        broadcastAdminLiveData(name, "api");
      }
    } catch (e) {
      console.error(`[Dashboard] View load error (${name})`, e);
    }

    if (requestId !== App.viewHydration.activeRequestId || loadController.signal.aborted) {
      return;
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

    syncAccountsShellForView(name);

    updateNavActiveState(name);

    if (window.Versioning?.stampFooters) {
      window.Versioning.stampFooters();
    }
  } catch (err) {
    if (err?.name === "AbortError") {
      return;
    }
    console.error(`[Dashboard] Failed to load view ${name}`, err);
    container.innerHTML = `
      <div class="panel">
        <h3>${viewTitle}</h3>
        <div class="ss-alert ss-alert-danger">
          Failed to hydrate this view. Use refresh to retry.
        </div>
        <p class="text-muted" style="margin-top: 0.5rem;">
          Expected partial: ${viewUrl.pathname}
        </p>
      </div>
    `;
    markFirstViewMounted(name);
    syncAccountsShellForView(name);
  } finally {
    if (loaderToken) {
      window.StreamSuitesGlobalLoader?.stopLoading?.(loaderToken);
    }
    if (requestId === App.viewHydration.activeRequestId) {
      setViewHydrationState({
        inFlight: false,
        isRefresh: false,
        abortController: null
      });
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
const SIDEBAR_VIEW_ICON_ALIASES = Object.freeze({
  inbox: "notifications",
  notification: "notifications",
  notifications: "notifications",
  "rate-limit": "ratelimits",
  "rate-limits": "ratelimits",
  ratelimit: "ratelimits",
  ratelimits: "ratelimits",
  signals: "data-signals",
  "data-signals": "data-signals",
  "runtime-status": "bots"
});

const SIDEBAR_VIEW_ICON_MAP = Object.freeze({
  overview: "/assets/icons/ui/home.svg",
  creators: "/assets/icons/ui/profile.svg",
  "creator-integrations": "/assets/icons/ui/automation.svg",
  "creator-stats": "/assets/icons/ui/statgraph.svg",
  accounts: "/assets/icons/ui/identity-filled.svg",
  "public-identities": "/assets/icons/ui/groupcircle.svg",
  progression: "/assets/icons/ui/statgraph.svg",
  economy: "/assets/icons/economy.svg",
  tiers: "/assets/icons/ui/verifiedbadge.svg",
  audit: "/assets/icons/ui/audit.svg",
  approvals: "/assets/icons/ui/tickbox.svg",
  "api-usage": "/assets/icons/ui/api.svg",
  alerts: "/assets/icons/ui/cloudalert.svg",
  analytics: "/assets/icons/ui/globe.svg",
  triggers: "/assets/icons/ui/flag.svg",
  jobs: "/assets/icons/ui/automation.svg",
  clips: "/assets/icons/ui/clipcards.svg",
  polls: "/assets/icons/ui/vote.svg",
  tallies: "/assets/icons/ui/bulletlist.svg",
  scoreboards: "/assets/icons/ui/dashboard.svg",
  "data-signals": "/assets/icons/ui/celltower.svg",
  bots: "/assets/icons/ui/bot.svg",
  notifications: "/assets/icons/ui/bell.svg",
  ratelimits: "/assets/icons/ui/speed.svg",
  settings: "/assets/icons/ui/cog.svg",
  permissions: "/assets/icons/ui/shieldtoggle.svg",
  "chat-replay": "/assets/icons/ui/uiscreen.svg",
  rumble: "/assets/icons/rumble-0.svg",
  youtube: "/assets/icons/youtube-0.svg",
  twitch: "/assets/icons/twitch-0.svg",
  kick: "/assets/icons/kick-0.svg",
  pilled: "/assets/icons/pilled-0.svg",
  twitter: "/assets/icons/twitter-0.svg",
  discord: "/assets/icons/discord-0.svg",
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

function isSidebarDevDiagnosticsEnabled() {
  const hostname = String(window.location?.hostname || "").toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local")
  );
}

function normalizeSidebarViewKey(viewName) {
  const raw = typeof viewName === "string" ? viewName.trim() : "";
  if (!raw) return "";
  if (SIDEBAR_VIEW_ICON_MAP[raw]) return raw;

  const normalized = raw.toLowerCase();
  if (SIDEBAR_VIEW_ICON_MAP[normalized]) return normalized;

  return SIDEBAR_VIEW_ICON_ALIASES[normalized] || normalized;
}

function appendSidebarAssetVersion(path) {
  const rawPath = typeof path === "string" ? path.trim() : "";
  if (!rawPath) return SIDEBAR_ICON_FALLBACK;

  const versionToken =
    window.__STREAMSUITES_ASSET_VERSION__ ||
    window.StreamSuitesVersion?.build ||
    window.StreamSuitesVersion?.version ||
    "";
  if (!versionToken) return rawPath;

  try {
    const resolved = new URL(rawPath, window.location.origin);
    if (!resolved.searchParams.has("v")) {
      resolved.searchParams.set("v", versionToken);
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch (err) {
    return rawPath;
  }
}

function getSidebarIconForView(viewName) {
  const resolvedView = normalizeSidebarViewKey(viewName);
  const rawIconPath = SIDEBAR_VIEW_ICON_MAP[resolvedView] || SIDEBAR_ICON_FALLBACK;

  if (
    rawIconPath === SIDEBAR_ICON_FALLBACK &&
    viewName &&
    isSidebarDevDiagnosticsEnabled()
  ) {
    console.warn(`[Dashboard] Missing sidebar icon mapping for view "${viewName}"`);
  }

  return appendSidebarAssetVersion(rawIconPath);
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
    const iconPath = getSidebarIconForView(viewName);
    if (item.hasAttribute("data-nav-icon")) {
      item.removeAttribute("data-nav-icon");
    }
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

function applySidebarAccessState() {
  $all("#app-nav-list li[data-view]").forEach((item) => {
    const viewName = String(item.dataset.view || "").trim().toLowerCase();
    if (!viewName) return;
    const allowed = isDashboardViewAllowed(viewName);
    item.hidden = !allowed;
    item.classList.toggle("is-disabled", !allowed);
    item.setAttribute("aria-hidden", allowed ? "false" : "true");
    if (!allowed) {
      item.removeAttribute("tabindex");
    } else if (!item.hasAttribute("tabindex")) {
      item.setAttribute("tabindex", "0");
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
  applySidebarAccessState();
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

window.addEventListener("streamsuites:admin-auth", () => {
  applySidebarAccessState();
});

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
  isOpen: false
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
  if (window.StreamSuitesAdminRoutes?.navigateToView) {
    window.StreamSuitesAdminRoutes.navigateToView(viewName);
    return;
  }
}

function setAdminUserMenuOpen(nextOpen) {
  if (!adminUserMenu.root || !adminUserMenu.toggle || !adminUserMenu.menu) return;
  const shouldOpen = Boolean(nextOpen);
  if (adminUserMenu.isOpen === shouldOpen) return;

  adminUserMenu.isOpen = shouldOpen;
  adminUserMenu.root.classList.toggle("is-open", shouldOpen);
  adminUserMenu.toggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  adminUserMenu.menu.classList.toggle("hidden", !shouldOpen);
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

  toggle.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
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
}

function updateNavActiveState(viewName) {
  const normalizedView = viewName === "user-detail" ? "accounts" : viewName;
  $all("[data-view]").forEach((el) => {
    if (el.dataset.view === normalizedView) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });
  syncNavOverflowActiveIndicator();
}

function bindNavigation() {
  $all("[data-view]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      const view = el.dataset.view;
      if (view) navigateToDashboardView(view);
    });
    el.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const view = el.dataset.view;
      if (view) navigateToDashboardView(view);
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
    e.preventDefault();

    const view = target.dataset.view;
    if (view) navigateToDashboardView(view);
  });
}

function resolveDashboardRoute() {
  const router = window.StreamSuitesAdminRoutes;
  if (router?.resolveLocation) {
    return router.resolveLocation();
  }
  const raw = window.location.hash.replace(/^#/, "").trim();
  const [viewToken, ...queryParts] = raw.split("?");
  return {
    mode: "hash",
    view: (viewToken || "").trim(),
    query: queryParts.length ? `?${queryParts.join("?")}` : "",
    queryString: queryParts.join("?")
  };
}

function isDefaultDashboardEntry(route) {
  return String(route?.pathname || "").trim() === "/";
}

function getRouteIdentity(route) {
  if (!route || typeof route !== "object") return "";
  return JSON.stringify({
    mode: route.mode || "",
    view: route.view || "",
    pathname: route.pathname || "",
    queryString: route.queryString || "",
    params: route.params || {}
  });
}

function resolveInitialView(route = resolveDashboardRoute()) {
  const view = route?.view;
  if (view && App.views[view]) {
    return view;
  }
  if (isDefaultDashboardEntry(route)) {
    return getFirstAllowedDashboardView();
  }
  return "";
}

function handleDashboardRouteChange(route = resolveDashboardRoute()) {
  const previousRoute = App.currentRoute;
  const targetView =
    route?.view && App.views[route.view]
      ? route.view
      : isDefaultDashboardEntry(route)
        ? getFirstAllowedDashboardView()
        : "";
  App.currentRoute = route;

  if (route?.mode === "hash" && targetView) {
    window.StreamSuitesAdminRoutes?.canonicalizeLegacyHashRoute?.(route);
    return;
  }

  if (!targetView) {
    App.currentView = "";
    setTopbarTitleBase("Not found");
    clearTopbarTitleOverride();
    renderMissingDashboardRoute($("#view-container"), route);
    syncAccountsShellForView("");
    updateNavActiveState("");
    return;
  }

  setTopbarTitleBase(resolveViewTitle(targetView, route));
  const routeChanged = getRouteIdentity(previousRoute) !== getRouteIdentity(route);
  if (App.currentView === targetView && !routeChanged) {
    return;
  }
  if (App.currentView === targetView && routeChanged) {
    void refreshCurrentView({ reason: `Refreshing ${resolveViewTitle(targetView, route)}...` });
    return;
  }

  loadView(targetView, { route });
}

function bindRouteChanges() {
  window.addEventListener("streamsuites:routechange", (event) => {
    handleDashboardRouteChange(event?.detail?.route || resolveDashboardRoute());
  });
}

function bindTopbarRefresh() {
  ensureShellUi();
  if (!shellUi.refreshButton || shellUi.refreshButton.dataset.bound === "1") return;

  shellUi.refreshButton.dataset.bound = "1";
  shellUi.refreshButton.addEventListener("click", () => {
    void refreshCurrentView();
  });

  updateViewRefreshButton();
}

function bindVisibilityRefresh() {
  if (window.__STREAMSUITES_ADMIN_VISIBILITY_REFRESH_BOUND__) return;
  window.__STREAMSUITES_ADMIN_VISIBILITY_REFRESH_BOUND__ = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (!App.initialized || App.viewHydration.inFlight === true || !App.currentView) return;
    void refreshCurrentView({ reason: `Refreshing ${resolveViewTitle(App.currentView, App.currentRoute)}...` });
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
      "[Dashboard] INIT WATCHDOG TRIPPED: init exceeded 3000ms; continuing boot with diagnostics only."
    );
    console.error("CURRENT_VIEW", App.currentView);
    console.error("CURRENT_ROUTE", App.currentRoute);
    console.error("FIRST_VIEW_NAME", App.boot?.firstViewName);
    console.error("FIRST_VIEW_MOUNTED", App.boot?.firstViewMounted);
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
    bindTopbarRefresh();
    bindVisibilityRefresh();
    bindNavigation();
    bindDelegatedNavigation();
    bindRouteChanges();

    console.log("[BOOT:50] router begin", performance.now());
    const initialRoute = resolveDashboardRoute();
    const initialView = resolveInitialView(initialRoute);
    App.currentRoute = initialRoute;
    App.boot.firstViewName = initialView;
    setTopbarTitleBase(initialView ? resolveViewTitle(initialView, initialRoute) : "Not found");
    console.log("[BOOT:55] Router ready", performance.now());
    if (initialView) {
      console.log("[BOOT:60] first view mount begin", performance.now());
      await loadView(initialView, { route: initialRoute });
      if (initialRoute?.mode === "hash" && initialRoute.view) {
        window.StreamSuitesAdminRoutes?.canonicalizeLegacyHashRoute?.(initialRoute);
      } else if (!initialRoute?.view || initialRoute?.pathname === "/") {
        window.StreamSuitesAdminRoutes?.navigateToView?.(initialView, { replace: true });
      }
    } else {
      renderMissingDashboardRoute($("#view-container"), initialRoute);
      syncAccountsShellForView("");
      updateNavActiveState("");
    }

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

window.StreamSuitesAdminShell = {
  refreshCurrentView,
  setTopbarTitleOverride,
  clearTopbarTitleOverride,
  setSectionShellSections,
  resetSectionShellSections,
  getCurrentViewTitle() {
    return App.title.override || App.title.base || "Overview";
  },
  getCurrentView() {
    return App.currentView || "";
  },
  isViewHydrating() {
    return App.viewHydration.inFlight === true;
  }
};

/* ----------------------------------------------------------------------
   Register Views
   ---------------------------------------------------------------------- */

registerView("overview", {
  onLoad: () => window.OverviewView?.init?.(),
  onUnload: () => window.OverviewView?.destroy?.()
});

registerView("creators", {
  onLoad: () => {
    if (window.CreatorsView?.init) {
      return window.CreatorsView.init();
    }
    return null;
  },
  onUnload: () => window.CreatorsView?.destroy?.()
});
registerView("creator-integrations", {
  onLoad: () => window.CreatorIntegrationsView?.init?.(),
  onUnload: () => window.CreatorIntegrationsView?.destroy?.()
});
registerView("user-detail", {
  onLoad: () => window.UserDetailView?.init?.(),
  onUnload: () => window.UserDetailView?.destroy?.()
});
registerView("creator-stats", {
  onLoad: () => window.CreatorStatsView?.init?.(),
  onUnload: () => window.CreatorStatsView?.destroy?.()
});
  registerView("accounts", {
    onLoad: () => window.AccountsView?.init?.()
  });
  registerView("tiers", {
    onLoad: () => window.TiersView?.init?.()
  });
  registerView("audit", {
    templatePath: "audit",
    onLoad: () => window.AuditLogsView?.init?.()
});
registerView("approvals", {
  templatePath: "approvals",
  onLoad: () => window.ApprovalsView?.init?.(),
  onUnload: () => window.ApprovalsView?.destroy?.()
});
registerView("progression", {
  templatePath: "progression",
  onLoad: () => window.ProgressionAdminView?.init?.(),
  onUnload: () => window.ProgressionAdminView?.destroy?.()
});
registerView("economy", {
  templatePath: "economy",
  dataSource: "api",
  onLoad: () => window.EconomyInventoryAdminView?.init?.(),
  onUnload: () => window.EconomyInventoryAdminView?.destroy?.()
});
registerView("public-identities", {
  templatePath: "public-identities",
  onLoad: () => window.PublicIdentitiesView?.init?.(),
  onUnload: () => window.PublicIdentitiesView?.destroy?.()
});
registerView("api-usage", {
  templatePath: "api-usage",
  onLoad: () => window.ApiUsageView?.init?.(),
  onUnload: () => window.ApiUsageView?.destroy?.()
});
registerView("alerts", {
  onLoad: () => window.StreamSuitesAlertsView?.init?.(),
  onUnload: () => window.StreamSuitesAlertsView?.destroy?.()
});
registerView("analytics", {
  onLoad: () => window.AnalyticsView?.init?.(),
  onUnload: () => window.AnalyticsView?.destroy?.()
});

registerView("triggers", {
  onLoad: () => {
    if (window.TriggersView?.init) {
      return window.TriggersView.init();
    }
    return null;
  },
  onUnload: () => window.TriggersView?.destroy?.()
});

registerView("jobs", {
  onLoad: () => {
    if (window.JobsView?.init) {
      return window.JobsView.init();
    }
    return null;
  },
  onUnload: () => window.JobsView?.destroy?.()
});

registerView("clips", {
  onLoad: () => window.ClipsView?.init?.(),
  onUnload: () => window.ClipsView?.destroy?.()
});
registerView("polls", {});
registerView("tallies", {});
registerView("scoreboards", {});
registerView("scoreboard-management", {});
registerView("data-signals", {
  templatePath: "data-signals",
  onLoad: () => window.DataSignalsView?.init?.(),
  onUnload: () => window.DataSignalsView?.destroy?.()
});
registerView("bots", {
  onLoad: () => window.BotsView?.init?.(),
  onUnload: () => window.BotsView?.destroy?.()
});
registerView("rumble", {
  templatePath: "platforms/rumble",
  onLoad: () => window.RumbleView?.init?.(),
  onUnload: () => window.RumbleView?.destroy?.()
});
registerView("youtube", {
  templatePath: "platforms/youtube",
  onLoad: () => window.YouTubeView?.init?.(),
  onUnload: () => window.YouTubeView?.destroy?.()
});
registerView("twitch", {
  templatePath: "platforms/twitch",
  onLoad: () => window.TwitchView?.init?.(),
  onUnload: () => window.TwitchView?.destroy?.()
});
registerView("kick", {
  templatePath: "platforms/kick",
  onLoad: (mode) => window.KickView?.init?.(mode),
  onUnload: () => window.KickView?.destroy?.(),
  onModeChange: (mode) => {
    window.KickView?.onModeChange?.(mode);
  }
});
registerView("pilled", {
  templatePath: "platforms/pilled",
  onLoad: (mode) => window.PilledView?.init?.(mode),
  onUnload: () => window.PilledView?.destroy?.(),
  onModeChange: (mode) => {
    window.PilledView?.onModeChange?.(mode);
  }
});
registerView("twitter", { templatePath: "platforms/twitter" });
registerView("discord", {
  templatePath: "platforms/discord",
  onLoad: () => window.DiscordView?.init?.(),
  onUnload: () => window.DiscordView?.destroy?.()
});

registerView("ratelimits", {
  onLoad: () => window.RatelimitsView?.init?.()
});

registerView("settings", {
  onLoad: () => window.SettingsView?.init?.(),
  onUnload: () => window.SettingsView?.destroy?.()
});
registerView("permissions", {
  onLoad: () => window.PermissionsView?.init?.(),
  onUnload: () => window.PermissionsView?.destroy?.()
});
registerView("chat-replay", {});
registerView("design", {});
registerView("updates", {
  onLoad: () => window.UpdatesView?.init?.(),
  onUnload: () => window.UpdatesView?.destroy?.()
});
registerView("notifications", {
  onLoad: () => window.StreamSuitesNotifications?.initCenter?.(),
  onUnload: () => window.StreamSuitesNotifications?.destroyCenter?.()
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

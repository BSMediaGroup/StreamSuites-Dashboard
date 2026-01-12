/* ======================================================================
   StreamSuites™ Dashboard — app.js
   Project: StreamSuites™
   Version: v0.2.2-alpha
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

function isRuntimeAvailable() {
  return window.__STREAMSUITES_RUNTIME_AVAILABLE__ !== false;
}

function markRuntimeUnavailable() {
  window.__STREAMSUITES_RUNTIME_AVAILABLE__ = false;
}

const App = {
  currentView: null,
  views: {},
  initialized: false,
  storage: {},
  state: {}, // ✅ ADDITIVE — read-only runtime snapshots live here
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

  const viewPath = `views/${view.templatePath}.html`;
  const basePath = window.location.pathname.replace(/docs\/[^/]*$/, "");
  const viewUrl = new URL(viewPath, `${window.location.origin}${basePath}`);
  const viewPathLower = viewUrl.pathname.toLowerCase();
  if (
    viewPathLower.includes("/livechat/") ||
    viewPathLower.endsWith("/livechat/index.html")
  ) {
    console.warn("[Dashboard] LiveChat path excluded from view loader.", viewUrl.pathname);
    return;
  }

  try {
    const res = await fetch(viewUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    container.innerHTML = html;

    setModeDataset(container);

    App.currentView = name;

    try {
      view.onLoad(App.mode);
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
  } catch (err) {
    console.error(`[Dashboard] Failed to load view ${name}`, err);
    container.innerHTML = `
      <div class="panel">
        <h3>${name}</h3>
        <p class="text-muted">This module is not yet implemented.</p>
      </div>
    `;
  }
}

/* ----------------------------------------------------------------------
   Navigation Handling
   ---------------------------------------------------------------------- */

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

function updateNavActiveState(viewName) {
  $all("[data-view]").forEach((el) => {
    if (el.dataset.view === viewName) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });
  syncNavOverflowActiveIndicator();
  ensureActiveNavVisibility();
}

function bindNavigation() {
  $all("[data-view]").forEach((el) => {
    el.addEventListener("click", () => {
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

  // ✅ ADDITIVE: anchor alias
  if (hash === "roadmap") {
    App.pendingAnchor = "roadmap";
    return "about";
  }

  if (hash && App.views[hash]) {
    return hash;
  }
  return "overview";
}

function bindHashChange() {
  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace("#", "");

    // ✅ ADDITIVE: anchor alias
    if (hash === "roadmap") {
      App.pendingAnchor = "roadmap";
      loadView("about");
      return;
    }

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

  async function initDashboard() {
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

    await detectConnectedMode();

    setModeDataset(document.getElementById("app"));
    setModeDataset(document.getElementById("view-container"));

    bindNavigation();
    bindNavOverflow();
    bindDelegatedNavigation();
    bindHashChange();

    App.state.quotas.start();
    App.state.runtimeSnapshot.start();
    RestartIndicator.init();

    const initialView = resolveInitialView();
    loadView(initialView);

    App.initialized = true;
  }

  try {
    await initDashboard();
    clearTimeout(watchdog);
  } catch (err) {
    clearTimeout(watchdog);
    throw err;
  }
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
registerView("data-signals", {
  templatePath: "data-signals",
  onLoad: () => {
    window.DataSignalsView?.init?.();
  },
  onUnload: () => {
    window.DataSignalsView?.destroy?.();
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
registerView("support", { templatePath: "support" });

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
registerView("about", {
  onLoad: () => {
    window.AboutView?.init?.();
  },
  onUnload: () => {
    window.AboutView?.destroy?.();
  }
});

/* ----------------------------------------------------------------------
   Boot
   ---------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", initApp);

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

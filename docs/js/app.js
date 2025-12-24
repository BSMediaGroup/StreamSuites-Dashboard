/* ======================================================================
   StreamSuites Dashboard — app.js
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

const App = {
  currentView: null,
  views: {},
  initialized: false,
  storage: {},
  state: {} // ✅ ADDITIVE — read-only runtime snapshots live here
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
   - Pulls shared/state/quotas.json (runtime-published)
   - Safe for GitHub Pages (silent if missing)
   - No UI binding here; views can read App.state.quotas.latest
   ====================================================================== */

App.state.quotas = {
  latest: null,
  lastFetchedAt: null,
  lastError: null,
  intervalMs: 3000,
  _timer: null,

  async fetchOnce() {
    try {
      const url = new URL("shared/state/quotas.json", document.baseURI);
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;

      const data = await res.json();

      this.latest = data;
      this.lastFetchedAt = Date.now();
      this.lastError = null;
    } catch (e) {
      this.lastError = String(e);
      // Silent failure: runtime may not be present
    }
  },

  start() {
    if (this._timer) return;

    // Initial attempt (non-blocking)
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

/* ----------------------------------------------------------------------
   View Registration
   ---------------------------------------------------------------------- */

function registerView(name, config) {
  App.views[name] = {
    name,
    onLoad: config.onLoad || (() => {}),
    onUnload: config.onUnload || (() => {}),
    containerId: config.containerId || "view-container",
    templatePath: config.templatePath || name
  };
}

/* ----------------------------------------------------------------------
   View Loader
   ---------------------------------------------------------------------- */

async function loadView(name) {
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

  try {
    const res = await fetch(new URL(viewPath, document.baseURI));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    container.innerHTML = html;

    App.currentView = name;

    try {
      view.onLoad();
    } catch (e) {
      console.error(`[Dashboard] View load error (${name})`, e);
    }

    updateNavActiveState(name);
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
   URL Hash Routing (Optional, Non-Breaking)
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
    const view = window.location.hash.replace("#", "");
    if (App.views[view]) {
      loadView(view);
    }
  });
}

/* ----------------------------------------------------------------------
   App Init
   ---------------------------------------------------------------------- */

function initApp() {
  if (App.initialized) return;

  console.info("[Dashboard] Initializing StreamSuites dashboard");

  bindNavigation();
  bindNavOverflow();
  bindDelegatedNavigation();
  bindHashChange();

  // ✅ ADDITIVE: start quota feed (silent if file missing)
  App.state.quotas.start();

  const initialView = resolveInitialView();
  loadView(initialView);

  App.initialized = true;
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

/* ------------------------------------------------------------
   C1: Jobs (READ-ONLY visibility)
   ------------------------------------------------------------ */

registerView("jobs", {
  onLoad: () => {
    if (window.JobsView?.init) {
      window.JobsView.init();
    }
  }
});

/* Placeholder modules (wired, no logic yet) */

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
registerView("rumble", {
  templatePath: "platforms/rumble"
});
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
registerView("twitter", {
  templatePath: "platforms/twitter"
});
registerView("discord", {
  templatePath: "platforms/discord",
  onLoad: () => {
    window.DiscordView?.init?.();
  },
  onUnload: () => {
    window.DiscordView?.destroy?.();
  }
});
registerView("support", {
  templatePath: "support"
});

/* ------------------------------------------------------------
   ADDITIVE PLACEHOLDER VIEWS (PHASE 0 COMPLETE)
   ------------------------------------------------------------ */

/* ✅ FIX — NOTHING ELSE CHANGED */
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

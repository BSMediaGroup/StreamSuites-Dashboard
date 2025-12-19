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
  storage: {}
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

function updateNavActiveState(viewName) {
  $all("[data-view]").forEach((el) => {
    if (el.dataset.view === viewName) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });
}

function bindNavigation() {
  $all("[data-view]").forEach((el) => {
    el.addEventListener("click", () => {
      const view = el.dataset.view;
      if (view) loadView(view);
    });
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
  bindHashChange();

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

registerView("clips", {});
registerView("polls", {});
registerView("rumble", {});
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
registerView("twitter", {});
registerView("discord", {
  onLoad: () => {
    window.DiscordView?.init?.();
  },
  onUnload: () => {
    window.DiscordView?.destroy?.();
  }
});

/* ------------------------------------------------------------
   ADDITIVE PLACEHOLDER VIEWS (PHASE 0 COMPLETE)
   ------------------------------------------------------------ */

registerView("ratelimits", {});
registerView("settings", {});
registerView("chat-replay", {});
registerView("about", {});

/* ----------------------------------------------------------------------
   Boot
   ---------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", initApp);

/* ======================================================================
   ADDITIVE: RUNTIME EXPORT (DO NOT REMOVE OR INLINE)
   ====================================================================== */

App.exportRuntimeCreators = function () {
  const creators = App.storage.loadFromLocalStorage("creators", []);

  const runtime = {
    creators: creators.map((c) => {
      const out = {
        creator_id: c.creator_id,
        display_name: c.display_name || c.creator_id,
        enabled: true,
        platforms: {},
        limits: c.limits || {}
      };

      if (c.tier) out.tier = c.tier;

      if (c.platforms?.rumble?.enabled) {
        out.platforms.rumble = true;
        out.rumble_manual_watch_url =
          c.platforms.rumble.watch_url || "";
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

/* ======================================================================
   StreamSuites Dashboard — app.js
   Central bootstrap + lightweight view router
   ====================================================================== */

/*
  DESIGN GOALS:
  - Zero frameworks
  - Deterministic load order
  - Works on GitHub Pages + iframe embeds (Wix)
  - All feature logic lives in per-view files
*/

/* ----------------------------------------------------------------------
   Global App State
   ---------------------------------------------------------------------- */

const App = {
  currentView: null,
  views: {},
  initialized: false,
};

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
   View Registration
   ---------------------------------------------------------------------- */

function registerView(name, config) {
  App.views[name] = {
    name,
    onLoad: config.onLoad || (() => {}),
    onUnload: config.onUnload || (() => {}),
    containerId: config.containerId || "view-root",
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

  const viewPath = `views/${name}.html`;

  try {
    const res = await fetch(viewPath);
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
        <h3>Error</h3>
        <p class="text-muted">Failed to load view: ${name}</p>
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
   Register Core Views
   (Logic loaded later via per-view JS files)
   ---------------------------------------------------------------------- */

registerView("overview", {
  containerId: "view-root",
});

registerView("creators", {
  containerId: "view-root",
  onLoad: () => {
    if (window.CreatorsView?.init) {
      window.CreatorsView.init();
    }
  },
});

registerView("triggers", {
  containerId: "view-root",
  onLoad: () => {
    if (window.TriggersView?.init) {
      window.TriggersView.init();
    }
  },
});

/* ----------------------------------------------------------------------
   Boot
   ---------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", initApp);

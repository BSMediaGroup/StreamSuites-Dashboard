/* ============================================================
   StreamSuites Dashboard — platforms.js
   ============================================================

   Responsibilities:
   - Bind platform service toggles to persisted config
   - Persist platform notes + telemetry flags to localStorage (via ConfigState)
   - Surface a shared accessor for platform state across views

   SAFE FOR:
   - GitHub Pages
   - Offline authoring
   ============================================================ */

(() => {
  "use strict";

  const PLATFORM_KEYS = ["youtube", "twitch", "rumble", "discord"];

  const el = {
    rows: {}
  };

  let platforms = null;
  let wired = false;

  /* ------------------------------------------------------------
     DOM CACHE
     ------------------------------------------------------------ */

  function cacheElements() {
    PLATFORM_KEYS.forEach((key) => {
      el.rows[key] = {
        enabled: document.querySelector(
          `[data-platform-row="${key}"] input[data-field="enabled"]`
        ),
        telemetry: document.querySelector(
          `[data-platform-row="${key}"] input[data-field="telemetry_enabled"]`
        ),
        notes: document.querySelector(
          `[data-platform-row="${key}"] textarea[data-field="notes"]`
        )
      };
    });
  }

  /* ------------------------------------------------------------
     INIT / DESTROY
     ------------------------------------------------------------ */

  async function initSettingsView() {
    cacheElements();
    wired = false;
    await hydratePlatforms();
    wireEvents();
    renderRows();
  }

  function destroy() {
    wired = false;
  }

  /* ------------------------------------------------------------
     HYDRATION + RENDER
     ------------------------------------------------------------ */

  async function hydratePlatforms(forceReload = false) {
    try {
      platforms =
        (await window.ConfigState?.loadPlatforms?.({ forceReload })) || null;
    } catch (err) {
      console.warn("[Platforms] Unable to hydrate platform config", err);
      platforms = null;
    }
  }

  function renderRows() {
    if (!platforms || !platforms.platforms) return;

    PLATFORM_KEYS.forEach((key) => {
      const row = el.rows[key];
      if (!row) return;

      const state = platforms.platforms[key] || {};
      if (row.enabled) {
        row.enabled.checked = !!state.enabled;
        row.enabled.disabled = false;
      }
      if (row.telemetry) {
        row.telemetry.checked = !!state.telemetry_enabled;
        row.telemetry.disabled = false;
      }
      if (row.notes) {
        row.notes.value = state.notes || "";
        row.notes.disabled = false;
      }
    });
  }

  /* ------------------------------------------------------------
     EVENTS
     ------------------------------------------------------------ */

  function wireEvents() {
    if (wired) return;

    PLATFORM_KEYS.forEach((key) => {
      const row = el.rows[key];
      if (!row) return;

      row.enabled?.addEventListener("change", () => {
        updatePlatform(key, { enabled: row.enabled.checked });
      });

      row.telemetry?.addEventListener("change", () => {
        updatePlatform(key, { telemetry_enabled: row.telemetry.checked });
      });

      row.notes?.addEventListener("input", () => {
        updatePlatform(key, { notes: row.notes.value });
      });
    });

    wired = true;
  }

  function updatePlatform(key, patch) {
    if (!platforms || !platforms.platforms) return;
    const next = { ...platforms.platforms[key], ...patch };

    platforms = window.ConfigState?.savePlatforms({
      ...platforms.platforms,
      [key]: next
    });

    renderRows();
  }

  /* ------------------------------------------------------------
     ACCESSORS
     ------------------------------------------------------------ */

  function getPlatforms() {
    return platforms;
  }

  async function refresh(forceReload = true) {
    await hydratePlatforms(forceReload);
    renderRows();
    return platforms;
  }

  window.PlatformsManager = {
    initSettingsView,
    destroy,
    getPlatforms,
    refresh
  };
})();

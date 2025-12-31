/* ============================================================
   StreamSuites Dashboard — settings.js
   ============================================================

   PURPOSE:
   - Centralized dashboard-level configuration
   - Defines NON-runtime behavior and authoring preferences
   - Configuration only — no live enforcement

   IMPORTANT DISTINCTION:
   - Settings here affect the DASHBOARD experience
   - NOT livestream bots
   - NOT runtime execution

   SAFE FOR:
   - GitHub Pages
   - iframe embedding (Wix)
   - Offline authoring

   ============================================================ */

(() => {
  "use strict";

  /* ------------------------------------------------------------
     STORAGE
     ------------------------------------------------------------ */

  const STORAGE_KEY = "settings";

  const el = {};

  let settings = null;
  let runtimeSnapshot = null;
  let systemConfig = null;
  let wired = false;

  /* ------------------------------------------------------------
     INIT
     ------------------------------------------------------------ */

  async function init() {
    cacheElements();
    wireEvents();
    loadSettings();
    await hydratePlatforms();
    await hydrateRuntimeState();
    await hydrateSystemSettings();
    await renderDashboardState();
  }

  /* ------------------------------------------------------------
     LOAD / SAVE
     ------------------------------------------------------------ */

  function loadSettings() {
    const stored = App.storage.loadFromLocalStorage(STORAGE_KEY, null);

    if (stored && typeof stored === "object") {
      settings = stored;
      return;
    }

    settings = settings || createDefaultSettings();
  }

  function persist() {
    App.storage.saveToLocalStorage(STORAGE_KEY, settings);
  }

  /* ------------------------------------------------------------
     DEFAULT SHAPE
     ------------------------------------------------------------ */

  function createDefaultSettings() {
    return {
      system: {
        mode: "local",
        autosave_interval_seconds: null,
        verbose_logging: false
      },
      platform_defaults: {
        chat_cooldown_seconds: null,
        default_response_mode: "equals_icase",
        enable_global_chat_responses: false
      },
      security: {
        confirm_destructive_actions: true,
        read_only_mode: false
      },
      advanced: {
        runtime_export_format: "creators.json",
        schema_version: "v1-draft"
      }
    };
  }

  /* ------------------------------------------------------------
     READ-ONLY ACCESSORS (FOR FUTURE UI)
     ------------------------------------------------------------ */

  function getSettings() {
    return structuredClone(settings);
  }

  function getSystemSettings() {
    return structuredClone(settings.system);
  }

  function getPlatformDefaults() {
    return structuredClone(settings.platform_defaults);
  }

  function getSecuritySettings() {
    return structuredClone(settings.security);
  }

  function getAdvancedSettings() {
    return structuredClone(settings.advanced);
  }

  /* ------------------------------------------------------------
     EXPORT / IMPORT
     ------------------------------------------------------------ */

  function exportSettings() {
    App.storage.exportJsonToDownload(
      "streamsuites-settings.json",
      settings
    );
  }

  function importSettingsFromFile(file, onError) {
    App.storage.importJsonFromFile(file)
      .then((data) => {
        if (!validateSettings(data)) {
          onError?.("Invalid settings file structure");
          return;
        }
        settings = data;
        persist();
      })
      .catch((err) => {
        console.error("[Settings] Import failed", err);
        onError?.("Failed to import settings file");
      });
  }

  /* ------------------------------------------------------------
     VALIDATION (INTENTIONALLY LOOSE)
     ------------------------------------------------------------ */

  function validateSettings(data) {
    if (!data || typeof data !== "object") return false;
    if (!("system" in data)) return false;
    if (!("platform_defaults" in data)) return false;
    if (!("security" in data)) return false;
    if (!("advanced" in data)) return false;
    return true;
  }

  /* ------------------------------------------------------------
     PUBLIC API
     ------------------------------------------------------------ */

  window.SettingsView = {
    init,
    getSettings,
    getSystemSettings,
    getPlatformDefaults,
    getSecuritySettings,
    getAdvancedSettings,
    exportSettings,
    importSettingsFromFile
  };

  /* ------------------------------------------------------------
     PLATFORM + CONFIG EXPORT WIRING
     ------------------------------------------------------------ */

  function cacheElements() {
    el.exportAll = document.getElementById("btn-export-config");
    el.importAll = document.getElementById("btn-import-config");
    el.importInput = document.getElementById("config-import-file");
    el.dashboardState = document.getElementById("dashboard-config-state");
    el.dashboardExport = document.getElementById("dashboard-export-state");
    el.platformPollingToggle = document.getElementById("platform-polling-toggle");
    el.platformPollingRuntime = document.getElementById(
      "platform-polling-runtime-state"
    );
    el.platformPollingDraft = document.getElementById("platform-polling-draft-state");
    el.platformPollingNotice = document.getElementById("platform-polling-restart");
  }

  function wireEvents() {
    if (wired) return;

    el.exportAll?.addEventListener("click", async () => {
      await window.ConfigState?.exportAllConfigs?.();
      await renderDashboardState(true);
    });

    el.importAll?.addEventListener("click", () => {
      if (!el.importInput) return;
      el.importInput.value = "";
      el.importInput.click();
    });

    el.importInput?.addEventListener("change", async () => {
      const file = el.importInput.files?.[0];
      if (!file) return;
      try {
        await window.ConfigState?.importConfigBundle?.(file);
        await PlatformsManager?.refresh?.(true);
        await hydrateRuntimeState(true);
        await hydrateSystemSettings(true);
        await renderDashboardState(true);
      } catch (err) {
        console.error("[Settings] Import failed", err);
        alert("Import failed: invalid configuration payload");
      }
    });

    el.platformPollingToggle?.addEventListener("change", () => {
      updatePlatformPolling(el.platformPollingToggle.checked);
    });

    wired = true;
  }

  async function hydratePlatforms() {
    if (window.PlatformsManager?.initSettingsView) {
      await window.PlatformsManager.initSettingsView();
    }
  }

  async function hydrateRuntimeState(forceReload = false) {
    try {
      runtimeSnapshot =
        (await window.ConfigState?.loadRuntimeSnapshot?.({ forceReload })) || null;
    } catch (err) {
      console.warn("[Settings] Unable to load runtime snapshot", err);
      runtimeSnapshot = null;
    }

    renderPlatformPolling();
  }

  async function hydrateSystemSettings(forceReload = false) {
    try {
      systemConfig =
        (await window.ConfigState?.loadSystem?.({ forceReload })) || null;
    } catch (err) {
      console.warn("[Settings] Unable to load system config", err);
      systemConfig = null;
    }

    renderPlatformPolling();
  }

  async function renderDashboardState(forceReload = false) {
    const state =
      (await window.ConfigState?.loadDashboardState?.({
        forceReload
      })) || null;

    const loaded = state?.last_loaded_at
      ? formatTimestamp(state.last_loaded_at)
      : "No drafts loaded";
    const exported = state?.last_export_at
      ? formatTimestamp(state.last_export_at)
      : "Not exported yet";

    if (el.dashboardState) el.dashboardState.textContent = loaded;
    if (el.dashboardExport) el.dashboardExport.textContent = exported;
  }

  function getRuntimePollingValue() {
    const value = runtimeSnapshot?.system?.platformPollingEnabled;
    return value === true || value === false ? value : null;
  }

  function getDraftPollingState() {
    const stored = systemConfig?.platform_polling_enabled;
    const hasStoredDraft = stored === true || stored === false;

    const runtimeFallback = getRuntimePollingValue();
    const valueCandidate = hasStoredDraft ? stored : runtimeFallback;
    const value = valueCandidate === true || valueCandidate === false ? valueCandidate : null;

    return { value, hasStoredDraft };
  }

  function renderPlatformPolling() {
    const runtimeValue = getRuntimePollingValue();
    const draftState = getDraftPollingState();
    const draftValue = draftState.value;

    if (el.platformPollingToggle) {
      if (draftValue === true || draftValue === false) {
        el.platformPollingToggle.checked = draftValue;
        el.platformPollingToggle.indeterminate = false;
      } else {
        el.platformPollingToggle.checked = false;
        el.platformPollingToggle.indeterminate = true;
      }
    }

    if (el.platformPollingRuntime) {
      el.platformPollingRuntime.textContent =
        runtimeValue === true
          ? "ENABLED (runtime snapshot)"
          : runtimeValue === false
            ? "DISABLED (runtime snapshot)"
            : "Unknown (runtime not reporting)";
    }

    if (el.platformPollingDraft) {
      el.platformPollingDraft.textContent =
        draftState.hasStoredDraft
          ? draftValue === true
            ? "Enabled for next start"
            : draftValue === false
              ? "Disabled for next start"
              : "Not staged (uses runtime defaults)"
          : draftValue === true
            ? "Runtime default: enabled"
            : draftValue === false
              ? "Runtime default: disabled"
              : "Not staged (uses runtime defaults)";
    }

    if (el.platformPollingNotice) {
      const needsRestart =
        draftState.hasStoredDraft && (runtimeValue === null || runtimeValue !== draftValue);
      el.platformPollingNotice.style.display = needsRestart ? "block" : "none";
    }
  }

  function updatePlatformPolling(enabled) {
    systemConfig =
      window.ConfigState?.saveSystem?.({ platform_polling_enabled: !!enabled }) || {
        platform_polling_enabled: !!enabled
      };

    renderPlatformPolling();
    renderDashboardState();
  }

  function formatTimestamp(value) {
    return (
      window.StreamSuitesState?.formatTimestamp?.(value) ||
      value ||
      "—"
    );
  }

  function destroy() {
    wired = false;
    runtimeSnapshot = null;
    systemConfig = null;
    window.PlatformsManager?.destroy?.();
  }

  window.SettingsView.init = init;
  window.SettingsView.destroy = destroy;

})();

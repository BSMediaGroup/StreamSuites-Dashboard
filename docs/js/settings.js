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

  /*
    Canonical shape (dashboard intent only):

    {
      system: {
        mode: "local" | "production",
        autosave_interval_seconds: number | null,
        verbose_logging: boolean
      },
      platform_defaults: {
        chat_cooldown_seconds: number | null,
        default_response_mode: "equals_icase" | "contains_icase",
        enable_global_chat_responses: boolean
      },
      security: {
        confirm_destructive_actions: boolean,
        read_only_mode: boolean
      },
      advanced: {
        runtime_export_format: "creators.json",
        schema_version: string
      }
    }
  */

  /* ------------------------------------------------------------
     STATE
     ------------------------------------------------------------ */

  let settings = null;

  /* ------------------------------------------------------------
     INIT
     ------------------------------------------------------------ */

  function init() {
    loadSettings();
    // Phase 1B: UI is read-only; no wiring yet
    console.info("[Settings] Loaded dashboard settings (Phase 1B)");
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

    settings = createDefaultSettings();
    persist();
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

})();

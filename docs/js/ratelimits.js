/* ============================================================
   StreamSuites Dashboard — ratelimits.js
   ============================================================

   PURPOSE:
   - Authoring + inspection surface for rate limit configuration
   - Defines the SHAPE of limits consumed by the runtime
   - NO enforcement
   - NO timers
   - NO platform assumptions

   DESIGN RULES:
   - Dashboard is configuration-only
   - Runtime is the sole enforcer
   - Everything is explicit, inspectable, exportable

   SAFE FOR:
   - GitHub Pages
   - iframe embedding (Wix)
   - Offline configuration authoring

   ============================================================ */

(() => {
  "use strict";

  /* ------------------------------------------------------------
     STORAGE
     ------------------------------------------------------------ */

  const STORAGE_KEY = "ratelimits";

  /*
    Canonical shape (authoritative intent, not behavior):

    {
      global: {
        chat_messages_per_minute: number | null,
        trigger_responses_per_minute: number | null,
        api_requests_per_minute: number | null,
        jobs_per_minute: number | null
      },
      creators: {
        [creator_id]: {
          overrides: {
            chat_messages_per_minute?: number,
            trigger_responses_per_minute?: number,
            api_requests_per_minute?: number,
            jobs_per_minute?: number
          }
        }
      },
      platforms: {
        rumble?: { ... },
        youtube?: { ... },
        twitch?: { ... }
      }
    }
  */

  /* ------------------------------------------------------------
     STATE
     ------------------------------------------------------------ */

  let ratelimits = null;

  /* ------------------------------------------------------------
     INIT
     ------------------------------------------------------------ */

  function init() {
    loadRatelimits();
    // No rendering yet — view is documentation-only in Phase 1B
    console.info("[Ratelimits] Loaded configuration (Phase 1B)");
  }

  /* ------------------------------------------------------------
     LOAD / SAVE
     ------------------------------------------------------------ */

  function loadRatelimits() {
    const stored = App.storage.loadFromLocalStorage(STORAGE_KEY, null);

    if (stored && typeof stored === "object") {
      ratelimits = stored;
      return;
    }

    // Initialize defaults if none exist
    ratelimits = createDefaultRatelimits();
    persist();
  }

  function persist() {
    App.storage.saveToLocalStorage(STORAGE_KEY, ratelimits);
  }

  /* ------------------------------------------------------------
     DEFAULT SHAPE
     ------------------------------------------------------------ */

  function createDefaultRatelimits() {
    return {
      global: {
        chat_messages_per_minute: null,
        trigger_responses_per_minute: null,
        api_requests_per_minute: null,
        jobs_per_minute: null
      },
      creators: {},
      platforms: {}
    };
  }

  /* ------------------------------------------------------------
     READ-ONLY ACCESSORS (FOR FUTURE UI)
     ------------------------------------------------------------ */

  function getRatelimits() {
    return structuredClone(ratelimits);
  }

  function getGlobalLimits() {
    return structuredClone(ratelimits.global);
  }

  function getCreatorOverrides(creatorId) {
    return structuredClone(
      ratelimits.creators?.[creatorId]?.overrides || {}
    );
  }

  function getPlatformLimits(platform) {
    return structuredClone(
      ratelimits.platforms?.[platform] || {}
    );
  }

  /* ------------------------------------------------------------
     EXPORT / IMPORT
     ------------------------------------------------------------ */

  function exportRatelimits() {
    App.storage.exportJsonToDownload(
      "streamsuites-ratelimits.json",
      ratelimits
    );
  }

  function importRatelimitsFromFile(file, onError) {
    App.storage.importJsonFromFile(file)
      .then((data) => {
        if (!validateRatelimits(data)) {
          onError?.("Invalid ratelimits file structure");
          return;
        }
        ratelimits = data;
        persist();
      })
      .catch((err) => {
        console.error("[Ratelimits] Import failed", err);
        onError?.("Failed to import ratelimits file");
      });
  }

  /* ------------------------------------------------------------
     VALIDATION (INTENTIONALLY LOOSE)
     ------------------------------------------------------------ */

  function validateRatelimits(data) {
    if (!data || typeof data !== "object") return false;
    if (!("global" in data)) return false;
    if (typeof data.global !== "object") return false;
    if ("creators" in data && typeof data.creators !== "object") return false;
    if ("platforms" in data && typeof data.platforms !== "object") return false;
    return true;
  }

  /* ------------------------------------------------------------
     PUBLIC API
     ------------------------------------------------------------ */

  window.RatelimitsView = {
    init,
    getRatelimits,
    getGlobalLimits,
    getCreatorOverrides,
    getPlatformLimits,
    exportRatelimits,
    importRatelimitsFromFile
  };

})();

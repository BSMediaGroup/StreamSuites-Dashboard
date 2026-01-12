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
     ELEMENT CACHE (READ-ONLY VISIBILITY)
     ------------------------------------------------------------ */

  const el = {};

  function cacheElements() {
    const rows = document.querySelectorAll(".ss-quota-row");

    if (rows.length >= 2) {
      el.daily = {
        fill: rows[0].querySelector(".ss-quota-fill"),
        label: rows[0].querySelector(".ss-quota-label span.muted")
      };

      el.minute = {
        fill: rows[1].querySelector(".ss-quota-fill"),
        label: rows[1].querySelector(".ss-quota-label span.muted")
      };
    }
  }

  function isRuntimeAvailable() {
    return window.__RUNTIME_AVAILABLE__ === true;
  }

  function renderRuntimeDisconnected() {
    const placeholder = "Runtime not connected";
    if (el.daily?.fill) {
      el.daily.fill.style.width = "0%";
      el.daily.fill.classList.remove("warn", "danger");
    }
    if (el.daily?.label) {
      setText(el.daily.label, placeholder);
    }
    if (el.minute?.label) {
      setText(el.minute.label, placeholder);
    }
  }

  /* ------------------------------------------------------------
     INIT
     ------------------------------------------------------------ */

  function init() {
    cacheElements();
    if (!isRuntimeAvailable()) {
      renderRuntimeDisconnected();
      return;
    }
    loadRatelimits();
    hydrateQuotaVisibility(); // READ-ONLY
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
     QUOTA VISIBILITY (READ-ONLY, RUNTIME-SOURCED)
     ------------------------------------------------------------ */

  function hydrateQuotaVisibility() {
    if (
      !window.StreamSuitesState?.loadQuotasSnapshot ||
      !el.daily?.fill
    ) {
      hydrateQuotaFallback();
      return;
    }

    Promise.resolve(window.StreamSuitesState.loadQuotasSnapshot())
      .then((snapshots) => {
        if (!Array.isArray(snapshots)) {
          hydrateQuotaFallback();
          return;
        }

        const yt = snapshots.find((q) => q.platform === "youtube");
        if (!yt) {
          hydrateQuotaFallback();
          return;
        }

        animateQuotaBar(el.daily.fill, yt.used, yt.max);
        setText(
          el.daily.label,
          `${yt.used.toLocaleString()} / ${yt.max.toLocaleString()}`
        );

        setText(el.minute.label, "runtime reported");
      })
      .catch(() => hydrateQuotaFallback());
  }

  function hydrateQuotaFallback() {
    const DAILY_MAX = 200000;
    const simulatedUsed = 82000;

    if (el.daily?.fill) {
      animateQuotaBar(el.daily.fill, simulatedUsed, DAILY_MAX);
    }

    if (el.daily?.label) {
      setText(
        el.daily.label,
        `${simulatedUsed.toLocaleString()} / ${DAILY_MAX.toLocaleString()}`
      );
    }

    if (el.minute?.label) {
      setText(el.minute.label, "not enforced");
    }
  }

  /* ------------------------------------------------------------
     VISUALS ONLY (NO LOGIC)
     ------------------------------------------------------------ */

  function animateQuotaBar(fillEl, used, max) {
    if (!fillEl || !max) return;

    const percent = Math.min((used / max) * 100, 100);

    fillEl.classList.remove("warn", "danger");
    fillEl.style.transition = "none";
    fillEl.style.width = "0%";

    void fillEl.offsetWidth;

    fillEl.style.transition =
      "width 1200ms cubic-bezier(0.19, 1, 0.22, 1)";
    fillEl.style.width = percent + "%";

    if (used >= max) {
      fillEl.classList.add("danger");
    } else if (used >= max - 10000) {
      fillEl.classList.add("danger");
    } else if (used >= max - 50000) {
      fillEl.classList.add("warn");
    }
  }

  function setText(target, value) {
    if (!target) return;
    target.textContent = value;
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

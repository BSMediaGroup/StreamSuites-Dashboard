(() => {
  "use strict";

  const PLATFORM = "youtube";
  const REFRESH_INTERVAL = 6000;

  const el = {};
  let runtimeTimer = null;

  /* ============================================================
     ELEMENT CACHE
     ============================================================ */

  function cacheElements() {
    el.foundationStatus = document.getElementById("yt-foundation-status");
    el.runtimeBanner = document.getElementById("yt-runtime-banner");
    el.runtimeStatus = document.getElementById("yt-runtime-status");
    el.runtimeUpdated = document.getElementById("yt-runtime-updated");
    el.runtimeError = document.getElementById("yt-runtime-error");
    el.runtimeMessages = document.getElementById("yt-runtime-messages");
    el.runtimeTriggers = document.getElementById("yt-runtime-triggers");

    el.configEnabled = document.getElementById("yt-config-enabled");
    el.configChannel = document.getElementById("yt-config-channel");
    el.configBot = document.getElementById("yt-config-bot");
    el.configSource = document.getElementById("yt-config-source");

    /* API quota bars */
    el.quotaDailyFill = document.querySelector(
      ".ss-quota-row .ss-quota-fill"
    );
    el.quotaMinuteFill = document.querySelectorAll(
      ".ss-quota-row .ss-quota-fill"
    )[1];

    /* Quota labels */
    el.quotaDailyLabel = document.querySelector(
      ".ss-quota-row .ss-quota-label span.muted"
    );
  }

  /* ============================================================
     UTILITIES
     ============================================================ */

  function setText(target, value) {
    if (!target) return;
    target.textContent = value;
  }

  function formatTimestamp(value) {
    return (
      window.StreamSuitesState?.formatTimestamp?.(value) ||
      value ||
      "not reported"
    );
  }

  function getStorage() {
    if (
      typeof window.App === "object" &&
      window.App?.storage &&
      typeof window.App.storage.loadFromLocalStorage === "function"
    ) {
      return window.App.storage;
    }
    return null;
  }

  /* ============================================================
     CONFIG DESCRIPTION HELPERS
     ============================================================ */

  function describeEnabled(creators, platformConfig) {
    if (platformConfig && platformConfig.enabled === false) {
      return "disabled globally";
    }

    if (!Array.isArray(creators) || creators.length === 0) {
      return "disabled (no creators configured)";
    }

    const youtubeCreators = creators.filter((creator) => {
      const youtube = creator?.platforms?.youtube;
      return youtube === true || youtube?.enabled === true;
    });

    if (youtubeCreators.length === 0) {
      return "disabled (no YouTube flags set)";
    }

    return `enabled for ${youtubeCreators.length} creator${
      youtubeCreators.length > 1 ? "s" : ""
    }`;
  }

  function describeChannel(creators, platformConfig) {
    if (platformConfig && platformConfig.enabled === false) {
      return "disabled globally";
    }

    if (!Array.isArray(creators) || creators.length === 0) {
      return "not configured";
    }

    const youtubeCreator = creators.find((creator) => {
      const youtube = creator?.platforms?.youtube;
      return youtube === true || youtube?.enabled === true;
    });

    if (!youtubeCreator) return "not configured";

    const youtube = youtubeCreator.platforms?.youtube || {};
    return (
      youtube.channel_handle ||
      youtube.handle ||
      youtube.channel ||
      youtube.channel_id ||
      youtubeCreator.display_name ||
      "not configured"
    );
  }

  function describeBot(creators, platformConfig) {
    if (platformConfig && platformConfig.enabled === false) {
      return "disabled globally";
    }

    if (!Array.isArray(creators) || creators.length === 0) {
      return "not configured";
    }

    const youtubeCreator = creators.find((creator) => {
      const youtube = creator?.platforms?.youtube;
      return youtube === true || youtube?.enabled === true;
    });

    if (!youtubeCreator) return "not configured";

    const youtube = youtubeCreator.platforms?.youtube || {};
    return (
      youtube.bot_identity ||
      youtube.bot ||
      youtubeCreator.bot_identity ||
      "not configured"
    );
  }

  /* ============================================================
     LOCAL CONFIG HYDRATION
     ============================================================ */

  async function loadCreatorsDraft() {
    try {
      return (
        (await window.ConfigState?.loadCreators?.()) ||
        []
      );
    } catch (err) {
      const storage = getStorage();
      const creators = storage?.loadFromLocalStorage?.("creators", []);
      return Array.isArray(creators) ? creators : [];
    }
  }

  async function hydrateConfig() {
    const creatorsArr = await loadCreatorsDraft();
    const platforms =
      (await window.ConfigState?.loadPlatforms?.()) || null;
    const platformConfig = platforms?.platforms?.[PLATFORM];

    setText(el.configEnabled, describeEnabled(creatorsArr, platformConfig));
    setText(el.configChannel, describeChannel(creatorsArr, platformConfig));
    setText(el.configBot, describeBot(creatorsArr, platformConfig));
    setText(
      el.configSource,
      platformConfig && platformConfig.enabled === false
        ? "disabled globally"
        : creatorsArr.length
          ? "local creators config"
          : "no creators loaded"
    );
  }

  /* ============================================================
     RUNTIME SNAPSHOT RENDERING
     ============================================================ */

  function describeRuntimeStatus(entry) {
    if (!entry) return "no runtime snapshot";
    if (entry.enabled === false) return "disabled";
    return entry.status || "unknown";
  }

  function hydrateRuntimePlaceholder() {
    setText(el.runtimeStatus, "offline / unknown");
    setText(el.runtimeUpdated, "no runtime snapshot");
    setText(el.runtimeError, "not reported");
    setText(el.runtimeMessages, "—");
    setText(el.runtimeTriggers, "—");

    if (el.runtimeBanner) {
      el.runtimeBanner.classList.add("ss-alert-danger");
      el.runtimeBanner.classList.remove("hidden");
      setText(
        el.runtimeBanner,
        "No runtime connected. StreamSuites runtime exports will hydrate this view when available."
      );
    }
  }

  function renderRuntime(snapshot) {
    const platform = snapshot?.platforms?.[PLATFORM] || null;

    const status = describeRuntimeStatus(platform);
    setText(el.runtimeStatus, status.toUpperCase());

    const updated = formatTimestamp(
      platform?.lastUpdate || snapshot?.generatedAt
    );
    setText(el.runtimeUpdated, updated);

    setText(
      el.runtimeError,
      platform?.error || "none reported"
    );

    const counters = platform?.counters || {};
    const messages = counters.messagesProcessed ?? counters.messages ?? null;
    const triggers = counters.triggersFired ?? counters.triggers ?? null;

    setText(
      el.runtimeMessages,
      Number.isFinite(messages) ? messages.toLocaleString() : "—"
    );
    setText(
      el.runtimeTriggers,
      Number.isFinite(triggers) ? triggers.toLocaleString() : "—"
    );

    if (el.runtimeBanner) {
      el.runtimeBanner.classList.remove("ss-alert-danger", "ss-alert-success");
      el.runtimeBanner.classList.add(
        status && status.toLowerCase() === "running" ? "ss-alert-success" : "ss-alert-warning"
      );
      setText(
        el.runtimeBanner,
        "Read-only preview sourced from runtime exports (shared/state → data fallback)."
      );
    }
  }

  async function hydrateRuntime() {
    const snapshot = await window.StreamSuitesState?.loadRuntimeSnapshot?.();
    if (!snapshot || !snapshot.platforms) {
      hydrateRuntimePlaceholder();
      return;
    }

    renderRuntime(snapshot);
  }

  function startRuntimePolling() {
    hydrateRuntime();
    runtimeTimer = setInterval(hydrateRuntime, REFRESH_INTERVAL);
  }

  /* ============================================================
     API QUOTA (RUNTIME-AWARE)
     ============================================================ */

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
    } else if (used >= max * 0.75) {
      fillEl.classList.add("warn");
    }
  }

  async function hydrateQuotaFromRuntime() {
    const snapshots = await window.StreamSuitesState?.loadQuotasSnapshot?.();
    if (!Array.isArray(snapshots)) return false;

    const yt = snapshots.find(
      (q) => q.platform === PLATFORM
    );

    if (!yt) return false;

    animateQuotaBar(el.quotaDailyFill, yt.used, yt.max);

    if (el.quotaDailyLabel) {
      setText(
        el.quotaDailyLabel,
        `${yt.used.toLocaleString()} / ${yt.max.toLocaleString()}`
      );
    }

    return true;
  }

  function updateQuotaFallback() {
    /* DEV fallback */
    const DAILY_MAX = 200000;
    const simulatedDailyUsed = 82000;
    const simulatedPerMinuteUsed = 120;

    animateQuotaBar(el.quotaDailyFill, simulatedDailyUsed, DAILY_MAX);
    animateQuotaBar(el.quotaMinuteFill, simulatedPerMinuteUsed, 1000);

    if (el.quotaDailyLabel) {
      setText(
        el.quotaDailyLabel,
        `${simulatedDailyUsed.toLocaleString()} / ${DAILY_MAX.toLocaleString()}`
      );
    }
  }

  /* ============================================================
     VIEW LIFECYCLE
     ============================================================ */

  function setFoundationStatus() {
    if (!el.foundationStatus) return;
    el.foundationStatus.classList.remove("idle");
    el.foundationStatus.classList.add("active");
    el.foundationStatus.textContent = "● YouTube integration: Scaffold";
  }

  async function init() {
    cacheElements();
    setFoundationStatus();
    await hydrateConfig();
    hydrateRuntimePlaceholder();
    startRuntimePolling();

    const hydrated = await hydrateQuotaFromRuntime();
    if (!hydrated) updateQuotaFallback();
  }

  function destroy() {
    if (runtimeTimer) {
      clearInterval(runtimeTimer);
      runtimeTimer = null;
    }
  }

  window.YouTubeView = {
    init,
    destroy
  };
})();

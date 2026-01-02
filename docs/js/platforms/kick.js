(() => {
  "use strict";

  const PLATFORM = "kick";
  const REFRESH_INTERVAL = 6000;

  const el = {};
  let runtimeTimer = null;

  function cacheElements() {
    el.foundationStatus = document.getElementById("kick-foundation-status");
    el.runtimeBanner = document.getElementById("kick-runtime-banner");
    el.runtimeStatus = document.getElementById("kick-runtime-status");
    el.runtimeUpdated = document.getElementById("kick-runtime-updated");
    el.runtimeError = document.getElementById("kick-runtime-error");
    el.runtimeMessages = document.getElementById("kick-runtime-messages");
    el.runtimeTriggers = document.getElementById("kick-runtime-triggers");

    el.configEnabled = document.getElementById("kick-config-enabled");
    el.configChannel = document.getElementById("kick-config-channel");
    el.configBot = document.getElementById("kick-config-bot");
    el.configSource = document.getElementById("kick-config-source");
  }

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

  function describeEnabled(creators, platformConfig) {
    if (platformConfig && platformConfig.enabled === false) {
      return "disabled globally";
    }

    if (!Array.isArray(creators) || creators.length === 0) {
      return "disabled (no creators configured)";
    }

    const kickCreators = creators.filter((creator) => {
      const kick = creator?.platforms?.kick;
      return kick === true || kick?.enabled === true;
    });

    if (kickCreators.length === 0) {
      return "disabled (no Kick flags set)";
    }

    return `enabled for ${kickCreators.length} creator${kickCreators.length > 1 ? "s" : ""}`;
  }

  function describeChannel(creators, platformConfig) {
    if (platformConfig && platformConfig.enabled === false) {
      return "disabled globally";
    }

    if (!Array.isArray(creators) || creators.length === 0) {
      return "not configured";
    }

    const kickCreator = creators.find((creator) => {
      const kick = creator?.platforms?.kick;
      return kick === true || kick?.enabled === true;
    });

    if (!kickCreator) {
      return "not configured";
    }

    const kick = kickCreator.platforms?.kick || {};

    const channel =
      kick.channel ||
      kick.channel_login ||
      kickCreator.kick_channel ||
      kickCreator.kick_channel_login ||
      kickCreator.kick_username ||
      kickCreator.kick_user ||
      kickCreator.display_name;

    if (!channel) {
      return "not configured";
    }

    return channel;
  }

  function describeBot(creators) {
    if (!Array.isArray(creators) || creators.length === 0) return "not configured";

    const kickCreator = creators.find((creator) => {
      const kick = creator?.platforms?.kick;
      return kick === true || kick?.enabled === true;
    });

    if (!kickCreator) return "not configured";

    return (
      kickCreator.kick_bot ||
      kickCreator.kick_bot_name ||
      kickCreator.bot ||
      kickCreator.bot_name ||
      "not configured"
    );
  }

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
    const platformConfig = platforms?.platforms?.kick;

    setText(el.configEnabled, describeEnabled(creatorsArr, platformConfig));
    setText(el.configChannel, describeChannel(creatorsArr, platformConfig));
    setText(el.configBot, describeBot(creatorsArr));
    setText(
      el.configSource,
      platformConfig && platformConfig.enabled === false
        ? "disabled globally"
        : creatorsArr.length > 0
          ? "local creators config"
          : "no creators loaded"
    );
  }

  function hydrateRuntimePlaceholder() {
    setText(el.runtimeStatus, "awaiting snapshot");
    setText(el.runtimeUpdated, "no runtime snapshot yet");
    setText(el.runtimeError, "not reported");
    setText(el.runtimeMessages, "—");
    setText(el.runtimeTriggers, "—");

    if (el.runtimeBanner) {
      el.runtimeBanner.classList.add("ss-alert-danger");
      el.runtimeBanner.classList.remove("hidden");
      setText(
        el.runtimeBanner,
        "Monitoring resumes as runtime snapshots arrive. This view stays read-only and mirrors runtime exports."
      );
    }
  }

  function describeRuntimeStatus(entry) {
    if (!entry) return "no runtime snapshot";
    if (entry.enabled === false) return "disabled";
    return entry.status || "unknown";
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
    const snapshot = await window.StreamSuitesState?.loadRuntimeSnapshot?.({
      forceReload: true
    });
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

  function setFoundationStatus() {
    if (!el.foundationStatus) return;
    el.foundationStatus.classList.remove("idle");
    el.foundationStatus.classList.add("active");
    el.foundationStatus.textContent = "● Kick integration: Scaffold";
  }

  async function init() {
    cacheElements();
    setFoundationStatus();
    await hydrateConfig();
    hydrateRuntimePlaceholder();
    startRuntimePolling();
  }

  function destroy() {
    if (runtimeTimer) {
      clearInterval(runtimeTimer);
      runtimeTimer = null;
    }
  }

  window.KickView = {
    init,
    destroy
  };
})();

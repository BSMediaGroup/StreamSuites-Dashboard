(() => {
  "use strict";

  const PLATFORM = "twitch";
  const REFRESH_INTERVAL = 6000;

  const el = {};
  let runtimeTimer = null;

  function cacheElements() {
    el.foundationStatus = document.getElementById("tw-foundation-status");
    el.runtimeBanner = document.getElementById("tw-runtime-banner");
    el.runtimeStatus = document.getElementById("tw-runtime-status");
    el.runtimeUpdated = document.getElementById("tw-runtime-updated");
    el.runtimeError = document.getElementById("tw-runtime-error");
    el.runtimeMessages = document.getElementById("tw-runtime-messages");
    el.runtimeTriggers = document.getElementById("tw-runtime-triggers");

    el.configEnabled = document.getElementById("tw-config-enabled");
    el.configChannel = document.getElementById("tw-config-channel");
    el.configSource = document.getElementById("tw-config-source");
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

    const twitchCreators = creators.filter((creator) => {
      const twitch = creator?.platforms?.twitch;
      return twitch === true || twitch?.enabled === true;
    });

    if (twitchCreators.length === 0) {
      return "disabled (no Twitch flags set)";
    }

    return `enabled for ${twitchCreators.length} creator${twitchCreators.length > 1 ? "s" : ""}`;
  }

  function describeChannel(creators, platformConfig) {
    if (platformConfig && platformConfig.enabled === false) {
      return "disabled globally";
    }

    if (!Array.isArray(creators) || creators.length === 0) {
      return "not configured";
    }

    const twitchCreator = creators.find((creator) => {
      const twitch = creator?.platforms?.twitch;
      return twitch === true || twitch?.enabled === true;
    });

    if (!twitchCreator) {
      return "not configured";
    }

    const twitch = twitchCreator.platforms?.twitch || {};

    const channel =
      twitch.channel ||
      twitch.channel_login ||
      twitchCreator.twitch_channel ||
      twitchCreator.twitch_channel_login ||
      twitchCreator.twitch_username ||
      twitchCreator.twitch_user ||
      twitchCreator.display_name;

    if (!channel) {
      return "not configured";
    }

    return channel;
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
    const platformConfig = platforms?.platforms?.twitch;

    setText(el.configEnabled, describeEnabled(creatorsArr, platformConfig));
    setText(el.configChannel, describeChannel(creatorsArr, platformConfig));
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
    el.foundationStatus.textContent = "● Twitch integration: Foundation";
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

  window.TwitchView = {
    init,
    destroy
  };
})();

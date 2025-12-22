(() => {
  "use strict";

  const el = {};

  function cacheElements() {
    el.foundationStatus = document.getElementById("tw-foundation-status");
    el.runtimeBanner = document.getElementById("tw-runtime-banner");
    el.runtimeStatus = document.getElementById("tw-runtime-status");
    el.runtimeHeartbeat = document.getElementById("tw-runtime-heartbeat");
    el.runtimeLastMessage = document.getElementById("tw-runtime-last-message");

    el.configEnabled = document.getElementById("tw-config-enabled");
    el.configChannel = document.getElementById("tw-config-channel");
    el.configSource = document.getElementById("tw-config-source");
  }

  function setText(target, value) {
    if (!target) return;
    target.textContent = value;
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
    setText(el.runtimeStatus, "offline / unknown");
    setText(el.runtimeHeartbeat, "no runtime snapshot");
    setText(el.runtimeLastMessage, "no runtime snapshot");

    if (el.runtimeBanner) {
      el.runtimeBanner.classList.add("ss-alert-danger");
      el.runtimeBanner.classList.remove("hidden");
      setText(
        el.runtimeBanner,
        "No runtime connected. StreamSuites runtime exports will hydrate this view when available."
      );
    }
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
  }

  function destroy() {
    // No intervals or listeners to clean up yet.
  }

  window.TwitchView = {
    init,
    destroy
  };
})();

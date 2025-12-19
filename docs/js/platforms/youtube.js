(() => {
  "use strict";

  const el = {};

  function cacheElements() {
    el.foundationStatus = document.getElementById("yt-foundation-status");
    el.runtimeBanner = document.getElementById("yt-runtime-banner");
    el.runtimeStatus = document.getElementById("yt-runtime-status");
    el.runtimeStream = document.getElementById("yt-runtime-stream");
    el.runtimeHeartbeat = document.getElementById("yt-runtime-heartbeat");
    el.runtimeLastMessage = document.getElementById("yt-runtime-last-message");

    el.configEnabled = document.getElementById("yt-config-enabled");
    el.configChannel = document.getElementById("yt-config-channel");
    el.configBot = document.getElementById("yt-config-bot");
    el.configSource = document.getElementById("yt-config-source");
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

  function describeEnabled(creators) {
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

    return `enabled for ${youtubeCreators.length} creator${youtubeCreators.length > 1 ? "s" : ""}`;
  }

  function describeChannel(creators) {
    if (!Array.isArray(creators) || creators.length === 0) {
      return "not configured";
    }

    const youtubeCreator = creators.find((creator) => {
      const youtube = creator?.platforms?.youtube;
      return youtube === true || youtube?.enabled === true;
    });

    if (!youtubeCreator) {
      return "not configured";
    }

    const youtube = youtubeCreator.platforms?.youtube || {};

    const handle =
      youtube.channel_handle ||
      youtube.handle ||
      youtube.channel ||
      youtube.channel_id ||
      youtubeCreator.youtube_channel ||
      youtubeCreator.youtube_handle ||
      youtubeCreator.display_name;

    if (!handle) {
      return "not configured";
    }

    return handle;
  }

  function describeBot(creators) {
    if (!Array.isArray(creators) || creators.length === 0) {
      return "not configured";
    }

    const youtubeCreator = creators.find((creator) => {
      const youtube = creator?.platforms?.youtube;
      return youtube === true || youtube?.enabled === true;
    });

    if (!youtubeCreator) {
      return "not configured";
    }

    const youtube = youtubeCreator.platforms?.youtube || {};
    const bot =
      youtube.bot_identity ||
      youtube.bot ||
      youtubeCreator.youtube_bot ||
      youtubeCreator.bot_identity;

    if (!bot) {
      return "not configured";
    }

    return bot;
  }

  function hydrateConfig() {
    const storage = getStorage();
    if (!storage) {
      setText(el.configEnabled, "not available");
      setText(el.configChannel, "not available");
      setText(el.configBot, "not available");
      setText(el.configSource, "no storage access");
      return;
    }

    const creators = storage.loadFromLocalStorage("creators", []);
    const creatorsArr = Array.isArray(creators) ? creators : [];

    setText(el.configEnabled, describeEnabled(creatorsArr));
    setText(el.configChannel, describeChannel(creatorsArr));
    setText(el.configBot, describeBot(creatorsArr));
    setText(el.configSource, creatorsArr.length > 0 ? "local creators config" : "no creators loaded");
  }

  function hydrateRuntimePlaceholder() {
    setText(el.runtimeStatus, "offline / unknown");
    setText(el.runtimeStream, "no runtime snapshot");
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
    el.foundationStatus.textContent = "● YouTube integration: Scaffold";
  }

  function init() {
    cacheElements();
    setFoundationStatus();
    hydrateConfig();
    hydrateRuntimePlaceholder();
  }

  function destroy() {
    // No intervals or listeners to clean up yet.
  }

  window.YouTubeView = {
    init,
    destroy
  };
})();

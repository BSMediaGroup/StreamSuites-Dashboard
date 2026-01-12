(() => {
  "use strict";

  const PLATFORM = "kick";
  const REFRESH_INTERVAL = 6000;

  const el = {};
  let runtimeTimer = null;
  let runtimePollingLogged = false;
  let currentMode = null;
  let lastRuntimeSnapshot = null;
  let lastRuntimeSource = null;
  let modeListener = null;

  function cacheElements() {
    el.foundationStatus = document.getElementById("kick-foundation-status");
    el.runtimeBanner = document.getElementById("kick-runtime-banner");
    el.runtimeStatus = document.getElementById("kick-runtime-status");
    el.runtimeEnabled = document.getElementById("kick-runtime-enabled");
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
    lastRuntimeSnapshot = null;
    lastRuntimeSource = null;
    setText(el.runtimeStatus, "awaiting snapshot");
    setText(el.runtimeEnabled, "unknown");
    setText(el.runtimeUpdated, "no runtime snapshot yet");
    setText(el.runtimeError, "not reported");
    setText(el.runtimeMessages, "—");
    setText(el.runtimeTriggers, "—");

    if (el.runtimeBanner) {
      el.runtimeBanner.classList.add("ss-alert-danger");
      el.runtimeBanner.classList.remove("hidden");
      setText(
        el.runtimeBanner,
        `Monitoring resumes as runtime snapshots arrive. This view stays read-only and mirrors runtime exports (${currentMode?.current || "static"} mode).`
      );
    }
  }

  function describeRuntimeStatus(entry) {
    if (!entry) return "not exported";
    if (entry.enabled === false) return "disabled";
    if (entry.paused) return "paused";
    return entry.status || entry.state || "unknown";
  }

  function selectPlatform(snapshot) {
    if (!snapshot || !snapshot.platforms) return null;
    if (Array.isArray(snapshot.platforms)) {
      return snapshot.platforms.find((p) => p.platform === PLATFORM || p.name === PLATFORM) || null;
    }
    return snapshot.platforms[PLATFORM] || null;
  }

  function resolveCounterValue(counters, keys) {
    for (const key of keys) {
      if (typeof counters[key] === "number") return counters[key];
    }
    return null;
  }

  function renderRuntime(snapshot, sourceLabel = "") {
    const normalized = window.StreamSuitesState?.normalizeRuntimeSnapshot?.(snapshot);
    if (!normalized) {
      hydrateRuntimePlaceholder();
      return;
    }

    const platform = selectPlatform(normalized);
    if (!platform) {
      hydrateRuntimePlaceholder();
      return;
    }

    const enabledState = platform.enabled;
    setText(
      el.runtimeEnabled,
      enabledState === true
        ? "ENABLED"
        : enabledState === false
          ? "DISABLED"
          : "NOT REPORTED"
    );

    const status = describeRuntimeStatus(platform);
    setText(el.runtimeStatus, status.toUpperCase());

    const updated = formatTimestamp(
      platform?.lastUpdate || platform?.heartbeat || normalized?.generatedAt
    );
    setText(el.runtimeUpdated, updated);

    setText(
      el.runtimeError,
      platform?.error || platform?.pausedReason || "none reported"
    );

    const counters = platform?.counters || {};
    const messages = resolveCounterValue(counters, [
      "messagesProcessed",
      "messages_processed",
      "messages"
    ]);
    const triggers = resolveCounterValue(counters, [
      "triggersFired",
      "triggers_fired",
      "triggers"
    ]);

    setText(
      el.runtimeMessages,
      Number.isFinite(messages) ? messages.toLocaleString() : "—"
    );
    setText(
      el.runtimeTriggers,
      Number.isFinite(triggers) ? triggers.toLocaleString() : "—"
    );

    const modeLabel = currentMode?.current || "static";
    const sourceNote = sourceLabel || window.App?.state?.runtimeSnapshot?.lastSource || "runtime export";

    if (el.runtimeBanner) {
      el.runtimeBanner.classList.remove("ss-alert-danger", "ss-alert-success");
      el.runtimeBanner.classList.add(
        status && status.toLowerCase() === "running" ? "ss-alert-success" : "ss-alert-warning"
      );
      setText(
        el.runtimeBanner,
        `Read-only preview sourced from runtime exports (${sourceNote}). Mode: ${modeLabel}.`
      );
    }
  }

  function lockControls() {
    const scope = document.getElementById("view-container");
    if (!scope) return;

    scope.querySelectorAll("input, select, textarea, button").forEach((node) => {
      node.disabled = true;
      node.setAttribute("aria-disabled", "true");
    });
  }

  async function hydrateRuntime() {
    const runtimeState = window.App?.state?.runtimeSnapshot;

    if (runtimeState?.fetchOnce && !runtimeState.getSnapshot?.()) {
      await runtimeState.fetchOnce();
    }

    let snapshot = runtimeState?.getSnapshot?.();
    let sourceLabel = runtimeState?.lastSource || "";

    if (!snapshot || !snapshot.platforms) {
      try {
        snapshot = await window.StreamSuitesState?.loadRuntimeSnapshot?.({ forceReload: true });
        sourceLabel = sourceLabel || "data/runtime_snapshot.json";
      } catch (err) {
        console.warn("[KickView] Runtime snapshot load failed", err);
      }
    }

    if (!snapshot || !snapshot.platforms) {
      hydrateRuntimePlaceholder();
      return;
    }

    lastRuntimeSnapshot = snapshot;
    lastRuntimeSource = sourceLabel || null;
    renderRuntime(snapshot, sourceLabel);
  }

  function startRuntimePolling() {
    if (window.__RUNTIME_AVAILABLE__ !== true) {
      if (!runtimePollingLogged) {
        console.info("[Dashboard] Runtime unavailable. Polling disabled.");
        runtimePollingLogged = true;
      }
      return;
    }
    hydrateRuntime();
    runtimeTimer = setInterval(hydrateRuntime, REFRESH_INTERVAL);
  }

  function setFoundationStatus() {
    if (!el.foundationStatus) return;
    el.foundationStatus.classList.remove("idle");
    el.foundationStatus.classList.add("active");
    el.foundationStatus.textContent = "● Kick integration: Scaffold";
  }

  function onModeChange(modeState) {
    currentMode = modeState || currentMode;
    if (lastRuntimeSnapshot) {
      renderRuntime(lastRuntimeSnapshot, lastRuntimeSource);
    } else {
      hydrateRuntimePlaceholder();
    }
  }

  async function init(modeState) {
    cacheElements();
    currentMode = modeState || window.App?.mode || { current: "static", reason: "static-first default" };
    setFoundationStatus();
    lockControls();
    if (!modeListener) {
      modeListener = (event) => onModeChange(event.detail);
      window.addEventListener("streamsuites:modechange", modeListener);
    }
    await hydrateConfig();
    hydrateRuntimePlaceholder();
    startRuntimePolling();
  }

  function destroy() {
    if (runtimeTimer) {
      clearInterval(runtimeTimer);
      runtimeTimer = null;
    }

    if (modeListener) {
      window.removeEventListener("streamsuites:modechange", modeListener);
      modeListener = null;
    }
  }

  window.KickView = {
    init,
    destroy,
    onModeChange
  };
})();

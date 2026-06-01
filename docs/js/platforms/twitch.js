(() => {
  "use strict";

  const PLATFORM = "twitch";
  const REFRESH_INTERVAL = 6000;

  const el = {};
  let runtimeTimer = null;
  let runtimePollingLogged = false;

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
    el.liveStatusBanner = document.getElementById("tw-live-status-banner");
    el.liveStatusSummary = document.getElementById("tw-live-status-summary");
    el.liveStatusRefresh = document.getElementById("tw-live-status-refresh");
    el.liveStatusScan = document.getElementById("tw-live-status-scan");
    el.authBot = document.getElementById("tw-auth-bot");
    el.authBroadcaster = document.getElementById("tw-auth-broadcaster");
    el.authBanner = document.getElementById("tw-auth-banner");
    el.authConfig = document.getElementById("tw-auth-config");
    el.authBotStatus = document.getElementById("tw-auth-bot-status");
    el.authBroadcasterStatus = document.getElementById("tw-auth-broadcaster-status");
    el.authScopes = document.getElementById("tw-auth-scopes");
  }

  function setText(target, value) {
    if (!target) return;
    target.textContent = value;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  async function hydrateLiveStatusScaffold() {
    if (!el.liveStatusBanner) return;
    try {
      const payload = await window.StreamSuitesApi?.apiFetch?.("/api/admin/live-status/diagnostics?platform=twitch", {
        forceRefresh: true,
        timeoutMs: 6000
      });
      const provider = payload?.providers?.twitch || {};
      setText(el.liveStatusBanner, provider.manual_scan_disabled_reason || provider.last_error || "Twitch live fetching diagnostics loaded.");
      if (el.liveStatusSummary) {
        el.liveStatusSummary.innerHTML = `
          <span class="ss-chip ${provider.implemented ? "ss-chip-success" : "ss-chip-warning"}">${escapeHtml(provider.implemented ? "Runtime wired" : "Partial")}</span>
          <span class="ss-chip ss-chip-muted">${escapeHtml((provider.blockers || provider.last_error || ["No blockers reported"]).join ? (provider.blockers || ["No blockers reported"]).join(", ") : String(provider.last_error || "No blockers reported"))}</span>
        `;
      }
    } catch (err) {
      setText(el.liveStatusBanner, "Runtime/Auth diagnostics endpoint unavailable; Twitch controls remain disabled.");
    }
    if (el.liveStatusScan) el.liveStatusScan.disabled = false;
  }

  function updateAuthLinks() {
    const base = window.StreamSuitesApi?.getApiBase?.() || "https://api.streamsuites.app";
    const returnTo = encodeURIComponent(`${window.location.origin}/integrations/twitch`);
    if (el.authBot) {
      el.authBot.href = `${base}/auth/twitch/start?purpose=bot&surface=admin&return_to=${returnTo}`;
    }
    if (el.authBroadcaster) {
      el.authBroadcaster.href = `${base}/auth/twitch/start?purpose=broadcaster&surface=admin&return_to=${returnTo}`;
    }
  }

  function findTwitchPlatform(payload) {
    const rows = Array.isArray(payload?.platforms) ? payload.platforms : [];
    return rows.find((row) => String(row?.platform || "").toLowerCase() === PLATFORM) || null;
  }

  function findTwitchBot(payload) {
    const rows = Array.isArray(payload?.bots) ? payload.bots : [];
    return rows.find((row) => String(row?.platform || "").toLowerCase() === PLATFORM) || null;
  }

  function renderBotStatus(payload) {
    const platform = findTwitchPlatform(payload);
    const bot = findTwitchBot(payload);
    const caps = payload?.platform_capabilities?.twitch || {};
    const details = platform?.details || {};
    const readiness = bot?.credential_readiness || bot?.credentialReadiness || {};
    const missingBotScopes = readiness?.missing_bot_scopes || readiness?.missingBotScopes || [];
    const missingBroadcasterScopes = readiness?.missing_broadcaster_scopes || readiness?.missingBroadcasterScopes || [];
    setText(el.authConfig, caps.available === false ? "not configured" : "configured / partially configured");
    setText(el.authBotStatus, bot?.dispatch_ready ? "authorized" : bot?.status || platform?.status || "not authorized");
    setText(
      el.authBroadcasterStatus,
      bot?.subscription_status === "subscribed" || bot?.subscription_status === "pending"
        ? bot.subscription_status
        : details.subscription_status || "not reported"
    );
    const missing = [...missingBotScopes, ...missingBroadcasterScopes].filter(Boolean);
    setText(el.authScopes, missing.length ? missing.join(", ") : "none reported");
    if (el.authBanner) {
      el.authBanner.classList.remove("ss-alert-danger", "ss-alert-success", "ss-alert-warning");
      const ready = bot?.dispatch_ready || bot?.subscription_status === "subscribed";
      el.authBanner.classList.add(ready ? "ss-alert-success" : "ss-alert-warning");
      setText(
        el.authBanner,
        ready
          ? "Twitch EventSub/API posture is available from Runtime/Auth."
          : (bot?.status_reason || platform?.error || "Authorize bot and broadcaster scopes before deploying Twitch chat.")
      );
    }
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
    if (window.__STREAMSUITES_RUNTIME_OFFLINE__) {
      hydrateRuntimePlaceholder();
      return;
    }

    let botPayload = null;
    try {
      botPayload = await window.StreamSuitesApi?.apiFetch?.("/api/admin/bots/status", {
        forceRefresh: true,
        timeoutMs: 6000
      });
      renderBotStatus(botPayload);
    } catch (err) {
      setText(el.authBanner, "Runtime/Auth bot status API unavailable.");
    }

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
    if (window.__STREAMSUITES_RUNTIME_OFFLINE__) {
      hydrateRuntimePlaceholder();
      return;
    }

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
    el.foundationStatus.textContent = "● Twitch integration: EventSub / API";
  }

  function init() {
    cacheElements();
    setFoundationStatus();
    updateAuthLinks();
    el.liveStatusRefresh?.addEventListener("click", hydrateLiveStatusScaffold);
    el.liveStatusScan?.addEventListener("click", async () => {
      try {
        await window.StreamSuitesApi?.apiFetch?.("/api/admin/live-status/scan", {
          method: "POST",
          body: JSON.stringify({ platform: "twitch" }),
          headers: { "Content-Type": "application/json" },
          forceRefresh: true,
          timeoutMs: 10000
        });
        await hydrateLiveStatusScaffold();
      } catch (err) {
        setText(el.liveStatusBanner, "Twitch scan request failed or is not available from Runtime/Auth.");
      }
    });

    setTimeout(() => {
      (async () => {
        await hydrateConfig();
        await hydrateLiveStatusScaffold();
        hydrateRuntimePlaceholder();
        startRuntimePolling();
      })();
    }, 0);
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

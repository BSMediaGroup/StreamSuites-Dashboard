(() => {
  "use strict";

  const REFRESH_INTERVAL_MS = 15000;
  let refreshHandle = null;

  const el = {};

  function renderLockedState() {
    const main =
      document.querySelector("main.ss-main") || document.querySelector("main");
    if (!main) return;
    main.innerHTML = `
      <section class="ss-panel">
        <header class="ss-panel-header">
          <h2>Discord not connected to runtime</h2>
        </header>
        <div class="ss-panel-body">
          <p class="muted">Discord features are unavailable because no authorized guilds were found for this login.</p>
          <p class="muted">Ask a runtime administrator to authorize a guild or log in with a Discord account that has access.</p>
        </div>
      </section>
    `;
  }

  function cacheElements() {
    el.runtime = document.getElementById("dc-runtime-state");
    el.connection = document.getElementById("dc-connection");
    el.startedAt = document.getElementById("dc-started-at");
    el.heartbeat = document.getElementById("dc-heartbeat");
    el.guildCount = document.getElementById("dc-guild-count");
    el.presence = document.getElementById("dc-presence");
    el.statusNote = document.getElementById("dc-runtime-note");
    el.controlStatus = document.getElementById("dc-control-status");
    el.activeGuild = document.getElementById("dc-active-guild");
  }

  function setText(target, value) {
    if (!target) return;
    target.textContent = value;
  }

  function formatTimestamp(value) {
    return (
      window.StreamSuitesState?.formatTimestamp?.(value) || "Not available"
    );
  }

  function formatPresence(runtime) {
    const parts = [];
    if (runtime?.statusEmoji) parts.push(runtime.statusEmoji);
    if (runtime?.statusText) parts.push(runtime.statusText);
    if (parts.length === 0) return "Not available";
    return parts.join(" ");
  }

  function formatRuntimeState(runtime) {
    return (
      window.StreamSuitesState?.describeDiscordConnection?.(runtime) ||
      "Unknown"
    );
  }

  function formatConnection(runtime) {
    if (!runtime) return "Not running";
    if (runtime.connected === true) return "Connected";
    if (runtime.connected === false) return "Disconnected";
    if (runtime.running === false) return "Not running";
    return "Unknown";
  }

  function setStatusBadge(target, status) {
    if (!target) return;
    const normalized = (status || "").toLowerCase();
    target.classList.remove("online", "offline");
    target.classList.add("badge");

    if (normalized === "online") {
      target.classList.add("online");
      target.textContent = "Online";
      return;
    }

    if (normalized === "offline" || normalized === "not running") {
      target.classList.add("offline");
      target.textContent = "Offline";
      return;
    }

    target.textContent = status || "Unknown";
  }

  function formatGuildCount(runtime) {
    if (Number.isInteger(runtime?.guildCount)) {
      return String(runtime.guildCount);
    }
    return "Not available";
  }

  function formatActiveGuildLabel() {
    const guildContext = window.StreamSuitesDiscordGuild;
    const status = guildContext?.getStatus?.() || "missing";
    const activeGuild = guildContext?.getActiveGuild?.();

    if (status === "unauthorized") {
      return "Unauthorized";
    }

    if (status !== "ready" || !activeGuild) {
      return "No guild selected";
    }

    const label =
      typeof activeGuild.name === "string" && activeGuild.name.trim()
        ? activeGuild.name.trim()
        : "Discord Guild";
    return activeGuild.id ? `${label} (${activeGuild.id})` : label;
  }

  function renderRuntime(runtime) {
    setText(el.runtime, formatRuntimeState(runtime));
    setText(el.connection, formatConnection(runtime));
    setText(el.startedAt, formatTimestamp(runtime?.startedAt));
    setText(el.heartbeat, formatTimestamp(runtime?.lastHeartbeat));
    setText(el.guildCount, formatGuildCount(runtime));
    setText(el.presence, formatPresence(runtime));
    setStatusBadge(
      el.controlStatus,
      window.StreamSuitesState?.describeDiscordConnection?.(runtime) || "Unknown"
    );
    setText(el.activeGuild, formatActiveGuildLabel());

    if (el.statusNote) {
      if (!runtime || runtime.running === false) {
        el.statusNote.textContent =
          "Runtime snapshot unavailable or not running.";
      } else {
        el.statusNote.textContent =
          "Discord runtime snapshot loaded from shared/state/discord/runtime.json.";
      }
    }
  }

  async function refresh() {
    const runtime =
      (await window.StreamSuitesState?.loadDiscordRuntimeSnapshot?.()) || null;
    renderRuntime(runtime);
  }

  function init() {
    if (window.__DISCORD_FEATURES_ENABLED__ === false) {
      renderLockedState();
      return;
    }
    cacheElements();
    renderRuntime(null);
    refresh();

    if (refreshHandle) clearInterval(refreshHandle);
    refreshHandle = setInterval(refresh, REFRESH_INTERVAL_MS);

    window.addEventListener("streamsuites:discord-guild", renderActiveGuild);
  }

  function renderActiveGuild() {
    setText(el.activeGuild, formatActiveGuildLabel());
  }

  function destroy() {
    if (refreshHandle) {
      clearInterval(refreshHandle);
      refreshHandle = null;
    }
    window.removeEventListener("streamsuites:discord-guild", renderActiveGuild);
  }

  window.DiscordView = {
    init,
    destroy
  };
})();

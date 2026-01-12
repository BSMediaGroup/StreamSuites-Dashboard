(() => {
  "use strict";

  const REFRESH_INTERVAL_MS = 15000;
  let refreshHandle = null;

  const el = {};

  function cacheElements() {
    el.runtime = document.getElementById("dc-runtime-state");
    el.connection = document.getElementById("dc-connection");
    el.startedAt = document.getElementById("dc-started-at");
    el.heartbeat = document.getElementById("dc-heartbeat");
    el.guildCount = document.getElementById("dc-guild-count");
    el.presence = document.getElementById("dc-presence");
    el.statusNote = document.getElementById("dc-runtime-note");
    el.controlStatus = document.getElementById("dc-control-status");
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
    cacheElements();
    renderRuntime(null);
    refresh();

    if (refreshHandle) clearInterval(refreshHandle);
    refreshHandle = setInterval(refresh, REFRESH_INTERVAL_MS);
  }

  function destroy() {
    if (refreshHandle) {
      clearInterval(refreshHandle);
      refreshHandle = null;
    }
  }

  window.DiscordView = {
    init,
    destroy
  };
})();

/* ============================================================
   StreamSuites Dashboard — telemetry.js
   ============================================================

   Responsibilities:
   - Load runtime_snapshot.json when present
   - Normalize platform telemetry fields
   - Provide shared formatting helpers for views

   SAFE FOR:
   - GitHub Pages (silent if file missing)
   ============================================================ */

(() => {
  "use strict";

  const PLATFORM_KEYS = ["youtube", "twitch", "rumble", "discord"];

  let snapshotCache = null;

  function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
  }

  function formatTimestamp(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    try {
      return date.toLocaleString(undefined, { hour12: false });
    } catch {
      return value;
    }
  }

  async function loadSnapshot(forceReload = false) {
    if (snapshotCache && !forceReload) return clone(snapshotCache);

    const runtime =
      (await window.ConfigState?.loadRuntimeSnapshot?.({ forceReload })) ||
      null;

    snapshotCache = runtime;
    return runtime ? clone(runtime) : null;
  }

  function describePlatform(key, snapshot) {
    if (!snapshot || !snapshot.platforms) {
      return {
        status: "unknown",
        enabled: null,
        paused: false,
        last_seen: "—",
        error_state: "No runtime snapshot available"
      };
    }

    const entry = snapshot.platforms[key] || {};
    const lastSeen =
      entry.heartbeat ||
      entry.heartbeat_at ||
      entry.last_heartbeat ||
      entry.lastUpdate ||
      entry.last_seen ||
      snapshot.generatedAt;
    const pausedReason = entry.pausedReason || entry.paused_reason;
    const error =
      entry.error_state ??
      entry.error ??
      entry.lastError ??
      entry.last_error ??
      pausedReason;

    const status = entry.status || "unknown";
    const paused = status === "paused" || Boolean(pausedReason);

    return {
      status,
      enabled: typeof entry.enabled === "boolean" ? entry.enabled : null,
      paused,
      last_seen: formatTimestamp(lastSeen),
      error_state:
        error === null || error === undefined || error === ""
          ? "—"
          : error
    };
  }

  window.Telemetry = {
    loadSnapshot,
    describePlatform,
    formatTimestamp,
    PLATFORM_KEYS
  };
})();

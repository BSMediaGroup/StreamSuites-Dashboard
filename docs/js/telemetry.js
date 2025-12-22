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
        last_seen: "—",
        error_state: "No runtime snapshot available"
      };
    }

    const entry = snapshot.platforms[key] || {};
    return {
      status: entry.status || "unknown",
      last_seen: formatTimestamp(entry.last_seen),
      error_state:
        entry.error_state === null || entry.error_state === undefined
          ? "—"
          : entry.error_state
    };
  }

  window.Telemetry = {
    loadSnapshot,
    describePlatform,
    formatTimestamp,
    PLATFORM_KEYS
  };
})();

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

  const TELEMETRY_PATHS = {
    events: "telemetry/events.json",
    rates: "telemetry/rates.json",
    errors: "telemetry/errors.json"
  };

  const TELEMETRY_CACHE = new Map();

  let snapshotCache = null;
  let healthModulePromise = null;

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

  function pickTimestamp(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return null;
    const meta = snapshot.meta || {};
    const candidates = [
      snapshot.generated_at,
      snapshot.generatedAt,
      snapshot.timestamp,
      snapshot.updated_at,
      snapshot.updatedAt,
      meta.generated_at,
      meta.generatedAt,
      meta.timestamp,
      meta.updated_at,
      meta.updatedAt
    ];

    for (const candidate of candidates) {
      if (candidate) return candidate;
    }

    return null;
  }

  function normalizeEventSnapshot(raw) {
    const generated_at = pickTimestamp(raw);
    const eventsArray = Array.isArray(raw?.events)
      ? raw.events
      : Array.isArray(raw)
        ? raw
        : [];

    const normalizedEvents = eventsArray
      .filter((evt) => evt && typeof evt === "object")
      .map((evt) => ({
        timestamp: evt.timestamp || evt.at || evt.time || evt.t,
        severity: (evt.severity || evt.level || "info").toString().toLowerCase(),
        source: evt.source || evt.subsystem || evt.component || "—",
        message: evt.message || evt.msg || "—"
      }))
      .sort((a, b) => {
        const tsA = new Date(a.timestamp || 0).getTime();
        const tsB = new Date(b.timestamp || 0).getTime();
        return tsB - tsA;
      });

    return { generated_at, events: normalizedEvents };
  }

  function normalizeRatesSnapshot(raw) {
    const generated_at = pickTimestamp(raw);
    const windowLabel = raw?.window || raw?.window_label || raw?.interval || "Recent window";

    let metrics = [];

    if (Array.isArray(raw?.metrics)) {
      metrics = raw.metrics;
    } else if (raw?.rates && typeof raw.rates === "object") {
      metrics = Object.entries(raw.rates).map(([key, value]) => ({
        key,
        label: key,
        value
      }));
    }

    const normalizedMetrics = metrics
      .filter((metric) => metric && typeof metric === "object")
      .map((metric) => ({
        key: metric.key || metric.label || "metric",
        label: metric.label || metric.key || "metric",
        value: metric.value ?? metric.count ?? metric.rate ?? "—",
        unit: metric.unit || metric.window || ""
      }));

    return { generated_at, window: windowLabel, metrics: normalizedMetrics };
  }

  function normalizeErrorsSnapshot(raw) {
    const generated_at = pickTimestamp(raw);
    const errorsArray = Array.isArray(raw?.errors)
      ? raw.errors
      : Array.isArray(raw)
        ? raw
        : [];

    const normalizedErrors = errorsArray
      .filter((err) => err && typeof err === "object")
      .map((err) => ({
        subsystem: err.subsystem || err.source || err.component || "Unknown",
        message: err.message || err.msg || "—",
        active: err.active === true || err.severity === "critical" || err.severity === "error",
        last_seen: err.last_seen || err.timestamp || err.at || null
      }));

    return { generated_at, errors: normalizedErrors };
  }

  async function getHealthModule() {
    if (healthModulePromise) return healthModulePromise;

    healthModulePromise = import("./utils/snapshot-health.js").catch((err) => {
      console.warn("[Telemetry] Snapshot health module failed to load", err);
      return null;
    });

    return healthModulePromise;
  }

  async function evaluateSnapshotHealth(snapshot) {
    const module = await getHealthModule();
    if (!module || typeof module.evaluateSnapshotHealth !== "function") return null;
    const safeSnapshot =
      snapshot && typeof snapshot === "object" ? snapshot : {};
    return module.evaluateSnapshotHealth({
      ...safeSnapshot,
      generated_at: pickTimestamp(snapshot)
    });
  }

  async function loadTelemetryFile(path, forceReload = false) {
    if (TELEMETRY_CACHE.has(path) && !forceReload) {
      return clone(TELEMETRY_CACHE.get(path));
    }

    const urls = [
      new URL(`shared/state/${path}`, document.baseURI),
      new URL(`data/${path}`, document.baseURI)
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          continue;
        }

        const json = await res.json();
        TELEMETRY_CACHE.set(path, json);
        return clone(json);
      } catch (err) {
        console.warn(`[Telemetry] Failed to load ${path} from ${url}`, err);
      }
    }

    TELEMETRY_CACHE.set(path, null);
    return null;
  }

  async function loadEvents(options = {}) {
    const raw = await loadTelemetryFile(TELEMETRY_PATHS.events, options.forceReload);
    return normalizeEventSnapshot(raw || {});
  }

  async function loadRates(options = {}) {
    const raw = await loadTelemetryFile(TELEMETRY_PATHS.rates, options.forceReload);
    return normalizeRatesSnapshot(raw || {});
  }

  async function loadErrors(options = {}) {
    const raw = await loadTelemetryFile(TELEMETRY_PATHS.errors, options.forceReload);
    return normalizeErrorsSnapshot(raw || {});
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
    loadEvents,
    loadRates,
    loadErrors,
    evaluateSnapshotHealth,
    describePlatform,
    formatTimestamp,
    PLATFORM_KEYS
  };
})();

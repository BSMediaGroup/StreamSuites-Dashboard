// ======================================================================
// Snapshot Health Guard
// Detects stale runtime snapshots
// ======================================================================

const SNAPSHOT_STALE_THRESHOLD_MS = 60 * 1000; // 60 seconds
let latestAdminLiveData = null;

function isLiveDataSource(context = {}) {
  const source = String(context.source || context.dataSource || "").toLowerCase();
  return source === "connected" ||
    source === "api" ||
    source === "admin-live" ||
    source === "live_api" ||
    source.includes("runtime:auto") ||
    source.includes("runtime:polled");
}

function extractTimestamp(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const candidates = [
    snapshot.timestamp,
    snapshot.generated_at,
    snapshot.updated_at,
    snapshot.generatedAt,
    snapshot.updatedAt
  ];

  for (const candidate of candidates) {
    if (candidate) return candidate;
  }

  return null;
}

export function evaluateSnapshotHealth(snapshot, context = {}) {
  if (isLiveDataSource(context)) {
    return { status: "fresh", ageMs: null, source: context.source || context.dataSource || "connected" };
  }

  if (!snapshot) {
    return { status: "missing", ageMs: null };
  }

  const timestampValue = extractTimestamp(snapshot);
  if (!timestampValue) {
    return { status: "invalid", ageMs: null };
  }

  const snapshotTime = new Date(timestampValue).getTime();
  if (Number.isNaN(snapshotTime) || snapshotTime <= 0) {
    return { status: "invalid", ageMs: null };
  }

  const ageMs = Date.now() - snapshotTime;
  if (ageMs < 0) {
    return { status: "invalid", ageMs };
  }

  if (ageMs > SNAPSHOT_STALE_THRESHOLD_MS) {
    return { status: "stale", ageMs };
  }

  return { status: "fresh", ageMs };
}

export function renderSnapshotHealthBanner(health) {
  if (!health) return;
  if (health.status !== "fresh" && isFreshAdminLiveData(latestAdminLiveData)) {
    health = { status: "fresh", ageMs: null, source: "admin-live" };
  }

  let banner = document.getElementById("snapshot-health-banner");

  if (!banner) {
    banner = document.createElement("div");
    banner.id = "snapshot-health-banner";
    banner.className = "snapshot-health-banner";
    document.body.prepend(banner);
  }

  if (health.status === "fresh") {
    banner.style.display = "none";
    banner.textContent = "";
    banner.className = "snapshot-health-banner";
    return;
  }

  const messages = {
    missing: "⚠ Runtime snapshot missing — dashboard may be outdated.",
    stale: "⚠ Runtime snapshot is stale — dashboard may be out of date.",
    invalid: "⚠ Runtime snapshot invalid — dashboard data cannot be trusted."
  };

  banner.style.display = "block";
  banner.className = `snapshot-health-banner snapshot-health-${health.status}`;
  banner.textContent = messages[health.status] || "⚠ Runtime snapshot health unknown.";
}

export function clearSnapshotHealthBanner() {
  renderSnapshotHealthBanner({ status: "fresh", ageMs: null, source: "admin-live" });
}

function isFreshAdminLiveData(detail) {
  if (!detail || typeof detail !== "object") return false;
  const source = String(detail.status_source || detail.source || "").trim();
  return detail.ok !== false && detail.stale !== true && isLiveDataSource({ source });
}

export function handleAdminLiveData(detail = {}) {
  latestAdminLiveData = detail && typeof detail === "object" ? { ...detail } : {};
  if (isFreshAdminLiveData(latestAdminLiveData)) {
    clearSnapshotHealthBanner();
    return;
  }
  if (latestAdminLiveData.ok === false || latestAdminLiveData.stale === true) {
    const source = String(latestAdminLiveData.status_source || latestAdminLiveData.source || "").trim();
    renderSnapshotHealthBanner({
      status: latestAdminLiveData.stale === true ? "stale" : "invalid",
      ageMs: Number.isFinite(Number(latestAdminLiveData.age_seconds)) ? Number(latestAdminLiveData.age_seconds) * 1000 : null,
      source,
      reason: latestAdminLiveData.stale_reason || latestAdminLiveData.error || ""
    });
  }
}

export function getLatestAdminLiveData() {
  return latestAdminLiveData ? { ...latestAdminLiveData } : null;
}

if (typeof window !== "undefined" && !window.__STREAMSUITES_SNAPSHOT_HEALTH_EVENTS_BOUND__) {
  window.__STREAMSUITES_SNAPSHOT_HEALTH_EVENTS_BOUND__ = true;
  window.StreamSuitesSnapshotHealth = {
    evaluateSnapshotHealth,
    renderSnapshotHealthBanner,
    clearSnapshotHealthBanner,
    handleAdminLiveData,
    getLatestAdminLiveData
  };
  window.addEventListener("streamsuites:admin-live-data", (event) => {
    handleAdminLiveData(event?.detail || {});
  });
  if (window.__STREAMSUITES_ADMIN_LIVE_DATA__) {
    handleAdminLiveData(window.__STREAMSUITES_ADMIN_LIVE_DATA__);
  }
} else if (typeof window !== "undefined") {
  window.StreamSuitesSnapshotHealth = {
    ...(window.StreamSuitesSnapshotHealth || {}),
    evaluateSnapshotHealth,
    renderSnapshotHealthBanner,
    clearSnapshotHealthBanner,
    handleAdminLiveData,
    getLatestAdminLiveData
  };
  if (window.__STREAMSUITES_ADMIN_LIVE_DATA__) {
    handleAdminLiveData(window.__STREAMSUITES_ADMIN_LIVE_DATA__);
  }
}

// Legacy wrapper maintained for compatibility
export function renderSnapshotWarning(health) {
  renderSnapshotHealthBanner(health);
}

// ======================================================================
// Snapshot Health Guard
// Detects stale runtime snapshots
// ======================================================================

const SNAPSHOT_STALE_THRESHOLD_MS = 60 * 1000; // 60 seconds

export function evaluateSnapshotHealth(snapshot) {
  if (!snapshot || !snapshot.timestamp) {
    return { status: "missing", ageMs: null };
  }

  const snapshotTime = new Date(snapshot.timestamp).getTime();
  const now = Date.now();
  const ageMs = now - snapshotTime;

  if (ageMs > SNAPSHOT_STALE_THRESHOLD_MS) {
    return { status: "stale", ageMs };
  }

  return { status: "fresh", ageMs };
}

export function renderSnapshotWarning(health) {
  let banner = document.getElementById("snapshot-health-banner");

  if (!banner) {
    banner = document.createElement("div");
    banner.id = "snapshot-health-banner";
    banner.className = "snapshot-health-banner";
    document.body.prepend(banner);
  }

  if (health.status === "fresh") {
    banner.style.display = "none";
    return;
  }

  banner.style.display = "block";
  banner.innerText =
    health.status === "missing"
      ? "⚠ Runtime snapshot missing"
      : "⚠ Runtime snapshot is stale — dashboard may be out of date";
}

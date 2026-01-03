"use strict";

const CHANGELOG_SCOPES = ["dashboard", "runtime", "global"];

function parseDateSafe(value, label = "") {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const suffix = label ? ` for entry ${label}` : "";
    console.warn(`[Changelog] Unrecognized date ${value}${suffix}`);
    return Number.NEGATIVE_INFINITY;
  }
  return parsed.getTime();
}

function resolveBasePath() {
  if (
    window.Versioning &&
    window.Versioning.resolveBasePath &&
    typeof window.Versioning.resolveBasePath === "function"
  ) {
    return window.Versioning.resolveBasePath();
  }

  const parts = window.location.pathname.split("/").filter(Boolean);
  if (!parts.length) return "";
  const docsIndex = parts.indexOf("docs");
  if (docsIndex === -1) {
    return `/${parts[0]}`;
  }

  const rootParts = parts.slice(0, docsIndex + 1);
  return `/${rootParts.join("/")}`;
}

function normalizePath(basePath, relative) {
  const normalized = `${basePath || ""}/${relative}`.replace(/\+/g, "/");
  return normalized.replace(/([^:])\/\/+/, "$1/");
}

async function fetchChangelog(path, { silent } = {}) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    if (Array.isArray(payload?.entries)) return payload.entries;
    if (Array.isArray(payload)) return payload;
    return [];
  } catch (error) {
    if (!silent) throw error;
    console.warn(`[Changelog] Optional source unavailable: ${path}`, error);
    return [];
  }
}

function normalizeScope(value, fallback = "dashboard") {
  const scope = String(value || fallback || "dashboard").toLowerCase();
  if (CHANGELOG_SCOPES.includes(scope)) return scope;
  return fallback;
}

function normalizeEntry(entry, fallbackScope) {
  if (!entry || typeof entry !== "object") return null;
  return {
    ...entry,
    scope: normalizeScope(entry.scope, fallbackScope),
    tags: Array.isArray(entry.tags) ? entry.tags : []
  };
}

function mergeEntries(...entrySets) {
  const seen = new Map();
  const withoutIds = [];

  entrySets.flat().forEach((entry) => {
    if (!entry) return;
    const key = entry.id != null ? String(entry.id) : null;
    if (!key) {
      withoutIds.push(entry);
      return;
    }

    if (!seen.has(key)) {
      seen.set(key, entry);
      return;
    }

    const existing = seen.get(key);
    const existingDate = parseDateSafe(existing?.date, existing?.id || existing?.title || "");
    const incomingDate = parseDateSafe(entry?.date, entry?.id || entry?.title || "");

    if (incomingDate > existingDate) {
      seen.set(key, entry);
    }
  });

  const merged = [...seen.values(), ...withoutIds];
  return merged.sort((a, b) => {
    const aDate = parseDateSafe(a?.date, a?.id || a?.title || "");
    const bDate = parseDateSafe(b?.date, b?.id || b?.title || "");

    if (aDate === bDate) {
      const aKey = a?.id || a?.title || "";
      const bKey = b?.id || b?.title || "";
      return String(aKey).localeCompare(String(bKey));
    }

    return bDate - aDate;
  });
}

export async function loadMergedChangelog() {
  const basePath = resolveBasePath();
  const dashboardPath = normalizePath(basePath, "data/changelog.dashboard.json");
  const runtimePath = normalizePath(basePath, "data/changelog.runtime.json");

  const dashboardEntries = (await fetchChangelog(dashboardPath)).map((entry) =>
    normalizeEntry(entry, "dashboard")
  );

  const runtimeEntries = (await fetchChangelog(runtimePath, { silent: true })).map((entry) =>
    normalizeEntry(entry, "runtime")
  );

  return mergeEntries(dashboardEntries, runtimeEntries);
}

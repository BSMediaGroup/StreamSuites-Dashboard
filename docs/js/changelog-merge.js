"use strict";

const CHANGELOG_SCOPES = ["dashboard", "runtime", "global"];

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
  const root = parts[0] === "docs" ? "docs" : parts[0];
  return `/${root}`;
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
    const existingDate = existing?.date ? new Date(existing.date).getTime() : -Infinity;
    const incomingDate = entry?.date ? new Date(entry.date).getTime() : -Infinity;

    if (incomingDate > existingDate) {
      seen.set(key, entry);
    }
  });

  const merged = [...seen.values(), ...withoutIds];
  return merged.sort((a, b) => {
    const aDate = a?.date ? new Date(a.date).getTime() : 0;
    const bDate = b?.date ? new Date(b.date).getTime() : 0;
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

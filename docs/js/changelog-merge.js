"use strict";

const CHANGELOG_SCOPES = ["dashboard", "runtime", "global"];
const DETAIL_KEYS = ["details", "bullets", "items", "changes", "entries"];

function stripPrefixStar(value) {
  if (!value) return value;
  return String(value).replace(/^\s*[★⭐]\s*/, "");
}

function isPresent(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return Boolean(value.trim());
  return value != null;
}

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

function normalizeDetailItem(detail) {
  if (!detail) return null;
  if (typeof detail === "string") {
    const trimmed = detail.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof detail === "object" && isPresent(detail.text)) {
    return {
      ...detail,
      text: String(detail.text).trim(),
      link: detail.link
    };
  }

  return null;
}

function normalizeDetails(entry) {
  for (const key of DETAIL_KEYS) {
    const candidate = entry?.[key];
    if (Array.isArray(candidate)) {
      const normalized = candidate.map(normalizeDetailItem).filter(Boolean);
      if (normalized.length) return normalized;
    }
  }

  if (typeof entry?.body === "string") {
    const lines = entry.body
      .split(/\r?\n+/)
      .map((item) => item.replace(/^[\s]*[-*•]\s*/, "").trim())
      .filter(Boolean);
    if (lines.length) return lines;
  }

  if (typeof entry?.description === "string" && entry.description.trim()) {
    return [entry.description.trim()];
  }

  if (typeof entry?.summary === "string" && entry.summary.trim()) {
    return [entry.summary.trim()];
  }

  return [];
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
  const summary = entry.summary || entry.description || "";
  const normalizedDetails = normalizeDetails(entry);
  const tags = Array.isArray(entry.tags)
    ? entry.tags.filter((tag) => isPresent(tag)).map((tag) => String(tag))
    : [];

  return {
    ...entry,
    id: entry.id != null ? String(entry.id) : entry.id,
    title: stripPrefixStar(entry.title || entry.version || ""),
    summary,
    details: normalizedDetails,
    description: entry.description || "",
    scope: normalizeScope(entry.scope, fallbackScope),
    tags,
    is_latest: false,
    pinned: false
  };
}

function dedupeList(values = []) {
  const seen = new Set();
  return values.filter((value) => {
    const key = typeof value === "object" ? JSON.stringify(value) : String(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeDetails(existing = [], incoming = []) {
  const combined = [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])];
  return dedupeList(combined.filter(Boolean));
}

function mergeTags(existing = [], incoming = []) {
  return dedupeList([...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]);
}

function preferValue(primary, fallback) {
  return isPresent(primary) ? primary : fallback;
}

function mergeEntry(existing, incoming) {
  const baseDate = parseDateSafe(existing?.date, existing?.id || existing?.title || "");
  const incomingDate = parseDateSafe(incoming?.date, incoming?.id || incoming?.title || "");
  const primary = incomingDate > baseDate ? incoming : existing;
  const secondary = primary === existing ? incoming : existing;

  return {
    ...secondary,
    ...primary,
    title: stripPrefixStar(preferValue(primary.title, secondary.title)),
    version: preferValue(primary.version, secondary.version),
    date: preferValue(primary.date, secondary.date),
    summary: preferValue(primary.summary, secondary.summary),
    description: preferValue(primary.description, secondary.description),
    scope: preferValue(primary.scope, secondary.scope),
    details: mergeDetails(primary.details, secondary.details),
    tags: mergeTags(primary.tags, secondary.tags),
    is_latest: false,
    pinned: false
  };
}

function buildEntryKey(entry) {
  if (!entry) return null;
  if (isPresent(entry.id)) return String(entry.id);
  const datePart = entry.date ? String(entry.date) : "";
  const titlePart = entry.title ? String(entry.title).toLowerCase().replace(/\s+/g, "-") : "";
  const composite = `${datePart}__${titlePart}`.replace(/_+$/, "");
  return composite.trim() || null;
}

function mergeEntries(...entrySets) {
  const seen = new Map();
  const withoutIds = [];

  entrySets.flat().forEach((entry) => {
    if (!entry) return;
    if (String(entry.title || "").trim().toLowerCase() === "runtime resumed") return;

    const key = buildEntryKey(entry);
    if (!key) {
      withoutIds.push(entry);
      return;
    }

    if (!seen.has(key)) {
      seen.set(key, entry);
      return;
    }

    const existing = seen.get(key);
    const merged = mergeEntry(existing, entry);
    seen.set(key, merged);
  });

  const merged = [...seen.values(), ...withoutIds];
  return merged
    .filter(Boolean)
    .sort((a, b) => {
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

  const dashboardEntries = (await fetchChangelog(dashboardPath))
    .map((entry) => normalizeEntry(entry, "dashboard"))
    .filter(Boolean);

  const runtimeEntries = (await fetchChangelog(runtimePath, { silent: true }))
    .map((entry) => normalizeEntry(entry, "runtime"))
    .filter(Boolean);

  return mergeEntries(dashboardEntries, runtimeEntries);
}

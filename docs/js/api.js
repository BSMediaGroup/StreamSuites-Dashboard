(() => {
  "use strict";

  const DEFAULT_API_BASE = "https://api.streamsuites.app";
  const responseCache = new Map();

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function trimBase(value) {
    if (typeof value !== "string") return "";
    return value.trim().replace(/\/+$/, "");
  }

  function isAbsoluteHttpUrl(value) {
    return /^https?:\/\//i.test(value || "");
  }

  function getApiBase() {
    const candidates = [
      window.SS_API_BASE,
      window.StreamSuitesAdminAuth?.config?.baseUrl,
      document.querySelector('meta[name="streamsuites-auth-base"]')?.getAttribute("content"),
      window.AUTH_API_BASE,
      DEFAULT_API_BASE
    ];

    for (const candidate of candidates) {
      const normalized = trimBase(candidate);
      if (!normalized) continue;
      if (!isAbsoluteHttpUrl(normalized)) continue;
      try {
        const host = new URL(normalized).host.toLowerCase();
        if (host === "admin.streamsuites.app") {
          continue;
        }
      } catch {
        continue;
      }
      return normalized;
    }

    return DEFAULT_API_BASE;
  }

  function buildApiUrl(path, baseOverride = "") {
    if (!path) return getApiBase();
    if (/^https?:\/\//i.test(path)) return path;
    const base = trimBase(baseOverride) || getApiBase();
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalizedPath}`;
  }

  async function parseErrorPayload(response) {
    const contentType = response.headers?.get("content-type") || "";
    try {
      if (contentType.includes("application/json")) {
        return await response.json();
      }
      const text = await response.text();
      return text ? { message: text } : null;
    } catch {
      return null;
    }
  }

  async function apiFetch(path, options = {}) {
    const {
      cacheTtlMs = 0,
      cacheKey = "",
      baseUrl = "",
      timeoutMs = 4500,
      parseJson = true,
      headers = {},
      forceRefresh = false,
      ...fetchOptions
    } = options;

    const requestUrl = buildApiUrl(path, baseUrl);
    const resolvedCacheKey = cacheKey || `${fetchOptions.method || "GET"}:${requestUrl}`;

    if (!forceRefresh && cacheTtlMs > 0) {
      const cached = responseCache.get(resolvedCacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return clone(cached.value);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(requestUrl, {
        cache: "no-store",
        credentials: "include",
        ...fetchOptions,
        headers: {
          Accept: "application/json",
          ...headers
        },
        signal: fetchOptions.signal || controller.signal
      });

      if (!response.ok) {
        const detail = await parseErrorPayload(response);
        const detailMessage =
          (detail && typeof detail.message === "string" && detail.message) ||
          (detail && typeof detail.error === "string" && detail.error) ||
          "";
        const error = new Error(detailMessage || `Request failed (${response.status})`);
        error.status = response.status;
        error.url = requestUrl;
        error.payload = detail;
        error.isAuthError = response.status === 401 || response.status === 403;
        throw error;
      }

      if (parseJson === false) return response;

      const payload = await response.json();
      if (cacheTtlMs > 0) {
        responseCache.set(resolvedCacheKey, {
          expiresAt: Date.now() + cacheTtlMs,
          value: clone(payload)
        });
      }
      return payload;
    } catch (err) {
      if (err?.name === "AbortError") {
        const timeoutError = new Error("Request timed out");
        timeoutError.status = 0;
        timeoutError.url = requestUrl;
        timeoutError.isAuthError = false;
        throw timeoutError;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getAdminAnalytics(windowValue = "5m", options = {}) {
    const selected = String(windowValue || "5m").trim().toLowerCase() || "5m";
    return apiFetch(`/api/admin/analytics?window=${encodeURIComponent(selected)}`, {
      cacheTtlMs: options.ttlMs ?? 8000,
      cacheKey: `admin-analytics:${selected}`,
      forceRefresh: options.forceRefresh === true,
      timeoutMs: options.timeoutMs,
      signal: options.signal
    });
  }

  function buildWindowedPath(path, windowValue, options = {}) {
    const params = new URLSearchParams();
    const selected = String(windowValue || "").trim().toLowerCase();
    if (selected) {
      params.set("window", selected);
    }
    const limit = Number(options.limit);
    if (Number.isFinite(limit) && limit > 0) {
      params.set("limit", String(Math.floor(limit)));
    }
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }

  async function getAdminActivity(windowValue = "5m", options = {}) {
    const selected = String(windowValue || "5m").trim().toLowerCase() || "5m";
    return apiFetch(buildWindowedPath("/api/admin/activity", selected, options), {
      cacheTtlMs: options.ttlMs ?? 8000,
      cacheKey: `admin-activity:${selected}:${Number(options.limit) || 0}`,
      forceRefresh: options.forceRefresh === true,
      timeoutMs: options.timeoutMs,
      signal: options.signal
    });
  }

  async function getAdminAuthEvents(windowValue = "24h", options = {}) {
    const selected = String(windowValue || "24h").trim().toLowerCase() || "24h";
    return apiFetch(buildWindowedPath("/api/admin/telemetry/auth-events", selected, options), {
      cacheTtlMs: options.ttlMs ?? 8000,
      cacheKey: `admin-auth-events:${selected}:${Number(options.limit) || 0}`,
      forceRefresh: options.forceRefresh === true,
      timeoutMs: options.timeoutMs,
      signal: options.signal
    });
  }

  async function getAdminDonations(windowValue = "30d", options = {}) {
    const selected = String(windowValue || "30d").trim().toLowerCase() || "30d";
    return apiFetch(buildWindowedPath("/api/admin/donations", selected, options), {
      cacheTtlMs: options.ttlMs ?? 8000,
      cacheKey: `admin-donations:${selected}:${Number(options.limit) || 0}`,
      forceRefresh: options.forceRefresh === true,
      timeoutMs: options.timeoutMs,
      signal: options.signal
    });
  }

  window.StreamSuitesApi = {
    getApiBase,
    buildApiUrl,
    apiFetch,
    getAdminAnalytics,
    getAdminActivity,
    getAdminAuthEvents,
    getAdminDonations
  };
})();

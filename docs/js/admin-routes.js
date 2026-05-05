/* ======================================================================
   StreamSuites Dashboard - admin-routes.js
   Clean path routing helpers with legacy hash compatibility.
   ====================================================================== */

(() => {
  "use strict";

  if (window.StreamSuitesAdminRoutes) return;

  const REDIRECT_QUERY_KEY = "__ss_route";
  const ROUTE_CHANGE_EVENT = "streamsuites:routechange";
  const USER_DETAIL_PREFIX = "/users/";

  const VIEW_ROUTE_DEFINITIONS = Object.freeze({
    overview: { canonical: "/overview", aliases: ["/", "/index.html", "/home"], title: "Overview" },
    bots: {
      canonical: "/telemetry",
      aliases: ["/bots", "/runtime-status"],
      title: "Bots / Runtime Status"
    },
    approvals: { canonical: "/approvals", title: "Approvals" },
    progression: { canonical: "/progression", aliases: ["/xp", "/ranks"], title: "XP / Rank Controls" },
    economy: { canonical: "/economy", aliases: ["/economy-inventory", "/inventory"], title: "Economy / Inventory Controls" },
    accounts: { canonical: "/users", aliases: ["/accounts"], title: "Accounts" },
    "user-detail": { canonical: "/users/:user_code", title: "User Detail" },
    creators: { canonical: "/profiles", aliases: ["/creators"], title: "Creators" },
    "creator-integrations": {
      canonical: "/profiles/integrations",
      aliases: ["/creator-integrations"],
      title: "Creator Integrations"
    },
    "creator-stats": {
      canonical: "/profiles/stats",
      aliases: ["/creator-stats"],
      title: "Creator Stats"
    },
    audit: { canonical: "/audit", title: "Audit Logs" },
    alerts: { canonical: "/alerts", aliases: ["/analytics-alerts"], title: "Alerts" },
    analytics: { canonical: "/analytics", title: "Analytics" },
    ratelimits: { canonical: "/ratelimits", aliases: ["/rate-limits"], title: "Rate Limits" },
    "api-usage": { canonical: "/api-usage", title: "API Usage" },
    "data-signals": { canonical: "/data-signals", aliases: ["/signals"], title: "Data & Signals" },
    notifications: { canonical: "/notifications", aliases: ["/inbox"], title: "Inbox" },
    jobs: { canonical: "/jobs", title: "Jobs" },
    "chat-replay": { canonical: "/chat-replay", title: "Chat Replay" },
    rumble: { canonical: "/integrations/rumble", aliases: ["/rumble"], title: "Rumble" },
    youtube: { canonical: "/integrations/youtube", aliases: ["/youtube"], title: "YouTube" },
    twitch: { canonical: "/integrations/twitch", aliases: ["/twitch"], title: "Twitch" },
    kick: { canonical: "/integrations/kick", aliases: ["/kick"], title: "Kick" },
    pilled: { canonical: "/integrations/pilled", aliases: ["/pilled"], title: "Pilled" },
    twitter: { canonical: "/integrations/twitter", aliases: ["/twitter"], title: "Twitter" },
    discord: { canonical: "/integrations/discord", aliases: ["/discord"], title: "Discord" },
    triggers: {
      canonical: "/integrations/triggers",
      aliases: ["/triggers", "/chat-triggers"],
      title: "Chat Triggers"
    },
    tiers: { canonical: "/tiers", title: "Tiers" },
    clips: { canonical: "/clips", title: "Clips" },
    polls: { canonical: "/polls", title: "Polls" },
    tallies: { canonical: "/tallies", title: "Tallies" },
    scoreboards: { canonical: "/scoreboards", title: "Scoreboards" },
    "scoreboard-management": { canonical: "/scoreboard-management", title: "Manage Scores" },
    settings: { canonical: "/settings", title: "Settings" },
    permissions: { canonical: "/permissions", title: "Permissions" },
    updates: { canonical: "/updates", title: "Updates" },
    design: { canonical: "/design", title: "Design" }
  });

  function getViewConfig(viewName) {
    const normalized = typeof viewName === "string" ? viewName.trim() : "";
    return normalized ? VIEW_ROUTE_DEFINITIONS[normalized] || null : null;
  }

  function normalizeViewToken(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }

  function resolveBasePath(configuredValue = window.ADMIN_BASE_PATH) {
    const configured =
      typeof configuredValue === "string" ? configuredValue.trim().replace(/\/+$/, "") : "";
    if (!configured) return "";
    const pathname = window.location?.pathname || "";
    if (pathname === configured || pathname.startsWith(`${configured}/`)) {
      return configured;
    }
    return "";
  }

  function stripBasePath(pathname) {
    const basePath = resolveBasePath();
    const rawPath = typeof pathname === "string" && pathname.trim() ? pathname.trim() : "/";
    if (basePath && (rawPath === basePath || rawPath.startsWith(`${basePath}/`))) {
      return rawPath.slice(basePath.length) || "/";
    }
    return rawPath;
  }

  function normalizePathname(pathname) {
    let normalized = stripBasePath(pathname || "/");
    if (!normalized.startsWith("/")) {
      normalized = `/${normalized}`;
    }
    normalized = normalized.replace(/\/{2,}/g, "/");
    if (normalized.length > 1) {
      normalized = normalized.replace(/\/+$/, "");
    }
    if (!normalized || normalized === "/index.html") {
      return "/";
    }
    return normalized;
  }

  function buildPathIndex() {
    const entries = Object.entries(VIEW_ROUTE_DEFINITIONS);
    const pathToView = new Map();
    entries.forEach(([viewName, config]) => {
      const candidates = [config.canonical, ...(config.aliases || [])].filter((candidate) => !String(candidate || "").includes("/:"));
      candidates.forEach((candidate) => {
        pathToView.set(normalizePathname(candidate), viewName);
      });
    });
    return pathToView;
  }

  const PATH_TO_VIEW = buildPathIndex();

  function resolveViewMatchFromPath(normalizedPath) {
    const exactView = PATH_TO_VIEW.get(normalizedPath) || "";
    if (exactView) {
      return { view: exactView, params: {} };
    }
    return resolveDynamicViewFromPath(normalizedPath);
  }

  function resolveDynamicViewFromPath(normalizedPath) {
    if (
      normalizedPath.startsWith(USER_DETAIL_PREFIX) &&
      normalizedPath.length > USER_DETAIL_PREFIX.length
    ) {
      const userCode = decodeURIComponent(normalizedPath.slice(USER_DETAIL_PREFIX.length)).trim();
      if (userCode && userCode.toLowerCase() !== "detail") {
        return {
          view: "user-detail",
          params: { user_code: userCode }
        };
      }
    }
    return null;
  }

  function splitRouteToken(token) {
    const raw = typeof token === "string" ? token.trim() : "";
    if (!raw) {
      return { token: "", query: "", queryString: "" };
    }
    const [pathToken, ...queryParts] = raw.split("?");
    const queryString = queryParts.join("?");
    return {
      token: pathToken.trim(),
      query: queryString ? `?${queryString}` : "",
      queryString
    };
  }

  function resolveViewFromHash(hashValue) {
    const rawHash = typeof hashValue === "string" ? hashValue.replace(/^#/, "").trim() : "";
    const parsed = splitRouteToken(rawHash);
    if (!parsed.token) {
      return { mode: "hash", view: "", query: parsed.query, queryString: parsed.queryString };
    }

    const directView = parsed.token.replace(/^\/+/, "");
    if (VIEW_ROUTE_DEFINITIONS[directView]) {
      return {
        mode: "hash",
        view: directView,
        query: parsed.query,
        queryString: parsed.queryString,
        legacyHash: rawHash
      };
    }

    const normalizedPath = normalizePathname(parsed.token);
    const aliasView = PATH_TO_VIEW.get(normalizedPath) || "";
    const dynamic = aliasView ? null : resolveDynamicViewFromPath(normalizedPath);
    return {
      mode: "hash",
      view: dynamic?.view || aliasView,
      query: parsed.query,
      queryString: parsed.queryString,
      legacyHash: rawHash,
      params: dynamic?.params || {}
    };
  }

  function resolveViewFromPath(pathname = window.location.pathname, search = window.location.search) {
    const normalizedPath = normalizePathname(pathname);
    const match = resolveViewMatchFromPath(normalizedPath);
    const view = match?.view || "";
    const queryString =
      typeof search === "string" ? search.replace(/^\?/, "").trim() : "";
    return {
      mode: "path",
      view,
      pathname: normalizedPath,
      query: queryString ? `?${queryString}` : "",
      queryString,
      params: match?.params || {}
    };
  }

  function resolveViewName(viewLike) {
    const normalized = normalizeViewToken(viewLike);
    if (!normalized) return "";
    if (VIEW_ROUTE_DEFINITIONS[normalized]) {
      return normalized;
    }
    if (normalized.startsWith("#")) {
      return resolveViewFromHash(normalized)?.view || "";
    }
    if (normalized.startsWith("/")) {
      return resolveViewFromPath(normalized).view || "";
    }
    const pathView = resolveViewFromPath(`/${normalized}`).view || "";
    if (pathView) {
      return pathView;
    }
    try {
      const parsed = new URL(String(viewLike), window.location.origin);
      if (parsed.origin !== window.location.origin) return "";
      return (
        resolveViewFromPath(parsed.pathname || "/", parsed.search || "").view ||
        resolveViewFromHash(parsed.hash || "").view ||
        ""
      );
    } catch (err) {
      return "";
    }
  }

  function getCanonicalPathForView(viewName) {
    const config = getViewConfig(viewName);
    if (!config) return "/overview";
    return normalizePathname(config.canonical);
  }

  function getTitleForView(viewName, params = {}) {
    const config = getViewConfig(viewName);
    if (!config) return "Overview";

    if (viewName === "user-detail") {
      const userCode = String(params?.user_code || "").trim();
      return userCode ? `User Detail` : config.title;
    }

    return config.title || "Overview";
  }

  function buildDashboardUrl(viewName, options = {}) {
    const basePath = resolveBasePath();
    const params = options.params instanceof URLSearchParams
      ? options.params
      : new URLSearchParams(options.params || "");
    let canonicalPath = getCanonicalPathForView(viewName);
    if (viewName === "user-detail") {
      const userCode = String(params.get("user_code") || options.userCode || "").trim();
      if (!userCode) {
        canonicalPath = getCanonicalPathForView("accounts");
      } else {
        canonicalPath = `${USER_DETAIL_PREFIX}${encodeURIComponent(userCode)}`;
        params.delete("user_code");
      }
    }
    const queryString = params.toString();
    const path = canonicalPath === "/" ? "/" : canonicalPath;
    const prefix = basePath || "";
    return `${prefix}${path}${queryString ? `?${queryString}` : ""}`;
  }

  function isDashboardRoute(pathname = window.location.pathname) {
    return Boolean(resolveViewMatchFromPath(normalizePathname(pathname))?.view);
  }

  function resolveLocation() {
    const pathRoute = resolveViewFromPath();
    const hashRoute = resolveViewFromHash(window.location.hash);

    if (pathRoute.view) {
      return { ...pathRoute, matched: true };
    }

    if (hashRoute.view) {
      return { ...hashRoute, matched: true };
    }

    if (pathRoute.pathname === "/") {
      return {
        ...pathRoute,
        view: "overview",
        matched: true,
        defaulted: true
      };
    }

    return {
      ...pathRoute,
      matched: false,
      defaulted: false
    };
  }

  function emitRouteChange(source = "unknown") {
    try {
      window.dispatchEvent(
        new CustomEvent(ROUTE_CHANGE_EVENT, {
          detail: {
            source,
            route: resolveLocation()
          }
        })
      );
    } catch (err) {
      console.warn("[Dashboard] Route change event failed", err);
    }
  }

  function navigateToView(viewName, options = {}) {
    if (!viewName || !VIEW_ROUTE_DEFINITIONS[viewName]) return;
    const url = buildDashboardUrl(viewName, options);
    const method = options.replace ? "replaceState" : "pushState";
    window.history[method]({}, "", url);
    emitRouteChange(options.replace ? "replaceState" : "pushState");
  }

  function canonicalizeLegacyHashRoute(route = resolveViewFromHash(window.location.hash)) {
    if (!route?.view) return false;
    const params = new URLSearchParams(route.queryString || "");
    if (route.params && typeof route.params === "object") {
      Object.entries(route.params).forEach(([key, value]) => {
        const normalizedKey = String(key || "").trim();
        const normalizedValue = String(value || "").trim();
        if (!normalizedKey || !normalizedValue) return;
        params.set(normalizedKey, normalizedValue);
      });
    }
    const url = buildDashboardUrl(route.view, { params });
    window.history.replaceState({}, "", url);
    emitRouteChange("hash-canonicalized");
    return true;
  }

  function consumeRedirectState() {
    const params = new URLSearchParams(window.location.search || "");
    const encodedTarget = params.get(REDIRECT_QUERY_KEY);
    if (!encodedTarget) return false;

    params.delete(REDIRECT_QUERY_KEY);
    const fallbackQuery = params.toString();
    const decodedTarget = decodeURIComponent(encodedTarget);
    const parsedTarget = new URL(decodedTarget, window.location.origin);
    const requestedPath = normalizePathname(parsedTarget.pathname);
    if (!resolveViewMatchFromPath(requestedPath)?.view) {
      return false;
    }

    const search = parsedTarget.search || (fallbackQuery ? `?${fallbackQuery}` : "");
    const nextUrl = `${resolveBasePath()}${requestedPath}${search}`;
    window.history.replaceState({}, "", nextUrl);
    return true;
  }

  window.ADMIN_BASE_PATH = resolveBasePath();

  if (consumeRedirectState()) {
    emitRouteChange("redirect-state");
  }

  window.addEventListener("popstate", () => emitRouteChange("popstate"));
  window.addEventListener("hashchange", () => emitRouteChange("hashchange"));

  window.StreamSuitesAdminRoutes = Object.freeze({
    REDIRECT_QUERY_KEY,
    ROUTE_CHANGE_EVENT,
    definitions: VIEW_ROUTE_DEFINITIONS,
    resolveBasePath,
    normalizePathname,
    resolveViewFromHash,
    resolveViewFromPath,
    resolveViewName,
    resolveLocation,
    getTitleForView,
    getCanonicalPathForView,
    buildDashboardUrl,
    navigateToView,
    canonicalizeLegacyHashRoute,
    emitRouteChange,
    isDashboardRoute
  });
})();

/* ======================================================================
   StreamSuites Dashboard - admin-routes.js
   Clean path routing helpers with legacy hash compatibility.
   ====================================================================== */

(() => {
  "use strict";

  if (window.StreamSuitesAdminRoutes) return;

  const REDIRECT_QUERY_KEY = "__ss_route";
  const ROUTE_CHANGE_EVENT = "streamsuites:routechange";

  const VIEW_ROUTE_DEFINITIONS = Object.freeze({
    overview: { canonical: "/overview", aliases: ["/", "/index.html", "/home"] },
    bots: { canonical: "/telemetry", aliases: ["/bots", "/runtime-status"] },
    approvals: { canonical: "/approvals" },
    accounts: { canonical: "/users", aliases: ["/accounts"] },
    creators: { canonical: "/profiles", aliases: ["/creators"] },
    "creator-stats": { canonical: "/profiles/stats", aliases: ["/creator-stats"] },
    audit: { canonical: "/audit" },
    analytics: { canonical: "/analytics" },
    ratelimits: { canonical: "/ratelimits", aliases: ["/rate-limits"] },
    "api-usage": { canonical: "/api-usage" },
    "data-signals": { canonical: "/data-signals", aliases: ["/signals"] },
    notifications: { canonical: "/alerts", aliases: ["/notifications"] },
    jobs: { canonical: "/jobs" },
    "chat-replay": { canonical: "/chat-replay" },
    rumble: { canonical: "/integrations/rumble", aliases: ["/rumble"] },
    youtube: { canonical: "/integrations/youtube", aliases: ["/youtube"] },
    twitch: { canonical: "/integrations/twitch", aliases: ["/twitch"] },
    kick: { canonical: "/integrations/kick", aliases: ["/kick"] },
    pilled: { canonical: "/integrations/pilled", aliases: ["/pilled"] },
    twitter: { canonical: "/integrations/twitter", aliases: ["/twitter"] },
    discord: { canonical: "/integrations/discord", aliases: ["/discord"] },
    triggers: {
      canonical: "/integrations/triggers",
      aliases: ["/triggers", "/chat-triggers"]
    },
    tiers: { canonical: "/tiers" },
    clips: { canonical: "/clips" },
    polls: { canonical: "/polls" },
    tallies: { canonical: "/tallies" },
    scoreboards: { canonical: "/scoreboards" },
    "scoreboard-management": { canonical: "/scoreboard-management" },
    settings: { canonical: "/settings" },
    updates: { canonical: "/updates" },
    design: { canonical: "/design" }
  });

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
      const candidates = [config.canonical, ...(config.aliases || [])];
      candidates.forEach((candidate) => {
        pathToView.set(normalizePathname(candidate), viewName);
      });
    });
    return pathToView;
  }

  const PATH_TO_VIEW = buildPathIndex();

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
    return {
      mode: "hash",
      view: aliasView,
      query: parsed.query,
      queryString: parsed.queryString,
      legacyHash: rawHash
    };
  }

  function resolveViewFromPath(pathname = window.location.pathname, search = window.location.search) {
    const normalizedPath = normalizePathname(pathname);
    const view = PATH_TO_VIEW.get(normalizedPath) || "";
    const queryString =
      typeof search === "string" ? search.replace(/^\?/, "").trim() : "";
    return {
      mode: "path",
      view,
      pathname: normalizedPath,
      query: queryString ? `?${queryString}` : "",
      queryString
    };
  }

  function getCanonicalPathForView(viewName) {
    const config = VIEW_ROUTE_DEFINITIONS[viewName];
    if (!config) return "/overview";
    return normalizePathname(config.canonical);
  }

  function buildDashboardUrl(viewName, options = {}) {
    const basePath = resolveBasePath();
    const canonicalPath = getCanonicalPathForView(viewName);
    const params = options.params instanceof URLSearchParams
      ? options.params
      : new URLSearchParams(options.params || "");
    const queryString = params.toString();
    const path = canonicalPath === "/" ? "/" : canonicalPath;
    const prefix = basePath || "";
    return `${prefix}${path}${queryString ? `?${queryString}` : ""}`;
  }

  function isDashboardRoute(pathname = window.location.pathname) {
    return Boolean(PATH_TO_VIEW.get(normalizePathname(pathname)));
  }

  function resolveLocation() {
    const hashRoute = resolveViewFromHash(window.location.hash);
    const pathRoute = resolveViewFromPath();

    if (pathRoute.view) {
      return pathRoute;
    }

    if (hashRoute.view) {
      return hashRoute;
    }

    return {
      mode: "path",
      view: "overview",
      pathname: normalizePathname(window.location.pathname),
      query: window.location.search || "",
      queryString: String(window.location.search || "").replace(/^\?/, "")
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
    const url = buildDashboardUrl(route.view, { params: route.queryString });
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
    if (!PATH_TO_VIEW.get(requestedPath)) {
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
    resolveLocation,
    getCanonicalPathForView,
    buildDashboardUrl,
    navigateToView,
    canonicalizeLegacyHashRoute,
    emitRouteChange,
    isDashboardRoute
  });
})();

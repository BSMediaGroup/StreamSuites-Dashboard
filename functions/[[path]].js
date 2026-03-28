const SPA_SHELL_CANDIDATES = ["/index.html"];

const EXACT_DASHBOARD_ROUTES = new Set([
  "/",
  "/home",
  "/overview",
  "/users",
  "/accounts",
  "/profiles",
  "/creators",
  "/creator-integrations",
  "/profiles/stats",
  "/creator-stats",
  "/telemetry",
  "/bots",
  "/runtime-status",
  "/approvals",
  "/audit",
  "/analytics",
  "/analytics-alerts",
  "/alerts",
  "/notifications",
  "/inbox",
  "/ratelimits",
  "/rate-limits",
  "/api-usage",
  "/data-signals",
  "/signals",
  "/jobs",
  "/chat-replay",
  "/tiers",
  "/clips",
  "/polls",
  "/tallies",
  "/scoreboards",
  "/scoreboard-management",
  "/settings",
  "/updates",
  "/design",
  "/rumble",
  "/youtube",
  "/twitch",
  "/kick",
  "/pilled",
  "/twitter",
  "/discord",
  "/triggers",
  "/chat-triggers"
]);

const PREFIX_DASHBOARD_ROUTES = ["/users/", "/profiles/", "/integrations/"];

function normalizePathname(pathname) {
  let normalized = typeof pathname === "string" && pathname.trim() ? pathname.trim() : "/";
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  normalized = normalized.replace(/\/{2,}/g, "/");
  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/, "");
  }
  return normalized || "/";
}

function isDashboardSpaRoute(pathname) {
  const normalized = normalizePathname(pathname);
  if (EXACT_DASHBOARD_ROUTES.has(normalized)) {
    return true;
  }
  return PREFIX_DASHBOARD_ROUTES.some((prefix) => normalized.startsWith(prefix));
}

async function fetchSpaShell(ctx) {
  for (const candidate of SPA_SHELL_CANDIDATES) {
    const response = await ctx.next(candidate);
    if (response.ok) {
      return response;
    }
  }
  return null;
}

function buildFallbackResponse(shellResponse, requestMethod) {
  const headers = new Headers(shellResponse.headers);
  headers.set("x-ss-spa-fallback", "pages-function");
  headers.delete("content-length");
  return new Response(requestMethod === "HEAD" ? null : shellResponse.body, {
    status: 200,
    headers
  });
}

export async function onRequest(ctx) {
  const response = await ctx.next();
  if (response.status !== 404) {
    return response;
  }

  const { request } = ctx;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return response;
  }

  const { pathname } = new URL(request.url);
  if (!isDashboardSpaRoute(pathname)) {
    return response;
  }

  const shellResponse = await fetchSpaShell(ctx);
  if (!shellResponse) {
    return response;
  }

  return buildFallbackResponse(shellResponse, request.method);
}

const SPA_SHELL_PATH = "/index.html";

const EXACT_DASHBOARD_ROUTES = new Set([
  "/",
  "/home",
  "/overview",
  "/users",
  "/accounts",
  "/profiles",
  "/profiles/integrations",
  "/profiles/stats",
  "/creators",
  "/creator-integrations",
  "/creator-stats",
  "/studio",
  "/studio/access",
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
  "/progression",
  "/xp",
  "/ranks",
  "/economy",
  "/economy-inventory",
  "/inventory",
  "/public-identities",
  "/accounts/public-identities",
  "/chat-replay",
  "/tiers",
  "/clips",
  "/polls",
  "/tallies",
  "/scoreboards",
  "/scoreboard-management",
  "/settings",
  "/permissions",
  "/updates",
  "/design",
  "/integrations/triggers",
  "/integrations/rumble",
  "/integrations/youtube",
  "/integrations/twitch",
  "/integrations/kick",
  "/integrations/pilled",
  "/integrations/twitter",
  "/integrations/discord",
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

const PREFIX_DASHBOARD_ROUTES = ["/users/"];

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
  const { env, request } = ctx;
  const assetUrl = new URL(request.url);
  assetUrl.pathname = SPA_SHELL_PATH;
  assetUrl.search = "";
  assetUrl.hash = "";

  if (typeof env?.ASSETS?.fetch === "function") {
    const assetRequest = new Request(assetUrl.toString(), {
      method: request.method,
      headers: request.headers
    });
    return env.ASSETS.fetch(assetRequest);
  }

  return ctx.next(SPA_SHELL_PATH);
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
  if (!shellResponse?.ok) {
    return response;
  }

  return buildFallbackResponse(shellResponse, request.method);
}

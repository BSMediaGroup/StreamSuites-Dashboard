/* ======================================================================
   StreamSuites™ Dashboard — Admin Gate (Hard Authorization)
   - Server-side session introspection (Auth API)
   - Role == "admin" required
   - Fail-closed by default
   ====================================================================== */

(() => {
  "use strict";

  if (window.StreamSuitesAdminGate) return;

  const resolvedBasePath = (() => {
    const configured =
      typeof window.ADMIN_BASE_PATH === "string" ? window.ADMIN_BASE_PATH.trim() : "";
    const normalized = configured.replace(/\/+$/, "");
    if (!normalized) return "";
    const pathname = window.location?.pathname || "";
    if (pathname === normalized || pathname.startsWith(`${normalized}/`)) {
      return normalized;
    }
    return "";
  })();

  if (resolvedBasePath !== window.ADMIN_BASE_PATH) {
    window.ADMIN_BASE_PATH = resolvedBasePath;
  }

  function getMetaContent(name) {
    const value = document.querySelector(`meta[name="${name}"]`)?.getAttribute("content");
    return typeof value === "string" ? value.trim() : "";
  }

  const AUTH_API_BASE =
    getMetaContent("streamsuites-auth-base") || "https://api.streamsuites.app";
  const AUTH_API_BASE_NORMALIZED = AUTH_API_BASE.replace(/\/+$/, "");
  const ADMIN_ORIGIN = "https://admin.streamsuites.app";
  const ADMIN_SUCCESS = ADMIN_ORIGIN + "/auth/success.html";
  const ADMIN_SURFACE = "admin";
  const ADMIN_DASH = `${ADMIN_ORIGIN}/`;
  const ADMIN_HOSTNAME = "admin.streamsuites.app";
  const PUBLIC_HOSTNAMES = new Set(["streamsuites.app", "www.streamsuites.app"]);
  const ADMIN_INDEX_URL = ADMIN_DASH;
  const ADMIN_LOGOUT_REDIRECT = new URL(
    `${window.ADMIN_BASE_PATH}/auth/login.html?reason=logout`,
    ADMIN_ORIGIN
  ).toString();
  const ADMIN_LOGIN_URL = new URL(`${window.ADMIN_BASE_PATH}/auth/login.html`, ADMIN_ORIGIN);
  const SESSION_ENDPOINT = `${AUTH_API_BASE_NORMALIZED}/auth/session`;
  const LOGOUT_ENDPOINT = `${AUTH_API_BASE_NORMALIZED}/auth/logout`;
  const LAST_OAUTH_PROVIDER_KEY = "streamsuites.admin.lastOauthProvider";
  const X_EMAIL_BANNER_DISMISSED_KEY = "streamsuites.admin.banner.xMissingEmail.dismissed";
  const ADMIN_LOGIN_GOOGLE_URL = buildAdminOAuthEndpoint(
    `${AUTH_API_BASE_NORMALIZED}/auth/login/google`
  );
  const ADMIN_LOGIN_GITHUB_URL = buildAdminOAuthEndpoint(
    `${AUTH_API_BASE_NORMALIZED}/auth/login/github`
  );
  const AUTHORIZED_ROLE = "admin";
  const SESSION_IDLE_REASON = "cookie_missing";
  const SESSION_RETRY_MIN_INTERVAL_MS = 7000;
  const AUTH_REASON_HEADERS = [
    "x-auth-reason",
    "x-streamsuites-auth-reason",
    "x-auth-status"
  ];

  function parseUrl(value, base = ADMIN_ORIGIN) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      return new URL(value, base);
    } catch (err) {
      return null;
    }
  }

  function isPublicHost(value) {
    const parsed = parseUrl(value);
    if (!parsed) return false;
    return PUBLIC_HOSTNAMES.has(parsed.hostname.toLowerCase());
  }

  function normalizeAdminSuccess(value) {
    const parsed = parseUrl(value);
    if (!parsed) return ADMIN_SUCCESS;
    if (PUBLIC_HOSTNAMES.has(parsed.hostname.toLowerCase())) return ADMIN_SUCCESS;
    if (parsed.hostname.toLowerCase() !== ADMIN_HOSTNAME) return ADMIN_SUCCESS;
    return ADMIN_SUCCESS;
  }

  function normalizeAdminDash(value) {
    const parsed = parseUrl(value);
    if (!parsed) return ADMIN_DASH;
    if (PUBLIC_HOSTNAMES.has(parsed.hostname.toLowerCase())) return ADMIN_DASH;
    if (parsed.hostname.toLowerCase() !== ADMIN_HOSTNAME) return ADMIN_DASH;
    return `${parsed.origin}/`;
  }

  function applyAdminOAuthSafety(endpoint) {
    endpoint.searchParams.set("surface", ADMIN_SURFACE);

    const currentReturnTo = endpoint.searchParams.get("return_to");
    if (!currentReturnTo || isPublicHost(currentReturnTo)) {
      endpoint.searchParams.set("return_to", ADMIN_SUCCESS);
    } else {
      endpoint.searchParams.set("return_to", normalizeAdminSuccess(currentReturnTo));
    }

    ["redirect", "success_url", "callback_url"].forEach((paramName) => {
      const currentValue = endpoint.searchParams.get(paramName);
      if (currentValue && isPublicHost(currentValue)) {
        endpoint.searchParams.set(paramName, ADMIN_SUCCESS);
        return;
      }
      endpoint.searchParams.set(paramName, normalizeAdminSuccess(currentValue));
    });

    ["redirect_to", "post_login_redirect", "next"].forEach((paramName) => {
      const currentValue = endpoint.searchParams.get(paramName);
      endpoint.searchParams.set(paramName, normalizeAdminDash(currentValue));
    });

    return endpoint;
  }

  function buildAdminOAuthEndpoint(endpointValue) {
    const endpoint = parseUrl(endpointValue, ADMIN_ORIGIN);
    if (!endpoint) return "";

    applyAdminOAuthSafety(endpoint);
    return endpoint.toString();
  }

  function enforceAdminOAuthEndpoint(endpointValue) {
    const endpoint = parseUrl(endpointValue, ADMIN_ORIGIN);
    if (!endpoint) return "";
    applyAdminOAuthSafety(endpoint);
    return endpoint.toString();
  }

  const docEl = document.documentElement;
  docEl.classList.add("admin-gate-pending");

  const originalFetch = window.fetch?.bind(window);

  const gate = {
    status: "pending",
    shouldBlock: true,
    admin: null,
    lastCheckedAt: 0,
    inFlight: null,
    queued: false,
    scriptsLoaded: false,
    scriptQueue: [],
    overlay: null,
    overlayLoginGoogle: null,
    overlayLoginGithub: null,
    overlayLogout: null,
    refreshTimer: null,
    loggedOut: false,
    redirectedToLogin: false,
    bootstrapStarted: false,
    fetch: originalFetch,
    routeHandler: null,
    visibilityHandler: null,
    silentFailureCount: 0,
    silentFailureNotified: false,
    sessionIdle: {
      active: false,
      reason: "",
      lastAttemptAt: 0,
      notified: false
    }
  };

  window.StreamSuitesAdminGate = gate;

  function updateDashboardGuard(overrides = {}) {
    const existing = window.StreamSuitesDashboardGuard || {};
    const shouldBlock = Boolean(overrides.shouldBlock ?? existing.shouldBlock);
    window.StreamSuitesDashboardGuard = {
      ...existing,
      ...overrides,
      shouldBlock
    };
  }

  updateDashboardGuard({
    shouldBlock: true,
    adminGateStatus: "pending"
  });

  function ensureOverlay() {
    if (gate.overlay) return gate.overlay;
    const overlay = document.createElement("div");
    overlay.id = "admin-gate-screen";
    overlay.innerHTML = `
      <div class="admin-gate-card" role="status" aria-live="polite">
        <div class="admin-gate-title">Authorizing</div>
        <div class="admin-gate-message">Checking administrator session.</div>
        <div class="admin-gate-status">Pending</div>
        <div class="admin-gate-actions">
          <button id="admin-gate-login-google" class="ss-btn ss-btn-primary hidden">
            Login as Administrator
          </button>
          <button id="admin-gate-login-github" class="ss-btn ss-btn-secondary hidden">
            Login with GitHub
          </button>
          <button id="admin-gate-logout" class="ss-btn ss-btn-secondary hidden">
            Sign out
          </button>
        </div>
      </div>
    `;
    gate.overlay = overlay;
    gate.overlayLoginGoogle = overlay.querySelector("#admin-gate-login-google");
    gate.overlayLoginGithub = overlay.querySelector("#admin-gate-login-github");
    gate.overlayLogout = overlay.querySelector("#admin-gate-logout");
    if (document.body) {
      document.body.appendChild(overlay);
    } else {
      document.addEventListener(
        "DOMContentLoaded",
        () => document.body.appendChild(overlay),
        { once: true }
      );
    }
    return overlay;
  }

  function setOverlayContent({
    title,
    message,
    status,
    showGoogle = false,
    showGithub = false,
    showLogout = false
  }) {
    const overlay = ensureOverlay();
    const titleEl = overlay.querySelector(".admin-gate-title");
    const messageEl = overlay.querySelector(".admin-gate-message");
    const statusEl = overlay.querySelector(".admin-gate-status");
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (statusEl) statusEl.textContent = status;
    if (gate.overlayLoginGoogle) {
      gate.overlayLoginGoogle.classList.toggle("hidden", !showGoogle);
    }
    if (gate.overlayLoginGithub) {
      gate.overlayLoginGithub.classList.toggle("hidden", !showGithub);
    }
    if (gate.overlayLogout) {
      gate.overlayLogout.classList.toggle("hidden", !showLogout);
    }
  }

  function setHtmlState(stateClass) {
    docEl.classList.remove(
      "admin-gate-pending",
      "admin-gate-denied",
      "admin-gate-unavailable",
      "admin-gate-ready"
    );
    if (stateClass) {
      docEl.classList.add(stateClass);
    }
  }

  function normalizeSessionPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return { authenticated: false };
    }

    const email = coerceText(payload.email || payload.session?.email || payload.user?.email);
    const name = coerceText(
      payload.name || payload.display_name || payload.user?.name || payload.user?.display_name
    );
    const provider = normalizeProvider(
      payload.provider ||
        payload.auth_provider ||
        payload.session?.provider ||
        payload.session?.auth_provider ||
        payload.user?.provider ||
        payload.user?.auth_provider
    );
    const role = normalizeRole(payload);

    return {
      authenticated: Boolean(role),
      email,
      name,
      role: role || "",
      provider: provider || getLastOauthProvider(),
      tier: coerceText(payload.tier || payload.session?.tier || payload.user?.tier || payload.plan),
      avatarUrl: coerceText(payload.avatar_url || payload.avatarUrl || payload.user?.avatar_url)
    };
  }

  function normalizeRole(payload) {
    if (!payload || typeof payload !== "object") return null;
    if (typeof payload.role === "string") {
      return payload.role.trim().toLowerCase();
    }
    if (typeof payload.user?.role === "string") {
      return payload.user.role.trim().toLowerCase();
    }
    return null;
  }

  function normalizeProvider(value) {
    const normalized = coerceText(value).toLowerCase();
    if (!normalized) return "";
    if (normalized === "twitter") return "x";
    return normalized;
  }

  function readLocalStorageValue(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch (err) {
      return "";
    }
  }

  function writeLocalStorageValue(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      // Ignore storage write errors.
    }
  }

  function getLastOauthProvider() {
    return normalizeProvider(readLocalStorageValue(LAST_OAUTH_PROVIDER_KEY));
  }

  function persistLastOauthProvider(provider) {
    const normalized = normalizeProvider(provider);
    if (!normalized) return;
    writeLocalStorageValue(LAST_OAUTH_PROVIDER_KEY, normalized);
  }

  function normalizeAuthReason(value) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return "";
    if (trimmed.includes(SESSION_IDLE_REASON)) return SESSION_IDLE_REASON;
    return trimmed;
  }

  function resolveAuthReason(payload, response) {
    if (!payload || typeof payload !== "object") {
      const headerReason =
        response?.headers &&
        AUTH_REASON_HEADERS.map((header) => response.headers.get(header)).find(Boolean);
      return normalizeAuthReason(headerReason);
    }

    const candidate =
      payload.reason ||
      payload.error?.reason ||
      payload.status ||
      payload.error ||
      payload.message;

    if (candidate) {
      return normalizeAuthReason(candidate);
    }

    const headerReason =
      response?.headers &&
      AUTH_REASON_HEADERS.map((header) => response.headers.get(header)).find(Boolean);

    return normalizeAuthReason(headerReason);
  }

  async function readAuthReasonFromResponse(response) {
    if (!response) return "";
    let payload = null;
    try {
      const text = await response.clone().text();
      if (text) {
        payload = JSON.parse(text);
      }
    } catch (err) {
      payload = null;
    }
    return resolveAuthReason(payload, response);
  }

  async function ensureIdleBackoff() {
    if (!gate.sessionIdle.active || !gate.sessionIdle.lastAttemptAt) {
      gate.sessionIdle.lastAttemptAt = Date.now();
      return;
    }
    const now = Date.now();
    const nextAllowedAt = gate.sessionIdle.lastAttemptAt + SESSION_RETRY_MIN_INTERVAL_MS;
    if (now < nextAllowedAt) {
      await new Promise((resolve) => setTimeout(resolve, nextAllowedAt - now));
    }
    gate.sessionIdle.lastAttemptAt = Date.now();
  }

  function isAuthenticatedSession(payload) {
    return Boolean(
      payload?.authenticated ??
        payload?.isAuthenticated ??
        payload?.session?.authenticated ??
        payload?.session?.isAuthenticated
    );
  }

  function coerceText(value) {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return String(value);
    return "";
  }

  function resolveTierLabel(value) {
    if (value === undefined || value === null) return "";
    const text = String(value).trim();
    if (!text) return "";
    const normalized = text.toLowerCase();
    if (normalized === "open") return "Core";
    return text;
  }

  function updateHeaderIdentity(admin) {
    const headerWrap = document.getElementById("admin-auth-indicator");
    const headerAvatar = document.getElementById("admin-auth-avatar");
    const headerName = document.getElementById("admin-auth-name");
    const headerIdentity = document.getElementById("admin-auth-identity");
    const headerRole = document.getElementById("admin-auth-role");
    const headerTier = document.getElementById("admin-auth-tier");
    const headerNameText = headerName?.querySelector(".streamsuites-auth-name-text");
    const headerTierBadge = headerName?.querySelector(".streamsuites-auth-tier-badge");
    const fallbackAvatar = `${window.ADMIN_BASE_PATH}/assets/icons/ui/profile.svg`;

    if (!headerWrap) return;

    if (!admin) {
      headerWrap.classList.add("hidden");
      return;
    }

    if (headerName) {
      const displayName = admin.name || admin.email || "Administrator";
      if (headerNameText) {
        headerNameText.textContent = displayName;
      } else {
        headerName.textContent = displayName;
      }
    }
    if (headerIdentity) {
      headerIdentity.textContent = admin.email || "admin@streamsuites.app";
    }
    if (headerRole) {
      headerRole.textContent = "Admin";
    }
    if (headerTier) {
      const resolvedTier = admin.tier ? resolveTierLabel(admin.tier).toUpperCase() : "CORE";
      headerTier.textContent = resolvedTier;
      headerTier.dataset.tier = resolvedTier;
      if (headerTierBadge) {
        const badgeTier = resolvedTier.toLowerCase();
        headerTierBadge.src = `${window.ADMIN_BASE_PATH}/assets/icons/tierbadge-${badgeTier}.svg`;
        headerTierBadge.dataset.tier = resolvedTier;
      }
    }
    if (headerAvatar) {
      const resolvedAvatar = admin.avatarUrl || fallbackAvatar;
      headerAvatar.src = resolvedAvatar;
      headerAvatar.classList.toggle("is-avatar", Boolean(admin.avatarUrl));
    }

    headerWrap.classList.remove("hidden");
  }

  function markAuthorized(payload) {
    gate.status = "authorized";
    gate.shouldBlock = false;
    gate.lastCheckedAt = Date.now();
    gate.silentFailureCount = 0;
    gate.silentFailureNotified = false;
    setSessionBanner("", false);
    gate.admin = {
      authenticated: true,
      email: payload?.email || "",
      name: payload?.name || "",
      role: payload?.role || "",
      provider: payload?.provider || "",
      tier: payload?.tier || "",
      avatarUrl: payload?.avatarUrl || ""
    };
    if (gate.admin.provider) {
      persistLastOauthProvider(gate.admin.provider);
    }
    updateDashboardGuard({
      shouldBlock: false,
      adminGateStatus: "authorized",
      adminEmail: gate.admin.email,
      adminRole: gate.admin.role
    });
    setHtmlState("admin-gate-ready");
    if (gate.overlay) {
      gate.overlay.remove();
      gate.overlay = null;
    }
    updateXEmailBanner(gate.admin);
    updateHeaderIdentity(gate.admin);
    window.StreamSuitesAdminSession = {
      ...gate.admin,
      checkedAt: gate.lastCheckedAt
    };
    window.dispatchEvent(
      new CustomEvent("streamsuites:admin-auth", {
        detail: {
          authorized: true,
          admin: gate.admin
        }
      })
    );
    window.dispatchEvent(
      new CustomEvent("streamsuites:admin-authorized", {
        detail: {
          authorized: true
        }
      })
    );
  }

  function markDenied(reason, message) {
    gate.status = reason;
    gate.shouldBlock = true;
    gate.admin = null;
    removeXEmailBanner();
    gate.lastCheckedAt = Date.now();
    updateHeaderIdentity(null);
    updateDashboardGuard({
      shouldBlock: true,
      adminGateStatus: reason
    });
    setHtmlState(reason === "unavailable" ? "admin-gate-unavailable" : "admin-gate-denied");
    setOverlayContent({
      title: reason === "forbidden" ? "Not Authorized" : "Service Unavailable",
      message,
      status: reason === "forbidden" ? "Denied" : "Unavailable",
      showGoogle: reason === "forbidden",
      showGithub: reason === "forbidden",
      showLogout: reason === "forbidden"
    });
    window.dispatchEvent(
      new CustomEvent("streamsuites:admin-auth", {
        detail: {
          authorized: false,
          reason
        }
      })
    );
  }

  function setSessionBanner(message, visible, variant = "warning") {
    let banner = document.getElementById("admin-session-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "admin-session-banner";
      banner.className = "ss-alert ss-alert-warning hidden";
      banner.setAttribute("role", "status");
      if (document.body) {
        document.body.prepend(banner);
      } else {
        document.addEventListener(
          "DOMContentLoaded",
          () => document.body.prepend(banner),
          { once: true }
        );
      }
    }
    if (message) {
      banner.textContent = message;
    }
    banner.classList.toggle("hidden", !visible);
    banner.classList.toggle("ss-alert-warning", variant === "warning");
    banner.classList.toggle("ss-alert-danger", variant === "danger");
    banner.classList.toggle("ss-alert-success", variant === "success");
  }

  function removeXEmailBanner() {
    const banner = document.getElementById("admin-x-email-banner");
    if (!banner) return;
    banner.remove();
  }

  function buildXEmailBanner() {
    const banner = document.createElement("div");
    banner.id = "admin-x-email-banner";
    banner.className = "ss-alert admin-x-email-banner";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");

    const message = document.createElement("span");
    message.textContent =
      "Your X account is connected without an email. You can add one later from account settings.";

    const actions = document.createElement("div");
    actions.className = "admin-x-email-banner-actions";

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "admin-x-email-banner-dismiss";
    dismiss.textContent = "Dismiss";
    dismiss.addEventListener("click", () => {
      writeLocalStorageValue(X_EMAIL_BANNER_DISMISSED_KEY, "1");
      banner.hidden = true;
    });

    actions.appendChild(dismiss);
    banner.append(message, actions);
    return banner;
  }

  function ensureXEmailBanner() {
    let banner = document.getElementById("admin-x-email-banner");
    if (!banner) {
      banner = buildXEmailBanner();
      if (document.body) {
        document.body.prepend(banner);
      } else {
        document.addEventListener("DOMContentLoaded", () => document.body.prepend(banner), {
          once: true
        });
      }
    }
    return banner;
  }

  function shouldShowXEmailBanner(admin) {
    if (!admin || admin.authenticated !== true) return false;
    if (normalizeRole({ role: admin.role }) !== AUTHORIZED_ROLE) return false;
    const provider = normalizeProvider(admin.provider || getLastOauthProvider());
    if (provider !== "x") return false;
    if (coerceText(admin.email)) return false;
    return readLocalStorageValue(X_EMAIL_BANNER_DISMISSED_KEY) !== "1";
  }

  function updateXEmailBanner(admin) {
    if (!shouldShowXEmailBanner(admin)) {
      removeXEmailBanner();
      return;
    }
    const banner = ensureXEmailBanner();
    banner.hidden = false;
  }

  function notifySessionInvalid(message) {
    setSessionBanner(message, true, "danger");
  }

  function resolveCheckMode(requested) {
    if (requested === "blocking") return "blocking";
    if (gate.shouldBlock || gate.status !== "authorized") return "blocking";
    return "silent";
  }

  function redirectToLogin({ surface = "admin" } = {}) {
    const url = new URL(ADMIN_LOGIN_URL.toString());
    if (surface) {
      url.searchParams.set("surface", surface);
    }
    window.location.assign(url.toString());
  }

  async function introspectSession() {
    if (!gate.fetch) {
      throw new Error("Fetch unavailable for admin gate.");
    }

    const response = await gate.fetch(SESSION_ENDPOINT, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (response.status === 401 || response.status === 403) {
      const reason =
        response.status === 401 ? await readAuthReasonFromResponse(response) : "";
      return { status: "unauthenticated", reason };
    }

    if (!response.ok) {
      return { status: "unavailable", statusCode: response.status };
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (err) {
      return { status: "unavailable", error: err };
    }

    const normalized = normalizeSessionPayload(payload);
    const role = normalizeRole(payload);
    const authenticated = isAuthenticatedSession(payload) || Boolean(role);

    if (role === AUTHORIZED_ROLE) {
      return { status: "authorized", payload: { ...normalized, role: AUTHORIZED_ROLE } };
    }

    if (authenticated) {
      return { status: "forbidden", payload };
    }

    return { status: "unauthenticated", payload };
  }

  async function authorize({ reason = "initial", mode, force = false } = {}) {
    if (gate.loggedOut || gate.redirectedToLogin) return null;
    if (gate.sessionIdle.active && !force) return null;
    if (gate.inFlight) {
      gate.queued = true;
      return gate.inFlight;
    }

    gate.inFlight = (async () => {
      if (gate.sessionIdle.active && force) {
        await ensureIdleBackoff();
      }
      const resolvedMode = resolveCheckMode(mode || (reason === "initial" ? "blocking" : "silent"));
      const isBlocking = resolvedMode === "blocking";
      if (isBlocking) {
        setHtmlState("admin-gate-pending");
        updateDashboardGuard({ shouldBlock: true, adminGateStatus: "pending" });
      }

      let result = null;
      try {
        result = await introspectSession();
      } catch (err) {
        result = { status: "unavailable", error: err };
      }

      if (result.status === "authorized") {
        gate.sessionIdle.active = false;
        gate.sessionIdle.reason = "";
        gate.sessionIdle.notified = false;
        markAuthorized(result.payload);
      } else if (result.status === "unauthenticated") {
        const isIdle = result.reason === SESSION_IDLE_REASON;
        gate.sessionIdle.active = isIdle;
        gate.sessionIdle.reason = isIdle ? result.reason : "";
        if (isIdle) {
          gate.sessionIdle.lastAttemptAt = Date.now();
        }
        if (isIdle && !gate.sessionIdle.notified) {
          console.info("[Admin Gate] Session idle (cookie missing).");
          gate.sessionIdle.notified = true;
        }
        gate.silentFailureCount = 0;
        gate.silentFailureNotified = false;
        gate.status = "unauthenticated";
        gate.shouldBlock = true;
        removeXEmailBanner();
        updateDashboardGuard({
          shouldBlock: true,
          adminGateStatus: "unauthenticated"
        });
        if (isIdle) {
          window.dispatchEvent(
            new CustomEvent("streamsuites:admin-auth", {
              detail: {
                authorized: false,
                reason: "unauthenticated"
              }
            })
          );
          gate.redirectedToLogin = true;
          gate.stopPolling({ hideActions: true, markLoggedOut: true });
          gate.inFlight = null;
          window.location.replace("/auth/login.html");
          return;
        }
        if (isBlocking) {
          setHtmlState("admin-gate-pending");
          setOverlayContent({
            title: "Redirecting",
            message: "Admin login required. Redirecting to login...",
            status: "Login",
            showGoogle: true,
            showGithub: true
          });
        } else {
          notifySessionInvalid("Admin session expired. Redirecting to login.");
        }
        window.dispatchEvent(
          new CustomEvent("streamsuites:admin-auth", {
            detail: {
              authorized: false,
              reason: "unauthenticated"
            }
          })
        );
        gate.redirectedToLogin = true;
        gate.stopPolling({ hideActions: false, markLoggedOut: true });
        window.setTimeout(() => redirectToLogin({ surface: "admin" }), isBlocking ? 0 : 1200);
      } else if (result.status === "forbidden") {
        gate.sessionIdle.active = false;
        gate.sessionIdle.reason = "";
        gate.sessionIdle.notified = false;
        gate.silentFailureCount = 0;
        gate.silentFailureNotified = false;
        if (isBlocking) {
          markDenied("forbidden", "This area requires administrator access.");
        } else {
          gate.status = "forbidden";
          gate.shouldBlock = true;
          removeXEmailBanner();
          updateDashboardGuard({
            shouldBlock: true,
            adminGateStatus: "forbidden"
          });
          notifySessionInvalid("Admin access revoked. Redirecting to login.");
          gate.redirectedToLogin = true;
          gate.stopPolling({ hideActions: false, markLoggedOut: true });
          window.setTimeout(() => redirectToLogin({ surface: "admin" }), 1200);
        }
      } else {
        gate.sessionIdle.active = false;
        gate.sessionIdle.reason = "";
        gate.sessionIdle.notified = false;
        removeXEmailBanner();
        if (isBlocking) {
          markDenied(
            "unavailable",
            "Authorization service is unavailable. Please try again later."
          );
        } else {
          gate.silentFailureCount += 1;
          if (gate.silentFailureCount >= 3 && !gate.silentFailureNotified) {
            gate.silentFailureNotified = true;
            setSessionBanner(
              "Authorization service is unavailable. We will keep trying in the background.",
              true,
              "warning"
            );
          }
        }
      }

      gate.inFlight = null;
      if (gate.queued) {
        gate.queued = false;
        authorize({ reason: "queued" });
      }
    })();

    return gate.inFlight;
  }

  async function ensureBodyReady() {
    if (document.body) return;
    await new Promise((resolve) =>
      document.addEventListener("DOMContentLoaded", resolve, { once: true })
    );
  }

  function normalizeScriptPath(src) {
    if (typeof src !== "string") return src;
    if (/^[a-z]+:\/\//i.test(src)) return src;
    if (src.startsWith("/docs/")) return src.slice(6);
    if (src.startsWith("/")) return src.slice(1);
    return src;
  }

  async function loadScript(src) {
    await ensureBodyReady();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = normalizeScriptPath(src);
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });
  }

  async function loadScriptsSequentially(scripts) {
    for (const src of scripts) {
      await loadScript(src);
    }
  }

  async function bootstrapScripts() {
    if (gate.scriptsLoaded || gate.scriptQueue.length === 0) return;
    try {
      await loadScriptsSequentially(gate.scriptQueue);
      gate.scriptsLoaded = true;
    } catch (err) {
      console.error("[Admin Gate] Failed to load dashboard scripts", err);
      markDenied(
        "unavailable",
        "Failed to load the admin dashboard. Please try again later."
      );
    }
  }

  gate.bootstrap = async ({ scripts = [] } = {}) => {
    if (gate.bootstrapStarted) return;
    gate.bootstrapStarted = true;
    gate.scriptQueue = scripts.map(normalizeScriptPath);
    await authorize({ reason: "initial" });
    if (!gate.shouldBlock) {
      await bootstrapScripts();
    }
  };

  gate.logout = async () => {
    gate.stopPolling();
    gate.shouldBlock = true;
    removeXEmailBanner();
    updateDashboardGuard({ shouldBlock: true, adminGateStatus: "logging-out" });
    setHtmlState("admin-gate-pending");
    setOverlayContent({
      title: "Signing out",
      message: "Clearing administrator session.",
      status: "Logout"
    });
    try {
      await gate.fetch(LOGOUT_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json"
        }
      });
    } catch (err) {
      console.warn("[Admin Gate] Logout request failed", err);
    }
    window.StreamSuitesAdminSession = null;
    updateHeaderIdentity(null);
    window.location.assign(ADMIN_LOGOUT_REDIRECT);
  };

  if (originalFetch) {
    window.fetch = function (...args) {
      if (gate.shouldBlock) {
        return Promise.reject(new Error("Admin authorization required."));
      }
      return originalFetch(...args);
    };
  }

  gate.stopPolling = ({ hideActions = true, markLoggedOut = true } = {}) => {
    if (markLoggedOut) {
      gate.loggedOut = true;
    }
    gate.inFlight = null;
    gate.queued = false;
    gate.admin = null;
    removeXEmailBanner();
    window.StreamSuitesAdminSession = null;
    if (gate.refreshTimer) {
      clearInterval(gate.refreshTimer);
      gate.refreshTimer = null;
    }
    if (gate.routeHandler) {
      window.removeEventListener("hashchange", gate.routeHandler);
      window.removeEventListener("popstate", gate.routeHandler);
    }
    if (gate.visibilityHandler) {
      window.removeEventListener("visibilitychange", gate.visibilityHandler);
    }
    if (hideActions) {
      if (gate.overlayLoginGoogle) {
        gate.overlayLoginGoogle.classList.add("hidden");
      }
      if (gate.overlayLoginGithub) {
        gate.overlayLoginGithub.classList.add("hidden");
      }
      if (gate.overlayLogout) {
        gate.overlayLogout.classList.add("hidden");
      }
    }
  };

  document.addEventListener(
    "click",
    (event) => {
      const loginGoogle = event.target.closest("#admin-gate-login-google");
      if (loginGoogle) {
        event.preventDefault();
        event.stopPropagation();
        const hardenedGoogleUrl = enforceAdminOAuthEndpoint(ADMIN_LOGIN_GOOGLE_URL);
        if (hardenedGoogleUrl) {
          window.location.assign(hardenedGoogleUrl);
        }
        return;
      }
      const loginGithub = event.target.closest("#admin-gate-login-github");
      if (loginGithub) {
        event.preventDefault();
        event.stopPropagation();
        const hardenedGithubUrl = enforceAdminOAuthEndpoint(ADMIN_LOGIN_GITHUB_URL);
        if (hardenedGithubUrl) {
          window.location.assign(hardenedGithubUrl);
        }
        return;
      }
      const signOut = event.target.closest("#admin-gate-logout");
      if (signOut) {
        event.preventDefault();
        event.stopPropagation();
        gate.logout();
        return;
      }
      const headerLogout = event.target.closest("#admin-auth-logout");
      if (headerLogout) {
        event.preventDefault();
        event.stopPropagation();
        gate.logout();
      }
    },
    true
  );

  gate.routeHandler = () => authorize({ reason: "route-change", mode: "silent" });
  gate.visibilityHandler = () => {
    if (!document.hidden) {
      authorize({ reason: "visibility", mode: "silent" });
    }
  };

  window.addEventListener("hashchange", gate.routeHandler);
  window.addEventListener("popstate", gate.routeHandler);
  window.addEventListener("visibilitychange", gate.visibilityHandler);

  gate.refreshTimer = window.setInterval(() => {
    authorize({ reason: "interval", mode: "silent" });
  }, 60000);
})();

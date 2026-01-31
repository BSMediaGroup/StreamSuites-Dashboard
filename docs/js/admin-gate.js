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
  const ADMIN_ORIGIN = window.location.origin;
  const ADMIN_INDEX_URL = `${ADMIN_ORIGIN}${window.ADMIN_BASE_PATH}/index.html`;
  const ADMIN_LOGOUT_REDIRECT = new URL(
    `${window.ADMIN_BASE_PATH}/auth/login.html?reason=logout`,
    ADMIN_ORIGIN
  ).toString();
  const ADMIN_LOGIN_URL = new URL(`${window.ADMIN_BASE_PATH}/auth/login.html`, ADMIN_ORIGIN);
  const SESSION_ENDPOINT = `${AUTH_API_BASE_NORMALIZED}/auth/session`;
  const LOGOUT_ENDPOINT = `${AUTH_API_BASE_NORMALIZED}/auth/logout`;
  const ADMIN_LOGIN_GOOGLE_URL = `${AUTH_API_BASE_NORMALIZED}/auth/login/google?surface=admin`;
  const ADMIN_LOGIN_GITHUB_URL = `${AUTH_API_BASE_NORMALIZED}/auth/login/github?surface=admin`;
  const AUTHORIZED_ROLE = "admin";

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
    silentFailureNotified: false
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
    const role = normalizeRole(payload);

    return {
      authenticated: Boolean(role),
      email: email || "Administrator",
      name,
      role: role || "",
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
    const fallbackAvatar = `${window.ADMIN_BASE_PATH}/assets/icons/ui/profile.svg`;

    if (!headerWrap) return;

    if (!admin) {
      headerWrap.classList.add("hidden");
      return;
    }

    if (headerName) {
      headerName.textContent = admin.name || admin.email || "Administrator";
    }
    if (headerIdentity) {
      headerIdentity.textContent = admin.email || "admin@streamsuites.app";
    }
    if (headerRole) {
      headerRole.textContent = "Admin";
    }
    if (headerTier) {
      headerTier.textContent = admin.tier
        ? resolveTierLabel(admin.tier).toUpperCase()
        : "CORE";
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
      tier: payload?.tier || "",
      avatarUrl: payload?.avatarUrl || ""
    };
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
      return { status: "unauthenticated" };
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

  async function authorize({ reason = "initial", mode } = {}) {
    if (gate.loggedOut || gate.redirectedToLogin) return null;
    if (gate.inFlight) {
      gate.queued = true;
      return gate.inFlight;
    }

    gate.inFlight = (async () => {
      const resolvedMode = resolveCheckMode(mode || (reason === "initial" ? "blocking" : "silent"));
      const isBlocking = resolvedMode === "blocking";
      if (isBlocking) {
        setHtmlState("admin-gate-pending");
        updateDashboardGuard({ shouldBlock: true, adminGateStatus: "pending" });
        setOverlayContent({
          title: "Authorizing",
          message: "Checking administrator session.",
          status: "Pending"
        });
      }

      let result = null;
      try {
        result = await introspectSession();
      } catch (err) {
        result = { status: "unavailable", error: err };
      }

      if (result.status === "authorized") {
        markAuthorized(result.payload);
      } else if (result.status === "unauthenticated") {
        gate.silentFailureCount = 0;
        gate.silentFailureNotified = false;
        gate.status = "unauthenticated";
        gate.shouldBlock = true;
        updateDashboardGuard({
          shouldBlock: true,
          adminGateStatus: "unauthenticated"
        });
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
        gate.silentFailureCount = 0;
        gate.silentFailureNotified = false;
        if (isBlocking) {
          markDenied("forbidden", "This area requires administrator access.");
        } else {
          gate.status = "forbidden";
          gate.shouldBlock = true;
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
    ensureOverlay();
    await authorize({ reason: "initial" });
    if (!gate.shouldBlock) {
      await bootstrapScripts();
    }
  };

  gate.logout = async () => {
    gate.stopPolling();
    gate.shouldBlock = true;
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
        window.location.assign(ADMIN_LOGIN_GOOGLE_URL);
        return;
      }
      const loginGithub = event.target.closest("#admin-gate-login-github");
      if (loginGithub) {
        event.preventDefault();
        event.stopPropagation();
        window.location.assign(ADMIN_LOGIN_GITHUB_URL);
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

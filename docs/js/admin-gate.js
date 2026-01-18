/* ======================================================================
   StreamSuites™ Dashboard — Admin Gate (Hard Authorization)
   - Server-side session introspection (Auth API)
   - Role == "admin" required
   - Fail-closed by default
   ====================================================================== */

(() => {
  "use strict";

  if (window.StreamSuitesAdminGate) return;

  const AUTH_API_BASE = "https://api.streamsuites.app";
  const ADMIN_ORIGIN = "https://admin.streamsuites.app";
  const ADMIN_INDEX_URL = `${ADMIN_ORIGIN}/index.html`;
  const ADMIN_LOGOUT_REDIRECT = `${ADMIN_ORIGIN}/auth/login.html?reason=logout`;
  const ADMIN_LOGIN_URL = `https://api.streamsuites.app/auth/login?surface=admin&redirect=${encodeURIComponent(
    ADMIN_INDEX_URL
  )}`;
  const SESSION_ENDPOINT = `${AUTH_API_BASE}/auth/session`;
  const LOGOUT_ENDPOINT = `${AUTH_API_BASE}/auth/logout`;
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
    overlayAction: null,
    refreshTimer: null,
    loggedOut: false,
    bootstrapStarted: false,
    fetch: originalFetch,
    routeHandler: null,
    visibilityHandler: null
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
          <button id="admin-gate-login" class="ss-btn ss-btn-primary hidden">
            Log in as Administrator
          </button>
        </div>
      </div>
    `;
    gate.overlay = overlay;
    gate.overlayAction = overlay.querySelector("#admin-gate-login");
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

  function setOverlayContent({ title, message, status, showAction = false, actionLabel = "" }) {
    const overlay = ensureOverlay();
    const titleEl = overlay.querySelector(".admin-gate-title");
    const messageEl = overlay.querySelector(".admin-gate-message");
    const statusEl = overlay.querySelector(".admin-gate-status");
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (statusEl) statusEl.textContent = status;
    if (gate.overlayAction) {
      gate.overlayAction.textContent = actionLabel || "Log in as Administrator";
      gate.overlayAction.classList.toggle("hidden", !showAction);
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

    const email =
      typeof payload.email === "string"
        ? payload.email
        : typeof payload.user?.email === "string"
          ? payload.user.email
          : "";

    const role =
      typeof payload.role === "string"
        ? payload.role.trim().toLowerCase()
        : typeof payload.user?.role === "string"
          ? payload.user.role.trim().toLowerCase()
          : null;

    if (role !== "admin") {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      email: email || "Administrator",
      role: "admin",
      tier: payload.tier || payload.user?.tier || "OPEN"
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

  function markAuthorized(payload) {
    gate.status = "authorized";
    gate.shouldBlock = false;
    gate.lastCheckedAt = Date.now();
    gate.admin = {
      authenticated: true,
      email: payload?.email || "",
      role: payload?.role || ""
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
  }

  function markDenied(reason, message) {
    gate.status = reason;
    gate.shouldBlock = true;
    gate.admin = null;
    gate.lastCheckedAt = Date.now();
    updateDashboardGuard({
      shouldBlock: true,
      adminGateStatus: reason
    });
    setHtmlState(reason === "unavailable" ? "admin-gate-unavailable" : "admin-gate-denied");
    setOverlayContent({
      title: reason === "forbidden" ? "Not Authorized" : "Service Unavailable",
      message,
      status: reason === "forbidden" ? "Denied" : "Unavailable",
      showAction: reason === "forbidden",
      actionLabel: "Log in as Administrator"
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

  function redirectToLogin({ surface = "admin" } = {}) {
    if (!surface) {
      window.location.assign(ADMIN_LOGIN_URL);
      return;
    }
    const url = new URL(ADMIN_LOGIN_URL);
    url.searchParams.set("surface", surface);
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
    if (!normalized.authenticated) {
      const role = normalizeRole(payload);
      if (role && role !== AUTHORIZED_ROLE) {
        return { status: "forbidden", payload };
      }
      return { status: "unauthenticated", payload };
    }

    return { status: "authorized", payload: normalized };
  }

  async function authorize({ reason = "initial" } = {}) {
    if (gate.loggedOut) return null;
    if (gate.inFlight) {
      gate.queued = true;
      return gate.inFlight;
    }

    gate.inFlight = (async () => {
      setHtmlState("admin-gate-pending");
      updateDashboardGuard({ shouldBlock: true, adminGateStatus: "pending" });
      setOverlayContent({
        title: "Authorizing",
        message: "Checking administrator session.",
        status: "Pending"
      });

      let result = null;
      try {
        result = await introspectSession();
      } catch (err) {
        result = { status: "unavailable", error: err };
      }

      if (result.status === "authorized") {
        markAuthorized(result.payload);
      } else if (result.status === "unauthenticated") {
        gate.status = "unauthenticated";
        gate.shouldBlock = true;
        updateDashboardGuard({
          shouldBlock: true,
          adminGateStatus: "unauthenticated"
        });
        setHtmlState("admin-gate-pending");
        setOverlayContent({
          title: "Redirecting",
          message: "Admin login required. Redirecting to login…",
          status: "Login",
          showAction: true,
          actionLabel: "Log in as Administrator"
        });
        window.dispatchEvent(
          new CustomEvent("streamsuites:admin-auth", {
            detail: {
              authorized: false,
              reason: "unauthenticated"
            }
          })
        );
        redirectToLogin({ surface: "admin" });
      } else if (result.status === "forbidden") {
        markDenied(
          "forbidden",
          "Your account is authenticated but does not have administrator access."
        );
      } else {
        markDenied(
          "unavailable",
          "Authorization service is unavailable. Please try again later."
        );
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

  async function loadScript(src) {
    await ensureBodyReady();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
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
    gate.scriptQueue = scripts;
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

  gate.stopPolling = () => {
    gate.loggedOut = true;
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
    if (gate.overlayAction) {
      gate.overlayAction.classList.add("hidden");
    }
  };

  document.addEventListener(
    "click",
    (event) => {
      const action = event.target.closest("#admin-gate-login");
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      redirectToLogin({ surface: "admin" });
    },
    true
  );

  gate.routeHandler = () => authorize({ reason: "route-change" });
  gate.visibilityHandler = () => {
    if (!document.hidden) {
      authorize({ reason: "visibility" });
    }
  };

  window.addEventListener("hashchange", gate.routeHandler);
  window.addEventListener("popstate", gate.routeHandler);
  window.addEventListener("visibilitychange", gate.visibilityHandler);

  gate.refreshTimer = window.setInterval(() => {
    authorize({ reason: "interval" });
  }, 60000);
})();

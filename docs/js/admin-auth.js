/* ======================================================================
   StreamSuites™ Dashboard — Admin Auth Gate
   - Central StreamSuites Auth API (cookie-based sessions)
   - Admin-only access enforced client-side (fail-closed)
   ====================================================================== */

(function () {
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
  const pathname = window.location?.pathname || "";
  if (pathname.includes("/livechat/")) return;

  function shouldBlockDashboardRuntime() {
    const guard = window.StreamSuitesDashboardGuard;
    if (guard && typeof guard.shouldBlock === "boolean") {
      return guard.shouldBlock;
    }

    const currentPath = (window.location?.pathname || "").toLowerCase();
    const standaloneFlagDefined = typeof window.__STREAMSUITES_STANDALONE__ !== "undefined";
    const isLivechatPath =
      currentPath.startsWith("/streamsuites-dashboard/livechat") ||
      currentPath.endsWith("/livechat/") ||
      currentPath.endsWith("/livechat/index.html");

    return standaloneFlagDefined || isLivechatPath;
  }

  if (shouldBlockDashboardRuntime()) return;

  const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
  const SESSION_IDLE_REASON = "cookie_missing";
  const AUTH_REASON_HEADERS = [
    "x-auth-reason",
    "x-streamsuites-auth-reason",
    "x-auth-status"
  ];

  function getMetaContent(name) {
    const value = document.querySelector(`meta[name="${name}"]`)?.getAttribute("content");
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeEmail(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }

  function normalizeEmailList(list) {
    if (!Array.isArray(list)) return [];
    return list.map((entry) => normalizeEmail(entry)).filter(Boolean);
  }

  function coerceText(value) {
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    return "";
  }

  function normalizeAuthReason(value) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return "";
    if (trimmed.includes(SESSION_IDLE_REASON)) return SESSION_IDLE_REASON;
    return trimmed;
  }

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

  function resolveTierLabel(value) {
    if (value === undefined || value === null) return "";
    const text = String(value).trim();
    if (!text) return "";
    const normalized = text.toLowerCase();
    if (normalized === "open") return "Core";
    return text;
  }

  function resolveBaseAssetPath(path) {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${window.ADMIN_BASE_PATH}${normalized}`;
  }

  const AdminAuth = {
    state: {
      authenticated: false,
      authorized: false,
      role: "",
      email: "",
      displayName: "",
      avatarUrl: "",
      tier: "",
      error: ""
    },
    initialized: false,
    config: {
      baseUrl: "",
      endpoints: {
        session: "",
        logout: "",
        login: "",
        providers: {
          google: "",
          github: "",
          discord: "",
          x: "",
          twitch: ""
        }
      }
    },
    elements: {
      overlay: null,
      blocked: null,
      blockedTitle: null,
      blockedMessage: null,
      blockedActions: null,
      blockedOpen: null,
      blockedLogout: null,
      blockedCreator: null,
      modalClose: null,
      status: null,
      emailForm: null,
      emailInput: null,
      passwordInput: null,
      emailButton: null,
      oauthButtons: [],
      headerWrap: null,
      headerAvatar: null,
      headerName: null,
      headerIdentity: null,
      headerRole: null,
      headerTier: null,
      headerLogout: null
    },

    async init() {
      if (this.initialized) return this.state;
      this.initialized = true;
      this.cacheElements();
      this.loadConfig();
      this.bindEvents();
      await this.refreshSession();
      return this.state;
    },

    cacheElements() {
      this.elements.overlay = document.getElementById("admin-auth-overlay");
      this.elements.blocked = document.getElementById("admin-auth-blocked");
      this.elements.blockedTitle = document.getElementById("admin-auth-blocked-title");
      this.elements.blockedMessage = document.getElementById("admin-auth-blocked-message");
      this.elements.blockedActions = document.getElementById("admin-auth-blocked-actions");
      this.elements.blockedOpen = document.getElementById("admin-auth-open");
      this.elements.blockedLogout = document.getElementById("admin-auth-blocked-logout");
      this.elements.blockedCreator = document.getElementById("admin-auth-creator");
      this.elements.modalClose = document.getElementById("admin-auth-close");
      this.elements.status = document.getElementById("admin-auth-status");
      this.elements.emailForm = document.getElementById("admin-auth-email-form");
      this.elements.emailInput = document.getElementById("admin-auth-email");
      this.elements.passwordInput = document.getElementById("admin-auth-password");
      this.elements.emailButton = document.getElementById("admin-auth-email-submit");
      this.elements.oauthButtons = Array.from(
        document.querySelectorAll("[data-admin-auth-provider]")
      );
      this.elements.headerWrap = document.getElementById("admin-auth-indicator");
      this.elements.headerAvatar = document.getElementById("admin-auth-avatar");
      this.elements.headerName = document.getElementById("admin-auth-name");
      this.elements.headerIdentity = document.getElementById("admin-auth-identity");
      this.elements.headerRole = document.getElementById("admin-auth-role");
      this.elements.headerTier = document.getElementById("admin-auth-tier");
      this.elements.headerLogout = document.getElementById("admin-auth-logout");

      if (this.elements.headerAvatar) {
        this.elements.headerAvatar.setAttribute(
          "data-fallback",
          resolveBaseAssetPath("/assets/icons/ui/profile.svg")
        );
      }
    },

    loadConfig() {
      const baseUrl = getMetaContent("streamsuites-auth-base");
      this.config.baseUrl = baseUrl;
      this.config.endpoints.session = getMetaContent("streamsuites-auth-session");
      this.config.endpoints.logout = getMetaContent("streamsuites-auth-logout");
      this.config.endpoints.login =
        getMetaContent("streamsuites-auth-login") ||
        (baseUrl ? `${baseUrl.replace(/\/$/, "")}/auth/login` : "");
      this.config.endpoints.providers.google = getMetaContent("streamsuites-auth-google");
      this.config.endpoints.providers.github = getMetaContent("streamsuites-auth-github");
      this.config.endpoints.providers.discord = getMetaContent("streamsuites-auth-discord");
      this.config.endpoints.providers.x = getMetaContent("streamsuites-auth-x");
      this.config.endpoints.providers.twitch = getMetaContent("streamsuites-auth-twitch");

      const base = baseUrl ? baseUrl.replace(/\/$/, "") : "";
      const defaultOAuthEndpoint = (provider) => {
        if (!base) return "";
        return `${base}/auth/login/${provider}`;
      };

      this.config.endpoints.providers.google = buildAdminOAuthEndpoint(
        defaultOAuthEndpoint("google") || this.config.endpoints.providers.google
      );
      this.config.endpoints.providers.github = buildAdminOAuthEndpoint(
        defaultOAuthEndpoint("github") || this.config.endpoints.providers.github
      );
      this.config.endpoints.providers.discord = buildAdminOAuthEndpoint(
        defaultOAuthEndpoint("discord") || this.config.endpoints.providers.discord
      );
      this.config.endpoints.providers.x = buildAdminOAuthEndpoint(
        this.config.endpoints.providers.x || (base ? `${base}/auth/x/start` : "")
      );
      this.config.endpoints.providers.twitch =
        this.config.endpoints.providers.twitch || (base ? `${base}/oauth/twitch/start` : "");
    },

    bindEvents() {
      if (this.elements.modalClose) {
        this.elements.modalClose.addEventListener("click", () => this.closeOverlay());
      }

      if (this.elements.overlay) {
        this.elements.overlay.addEventListener("click", (event) => {
          if (event.target === this.elements.overlay) {
            this.closeOverlay();
          }
        });
      }

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.isOverlayOpen()) {
          this.closeOverlay();
        }
      });

      if (this.elements.blockedOpen) {
        this.elements.blockedOpen.addEventListener("click", () => {
          if (this.state.authenticated && !this.state.authorized) {
            window.location.assign(this.getAdminLoginUrl({ surface: "admin" }));
            return;
          }
          this.openOverlay();
        });
      }

      if (this.elements.blockedLogout) {
        this.elements.blockedLogout.addEventListener("click", () => this.logout());
      }

      if (this.elements.headerLogout) {
        this.elements.headerLogout.addEventListener("click", () => this.logout());
      }

      if (this.elements.emailForm) {
        this.elements.emailForm.addEventListener("submit", (event) => {
          event.preventDefault();
          void this.submitEmergencyLogin();
        });
      }

      this.elements.oauthButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const provider = button.getAttribute("data-admin-auth-provider");
          if (provider) {
            this.startOAuth(provider);
          }
        });
      });
    },

    isOverlayOpen() {
      return Boolean(this.elements.overlay && !this.elements.overlay.classList.contains("hidden"));
    },

    openOverlay() {
      if (this.elements.overlay) {
        this.elements.overlay.classList.remove("hidden");
      }
      if (this.elements.blocked) {
        this.elements.blocked.classList.add("hidden");
      }
    },

    closeOverlay() {
      if (this.elements.overlay) {
        this.elements.overlay.classList.add("hidden");
      }
      if (this.elements.blocked) {
        this.elements.blocked.classList.remove("hidden");
      }
    },

    setStatus(state, message) {
      if (!this.elements.status) return;
      this.elements.status.dataset.state = state;
      this.elements.status.textContent = message || "";
    },

    setLoading(isLoading) {
      document.body.classList.toggle("admin-auth-loading", isLoading);
      const controls = [
        ...this.elements.oauthButtons,
        this.elements.emailInput,
        this.elements.passwordInput,
        this.elements.emailButton
      ].filter(Boolean);
      controls.forEach((control) => {
        control.disabled = isLoading;
      });
    },

    setHeaderIdentity({ name, email, role, avatarUrl, tier }) {
      if (!this.elements.headerWrap) return;
      const fallbackAvatar =
        this.elements.headerAvatar?.getAttribute("data-fallback") ||
        resolveBaseAssetPath("/assets/icons/ui/profile.svg");
      const headerNameText = this.elements.headerName?.querySelector(
        ".streamsuites-auth-name-text"
      );
      const headerTierBadge = this.elements.headerName?.querySelector(
        ".streamsuites-auth-tier-badge"
      );
      const headerAdminBadge = this.elements.headerName?.querySelector(
        ".streamsuites-auth-admin-badge"
      );
      if (this.elements.headerName) {
        const displayName = name || email || "Administrator";
        if (headerNameText) {
          headerNameText.textContent = displayName;
        } else {
          this.elements.headerName.textContent = displayName;
        }
      }
      if (this.elements.headerIdentity) {
        this.elements.headerIdentity.textContent = email || "admin@streamsuites.app";
      }
      if (this.elements.headerRole) {
        this.elements.headerRole.textContent = role ? role.toUpperCase() : "ADMIN";
      }
      if (this.elements.headerTier) {
        const resolvedTier = tier ? resolveTierLabel(tier).toUpperCase() : "CORE";
        this.elements.headerTier.textContent = resolvedTier;
        this.elements.headerTier.dataset.tier = resolvedTier;
        if (headerTierBadge) {
          const badgeTier = resolvedTier.toLowerCase();
          headerTierBadge.src = resolveBaseAssetPath(`/assets/icons/tierbadge-${badgeTier}.svg`);
          headerTierBadge.dataset.tier = resolvedTier;
        }
      }
      if (headerAdminBadge) {
        headerAdminBadge.src = resolveBaseAssetPath("/assets/icons/tierbadge-admin.svg");
      }
      if (this.elements.headerAvatar) {
        const resolvedAvatar = avatarUrl || fallbackAvatar;
        this.elements.headerAvatar.src = resolvedAvatar;
        this.elements.headerAvatar.classList.toggle("is-avatar", Boolean(avatarUrl));
      }
      this.elements.headerWrap.classList.toggle("hidden", !this.state.authorized);
    },

    setBlockedState({ title, message, showLogin, showLogout, showCreator }) {
      if (this.elements.blockedTitle) {
        this.elements.blockedTitle.textContent = title;
      }
      if (this.elements.blockedMessage) {
        this.elements.blockedMessage.textContent = message;
      }
      if (this.elements.blockedOpen) {
        this.elements.blockedOpen.classList.toggle("hidden", !showLogin);
      }
      if (this.elements.blockedLogout) {
        this.elements.blockedLogout.classList.toggle("hidden", !showLogout);
      }
      if (this.elements.blockedCreator) {
        this.elements.blockedCreator.classList.toggle("hidden", !showCreator);
      }
    },

    applyState() {
      document.body.classList.toggle("admin-authenticated", this.state.authorized);
      document.body.classList.toggle("admin-auth-required", !this.state.authenticated);
      document.body.classList.toggle(
        "admin-auth-denied",
        this.state.authenticated && !this.state.authorized
      );
      document.body.classList.toggle("admin-auth-error", Boolean(this.state.error));

      if (this.state.authorized) {
        if (this.elements.overlay) this.elements.overlay.classList.add("hidden");
        if (this.elements.blocked) this.elements.blocked.classList.add("hidden");
        this.setHeaderIdentity({
          name: this.state.displayName,
          email: this.state.email,
          role: this.state.role,
          avatarUrl: this.state.avatarUrl,
          tier: this.state.tier
        });
        return;
      }

      if (!this.state.authenticated) {
        this.setBlockedState({
          title: "Admin access required",
          message: "Sign in with an approved admin account to continue.",
          showLogin: true,
          showLogout: false,
          showCreator: false
        });
        this.openOverlay();
        this.setHeaderIdentity({ name: "", email: "", role: "", tier: "" });
        return;
      }

      this.setBlockedState({
        title: "Not authorized",
        message: "You are not authorized for the Admin Dashboard.",
        showLogin: true,
        showLogout: true,
        showCreator: true
      });
      this.closeOverlay();
      this.setHeaderIdentity({
        name: this.state.displayName,
        email: this.state.email,
        role: this.state.role,
        avatarUrl: this.state.avatarUrl,
        tier: this.state.tier
      });
    },

    validateConfig() {
      const { session } = this.config.endpoints;
      if (!session) {
        this.state.error = "Auth configuration missing: session endpoint not configured.";
        return false;
      }
      return true;
    },

    async refreshSession() {
      this.state.error = "";
      if (!this.validateConfig()) {
        this.setStatus("error", this.state.error);
        this.applyState();
        return;
      }

      this.setLoading(true);
      this.setStatus("loading", "Checking admin session…");
      let redirectedToLogin = false;

      try {
        const response = await fetch(this.config.endpoints.session, {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json"
          }
        });

        let payload = null;
        try {
          payload = await response.json();
        } catch (err) {
          payload = null;
        }

        if (!response.ok) {
          const reason = resolveAuthReason(payload, response);
          if (response.status === 401 && reason === SESSION_IDLE_REASON) {
            redirectedToLogin = true;
            window.location.replace("/auth/login.html");
            return;
          }
          throw new Error(`Auth session error (${response.status})`);
        }

        const normalized = this.normalizeSession(payload);
        this.state = { ...this.state, ...normalized, error: "" };
        this.setStatus("idle", "");
      } catch (err) {
        console.warn("[Admin Auth] Session introspection failed:", err);
        this.state = {
          authenticated: false,
          authorized: false,
          role: "",
          email: "",
          displayName: "",
          avatarUrl: "",
          tier: "",
          error: "Auth service unavailable. Please try again."
        };
        this.setStatus("error", this.state.error);
      } finally {
        this.setLoading(false);
        if (redirectedToLogin) {
          return;
        }
        this.applyState();
      }
    },

    normalizeSession(payload) {
      const authenticated = Boolean(
        payload?.authenticated ??
          payload?.isAuthenticated ??
          payload?.session?.authenticated ??
          payload?.session?.isAuthenticated
      );

      const email = coerceText(
        payload?.email ?? payload?.session?.email ?? payload?.user?.email ?? ""
      );

      const role = coerceText(payload?.role ?? payload?.session?.role ?? payload?.user?.role ?? "");

      const displayName = coerceText(
        payload?.display_name ??
          payload?.displayName ??
          payload?.session?.display_name ??
          payload?.session?.displayName ??
          payload?.user?.display_name ??
          payload?.user?.displayName ??
          payload?.user?.name ??
          ""
      );

      const avatarUrl = coerceText(
        payload?.avatar_url ??
          payload?.avatarUrl ??
          payload?.user?.avatar_url ??
          payload?.user?.avatarUrl ??
          ""
      );

      const tier = coerceText(
        payload?.tier ??
          payload?.session?.tier ??
          payload?.user?.tier ??
          payload?.plan ??
          ""
      );

      const adminEmails = normalizeEmailList(
        payload?.admin_emails ??
          payload?.adminEmails ??
          payload?.allowed_emails ??
          payload?.allowedEmails ??
          payload?.session?.adminEmails
      );

      const serverAuthorized = Boolean(
        payload?.authorized ??
          payload?.is_authorized ??
          payload?.isAuthorized ??
          payload?.is_admin ??
          payload?.isAdmin
      );

      const normalizedEmail = normalizeEmail(email);
      const emailAllowed = adminEmails.length
        ? adminEmails.includes(normalizedEmail)
        : serverAuthorized;

      const authorized = authenticated && role === "admin" && emailAllowed;

      return {
        authenticated,
        authorized,
        role,
        email: normalizedEmail,
        displayName,
        avatarUrl,
        tier,
        error: ""
      };
    },

    startOAuth(provider) {
      const endpoint = this.config.endpoints.providers[provider];
      if (!endpoint) {
        this.setStatus("error", `Auth provider not configured: ${provider}.`);
        return;
      }
      const destination =
        provider === "twitch" ? endpoint : enforceAdminOAuthEndpoint(endpoint);
      if (!destination) {
        this.setStatus("error", `Auth provider endpoint invalid: ${provider}.`);
        return;
      }
      this.setStatus("loading", `Redirecting to ${provider}…`);
      window.location.assign(destination);
    },

    async submitEmergencyLogin() {
      const endpoint = this.config.endpoints.login;
      if (!endpoint) {
        this.setStatus(
          "offline",
          "Emergency access is offline. Auth login endpoint is not configured."
        );
        return;
      }

      const emailValue = this.elements.emailInput?.value || "";
      const email = normalizeEmail(emailValue);
      if (!EMAIL_PATTERN.test(email)) {
        this.setStatus("error", "Enter a valid email address.");
        return;
      }

      const password = this.elements.passwordInput?.value || "";
      if (!password) {
        this.setStatus("error", "Enter your admin password.");
        return;
      }

      this.setLoading(true);
      this.setStatus("loading", "Submitting emergency admin access…");

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
          if (response.status === 404) {
            this.setStatus(
              "offline",
              "Emergency access is offline. The auth service did not accept manual login."
            );
            return;
          }
          const message = `Manual login failed (${response.status}).`;
          throw new Error(message);
        }

        this.setStatus("sent", "Manual login submitted. Redirecting to the dashboard…");
        if (this.elements.emailInput) {
          this.elements.emailInput.value = "";
        }
        if (this.elements.passwordInput) {
          this.elements.passwordInput.value = "";
        }
        window.location.assign(ADMIN_INDEX_URL);
      } catch (err) {
        console.warn("[Admin Auth] Emergency login request failed:", err);
        this.setStatus("error", "Unable to submit manual login. Try again shortly.");
      } finally {
        this.setLoading(false);
      }
    },

    async logout() {
      const endpoint = this.config.endpoints.logout;
      if (endpoint) {
        try {
          await fetch(endpoint, {
            method: "POST",
            credentials: "include",
            headers: {
              Accept: "application/json"
            }
          });
        } catch (err) {
          console.warn("[Admin Auth] Logout request failed:", err);
        }
      }

      this.state = {
        authenticated: false,
        authorized: false,
        role: "",
        email: "",
        displayName: "",
        avatarUrl: "",
        tier: "",
        error: ""
      };
      this.applyState();
      if (window.StreamSuitesAdminGate?.stopPolling) {
        window.StreamSuitesAdminGate.stopPolling();
      }
      window.StreamSuitesAdminSession = null;
      window.location.assign(ADMIN_LOGOUT_REDIRECT);
    },

    getAdminLoginUrl({ surface = "admin" } = {}) {
      const url = new URL(ADMIN_LOGIN_URL.toString());
      if (surface) {
        url.searchParams.set("surface", surface);
      }
      return url.toString();
    }
  };

  window.StreamSuitesAdminAuth = AdminAuth;
})();

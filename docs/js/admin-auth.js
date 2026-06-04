/* ======================================================================
   StreamSuites™ Dashboard — Admin Auth Gate
   - Central StreamSuites Auth API (cookie-based sessions)
   - Admin-only access enforced client-side (fail-closed)
   ====================================================================== */

(function () {
  const CANONICAL_ADMIN_ORIGIN = "https://admin.streamsuites.app";
  const CANONICAL_ADMIN_HOSTNAME = "admin.streamsuites.app";
  const PREVIEW_HOSTNAME_SUFFIX = ".pages.dev";
  const LOCAL_PREVIEW_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
  const ADMIN_SURFACE = "admin";
  const PUBLIC_HOSTNAMES = new Set(["streamsuites.app", "www.streamsuites.app"]);
  const CURRENT_ADMIN_ORIGIN = window.location?.origin || CANONICAL_ADMIN_ORIGIN;
  const CURRENT_ADMIN_HOSTNAME = normalizeHostname(window.location?.hostname);
  const ADMIN_ORIGIN = isAllowedAdminHost(CURRENT_ADMIN_HOSTNAME)
    ? CURRENT_ADMIN_ORIGIN
    : CANONICAL_ADMIN_ORIGIN;
  const ADMIN_SUCCESS = new URL(
    `${window.ADMIN_BASE_PATH || ""}/auth/success.html`,
    ADMIN_ORIGIN
  ).toString();
  const ADMIN_DASH = new URL(`${window.ADMIN_BASE_PATH || ""}/overview`, ADMIN_ORIGIN).toString();
  const IS_PREVIEW_ADMIN_HOST = isPreviewAdminHost(CURRENT_ADMIN_HOSTNAME);
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
  const TURNSTILE_HELPER_URL = "/js/turnstile-inline.js";

  function normalizeHostname(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }

  function isPreviewAdminHost(hostname) {
    const normalized = normalizeHostname(hostname);
    return normalized.endsWith(PREVIEW_HOSTNAME_SUFFIX) || LOCAL_PREVIEW_HOSTNAMES.has(normalized);
  }

  function isAllowedAdminHost(hostname) {
    const normalized = normalizeHostname(hostname);
    return normalized === CANONICAL_ADMIN_HOSTNAME || isPreviewAdminHost(normalized);
  }

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

  function stableImageUrl(url, cacheKey) {
    const source = coerceText(url).trim();
    const key = coerceText(cacheKey).trim();
    if (!source || !key || source.startsWith("data:") || source.startsWith("blob:")) return source;
    try {
      const parsed = new URL(source, window.location.origin);
      if (/^https?:\/\//i.test(source) && parsed.origin !== window.location.origin) return source;
      if (!parsed.searchParams.has("v")) parsed.searchParams.set("v", key);
      return parsed.origin === window.location.origin && source.startsWith("/")
        ? `${parsed.pathname}${parsed.search}${parsed.hash}`
        : parsed.toString();
    } catch (_) {
      return source;
    }
  }

  function isUsableProfileImageUrl(value) {
    const source = coerceText(value).trim();
    if (!source) return false;
    if (source.startsWith("data:") || source.startsWith("blob:")) return true;
    if (/^https?:\/\//i.test(source)) return true;
    if (source.startsWith("//")) return true;
    if (source.startsWith("/") && !source.includes("/assets/icons/ui/profile.svg")) return true;
    return false;
  }

  function normalizedImageContract(source = {}, fallback = {}) {
    const profileMedia = source?.profile_media || source?.profileMedia || {};
    const image = source?.image || profileMedia.avatar || {};
    const media = source?.media || {};
    const fallbackProfileMedia = fallback?.profile_media || fallback?.profileMedia || {};
    const fallbackImage = fallback?.image || fallbackProfileMedia.avatar || {};
    const avatarUrl = [
      image.avatar_url, image.profile_image_url, image.profile_photo_url, image.url, image.image_url, image.picture,
      image.provider_picture, image.provider_avatar_url, image.display_avatar_url, image.public_avatar_url,
      profileMedia.avatar_url, profileMedia.profile_image_url, profileMedia.profile_photo_url, profileMedia.public_url,
      profileMedia.provider_picture, profileMedia.provider_avatar_url, profileMedia.display_avatar_url, profileMedia.public_avatar_url,
      media.avatar_url, media.profile_image_url, media.profile_photo_url, media.picture, media.provider_picture,
      source?.profile_image_url, source?.profileImageUrl, source?.profile_photo_url, source?.profilePhotoUrl,
      source?.avatar_url, source?.avatarUrl, source?.avatar, source?.picture, source?.image_url, source?.imageUrl,
      source?.provider_avatar_url, source?.providerAvatarUrl, source?.provider_picture, source?.providerPicture,
      source?.display_avatar_url, source?.displayAvatarUrl, source?.public_avatar_url, source?.publicAvatarUrl,
      fallbackImage.avatar_url, fallbackImage.profile_image_url, fallbackImage.profile_photo_url, fallbackImage.picture,
      fallbackImage.provider_picture, fallbackImage.provider_avatar_url,
      fallbackProfileMedia.avatar_url, fallbackProfileMedia.profile_image_url, fallbackProfileMedia.profile_photo_url, fallbackProfileMedia.provider_picture,
      fallback?.avatar_url, fallback?.avatarUrl, fallback?.avatar, fallback?.picture, fallback?.provider_picture, fallback?.providerPicture
    ].map(coerceText).find(isUsableProfileImageUrl) || "";
    const imageVersion = coerceText(
      image.image_version ||
        image.cache_key ||
        profileMedia.image_version ||
        profileMedia.cache_key ||
        source?.image_version ||
        source?.imageVersion ||
        fallback?.imageVersion ||
        ""
    ).trim();
    return {
      avatarUrl: stableImageUrl(avatarUrl, imageVersion),
      rawAvatarUrl: avatarUrl,
      imageVersion
    };
  }

  function normalizeAuthReason(value) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return "";
    if (trimmed.includes(SESSION_IDLE_REASON)) return SESSION_IDLE_REASON;
    return trimmed;
  }

  async function readErrorPayload(response) {
    if (!response) return null;
    const contentType = String(response.headers?.get("content-type") || "").toLowerCase();
    try {
      if (contentType.includes("application/json")) {
        return await response.json();
      }
      const text = await response.text();
      const trimmed = typeof text === "string" ? text.trim() : "";
      if (!trimmed) return null;
      try {
        return JSON.parse(trimmed);
      } catch {
        return { message: trimmed };
      }
    } catch {
      return null;
    }
  }

  function formatRetryAfter(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds > 0) {
      if (seconds < 60) return `${Math.ceil(seconds)} seconds`;
      const minutes = Math.ceil(seconds / 60);
      return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    }
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      const diffMs = date.getTime() - Date.now();
      if (diffMs > 0) {
        return formatRetryAfter(String(Math.ceil(diffMs / 1000)));
      }
    }
    return raw;
  }

  function buildPasswordLoginErrorMessage(response, payload) {
    const status = Number(response?.status || 0);
    const reason = resolveAuthReason(payload, response);
    const payloadMessage =
      typeof payload?.message === "string" && payload.message.trim()
        ? payload.message.trim()
        : typeof payload?.error === "string" && payload.error.trim()
          ? payload.error.trim()
          : "";
    const retryAfter = formatRetryAfter(response?.headers?.get("Retry-After"));

    if (status === 429) {
      const retryText = retryAfter ? ` Retry after ${retryAfter}.` : "";
      return payloadMessage || `Password login is being rate limited upstream.${retryText}`;
    }

    if (status === 401) {
      return payloadMessage || "Email/password was rejected by Auth.";
    }

    if (status === 403) {
      if (reason.includes("admin") || reason.includes("not_authorized") || reason.includes("forbidden")) {
        return "This account authenticated, but Auth says it is not approved for the admin surface.";
      }
      return payloadMessage || "Auth denied this login attempt for the admin surface.";
    }

    if (status >= 500) {
      return payloadMessage || "Auth is failing upstream. Try again after the service recovers.";
    }

    return payloadMessage || `Password login failed upstream (${status || "unknown"}).`;
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
    const hostname = normalizeHostname(parsed.hostname);
    if (PUBLIC_HOSTNAMES.has(hostname)) return ADMIN_SUCCESS;
    if (!isAllowedAdminHost(hostname)) return ADMIN_SUCCESS;
    return ADMIN_SUCCESS;
  }

  function normalizeAdminDash(value) {
    const parsed = parseUrl(value);
    if (!parsed) return ADMIN_DASH;
    const hostname = normalizeHostname(parsed.hostname);
    if (PUBLIC_HOSTNAMES.has(hostname)) return ADMIN_DASH;
    if (!isAllowedAdminHost(hostname)) return ADMIN_DASH;
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  }

  function getCurrentAdminDestination() {
    const pathname = window.location?.pathname || "/overview";
    const search = window.location?.search || "";
    return `${ADMIN_ORIGIN}${pathname}${search}`;
  }

  function buildPreviewAuthState() {
    return {
      authenticated: true,
      authorized: true,
      role: "admin",
      email: "preview@streamsuites.app",
      displayName: "Preview Mode",
      avatarUrl: "",
      tier: "preview",
      adminAccess: {
        allowed: true,
        level: "preview",
        permissions: {}
      },
      error: ""
    };
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
      endpoint.searchParams.set(
        paramName,
        normalizeAdminDash(currentValue || getCurrentAdminDestination())
      );
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

  function loadTurnstileHelper() {
    if (window.StreamSuitesTurnstileInline?.createController) {
      return Promise.resolve(window.StreamSuitesTurnstileInline);
    }
    if (window.__streamsuitesAdminTurnstileHelperPromise) {
      return window.__streamsuitesAdminTurnstileHelperPromise;
    }
    window.__streamsuitesAdminTurnstileHelperPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${TURNSTILE_HELPER_URL}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(window.StreamSuitesTurnstileInline), { once: true });
        existing.addEventListener("error", () => reject(new Error("admin-turnstile-helper-load-failed")), {
          once: true
        });
        return;
      }

      const script = document.createElement("script");
      script.src = TURNSTILE_HELPER_URL;
      script.defer = true;
      script.onload = () => resolve(window.StreamSuitesTurnstileInline);
      script.onerror = () => reject(new Error("admin-turnstile-helper-load-failed"));
      document.head.appendChild(script);
    });
    return window.__streamsuitesAdminTurnstileHelperPromise;
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
    passwordLoginInFlight: false,

    async init() {
      if (this.initialized) return this.state;
      this.initialized = true;
      this.cacheElements();
      this.loadConfig();
      this.bindEvents();
      if (IS_PREVIEW_ADMIN_HOST) {
        this.state = buildPreviewAuthState();
        this.setStatus(
          "idle",
          "Preview host booted in static preview mode. Use admin.streamsuites.app for live auth."
        );
        this.applyState();
        return this.state;
      }
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
      this.elements.turnstilePanel = document.getElementById("admin-auth-turnstile-panel");
      this.elements.turnstileSlot = document.getElementById("admin-auth-turnstile");
      this.elements.turnstileStatus = document.getElementById("admin-auth-turnstile-status");
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
      this.elements.overviewName = document.getElementById("admin-user-overview-name");
      this.elements.overviewEmail = document.getElementById("admin-user-overview-email");
      this.elements.overviewRole = document.getElementById("admin-user-overview-role");
      this.elements.overviewTier = document.getElementById("admin-user-overview-tier");

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
        (baseUrl ? `${baseUrl.replace(/\/$/, "")}/auth/login/password` : "");
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
          void this.submitPasswordLogin();
        });
      }

      this.elements.oauthButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const provider = button.getAttribute("data-admin-auth-provider");
          if (provider) {
            void this.startOAuth(provider);
          }
        });
      });
    },

    async ensureTurnstileController() {
      if (this.turnstileController) {
        return this.turnstileController;
      }
      await loadTurnstileHelper();
      const base = this.config.baseUrl ? this.config.baseUrl.replace(/\/$/, "") : "";
      const turnstileConfigUrl = base ? `${base}/auth/turnstile/config` : "/auth/turnstile/config";
      this.turnstileController = window.StreamSuitesTurnstileInline?.createController?.({
        configUrl: turnstileConfigUrl,
        panel: this.elements.turnstilePanel,
        slot: this.elements.turnstileSlot,
        status: this.elements.turnstileStatus,
        onStateChange: () => {
          this.syncActionAvailability();
          this.syncTurnstileRuntimeNotice();
        }
      });
      return this.turnstileController;
    },

    async ensureTurnstileInitialized() {
      try {
        const controller = await this.ensureTurnstileController();
        await controller?.init?.();
      } catch (error) {
        console.warn("[Admin Auth] Turnstile failed to initialize:", error);
        if (this.elements.turnstileStatus) {
          this.elements.turnstileStatus.dataset.tone = "error";
          this.elements.turnstileStatus.textContent = "Security check failed to load. Refresh and try again.";
        }
      } finally {
        this.syncActionAvailability();
        this.syncTurnstileRuntimeNotice();
      }
    },

    isTurnstileBlocked() {
      return this.turnstileController?.isEnabled?.() && !this.turnstileController?.hasToken?.();
    },

    syncTurnstileRuntimeNotice() {
      if (this.turnstileController?.isRuntimeDisabled?.()) {
        if (!this.elements.status?.textContent?.trim() || this.elements.status?.dataset.state === "warning") {
          this.setStatus("warning", "Cloudflare Turnstile is disabled by runtime env.");
        }
        return;
      }
      if (this.elements.status?.dataset.state === "warning") {
        this.setStatus("idle", "");
      }
    },

    syncActionAvailability() {
      const disabled = this.passwordLoginInFlight || this.isTurnstileBlocked();
      this.elements.oauthButtons.forEach((button) => {
        button.disabled = disabled;
        button.setAttribute("aria-disabled", disabled ? "true" : "false");
        button.classList.toggle("is-disabled", disabled);
      });
      if (this.elements.emailButton instanceof HTMLButtonElement) {
        this.elements.emailButton.disabled = disabled;
      }
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
      void this.ensureTurnstileInitialized();
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
      const nextMessage = typeof message === "string" ? message : "";
      if (nextMessage) {
        this.elements.status.dataset.state = state;
        this.elements.status.textContent = nextMessage;
        return;
      }
      delete this.elements.status.dataset.state;
      this.elements.status.textContent = "";
    },

    setLoading(isLoading) {
      document.body.classList.toggle("admin-auth-loading", isLoading);
      const controls = [
        this.elements.emailInput,
        this.elements.passwordInput
      ].filter(Boolean);
      controls.forEach((control) => {
        control.disabled = isLoading || (!isLoading && this.isTurnstileBlocked());
      });
      this.syncActionAvailability();
    },

    setHeaderIdentity({ name, email, role, avatarUrl, tier, adminAccess }) {
      if (!this.elements.headerWrap) return;
      const normalizedRole = String(role || "").trim().toLowerCase();
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
        this.elements.headerTier.hidden = true;
        if (headerTierBadge) {
          const badgeTier = resolvedTier.toLowerCase();
          headerTierBadge.src = resolveBaseAssetPath(`/assets/icons/tierbadge-${badgeTier}.svg`);
          headerTierBadge.dataset.tier = resolvedTier;
          headerTierBadge.hidden = false;
        }
      }
      if (headerAdminBadge) {
        const showDeveloperBadge = normalizedRole !== "admin" && adminAccess?.allowed === true;
        const badgeKey = showDeveloperBadge ? "developer" : "admin";
        headerAdminBadge.src = resolveBaseAssetPath(
          showDeveloperBadge ? "/assets/icons/dev-green.svg" : "/assets/icons/tierbadge-admin.svg"
        );
        headerAdminBadge.alt = showDeveloperBadge ? "Developer" : "Admin";
        headerAdminBadge.dataset.ssRoleBadge = badgeKey;
        headerAdminBadge.hidden = normalizedRole !== "admin" && !showDeveloperBadge;
        if (headerTierBadge) {
          headerTierBadge.hidden = normalizedRole === "admin" || showDeveloperBadge;
        }
      }
      if (this.elements.headerAvatar) {
        const resolvedAvatar = avatarUrl || fallbackAvatar;
        this.elements.headerAvatar.onerror = null;
        this.elements.headerAvatar.src = resolvedAvatar;
        this.elements.headerAvatar.classList.toggle("is-avatar", Boolean(avatarUrl));
        if (avatarUrl) {
          this.elements.headerAvatar.onerror = () => {
            this.elements.headerAvatar.onerror = null;
            this.elements.headerAvatar.src = fallbackAvatar;
            this.elements.headerAvatar.classList.remove("is-avatar");
          };
        }
      }
      this.elements.headerWrap.classList.toggle("hidden", !this.state.authorized);
      if (this.elements.overviewName) {
        this.elements.overviewName.textContent = name || email || "Administrator";
      }
      if (this.elements.overviewEmail) {
        this.elements.overviewEmail.textContent = email || "admin@streamsuites.app";
      }
      if (this.elements.overviewRole) {
        this.elements.overviewRole.textContent = role ? role.toUpperCase() : "ADMIN";
      }
      if (this.elements.overviewTier) {
        this.elements.overviewTier.textContent = tier ? resolveTierLabel(tier).toUpperCase() : "CORE";
      }
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
          tier: this.state.tier,
          adminAccess: this.state.adminAccess
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
        this.setHeaderIdentity({ name: "", email: "", role: "", tier: "", adminAccess: null });
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
        tier: this.state.tier,
        adminAccess: this.state.adminAccess
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

      const imageContract = normalizedImageContract(payload, payload?.user || {});
      const avatarUrl = imageContract.avatarUrl;

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
      const adminAccessSource =
        payload?.admin_access ??
        payload?.adminAccess ??
        payload?.user?.admin_access ??
        payload?.user?.adminAccess ??
        null;
      const adminAccessAllowed = adminAccessSource?.allowed === true;

      const normalizedEmail = normalizeEmail(email);
      const emailAllowed = adminEmails.length
        ? adminEmails.includes(normalizedEmail)
        : serverAuthorized || adminAccessAllowed;

      const authorized = authenticated && (role === "admin" || adminAccessAllowed) && emailAllowed;

      return {
        authenticated,
        authorized,
        role,
        email: normalizedEmail,
        displayName,
        avatarUrl,
        tier,
        adminAccess: adminAccessSource || null,
        error: ""
      };
    },

    async startOAuth(provider) {
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
      const turnstileToken = await this.turnstileController?.requireToken?.();
      if (this.turnstileController?.isEnabled?.() && !turnstileToken) {
        this.setStatus("error", "Complete the security check to continue.");
        return;
      }
      const redirectUrl = parseUrl(destination, ADMIN_ORIGIN);
      if (redirectUrl && turnstileToken) {
        redirectUrl.searchParams.set("turnstile_token", turnstileToken);
      }
      this.setStatus("loading", `Redirecting to ${provider}…`);
      window.location.assign(redirectUrl ? redirectUrl.toString() : destination);
    },

    async submitPasswordLogin() {
      if (this.passwordLoginInFlight) {
        this.setStatus("loading", "A sign-in request is already in progress…");
        return;
      }
      const endpoint = this.config.endpoints.login;
      if (!endpoint) {
        this.setStatus(
          "offline",
          "Password login is unavailable because the auth endpoint is not configured."
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
      const turnstileToken = await this.turnstileController?.requireToken?.();
      if (this.turnstileController?.isEnabled?.() && !turnstileToken) {
        this.setStatus("error", "Complete the security check to continue.");
        return;
      }

      this.passwordLoginInFlight = true;
      this.setLoading(true);
      this.setStatus("loading", "Signing in…");

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          redirect: "manual",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({ email, password, surface: ADMIN_SURFACE, turnstile_token: turnstileToken })
        });

        const redirected =
          response.type === "opaqueredirect" ||
          [302, 303, 307, 308].includes(Number(response.status || 0));

        if (redirected) {
          this.setStatus("sent", "Signed in. Redirecting to the dashboard…");
          if (this.elements.emailInput) {
            this.elements.emailInput.value = "";
          }
          if (this.elements.passwordInput) {
            this.elements.passwordInput.value = "";
          }
          window.location.assign(ADMIN_INDEX_URL);
          return;
        }

        if (!response.ok) {
          const payload = await readErrorPayload(response);
          if (response.status === 404) {
            this.setStatus(
              "offline",
              "Password login is unavailable because the auth service rejected the login route."
            );
            return;
          }
          const message = buildPasswordLoginErrorMessage(response, payload);
          throw new Error(message);
        }

        this.setStatus("sent", "Signed in. Redirecting to the dashboard…");
        if (this.elements.emailInput) {
          this.elements.emailInput.value = "";
        }
        if (this.elements.passwordInput) {
          this.elements.passwordInput.value = "";
        }
        window.location.assign(ADMIN_INDEX_URL);
      } catch (err) {
        console.warn("[Admin Auth] Password login request failed:", err);
        this.setStatus("error", err?.message || "Unable to sign in. Try again shortly.");
      } finally {
        this.passwordLoginInFlight = false;
        if (this.turnstileController?.isEnabled?.()) {
          this.turnstileController.reset();
        }
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
      url.searchParams.set("redirect", getCurrentAdminDestination());
      return url.toString();
    }
  };

  window.StreamSuitesAdminAuth = AdminAuth;
})();

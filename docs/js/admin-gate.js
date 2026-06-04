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

  function buildPreviewAdminPayload() {
    return {
      authenticated: true,
      email: "preview@streamsuites.app",
      name: "Preview Mode",
      role: AUTHORIZED_ROLE,
      provider: "preview",
      tier: "preview",
      avatarUrl: "",
      preview: true,
      adminAccess: {
        allowed: true,
        level: "preview",
        restricted: false,
        registryVersion: "preview",
        resolutionOrder: ["preview-host-bootstrap"],
        allowedViews: [],
        restrictedViews: [],
        effectivePermissionKeys: [],
        deniedPermissionKeys: [],
        endpointPermissionKeys: [],
        permissions: {},
        features: {},
        rolePolicy: {},
        userOverrides: {}
      }
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
    const adminAccessSource =
      payload.admin_access ||
      payload.adminAccess ||
      payload.user?.admin_access ||
      payload.user?.adminAccess ||
      {};
    const rawPermissions =
      adminAccessSource?.permissions && typeof adminAccessSource.permissions === "object"
        ? adminAccessSource.permissions
        : {};
    const permissions = Object.fromEntries(
      Object.entries(rawPermissions).map(([permissionKey, rawEntry]) => {
        const entry = rawEntry && typeof rawEntry === "object" ? rawEntry : {};
        return [
          coerceText(permissionKey),
          {
            allowed: entry.allowed === true,
            source: coerceText(entry.source),
            roleDefault: entry.role_default === true || entry.roleDefault === true,
            overrideMode: coerceText(entry.override_mode || entry.overrideMode).toLowerCase() || null
          }
        ];
      })
    );
    const adminAccess = {
      allowed: adminAccessSource?.allowed === true,
      level: coerceText(adminAccessSource?.level).toLowerCase(),
      restricted: adminAccessSource?.restricted === true,
      registryVersion: coerceText(
        adminAccessSource?.registry_version || adminAccessSource?.registryVersion
      ),
      resolutionOrder: Array.isArray(
        adminAccessSource?.resolution_order || adminAccessSource?.resolutionOrder
      )
        ? (adminAccessSource.resolution_order || adminAccessSource.resolutionOrder)
            .map((item) => coerceText(item))
            .filter(Boolean)
        : [],
      allowedViews: Array.isArray(adminAccessSource?.allowed_views || adminAccessSource?.allowedViews)
        ? (adminAccessSource.allowed_views || adminAccessSource.allowedViews)
            .map((item) => coerceText(item).toLowerCase())
            .filter(Boolean)
        : [],
      restrictedViews: Array.isArray(
        adminAccessSource?.restricted_views || adminAccessSource?.restrictedViews
      )
        ? (adminAccessSource.restricted_views || adminAccessSource.restrictedViews)
            .map((item) => coerceText(item).toLowerCase())
            .filter(Boolean)
        : [],
      effectivePermissionKeys: Array.isArray(
        adminAccessSource?.effective_permission_keys || adminAccessSource?.effectivePermissionKeys
      )
        ? (adminAccessSource.effective_permission_keys || adminAccessSource.effectivePermissionKeys)
            .map((item) => coerceText(item))
            .filter(Boolean)
        : [],
      deniedPermissionKeys: Array.isArray(
        adminAccessSource?.denied_permission_keys || adminAccessSource?.deniedPermissionKeys
      )
        ? (adminAccessSource.denied_permission_keys || adminAccessSource.deniedPermissionKeys)
            .map((item) => coerceText(item))
            .filter(Boolean)
        : [],
      endpointPermissionKeys: Array.isArray(
        adminAccessSource?.endpoint_permission_keys || adminAccessSource?.endpointPermissionKeys
      )
        ? (adminAccessSource.endpoint_permission_keys || adminAccessSource.endpointPermissionKeys)
            .map((item) => coerceText(item))
            .filter(Boolean)
        : [],
      permissions,
      features:
        adminAccessSource?.features && typeof adminAccessSource.features === "object"
          ? { ...adminAccessSource.features }
          : {},
      rolePolicy:
        adminAccessSource?.role_policy && typeof adminAccessSource.role_policy === "object"
          ? { ...adminAccessSource.role_policy }
          : {},
      userOverrides:
        adminAccessSource?.user_overrides && typeof adminAccessSource.user_overrides === "object"
          ? { ...adminAccessSource.user_overrides }
          : {}
    };

    return {
      authenticated: Boolean(role),
      email,
      name,
      role: role || "",
      provider: provider || getLastOauthProvider(),
      tier: coerceText(payload.tier || payload.session?.tier || payload.user?.tier || payload.plan),
      avatarUrl: normalizedImageContract(payload, payload.user || {}),
      adminAccess
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

  function stableImageUrl(url, cacheKey) {
    const source = coerceText(url);
    const key = coerceText(cacheKey);
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
    const source = coerceText(value);
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
    );
    return stableImageUrl(avatarUrl, imageVersion);
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
    const headerTier = document.getElementById("admin-auth-tier");
    const headerNameText = headerName?.querySelector(".streamsuites-auth-name-text");
    const headerTierBadge = headerName?.querySelector(".streamsuites-auth-tier-badge");
    const headerAdminBadge = headerName?.querySelector(".streamsuites-auth-admin-badge");
    const fallbackAvatar = `${window.ADMIN_BASE_PATH}/assets/icons/ui/profile.svg`;
    const normalizedRole = String(admin?.role || "").trim().toLowerCase();

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
    if (headerTier) {
      const resolvedTier = admin.tier ? resolveTierLabel(admin.tier).toUpperCase() : "CORE";
      headerTier.textContent = resolvedTier;
      headerTier.dataset.tier = resolvedTier;
      headerTier.hidden = true;
      if (headerTierBadge) {
        const badgeTier = resolvedTier.toLowerCase();
        headerTierBadge.src = `${window.ADMIN_BASE_PATH}/assets/icons/tierbadge-${badgeTier}.svg`;
        headerTierBadge.dataset.tier = resolvedTier;
        headerTierBadge.hidden = false;
      }
    }
    if (headerAdminBadge) {
      const showDeveloperBadge = normalizedRole !== AUTHORIZED_ROLE && admin.adminAccess?.allowed === true;
      headerAdminBadge.src = `${window.ADMIN_BASE_PATH}${showDeveloperBadge ? "/assets/icons/dev-green.svg" : "/assets/icons/tierbadge-admin.svg"}`;
      headerAdminBadge.alt = showDeveloperBadge ? "Developer" : "Admin";
      headerAdminBadge.dataset.ssRoleBadge = showDeveloperBadge ? "developer" : "admin";
      headerAdminBadge.hidden = normalizedRole !== AUTHORIZED_ROLE && !showDeveloperBadge;
      if (headerTierBadge) {
        headerTierBadge.hidden = normalizedRole === AUTHORIZED_ROLE || showDeveloperBadge;
      }
    }
    if (headerAvatar) {
      const resolvedAvatar = admin.avatarUrl || fallbackAvatar;
      headerAvatar.onerror = null;
      headerAvatar.src = resolvedAvatar;
      headerAvatar.classList.toggle("is-avatar", Boolean(admin.avatarUrl));
      if (admin.avatarUrl) {
        headerAvatar.onerror = () => {
          headerAvatar.onerror = null;
          headerAvatar.src = fallbackAvatar;
          headerAvatar.classList.remove("is-avatar");
        };
      }
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
      avatarUrl: payload?.avatarUrl || "",
      adminAccess: payload?.adminAccess || null
    };
    if (gate.admin.provider) {
      persistLastOauthProvider(gate.admin.provider);
    }
    updateDashboardGuard({
      shouldBlock: false,
      adminGateStatus: "authorized",
      adminEmail: gate.admin.email,
      adminRole: gate.admin.role,
      adminAccess: gate.admin.adminAccess || null
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
    url.searchParams.set("redirect", getCurrentAdminDestination());
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
      return { status: "authorized", payload: normalized };
    }

    if (normalized.adminAccess?.allowed === true) {
      return { status: "authorized", payload: normalized };
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

      if (IS_PREVIEW_ADMIN_HOST) {
        gate.sessionIdle.active = false;
        gate.sessionIdle.reason = "";
        gate.sessionIdle.notified = false;
        gate.silentFailureCount = 0;
        gate.silentFailureNotified = false;
        markAuthorized(buildPreviewAdminPayload());
        setSessionBanner(
          "Preview host booted in static preview mode. Use admin.streamsuites.app for live auth and write actions.",
          true,
          "warning"
        );
        gate.inFlight = null;
        if (gate.queued) {
          gate.queued = false;
          authorize({ reason: "queued" });
        }
        return;
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
    if (src.startsWith("/docs/")) return src.slice(5);
    if (src.startsWith("/")) return src;
    return `/${src.replace(/^\/+/, "")}`;
  }

  let assetVersionPromise = null;

  function resolveVersionMetaUrl() {
    const basePath =
      typeof window.ADMIN_BASE_PATH === "string" ? window.ADMIN_BASE_PATH.replace(/\/+$/, "") : "";
    return `${basePath}/runtime/exports/version.json`;
  }

  async function resolveAssetVersionToken() {
    if (window.__STREAMSUITES_ASSET_VERSION__) {
      return window.__STREAMSUITES_ASSET_VERSION__;
    }
    if (assetVersionPromise) {
      return assetVersionPromise;
    }

    assetVersionPromise = (async () => {
      try {
        const response = await gate.fetch(resolveVersionMetaUrl(), {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            Accept: "application/json"
          }
        });
        if (!response.ok) {
          return "";
        }

        const payload = await response.json();
        const token =
          payload?.build ||
          payload?.generated_at ||
          payload?.version ||
          "";
        window.__STREAMSUITES_ASSET_VERSION__ = token ? String(token).trim() : "";
        return window.__STREAMSUITES_ASSET_VERSION__;
      } catch (err) {
        return "";
      }
    })();

    return assetVersionPromise;
  }

  async function resolveVersionedScriptUrl(src) {
    const normalized = normalizeScriptPath(src);
    const token = await resolveAssetVersionToken();
    if (!token || typeof normalized !== "string" || /^[a-z]+:\/\//i.test(normalized)) {
      return normalized;
    }

    try {
      const url = new URL(normalized, window.location.origin);
      if (!url.searchParams.has("v")) {
        url.searchParams.set("v", token);
      }
      return url.toString();
    } catch (err) {
      return normalized;
    }
  }

  async function loadScript(src) {
    await ensureBodyReady();
    const resolvedSrc = await resolveVersionedScriptUrl(src);
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = resolvedSrc;
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

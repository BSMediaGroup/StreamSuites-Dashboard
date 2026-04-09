/* ======================================================================
   StreamSuites™ Dashboard — Admin Login (Standalone)
   ====================================================================== */

(() => {
  const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
  const LAST_OAUTH_PROVIDER_KEY = "streamsuites.admin.lastOauthProvider";
  const ADMIN_SURFACE = "admin";
  const CANONICAL_ADMIN_ORIGIN = "https://admin.streamsuites.app";
  const CANONICAL_ADMIN_HOSTNAME = "admin.streamsuites.app";
  const PREVIEW_HOSTNAME_SUFFIX = ".pages.dev";
  const LOCAL_PREVIEW_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
  const PUBLIC_HOSTNAMES = new Set(["streamsuites.app", "www.streamsuites.app"]);
  const AUTH_REASON_HEADERS = [
    "x-auth-reason",
    "x-streamsuites-auth-reason",
    "x-auth-status"
  ];
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

  function getMetaContent(name) {
    const value = document.querySelector(`meta[name="${name}"]`)?.getAttribute("content");
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeEmail(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }

  function normalizeProvider(value) {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!normalized) return "";
    if (normalized === "twitter") return "x";
    return normalized;
  }

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

  function persistLastOauthProvider(provider) {
    const normalized = normalizeProvider(provider);
    if (!normalized) return;
    try {
      localStorage.setItem(LAST_OAUTH_PROVIDER_KEY, normalized);
    } catch (err) {
      // Ignore storage write errors.
    }
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

  const elements = {
    reason: document.getElementById("admin-login-reason"),
    status: document.getElementById("admin-login-status"),
    form: document.getElementById("admin-login-form"),
    email: document.getElementById("admin-login-email"),
    password: document.getElementById("admin-login-password"),
    manualToggle: document.getElementById("admin-login-manual-toggle"),
    manualPanel: document.getElementById("admin-login-manual-panel"),
    turnstilePanel: document.getElementById("admin-login-turnstile-panel"),
    turnstileSlot: document.getElementById("admin-login-turnstile"),
    turnstileStatus: document.getElementById("admin-login-turnstile-status"),
    oauthButtons: Array.from(document.querySelectorAll("[data-admin-auth-provider]"))
  };
  const baseUrl = getMetaContent("streamsuites-auth-base");
  const base = baseUrl ? baseUrl.replace(/\/$/, "") : "";
  const turnstileConfigUrl = base ? `${base}/auth/turnstile/config` : "/auth/turnstile/config";
  const turnstileController = window.StreamSuitesTurnstileInline?.createController?.({
    configUrl: turnstileConfigUrl,
    panel: elements.turnstilePanel,
    slot: elements.turnstileSlot,
    status: elements.turnstileStatus,
    onStateChange: () => {
      syncActionAvailability();
      syncTurnstileRuntimeNotice();
    }
  });

  const endpoints = {
    login:
      getMetaContent("streamsuites-auth-login") ||
      (base ? `${base}/auth/login/password` : ""),
    google: getMetaContent("streamsuites-auth-google"),
    github: getMetaContent("streamsuites-auth-github"),
    discord: getMetaContent("streamsuites-auth-discord"),
    x: getMetaContent("streamsuites-auth-x"),
    twitch: getMetaContent("streamsuites-auth-twitch")
  };
  const defaultOAuthEndpoint = (provider) => {
    if (!base) return "";
    return `${base}/auth/login/${provider}`;
  };

  endpoints.google = buildAdminOAuthEndpoint(defaultOAuthEndpoint("google") || endpoints.google);
  endpoints.github = buildAdminOAuthEndpoint(defaultOAuthEndpoint("github") || endpoints.github);
  endpoints.discord = buildAdminOAuthEndpoint(defaultOAuthEndpoint("discord") || endpoints.discord);
  endpoints.x = buildAdminOAuthEndpoint(endpoints.x || (base ? `${base}/auth/x/start` : ""));
  endpoints.twitch = endpoints.twitch || (base ? `${base}/oauth/twitch/start` : "");

  const params = new URLSearchParams(window.location.search);
  const redirectParam = params.get("redirect");
  const redirectTarget = normalizeAdminDash(redirectParam || ADMIN_DASH);
  const reason = params.get("reason");
  let passwordLoginInFlight = false;

  if (elements.reason && reason) {
    elements.reason.textContent =
      reason === "logout"
        ? "You have been signed out. Please log in to continue."
        : "Administrator access required.";
  }

  function setStatus(state, message) {
    if (!elements.status) return;
    const nextMessage = typeof message === "string" ? message : "";
    if (nextMessage) {
      elements.status.dataset.state = state;
      elements.status.textContent = nextMessage;
      return;
    }
    delete elements.status.dataset.state;
    elements.status.textContent = "";
  }

  function isTurnstileBlocked() {
    return turnstileController?.isEnabled?.() && !turnstileController?.hasToken?.();
  }

  function syncTurnstileRuntimeNotice() {
    if (turnstileController?.isRuntimeDisabled?.()) {
      if (!elements.status?.textContent?.trim() || elements.status?.dataset.state === "warning") {
        setStatus("warning", "Cloudflare Turnstile is disabled by runtime env.");
      }
      return;
    }
    if (elements.status?.dataset.state === "warning") {
      setStatus("idle", "");
    }
  }

  function syncActionAvailability() {
    const disabled = isTurnstileBlocked();
    elements.oauthButtons.forEach((button) => {
      button.disabled = disabled;
      button.setAttribute("aria-disabled", disabled ? "true" : "false");
      button.classList.toggle("is-disabled", disabled);
    });
    const submitButton = elements.form?.querySelector('button[type="submit"]');
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = passwordLoginInFlight || disabled;
    }
  }

  function setLoading(isLoading) {
    const controls = [
      ...elements.oauthButtons,
      elements.email,
      elements.password
    ].filter(Boolean);
    controls.forEach((control) => {
      control.disabled = isLoading || (!isLoading && isTurnstileBlocked());
    });
    if (elements.manualToggle) {
      elements.manualToggle.disabled = isLoading;
    }
  }

  function normalizeAuthReason(value) {
    if (typeof value !== "string") return "";
    return value.trim().toLowerCase();
  }

  function extractErrorReason(payload, response) {
    const payloadReason =
      payload?.reason ||
      payload?.error?.reason ||
      payload?.error_code ||
      payload?.code ||
      payload?.status ||
      payload?.error ||
      payload?.message ||
      "";

    if (payloadReason) {
      return normalizeAuthReason(String(payloadReason));
    }

    if (!response?.headers) return "";
    return normalizeAuthReason(
      AUTH_REASON_HEADERS.map((header) => response.headers.get(header)).find(Boolean) || ""
    );
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
        const diffSeconds = Math.ceil(diffMs / 1000);
        return formatRetryAfter(String(diffSeconds));
      }
    }
    return raw;
  }

  function buildPasswordLoginErrorMessage(response, payload) {
    const status = Number(response?.status || 0);
    const retryAfter = formatRetryAfter(response?.headers?.get("Retry-After"));
    const reason = extractErrorReason(payload, response);
    const payloadMessage =
      typeof payload?.message === "string" && payload.message.trim()
        ? payload.message.trim()
        : typeof payload?.error === "string" && payload.error.trim()
          ? payload.error.trim()
          : "";

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

  async function startOAuth(provider) {
    const endpoint = endpoints[provider];
    if (!endpoint) {
      setStatus("error", `Auth provider not configured: ${provider}.`);
      return;
    }

    const destination =
      provider === "twitch" ? endpoint : enforceAdminOAuthEndpoint(endpoint);
    if (!destination) {
      setStatus("error", `Auth provider endpoint invalid: ${provider}.`);
      return;
    }
    const turnstileToken = await turnstileController?.requireToken?.();
    if (turnstileController?.isEnabled?.() && !turnstileToken) {
      setStatus("error", "Complete the security check to continue.");
      return;
    }

    const redirectUrl = parseUrl(destination, ADMIN_ORIGIN);
    if (redirectUrl) {
      if (turnstileToken) {
        redirectUrl.searchParams.set("turnstile_token", turnstileToken);
      }
      ["redirect_to", "post_login_redirect", "next"].forEach((paramName) => {
        redirectUrl.searchParams.set(paramName, redirectTarget);
      });
    }

    persistLastOauthProvider(provider);
    setStatus("loading", `Redirecting to ${provider}…`);
    window.location.assign(redirectUrl ? redirectUrl.toString() : destination);
  }

  async function submitPasswordLogin(event) {
    event.preventDefault();
    if (passwordLoginInFlight) {
      setStatus("loading", "A sign-in request is already in progress…");
      return;
    }
    const email = normalizeEmail(elements.email?.value || "");
    const password = elements.password?.value || "";

    if (!EMAIL_PATTERN.test(email)) {
      setStatus("error", "Enter a valid email address.");
      return;
    }

    if (!password) {
      setStatus("error", "Enter your admin password.");
      return;
    }

    if (!endpoints.login) {
      setStatus("offline", "Password login is unavailable because the auth endpoint is missing.");
      return;
    }
    const turnstileToken = await turnstileController?.requireToken?.();
    if (turnstileController?.isEnabled?.() && !turnstileToken) {
      setStatus("error", "Complete the security check to continue.");
      return;
    }

    passwordLoginInFlight = true;
    setLoading(true);
    setStatus("loading", "Signing in…");

    try {
      const response = await fetch(endpoints.login, {
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
        setStatus("sent", "Signed in. Redirecting to the dashboard…");
        window.location.assign(redirectTarget);
        return;
      }

      if (!response.ok) {
        const payload = await readErrorPayload(response);
        if (response.status === 404) {
          setStatus(
            "offline",
            "Password login is unavailable because the auth service rejected the login route."
          );
          return;
        }
        throw new Error(buildPasswordLoginErrorMessage(response, payload));
      }

      setStatus("sent", "Signed in. Redirecting to the dashboard…");
      window.location.assign(redirectTarget);
    } catch (err) {
      console.warn("[Admin Login] Password login failed:", err);
      setStatus("error", err?.message || "Unable to sign in. Try again shortly.");
    } finally {
      passwordLoginInFlight = false;
      setLoading(false);
      if (turnstileController?.isEnabled?.()) {
        turnstileController.reset();
      }
      syncActionAvailability();
    }
  }

  elements.oauthButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const provider = button.getAttribute("data-admin-auth-provider");
      if (provider) void startOAuth(provider);
    });
  });

  if (elements.manualToggle && elements.manualPanel) {
    elements.manualPanel.hidden = true;
    elements.manualToggle.setAttribute("aria-expanded", "false");
    elements.manualToggle.addEventListener("click", () => {
      const shouldOpen = elements.manualPanel.hidden;
      elements.manualPanel.hidden = !shouldOpen;
      elements.manualToggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
    });
  }

  if (elements.form) {
    elements.form.addEventListener("submit", submitPasswordLogin);
  }

  void turnstileController?.init?.()
    .catch(() => {
      if (elements.turnstileStatus) {
        elements.turnstileStatus.dataset.tone = "error";
        elements.turnstileStatus.textContent = "Security check failed to load. Refresh and try again.";
      }
    })
    .finally(() => {
      syncActionAvailability();
      syncTurnstileRuntimeNotice();
    });
})();

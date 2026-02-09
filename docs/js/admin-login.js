/* ======================================================================
   StreamSuites™ Dashboard — Admin Login (Standalone)
   ====================================================================== */

(() => {
  const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
  const LAST_OAUTH_PROVIDER_KEY = "streamsuites.admin.lastOauthProvider";
  const ADMIN_ORIGIN = "https://admin.streamsuites.app";
  const ADMIN_SUCCESS = `${ADMIN_ORIGIN}/auth/success.html`;
  const ADMIN_DASH = `${ADMIN_ORIGIN}/`;
  const ADMIN_HOSTNAME = "admin.streamsuites.app";
  const PUBLIC_HOSTNAMES = new Set(["streamsuites.app", "www.streamsuites.app"]);
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

  function normalizeEmail(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }

  function normalizeProvider(value) {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!normalized) return "";
    if (normalized === "twitter") return "x";
    return normalized;
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

  function buildAdminOAuthEndpoint(provider, endpointValue) {
    const endpoint = parseUrl(endpointValue, ADMIN_ORIGIN);
    if (!endpoint) return "";

    endpoint.searchParams.set("surface", "admin");

    const successParamNames = ["redirect", "success_url", "return_to", "callback_url"];
    successParamNames.forEach((paramName) => {
      const currentValue = endpoint.searchParams.get(paramName);
      if (currentValue && isPublicHost(currentValue)) {
        endpoint.searchParams.set(paramName, ADMIN_SUCCESS);
        return;
      }
      endpoint.searchParams.set(paramName, normalizeAdminSuccess(currentValue));
    });

    const dashParamNames = ["redirect_to", "post_login_redirect", "next"];
    dashParamNames.forEach((paramName) => {
      const currentValue = endpoint.searchParams.get(paramName);
      endpoint.searchParams.set(paramName, normalizeAdminDash(currentValue));
    });

    if (provider === "x") {
      endpoint.searchParams.set("surface", "admin");
    }

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
    oauthButtons: Array.from(document.querySelectorAll("[data-admin-auth-provider]"))
  };

  const baseUrl = getMetaContent("streamsuites-auth-base");
  const base = baseUrl ? baseUrl.replace(/\/$/, "") : "";
  const endpoints = {
    login:
      getMetaContent("streamsuites-auth-login") ||
      (base ? `${base}/auth/login` : ""),
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

  endpoints.google = buildAdminOAuthEndpoint(
    "google",
    defaultOAuthEndpoint("google") || endpoints.google
  );
  endpoints.github = buildAdminOAuthEndpoint(
    "github",
    defaultOAuthEndpoint("github") || endpoints.github
  );
  endpoints.discord = buildAdminOAuthEndpoint(
    "discord",
    defaultOAuthEndpoint("discord") || endpoints.discord
  );
  endpoints.x = buildAdminOAuthEndpoint("x", endpoints.x || (base ? `${base}/auth/x/start` : ""));
  endpoints.twitch = buildAdminOAuthEndpoint(
    "twitch",
    defaultOAuthEndpoint("twitch") || endpoints.twitch
  );

  const params = new URLSearchParams(window.location.search);
  const redirectParam = params.get("redirect");
  const redirectTarget = normalizeAdminDash(redirectParam || ADMIN_DASH);
  const reason = params.get("reason");

  if (elements.reason && reason) {
    elements.reason.textContent =
      reason === "logout"
        ? "You have been signed out. Please log in to continue."
        : "Administrator access required.";
  }

  function setStatus(state, message) {
    if (!elements.status) return;
    elements.status.dataset.state = state;
    elements.status.textContent = message || "";
  }

  function setLoading(isLoading) {
    const controls = [
      ...elements.oauthButtons,
      elements.email,
      elements.password
    ].filter(Boolean);
    controls.forEach((control) => {
      control.disabled = isLoading;
    });
  }

  function startOAuth(provider) {
    const endpoint = endpoints[provider];
    if (!endpoint) {
      setStatus("error", `Auth provider not configured: ${provider}.`);
      return;
    }
    persistLastOauthProvider(provider);
    setStatus("loading", `Redirecting to ${provider}…`);
    window.location.assign(endpoint);
  }

  async function submitEmergencyLogin(event) {
    event.preventDefault();
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
      setStatus("offline", "Emergency access is offline. Auth login endpoint is missing.");
      return;
    }

    setLoading(true);
    setStatus("loading", "Submitting emergency admin access…");

    try {
      const response = await fetch(endpoints.login, {
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
          setStatus(
            "offline",
            "Emergency access is offline. The auth service did not accept manual login."
          );
          return;
        }
        throw new Error(`Manual login failed (${response.status}).`);
      }

      setStatus("sent", "Login submitted. Redirecting to the dashboard…");
      window.location.assign(redirectTarget);
    } catch (err) {
      console.warn("[Admin Login] Manual login failed:", err);
      setStatus("error", "Unable to submit manual login. Try again shortly.");
    } finally {
      setLoading(false);
    }
  }

  elements.oauthButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const provider = button.getAttribute("data-admin-auth-provider");
      if (provider) startOAuth(provider);
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
    elements.form.addEventListener("submit", submitEmergencyLogin);
  }
})();

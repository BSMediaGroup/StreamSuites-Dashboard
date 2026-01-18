/* ======================================================================
   StreamSuites™ Dashboard — Admin Login (Standalone)
   ====================================================================== */

(() => {
  const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
  const ADMIN_BASE_PATH = window.ADMIN_BASE_PATH ?? "";
  window.ADMIN_BASE_PATH = ADMIN_BASE_PATH;
  const ADMIN_ORIGIN = window.location.origin;

  function getMetaContent(name) {
    const value = document.querySelector(`meta[name="${name}"]`)?.getAttribute("content");
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeEmail(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }

  const elements = {
    reason: document.getElementById("admin-login-reason"),
    status: document.getElementById("admin-login-status"),
    form: document.getElementById("admin-login-form"),
    email: document.getElementById("admin-login-email"),
    password: document.getElementById("admin-login-password"),
    oauthButtons: Array.from(document.querySelectorAll("[data-admin-auth-provider]"))
  };

  const baseUrl = getMetaContent("streamsuites-auth-base");
  const endpoints = {
    login:
      getMetaContent("streamsuites-auth-login") ||
      (baseUrl ? `${baseUrl.replace(/\/$/, "")}/auth/login` : ""),
    google: getMetaContent("streamsuites-auth-google"),
    github: getMetaContent("streamsuites-auth-github")
  };

  const params = new URLSearchParams(window.location.search);
  const redirectParam = params.get("redirect");
  const redirectTarget = new URL(
    redirectParam || `${ADMIN_BASE_PATH}/index.html`,
    ADMIN_ORIGIN
  ).toString();
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

  if (elements.form) {
    elements.form.addEventListener("submit", submitEmergencyLogin);
  }
})();

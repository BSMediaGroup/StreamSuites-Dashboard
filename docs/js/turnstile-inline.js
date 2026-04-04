(function () {
  const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  let scriptPromise = null;

  function setStatus(element, message, tone) {
    if (!element) return;
    element.textContent = typeof message === "string" ? message : "";
    element.dataset.tone = tone || "";
  }

  async function loadScript() {
    if (window.turnstile?.render) return window.turnstile;
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(window.turnstile), { once: true });
        existing.addEventListener("error", () => reject(new Error("turnstile-script-load-failed")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => reject(new Error("turnstile-script-load-failed"));
      document.head.appendChild(script);
    }).finally(() => {
      scriptPromise = null;
    });
    return scriptPromise;
  }

  function createController(options) {
    const state = {
      enabled: false,
      sitekey: "",
      token: "",
      widgetId: null,
    };
    const configUrl = options?.configUrl;
    const panel = options?.panel || null;
    const slot = options?.slot || null;
    const status = options?.status || null;
    const onStateChange = typeof options?.onStateChange === "function" ? options.onStateChange : null;

    function notify() {
      if (onStateChange) {
        onStateChange({
          enabled: state.enabled,
          token: state.token,
        });
      }
    }

    async function init() {
      if (!configUrl) return state;
      const response = await fetch(configUrl, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      }).catch(() => null);
      const payload = response?.ok ? await response.json().catch(() => null) : null;
      state.sitekey = typeof payload?.sitekey === "string" ? payload.sitekey.trim() : "";
      state.enabled = payload?.enabled === true && state.sitekey.length > 0;
      if (panel) {
        panel.hidden = !state.enabled;
      }
      if (!state.enabled || !slot) {
        notify();
        return state;
      }
      if (state.widgetId !== null) {
        notify();
        return state;
      }

      setStatus(status, "Complete the security check to continue.");
      const turnstile = await loadScript();
      state.widgetId = turnstile.render(slot, {
        sitekey: state.sitekey,
        theme: "auto",
        callback(token) {
          state.token = String(token || "").trim();
          setStatus(status, "Security check ready.", "success");
          notify();
        },
        "expired-callback"() {
          state.token = "";
          setStatus(status, "The security check expired. Complete it again.", "error");
          notify();
        },
        "error-callback"() {
          state.token = "";
          setStatus(status, "Security check failed to load. Refresh and try again.", "error");
          notify();
        },
      });
      notify();
      return state;
    }

    function reset() {
      if (!state.enabled || state.widgetId === null || !window.turnstile?.reset) return;
      state.token = "";
      window.turnstile.reset(state.widgetId);
      setStatus(status, "Complete the security check to continue.");
      notify();
    }

    async function requireToken() {
      await init();
      if (!state.enabled) return "";
      if (state.token) return state.token;
      setStatus(status, "Complete the security check to continue.", "error");
      notify();
      return "";
    }

    return {
      init,
      reset,
      requireToken,
      isEnabled() {
        return state.enabled;
      },
      hasToken() {
        return !!state.token;
      },
    };
  }

  window.StreamSuitesTurnstileInline = { createController };
})();

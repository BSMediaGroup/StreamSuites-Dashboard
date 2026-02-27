(() => {
  "use strict";

  const STATUS_ENDPOINT = "/api/admin/discord/bot/status";
  const LOADING_TEXT = "Loading...";
  const NOT_AVAILABLE_TEXT = "Not available";
  const OFFICIAL_GUILD_FALLBACK = "Configured in Auth API (DISCORD_SS_GUILD_ID)";

  function cacheElements() {
    return {
      status: document.getElementById("dc-admin-status"),
      banner: document.getElementById("dc-admin-banner"),
      admin: {
        reverify: document.getElementById("dc-admin-reverify"),
        install: document.getElementById("dc-admin-install"),
        officialGuildId: document.getElementById("dc-admin-official-guild-id"),
        isInstalled: document.getElementById("dc-admin-is-installed"),
        verified: document.getElementById("dc-admin-verified"),
        lastVerifiedAt: document.getElementById("dc-admin-last-verified-at"),
        botUserId: document.getElementById("dc-admin-bot-user-id"),
        expectedBotUserId: document.getElementById("dc-admin-expected-bot-user-id"),
        installClientId: document.getElementById("dc-admin-install-client-id"),
        installPermissions: document.getElementById("dc-admin-install-permissions"),
        installScopes: document.getElementById("dc-admin-install-scopes"),
        errorWrap: document.getElementById("dc-admin-error-wrap"),
        error: document.getElementById("dc-admin-error"),
      },
      public: {
        reverify: document.getElementById("dc-public-reverify"),
        install: document.getElementById("dc-public-install"),
        officialGuildId: document.getElementById("dc-public-official-guild-id"),
        isInstalled: document.getElementById("dc-public-is-installed"),
        verified: document.getElementById("dc-public-verified"),
        lastVerifiedAt: document.getElementById("dc-public-last-verified-at"),
        botUserId: document.getElementById("dc-public-bot-user-id"),
        expectedBotUserId: document.getElementById("dc-public-expected-bot-user-id"),
        installClientId: document.getElementById("dc-public-install-client-id"),
        installPermissions: document.getElementById("dc-public-install-permissions"),
        installScopes: document.getElementById("dc-public-install-scopes"),
        errorWrap: document.getElementById("dc-public-error-wrap"),
        error: document.getElementById("dc-public-error"),
      },
    };
  }

  function setText(target, value) {
    if (!target) return;
    target.textContent = String(value ?? "");
  }

  function normalizeText(value, fallback = NOT_AVAILABLE_TEXT) {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    return text ? text : fallback;
  }

  function formatTimestamp(value) {
    if (!value) return NOT_AVAILABLE_TEXT;
    try {
      const formatted = window.StreamSuitesState?.formatTimestamp?.(value);
      if (formatted && formatted !== "Not available") return formatted;
    } catch {}
    return normalizeText(value);
  }

  function setBanner(els, message, variant = "warning") {
    if (!els?.banner) return;
    const tone = variant === "danger" ? "danger" : "warning";
    els.banner.classList.remove("hidden", "ss-alert-danger", "ss-alert-warning");
    els.banner.classList.add(`ss-alert-${tone}`);
    setText(els.banner, message);
  }

  function clearBanner(els) {
    if (!els?.banner) return;
    els.banner.classList.add("hidden");
    els.banner.classList.remove("ss-alert-danger", "ss-alert-warning");
    setText(els.banner, "");
  }

  function setStatusIndicator(els, text, className) {
    if (!els?.status) return;
    els.status.classList.remove("idle", "active");
    els.status.classList.add(className || "idle");
    setText(els.status, `● ${text}`);
  }

  function promptAdminReauth() {
    if (typeof window.StreamSuitesAdminGate?.logout === "function") {
      window.StreamSuitesAdminGate.logout();
      return true;
    }
    if (typeof window.StreamSuitesAdminAuth?.logout === "function") {
      window.StreamSuitesAdminAuth.logout();
      return true;
    }
    return false;
  }

  function parseVerifyError(verification) {
    if (!verification || typeof verification !== "object") return "";
    const exact = normalizeText(verification.last_verify_error || "", "");
    if (exact) return exact;
    return normalizeText(verification.error || "", "");
  }

  function renderProfileCard(cardEls, payload, profile) {
    if (!cardEls) return;
    const verification = profile?.verification || {};
    const install = profile?.install || {};
    const officialGuildId = normalizeText(
      payload?.official_guild_id || verification?.guild_id,
      OFFICIAL_GUILD_FALLBACK
    );

    setText(cardEls.officialGuildId, officialGuildId);
    setText(
      cardEls.isInstalled,
      typeof verification?.is_installed === "boolean"
        ? String(verification.is_installed)
        : NOT_AVAILABLE_TEXT
    );
    setText(
      cardEls.verified,
      typeof verification?.success === "boolean"
        ? String(verification.success)
        : NOT_AVAILABLE_TEXT
    );
    setText(cardEls.lastVerifiedAt, formatTimestamp(verification?.last_verified_at));
    setText(cardEls.botUserId, normalizeText(verification?.bot_user_id));
    setText(cardEls.expectedBotUserId, normalizeText(verification?.expected_bot_user_id));
    setText(cardEls.installClientId, normalizeText(install?.client_id));
    setText(
      cardEls.installPermissions,
      typeof install?.permissions === "number"
        ? String(install.permissions)
        : normalizeText(install?.permissions)
    );
    setText(
      cardEls.installScopes,
      Array.isArray(install?.scopes) && install.scopes.length
        ? install.scopes.join(", ")
        : NOT_AVAILABLE_TEXT
    );

    const errorText = parseVerifyError(verification);
    if (cardEls.errorWrap) {
      cardEls.errorWrap.classList.toggle("hidden", !errorText);
      cardEls.errorWrap.open = false;
    }
    setText(cardEls.error, errorText);

    if (cardEls.install) {
      const hasInstallUrl = Boolean(normalizeText(install?.url, ""));
      cardEls.install.dataset.hasInstallUrl = hasInstallUrl ? "true" : "false";
      cardEls.install.disabled = !hasInstallUrl;
    }
  }

  function setLoadingState(els, loading) {
    const sections = [els?.admin, els?.public];
    sections.forEach((section) => {
      if (!section) return;
      if (section.reverify) {
        section.reverify.disabled = loading;
        setText(section.reverify, loading ? "Re-verifying..." : "Re-verify");
      }
      if (section.install) {
        const hasInstallUrl = section.install.dataset.hasInstallUrl === "true";
        section.install.disabled = loading || !hasInstallUrl;
      }
    });
    if (loading) setStatusIndicator(els, "Discord bot status: Loading", "idle");
  }

  async function fetchStatus() {
    if (typeof window.StreamSuitesApi?.apiFetch === "function") {
      return window.StreamSuitesApi.apiFetch(STATUS_ENDPOINT, {
        cacheTtlMs: 0,
        forceRefresh: true,
        timeoutMs: 10000,
      });
    }

    const url =
      typeof window.StreamSuitesApi?.buildApiUrl === "function"
        ? window.StreamSuitesApi.buildApiUrl(STATUS_ENDPOINT)
        : STATUS_ENDPOINT;
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const err = new Error(`Request failed (${response.status})`);
      err.status = response.status;
      err.isAuthError = response.status === 401 || response.status === 403;
      throw err;
    }
    return response.json();
  }

  function createController() {
    const state = {
      els: null,
      payload: null,
      busy: false,
      listeners: [],
    };

    function addListener(node, eventName, handler) {
      if (!node || typeof handler !== "function") return;
      node.addEventListener(eventName, handler);
      state.listeners.push(() => node.removeEventListener(eventName, handler));
    }

    function setInitialLoading() {
      const targets = [
        state.els?.admin?.officialGuildId,
        state.els?.admin?.isInstalled,
        state.els?.admin?.verified,
        state.els?.admin?.lastVerifiedAt,
        state.els?.admin?.botUserId,
        state.els?.admin?.expectedBotUserId,
        state.els?.admin?.installClientId,
        state.els?.admin?.installPermissions,
        state.els?.admin?.installScopes,
        state.els?.public?.officialGuildId,
        state.els?.public?.isInstalled,
        state.els?.public?.verified,
        state.els?.public?.lastVerifiedAt,
        state.els?.public?.botUserId,
        state.els?.public?.expectedBotUserId,
        state.els?.public?.installClientId,
        state.els?.public?.installPermissions,
        state.els?.public?.installScopes,
      ];
      targets.forEach((target) => setText(target, LOADING_TEXT));
      if (state.els?.admin?.errorWrap) state.els.admin.errorWrap.classList.add("hidden");
      if (state.els?.public?.errorWrap) state.els.public.errorWrap.classList.add("hidden");
    }

    function openInstall(profileKey) {
      const url = normalizeText(
        state.payload?.profiles?.[profileKey]?.install?.url,
        ""
      );
      if (!url) {
        setBanner(
          state.els,
          "Install URL is not available for this bot profile.",
          "warning"
        );
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    }

    async function hydrate() {
      if (state.busy) return;
      state.busy = true;
      setLoadingState(state.els, true);
      clearBanner(state.els);

      try {
        const payload = await fetchStatus();
        state.payload = payload || {};
        renderProfileCard(state.els?.admin, state.payload, state.payload?.profiles?.admin);
        renderProfileCard(state.els?.public, state.payload, state.payload?.profiles?.public);
        setStatusIndicator(state.els, "Discord bot status: Loaded", "active");
      } catch (err) {
        const isAuthError = err?.isAuthError || err?.status === 401 || err?.status === 403;
        if (isAuthError) {
          setBanner(
            state.els,
            "Admin session expired. Please log in again.",
            "danger"
          );
          promptAdminReauth();
        } else {
          setBanner(
            state.els,
            "Unable to load Discord bot status right now. You can retry.",
            "warning"
          );
        }
        setStatusIndicator(state.els, "Discord bot status: Error", "idle");
      } finally {
        state.busy = false;
        setLoadingState(state.els, false);
      }
    }

    function init() {
      state.els = cacheElements();
      setInitialLoading();
      setLoadingState(state.els, true);

      addListener(state.els?.admin?.reverify, "click", () => {
        hydrate();
      });
      addListener(state.els?.public?.reverify, "click", () => {
        hydrate();
      });
      addListener(state.els?.admin?.install, "click", () => {
        openInstall("admin");
      });
      addListener(state.els?.public?.install, "click", () => {
        openInstall("public");
      });

      hydrate();
    }

    function destroy() {
      while (state.listeners.length) {
        const remove = state.listeners.pop();
        try {
          remove?.();
        } catch {}
      }
      state.payload = null;
      state.busy = false;
    }

    return { init, destroy };
  }

  const controller = createController();
  window.DiscordView = {
    init: controller.init,
    destroy: controller.destroy,
  };
})();

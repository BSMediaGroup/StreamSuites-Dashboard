(() => {
  "use strict";

  const STATUS_ENDPOINT = "/api/admin/discord/bot/status";
  const INSTALLS_ENDPOINT = "/api/admin/discord/bot/installs";
  const LOADING_TEXT = "Loading...";
  const NOT_AVAILABLE_TEXT = "Not available";
  const OFFICIAL_GUILD_FALLBACK = "Configured in Auth API (DISCORD_SS_GUILD_ID)";
  const EMPTY_DASH = "—";
  const INSTALLS_LIMIT_DEFAULT = 50;
  const INSTALLS_LIMIT_MAX = 200;
  const STATUS_TIMEOUT_MS = 10000;
  const STATUS_REVERIFY_TIMEOUT_MS = 20000;
  const INSTALLS_TIMEOUT_MS = 12000;

  function cacheElements() {
    return {
      status: document.getElementById("dc-admin-status"),
      banner: document.getElementById("dc-admin-banner"),
      debugLine: document.getElementById("dc-debug-line"),
      admin: {
        statusPill: document.getElementById("dc-admin-card-status"),
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
        statusPill: document.getElementById("dc-public-card-status"),
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
      installs: {
        refresh: document.getElementById("dc-installs-refresh"),
        guildFilter: document.getElementById("dc-installs-guild-filter"),
        accountFilter: document.getElementById("dc-installs-account-filter"),
        installedOnly: document.getElementById("dc-installs-installed-only"),
        limit: document.getElementById("dc-installs-limit"),
        loading: document.getElementById("dc-installs-loading"),
        error: document.getElementById("dc-installs-error"),
        body: document.getElementById("dc-installs-body"),
        prev: document.getElementById("dc-installs-prev"),
        next: document.getElementById("dc-installs-next"),
        pageIndicator: document.getElementById("dc-installs-page-indicator"),
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

  function normalizeOptionalText(value) {
    const text = String(value ?? "").trim();
    return text || null;
  }

  function formatTimestamp(value) {
    if (!value) return NOT_AVAILABLE_TEXT;
    try {
      const formatted = window.StreamSuitesState?.formatTimestamp?.(value);
      if (formatted && formatted !== "Not available") return formatted;
    } catch {}
    return normalizeText(value);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function setCardStatusPill(cardEls, value, tone = "offline") {
    const pill = cardEls?.statusPill;
    if (!pill) return;
    pill.classList.remove("online", "offline");
    pill.classList.add(tone === "online" ? "online" : "offline");
    setText(pill, value);
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

  function isNotVerifiedYet(verification) {
    const error = normalizeText(verification?.error || verification?.last_verify_error || "", "");
    const lastVerifiedAt = normalizeText(verification?.last_verified_at || "", "");
    return error === "not_verified_yet" && !lastVerifiedAt;
  }

  function formatHttpStatus(value) {
    const status = Number(value);
    if (Number.isFinite(status) && status > 0) return String(status);
    return "n/a";
  }

  function setDebugLine(els, options = {}) {
    const target = els?.debugLine;
    if (!target) return;
    const timestamp = options.timestamp || new Date().toLocaleString();
    const source = options.source || "cached";
    const http = formatHttpStatus(options.httpStatus);
    target.textContent = `Last refresh: ${timestamp} | Source: ${source} | HTTP: ${http}`;
  }

  function getPayloadErrorText(payload) {
    if (!payload || typeof payload !== "object") return "";
    return normalizeText(payload.error || payload.message || "", "");
  }

  function renderCardInlineError(cardEls, message) {
    if (!cardEls?.errorWrap) return;
    const text = normalizeText(message || "", "");
    cardEls.errorWrap.classList.toggle("hidden", !text);
    cardEls.errorWrap.open = false;
    setText(cardEls.error, text);
  }

  function renderProfileCard(cardEls, payload, profile, options = {}) {
    if (!cardEls) return;
    const verification = profile?.verification || {};
    const install = profile?.install || {};
    const officialGuildId = normalizeText(
      payload?.official_guild_id || verification?.guild_id,
      OFFICIAL_GUILD_FALLBACK
    );
    const fallbackError = normalizeText(options.errorText || getPayloadErrorText(payload), "");
    const hasProfile = Boolean(profile && typeof profile === "object");
    const defaultUnavailable = options.statusLabel || "Unavailable";

    if (!hasProfile) {
      setText(cardEls.officialGuildId, officialGuildId);
      setText(cardEls.isInstalled, defaultUnavailable);
      setText(cardEls.verified, defaultUnavailable);
      setText(cardEls.lastVerifiedAt, NOT_AVAILABLE_TEXT);
      setText(cardEls.botUserId, NOT_AVAILABLE_TEXT);
      setText(cardEls.expectedBotUserId, NOT_AVAILABLE_TEXT);
      setText(cardEls.installClientId, NOT_AVAILABLE_TEXT);
      setText(cardEls.installPermissions, NOT_AVAILABLE_TEXT);
      setText(cardEls.installScopes, NOT_AVAILABLE_TEXT);
      renderCardInlineError(cardEls, fallbackError || "Profile data unavailable.");
      if (cardEls.install) {
        cardEls.install.dataset.hasInstallUrl = "false";
        cardEls.install.disabled = true;
      }
      setCardStatusPill(cardEls, defaultUnavailable, "offline");
      return;
    }

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

    const notVerifiedYet = isNotVerifiedYet(verification);
    const verifyError = parseVerifyError(verification);
    const errorText = notVerifiedYet ? fallbackError : verifyError || fallbackError;
    renderCardInlineError(cardEls, errorText);

    if (cardEls.install) {
      const hasInstallUrl = Boolean(normalizeText(install?.url, ""));
      cardEls.install.dataset.hasInstallUrl = hasInstallUrl ? "true" : "false";
      cardEls.install.disabled = !hasInstallUrl;
    }

    if (verification?.success === true) {
      setCardStatusPill(cardEls, "Verified", "online");
    } else if (notVerifiedYet) {
      setCardStatusPill(cardEls, "Not verified", "offline");
    } else if (verification?.success === false) {
      setCardStatusPill(cardEls, "Verification failed", "offline");
    } else {
      setCardStatusPill(cardEls, "Unavailable", "offline");
    }
  }

  function setStatusLoadingState(els, loading, options = {}) {
    const loadingLabel = options.reverify === true ? "Re-verifying..." : "Re-verify";
    const sections = [els?.admin, els?.public];
    sections.forEach((section) => {
      if (!section) return;
      if (section.reverify) {
        section.reverify.disabled = loading;
        setText(section.reverify, loading ? loadingLabel : "Re-verify");
      }
      if (section.install) {
        const hasInstallUrl = section.install.dataset.hasInstallUrl === "true";
        section.install.disabled = loading || !hasInstallUrl;
      }
    });
    if (loading) setStatusIndicator(els, "Discord bot status: Loading", "idle");
  }

  function setInstallsError(els, message, variant = "warning") {
    const errorEl = els?.installs?.error;
    if (!errorEl) return;
    const tone = variant === "danger" ? "danger" : "warning";
    errorEl.classList.remove("hidden", "ss-alert-danger", "ss-alert-warning");
    errorEl.classList.add(`ss-alert-${tone}`);
    setText(errorEl, message);
  }

  function clearInstallsError(els) {
    const errorEl = els?.installs?.error;
    if (!errorEl) return;
    errorEl.classList.add("hidden");
    errorEl.classList.remove("ss-alert-danger", "ss-alert-warning");
    setText(errorEl, "");
  }

  function clampLimit(value) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(parsed)) return INSTALLS_LIMIT_DEFAULT;
    return Math.max(1, Math.min(parsed, INSTALLS_LIMIT_MAX));
  }

  function buildInstallsQuery(filters, offset) {
    const params = new URLSearchParams();
    params.set("bot_profile", "public");
    params.set("limit", String(clampLimit(filters?.limit)));
    params.set("offset", String(Math.max(0, Number(offset) || 0)));

    const guildId = normalizeOptionalText(filters?.guildId);
    if (guildId) params.set("guild_id", guildId);

    const accountId = normalizeOptionalText(filters?.accountId);
    if (accountId) params.set("account_id", accountId);

    if (filters?.installedOnly) params.set("installed_only", "1");

    return params.toString();
  }

  function buildStatusEndpoint(options = {}) {
    const params = new URLSearchParams();
    if (options.reverify === true) {
      params.set("reverify", "1");
    }
    const query = params.toString();
    return query ? `${STATUS_ENDPOINT}?${query}` : STATUS_ENDPOINT;
  }

  async function fetchStatus(options = {}) {
    const endpoint = buildStatusEndpoint(options);
    const timeoutMs = options.reverify === true ? STATUS_REVERIFY_TIMEOUT_MS : STATUS_TIMEOUT_MS;
    if (typeof window.StreamSuitesApi?.apiFetch === "function") {
      const payload = await window.StreamSuitesApi.apiFetch(endpoint, {
        cacheTtlMs: 0,
        forceRefresh: true,
        timeoutMs,
      });
      return {
        payload,
        httpStatus: 200,
      };
    }

    const url =
      typeof window.StreamSuitesApi?.buildApiUrl === "function"
        ? window.StreamSuitesApi.buildApiUrl(endpoint)
        : endpoint;
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const err = new Error(`Request failed (${response.status})`);
      err.status = response.status;
      err.isAuthError = response.status === 401 || response.status === 403;
      throw err;
    }
    return {
      payload: await response.json(),
      httpStatus: response.status,
    };
  }

  async function fetchInstalls(filters, offset) {
    const query = buildInstallsQuery(filters, offset);
    const endpoint = `${INSTALLS_ENDPOINT}?${query}`;
    if (typeof window.StreamSuitesApi?.apiFetch === "function") {
      return window.StreamSuitesApi.apiFetch(endpoint, {
        cacheTtlMs: 0,
        forceRefresh: true,
        timeoutMs: INSTALLS_TIMEOUT_MS,
      });
    }

    const url =
      typeof window.StreamSuitesApi?.buildApiUrl === "function"
        ? window.StreamSuitesApi.buildApiUrl(endpoint)
        : endpoint;
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" },
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
      installs: {
        busy: false,
        filters: {
          guildId: "",
          accountId: "",
          installedOnly: false,
          limit: INSTALLS_LIMIT_DEFAULT,
        },
        offset: 0,
        paging: {
          returned: 0,
          total: 0,
          hasMore: false,
        },
        items: [],
        emptyMessage: "No installs found.",
        expandedErrorKeys: new Set(),
      },
      hasRenderedStatus: false,
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
      setCardStatusPill(state.els?.admin, "Loading...", "offline");
      setCardStatusPill(state.els?.public, "Loading...", "offline");
      if (state.els?.installs?.body) {
        state.els.installs.body.innerHTML =
          '<tr><td class="muted" colspan="5">Loading...</td></tr>';
      }
      if (state.els?.installs?.pageIndicator) {
        setText(state.els.installs.pageIndicator, "Showing 0–0 of 0");
      }
      clearInstallsError(state.els);
    }

    function syncInstallFilterStateFromUi() {
      const installsEls = state.els?.installs;
      if (!installsEls) return;
      state.installs.filters.guildId = String(installsEls.guildFilter?.value || "").trim();
      state.installs.filters.accountId = String(installsEls.accountFilter?.value || "").trim();
      state.installs.filters.installedOnly = Boolean(installsEls.installedOnly?.checked);
      state.installs.filters.limit = clampLimit(installsEls.limit?.value);
      if (installsEls.limit) installsEls.limit.value = String(state.installs.filters.limit);
    }

    function setInstallsLoadingState(loading) {
      const installsEls = state.els?.installs;
      if (!installsEls) return;

      if (installsEls.loading) installsEls.loading.classList.toggle("hidden", !loading);
      if (installsEls.refresh) installsEls.refresh.disabled = loading;
      if (installsEls.guildFilter) installsEls.guildFilter.disabled = loading;
      if (installsEls.accountFilter) installsEls.accountFilter.disabled = loading;
      if (installsEls.installedOnly) installsEls.installedOnly.disabled = loading;
      if (installsEls.limit) installsEls.limit.disabled = loading;

      const hasPrev = state.installs.offset > 0;
      const hasNext = Boolean(state.installs.paging?.hasMore);
      if (installsEls.prev) installsEls.prev.disabled = loading || !hasPrev;
      if (installsEls.next) installsEls.next.disabled = loading || !hasNext;
    }

    function formatInstallAccount(item) {
      const account = item?.account || {};
      const accountId = normalizeOptionalText(account.account_id);
      const display = normalizeOptionalText(account.display) || accountId || EMPTY_DASH;
      return {
        html: accountId
          ? `<div>${escapeHtml(display)}</div><div class="muted">${escapeHtml(accountId)}</div>`
          : `<div>${escapeHtml(display)}</div>`,
      };
    }

    function formatInstallGuild(item) {
      const install = item?.install || {};
      const guildId = normalizeOptionalText(install.guild_id) || EMPTY_DASH;
      const guildName = normalizeOptionalText(install.guild_name);
      const showSubtext = guildName && guildName !== guildId;
      return showSubtext
        ? `<div>${escapeHtml(guildName)}</div><div class="muted">${escapeHtml(guildId)}</div>`
        : `<div>${escapeHtml(guildName || guildId)}</div>`;
    }

    function installRowKey(item, index) {
      const accountId = normalizeOptionalText(item?.account?.account_id) || "unknown-account";
      const guildId = normalizeOptionalText(item?.install?.guild_id) || "unknown-guild";
      return `${accountId}::${guildId}::${index}`;
    }

    function renderInstallsTable() {
      const installsEls = state.els?.installs;
      if (!installsEls?.body) return;

      const items = Array.isArray(state.installs.items) ? state.installs.items : [];
      if (!items.length) {
        installsEls.body.innerHTML =
          `<tr><td class="muted" colspan="5">${escapeHtml(
            state.installs.emptyMessage || "No installs found."
          )}</td></tr>`;
        return;
      }

      const rows = [];
      items.forEach((item, index) => {
        const key = installRowKey(item, index);
        const install = item?.install || {};
        const accountCell = formatInstallAccount(item).html;
        const guildCell = formatInstallGuild(item);
        const isInstalled = Boolean(install.is_installed);
        const statusText = isInstalled ? "Installed" : "Not Installed";
        const lastVerified = normalizeOptionalText(install.last_verified_at)
          ? formatTimestamp(install.last_verified_at)
          : EMPTY_DASH;
        const verifyError = normalizeOptionalText(install.last_verify_error);
        const isExpanded = state.installs.expandedErrorKeys.has(key);
        const toggleLabel = isExpanded ? "Hide" : "View";

        rows.push(
          `<tr data-install-key="${escapeHtml(key)}">` +
            `<td>${accountCell}</td>` +
            `<td>${guildCell}</td>` +
            `<td>${escapeHtml(statusText)}</td>` +
            `<td>${escapeHtml(lastVerified)}</td>` +
            `<td>` +
              (verifyError
                ? `<button class="ss-btn ss-btn-small ss-btn-secondary" data-error-toggle="${escapeHtml(
                    key
                  )}" type="button">${escapeHtml(toggleLabel)}</button>`
                : `<span class="muted">${EMPTY_DASH}</span>`) +
            `</td>` +
          `</tr>`
        );

        if (verifyError && isExpanded) {
          rows.push(
            `<tr data-install-error-row="${escapeHtml(key)}">` +
              `<td colspan="5" class="muted" style="word-break: break-word;">${escapeHtml(verifyError)}</td>` +
            `</tr>`
          );
        }
      });

      installsEls.body.innerHTML = rows.join("");
    }

    function renderInstallsPaging(payloadPaging) {
      const paging = payloadPaging && typeof payloadPaging === "object" ? payloadPaging : {};
      const total = Math.max(0, Number(paging.total) || 0);
      const returned = Math.max(0, Number(paging.returned) || 0);
      const offset = Math.max(0, Number(paging.offset) || state.installs.offset || 0);
      const hasMore = Boolean(paging.has_more);
      state.installs.paging = { total, returned, hasMore };
      state.installs.offset = offset;

      const start = total > 0 && returned > 0 ? offset + 1 : 0;
      const end = total > 0 && returned > 0 ? offset + returned : 0;
      if (state.els?.installs?.pageIndicator) {
        setText(state.els.installs.pageIndicator, `Showing ${start}–${end} of ${total}`);
      }
    }

    function getProfileElements(profileKey) {
      if (profileKey === "admin") return state.els?.admin || null;
      if (profileKey === "public") return state.els?.public || null;
      return null;
    }

    function openInstall(profileKey) {
      const profileEls = getProfileElements(profileKey);
      const url = normalizeText(
        state.payload?.profiles?.[profileKey]?.install?.url,
        ""
      );
      if (!url) {
        renderCardInlineError(profileEls, "Install URL is not available for this bot profile.");
        return;
      }
      renderCardInlineError(profileEls, parseVerifyError(state.payload?.profiles?.[profileKey]?.verification));
      window.open(url, "_blank", "noopener,noreferrer");
    }

    async function hydrateStatus(options = {}) {
      if (state.busy) return;
      state.busy = true;
      setStatusLoadingState(state.els, true, options);
      clearBanner(state.els);
      const sourceLabel = options.reverify === true ? "reverify" : "cached";

      try {
        const response = await fetchStatus(options);
        state.payload = response?.payload || {};
        setDebugLine(state.els, { source: sourceLabel, httpStatus: response?.httpStatus });
        const payloadError = getPayloadErrorText(state.payload);

        if (state.payload?.success === false) {
          renderProfileCard(state.els?.admin, state.payload, null, {
            statusLabel: "Error",
            errorText: payloadError || "Auth API reported an error for Discord bot status.",
          });
          renderProfileCard(state.els?.public, state.payload, null, {
            statusLabel: "Error",
            errorText: payloadError || "Auth API reported an error for Discord bot status.",
          });
          setBanner(
            state.els,
            payloadError || "Discord bot status is currently unavailable.",
            "warning"
          );
          setStatusIndicator(state.els, "Discord bot status: Error", "idle");
          state.hasRenderedStatus = true;
          return;
        }

        renderProfileCard(state.els?.admin, state.payload, state.payload?.profiles?.admin, {
          statusLabel: "Unavailable",
          errorText: payloadError,
        });
        renderProfileCard(state.els?.public, state.payload, state.payload?.profiles?.public, {
          statusLabel: "Unavailable",
          errorText: payloadError,
        });
        state.hasRenderedStatus = true;
        setStatusIndicator(state.els, "Discord bot status: Loaded", "active");
      } catch (err) {
        setDebugLine(state.els, {
          source: sourceLabel,
          httpStatus: err?.status || 0,
        });
        const isAuthError = err?.isAuthError || err?.status === 401 || err?.status === 403;
        if (isAuthError) {
          const message = "Admin session expired. Please log in again.";
          setBanner(
            state.els,
            message,
            "danger"
          );
          renderCardInlineError(state.els?.admin, message);
          renderCardInlineError(state.els?.public, message);
          if (!state.hasRenderedStatus) {
            renderProfileCard(state.els?.admin, state.payload, null, {
              statusLabel: "Error",
              errorText: message,
            });
            renderProfileCard(state.els?.public, state.payload, null, {
              statusLabel: "Error",
              errorText: message,
            });
            state.hasRenderedStatus = true;
          }
          promptAdminReauth();
        } else {
          const message = "Unable to load Discord bot status right now. You can retry.";
          setBanner(
            state.els,
            message,
            "warning"
          );
          if (!state.hasRenderedStatus) {
            renderProfileCard(state.els?.admin, state.payload, null, {
              statusLabel: "Unavailable",
              errorText: message,
            });
            renderProfileCard(state.els?.public, state.payload, null, {
              statusLabel: "Unavailable",
              errorText: message,
            });
            state.hasRenderedStatus = true;
          }
        }
        setStatusIndicator(state.els, "Discord bot status: Error", "idle");
      } finally {
        state.busy = false;
        setStatusLoadingState(state.els, false, options);
      }
    }

    async function hydrateInstalls(options = {}) {
      if (state.installs.busy) return;
      if (options.resetOffset) state.installs.offset = 0;
      syncInstallFilterStateFromUi();

      state.installs.busy = true;
      setInstallsLoadingState(true);
      clearInstallsError(state.els);

      try {
        const payload = await fetchInstalls(state.installs.filters, state.installs.offset);
        if (payload?.success === false) {
          state.installs.items = [];
          state.installs.emptyMessage = "No installs found.";
          renderInstallsPaging({
            offset: state.installs.offset,
            returned: 0,
            total: 0,
            has_more: false,
          });
          const payloadMessage = normalizeText(
            payload?.error || payload?.message,
            "Unable to load creator guild installs right now. Try Refresh."
          );
          const isAuthPayload = payload?.status === 401 || payload?.status === 403;
          if (isAuthPayload) {
            setInstallsError(state.els, "Admin session expired. Please log in again.", "danger");
            promptAdminReauth();
          } else {
            setInstallsError(state.els, payloadMessage, "warning");
          }
          renderInstallsTable();
          return;
        }

        state.installs.items = Array.isArray(payload?.items) ? payload.items : [];
        state.installs.emptyMessage = "No installs found.";
        renderInstallsPaging(payload?.paging);
        renderInstallsTable();
      } catch (err) {
        state.installs.items = [];
        state.installs.emptyMessage = "No installs found.";
        renderInstallsPaging({
          offset: state.installs.offset,
          returned: 0,
          total: 0,
          has_more: false,
        });
        renderInstallsTable();

        const isAuthError = err?.isAuthError || err?.status === 401 || err?.status === 403;
        if (isAuthError) {
          setInstallsError(state.els, "Admin session expired. Please log in again.", "danger");
          promptAdminReauth();
        } else {
          setInstallsError(
            state.els,
            "Unable to load creator guild installs right now. Try Refresh.",
            "warning"
          );
        }
      } finally {
        state.installs.busy = false;
        setInstallsLoadingState(false);
      }
    }

    function goToPreviousInstallsPage() {
      const limit = clampLimit(state.installs.filters.limit);
      if (state.installs.offset <= 0) return;
      state.installs.offset = Math.max(0, state.installs.offset - limit);
      hydrateInstalls();
    }

    function goToNextInstallsPage() {
      if (!state.installs.paging?.hasMore) return;
      const limit = clampLimit(state.installs.filters.limit);
      state.installs.offset = Math.max(0, state.installs.offset + limit);
      hydrateInstalls();
    }

    function toggleInstallErrorRow(key) {
      if (!key) return;
      if (state.installs.expandedErrorKeys.has(key)) {
        state.installs.expandedErrorKeys.delete(key);
      } else {
        state.installs.expandedErrorKeys.add(key);
      }
      renderInstallsTable();
    }

    function init() {
      try {
        state.els = cacheElements();
        setInitialLoading();
        setStatusLoadingState(state.els, true);
        setInstallsLoadingState(true);

        addListener(state.els?.admin?.reverify, "click", () => {
          hydrateStatus({ reverify: true });
        });
        addListener(state.els?.public?.reverify, "click", () => {
          hydrateStatus({ reverify: true });
        });
        addListener(state.els?.admin?.install, "click", () => {
          openInstall("admin");
        });
        addListener(state.els?.public?.install, "click", () => {
          openInstall("public");
        });
        addListener(state.els?.installs?.refresh, "click", () => {
          hydrateInstalls({ resetOffset: true });
        });
        addListener(state.els?.installs?.prev, "click", () => {
          goToPreviousInstallsPage();
        });
        addListener(state.els?.installs?.next, "click", () => {
          goToNextInstallsPage();
        });
        addListener(state.els?.installs?.installedOnly, "change", () => {
          hydrateInstalls({ resetOffset: true });
        });
        addListener(state.els?.installs?.limit, "change", () => {
          hydrateInstalls({ resetOffset: true });
        });
        addListener(state.els?.installs?.guildFilter, "keydown", (event) => {
          if (event.key === "Enter") hydrateInstalls({ resetOffset: true });
        });
        addListener(state.els?.installs?.accountFilter, "keydown", (event) => {
          if (event.key === "Enter") hydrateInstalls({ resetOffset: true });
        });
        addListener(state.els?.installs?.body, "click", (event) => {
          const button = event.target?.closest?.("[data-error-toggle]");
          if (!button) return;
          toggleInstallErrorRow(button.getAttribute("data-error-toggle"));
        });

        hydrateStatus();
        hydrateInstalls();
      } catch (err) {
        const message = "Discord page failed to initialize. Refresh and try again.";
        const fallbackEls = state.els || cacheElements();
        setBanner(fallbackEls, message, "danger");
        setStatusIndicator(fallbackEls, "Discord bot status: Error", "idle");
        console.error("[DiscordView] init failed", err);
      }
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
      state.installs.busy = false;
      state.installs.items = [];
      state.installs.expandedErrorKeys.clear();
    }

    return { init, destroy };
  }

  const controller = createController();
  window.DiscordView = {
    init: controller.init,
    destroy: controller.destroy,
  };
})();

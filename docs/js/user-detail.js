(() => {
  "use strict";

  const state = {
    userCode: "",
    payload: null,
    loadToken: 0,
    boundRouteChange: null
  };

  const el = {
    root: null,
    banner: null,
    heading: null,
    subheading: null,
    generatedAt: null,
    statusPill: null,
    routeLabel: null,
    refresh: null,
    kpis: null,
    identity: null,
    auth: null,
    creatorPosture: null,
    management: null,
    platforms: null,
    triggersBody: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    if (value === undefined || value === null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resolveApiBase() {
    const base =
      window.StreamSuitesAdminAuth?.config?.baseUrl ||
      document.querySelector('meta[name="streamsuites-auth-base"]')?.getAttribute("content") ||
      "";
    return base ? String(base).replace(/\/+$/, "") : "";
  }

  function buildApiUrl(path) {
    const base = resolveApiBase();
    if (!base) return path;
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalized}`;
  }

  async function requestJson(path, options = {}) {
    const response = await fetch(buildApiUrl(path), {
      cache: "no-store",
      credentials: "include",
      timeoutMs: options.timeoutMs || 6500,
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (_err) {
      payload = null;
    }
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
    }
    return payload || {};
  }

  function formatTimestamp(value) {
    if (!value) return "-";
    if (typeof window.StreamSuitesState?.formatTimestamp === "function") {
      const formatted = window.StreamSuitesState.formatTimestamp(value);
      if (formatted) return formatted;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, {
      hour12: false,
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function renderBadge(label, tone = "") {
    const classes = ["ss-badge", tone].filter(Boolean).join(" ");
    return `<span class="${classes}">${escapeHtml(label)}</span>`;
  }

  function renderBooleanBadge(value, trueLabel, falseLabel, falseTone = "ss-badge-warning") {
    return value
      ? renderBadge(trueLabel, "ss-badge-success")
      : renderBadge(falseLabel, falseTone);
  }

  function setStatusPill(text, tone = "subtle") {
    if (!el.statusPill) return;
    el.statusPill.classList.remove("success", "subtle", "warning");
    el.statusPill.classList.add(tone);
    const dot = el.statusPill.querySelector(".status-dot");
    el.statusPill.textContent = text || "";
    if (dot) el.statusPill.prepend(dot);
  }

  function setBanner(message, variant = "danger") {
    if (!el.banner) return;
    const text = String(message || "").trim();
    if (!text) {
      el.banner.textContent = "";
      el.banner.className = "ss-alert hidden";
      return;
    }
    el.banner.textContent = text;
    el.banner.className = `ss-alert ss-alert-${variant}`;
  }

  function resolveCurrentRoute() {
    return window.StreamSuitesAdminRoutes?.resolveLocation?.() || null;
  }

  function resolveUserCodeFromRoute() {
    const route = resolveCurrentRoute();
    const routeUserCode = String(route?.params?.user_code || "").trim();
    if (routeUserCode) return routeUserCode;
    const params = new URLSearchParams(window.location.search || "");
    return String(params.get("user_code") || "").trim();
  }

  function summarizeTriggerContribution(trigger) {
    const applicability = trigger?.platform_applicability && typeof trigger.platform_applicability === "object"
      ? trigger.platform_applicability
      : {};
    const ready = [];
    const limited = [];
    Object.entries(applicability).forEach(([platform, entry]) => {
      if (entry?.trigger_execution_eligible && entry?.chat_capable) {
        ready.push(platform);
      } else {
        limited.push(platform);
      }
    });
    if (ready.length && !limited.length) return `Ready on ${ready.join(", ")}`;
    if (ready.length) return `Ready on ${ready.join(", ")}; limited on ${limited.join(", ")}`;
    if (limited.length) return `Limited on ${limited.join(", ")}`;
    return "No platform applicability";
  }

  function renderKeyValueGrid(items) {
    return `
      <div class="accounts-details-meta-grid">
        ${items.map((item) => `
          <div>
            <span class="label">${escapeHtml(item.label)}</span>
            <span class="value">${item.value}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderKpis(summary, account) {
    if (!el.kpis) return;
    const cards = [
      {
        label: "User code",
        value: account?.user_code || state.userCode || "-",
        tone: "is-neutral"
      },
      {
        label: "Creator posture",
        value: summary?.creator_capable ? "Creator-capable" : "Not creator-capable",
        tone: summary?.creator_capable ? "is-good" : "is-warn"
      },
      {
        label: "Linked platforms",
        value: `${Number(summary?.linked_platform_count || 0)}/${Number(summary?.total_platform_count || 0)}`,
        tone: "is-neutral"
      },
      {
        label: "Deployable",
        value: String(summary?.deployable_platform_count || 0),
        tone: summary?.deployable_platform_count ? "is-good" : "is-warn"
      },
      {
        label: "Foundation triggers",
        value: `${Number(summary?.enabled_foundational_trigger_count || 0)}/${Number(summary?.foundational_trigger_count || 0)}`,
        tone: summary?.foundational_trigger_ready ? "is-good" : "is-warn"
      },
      {
        label: "Account status",
        value: account?.account_status || "-",
        tone: account?.account_status === "active" ? "is-good" : "is-warn"
      }
    ];
    el.kpis.innerHTML = cards
      .map((card) => `
        <article class="creator-integrations-kpi-card ${escapeHtml(card.tone)}">
          <span class="label">${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
        </article>
      `)
      .join("");
  }

  function renderIdentity(account) {
    if (!el.identity) return;
    const publicProfile = account?.public_profile && typeof account.public_profile === "object" ? account.public_profile : {};
    const streamsuitesUrl = account?.streamsuites_profile_url || publicProfile.streamsuites_profile_url || "";
    const findMeHereUrl = account?.findmehere_profile_url || publicProfile.findmehere_profile_url || "";
    el.identity.innerHTML = `
      ${renderKeyValueGrid([
        { label: "Display name", value: escapeHtml(account?.display_name || "-") },
        { label: "Email", value: escapeHtml(account?.email || "-") },
        { label: "Internal account id", value: `<code>${escapeHtml(account?.id || "-")}</code>` },
        { label: "Role", value: renderBadge(account?.role || "unknown") },
        { label: "Tier", value: renderBadge(account?.tier || "unknown") },
        { label: "User code", value: `<code>${escapeHtml(account?.user_code || "-")}</code>` },
        { label: "Public slug", value: `<code>${escapeHtml(publicProfile?.public_slug || "-")}</code>` },
        { label: "Created", value: escapeHtml(formatTimestamp(account?.created_at)) },
        { label: "Last login", value: escapeHtml(formatTimestamp(account?.last_login_at)) },
        {
          label: "StreamSuites profile",
          value: streamsuitesUrl
            ? `<a class="ss-link" href="${escapeHtml(streamsuitesUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(streamsuitesUrl)}</a>`
            : '<span class="muted">No canonical URL</span>'
        },
        {
          label: "FindMeHere profile",
          value: findMeHereUrl
            ? `<a class="ss-link" href="${escapeHtml(findMeHereUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(findMeHereUrl)}</a>`
            : '<span class="muted">No canonical URL</span>'
        },
        {
          label: "Media",
          value: escapeHtml(
            [
              publicProfile?.avatar_url ? "avatar" : "",
              publicProfile?.cover_image_url ? "cover" : "",
              publicProfile?.background_image_url ? "background" : ""
            ].filter(Boolean).join(", ") || "No media saved"
          )
        }
      ])}
    `;
  }

  function renderAuthOverview(authOverview) {
    if (!el.auth) return;
    const providers = Array.isArray(authOverview?.providers) ? authOverview.providers : [];
    el.auth.innerHTML = `
      <div class="user-detail-pill-row">
        ${renderBooleanBadge(authOverview?.email_verified, "Email verified", "Email unverified")}
        ${renderBooleanBadge(authOverview?.password_set, "Password set", "No password set", "ss-badge-danger")}
        ${renderBadge(authOverview?.role || "unknown")}
        ${renderBadge(authOverview?.tier || "unknown")}
      </div>
      ${renderKeyValueGrid([
        { label: "Provider count", value: escapeHtml(String(authOverview?.provider_count || 0)) },
        { label: "Providers", value: escapeHtml(providers.length ? providers.join(", ") : "None linked") },
        { label: "Account status", value: renderBadge(authOverview?.account_status || "unknown") }
      ])}
    `;
  }

  function renderCreatorPosture(posture, summary) {
    if (!el.creatorPosture) return;
    el.creatorPosture.innerHTML = `
      <div class="user-detail-pill-row">
        ${renderBooleanBadge(posture?.creator_capable, "Creator-capable", "Not creator-capable", "ss-badge-danger")}
        ${renderBooleanBadge(posture?.viewer_only, "Viewer-only", "Not viewer-only")}
        ${renderBooleanBadge(posture?.streamsuites_profile_visible, "StreamSuites visible", "StreamSuites hidden")}
        ${renderBooleanBadge(posture?.findmehere_visible, "FindMeHere visible", "FindMeHere hidden")}
      </div>
      ${renderKeyValueGrid([
        { label: "Public surface type", value: escapeHtml(posture?.public_surface_account_type || "-") },
        { label: "Readiness", value: renderBadge(summary?.readiness_label || "Unknown", summary?.bot_deploy_eligible ? "ss-badge-success" : "ss-badge-warning") },
        { label: "Needs attention", value: renderBooleanBadge(summary?.needs_attention, "Yes", "No") },
        { label: "Limited platforms", value: escapeHtml(String(summary?.limited_platform_count || 0)) }
      ])}
    `;
  }

  function renderManagement(management, account) {
    if (!el.management) return;
    const routes = management?.routes && typeof management.routes === "object" ? management.routes : {};
    const accountId = String(account?.id || "").trim();
    el.management.innerHTML = `
      <div class="platform-actions">
        <a class="ss-btn ss-btn-secondary" href="/users" data-view="accounts">Accounts table</a>
        <a class="ss-btn ss-btn-secondary" href="${escapeHtml(routes.creator_integrations || "/profiles/integrations")}" data-view="creator-integrations">Creator integrations</a>
        <a class="ss-btn ss-btn-secondary" href="${escapeHtml(routes.creator_stats || "/profiles/stats")}" data-view="creator-stats">Creator stats</a>
      </div>
      <div class="user-detail-callout">
        <strong>Safe boundary</strong>
        <p class="muted">
          This page does not expose provider secrets or unsafe override powers. Supported actions stay within the current backend contract.
        </p>
      </div>
      ${renderKeyValueGrid([
        { label: "Secrets exposed", value: renderBooleanBadge(management?.secrets_exposed === true, "Yes", "No", "ss-badge-success") },
        { label: "Supported actions", value: escapeHtml(Array.isArray(management?.supported_actions) ? management.supported_actions.join(", ") : "None") },
        { label: "Account id", value: `<code>${escapeHtml(accountId || "-")}</code>` }
      ])}
    `;
  }

  function renderPlatformCards(integrations) {
    if (!el.platforms) return;
    const items = Array.isArray(integrations) ? integrations : [];
    el.platforms.innerHTML = items.length
      ? items.map((item) => {
          const deployment = item.deployment && typeof item.deployment === "object" ? item.deployment : {};
          const capabilities = item.capabilities && typeof item.capabilities === "object" ? item.capabilities : {};
          const reasons = Array.isArray(deployment.reasons) ? deployment.reasons : [];
          const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
          const safeMeta = [];
          if (item.connection_method) safeMeta.push(`Connection: ${item.connection_method}`);
          if (item.auth_mode) safeMeta.push(`Auth: ${item.auth_mode}`);
          if (item.channel_handle) safeMeta.push(`Handle: ${item.channel_handle}`);
          if (item.public_url) safeMeta.push(`URL: ${item.public_url}`);
          if (metadata.workspace_note) safeMeta.push(`Note: ${metadata.workspace_note}`);
          if (item.platform_key === "rumble") {
            safeMeta.push(item.secret_present ? `Credential: ${item.secret_mask || "Configured"}` : "Credential: not stored");
          }
          return `
            <article class="creator-integrations-platform-card">
              <div class="creator-integrations-platform-head">
                <h4>${escapeHtml(item.platform_key || "platform")}</h4>
                ${renderBadge(
                  deployment.can_deploy ? "Ready" : (item.status === "linked" ? "Linked but limited" : item.status || "Unknown"),
                  deployment.can_deploy ? "ss-badge-success" : (item.status === "linked" ? "ss-badge-warning" : "")
                )}
              </div>
              <div class="creator-integrations-platform-meta">
                <span>${renderBooleanBadge(item.status === "linked", "Linked", "Not linked")}</span>
                <span>${renderBooleanBadge(Boolean(capabilities.trigger_execution_eligible), "Trigger-capable", "Not trigger-capable")}</span>
                <span>${renderBooleanBadge(Boolean(item.provider_linked), "Provider linked", "Provider not linked")}</span>
              </div>
              <ul class="creator-integrations-platform-list">
                ${safeMeta.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}
                <li>Last checked: ${escapeHtml(formatTimestamp(item.last_checked_at))}</li>
                <li>Verified: ${escapeHtml(formatTimestamp(item.verified_at))}</li>
                <li>Checks enabled: ${escapeHtml(item.checks_enabled ? "Yes" : "No")}</li>
                <li>Config state: ${escapeHtml(item.config_state || "-")}</li>
              </ul>
              <p class="creator-integrations-platform-note">${escapeHtml(item.ui_message || "No admin-safe note available.")}</p>
              <div class="creator-integrations-platform-reasons">
                ${
                  reasons.length
                    ? reasons.map((reason) => `<span class="creator-integrations-reason-chip">${escapeHtml(reason)}</span>`).join("")
                    : '<span class="muted">No blocking reasons reported.</span>'
                }
              </div>
            </article>
          `;
        }).join("")
      : '<div class="muted">No platform integration rows were returned for this account.</div>';
  }

  function renderTriggers(triggers) {
    if (!el.triggersBody) return;
    const items = Array.isArray(triggers) ? triggers : [];
    if (!items.length) {
      el.triggersBody.innerHTML = `
        <tr>
          <td colspan="5" class="muted">No trigger registry rows returned for this account.</td>
        </tr>
      `;
      return;
    }
    el.triggersBody.innerHTML = items
      .map((trigger) => `
        <tr>
          <td>
            <strong>${escapeHtml(trigger.command_text || trigger.trigger_id || "-")}</strong>
            <div class="muted">${escapeHtml(trigger.trigger_id || "-")}</div>
          </td>
          <td>${escapeHtml(Array.isArray(trigger.scope?.platforms) ? trigger.scope.platforms.join(", ") : "-")}</td>
          <td>${trigger.enabled ? renderBadge("Enabled", "ss-badge-success") : renderBadge("Disabled", "ss-badge-warning")}</td>
          <td>${escapeHtml(summarizeTriggerContribution(trigger))}</td>
          <td class="align-right">
            <button
              type="button"
              class="ss-btn ss-btn-small ss-btn-secondary"
              data-user-detail-trigger="${escapeHtml(trigger.trigger_id || "")}"
              data-next-enabled="${trigger.enabled ? "false" : "true"}"
            >
              ${escapeHtml(trigger.enabled ? "Disable" : "Enable")}
            </button>
          </td>
        </tr>
      `)
      .join("");
  }

  function render(payload) {
    state.payload = payload && typeof payload === "object" ? payload : null;
    const account = state.payload?.account || {};
    const creatorIntegrations = state.payload?.creator_integrations && typeof state.payload.creator_integrations === "object"
      ? state.payload.creator_integrations
      : {};
    const summary = creatorIntegrations.summary || {};
    if (el.heading) {
      el.heading.textContent = account.display_name || account.user_code || state.userCode || "User detail";
    }
    if (el.subheading) {
      el.subheading.textContent = account.email
        ? `${account.email} · ${account.user_code || state.userCode || "unknown user code"}`
        : account.user_code || state.userCode || "Loading account context";
    }
    if (el.generatedAt) {
      el.generatedAt.textContent = formatTimestamp(state.payload?.generated_at);
    }
    if (el.routeLabel) {
      el.routeLabel.textContent = state.userCode ? `/users/${state.userCode}` : "No user_code route selected";
    }

    renderKpis(summary, account);
    renderIdentity(account);
    renderAuthOverview(state.payload?.auth_overview || {});
    renderCreatorPosture(state.payload?.creator_posture || {}, summary);
    renderManagement(state.payload?.management || {}, account);
    renderPlatformCards(creatorIntegrations.integrations || []);
    renderTriggers(creatorIntegrations.triggers || []);

    setStatusPill(
      summary?.bot_deploy_eligible ? "Deployable path present" : summary?.creator_capable ? "Needs readiness work" : "Creator posture blocked",
      summary?.bot_deploy_eligible ? "success" : "warning"
    );
    setBanner("");
  }

  function renderEmpty(message) {
    if (el.kpis) el.kpis.innerHTML = "";
    if (el.identity) el.identity.innerHTML = '<div class="muted">No account payload loaded.</div>';
    if (el.auth) el.auth.innerHTML = '<div class="muted">No auth payload loaded.</div>';
    if (el.creatorPosture) el.creatorPosture.innerHTML = '<div class="muted">No creator posture payload loaded.</div>';
    if (el.management) el.management.innerHTML = '<div class="muted">No supported actions loaded.</div>';
    if (el.platforms) el.platforms.innerHTML = '<div class="muted">No platform rows loaded.</div>';
    if (el.triggersBody) {
      el.triggersBody.innerHTML = `<tr><td colspan="5" class="muted">${escapeHtml(message || "No trigger rows loaded.")}</td></tr>`;
    }
  }

  async function loadUserDetail(userCode) {
    const normalizedUserCode = String(userCode || "").trim();
    if (!normalizedUserCode) {
      state.userCode = "";
      setStatusPill("Awaiting route", "subtle");
      renderEmpty("Select an account or open a /users/{user_code} route.");
      return;
    }
    const token = ++state.loadToken;
    state.userCode = normalizedUserCode;
    if (el.routeLabel) {
      el.routeLabel.textContent = `/users/${normalizedUserCode}`;
    }
    setStatusPill("Loading", "subtle");
    setBanner("");
    try {
      const payload = await requestJson(`/api/admin/users/${encodeURIComponent(normalizedUserCode)}`);
      if (token !== state.loadToken) return;
      render(payload);
    } catch (err) {
      if (token !== state.loadToken) return;
      setStatusPill("Load failed", "warning");
      setBanner(err?.message || "Unable to load user detail.");
      renderEmpty(err?.message || "Unable to load user detail.");
    }
  }

  async function updateTrigger(triggerId, enabled) {
    const accountId = String(state.payload?.account?.id || "").trim();
    if (!accountId || !triggerId) return;
    setBanner("");
    setStatusPill("Saving trigger", "subtle");
    try {
      await requestJson(`/api/admin/accounts/${encodeURIComponent(accountId)}/creator-triggers/${encodeURIComponent(triggerId)}`, {
        method: "PATCH",
        timeoutMs: 7000,
        body: JSON.stringify({ enabled })
      });
      await loadUserDetail(state.userCode);
      setStatusPill("Updated", "success");
    } catch (err) {
      setStatusPill("Trigger update failed", "warning");
      setBanner(err?.message || "Unable to update creator trigger.");
    }
  }

  function handleRouteChange() {
    const nextUserCode = resolveUserCodeFromRoute();
    if (!nextUserCode) {
      void loadUserDetail("");
      return;
    }
    if (nextUserCode !== state.userCode || !state.payload) {
      void loadUserDetail(nextUserCode);
    }
  }

  function handleTriggersClick(event) {
    const button = event.target.closest("[data-user-detail-trigger]");
    if (!(button instanceof HTMLButtonElement)) return;
    const triggerId = button.getAttribute("data-user-detail-trigger") || "";
    const nextEnabled = button.getAttribute("data-next-enabled") === "true";
    void updateTrigger(triggerId, nextEnabled);
  }

  function bindEvents() {
    el.refresh?.addEventListener("click", () => {
      void loadUserDetail(resolveUserCodeFromRoute());
    });
    el.triggersBody?.addEventListener("click", handleTriggersClick);
    state.boundRouteChange = () => {
      handleRouteChange();
    };
    window.addEventListener("streamsuites:routechange", state.boundRouteChange);
  }

  function unbindEvents() {
    el.triggersBody?.removeEventListener("click", handleTriggersClick);
    if (state.boundRouteChange) {
      window.removeEventListener("streamsuites:routechange", state.boundRouteChange);
    }
    state.boundRouteChange = null;
  }

  function init() {
    el.root = document.querySelector("[data-user-detail-root=\"true\"]");
    if (!(el.root instanceof HTMLElement)) return;
    el.banner = $("user-detail-banner");
    el.heading = document.querySelector("[data-user-detail-heading=\"true\"]");
    el.subheading = document.querySelector("[data-user-detail-subheading=\"true\"]");
    el.generatedAt = document.querySelector("[data-user-detail-generated-at=\"true\"]");
    el.statusPill = document.querySelector("[data-user-detail-status-pill=\"true\"]");
    el.routeLabel = document.querySelector("[data-user-detail-route-label=\"true\"]");
    el.refresh = $("user-detail-refresh");
    el.kpis = $("user-detail-kpis");
    el.identity = $("user-detail-identity");
    el.auth = $("user-detail-auth");
    el.creatorPosture = $("user-detail-creator-posture");
    el.management = $("user-detail-management");
    el.platforms = $("user-detail-platforms");
    el.triggersBody = $("user-detail-triggers-body");
    bindEvents();
    handleRouteChange();
  }

  function destroy() {
    unbindEvents();
    state.userCode = "";
    state.payload = null;
    state.loadToken += 1;
  }

  window.UserDetailView = {
    init,
    destroy
  };
})();

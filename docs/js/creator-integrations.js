/* ============================================================
   StreamSuites Dashboard - Creator Integrations (Admin)
   ============================================================ */

(() => {
  "use strict";

  const LIST_ENDPOINT = "/api/admin/creator-integrations";
  const PLATFORMS = ["youtube", "rumble", "twitch", "kick", "pilled"];
  const PLATFORM_ICON_MAP = Object.freeze({
    youtube: "/assets/icons/youtube.svg",
    rumble: "/assets/icons/rumble.svg",
    twitch: "/assets/icons/twitch.svg",
    kick: "/assets/icons/kick.svg",
    pilled: "/assets/icons/pilled.svg"
  });

  const state = {
    summaries: [],
    filtered: [],
    userCode: "",
    detail: null,
    listToken: 0,
    detailToken: 0,
    boundRouteChange: null
  };

  const el = {
    search: null,
    readinessFilter: null,
    refreshList: null,
    refreshDetail: null,
    status: null,
    banner: null,
    count: null,
    body: null,
    empty: null,
    heading: null,
    generatedAt: null,
    openUser: null,
    detailEmpty: null,
    detailSections: null,
    summaryCards: null,
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
    const payload = await readJsonSafe(response);
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
    }
    return payload || {};
  }

  async function readJsonSafe(response) {
    try {
      return await response.json();
    } catch (_err) {
      return null;
    }
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

  function canManageCreatorIntegrations() {
    return (
      window.StreamSuitesDashboardPermissions?.has?.(
        "admin.dashboard.manage.creator_integrations"
      ) === true
    );
  }

  function canOpenUserDetail() {
    return window.StreamSuitesDashboardPermissions?.hasAny?.([
      "admin.dashboard.manage.accounts",
      "admin.dashboard.manage.creator_integrations"
    ]) === true;
  }

  function renderBooleanBadge(value, trueLabel, falseLabel) {
    return value
      ? renderBadge(trueLabel, "ss-badge-success")
      : renderBadge(falseLabel, "ss-badge-warning");
  }

  function readinessTone(label) {
    const normalized = String(label || "").trim().toLowerCase();
    if (normalized === "ready") return "ss-badge-success";
    if (normalized === "linked but limited" || normalized === "needs attention") return "ss-badge-warning";
    return "ss-badge-danger";
  }

  function managedSessionForIntegration(item) {
    return item?.managed_session && typeof item.managed_session === "object"
      ? item.managed_session
      : null;
  }

  function managedSessionTransportError(session) {
    return session?.last_transport_error && typeof session.last_transport_error === "object"
      ? session.last_transport_error
      : null;
  }

  function managedSessionStateLabel(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return "Not created";
    return normalized.replace(/_/g, " ");
  }

  function managedSessionStateTone(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (["attached", "listening", "running"].includes(normalized)) return "ss-badge-success";
    if (["desired", "starting", "attaching"].includes(normalized)) return "ss-badge-warning";
    if (["blocked", "auth_failed", "target_unresolved", "transport_error", "stale"].includes(normalized)) {
      return "ss-badge-danger";
    }
    return "";
  }

  function managedSessionAuthState(session) {
    const error = managedSessionTransportError(session);
    const code = String(error?.code || session?.blocking_reason || "").trim().toLowerCase();
    if (code === "auth_material_insufficient") {
      return {
        label: "Stream key only",
        tone: "ss-badge-warning",
        detail: "Only a Rumble stream key is stored. Cookie-based chat auth is still missing."
      };
    }
    if (code === "auth_material_missing") {
      return {
        label: "Chat auth missing",
        tone: "ss-badge-warning",
        detail: "No chat-capable Rumble auth material is stored."
      };
    }
    if (code === "auth_material_invalid") {
      return {
        label: "Chat auth invalid",
        tone: "ss-badge-danger",
        detail: "Stored Rumble cookie auth exists, but runtime rejected it as invalid."
      };
    }
    if (code === "auth_material_unrecognized") {
      return {
        label: "Chat auth unrecognized",
        tone: "ss-badge-warning",
        detail: "Stored Rumble auth material is not usable for chat transport."
      };
    }
    if (session?.transport_capabilities?.can_listen) {
      return {
        label: "Chat auth ready",
        tone: "ss-badge-success",
        detail: "Runtime reports chat-capable auth for managed transport."
      };
    }
    return {
      label: session ? "Auth pending" : "Not evaluated",
      tone: "",
      detail: session?.status_reason || "No managed transport auth posture exported yet."
    };
  }

  function managedSessionBlockingDetail(session) {
    const error = managedSessionTransportError(session);
    const code = String(error?.code || session?.blocking_reason || "").trim().toLowerCase();
    if (code === "manual_override_active") {
      return "Manual Rumble control is active, so the managed session is suppressed.";
    }
    if (code === "target_unresolved") {
      return "Runtime has not resolved a usable watch/chat target for this live session yet.";
    }
    if (code === "transport_error") {
      return error?.message || session?.error || "Managed transport reported an attachment/listening error.";
    }
    if (code.startsWith("auth_material_")) {
      return managedSessionAuthState(session).detail;
    }
    return error?.message || session?.status_reason || "No managed-session blocking reason reported.";
  }

  function summarizeScope(platforms) {
    if (!Array.isArray(platforms) || !platforms.length) return "No platforms";
    return platforms.map((item) => String(item || "").trim()).filter(Boolean).join(", ");
  }

  function summarizeTriggerContribution(trigger) {
    const applicability = trigger?.platform_applicability && typeof trigger.platform_applicability === "object"
      ? trigger.platform_applicability
      : {};
    const ready = [];
    const blocked = [];
    Object.entries(applicability).forEach(([platform, entry]) => {
      if (entry && entry.trigger_execution_eligible && entry.chat_capable) {
        ready.push(platform);
      } else {
        blocked.push(platform);
      }
    });
    if (ready.length && !blocked.length) return `Supports ${ready.join(", ")}`;
    if (ready.length) return `Ready on ${ready.join(", ")}; limited on ${blocked.join(", ")}`;
    if (blocked.length) return `Blocked on ${blocked.join(", ")}`;
    return "No platform applicability";
  }

  function setStatus(message) {
    if (el.status) el.status.textContent = message || "";
  }

  function setBanner(message, variant = "danger") {
    if (!el.banner) return;
    const text = String(message || "").trim();
    if (!text) {
      el.banner.textContent = "";
      el.banner.classList.add("hidden");
      el.banner.classList.remove("ss-alert-danger", "ss-alert-warning", "ss-alert-success");
      return;
    }
    el.banner.textContent = text;
    el.banner.classList.remove("hidden");
    el.banner.classList.remove("ss-alert-danger", "ss-alert-warning", "ss-alert-success");
    el.banner.classList.add(`ss-alert-${variant}`);
  }

  function resolveCurrentRoute() {
    return window.StreamSuitesAdminRoutes?.resolveLocation?.() || null;
  }

  function parseUserCodeFromRoute() {
    const route = resolveCurrentRoute();
    if (route?.mode === "path") {
      const params = new URLSearchParams(window.location.search || "");
      return String(route?.params?.user_code || params.get("user_code") || "").trim();
    }
    const hash = String(window.location.hash || "").replace(/^#/, "");
    const queryIndex = hash.indexOf("?");
    if (queryIndex === -1) return String(route?.params?.user_code || "").trim();
    const params = new URLSearchParams(hash.slice(queryIndex + 1));
    return String(route?.params?.user_code || params.get("user_code") || "").trim();
  }

  function consumePendingUserCode() {
    const pending = window.StreamSuitesCreatorIntegrationsNav;
    const userCode = String(pending?.userCode || "").trim();
    if (pending && typeof pending === "object") {
      pending.accountId = "";
      pending.userCode = "";
      pending.from = "";
    }
    return userCode;
  }

  function openUserPage(userCode) {
    const normalized = String(userCode || "").trim();
    if (!normalized) return;
    if (window.StreamSuitesAdminRoutes?.navigateToView) {
      window.StreamSuitesAdminRoutes.navigateToView("user-detail", {
        params: { user_code: normalized }
      });
      return;
    }
    window.location.hash = `#users/${encodeURIComponent(normalized)}`;
  }

  function navigateToUser(userCode) {
    const normalized = String(userCode || "").trim();
    if (!normalized) return;
    state.userCode = normalized;
    if (window.StreamSuitesAdminRoutes?.navigateToView) {
      window.StreamSuitesAdminRoutes.navigateToView("creator-integrations", {
        params: { user_code: normalized }
      });
      return;
    }
    window.location.hash = `#creator-integrations?user_code=${encodeURIComponent(normalized)}`;
  }

  function passesReadinessFilter(item, filterValue) {
    const normalized = String(filterValue || "").trim().toLowerCase();
    if (!normalized) return true;
    const label = String(item?.readiness_label || "").trim().toLowerCase();
    if (normalized === "ready") return label === "ready";
    if (normalized === "linked") return label === "linked but limited";
    if (normalized === "attention") return Boolean(item?.needs_attention);
    if (normalized === "not-deployable") return !item?.bot_deploy_eligible;
    return true;
  }

  function applyFilters() {
    const query = String(el.search?.value || "").trim().toLowerCase();
    const readiness = String(el.readinessFilter?.value || "").trim();
    state.filtered = state.summaries.filter((item) => {
      const haystack = [
        item.account_id,
        item.user_code,
        item.display_name,
        item.email,
        item.readiness_label
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      if (query && !haystack.includes(query)) return false;
      return passesReadinessFilter(item, readiness);
    });
    renderSummaryTable();
  }

  function renderSummaryTable() {
    if (!el.body) return;
    el.body.innerHTML = "";
    const items = state.filtered;
    if (el.count) {
      el.count.textContent = String(items.length);
    }
    if (!items.length) {
      el.empty?.classList.remove("hidden");
      return;
    }
    el.empty?.classList.add("hidden");
    items.forEach((item) => {
      const selected = state.userCode && item.user_code === state.userCode;
      const row = document.createElement("tr");
      if (selected) row.classList.add("accounts-row-selected");
      row.setAttribute("data-account-id", item.account_id || "");
      row.innerHTML = `
        <td>
          <div class="creator-integrations-creator-cell">
            <strong>${escapeHtml(item.display_name || item.user_code || item.account_id || "-")}</strong>
            <span class="muted">${escapeHtml(item.user_code || item.account_id || "-")}</span>
          </div>
        </td>
        <td>${renderBooleanBadge(item.creator_capable, "Yes", "No")}</td>
        <td>${escapeHtml(`${Number(item.linked_platform_count || 0)}/${Number(item.total_platform_count || 0)}`)}</td>
        <td>${escapeHtml(String(item.deployable_platform_count || 0))}</td>
        <td>${renderBooleanBadge(item.foundational_trigger_ready, "Ready", "Missing")}</td>
        <td>${renderBadge(item.readiness_label || "Unknown", readinessTone(item.readiness_label))}</td>
          <td class="align-right">
          ${
            !canOpenUserDetail()
              ? '<span class="muted">Restricted</span>'
              : `<button type="button" class="ss-btn ss-btn-small ss-btn-primary" data-open-user="${escapeHtml(
                  item.user_code || ""
                )}">Open user page</button>`
          }
        </td>
      `;
      el.body.appendChild(row);
    });
  }

  function renderSummaryCards(summary, account) {
    if (!el.summaryCards) return;
    const cards = [
      {
        label: "Creator posture",
        value: summary?.creator_capable ? "Creator-capable" : "Not creator-capable",
        tone: summary?.creator_capable ? "is-good" : "is-warn"
      },
      {
        label: "Readiness",
        value: summary?.readiness_label || "Unknown",
        tone: summary?.bot_deploy_eligible ? "is-good" : "is-warn"
      },
      {
        label: "Linked platforms",
        value: `${Number(summary?.linked_platform_count || 0)}/${Number(summary?.total_platform_count || 0)}`,
        tone: "is-neutral"
      },
      {
        label: "Deployable platforms",
        value: String(summary?.deployable_platform_count || 0),
        tone: summary?.deployable_platform_count ? "is-good" : "is-warn"
      },
      {
        label: "Foundation triggers",
        value: `${Number(summary?.enabled_foundational_trigger_count || 0)}/${Number(summary?.foundational_trigger_count || 0)}`,
        tone: summary?.foundational_trigger_ready ? "is-good" : "is-warn"
      },
      {
        label: "Account",
        value: account?.display_name || account?.user_code || summary?.account_id || "-",
        tone: "is-neutral"
      }
    ];
    el.summaryCards.innerHTML = cards
      .map(
        (card) => `
          <article class="creator-integrations-kpi-card ${escapeHtml(card.tone)}">
            <span class="label">${escapeHtml(card.label)}</span>
            <strong>${escapeHtml(card.value)}</strong>
          </article>
        `
      )
      .join("");
  }

  function renderPlatformCards(integrations) {
    if (!el.platforms) return;
    const byPlatform = new Map(
      (Array.isArray(integrations) ? integrations : []).map((item) => [String(item.platform_key || "").trim(), item])
    );
    el.platforms.innerHTML = PLATFORMS.map((platform) => {
      const item = byPlatform.get(platform) || { platform_key: platform, status: "unknown", capabilities: {}, deployment: {} };
      const deployment = item.deployment && typeof item.deployment === "object" ? item.deployment : {};
      const capabilities = item.capabilities && typeof item.capabilities === "object" ? item.capabilities : {};
      const reasons = Array.isArray(deployment.reasons) ? deployment.reasons : [];
      const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
      const managedSession = managedSessionForIntegration(item);
      const transportError = managedSessionTransportError(managedSession);
      const authState = managedSessionAuthState(managedSession);
      const safeMeta = [];
      if (item.connection_method) safeMeta.push(`Connection: ${item.connection_method}`);
      if (item.auth_mode) safeMeta.push(`Auth: ${item.auth_mode}`);
      if (item.channel_handle) safeMeta.push(`Handle: ${item.channel_handle}`);
      if (item.public_url) safeMeta.push(`URL: ${item.public_url}`);
      if (platform === "rumble") {
        safeMeta.push(item.secret_present ? `Credential: ${item.secret_mask || "Configured"}` : "Credential: not stored");
        safeMeta.push(`Auto-deploy: ${item.bot_auto_deploy_enabled ? "enabled" : "disabled"}`);
      }
      if (metadata.future_secret_ref) safeMeta.push("Secret reference present");
      const iconPath = PLATFORM_ICON_MAP[platform] || "";
      const runtimeLinks = [];
      const resolvedTarget = managedSession?.resolved_target && typeof managedSession.resolved_target === "object"
        ? managedSession.resolved_target
        : {};
      if (resolvedTarget.watch_url) {
        runtimeLinks.push(
          `<a class="creator-integrations-platform-link" href="${escapeHtml(resolvedTarget.watch_url)}" target="_blank" rel="noreferrer">Open watch target</a>`
        );
      }
      if (resolvedTarget.channel_url) {
        runtimeLinks.push(
          `<a class="creator-integrations-platform-link" href="${escapeHtml(resolvedTarget.channel_url)}" target="_blank" rel="noreferrer">Open channel</a>`
        );
      }
      const rumbleRuntimeBlock = platform === "rumble"
        ? `
          <div class="creator-integrations-platform-runtime">
            <div class="creator-integrations-platform-meta">
              ${renderBadge(item.bot_auto_deploy_enabled ? "Auto-deploy enabled" : "Auto-deploy disabled", item.bot_auto_deploy_enabled ? "ss-badge-success" : "")}
              ${renderBadge(`Session ${managedSessionStateLabel(managedSession?.session_kind || "auto")}`, managedSession ? "ss-badge-warning" : "")}
              ${renderBadge(`Lifecycle ${managedSessionStateLabel(managedSession?.lifecycle_state)}`, managedSessionStateTone(managedSession?.lifecycle_state))}
              ${renderBadge(`Transport ${managedSessionStateLabel(managedSession?.transport_status)}`, managedSessionStateTone(managedSession?.transport_status))}
              ${renderBadge(authState.label, authState.tone)}
            </div>
            <ul class="creator-integrations-platform-list">
              <li>Managed session id: ${escapeHtml(managedSession?.session_id || "Not created")}</li>
              <li>Managed/manual: ${escapeHtml(managedSession ? "Managed auto session" : "No managed session")}</li>
              <li>Desired: ${escapeHtml(managedSession?.desired ? "Yes" : "No")}</li>
              <li>Eligibility: ${escapeHtml(managedSession ? (managedSession.eligible ? "Eligible" : "Blocked") : (item.bot_auto_deploy?.eligible ? "Eligible" : "Blocked"))}</li>
              <li>Last attach attempt: ${escapeHtml(formatTimestamp(managedSession?.last_attach_attempt_at))}</li>
              <li>Last attach success: ${escapeHtml(formatTimestamp(managedSession?.last_attach_success_at))}</li>
              <li>Last heartbeat: ${escapeHtml(formatTimestamp(managedSession?.last_transport_heartbeat_at || managedSession?.last_heartbeat_at))}</li>
              <li>Transport error: ${escapeHtml(transportError?.code || "None")}</li>
              <li>Target watch URL: ${escapeHtml(resolvedTarget.watch_url || item.bot_auto_deploy?.resolved_watch_url || "-")}</li>
            </ul>
            <p class="creator-integrations-platform-note">${escapeHtml(managedSessionBlockingDetail(managedSession))}</p>
            ${runtimeLinks.length ? `<div class="creator-integrations-platform-reasons">${runtimeLinks.join("")}</div>` : ""}
          </div>
        `
        : "";
      return `
        <article class="creator-integrations-platform-card">
          <div class="creator-integrations-platform-head">
            <h4 class="creator-integrations-platform-title">
              ${iconPath ? `<img class="creator-integrations-platform-title-icon" src="${escapeHtml(iconPath)}" alt="" aria-hidden="true" />` : ""}
              <span>${escapeHtml(platform)}</span>
            </h4>
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
          ${rumbleRuntimeBlock}
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
    }).join("");
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
      .map((trigger) => {
        const scopePlatforms = summarizeScope(trigger.scope?.platforms);
        const toggleLabel = trigger.enabled ? "Disable" : "Enable";
        return `
          <tr>
            <td>
              <strong>${escapeHtml(trigger.command_text || trigger.trigger_id || "-")}</strong>
              <div class="muted">${escapeHtml(trigger.trigger_id || "-")}</div>
            </td>
            <td>${escapeHtml(scopePlatforms)}</td>
            <td>${trigger.enabled ? renderBadge("Enabled", "ss-badge-success") : renderBadge("Disabled", "ss-badge-warning")}</td>
            <td>${escapeHtml(summarizeTriggerContribution(trigger))}</td>
            <td class="align-right">
              ${
                !canManageCreatorIntegrations()
                  ? '<span class="muted">Restricted</span>'
                  : `<button
                      type="button"
                      class="ss-btn ss-btn-small ss-btn-secondary"
                      data-trigger-toggle="${escapeHtml(trigger.trigger_id || "")}"
                      data-next-enabled="${trigger.enabled ? "false" : "true"}"
                    >
                      ${escapeHtml(toggleLabel)}
                    </button>`
              }
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderDetail(payload) {
    state.detail = payload && typeof payload === "object" ? payload : null;
    const summary = state.detail?.creator_integrations?.summary || {};
    const account = state.detail?.account || {};
    if (el.heading) {
      el.heading.textContent = account.display_name || account.user_code || "Creator detail";
    }
    if (el.generatedAt) {
      el.generatedAt.textContent = formatTimestamp(state.detail?.generated_at);
    }
    if (el.refreshDetail) {
      el.refreshDetail.disabled = !state.userCode;
    }
    if (el.openUser) {
      el.openUser.disabled = !state.userCode || !canOpenUserDetail();
    }
    if (!state.detail) {
      el.detailEmpty?.classList.remove("hidden");
      el.detailSections?.classList.add("hidden");
      return;
    }
    el.detailEmpty?.classList.add("hidden");
    el.detailSections?.classList.remove("hidden");
    renderSummaryCards(summary, account);
    renderPlatformCards(state.detail?.creator_integrations?.integrations);
    renderTriggers(state.detail?.creator_integrations?.triggers);
  }

  async function fetchList() {
    const token = ++state.listToken;
    setStatus("Loading creator integration summaries...");
    setBanner("");
    try {
      const payload = await requestJson(LIST_ENDPOINT);
      if (token !== state.listToken) return;
      state.summaries = Array.isArray(payload?.items) ? payload.items : [];
      applyFilters();
      setStatus(`Loaded ${state.summaries.length} creator integration summaries.`);
      if (!state.userCode && state.filtered[0]?.user_code) {
        navigateToUser(state.filtered[0].user_code);
      } else if (state.userCode) {
        const stillVisible = state.summaries.some((item) => item.user_code === state.userCode);
        if (!stillVisible) {
          renderDetail(null);
        }
      }
    } catch (err) {
      state.summaries = [];
      applyFilters();
      renderDetail(null);
      setStatus("Failed to load creator integration summaries.");
      setBanner(String(err?.message || "Unable to load creator integration summary."));
    }
  }

  async function fetchDetail(userCode) {
    if (!canManageCreatorIntegrations()) {
      renderDetail(null);
      setBanner("This account can review integration summaries but cannot open admin detail without the creator-integrations management permission.");
      setStatus("Detail view restricted.");
      return;
    }
    const normalizedUserCode = String(userCode || "").trim();
    if (!normalizedUserCode) {
      renderDetail(null);
      return;
    }
    const token = ++state.detailToken;
    state.userCode = normalizedUserCode;
    setStatus(`Loading creator detail for ${normalizedUserCode}...`);
    try {
      const payload = await requestJson(`/api/admin/users/${encodeURIComponent(normalizedUserCode)}`);
      if (token !== state.detailToken) return;
      renderDetail(payload);
      applyFilters();
      setStatus(`Loaded creator integration detail for ${normalizedUserCode}.`);
    } catch (err) {
      renderDetail(null);
      setStatus("Failed to load creator integration detail.");
      setBanner(String(err?.message || "Unable to load creator integration detail."));
    }
  }

  async function updateTrigger(triggerId, enabled) {
    if (!canManageCreatorIntegrations()) {
      setBanner("Creator trigger controls require the creator-integrations management permission.");
      setStatus("Trigger controls restricted.");
      return;
    }
    const accountId = String(state.detail?.account?.id || "").trim();
    if (!accountId || !triggerId) return;
    setStatus(`Updating trigger ${triggerId}...`);
    try {
      await requestJson(`/api/admin/accounts/${encodeURIComponent(accountId)}/creator-triggers/${encodeURIComponent(triggerId)}`, {
        method: "PATCH",
        timeoutMs: 7000,
        body: JSON.stringify({ enabled })
      });
      await fetchDetail(state.userCode);
      await fetchList();
      setStatus(`Updated trigger ${triggerId}.`);
    } catch (err) {
      setBanner(String(err?.message || "Unable to update creator trigger."));
      setStatus("Trigger update failed.");
    }
  }

  function handleRouteSelection() {
    const route = resolveCurrentRoute();
    if (route?.view !== "creator-integrations") return;
    const userCode = parseUserCodeFromRoute() || consumePendingUserCode();
    if (!userCode) return;
    if (userCode !== state.userCode || !state.detail) {
      void fetchDetail(userCode);
    }
  }

  function bindEvents() {
    el.search?.addEventListener("input", applyFilters);
    el.readinessFilter?.addEventListener("change", applyFilters);
    el.refreshList?.addEventListener("click", () => {
      void fetchList();
    });
    el.refreshDetail?.addEventListener("click", () => {
      void fetchDetail(state.userCode);
    });
    el.openUser?.addEventListener("click", () => {
      openUserPage(state.userCode);
    });
    el.body?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-open-user]");
      if (!(button instanceof HTMLButtonElement)) return;
      const userCode = button.getAttribute("data-open-user") || "";
      navigateToUser(userCode);
      void fetchDetail(userCode);
    });
    el.triggersBody?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-trigger-toggle]");
      if (!(button instanceof HTMLButtonElement)) return;
      const triggerId = button.getAttribute("data-trigger-toggle") || "";
      const nextEnabled = button.getAttribute("data-next-enabled") === "true";
      void updateTrigger(triggerId, nextEnabled);
    });
    state.boundRouteChange = () => {
      handleRouteSelection();
    };
    window.addEventListener("streamsuites:routechange", state.boundRouteChange);
  }

  function unbindEvents() {
    if (state.boundRouteChange) {
      window.removeEventListener("streamsuites:routechange", state.boundRouteChange);
    }
    state.boundRouteChange = null;
  }

  function init() {
    el.search = $("creator-integrations-search");
    el.readinessFilter = $("creator-integrations-readiness-filter");
    el.refreshList = $("creator-integrations-refresh-list");
    el.refreshDetail = $("creator-integrations-refresh-detail");
    el.status = $("creator-integrations-status");
    el.banner = $("creator-integrations-banner");
    el.count = $("creator-integrations-count");
    el.body = $("creator-integrations-body");
    el.empty = $("creator-integrations-empty");
    el.heading = $("creator-integrations-detail-heading");
    el.generatedAt = $("creator-integrations-generated-at");
    el.openUser = $("creator-integrations-open-user");
    el.detailEmpty = $("creator-integrations-detail-empty");
    el.detailSections = $("creator-integrations-detail-sections");
    el.summaryCards = $("creator-integrations-summary-cards");
    el.platforms = $("creator-integrations-platforms");
    el.triggersBody = $("creator-integrations-triggers-body");

    bindEvents();
    void fetchList();
    handleRouteSelection();
  }

  function destroy() {
    unbindEvents();
    state.summaries = [];
    state.filtered = [];
    state.userCode = "";
    state.detail = null;
  }

  window.CreatorIntegrationsView = {
    init,
    destroy
  };
})();

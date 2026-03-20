/* ============================================================
   StreamSuites Dashboard - Creator Integrations (Admin)
   ============================================================ */

(() => {
  "use strict";

  const LIST_ENDPOINT = "/api/admin/creator-integrations";
  const PLATFORMS = ["youtube", "rumble", "twitch", "kick", "pilled"];

  const state = {
    summaries: [],
    filtered: [],
    accountId: "",
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

  function parseAccountIdFromRoute() {
    const route = resolveCurrentRoute();
    if (route?.mode === "path") {
      const params = new URLSearchParams(window.location.search || "");
      return String(params.get("account_id") || "").trim();
    }
    const hash = String(window.location.hash || "").replace(/^#/, "");
    const queryIndex = hash.indexOf("?");
    if (queryIndex === -1) return "";
    const params = new URLSearchParams(hash.slice(queryIndex + 1));
    return String(params.get("account_id") || "").trim();
  }

  function consumePendingAccountId() {
    const pending = window.StreamSuitesCreatorIntegrationsNav;
    const accountId = String(pending?.accountId || "").trim();
    if (pending && typeof pending === "object") {
      pending.accountId = "";
      pending.from = "";
    }
    return accountId;
  }

  function navigateToAccount(accountId) {
    const normalizedId = String(accountId || "").trim();
    if (!normalizedId) return;
    state.accountId = normalizedId;
    if (window.StreamSuitesAdminRoutes?.navigateToView) {
      window.StreamSuitesAdminRoutes.navigateToView("creator-integrations", {
        params: { account_id: normalizedId }
      });
      return;
    }
    window.location.hash = `#creator-integrations?account_id=${encodeURIComponent(normalizedId)}`;
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
      const selected = state.accountId && item.account_id === state.accountId;
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
          <button type="button" class="ss-btn ss-btn-small ss-btn-secondary" data-open-account="${escapeHtml(
            item.account_id || ""
          )}">
            Inspect
          </button>
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
      const safeMeta = [];
      if (item.connection_method) safeMeta.push(`Connection: ${item.connection_method}`);
      if (item.auth_mode) safeMeta.push(`Auth: ${item.auth_mode}`);
      if (item.channel_handle) safeMeta.push(`Handle: ${item.channel_handle}`);
      if (item.public_url) safeMeta.push(`URL: ${item.public_url}`);
      if (platform === "rumble") {
        safeMeta.push(item.secret_present ? `Credential: ${item.secret_mask || "Configured"}` : "Credential: not stored");
      }
      if (metadata.future_secret_ref) safeMeta.push("Secret reference present");
      return `
        <article class="creator-integrations-platform-card">
          <div class="creator-integrations-platform-head">
            <h4>${escapeHtml(platform)}</h4>
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
              <button
                type="button"
                class="ss-btn ss-btn-small ss-btn-secondary"
                data-trigger-toggle="${escapeHtml(trigger.trigger_id || "")}"
                data-next-enabled="${trigger.enabled ? "false" : "true"}"
              >
                ${escapeHtml(toggleLabel)}
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderDetail(payload) {
    state.detail = payload && typeof payload === "object" ? payload : null;
    const summary = state.detail?.summary || {};
    const account = state.detail?.account || {};
    if (el.heading) {
      el.heading.textContent = summary.display_name || account.display_name || account.user_code || "Creator detail";
    }
    if (el.generatedAt) {
      el.generatedAt.textContent = formatTimestamp(state.detail?.generated_at);
    }
    if (el.refreshDetail) {
      el.refreshDetail.disabled = !state.accountId;
    }
    if (!state.detail) {
      el.detailEmpty?.classList.remove("hidden");
      el.detailSections?.classList.add("hidden");
      return;
    }
    el.detailEmpty?.classList.add("hidden");
    el.detailSections?.classList.remove("hidden");
    renderSummaryCards(summary, account);
    renderPlatformCards(state.detail.integrations);
    renderTriggers(state.detail.triggers);
  }

  async function fetchList() {
    const token = ++state.listToken;
    setStatus("Loading creator integration summaries...");
    setBanner("");
    try {
      const response = await fetch(buildApiUrl(LIST_ENDPOINT), {
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      const payload = await readJsonSafe(response);
      if (token !== state.listToken) return;
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
      }
      state.summaries = Array.isArray(payload?.items) ? payload.items : [];
      applyFilters();
      setStatus(`Loaded ${state.summaries.length} creator integration summaries.`);
      if (!state.accountId && state.filtered[0]?.account_id) {
        navigateToAccount(state.filtered[0].account_id);
      } else if (state.accountId) {
        const stillVisible = state.summaries.some((item) => item.account_id === state.accountId);
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

  async function fetchDetail(accountId) {
    const normalizedId = String(accountId || "").trim();
    if (!normalizedId) {
      renderDetail(null);
      return;
    }
    const token = ++state.detailToken;
    state.accountId = normalizedId;
    setStatus(`Loading creator detail for ${normalizedId}...`);
    try {
      const response = await fetch(buildApiUrl(`/api/admin/accounts/${encodeURIComponent(normalizedId)}/creator-integrations`), {
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      const payload = await readJsonSafe(response);
      if (token !== state.detailToken) return;
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
      }
      renderDetail(payload);
      applyFilters();
      setStatus(`Loaded creator integration detail for ${normalizedId}.`);
    } catch (err) {
      renderDetail(null);
      setStatus("Failed to load creator integration detail.");
      setBanner(String(err?.message || "Unable to load creator integration detail."));
    }
  }

  async function updateTrigger(triggerId, enabled) {
    if (!state.accountId || !triggerId) return;
    setStatus(`Updating trigger ${triggerId}...`);
    try {
      const response = await fetch(
        buildApiUrl(`/api/admin/accounts/${encodeURIComponent(state.accountId)}/creator-triggers/${encodeURIComponent(triggerId)}`),
        {
          method: "PATCH",
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ enabled })
        }
      );
      const payload = await readJsonSafe(response);
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
      }
      await fetchDetail(state.accountId);
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
    const accountId = parseAccountIdFromRoute() || consumePendingAccountId();
    if (!accountId) return;
    if (accountId !== state.accountId || !state.detail) {
      void fetchDetail(accountId);
    }
  }

  function bindEvents() {
    el.search?.addEventListener("input", applyFilters);
    el.readinessFilter?.addEventListener("change", applyFilters);
    el.refreshList?.addEventListener("click", () => {
      void fetchList();
    });
    el.refreshDetail?.addEventListener("click", () => {
      void fetchDetail(state.accountId);
    });
    el.body?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-open-account]");
      if (!(button instanceof HTMLButtonElement)) return;
      const accountId = button.getAttribute("data-open-account") || "";
      navigateToAccount(accountId);
      void fetchDetail(accountId);
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
    state.accountId = "";
    state.detail = null;
  }

  window.CreatorIntegrationsView = {
    init,
    destroy
  };
})();

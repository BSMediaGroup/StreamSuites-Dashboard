(() => {
  "use strict";

  const REFRESH_INTERVAL_MS = 20000;
  const PLATFORM_ORDER = ["discord", "kick", "pilled", "rumble", "twitch", "twitter", "youtube"];
  const MAX_ACTIVITY_ITEMS = 8;
  const MAX_AUTH_EVENTS = 8;
  const MAX_AUDIT_ITEMS = 6;
  const MAX_WARNING_ITEMS = 8;
  const ANALYTICS_WINDOW = "24h";
  const API_USAGE_WINDOW = "5m";
  const SNAPSHOT_ALERT_LIMIT = 6;
  const USERS_EXPORT_PATH = "runtime/exports/admin/users/users.json";
  const AUDIT_EXPORT_PATH = "runtime/exports/admin/audit/audit.json";

  const VIEW_STATE = {
    destroyed: false,
    wired: false,
    refreshHandle: null,
    loadToken: 0,
    state: createInitialState()
  };

  const el = {};

  function createInitialState() {
    return {
      sourceMode: "unknown",
      runtimeRaw: null,
      runtimeSnapshot: null,
      runtimeVersion: null,
      exportManifest: null,
      liveStatus: null,
      analyticsSnapshot: null,
      apiUsage: null,
      localCreators: [],
      localPlatforms: null,
      dashboardState: null,
      authControls: null,
      sessionIdentity: null,
      alertSettings: null,
      alertHistory: null,
      usersSnapshot: null,
      adminActivity: null,
      telemetrySnapshot: null,
      telemetryErrors: null,
      telemetryAuthEvents: null,
      auditSnapshot: null,
      discordStatus: null,
      lastRefreshAt: null
    };
  }

  function init() {
    destroy();
    VIEW_STATE.destroyed = false;
    VIEW_STATE.wired = false;
    VIEW_STATE.loadToken = 0;
    VIEW_STATE.state = createInitialState();
    cacheElements();
    wireEvents();
    renderLoadingState();
    void loadOverview({ forceRefresh: false });
    VIEW_STATE.refreshHandle = window.setInterval(() => {
      void loadOverview({ forceRefresh: true, quiet: true });
    }, REFRESH_INTERVAL_MS);
  }

  function destroy() {
    VIEW_STATE.destroyed = true;
    VIEW_STATE.wired = false;
    VIEW_STATE.state = createInitialState();
    if (VIEW_STATE.refreshHandle) {
      window.clearInterval(VIEW_STATE.refreshHandle);
      VIEW_STATE.refreshHandle = null;
    }
  }

  function cacheElements() {
    el.pageRoot = document.getElementById("overview-page-root");
    el.modeChip = document.getElementById("overview-mode-chip");
    el.status = document.getElementById("overview-status");
    el.banner = document.getElementById("overview-banner");
    el.greeting = document.getElementById("overview-greeting");
    el.summaryGrid = document.getElementById("overview-summary-grid");
    el.snapshotGrid = document.getElementById("overview-snapshot-grid");
    el.metaList = document.getElementById("overview-meta-list");
    el.postureGrid = document.getElementById("overview-posture-grid");
    el.platformGrid = document.getElementById("overview-platform-grid");
    el.accountSummary = document.getElementById("overview-account-summary");
    el.accountDetailGrid = document.getElementById("overview-account-detail-grid");
    el.signalsGrid = document.getElementById("overview-signals-grid");
    el.publicationGrid = document.getElementById("overview-publication-grid");
    el.scaffoldGrid = document.getElementById("overview-scaffold-grid");
    el.openAlerts = document.getElementById("overview-open-alerts");
    el.openAccounts = document.getElementById("overview-open-accounts");
    el.openPermissions = document.getElementById("overview-open-permissions");
    el.openSettings = document.getElementById("overview-open-settings");
  }

  function wireEvents() {
    if (VIEW_STATE.wired) return;
    el.openAlerts?.addEventListener("click", () => navigateToView("alerts"));
    el.openAccounts?.addEventListener("click", () => navigateToView("accounts"));
    el.openPermissions?.addEventListener("click", () => navigateToView("permissions"));
    el.openSettings?.addEventListener("click", () => navigateToView("settings"));
    VIEW_STATE.wired = true;
  }

  function navigateToView(viewName) {
    window.StreamSuitesAdminRoutes?.navigateToView?.(viewName);
  }

  async function loadOverview(options = {}) {
    const token = ++VIEW_STATE.loadToken;
    setStatus(options.forceRefresh ? "Refreshing overview…" : "Hydrating overview…");
    if (!options.quiet) {
      setBanner("", "");
    }

    const results = await Promise.allSettled([
      loadRuntimeSources(options),
      window.Versioning?.loadVersion?.(),
      loadExportManifest(),
      loadLiveStatus(options),
      loadAnalyticsSnapshot(options),
      loadApiUsageOverview(options),
      loadLocalCreators(),
      loadLocalPlatforms(),
      loadDashboardState(options),
      loadAuthControls(options),
      loadSessionIdentity(options),
      loadAlertSettings(options),
      loadAlertHistory(options),
      loadUsersSnapshot(options),
      loadAdminActivity(options),
      window.Telemetry?.loadSnapshot?.(options.forceRefresh === true),
      window.Telemetry?.loadErrors?.({ forceReload: options.forceRefresh === true }),
      loadAuthEvents(options),
      loadAuditSnapshot(options),
      loadDiscordStatus()
    ]);

    if (VIEW_STATE.destroyed || token !== VIEW_STATE.loadToken) return;

    const [
      runtimeResult,
      versionResult,
      manifestResult,
      liveStatusResult,
      analyticsSnapshotResult,
      apiUsageResult,
      creatorsResult,
      platformsResult,
      dashboardStateResult,
      authControlsResult,
      sessionIdentityResult,
      alertSettingsResult,
      alertHistoryResult,
      usersSnapshotResult,
      adminActivityResult,
      telemetrySnapshotResult,
      telemetryErrorsResult,
      telemetryAuthEventsResult,
      auditSnapshotResult,
      discordStatusResult
    ] = results;

    const runtimePayload = getSettledValue(runtimeResult);
    VIEW_STATE.state.sourceMode = runtimePayload?.sourceMode || "unavailable";
    VIEW_STATE.state.runtimeRaw = runtimePayload?.runtimeRaw || null;
    VIEW_STATE.state.runtimeSnapshot = runtimePayload?.runtimeSnapshot || null;
    VIEW_STATE.state.runtimeVersion = getSettledValue(versionResult) || null;
    VIEW_STATE.state.exportManifest = getSettledValue(manifestResult) || null;
    VIEW_STATE.state.liveStatus = getSettledValue(liveStatusResult) || null;
    VIEW_STATE.state.analyticsSnapshot = getSettledValue(analyticsSnapshotResult) || null;
    VIEW_STATE.state.apiUsage = getSettledValue(apiUsageResult) || null;
    VIEW_STATE.state.localCreators = getSettledValue(creatorsResult) || [];
    VIEW_STATE.state.localPlatforms = getSettledValue(platformsResult) || null;
    VIEW_STATE.state.dashboardState = getSettledValue(dashboardStateResult) || null;
    VIEW_STATE.state.authControls = getSettledValue(authControlsResult) || null;
    VIEW_STATE.state.sessionIdentity = getSettledValue(sessionIdentityResult) || null;
    VIEW_STATE.state.alertSettings = getSettledValue(alertSettingsResult) || null;
    VIEW_STATE.state.alertHistory = getSettledValue(alertHistoryResult) || null;
    VIEW_STATE.state.usersSnapshot = getSettledValue(usersSnapshotResult) || null;
    VIEW_STATE.state.adminActivity = getSettledValue(adminActivityResult) || null;
    VIEW_STATE.state.telemetrySnapshot = getSettledValue(telemetrySnapshotResult) || null;
    VIEW_STATE.state.telemetryErrors = getSettledValue(telemetryErrorsResult) || null;
    VIEW_STATE.state.telemetryAuthEvents = getSettledValue(telemetryAuthEventsResult) || null;
    VIEW_STATE.state.auditSnapshot = getSettledValue(auditSnapshotResult) || null;
    VIEW_STATE.state.discordStatus = getSettledValue(discordStatusResult) || null;
    VIEW_STATE.state.lastRefreshAt = new Date().toISOString();

    render();

    const firstError = results.map(getSettledError).find(Boolean);
    if (firstError) {
      setStatus("Overview partially loaded");
      if (!options.quiet) {
        setBanner(firstError, "warning");
      }
      return;
    }

    setStatus("Overview synced");
  }

  async function loadRuntimeSources(options = {}) {
    const runtimeState = window.App?.state?.runtimeSnapshot;
    let runtimeRaw = runtimeState?.getSnapshot?.() || null;

    if (options.forceRefresh === true && runtimeState?.fetchOnce) {
      try {
        await runtimeState.fetchOnce();
        runtimeRaw = runtimeState?.getSnapshot?.() || runtimeRaw;
      } catch (err) {
        console.warn("[Overview] Runtime refresh failed", err);
      }
    }

    if (!runtimeRaw) {
      runtimeRaw = await window.StreamSuitesState?.loadStateJson?.("runtime_snapshot.json", {
        forceReload: options.forceRefresh === true,
        loaderReason: "Hydrating overview runtime posture..."
      });
    }

    const runtimeSnapshot =
      window.StreamSuitesState?.normalizeRuntimeSnapshot?.(runtimeRaw) || null;

    let sourceMode = "unavailable";
    if (runtimeRaw && runtimeState?.getSnapshot?.()) {
      sourceMode = "connected";
    } else if (runtimeRaw) {
      sourceMode = "published";
    }

    return { runtimeRaw, runtimeSnapshot, sourceMode };
  }

  async function loadExportManifest() {
    const runtimeUrl = window.Versioning?.resolveRuntimeUrl?.("meta.json");
    if (!runtimeUrl) return null;
    const response = await fetch(runtimeUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Export manifest unavailable (${response.status})`);
    }
    return response.json();
  }

  async function loadLiveStatus(options = {}) {
    return (
      (await window.StreamSuitesState?.loadStateJson?.("live_status.json", {
        forceReload: options.forceRefresh === true,
        loaderReason: "Hydrating overview live-status posture..."
      })) || null
    );
  }

  async function loadAnalyticsSnapshot(options = {}) {
    try {
      const payload = await window.StreamSuitesApi?.getAdminAnalytics?.(ANALYTICS_WINDOW, {
        forceRefresh: options.forceRefresh === true,
        ttlMs: 8000,
        timeoutMs: 3500
      });
      return payload?.data && typeof payload.data === "object" ? payload.data : payload || null;
    } catch (err) {
      console.warn("[Overview] Analytics snapshot unavailable", err);
      return null;
    }
  }

  async function loadApiUsageOverview(options = {}) {
    if (typeof window.StreamSuitesApi?.apiFetch !== "function") {
      return null;
    }
    try {
      return (
        (await window.StreamSuitesApi.apiFetch(
          `/api/admin/api-usage?window=${encodeURIComponent(API_USAGE_WINDOW)}`,
          {
            cacheTtlMs: 5000,
            forceRefresh: options.forceRefresh === true,
            timeoutMs: 3500
          }
        )) || null
      );
    } catch (err) {
      console.warn("[Overview] API usage snapshot unavailable", err);
      return null;
    }
  }

  async function loadLocalCreators() {
    try {
      const creators = await window.ConfigState?.loadCreators?.();
      return Array.isArray(creators) ? creators : [];
    } catch (err) {
      console.warn("[Overview] Local creators unavailable", err);
      return [];
    }
  }

  async function loadLocalPlatforms() {
    try {
      return (await window.ConfigState?.loadPlatforms?.()) || null;
    } catch (err) {
      console.warn("[Overview] Local platform draft unavailable", err);
      return null;
    }
  }

  async function loadDashboardState(options = {}) {
    try {
      return (
        (await window.ConfigState?.loadDashboardState?.({
          forceReload: options.forceRefresh === true
        })) || null
      );
    } catch (err) {
      console.warn("[Overview] Dashboard state unavailable", err);
      return null;
    }
  }

  function resolveAuthApiBase() {
    const base =
      window.StreamSuitesAdminAuth?.config?.baseUrl ||
      document.querySelector('meta[name="streamsuites-auth-base"]')?.getAttribute("content") ||
      "";
    return String(base || "").trim().replace(/\/+$/, "");
  }

  function resolveSessionEndpoint() {
    return (
      window.StreamSuitesAdminAuth?.config?.endpoints?.session ||
      document.querySelector('meta[name="streamsuites-auth-session"]')?.getAttribute("content") ||
      ""
    );
  }

  function buildAuthApiUrl(path) {
    const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;
    const base = resolveAuthApiBase();
    return base ? `${base}${normalizedPath}` : normalizedPath;
  }

  async function getJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: "include",
      cache: options.forceRefresh ? "no-store" : "default",
      headers: options.headers || undefined
    });

    if (response.status === 401 || response.status === 403) {
      return { __authLocked: true };
    }
    if (!response.ok) {
      throw new Error(`${options.label || "Request"} failed (${response.status})`);
    }
    return response.json();
  }

  async function loadAuthControls(options = {}) {
    try {
      return await getJson(buildAuthApiUrl("/admin/auth/controls"), {
        forceRefresh: options.forceRefresh === true,
        label: "Auth controls"
      });
    } catch (err) {
      console.warn("[Overview] Auth controls unavailable", err);
      return null;
    }
  }

  async function loadSessionIdentity(options = {}) {
    const endpoint = resolveSessionEndpoint();
    if (!endpoint) return null;
    try {
      const payload = await getJson(endpoint, {
        forceRefresh: options.forceRefresh === true,
        label: "Admin session"
      });
      if (payload?.__authLocked) return payload;
      const user = payload?.user || payload?.session?.user || payload?.session || {};
      return {
        email: coerceText(user.email),
        displayName: coerceText(user.display_name || user.displayName || user.name),
        role: coerceText(user.role),
        tier: coerceText(user.tier),
        authenticated:
          payload?.authenticated === true ||
          payload?.session?.authenticated === true ||
          payload?.session?.isAuthenticated === true
      };
    } catch (err) {
      console.warn("[Overview] Session identity unavailable", err);
      return null;
    }
  }

  async function loadAlertSettings(options = {}) {
    try {
      return (
        (await window.StreamSuitesApi?.getAdminAlertSettings?.({
          forceRefresh: options.forceRefresh === true
        })) || null
      );
    } catch (err) {
      console.warn("[Overview] Alert settings unavailable", err);
      return null;
    }
  }

  async function loadAlertHistory(options = {}) {
    try {
      return (
        (await window.StreamSuitesApi?.getAdminAlertHistory?.(
          { limit: SNAPSHOT_ALERT_LIMIT },
          {
            forceRefresh: options.forceRefresh === true,
            ttlMs: 5000,
            timeoutMs: 3500
          }
        )) || null
      );
    } catch (err) {
      console.warn("[Overview] Alert history unavailable", err);
      return null;
    }
  }

  async function loadUsersSnapshot(options = {}) {
    const apiBase = resolveAuthApiBase();
    if (apiBase) {
      try {
        const payload = await getJson(buildAuthApiUrl("/admin/accounts"), {
          forceRefresh: options.forceRefresh === true,
          label: "Accounts snapshot"
        });
        if (!payload?.__authLocked) {
          const users = extractUsers(payload);
          if (users.length) {
            return {
              source: "api",
              exported_at: payload?.exported_at || payload?.generated_at || null,
              users
            };
          }
        }
      } catch (err) {
        console.warn("[Overview] Accounts API snapshot unavailable", err);
      }
    }
    return loadJsonRelative(USERS_EXPORT_PATH, {
      forceRefresh: options.forceRefresh === true,
      label: "Users export"
    });
  }

  async function loadAuditSnapshot(options = {}) {
    const apiBase = resolveAuthApiBase();
    if (apiBase) {
      try {
        const payload = await getJson(buildAuthApiUrl("/admin/audit"), {
          forceRefresh: options.forceRefresh === true,
          label: "Audit export"
        });
        if (!payload?.__authLocked) {
          const audit = extractAuditEntries(payload);
          if (audit.length) {
            return {
              source: "api",
              exported_at: payload?.exported_at || payload?.generated_at || null,
              audit
            };
          }
        }
      } catch (err) {
        console.warn("[Overview] Audit API unavailable", err);
      }
    }
    return loadJsonRelative(AUDIT_EXPORT_PATH, {
      forceRefresh: options.forceRefresh === true,
      label: "Audit export"
    });
  }

  async function loadJsonRelative(relativePath, options = {}) {
    const url = new URL(relativePath, document.baseURI);
    const response = await fetch(url, {
      cache: options.forceRefresh ? "no-store" : "default",
      credentials: "same-origin"
    });
    if (!response.ok) {
      throw new Error(`${options.label || relativePath} unavailable (${response.status})`);
    }
    return response.json();
  }

  function extractUsers(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.users)) return payload.users;
    if (Array.isArray(payload.items)) return payload.items;
    return [];
  }

  function extractAuditEntries(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.audit)) return payload.audit;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.events)) return payload.events;
    return [];
  }

  function extractItems(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.events)) return payload.events;
    if (Array.isArray(payload.data?.items)) return payload.data.items;
    return [];
  }

  async function loadAdminActivity(options = {}) {
    try {
      return (
        (await window.StreamSuitesState?.loadAdminActivity?.({
          forceReload: options.forceRefresh === true
        })) || null
      );
    } catch (err) {
      console.warn("[Overview] Admin activity unavailable", err);
      return null;
    }
  }

  async function loadAuthEvents(options = {}) {
    try {
      return (
        (await window.Telemetry?.loadAuthEvents?.({
          forceReload: options.forceRefresh === true,
          limit: MAX_AUTH_EVENTS
        })) || null
      );
    } catch (err) {
      console.warn("[Overview] Auth events unavailable", err);
      return null;
    }
  }

  async function loadDiscordStatus() {
    if (typeof window.StreamSuitesApi?.apiFetch !== "function") {
      return null;
    }
    try {
      const payload = await window.StreamSuitesApi.apiFetch("/api/admin/discord/bot/status", {
        cacheTtlMs: 0,
        forceRefresh: true,
        timeoutMs: 10000
      });
      return payload || null;
    } catch (err) {
      console.warn("[Overview] Discord status unavailable", err);
      return null;
    }
  }

  function renderLoadingState() {
    const loading = '<div class="ss-overview-empty">Loading overview…</div>';
    [
      el.summaryGrid,
      el.snapshotGrid,
      el.metaList,
      el.postureGrid,
      el.platformGrid,
      el.accountSummary,
      el.accountDetailGrid,
      el.signalsGrid,
      el.publicationGrid,
      el.scaffoldGrid
    ].forEach((node) => {
      if (!node) return;
      if (node.tagName === "DL") {
        node.innerHTML = `<div class="ss-overview-meta-row"><dt>Status</dt><dd>Loading overview…</dd></div>`;
      } else {
        node.innerHTML = loading;
      }
    });
  }

  function render() {
    renderHeader();
    renderMeta();
    renderSummary();
    renderSnapshotSection();
    renderOperationalPosture();
    renderPlatforms();
    renderAccounts();
    renderSignals();
    renderPublication();
    renderScaffolds();
  }

  function renderHeader() {
    const mode = VIEW_STATE.state.sourceMode;
    const text =
      mode === "connected"
        ? "Connected runtime"
        : mode === "published"
          ? "Published exports"
          : "Runtime unavailable";

    if (el.modeChip) {
      el.modeChip.textContent = text;
      el.modeChip.classList.toggle("ss-chip-success", mode === "connected");
      el.modeChip.classList.toggle("ss-chip-warning", mode !== "connected");
      el.modeChip.classList.toggle("ss-chip-muted", mode === "unknown");
    }

    if (el.greeting) {
      el.greeting.textContent = `Welcome, ${getPreferredOperatorName()}`;
    }
  }

  function renderMeta() {
    if (!el.metaList) return;
    const runtimeRaw = VIEW_STATE.state.runtimeRaw || {};
    const dashboardState = VIEW_STATE.state.dashboardState || {};
    const session = VIEW_STATE.state.sessionIdentity;
    const access = window.StreamSuitesDashboardPermissions?.getAccess?.() || {};

    el.metaList.innerHTML = [
      detailRow("Runtime snapshot", formatTimestamp(runtimeRaw.generated_at || runtimeRaw.heartbeat) || "Unavailable"),
      detailRow("Dashboard draft load", formatTimestamp(dashboardState.last_loaded_at) || "No local draft load"),
      detailRow("Dashboard draft export", formatTimestamp(dashboardState.last_export_at) || "Not exported"),
      detailRow("Current session", describeSession(session, access)),
      detailRow("Permission level", coerceText(access.level, "Unknown"))
    ].join("");
  }

  function renderSummary() {
    if (!el.summaryGrid) return;
    const runtimeVersion = VIEW_STATE.state.runtimeVersion;
    const attentionItems = buildAttentionItems();
    const access = window.StreamSuitesDashboardPermissions?.getAccess?.() || {};

    el.summaryGrid.innerHTML = [
      buildSummaryCard(
        "Runtime source",
        VIEW_STATE.state.sourceMode === "connected"
          ? "Live runtime"
          : VIEW_STATE.state.sourceMode === "published"
            ? "Published exports"
            : "Unavailable",
        VIEW_STATE.state.sourceMode === "connected"
          ? "This shell is reading current runtime state, not just mirrored exports."
          : VIEW_STATE.state.sourceMode === "published"
            ? "Read-only posture is coming from exported snapshots."
            : "No authoritative runtime snapshot was available during this pass."
      ),
      buildSummaryCard(
        "Version and build",
        formatVersion(runtimeVersion),
        `Last version export ${formatTimestamp(runtimeVersion?.generated_at) || "unknown"}.`
      ),
      buildSummaryCard(
        "Operator access",
        access?.allowed ? "Authorized" : "Restricted",
        access?.allowed
          ? `${coerceText(access.level, "unknown")} session with current dashboard grants applied.`
          : "Current session can see the shell but is not fully authorized for every operator surface."
      ),
      buildSummaryCard(
        "Attention items",
        String(attentionItems.length),
        attentionItems.length
          ? attentionItems.slice(0, 2).map((item) => item.label).join(" • ")
          : "No active warning contract is currently reporting a problem."
      )
    ].join("");
  }

  function renderSnapshotSection() {
    if (!el.snapshotGrid) return;

    const analytics = VIEW_STATE.state.analyticsSnapshot;
    const latestAlert = getLatestAlertEntry(VIEW_STATE.state.alertHistory);
    const apiUsage = VIEW_STATE.state.apiUsage;

    el.snapshotGrid.innerHTML = [
      buildAnalyticsSnapshotCard(analytics),
      buildLatestAlertSnapshotCard(latestAlert),
      buildApiUsageSnapshotCard(apiUsage)
    ].join("");
  }

  function buildAnalyticsSnapshotCard(analytics) {
    const totals = analytics?.totals || {};
    const footprint = summarizeAnalyticsFootprint(analytics);
    const generatedAt = formatTimestamp(analytics?.generated_at) || "Unavailable";

    return `
      <article class="ss-overview-detail-card ss-overview-snapshot-card is-analytics">
        <div class="ss-overview-card-head">
          <div>
            <span class="ss-overview-kicker">Analytics snapshot</span>
            <h3>Reach and geographic footprint</h3>
          </div>
          ${badgeSpan(footprint.windowLabel, "info")}
        </div>
        <div class="ss-overview-inline-metrics">
          ${buildInlineMetric("Sessions", formatCount(totals.sessions))}
          ${buildInlineMetric("Requests", formatCount(totals.requests))}
          ${buildInlineMetric("Nations", formatCount(footprint.countryCount))}
          ${buildInlineMetric("Cities", formatCount(footprint.cityCount))}
        </div>
        <dl class="ss-overview-detail-list">
          ${detailRow("Most active region", footprint.topRegionLabel)}
          ${detailRow("Region-detail rows", formatCount(footprint.regionCount))}
          ${detailRow("Top surface", footprint.topSurface)}
          ${detailRow("Generated", generatedAt)}
        </dl>
        <p class="ss-overview-card-note muted">The footprint summary stays grounded in the same analytics contract that powers the dedicated reporting surface.</p>
      </article>
    `;
  }

  function buildLatestAlertSnapshotCard(entry) {
    if (!entry) {
      return `
        <article class="ss-overview-detail-card ss-overview-snapshot-card is-alert">
          <div class="ss-overview-card-head">
            <div>
              <span class="ss-overview-kicker">Latest system alert</span>
              <h3>Recent alert activity</h3>
            </div>
            ${badgeSpan("Unavailable", "muted")}
          </div>
          ${buildEmptyFeed("No recent alert history was available from the current alerting contract.")}
        </article>
      `;
    }

    const severityText = coerceText(entry.severity, "info");
    const severityTone = getAlertSeverityTone(severityText);
    const statusText = getAlertHistoryStatus(entry);
    const statusTone = getAlertStatusTone(entry, statusText);
    const destinations = formatList(entry.destinations_targeted);
    const locationLabel = summarizeAlertLocation(entry);

    return `
      <article class="ss-overview-detail-card ss-overview-snapshot-card is-alert">
        <div class="ss-overview-card-head">
          <div>
            <span class="ss-overview-kicker">Latest system alert</span>
            <h3>${escapeHtml(coerceText(entry.title || entry.event_type, "Alert activity"))}</h3>
          </div>
          <div class="ss-overview-chip-row">
            ${badgeSpan(labelize(severityText), severityTone)}
            ${badgeSpan(statusText, statusTone)}
          </div>
        </div>
        <p class="muted">${escapeHtml(coerceText(entry.message, "Recent alert delivery activity is available, but this entry did not publish a message body."))}</p>
        <dl class="ss-overview-detail-list">
          ${detailRow("Event type", labelize(entry.event_type || "unknown"))}
          ${detailRow("Triggered", formatTimestamp(entry.triggered_at || entry.created_at) || "Unavailable")}
          ${detailRow("Destinations", destinations)}
          ${detailRow("Location", locationLabel)}
        </dl>
        <p class="ss-overview-card-note muted">This card is sourced from the existing alert delivery history rather than a dashboard-local placeholder feed.</p>
      </article>
    `;
  }

  function buildApiUsageSnapshotCard(bundle) {
    const liveSummary = getApiUsageLiveSummary(bundle);
    const endpoints = sanitizeApiUsageEndpoints(bundle?.endpoints);
    const topEndpoint = endpoints[0] || null;
    const degradedCount = countBy(
      endpoints,
      (row) => row.status === "degraded" || row.status === "unhealthy"
    );
    const postureTone = degradedCount > 0 || Number(liveSummary.errorRate) >= 0.01
      ? Number(liveSummary.errorRate) >= 0.05
        ? "danger"
        : "warning"
      : "success";
    const postureLabel =
      postureTone === "danger"
        ? "Needs review"
        : postureTone === "warning"
          ? "Watch"
          : "Healthy";

    return `
      <article class="ss-overview-detail-card ss-overview-snapshot-card is-api">
        <div class="ss-overview-card-head">
          <div>
            <span class="ss-overview-kicker">API usage overview</span>
            <h3>Runtime request health</h3>
          </div>
          <div class="ss-overview-chip-row">
            ${badgeSpan(liveSummary.windowLabel, "info")}
            ${badgeSpan(postureLabel, postureTone)}
          </div>
        </div>
        <div class="ss-overview-inline-metrics">
          ${buildInlineMetric("RPM", liveSummary.rpmText)}
          ${buildInlineMetric("Error rate", liveSummary.errorRateText)}
          ${buildInlineMetric("Degraded endpoints", formatCount(degradedCount))}
          ${buildInlineMetric("Top endpoint hits", formatCount(topEndpoint?.hits))}
        </div>
        <dl class="ss-overview-detail-list">
          ${detailRow("Top endpoint", topEndpoint ? topEndpoint.endpoint : "Unavailable")}
          ${detailRow("Top endpoint health", topEndpoint ? labelize(topEndpoint.status) : "Unknown")}
          ${detailRow("Generated", liveSummary.generatedAt)}
          ${detailRow("Auth/tier sections", summarizeApiSupplementSections(bundle))}
        </dl>
        <p class="ss-overview-card-note muted">The overview keeps API posture concise and defers detailed endpoint analysis to the dedicated API Usage surface.</p>
      </article>
    `;
  }

  function renderOperationalPosture() {
    if (!el.postureGrid) return;
    const runtimeRaw = VIEW_STATE.state.runtimeRaw || {};
    const runtimeSnapshot = VIEW_STATE.state.runtimeSnapshot || {};
    const authControls = VIEW_STATE.state.authControls;
    const alertSettings = unwrapAlertSettings(VIEW_STATE.state.alertSettings);
    const manifest = VIEW_STATE.state.exportManifest || {};
    const exportsList = Array.isArray(manifest.exports) ? manifest.exports : [];
    const restartIntent = runtimeSnapshot.restartIntent;
    const liveStatusProviders = Array.isArray(VIEW_STATE.state.liveStatus?.providers)
      ? VIEW_STATE.state.liveStatus.providers
      : [];

    el.postureGrid.innerHTML = [
      buildDetailCard(
        "Runtime posture",
        "Execution and publication",
        [
          detailRow("Project", coerceText(runtimeRaw.runtime?.project, "StreamSuites Runtime")),
          detailRow("Version", coerceText(runtimeRaw.runtime?.version, coerceText(VIEW_STATE.state.runtimeVersion?.version, "Unavailable"))),
          detailRow("Build", coerceText(runtimeRaw.runtime?.build, coerceText(VIEW_STATE.state.runtimeVersion?.build, "Unavailable"))),
          detailRow("Generated", formatTimestamp(runtimeRaw.generated_at || runtimeRaw.heartbeat) || "Unavailable"),
          detailRow("Published exports", exportsList.length ? `${exportsList.length} files` : "Manifest unavailable")
        ].join(""),
        VIEW_STATE.state.sourceMode === "connected"
          ? "Runtime is directly connected to the shell."
          : VIEW_STATE.state.sourceMode === "published"
            ? "The shell is operating from exported state only."
            : "No authoritative runtime payload was available.",
        { span: "wide" }
      ),
      buildDetailCard(
        "Access posture",
        "Auth and policy",
        renderAuthRows(authControls),
        authControls?.__authLocked
          ? "Live Auth controls are locked behind an authenticated admin session."
          : "These flags are sourced from the Auth API rather than local draft state.",
        { span: "wide" }
      ),
      buildDetailCard(
        "Alerts posture",
        "Backend delivery defaults",
        renderAlertRows(alertSettings),
        alertSettings
          ? "The dedicated Alerts workspace owns actual editing and delivery policy changes."
          : "No authoritative alert settings payload was available.",
        { span: "wide" }
      ),
      buildDetailCard(
        "Restart boundary",
        "Queued change application",
        renderRestartRows(restartIntent),
        restartIntent?.required
          ? "Runtime is reporting staged changes that still need an apply/restart boundary."
          : "No authoritative restart-intent payload is reporting pending change application.",
        { span: "wide" }
      ),
      buildDetailCard(
        "Local authoring context",
        "Dashboard drafts and creator config",
        renderLocalConfigRows(),
        "These counts reflect dashboard-local drafts and creator configuration, not direct runtime mutation.",
        { span: "wide" }
      ),
      buildDetailCard(
        "Live-status subsystem",
        "Provider export cadence",
        [
          detailRow("Providers", formatCount(liveStatusProviders.length)),
          detailRow("Priority order", formatList(VIEW_STATE.state.liveStatus?.provider_priority)),
          detailRow(
            "Refresh errors",
            formatCount(liveStatusProviders.filter((provider) => coerceText(provider.last_error)).length)
          ),
          detailRow(
            "Latest provider refresh",
            formatTimestamp(
              liveStatusProviders
                .map((provider) => provider.last_refresh_completed_at || provider.last_refresh_started_at)
                .filter(Boolean)
                .sort()
                .pop()
            ) || "Unavailable"
          )
        ].join(""),
        "Provider error and cadence reporting stays read-only on this page.",
        { span: "wide" }
      )
    ].join("");
  }

  function renderPlatforms() {
    if (!el.platformGrid) return;
    const platforms = getRuntimePlatforms();
    if (!platforms.length) {
      el.platformGrid.innerHTML = '<div class="ss-overview-empty">No platform runtime posture was published.</div>';
      return;
    }

    const providerMap = new Map(
      (Array.isArray(VIEW_STATE.state.liveStatus?.providers) ? VIEW_STATE.state.liveStatus.providers : []).map((provider) => [
        String(provider.provider || "").toLowerCase(),
        provider
      ])
    );
    const liveCreators = Array.isArray(VIEW_STATE.state.liveStatus?.creators)
      ? VIEW_STATE.state.liveStatus.creators
      : [];

    el.platformGrid.innerHTML = platforms
      .map((platform) => {
        const key = String(platform.platform || platform.name || "").toLowerCase();
        const provider = providerMap.get(key);
        const creatorStatuses = liveCreators
          .flatMap((creator) => (Array.isArray(creator.statuses) ? creator.statuses : []))
          .filter((status) => String(status.provider || "").toLowerCase() === key);
        const staleCount = creatorStatuses.filter((status) => status.stale === true).length;
        const errorCount = creatorStatuses.filter((status) => coerceText(status.error)).length;
        const configSummary = describeLocalPlatformConfig(key);
        const statusTone = getPlatformTone(platform);

        return `
          <article class="ss-overview-platform-card" data-tone="${escapeHtml(statusTone)}">
            <div class="ss-overview-card-head">
              <div>
                <span class="ss-overview-kicker">Platform</span>
                <h3 class="ss-overview-platform-title">
                  <img
                    class="ss-overview-platform-icon"
                    src="${escapeHtml(getPlatformIconPath(platform.platform || platform.name))}"
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  <span>${escapeHtml(labelize(platform.platform || platform.name || "Unknown"))}</span>
                </h3>
              </div>
              ${badgeSpan(coerceText(platform.status, "unknown"), statusTone)}
            </div>
            <dl class="ss-overview-detail-list">
              ${detailFlagChipRow("Enabled", platform.enabled)}
              ${detailFlagChipRow("Telemetry", platform.telemetry_enabled ?? platform.telemetryEnabled)}
              ${detailFlagChipRow("Replay support", platform.replay_supported)}
              ${detailFlagChipRow("Overlay support", platform.overlay_supported)}
              ${detailRow("Draft config", configSummary)}
              ${detailRow("Last heartbeat", formatTimestamp(platform.last_heartbeat || platform.heartbeat || platform.lastUpdate) || "Never")}
              ${detailRow("Provider cadence", provider?.cadence_seconds ? `${provider.cadence_seconds}s` : "Not exported")}
              ${detailRow("Creator status errors", formatCount(errorCount))}
              ${detailRow("Stale creator checks", formatCount(staleCount))}
              ${detailRow("Messages", formatCount(platform.counters?.messages))}
              ${detailRow("Triggers", formatCount(platform.counters?.triggers))}
            </dl>
            <p class="ss-overview-card-note muted">${escapeHtml(coerceText(provider?.last_error || platform.paused_reason || platform.error, "No active platform warning is being reported."))}</p>
          </article>
        `;
      })
      .join("");
  }

  function renderAccounts() {
    renderAccountSummary();
    renderAccountDetails();
  }

  function renderAccountSummary() {
    if (!el.accountSummary) return;
    const users = extractUsers(VIEW_STATE.state.usersSnapshot);
    if (!users.length) {
      el.accountSummary.innerHTML = '<div class="ss-overview-empty">No authoritative account snapshot was available.</div>';
      return;
    }

    const creatorCapable = countBy(users, (user) => user.creator_capable === true || user.public_profile?.creator_capable === true);
    const viewerOnly = countBy(users, (user) => user.viewer_only === true || user.public_profile?.viewer_only === true);
    const verified = countBy(users, (user) => user.email_verified === true);
    const listedProfiles = countBy(users, (user) => user.streamsuites_profile_visible === true || user.public_profile?.streamsuites_profile_visible === true);
    const listedFindMeHere = countBy(users, (user) => user.findmehere_visible === true || user.public_profile?.findmehere_visible === true);
    const developers = countBy(users, (user) => normalizeRole(user.role) === "developer");

    el.accountSummary.innerHTML = [
      buildSummaryCard("Total accounts", formatCount(users.length), `Snapshot exported ${formatTimestamp(VIEW_STATE.state.usersSnapshot?.exported_at) || "unknown"}.`),
      buildSummaryCard("Creator-capable", formatCount(creatorCapable), "Accounts currently eligible for creator-capable surfaces."),
      buildSummaryCard("Viewer-only", formatCount(viewerOnly), "Accounts remaining in viewer-only posture."),
      buildSummaryCard("Verified email", formatCount(verified), "Accounts whose exported auth state reports verified email."),
      buildSummaryCard("Developer role", formatCount(developers), "Non-admin operator-capable accounts in the current snapshot."),
      buildSummaryCard("Public profile visibility", formatCount(listedProfiles), `${formatCount(listedFindMeHere)} currently visible on FindMeHere.`)
    ].join("");
  }

  function renderAccountDetails() {
    if (!el.accountDetailGrid) return;
    const users = extractUsers(VIEW_STATE.state.usersSnapshot);
    if (!users.length) {
      el.accountDetailGrid.innerHTML = "";
      return;
    }

    const roleCounts = groupCounts(users, (user) => normalizeRole(user.role) || "unknown");
    const tierCounts = groupCounts(users, (user) => normalizeRole(user.tier) || "unknown");
    const statusCounts = groupCounts(users, (user) => normalizeRole(user.account_status || user.status) || "unknown");

    el.accountDetailGrid.innerHTML = [
      buildDetailCard(
        "Role distribution",
        "Current account mix",
        renderCountRows(roleCounts),
        "Counts come from the current admin user snapshot rather than static placeholder assumptions."
      ),
      buildDetailCard(
        "Tier distribution",
        "Commercial posture snapshot",
        renderCountRows(tierCounts),
        "Tier counts are descriptive only here. Billing and tier actions remain on dedicated account surfaces."
      ),
      buildDetailCard(
        "Surface visibility",
        "Published profile posture",
        [
          detailRow("StreamSuites visible", formatCount(countBy(users, (user) => user.streamsuites_profile_visible === true || user.public_profile?.streamsuites_profile_visible === true))),
          detailRow("FindMeHere visible", formatCount(countBy(users, (user) => user.findmehere_visible === true || user.public_profile?.findmehere_visible === true))),
          detailRow("FindMeHere eligible", formatCount(countBy(users, (user) => user.findmehere_eligible === true || user.public_profile?.findmehere_eligible === true))),
          detailRow("Anonymous profiles", formatCount(countBy(users, (user) => user.public_profile?.is_anonymous === true))),
          detailRow("Listed profiles", formatCount(countBy(users, (user) => user.public_profile?.is_listed !== false)))
        ].join(""),
        "Visibility and eligibility stay grounded in the exported public-profile contract."
      ),
      buildDetailCard(
        "Account status",
        "Lifecycle posture",
        renderCountRows(statusCounts),
        "This is a descriptive snapshot of account state, not a persistence or support workflow surface."
      )
    ].join("");
  }

  function renderSignals() {
    if (!el.signalsGrid) return;
    el.signalsGrid.innerHTML = [
      buildFeedCard("Attention queue", "Warnings derived from exported/runtime contracts", buildWarningsMarkup(), { span: "wide" }),
      buildFeedCard("Admin activity", "Recent operator actions from the admin activity contract", buildAdminActivityMarkup(), { span: "wide" }),
      buildFeedCard("Auth events", "Recent auth and email events from the analytics export/API", buildAuthEventsMarkup(), { span: "wide" }),
      buildFeedCard("Audit changes", "Recent governance and account changes from the audit export/API", buildAuditMarkup(), { span: "wide" })
    ].join("");
  }

  function renderPublication() {
    if (!el.publicationGrid) return;
    const manifest = VIEW_STATE.state.exportManifest || {};
    const exportsList = Array.isArray(manifest.exports) ? manifest.exports : [];
    const providers = Array.isArray(VIEW_STATE.state.liveStatus?.providers) ? VIEW_STATE.state.liveStatus.providers : [];

    el.publicationGrid.innerHTML = [
      buildDetailCard(
        "Published exports",
        "Manifest-backed runtime files",
        exportsList.length
          ? exportsList
              .slice(0, 8)
              .map((entry) => detailRow(entry.file || "unknown", coerceText(entry.visibility, "unknown")))
              .join("")
          : detailRow("Exports", "Manifest unavailable"),
        exportsList.length
          ? "This list is sourced from the published export manifest."
          : "The export manifest did not load, so this page cannot assert which files are currently published.",
        { span: "wide" }
      ),
      buildDetailCard(
        "Provider cadence",
        "Live-status export watchers",
        providers.length
          ? providers
              .map((provider) =>
                detailRow(
                  labelize(provider.provider || "provider"),
                  `${provider.cadence_seconds || "—"}s cadence / ${provider.stale_after_seconds || "—"}s stale`
                )
              )
              .join("")
          : detailRow("Providers", "Not exported"),
        providers.some((provider) => coerceText(provider.last_error))
          ? "At least one provider reported an error in the latest export."
          : "No provider errors were reported in the latest export.",
        { span: "wide" }
      ),
      buildDetailCard(
        "Observed admin contracts",
        "What overview is actually hydrating",
        [
          detailChipRow("Runtime snapshot", VIEW_STATE.state.runtimeRaw ? "Available" : "Unavailable", VIEW_STATE.state.runtimeRaw ? "success" : "muted"),
          detailChipRow("Auth controls", VIEW_STATE.state.authControls ? "Available" : "Unavailable", VIEW_STATE.state.authControls ? "success" : "muted"),
          detailChipRow("Session identity", VIEW_STATE.state.sessionIdentity ? "Available" : "Unavailable", VIEW_STATE.state.sessionIdentity ? "success" : "muted"),
          detailChipRow("Users snapshot", VIEW_STATE.state.usersSnapshot ? "Available" : "Unavailable", VIEW_STATE.state.usersSnapshot ? "success" : "muted"),
          detailChipRow("Audit snapshot", VIEW_STATE.state.auditSnapshot ? "Available" : "Unavailable", VIEW_STATE.state.auditSnapshot ? "success" : "muted"),
          detailChipRow("Discord status", VIEW_STATE.state.discordStatus ? "Available" : "Unavailable", VIEW_STATE.state.discordStatus ? "success" : "muted")
        ].join(""),
        "Overview only summarizes the contracts it can actually load in this admin shell.",
        { span: "wide" }
      )
    ].join("");
  }

  function renderScaffolds() {
    if (!el.scaffoldGrid) return;
    const cards = [
      buildScaffoldCard(
        "Runtime mutations stay external",
        "Restart execution, deploy orchestration, and deeper runtime service mutations remain outside this page until StreamSuites exposes a safe authoritative contract for them."
      ),
      buildScaffoldCard(
        "Platform control-plane parity is uneven",
        "Discord, Rumble, Kick, Pilled, Twitch, and YouTube do not all expose the same admin control-plane depth yet. This overview reports actual posture and routes you to dedicated surfaces when they exist."
      ),
      buildScaffoldCard(
        "Incidents and deployment history are not fabricated",
        "There is no separate incident, deployment, or statuspage persistence contract wired into this dashboard home yet, so this page reports real warnings and recent changes without pretending it owns a full incident console."
      )
    ];

    el.scaffoldGrid.innerHTML = cards.join("");
  }

  function buildWarningsMarkup() {
    const items = buildAttentionItems();
    if (!items.length) {
      return buildEmptyFeed("No active warnings were derived from the currently loaded contracts.");
    }
    return buildFeedList(items.slice(0, MAX_WARNING_ITEMS));
  }

  function buildAdminActivityMarkup() {
    const events = Array.isArray(VIEW_STATE.state.adminActivity?.events)
      ? VIEW_STATE.state.adminActivity.events
      : [];
    if (!events.length) {
      return buildEmptyFeed("No recent admin activity was available in the current window.");
    }
    return buildFeedList(
      events.slice(0, MAX_ACTIVITY_ITEMS).map((event) => ({
        tone: "muted",
        label: coerceText(event.action, "Admin action"),
        meta: `${formatTimestamp(event.timestamp)} • ${coerceText(event.source, "unknown source")}`,
        body: [coerceText(event.user, "Unknown operator"), coerceText(event.client_ip, "No client IP")].join(" • "),
        chips: [{ text: labelize(event.source || "activity"), tone: "info" }]
      }))
    );
  }

  function buildAuthEventsMarkup() {
    const events = Array.isArray(VIEW_STATE.state.telemetryAuthEvents?.events)
      ? VIEW_STATE.state.telemetryAuthEvents.events
      : [];
    if (!events.length) {
      return buildEmptyFeed("No recent auth or email events were exported in the current window.");
    }
    return buildFeedList(
      events.slice(0, MAX_AUTH_EVENTS).map((event) => ({
        tone: normalizeResultTone(event.result),
        label: coerceText(event.action || event.event_name, "Auth event"),
        meta: `${formatTimestamp(event.timestamp_utc || event.timestamp)} • ${coerceText(event.event_type, "unknown")}`,
        body: [coerceText(event.result, "result unknown"), coerceText(event.user_identifier || event.account_id, "unknown account")].join(" • "),
        chips: [{ text: labelize(event.result || "unknown"), tone: normalizeResultTone(event.result) }]
      }))
    );
  }

  function buildAuditMarkup() {
    const entries = extractAuditEntries(VIEW_STATE.state.auditSnapshot);
    if (!entries.length) {
      return buildEmptyFeed("No audit export was available for recent change review.");
    }
    return buildFeedList(
      entries.slice(0, MAX_AUDIT_ITEMS).map((entry) => ({
        tone: "muted",
        label: coerceText(entry.action, "Audit event"),
        meta: `${formatTimestamp(entry.ts || entry.timestamp || entry.created_at)} • ${coerceText(entry.actor_role, "unknown role")}`,
        body: [coerceText(entry.actor_user_code, "unknown actor"), coerceText(entry.target_user_code, "no explicit target")].join(" • "),
        chips: [{ text: labelize(entry.actor_role || "unknown role"), tone: "muted" }]
      }))
    );
  }

  function buildAttentionItems() {
    const items = [];
    const restartIntent = VIEW_STATE.state.runtimeSnapshot?.restartIntent;
    if (restartIntent?.required) {
      items.push({
        tone: "warning",
        label: "Restart boundary pending",
        meta: "Runtime restart-intent export",
        body: Array.isArray(restartIntent.summary) && restartIntent.summary.length
          ? restartIntent.summary.join(" • ")
          : "Runtime reports staged changes that still need apply/restart."
      });
    }

    const telemetryErrors = Array.isArray(VIEW_STATE.state.telemetryErrors?.errors)
      ? VIEW_STATE.state.telemetryErrors.errors
      : [];
    telemetryErrors
      .filter((entry) => entry.active)
      .slice(0, 3)
      .forEach((entry) => {
        items.push({
          tone: "danger",
          label: coerceText(entry.subsystem, "Runtime error"),
          meta: formatTimestamp(entry.last_seen || entry.timestamp),
          body: coerceText(entry.message, "An active telemetry error was reported.")
        });
      });

    const authControls = VIEW_STATE.state.authControls;
    if (authControls && !authControls.__authLocked) {
      const flags = authControls.flags || authControls.controls || authControls;
      if (flags.disable_new_signups === true) {
        items.push({
          tone: "warning",
          label: "New signups disabled",
          meta: "Auth controls",
          body: "Auth is currently reporting that new account registration is disabled."
        });
      }
      if (flags.disable_resend_verification === true) {
        items.push({
          tone: "warning",
          label: "Verification resend disabled",
          meta: "Auth controls",
          body: "Auth is currently blocking resend verification flows."
        });
      }
    }

    const providers = Array.isArray(VIEW_STATE.state.liveStatus?.providers)
      ? VIEW_STATE.state.liveStatus.providers
      : [];
    providers
      .filter((provider) => coerceText(provider.last_error))
      .slice(0, 2)
      .forEach((provider) => {
        items.push({
          tone: "danger",
          label: `${labelize(provider.provider || "Provider")} provider error`,
          meta: "Live-status export",
          body: coerceText(provider.last_error, "Provider reported an error.")
        });
      });

    const discord = VIEW_STATE.state.discordStatus;
    if (discord?.success === false || coerceText(discord?.error || discord?.message)) {
      items.push({
        tone: "warning",
        label: "Discord admin status needs review",
        meta: "Auth-backed Discord status",
        body: coerceText(discord?.error || discord?.message, "Discord status payload reported a problem.")
      });
    }

    return items;
  }

  function renderAuthRows(authControls) {
    if (!authControls) {
      return detailChipRow("Status", "Unavailable", "muted");
    }
    if (authControls.__authLocked) {
      return detailChipRow("Status", "Admin session required", "warning");
    }
    const flags = authControls.flags || authControls.controls || authControls;
    return [
      detailChipRow("New signups", formatFlagState(flags.disable_new_signups, { inverted: true }), toneForFlagState(flags.disable_new_signups, { inverted: true })),
      detailChipRow("Email verification", formatFlagState(flags.disable_email_verification, { inverted: true }), toneForFlagState(flags.disable_email_verification, { inverted: true })),
      detailChipRow("Resend verification", formatFlagState(flags.disable_resend_verification, { inverted: true }), toneForFlagState(flags.disable_resend_verification, { inverted: true })),
      detailChipRow("Tier bypass", formatFlagState(flags.admin_tier_config_bypass), toneForFlagState(flags.admin_tier_config_bypass)),
      detailChipRow("Runtime authority", "Auth API", "info")
    ].join("");
  }

  function renderAlertRows(settings) {
    if (!settings) {
      return detailChipRow("Status", "Unavailable", "muted");
    }
    const preferences = settings.preferences || {};
    return [
      detailChipRow("Master delivery", preferences.master_enabled === false ? "Muted" : "Enabled", preferences.master_enabled === false ? "warning" : "success"),
      detailRow(
        "Quiet hours",
        preferences.quiet_hours_enabled === true
          ? `${coerceText(preferences.quiet_hours_start, "--")} to ${coerceText(preferences.quiet_hours_end, "--")}`
          : "Off"
      ),
      detailRow("Timezone", coerceText(preferences.timezone, "Unavailable")),
      detailRow("Registered devices", formatCount(settings.registered_devices_total)),
      detailRow("Rule count", formatCount(settings.rule_count))
    ].join("");
  }

  function renderRestartRows(restartIntent) {
    if (!restartIntent) {
      return detailChipRow("Status", "Not exported", "muted");
    }
    return [
      detailChipRow("Restart required", restartIntent.required ? "Yes" : "No", restartIntent.required ? "warning" : "success"),
      detailChipRow("System pending", restartIntent.pending?.system ? "Pending" : "Clear", restartIntent.pending?.system ? "warning" : "success"),
      detailChipRow("Creators pending", restartIntent.pending?.creators ? "Pending" : "Clear", restartIntent.pending?.creators ? "warning" : "success"),
      detailChipRow("Triggers pending", restartIntent.pending?.triggers ? "Pending" : "Clear", restartIntent.pending?.triggers ? "warning" : "success"),
      detailChipRow("Platforms pending", restartIntent.pending?.platforms ? "Pending" : "Clear", restartIntent.pending?.platforms ? "warning" : "success")
    ].join("");
  }

  function renderLocalConfigRows() {
    const creators = Array.isArray(VIEW_STATE.state.localCreators) ? VIEW_STATE.state.localCreators : [];
    const platforms = VIEW_STATE.state.localPlatforms?.platforms || {};
    const triggers = getTriggerCount();
    return [
      detailRow("Creators configured", formatCount(creators.length)),
      detailRow("Triggers configured", formatCount(triggers)),
      detailRow("Enabled platform drafts", formatCount(Object.values(platforms).filter((entry) => entry?.enabled !== false).length)),
      detailRow("Rumble creators", formatCount(countCreatorsByPlatform("rumble"))),
      detailRow("Twitch creators", formatCount(countCreatorsByPlatform("twitch")))
    ].join("");
  }

  function getRuntimePlatforms() {
    const rawPlatforms = Array.isArray(VIEW_STATE.state.runtimeRaw?.platforms)
      ? VIEW_STATE.state.runtimeRaw.platforms
      : [];
    const ordered = [...rawPlatforms].sort((a, b) => {
      const aKey = PLATFORM_ORDER.indexOf(String(a.platform || a.name || "").toLowerCase());
      const bKey = PLATFORM_ORDER.indexOf(String(b.platform || b.name || "").toLowerCase());
      const safeA = aKey === -1 ? Number.MAX_SAFE_INTEGER : aKey;
      const safeB = bKey === -1 ? Number.MAX_SAFE_INTEGER : bKey;
      if (safeA !== safeB) return safeA - safeB;
      return String(a.platform || a.name || "").localeCompare(String(b.platform || b.name || ""));
    });
    return ordered;
  }

  function getPlatformTone(platform) {
    const status = normalizeRole(platform.status || platform.state);
    if (status === "active") return "success";
    if (status === "paused") return "warning";
    if (status === "disabled" || status === "inactive") return "muted";
    return "info";
  }

  function describeLocalPlatformConfig(platformKey) {
    const enabledCreators = countCreatorsByPlatform(platformKey);
    const platformDraft = VIEW_STATE.state.localPlatforms?.platforms?.[platformKey];
    if (!platformDraft) {
      return enabledCreators ? `${enabledCreators} creator${enabledCreators === 1 ? "" : "s"} flagged` : "No local draft";
    }
    if (platformDraft.enabled === false) {
      return "Disabled in local draft";
    }
    if (enabledCreators) {
      return `${enabledCreators} creator${enabledCreators === 1 ? "" : "s"} flagged`;
    }
    return "Enabled with no creator flag";
  }

  function countCreatorsByPlatform(platformKey) {
    return countBy(VIEW_STATE.state.localCreators, (creator) => {
      const entry = creator?.platforms?.[platformKey];
      return entry === true || entry?.enabled === true;
    });
  }

  function getTriggerCount() {
    const storage = window.App?.storage;
    const behaviour =
      storage?.loadFromLocalStorage?.("chat_behaviour", {}) ||
      {};
    return Array.isArray(behaviour.triggers) ? behaviour.triggers.length : 0;
  }

  function unwrapAlertSettings(payload) {
    if (!payload || typeof payload !== "object") return null;
    if (payload.settings && typeof payload.settings === "object") return payload.settings;
    if (payload.preferences || payload.rule_count !== undefined) return payload;
    return null;
  }

  function describeSession(session, access) {
    if (session?.__authLocked) return "Session required";
    const name = coerceText(session?.displayName, "");
    const role = coerceText(session?.role, coerceText(access?.level, "unknown"));
    const email = coerceText(session?.email, "");
    const parts = [name, role, email].filter(Boolean);
    return parts.length ? parts.join(" • ") : "Unavailable";
  }

  function getPreferredOperatorName() {
    const session = VIEW_STATE.state.sessionIdentity;
    const authState = window.StreamSuitesAdminAuth?.state || {};
    const sessionWindowState = window.StreamSuitesAdminSession || {};
    const access = window.StreamSuitesDashboardPermissions?.getAccess?.() || {};
    const email = coerceText(
      session?.email ||
        authState.email ||
        sessionWindowState.email,
      ""
    );
    const directName = coerceText(
      session?.displayName ||
        authState.displayName ||
        authState.name ||
        sessionWindowState.display_name ||
        sessionWindowState.displayName ||
        sessionWindowState.name ||
        access.displayName,
      ""
    );
    if (directName) return directName;
    if (email.includes("@")) {
      return email.split("@")[0];
    }
    return "Administrator";
  }

  function normalizeResultTone(result) {
    const value = normalizeRole(result);
    if (value === "success" || value === "ok" || value === "allowed") return "success";
    if (value === "failed" || value === "failure" || value === "denied" || value === "error") return "danger";
    if (value === "warning" || value === "pending") return "warning";
    return "muted";
  }

  function toneForFlagState(value, options = {}) {
    if (value === true) return options.inverted ? "warning" : "success";
    if (value === false) return options.inverted ? "success" : "muted";
    return "muted";
  }

  function getAlertSeverityTone(value) {
    const normalized = normalizeRole(value);
    if (normalized === "critical" || normalized === "error") return "danger";
    if (normalized === "warning") return "warning";
    if (normalized === "info") return "info";
    return "muted";
  }

  function getAlertHistoryStatus(entry) {
    if (!entry || typeof entry !== "object") return "Unavailable";
    if (entry.suppressed_reason) return "Suppressed";
    if (Array.isArray(entry.destinations_delivered) && entry.destinations_delivered.length) return "Delivered";
    if (entry.delivered_at) return "Delivered";
    return "Pending";
  }

  function getAlertStatusTone(entry, statusText = "") {
    if (entry?.suppressed_reason) return "warning";
    if (statusText === "Delivered") return "success";
    if (statusText === "Pending") return "muted";
    return "muted";
  }

  function getLatestAlertEntry(payload) {
    const items = extractItems(payload)
      .filter((entry) => entry && typeof entry === "object")
      .sort((left, right) => {
        const leftTs = new Date(left.triggered_at || left.created_at || 0).getTime();
        const rightTs = new Date(right.triggered_at || right.created_at || 0).getTime();
        return rightTs - leftTs;
      });
    return items[0] || null;
  }

  function summarizeAlertLocation(entry) {
    if (!entry || typeof entry !== "object") return "Unavailable";
    const geo =
      entry.metadata?.template_context?.geo ||
      entry.payload_snapshot?.geo ||
      entry.geo ||
      {};
    const city = coerceText(geo.city, "");
    const region = coerceText(geo.region || geo.region_code, "");
    const country = coerceText(geo.country || geo.country_code, "");
    const parts = [city, region, country].filter(Boolean);
    return parts.length ? parts.join(", ") : "No location context";
  }

  function summarizeAnalyticsFootprint(payload) {
    const locations = Array.isArray(payload?.by_location) ? payload.by_location : [];
    const countries = Array.isArray(payload?.by_country) ? payload.by_country : [];
    const surfaces = Array.isArray(payload?.surfaces) ? payload.surfaces : [];
    const countryKeys = new Set();
    const cityKeys = new Set();
    const regionKeys = new Set();
    const regionTotals = new Map();

    locations.forEach((entry) => {
      const country = coerceText(
        entry?.countryName || entry?.country || entry?.name || entry?.country_code || entry?.code,
        ""
      );
      const city = coerceText(entry?.city, "");
      const region = coerceText(entry?.region || entry?.regionCode || entry?.region_code, "");
      const requests = Number(entry?.requests ?? entry?.count ?? 0);
      const sessions = Number(entry?.sessions ?? entry?.count ?? requests);
      const total = Number.isFinite(sessions) && sessions > 0
        ? sessions
        : Number.isFinite(requests)
          ? requests
          : 0;

      if (country) countryKeys.add(country.toLowerCase());
      if (city) cityKeys.add(`${city.toLowerCase()}|${country.toLowerCase()}`);

      const regionLabel = [region, country].filter(Boolean).join(", ");
      if (regionLabel) {
        regionKeys.add(regionLabel.toLowerCase());
        regionTotals.set(regionLabel, (regionTotals.get(regionLabel) || 0) + total);
      }
    });

    countries.forEach((entry) => {
      const country = coerceText(entry?.countryName || entry?.name || entry?.country || entry?.code, "");
      if (country) countryKeys.add(country.toLowerCase());
    });

    const topSurface = [...surfaces]
      .map((entry) => ({
        label: labelize(entry?.label || entry?.surface || entry?.key || "Unknown"),
        count: Number(entry?.count ?? 0)
      }))
      .sort((left, right) => right.count - left.count)[0];

    const topRegion = [...regionTotals.entries()].sort((left, right) => right[1] - left[1])[0];

    return {
      countryCount: countryKeys.size || countries.length,
      cityCount: cityKeys.size,
      regionCount: regionKeys.size,
      topRegionLabel: topRegion?.[0] || "No region detail exported",
      topSurface: topSurface?.label || "Unavailable",
      windowLabel: String(payload?.window || ANALYTICS_WINDOW).trim() || ANALYTICS_WINDOW
    };
  }

  function getApiUsageLiveSummary(bundle) {
    const live = bundle?.live_summary && typeof bundle.live_summary === "object"
      ? bundle.live_summary
      : bundle?.summary && typeof bundle.summary === "object"
        ? bundle.summary
        : {};
    return {
      rpmText: formatDecimal(live.rpm, Number(live.rpm) >= 10 ? 0 : 2),
      errorRate: Number(live.error_rate),
      errorRateText: formatPercent(live.error_rate, 2),
      windowLabel: coerceText(live.window_label || bundle?.window_label || API_USAGE_WINDOW, API_USAGE_WINDOW),
      generatedAt: formatTimestamp(live.generated_at || bundle?.generated_at) || "Unavailable"
    };
  }

  function sanitizeApiUsageEndpoints(payload) {
    const rows = Array.isArray(payload) ? payload : [];
    return rows
      .map((row) => {
        const endpoint = coerceText(row?.endpoint || row?.path || row?.route, "unknown");
        const hits = Number(row?.hits ?? 0);
        const errors = Number(row?.errors ?? 0);
        const errorRate = Number.isFinite(Number(row?.error_rate))
          ? Number(row.error_rate)
          : hits > 0
            ? errors / hits
            : 0;
        const latency = Number(row?.p95_latency_ms ?? row?.avg_latency_ms ?? 0);
        let status = "healthy";
        if (errorRate > 0.05 || latency > 2000) {
          status = "unhealthy";
        } else if (errorRate >= 0.01 || latency >= 800) {
          status = "degraded";
        }
        return {
          endpoint,
          hits: Number.isFinite(hits) ? Math.max(0, hits) : 0,
          status
        };
      })
      .sort((left, right) => right.hits - left.hits);
  }

  function summarizeApiSupplementSections(bundle) {
    const sections = [];
    if (bundle?.auth_access_signals) sections.push("Auth signals");
    if (bundle?.tier_surface_usage) sections.push("Tier surfaces");
    if (bundle?.version_regression) sections.push("Version watch");
    return sections.length ? sections.join(" • ") : "Core summary only";
  }

  function formatPercent(value, digits = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return `${(number * 100).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits
    })}%`;
  }

  function formatDecimal(value, digits = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return number.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits
    });
  }

  function groupCounts(items, getter) {
    const map = new Map();
    items.forEach((item) => {
      const key = coerceText(getter(item), "unknown");
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function renderCountRows(entries) {
    if (!entries.length) {
      return detailRow("Status", "No data");
    }
    return entries.map(([label, value]) => detailRow(labelize(label), formatCount(value))).join("");
  }

  function countBy(items, predicate) {
    return items.reduce((count, item) => count + (predicate(item) ? 1 : 0), 0);
  }

  function formatFlagState(value, options = {}) {
    if (value === true) return options.inverted ? "Disabled" : "Enabled";
    if (value === false) return options.inverted ? "Enabled" : "Disabled";
    return "Unknown";
  }

  function formatVersion(version) {
    if (!version || typeof version !== "object") return "Unavailable";
    const parts = [coerceText(version.version, ""), coerceText(version.build, "")].filter(Boolean);
    return parts.length ? parts.join(" / ") : "Unavailable";
  }

  function formatList(values) {
    if (!Array.isArray(values) || !values.length) return "Unavailable";
    return values.map((value) => labelize(value)).join(", ");
  }

  function formatCount(value) {
    return Number.isFinite(value) ? String(value) : "0";
  }

  function formatTimestamp(value) {
    return window.StreamSuitesState?.formatTimestamp?.(value) || "—";
  }

  function labelize(value) {
    return String(value || "")
      .replace(/[._-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function normalizeRole(value) {
    return String(value || "").trim().toLowerCase();
  }

  function coerceText(value, fallback = "") {
    const text = String(value || "").trim();
    return text || fallback;
  }

  function setStatus(message) {
    if (el.status) el.status.textContent = message;
  }

  function setBanner(message, tone) {
    if (!el.banner) return;
    const text = coerceText(message, "");
    el.banner.textContent = text;
    el.banner.classList.toggle("hidden", !text);
    el.banner.classList.remove("ss-alert-warning", "ss-alert-danger", "ss-alert-info");
    if (!text) return;
    if (tone === "danger") {
      el.banner.classList.add("ss-alert-danger");
      return;
    }
    if (tone === "info") {
      el.banner.classList.add("ss-alert-info");
      return;
    }
    el.banner.classList.add("ss-alert-warning");
  }

  function getSettledValue(result) {
    return result?.status === "fulfilled" ? result.value : null;
  }

  function getSettledError(result) {
    if (result?.status !== "rejected") return "";
    return coerceText(result.reason?.message, "Overview data failed to load.");
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

  function buildSummaryCard(label, value, note) {
    return `
      <article class="ss-overview-summary-card">
        <span class="ss-overview-kicker">${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <p class="muted">${escapeHtml(note)}</p>
      </article>
    `;
  }

  function buildInlineMetric(label, value) {
    return `
      <div class="ss-overview-inline-metric">
        <span class="ss-overview-inline-metric-label">${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function buildDetailCard(label, title, body, note = "", options = {}) {
    const span = coerceText(options.span, "");
    return `
      <article class="ss-overview-detail-card" ${span ? `data-span="${escapeHtml(span)}"` : ""}>
        <div class="ss-overview-card-head">
          <div>
            <span class="ss-overview-kicker">${escapeHtml(label)}</span>
            <h3>${escapeHtml(title)}</h3>
          </div>
        </div>
        <dl class="ss-overview-detail-list">
          ${body}
        </dl>
        <p class="ss-overview-card-note muted">${escapeHtml(note)}</p>
      </article>
    `;
  }

  function buildFeedCard(title, subtitle, content, options = {}) {
    const span = coerceText(options.span, "");
    return `
      <article class="ss-overview-detail-card ss-overview-feed-card" ${span ? `data-span="${escapeHtml(span)}"` : ""}>
        <div class="ss-overview-card-head">
          <div>
            <span class="ss-overview-kicker">Recent feed</span>
            <h3>${escapeHtml(title)}</h3>
          </div>
        </div>
        <p class="muted">${escapeHtml(subtitle)}</p>
        ${content}
      </article>
    `;
  }

  function buildScaffoldCard(title, body) {
    return `
      <article class="ss-overview-scaffold-card">
        <span class="ss-overview-kicker">Honest scaffold</span>
        <h3>${escapeHtml(title)}</h3>
        <p class="muted">${escapeHtml(body)}</p>
      </article>
    `;
  }

  function buildFeedList(items) {
    return `
      <div class="ss-overview-feed-list">
        ${items
          .map(
            (item) => `
              <article class="ss-overview-feed-item" data-tone="${escapeHtml(item.tone || "muted")}">
                <div class="ss-overview-feed-topline">
                  <div class="ss-overview-feed-topline-main">
                    <strong>${escapeHtml(item.label)}</strong>
                    ${
                      Array.isArray(item.chips) && item.chips.length
                        ? `<div class="ss-overview-chip-row">${item.chips
                            .map((chip) => badgeSpan(chip.text, chip.tone || "muted"))
                            .join("")}</div>`
                        : ""
                    }
                  </div>
                  ${item.meta ? `<span class="muted">${escapeHtml(item.meta)}</span>` : ""}
                </div>
                <p class="muted">${escapeHtml(item.body || "")}</p>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  function buildEmptyFeed(message) {
    return `<div class="ss-overview-empty">${escapeHtml(message)}</div>`;
  }

  function detailRow(label, value) {
    return `
      <div class="ss-overview-meta-row">
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(value)}</dd>
      </div>
    `;
  }

  function detailChipRow(label, value, tone = "muted") {
    return `
      <div class="ss-overview-meta-row">
        <dt>${escapeHtml(label)}</dt>
        <dd>${badgeSpan(value, tone)}</dd>
      </div>
    `;
  }

  function detailFlagRow(label, value) {
    if (value === true) return detailRow(label, "Yes");
    if (value === false) return detailRow(label, "No");
    return detailRow(label, "Unknown");
  }

  function detailFlagChipRow(label, value) {
    if (value === true) return detailChipRow(label, "Enabled", "success");
    if (value === false) return detailChipRow(label, "Disabled", "muted");
    return detailChipRow(label, "Unknown", "muted");
  }

  function badgeSpan(text, tone = "muted") {
    return `<span class="ss-chip ${chipClassForTone(tone)}">${escapeHtml(labelize(text))}</span>`;
  }

  function chipClassForTone(tone) {
    if (tone === "success") return "ss-chip-success";
    if (tone === "warning") return "ss-chip-warning";
    if (tone === "danger") return "ss-chip-danger";
    if (tone === "info") return "ss-chip-info";
    return "ss-chip-muted";
  }

  function getPlatformIconPath(value) {
    const normalized = String(value || "").trim().toLowerCase();
    const iconMap = {
      discord: "/assets/icons/discord.svg",
      kick: "/assets/icons/kick.svg",
      pilled: "/assets/icons/pilled.svg",
      rumble: "/assets/icons/rumble.svg",
      twitch: "/assets/icons/twitch.svg",
      twitter: "/assets/icons/twitter.svg",
      youtube: "/assets/icons/youtube.svg"
    };
    return iconMap[normalized] || "/assets/icons/ui/widget.svg";
  }

  window.OverviewView = {
    init,
    destroy
  };
})();

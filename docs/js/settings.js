/* ============================================================
   StreamSuites Dashboard - settings.js
   Runtime-aware settings posture view
   ============================================================ */

(() => {
  "use strict";

  const VIEW_STATE = {
    loadToken: 0,
    destroyed: false,
    wired: false,
    runtimeListener: null,
    visibilityListener: null,
    state: createInitialState()
  };

  const el = {};

  function createInitialState() {
    return {
      runtimeRaw: null,
      runtimeSnapshot: null,
      runtimeVersion: null,
      exportManifest: null,
      liveStatus: null,
      authControls: null,
      badgeGovernance: null,
      alertSettings: null,
      alertConfiguration: null,
      dashboardState: null,
      lastRefreshAt: null,
      sourceMode: "unknown",
      banner: null
    };
  }

  function init() {
    VIEW_STATE.destroyed = false;
    VIEW_STATE.state = createInitialState();
    cacheElements();
    wireEvents();
    renderLoadingState();
    void loadAll({ forceRefresh: false });
    bindRuntimeListeners();
  }

  function destroy() {
    VIEW_STATE.destroyed = true;
    VIEW_STATE.wired = false;
    VIEW_STATE.state = createInitialState();

    if (VIEW_STATE.runtimeListener) {
      window.removeEventListener("streamsuites:runtimeSnapshot", VIEW_STATE.runtimeListener);
      VIEW_STATE.runtimeListener = null;
    }
    if (VIEW_STATE.visibilityListener) {
      document.removeEventListener("visibilitychange", VIEW_STATE.visibilityListener);
      VIEW_STATE.visibilityListener = null;
    }
  }

  function cacheElements() {
    el.modeChip = document.getElementById("settings-mode-chip");
    el.status = document.getElementById("settings-status");
    el.banner = document.getElementById("settings-banner");
    el.refresh = document.getElementById("settings-refresh");
    el.exportDraft = document.getElementById("settings-export-draft");
    el.importDraft = document.getElementById("settings-import-draft");
    el.importFile = document.getElementById("settings-import-file");
    el.openAccounts = document.getElementById("settings-open-accounts");
    el.openAlerts = document.getElementById("settings-open-alerts");

    el.metaRuntime = document.getElementById("settings-meta-runtime");
    el.metaAlerts = document.getElementById("settings-meta-alerts");
    el.metaLoaded = document.getElementById("settings-meta-loaded");
    el.metaExported = document.getElementById("settings-meta-exported");

    el.overviewSummary = document.getElementById("settings-overview-summary");
    el.overviewRestart = document.getElementById("settings-overview-restart");
    el.runtimeAuthority = document.getElementById("settings-runtime-authority");
    el.runtimePlatforms = document.getElementById("settings-runtime-platforms");
    el.liveProviders = document.getElementById("settings-live-status-providers");
    el.authControls = document.getElementById("settings-auth-controls");
    el.badgeGovernance = document.getElementById("settings-badge-governance");
    el.dataAuthority = document.getElementById("settings-data-authority");
    el.dataSources = document.getElementById("settings-data-sources");
    el.alertsSummary = document.getElementById("settings-alerts-summary");
    el.alertsDestinations = document.getElementById("settings-alerts-destinations");
    el.roadmapGrid = document.getElementById("settings-roadmap-grid");
  }

  function wireEvents() {
    if (VIEW_STATE.wired) return;

    el.refresh?.addEventListener("click", () => {
      void loadAll({ forceRefresh: true });
    });

    el.exportDraft?.addEventListener("click", async () => {
      try {
        await window.ConfigState?.exportAllConfigs?.();
        VIEW_STATE.state.dashboardState = await window.ConfigState?.loadDashboardState?.({
          forceReload: true
        });
        renderMeta();
        setBanner("Dashboard draft bundle exported.", "info");
      } catch (err) {
        console.error("[Settings] Draft export failed", err);
        setBanner("Dashboard draft export failed.", "warning");
      }
    });

    el.importDraft?.addEventListener("click", () => {
      if (!el.importFile) return;
      el.importFile.value = "";
      el.importFile.click();
    });

    el.importFile?.addEventListener("change", async () => {
      const file = el.importFile.files?.[0];
      if (!file) return;
      try {
        await window.ConfigState?.importConfigBundle?.(file);
        setBanner("Dashboard draft bundle imported. Refreshing posture…", "info");
        await loadAll({ forceRefresh: true });
      } catch (err) {
        console.error("[Settings] Draft import failed", err);
        setBanner("Dashboard draft import failed. The file did not match the expected bundle shape.", "warning");
      }
    });

    el.openAccounts?.addEventListener("click", () => {
      window.StreamSuitesAdminRoutes?.navigateToView?.("accounts");
    });

    el.openAlerts?.addEventListener("click", () => {
      window.StreamSuitesAdminRoutes?.navigateToView?.("alerts");
    });

    VIEW_STATE.wired = true;
  }

  function bindRuntimeListeners() {
    if (!VIEW_STATE.runtimeListener) {
      VIEW_STATE.runtimeListener = (event) => {
        if (VIEW_STATE.destroyed) return;
        const raw = event?.detail?.snapshot;
        if (!raw || typeof raw !== "object") return;
        VIEW_STATE.state.runtimeRaw = raw;
        VIEW_STATE.state.runtimeSnapshot =
          window.StreamSuitesState?.normalizeRuntimeSnapshot?.(raw) || null;
        VIEW_STATE.state.sourceMode = "connected";
        VIEW_STATE.state.lastRefreshAt = new Date().toISOString();
        render();
      };
      window.addEventListener("streamsuites:runtimeSnapshot", VIEW_STATE.runtimeListener);
    }

    if (!VIEW_STATE.visibilityListener) {
      VIEW_STATE.visibilityListener = () => {
        if (document.visibilityState !== "visible") return;
        void loadAll({ forceRefresh: true, quiet: true });
      };
      document.addEventListener("visibilitychange", VIEW_STATE.visibilityListener);
    }
  }

  async function loadAll(options = {}) {
    const token = ++VIEW_STATE.loadToken;
    setStatus(options.forceRefresh ? "Refreshing settings…" : "Hydrating settings…");
    if (!options.quiet) {
      setBanner("", "");
    }

    const [
      runtimeResult,
      versionResult,
      manifestResult,
      liveStatusResult,
      authResult,
      badgeResult,
      alertSettingsResult,
      alertConfigurationResult,
      dashboardStateResult
    ] = await Promise.allSettled([
      loadRuntimeSources(options),
      loadRuntimeVersion(),
      loadExportManifest(),
      loadLiveStatus(options),
      loadAuthControls(options),
      loadBadgeGovernance(options),
      loadAlertSettings(options),
      loadAlertConfiguration(options),
      window.ConfigState?.loadDashboardState?.({
        forceReload: options.forceRefresh === true
      })
    ]);

    if (VIEW_STATE.destroyed || token !== VIEW_STATE.loadToken) return;

    VIEW_STATE.state.runtimeVersion = getSettledValue(versionResult);
    VIEW_STATE.state.exportManifest = getSettledValue(manifestResult);
    VIEW_STATE.state.liveStatus = getSettledValue(liveStatusResult);
    VIEW_STATE.state.authControls = getSettledValue(authResult);
    VIEW_STATE.state.badgeGovernance = getSettledValue(badgeResult);
    VIEW_STATE.state.alertSettings = getSettledValue(alertSettingsResult);
    VIEW_STATE.state.alertConfiguration = getSettledValue(alertConfigurationResult);
    VIEW_STATE.state.dashboardState = getSettledValue(dashboardStateResult) || null;
    VIEW_STATE.state.lastRefreshAt = new Date().toISOString();

    const runtimePayload = getSettledValue(runtimeResult);
    if (runtimePayload) {
      VIEW_STATE.state.runtimeRaw = runtimePayload.runtimeRaw;
      VIEW_STATE.state.runtimeSnapshot = runtimePayload.runtimeSnapshot;
      VIEW_STATE.state.sourceMode = runtimePayload.sourceMode;
    } else {
      VIEW_STATE.state.runtimeRaw = null;
      VIEW_STATE.state.runtimeSnapshot = null;
      VIEW_STATE.state.sourceMode = "unavailable";
    }

    render();

    const firstError = [
      getSettledError(runtimeResult),
      getSettledError(versionResult),
      getSettledError(manifestResult),
      getSettledError(liveStatusResult),
      getSettledError(authResult),
      getSettledError(badgeResult),
      getSettledError(alertSettingsResult),
      getSettledError(alertConfigurationResult)
    ].find(Boolean);

    if (firstError) {
      setStatus("Settings partially loaded");
      if (!options.quiet) {
        setBanner(firstError, "warning");
      }
      return;
    }

    setStatus("Settings synced");
  }

  async function loadRuntimeSources(options = {}) {
    const runtimeState = window.App?.state?.runtimeSnapshot;
    let runtimeRaw = runtimeState?.getSnapshot?.() || null;

    if (options.forceRefresh === true && runtimeState?.fetchOnce) {
      try {
        await runtimeState.fetchOnce();
        runtimeRaw = runtimeState?.getSnapshot?.() || runtimeRaw;
      } catch (err) {
        console.warn("[Settings] Runtime snapshot refresh failed", err);
      }
    }

    if (!runtimeRaw) {
      try {
        runtimeRaw = await window.StreamSuitesState?.loadStateJson?.("runtime_snapshot.json", {
          loaderReason: "Hydrating settings runtime posture..."
        });
      } catch (err) {
        console.warn("[Settings] Static runtime snapshot unavailable", err);
      }
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

  async function loadRuntimeVersion() {
    return (await window.Versioning?.loadVersion?.()) || null;
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
        loaderReason: "Hydrating live-status providers..."
      })) || null
    );
  }

  function resolveAuthApiBase() {
    const base =
      window.StreamSuitesAdminAuth?.config?.baseUrl ||
      document.querySelector('meta[name="streamsuites-auth-base"]')?.getAttribute("content") ||
      "";
    return String(base || "").trim().replace(/\/+$/, "");
  }

  function buildAuthApiUrl(path) {
    const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;
    const base = resolveAuthApiBase();
    return base ? `${base}${normalizedPath}` : normalizedPath;
  }

  async function getJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: "include",
      cache: options.forceRefresh ? "no-store" : "default"
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
    return getJson(buildAuthApiUrl("/admin/auth/controls"), {
      forceRefresh: options.forceRefresh === true,
      label: "Auth controls"
    });
  }

  async function loadBadgeGovernance(options = {}) {
    return getJson(buildAuthApiUrl("/admin/badge-governance"), {
      forceRefresh: options.forceRefresh === true,
      label: "Badge governance"
    });
  }

  async function loadAlertSettings(options = {}) {
    return (
      (await window.StreamSuitesApi?.getAdminAlertSettings?.({
        forceRefresh: options.forceRefresh === true
      })) || null
    );
  }

  async function loadAlertConfiguration(options = {}) {
    return (
      (await window.StreamSuitesApi?.getAdminAlertConfiguration?.({
        forceRefresh: options.forceRefresh === true
      })) || null
    );
  }

  function renderLoadingState() {
    const loading = '<div class="ss-settings-empty">Loading authoritative settings…</div>';
    [
      el.overviewSummary,
      el.overviewRestart,
      el.runtimeAuthority,
      el.runtimePlatforms,
      el.liveProviders,
      el.authControls,
      el.badgeGovernance,
      el.dataAuthority,
      el.dataSources,
      el.alertsSummary,
      el.alertsDestinations,
      el.roadmapGrid
    ].forEach((node) => {
      if (node) node.innerHTML = loading;
    });
  }

  function render() {
    renderHeader();
    renderMeta();
    renderOverview();
    renderRuntime();
    renderAccess();
    renderDataSources();
    renderAlerts();
    renderRoadmap();
  }

  function renderHeader() {
    const mode = VIEW_STATE.state.sourceMode;
    const runtimeText =
      mode === "connected"
        ? "Connected runtime"
        : mode === "published"
          ? "Published exports"
          : "Runtime unavailable";

    if (el.modeChip) {
      el.modeChip.textContent = runtimeText;
      el.modeChip.classList.toggle("ss-chip-success", mode === "connected");
      el.modeChip.classList.toggle("ss-chip-warning", mode !== "connected");
    }
  }

  function renderMeta() {
    const dashboardState = VIEW_STATE.state.dashboardState || {};
    const alertSettings = VIEW_STATE.state.alertSettings || {};
    const runtimeRaw = VIEW_STATE.state.runtimeRaw || {};

    setText(
      el.metaRuntime,
      formatTimestamp(runtimeRaw.generated_at || runtimeRaw.heartbeat) || "Unavailable"
    );
    setText(
      el.metaAlerts,
      formatTimestamp(
        alertSettings.generated_at ||
          alertSettings.configuration_generated_at ||
          VIEW_STATE.state.alertConfiguration?.generated_at
      ) || "Unavailable"
    );
    setText(el.metaLoaded, formatTimestamp(dashboardState.last_loaded_at) || "No draft loaded");
    setText(el.metaExported, formatTimestamp(dashboardState.last_export_at) || "Not exported yet");
  }

  function renderOverview() {
    const summaryCards = [
      buildMetricCard(
        "Runtime source",
        VIEW_STATE.state.sourceMode === "connected"
          ? "Live runtime"
          : VIEW_STATE.state.sourceMode === "published"
            ? "Published exports"
            : "Unavailable",
        VIEW_STATE.state.sourceMode === "connected"
          ? "Polling is reading the current runtime snapshot."
          : VIEW_STATE.state.sourceMode === "published"
            ? "Read-only posture sourced from exported state files."
            : "No authoritative runtime snapshot was available during this pass."
      ),
      buildMetricCard(
        "Version",
        formatVersion(VIEW_STATE.state.runtimeVersion),
        `Last exported ${formatTimestamp(VIEW_STATE.state.runtimeVersion?.generated_at) || "unknown"}.`
      ),
      buildMetricCard(
        "Auth posture",
        summarizeAuthPosture(VIEW_STATE.state.authControls),
        "These values come from Auth admin controls rather than dashboard-local state."
      ),
      buildMetricCard(
        "Alerts defaults",
        summarizeAlertPosture(VIEW_STATE.state.alertSettings),
        "Notification defaults and delivery counts are read from the backend alerting contracts."
      )
    ];

    if (el.overviewSummary) {
      el.overviewSummary.innerHTML = summaryCards.join("");
    }

    renderRestartSurface();
  }

  function renderRestartSurface() {
    const intent = VIEW_STATE.state.runtimeSnapshot?.restartIntent || null;
    if (!el.overviewRestart) return;

    if (!intent) {
      el.overviewRestart.innerHTML = `
        <div class="ss-settings-note-card">
          <div class="ss-settings-note-card-head">
            <h3>Restart queue</h3>
            <span class="ss-chip ss-chip-muted">Unknown</span>
          </div>
          <p class="muted">No authoritative restart-intent payload was available.</p>
        </div>
      `;
      return;
    }

    const pending = intent.pending || {};
    const chips = [
      buildPendingChip("System", pending.system),
      buildPendingChip("Creators", pending.creators),
      buildPendingChip("Triggers", pending.triggers),
      buildPendingChip("Platforms", pending.platforms)
    ].join("");

    const summary = Array.isArray(intent.summary) && intent.summary.length
      ? `<ul class="ss-settings-bullet-list">${intent.summary
          .map((entry) => `<li>${escapeHtml(entry)}</li>`)
          .join("")}</ul>`
      : '<p class="muted">No pending restart notes are queued.</p>';

    el.overviewRestart.innerHTML = `
      <div class="ss-settings-note-card">
        <div class="ss-settings-note-card-head">
          <h3>Restart queue</h3>
          <span class="ss-chip ${intent.required ? "ss-chip-warning" : "ss-chip-success"}">
            ${intent.required ? "Restart required" : "No restart required"}
          </span>
        </div>
        <div class="ss-settings-chip-row">${chips}</div>
        ${summary}
      </div>
    `;
  }

  function renderRuntime() {
    renderRuntimeAuthority();
    renderRuntimePlatforms();
    renderLiveStatusProviders();
  }

  function renderRuntimeAuthority() {
    if (!el.runtimeAuthority) return;

    const runtimeRaw = VIEW_STATE.state.runtimeRaw || {};
    const runtimeSystem = runtimeRaw.system || {};
    const runtime = runtimeRaw.runtime || {};
    const exportsCount = Array.isArray(VIEW_STATE.state.exportManifest?.exports)
      ? VIEW_STATE.state.exportManifest.exports.length
      : 0;
    const liveStatus = runtimeSystem.live_status || {};
    const chatApi = runtimeSystem.chat?.api || {};
    const syntheticChat = runtimeSystem.chat?.synthetic || {};
    const hotReload = runtimeSystem.hot_reload || {};

    el.runtimeAuthority.innerHTML = [
      buildDetailCard(
        "Runtime authority",
        "Runtime and export lineage",
        [
          detailRow("Project", runtime.project || "StreamSuites Runtime"),
          detailRow("Version", runtime.version || VIEW_STATE.state.runtimeVersion?.version || "Unavailable"),
          detailRow("Build", runtime.build || VIEW_STATE.state.runtimeVersion?.build || "Unavailable"),
          detailRow("Snapshot generated", formatTimestamp(runtimeRaw.generated_at || runtimeRaw.heartbeat) || "Unavailable"),
          detailRow("Published exports", exportsCount ? `${exportsCount} files` : "Manifest unavailable")
        ].join("")
      ),
      buildDetailCard(
        "Service posture",
        "Current subsystem state",
        [
          detailRow("Live-status export", liveStatus.enabled === true ? "Enabled" : liveStatus.enabled === false ? "Disabled" : "Unknown"),
          detailRow("Chat API", chatApi.enabled === true ? `${chatApi.host || "0.0.0.0"}:${chatApi.port || "—"}` : chatApi.enabled === false ? "Disabled" : "Unknown"),
          detailRow("Synthetic chat", syntheticChat.enabled === true ? "Enabled" : syntheticChat.enabled === false ? "Disabled" : "Unknown"),
          detailRow("Hot reload", hotReload.enabled === true ? `Watching ${hotReload.watch_path || "runtime/exports"}` : hotReload.enabled === false ? "Disabled" : "Unknown"),
          detailRow("Hot reload cadence", Number.isFinite(hotReload.interval_seconds) ? `${hotReload.interval_seconds}s` : "—")
        ].join("")
      ),
      buildDetailCard(
        "Surface polling",
        "Platform polling exposure",
        renderPollingRows(runtimeSystem.platform_polling_enabled)
      )
    ].join("");
  }

  function renderRuntimePlatforms() {
    if (!el.runtimePlatforms) return;
    const platforms = Array.isArray(VIEW_STATE.state.runtimeRaw?.platforms)
      ? VIEW_STATE.state.runtimeRaw.platforms
      : [];

    if (!platforms.length) {
      el.runtimePlatforms.innerHTML = '<div class="ss-settings-empty">No platform runtime posture was published.</div>';
      return;
    }

    el.runtimePlatforms.innerHTML = platforms
      .map((platform) => {
        const counters = platform?.counters || {};
        const statusTone =
          platform?.status === "active"
            ? "success"
            : platform?.status === "paused"
              ? "warning"
              : "muted";

        return `
          <article class="ss-settings-platform-card">
            <div class="ss-settings-card-head">
              <div>
                <span class="ss-settings-kicker">Platform</span>
                <h3 class="ss-settings-platform-title">
                  <img
                    class="ss-settings-platform-icon"
                    src="${escapeHtml(getPlatformIconPath(platform?.name || platform?.platform))}"
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  <span>${escapeHtml(labelize(platform?.name || platform?.platform || "Unknown"))}</span>
                </h3>
              </div>
              <span class="ss-chip ${chipClassForTone(statusTone)}">${escapeHtml(labelize(platform?.status || platform?.state || "unknown"))}</span>
            </div>
            <dl class="ss-settings-detail-list">
              ${detailFlagRow("Enabled", platform?.enabled)}
              ${detailFlagRow("Paused", platform?.paused)}
              ${detailFlagRow("Telemetry", platform?.telemetry_enabled)}
              ${detailFlagRow("Replay support", platform?.replay_supported)}
              ${detailFlagRow("Overlay support", platform?.overlay_supported)}
              ${detailRow("Last heartbeat", formatTimestamp(platform?.last_heartbeat) || "Never")}
              ${detailRow("Last success", formatTimestamp(platform?.last_success_ts) || "Never")}
              ${detailRow("Last event", formatTimestamp(platform?.last_event_ts) || "Never")}
              ${detailRow("Messages", formatCount(counters.messages))}
              ${detailRow("Triggers", formatCount(counters.triggers))}
            </dl>
            <p class="ss-settings-card-note muted">${escapeHtml(platform?.paused_reason || platform?.error || "No active platform warning is being reported.")}</p>
          </article>
        `;
      })
      .join("");
  }

  function renderLiveStatusProviders() {
    if (!el.liveProviders) return;
    const providers = Array.isArray(VIEW_STATE.state.liveStatus?.providers)
      ? VIEW_STATE.state.liveStatus.providers
      : [];

    if (!providers.length) {
      el.liveProviders.innerHTML = '<div class="ss-settings-empty">No live-status provider export was available.</div>';
      return;
    }

    el.liveProviders.innerHTML = providers
      .map((provider) =>
        buildDetailCard(
          labelize(provider?.provider || "Provider"),
          "Live-status provider",
          [
            detailRow("Cadence", Number.isFinite(provider?.cadence_seconds) ? `${provider.cadence_seconds}s` : "—"),
            detailRow("Stale after", Number.isFinite(provider?.stale_after_seconds) ? `${provider.stale_after_seconds}s` : "—"),
            detailRow("Batch size", formatCount(provider?.batch_size)),
            detailRow("Creators configured", formatCount(provider?.creators_configured)),
            detailRow("Last refresh start", formatTimestamp(provider?.last_refresh_started_at) || "Unavailable"),
            detailRow("Last refresh finish", formatTimestamp(provider?.last_refresh_completed_at) || "Unavailable")
          ].join(""),
          provider?.last_error ? escapeHtml(provider.last_error) : "No provider error was reported in the published export."
        )
      )
      .join("");
  }

  function renderAccess() {
    renderAuthControls();
    renderBadgeGovernance();
  }

  function renderAuthControls() {
    if (!el.authControls) return;
    const auth = VIEW_STATE.state.authControls;
    if (!auth) {
      el.authControls.innerHTML = '<div class="ss-settings-empty">Auth controls were unavailable.</div>';
      return;
    }
    if (auth.__authLocked) {
      el.authControls.innerHTML = buildMetricCard(
        "Admin auth",
        "Session required",
        "Sign in with an admin session to inspect the live Auth control surface."
      );
      return;
    }

    const flags = auth.flags || auth.controls || auth || {};
    const cards = [
      ["New signups", formatFlagState(flags.disable_new_signups, { inverted: true }), "Whether new accounts can register."],
      ["Email verification", formatFlagState(flags.disable_email_verification, { inverted: true }), "Whether verification remains part of the account flow."],
      ["Resend verification", formatFlagState(flags.disable_resend_verification, { inverted: true }), "Whether resend requests are allowed."],
      ["Tier-config bypass", formatFlagState(flags.admin_tier_config_bypass), "Whether admin tier config bypass is active."]
    ];

    el.authControls.innerHTML = cards
      .map(([label, value, note]) => buildMetricCard(label, value, note))
      .join("");
  }

  function renderBadgeGovernance() {
    if (!el.badgeGovernance) return;
    const governance = VIEW_STATE.state.badgeGovernance;
    if (!governance) {
      el.badgeGovernance.innerHTML = '<div class="ss-settings-empty">Badge governance was unavailable.</div>';
      return;
    }
    if (governance.__authLocked) {
      el.badgeGovernance.innerHTML = buildDetailCard(
        "Badge governance",
        "Admin session required",
        detailRow("Status", "Locked"),
        "The runtime reported badge-governance access only for authenticated admins."
      );
      return;
    }

    const defaultVisibility = governance.default_visibility || {};
    const founderPolicy = governance.founder_policy || {};
    const founder = governance.founder_reconcile || {};
    const catalog = Array.isArray(governance.catalog) ? governance.catalog : [];
    const governedKeys = new Set([
      ...Object.keys(defaultVisibility),
      ...catalog.map((entry) => String(entry?.key || "").trim()).filter(Boolean)
    ]);
    const visibleCells = Object.values(defaultVisibility).reduce((count, row) => {
      const values = row && typeof row === "object" ? Object.values(row) : [];
      return count + values.filter((value) => value === true).length;
    }, 0);
    const supportedSurfaces = new Set();
    catalog.forEach((entry) => {
      (Array.isArray(entry?.surfaces) ? entry.surfaces : []).forEach((surface) => {
        supportedSurfaces.add(surface);
      });
    });

    el.badgeGovernance.innerHTML = [
      buildDetailCard(
        "Founder governance",
        "Runtime-owned founder assignment posture",
        [
          detailRow("Cutoff date", founderPolicy.cutoff_date || governance.founder_cutoff_date || "Not configured"),
          detailRow("Timezone", founderPolicy.cutoff_timezone || "UTC"),
          detailRow("Auto assignment", founderPolicy.auto_assignment_enabled === true ? "Active" : "Off"),
          detailRow("Eligible existing accounts", formatCount(founder.eligible_existing_accounts)),
          detailRow("Pending reconcile", formatCount(founder.pending_accounts)),
          detailRow("Founder enabled", formatCount(founder.enabled_accounts))
        ].join(""),
        "Mutations remain on the Accounts governance surface. Settings reflects the live posture only."
      ),
      buildDetailCard(
        "Visibility matrix",
        "Default badge surface exposure",
        [
          detailRow("Governed badge keys", formatCount(governedKeys.size)),
          detailRow("Visible default cells", formatCount(visibleCells)),
          detailRow("Supported surfaces", formatCount(supportedSurfaces.size)),
          detailRow("Catalog entries", formatCount(catalog.length))
        ].join(""),
        supportedSurfaces.size
          ? `Current surfaces: ${escapeHtml(Array.from(supportedSurfaces).map(labelize).join(", "))}.`
          : "No supported surfaces were listed in the governance catalog."
      )
    ].join("");
  }

  function renderDataSources() {
    if (el.dataAuthority) {
      const manifest = VIEW_STATE.state.exportManifest || {};
      const exportsList = Array.isArray(manifest.exports) ? manifest.exports : [];
      const runtimeRaw = VIEW_STATE.state.runtimeRaw || {};

      el.dataAuthority.innerHTML = [
        buildDetailCard(
          "Authoritative contracts",
          "What this page trusts",
          [
            detailRow("Runtime snapshot", runtimeRaw.generated_at ? "Available" : "Unavailable"),
            detailRow("Auth controls", VIEW_STATE.state.authControls ? "Available" : "Unavailable"),
            detailRow("Badge governance", VIEW_STATE.state.badgeGovernance ? "Available" : "Unavailable"),
            detailRow("Alert settings", VIEW_STATE.state.alertSettings ? "Available" : "Unavailable"),
            detailRow("Exports manifest", exportsList.length ? `${exportsList.length} listed` : "Unavailable")
          ].join(""),
          "These contracts are treated as source-of-truth surfaces. The dashboard does not attempt to override them locally."
        ),
        buildDetailCard(
          "Dashboard-local drafts",
          "What import/export changes",
          [
            detailRow("Bundle scope", "Creators, platforms, system drafts"),
            detailRow("Last draft load", formatTimestamp(VIEW_STATE.state.dashboardState?.last_loaded_at) || "Never"),
            detailRow("Last draft export", formatTimestamp(VIEW_STATE.state.dashboardState?.last_export_at) || "Never"),
            detailRow("Runtime authority", "Unaffected"),
            detailRow("Auth authority", "Unaffected")
          ].join(""),
          "Import and export here are backup and authoring conveniences only. They are not backend persistence."
        )
      ].join("");
    }

    if (el.dataSources) {
      const exportsList = Array.isArray(VIEW_STATE.state.exportManifest?.exports)
        ? VIEW_STATE.state.exportManifest.exports
        : [];

      const cards = exportsList.map((entry) =>
        buildMiniCard(
          entry?.file || "unknown",
          entry?.description || "Published runtime export",
          [
            badgeSpan(entry?.visibility || "public", "muted"),
            badgeSpan("export", "info")
          ].join("")
        )
      );

      cards.push(
        buildMiniCard(
          "dashboard_state",
          "Dashboard-local metadata for import and export timestamps.",
          [badgeSpan("local only", "warning"), badgeSpan("non-authoritative", "warning")].join("")
        )
      );
      cards.push(
        buildMiniCard(
          "local draft configs",
          "Creators, platforms, and system drafts stored locally for authoring and bundle transport.",
          [badgeSpan("local only", "warning"), badgeSpan("safe scaffold", "info")].join("")
        )
      );

      el.dataSources.innerHTML = cards.join("");
    }
  }

  function renderAlerts() {
    renderAlertsSummary();
    renderAlertsDestinations();
  }

  function renderAlertsSummary() {
    if (!el.alertsSummary) return;
    const settings = unwrapAlertSettings(VIEW_STATE.state.alertSettings);
    if (!settings) {
      el.alertsSummary.innerHTML = '<div class="ss-settings-empty">Alert settings were unavailable.</div>';
      return;
    }

    const preferences = settings.preferences || {};
    el.alertsSummary.innerHTML = [
      buildMetricCard(
        "Master delivery",
        preferences.master_enabled === false ? "Muted" : "Enabled",
        preferences.master_enabled === false
          ? "Global alert delivery is disabled by backend preference."
          : "Global alert delivery is enabled."
      ),
      buildMetricCard(
        "Quiet hours",
        preferences.quiet_hours_enabled === true
          ? `${preferences.quiet_hours_start || "--"} to ${preferences.quiet_hours_end || "--"}`
          : "Off",
        preferences.timezone ? `Timezone: ${preferences.timezone}` : "No quiet-hours timezone reported."
      ),
      buildMetricCard(
        "Registered devices",
        formatCount(settings.registered_devices_total),
        `${formatCount(settings.delivery_history_total)} delivery records are retained.`
      ),
      buildMetricCard(
        "Rule coverage",
        `${formatCount(settings.rule_count)} rules`,
        `${formatCount(settings.active_stream_subscribers)} active stream subscribers are currently tracked.`
      )
    ].join("");
  }

  function renderAlertsDestinations() {
    if (!el.alertsDestinations) return;
    const settings = unwrapAlertSettings(VIEW_STATE.state.alertSettings);
    const configurationPayload = VIEW_STATE.state.alertConfiguration;
    const configuration =
      configurationPayload?.configuration && typeof configurationPayload.configuration === "object"
        ? configurationPayload.configuration
        : configurationPayload || {};

    if (!settings) {
      el.alertsDestinations.innerHTML = '<div class="ss-settings-empty">Alert destination defaults were unavailable.</div>';
      return;
    }

    const summary = settings.registered_devices_summary || {};
    const destinationDefaults = configuration.destination_defaults || {};
    const destinationKeys = Array.from(
      new Set([
        ...Object.keys(summary || {}),
        ...Object.keys(destinationDefaults || {})
      ])
    );

    if (!destinationKeys.length) {
      el.alertsDestinations.innerHTML = '<div class="ss-settings-empty">No destination defaults or registered channels were reported.</div>';
      return;
    }

    el.alertsDestinations.innerHTML = destinationKeys
      .map((key) => {
        const destination = destinationDefaults[key] || {};
        const registered = summary[key];
        return `
          <article class="ss-settings-mini-card">
            <div class="ss-settings-card-head">
              <div>
                <span class="ss-settings-kicker">Destination</span>
                <h3>${escapeHtml(labelize(key))}</h3>
              </div>
              <span class="ss-chip ${destination.enabled === false ? "ss-chip-warning" : destination.enabled === true ? "ss-chip-success" : "ss-chip-muted"}">
                ${destination.enabled === false ? "Default off" : destination.enabled === true ? "Default on" : "Default unknown"}
              </span>
            </div>
            <dl class="ss-settings-detail-list">
              ${detailRow("Registered devices", formatCount(registered))}
              ${detailRow("Severity floor", destination.severity_minimum || "info")}
              ${detailRow("Backend default", destination.enabled === false ? "Disabled" : destination.enabled === true ? "Enabled" : "Unknown")}
            </dl>
          </article>
        `;
      })
      .join("");
  }

  function renderRoadmap() {
    if (!el.roadmapGrid) return;
    const cards = [
      buildScaffoldCard(
        "Provider credentials and secrets",
        "Deliberately excluded here until StreamSuites exposes a safe mutation contract. This page stays read-only instead of faking secret controls."
      ),
      buildScaffoldCard(
        "Per-guild Discord admin editing",
        "The earlier settings scaffold mixed exported Discord runtime data with dashboard-local draft edits. That was removed from Settings because it was not authoritative backend state."
      ),
      buildScaffoldCard(
        "Runtime restart actions",
        "Restart posture is visible here, but restart execution remains outside this page until a real admin action contract exists."
      )
    ];
    el.roadmapGrid.innerHTML = cards.join("");
  }

  function unwrapAlertSettings(payload) {
    if (!payload || typeof payload !== "object") return null;
    if (payload.settings && typeof payload.settings === "object") return payload.settings;
    return payload;
  }

  function renderPollingRows(value) {
    const rows = value && typeof value === "object"
      ? Object.entries(value)
          .map(([key, enabled]) => detailRow(labelize(key), formatBoolean(enabled)))
          .join("")
      : "";
    return rows || detailRow("Polling surfaces", "Unavailable");
  }

  function summarizeAuthPosture(auth) {
    if (!auth) return "Unavailable";
    if (auth.__authLocked) return "Session required";
    const flags = auth.flags || auth.controls || auth;
    const evaluated = [
      flags.disable_new_signups,
      flags.disable_email_verification,
      flags.disable_resend_verification
    ].filter((value) => value === true || value === false);
    const disabled = evaluated.filter((value) => value === true).length;
    if (!evaluated.length) return "Flags unavailable";
    return disabled > 0 ? `${disabled} restrictions active` : "Open posture";
  }

  function summarizeAlertPosture(alertsPayload) {
    const settings = unwrapAlertSettings(alertsPayload);
    if (!settings) return "Unavailable";
    const preferences = settings.preferences || {};
    if (!Object.keys(preferences).length) return "Preferences unavailable";
    if (preferences.master_enabled === false) return "Muted";
    if (preferences.quiet_hours_enabled === true) return "Quiet hours enabled";
    return "Delivering";
  }

  function buildMetricCard(label, value, note) {
    return `
      <article class="ss-settings-metric-card">
        <span class="ss-settings-kicker">${escapeHtml(label)}</span>
        <strong class="ss-settings-metric-value">${escapeHtml(displayValue(value))}</strong>
        <p class="muted">${escapeHtml(note || "")}</p>
      </article>
    `;
  }

  function buildDetailCard(kicker, title, rows, note = "") {
    return `
      <article class="ss-settings-detail-card">
        <div class="ss-settings-card-head">
          <div>
            <span class="ss-settings-kicker">${escapeHtml(kicker)}</span>
            <h3>${escapeHtml(title)}</h3>
          </div>
        </div>
        <dl class="ss-settings-detail-list">${rows}</dl>
        ${note ? `<p class="ss-settings-card-note muted">${note}</p>` : ""}
      </article>
    `;
  }

  function buildMiniCard(title, description, badges) {
    return `
      <article class="ss-settings-mini-card">
        <div class="ss-settings-card-head">
          <div>
            <h3>${escapeHtml(title)}</h3>
          </div>
        </div>
        <p class="muted">${escapeHtml(description)}</p>
        <div class="ss-settings-chip-row">${badges}</div>
      </article>
    `;
  }

  function buildScaffoldCard(title, description) {
    return `
      <article class="ss-settings-scaffold-card">
        <span class="ss-settings-kicker">Scaffold</span>
        <h3>${escapeHtml(title)}</h3>
        <p class="muted">${escapeHtml(description)}</p>
      </article>
    `;
  }

  function buildPendingChip(label, pending) {
    return badgeSpan(`${label}: ${pending === true ? "pending" : pending === false ? "clear" : "unknown"}`, pending === true ? "warning" : pending === false ? "success" : "muted");
  }

  function detailRow(label, value) {
    return `
      <div class="ss-settings-detail-row">
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(displayValue(value))}</dd>
      </div>
    `;
  }

  function detailFlagRow(label, value) {
    return `
      <div class="ss-settings-detail-row">
        <dt>${escapeHtml(label)}</dt>
        <dd>
          <span class="ss-settings-flag ${flagClassForValue(value)}">${escapeHtml(formatBoolean(value))}</span>
        </dd>
      </div>
    `;
  }

  function badgeSpan(label, tone = "muted") {
    return `<span class="ss-chip ${chipClassForTone(tone)}">${escapeHtml(label)}</span>`;
  }

  function chipClassForTone(tone) {
    if (tone === "success") return "ss-chip-success";
    if (tone === "warning") return "ss-chip-warning";
    if (tone === "info") return "ss-chip-muted";
    return "ss-chip-muted";
  }

  function setStatus(text) {
    setText(el.status, text || "Ready");
  }

  function setBanner(message, tone) {
    if (!el.banner) return;
    const text = String(message || "").trim();
    if (!text) {
      el.banner.textContent = "";
      el.banner.classList.add("hidden");
      el.banner.classList.remove("ss-alert-danger", "ss-alert-warning");
      return;
    }

    el.banner.textContent = text;
    el.banner.classList.remove("hidden");
    el.banner.classList.toggle("ss-alert-danger", tone === "danger");
    el.banner.classList.toggle("ss-alert-warning", tone !== "danger");
  }

  function setText(node, value) {
    if (node) node.textContent = displayValue(value);
  }

  function getSettledValue(result) {
    return result?.status === "fulfilled" ? result.value : null;
  }

  function getSettledError(result) {
    if (result?.status !== "rejected") return "";
    return result.reason?.message || String(result.reason || "Unable to load data.");
  }

  function formatTimestamp(value) {
    if (!value) return "";
    const formatted = window.StreamSuitesState?.formatTimestamp?.(value);
    if (formatted) return formatted;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(undefined, { hour12: false });
  }

  function formatVersion(info) {
    if (!info?.version) return "Unavailable";
    return window.Versioning?.formatDisplayVersion?.(info) || info.version;
  }

  function formatBoolean(value) {
    if (value === true) return "Enabled";
    if (value === false) return "Disabled";
    return "Unknown";
  }

  function formatFlagState(value, options = {}) {
    if (value !== true && value !== false) return "Unknown";
    if (options.inverted) {
      return value === true ? "Disabled" : "Enabled";
    }
    return value === true ? "Enabled" : "Disabled";
  }

  function formatCount(value) {
    return Number.isFinite(value) ? String(value) : "—";
  }

  function displayValue(value) {
    return value === null || value === undefined || value === "" ? "—" : String(value);
  }

  function flagClassForValue(value) {
    if (value === true) return "is-enabled";
    if (value === false) return "is-disabled";
    return "is-unknown";
  }

  function getPlatformIconPath(value) {
    const normalized = String(value || "").trim().toLowerCase();
    const iconMap = {
      discord: "/assets/icons/discord-0.svg",
      kick: "/assets/icons/kick-0.svg",
      pilled: "/assets/icons/pilled-0.svg",
      rumble: "/assets/icons/rumble-0.svg",
      twitch: "/assets/icons/twitch-0.svg",
      twitter: "/assets/icons/twitter-0.svg",
      youtube: "/assets/icons/youtube-0.svg"
    };
    return iconMap[normalized] || "/assets/icons/ui/widget.svg";
  }

  function labelize(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim() || "Unknown";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  window.SettingsView = {
    init,
    destroy
  };
})();

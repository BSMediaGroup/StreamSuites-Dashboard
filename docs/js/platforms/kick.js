(() => {
  "use strict";

  const PLATFORM = "kick";
  const REFRESH_INTERVAL = 6000;

  const el = {};
  let runtimeTimer = null;
  let runtimePollingLogged = false;
  let currentMode = null;
  let lastRuntimeSnapshot = null;
  let lastRuntimeSource = null;
  let modeListener = null;

  function cacheElements() {
    el.foundationStatus = document.getElementById("kick-foundation-status");
    el.runtimeBanner = document.getElementById("kick-runtime-banner");
    el.runtimeStatus = document.getElementById("kick-runtime-status");
    el.runtimeEnabled = document.getElementById("kick-runtime-enabled");
    el.runtimeUpdated = document.getElementById("kick-runtime-updated");
    el.runtimeError = document.getElementById("kick-runtime-error");
    el.runtimeMessages = document.getElementById("kick-runtime-messages");
    el.runtimeTriggers = document.getElementById("kick-runtime-triggers");
    el.liveStatusBanner = document.getElementById("kick-live-status-banner");
    el.liveStatusSummary = document.getElementById("kick-live-status-summary");
    el.liveStatusRows = document.getElementById("kick-live-status-rows");
    el.liveStatusEmpty = document.getElementById("kick-live-status-empty");
    el.liveStatusRaw = document.getElementById("kick-live-status-raw");
    el.liveStatusRefresh = document.getElementById("kick-live-status-refresh");
    el.liveStatusScan = document.getElementById("kick-live-status-scan");

    el.configEnabled = document.getElementById("kick-config-enabled");
    el.configChannel = document.getElementById("kick-config-channel");
    el.configBot = document.getElementById("kick-config-bot");
    el.configSource = document.getElementById("kick-config-source");
  }

  function setText(target, value) {
    if (!target) return;
    target.textContent = value;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function liveStatusTone(status) {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "live") return "ss-chip-success";
    if (normalized === "error" || normalized === "rate_limited") return "ss-chip-danger";
    if (normalized === "stale") return "ss-chip-warning";
    return "ss-chip-muted";
  }

  async function fetchLiveStatusDiagnostics() {
    return window.StreamSuitesApi?.apiFetch
      ? window.StreamSuitesApi.apiFetch("/api/admin/live-status/diagnostics?platform=kick", { forceRefresh: true, timeoutMs: 6000 })
      : null;
  }

  async function postKickLiveStatusScan() {
    return window.StreamSuitesApi?.apiFetch
      ? window.StreamSuitesApi.apiFetch("/api/admin/live-status/scan", {
        method: "POST",
        body: JSON.stringify({ platform: "kick" }),
        headers: { "Content-Type": "application/json" },
        forceRefresh: true,
        timeoutMs: 6000
      })
      : null;
  }

  function renderKickDiagnostics(payload) {
    const provider = payload?.providers?.kick || payload?.platforms?.kick || {};
    const rows = Array.isArray(payload?.targets?.kick) ? payload.targets.kick : [];
    if (el.liveStatusBanner) {
      el.liveStatusBanner.classList.remove("ss-alert-danger", "ss-alert-success");
      el.liveStatusBanner.classList.add(rows.length ? "ss-alert-success" : "ss-alert-warning");
      setText(el.liveStatusBanner, rows.length ? "Runtime/Auth Kick live-status diagnostics loaded." : "Runtime/Auth returned no Kick live-status targets.");
    }
    if (el.liveStatusSummary) {
      el.liveStatusSummary.innerHTML = `
        <span class="ss-chip ss-chip-info">TTL ${escapeHtml(provider.cache_ttl_seconds || provider.cadence_seconds || "60")}s</span>
        <span class="ss-chip ss-chip-muted">Targets ${escapeHtml(rows.length)}</span>
        <span class="ss-chip ss-chip-muted">Last refresh ${escapeHtml(formatTimestamp(provider.last_refresh_completed_at))}</span>
        ${provider.last_error ? `<span class="ss-chip ss-chip-danger">${escapeHtml(provider.last_error)}</span>` : ""}
      `;
    }
    if (el.liveStatusRows) {
      el.liveStatusRows.innerHTML = rows.map((row) => {
        const current = row.current || {};
        const ended = row.latest_ended_stream || {};
        const currentText = row.is_live
          ? `${current.title || "Live stream"}${current.viewer_count != null ? ` (${current.viewer_count})` : ""}`
          : "Offline";
        const recentText = row.recent_stream_count
          ? `${row.recent_stream_count} recent${ended.title ? ` · ${ended.title}` : ""}`
          : "0 recent";
        return `
          <tr>
            <td><strong>${escapeHtml(row.display_name || row.user_code || row.account_id)}</strong><br><span class="muted">${escapeHtml(row.channel_slug || row.channel_id || "No channel")}</span></td>
            <td><span class="ss-chip ${liveStatusTone(row.last_status)}">${escapeHtml(row.last_status || "unknown")}</span></td>
            <td>${escapeHtml(currentText)}${current.source_url ? `<br><a href="${escapeHtml(current.source_url)}" target="_blank" rel="noreferrer">source</a>` : ""}</td>
            <td>${escapeHtml(recentText)}</td>
            <td><span class="muted">checked ${escapeHtml(formatTimestamp(row.last_checked_at))}</span><br><span class="muted">next ${escapeHtml(formatTimestamp(row.next_allowed_check_at))}</span></td>
          </tr>
        `;
      }).join("");
    }
    el.liveStatusEmpty?.classList.toggle("hidden", rows.length > 0);
    if (el.liveStatusRaw) el.liveStatusRaw.textContent = JSON.stringify(payload || {}, null, 2);
    if (el.liveStatusScan) el.liveStatusScan.disabled = false;
  }

  async function hydrateLiveStatusDiagnostics() {
    if (!el.liveStatusBanner) return;
    setText(el.liveStatusBanner, "Loading Runtime/Auth live-status diagnostics...");
    try {
      const payload = await fetchLiveStatusDiagnostics();
      if (!payload) throw new Error("Dashboard API helper unavailable");
      renderKickDiagnostics(payload);
    } catch (err) {
      el.liveStatusBanner.classList.remove("ss-alert-success");
      el.liveStatusBanner.classList.add("ss-alert-danger");
      setText(el.liveStatusBanner, err?.message || "Live-status diagnostics endpoint unavailable.");
      if (el.liveStatusScan) el.liveStatusScan.disabled = true;
    }
  }

  async function runKickLiveStatusScan() {
    if (!el.liveStatusScan) return;
    el.liveStatusScan.disabled = true;
    try {
      const payload = await postKickLiveStatusScan();
      const result = payload?.result || payload?.status || "skipped";
      const suffix = payload?.next_allowed_check_at ? ` Next allowed ${formatTimestamp(payload.next_allowed_check_at)}.` : "";
      setText(el.liveStatusBanner, `Kick scan ${result}.${suffix}`);
      await hydrateLiveStatusDiagnostics();
    } catch (err) {
      el.liveStatusBanner.classList.add("ss-alert-danger");
      setText(el.liveStatusBanner, err?.message || "Kick scan request failed.");
    } finally {
      el.liveStatusScan.disabled = false;
    }
  }

  function formatTimestamp(value) {
    return (
      window.StreamSuitesState?.formatTimestamp?.(value) ||
      value ||
      "not reported"
    );
  }

  function getStorage() {
    if (
      typeof window.App === "object" &&
      window.App?.storage &&
      typeof window.App.storage.loadFromLocalStorage === "function"
    ) {
      return window.App.storage;
    }
    return null;
  }

  function describeEnabled(creators, platformConfig) {
    if (platformConfig && platformConfig.enabled === false) {
      return "disabled globally";
    }

    if (!Array.isArray(creators) || creators.length === 0) {
      return "disabled (no creators configured)";
    }

    const kickCreators = creators.filter((creator) => {
      const kick = creator?.platforms?.kick;
      return kick === true || kick?.enabled === true;
    });

    if (kickCreators.length === 0) {
      return "disabled (no Kick flags set)";
    }

    return `enabled for ${kickCreators.length} creator${kickCreators.length > 1 ? "s" : ""}`;
  }

  function describeChannel(creators, platformConfig) {
    if (platformConfig && platformConfig.enabled === false) {
      return "disabled globally";
    }

    if (!Array.isArray(creators) || creators.length === 0) {
      return "not configured";
    }

    const kickCreator = creators.find((creator) => {
      const kick = creator?.platforms?.kick;
      return kick === true || kick?.enabled === true;
    });

    if (!kickCreator) {
      return "not configured";
    }

    const kick = kickCreator.platforms?.kick || {};

    const channel =
      kick.channel ||
      kick.channel_login ||
      kickCreator.kick_channel ||
      kickCreator.kick_channel_login ||
      kickCreator.kick_username ||
      kickCreator.kick_user ||
      kickCreator.display_name;

    if (!channel) {
      return "not configured";
    }

    return channel;
  }

  function describeBot(creators) {
    if (!Array.isArray(creators) || creators.length === 0) return "not configured";

    const kickCreator = creators.find((creator) => {
      const kick = creator?.platforms?.kick;
      return kick === true || kick?.enabled === true;
    });

    if (!kickCreator) return "not configured";

    return (
      kickCreator.kick_bot ||
      kickCreator.kick_bot_name ||
      kickCreator.bot ||
      kickCreator.bot_name ||
      "not configured"
    );
  }

  async function loadCreatorsDraft() {
    try {
      return (
        (await window.ConfigState?.loadCreators?.()) ||
        []
      );
    } catch (err) {
      const storage = getStorage();
      const creators = storage?.loadFromLocalStorage?.("creators", []);
      return Array.isArray(creators) ? creators : [];
    }
  }

  async function hydrateConfig() {
    const creatorsArr = await loadCreatorsDraft();
    const platforms =
      (await window.ConfigState?.loadPlatforms?.()) || null;
    const platformConfig = platforms?.platforms?.kick;

    setText(el.configEnabled, describeEnabled(creatorsArr, platformConfig));
    setText(el.configChannel, describeChannel(creatorsArr, platformConfig));
    setText(el.configBot, describeBot(creatorsArr));
    setText(
      el.configSource,
      platformConfig && platformConfig.enabled === false
        ? "disabled globally"
        : creatorsArr.length > 0
          ? "local creators config"
          : "no creators loaded"
    );
  }

  function hydrateRuntimePlaceholder() {
    lastRuntimeSnapshot = null;
    lastRuntimeSource = null;
    setText(el.runtimeStatus, "awaiting snapshot");
    setText(el.runtimeEnabled, "unknown");
    setText(el.runtimeUpdated, "no runtime snapshot yet");
    setText(el.runtimeError, "not reported");
    setText(el.runtimeMessages, "—");
    setText(el.runtimeTriggers, "—");

    if (el.runtimeBanner) {
      el.runtimeBanner.classList.add("ss-alert-danger");
      el.runtimeBanner.classList.remove("hidden");
      setText(
        el.runtimeBanner,
        `Monitoring resumes as runtime snapshots arrive. This view stays read-only and mirrors runtime exports (${currentMode?.current || "static"} mode).`
      );
    }
  }

  function describeRuntimeStatus(entry) {
    if (!entry) return "not exported";
    if (entry.enabled === false) return "disabled";
    if (entry.paused) return "paused";
    return entry.status || entry.state || "unknown";
  }

  function selectPlatform(snapshot) {
    if (!snapshot || !snapshot.platforms) return null;
    if (Array.isArray(snapshot.platforms)) {
      return snapshot.platforms.find((p) => p.platform === PLATFORM || p.name === PLATFORM) || null;
    }
    return snapshot.platforms[PLATFORM] || null;
  }

  function resolveCounterValue(counters, keys) {
    for (const key of keys) {
      if (typeof counters[key] === "number") return counters[key];
    }
    return null;
  }

  function renderRuntime(snapshot, sourceLabel = "") {
    const normalized = window.StreamSuitesState?.normalizeRuntimeSnapshot?.(snapshot);
    if (!normalized) {
      hydrateRuntimePlaceholder();
      return;
    }

    const platform = selectPlatform(normalized);
    if (!platform) {
      hydrateRuntimePlaceholder();
      return;
    }

    const enabledState = platform.enabled;
    setText(
      el.runtimeEnabled,
      enabledState === true
        ? "ENABLED"
        : enabledState === false
          ? "DISABLED"
          : "NOT REPORTED"
    );

    const status = describeRuntimeStatus(platform);
    setText(el.runtimeStatus, status.toUpperCase());

    const updated = formatTimestamp(
      platform?.lastUpdate || platform?.heartbeat || normalized?.generatedAt
    );
    setText(el.runtimeUpdated, updated);

    setText(
      el.runtimeError,
      platform?.error || platform?.pausedReason || "none reported"
    );

    const counters = platform?.counters || {};
    const messages = resolveCounterValue(counters, [
      "messagesProcessed",
      "messages_processed",
      "messages"
    ]);
    const triggers = resolveCounterValue(counters, [
      "triggersFired",
      "triggers_fired",
      "triggers"
    ]);

    setText(
      el.runtimeMessages,
      Number.isFinite(messages) ? messages.toLocaleString() : "—"
    );
    setText(
      el.runtimeTriggers,
      Number.isFinite(triggers) ? triggers.toLocaleString() : "—"
    );

    const modeLabel = currentMode?.current || "static";
    const sourceNote = sourceLabel || window.App?.state?.runtimeSnapshot?.lastSource || "runtime export";

    if (el.runtimeBanner) {
      el.runtimeBanner.classList.remove("ss-alert-danger", "ss-alert-success");
      el.runtimeBanner.classList.add(
        status && status.toLowerCase() === "running" ? "ss-alert-success" : "ss-alert-warning"
      );
      setText(
        el.runtimeBanner,
        `Read-only preview sourced from runtime exports (${sourceNote}). Mode: ${modeLabel}.`
      );
    }
  }

  function lockControls() {
    const scope = document.getElementById("view-container");
    if (!scope) return;

    scope.querySelectorAll("input, select, textarea, button").forEach((node) => {
      if (node.id === "kick-live-status-refresh" || node.id === "kick-live-status-scan") return;
      node.disabled = true;
      node.setAttribute("aria-disabled", "true");
    });
  }

  async function hydrateRuntime() {
    if (window.__STREAMSUITES_RUNTIME_OFFLINE__) {
      hydrateRuntimePlaceholder();
      return;
    }

    const runtimeState = window.App?.state?.runtimeSnapshot;

    if (runtimeState?.fetchOnce && !runtimeState.getSnapshot?.()) {
      await runtimeState.fetchOnce();
    }

    let snapshot = runtimeState?.getSnapshot?.();
    let sourceLabel = runtimeState?.lastSource || "";

    if (!snapshot || !snapshot.platforms) {
      try {
        snapshot = await window.StreamSuitesState?.loadRuntimeSnapshot?.({ forceReload: true });
        sourceLabel = sourceLabel || "data/runtime_snapshot.json";
      } catch (err) {
        console.warn("[KickView] Runtime snapshot load failed", err);
      }
    }

    if (!snapshot || !snapshot.platforms) {
      hydrateRuntimePlaceholder();
      return;
    }

    lastRuntimeSnapshot = snapshot;
    lastRuntimeSource = sourceLabel || null;
    renderRuntime(snapshot, sourceLabel);
  }

  function startRuntimePolling() {
    if (window.__STREAMSUITES_RUNTIME_OFFLINE__) {
      hydrateRuntimePlaceholder();
      return;
    }

    if (window.__RUNTIME_AVAILABLE__ !== true) {
      if (!runtimePollingLogged) {
        console.info("[Dashboard] Runtime unavailable. Polling disabled.");
        runtimePollingLogged = true;
      }
      return;
    }
    hydrateRuntime();
    runtimeTimer = setInterval(hydrateRuntime, REFRESH_INTERVAL);
  }

  function setFoundationStatus() {
    if (!el.foundationStatus) return;
    el.foundationStatus.classList.remove("idle");
    el.foundationStatus.classList.add("active");
    el.foundationStatus.textContent = "● Kick integration: Scaffold";
  }

  function onModeChange(modeState) {
    currentMode = modeState || currentMode;
    if (lastRuntimeSnapshot) {
      renderRuntime(lastRuntimeSnapshot, lastRuntimeSource);
    } else {
      hydrateRuntimePlaceholder();
    }
  }

  function init(modeState) {
    cacheElements();
    currentMode = modeState || window.App?.mode || { current: "static", reason: "static-first default" };
    setFoundationStatus();
    lockControls();
    if (!modeListener) {
      modeListener = (event) => onModeChange(event.detail);
      window.addEventListener("streamsuites:modechange", modeListener);
    }
    el.liveStatusRefresh?.addEventListener("click", hydrateLiveStatusDiagnostics);
    el.liveStatusScan?.addEventListener("click", runKickLiveStatusScan);

    setTimeout(() => {
      (async () => {
        await hydrateConfig();
        await hydrateLiveStatusDiagnostics();
        hydrateRuntimePlaceholder();
        startRuntimePolling();
      })();
    }, 0);
  }

  function destroy() {
    if (runtimeTimer) {
      clearInterval(runtimeTimer);
      runtimeTimer = null;
    }

    if (modeListener) {
      window.removeEventListener("streamsuites:modechange", modeListener);
      modeListener = null;
    }
  }

  window.KickView = {
    init,
    destroy,
    onModeChange
  };
})();

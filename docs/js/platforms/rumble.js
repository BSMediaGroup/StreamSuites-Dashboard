(() => {
  "use strict";

  const PLATFORM = "rumble";
  const REFRESH_INTERVAL = 8000;
  const BOTS_STATUS_ENDPOINT = "/api/admin/bots/status";
  const CREATOR_SUMMARY_ENDPOINT = "/api/admin/creator-integrations";

  const el = {};
  let runtimeTimer = null;
  let intelligenceAbortController = null;
  let selectorsHydrated = false;

  const state = {
    creators: [],
    filteredCreators: [],
    selectedAccountId: "",
    selectedStreamKey: "",
    intelligenceDetail: null,
    rawDebugExpanded: true,
  };

  function cacheElements() {
    el.foundationStatus = document.getElementById("rumble-foundation-status");
    el.runtimeBanner = document.getElementById("rumble-runtime-banner");
    el.runtimeStatus = document.getElementById("rumble-runtime-status");
    el.runtimeUpdated = document.getElementById("rumble-runtime-updated");
    el.runtimeError = document.getElementById("rumble-runtime-error");
    el.runtimeMessages = document.getElementById("rumble-runtime-messages");
    el.runtimeTriggers = document.getElementById("rumble-runtime-triggers");
    el.runtimeBlocked = document.getElementById("rumble-runtime-blocked");
    el.runtimeManual = document.getElementById("rumble-runtime-manual");
    el.serviceToggle = document.querySelector('input[data-service="rumble"]');
    el.intelligenceBanner = document.getElementById("rumble-intelligence-banner");
    el.searchInput = document.getElementById("rumble-intelligence-search");
    el.creatorSelect = document.getElementById("rumble-intelligence-creator-select");
    el.creatorEmpty = document.getElementById("rumble-intelligence-creator-empty");
    el.creatorSummary = document.getElementById("rumble-intelligence-creator-summary");
    el.streamSelect = document.getElementById("rumble-intelligence-stream-select");
    el.historyState = document.getElementById("rumble-intelligence-history-state");
    el.meta = document.getElementById("rumble-intelligence-meta");
    el.postureChip = document.getElementById("rumble-intelligence-posture-chip");
    el.chart = document.getElementById("rumble-intelligence-chart");
    el.chartEmpty = document.getElementById("rumble-intelligence-chart-empty");
    el.diagnostics = document.getElementById("rumble-intelligence-diagnostics");
    el.rawShell = document.getElementById("rumble-intelligence-raw-shell");
    el.rawOutput = document.getElementById("rumble-intelligence-raw-output");
    el.rawCopy = document.getElementById("rumble-intelligence-raw-copy");
    el.rawToggle = document.getElementById("rumble-intelligence-raw-toggle");
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

  async function requestJson(path, options = {}) {
    const response = await fetch(buildApiUrl(path), {
      cache: "no-store",
      credentials: "include",
      signal: options.signal,
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await readJsonSafe(response);
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
    }
    return payload || {};
  }

  function setText(target, value) {
    if (!target) return;
    target.textContent = value;
  }

  function setHtml(target, value) {
    if (!target) return;
    target.innerHTML = value;
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

  function formatTimestamp(value) {
    return window.StreamSuitesState?.formatTimestamp?.(value) || value || "—";
  }

  function formatLabel(value) {
    const text = String(value || "").trim();
    if (!text) return "Unavailable";
    return text
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatJson(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (_err) {
      return "{}";
    }
  }

  function formatBoolean(value) {
    if (value === true) return "Yes";
    if (value === false) return "No";
    return "Unavailable";
  }

  function renderKeyValueRows(rows) {
    const items = rows.filter((row) => row && row.label);
    if (!items.length) {
      return '<div class="ss-empty-state" style="margin-top:0;">No runtime detail exported for this section.</div>';
    }
    return `<dl class="ss-rumble-intelligence-kv">${items
      .map(
        (row) => `
          <div class="ss-rumble-intelligence-kv-row">
            <dt>${escapeHtml(row.label)}</dt>
            <dd>${row.html ?? escapeHtml(row.value ?? "Unavailable")}</dd>
          </div>
        `
      )
      .join("")}</dl>`;
  }

  function requestLabel(item) {
    const stage = formatLabel(item?.stage || "request");
    const status = item?.status_code ? `HTTP ${item.status_code}` : item?.error ? "Error" : "Pending";
    return `${stage} • ${status}`;
  }

  function buildTimeline(runtimeDebug) {
    const diagnostics = runtimeDebug?.discovery_diagnostics || {};
    const browse = Array.isArray(diagnostics?.browse_live?.requests) ? diagnostics.browse_live.requests : [];
    const creatorProbe = Array.isArray(diagnostics?.creator_channel_probe?.request_sequence)
      ? diagnostics.creator_channel_probe.request_sequence
      : [];
    const watchResolution = diagnostics?.watch_resolution && typeof diagnostics.watch_resolution === "object"
      ? diagnostics.watch_resolution
      : {};
    const sampleChain = watchResolution?.sample_proof_chain && typeof watchResolution.sample_proof_chain === "object"
      ? watchResolution.sample_proof_chain
      : {};
    const sampleChatStream = sampleChain?.chat_stream && typeof sampleChain.chat_stream === "object"
      ? [sampleChain.chat_stream]
      : [];
    const watchChain = ["watch_page", "autoplay", "embed", "watching_now"]
      .map((key) => watchResolution?.[key])
      .filter((item) => item && typeof item === "object");

    return [...browse, ...creatorProbe, ...sampleChatStream, ...watchChain].filter(Boolean);
  }

  function chipClassForTone(tone) {
    if (tone === "success") return "ss-chip-success";
    if (tone === "warning") return "ss-chip-warning";
    if (tone === "danger") return "ss-chip-danger";
    if (tone === "info") return "ss-chip-info";
    return "ss-chip-muted";
  }

  function toneForPosture(status) {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "live" || normalized === "connected" || normalized === "attach_ready") return "success";
    if (normalized === "offline" || normalized === "awaiting_live_stream" || normalized === "blocked") return "warning";
    if (normalized === "error" || normalized === "live_target_unresolved" || normalized === "attach_identity_incomplete") {
      return "danger";
    }
    return "muted";
  }

  function normalizePlatformRow(payload) {
    const rows = Array.isArray(payload?.platforms) ? payload.platforms : [];
    return rows.find((item) => String(item?.platform || "").trim().toLowerCase() === PLATFORM) || null;
  }

  function normalizeRumbleBots(payload) {
    return (Array.isArray(payload?.bots) ? payload.bots : []).filter(
      (item) => String(item?.platform || "").trim().toLowerCase() === PLATFORM
    );
  }

  function selectedCreator() {
    return state.filteredCreators.find((item) => item.account_id === state.selectedAccountId)
      || state.creators.find((item) => item.account_id === state.selectedAccountId)
      || null;
  }

  function selectedStream() {
    const streams = Array.isArray(state.intelligenceDetail?.streams) ? state.intelligenceDetail.streams : [];
    return streams.find((item) => item.key === state.selectedStreamKey) || streams[0] || null;
  }

  function describeStatus(platformRow) {
    const status = String(platformRow?.global_status || platformRow?.status || "").trim().toLowerCase();
    switch (status) {
      case "connected":
        return "Enabled / connected";
      case "paused":
        return "Manually paused";
      case "ready":
        return "Enabled / ready";
      case "not_configured":
        return "Runtime not configured";
      case "staged":
        return "Staged";
      case "error":
        return "Runtime error";
      default:
        return status ? status.replace(/_/g, " ") : "Unknown";
    }
  }

  function bannerTone(platformRow) {
    const status = String(platformRow?.global_status || platformRow?.status || "").trim().toLowerCase();
    if (status === "connected" || status === "ready") return "success";
    if (status === "paused") return "warning";
    return "danger";
  }

  function bannerCopy(platformRow, bots) {
    const details = platformRow?.details && typeof platformRow.details === "object" ? platformRow.details : {};
    const blockedCount = Number(details.bot_blocked_count || 0);
    const pendingCount = Number(details.bot_desired_count || 0);
    const connectedCount = Number(details.bot_online_count || 0);
    const manualOverrideCount = Number(details.manual_override_count || 0);
    const sessionStatus = String(platformRow?.session_status || details.session_status || "").trim().toLowerCase();
    const detail = String(platformRow?.error || platformRow?.paused_reason || "").trim();

    switch (String(platformRow?.global_status || platformRow?.status || "").trim().toLowerCase()) {
      case "connected":
        if (sessionStatus === "blocked" && blockedCount > 0) {
          return detail || `${blockedCount} creator-managed Rumble session${blockedCount === 1 ? "" : "s"} is blocked, while the platform remains globally enabled.`;
        }
        if (sessionStatus === "managed_pending" && pendingCount > 0) {
          return `${pendingCount} creator-managed Rumble session${pendingCount === 1 ? "" : "s"} is still attaching while the platform remains globally enabled.`;
        }
        return `${connectedCount} Rumble session${connectedCount === 1 ? "" : "s"} is currently connected in the runtime.`;
      case "paused":
        return detail || "Rumble is manually paused by runtime control.";
      case "ready":
        if (sessionStatus === "blocked" && blockedCount > 0) {
          return detail || `${blockedCount} creator-managed Rumble session${blockedCount === 1 ? "" : "s"} is blocked by creator-level prerequisites, but the platform remains globally enabled.`;
        }
        if (sessionStatus === "managed_pending" && pendingCount > 0) {
          return `${pendingCount} creator-managed Rumble session${pendingCount === 1 ? "" : "s"} is waiting for attachment while the platform remains globally enabled.`;
        }
        return bots.length
          ? "Rumble is runtime-enabled with no active connected session right now."
          : "Rumble is runtime-enabled and ready for testing.";
      case "not_configured":
        return detail || "Runtime prerequisites for Rumble are not fully configured.";
      case "error":
        return detail || "Runtime reported an error while evaluating Rumble posture.";
      default:
        return detail || "Rumble posture is being read from the runtime bot-status contract.";
    }
  }

  function renderPayload(payload) {
    const platformRow = normalizePlatformRow(payload);
    const bots = normalizeRumbleBots(payload);
    const details = platformRow?.details && typeof platformRow.details === "object" ? platformRow.details : {};
    const managedCount = bots.filter((item) => String(item?.session_type || "").trim().toLowerCase() !== "manual").length;
    const manualCount = bots.length - managedCount;
    const connectedCount = bots.filter((item) =>
      ["online", "running", "attached", "listening"].includes(String(item?.status || "").trim().toLowerCase())
    ).length;
    const pendingCount = Number(details.bot_desired_count || 0);
    const blockedCount = Number(details.bot_blocked_count || 0);
    const pausedCount = Number(details.bot_paused_count || 0);
    const manualOverrideCount = Number(details.manual_override_count || 0);
    const enabled = platformRow?.implemented === true && platformRow?.staged !== true && platformRow?.runtime_ready !== false;

    if (el.serviceToggle instanceof HTMLInputElement) {
      el.serviceToggle.checked = enabled;
    }
    setText(el.runtimeStatus, describeStatus(platformRow));
    setText(el.runtimeUpdated, formatTimestamp(payload?.server_generated_at || payload?.generated_at));
    setText(
      el.runtimeError,
      platformRow?.error || platformRow?.paused_reason || platformRow?.disabled_reason || "No blocking detail exported."
    );
    setText(el.runtimeMessages, `${managedCount} / ${manualCount}`);
    setText(el.runtimeTriggers, `${connectedCount} / ${pendingCount}`);
    setText(el.runtimeBlocked, `${blockedCount} / ${pausedCount}`);
    setText(el.runtimeManual, String(manualOverrideCount));

    if (el.runtimeBanner) {
      el.runtimeBanner.classList.remove("ss-alert-success", "ss-alert-warning", "ss-alert-danger");
      el.runtimeBanner.classList.add(`ss-alert-${bannerTone(platformRow)}`);
      setText(el.runtimeBanner, bannerCopy(platformRow, bots));
    }

    if (el.foundationStatus) {
      const statusText = describeStatus(platformRow);
      el.foundationStatus.classList.remove("idle");
      el.foundationStatus.classList.add("active");
      el.foundationStatus.textContent = `● Rumble runtime: ${statusText}`;
    }
  }

  function setIntelligenceBanner(message, tone) {
    if (!el.intelligenceBanner) return;
    el.intelligenceBanner.classList.remove("ss-alert-success", "ss-alert-warning", "ss-alert-danger");
    if (tone === "success") el.intelligenceBanner.classList.add("ss-alert-success");
    else if (tone === "danger") el.intelligenceBanner.classList.add("ss-alert-danger");
    else el.intelligenceBanner.classList.add("ss-alert-warning");
    setText(el.intelligenceBanner, message);
  }

  function buildCreatorList(summaryPayload, botsPayload) {
    const summaryItems = Array.isArray(summaryPayload?.items) ? summaryPayload.items : [];
    const summaryByUserCode = new Map();
    summaryItems.forEach((item) => {
      const userCode = String(item?.user_code || "").trim();
      if (userCode) summaryByUserCode.set(userCode, item);
    });

    return normalizeRumbleBots(botsPayload)
      .map((bot) => {
        const userCode = String(bot?.creator_id || "").trim();
        const summary = summaryByUserCode.get(userCode) || {};
        const target = bot?.resolved_target && typeof bot.resolved_target === "object" ? bot.resolved_target : {};
        const displayName = String(summary?.display_name || userCode || "Unknown creator").trim() || "Unknown creator";
        const accountId = String(summary?.account_id || "").trim();
        const channelHandle = String(target?.channel_handle || "").trim();
        const channelSlug = String(target?.channel_slug || "").trim();
        const channelUrl = String(target?.channel_url || "").trim();
        const activeTarget = String(bot?.active_target || target?.watch_url || "").trim();
        return {
          account_id: accountId,
          user_code: userCode,
          display_name: displayName,
          readiness_label: String(summary?.readiness_label || bot?.status || "").trim() || "Unknown",
          status: String(bot?.status || "").trim() || "unknown",
          session_id: String(bot?.session_id || "").trim() || null,
          channel_handle: channelHandle || null,
          channel_slug: channelSlug || null,
          channel_url: channelUrl || null,
          active_target: activeTarget || null,
          last_evaluated_at: bot?.last_evaluated_at || null,
          search_blob: [
            displayName,
            userCode,
            channelHandle,
            channelSlug,
            channelUrl,
            activeTarget,
          ].join(" ").toLowerCase(),
        };
      })
      .filter((item) => item.account_id)
      .sort((left, right) => left.display_name.localeCompare(right.display_name));
  }

  function filterCreators() {
    const query = String(el.searchInput?.value || "").trim().toLowerCase();
    state.filteredCreators = !query
      ? state.creators.slice()
      : state.creators.filter((item) => item.search_blob.includes(query));
    if (!state.filteredCreators.some((item) => item.account_id === state.selectedAccountId)) {
      state.selectedAccountId = state.filteredCreators[0]?.account_id || "";
    }
    renderCreatorOptions();
  }

  function renderCreatorOptions() {
    if (!(el.creatorSelect instanceof HTMLSelectElement)) return;
    const items = state.filteredCreators;
    el.creatorSelect.innerHTML = items
      .map((item) => {
        const channelLabel = item.channel_handle || item.channel_slug || "Rumble";
        return `<option value="${escapeHtml(item.account_id)}">${escapeHtml(`${item.display_name} • ${channelLabel}`)}</option>`;
      })
      .join("");
    el.creatorSelect.disabled = items.length === 0;
    if (items.length && state.selectedAccountId) {
      el.creatorSelect.value = state.selectedAccountId;
    }
    if (el.creatorEmpty) {
      el.creatorEmpty.classList.toggle("hidden", items.length !== 0);
    }
    renderCreatorSummary();
  }

  function renderCreatorSummary() {
    const creator = selectedCreator();
    if (!el.creatorSummary) return;
    if (!creator) {
      setHtml(el.creatorSummary, "");
      return;
    }
    setHtml(
      el.creatorSummary,
      [
        `<span class="ss-chip">Creator: ${escapeHtml(creator.display_name)}</span>`,
        `<span class="ss-chip">User code: ${escapeHtml(creator.user_code)}</span>`,
        `<span class="ss-chip">Channel: ${escapeHtml(creator.channel_handle || creator.channel_slug || "Unresolved")}</span>`,
        `<span class="ss-chip ${chipClassForTone(toneForPosture(creator.status))}">${escapeHtml(formatLabel(creator.status))}</span>`,
      ].join("")
    );
  }

  function normalizeDetailPayload(payload) {
    const integrations = Array.isArray(payload?.integrations) ? payload.integrations : [];
    const rumble = integrations.find((item) => String(item?.platform_key || "").trim().toLowerCase() === PLATFORM) || null;
    const botAuto = rumble?.bot_auto_deploy && typeof rumble.bot_auto_deploy === "object" ? rumble.bot_auto_deploy : {};
    const managed = rumble?.managed_session && typeof rumble.managed_session === "object" ? rumble.managed_session : {};
    const managedTarget = managed?.resolved_target && typeof managed.resolved_target === "object" ? managed.resolved_target : {};
    const dispatch = rumble?.managed_dispatch && typeof rumble.managed_dispatch === "object" ? rumble.managed_dispatch : {};
    const runtimeDebug = rumble?.runtime_debug && typeof rumble.runtime_debug === "object" ? rumble.runtime_debug : null;
    const watchUrl =
      String(managedTarget.watch_url || botAuto.resolved_watch_url || botAuto.resolved_live_target_url || "").trim() || null;
    const videoId = String(managedTarget.video_id || botAuto.resolved_video_id || "").trim() || null;
    const chatId = String(managedTarget.chat_id || botAuto.resolved_chat_id || "").trim() || null;
    const streamIdentity = String(managedTarget.stream_identity || botAuto.resolved_stream_identity || "").trim() || null;
    const channelUrl =
      String(managedTarget.channel_url || botAuto.resolved_channel_url || rumble?.public_url || "").trim() || null;
    const channelHandle = String(botAuto.resolved_channel_handle || rumble?.channel_handle || "").trim() || null;
    const hasCurrentSnapshot = Boolean(
      watchUrl
      || videoId
      || chatId
      || streamIdentity
      || botAuto.live_status === "live"
      || managed.lifecycle_state
    );

    const streams = hasCurrentSnapshot
      ? [
          {
            key: String(managed.session_id || streamIdentity || videoId || watchUrl || "current-runtime-snapshot"),
            label:
              botAuto.live_status === "live"
                ? "Current runtime live snapshot"
                : "Current runtime stream posture",
            posture: botAuto.live_status || managed.lifecycle_state || "unknown",
            live_truth_source: botAuto.live_truth_source || "none",
            watch_url: watchUrl,
            channel_url: channelUrl,
            channel_handle: channelHandle,
            video_id: videoId,
            chat_id: chatId,
            stream_identity: streamIdentity,
            stream_title: null,
            viewer_count: null,
            chat_count: null,
            unique_chatters: null,
            metrics_available: {
              live_viewers: false,
              chat_count: false,
              unique_chatters: false,
            },
            points: [],
            last_sample_at:
              managed.last_transport_heartbeat_at
              || managed.last_evaluated_at
              || botAuto.last_live_status_checked_at
              || payload?.generated_at
              || null,
          },
        ]
      : [];

    return {
      generated_at: payload?.generated_at || null,
      account: payload?.account || {},
      rumble,
      botAuto,
      managed,
      dispatch,
      runtimeDebug,
      streams,
      history_available: false,
    };
  }

  function populateStreamOptions() {
    if (!(el.streamSelect instanceof HTMLSelectElement)) return;
    const streams = Array.isArray(state.intelligenceDetail?.streams) ? state.intelligenceDetail.streams : [];
    if (!streams.length) {
      el.streamSelect.innerHTML = '<option value="">No exported stream history</option>';
      el.streamSelect.disabled = true;
      state.selectedStreamKey = "";
      return;
    }
    el.streamSelect.disabled = false;
    el.streamSelect.innerHTML = streams
      .map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`)
      .join("");
    if (!streams.some((item) => item.key === state.selectedStreamKey)) {
      state.selectedStreamKey = streams[0].key;
    }
    el.streamSelect.value = state.selectedStreamKey;
  }

  function renderHistoryState() {
    const creator = selectedCreator();
    const stream = selectedStream();
    if (!el.historyState) return;
    if (!creator) {
      setText(el.historyState, "Select a creator to inspect current runtime posture and any exported stream history.");
      return;
    }
    if (!stream) {
      setText(
        el.historyState,
        "No historical Rumble engagement snapshots exported yet. Live discovery is available when runtime can resolve a stream, but time-series analytics are not currently stored."
      );
      return;
    }
    setText(
      el.historyState,
      "Current runtime snapshot is available. Historical Rumble engagement analytics have not been exported yet, so the selector is limited to current posture."
    );
  }

  function renderMetaGrid() {
    const creator = selectedCreator();
    const stream = selectedStream();
    if (!el.meta) return;
    if (!creator) {
      setHtml(el.meta, '<div class="ss-empty-state" style="margin-top:0;">Select a creator or channel to inspect Rumble intelligence.</div>');
      return;
    }

    const detail = state.intelligenceDetail || {};
    const botAuto = detail.botAuto || {};
    const managed = detail.managed || {};
    const dispatchSummary = detail.dispatch?.summary && typeof detail.dispatch.summary === "object" ? detail.dispatch.summary : {};
    const posture = stream?.posture || botAuto.decision_state || creator.status || "unknown";
    const liveVsHistory = stream ? (botAuto.live_status === "live" ? "Current live snapshot" : "Current runtime posture") : "No stream snapshot";
    const cards = [
      { label: "Creator", value: escapeHtml(creator.display_name) },
      { label: "Channel", value: escapeHtml(stream?.channel_handle || creator.channel_handle || creator.channel_slug || "Unavailable") },
      {
        label: "Watch URL",
        value: stream?.watch_url
          ? `<a href="${escapeHtml(stream.watch_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(stream.watch_url)}</a>`
          : "Unavailable",
      },
      { label: "Detected Video ID", value: escapeHtml(stream?.video_id || "Unavailable") },
      { label: "Chat ID", value: escapeHtml(stream?.chat_id || "Unavailable") },
      { label: "Stream Title", value: escapeHtml(stream?.stream_title || "Unavailable in current runtime export") },
      { label: "Last Sample Timestamp", value: escapeHtml(formatTimestamp(stream?.last_sample_at || botAuto.last_live_status_checked_at)) },
      { label: "Posture", value: escapeHtml(`${formatLabel(posture)} • ${liveVsHistory}`) },
      { label: "Live Truth Source", value: escapeHtml(formatLabel(stream?.live_truth_source || botAuto.live_truth_source || "none")) },
      { label: "Managed Session", value: escapeHtml(formatLabel(managed.lifecycle_state || "unavailable")) },
      {
        label: "Dispatch History",
        value: escapeHtml(
          dispatchSummary.count
            ? `${dispatchSummary.count} exported item${dispatchSummary.count === 1 ? "" : "s"}`
            : "No recent managed dispatch export"
        ),
      },
      { label: "Readiness", value: escapeHtml(creator.readiness_label || "Unknown") },
    ];
    setHtml(
      el.meta,
      cards
        .map(
          (card) => `
            <article class="ss-rumble-intelligence-meta-card">
              <span class="label">${card.label}</span>
              <strong>${card.value}</strong>
            </article>
          `
        )
        .join("")
    );
  }

  function renderDiagnostics() {
    const creator = selectedCreator();
    if (!el.diagnostics) return;
    if (!creator || !state.intelligenceDetail) {
      setHtml(el.diagnostics, 'Runtime discovery, detection, and stream metadata will appear here after a creator is selected.');
      if (el.rawShell) el.rawShell.classList.add("hidden");
      return;
    }
    const detail = state.intelligenceDetail || {};
    const botAuto = detail.botAuto || {};
    const runtimeDebug = detail.runtimeDebug || null;
    if (!runtimeDebug) {
      setHtml(el.diagnostics, '<div class="ss-empty-state" style="margin-top:0;">No runtime-backed debug object is currently exported for the selected creator.</div>');
      if (el.rawShell) el.rawShell.classList.add("hidden");
      return;
    }

    const discovery = runtimeDebug.matched_discovery_entry || {};
    const discoveryDiagnostics = runtimeDebug.discovery_diagnostics || {};
    const creatorProbe = discoveryDiagnostics.creator_channel_probe || {};
    const watchResolution = discoveryDiagnostics.watch_resolution || {};
    const managed = runtimeDebug.managed_session || {};
    const timeline = buildTimeline(runtimeDebug);
    const selectedIdentity = runtimeDebug.authoritative_identity || {};
    const rawOutput = formatJson(runtimeDebug);
    const debugCards = [
      {
        title: "Detection Summary",
        body: renderKeyValueRows([
          { label: "Decision state", value: formatLabel(botAuto.decision_state || runtimeDebug.decision?.decision_state) },
          { label: "Live status", value: formatLabel(botAuto.live_status || runtimeDebug.decision?.live_status) },
          { label: "Truth source", value: formatLabel(botAuto.live_truth_source || runtimeDebug.decision?.live_truth_source) },
          { label: "Resolved watch URL", html: botAuto.resolved_watch_url ? `<code>${escapeHtml(botAuto.resolved_watch_url)}</code>` : "Unavailable" },
          { label: "Resolved video ID", value: botAuto.resolved_video_id || "Unavailable" },
          { label: "Resolved chat ID", value: botAuto.resolved_chat_id || "Unavailable" },
        ]),
      },
      {
        title: "Selected Identity",
        body: renderKeyValueRows([
          { label: "Identity source", value: formatLabel(selectedIdentity.source) },
          { label: "Normalized creator keys", html: `<code>${escapeHtml((selectedIdentity.normalized_inputs?.creator_keys || []).join(", ") || "Unavailable")}</code>` },
          { label: "Selected URLs", html: `<code>${escapeHtml((selectedIdentity.normalized_inputs?.urls || []).join(", ") || "Unavailable")}</code>` },
          { label: "Selected slugs", html: `<code>${escapeHtml((selectedIdentity.normalized_inputs?.slugs || []).join(", ") || "Unavailable")}</code>` },
          { label: "Ignored identities", value: String((selectedIdentity.ignored_identities || []).length || 0) },
        ]),
      },
      {
        title: "Live Tile Match",
        body: renderKeyValueRows([
          { label: "Browse live rows found", value: String(discoveryDiagnostics.browse_live?.live_tiles_found ?? "0") },
          { label: "Matched Daniel row", value: formatBoolean(discoveryDiagnostics.browse_live?.matched_live_row_found) },
          { label: "Matched row count", value: String(discoveryDiagnostics.browse_live?.matched_live_row_count ?? 0) },
          { label: "Selected match", html: discoveryDiagnostics.browse_live?.selected_match?.watch_url ? `<code>${escapeHtml(discoveryDiagnostics.browse_live.selected_match.watch_url)}</code>` : "Unavailable" },
        ]),
      },
      {
        title: "Watch Target Resolution",
        body: renderKeyValueRows([
          { label: "Resolution source", value: formatLabel(discoveryDiagnostics.decision_summary?.resolution_source || creatorProbe.resolution_source) },
          { label: "Resolved watch target", html: watchResolution.resolved_watch_target ? `<code>${escapeHtml(watchResolution.resolved_watch_target)}</code>` : "Unavailable" },
          { label: "Resolved numeric video ID", value: watchResolution.resolved_numeric_video_id || discovery.numeric_video_id || "Unavailable" },
          { label: "Attach identity ready", value: formatBoolean(watchResolution.attach_identity_ready ?? runtimeDebug.decision?.attach_identity_ready) },
          { label: "Rejected evidence", value: String((creatorProbe.rejected_evidence || discoveryDiagnostics.rejected_evidence || []).length || 0) },
        ]),
      },
      {
        title: "Chat Stream Resolution",
        body: renderKeyValueRows([
          { label: "Chat ID", value: watchResolution.resolved_chat_id || runtimeDebug.decision?.resolved_chat_id || "Unavailable" },
          { label: "Sample chat init", value: formatBoolean(watchResolution.sample_proof_chain?.chat_init_received) },
          { label: "Chat request URL", html: watchResolution.sample_proof_chain?.chat_stream?.url ? `<code>${escapeHtml(watchResolution.sample_proof_chain.chat_stream.url)}</code>` : "Unavailable" },
          { label: "Chat request status", value: watchResolution.sample_proof_chain?.chat_stream?.status_code ? `HTTP ${watchResolution.sample_proof_chain.chat_stream.status_code}` : watchResolution.sample_proof_chain?.chat_stream?.error || "Unavailable" },
        ]),
      },
      {
        title: "Blocking / Stop Reason",
        body: renderKeyValueRows([
          { label: "Blocking reason", value: formatLabel(botAuto.blocking_reason || runtimeDebug.decision?.blocking_reason) },
          { label: "Blocking category", value: formatLabel(botAuto.blocking_reason_category || runtimeDebug.decision?.blocking_reason_category) },
          { label: "Stop stage", value: formatLabel(discovery.stop_stage || creatorProbe.stop_stage) },
          { label: "Stop reason", value: formatLabel(discovery.stop_reason || creatorProbe.stop_reason) },
          { label: "Stop detail", value: discovery.stop_detail || creatorProbe.stop_detail || botAuto.blocking_reason_detail || "Unavailable" },
        ]),
      },
      {
        title: "Managed Session / Attach Readiness",
        body: renderKeyValueRows([
          { label: "Managed session state", value: formatLabel(managed.lifecycle_state) },
          { label: "Desired", value: formatBoolean(managed.desired) },
          { label: "Eligible", value: formatBoolean(managed.eligible) },
          { label: "Attach readiness", value: formatBoolean(runtimeDebug.decision?.attach_identity_ready) },
          { label: "Resolved target", html: managed.resolved_target?.watch_url ? `<code>${escapeHtml(managed.resolved_target.watch_url)}</code>` : "Unavailable" },
        ]),
      },
      {
        title: "Freshness / Timestamps",
        body: renderKeyValueRows([
          { label: "Debug generated", value: formatTimestamp(runtimeDebug.generated_at) },
          { label: "Discovery export", value: formatTimestamp(runtimeDebug.source_exports?.discovery_generated_at) },
          { label: "Discovery scan completed", value: formatTimestamp(runtimeDebug.source_exports?.discovery_scan_completed_at) },
          { label: "Live status export", value: formatTimestamp(runtimeDebug.source_exports?.live_status_generated_at) },
          { label: "Last live status checked", value: formatTimestamp(runtimeDebug.decision?.last_live_status_checked_at) },
        ]),
      },
    ];

    setHtml(
      el.diagnostics,
      `
        <div class="ss-rumble-intelligence-debug-grid">
          ${debugCards
            .map(
              (card) => `
                <article class="ss-rumble-intelligence-debug-card">
                  <h4>${escapeHtml(card.title)}</h4>
                  ${card.body}
                </article>
              `
            )
            .join("")}
        </div>
        <section class="ss-rumble-intelligence-debug-card">
          <h4>Request Chain / Stage Timeline</h4>
          ${
            timeline.length
              ? `<ol class="ss-rumble-intelligence-timeline">${timeline
                  .map(
                    (item) => `
                      <li>
                        <strong>${escapeHtml(requestLabel(item))}</strong>
                        <div><code>${escapeHtml(item.url || "Unavailable")}</code></div>
                        <div class="muted">Final URL: ${escapeHtml(item.final_url || "Unavailable")} • Response length: ${escapeHtml(String(item.response_length ?? item.response_size ?? "Unavailable"))}</div>
                        <div class="muted">Blocked: ${escapeHtml(formatBoolean(item.blocked))} • Error: ${escapeHtml(item.error || "None")}</div>
                      </li>
                    `
                  )
                  .join("")}</ol>`
              : '<div class="ss-empty-state" style="margin-top:0;">No request-chain stages were exported for the selected creator.</div>'
          }
        </section>
      `
    );

    if (el.rawShell && el.rawOutput) {
      el.rawShell.classList.remove("hidden");
      el.rawOutput.textContent = rawOutput;
      el.rawOutput.classList.toggle("hidden", !state.rawDebugExpanded);
      if (el.rawToggle) {
        el.rawToggle.textContent = state.rawDebugExpanded ? "Collapse raw debug" : "Expand raw debug";
      }
    }
  }

  function renderChart() {
    const stream = selectedStream();
    const botAuto = state.intelligenceDetail?.botAuto || {};
    if (el.postureChip) {
      const label = stream?.posture || botAuto.decision_state || "No stream selected";
      el.postureChip.className = `ss-chip ${chipClassForTone(toneForPosture(label))}`;
      el.postureChip.textContent = formatLabel(label);
    }
    if (!el.chart || !el.chartEmpty) return;
    if (!stream) {
      el.chart.classList.add("hidden");
      el.chartEmpty.classList.remove("hidden");
      setText(el.chartEmpty, "Select a creator and stream entry to inspect runtime-backed analytics posture.");
      return;
    }
    const points = Array.isArray(stream.points) ? stream.points : [];
    if (!points.length) {
      el.chart.classList.add("hidden");
      el.chartEmpty.classList.remove("hidden");
      setText(
        el.chartEmpty,
        "No historical Rumble engagement snapshots exported yet. Current runtime metadata is available above, but live viewers, chat count, and unique chatter series are not currently stored."
      );
      return;
    }

    const width = 720;
    const height = 280;
    const padding = { left: 56, right: 28, top: 20, bottom: 36 };
    const usableWidth = width - padding.left - padding.right;
    const usableHeight = height - padding.top - padding.bottom;
    const seriesDefs = [
      { key: "live_viewers", className: "ss-rumble-intelligence-chart-viewers" },
      { key: "chat_count", className: "ss-rumble-intelligence-chart-chat" },
      { key: "unique_chatters", className: "ss-rumble-intelligence-chart-chatters" },
    ];
    const values = points.flatMap((point) =>
      seriesDefs.map((series) => Number(point?.[series.key])).filter((value) => Number.isFinite(value))
    );
    const maxValue = Math.max(1, ...values);
    const xStep = points.length > 1 ? usableWidth / (points.length - 1) : usableWidth;
    const mapY = (value) => padding.top + usableHeight - (Number(value) / maxValue) * usableHeight;
    const yTicks = [0, 0.25, 0.5, 0.75, 1]
      .map((ratio) => {
        const y = padding.top + usableHeight - ratio * usableHeight;
        const label = Math.round(maxValue * ratio);
        return `
          <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="ss-rumble-intelligence-chart-grid"></line>
          <text x="10" y="${y + 4}" class="ss-rumble-intelligence-chart-label">${escapeHtml(String(label))}</text>
        `;
      })
      .join("");
    const xAxis = `
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" class="ss-rumble-intelligence-chart-axis"></line>
      <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" class="ss-rumble-intelligence-chart-axis"></line>
    `;
    const seriesMarkup = seriesDefs
      .map((series) => {
        const pathPoints = points
          .map((point, index) => {
            const value = Number(point?.[series.key]);
            if (!Number.isFinite(value)) return null;
            const x = padding.left + xStep * index;
            const y = mapY(value);
            return `${x},${y}`;
          })
          .filter(Boolean)
          .join(" ");
        if (!pathPoints) return "";
        return `<polyline points="${pathPoints}" class="${series.className}"></polyline>`;
      })
      .join("");
    const lastPoint = points[points.length - 1] || {};
    const markerX = padding.left + xStep * Math.max(points.length - 1, 0);
    const markerY = mapY(Number(lastPoint.live_viewers || 0));
    setHtml(
      el.chart,
      `${yTicks}${xAxis}${seriesMarkup}<circle cx="${markerX}" cy="${markerY}" r="3.5" class="ss-rumble-intelligence-chart-point"></circle>`
    );
    el.chart.classList.remove("hidden");
    el.chartEmpty.classList.add("hidden");
  }

  function renderIntelligence() {
    populateStreamOptions();
    renderHistoryState();
    renderMetaGrid();
    renderDiagnostics();
    renderChart();
  }

  async function loadCreatorDetail(accountId) {
    if (!accountId) {
      state.intelligenceDetail = null;
      renderIntelligence();
      return;
    }
    if (intelligenceAbortController) intelligenceAbortController.abort();
    intelligenceAbortController = new AbortController();
    const detailPayload = await requestJson(
      `/api/admin/accounts/${encodeURIComponent(accountId)}/creator-integrations`,
      { signal: intelligenceAbortController.signal }
    );
    state.intelligenceDetail = normalizeDetailPayload(detailPayload);
    const streams = Array.isArray(state.intelligenceDetail.streams) ? state.intelligenceDetail.streams : [];
    if (!streams.some((item) => item.key === state.selectedStreamKey)) {
      state.selectedStreamKey = streams[0]?.key || "";
    }
    renderIntelligence();

    if (!streams.length) {
      setIntelligenceBanner(
        "Rumble intelligence is loaded from runtime/Auth contracts, but no historical engagement export exists yet for the selected creator.",
        "warning"
      );
      return;
    }
    setIntelligenceBanner(
      "Rumble intelligence is loaded from runtime/Auth contracts. Current stream posture is available; historical analytics render only when runtime exports them.",
      "success"
    );
  }

  async function hydrateIntelligence(botsPayload) {
    const summaryPayload = await requestJson(CREATOR_SUMMARY_ENDPOINT);
    state.creators = buildCreatorList(summaryPayload, botsPayload);
    filterCreators();
    if (!state.selectedAccountId && state.creators.length) {
      state.selectedAccountId = state.creators[0].account_id;
    }
    renderCreatorSummary();
    await loadCreatorDetail(state.selectedAccountId);
    selectorsHydrated = true;
  }

  function bindIntelligenceEvents() {
    if (el.searchInput && !el.searchInput.dataset.rumbleBound) {
      el.searchInput.dataset.rumbleBound = "true";
      el.searchInput.addEventListener("input", () => {
        filterCreators();
        void loadCreatorDetail(state.selectedAccountId);
      });
    }
    if (el.creatorSelect && !el.creatorSelect.dataset.rumbleBound) {
      el.creatorSelect.dataset.rumbleBound = "true";
      el.creatorSelect.addEventListener("change", () => {
        state.selectedAccountId = String(el.creatorSelect.value || "").trim();
        renderCreatorSummary();
        void loadCreatorDetail(state.selectedAccountId);
      });
    }
    if (el.streamSelect && !el.streamSelect.dataset.rumbleBound) {
      el.streamSelect.dataset.rumbleBound = "true";
      el.streamSelect.addEventListener("change", () => {
        state.selectedStreamKey = String(el.streamSelect.value || "").trim();
        renderIntelligence();
      });
    }
    if (el.rawToggle && !el.rawToggle.dataset.rumbleBound) {
      el.rawToggle.dataset.rumbleBound = "true";
      el.rawToggle.addEventListener("click", () => {
        state.rawDebugExpanded = !state.rawDebugExpanded;
        renderDiagnostics();
      });
    }
    if (el.rawCopy && !el.rawCopy.dataset.rumbleBound) {
      el.rawCopy.dataset.rumbleBound = "true";
      el.rawCopy.addEventListener("click", async () => {
        const text = el.rawOutput?.textContent || "";
        if (!text) return;
        if (window.navigator?.clipboard?.writeText) {
          await window.navigator.clipboard.writeText(text);
        }
      });
    }
  }

  function renderLoadFailure(message) {
    const detail = message || "Unable to load runtime bot posture.";
    if (el.serviceToggle instanceof HTMLInputElement) {
      el.serviceToggle.checked = false;
    }
    setText(el.runtimeStatus, "Load failed");
    setText(el.runtimeUpdated, "—");
    setText(el.runtimeError, detail);
    setText(el.runtimeMessages, "0 / 0");
    setText(el.runtimeTriggers, "0 / 0");
    setText(el.runtimeBlocked, "0 / 0");
    setText(el.runtimeManual, "0");
    if (el.runtimeBanner) {
      el.runtimeBanner.classList.remove("ss-alert-success", "ss-alert-warning");
      el.runtimeBanner.classList.add("ss-alert-danger");
      setText(el.runtimeBanner, detail);
    }
    if (el.foundationStatus) {
      el.foundationStatus.classList.remove("active");
      el.foundationStatus.classList.add("idle");
      el.foundationStatus.textContent = "● Rumble runtime: Load failed";
    }
    setIntelligenceBanner(detail, "danger");
  }

  async function hydrateRuntime() {
    try {
      const payload = await requestJson(BOTS_STATUS_ENDPOINT);
      renderPayload(payload);
      if (!selectorsHydrated) {
        await hydrateIntelligence(payload);
      } else if (state.selectedAccountId) {
        await loadCreatorDetail(state.selectedAccountId);
      }
    } catch (err) {
      renderLoadFailure(err?.message || "Unable to load runtime bot posture.");
    }
  }

  function startRuntimePolling() {
    void hydrateRuntime();
    runtimeTimer = window.setInterval(() => {
      void hydrateRuntime();
    }, REFRESH_INTERVAL);
  }

  function init() {
    cacheElements();
    bindIntelligenceEvents();
    startRuntimePolling();
  }

  function destroy() {
    if (runtimeTimer) {
      clearInterval(runtimeTimer);
      runtimeTimer = null;
    }
    if (intelligenceAbortController) {
      intelligenceAbortController.abort();
      intelligenceAbortController = null;
    }
    selectorsHydrated = false;
  }

  window.RumbleView = {
    init,
    destroy,
  };
})();

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.tokens = new Set();
  }

  _sync() {
    this.owner._className = Array.from(this.tokens).join(" ").trim();
  }

  setFromString(value) {
    this.tokens = new Set(String(value || "").split(/\s+/).filter(Boolean));
    this._sync();
  }

  add(...values) {
    values.filter(Boolean).forEach((value) => this.tokens.add(value));
    this._sync();
  }

  remove(...values) {
    values.filter(Boolean).forEach((value) => this.tokens.delete(value));
    this._sync();
  }

  toggle(value, force) {
    if (force === true) {
      this.tokens.add(value);
    } else if (force === false) {
      this.tokens.delete(value);
    } else if (this.tokens.has(value)) {
      this.tokens.delete(value);
    } else {
      this.tokens.add(value);
    }
    this._sync();
  }

  contains(value) {
    return this.tokens.has(value);
  }
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this._innerHTML = "";
    this.innerHTMLWrites = 0;
    this.textContent = "";
    this.value = "";
    this.disabled = false;
    this._className = "";
    this.dataset = {};
    this.classList = new FakeClassList(this);
    this.listeners = new Map();
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value || "");
    this.innerHTMLWrites += 1;
  }

  get className() {
    return this._className;
  }

  set className(value) {
    this.classList.setFromString(value);
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }

  async dispatch(type) {
    const handlers = Array.from(this.listeners.get(type) || []);
    for (const handler of handlers) {
      await handler({ target: this, currentTarget: this, preventDefault() {} });
    }
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }

  removeAttribute(name) {
    delete this[name];
  }
}

class FakeButtonElement extends FakeElement {}
class FakeSelectElement extends FakeElement {}
class FakeInputElement extends FakeElement {}

class FakeTimerScheduler {
  constructor() {
    this.nextId = 1;
    this.tasks = new Map();
  }

  setTimeout(callback, delay = 0) {
    const id = this.nextId += 1;
    this.tasks.set(id, { callback, delay, interval: false });
    return id;
  }

  clearTimeout(id) {
    this.tasks.delete(id);
  }

  setInterval(callback, delay = 0) {
    const id = this.nextId += 1;
    this.tasks.set(id, { callback, delay, interval: true });
    return id;
  }

  clearInterval(id) {
    this.tasks.delete(id);
  }

  pendingCount() {
    return this.tasks.size;
  }

  async runNext() {
    const [id, task] = this.tasks.entries().next().value || [];
    if (!id) return;
    if (!task.interval) {
      this.tasks.delete(id);
    }
    await task.callback();
  }
}

function createBotsPayload({ unchanged = true } = {}) {
  return {
    generated_at: "2026-04-21T10:00:00Z",
    server_generated_at: "2026-04-21T10:00:00Z",
    supported_platforms: ["rumble"],
    platform_capabilities: {
      rumble: { platform: "rumble", label: "Rumble", manual_deploy_enabled: true, staged: false }
    },
    platforms: [
      {
        platform: "rumble",
        label: "Rumble",
        available: true,
        status: "ready",
        global_status: "ready",
        session_status: "blocked",
        paused: false,
        error: "Rumble browse/live detection failed before a trustworthy offline result could be established.",
        details: {
          bot_blocked_count: 1,
          bot_desired_count: 0,
          session_status: "blocked",
          session_status_reason:
            "Rumble browse/live detection failed before a trustworthy offline result could be established.",
          session_blocking_codes: ["browse_live_request_failed"]
        }
      }
    ],
    bots: [
      {
        creator_id: "daniel",
        platform: "rumble",
        session_type: "auto",
        manual_override: false,
        session_id: "rumble-auto-1",
        status: "blocked",
        lifecycle_state: "blocked",
        desired: false,
        status_reason:
          unchanged
            ? "Rumble browse/live detection failed before a trustworthy offline result could be established."
            : "Creator appears live, but runtime still lacks enough stream identity to attach chat transport.",
        runner_state: "blocked",
        pause_reason: unchanged ? "browse_live_request_failed" : "attach_identity_unresolved",
        last_error: unchanged ? "browse_live_request_failed" : "attach_identity_unresolved",
        resolved_target: {},
        last_transition_at: "2026-04-21T10:00:00Z",
        uptime_seconds: 12
      }
    ]
  };
}

function createKickAwaitingLivestreamPayload() {
  return {
    generated_at: "2026-05-14T01:00:00Z",
    server_generated_at: "2026-05-14T01:00:00Z",
    supported_platforms: ["kick"],
    platform_capabilities: {
      kick: { platform: "kick", label: "Kick", manual_deploy_enabled: true, staged: false }
    },
    platforms: [
      {
        platform: "kick",
        label: "Kick",
        available: true,
        status: "ready",
        global_status: "ready",
        session_status: "awaiting_livestream",
        session_blocking_code: null,
        session_blocking_codes: [],
        session_waiting_code: "awaiting_livestream",
        session_waiting_codes: ["awaiting_livestream"],
        details: {
          bot_blocked_count: 0,
          bot_desired_count: 1,
          session_status: "awaiting_livestream",
          session_status_reason: "Kick session is waiting for livestream/chat room before transport attach.",
          session_blocking_codes: [],
          session_waiting_codes: ["awaiting_livestream"]
        }
      }
    ],
    bots: [
      {
        creator_id: "4TiOlvS",
        creator_display_name: "Daniel Clancy",
        platform: "kick",
        session_type: "manual",
        manual_override: true,
        session_id: "kick-manual-1",
        status: "awaiting_livestream",
        lifecycle_state: "awaiting_livestream",
        desired: true,
        status_reason: "Kick session waiting for livestream/chat room; subscription is tracked separately.",
        runner_state: "awaiting_livestream",
        transport_status: "awaiting_livestream",
        pause_reason: "awaiting_livestream",
        last_error: "",
        active_target: "streamsuites",
        resolved_target: { identifier: "streamsuites", channel_slug: "streamsuites" },
        subscription_status: "subscription_failed",
        subscription_optional: true,
        subscription_required: false,
        last_transition_at: "2026-05-14T01:00:00Z",
        visible_in_admin: true,
        actionable: true
      }
    ]
  };
}

function buildBotsSandbox({
  botPayloads = [createBotsPayload()],
  debugPayloads = [],
  creatorsPayload,
  statusFetch,
  creatorsFetch,
  currentView = "",
  snapshotHealthHandler = null
} = {}) {
  const ids = [
    "bots-status",
    "bots-count",
    "bots-generated-at",
    "bots-source",
    "bots-error",
    "bots-hidden-note",
    "bots-platforms-status",
    "bots-platforms-grid",
    "bots-live-total",
    "bots-manual-toggle",
    "bots-manual-form",
    "bots-manual-creator",
    "bots-manual-platform",
    "bots-manual-platform-fields",
    "bots-manual-submit",
    "bots-manual-cancel",
    "bots-manual-note",
    "bots-manual-error",
    "bots-table-body",
    "bots-empty"
  ];
  const elements = new Map(ids.map((id) => [id, id === "bots-manual-toggle" ? new FakeButtonElement(id) : new FakeElement(id)]));
  elements.get("bots-error").className = "hidden";
  elements.get("bots-empty").className = "hidden";
  elements.get("bots-manual-form").className = "hidden";
  elements.get("bots-manual-error").className = "hidden";

  const scheduler = new FakeTimerScheduler();
  let botFetchIndex = 0;
  let debugFetchIndex = 0;
  const fetchLog = [];
  const eventLog = [];
  const creatorsResponse = creatorsPayload || {
    creators: [{ creator_id: "daniel", display_name: "Daniel", tier: "pro", status: "active" }]
  };

  const document = {
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector() {
      return null;
    }
  };

  async function fetchMock(url, options = {}) {
    const href = String(url);
    fetchLog.push({ url: href, options });
    if (href.includes("/api/admin/bots/status")) {
      if (typeof statusFetch === "function") {
        return statusFetch(url, options);
      }
      const payload = botPayloads[Math.min(botFetchIndex, botPayloads.length - 1)];
      botFetchIndex += 1;
      return {
        ok: true,
        status: 200,
        async json() {
          return payload;
        }
      };
    }
    if (href.includes("/api/admin/bots/debug")) {
      const payload = debugPayloads[Math.min(debugFetchIndex, Math.max(debugPayloads.length - 1, 0))] || {
        success: true,
        generated_at: "2026-06-13T01:00:00Z",
        bot: { platform: "twitch", lifecycle_status: "listening", transport_status: "eventsub_websocket_connected", runner_status: "listening" },
        diagnostics: {
          summary: { event_count: 1, trace_source: "persisted" },
          trigger_pipeline: { recent_messages: [] },
          exports: { session_snapshot: {} }
        }
      };
      debugFetchIndex += 1;
      return {
        ok: true,
        status: 200,
        async json() {
          return payload;
        }
      };
    }
    if (href.includes("/api/admin/creators")) {
      if (typeof creatorsFetch === "function") {
        return creatorsFetch(url, options);
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return creatorsResponse;
        }
      };
    }
    throw new Error(`Unexpected fetch: ${href}`);
  }

  const window = {
    setTimeout: scheduler.setTimeout.bind(scheduler),
    clearTimeout: scheduler.clearTimeout.bind(scheduler),
    fetch: fetchMock,
    location: { pathname: "/telemetry" },
    prompt: () => null,
    StreamSuitesDashboardPermissions: { has: () => true },
    StreamSuitesAdminAuth: { config: { baseUrl: "" } },
    StreamSuitesAdminShell: currentView ? { getCurrentView: () => currentView } : undefined,
    StreamSuitesSnapshotHealth: snapshotHealthHandler ? { handleAdminLiveData: snapshotHealthHandler } : undefined,
    dispatchEvent(event) {
      eventLog.push(event);
      return true;
    }
  };

  class FakeCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail || {};
    }
  }

  const sandbox = {
    window,
    document,
    fetch: fetchMock,
    console,
    CustomEvent: FakeCustomEvent,
    AbortController,
    URLSearchParams,
    setTimeout: scheduler.setTimeout.bind(scheduler),
    clearTimeout: scheduler.clearTimeout.bind(scheduler),
    HTMLButtonElement: FakeButtonElement
  };

  vm.createContext(sandbox);
  vm.runInContext(read("docs/js/bots.js"), sandbox);
  return { sandbox, elements, scheduler, fetchLog, eventLog };
}

function createRumbleBotsPayload() {
  return {
    generated_at: "2026-04-23T01:00:00Z",
    server_generated_at: "2026-04-23T01:00:00Z",
    platforms: [
      {
        platform: "rumble",
        implemented: true,
        runtime_ready: true,
        global_status: "ready",
        session_status: "blocked",
        error: "Blocked on sample browse/live failure.",
        details: {
          bot_blocked_count: 1,
          bot_desired_count: 0,
          bot_paused_count: 0,
          manual_override_count: 0
        }
      }
    ],
    bots: [
      {
        creator_id: "daniel",
        platform: "rumble",
        session_type: "auto",
        session_id: "rumble-auto-1",
        status: "blocked",
        last_evaluated_at: "2026-04-23T01:00:00Z",
        resolved_target: {
          watch_url: "https://rumble.com/v78pvkk-testing-0.4.2-alpha-2026.04.14-007.html",
          video_id: "478900123",
          chat_id: "478900123",
          channel_url: "https://rumble.com/user/danielclancy",
          channel_slug: "danielclancy",
          channel_handle: "@danielclancy"
        }
      }
    ]
  };
}

function createRumbleCreatorSummaryPayload() {
  return {
    success: true,
    items: [
      {
        account_id: "acct-daniel",
        user_code: "daniel",
        display_name: "Daniel Clancy",
        readiness_label: "Blocked",
        creator_capable: true
      }
    ]
  };
}

function createRumbleRuntimeDebug({ variant = "base" } = {}) {
  const browseRequest = {
    stage: "browse_live_request",
    method: "GET",
    url: "https://rumble.com/browse/live?page=1",
    final_url: "https://rumble.com/browse/live?page=1",
    status_code: variant === "changed" ? 200 : 403,
    response_length: variant === "changed" ? 1274 : 9,
    response_size: variant === "changed" ? 1274 : 9,
    content_type: "text/html",
    blocked: variant !== "changed",
    error: variant === "changed" ? null : "blocked_http_403",
    request_headers: { Accept: "text/html", "User-Agent": "streamsuites-test" },
    parse_markers: variant === "changed"
      ? { parsed_entries: 1, matching_video_rows_found: 1 }
      : { parsed_entries: 0, matching_video_rows_found: 0 }
  };
  const creatorPageRequest = {
    stage: "creator_page_probe_request",
    method: "GET",
    url: "https://rumble.com/user/danielclancy",
    final_url: "https://rumble.com/user/danielclancy",
    status_code: 403,
    response_length: 9,
    response_size: 9,
    content_type: "text/html",
    blocked: true,
    error: "blocked_http_403",
    request_headers: { Accept: "text/html", Referer: "https://rumble.com" },
    parse_markers: { live_markers_found: false }
  };
  const runtimeDebug = {
    platform: "rumble",
    schema_version: "v2",
    generated_at: "2026-04-23T01:00:05Z",
    selected_creator: {
      account_id: "acct-daniel",
      user_code: "daniel",
      display_name: "Daniel Clancy",
      integration_channel_handle: "@danielclancy"
    },
    identity_resolution: {
      source: "creator_integration",
      selection_reason: "creator_integration won for slugs, paths, urls.",
      normalized_inputs: {
        creator_keys: ["acct-daniel", "daniel"],
        channel_ids: [],
        slugs: ["danielclancy"],
        paths: ["/user/danielclancy"],
        urls: ["https://rumble.com/user/danielclancy"]
      },
      ignored_identities: [
        {
          source: "creator_identity",
          normalized_inputs: {
            urls: ["https://rumble.com/c/legacydaniel"]
          }
        }
      ]
    },
    decision: {
      decision_state: variant === "changed" ? "live_target_unresolved" : "sample_browse_live_request_failed",
      live_status: "unknown",
      live_truth_source: "none",
      blocking_reason: variant === "changed" ? "watch_target_resolution_failed" : "sample_browse_live_request_failed",
      blocking_reason_detail: variant === "changed" ? "live_rows_found_without_concrete_watch_target" : "blocked_http_403",
      blocking_reason_category: variant === "changed" ? "watch_target_resolution_failed" : "sample_detection_failed",
      attach_identity_ready: false,
      live_target_unresolved: variant === "changed",
      resolved_watch_url: null,
      resolved_live_target_url: null,
      resolved_video_id: variant === "changed" ? "478900123" : null,
      resolved_chat_id: null,
      resolved_stream_identity: null,
      last_live_status_checked_at: "2026-04-23T01:00:00Z"
    },
    blocking: {
      reason: variant === "changed" ? "watch_target_resolution_failed" : "sample_browse_live_request_failed",
      detail: variant === "changed" ? "live_rows_found_without_concrete_watch_target" : "blocked_http_403",
      category: variant === "changed" ? "watch_target_resolution_failed" : "sample_detection_failed"
    },
    stop: {
      stop_stage: variant === "changed" ? "creator_page_probe" : "browse_live",
      stop_reason: variant === "changed" ? "creator_page_live_marker_found_but_watch_url_missing" : "sample_browse_live_request_failed",
      stop_detail: variant === "changed" ? "creator_page_live_marker_found_but_watch_url_missing" : "blocked_http_403"
    },
    watch_target_resolution: {
      resolved_watch_target: null,
      resolved_watch_home_url: "https://rumble.com/user/danielclancy",
      resolved_numeric_video_id: variant === "changed" ? "478900123" : null,
      resolved_chat_id: null,
      resolved_stream_identity: null,
      resolved_channel_url: "https://rumble.com/user/danielclancy",
      resolved_channel_slug: "danielclancy",
      resolution_source: variant === "changed" ? "sample_equivalent" : "creator_channel_probe",
      decision_source: variant === "changed" ? "creator_page_probe" : "creator_channel_probe",
      attach_identity_ready: false,
      attach_identity_incomplete: false,
      live_target_unresolved: variant === "changed",
      channel_url_rejected_as_live_target: true
    },
    stream_chat_identity: {
      live_truth_source: "none",
      resolved_watch_url: null,
      resolved_live_target_url: null,
      resolved_video_id: variant === "changed" ? "478900123" : null,
      resolved_chat_id: null,
      resolved_stream_identity: null,
      sample_chat_init_received: false,
      sample_chat_stream_url: null
    },
    matched_discovery_entry: {
      stop_stage: variant === "changed" ? "creator_page_probe" : "browse_live",
      stop_reason: variant === "changed" ? "creator_page_live_marker_found_but_watch_url_missing" : "sample_browse_live_request_failed",
      stop_detail: variant === "changed" ? "creator_page_live_marker_found_but_watch_url_missing" : "blocked_http_403"
    },
    discovery_diagnostics: {
      browse_live: {
        live_tiles_found: variant === "changed" ? 1 : 0,
        matched_live_row_found: variant === "changed",
        matched_live_row_count: variant === "changed" ? 1 : 0,
        selected_match: variant === "changed"
          ? { watch_url: "https://rumble.com/v78pvkk-testing-0.4.2-alpha-2026.04.14-007.html" }
          : null,
        stop_reason: "sample_live_tile_not_found"
      },
      creator_channel_probe: {
        livestream_api_url_selected: "https://rumble.com/-livestream-api/get-data?key=%3Credacted%3E",
        livestream_count: variant === "changed" ? 1 : 0,
        resolution_source: variant === "changed" ? "sample_equivalent" : "creator_channel_probe",
        resolved_watch_url: null,
        resolved_numeric_video_id: variant === "changed" ? "478900123" : null,
        resolved_chat_id: null,
        live_markers_found: variant === "changed",
        watch_url_extracted: false,
        channel_url_rejected_as_live_target: true,
        stop_stage: "creator_page_probe",
        stop_reason: variant === "changed" ? "creator_page_live_marker_found_but_watch_url_missing" : "creator_page_probe_failed",
        stop_detail: variant === "changed" ? "creator_page_live_marker_found_but_watch_url_missing" : "blocked_http_403",
        creator_page_probe: {
          candidate_urls: ["https://rumble.com/user/danielclancy"],
          live_markers_found: variant === "changed",
          matching_video_row_found: false,
          watch_url_extracted: false,
          stop_stage: "creator_page_probe",
          stop_reason: variant === "changed" ? "creator_page_live_marker_found_but_watch_url_missing" : "creator_page_probe_failed",
          stop_detail: variant === "changed" ? "creator_page_live_marker_found_but_watch_url_missing" : "blocked_http_403",
          requests: [creatorPageRequest]
        }
      },
      watch_resolution: {}
    },
    request_chains: {
      browse_live: [browseRequest],
      creator_page_probe: [creatorPageRequest],
      livestream_api_probe: [],
      watch_resolution: [],
      sample_chat_stream: [],
      all: [browseRequest, creatorPageRequest]
    },
    request_chain_counts: {
      browse_live: 1,
      creator_page_probe: 1,
      livestream_api_probe: 0,
      watch_resolution: 0,
      sample_chat_stream: 0
    },
    rejected_evidence: [
      {
        source: "creator_page_probe",
        reason: "channel_url_rejected_as_live_target"
      }
    ],
    managed_session: {
      lifecycle_state: "blocked",
      desired: false,
      eligible: false,
      resolved_target: {}
    },
    managed_session_posture: {
      present: true,
      lifecycle_state: "blocked",
      desired: false,
      eligible: false,
      blocking_reason: variant === "changed" ? "watch_target_resolution_failed" : "sample_browse_live_request_failed",
      status_reason: "Managed session is blocked while runtime cannot prove a concrete live watch target.",
      resolved_target: {}
    },
    freshness: {
      debug_generated_at: "2026-04-23T01:00:05Z",
      live_status_generated_at: "2026-04-23T01:00:00Z",
      discovery_generated_at: "2026-04-23T01:00:03Z",
      discovery_scan_completed_at: "2026-04-23T01:00:02Z",
      last_live_status_checked_at: "2026-04-23T01:00:00Z",
      managed_session_last_evaluated_at: "2026-04-23T01:00:04Z",
      managed_session_last_transport_heartbeat_at: "2026-04-23T01:00:04Z"
    },
    source_exports: {
      live_status_generated_at: "2026-04-23T01:00:00Z",
      discovery_generated_at: "2026-04-23T01:00:03Z",
      discovery_scan_completed_at: "2026-04-23T01:00:02Z"
    }
  };
  return runtimeDebug;
}

function createRumbleDetailPayload({ runtimeDebug = createRumbleRuntimeDebug() } = {}) {
  return {
    success: true,
    generated_at: "2026-04-23T01:00:05Z",
    account: {
      id: "acct-daniel",
      user_code: "daniel",
      display_name: "Daniel Clancy"
    },
    integrations: [
      {
        platform_key: "rumble",
        public_url: "https://rumble.com/user/danielclancy",
        channel_handle: "@danielclancy",
        bot_auto_deploy: {
          decision_state: runtimeDebug?.decision?.decision_state || "unknown",
          live_status: runtimeDebug?.decision?.live_status || "unknown",
          live_truth_source: runtimeDebug?.decision?.live_truth_source || "none",
          resolved_watch_url: runtimeDebug?.decision?.resolved_watch_url || null,
          resolved_video_id: runtimeDebug?.decision?.resolved_video_id || null,
          resolved_chat_id: runtimeDebug?.decision?.resolved_chat_id || null,
          resolved_stream_identity: runtimeDebug?.decision?.resolved_stream_identity || null,
          resolved_channel_url: runtimeDebug?.watch_target_resolution?.resolved_channel_url || "https://rumble.com/user/danielclancy",
          resolved_channel_handle: "@danielclancy",
          blocking_reason: runtimeDebug?.blocking?.reason || null,
          blocking_reason_category: runtimeDebug?.blocking?.category || null,
          blocking_reason_detail: runtimeDebug?.blocking?.detail || null,
          last_live_status_checked_at: runtimeDebug?.freshness?.last_live_status_checked_at || "2026-04-23T01:00:00Z"
        },
        managed_session: {
          session_id: "rumble-auto-1",
          lifecycle_state: "blocked",
          desired: false,
          eligible: false,
          status_reason: "Managed session is blocked while runtime cannot prove a concrete live watch target.",
          last_evaluated_at: "2026-04-23T01:00:04Z",
          last_transport_heartbeat_at: "2026-04-23T01:00:04Z",
          resolved_target: {}
        },
        managed_dispatch: {
          summary: {
            count: 0
          }
        },
        runtime_debug: runtimeDebug
      }
    ]
  };
}

function buildRumbleSandbox({
  botPayloads = [createRumbleBotsPayload()],
  summaryPayloads = [createRumbleCreatorSummaryPayload()],
  detailPayloads = { "acct-daniel": [createRumbleDetailPayload()] }
} = {}) {
  const ids = [
    "rumble-foundation-status",
    "rumble-runtime-banner",
    "rumble-runtime-status",
    "rumble-runtime-updated",
    "rumble-runtime-error",
    "rumble-runtime-messages",
    "rumble-runtime-triggers",
    "rumble-runtime-blocked",
    "rumble-runtime-manual",
    "rumble-intelligence-banner",
    "rumble-intelligence-search",
    "rumble-intelligence-creator-select",
    "rumble-intelligence-creator-empty",
    "rumble-intelligence-creator-summary",
    "rumble-intelligence-stream-select",
    "rumble-intelligence-history-state",
    "rumble-intelligence-meta",
    "rumble-intelligence-posture-chip",
    "rumble-intelligence-chart",
    "rumble-intelligence-chart-empty",
    "rumble-intelligence-diagnostics",
    "rumble-intelligence-raw-shell",
    "rumble-intelligence-raw-output",
    "rumble-intelligence-raw-copy",
    "rumble-intelligence-raw-toggle"
  ];
  const elements = new Map(
    ids.map((id) => {
      if (id.includes("search")) return [id, new FakeInputElement(id)];
      if (id.includes("creator-select") || id.includes("stream-select")) return [id, new FakeSelectElement(id)];
      if (id.includes("copy") || id.includes("toggle")) return [id, new FakeButtonElement(id)];
      return [id, new FakeElement(id)];
    })
  );
  const serviceToggle = new FakeInputElement("rumble-service-toggle");
  elements.get("rumble-intelligence-creator-empty").className = "hidden";
  elements.get("rumble-intelligence-raw-shell").className = "hidden";
  elements.get("rumble-intelligence-chart").className = "hidden";

  const scheduler = new FakeTimerScheduler();
  const clipboardWrites = [];
  let botsIndex = 0;
  let summariesIndex = 0;
  const detailIndexes = new Map();

  async function fetchMock(url) {
    const href = String(url);
    if (href.includes("/api/admin/bots/status")) {
      const payload = botPayloads[Math.min(botsIndex, botPayloads.length - 1)];
      botsIndex += 1;
      if (payload instanceof Error) {
        throw payload;
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return payload;
        }
      };
    }
    if (href.includes("/api/admin/creator-integrations")) {
      const payload = summaryPayloads[Math.min(summariesIndex, summaryPayloads.length - 1)];
      summariesIndex += 1;
      if (payload instanceof Error) {
        throw payload;
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return payload;
        }
      };
    }
    const detailMatch = href.match(/\/api\/admin\/accounts\/([^/]+)\/creator-integrations/);
    if (detailMatch) {
      const accountId = decodeURIComponent(detailMatch[1]);
      const series = detailPayloads[accountId] || [];
      const nextIndex = detailIndexes.get(accountId) || 0;
      const payload = series[Math.min(nextIndex, Math.max(series.length - 1, 0))] || createRumbleDetailPayload({ runtimeDebug: null });
      detailIndexes.set(accountId, nextIndex + 1);
      if (payload instanceof Error) {
        throw payload;
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return payload;
        }
      };
    }
    throw new Error(`Unexpected fetch: ${href}`);
  }

  const document = {
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector(selector) {
      if (selector === 'input[data-service="rumble"]') {
        return serviceToggle;
      }
      return null;
    }
  };

  const window = {
    setInterval: scheduler.setInterval.bind(scheduler),
    clearInterval: scheduler.clearInterval.bind(scheduler),
    setTimeout: scheduler.setTimeout.bind(scheduler),
    clearTimeout: scheduler.clearTimeout.bind(scheduler),
    fetch: fetchMock,
    navigator: {
      clipboard: {
        async writeText(text) {
          clipboardWrites.push(text);
        }
      }
    },
    StreamSuitesAdminAuth: { config: { baseUrl: "" } },
    StreamSuitesState: { formatTimestamp: (value) => value },
  };

  const sandbox = {
    window,
    document,
    fetch: fetchMock,
    console,
    AbortController,
    setInterval: scheduler.setInterval.bind(scheduler),
    clearInterval: scheduler.clearInterval.bind(scheduler),
    setTimeout: scheduler.setTimeout.bind(scheduler),
    clearTimeout: scheduler.clearTimeout.bind(scheduler),
    HTMLButtonElement: FakeButtonElement,
    HTMLSelectElement: FakeSelectElement,
    HTMLInputElement: FakeInputElement
  };

  vm.createContext(sandbox);
  vm.runInContext(read("docs/js/platforms/rumble.js"), sandbox);
  return { sandbox, elements, scheduler, clipboardWrites, serviceToggle };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

test("admin notifications hydrate and mutate through the runtime contract instead of local read-id storage", () => {
  const js = read("docs/js/notifications.js");
  const html = read("docs/views/notifications.html");

  assert.match(js, /const NOTIFICATIONS_ENDPOINT_PATH = "\/api\/admin\/notifications";/);
  assert.match(js, /method:\s*"PATCH"/);
  assert.match(js, /await loadNotifications\(\{ showLoader: false \}\);/);
  assert.doesNotMatch(js, /READ_IDS_STORAGE_KEY/);
  assert.doesNotMatch(js, /persistReadIds/);
  assert.match(html, /runtime notification contract for the signed-in operator/);
});

test("admin creator integration surfaces expose rumble managed-session transport state from the runtime contract", () => {
  const integrationsJs = read("docs/js/creator-integrations.js");
  const userDetailJs = read("docs/js/user-detail.js");

  assert.match(integrationsJs, /item\?\.managed_session/);
  assert.match(integrationsJs, /Auto-deploy enabled/);
  assert.match(integrationsJs, /Last attach attempt/);
  assert.match(integrationsJs, /Last attach success/);
  assert.match(integrationsJs, /Stream key only/);
  assert.match(integrationsJs, /Waiting for live stream/);
  assert.match(integrationsJs, /Open watch target/);

  assert.match(userDetailJs, /item\?\.managed_session/);
  assert.match(userDetailJs, /Transport error/);
  assert.match(userDetailJs, /Live target pending/);
  assert.match(userDetailJs, /Open watch target/);
  assert.match(userDetailJs, /Chat auth missing/);
});

test("admin bots surface distinguishes managed sessions and transport posture", () => {
  const botsHtml = read("docs/views/bots.html");
  const botsJs = read("docs/js/bots.js");

  assert.match(botsHtml, /<th>Platforms<\/th>/);
  assert.match(botsHtml, /<th>Posture<\/th>/);
  assert.match(botsHtml, /<th>Instances<\/th>/);
  assert.match(botsHtml, /<th>Worst Issue<\/th>/);
  assert.match(botsJs, /session_type/);
  assert.match(botsJs, /Managed/);
  assert.match(botsJs, /buildCreatorGroups/);
  assert.match(botsJs, /ss-bots-detail-drawer/);
  assert.match(botsJs, /data-bot-expand/);
  assert.match(botsJs, /renderTargetCell/);
  assert.match(botsJs, /renderBlockingCell/);
  assert.match(botsJs, /Open watch target/);
  assert.match(botsJs, /session_blocking_codes/);
  assert.match(botsJs, /const globalStatus = String\(runtime\?\.globalStatus \|\| runtime\?\.status \|\| ""\)/);
  assert.match(botsJs, /const sessionStatus = String\(runtime\?\.sessionStatus \|\| runtime\?\.details\?\.session_status \|\| ""\)/);
  assert.match(botsJs, /sessionStatus === "awaiting_live"/);
  assert.match(botsJs, /sessionStatus === "live_target_unresolved"/);
  assert.match(botsJs, /creator-managed session/);
  assert.match(botsHtml, /Unconfigured platform placeholders are hidden\./);
  assert.match(botsJs, /isHiddenPlaceholderBot/);
  assert.match(botsJs, /visible_in_admin/);
});

test("bots view groups main runtime rows by creator and keeps platform details in the drawer", async () => {
  const payload = createBotsPayload({ unchanged: true });
  payload.supported_platforms = ["rumble", "kick"];
  payload.platform_capabilities.kick = {
    platform: "kick",
    label: "Kick",
    manual_deploy_enabled: true,
    staged: false
  };
  payload.platforms.push({
    platform: "kick",
    label: "Kick",
    available: true,
    status: "ready",
    global_status: "ready",
    paused: false,
    details: {}
  });
  payload.bots.push({
    creator_id: "daniel",
    platform: "kick",
    session_type: "manual",
    manual_override: true,
    status: "online",
    lifecycle_state: "attached",
    desired: true,
    status_reason: "Kick manual bot is attached.",
    runner_state: "listening",
    active_target: "danielclancy",
    resolved_target: { channel_handle: "danielclancy" },
    last_heartbeat_at: "2026-04-21T10:00:03Z",
    uptime_seconds: 99
  });

  const { sandbox, elements } = buildBotsSandbox({ botPayloads: [payload] });
  sandbox.window.BotsView.init();
  await flushMicrotasks();

  const tableHtml = elements.get("bots-table-body").innerHTML;
  assert.equal((tableHtml.match(/ss-bots-creator-row/g) || []).length, 1);
  assert.match(tableHtml, /Daniel/);
  assert.match(tableHtml, /Rumble/);
  assert.match(tableHtml, /Kick/);
  assert.match(tableHtml, /2 total/);
  assert.doesNotMatch(tableHtml, /ss-bot-instance-card/);
});

function clickBotsTable(elements, button) {
  const handlers = Array.from(elements.get("bots-table-body").listeners.get("click") || []);
  assert.ok(handlers.length > 0, "bots table click listener is registered");
  return Promise.all(handlers.map((handler) => handler({
    target: {
      closest(selector) {
        return selector === button.selector ? button.element : null;
      }
    },
    preventDefault() {}
  })));
}

function twitchBotsPayload({ reason = "first", includeRow = true } = {}) {
  return {
    generated_at: "2026-06-13T01:00:00Z",
    server_generated_at: "2026-06-13T01:00:00Z",
    supported_platforms: ["twitch"],
    platform_capabilities: {
      twitch: { platform: "twitch", label: "Twitch", manual_deploy_enabled: true, staged: false }
    },
    platforms: [
      { platform: "twitch", label: "Twitch", available: true, status: "ready", global_status: "ready" }
    ],
    bots: includeRow ? [
      {
        creator_id: "creator-twitch",
        platform: "twitch",
        session_type: "auto",
        session_id: "twitch-auto-a106f79667525d86",
        status: "listening",
        lifecycle_state: "listening",
        runner_state: "listening",
        transport_status: "eventsub_websocket_connected",
        subscription_status: "enabled",
        desired: true,
        live_worker_exists: true,
        status_reason: reason,
        active_target: "danielclancylive",
        target_normalized: "danielclancylive",
        resolved_target: { channel_handle: "danielclancylive", broadcaster_user_id: "985020874" },
        last_heartbeat_at: "2026-06-13T01:00:00Z"
      }
    ] : []
  };
}

test("bots polling preserves expanded detail and debug drawers while row content updates", async () => {
  const { sandbox, elements, scheduler } = buildBotsSandbox({
    botPayloads: [
      twitchBotsPayload({ reason: "first status reason" }),
      twitchBotsPayload({ reason: "updated status reason" })
    ]
  });
  sandbox.window.BotsView.init();
  await flushMicrotasks();

  const expand = new FakeButtonElement("expand");
  expand.dataset.botExpand = encodeURIComponent("creator-twitch");
  await clickBotsTable(elements, { selector: "[data-bot-expand]", element: expand });
  assert.match(elements.get("bots-table-body").innerHTML, /ss-bot-instance-card/);

  const debug = new FakeButtonElement("debug");
  debug.dataset.creatorId = encodeURIComponent("creator-twitch");
  debug.dataset.platform = encodeURIComponent("twitch");
  debug.dataset.sessionId = encodeURIComponent("twitch-auto-a106f79667525d86");
  await clickBotsTable(elements, { selector: "[data-bot-debug]", element: debug });
  await flushMicrotasks();
  assert.match(elements.get("bots-table-body").innerHTML, /ss-bot-debug-panel/);

  await scheduler.runNext();
  await flushMicrotasks();

  const html = elements.get("bots-table-body").innerHTML;
  assert.match(html, /updated status reason/);
  assert.match(html, /ss-bot-instance-card/);
  assert.match(html, /ss-bot-debug-panel/);
});

test("bots recent messages expansion survives mocked polling refresh", async () => {
  const recent = Array.from({ length: 8 }, (_, index) => ({
    timestamp: `2026-06-13T01:00:0${index}Z`,
    message_id: `msg-${index}`,
    message_text_summary: { command: "!ping", length: 5 }
  }));
  const debugPayload = {
    success: true,
    generated_at: "2026-06-13T01:00:00Z",
    bot: { platform: "twitch", lifecycle_status: "listening", transport_status: "eventsub_websocket_connected", runner_status: "listening" },
    diagnostics: {
      summary: { event_count: 3, trace_source: "persisted" },
      trigger_pipeline: { recent_messages: recent },
      exports: { session_snapshot: {} }
    }
  };
  const { sandbox, elements, scheduler } = buildBotsSandbox({
    botPayloads: [twitchBotsPayload({ reason: "first" }), twitchBotsPayload({ reason: "second" })],
    debugPayloads: [debugPayload]
  });
  sandbox.window.BotsView.init();
  await flushMicrotasks();

  const expand = new FakeButtonElement("expand");
  expand.dataset.botExpand = encodeURIComponent("creator-twitch");
  await clickBotsTable(elements, { selector: "[data-bot-expand]", element: expand });
  const debug = new FakeButtonElement("debug");
  debug.dataset.creatorId = encodeURIComponent("creator-twitch");
  debug.dataset.platform = encodeURIComponent("twitch");
  debug.dataset.sessionId = encodeURIComponent("twitch-auto-a106f79667525d86");
  await clickBotsTable(elements, { selector: "[data-bot-debug]", element: debug });
  await flushMicrotasks();

  const recentToggle = new FakeButtonElement("recent");
  recentToggle.dataset.creatorId = encodeURIComponent("creator-twitch");
  recentToggle.dataset.platform = encodeURIComponent("twitch");
  recentToggle.dataset.sessionId = encodeURIComponent("twitch-auto-a106f79667525d86");
  await clickBotsTable(elements, { selector: "[data-bot-debug-recent-toggle]", element: recentToggle });
  assert.match(elements.get("bots-table-body").innerHTML, /ss-bot-debug-recent-text is-expanded/);

  await scheduler.runNext();
  await flushMicrotasks();
  assert.match(elements.get("bots-table-body").innerHTML, /ss-bot-debug-recent-text is-expanded/);
});

test("bots refresh prunes drawer state only when row disappears", async () => {
  const { sandbox, elements, scheduler } = buildBotsSandbox({
    botPayloads: [twitchBotsPayload({ reason: "present" }), twitchBotsPayload({ includeRow: false })]
  });
  sandbox.window.BotsView.init();
  await flushMicrotasks();

  const expand = new FakeButtonElement("expand");
  expand.dataset.botExpand = encodeURIComponent("creator-twitch");
  await clickBotsTable(elements, { selector: "[data-bot-expand]", element: expand });
  assert.match(elements.get("bots-table-body").innerHTML, /ss-bot-instance-card/);

  await scheduler.runNext();
  await flushMicrotasks();

  const html = elements.get("bots-table-body").innerHTML;
  assert.doesNotMatch(html, /ss-bot-instance-card/);
  assert.doesNotMatch(html, /creator-twitch/);
});

test("bots view hides unconfigured placeholder rows from older runtime payloads", async () => {
  const payload = createBotsPayload({ unchanged: true });
  payload.platforms[0].details.hidden_placeholder_count = 1;
  payload.bots.unshift({
    creator_id: "phantom",
    platform: "rumble",
    session_type: "auto",
    manual_override: false,
    session_id: "rumble-auto-placeholder",
    status: "disabled",
    lifecycle_state: "disabled",
    desired: false,
    status_reason: "Rumble bot auto-deploy disabled",
    runner_state: "disabled",
    pause_reason: "creator_disabled",
    last_error: "creator_disabled",
    resolved_target: {},
    uptime_seconds: 0
  });

  const { sandbox, elements } = buildBotsSandbox({
    botPayloads: [payload],
    creatorsPayload: {
      creators: [
        { creator_id: "daniel", display_name: "Daniel", tier: "pro", status: "active" },
        { creator_id: "phantom", display_name: "Phantom", tier: "core", status: "active" }
      ]
    }
  });
  sandbox.window.BotsView.init();
  await flushMicrotasks();

  const tableHtml = elements.get("bots-table-body").innerHTML;
  assert.match(tableHtml, /Daniel/);
  assert.doesNotMatch(tableHtml, /Phantom/);
  assert.doesNotMatch(tableHtml, /Rumble bot auto-deploy disabled/);
  assert.match(elements.get("bots-count").textContent, /1 creator \/ 1 bot/);
  assert.match(elements.get("bots-live-total").textContent, /TOTAL LIVE BOTS: 0/);
  assert.match(elements.get("bots-hidden-note").textContent, /Unconfigured platform placeholders are hidden \(2\)\./);
});

test("bots view renders visible staged attachment rows without counting them live", async () => {
  const payload = {
    generated_at: "2026-06-05T01:00:00Z",
    server_generated_at: "2026-06-05T01:00:00Z",
    supported_platforms: ["twitch"],
    platform_capabilities: {
      twitch: { platform: "twitch", label: "Twitch", manual_deploy_enabled: false, staged: true }
    },
    platforms: [
      {
        platform: "twitch",
        label: "Twitch",
        available: false,
        status: "staged",
        staged: true,
        disabled_reason: "Twitch bot runtime is staged/disabled pending stabilization."
      }
    ],
    bots: [
      {
        creator_id: "creator-twitch",
        platform: "twitch",
        session_type: "attachment_probe",
        status: "staged_disabled",
        lifecycle_state: "staged_disabled",
        visible_in_admin: true,
        configured: true,
        attached: true,
        desired: false,
        live_worker_exists: false,
        target_normalized: "creatorchannel",
        resolved_target: { channel_handle: "creatorchannel" },
        status_reason: "Twitch bot runtime is staged/disabled pending stabilization."
      }
    ],
    runtime_diagnostics: { active_worker_count: 0 }
  };
  const { sandbox, elements } = buildBotsSandbox({ botPayloads: [payload] });
  sandbox.window.BotsView.init();
  await new Promise((resolve) => setImmediate(resolve));

  assert.match(elements.get("bots-table-body").innerHTML, /creator-twitch/);
  assert.match(elements.get("bots-count").textContent, /1 creator \/ 1 bot/);
  assert.match(elements.get("bots-live-total").textContent, /TOTAL LIVE BOTS: 0/);
  assert.match(elements.get("bots-hidden-note").textContent, /No live workers currently running/);
});

test("bots view renders stale export rows visibly without counting them live", async () => {
  const payload = {
    generated_at: "2026-06-04T03:30:09Z",
    server_generated_at: "2026-06-05T11:00:00Z",
    supported_platforms: ["kick"],
    platform_capabilities: {
      kick: { platform: "kick", label: "Kick", manual_deploy_enabled: true, staged: false }
    },
    platforms: [
      {
        platform: "kick",
        label: "Kick",
        available: true,
        status: "ready"
      }
    ],
    bots: [
      {
        creator_id: "creator-kick",
        platform: "kick",
        session_type: "auto",
        status: "stale",
        lifecycle_state: "stale",
        visible_in_admin: true,
        configured: true,
        desired: true,
        live_worker_exists: false,
        export_snapshot_only: true,
        stale_export_ignored: true,
        target_normalized: "creator-kick",
        active_target: "creator-kick",
        resolved_target: { channel_slug: "creator-kick" },
        status_reason: "Restored export row is stale."
      }
    ],
    runtime_diagnostics: {
      status_source: "live_api",
      api_fetch_ok: true,
      active_worker_count: 0,
      stale_export_count: 1,
      age_seconds: 0,
      stale_threshold_seconds: 60
    }
  };
  const { sandbox, elements } = buildBotsSandbox({ botPayloads: [payload] });
  sandbox.window.BotsView.init();
  await new Promise((resolve) => setImmediate(resolve));

  assert.match(elements.get("bots-table-body").innerHTML, /creator-kick/);
  assert.match(elements.get("bots-count").textContent, /1 creator \/ 1 bot/);
  assert.match(elements.get("bots-live-total").textContent, /TOTAL LIVE BOTS: 0/);
  assert.match(elements.get("bots-generated-at").textContent, /live_api/);
  assert.match(elements.get("bots-generated-at").textContent, /age 0s of 60s/);
  assert.match(elements.get("bots-hidden-note").textContent, /No live workers currently running/);
});

test("direct telemetry route auto-inits bots view when the module loads after the shell route", async () => {
  const { scheduler, fetchLog, elements } = buildBotsSandbox({ currentView: "bots" });

  await scheduler.runNext();
  await flushMicrotasks();

  assert.equal(fetchLog.filter((entry) => entry.url.includes("/api/admin/bots/status")).length, 1);
  assert.match(elements.get("bots-table-body").innerHTML, /daniel/);
  assert.doesNotMatch(elements.get("bots-status").textContent, /Loading runtime status/);
});

test("bots status fetch failure renders endpoint status and message instead of indefinite loading", async () => {
  const { sandbox, elements } = buildBotsSandbox({
    statusFetch: async () => ({
      ok: false,
      status: 503,
      async json() {
        return { message: "runtime status unavailable" };
      },
      async text() {
        return "runtime status unavailable";
      }
    })
  });

  sandbox.window.BotsView.init();
  await flushMicrotasks();

  assert.match(elements.get("bots-error").textContent, /Endpoint: \/api\/admin\/bots\/status/);
  assert.match(elements.get("bots-error").textContent, /HTTP 503/);
  assert.match(elements.get("bots-error").textContent, /runtime status unavailable/);
  assert.doesNotMatch(elements.get("bots-status").textContent, /Loading runtime status/);
  assert.doesNotMatch(elements.get("bots-platforms-status").textContent, /Loading runtime platform state/);
});

test("bots view keeps status rows when creator selector fetch fails", async () => {
  const { sandbox, elements } = buildBotsSandbox({
    creatorsFetch: async () => {
      throw new Error("creator endpoint unavailable");
    }
  });

  sandbox.window.BotsView.init();
  await flushMicrotasks();

  assert.match(elements.get("bots-table-body").innerHTML, /daniel/);
  assert.match(elements.get("bots-error").textContent, /creator selector unavailable/);
});

test("stale warning handler failures do not prevent bots rows rendering", async () => {
  const { sandbox, elements } = buildBotsSandbox({
    snapshotHealthHandler: () => {
      throw new Error("banner failed");
    }
  });

  sandbox.window.BotsView.init();
  await flushMicrotasks();

  assert.match(elements.get("bots-table-body").innerHTML, /Daniel/);
  assert.match(elements.get("bots-count").textContent, /1 creator \/ 1 bot/);
});

test("runtime-control unavailable diagnostics do not block bots render", async () => {
  const payload = createBotsPayload({ unchanged: true });
  payload.runtime_diagnostics = {
    status_source: "live_api",
    api_fetch_ok: true,
    runtime_control_reachable: false,
    age_seconds: 0,
    stale_threshold_seconds: 60
  };
  const { sandbox, elements } = buildBotsSandbox({ botPayloads: [payload] });

  sandbox.window.BotsView.init();
  await flushMicrotasks();

  assert.match(elements.get("bots-table-body").innerHTML, /Daniel/);
  assert.doesNotMatch(elements.get("bots-error").textContent, /runtime-control/i);
});

test("bots view emits source-aware freshness diagnostics and preserves stale rows on fetch failure", () => {
  const botsJs = read("docs/js/bots.js");

  assert.match(botsJs, /function dispatchHydrationDiagnostics\(detail = \{\}\)/);
  assert.match(botsJs, /const BOTS_STATUS_TIMEOUT_MS = 6500;/);
  assert.match(botsJs, /const POLL_MAX_BACKOFF_MS = 60000;/);
  assert.match(botsJs, /state\.statusFailureCount = Math\.min\(6/);
  assert.match(botsJs, /POLL_INTERVAL_MS \* Math\.max\(1, 2 \*\* failureCount\)/);
  assert.match(botsJs, /function fetchJsonWithTimeout/);
  assert.match(botsJs, /function formatStatusFetchError/);
  assert.match(botsJs, /Promise\.allSettled/);
  assert.match(botsJs, /return startPollingAsync\(\);/);
  assert.match(botsJs, /shouldAutoInitMountedBotsView/);
  assert.match(botsJs, /status_source: source/);
  assert.match(botsJs, /last_successful_live_fetch_at: state\.lastSuccessfulLiveFetchAt/);
  assert.match(botsJs, /source === "live_api" \? "admin-live" : source/);
  assert.match(botsJs, /Runtime API error - showing last known bot rows as stale\/fallback/);
  assert.match(botsJs, /stale_reason: "live_api_fetch_failed"/);
  assert.match(botsJs, /renderRowsAndCountersFromState\(state\.lastReceivedAt\)/);
  assert.match(botsJs, /const previousPayload = state\.lastPayload && Array\.isArray\(state\.lastPayload\.bots\)/);
});

test("bots view empty state is explicit after creator integration purge", () => {
  const view = read("docs/views/bots.html");

  assert.match(view, /No creator platform integrations are connected/);
  assert.match(view, /Reconnect creator channels from Creator Dashboard/);
});

test("dashboard shell refreshes current route on visibility return and same-view route changes", () => {
  const appJs = read("docs/js/app.js");

  assert.match(appJs, /function refreshCurrentView\(options = \{\}\)/);
  assert.match(appJs, /return loadView\(targetView,[\s\S]*force: true,[\s\S]*refresh: true/);
  assert.match(appJs, /registerView\("bots", \{[\s\S]*onLoad: \(\) => window\.BotsView\?\.init\?\.\(\)/);
  assert.match(appJs, /function bindVisibilityRefresh\(\)/);
  assert.match(appJs, /document\.addEventListener\("visibilitychange"/);
  assert.match(appJs, /document\.visibilityState !== "visible"/);
  assert.match(appJs, /void refreshCurrentView\(\{ reason:/);
  assert.match(appJs, /App\.currentView === targetView && routeChanged/);
});

test("snapshot warning remains source-aware and readable on warning background", () => {
  const healthJs = read("docs/js/utils/snapshot-health.js");
  const baseCss = read("docs/css/base.css");

  assert.match(healthJs, /source === "live_api"/);
  assert.match(healthJs, /handleAdminLiveData/);
  assert.match(healthJs, /window\.__STREAMSUITES_ADMIN_LIVE_DATA__/);
  assert.match(healthJs, /isFreshAdminLiveData/);
  assert.match(healthJs, /detail\.ok !== false && detail\.stale !== true && isLiveDataSource/);
  assert.match(healthJs, /latestAdminLiveData\.ok === false \|\| latestAdminLiveData\.stale === true/);
  assert.match(read("docs/js/app.js"), /window\.__STREAMSUITES_ADMIN_LIVE_DATA__ = detail/);
  assert.match(baseCss, /#snapshot-health-banner[\s\S]*color: #241a04;/);
  assert.match(baseCss, /#snapshot-health-banner\.snapshot-health-stale[\s\S]*color: #241a04;/);
  assert.match(baseCss, /#snapshot-health-banner\.snapshot-health-stale[\s\S]*text-shadow: none;/);
});

test("bots view does not stack duplicate pollers across repeated mounts", async () => {
  const { sandbox, scheduler } = buildBotsSandbox();

  sandbox.window.BotsView.init();
  await flushMicrotasks();
  assert.equal(scheduler.pendingCount(), 1);

  sandbox.window.BotsView.init();
  await flushMicrotasks();
  assert.equal(scheduler.pendingCount(), 1);

  sandbox.window.BotsView.destroy();
  assert.equal(scheduler.pendingCount(), 0);
});

test("bots view does not rewrite unchanged table rows or platform cards on an unchanged poll", async () => {
  const stablePayload = createBotsPayload({ unchanged: true });
  const { sandbox, elements, scheduler } = buildBotsSandbox({
    botPayloads: [stablePayload, stablePayload]
  });

  sandbox.window.BotsView.init();
  await flushMicrotasks();

  const bodyWrites = elements.get("bots-table-body").innerHTMLWrites;
  const gridWrites = elements.get("bots-platforms-grid").innerHTMLWrites;

  await scheduler.runNext();
  await flushMicrotasks();

  assert.equal(elements.get("bots-table-body").innerHTMLWrites, bodyWrites);
  assert.equal(elements.get("bots-platforms-grid").innerHTMLWrites, gridWrites);
});

test("bots view shows calmer rumble pre-live probe degradation on the platform summary while preserving row-level blocker detail", async () => {
  const { sandbox, elements } = buildBotsSandbox({
    botPayloads: [createBotsPayload({ unchanged: true })]
  });

  sandbox.window.BotsView.init();
  await flushMicrotasks();

  assert.match(elements.get("bots-platforms-grid").innerHTML, /Pending/);
  assert.match(elements.get("bots-platforms-grid").innerHTML, /awaiting trustworthy live verification/i);
  assert.match(
    elements.get("bots-table-body").innerHTML,
    /Rumble browse\/live detection failed before a trustworthy offline result could be established\./
  );
  assert.match(read("docs/js/bots.js"), /renderBlockingCell\(bot, platformState\)/);
});

test("bots view uses Auth admin deploy endpoint instead of runtime-control manual deploy", () => {
  const botsJs = read("docs/js/bots.js");

  assert.match(botsJs, /const MANUAL_DEPLOY_ENDPOINT = "\/api\/admin\/bots\/deploy";/);
  assert.doesNotMatch(botsJs, /const MANUAL_DEPLOY_ENDPOINT = "\/api\/admin\/runtime\/manual-deploy";/);
});

test("bots view exposes per-instance debug endpoint and correlation-aware errors", () => {
  const botsJs = read("docs/js/bots.js");
  const componentsCss = read("docs/css/components.css");

  assert.match(botsJs, /const BOTS_DEBUG_ENDPOINT = "\/api\/admin\/bots\/debug";/);
  assert.match(botsJs, /const BOTS_DEBUG_PROBE_ENDPOINT = "\/api\/admin\/bots\/debug\/probe";/);
  assert.match(botsJs, /const BOTS_DEBUG_PROBE_STATUS_ENDPOINT = "\/api\/admin\/bots\/debug\/probe\/status";/);
  assert.match(botsJs, /data-bot-debug="1"/);
  assert.match(botsJs, /data-bot-debug-probe="1"/);
  assert.match(botsJs, /Probe Now/);
  assert.match(botsJs, /reloadBotsSafely/);
  assert.doesNotMatch(botsJs, /loadBots\(/);
  assert.match(botsJs, /subscription_response_message/);
  assert.match(botsJs, /subscription_endpoint_path/);
  assert.match(botsJs, /runtimeControlLabel/);
  assert.match(botsJs, /Snapshot fallback active/);
  assert.match(botsJs, /fetch\(buildApiUrl\(`\$\{BOTS_DEBUG_PROBE_ENDPOINT\}\?async=1`\)/);
  assert.match(botsJs, /await pollBotDebugProbeStatus\(ui, token,/);
  assert.match(botsJs, /mode: "async-polling"/);
  assert.match(botsJs, /UI Transport:/);
  assert.match(botsJs, /Background refresh cancelled; current debug result preserved\./);
  assert.match(botsJs, /normalizeDashboardError/);
  assert.match(botsJs, /poll_status:/);
  assert.match(botsJs, /Auto refresh paused while debug probe is running\./);
  assert.match(botsJs, /Probe polling timed out after 120 seconds/);
  assert.doesNotMatch(botsJs, /Debug probe was cancelled\./);
  assert.doesNotMatch(botsJs, /probeAbortControllers/);
  assert.match(botsJs, /subscription_request_body_redacted/);
  assert.match(botsJs, /renderSubscriptionAttempts/);
  assert.match(botsJs, /Subscription Attempts/);
  assert.match(botsJs, /method:/);
  assert.match(botsJs, /skip_reason/);
  assert.match(botsJs, /subscription_auth_mode/);
  assert.match(botsJs, /bot\?\.transport_status \|\| bot\?\.status/);
  assert.match(botsJs, /target_source/);
  assert.match(botsJs, /Target changed/);
  assert.match(botsJs, /pipeline\.target_last_changed_at/);
  assert.match(botsJs, /Target changed by/);
  assert.match(botsJs, /pipeline\.target_changed_by/);
  assert.match(botsJs, /awaiting_first_webhook_event/);
  assert.match(botsJs, /normalized === "awaiting_first_webhook_event"\) return ""/);
  assert.match(botsJs, /values\.includes\("awaiting_first_webhook_event"\) \? "" : "ss-badge-warning"/);
  assert.match(botsJs, /listening_via_webhook/);
  assert.match(botsJs, /subscription_failed/);
  assert.match(botsJs, /renderDebugPanel\(bot, ui\)/);
  assert.match(botsJs, /Copy Debug JSON/);
  assert.match(botsJs, /renderTriggerPipeline/);
  assert.match(botsJs, /Trigger Pipeline/);
  assert.match(botsJs, /last_pipeline_outcome/);
  assert.match(botsJs, /last_suppression_reason/);
  assert.match(botsJs, /Official webhook mode active - no socket transport required\./);
  assert.match(botsJs, /Webhook trigger dispatch working\./);
  assert.match(botsJs, /Kick webhook mode is active, but trigger dispatch failed\./);
  assert.doesNotMatch(botsJs, /without claiming live\/chat success/);
  assert.match(botsJs, /webhookReadyPosture/);
  assert.match(botsJs, /last_dispatch_response_message/);
  assert.match(botsJs, /responsePayload\?\.correlation_id/);
  assert.match(botsJs, /responsePayload\?\.error_code/);
  assert.match(botsJs, /trace_source/);
  assert.match(componentsCss, /\.ss-bot-debug-panel/);
  assert.match(componentsCss, /\.ss-bot-debug-timeline/);
});

test("bots debug recent messages render as full-width collapsed expandable block", () => {
  const botsJs = read("docs/js/bots.js");
  const componentsCss = read("docs/css/components.css");

  assert.match(botsJs, /function renderRecentMessagesDebugBlock\(recent, bot, ui\)/);
  assert.match(botsJs, /formatRecentMessagesDebugText\(recent\)/);
  assert.match(botsJs, /recent\.length \? JSON\.stringify\(recent, null, 2\) : "-"/);
  assert.match(botsJs, /<div class="ss-bot-debug-pipeline">/);
  assert.match(botsJs, /<div class="ss-bot-debug-grid">[\s\S]*\$\{renderRecentMessagesDebugBlock\(recent, bot, ui\)\}/);
  assert.doesNotMatch(botsJs, /Recent messages<\/span><code>\$\{escapeHtml\(JSON\.stringify\(recent\)\)\}<\/code>/);
  assert.match(botsJs, /class="ss-bot-debug-recent-messages"/);
  assert.match(botsJs, /class="ss-bot-debug-recent-text \$\{expanded \? "is-expanded" : "is-collapsed"\}"/);
  assert.match(botsJs, /data-bot-debug-recent-toggle="1"/);
  assert.match(botsJs, /aria-expanded="\$\{expanded \? "true" : "false"\}"/);
  assert.match(botsJs, /debugRecentMessagesExpanded: ui\.debugRecentMessagesExpanded === true/);
  assert.match(botsJs, /ui\.debugRecentMessagesExpanded = ui\.debugRecentMessagesExpanded !== true/);
  assert.match(componentsCss, /\.ss-bot-debug-pipeline/);
  assert.match(componentsCss, /\.ss-bot-debug-recent-messages/);
  assert.match(componentsCss, /\.ss-bot-debug-recent-text[\s\S]*white-space: pre-wrap;/);
  assert.match(componentsCss, /\.ss-bot-debug-recent-text[\s\S]*overflow-wrap: anywhere;/);
  assert.match(componentsCss, /\.ss-bot-debug-recent-text\.is-collapsed[\s\S]*-webkit-line-clamp: 5;/);
});

test("bots view renders Kick awaiting livestream as pending without blocked count", async () => {
  const { sandbox, elements } = buildBotsSandbox({
    botPayloads: [createKickAwaitingLivestreamPayload()],
    creatorsPayload: {
      creators: [
        {
          creator_id: "Y55GHS6",
          display_name: "System",
          status: "active",
          account: { role: "system", account_status: "active", display_name: "System" }
        },
        {
          creator_id: "4TiOlvS",
          display_name: "Daniel Clancy",
          status: "active",
          account_id: "acct-daniel",
          account: { role: "creator", account_status: "active", display_name: "Daniel Clancy" }
        }
      ]
    }
  });

  sandbox.window.BotsView.init();
  await flushMicrotasks();

  assert.match(elements.get("bots-table-body").innerHTML, /Pending/);
  assert.match(elements.get("bots-table-body").innerHTML, /0 blocked\/error/);
  assert.doesNotMatch(elements.get("bots-table-body").innerHTML, /1 blocked\/error/);
  assert.match(elements.get("bots-platforms-grid").innerHTML, /Pending/);
});

test("bots manual creator selector hides system identities and labels real creators readably", async () => {
  const { sandbox, elements } = buildBotsSandbox({
    botPayloads: [createKickAwaitingLivestreamPayload()],
    creatorsPayload: {
      creators: [
        {
          creator_id: "Y55GHS6",
          display_name: "System",
          status: "active",
          account: { role: "system", account_status: "active", display_name: "System" }
        },
        {
          creator_id: "4TiOlvS",
          display_name: "Daniel Clancy",
          status: "active",
          account_id: "acct-daniel",
          account: { role: "creator", account_status: "active", display_name: "Daniel Clancy" }
        }
      ]
    }
  });

  sandbox.window.BotsView.init();
  await flushMicrotasks();

  const optionsHtml = elements.get("bots-manual-creator").innerHTML;
  assert.match(optionsHtml, /Daniel Clancy - 4TiOlvS/);
  assert.doesNotMatch(optionsHtml, /Y55GHS6 - System/);
});

test("admin rumble platform view reads live runtime posture instead of a hardcoded paused scaffold", () => {
  const rumbleHtml = read("docs/views/platforms/rumble.html");
  const rumbleJs = read("docs/js/platforms/rumble.js");
  const appJs = read("docs/js/app.js");
  const shellHtml = read("docs/index.html");

  assert.match(rumbleHtml, /Runtime Posture/);
  assert.match(rumbleHtml, /\/api\/admin\/bots\/status/);
  assert.match(rumbleHtml, /This surface mirrors runtime-owned Rumble bot availability/);
  assert.match(rumbleHtml, /Rumble Intelligence/);
  assert.match(rumbleHtml, /Search creator or channel/);
  assert.match(rumbleHtml, /Stream history entry/);
  assert.match(rumbleHtml, /Raw Runtime Debug/);
  assert.match(rumbleHtml, /Copy raw debug/);
  assert.match(rumbleJs, /const BOTS_STATUS_ENDPOINT = "\/api\/admin\/bots\/status";/);
  assert.match(rumbleJs, /const CREATOR_SUMMARY_ENDPOINT = "\/api\/admin\/creator-integrations";/);
  assert.match(rumbleJs, /\/api\/admin\/accounts\/\$\{encodeURIComponent\(accountId\)\}\/creator-integrations/);
  assert.match(rumbleJs, /No historical Rumble engagement snapshots exported yet\./);
  assert.match(rumbleJs, /resolved_watch_url/);
  assert.match(rumbleJs, /resolved_video_id/);
  assert.match(rumbleJs, /resolved_chat_id/);
  assert.match(rumbleJs, /runtimeDebug/);
  assert.match(rumbleJs, /Combined Request Timeline/);
  assert.match(rumbleJs, /window\.navigator\?\.clipboard\?\.writeText/);
  assert.match(rumbleJs, /search_blob/);
  assert.match(rumbleJs, /global_status \|\| platformRow\?\.status/);
  assert.match(rumbleJs, /creator-managed Rumble session/);
  assert.doesNotMatch(rumbleJs, /intelligenceAbortController\.abort/);
  assert.match(rumbleJs, /runtimeRefreshInFlight/);
  assert.match(rumbleJs, /intelligenceDetailSignature/);
  assert.match(appJs, /registerView\("rumble", \{/);
  assert.match(appJs, /window\.RumbleView\?\.init\?\.\(\)/);
  assert.match(shellHtml, /js\/platforms\/rumble\.js/);
  assert.doesNotMatch(rumbleJs, /Rumble ingest is paused by the runtime/);
});

test("admin rumble platform view keeps richer diagnostics and raw export tied to the runtime-backed rumble fragment", () => {
  const rumbleJs = read("docs/js/platforms/rumble.js");
  const rumbleCss = read("docs/css/components.css");

  assert.match(rumbleJs, /rumble\?\.runtime_debug/);
  assert.match(rumbleJs, /buildTimeline/);
  assert.match(rumbleJs, /Detection Summary/);
  assert.match(rumbleJs, /Identity Resolution/);
  assert.match(rumbleJs, /Browse \/ Live Request Chain/);
  assert.match(rumbleJs, /Creator Page Probe Chain/);
  assert.match(rumbleJs, /Livestream API Probe Chain/);
  assert.match(rumbleJs, /Watch Target Resolution/);
  assert.match(rumbleJs, /Stream \/ Chat Identity Resolution/);
  assert.match(rumbleJs, /Blocking \/ Stop Reason/);
  assert.match(rumbleJs, /Managed Session Posture/);
  assert.match(rumbleJs, /Freshness \/ Timestamps/);
  assert.match(rumbleJs, /No runtime-backed debug object is currently exported/);
  assert.match(rumbleCss, /\.ss-rumble-intelligence-debug-grid/);
  assert.match(rumbleCss, /\.ss-rumble-intelligence-raw-shell/);
  assert.match(rumbleCss, /\.ss-rumble-intelligence-raw-output/);
  assert.match(rumbleCss, /\.ss-rumble-intelligence-trace-block/);
});

test("admin rumble platform view renders the selected creator intelligence area and preserves selection across refresh", async () => {
  const { sandbox, elements, scheduler } = buildRumbleSandbox({
    botPayloads: [createRumbleBotsPayload(), createRumbleBotsPayload()],
    summaryPayloads: [createRumbleCreatorSummaryPayload(), createRumbleCreatorSummaryPayload()],
    detailPayloads: {
      "acct-daniel": [
        createRumbleDetailPayload({ runtimeDebug: createRumbleRuntimeDebug() }),
        createRumbleDetailPayload({ runtimeDebug: createRumbleRuntimeDebug() })
      ]
    }
  });

  sandbox.window.RumbleView.init();
  await flushMicrotasks();

  assert.equal(elements.get("rumble-intelligence-creator-select").value, "acct-daniel");
  assert.match(elements.get("rumble-intelligence-diagnostics").innerHTML, /Detection Summary/);
  assert.match(elements.get("rumble-intelligence-diagnostics").innerHTML, /Browse \/ Live Request Attempts/);

  const diagnosticsWrites = elements.get("rumble-intelligence-diagnostics").innerHTMLWrites;

  await scheduler.runNext();
  await flushMicrotasks();

  assert.equal(elements.get("rumble-intelligence-creator-select").value, "acct-daniel");
  assert.equal(elements.get("rumble-intelligence-diagnostics").innerHTMLWrites, diagnosticsWrites);
});

test("admin rumble platform view preserves the loaded creator workspace when a later summary refresh returns empty", async () => {
  const { sandbox, elements, scheduler } = buildRumbleSandbox({
    botPayloads: [createRumbleBotsPayload(), createRumbleBotsPayload()],
    summaryPayloads: [createRumbleCreatorSummaryPayload(), { items: [] }],
    detailPayloads: {
      "acct-daniel": [
        createRumbleDetailPayload({ runtimeDebug: createRumbleRuntimeDebug() }),
        createRumbleDetailPayload({ runtimeDebug: createRumbleRuntimeDebug({ variant: "changed" }) })
      ]
    }
  });

  sandbox.window.RumbleView.init();
  await flushMicrotasks();

  const initialDiagnostics = elements.get("rumble-intelligence-diagnostics").innerHTML;
  assert.equal(elements.get("rumble-intelligence-creator-select").value, "acct-daniel");
  assert.match(initialDiagnostics, /Detection Summary/);

  await scheduler.runNext();
  await flushMicrotasks();

  assert.equal(elements.get("rumble-intelligence-creator-select").value, "acct-daniel");
  assert.match(elements.get("rumble-intelligence-diagnostics").innerHTML, /Detection Summary/);
  assert.ok(elements.get("rumble-intelligence-diagnostics").innerHTML.length >= initialDiagnostics.length);
  assert.equal(elements.get("rumble-intelligence-creator-empty").classList.contains("hidden"), true);
});

test("admin rumble platform view can bind Daniel from creator summary even when no bot row exists yet", async () => {
  const runtimeDebug = createRumbleRuntimeDebug();
  const { sandbox, elements } = buildRumbleSandbox({
    botPayloads: [
      {
        ...createRumbleBotsPayload(),
        bots: [],
        platforms: [
          {
            ...createRumbleBotsPayload().platforms[0],
            details: {
              bot_blocked_count: 0,
              bot_desired_count: 0,
              bot_paused_count: 0,
              manual_override_count: 0
            }
          }
        ]
      }
    ],
    summaryPayloads: [createRumbleCreatorSummaryPayload()],
    detailPayloads: {
      "acct-daniel": [createRumbleDetailPayload({ runtimeDebug })]
    }
  });

  sandbox.window.RumbleView.init();
  await flushMicrotasks();

  assert.equal(elements.get("rumble-intelligence-creator-select").value, "acct-daniel");
  assert.match(elements.get("rumble-intelligence-creator-summary").innerHTML, /Daniel Clancy/);
  assert.match(elements.get("rumble-intelligence-diagnostics").innerHTML, /Detection Summary/);
  assert.equal(elements.get("rumble-intelligence-creator-empty").classList.contains("hidden"), true);
});

test("admin rumble raw debug block stays copy-pastable and reflects the real runtime debug payload", async () => {
  const runtimeDebug = createRumbleRuntimeDebug({ variant: "changed" });
  const { sandbox, elements, clipboardWrites } = buildRumbleSandbox({
    detailPayloads: {
      "acct-daniel": [createRumbleDetailPayload({ runtimeDebug })]
    }
  });

  sandbox.window.RumbleView.init();
  await flushMicrotasks();

  const expectedRaw = JSON.stringify(runtimeDebug, null, 2);
  assert.equal(elements.get("rumble-intelligence-raw-output").textContent, expectedRaw);
  assert.ok(!elements.get("rumble-intelligence-raw-shell").classList.contains("hidden"));

  await elements.get("rumble-intelligence-raw-copy").dispatch("click");
  await flushMicrotasks();

  assert.deepEqual(clipboardWrites, [expectedRaw]);
});

test("admin rumble platform view keeps the empty state truthful when runtime debug is absent", async () => {
  const { sandbox, elements } = buildRumbleSandbox({
    detailPayloads: {
      "acct-daniel": [createRumbleDetailPayload({ runtimeDebug: null })]
    }
  });

  sandbox.window.RumbleView.init();
  await flushMicrotasks();

  assert.match(
    elements.get("rumble-intelligence-diagnostics").innerHTML,
    /No runtime-backed debug object is currently exported for the selected creator\./
  );
  assert.ok(elements.get("rumble-intelligence-raw-shell").classList.contains("hidden"));
});

test("admin rumble platform view ignores normal poll aborts instead of surfacing the abort text as a user-facing failure", async () => {
  const abortError = Object.assign(new Error("signal is aborted without reason"), { name: "AbortError" });
  const { sandbox, elements, scheduler } = buildRumbleSandbox({
    botPayloads: [createRumbleBotsPayload(), abortError],
    summaryPayloads: [createRumbleCreatorSummaryPayload()],
    detailPayloads: {
      "acct-daniel": [createRumbleDetailPayload({ runtimeDebug: createRumbleRuntimeDebug() })]
    }
  });

  sandbox.window.RumbleView.init();
  await flushMicrotasks();

  const initialBanner = elements.get("rumble-intelligence-banner").textContent;
  const initialDiagnostics = elements.get("rumble-intelligence-diagnostics").innerHTML;

  await scheduler.runNext();
  await flushMicrotasks();

  assert.equal(elements.get("rumble-runtime-status").textContent, "Enabled / ready");
  assert.equal(elements.get("rumble-intelligence-banner").textContent, initialBanner);
  assert.equal(elements.get("rumble-intelligence-diagnostics").innerHTML, initialDiagnostics);
  assert.doesNotMatch(elements.get("rumble-runtime-error").textContent, /signal is aborted without reason/i);
  assert.doesNotMatch(elements.get("rumble-intelligence-banner").textContent, /signal is aborted without reason/i);
});

test("admin overview platform cards prefer global runtime posture over creator-session blockers", () => {
  const overviewJs = read("docs/js/overview.js");

  assert.match(overviewJs, /platform\.global_status \|\| platform\.status/);
  assert.match(overviewJs, /platform\.session_status_reason/);
  assert.match(overviewJs, /if \(status === "ready" \|\| status === "connected"\) return "success";/);
});

test("admin compact profile surfaces use the canonical social registry and restrained overflow handling", () => {
  const helperJs = read("docs/assets/js/ss-social-platforms.js");
  const hovercardJs = read("docs/assets/js/ss-profile-hovercard.js");
  const hovercardCss = read("docs/assets/css/ss-profile-hovercard.css");
  const accountsJs = read("docs/js/accounts.js");
  const userDetailJs = read("docs/js/user-detail.js");
  const shellHtml = read("docs/index.html");

  assert.match(shellHtml, /assets\/js\/ss-social-platforms\.js/);
  assert.match(helperJs, /whatsappchannels/);
  assert.match(helperJs, /icon: "\/assets\/icons\/whatsapp\.svg"/);
  assert.match(helperJs, /applepodcasts/);
  assert.match(helperJs, /aliases: \["x", "twitter"\]/);
  assert.match(helperJs, /aliases: \["website", "site", "web", "url", "homepage"\]/);
  assert.doesNotMatch(helperJs, /dlive/i);
  assert.match(hovercardJs, /getSocialPlatformApi/);
  assert.match(hovercardJs, /collectOrderedSocialEntries/);
  assert.match(hovercardJs, /links\.slice\(0, 8\)/);
  assert.match(hovercardJs, /social-overflow-indicator/);
  assert.match(accountsJs, /buildCompactSocialMarkup/);
  assert.match(accountsJs, /entries\.slice\(0, 8\)/);
  assert.match(userDetailJs, /buildCompactSocialMarkup/);
  assert.match(hovercardCss, /\.social-overflow-indicator/);
});

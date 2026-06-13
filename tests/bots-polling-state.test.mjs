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
  setFromString(value) {
    this.tokens = new Set(String(value || "").split(/\s+/).filter(Boolean));
    this.owner._className = Array.from(this.tokens).join(" ");
  }
  add(...values) {
    values.filter(Boolean).forEach((value) => this.tokens.add(value));
    this.owner._className = Array.from(this.tokens).join(" ");
  }
  remove(...values) {
    values.filter(Boolean).forEach((value) => this.tokens.delete(value));
    this.owner._className = Array.from(this.tokens).join(" ");
  }
  toggle(value, force) {
    if (force === true) this.tokens.add(value);
    else if (force === false) this.tokens.delete(value);
    else if (this.tokens.has(value)) this.tokens.delete(value);
    else this.tokens.add(value);
    this.owner._className = Array.from(this.tokens).join(" ");
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
    this.dataset = {};
    this.listeners = new Map();
    this.classList = new FakeClassList(this);
  }
  get innerHTML() {
    return this._innerHTML;
  }
  set innerHTML(value) {
    this._innerHTML = String(value || "");
    this.innerHTMLWrites += 1;
  }
  set className(value) {
    this.classList.setFromString(value);
  }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }
  setAttribute(name, value) {
    this[name] = String(value);
  }
}

class FakeButtonElement extends FakeElement {}

class FakeTimerScheduler {
  constructor() {
    this.nextId = 1;
    this.tasks = new Map();
  }
  setTimeout(callback, delay = 0) {
    const id = this.nextId++;
    this.tasks.set(id, { callback, delay });
    return id;
  }
  clearTimeout(id) {
    this.tasks.delete(id);
  }
  async runNext() {
    const [id, task] = this.tasks.entries().next().value || [];
    if (!id) return;
    this.tasks.delete(id);
    await task.callback();
  }
}

function twitchPayload({
  reason = "first status reason",
  includeRow = true,
  sessionId = "twitch-session-one",
  messageSuffix = "one"
} = {}) {
  return {
    generated_at: "2026-06-13T01:00:00Z",
    server_generated_at: "2026-06-13T01:00:00Z",
    supported_platforms: ["twitch"],
    platform_capabilities: {
      twitch: { platform: "twitch", label: "Twitch", manual_deploy_enabled: true, staged: false }
    },
    platforms: [{ platform: "twitch", label: "Twitch", available: true, status: "ready", global_status: "ready" }],
    bots: includeRow ? [{
      creator_id: "creator-twitch",
      creator_display_name: "Daniel",
      platform: "twitch",
      session_type: "auto",
      session_id: sessionId,
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
      last_heartbeat_at: "2026-06-13T01:00:00Z",
      last_dispatch_response_message: `dispatch ${messageSuffix}`
    }] : []
  };
}

function debugPayload() {
  const recent = Array.from({ length: 8 }, (_, index) => ({
    timestamp: `2026-06-13T01:00:0${index}Z`,
    message_id: `msg-${index}`,
    message_text_summary: { command: "!ping", length: 5 }
  }));
  return {
    success: true,
    generated_at: "2026-06-13T01:00:00Z",
    bot: { platform: "twitch", lifecycle_status: "listening", transport_status: "eventsub_websocket_connected", runner_status: "listening" },
    diagnostics: {
      summary: { event_count: 3, trace_source: "persisted" },
      trigger_pipeline: { recent_messages: recent },
      exports: { session_snapshot: {} }
    }
  };
}

function currentVsHistoryDebugPayload() {
  return {
    success: true,
    generated_at: "2026-06-13T01:00:00Z",
    bot: {
      platform: "twitch",
      creator_id: "creator-twitch",
      session_id: "twitch-eventsub-current",
      lifecycle_status: "listening",
      transport_status: "eventsub_websocket_connected",
      runner_status: "listening"
    },
    diagnostics: {
      summary: { event_count: 2, trace_source: "persisted", latest_error_code: null },
      current_attempt: {
        current_session_id: "twitch-eventsub-current",
        current_session_status: "listening_no_messages_yet",
        current_session_last_keepalive_at: "2026-06-13T01:00:00Z",
        current_session_last_notification_at: null,
        current_session_last_chat_message_at: null,
        current_session_last_dispatch_status: "no_current_session_dispatch_attempt",
        current_session_last_dispatch_response_message: null
      },
      trigger_pipeline: {
        last_pipeline_outcome: "listening_no_messages_yet",
        last_dispatch_status: "no_current_session_dispatch_attempt",
        last_dispatch_response_message: null,
        recent_messages: []
      },
      timeline: [
        {
          timestamp: "2026-06-13T00:50:00Z",
          severity: "error",
          phase: "dispatch_result",
          step: "TwitchChatWorker._process_trigger_actions",
          message: "Twitch dispatch attempt completed.",
          code: "DISPATCH_FAILED",
          history_scope: "history",
          session_id: "twitch-eventsub-old"
        },
        {
          timestamp: "2026-06-13T01:00:00Z",
          severity: "info",
          phase: "heartbeat",
          step: "session_keepalive",
          message: "Twitch EventSub keepalive received.",
          history_scope: "current_session",
          session_id: "twitch-eventsub-current"
        }
      ],
      history_timeline: [
        {
          timestamp: "2026-06-13T00:50:00Z",
          severity: "error",
          phase: "dispatch_result",
          message: "old dispatch failure"
        }
      ],
      exports: { session_snapshot: {} }
    }
  };
}

function openingHandshakeDebugPayload() {
  return {
    success: true,
    generated_at: "2026-06-13T01:00:00Z",
    bot: {
      platform: "twitch",
      creator_id: "creator-twitch",
      session_id: "twitch-eventsub-open-attempt",
      lifecycle_status: "reconnecting",
      transport_status: "websocket_open_timeout",
      runner_status: "reconnecting",
      readiness_reason: "timed out during opening handshake"
    },
    diagnostics: {
      summary: { event_count: 3, trace_source: "persisted", latest_error_code: "websocket_open_timeout" },
      current_attempt: {
        current_session_id: "twitch-eventsub-open-attempt",
        current_subscription_result: "websocket_open_timeout",
        current_subscription_request_body_redacted: {},
        current_session_status: "eventsub_opening_handshake",
        connection_stage: "eventsub_opening_handshake",
        transport_error_code: "websocket_open_timeout",
        transport_error_message: "timed out during opening handshake",
        current_session_reconnect_attempt_count: 2,
        current_session_next_retry_at: "2026-06-13T01:00:30Z",
        current_session_last_dispatch_status: "no_current_session_dispatch_attempt",
        current_session_last_dispatch_response_message: null
      },
      trigger_pipeline: { recent_messages: [] },
      timeline: [
        {
          timestamp: "2026-06-13T00:50:00Z",
          severity: "error",
          phase: "heartbeat",
          message: "received 4002 failed ping pong",
          code: "FAILED_PING_PONG",
          history_scope: "history",
          session_id: "twitch-eventsub-old"
        }
      ],
      history_timeline: [
        {
          timestamp: "2026-06-13T00:50:00Z",
          severity: "error",
          phase: "dispatch_result",
          message: "old dispatch failure"
        }
      ],
      exports: { session_snapshot: {} }
    }
  };
}

function buildBotsSandbox({ botPayloads, debugPayloads = [debugPayload()], scroll = { x: 0, y: 0 } } = {}) {
  const ids = [
    "bots-status", "bots-count", "bots-generated-at", "bots-source", "bots-error",
    "bots-hidden-note", "bots-platforms-status", "bots-platforms-grid", "bots-live-total",
    "bots-manual-toggle", "bots-manual-form", "bots-manual-creator", "bots-manual-platform",
    "bots-manual-platform-fields", "bots-manual-submit", "bots-manual-cancel",
    "bots-manual-note", "bots-manual-error", "bots-table-body", "bots-empty"
  ];
  const elements = new Map(ids.map((id) => [id, new FakeElement(id)]));
  const scheduler = new FakeTimerScheduler();
  const scrollCalls = [];
  let botFetchIndex = 0;
  let debugFetchIndex = 0;

  async function fetchMock(url) {
    const href = String(url);
    if (href.includes("/api/admin/bots/status")) {
      const payload = botPayloads[Math.min(botFetchIndex, botPayloads.length - 1)];
      botFetchIndex += 1;
      return { ok: true, status: 200, async json() { return payload; } };
    }
    if (href.includes("/api/admin/bots/debug")) {
      const payload = debugPayloads[Math.min(debugFetchIndex, debugPayloads.length - 1)];
      debugFetchIndex += 1;
      return { ok: true, status: 200, async json() { return payload; } };
    }
    if (href.includes("/api/admin/creators")) {
      return { ok: true, status: 200, async json() { return { creators: [{ creator_id: "creator-twitch", display_name: "Daniel", tier: "pro", status: "active" }] }; } };
    }
    throw new Error(`Unexpected fetch: ${href}`);
  }

  const document = {
    activeElement: null,
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector() {
      return null;
    }
  };
  const window = {
    setTimeout: scheduler.setTimeout.bind(scheduler),
    clearTimeout: scheduler.clearTimeout.bind(scheduler),
    fetch: fetchMock,
    scrollX: scroll.x,
    scrollY: scroll.y,
    scrollTo(x, y) {
      scrollCalls.push({ x, y });
      this.scrollX = x;
      this.scrollY = y;
    },
    location: { pathname: "/bots" },
    StreamSuitesDashboardPermissions: { has: () => true },
    StreamSuitesAdminAuth: { config: { baseUrl: "" } },
    prompt: () => null
  };
  const sandbox = {
    window,
    document,
    fetch: fetchMock,
    console,
    AbortController,
    URLSearchParams,
    setTimeout: scheduler.setTimeout.bind(scheduler),
    clearTimeout: scheduler.clearTimeout.bind(scheduler),
    HTMLButtonElement: FakeButtonElement,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail || {};
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(read("docs/js/bots.js"), sandbox);
  return { sandbox, elements, scheduler, scrollCalls };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

function clickBotsTable(elements, { selector, element }) {
  const handlers = Array.from(elements.get("bots-table-body").listeners.get("click") || []);
  assert.ok(handlers.length > 0, "bots table click listener is registered");
  return Promise.all(handlers.map((handler) => handler({
    target: { closest(candidate) { return candidate === selector ? element : null; } },
    preventDefault() {}
  })));
}

async function openTwitchInspection(elements) {
  const expand = new FakeButtonElement("expand");
  expand.dataset.botExpand = encodeURIComponent("creator-twitch");
  await clickBotsTable(elements, { selector: "[data-bot-expand]", element: expand });

  const debug = new FakeButtonElement("debug");
  debug.dataset.creatorId = encodeURIComponent("creator-twitch");
  debug.dataset.platform = encodeURIComponent("twitch");
  debug.dataset.sessionId = encodeURIComponent("twitch-session-one");
  await clickBotsTable(elements, { selector: "[data-bot-debug]", element: debug });
  await flushMicrotasks();

  const recent = new FakeButtonElement("recent");
  recent.dataset.creatorId = encodeURIComponent("creator-twitch");
  recent.dataset.platform = encodeURIComponent("twitch");
  recent.dataset.sessionId = encodeURIComponent("twitch-session-one");
  await clickBotsTable(elements, { selector: "[data-bot-debug-recent-toggle]", element: recent });
}

async function runUntilTableMatches(scheduler, elements, pattern, attempts = 6) {
  for (let index = 0; index < attempts; index += 1) {
    if (pattern.test(elements.get("bots-table-body").innerHTML)) return;
    await scheduler.runNext();
    await flushMicrotasks();
  }
}

test("Bots polling preserves creator, platform, debug, recent-message, scroll state while content updates", async () => {
  const { sandbox, elements, scheduler, scrollCalls } = buildBotsSandbox({
    botPayloads: [
      twitchPayload({ reason: "first status reason", sessionId: "twitch-session-one", messageSuffix: "one" }),
      twitchPayload({ reason: "updated status reason", sessionId: "twitch-session-two", messageSuffix: "two" })
    ],
    scroll: { x: 12, y: 640 }
  });
  sandbox.window.BotsView.init();
  await flushMicrotasks();
  await openTwitchInspection(elements);

  assert.match(elements.get("bots-table-body").innerHTML, /ss-bot-instance-card/);
  assert.match(elements.get("bots-table-body").innerHTML, /ss-bot-debug-panel/);
  assert.match(elements.get("bots-table-body").innerHTML, /ss-bot-debug-recent-text is-expanded/);

  await runUntilTableMatches(scheduler, elements, /updated status reason/);

  const html = elements.get("bots-table-body").innerHTML;
  assert.match(html, /updated status reason/);
  assert.match(html, /twitch-session-two/);
  assert.match(html, /ss-bot-instance-card/);
  assert.match(html, /ss-bot-debug-panel/);
  assert.match(html, /ss-bot-debug-recent-text is-expanded/);
  assert.ok(scrollCalls.some((entry) => entry.x === 12 && entry.y === 640));
  assert.equal(sandbox.window.scrollY, 640);
});

test("Bots manual refresh uses the same state-preserving flow as polling", async () => {
  const { sandbox, elements } = buildBotsSandbox({
    botPayloads: [
      twitchPayload({ reason: "manual first", sessionId: "twitch-session-one" }),
      twitchPayload({ reason: "manual refreshed", sessionId: "twitch-session-three" })
    ]
  });
  sandbox.window.BotsView.init();
  await flushMicrotasks();
  await openTwitchInspection(elements);

  await sandbox.window.BotsView.refresh();
  await flushMicrotasks();

  const html = elements.get("bots-table-body").innerHTML;
  assert.match(html, /manual refreshed/);
  assert.match(html, /twitch-session-three/);
  assert.match(html, /ss-bot-instance-card/);
  assert.match(html, /ss-bot-debug-panel/);
  assert.match(html, /ss-bot-debug-recent-text is-expanded/);
});

test("Bots refresh prunes saved drawer state only after the row disappears", async () => {
  const { sandbox, elements, scheduler } = buildBotsSandbox({
    botPayloads: [
      twitchPayload({ reason: "present", sessionId: "twitch-session-one" }),
      twitchPayload({ includeRow: false })
    ]
  });
  sandbox.window.BotsView.init();
  await flushMicrotasks();
  await openTwitchInspection(elements);

  for (let index = 0; index < 6 && /ss-bot-instance-card/.test(elements.get("bots-table-body").innerHTML); index += 1) {
    await scheduler.runNext();
    await flushMicrotasks();
  }

  const html = elements.get("bots-table-body").innerHTML;
  assert.doesNotMatch(html, /ss-bot-instance-card/);
  assert.doesNotMatch(html, /ss-bot-debug-panel/);
  assert.doesNotMatch(html, /creator-twitch/);
});

test("Bots debug shows current Twitch session placeholders while preserving old failures as history", async () => {
  const { sandbox, elements } = buildBotsSandbox({
    botPayloads: [twitchPayload({ reason: "Twitch EventSub keepalive received.", sessionId: "twitch-eventsub-current" })],
    debugPayloads: [currentVsHistoryDebugPayload()]
  });
  sandbox.window.BotsView.init();
  await flushMicrotasks();

  const expand = new FakeButtonElement("expand");
  expand.dataset.botExpand = encodeURIComponent("creator-twitch");
  await clickBotsTable(elements, { selector: "[data-bot-expand]", element: expand });

  const debug = new FakeButtonElement("debug");
  debug.dataset.creatorId = encodeURIComponent("creator-twitch");
  debug.dataset.platform = encodeURIComponent("twitch");
  debug.dataset.sessionId = encodeURIComponent("twitch-eventsub-current");
  await clickBotsTable(elements, { selector: "[data-bot-debug]", element: debug });
  await flushMicrotasks();

  const html = elements.get("bots-table-body").innerHTML;
  assert.match(html, /listening_no_messages_yet/);
  assert.match(html, /no_current_session_dispatch_attempt/);
  assert.match(html, /History/);
  assert.match(html, /old dispatch failure|DISPATCH_FAILED/);
});

test("Bots debug shows active Twitch opening handshake timeout and retry details", async () => {
  const { sandbox, elements } = buildBotsSandbox({
    botPayloads: [twitchPayload({
      reason: "timed out during opening handshake",
      sessionId: "twitch-eventsub-open-attempt"
    })],
    debugPayloads: [openingHandshakeDebugPayload()]
  });
  sandbox.window.BotsView.init();
  await flushMicrotasks();

  const expand = new FakeButtonElement("expand");
  expand.dataset.botExpand = encodeURIComponent("creator-twitch");
  await clickBotsTable(elements, { selector: "[data-bot-expand]", element: expand });

  const debug = new FakeButtonElement("debug");
  debug.dataset.creatorId = encodeURIComponent("creator-twitch");
  debug.dataset.platform = encodeURIComponent("twitch");
  debug.dataset.sessionId = encodeURIComponent("twitch-eventsub-open-attempt");
  await clickBotsTable(elements, { selector: "[data-bot-debug]", element: debug });
  await flushMicrotasks();

  const html = elements.get("bots-table-body").innerHTML;
  assert.match(html, /websocket_open_timeout/);
  assert.match(html, /eventsub_opening_handshake/);
  assert.match(html, /Retry attempt/);
  assert.match(html, />2<\/strong>/);
  assert.match(html, /2026-06-13T01:00:30Z/);
  assert.match(html, /History/);
  assert.match(html, /old dispatch failure/);
  assert.doesNotMatch(html, /Current attempt<\/span><strong>subscription_failed/);
});

test("Bots polling keeps Twitch debug drawer open across current session id rotation", async () => {
  const { sandbox, elements, scheduler } = buildBotsSandbox({
    botPayloads: [
      twitchPayload({ reason: "first", sessionId: "twitch-session-one" }),
      twitchPayload({ reason: "rotated", sessionId: "twitch-session-two" })
    ],
    debugPayloads: [debugPayload()]
  });
  sandbox.window.BotsView.init();
  await flushMicrotasks();
  await openTwitchInspection(elements);

  await runUntilTableMatches(scheduler, elements, /rotated/);

  const html = elements.get("bots-table-body").innerHTML;
  assert.match(html, /twitch-session-two/);
  assert.match(html, /ss-bot-debug-panel/);
  assert.match(html, /ss-bot-instance-card/);
});

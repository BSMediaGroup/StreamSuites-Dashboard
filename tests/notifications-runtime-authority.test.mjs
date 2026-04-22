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

  setAttribute(name, value) {
    this[name] = String(value);
  }

  removeAttribute(name) {
    delete this[name];
  }
}

class FakeButtonElement extends FakeElement {}

class FakeTimerScheduler {
  constructor() {
    this.nextId = 1;
    this.tasks = new Map();
  }

  setTimeout(callback, delay = 0) {
    const id = this.nextId += 1;
    this.tasks.set(id, { callback, delay });
    return id;
  }

  clearTimeout(id) {
    this.tasks.delete(id);
  }

  pendingCount() {
    return this.tasks.size;
  }

  async runNext() {
    const [id, task] = this.tasks.entries().next().value || [];
    if (!id) return;
    this.tasks.delete(id);
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

function buildBotsSandbox({ botPayloads = [createBotsPayload()], creatorsPayload } = {}) {
  const ids = [
    "bots-status",
    "bots-count",
    "bots-generated-at",
    "bots-source",
    "bots-error",
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

  async function fetchMock(url) {
    const href = String(url);
    if (href.includes("/api/admin/bots/status")) {
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
    if (href.includes("/api/admin/creators")) {
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
    prompt: () => null,
    StreamSuitesDashboardPermissions: { has: () => true },
    StreamSuitesAdminAuth: { config: { baseUrl: "" } }
  };

  const sandbox = {
    window,
    document,
    fetch: fetchMock,
    console,
    AbortController,
    setTimeout: scheduler.setTimeout.bind(scheduler),
    clearTimeout: scheduler.clearTimeout.bind(scheduler),
    HTMLButtonElement: FakeButtonElement
  };

  vm.createContext(sandbox);
  vm.runInContext(read("docs/js/bots.js"), sandbox);
  return { sandbox, elements, scheduler };
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

  assert.match(botsHtml, /<th>Session<\/th>/);
  assert.match(botsHtml, /<th>Lifecycle<\/th>/);
  assert.match(botsHtml, /<th>Transport<\/th>/);
  assert.match(botsHtml, /<th>Blocking \/ Error<\/th>/);
  assert.match(botsJs, /session_type/);
  assert.match(botsJs, /Managed/);
  assert.match(botsJs, /renderTargetCell/);
  assert.match(botsJs, /renderBlockingCell/);
  assert.match(botsJs, /Open watch target/);
  assert.match(botsJs, /session_blocking_codes/);
  assert.match(botsJs, /const globalStatus = String\(runtime\?\.globalStatus \|\| runtime\?\.status \|\| ""\)/);
  assert.match(botsJs, /const sessionStatus = String\(runtime\?\.sessionStatus \|\| runtime\?\.details\?\.session_status \|\| ""\)/);
  assert.match(botsJs, /sessionStatus === "awaiting_live"/);
  assert.match(botsJs, /sessionStatus === "live_target_unresolved"/);
  assert.match(botsJs, /creator-managed session/);
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
  assert.match(elements.get("bots-table-body").innerHTML, /browse_live_request_failed/);
  assert.match(
    elements.get("bots-table-body").innerHTML,
    /Rumble browse\/live detection failed before a trustworthy offline result could be established\./
  );
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
  assert.match(rumbleJs, /Request Chain \/ Stage Timeline/);
  assert.match(rumbleJs, /window\.navigator\?\.clipboard\?\.writeText/);
  assert.match(rumbleJs, /search_blob/);
  assert.match(rumbleJs, /global_status \|\| platformRow\?\.status/);
  assert.match(rumbleJs, /creator-managed Rumble session/);
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
  assert.match(rumbleJs, /Selected Identity/);
  assert.match(rumbleJs, /Watch Target Resolution/);
  assert.match(rumbleJs, /Chat Stream Resolution/);
  assert.match(rumbleJs, /Blocking \/ Stop Reason/);
  assert.match(rumbleJs, /Managed Session \/ Attach Readiness/);
  assert.match(rumbleJs, /Freshness \/ Timestamps/);
  assert.match(rumbleJs, /No runtime-backed debug object is currently exported/);
  assert.match(rumbleCss, /\.ss-rumble-intelligence-debug-grid/);
  assert.match(rumbleCss, /\.ss-rumble-intelligence-raw-shell/);
  assert.match(rumbleCss, /\.ss-rumble-intelligence-raw-output/);
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

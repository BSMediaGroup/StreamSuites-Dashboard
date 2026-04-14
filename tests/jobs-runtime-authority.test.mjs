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
    this.innerHTML = "";
    this.textContent = "";
    this._className = "";
    this.classList = new FakeClassList(this);
  }

  get className() {
    return this._className;
  }

  set className(value) {
    this.classList.setFromString(value);
  }
}

function buildSandbox(loadMap) {
  const ids = [
    "jobs-banner",
    "jobs-error",
    "jobs-feed-status",
    "jobs-source-mode",
    "jobs-total",
    "jobs-modules-enabled",
    "jobs-modules-disabled",
    "jobs-restart-posture",
    "jobs-readonly-posture",
    "jobs-modules-body",
    "jobs-modules-empty",
    "jobs-latest-body",
    "jobs-latest-empty",
    "jobs-status-body",
    "jobs-status-empty",
    "jobs-type-body",
    "jobs-type-empty",
    "jobs-creator-body",
    "jobs-creator-empty",
    "jobs-empty-state",
    "jobs-restart-notes"
  ];

  const elements = new Map(ids.map((id) => [id, new FakeElement(id)]));
  elements.get("jobs-error").className = "hidden";
  elements.get("jobs-modules-empty").className = "hidden";
  elements.get("jobs-latest-empty").className = "hidden";
  elements.get("jobs-status-empty").className = "hidden";
  elements.get("jobs-type-empty").className = "hidden";
  elements.get("jobs-creator-empty").className = "hidden";
  elements.get("jobs-empty-state").className = "hidden";

  const document = {
    getElementById(id) {
      return elements.get(id) || null;
    }
  };

  const window = {
    __RUNTIME_AVAILABLE__: false,
    __STREAMSUITES_RUNTIME_OFFLINE__: false,
    StreamSuitesState: {
      loadStateJson: async (relativePath) => {
        if (relativePath in loadMap) return loadMap[relativePath];
        return null;
      }
    }
  };

  const sandbox = {
    window,
    document,
    console,
    AbortController,
    setTimeout,
    clearTimeout
  };

  vm.createContext(sandbox);
  vm.runInContext(read("docs/js/jobs.js"), sandbox);
  return { sandbox, elements };
}

test("admin jobs route is unload-safe and describes authoritative runtime-backed oversight", () => {
  const appJs = read("docs/js/app.js");
  const jobsHtml = read("docs/views/jobs.html");

  assert.match(appJs, /registerView\("jobs"/);
  assert.match(appJs, /onUnload:\s*\(\)\s*=>\s*window\.JobsView\?\.destroy\?\.\(\)/);
  assert.match(jobsHtml, /Operator-facing oversight for the runtime-authored jobs export/);
  assert.match(
    jobsHtml,
    /Future clip automation jobs will appear here once that module starts\s+exporting real runtime job rows/
  );
});

test("jobs view hydrates authoritative exports and renders summaries when jobs exist", async () => {
  const { sandbox, elements } = buildSandbox({
    "jobs.json": {
      jobs: [
        { id: "job-1", type: "clip", creator_id: "daniel", status: "running", updated_at: 1710000000 },
        { id: "job-2", type: "poll", creator_id: "daniel", status: "queued", updated_at: 1710000200 },
        { id: "job-3", type: "tally", creator_id: "alex", status: "completed", updated_at: 1710000400 }
      ]
    },
    "runtime_snapshot.json": {
      jobs: [
        { name: "clips", enabled: true, applied: false, reason: "restart required" },
        { name: "polls", enabled: false, applied: true, reason: "disabled in config" }
      ],
      restart_intent: {
        required: true,
        pending: { system: true, creators: false, triggers: false, platforms: false },
        notes: ["System settings changed"]
      }
    }
  });

  await sandbox.window.JobsView.init();

  assert.equal(elements.get("jobs-feed-status").textContent, "Available");
  assert.equal(elements.get("jobs-total").textContent, "3");
  assert.equal(elements.get("jobs-modules-enabled").textContent, "1");
  assert.equal(elements.get("jobs-modules-disabled").textContent, "1");
  assert.equal(elements.get("jobs-restart-posture").textContent, "Restart required");
  assert.equal(elements.get("jobs-readonly-posture").textContent, "Runtime-owned");
  assert.match(elements.get("jobs-status-body").innerHTML, /Running/);
  assert.match(elements.get("jobs-type-body").innerHTML, /Clip/);
  assert.match(elements.get("jobs-creator-body").innerHTML, /daniel/);
  assert.match(elements.get("jobs-latest-body").innerHTML, /job-3/);
  assert.match(elements.get("jobs-modules-body").innerHTML, /clips/i);
  assert.match(elements.get("jobs-restart-notes").innerHTML, /System settings changed|waiting for apply\/restart/i);
});

test("jobs view renders a finished empty state when the export exists but has no jobs", async () => {
  const { sandbox, elements } = buildSandbox({
    "jobs.json": { jobs: [] },
    "runtime_snapshot.json": {
      jobs: [{ name: "polls", enabled: true, applied: true }],
      restart_intent: { required: false, pending: {} }
    }
  });

  await sandbox.window.JobsView.init();

  assert.equal(elements.get("jobs-feed-status").textContent, "Available");
  assert.equal(elements.get("jobs-total").textContent, "0");
  assert.equal(elements.get("jobs-empty-state").classList.contains("hidden"), false);
  assert.equal(elements.get("jobs-latest-empty").classList.contains("hidden"), false);
  assert.equal(elements.get("jobs-status-empty").classList.contains("hidden"), false);
  assert.equal(elements.get("jobs-type-empty").classList.contains("hidden"), false);
  assert.equal(elements.get("jobs-creator-empty").classList.contains("hidden"), false);
});

test("jobs view handles missing or thin runtime export data without crashing", async () => {
  const { sandbox, elements } = buildSandbox({
    "jobs.json": null,
    "runtime_snapshot.json": {
      jobs: [{ name: "tallies", enabled: false, applied: true, reason: "disabled in config" }]
    }
  });

  await sandbox.window.JobsView.init();

  assert.equal(elements.get("jobs-feed-status").textContent, "Missing");
  assert.equal(elements.get("jobs-total").textContent, "—");
  assert.match(elements.get("jobs-banner").textContent, /No published jobs feed is available yet/);
  assert.match(elements.get("jobs-modules-body").innerHTML, /tallies/i);
  assert.equal(elements.get("jobs-error").classList.contains("hidden"), true);
});

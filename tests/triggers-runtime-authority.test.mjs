import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("admin triggers route is runtime/Auth-backed and unload-safe", () => {
  const appJs = read("docs/js/app.js");
  const triggersJs = read("docs/js/triggers.js");
  const triggersHtml = read("docs/views/triggers.html");
  const routesJs = read("docs/js/admin-routes.js");
  const functionsJs = read("functions/[[path]].js");
  const shellHtml = read("index.html");
  const docsShellHtml = read("docs/index.html");

  assert.match(appJs, /registerView\("triggers"/);
  assert.match(appJs, /onUnload:\s*\(\)\s*=>\s*window\.TriggersView\?\.destroy\?\.\(\)/);
  assert.match(routesJs, /canonical:\s*"\/integrations\/triggers"/);
  assert.match(routesJs, /aliases:\s*\["\/triggers",\s*"\/chat-triggers"\]/);
  assert.match(functionsJs, /"\/integrations\/triggers"/);
  assert.match(functionsJs, /"\/triggers"/);
  assert.match(shellHtml, /"js\/triggers\.js"/);
  assert.match(docsShellHtml, /"js\/triggers\.js"/);
  assert.ok(shellHtml.indexOf('"js/triggers.js"') < shellHtml.indexOf('"js/app.js"'));
  assert.ok(docsShellHtml.indexOf('"js/triggers.js"') < docsShellHtml.indexOf('"js/app.js"'));
  assert.match(triggersJs, /ADMIN_TRIGGER_EDITOR_ENDPOINT = "\/api\/admin\/livechat\/trigger-editor"/);
  assert.match(triggersJs, /ADMIN_CUSTOM_TRIGGERS_ENDPOINT = "\/api\/admin\/livechat\/custom-triggers"/);
  assert.match(triggersJs, /requestJson\(ADMIN_TRIGGER_EDITOR_ENDPOINT, \{ signal, section: "editor contract" \}\)/);
  assert.match(triggersJs, /state\.abortController = new AbortController\(\)/);
  assert.match(triggersJs, /destroy\(\) \{/);
  assert.match(triggersHtml, /Trigger Command Center/);
  assert.match(triggersHtml, /Global Trigger Library/);
  assert.match(triggersHtml, /Runtime\/Auth editor contract/);
  assert.match(triggersHtml, /Creator Scoped Custom Triggers/);
  assert.match(triggersHtml, /Effective Command Set/);
  assert.match(triggersHtml, /Planned Modules Roadmap/);
  assert.match(triggersHtml, /triggers-diagnostics/);
});

test("admin trigger oversight exposes grouped active and planned runtime metadata", () => {
  const triggersJs = read("docs/js/triggers.js");
  const triggersHtml = read("docs/views/triggers.html");
  const componentsCss = read("docs/css/components.css");

  assert.match(triggersJs, /CATEGORY_DEFS/);
  assert.match(triggersJs, /Active Built-in \/ Core Bot Commands/);
  assert.match(triggersJs, /Active XP \/ Rank Commands/);
  assert.match(triggersJs, /System \/ Admin Commands/);
  assert.match(triggersJs, /Planned Economy \/ Inventory Commands/);
  assert.match(triggersJs, /Planned Game Commands/);
  assert.match(triggersJs, /Planned Clips \/ FFmpeg Commands/);
  assert.match(triggersJs, /categoryForTrigger/);
  assert.match(triggersJs, /xp.*rank.*progression.*level/);
  assert.match(triggersJs, /clip.*ffmpeg/);
  assert.match(triggersJs, /permission/);
  assert.match(triggersJs, /validation/);
  assert.match(triggersJs, /response_preview_text/);
  assert.match(triggersJs, /module_status/);
  assert.match(triggersJs, /renderEffectiveCommandList/);
  assert.match(triggersJs, /renderValidationOutput/);
  assert.match(triggersJs, /renderGameRows/);
  assert.match(triggersJs, /read_only/);
  assert.match(triggersJs, /Total effective triggers/);
  assert.match(triggersJs, /Active triggers/);
  assert.match(triggersJs, /Custom triggers/);
  assert.match(triggersJs, /Staged \/ planned/);
  assert.match(triggersJs, /Validation warnings/);
  assert.match(triggersHtml, /triggers-category-filter/);
  assert.match(triggersHtml, /triggers-creator-filter/);
  assert.match(triggersHtml, /Runtime-backed trigger editor/);
  assert.match(triggersHtml, /Validation \/ Warnings/);
  assert.match(componentsCss, /\.ss-trigger-filter-panel select\.ss-input/);
  assert.match(componentsCss, /grid-template-columns:\s*minmax\(620px,\s*1fr\)\s*minmax\(430px,\s*0\.52fr\)/);
  assert.match(componentsCss, /\.ss-trigger-effective-main/);
  assert.match(componentsCss, /\.ss-trigger-summary-strip/);
  assert.doesNotMatch(triggersJs, /\/api\/admin\/runtime\/rumble-dispatch/);
});

test("admin trigger oversight hydrates custom configs from runtime/Auth and mutates only account-scoped custom rows", () => {
  const triggersJs = read("docs/js/triggers.js");
  const triggersHtml = read("docs/views/triggers.html");

  assert.match(triggersJs, /state\.customItems/);
  assert.match(triggersJs, /state\.customError/);
  assert.match(triggersJs, /state\.customLoading/);
  assert.match(triggersJs, /state\.editorError/);
  assert.match(triggersJs, /state\.diagnostics/);
  assert.match(triggersJs, /booting view/);
  assert.match(triggersJs, /loading editor contract/);
  assert.match(triggersJs, /loading creator scoped triggers/);
  assert.match(triggersJs, /loading effective command set/);
  assert.match(triggersJs, /ready: hydrated from/);
  assert.match(triggersJs, /partial failure/);
  assert.match(triggersJs, /recordDiagnostic/);
  assert.match(triggersJs, /Retry Runtime\/Auth Load/);
  assert.match(triggersJs, /filteredCustomTriggers/);
  assert.match(triggersJs, /loadCustomTriggers/);
  assert.match(triggersJs, /Runtime\/Auth custom trigger configs are unavailable/);
  assert.match(triggersJs, /data-custom-trigger-retry/);
  assert.match(triggersJs, /Runtime\/Auth returned no creator-scoped custom trigger config rows/);
  assert.match(triggersJs, /ADMIN_TRIGGER_EDITOR_VALIDATE_ENDPOINT/);
  assert.match(triggersJs, /ADMIN_TRIGGER_EDITOR_DRY_RUN_ENDPOINT/);
  assert.match(triggersJs, /runPreview/);
  assert.match(triggersJs, /\/api\/admin\/accounts\/\$\{encodeURIComponent\(creatorId\)\}\/creator-triggers\/\$\{encodeURIComponent\(triggerId\)\}/);
  assert.match(triggersJs, /data-custom-trigger-toggle/);
  assert.match(triggersJs, /data-custom-trigger-delete/);
  assert.match(triggersHtml, /account-scoped authority identifiers/);
  assert.match(triggersHtml, /Preview \/ Dry Run/);
  assert.match(triggersHtml, /Runtime-backed matching, validation, permissions, cooldown, and response preview/);
  assert.match(triggersHtml, /triggers-preview-form/);
  assert.match(triggersHtml, /triggers-preview-role/);
  assert.doesNotMatch(triggersJs, /localStorage/);
  assert.doesNotMatch(triggersJs, /rumble-dispatch/);
});

test("admin trigger command center keeps dry-run and selected effective set runtime-backed", () => {
  const triggersJs = read("docs/js/triggers.js");
  const triggersHtml = read("docs/views/triggers.html");

  assert.match(triggersJs, /requestJson\(ADMIN_TRIGGER_EDITOR_ENDPOINT, \{ signal, section: "editor contract" \}\)/);
  assert.match(triggersJs, /renderAll\(\)/);
  assert.match(triggersJs, /renderCustomRows\(\)/);
  assert.match(triggersJs, /requestJson\(ADMIN_TRIGGER_EDITOR_VALIDATE_ENDPOINT/);
  assert.match(triggersJs, /requestJson\(ADMIN_TRIGGER_EDITOR_DRY_RUN_ENDPOINT/);
  assert.match(triggersJs, /posted.*no-send/s);
  assert.match(triggersJs, /would dispatch/);
  assert.match(triggersJs, /blocked \/ no match/);
  assert.match(triggersJs, /No preview run yet\. Try !bot, !xp, or !clip/);
  assert.match(triggersHtml, /Effective Command Set/);
  assert.match(triggersHtml, /what will actually match/i);
  assert.match(triggersHtml, /!bot/);
  assert.match(triggersHtml, /Pilled planned\/disabled/);
  assert.match(triggersHtml, /FFmpeg/);
  assert.doesNotMatch(triggersJs, /dispatchEndpoint|livePost|transportSend/);
});

test("actual integrations triggers boot clears loading and keeps globals when custom configs fail", async () => {
  const source = read("docs/js/triggers.js");
  const html = read("docs/views/triggers.html");
  const ids = Array.from(html.matchAll(/id="([^"]+)"/g)).map((match) => match[1]);

  class FakeClassList {
    constructor() {
      this.values = new Set();
    }
    add(...names) {
      names.forEach((name) => this.values.add(name));
    }
    remove(...names) {
      names.forEach((name) => this.values.delete(name));
    }
    toggle(name, force) {
      if (force) {
        this.values.add(name);
      } else {
        this.values.delete(name);
      }
    }
    contains(name) {
      return this.values.has(name);
    }
  }

  class FakeElement {
    constructor(id) {
      this.id = id;
      this.innerHTML = "";
      this.textContent = "";
      this.value = "";
      this.className = "";
      this.classList = new FakeClassList();
      this.listeners = {};
    }
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    }
    getAttribute(name) {
      return this[name] || "";
    }
    closest() {
      return null;
    }
  }

  class FakeSelect extends FakeElement {}
  const elements = Object.fromEntries(ids.map((id) => {
    const isSelect = id.includes("filter") || id.includes("platform") || id.includes("role") || id.includes("trigger");
    return [id, isSelect ? new FakeSelect(id) : new FakeElement(id)];
  }));

  const editorPayload = {
    authority: "StreamSuites",
    source: "runtime",
    generated_at: "2026-05-20T00:00:00Z",
    available_platforms: [{ platform: "kick" }],
    effective_triggers: [
      {
        id: "bot",
        command_text: "!bot",
        source: "runtime",
        module: "core",
        status: "active",
        enabled: true,
        read_only: true,
        eligible_platforms: ["kick"],
        response_preview_text: "StreamSuites bot online."
      },
      {
        id: "xp",
        command_text: "!xp",
        source: "runtime",
        module: "progression",
        module_status: "active",
        status: "active",
        enabled: true,
        eligible_platforms: ["kick"]
      }
    ],
    planned_module_triggers: [
      {
        id: "clip",
        command_text: "!clip",
        source: "planned",
        module: "clips_ffmpeg",
        module_status: "unavailable",
        status: "unavailable",
        enabled: false,
        eligible_platforms: ["kick"]
      }
    ],
    validation_warnings: []
  };

  const context = {
    window: {},
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
      querySelector() {
        return null;
      }
    },
    fetch: async (url) => {
      const pathOnly = String(url).replace(/^https?:\/\/[^/]+/, "");
      if (pathOnly === "/api/admin/livechat/trigger-editor") {
        return { ok: true, status: 200, json: async () => editorPayload };
      }
      if (pathOnly === "/api/admin/livechat/custom-triggers") {
        return {
          ok: false,
          status: 503,
          json: async () => ({ error_code: "runtime_unavailable", message: "Runtime unavailable" })
        };
      }
      throw new Error(`Unexpected endpoint ${pathOnly}`);
    },
    URL,
    URLSearchParams,
    AbortController,
    HTMLElement: FakeElement,
    HTMLSelectElement: FakeSelect,
    HTMLInputElement: FakeElement,
    Element: FakeElement,
    Error,
    console
  };
  context.window = {
    StreamSuitesAdminAuth: { config: { baseUrl: "" } }
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "docs/js/triggers.js" });

  await context.window.TriggersView.init();

  assert.doesNotMatch(elements["triggers-runtime-state"].textContent, /Loading authoritative trigger editor/);
  assert.match(elements["triggers-runtime-state"].textContent, /partial failure: editor contract ready/);
  assert.match(elements["triggers-library-groups"].innerHTML, /!bot/);
  assert.match(elements["triggers-library-groups"].innerHTML, /!xp/);
  assert.match(elements["triggers-library-groups"].innerHTML, /!clip/);
  assert.match(elements["triggers-effective-list"].innerHTML, /!bot/);
  assert.match(elements["triggers-custom-state"].innerHTML, /Runtime\/Auth custom trigger configs are unavailable/);
  assert.match(elements["triggers-diagnostics"].innerHTML, /\/api\/admin\/livechat\/custom-triggers/);
  assert.match(elements["triggers-diagnostics"].innerHTML, /Runtime unavailable/);
});

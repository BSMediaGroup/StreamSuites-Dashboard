# Dashboard Audit Report

## 1. Current Dashboard State (Factual)
- **Page inventory**: The dashboard shell at `docs/index.html` loads admin views (overview, creators, triggers, jobs, clips, polls, tallies, scoreboards, data/signals, rate limits, settings, chat replay, platform views, support, updates, about) via the navigation list and view loader, while public surfaces live as standalone HTML files under `docs/` (e.g., `home.html`, `about.html`, `changelog.html`, `support/`, `tools/`). The main dashboard uses a shared container and injects view templates from `docs/views/` based on `data-view` selections. 【F:docs/index.html†L177-L244】【F:docs/js/app.js†L89-L158】
- **Static vs runtime-fed data**: Core datasets reside in checked-in JSON under `docs/data/` (creators, triggers, jobs, polls, tallies, scoreboards, platforms, integrations, changelogs, roadmap, runtime snapshots). The dashboard bootstrap polls only the static `shared/state/quotas.json` snapshot and otherwise reads/writes localStorage through `App.storage`, keeping behavior static unless JSON files are updated manually. 【F:docs/js/app.js†L165-L200】【F:docs/data/roadmap.json†L1-L200】
- **Roadmap + changelog rendering**: The About view loads a manifest (`about/about.manifest.json`) and concatenates scoped roadmap sections plus renders `data/roadmap.json` for progress bars; public changelog pages hydrate from `data/changelog.dashboard.json` and `data/changelog.runtime.json` while the dashboard Updates view fetches GitHub commits with caching/abort support. 【F:docs/js/about.js†L36-L123】【F:docs/changelog.html†L21-L69】【F:docs/js/updates.js†L1-L88】
- **Version + storage behavior**: `versioning.js` resolves `/version.json` and stamps footers; storage namespaces keys under `streamsuites.*`, supporting JSON import/export and updates caching. No authenticated or live runtime calls exist. 【F:docs/js/utils/versioning.js†L10-L67】【F:docs/js/app.js†L49-L159】【F:docs/js/updates.js†L1-L67】

## 2. Static Mode vs Connected Mode
- **Default static-first posture**: The mode detector defaults to static mode, labeling the UI as read-only and avoiding claims of liveness when only packaged JSON is present. A dedicated status indicator (`#app-mode`) renders the current mode beside the header status. 【F:docs/index.html†L183-L204】【F:docs/js/app.js†L22-L79】【F:docs/js/app.js†L105-L154】
- **Localhost + snapshot-aware detection**: `detectConnectedMode` checks localhost domains, optional `mode` query overrides, and the presence of runtime snapshots (via `StreamSuitesState.loadRuntimeSnapshot`). Successful detection flips the indicator to “connected mode (read-only)” while failures gracefully fall back to static mode with explanatory reasons. Mode detection now runs before nav binding to keep the header badge accurate on first paint. 【F:docs/js/app.js†L105-L154】【F:docs/js/app.js†L544-L614】
- **Mode context handed to views**: The view loader stamps the current mode onto view containers, passes `App.mode` into `onLoad`, and keeps runtime polling read-only so connected mode remains informational. 【F:docs/js/app.js†L66-L84】【F:docs/js/app.js†L407-L456】【F:docs/js/app.js†L631-L695】

## 3. Where Data Mutability Is Falsely Assumed
- **Navigation labels vs reality**: Admin views (triggers, jobs, settings) and platform switches imply write capability, yet all controls save only to localStorage or exported JSON; runtime remains authoritative. Platform toggles for Pilled are locked, and Kick/YouTube/Twitch switches are disabled in-platform views despite being visible in settings. 【F:docs/views/settings.html†L184-L331】【F:docs/views/platforms/youtube.html†L27-L98】【F:docs/views/platforms/kick.html†L24-L98】
- **Runtime veneer**: Quota polling and runtime snapshot hydration can make the dashboard look live, but all fetches are pull-only reads with no authenticated sessions. The new mode indicator clarifies this by surfacing the fallback reason when snapshots are missing. 【F:docs/js/app.js†L105-L154】【F:docs/js/state.js†L90-L150】

## 4. Platform Coverage Audit
- **Confirmed static support**: YouTube, Twitch, Rumble, and Discord all have view templates, settings rows, and telemetry placeholders that hydrate from static JSON or runtime exports. 【F:docs/views/platforms/youtube.html†L1-L200】【F:docs/views/platforms/twitch.html†L1-L200】【F:docs/views/platforms/rumble.html†L1-L80】【F:docs/views/platforms/discord.html†L1-L160】
- **Kick (NEW)**: Added as a first-class platform with a dedicated dashboard view, runtime snapshot wiring (prefers `shared/state/runtime_snapshot.json` with docs/data fallback), settings row, and platform data entry (enabled + telemetry flags). Controls are read-only/scaffolded; runtime execution remains in the authoritative repo. 【F:docs/views/platforms/kick.html†L1-L200】【F:docs/js/platforms/kick.js†L1-L179】【F:docs/views/settings.html†L260-L330】【F:docs/data/platforms.json†L4-L25】
- **Pilled (PLANNED)**: Added as a planned ingest-only platform with a dedicated read-only view, locked settings row, and platform data entry marking it disabled/telemetry-off by default. Hydration defers to runtime exports when available, mirroring Kick’s shared/state-first behavior. 【F:docs/views/platforms/pilled.html†L1-L160】【F:docs/js/platforms/pilled.js†L1-L165】【F:docs/views/settings.html†L332-L376】【F:docs/data/platforms.json†L17-L25】

## 5. Dashboard Scaffolding & Docs Alignment
- **New platform views + wiring**: Kick and Pilled templates load through the view router (`App.registerView`) with per-platform JS that hydrates config/runtime placeholders and auto-polls snapshots. Navigation and script bundles now include these views. 【F:docs/js/app.js†L631-L695】【F:docs/index.html†L205-L234】【F:docs/js/platforms/kick.js†L96-L175】【F:docs/js/platforms/pilled.js†L96-L161】
- **Settings parity**: Global platform services now list Kick and Pilled alongside existing platforms, with restart notes and locked toggles where appropriate. Platform intent export logic picks up the new keys. 【F:docs/views/settings.html†L184-L376】【F:docs/js/platforms.js†L13-L69】
- **Public + dashboard narrative**: About/platforms content now calls out Kick as scaffolded/in-progress and Pilled as planned ingest-only. Roadmap items list both with appropriate status and percent completion. 【F:docs/about/about_part2_platforms_interfaces.json†L1-L140】【F:docs/data/roadmap.json†L60-L110】
- **Desktop Admin foundations**: Roadmap and About now track the planned WinForms-style desktop Admin app with contract notes (runtime reads, local config writes, restart triggers) and future macOS/Linux parity targets. 【F:docs/about/about_part2_platforms_interfaces.json†L100-L145】【F:docs/data/roadmap.json†L150-L207】

## 6. Connected Mode Design Updates
- **Localhost detection**: Mode detection keys off localhost hostnames and optional `mode=connected|static` overrides, avoiding accidental “live” claims on hosted environments. 【F:docs/js/app.js†L105-L154】
- **Live read-only capability**: When runtime exports are reachable, platform views render snapshot timestamps, counters, and errors without enabling controls, aligning with the static-first contract. 【F:docs/js/platforms/kick.js†L96-L175】【F:docs/js/platforms/pilled.js†L96-L161】
- **Graceful fallback**: Missing or unreachable exports keep the UI in static mode with descriptive messaging and warning styling; runtime polling timers reset safely on unload. 【F:docs/js/app.js†L105-L154】【F:docs/js/platforms/kick.js†L140-L175】
- **Clear UI indicator**: The new header badge (`#app-mode`) surfaces “static” vs “connected” with reasons, distinct from the existing active/idle indicator. 【F:docs/index.html†L183-L204】【F:docs/js/app.js†L105-L154】

## 7. Mandatory Implementation Guardrails
- Static mode remains the default; runtime is authoritative for any live data.
- Kick is scaffolded/in-progress and must stay read-only; Pilled is planned/ingest-only with locked controls.
- Public pages and dashboard About/Roadmap must continue to reflect platform status truthfully.
- No admin mutations are permitted from the dashboard; exports remain download-only/localStorage-backed.

## 8. Future Output: Implementation Prompt (Codex-Ready)
Use this enriched prompt to begin the next Codex session, grounded in the audit above:

```
You are updating the StreamSuites™ Dashboard (static-first, no backend, no auth, no writes). The runtime repo remains authoritative.

Goals
1) Connected-mode clarity: keep static as the default. Reuse detectConnectedMode in docs/js/app.js to set the #app-mode badge, stamp mode datasets on containers, and pass App.mode into view onLoad handlers without enabling any mutations.
2) Runtime snapshot hydration: prefer shared/state/runtime_snapshot.json from the runtime repo (exports/public) with docs/data/runtime_snapshot.json as fallback. Use App.state.runtimeSnapshot for polling; do not create new fetchers.
3) Kick view (docs/views/platforms/kick.html + docs/js/platforms/kick.js): render shared/state-first runtime snapshots and local creators/platform drafts read-only. Keep all controls disabled; surface mode reason text; mirror Twitch/YouTube parity.
4) Pilled view (docs/views/platforms/pilled.html + docs/js/platforms/pilled.js): keep ingest-only placeholders, lock all controls, and hydrate read-only from runtime snapshots when present. No mutation paths.
5) Roadmap/About parity: ensure docs/data/roadmap.json and docs/about/about_part2_platforms_interfaces.json mark Kick as scaffolded/in-progress, Pilled as planned/ingest-only, and the Desktop Admin App as planned foundation (Windows EXE first, future macOS/Linux).
6) Desktop Admin App notes only: document contract expectations (reads runtime state, writes config locally, triggers runtime reloads) without wiring runtime bindings. Keep static hosting intact.

Constraints & References
- Static mode must remain default; dashboard stays additive and read-only. No backend services or runtime writes.
- Runtime repo structures to reference: shared/config/*.json (ingested by runtime/config_loader.py), runtime/exports/about.*.json + roadmap.json, shared/state/runtime_snapshot.json, runtime/admin/*.json for admin intents. Use these as authoritative inputs; never invent APIs.
- Preserve existing layouts and navigation; do not redesign UI.
```

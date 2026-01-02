# Dashboard Audit Report

## 1. Current Dashboard State (Factual)
- **Page inventory**: The dashboard shell at `docs/index.html` loads admin views (overview, creators, triggers, jobs, clips, polls, tallies, scoreboards, data/signals, rate limits, settings, chat replay, platform views, support, updates, about) via the navigation list and view loader, while public surfaces live as standalone HTML files under `docs/` (e.g., `home.html`, `about.html`, `changelog.html`, `support/`, `tools/`). The main dashboard uses a shared container and injects view templates from `docs/views/` based on `data-view` selections. 【F:docs/index.html†L177-L244】【F:docs/js/app.js†L89-L158】
- **Static vs runtime-fed data**: Core datasets reside in checked-in JSON under `docs/data/` (creators, triggers, jobs, polls, tallies, scoreboards, platforms, integrations, changelogs, roadmap, runtime snapshots). The dashboard bootstrap polls only the static `shared/state/quotas.json` snapshot and otherwise reads/writes localStorage through `App.storage`, keeping behavior static unless JSON files are updated manually. 【F:docs/js/app.js†L165-L200】【F:docs/data/roadmap.json†L1-L200】
- **Roadmap + changelog rendering**: The About view loads a manifest (`about/about.manifest.json`) and concatenates scoped roadmap sections plus renders `data/roadmap.json` for progress bars; public changelog pages hydrate from `data/changelog.dashboard.json` and `data/changelog.runtime.json` while the dashboard Updates view fetches GitHub commits with caching/abort support. 【F:docs/js/about.js†L36-L123】【F:docs/changelog.html†L21-L69】【F:docs/js/updates.js†L1-L88】
- **Version + storage behavior**: `versioning.js` resolves `/version.json` and stamps footers; storage namespaces keys under `streamsuites.*`, supporting JSON import/export and updates caching. No authenticated or live runtime calls exist. 【F:docs/js/utils/versioning.js†L10-L67】【F:docs/js/app.js†L49-L159】【F:docs/js/updates.js†L1-L67】

## 2. Static Mode vs Connected Mode
- **Default static-first posture**: The new mode detector defaults to static mode, labeling the UI as read-only and avoiding claims of liveness when only packaged JSON is present. A dedicated status indicator (`#app-mode`) renders the current mode beside the header status. 【F:docs/index.html†L183-L204】【F:docs/js/app.js†L22-L63】【F:docs/js/app.js†L105-L154】
- **Localhost + snapshot-aware detection**: `detectConnectedMode` checks localhost domains, optional `mode` query overrides, and the presence of runtime snapshots (via `StreamSuitesState.loadRuntimeSnapshot`). Successful detection flips the indicator to “connected mode (read-only)” while failures gracefully fall back to static mode with explanatory reasons. 【F:docs/js/app.js†L105-L154】【F:docs/js/app.js†L550-L604】
- **Read-only live visibility**: When runtime exports are reachable (e.g., local `shared/state`), views hydrate counters/status text but never enable mutations; runtime polling remains read-only and reuses existing snapshot loaders. 【F:docs/js/app.js†L183-L260】【F:docs/js/platforms/kick.js†L96-L164】

## 3. Where Data Mutability Is Falsely Assumed
- **Navigation labels vs reality**: Admin views (triggers, jobs, settings) and platform switches imply write capability, yet all controls save only to localStorage or exported JSON; runtime remains authoritative. Platform toggles for Pilled are locked, and Kick/YouTube/Twitch switches are disabled in-platform views despite being visible in settings. 【F:docs/views/settings.html†L184-L331】【F:docs/views/platforms/youtube.html†L27-L98】【F:docs/views/platforms/kick.html†L24-L98】
- **Runtime veneer**: Quota polling and runtime snapshot hydration can make the dashboard look live, but all fetches are pull-only reads with no authenticated sessions. The new mode indicator clarifies this by surfacing the fallback reason when snapshots are missing. 【F:docs/js/app.js†L105-L154】【F:docs/js/state.js†L90-L150】

## 4. Platform Coverage Audit
- **Confirmed static support**: YouTube, Twitch, Rumble, and Discord all have view templates, settings rows, and telemetry placeholders that hydrate from static JSON or runtime exports. 【F:docs/views/platforms/youtube.html†L1-L200】【F:docs/views/platforms/twitch.html†L1-L200】【F:docs/views/platforms/rumble.html†L1-L80】【F:docs/views/platforms/discord.html†L1-L160】
- **Kick (NEW)**: Added as a first-class platform with a dedicated dashboard view, runtime snapshot wiring, settings row, and platform data entry (enabled + telemetry flags). Controls are read-only/scaffolded; runtime execution remains in the authoritative repo. 【F:docs/views/platforms/kick.html†L1-L200】【F:docs/js/platforms/kick.js†L1-L175】【F:docs/views/settings.html†L260-L330】【F:docs/data/platforms.json†L4-L25】
- **Pilled (PLANNED)**: Added as a planned ingest-only platform with a dedicated read-only view, locked settings row, and platform data entry marking it disabled/telemetry-off by default. 【F:docs/views/platforms/pilled.html†L1-L160】【F:docs/js/platforms/pilled.js†L1-L161】【F:docs/views/settings.html†L332-L376】【F:docs/data/platforms.json†L17-L25】

## 5. Dashboard Scaffolding & Docs Alignment
- **New platform views + wiring**: Kick and Pilled templates load through the view router (`App.registerView`) with per-platform JS that hydrates config/runtime placeholders and auto-polls snapshots. Navigation and script bundles now include these views. 【F:docs/js/app.js†L631-L695】【F:docs/index.html†L205-L234】【F:docs/js/platforms/kick.js†L96-L175】【F:docs/js/platforms/pilled.js†L96-L161】
- **Settings parity**: Global platform services now list Kick and Pilled alongside existing platforms, with restart notes and locked toggles where appropriate. Platform intent export logic picks up the new keys. 【F:docs/views/settings.html†L184-L376】【F:docs/js/platforms.js†L13-L69】
- **Public + dashboard narrative**: About/platforms content now calls out Kick as scaffolded/in-progress and Pilled as planned ingest-only. Roadmap items list both with appropriate status and percent completion. 【F:docs/about/about_part2_platforms_interfaces.json†L1-L140】【F:docs/data/roadmap.json†L60-L110】

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
Use this prompt to begin implementation in a new Codex session, grounded in the audit above:

```
You are updating the StreamSuites dashboard (static-first). Implement connected-mode clarity and platform scaffolding safely:
1) Keep static mode as the default. Reuse detectConnectedMode (docs/js/app.js) to label the header badge (#app-mode) and pass mode state to views where helpful. Do not enable mutations.
2) Wire Kick view hydration to exported runtime snapshots (shared/state/runtime_snapshot.json fallback to docs/data) and local creators/platform drafts; keep all controls disabled. Mirror Twitch/YouTube read-only behavior.
3) Keep Pilled read-only/ingest-only. Lock toggles in settings and render snapshot placeholders only; never attempt runtime writes.
4) Ensure platform settings intent exports include Kick and Pilled without breaking existing platforms.
5) Validate roadmap/about copy continues to mark Kick as scaffolded/in-progress and Pilled as planned ingest-only. Keep public + dashboard parity.
6) Preserve framework-free, static hosting compatibility. Do not introduce backend calls or auth; treat runtime exports as read-only snapshots.
```

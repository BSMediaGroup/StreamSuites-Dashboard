# StreamSuites Dashboard — Static, Read-Only Runtime Monitor

StreamSuites Dashboard is a **static, client-side preview surface** for observing the StreamSuites automation ecosystem. It stays GitHub Pages–safe (no backend, no auth) while loading snapshot JSON for **YouTube, Twitch, Rumble, Kick (in-progress), Pilled (planned ingest-only), and Discord**. All execution, chat ingestion, livestream control, and command surfaces live in the StreamSuites runtimes, not here.

- **Preview/scaffold only:** The dashboard is intentionally static, read-only, and ships bundled snapshots to demonstrate layout and schema alignment. Runtime hydration for chat replay/live overlays has **not started**.
- **Authority:** Runtime exports are canonical; the dashboard only reads them and refreshes on a timer.
- **Write safety:** No API calls, no authentication, and no server code. Local edits remain browser-local or downloaded JSON files.
- **Current stance:** Static previews only. YouTube + Twitch previews present snapshot-driven heartbeat telemetry; Rumble remains PAUSED with read-only telemetry and red roadmap treatment; **Kick is scaffolded/in-progress** with read-only runtime snapshot hydration; **Pilled is planned/ingest-only** and locked to read-only placeholders. No runtime feeds are wired into chat replay or overlays yet.
- **Audit:** Use the attached audit report for context; do **not** regenerate it.

## Version & Ownership
- **Current version:** StreamSuites™ v0.2.3-alpha (from `docs/version.json`).
- **Build:** 2025.04 (alpha channel, stamped via `docs/version.json`).
- **Dashboard role:** Static, read-only, and non-authoritative. Reflects runtime exports and local drafts only.
- **Licensing notice:** Proprietary • All Rights Reserved • © 2026 Brainstream Media Group • Owner: Daniel Clancy.
- **Alpha-stage disclaimer:** Active alpha surface; schemas, exports, and visualizations may change as runtime contracts stabilize.

## Architecture Overview
- **Authoritative runtime:** This repository hosts the StreamSuites runtime and is the authoritative source of state, snapshots, telemetry, and control. All other dashboards consume exports originating here.
- **State origination:** Runtime-owned exports (e.g., snapshots, telemetry bundles, changelogs) originate in the runtime and are published for downstream readers.
- **Downstream consumers:** Static dashboards and other surfaces ingest exported JSON from this repo; they do not author or mutate runtime data.

## WinForms Desktop Admin Dashboard
- **Location:** `desktop-admin/` (local WinForms application distributed with this repository).
- **Execution model:** Runs on the same machine as the runtime with direct filesystem access.
- **Snapshot handling:** Reads runtime snapshots directly from disk for immediate administrative visibility.
- **Control surface:** Can launch or terminate runtime processes, manage local paths, and adjust configuration without network dependencies.
- **Roadmap posture:** Intended to become the primary admin interface over time while retaining local-only authority.

## Relationship to Web Dashboard
- **Separate repository:** The web dashboard lives in a separate repo and is intentionally less capable.
- **Read-only inputs:** It consumes runtime-exported JSON only and never defines its own versioning.
- **No control plane:** Lacks process control and filesystem authority and does not depend on the WinForms Desktop Admin.
- **Design constraint:** Downstream consumer by design; it visualizes exports but cannot alter runtime state.

## Versioning Policy
- **VERSION (e.g., v0.2.3-alpha):** Captures semantic capability level and any feature, behavior, or contract changes.
- **BUILD (e.g., 2025.04):** Stamps regenerated artifacts (exports, docs, binaries) and serves as a diagnostic/reproducibility identifier.
- **Implications:** Version changes indicate meaningful project evolution; build changes signal freshly generated artifacts even if features are unchanged.

## Version Consumption Matrix
- **Runtime:** Source of truth for VERSION and BUILD.
- **WinForms Desktop Admin:** Reads runtime version/build directly and surfaces authoritative metadata locally.
- **Web Dashboard:** Reads version/build from exported JSON; it never defines its own values.

## Path & State Flow
- **Authoritative snapshot:** `runtime/exports/runtime_snapshot.json` remains the canonical export.
- **Local admin access:** WinForms Desktop Admin reads snapshots directly from disk for privileged operations.
- **Web dashboard access:** Static dashboards read published/exported JSON only; they do not require or influence the local admin app.
- **Configurable paths:** Local path configuration may be adjusted via admin tooling to point exports and consumers to the correct locations.

## Operational Boundary
- **Static control surface** — cannot mutate runtimes or send actions; edits are limited to local JSON drafts and exports.
- **Runtime snapshot polling** — periodically fetches `shared/state/runtime_snapshot.json` (or bundled fallbacks) for status, heartbeat timestamps, errors, and pause reasons. The header mode badge (`#app-mode`) clarifies whether runtime exports are reachable (connected, read-only) or the UI is in static fallback.
- **No platform APIs** — the browser bundle only fetches snapshot JSON; there are no live chat sockets, auth flows, or control-plane calls.
- **Runtime exports are authoritative** — the dashboard visualizes whatever the runtime writes to snapshot files.
- **Visual-only philosophy** — dashboards illuminate runtime exports; control and execution stay in runtimes.

## Relationship to StreamSuites (Main Repo)
This repository is a **separate but companion project** to the `StreamSuites` runtime. Runtimes produce exports and consume schemas; the dashboard renders those exports and drafts config bundles.

- **Runtime-owned execution:** Chat ingestion, overlays, livestream control, and command dispatch live in the runtime repo. This dashboard stays static, read-only, and preview-only until runtime hydration is wired.
- **No runtime feeds yet:** Bundled snapshots (docs/data + docs/shared/state) illustrate layout and schema alignment; there are no live chat feeds, overlays, or replay hydrations in this repo.
- **Roadmap source:** The roadmap visible in the dashboard is driven by `docs/data/roadmap.json`; updates here propagate directly to the UI.

```
[StreamSuites Runtime] <— consumes schemas — [StreamSuites-Dashboard (static, read-only)]
         |                                              |
         |                                              +— planned status surface (no heartbeat yet)
         |
[Discord Bot Runtime] <— shared schemas ——————> [Dashboard surfaces bot status (visibility only)]
         |
         +— Rumble chat ingest (runtime-owned; SSE best-effort with DOM/API fallbacks; dashboard hydrates exported snapshots)
```

**Architecture reality:** Chat ingest and livestream control live in the runtime (SSE preferred for Rumble with DOM/API fallbacks, Twitch IRC, YouTube polling/RT). Any DOM chat send automation is runtime-owned. The dashboard remains read-only and only surfaces exported snapshots.

## Responsibility Split (Runtime vs Dashboard)
- **Runtime (authoritative):** Ingests chat, enforces quotas, schedules jobs, posts to platforms, and exports deterministic state (`runtime_snapshot.json`, `quotas.json`, galleries, and admin snapshots). Rumble ingest is currently paused at the runtime level pending stabilization.
- **Dashboard (read-only):** Polls runtime snapshots for platform status, heartbeat timestamps, last errors, and pause reasons; renders creators/platform drafts from local storage; and presents public galleries without write paths.
- **Discord control-plane:** Lives in the runtime repo; the dashboard only surfaces exported status for visibility.

## Beta Pathway
- **Active monitoring:** YouTube and Twitch views poll runtime snapshots on an interval for live status badges and counters.
- **Scaffolded platform:** Kick view hydrates runtime exports (when available) read-only and mirrors YouTube/Twitch scaffolding while remaining non-authoritative.
- **Paused platform:** Rumble remains visible with red roadmap treatment and read-only telemetry while the ingest pipeline is stabilized in the runtime.
- **Planned ingest-only:** Pilled view is read-only/locked and marked as planned; no runtime actions are available.
- **Static hosting:** All pages remain GitHub Pages–safe; polling uses static JSON exports with no backend.

## Hosting & Deployment Model
- Hosted as a **static site** (GitHub Pages safe).
- No authentication or backend.
- Iframe/embed friendly (e.g., Wix Studio or static hosts).
- All logic runs in the browser and reads JSON snapshots or drafts.

## Data Sources & Fallbacks
Runtime telemetry is loaded **client-side** with graceful fallbacks:

1. **Primary:** `docs/shared/state/` — latest runtime exports copied from the StreamSuites runtime repo (e.g., `runtime_snapshot.json`, `quotas.json`, `clips.json`, and telemetry bundles under `telemetry/`).
2. **Secondary:** `docs/data/` — bundled sample snapshots used when shared state is missing or stale.
3. **Local drafts:** `localStorage` entries created by import/export tools (e.g., creators/platforms drafts).

If `shared/state` files are absent, views silently fall back to `docs/data` so the UI stays populated.

## Platform Runtime Previews (Read-Only)
- **YouTube:** Polls `runtime_snapshot.json` and `quotas.json` to show status, last update, errors, and counters. No livestream controls.
- **Twitch:** Mirrors the YouTube pattern with identical polling and fallbacks. Read-only preview only.
- **Kick:** Scaffolded/in-progress view that hydrates runtime snapshot exports when available, shows creator wiring status, and stays read-only.
- **Rumble:** Present but marked **Deferred/Disabled**; surfaces the most recent snapshot details if present and never initiates runtime calls.
- **Pilled:** Planned ingest-only view; controls are locked and display read-only placeholders without attempting runtime calls.
- **Other platform views (Discord/Twitter):** Static scaffolds for visibility only.

## Runtime Telemetry Panels (Read-Only)
- **Events panel:** Newest-first feed of runtime-exported events with severity, timestamp, source, and message; explicitly read-only.
- **Rates panel:** Numeric indicators for recent windows, rendered without charts to keep the UI light.
- **Errors panel:** Highlights active or recent errors per subsystem while keeping the presentation non-fatal and informational.
- **Data sources:** Hydrates from `docs/shared/state/telemetry/{events,rates,errors}.json` with silent fallbacks to `docs/data/telemetry/` when missing.

## Roadmap alignment (v0.2.2-alpha)
- **Unified Chat Replay UI:** UI COMPLETE / PREVIEW ONLY — all dashboards show static preview mocks driven by local JSON.
- **Live Chat Window:** UI COMPLETE / NO RUNTIME — pop-out and embedded live chat windows are static HTML only.
- **OBS / Browser Source Overlay:** UI COMPLETE / NO RUNTIME — overlay HTML exists as a preview with no live data wiring.
- **Browser Extension (Live Chat Replay):** UI COMPLETE / RUNTIME PENDING — preview exists; runtime coupling is deferred.
- **Multi-platform badge rendering:** COMPLETE — platform + role badges render in the previews with finalized assets.
- **Avatar fallback & identity handling:** COMPLETE — previews include silhouette fallbacks and identity labels without runtime mutation.
- **Runtime hydration:** NOT STARTED — no live chat or overlay data is being hydrated; the roadmap entries remain preview-only.

## Public-Facing Media Surfaces (Static)
- **Home (`docs/home.html`)** — public landing surface linking to galleries and the creator dashboard.
- **Clips (`docs/clips.html`)** — standalone clips gallery (static placeholders) plus detail view (`docs/clips/detail.html`).
- **Polls (`docs/polls.html`)** — standalone polls gallery with detail/results views (`docs/polls/detail.html`, `docs/polls/results.html`).
- **Tallies (`docs/tallies.html`)** — standalone tallies gallery with detail view (`docs/tallies/detail.html`).
- **Scoreboards (`docs/scoreboards.html`)** — standalone scoreboards gallery with detail view (`docs/scoreboards/detail.html`).
- **About (`docs/about.html`)** — manifest-driven public About surface (`docs/about/about.manifest.json` + parts) with optional developer sections.
- **Privacy / Accessibility / Changelog / Lander / Postmortem** — static public pages sharing the dark-glass theme.
- **Support (`docs/support/index.html`)** — public support parent with documentation/overview subviews.
- **Tools (`docs/tools/index.html`)** — public tools parent with automation/overview/studio subviews.

All public pages are independent entry points, GitHub Pages–safe, and reuse `docs/css/public-pages.css`.

## Data & Signals Dashboard View
- **View:** `docs/views/data-signals.html` with wiring in `docs/js/data-signals.js`.
- **Purpose:** Render runtime-owned entities, append-style signals, and administrative exports with client-side search/pagination (via `docs/js/utils/search-pagination.js`).
- **Posture:** Read-only; tables hydrate from static JSON exports under `docs/data/`.
- **Operational notices:** Explicitly notes runtime exports as the source of truth; the dashboard is CMS-style visibility only.

## Unified Chat Replay (Preview-only)
- **UI COMPLETE / PREVIEW ONLY:** `docs/views/chat-replay.html` surfaces the full UI with mode toggles (Replay/Live), Na3ar-17–style theme selection, Lakshay-art–inspired live input styling, and a pop-out control — all powered by bundled JSON, not runtime feeds.
- **Live Chat Window (UI COMPLETE / NO RUNTIME):** `docs/views/chat_window.html` is rendered as a static mock in the dashboard and pop-out flows; no sockets or runtime hydration are wired.
- **Replay window & overlays:** `docs/views/chat_replay_window.html` (replay) and `docs/views/chat_overlay_obs.html` (OBS/browser source) are UI complete with theme + mode propagation but **NO RUNTIME** data.
- **Browser Extension (UI COMPLETE / RUNTIME PENDING):** The extension preview is UI-complete and references the same assets; runtime coupling is deferred.
- **Badges & avatars (COMPLETE):** Platform + role badges render with finalized SVGs and the RechargeBd/SuiGeneris font stack; avatar fallback/identity handling uses `docs/assets/icons/ui/profile.svg` and embedded labels without mutating runtime data.
- **Placeholder coverage:** Previews reference `docs/assets/placeholders/daniel.png`, `docs/assets/placeholders/streamsuites.jpg`, and `docs/assets/placeholders/hotdog.jpg`, falling back to `docs/assets/icons/ui/profile.svg` if no avatar URL is present.
- **Hydration status:** Runtime hydration is NOT STARTED. Export streams remain draft-only and are not rendering live data on dashboard or public pages. File-based placeholders exist purely for documentation.
- **CSS sources cited:** Theme selector structure adapted from Na3ar-17 (Uiverse.io); live input visuals adapted from Lakshay-art (Uiverse.io) with StreamSuites color/treatment tweaks.

## Design Principles & Schema-Driven Architecture
- **Static-first, schema-driven, platform-neutral, future-proof.**
- **Local-first drafts** stored in `localStorage` until exported as deterministic bundles (`creators.json`, `platforms.json`).
- **Validation without a backend** using schemas under `/schemas` shared with runtimes.
- **Runtime-agnostic:** Streaming runtime and Discord control-plane can consume the same schemas; the dashboard stays static.

### Rumble Chat Ingest Notes (Runtime-Owned)
The runtime supports multiple ingest paths (SSE preferred, DOM-based fallback, API polling fallback). The dashboard remains neutral and simply renders exported snapshots describing whichever path the runtime used.

## Directory Structure (exhaustive)
```
StreamSuites-Dashboard/
├── .gitignore
├── DASHBOARD_AUDIT_REPORT.md
├── LICENSE
├── README.md
├── changelog
│   └── changelog.runtime.json
├── dev-notes
│   ├── compatibility.md
│   ├── decisions.md
│   └── roadmap.md
├── docs
│   ├── CONTRACTS.md
│   ├── POST_MORTEM.md
│   ├── TIERS.md
│   ├── Thumbs.db
│   ├── about
│   │   ├── about.manifest.json
│   │   ├── about_part1_core.json
│   │   ├── about_part2_platforms_interfaces.json
│   │   └── about_part3_about_system_spec.json
│   ├── about.html
│   ├── accessibility.html
│   ├── assets
│   │   ├── backgrounds
│   │   │   ├── .gitkeep
│   │   │   ├── Thumbs.db
│   │   │   ├── seodash.jpg
│   │   │   └── seoshare.jpg
│   │   ├── fonts
│   │   │   └── .gitkeep
│   │   ├── icons
│   │   │   ├── .gitkeep
│   │   │   ├── dcbadge.svg
│   │   │   ├── browser-extension.svg
│   │   │   ├── kick-0.svg
│   │   │   ├── kick-silver.svg
│   │   │   ├── kick-white.svg
│   │   │   ├── kick.svg
│   │   │   ├── discord-0.svg
│   │   │   ├── discord-muted.svg
│   │   │   ├── discord-silver.svg
│   │   │   ├── discord-white.svg
│   │   │   ├── discord.svg
│   │   │   ├── favicon.ico
│   │   │   ├── obs-0.svg
│   │   │   ├── obs-silver.svg
│   │   │   ├── obs-white.svg
│   │   │   ├── obs.svg
│   │   │   ├── pilled-0.svg
│   │   │   ├── pilled-muted.svg
│   │   │   ├── pilled-silver.svg
│   │   │   ├── pilled-white.svg
│   │   │   ├── pilled.svg
│   │   │   ├── rumble-0.svg
│   │   │   ├── rumble-muted.svg
│   │   │   ├── rumble-silver.svg
│   │   │   ├── rumble-white.svg
│   │   │   ├── rumble.svg
│   │   │   ├── mod.svg
│   │   │   ├── twitch-0.svg
│   │   │   ├── twitch-silver.svg
│   │   │   ├── twitch-white.svg
│   │   │   ├── twitch.svg
│   │   │   ├── twitter-0.svg
│   │   │   ├── twitter-muted.svg
│   │   │   ├── twitter-silver.svg
│   │   │   ├── twitter-square-0.svg
│   │   │   ├── twitter-square-muted.svg
│   │   │   ├── twitter-square-silver.svg
│   │   │   ├── twitter-square-white.svg
│   │   │   ├── twitter-square.svg
│   │   │   ├── twitter-white.svg
│   │   │   ├── twitter.svg
│   │   │   ├── prouser.svg
│   │   │   ├── ui
│   │   │   │   ├── Thumbs.db
│   │   │   │   ├── admin.svg
│   │   │   │   ├── api.svg
│   │   │   │   ├── automation.svg
│   │   │   │   ├── bot.svg
│   │   │   │   ├── brick.svg
│   │   │   │   ├── browser.svg
│   │   │   │   ├── cards.svg
│   │   │   │   ├── clickpoint.svg
│   │   │   │   ├── codeblock.svg
│   │   │   │   ├── cog.svg
│   │   │   │   ├── dashboard.svg
│   │   │   │   ├── dashgear.svg
│   │   │   │   ├── devices.svg
│   │   │   │   ├── extension.svg
│   │   │   │   ├── globe.svg
│   │   │   │   ├── identity.svg
│   │   │   │   ├── inputs.svg
│   │   │   │   ├── joystick.svg
│   │   │   │   ├── memory.svg
│   │   │   │   ├── options.svg
│   │   │   │   ├── package.svg
│   │   │   │   ├── pc.svg
│   │   │   │   ├── plus.svg
│   │   │   │   ├── portal.svg
│   │   │   │   ├── profile.svg
│   │   │   │   ├── settingsquare.svg
│   │   │   │   ├── sidebar.svg
│   │   │   │   ├── storage.svg
│   │   │   │   ├── switch.svg
│   │   │   │   ├── terminal.svg
│   │   │   │   ├── tune.svg
│   │   │   │   ├── ui.svg
│   │   │   │   ├── uiscreen.svg
│   │   │   │   ├── webhook.svg
│   │   │   │   ├── widget.svg
│   │   │   │   └── windows.svg
│   │   │   ├── win1.ico
│   │   │   ├── x.svg
│   │   │   ├── youtube-0.svg
│   │   │   ├── youtube-muted.svg
│   │   │   ├── youtube-silver.svg
│   │   │   ├── youtube-white.svg
│   │   │   └── youtube.svg
│   │   ├── illustrations
│   │   │   └── .gitkeep
│   │   ├── logos
│   │   │   ├── LOG2-3D-SML.png
│   │   │   ├── LOG2-3D.png
│   │   │   ├── LOG2TRIM-SML.png
│   │   │   ├── LOG2TRIM.png
│   │   │   ├── Thumbs.db
│   │   │   ├── logo.png
│   │   │   ├── logocircle.png
│   │   │   ├── logocircle.svg
│   │   │   ├── seodash.jpg
│   │   │   ├── sswm.png
│   │   │   └── streamsuites.svg
│   │   └── placeholders
│   │       ├── .gitkeep
│   │       ├── daniel.png
│   │       ├── hotdog.jpg
│   │       └── streamsuites.jpg
│   ├── changelog.html
│   ├── clips
│   │   └── detail.html
│   ├── clips.html
│   ├── css
│   │   ├── base.css
│   │   ├── components.css
│   │   ├── layout.css
│   │   ├── overrides.css
│   │   ├── public-pages.css
│   │   ├── theme-dark.css
│   │   └── updates.css
│   ├── data
│   │   ├── changelog.dashboard.json
│   │   ├── changelog.runtime.json
│   │   ├── chat_events.json
│   │   ├── chat_triggers.json
│   │   ├── clips.json
│   │   ├── creators.json
│   │   ├── dashboard_state.json
│   │   ├── integrations.json
│   │   ├── jobs.json
│   │   ├── permissions.json
│   │   ├── platforms.json
│   │   ├── poll_votes.json
│   │   ├── polls.json
│   │   ├── rate_limits.json
│   │   ├── roadmap.json
│   │   ├── runtime_snapshot.json
│   │   ├── system.json
│   │   ├── score_events.json
│   │   ├── scoreboards.json
│   │   ├── tallies.json
│   │   ├── tally_events.json
│   │   └── telemetry
│   │       ├── errors.json
│   │       ├── events.json
│   │       └── rates.json
│   ├── favicon.ico
│   ├── home.html
│   ├── index.html
│   ├── js
│   │   ├── about.js
│   │   ├── api.js
│   │   ├── app.js
│   │   ├── auth.js
│   │   ├── changelog-merge.js
│   │   ├── charts.js
│   │   ├── chatReplay.js
│   │   ├── clip-detail.js
│   │   ├── clips.js
│   │   ├── creators.js
│   │   ├── data-signals.js
│   │   ├── jobs.js
│   │   ├── overview.js
│   │   ├── permissions.js
│   │   ├── platforms
│   │   │   ├── discord.js
│   │   │   ├── kick.js
│   │   │   ├── pilled.js
│   │   │   ├── rumble.js
│   │   │   ├── twitch.js
│   │   │   ├── twitter.js
│   │   │   └── youtube.js
│   │   ├── platforms.js
│   │   ├── poll-detail.js
│   │   ├── public-about.js
│   │   ├── public-changelog.js
│   │   ├── public-clips.js
│   │   ├── public-data.js
│   │   ├── public-polls.js
│   │   ├── public-roadmap.js
│   │   ├── public-tallies.js
│   │   ├── ratelimits.js
│   │   ├── render.js
│   │   ├── settings.js
│   │   ├── state.js
│   │   ├── tally-detail.js
│   │   ├── telemetry.js
│   │   ├── triggers.js
│   │   ├── updates.js
│   │   └── utils
│   │       ├── about-data.js
│   │       ├── search-pagination.js
│   │       ├── snapshot-health.js
│   │       ├── version-stamp.js
│   │       └── versioning.js
│   ├── lander.html
│   ├── polls
│   │   ├── detail.html
│   │   └── results.html
│   ├── polls.html
│   ├── postmortem.html
│   ├── privacy.html
│   ├── scoreboards
│   │   └── detail.html
│   ├── scoreboards.html
│   ├── shared
│   │   ├── state
│   │   │   ├── admin
│   │   │   │   └── triggers.json
│   │   │   ├── README.md
│   │   │   ├── changelog.json
│   │   │   ├── changelog.runtime.json
│   │   │   ├── clips.json
│   │   │   ├── discord
│   │   │   │   └── runtime.json
│   │   │   ├── jobs.json
│   │   │   ├── meta.json
│   │   │   ├── polls.json
│   │   │   ├── quotas.json
│   │   │   ├── runtime_snapshot.json
│   │   │   ├── scoreboards.json
│   │   │   ├── tallies.json
│   │   │   ├── telemetry
│   │   │   │   ├── errors.json
│   │   │   │   ├── events.json
│   │   │   │   └── rates.json
│   │   └── suspension
│   │       ├── suspension-banner.css
│   │       └── suspension-banner.js
│   ├── support
│   │   ├── index.html
│   │   └── views
│   │       ├── documentation.html
│   │       └── overview.html
│   ├── tallies
│   │   └── detail.html
│   ├── tallies.html
│   ├── tools
│   │   ├── index.html
│   │   └── views
│   │       ├── automation.html
│   │       ├── overview.html
│   │       └── studio.html
│   ├── version.json
│   └── views
│       ├── about.html
│       ├── design.html
│       ├── chat-replay.html
│       ├── chat_overlay_obs.html
│       ├── chat_replay_window.html
│       ├── chat_window.html
│       ├── clips.html
│       ├── creators.html
│       ├── data-signals.html
│       ├── jobs.html
│       ├── overview.html
│       ├── platforms
│       │   ├── discord.html
│       │   ├── kick.html
│       │   ├── pilled.html
│       │   ├── rumble.html
│       │   ├── twitch.html
│       │   ├── twitter.html
│       │   └── youtube.html
│       ├── polls.html
│       ├── ratelimits.html
│       ├── scoreboard-management.html
│       ├── scoreboards.html
│       ├── settings.html
│       ├── support.html
│       ├── tallies.html
│       ├── triggers.html
│       └── updates.html
├── favicon.ico
├── runtime
│   ├── exports
│   │   ├── changelog.json
│   │   └── changelog.runtime.json
│   └── version.py
└── schemas
    ├── chat_behaviour.schema.json
    ├── chat_log.schema.json
    ├── clip_schema.json
    ├── creators.schema.json
    ├── jobs.schema.json
    ├── permissions.schema.json
    ├── platform
    │   ├── discord.schema.json
    │   ├── rumble.schema.json
    │   ├── twitch.schema.json
    │   ├── twitter.schema.json
    │   └── youtube.schema.json
    ├── poll_schema.json
    ├── quotas.schema.json
    ├── ratelimits.schema.json
    ├── services.schema.json
    ├── system.schema.json
    ├── tiers.schema.json
    └── triggers.schema.json
```

## Local Preview
1. Install any static server (`npm i -g serve` or use `python -m http.server`).
2. From the repo root, serve `docs/` (e.g., `serve docs` or `python -m http.server 8000 --directory docs`).
3. Open `http://localhost:8000/index.html` to load the dashboard shell.

> Tip: Temporarily move `docs/shared/state/runtime_snapshot.json` aside to verify fallbacks; platform views will use `docs/data/runtime_snapshot.json` without errors.

## Runtime Export Consumption
- **Snapshots:** Dashboard polls `shared/state/runtime_snapshot.json` (platform status) and `shared/state/quotas.json` (API quotas), falling back to `docs/data/*.json` when missing.
- **Telemetry:** Read-only telemetry panels hydrate from `shared/state/telemetry/{events,rates,errors}.json`, falling back to `docs/data/telemetry/` if absent or stale.
- **Changelogs/Roadmaps:** Public pages read `docs/data/changelog.*.json` and `docs/data/roadmap.json` only.
- **Config drafts:** Creators/platforms configs are edited locally and exported as JSON; they do **not** push to runtimes.

## Status
- **Stage:** Alpha revival (read-only, no backend commands).
- **Owner:** Brainstream Media Group / Daniel Clancy.
- **License:** Proprietary • All Rights Reserved.

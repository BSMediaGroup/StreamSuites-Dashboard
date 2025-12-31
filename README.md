# StreamSuites Dashboard — Static, Read-Only Runtime Monitor

StreamSuites Dashboard is a **static, client-side control panel** for observing the StreamSuites automation ecosystem. It stays GitHub Pages–safe (no backend, no auth) while polling runtime snapshot JSON for **YouTube, Twitch, Rumble, and Discord**. All execution, chat ingestion, livestream control, and command surfaces live in the StreamSuites runtimes.

- **Authority:** Runtime exports are canonical; the dashboard only reads them and refreshes on a timer.
- **Write safety:** No API calls, no authentication, and no server code. Local edits remain browser-local or downloaded JSON files.
- **Current stance:** YouTube + Twitch previews are ACTIVE with runtime heartbeat polling; Rumble is PAUSED with read-only telemetry and red roadmap treatment.
- **Audit:** Use the attached audit report for context; do **not** regenerate it.

## Version & Ownership
- **Current version:** StreamSuites™ v0.2.0-alpha (from `docs/version.json`).
- **Dashboard role:** Static, read-only, and non-authoritative. Reflects runtime exports and local drafts only.
- **Licensing notice:** Proprietary • All Rights Reserved • © 2025 Brainstream Media Group • Owner: Daniel Clancy.
- **Alpha-stage disclaimer:** Active alpha surface; schemas, exports, and visualizations may change as runtime contracts stabilize.

## Operational Boundary
- **Static control surface** — cannot mutate runtimes or send actions; edits are limited to local JSON drafts and exports.
- **Runtime snapshot polling** — periodically fetches `shared/state/runtime_snapshot.json` (or bundled fallbacks) for status, heartbeat timestamps, errors, and pause reasons.
- **No platform APIs** — the browser bundle only fetches snapshot JSON; there are no live chat sockets, auth flows, or control-plane calls.
- **Runtime exports are authoritative** — the dashboard visualizes whatever the runtime writes to snapshot files.
- **Visual-only philosophy** — dashboards illuminate runtime exports; control and execution stay in runtimes.

## Relationship to StreamSuites (Main Repo)
This repository is a **separate but companion project** to the `StreamSuites` runtime. Runtimes produce exports and consume schemas; the dashboard renders those exports and drafts config bundles.

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
- **Paused platform:** Rumble remains visible with red roadmap treatment and read-only telemetry while the ingest pipeline is stabilized in the runtime.
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
- **Rumble:** Present but marked **Deferred/Disabled**; surfaces the most recent snapshot details if present and never initiates runtime calls.
- **Other platform views (Discord/Twitter):** Static scaffolds for visibility only.

## Runtime Telemetry Panels (Read-Only)
- **Events panel:** Newest-first feed of runtime-exported events with severity, timestamp, source, and message; explicitly read-only.
- **Rates panel:** Numeric indicators for recent windows, rendered without charts to keep the UI light.
- **Errors panel:** Highlights active or recent errors per subsystem while keeping the presentation non-fatal and informational.
- **Data sources:** Hydrates from `docs/shared/state/telemetry/{events,rates,errors}.json` with silent fallbacks to `docs/data/telemetry/` when missing.

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

## Unified Chat Replay (Planned)
- **Dashboard previews only:** `docs/views/chat-replay.html` hosts preview iframes for the unified replay UI without enabling runtime control.
- **File-based placeholders:** The pop-out window (`docs/views/chat_replay_window.html`) and OBS/browser source overlay (`docs/views/chat_overlay_obs.html`) are local HTML mocks surfaced purely for documentation.
- **Future hydration path:** Runtime replay feeds will hydrate both surfaces once the unified engine is active; today they remain scaffolded and offline.

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
│   │   │   ├── browser-extension.svg
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
│   │       └── .gitkeep
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
│       ├── chat-replay.html
│       ├── chat_overlay_obs.html
│       ├── chat_replay_window.html
│       ├── clips.html
│       ├── creators.html
│       ├── data-signals.html
│       ├── jobs.html
│       ├── overview.html
│       ├── platforms
│       │   ├── discord.html
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

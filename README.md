# StreamSuites Dashboard — Static, Read-Only Runtime Preview

StreamSuites Dashboard is a **static, client-side control panel** for inspecting the StreamSuites automation ecosystem without embedding runtime logic or connecting to live chat sources. It stays GitHub Pages–safe (no backend, no auth) and renders exported state for **YouTube, Twitch, and Rumble** as a read-only preview. All execution, chat ingestion, livestream control, and command surfaces live in the StreamSuites runtimes.

- **Authority:** Runtime exports are canonical; the dashboard only reads them.
- **Write safety:** No API calls, no authentication, and no server code. Local edits remain browser-local or downloaded JSON files.
- **Revival stance:** YouTube + Twitch previews are wired for beta-forward telemetry; Rumble stays visible but clearly deferred/disabled while still showing snapshot facts when present.
- **Audit:** Use the attached audit report for context; do **not** regenerate it.

## Version & Ownership
- **Current version:** StreamSuites™ v0.2.0-alpha (from `docs/version.json`).
- **Dashboard role:** Static, read-only, and non-authoritative. Reflects runtime exports and local drafts only.
- **Licensing notice:** Proprietary • All Rights Reserved • © 2025 Brainstream Media Group • Owner: Daniel Clancy.
- **Alpha-stage disclaimer:** Active alpha surface; schemas, exports, and visualizations may change as runtime contracts stabilize.

## Operational Boundary
- **Static control surface** — cannot mutate runtimes or send actions; edits are limited to local JSON drafts and exports.
- **Offline-first** — no live connections; everything is rendered from shipped or downloaded JSON artifacts.
- **No API calls** — the browser bundle deliberately avoids live fetches beyond static exports (e.g., no Rumble/YouTube/Twitch APIs).
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

## Hosting & Deployment Model
- Hosted as a **static site** (GitHub Pages safe).
- No authentication or backend.
- Iframe/embed friendly (e.g., Wix Studio or static hosts).
- All logic runs in the browser and reads JSON snapshots or drafts.

## Data Sources & Fallbacks
Runtime telemetry is loaded **client-side** with graceful fallbacks:

1. **Primary:** `docs/shared/state/` — latest runtime exports copied from the StreamSuites runtime repo (e.g., `runtime_snapshot.json`, `quotas.json`, `clips.json`).
2. **Secondary:** `docs/data/` — bundled sample snapshots used when shared state is missing or stale.
3. **Local drafts:** `localStorage` entries created by import/export tools (e.g., creators/platforms drafts).

If `shared/state` files are absent, views silently fall back to `docs/data` so the UI stays populated.

## Platform Runtime Previews (Read-Only)
- **YouTube:** Polls `runtime_snapshot.json` and `quotas.json` to show status, last update, errors, and counters. No livestream controls.
- **Twitch:** Mirrors the YouTube pattern with identical polling and fallbacks. Read-only preview only.
- **Rumble:** Present but marked **Deferred/Disabled**; surfaces the most recent snapshot details if present and never initiates runtime calls.
- **Other platform views (Discord/Twitter):** Static scaffolds for visibility only.

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
├── DASHBOARD_AUDIT_REPORT.md
├── LICENSE
├── README.md
├── favicon.ico
├── docs/
│   ├── CONTRACTS.md
│   ├── POST_MORTEM.md
│   ├── TIERS.md
│   ├── accessibility.html
│   ├── about.html
│   ├── changelog.html
│   ├── clips.html
│   ├── favicon.ico
│   ├── home.html
│   ├── index.html
│   ├── lander.html
│   ├── polls.html
│   ├── postmortem.html
│   ├── privacy.html
│   ├── scoreboards.html
│   ├── tallies.html
│   ├── version.json
│   ├── clips/
│   │   └── detail.html
│   ├── polls/
│   │   ├── detail.html
│   │   └── results.html
│   ├── scoreboards/
│   │   └── detail.html
│   ├── tallies/
│   │   └── detail.html
│   ├── shared/
│   │   ├── suspension/
│   │   │   ├── suspension-banner.css
│   │   │   └── suspension-banner.js
│   │   └── state/
│   │       ├── README.md
│   │       ├── clips.json
│   │       ├── jobs.json
│   │       ├── quotas.json
│   │       ├── runtime_snapshot.json
│   │       └── discord/
│   │           └── runtime.json
│   ├── css/
│   │   ├── base.css
│   │   ├── components.css
│   │   ├── layout.css
│   │   ├── overrides.css
│   │   ├── public-pages.css
│   │   ├── theme-dark.css
│   │   └── updates.css
│   ├── views/
│   │   ├── about.html
│   │   ├── chat-replay.html
│   │   ├── clips.html
│   │   ├── creators.html
│   │   ├── data-signals.html
│   │   ├── jobs.html
│   │   ├── overview.html
│   │   ├── polls.html
│   │   ├── ratelimits.html
│   │   ├── scoreboard-management.html
│   │   ├── scoreboards.html
│   │   ├── settings.html
│   │   ├── support.html
│   │   ├── tallies.html
│   │   ├── triggers.html
│   │   ├── updates.html
│   │   └── platforms/
│   │       ├── discord.html
│   │       ├── rumble.html
│   │       ├── twitch.html
│   │       ├── twitter.html
│   │       └── youtube.html
│   ├── assets/
│   │   ├── backgrounds/
│   │   │   ├── seodash.jpg
│   │   │   └── seoshare.jpg
│   │   ├── fonts/
│   │   ├── icons/
│   │   │   ├── browser-extension.svg
│   │   │   ├── discord-0.svg (and variants)
│   │   │   ├── obs-0.svg (and variants)
│   │   │   ├── pilled-0.svg (and variants)
│   │   │   ├── rumble-0.svg (and variants)
│   │   │   ├── twitch-0.svg (and variants)
│   │   │   ├── twitter-0.svg / twitter-square-0.svg (and variants)
│   │   │   ├── youtube-0.svg (and variants)
│   │   │   └── ui/
│   │   │       ├── admin.svg
│   │   │       ├── api.svg
│   │   │       ├── automation.svg
│   │   │       ├── bot.svg
│   │   │       ├── chart.svg
│   │   │       ├── checklist.svg
│   │   │       ├── clip.svg
│   │   │       ├── cloud.svg
│   │   │       ├── download.svg
│   │   │       ├── edit.svg
│   │   │       ├── export.svg
│   │   │       ├── file.svg
│   │   │       ├── filter.svg
│   │   │       ├── folder.svg
│   │   │       ├── heartbeat.svg
│   │   │       ├── import.svg
│   │   │       ├── info.svg
│   │   │       ├── jobs.svg
│   │   │       ├── json.svg
│   │   │       ├── list.svg
│   │   │       ├── lock.svg
│   │   │       ├── logs.svg
│   │   │       ├── monitor.svg
│   │   │       ├── placeholder.svg
│   │   │       ├── roadmap.svg
│   │   │       ├── runtime.svg
│   │   │       ├── search.svg
│   │   │       ├── settings.svg
│   │   │       ├── stats.svg
│   │   │       ├── support.svg
│   │   │       ├── webhook.svg
│   │   │       ├── widget.svg
│   │   │       └── windows.svg
│   │   ├── illustrations/
│   │   ├── logos/
│   │   │   ├── LOG2-3D-SML.png
│   │   │   ├── LOG2-3D.png
│   │   │   ├── LOG2TRIM-SML.png
│   │   │   ├── LOG2TRIM.png
│   │   │   ├── logo.png
│   │   │   ├── logocircle.png
│   │   │   ├── logocircle.svg
│   │   │   ├── seodash.jpg
│   │   │   ├── sswm.png
│   │   │   └── streamsuites.svg
│   │   └── placeholders/
│   ├── js/
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
│   │   ├── utils/
│   │   │   ├── about-data.js
│   │   │   ├── search-pagination.js
│   │   │   ├── version-stamp.js
│   │   │   └── versioning.js
│   │   └── platforms/
│   │       ├── discord.js
│   │       ├── rumble.js
│   │       ├── twitch.js
│   │       ├── twitter.js
│   │       └── youtube.js
│   ├── data/
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
│   │   └── tally_events.json
│   ├── about/
│   │   ├── about.manifest.json
│   │   ├── about_part1_core.json
│   │   ├── about_part2_platforms_interfaces.json
│   │   └── about_part3_about_system_spec.json
│   ├── support/
│   │   ├── index.html
│   │   └── views/
│   │       ├── documentation.html
│   │       └── overview.html
│   └── tools/
│       ├── index.html
│       └── views/
│           ├── automation.html
│           ├── overview.html
│           └── studio.html
├── schemas/
│   ├── chat_behaviour.schema.json
│   ├── chat_log.schema.json
│   ├── clip_schema.json
│   ├── creators.schema.json
│   ├── jobs.schema.json
│   ├── permissions.schema.json
│   ├── poll_schema.json
│   ├── quotas.schema.json
│   ├── ratelimits.schema.json
│   ├── services.schema.json
│   ├── system.schema.json
│   ├── tiers.schema.json
│   ├── triggers.schema.json
│   └── platform/
│       ├── discord.schema.json
│       ├── rumble.schema.json
│       ├── twitch.schema.json
│       ├── twitter.schema.json
│       └── youtube.schema.json
└── dev-notes/
    ├── compatibility.md
    ├── decisions.md
    └── roadmap.md
```

## Local Preview
1. Install any static server (`npm i -g serve` or use `python -m http.server`).
2. From the repo root, serve `docs/` (e.g., `serve docs` or `python -m http.server 8000 --directory docs`).
3. Open `http://localhost:8000/index.html` to load the dashboard shell.

> Tip: Temporarily move `docs/shared/state/runtime_snapshot.json` aside to verify fallbacks; platform views will use `docs/data/runtime_snapshot.json` without errors.

## Runtime Export Consumption
- **Snapshots:** Dashboard polls `shared/state/runtime_snapshot.json` (platform status) and `shared/state/quotas.json` (API quotas), falling back to `docs/data/*.json` when missing.
- **Changelogs/Roadmaps:** Public pages read `docs/data/changelog.*.json` and `docs/data/roadmap.json` only.
- **Config drafts:** Creators/platforms configs are edited locally and exported as JSON; they do **not** push to runtimes.

## Status
- **Stage:** Alpha revival (read-only, no backend commands).
- **Owner:** Brainstream Media Group / Daniel Clancy.
- **License:** Proprietary • All Rights Reserved.

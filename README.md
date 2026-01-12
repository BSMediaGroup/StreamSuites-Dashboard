# StreamSuites Dashboard — Static, Read-Only Runtime Monitor

StreamSuites Dashboard is a **static, client-side observability surface** for monitoring the StreamSuites ecosystem.  
It is intentionally **GitHub Pages–safe** (no backend, no authentication, no server execution) and exists solely to **visualize runtime-exported state**.

All execution, chat ingestion, livestream control, scheduling, and command dispatch live in the **StreamSuites Runtime** repository — never here.

The dashboard loads snapshot JSON for **YouTube, Twitch, Rumble, Kick (in-progress), Pilled (planned ingest-only), and Discord** and renders them as a read-only preview surface.

- **Preview / scaffold only:** The dashboard is intentionally static and read-only. Bundled snapshots demonstrate layout, schema alignment, and UI behavior. Runtime hydration for live chat, overlays, or replay feeds has **not started**.
- **Authority model:** Runtime exports are canonical. This dashboard only reads exported artifacts and refreshes them on a timer.
- **Write safety:** No API calls, no authentication, no mutation paths. Any edits are browser-local (`localStorage`) or operate on downloaded JSON files only.
- **Current stance:** Static previews only.
  - **YouTube & Twitch:** Snapshot-driven heartbeat telemetry (read-only).
  - **Rumble:** PAUSED at runtime level; visible with read-only telemetry and red roadmap treatment.
  - **Kick:** Scaffolded / in-progress; hydrates runtime snapshots when present but remains read-only.
  - **Pilled:** Planned / ingest-only; locked to placeholders and read-only.
- **Audit context:** Refer to the attached audit report for historical and architectural context. **Do not regenerate it.**

## Version & Ownership

- **Current version:** StreamSuites™ `v0.2.3-alpha` (read from `docs/version.json`).
- **Build:** Runtime-stamped build identifier (read from `docs/version.json`).
- **Dashboard role:** Non-authoritative. Static, read-only consumer of runtime exports and local drafts.
- **Licensing:** Proprietary • All Rights Reserved • © 2026 Brainstream Media Group.
- **Owner:** Daniel Clancy.
- **Alpha disclaimer:** Active alpha surface. Schemas, exports, and visualizations may evolve as runtime contracts stabilize.

## Architecture Overview

- **Authoritative runtime:** The StreamSuites Runtime repository is the single source of truth for execution, state, telemetry, exports, and lifecycle control.
- **State origination:** All snapshots, telemetry bundles, changelogs, and manifests originate in the runtime and are published for downstream readers.
- **Downstream consumers:** This dashboard and other visualization surfaces ingest exported JSON only. They never author, mutate, or control runtime state.

## WinForms Desktop Admin Dashboard

- **Location:** `desktop-admin/` (local WinForms application).
- **Execution model:** Runs on the same machine as the runtime with direct filesystem access.
- **Snapshot handling:** Reads runtime snapshots directly from disk for immediate administrative visibility.
- **Control surface:** Can launch and terminate runtime processes, manage local paths, and adjust configuration without network dependencies.
- **Roadmap posture:** Intended to become the primary administrative interface over time while remaining strictly local.

## Relationship to Web Dashboard

- **Separate repository:** The web dashboard lives in its own repository.
- **Read-only inputs:** Consumes runtime-exported JSON only and never defines its own versioning.
- **No control plane:** No process control, no filesystem authority, no execution rights.
- **Design constraint:** Downstream consumer by design — visualization only.

## Versioning Policy

- **VERSION** (e.g. `v0.2.3-alpha`)
  - Indicates semantic capability level.
  - Changes reflect feature, behavior, or contract evolution.
- **BUILD** (e.g. `YYYY.MM.DD+NNN`)
  - Identifies regenerated artifacts (exports, documentation, bundles).
  - Used for diagnostics and reproducibility.

Version changes imply meaningful project evolution.  
Build changes imply freshly generated artifacts, even when features are unchanged.

## Version Consumption Matrix

- **Runtime:** Source of truth for VERSION and BUILD.
- **WinForms Desktop Admin:** Reads runtime version/build directly and displays authoritative metadata.
- **Web Dashboard:** Reads version/build from exported JSON only and never defines its own values.

## Path & State Flow

- **Authoritative snapshot:** `runtime/exports/runtime_snapshot.json`
- **Local admin access:** WinForms Desktop Admin reads snapshots directly from disk.
- **Web dashboard access:** Reads published/exported JSON only.
- **Configurable paths:** Local path configuration may be adjusted via admin tooling to align exports and consumers.

## Operational Boundary

- **Static control surface:** Cannot mutate runtimes or issue commands.
- **Runtime snapshot polling:** Periodically fetches `shared/state/runtime_snapshot.json` (or bundled fallbacks) to render status, heartbeat timestamps, errors, and pause reasons.
- **Header mode badge:** `#app-mode` indicates connected/read-only or static fallback.
- **No platform APIs:** No sockets, no auth flows, no control-plane calls.
- **Visual-only philosophy:** Dashboards illuminate runtime exports; execution remains runtime-owned.

## Relationship to StreamSuites (Main Repo)

This repository is a **companion project** to the StreamSuites Runtime.

- **Runtime-owned execution:** Chat ingest, overlays, livestream control, and command dispatch live in the runtime.
- **Dashboard posture:** Static, read-only, preview-only until runtime hydration is explicitly enabled.
- **Roadmap source:** Dashboard roadmap is driven by `docs/data/roadmap.json`; changes propagate directly to the UI.

```
[StreamSuites Runtime] <— consumes schemas — [StreamSuites-Dashboard (static, read-only)]
         |                                              |
         |                                              +— planned status surface (no heartbeat yet)
         |
[Discord Bot Runtime] <— shared schemas ——————> [Dashboard surfaces bot status (visibility only)]
         |
         +— Rumble chat ingest (runtime-owned; SSE best-effort with DOM/API fallbacks; dashboard hydrates exported snapshots)
```

**Architecture reality:** Chat ingest and livestream control live in the runtime (SSE preferred for Rumble with DOM/API fallbacks, Twitch IRC, YouTube polling/RT). Any DOM chat send automation is runtime-owned. The dashboard only visualizes exported snapshots.

## Responsibility Split (Runtime vs Dashboard)

- **Runtime (authoritative):**
  - Ingests chat
  - Enforces quotas
  - Schedules jobs
  - Posts to platforms
  - Exports deterministic state (`runtime_snapshot.json`, `quotas.json`, telemetry)
  - Rumble ingest currently paused pending stabilization
- **Dashboard (read-only):**
  - Polls runtime snapshots for status, heartbeat, errors, pause reasons
  - Renders creator/platform drafts from local storage
  - Presents public galleries with no write paths
- **Discord control-plane:** Lives entirely in the runtime; dashboard displays visibility only.

## Beta Pathway

- **Active monitoring:** YouTube and Twitch poll runtime snapshots for status badges and counters.
- **Scaffolded platform:** Kick mirrors YouTube/Twitch scaffolding in read-only mode.
- **Paused platform:** Rumble remains visible with red roadmap treatment.
- **Planned ingest-only:** Pilled is locked and read-only.
- **Static hosting:** All pages remain GitHub Pages–safe.

## Hosting & Deployment Model

- Static site hosting (GitHub Pages).
- No backend.
- No authentication.
- Embed/iframe friendly (e.g., Wix Studio).
- All logic runs client-side.

## Data Sources & Fallbacks

Runtime telemetry loads client-side with graceful fallbacks:

1. **Primary:** `docs/shared/state/` — latest runtime exports copied from the runtime repo.
2. **Secondary:** `docs/data/` — bundled sample snapshots.
3. **Local drafts:** `localStorage` via import/export tools.

If shared state is missing, the UI silently falls back to bundled data.

## Platform Runtime Previews (Read-Only)

- **YouTube:** Snapshot polling for status, errors, counters.
- **Twitch:** Same pattern as YouTube.
- **Kick:** Scaffolded view; read-only snapshot hydration.
- **Rumble:** Deferred/Disabled; read-only snapshot display.
- **Pilled:** Planned ingest-only; placeholders only.
- **Discord/Twitter:** Static visibility scaffolds.

## Runtime Telemetry Panels (Read-Only)

- **Events:** Newest-first exported events.
- **Rates:** Numeric indicators for recent windows.
- **Errors:** Non-fatal visibility into subsystem errors.
- **Sources:** `docs/shared/state/telemetry/*` with fallback to `docs/data/telemetry/`.

## Roadmap Alignment (v0.2.2-alpha)

- **Unified Chat Replay UI:** UI COMPLETE / PREVIEW ONLY
- **Live Chat Window:** UI COMPLETE / NO RUNTIME
- **OBS / Browser Overlay:** UI COMPLETE / NO RUNTIME
- **Browser Extension:** UI COMPLETE / RUNTIME PENDING
- **Badge rendering:** COMPLETE
- **Avatar fallback:** COMPLETE
- **Runtime hydration:** NOT STARTED

## Public-Facing Media Surfaces (Static)

- Home, Clips, Polls, Tallies, Scoreboards, About, Privacy, Accessibility, Changelog, Postmortem, Support, Tools
- All pages are independent, static entry points and reuse the shared dark-glass theme.

## Unified Chat Replay (Preview-Only)

- UI complete across dashboard, pop-out, OBS overlay, and extension previews.
- No sockets, no runtime feeds, no mutation paths.
- All data is placeholder-only and export-driven.

## Design Principles & Schema-Driven Architecture

- Static-first
- Schema-driven
- Platform-neutral
- Runtime-agnostic
- Future-proof without backend coupling

### Rumble Chat Ingest Notes (Runtime-Owned)

The runtime supports multiple ingest paths (SSE preferred, DOM fallback, API polling fallback).  
The dashboard remains neutral and only visualizes exported snapshots describing the active ingest path.

## Directory Structure (Exhaustive)
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
│   │   ├── admin_activity.json
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
│   │   │   ├── admin_activity.json
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

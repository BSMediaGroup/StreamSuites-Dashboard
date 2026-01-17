# StreamSuites Admin Dashboard — Runtime Operations & Control

StreamSuites Admin Dashboard is the **admin-only surface** for monitoring and configuring the StreamSuites ecosystem.  
It is deployed via **GitHub Pages** from the `/docs` directory to **https://admin.streamsuites.app** and provides **Discord OAuth–gated admin access** for configuration and runtime control.

All execution, chat ingestion, livestream control, scheduling, and command dispatch live in the **StreamSuites Runtime** repository — this dashboard supplies the configuration and control inputs for those systems.

The dashboard loads snapshot JSON for **YouTube, Twitch, Rumble, Kick (in-progress), Pilled (planned ingest-only), and Discord** while also providing admin-owned configuration surfaces.

- **Authority model:** Runtime exports are canonical for state snapshots and version/build metadata; admin configuration and control inputs are authored here.
- **Configuration scope:** Discord and creator/platform settings are authored in this dashboard and exported for runtime use.
- **Current stance:** Admin control + telemetry visibility.
  - **YouTube & Twitch:** Snapshot-driven heartbeat telemetry plus admin configuration surfaces.
  - **Rumble:** PAUSED at runtime level; visible with telemetry and roadmap treatment.
  - **Kick:** Scaffolded / in-progress; hydrates runtime snapshots when present.
  - **Pilled:** Planned / ingest-only; locked to placeholders.
- **Audit context:** Refer to the attached audit report for historical and architectural context. **Do not regenerate it.**
- **Surface separation:** Public and Creator dashboards live in separate repositories/domains. Cross-surface navigation uses absolute URLs only.

## Version & Ownership

- **Current version:** StreamSuites™ `v0.2.3-alpha` (read from `version.json`).
- **Build:** Runtime-stamped build identifier (read from `version.json`).
- **Version authority:** The StreamSuites Runtime repository is the authoritative source for version/build metadata and publishes `version.json` into this repo via automation.
- **Canonical version metadata endpoint:** `https://admin.streamsuites.app/version.json`.
- **Downstream consumption:** Public and Creator dashboards fetch `https://admin.streamsuites.app/version.json` remotely; this is intentional and required.
- **Dashboard role:** Admin-authoritative for configuration and runtime control; consumes runtime exports for operational visibility.
- **Licensing:** Proprietary • All Rights Reserved • © 2026 Brainstream Media Group.
- **Owner:** Daniel Clancy.
- **Alpha disclaimer:** Active alpha surface. Schemas, exports, and visualizations may evolve as runtime contracts stabilize.

## Architecture Overview

- **Authoritative runtime:** The StreamSuites Runtime repository is the source of truth for execution, state, telemetry, exports, version/build metadata, and lifecycle control.
- **State origination:** All snapshots, telemetry bundles, changelogs, and manifests originate in the runtime and are published for downstream readers.
- **Admin authority:** This dashboard authors admin configuration and control inputs while ingesting runtime exports for visibility.

## Authentication & Authorization

- **Hard admin gate:** The admin dashboard is fail-closed and gated by server-side session introspection against the StreamSuites Auth API.
- **Role enforcement:** Access is granted **only** when the Auth API session is valid and `role == "admin"`.
- **Fail-closed behavior:** Unauthenticated users are redirected to the admin login, authenticated non-admins see a Not Authorized screen, and auth API failures render Service Unavailable.
- **Credentials required:** All auth/session checks include credentials and never trust client-side flags.
- **Discord OAuth2:** Discord OAuth remains for Discord-specific configuration and guild selection once admin access is granted.
- **Scopes required:** `identify`, `guilds`.
- **No local accounts:** StreamSuites does not create or store user accounts; Discord identity is used for Discord feature gating only.

## Guild Authorization Model

A user may configure a guild **only if**:

- The StreamSuites bot is present in the guild, **and**
- The user is the **guild owner**, **or** has **ADMINISTRATOR**, **or** has **MANAGE_GUILD**.

Unauthorized guilds are hidden or locked in the UI. All edits are scoped to the currently selected guild.

## Per-Guild Discord Configuration

The dashboard exposes editable Discord settings per guild:

- Logging enable/disable
- Logging channel
- Notification channels:
  - General
  - Rumble clips
  - YouTube clips
  - Kick clips
  - Pilled clips
  - Twitch clips

These settings map directly to runtime configuration; the dashboard does not execute actions itself.

## Relationship to Runtime & WinForms

- **Static and client-side:** This dashboard remains static and client-side.
- **No direct control:** It does not directly control the runtime.
- **Configuration handoff:** It edits configuration consumed by the runtime.
- **Local authority:** The WinForms Desktop Admin (in a separate repository) is authoritative for local administration.

## WinForms Desktop Admin Dashboard

- **Execution model:** Runs locally alongside the runtime with direct filesystem access.
- **Snapshot handling:** Reads runtime snapshots directly from disk for immediate administrative visibility.
- **Control surface:** Can launch and terminate runtime processes, manage local paths, and adjust configuration without network dependencies.
- **Roadmap posture:** Intended to become the primary administrative interface over time while remaining strictly local.

## Relationship to Web Dashboard

- **Separate surfaces:** Public and Creator dashboards live in separate repositories/domains.
- **Admin authority:** This repository hosts the admin dashboard and is authoritative for admin configuration and runtime control.
- **Cross-surface links:** Navigation to Public and Creator surfaces uses absolute URLs only.

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

- **Admin control surface:** Provides configuration exports and runtime control inputs for administrative workflows.
- **Runtime snapshot polling:** Periodically fetches `shared/state/runtime_snapshot.json` (or bundled fallbacks) to render status, heartbeat timestamps, errors, and pause reasons.
- **Header mode badge:** `#app-mode` indicates connected/admin or static fallback.
- **Platform APIs:** Execution remains runtime-owned; the dashboard supplies configuration/control inputs and renders outputs.

## Relationship to StreamSuites (Main Repo)

This repository is a **companion project** to the StreamSuites Runtime.

- **Runtime-owned execution:** Chat ingest, overlays, livestream control, and command dispatch live in the runtime.
- **Dashboard posture:** Static client-side surface with admin configuration and telemetry visibility.
- **Roadmap source:** Dashboard roadmap is driven by `docs/data/roadmap.json`; changes propagate directly to the UI.

```
[StreamSuites Runtime] <— consumes schemas — [StreamSuites Admin Dashboard (static, admin-controlled)]
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
- **Dashboard (admin control + monitoring):**
  - Polls runtime snapshots for status, heartbeat, errors, pause reasons
  - Authors creator/platform configuration drafts and exports
  - Provides admin control inputs alongside telemetry visibility
- **Discord control-plane:** Lives entirely in the runtime; dashboard displays visibility only.

## Beta Pathway

- **Active monitoring:** YouTube and Twitch poll runtime snapshots for status badges and counters.
- **Scaffolded platform:** Kick mirrors YouTube/Twitch scaffolding during expansion.
- **Paused platform:** Rumble remains visible with red roadmap treatment.
- **Planned ingest-only:** Pilled is locked to placeholders.
- **Static hosting:** All pages remain GitHub Pages–safe.

## Hosting & Deployment Model

- Static site hosting (GitHub Pages) deployed to https://admin.streamsuites.app from the `/docs` directory.
- No backend.
- Discord OAuth required for Discord-specific configuration views.
- Embed/iframe friendly (e.g., Wix Studio).
- All logic runs client-side.
- Public and Creator dashboards are hosted in separate repos/domains.
- Cross-surface navigation uses absolute URLs only.

## Data Sources & Fallbacks

Runtime telemetry loads client-side with graceful fallbacks:

1. **Primary:** `/shared/state/` — latest runtime exports copied from the runtime repo.
2. **Secondary:** `/data/` — bundled sample snapshots.
3. **Local drafts:** `localStorage` via import/export tools.

If shared state is missing, the UI silently falls back to bundled data.

## Platform Runtime Previews

- **YouTube:** Snapshot polling for status, errors, counters.
- **Twitch:** Same pattern as YouTube.
- **Kick:** Scaffolded view; snapshot hydration.
- **Rumble:** Deferred/Disabled; snapshot display.
- **Pilled:** Planned ingest-only; placeholders only.
- **Discord/Twitter:** Static visibility scaffolds.

## Runtime Telemetry Panels

- **Events:** Newest-first exported events.
- **Rates:** Numeric indicators for recent windows.
- **Errors:** Non-fatal visibility into subsystem errors.
- **Sources:** `/shared/state/telemetry/*` with fallback to `/data/telemetry/`.

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
├── version.json
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
│   ├── version.json
│   ├── Thumbs.db
│   ├── about
│   │   ├── about.manifest.json
│   │   ├── about_part1_core.json
│   │   ├── about_part2_platforms_interfaces.json
│   │   └── about_part3_about_system_spec.json
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
│   ├── clips
│   │   └── detail.html
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
│   ├── home.html
│   ├── index.html
│   ├── js
│   │   ├── about.js
│   │   ├── admin-gate.js
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
│   │   ├── discord-guild.js
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
│   │       ├── standalone-guard.js
│   │       ├── version-stamp.js
│   │       └── versioning.js
│   ├── livechat
│   │   ├── index.html
│   │   ├── favicon.ico
│   │   ├── partials
│   │   │   ├── footer_live.html
│   │   │   ├── footer_replay.html
│   │   │   ├── theme_menu.html
│   │   │   └── theme_selector.html
│   │   └── static
│   │       ├── chat.css
│   │       ├── chat_live_input.css
│   │       └── themes
│   │           ├── theme-default.css
│   │           ├── theme-midnight.css
│   │           └── theme-slate.css
│   ├── polls
│   │   ├── detail.html
│   │   └── results.html
│   ├── scoreboards
│   │   └── detail.html
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
│   │   │   └── telemetry
│   │   │       ├── errors.json
│   │   │       ├── events.json
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
│   ├── tools
│   │   ├── index.html
│   │   └── views
│   │       ├── automation.html
│   │       ├── overview.html
│   │       └── studio.html
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
- **Telemetry:** Telemetry panels hydrate from `shared/state/telemetry/{events,rates,errors}.json`, falling back to `docs/data/telemetry/` if absent or stale.
- **Changelogs/Roadmaps:** Public pages read `docs/data/changelog.*.json` and `docs/data/roadmap.json` only.
- **Config drafts:** Creators/platforms configs are edited locally and exported as JSON; they do **not** push to runtimes.

## Status
- **Stage:** Alpha revival (admin control + telemetry visibility, no backend services).
- **Owner:** Brainstream Media Group / Daniel Clancy.
- **License:** Proprietary • All Rights Reserved.

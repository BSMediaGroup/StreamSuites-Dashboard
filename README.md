# StreamSuites Admin Dashboard — Runtime Operations & Control

StreamSuites Admin Dashboard is the **admin-only control and visualization layer** for monitoring and configuring the StreamSuites ecosystem.  
It is a **static web UI** deployed via **GitHub Pages** from the `/docs` directory to **https://admin.streamsuites.app** and provides **Auth API–enforced admin access** for configuration and runtime control inputs.  
Admin views live under `/docs/views`, and runtime exports are read locally from `/docs/runtime/exports` (no runtime exports are fetched from the Auth API).

All execution, chat ingestion, livestream control, scheduling, and command dispatch live in the **StreamSuites Runtime** repository — this dashboard supplies the configuration and control inputs for those systems.

The dashboard **does not hold authoritative state**. It renders runtime-exported snapshots and emits admin-authored configuration/control payloads, while all **privileged actions route through the Auth API and/or runtime** for execution and enforcement.

The dashboard loads snapshot JSON for **YouTube, Twitch, Rumble, Kick (in-progress), Pilled (planned ingest-only), and Discord** while also providing admin-owned configuration surfaces.

- **Authority model:** Runtime exports are canonical for state snapshots and version/build metadata; admin configuration and control inputs are authored here but become effective only when consumed by runtime services.
- **Configuration scope:** Discord and creator/platform settings are authored in this dashboard and exported for runtime use.
- **Current stance:** Admin control + telemetry visibility.
  - **YouTube & Twitch:** Snapshot-driven heartbeat telemetry plus admin configuration surfaces.
  - **Rumble:** PAUSED at runtime level; visible with telemetry and roadmap treatment.
  - **Kick:** Scaffolded / in-progress; hydrates runtime snapshots when present.
  - **Pilled:** Planned / ingest-only; locked to placeholders.
- **Audit context:** Refer to the attached audit report for historical and architectural context. **Do not regenerate it.**
- **Surface separation:** Public and Creator dashboards live in separate repositories/domains. Cross-surface navigation uses absolute URLs only.

## Version & Ownership

- **Version/build source:** This repo does not define version/build. It consumes runtime-exported metadata only.
- **Authoritative runtime:** The StreamSuites Runtime repository is the single source of truth for version/build metadata.
- **Canonical version metadata endpoint:** `/docs/runtime/exports/meta.json` (with `version.json` fallback when referenced by the export manifest).
- **Runtime export source:** Admin dashboard reads runtime exports locally from `/docs/runtime/exports` and never fetches them from the Auth API.
- **Dashboard role:** Admin-authoritative for configuration and runtime control; consumes runtime exports for operational visibility.
- **Licensing:** Proprietary • All Rights Reserved • © 2026 Brainstream Media Group.
- **Owner:** Daniel Clancy.
- **Alpha disclaimer:** Active alpha surface. Schemas, exports, and visualizations may evolve as runtime contracts stabilize.

## Architecture Overview

- **Authoritative runtime:** The StreamSuites Runtime repository is the source of truth for execution, state, telemetry, exports, version/build metadata, and lifecycle control.
- **State origination:** All snapshots, telemetry bundles, changelogs, and manifests originate in the runtime and are published for downstream readers.
- **Admin authority:** This dashboard authors admin configuration and control inputs while ingesting runtime exports for visibility (it does not store authoritative state).

## Authentication & Authorization

- **Hard admin gate:** The admin dashboard is fail-closed and gated by server-side session introspection against the StreamSuites Auth API (`/auth/session` only).
- **Role enforcement:** Access is granted **only** when the Auth API session is valid and `session.role == "admin"`.
- **Fail-closed behavior:** Unauthenticated users are redirected to the admin login, authenticated non-admins see a Not Authorized screen, and auth API failures render Service Unavailable.
- **Credentials required:** All auth/session checks include credentials and never trust client-side flags.
- **Privileged action routing:** All privileged actions (control inputs/config exports) are routed through the Auth API and/or runtime services for execution; the dashboard does not execute them locally.
- **Discord OAuth2:** Discord OAuth remains for Discord-specific configuration and guild selection once admin access is granted (Discord auth UI is scoped to Discord control-plane views only).
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
- **Multi-runtime management:** Supervises multiple managed runtime processes with inline stdout/stderr log viewing.
- **Log viewer (not terminal):** Inline logs are read-only and intentionally not a terminal emulator.
- **External terminal handoff:** Provides “Open in external terminal” for interactive troubleshooting when needed.
- **Roadmap posture:** Intended to become the primary administrative interface over time while remaining strictly local.

## Relationship to Web Dashboard

- **Separate surfaces:** Public and Creator dashboards live in separate repositories/domains.
- **Admin authority:** This repository hosts the admin dashboard and is authoritative for admin configuration and runtime control.
- **Cross-surface links:** Navigation to Public and Creator surfaces uses absolute URLs only.

## Differences from Creator Dashboard and Public Site

- **Admin Dashboard (this repo):** Admin-only control + visualization layer, gated by the Auth API, renders runtime exports, and emits admin configuration/control inputs. Deployed as a static UI from `/docs`.
- **Creator Dashboard:** Creator-focused surface in a separate repository/domain; emphasizes creator self-service settings and visibility rather than admin control.
- **Public Site:** Public-facing marketing/content surface in a separate repository/domain; no admin auth, no privileged actions, and no configuration control inputs.

## Versioning Policy

- **VERSION**
  - Indicates semantic capability level.
  - Changes reflect feature, behavior, or contract evolution.
- **BUILD**
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
- **Process visibility scope:** Managed processes are viewable in Desktop Admin; web surfaces show high-level status only.
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

- Static site hosting (GitHub Pages) deployed to https://admin.streamsuites.app from the `/docs` directory (Pages root).
- No local backend; authentication is provided by the central StreamSuites Auth API.
- Discord OAuth required for Discord-specific configuration views.
- Embed/iframe friendly (e.g., Wix Studio).
- All logic runs client-side.
- Public and Creator dashboards are hosted in separate repos/domains.
- Cross-surface navigation uses absolute URLs only.

## Repo Tree (full)

```
StreamSuites-Dashboard/
├── .github
│   └── workflows
│       └── pages.yml
├── .vscode
│   └── launch.json
├── changelog
│   └── changelog.runtime.json
├── dev-notes
│   ├── compatibility.md
│   ├── decisions.md
│   └── roadmap.md
├── docs
│   ├── about
│   │   ├── about.manifest.json
│   │   ├── about_part1_core.json
│   │   ├── about_part2_platforms_interfaces.json
│   │   └── about_part3_about_system_spec.json
│   ├── assets
│   │   ├── backgrounds
│   │   │   ├── .gitkeep
│   │   │   ├── seodash.jpg
│   │   │   ├── seodashxS1.png
│   │   │   ├── seoshare.jpg
│   │   │   ├── SS-YTBANNER-01.png
│   │   │   └── STSS-RUMBLEBANNER-01.png
│   │   ├── fonts
│   │   │   ├── .gitkeep
│   │   │   ├── Recharge-Bold.otf
│   │   │   └── SuiGeneris-Regular.otf
│   │   ├── icons
│   │   │   ├── ui
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
│   │   │   │   ├── emoji.svg
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
│   │   │   │   ├── send.svg
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
│   │   │   ├── .gitkeep
│   │   │   ├── browser-extension.svg
│   │   │   ├── dcbadge.svg
│   │   │   ├── discord-0.svg
│   │   │   ├── discord-muted.svg
│   │   │   ├── discord-silver.svg
│   │   │   ├── discord-white.svg
│   │   │   ├── discord.svg
│   │   │   ├── favicon.ico
│   │   │   ├── github-0.svg
│   │   │   ├── github-muted.svg
│   │   │   ├── github-silver.svg
│   │   │   ├── github-white.svg
│   │   │   ├── github.svg
│   │   │   ├── google-0.svg
│   │   │   ├── google-muted.svg
│   │   │   ├── google-silver.svg
│   │   │   ├── google-white.svg
│   │   │   ├── google.svg
│   │   │   ├── kick-0.svg
│   │   │   ├── kick-muted.svg
│   │   │   ├── kick-silver.svg
│   │   │   ├── kick-white.svg
│   │   │   ├── kick.svg
│   │   │   ├── mod.svg
│   │   │   ├── obs-0.svg
│   │   │   ├── obs-silver.svg
│   │   │   ├── obs-white.svg
│   │   │   ├── obs.svg
│   │   │   ├── pilled-0.svg
│   │   │   ├── pilled-muted.svg
│   │   │   ├── pilled-silver.svg
│   │   │   ├── pilled-white.svg
│   │   │   ├── pilled.svg
│   │   │   ├── prossuser.svg
│   │   │   ├── prouser.svg
│   │   │   ├── rumble-0.svg
│   │   │   ├── rumble-muted.svg
│   │   │   ├── rumble-silver.svg
│   │   │   ├── rumble-white.svg
│   │   │   ├── rumble.svg
│   │   │   ├── studioconmain.ico
│   │   │   ├── twitch-0.svg
│   │   │   ├── twitch-muted.svg
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
│   │   │   ├── admingold.ico
│   │   │   ├── admingold.png
│   │   │   ├── admingold.webp
│   │   │   ├── adminhex.ico
│   │   │   ├── adminredshield.png
│   │   │   ├── adminredshield.webp
│   │   │   ├── adminshieldcon.ico
│   │   │   ├── adminshieldcon.png
│   │   │   ├── adminshieldcon.webp
│   │   │   ├── adminshieldcongold.png
│   │   │   ├── adminshieldcongold.webp
│   │   │   ├── adminx.ico
│   │   │   ├── adminx.png
│   │   │   ├── adminx.webp
│   │   │   ├── bsmgx.png
│   │   │   ├── bsmgx.svg
│   │   │   ├── bsmgy.png
│   │   │   ├── bsmgy.svg
│   │   │   ├── dclive.svg
│   │   │   ├── dcliveblack.png
│   │   │   ├── dcliveblack.svg
│   │   │   ├── dcx.svg
│   │   │   ├── docscon.ico
│   │   │   ├── docscon.png
│   │   │   ├── docscon3d.ico
│   │   │   ├── docscon3d.png
│   │   │   ├── docscon3d.webp
│   │   │   ├── LOG2-3D-SML.png
│   │   │   ├── LOG2-3D.png
│   │   │   ├── LOG2TRIM-SML.png
│   │   │   ├── LOG2TRIM.png
│   │   │   ├── loghealth-green.png
│   │   │   ├── loghealth-red.png
│   │   │   ├── loghealth-yellow.png
│   │   │   ├── logo.png
│   │   │   ├── logocircle.png
│   │   │   ├── logocircle.svg
│   │   │   ├── logoshield-gold.ico
│   │   │   ├── logoshield-gold.png
│   │   │   ├── logoshield-white.ico
│   │   │   ├── logoshield-white.png
│   │   │   ├── logoshield-white3dx.ico
│   │   │   ├── logoshield-white3dx.png
│   │   │   ├── logoshield-white3dx.webp
│   │   │   ├── logoshield-whitex.webp
│   │   │   ├── logoshield.png
│   │   │   ├── logoshield.svg
│   │   │   ├── newcon.ico
│   │   │   ├── newcon.png
│   │   │   ├── newconx.ico
│   │   │   ├── pubcon.ico
│   │   │   ├── pubcon.png
│   │   │   ├── pubcon.webp
│   │   │   ├── seodash.jpg
│   │   │   ├── ssblueshield.png
│   │   │   ├── ssblueshield.webp
│   │   │   ├── sscmatte.ico
│   │   │   ├── sscmatte.png
│   │   │   ├── sscmatte.webp
│   │   │   ├── sscmatteblue.png
│   │   │   ├── sscmatteblue.webp
│   │   │   ├── sscmattegold.png
│   │   │   ├── sscmattegold.webp
│   │   │   ├── sscmattepfp.png
│   │   │   ├── sscmattepfpdark.png
│   │   │   ├── sscmattepurple.png
│   │   │   ├── sscmattered.png
│   │   │   ├── sscmattered.webp
│   │   │   ├── sscmattesilver.ico
│   │   │   ├── sscmattesilver.png
│   │   │   ├── sscmattesilver.webp
│   │   │   ├── sscmattex.ico
│   │   │   ├── sscmattex.png
│   │   │   ├── ssconchrome.ico
│   │   │   ├── ssconchrome.png
│   │   │   ├── ssconchrome.webp
│   │   │   ├── ssconchromeblue.ico
│   │   │   ├── ssconchromeblue.png
│   │   │   ├── ssconchromeblue.webp
│   │   │   ├── ssicon.ico
│   │   │   ├── ssicon.png
│   │   │   ├── ssicon.webp
│   │   │   ├── ssnewcon.ico
│   │   │   ├── ssnewcon.png
│   │   │   ├── ssnewcon.webp
│   │   │   ├── ssnewfavicon.ico
│   │   │   ├── ssnewfavicon.png
│   │   │   ├── sspfpbluechrome.png
│   │   │   ├── sspfpchrome.png
│   │   │   ├── sswm.png
│   │   │   ├── ssxshieldblack.ico
│   │   │   ├── ssxshieldblack.png
│   │   │   ├── ssxshieldblack.webp
│   │   │   ├── ssxshieldblue.ico
│   │   │   ├── ssxshieldblue.png
│   │   │   ├── ssxshieldblue.webp
│   │   │   ├── ssxshieldred.ico
│   │   │   ├── ssxshieldred.png
│   │   │   ├── ssxshieldred.webp
│   │   │   ├── ssxshieldsilver.ico
│   │   │   ├── ssxshieldsilver.png
│   │   │   ├── ssxshieldsilver.webp
│   │   │   ├── streamsuites.svg
│   │   │   ├── studioconmain.ico
│   │   │   ├── xbsmgmainx1.png
│   │   │   ├── xbsmgmainx1.svg
│   │   │   ├── xbsmgshield.png
│   │   │   ├── xbsmgshield.svg
│   │   │   ├── xbsmgy.png
│   │   │   └── xbsmgy.svg
│   │   └── placeholders
│   │       ├── .gitkeep
│   │       ├── daniel.png
│   │       ├── hotdog.jpg
│   │       └── streamsuites.jpg
│   ├── auth
│   │   ├── login.html
│   │   └── success.html
│   ├── css
│   │   ├── base.css
│   │   ├── components.css
│   │   ├── layout.css
│   │   ├── overrides.css
│   │   ├── theme-dark.css
│   │   └── updates.css
│   ├── data
│   │   ├── telemetry
│   │   │   ├── errors.json
│   │   │   ├── events.json
│   │   │   └── rates.json
│   │   ├── admin_activity.json
│   │   ├── changelog.dashboard.json
│   │   ├── chat_events.json
│   │   ├── chat_triggers.json
│   │   ├── creators.json
│   │   ├── dashboard_state.json
│   │   ├── integrations.json
│   │   ├── jobs.json
│   │   ├── notifications.json
│   │   ├── permissions.json
│   │   ├── platforms.json
│   │   ├── poll_votes.json
│   │   ├── rate_limits.json
│   │   ├── roadmap.json
│   │   ├── runtime_snapshot.json
│   │   ├── score_events.json
│   │   ├── system.json
│   │   └── tally_events.json
│   ├── js
│   │   ├── platforms
│   │   │   ├── discord.js
│   │   │   ├── kick.js
│   │   │   ├── pilled.js
│   │   │   ├── rumble.js
│   │   │   ├── twitch.js
│   │   │   ├── twitter.js
│   │   │   └── youtube.js
│   │   ├── utils
│   │   │   ├── about-data.js
│   │   │   ├── global-loader.js
│   │   │   ├── search-pagination.js
│   │   │   ├── snapshot-health.js
│   │   │   ├── standalone-guard.js
│   │   │   ├── table-resize.js
│   │   │   ├── version-stamp.js
│   │   │   └── versioning.js
│   │   ├── about.js
│   │   ├── accounts.js
│   │   ├── analytics.js
│   │   ├── admin-auth.js
│   │   ├── admin-gate.js
│   │   ├── admin-login.js
│   │   ├── api-usage.js
│   │   ├── api.js
│   │   ├── app.js
│   │   ├── approvals.js
│   │   ├── audit.js
│   │   ├── auth.js
│   │   ├── bots.js
│   │   ├── changelog-merge.js
│   │   ├── charts.js
│   │   ├── chatReplay.js
│   │   ├── clip-detail.js
│   │   ├── clips.js
│   │   ├── creators.js
│   │   ├── data-signals.js
│   │   ├── discord-guild.js
│   │   ├── jobs.js
│   │   ├── notifications.js
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
│   │   ├── tiers.js
│   │   ├── triggers.js
│   │   ├── updates.js
│   │   └── view-loader.js
│   ├── livechat
│   │   ├── partials
│   │   │   ├── footer_live.html
│   │   │   ├── footer_replay.html
│   │   │   ├── theme_menu.html
│   │   │   └── theme_selector.html
│   │   ├── static
│   │   │   ├── themes
│   │   │   │   ├── theme-default.css
│   │   │   │   ├── theme-midnight.css
│   │   │   │   └── theme-slate.css
│   │   │   ├── chat.css
│   │   │   └── chat_live_input.css
│   │   ├── favicon.ico
│   │   └── index.html
│   ├── runtime
│   │   └── exports
│   │       ├── admin
│   │       │   ├── audit
│   │       │   │   ├── audit.json
│   │       │   │   └── tmpu8gnpp5u
│   │       │   └── users
│   │       │       ├── tmpc7dpld6s
│   │       │       └── users.json
│   │       ├── telemetry
│   │       │   ├── auth_events.json
│   │       │   ├── errors.json
│   │       │   ├── events.json
│   │       │   ├── rates.json
│   │       │   ├── tmp076fi3_5
│   │       │   ├── tmp51uhqc6_
│   │       │   ├── tmp_1s4idh9
│   │       │   ├── tmpjhws_z56
│   │       │   ├── tmppj2dq2z0
│   │       │   ├── tmpqx_cbo9m
│   │       │   └── tmptwfxz_hg
│   │       ├── about.admin.json
│   │       ├── about.public.json
│   │       ├── changelog.json
│   │       ├── changelog.runtime.json
│   │       ├── clips.json
│   │       ├── meta.json
│   │       ├── platforms.json
│   │       ├── polls.json
│   │       ├── README.md
│   │       ├── roadmap.json
│   │       ├── runtime_snapshot.json
│   │       ├── scoreboards.json
│   │       ├── tallies.json
│   │       ├── tmp7y_po37m
│   │       ├── tmpwc9v6sjt
│   │       └── version.json
│   ├── shared
│   │   ├── state
│   │   │   ├── discord
│   │   │   │   └── runtime.json
│   │   │   ├── telemetry
│   │   │   │   ├── errors.json
│   │   │   │   ├── events.json
│   │   │   │   └── rates.json
│   │   │   ├── about.admin.json
│   │   │   ├── about.public.json
│   │   │   ├── changelog.json
│   │   │   ├── changelog.runtime.json
│   │   │   ├── clips.json
│   │   │   ├── meta.json
│   │   │   ├── platforms.json
│   │   │   ├── polls.json
│   │   │   ├── quotas.json
│   │   │   ├── README.md
│   │   │   ├── roadmap.json
│   │   │   ├── runtime_snapshot.json
│   │   │   ├── scoreboards.json
│   │   │   ├── tallies.json
│   │   │   ├── tmp1jjy08ht
│   │   │   └── version.json
│   │   └── suspension
│   │       ├── suspension-banner.css
│   │       └── suspension-banner.js
│   ├── support
│   │   ├── views
│   │   │   ├── documentation.html
│   │   │   └── overview.html
│   │   └── index.html
│   ├── tools
│   │   ├── views
│   │   │   ├── automation.html
│   │   │   ├── overview.html
│   │   │   └── studio.html
│   │   └── index.html
│   ├── views
│   │   ├── platforms
│   │   │   ├── discord.html
│   │   │   ├── kick.html
│   │   │   ├── pilled.html
│   │   │   ├── rumble.html
│   │   │   ├── twitch.html
│   │   │   ├── twitter.html
│   │   │   └── youtube.html
│   │   ├── about.html
│   │   ├── accounts.html
│   │   ├── analytics.html
│   │   ├── api-usage.html
│   │   ├── approvals.html
│   │   ├── audit.html
│   │   ├── bots.html
│   │   ├── chat-replay.html
│   │   ├── chat_overlay_obs.html
│   │   ├── chat_replay_window.html
│   │   ├── chat_window.html
│   │   ├── clips.html
│   │   ├── creators.html
│   │   ├── data-signals.html
│   │   ├── design.html
│   │   ├── jobs.html
│   │   ├── notifications.html
│   │   ├── overview.html
│   │   ├── polls.html
│   │   ├── ratelimits.html
│   │   ├── scoreboard-management.html
│   │   ├── scoreboards.html
│   │   ├── settings.html
│   │   ├── support.html
│   │   ├── tallies.html
│   │   ├── tiers.html
│   │   ├── triggers.html
│   │   └── updates.html
│   ├── about.html
│   ├── accessibility.html
│   ├── changelog.html
│   ├── clips.html
│   ├── CONTRACTS.md
│   ├── favicon.ico
│   ├── home.html
│   ├── index.html
│   ├── lander.html
│   ├── polls.html
│   ├── POST_MORTEM.md
│   ├── postmortem.html
│   ├── privacy.html
│   ├── scoreboards.html
│   ├── tallies.html
│   └── TIERS.md
├── runtime
│   ├── exports
│   │   ├── admin
│   │   │   └── donations
│   │   │       └── donations.json
│   │   ├── changelog.json
│   │   ├── changelog.runtime.json
│   │   └── version.json
│   └── version.py
├── schemas
│   ├── platform
│   │   ├── discord.schema.json
│   │   ├── rumble.schema.json
│   │   ├── twitch.schema.json
│   │   ├── twitter.schema.json
│   │   └── youtube.schema.json
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
│   └── triggers.schema.json
├── shared
│   └── state
│       ├── telemetry
│       │   └── auth_events.json
│       └── admin_activity.json
├── .gitignore
├── COMMERCIAL-LICENSE-NOTICE.md
├── DASHBOARD_AUDIT_REPORT.md
├── EULA.md
├── favicon.ico
├── LICENSE
└── README.md
```

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

## Roadmap Alignment (Alpha)

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

## README Change Log (This Update)
- **Replaced:** The previous **Repo Tree (partial)** section has been replaced with a full repo tree listing that includes every directory and file.
- **Removed:** The duplicate **Directory Structure (Exhaustive)** repo tree listing was removed to keep a single authoritative repo tree section.
- **Updated:** Overview/auth sections now explicitly describe the admin-only static UI, non-authoritative state posture, and privileged action routing through the Auth API/runtime.
- **Added:** Differences between the Admin Dashboard, Creator dashboard, and Public site are documented in a dedicated section.

## Status
- **Stage:** Alpha revival (admin control + telemetry visibility, no backend services).
- **Owner:** Brainstream Media Group / Daniel Clancy.
- **License:** Proprietary • All Rights Reserved.

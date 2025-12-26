# StreamSuites Dashboard

## Overview

**StreamSuites Dashboard** is a **static, client-side control panel** for configuring and inspecting the StreamSuites automation system without embedding runtime logic.

StreamSuites itself is a **modular, multi-platform livestream runtime**. It centralizes orchestration for Rumble, Twitch, YouTube, and Discord connectors, favors **deterministic, schema-driven automation** over platform-native bot UIs, and keeps live execution inside the runtime rather than the dashboard.

**The dashboard stays read-only (GitHub Pages safe) and performs no live API calls.** It includes a **config state layer** that hydrates from localStorage drafts or bundled JSON defaults, and can export deterministic `creators.json` / `platforms.json` bundles for runtime consumption. All runtime facts shown in the UI come from **exported artifacts**, and those exports remain the **single source of truth**. The dashboard is an inspection and drafting surface; execution is runtime-owned.

**Current phase:** early-stage / alpha. Runtime exports and schema contracts continue to stabilize, and the dashboard will mirror those exports without assuming live connectivity.

**Dashboard purpose**
- **Configuration** — edit and validate runtime contracts without needing a live backend
- **Visualization** — render schemas, tiers, triggers, and limits in human-readable form
- **State inspection** — review static state snapshots and exported runtime metadata
- **Schema-driven UI** — the UI is generated from JSON schemas shared by all runtimes

The dashboard is intentionally lightweight, schema-driven, and portable.

## Version & Ownership

- **Current version:** StreamSuites™ v0.2.0-alpha (sourced from `docs/version.json` as the canonical dashboard version reference).
- **Dashboard role:** Static, read-only, and non-authoritative. It reflects runtime exports and drafts configuration locally without issuing live commands.
- **Versioning policy:** Dashboard surfaces mirror the runtime version and build metadata; UI badges hydrate directly from the bundled `docs/version.json` and are expected to match `runtime/version.py` in the main StreamSuites repo.
- **Licensing notice:** Proprietary • All Rights Reserved • © 2025 Brainstream Media Group • Owner: Daniel Clancy.
- **Alpha-stage disclaimer:** Active alpha surface; schemas, exports, and visualizations may change as runtime contracts stabilize.

### Operational Boundary

- **Static control surface** — zero ability to mutate runtimes or send actions; edits are limited to local JSON drafts and exports
- **Offline-first** — no live connections; everything is rendered from shipped or downloaded JSON
- **No API calls** — the browser bundle deliberately omits live fetches
- **Runtime exports are authoritative** — whatever the runtime exports, the dashboard simply renders
- **Visual-only philosophy** — dashboards illuminate runtime exports; control and execution stay in the runtimes

---

## Relationship to StreamSuites (Main Repo)

This repository is a **separate but companion project** to the main `StreamSuites` runtime.

### Textual System Overview Diagram

```
[StreamSuites Runtime] <— consumes schemas — [StreamSuites-Dashboard (static, read-only)]
         |                                              |
         |                                              +— planned status surface (no heartbeat yet)
         |
[Discord Bot Runtime] <— shared schemas ——————> [Dashboard surfaces bot status (planned visibility)]
         |
         +— Rumble chat SSE ingestion (architecture solved; runtime export alignment underway)
```

### Component Relationships

| Component | Responsibility |
|---------|----------------|
| **StreamSuites (main repo)** | Runtime execution, chat bots, livestream automation, job orchestration |
| **Discord Bot** | First-class runtime peer that consumes the same schemas; planned dashboard status surfacing and command parity |
| **StreamSuites-Dashboard** | Configuration UI, inspection, visualization, and admin control |

The dashboard **does not execute jobs** and **does not run bots**.  
It **edits, validates, and visualizes configuration** that the runtime consumes.

The dashboard **does not depend on any specific runtime being active**. It may be used with:
- Streaming runtime only
- Discord runtime only
- Both runtimes together sharing the same schemas

---

## Hosting & Deployment Model

### Current State (Initial Release)

- Hosted as a **static site via GitHub Pages**
- No authentication
- No backend
- All logic runs in the browser
- Reads/writes JSON-structured configuration files

This enables rapid iteration and immediate usability.

---

### Near-Term Intent

The dashboard is designed to be:

- **Iframe-safe**
- **Embed-friendly**
- **Host-agnostic**

This allows it to be embedded into an external site such as:

```
https://streamsuites.app
https://danielclancy.net/streamsuites
```

Account gating, permissions, or UI framing can be handled **outside** the dashboard (e.g. Wix Studio), without modifying the dashboard itself.

---

### Long-Term Direction

Possible future evolutions (not required now):

- Migration to **Wix Studio** as the hosting surface when authenticated backends are needed
- Optional connection to a local or remote API
- Read/write access to live runtime state
- Multi-user permission layers (externally enforced)
- Public / private view separation

Crucially, **none of these require rewriting the dashboard**.

---

## Public-Facing Media Surfaces (Static)

- **Home (`docs/home.html`)** — central public landing surface linking to all public galleries and the creator dashboard. Summarizes system context, public/read-only posture, and module rollout (clips, polls, tallies, scoreboards).
- **Clips Gallery (`docs/clips.html`)** — standalone, unauthenticated gallery of placeholder clips that will later link to platform destinations; uses static placeholder data and mirrors the dark theme.
- **Polls Gallery (`docs/polls.html`)** — standalone, unauthenticated gallery of placeholder polls/results; static only, ready for future data hydration. Poll detail defaults to the bar view with pie available as a toggle.
- **Tallies Gallery (`docs/tallies.html`)** — standalone gallery mirroring the polls layout for programmatic tallies; includes a tallies detail page (`docs/tallies/detail.html`) with bar/pie/custom views and placeholder aggregation data.
- **Scoreboards Gallery (`docs/scoreboards.html`)** — new standalone gallery mirroring the polls layout for score-centric use cases: gambling totals, chat-driven games, engagement counters, and time-based tallies. Detail view (`docs/scoreboards/detail.html`) includes placeholder bar/pie visuals and metadata.
- **About (`docs/about.html`)** — public-facing overview of StreamSuites, clarifying runtime vs. dashboard separation, shared version badge, and product-grade messaging.
- **Privacy (`docs/privacy.html`)** — provisional public privacy policy surface using the shared glass layout and SEO metadata.
- **Accessibility (`docs/accessibility.html`)** — accessibility statement with contact and compliance intent, sharing the public shell.
- **Changelog (`docs/changelog.html`)** — public roadmap/changelog surface with native `<progress>` roadmap bars styled per the button/glass system and grouped release notes.
- **Support (`docs/support/index.html` + `docs/support/views/*`)** — public parent page with sub-views for overview and documentation placeholders plus outbound platform support links.
- **Tools (`docs/tools/index.html` + `docs/tools/views/*`)** — public parent page with sub-views for overview and per-tool CTAs using the conic-gradient button system.

All public pages are **independent entry points** (no dashboard routing), GitHub Pages–safe, and reuse the shared dark styling in `docs/css/public-pages.css`.

---

## Design Principles

- **Static-first** — no server required
- **Schema-driven** — UI generated from JSON schemas
- **Platform-neutral** — not tied to Wix, Electron, or a specific backend
- **Future-proof** — supports growth without architectural resets
- **Human-readable** — prioritizes clarity over abstraction
- **Local-first drafts** — configuration edits live in `localStorage` until exported
- **Deterministic exports** — bundled downloads (`creators.json`, `platforms.json`) are schema-shaped for runtime ingestion

The dashboard is intentionally **runtime-agnostic**. Multiple runtimes (e.g., streaming orchestration and Discord control-plane) can consume the same schemas without changing the UI. The dashboard remains a static artifact that can be opened locally or hosted on GitHub Pages and still reflect the latest schema set.

## Data & Signals dashboard view

- **New view:** a first-class **Data & Signals** surface now lives in `docs/views/data-signals.html` with JS wiring in `docs/js/data-signals.js`. It renders runtime-owned entities, append-style signals, and administrative exports with client-side search, pagination, and optional sorting driven by a shared utility (`docs/js/utils/search-pagination.js`).
- **Read-only posture:** every table hydrates from static JSON exports under `docs/data/`. No edits, mutations, or write-back paths are present; the runtime remains authoritative.
- **Operational notices:** the view explicitly calls out that runtime exports are the source of truth and the dashboard is CMS-style visibility only.

### CMS model (runtime vs. dashboard)

- **Runtime = source of truth.** The StreamSuites runtimes own execution, ingestion, publishing, and export cadence. JSON snapshots (entities, signals, administrative systems) originate from runtime exports.
- **Dashboard = visibility + configuration surface.** The dashboard consumes those exports, providing local drafts for configuration and read-only overlays for runtime facts. Client-side search/pagination keeps the UI responsive without introducing write paths or backend calls.

### Current module coverage (runtime exports surfaced)

- Entities: **Clips, Polls, Tallies, Scoreboards**
- Signals: **Chat trigger events, Poll votes, Tally increments, Score updates**
- Administrative exports: **Creators, Chat triggers, Jobs, Rate limits, Integrations, Permissions (placeholder)**

## Discord Control-Plane Integration

The StreamSuites ecosystem includes an optional **Discord control-plane runtime**. It is deployment-gated and may or may not be running alongside the streaming runtime. The dashboard treats Discord as a **read-only status surface** for now: it consumes exported metadata but does not issue commands or assume the runtime is enabled.

When present, the Discord control-plane runtime is expected to expose non-authoritative status signals such as heartbeat, connection state, guild count, and the current status text/emoji. These signals help operators verify liveness without coupling the dashboard to Discord bot execution. Future iterations may expand visibility, but no interactive Discord controls are implemented in this repository.

### Runtime Compatibility Matrix

| Runtime entrypoint | Status | Notes |
|--------------------|--------|-------|
| `app.py` (Streaming Runtime) | **SUPPORTED** | Produces and consumes the schemas surfaced by the dashboard |
| `discord_app.py` (Discord Runtime) | **SUPPORTED** | First-class runtime peer; planned dashboard visibility for bot presence and command parity; heartbeat endpoint planned but not yet implemented |
| Rumble Chat Runtime | **ARCHITECTURE SOLVED** | Canonical SSE ingestion via `https://web7.rumble.com/chat/api/chat/{CHAT_ID}/stream`; runtime export alignment is underway |

### Discord Control-Plane Notes (Documentation Only)

Discord integrations may expose:
- **System status** (control-plane visibility)
- **Livestream notifications** (control-plane notifications)
- **Admin actions** (control-plane execution)

These are **control-plane only** capabilities that complement, but do not replace, the dashboard. The dashboard continues to serve as the schema-driven configuration and inspection layer shared across runtimes.

---

## Twitch Foundations (Dashboard-Only Scaffold)

- The dashboard now includes a **Twitch foundation view** (read-only) that mirrors the planned configuration/runtime fields defined in `schemas/platform/twitch.schema.json`.
- Twitch execution, chat I/O, and authoritative state **live exclusively in the main StreamSuites runtime repository**. The dashboard only visualizes exported snapshots or locally stored configuration.
- A deterministic **“No runtime connected”** banner is shown because the dashboard does not connect to Twitch directly and expects offline mode by default.
- Future runtime exports can hydrate the Twitch view without changing the dashboard scaffold.

## YouTube Scaffold (Dashboard-Only)

- A **YouTube platform scaffold** now exists in `docs/views/platforms/youtube.html`, matching the planned contract in `schemas/platform/youtube.schema.json`.
- The dashboard remains **static and read-only** for YouTube; all chat execution and livestream handling stay in the StreamSuites runtime repo.
- Runtime snapshots (heartbeat, connection state, last seen message) are optional exports from the runtime; absence of data is expected in static deployments.
- Platform sequencing remains **Twitch foundation first**, with **YouTube hydration next** and **Rumble alignment now focused on the new SSE architecture**.

## Rumble Chat SSE Breakthrough

- The canonical Rumble chat ingestion path now uses SSE at `https://web7.rumble.com/chat/api/chat/{CHAT_ID}/stream`, emitting `init` and `messages` events.
- This endpoint replaces prior DOM-scrape or restricted mechanisms and is considered the canonical path forward.
- Runtime integration is underway; the dashboard will hydrate via runtime-exported JSON snapshots once the SSE pipeline exports data.
- The dashboard remains neutral to ingestion method (polling vs SSE) and will not introduce live requests—runtime exports stay authoritative.

## Clips View (Runtime Export Visibility)

- **Read-only lifecycle surface:** `docs/views/clips.html` + `docs/js/clips.js` render every clip emitted by the runtime export pipeline, including queued, encoding, uploaded, published, and failed items. Clip IDs link to the public clip detail page, and destinations render as outbound links when provided.
- **Authoritative data only:** the view hydrates from `docs/shared/state/clips.json` (or the equivalent runtime export path) without inferring or mutating states. Pending and failed clips remain visible until the runtime evicts them.
- **Safe polling:** lightweight polling (10s cadence) tolerates missing or partial data and will not retry aggressively on errors.
- **State vocabulary (display-only):**
  - `queued` — received by the runtime and awaiting worker capacity
  - `encoding` — actively being transcoded
  - `encoded` — packaged and ready to upload
  - `uploading` — being delivered to the destination platform/channel
  - `published` — confirmed as successfully posted
  - `failed` — marked unsuccessful by the runtime; stays visible for operators

Clips remain **read-only** inside the dashboard: no edit, retry, or delete controls are surfaced. The dashboard simply mirrors what the runtime exports.

### New Dashboard Views & State Layer

- **Config State Layer** — `docs/js/state.js` + `docs/js/telemetry.js` provide normalized loading of `docs/data/*.json`, localStorage drafts, and optional runtime snapshots for telemetry panels.
- **Creators + Platforms** — creators list now hydrates bundled defaults, exposes platform toggles (YouTube, Twitch, Rumble, Discord), soft-disable, notes, and deterministic export/import.
- **Platform Toggles** — settings view now binds global platform service/telemetry toggles to `platforms.json`, preserving notes for runtime operators.
- **Runtime Telemetry (read-only)** — Overview shows platform status/last-seen/error from `docs/data/runtime_snapshot.json` when present.
- **Scoreboards** (`docs/views/scoreboards.html`) — static scoreboard visibility surface registered in the router; ready for schema-driven hydration.
- **Manage Scores** (`docs/views/scoreboard-management.html`) — administrative scaffold for planned scoreboard curation and edits.
- **Support** (`docs/views/support.html`) — documentation-forward view for operational and support workflows.

---

## Directory Structure

```
StreamSuites-Dashboard/
├── README.md
├── favicon.ico
│
├── dev-notes/             # Internal planning and compatibility notes
│   ├── compatibility.md
│   ├── decisions.md
│   └── roadmap.md
│
├── docs/                    # GitHub Pages root
│   ├── CONTRACTS.md        # Contract notes for schema consumers
│   ├── TIERS.md            # Tier documentation
│   ├── Thumbs.db           # Placeholder artifact (do not delete)
│   ├── favicon.ico         # Static site icon
│   ├── index.html          # App entry point
│   ├── home.html           # Central public landing page
│   ├── clips.html          # Public clips gallery (standalone)
│   ├── polls.html          # Public polls gallery (standalone)
│   ├── tallies.html        # Public tallies gallery (standalone)
│   ├── scoreboards.html    # Public scoreboards gallery (standalone)
│   ├── about.html          # Public about page (runtime vs. dashboard clarity)
│   ├── privacy.html        # Public privacy policy surface
│   ├── accessibility.html  # Public accessibility statement
│   ├── changelog.html      # Public roadmap + changelog
│   │
│   ├── assets/
│   │   ├── backgrounds/    # Hero/gradient backdrops and texture fills
│   │   │   ├── .gitkeep
│   │   │   ├── seodash.jpg
│   │   │   └── seoshare.jpg
│   │   ├── fonts/          # Self-hosted font files when needed
│   │   │   └── .gitkeep
│   │   ├── icons/          # UI icons and small glyphs
│   │   │   ├── .gitkeep
│   │   │   ├── favicon.ico
│   │   │   └── win1.ico
│   │   ├── illustrations/  # Informational or empty-state art
│   │   │   └── .gitkeep
│   │   ├── logos/          # Product and partner marks
│   │   │   ├── LOG2-3D-SML.png
│   │   │   ├── LOG2-3D.png
│   │   │   ├── LOG2TRIM-SML.png
│   │   │   ├── LOG2TRIM.png
│   │   │   ├── Thumbs.db
│   │   │   ├── logo.png
│   │   │   ├── seodash.jpg
│   │   │   ├── sswm.png
│   │   │   └── streamsuites.svg
│   │   └── placeholders/   # Temporary stock imagery and avatar fallbacks
│   │       └── .gitkeep
│   │
│   ├── css/
│   │   ├── base.css         # Layout, resets, typography
│   │   ├── components.css   # Buttons, tables, panels
│   │   ├── layout.css       # Structural layout rules
│   │   ├── overrides.css    # Custom overrides for components/themes
│   │   ├── public-pages.css # Shared styling for standalone public pages
│   │   └── theme-dark.css   # Dark theme (authoritative)
│   │
│   ├── data/                # Bundled JSON defaults + runtime snapshot examples
│   │   ├── changelog.json
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
│   │   ├── roadmap.json
│   │   ├── rate_limits.json
│   │   ├── runtime_snapshot.json
│   │   ├── score_events.json
│   │   ├── scoreboards.json
│   │   ├── tallies.json
│   │   └── tally_events.json
│   │
│   ├── js/
│   │   ├── about.js         # About view wiring
│   │   ├── api.js           # Data loading / persistence layer
│   │   ├── app.js           # App bootstrap & routing
│   │   ├── auth.js          # Placeholder for future auth hooks
│   │   ├── charts.js        # Metrics / visualization
│   │   ├── chatReplay.js    # Placeholder for planned historical chat replay
│   │   ├── creators.js      # Creator configuration UI (local drafts + exports)
│   │   ├── jobs.js          # Job visibility (clips, etc.)
│   │   ├── clips.js         # Runtime clip lifecycle surface (read-only, polling)
│   │   ├── public-clips.js  # Placeholder data renderer for public clips gallery
│   │   ├── public-changelog.js # Public changelog renderer (JSON-fed)
│   │   ├── data-signals.js  # Data & signals view wiring (read-only)
│   │   ├── overview.js      # Overview dashboard wiring + telemetry
│   │   ├── permissions.js   # Future permissions UI
│   │   ├── platforms.js     # Global platform toggle wiring
│   │   ├── ratelimits.js    # Ratelimit editor/visualization
│   │   ├── render.js        # Shared render helpers
│   │   ├── settings.js      # Settings view wiring + config import/export
│   │   ├── state.js         # Client-side state + ConfigState loader
│   │   ├── telemetry.js     # Runtime snapshot hydration helpers
│   │   ├── triggers.js      # Chat trigger configuration UI
│   │   ├── public-polls.js  # Placeholder data renderer for public polls gallery
│   │   ├── public-tallies.js# Placeholder data renderer for public tallies gallery
│   │   ├── public-scoreboards.js # Placeholder data renderer for public scoreboards gallery
│   │   ├── public-roadmap.js # Public changelog roadmap renderer (animated <progress> bars)
│   │   ├── poll-detail.js   # Poll detail visualization controls
│   │   ├── tally-detail.js  # Tally detail visualization controls
│   │   ├── utils/
│   │   |   ├── version-stamp.js
│   │   |   ├── versioning.js
│   │   │   └── search-pagination.js # Shared search + pagination utility
│   │   └── platforms/       # Platform-specific view logic
│   │       ├── discord.js
│   │       ├── rumble.js
│   │       ├── twitch.js
│   │       ├── twitter.js
│   │       └── youtube.js
│   │
│   ├── polls/
│   │   ├── detail.html
│   │   └── results.html
│   │
│   ├── tallies/
│   │   └── detail.html
│   │
│   ├── scoreboards/
│   │   └── detail.html
│   │
│   ├── support/             # Public support parent + sub-views
│   │   ├── index.html
│   │   └── views/
│   │       ├── documentation.html
│   │       └── overview.html
│   │
│   ├── tools/               # Public tools parent + sub-views
│   │   ├── index.html
│   │   └── views/
│   │       ├── automation.html
│   │       ├── overview.html
│   │       └── studio.html
│   │
│   ├── shared/
│   │   └── state/
│   │       ├── README.md
│   │       ├── clips.json
│   │       ├── jobs.json
│   │       ├── quotas.json
│   │       └── discord/
│   │           └── runtime.json
│   │
│   └── views/
│       ├── about.html
│       ├── chat-replay.html
│       ├── clips.html
│       ├── creators.html
│       ├── data-signals.html
│       ├── discord.html
│       ├── support.html
│       ├── scoreboards.html
│       ├── jobs.html
│       ├── overview.html
│       ├── polls.html
│       ├── tallies.html
│       ├── ratelimits.html
│       ├── scoreboard-management.html
│       ├── settings.html
│       ├── triggers.html
│       └── platforms/
│           ├── discord.html
│           ├── rumble.html
│           ├── twitch.html
│           ├── twitter.html
│           └── youtube.html
│
└── schemas/
    ├── chat_behaviour.schema.json
    ├── chat_log.schema.json
    ├── clip_schema.json
    ├── creators.schema.json
    ├── jobs.schema.json
    ├── permissions.schema.json
    ├── platform/
    │   ├── discord.schema.json   # Control-plane runtime visibility (optional, read-only)
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

---

## Planned Feature: Chat Replay

- Read-only historical chat replay using exported logs
- Optional embed or extension; no control over bots
- Intended to remain static and decoupled from runtime execution
- May be extended via browser extensions without altering core routing

---

## Schema-Driven Architecture

All editable data is governed by JSON schemas stored in `/schemas`.

Benefits:
- Validation without a backend
- Predictable structure shared across platforms
- Easy interoperability with the StreamSuites runtime
- Safe UI generation without hardcoding assumptions

Schemas are treated as **contract files** between the dashboard and the runtime.

Rumble platform schemas remain **authoritative and unchanged** while the runtime pivots to the canonical SSE ingestion path. No dashboard features have been removed, and runtime export alignment will hydrate the dashboard without schema changes.

### Quota Visibility (Visual-Only)

- **Schema:** `schemas/quotas.schema.json` defines the runtime-exported quota contract (v1), including per-platform windows, usage, remaining units, reset times, and runtime-evaluated health status.
- **Snapshot example:** `docs/shared/state/quotas.json` provides a representative export so the dashboard can render quota health without a live runtime.
- **Readiness:** quotas are **visual-only**; the dashboard does **no API calls**, mutations, or live polling. Fresh exports must be generated by the runtime and dropped into the expected path.

---

## Styling & Theme

The dashboard uses a **dark theme** by default.

Typography:

```css
@font-face {
  font-family: "RechargeBd";
  src: url("https://raw.githubusercontent.com/BSMediaGroup/Resources/master/FONTS/Recharge%20Bd.otf")
       format("opentype");
  font-weight: 700;
}

@font-face {
  font-family: "SuiGenerisRg";
  src: url("https://raw.githubusercontent.com/BSMediaGroup/Resources/master/FONTS/Sui%20Generis%20Rg.otf")
       format("opentype");
  font-weight: 400;
}
```

Visual styling is influenced by existing dark-UI work (e.g. Mapbox dashboards, StreamSuites internal tooling), prioritizing:

- High contrast
- Low visual noise
- Clear hierarchy
- Dense information without clutter

---

## Roadmap

The About page includes a **static, informational roadmap** that mirrors runtime progress without acting as a control surface. It lists current modules (including the new **Clips Module**) with honest state notes pulled from runtime reality. Items are read-only and exist to communicate progress; they do not change contracts, trigger actions, or alter runtime behavior from the dashboard. The roadmap section now supports direct linking via `#roadmap` for deep-linking to the visual roadmap panel.

### Phase 1 — Foundation (Current)
- Static GitHub Pages deployment
- Creators editor (local drafts + deterministic export/import)
- Platform service toggles (YouTube, Twitch, Rumble, Discord) with telemetry flags
- Schema validation
- Dark theme baseline

### Phase 2 — Runtime Awareness
- Job visibility (clips, queues)
- Read-only runtime state inspection
- Log / activity views
- Quota health visualization (powered by exported snapshots; still visual-only)
- Runtime telemetry panels hydrated from `runtime_snapshot.json` when provided

### Historical Visibility (Planned)
- Chat replay views
- Stream-specific lookup
- Platform-agnostic rendering

### Phase 3 — Control Surface
- Action triggers (manual clip, reload config)
- Platform-specific panels
- Permission scaffolding (UI-only)

### Phase 4 — Integration & Distribution
- Embedded deployment
- Optional API connectivity
- Optional desktop wrapper or launcher

---

## Status

This repository represents an **active, evolving control surface** for StreamSuites.

It is intentionally decoupled from execution logic and safe to iterate independently.

---

## License & Ownership

All code and assets are produced under  
**Brainstream Media Group**.

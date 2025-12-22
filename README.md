# StreamSuites Dashboard

## Overview

**StreamSuites Dashboard** is a **static, client-side control panel** for configuring and inspecting the StreamSuites automation system.

It is designed to provide a **human-friendly interface** over StreamSuites’ JSON-driven configuration model, without introducing server dependencies, platform lock-in, or runtime coupling.

**This dashboard currently operates in read-only / static mode.** It performs **no API calls**, never issues live commands, and intentionally ships **without runtime control hooks**. All runtime facts shown in the UI come from **exported artifacts**, and those exports remain the **single source of truth**.

**Dashboard purpose**
- **Configuration** — edit and validate runtime contracts without needing a live backend
- **Visualization** — render schemas, tiers, triggers, and limits in human-readable form
- **State inspection** — review static state snapshots and exported runtime metadata
- **Schema-driven UI** — the UI is generated from JSON schemas shared by all runtimes

The dashboard is intentionally lightweight, schema-driven, and portable.

### Operational Boundary

- **Read-only control surface** — zero ability to mutate runtimes or send actions
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
         +— Rumble bot paused (API protection layer; schemas intact)
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

## Design Principles

- **Static-first** — no server required
- **Schema-driven** — UI generated from JSON schemas
- **Platform-neutral** — not tied to Wix, Electron, or a specific backend
- **Future-proof** — supports growth without architectural resets
- **Human-readable** — prioritizes clarity over abstraction

The dashboard is intentionally **runtime-agnostic**. Multiple runtimes (e.g., streaming orchestration and Discord control-plane) can consume the same schemas without changing the UI. The dashboard remains a static artifact that can be opened locally or hosted on GitHub Pages and still reflect the latest schema set.

## Discord Control-Plane Integration

The StreamSuites ecosystem includes an optional **Discord control-plane runtime**. It is deployment-gated and may or may not be running alongside the streaming runtime. The dashboard treats Discord as a **read-only status surface** for now: it consumes exported metadata but does not issue commands or assume the runtime is enabled.

When present, the Discord control-plane runtime is expected to expose non-authoritative status signals such as heartbeat, connection state, guild count, and the current status text/emoji. These signals help operators verify liveness without coupling the dashboard to Discord bot execution. Future iterations may expand visibility, but no interactive Discord controls are implemented in this repository.

### Runtime Compatibility Matrix

| Runtime entrypoint | Status | Notes |
|--------------------|--------|-------|
| `app.py` (Streaming Runtime) | **SUPPORTED** | Produces and consumes the schemas surfaced by the dashboard |
| `discord_app.py` (Discord Runtime) | **SUPPORTED** | First-class runtime peer; planned dashboard visibility for bot presence and command parity; heartbeat endpoint planned but not yet implemented |
| Rumble Chat Runtime | **PAUSED** | Upstream API restriction (DDoS protection layer); schemas remain valid and authoritative while support is paused |

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
- Platform sequencing remains **Twitch foundation first**, with **YouTube hydration next** and **Rumble alignment after upstream access stabilizes**.

### New Dashboard Views

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
│   │
│   ├── assets/
│   │   ├── backgrounds/    # Hero/gradient backdrops and texture fills
│   │   │   ├── .gitkeep
│   │   │   └── seodash.jpg
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
│   │   └── theme-dark.css   # Dark theme (authoritative)
│   │
│   ├── js/
│   │   ├── about.js         # About view wiring
│   │   ├── api.js           # Data loading / persistence layer
│   │   ├── app.js           # App bootstrap & routing
│   │   ├── auth.js          # Placeholder for future auth hooks
│   │   ├── charts.js        # Metrics / visualization
│   │   ├── chatReplay.js    # Placeholder for planned historical chat replay
│   │   ├── creators.js      # Creator configuration UI
│   │   ├── jobs.js          # Job visibility (clips, etc.)
│   │   ├── overview.js      # Overview dashboard wiring
│   │   ├── permissions.js   # Future permissions UI
│   │   ├── ratelimits.js    # Ratelimit editor/visualization
│   │   ├── render.js        # Shared render helpers
│   │   ├── settings.js      # Settings view wiring
│   │   ├── state.js         # Client-side state helpers
│   │   ├── triggers.js      # Chat trigger configuration UI
│   │   └── platforms/       # Platform-specific view logic
│   │       ├── discord.js
│   │       ├── rumble.js
│   │       ├── twitch.js
│   │       ├── twitter.js
│   │       └── youtube.js
│   │
│   ├── polls/
│   │   └── results.html
│   │
│   ├── shared/
│   │   └── state/
│   │       ├── README.md
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
│       ├── discord.html
│       ├── support.html
│       ├── scoreboards.html
│       ├── jobs.html
│       ├── overview.html
│       ├── polls.html
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

Rumble platform schemas remain **authoritative and unchanged** even while the Rumble runtime is temporarily paused due to upstream API restrictions. No dashboard features have been removed, and runtime re-enablement is expected to occur without schema changes.

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

### Phase 1 — Foundation (Current)
- Static GitHub Pages deployment
- Creators editor
- Chat trigger editor
- Schema validation
- Dark theme baseline

### Phase 2 — Runtime Awareness
- Job visibility (clips, queues)
- Read-only runtime state inspection
- Log / activity views
- Quota health visualization (powered by exported snapshots; still visual-only)

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

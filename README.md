# StreamSuites Dashboard

## Overview

**StreamSuites Dashboard** is a **static, client-side control panel** for configuring and inspecting the StreamSuites automation system.

It is designed to provide a **human-friendly interface** over StreamSuites’ JSON-driven configuration model, without introducing server dependencies, platform lock-in, or runtime coupling.

The dashboard is intentionally lightweight, schema-driven, and portable.

---

## Relationship to StreamSuites (Main Repo)

This repository is a **separate but companion project** to the main `StreamSuites` runtime.

| Component | Responsibility |
|---------|----------------|
| **StreamSuites (main repo)** | Runtime execution, chat bots, livestream automation, job orchestration |
| **StreamSuites-Dashboard** | Configuration UI, inspection, visualization, and admin control |

The dashboard **does not execute jobs** and **does not run bots**.  
It **edits, validates, and visualizes configuration** that the runtime consumes.

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
https://danielclancy.net/streamsuites
```

Account gating, permissions, or UI framing can be handled **outside** the dashboard (e.g. Wix Studio), without modifying the dashboard itself.

---

### Long-Term Direction

Possible future evolutions (not required now):

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
│   ├── favicon.ico         # Static site icon
│   ├── index.html          # App entry point
│   ├── Thumbs.db           # Placeholder artifact (do not delete)
│   │
│   ├── assets/
│   │   └── logos/
│   │
│   ├── css/
│   │   ├── base.css         # Layout, resets, typography
│   │   ├── components.css   # Buttons, tables, panels
│   │   ├── layout.css       # Structural layout rules
│   │   ├── overrides.css    # Custom overrides for components/themes
│   │   └── theme-dark.css   # Dark theme (authoritative)
│   │
│   ├── js/
│   │   ├── api.js           # Data loading / persistence layer
│   │   ├── app.js           # App bootstrap & routing
│   │   ├── auth.js          # Placeholder for future auth hooks
│   │   ├── charts.js        # Metrics / visualization
│   │   ├── chatReplay.js    # Placeholder for planned historical chat replay
│   │   ├── creators.js      # Creator configuration UI
│   │   ├── jobs.js          # Job visibility (clips, etc.)
│   │   ├── permissions.js   # Future permissions UI
│   │   ├── ratelimits.js    # Ratelimit editor/visualization
│   │   ├── render.js        # Shared render helpers
│   │   ├── state.js         # Client-side state helpers
│   │   └── triggers.js      # Chat trigger configuration UI
│   │
│   ├── polls/
│   │   └── results.html
│   │
│   └── views/
│       ├── chat-replay.html
│       ├── clips.html
│       ├── creators.html
│       ├── jobs.html
│       ├── overview.html
│       ├── polls.html
│       ├── ratelimits.html
│       ├── settings.html
│       └── triggers.html
│
└── schemas/
    ├── chat_log.schema.json
    ├── chat_behaviour.schema.json
    ├── clip_schema.json
    ├── creators.schema.json
    ├── jobs.schema.json
    ├── permissions.schema.json
    ├── poll_schema.json
    ├── ratelimits.schema.json
    ├── services.schema.json
    ├── system.schema.json
    ├── tiers.schema.json
    ├── triggers.schema.json
    └── platform/
        ├── discord.schema.json
        ├── rumble.schema.json
        ├── twitch.schema.json
        ├── twitter.schema.json
        └── youtube.schema.json
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

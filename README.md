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
│
├── docs/                    # GitHub Pages root
│   ├── index.html           # App entry point
│   │
│   ├── css/
│   │   ├── base.css         # Layout, resets, typography
│   │   ├── layout.css       # Structural layout rules
│   │   ├── components.css  # Buttons, tables, panels
│   │   └── theme-dark.css   # Dark theme (authoritative)
│   │
│   ├── js/
│   │   ├── app.js           # App bootstrap & routing
│   │   ├── api.js           # Data loading / persistence layer
│   │   ├── auth.js          # Placeholder for future auth hooks
│   │   ├── render.js        # Shared render helpers
│   │   ├── creators.js     # Creator configuration UI
│   │   ├── triggers.js     # Chat trigger configuration UI
│   │   ├── jobs.js          # Job visibility (clips, etc.)
│   │   ├── permissions.js  # Future permissions UI
│   │   └── charts.js       # Metrics / visualization
│   │
│   ├── views/
│   │   ├── overview.html
│   │   ├── creators.html
│   │   ├── triggers.html
│   │   ├── clips.html
│   │   ├── rumble.html
│   │   ├── youtube.html
│   │   ├── twitch.html
│   │   ├── twitter.html
│   │   └── discord.html
│   │
│   └── assets/
│       ├── icons/
│       └── logos/
│
└── schemas/
    ├── system.schema.json
    ├── creators.schema.json
    ├── triggers.schema.json
    ├── services.schema.json
    ├── ratelimits.schema.json
    ├── chat_behaviour.schema.json
    ├── clip_rules.schema.json
    ├── jobs.schema.json
    └── twitter.schema.json
```

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

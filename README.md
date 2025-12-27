# StreamSuites Dashboard — INDEFINITELY SUSPENDED

## Project Status: INDEFINITELY SUSPENDED
- The dashboard is frozen as a historical snapshot and will not receive feature work.
- There is **no live backend** connected to this UI.
- Configuration changes made here have **no effect** on any runtime.
- The site remains online strictly as a **read-only archival UI**.

## Relationship to Runtime Suspension
- The StreamSuites runtimes that previously consumed these exports are also suspended.
- Without active runtimes, the dashboard cannot reflect live state or push configuration.
- Any bundled JSON remains static and exists only for reference.

## Why the Dashboard Remains Online
- Preserved for documentation and design reference during the suspension period.
- Provides historical visibility into schema-driven UI patterns and past roadmap context.
- Serves as an archival artifact rather than an operational console.

## Suspension Disclaimers
- Public surfaces must carry a prominent **red “Suspended” badge** on every page (documentation only; not implemented here).
- About pages, roadmaps, and changelogs must clearly note that the project is suspended.
- Roadmap percentages and milestones are **historical only** and no longer meaningful indicators of progress.
- This UI no longer represents an active system.

# StreamSuites Dashboard

## Overview

**StreamSuites Dashboard** is a **static, client-side control panel** for configuring and inspecting the StreamSuites automation system without embedding runtime logic or connecting to live chat sources.

StreamSuites itself is a **modular, multi-platform livestream runtime**. It centralizes orchestration for Rumble, Twitch, YouTube, and Discord connectors, favors **deterministic, schema-driven automation** over platform-native bot UIs, and keeps live execution inside the runtime rather than the dashboard.

**The dashboard stays read-only (GitHub Pages safe) and performs no live API calls.** It includes a **config state layer** that hydrates from localStorage drafts or bundled JSON defaults, and can export deterministic `creators.json` / `platforms.json` bundles for runtime consumption. All runtime facts shown in the UI come from **exported artifacts**, and those exports remain the **single source of truth**. The dashboard is an inspection and drafting surface; execution is runtime-owned.

**Current phase:** early-stage / alpha. Runtime exports and schema contracts continue to stabilize, and the dashboard will mirror those exports without assuming live connectivity.

**Recent UI refinements:** About (dashboard + public) and Changelog pages now match the reference visuals, including squared scope markers, aligned hero metadata, widened body copy, and the right-aligned roadmap legend.

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
- **No API calls** — the browser bundle deliberately omits live fetches, including Rumble chat polling or livestream API reads. Dashboard does **NOT** connect to Rumble APIs directly.
- **Runtime exports are authoritative** — whatever the runtime exports, the dashboard simply renders
- **Chat ingestion is runtime-only** — Rumble chat ingest now uses runtime-selected modes (SSE when offered, DOM-based fallback, and API polling fallback), Twitch IRC, and any DOM-based chat send flows live exclusively inside the runtime; the dashboard only reads exported snapshots like `docs/data/chat_events.json`.
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
         +— Rumble chat ingest (runtime-owned; SSE best-effort with DOM/API fallbacks; dashboard hydrates exported snapshots only)
```

**Architecture reality:** chat ingest is handled by the runtime (SSE is best-effort only; DOM-based or API polling fallbacks are built-in), and any DOM chat send automation also lives exclusively inside the runtime execution environment. The runtime selects the active ingest path and remains the authoritative source of events. The dashboard remains **read-only** and only surfaces exported snapshots.

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
...
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

Rumble platform schemas remain **authoritative and unchanged** while the runtime pivots to the SSE-first ingest path with DOM/API fallbacks. No dashboard features have been removed, and runtime export alignment will hydrate the dashboard without schema changes.

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

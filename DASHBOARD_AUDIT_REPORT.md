# Dashboard Audit Report

## 1. Current Dashboard State (Factual)

- **Page inventory**: The dashboard shell at `docs/index.html` hosts admin views (overview, creators, triggers, jobs, clips, polls, tallies, scoreboards, data/signals, rate limits, settings, chat replay, platform views, support, updates, about) via the navigation list and view loader, while public surfaces live as standalone HTML files under `docs/` (e.g., `home.html`, `about.html`, `changelog.html`, `support/`, `tools/`). The main dashboard uses a shared container and dynamically injects view templates from `docs/views/` based on `data-view` selections. 【F:docs/index.html†L177-L244】【F:docs/js/app.js†L89-L158】
- **Static vs runtime-fed data**: Core datasets reside in checked-in JSON under `docs/data/` (creators, triggers, jobs, polls, tallies, scoreboards, platforms, integrations, changelogs, roadmap, runtime snapshots). The dashboard bootstrap polls only the static `shared/state/quotas.json` snapshot at a fixed interval and otherwise reads/writes localStorage through `App.storage`, keeping behavior static unless JSON files are updated manually. 【F:docs/js/app.js†L165-L200】【F:docs/data/roadmap.json†L1-L200】
- **Roadmap rendering behavior**: The About view loads a manifest (`about/about.manifest.json`) and concatenates scoped roadmap sections plus renders `data/roadmap.json` for progress bars and collapsible skill rows, supporting anchor scrolling (`#roadmap` alias). Rendering is JSON-driven with animation toggles and requires the static data files to exist; absent data leads to muted state messaging. 【F:docs/js/about.js†L36-L123】【F:docs/js/app.js†L418-L450】
- **Changelog ingestion behavior**: Public `changelog.html` hosts a changelog container populated by client-side scripts that fetch `data/changelog.dashboard.json` and `data/changelog.runtime.json` (static bundles) and apply suspension styling. Within the dashboard, the Updates view fetches the latest commits from GitHub via `docs/js/updates.js`, caches results in localStorage (`updates_cache_v1`), and supports manual refresh with abort support and patch truncation limits. 【F:docs/changelog.html†L21-L69】【F:docs/js/updates.js†L1-L88】
- **Version badge behavior**: `versioning.js` resolves `/version.json` relative to the deployed base path, caches the fetch, and exposes `Versioning.stampFooters` to write version and copyright text into dashboard, public, and section footers. `version-stamp.js` runs on DOM ready to inject version badges across public and dashboard footers. 【F:docs/js/utils/versioning.js†L10-L67】【F:docs/js/utils/version-stamp.js†L17-L74】
- **Storage usage**: The storage layer namespaces keys under `streamsuites.*`, offering JSON import/export helpers and supporting download/upload of JSON payloads. Updates caching and view state rely on `localStorage` only; no remote persistence is attempted. Runtime quota polling is read-only and non-persistent. 【F:docs/js/app.js†L49-L159】【F:docs/js/updates.js†L1-L67】

## 2. Alignment With Runtime Reality

- **Assumed runtime capabilities**: Navigation exposes modules for triggers, jobs, chat replay, and multiple platforms, but the bootstrap only consumes static JSON and a quota snapshot; no authenticated or live runtime calls exist. UI labels imply active administration while the state feed is limited to a read-only `shared/state/quotas.json`, indicating assumed runtime orchestration that is not present. 【F:docs/js/app.js†L165-L200】【F:docs/index.html†L189-L244】
- **Safe decoupling**: View loading fetches HTML fragments from the repo and fails gracefully with a placeholder when missing, keeping the dashboard functional without runtime dependencies. Quota polling tolerates fetch errors by storing `lastError` locally, and version stamping falls back silently if `version.json` is unreachable. 【F:docs/js/app.js†L201-L260】【F:docs/js/utils/versioning.js†L40-L67】
- **Future beta expectations**: Platform-specific views for YouTube, Twitch, and Rumble already exist as static templates and can be wired to snapshot data without enabling writes; the export helper (`App.exportRuntimeCreators`) hints at shaping creator payloads for runtime ingestion, signaling planned coupling once runtime is active. 【F:docs/js/app.js†L451-L523】

## 3. UX & Informational Health

- **Clarity of project status**: Public pages and roadmap include suspension badges, but the dashboard header shows an "idle" status indicator and "ADMIN DASHBOARD" badge without explicit suspension messaging, risking confusion about operational state. 【F:docs/index.html†L183-L204】【F:docs/changelog.html†L34-L55】
- **Risk of misleading users**: Navigation offers administrative views (settings, jobs, chat replay) that cannot apply changes, and quota polling suggests live system activity. Without inline caveats, users may infer live control despite the static implementation. 【F:docs/js/app.js†L165-L200】【F:docs/index.html†L189-L244】
- **Readability of roadmap & changelog**: Roadmap and changelog rely on JSON-driven rendering with legends, summaries, and suspension badges, providing clear progress bars and expandable entries. Client-side fetch failures revert to placeholder messaging, maintaining readability but silently degrading if data is missing. 【F:docs/changelog.html†L34-L69】【F:docs/js/about.js†L74-L123】
- **Discoverability of limitations**: Suspension indicators are visible on public roadmap/changelog, yet the dashboard shell lacks prominent suspension or read-only alerts beyond the global suspension banner include; limitations of runtime connectivity and non-authoritative state are implicit rather than stated per module. 【F:docs/index.html†L162-L171】【F:docs/changelog.html†L34-L55】

## 4. Technical Debt & Housekeeping (Non-Destructive)

- **Redundant pages**: Both dashboard views and separate public pages cover roadmap/changelog content, creating duplicated rendering logic and data dependencies across `docs/views/` and standalone HTML, increasing maintenance overhead. 【F:docs/changelog.html†L21-L69】【F:docs/js/app.js†L201-L260】
- **Repeated markup**: Navigation and footer structures are defined inline in `docs/index.html` while public pages define parallel branding and footer markup, rather than sharing partials, making consistency fragile. 【F:docs/index.html†L177-L244】【F:docs/changelog.html†L21-L45】
- **Fragile selectors**: View injection targets rely on IDs like `#view-container` and `#app-nav-list` with no fallback if the structure changes; delegated navigation depends on `[data-view]` attributes across injected fragments, so template drift can break routing silently. 【F:docs/js/app.js†L201-L260】
- **Hardcoded assumptions**: Base paths, platform names, and nav entries are hardcoded in `index.html` and `app.js`. Version resolution assumes deployment under `/docs` or root. Storage namespaces and export helpers hardcode field mappings for platforms (Rumble, YouTube, Twitch, Discord), limiting adaptability to new platforms without code edits. 【F:docs/js/utils/versioning.js†L14-L26】【F:docs/js/app.js†L451-L523】

## 5. Beta-Ready Dashboard Role

- Present platform readiness as **read-only snapshots** for YouTube and Twitch, sourcing from static JSON or periodic snapshot endpoints without enabling configuration writes.
- Keep Rumble visible but disabled with clear labeling and non-interactive controls, leveraging existing platform templates but gating actions.
- Expose configuration pages in **preview mode** only, emphasizing that edits are not persisted and providing export-only flows (reusing `App.exportRuntimeCreators`).
- Display telemetry as **snapshot-based** cards using the quotas feed pattern, including timestamps and error states to avoid implying live streaming control.
- Add prominent suspension/read-only messaging in the dashboard header and per-module ledes while retaining static hosting compatibility.

## 6. Future Expansion Guardrails

- Do not remove static safety: all runtime data must be fetched read-only with explicit opt-in before enabling mutations; default to localStorage or download-only flows.
- Preserve separation between public surfaces and admin dashboard; avoid coupling public pages to admin-only data or controls.
- Maintain clear platform state labels (enabled, preview, disabled) and avoid auto-enabling Rumble without explicit user acknowledgment once reintroduced.
- Keep navigation resilient: require existence checks and graceful fallbacks when templates or JSON payloads are missing to prevent blank screens.
- Versioning must remain centralized through `version.json` and footer stamping; avoid hardcoding version text in templates.

## 7. Final Output: Implementation Prompt (Do Not Execute)

=== FUTURE CODEX IMPLEMENTATION PROMPT (DO NOT EXECUTE) ===
Update the StreamSuites dashboard for beta while preserving static, non-authoritative guarantees:
1) Add prominent read-only/suspension banners to the dashboard header and each admin view lede without altering public pages.
2) Wire YouTube and Twitch platform views to consume snapshot JSON (mirroring `shared/state/quotas.json` polling) and render timestamps/errors; keep all controls disabled or clearly marked as previews.
3) Keep Rumble visible but disabled with explanatory text; do not attempt runtime calls.
4) Convert configuration pages (creators, settings, triggers, jobs) to preview-only by removing save paths, surfacing export buttons via `App.exportRuntimeCreators`, and labeling fields as non-persistent.
5) Expand telemetry panels using the existing quota polling pattern to show snapshot metrics only; no writebacks or live control surfaces.
6) Ensure versioning continues to rely on `version.json` and that changelog/roadmap rendering remains JSON-driven; avoid introducing backend dependencies or authentication flows.

# StreamSuites-Dashboard

Admin-facing StreamSuites surface deployed to Cloudflare Pages at `https://admin.streamsuites.app`.

## Release State

- README state prepared for `v0.4.2-alpha`.
- The active admin web surface is Cloudflare Pages hosted.
- The static app source still lives under `docs/`, with repo-root compatibility files forwarding root-published Pages projects into the same app.
- This repo consumes runtime exports for visibility and uses Auth API/runtime endpoints for privileged operations; it does not own runtime execution.

## Current Admin Surface Model

- Clean path-based admin routes are the primary navigation model, replacing older hash-fragment and partial-only dependence for normal use.
- Root and `docs/` rewrite manifests preserve deep links for routes such as `/overview`, `/accounts`, `/profiles`, `/analytics`, `/alerts`, `/notifications`, `/settings`, `/creator-stats`, `/integrations/...`, and other admin views.
- Admin account inspection now exposes authoritative public-profile state, including canonical slug, creator-capable vs viewer-only posture, StreamSuites and FindMeHere visibility or eligibility, slug aliases, canonical URLs, and reserved media fields including background image URL.
- The current routing and auth cutover work is reflected in fail-closed Auth API session gating, Cloudflare Pages-safe login routing, and current route compatibility handling.
- Alerts now live in a dedicated admin route and sidebar destination, separate from Analytics, while still consuming the same backend-owned alert settings, rules, targets, and history APIs.
- The Alerts workspace exposes backend-authored notification title/message fields, a backend-driven placeholder picker, a local live preview, and clearer delivery/status terminology without changing backend contracts.
- Alert preferences continue to manage backend-authored quiet hours, timezone-aware overnight suppression, and per-destination enabled/minimum-severity controls from the dedicated Alerts workspace.

## Hosting and Routing

- `_redirects` provides repo-root Cloudflare Pages compatibility and forwards routed assets and views into `docs/`.
- `docs/_redirects` defines the admin clean-route rewrites used by the static app itself.
- Runtime export metadata is consumed from local published copies under `docs/runtime/exports/`.

## Repo Tree (Abridged, Accurate)

```text
StreamSuites-Dashboard/
├── _redirects
├── .github/
│   └── workflows/
│       └── pages.yml
├── .vscode/
│   ├── launch.json
│   └── settings.json
├── BUMP_NOTES.md
├── changelog/
│   ├── changelog.runtime.json
│   └── v0.4.2-alpha.md
├── dev-notes/
│   ├── compatibility.md
│   ├── decisions.md
│   └── roadmap.md
├── docs/
│   ├── _redirects
│   ├── index.html
│   ├── 404.html
│   ├── about.html
│   ├── accessibility.html
│   ├── changelog.html
│   ├── clips.html
│   ├── home.html
│   ├── polls.html
│   ├── postmortem.html
│   ├── privacy.html
│   ├── scoreboards.html
│   ├── tallies.html
│   ├── auth/
│   │   ├── index.html
│   │   ├── login.html
│   │   └── success.html
│   ├── css/
│   │   ├── base.css
│   │   ├── components.css
│   │   ├── layout.css
│   │   ├── overrides.css
│   │   ├── status-widget.css
│   │   ├── theme-dark.css
│   │   └── updates.css
│   ├── data/
│   │   ├── admin_activity.json
│   │   ├── changelog.dashboard.json
│   │   ├── creators.json
│   │   ├── dashboard_state.json
│   │   ├── integrations.json
│   │   ├── jobs.json
│   │   ├── notifications.json
│   │   ├── permissions.json
│   │   ├── platforms.json
│   │   ├── rate_limits.json
│   │   ├── roadmap.json
│   │   ├── runtime_snapshot.json
│   │   └── telemetry/
│   ├── js/
│   │   ├── accounts.js
│   │   ├── admin-auth.js
│   │   ├── admin-gate.js
│   │   ├── admin-login.js
│   │   ├── admin-routes.js
│   │   ├── alerts.js
│   │   ├── analytics.js
│   │   ├── analytics-alerting.js
│   │   ├── api.js
│   │   ├── app.js
│   │   ├── toast.js
│   │   ├── bots.js
│   │   ├── creator-stats.js
│   │   ├── creators.js
│   │   ├── notifications.js
│   │   ├── overview.js
│   │   ├── settings.js
│   │   ├── state.js
│   │   ├── telemetry.js
│   │   └── utils/
│   │       └── country-flags.js
│   ├── runtime/
│   │   └── exports/
│   │       ├── meta.json
│   │       ├── runtime_snapshot.json
│   │       ├── version.json
│   │       └── telemetry/
│   ├── shared/
│   │   ├── data/
│   │   │   └── country_centroids.json
│   │   ├── state/
│   │   │   ├── live_status.json
│   │   │   ├── quotas.json
│   │   │   ├── runtime_snapshot.json
│   │   │   └── telemetry/
│   │   └── suspension/
│   ├── support/
│   │   ├── index.html
│   │   └── views/
│   ├── tools/
│   │   ├── index.html
│   │   └── views/
│   └── views/
│       ├── accounts.html
│       ├── alerts.html
│       ├── analytics.html
│       ├── api-usage.html
│       ├── approvals.html
│       ├── audit.html
│       ├── bots.html
│       ├── creator-stats.html
│       ├── creators.html
│       ├── data-signals.html
│       ├── jobs.html
│       ├── notifications.html
│       ├── overview.html
│       ├── settings.html
│       ├── triggers.html
│       └── platforms/
├── runtime/
│   ├── version.py
│   └── exports/
│       ├── changelog.json
│       ├── changelog.runtime.json
│       ├── version.json
│       └── admin/
│           └── donations/
├── schemas/
│   ├── chat_behaviour.schema.json
│   ├── chat_log.schema.json
│   ├── clip_schema.json
│   ├── creators.schema.json
│   ├── jobs.schema.json
│   ├── permissions.schema.json
│   ├── quotas.schema.json
│   ├── ratelimits.schema.json
│   ├── services.schema.json
│   ├── system.schema.json
│   ├── tiers.schema.json
│   ├── triggers.schema.json
│   └── platform/
├── shared/
│   └── state/
│       ├── admin_activity.json
│       └── telemetry/
├── tmp/
│   └── [temp output]
├── DASHBOARD_AUDIT_REPORT.md
├── index.html
└── README.md
```

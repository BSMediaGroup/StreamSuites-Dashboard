# StreamSuites-Dashboard

Admin-facing StreamSuites surface deployed to Cloudflare Pages at `https://admin.streamsuites.app`.

## Release State

- README state prepared for `v0.4.2-alpha`.
- The active admin web surface is Cloudflare Pages hosted.
- The static app source still lives under `docs/`, with repo-root compatibility files forwarding root-published Pages projects into the same app.
- This repo consumes runtime exports for visibility and uses Auth API/runtime endpoints for privileged operations; it does not own runtime execution.

## Current Admin Surface Model

- Clean path-based admin routes are the primary navigation model, replacing older hash-fragment and partial-only dependence for normal use.
- Root and `docs/` rewrite manifests preserve deep links for routes such as `/overview`, `/accounts`, `/profiles`, `/analytics`, `/alerts`, `/settings`, `/creator-stats`, `/integrations/...`, and other admin views.
- Admin account inspection now exposes authoritative public-profile state, including canonical slug, creator-capable vs viewer-only posture, StreamSuites and FindMeHere visibility or eligibility, slug aliases, canonical URLs, and reserved media fields including background image URL.
- The current routing and auth cutover work is reflected in fail-closed Auth API session gating, Cloudflare Pages-safe login routing, and current route compatibility handling.
- Analytics alerting, creator stats, telemetry, bot visibility, and account operations remain consumers or controllers over backend-owned state rather than independent authorities.
- Analytics alert rules now expose backend-authored title/body template fields plus a backend-driven variable picker so admins can insert supported `{{variable}}` tokens without duplicating rendering logic in the dashboard.
- Analytics alert preferences now manage backend-authored quiet hours, timezone-aware overnight suppression, and per-destination enabled/minimum-severity controls from the existing alerting workspace.

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
├── changelog/
│   └── changelog.runtime.json
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

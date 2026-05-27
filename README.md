# StreamSuites-Dashboard

Admin-facing StreamSuites surface deployed to Cloudflare Pages at `https://admin.streamsuites.app`.

## Release State

- README state prepared for `v0.4.2-alpha`.
- The active admin web surface is Cloudflare Pages hosted.
- The repo-root admin shell now acts as the canonical Pages entry point, matching the working Creator/Public single-root routing model, while shared assets and published exports still live under `docs/`.
- The deploy workflow now builds a root-style publish artifact into `dist/` instead of shipping the raw `docs/` tree directly, so the published shell, fallback files, and asset paths all resolve from the same root.
- This repo consumes runtime exports for visibility and uses Auth API/runtime endpoints for privileged operations; it does not own runtime execution.
- Cloudflare deep-link handling now avoids invalid wildcard-to-shell rewrites. The route manifests use exact admin shell paths plus a single dynamic `/users/:user_code` placeholder, which Cloudflare/Wrangler accepts without discarding the rules as loop candidates.

## Scope & Authority

- This repo is the admin/operator web shell, not the runtime itself.
- Admin access is privileged, but runtime execution, Auth decisions, version/build ownership, and exported state remain runtime-owned in `StreamSuites`.
- The dashboard is allowed to call privileged runtime/Auth endpoints, yet it still consumes those contracts rather than redefining them.
- Runtime-exported version/build files are mirrored under `docs/runtime/exports/`, while published state snapshots land under `docs/shared/state/`.

## Repo-Scoped Flowchart

```mermaid
flowchart TD
    Admin["Admin operator"] --> Gate["Admin session gate<br/>docs/auth + admin-gate.js"]
    Gate --> Shell["Dashboard shell and routes<br/>/overview /accounts /public-identities /progression /economy /alerts /analytics /bots /settings /permissions /profiles/integrations"]

    Shell --> Accounts["Accounts and creators views"]
    Shell --> PublicIdentities["Public identity reconciliation<br/>runtime-owned account assignment"]
    Shell --> Alerts["Alerts workspace<br/>rules, targets, preferences, history"]
    Shell --> Analytics["Analytics, activity, auth-events"]
    Shell --> Bots["Bots, jobs, runtime status"]
    Shell --> Progression["XP/level admin controls<br/>runtime-owned global progression"]
    Shell --> Economy["Economy/inventory admin controls<br/>runtime-owned public identity authority"]
    Shell --> Integrations["Creator integrations inspection"]
    Shell --> Settings["Tier, auth, and admin settings"]

    Shell --> RuntimeExports["Published runtime exports<br/>docs/runtime/exports + docs/shared/state"]
    Shell --> Auth["Runtime/Auth API<br/>admin session and privileged endpoints"]
    RuntimeExports --> Runtime["StreamSuites runtime authority"]
    Auth --> Runtime

    Accounts -. public profile visibility .-> Public["StreamSuites-Public"]
    Accounts -. FindMeHere eligibility .-> Members["StreamSuites-Members / FindMeHere"]
    Integrations -. creator readiness inspection .-> Creator["StreamSuites-Creator"]
```

## Current Admin Surface Model

- Clean path-based admin routes are the primary navigation model, replacing older hash-fragment and partial-only dependence for normal use.
- The admin dashboard now includes a dedicated `/permissions` route under System for authoritative developer dashboard access policy inspection and editing, while keeping StreamSuites Auth API as the sole permission authority.
- The `/approvals` workspace now also acts as the first admin intake surface for developer-console feedback submissions, beta applications, and authenticated developer reports while still consuming runtime-owned review data.
- The `/approvals` workspace also now reviews runtime-owned public authority claim, assignment, issue, and removal requests through `GET/PATCH /api/admin/public/authority/requests*`, with operator wording that stays explicit about review-state changes versus downstream transfer or suppression effects.
- The `/public-identities` workspace reviews queue, unresolved, ambiguous, assigned/resolved, ignored, and all livechat/public identity records through Runtime/Auth reconciliation endpoints, then calls Runtime/Auth for explicit admin assignment, forced reassignment, secondary unassignment, ignored marking, or reopening. Dashboard stores no identity authority locally.
- Root and `docs/` rewrite manifests preserve deep links for routes such as `/overview`, `/accounts`, `/public-identities`, `/profiles`, `/analytics`, `/alerts`, `/notifications`, `/settings`, `/creator-stats`, `/integrations/...`, and other admin views, but the repo root is now the authoritative shell so deep links do not depend on a `/docs/index.html` compatibility hop.
- Creator integrations now have a dedicated admin route at `/profiles/integrations`, backed by runtime/Auth-admin inspection endpoints for creator-capable posture, platform readiness, trigger foundation, and bot deploy eligibility.
- The `/integrations/kick` page now includes Runtime/Auth live-status diagnostics from `GET /api/admin/live-status/diagnostics?platform=kick`, plus a TTL/backoff-respecting manual scan request to `POST /api/admin/live-status/scan`. `/integrations/youtube` and `/integrations/twitch` show disabled scaffold live-fetch panels until backend scan control is implemented.
- Admin account investigation now also supports a dedicated `user_code` route at `/users/{user_code}` for exhaustive single-account inspection across identity, auth posture, creator readiness, integrations, and trigger footing.
- The trigger oversight route at `/integrations/triggers` is now a runtime/Auth-backed admin surface for creator-scoped Rumble text trigger CRUD and controlled managed-send testing.
- Admin account inspection now exposes authoritative public-profile state, including canonical slug, creator-capable vs viewer-only posture, StreamSuites and FindMeHere visibility or eligibility, slug aliases, canonical URLs, and reserved media fields including background image URL.
- The current routing and auth cutover work is reflected in fail-closed Auth API session gating, Cloudflare Pages-safe login routing, and current route compatibility handling.
- Alerts now live in a dedicated admin route and sidebar destination, separate from Analytics, while still consuming the same backend-owned alert settings, rules, targets, and history APIs.
- The Alerts workspace exposes backend-authored notification title/message fields, a backend-driven placeholder picker, a local live preview, and clearer delivery/status terminology without changing backend contracts.
- Alert preferences continue to manage backend-authored quiet hours, timezone-aware overnight suppression, and per-destination enabled/minimum-severity controls from the dedicated Alerts workspace.

## Hosting and Routing

- `_redirects` now mirrors the Creator/Public single-root SPA rewrite model: known admin routes resolve to the repo-root `index.html`, while shared asset directories still map into `docs/` in source checkouts.
- `docs/_redirects` remains as the docs-root compatibility manifest and now only rewrites the same Cloudflare-valid known admin routes, including the dynamic `/users/:user_code` shell path.
- `functions/[[path]].js` and `docs/functions/[[path]].js` keep a Pages runtime fallback for known admin SPA routes and now limit prefix fallback to `/users/` only, so valid admin routes no longer bounce through `404.html` while fake nested `/profiles/...` and `/integrations/...` paths stay true `404`s.
- Runtime export metadata is consumed from local published copies under `docs/runtime/exports/`.
- `scripts/build-pages-artifact.ps1` assembles the canonical deployment artifact by flattening `docs/` assets to the publish root, then overlaying the repo-root admin shell and a Cloudflare-valid root-style SPA fallback manifest.
- `scripts/validate-pages-routing.ps1` now regression-tests the built `dist/` artifact locally with `wrangler pages dev`, verifying representative deep links, a real bad path, and asset non-rewrite behavior.

## Cross-Repo Orientation

- Top-level authority map: [StreamSuites runtime README](https://github.com/BSMediaGroup/StreamSuites)
- Creator-surface detail: [StreamSuites-Creator README](https://github.com/BSMediaGroup/StreamSuites-Creator)
- Public-surface detail: [StreamSuites-Public README](https://github.com/BSMediaGroup/StreamSuites-Public)
- FindMeHere detail: [StreamSuites-Members README](https://github.com/BSMediaGroup/StreamSuites-Members)

## Repo Tree (Abridged, Accurate)

```text
StreamSuites-Dashboard/
├── .github/
│   └── workflows/
│       └── pages.yml
├── .vscode/
│   ├── launch.json
│   └── settings.json
├── 404.html
├── _redirects
├── BUMP_NOTES.md
├── DASHBOARD_AUDIT_REPORT.md
├── functions/
│   └── [[path]].js
├── README.md
├── changelog/
│   ├── changelog.runtime.json
│   └── v0.4.2-alpha.md
├── dev-notes/
│   ├── compatibility.md
│   ├── decisions.md
│   └── roadmap.md
├── docs/
│   ├── _redirects
│   ├── 404.html
│   ├── index.html
│   ├── functions/
│   │   └── [[path]].js
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
│   ├── assets/
│   │   ├── games/
│   │   │   ├── asset-catalog.json
│   │   │   ├── asset-files.json
│   │   │   └── ...
│   │   ├── js/
│   │   │   └── ss-social-platforms.js
│   │   └── icons/
│   │       └── ui/
│   │           ├── ss-admin.svg
│   │           ├── ss-creator.svg
│   │           ├── ss-developer.svg
│   │           └── ss-public.svg
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
│   │   ├── app.js
│   │   ├── bots.js
│   │   ├── creator-integrations.js
│   │   ├── creators.js
│   │   ├── economy.js
│   │   ├── jobs.js
│   │   ├── notifications.js
│   │   ├── overview.js
│   │   ├── permissions.js
│   │   ├── progression.js
│   │   ├── public-identities.js
│   │   ├── settings.js
│   │   ├── state.js
│   │   ├── triggers.js
│   │   ├── turnstile-inline.js
│   │   ├── user-detail.js
│   │   └── utils/
│   │       └── country-flags.js
│   ├── runtime/
│   │   └── exports/
│   │       ├── meta.json
│   │       ├── rumble_bot_sessions.json
│   │       ├── rumble_dispatches.json
│   │       ├── runtime_snapshot.json
│   │       ├── status.json
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
│       ├── bots.html
│       ├── creator-integrations.html
│       ├── creators.html
│       ├── economy.html
│       ├── jobs.html
│       ├── notifications.html
│       ├── overview.html
│       ├── permissions.html
│       ├── progression.html
│       ├── public-identities.html
│       ├── settings.html
│       ├── triggers.html
│       ├── user-detail.html
│       └── platforms/
├── runtime/
│   ├── version.py
│   └── exports/
│       ├── changelog.json
│       ├── changelog.runtime.json
│       ├── version.json
│       └── admin/
│           └── donations/
├── scripts/
│   ├── build-pages-artifact.ps1
│   ├── generate-game-asset-manifest.mjs
│   └── validate-pages-routing.ps1
├── schemas/
│   ├── creators.schema.json
│   ├── jobs.schema.json
│   ├── permissions.schema.json
│   ├── quotas.schema.json
│   ├── services.schema.json
│   ├── triggers.schema.json
│   └── platform/
├── tests/
│   ├── admin-auth-turnstile.test.mjs
│   ├── economy-admin-controls.test.mjs
│   ├── jobs-runtime-authority.test.mjs
│   ├── live-status-diagnostics.test.mjs
│   ├── public-authority-approvals.test.mjs
│   ├── notifications-runtime-authority.test.mjs
│   ├── progression-admin-controls.test.mjs
│   ├── public-identities-admin-controls.test.mjs
│   ├── rumble-challenge-session-posture.test.mjs
│   └── triggers-runtime-authority.test.mjs
├── shared/
│   └── state/
│       ├── admin_activity.json
│       └── telemetry/
├── tmp/
│   └── [temp output]
└── index.html
```

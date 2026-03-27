# Bump Notes

## RELEASED / PACKAGED: 0.4.2-alpha

Packaged / released and no longer the active pending bucket. Preserve new notes for the open `0.4.8-alpha` section below.

## Admin Compact Widget Cleanup - 2026-03-27

### Technical Notes

- The dashboard top-bar auth widget now resolves one compact badge outcome instead of showing tier plus admin simultaneously; admin wins over tier, developer wins over Pro when admin-lite access is the relevant authorization path, and the redundant text-tier pill is hidden in the compact header control.
- Header auth styling was tightened so the account widget sits closer to the notification control envelope instead of reading taller and heavier than adjacent chrome.

### Human-Readable Notes

- The admin header account pill is slimmer and no longer shows stacked redundant badge state.
- Developer-authorized dashboard sessions now read as developer in the compact widget instead of looking like a generic tiered account.

### Files / Areas Touched

- `docs/js/admin-auth.js`
- `docs/js/admin-gate.js`
- `docs/css/base.css`
- `BUMP_NOTES.md`

## Admin Badge Priority Display Alignment - 2026-03-27

- The dashboard accounts surface now defensively suppresses creator-tier icons whenever an Admin badge is present, so account rows and detail drawers stay aligned with the authoritative runtime rule instead of showing stale redundant tier badges from older payload shapes.
- This is a consumer-only compatibility pass on the admin web surface; the actual role, creator-capability, and effective-tier authority remains in StreamSuites/Auth.

### Files / Areas Touched

- `docs/js/accounts.js`
- `BUMP_NOTES.md`

## Accounts Billing Intervention Controls - 2026-03-26

- The admin accounts drawer now consumes the runtime-authored billing intervention summary alongside the existing payment summary, so effective tier source, gifted duration, discounts, credits, write-offs, and recent intervention history render from backend truth instead of a client-owned accounting layer.
- New per-account controls now let admins gift paid tiers by days, months, years, or lifetime, apply per-user discounts or discount-code assignments, post credits or write-offs, revoke active interventions, and require a reason before each billing mutation is submitted.
- The accounts page also gained a focused billing discount-code panel for creating and revoking global discount codes against the new admin endpoints without redesigning unrelated account-management sections.

### Files / Areas Touched

- `docs/js/accounts.js`
- `docs/views/accounts.html`
- `BUMP_NOTES.md`

## Accounts Badge Governance Controls - 2026-03-26

- The admin accounts surface now consumes the runtime-owned multi-badge contract, including visible, hidden, and FindMeHere-specific badge sets, instead of only understanding the old admin-plus-tier badge shapes.
- A new system badge-governance panel now manages founder cutoff date, system-wide default badge visibility, and founder reconcile from the dashboard against the new authoritative runtime endpoints.
- The account details drawer now exposes per-user founder, moderator, and developer entitlement toggles plus per-badge visibility overrides so admins can inspect applicable versus hidden badges and persist user-level badge display rules without replacing the existing role or tier controls.

### Files / Areas Touched

- `docs/views/accounts.html`
- `docs/js/accounts.js`
- `BUMP_NOTES.md`

## Accounts Payment Summary Alignment - 2026-03-26

- The admin accounts table and account details drawer now consume the runtime-authored `payment_summary` contract instead of layering a second donation-analytics supporter calculation over the top, which fixes one-off `/donate` supporter visibility and keeps Dashboard as a contract consumer only.
- The accounts table now surfaces compact payment context with `Supporter`, `Lifetime Paid`, and `Last Payment` columns, while the details drawer adds a dedicated billing/supporter summary group with plan, recurring state, supporter source, lifetime paid, donation total, last payment amount/date, and next-renewal placeholders where the backend has no real schedule yet.
- The old placeholder “Billing Snapshot” block and stale donation override path were removed from the drawer/table flow so there is one authoritative payment/supporter story on the page instead of conflicting client-derived values.

### Files / Areas Touched

- `docs/js/accounts.js`
- `docs/views/accounts.html`
- `BUMP_NOTES.md`

## Accounts Media Detail Cleanup - 2026-03-23

- Admin account normalization and detail rendering now consume runtime-authored profile-media metadata for avatar and cover fields, so uploaded creator media shows up as sane previews plus short asset references instead of giant inline data URLs that destroyed the drawer layout.
- The account detail surface now prefers concise asset keys and backend/version context for uploaded avatar/cover assets while still rendering manual URL-based media and legacy fallback values safely.
- This keeps Dashboard as a consumer only: media storage remains runtime/Auth-owned, and the dashboard cleanup is strictly presentation-layer work against the new asset-backed payload shape.

### Files / Areas Touched

- `docs/js/accounts.js`
- `BUMP_NOTES.md`

## Cross-Repo README Architecture Alignment - 2026-03-21

- The dashboard README now includes a repo-scoped Mermaid flowchart, clearer admin-versus-runtime authority wording, aligned cross-repo references, and a normalized repo tree using consistent branch characters.
- The wording now makes the admin surface's role more explicit: privileged operator shell and privileged API consumer, but still not the runtime or Auth authority.
- This was a documentation-only pass for README and release-note alignment. No dashboard route, auth, analytics, or alerts behavior changed in this note.

### Files / Areas Touched

- `README.md`
- `BUMP_NOTES.md`

## Alerts Flag Rendering Tightening - 2026-03-20

- Alerts preview and retained-history rendering now reuse the same country-code driven flag asset path already used by Analytics, via a shared browser helper in `docs/js/utils/country-flags.js` instead of the older alert-specific emoji/token badge branch.
- `{{country_flag}}` remains stored and transported as the same logical placeholder/value, but the admin render layer now upgrades valid country context into flagcdn-backed SVG icons in preview/history surfaces and keeps compact text fallback when a flag cannot be resolved.
- The restored single-preview layout remains intact while Desktop / Browser / Plain text modes now get a restrained styling distinction through chrome, borders, and text treatment rather than a broader layout redesign.

### Files / Areas Touched

- `docs/js/utils/country-flags.js`
- `docs/js/analytics.js`
- `docs/js/analytics-alerting.js`
- `docs/css/components.css`
- `docs/index.html`
- `README.md`

## Alerts Preview Regression Fix - 2026-03-20

- Restored the Alerts editor preview back to the earlier single-surface footprint so the editor column and preview column keep the readable balance that existed before the multi-preview regression.
- Replaced the cramped three-up preview matrix with a compact Desktop / Browser / Plain text segmented toggle that swaps one live preview surface inside the same stable card area.
- Kept the existing live preview data path, placeholder rendering behavior, and backend-compatible template flow intact so switching surfaces does not change stored content or hydration behavior.

### Files / Areas Touched

- `docs/views/alerts.html`
- `docs/js/analytics-alerting.js`
- `docs/css/components.css`

## Release Prep Completion - v0.4.2-alpha

- The repo-local runtime/version mirrors used by this admin surface now report `0.4.2-alpha` in `runtime/version.py`, `runtime/exports/version.json`, and `docs/runtime/exports/version.json`.
- Release-note source material for this bump now lives in `changelog/v0.4.2-alpha.md`, using the compare range `v0.4.0-alpha...v0.4.2-alpha`.
- The existing `docs/data/changelog.dashboard.json` entry remains in place for dashboard changelog-page hydration and is not the GitHub-release markdown artifact.
- Earlier notes below remain as the cumulative milestone record, but the previous `0.4.1-alpha` versus `0.4.2-alpha` mirror mismatch for this repo has now been reconciled.

### Technical Notes

- Repo-local version markers that mirror runtime authority still show `0.4.1-alpha` in `runtime/version.py`, `runtime/exports/version.json`, and `docs/runtime/exports/version.json`.
- Recent admin work in `docs/js/analytics.js`, `docs/js/analytics-alerting.js`, `docs/js/state.js`, `docs/js/app.js`, and `docs/css/components.css` now spans dedicated Alerts/Analytics route separation, richer location formatting, hydration hardening, tokenized alert-template editing, and checkbox-based multi-surface filtering aligned to the newer runtime alert contract.
- Admin shell updates in `docs/js/app.js`, `docs/js/admin-gate.js`, and related icon assets continue the route/layout cleanup work that keeps the dedicated Alerts workspace separate from Analytics while preserving the shared dashboard shell.
- `README.md` is already staged as `v0.4.2-alpha`, so the repo currently reflects release-prep documentation ahead of the copied runtime/export version markers.

### Human-Readable Notes

- Alerts are now treated as their own admin workspace rather than feeling like a narrow Analytics subpanel, while Analytics has been restored as its own dedicated reporting page with the geo/map surface intact.
- Rule editing is easier to reason about because placeholders are visible as tokens, the variable catalog is better organized, and scope selection matches the real backend shape more closely.
- Sidebar and shell polish continued alongside runtime-regression recovery so the admin surface reflects the routing/layout cleanup already visible in the repo without losing the analytics experience.

### Files / Areas Touched

- `docs/js/analytics-alerting.js`
- `docs/js/analytics.js`
- `docs/js/state.js`
- `docs/js/admin-gate.js`
- `docs/js/app.js`
- `docs/views/alerts.html`
- `docs/css/components.css`
- `docs/js/api-usage.js`
- `docs/runtime/exports/version.json`
- `runtime/version.py`
- `README.md`

### Follow-Ups / Risks

- Keep the dashboard placeholder picker and surface labels aligned with the authoritative runtime alert-variable catalog during the actual version bump and release-note pass.
- Resolve the README `v0.4.2-alpha` prep state against the still-copied `0.4.1-alpha` runtime/export files when the real bump lands.

## Session Milestone - 2026-03-20

### Information Architecture + Regression Recovery

- Alerts was split out from the former combined "Alerts & Analytics" surface into its own dedicated sidebar-accessible admin page, with the route/layout work preserved in the current shell.
- Analytics was then explicitly restored as its own page after the overreach/regression phase, including restoration of the geographic/map-driven analytics experience instead of collapsing it into the Alerts workspace.
- The urgent Analytics runtime regression caused by the missing `labelize` helper was fixed in `docs/js/analytics.js`, and guardrails were added so a non-critical formatter failure no longer blanks the page.

### Analytics Geo + Hydration Hardening

- Analytics location display/formatting was improved to use cleaner city/region/country fallback labels consistently across tables, request details, and the map-driven view.
- Admin hydration reliability was hardened in `docs/js/state.js`, `docs/js/overview.js`, and the analytics loaders through corrected timeout forwarding, `Promise.allSettled`-style partial hydration, and reduced overlap/retry storm behavior so one failing section does not blank the whole page.
- The admin analytics UI now exposes the richer geo rollout from runtime state while remaining resilient when some sections are offline or return partial data.
- `FindMeHere Directory` / `directory` was added to the admin analytics/reporting surface so that traffic from `findmehere.live` is shown distinctly instead of being rolled into generic public traffic.

### Alerts UX + Rule Authoring

- The dedicated Alerts page layout was refined heavily: terminology was cleaned up away from confusing template wording, helper copy and previews were clarified, delivery defaults were reorganized, and the rules/editor workspace spacing was rebalanced.
- The rules browser now supports a bounded browsing surface with list/gallery-style presentation, cleaner chips, severity-tinted rule cards, clearer action-button treatments, and Windows/Pushover chip icon support where implemented.
- Editor usability improved through preview/editor balancing, placeholder helper repositioning, grouped placeholder categories, and expanded placeholder coverage including `user_code`, `client_ip`, page fields, and richer geo/account/request fields.
- Placeholder entry for title/message fields now supports tokenized inline placeholders while preserving the backend raw `{{variable}}` syntax, and the single-surface selector was replaced with backward-compatible multi-surface checkbox filtering.
- `page_path` values on admin alert/history/detail surfaces now render as clickable links when a valid canonical page URL is present.
- Placeholder catalog presentation was tightened after the expansion so the larger variable set remains scannable instead of turning into an unstructured wall of options.
- The alert editor preview now renders a live multi-surface matrix for Desktop, Browser, and Plain text so admins can compare the same placeholder-resolved content across richer and degraded presentation styles without changing stored templates or backend payload shape.

### Country Flag Placeholder Enhancements

- The Alerts admin workspace now consumes the backend-authored `{{country_flag}}` placeholder as its own additive Geo variable, keeping it visually/cosmetically separate from plain-text geo placeholders like country, country code, region, and city.
- Local Alerts previews and retained history cards now upgrade `country_flag` into a lightweight inline badge treatment on richer browser surfaces while still preserving raw stored template text and backend compatibility.
- When richer rendering is not available, the dashboard continues to degrade safely to the resolved logical value from runtime, including Unicode emoji or compact `fl-...` fallback tokens.

### Shell + Validation Notes

- Sidebar/admin shell icon mapping was updated so the current `SIDEBAR_VIEW_ICON_MAP` is the actual source of truth and swapped SVG assets refresh reliably without route or declared asset-path changes.
- Repo-visible validation for this milestone is primarily state/history-backed hotfix work rather than a new automated dashboard test suite; no dedicated dashboard test harness was added in this repo-visible slice.

## CURRENT VER= 0.4.2-alpha / PENDING VER= 0.4.8-alpha

Open bucket for future work only. Do not add new `0.4.8-alpha` prep notes into the released `0.4.2-alpha` section above.

### Technical Notes

- Reordered the admin accounts workspace so the primary `/users` landing surface opens on the accounts table first, followed by the badge-governance workspace, while keeping the existing route contract, runtime data flow, and admin action endpoints intact.
- Added a route-scoped accounts shell rail beneath the topbar with a dedicated toggle beside the sidebar control, in-page section jumps, active-section highlighting driven by the `#app-main` scroll container, and collapse-state persistence without changing the dashboard router’s `/users` ownership.
- Extended the shared client-side table manager with bounded page-size support up to 100 rows and wired the accounts toolbar to expose 5 / 10 / 20 / 50 / 100 row options while preserving search, sorting, filtering, pagination, exports, row actions, and drawer behavior.
- Reworked the badge-governance presentation into a denser founder-governance summary plus compact badge-visibility grid, and the checkbox labels now render the real badge SVG assets already shipped in the repo instead of plain text-only labels.
- Applied a shared dark-theme date-input calendar-indicator fix so native Chromium date controls inherit the intended themed treatment on accounts and other dashboard surfaces that use `type="date"`.
- Added a dedicated admin `Creator Integrations` route and inspection workspace that reads runtime/Auth-admin creator integration summaries and per-account detail rather than inventing a second dashboard-owned provider model.
- The new admin view surfaces creator-capable posture, linked-platform counts, deployable-platform counts, foundational trigger readiness, per-platform limitation reasons, and safe masked Rumble credential presence from authoritative backend payloads.
- Added a dedicated `user-detail` route at `/users/{user_code}` so exhaustive account inspection can deep-link by `user_code` instead of staying trapped inside the accounts drawer.
- Accounts and Creators now include direct drill-in actions into the creator-integrations workflow and the new per-user page so admins can move from identity/account inspection into platform-readiness troubleshooting without changing the surrounding shell or route model.
- Pending entries for `0.4.8-alpha` go here.

### Human-Readable Notes

- The accounts page now opens on the live accounts table instead of governance controls, with a cleaner layout, tighter spacing, and a sticky section rail that makes it easier to jump between accounts operations and governance work.
- Admins can change how many rows the accounts table shows at once without losing the existing filters, sorting, or actions.
- Badge Governance is substantially more compact and now shows the real badge icons next to each governed badge option, making the section feel more intentional and easier to scan.
- Native calendar icons on dashboard date fields now match the dark dashboard styling instead of rendering with the off-theme indicator color.
- Admins can now inspect whether a creator is actually ready for bot-trigger usage, which platforms are only linked versus truly deployable, and whether the foundation triggers are what is blocking readiness.
- The new per-user admin page turns `user_code` into a real support/deep-link surface, so one account can be inspected end-to-end without depending on the transient sidebar drawer state.
- Rumble remains secret-safe in the admin UI: only presence and masked-state information is shown, never the raw backend-owned credential.
- Pending entries for `0.4.8-alpha` go here.

### Files / Areas Touched

- `docs/index.html`
- `docs/js/app.js`
- `docs/views/accounts.html`
- `docs/js/accounts.js`
- `docs/js/utils/search-pagination.js`
- `docs/css/base.css`
- `docs/css/components.css`
- `docs/css/theme-dark.css`
- `BUMP_NOTES.md`
- `docs/views/creator-integrations.html`
- `docs/js/creator-integrations.js`
- `docs/js/accounts.js`
- `docs/js/creators.js`
- `docs/js/admin-routes.js`
- `docs/js/app.js`
- `docs/views/user-detail.html`
- `docs/js/user-detail.js`
- `docs/css/components.css`
- `docs/index.html`
- `README.md`
- Pending entries for `0.4.8-alpha` go here.

### Risks / Follow-Ups

- The dashboard now reflects truthful backend readiness posture, but actual provider depth is still bounded by the current runtime/Auth foundation: Twitch remains identity-only, and YouTube, Kick, and Pilled remain planned or unavailable until backend capability expands.
- No admin-side connect or override actions were added beyond trigger enabled-state toggles because the backend does not yet expose safe broader integration mutation paths for those providers.
- Pending entries for `0.4.8-alpha` go here.

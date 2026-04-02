# Bump Notes

## RELEASED / PACKAGED: 0.4.2-alpha

Packaged / released and no longer the active pending bucket. Preserve new notes for the open `0.4.8-alpha` section below.

## Admin Web Email/Password Login Alignment - 2026-03-29

### Technical Notes

- Root-caused the Admin web email/password failure to stale dashboard-only wiring: `docs/js/admin-auth.js` and `docs/js/admin-login.js` were still posting the admin modal/page form to the generic `/auth/login` route and never sent the modern `surface: "admin"` password-login payload that the authoritative runtime already expects on `POST /auth/login/password`.
- Updated the admin overlay shell (`index.html`, `docs/index.html`) and the standalone admin login page (`docs/auth/login.html`) to point their `streamsuites-auth-login` metadata at the modern password-login endpoint, then updated both submit handlers to post `{ email, password, surface: "admin" }` against that route while leaving all OAuth provider endpoints unchanged.
- Removed the stale “emergency fallback” wording from the admin web email/password affordances so the dashboard now describes the same StreamSuites email/password flow already used by the other working surfaces.
- Aligned the root and `docs/` admin fallback shells (`404.html`, `docs/404.html`) to the same password-login endpoint metadata so the published artifact cannot fall back to the obsolete admin-web-only route assumption from any entry surface.
- No files were created or removed. The touched files stayed roughly the same size because this was a narrow route-contract correction plus small copy cleanup, not a modal redesign.

### Human-Readable Notes

- Admins can now use the web dashboard’s email/password sign-in against the same modern login route already working elsewhere instead of hitting an older dead-end admin path.
- Google, GitHub, and the other OAuth buttons were left alone.
- This change keeps the dashboard as a consumer of StreamSuites auth truth instead of preserving an outdated admin-only login assumption.

### Files / Areas Touched

- `docs/js/admin-auth.js`
- `docs/js/admin-login.js`
- `index.html`
- `docs/index.html`
- `docs/auth/login.html`
- `404.html`
- `docs/404.html`
- `BUMP_NOTES.md`

## Analytics Table Pagination + 250 Entry Expansion - 2026-03-29

### Technical Notes

- Scoped the admin Analytics page changes to the three requested sections only in `docs/views/analytics.html` and `docs/js/analytics.js`: `Geographic Breakdown`, `Top Routes / Resources`, and `Recent Request Activity`.
- Added page-size controls using the existing alerts pagination/control family already defined in `docs/css/components.css`, exposing `5 / 10 / 25 / 50` row options without introducing a new control style or redesigning the analytics layout.
- Added analytics-local retained-set pagination in `docs/js/analytics.js` with a bounded display cap of `250` rows per target table and a per-table current-page/page-size state model. `Geographic Breakdown` now paginates its filtered/sorted retained set while preserving the existing location search, existing sortable headers, map-focus row behavior, and current descending-by-sessions default semantics.
- Replaced the old direct full-body table dumps for `Top Routes / Resources` and `Recent Request Activity` with retained-set pagination renderers that page through up to `250` authoritative rows from the runtime payload while preserving existing API ordering semantics. No unrelated analytics cards, charts, filters, or other table surfaces were widened.
- Nothing was removed from repo structure and no files were deleted. The analytics files grew slightly because the previous no-pagination inline table rendering path was replaced with retained-set pagination helpers and control wiring.

### Human-Readable Notes

- The three analytics tables now behave like browsable datasets instead of single dumps, with row-size choices and page navigation that match the dashboard’s existing control language.
- Geographic rows can now be filtered, sorted, and paged through up to `250` retained entries without losing the current map focus interaction.
- Route and recent-request tables now expose the deeper runtime history instead of stopping at the much shallower earlier payloads.

### Files / Areas Touched

- `docs/views/analytics.html`
- `docs/js/analytics.js`
- `BUMP_NOTES.md`

## Admin Developer Tier Polish + Alerts Shell Tabs - 2026-03-29

### Technical Notes

- Extended the shared admin tier-chip styling in `docs/css/components.css` with a `DEVELOPER` variant so existing tier badge surfaces rendered by `docs/js/accounts.js` and `docs/js/user-detail.js` now display the internal developer tier in the same chip family as Core, Gold, and Pro instead of falling back to the generic badge treatment.
- Updated `docs/assets/js/ss-profile-hovercard.js` so hovercard tier normalization and icon lookup now accept the backend-owned `developer` tier and use `/assets/icons/dev-green.svg`, keeping badge/icon support aligned across account rows, detail views, and hover surfaces.
- Polished the creator integrations Platform Breakdown in `docs/js/creator-integrations.js` and `docs/css/components.css` by prefixing platform card titles with their platform icons and changing the gold multiline reason chips to rounded rectangles that wrap cleanly without oversized pill geometry.
- Generalized the existing Accounts top-bar jump-tab rail in `docs/js/app.js` into a view-configured shell that now powers the Alerts page as well, then added alert section anchors in `docs/views/alerts.html` and switched the recent-activity default layout in `docs/js/analytics-alerting.js` from list to gallery. This stayed additive and did not change routing or replace the established shell pattern.

### Human-Readable Notes

- Developer-tier accounts now render as a deliberate internal tier across the admin chip surfaces instead of looking like an unstyled fallback.
- The creator integrations side breakdown is easier to scan because each platform card now starts with its icon and long gold detail tags wrap like compact cards instead of stretched pills.
- Alerts now opens on the gallery-style recent activity view and gets the same top jump-tab behavior already used successfully on Accounts.

### Files / Areas Touched

- `docs/css/components.css`
- `docs/assets/js/ss-profile-hovercard.js`
- `docs/js/creator-integrations.js`
- `docs/views/alerts.html`
- `docs/js/analytics-alerting.js`
- `docs/js/app.js`
- `BUMP_NOTES.md`

## Admin Cloudflare Pages Shell Route Manifest Parity - 2026-03-28

### Technical Notes

- Compared the live admin deep-link failures against the current router and confirmed the production symptom is consistent with the deployment behaving like a static shell without the Pages Function rescue path. The root shell and root assets are live, but nested admin shell URLs are still returning raw `404` responses before hydration.
- Hardened every admin rewrite manifest around the actual current admin shell routes rather than relying primarily on the broader `/profiles/*` and `/integrations/*` families. Exact rewrites now explicitly cover the known nested shell entrypoints already defined by `docs/js/admin-routes.js`, including `/profiles/integrations`, `/profiles/stats`, `/integrations/triggers`, and each current `/integrations/{provider}` surface.
- Expanded `functions/[[path]].js` to mirror those exact nested routes as well, so the Pages Function path and the static `_redirects` manifests now declare the same current admin shell surface instead of depending on prefix-only inference.
- Nothing was removed in this pass. The branded admin `404.html` documents remain intact for true misses, and no asset rewrites were broadened into a catch-all that could turn missing JS/CSS/image requests into HTML.

### Human-Readable Notes

- Valid nested admin dashboard URLs now have explicit static rewrites to the shell instead of depending on the fallback function to infer them.
- The admin 404 page is still preserved for real unknown paths.

### Files / Areas Touched

- `_redirects`
- `docs/_redirects`
- `functions/[[path]].js`
- `scripts/build-pages-artifact.ps1`
- `BUMP_NOTES.md`

## Admin Cloudflare Pages Deep-Link Fallback Cleanup - 2026-03-28

### Technical Notes

- The admin repo already had `_redirects` coverage and a catch-all Pages Function, but valid deep-link recovery was still duplicated inside both `404.html` entry documents. Those 404 rescue scripts tried to relay recognized admin routes back into the shell after the server had already failed them, which kept the 404 surface in the deep-link path and was a credible source of redirect/fail-loop behavior.
- Both admin 404 documents were intentionally shortened by removing that route-bounce logic. They now stay branded real-404 documents only, while valid admin shell routes are expected to resolve before 404 through `_redirects` or `functions/[[path]].js`.
- `functions/[[path]].js` was tightened to fetch only the repo-root `/index.html` shell instead of trying `/docs/index.html` as a secondary fallback, removing another legacy dual-root branch from the Cloudflare Pages path. The exact-route list and all generated `_redirects` manifests now also include the existing `/creator-integrations` alias so that route family keeps its current semantics on direct navigation and refresh.

### Human-Readable Notes

- Valid admin deep links now have one recovery path instead of a stack of fallback tricks fighting each other.
- The admin 404 page still exists for real bad URLs, but it no longer tries to masquerade as a router.

### Files / Areas Touched

- `_redirects`
- `docs/_redirects`
- `functions/[[path]].js`
- `404.html`
- `docs/404.html`
- `scripts/build-pages-artifact.ps1`
- `README.md`
- `BUMP_NOTES.md`

## Admin Badge Matrix Consumer Cleanup - 2026-03-28

### Technical Notes

- Removed the stale local admin-over-tier and developer-over-Pro suppression filter from `docs/js/accounts.js` when normalizing backend badge arrays for the Accounts surface.
- That filter had become a duplicate of older display assumptions and could hide runtime-authoritative badge combinations, especially developer plus Pro, after the matrix system started returning the final effective badge set directly.
- The file became shorter because the old `hasAdminBadge` / `hasDeveloperBadge` filter branch was deleted instead of being reworked into another client-side override.

### Human-Readable Notes

- Admin account rows and drawers now trust the runtime badge payload instead of second-guessing it.
- Compact header-style badge compression still exists in the dedicated top-bar auth widgets where space is intentionally limited.

### Files / Areas Touched

- `docs/js/accounts.js`
- `BUMP_NOTES.md`

## Badge Governance UI Matrix Polish - 2026-03-28

### Technical Notes

- `docs/js/accounts.js` now filters redundant badge-governance surfaces (`creator_surface`, `admin_surface`, `public_surface`, and `directory`) out of the live surface catalog before rendering either the system matrix or the Accounts sidebar per-user matrix, while preserving the existing edit/save payload shape for remaining surfaces.
- The Dashboard badge-governance visibility glyphs no longer render as raw SVG `<img>` tags; both `docs/js/accounts.js` and `docs/js/user-detail.js` now emit mask-based state spans, and `docs/css/components.css` applies `currentColor`/background masking so `visiblefilled.svg` renders green while `hidden.svg` follows the neutral dashboard icon/text tone.
- The Accounts sidebar and full `/users/{user_code}` badge-governance surfaces now use denser summary-plus-matrix card layouts, restore badge icons on the full user page row labels/summary strip, and tighten table spacing without removing existing entitlement or per-cell override controls.

### Human-Readable Notes

- Badge governance is easier to scan in both Admin contexts because the redundant surface columns are gone, the status icons finally read as green versus neutral instead of black, and the tables use the space more deliberately.
- The full user details page now shows the real badge icons again and reads like a compact admin matrix instead of a loose placeholder block.

### Files / Areas Touched

- `docs/js/accounts.js`
- `docs/js/user-detail.js`
- `docs/css/components.css`
- `BUMP_NOTES.md`

## Admin Blue Accent Refinement + Full-Height Sidebar Spine + Title Sweep - 2026-03-28

### Technical Notes

- Shared dashboard shell accent tokens in `docs/css/theme-dark.css` were retuned from the recent purple family to a cooler blue family, including `--accent-shell`, `--accent-shell-strong`, `--accent-shell-soft`, `--accent-shell-glow`, `--link-color`, and `--link-accent`, plus shared RGB helper tokens used by shell chrome effects.
- Shared shell accent surfaces that still carried hard-coded purple values now derive from the blue accent family instead, covering visited regular-text links, sidebar hover/active states, the active nav glow/spine treatment, the overflow toggle active state, topbar icon hover/focus/loading states, and the global loader track/bar fallbacks in `docs/css/base.css`.
- The sidebar active-item spine no longer uses inset top/bottom offsets; shared nav-item overflow clipping plus a full-height pseudo-element now let the gradient spine span the complete selected item height cleanly inside the rounded item container.
- Shared title-pruning logic in `docs/js/app.js` now removes legacy in-view `h1` title rows consistently and continues into the first panel header so redundant route titles are removed even when the page still had a second visible panel heading such as `Audit Logs`, `Accounts`, `Inbox`, or `User detail`.
- Route-title metadata in `docs/js/admin-routes.js` was tightened where the shell title still used older wording, including `/audit` now resolving to `Audit Logs` and `/scoreboard-management` now resolving to `Manage Scores`, so the topbar remains the canonical current-view title source.

### Human-Readable Notes

- The dashboard chrome now uses a cooler blue accent instead of the newer purple, which fits the existing admin theme more naturally.
- Selected sidebar items keep the refined glow/spine treatment, but the left accent spine now runs the full height of the active item instead of looking clipped.
- Remaining duplicate page-title rows are now stripped through the shared shell flow, so the topbar owns the page title while useful copy, chips, and actions stay in place below it.

### Files / Areas Touched

- `docs/css/theme-dark.css`
- `docs/css/base.css`
- `docs/js/app.js`
- `docs/js/admin-routes.js`
- `BUMP_NOTES.md`

## Accounts Founder Governance Live-State Clarification - 2026-03-28

### Technical Notes

- The Accounts badge-governance panel now consumes the richer runtime founder-policy payload instead of treating the cutoff like a bare manual input, so the hydrated panel can show live stored cutoff state plus automatic-assignment status directly from StreamSuites.
- Founder-governance copy in `docs/views/accounts.html` and `docs/js/accounts.js` now separates the automatic new-account rule from the manual reconcile action, preserving the existing endpoint/actions while repositioning reconcile as an explicit backfill/correction tool for existing accounts.

### Human-Readable Notes

- The founder cutoff field now reads like a real saved system setting instead of a temporary date you only use during reconcile.
- The dashboard now makes it clear that new accounts already use the stored cutoff automatically, and that reconcile is for older eligible accounts that still need backfill.

### Files / Areas Touched

- `docs/js/accounts.js`
- `docs/views/accounts.html`
- `BUMP_NOTES.md`

## Admin Publish-Root Canonicalization + Docs Bootstrap De-Ambiguation - 2026-03-28

### Technical Notes

- The actual divergence from the working Creator/Public surfaces was no longer just client routing: this repo still shipped two publish models at once. The dashboard source tree kept a root-style Cloudflare Pages shell plus a raw `docs/` publish tree, while the only checked-in deploy workflow still uploaded `docs/` directly. That meant fallback placement, `index.html`, and asset-root assumptions could drift between deployments even when route code looked correct.
- A new repo-local deployment builder at `scripts/build-pages-artifact.ps1` now produces a canonical root-style publish artifact in `dist/`. It flattens the `docs/` asset/content tree to the publish root, overlays the repo-root `index.html` and `404.html`, and writes a root-native `_redirects` manifest that serves known admin routes straight to `/index.html` without the old `/docs/...` compatibility hop.
- `.github/workflows/pages.yml` now uploads `dist` instead of raw `docs`, so the published shell, fallback files, and asset directories finally live in the same artifact root. This mirrors the simpler working publish model already used by Creator/Public instead of relying on source-tree duplication.
- The admin entry documents that still exist in both source locations (`index.html`, `404.html`, `docs/index.html`, `docs/404.html`, `docs/auth/login.html`, `docs/auth/success.html`) no longer hard-code incompatible base-path assumptions. `ADMIN_BASE_PATH` is now resolved from the live pathname, so the same bootstrap logic survives root-hosted and `/docs`-hosted entry without forcing the wrong basename before routing/auth code normalizes.

### Human-Readable Notes

- The dashboard no longer depends on publishing the raw `docs/` folder exactly right for valid deep links to survive refreshes.
- Deployments now have one canonical root entry shape, which is the same general model the working Creator/Public surfaces already use.
- The lingering `/docs` bootstrap ambiguity was removed, so valid admin routes do not start from a mismatched base-path assumption when the host serves a root shell.

### Files / Areas Touched

- `.github/workflows/pages.yml`
- `scripts/build-pages-artifact.ps1`
- `index.html`
- `404.html`
- `docs/index.html`
- `docs/404.html`
- `docs/auth/login.html`
- `docs/auth/success.html`
- `README.md`
- `BUMP_NOTES.md`

## Admin Hydration Reliability + Topbar Refresh/Title + Purple Chrome Pass - 2026-03-28

### Technical Notes

- The shared admin route table in `docs/js/admin-routes.js` now carries canonical per-view titles, allowing the shell to source the topbar title from shared route metadata instead of the old hardcoded `Admin Control` label.
- The admin shell bootstrap in `docs/js/app.js` was hardened around first-load hydration by adding active view request tracking, stale-load suppression, abortable view fetches, bounded retry handling for retryable partial-load failures, and a shared topbar refresh action that re-runs the current view’s local hydration pipeline without reloading the browser tab.
- The old shell-wide `1500ms` fetch defaults were too aggressive for first-hit admin hydration. Shared timeout defaults were raised to bounded `6000ms` values in both `docs/js/app.js` and `docs/js/state.js`, and the state loader no longer stops at the first timeout or `404`; it now continues through the configured fallback roots before deciding a payload is unavailable.
- Shared loader timing was tightened in `docs/js/utils/global-loader.js`, while several high-traffic view init paths (`overview`, `analytics`, `alerts`, `api-usage`) now return their initial hydration promises so the loading bar can stay aligned with actual route/view hydration instead of dropping early.
- The shell now performs a shared title-cleanup pass after partial injection so duplicated top-of-view title rows are stripped when their content is already represented in the topbar, while supporting descriptive copy and status chips remain in place.
- Shared dark-theme chrome tokens in `docs/css/theme-dark.css` and `docs/css/base.css` now use the intended purple accent family for sidebar active states, topbar chrome, and the global loader. Regular text-link visited state is now `#a46cff`, and button-styled anchors are explicitly excluded from visited-link color inheritance.

### Human-Readable Notes

- Admin pages are less likely to stall on first load just because a state export or partial fetch took slightly longer than the old timeout budget.
- The top loading bar now tracks route/view hydration more honestly, and the new topbar refresh button retries only the page you are on instead of forcing a full tab refresh.
- The topbar now shows the current admin page title, and duplicated page-title rows at the top of many views have been removed while keeping the useful descriptive copy below them.
- The old orange/gold chrome accent behavior has been replaced in the shared admin shell with the purple accent direction, including the refined active sidebar treatment and visited-link color update.

### Files / Areas Touched

- `docs/js/admin-routes.js`
- `docs/js/app.js`
- `docs/js/state.js`
- `docs/js/utils/global-loader.js`
- `docs/js/overview.js`
- `docs/js/analytics.js`
- `docs/js/api-usage.js`
- `docs/js/analytics-alerting.js`
- `docs/js/alerts.js`
- `docs/js/user-detail.js`
- `docs/css/theme-dark.css`
- `docs/css/base.css`
- `docs/css/components.css`
- `docs/index.html`
- `index.html`
- `BUMP_NOTES.md`

## Admin Checkbox + Toggle Control Standardization - 2026-03-28

### Technical Notes

- The shared glowing checkbox primitive in `docs/css/components.css` now defines the intended smaller baseline directly, reducing the old `/design` reference geometry from `24px` to a `12px` visual box while preserving the same glow, checkmark animation, dark-surface contrast, and disabled-state logic.
- Keyboard treatment was tightened in the shared control layer by adding explicit focus-visible rings for both the glowing checkbox primitive and the existing shared `switch-button` Admin12121 toggle path, so admin checkboxes and switches now land on one consistent accessibility contract instead of a mix of native/browser-default states.
- Remaining admin checkbox drift was removed from the Accounts, Alerts, Notifications, Discord installs, and badge-governance render paths by migrating those raw/native checkbox rows onto the shared `.ss-checkbox-wrapper` markup used elsewhere in the dashboard, while existing switch surfaces kept the established `switch-button` component path.
- The `/design` supersheet checkbox reference copy was updated to describe the new smaller reference size, and the toggle reference wording was tightened so the design page accurately reflects the intended shared switch path without expanding this pass into unrelated control families.

### Human-Readable Notes

- Admin checkboxes now match each other again instead of mixing the glowing shared control with plain browser checkboxes in a few pages and drawers.
- The intended checkbox look is noticeably smaller than before, but it keeps the same glow treatment and still reads cleanly against the dark dashboard theme.
- Admin toggle switches continue using the same Admin12121 switch style, but focus and disabled handling are now more consistent across the places that already used it.

### Files / Areas Touched

- `docs/css/components.css`
- `docs/css/base.css`
- `docs/views/design.html`
- `docs/views/accounts.html`
- `docs/views/alerts.html`
- `docs/views/notifications.html`
- `docs/views/platforms/discord.html`
- `docs/js/accounts.js`
- `docs/js/analytics-alerting.js`
- `docs/js/notifications.js`
- `docs/js/user-detail.js`
- `BUMP_NOTES.md`

## Admin Direct-Load Routing Parity Realignment - 2026-03-28

### Technical Notes

- The direct-load failure was traced to the repo-root Cloudflare Pages rewrite model, not the client route components: wildcard admin deep-link rules such as `/users/*`, `/profiles/*`, `/integrations/*`, plus the broad root catch-all, were still rewriting into `/docs/index.html`, which Cloudflare/Wrangler classifies as loop-prone and ignores. That left nested admin routes to fall through to `404.html` unless the Pages Function rescue path happened to recover them.
- The dashboard has been realigned to the same single-root SPA routing pattern used by the working Creator/Public surfaces. Repo-root `_redirects` now resolves known admin routes directly to `/index.html`, the repo root now carries the real admin shell (`index.html`) and recovery document (`404.html`), and `functions/[[path]].js` now prefers the root shell before the legacy `docs/` shell.
- The docs-root compatibility manifest was tightened to explicit known-route rewrites only by removing the broad `/* -> /index.html` catch-all, so invalid paths can still produce a real 404 while valid admin route families continue to hydrate through the SPA shell.

### Human-Readable Notes

- Refreshing or pasting real admin deep links no longer depends on the broken `/docs/index.html` compatibility hop that was causing nested routes to miss the SPA and land on the 404 page first.
- The admin dashboard now follows the same root-routing model as the working Creator/Public dashboards while still keeping the existing `docs/` asset/export layout behind the scenes.
- Invalid routes can still fail as 404s, but valid admin routes now have a proper root-shell entry path instead of collapsing into the wrong error surface.

### Files / Areas Touched

- `index.html`
- `404.html`
- `_redirects`
- `docs/_redirects`
- `functions/[[path]].js`
- `README.md`
- `BUMP_NOTES.md`

## Admin Shared Button Contrast + Icon Glyph Rendering - 2026-03-28

### Technical Notes

- The shared `.ss-btn-primary` hover/focus/active layer in `docs/css/components.css` now explicitly overrides the generic `.ss-btn:hover` dark-theme background swap, so primary CTAs keep a readable accent-colored label instead of inheriting near-black text against the darker hover treatment.
- A reusable theme-aware icon glyph pattern was added to the shared button stylesheet using CSS mask rendering plus `currentColor` (`.ss-btn-icon-only` and `.ss-btn-icon-glyph`), allowing icon-only controls to inherit button-state color correctly without depending on hardcoded-fill SVGs loaded through `<img>`.
- The Accounts table row actions were migrated onto that shared icon glyph path, preserving the compact one-row layout while fixing default, hover, focus-visible, active, and disabled icon color behavior through the button’s existing state color system.

### Human-Readable Notes

- Primary green dashboard buttons no longer flip to unreadable dark text when hovered; they now stay clearly legible and aligned with the admin theme.
- The Accounts table icon-only action buttons now render their icons in the intended themed color instead of looking stuck black.

### Files / Areas Touched

- `docs/css/components.css`
- `docs/js/accounts.js`
- `BUMP_NOTES.md`

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

## Admin Deep-Link Recovery + User Detail Reflow - 2026-03-28

### Technical Notes

- Cloudflare Pages SPA fallback handling was tightened in both publish-root variants: `docs/_redirects` now explicitly rewrites `/users/*` and `/profiles/*` into the admin shell, while the repo-root `_redirects` mirrors the same dynamic-route coverage for root-published compatibility deployments.
- Root compatibility forwarding in `index.html` now preserves the original search string and hash while relaying into `/docs/index.html`, which keeps encoded deep-link state intact instead of dropping `__ss_route` during fallback recovery.
- `docs/404.html` now immediately relays recognized admin routes back into the real SPA entry point rather than pausing on the 404 surface, so direct-entry recovery remains aligned with the route manifest instead of feeling like a broken stopover.
- The `/users/{user_code}` surface was restructured away from repeated forced two-column rows. The profile lead is now full width, identity/auth/creator posture are grouped in a compact responsive context cluster, and the heavy billing, lifecycle, badge-governance, reset, integrations, and trigger sections now own full-width lanes.
- Billing history, billing intervention forms, badge-governance controls, and the lifecycle-action shell were tightened with denser auto-fit sub-grids and grouped action/callout composition so the page reduces blank vertical dead zones without removing any control paths.

### Human-Readable Notes

- Refreshing or pasting routes like `/users/{user_code}` now has a real recovery path in both normal Pages rewrites and the repo-root compatibility path, instead of falling apart when a fallback route has to hand control back to the SPA.
- The user page no longer wastes tall empty columns beside profile, billing, or governance areas. The heavy admin sections breathe, but they now read as intentional full-width control surfaces instead of mismatched card pairs.
- Identity, auth, and creator posture still stay near the top of the page, but they now sit in a tighter responsive cluster while the billing and intervention tooling remains the authoritative full user-management workspace.

### Files / Areas Touched

- `_redirects`
- `index.html`
- `docs/_redirects`
- `docs/404.html`
- `docs/views/user-detail.html`
- `docs/js/user-detail.js`
- `docs/css/components.css`
- `BUMP_NOTES.md`

## Admin Pages Fallback Hardening + Accounts Action Strip Compaction - 2026-03-28

### Technical Notes

- Cloudflare Pages fallback is now enforced at the runtime edge as well as in static manifests: `functions/[[path]].js` lets Pages serve the real admin SPA shell with HTTP `200` for known dashboard client routes whenever the asset layer would otherwise return `404`, covering direct-load, refresh, and pasted-tab entry for `/users/{user_code}` and sibling admin routes without hijacking assets or non-dashboard paths.
- The existing dashboard 404 recovery page now relays recognized admin routes back through `/` instead of hard-coding `/index.html` or `/docs/index.html`, which removes the publish-root mismatch that was still leaking 404 behavior between the repo-root and `docs/` hosting variants.
- The Accounts table actions cell was rebuilt into a strict single-line strip: the redundant text `Quick view` button was removed, the primary full-page CTA is now the only text label (`Details`), integrations and stats were converted to icon-only SVG buttons with `title` plus `aria-label`, and the sticky actions column now uses fixed sizing plus no-wrap flex rules so rows stay compact instead of stacking controls.

### Human-Readable Notes

- Opening an admin deep link like `/users/YR992ZS` now has a real Cloudflare Pages fallback path instead of depending on a 404 page to rescue the route after the server already failed it.
- The Accounts table no longer burns row height on stacked action buttons. Each row now keeps a compact one-line control strip with a clear `Details` button and smaller integrations/stats icons beside it.
- Clicking a row still opens the quick sidebar, but the actions cell is cleaner and the full user page remains the obvious primary action.

### Files / Areas Touched

- `functions/[[path]].js`
- `docs/404.html`
- `docs/js/accounts.js`
- `docs/css/components.css`
- `README.md`
- `BUMP_NOTES.md`

## Admin Login Provisioning Copy Cleanup - 2026-03-28

### Technical Notes

- Removed the self-serve `Need an account? Sign up` footer row from the standalone admin login page so the admin auth surface no longer advertises a creator/public-style signup path that does not exist for dashboard administrators.

### Human-Readable Notes

- The admin login modal/page now reflects the real admin access model: admin accounts are provisioned manually or from trusted env-backed auth rules, not through a bottom-of-modal signup link.

### Files / Areas Touched

- `docs/auth/login.html`
- `BUMP_NOTES.md`

## CURRENT VER= 0.4.2-alpha / PENDING VER= 0.4.8-alpha

Open bucket for future work only. Do not add new `0.4.8-alpha` prep notes into the released `0.4.2-alpha` section above.

### Badge Governance Header Abbreviation Tweak - 2026-04-02

### Technical Notes

- Narrowed the change to the badge-governance surface label normalizers in `docs/js/accounts.js` and `docs/js/user-detail.js` only.
- The governance tables already had short fallback labels, but live runtime `surface_catalog` data could still inject the longer `StreamSuites Profile` and `FindMeHere Profile` header text. Both renderers now force those two known surface keys to display as `SS Profile` and `FMH Profile` while leaving every other surface key/label untouched.
- No files were created or removed, and nothing was deleted from the table structure or backend payload handling. This was a display-label override only.

### Human-Readable Notes

- The badge governance tables on both the main Accounts page and individual user pages now use shorter profile column names so the matrix columns fit more evenly.
- Only the two requested headers changed; the rest of the badge governance UI behaves the same.

### Files / Areas Touched

- `docs/js/accounts.js`
- `docs/js/user-detail.js`
- `BUMP_NOTES.md`

### Admin Topbar User Widget Narrow Polish - 2026-03-30

### Technical Notes

- Scoped the change to the admin dashboard top-right user widget only in `docs/css/base.css`, `docs/index.html`, `index.html`, and the existing menu wiring in `docs/js/app.js`; no surrounding topbar controls or notification UI were changed.
- Fixed avatar masking by making `.streamsuites-auth-avatar` the actual clipping boundary with `overflow: hidden` plus `border-radius: 50%`, while real account avatars (`img.is-avatar`) now fill the existing `24px` circle with `width: 100%`, `height: 100%`, `display: block`, and `object-fit: cover`. The fallback profile icon stays at its smaller non-avatar sizing so the widget height and apparent avatar footprint remain stable.
- Nudged the username line from `11px` to `12px` and set it to `font-weight: 600`, then reduced the email line from `11px` to `10px` with `font-weight: 350`; both lines now explicitly keep single-line truncation/ellipsis behavior and tight `line-height` so the pill height does not grow.
- Removed the dedicated caret button/chevron markup from both shell entry files and moved the menu trigger semantics onto the existing `.streamsuites-auth-toggle` pill. Internal spacing was rebalanced by replacing the old caret footprint with a small extra trailing inset (`padding-right: 10px` instead of `8px`) rather than widening the component in a redesign-like way.
- No files were created or removed. The touched files are expected to be slightly shorter overall because the caret button markup and now-unused caret CSS were removed.

### Human-Readable Notes

- The admin user avatar now stays cleanly inside its round mask instead of letting square image edges bleed outside the circle.
- The username is a touch larger and stronger, while the email line is slightly smaller and lighter so the hierarchy reads more cleanly without changing the widget’s overall size.
- The dropdown arrow is gone, but the same pill still opens the menu and keeps the existing hover affordance.

### Files / Areas Touched

- `docs/css/base.css`
- `docs/index.html`
- `index.html`
- `docs/js/app.js`
- `BUMP_NOTES.md`

### Admin Alerts Page Preview + Collection Controls Upgrade - 2026-03-28

### Technical Notes

- The Admin Dashboard alerts page now keeps the existing page structure but fixes the preview-panel sizing at the component/CSS level so the live preview surface, preview card, and helper note stack in separate rows without the previous bottom collision/clipping behavior.
- Preview-surface toggle labels were softened from the previous heavier weight while preserving the same selected-state affordance, and the top preview severity chip now adopts severity-specific styling that matches the existing info/warning/error/critical alert palette already used by rules/history cards.
- Alert-rules browsing now defaults to gallery instead of list and adds page-size options `5`, `10`, `20`, and `50`.
- Recent alert activity keeps list as the default view, but now adds the same list/gallery control family plus page-size options `5`, `10`, `25`, `50`, and `100`.
- The rules and history sections now share the same additive dashboard control pattern for layout toggles plus page-size selectors, without broad repo-wide component refactors or route changes.
- Dashboard-side history loading was raised from the old `50`-entry request cap to `250`, but the dashboard still treats runtime/Auth API history as the source of truth rather than inventing local-only persistence.

### Human-Readable Notes

- The preview area no longer crashes into its helper text when switching between desktop, browser, and plain-text previews.
- Alert rules open in gallery by default now, and both rules/history sections use the same compact controls for layout and page size.
- Recent alert activity can now show a lot more retained backend history at once while still defaulting to the familiar list view.

### Files / Areas Touched

- `docs/views/alerts.html`
- `docs/js/analytics-alerting.js`
- `docs/css/components.css`
- `BUMP_NOTES.md`

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
- The accounts toolbar layout is now denser and more intentional: search, filters, page-size, and ID toggle were regrouped for one-line desktop fit where possible, while the runtime-status label moved into its own lighter runtime strip so the control row no longer wastes horizontal space.
- Accounts table UUID and user-code cells now explicitly use the dashboard-local SUSE Mono variable font already shipped in `docs/assets/fonts/mono/SUSEMono-Variable.ttf`, without changing typography for non-system table fields.
- The accounts actions column now promotes the per-user page as the primary row CTA, keeps quick-view as the secondary drawer entry point, and retains integrations and stats access in a slimmer action cluster rather than a row of equally weighted buttons.
- The full `/users/{user_code}` surface was rewritten from a lightweight inspector into the complete per-user admin control surface, with a richer hero/header treatment, authoritative management blocks, billing interventions, badge governance, creator-trigger toggles, and profile-reset controls while the drawer remains the abbreviated quick-view variant.
- Dashboard routing was hardened in two layers: client-side route canonicalization now preserves dynamic `user_code` params when converting legacy hash links, and Cloudflare Pages-compatible `_redirects` catch-all fallbacks now serve the SPA entry for direct-load and refresh handling across dynamic admin routes.
- Pending entries for `0.4.8-alpha` go here.

### Human-Readable Notes

- The accounts page now opens on the live accounts table instead of governance controls, with a cleaner layout, tighter spacing, and a sticky section rail that makes it easier to jump between accounts operations and governance work.
- Admins can change how many rows the accounts table shows at once without losing the existing filters, sorting, or actions.
- Badge Governance is substantially more compact and now shows the real badge icons next to each governed badge option, making the section feel more intentional and easier to scan.
- Native calendar icons on dashboard date fields now match the dark dashboard styling instead of rendering with the off-theme indicator color.
- Admins can now inspect whether a creator is actually ready for bot-trigger usage, which platforms are only linked versus truly deployable, and whether the foundation triggers are what is blocking readiness.
- The new per-user admin page turns `user_code` into a real support/deep-link surface, so one account can be inspected end-to-end without depending on the transient sidebar drawer state.
- The accounts toolbar feels less crowded, the runtime label is no longer jammed into the filter row, and UUID / user-code values now read like system identifiers instead of ordinary copy.
- Opening a user from the table, drawer, or creator-integrations area now consistently emphasizes the full user page as the main management surface, with the drawer clearly acting as the faster abbreviated view.
- Refreshing or opening admin deep links like `/users/{user_code}` in a fresh tab now resolves back into the dashboard app instead of falling through to a 404 on Cloudflare Pages-style hosting.

### Files / Areas Touched

- `docs/views/accounts.html`
- `docs/views/creator-integrations.html`
- `docs/views/user-detail.html`
- `docs/js/accounts.js`
- `docs/js/creator-integrations.js`
- `docs/js/user-detail.js`
- `docs/js/admin-routes.js`
- `docs/css/components.css`
- `_redirects`
- `docs/_redirects`
- `BUMP_NOTES.md`
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

## Task 3P - Developer Tier + Badge Surface Matrix - 2026-03-28

### Technical Notes

- The Dashboard accounts workflow now accepts the authoritative `Developer` tier in admin assignment controls.
- The main Badge Governance view now renders the backend-owned badge-vs-surface matrix, stays read-only by default, and only exposes editable checkbox cells in explicit edit mode.
- The Accounts sidebar and user-detail badge governance panels now render compact surface matrices instead of flat vertical visibility pills.

### Human-Readable Notes

- Admins can now assign Developer as a hidden internal tier without leaking it into public tier flows.
- Badge governance in Dashboard now answers “which badge shows on which surface” at a glance.

### Files / Areas Touched

- `docs/js/accounts.js`
- `docs/js/user-detail.js`

### Risks / Follow-Ups

- The matrix views depend on the new backend surface payload shape; stale backend deployments will degrade into fetch/save failures rather than falling back to fake client logic.

## Task 3W - Restart Banner Truthfulness - 2026-03-28

### Technical Notes

- The admin shell runtime snapshot poller now checks the published `docs/shared/state` mirror when the repo-root shell is running from a source checkout, instead of falling straight from a missing root `shared/state` file to the bundled demo snapshot.
- Shared state-root resolution in `docs/js/state.js` now includes the local `docs/shared/state/` mirror for repo-root sessions, keeping shell/runtime hydration aligned with the real published export location.
- This prevents the global restart banner from inheriting stale demo `restart_intent` data when the source checkout has fresh mirrored runtime state available.

### Human-Readable Notes

- Running the admin dashboard from the repo root now uses the real mirrored runtime state before any sample fallback, so the restart banner no longer gets stuck on because of demo snapshot data.

### Files / Areas Touched

- `docs/js/app.js`
- `docs/js/state.js`
- `BUMP_NOTES.md`

### Risks / Follow-Ups

- Already-generated `docs/shared/state/runtime_snapshot.json` files still need a fresh runtime republish to reflect the corrected runtime-side restart contract.

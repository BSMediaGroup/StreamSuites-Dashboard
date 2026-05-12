# Bump Notes

## CURRENT VER= 0.4.2-alpha / PENDING VER= 0.4.3-alpha

- Added a runtime-backed public handle editor to the Accounts detail drawer. Admins can see the current `@handle`, submit a normalized handle to `PATCH /api/admin/accounts/{account_id}/public-profile-slug`, see saving/success/error states, and the drawer updates only after the Runtime/Auth response returns the refreshed account payload. Duplicate, reserved, empty, deleted-account, and missing-account errors are mapped to clear operator copy. The Accounts detail drawer layout was tightened with a wider responsive clamp, sticky header, full-height scroll safety, wrap-safe long values/URLs/IDs, and a contained handle editor without redesigning the Accounts table or adding Dashboard-owned slug state. Focused source coverage pins the endpoint wiring and error handling. No files or assets were created, removed, or renamed.

- Added Admin `/economy` controls for runtime-owned held gem/diamond exchange. The page now lists exchangeable held value items returned for the selected identity, previews the credit value from the runtime denomination value, requires an admin reason, and posts `identity_code`, `item_code`, `quantity`, and `reason_text` to the new Runtime/Auth exchange endpoint. Dashboard remains a consumer only and does not add storefronts, purchases, trading, transfers, or local economy state. No files or assets were created, removed, or renamed.

- Corrected Admin `/economy` wallet inspection copy/rendering for the cash-plus-held-value denomination model. The inspector now shows total balance, cash balance, and held item value separately from the same runtime/Auth payload, while denomination chips continue to render coin/banknote cash counts and held gem/diamond inventory counts returned by Runtime/Auth. Dashboard remains a consumer only; no authority endpoints or unrelated pages were redesigned. Updated focused source tests. No files or assets were created, removed, or renamed.

- Extended the existing Admin `/economy` and `/progression` control surfaces for the public game authority foundation without redesigning unrelated pages. `/economy` now displays stable `item_code` values, uses runtime-provided category/rarity dropdown presets, can create new item definitions with required notes, keeps identity-scoped manual inventory grants on the existing runtime endpoint, and exposes a separated Danger Zone for backup export plus typed-confirmation append-only reset operations. `/progression` now exposes synchronized color picker/hex inputs plus icon asset path editing for every `LEVEL0`-`LEVEL24` definition while preserving the existing runtime `level_definitions` save path. Updated focused Dashboard source tests. No files or assets were created, removed, or renamed.

- Fixed the Admin `/economy` item-definition reason bug by changing the save handler to scope field reads to the surrounding `.ss-economy-item-definition` article instead of the save button's own `data-item-code` attribute. The visible `data-item-field="reason_text"` input is now the value validated client-side and sent as the existing runtime/Auth `reason_text` payload. Added Economy Settings and Denominations sections backed by `/api/admin/economy/settings` and `/api/admin/economy/denominations`, rendered wallet totals as configurable credits with the `currencyunit.svg` mask symbol, displayed derived denomination chips, and tagged item definitions as currency units/denominations/inventory items. No files were created, removed, or renamed; the touched JS/CSS/tests are longer due to the new controls and assertions.

- Corrected the Admin `/economy` manual economy/inventory controls so submit handlers now read the required reason from the currently rendered visible action/reversal form before sending the existing runtime/Auth `reason_text` payload. The page now defaults existing collapsible economy/inventory sections to expanded while preserving collapse toggles, and `/economy` now participates in the existing top-bar section anchor row pattern with route-safe anchors for Identity Search, Wallet, Economy Ledger, Manual Economy Actions, Inventory, Inventory Events, Manual Inventory Actions, and Item Definitions. Runtime/Auth endpoint usage was unchanged and StreamSuites remained read-only. No files were created, removed, or renamed.

- Repaired the Admin `/progression` and `/economy` control-page layouts so dense editors no longer sit in cramped equal-width two-column grids. Progression now uses full-width level definitions with local pagination, a collapsible XP Rules section, a readable identity master/detail workspace, paginated XP history, and collapsible leaderboard hygiene while keeping existing runtime/Auth endpoints unchanged. Economy now uses a full-width identity/wallet workspace, collapsible paginated economy and inventory event sections, collapsible manual action sections, a compact full-width inventory inspector, and paginated expandable item-definition editors that expose label, category, rarity, enabled state, icon path, metadata notes, and required save reason without changing authority ownership. Updated focused source tests to pin the stacked layout, collapse controls, pagination controls, and expandable item editor. No files were created, removed, or renamed; the runtime/Auth repo remained read-only.

- Removed the redundant visible `Level` text prefix from Dashboard progression level chips in `docs/js/progression.js`; chips now render the configured level label only while nearby headings/fields provide the level context. Source tests now pin that the chip renderer does not reintroduce the prefix. No files were created or removed.

- Narrow-corrected the Dashboard sidebar icon for the new `/economy` route in `docs/js/app.js` so the nav item uses `/assets/icons/economy.svg` instead of the coin asset. This does not replace the coin icon inside the Economy page; `docs/js/economy.js` continues to use `/assets/games/sscoin.webp` for balances. No files were created or removed.

- Updated `/progression` from XP/rank controls to XP/level controls while preserving rank wording only for leaderboard placement contexts. The admin route, shell labels, route title, `docs/js/progression.js`, and `docs/views/progression.html` now read canonical `level_definitions`, render all 25 levels including secret levels, show/edit level labels, thresholds, visibility, color/icon metadata from the runtime contract, and POST/PATCH `level_definitions` back to the existing runtime/Auth endpoint. `docs/css/components.css` adds canonical level-chip selectors while keeping rank-chip compatibility selectors for migration. README and source tests were updated; no files were created, removed, or renamed.

- Added a new `/economy` admin route for runtime-owned public economy and inventory controls. The compact dark surface loads the real `/api/admin/economy/*` and `/api/admin/inventory/*` authority endpoints for identity search, wallet inspection, economy ledger history, manual economy grant/penalty/adjustment actions, append-only economy reversals, inventory summary/history, manual inventory grant/remove/adjustment actions, append-only inventory reversals, and item definition metadata tuning without creating dashboard-owned economy state. The route uses `docs/assets/games/sscoin.webp` as the coin/economy icon. Added `docs/views/economy.html`, `docs/js/economy.js`, and `tests/economy-admin-controls.test.mjs`; updated shell routing, nav/script loading, Pages fallback functions, component styling, and README tree entries. No files were removed.

- Added the same restrained hover sheen treatment to compact Dashboard progression rank chips in `docs/css/components.css`, matching the Public polish while keeping the `/progression` admin rows and rank-definition previews compact. Source coverage in `tests/progression-admin-controls.test.mjs` now pins the sheen selectors and reduced-motion guard. No files were created or removed.

- Added authoritative rank presentation rendering to the existing `/progression` admin consumer. Identity rows and the inspector now show avatar, display name, actual account `user_code`, XP with the shared star icon, and rank chips using runtime-provided color/icon metadata; Rank Definitions now preview the configured rank chip plus its color/icon path. Added compact dark admin styling and source assertions for the presentation seam. No files were created or removed; the required `.webp` assets were already present in the worktree.

- Tightened the `/progression` admin consumer so identity rows now render the avatar image, display name, and canonical account `user_code` when the runtime marks a public identity as claimed/assigned. The fallback `public-user...` identity code remains visible only as a diagnostic line/public identity value and remains the displayed code only when no account user code exists. Added the missing Cloudflare Pages SPA allowlist entries for `/progression`, `/xp`, and `/ranks` so the registered admin route can load directly in real Pages routing. Added focused source coverage for the canonical-code resolver, compact avatar cell styling, and route allowlist. No files were created or removed.

- Added a new `/progression` admin route for runtime-owned XP/rank controls. The compact dark admin surface loads `GET/PATCH /api/admin/progression/ranks`, `GET/PATCH /api/admin/progression/rules`, identity search/detail/history endpoints, manual grant/penalty/adjustment event creation, append-only reversal creation, and leaderboard visibility suppression without storing progression authority in Dashboard.
- Added `docs/views/progression.html`, `docs/js/progression.js`, and `tests/progression-admin-controls.test.mjs`; updated route registration, shell nav/script loading, component styling, and README tree entries. The UI keeps the phase global-only, requires reasons for manual actions/reversals/suppression, preserves fixed `RANK0`-`RANK10` codes, and states that suppression affects leaderboard display rather than XP deletion. No files were removed.

- Added an Admin custom trigger preview diagnostics panel to `docs/views/triggers.html` and `docs/js/triggers.js`. Admins can select a creator-owned custom row, choose a simulated platform/message/actor/context, and call `POST /api/admin/livechat/custom-triggers/preview` for runtime/Auth dry-run match and rendering diagnostics.
- The admin preview renders dry-run/no-send flags, creator/custom trigger IDs, match reason, variables used, actor normalization summary, platform max chars, response mode, warnings, rendered text, and split pages. It does not call transport routes, live dispatch, playable game logic, or mutate the global seed registry. No files were created or removed; the trigger oversight JS/view/test files are longer due to the added diagnostic surface.

- Extended Admin Trigger Oversight with a separate creator-owned custom trigger config section hydrated from `GET /api/admin/livechat/custom-triggers` while preserving the global `/api/livechat/*` registry as read-only seed data. The new oversight table includes creator/account owner, enabled/status, command/aliases, platforms, response mode, cooldown, access, timestamps, and creator/status/platform/search filters.
- Added runtime/Auth-only admin enable/disable and delete actions for addressable custom rows through the existing account-scoped `/api/admin/accounts/{account_id}/creator-triggers/{trigger_id}` authority path, with truthful copy that this is configuration management for future dispatch and not live execution. No files were created or removed; `docs/js/triggers.js`, `docs/views/triggers.html`, and the trigger source test were updated in place and are expected to be longer due to the added custom-config oversight surface.

- Replaced the Admin trigger oversight page with a read-only livechat registry view hydrated from the authoritative runtime/Auth `/api/livechat/*` endpoints. The page now shows summary counts, platform caps, filters/search, trigger technical metadata, Games registry foundation rows, and explicit runtime/Auth authority/source without using creator-specific local mutation scaffolds.
- Removed active Admin trigger create/edit/delete/manual-send controls from this route because this task is registry hydration only. No files were created or removed; `docs/js/triggers.js` and `docs/views/triggers.html` were replaced in place and are expected to be shorter because the previous creator-specific mutation workflow was removed.

- Re-verified admin `/integrations/rumble` as a consumer of the repaired runtime/Auth Rumble posture contract. No dashboard runtime code needed to originate the fix; the existing `docs/js/platforms/rumble.js` surface remains compatible with masked session posture fields and copyable sanitized raw debug. `tests/notifications-runtime-authority.test.mjs` was run to confirm the consumer contract. No files were created or removed.

- Extended admin `/integrations/rumble` in `docs/js/platforms/rumble.js` so the authenticated-session diagnostics now show selected material type, validation errors, safe material-updated timestamp, and whether authenticated mode actually changed the outcome compared with the sample path, while still keeping raw runtime debug copyable and secret-safe.
- Expanded `tests/rumble-challenge-session-posture.test.mjs` additively so the dashboard contract now pins those new safe session posture fields and continues asserting that no raw cookie values are surfaced in the rendered/raw-debug pathway. No files were created or removed in this pass.

- Extended admin `/integrations/rumble` in `docs/js/platforms/rumble.js` so selected-creator diagnostics now surface challenge/interstitial classification, expected-vs-observed content type, pre-parse-block posture, authenticated-session configuration posture, whether a session-backed probe was attempted, and a sample-path versus session/API path comparison while keeping the raw runtime debug block copyable.
- Added `tests/rumble-challenge-session-posture.test.mjs` to pin the additive challenge/session posture panels, raw debug response-shape visibility, and truthful no-debug empty state. No existing dashboard files were removed or replaced; `README.md` was updated because the test file is new.

- Repaired the admin `/integrations/rumble` route binding in `docs/js/platforms/rumble.js` so the creator/search list is now built from the authoritative creator-integration summary first and enriched by bot rows when present, instead of going blank whenever no Rumble bot row is exported for Daniel yet. Loaded runtime detail remains authoritative for the current workspace.
- Tightened the same route lifecycle with explicit poll/detail abort controllers, poll generations, duplicate-poller prevention, teardown cancellation, and last-good-detail preservation so expected route refresh/navigation cancellation does not surface `signal is aborted without reason` or destructively clear the selected creator, diagnostics, raw debug block, or stream posture.
- Expanded `tests/notifications-runtime-authority.test.mjs` additively so the Rumble page now pins the no-bot-row creator summary binding case in addition to the existing selection, raw-debug, unchanged-payload, empty-state, and abort-like refresh regressions. No files were removed or replaced in this pass.

- Repaired the admin `/integrations/rumble` polling/state flow in `docs/js/platforms/rumble.js` so normal refreshes no longer turn abort-like fetch failures into the user-facing `signal is aborted without reason` banner and no longer blank the already-loaded workspace when a transient poll comes back thinner than the prior runtime-backed selection. No files were removed or replaced in this pass.
- Tightened the same Rumble intelligence controller so the selected creator can still render from the loaded runtime detail when the summary list is briefly incomplete, bot rows can fall back to runtime-owned `creator_account_id`, and the current-runtime snapshot now stays visible whenever the payload already contains runtime debug or posture data even if no historical analytics series exists yet. No files were added or removed; the touched JS file is slightly longer because it now carries the extra state-preservation guards.
- Expanded `tests/notifications-runtime-authority.test.mjs` additively so the dashboard regression harness now pins two real break cases: a later empty summary refresh must not erase Daniel’s loaded workspace, and a normal abort-like polling failure must not surface `signal is aborted without reason` or replace the current diagnostics with a broken empty state. No files were removed in this pass.

- Stabilized the admin `/integrations/rumble` intelligence workspace in `docs/js/platforms/rumble.js` so refresh polling no longer self-aborts in-flight detail loads, no longer destroys the selected creator/debug workspace while operators are reading it, and now preserves creator selection, expanded raw-debug state, and unchanged raw payload blocks across refreshes instead of destructively rebuilding the panel.
- Expanded the same admin Rumble surface in `docs/js/platforms/rumble.js` and `docs/css/components.css` without removing the existing service/runtime/readiness sections. The intelligence area now renders richer runtime-backed panels for detection summary, identity resolution, browse/live and creator/API request chains, watch-target and stream/chat identity resolution, blocking/stop reasoning, managed-session posture, freshness markers, and an exhaustive copy-pastable raw debug payload with truthful empty-state behavior when no runtime debug object exists yet.
- Extended `tests/notifications-runtime-authority.test.mjs` additively so the dashboard regression harness now pins selection stability across refresh, raw debug copyability, truthful empty-state handling, unchanged-payload non-destructive rerender behavior, and the continued presence of the existing runtime posture sections on `/integrations/rumble`. No files were removed or replaced in this pass.

- Extended the existing admin `/integrations/rumble` workspace in `docs/views/platforms/rumble.html`, `docs/js/platforms/rumble.js`, and `docs/css/components.css` without removing the current posture/readiness sections. The Rumble Intelligence area now renders richer runtime-backed diagnostics for the selected creator, including detection summary, selected identity, live-tile match detail, watch-target and chat-stream resolution, blocking/stop reasoning, managed-session posture, freshness markers, and a request-chain timeline.
- Added a truthful copy-pastable raw debug surface to that same route using the new runtime-backed `rumble.runtime_debug` fragment: the page now exposes an exhaustive formatted JSON block, explicit copy control, and collapse/expand behavior while preserving polished empty states when no runtime debug object exists yet.
- Expanded `tests/notifications-runtime-authority.test.mjs` additively so the dashboard source tests now pin the new runtime-debug contract usage, the richer diagnostic section labels, and the raw debug UI controls and styling hooks. No files were removed or replaced in this pass.

- Extended the existing admin `/integrations/rumble` route in `docs/views/platforms/rumble.html` and `docs/js/platforms/rumble.js` so the current runtime posture/service/readiness sections remain in place while a new StreamSuites-native `Rumble Intelligence` workspace now adds creator/channel search, runtime-backed creator selection, a stream-history selector, current stream diagnostics, and a truthful analytics empty state when no historical engagement series has been exported by runtime.
- Updated `docs/css/components.css`, `docs/js/app.js`, `index.html`, and `docs/index.html` additively so the new Rumble intelligence layout uses existing admin panel language, the route now actually initializes and tears down `window.RumbleView`, and the Rumble route controller is loaded with the rest of the admin shell scripts instead of being omitted from the bundle list.
- Expanded `tests/notifications-runtime-authority.test.mjs` additively so the dashboard source tests now pin the existing posture contract, the new intelligence controls, the runtime-backed creator/detail fetch paths, the truthful no-history copy, and the actual route/controller registration. No files were removed or replaced in this pass.

- Stabilized the admin `/telemetry` Bots / Runtime Status surface in `docs/js/bots.js` so it no longer destructively rebuilds unchanged platform cards, table rows, creator options, or manual-deploy platform options on every poll cycle. The view now uses a single non-overlapping 8-second poll loop with abort-safe teardown on route unload instead of stacking a broad poll plus a separate 1000ms DOM-refresh timer.
- Refined the `/telemetry` Rumble platform-summary mapping in `docs/js/bots.js` so global-ready Rumble with probe-degraded pre-live blockers is shown as a calmer pending / awaiting-trustworthy-live-verification posture on the platform card, while row-level blocking and error cells still expose the exact technical blocker text and code exported by runtime.
- Expanded `tests/notifications-runtime-authority.test.mjs` with a lightweight bots-view lifecycle harness that verifies repeated mounts do not multiply pollers, unchanged polls do not rewrite the cards/table DOM, and pre-live Rumble probe degradation renders as a calmer truthful summary without hiding row-level diagnostics.

- Extended the existing `/approvals` route in `docs/views/approvals.html`, `docs/js/approvals.js`, and `docs/css/components.css` so it now includes a runtime-backed public-authority review lane fed by `GET /api/admin/public/authority/requests?status=all`, with pending-first ordering, local status/type filters, a selected-request detail pane, and operator wording that stays explicit about review-state changes versus automatic transfer or destructive deletion.
- Added real admin mutation controls on that same approvals surface via `PATCH /api/admin/public/authority/requests/{request_id}` for the actual backend terminal states `approved`, `rejected`, and `cancelled`, including resolution-note wiring and dashboard-sourced `resolution_metadata`.
- Added `tests/public-authority-approvals.test.mjs` and updated `README.md` so the repo tree and source coverage now pin the public-authority approvals surface alongside the existing intake queues.

- Added `docs/assets/js/ss-social-platforms.js` as the shared admin-side canonical social registry for compact identity surfaces. It mirrors the Public/Members first-class-first ordering, alias normalization, extended-platform coverage, full-color SVG preference, the `whatsappchannels` -> existing `whatsapp.svg` correction, and it deliberately omits any `dlive` entry.
- Replaced the old partial hardcoded social icon/order logic in `docs/assets/js/ss-profile-hovercard.js` with the shared canonical helper because the previous local map only covered a small subset of platforms and could not keep compact hovercards aligned with Public/Members parity. That hovercard file is expected to be shorter in the mapping section because the duplicated inline registry was removed and replaced by the shared helper.
- Replaced the old raw text-link social preview path in `docs/js/accounts.js` and `docs/js/user-detail.js` with the same compact canonical icon strip used by the hovercard. Compact preview cards now cap visible socials at eight icons and append a restrained `+N` overflow indicator instead of expanding into bulky link text.
- Updated `docs/assets/css/ss-profile-hovercard.css` and `docs/css/components.css` additively so the new compact social strips keep the existing card language while supporting the slim overflow pill and shared icon spacing.
- Expanded `tests/notifications-runtime-authority.test.mjs` additively and updated `README.md` so the admin repo now pins the shared helper load order, the WhatsApp Channels correction, the max-8 compact behavior, and the explicit absence of any `dlive` mapping.

- Refined the admin-side Rumble posture wording in `docs/js/bots.js`, `docs/js/creator-integrations.js`, and `docs/js/user-detail.js` so matched-but-offline creators now show an awaiting-live posture, live-target unresolved creators stay distinct from attach-identity blockers, and real auth/transport failures remain the only hard blocked/error class. The existing pages and layouts were preserved; this is a narrow semantic pass on the runtime-backed labels and notes.
- Updated `tests/notifications-runtime-authority.test.mjs` additively so the dashboard source tests now pin the new `awaiting_live` / `live_target_unresolved` posture handling and the calmer creator-card vocabulary. No files were removed or replaced in this pass.

- Completed the admin-side Rumble posture split so overview, `/integrations/rumble`, and `/telemetry` now prefer runtime-global posture fields over creator-scoped managed-session blockers. `docs/js/bots.js`, `docs/js/platforms/rumble.js`, and `docs/js/overview.js` now read the exported `global_status` / `session_status` contract separately instead of flattening creator-disabled or blocked sessions into a fake paused platform state.
- Updated `tests/notifications-runtime-authority.test.mjs` additively so the dashboard source tests now pin the new global-vs-session posture split on the bots surface, the dedicated Rumble page, and the overview platform cards. No files were removed or replaced in this completion pass.

- Replaced the half-finished trigger oversight scaffold in `docs/js/triggers.js` and `docs/views/triggers.html` with a real admin control-plane pass on the same `/integrations/triggers` route. The route now merges `/api/admin/creator-integrations` with `/api/admin/creators` for selector hydration, prefers the narrower `/api/admin/accounts/{account_id}/creator-integrations` detail contract, and keeps `/api/admin/users/{user_code}` only as a fallback when an account id is unavailable. These files were replaced in place rather than removed; they are expected to stay roughly similar in size because the route now owns the real selector/detail/control workflow instead of a thin patch.
- Added clearer phase fencing in the same route so manual admin send, manual creator send, and automatic trigger reply history are visually distinct, while unsupported trigger types remain visible but explicitly marked outside first-phase Rumble text support instead of pretending they are editable.
- Updated `tests/triggers-runtime-authority.test.mjs` additively so the dashboard must keep the merged selector hydration, the account-scoped creator-integrations detail fetch, the dispatch-source distinctions, and the visible out-of-scope trigger messaging.

- Replaced the old paused/read-only scaffold on `docs/views/platforms/rumble.html` and `docs/js/platforms/rumble.js` with a live admin runtime posture panel backed by `GET /api/admin/bots/status`. The page now reflects whether Rumble is ready, pending, blocked, manually paused, or in error based on the runtime-owned bot-status contract instead of a hardcoded paused message.
- Reworked the Rumble platform-card and telemetry posture logic in `docs/js/bots.js` so enabled-but-blocked and managed-pending runtime states are shown truthfully on `/telemetry` instead of being flattened into a generic paused or ready posture. No workflow redesign was done; this is a narrow runtime-truth and polish pass on the existing cards.
- Polished the `/telemetry` platform cards in `docs/css/components.css` with larger platform logos, stronger card contrast, roomier spacing, and dedicated blocked/pending states while preserving the same page layout and controls.
- Hardened the admin trigger creator selector in `docs/js/triggers.js` so it falls back to the authoritative `/api/admin/creators` contract when the creator-integrations summary route does not return selector rows. Nothing was removed; the selector now has a second runtime/Auth-backed hydration path instead of failing empty.
- Added focused regression checks in `tests/notifications-runtime-authority.test.mjs` and `tests/triggers-runtime-authority.test.mjs` for the runtime-backed Rumble page, the blocked/pending bots posture handling, and the trigger selector fallback.

## CURRENT VER= 0.4.2-alpha / PENDING VER= 0.4.8-alpha

- Replaced the early scaffold on `docs/js/jobs.js` and `docs/views/jobs.html` with a real operator-facing `/jobs` oversight surface backed by the authoritative runtime export path. The page now hydrates from `jobs.json` plus `runtime_snapshot.json`, keeps canonical job state read-only, shows feed availability, runtime module posture, grouped job summaries, restart/apply posture, and a finished empty state that explicitly reserves future clip jobs until the runtime exports them for real. These two files were replaced in place rather than removed and are expected to be longer because the route now owns full runtime-backed hydration and presentation instead of a thin placeholder.
- Added `tests/jobs-runtime-authority.test.mjs` and updated `docs/js/app.js` additively so the jobs route must remain unload-safe and must keep real hydration, grouping, empty-state, and missing-export handling instead of falling back to scaffold-only rendering.

## 2026-04-14 - Admin Trigger Oversight Repair Completion

### Technical Notes

- Repaired the partially replaced admin trigger oversight route so `docs/js/triggers.js` now unloads cleanly with the admin shell lifecycle, avoids stacked listeners on repeated route entry, and distinguishes creator-manual, admin-manual, and automatic trigger-generated dispatch rows from the authoritative runtime/Auth export.
- Updated `docs/js/app.js` to unload the trigger controller, and updated `README.md` additively so the repo tree truthfully includes the repaired trigger route assets plus the new trigger oversight source test. No files were removed in this repair pass.
- Added `tests/triggers-runtime-authority.test.mjs` in the same lightweight regression style already used in this repo so the trigger oversight route must keep the runtime/Auth-backed wiring, unload path, and manual-send source distinctions.

### Human-Readable Notes

- The admin trigger route no longer risks accumulating duplicate event handlers when operators move in and out of the page.
- Operators can now see whether a recent Rumble message was sent manually by admin, manually by the creator, or automatically by the trigger runtime.

## 2026-04-14 - Admin Rumble Managed Session Visibility Pass

### Technical Notes

- Extended `docs/js/creator-integrations.js` and `docs/js/user-detail.js` so the existing admin creator/account inspection surfaces now read the runtime-authored `integration.managed_session` block for Rumble, show auto-deploy posture beside managed-session lifecycle and transport status, render readable auth/target/heartbeat/attach timestamps, and expose watch/channel links only when the runtime already provides them.
- Reworked the existing bot-runtime table in `docs/views/bots.html` and `docs/js/bots.js` so managed Rumble sessions are visually distinct from manual bot rows. The older generic `Status / Active target / Manual override / Connected at / Uptime / Last error` column layout was replaced with `Session / Lifecycle / Transport / Target / Heartbeat / Blocking / Error` because the old layout hid the new managed-session contract behind legacy manual-runtime assumptions. The file is longer because the richer runtime state is now rendered directly instead of being discarded.
- Added small additive styling in `docs/css/components.css` for the new managed-session runtime block and denser bot-table cells without redesigning the broader dashboard component language.
- Expanded `tests/notifications-runtime-authority.test.mjs` in the same source-level regression style already present here so the admin creator integration surfaces and bots view must keep their managed-session hooks, watch-target links, transport labels, and auth-blocking wording.

### Human-Readable Notes

- Operators can now tell the difference between managed and manual Rumble bot sessions at a glance.
- Creator/account drill-in surfaces now show whether the blocker is insufficient chat auth, unresolved target, or transport failure instead of burying that state in runtime-only exports.

### Files / Areas Touched

- `docs/views/bots.html`
- `docs/js/bots.js`
- `docs/js/creator-integrations.js`
- `docs/js/user-detail.js`
- `docs/css/components.css`
- `tests/notifications-runtime-authority.test.mjs`
- `BUMP_NOTES.md`

## 2026-04-12 - Admin Notification Runtime Authority Hardening

### Technical Notes

- Rebuilt `docs/js/notifications.js` around the runtime `GET/PATCH /api/admin/notifications` contract so the dashboard inbox now hydrates backend-owned `is_read`, `read_at`, `total_count`, `unread_count`, scoped notes, and per-viewer mutations instead of persisting read IDs in browser storage.
- Removed and replaced the old browser-only read-state path in `docs/js/notifications.js`: the `READ_IDS_STORAGE_KEY` localStorage model, its related persistence helpers, and the synthetic read/unread toggling logic were replaced rather than retained because they created a second, non-authoritative notification state. The file stayed roughly the same scale overall, but it changed shape substantially because runtime fetch/mutation/error handling now owns the workflow.
- Updated `docs/views/notifications.html` to describe the real runtime-backed operator feed accurately, added `tests/notifications-runtime-authority.test.mjs`, and updated `README.md` so the repo tree reflects the new notification regression test.

### Human-Readable Notes

- Admin inbox read state now follows the signed-in operator across the dashboard because the runtime owns it.
- The old browser-only fake read-state layer is gone.
- Notification mute/show-muted preferences stay local, but notification data and read state now come from the runtime contract.

## Runtime Turnstile Kill-Switch Indicator - 2026-04-09

### Technical Notes

- Updated the shared dashboard Turnstile helper in `docs/js/turnstile-inline.js` so admin auth surfaces now consume the runtime-owned `/auth/turnstile/config` state including `runtime_enabled` and `configured`, while still hiding the widget whenever the effective `enabled` flag is false.
- Reused the existing admin auth status region in `docs/js/admin-login.js` and `docs/js/admin-auth.js` for a compact operator warning when the runtime kill-switch disables Turnstile, avoiding a new page or auth modal redesign.
- Expanded `tests/admin-auth-turnstile.test.mjs` to cover the runtime-disabled notice contract and the clean collapse path when Turnstile is not rendered.

### Human-Readable Notes

- Dashboard operators now get an obvious but low-impact warning on admin login surfaces when the runtime has Turnstile turned off.
- The Turnstile block still disappears cleanly instead of leaving dead space behind.

## Emergency Admin Login Status Collapse Hotfix - 2026-04-06

### Technical Notes

- Root-caused the blank gap on the standalone admin `/auth/login` card to shared admin-auth status styling in `docs/css/base.css`: `.admin-auth-status` always reserved `min-height: 20px` plus `margin-top: 14px` even when the live region contained no text, so the bottom of the card kept an empty status row beneath the Turnstile block.
- Updated the shared admin-auth status styling so the region is `display: none` with zero reserved height when empty and only regains its top spacing when it actually has text, preserving the existing DOM order and avoiding any Turnstile relocation.
- Tightened both `docs/js/admin-login.js` and `docs/js/admin-auth.js` so clearing a status also removes the stale `data-state`, preventing empty live-region shells from retaining prior state markers after message text is cleared.
- Added a focused regression assertion in `tests/admin-auth-turnstile.test.mjs` covering the self-collapsing CSS contract and the JS cleanup of stale status state.

### Human-Readable Notes

- The admin login card no longer leaves an ugly empty message strip under the security check when there is nothing to say.
- Real admin validation, loading, success, and error messages still appear in the same place when they actually exist.

## Emergency Admin/Auth Turnstile Parity Hotfix - 2026-04-06

### Technical Notes

- Verified the standalone admin `/auth/login.html` path already had explicit Turnstile config/render wiring in `docs/js/admin-login.js`, but normalized its markup so the widget now sits near the bottom of the card beneath the alternate-surface links.
- Root-caused the remaining admin omission to the in-shell login overlay in `docs/index.html`, `index.html`, and `docs/js/admin-auth.js`: the overlay shipped Turnstile markup but never loaded the helper or created a controller, so OAuth starts and password login there bypassed any inline widget rendering entirely.
- Added explicit helper loading plus controller init to `docs/js/admin-auth.js`, required fresh Turnstile tokens for overlay OAuth starts and password login posts, and kept server-side validation authoritative by continuing to send `turnstile_token` to the same auth endpoints.
- Tightened `tests/admin-auth-turnstile.test.mjs` so future regressions fail if the overlay loses its explicit inline Turnstile controller or if the admin markup drifts back to the older high placement.

### Human-Readable Notes

- Admin now has Turnstile parity on both the standalone `/auth/login` page and the dashboard overlay login, instead of only on one path.
- The security check sits lower in the admin auth cards and keeps the tiny helper copy size already used there.

## Emergency Admin Login Turnstile Hotfix - 2026-04-05

### Technical Notes

- Root-caused the live admin `/auth/login` Turnstile outage to a dashboard-only config fetch bug in `docs/js/admin-login.js`: the standalone admin login page was still requesting `GET /auth/turnstile/config` from `admin.streamsuites.app`, but this repo does not publish an auth proxy route for that path, so the deployed page received `404` and kept the Turnstile panel hidden.
- Replaced that broken standalone admin config path with an explicit Auth-origin config URL derived from the existing `streamsuites-auth-base` metadata, so the real admin login page now requests `https://api.streamsuites.app/auth/turnstile/config` before rendering the inline widget.
- Tightened `tests/admin-auth-turnstile.test.mjs` so it now fails if `docs/js/admin-login.js` regresses to the broken hard-coded same-origin `configUrl: "/auth/turnstile/config"` wiring.

### Human-Readable Notes

- The deployed admin login page was not missing markup; it was hiding the widget because it asked the wrong host for Turnstile config.
- Admin `/auth/login` now explicitly pulls Turnstile config from the real Auth service instead of a non-existent dashboard route, which restores first-load inline widget rendering without weakening server-side validation.

## Admin Dropdown Account Overview Parity - 2026-04-05

### Technical Notes

- Added the compact account overview card to the in-shell admin user menu in both `index.html` and `docs/index.html`, then hydrated those fields from the existing admin session consumer in `docs/js/admin-auth.js`.
- Extended `docs/css/base.css` with additive overview-card styling only; the existing admin actions, menu order, and toggle shell remain intact.
- No StreamSuites runtime contract change was needed for the Admin dropdown parity pass.

### Human-Readable Notes

- The Admin Dashboard dropdown now opens with the same compact account summary pattern as the Creator reference.
- The rest of the admin menu stays where it was.

## Developer Access-Class Admin Controls - 2026-04-05

### Technical Notes

- Removed `Developer` from the generic tier selectors in `docs/js/accounts.js` and `docs/js/user-detail.js`; normal plan updates now stay limited to `CORE`, `GOLD`, and `PRO`.
- Added dedicated Developer grant/revoke actions to the Dashboard accounts table row actions, the expandable account details/sidebar action block rendered from `docs/js/accounts.js`, and the full user details management panel in `docs/js/user-detail.js`.
- Wired those controls to the new runtime-owned `PATCH /admin/accounts/{account_id}/developer-access` contract instead of piggybacking on the old tier update path, and updated account normalization to consume the runtime `access_class` plus display-tier fields.
- Added a focused node test proving the Dashboard no longer renders developer as a tier option and now contains explicit `developer-access` grant/revoke controls on both account-management surfaces.

### Human-Readable Notes

- Admins now manage Developer access explicitly instead of pretending it is a paid plan.
- The Dashboard still lets admins change normal plans, but Developer is now its own separate access control.

## RELEASED / PACKAGED: 0.4.2-alpha

Packaged / released and no longer the active pending bucket. Preserve new notes for the open `0.4.8-alpha` section below.

## Overview Location Flag Prefix Alignment - 2026-04-03

### Technical Notes

- Replaced the remaining plain-text location rows in `docs/js/overview.js` with country-code-aware flagged HTML rows so the overview snapshot cards stop drifting from the rest of the dashboard’s shared SVG flag presentation.
- The latest-alert location row now derives its flag prefix from the authoritative alert geo country code rather than depending on the older optional `country_flag` field, and the analytics “Most active region” row now carries the same country-code-backed flag slot.
- Added a post-render `StreamSuitesCountryFlags.upgradeFlagSlots(...)` pass for the overview root so those inline location slots are actually hydrated after the overview cards repaint.
- No files were removed in this repo during this fix. Older plain escaped location rows were replaced in place because the regression was inconsistent overview rendering, not a structural problem, so `docs/js/overview.js` is expected to be slightly longer.

### Human-Readable Notes

- Overview location mentions now get the same SVG flag prefix treatment already used elsewhere in the admin dashboard.
- Latest alert location and analytics top-region rows now stay aligned on country-code-derived flag rendering instead of plain text only.

### Files / Areas Touched

- `docs/js/overview.js`
- `BUMP_NOTES.md`

## Admin Login Rate-Limit Error Transparency + In-Flight Guard - 2026-04-03

### Technical Notes

- Tightened both admin password-login consumers in `docs/js/admin-login.js` and `docs/js/admin-auth.js` so the dashboard no longer collapses all upstream auth failures into the same vague “Try again shortly” message.
- Added response-body/header parsing for password-login failures, including `Retry-After` handling plus clearer `401`, `403`, `429`, and `5xx` messaging when the authoritative Auth/API layer rejects the request.
- Added explicit password-login in-flight guards on both the standalone admin login page and the in-shell auth overlay so repeated submits cannot stack while a previous request is still pending.
- This pass does not remove the upstream auth or Cloudflare rate limit itself because that limiter is not owned by this dashboard repo; it makes the real denial reason visible and prevents dashboard-side duplicate submits from obscuring the diagnosis.

### Human-Readable Notes

- Admin login now tells you when Auth is rate limiting the password route instead of pretending every denial is the same generic error.
- If Auth sends a retry window, the UI now shows it.
- The password form now blocks overlapping submits while a request is already in flight.

### Files / Areas Touched

- `docs/js/admin-login.js`
- `docs/js/admin-auth.js`
- `BUMP_NOTES.md`

## Overview Deep Polish + Snapshot Band Pass - 2026-04-03

### Technical Notes

- Polished the existing `docs/views/overview.html` hero in place instead of replacing the overview architecture: removed the decorative grid treatment, tightened the typography scale, kept the command-access sidebar, and added a runtime/session-backed operator greeting at the top of the hero.
- Added `/overview` to the shared anchored section-shell config in `docs/js/app.js`, reusing the same jump-tab rail pattern already used by Alerts, Settings, and Permissions rather than introducing overview-specific scroll logic.
- Extended `docs/js/overview.js` with three additive snapshot loaders that reuse already-existing dashboard contracts: admin analytics for geographic/topline reach, admin alert history for the latest real alert snapshot, and the existing `/api/admin/api-usage` contract for a concise live API posture card.
- Inserted a new first post-hero snapshot section in `docs/views/overview.html` and hydrated it from those real contracts, with intentionally uneven card widths so the analytics footprint and API usage summaries have enough horizontal room instead of collapsing into thin equal columns.
- Reworked the overview-specific layout rules in `docs/css/components.css` so dense downstream cards now default to wider two-up presentation, feeds can breathe, hero summary cards read smaller and cleaner, and platform cards reuse the small logo-prefixed title treatment already established on Settings.
- Tightened overview status presentation by reusing chip-color semantics for enabled/disabled, severity, result, availability, and restart-boundary states across the polished cards instead of leaving those values as flat uncolored text.
- No overview sections or files were removed in this pass. This was a strict polish/additive upgrade, so `README.md` did not need a repo-tree update.

### Human-Readable Notes

- Overview remains recognizably the same page, but the hero reads more professionally and less placeholder-like.
- The first section under the hero now gives a real operational snapshot for analytics reach, latest alert activity, and API usage.
- Down-page cards have more breathing room, platform titles carry the existing logo treatment, and status-style values now read with clearer color meaning.

### Files / Areas Touched

- `docs/views/overview.html`
- `docs/js/overview.js`
- `docs/js/app.js`
- `docs/css/components.css`
- `BUMP_NOTES.md`

## Shared Runtime Export + Live-Status Mirror Refresh - 2026-04-03

### Technical Notes

- Root-caused the stale admin version/build and shared live-status posture to upstream publication drift instead of an overview-only rendering bug: this repo’s checked-in `docs/runtime/exports/*` and `docs/shared/state/*` mirrors had fallen behind the authoritative `StreamSuites` runtime contracts, and the downstream `docs/shared/state/version.json` copy had remained effectively empty.
- Refreshed the mirrored runtime-export payloads in `docs/runtime/exports/` from the authoritative `StreamSuites/runtime/exports/` contract, restoring the current runtime version/build metadata plus the current exported runtime snapshot, live-status snapshot, and related shared export payloads consumed by overview/settings posture surfaces.
- Refreshed the mirrored shared-state payloads in `docs/shared/state/` from the same runtime-owned contract set, including truthful `version.json`, `runtime_snapshot.json`, `live_status.json`, quotas, Discord runtime state, and the other shared JSON documents this dashboard loads before any GitHub/raw fallback path.
- No dashboard loader branches were removed in this repo during this fix. The broken assumption was stale downstream data, not the existence of the admin views themselves, so the repo structure stayed the same and `README.md` did not need a tree update.

### Human-Readable Notes

- The admin dashboard mirror now carries the current runtime version/build again.
- Shared live-status hydration and other shared posture cards are back on the refreshed runtime-owned mirror instead of an older copied export set.
- The old empty shared-state version mirror was replaced with the real runtime export metadata.

### Files / Areas Touched

- `docs/runtime/exports/version.json`
- `docs/runtime/exports/runtime_snapshot.json`
- `docs/runtime/exports/live_status.json`
- `docs/shared/state/version.json`
- `docs/shared/state/runtime_snapshot.json`
- `docs/shared/state/live_status.json`
- `docs/shared/state/...` (refreshed mirrored JSON contracts)
- `BUMP_NOTES.md`

## Overview Command Landing Redesign + Real Admin Hydration Pass - 2026-04-03

### Technical Notes

- Replaced the old `docs/views/overview.html` scaffold composition with a new operations-home layout centered on real admin posture: one command hero, one operational posture band, one platform runtime grid, one accounts snapshot section, one recent-signals section, and one runtime publication plus honest-scaffold section.
- Reworked `docs/js/overview.js` around the contracts this dashboard already consumes instead of mixing old placeholder tables with a few hydrated read-only panels. The new overview now hydrates from runtime snapshot/version/export/live-status payloads, Auth control and session payloads, alert settings, admin users snapshot, audit snapshot, admin activity, auth events, and dashboard-local creator/platform draft state.
- Added dedicated overview-scoped styling in `docs/css/components.css` so the page now matches the denser premium card language already established on stronger admin surfaces such as Settings, Alerts, and Permissions without changing unrelated pages.
- Removed or replaced several obsolete scaffold modules from the overview surface because they were no longer a truthful flagship landing page: the old system-status table, configuration-summary table, telemetry event/rates/error tables, static YouTube quota placeholder bars, platform-by-platform scaffold tables, Discord control-plane table, admin-activity table, and the generic upcoming-modules list.
- That cleanup is expected to make `docs/views/overview.html` materially shorter because the old table-heavy placeholder surface was replaced by denser section containers that hydrate richer card content from script. `docs/js/overview.js` and `docs/css/components.css` are expected to be longer because they now own the new layout composition, hydration logic, and page-scoped presentation.
- No files were created or removed in the repo structure during this pass, so the repo tree in `README.md` did not need a structural update.

### Human-Readable Notes

- Overview now behaves like a real admin command landing page instead of an early scaffold.
- The page surfaces current runtime posture, access posture, account distribution, live-status coverage, recent admin/auth/audit feeds, and honest scaffold areas without fabricating health, deployments, incidents, or persistence.
- Areas that still do not have a safe authoritative contract remain clearly labeled as read-only or intentionally not yet exposed.

### Files / Areas Touched

- `docs/views/overview.html`
- `docs/js/overview.js`
- `docs/css/components.css`
- `BUMP_NOTES.md`

## Admin Pages Function Shell Preservation + Preview Host Bootstrap Recovery - 2026-04-03

### Technical Notes

- Follow-up deploy-shape root cause after the previous follow-up: this admin repo also needs to support direct `docs/` publishing, not just the repo-root or built-`dist` artifact shape. The live 404 behavior on `/overview` and other deep links was consistent with a `docs/`-published Pages site where `docs/_redirects` no longer rewrote SPA routes but there was still no matching `docs/functions/[[path]].js` fallback.
- Added `docs/functions/[[path]].js` with the same known-route SPA fallback logic as the repo-root Pages Function, so direct `docs/` publishing now preserves real admin deep-link URLs instead of falling through to the branded 404 page.
- Updated `scripts/build-pages-artifact.ps1` again so the builder also stages the `functions/` directory from `docs/` into `dist/`, which keeps the built artifact aligned with the direct-`docs` deployment shape instead of depending only on the repo-root function.
- Follow-up root cause after deploy verification: the route-model repair was correct, but the repo-local publish builder still only staged static assets into `dist/` and did not include `functions/[[path]].js`. That meant the deployed artifact lost the Pages Function fallback entirely, so direct-entry shell routes on the live host fell straight to `404` once the old `_redirects -> /index.html` rewrites were removed.
- Updated `scripts/build-pages-artifact.ps1` to copy the repo-root `functions/` directory into `dist/functions/`, so the publish artifact now ships the same Pages Function fallback logic that exists in source.
- Tightened `scripts/validate-pages-routing.ps1` so it now fails immediately if `dist/functions/[[path]].js` is missing and starts `wrangler pages dev` from the built `dist/` directory instead of the repo root, which closes the previous validation blind spot where local checks could accidentally succeed against source-tree functions that were absent from the actual artifact.
- Root-caused the remaining custom-domain deep-link collapse to the Cloudflare Pages shell manifest layer. The repo-root `_redirects`, `docs/_redirects`, and generated `dist/_redirects` file were still rewriting valid admin SPA routes straight to `/index.html 200`, which is the same URL-mutating pattern that had already broken Creator direct-entry routing. When Pages canonicalized that rewrite, the shell sometimes only saw `/` and the startup path defaulted back to `overview`.
- Removed those SPA route inventory rewrites from `_redirects`, `docs/_redirects`, and `scripts/build-pages-artifact.ps1`. Those files are expected to be shorter. This is safe because `functions/[[path]].js` now owns known admin shell fallback and serves the shell body from the Pages asset binding without mutating the requested pathname.
- Updated `functions/[[path]].js` to fetch `/index.html` from the `ASSETS` binding when a known dashboard route misses the static asset layer, mirroring the Creator repair. This preserves `/users/{user_code}`, `/profiles/integrations?user_code=...`, `/permissions`, and `/integrations/discord` as real first-load URLs while still letting true misses fall through to `404`.
- Root-caused the `streamsuites-dashboard.pages.dev` "Service Unavailable" boot failure to hardcoded `admin.streamsuites.app` origin assumptions inside `docs/js/admin-gate.js`, `docs/js/admin-auth.js`, `docs/js/admin-login.js`, and `docs/auth/success.html`. Preview hosts were not treated as valid admin shell origins, so auth/bootstrap logic forced canonical-admin URLs and classified preview boot as an auth-service outage instead of an explicit preview path.
- Replaced that hardcoded-origin logic with host-aware admin origin normalization. Canonical `admin.streamsuites.app` still behaves the same, while preview hosts (`*.pages.dev`, `localhost`, `127.0.0.1`, `0.0.0.0`) now preserve their own origin for admin success/login/dashboard URL construction.
- Replaced the old preview-host auth failure path with an explicit preview bootstrap path in `docs/js/admin-gate.js` and `docs/js/admin-auth.js`. Preview hosts now boot the shell in static preview mode, surface a warning banner that live auth/actions belong on `admin.streamsuites.app`, and no longer fall into the generic Service Unavailable overlay during normal shell boot.
- Replaced the unconditional canonical redirect in `docs/auth/success.html` so admin auth success now returns to same-origin overview or a same-origin redirect target instead of always bouncing to `https://admin.streamsuites.app/overview`.
- Reworked `scripts/validate-pages-routing.ps1` so it now builds `dist/`, verifies HTTP status for the target deep links and one invalid route, runs a browser-backed validation of actual mounted views, and verifies preview-host boot does not render the generic unavailable fail state.

### Human-Readable Notes

- Admin deep links now keep the exact requested URL on first load instead of collapsing back to Overview because the Pages shell fallback no longer rewrites them to `/index.html`.
- Preview deployments now boot as an explicit static preview instead of showing the generic Service Unavailable screen.
- Real bad routes stay real 404s and do not silently become Overview.

### Files / Areas Touched

- `_redirects`
- `docs/_redirects`
- `functions/[[path]].js`
- `docs/functions/[[path]].js`
- `scripts/build-pages-artifact.ps1`
- `docs/js/admin-gate.js`
- `docs/js/admin-auth.js`
- `docs/js/admin-login.js`
- `docs/auth/success.html`
- `scripts/validate-pages-routing.ps1`
- `BUMP_NOTES.md`

## Admin Shell Startup Route Preservation + Nested Script Bootstrap Repair - 2026-04-03

### Technical Notes

- Root-caused the remaining admin deep-link collapse to the client bootstrap stack rather than the Cloudflare rewrite layer: `docs/js/admin-gate.js` still reloaded the dashboard script bundle from relative `js/...` paths after authorization, which turns into `/users/js/...`, `/profiles/js/...`, or `/integrations/js/...` on direct-entry nested URLs and can break the real shell bootstrap. At the same time, `docs/js/admin-routes.js` and `docs/js/app.js` still treated unmatched shell URLs as implicit `overview`, and same-view route changes such as `/users/{codeA}` -> `/users/{codeB}` did not force a reload because the handler only compared the view name.
- Updated `docs/js/admin-gate.js` so gate-loaded scripts are normalized to origin-rooted paths before version stamping, which keeps the post-auth bootstrap loading the same files regardless of the current nested dashboard route.
- Updated `docs/js/admin-routes.js` so route resolution now distinguishes a real root default from an unknown path, exposes a shared `resolveViewName(...)` normalizer for path-like permission/view tokens, and preserves unmatched routes as unmatched instead of fabricating `overview`.
- Updated `docs/js/app.js` so startup routing, route-change handling, and permission checks all normalize through the same route helper, unknown routes render an explicit in-app not-found surface instead of collapsing to Overview, slash/path-based `allowedViews` tokens normalize back to canonical view ids, and same-view route changes reload when the pathname, params, or query actually changed.
- Hardened `scripts/validate-pages-routing.ps1` so it also survives compatibility-date skew and now runs an inline admin route-resolver regression pass for `/users/{user_code}`, `/profiles/integrations?user_code=...`, `/integrations/discord`, and the unknown-route case in addition to the existing `wrangler pages dev` HTTP checks.
- No files were removed or replaced in this repo. The touched files are slightly longer because the old fallback-to-overview behavior was replaced with explicit route-state handling and the gate loader now anchors script URLs instead of assuming the current path is the shell root.

### Human-Readable Notes

- Admin deep links now keep bootstrapping on nested URLs instead of trying to reload the dashboard bundle from a fake `/users/js/...` or `/profiles/js/...` path.
- Valid admin routes like `/users/{user_code}`, `/profiles/integrations?user_code=...`, and `/integrations/discord` now resolve to their intended view, while a real bad route stays a real not-found state instead of quietly opening Overview.
- Back/forward or programmatic navigation within the same view family now refreshes when the route payload actually changed, which keeps dynamic user-detail routes honest.

### Files / Areas Touched

- `docs/js/admin-gate.js`
- `docs/js/admin-routes.js`
- `docs/js/app.js`
- `scripts/validate-pages-routing.ps1`
- `BUMP_NOTES.md`

## Admin Cloudflare Route Inventory Repair - 2026-04-02

### Technical Notes

- Root-caused the remaining admin deep-link failures to Cloudflare rejecting the wildcard shell rewrites in `_redirects`. Local `wrangler pages dev` logs showed `/users/*`, `/profiles/*`, and `/integrations/*` were being discarded as invalid infinite-loop candidates, which left dynamic user-detail and nested shell routes dependent on whichever fallback layer happened to be active in a given deployment shape.
- Replaced those invalid wildcard shell rules in the repo-root `_redirects`, `docs/_redirects`, and generated `dist/_redirects` manifest with Cloudflare-valid route inventory entries: exact shell paths for all current admin route families, plus a single `/users/:user_code -> /index.html 200` placeholder for the real dynamic user-detail surface already defined in `docs/js/admin-routes.js`.
- Tightened `functions/[[path]].js` so its prefix fallback is now limited to `/users/` only. Known exact nested routes under `/profiles/...` and `/integrations/...` remain explicitly enumerated, which preserves shell recovery for valid paths but stops fake nested paths from being rewritten into the app shell.
- Added `/home` parity to the static shell manifests, added the missing `/permissions` docs-root compatibility rewrite, and added `/livechat/*` repo-root asset mapping so the source-checkout compatibility layer stays coherent when the repo root is served directly.
- Added `scripts/validate-pages-routing.ps1` to build `dist/`, run `wrangler pages dev dist`, verify representative admin deep links, verify a true bad nested path still returns `404`, and verify a JS asset is not rewritten to HTML.

### Human-Readable Notes

- Admin deep links now use a Cloudflare-valid route inventory instead of ignored wildcard rewrites.
- Dynamic user pages like `/users/{user_code}` still land in the shell, while fake nested `/profiles/...` paths stay real 404s.

### Files / Areas Touched

- `_redirects`
- `docs/_redirects`
- `functions/[[path]].js`
- `scripts/build-pages-artifact.ps1`
- `scripts/validate-pages-routing.ps1`
- `README.md`
- `BUMP_NOTES.md`

## Admin Permissions Surface + Authoritative Dashboard Enforcement - 2026-04-02

### Technical Notes

- Added a new dedicated admin `Permissions` route and sidebar entry under `System`, with the page shell in `docs/views/permissions.html` and the page controller in `docs/js/permissions.js`.
- Reworked dashboard-side admin access consumption in `docs/js/admin-gate.js` and `docs/js/app.js` so the SPA now reads authoritative effective permission state from StreamSuites instead of the older hard-coded developer-lite assumptions. Sidebar visibility, direct route gating, initial-view selection, and the new permission helper surface now all consume the same resolved payload.
- Replaced the older dashboard copy and route logic that treated every non-admin dashboard session as a single `developer admin-lite` bucket. The client now distinguishes route/view permission grants and specific manage-action grants from the authoritative backend payload because developer dashboard access is now explicitly permission-driven rather than one fixed allowlist.
- Added permission-aware control gating to the highest-impact existing mutation surfaces that developers might legitimately view without managing: Accounts manage actions, Creator Integrations detail or trigger controls, runtime bot/manual deploy controls, creator backfill, and Overview analytics panels.
- Added additive styling for the new permission workspace in `docs/css/components.css` and updated the dashboard README tree to reflect the new page file. Existing unrelated pages were not redesigned.

### Human-Readable Notes

- The admin dashboard now has a real permissions workspace for developer dashboard access under `System > Permissions`.
- Developers only see or use the dashboard areas their effective backend permissions allow, and direct URLs no longer bypass those checks.
- Future Creator, Public, and Tier capability areas appear as intentional planned scaffolds, not fake live toggles.

### Files / Areas Touched

- `docs/js/app.js`
- `docs/js/admin-gate.js`
- `docs/js/admin-routes.js`
- `docs/js/accounts.js`
- `docs/js/bots.js`
- `docs/js/creator-integrations.js`
- `docs/js/creators.js`
- `docs/js/overview.js`
- `docs/js/permissions.js`
- `docs/views/permissions.html`
- `docs/css/components.css`
- `index.html`
- `docs/index.html`
- `README.md`
- `BUMP_NOTES.md`

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

### Approvals Intake Expansion For Developer Console Foundations - 2026-04-04

### Technical Notes

- Extended the existing approvals view in `docs/views/approvals.html` and `docs/js/approvals.js` so it now surfaces three new runtime-owned intake queues alongside the current feature-request moderation flow: incoming feedback, pending beta applications, and incoming developer reports.
- The dashboard continues to consume backend authority rather than inventing a local workflow. New intake sections read `/api/admin/intake/feedback`, `/api/admin/intake/beta`, `/api/admin/intake/reports`, and their detail endpoints, while the existing pending/approved request moderation actions remain intact.
- Developer-report detail rendering now exposes safe artifact metadata plus download links to the backend-owned attachment download route, without introducing inline active preview behavior.
- No files were created or removed in this repo during this milestone. The approvals files are expected to be longer because the page now covers multiple intake channels in one operator-facing surface.

### Human-Readable Notes

- Admins can now see the first real console intake queues inside Approvals instead of working only from the older feature-request moderation lane.
- Feedback, beta applications, and developer reports all have recent-item visibility plus inspect detail.

### Files / Areas Touched

- `docs/views/approvals.html`
- `docs/js/approvals.js`
- `README.md`
- `BUMP_NOTES.md`

### Admin Settings Page Runtime/Posture Overhaul - 2026-04-02

### Technical Notes

- Replaced the placeholder-heavy `/settings` scaffold in `docs/views/settings.html` and `docs/js/settings.js` with a runtime-aware posture page built around current authoritative contracts instead of dashboard-only pretend settings.
- The new Settings view now hydrates from the existing runtime snapshot, `runtime/exports/version.json`, `runtime/exports/meta.json`, published `live_status.json`, `/admin/auth/controls`, `/admin/badge-governance`, and the existing admin alerts settings/configuration endpoints. Dashboard-local config import/export remains available, but it is explicitly labeled as local draft transport rather than backend persistence.
- Added `/settings` to the shared section-shell config in `docs/js/app.js`, reusing the same anchored jump-tab rail behavior already powering Accounts and Alerts instead of introducing route-specific scroll logic.
- Added page-scoped settings presentation styles in `docs/css/components.css` so the route uses the existing admin shell language while presenting stronger summary cards, detail cards, split grids, and scaffold surfaces.
- Removed and replaced obsolete placeholder sections from the old Settings page. The former `System`, `Platform Defaults`, `Security & Access`, and `Advanced` blocks were removed because they were disabled placeholders with no current runtime/Auth mutation contract. The old editable `Platform Polling`, `Global Platform Services`, and `Discord Bot` surfaces were also replaced because they mixed authoritative export state with dashboard-local draft edits and could misrepresent what the backend truly owned.
- `docs/views/settings.html` and `docs/js/settings.js` are both expected to be shorter after this cleanup because large disabled placeholder forms and local-draft-only editing flows were deleted instead of being cosmetically restyled.

### Human-Readable Notes

- Settings now reads like a real admin control posture page instead of an early scaffold. It shows what runtime, Auth, exports, and alerts are actually reporting right now.
- The page now separates true backend-owned state from dashboard-local draft import/export so admins are less likely to mistake local authoring convenience for production persistence.
- Areas that still are not safely supported stay visible as deliberate scaffolds instead of fake toggles.

### Files / Areas Touched

- `docs/views/settings.html`
- `docs/js/settings.js`
- `docs/js/app.js`
- `docs/css/components.css`
- `BUMP_NOTES.md`

### Permissions Page Anchored Rail + Safe Edit Workflow Polish - 2026-04-02

### Technical Notes

- Added `/permissions` to the shared section-shell config in `docs/js/app.js`, reusing the same anchored jump-tab rail behavior already used by Accounts, Alerts, and Settings instead of adding page-specific scroll logic.
- Updated `docs/views/permissions.html` to expose anchorable section IDs for the shared rail and replaced the old always-visible role/user save buttons with one explicit workflow surface: default view mode, `Edit`, then `Save` or `Cancel`.
- Reworked `docs/js/permissions.js` so the page opens locked by default, stages edits locally while in edit mode, blocks refresh/scope/account context switching during an active edit session, and preserves the existing authoritative hydration plus save endpoints for role policy and per-user overrides.
- Replaced the old permission-row checkbox markup in the role baseline editor with the existing shared `switch-button` toggle structure already used elsewhere in the dashboard. The old checkbox-specific visual treatment on this page was removed because it did not match the established admin/creator switch language.
- Added SVG icon prefixes to permission titles using existing `/assets/icons/ui/*.svg` assets, rendered via CSS mask/currentColor so the icon color tracks the same visual treatment as the permission title text and can be swapped later by changing the mapped asset path.
- Added the missing `/permissions` SPA direct-route fallback to the publish redirect lists so the polished page still resolves back into the dashboard shell on direct open/refresh in deployed static hosting.
- `docs/views/permissions.html` is expected to be slightly shorter because the separate save-button markup for role/user scopes was replaced by one safer workflow surface. `docs/js/permissions.js` is expected to be longer because it now manages explicit edit-state, staged drafts, context-locking, and icon mapping instead of immediate live-edit affordances.

### Human-Readable Notes

- Permissions now has the same anchored jump rail behavior as the other sectioned admin pages.
- The page opens in view mode, not live-edit mode, so changes require an explicit unlock and then a deliberate save.
- Role permission switches now match the dashboard’s real switch styling, and permission names carry matching SVG icons for faster scanning.

### Files / Areas Touched

- `docs/views/permissions.html`
- `docs/js/permissions.js`
- `docs/js/app.js`
- `docs/css/components.css`
- `_redirects`
- `scripts/build-pages-artifact.ps1`
- `BUMP_NOTES.md`

### Permissions Page Layout Density + Live Group Anchor Tabs - 2026-04-02

### Technical Notes

- Replaced the old sparse overview split in `docs/views/permissions.html` with a denser overview composition: one tighter authority summary column, one compact editor-scope card, and one separate metadata card. The old single tall side panel was removed because it left too much dead space around the scope controls and metadata at normal admin desktop widths.
- Updated the page-scoped permissions styles in `docs/css/components.css` to support the new overview composition, tighter summary-card spacing, and compact two-column metadata tiles while keeping the existing panel/card language already used across the dashboard.
- Removed the static `Matrix` tab from the base `/permissions` section-shell config in `docs/js/app.js`. The permissions view now publishes runtime section-shell overrides back into the shared anchored rail so the tab row becomes `Overview`, one tab per real live permission group, `Accounts`, and `Scaffolds`.
- Updated `docs/js/permissions.js` so live matrix groups derive shared anchor IDs from the same `groupEntries(getLiveEntries())` structure already driving the matrix render. The active role/user editor surface now owns those IDs at render time, which keeps the existing jump-scroll behavior aligned with whichever scope is visible without changing hydration, edit-mode, or persistence logic.
- `docs/views/permissions.html` is expected to be slightly shorter because the old overview-side markup was replaced by tighter compact cards with less empty wrapper space. `docs/css/components.css` is expected to stay roughly flat to slightly longer because the removed hero-split rules were replaced by new overview-density layout rules and group-anchor polish.

### Human-Readable Notes

- The Permissions page top section now reads as a tighter admin overview instead of a loose banner with a tall sparse control panel.
- The anchor tab row no longer stops at a generic Matrix tab; it now jumps directly into each real live permission group shown in the matrix.

### Files / Areas Touched

- `docs/views/permissions.html`
- `docs/css/components.css`
- `docs/js/app.js`
- `docs/js/permissions.js`
- `BUMP_NOTES.md`

### Permissions Page Matrix Rail + Icon Path Fixes - 2026-04-02

### Technical Notes

- Corrected the permissions icon map in `docs/js/permissions.js` so it only references SVG assets that actually exist in the dashboard repo. The broken `/assets/icons/ui/stack.svg` and `/assets/icons/ui/quickcontrols.svg` references were replaced because those files are not present under `docs/assets/icons/ui/`.
- Added the overall `Matrix` anchor tab back into the permissions section-shell sequence in `docs/js/permissions.js`, but kept the new per-group tabs immediately after it. `Matrix` now targets the top of `#permissions-matrix-section`, while the group tabs still jump into each real live permission group.
- Replaced the narrow right-column placement of the `Policy metadata` card in `docs/views/permissions.html` with a full-width metadata band beneath the top overview row, and updated the supporting layout rules in `docs/css/components.css` so the metadata tiles can breathe horizontally instead of being squeezed into the side column.

### Human-Readable Notes

- Missing permission-row icons should stop 404ing because the page now uses real dashboard SVG paths.
- The permissions rail now has both a top-level Matrix jump and the more granular per-group jumps.
- Policy metadata now spans the full width of the overview section instead of being cramped into the right side.

### Files / Areas Touched

- `docs/views/permissions.html`
- `docs/css/components.css`
- `docs/js/permissions.js`
- `BUMP_NOTES.md`

### Permissions Matrix State Badges + Permission Key Chip Polish - 2026-04-02

### Technical Notes

- Updated `docs/js/permissions.js` so role-edit rows now render color-coded permission state badges with SVG prefixes for `Allowed` and `Denied`, using existing `tickyeslarge.svg` and `cross.svg` assets instead of plain text flags.
- Updated the user-override matrix rows in `docs/js/permissions.js` to render the same SVG+text state badge ahead of the select control, with a third muted `Default` state backed by `squaresquare.svg` when the row inherits the role baseline.
- Styled `.ss-permissions-row-key` in `docs/css/components.css` as a subtle monospace code chip using the existing `--system-mono-font` stack, which already resolves to `SUSEMono` from `docs/assets/fonts/mono/SUSEMono-Variable.ttf` in the dashboard theme.
- Left the lower row note treatment intact; only the permission key chip and right-side current-state indicator were restyled in this pass.

### Human-Readable Notes

- Allowed and Denied are now easier to scan at a glance in role edit mode.
- User override rows now show their current effective override posture visually before the dropdown.
- Permission keys read more like compact policy IDs instead of plain muted text.

### Files / Areas Touched

- `docs/js/permissions.js`
- `docs/css/components.css`
- `BUMP_NOTES.md`

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

## Permissions Key Chip Width/Case Tweak - 2026-04-02

### Technical Notes

- Narrowed the follow-up change to `.ss-permissions-row-key` in `docs/css/components.css` only.
- The permission-key chip now uses slightly tighter padding, removes forced uppercase styling, and pushes the mono glyphs wider via `font-stretch` plus a touch more horizontal letter spacing so the chip reads more like a compact code token than a label pill.

### Human-Readable Notes

- Permission IDs in both role and user matrix modes now look flatter, wider, and more code-like.

### Files / Areas Touched

- `docs/css/components.css`
- `BUMP_NOTES.md`

## Task 3X - Turnstile Auth Rollout Verification - 2026-04-04

### Technical Notes

- Verified the admin login surface now uses the shared explicit-render Turnstile helper and the auth proxy path for `/auth/turnstile/config`, keeping password and OAuth login starts tied to runtime-side validation instead of client-only completion.
- Updated the repo tree so the newly created `docs/js/turnstile-inline.js` helper and `docs/runtime/exports/status.json` mirror are represented in the root README after they were added by the interrupted rollout.

### Human-Readable Notes

- The admin login entrypoint now includes the inline Cloudflare Turnstile checkpoint without switching to a fullscreen challenge flow, and the repo docs now actually reflect the files that were added for that rollout.

### Files / Areas Touched

- `README.md`
- `BUMP_NOTES.md`

### Risks / Follow-Ups

- The dashboard still depends on the mirrored runtime export set under `docs/runtime/exports/`; stale mirrored assets can make the surface look older than the runtime auth contract it is calling.

## Task 3Y - Admin Auth Surface Repair Pass - 2026-04-05

### Technical Notes

- Added inline Turnstile markup plus standalone wiring to `docs/auth/login.html` and `docs/js/admin-login.js`, so admin OAuth starts and password login now both require a fresh token from `/auth/turnstile/config` before continuing.

## Task 3Z - Auth Surface Login Repair Follow-up - 2026-04-05

### Technical
- Fixed the live admin `/auth/login` Turnstile regression at the page entrypoint by deferring `docs/js/admin-login.js` so it runs after `docs/js/turnstile-inline.js`, instead of constructing the controller before the helper exists.
- Replaced the old `Elsewhere` alternate-surface strip with a collapsed `Login to other surfaces` section on `docs/auth/login.html`, `docs/index.html`, and the repo-root `index.html`, and added the supporting `ss-public.svg`, `ss-creator.svg`, `ss-admin.svg`, and `ss-developer.svg` assets under `docs/assets/icons/ui/`.
- Updated `tests/admin-auth-turnstile.test.mjs` to assert the corrected standalone login script order plus the new collapsed alternate-surface wording across the admin login and overlay surfaces.

### Human
- The admin login page now starts the inline Turnstile reliably without changing the existing auth flow.
- The old `Elsewhere` wording was removed because it looked like placeholder UI and did not present the alternate destinations as a discreet secondary action.
- Added the same small alternate-surface login strip to the standalone admin login surface and mirrored the Turnstile/alternate-link markup into the dashboard overlay shell so the modal structure no longer diverges from the repaired standalone page.
- Added a lightweight source-audit regression at `tests/admin-auth-turnstile.test.mjs` covering the standalone login wiring and overlay parity markup.

### Human-Readable Notes

- The admin login page now has the same inline Turnstile protection as the other repaired login surfaces.
- Admin login surfaces now expose the same minimal links to Public, Creator, and Developer login routes instead of the earlier one-off Creator-only link.

### Files / Areas Touched

- `docs/auth/login.html`
- `docs/js/admin-login.js`
- `docs/index.html`
- `index.html`
- `docs/css/base.css`
- `tests/admin-auth-turnstile.test.mjs`
- `README.md`
- `BUMP_NOTES.md`

### Risks / Follow-Ups

- The dashboard repo still contains older parallel auth scaffolding; a later cleanup pass should decide whether to remove or consolidate the unused admin auth codepaths rather than letting duplicate surface markup drift.

# Bump Notes

## CURRENT VER= 0.4.1-alpha / PENDING VER= 0.4.2-alpha

### Technical Notes

- Repo-local version markers that mirror runtime authority still show `0.4.1-alpha` in `runtime/version.py`, `runtime/exports/version.json`, and `docs/runtime/exports/version.json`.
- Recent admin alerts work in `docs/js/analytics-alerting.js` added tokenized template entry for backend-owned title and message fields, plus checkbox-based multi-surface filtering so rule scope editing matches the newer runtime alert contract.
- Admin shell updates in `docs/js/app.js` and related icon assets continue the route/layout cleanup work that keeps the dedicated Alerts workspace separate from Analytics while preserving the shared dashboard shell.
- `README.md` is already staged as `v0.4.2-alpha`, so the repo currently reflects release-prep documentation ahead of the copied runtime/export version markers.

### Human-Readable Notes

- Alerts are now treated as their own admin workspace rather than feeling like a narrow Analytics subpanel.
- Rule editing is easier to reason about because placeholders are visible as tokens and scope selection matches the real backend shape more closely.
- Sidebar and shell polish continued alongside the alerting work so the admin surface reflects the routing/layout cleanup already visible in the repo.

### Files / Areas Touched

- `docs/js/analytics-alerting.js`
- `docs/js/app.js`
- `docs/css/components.css`
- `docs/runtime/exports/version.json`
- `runtime/version.py`
- `README.md`

### Follow-Ups / Risks

- Keep the dashboard placeholder picker and surface labels aligned with the authoritative runtime alert-variable catalog during the actual version bump and release-note pass.
- Resolve the README `v0.4.2-alpha` prep state against the still-copied `0.4.1-alpha` runtime/export files when the real bump lands.

## 2026-03-20

- Added a tokenized placeholder editor for alert title/message composition in the Alerts admin page.
- Exact supported placeholder strings now auto-convert into inline tokens while preserving the backend raw template format.
- Replaced the single-surface scope selector with checkbox-based multi-surface filtering in the Alerts rule editor.

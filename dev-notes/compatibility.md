# Runtime Compatibility Notes

## Discord Integration (Planned)

- **Guild-based configuration:** Discord runtimes will read the same schemas per guild/server, keeping dashboard edits authoritative without per-guild forks.
- **Status reporting:** Bot presence/health is intended to be surfaced in the dashboard; a heartbeat endpoint is planned but not yet implemented.
- **Command parity:** Command sets exposed via Discord should mirror dashboard-visible capabilities to avoid drift between control surfaces.

## Authentication Constraints

- **GitHub Pages limitations:** The dashboard currently ships as static assets with no server-side execution, preventing secure secret storage or OAuth redirects.
- **OAuth deferral:** OAuth and token brokering are postponed until the Wix Studio migration provides a controlled, authenticated backend surface.

## Rumble Platform Status

- **API state:** The Rumble runtime is blocked by an upstream DDoS protection layer that currently prevents bot operation.
- **Support posture:** All Rumble-specific features are paused but not removed; schemas remain intact and should not be pruned.
- **Resume plan:** Re-enablement will occur once the platform’s API access stabilizes, without expected schema rewrites.

## YouTube Platform Status

- **Dashboard scaffold:** A static YouTube view is available for configuration visibility; it does not initiate runtime calls.
- **Runtime ownership:** Chat ingestion, livestream tracking, and message dispatch remain in the StreamSuites runtime repo; the dashboard only reflects exported snapshots when present.
- **Hydration posture:** Offline/“not connected” states are expected until runtime exports are wired; schema alignment is documented in `schemas/platform/youtube.schema.json`.

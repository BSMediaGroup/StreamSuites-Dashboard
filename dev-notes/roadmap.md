# Roadmap Milestones

- **Phase: Twitch Foundations (current)**
  - Add deterministic dashboard scaffolds for Twitch configuration visibility
  - Keep runtime connectivity optional and read-only (no live bot control)
  - Lay groundwork for trigger registry surfacing in a later phase

- **Phase: Discord Runtime Integration**
  - Wire shared schemas into Discord runtime consumption paths
  - Introduce planned heartbeat/status surface for bot visibility in the dashboard (not yet implemented)
  - Preserve static hosting while documenting planned backend touchpoints

- **Phase: Dashboard ↔ Discord Parity**
  - Align dashboard-visible controls with Discord command sets to avoid drift
  - Surface bot state in the dashboard UI without altering current static behavior
  - Keep Rumble command surfaces paused while maintaining schema fidelity

- **Phase: YouTube + Twitch Runtime Hydration (next)**
  - Allow dashboard surfaces to consume exported runtime snapshots for Twitch and YouTube
  - Keep read-only stance while aligning schema shapes across platforms
  - Reuse the same static hosting model and CSS

- **Phase: Wix Studio Migration**
  - Move hosting from GitHub Pages to Wix Studio to enable authenticated backends
  - Introduce OAuth/token handling in Wix while keeping dashboard artifacts static-friendly
  - Maintain embed-friendly constraints for downstream sites

- **Phase: Rumble Re-enable (pending platform fix)**
  - Resume runtime execution once DDoS protection layers are relaxed or API access is restored
  - Keep schemas unchanged; validate dashboards remain compatible
  - Reintroduce bot visibility alongside Discord parity milestones

# Roadmap Milestones

- **Phase: Local Admin Priority (active)**
  - Advance the WinForms Desktop Admin as the privileged local control plane and primary administrative surface
  - Keep the web dashboard downstream/read-only with versioning driven by runtime exports
  - Continue path management and configuration work to keep exports discoverable to local and downstream consumers

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
  - Keep Rumble surfaces documented while ingest modes (SSE + DOM/API fallbacks) settle and schemas remain stable

- **Phase: YouTube + Twitch Runtime Hydration (next)**
  - Allow dashboard surfaces to consume exported runtime snapshots for Twitch and YouTube
  - Keep read-only stance while aligning schema shapes across platforms
  - Reuse the same static hosting model and CSS
  - Ship static YouTube scaffold ahead of runtime hydration

- **Phase: Wix Studio Migration**
  - Move hosting from GitHub Pages to Wix Studio to enable authenticated backends
  - Introduce OAuth/token handling in Wix while keeping dashboard artifacts static-friendly
  - Maintain embed-friendly constraints for downstream sites

- **Phase: Rumble Ingest Resilience (in progress)**
  - Prefer SSE at `https://web7.rumble.com/chat/api/chat/{CHAT_ID}/stream` while supporting DOM-based and API polling fallbacks
  - Keep schemas unchanged; validate dashboards remain compatible as ingest modes shift
  - Export runtime state for dashboard hydration once the multi-path pipeline is stable

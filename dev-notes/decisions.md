# Decisions — Twitch Foundations

- Twitch visibility is scaffolded in the dashboard first; runtime execution remains owned by the main StreamSuites repository.
- Dashboard surfaces are deterministic and offline-friendly — show explicit “No runtime connected” when no Twitch snapshot is present.
- Platform sequencing: Twitch foundation first, YouTube hydration next, Rumble alignment after upstream access is restored.
- A static YouTube scaffold is now present in the dashboard; it mirrors planned runtime visibility without enabling live bot control.

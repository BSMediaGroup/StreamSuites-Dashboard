# StreamSuites Dashboard Shared State

This directory holds JSON snapshots that the static dashboard fetches at runtime.

* `discord/runtime.json` – Control-plane heartbeat snapshot for the Discord bot. The dashboard polls this file to show connection state and presence information. Replace the placeholder values with the live runtime output from your deployment pipeline so the dashboard reflects the current bot status.
* `jobs.json` – (optional) Background job metrics consumed by the jobs view (`docs/views/jobs.html`). If not provided, the view will show an error banner.

Keeping placeholder files in source control avoids 404 errors on GitHub Pages while still allowing deploy pipelines to overwrite the contents with real data.

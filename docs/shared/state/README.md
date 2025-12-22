# StreamSuites Dashboard Shared State

This directory holds JSON snapshots that the static dashboard fetches at runtime.

* `discord/runtime.json` – Control-plane heartbeat snapshot for the Discord bot. The dashboard polls this file to show connection state and presence information. Replace the placeholder values with the live runtime output from your deployment pipeline so the dashboard reflects the current bot status.
* `jobs.json` – (optional) Background job metrics consumed by the jobs view (`docs/views/jobs.html`). If not provided, the view will show an error banner.
* `clips.json` – (optional) Exported clip lifecycle data (queued → encoding → encoded → uploading → published or failed). The clips view (`docs/views/clips.html`) polls this snapshot and surfaces every entry, including pending and failed clips.

Keeping placeholder files in source control avoids 404 errors on GitHub Pages while still allowing deploy pipelines to overwrite the contents with real data.

## State root overrides

The dashboard first looks for snapshots in `./shared/state/` (the published site) and then falls back to the runtime repository’s copy at:

```
https://raw.githubusercontent.com/BSMediaGroup/StreamSuites/main/shared/state/
```

You can override the state root (for local testing or staging buckets) by appending a `stateRoot` query param:

```
https://bsmediagroup.github.io/StreamSuites-Dashboard/?stateRoot=https://example.com/state/
```

The override is cached in `localStorage` as `streamsuites.stateRootOverride` so you only need to set it once per browser.

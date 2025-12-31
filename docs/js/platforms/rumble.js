(() => {
  "use strict";

  const PLATFORM = "rumble";
  const REFRESH_INTERVAL = 8000;

  const el = {};
  let runtimeTimer = null;

  function cacheElements() {
    el.foundationStatus = document.getElementById("rumble-foundation-status");
    el.runtimeBanner = document.getElementById("rumble-runtime-banner");
    el.runtimeStatus = document.getElementById("rumble-runtime-status");
    el.runtimeUpdated = document.getElementById("rumble-runtime-updated");
    el.runtimeError = document.getElementById("rumble-runtime-error");
    el.runtimeMessages = document.getElementById("rumble-runtime-messages");
    el.runtimeTriggers = document.getElementById("rumble-runtime-triggers");

    el.configEnabled = document.getElementById("rumble-config-enabled");
    el.configChannel = document.getElementById("rumble-config-channel");
    el.configBot = document.getElementById("rumble-config-bot");
    el.configSource = document.getElementById("rumble-config-source");
  }

  function setText(target, value) {
    if (!target) return;
    target.textContent = value;
  }

  function formatTimestamp(value) {
    return (
      window.StreamSuitesState?.formatTimestamp?.(value) ||
      value ||
      "not reported"
    );
  }

  function hydrateConfig() {
    setText(el.configEnabled, "deferred (runtime-owned)");
    setText(el.configChannel, "exposed via runtime exports only");
    setText(el.configBot, "runtime-managed");
    setText(el.configSource, "read-only dashboard snapshot");
  }

  function hydrateRuntimePlaceholder() {
    setText(el.runtimeStatus, "deferred");
    setText(el.runtimeUpdated, "waiting for runtime export");
    setText(el.runtimeError, "none reported");
    setText(el.runtimeMessages, "—");
    setText(el.runtimeTriggers, "—");

    if (el.runtimeBanner) {
      el.runtimeBanner.classList.remove("ss-alert-success");
      el.runtimeBanner.classList.add("ss-alert-warning");
      setText(
        el.runtimeBanner,
        "Rumble runtime visibility is deferred. Dashboard surfaces the last exported snapshot only."
      );
    }
  }

  function describeRuntimeStatus(entry) {
    if (!entry) return "deferred";
    if (entry.enabled === false) return "disabled";
    return entry.status || "unknown";
  }

  function renderRuntime(snapshot) {
    const platform = snapshot?.platforms?.[PLATFORM] || null;
    const status = describeRuntimeStatus(platform);

    setText(el.runtimeStatus, status.toUpperCase());
    setText(
      el.runtimeUpdated,
      formatTimestamp(platform?.lastUpdate || snapshot?.generatedAt)
    );
    setText(el.runtimeError, platform?.error || "none reported");

    const counters = platform?.counters || {};
    const messages = counters.messagesProcessed ?? counters.messages ?? null;
    const triggers = counters.triggersFired ?? counters.triggers ?? null;

    setText(
      el.runtimeMessages,
      Number.isFinite(messages) ? messages.toLocaleString() : "—"
    );
    setText(
      el.runtimeTriggers,
      Number.isFinite(triggers) ? triggers.toLocaleString() : "—"
    );

    if (el.runtimeBanner) {
      el.runtimeBanner.classList.remove("ss-alert-danger");
      el.runtimeBanner.classList.add(
        status && status.toLowerCase() === "running" ? "ss-alert-success" : "ss-alert-warning"
      );
      setText(
        el.runtimeBanner,
        "Rumble ingest is deferred; this panel mirrors the latest exported runtime snapshot without issuing commands."
      );
    }
  }

  async function hydrateRuntime() {
    const snapshot = await window.StreamSuitesState?.loadRuntimeSnapshot?.();
    if (!snapshot || !snapshot.platforms) {
      hydrateRuntimePlaceholder();
      return;
    }

    renderRuntime(snapshot);
  }

  function startRuntimePolling() {
    hydrateRuntime();
    runtimeTimer = setInterval(hydrateRuntime, REFRESH_INTERVAL);
  }

  function setFoundationStatus() {
    if (!el.foundationStatus) return;
    el.foundationStatus.classList.remove("idle");
    el.foundationStatus.classList.add("active");
    el.foundationStatus.textContent = "● Rumble: Deferred (read-only preview)";
  }

  function init() {
    cacheElements();
    setFoundationStatus();
    hydrateConfig();
    hydrateRuntimePlaceholder();
    startRuntimePolling();
  }

  function destroy() {
    if (runtimeTimer) {
      clearInterval(runtimeTimer);
      runtimeTimer = null;
    }
  }

  window.RumbleView = {
    init,
    destroy
  };
})();

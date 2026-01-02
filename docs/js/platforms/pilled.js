(() => {
  "use strict";

  const PLATFORM = "pilled";
  const REFRESH_INTERVAL = 6000;

  const el = {};
  let runtimeTimer = null;

  function cacheElements() {
    el.foundationStatus = document.getElementById("pilled-foundation-status");
    el.runtimeBanner = document.getElementById("pilled-runtime-banner");
    el.runtimeStatus = document.getElementById("pilled-runtime-status");
    el.runtimeUpdated = document.getElementById("pilled-runtime-updated");
    el.runtimeError = document.getElementById("pilled-runtime-error");
    el.runtimeMessages = document.getElementById("pilled-runtime-messages");
    el.runtimeTriggers = document.getElementById("pilled-runtime-triggers");

    el.configMode = document.getElementById("pilled-config-mode");
    el.configCreators = document.getElementById("pilled-config-creators");
    el.configSource = document.getElementById("pilled-config-source");
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

  async function loadCreatorsDraft() {
    try {
      return (
        (await window.ConfigState?.loadCreators?.()) ||
        []
      );
    } catch (err) {
      const creators =
        window.App?.storage?.loadFromLocalStorage?.("creators", []) || [];
      return Array.isArray(creators) ? creators : [];
    }
  }

  async function hydrateConfig() {
    const creatorsArr = await loadCreatorsDraft();
    const platforms =
      (await window.ConfigState?.loadPlatforms?.()) || null;
    const platformConfig = platforms?.platforms?.pilled;

    const enabledCreators = Array.isArray(creatorsArr)
      ? creatorsArr.filter((creator) => {
        const pilled = creator?.platforms?.pilled;
        return pilled === true || pilled?.enabled === true;
      })
      : [];

    setText(
      el.configMode,
      platformConfig?.enabled === true
        ? "ingest-only (planned)"
        : "ingest-only (planned)"
    );
    setText(
      el.configCreators,
      enabledCreators.length > 0
        ? `${enabledCreators.length} creator${enabledCreators.length > 1 ? "s" : ""}`
        : "none configured"
    );
    setText(
      el.configSource,
      platformConfig?.notes
        ? platformConfig.notes
        : "awaiting runtime export"
    );
  }

  function hydrateRuntimePlaceholder() {
    setText(el.runtimeStatus, "planned / offline");
    setText(el.runtimeUpdated, "no runtime snapshot yet");
    setText(el.runtimeError, "not reported");
    setText(el.runtimeMessages, "—");
    setText(el.runtimeTriggers, "—");

    if (el.runtimeBanner) {
      el.runtimeBanner.classList.add("ss-alert-warning");
      el.runtimeBanner.classList.remove("hidden", "ss-alert-success", "ss-alert-danger");
      setText(
        el.runtimeBanner,
        `Planned ingest-only view. Runtime exports will render here; dashboard remains read-only (${App.mode?.current || "static"} mode).`
      );
    }
  }

  function describeRuntimeStatus(entry) {
    if (!entry) return "planned";
    if (entry.enabled === false) return "disabled";
    return entry.status || "planned";
  }

  function renderRuntime(snapshot) {
    const platform = snapshot?.platforms?.[PLATFORM] || null;
    const status = describeRuntimeStatus(platform);
    setText(el.runtimeStatus, status.toUpperCase());

    const updated = formatTimestamp(
      platform?.lastUpdate || snapshot?.generatedAt
    );
    setText(el.runtimeUpdated, updated);

    setText(
      el.runtimeError,
      platform?.error || "none reported"
    );

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
      el.runtimeBanner.classList.remove("ss-alert-danger", "ss-alert-success");
      el.runtimeBanner.classList.add("ss-alert-warning");
      setText(
        el.runtimeBanner,
        `Read-only preview sourced from runtime exports (shared/state → data fallback). Mode: ${App.mode?.current || "static"}.`
      );
    }
  }

  async function hydrateRuntime() {
    const runtimeState = window.App?.state?.runtimeSnapshot;

    if (runtimeState?.fetchOnce && !runtimeState.getSnapshot?.()) {
      await runtimeState.fetchOnce();
    }

    const snapshot = runtimeState?.getSnapshot?.();

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
    el.foundationStatus.classList.remove("idle", "active");
    el.foundationStatus.classList.add("warning");
    el.foundationStatus.textContent = "● Pilled integration: Planned";
  }

  async function init() {
    cacheElements();
    setFoundationStatus();
    await hydrateConfig();
    hydrateRuntimePlaceholder();
    startRuntimePolling();
  }

  function destroy() {
    if (runtimeTimer) {
      clearInterval(runtimeTimer);
      runtimeTimer = null;
    }
  }

  window.PilledView = {
    init,
    destroy
  };
})();

(() => {
  "use strict";

  const PLATFORM = "pilled";
  const REFRESH_INTERVAL = 6000;

  const el = {};
  let runtimeTimer = null;
  let currentMode = null;
  let lastRuntimeSnapshot = null;
  let modeListener = null;

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
    el.configControl = document.getElementById("pilled-config-control");
    el.configSource = document.getElementById("pilled-config-source");
  }

  function setText(target, value) {
    if (!target) return;
    target.textContent = value;
  }

  function lockControls() {
    const scope = document.getElementById("view-container");
    if (!scope) return;

    scope.querySelectorAll("input, select, textarea, button").forEach((node) => {
      node.disabled = true;
      node.setAttribute("aria-disabled", "true");
    });
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
        ? "ingest-only (locked preview)"
        : "ingest-only (locked preview)"
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

    setText(
      el.configControl,
      platformConfig?.enabled === false
        ? "disabled (control-plane unavailable)"
        : "not available (ingest-only)"
    );
  }

  function hydrateRuntimePlaceholder(snapshot = null) {
    lastRuntimeSnapshot = snapshot;
    const plannedLabel = "PLANNED — INGEST / REPLAY ONLY";
    const updatedAt = snapshot?.generatedAt || snapshot?.generated_at || snapshot?.timestamp;

    setText(el.runtimeStatus, plannedLabel);
    setText(el.runtimeUpdated, updatedAt ? formatTimestamp(updatedAt) : "no runtime snapshot yet");
    setText(el.runtimeError, "read-only placeholder (no runtime writes)");
    setText(el.runtimeMessages, "—");
    setText(el.runtimeTriggers, "—");

    if (el.runtimeBanner) {
      el.runtimeBanner.classList.add("ss-alert-warning");
      el.runtimeBanner.classList.remove("hidden", "ss-alert-success", "ss-alert-danger");
      const modeLabel = currentMode?.current || "static";
      const snapshotNote = snapshot ? "Runtime export detected; placeholders only." : "Awaiting runtime export.";
      setText(
        el.runtimeBanner,
        `${plannedLabel}. ${snapshotNote} Mode: ${modeLabel}.`
      );
    }
  }

  function describeRuntimeStatus(entry) {
    if (!entry) return "planned";
    if (entry.enabled === false) return "disabled";
    return entry.status || entry.state || "planned";
  }

  function selectPlatform(snapshot) {
    if (!snapshot || !snapshot.platforms) return null;
    if (Array.isArray(snapshot.platforms)) {
      return snapshot.platforms.find((p) => p.platform === PLATFORM || p.name === PLATFORM) || null;
    }
    return snapshot.platforms[PLATFORM] || null;
  }

  function resolveCounterValue(counters, keys) {
    for (const key of keys) {
      if (typeof counters[key] === "number") return counters[key];
    }
    return null;
  }

  function renderRuntime(snapshot) {
    const normalized = window.StreamSuitesState?.normalizeRuntimeSnapshot?.(snapshot);
    hydrateRuntimePlaceholder(normalized || snapshot || null);
  }

  async function hydrateRuntime() {
    const runtimeState = window.App?.state?.runtimeSnapshot;

    if (runtimeState?.fetchOnce && !runtimeState.getSnapshot?.()) {
      await runtimeState.fetchOnce();
    }

    let snapshot = runtimeState?.getSnapshot?.();

    if (!snapshot) {
      try {
        snapshot = await window.StreamSuitesState?.loadRuntimeSnapshot?.({ forceReload: true });
      } catch (err) {
        console.warn("[PilledView] Runtime snapshot load failed", err);
      }
    }

    if (!snapshot) {
      hydrateRuntimePlaceholder();
      return;
    }

    lastRuntimeSnapshot = snapshot;
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
    el.foundationStatus.textContent = "● Pilled integration: Ingest-only (planned)";
  }

  function onModeChange(modeState) {
    currentMode = modeState || currentMode;
    if (lastRuntimeSnapshot) {
      renderRuntime(lastRuntimeSnapshot);
    } else {
      hydrateRuntimePlaceholder();
    }
  }

  async function init(modeState) {
    cacheElements();
    currentMode = modeState || window.App?.mode || { current: "static", reason: "static-first default" };
    setFoundationStatus();
    lockControls();
    if (!modeListener) {
      modeListener = (event) => onModeChange(event.detail);
      window.addEventListener("streamsuites:modechange", modeListener);
    }
    await hydrateConfig();
    hydrateRuntimePlaceholder();
    startRuntimePolling();
  }

  function destroy() {
    if (runtimeTimer) {
      clearInterval(runtimeTimer);
      runtimeTimer = null;
    }

    if (modeListener) {
      window.removeEventListener("streamsuites:modechange", modeListener);
      modeListener = null;
    }
  }

  window.PilledView = {
    init,
    destroy,
    onModeChange
  };
})();

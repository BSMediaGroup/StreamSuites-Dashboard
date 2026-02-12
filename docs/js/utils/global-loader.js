(() => {
  "use strict";

  const SHOW_DELAY_MS = 120;
  const STUCK_THRESHOLD_MS = 12500;

  const state = {
    active: new Map(),
    nextId: 0,
    showTimer: null,
    stuckTimer: null,
    visible: false,
    stuck: false,
    root: null,
    text: null
  };

  function cacheElements() {
    if (!state.root) {
      state.root = document.getElementById("global-loader");
    }
    if (!state.text) {
      state.text = document.getElementById("global-loader-text");
    }
    return Boolean(state.root);
  }

  function clearTimer(key) {
    if (!state[key]) return;
    clearTimeout(state[key]);
    state[key] = null;
  }

  function getActiveReason() {
    const first = state.active.values().next().value;
    return first?.reason || "Loading...";
  }

  function syncA11y(isActive, label) {
    const main = document.getElementById("app-main");
    if (main) {
      main.setAttribute("aria-busy", isActive ? "true" : "false");
    }

    if (!cacheElements()) return;
    state.root.setAttribute("aria-hidden", isActive ? "false" : "true");
    state.root.setAttribute("aria-label", label);
  }

  function render() {
    if (!cacheElements()) return;

    const isActive = state.active.size > 0;
    const ariaLabel = isActive
      ? (state.stuck ? "Still loading..." : getActiveReason())
      : "Idle";

    state.root.classList.toggle("is-active", state.visible);
    state.root.classList.toggle("is-stuck", state.visible && state.stuck);

    if (state.text) {
      state.text.textContent = state.stuck ? "Still loading..." : "Loading...";
    }

    syncA11y(isActive, ariaLabel);
  }

  function scheduleShow() {
    clearTimer("showTimer");
    if (state.visible) return;
    state.showTimer = setTimeout(() => {
      state.showTimer = null;
      if (!state.active.size) return;
      state.visible = true;
      render();
    }, SHOW_DELAY_MS);
  }

  function scheduleStuckGuard() {
    clearTimer("stuckTimer");
    state.stuckTimer = setTimeout(() => {
      state.stuckTimer = null;
      if (!state.active.size) return;
      state.stuck = true;
      state.visible = true;
      render();
    }, STUCK_THRESHOLD_MS);
  }

  function clearUiState() {
    clearTimer("showTimer");
    clearTimer("stuckTimer");
    state.visible = false;
    state.stuck = false;
    render();
  }

  function startLoading(reason = "Loading...") {
    const token = `ss-loader-${Date.now()}-${++state.nextId}`;
    state.active.set(token, {
      reason: typeof reason === "string" && reason.trim() ? reason.trim() : "Loading...",
      startedAt: Date.now()
    });

    if (state.active.size === 1) {
      state.stuck = false;
      scheduleShow();
      scheduleStuckGuard();
      syncA11y(true, getActiveReason());
    }

    return token;
  }

  function stopLoading(token) {
    if (typeof token === "string" && state.active.has(token)) {
      state.active.delete(token);
    } else if (state.active.size > 0 && token == null) {
      const firstKey = state.active.keys().next().value;
      state.active.delete(firstKey);
    }

    if (state.active.size === 0) {
      clearUiState();
      return;
    }

    render();
  }

  async function trackAsync(task, reason = "Loading...") {
    const token = startLoading(reason);
    try {
      if (typeof task === "function") {
        return await task();
      }
      return await task;
    } finally {
      stopLoading(token);
    }
  }

  window.StreamSuitesGlobalLoader = {
    startLoading,
    stopLoading,
    trackAsync,
    getActiveCount() {
      return state.active.size;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      render();
      syncA11y(false, "Idle");
    }, { once: true });
  } else {
    render();
    syncA11y(false, "Idle");
  }
})();

(() => {
  "use strict";

  const PLATFORM = "rumble";
  const REFRESH_INTERVAL = 8000;
  const BOTS_STATUS_ENDPOINT = "/api/admin/bots/status";

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
    el.runtimeBlocked = document.getElementById("rumble-runtime-blocked");
    el.runtimeManual = document.getElementById("rumble-runtime-manual");
    el.serviceToggle = document.querySelector('input[data-service="rumble"]');
  }

  function resolveApiBase() {
    const base =
      window.StreamSuitesAdminAuth?.config?.baseUrl ||
      document.querySelector('meta[name="streamsuites-auth-base"]')?.getAttribute("content") ||
      "";
    return base ? String(base).replace(/\/+$/, "") : "";
  }

  function buildApiUrl(path) {
    const base = resolveApiBase();
    if (!base) return path;
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalized}`;
  }

  async function readJsonSafe(response) {
    try {
      return await response.json();
    } catch (_err) {
      return null;
    }
  }

  async function requestJson(path) {
    const response = await fetch(buildApiUrl(path), {
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await readJsonSafe(response);
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
    }
    return payload || {};
  }

  function setText(target, value) {
    if (!target) return;
    target.textContent = value;
  }

  function formatTimestamp(value) {
    return window.StreamSuitesState?.formatTimestamp?.(value) || value || "—";
  }

  function normalizePlatformRow(payload) {
    const rows = Array.isArray(payload?.platforms) ? payload.platforms : [];
    return rows.find((item) => String(item?.platform || "").trim().toLowerCase() === PLATFORM) || null;
  }

  function normalizeRumbleBots(payload) {
    return (Array.isArray(payload?.bots) ? payload.bots : []).filter(
      (item) => String(item?.platform || "").trim().toLowerCase() === PLATFORM
    );
  }

  function describeStatus(platformRow) {
    const status = String(platformRow?.status || "").trim().toLowerCase();
    switch (status) {
      case "connected":
        return "Enabled / connected";
      case "managed_pending":
        return "Enabled / awaiting attach";
      case "blocked":
        return "Enabled / blocked";
      case "paused":
        return "Manually paused";
      case "ready":
        return "Enabled / ready";
      case "not_configured":
        return "Runtime not configured";
      case "staged":
        return "Staged";
      case "error":
        return "Runtime error";
      default:
        return status ? status.replace(/_/g, " ") : "Unknown";
    }
  }

  function bannerTone(platformRow) {
    const status = String(platformRow?.status || "").trim().toLowerCase();
    if (status === "connected" || status === "ready") return "success";
    if (status === "managed_pending" || status === "blocked" || status === "paused") return "warning";
    return "danger";
  }

  function bannerCopy(platformRow, bots) {
    const details = platformRow?.details && typeof platformRow.details === "object" ? platformRow.details : {};
    const blockedCount = Number(details.bot_blocked_count || 0);
    const pendingCount = Number(details.bot_desired_count || 0);
    const connectedCount = Number(details.bot_online_count || 0);
    const manualOverrideCount = Number(details.manual_override_count || 0);
    const detail = String(platformRow?.error || platformRow?.paused_reason || "").trim();

    switch (String(platformRow?.status || "").trim().toLowerCase()) {
      case "connected":
        return `${connectedCount} Rumble session${connectedCount === 1 ? "" : "s"} is currently connected in the runtime.`;
      case "managed_pending":
        return `${pendingCount} managed Rumble session${pendingCount === 1 ? "" : "s"} is enabled and still working toward attachment.`;
      case "blocked":
        return detail || `${blockedCount} enabled Rumble session${blockedCount === 1 ? "" : "s"} is currently blocked by runtime prerequisites.`;
      case "paused":
        return detail || "Rumble is manually paused by runtime control.";
      case "ready":
        return bots.length
          ? "Rumble is runtime-enabled with no active connected session right now."
          : "Rumble is runtime-enabled and ready for testing.";
      case "not_configured":
        return detail || "Runtime prerequisites for Rumble are not fully configured.";
      case "error":
        return detail || "Runtime reported an error while evaluating Rumble posture.";
      default:
        return detail || "Rumble posture is being read from the runtime bot-status contract.";
    }
  }

  function renderPayload(payload) {
    const platformRow = normalizePlatformRow(payload);
    const bots = normalizeRumbleBots(payload);
    const details = platformRow?.details && typeof platformRow.details === "object" ? platformRow.details : {};
    const managedCount = bots.filter((item) => String(item?.session_type || "").trim().toLowerCase() !== "manual").length;
    const manualCount = bots.length - managedCount;
    const connectedCount = bots.filter((item) =>
      ["online", "running", "attached", "listening"].includes(String(item?.status || "").trim().toLowerCase())
    ).length;
    const pendingCount = Number(details.bot_desired_count || 0);
    const blockedCount = Number(details.bot_blocked_count || 0);
    const pausedCount = Number(details.bot_paused_count || 0);
    const manualOverrideCount = Number(details.manual_override_count || 0);
    const enabled = platformRow?.implemented === true && platformRow?.staged !== true && platformRow?.runtime_ready !== false;

    if (el.serviceToggle instanceof HTMLInputElement) {
      el.serviceToggle.checked = enabled;
    }
    setText(el.runtimeStatus, describeStatus(platformRow));
    setText(el.runtimeUpdated, formatTimestamp(payload?.server_generated_at || payload?.generated_at));
    setText(
      el.runtimeError,
      platformRow?.error || platformRow?.paused_reason || platformRow?.disabled_reason || "No blocking detail exported."
    );
    setText(el.runtimeMessages, `${managedCount} / ${manualCount}`);
    setText(el.runtimeTriggers, `${connectedCount} / ${pendingCount}`);
    setText(el.runtimeBlocked, `${blockedCount} / ${pausedCount}`);
    setText(el.runtimeManual, String(manualOverrideCount));

    if (el.runtimeBanner) {
      el.runtimeBanner.classList.remove("ss-alert-success", "ss-alert-warning", "ss-alert-danger");
      el.runtimeBanner.classList.add(`ss-alert-${bannerTone(platformRow)}`);
      setText(el.runtimeBanner, bannerCopy(platformRow, bots));
    }

    if (el.foundationStatus) {
      const statusText = describeStatus(platformRow);
      el.foundationStatus.classList.remove("idle");
      el.foundationStatus.classList.add("active");
      el.foundationStatus.textContent = `● Rumble runtime: ${statusText}`;
    }
  }

  function renderLoadFailure(message) {
    const detail = message || "Unable to load runtime bot posture.";
    if (el.serviceToggle instanceof HTMLInputElement) {
      el.serviceToggle.checked = false;
    }
    setText(el.runtimeStatus, "Load failed");
    setText(el.runtimeUpdated, "—");
    setText(el.runtimeError, detail);
    setText(el.runtimeMessages, "0 / 0");
    setText(el.runtimeTriggers, "0 / 0");
    setText(el.runtimeBlocked, "0 / 0");
    setText(el.runtimeManual, "0");
    if (el.runtimeBanner) {
      el.runtimeBanner.classList.remove("ss-alert-success", "ss-alert-warning");
      el.runtimeBanner.classList.add("ss-alert-danger");
      setText(el.runtimeBanner, detail);
    }
    if (el.foundationStatus) {
      el.foundationStatus.classList.remove("active");
      el.foundationStatus.classList.add("idle");
      el.foundationStatus.textContent = "● Rumble runtime: Load failed";
    }
  }

  async function hydrateRuntime() {
    try {
      const payload = await requestJson(BOTS_STATUS_ENDPOINT);
      renderPayload(payload);
    } catch (err) {
      renderLoadFailure(err?.message || "Unable to load runtime bot posture.");
    }
  }

  function startRuntimePolling() {
    void hydrateRuntime();
    runtimeTimer = window.setInterval(() => {
      void hydrateRuntime();
    }, REFRESH_INTERVAL);
  }

  function init() {
    cacheElements();
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
    destroy,
  };
})();

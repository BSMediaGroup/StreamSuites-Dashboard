/* ============================================================
   StreamSuites Dashboard - Bots view (admin/debug)
   ============================================================ */

(() => {
  "use strict";

  const POLL_INTERVAL_MS = 5000;
  const PRIMARY_RUNTIME_PATH = "/runtime/exports/bots/status.json";
  const MANUAL_DEPLOY_ENDPOINT = "/api/admin/runtime/manual-deploy";

  const state = {
    pollHandle: null,
    tickHandle: null,
    lastPayload: null,
    lastReceivedAt: null,
    sourceUrl: null,
    rowUi: Object.create(null),
    onBodyClick: null
  };

  const el = {
    status: null,
    count: null,
    generatedAt: null,
    source: null,
    error: null,
    body: null,
    empty: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return "-";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function encodeData(value) {
    return encodeURIComponent(String(value || ""));
  }

  function decodeData(value) {
    try {
      return decodeURIComponent(String(value || ""));
    } catch (err) {
      return String(value || "");
    }
  }

  function formatTimestamp(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    try {
      return date.toLocaleString(undefined, { hour12: false });
    } catch (err) {
      return String(value);
    }
  }

  function asFiniteNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  function formatUptime(seconds) {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const days = Math.floor(safe / 86400);
    const hours = Math.floor((safe % 86400) / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;

    if (days > 0) return `${days}d ${hours}h ${mins}m ${secs}s`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  function resolveBasePath() {
    return (
      (window.Versioning &&
        typeof window.Versioning.resolveBasePath === "function" &&
        window.Versioning.resolveBasePath()) ||
      window.ADMIN_BASE_PATH ||
      ""
    );
  }

  function resolveApiBase() {
    const base =
      window.StreamSuitesAdminAuth?.config?.baseUrl ||
      document.querySelector('meta[name="streamsuites-auth-base"]')?.getAttribute("content") ||
      "";
    return base ? base.replace(/\/$/, "") : "";
  }

  function buildApiUrl(path) {
    const base = resolveApiBase();
    if (!base) return path;
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalized}`;
  }

  function buildCandidateUrls() {
    const urls = [PRIMARY_RUNTIME_PATH];
    const basePath = resolveBasePath().replace(/\/$/, "");
    if (basePath) {
      urls.push(`${basePath}/runtime/exports/bots/status.json`);
    }
    urls.push("runtime/exports/bots/status.json");
    return Array.from(new Set(urls));
  }

  function normalizePayload(payload) {
    const bots = Array.isArray(payload?.bots) ? payload.bots.slice() : [];
    bots.sort((a, b) => {
      const creatorCompare = String(a?.creator_id || "").localeCompare(String(b?.creator_id || ""));
      if (creatorCompare !== 0) return creatorCompare;
      return String(a?.platform || "").localeCompare(String(b?.platform || ""));
    });

    return {
      schemaVersion: payload?.schema_version || null,
      generatedAt: payload?.generated_at || null,
      count: typeof payload?.count === "number" ? payload.count : bots.length,
      bots
    };
  }

  function statusTone(status) {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "online") return "ss-bot-status-online";
    if (normalized === "offline") return "ss-bot-status-offline";
    if (normalized === "error") return "ss-bot-status-error";
    if (normalized === "paused") return "ss-bot-status-paused";
    return "";
  }

  function statusLabel(status) {
    const text = String(status || "").trim();
    return text ? text : "-";
  }

  function renderStatus(status) {
    const tone = statusTone(status);
    const classes = ["ss-bot-status", tone].filter(Boolean).join(" ");
    return `<span class="${classes}">${escapeHtml(statusLabel(status))}</span>`;
  }

  function rowKey(creatorId, platform) {
    return `${String(creatorId || "")}::${String(platform || "").toLowerCase()}`;
  }

  function getRowUi(creatorId, platform) {
    const key = rowKey(creatorId, platform);
    if (!state.rowUi[key]) {
      state.rowUi[key] = { pending: false, pendingAction: "", error: "" };
    }
    return state.rowUi[key];
  }

  function isBotAttached(bot) {
    const status = String(bot?.status || "").trim().toLowerCase();
    const activeTarget = String(bot?.active_target || "").trim();
    const hasActiveTarget = Boolean(activeTarget && activeTarget !== "-");
    return status === "online" || status === "connecting" || hasActiveTarget;
  }

  function canAttach(bot) {
    return !isBotAttached(bot);
  }

  function canDetach(bot) {
    const status = String(bot?.status || "").trim().toLowerCase();
    if (status === "offline") return false;
    return isBotAttached(bot);
  }

  function renderManualOverride(value) {
    if (value === true) {
      return '<span class="ss-badge ss-badge-warning">Manual ON</span>';
    }
    return '<span class="ss-badge">Manual OFF</span>';
  }

  function renderActionCell(bot) {
    const creatorId = String(bot?.creator_id || "");
    const platform = String(bot?.platform || "");
    const ui = getRowUi(creatorId, platform);
    const attachDisabled = ui.pending || !canAttach(bot);
    const detachDisabled = ui.pending || !canDetach(bot);
    const attachLabel = ui.pending && ui.pendingAction === "attach" ? "Attaching..." : "Attach";
    const detachLabel = ui.pending && ui.pendingAction === "detach" ? "Detaching..." : "Detach";
    const rowError = String(ui.error || "");

    return `
      <div class="ss-bot-actions">
        <div class="ss-bot-actions-row">
          <button
            class="ss-btn ss-btn-small ss-btn-primary"
            data-bot-action="attach"
            data-creator-id="${encodeData(creatorId)}"
            data-platform="${encodeData(platform)}"
            ${attachDisabled ? "disabled" : ""}
          >${attachLabel}</button>
          <button
            class="ss-btn ss-btn-small ss-btn-danger"
            data-bot-action="detach"
            data-creator-id="${encodeData(creatorId)}"
            data-platform="${encodeData(platform)}"
            ${detachDisabled ? "disabled" : ""}
          >${detachLabel}</button>
        </div>
        <div class="ss-bot-row-error ${rowError ? "has-error" : ""}">${escapeHtml(
          rowError || "-"
        )}</div>
      </div>
    `;
  }

  function getDisplayUptimeSeconds(bot, payloadGeneratedAt, receivedAt) {
    const base = asFiniteNumber(bot?.uptime_seconds);
    if (base === null) return null;

    if (String(bot?.status || "").toLowerCase() !== "online") {
      return Math.max(0, Math.floor(base));
    }

    const generated = payloadGeneratedAt ? new Date(payloadGeneratedAt).getTime() : null;
    if (!generated || Number.isNaN(generated)) {
      return Math.max(0, Math.floor(base));
    }

    const elapsed = Math.max(0, (receivedAt - generated) / 1000);
    return Math.max(0, Math.floor(base + elapsed));
  }

  function renderRows(normalized, receivedAt) {
    const rows = normalized.bots.map((bot) => {
      const status = String(bot?.status || "").trim().toLowerCase();
      const isPaused = status === "paused";
      const lastError = bot?.last_error;
      const hasError = typeof lastError === "string" && lastError.trim() !== "";
      const uptimeSeconds = getDisplayUptimeSeconds(bot, normalized.generatedAt, receivedAt);
      const uptimeLabel = uptimeSeconds === null ? "-" : formatUptime(uptimeSeconds);
      const rowClass = isPaused ? "ss-bots-row-paused" : "";
      const errorClass = hasError ? "ss-bots-last-error has-error" : "ss-bots-last-error";

      return `
        <tr class="${rowClass}">
          <td>${escapeHtml(bot?.creator_id)}</td>
          <td>${escapeHtml(bot?.platform)}</td>
          <td>${renderStatus(bot?.status)}</td>
          <td>${escapeHtml(bot?.active_target)}</td>
          <td>${renderManualOverride(bot?.manual_override === true)}</td>
          <td>${escapeHtml(formatTimestamp(bot?.connected_at))}</td>
          <td>${escapeHtml(uptimeLabel)}</td>
          <td class="${errorClass}">${escapeHtml(hasError ? lastError : "-")}</td>
          <td>${renderActionCell(bot)}</td>
        </tr>
      `;
    });

    return rows.join("");
  }

  function setError(message) {
    if (!el.error) return;
    if (!message) {
      el.error.textContent = "";
      el.error.classList.add("hidden");
      return;
    }
    el.error.textContent = message;
    el.error.classList.remove("hidden");
  }

  function updateMeta(normalized, receivedAt) {
    if (el.count) {
      const rowCount = Array.isArray(normalized?.bots) ? normalized.bots.length : 0;
      el.count.textContent = `${rowCount} rows`;
    }
    if (el.generatedAt) {
      el.generatedAt.textContent = `Generated: ${formatTimestamp(normalized?.generatedAt)}`;
    }
    if (el.status) {
      const received = formatTimestamp(new Date(receivedAt).toISOString());
      el.status.textContent = `Live runtime snapshot (${received})`;
    }
  }

  async function fetchPayload() {
    const candidates = buildCandidateUrls();
    let lastError = null;

    for (const candidate of candidates) {
      try {
        const res = await fetch(candidate, {
          cache: "no-store",
          credentials: "include"
        });
        if (!res.ok) {
          lastError = new Error(`HTTP ${res.status}`);
          continue;
        }

        const payload = await res.json();
        state.sourceUrl = candidate;
        return normalizePayload(payload);
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("Bots status export not found.");
  }

  function render(normalized) {
    const now = Date.now();
    state.lastPayload = normalized;
    state.lastReceivedAt = now;

    if (el.source) {
      el.source.textContent = `Source: ${state.sourceUrl || PRIMARY_RUNTIME_PATH}`;
    }

    updateMeta(normalized, now);

    const hasRows = normalized && Array.isArray(normalized.bots) && normalized.bots.length > 0;

    if (el.body) {
      el.body.innerHTML = hasRows ? renderRows(normalized, now) : "";
    }
    if (el.empty) {
      el.empty.classList.toggle("hidden", hasRows);
    }
  }

  async function refresh() {
    try {
      const normalized = await fetchPayload();
      setError("");
      render(normalized);
    } catch (err) {
      if (el.status) {
        el.status.textContent = "Runtime export unavailable.";
      }
      if (el.count) {
        el.count.textContent = "-- rows";
      }
      if (el.generatedAt) {
        el.generatedAt.textContent = "Generated: --";
      }
      if (el.body) {
        el.body.innerHTML = "";
      }
      if (el.empty) {
        el.empty.classList.remove("hidden");
      }
      const detail = err?.message ? ` (${err.message})` : "";
      setError(`Unable to load bots status from runtime export${detail}`);
    }
  }

  function tick() {
    if (!state.lastPayload || !state.lastReceivedAt) return;
    if (el.body) {
      el.body.innerHTML = renderRows(state.lastPayload, Date.now());
    }
    updateMeta(state.lastPayload, state.lastReceivedAt);
  }

  async function readJsonSafe(response) {
    try {
      return await response.json();
    } catch (err) {
      return null;
    }
  }

  async function applyManualAction(action, creatorId, platform) {
    if (!state.lastPayload || !Array.isArray(state.lastPayload.bots)) return;

    const bot = state.lastPayload.bots.find(
      (entry) =>
        String(entry?.creator_id || "") === creatorId &&
        String(entry?.platform || "").toLowerCase() === platform.toLowerCase()
    );
    if (!bot) return;

    const ui = getRowUi(creatorId, platform);
    if (ui.pending) return;

    let targetIdentifier = null;
    if (action === "attach") {
      const currentTarget = String(bot?.active_target || "").trim();
      const promptDefault = currentTarget && currentTarget !== "-" ? currentTarget : "";
      const prompted = window.prompt(
        `Manual attach target for ${creatorId} (${platform}):\nEnter channel name or stream reference.`,
        promptDefault
      );
      if (prompted === null) return;
      const trimmed = String(prompted || "").trim();
      if (!trimmed) {
        ui.error = "Target identifier is required for manual attach.";
        if (el.body) {
          el.body.innerHTML = renderRows(state.lastPayload, Date.now());
        }
        return;
      }
      targetIdentifier = trimmed;
    } else if (action === "detach") {
      const currentTarget = String(bot?.active_target || "").trim();
      targetIdentifier = currentTarget && currentTarget !== "-" ? currentTarget : null;
    }

    ui.pending = true;
    ui.pendingAction = action;
    ui.error = "";
    if (el.body) {
      el.body.innerHTML = renderRows(state.lastPayload, Date.now());
    }

    try {
      const payload = {
        action,
        platform,
        creator_id: creatorId,
        target_identifier: targetIdentifier
      };

      const response = await fetch(buildApiUrl(MANUAL_DEPLOY_ENDPOINT), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorPayload = await readJsonSafe(response);
        const detail =
          errorPayload?.error ||
          errorPayload?.message ||
          `Manual ${action} failed (HTTP ${response.status}).`;
        ui.error = String(detail);
        return;
      }

      ui.error = "";
      await refresh();
    } catch (err) {
      ui.error = err?.message ? String(err.message) : `Manual ${action} failed.`;
    } finally {
      ui.pending = false;
      ui.pendingAction = "";
      if (state.lastPayload && el.body) {
        el.body.innerHTML = renderRows(state.lastPayload, Date.now());
      }
    }
  }

  function onBodyClick(event) {
    const button = event.target.closest("[data-bot-action]");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;

    const action = String(button.dataset.botAction || "").trim().toLowerCase();
    if (action !== "attach" && action !== "detach") return;

    const creatorId = decodeData(button.dataset.creatorId || "");
    const platform = decodeData(button.dataset.platform || "");
    if (!creatorId || !platform) return;

    void applyManualAction(action, creatorId, platform);
  }

  function startPolling() {
    stopPolling();
    refresh();
    state.pollHandle = setInterval(refresh, POLL_INTERVAL_MS);
    state.tickHandle = setInterval(tick, 1000);
  }

  function stopPolling() {
    if (state.pollHandle) {
      clearInterval(state.pollHandle);
      state.pollHandle = null;
    }
    if (state.tickHandle) {
      clearInterval(state.tickHandle);
      state.tickHandle = null;
    }
  }

  function init() {
    el.status = $("bots-status");
    el.count = $("bots-count");
    el.generatedAt = $("bots-generated-at");
    el.source = $("bots-source");
    el.error = $("bots-error");
    el.body = $("bots-table-body");
    el.empty = $("bots-empty");

    state.onBodyClick = onBodyClick;
    el.body?.addEventListener("click", state.onBodyClick);

    startPolling();
  }

  function destroy() {
    stopPolling();
    if (state.onBodyClick && el.body) {
      el.body.removeEventListener("click", state.onBodyClick);
    }
    state.onBodyClick = null;
    state.lastPayload = null;
    state.lastReceivedAt = null;
    state.sourceUrl = null;
    state.rowUi = Object.create(null);
  }

  window.BotsView = {
    init,
    destroy
  };
})();

/* ============================================================
   StreamSuites Dashboard - Bots view (debug, read-only)
   ============================================================ */

(() => {
  "use strict";

  const POLL_INTERVAL_MS = 5000;
  const PRIMARY_RUNTIME_PATH = "/runtime/exports/bots/status.json";

  const state = {
    pollHandle: null,
    tickHandle: null,
    lastPayload: null,
    lastReceivedAt: null,
    sourceUrl: null
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
          <td>${bot?.manual_override === true ? "Yes" : "No"}</td>
          <td>${escapeHtml(formatTimestamp(bot?.connected_at))}</td>
          <td>${escapeHtml(uptimeLabel)}</td>
          <td class="${errorClass}">${escapeHtml(hasError ? lastError : "-")}</td>
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

    startPolling();
  }

  function destroy() {
    stopPolling();
    state.lastPayload = null;
    state.lastReceivedAt = null;
    state.sourceUrl = null;
  }

  window.BotsView = {
    init,
    destroy
  };
})();

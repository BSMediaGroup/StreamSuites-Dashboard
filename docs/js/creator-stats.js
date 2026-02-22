/* ============================================================
   StreamSuites Dashboard - Creator Stats (Admin / Phase 0)
   ============================================================ */

(() => {
  "use strict";

  const CACHE = new Map();
  const QUALITY_ORDER = ["exact", "approximate", "partial", "derived", "unavailable"];
  const DELTA_WINDOWS = ["day", "week", "month", "year"];
  const DONUT_COLORS = ["#6ce1ff", "#89f7a1", "#f8c96b", "#e99fff", "#ff8f8f", "#9fb0ff"];

  const state = {
    accountId: "",
    requestToken: 0,
    boundHashChange: null
  };

  const el = {
    form: null,
    input: null,
    loadButton: null,
    refreshButton: null,
    status: null,
    banner: null,
    heading: null,
    generatedAt: null,
    empty: null,
    loading: null,
    error: null,
    sections: null,
    kpis: null,
    growthChart: null,
    shareChart: null,
    latestStream: null,
    automation: null,
    recentBody: null,
    qualityLegend: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    if (value === undefined || value === null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeAccountId(value) {
    return String(value || "").trim();
  }

  function formatNumber(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "—";
    return Math.round(num).toLocaleString();
  }

  function formatPercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "—";
    return `${(num * 100).toFixed(1)}%`;
  }

  function formatDelta(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "—";
    return `${num >= 0 ? "+" : ""}${Math.round(num).toLocaleString()}`;
  }

  function formatTimestamp(value) {
    if (!value) return "—";
    if (typeof window.StreamSuitesState?.formatTimestamp === "function") {
      const out = window.StreamSuitesState.formatTimestamp(value);
      if (out) return out;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, {
      hour12: false,
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function parseHashView() {
    const hash = String(window.location.hash || "").replace(/^#/, "");
    const [view] = hash.split("?");
    return view.trim();
  }

  function parseAccountIdFromHash() {
    const hash = String(window.location.hash || "").replace(/^#/, "");
    const queryIndex = hash.indexOf("?");
    if (queryIndex === -1) return "";
    const params = new URLSearchParams(hash.slice(queryIndex + 1));
    return normalizeAccountId(params.get("account_id"));
  }

  function consumePendingAccountId() {
    const pending = window.StreamSuitesCreatorStatsNav;
    const candidate = normalizeAccountId(pending?.accountId);
    if (pending && typeof pending === "object") {
      pending.accountId = "";
      pending.from = "";
    }
    return candidate;
  }

  function qualityBadge(quality) {
    const normalized = String(quality || "").trim().toLowerCase() || "unavailable";
    return `<span class="creator-stats-quality creator-stats-quality-${escapeHtml(normalized)}">${escapeHtml(normalized)}</span>`;
  }

  function setStatus(message) {
    if (el.status) {
      el.status.textContent = message || "";
    }
  }

  function setBanner(message, variant = "danger") {
    if (!el.banner) return;
    const text = String(message || "").trim();
    if (!text) {
      el.banner.textContent = "";
      el.banner.classList.add("hidden");
      el.banner.classList.remove("ss-alert-danger", "ss-alert-warning", "ss-alert-success");
      return;
    }
    el.banner.textContent = text;
    el.banner.classList.remove("hidden");
    el.banner.classList.remove("ss-alert-danger", "ss-alert-warning", "ss-alert-success");
    el.banner.classList.add(`ss-alert-${variant}`);
  }

  function setLoadingState(loading) {
    el.loading?.classList.toggle("hidden", !loading);
    el.empty?.classList.toggle("hidden", loading || Boolean(state.accountId));
    el.error?.classList.add("hidden");
    if (loading) {
      el.sections?.classList.add("hidden");
    }
    if (el.loadButton) el.loadButton.disabled = loading;
    if (el.refreshButton) el.refreshButton.disabled = loading || !state.accountId;
  }

  function setErrorState(message) {
    el.loading?.classList.add("hidden");
    el.sections?.classList.add("hidden");
    if (el.error) {
      el.error.textContent = message || "Failed to load creator stats.";
      el.error.classList.remove("hidden");
    }
    if (el.empty) {
      el.empty.classList.add("hidden");
    }
  }

  function resetViewForAccount(accountId = "") {
    state.accountId = normalizeAccountId(accountId);
    if (el.heading) {
      el.heading.textContent = `Account: ${state.accountId || "—"}`;
    }
    if (el.generatedAt) {
      el.generatedAt.textContent = "—";
    }
    if (el.input && state.accountId) {
      el.input.value = state.accountId;
    }
    if (el.refreshButton) {
      el.refreshButton.disabled = !state.accountId;
    }
  }

  function resolvePayload(rawPayload) {
    const envelope = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
    const data = envelope.data && typeof envelope.data === "object" ? envelope.data : {};
    return {
      generatedAt: envelope.generated_at_utc || "",
      accountId: envelope.account_id || state.accountId,
      legend:
        data.data_quality_legend && typeof data.data_quality_legend === "object"
          ? data.data_quality_legend
          : {},
      channels: Array.isArray(data.channels) ? data.channels : [],
      growth: data.growth && typeof data.growth === "object" ? data.growth : {},
      latestStream:
        data.latest_stream && typeof data.latest_stream === "object" ? data.latest_stream : {},
      recentStreams: Array.isArray(data.recent_streams) ? data.recent_streams.slice(0, 10) : [],
      automation:
        data.automation_roi && typeof data.automation_roi === "object" ? data.automation_roi : {}
    };
  }

  function renderKpis(payload) {
    if (!el.kpis) return;
    const totals = payload.growth?.totals || {};
    const deltas = payload.growth?.deltas || {};
    const latestViewCount = payload.latestStream?.view_count_total;
    const latestViewQuality = payload.latestStream?.view_count_total_quality;
    const dayPlatform = deltas?.day?.by_platform || {};
    const platformChips = Object.keys(dayPlatform)
      .map((platform) => {
        const entry = dayPlatform[platform] || {};
        return `
          <span class="creator-stats-platform-chip">
            <span class="platform">${escapeHtml(platform)}</span>
            <strong>${escapeHtml(formatDelta(entry.delta))}</strong>
            ${qualityBadge(entry.quality)}
          </span>
        `;
      })
      .join("");

    const cards = [
      {
        title: "Audience Total",
        value: formatNumber(totals.audience_total),
        quality: totals.audience_total_quality
      },
      {
        title: "Platforms Connected",
        value: formatNumber(totals.platforms_connected),
        quality: totals.platforms_connected_quality
      },
      {
        title: "Latest Stream Views",
        value: formatNumber(latestViewCount),
        quality: latestViewQuality
      },
      {
        title: "Delta (Day / Week / Month / Year)",
        value: `${formatDelta(deltas?.day?.audience_delta)} / ${formatDelta(
          deltas?.week?.audience_delta
        )} / ${formatDelta(deltas?.month?.audience_delta)} / ${formatDelta(
          deltas?.year?.audience_delta
        )}`,
        quality: deltas?.day?.audience_delta_quality || deltas?.week?.audience_delta_quality
      }
    ];

    el.kpis.innerHTML = cards
      .map(
        (card) => `
          <article class="creator-stats-kpi-card">
            <div class="creator-stats-kpi-head">
              <span>${escapeHtml(card.title)}</span>
              ${qualityBadge(card.quality)}
            </div>
            <strong>${escapeHtml(card.value)}</strong>
          </article>
        `
      )
      .join("");

    const platformWrap = document.createElement("div");
    platformWrap.className = "creator-stats-platform-row";
    platformWrap.innerHTML = `
      <span class="muted">Per-platform (day delta)</span>
      <div class="creator-stats-platform-chip-wrap">${platformChips || '<span class="muted">No platform deltas available.</span>'}</div>
    `;
    el.kpis.appendChild(platformWrap);
  }

  function renderGrowthChart(payload) {
    if (!el.growthChart) return;
    const deltas = payload.growth?.deltas || {};
    const points = DELTA_WINDOWS.map((windowKey) => {
      const item = deltas[windowKey] || {};
      return {
        key: windowKey,
        label: windowKey.toUpperCase(),
        value: Number(item.audience_delta) || 0,
        quality: item.audience_delta_quality || "unavailable"
      };
    });

    const maxValue = Math.max(...points.map((p) => p.value), 1);
    const minValue = Math.min(...points.map((p) => p.value), 0);
    const range = Math.max(maxValue - minValue, 1);
    const width = 460;
    const height = 180;
    const padding = { x: 30, y: 20 };
    const usableW = width - padding.x * 2;
    const usableH = height - padding.y * 2;

    const coords = points.map((point, index) => {
      const x = padding.x + (points.length === 1 ? 0 : (index / (points.length - 1)) * usableW);
      const y = padding.y + ((maxValue - point.value) / range) * usableH;
      return { ...point, x, y };
    });

    const polyline = coords.map((point) => `${point.x},${point.y}`).join(" ");
    const baselineY = padding.y + ((maxValue - 0) / range) * usableH;

    el.growthChart.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="creator-stats-line-svg" role="img" aria-label="Audience delta trend by window">
        <line x1="${padding.x}" y1="${baselineY}" x2="${width - padding.x}" y2="${baselineY}" class="creator-stats-line-baseline"></line>
        <polyline points="${polyline}" class="creator-stats-line-path"></polyline>
        ${coords
          .map(
            (point) => `
              <circle cx="${point.x}" cy="${point.y}" r="4.5" class="creator-stats-line-point"></circle>
              <text x="${point.x}" y="${height - 6}" text-anchor="middle" class="creator-stats-line-label">${escapeHtml(point.label)}</text>
              <text x="${point.x}" y="${Math.max(14, point.y - 10)}" text-anchor="middle" class="creator-stats-line-value">${escapeHtml(
              formatDelta(point.value)
            )}</text>
            `
          )
          .join("")}
      </svg>
      <div class="creator-stats-quality-inline">
        ${coords
          .map((point) => `<span>${escapeHtml(point.label)} ${qualityBadge(point.quality)}</span>`)
          .join("")}
      </div>
    `;
  }

  function renderShareChart(payload) {
    if (!el.shareChart) return;
    const platformEntries = Array.isArray(payload.latestStream?.platforms)
      ? payload.latestStream.platforms
      : [];
    const usable = platformEntries
      .map((entry) => ({
        platform: String(entry?.platform || "").trim() || "unknown",
        value: Math.max(0, Number(entry?.view_count) || 0),
        quality: entry?.view_count_quality || "unavailable",
        url: entry?.url || ""
      }))
      .filter((entry) => entry.value > 0);

    if (!usable.length) {
      el.shareChart.innerHTML = '<div class="ss-empty-state">No platform view-count data available for share chart.</div>';
      return;
    }

    const total = usable.reduce((sum, entry) => sum + entry.value, 0);
    let running = 0;
    const segments = usable
      .map((entry, index) => {
        const pct = entry.value / total;
        const start = running;
        running += pct;
        return {
          ...entry,
          pct,
          start,
          end: running,
          color: DONUT_COLORS[index % DONUT_COLORS.length]
        };
      })
      .map((segment) => {
        const radius = 46;
        const circumference = 2 * Math.PI * radius;
        const dash = segment.pct * circumference;
        const offset = (1 - segment.start) * circumference;
        return `<circle r="${radius}" cx="60" cy="60" fill="transparent" stroke="${segment.color}" stroke-width="16" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${offset}"></circle>`;
      })
      .join("");

    const legend = usable
      .map((entry, index) => {
        const pct = total > 0 ? (entry.value / total) * 100 : 0;
        return `
          <li>
            <span class="swatch" style="--swatch-color:${DONUT_COLORS[index % DONUT_COLORS.length]}"></span>
            <span class="name">${escapeHtml(entry.platform)}</span>
            <strong>${escapeHtml(formatNumber(entry.value))} (${pct.toFixed(1)}%)</strong>
            ${qualityBadge(entry.quality)}
          </li>
        `;
      })
      .join("");

    el.shareChart.innerHTML = `
      <div class="creator-stats-donut-wrap">
        <svg viewBox="0 0 120 120" class="creator-stats-donut-svg" role="img" aria-label="Platform share donut">
          <circle r="46" cx="60" cy="60" fill="transparent" stroke="rgba(255,255,255,0.08)" stroke-width="16"></circle>
          ${segments}
          <text x="60" y="56" text-anchor="middle" class="creator-stats-donut-total-label">Views</text>
          <text x="60" y="72" text-anchor="middle" class="creator-stats-donut-total-value">${escapeHtml(formatNumber(total))}</text>
        </svg>
        <ul class="creator-stats-share-legend">${legend}</ul>
      </div>
    `;
  }

  function renderLatestStream(payload) {
    if (!el.latestStream) return;
    const latest = payload.latestStream || {};
    const platforms = Array.isArray(latest.platforms) ? latest.platforms : [];
    const platformItems = platforms
      .map((entry) => {
        const platform = String(entry?.platform || "unknown");
        const url = String(entry?.url || "").trim();
        return `
          <li>
            <span><strong>${escapeHtml(platform)}</strong> · ${escapeHtml(formatNumber(entry?.view_count))} views ${qualityBadge(
          entry?.view_count_quality
        )}</span>
            ${
              url
                ? `<a class="ss-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open stream URL</a>`
                : '<span class="muted">No URL</span>'
            }
          </li>
        `;
      })
      .join("");

    el.latestStream.innerHTML = `
      <div class="creator-stats-latest-summary">
        <div><span class="label">Title</span><strong>${escapeHtml(latest.title || "—")}</strong></div>
        <div><span class="label">Started</span><strong>${escapeHtml(formatTimestamp(latest.started_at_utc))}</strong></div>
        <div><span class="label">Ended</span><strong>${escapeHtml(formatTimestamp(latest.ended_at_utc))}</strong></div>
        <div><span class="label">Total Views</span><strong>${escapeHtml(formatNumber(latest.view_count_total))} ${qualityBadge(
      latest.view_count_total_quality
    )}</strong></div>
      </div>
      <ul class="creator-stats-platform-links">${platformItems || '<li class="muted">No platform records available.</li>'}</ul>
    `;
  }

  function renderRecentStreams(payload) {
    if (!el.recentBody) return;
    const rows = (Array.isArray(payload.recentStreams) ? payload.recentStreams : [])
      .slice(0, 10)
      .map((stream) => {
        const links = Object.entries(stream?.platform_urls || {})
          .map(([platform, url]) => {
            const href = String(url || "").trim();
            if (!href) return "";
            return `<a class="ss-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
              platform
            )}</a>`;
          })
          .filter(Boolean)
          .join(" • ");
        return `
          <tr>
            <td>${escapeHtml(stream?.title || "—")}</td>
            <td>${escapeHtml(formatTimestamp(stream?.started_at_utc))}</td>
            <td>${links || "—"}</td>
          </tr>
        `;
      })
      .join("");
    el.recentBody.innerHTML = rows || '<tr><td colspan="3" class="muted">No recent streams available.</td></tr>';
  }

  function renderAutomation(payload) {
    if (!el.automation) return;
    const rows = ["latest_stream", "rolling_7d", "rolling_30d"]
      .map((key) => {
        const item = payload.automation?.[key] || {};
        const successRate = Number(item.automation_success_rate);
        const ratePct = Number.isFinite(successRate) ? Math.max(0, Math.min(100, successRate * 100)) : 0;
        return `
          <article class="creator-stats-automation-card">
            <header>
              <strong>${escapeHtml(key.replace(/_/g, " ").toUpperCase())}</strong>
            </header>
            <div class="creator-stats-automation-grid">
              <div><span>Triggers</span><strong>${escapeHtml(formatNumber(item.triggers_invoked))}</strong></div>
              <div><span>Clips</span><strong>${escapeHtml(formatNumber(item.clips_created))}</strong></div>
              <div><span>Jobs</span><strong>${escapeHtml(formatNumber(item.jobs_run))}</strong></div>
              <div><span>Errors</span><strong>${escapeHtml(formatNumber(item.errors_count))}</strong></div>
            </div>
            <div class="ss-progress-row">
              <div class="ss-progress-label">
                <span>Success rate</span>
                <span class="ss-progress-meta">${escapeHtml(formatPercent(successRate))}</span>
              </div>
              <div class="ss-progress">
                <div class="ss-progress-bar" style="width:${ratePct.toFixed(1)}%"></div>
              </div>
            </div>
            <p class="muted">${escapeHtml(item.notes || "")}</p>
          </article>
        `;
      })
      .join("");
    el.automation.innerHTML = rows;
  }

  function renderQualityLegend(payload) {
    if (!el.qualityLegend) return;
    const legend = payload.legend || {};
    const keys = QUALITY_ORDER.filter((key) => typeof legend[key] === "string");
    if (!keys.length) {
      el.qualityLegend.innerHTML = '<div class="ss-empty-state">No data-quality legend was provided in this payload.</div>';
      return;
    }
    el.qualityLegend.innerHTML = `
      <ul class="creator-stats-legend-list">
        ${keys
          .map((key) => `<li>${qualityBadge(key)} <span>${escapeHtml(legend[key])}</span></li>`)
          .join("")}
      </ul>
    `;
  }

  function renderPayload(rawPayload, options = {}) {
    const payload = resolvePayload(rawPayload);
    resetViewForAccount(payload.accountId || state.accountId);
    if (el.generatedAt) {
      el.generatedAt.textContent = formatTimestamp(payload.generatedAt);
    }
    renderKpis(payload);
    renderGrowthChart(payload);
    renderShareChart(payload);
    renderLatestStream(payload);
    renderRecentStreams(payload);
    renderAutomation(payload);
    renderQualityLegend(payload);
    el.sections?.classList.remove("hidden");
    el.loading?.classList.add("hidden");
    el.error?.classList.add("hidden");
    el.empty?.classList.add("hidden");
    setBanner("");
    setStatus(
      options.fromCache
        ? `Loaded cached stats for ${payload.accountId || state.accountId}.`
        : `Loaded stats for ${payload.accountId || state.accountId}.`
    );
  }

  function resolveApiErrorMessage(err) {
    const status = Number(err?.status || 0);
    if (status === 401) {
      return "Unauthorized: your admin session is missing or expired.";
    }
    if (status === 403) {
      return "Forbidden: this page requires administrator privileges.";
    }
    if (status === 404) {
      return "Not found: no creator stats payload exists for this account.";
    }
    const detail = String(err?.message || "").trim();
    if (detail) return detail;
    return "Creator stats request failed.";
  }

  async function loadAccountStats(accountId, options = {}) {
    const normalizedId = normalizeAccountId(accountId);
    if (!normalizedId) {
      setBanner("Enter an account id to load creator stats.", "warning");
      return;
    }

    resetViewForAccount(normalizedId);
    const force = options.force === true;
    if (!force && CACHE.has(normalizedId)) {
      renderPayload(CACHE.get(normalizedId), { fromCache: true });
      return;
    }

    setLoadingState(true);
    setStatus(`Loading creator stats for ${normalizedId}...`);
    setBanner("");
    const requestToken = ++state.requestToken;

    try {
      const api = window.StreamSuitesApi;
      if (!api || typeof api.apiFetch !== "function") {
        throw new Error("StreamSuites API helper unavailable.");
      }
      const payload = await api.apiFetch(
        `/api/admin/accounts/${encodeURIComponent(normalizedId)}/stats`,
        { timeoutMs: 5000, cacheTtlMs: 0, forceRefresh: force === true }
      );
      if (requestToken !== state.requestToken) return;
      CACHE.set(normalizedId, payload);
      renderPayload(payload, { fromCache: false });
    } catch (err) {
      if (requestToken !== state.requestToken) return;
      const message = resolveApiErrorMessage(err);
      setErrorState(message);
      setBanner(message, "danger");
      setStatus("Load failed.");
    } finally {
      if (requestToken === state.requestToken) {
        setLoadingState(false);
      }
    }
  }

  function resolveInitialAccountId() {
    const pending = consumePendingAccountId();
    if (pending) return pending;
    const fromHash = parseAccountIdFromHash();
    if (fromHash) return fromHash;
    return "";
  }

  function handleHashChange() {
    if (parseHashView() !== "creator-stats") return;
    const fromHash = parseAccountIdFromHash();
    const normalized = normalizeAccountId(fromHash);
    if (!normalized || normalized === state.accountId) return;
    void loadAccountStats(normalized);
  }

  function bindEvents() {
    el.form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const accountId = normalizeAccountId(el.input?.value);
      if (!accountId) {
        setBanner("Enter an account id to load creator stats.", "warning");
        return;
      }
      window.location.hash = `#creator-stats?account_id=${encodeURIComponent(accountId)}`;
      void loadAccountStats(accountId);
    });

    el.refreshButton?.addEventListener("click", () => {
      const accountId = normalizeAccountId(el.input?.value || state.accountId);
      if (!accountId) {
        setBanner("Select an account before refreshing.", "warning");
        return;
      }
      void loadAccountStats(accountId, { force: true });
    });

    state.boundHashChange = handleHashChange;
    window.addEventListener("hashchange", state.boundHashChange);
  }

  function init() {
    el.form = $("creator-stats-form");
    el.input = $("creator-stats-account-input");
    el.loadButton = $("creator-stats-load");
    el.refreshButton = $("creator-stats-refresh");
    el.status = $("creator-stats-status");
    el.banner = $("creator-stats-banner");
    el.heading = $("creator-stats-account-heading");
    el.generatedAt = $("creator-stats-generated-at");
    el.empty = $("creator-stats-empty");
    el.loading = $("creator-stats-loading");
    el.error = $("creator-stats-error");
    el.sections = $("creator-stats-sections");
    el.kpis = $("creator-stats-kpis");
    el.growthChart = $("creator-stats-growth-chart");
    el.shareChart = $("creator-stats-share-chart");
    el.latestStream = $("creator-stats-latest-stream");
    el.automation = $("creator-stats-automation");
    el.recentBody = $("creator-stats-recent-body");
    el.qualityLegend = $("creator-stats-quality-legend");

    resetViewForAccount("");
    setStatus("Awaiting account selection.");
    setBanner("");
    bindEvents();

    const initialAccountId = resolveInitialAccountId();
    if (initialAccountId) {
      void loadAccountStats(initialAccountId);
    }
  }

  function destroy() {
    if (state.boundHashChange) {
      window.removeEventListener("hashchange", state.boundHashChange);
      state.boundHashChange = null;
    }
    state.requestToken += 1;
  }

  window.CreatorStatsView = {
    init,
    destroy
  };
})();

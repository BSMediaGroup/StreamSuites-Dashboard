/* ============================================================
   StreamSuites Dashboard - Creator Stats (Admin / Phase 0)
   ============================================================ */

(() => {
  "use strict";

  const CACHE = new Map();
  const QUALITY_ORDER = ["exact", "approximate", "partial", "derived", "unavailable"];
  const DELTA_WINDOWS = ["day", "week", "month", "year"];
  const DONUT_COLORS = ["#6ce1ff", "#89f7a1", "#f8c96b", "#e99fff", "#ff8f8f", "#9fb0ff"];
  const statsFormatter = window.StreamSuitesAdminStatsFormatting;

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

  function normalizeQuality(value) {
    if (statsFormatter?.normalizeQuality) {
      return statsFormatter.normalizeQuality(value);
    }
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return "unavailable";
    if (normalized === "estimated") return "approximate";
    if (normalized === "direct") return "exact";
    if (QUALITY_ORDER.includes(normalized)) return normalized;
    return "unavailable";
  }

  function getQualityMarker(quality, options = {}) {
    const normalized = normalizeQuality(quality);
    if (normalized === "approximate") return "~";
    if (normalized === "partial") return "+";
    if (normalized === "derived") return "*";
    if (normalized === "unavailable" && options.includeUnavailable === true) return "—";
    return "";
  }

  function buildQualityMarkerInlineSvg(quality, options = {}) {
    const normalized = normalizeQuality(quality);
    if (normalized === "partial") {
      return `
        <svg class="creator-stats-quality-svg" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
          <path d="M5 1.2V8.8M1.2 5H8.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>
        </svg>
      `;
    }
    if (normalized === "unavailable" && options.includeUnavailable === true) {
      return `
        <svg class="creator-stats-quality-svg" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
          <path d="M1.5 5H8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>
        </svg>
      `;
    }
    if (normalized === "approximate") {
      return `
        <svg class="creator-stats-quality-svg" viewBox="0 0 12 10" aria-hidden="true" focusable="false">
          <path d="M1 3.4c1.2-1 2.5-1 3.7 0 1.2 1 2.5 1 3.7 0" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"></path>
          <path d="M1 6.6c1.2-1 2.5-1 3.7 0 1.2 1 2.5 1 3.7 0" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"></path>
        </svg>
      `;
    }
    return "";
  }

  function formatMetric(value, quality, formatter = formatNumber, legend = {}) {
    if (statsFormatter?.formatValue) {
      return statsFormatter.formatValue(value, {
        quality,
        formatter,
        legend,
        unavailableTitle: "Not available"
      });
    }
    return {
      displayText: formatter(value),
      titleText: "Not available",
      suffix: "",
      quality: normalizeQuality(quality)
    };
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

  function qualityBadge(quality, legend = {}, options = {}) {
    const normalized = normalizeQuality(quality);
    const marker = getQualityMarker(normalized, options);
    const inlineSvg = buildQualityMarkerInlineSvg(normalized, options);
    if (!marker && !inlineSvg) return "";
    const qualityTitle = legend?.[normalized] || "Not available";
    return `
      <span class="creator-stats-quality creator-stats-quality-${escapeHtml(normalized)}" title="${escapeHtml(
      qualityTitle
    )}" aria-label="${escapeHtml(qualityTitle)}">
        ${inlineSvg || escapeHtml(marker)}
      </span>
    `;
  }

  function formatCompactDateLabel(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(5, 10);
    return date.toLocaleDateString(undefined, { month: "2-digit", day: "2-digit" });
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
    const legend = statsFormatter?.resolveLegend
      ? statsFormatter.resolveLegend(data.data_quality_legend)
      : data.data_quality_legend && typeof data.data_quality_legend === "object"
        ? data.data_quality_legend
        : {};
    return {
      generatedAt: envelope.generated_at_utc || "",
      accountId: envelope.account_id || state.accountId,
      legend,
      channels: Array.isArray(data.channels) ? data.channels : [],
      growth: data.growth && typeof data.growth === "object" ? data.growth : {},
      growthSeries:
        data.growth_series && typeof data.growth_series === "object" ? data.growth_series : {},
      platformShare:
        data.platform_share && typeof data.platform_share === "object" ? data.platform_share : {},
      latestStream:
        data.latest_stream && typeof data.latest_stream === "object" ? data.latest_stream : {},
      recentStreams: Array.isArray(data.recent_streams) ? data.recent_streams.slice(0, 10) : [],
      automation:
        data.automation_roi && typeof data.automation_roi === "object" ? data.automation_roi : {}
    };
  }

  function renderKpis(payload) {
    if (!el.kpis) return;
    const legend = payload.legend || {};
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
            ${qualityBadge(entry.quality, legend)}
          </span>
        `;
      })
      .join("");

    const cards = [
      {
        title: "Audience Total",
        value: totals.audience_total,
        formatter: formatNumber,
        quality: totals.audience_total_quality
      },
      {
        title: "Platforms Connected",
        value: totals.platforms_connected,
        formatter: formatNumber,
        quality: totals.platforms_connected_quality
      },
      {
        title: "Latest Stream Views",
        value: latestViewCount,
        formatter: formatNumber,
        quality: latestViewQuality
      },
      {
        title: "Delta (Day / Week / Month / Year)",
        value: `${formatDelta(deltas?.day?.audience_delta)} / ${formatDelta(
          deltas?.week?.audience_delta
        )} / ${formatDelta(deltas?.month?.audience_delta)} / ${formatDelta(
          deltas?.year?.audience_delta
        )}`,
        formatter: (v) => String(v),
        quality: deltas?.day?.audience_delta_quality || deltas?.week?.audience_delta_quality
      }
    ];

    el.kpis.innerHTML = cards
      .map(
        (card) => {
          const metric = formatMetric(card.value, card.quality, card.formatter, legend);
          return `
          <article class="creator-stats-kpi-card">
            <div class="creator-stats-kpi-head">
              <span>${escapeHtml(card.title)}</span>
              ${qualityBadge(card.quality, legend)}
            </div>
            <strong title="${escapeHtml(metric.titleText)}">${escapeHtml(metric.displayText)}</strong>
          </article>
        `;
        }
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
    const legend = payload.legend || {};
    const dailyPoints = Array.isArray(payload.growthSeries?.daily_points)
      ? payload.growthSeries.daily_points
      : [];
    let points = [];

    if (dailyPoints.length) {
      points = dailyPoints
        .slice(-30)
        .map((entry, index) => {
          const totals = entry?.totals && typeof entry.totals === "object" ? entry.totals : {};
          const value = Number(totals.followers_total);
          return {
            key: entry?.date_utc || `point-${index + 1}`,
            label: formatCompactDateLabel(entry?.date_utc) || `Day ${index + 1}`,
            value: Number.isFinite(value) ? value : 0,
            quality: entry?.quality?.followers_total || "derived"
          };
        });
    } else {
      const deltas = payload.growth?.deltas || {};
      points = DELTA_WINDOWS.map((windowKey) => {
        const item = deltas[windowKey] || {};
        return {
          key: windowKey,
          label: windowKey.toUpperCase(),
          value: Number(item.audience_delta) || 0,
          quality: item.audience_delta_quality || "unavailable"
        };
      });
    }

    const values = points.map((point) => Number(point.value) || 0);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const range = Math.max(maxValue - minValue, 1);
    const deltas = values.map((value, index) => (index === 0 ? 0 : value - values[index - 1]));
    const deltaAbsMax = Math.max(1, ...deltas.map((value) => Math.abs(value)));
    const movingAverage = values.map((_value, index) => {
      const start = Math.max(0, index - 6);
      const windowValues = values.slice(start, index + 1);
      return Math.round(windowValues.reduce((sum, value) => sum + value, 0) / windowValues.length);
    });
    const netChange = values[values.length - 1] - values[0];

    const width = 520;
    const height = 260;
    const padding = {
      x: 28,
      top: 18,
      chartBottom: 154,
      axisBottom: 176,
      barsTop: 188,
      barsBottom: 242
    };
    const usableW = width - padding.x * 2;
    const chartH = padding.chartBottom - padding.top;
    const barsH = padding.barsBottom - padding.barsTop;

    const coords = points.map((point, index) => {
      const x = padding.x + (points.length === 1 ? 0 : (index / (points.length - 1)) * usableW);
      const y = padding.top + ((maxValue - values[index]) / range) * chartH;
      return { ...point, x, y, avg: movingAverage[index], delta: deltas[index] };
    });

    const polyline = coords.map((point) => `${point.x},${point.y}`).join(" ");
    const avgPolyline = coords
      .map((point) => {
        const y = padding.top + ((maxValue - point.avg) / range) * chartH;
        return `${point.x},${y}`;
      })
      .join(" ");
    const baselineY = padding.top + ((maxValue - 0) / range) * chartH;

    const tickCandidates =
      coords.length > 8 ? [0, 4, 9, 14, 19, 24, coords.length - 1] : coords.map((_p, i) => i);
    const tickIndexes = tickCandidates.filter((value, index, arr) => arr.indexOf(value) === index);

    const yTicks = [0, 0.25, 0.5, 0.75, 1]
      .map((ratio) => {
        const yPos = padding.chartBottom - ratio * chartH;
        return `<line x1="${padding.x}" y1="${yPos.toFixed(2)}" x2="${(width - padding.x).toFixed(
          2
        )}" y2="${yPos.toFixed(2)}" class="creator-stats-line-grid"></line>`;
      })
      .join("");

    const xTicks = tickIndexes
      .map((index) => {
        const point = coords[index];
        return `
          <line x1="${point.x.toFixed(2)}" y1="${padding.chartBottom.toFixed(2)}" x2="${point.x.toFixed(
          2
        )}" y2="${(padding.chartBottom + 6).toFixed(2)}" class="creator-stats-line-axis-tick"></line>
          <text x="${point.x.toFixed(2)}" y="${padding.axisBottom.toFixed(
          2
        )}" text-anchor="middle" class="creator-stats-line-label">${escapeHtml(point.label)}</text>
        `;
      })
      .join("");

    const pointMarkers = coords
      .map((point, index) => {
        const isEmphasis = index === 0 || index === coords.length - 1 || tickIndexes.includes(index);
        if (!isEmphasis) return "";
        return `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${
          index === coords.length - 1 ? "3.9" : "2.8"
        }" class="creator-stats-line-point${index === coords.length - 1 ? " is-latest" : ""}"></circle>`;
      })
      .join("");

    const barWidth = Math.max(4, (usableW / Math.max(1, coords.length)) * 0.62);
    const deltaBars = coords
      .map((point) => {
        const magnitude = Math.abs(point.delta);
        const barHeight = Math.max(2, (magnitude / deltaAbsMax) * (barsH - 4));
        const y = padding.barsBottom - barHeight;
        const tone = point.delta >= 0 ? "is-pos" : "is-neg";
        return `<rect x="${(point.x - barWidth / 2).toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(
          2
        )}" height="${barHeight.toFixed(2)}" rx="2" class="creator-stats-delta-bar ${tone}"></rect>`;
      })
      .join("");

    const latest = coords[coords.length - 1];
    const qualityCounts = coords.reduce((acc, point) => {
      const key = normalizeQuality(point.quality);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const qualitySummary = Object.keys(qualityCounts)
      .filter((key) => qualityCounts[key] > 0)
      .map(
        (key) =>
          `<span>${qualityBadge(key, legend, { includeUnavailable: true })} ${escapeHtml(
            key
          )}: ${qualityCounts[key]}</span>`
      )
      .join("");

    el.growthChart.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="creator-stats-line-svg" role="img" aria-label="Audience growth trend">
        ${yTicks}
        <line x1="${padding.x}" y1="${baselineY}" x2="${width - padding.x}" y2="${baselineY}" class="creator-stats-line-baseline"></line>
        <line x1="${padding.x}" y1="${(padding.barsTop - 8).toFixed(2)}" x2="${(width - padding.x).toFixed(
          2
        )}" y2="${(padding.barsTop - 8).toFixed(2)}" class="creator-stats-line-separator"></line>
        <polyline points="${avgPolyline}" class="creator-stats-line-path creator-stats-line-path-avg"></polyline>
        <polyline points="${polyline}" class="creator-stats-line-path"></polyline>
        ${pointMarkers}
        <g class="creator-stats-delta-bars">${deltaBars}</g>
        ${xTicks}
        <line x1="${latest.x.toFixed(2)}" y1="${padding.top}" x2="${latest.x.toFixed(2)}" y2="${padding.chartBottom.toFixed(
          2
        )}" class="creator-stats-line-crosshair"></line>
        <text x="${Math.max(padding.x + 38, latest.x - 4).toFixed(2)}" y="${Math.max(
          14,
          latest.y - 10
        ).toFixed(2)}" text-anchor="end" class="creator-stats-line-value">${escapeHtml(
          formatNumber(latest.value)
        )}</text>
      </svg>
      <div class="creator-stats-quality-inline">
        <span>Points: ${coords.length}</span>
        <span>Min: ${escapeHtml(formatNumber(minValue))}</span>
        <span>Max: ${escapeHtml(formatNumber(maxValue))}</span>
        <span>Net: ${escapeHtml(formatDelta(netChange))}</span>
        ${qualitySummary}
      </div>
    `;
  }

  function renderShareChart(payload) {
    if (!el.shareChart) return;
    const legend = payload.legend || {};
    const platformShareByPlatform =
      payload.platformShare?.by_platform && typeof payload.platformShare.by_platform === "object"
        ? payload.platformShare.by_platform
        : {};
    const platformShareQualityByPlatform =
      payload.platformShare?.quality?.by_platform &&
      typeof payload.platformShare.quality.by_platform === "object"
        ? payload.platformShare.quality.by_platform
        : {};

    let usable = Object.keys(platformShareByPlatform)
      .map((platform) => {
        const entry = platformShareByPlatform[platform] || {};
        const value = Number(entry?.followers_total);
        const qualityRaw = platformShareQualityByPlatform[platform];
        const quality =
          qualityRaw && typeof qualityRaw === "object"
            ? qualityRaw.followers_total
            : qualityRaw;
        return {
          platform: String(platform || "").trim() || "unknown",
          value: Number.isFinite(value) ? Math.max(0, value) : 0,
          quality: quality || "unavailable"
        };
      })
      .filter((entry) => entry.value > 0);

    if (!usable.length) {
      const platformEntries = Array.isArray(payload.latestStream?.platforms)
        ? payload.latestStream.platforms
        : [];
      usable = platformEntries
        .map((entry) => ({
          platform: String(entry?.platform || "").trim() || "unknown",
          value: Math.max(0, Number(entry?.view_count) || 0),
          quality: entry?.view_count_quality || "unavailable"
        }))
        .filter((entry) => entry.value > 0);
    }

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

    const legendMarkup = usable
      .map((entry, index) => {
        const pct = total > 0 ? (entry.value / total) * 100 : 0;
        return `
          <li>
            <span class="swatch" style="--swatch-color:${DONUT_COLORS[index % DONUT_COLORS.length]}"></span>
            <span class="name">${escapeHtml(entry.platform)}</span>
            <strong>${escapeHtml(formatNumber(entry.value))} (${pct.toFixed(1)}%)</strong>
            ${qualityBadge(entry.quality, legend)}
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
        <ul class="creator-stats-share-legend">${legendMarkup}</ul>
      </div>
    `;
  }

  function renderLatestStream(payload) {
    if (!el.latestStream) return;
    const legend = payload.legend || {};
    const latest = payload.latestStream || {};
    const platforms = Array.isArray(latest.platforms) ? latest.platforms : [];
    const platformItems = platforms
      .map((entry) => {
        const platform = String(entry?.platform || "unknown");
        const url = String(entry?.url || "").trim();
        const viewMetric = formatMetric(entry?.view_count, entry?.view_count_quality, formatNumber, legend);
        return `
          <li>
            <span title="${escapeHtml(viewMetric.titleText)}"><strong>${escapeHtml(platform)}</strong> · ${escapeHtml(
          viewMetric.displayText
        )} views ${qualityBadge(
          entry?.view_count_quality,
          legend
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

    const totalViewsMetric = formatMetric(
      latest.view_count_total,
      latest.view_count_total_quality,
      formatNumber,
      legend
    );

    el.latestStream.innerHTML = `
      <div class="creator-stats-latest-summary">
        <div><span class="label">Title</span><strong>${escapeHtml(latest.title || "—")}</strong></div>
        <div><span class="label">Started</span><strong>${escapeHtml(formatTimestamp(latest.started_at_utc))}</strong></div>
        <div><span class="label">Ended</span><strong>${escapeHtml(formatTimestamp(latest.ended_at_utc))}</strong></div>
        <div><span class="label">Total Views</span><strong title="${escapeHtml(totalViewsMetric.titleText)}">${escapeHtml(
      totalViewsMetric.displayText
    )} ${qualityBadge(
      latest.view_count_total_quality,
      legend
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
          .map((key) => {
            const marker = qualityBadge(key, legend, { includeUnavailable: true }) || "—";
            return `<li>${marker} <span><strong>${escapeHtml(key)}</strong> · ${escapeHtml(legend[key])}</span></li>`;
          })
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

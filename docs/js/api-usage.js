/* ============================================================
   StreamSuites Dashboard - API Usage view
   ============================================================ */

(() => {
  "use strict";

  const RUNTIME_ENDPOINT = "/api/admin/api-usage";
  const POLL_INTERVAL_MS = 5000;
  const DEFAULT_WINDOW = "5m";
  // Conservative health model for endpoint pills. Keep centralized for easy tuning.
  const HEALTH_THRESHOLDS = {
    minSampleHits: 20,
    errorRate: {
      healthyMax: 0.01,
      degradedMax: 0.05
    },
    // Prefer p95 when available; fall back to avg latency.
    p95LatencyMs: {
      healthyMax: 800,
      degradedMax: 2000
    },
    avgLatencyMs: {
      healthyMax: 400,
      degradedMax: 1000
    }
  };

  const state = {
    timer: null,
    data: null,
    online: false,
    resizeObserver: null,
    selectedWindow: DEFAULT_WINDOW,
    sort: { key: "hits", direction: "desc" },
    abortController: null,
    destroyed: false,
    lastFetchedAt: null,
    chartModel: null,
    hoverIndex: null
  };

  const el = {
    banner: null,
    status: null,
    rpm: null,
    errorRate: null,
    window: null,
    generatedAt: null,
    windowSelect: null,
    panel: null,
    canvas: null,
    empty: null,
    chartLegend: null,
    chartTooltip: null,
    endpointHealth: null,
    authSignals: null,
    tierSurface: null,
    versionRegression: null
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
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function setBanner(message, isVisible, tone = "danger") {
    if (!el.banner) return;
    el.banner.textContent = message;
    el.banner.classList.toggle("hidden", !isVisible);
    el.banner.classList.toggle("ss-alert-danger", isVisible && tone === "danger");
  }

  function setStatus(message) {
    if (el.status) el.status.textContent = message;
  }

  function formatNumber(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "--";
    return num.toLocaleString();
  }

  function formatInteger(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "--";
    return Math.round(num).toLocaleString();
  }

  function formatDecimal(value, digits = 2) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "--";
    return num.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function formatPercent(value, digits = 2) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "--";
    return `${(num * 100).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits
    })}%`;
  }

  function formatLatency(valueMs) {
    const value = Number(valueMs);
    if (!Number.isFinite(value) || value < 0) return "--";
    if (value < 1000) return `${Math.round(value)}ms`;
    return `${(value / 1000).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    })}s`;
  }

  function formatRelativeTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000);
    const abs = Math.abs(diffSeconds);
    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    if (abs < 60) return formatter.format(-diffSeconds, "second");
    const diffMinutes = Math.round(diffSeconds / 60);
    if (Math.abs(diffMinutes) < 60) return formatter.format(-diffMinutes, "minute");
    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) return formatter.format(-diffHours, "hour");
    const diffDays = Math.round(diffHours / 24);
    return formatter.format(-diffDays, "day");
  }

  function formatTimestamp(value) {
    if (!value) return "--";
    if (typeof window.StreamSuitesState?.formatTimestamp === "function") {
      const formatted = window.StreamSuitesState.formatTimestamp(value);
      if (formatted) {
        const rel = formatRelativeTime(value);
        return rel ? `${formatted} (${rel})` : formatted;
      }
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const absolute = date.toLocaleString(undefined, {
      hour12: false,
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const rel = formatRelativeTime(value);
    return rel ? `${absolute} (${rel})` : absolute;
  }

  function toTitleCase(value) {
    const text = String(value || "")
      .trim()
      .replace(/[\-_]+/g, " ");
    if (!text) return "Unknown";
    return text
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  function formatWindowLabel(windowValue) {
    if (!windowValue && el.windowSelect?.selectedOptions?.[0]) {
      return el.windowSelect.selectedOptions[0].textContent?.trim() || "--";
    }
    const value = String(windowValue || "").trim().toLowerCase();
    if (!value) return "--";
    const map = {
      "1m": "Last 1m",
      "5m": "Last 5m",
      "15m": "Last 15m",
      "1h": "Last 1h",
      "24h": "Last 24h"
    };
    if (map[value]) return map[value];
    return value;
  }

  function getLiveSummary(bundle) {
    const live = bundle?.live_summary && typeof bundle.live_summary === "object"
      ? bundle.live_summary
      : {};
    const legacySummary = bundle?.summary && typeof bundle.summary === "object"
      ? bundle.summary
      : {};

    return {
      rpm: live.rpm ?? legacySummary.rpm,
      errorRate: live.error_rate ?? legacySummary.error_rate,
      windowLabel:
        live.window_label ??
        bundle?.window_label ??
        formatWindowLabel(state.selectedWindow),
      generatedAt: live.generated_at ?? bundle?.generated_at ?? null
    };
  }

  function setSummary(bundle) {
    const summary = getLiveSummary(bundle || {});
    if (el.rpm) el.rpm.textContent = formatDecimal(summary.rpm, 2);
    if (el.errorRate) el.errorRate.textContent = formatPercent(summary.errorRate);
    if (el.window) el.window.textContent = summary.windowLabel || formatWindowLabel(state.selectedWindow);
    if (el.generatedAt) el.generatedAt.textContent = formatTimestamp(summary.generatedAt);
  }

  function normalizeSeries(series) {
    if (!Array.isArray(series)) return [];
    return series
      .map((point) => ({
        ts: Number(point?.ts ?? point?.timestamp ?? 0),
        count: Number(point?.count ?? point?.value ?? 0)
      }))
      .filter((point) => Number.isFinite(point.ts) && Number.isFinite(point.count));
  }

  function resolveChartPayload(bundle) {
    const source = bundle?.chart && typeof bundle.chart === "object" ? bundle.chart : bundle || {};

    return {
      requests: normalizeSeries(
        source.requests_per_sec || source.requests || bundle?.requests_per_sec || []
      ),
      errors: normalizeSeries(
        source.errors_per_sec || source.errors || bundle?.errors_per_sec || []
      )
    };
  }

  function ensureChartChrome() {
    if (!el.panel) return;
    if (!el.chartLegend) {
      el.chartLegend = document.createElement("div");
      el.chartLegend.id = "api-usage-chart-legend";
      el.chartLegend.className = "api-usage-chart-legend";
      el.chartLegend.innerHTML = `
        <span class="api-usage-legend-item">
          <span class="api-usage-legend-swatch requests"></span>
          <span>Requests/sec</span>
        </span>
        <span class="api-usage-legend-item">
          <span class="api-usage-legend-swatch errors"></span>
          <span>Errors/sec</span>
        </span>
      `;
      el.panel.insertBefore(el.chartLegend, el.panel.firstChild);
    }

    if (!el.chartTooltip) {
      el.chartTooltip = document.createElement("div");
      el.chartTooltip.id = "api-usage-chart-tooltip";
      el.chartTooltip.className = "api-usage-chart-tooltip hidden";
      el.panel.appendChild(el.chartTooltip);
    }
  }

  function hideChartTooltip() {
    state.hoverIndex = null;
    if (el.chartTooltip) {
      el.chartTooltip.classList.add("hidden");
      el.chartTooltip.innerHTML = "";
    }
  }

  function renderChartTooltip(clientX, clientY, index) {
    if (!el.canvas || !el.chartTooltip || !state.chartModel) return;
    const model = state.chartModel;
    if (!Number.isFinite(index) || index < 0 || index >= model.pointCount) {
      hideChartTooltip();
      return;
    }

    const requestPoint = model.requests[index];
    const errorPoint = model.errors[index];
    const requestsPerSec = Number(requestPoint?.count ?? 0);
    const errorsPerSec = Number(errorPoint?.count ?? 0);
    const rpm = requestsPerSec * 60;
    const errorRate = requestsPerSec > 0 ? errorsPerSec / requestsPerSec : 0;
    const timestamp = requestPoint?.ts || errorPoint?.ts || null;

    el.chartTooltip.innerHTML = `
      <div class="api-usage-tooltip-time">${escapeHtml(formatTimestamp(timestamp))}</div>
      <div class="api-usage-tooltip-grid">
        <span class="api-usage-tooltip-label">RPM</span>
        <span class="api-usage-tooltip-value">${escapeHtml(formatDecimal(rpm, rpm >= 10 ? 0 : 2))}</span>
        <span class="api-usage-tooltip-label">Error Rate</span>
        <span class="api-usage-tooltip-value">${escapeHtml(formatPercent(errorRate))}</span>
        <span class="api-usage-tooltip-label">Errors/sec</span>
        <span class="api-usage-tooltip-value">${escapeHtml(formatDecimal(errorsPerSec, errorsPerSec >= 10 ? 0 : 2))}</span>
      </div>
    `;
    el.chartTooltip.classList.remove("hidden");

    const panelRect = el.panel.getBoundingClientRect();
    const margin = 12;
    const x = clientX - panelRect.left + margin;
    const y = clientY - panelRect.top - margin;
    const tooltipWidth = el.chartTooltip.offsetWidth;
    const tooltipHeight = el.chartTooltip.offsetHeight;
    const maxLeft = panelRect.width - tooltipWidth - 8;
    const maxTop = panelRect.height - tooltipHeight - 8;
    const left = Math.max(8, Math.min(maxLeft, x));
    const top = Math.max(8, Math.min(maxTop, y - tooltipHeight));
    el.chartTooltip.style.left = `${left}px`;
    el.chartTooltip.style.top = `${top}px`;
  }

  function handleChartPointerMove(event) {
    if (!el.canvas || !state.chartModel || !state.chartModel.pointCount) {
      hideChartTooltip();
      return;
    }
    const rect = el.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const model = state.chartModel;
    if (x < model.padding.left || x > model.padding.left + model.width) {
      hideChartTooltip();
      return;
    }
    const rawIndex = model.pointCount > 1
      ? Math.round((x - model.padding.left) / model.step)
      : 0;
    const index = Math.max(0, Math.min(model.pointCount - 1, rawIndex));
    state.hoverIndex = index;
    renderChartTooltip(event.clientX, event.clientY, index);
  }

  function drawChart(bundle) {
    if (!el.canvas) return;
    const ctx = el.canvas.getContext("2d");
    if (!ctx) return;

    const containerWidth = el.canvas.clientWidth || 600;
    const containerHeight = el.canvas.clientHeight || 260;
    const dpr = window.devicePixelRatio || 1;
    el.canvas.width = Math.max(1, Math.floor(containerWidth * dpr));
    el.canvas.height = Math.max(1, Math.floor(containerHeight * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, containerWidth, containerHeight);

    const padding = { top: 18, right: 22, bottom: 30, left: 52 };
    const width = Math.max(1, containerWidth - padding.left - padding.right);
    const height = Math.max(1, containerHeight - padding.top - padding.bottom);

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + height);
    ctx.lineTo(padding.left + width, padding.top + height);
    ctx.stroke();

    if (!bundle) {
      state.chartModel = null;
      hideChartTooltip();
      renderEmptyState(true);
      return;
    }

    const chart = resolveChartPayload(bundle);
    const requests = chart.requests;
    const errors = chart.errors;
    const pointCount = Math.max(requests.length, errors.length);
    const combined = requests.concat(errors);
    const maxValue = Math.max(1, ...combined.map((point) => point.count));

    renderEmptyState(combined.length === 0 || combined.every((point) => point.count === 0));

    const yTicks = 4;
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    for (let i = 0; i <= yTicks; i += 1) {
      const ratio = i / yTicks;
      const y = padding.top + height - ratio * height;
      const value = maxValue * ratio;
      ctx.strokeStyle = i === 0 ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + width, y);
      ctx.stroke();
      ctx.fillText(formatDecimal(value, value >= 10 ? 0 : 2), 8, y + 3);
    }

    const step = pointCount > 1 ? width / (pointCount - 1) : width;

    function mapY(value) {
      return padding.top + height - (value / maxValue) * height;
    }

    function drawSeries(series, color) {
      if (!series.length) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      series.forEach((point, index) => {
        const x = padding.left + step * index;
        const y = mapY(point.count);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    const seriesColors = {
      requests: "#59d4ff",
      errors: "#ff9a78"
    };

    drawSeries(requests, seriesColors.requests);
    drawSeries(errors, seriesColors.errors);

    state.chartModel = {
      padding,
      width,
      step,
      pointCount,
      requests,
      errors
    };
  }

  function renderEmptyState(show) {
    if (!el.empty) return;
    el.empty.classList.toggle("hidden", !show);
  }

  function listToInline(items) {
    if (!Array.isArray(items) || !items.length) return "";
    return items
      .map((entry) => `<code>${escapeHtml(entry)}</code>`)
      .join(", ");
  }

  function renderSectionMissingNote(section) {
    const missing = Array.isArray(section?.missing_fields) ? section.missing_fields : [];
    if (!missing.length) return "";
    return `<div class="api-usage-note muted">Not collected yet: ${listToInline(missing)}</div>`;
  }

  function renderSectionNotes(section) {
    const notes = Array.isArray(section?.notes)
      ? section.notes
      : typeof section?.notes === "string" && section.notes.trim()
        ? [section.notes.trim()]
        : [];
    if (!notes.length) return "";
    return `<div class="api-usage-note muted">${escapeHtml(notes.join(" • "))}</div>`;
  }

  function numericOrNull(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function sanitizeEndpointRows(payload) {
    const rows = Array.isArray(payload) ? payload : [];
    return rows.map((row) => {
      const endpoint = row?.endpoint || row?.path || row?.route || "unknown";
      const hits = numericOrNull(row?.hits);
      const errors = numericOrNull(row?.errors);
      const rpm = numericOrNull(row?.rpm);
      const rowErrorRate = numericOrNull(row?.error_rate);
      const avgLatency = numericOrNull(
        row?.avg_latency_ms ?? row?.latency?.avg_ms ?? row?.latency_avg_ms
      );
      const p95Latency = numericOrNull(
        row?.p95_latency_ms ?? row?.latency?.p95_ms ?? row?.latency_p95_ms
      );
      const normalizedHits = Number.isFinite(hits) ? Math.max(0, hits) : 0;
      const normalizedErrors = Number.isFinite(errors) ? Math.max(0, errors) : 0;
      const computedErrorRate = normalizedHits > 0 ? normalizedErrors / normalizedHits : null;
      const errorRate = Number.isFinite(rowErrorRate) ? Math.max(0, rowErrorRate) : computedErrorRate;
      return {
        endpoint,
        hits: normalizedHits,
        rpm: Number.isFinite(rpm) ? rpm : 0,
        errors: normalizedErrors,
        error_rate: Number.isFinite(errorRate) ? errorRate : null,
        avg_latency_ms: Number.isFinite(avgLatency) ? Math.max(0, avgLatency) : null,
        p95_latency_ms: Number.isFinite(p95Latency) ? Math.max(0, p95Latency) : null
      };
    });
  }

  function classifyEndpointHealth(row) {
    const hits = Number(row?.hits ?? 0);
    if (hits < HEALTH_THRESHOLDS.minSampleHits) return "unknown";

    const errorRate = Number(row?.error_rate);
    const hasErrorRate = Number.isFinite(errorRate);
    const p95 = Number(row?.p95_latency_ms);
    const avg = Number(row?.avg_latency_ms);
    const hasP95 = Number.isFinite(p95);
    const hasAvg = Number.isFinite(avg);

    if (!hasP95 && !hasAvg && !hasErrorRate) return "unknown";

    if (hasErrorRate && errorRate > HEALTH_THRESHOLDS.errorRate.degradedMax) return "unhealthy";
    if (hasP95 && p95 > HEALTH_THRESHOLDS.p95LatencyMs.degradedMax) return "unhealthy";
    if (!hasP95 && hasAvg && avg > HEALTH_THRESHOLDS.avgLatencyMs.degradedMax) return "unhealthy";

    if (hasErrorRate && errorRate >= HEALTH_THRESHOLDS.errorRate.healthyMax) return "degraded";
    if (hasP95 && p95 >= HEALTH_THRESHOLDS.p95LatencyMs.healthyMax) return "degraded";
    if (!hasP95 && hasAvg && avg >= HEALTH_THRESHOLDS.avgLatencyMs.healthyMax) return "degraded";

    if (hasErrorRate || hasP95 || hasAvg) return "healthy";
    return "unknown";
  }

  function statusClass(status) {
    if (status === "healthy") return "pill-success";
    if (status === "degraded") return "pill-warning";
    if (status === "unhealthy") return "pill-critical";
    return "pill-default";
  }

  function quantile(sortedValues, q) {
    if (!sortedValues.length) return 0;
    const idx = (sortedValues.length - 1) * q;
    const low = Math.floor(idx);
    const high = Math.ceil(idx);
    if (low === high) return sortedValues[low];
    const ratio = idx - low;
    return sortedValues[low] * (1 - ratio) + sortedValues[high] * ratio;
  }

  function buildHeatMap(rows) {
    const hitsValues = rows
      .map((row) => Number(row?.hits ?? 0))
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b);

    if (!hitsValues.length) {
      return {
        thresholds: [0, 0, 0, 0],
        getBucketFor: () => 0
      };
    }

    const thresholds = [0.2, 0.4, 0.6, 0.8].map((q) => quantile(hitsValues, q));
    const min = hitsValues[0];
    const max = hitsValues[hitsValues.length - 1];
    const nearFlat = max - min <= Math.max(1, max * 0.02);

    let rankMap = null;
    if (nearFlat) {
      const ranked = [...rows].sort((left, right) => {
        const hitsCmp = compareValues(left.hits, right.hits, "desc");
        if (hitsCmp !== 0) return hitsCmp;
        return compareValues(left.endpoint, right.endpoint, "asc");
      });
      rankMap = new Map();
      ranked.forEach((row, index) => rankMap.set(row, index));
    }

    const getBucketFor = (row, index) => {
      const value = Number(row?.hits ?? 0);
      if (!Number.isFinite(value) || value <= 0) return 0;
      if (nearFlat) {
        if (rows.length <= 1) return 3;
        const rank = rankMap?.get(row);
        const safeRank = Number.isInteger(rank) ? rank : index;
        return 1 + Math.floor((safeRank / (rows.length - 1)) * 4);
      }
      if (value < thresholds[0]) return 1;
      if (value < thresholds[1]) return 2;
      if (value < thresholds[2]) return 3;
      if (value < thresholds[3]) return 4;
      return 5;
    };

    return { thresholds, getBucketFor };
  }

  function heatBucketClass(bucket) {
    if (!Number.isFinite(bucket) || bucket <= 0) {
      return "api-usage-heat-0";
    }
    return `api-usage-heat-${Math.min(5, Math.max(1, Math.floor(bucket)))}`;
  }

  function compareValues(a, b, direction) {
    if (typeof a === "string" || typeof b === "string") {
      const cmp = String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base" });
      return direction === "asc" ? cmp : -cmp;
    }
    const aNum = Number.isFinite(Number(a)) ? Number(a) : -Infinity;
    const bNum = Number.isFinite(Number(b)) ? Number(b) : -Infinity;
    if (aNum === bNum) return 0;
    const cmp = aNum > bNum ? 1 : -1;
    return direction === "asc" ? cmp : -cmp;
  }

  function sortEndpoints(rows) {
    const key = state.sort?.key || "hits";
    const direction = state.sort?.direction || "desc";
    return [...rows].sort((left, right) => compareValues(left[key], right[key], direction));
  }

  function renderEndpointsTable(rows) {
    if (!el.endpointHealth) return;

    if (!rows.length) {
      el.endpointHealth.innerHTML = `
        <div class="ss-empty-state api-usage-empty-state">
          No endpoint telemetry in this window yet.
        </div>
      `;
      return;
    }

    const sorted = sortEndpoints(rows);
    const heatMap = buildHeatMap(sorted);

    const headers = [
      ["endpoint", "Endpoint"],
      ["hits", "Hits"],
      ["rpm", "RPM"],
      ["errors", "Errors"],
      ["error_rate", "Error Rate"],
      ["avg_latency_ms", "Avg Latency"],
      ["p95_latency_ms", "P95 Latency"],
      ["status", "Status"]
    ];

    const headerHtml = headers
      .map(([key, label]) => {
        const isSorted = state.sort.key === key;
        const sortedClass = isSorted
          ? state.sort.direction === "asc"
            ? "sorted-asc"
            : "sorted-desc"
          : "";
        const ariaSort = isSorted
          ? state.sort.direction === "asc"
            ? "ascending"
            : "descending"
          : "none";
        return `
          <th class="sortable ${sortedClass}" data-sort-key="${escapeHtml(key)}" aria-sort="${ariaSort}">
            <span class="ss-sort-label">${escapeHtml(label)}</span>
            <span class="ss-sort-indicator" aria-hidden="true"></span>
          </th>
        `;
      })
      .join("");

    const bodyHtml = sorted
      .map((row, index) => {
        const bucket = heatMap.getBucketFor(row, index);
        const heatClass = heatBucketClass(bucket);
        const status = classifyEndpointHealth(row);
        return `
          <tr>
            <td><code>${escapeHtml(row.endpoint)}</code></td>
            <td class="${heatClass}">${formatInteger(row.hits)}</td>
            <td>${formatDecimal(row.rpm, 2)}</td>
            <td>${formatInteger(row.errors)}</td>
            <td>${formatPercent(row.error_rate)}</td>
            <td>${formatLatency(row.avg_latency_ms)}</td>
            <td>${formatLatency(row.p95_latency_ms)}</td>
            <td><span class="pill ${statusClass(status)}">${escapeHtml(toTitleCase(status))}</span></td>
          </tr>
        `;
      })
      .join("");

    el.endpointHealth.innerHTML = `
      <div class="api-usage-note muted">Endpoint health uses conservative thresholds: low sample (&lt;${HEALTH_THRESHOLDS.minSampleHits} hits) = Unknown; Healthy &lt;1% errors and low latency; Degraded at 1-5% errors or elevated latency; Unhealthy above 5% errors or severe latency.</div>
      <div class="api-usage-note muted">Heat: relative hits in selected window (adaptive quantile buckets).</div>
      <div class="ss-table-scroll api-usage-table-scroll" id="api-usage-endpoints-scroll">
        <table class="ss-table ss-table-compact" id="api-usage-endpoints-table">
          <thead>
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
    `;

    const table = $("api-usage-endpoints-table");
    if (!table) return;

    table.querySelectorAll("th.sortable[data-sort-key]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort-key") || "hits";
        if (state.sort.key === key) {
          state.sort.direction = state.sort.direction === "asc" ? "desc" : "asc";
        } else {
          state.sort.key = key;
          state.sort.direction = key === "endpoint" || key === "status" ? "asc" : "desc";
        }
        renderEndpointsTable(rows);
      });
    });
  }

  function getRenderableArrays(section) {
    if (!section || typeof section !== "object") return [];
    return Object.entries(section).filter(([key, value]) => {
      if (["missing_fields", "notes", "regression_flags"].includes(key)) return false;
      return Array.isArray(value) && value.length > 0 && value.every((entry) => entry && typeof entry === "object");
    });
  }

  function getRenderableScalars(section) {
    if (!section || typeof section !== "object") return [];
    return Object.entries(section).filter(([key, value]) => {
      if (["missing_fields", "notes", "regression_flags"].includes(key)) return false;
      if (Array.isArray(value) || (value && typeof value === "object")) return false;
      return value !== undefined && value !== null && String(value).trim() !== "";
    });
  }

  function renderScalarGrid(items) {
    if (!items.length) return "";
    const cards = items
      .map(([key, value]) => {
        const printable = typeof value === "number" ? formatDecimal(value, 2) : String(value);
        return `
          <div class="api-usage-stat-card">
            <div class="api-usage-stat-label">${escapeHtml(toTitleCase(key))}</div>
            <div class="api-usage-stat-value">${escapeHtml(printable)}</div>
          </div>
        `;
      })
      .join("");
    return `<div class="api-usage-stat-grid">${cards}</div>`;
  }

  function renderObjectTable(title, rows) {
    if (!Array.isArray(rows) || !rows.length) return "";
    const keySet = new Set();
    rows.forEach((row) => {
      Object.keys(row || {}).forEach((key) => keySet.add(key));
    });
    const columns = [...keySet].slice(0, 8);
    if (!columns.length) return "";

    const head = columns
      .map((key) => `<th>${escapeHtml(toTitleCase(key))}</th>`)
      .join("");

    const body = rows
      .map((row) => {
        const cells = columns
          .map((key) => {
            const value = row?.[key];
            if (value === undefined || value === null || value === "") return "<td>--</td>";
            if (typeof value === "number") return `<td>${escapeHtml(formatDecimal(value, 2))}</td>`;
            if (typeof value === "boolean") return `<td>${value ? "true" : "false"}</td>`;
            return `<td>${escapeHtml(String(value))}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");

    return `
      <div class="api-usage-subsection">
        <div class="api-usage-subtitle">${escapeHtml(toTitleCase(title))}</div>
        <div class="ss-table-scroll api-usage-table-scroll">
          <table class="ss-table ss-table-compact">
            <thead><tr>${head}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderGenericSection(root, section, options = {}) {
    if (!root) return;

    const scalarItems = getRenderableScalars(section);
    const arrays = getRenderableArrays(section);
    const hasContent = scalarItems.length > 0 || arrays.length > 0;
    const missing = renderSectionMissingNote(section);
    const notes = renderSectionNotes(section);

    if (!hasContent) {
      root.innerHTML = `
        <div class="ss-empty-state api-usage-empty-state">${escapeHtml(options.emptyMessage || "No telemetry available for this window.")}</div>
        ${missing}
        ${notes}
      `;
      return;
    }

    const tables = arrays
      .map(([title, rows]) => renderObjectTable(title, rows))
      .join("");

    root.innerHTML = `
      ${renderScalarGrid(scalarItems)}
      ${tables}
      ${missing}
      ${notes}
    `;
  }

  function renderVersionRegression(section) {
    if (!el.versionRegression) return;

    const flags = Array.isArray(section?.regression_flags) ? section.regression_flags : [];
    const flagsHtml = flags.length
      ? `<div class="api-usage-flags">${flags
          .map((flag) => `<span class="pill pill-warning">${escapeHtml(toTitleCase(flag))}</span>`)
          .join("")}</div>`
      : "";

    const scalarItems = getRenderableScalars(section);
    const arrays = getRenderableArrays(section);
    const missing = renderSectionMissingNote(section);
    const notes = renderSectionNotes(section);

    const hasContent = scalarItems.length > 0 || arrays.length > 0 || flags.length > 0;
    if (!hasContent) {
      el.versionRegression.innerHTML = `
        <div class="ss-empty-state api-usage-empty-state">
          No version comparison data in this window.
        </div>
        ${missing}
        ${notes}
      `;
      return;
    }

    const tables = arrays
      .map(([title, rows]) => renderObjectTable(title, rows))
      .join("");

    el.versionRegression.innerHTML = `
      ${renderScalarGrid(scalarItems)}
      ${flagsHtml}
      ${tables}
      ${missing}
      ${notes}
    `;
  }

  function renderAllSections(bundle) {
    const endpointRows = sanitizeEndpointRows(bundle?.endpoints);
    renderEndpointsTable(endpointRows);

    renderGenericSection(el.authSignals, bundle?.auth_access_signals, {
      emptyMessage: "Auth and access signals are not available yet for this runtime window."
    });

    renderGenericSection(el.tierSurface, bundle?.tier_surface_usage, {
      emptyMessage: "No tier/surface breakdown data was emitted for this window."
    });

    renderVersionRegression(bundle?.version_regression);
  }

  function renderGracefulEmpty() {
    renderEndpointsTable([]);
    renderGenericSection(el.authSignals, null, {
      emptyMessage: "Auth and access signals are unavailable right now."
    });
    renderGenericSection(el.tierSurface, null, {
      emptyMessage: "Tier and surface usage is unavailable right now."
    });
    renderVersionRegression(null);
  }

  async function runWithLoader(task, reason, withLoader) {
    if (withLoader && window.StreamSuitesGlobalLoader?.trackAsync) {
      return window.StreamSuitesGlobalLoader.trackAsync(task, reason || "Hydrating API usage...");
    }
    return task();
  }

  function updateWindowSelection() {
    if (!el.windowSelect) return;
    const value = String(el.windowSelect.value || "").trim();
    state.selectedWindow = value || DEFAULT_WINDOW;
    if (el.window) {
      el.window.textContent = formatWindowLabel(state.selectedWindow);
    }
  }

  function scheduleNextPoll() {
    if (state.destroyed) return;
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      fetchBundle({ withLoader: false, trigger: "poll" });
    }, POLL_INTERVAL_MS);
  }

  async function fetchBundle(options = {}) {
    const withLoader = options.withLoader === true;
    const trigger = options.trigger || "manual";

    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }

    const task = async () => {
      setStatus("Loading live metrics...");
      setBanner("", false);

      if (state.abortController) {
        state.abortController.abort();
      }

      const controller = new AbortController();
      state.abortController = controller;
      const timeout = setTimeout(() => controller.abort(), 2000);

      try {
        const url = `${buildApiUrl(RUNTIME_ENDPOINT)}?window=${encodeURIComponent(state.selectedWindow)}`;
        const response = await fetch(url, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json"
          },
          signal: controller.signal
        });

        if (response.status === 401 || response.status === 403) {
          state.online = false;
          state.data = null;
          setSummary(null);
          setStatus("Admin session required. Sign in to view API usage.");
          setBanner("Live telemetry unavailable. Your admin session is missing or expired.", true, "danger");
          drawChart(null);
          renderGracefulEmpty();
          return;
        }

        if (!response.ok) {
          let details = "";
          try {
            details = await response.text();
          } catch (err) {
            details = "";
          }
          const suffix = details ? `: ${details.slice(0, 220)}` : "";
          throw new Error(`Runtime error ${response.status}${suffix}`);
        }

        const payload = await response.json();
        state.online = true;
        state.data = payload;
        state.lastFetchedAt = Date.now();

        setSummary(payload);
        setStatus(
          trigger === "poll" ? "Live runtime metrics" : `Live runtime metrics (${formatWindowLabel(state.selectedWindow)})`
        );
        setBanner("", false);

        drawChart(payload);
        renderAllSections(payload);
      } catch (err) {
        state.online = false;
        state.data = null;
        setSummary(null);
        setStatus("Runtime telemetry unavailable");
        setBanner(`Live telemetry unavailable. ${err?.message || "Unable to reach runtime endpoint."}`, true, "danger");
        drawChart(null);
        renderGracefulEmpty();
      } finally {
        clearTimeout(timeout);
        if (state.abortController === controller) {
          state.abortController = null;
        }
      }
    };

    try {
      await runWithLoader(task, "Hydrating API usage...", withLoader);
    } finally {
      scheduleNextPoll();
    }
  }

  function handleResize() {
    drawChart(state.data);
    hideChartTooltip();
  }

  function handleWindowChange() {
    updateWindowSelection();
    fetchBundle({ withLoader: true, trigger: "window-change" });
  }

  function init() {
    state.destroyed = false;

    el.banner = $("api-usage-banner");
    el.status = $("api-usage-status");
    el.rpm = $("api-usage-rpm");
    el.errorRate = $("api-usage-error-rate");
    el.window = $("api-usage-window");
    el.generatedAt = $("api-usage-generated-at");
    el.windowSelect = $("api-usage-window-select");
    el.panel = $("api-usage-chart-panel");
    el.canvas = $("api-usage-chart");
    el.empty = $("api-usage-empty");
    el.chartLegend = $("api-usage-chart-legend");
    el.chartTooltip = $("api-usage-chart-tooltip");
    el.endpointHealth = $("api-usage-endpoint-health");
    el.authSignals = $("api-usage-auth-signals");
    el.tierSurface = $("api-usage-tier-surface");
    el.versionRegression = $("api-usage-version-regression");

    ensureChartChrome();

    window.addEventListener("resize", handleResize);
    if (el.canvas) {
      el.canvas.addEventListener("mousemove", handleChartPointerMove);
      el.canvas.addEventListener("mouseleave", hideChartTooltip);
    }

    if (el.panel && "ResizeObserver" in window) {
      state.resizeObserver = new ResizeObserver(() => {
        drawChart(state.data);
      });
      state.resizeObserver.observe(el.panel);
    }

    if (el.windowSelect) {
      if (![...el.windowSelect.options].some((option) => option.value === String(el.windowSelect.value))) {
        el.windowSelect.value = DEFAULT_WINDOW;
      }
      updateWindowSelection();
      el.windowSelect.addEventListener("change", handleWindowChange);
    }

    renderGracefulEmpty();
    fetchBundle({ withLoader: true, trigger: "init" });
  }

  function destroy() {
    state.destroyed = true;

    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }

    if (state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }

    window.removeEventListener("resize", handleResize);
    if (el.canvas) {
      el.canvas.removeEventListener("mousemove", handleChartPointerMove);
      el.canvas.removeEventListener("mouseleave", hideChartTooltip);
    }

    if (el.windowSelect) {
      el.windowSelect.removeEventListener("change", handleWindowChange);
    }

    if (state.resizeObserver) {
      state.resizeObserver.disconnect();
      state.resizeObserver = null;
    }
  }

  window.ApiUsageView = {
    init,
    destroy
  };
})();

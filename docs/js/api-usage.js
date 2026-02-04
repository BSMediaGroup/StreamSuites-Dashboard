/* ============================================================
   StreamSuites Dashboard - API Usage view
   ============================================================ */

(() => {
  "use strict";

  const RUNTIME_ENDPOINT = "/admin/metrics/api-usage";
  const POLL_INTERVAL_MS = 5000;
  const DEFAULT_WINDOW_SECONDS = 300;

  const state = {
    timer: null,
    data: null,
    online: false,
    resizeObserver: null,
    windowSeconds: DEFAULT_WINDOW_SECONDS
  };

  const el = {
    banner: null,
    status: null,
    rpm: null,
    errorRate: null,
    window: null,
    windowSelect: null,
    panel: null,
    canvas: null,
    empty: null
  };

  function $(id) {
    return document.getElementById(id);
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

  function setBanner(message, visible) {
    if (!el.banner) return;
    el.banner.textContent = message;
    el.banner.classList.toggle("hidden", !visible);
  }

  function setStatus(message) {
    if (el.status) el.status.textContent = message;
  }

  function setSummary(metrics) {
    if (!metrics) {
      if (el.rpm) el.rpm.textContent = "--";
      if (el.errorRate) el.errorRate.textContent = "--";
      if (el.window) el.window.textContent = "--";
      updateWindowLabelFromSelection();
      return;
    }
    const rpm = metrics.summary?.rpm ?? "--";
    const errorRate = metrics.summary?.error_rate;
    const windowSeconds = metrics.window_seconds ?? "--";
    if (el.rpm) el.rpm.textContent = String(rpm);
    if (el.errorRate) {
      el.errorRate.textContent =
        typeof errorRate === "number" ? `${(errorRate * 100).toFixed(2)}%` : "--";
    }
    if (el.window) el.window.textContent = `${windowSeconds}s`;
    updateWindowLabelFromSelection();
  }

  function updateWindowLabelFromSelection() {
    if (!el.window || !el.windowSelect) return;
    const label = el.windowSelect.selectedOptions?.[0]?.textContent;
    if (label) el.window.textContent = label;
  }

  function syncWindowSelection() {
    if (!el.windowSelect) return;
    const value = Number(el.windowSelect.value);
    if (Number.isFinite(value) && value > 0) {
      state.windowSeconds = value;
    } else {
      state.windowSeconds = DEFAULT_WINDOW_SECONDS;
    }
    updateWindowLabelFromSelection();
  }

  function handleWindowChange() {
    syncWindowSelection();
    fetchMetrics();
  }

  function normalizeSeries(series) {
    if (!Array.isArray(series)) return [];
    return series
      .map((point) => ({
        ts: Number(point?.ts ?? 0),
        count: Number(point?.count ?? 0)
      }))
      .filter((point) => Number.isFinite(point.ts) && Number.isFinite(point.count));
  }

  function drawChart(metrics) {
    if (!el.canvas) return;
    const ctx = el.canvas.getContext("2d");
    if (!ctx) return;

    const containerWidth = el.canvas.clientWidth || 600;
    const containerHeight = el.canvas.clientHeight || 260;
    const dpr = window.devicePixelRatio || 1;
    el.canvas.width = containerWidth * dpr;
    el.canvas.height = containerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, containerWidth, containerHeight);

    const padding = { top: 24, right: 20, bottom: 28, left: 40 };
    const width = containerWidth - padding.left - padding.right;
    const height = containerHeight - padding.top - padding.bottom;

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + height);
    ctx.lineTo(padding.left + width, padding.top + height);
    ctx.stroke();

    if (!metrics) {
      renderEmptyState(true);
      return;
    }

    const requests = normalizeSeries(metrics.requests_per_sec);
    const errors = normalizeSeries(metrics.errors_per_sec);
    const maxValue = Math.max(
      1,
      ...requests.map((point) => point.count),
      ...errors.map((point) => point.count)
    );

    renderEmptyState(maxValue <= 1 && requests.every((point) => point.count === 0));

    const points = requests.length || errors.length ? requests.length : 0;
    const step = points > 1 ? width / (points - 1) : width;

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
      requests: "#4dd0e1",
      errors: "#ff8f66"
    };

    drawSeries(requests, seriesColors.requests);
    drawSeries(errors, seriesColors.errors);

    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    const legendY = padding.top - 8;
    const legendItems = [
      { label: "Requests/sec", color: seriesColors.requests },
      { label: "Errors/sec", color: seriesColors.errors }
    ];
    let legendX = padding.left;
    legendItems.forEach((item) => {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(legendX, legendY - 4);
      ctx.lineTo(legendX + 18, legendY - 4);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillText(item.label, legendX + 24, legendY);
      legendX += 24 + ctx.measureText(item.label).width + 20;
    });
  }

  function renderEmptyState(show) {
    if (!el.empty) return;
    el.empty.classList.toggle("hidden", !show);
  }

  async function fetchMetrics() {
    if (state.timer) clearTimeout(state.timer);
    setStatus("Loading live metrics...");
    setBanner("", false);

    const pollingTimestamp = new Date().toISOString();
    const windowSeconds = Number(state.windowSeconds);
    let apiUrl = buildApiUrl(RUNTIME_ENDPOINT);
    if (Number.isFinite(windowSeconds) && windowSeconds > 0) {
      apiUrl += `?window=${encodeURIComponent(windowSeconds)}`;
    }
    console.log(`[API Usage][${pollingTimestamp}] Polling ${apiUrl}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(apiUrl, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        signal: controller.signal
      });
      if (res.status === 401 || res.status === 403) {
        state.online = false;
        state.data = null;
        setSummary(null);
        setStatus("Admin session required. Sign in to view metrics.");
        setBanner("Your admin session is missing or expired. Sign in to continue.", true);
        drawChart(null);
      } else if (!res.ok) {
        throw new Error(`Runtime error ${res.status}`);
      } else {
        const payloadText = await res.text();
        const payloadBytes = new TextEncoder().encode(payloadText).length;
        console.log(
          `[API Usage][${pollingTimestamp}] Raw payload (${payloadBytes} bytes) from ${apiUrl}:`,
          payloadText
        );
        state.data = JSON.parse(payloadText);
        const requestsSeries = Array.isArray(state.data?.requests_per_sec)
          ? state.data.requests_per_sec
          : [];
        const errorsSeries = Array.isArray(state.data?.errors_per_sec)
          ? state.data.errors_per_sec
          : [];
        const requestsFirst = requestsSeries.length ? requestsSeries[0]?.ts : null;
        const requestsLast = requestsSeries.length
          ? requestsSeries[requestsSeries.length - 1]?.ts
          : null;
        const errorsFirst = errorsSeries.length ? errorsSeries[0]?.ts : null;
        const errorsLast = errorsSeries.length ? errorsSeries[errorsSeries.length - 1]?.ts : null;
        console.log(
          `[API Usage][${pollingTimestamp}] Parsed series from ${apiUrl}: ` +
            `requests_per_sec=${requestsSeries.length} (first_ts=${requestsFirst}, last_ts=${requestsLast}), ` +
            `errors_per_sec=${errorsSeries.length} (first_ts=${errorsFirst}, last_ts=${errorsLast})`
        );
        state.online = true;
        setSummary(state.data);
        setStatus("Live runtime metrics");
        setBanner("", false);
        drawChart(state.data);
      }
    } catch (err) {
      state.online = false;
      state.data = null;
      setSummary(null);
      setStatus("Runtime offline. Waiting for reconnect...");
      setBanner("Runtime offline. Metrics will resume when the API returns.", true);
      drawChart(null);
    } finally {
      clearTimeout(timer);
      state.timer = setTimeout(fetchMetrics, POLL_INTERVAL_MS);
    }
  }

  function handleResize() {
    drawChart(state.data);
  }

  function init() {
    el.banner = $("api-usage-banner");
    el.status = $("api-usage-status");
    el.rpm = $("api-usage-rpm");
    el.errorRate = $("api-usage-error-rate");
    el.window = $("api-usage-window");
    el.windowSelect = $("api-usage-window-select");
    el.panel = $("api-usage-chart-panel");
    el.canvas = $("api-usage-chart");
    el.empty = $("api-usage-empty");
    window.addEventListener("resize", handleResize);
    if (el.panel && "ResizeObserver" in window) {
      state.resizeObserver = new ResizeObserver(() => {
        drawChart(state.data);
      });
      state.resizeObserver.observe(el.panel);
    }
    if (el.windowSelect) {
      syncWindowSelection();
      el.windowSelect.addEventListener("change", handleWindowChange);
    }
    fetchMetrics();
  }

  function destroy() {
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    window.removeEventListener("resize", handleResize);
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

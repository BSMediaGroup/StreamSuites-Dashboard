/* ============================================================
   StreamSuites Dashboard - Analytics view
   ============================================================ */

(() => {
  "use strict";

  const DEFAULT_WINDOW = "5m";
  const ANALYTICS_CACHE_TTL_MS = 8000;
  const ANALYTICS_REFRESH_INTERVAL_MS = 15000;
  const TOP_REFERRERS_LIMIT = 8;
  const COUNTRY_CENTROIDS_PATH = "/shared/data/country_centroids.json";

  const DEFAULT_MAP_STYLE_URL =
    "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

  const SOURCE_ID = "ss-analytics-country-points";
  const LAYERS = {
    clusterHalo: "ss-analytics-cluster-halo",
    clusterCore: "ss-analytics-cluster-core",
    clusterLabel: "ss-analytics-cluster-label",
    pointHalo: "ss-analytics-point-halo",
    pointCore: "ss-analytics-point-core"
  };

  const FALLBACK_COUNTRY_CENTROIDS = {
    US: [-98.5795, 39.8283],
    CA: [-106.3468, 56.1304],
    MX: [-102.5528, 23.6345],
    BR: [-51.9253, -14.235],
    AR: [-63.6167, -38.4161],
    CL: [-71.543, -35.6751],
    CO: [-74.2973, 4.5709],
    PE: [-75.0152, -9.19],
    VE: [-66.5897, 6.4238],
    GB: [-3.436, 55.3781],
    IE: [-8.2439, 53.4129],
    FR: [2.2137, 46.2276],
    DE: [10.4515, 51.1657],
    ES: [-3.7492, 40.4637],
    IT: [12.5674, 41.8719],
    NL: [5.2913, 52.1326],
    BE: [4.4699, 50.5039],
    CH: [8.2275, 46.8182],
    AT: [14.5501, 47.5162],
    SE: [18.6435, 60.1282],
    NO: [8.4689, 60.472],
    DK: [9.5018, 56.2639],
    FI: [25.7482, 61.9241],
    PL: [19.1451, 51.9194],
    PT: [-8.2245, 39.3999],
    CZ: [15.473, 49.8175],
    RO: [24.9668, 45.9432],
    GR: [21.8243, 39.0742],
    TR: [35.2433, 38.9637],
    RU: [105.3188, 61.524],
    UA: [31.1656, 48.3794],
    IL: [34.8516, 31.0461],
    SA: [45.0792, 23.8859],
    AE: [53.8478, 23.4241],
    EG: [30.8025, 26.8206],
    ZA: [22.9375, -30.5595],
    NG: [8.6753, 9.082],
    KE: [37.9062, -0.0236],
    MA: [-7.0926, 31.7917],
    IN: [78.9629, 20.5937],
    PK: [69.3451, 30.3753],
    BD: [90.3563, 23.685],
    CN: [104.1954, 35.8617],
    JP: [138.2529, 36.2048],
    KR: [127.7669, 35.9078],
    TW: [120.9605, 23.6978],
    HK: [114.1694, 22.3193],
    SG: [103.8198, 1.3521],
    TH: [100.9925, 15.87],
    VN: [108.2772, 14.0583],
    ID: [113.9213, -0.7893],
    MY: [101.9758, 4.2105],
    PH: [121.774, 12.8797],
    AU: [133.7751, -25.2744],
    NZ: [174.886, -40.9006]
  };

  const state = {
    map: null,
    mapReady: false,
    selectedWindow: DEFAULT_WINDOW,
    pendingGeoJson: emptyGeoJson(),
    destroyed: false,
    abortController: null,
    refreshHandle: null,
    countryCentroids: null,
    countryCentroidsPromise: null
  };

  const el = {
    map: null,
    mapFeedback: null,
    banner: null,
    status: null,
    windowSelect: null,
    referrersList: null,
    referrersEmpty: null,
    totalRequests: null,
    windowLabel: null,
    generatedAt: null,
    surfacesList: null,
    surfacesEmpty: null
  };
  let surfacesClickBound = false;

  function $(id) {
    return document.getElementById(id);
  }

  function resolveMapStyleUrl() {
    const override = window.SS_ANALYTICS_MAP_STYLE_URL;
    if (typeof override === "string" && override.trim()) {
      return override.trim();
    }
    return DEFAULT_MAP_STYLE_URL;
  }

  function promptAdminReauth() {
    if (typeof window.StreamSuitesAdminGate?.logout === "function") {
      window.StreamSuitesAdminGate.logout();
      return;
    }
    if (typeof window.StreamSuitesAdminAuth?.logout === "function") {
      window.StreamSuitesAdminAuth.logout();
    }
  }

  function emptyGeoJson() {
    return {
      type: "FeatureCollection",
      features: []
    };
  }

  function setBanner(message, isVisible, options = {}) {
    if (!el.banner) return;
    el.banner.innerHTML = "";
    if (isVisible) {
      const text = document.createElement("span");
      text.textContent = message;
      el.banner.appendChild(text);
      if (options.retryAction) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ss-btn ss-btn-secondary ss-btn-small";
        button.setAttribute("data-analytics-retry", options.retryAction);
        button.textContent = "Retry";
        el.banner.appendChild(document.createTextNode(" "));
        el.banner.appendChild(button);
      }
    }
    el.banner.classList.toggle("hidden", !isVisible);
  }

  function setStatus(message) {
    if (el.status) {
      el.status.textContent = message || "";
    }
  }

  function setMapFeedback(message, options = {}) {
    if (!el.mapFeedback) return;
    const text = String(message || "").trim();
    const isError = options.isError === true;
    if (!text) {
      el.mapFeedback.textContent = "";
      el.mapFeedback.classList.add("hidden");
      el.map?.classList.remove("is-error");
      return;
    }
    el.mapFeedback.textContent = text;
    el.mapFeedback.classList.remove("hidden");
    el.map?.classList.toggle("is-error", isError);
  }

  function formatNumber(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "--";
    return Math.round(num).toLocaleString();
  }

  function formatTimestamp(value) {
    if (!value) return "--";
    if (typeof window.StreamSuitesState?.formatTimestamp === "function") {
      const formatted = window.StreamSuitesState.formatTimestamp(value);
      if (formatted) return formatted;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, {
      hour12: false,
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
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

  async function loadCountryCentroids() {
    if (state.countryCentroids) return state.countryCentroids;
    if (state.countryCentroidsPromise) return state.countryCentroidsPromise;

    state.countryCentroidsPromise = fetch(COUNTRY_CENTROIDS_PATH, {
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json"
      }
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Centroid request failed (${response.status})`);
        }
        const payload = await response.json();
        const normalized = {};
        if (payload && typeof payload === "object") {
          Object.entries(payload).forEach(([code, coords]) => {
            const iso2 = String(code || "").trim().toUpperCase();
            if (!iso2 || !Array.isArray(coords) || coords.length !== 2) return;
            const lon = Number(coords[0]);
            const lat = Number(coords[1]);
            if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
            normalized[iso2] = [lon, lat];
          });
        }
        state.countryCentroids = {
          ...FALLBACK_COUNTRY_CENTROIDS,
          ...normalized
        };
        return state.countryCentroids;
      })
      .catch(() => {
        state.countryCentroids = FALLBACK_COUNTRY_CENTROIDS;
        return state.countryCentroids;
      })
      .finally(() => {
        state.countryCentroidsPromise = null;
      });

    return state.countryCentroidsPromise;
  }

  function applyGeoJson(geojson) {
    state.pendingGeoJson = geojson;
    if (!state.map) return;
    const source = state.map.getSource(SOURCE_ID);
    if (!source) return;
    source.setData(geojson);
  }

  function ensureMapLayers() {
    if (!state.map || !state.mapReady) return;
    const map = state.map;

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: state.pendingGeoJson || emptyGeoJson(),
        cluster: true,
        clusterRadius: 42,
        clusterProperties: {
          sum: [
            "+",
            ["coalesce", ["get", "sessions"], ["get", "requests"], 0]
          ]
        }
      });
    }

    if (!map.getLayer(LAYERS.clusterHalo)) {
      map.addLayer({
        id: LAYERS.clusterHalo,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#56c9ff",
          "circle-opacity": 0.2,
          "circle-blur": 0.7,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "sum"],
            1, 16,
            20, 24,
            80, 34,
            200, 44
          ]
        }
      });
    }

    if (!map.getLayer(LAYERS.clusterCore)) {
      map.addLayer({
        id: LAYERS.clusterCore,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#a8ecff",
          "circle-opacity": 0.88,
          "circle-stroke-color": "rgba(255,255,255,0.8)",
          "circle-stroke-width": 0.8,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "sum"],
            1, 6,
            20, 10,
            80, 14,
            200, 18
          ]
        }
      });
    }

    if (!map.getLayer(LAYERS.clusterLabel)) {
      map.addLayer({
        id: LAYERS.clusterLabel,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["to-string", ["get", "sum"]],
          "text-size": 11
        },
        paint: {
          "text-color": "#07131c"
        }
      });
    }

    if (!map.getLayer(LAYERS.pointHalo)) {
      map.addLayer({
        id: LAYERS.pointHalo,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#6ed6ff",
          "circle-opacity": 0.22,
          "circle-blur": 0.65,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "sessions"], ["get", "requests"], 0],
            1, 9,
            10, 13,
            50, 18,
            150, 24
          ]
        }
      });
    }

    if (!map.getLayer(LAYERS.pointCore)) {
      map.addLayer({
        id: LAYERS.pointCore,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#c7f4ff",
          "circle-opacity": 0.95,
          "circle-stroke-color": "rgba(255,255,255,0.82)",
          "circle-stroke-width": 0.75,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "sessions"], ["get", "requests"], 0],
            1, 3.2,
            10, 4.8,
            50, 7.2,
            150, 9.4
          ]
        }
      });
    }

    const source = map.getSource(SOURCE_ID);
    if (source) {
      source.setData(state.pendingGeoJson || emptyGeoJson());
    }

    if (!map.__ssAnalyticsPopup) {
      map.__ssAnalyticsPopup = new window.maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 10
      });
    }

    if (!map.__ssAnalyticsHoverBound) {
      map.on("mouseenter", LAYERS.pointCore, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", LAYERS.pointCore, () => {
        map.getCanvas().style.cursor = "";
        map.__ssAnalyticsPopup?.remove();
      });
      map.on("mousemove", LAYERS.pointCore, (event) => {
        const feature = event?.features?.[0];
        if (!feature) return;
        const props = feature.properties || {};
        const country = String(props.country || "--").toUpperCase();
        const sessionsRaw = Number(props.sessions ?? 0);
        const requestsRaw = Number(props.requests ?? 0);
        const sessions = Number.isFinite(sessionsRaw) ? Math.max(0, Math.round(sessionsRaw)) : 0;
        const requests = Number.isFinite(requestsRaw) ? Math.max(0, Math.round(requestsRaw)) : 0;
        map.__ssAnalyticsPopup
          ?.setLngLat(event.lngLat)
          .setHTML(
            `<strong>${escapeHtml(country)}</strong><br>Sessions: ${escapeHtml(
              formatNumber(sessions)
            )}<br>Requests: ${escapeHtml(formatNumber(requests))}`
          )
          .addTo(map);
      });
      map.__ssAnalyticsHoverBound = true;
    }
  }

  function initMap() {
    if (!el.map || !el.mapFeedback) return;
    if (state.map) return;

    if (!window.maplibregl || typeof window.maplibregl.Map !== "function") {
      setMapFeedback("Map unavailable: map library failed to load.", { isError: true });
      return;
    }

    try {
      state.map = new window.maplibregl.Map({
        container: el.map,
        style: resolveMapStyleUrl(),
        center: [10, 20],
        zoom: 1.15,
        minZoom: 1,
        maxZoom: 5,
        projection: "mercator",
        attributionControl: false,
        pitch: 0,
        bearing: 0,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false
      });
    } catch (err) {
      setMapFeedback("Map unavailable: unable to initialize renderer.", { isError: true });
      return;
    }

    state.map.dragRotate?.disable();
    state.map.touchZoomRotate?.disableRotation();
    state.map.keyboard?.disableRotation();
    state.map.addControl(
      new window.maplibregl.NavigationControl({
        showCompass: false,
        visualizePitch: false
      }),
      "top-right"
    );

    state.map.on("error", (event) => {
      if (state.mapReady) return;
      const detail =
        event?.error?.message ||
        event?.error?.statusText ||
        "style or tiles failed to load.";
      setMapFeedback(`Map unavailable: ${detail}`, { isError: true });
    });

    state.map.once("load", () => {
      state.mapReady = true;
      ensureMapLayers();
    });
  }

  function normalizeCountryRows(byCountry) {
    if (Array.isArray(byCountry)) {
      return byCountry;
    }
    if (byCountry && typeof byCountry === "object") {
      return Object.entries(byCountry).map(([country, value]) => {
        if (value && typeof value === "object") {
          return {
            country,
            requests: value.requests,
            sessions: value.sessions,
            count: value.count
          };
        }
        return {
          country,
          requests: value,
          sessions: value
        };
      });
    }
    return [];
  }

  function toMapFeature(entry, centroids) {
    const code = String(entry?.country || entry?.code || "").trim().toUpperCase();
    if (!code || code === "ZZ") return null;
    const centroid = centroids?.[code];
    if (!Array.isArray(centroid) || centroid.length !== 2) return null;
    const requestsRaw = Number(entry?.requests ?? entry?.count ?? 0);
    const sessionsRaw = Number(entry?.sessions ?? entry?.count ?? requestsRaw);
    const requests = Number.isFinite(requestsRaw) ? Math.max(0, Math.round(requestsRaw)) : 0;
    const sessions = Number.isFinite(sessionsRaw) ? Math.max(0, Math.round(sessionsRaw)) : requests;
    if (requests <= 0 && sessions <= 0) return null;
    return {
      type: "Feature",
      properties: {
        country: code,
        requests,
        sessions
      },
      geometry: {
        type: "Point",
        coordinates: centroid
      }
    };
  }

  async function updateMap(countryRows, options = {}) {
    const rows = normalizeCountryRows(countryRows);
    const centroids = await loadCountryCentroids();
    const features = rows.map((entry) => toMapFeature(entry, centroids)).filter(Boolean);
    applyGeoJson({
      type: "FeatureCollection",
      features
    });

    if (options.errorMessage) {
      setMapFeedback(options.errorMessage, { isError: true });
      return;
    }
    if (!rows.length) {
      setMapFeedback("No country analytics yet for this window.");
      return;
    }
    if (!features.length) {
      setMapFeedback("Country data exists, but no supported country centroids were available to map.");
      return;
    }
    setMapFeedback("");
  }

  function normalizeReferrers(referrers) {
    const rows = Array.isArray(referrers) ? referrers : [];
    return rows
      .map((entry) => {
        const domain = String(entry?.host || entry?.domain || entry?.referrer || "unknown").trim() || "unknown";
        const count = Number(entry?.count ?? 0);
        return {
          domain,
          count: Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0
        };
      })
      .filter((entry) => entry.count > 0)
      .sort((left, right) => right.count - left.count)
      .slice(0, TOP_REFERRERS_LIMIT);
  }

  function renderReferrers(referrers) {
    if (!el.referrersList || !el.referrersEmpty) return;
    const rows = normalizeReferrers(referrers);
    if (!rows.length) {
      el.referrersList.innerHTML = "";
      el.referrersEmpty.classList.remove("hidden");
      return;
    }

    el.referrersEmpty.classList.add("hidden");
    el.referrersList.innerHTML = rows
      .map((entry) => {
        return `
          <li>
            <span>${escapeHtml(entry.domain)}</span>
            <strong>${escapeHtml(formatNumber(entry.count))}</strong>
          </li>
        `;
      })
      .join("");
  }

  function normalizeSurfaces(surfaces) {
    if (Array.isArray(surfaces)) {
      return surfaces
        .map((entry) => {
          if (entry && typeof entry === "object") {
            const key = String(entry.surface || entry.name || entry.key || "unknown").trim() || "unknown";
            const count = Number(entry.count ?? entry.value ?? 0);
            return {
              key,
              count: Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0
            };
          }
          return null;
        })
        .filter(Boolean)
        .sort((left, right) => right.count - left.count);
    }

    if (surfaces && typeof surfaces === "object") {
      return Object.entries(surfaces)
        .map(([key, value]) => {
          const count = Number(value ?? 0);
          return {
            key: String(key || "unknown"),
            count: Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0
          };
        })
        .sort((left, right) => right.count - left.count);
    }

    return [];
  }

  function resolveSurfaceViewHash(key) {
    const normalized = String(key || "").trim().toLowerCase();
    const directMap = {
      overview: "#overview",
      analytics: "#analytics",
      accounts: "#accounts",
      donations: "#accounts",
      "data-signals": "#data-signals",
      telemetry: "#overview",
      "auth-events": "#overview",
      "auth_events": "#overview",
      "admin-activity": "#overview",
      "admin_activity": "#overview",
      "api-usage": "#api-usage",
      "api_usage": "#api-usage"
    };
    if (directMap[normalized]) return directMap[normalized];
    if (normalized.includes("donation")) return "#accounts";
    if (normalized.includes("auth")) return "#overview";
    if (normalized.includes("telemetry")) return "#overview";
    if (normalized.includes("activity")) return "#overview";
    if (normalized.includes("signal")) return "#data-signals";
    return "";
  }

  function handleSurfaceViewClick(event) {
    const button = event.target.closest("[data-surface-view]");
    if (!(button instanceof HTMLButtonElement)) return;
    const hash = String(button.getAttribute("data-surface-view") || "").trim();
    if (!hash) return;
    event.preventDefault();
    window.location.hash = hash;
  }

  function renderSurfaces(surfaces) {
    if (!el.surfacesList || !el.surfacesEmpty) return;
    const rows = normalizeSurfaces(surfaces).filter((entry) => entry.count > 0);
    if (!rows.length) {
      el.surfacesList.innerHTML = "";
      el.surfacesEmpty.classList.remove("hidden");
      return;
    }
    el.surfacesEmpty.classList.add("hidden");
    el.surfacesList.innerHTML = rows
      .map((entry) => {
        const viewHash = resolveSurfaceViewHash(entry.key);
        return `
          <li class="ss-analytics-surface-row">
            <div class="ss-analytics-surface-main">
              <span>${escapeHtml(entry.key)}</span>
              <span class="ss-analytics-surface-source">API</span>
            </div>
            <div class="ss-analytics-surface-meta">
              <strong>${escapeHtml(formatNumber(entry.count))}</strong>
              ${viewHash ? `<button type="button" class="ss-btn ss-btn-small ss-btn-secondary" data-surface-view="${escapeHtml(viewHash)}">View</button>` : ""}
            </div>
          </li>
        `;
      })
      .join("");
  }

  function setSummary(payload) {
    const safe = payload && typeof payload === "object" ? payload : {};
    const totalRequests = Number(safe?.totals?.requests ?? 0);
    const generatedAt = safe?.generated_at || null;
    const windowLabel = String(safe?.window || state.selectedWindow || DEFAULT_WINDOW);
    if (el.totalRequests) {
      el.totalRequests.textContent = formatNumber(totalRequests);
    }
    if (el.windowLabel) {
      el.windowLabel.textContent = windowLabel;
    }
    if (el.generatedAt) {
      el.generatedAt.textContent = formatTimestamp(generatedAt);
    }
    renderSurfaces(safe?.surfaces);
  }

  async function runWithLoader(task, reason, withLoader) {
    if (withLoader && window.StreamSuitesGlobalLoader?.trackAsync) {
      return window.StreamSuitesGlobalLoader.trackAsync(task, reason || "Loading analytics...");
    }
    return task();
  }

  async function fetchAnalytics(options = {}) {
    const withLoader = options.withLoader === true;
    const task = async () => {
      setBanner("", false);
      setStatus("Loading live analytics...");

      if (state.abortController) {
        state.abortController.abort();
      }

      const controller = new AbortController();
      state.abortController = controller;
      const timeout = setTimeout(() => controller.abort(), 3500);

      try {
        const selectedWindow = String(state.selectedWindow || DEFAULT_WINDOW);
        const payload = await window.StreamSuitesApi.getAdminAnalytics(selectedWindow, {
          ttlMs: ANALYTICS_CACHE_TTL_MS,
          forceRefresh: options.forceRefresh === true,
          timeoutMs: 3500,
          signal: controller.signal
        });
        const data = payload?.data && typeof payload.data === "object" ? payload.data : payload;
        renderReferrers(data?.top_referrers);
        setSummary(data);
        await updateMap(data?.by_country);

        if (Number(data?.totals?.requests || 0) <= 0) {
          setStatus("No events in selected window.");
        } else {
          setStatus(`Live analytics (${String(data?.window || selectedWindow)})`);
        }
      } catch (err) {
        setMapFeedback("Map data unavailable while analytics endpoint is offline.", { isError: true });
        if (err?.status === 401 || err?.status === 403 || err?.isAuthError) {
          promptAdminReauth();
          setStatus("Admin session required");
          setBanner("Admin session required. Redirecting to login...", true);
          return;
        }
        setStatus("Analytics unavailable");
        setBanner(`Live analytics unavailable. ${err?.message || "Unable to reach API."}`, true, {
          retryAction: "analytics"
        });
      } finally {
        clearTimeout(timeout);
        if (state.abortController === controller) {
          state.abortController = null;
        }
      }
    };

    return runWithLoader(task, "Hydrating analytics...", withLoader);
  }

  function handleWindowChange() {
    const value = String(el.windowSelect?.value || "").trim();
    state.selectedWindow = value || DEFAULT_WINDOW;
    fetchAnalytics({ withLoader: true, forceRefresh: true });
  }

  function init() {
    state.destroyed = false;

    el.map = $("analytics-world-map");
    el.mapFeedback = $("analytics-map-feedback");
    el.banner = $("analytics-banner");
    el.status = $("analytics-status");
    el.windowSelect = $("analytics-window-select");
    el.referrersList = $("analytics-referrers-list");
    el.referrersEmpty = $("analytics-referrers-empty");
    el.totalRequests = $("analytics-total-requests");
    el.windowLabel = $("analytics-window-label");
    el.generatedAt = $("analytics-generated-at");
    el.surfacesList = $("analytics-surfaces-list");
    el.surfacesEmpty = $("analytics-surfaces-empty");
    if (el.surfacesList && !surfacesClickBound) {
      el.surfacesList.addEventListener("click", handleSurfaceViewClick);
      surfacesClickBound = true;
    }

    if (el.windowSelect) {
      el.windowSelect.value = DEFAULT_WINDOW;
      state.selectedWindow = DEFAULT_WINDOW;
      el.windowSelect.addEventListener("change", handleWindowChange);
    }
    el.banner?.addEventListener("click", (event) => {
      const retryButton = event.target.closest("[data-analytics-retry]");
      if (!retryButton) return;
      void fetchAnalytics({ withLoader: true, forceRefresh: true });
    });

    setSummary(null);
    renderReferrers([]);
    void updateMap([]);
    initMap();
    void fetchAnalytics({ withLoader: true });
    if (state.refreshHandle) {
      clearInterval(state.refreshHandle);
    }
    state.refreshHandle = setInterval(() => {
      if (state.destroyed) return;
      void fetchAnalytics({ withLoader: false, forceRefresh: true });
    }, ANALYTICS_REFRESH_INTERVAL_MS);
  }

  function destroy() {
    state.destroyed = true;

    if (state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }

    if (el.windowSelect) {
      el.windowSelect.removeEventListener("change", handleWindowChange);
    }

    if (state.map) {
      state.map.__ssAnalyticsPopup?.remove();
      state.map.remove();
      state.map = null;
    }

    if (state.refreshHandle) {
      clearInterval(state.refreshHandle);
      state.refreshHandle = null;
    }

    if (el.surfacesList && surfacesClickBound) {
      el.surfacesList.removeEventListener("click", handleSurfaceViewClick);
      surfacesClickBound = false;
    }

    state.mapReady = false;
    state.pendingGeoJson = emptyGeoJson();

    Object.keys(el).forEach((key) => {
      el[key] = null;
    });
  }

  window.AnalyticsView = {
    init,
    destroy
  };
})();

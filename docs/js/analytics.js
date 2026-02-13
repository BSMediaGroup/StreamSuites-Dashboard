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
  const MAP_COLLAPSED_STORAGE_KEY = "ss_admin_analytics_map_collapsed";
  const COUNTRY_DEFAULT_SORT_KEY = "sessions";
  const COUNTRY_DEFAULT_SORT_DIRECTION = "desc";
  const COUNTRY_FOCUS_ZOOM = 3;
  const FLAG_SVG_BASE = "https://flagcdn.com";

  const DEFAULT_MAP_STYLE_URL =
    "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

  const SOURCE_ID = "ss-analytics-country-points";
  const LAYERS = {
    clusterHalo: "ss-analytics-cluster-halo",
    clusterCore: "ss-analytics-cluster-core",
    clusterLabel: "ss-analytics-cluster-label",
    activityGlow: "ss-analytics-activity-glow",
    activityCore: "ss-analytics-activity-core",
    activityHit: "ss-analytics-activity-hit"
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
    countryCentroidsPromise: null,
    latestByCountry: [],
    countryRows: [],
    countryTotals: {
      sessions: 0,
      requests: 0
    },
    countrySort: {
      key: COUNTRY_DEFAULT_SORT_KEY,
      direction: COUNTRY_DEFAULT_SORT_DIRECTION
    },
    countryFilter: "",
    activeCountryCode: "",
    countryFocusToken: 0,
    regionDisplayNames: null,
    regionNameCache: Object.create(null),
    mapCollapsed: false,
    mapResizeRaf: null,
    mapResizeTimeout: null
  };

  const el = {
    map: null,
    mapPanel: null,
    mapPanelBody: null,
    mapToggle: null,
    mapToggleLabel: null,
    mapGeneratedAt: null,
    mapCountryCount: null,
    mapSessions: null,
    mapTopCountry: null,
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
    surfacesEmpty: null,
    countriesTable: null,
    countriesBody: null,
    countriesEmpty: null,
    countriesSearch: null,
    countriesCount: null
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

  function readMapCollapsedPreference() {
    try {
      return window.localStorage?.getItem(MAP_COLLAPSED_STORAGE_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function writeMapCollapsedPreference(collapsed) {
    try {
      window.localStorage?.setItem(MAP_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
    } catch (_) {
      // Ignore localStorage write failures (private mode/quota/security).
    }
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
      el.mapFeedback.classList.remove("is-error");
      el.map?.classList.remove("is-error");
      return;
    }
    el.mapFeedback.textContent = text;
    el.mapFeedback.classList.remove("hidden");
    el.mapFeedback.classList.toggle("is-error", isError);
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

  function formatShare(value, total) {
    const numerator = Number(value);
    const denominator = Number(total);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return "--";
    const percent = (Math.max(0, numerator) / denominator) * 100;
    return `${percent.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })}%`;
  }

  function setMapHeaderTimestamp(value) {
    if (!el.mapGeneratedAt) return;
    el.mapGeneratedAt.textContent = formatTimestamp(value);
    if (!value) {
      el.mapGeneratedAt.setAttribute("datetime", "");
      return;
    }
    const parsed = new Date(value);
    el.mapGeneratedAt.setAttribute("datetime", Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString());
  }

  function delay(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, Math.max(0, Number(ms) || 0));
    });
  }

  function getOrCreateMapPopup(map) {
    if (!map || !window.maplibregl || typeof window.maplibregl.Popup !== "function") return null;
    if (!map.__ssAnalyticsPopup) {
      map.__ssAnalyticsPopup = new window.maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 10,
        className: "ss-map-popup"
      });
    }
    return map.__ssAnalyticsPopup;
  }

  function resolveCountryName(code) {
    const iso2 = String(code || "").trim().toUpperCase();
    if (!iso2) return "";
    if (state.regionNameCache[iso2]) {
      return state.regionNameCache[iso2];
    }

    if (state.regionDisplayNames === null) {
      if (typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
        try {
          state.regionDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });
        } catch (_) {
          state.regionDisplayNames = false;
        }
      } else {
        state.regionDisplayNames = false;
      }
    }

    let resolved = iso2;
    if (state.regionDisplayNames) {
      try {
        const candidate = state.regionDisplayNames.of(iso2);
        if (typeof candidate === "string" && candidate.trim()) {
          resolved = candidate.trim();
        }
      } catch (_) {
        resolved = iso2;
      }
    }
    state.regionNameCache[iso2] = resolved;
    return resolved;
  }

  function getFlagSvgUrl(code) {
    const iso2 = String(code || "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(iso2)) return null;
    return `${FLAG_SVG_BASE}/${iso2.toLowerCase()}.svg`;
  }

  function buildFallbackRegionIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 12");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", "flag-icon flag-icon-fallback");

    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", "0.5");
    bg.setAttribute("y", "0.5");
    bg.setAttribute("width", "15");
    bg.setAttribute("height", "11");
    bg.setAttribute("rx", "2");
    bg.setAttribute("fill", "rgba(19, 28, 43, 0.9)");
    bg.setAttribute("stroke", "rgba(149, 183, 218, 0.5)");
    bg.setAttribute("stroke-width", "1");
    svg.appendChild(bg);

    const globe = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    globe.setAttribute("cx", "8");
    globe.setAttribute("cy", "6");
    globe.setAttribute("r", "3");
    globe.setAttribute("fill", "none");
    globe.setAttribute("stroke", "rgba(205, 226, 255, 0.95)");
    globe.setAttribute("stroke-width", "0.9");
    svg.appendChild(globe);

    const lat = document.createElementNS("http://www.w3.org/2000/svg", "path");
    lat.setAttribute("d", "M5.5 6h5");
    lat.setAttribute("fill", "none");
    lat.setAttribute("stroke", "rgba(205, 226, 255, 0.95)");
    lat.setAttribute("stroke-width", "0.8");
    lat.setAttribute("stroke-linecap", "round");
    svg.appendChild(lat);

    const lon = document.createElementNS("http://www.w3.org/2000/svg", "path");
    lon.setAttribute("d", "M8 3.2c-1.1 0-2 1.2-2 2.8s0.9 2.8 2 2.8 2-1.2 2-2.8-0.9-2.8-2-2.8z");
    lon.setAttribute("fill", "none");
    lon.setAttribute("stroke", "rgba(205, 226, 255, 0.95)");
    lon.setAttribute("stroke-width", "0.7");
    lon.setAttribute("stroke-linecap", "round");
    lon.setAttribute("stroke-linejoin", "round");
    svg.appendChild(lon);

    return svg;
  }

  function buildRegionLabelNode({ code, name }) {
    const iso2 = String(code || "").trim().toUpperCase();
    const labelName = String(name || resolveCountryName(iso2) || iso2 || "Unknown").trim() || "Unknown";
    const container = document.createElement("span");
    container.className = "region-label";

    const flagUrl = getFlagSvgUrl(iso2);
    if (flagUrl) {
      const img = document.createElement("img");
      img.className = "flag-icon";
      img.decoding = "async";
      img.loading = "lazy";
      img.src = flagUrl;
      img.alt = `${iso2} flag`;
      img.onerror = () => {
        img.replaceWith(buildFallbackRegionIcon());
      };
      container.appendChild(img);
    } else {
      container.appendChild(buildFallbackRegionIcon());
    }

    const nameEl = document.createElement("span");
    nameEl.className = "region-name";
    nameEl.textContent = labelName;
    container.appendChild(nameEl);
    return container;
  }

  function buildCountryPopupContent(entry) {
    const code = String(entry?.code || entry?.country || "--").trim().toUpperCase() || "--";
    const resolvedName = String(entry?.name || resolveCountryName(code) || code).trim() || code;
    const sessionsRaw = Number(entry?.sessions ?? 0);
    const requestsRaw = Number(entry?.requests ?? 0);
    const sessions = Number.isFinite(sessionsRaw) ? Math.max(0, Math.round(sessionsRaw)) : 0;
    const requests = Number.isFinite(requestsRaw) ? Math.max(0, Math.round(requestsRaw)) : 0;

    const root = document.createElement("div");
    root.className = "ss-map-popup-inner";

    const title = document.createElement("strong");
    title.appendChild(
      buildRegionLabelNode({
        code,
        name: resolvedName
      })
    );
    root.appendChild(title);

    const sessionsLine = document.createElement("span");
    const sessionsLabel = document.createElement("span");
    sessionsLabel.className = "ss-map-popup-label";
    sessionsLabel.textContent = "Sessions:";
    const sessionsValue = document.createElement("span");
    sessionsValue.className = "ss-map-popup-value";
    sessionsValue.textContent = formatNumber(sessions);
    sessionsLine.append(sessionsLabel, document.createTextNode(" "), sessionsValue);
    root.appendChild(sessionsLine);

    const requestsLine = document.createElement("span");
    const requestsLabel = document.createElement("span");
    requestsLabel.className = "ss-map-popup-label";
    requestsLabel.textContent = "Requests:";
    const requestsValue = document.createElement("span");
    requestsValue.className = "ss-map-popup-value";
    requestsValue.textContent = formatNumber(requests);
    requestsLine.append(requestsLabel, document.createTextNode(" "), requestsValue);
    root.appendChild(requestsLine);

    return root;
  }

  async function waitForMapReady(timeoutMs = 3000) {
    if (!state.map) return false;
    if (state.mapReady) return true;

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(value === true);
      };

      const timeout = setTimeout(() => {
        finish(state.mapReady === true);
      }, Math.max(1, Number(timeoutMs) || 1));

      state.map.once("load", () => finish(true));
      state.map.once("error", () => finish(false));
    });
  }

  function scheduleMapResize() {
    if (state.mapResizeRaf) {
      cancelAnimationFrame(state.mapResizeRaf);
      state.mapResizeRaf = null;
    }
    if (state.mapResizeTimeout) {
      clearTimeout(state.mapResizeTimeout);
      state.mapResizeTimeout = null;
    }

    state.mapResizeRaf = requestAnimationFrame(() => {
      state.mapResizeRaf = null;
      if (!state.map || state.destroyed || state.mapCollapsed) return;
      state.map.resize();
      state.mapResizeTimeout = setTimeout(() => {
        state.mapResizeTimeout = null;
        if (!state.map || state.destroyed || state.mapCollapsed) return;
        state.map.resize();
      }, 100);
    });
  }

  function updateMapToggleUi() {
    const collapsed = state.mapCollapsed === true;
    const nextActionLabel = collapsed ? "Expand" : "Collapse";
    if (el.mapToggleLabel) {
      el.mapToggleLabel.textContent = nextActionLabel;
    }
    if (el.mapToggle) {
      el.mapToggle.setAttribute("aria-expanded", String(!collapsed));
      const iconEl = el.mapToggle.querySelector(".ss-analytics-map-toggle-icon");
      if (iconEl) {
        iconEl.innerHTML = collapsed ? "&#9654;" : "&#9660;";
      }
    }
  }

  function setMapCollapsed(collapsed, options = {}) {
    const shouldCollapse = collapsed === true;
    state.mapCollapsed = shouldCollapse;
    el.mapPanel?.classList.toggle("is-collapsed", shouldCollapse);
    if (el.mapPanelBody) {
      el.mapPanelBody.hidden = shouldCollapse;
    }
    updateMapToggleUi();
    if (options.persist !== false) {
      writeMapCollapsedPreference(shouldCollapse);
    }
    if (!shouldCollapse) {
      if (!state.map) {
        initMap();
      }
      if (options.resize !== false) {
        scheduleMapResize();
      }
    }
  }

  function handleMapToggleClick() {
    setMapCollapsed(!state.mapCollapsed, {
      persist: true,
      resize: true
    });
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

    if (!map.getLayer(LAYERS.activityGlow)) {
      map.addLayer({
        id: LAYERS.activityGlow,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#9f4dff",
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "sessions"], ["get", "requests"], 0],
            0, 0.16,
            10, 0.24,
            50, 0.34,
            150, 0.46,
            400, 0.58
          ],
          "circle-blur": 0.78,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "sessions"], ["get", "requests"], 0],
            0, 9,
            10, 13,
            50, 18,
            150, 23,
            400, 28
          ]
        }
      });
    }

    if (!map.getLayer(LAYERS.activityCore)) {
      map.addLayer({
        id: LAYERS.activityCore,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#d6b8ff",
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "sessions"], ["get", "requests"], 0],
            0, 0.82,
            10, 0.88,
            50, 0.93,
            150, 0.97,
            400, 0.99
          ],
          "circle-blur": 0.08,
          "circle-stroke-color": "rgba(242,228,255,0.86)",
          "circle-stroke-width": 0.75,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "sessions"], ["get", "requests"], 0],
            0, 3.2,
            10, 4.8,
            50, 7.2,
            150, 9.4,
            400, 11.2
          ]
        }
      });
    }

    if (!map.getLayer(LAYERS.activityHit)) {
      map.addLayer({
        id: LAYERS.activityHit,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "sessions"], ["get", "requests"], 0],
            1, 14,
            10, 15,
            50, 17.5,
            150, 20
          ],
          "circle-opacity": 0,
          "circle-stroke-opacity": 0
        }
      });
    }

    const source = map.getSource(SOURCE_ID);
    if (source) {
      source.setData(state.pendingGeoJson || emptyGeoJson());
    }

    getOrCreateMapPopup(map);

    if (!map.__ssAnalyticsHoverBound) {
      map.on("mouseenter", LAYERS.activityHit, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", LAYERS.activityHit, () => {
        map.getCanvas().style.cursor = "";
        map.__ssAnalyticsPopup?.remove();
      });
      map.on("mousemove", LAYERS.activityHit, (event) => {
        const feature = event?.features?.[0];
        if (!feature) return;
        const props = feature.properties || {};
        const code = String(props.country || "--").toUpperCase();
        const name = String(props.name || resolveCountryName(code) || code);
        const sessionsRaw = Number(props.sessions ?? 0);
        const requestsRaw = Number(props.requests ?? 0);
        const sessions = Number.isFinite(sessionsRaw) ? Math.max(0, Math.round(sessionsRaw)) : 0;
        const requests = Number.isFinite(requestsRaw) ? Math.max(0, Math.round(requestsRaw)) : 0;
        getOrCreateMapPopup(map)
          ?.setLngLat(event.lngLat)
          .setDOMContent(
            buildCountryPopupContent({
              code,
              name,
              sessions,
              requests
            })
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
      if (!state.mapCollapsed) {
        scheduleMapResize();
      }
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

  function buildCountryRows(countryRows, centroids) {
    const aggregate = new Map();
    normalizeCountryRows(countryRows).forEach((entry) => {
      const code = String(entry?.country || entry?.code || "").trim().toUpperCase();
      if (!code || code === "ZZ") return;
      const centroid = centroids?.[code];
      if (!Array.isArray(centroid) || centroid.length !== 2) return;
      const lon = Number(centroid[0]);
      const lat = Number(centroid[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
      const requestsRaw = Number(entry?.requests ?? entry?.count ?? 0);
      const sessionsRaw = Number(entry?.sessions ?? entry?.count ?? requestsRaw);
      const requests = Number.isFinite(requestsRaw) ? Math.max(0, Math.round(requestsRaw)) : 0;
      const sessions = Number.isFinite(sessionsRaw) ? Math.max(0, Math.round(sessionsRaw)) : requests;
      if (requests <= 0 && sessions <= 0) return;
      const existing = aggregate.get(code);
      if (existing) {
        existing.requests += requests;
        existing.sessions += sessions;
        return;
      }
      aggregate.set(code, {
        code,
        name: resolveCountryName(code),
        requests,
        sessions,
        centroid: [lon, lat]
      });
    });
    return Array.from(aggregate.values());
  }

  function toMapFeature(entry) {
    const code = String(entry?.code || entry?.country || "").trim().toUpperCase();
    const centroid = entry?.centroid;
    if (!code || !Array.isArray(centroid) || centroid.length !== 2) return null;
    const requests = Number(entry?.requests ?? 0);
    const sessions = Number(entry?.sessions ?? 0);
    return {
      type: "Feature",
      properties: {
        country: code,
        name: entry?.name || resolveCountryName(code),
        requests: Number.isFinite(requests) ? requests : 0,
        sessions: Number.isFinite(sessions) ? sessions : 0
      },
      geometry: {
        type: "Point",
        coordinates: centroid
      }
    };
  }

  function computeCountryTotals(rows) {
    return rows.reduce(
      (acc, entry) => {
        const requests = Number(entry?.requests ?? 0);
        const sessions = Number(entry?.sessions ?? 0);
        if (Number.isFinite(requests)) acc.requests += Math.max(0, requests);
        if (Number.isFinite(sessions)) acc.sessions += Math.max(0, sessions);
        return acc;
      },
      {
        sessions: 0,
        requests: 0
      }
    );
  }

  function resolveTopCountry(rows) {
    let top = null;
    (Array.isArray(rows) ? rows : []).forEach((entry) => {
      if (!top) {
        top = entry;
        return;
      }
      const sessions = Number(entry?.sessions ?? 0);
      const topSessions = Number(top?.sessions ?? 0);
      if (sessions > topSessions) {
        top = entry;
        return;
      }
      if (sessions === topSessions) {
        const requests = Number(entry?.requests ?? 0);
        const topRequests = Number(top?.requests ?? 0);
        if (requests > topRequests) {
          top = entry;
        }
      }
    });
    return top;
  }

  function updateMapStatsStrip() {
    if (el.mapCountryCount) {
      el.mapCountryCount.textContent = formatNumber(state.countryRows.length);
    }
    if (el.mapSessions) {
      el.mapSessions.textContent = formatNumber(state.countryTotals.sessions);
    }
    if (el.mapTopCountry) {
      const top = resolveTopCountry(state.countryRows);
      el.mapTopCountry.textContent = "";
      if (!top) {
        el.mapTopCountry.textContent = "--";
      } else {
        const code = String(top?.code || top?.country || "").trim().toUpperCase();
        const name = String(top?.name || resolveCountryName(code) || code).trim() || code;
        el.mapTopCountry.appendChild(
          buildRegionLabelNode({
            code,
            name
          })
        );
      }
    }
  }

  function resolveCountrySortValue(entry, key, totals) {
    if (key === "name") {
      return `${String(entry?.name || "").toLowerCase()}|${String(entry?.code || "").toLowerCase()}`;
    }
    if (key === "sessionsShare") {
      const totalSessions = Number(totals?.sessions ?? 0);
      return totalSessions > 0 ? Number(entry?.sessions ?? 0) / totalSessions : 0;
    }
    if (key === "requestsShare") {
      const totalRequests = Number(totals?.requests ?? 0);
      return totalRequests > 0 ? Number(entry?.requests ?? 0) / totalRequests : 0;
    }
    return Number(entry?.[key] ?? 0);
  }

  function sortCountryRows(rows, totals) {
    const key = String(state.countrySort?.key || COUNTRY_DEFAULT_SORT_KEY);
    const direction = state.countrySort?.direction === "asc" ? "asc" : "desc";
    const factor = direction === "asc" ? 1 : -1;

    return [...rows].sort((left, right) => {
      const leftValue = resolveCountrySortValue(left, key, totals);
      const rightValue = resolveCountrySortValue(right, key, totals);
      let compare = 0;
      if (typeof leftValue === "number" && typeof rightValue === "number") {
        compare = leftValue - rightValue;
      } else {
        compare = String(leftValue).localeCompare(String(rightValue), undefined, {
          sensitivity: "base",
          numeric: true
        });
      }
      if (compare !== 0) return compare * factor;
      const sessionsFallback = Number(right?.sessions ?? 0) - Number(left?.sessions ?? 0);
      if (sessionsFallback !== 0) return sessionsFallback;
      return String(left?.code || "").localeCompare(String(right?.code || ""), undefined, {
        sensitivity: "base"
      });
    });
  }

  function updateCountrySortHeaders() {
    if (!el.countriesTable) return;
    const headers = el.countriesTable.querySelectorAll("th.sortable[data-sort-key]");
    headers.forEach((header) => {
      const sortKey = String(header.getAttribute("data-sort-key") || "");
      const isSorted = sortKey === state.countrySort.key;
      const isAsc = isSorted && state.countrySort.direction === "asc";
      const isDesc = isSorted && state.countrySort.direction === "desc";
      header.classList.toggle("sorted-asc", isAsc);
      header.classList.toggle("sorted-desc", isDesc);
      header.setAttribute("aria-sort", isSorted ? (isAsc ? "ascending" : "descending") : "none");
    });
  }

  function renderCountryTable() {
    const allRows = Array.isArray(state.countryRows) ? state.countryRows : [];
    const filterText = String(state.countryFilter || "").trim().toLowerCase();
    const filteredRows = filterText
      ? allRows.filter((entry) => {
          const code = String(entry?.code || "").toLowerCase();
          const name = String(entry?.name || "").toLowerCase();
          return code.includes(filterText) || name.includes(filterText);
        })
      : allRows;
    const totals = state.countryTotals;
    const sortedRows = sortCountryRows(filteredRows, totals);
    updateCountrySortHeaders();

    if (el.countriesCount) {
      if (filterText) {
        el.countriesCount.textContent = `${sortedRows.length.toLocaleString()} of ${allRows.length.toLocaleString()} regions`;
      } else {
        const label = allRows.length === 1 ? "region" : "regions";
        el.countriesCount.textContent = `${allRows.length.toLocaleString()} ${label}`;
      }
    }

    if (!el.countriesBody || !el.countriesEmpty) return;
    if (!sortedRows.length) {
      el.countriesBody.innerHTML = "";
      el.countriesEmpty.textContent = filterText
        ? "No regions match this filter."
        : "No regions detected in this window.";
      el.countriesEmpty.classList.remove("hidden");
      return;
    }

    el.countriesEmpty.classList.add("hidden");
    el.countriesBody.textContent = "";
    const fragment = document.createDocumentFragment();
    sortedRows.forEach((entry) => {
      const code = String(entry?.code || "").toUpperCase();
      const name = String(entry?.name || code).trim() || code;
      const isActive = code === state.activeCountryCode;

      const row = document.createElement("tr");
      row.className = `ss-analytics-country-row${isActive ? " is-active" : ""}`;
      row.setAttribute("data-country-code", code);
      row.setAttribute("tabindex", "0");
      row.setAttribute("role", "button");
      row.setAttribute("aria-label", `Focus map on ${name}`);
      row.setAttribute("data-region-name", name);

      const regionCell = document.createElement("td");
      const nameEl = document.createElement("span");
      nameEl.className = "ss-analytics-country-name";
      nameEl.appendChild(
        buildRegionLabelNode({
          code,
          name
        })
      );
      const codeEl = document.createElement("span");
      codeEl.className = "ss-analytics-country-code";
      codeEl.textContent = code;
      regionCell.append(nameEl, codeEl);
      row.appendChild(regionCell);

      const sessionsCell = document.createElement("td");
      sessionsCell.className = "ss-analytics-metric";
      sessionsCell.textContent = formatNumber(entry.sessions);
      row.appendChild(sessionsCell);

      const requestsCell = document.createElement("td");
      requestsCell.className = "ss-analytics-metric";
      requestsCell.textContent = formatNumber(entry.requests);
      row.appendChild(requestsCell);

      const sessionsShareCell = document.createElement("td");
      sessionsShareCell.className = "ss-analytics-metric";
      sessionsShareCell.textContent = formatShare(entry.sessions, totals?.sessions);
      row.appendChild(sessionsShareCell);

      const requestsShareCell = document.createElement("td");
      requestsShareCell.className = "ss-analytics-metric";
      requestsShareCell.textContent = formatShare(entry.requests, totals?.requests);
      row.appendChild(requestsShareCell);

      fragment.appendChild(row);
    });
    el.countriesBody.appendChild(fragment);
  }

  async function focusCountryFromTable(code) {
    const iso2 = String(code || "").trim().toUpperCase();
    if (!iso2) return;
    const country = state.countryRows.find((entry) => entry.code === iso2);
    if (!country || !Array.isArray(country.centroid) || country.centroid.length !== 2) return;

    state.activeCountryCode = iso2;
    renderCountryTable();

    const focusToken = ++state.countryFocusToken;
    if (state.mapCollapsed) {
      setMapCollapsed(false, {
        persist: true,
        resize: true
      });
      await delay(150);
    } else {
      scheduleMapResize();
    }

    if (!state.map) {
      initMap();
    }
    const mapReady = await waitForMapReady();
    if (!mapReady || !state.map || focusToken !== state.countryFocusToken) return;

    const lon = Number(country.centroid[0]);
    const lat = Number(country.centroid[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    const center = [lon, lat];
    const map = state.map;

    map.resize();
    getOrCreateMapPopup(map)?.setLngLat(center).setDOMContent(buildCountryPopupContent(country)).addTo(map);
    map.flyTo({
      center,
      zoom: Math.max(map.getZoom() || 1, COUNTRY_FOCUS_ZOOM),
      duration: 900,
      essential: true
    });
    map.once("moveend", () => {
      if (!state.map || focusToken !== state.countryFocusToken) return;
      getOrCreateMapPopup(state.map)
        ?.setLngLat(center)
        .setDOMContent(buildCountryPopupContent(country))
        .addTo(state.map);
    });
  }

  function handleCountrySortClick(event) {
    const header = event.target.closest("th.sortable[data-sort-key]");
    if (!(header instanceof HTMLTableCellElement) || !el.countriesTable?.contains(header)) return;
    const sortKey = String(header.getAttribute("data-sort-key") || "").trim();
    if (!sortKey) return;
    if (state.countrySort.key === sortKey) {
      state.countrySort.direction = state.countrySort.direction === "asc" ? "desc" : "asc";
    } else {
      state.countrySort.key = sortKey;
      state.countrySort.direction = sortKey === "name" ? "asc" : "desc";
    }
    renderCountryTable();
  }

  function handleCountryRowClick(event) {
    const row = event.target.closest("tr.ss-analytics-country-row[data-country-code]");
    if (!(row instanceof HTMLTableRowElement) || !el.countriesBody?.contains(row)) return;
    event.preventDefault();
    const code = row.getAttribute("data-country-code");
    void focusCountryFromTable(code);
  }

  function handleCountryRowKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest("tr.ss-analytics-country-row[data-country-code]");
    if (!(row instanceof HTMLTableRowElement) || !el.countriesBody?.contains(row)) return;
    event.preventDefault();
    const code = row.getAttribute("data-country-code");
    void focusCountryFromTable(code);
  }

  function handleCountrySearchInput(event) {
    state.countryFilter = String(event?.target?.value || "").trim();
    renderCountryTable();
  }

  async function updateMap(countryRows, options = {}) {
    const rows = normalizeCountryRows(countryRows);
    state.latestByCountry = [...rows];
    const centroids = await loadCountryCentroids();
    state.countryRows = buildCountryRows(rows, centroids);
    state.countryTotals = computeCountryTotals(state.countryRows);
    updateMapStatsStrip();
    if (state.activeCountryCode) {
      const exists = state.countryRows.some((entry) => entry.code === state.activeCountryCode);
      if (!exists) {
        state.activeCountryCode = "";
      }
    }
    renderCountryTable();

    const features = state.countryRows.map((entry) => toMapFeature(entry)).filter(Boolean);
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
    setMapHeaderTimestamp(generatedAt);
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
    state.latestByCountry = [];
    state.countryRows = [];
    state.countryTotals = {
      sessions: 0,
      requests: 0
    };
    state.countrySort = {
      key: COUNTRY_DEFAULT_SORT_KEY,
      direction: COUNTRY_DEFAULT_SORT_DIRECTION
    };
    state.countryFilter = "";
    state.activeCountryCode = "";
    state.countryFocusToken = 0;

    el.map = $("analytics-world-map");
    el.mapPanel = document.querySelector(".ss-analytics-map-panel");
    el.mapPanelBody = $("analytics-map-panel-body");
    el.mapToggle = $("analytics-map-toggle");
    el.mapToggleLabel = $("analytics-map-toggle-label");
    el.mapGeneratedAt = $("analytics-map-generated-at");
    el.mapCountryCount = $("analytics-map-country-count");
    el.mapSessions = $("analytics-map-sessions");
    el.mapTopCountry = $("analytics-map-top-country");
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
    el.countriesTable = $("analytics-countries-table");
    el.countriesBody = $("analytics-countries-body");
    el.countriesEmpty = $("analytics-countries-empty");
    el.countriesSearch = $("analytics-countries-search");
    el.countriesCount = $("analytics-countries-count");
    if (el.mapToggle) {
      el.mapToggle.addEventListener("click", handleMapToggleClick);
    }
    if (el.surfacesList && !surfacesClickBound) {
      el.surfacesList.addEventListener("click", handleSurfaceViewClick);
      surfacesClickBound = true;
    }
    if (el.countriesTable) {
      el.countriesTable.addEventListener("click", handleCountrySortClick);
    }
    if (el.countriesBody) {
      el.countriesBody.addEventListener("click", handleCountryRowClick);
      el.countriesBody.addEventListener("keydown", handleCountryRowKeydown);
    }
    if (el.countriesSearch) {
      el.countriesSearch.value = "";
      el.countriesSearch.addEventListener("input", handleCountrySearchInput);
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
    setMapCollapsed(readMapCollapsedPreference(), {
      persist: false,
      resize: false
    });
    if (!state.map) {
      initMap();
    }
    if (!state.mapCollapsed) {
      scheduleMapResize();
    }
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

    if (el.mapToggle) {
      el.mapToggle.removeEventListener("click", handleMapToggleClick);
    }
    if (el.countriesTable) {
      el.countriesTable.removeEventListener("click", handleCountrySortClick);
    }
    if (el.countriesBody) {
      el.countriesBody.removeEventListener("click", handleCountryRowClick);
      el.countriesBody.removeEventListener("keydown", handleCountryRowKeydown);
    }
    if (el.countriesSearch) {
      el.countriesSearch.removeEventListener("input", handleCountrySearchInput);
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

    if (state.mapResizeRaf) {
      cancelAnimationFrame(state.mapResizeRaf);
      state.mapResizeRaf = null;
    }

    if (state.mapResizeTimeout) {
      clearTimeout(state.mapResizeTimeout);
      state.mapResizeTimeout = null;
    }

    if (el.surfacesList && surfacesClickBound) {
      el.surfacesList.removeEventListener("click", handleSurfaceViewClick);
      surfacesClickBound = false;
    }

    state.mapReady = false;
    state.mapCollapsed = false;
    state.pendingGeoJson = emptyGeoJson();
    state.latestByCountry = [];
    state.countryRows = [];
    state.countryTotals = {
      sessions: 0,
      requests: 0
    };
    state.countrySort = {
      key: COUNTRY_DEFAULT_SORT_KEY,
      direction: COUNTRY_DEFAULT_SORT_DIRECTION
    };
    state.countryFilter = "";
    state.activeCountryCode = "";
    state.countryFocusToken = 0;
    state.regionDisplayNames = null;
    state.regionNameCache = Object.create(null);

    Object.keys(el).forEach((key) => {
      el[key] = null;
    });
  }

  window.AnalyticsView = {
    init,
    destroy
  };
})();

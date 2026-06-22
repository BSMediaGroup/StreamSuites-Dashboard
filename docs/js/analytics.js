/* ============================================================
   StreamSuites Dashboard - Analytics view
   ============================================================ */

(() => {
  "use strict";

  const DEFAULT_WINDOW = "5m";
  const ANALYTICS_CACHE_TTL_MS = 8000;
  const ANALYTICS_REFRESH_INTERVAL_MS = 15000;
  const ANALYTICS_TABLE_RETENTION_LIMIT = 250;
  const ANALYTICS_TABLE_PAGE_SIZE_OPTIONS = Object.freeze([5, 10, 25, 50]);
  const TOP_REFERRERS_LIMIT = 8;
  const COUNTRY_CENTROIDS_PATH = "/shared/data/country_centroids.json";
  const MAP_COLLAPSED_STORAGE_KEY = "ss_admin_analytics_map_collapsed";
  const MAP_MARKER_FILTER_DEFAULT = "both";
  const MAP_ENLARGED_SINGLE_POINT_ZOOM = 2.5;
  const MAP_ENLARGED_FIT_MAX_ZOOM = 3.8;
  const MAP_ENLARGED_FIT_DURATION_MS = 360;
  const COUNTRY_DEFAULT_SORT_KEY = "sessions";
  const COUNTRY_DEFAULT_SORT_DIRECTION = "desc";
  const COUNTRY_FOCUS_ZOOM = 3;

  const DEFAULT_MAP_STYLE_URL =
    "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

  const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
  const LOCATION_PLACEHOLDER_VALUES = new Set(["", "-", "--", "unknown", "n/a", "na", "null", "undefined"]);
  const SURFACE_LABELS = Object.freeze({
    public: "StreamSuites Public",
    creator: "StreamSuites Creator",
    admin: "StreamSuites Admin",
    danielclancy_public: "DanielClancy.net",
    danielclancy_admin: "DanielClancy Admin",
    directory: "FindMeHere Directory",
    desktop: "Desktop Admin",
    "auth-controls": "Auth Controls",
    self_service: "Self Service"
  });
  const PROJECT_LABELS = Object.freeze({
    danielclancy: "DanielClancy.net",
    streamsuites: "StreamSuites"
  });

  const SOURCE_ID = "ss-analytics-country-points";
  const LAYERS = {
    clusterHalo: "ss-analytics-cluster-halo",
    clusterCore: "ss-analytics-cluster-core",
    clusterLabel: "ss-analytics-cluster-label",
    requestsBackdrop: "ss-analytics-requests-backdrop",
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
    locationRows: [],
    locationTotals: {
      sessions: 0,
      requests: 0
    },
    locationSupport: {
      country: 0,
      region: 0,
      city: 0
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
    mapEnlarged: false,
    mapMarkerFilter: MAP_MARKER_FILTER_DEFAULT,
    mapResizeRaf: null,
    mapResizeTimeout: null,
    mapFrameTimeout: null,
    tableViews: {
      countries: {
        page: 1,
        pageSize: 10
      },
      endpoints: {
        page: 1,
        pageSize: 10
      },
      recentRequests: {
        page: 1,
        pageSize: 10
      }
    }
  };

  const el = {
    map: null,
    mapPanel: null,
    mapPanelBody: null,
    mapToggle: null,
    mapToggleLabel: null,
    mapEnlargeToggle: null,
    mapEnlargeToggleLabel: null,
    mapMarkerFilter: null,
    mapGeneratedAt: null,
    mapCountryCount: null,
    mapSessions: null,
    mapTopCountry: null,
    mapFeedback: null,
    banner: null,
    status: null,
    windowSelect: null,
    refreshButton: null,
    referrersList: null,
    referrersEmpty: null,
    totalRequests: null,
    totalSessions: null,
    snapshotTotalRequests: null,
    snapshotTotalSessions: null,
    windowLabel: null,
    generatedAt: null,
    snapshotGeneratedAt: null,
    summaryTopReferrer: null,
    summaryTopPlatform: null,
    summaryLocationDetail: null,
    summaryActiveSurface: null,
    surfacesList: null,
    surfacesEmpty: null,
    countriesTable: null,
    countriesBody: null,
    countriesEmpty: null,
    countriesSearch: null,
    countriesCount: null,
    countriesPageSize: null,
    countriesPagination: null,
    geoCountryOnly: null,
    geoRegionDetail: null,
    geoCityDetail: null,
    endpointsCount: null,
    endpointsPageSize: null,
    endpointsPagination: null,
    endpointsBody: null,
    endpointsEmpty: null,
    browsersList: null,
    browsersEmpty: null,
    devicesList: null,
    devicesEmpty: null,
    platformsList: null,
    platformsEmpty: null,
    recentRequestsCount: null,
    recentRequestsPageSize: null,
    recentRequestsPagination: null,
    recentRequestsBody: null,
    recentRequestsEmpty: null
  };
  let surfacesClickBound = false;
  const helperWarningState = new Set();

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

  function safeToText(value, fallback = "") {
    try {
      return String(value ?? fallback ?? "");
    } catch (_) {
      return String(fallback ?? "");
    }
  }

  function shouldWarnHelperFallbacks() {
    const hostname = String(window.location?.hostname || "").trim().toLowerCase();
    const protocol = String(window.location?.protocol || "").trim().toLowerCase();
    return protocol === "file:" || LOCALHOST_HOSTNAMES.has(hostname);
  }

  function warnHelperFallback(key, message, error) {
    if (!shouldWarnHelperFallbacks() || helperWarningState.has(key)) return;
    helperWarningState.add(key);
    if (error) {
      console.warn(`[Analytics] ${message}`, error);
      return;
    }
    console.warn(`[Analytics] ${message}`);
  }

  function labelize(value, fallback = "Unknown") {
    try {
      const formatted = safeToText(value)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .trim();
      return formatted || fallback;
    } catch (error) {
      warnHelperFallback("labelize", "Label formatter fallback engaged.", error);
      const text = safeToText(undefined, fallback).trim();
      return text || fallback;
    }
  }

  function formatSurfaceLabel(value, fallback = "Unknown") {
    const normalized = safeToText(value).trim().toLowerCase();
    if (!normalized) return fallback;
    return SURFACE_LABELS[normalized] || labelize(normalized, fallback);
  }

  function normalizeProject(value) {
    const normalized = safeToText(value).trim().toLowerCase();
    return normalized === "danielclancy" ? "danielclancy" : "streamsuites";
  }

  function formatProjectLabel(value) {
    const normalized = normalizeProject(value);
    return PROJECT_LABELS[normalized] || labelize(normalized, "StreamSuites");
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

  function collapseLocationWhitespace(value) {
    return safeToText(value)
      .replace(/\s+/g, " ")
      .replace(/\s*,\s*/g, ", ")
      .replace(/^,+|,+$/g, "")
      .trim();
  }

  function isPlaceholderLocationValue(value) {
    return LOCATION_PLACEHOLDER_VALUES.has(safeToText(value).trim().toLowerCase());
  }

  function normalizeLocationCode(value) {
    const text = collapseLocationWhitespace(value).toUpperCase();
    if (!text || isPlaceholderLocationValue(text) || text === "ZZ") return "";
    return text;
  }

  function normalizeLocationName(value) {
    const text = collapseLocationWhitespace(value);
    if (!text || isPlaceholderLocationValue(text)) return "";
    const alpha = text.replace(/[^A-Za-z]/g, "");
    if (!alpha) return text;
    const isAllLower = alpha === alpha.toLowerCase();
    const isAllUpper = alpha === alpha.toUpperCase();
    if ((isAllLower || isAllUpper) && alpha.length > 3) {
      return text.toLowerCase().replace(/\b([a-z])/g, (match) => match.toUpperCase());
    }
    return text;
  }

  function dedupeLocationParts(parts) {
    const normalized = [];
    parts.forEach((part) => {
      const text = collapseLocationWhitespace(part);
      if (!text) return;
      const previous = normalized[normalized.length - 1];
      if (previous && previous.localeCompare(text, undefined, { sensitivity: "base" }) === 0) {
        return;
      }
      normalized.push(text);
    });
    return normalized;
  }

  function buildLocationLabel(parts) {
    return dedupeLocationParts(parts).join(", ");
  }

  function buildFallbackLocationPresentation(entry) {
    const city = normalizeLocationName(entry?.city);
    const region = normalizeLocationName(entry?.region);
    const regionCode = normalizeLocationCode(entry?.regionCode ?? entry?.region_code);
    const countryCode = normalizeLocationCode(entry?.countryCode ?? entry?.country_code ?? entry?.code);
    const rawCountry = normalizeLocationName(entry?.country ?? entry?.countryName ?? entry?.name);
    const countryName = rawCountry || normalizeLocationName(resolveCountryName(countryCode));
    const regionLabel = region || regionCode;
    const detailedLabel = buildLocationLabel(
      city
        ? [city, regionLabel, countryName || countryCode]
        : regionLabel
          ? [regionLabel, countryName || countryCode]
          : [countryName || countryCode]
    );

    let primaryLabel = "";
    let precision = "country";
    if (city && regionLabel) {
      primaryLabel = buildLocationLabel([city, regionLabel]);
      precision = "city";
    } else if (city && (countryName || countryCode)) {
      primaryLabel = buildLocationLabel([city, countryName || countryCode]);
      precision = "city";
    } else if (city) {
      primaryLabel = city;
      precision = "city";
    } else if (regionLabel && (countryName || countryCode)) {
      primaryLabel = buildLocationLabel([regionLabel, countryName || countryCode]);
      precision = "region";
    } else if (regionLabel) {
      primaryLabel = regionLabel;
      precision = "region";
    } else {
      primaryLabel = countryName || countryCode;
    }

    const primaryOrFallback = primaryLabel || detailedLabel || "Unknown";
    const secondaryLabel = detailedLabel && detailedLabel !== primaryOrFallback
      ? detailedLabel
      : (precision === "country" && primaryOrFallback ? "Country only" : "");

    return {
      city,
      region,
      regionCode,
      countryCode,
      countryName,
      primaryLabel: primaryOrFallback,
      detailedLabel: detailedLabel || primaryOrFallback,
      secondaryLabel,
      precision,
      sortKey: [
        normalizeLocationName(countryName || countryCode || primaryOrFallback).toLowerCase(),
        normalizeLocationName(regionLabel).toLowerCase(),
        normalizeLocationName(city).toLowerCase(),
        precision === "country" ? "0" : precision === "region" ? "1" : "2",
        normalizeLocationName(primaryOrFallback).toLowerCase()
      ].join("|"),
      filterText: [
        primaryOrFallback,
        detailedLabel,
        city,
        region,
        regionCode,
        countryName,
        countryCode
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
    };
  }

  function buildLocationPresentation(entry) {
    const payload = {
      city: entry?.city,
      region: entry?.region,
      regionCode: entry?.regionCode ?? entry?.region_code,
      country: entry?.countryName ?? entry?.country ?? entry?.name,
      countryCode: entry?.countryCode ?? entry?.country_code ?? entry?.code
    };
    const formatter = window.StreamSuitesLocationFormatting?.buildPresentation;
    if (typeof formatter === "function") {
      try {
        const formatted = formatter(payload, { resolveCountryName });
        if (formatted && typeof formatted === "object") {
          return {
            ...buildFallbackLocationPresentation(payload),
            ...formatted
          };
        }
      } catch (error) {
        warnHelperFallback("location-formatting-error", "Shared location formatter failed. Falling back to Analytics-safe labels.", error);
      }
    } else {
      warnHelperFallback("location-formatting-missing", "Shared location formatter missing. Falling back to Analytics-safe labels.");
    }
    return buildFallbackLocationPresentation(payload);
  }

  function buildRegionLabelNode({ code, name }) {
    const iso2 = String(code || "").trim().toUpperCase();
    const labelName = String(name || resolveCountryName(iso2) || iso2 || "Unknown").trim() || "Unknown";
    const container = document.createElement("span");
    container.className = "region-label";
    const countryFlags = window.StreamSuitesCountryFlags;
    if (countryFlags?.createFlagVisualNode) {
      container.appendChild(
        countryFlags.createFlagVisualNode(iso2, {
          imageClassName: "flag-icon",
          fallbackClassName: "flag-icon flag-icon-fallback",
          alt: `${iso2} flag`
        })
      );
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

    const project = normalizeProject(entry?.project);
    const projectLine = document.createElement("span");
    const projectLabel = document.createElement("span");
    projectLabel.className = "ss-map-popup-label";
    projectLabel.textContent = "Project:";
    const projectValue = document.createElement("span");
    projectValue.className = "ss-map-popup-value";
    projectValue.textContent = formatProjectLabel(project);
    projectLine.append(projectLabel, document.createTextNode(" "), projectValue);
    root.appendChild(projectLine);

    if (project === "danielclancy") {
      const sourceLine = document.createElement("span");
      const sourceLabel = document.createElement("span");
      sourceLabel.className = "ss-map-popup-label";
      sourceLabel.textContent = "Source:";
      const sourceValue = document.createElement("span");
      sourceValue.className = "ss-map-popup-value";
      sourceValue.textContent = "DanielClancy";
      sourceLine.append(sourceLabel, document.createTextNode(" "), sourceValue);
      root.appendChild(sourceLine);
      const surfaceLine = document.createElement("span");
      const surfaceLabel = document.createElement("span");
      surfaceLabel.className = "ss-map-popup-label";
      surfaceLabel.textContent = "Surface:";
      const surfaceValue = document.createElement("span");
      surfaceValue.className = "ss-map-popup-value";
      surfaceValue.textContent = formatSurfaceLabel(entry?.surface || "danielclancy_public");
      surfaceLine.append(surfaceLabel, document.createTextNode(" "), surfaceValue);
      root.appendChild(surfaceLine);
    }

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
        if (state.mapEnlarged) {
          scheduleMapFrameForEnlargedMode({
            animate: false
          });
        }
      }, 100);
    });
  }

  function collectMapCoordinatesFromGeoJson() {
    const features = Array.isArray(state.pendingGeoJson?.features) ? state.pendingGeoJson.features : [];
    const coords = [];
    features.forEach((feature) => {
      if (feature?.geometry?.type !== "Point") return;
      const pair = feature.geometry.coordinates;
      if (!Array.isArray(pair) || pair.length !== 2) return;
      const lon = Number(pair[0]);
      const lat = Number(pair[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
      coords.push([lon, lat]);
    });
    return coords;
  }

  function resolveEnlargedMapFitPadding() {
    const height = Number(el.map?.clientHeight || 0);
    if (height >= 780) {
      return {
        top: 84,
        right: 88,
        bottom: 112,
        left: 88
      };
    }
    if (height <= 420) {
      return {
        top: 34,
        right: 38,
        bottom: 50,
        left: 38
      };
    }
    return {
      top: 58,
      right: 62,
      bottom: 80,
      left: 62
    };
  }

  function frameMapForEnlargedMode(options = {}) {
    if (!state.map || !state.mapReady || state.destroyed || state.mapCollapsed || !state.mapEnlarged) return;
    if (options.respectActiveCountry !== false && state.activeCountryCode) return;

    const coordinates = collectMapCoordinatesFromGeoJson();
    if (!coordinates.length) return;

    const map = state.map;
    const animate = options.animate === true;
    const duration = animate ? MAP_ENLARGED_FIT_DURATION_MS : 0;

    if (coordinates.length === 1) {
      map.easeTo({
        center: coordinates[0],
        zoom: MAP_ENLARGED_SINGLE_POINT_ZOOM,
        duration,
        essential: true
      });
      return;
    }

    let minLon = 180;
    let maxLon = -180;
    let minLat = 90;
    let maxLat = -90;
    coordinates.forEach(([lon, lat]) => {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    });
    if (minLon > maxLon || minLat > maxLat) return;

    map.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat]
      ],
      {
        padding: resolveEnlargedMapFitPadding(),
        maxZoom: MAP_ENLARGED_FIT_MAX_ZOOM,
        duration,
        essential: true
      }
    );
  }

  function scheduleMapFrameForEnlargedMode(options = {}) {
    if (state.mapFrameTimeout) {
      clearTimeout(state.mapFrameTimeout);
      state.mapFrameTimeout = null;
    }
    state.mapFrameTimeout = setTimeout(() => {
      state.mapFrameTimeout = null;
      frameMapForEnlargedMode(options);
    }, 140);
  }

  function updateMapToggleUi() {
    const collapsed = state.mapCollapsed === true;
    const enlarged = state.mapEnlarged === true;
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
    if (el.mapEnlargeToggleLabel) {
      el.mapEnlargeToggleLabel.textContent = enlarged ? "Restore" : "Enlarge";
    }
    if (el.mapEnlargeToggle) {
      el.mapEnlargeToggle.hidden = collapsed;
      el.mapEnlargeToggle.disabled = collapsed;
      el.mapEnlargeToggle.setAttribute("aria-pressed", String(enlarged));
    }
    el.mapPanel?.classList.toggle("is-map-enlarged", !collapsed && enlarged);
  }

  function normalizeMapMarkerFilter(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "sessions" || normalized === "requests" || normalized === "both") {
      return normalized;
    }
    return MAP_MARKER_FILTER_DEFAULT;
  }

  function setMapLayerVisibility(layerId, visible) {
    if (!state.map || !state.mapReady || !layerId) return;
    if (!state.map.getLayer(layerId)) return;
    state.map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  }

  function applyMapMarkerVisibility() {
    const mode = normalizeMapMarkerFilter(state.mapMarkerFilter);
    const showSessions = mode === "sessions" || mode === "both";
    const showRequests = mode === "requests" || mode === "both";
    setMapLayerVisibility(LAYERS.requestsBackdrop, showRequests);
    setMapLayerVisibility(LAYERS.activityGlow, showSessions);
    setMapLayerVisibility(LAYERS.activityCore, showSessions);
    setMapLayerVisibility(LAYERS.activityHit, showSessions || showRequests);
  }

  function renderMapMarkerFilterUi() {
    if (!el.mapMarkerFilter) return;
    const active = normalizeMapMarkerFilter(state.mapMarkerFilter);
    const buttons = el.mapMarkerFilter.querySelectorAll("[data-map-marker-filter]");
    buttons.forEach((button) => {
      const buttonMode = normalizeMapMarkerFilter(button.getAttribute("data-map-marker-filter"));
      const isActive = buttonMode === active;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function setMapMarkerFilter(value) {
    state.mapMarkerFilter = normalizeMapMarkerFilter(value);
    renderMapMarkerFilterUi();
    applyMapMarkerVisibility();
  }

  function handleMapMarkerFilterClick(event) {
    const button = event.target.closest("[data-map-marker-filter]");
    if (!(button instanceof HTMLButtonElement)) return;
    setMapMarkerFilter(button.getAttribute("data-map-marker-filter"));
  }

  function setMapCollapsed(collapsed, options = {}) {
    const shouldCollapse = collapsed === true;
    state.mapCollapsed = shouldCollapse;
    if (shouldCollapse) {
      state.mapEnlarged = false;
    }
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

  function setMapEnlarged(enlarged, options = {}) {
    const shouldEnlarge = enlarged === true && !state.mapCollapsed;
    const changed = shouldEnlarge !== state.mapEnlarged;
    state.mapEnlarged = shouldEnlarge;
    updateMapToggleUi();
    if (changed && options.resize !== false && !state.mapCollapsed) {
      scheduleMapResize();
      if (shouldEnlarge) {
        scheduleMapFrameForEnlargedMode({
          animate: true
        });
      }
    }
  }

  function handleMapToggleClick() {
    setMapCollapsed(!state.mapCollapsed, {
      persist: true,
      resize: true
    });
  }

  function handleMapEnlargeToggleClick() {
    if (state.mapCollapsed) return;
    setMapEnlarged(!state.mapEnlarged, {
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

    if (!map.getLayer(LAYERS.requestsBackdrop)) {
      map.addLayer({
        id: LAYERS.requestsBackdrop,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "case",
            ["==", ["get", "project"], "danielclancy"],
            "#f59e0b",
            "#1d4d93"
          ],
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "requests"], 0],
            0, 0.1,
            10, 0.16,
            50, 0.22,
            150, 0.28,
            400, 0.34
          ],
          "circle-blur": 0.68,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "requests"], 0],
            0, 10.5,
            10, 15,
            50, 21,
            150, 27,
            400, 33
          ]
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
          "circle-color": [
            "case",
            ["==", ["get", "project"], "danielclancy"],
            "#7c3aed",
            "#9f4dff"
          ],
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "sessions"], 0],
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
            ["coalesce", ["get", "sessions"], 0],
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
          "circle-color": [
            "case",
            ["==", ["get", "project"], "danielclancy"],
            "#ffd166",
            "#d6b8ff"
          ],
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "sessions"], 0],
            0, 0.82,
            10, 0.88,
            50, 0.93,
            150, 0.97,
            400, 0.99
          ],
          "circle-blur": 0.08,
          "circle-stroke-color": [
            "case",
            ["==", ["get", "project"], "danielclancy"],
            "rgba(255, 182, 72, 0.92)",
            "rgba(242,228,255,0.86)"
          ],
          "circle-stroke-width": 0.75,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "sessions"], 0],
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
            ["max", ["coalesce", ["get", "sessions"], 0], ["coalesce", ["get", "requests"], 0]],
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

    applyMapMarkerVisibility();

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
              requests,
              project: props.project,
              source_namespace: props.source_namespace,
              surface: props.surface
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

  function normalizeLocationRows(byLocation) {
    if (Array.isArray(byLocation)) {
      return byLocation;
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
      const project = normalizeProject(entry?.project);
      const key = `${code}|${project}`;
      const existing = aggregate.get(key);
      if (existing) {
        existing.requests += requests;
        existing.sessions += sessions;
        return;
      }
      aggregate.set(key, {
        code,
        name: resolveCountryName(code),
        requests,
        sessions,
        centroid: [lon, lat],
        project,
        source_namespace: entry?.source_namespace || project,
        surface: entry?.surface || (project === "danielclancy" ? "danielclancy_public" : "public"),
        projectLabel: entry?.project_label || formatProjectLabel(project)
      });
    });
    return Array.from(aggregate.values());
  }

  function buildLocationRows(locationRows) {
    const aggregate = new Map();
    normalizeLocationRows(locationRows).forEach((entry) => {
      const code = String(entry?.country_code || entry?.country || entry?.code || "").trim().toUpperCase();
      if (!code || code === "ZZ") return;
      const location = buildLocationPresentation({
        ...entry,
        countryCode: code
      });
      const precision = location.precision;
      const requestsRaw = Number(entry?.requests ?? entry?.count ?? 0);
      const sessionsRaw = Number(entry?.sessions ?? entry?.count ?? requestsRaw);
      const requests = Number.isFinite(requestsRaw) ? Math.max(0, Math.round(requestsRaw)) : 0;
      const sessions = Number.isFinite(sessionsRaw) ? Math.max(0, Math.round(sessionsRaw)) : requests;
      if (requests <= 0 && sessions <= 0) return;
      const key = [
        location.countryCode || code,
        location.region,
        location.regionCode,
        location.city
      ].join("|");
      const existing = aggregate.get(key);
      if (existing) {
        existing.requests += requests;
        existing.sessions += sessions;
        return;
      }
      aggregate.set(key, {
        key,
        code,
        countryCode: location.countryCode || code,
        countryName: location.countryName || resolveCountryName(code),
        region: location.region,
        regionCode: location.regionCode,
        city: location.city,
        precision,
        locationLabel: location.primaryLabel,
        locationDetailLabel: location.detailedLabel,
        locationMeta: location.secondaryLabel,
        locationSortKey: location.sortKey,
        locationFilterText: location.filterText,
        requests,
        sessions
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
        sessions: Number.isFinite(sessions) ? sessions : 0,
        project: normalizeProject(entry?.project),
        source_namespace: entry?.source_namespace || normalizeProject(entry?.project),
        surface: entry?.surface || (normalizeProject(entry?.project) === "danielclancy" ? "danielclancy_public" : "public"),
        project_label: entry?.projectLabel || formatProjectLabel(entry?.project)
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

  function resolveLocationLabel(entry) {
    return buildLocationPresentation(entry).primaryLabel || "Unknown";
  }

  function resolveLocationMeta(entry) {
    return buildLocationPresentation(entry).secondaryLabel;
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
    if (key === "location") {
      return String(entry?.locationSortKey || buildLocationPresentation(entry).sortKey || "").toLowerCase();
    }
    if (key === "country") {
      return `${String(entry?.countryName || resolveCountryName(entry?.code) || "").toLowerCase()}|${String(entry?.code || "").toLowerCase()}`;
    }
    if (key === "precision") {
      const order = {
        city: 3,
        region: 2,
        country: 1
      };
      return order[String(entry?.precision || "").toLowerCase()] || 0;
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
      const locationFallback = String(resolveCountrySortValue(left, "location", totals)).localeCompare(
        String(resolveCountrySortValue(right, "location", totals)),
        undefined,
        {
          sensitivity: "base",
          numeric: true
        }
      );
      if (locationFallback !== 0) return locationFallback;
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

  function clampAnalyticsPageSize(value, fallback = 10) {
    const parsed = Number.parseInt(String(value || ""), 10);
    if (!Number.isFinite(parsed)) return fallback;
    if (!ANALYTICS_TABLE_PAGE_SIZE_OPTIONS.includes(parsed)) return fallback;
    return parsed;
  }

  function clampAnalyticsRows(rows) {
    return Array.isArray(rows) ? rows.slice(0, ANALYTICS_TABLE_RETENTION_LIMIT) : [];
  }

  function paginateAnalyticsRows(rows, page, pageSize) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const safePageSize = clampAnalyticsPageSize(pageSize, 10);
    const totalItems = safeRows.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
    const currentPage = Math.min(Math.max(Number.parseInt(String(page || ""), 10) || 1, 1), totalPages);
    const startIndex = totalItems ? (currentPage - 1) * safePageSize : 0;
    const endIndex = Math.min(totalItems, startIndex + safePageSize);
    return {
      items: safeRows.slice(startIndex, endIndex),
      currentPage,
      pageSize: safePageSize,
      totalItems,
      totalPages,
      startIndex,
      endIndex
    };
  }

  function buildAnalyticsPaginationMarkup(target, pageInfo) {
    if (!pageInfo || pageInfo.totalItems <= 0 || pageInfo.totalPages <= 1) return "";
    const pageButtons = [];
    const firstPage = Math.max(1, pageInfo.currentPage - 1);
    const lastPage = Math.min(pageInfo.totalPages, firstPage + 2);
    const normalizedFirst = Math.max(1, lastPage - 2);
    for (let page = normalizedFirst; page <= lastPage; page += 1) {
      pageButtons.push(`
        <button
          type="button"
          class="ss-alerts-pagination-button${page === pageInfo.currentPage ? " is-active" : ""}"
          data-analytics-pagination-target="${escapeHtml(target)}"
          data-analytics-pagination-page="${escapeHtml(String(page))}"
          aria-pressed="${page === pageInfo.currentPage ? "true" : "false"}"
        >${escapeHtml(String(page))}</button>
      `);
    }
    return `
      <div class="ss-alerts-pagination-summary">
        Showing ${escapeHtml(String(pageInfo.startIndex + 1))}-${escapeHtml(String(pageInfo.endIndex))} of ${escapeHtml(String(pageInfo.totalItems))}
      </div>
      <div class="ss-alerts-pagination-controls">
        <button
          type="button"
          class="ss-alerts-pagination-button"
          data-analytics-pagination-target="${escapeHtml(target)}"
          data-analytics-pagination-page="${escapeHtml(String(pageInfo.currentPage - 1))}"
          ${pageInfo.currentPage <= 1 ? "disabled" : ""}
        >Prev</button>
        ${pageButtons.join("")}
        <button
          type="button"
          class="ss-alerts-pagination-button"
          data-analytics-pagination-target="${escapeHtml(target)}"
          data-analytics-pagination-page="${escapeHtml(String(pageInfo.currentPage + 1))}"
          ${pageInfo.currentPage >= pageInfo.totalPages ? "disabled" : ""}
        >Next</button>
      </div>
    `;
  }

  function renderAnalyticsPagination(container, target, pageInfo) {
    if (!(container instanceof HTMLElement)) return;
    const markup = buildAnalyticsPaginationMarkup(target, pageInfo);
    container.innerHTML = markup;
    container.classList.toggle("hidden", !markup);
  }

  function syncAnalyticsPageSizeControl(selectEl, pageSize) {
    if (!(selectEl instanceof HTMLSelectElement)) return;
    const safePageSize = clampAnalyticsPageSize(pageSize, 10);
    if (selectEl.value !== String(safePageSize)) {
      selectEl.value = String(safePageSize);
    }
  }

  function describeRetainedCount(retainedCount, totalCount, singularLabel, pluralLabel) {
    const singular = singularLabel || "item";
    const plural = pluralLabel || `${singular}s`;
    if (totalCount > retainedCount) {
      return `${retainedCount.toLocaleString()} of ${totalCount.toLocaleString()} ${plural}`;
    }
    return `${retainedCount.toLocaleString()} ${retainedCount === 1 ? singular : plural}`;
  }

  function renderCountryTable() {
    const allRows = Array.isArray(state.locationRows) && state.locationRows.length ? state.locationRows : state.countryRows;
    const filterText = String(state.countryFilter || "").trim().toLowerCase();
    const filteredRows = filterText
      ? allRows.filter((entry) => {
          const code = String(entry?.code || "").toLowerCase();
          const countryName = String(entry?.countryName || entry?.name || "").toLowerCase();
          const region = String(entry?.region || "").toLowerCase();
          const regionCode = String(entry?.regionCode || entry?.region_code || "").toLowerCase();
          const city = String(entry?.city || "").toLowerCase();
          const label = String(entry?.locationFilterText || buildLocationPresentation(entry).filterText || "").toLowerCase();
          return (
            code.includes(filterText) ||
            countryName.includes(filterText) ||
            region.includes(filterText) ||
            regionCode.includes(filterText) ||
            city.includes(filterText) ||
            label.includes(filterText)
          );
        })
      : allRows;
    const totals = state.locationRows.length ? state.locationTotals : state.countryTotals;
    const sortedRows = sortCountryRows(filteredRows, totals);
    const retainedRows = clampAnalyticsRows(sortedRows);
    const pageInfo = paginateAnalyticsRows(
      retainedRows,
      state.tableViews.countries.page,
      state.tableViews.countries.pageSize
    );
    state.tableViews.countries.page = pageInfo.currentPage;
    state.tableViews.countries.pageSize = pageInfo.pageSize;
    updateCountrySortHeaders();
    syncAnalyticsPageSizeControl(el.countriesPageSize, pageInfo.pageSize);
    renderAnalyticsPagination(el.countriesPagination, "countries", pageInfo);

    if (el.countriesCount) {
      if (filterText) {
        const retainedSummary = describeRetainedCount(retainedRows.length, sortedRows.length, "location", "locations");
        el.countriesCount.textContent = `${retainedSummary} from ${allRows.length.toLocaleString()} filtered locations`;
      } else {
        el.countriesCount.textContent = describeRetainedCount(retainedRows.length, allRows.length, "location", "locations");
      }
    }

    if (!el.countriesBody || !el.countriesEmpty) return;
    if (!retainedRows.length) {
      el.countriesBody.innerHTML = "";
      el.countriesEmpty.textContent = filterText
        ? "No geographic rows match this filter."
        : "No geographic data detected in this window.";
      el.countriesEmpty.classList.remove("hidden");
      return;
    }

    el.countriesEmpty.classList.add("hidden");
    el.countriesBody.textContent = "";
    const fragment = document.createDocumentFragment();
    pageInfo.items.forEach((entry) => {
      const code = String(entry?.code || "").toUpperCase();
      const countryName = String(entry?.countryName || entry?.name || resolveCountryName(code) || code).trim() || code;
      const locationName = resolveLocationLabel(entry);
      const locationMeta = resolveLocationMeta(entry);
      const isActive = code === state.activeCountryCode;

      const row = document.createElement("tr");
      row.className = `ss-analytics-country-row${isActive ? " is-active" : ""}`;
      row.setAttribute("data-country-code", code);
      row.setAttribute("tabindex", "0");
      row.setAttribute("role", "button");
      row.setAttribute("aria-label", `Focus map on ${countryName}`);
      row.setAttribute("data-region-name", countryName);

      const locationCell = document.createElement("td");
      const locationEl = document.createElement("span");
      locationEl.className = "ss-analytics-location-name";
      locationEl.textContent = locationName;
      const locationDetail = String(entry?.locationDetailLabel || buildLocationPresentation(entry).detailedLabel || "").trim();
      locationEl.title = locationDetail || locationName;
      locationCell.appendChild(locationEl);
      if (locationMeta) {
        const locationMetaEl = document.createElement("span");
        locationMetaEl.className = "ss-analytics-location-meta";
        locationMetaEl.textContent = locationMeta;
        locationCell.appendChild(locationMetaEl);
      }
      row.appendChild(locationCell);

      const countryCell = document.createElement("td");
      const nameEl = document.createElement("span");
      nameEl.className = "ss-analytics-country-name";
      nameEl.appendChild(
        buildRegionLabelNode({
          code,
          name: countryName
        })
      );
      const codeEl = document.createElement("span");
      codeEl.className = "ss-analytics-country-code";
      codeEl.textContent = code;
      countryCell.append(nameEl, codeEl);
      row.appendChild(countryCell);

      const precisionCell = document.createElement("td");
      precisionCell.textContent = String(entry?.precision || "country").trim() || "country";
      row.appendChild(precisionCell);

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
      state.countrySort.direction =
        sortKey === "location" || sortKey === "country" || sortKey === "precision" ? "asc" : "desc";
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
    state.tableViews.countries.page = 1;
    renderCountryTable();
  }

  function handleAnalyticsPageSizeChange(event) {
    const select = event?.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const target = String(select.getAttribute("data-analytics-page-size-target") || "").trim();
    const nextPageSize = clampAnalyticsPageSize(select.value, 10);
    if (target === "countries") {
      state.tableViews.countries.pageSize = nextPageSize;
      state.tableViews.countries.page = 1;
      renderCountryTable();
      return;
    }
    if (target === "endpoints") {
      state.tableViews.endpoints.pageSize = nextPageSize;
      state.tableViews.endpoints.page = 1;
      renderEndpoints(state.lastEndpoints);
      return;
    }
    if (target === "recentRequests") {
      state.tableViews.recentRequests.pageSize = nextPageSize;
      state.tableViews.recentRequests.page = 1;
      renderRecentRequests(state.lastRecentRequests);
    }
  }

  function handleAnalyticsPaginationClick(event) {
    const button = event.target.closest("[data-analytics-pagination-target][data-analytics-pagination-page]");
    if (!(button instanceof HTMLButtonElement)) return;
    const target = String(button.getAttribute("data-analytics-pagination-target") || "").trim();
    const nextPage = Number.parseInt(String(button.getAttribute("data-analytics-pagination-page") || ""), 10);
    if (!Number.isFinite(nextPage) || nextPage < 1) return;
    if (target === "countries") {
      state.tableViews.countries.page = nextPage;
      renderCountryTable();
      return;
    }
    if (target === "endpoints") {
      state.tableViews.endpoints.page = nextPage;
      renderEndpoints(state.lastEndpoints);
      return;
    }
    if (target === "recentRequests") {
      state.tableViews.recentRequests.page = nextPage;
      renderRecentRequests(state.lastRecentRequests);
    }
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
    if (state.mapEnlarged) {
      scheduleMapFrameForEnlargedMode({
        animate: false
      });
    }
  }

  function updateLocationBreakdown(locationRows, locationSupport) {
    const rows = buildLocationRows(locationRows);
    state.locationRows = rows;
    state.locationTotals = computeCountryTotals(rows);
    state.locationSupport = {
      country: Number(locationSupport?.country ?? 0) || 0,
      region: Number(locationSupport?.region ?? 0) || 0,
      city: Number(locationSupport?.city ?? 0) || 0
    };
    renderLocationSupport(state.locationSupport);
    renderCountryTable();
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

  function renderLocationSupport(locationSupport) {
    const safe = locationSupport && typeof locationSupport === "object" ? locationSupport : {};
    const countryOnly = Number(safe.country ?? 0);
    const regionDetail = Number(safe.region ?? 0);
    const cityDetail = Number(safe.city ?? 0);
    if (el.geoCountryOnly) {
      el.geoCountryOnly.textContent = formatNumber(countryOnly);
    }
    if (el.geoRegionDetail) {
      el.geoRegionDetail.textContent = formatNumber(regionDetail);
    }
    if (el.geoCityDetail) {
      el.geoCityDetail.textContent = formatNumber(cityDetail);
    }
  }

  function normalizeEndpoints(endpoints) {
    const rows = Array.isArray(endpoints) ? endpoints : [];
    return rows
      .map((entry) => {
        const path = String(entry?.path || entry?.route || "").trim();
        const method = String(entry?.method || "GET").trim().toUpperCase() || "GET";
        const requests = Number(entry?.requests ?? 0);
        const errors = Number(entry?.errors ?? 0);
        const p95 = Number(entry?.p95_ms ?? entry?.p95 ?? 0);
        if (!path) return null;
        return {
          path,
          method,
          requests: Number.isFinite(requests) ? Math.max(0, Math.round(requests)) : 0,
          errors: Number.isFinite(errors) ? Math.max(0, Math.round(errors)) : 0,
          p95_ms: Number.isFinite(p95) ? Math.max(0, Math.round(p95)) : 0
        };
      })
      .filter(Boolean);
  }

  function renderEndpoints(endpoints) {
    if (!el.endpointsBody || !el.endpointsEmpty) return;
    const rows = normalizeEndpoints(endpoints);
    state.lastEndpoints = rows;
    const retainedRows = clampAnalyticsRows(rows);
    const pageInfo = paginateAnalyticsRows(
      retainedRows,
      state.tableViews.endpoints.page,
      state.tableViews.endpoints.pageSize
    );
    state.tableViews.endpoints.page = pageInfo.currentPage;
    state.tableViews.endpoints.pageSize = pageInfo.pageSize;
    syncAnalyticsPageSizeControl(el.endpointsPageSize, pageInfo.pageSize);
    renderAnalyticsPagination(el.endpointsPagination, "endpoints", pageInfo);
    if (el.endpointsCount) {
      el.endpointsCount.textContent = describeRetainedCount(retainedRows.length, rows.length, "route", "routes");
    }
    if (!retainedRows.length) {
      el.endpointsBody.innerHTML = "";
      el.endpointsEmpty.classList.remove("hidden");
      return;
    }
    el.endpointsEmpty.classList.add("hidden");
    el.endpointsBody.innerHTML = pageInfo.items
      .map((entry) => {
        return `
          <tr>
            <td><span class="ss-analytics-endpoint-path">${escapeHtml(entry.path)}</span></td>
            <td><span class="ss-analytics-endpoint-method">${escapeHtml(entry.method)}</span></td>
            <td class="ss-analytics-metric">${escapeHtml(formatNumber(entry.requests))}</td>
            <td class="ss-analytics-metric">${escapeHtml(formatNumber(entry.errors))}</td>
            <td class="ss-analytics-metric">${escapeHtml(formatNumber(entry.p95_ms))}</td>
          </tr>
        `;
      })
      .join("");
  }

  function normalizeRecentRequests(rows) {
    return (Array.isArray(rows) ? rows : [])
      .map((entry) => {
        const occurredAt = String(entry?.occurred_at || entry?.timestamp || "").trim();
        const path = String(entry?.path || entry?.route || "").trim();
        if (!occurredAt || !path) return null;
        const method = String(entry?.method || "GET").trim().toUpperCase() || "GET";
        const statusCode = Number(entry?.status_code ?? 0);
        const latencyMs = Number(entry?.latency_ms ?? 0);
        return {
          occurredAt,
          path,
          method,
          surface: String(entry?.surface || "").trim() || "api",
          statusCode: Number.isFinite(statusCode) ? Math.max(0, Math.round(statusCode)) : 0,
          latencyMs: Number.isFinite(latencyMs) ? Math.max(0, Math.round(latencyMs)) : 0,
          locationLabel: String(entry?.location_label || "").trim(),
          countryCode: String(entry?.country_code || "").trim(),
          sessionId: String(entry?.session_id || "").trim(),
          clientIp: String(entry?.client_ip || "").trim(),
          referrerHost: String(entry?.referrer_host || "").trim()
        };
      })
      .filter(Boolean);
  }

  function renderRecentRequests(rows) {
    if (!el.recentRequestsBody || !el.recentRequestsEmpty) return;
    const items = normalizeRecentRequests(rows);
    state.lastRecentRequests = items;
    const retainedRows = clampAnalyticsRows(items);
    const pageInfo = paginateAnalyticsRows(
      retainedRows,
      state.tableViews.recentRequests.page,
      state.tableViews.recentRequests.pageSize
    );
    state.tableViews.recentRequests.page = pageInfo.currentPage;
    state.tableViews.recentRequests.pageSize = pageInfo.pageSize;
    syncAnalyticsPageSizeControl(el.recentRequestsPageSize, pageInfo.pageSize);
    renderAnalyticsPagination(el.recentRequestsPagination, "recentRequests", pageInfo);
    if (el.recentRequestsCount) {
      el.recentRequestsCount.textContent = describeRetainedCount(retainedRows.length, items.length, "request", "requests");
    }
    if (!retainedRows.length) {
      el.recentRequestsBody.innerHTML = "";
      el.recentRequestsEmpty.classList.remove("hidden");
      return;
    }

    el.recentRequestsEmpty.classList.add("hidden");
    el.recentRequestsBody.innerHTML = pageInfo.items
      .map((entry) => {
        const locationLabel = entry.locationLabel || entry.countryCode || "Unknown";
        const routeMeta = [formatSurfaceLabel(entry.surface), entry.referrerHost ? `Referrer ${entry.referrerHost}` : ""]
          .filter(Boolean)
          .join(" · ");
        return `
          <tr>
            <td class="align-right">${escapeHtml(formatTimestamp(entry.occurredAt))}</td>
            <td>
              <div class="ss-analytics-request-route">
                <span class="ss-analytics-endpoint-method">${escapeHtml(entry.method)}</span>
                <code>${escapeHtml(entry.path)}</code>
              </div>
              <span class="ss-analytics-request-meta">${escapeHtml(routeMeta || "API request")}</span>
            </td>
            <td class="ss-analytics-request-status">
              <strong>${escapeHtml(formatNumber(entry.statusCode))}</strong>
              <span>${escapeHtml(formatNumber(entry.latencyMs))} ms</span>
            </td>
            <td class="ss-analytics-request-location">
              <strong>${escapeHtml(locationLabel)}</strong>
              <span>${escapeHtml(entry.countryCode || "No country code")}</span>
            </td>
            <td class="ss-analytics-request-identifier"><code>${escapeHtml(entry.sessionId || "—")}</code></td>
            <td class="ss-analytics-request-identifier"><code>${escapeHtml(entry.clientIp || "—")}</code></td>
          </tr>
        `;
      })
      .join("");
  }

  function normalizeNamedCountRows(rows, keyNames) {
    const list = Array.isArray(rows) ? rows : [];
    return list
      .map((entry) => {
        const label = keyNames
          .map((key) => String(entry?.[key] || "").trim())
          .find((value) => value);
        const count = Number(entry?.count ?? entry?.requests ?? 0);
        if (!label) return null;
        return {
          label,
          count: Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0
        };
      })
      .filter((entry) => entry && entry.count > 0)
      .sort((left, right) => right.count - left.count);
  }

  function renderNamedCountList(listEl, emptyEl, rows, keyNames) {
    if (!listEl || !emptyEl) return;
    const items = normalizeNamedCountRows(rows, keyNames);
    if (!items.length) {
      listEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      return;
    }
    emptyEl.classList.add("hidden");
    listEl.innerHTML = items
      .map((entry) => {
        return `
          <li>
            <span>${escapeHtml(entry.label)}</span>
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

  function resolveSurfaceView(key) {
    const normalized = String(key || "").trim().toLowerCase();
    const directMap = {
      overview: "overview",
      analytics: "analytics",
      accounts: "accounts",
      donations: "accounts",
      "data-signals": "data-signals",
      telemetry: "overview",
      "auth-events": "overview",
      "auth_events": "overview",
      "admin-activity": "overview",
      "admin_activity": "overview",
      "api-usage": "api-usage",
      "api_usage": "api-usage"
    };
    if (directMap[normalized]) return directMap[normalized];
    if (normalized.includes("donation")) return "accounts";
    if (normalized.includes("auth")) return "overview";
    if (normalized.includes("telemetry")) return "overview";
    if (normalized.includes("activity")) return "overview";
    if (normalized.includes("signal")) return "data-signals";
    return "";
  }

  function handleSurfaceViewClick(event) {
    const button = event.target.closest("[data-surface-view]");
    if (!(button instanceof HTMLButtonElement)) return;
    const view = String(button.getAttribute("data-surface-view") || "").trim();
    if (!view) return;
    event.preventDefault();
    window.StreamSuitesAdminRoutes?.navigateToView?.(view);
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
        const targetView = resolveSurfaceView(entry.key);
        const surfaceLabel = formatSurfaceLabel(entry.key);
        const surfaceMeta = surfaceLabel.localeCompare(entry.key, undefined, { sensitivity: "base" }) === 0
          ? "API"
          : `${entry.key} · API`;
        return `
          <li class="ss-analytics-surface-row">
            <div class="ss-analytics-surface-main">
              <span>${escapeHtml(surfaceLabel)}</span>
              <span class="ss-analytics-surface-source">${escapeHtml(surfaceMeta)}</span>
            </div>
            <div class="ss-analytics-surface-meta">
              <strong>${escapeHtml(formatNumber(entry.count))}</strong>
              ${targetView ? `<button type="button" class="ss-btn ss-btn-small ss-btn-secondary" data-surface-view="${escapeHtml(targetView)}">View</button>` : ""}
            </div>
          </li>
        `;
      })
      .join("");
  }

  function updateExecutiveSummary(payload) {
    const safe = payload && typeof payload === "object" ? payload : {};
    const surfaces = normalizeSurfaces(safe?.surfaces).filter((entry) => entry.count > 0);
    const referrers = normalizeReferrers(safe?.top_referrers);
    const platforms = normalizeNamedCountRows(safe?.clients?.platforms, ["platform", "label"]);
    const detailRows = Math.max(0, Number(state.locationSupport.region || 0)) + Math.max(0, Number(state.locationSupport.city || 0));

    if (el.summaryActiveSurface) {
      el.summaryActiveSurface.textContent = formatNumber(surfaces.length);
    }
    if (el.summaryTopReferrer) {
      el.summaryTopReferrer.textContent = referrers.length ? referrers[0].domain : "--";
    }
    if (el.summaryTopPlatform) {
      el.summaryTopPlatform.textContent = platforms.length ? platforms[0].label : "--";
    }
    if (el.summaryLocationDetail) {
      el.summaryLocationDetail.textContent = detailRows > 0 ? formatNumber(detailRows) : "--";
    }
  }

  function setSummary(payload) {
    const safe = payload && typeof payload === "object" ? payload : {};
    const totalRequests = Number(safe?.totals?.requests ?? 0);
    const totalSessions = Number(safe?.totals?.sessions ?? 0);
    const generatedAt = safe?.generated_at || null;
    const windowLabel = String(safe?.window || state.selectedWindow || DEFAULT_WINDOW);
    if (el.totalRequests) {
      el.totalRequests.textContent = formatNumber(totalRequests);
    }
    if (el.totalSessions) {
      el.totalSessions.textContent = formatNumber(totalSessions);
    }
    if (el.snapshotTotalRequests) {
      el.snapshotTotalRequests.textContent = formatNumber(totalRequests);
    }
    if (el.snapshotTotalSessions) {
      el.snapshotTotalSessions.textContent = formatNumber(totalSessions);
    }
    if (el.windowLabel) {
      el.windowLabel.textContent = windowLabel;
    }
    if (el.generatedAt) {
      el.generatedAt.textContent = formatTimestamp(generatedAt);
    }
    if (el.snapshotGeneratedAt) {
      el.snapshotGeneratedAt.textContent = formatTimestamp(generatedAt);
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
        renderEndpoints(data?.top_endpoints);
        renderNamedCountList(el.browsersList, el.browsersEmpty, data?.clients?.browsers, ["browser", "label"]);
        renderNamedCountList(el.devicesList, el.devicesEmpty, data?.clients?.devices, ["device", "label"]);
        renderNamedCountList(el.platformsList, el.platformsEmpty, data?.clients?.platforms, ["platform", "label"]);
        renderRecentRequests(data?.recent_requests);
        setSummary(data);
        updateLocationBreakdown(data?.by_location, data?.location_support);
        await updateMap(data?.by_country_markers || data?.by_country);
        updateExecutiveSummary(data);

        if (Number(data?.totals?.requests || 0) <= 0) {
          setStatus("No events in selected window.");
        } else {
          setStatus(`Live analytics (${String(data?.window || selectedWindow)})`);
        }
      } catch (err) {
        if (err?.isAbort || controller.signal.aborted) {
          return;
        }
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

  function handleRefreshButtonClick() {
    void fetchAnalytics({ withLoader: true, forceRefresh: true });
  }

  function init() {
    state.destroyed = false;
    state.latestByCountry = [];
    state.countryRows = [];
    state.countryTotals = {
      sessions: 0,
      requests: 0
    };
    state.locationRows = [];
    state.locationTotals = {
      sessions: 0,
      requests: 0
    };
    state.locationSupport = {
      country: 0,
      region: 0,
      city: 0
    };
    state.tableViews = {
      countries: {
        page: 1,
        pageSize: 10
      },
      endpoints: {
        page: 1,
        pageSize: 10
      },
      recentRequests: {
        page: 1,
        pageSize: 10
      }
    };
    state.lastEndpoints = [];
    state.lastRecentRequests = [];
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
    el.mapEnlargeToggle = $("analytics-map-enlarge-toggle");
    el.mapEnlargeToggleLabel = $("analytics-map-enlarge-toggle-label");
    el.mapMarkerFilter = document.querySelector(".ss-analytics-map-marker-filter");
    el.mapGeneratedAt = $("analytics-map-generated-at");
    el.mapCountryCount = $("analytics-map-country-count");
    el.mapSessions = $("analytics-map-sessions");
    el.mapTopCountry = $("analytics-map-top-country");
    el.mapFeedback = $("analytics-map-feedback");
    el.banner = $("analytics-banner");
    el.status = $("analytics-status");
    el.windowSelect = $("analytics-window-select");
    el.refreshButton = $("analytics-refresh-button");
    el.referrersList = $("analytics-referrers-list");
    el.referrersEmpty = $("analytics-referrers-empty");
    el.totalRequests = $("analytics-total-requests");
    el.totalSessions = $("analytics-total-sessions");
    el.snapshotTotalRequests = $("analytics-snapshot-total-requests");
    el.snapshotTotalSessions = $("analytics-snapshot-total-sessions");
    el.windowLabel = $("analytics-window-label");
    el.generatedAt = $("analytics-generated-at");
    el.snapshotGeneratedAt = $("analytics-snapshot-generated-at");
    el.summaryTopReferrer = $("analytics-summary-top-referrer");
    el.summaryTopPlatform = $("analytics-summary-top-platform");
    el.summaryLocationDetail = $("analytics-summary-location-detail");
    el.summaryActiveSurface = $("analytics-summary-active-surface");
    el.surfacesList = $("analytics-surfaces-list");
    el.surfacesEmpty = $("analytics-surfaces-empty");
    el.countriesTable = $("analytics-countries-table");
    el.countriesBody = $("analytics-countries-body");
    el.countriesEmpty = $("analytics-countries-empty");
    el.countriesSearch = $("analytics-countries-search");
    el.countriesCount = $("analytics-countries-count");
    el.countriesPageSize = $("analytics-countries-page-size");
    el.countriesPagination = $("analytics-countries-pagination");
    el.geoCountryOnly = $("analytics-geo-country-only");
    el.geoRegionDetail = $("analytics-geo-region-detail");
    el.geoCityDetail = $("analytics-geo-city-detail");
    el.endpointsCount = $("analytics-endpoints-count");
    el.endpointsPageSize = $("analytics-endpoints-page-size");
    el.endpointsPagination = $("analytics-endpoints-pagination");
    el.endpointsBody = $("analytics-endpoints-body");
    el.endpointsEmpty = $("analytics-endpoints-empty");
    el.browsersList = $("analytics-browsers-list");
    el.browsersEmpty = $("analytics-browsers-empty");
    el.devicesList = $("analytics-devices-list");
    el.devicesEmpty = $("analytics-devices-empty");
    el.platformsList = $("analytics-platforms-list");
    el.platformsEmpty = $("analytics-platforms-empty");
    el.recentRequestsCount = $("analytics-recent-requests-count");
    el.recentRequestsPageSize = $("analytics-recent-requests-page-size");
    el.recentRequestsPagination = $("analytics-recent-requests-pagination");
    el.recentRequestsBody = $("analytics-recent-requests-body");
    el.recentRequestsEmpty = $("analytics-recent-requests-empty");
    if (el.mapToggle) {
      el.mapToggle.addEventListener("click", handleMapToggleClick);
    }
    if (el.mapEnlargeToggle) {
      el.mapEnlargeToggle.addEventListener("click", handleMapEnlargeToggleClick);
    }
    if (el.mapMarkerFilter) {
      el.mapMarkerFilter.addEventListener("click", handleMapMarkerFilterClick);
    }
    if (el.refreshButton) {
      el.refreshButton.addEventListener("click", handleRefreshButtonClick);
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
    [
      ["countries", el.countriesPageSize],
      ["endpoints", el.endpointsPageSize],
      ["recentRequests", el.recentRequestsPageSize]
    ].forEach(([target, selectEl]) => {
      if (!(selectEl instanceof HTMLSelectElement)) return;
      selectEl.setAttribute("data-analytics-page-size-target", target);
      syncAnalyticsPageSizeControl(selectEl, 10);
      selectEl.addEventListener("change", handleAnalyticsPageSizeChange);
    });
    [
      el.countriesPagination,
      el.endpointsPagination,
      el.recentRequestsPagination
    ].forEach((container) => {
      container?.addEventListener("click", handleAnalyticsPaginationClick);
    });
    setMapMarkerFilter(MAP_MARKER_FILTER_DEFAULT);

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
    renderEndpoints([]);
    renderNamedCountList(el.browsersList, el.browsersEmpty, [], ["browser", "label"]);
    renderNamedCountList(el.devicesList, el.devicesEmpty, [], ["device", "label"]);
    renderNamedCountList(el.platformsList, el.platformsEmpty, [], ["platform", "label"]);
    renderRecentRequests([]);
    renderLocationSupport(null);
    updateExecutiveSummary(null);
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
    const initialHydration = fetchAnalytics({ withLoader: true });
    if (state.refreshHandle) {
      clearInterval(state.refreshHandle);
    }
    state.refreshHandle = setInterval(() => {
      if (state.destroyed) return;
      void fetchAnalytics({ withLoader: false, forceRefresh: true });
    }, ANALYTICS_REFRESH_INTERVAL_MS);
    return initialHydration;
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
    if (el.mapEnlargeToggle) {
      el.mapEnlargeToggle.removeEventListener("click", handleMapEnlargeToggleClick);
    }
    if (el.mapMarkerFilter) {
      el.mapMarkerFilter.removeEventListener("click", handleMapMarkerFilterClick);
    }
    if (el.refreshButton) {
      el.refreshButton.removeEventListener("click", handleRefreshButtonClick);
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
    if (state.mapFrameTimeout) {
      clearTimeout(state.mapFrameTimeout);
      state.mapFrameTimeout = null;
    }

    if (el.surfacesList && surfacesClickBound) {
      el.surfacesList.removeEventListener("click", handleSurfaceViewClick);
      surfacesClickBound = false;
    }

    state.mapReady = false;
    state.mapCollapsed = false;
    state.mapEnlarged = false;
    state.mapMarkerFilter = MAP_MARKER_FILTER_DEFAULT;
    state.pendingGeoJson = emptyGeoJson();
    state.latestByCountry = [];
    state.countryRows = [];
    state.countryTotals = {
      sessions: 0,
      requests: 0
    };
    state.locationRows = [];
    state.locationTotals = {
      sessions: 0,
      requests: 0
    };
    state.locationSupport = {
      country: 0,
      region: 0,
      city: 0
    };
    state.tableViews = {
      countries: {
        page: 1,
        pageSize: 10
      },
      endpoints: {
        page: 1,
        pageSize: 10
      },
      recentRequests: {
        page: 1,
        pageSize: 10
      }
    };
    state.lastEndpoints = [];
    state.lastRecentRequests = [];
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

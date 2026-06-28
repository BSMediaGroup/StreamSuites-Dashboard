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
    NZ: [174.886, -40.9006],
    LS: [28.2336, -29.61]
  };

  const COUNTRY_CODE_ALIASES = Object.freeze({
    UK: "GB",
    USA: "US",
    "UNITED STATES": "US",
    "UNITED STATES OF AMERICA": "US",
    "UNITED KINGDOM": "GB",
    "GREAT BRITAIN": "GB",
    LESOTHO: "LS"
  });

  const CITY_COORDINATE_LOOKUP = Object.freeze([
    { city: "Portland", region: "Oregon", country_code: "US", latitude: 45.5152, longitude: -122.6784 },
    { city: "Los Angeles", region: "California", country_code: "US", latitude: 34.0522, longitude: -118.2437 },
    { city: "Santa Clara", region: "California", country_code: "US", latitude: 37.3541, longitude: -121.9552 },
    { city: "Ashburn", region: "Virginia", country_code: "US", latitude: 39.0438, longitude: -77.4874 },
    { city: "London", region: "England", country_code: "GB", latitude: 51.5072, longitude: -0.1276 },
    { city: "Sydney", region: "New South Wales", country_code: "AU", latitude: -33.8688, longitude: 151.2093 },
    { city: "Sydney", region: "NSW", country_code: "AU", latitude: -33.8688, longitude: 151.2093 },
    { city: "Melbourne", region: "Victoria", country_code: "AU", latitude: -37.8136, longitude: 144.9631 },
    { city: "Brisbane", region: "Queensland", country_code: "AU", latitude: -27.4698, longitude: 153.0251 },
    { city: "Perth", region: "Western Australia", country_code: "AU", latitude: -31.9523, longitude: 115.8613 },
    { city: "Toronto", region: "Ontario", country_code: "CA", latitude: 43.6532, longitude: -79.3832 },
    { city: "Vancouver", region: "British Columbia", country_code: "CA", latitude: 49.2827, longitude: -123.1207 },
    { city: "São Paulo", region: "São Paulo", country_code: "BR", latitude: -23.5505, longitude: -46.6333 },
    { city: "Rio de Janeiro", region: "Rio de Janeiro", country_code: "BR", latitude: -22.9068, longitude: -43.1729 },
    { city: "Maseru", region: "Maseru District", country_code: "LS", latitude: -29.31, longitude: 27.48 },
    { city: "Auckland", region: "Auckland", country_code: "NZ", latitude: -36.8509, longitude: 174.7645 },
    { city: "Tokyo", region: "Tokyo", country_code: "JP", latitude: 35.6762, longitude: 139.6503 },
    { city: "Singapore", region: "Singapore", country_code: "SG", latitude: 1.3521, longitude: 103.8198 },
    { city: "Dublin", region: "Leinster", country_code: "IE", latitude: 53.3498, longitude: -6.2603 },
    { city: "Frankfurt", region: "Hesse", country_code: "DE", latitude: 50.1109, longitude: 8.6821 },
    { city: "Paris", region: "Île-de-France", country_code: "FR", latitude: 48.8566, longitude: 2.3522 },
    { city: "Amsterdam", region: "North Holland", country_code: "NL", latitude: 52.3676, longitude: 4.9041 }
  ]);

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
    mapFullscreenOpen: false,
    fullscreenMap: null,
    fullscreenMapReady: false,
    fullscreenPopup: null,
    mapFeatureCollection: emptyGeoJson(),
    mapMetadata: {
      cityMarkers: 0,
      countryFallbackMarkers: 0,
      unmappedRows: [],
      eligibleRows: []
    },
    lastPayload: null,
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
    mapFullscreenToggle: null,
    mapFullscreenModal: null,
    mapFullscreenClose: null,
    fullscreenMap: null,
    fullscreenSidebar: null,
    fullscreenWindowSelect: null,
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

  function normalizeLocationLookupKey(value) {
    return safeToText(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function normalizeCountryCode(value) {
    const raw = collapseLocationWhitespace(value);
    if (!raw || isPlaceholderLocationValue(raw) || raw.toUpperCase() === "ZZ") return "";
    const alpha = raw.toUpperCase().replace(/[^A-Z]/g, "");
    if (/^[A-Z]{2}$/.test(alpha)) return COUNTRY_CODE_ALIASES[alpha] || alpha;
    const alias = COUNTRY_CODE_ALIASES[raw.toUpperCase()] || COUNTRY_CODE_ALIASES[normalizeLocationLookupKey(raw).toUpperCase()];
    if (alias) return alias;
    const displayNames = typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
      ? new Intl.DisplayNames(["en"], { type: "region" })
      : null;
    if (displayNames) {
      for (const code of Object.keys(FALLBACK_COUNTRY_CENTROIDS)) {
        try {
          const name = displayNames.of(code);
          if (normalizeLocationLookupKey(name) === normalizeLocationLookupKey(raw)) return code;
        } catch (_) {
          // Ignore unsupported display-name rows.
        }
      }
    }
    return "";
  }

  function firstPresentText(...values) {
    for (const value of values) {
      const text = collapseLocationWhitespace(value);
      if (text && !isPlaceholderLocationValue(text)) return text;
    }
    return "";
  }

  function parseFiniteNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "string" && !value.trim()) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function firstFiniteField(row, names) {
    for (const name of names) {
      const value = parseFiniteNumber(row?.[name]);
      if (value !== null) return value;
    }
    return null;
  }

  function hasPresentField(row, names) {
    return names.some((name) => {
      const value = row?.[name];
      return value !== null && value !== undefined && String(value).trim() !== "";
    });
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

  function coordinateFromLngLat(longitudeValue, latitudeValue, coordinateSource, plottedPrecision, originalPrecision) {
    const longitude = parseFiniteNumber(longitudeValue);
    const latitude = parseFiniteNumber(latitudeValue);
    if (longitude === null || latitude === null) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    return {
      longitude,
      latitude,
      centroid: [longitude, latitude],
      coordinateSource: coordinateSource || "event_coordinate",
      plottedPrecision: plottedPrecision || "city",
      originalPrecision: originalPrecision || "unknown"
    };
  }

  function originalLocationPrecision(row) {
    const explicit = normalizeLocationLookupKey(row?.precision);
    if (explicit) return explicit;
    if (firstPresentText(row?.city, row?.cityName)) return "city";
    if (firstPresentText(row?.region, row?.region_code, row?.regionCode)) return "region";
    return normalizeCountryCode(row?.country_code || row?.countryCode || row?.country || row?.code) ? "country" : "unknown";
  }

  function resolveEventCoordinate(row) {
    const originalPrecision = originalLocationPrecision(row);
    const explicitLatitude = firstFiniteField(row, ["latitude", "lat"]);
    const explicitLongitude = firstFiniteField(row, ["longitude", "lng", "lon"]);
    if (hasPresentField(row, ["latitude", "lat"]) || hasPresentField(row, ["longitude", "lng", "lon"])) {
      if (explicitLatitude !== null && explicitLongitude !== null) {
        return coordinateFromLngLat(explicitLongitude, explicitLatitude, "event_coordinate", "city", originalPrecision);
      }
    }

    const values = row?.coordinates || row?.coordinate || row?.lngLat || row?.latLng;
    if (!Array.isArray(values) || values.length < 2) return null;
    const first = parseFiniteNumber(values[0]);
    const second = parseFiniteNumber(values[1]);
    if (first === null || second === null) return null;
    const order = normalizeLocationLookupKey(row?.coordinateOrder || row?.coordinatesOrder || row?.coordinate_order || row?.order);
    if (["lnglat", "lonlat", "longlat", "longitude latitude"].includes(order)) {
      return coordinateFromLngLat(first, second, "event_coordinate", "city", originalPrecision);
    }
    if (["latlng", "latlon", "latitude longitude"].includes(order)) {
      return coordinateFromLngLat(second, first, "event_coordinate", "city", originalPrecision);
    }
    if (Math.abs(first) > 90 && Math.abs(second) <= 90) {
      return coordinateFromLngLat(first, second, "event_coordinate", "city", originalPrecision);
    }
    if (Math.abs(second) > 90 && Math.abs(first) <= 90) {
      return coordinateFromLngLat(second, first, "event_coordinate", "city", originalPrecision);
    }
    return null;
  }

  function resolveCityCoordinate(row) {
    const city = normalizeLocationLookupKey(row?.city || row?.cityName);
    if (!city) return null;
    const region = normalizeLocationLookupKey(row?.region || row?.region_code || row?.regionCode);
    const countryCode = normalizeCountryCode(row?.country_code || row?.countryCode || row?.country || row?.code);
    if (!countryCode) return null;
    const countryName = normalizeLocationLookupKey(resolveCountryName(countryCode));
    const match = CITY_COORDINATE_LOOKUP.find((candidate) => {
      const candidateCity = normalizeLocationLookupKey(candidate.city);
      const candidateRegion = normalizeLocationLookupKey(candidate.region);
      const candidateCode = normalizeCountryCode(candidate.country_code);
      if (candidateCity !== city || candidateCode !== countryCode) return false;
      if (region && candidateRegion === region) return true;
      if (!region) return true;
      return countryName && region === countryName;
    });
    if (!match) return null;
    return coordinateFromLngLat(match.longitude, match.latitude, "city_lookup", "city", originalLocationPrecision(row));
  }

  function resolveCountryCentroid(row, centroids) {
    const countryCode = normalizeCountryCode(row?.country_code || row?.countryCode || row?.country || row?.code);
    if (!countryCode) return null;
    const coords = centroids?.[countryCode] || FALLBACK_COUNTRY_CENTROIDS[countryCode];
    if (!Array.isArray(coords) || coords.length !== 2) return null;
    return coordinateFromLngLat(coords[0], coords[1], "country_centroid", "country_fallback", originalLocationPrecision(row));
  }

  function resolveLocationCoordinate(row, centroids) {
    return resolveEventCoordinate(row) || resolveCityCoordinate(row) || resolveCountryCentroid(row, centroids);
  }

  function classifyMapPrecision(row, coordinate) {
    if (!coordinate) return "unmapped";
    if (coordinate.plottedPrecision === "country_fallback") return "country_fallback";
    if (coordinate.coordinateSource === "event_coordinate") return "event_coordinate";
    return "city";
  }

  function locationUnmappedReason(row, centroids) {
    const countryCode = normalizeCountryCode(row?.country_code || row?.countryCode || row?.country || row?.code);
    if (!countryCode) return "missing_country_code";
    if (!centroids?.[countryCode] && !FALLBACK_COUNTRY_CENTROIDS[countryCode]) return "missing_country_centroid";
    return "invalid_or_unverified_coordinate";
  }

  function markerPrecisionLabel(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "country_fallback") return "country fallback";
    if (normalized === "event_coordinate") return "event coordinate";
    if (normalized === "unmapped") return "unmapped";
    return "city";
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

    const markerPrecision = String(entry?.plottedPrecision || entry?.mapPrecision || "").trim();
    const markerLine = document.createElement("span");
    const markerLabel = document.createElement("span");
    markerLabel.className = "ss-map-popup-label";
    markerLabel.textContent = "Marker:";
    const markerValue = document.createElement("span");
    markerValue.className = "ss-map-popup-value";
    markerValue.textContent = markerPrecision === "country_fallback"
      ? "Country fallback location"
      : markerPrecision === "event_coordinate"
        ? "Exact event coordinate"
        : "City lookup";
    markerLine.append(markerLabel, document.createTextNode(" "), markerValue);
    root.appendChild(markerLine);

    const locationDetail = String(entry?.locationDetailLabel || entry?.locationLabel || "").trim();
    if (locationDetail) {
      const locationLine = document.createElement("span");
      const locationLabel = document.createElement("span");
      locationLabel.className = "ss-map-popup-label";
      locationLabel.textContent = "Location:";
      const locationValue = document.createElement("span");
      locationValue.className = "ss-map-popup-value";
      locationValue.textContent = locationDetail;
      locationLine.append(locationLabel, document.createTextNode(" "), locationValue);
      root.appendChild(locationLine);
    }

    if (entry?.contributingLocations) {
      const contributingLine = document.createElement("span");
      const contributingLabel = document.createElement("span");
      contributingLabel.className = "ss-map-popup-label";
      contributingLabel.textContent = "Rows:";
      const contributingValue = document.createElement("span");
      contributingValue.className = "ss-map-popup-value";
      contributingValue.textContent = String(entry.contributingLocations);
      contributingLine.append(contributingLabel, document.createTextNode(" "), contributingValue);
      root.appendChild(contributingLine);
    }

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
    if (state.fullscreenMapReady) {
      ensureFullscreenMapLayers();
    }
    renderMapFullscreenSidebar();
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

  function setMapFullscreenOpen(open) {
    const shouldOpen = open === true;
    state.mapFullscreenOpen = shouldOpen;
    el.mapFullscreenModal?.classList.toggle("hidden", !shouldOpen);
    el.mapFullscreenModal?.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
    if (el.fullscreenWindowSelect) {
      el.fullscreenWindowSelect.value = state.selectedWindow || DEFAULT_WINDOW;
    }
    if (shouldOpen) {
      initFullscreenMap();
      renderMapFullscreenSidebar();
      updateMapDebugState();
      setTimeout(() => {
        state.fullscreenMap?.resize();
        fitFullscreenMap();
        updateMapDebugState();
      }, 80);
      return;
    }
    destroyFullscreenMap();
    updateMapDebugState();
  }

  function handleMapFullscreenToggleClick() {
    setMapFullscreenOpen(true);
  }

  function handleMapFullscreenCloseClick() {
    setMapFullscreenOpen(false);
  }

  function handleMapFullscreenBackdropClick(event) {
    if (event.target === el.mapFullscreenModal) {
      setMapFullscreenOpen(false);
    }
  }

  function handleMapFullscreenWindowChange(event) {
    const value = String(event?.target?.value || "").trim();
    state.selectedWindow = value || DEFAULT_WINDOW;
    if (el.windowSelect) {
      el.windowSelect.value = state.selectedWindow;
    }
    fetchAnalytics({ withLoader: true, forceRefresh: true });
  }

  function handleDocumentKeydown(event) {
    if (event.key === "Escape" && state.mapFullscreenOpen) {
      setMapFullscreenOpen(false);
    }
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
    updateMapDebugState();
    if (!state.map) return;
    const source = state.map.getSource(SOURCE_ID);
    if (!source) return;
    source.setData(geojson);
  }

  function updateMapDebugState() {
    window.StreamSuitesAnalyticsMapDebug = {
      map: state.map,
      fullscreenMap: state.fullscreenMap,
      sourceId: SOURCE_ID,
      featureCollection: state.pendingGeoJson || emptyGeoJson(),
      metadata: state.mapMetadata,
      markerCount: Array.isArray(state.pendingGeoJson?.features) ? state.pendingGeoJson.features.length : 0,
      fullscreenOpen: state.mapFullscreenOpen,
      fullscreenMapReady: state.fullscreenMapReady,
      selectedWindow: state.selectedWindow
    };
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
              city: props.city,
              region: props.region,
              locationLabel: props.locationLabel,
              locationDetailLabel: props.locationDetailLabel,
              plottedPrecision: props.plottedPrecision,
              coordinateSource: props.coordinateSource,
              contributingLocations: props.contributingLocations,
              sessions,
              requests,
              project: props.project,
              source_namespace: props.source_namespace,
              source: props.source,
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

  function ensureFullscreenMapLayers() {
    const map = state.fullscreenMap;
    if (!map || !state.fullscreenMapReady) return;
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: state.mapFeatureCollection || emptyGeoJson()
      });
    }
    if (!map.getLayer(LAYERS.requestsBackdrop)) {
      map.addLayer({
        id: LAYERS.requestsBackdrop,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-color": ["case", ["==", ["get", "project"], "danielclancy"], "#f59e0b", "#1d4d93"],
          "circle-opacity": ["interpolate", ["linear"], ["coalesce", ["get", "requests"], 0], 0, 0.1, 10, 0.16, 50, 0.22, 150, 0.28, 400, 0.34],
          "circle-blur": 0.68,
          "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "requests"], 0], 0, 10.5, 10, 15, 50, 21, 150, 27, 400, 33]
        }
      });
    }
    if (!map.getLayer(LAYERS.activityGlow)) {
      map.addLayer({
        id: LAYERS.activityGlow,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-color": ["case", ["==", ["get", "project"], "danielclancy"], "#7c3aed", "#9f4dff"],
          "circle-opacity": ["interpolate", ["linear"], ["coalesce", ["get", "sessions"], 0], 0, 0.16, 10, 0.24, 50, 0.34, 150, 0.46, 400, 0.58],
          "circle-blur": 0.78,
          "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "sessions"], 0], 0, 9, 10, 13, 50, 18, 150, 23, 400, 28]
        }
      });
    }
    if (!map.getLayer(LAYERS.activityCore)) {
      map.addLayer({
        id: LAYERS.activityCore,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-color": ["case", ["==", ["get", "project"], "danielclancy"], "#ffd166", "#d6b8ff"],
          "circle-opacity": ["interpolate", ["linear"], ["coalesce", ["get", "sessions"], 0], 0, 0.82, 10, 0.88, 50, 0.93, 150, 0.97, 400, 0.99],
          "circle-blur": 0.08,
          "circle-stroke-color": ["case", ["==", ["get", "project"], "danielclancy"], "rgba(255, 182, 72, 0.92)", "rgba(242,228,255,0.86)"],
          "circle-stroke-width": 0.75,
          "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "sessions"], 0], 0, 3.2, 10, 4.8, 50, 7.2, 150, 9.4, 400, 11.2]
        }
      });
    }
    if (!map.getLayer(LAYERS.activityHit)) {
      map.addLayer({
        id: LAYERS.activityHit,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["max", ["coalesce", ["get", "sessions"], 0], ["coalesce", ["get", "requests"], 0]], 1, 14, 10, 15, 50, 17.5, 150, 20],
          "circle-opacity": 0,
          "circle-stroke-opacity": 0
        }
      });
    }
    if (!map.__ssAnalyticsFullscreenHoverBound) {
      map.on("click", LAYERS.activityHit, (event) => {
        const feature = event?.features?.[0];
        if (!feature) return;
        const props = feature.properties || {};
        state.fullscreenPopup?.remove();
        state.fullscreenPopup = new window.maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          offset: 12,
          className: "ss-map-popup"
        })
          .setLngLat(event.lngLat)
          .setDOMContent(buildCountryPopupContent(props))
          .addTo(map);
      });
      map.on("mouseenter", LAYERS.activityHit, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", LAYERS.activityHit, () => {
        map.getCanvas().style.cursor = "";
      });
      map.__ssAnalyticsFullscreenHoverBound = true;
    }
    applyFullscreenGeoJson(state.mapFeatureCollection || emptyGeoJson());
    setMapLayerVisibilityForMap(map, LAYERS.requestsBackdrop, state.mapMarkerFilter === "requests" || state.mapMarkerFilter === "both");
    setMapLayerVisibilityForMap(map, LAYERS.activityGlow, state.mapMarkerFilter === "sessions" || state.mapMarkerFilter === "both");
    setMapLayerVisibilityForMap(map, LAYERS.activityCore, state.mapMarkerFilter === "sessions" || state.mapMarkerFilter === "both");
    setMapLayerVisibilityForMap(map, LAYERS.activityHit, true);
  }

  function setMapLayerVisibilityForMap(map, layerId, visible) {
    if (!map || !layerId || !map.getLayer(layerId)) return;
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  }

  function fitFullscreenMap() {
    if (!state.fullscreenMap || !state.fullscreenMapReady) return;
    const coordinates = collectMapCoordinatesFromGeoJson();
    if (!coordinates.length) return;
    if (coordinates.length === 1) {
      state.fullscreenMap.easeTo({
        center: coordinates[0],
        zoom: 3.8,
        duration: 240,
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
    state.fullscreenMap.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat]
      ],
      {
        padding: 72,
        maxZoom: 5.2,
        duration: 240,
        essential: true
      }
    );
  }

  function initFullscreenMap() {
    if (!state.mapFullscreenOpen || !el.fullscreenMap) return;
    if (state.fullscreenMap) {
      state.fullscreenMap.resize();
      fitFullscreenMap();
      return;
    }
    if (!window.maplibregl || typeof window.maplibregl.Map !== "function") {
      return;
    }
    state.fullscreenMapReady = false;
    state.fullscreenMap = new window.maplibregl.Map({
      container: el.fullscreenMap,
      style: resolveMapStyleUrl(),
      center: [10, 20],
      zoom: 1.2,
      minZoom: 1,
      maxZoom: 6,
      projection: "mercator",
      attributionControl: false,
      pitch: 0,
      bearing: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false
    });
    state.fullscreenMap.dragRotate?.disable();
    state.fullscreenMap.touchZoomRotate?.disableRotation();
    state.fullscreenMap.keyboard?.disableRotation();
    state.fullscreenMap.addControl(
      new window.maplibregl.NavigationControl({
        showCompass: false,
        visualizePitch: false
      }),
      "top-right"
    );
    state.fullscreenMap.once("load", () => {
      state.fullscreenMapReady = true;
      ensureFullscreenMapLayers();
      state.fullscreenMap?.resize();
      fitFullscreenMap();
    });
  }

  function destroyFullscreenMap() {
    state.fullscreenPopup?.remove();
    state.fullscreenPopup = null;
    if (state.fullscreenMap) {
      state.fullscreenMap.remove();
      state.fullscreenMap = null;
    }
    state.fullscreenMapReady = false;
  }

  function applyFullscreenGeoJson(geojson) {
    if (!state.fullscreenMap || !state.fullscreenMapReady) return;
    const source = state.fullscreenMap.getSource(SOURCE_ID);
    if (source?.setData) {
      source.setData(geojson || emptyGeoJson());
    }
    fitFullscreenMap();
  }

  function sourceBreakdownRows() {
    const rows = state.locationRows.length ? state.locationRows : state.countryRows;
    const counts = new Map();
    rows.forEach((entry) => {
      const source = String(entry?.source || entry?.source_namespace || entry?.project || "unknown").trim() || "unknown";
      counts.set(source, (counts.get(source) || 0) + Number(entry?.requests || 0));
    });
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  }

  function projectBreakdownRows() {
    const rows = state.locationRows.length ? state.locationRows : state.countryRows;
    const counts = new Map();
    rows.forEach((entry) => {
      const project = formatProjectLabel(entry?.project || entry?.source_namespace);
      counts.set(project, (counts.get(project) || 0) + Number(entry?.requests || 0));
    });
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  }

  function latestLiveEventLabel() {
    const payload = state.lastPayload || {};
    const candidates = [
      payload.last_live_event_at,
      payload.lastLiveEventAt,
      payload.lastLivePageVisitEventTime,
      payload.generated_at,
      payload.generatedAt,
      ...(Array.isArray(payload.recent_requests) ? payload.recent_requests.map((entry) => entry?.timestamp || entry?.recorded_at || entry?.recordedAt) : [])
    ];
    return formatTimestamp(candidates.find(Boolean));
  }

  function renderMapFullscreenSidebar() {
    if (!el.fullscreenSidebar) return;
    const rows = state.locationRows.length ? state.locationRows : state.countryRows;
    const mappedRows = rows.filter((entry) => Array.isArray(entry?.centroid) && entry.centroid.length === 2);
    const unmappedRows = state.mapMetadata.unmappedRows || [];
    const totals = state.locationRows.length ? state.locationTotals : state.countryTotals;
    const mappedList = mappedRows
      .map((entry) => `
        <li>
          <strong>${escapeHtml(entry.locationDetailLabel || entry.locationLabel || entry.name || entry.code)}</strong>
          <span>${escapeHtml(markerPrecisionLabel(entry.mapPrecision || entry.plottedPrecision))}</span>
          <small>${escapeHtml(formatNumber(entry.requests))} requests · ${escapeHtml(formatNumber(entry.sessions))} sessions · ${escapeHtml(formatProjectLabel(entry.project))}</small>
        </li>
      `)
      .join("");
    const unmappedList = unmappedRows
      .slice(0, 25)
      .map(({ row, reason }) => `
        <li>
          <strong>${escapeHtml(row?.locationDetailLabel || row?.locationLabel || "Unknown location")}</strong>
          <small>${escapeHtml(reason || row?.unmappedReason || "unmapped")}</small>
        </li>
      `)
      .join("");
    el.fullscreenSidebar.innerHTML = `
      <section data-analytics-map-sidebar-section="summary">
        <h3>Map summary</h3>
        <dl class="ss-analytics-map-sidebar-stats">
          <div><dt>Selected window</dt><dd>${escapeHtml(state.selectedWindow || DEFAULT_WINDOW)}</dd></div>
          <div><dt>Source/project filter</dt><dd>${escapeHtml(state.mapMarkerFilter)} markers · current payload</dd></div>
          <div><dt>Total rows</dt><dd>${escapeHtml(formatNumber(rows.length))}</dd></div>
          <div><dt>Requests/events</dt><dd>${escapeHtml(formatNumber(totals.requests))}</dd></div>
          <div><dt>Sessions</dt><dd>${escapeHtml(formatNumber(totals.sessions))}</dd></div>
          <div><dt>City markers</dt><dd>${escapeHtml(formatNumber(state.mapMetadata.cityMarkers))}</dd></div>
          <div><dt>Country fallback markers</dt><dd>${escapeHtml(formatNumber(state.mapMetadata.countryFallbackMarkers))}</dd></div>
          <div><dt>Unmapped rows</dt><dd>${escapeHtml(formatNumber(unmappedRows.length))}</dd></div>
          <div><dt>Last live event</dt><dd>${escapeHtml(latestLiveEventLabel())}</dd></div>
        </dl>
      </section>
      <section data-analytics-map-sidebar-section="mapped">
        <h3>Mapped locations</h3>
        <ul class="ss-analytics-map-sidebar-list">${mappedList || "<li><strong>No mapped locations</strong><small>No usable coordinates in this window.</small></li>"}</ul>
      </section>
      <section data-analytics-map-sidebar-section="unmapped">
        <h3>Unmapped rows</h3>
        <ul class="ss-analytics-map-sidebar-list">${unmappedList || "<li><strong>None</strong><small>Every eligible row has a city coordinate or country fallback.</small></li>"}</ul>
      </section>
      <section data-analytics-map-sidebar-section="source">
        <h3>Source breakdown</h3>
        <ul class="ss-analytics-map-sidebar-list">${sourceBreakdownRows().map(([source, count]) => `<li><strong>${escapeHtml(source)}</strong><small>${escapeHtml(formatNumber(count))} requests/events</small></li>`).join("") || "<li><strong>No source rows</strong><small>No rows in this window.</small></li>"}</ul>
      </section>
      <section data-analytics-map-sidebar-section="project">
        <h3>Project breakdown</h3>
        <ul class="ss-analytics-map-sidebar-list">${projectBreakdownRows().map(([project, count]) => `<li><strong>${escapeHtml(project)}</strong><small>${escapeHtml(formatNumber(count))} requests/events</small></li>`).join("") || "<li><strong>No project rows</strong><small>No rows in this window.</small></li>"}</ul>
      </section>
      <section data-analytics-map-sidebar-section="precision">
        <h3>Precision legend</h3>
        <ul class="ss-analytics-map-sidebar-list">
          <li><strong>Exact event coordinate</strong><small>Trusted latitude/longitude on the event row.</small></li>
          <li><strong>City lookup</strong><small>Exact city/region/country coordinate lookup.</small></li>
          <li><strong>Country fallback</strong><small>Verified country centroid, labelled as fallback.</small></li>
          <li><strong>Unmapped</strong><small>No usable coordinates or country fallback.</small></li>
        </ul>
      </section>
      <section data-analytics-map-sidebar-section="marker">
        <h3>Marker legend</h3>
        <ul class="ss-analytics-map-sidebar-list">
          <li><strong>StreamSuites</strong><small>Purple session marker and blue request halo.</small></li>
          <li><strong>DanielClancy.net</strong><small>Gold session marker and amber request halo.</small></li>
        </ul>
      </section>
    `;
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
      const code = normalizeCountryCode(entry?.country_code || entry?.country || entry?.code);
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
        coordinateSource: "country_centroid",
        plottedPrecision: "country_fallback",
        originalPrecision: "country",
        precision: "country fallback",
        mapPrecision: "country_fallback",
        locationLabel: resolveCountryName(code),
        locationDetailLabel: resolveCountryName(code),
        locationMeta: "Country fallback",
        project,
        source_namespace: entry?.source_namespace || project,
        source: entry?.source || entry?.source_namespace || project,
        surface: entry?.surface || (project === "danielclancy" ? "danielclancy_public" : "public"),
        projectLabel: entry?.project_label || formatProjectLabel(project)
      });
    });
    return Array.from(aggregate.values());
  }

  function buildLocationRows(locationRows, centroids = state.countryCentroids || FALLBACK_COUNTRY_CENTROIDS) {
    const aggregate = new Map();
    const unmapped = [];
    normalizeLocationRows(locationRows).forEach((entry) => {
      const code = normalizeCountryCode(entry?.country_code || entry?.countryCode || entry?.country || entry?.code);
      const location = buildLocationPresentation({
        ...entry,
        countryCode: code
      });
      const coordinate = resolveLocationCoordinate({ ...entry, country_code: code }, centroids);
      const mapPrecision = classifyMapPrecision(entry, coordinate);
      const precision = markerPrecisionLabel(mapPrecision);
      const requestsRaw = Number(entry?.requests ?? entry?.count ?? 0);
      const sessionsRaw = Number(entry?.sessions ?? entry?.count ?? requestsRaw);
      const requests = Number.isFinite(requestsRaw) ? Math.max(0, Math.round(requestsRaw)) : 0;
      const sessions = Number.isFinite(sessionsRaw) ? Math.max(0, Math.round(sessionsRaw)) : requests;
      if (requests <= 0 && sessions <= 0) return;
      if (!coordinate) {
        unmapped.push({
          ...entry,
          key: `unmapped|${aggregate.size}|${location.sortKey}`,
          code,
          countryCode: code,
          countryName: location.countryName || resolveCountryName(code),
          region: location.region,
          regionCode: location.regionCode,
          city: location.city,
          precision: "unmapped",
          originalPrecision: originalLocationPrecision(entry),
          mapPrecision: "unmapped",
          plottedPrecision: "unmapped",
          coordinateSource: "",
          unmappedReason: locationUnmappedReason(entry, centroids),
          locationLabel: location.primaryLabel,
          locationDetailLabel: location.detailedLabel,
          locationMeta: location.secondaryLabel || "Unmapped",
          locationSortKey: location.sortKey,
          locationFilterText: location.filterText,
          requests,
          sessions,
          project: normalizeProject(entry?.project || entry?.source_namespace),
          source_namespace: entry?.source_namespace || normalizeProject(entry?.project || entry?.source_namespace),
          source: entry?.source || entry?.source_namespace || normalizeProject(entry?.project),
          surface: entry?.surface || (normalizeProject(entry?.project || entry?.source_namespace) === "danielclancy" ? "danielclancy_public" : "public")
        });
        return;
      }
      const key = [
        normalizeProject(entry?.project || entry?.source_namespace),
        entry?.source || entry?.source_namespace || "",
        mapPrecision,
        location.countryCode || code,
        location.region,
        location.regionCode,
        mapPrecision === "country_fallback" ? "" : location.city,
        Number(coordinate.longitude).toFixed(4),
        Number(coordinate.latitude).toFixed(4)
      ].join("|");
      const existing = aggregate.get(key);
      if (existing) {
        existing.requests += requests;
        existing.sessions += sessions;
        if (location.detailedLabel && !existing.contributingLocations.includes(location.detailedLabel)) {
          existing.contributingLocations.push(location.detailedLabel);
        }
        return;
      }
      const project = normalizeProject(entry?.project || entry?.source_namespace);
      aggregate.set(key, {
        key,
        code,
        countryCode: location.countryCode || code,
        countryName: location.countryName || resolveCountryName(code),
        region: location.region,
        regionCode: location.regionCode,
        city: location.city,
        precision,
        originalPrecision: originalLocationPrecision(entry),
        mapPrecision,
        plottedPrecision: coordinate.plottedPrecision,
        coordinateSource: coordinate.coordinateSource,
        centroid: coordinate.centroid,
        longitude: coordinate.longitude,
        latitude: coordinate.latitude,
        unmappedReason: "",
        contributingLocations: [location.detailedLabel].filter(Boolean),
        locationLabel: location.primaryLabel,
        locationDetailLabel: location.detailedLabel,
        locationMeta: mapPrecision === "country_fallback" ? "Country fallback marker" : location.secondaryLabel,
        locationSortKey: location.sortKey,
        locationFilterText: location.filterText,
        requests,
        sessions,
        project,
        source_namespace: entry?.source_namespace || project,
        source: entry?.source || entry?.source_namespace || project,
        surface: entry?.surface || (project === "danielclancy" ? "danielclancy_public" : "public"),
        projectLabel: entry?.project_label || formatProjectLabel(project)
      });
    });
    return Array.from(aggregate.values()).concat(unmapped);
  }

  function toMapFeature(entry) {
    const code = normalizeCountryCode(entry?.countryCode || entry?.country_code || entry?.code || entry?.country);
    const centroid = entry?.centroid;
    if (!code || !Array.isArray(centroid) || centroid.length !== 2) return null;
    const requests = Number(entry?.requests ?? 0);
    const sessions = Number(entry?.sessions ?? 0);
    const plottedPrecision = entry?.plottedPrecision || entry?.mapPrecision || "country_fallback";
    return {
      type: "Feature",
      properties: {
        country: code,
        name: entry?.countryName || entry?.name || resolveCountryName(code),
        city: entry?.city || "",
        region: entry?.region || entry?.regionCode || "",
        locationLabel: entry?.locationLabel || entry?.name || resolveCountryName(code),
        locationDetailLabel: entry?.locationDetailLabel || entry?.locationLabel || entry?.name || resolveCountryName(code),
        locationMeta: entry?.locationMeta || "",
        precision: entry?.precision || markerPrecisionLabel(plottedPrecision),
        originalPrecision: entry?.originalPrecision || "unknown",
        plottedPrecision,
        coordinateSource: entry?.coordinateSource || (plottedPrecision === "country_fallback" ? "country_centroid" : "city_lookup"),
        contributingLocations: Array.isArray(entry?.contributingLocations) ? entry.contributingLocations.join("; ") : "",
        requests: Number.isFinite(requests) ? requests : 0,
        sessions: Number.isFinite(sessions) ? sessions : 0,
        project: normalizeProject(entry?.project),
        source_namespace: entry?.source_namespace || normalizeProject(entry?.project),
        source: entry?.source || entry?.source_namespace || normalizeProject(entry?.project),
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

  function aggregateLocationRows(locationRows, centroids) {
    const rows = buildLocationRows(locationRows, centroids);
    const mappedRows = rows.filter((entry) => Array.isArray(entry?.centroid) && entry.centroid.length === 2);
    const unmappedRows = rows
      .filter((entry) => entry?.mapPrecision === "unmapped")
      .map((entry) => ({
        row: entry,
        reason: entry.unmappedReason || "unmapped"
      }));
    return {
      rows,
      mappedRows,
      unmappedRows,
      eligibleRows: normalizeLocationRows(locationRows),
      cityMarkers: mappedRows.filter((entry) => entry.mapPrecision === "city" || entry.mapPrecision === "event_coordinate").length,
      countryFallbackMarkers: mappedRows.filter((entry) => entry.mapPrecision === "country_fallback").length
    };
  }

  function buildLocationFeatures(locationRows, options = {}) {
    const centroids = options.centroids || state.countryCentroids || FALLBACK_COUNTRY_CENTROIDS;
    const aggregate = aggregateLocationRows(locationRows, centroids);
    const features = aggregate.mappedRows.map((entry) => toMapFeature(entry)).filter(Boolean);
    return {
      type: "FeatureCollection",
      features,
      metadata: {
        eligibleRows: aggregate.eligibleRows,
        unmappedRows: aggregate.unmappedRows,
        cityMarkers: aggregate.cityMarkers,
        countryFallbackMarkers: aggregate.countryFallbackMarkers,
        groupedRows: aggregate.mappedRows.length
      }
    };
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
    if (entry?.locationLabel) return String(entry.locationLabel);
    return buildLocationPresentation(entry).primaryLabel || "Unknown";
  }

  function resolveLocationMeta(entry) {
    if (entry?.locationMeta) return String(entry.locationMeta);
    return buildLocationPresentation(entry).secondaryLabel;
  }

  function updateMapStatsStrip() {
    if (el.mapCountryCount) {
      el.mapCountryCount.textContent = formatNumber(state.mapMetadata.cityMarkers + state.mapMetadata.countryFallbackMarkers);
    }
    if (el.mapSessions) {
      const totals = state.locationRows.length ? state.locationTotals : state.countryTotals;
      el.mapSessions.textContent = formatNumber(totals.sessions);
    }
    if (el.mapTopCountry) {
      const mapped = state.locationRows.filter((entry) => Array.isArray(entry?.centroid));
      const top = resolveTopCountry(mapped.length ? mapped : state.countryRows);
      el.mapTopCountry.textContent = "";
      if (!top) {
        el.mapTopCountry.textContent = "--";
      } else {
        const code = normalizeCountryCode(top?.countryCode || top?.code || top?.country);
        const name = String(top?.locationLabel || top?.name || resolveCountryName(code) || code).trim() || code;
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
        "event coordinate": 4,
        "event_coordinate": 4,
        city: 3,
        region: 2,
        "country fallback": 1,
        country_fallback: 1,
        country: 1,
        unmapped: 0
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
      const code = normalizeCountryCode(entry?.countryCode || entry?.country_code || entry?.code || entry?.country);
      const countryName = String(entry?.countryName || entry?.name || resolveCountryName(code) || code).trim() || code;
      const locationName = resolveLocationLabel(entry);
      const locationMeta = resolveLocationMeta(entry);
      const locationKey = String(entry?.key || code || "").trim();
      const isActive = locationKey && locationKey === state.activeCountryCode;

      const row = document.createElement("tr");
      row.className = `ss-analytics-country-row${isActive ? " is-active" : ""}`;
      row.setAttribute("data-country-code", code);
      row.setAttribute("data-location-key", locationKey);
      row.setAttribute("tabindex", "0");
      row.setAttribute("role", "button");
      row.setAttribute("aria-label", `Focus map on ${locationName || countryName}`);
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
    const token = String(code || "").trim();
    if (!token) return;
    const mappedLocations = state.locationRows.filter((entry) => Array.isArray(entry?.centroid) && entry.centroid.length === 2);
    const country = mappedLocations.find((entry) => String(entry?.key || "") === token)
      || mappedLocations.find((entry) => normalizeCountryCode(entry?.countryCode || entry?.code) === normalizeCountryCode(token))
      || state.countryRows.find((entry) => normalizeCountryCode(entry?.code || entry?.country) === normalizeCountryCode(token));
    if (!country || !Array.isArray(country.centroid) || country.centroid.length !== 2) return;

    state.activeCountryCode = String(country?.key || country?.code || token);
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
    const code = row.getAttribute("data-location-key") || row.getAttribute("data-country-code");
    void focusCountryFromTable(code);
  }

  function handleCountryRowKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest("tr.ss-analytics-country-row[data-country-code]");
    if (!(row instanceof HTMLTableRowElement) || !el.countriesBody?.contains(row)) return;
    event.preventDefault();
    const code = row.getAttribute("data-location-key") || row.getAttribute("data-country-code");
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

  async function updateMap(locationRows, options = {}) {
    const rows = normalizeLocationRows(locationRows);
    const countryRows = normalizeCountryRows(options.countryRows);
    state.latestByCountry = [...countryRows];
    const centroids = await loadCountryCentroids();
    state.countryRows = buildCountryRows(countryRows, centroids);
    state.countryTotals = computeCountryTotals(state.countryRows);
    const locationFeatureCollection = rows.length
      ? buildLocationFeatures(rows, { centroids })
      : {
          type: "FeatureCollection",
          features: state.countryRows.map((entry) => toMapFeature(entry)).filter(Boolean),
          metadata: {
            eligibleRows: countryRows,
            unmappedRows: [],
            cityMarkers: 0,
            countryFallbackMarkers: state.countryRows.length,
            groupedRows: state.countryRows.length
          }
        };
    if (rows.length) {
      state.locationRows = buildLocationRows(rows, centroids);
      state.locationTotals = computeCountryTotals(state.locationRows);
    }
    state.mapFeatureCollection = locationFeatureCollection;
    state.mapMetadata = {
      eligibleRows: locationFeatureCollection.metadata?.eligibleRows || [],
      unmappedRows: locationFeatureCollection.metadata?.unmappedRows || [],
      cityMarkers: Number(locationFeatureCollection.metadata?.cityMarkers || 0),
      countryFallbackMarkers: Number(locationFeatureCollection.metadata?.countryFallbackMarkers || 0)
    };
    updateMapStatsStrip();
    if (state.activeCountryCode) {
      const exists = state.locationRows.some((entry) => String(entry?.key || "") === state.activeCountryCode)
        || state.countryRows.some((entry) => entry.code === state.activeCountryCode);
      if (!exists) {
        state.activeCountryCode = "";
      }
    }
    renderCountryTable();
    applyGeoJson(locationFeatureCollection);
    applyFullscreenGeoJson(locationFeatureCollection);
    renderMapFullscreenSidebar();

    if (options.errorMessage) {
      setMapFeedback(options.errorMessage, { isError: true });
      return;
    }
    if (!rows.length && !countryRows.length) {
      setMapFeedback("No country analytics yet for this window.");
      return;
    }
    if (!locationFeatureCollection.features.length) {
      setMapFeedback("Location data exists, but no supported city coordinates or country centroids were available to map.");
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
        state.lastPayload = data;
        await updateMap(data?.by_location, {
          countryRows: data?.by_country_markers || data?.by_country
        });
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
    if (el.fullscreenWindowSelect) {
      el.fullscreenWindowSelect.value = state.selectedWindow;
    }
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
    state.mapFullscreenOpen = false;
    state.mapFeatureCollection = emptyGeoJson();
    state.mapMetadata = {
      cityMarkers: 0,
      countryFallbackMarkers: 0,
      unmappedRows: [],
      eligibleRows: []
    };
    state.lastPayload = null;
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
    el.mapFullscreenToggle = $("analytics-map-fullscreen-toggle");
    el.mapFullscreenModal = $("analytics-map-fullscreen-modal");
    el.mapFullscreenClose = $("analytics-map-fullscreen-close");
    el.fullscreenMap = $("analytics-fullscreen-world-map");
    el.fullscreenSidebar = $("analytics-map-fullscreen-sidebar");
    el.fullscreenWindowSelect = $("analytics-map-fullscreen-window-select");
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
    if (el.mapFullscreenToggle) {
      el.mapFullscreenToggle.addEventListener("click", handleMapFullscreenToggleClick);
    }
    if (el.mapFullscreenClose) {
      el.mapFullscreenClose.addEventListener("click", handleMapFullscreenCloseClick);
    }
    if (el.mapFullscreenModal) {
      el.mapFullscreenModal.addEventListener("click", handleMapFullscreenBackdropClick);
    }
    if (el.fullscreenWindowSelect) {
      el.fullscreenWindowSelect.value = state.selectedWindow || DEFAULT_WINDOW;
      el.fullscreenWindowSelect.addEventListener("change", handleMapFullscreenWindowChange);
    }
    document.addEventListener("keydown", handleDocumentKeydown);
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
    if (el.mapFullscreenToggle) {
      el.mapFullscreenToggle.removeEventListener("click", handleMapFullscreenToggleClick);
    }
    if (el.mapFullscreenClose) {
      el.mapFullscreenClose.removeEventListener("click", handleMapFullscreenCloseClick);
    }
    if (el.mapFullscreenModal) {
      el.mapFullscreenModal.removeEventListener("click", handleMapFullscreenBackdropClick);
    }
    if (el.fullscreenWindowSelect) {
      el.fullscreenWindowSelect.removeEventListener("change", handleMapFullscreenWindowChange);
    }
    document.removeEventListener("keydown", handleDocumentKeydown);
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
    destroyFullscreenMap();

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
    state.mapFullscreenOpen = false;
    state.mapMarkerFilter = MAP_MARKER_FILTER_DEFAULT;
    state.pendingGeoJson = emptyGeoJson();
    state.mapFeatureCollection = emptyGeoJson();
    state.mapMetadata = {
      cityMarkers: 0,
      countryFallbackMarkers: 0,
      unmappedRows: [],
      eligibleRows: []
    };
    state.lastPayload = null;
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

  window.StreamSuitesAnalyticsMapLocationDebug = {
    normalizeCountryCode,
    normalizeLocationName,
    resolveCityCoordinate,
    resolveCountryCentroid,
    resolveLocationCoordinate,
    aggregateLocationRows,
    buildLocationFeatures,
    classifyMapPrecision,
    markerPrecisionLabel
  };

  window.AnalyticsView = {
    init,
    destroy
  };
})();

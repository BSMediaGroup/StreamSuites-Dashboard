(() => {
  "use strict";

  const DEFAULT_DESTINATIONS = ["windows_client", "pushover"];
  const RULES_PAGE_SIZE = 6;
  const HISTORY_LIMIT = 50;
  const HISTORY_PAGE_SIZE = 5;
  const SEVERITIES = ["info", "warning", "error", "critical"];
  const DESTINATION_ICON_MAP = {
    windows_client: "/assets/icons/ui/win2.svg",
    pushover: "/assets/icons/ui/mobilemsg.svg"
  };
  const SCOPE_FIELD_ORDER = [
    "page_path",
    "page_key",
    "route",
    "auth_provider",
    "user_type",
    "admin_only",
    "surface",
    "destination_type"
  ];
  const SCOPE_FIELD_CONFIG = {
    page_path: { label: "Page path", kind: "text", placeholder: "/about.html" },
    page_key: { label: "Page key", kind: "text", placeholder: "about" },
    route: { label: "Route", kind: "text", placeholder: "/auth/login" },
    auth_provider: { label: "Auth provider", kind: "select" },
    user_type: { label: "User type", kind: "select" },
    admin_only: { label: "Admin only", kind: "checkbox" },
    surface: { label: "Surface", kind: "select" },
    destination_type: { label: "Destination type", kind: "select" }
  };
  const TEMPLATE_CATEGORY_ORDER = [
    "General / Event",
    "Account / User",
    "Request / Page",
    "Session / Client",
    "Geo",
    "Destination / Delivery",
    "Timing",
    "Other"
  ];
  const TEMPLATE_CATEGORY_HELP = Object.freeze({
    "General / Event": "Core alert identity and rule context.",
    "Account / User": "Account, role, and auth-related details.",
    "Request / Page": "Page, route, origin, and referrer context.",
    "Session / Client": "Browser, device, and client environment.",
    Geo: "Country, region, and city details from the request.",
    "Destination / Delivery": "Where the alert is routed.",
    Timing: "Timestamps, counts, and rule timing values.",
    Other: "Additional runtime-provided context."
  });
  const TEMPLATE_VARIABLE_PRIORITY = Object.freeze([
    "event_label",
    "severity",
    "rule_name",
    "surface",
    "page_path",
    "page_title",
    "page_url",
    "route",
    "auth_provider",
    "user_type",
    "display_name",
    "user_code",
    "browser",
    "device",
    "platform",
    "geo.country",
    "geo.region",
    "geo.city",
    "destination_type",
    "triggered_at",
    "count",
    "window_minutes"
  ]);
  const TEMPLATE_VARIABLE_PRIORITY_MAP = TEMPLATE_VARIABLE_PRIORITY.reduce((acc, key, index) => {
    acc[key] = index;
    return acc;
  }, Object.create(null));
  const SURFACE_LABELS = Object.freeze({
    public: "StreamSuites Public",
    creator: "StreamSuites Creator",
    admin: "StreamSuites Admin",
    directory: "FindMeHere Directory",
    desktop: "Desktop Admin",
    "auth-controls": "Auth Controls",
    self_service: "Self Service"
  });

  const locationFormatting = (() => {
    const PLACEHOLDER_VALUES = new Set(["", "-", "--", "unknown", "n/a", "na", "null", "undefined"]);
    let countryDisplayNames = null;

    function collapseWhitespace(value) {
      return String(value || "")
        .replace(/\s+/g, " ")
        .replace(/\s*,\s*/g, ", ")
        .replace(/^,+|,+$/g, "")
        .trim();
    }

    function isPlaceholderValue(value) {
      return PLACEHOLDER_VALUES.has(String(value || "").trim().toLowerCase());
    }

    function normalizeCode(value) {
      const text = collapseWhitespace(value).toUpperCase();
      if (!text || isPlaceholderValue(text) || text === "ZZ") return "";
      return text;
    }

    function normalizeName(value) {
      const text = collapseWhitespace(value);
      if (!text || isPlaceholderValue(text)) return "";
      const alpha = text.replace(/[^A-Za-z]/g, "");
      if (!alpha) return text;
      const isAllLower = alpha === alpha.toLowerCase();
      const isAllUpper = alpha === alpha.toUpperCase();
      if ((isAllLower || isAllUpper) && alpha.length > 3) {
        return text.toLowerCase().replace(/\b([a-z])/g, (match) => match.toUpperCase());
      }
      return text;
    }

    function dedupeAdjacent(parts) {
      const normalized = [];
      parts.forEach((part) => {
        const text = collapseWhitespace(part);
        if (!text) return;
        const previous = normalized[normalized.length - 1];
        if (previous && previous.localeCompare(text, undefined, { sensitivity: "base" }) === 0) {
          return;
        }
        normalized.push(text);
      });
      return normalized;
    }

    function buildLabel(parts) {
      return dedupeAdjacent(parts).join(", ");
    }

    function getCountryDisplayNames() {
      if (countryDisplayNames !== null) {
        return countryDisplayNames;
      }

      try {
        countryDisplayNames = typeof Intl !== "undefined"
          ? new Intl.DisplayNames(["en"], { type: "region" })
          : false;
      } catch {
        countryDisplayNames = false;
      }

      return countryDisplayNames;
    }

    function resolveCountryName(countryCode, fallbackResolver) {
      const code = normalizeCode(countryCode);
      if (!code) return "";
      if (typeof fallbackResolver === "function") {
        const fallbackName = normalizeName(fallbackResolver(code));
        if (fallbackName) return fallbackName;
      }

      const displayNames = getCountryDisplayNames();
      if (displayNames) {
        try {
          const candidate = normalizeName(displayNames.of(code));
          if (candidate) return candidate;
        } catch {
          return "";
        }
      }

      return "";
    }

    function buildPresentation(rawLocation, options = {}) {
      const city = normalizeName(rawLocation?.city);
      const region = normalizeName(rawLocation?.region);
      const regionCode = normalizeCode(rawLocation?.regionCode ?? rawLocation?.region_code);
      const countryCode = normalizeCode(rawLocation?.countryCode ?? rawLocation?.country_code ?? rawLocation?.code);
      const rawCountry = normalizeName(rawLocation?.country ?? rawLocation?.countryName ?? rawLocation?.name);
      const countryName = rawCountry || resolveCountryName(countryCode, options.resolveCountryName);
      const regionLabel = region || regionCode;
      const detailedLabel = buildLabel(
        city
          ? [city, regionLabel, countryName || countryCode]
          : regionLabel
            ? [regionLabel, countryName || countryCode]
            : [countryName || countryCode]
      );

      let primaryLabel = "";
      let precision = "country";
      if (city && regionLabel) {
        primaryLabel = buildLabel([city, regionLabel]);
        precision = "city";
      } else if (city && (countryName || countryCode)) {
        primaryLabel = buildLabel([city, countryName || countryCode]);
        precision = "city";
      } else if (city) {
        primaryLabel = city;
        precision = "city";
      } else if (regionLabel && (countryName || countryCode)) {
        primaryLabel = buildLabel([regionLabel, countryName || countryCode]);
        precision = "region";
      } else if (regionLabel) {
        primaryLabel = regionLabel;
        precision = "region";
      } else {
        primaryLabel = countryName || countryCode;
        precision = "country";
      }

      const primaryOrFallback = primaryLabel || detailedLabel;
      const secondaryLabel = detailedLabel && detailedLabel !== primaryOrFallback
        ? detailedLabel
        : (precision === "country" && primaryOrFallback ? "Country only" : "");
      const sortSegments = [
        normalizeName(countryName || countryCode || primaryOrFallback).toLowerCase(),
        normalizeName(regionLabel).toLowerCase(),
        normalizeName(city).toLowerCase(),
        precision === "country" ? "0" : precision === "region" ? "1" : "2",
        normalizeName(primaryOrFallback).toLowerCase()
      ];

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
        sortKey: sortSegments.join("|"),
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

    return {
      buildPresentation
    };
  })();
  window.StreamSuitesLocationFormatting = locationFormatting;

  const state = {
    destroyed: false,
    eventTypes: [],
    templateVariables: [],
    templateSyntax: "{{variable_name}}",
    templateMissingValuePolicy: "blank",
    configuration: null,
    lastSavedConfigurationHash: "",
    lastImportedSummary: "",
    preferences: null,
    rules: [],
    targets: [],
    history: [],
    settings: null,
    activeRuleId: null,
    activeTemplateField: "body",
    ruleView: "list",
    rulesPage: 1,
    historyPage: 1,
    loadToken: 0,
    ruleScopePassthrough: {},
    targetFilters: {
      type: "",
      status: ""
    },
    targetActionIds: new Set(),
    targetsLoading: false,
    targetsError: "",
    historyError: "",
    loadPromise: null,
    panelsPromise: null
  };

  const el = {
    root: null,
    dirtyIndicator: null,
    status: null,
    banner: null,
    configReload: null,
    configSave: null,
    configExport: null,
    configImport: null,
    configImportFile: null,
    configState: null,
    configDetail: null,
    configSchema: null,
    configSource: null,
    configSynced: null,
    configImported: null,
    configWorkingRules: null,
    configWorkingPreferences: null,
    summaryStatus: null,
    summaryStatusDetail: null,
    summaryRules: null,
    summaryEnabledRules: null,
    summaryTargets: null,
    summaryTargetsEnabled: null,
    summaryHistory: null,
    summarySubscribers: null,
    preferencesForm: null,
    masterEnabled: null,
    quietHoursEnabled: null,
    quietStart: null,
    quietEnd: null,
    timezone: null,
    destinationDefaults: null,
    preferencesSave: null,
    testForm: null,
    testEventType: null,
    testSeverity: null,
    testMetricValue: null,
    testRule: null,
    testTitle: null,
    testMessage: null,
    testDestinations: null,
    testForce: null,
    testSubmit: null,
    rulesRefresh: null,
    rulesCreate: null,
    ruleForm: null,
    ruleFormTitle: null,
    ruleCancel: null,
    ruleSave: null,
    ruleEventType: null,
    ruleSeverity: null,
    ruleThresholdType: null,
    ruleEnabled: null,
    ruleName: null,
    ruleDescription: null,
    ruleTitleTemplate: null,
    ruleBodyTemplate: null,
    templateHelp: null,
    templateFocus: null,
    templateTargets: null,
    templateVariables: null,
    previewEvent: null,
    previewSeverity: null,
    previewTitleText: null,
    previewMessageText: null,
    previewDestinations: null,
    previewNote: null,
    ruleThresholdNumberRow: null,
    ruleThresholdNumber: null,
    ruleThresholdStateRow: null,
    ruleThresholdState: null,
    ruleThresholdCustomRow: null,
    ruleThresholdCustom: null,
    ruleWindowMinutes: null,
    ruleCooldownMinutes: null,
    ruleDedupeWindowMinutes: null,
    ruleScopeEnabled: null,
    ruleScopeBody: null,
    ruleScopeHelper: null,
    ruleScopeWarning: null,
    ruleScopeRecommended: null,
    ruleScopeAdvancedDetails: null,
    ruleScopeAdvanced: null,
    ruleDestinations: null,
    rulesList: null,
    rulesRailSummary: null,
    rulesCountChip: null,
    rulesEmpty: null,
    rulesPagination: null,
    rulesViewToggle: null,
    targetsRefresh: null,
    targetsTypeFilter: null,
    targetsStatusFilter: null,
    targetsState: null,
    targetsList: null,
    targetsEmpty: null,
    targetsSummaryMeta: null,
    targetsSummaryDetail: null,
    historyRefresh: null,
    historyList: null,
    historyEmpty: null,
    historyPagination: null,
    historySummary: null,
    preferencesSummaryMeta: null,
    preferencesSummaryDetail: null,
    testSummaryMeta: null,
    testSummaryDetail: null
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

  function formatTimestamp(value) {
    if (!value) return "--";
    if (typeof window.StreamSuitesState?.formatTimestamp === "function") {
      const formatted = window.StreamSuitesState.formatTimestamp(value);
      if (formatted) return formatted;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString(undefined, {
      hour12: false,
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function labelize(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  }

  function surfaceLabel(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return "Unknown";
    return SURFACE_LABELS[normalized] || labelize(normalized) || "Unknown";
  }

  function sortTemplateVariables(items) {
    return (Array.isArray(items) ? items.slice() : []).sort((left, right) => {
      const leftRank = TEMPLATE_VARIABLE_PRIORITY_MAP[left?.key] ?? Number.MAX_SAFE_INTEGER;
      const rightRank = TEMPLATE_VARIABLE_PRIORITY_MAP[right?.key] ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      const leftLabel = String(left?.label || left?.key || "").trim();
      const rightLabel = String(right?.label || right?.key || "").trim();
      return leftLabel.localeCompare(rightLabel);
    });
  }

  function escapeSelectorValue(value) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(String(value || ""));
    }
    return String(value || "").replace(/"/g, '\\"');
  }

  function cloneJson(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_err) {
      return null;
    }
  }

  function coerceBoolean(value, fallback = false) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(normalized)) return true;
      if (["false", "0", "no", "off"].includes(normalized)) return false;
    }
    return fallback;
  }

  function stableSerialize(value) {
    if (Array.isArray(value)) {
      return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
    }
    if (value && typeof value === "object") {
      return `{${Object.keys(value)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function generateUuid() {
    if (typeof window.crypto?.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `alert-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  function clampPage(page, totalPages) {
    const parsed = Number.parseInt(String(page || ""), 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return Math.min(parsed, Math.max(totalPages, 1));
  }

  function paginateItems(items, page, pageSize) {
    const safeItems = Array.isArray(items) ? items : [];
    const safePageSize = Math.max(1, Number.parseInt(String(pageSize || ""), 10) || 1);
    const totalItems = safeItems.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
    const currentPage = clampPage(page, totalPages);
    const startIndex = totalItems ? (currentPage - 1) * safePageSize : 0;
    const endIndex = Math.min(startIndex + safePageSize, totalItems);
    return {
      items: safeItems.slice(startIndex, endIndex),
      totalItems,
      totalPages,
      currentPage,
      startIndex,
      endIndex
    };
  }

  function normalizeScopeText(value, { pathLike = false, lower = false } = {}) {
    let text = String(value || "").trim();
    if (!text) return "";
    if (pathLike && !text.startsWith("/")) {
      text = `/${text.replace(/^\/+/, "")}`;
    }
    return lower ? text.toLowerCase() : text;
  }

  function normalizeScopeValues(rawScope) {
    const input = rawScope && typeof rawScope === "object" ? rawScope : {};
    const normalized = {};
    SCOPE_FIELD_ORDER.forEach((field) => {
      const value = input[field];
      if (field === "admin_only") {
        if (value === true) normalized[field] = true;
        return;
      }
      if (field === "page_path" || field === "route") {
        const text = normalizeScopeText(value, { pathLike: true });
        if (text) normalized[field] = text;
        return;
      }
      if (field === "page_key") {
        const text = normalizeScopeText(value);
        if (text) normalized[field] = text;
        return;
      }
      const text = normalizeScopeText(value, { lower: true });
      if (text) normalized[field] = text;
    });
    return normalized;
  }

  function hasScopeValues(scope) {
    return !!(scope && typeof scope === "object" && Object.keys(scope).length);
  }

  function formatScopeSummary(scope) {
    const normalized = normalizeScopeValues(scope);
    if (!hasScopeValues(normalized)) {
      return "All matching events";
    }
    const parts = [];
    if (normalized.page_path) parts.push(normalized.page_path);
    if (normalized.page_key) parts.push(`page_key=${normalized.page_key}`);
    if (normalized.route) parts.push(`route=${normalized.route}`);
    if (normalized.auth_provider) parts.push(`provider=${normalized.auth_provider}`);
    if (normalized.user_type) parts.push(`user_type=${normalized.user_type}`);
    if (normalized.admin_only) parts.push("admin_only");
    if (normalized.surface) parts.push(`surface=${surfaceLabel(normalized.surface)}`);
    if (normalized.destination_type) parts.push(`destination=${destinationLabel(normalized.destination_type)}`);
    return parts.join(" + ");
  }

  function buildAlertLocationPresentation(entry, options = {}) {
    const includeCountryWithCity = options.includeCountryWithCity === true;
    const geo = entry?.payload_snapshot?.geo || entry?.metadata?.template_context?.geo || entry?.geo || {};
    const presentation = locationFormatting.buildPresentation({
      city: geo?.city,
      region: geo?.region,
      regionCode: geo?.region_code,
      country: geo?.country,
      countryCode: geo?.country_code
    });
    if (includeCountryWithCity && presentation?.detailedLabel) {
      return {
        ...presentation,
        primaryLabel: presentation.detailedLabel
      };
    }
    return presentation;
  }

  function buildAlertLocationLabel(entry, options = {}) {
    return buildAlertLocationPresentation(entry, options)?.primaryLabel || "";
  }

  function normalizeExternalUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    try {
      const parsed = new URL(text);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "";
      }
      return parsed.toString();
    } catch {
      return "";
    }
  }

  function getAlertPageInfo(entry) {
    const templateContext = entry?.metadata?.template_context || {};
    const payload = entry?.payload_snapshot || {};
    const pagePath = String(templateContext.page_path || payload.page_path || "").trim();
    const pageUrl = normalizeExternalUrl(templateContext.page_url || payload.page_url);
    const pageTitle = String(templateContext.page_title || payload.page_title || "").trim();
    return {
      pagePath,
      pageUrl,
      pageTitle
    };
  }

  function getAlertSurfaceCode(entry) {
    const templateContext = entry?.metadata?.template_context || {};
    const payload = entry?.payload_snapshot || {};
    return String(templateContext.surface || payload.surface || "").trim().toLowerCase();
  }

  function renderAlertSurfaceContext(entry) {
    const surface = getAlertSurfaceCode(entry);
    if (!surface) return "";
    return `<p class="ss-analytics-alerts-history-context">Surface: ${escapeHtml(surfaceLabel(surface))}</p>`;
  }

  function renderAlertPageContext(entry) {
    const page = getAlertPageInfo(entry);
    if (!page.pagePath) return "";
    const pageMarkup = page.pageUrl
      ? `<a class="ss-analytics-alerts-history-link" href="${escapeHtml(page.pageUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(page.pagePath)}</a>`
      : escapeHtml(page.pagePath);
    const suffix = page.pageTitle ? ` <span class="ss-analytics-alerts-history-context-meta">(${escapeHtml(page.pageTitle)})</span>` : "";
    return `<p class="ss-analytics-alerts-history-context">Page: ${pageMarkup}${suffix}</p>`;
  }

  function collectObservedScopeValues(field) {
    const values = new Set();
    state.rules.forEach((rule) => {
      const scope = rule?.scope;
      if (scope && typeof scope === "object" && scope[field] !== undefined && scope[field] !== null && scope[field] !== "") {
        values.add(String(scope[field]).trim());
      }
    });
    state.history.forEach((entry) => {
      const metadata = entry?.metadata;
      const scope = metadata?.effective_scope || metadata?.rule_scope;
      if (scope && typeof scope === "object" && scope[field] !== undefined && scope[field] !== null && scope[field] !== "") {
        values.add(String(scope[field]).trim());
      }
    });
    return Array.from(values).filter(Boolean);
  }

  function getScopeSelectOptions(field, currentValue) {
    const options = new Set();
    if (field === "auth_provider") {
      ["google", "github", "discord", "twitch", "x", "email", "magic_link"].forEach((item) => options.add(item));
    } else if (field === "user_type") {
      ["creator", "viewer", "admin"].forEach((item) => options.add(item));
    } else if (field === "surface") {
      ["public", "directory", "admin", "auth-controls", "self_service"].forEach((item) => options.add(item));
    } else if (field === "destination_type") {
      getDestinationKeys().forEach((item) => options.add(item));
    }
    collectObservedScopeValues(field).forEach((item) => options.add(String(item).toLowerCase()));
    if (currentValue) options.add(String(currentValue).trim().toLowerCase());
    return Array.from(options).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }

  function getSupportedScopeKeys() {
    const supported = new Set();
    state.eventTypes.forEach((eventType) => {
      (Array.isArray(eventType?.supported_scope_keys) ? eventType.supported_scope_keys : []).forEach((key) => {
        if (SCOPE_FIELD_ORDER.includes(key)) supported.add(key);
      });
    });
    return supported.size ? Array.from(supported) : Array.from(SCOPE_FIELD_ORDER);
  }

  function getScopeProfile(eventType) {
    const key = String(eventType || "").trim().toLowerCase();
    let recommended = ["surface"];
    let helper = "Keep filters broad unless you need a page, provider, user-type, or admin-only slice.";
    let defaults = {};
    let autoEnable = false;

    if (key === "public_page_visit" || key === "public_page_visit_spike") {
      recommended = ["page_path", "page_key", "route", "surface"];
      helper = "Page visit alerts usually scope to a route or specific public page to avoid broad traffic noise.";
    } else if (
      [
        "login_success",
        "login_failure",
        "magic_link_requested",
        "magic_link_completed",
        "oauth_linked",
        "oauth_unlinked",
        "auth_failure_spike"
      ].includes(key)
    ) {
      recommended = ["auth_provider", "route", "surface"];
      helper = "Auth alerts are usually narrowed by provider, login route, or surface.";
    } else if (key === "creator_signup") {
      recommended = ["user_type", "surface"];
      helper = "Creator signup alerts can stay explicit with `user_type=creator`.";
      defaults = { user_type: "creator" };
      autoEnable = true;
    } else if (key === "viewer_signup") {
      recommended = ["user_type", "surface"];
      helper = "Viewer signup alerts can stay explicit with `user_type=viewer`.";
      defaults = { user_type: "viewer" };
      autoEnable = true;
    } else if (key === "admin_login") {
      recommended = ["admin_only", "surface", "route"];
      helper = "Admin login alerts are often safest when restricted to admin-only activity.";
      defaults = { admin_only: true };
      autoEnable = true;
    }

    const supported = getSupportedScopeKeys();
    const filteredRecommended = recommended.filter((field) => supported.includes(field));
    const advanced = supported.filter((field) => !filteredRecommended.includes(field));
    return { helper, recommended: filteredRecommended, advanced, defaults, autoEnable };
  }

  function getPassthroughScope(scope) {
    const input = scope && typeof scope === "object" ? scope : {};
    return Object.fromEntries(
      Object.entries(input).filter(([key]) => !SCOPE_FIELD_ORDER.includes(key))
    );
  }

  function destinationLabel(key) {
    const normalized = String(key || "").trim().toLowerCase();
    if (normalized === "windows_client") return "Windows client";
    if (normalized === "pushover") return "Pushover";
    return labelize(normalized || "destination");
  }

  function destinationIconPath(key) {
    return DESTINATION_ICON_MAP[String(key || "").trim().toLowerCase()] || "";
  }

  function renderChip(label, { tone = "", extraClasses = "", iconPath = "" } = {}) {
    const classes = ["ss-chip"];
    if (tone) classes.push(`ss-chip-${tone}`);
    if (extraClasses) classes.push(extraClasses);
    const iconStyle = iconPath ? ` style="--ss-alerts-chip-icon:url('${iconPath}')"` : "";
    const iconMarkup = iconPath ? '<span class="ss-alerts-chip-icon" aria-hidden="true"></span>' : "";
    return `<span class="${classes.join(" ")}"${iconStyle}>${iconMarkup}${escapeHtml(label)}</span>`;
  }

  function renderDestinationChip(key, extraClasses = "") {
    return renderChip(destinationLabel(key), {
      extraClasses: [extraClasses, destinationIconPath(key) ? "ss-alerts-icon-chip" : ""].filter(Boolean).join(" "),
      iconPath: destinationIconPath(key)
    });
  }

  function targetStatusTone(status) {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "active") return "success";
    if (normalized === "stale") return "warning";
    return "muted";
  }

  function normalizeTarget(rawTarget) {
    const base = rawTarget && typeof rawTarget === "object" ? cloneJson(rawTarget) || {} : {};
    const deviceType = String(base.device_type || base.target_type || "").trim().toLowerCase();
    const metadata = base.metadata && typeof base.metadata === "object" ? base.metadata : {};
    const ownerHint = String(
      base.owner_hint || base.owner_display || base.owner_user_code || base.owner_account_id || ""
    ).trim();
    const status = String(base.status || "").trim().toLowerCase() || (base.enabled === false ? "disabled" : "unknown");
    const statusLabel = String(base.status_label || "").trim()
      || (status === "active" ? "Active / Recently seen" : labelize(status || "unknown"));
    const metadataSummary = String(base.metadata_summary || "").trim()
      || [metadata.machine_label, metadata.machine_name, metadata.hostname, metadata.os_version].filter(Boolean).join(" | ");
    return {
      ...base,
      id: String(base.id || "").trim(),
      device_type: deviceType,
      target_type: String(base.target_type || deviceType).trim() || deviceType,
      type_label: String(base.type_label || destinationLabel(deviceType)).trim() || destinationLabel(deviceType),
      display_name: String(base.display_name || metadata.machine_label || destinationLabel(deviceType)).trim() || destinationLabel(deviceType),
      enabled: coerceBoolean(base.enabled, true),
      owner_hint: ownerHint,
      owner_display: ownerHint || "Unassigned",
      status,
      status_label: statusLabel,
      metadata,
      metadata_summary: metadataSummary || null,
      connection_status: String(base.connection_status || "").trim() || null,
      last_seen_at: base.last_seen_at || null,
      created_at: base.created_at || null,
      updated_at: base.updated_at || null
    };
  }

  function getFilteredTargets() {
    return state.targets.filter((target) => {
      if (state.targetFilters.type && target.device_type !== state.targetFilters.type) return false;
      if (state.targetFilters.status && target.status !== state.targetFilters.status) return false;
      return true;
    });
  }

  function updateTargetsState(message) {
    if (!el.targetsState) return;
    el.targetsState.textContent = message || "";
    el.targetsState.classList.toggle("hidden", !message);
  }

  function renderTargetFilters() {
    if (!el.targetsTypeFilter) return;
    const current = String(state.targetFilters.type || "").trim();
    const options = Array.from(new Set(state.targets.map((target) => target.device_type).filter(Boolean)));
    el.targetsTypeFilter.innerHTML = ['<option value="">All</option>']
      .concat(options.map((key) => `<option value="${escapeHtml(key)}">${escapeHtml(destinationLabel(key))}</option>`))
      .join("");
    el.targetsTypeFilter.value = options.includes(current) ? current : "";
    if (el.targetsStatusFilter) {
      el.targetsStatusFilter.value = String(state.targetFilters.status || "").trim();
    }
  }

  function severityLabel(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "warning" ? "Warning" : labelize(normalized || "info");
  }

  function severityTone(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "critical") return "critical";
    if (normalized === "error") return "error";
    if (normalized === "warning") return "warning";
    return "info";
  }

  function normalizeClientIp(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (["unknown", "n/a", "na", "none", "null", "(none)", "-"].includes(text.toLowerCase())) {
      return "";
    }
    return text;
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

  function setStatus(message) {
    if (el.status) {
      el.status.textContent = message || "";
    }
  }

  function setBanner(message, tone = "danger") {
    if (message) {
      const mappedTone = tone === "danger" ? "error" : tone;
      window.StreamSuitesToast?.[mappedTone]?.(message, {
        key: "analytics-alerting-banner",
        title: "Alerting",
        autoDismissMs: mappedTone === "error" || mappedTone === "warning" ? 6800 : 4200
      });
    } else {
      window.StreamSuitesToast?.dismiss?.("analytics-alerting-banner");
    }
    if (!el.banner) return;
    el.banner.textContent = "";
    el.banner.className = "ss-alert hidden";
  }

  function clearBanner() {
    setBanner("");
  }

  function getDestinationKeys() {
    const keys = new Set(DEFAULT_DESTINATIONS);
    const defaults = state.preferences?.destination_defaults;
    if (defaults && typeof defaults === "object") {
      Object.keys(defaults).forEach((key) => keys.add(String(key)));
    }
    state.rules.forEach((rule) => {
      (Array.isArray(rule?.destinations) ? rule.destinations : []).forEach((key) => keys.add(String(key)));
    });
    state.targets.forEach((target) => {
      if (target?.device_type) {
        keys.add(String(target.device_type));
      }
    });
    return Array.from(keys).filter(Boolean);
  }

  function getEventMeta(eventType) {
    return state.eventTypes.find((item) => item?.key === eventType) || null;
  }

  function extractItems(payload) {
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  function extractSettings(payload) {
    return payload?.settings && typeof payload.settings === "object" ? payload.settings : {};
  }

  function extractPreferences(payload) {
    return payload?.preferences && typeof payload.preferences === "object" ? payload.preferences : null;
  }

  function isAuthError(error) {
    return error?.status === 401 || error?.status === 403 || error?.isAuthError === true;
  }

  function getSettledValue(result, fallback = null) {
    return result?.status === "fulfilled" ? result.value : fallback;
  }

  function getSettledError(result, fallback) {
    if (result?.status !== "rejected") return "";
    return String(result.reason?.message || fallback || "").trim();
  }

  function normalizePreferences(preferences) {
    const payload = preferences && typeof preferences === "object" ? preferences : {};
    const destinationDefaults = payload.destination_defaults && typeof payload.destination_defaults === "object"
      ? payload.destination_defaults
      : {};
    const destinationKeys = new Set([
      ...DEFAULT_DESTINATIONS,
      ...Object.keys(destinationDefaults),
      ...getDestinationKeys()
    ]);
    const normalizedDestinationDefaults = {};
    Array.from(destinationKeys).filter(Boolean).forEach((key) => {
      const current = destinationDefaults[key] && typeof destinationDefaults[key] === "object"
        ? destinationDefaults[key]
        : {};
      normalizedDestinationDefaults[key] = {
        enabled: coerceBoolean(current.enabled, true),
        severity_minimum: SEVERITIES.includes(String(current.severity_minimum || "").trim().toLowerCase())
          ? String(current.severity_minimum).trim().toLowerCase()
          : "info"
      };
    });
    return {
      master_enabled: coerceBoolean(payload.master_enabled, true),
      quiet_hours_enabled: coerceBoolean(payload.quiet_hours_enabled, false),
      quiet_hours_start: String(payload.quiet_hours_start || "22:00").trim() || "22:00",
      quiet_hours_end: String(payload.quiet_hours_end || "07:00").trim() || "07:00",
      timezone: String(payload.timezone || "UTC").trim() || "UTC",
      destination_defaults: normalizedDestinationDefaults
    };
  }

  function normalizeRuleForEditor(rawRule, index = 0) {
    if (!rawRule || typeof rawRule !== "object") {
      throw new Error(`Imported rule ${index + 1} is not an object.`);
    }
    const base = cloneJson(rawRule) || {};
    const eventType = String(base.event_type || "").trim();
    if (!eventType) {
      throw new Error(`Imported rule ${index + 1} is missing event_type.`);
    }
    const supportedEventTypes = new Set(state.eventTypes.map((item) => item?.key).filter(Boolean));
    if (supportedEventTypes.size && !supportedEventTypes.has(eventType)) {
      throw new Error(`Imported rule ${index + 1} uses unsupported event_type "${eventType}".`);
    }
    const thresholdType = ["count", "rate", "state", "custom"].includes(String(base.threshold_type || "").trim())
      ? String(base.threshold_type).trim()
      : "count";
    const thresholdValue = thresholdType === "state"
      ? coerceBoolean(base.threshold_value, true)
      : thresholdType === "custom"
        ? String(base.threshold_value || "").trim()
        : Number(base.threshold_value ?? 1);
    if (thresholdType === "custom" && !thresholdValue) {
      throw new Error(`Imported rule ${index + 1} is missing a custom threshold value.`);
    }
    if (thresholdType !== "custom" && thresholdType !== "state" && (!Number.isFinite(thresholdValue) || thresholdValue < 0)) {
      throw new Error(`Imported rule ${index + 1} has an invalid numeric threshold.`);
    }
    const normalizedScope = normalizeScopeValues(base.scope);
    const destinations = Array.isArray(base.destinations)
      ? Array.from(new Set(base.destinations.map((item) => String(item || "").trim()).filter(Boolean)))
      : [];
    return {
      ...base,
      id: String(base.id || "").trim() || generateUuid(),
      event_type: eventType,
      enabled: coerceBoolean(base.enabled, true),
      name: String(base.name || base.label || labelize(eventType)).trim() || labelize(eventType),
      description: String(base.description || "").trim() || null,
      title_template: String(base.title_template || base.title || "").trim() || null,
      body_template: String(base.body_template || base.message_template || base.description_template || "").trim() || null,
      severity: SEVERITIES.includes(String(base.severity || "").trim().toLowerCase())
        ? String(base.severity).trim().toLowerCase()
        : (getEventMeta(eventType)?.default_severity || "info"),
      threshold_type: thresholdType,
      threshold_value: thresholdValue,
      window_minutes: Math.max(1, Number.parseInt(String(base.window_minutes ?? 5), 10) || 5),
      cooldown_minutes: Math.max(0, Number.parseInt(String(base.cooldown_minutes ?? 15), 10) || 15),
      dedupe_window_minutes: Math.max(0, Number.parseInt(String(base.dedupe_window_minutes ?? 0), 10) || 0),
      scope_mode: String(base.scope_mode || "all").trim() || "all",
      scope: normalizedScope,
      destinations: destinations.length ? destinations : ["windows_client"]
    };
  }

  function buildConfigurationSnapshot() {
    return {
      schema_version: String(state.configuration?.schema_version || "alerts.v2").trim() || "alerts.v2",
      source: String(state.configuration?.source || "auth_api").trim() || "auth_api",
      preferences: normalizePreferences(state.preferences),
      rules: state.rules.map((rule, index) => normalizeRuleForEditor(rule, index))
    };
  }

  function getConfigurationHash() {
    return stableSerialize(buildConfigurationSnapshot());
  }

  function hasUnsavedChanges() {
    return !!state.lastSavedConfigurationHash && state.lastSavedConfigurationHash !== getConfigurationHash();
  }

  function updateDirtyStateUi() {
    const dirty = hasUnsavedChanges();
    if (el.dirtyIndicator) {
      el.dirtyIndicator.textContent = dirty ? "Unsaved changes" : "Synced";
      el.dirtyIndicator.classList.toggle("is-dirty", dirty);
    }
    if (el.configState) {
      el.configState.textContent = dirty ? "Unsaved edits" : "Synced";
    }
    if (el.configDetail) {
      el.configDetail.textContent = dirty
        ? "Reloading will discard the current draft until you save it."
        : "Working copy matches the backend configuration.";
    }
    if (el.configWorkingRules) {
      el.configWorkingRules.textContent = `${state.rules.length} rule${state.rules.length === 1 ? "" : "s"}`;
    }
    if (el.configWorkingPreferences) {
      el.configWorkingPreferences.textContent = `Timezone ${state.preferences?.timezone || "UTC"}`;
    }
    if (el.configSave) {
      el.configSave.disabled = !state.configuration || !dirty;
    }
  }

  function setWorkingConfiguration(configuration, { syncCleanState = false, importedSummary = "" } = {}) {
    const payload = configuration && typeof configuration === "object" ? configuration : {};
    state.configuration = {
      ...payload,
      schema_version: String(payload.schema_version || "alerts.v2").trim() || "alerts.v2",
      source: String(payload.source || "auth_api").trim() || "auth_api"
    };
    state.preferences = normalizePreferences(payload.preferences);
    state.rules = Array.isArray(payload.rules)
      ? payload.rules.map((rule, index) => normalizeRuleForEditor(rule, index))
      : [];
    state.rulesPage = 1;
    if (syncCleanState) {
      state.lastSavedConfigurationHash = getConfigurationHash();
      state.lastImportedSummary = "";
    } else if (importedSummary) {
      state.lastImportedSummary = importedSummary;
    }
    updateDirtyStateUi();
  }

  function normalizeImportedConfigurationDocument(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("Imported ruleset must be a JSON object.");
    }
    const configuration = payload.configuration && typeof payload.configuration === "object"
      ? payload.configuration
      : payload;
    if (!configuration || typeof configuration !== "object") {
      throw new Error("Imported ruleset does not contain a configuration object.");
    }
    if (!Array.isArray(configuration.rules)) {
      throw new Error("Imported ruleset is missing a rules array.");
    }
    const normalized = {
      schema_version: String(configuration.schema_version || payload.schema_version || state.configuration?.schema_version || "alerts.v2").trim() || "alerts.v2",
      source: String(configuration.source || payload.source || "import").trim() || "import",
      preferences: normalizePreferences(configuration.preferences),
      rules: configuration.rules.map((rule, index) => normalizeRuleForEditor(rule, index))
    };
    const seenIds = new Set();
    normalized.rules.forEach((rule) => {
      if (seenIds.has(rule.id)) {
        throw new Error(`Imported ruleset contains duplicate rule id "${rule.id}".`);
      }
      seenIds.add(rule.id);
    });
    return normalized;
  }

  function renderSelectOptions(selectEl, items, getValue, getLabel, emptyLabel = "") {
    if (!(selectEl instanceof HTMLSelectElement)) return;
    const previous = selectEl.value;
    const options = [];
    if (emptyLabel) {
      options.push(`<option value="">${escapeHtml(emptyLabel)}</option>`);
    }
    items.forEach((item) => {
      const value = getValue(item);
      const label = getLabel(item);
      options.push(`<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`);
    });
    selectEl.innerHTML = options.join("");
    if (previous && Array.from(selectEl.options).some((option) => option.value === previous)) {
      selectEl.value = previous;
    }
  }

  function renderSummary() {
    const enabledRules = state.rules.filter((rule) => rule?.enabled).length;
    const enabledTargets = state.targets.filter((target) => target?.enabled).length;
    const settings = state.settings || {};
    const summaryTargets = Number(settings?.registered_devices_total) || state.targets.length;
    const historyTotal = Number(settings?.delivery_history_total) || state.history.length;
    const timezone = state.preferences?.timezone || "UTC";
    const masterEnabled = state.preferences?.master_enabled !== false;
    const quietEnabled = state.preferences?.quiet_hours_enabled === true;
    const quietStart = state.preferences?.quiet_hours_start || "22:00";
    const quietEnd = state.preferences?.quiet_hours_end || "07:00";

    if (el.summaryStatus) {
      el.summaryStatus.textContent = masterEnabled ? "Enabled" : "Paused";
    }
    if (el.summaryStatusDetail) {
      el.summaryStatusDetail.textContent = masterEnabled
        ? quietEnabled
          ? `Quiet hours ${quietStart} to ${quietEnd} (${timezone})`
          : `All enabled channels can send (${timezone})`
        : "Alerts are currently paused by the global setting.";
    }
    if (el.summaryRules) el.summaryRules.textContent = String(state.rules.length);
    if (el.summaryEnabledRules) el.summaryEnabledRules.textContent = `${enabledRules} enabled`;
    if (el.summaryTargets) el.summaryTargets.textContent = String(summaryTargets);
    if (el.summaryTargetsEnabled) el.summaryTargetsEnabled.textContent = `${enabledTargets} enabled`;
    if (el.summaryHistory) el.summaryHistory.textContent = String(historyTotal);
    if (el.summarySubscribers) {
      el.summarySubscribers.textContent = `${Number(settings?.active_stream_subscribers) || 0} live subscribers`;
    }
  }

  function renderCollapsibleSummaries() {
    const enabledDefaults = getDestinationKeys().filter((key) => state.preferences?.destination_defaults?.[key]?.enabled !== false);
    if (el.preferencesSummaryMeta) {
      el.preferencesSummaryMeta.textContent = `${enabledDefaults.length} channel${enabledDefaults.length === 1 ? "" : "s"} enabled`;
    }
    if (el.preferencesSummaryDetail) {
      const quietEnabled = state.preferences?.quiet_hours_enabled === true;
      const quietRange = quietEnabled
        ? `Quiet hours ${state.preferences?.quiet_hours_start || "22:00"}-${state.preferences?.quiet_hours_end || "07:00"}`
        : "Quiet hours off";
      el.preferencesSummaryDetail.textContent = `${quietRange} • Timezone ${state.preferences?.timezone || "UTC"}`;
    }

    const selectedTestDestinations = collectCheckedValues(
      el.testDestinations,
      "input[type='checkbox'][data-testDestination]",
      "data-testDestination"
    );
    if (el.testSummaryMeta) {
      el.testSummaryMeta.textContent = `${selectedTestDestinations.length || getDestinationKeys().length} destination${(selectedTestDestinations.length || getDestinationKeys().length) === 1 ? "" : "s"}`;
    }
    if (el.testSummaryDetail) {
      const selectedEvent = getEventMeta(el.testEventType?.value)?.label || labelize(el.testEventType?.value || "runtime_error_spike");
      const selectedSeverity = el.testSeverity?.value ? severityLabel(el.testSeverity.value) : "Default severity";
      el.testSummaryDetail.textContent = `${selectedEvent} • ${selectedSeverity}`;
    }

    const activeTargets = state.targets.filter((target) => target?.enabled !== false);
    if (el.targetsSummaryMeta) {
      el.targetsSummaryMeta.textContent = `${state.targets.length} channel${state.targets.length === 1 ? "" : "s"} registered`;
    }
    if (el.targetsSummaryDetail) {
      el.targetsSummaryDetail.textContent = `${activeTargets.length} enabled • Filters stay available inside the panel`;
    }
  }

  function renderPersistenceMeta() {
    if (el.configSchema) {
      el.configSchema.textContent = state.configuration?.schema_version || "--";
    }
    if (el.configSource) {
      el.configSource.textContent = state.configuration?.source
        ? String(state.configuration.source)
        : "Awaiting backend config";
    }
    if (el.configSynced) {
      el.configSynced.textContent = formatTimestamp(state.configuration?.exported_at || state.settings?.generated_at || null);
    }
    if (el.configImported) {
      el.configImported.textContent = state.lastImportedSummary || "No import staged";
    }
    updateDirtyStateUi();
  }

  function renderDestinationDefaults() {
    if (!el.destinationDefaults) return;
    const destinationDefaults = state.preferences?.destination_defaults || {};
    const items = getDestinationKeys()
      .map((key) => {
        const current = destinationDefaults[key] || {};
        return `
          <div class="ss-analytics-alerts-destination-row">
            <label class="ss-analytics-alerts-destination-main">
              <span class="ss-analytics-alerts-inline-toggle">
                <input type="checkbox" data-destination-enabled="${escapeHtml(key)}" ${current.enabled !== false ? "checked" : ""} />
                <strong>${escapeHtml(destinationLabel(key))}</strong>
              </span>
              <span class="muted">${escapeHtml(labelize(key))}</span>
            </label>
            <label class="ss-form-row">
              <span>Minimum severity</span>
              <select data-destination-severity="${escapeHtml(key)}">
                ${SEVERITIES.map((severity) => {
                  const selected = (current.severity_minimum || "info") === severity ? "selected" : "";
                  return `<option value="${escapeHtml(severity)}" ${selected}>${escapeHtml(severityLabel(severity))}</option>`;
                }).join("")}
              </select>
            </label>
          </div>
        `;
      })
      .join("");
    el.destinationDefaults.innerHTML = items;
  }

  function renderDestinationCheckboxGroup(container, selectedKeys, datasetName) {
    if (!(container instanceof HTMLElement)) return;
    const selected = new Set(Array.isArray(selectedKeys) ? selectedKeys : []);
    const html = getDestinationKeys()
      .map((key) => {
        const checked = selected.has(key) ? "checked" : "";
        return `
          <label class="ss-analytics-alerts-inline-toggle">
            <input type="checkbox" data-${datasetName}="${escapeHtml(key)}" ${checked} />
            <span>${escapeHtml(destinationLabel(key))}</span>
          </label>
        `;
      })
      .join("");
    container.innerHTML = html;
  }

  function recommendedTemplateVariables(eventType) {
    const normalized = String(eventType || "").trim();
    return state.templateVariables.filter((item) => {
      const eventTypes = Array.isArray(item?.event_types) ? item.event_types : [];
      return eventTypes.includes(normalized);
    });
  }

  function renderTemplateVariableGroup(title, items) {
    if (!items.length) return "";
    const description = title === "Recommended for this alert type"
      ? "Start with the values most likely to be useful for this event."
      : (TEMPLATE_CATEGORY_HELP[title] || TEMPLATE_CATEGORY_HELP.Other);
    const sortedItems = sortTemplateVariables(items);
    return `
      <section class="ss-analytics-alerts-template-group">
        <div class="ss-analytics-alerts-template-group-header">
          <div class="ss-analytics-alerts-template-group-copy">
            <h6>${escapeHtml(title)}</h6>
            <p>${escapeHtml(description)}</p>
          </div>
          <span class="ss-alerts-template-group-count">${escapeHtml(String(sortedItems.length))}</span>
        </div>
        <div class="ss-analytics-alerts-template-grid">
          ${sortedItems.map((item) => `
            <button type="button" class="ss-analytics-alerts-template-button" data-template-token="${escapeHtml(item.token)}">
              <span class="ss-analytics-alerts-template-button-topline">
                <strong>${escapeHtml(item.label || item.key || item.token)}</strong>
                <code>${escapeHtml(item.token)}</code>
              </span>
              <span class="ss-analytics-alerts-template-button-copy">${escapeHtml(item.description || "")}</span>
            </button>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderTemplateBrowser() {
    if (!el.templateVariables || !el.templateHelp || !el.templateFocus) return;
    const syntax = state.templateSyntax || "{{variable_name}}";
    const missingText = state.templateMissingValuePolicy === "blank"
      ? "Missing values render blank."
      : "Missing payload values follow the backend missing-value policy.";
    const insertingIntoTitle = state.activeTemplateField === "title";
    el.templateHelp.textContent = `Use placeholders like ${syntax}. The backend fills them when the notification sends. ${missingText}`;
    el.templateFocus.textContent = insertingIntoTitle
      ? "Insert variables into the notification title while the title field stays in view."
      : "Insert variables into the notification message while the editor and placeholders stay side by side.";
    if (el.templateTargets) {
      el.templateTargets.querySelectorAll("[data-template-target]").forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        const isActive = button.getAttribute("data-template-target") === state.activeTemplateField;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    const recommended = recommendedTemplateVariables(el.ruleEventType?.value);
    const recommendedKeys = new Set(recommended.map((item) => item.key));
    const remaining = state.templateVariables.filter((item) => !recommendedKeys.has(item.key));
    const categories = Array.from(new Set(remaining.map((item) => item.category || "Other")))
      .sort((left, right) => {
        const leftIndex = TEMPLATE_CATEGORY_ORDER.indexOf(left);
        const rightIndex = TEMPLATE_CATEGORY_ORDER.indexOf(right);
        const normalizedLeft = leftIndex === -1 ? TEMPLATE_CATEGORY_ORDER.length : leftIndex;
        const normalizedRight = rightIndex === -1 ? TEMPLATE_CATEGORY_ORDER.length : rightIndex;
        if (normalizedLeft !== normalizedRight) return normalizedLeft - normalizedRight;
        return left.localeCompare(right);
      });
    const sections = [];
    if (recommended.length) {
      sections.push(renderTemplateVariableGroup("Recommended for this alert type", recommended));
    }
    categories.forEach((category) => {
      const items = remaining.filter((item) => (item.category || "Other") === category);
      sections.push(renderTemplateVariableGroup(category, items));
    });
    el.templateVariables.innerHTML = sections.join("") || "<p class=\"muted\">No placeholders are currently available from the backend.</p>";
  }

  function getActiveTemplateFieldElement() {
    return state.activeTemplateField === "title" ? el.ruleTitleTemplate : el.ruleBodyTemplate;
  }

  function updateTemplateFieldHighlight() {
    ["title", "body"].forEach((field) => {
      const wrapper = document.querySelector(`[data-template-field-wrapper="${field}"]`);
      if (!(wrapper instanceof HTMLElement)) return;
      const isActive = field === state.activeTemplateField;
      wrapper.classList.toggle("is-active-template-target", isActive);
    });
  }

  function setActiveTemplateField(field, options = {}) {
    state.activeTemplateField = field === "title" ? "title" : "body";
    if (options.focusField) {
      const target = getActiveTemplateFieldElement();
      if (target instanceof HTMLTextAreaElement) {
        target.focus();
      }
    }
    updateTemplateFieldHighlight();
    renderTemplateBrowser();
  }

  function insertTokenIntoActiveTemplate(token) {
    const target = getActiveTemplateFieldElement();
    if (!(target instanceof HTMLTextAreaElement)) return;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    const value = target.value || "";
    target.value = `${value.slice(0, start)}${token}${value.slice(end)}`;
    const nextPos = start + token.length;
    target.focus();
    target.setSelectionRange(nextPos, nextPos);
    renderRulePreview();
  }

  function renderPreferencesForm() {
    const preferences = state.preferences || {};
    if (el.masterEnabled) el.masterEnabled.checked = preferences.master_enabled !== false;
    if (el.quietHoursEnabled) el.quietHoursEnabled.checked = preferences.quiet_hours_enabled === true;
    if (el.quietStart) el.quietStart.value = preferences.quiet_hours_start || "22:00";
    if (el.quietEnd) el.quietEnd.value = preferences.quiet_hours_end || "07:00";
    if (el.timezone) el.timezone.value = preferences.timezone || "UTC";
    renderDestinationDefaults();
  }

  function renderEventTypeSelects() {
    renderSelectOptions(
      el.ruleEventType,
      state.eventTypes,
      (item) => item.key,
      (item) => item.label
    );
    renderSelectOptions(
      el.testEventType,
      state.eventTypes,
      (item) => item.key,
      (item) => item.label
    );
  }

  function renderTestRuleOptions() {
    renderSelectOptions(
      el.testRule,
      state.rules,
      (item) => item.id,
      (item) => `${item.name || item.event_type} (${item.enabled ? "enabled" : "disabled"})`,
      "Use matching rules"
    );
  }

  function renderTestDestinations() {
    const defaults = state.preferences?.destination_defaults || {};
    const selected = getDestinationKeys().filter((key) => defaults[key]?.enabled !== false);
    renderDestinationCheckboxGroup(el.testDestinations, selected, "testDestination");
  }

  function extractTemplateTokens(text) {
    return Array.from(
      new Set(String(text || "").match(/{{\s*[^}]+\s*}}/g) || [])
    );
  }

  function renderRulePreview() {
    const eventMeta = getEventMeta(el.ruleEventType?.value);
    const eventLabel = eventMeta?.label || labelize(el.ruleEventType?.value || "alert");
    const severity = severityLabel(el.ruleSeverity?.value || "info");
    const titleTemplate = String(el.ruleTitleTemplate?.value || "").trim();
    const bodyTemplate = String(el.ruleBodyTemplate?.value || "").trim();
    const ruleName = String(el.ruleName?.value || "").trim();
    const adminNotes = String(el.ruleDescription?.value || "").trim();
    const destinations = collectCheckedValues(
      el.ruleDestinations,
      "input[type='checkbox'][data-ruleDestination]",
      "data-ruleDestination"
    );
    const previewTitle = titleTemplate || ruleName || eventLabel || "Notification title preview";
    const previewMessage = bodyTemplate
      || adminNotes
      || eventMeta?.description
      || "The backend default message will be used for this alert.";
    const templateTokens = extractTemplateTokens(`${titleTemplate}\n${bodyTemplate}`);

    if (el.previewEvent) el.previewEvent.textContent = eventLabel;
    if (el.previewSeverity) el.previewSeverity.textContent = severity;
    if (el.previewTitleText) el.previewTitleText.textContent = previewTitle;
    if (el.previewMessageText) el.previewMessageText.textContent = previewMessage;
    if (el.previewDestinations) {
      el.previewDestinations.innerHTML = destinations.length
        ? destinations.map((item) => renderDestinationChip(item)).join("")
        : '<span class="muted">No destinations selected</span>';
    }
    if (el.previewNote) {
      if (templateTokens.length) {
        el.previewNote.textContent = `Placeholders used here will be filled by the backend: ${templateTokens.join(", ")}`;
      } else if (!titleTemplate && !bodyTemplate) {
        el.previewNote.textContent = "Leave the title or message blank to fall back to the backend default wording for this event.";
      } else {
        el.previewNote.textContent = "This preview reflects the current text fields. The backend will still attach live event values when the alert sends.";
      }
    }
  }

  function readScopeInputs() {
    const scope = {};
    const fields = el.ruleScopeBody?.querySelectorAll("[data-scope-field]") || [];
    fields.forEach((node) => {
      const field = String(node.getAttribute("data-scope-field") || "").trim();
      if (!field || !SCOPE_FIELD_ORDER.includes(field)) return;
      if (node instanceof HTMLInputElement && node.type === "checkbox") {
        if (node.checked) scope[field] = true;
        return;
      }
      const rawValue = node instanceof HTMLInputElement || node instanceof HTMLSelectElement ? node.value : "";
      const normalized = normalizeScopeValues({ [field]: rawValue });
      if (normalized[field] !== undefined) {
        scope[field] = normalized[field];
      }
    });
    return scope;
  }

  function updateScopeVisibility() {
    const enabled = el.ruleScopeEnabled?.checked === true;
    el.ruleScopeBody?.classList.toggle("hidden", !enabled);
  }

  function renderScopeField(field, value) {
    const config = SCOPE_FIELD_CONFIG[field];
    if (!config) return "";
    if (config.kind === "checkbox") {
      return `
        <label class="ss-analytics-alerts-inline-toggle ss-analytics-alerts-scope-flag">
          <input type="checkbox" data-scope-field="${escapeHtml(field)}" ${value === true ? "checked" : ""} />
          <span>${escapeHtml(config.label)}</span>
        </label>
      `;
    }
    if (config.kind === "select") {
      const options = getScopeSelectOptions(field, value)
        .map((option) => {
          const selected = String(value || "").toLowerCase() === option.toLowerCase() ? "selected" : "";
          const optionLabel = field === "surface"
            ? surfaceLabel(option)
            : field === "destination_type"
              ? destinationLabel(option)
              : labelize(option);
          return `<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(optionLabel)}</option>`;
        })
        .join("");
      return `
        <label class="ss-form-row">
          <span>${escapeHtml(config.label)}</span>
          <select data-scope-field="${escapeHtml(field)}">
            <option value="">Any</option>
            ${options}
          </select>
        </label>
      `;
    }
    return `
      <label class="ss-form-row">
        <span>${escapeHtml(config.label)}</span>
        <input
          type="text"
          data-scope-field="${escapeHtml(field)}"
          value="${escapeHtml(value || "")}"
          placeholder="${escapeHtml(config.placeholder || "")}"
          autocomplete="off"
        />
      </label>
    `;
  }

  function renderScopeEditor(scope) {
    if (!el.ruleScopeRecommended || !el.ruleScopeAdvanced || !el.ruleScopeHelper) return;
    const values = normalizeScopeValues(scope);
    const profile = getScopeProfile(el.ruleEventType?.value);
    el.ruleScopeHelper.textContent = profile.helper;
    el.ruleScopeRecommended.innerHTML = profile.recommended.map((field) => renderScopeField(field, values[field])).join("");
    el.ruleScopeAdvanced.innerHTML = profile.advanced.map((field) => renderScopeField(field, values[field])).join("");

    const warningNeeded = hasScopeValues(state.ruleScopePassthrough);
    if (el.ruleScopeWarning) {
      el.ruleScopeWarning.textContent = warningNeeded
        ? "This rule includes advanced scope data not shown in the structured editor. It will be preserved on save."
        : "";
      el.ruleScopeWarning.classList.toggle("hidden", !warningNeeded);
    }
    if (el.ruleScopeAdvancedDetails) {
      const hasAdvancedValues = profile.advanced.some((field) => values[field] !== undefined);
      el.ruleScopeAdvancedDetails.classList.toggle("hidden", !profile.advanced.length);
      el.ruleScopeAdvancedDetails.open = hasAdvancedValues || warningNeeded;
    }
  }

  function updateThresholdFieldVisibility() {
    const thresholdType = String(el.ruleThresholdType?.value || "count");
    el.ruleThresholdNumberRow?.classList.toggle("hidden", !["count", "rate"].includes(thresholdType));
    el.ruleThresholdStateRow?.classList.toggle("hidden", thresholdType !== "state");
    el.ruleThresholdCustomRow?.classList.toggle("hidden", thresholdType !== "custom");
    if (el.ruleThresholdNumber) {
      el.ruleThresholdNumber.step = thresholdType === "rate" ? "0.1" : "1";
    }
  }

  function setRuleFormMode(rule) {
    const isEditing = !!(rule && rule.id);
    state.activeRuleId = isEditing ? rule.id : null;
    if (el.ruleFormTitle) {
      el.ruleFormTitle.textContent = isEditing ? "Edit rule" : "Create rule";
    }
    el.ruleCancel?.classList.toggle("hidden", !isEditing);
  }

  function ensureRulesPageForRule(ruleId) {
    const ruleIndex = state.rules.findIndex((item) => item?.id === ruleId);
    if (ruleIndex < 0) return;
    state.rulesPage = Math.floor(ruleIndex / RULES_PAGE_SIZE) + 1;
  }

  function applyRuleDefaultsFromEventType(eventTypeKey) {
    const meta = getEventMeta(eventTypeKey);
    if (!meta) return;
    if (el.ruleSeverity) {
      el.ruleSeverity.value = meta.default_severity || "info";
    }
    if (el.ruleName && !el.ruleName.value.trim()) {
      el.ruleName.value = meta.label || labelize(eventTypeKey);
    }
    if (el.ruleDescription && !el.ruleDescription.value.trim()) {
      el.ruleDescription.value = meta.description || "";
    }
  }

  function applyScopeDefaultsFromEventType(eventTypeKey, incomingScope = {}) {
    const profile = getScopeProfile(eventTypeKey);
    const mergedScope = {
      ...normalizeScopeValues(incomingScope),
      ...Object.fromEntries(
        Object.entries(profile.defaults || {}).filter(([, value]) => value !== undefined && value !== null && value !== "")
      )
    };
    const shouldEnable = hasScopeValues(mergedScope) || profile.autoEnable;
    if (el.ruleScopeEnabled) {
      el.ruleScopeEnabled.checked = shouldEnable;
    }
    renderScopeEditor(mergedScope);
    updateScopeVisibility();
  }

  function populateRuleForm(rule) {
    const next = rule && typeof rule === "object" ? rule : null;
    setRuleFormMode(next);
    if (next?.id) {
      ensureRulesPageForRule(next.id);
    }
    state.ruleScopePassthrough = getPassthroughScope(next?.scope);
    if (el.ruleEventType) {
      el.ruleEventType.value = next?.event_type || state.eventTypes[0]?.key || "";
    }
    if (el.ruleSeverity) {
      el.ruleSeverity.value = next?.severity || getEventMeta(el.ruleEventType?.value)?.default_severity || "info";
    }
    if (el.ruleThresholdType) {
      el.ruleThresholdType.value = next?.threshold_type || "count";
    }
    if (el.ruleEnabled) {
      el.ruleEnabled.value = next?.enabled === false ? "false" : "true";
    }
    if (el.ruleName) {
      el.ruleName.value = next?.name || "";
    }
    if (el.ruleDescription) {
      el.ruleDescription.value = next?.description || "";
    }
    if (el.ruleTitleTemplate) {
      el.ruleTitleTemplate.value = next?.title_template || "";
    }
    if (el.ruleBodyTemplate) {
      el.ruleBodyTemplate.value = next?.body_template || "";
    }
    if (el.ruleThresholdNumber) {
      el.ruleThresholdNumber.value = ["count", "rate"].includes(next?.threshold_type)
        ? String(next?.threshold_value ?? 1)
        : "1";
    }
    if (el.ruleThresholdState) {
      el.ruleThresholdState.value = next?.threshold_value === false ? "false" : "true";
    }
    if (el.ruleThresholdCustom) {
      el.ruleThresholdCustom.value = next?.threshold_type === "custom" ? String(next?.threshold_value ?? "") : "";
    }
    if (el.ruleWindowMinutes) {
      el.ruleWindowMinutes.value = String(next?.window_minutes ?? 5);
    }
    if (el.ruleCooldownMinutes) {
      el.ruleCooldownMinutes.value = String(next?.cooldown_minutes ?? 15);
    }
    if (el.ruleDedupeWindowMinutes) {
      el.ruleDedupeWindowMinutes.value = String(next?.dedupe_window_minutes ?? 0);
    }
    renderDestinationCheckboxGroup(
      el.ruleDestinations,
      Array.isArray(next?.destinations) && next.destinations.length ? next.destinations : ["windows_client"],
      "ruleDestination"
    );
    updateThresholdFieldVisibility();
    if (next) {
      const scope = normalizeScopeValues(next.scope);
      if (el.ruleScopeEnabled) {
        el.ruleScopeEnabled.checked = hasScopeValues(scope);
      }
      renderScopeEditor(scope);
      updateScopeVisibility();
    } else {
      applyRuleDefaultsFromEventType(el.ruleEventType?.value);
      applyScopeDefaultsFromEventType(el.ruleEventType?.value);
    }
    updateTemplateFieldHighlight();
    renderTemplateBrowser();
    renderRulePreview();
    renderRulesList();
  }

  function scrollRuleEditorIntoView() {
    if (!(el.ruleForm instanceof HTMLElement)) return;
    if (window.innerWidth > 1180) return;
    el.ruleForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function buildPaginationMarkup(target, pageInfo) {
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
          data-pagination-target="${escapeHtml(target)}"
          data-pagination-page="${escapeHtml(String(page))}"
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
          data-pagination-target="${escapeHtml(target)}"
          data-pagination-page="${escapeHtml(String(pageInfo.currentPage - 1))}"
          ${pageInfo.currentPage <= 1 ? "disabled" : ""}
        >Prev</button>
        ${pageButtons.join("")}
        <button
          type="button"
          class="ss-alerts-pagination-button"
          data-pagination-target="${escapeHtml(target)}"
          data-pagination-page="${escapeHtml(String(pageInfo.currentPage + 1))}"
          ${pageInfo.currentPage >= pageInfo.totalPages ? "disabled" : ""}
        >Next</button>
      </div>
    `;
  }

  function renderPagination(container, target, pageInfo) {
    if (!(container instanceof HTMLElement)) return;
    const markup = buildPaginationMarkup(target, pageInfo);
    container.innerHTML = markup;
    container.classList.toggle("hidden", !markup);
  }

  function renderRulesList() {
    if (!el.rulesList || !el.rulesEmpty) return;
    const pageInfo = paginateItems(state.rules, state.rulesPage, RULES_PAGE_SIZE);
    state.rulesPage = pageInfo.currentPage;
    el.rulesList.classList.toggle("is-gallery", state.ruleView === "gallery");
    el.rulesList.classList.toggle("is-list", state.ruleView !== "gallery");
    el.rulesViewToggle?.querySelectorAll("[data-rules-view]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const isActive = button.getAttribute("data-rules-view") === state.ruleView;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    if (el.rulesCountChip) {
      el.rulesCountChip.textContent = state.rules.length
        ? `${pageInfo.startIndex + 1}-${pageInfo.endIndex} of ${state.rules.length}`
        : "0 rules";
    }
    if (!state.rules.length) {
      el.rulesList.innerHTML = "";
      el.rulesEmpty.classList.remove("hidden");
      if (el.rulesRailSummary) {
        el.rulesRailSummary.textContent = "Create the first rule to start building alerts.";
      }
      renderPagination(el.rulesPagination, "rules", pageInfo);
      return;
    }
    el.rulesEmpty.classList.add("hidden");
    if (el.rulesRailSummary) {
      const activeRule = state.rules.find((item) => item.id === state.activeRuleId);
      el.rulesRailSummary.textContent = activeRule
        ? `Editing "${activeRule.name || getEventMeta(activeRule.event_type)?.label || labelize(activeRule.event_type)}" below.`
        : state.ruleView === "gallery"
          ? "Showing a gallery of alert rules. Select a card to edit it below."
          : "Select a rule card to edit it in the workspace below.";
    }
    el.rulesList.innerHTML = pageInfo.items
      .map((rule) => {
        const eventMeta = getEventMeta(rule.event_type);
        const isActive = state.activeRuleId === rule.id;
        const severity = severityTone(rule.severity);
        const destinations = (Array.isArray(rule.destinations) ? rule.destinations : [])
          .map((item) => renderDestinationChip(item, "ss-alerts-destination-chip"))
          .join("");
        const scopeSummary = formatScopeSummary(rule.scope);
        return `
          <article
            class="ss-analytics-alerts-rule-card ss-alerts-rule-card--severity-${escapeHtml(severity)}${rule.enabled ? "" : " is-disabled"}${isActive ? " is-active" : ""}"
            data-rule-card-id="${escapeHtml(rule.id)}"
            role="button"
            tabindex="0"
            aria-pressed="${isActive ? "true" : "false"}"
          >
            <div class="ss-analytics-alerts-rule-header">
              <div>
                <h4 class="ss-analytics-alerts-rule-name">${escapeHtml(rule.name || eventMeta?.label || rule.event_type)}</h4>
                <div class="ss-analytics-alerts-rule-chips">
                  ${renderChip(eventMeta?.label || labelize(rule.event_type), { extraClasses: "ss-alerts-compact-chip" })}
                  ${renderChip(severityLabel(rule.severity), { extraClasses: `ss-alerts-rule-severity-chip ss-alerts-rule-severity-chip--${escapeHtml(severity)} ss-alerts-compact-chip` })}
                  ${renderChip(labelize(rule.threshold_type), { extraClasses: "ss-alerts-compact-chip" })}
                  ${renderChip(rule.enabled ? "Enabled" : "Disabled", { extraClasses: "ss-alerts-compact-chip" })}
                  ${isActive ? renderChip("Editing below", { tone: "warning", extraClasses: "ss-alerts-compact-chip" }) : ""}
                </div>
              </div>
              <div class="ss-analytics-alerts-rule-actions">
                <button type="button" class="ss-btn ss-btn-small ss-alerts-rule-action ss-alerts-rule-action-${rule.enabled ? "disable" : "enable"}" data-rule-action="toggle" data-rule-id="${escapeHtml(rule.id)}">
                  ${rule.enabled ? "Disable" : "Enable"}
                </button>
                <button type="button" class="ss-btn ss-btn-small ss-alerts-rule-action ss-alerts-rule-action-edit" data-rule-action="edit" data-rule-id="${escapeHtml(rule.id)}">Edit</button>
                <button type="button" class="ss-btn ss-btn-small ss-alerts-rule-action ss-alerts-rule-action-delete" data-rule-action="delete" data-rule-id="${escapeHtml(rule.id)}">Delete</button>
              </div>
            </div>
            ${destinations ? `<div class="ss-analytics-alerts-rule-chips">${destinations}</div>` : ""}
            ${rule.description ? `<p class="ss-analytics-alerts-rule-description">${escapeHtml(rule.description)}</p>` : ""}
            <p class="ss-analytics-alerts-rule-scope">Filters: ${escapeHtml(scopeSummary)}</p>
            <div class="ss-analytics-alerts-rule-meta">
              <span>Trigger: ${escapeHtml(String(rule.threshold_value))}</span>
              <span>Checks over: ${escapeHtml(String(rule.window_minutes))}m</span>
              <span>Re-alert after: ${escapeHtml(String(rule.cooldown_minutes))}m</span>
              <span>Duplicate window: ${escapeHtml(String(rule.dedupe_window_minutes ?? 0))}m</span>
              <span>Updated: ${escapeHtml(formatTimestamp(rule.updated_at))}</span>
            </div>
          </article>
        `;
      })
      .join("");
    renderPagination(el.rulesPagination, "rules", pageInfo);
  }

  function renderTargetsList() {
    if (!el.targetsList || !el.targetsEmpty) return;
    const filteredTargets = getFilteredTargets();
    renderTargetFilters();
    renderCollapsibleSummaries();
    if (state.targetsLoading) {
      el.targetsList.innerHTML = "";
      el.targetsEmpty.classList.add("hidden");
      updateTargetsState("Loading registered targets...");
      return;
    }
    if (state.targetsError) {
      el.targetsList.innerHTML = "";
      el.targetsEmpty.classList.add("hidden");
      updateTargetsState(state.targetsError);
      return;
    }
    if (!state.targets.length) {
      el.targetsList.innerHTML = "";
      el.targetsEmpty.classList.remove("hidden");
      el.targetsEmpty.textContent = "No registered delivery targets yet.";
      updateTargetsState("No registered delivery targets yet.");
      return;
    }
    if (!filteredTargets.length) {
      el.targetsList.innerHTML = "";
      el.targetsEmpty.classList.remove("hidden");
      el.targetsEmpty.textContent = "No registered targets match the current filters.";
      updateTargetsState("No targets match the selected filters.");
      return;
    }
    el.targetsEmpty.classList.add("hidden");
    el.targetsEmpty.textContent = "No registered delivery targets yet.";
    updateTargetsState(`${filteredTargets.length} target${filteredTargets.length === 1 ? "" : "s"} shown.`);
    el.targetsList.innerHTML = filteredTargets
      .map((target) => {
        const busy = state.targetActionIds.has(target.id);
        const statusTone = targetStatusTone(target.status);
        return `
          <article class="ss-analytics-alerts-target-card${target.enabled ? "" : " is-disabled"}${busy ? " is-busy" : ""}">
            <div class="ss-analytics-alerts-target-header">
              <div>
                <h4 class="ss-analytics-alerts-target-name">${escapeHtml(target.display_name || destinationLabel(target.device_type))}</h4>
                <div class="ss-analytics-alerts-target-chips">
                  ${renderDestinationChip(target.device_type, "ss-alerts-destination-chip")}
                  ${renderChip(target.status_label || labelize(target.status), { tone: statusTone, extraClasses: "ss-alerts-compact-chip" })}
                  ${renderChip(target.enabled ? "Enabled" : "Disabled", { extraClasses: "ss-alerts-compact-chip" })}
                </div>
              </div>
              <div class="ss-analytics-alerts-target-actions">
                <button type="button" class="ss-btn ss-btn-secondary ss-btn-small" data-target-action="rename-toggle" data-target-id="${escapeHtml(target.id)}" ${busy ? "disabled" : ""}>Rename</button>
                <button type="button" class="ss-btn ss-btn-secondary ss-btn-small" data-target-action="toggle" data-target-id="${escapeHtml(target.id)}" ${busy ? "disabled" : ""}>
                  ${target.enabled ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
            <div class="ss-analytics-alerts-target-identity">
              <span>Owner: ${escapeHtml(target.owner_display || "Unassigned")}</span>
              <span>Status: ${escapeHtml(target.connection_status || "unknown")}</span>
              ${target.metadata_summary ? `<span>${escapeHtml(target.metadata_summary)}</span>` : ""}
            </div>
            <div class="ss-analytics-alerts-target-meta">
              <span>Last seen: ${escapeHtml(formatTimestamp(target.last_seen_at))}</span>
              <span>Created: ${escapeHtml(formatTimestamp(target.created_at))}</span>
              <span>Updated: ${escapeHtml(formatTimestamp(target.updated_at))}</span>
            </div>
            <form class="ss-analytics-alerts-target-rename hidden" data-target-rename-form="${escapeHtml(target.id)}">
              <input type="text" maxlength="120" value="${escapeHtml(target.display_name || "")}" data-target-rename-input="${escapeHtml(target.id)}" ${busy ? "disabled" : ""} />
              <button type="submit" class="ss-btn ss-btn-primary ss-btn-small" ${busy ? "disabled" : ""}>Save</button>
              <button type="button" class="ss-btn ss-btn-secondary ss-btn-small" data-target-action="rename-cancel" data-target-id="${escapeHtml(target.id)}" ${busy ? "disabled" : ""}>Cancel</button>
            </form>
          </article>
        `;
      })
      .join("");
  }

  function buildHistoryStatus(entry) {
    if (entry?.suppressed_reason) return "Suppressed";
    if (Array.isArray(entry?.destinations_delivered) && entry.destinations_delivered.length) return "Delivered";
    if (entry?.delivered_at) return "Delivered";
    return "Pending";
  }

  function renderHistoryList() {
    if (!el.historyList || !el.historyEmpty) return;
    const limitedHistory = Array.isArray(state.history) ? state.history.slice(0, HISTORY_LIMIT) : [];
    const pageInfo = paginateItems(limitedHistory, state.historyPage, HISTORY_PAGE_SIZE);
    state.historyPage = pageInfo.currentPage;
    if (el.historySummary) {
      el.historySummary.textContent = limitedHistory.length
        ? `Showing ${pageInfo.startIndex + 1}-${pageInfo.endIndex} of ${limitedHistory.length}`
        : "Latest 50 entries";
    }
    if (state.historyError) {
      el.historyList.innerHTML = "";
      el.historyEmpty.textContent = state.historyError;
      el.historyEmpty.classList.remove("hidden");
      renderPagination(el.historyPagination, "history", pageInfo);
      return;
    }
    if (!limitedHistory.length) {
      el.historyList.innerHTML = "";
      el.historyEmpty.textContent = "No recent delivery history yet.";
      el.historyEmpty.classList.remove("hidden");
      renderPagination(el.historyPagination, "history", pageInfo);
      return;
    }
    el.historyEmpty.classList.add("hidden");
    el.historyList.innerHTML = pageInfo.items
      .map((entry) => {
        const status = buildHistoryStatus(entry);
        const severity = severityTone(entry?.severity);
        const statusTone = entry?.suppressed_reason ? "warning" : status === "Delivered" ? "success" : "muted";
        const destinations = (Array.isArray(entry.destinations_targeted) ? entry.destinations_targeted : [])
          .map((item) => renderDestinationChip(item, "ss-alerts-destination-chip"))
          .join("");
        const surfaceContext = renderAlertSurfaceContext(entry);
        const locationLabel = buildAlertLocationLabel(entry, { includeCountryWithCity: true });
        const pageContext = renderAlertPageContext(entry);
        const clientIp = normalizeClientIp(
          entry?.metadata?.template_context?.client_ip
          || entry?.payload_snapshot?.client_ip
          || entry?.payload_snapshot?.ip
        );
        const scopeSummary = entry?.metadata?.scope_summary
          || formatScopeSummary(entry?.metadata?.effective_scope || entry?.metadata?.rule_scope || {});
        return `
          <article class="ss-analytics-alerts-history-card ss-alerts-history-card--severity-${escapeHtml(severity)}${entry.suppressed_reason ? " is-suppressed" : ""}">
            <div class="ss-analytics-alerts-history-header">
              <div>
                <h4 class="ss-analytics-alerts-history-title">${escapeHtml(entry.title || labelize(entry.event_type))}</h4>
                <div class="ss-analytics-alerts-history-chips">
                  ${renderChip(labelize(entry.event_type), { extraClasses: "ss-alerts-compact-chip" })}
                  ${renderChip(severityLabel(entry.severity), { extraClasses: "ss-alerts-compact-chip" })}
                  ${renderChip(status, { tone: statusTone, extraClasses: "ss-analytics-alerts-history-status ss-alerts-compact-chip" })}
                </div>
              </div>
            </div>
            ${entry.message ? `<p class="ss-analytics-alerts-history-message">${escapeHtml(entry.message)}</p>` : ""}
            ${destinations ? `<div class="ss-analytics-alerts-history-chips">${destinations}</div>` : ""}
            ${surfaceContext}
            ${pageContext}
            ${locationLabel ? `<p class="ss-analytics-alerts-history-context">Location: ${escapeHtml(locationLabel)}</p>` : ""}
            ${clientIp ? `<p class="ss-analytics-alerts-history-context">Client IP: ${escapeHtml(clientIp)}</p>` : ""}
            ${scopeSummary ? `<p class="ss-analytics-alerts-history-context">Scope: ${escapeHtml(scopeSummary)}</p>` : ""}
            <div class="ss-analytics-alerts-history-meta">
              <span>Triggered: ${escapeHtml(formatTimestamp(entry.triggered_at))}</span>
              ${entry.suppressed_reason ? `<span>Suppression: ${escapeHtml(labelize(entry.suppressed_reason))}</span>` : ""}
              ${entry.rule_id ? `<span>Rule: ${escapeHtml(entry.rule_id)}</span>` : ""}
            </div>
          </article>
        `;
      })
      .join("");
    renderPagination(el.historyPagination, "history", pageInfo);
  }

  function renderAll() {
    renderPersistenceMeta();
    renderSummary();
    renderPreferencesForm();
    renderEventTypeSelects();
    renderTestRuleOptions();
    renderTestDestinations();
    renderCollapsibleSummaries();
    renderTemplateBrowser();
    renderRulePreview();
    renderRulesList();
    renderTargetsList();
    renderHistoryList();
    if (!state.activeRuleId && el.ruleForm && !el.ruleForm.dataset.initialized) {
      populateRuleForm(null);
      el.ruleForm.dataset.initialized = "true";
    }
    updateDirtyStateUi();
  }

  async function runWithLoader(task, reason, withLoader) {
    if (withLoader && window.StreamSuitesGlobalLoader?.trackAsync) {
      return window.StreamSuitesGlobalLoader.trackAsync(task, reason || "Loading alerts...");
    }
    return task();
  }

  async function refreshOperationalPanels(options = {}) {
    if (state.panelsPromise) return state.panelsPromise;
    state.panelsPromise = (async () => {
      state.targetsLoading = true;
      state.targetsError = "";
      state.historyError = "";
      renderTargetsList();
      renderHistoryList();
      try {
        const [settingsResult, targetsResult, historyResult] = await Promise.allSettled([
          window.StreamSuitesApi.getAdminAlertSettings({
            forceRefresh: options.forceRefresh === true
          }),
          window.StreamSuitesApi.getAdminAlertTargets({
            forceRefresh: options.forceRefresh === true
          }),
          window.StreamSuitesApi.getAdminAlertHistory(
            { limit: HISTORY_LIMIT },
            { forceRefresh: options.forceRefresh === true }
          )
        ]);

        const authError = [settingsResult, targetsResult, historyResult]
          .find((result) => result?.status === "rejected" && isAuthError(result.reason))
          ?.reason;
        if (authError) {
          state.targetsError = "Admin session required.";
          state.historyError = "Admin session required.";
          throw authError;
        }

        const settingsPayload = getSettledValue(settingsResult);
        if (settingsPayload) {
          state.settings = extractSettings(settingsPayload);
        }

        const targetsPayload = getSettledValue(targetsResult);
        if (targetsPayload) {
          state.targets = extractItems(targetsPayload).map(normalizeTarget);
          state.targetsError = "";
        } else {
          state.targetsError = getSettledError(targetsResult, "Unable to load alert targets.") || "Unable to load alert targets.";
        }

        const historyPayload = getSettledValue(historyResult);
        if (historyPayload) {
          state.history = extractItems(historyPayload).slice(0, HISTORY_LIMIT);
          state.historyError = "";
        } else {
          state.history = [];
          state.historyError = getSettledError(historyResult, "Unable to load alert history.") || "Unable to load alert history.";
        }

        renderSummary();
        renderTargetsList();
        renderHistoryList();
        renderPersistenceMeta();
      } finally {
        state.targetsLoading = false;
        state.panelsPromise = null;
        renderTargetsList();
        renderHistoryList();
      }
    })();
    return state.panelsPromise;
  }

  async function loadAlerting(options = {}) {
    if (state.loadPromise) return state.loadPromise;
    const token = ++state.loadToken;
    const task = async () => {
      clearBanner();
      setStatus("Loading alerts...");
      state.targetsLoading = true;
      state.targetsError = "";
      state.historyError = "";
      renderTargetsList();
      renderHistoryList();
      try {
        const [
          settingsResult,
          eventTypesResult,
          templateVariablesResult,
          configurationResult,
          targetsResult,
          historyResult
        ] = await Promise.allSettled([
          window.StreamSuitesApi.getAdminAlertSettings({
            forceRefresh: options.forceRefresh === true
          }),
          window.StreamSuitesApi.getAdminAlertEventTypes({
            forceRefresh: options.forceRefresh === true
          }),
          window.StreamSuitesApi.getAdminAlertTemplateVariables({
            forceRefresh: options.forceRefresh === true
          }),
          window.StreamSuitesApi.getAdminAlertConfiguration({
            forceRefresh: options.forceRefresh === true
          }),
          window.StreamSuitesApi.getAdminAlertTargets({
            forceRefresh: options.forceRefresh === true
          }),
          window.StreamSuitesApi.getAdminAlertHistory(
            { limit: HISTORY_LIMIT },
            { forceRefresh: options.forceRefresh === true }
          )
        ]);

        if (state.destroyed || token !== state.loadToken) return;

        const authError = [
          settingsResult,
          eventTypesResult,
          templateVariablesResult,
          configurationResult,
          targetsResult,
          historyResult
        ].find((result) => result?.status === "rejected" && isAuthError(result.reason))?.reason;
        if (authError) {
          state.targetsError = "Admin session required.";
          state.historyError = "Admin session required.";
          renderTargetsList();
          renderHistoryList();
          promptAdminReauth();
          setStatus("Admin session required");
          setBanner("Admin session required. Redirecting to login...");
          return;
        }

        const settingsPayload = getSettledValue(settingsResult);
        if (settingsPayload) {
          state.settings = extractSettings(settingsPayload);
        }

        const eventTypesPayload = getSettledValue(eventTypesResult);
        if (eventTypesPayload) {
          state.eventTypes = extractItems(eventTypesPayload);
        }

        const templateVariablesPayload = getSettledValue(templateVariablesResult);
        if (templateVariablesPayload) {
          state.templateVariables = extractItems(templateVariablesPayload);
          state.templateSyntax = String(templateVariablesPayload?.syntax || "{{variable_name}}").trim() || "{{variable_name}}";
          state.templateMissingValuePolicy = String(templateVariablesPayload?.missing_value_policy || "blank").trim() || "blank";
        }

        const configurationPayload = getSettledValue(configurationResult);
        if (configurationPayload) {
          const configuration = configurationPayload?.configuration && typeof configurationPayload.configuration === "object"
            ? configurationPayload.configuration
            : configurationPayload;
          setWorkingConfiguration({
            ...(configuration && typeof configuration === "object" ? configuration : {}),
            exported_at: configurationPayload?.generated_at || configuration?.exported_at || state.settings?.generated_at || null
          }, { syncCleanState: true });
        }

        const targetsPayload = getSettledValue(targetsResult);
        if (targetsPayload) {
          state.targets = extractItems(targetsPayload).map(normalizeTarget);
          state.targetsError = "";
        } else {
          state.targetsError = getSettledError(targetsResult, "Unable to load alert targets.") || "Unable to load alert targets.";
        }

        const historyPayload = getSettledValue(historyResult);
        if (historyPayload) {
          state.history = extractItems(historyPayload).slice(0, HISTORY_LIMIT);
          state.historyError = "";
        } else {
          state.history = [];
          state.historyError = getSettledError(historyResult, "Unable to load alert history.") || "Unable to load alert history.";
        }

        renderAll();
        const failureMessages = [
          getSettledError(settingsResult, "Unable to load alert settings."),
          getSettledError(eventTypesResult, "Unable to load alert event types."),
          getSettledError(templateVariablesResult, "Unable to load template variables."),
          getSettledError(configurationResult, "Unable to load alert configuration."),
          state.targetsError,
          state.historyError
        ].filter(Boolean);
        if (failureMessages.length) {
          setStatus("Alerts partially loaded");
          setBanner(failureMessages[0]);
        } else {
          setStatus("Alerts synced");
        }
      } finally {
        state.targetsLoading = false;
        renderTargetsList();
        renderHistoryList();
      }
    };
    state.loadPromise = runWithLoader(task, "Hydrating alerts...", options.withLoader === true)
      .finally(() => {
        state.loadPromise = null;
      });
    return state.loadPromise;
  }

  function collectCheckedValues(container, selector, attributeName) {
    if (!(container instanceof HTMLElement)) return [];
    return Array.from(container.querySelectorAll(selector))
      .filter((input) => input instanceof HTMLInputElement && input.checked)
      .map((input) => input.getAttribute(attributeName) || "")
      .filter(Boolean);
  }

  function readPreferencesPayload() {
    const destinationDefaults = {};
    getDestinationKeys().forEach((key) => {
      const enabledInput = el.destinationDefaults?.querySelector(`[data-destination-enabled="${key}"]`);
      const severitySelect = el.destinationDefaults?.querySelector(`[data-destination-severity="${key}"]`);
      destinationDefaults[key] = {
        enabled: enabledInput instanceof HTMLInputElement ? enabledInput.checked : true,
        severity_minimum: severitySelect instanceof HTMLSelectElement ? severitySelect.value : "info"
      };
    });
    return {
      master_enabled: el.masterEnabled?.checked === true,
      quiet_hours_enabled: el.quietHoursEnabled?.checked === true,
      quiet_hours_start: String(el.quietStart?.value || "22:00").trim() || "22:00",
      quiet_hours_end: String(el.quietEnd?.value || "07:00").trim() || "07:00",
      timezone: String(el.timezone?.value || "UTC").trim() || "UTC",
      destination_defaults: destinationDefaults
    };
  }

  function parseIntegerInput(input, fallback, minimum) {
    const parsed = Number.parseInt(String(input?.value || ""), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(minimum, parsed);
  }

  function parseThresholdValue(thresholdType) {
    if (thresholdType === "state") {
      return el.ruleThresholdState?.value !== "false";
    }
    if (thresholdType === "custom") {
      return String(el.ruleThresholdCustom?.value || "").trim();
    }
    return Number(String(el.ruleThresholdNumber?.value || "").trim());
  }

  function collectRulePayload() {
    const existingRule = state.activeRuleId
      ? state.rules.find((item) => item.id === state.activeRuleId) || null
      : null;
    const eventType = String(el.ruleEventType?.value || "").trim();
    const name = String(el.ruleName?.value || "").trim();
    const thresholdType = String(el.ruleThresholdType?.value || "count").trim();
    const thresholdValue = parseThresholdValue(thresholdType);
    const windowMinutes = parseIntegerInput(el.ruleWindowMinutes, 5, 1);
    const cooldownMinutes = parseIntegerInput(el.ruleCooldownMinutes, 15, 0);
    const dedupeWindowMinutes = parseIntegerInput(el.ruleDedupeWindowMinutes, 0, 0);
    const destinations = collectCheckedValues(
      el.ruleDestinations,
      "input[type='checkbox'][data-ruleDestination]",
      "data-ruleDestination"
    );
    const scopeEnabled = el.ruleScopeEnabled?.checked === true;
    const structuredScope = scopeEnabled ? readScopeInputs() : {};
    const scope = scopeEnabled
      ? {
          ...(cloneJson(state.ruleScopePassthrough || {}) || {}),
          ...structuredScope
        }
      : {};

    if (!eventType) {
      throw new Error("Select an event type.");
    }
    if (!name) {
      throw new Error("Rule name is required.");
    }
    if (thresholdType === "custom" && !String(thresholdValue || "").trim()) {
      throw new Error("Custom threshold value is required.");
    }
    if (thresholdType !== "custom" && thresholdType !== "state") {
      if (!Number.isFinite(thresholdValue) || thresholdValue < 0) {
        throw new Error("Threshold value must be a number greater than or equal to 0.");
      }
    }
    if (!destinations.length) {
      throw new Error("Select at least one destination.");
    }

    return {
      ...(cloneJson(existingRule) || {}),
      id: existingRule?.id || generateUuid(),
      event_type: eventType,
      enabled: el.ruleEnabled?.value !== "false",
      name,
      description: String(el.ruleDescription?.value || "").trim() || null,
      title_template: String(el.ruleTitleTemplate?.value || "").trim() || null,
      body_template: String(el.ruleBodyTemplate?.value || "").trim() || null,
      severity: String(el.ruleSeverity?.value || "info").trim(),
      threshold_type: thresholdType,
      threshold_value: thresholdValue,
      window_minutes: windowMinutes,
      cooldown_minutes: cooldownMinutes,
      dedupe_window_minutes: dedupeWindowMinutes,
      scope_mode: "all",
      scope,
      destinations
    };
  }

  async function handlePreferencesSubmit(event) {
    event.preventDefault();
    clearBanner();
    state.preferences = normalizePreferences(readPreferencesPayload());
    renderPreferencesForm();
    renderSummary();
    renderCollapsibleSummaries();
    renderPersistenceMeta();
    setStatus("Default delivery settings updated in the draft");
    setBanner("Default delivery changes are staged locally. Use Save changes to persist them to the backend.", "success");
  }

  function handlePreferencesDraftChange() {
    state.preferences = normalizePreferences(readPreferencesPayload());
    renderSummary();
    renderCollapsibleSummaries();
    renderPersistenceMeta();
    setStatus(hasUnsavedChanges() ? "Default delivery changes pending" : "Alerts synced");
  }

  async function handleRuleSubmit(event) {
    event.preventDefault();
    clearBanner();
    try {
      const payload = collectRulePayload();
      const index = state.rules.findIndex((item) => item.id === payload.id);
      if (index >= 0) {
        state.rules.splice(index, 1, payload);
        ensureRulesPageForRule(payload.id);
      } else {
        state.rules.unshift(payload);
        state.rulesPage = 1;
      }
      populateRuleForm(null);
      renderRulesList();
      renderTestRuleOptions();
      renderSummary();
      renderPersistenceMeta();
      setStatus(index >= 0 ? "Rule updated in the draft" : "Rule added to the draft");
      setBanner("Rule changes are staged locally. Use Save changes to persist them to the backend.", "success");
    } catch (err) {
      setStatus("Rule draft failed");
      setBanner(err?.message || "Unable to stage alert rule changes.");
    }
  }

  async function handleTestSubmit(event) {
    event.preventDefault();
    clearBanner();
    setStatus("Sending test notification...");
    el.testSubmit.disabled = true;
    try {
      const selectedDestinations = collectCheckedValues(
        el.testDestinations,
        "input[type='checkbox'][data-testDestination]",
        "data-testDestination"
      );
      const payload = {
        event_type: String(el.testEventType?.value || "").trim() || "runtime_error_spike",
        rule_id: String(el.testRule?.value || "").trim() || undefined,
        title: String(el.testTitle?.value || "").trim() || undefined,
        message: String(el.testMessage?.value || "").trim() || undefined,
        severity: String(el.testSeverity?.value || "").trim() || undefined,
        metric_value: Number(String(el.testMetricValue?.value || "9999").trim()) || 9999,
        force: el.testForce?.checked === true
      };
      if (selectedDestinations.length) {
        payload.destinations = selectedDestinations;
      }
      const response = await window.StreamSuitesApi.triggerAdminTestAlert(payload);
      const result = response?.result && typeof response.result === "object" ? response.result : {};
      const matchedRules = Number(result.matched_rules) || 0;
      setStatus(`Test notification sent (${matchedRules} rule match${matchedRules === 1 ? "" : "es"})`);
      await refreshOperationalPanels({ forceRefresh: true });
    } catch (err) {
      setStatus("Test notification failed");
      setBanner(err?.message || "Unable to trigger the test notification.");
    } finally {
      el.testSubmit.disabled = false;
    }
  }

  function handleRulesListClick(event) {
    const button = event.target.closest("[data-rule-action][data-rule-id]");
    if (button instanceof HTMLButtonElement) {
      const ruleId = String(button.getAttribute("data-rule-id") || "").trim();
      const action = String(button.getAttribute("data-rule-action") || "").trim();
      const rule = state.rules.find((item) => item.id === ruleId);
      if (!rule) return;

      clearBanner();
      try {
        if (action === "edit") {
          populateRuleForm(rule);
          el.ruleName?.focus();
          scrollRuleEditorIntoView();
          setStatus("Editing working-copy rule");
          return;
        }
        if (action === "toggle") {
          rule.enabled = !rule.enabled;
          renderRulesList();
          renderSummary();
          renderPersistenceMeta();
          setStatus("Rule status updated in the draft");
          setBanner("Rule status is staged locally. Use Save changes to persist it to the backend.", "success");
          return;
        }
        if (action === "delete") {
          if (!window.confirm(`Delete alert rule "${rule.name || rule.event_type}"?`)) {
            return;
          }
          state.rules = state.rules.filter((item) => item.id !== ruleId);
          if (state.activeRuleId === ruleId) {
            populateRuleForm(null);
          }
          renderRulesList();
          renderTestRuleOptions();
          renderSummary();
          renderPersistenceMeta();
          setStatus("Rule removed from the draft");
          setBanner("Rule removal is staged locally. Use Save changes to persist it to the backend.", "success");
        }
      } catch (err) {
        setStatus("Rule action failed");
        setBanner(err?.message || "Unable to update working-copy rule.");
      }
      return;
    }

    const card = event.target.closest("[data-rule-card-id]");
    if (!(card instanceof HTMLElement)) return;
    const ruleId = String(card.getAttribute("data-rule-card-id") || "").trim();
    const rule = state.rules.find((item) => item.id === ruleId);
    if (!rule) return;
    populateRuleForm(rule);
    setStatus("Editing working-copy rule");
    scrollRuleEditorIntoView();
  }

  function handleRulesListKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.closest("[data-rule-action]")) return;
    const card = event.target.closest("[data-rule-card-id]");
    if (!(card instanceof HTMLElement)) return;
    event.preventDefault();
    const ruleId = String(card.getAttribute("data-rule-card-id") || "").trim();
    const rule = state.rules.find((item) => item.id === ruleId);
    if (!rule) return;
    populateRuleForm(rule);
    setStatus("Editing working-copy rule");
    scrollRuleEditorIntoView();
  }

  function handleRulesViewToggle(event) {
    const button = event.target.closest("[data-rules-view]");
    if (!(button instanceof HTMLButtonElement)) return;
    const nextView = String(button.getAttribute("data-rules-view") || "").trim();
    if (!nextView || state.ruleView === nextView) return;
    state.ruleView = nextView === "gallery" ? "gallery" : "list";
    renderRulesList();
  }

  function handlePaginationClick(event) {
    const button = event.target.closest("[data-pagination-target][data-pagination-page]");
    if (!(button instanceof HTMLButtonElement)) return;
    const target = String(button.getAttribute("data-pagination-target") || "").trim();
    const nextPage = Number.parseInt(String(button.getAttribute("data-pagination-page") || ""), 10);
    if (!Number.isFinite(nextPage)) return;
    if (target === "rules") {
      state.rulesPage = nextPage;
      renderRulesList();
      return;
    }
    if (target === "history") {
      state.historyPage = nextPage;
      renderHistoryList();
    }
  }

  async function handleTargetsListClick(event) {
    const button = event.target.closest("[data-target-action][data-target-id]");
    if (!(button instanceof HTMLButtonElement)) return;
    const targetId = String(button.getAttribute("data-target-id") || "").trim();
    const action = String(button.getAttribute("data-target-action") || "").trim();
    const target = state.targets.find((item) => item.id === targetId);
    if (!target) return;

    if (action === "rename-toggle" || action === "rename-cancel") {
      const form = el.targetsList?.querySelector(`[data-target-rename-form="${escapeSelectorValue(targetId)}"]`);
      if (form) {
        form.classList.toggle("hidden", action === "rename-cancel" ? true : !form.classList.contains("hidden"));
      }
      return;
    }
    if (action !== "toggle") return;

    clearBanner();
    state.targetActionIds.add(targetId);
    renderTargetsList();
    try {
      await window.StreamSuitesApi.updateAdminAlertTarget(targetId, {
        device_type: target.device_type,
        display_name: target.display_name,
        enabled: !target.enabled,
        owner_account_id: target.owner_account_id || undefined,
        owner_user_code: target.owner_user_code || undefined,
        last_seen_at: target.last_seen_at || undefined,
        metadata: target.metadata || {}
      });
      setStatus("Target updated");
      await refreshOperationalPanels({ forceRefresh: true });
    } catch (err) {
      setStatus("Target update failed");
      setBanner(err?.message || "Unable to update alert target.");
    } finally {
      state.targetActionIds.delete(targetId);
      renderTargetsList();
    }
  }

  async function handleTargetRenameSubmit(event) {
    const form = event.target.closest("[data-target-rename-form]");
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();

    const targetId = String(form.getAttribute("data-target-rename-form") || "").trim();
    const target = state.targets.find((item) => item.id === targetId);
    const input = form.querySelector(`[data-target-rename-input="${escapeSelectorValue(targetId)}"]`);
    if (!target || !(input instanceof HTMLInputElement)) return;

    const nextName = String(input.value || "").trim();
    if (!nextName) {
      setStatus("Target rename failed");
      setBanner("Display name is required.");
      input.focus();
      return;
    }

    clearBanner();
    state.targetActionIds.add(targetId);
    renderTargetsList();
    try {
      await window.StreamSuitesApi.updateAdminAlertTarget(targetId, {
        device_type: target.device_type,
        display_name: nextName,
        enabled: target.enabled,
        owner_account_id: target.owner_account_id || undefined,
        owner_user_code: target.owner_user_code || undefined,
        last_seen_at: target.last_seen_at || undefined,
        metadata: target.metadata || {}
      });
      setStatus("Target renamed");
      await refreshOperationalPanels({ forceRefresh: true });
    } catch (err) {
      setStatus("Target rename failed");
      setBanner(err?.message || "Unable to rename alert target.");
    } finally {
      state.targetActionIds.delete(targetId);
      renderTargetsList();
    }
  }

  function handleTargetFilterChange() {
    state.targetFilters.type = String(el.targetsTypeFilter?.value || "").trim();
    state.targetFilters.status = String(el.targetsStatusFilter?.value || "").trim();
    renderTargetsList();
  }

  function handleRuleEventTypeChange() {
    const currentScope = readScopeInputs();
    if (!state.activeRuleId) {
      applyRuleDefaultsFromEventType(el.ruleEventType?.value);
      const profile = getScopeProfile(el.ruleEventType?.value);
      const mergedScope = { ...currentScope };
      Object.entries(profile.defaults || {}).forEach(([key, value]) => {
        if (mergedScope[key] === undefined || mergedScope[key] === null || mergedScope[key] === "") {
          mergedScope[key] = value;
        }
      });
      if (el.ruleScopeEnabled && !el.ruleScopeEnabled.checked && profile.autoEnable && !hasScopeValues(currentScope)) {
        el.ruleScopeEnabled.checked = true;
      }
      renderScopeEditor(mergedScope);
      updateScopeVisibility();
      renderTemplateBrowser();
      return;
    }
    renderScopeEditor(currentScope);
    updateScopeVisibility();
    renderTemplateBrowser();
  }

  function handleRuleScopeToggle() {
    if (el.ruleScopeEnabled?.checked) {
      const currentScope = readScopeInputs();
      if (!hasScopeValues(currentScope) && !state.activeRuleId) {
        const profile = getScopeProfile(el.ruleEventType?.value);
        renderScopeEditor({ ...currentScope, ...profile.defaults });
      }
    }
    updateScopeVisibility();
  }

  function handleTemplateFieldFocus(event) {
    if (event.target === el.ruleTitleTemplate) {
      setActiveTemplateField("title");
    } else if (event.target === el.ruleBodyTemplate) {
      setActiveTemplateField("body");
    } else {
      return;
    }
  }

  function handleTemplateTargetClick(event) {
    const button = event.target.closest("[data-template-target]");
    if (!(button instanceof HTMLButtonElement)) return;
    const field = String(button.getAttribute("data-template-target") || "").trim();
    if (!field) return;
    setActiveTemplateField(field, { focusField: true });
  }

  function handleTemplateVariableClick(event) {
    const button = event.target.closest("[data-template-token]");
    if (!(button instanceof HTMLButtonElement)) return;
    const token = String(button.getAttribute("data-template-token") || "").trim();
    if (!token) return;
    insertTokenIntoActiveTemplate(token);
  }

  function confirmDiscardUnsavedChanges(actionLabel) {
    if (!hasUnsavedChanges()) return true;
    return window.confirm(
      `${actionLabel} will discard the current unsaved alert working copy. Continue?`
    );
  }

  function handleRefreshAll() {
    if (!confirmDiscardUnsavedChanges("Reloading the backend copy")) {
      setStatus("Reload cancelled");
      return;
    }
    void loadAlerting({ forceRefresh: true, withLoader: false });
  }

  function handleNewRuleClick() {
    populateRuleForm(null);
    setStatus("Creating rule");
    el.ruleName?.focus();
  }

  function handleCancelRuleEdit() {
    populateRuleForm(null);
    setStatus("Rule edit cancelled");
  }

  async function handleConfigurationSave() {
    if (!hasUnsavedChanges()) {
      setStatus("No alert changes to save");
      return;
    }
    clearBanner();
    setStatus("Saving alert configuration...");
    if (el.configSave) el.configSave.disabled = true;
    try {
      const response = await window.StreamSuitesApi.updateAdminAlertConfiguration(buildConfigurationSnapshot());
      const configuration = response?.configuration && typeof response.configuration === "object"
        ? response.configuration
        : response;
      setWorkingConfiguration({
        ...(configuration && typeof configuration === "object" ? configuration : {}),
        exported_at: response?.generated_at || configuration?.exported_at || new Date().toISOString()
      }, { syncCleanState: true });
      renderAll();
      setStatus("Alert changes saved");
      setBanner("Alert draft saved to the backend successfully.", "success");
      await loadAlerting({ forceRefresh: true, withLoader: false });
    } catch (err) {
      setStatus("Alert save failed");
      setBanner(err?.message || "Unable to save the alert draft to the backend.");
    } finally {
      updateDirtyStateUi();
    }
  }

  function triggerConfigExport() {
    clearBanner();
    try {
      const payload = {
        ...buildConfigurationSnapshot(),
        exported_at: new Date().toISOString(),
        source: "dashboard_admin"
      };
      const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `streamsuites-alert-config-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Alert backup exported");
      setBanner("Alert backup exported successfully.", "success");
    } catch (err) {
      setStatus("Alert export failed");
      setBanner(err?.message || "Unable to export the alert backup JSON.");
    }
  }

  function handleConfigImportClick() {
    el.configImportFile?.click();
  }

  async function handleConfigImportFileChange(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files?.length) return;
    const file = input.files[0];
    clearBanner();
    try {
      if (!confirmDiscardUnsavedChanges("Importing a backup")) {
        input.value = "";
        setStatus("Import cancelled");
        return;
      }
      const text = await file.text();
      const parsed = JSON.parse(text);
      const configuration = normalizeImportedConfigurationDocument(parsed);
      const summary = `${file.name}: ${configuration.rules.length} rule${configuration.rules.length === 1 ? "" : "s"}, timezone ${configuration.preferences.timezone || "UTC"}`;
      if (!window.confirm(`Stage imported ruleset?\n\n${summary}\n\nUse Save changes to persist it to the backend.`)) {
        input.value = "";
        setStatus("Import cancelled");
        return;
      }
      setWorkingConfiguration({
        ...configuration,
        exported_at: state.configuration?.exported_at || state.settings?.generated_at || null
      }, { importedSummary: summary });
      renderAll();
      setStatus("Alert backup imported into draft");
      setBanner("Imported alert draft staged locally. Review it, then use Save changes to persist it.", "success");
    } catch (err) {
      setStatus("Alert import failed");
      setBanner(err?.message || "Unable to import the alert backup JSON.");
    } finally {
      input.value = "";
    }
  }

  function handleBeforeUnload(event) {
    if (!hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = "";
  }

  function bindEvents() {
    el.configReload?.addEventListener("click", handleRefreshAll);
    el.configSave?.addEventListener("click", handleConfigurationSave);
    el.configExport?.addEventListener("click", triggerConfigExport);
    el.configImport?.addEventListener("click", handleConfigImportClick);
    el.configImportFile?.addEventListener("change", handleConfigImportFileChange);
    el.preferencesForm?.addEventListener("submit", handlePreferencesSubmit);
    el.preferencesForm?.addEventListener("change", handlePreferencesDraftChange);
    el.testForm?.addEventListener("submit", handleTestSubmit);
    el.testForm?.addEventListener("input", renderCollapsibleSummaries);
    el.testForm?.addEventListener("change", renderCollapsibleSummaries);
    el.rulesRefresh?.addEventListener("click", handleRefreshAll);
    el.rulesCreate?.addEventListener("click", handleNewRuleClick);
    el.ruleCancel?.addEventListener("click", handleCancelRuleEdit);
    el.ruleForm?.addEventListener("submit", handleRuleSubmit);
    el.ruleForm?.addEventListener("input", renderRulePreview);
    el.ruleForm?.addEventListener("change", renderRulePreview);
    el.ruleThresholdType?.addEventListener("change", updateThresholdFieldVisibility);
    el.ruleEventType?.addEventListener("change", handleRuleEventTypeChange);
    el.ruleScopeEnabled?.addEventListener("change", handleRuleScopeToggle);
    el.ruleTitleTemplate?.addEventListener("focus", handleTemplateFieldFocus);
    el.ruleBodyTemplate?.addEventListener("focus", handleTemplateFieldFocus);
    el.templateTargets?.addEventListener("click", handleTemplateTargetClick);
    el.templateVariables?.addEventListener("click", handleTemplateVariableClick);
    el.rulesViewToggle?.addEventListener("click", handleRulesViewToggle);
    el.rulesList?.addEventListener("click", handleRulesListClick);
    el.rulesList?.addEventListener("keydown", handleRulesListKeydown);
    el.rulesPagination?.addEventListener("click", handlePaginationClick);
    el.targetsList?.addEventListener("click", handleTargetsListClick);
    el.targetsList?.addEventListener("submit", handleTargetRenameSubmit);
    el.targetsRefresh?.addEventListener("click", handleRefreshAll);
    el.targetsTypeFilter?.addEventListener("change", handleTargetFilterChange);
    el.targetsStatusFilter?.addEventListener("change", handleTargetFilterChange);
    el.historyRefresh?.addEventListener("click", handleRefreshAll);
    el.historyPagination?.addEventListener("click", handlePaginationClick);
    window.addEventListener("beforeunload", handleBeforeUnload);
  }

  function unbindEvents() {
    el.configReload?.removeEventListener("click", handleRefreshAll);
    el.configSave?.removeEventListener("click", handleConfigurationSave);
    el.configExport?.removeEventListener("click", triggerConfigExport);
    el.configImport?.removeEventListener("click", handleConfigImportClick);
    el.configImportFile?.removeEventListener("change", handleConfigImportFileChange);
    el.preferencesForm?.removeEventListener("submit", handlePreferencesSubmit);
    el.preferencesForm?.removeEventListener("change", handlePreferencesDraftChange);
    el.testForm?.removeEventListener("submit", handleTestSubmit);
    el.testForm?.removeEventListener("input", renderCollapsibleSummaries);
    el.testForm?.removeEventListener("change", renderCollapsibleSummaries);
    el.rulesRefresh?.removeEventListener("click", handleRefreshAll);
    el.rulesCreate?.removeEventListener("click", handleNewRuleClick);
    el.ruleCancel?.removeEventListener("click", handleCancelRuleEdit);
    el.ruleForm?.removeEventListener("submit", handleRuleSubmit);
    el.ruleForm?.removeEventListener("input", renderRulePreview);
    el.ruleForm?.removeEventListener("change", renderRulePreview);
    el.ruleThresholdType?.removeEventListener("change", updateThresholdFieldVisibility);
    el.ruleEventType?.removeEventListener("change", handleRuleEventTypeChange);
    el.ruleScopeEnabled?.removeEventListener("change", handleRuleScopeToggle);
    el.ruleTitleTemplate?.removeEventListener("focus", handleTemplateFieldFocus);
    el.ruleBodyTemplate?.removeEventListener("focus", handleTemplateFieldFocus);
    el.templateTargets?.removeEventListener("click", handleTemplateTargetClick);
    el.templateVariables?.removeEventListener("click", handleTemplateVariableClick);
    el.rulesViewToggle?.removeEventListener("click", handleRulesViewToggle);
    el.rulesList?.removeEventListener("click", handleRulesListClick);
    el.rulesList?.removeEventListener("keydown", handleRulesListKeydown);
    el.rulesPagination?.removeEventListener("click", handlePaginationClick);
    el.targetsList?.removeEventListener("click", handleTargetsListClick);
    el.targetsList?.removeEventListener("submit", handleTargetRenameSubmit);
    el.targetsRefresh?.removeEventListener("click", handleRefreshAll);
    el.targetsTypeFilter?.removeEventListener("change", handleTargetFilterChange);
    el.targetsStatusFilter?.removeEventListener("change", handleTargetFilterChange);
    el.historyRefresh?.removeEventListener("click", handleRefreshAll);
    el.historyPagination?.removeEventListener("click", handlePaginationClick);
    window.removeEventListener("beforeunload", handleBeforeUnload);
  }

  function bindElements() {
    el.root = document.getElementById("alerts-page-root")
      || document.getElementById("analytics-alerting-title")?.closest(".ss-analytics-alerts-panel")
      || null;
    el.dirtyIndicator = $("analytics-alerts-dirty-indicator");
    el.status = $("analytics-alerts-status");
    el.banner = $("analytics-alerts-banner");
    el.configReload = $("analytics-alerts-config-reload");
    el.configSave = $("analytics-alerts-config-save");
    el.configExport = $("analytics-alerts-config-export");
    el.configImport = $("analytics-alerts-config-import");
    el.configImportFile = $("analytics-alerts-config-import-file");
    el.configState = $("analytics-alerts-config-state");
    el.configDetail = $("analytics-alerts-config-detail");
    el.configSchema = $("analytics-alerts-config-schema");
    el.configSource = $("analytics-alerts-config-source");
    el.configSynced = $("analytics-alerts-config-synced");
    el.configImported = $("analytics-alerts-config-imported");
    el.configWorkingRules = $("analytics-alerts-config-working-rules");
    el.configWorkingPreferences = $("analytics-alerts-config-working-preferences");
    el.summaryStatus = $("analytics-alerts-summary-status");
    el.summaryStatusDetail = $("analytics-alerts-summary-status-detail");
    el.summaryRules = $("analytics-alerts-summary-rules");
    el.summaryEnabledRules = $("analytics-alerts-summary-enabled-rules");
    el.summaryTargets = $("analytics-alerts-summary-targets");
    el.summaryTargetsEnabled = $("analytics-alerts-summary-targets-enabled");
    el.summaryHistory = $("analytics-alerts-summary-history");
    el.summarySubscribers = $("analytics-alerts-summary-subscribers");
    el.preferencesForm = $("analytics-alerts-preferences-form");
    el.masterEnabled = $("analytics-alerts-master-enabled");
    el.quietHoursEnabled = $("analytics-alerts-quiet-hours-enabled");
    el.quietStart = $("analytics-alerts-quiet-start");
    el.quietEnd = $("analytics-alerts-quiet-end");
    el.timezone = $("analytics-alerts-timezone");
    el.destinationDefaults = $("analytics-alerts-destination-defaults");
    el.preferencesSave = $("analytics-alerts-preferences-save");
    el.testForm = $("analytics-alerts-test-form");
    el.testEventType = $("analytics-alerts-test-event-type");
    el.testSeverity = $("analytics-alerts-test-severity");
    el.testMetricValue = $("analytics-alerts-test-metric-value");
    el.testRule = $("analytics-alerts-test-rule");
    el.testTitle = $("analytics-alerts-test-title-input");
    el.testMessage = $("analytics-alerts-test-message");
    el.testDestinations = $("analytics-alerts-test-destinations");
    el.testForce = $("analytics-alerts-test-force");
    el.testSubmit = $("analytics-alerts-test-submit");
    el.rulesRefresh = $("analytics-alerts-rules-refresh");
    el.rulesCreate = $("analytics-alerts-rule-create");
    el.ruleForm = $("analytics-alerts-rule-form");
    el.ruleFormTitle = $("analytics-alerts-rule-form-title");
    el.ruleCancel = $("analytics-alerts-rule-cancel");
    el.ruleSave = $("analytics-alerts-rule-save");
    el.ruleEventType = $("analytics-alerts-rule-event-type");
    el.ruleSeverity = $("analytics-alerts-rule-severity");
    el.ruleThresholdType = $("analytics-alerts-rule-threshold-type");
    el.ruleEnabled = $("analytics-alerts-rule-enabled");
    el.ruleName = $("analytics-alerts-rule-name");
    el.ruleDescription = $("analytics-alerts-rule-description");
    el.ruleTitleTemplate = $("analytics-alerts-rule-title-template");
    el.ruleBodyTemplate = $("analytics-alerts-rule-body-template");
    el.templateHelp = $("analytics-alerts-template-help");
    el.templateFocus = $("analytics-alerts-template-focus");
    el.templateTargets = $("analytics-alerts-template-targets");
    el.templateVariables = $("analytics-alerts-template-variables");
    el.previewEvent = $("analytics-alerts-preview-event");
    el.previewSeverity = $("analytics-alerts-preview-severity");
    el.previewTitleText = $("analytics-alerts-preview-title-text");
    el.previewMessageText = $("analytics-alerts-preview-message-text");
    el.previewDestinations = $("analytics-alerts-preview-destinations");
    el.previewNote = $("analytics-alerts-preview-note");
    el.ruleThresholdNumberRow = $("analytics-alerts-rule-threshold-number-row");
    el.ruleThresholdNumber = $("analytics-alerts-rule-threshold-number");
    el.ruleThresholdStateRow = $("analytics-alerts-rule-threshold-state-row");
    el.ruleThresholdState = $("analytics-alerts-rule-threshold-state");
    el.ruleThresholdCustomRow = $("analytics-alerts-rule-threshold-custom-row");
    el.ruleThresholdCustom = $("analytics-alerts-rule-threshold-custom");
    el.ruleWindowMinutes = $("analytics-alerts-rule-window-minutes");
    el.ruleCooldownMinutes = $("analytics-alerts-rule-cooldown-minutes");
    el.ruleDedupeWindowMinutes = $("analytics-alerts-rule-dedupe-window-minutes");
    el.ruleScopeEnabled = $("analytics-alerts-rule-scope-enabled");
    el.ruleScopeBody = $("analytics-alerts-rule-scope-body");
    el.ruleScopeHelper = $("analytics-alerts-rule-scope-helper");
    el.ruleScopeWarning = $("analytics-alerts-rule-scope-warning");
    el.ruleScopeRecommended = $("analytics-alerts-rule-scope-recommended");
    el.ruleScopeAdvancedDetails = $("analytics-alerts-rule-scope-advanced-details");
    el.ruleScopeAdvanced = $("analytics-alerts-rule-scope-advanced");
    el.ruleDestinations = $("analytics-alerts-rule-destinations");
    el.rulesList = $("analytics-alerts-rules-list");
    el.rulesRailSummary = $("analytics-alerts-rules-rail-summary");
    el.rulesCountChip = $("analytics-alerts-rules-count-chip");
    el.rulesEmpty = $("analytics-alerts-rules-empty");
    el.rulesPagination = $("analytics-alerts-rules-pagination");
    el.rulesViewToggle = $("analytics-alerts-rules-view-toggle");
    el.targetsRefresh = $("analytics-alerts-targets-refresh");
    el.targetsTypeFilter = $("analytics-alerts-targets-type-filter");
    el.targetsStatusFilter = $("analytics-alerts-targets-status-filter");
    el.targetsState = $("analytics-alerts-targets-state");
    el.targetsList = $("analytics-alerts-targets-list");
    el.targetsEmpty = $("analytics-alerts-targets-empty");
    el.targetsSummaryMeta = $("analytics-alerts-targets-summary-meta");
    el.targetsSummaryDetail = $("analytics-alerts-targets-summary-detail");
    el.historyRefresh = $("analytics-alerts-history-refresh");
    el.historyList = $("analytics-alerts-history-list");
    el.historyEmpty = $("analytics-alerts-history-empty");
    el.historyPagination = $("analytics-alerts-history-pagination");
    el.historySummary = $("analytics-alerts-history-summary");
    el.preferencesSummaryMeta = $("analytics-alerts-preferences-summary-meta");
    el.preferencesSummaryDetail = $("analytics-alerts-preferences-summary-detail");
    el.testSummaryMeta = $("analytics-alerts-test-summary-meta");
    el.testSummaryDetail = $("analytics-alerts-test-summary-detail");
  }

  function clearElementReferences() {
    Object.keys(el).forEach((key) => {
      el[key] = null;
    });
  }

  function init() {
    state.destroyed = false;
    bindElements();
    if (!el.root || !window.StreamSuitesApi) return;
    bindEvents();
    populateRuleForm(null);
    void loadAlerting({ forceRefresh: true, withLoader: false });
  }

  function destroy() {
    state.destroyed = true;
    unbindEvents();
    clearElementReferences();
  }

  window.StreamSuitesAnalyticsAlerting = {
    init,
    destroy
  };
  })();

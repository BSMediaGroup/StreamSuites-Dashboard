(() => {
  "use strict";

  const DEFAULT_DESTINATIONS = ["windows_client", "pushover"];
  const HISTORY_LIMIT = 12;
  const SEVERITIES = ["info", "warning", "error", "critical"];
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

  const state = {
    destroyed: false,
    eventTypes: [],
    configuration: null,
    lastSavedConfigurationHash: "",
    lastImportedSummary: "",
    preferences: null,
    rules: [],
    targets: [],
    history: [],
    settings: null,
    activeRuleId: null,
    loadToken: 0,
    ruleScopePassthrough: {}
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
    summaryRules: null,
    summaryEnabledRules: null,
    summaryTargets: null,
    summaryTargetsEnabled: null,
    summaryHistory: null,
    summarySubscribers: null,
    summaryTimezone: null,
    summaryGenerated: null,
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
    rulesEmpty: null,
    targetsRefresh: null,
    targetsList: null,
    targetsEmpty: null,
    historyRefresh: null,
    historyList: null,
    historyEmpty: null
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
    if (normalized.surface) parts.push(`surface=${normalized.surface}`);
    if (normalized.destination_type) parts.push(`destination=${normalized.destination_type}`);
    return parts.join(" + ");
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
      ["public", "admin", "auth-controls", "self_service"].forEach((item) => options.add(item));
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

  function severityLabel(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "warning" ? "Warning" : labelize(normalized || "info");
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
    if (!el.banner) return;
    const text = String(message || "").trim();
    el.banner.textContent = text;
    el.banner.className = `ss-alert ss-alert-${tone}${text ? "" : " hidden"}`;
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
      el.dirtyIndicator.textContent = dirty ? "Unsaved changes" : "Clean";
      el.dirtyIndicator.classList.toggle("is-dirty", dirty);
    }
    if (el.configState) {
      el.configState.textContent = dirty ? "Unsaved edits" : "Clean";
    }
    if (el.configDetail) {
      el.configDetail.textContent = dirty
        ? "Reloading will discard the current working copy until you save/apply it."
        : "Working copy matches the backend-authored configuration.";
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

    if (el.summaryRules) el.summaryRules.textContent = String(state.rules.length);
    if (el.summaryEnabledRules) el.summaryEnabledRules.textContent = `${enabledRules} enabled`;
    if (el.summaryTargets) el.summaryTargets.textContent = String(summaryTargets);
    if (el.summaryTargetsEnabled) el.summaryTargetsEnabled.textContent = `${enabledTargets} enabled`;
    if (el.summaryHistory) el.summaryHistory.textContent = String(historyTotal);
    if (el.summarySubscribers) {
      el.summarySubscribers.textContent = `${Number(settings?.active_stream_subscribers) || 0} live subscribers`;
    }
    if (el.summaryTimezone) el.summaryTimezone.textContent = timezone;
    if (el.summaryGenerated) {
      el.summaryGenerated.textContent = formatTimestamp(settings?.generated_at || null);
    }
  }

  function renderPersistenceMeta() {
    if (el.configSchema) {
      el.configSchema.textContent = state.configuration?.schema_version || "--";
    }
    if (el.configSource) {
      el.configSource.textContent = state.configuration?.source
        ? `Source: ${state.configuration.source}`
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
          return `<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(labelize(option))}</option>`;
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
  }

  function renderRulesList() {
    if (!el.rulesList || !el.rulesEmpty) return;
    if (!state.rules.length) {
      el.rulesList.innerHTML = "";
      el.rulesEmpty.classList.remove("hidden");
      return;
    }
    el.rulesEmpty.classList.add("hidden");
    el.rulesList.innerHTML = state.rules
      .map((rule) => {
        const eventMeta = getEventMeta(rule.event_type);
        const destinations = (Array.isArray(rule.destinations) ? rule.destinations : [])
          .map((item) => `<span class="ss-chip">${escapeHtml(destinationLabel(item))}</span>`)
          .join("");
        const scopeSummary = formatScopeSummary(rule.scope);
        return `
          <article class="ss-analytics-alerts-rule-card${rule.enabled ? "" : " is-disabled"}">
            <div class="ss-analytics-alerts-rule-header">
              <div>
                <h4 class="ss-analytics-alerts-rule-name">${escapeHtml(rule.name || eventMeta?.label || rule.event_type)}</h4>
                <div class="ss-analytics-alerts-rule-chips">
                  <span class="ss-chip">${escapeHtml(eventMeta?.label || labelize(rule.event_type))}</span>
                  <span class="ss-chip">${escapeHtml(severityLabel(rule.severity))}</span>
                  <span class="ss-chip">${escapeHtml(labelize(rule.threshold_type))}</span>
                  <span class="ss-chip">${escapeHtml(rule.enabled ? "Enabled" : "Disabled")}</span>
                </div>
              </div>
              <div class="ss-analytics-alerts-rule-actions">
                <button type="button" class="ss-btn ss-btn-secondary ss-btn-small" data-rule-action="toggle" data-rule-id="${escapeHtml(rule.id)}">
                  ${rule.enabled ? "Disable" : "Enable"}
                </button>
                <button type="button" class="ss-btn ss-btn-secondary ss-btn-small" data-rule-action="edit" data-rule-id="${escapeHtml(rule.id)}">Edit</button>
                <button type="button" class="ss-btn ss-btn-secondary ss-btn-small" data-rule-action="delete" data-rule-id="${escapeHtml(rule.id)}">Delete</button>
              </div>
            </div>
            ${destinations ? `<div class="ss-analytics-alerts-rule-chips">${destinations}</div>` : ""}
            ${rule.description ? `<p class="ss-analytics-alerts-rule-description">${escapeHtml(rule.description)}</p>` : ""}
            <p class="ss-analytics-alerts-rule-scope">Scope: ${escapeHtml(scopeSummary)}</p>
            <div class="ss-analytics-alerts-rule-meta">
              <span>Threshold: ${escapeHtml(String(rule.threshold_value))}</span>
              <span>Window: ${escapeHtml(String(rule.window_minutes))}m</span>
              <span>Cooldown: ${escapeHtml(String(rule.cooldown_minutes))}m</span>
              <span>Dedupe: ${escapeHtml(String(rule.dedupe_window_minutes ?? 0))}m</span>
              <span>Updated: ${escapeHtml(formatTimestamp(rule.updated_at))}</span>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderTargetsList() {
    if (!el.targetsList || !el.targetsEmpty) return;
    if (!state.targets.length) {
      el.targetsList.innerHTML = "";
      el.targetsEmpty.classList.remove("hidden");
      return;
    }
    el.targetsEmpty.classList.add("hidden");
    el.targetsList.innerHTML = state.targets
      .map((target) => {
        const ownerBits = [target.owner_user_code, target.owner_account_id].filter(Boolean);
        return `
          <article class="ss-analytics-alerts-target-card${target.enabled ? "" : " is-disabled"}">
            <div class="ss-analytics-alerts-target-header">
              <div>
                <h4 class="ss-analytics-alerts-target-name">${escapeHtml(target.display_name || destinationLabel(target.device_type))}</h4>
                <div class="ss-analytics-alerts-target-chips">
                  <span class="ss-chip">${escapeHtml(destinationLabel(target.device_type))}</span>
                  <span class="ss-chip">${escapeHtml(target.enabled ? "Enabled" : "Disabled")}</span>
                </div>
              </div>
              <button type="button" class="ss-btn ss-btn-secondary ss-btn-small" data-target-action="toggle" data-target-id="${escapeHtml(target.id)}">
                ${target.enabled ? "Disable" : "Enable"}
              </button>
            </div>
            <p class="ss-analytics-alerts-target-owner">${escapeHtml(ownerBits.length ? `Owner: ${ownerBits.join(" / ")}` : "Owner: unassigned")}</p>
            <div class="ss-analytics-alerts-target-meta">
              <span>Last seen: ${escapeHtml(formatTimestamp(target.last_seen_at))}</span>
              <span>Updated: ${escapeHtml(formatTimestamp(target.updated_at))}</span>
            </div>
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
    if (!state.history.length) {
      el.historyList.innerHTML = "";
      el.historyEmpty.classList.remove("hidden");
      return;
    }
    el.historyEmpty.classList.add("hidden");
    el.historyList.innerHTML = state.history
      .map((entry) => {
        const status = buildHistoryStatus(entry);
        const destinations = (Array.isArray(entry.destinations_targeted) ? entry.destinations_targeted : [])
          .map((item) => `<span class="ss-chip">${escapeHtml(destinationLabel(item))}</span>`)
          .join("");
        const scopeSummary = entry?.metadata?.scope_summary
          || formatScopeSummary(entry?.metadata?.effective_scope || entry?.metadata?.rule_scope || {});
        return `
          <article class="ss-analytics-alerts-history-card${entry.suppressed_reason ? " is-suppressed" : ""}">
            <div class="ss-analytics-alerts-history-header">
              <div>
                <h4 class="ss-analytics-alerts-history-title">${escapeHtml(entry.title || labelize(entry.event_type))}</h4>
                <div class="ss-analytics-alerts-history-chips">
                  <span class="ss-chip">${escapeHtml(labelize(entry.event_type))}</span>
                  <span class="ss-chip">${escapeHtml(severityLabel(entry.severity))}</span>
                  <span class="ss-chip ss-analytics-alerts-history-status">${escapeHtml(status)}</span>
                </div>
              </div>
            </div>
            ${entry.message ? `<p class="ss-analytics-alerts-history-message">${escapeHtml(entry.message)}</p>` : ""}
            ${destinations ? `<div class="ss-analytics-alerts-history-chips">${destinations}</div>` : ""}
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
  }

  function renderAll() {
    renderPersistenceMeta();
    renderSummary();
    renderPreferencesForm();
    renderEventTypeSelects();
    renderTestRuleOptions();
    renderTestDestinations();
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
      return window.StreamSuitesGlobalLoader.trackAsync(task, reason || "Loading alerting...");
    }
    return task();
  }

  async function refreshOperationalPanels(options = {}) {
    const [settingsPayload, targetsPayload, historyPayload] = await Promise.all([
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
    state.settings = extractSettings(settingsPayload);
    state.targets = extractItems(targetsPayload);
    state.history = extractItems(historyPayload);
    renderSummary();
    renderTargetsList();
    renderHistoryList();
    renderPersistenceMeta();
  }

  async function loadAlerting(options = {}) {
    const token = ++state.loadToken;
    const task = async () => {
      clearBanner();
      setStatus("Loading alerting...");
      try {
        const [settingsPayload, eventTypesPayload, configurationPayload, targetsPayload, historyPayload] =
          await Promise.all([
            window.StreamSuitesApi.getAdminAlertSettings({
              forceRefresh: options.forceRefresh === true
            }),
            window.StreamSuitesApi.getAdminAlertEventTypes({
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

        state.settings = extractSettings(settingsPayload);
        state.eventTypes = extractItems(eventTypesPayload);
        const configuration = configurationPayload?.configuration && typeof configurationPayload.configuration === "object"
          ? configurationPayload.configuration
          : configurationPayload;
        setWorkingConfiguration({
          ...(configuration && typeof configuration === "object" ? configuration : {}),
          exported_at: configurationPayload?.generated_at || configuration?.exported_at || state.settings?.generated_at || null
        }, { syncCleanState: true });
        state.targets = extractItems(targetsPayload);
        state.history = extractItems(historyPayload);
        renderAll();
        setStatus("Alerting synced");
      } catch (err) {
        if (err?.status === 401 || err?.status === 403 || err?.isAuthError) {
          promptAdminReauth();
          setStatus("Admin session required");
          setBanner("Admin session required. Redirecting to login...");
          return;
        }
        setStatus("Alerting unavailable");
        setBanner(err?.message || "Unable to load alerting controls.");
      }
    };
    return runWithLoader(task, "Hydrating alerting controls...", options.withLoader === true);
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
    renderPersistenceMeta();
    setStatus("Preferences updated in working copy");
    setBanner("Preference edits are staged locally. Use Save / Apply to persist them to the backend.", "success");
  }

  function handlePreferencesDraftChange() {
    state.preferences = normalizePreferences(readPreferencesPayload());
    renderSummary();
    renderPersistenceMeta();
    setStatus(hasUnsavedChanges() ? "Preference edits pending" : "Alerting synced");
  }

  async function handleRuleSubmit(event) {
    event.preventDefault();
    clearBanner();
    try {
      const payload = collectRulePayload();
      const index = state.rules.findIndex((item) => item.id === payload.id);
      if (index >= 0) {
        state.rules.splice(index, 1, payload);
      } else {
        state.rules.unshift(payload);
      }
      populateRuleForm(null);
      renderRulesList();
      renderTestRuleOptions();
      renderSummary();
      renderPersistenceMeta();
      setStatus(index >= 0 ? "Rule updated in working copy" : "Rule added to working copy");
      setBanner("Rule edits are staged locally. Use Save / Apply to persist them to the backend.", "success");
    } catch (err) {
      setStatus("Rule draft failed");
      setBanner(err?.message || "Unable to stage alert rule changes.");
    }
  }

  async function handleTestSubmit(event) {
    event.preventDefault();
    clearBanner();
    setStatus("Sending test alert...");
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
      setStatus(`Test alert sent (${matchedRules} rule match${matchedRules === 1 ? "" : "es"})`);
      await refreshOperationalPanels({ forceRefresh: true });
    } catch (err) {
      setStatus("Test alert failed");
      setBanner(err?.message || "Unable to trigger test alert.");
    } finally {
      el.testSubmit.disabled = false;
    }
  }

  function handleRulesListClick(event) {
    const button = event.target.closest("[data-rule-action][data-rule-id]");
    if (!(button instanceof HTMLButtonElement)) return;
    const ruleId = String(button.getAttribute("data-rule-id") || "").trim();
    const action = String(button.getAttribute("data-rule-action") || "").trim();
    const rule = state.rules.find((item) => item.id === ruleId);
    if (!rule) return;

    clearBanner();
    try {
      if (action === "edit") {
        populateRuleForm(rule);
        el.ruleName?.focus();
        setStatus("Editing working-copy rule");
        return;
      }
      if (action === "toggle") {
        rule.enabled = !rule.enabled;
        renderRulesList();
        renderSummary();
        renderPersistenceMeta();
        setStatus("Rule enabled state updated in working copy");
        setBanner("Rule toggle is staged locally. Use Save / Apply to persist it to the backend.", "success");
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
        setStatus("Rule removed from working copy");
        setBanner("Rule removal is staged locally. Use Save / Apply to persist it to the backend.", "success");
      }
    } catch (err) {
      setStatus("Rule action failed");
      setBanner(err?.message || "Unable to update working-copy rule.");
    }
  }

  async function handleTargetsListClick(event) {
    const button = event.target.closest("[data-target-action][data-target-id]");
    if (!(button instanceof HTMLButtonElement)) return;
    const targetId = String(button.getAttribute("data-target-id") || "").trim();
    const target = state.targets.find((item) => item.id === targetId);
    if (!target) return;

    clearBanner();
    button.disabled = true;
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
      button.disabled = false;
    }
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
      return;
    }
    renderScopeEditor(currentScope);
    updateScopeVisibility();
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

  function confirmDiscardUnsavedChanges(actionLabel) {
    if (!hasUnsavedChanges()) return true;
    return window.confirm(
      `${actionLabel} will discard the current unsaved alert working copy. Continue?`
    );
  }

  function handleRefreshAll() {
    if (!confirmDiscardUnsavedChanges("Reloading from backend")) {
      setStatus("Reload cancelled");
      return;
    }
    void loadAlerting({ forceRefresh: true, withLoader: false });
  }

  function handleNewRuleClick() {
    populateRuleForm(null);
    setStatus("Creating new rule");
    el.ruleName?.focus();
  }

  function handleCancelRuleEdit() {
    populateRuleForm(null);
    setStatus("Rule edit cancelled");
  }

  async function handleConfigurationSave() {
    if (!hasUnsavedChanges()) {
      setStatus("No alert config changes to save");
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
      setStatus("Alert configuration saved");
      setBanner("Alert ruleset saved to the backend successfully.", "success");
      await loadAlerting({ forceRefresh: true, withLoader: false });
    } catch (err) {
      setStatus("Alert configuration save failed");
      setBanner(err?.message || "Unable to save the alert ruleset to the backend.");
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
      setStatus("Alert configuration exported");
      setBanner("Alert ruleset JSON exported successfully.", "success");
    } catch (err) {
      setStatus("Alert configuration export failed");
      setBanner(err?.message || "Unable to export the alert ruleset JSON.");
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
      if (!confirmDiscardUnsavedChanges("Importing a ruleset")) {
        input.value = "";
        setStatus("Import cancelled");
        return;
      }
      const text = await file.text();
      const parsed = JSON.parse(text);
      const configuration = normalizeImportedConfigurationDocument(parsed);
      const summary = `${file.name}: ${configuration.rules.length} rule${configuration.rules.length === 1 ? "" : "s"}, timezone ${configuration.preferences.timezone || "UTC"}`;
      if (!window.confirm(`Stage imported ruleset?\n\n${summary}\n\nUse Save / Apply to persist it to the backend.`)) {
        input.value = "";
        setStatus("Import cancelled");
        return;
      }
      setWorkingConfiguration({
        ...configuration,
        exported_at: state.configuration?.exported_at || state.settings?.generated_at || null
      }, { importedSummary: summary });
      renderAll();
      setStatus("Alert ruleset imported into working copy");
      setBanner("Imported alert ruleset staged locally. Review it, then use Save / Apply to persist it.", "success");
    } catch (err) {
      setStatus("Alert ruleset import failed");
      setBanner(err?.message || "Unable to import the alert ruleset JSON.");
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
    el.rulesRefresh?.addEventListener("click", handleRefreshAll);
    el.rulesCreate?.addEventListener("click", handleNewRuleClick);
    el.ruleCancel?.addEventListener("click", handleCancelRuleEdit);
    el.ruleForm?.addEventListener("submit", handleRuleSubmit);
    el.ruleThresholdType?.addEventListener("change", updateThresholdFieldVisibility);
    el.ruleEventType?.addEventListener("change", handleRuleEventTypeChange);
    el.ruleScopeEnabled?.addEventListener("change", handleRuleScopeToggle);
    el.rulesList?.addEventListener("click", handleRulesListClick);
    el.targetsList?.addEventListener("click", handleTargetsListClick);
    el.targetsRefresh?.addEventListener("click", handleRefreshAll);
    el.historyRefresh?.addEventListener("click", handleRefreshAll);
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
    el.rulesRefresh?.removeEventListener("click", handleRefreshAll);
    el.rulesCreate?.removeEventListener("click", handleNewRuleClick);
    el.ruleCancel?.removeEventListener("click", handleCancelRuleEdit);
    el.ruleForm?.removeEventListener("submit", handleRuleSubmit);
    el.ruleThresholdType?.removeEventListener("change", updateThresholdFieldVisibility);
    el.ruleEventType?.removeEventListener("change", handleRuleEventTypeChange);
    el.ruleScopeEnabled?.removeEventListener("change", handleRuleScopeToggle);
    el.rulesList?.removeEventListener("click", handleRulesListClick);
    el.targetsList?.removeEventListener("click", handleTargetsListClick);
    el.targetsRefresh?.removeEventListener("click", handleRefreshAll);
    el.historyRefresh?.removeEventListener("click", handleRefreshAll);
    window.removeEventListener("beforeunload", handleBeforeUnload);
  }

  function bindElements() {
    el.root = document.getElementById("analytics-alerting-title")?.closest(".ss-analytics-alerts-panel") || null;
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
    el.summaryRules = $("analytics-alerts-summary-rules");
    el.summaryEnabledRules = $("analytics-alerts-summary-enabled-rules");
    el.summaryTargets = $("analytics-alerts-summary-targets");
    el.summaryTargetsEnabled = $("analytics-alerts-summary-targets-enabled");
    el.summaryHistory = $("analytics-alerts-summary-history");
    el.summarySubscribers = $("analytics-alerts-summary-subscribers");
    el.summaryTimezone = $("analytics-alerts-summary-timezone");
    el.summaryGenerated = $("analytics-alerts-summary-generated");
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
    el.rulesEmpty = $("analytics-alerts-rules-empty");
    el.targetsRefresh = $("analytics-alerts-targets-refresh");
    el.targetsList = $("analytics-alerts-targets-list");
    el.targetsEmpty = $("analytics-alerts-targets-empty");
    el.historyRefresh = $("analytics-alerts-history-refresh");
    el.historyList = $("analytics-alerts-history-list");
    el.historyEmpty = $("analytics-alerts-history-empty");
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

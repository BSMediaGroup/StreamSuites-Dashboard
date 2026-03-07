(() => {
  "use strict";

  const DEFAULT_DESTINATIONS = ["windows_client", "pushover"];
  const HISTORY_LIMIT = 12;
  const SEVERITIES = ["info", "warning", "error", "critical"];

  const state = {
    destroyed: false,
    eventTypes: [],
    preferences: null,
    rules: [],
    targets: [],
    history: [],
    settings: null,
    activeRuleId: null,
    loadToken: 0
  };

  const el = {
    root: null,
    refreshAll: null,
    status: null,
    banner: null,
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

  function populateRuleForm(rule) {
    const next = rule && typeof rule === "object" ? rule : null;
    setRuleFormMode(next);
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
    renderDestinationCheckboxGroup(
      el.ruleDestinations,
      Array.isArray(next?.destinations) && next.destinations.length ? next.destinations : ["windows_client"],
      "ruleDestination"
    );
    updateThresholdFieldVisibility();
    if (!next) {
      applyRuleDefaultsFromEventType(el.ruleEventType?.value);
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
            <div class="ss-analytics-alerts-rule-meta">
              <span>Threshold: ${escapeHtml(String(rule.threshold_value))}</span>
              <span>Window: ${escapeHtml(String(rule.window_minutes))}m</span>
              <span>Cooldown: ${escapeHtml(String(rule.cooldown_minutes))}m</span>
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
  }

  async function runWithLoader(task, reason, withLoader) {
    if (withLoader && window.StreamSuitesGlobalLoader?.trackAsync) {
      return window.StreamSuitesGlobalLoader.trackAsync(task, reason || "Loading alerting...");
    }
    return task();
  }

  async function loadAlerting(options = {}) {
    const token = ++state.loadToken;
    const task = async () => {
      clearBanner();
      setStatus("Loading alerting...");
      try {
        const [settingsPayload, eventTypesPayload, preferencesPayload, rulesPayload, targetsPayload, historyPayload] =
          await Promise.all([
            window.StreamSuitesApi.getAdminAlertSettings({
              forceRefresh: options.forceRefresh === true
            }),
            window.StreamSuitesApi.getAdminAlertEventTypes({
              forceRefresh: options.forceRefresh === true
            }),
            window.StreamSuitesApi.getAdminAlertPreferences({
              forceRefresh: options.forceRefresh === true
            }),
            window.StreamSuitesApi.getAdminAlertRules({
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
        state.preferences = extractPreferences(preferencesPayload) || state.settings.preferences || {};
        state.rules = extractItems(rulesPayload);
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
    const eventType = String(el.ruleEventType?.value || "").trim();
    const name = String(el.ruleName?.value || "").trim();
    const thresholdType = String(el.ruleThresholdType?.value || "count").trim();
    const thresholdValue = parseThresholdValue(thresholdType);
    const windowMinutes = parseIntegerInput(el.ruleWindowMinutes, 5, 1);
    const cooldownMinutes = parseIntegerInput(el.ruleCooldownMinutes, 15, 0);
    const destinations = collectCheckedValues(
      el.ruleDestinations,
      "input[type='checkbox'][data-ruleDestination]",
      "data-ruleDestination"
    );

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
      event_type: eventType,
      enabled: el.ruleEnabled?.value !== "false",
      name,
      description: String(el.ruleDescription?.value || "").trim() || null,
      severity: String(el.ruleSeverity?.value || "info").trim(),
      threshold_type: thresholdType,
      threshold_value: thresholdValue,
      window_minutes: windowMinutes,
      cooldown_minutes: cooldownMinutes,
      destinations
    };
  }

  async function handlePreferencesSubmit(event) {
    event.preventDefault();
    clearBanner();
    setStatus("Saving preferences...");
    el.preferencesSave.disabled = true;
    try {
      const payload = readPreferencesPayload();
      const response = await window.StreamSuitesApi.updateAdminAlertPreferences(payload);
      state.preferences = extractPreferences(response) || payload;
      renderPreferencesForm();
      renderSummary();
      setStatus("Preferences saved");
      await loadAlerting({ forceRefresh: true, withLoader: false });
    } catch (err) {
      setStatus("Preferences save failed");
      setBanner(err?.message || "Unable to save alert preferences.");
    } finally {
      el.preferencesSave.disabled = false;
    }
  }

  async function handleRuleSubmit(event) {
    event.preventDefault();
    clearBanner();
    setStatus(state.activeRuleId ? "Saving rule..." : "Creating rule...");
    el.ruleSave.disabled = true;
    try {
      const payload = collectRulePayload();
      const response = state.activeRuleId
        ? await window.StreamSuitesApi.updateAdminAlertRule(state.activeRuleId, payload)
        : await window.StreamSuitesApi.createAdminAlertRule(payload);
      const savedRule = response?.rule && typeof response.rule === "object" ? response.rule : null;
      if (savedRule) {
        const index = state.rules.findIndex((item) => item.id === savedRule.id);
        if (index >= 0) {
          state.rules.splice(index, 1, savedRule);
        } else {
          state.rules.unshift(savedRule);
        }
      }
      populateRuleForm(null);
      renderRulesList();
      renderTestRuleOptions();
      setStatus("Rule saved");
      await loadAlerting({ forceRefresh: true, withLoader: false });
    } catch (err) {
      setStatus("Rule save failed");
      setBanner(err?.message || "Unable to save alert rule.");
    } finally {
      el.ruleSave.disabled = false;
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
      await loadAlerting({ forceRefresh: true, withLoader: false });
    } catch (err) {
      setStatus("Test alert failed");
      setBanner(err?.message || "Unable to trigger test alert.");
    } finally {
      el.testSubmit.disabled = false;
    }
  }

  async function handleRulesListClick(event) {
    const button = event.target.closest("[data-rule-action][data-rule-id]");
    if (!(button instanceof HTMLButtonElement)) return;
    const ruleId = String(button.getAttribute("data-rule-id") || "").trim();
    const action = String(button.getAttribute("data-rule-action") || "").trim();
    const rule = state.rules.find((item) => item.id === ruleId);
    if (!rule) return;

    clearBanner();
    button.disabled = true;
    try {
      if (action === "edit") {
        populateRuleForm(rule);
        el.ruleName?.focus();
        setStatus("Editing rule");
        return;
      }
      if (action === "toggle") {
        await window.StreamSuitesApi.setAdminAlertRuleEnabled(ruleId, !rule.enabled);
        setStatus("Rule updated");
        await loadAlerting({ forceRefresh: true, withLoader: false });
        return;
      }
      if (action === "delete") {
        if (!window.confirm(`Delete alert rule "${rule.name || rule.event_type}"?`)) {
          return;
        }
        await window.StreamSuitesApi.deleteAdminAlertRule(ruleId);
        if (state.activeRuleId === ruleId) {
          populateRuleForm(null);
        }
        setStatus("Rule deleted");
        await loadAlerting({ forceRefresh: true, withLoader: false });
      }
    } catch (err) {
      setStatus("Rule action failed");
      setBanner(err?.message || "Unable to update alert rule.");
    } finally {
      button.disabled = false;
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
      await loadAlerting({ forceRefresh: true, withLoader: false });
    } catch (err) {
      setStatus("Target update failed");
      setBanner(err?.message || "Unable to update alert target.");
    } finally {
      button.disabled = false;
    }
  }

  function handleRuleEventTypeChange() {
    if (state.activeRuleId) return;
    applyRuleDefaultsFromEventType(el.ruleEventType?.value);
  }

  function handleRefreshAll() {
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

  function bindEvents() {
    el.refreshAll?.addEventListener("click", handleRefreshAll);
    el.preferencesForm?.addEventListener("submit", handlePreferencesSubmit);
    el.testForm?.addEventListener("submit", handleTestSubmit);
    el.rulesRefresh?.addEventListener("click", handleRefreshAll);
    el.rulesCreate?.addEventListener("click", handleNewRuleClick);
    el.ruleCancel?.addEventListener("click", handleCancelRuleEdit);
    el.ruleForm?.addEventListener("submit", handleRuleSubmit);
    el.ruleThresholdType?.addEventListener("change", updateThresholdFieldVisibility);
    el.ruleEventType?.addEventListener("change", handleRuleEventTypeChange);
    el.rulesList?.addEventListener("click", handleRulesListClick);
    el.targetsList?.addEventListener("click", handleTargetsListClick);
    el.targetsRefresh?.addEventListener("click", handleRefreshAll);
    el.historyRefresh?.addEventListener("click", handleRefreshAll);
  }

  function unbindEvents() {
    el.refreshAll?.removeEventListener("click", handleRefreshAll);
    el.preferencesForm?.removeEventListener("submit", handlePreferencesSubmit);
    el.testForm?.removeEventListener("submit", handleTestSubmit);
    el.rulesRefresh?.removeEventListener("click", handleRefreshAll);
    el.rulesCreate?.removeEventListener("click", handleNewRuleClick);
    el.ruleCancel?.removeEventListener("click", handleCancelRuleEdit);
    el.ruleForm?.removeEventListener("submit", handleRuleSubmit);
    el.ruleThresholdType?.removeEventListener("change", updateThresholdFieldVisibility);
    el.ruleEventType?.removeEventListener("change", handleRuleEventTypeChange);
    el.rulesList?.removeEventListener("click", handleRulesListClick);
    el.targetsList?.removeEventListener("click", handleTargetsListClick);
    el.targetsRefresh?.removeEventListener("click", handleRefreshAll);
    el.historyRefresh?.removeEventListener("click", handleRefreshAll);
  }

  function bindElements() {
    el.root = document.getElementById("analytics-alerting-title")?.closest(".ss-analytics-alerts-panel") || null;
    el.refreshAll = $("analytics-alerts-refresh");
    el.status = $("analytics-alerts-status");
    el.banner = $("analytics-alerts-banner");
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

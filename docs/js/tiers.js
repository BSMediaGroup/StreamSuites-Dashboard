/* ============================================================
   StreamSuites Dashboard - Tier Configuration view (editable)
   ============================================================ */

(() => {
  "use strict";

  const TIER_CONFIG_ENDPOINT = "/admin/tier-config";
  const AUTH_CONTROLS_ENDPOINT = "/admin/auth/controls";
  const ADMIN_BYPASS_ENDPOINT = "/admin/policy/admin-bypass";
  const VISIBILITY_OPTIONS = [
    { value: "public", label: "Public" },
    { value: "soft_locked", label: "Soft locked" },
    { value: "hidden", label: "Hidden" }
  ];
  const FEATURE_GROUPS = [
    { key: "triggers", label: "Triggers" },
    { key: "clips", label: "Clips" },
    { key: "polls", label: "Polls" },
    { key: "automation", label: "Automation" },
    { key: "branding", label: "Branding" },
    { key: "backups", label: "Backups" }
  ];
  const FEATURE_FIELDS = {
    triggers: ["enabled", "max_triggers", "min_cooldown_seconds"],
    clips: [
      "enabled",
      "max_duration_seconds",
      "pre_roll_seconds",
      "min_cooldown_seconds",
      "max_concurrent_jobs"
    ],
    polls: ["enabled", "max_active_polls", "max_options"],
    automation: ["enabled"],
    branding: ["custom_bot_identity"],
    backups: [
      "manual_export",
      "automated_backups",
      "backup_interval_hours",
      "retention_days"
    ]
  };

  const el = {
    status: null,
    banner: null,
    version: null,
    generated: null,
    source: null,
    list: null,
    empty: null,
    save: null,
    cancel: null,
    editStatus: null,
    bypassToggle: null,
    bypassSave: null,
    bypassStatus: null
  };

  const state = {
    originalPayload: null,
    workingPayload: null,
    editingTierId: null,
    isSaving: false,
    adminBypass: {
      original: null,
      current: null,
      saving: false
    }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function deepClone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
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

  function formatValue(value) {
    if (value === undefined || value === null || value === "") return "--";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  }

  function formatLabel(value) {
    if (!value) return "";
    return String(value)
      .replace(/[_-]+/g, " ")
      .split(" ")
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : ""))
      .join(" ");
  }

  function resolveApiBase() {
    const base =
      document.querySelector('meta[name="streamsuites-auth-base"]')?.getAttribute("content") ||
      "";
    return base ? base.replace(/\/$/, "") : "";
  }

  function buildApiUrl(path, baseOverride) {
    const base = typeof baseOverride === "string" ? baseOverride.replace(/\/$/, "") : resolveApiBase();
    if (!base) return path;
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalized}`;
  }

  function promptAdminReauth() {
    if (typeof window.StreamSuitesAdminGate?.logout === "function") {
      window.StreamSuitesAdminGate.logout();
      return true;
    }
    if (typeof window.StreamSuitesAdminAuth?.logout === "function") {
      window.StreamSuitesAdminAuth.logout();
      return true;
    }
    return false;
  }

  function setBanner(message, variant = "warning") {
    if (!el.banner) return;
    el.banner.textContent = message;
    el.banner.classList.remove("hidden", "ss-alert-danger", "ss-alert-warning", "ss-alert-success");
    el.banner.classList.add(`ss-alert-${variant}`);
  }

  function clearBanner() {
    if (!el.banner) return;
    el.banner.textContent = "";
    el.banner.classList.add("hidden");
    el.banner.classList.remove("ss-alert-danger", "ss-alert-warning", "ss-alert-success");
  }

  function isDirty() {
    if (!state.originalPayload || !state.workingPayload) return false;
    return JSON.stringify(state.originalPayload) !== JSON.stringify(state.workingPayload);
  }

  function updateControls() {
    const dirty = isDirty();
    if (el.save) el.save.disabled = !dirty || state.isSaving;
    if (el.cancel) el.cancel.disabled = !dirty || state.isSaving;
    if (el.editStatus) {
      el.editStatus.textContent = dirty ? "Unsaved changes" : "No pending changes";
    }
  }

  function updateBypassControls() {
    if (!el.bypassSave) return;
    const dirty =
      state.adminBypass.current !== null &&
      state.adminBypass.current !== state.adminBypass.original;
    el.bypassSave.disabled = !dirty || state.adminBypass.saving;
  }

  function renderVisibilityControl(tierKey, visibility, isEditing) {
    if (!isEditing) {
      return `<span class="muted">${escapeHtml(formatLabel(visibility))}</span>`;
    }
    const options = VISIBILITY_OPTIONS.map(
      (option) =>
        `<option value="${option.value}"${
          option.value === visibility ? " selected" : ""
        }>${escapeHtml(option.label)}</option>`
    ).join("");
    return `
      <select class="ss-input tiers-input" data-tier-id="${escapeHtml(tierKey)}" data-field="visibility">
        ${options}
      </select>
    `;
  }

  function renderToggleControl({ tierKey, groupKey, field, value, disabled }) {
    return `
      <label class="switch-button" aria-label="${escapeHtml(formatLabel(field))} toggle">
        <div class="switch-scale">
          <div class="switch-outer">
            <input
              type="checkbox"
              data-tier-id="${escapeHtml(tierKey)}"
              data-group="${escapeHtml(groupKey)}"
              data-field="${escapeHtml(field)}"
              ${value ? "checked" : ""}
              ${disabled ? "disabled" : ""}
            />
            <div class="ss-switch-inner">
              <span class="ss-switch-toggle"></span>
              <span class="ss-switch-indicator"></span>
            </div>
          </div>
        </div>
      </label>
    `;
  }

  function renderFeatureGroup(groupKey, groupConfig, isEditing, tierKey) {
    const label = FEATURE_GROUPS.find((group) => group.key === groupKey)?.label || formatLabel(groupKey);
    const fields = FEATURE_FIELDS[groupKey] || Object.keys(groupConfig || {});
    const rows = fields
      .map((field) => {
        const value = groupConfig ? groupConfig[field] : undefined;
        let valueMarkup = escapeHtml(formatValue(value));
        if (typeof value === "boolean") {
          valueMarkup = isEditing
            ? renderToggleControl({
                tierKey,
                groupKey,
                field,
                value,
                disabled: !isEditing
              })
            : escapeHtml(formatValue(value));
        }
        return `
          <tr>
            <td>${escapeHtml(formatLabel(field))}</td>
            <td class="align-right">${valueMarkup}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <div class="tier-feature-group">
        <div class="tier-feature-title">${escapeHtml(label)}</div>
        <table class="ss-table ss-table-compact">
          <thead>
            <tr>
              <th>Setting</th>
              <th class="align-right">Value</th>
            </tr>
          </thead>
          <tbody>
            ${rows || ""}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderTierCard(tierKey, tier) {
    const isEditing = state.editingTierId === tierKey;
    const label = tier?.label || tierKey.toUpperCase();
    const description = tier?.description || "";
    const id = tier?.id || tierKey;
    const visibility = tier?.visibility || "--";
    const rank = tier?.rank ?? "--";
    const features = tier?.features || {};

    const featureBlocks = FEATURE_GROUPS.map((group) =>
      renderFeatureGroup(group.key, features[group.key] || {}, isEditing, tierKey)
    ).join("");

    return `
      <section class="ss-panel tier-card${isEditing ? " is-editing" : ""}">
        <header class="ss-panel-header">
          <div class="ss-panel-header-main">
            <h3>${escapeHtml(label)}</h3>
            <p class="muted" style="margin:6px 0 0;">${escapeHtml(description)}</p>
          </div>
          <div class="ss-panel-header-actions">
            <span class="ss-badge">${escapeHtml(formatLabel(visibility))}</span>
            <span class="ss-badge">Rank ${escapeHtml(rank)}</span>
            <button
              class="ss-btn ss-btn-ghost tiers-edit-btn"
              data-tier-id="${escapeHtml(tierKey)}"
              ${isEditing ? "disabled" : ""}
            >
              ${isEditing ? "Editing" : "Edit"}
            </button>
          </div>
        </header>
        <div class="ss-panel-body">
          <div class="tier-meta-row">
            <div><strong>ID:</strong> <span class="muted">${escapeHtml(id)}</span></div>
            <div><strong>Visibility:</strong> ${renderVisibilityControl(tierKey, visibility, isEditing)}</div>
            <div><strong>Rank:</strong> <span class="muted">${escapeHtml(rank)}</span></div>
          </div>
          <div class="tier-feature-grid">
            ${featureBlocks}
          </div>
        </div>
      </section>
    `;
  }

  function renderTierConfig() {
    const payload = state.workingPayload || {};
    const tiers = payload?.tiers && typeof payload.tiers === "object" ? payload.tiers : {};
    const tierEntries = Object.entries(tiers);

    if (el.version) el.version.textContent = payload?.version || "--";
    if (el.generated) el.generated.textContent = payload?.generated_at || "--";
    if (el.source) el.source.textContent = "Auth API";

    if (!el.list) return;
    if (!tierEntries.length) {
      el.list.innerHTML = "";
      if (el.empty) el.empty.classList.remove("hidden");
      return;
    }

    if (el.empty) el.empty.classList.add("hidden");

    const sorted = tierEntries.sort((a, b) => {
      const rankA = typeof a[1]?.rank === "number" ? a[1].rank : 0;
      const rankB = typeof b[1]?.rank === "number" ? b[1].rank : 0;
      if (rankA !== rankB) return rankA - rankB;
      return String(a[0]).localeCompare(String(b[0]));
    });

    el.list.innerHTML = sorted.map(([key, tier]) => renderTierCard(key, tier)).join("");
  }

  async function loadTierConfig(options = {}) {
    const { preserveBanner = false } = options;
    if (el.status) el.status.textContent = "Loading...";
    if (!preserveBanner) clearBanner();

    const url = buildApiUrl(TIER_CONFIG_ENDPOINT);
    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json"
        },
        cache: "no-store"
      });

      if (response.status === 401 || response.status === 403) {
        setBanner("Admin authorization required to view tier configuration.", "danger");
        if (el.status) el.status.textContent = "Unauthorized";
        promptAdminReauth();
        return;
      }

      if (!response.ok) {
        setBanner("Unable to load tier configuration from the Auth API.", "danger");
        if (el.status) el.status.textContent = `Error ${response.status}`;
        return;
      }

      const payload = await response.json();
      state.originalPayload = deepClone(payload || {});
      state.workingPayload = deepClone(payload || {});
      state.editingTierId = null;
      renderTierConfig();
      updateControls();
      if (el.status) el.status.textContent = "Live";
    } catch (err) {
      console.warn("[Dashboard][Tiers] Load failed", err);
      setBanner("Failed to load tier configuration. Check runtime connectivity.", "danger");
      if (el.status) el.status.textContent = "Offline";
    }
  }

  async function loadAdminBypass() {
    if (!el.bypassToggle) return;
    const url = buildApiUrl(AUTH_CONTROLS_ENDPOINT);
    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json"
        },
        cache: "no-store"
      });

      if (!response.ok) {
        if (el.bypassStatus) el.bypassStatus.textContent = "Unable to load admin bypass state.";
        return;
      }

      const payload = await response.json();
      const flag = Boolean(payload?.flags?.admin_tier_config_bypass);
      state.adminBypass.original = flag;
      state.adminBypass.current = flag;
      el.bypassToggle.checked = flag;
      if (el.bypassStatus) el.bypassStatus.textContent = flag ? "Enabled" : "Disabled";
      updateBypassControls();
    } catch (err) {
      console.warn("[Dashboard][Tiers] Bypass load failed", err);
      if (el.bypassStatus) el.bypassStatus.textContent = "Bypass state unavailable.";
    }
  }

  function startEditing(tierId) {
    if (!tierId) return;
    if (state.editingTierId === tierId) return;
    if (isDirty()) {
      const shouldDiscard = window.confirm("Discard unsaved changes?");
      if (!shouldDiscard) return;
      state.workingPayload = deepClone(state.originalPayload);
    }
    state.editingTierId = tierId;
    renderTierConfig();
    updateControls();
  }

  function discardChanges() {
    state.workingPayload = deepClone(state.originalPayload);
    renderTierConfig();
    updateControls();
  }

  function updateTierValue({ tierId, group, field, value }) {
    if (!state.workingPayload || !state.workingPayload.tiers) return;
    const tier = state.workingPayload.tiers[tierId];
    if (!tier) return;
    if (!group) {
      tier[field] = value;
      return;
    }
    if (!tier.features || !tier.features[group]) return;
    tier.features[group][field] = value;
  }

  async function saveTierConfig() {
    if (!state.workingPayload || !isDirty()) return;
    state.isSaving = true;
    updateControls();

    const url = buildApiUrl(TIER_CONFIG_ENDPOINT);
    try {
      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(state.workingPayload)
      });

      if (response.status === 401 || response.status === 403) {
        setBanner("Admin authorization required to save tier configuration.", "danger");
        promptAdminReauth();
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload?.error || "Tier configuration update rejected.";
        setBanner(message, "danger");
        await loadTierConfig({ preserveBanner: true });
        return;
      }

      setBanner("Tier configuration saved.", "success");
      await loadTierConfig({ preserveBanner: true });
    } catch (err) {
      console.warn("[Dashboard][Tiers] Save failed", err);
      setBanner("Failed to save tier configuration. No changes applied.", "danger");
      await loadTierConfig({ preserveBanner: true });
    } finally {
      state.isSaving = false;
      updateControls();
    }
  }

  async function saveAdminBypass() {
    if (state.adminBypass.current === state.adminBypass.original) return;
    state.adminBypass.saving = true;
    updateBypassControls();

    const url = buildApiUrl(ADMIN_BYPASS_ENDPOINT);
    try {
      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ enabled: state.adminBypass.current })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload?.error || "Admin bypass update failed.";
        if (el.bypassStatus) el.bypassStatus.textContent = message;
        state.adminBypass.current = state.adminBypass.original;
        if (el.bypassToggle) el.bypassToggle.checked = state.adminBypass.original;
        return;
      }

      const payload = await response.json();
      const flag = Boolean(payload?.flags?.admin_tier_config_bypass);
      state.adminBypass.original = flag;
      state.adminBypass.current = flag;
      if (el.bypassToggle) el.bypassToggle.checked = flag;
      if (el.bypassStatus) el.bypassStatus.textContent = flag ? "Enabled" : "Disabled";
    } catch (err) {
      console.warn("[Dashboard][Tiers] Bypass save failed", err);
      if (el.bypassStatus) el.bypassStatus.textContent = "Admin bypass update failed.";
      state.adminBypass.current = state.adminBypass.original;
      if (el.bypassToggle) el.bypassToggle.checked = state.adminBypass.original;
    } finally {
      state.adminBypass.saving = false;
      updateBypassControls();
    }
  }

  function bindEvents() {
    if (el.list) {
      el.list.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.matches(".tiers-edit-btn")) {
          const tierId = target.getAttribute("data-tier-id");
          startEditing(tierId);
        }
      });

      el.list.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
        const tierId = target.getAttribute("data-tier-id");
        if (!tierId || state.editingTierId !== tierId) return;
        const field = target.getAttribute("data-field");
        const group = target.getAttribute("data-group");
        if (!field) return;

        let value = target.value;
        if (target instanceof HTMLInputElement && target.type === "checkbox") {
          value = target.checked;
        }
        updateTierValue({ tierId, group, field, value });
        updateControls();
      });
    }

    if (el.save) el.save.addEventListener("click", () => saveTierConfig());
    if (el.cancel) el.cancel.addEventListener("click", () => discardChanges());

    if (el.bypassToggle) {
      el.bypassToggle.addEventListener("change", () => {
        state.adminBypass.current = el.bypassToggle.checked;
        if (el.bypassStatus) {
          el.bypassStatus.textContent = el.bypassToggle.checked ? "Enabled (unsaved)" : "Disabled (unsaved)";
        }
        updateBypassControls();
      });
    }
    if (el.bypassSave) el.bypassSave.addEventListener("click", () => saveAdminBypass());
  }

  function init() {
    el.status = $("tiers-status");
    el.banner = $("tiers-banner");
    el.version = $("tiers-version");
    el.generated = $("tiers-generated");
    el.source = $("tiers-source");
    el.list = $("tiers-list");
    el.empty = $("tiers-empty");
    el.save = $("tiers-save");
    el.cancel = $("tiers-edit-cancel");
    el.editStatus = $("tiers-edit-status");
    el.bypassToggle = $("tiers-bypass-toggle");
    el.bypassSave = $("tiers-bypass-save");
    el.bypassStatus = $("tiers-bypass-status");

    bindEvents();
    loadTierConfig();
    loadAdminBypass();
  }

  window.TiersView = {
    init
  };
})();

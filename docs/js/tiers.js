/* ============================================================
   StreamSuites Dashboard - Tier Configuration view (read-only)
   ============================================================ */

(() => {
  "use strict";

  const TIER_CONFIG_ENDPOINT = "/admin/tier-config";
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
    empty: null
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

  function renderFeatureGroup(groupKey, groupConfig) {
    const label = FEATURE_GROUPS.find((group) => group.key === groupKey)?.label || formatLabel(groupKey);
    const fields = FEATURE_FIELDS[groupKey] || Object.keys(groupConfig || {});
    const rows = fields
      .map((field) => {
        const value = groupConfig ? groupConfig[field] : undefined;
        return `
          <tr>
            <td>${escapeHtml(formatLabel(field))}</td>
            <td>${escapeHtml(formatValue(value))}</td>
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
              <th>Value</th>
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
    const label = tier?.label || tierKey.toUpperCase();
    const description = tier?.description || "";
    const id = tier?.id || tierKey;
    const visibility = tier?.visibility || "--";
    const rank = tier?.rank ?? "--";
    const features = tier?.features || {};

    const featureBlocks = FEATURE_GROUPS.map((group) =>
      renderFeatureGroup(group.key, features[group.key] || {})
    ).join("");

    return `
      <section class="ss-panel tier-card">
        <header class="ss-panel-header">
          <div class="ss-panel-header-main">
            <h3>${escapeHtml(label)}</h3>
            <p class="muted" style="margin:6px 0 0;">${escapeHtml(description)}</p>
          </div>
          <div class="ss-panel-header-actions">
            <span class="ss-badge">${escapeHtml(formatLabel(visibility))}</span>
            <span class="ss-badge">Rank ${escapeHtml(rank)}</span>
          </div>
        </header>
        <div class="ss-panel-body">
          <div class="tier-meta-row">
            <div><strong>ID:</strong> <span class="muted">${escapeHtml(id)}</span></div>
            <div><strong>Visibility:</strong> <span class="muted">${escapeHtml(visibility)}</span></div>
            <div><strong>Rank:</strong> <span class="muted">${escapeHtml(rank)}</span></div>
          </div>
          <div class="tier-feature-grid">
            ${featureBlocks}
          </div>
        </div>
      </section>
    `;
  }

  function renderTierConfig(payload) {
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

  async function loadTierConfig() {
    if (el.status) el.status.textContent = "Loading...";
    clearBanner();

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
      renderTierConfig(payload || {});
      if (el.status) el.status.textContent = "Live";
    } catch (err) {
      console.warn("[Dashboard][Tiers] Load failed", err);
      setBanner("Failed to load tier configuration. Check runtime connectivity.", "danger");
      if (el.status) el.status.textContent = "Offline";
    }
  }

  function init() {
    el.status = $("tiers-status");
    el.banner = $("tiers-banner");
    el.version = $("tiers-version");
    el.generated = $("tiers-generated");
    el.source = $("tiers-source");
    el.list = $("tiers-list");
    el.empty = $("tiers-empty");

    loadTierConfig();
  }

  window.TiersView = {
    init
  };
})();

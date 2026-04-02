(() => {
  "use strict";

  const PERMISSIONS_ENDPOINT = "/admin/permissions";

  const PERMISSION_ICON_PATHS = Object.freeze({
    access: "/assets/icons/ui/adminactionshield.svg",
    alerts: "/assets/icons/ui/alarm.svg",
    analytics: "/assets/icons/ui/statgraph.svg",
    api: "/assets/icons/ui/mobilecode.svg",
    audit: "/assets/icons/ui/audit.svg",
    creatorIntegrations: "/assets/icons/ui/hook.svg",
    data: "/assets/icons/ui/photostack.svg",
    default: "/assets/icons/ui/label.svg",
    jobs: "/assets/icons/ui/automation.svg",
    permissions: "/assets/icons/ui/key.svg",
    profile: "/assets/icons/ui/profile.svg",
    rate: "/assets/icons/ui/ratelimit.svg",
    runtime: "/assets/icons/ui/cmdkey.svg"
  });

  const state = {
    payload: null,
    accounts: [],
    filteredAccounts: [],
    scope: "role",
    canManage: false,
    editMode: false,
    rolePolicySource: {},
    rolePolicyDraft: {},
    userOverrideSource: {},
    userOverrideDraft: {},
    selectedUserId: "",
    search: "",
    pending: false
  };

  const el = {};
  const PERMISSIONS_BASE_SHELL_SECTIONS = Object.freeze([
    { id: "permissions-overview-section", label: "Overview" },
    { id: "permissions-matrix-section", label: "Matrix" },
    { id: "permissions-accounts-section", label: "Accounts" },
    { id: "permissions-scaffolds-section", label: "Scaffolds" }
  ]);

  function $(id) {
    return document.getElementById(id);
  }

  function deepClone(value, fallback) {
    if (value === undefined) return fallback;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_err) {
      return fallback;
    }
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

  function coerceText(value, fallback = "") {
    if (value === undefined || value === null) return fallback;
    const normalized = String(value).trim();
    return normalized || fallback;
  }

  function slugifyAnchorSegment(value, fallback = "group") {
    const normalized = coerceText(value, fallback)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return normalized || fallback;
  }

  function resolveApiBase() {
    const base =
      window.StreamSuitesAdminAuth?.config?.baseUrl ||
      document.querySelector('meta[name="streamsuites-auth-base"]')?.getAttribute("content") ||
      "";
    return base ? String(base).replace(/\/+$/, "") : "";
  }

  function buildApiUrl(path) {
    const base = resolveApiBase();
    if (!base) return path;
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalized}`;
  }

  async function readJsonSafe(response) {
    try {
      return await response.json();
    } catch (_err) {
      return null;
    }
  }

  async function requestJson(path, options = {}) {
    const response = await fetch(buildApiUrl(path), {
      cache: "no-store",
      credentials: "include",
      timeoutMs: options.timeoutMs || 9000,
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    const payload = await readJsonSafe(response);
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
    }
    return payload || {};
  }

  function getLiveEntries() {
    const catalog = Array.isArray(state.payload?.catalog) ? state.payload.catalog : [];
    return catalog
      .filter((entry) => entry?.domain === "admin_dashboard" && entry?.active === true)
      .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));
  }

  function getScaffoldEntries() {
    const catalog = Array.isArray(state.payload?.catalog) ? state.payload.catalog : [];
    return catalog
      .filter((entry) => entry?.future_scaffold_only === true)
      .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));
  }

  function getSelectedAccount() {
    return state.accounts.find((account) => String(account?.id || "") === state.selectedUserId) || null;
  }

  function normalizeAccounts(payload) {
    const items = Array.isArray(payload?.accounts)
      ? payload.accounts
      : Array.isArray(payload?.items)
        ? payload.items
        : [];
    return items
      .filter((account) => {
        const role = coerceText(account?.role).toLowerCase();
        return role !== "admin" && account?.admin_access?.developer_capable === true;
      })
      .sort((a, b) => {
        const left = coerceText(a?.display_name || a?.user_code || a?.email).toLowerCase();
        const right = coerceText(b?.display_name || b?.user_code || b?.email).toLowerCase();
        return left.localeCompare(right);
      });
  }

  function normalizeRolePolicy(policy) {
    return { ...(policy || {}) };
  }

  function normalizeUserOverrides(overrides) {
    const next = deepClone(overrides || {}, {});
    return next && typeof next === "object" ? next : {};
  }

  function countEnabledPermissions(policy) {
    return Object.values(policy || {}).filter((value) => value === true).length;
  }

  function serializeRolePolicy(policy) {
    return Object.keys(policy || {})
      .sort()
      .map((key) => `${key}:${policy[key] === true ? "1" : "0"}`)
      .join("|");
  }

  function serializeUserOverrides(overrides) {
    return Object.keys(overrides || {})
      .sort()
      .map((key) => `${key}:${coerceText(overrides?.[key]?.mode).toLowerCase()}`)
      .join("|");
  }

  function isRoleDirty() {
    return serializeRolePolicy(state.rolePolicyDraft) !== serializeRolePolicy(state.rolePolicySource);
  }

  function isUserDirty() {
    return serializeUserOverrides(state.userOverrideDraft) !== serializeUserOverrides(state.userOverrideSource);
  }

  function isCurrentScopeDirty() {
    return state.scope === "user" ? isUserDirty() : isRoleDirty();
  }

  function setStatus(message) {
    if (el.status) el.status.textContent = message || "";
  }

  function setBanner(message, variant = "warning") {
    if (!el.banner) return;
    const text = coerceText(message);
    if (!text) {
      el.banner.textContent = "";
      el.banner.classList.add("hidden");
      el.banner.classList.remove("ss-alert-warning", "ss-alert-danger", "ss-alert-success");
      return;
    }
    el.banner.textContent = text;
    el.banner.classList.remove("hidden");
    el.banner.classList.remove("ss-alert-warning", "ss-alert-danger", "ss-alert-success");
    el.banner.classList.add(`ss-alert-${variant}`);
  }

  function syncSelectedUserState(options = {}) {
    const account = getSelectedAccount();
    state.userOverrideSource = normalizeUserOverrides(account?.admin_permissions_overrides || {});
    if (options.preserveDraft === true) return;
    state.userOverrideDraft = normalizeUserOverrides(state.userOverrideSource);
  }

  function resetRoleDraft() {
    state.rolePolicyDraft = normalizeRolePolicy(state.rolePolicySource);
  }

  function resetUserDraft() {
    state.userOverrideDraft = normalizeUserOverrides(state.userOverrideSource);
  }

  function resetDrafts() {
    resetRoleDraft();
    resetUserDraft();
  }

  function applySearch() {
    const query = state.search.toLowerCase();
    const previousSelected = state.selectedUserId;

    state.filteredAccounts = state.accounts.filter((account) => {
      if (!query) return true;
      const haystack = [
        account?.display_name,
        account?.user_code,
        account?.email,
        account?.role,
        account?.tier
      ]
        .map((value) => coerceText(value).toLowerCase())
        .join(" ");
      return haystack.includes(query);
    });

    if (!state.filteredAccounts.some((account) => String(account?.id || "") === state.selectedUserId)) {
      state.selectedUserId = coerceText(state.filteredAccounts[0]?.id);
    }

    if (state.selectedUserId !== previousSelected || !previousSelected) {
      syncSelectedUserState();
    }
  }

  function applyPermissionsPayload(permissionsPayload) {
    state.payload = permissionsPayload || {};
    state.accounts = normalizeAccounts({
      accounts: Array.isArray(permissionsPayload?.accounts) ? permissionsPayload.accounts : []
    });
    state.rolePolicySource = normalizeRolePolicy(
      permissionsPayload?.role_policies?.developer || permissionsPayload?.defaults?.developer || {}
    );
    if (!state.accounts.some((account) => String(account?.id || "") === state.selectedUserId)) {
      state.selectedUserId = coerceText(state.accounts[0]?.id);
    }
    syncSelectedUserState();
    resetRoleDraft();
    state.canManage =
      window.StreamSuitesDashboardPermissions?.has?.("admin.dashboard.manage.permissions") ===
      true;
    applySearch();
  }

  function groupEntries(entries) {
    const groups = new Map();
    entries.forEach((entry) => {
      const groupKey = coerceText(entry?.group_key, "general");
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          label: coerceText(entry?.group_label, "General"),
          items: []
        });
      }
      groups.get(groupKey).items.push(entry);
    });
    return Array.from(groups.values());
  }

  function getPermissionGroups() {
    return groupEntries(getLiveEntries());
  }

  function buildGroupSectionId(groupKey) {
    return `permissions-group-${slugifyAnchorSegment(groupKey, "general")}`;
  }

  function buildSectionShellSections(groups = getPermissionGroups()) {
    return [
      PERMISSIONS_BASE_SHELL_SECTIONS[0],
      PERMISSIONS_BASE_SHELL_SECTIONS[1],
      ...groups.map((group) => ({
        id: buildGroupSectionId(group.key),
        label: coerceText(group.label, "General")
      })),
      PERMISSIONS_BASE_SHELL_SECTIONS[2],
      PERMISSIONS_BASE_SHELL_SECTIONS[3]
    ];
  }

  function syncSectionShell(groups = getPermissionGroups()) {
    window.StreamSuitesAdminShell?.setSectionShellSections?.(
      "permissions",
      buildSectionShellSections(groups)
    );
  }

  function syncGroupSectionAnchors() {
    [el.roleEditor, el.userEditor].forEach((surface) => {
      surface?.querySelectorAll("[data-permissions-group-anchor]").forEach((section) => {
        section.removeAttribute("id");
      });
    });

    const activeSurface = state.scope === "user" ? el.userEditor : el.roleEditor;
    activeSurface?.querySelectorAll("[data-permissions-group-anchor]").forEach((section) => {
      const anchorId = coerceText(section.getAttribute("data-permissions-group-anchor"));
      if (anchorId) {
        section.id = anchorId;
      }
    });
  }

  function applyHashTarget() {
    const hashId = window.location.hash.replace(/^#/, "").trim();
    if (!hashId) return;
    const target = document.getElementById(hashId);
    if (!target) return;
    target.scrollIntoView({ behavior: "auto", block: "start" });
  }

  function describeSelectedAccount(account = getSelectedAccount()) {
    return coerceText(account?.display_name || account?.user_code || account?.email, "the selected account");
  }

  function resolvePermissionIcon(entry, key) {
    const normalizedKey = coerceText(key).toLowerCase();
    const groupKey = coerceText(entry?.group_key).toLowerCase();
    const routes = Array.isArray(entry?.view_names)
      ? entry.view_names.map((viewName) => coerceText(viewName).toLowerCase()).filter(Boolean)
      : [];

    if (normalizedKey === "admin.dashboard.access") return PERMISSION_ICON_PATHS.access;
    if (normalizedKey.includes("manage.permissions") || normalizedKey.includes("permission")) {
      return PERMISSION_ICON_PATHS.permissions;
    }
    if (normalizedKey.includes("account") || routes.includes("accounts")) {
      return PERMISSION_ICON_PATHS.profile;
    }
    if (normalizedKey.includes("creator_integrations") || routes.includes("creator-integrations")) {
      return PERMISSION_ICON_PATHS.creatorIntegrations;
    }
    if (normalizedKey.includes("analytics") || routes.includes("analytics")) {
      return PERMISSION_ICON_PATHS.analytics;
    }
    if (normalizedKey.includes("alert") || routes.includes("alerts")) {
      return PERMISSION_ICON_PATHS.alerts;
    }
    if (normalizedKey.includes("audit") || routes.includes("audit")) {
      return PERMISSION_ICON_PATHS.audit;
    }
    if (normalizedKey.includes("runtime") || routes.includes("bots")) {
      return PERMISSION_ICON_PATHS.runtime;
    }
    if (normalizedKey.includes("api") || routes.includes("api-usage")) {
      return PERMISSION_ICON_PATHS.api;
    }
    if (normalizedKey.includes("rate") || routes.includes("ratelimits")) {
      return PERMISSION_ICON_PATHS.rate;
    }
    if (normalizedKey.includes("job") || routes.includes("jobs")) {
      return PERMISSION_ICON_PATHS.jobs;
    }
    if (normalizedKey.includes("data") || routes.includes("data-signals")) {
      return PERMISSION_ICON_PATHS.data;
    }
    if (groupKey.includes("access") || groupKey.includes("security")) {
      return PERMISSION_ICON_PATHS.access;
    }
    return PERMISSION_ICON_PATHS.default;
  }

  function renderPermissionTitle(entry, key) {
    const iconPath = resolvePermissionIcon(entry, key);
    return `
      <span class="ss-permissions-row-title-wrap">
        <span
          class="ss-permissions-row-icon"
          style="--permissions-icon: url('${escapeHtml(iconPath)}');"
          aria-hidden="true"
        ></span>
        <span class="ss-permissions-row-title">${escapeHtml(entry?.label || key)}</span>
      </span>
    `;
  }

  function renderRoleEditor(groups = getPermissionGroups()) {
    if (!el.roleEditor) return;
    const inputsDisabled = !state.canManage || !state.editMode || state.pending;
    const disabledAttr = inputsDisabled ? "disabled" : "";

    el.roleEditor.innerHTML = groups
      .map(
        (group) => `
          <section
            class="ss-permissions-group"
            data-permissions-group-anchor="${escapeHtml(buildGroupSectionId(group.key))}"
          >
            <div class="ss-permissions-group-head">
              <div>
                <h4>${escapeHtml(group.label)}</h4>
                <p class="muted">Live StreamSuites dashboard permissions in this group.</p>
              </div>
            </div>
            <div class="ss-permissions-group-list">
              ${group.items
                .map((entry) => {
                  const key = coerceText(entry?.key);
                  const checked = state.rolePolicyDraft[key] === true;
                  const viewNames = Array.isArray(entry?.view_names) ? entry.view_names.filter(Boolean) : [];
                  return `
                    <label class="ss-permissions-row${inputsDisabled ? " is-read-only" : ""}">
                      <span class="ss-permissions-row-copy">
                        ${renderPermissionTitle(entry, key)}
                        <span class="ss-permissions-row-meta">${escapeHtml(entry?.description || "")}</span>
                        <span class="ss-permissions-row-key">${escapeHtml(key)}</span>
                        ${
                          viewNames.length
                            ? `<span class="ss-permissions-row-note">Routes: ${escapeHtml(viewNames.join(", "))}</span>`
                            : '<span class="ss-permissions-row-note">Action/control permission</span>'
                        }
                      </span>
                      <span class="ss-permissions-toggle">
                        <span class="ss-permissions-toggle-state">${checked ? "Allowed" : "Denied"}</span>
                        <span class="ss-permissions-toggle-control">
                          <label class="switch-button" aria-label="${escapeHtml(entry?.label || key)} toggle">
                            <div class="switch-scale">
                              <div class="switch-outer">
                                <input type="checkbox" data-role-permission="${escapeHtml(key)}" ${checked ? "checked" : ""} ${disabledAttr} />
                                <div class="ss-switch-inner">
                                  <span class="ss-switch-toggle"></span>
                                  <span class="ss-switch-indicator"></span>
                                </div>
                              </div>
                            </div>
                          </label>
                        </span>
                      </span>
                    </label>
                  `;
                })
                .join("")}
            </div>
          </section>
        `
      )
      .join("");
  }

  function renderUserEditor(groups = getPermissionGroups()) {
    if (!el.userEditor) return;
    const account = getSelectedAccount();
    if (!account) {
      el.userEditor.innerHTML = '<div class="ss-permissions-empty">Select a developer-capable account to inspect or edit user overrides.</div>';
      return;
    }

    const inputsDisabled = !state.canManage || !state.editMode || state.pending;
    const disabledAttr = inputsDisabled ? "disabled" : "";

    el.userEditor.innerHTML = groups
      .map(
        (group) => `
          <section
            class="ss-permissions-group"
            data-permissions-group-anchor="${escapeHtml(buildGroupSectionId(group.key))}"
          >
            <div class="ss-permissions-group-head">
              <div>
                <h4>${escapeHtml(group.label)}</h4>
                <p class="muted">Per-user overrides for ${escapeHtml(describeSelectedAccount(account))}.</p>
              </div>
            </div>
            <div class="ss-permissions-group-list">
              ${group.items
                .map((entry) => {
                  const key = coerceText(entry?.key);
                  const overrideMode = coerceText(state.userOverrideDraft?.[key]?.mode).toLowerCase();
                  const roleDefaultAllowed = state.rolePolicySource[key] === true;
                  return `
                    <div class="ss-permissions-row${inputsDisabled ? " is-read-only" : ""}">
                      <span class="ss-permissions-row-copy">
                        ${renderPermissionTitle(entry, key)}
                        <span class="ss-permissions-row-meta">${escapeHtml(entry?.description || "")}</span>
                        <span class="ss-permissions-row-key">${escapeHtml(key)}</span>
                        <span class="ss-permissions-row-note">Role default: ${roleDefaultAllowed ? "Allowed" : "Denied"}</span>
                      </span>
                      <label class="ss-permissions-select-wrap">
                        <span class="sr-only">${escapeHtml(entry?.label || key)} override</span>
                        <select class="ss-input" data-user-permission="${escapeHtml(key)}" ${disabledAttr}>
                          <option value="" ${!overrideMode ? "selected" : ""}>Inherit role default</option>
                          <option value="allow" ${overrideMode === "allow" ? "selected" : ""}>Allow</option>
                          <option value="deny" ${overrideMode === "deny" ? "selected" : ""}>Deny</option>
                        </select>
                      </label>
                    </div>
                  `;
                })
                .join("")}
            </div>
          </section>
        `
      )
      .join("");
  }

  function renderUserList() {
    if (!el.userList) return;
    if (!state.filteredAccounts.length) {
      el.userList.innerHTML = '<div class="ss-permissions-empty">No developer-capable accounts match the current search.</div>';
      return;
    }

    const listDisabledAttr = state.pending || state.editMode ? "disabled" : "";
    el.userList.innerHTML = state.filteredAccounts
      .map((account) => {
        const selected = String(account?.id || "") === state.selectedUserId;
        const overrideCount = Object.keys(account?.admin_permissions_overrides || {}).length;
        const adminAccess = account?.admin_access || {};
        const accessBadge = adminAccess?.allowed
          ? '<span class="ss-badge ss-badge-success">Dashboard access</span>'
          : '<span class="ss-badge ss-badge-warning">No dashboard access</span>';
        return `
          <button
            type="button"
            class="ss-permissions-user-card${selected ? " is-active" : ""}"
            data-select-user="${escapeHtml(account?.id || "")}"
            ${listDisabledAttr}
          >
            <span class="ss-permissions-user-card-top">
              <strong>${escapeHtml(account?.display_name || account?.user_code || account?.email || "Unknown")}</strong>
              ${accessBadge}
            </span>
            <span class="ss-permissions-user-card-meta">${escapeHtml(account?.user_code || account?.email || "")}</span>
            <span class="ss-permissions-user-card-meta">${escapeHtml(`${(account?.role || "").toUpperCase()} • ${(account?.tier || "").toUpperCase() || "CORE"}`)}</span>
            <span class="ss-permissions-user-card-meta">${escapeHtml(`${overrideCount} override${overrideCount === 1 ? "" : "s"}`)}</span>
          </button>
        `;
      })
      .join("");
  }

  function renderSelectedUser() {
    if (!el.selectedUser) return;
    const account = getSelectedAccount();
    if (!account) {
      el.selectedUser.innerHTML = '<div class="ss-permissions-empty">Select a developer-capable account to inspect effective permissions.</div>';
      return;
    }

    const access = account?.admin_access || {};
    const enabledKeys = Array.isArray(access?.effective_permission_keys)
      ? access.effective_permission_keys
      : [];
    const sourceOverrideKeys = Object.keys(account?.admin_permissions_overrides || {});
    const stagedOverrideCount =
      state.scope === "user" && state.editMode
        ? Object.keys(state.userOverrideDraft || {}).length
        : sourceOverrideKeys.length;

    el.selectedUser.innerHTML = `
      <div class="ss-permissions-selected-grid">
        <div class="ss-permissions-selected-card">
          <span class="ss-permissions-card-kicker">Account</span>
          <strong>${escapeHtml(describeSelectedAccount(account))}</strong>
          <p class="muted">${escapeHtml(account.email || account.user_code || "")}</p>
        </div>
        <div class="ss-permissions-selected-card">
          <span class="ss-permissions-card-kicker">Effective access</span>
          <strong>${access?.allowed ? "Dashboard enabled" : "Dashboard blocked"}</strong>
          <p class="muted">${escapeHtml(access?.reason || "unknown")}</p>
        </div>
        <div class="ss-permissions-selected-card">
          <span class="ss-permissions-card-kicker">Override posture</span>
          <strong>${escapeHtml(String(stagedOverrideCount))}</strong>
          <p class="muted">${state.scope === "user" && state.editMode ? "Staged override entries in the current draft." : `${sourceOverrideKeys.length} saved override${sourceOverrideKeys.length === 1 ? "" : "s"} on the account.`}</p>
        </div>
      </div>
      <div class="ss-permissions-selected-list">
        ${enabledKeys.length
          ? enabledKeys
              .slice(0, 12)
              .map((key) => `<span class="ss-chip ss-chip-muted">${escapeHtml(key)}</span>`)
              .join("")
          : '<span class="muted">No live permissions currently effective.</span>'}
      </div>
    `;
  }

  function renderEffectiveSummary() {
    if (!el.effectiveSummary) return;
    const account = getSelectedAccount();
    const currentAdminAccess = window.StreamSuitesDashboardPermissions?.getAccess?.() || {};
    const selectedAccess = account?.admin_access || {};
    const rolePolicy = state.rolePolicyDraft || {};
    const scopeLabel = state.scope === "user" ? "Selected user effective result" : "Developer role default baseline";
    const activePolicy =
      state.scope === "user" && account
        ? selectedAccess
        : {
            allowed: rolePolicy["admin.dashboard.access"] === true,
            effective_permission_keys: Object.keys(rolePolicy).filter(
              (permissionKey) => rolePolicy[permissionKey] === true
            ),
            resolution_order:
              state.payload?.authority_model?.resolution_order || currentAdminAccess?.resolutionOrder || []
          };
    const resolutionOrder = Array.isArray(activePolicy?.resolution_order)
      ? activePolicy.resolution_order
      : Array.isArray(state.payload?.authority_model?.resolution_order)
        ? state.payload.authority_model.resolution_order
        : [];
    const stagedOverrideCount = Object.keys(state.userOverrideDraft || {}).length;

    el.effectiveSummary.innerHTML = `
      <div class="ss-permissions-selected-card">
        <span class="ss-permissions-card-kicker">${escapeHtml(scopeLabel)}</span>
        <strong>${activePolicy?.allowed ? "Dashboard access resolves to allow" : "Dashboard access resolves to deny"}</strong>
        <p class="muted">${state.scope === "user" ? "Selected account access remains the last saved authoritative payload. Staged override edits do not become effective until you save." : "Role default snapshot, including any staged switch changes in the current edit session."}</p>
      </div>
      <div class="ss-permissions-effective-list">
        <div class="ss-permissions-meta-row">
          <dt>Resolution order</dt>
          <dd>${escapeHtml(resolutionOrder.join(" -> ") || "Unavailable")}</dd>
        </div>
        <div class="ss-permissions-meta-row">
          <dt>Effective live keys</dt>
          <dd>${escapeHtml(String((activePolicy?.effective_permission_keys || []).length || 0))}</dd>
        </div>
        <div class="ss-permissions-meta-row">
          <dt>${state.scope === "user" ? "Staged overrides" : "Current operator"}</dt>
          <dd>${escapeHtml(state.scope === "user" ? String(stagedOverrideCount) : currentAdminAccess?.allowed ? "Authorized" : "Read-only or unavailable")}</dd>
        </div>
      </div>
    `;
  }

  function renderScaffolds() {
    if (!el.scaffolds) return;
    const scaffolds = getScaffoldEntries();
    el.scaffolds.innerHTML = scaffolds
      .map(
        (entry) => `
          <article class="ss-permissions-scaffold-card">
            <span class="ss-permissions-card-kicker">${escapeHtml(entry?.group_label || entry?.domain || "Scaffold")}</span>
            <h3>${escapeHtml(entry?.label || entry?.key || "Untitled scaffold")}</h3>
            <p class="muted">${escapeHtml(entry?.description || "Planned future capability.")}</p>
            <div class="ss-permissions-scaffold-foot">
              <span class="ss-badge ss-badge-warning">Planned only</span>
              <code>${escapeHtml(entry?.key || "")}</code>
            </div>
          </article>
        `
      )
      .join("");
  }

  function syncEditorScope() {
    const isUser = state.scope === "user";
    const scopeLocked = state.pending || state.editMode;
    const hasSelectedAccount = Boolean(getSelectedAccount());

    el.scopeSwitch?.querySelectorAll("[data-permissions-scope]").forEach((button) => {
      const active = button.getAttribute("data-permissions-scope") === state.scope;
      button.classList.toggle("ss-btn-primary", active);
      button.classList.toggle("ss-btn-secondary", !active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.disabled = scopeLocked;
    });

    el.editorTitle.textContent = isUser ? "User overrides" : "Role defaults";
    el.editorCopy.textContent = isUser
      ? hasSelectedAccount
        ? state.editMode
          ? `Editing staged overrides for ${describeSelectedAccount()}. Save applies them to StreamSuites; Cancel discards them.`
          : `Overrides for ${describeSelectedAccount()} stay locked until you explicitly enter Edit mode.`
        : "Select a developer-capable account to inspect or edit user overrides."
      : state.editMode
        ? "Editing the staged developer baseline. Switch changes stay local until you explicitly save them."
        : "Developer role policy stays locked by default. Select Edit to unlock the shared baseline.";
    el.roleEditor.classList.toggle("hidden", isUser);
    el.userEditor.classList.toggle("hidden", !isUser);
  }

  function renderSummary() {
    if (!el.summaryGrid) return;
    const rolePolicy = state.rolePolicyDraft || {};
    const currentAccess = window.StreamSuitesDashboardPermissions?.getAccess?.() || {};
    el.summaryGrid.innerHTML = `
      <article class="ss-permissions-summary-card">
        <span class="ss-permissions-card-kicker">Source of truth</span>
        <strong>${escapeHtml(state.payload?.authority_model?.source_of_truth || "StreamSuites Auth API")}</strong>
        <p class="muted">Dashboard only edits and consumes the resolved contract.</p>
      </article>
      <article class="ss-permissions-summary-card">
        <span class="ss-permissions-card-kicker">Developer baseline</span>
        <strong>${escapeHtml(String(countEnabledPermissions(rolePolicy)))}</strong>
        <p class="muted">${state.editMode && state.scope === "role" ? "Current staged enablement count for the developer role baseline." : "Live permissions currently enabled in the developer role default."}</p>
      </article>
      <article class="ss-permissions-summary-card">
        <span class="ss-permissions-card-kicker">Current session</span>
        <strong>${currentAccess?.allowed ? "Authorized" : "Restricted"}</strong>
        <p class="muted">${escapeHtml(currentAccess?.level || "unknown")} operator view.</p>
      </article>
      <article class="ss-permissions-summary-card">
        <span class="ss-permissions-card-kicker">Future scaffolds</span>
        <strong>${escapeHtml(String(getScaffoldEntries().length))}</strong>
        <p class="muted">Creator, Public, and Tier capability rows kept visible but intentionally non-editable.</p>
      </article>
    `;
  }

  function renderMeta() {
    const currentAccess = window.StreamSuitesDashboardPermissions?.getAccess?.() || {};
    if (el.modeChip) {
      const modeText = !state.canManage ? "Read-only session" : state.editMode ? "Edit mode" : "View mode";
      el.modeChip.textContent = modeText;
      el.modeChip.classList.toggle("ss-chip-success", state.editMode);
      el.modeChip.classList.toggle("ss-chip-warning", !state.canManage);
      el.modeChip.classList.toggle("ss-chip-muted", state.canManage && !state.editMode);
    }
    if (el.registryVersion) {
      el.registryVersion.textContent = coerceText(
        state.payload?.registry_version || currentAccess?.registryVersion,
        "--"
      );
    }
    if (el.resolutionOrder) {
      const order =
        state.payload?.authority_model?.resolution_order || currentAccess?.resolutionOrder || [];
      el.resolutionOrder.textContent = Array.isArray(order) && order.length ? order.join(" -> ") : "--";
    }
    if (el.liveCount) {
      el.liveCount.textContent = String(getLiveEntries().length);
    }
    if (el.developerCount) {
      el.developerCount.textContent = String(state.accounts.length);
    }
  }

  function renderWorkflow() {
    const account = getSelectedAccount();
    const isUser = state.scope === "user";
    const dirty = isCurrentScopeDirty();
    const scopeReady = !isUser || Boolean(account);

    if (el.pageRoot) {
      el.pageRoot.dataset.permissionsMode = state.editMode ? "edit" : "view";
    }

    if (el.editChip) {
      const chipText = !state.canManage
        ? "Read-only session"
        : state.editMode
          ? dirty
            ? "Staged changes"
            : "Editing"
          : "View mode";
      el.editChip.textContent = chipText;
      el.editChip.classList.toggle("ss-chip-success", state.editMode && dirty);
      el.editChip.classList.toggle("ss-chip-warning", !state.canManage);
      el.editChip.classList.toggle("ss-chip-muted", state.canManage && (!state.editMode || !dirty));
    }

    if (el.modeCopy) {
      if (!state.canManage) {
        el.modeCopy.textContent =
          "This session can inspect permission policy but cannot unlock editing without the manage-permissions grant.";
      } else if (state.editMode) {
        el.modeCopy.textContent = isUser
          ? `Editing overrides for ${describeSelectedAccount(account)}. Save applies the staged draft; Cancel discards it and relocks the page.`
          : "Editing the developer role baseline. Switch changes stay local until you save, and Cancel discards the entire staged draft.";
      } else if (isUser && account) {
        el.modeCopy.textContent =
          `Overrides for ${describeSelectedAccount(account)} are locked by default. Select Edit to unlock this scope, then Save or Cancel explicitly.`;
      } else if (isUser) {
        el.modeCopy.textContent =
          "Select a developer-capable account, then choose Edit to unlock that account's override surface.";
      } else {
        el.modeCopy.textContent =
          "Permissions open locked. Select Edit to unlock the current scope, then Save or Cancel explicitly.";
      }
    }

    if (el.edit) {
      el.edit.classList.toggle("hidden", state.editMode || !state.canManage);
      el.edit.disabled = state.pending || !scopeReady;
      el.edit.textContent = isUser ? "Edit overrides" : "Edit role policy";
    }

    if (el.save) {
      el.save.classList.toggle("hidden", !state.editMode);
      el.save.disabled = state.pending || !dirty || !scopeReady;
      el.save.textContent = isUser ? "Save user overrides" : "Save role policy";
    }

    if (el.cancel) {
      el.cancel.classList.toggle("hidden", !state.editMode);
      el.cancel.disabled = state.pending;
    }

    if (el.refresh) {
      el.refresh.disabled = state.pending || state.editMode;
    }

    if (el.userSearch) {
      el.userSearch.disabled = state.pending || state.editMode;
    }
  }

  function renderAll() {
    const groups = getPermissionGroups();
    renderSummary();
    renderMeta();
    renderRoleEditor(groups);
    renderUserEditor(groups);
    renderUserList();
    renderSelectedUser();
    renderEffectiveSummary();
    renderScaffolds();
    syncEditorScope();
    syncGroupSectionAnchors();
    renderWorkflow();
  }

  function blockContextChange(message) {
    if (!state.editMode) return false;
    setBanner(message, "warning");
    return true;
  }

  function enterEditMode() {
    if (!state.canManage || state.pending) return;
    if (state.scope === "user" && !getSelectedAccount()) {
      setBanner("Select a developer-capable account before editing user overrides.", "warning");
      return;
    }
    resetDrafts();
    state.editMode = true;
    renderAll();
    setBanner("");
    setStatus(state.scope === "user" ? "Editing staged user overrides." : "Editing staged role policy.");
  }

  function cancelEditMode() {
    if (!state.editMode || state.pending) return;
    resetDrafts();
    state.editMode = false;
    renderAll();
    setBanner("");
    setStatus("Returned to view mode.");
  }

  async function hydrate() {
    setStatus("Loading authoritative permission registry…");
    setBanner("");
    try {
      const permissionsPayload = await requestJson(PERMISSIONS_ENDPOINT);
      applyPermissionsPayload(permissionsPayload);
      state.editMode = false;
      renderAll();
      syncSectionShell();
      requestAnimationFrame(() => {
        applyHashTarget();
      });
      setStatus(`Loaded ${getLiveEntries().length} live permissions and ${state.accounts.length} developer-capable accounts.`);
      if (!state.canManage) {
        setBanner("This session can inspect permission policy but cannot save changes without the manage-permissions grant.", "warning");
      }
    } catch (err) {
      setStatus("Failed to load permission policy.");
      setBanner(String(err?.message || "Unable to load permissions."), "danger");
    }
  }

  async function saveRolePolicy() {
    if (!state.canManage || state.pending || !state.editMode || !isRoleDirty()) return;
    state.pending = true;
    renderAll();
    setStatus("Saving developer role policy…");
    try {
      const response = await requestJson(PERMISSIONS_ENDPOINT, {
        method: "PUT",
        body: JSON.stringify({
          role_policies: {
            developer: state.rolePolicyDraft
          }
        })
      });
      applyPermissionsPayload(response);
      state.editMode = false;
      renderAll();
      setBanner("Developer role policy saved to StreamSuites.", "success");
      setStatus("Developer role policy saved.");
    } catch (err) {
      setBanner(String(err?.message || "Unable to save role policy."), "danger");
      setStatus("Role policy save failed.");
    } finally {
      state.pending = false;
      renderAll();
    }
  }

  async function saveUserOverrides() {
    const account = getSelectedAccount();
    if (!state.canManage || state.pending || !state.editMode || !account?.id || !isUserDirty()) return;
    state.pending = true;
    renderAll();
    setStatus(`Saving overrides for ${describeSelectedAccount(account)}…`);
    try {
      const response = await requestJson(`/api/admin/accounts/${encodeURIComponent(account.id)}/permissions`, {
        method: "PUT",
        body: JSON.stringify({
          replace: true,
          overrides: state.userOverrideDraft
        })
      });
      const updatedAccount = response?.account || null;
      state.accounts = state.accounts.map((item) =>
        String(item?.id || "") === String(updatedAccount?.id || "") ? updatedAccount : item
      );
      applySearch();
      syncSelectedUserState();
      state.editMode = false;
      renderAll();
      setBanner("User override policy saved to StreamSuites.", "success");
      setStatus("User overrides saved.");
    } catch (err) {
      setBanner(String(err?.message || "Unable to save user overrides."), "danger");
      setStatus("User override save failed.");
    } finally {
      state.pending = false;
      renderAll();
    }
  }

  function bindEvents() {
    el.refresh?.addEventListener("click", () => {
      if (blockContextChange("Save or cancel the current staged permission draft before refreshing.")) {
        return;
      }
      void hydrate();
    });

    el.scopeSwitch?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-permissions-scope]");
      if (!(button instanceof HTMLButtonElement)) return;
      if (blockContextChange("Save or cancel the current staged permission draft before switching scope.")) {
        return;
      }
      state.scope = button.getAttribute("data-permissions-scope") === "user" ? "user" : "role";
      renderAll();
    });

    el.userSearch?.addEventListener("input", () => {
      state.search = coerceText(el.userSearch?.value).toLowerCase();
      applySearch();
      renderAll();
    });

    el.userList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-select-user]");
      if (!(button instanceof HTMLButtonElement)) return;
      if (blockContextChange("Save or cancel the current staged permission draft before switching accounts.")) {
        return;
      }
      state.selectedUserId = coerceText(button.getAttribute("data-select-user"));
      syncSelectedUserState();
      state.scope = "user";
      renderAll();
    });

    el.roleEditor?.addEventListener("change", (event) => {
      const input = event.target.closest("[data-role-permission]");
      if (!(input instanceof HTMLInputElement) || !state.editMode) return;
      state.rolePolicyDraft[input.getAttribute("data-role-permission")] = input.checked;
      renderSummary();
      renderEffectiveSummary();
      renderWorkflow();
    });

    el.userEditor?.addEventListener("change", (event) => {
      const select = event.target.closest("[data-user-permission]");
      if (!(select instanceof HTMLSelectElement) || !state.editMode) return;
      const permissionKey = coerceText(select.getAttribute("data-user-permission"));
      const mode = coerceText(select.value).toLowerCase();
      if (!mode) {
        delete state.userOverrideDraft[permissionKey];
      } else {
        state.userOverrideDraft[permissionKey] = {
          ...(state.userOverrideDraft[permissionKey] || {}),
          mode
        };
      }
      renderSelectedUser();
      renderEffectiveSummary();
      renderWorkflow();
    });

    el.edit?.addEventListener("click", () => {
      enterEditMode();
    });

    el.save?.addEventListener("click", () => {
      if (state.scope === "user") {
        void saveUserOverrides();
        return;
      }
      void saveRolePolicy();
    });

    el.cancel?.addEventListener("click", () => {
      cancelEditMode();
    });
  }

  function cacheElements() {
    el.pageRoot = $("permissions-page-root");
    el.banner = $("permissions-banner");
    el.status = $("permissions-status");
    el.modeChip = $("permissions-mode-chip");
    el.editChip = $("permissions-edit-chip");
    el.modeCopy = $("permissions-mode-copy");
    el.summaryGrid = $("permissions-summary-grid");
    el.scopeSwitch = $("permissions-scope-switch");
    el.registryVersion = $("permissions-registry-version");
    el.resolutionOrder = $("permissions-resolution-order");
    el.liveCount = $("permissions-live-count");
    el.developerCount = $("permissions-developer-count");
    el.refresh = $("permissions-refresh");
    el.edit = $("permissions-edit");
    el.save = $("permissions-save");
    el.cancel = $("permissions-cancel");
    el.editorTitle = $("permissions-editor-title");
    el.editorCopy = $("permissions-editor-copy");
    el.roleEditor = $("permissions-role-editor");
    el.userEditor = $("permissions-user-editor");
    el.effectiveSummary = $("permissions-effective-summary");
    el.userSearch = $("permissions-user-search");
    el.userList = $("permissions-user-list");
    el.selectedUser = $("permissions-selected-user");
    el.scaffolds = $("permissions-future-scaffolds");
  }

  function init() {
    cacheElements();
    bindEvents();
    window.StreamSuitesAdminShell?.resetSectionShellSections?.("permissions");
    void hydrate();
  }

  function destroy() {}

  window.PermissionsView = {
    init,
    destroy
  };
})();

(() => {
  "use strict";

  const PERMISSIONS_ENDPOINT = "/admin/permissions";

  const state = {
    payload: null,
    accounts: [],
    filteredAccounts: [],
    scope: "role",
    canManage: false,
    rolePolicyDraft: {},
    userOverrideDraft: {},
    selectedUserId: "",
    search: "",
    pending: false
  };

  const el = {};

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

  function coerceText(value, fallback = "") {
    if (value === undefined || value === null) return fallback;
    const normalized = String(value).trim();
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

  function formatTimestamp(value) {
    if (!value) return "Never";
    const date = new Date(typeof value === "number" ? value * 1000 : value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, { hour12: false });
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

  function countEnabledPermissions(policy) {
    return Object.values(policy || {}).filter((value) => value === true).length;
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

  function applySearch() {
    const query = state.search.toLowerCase();
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
      resetSelectedUserDraft();
    }
  }

  function resetSelectedUserDraft() {
    const account = getSelectedAccount();
    state.userOverrideDraft = { ...(account?.admin_permissions_overrides || {}) };
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

  function renderRoleEditor() {
    if (!el.roleEditor) return;
    const disabledAttr = !state.canManage || state.pending ? "disabled" : "";
    const groups = groupEntries(getLiveEntries());
    el.roleEditor.innerHTML = groups
      .map(
        (group) => `
          <section class="ss-permissions-group">
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
                  const checked = state.rolePolicyDraft[key] === true ? "checked" : "";
                  const viewNames = Array.isArray(entry?.view_names) ? entry.view_names.filter(Boolean) : [];
                  return `
                    <label class="ss-permissions-row">
                      <span class="ss-permissions-row-copy">
                        <span class="ss-permissions-row-title">${escapeHtml(entry?.label || key)}</span>
                        <span class="ss-permissions-row-meta">${escapeHtml(entry?.description || "")}</span>
                        <span class="ss-permissions-row-key">${escapeHtml(key)}</span>
                        ${
                          viewNames.length
                            ? `<span class="ss-permissions-row-note">Routes: ${escapeHtml(viewNames.join(", "))}</span>`
                            : '<span class="ss-permissions-row-note">Action/control permission</span>'
                        }
                      </span>
                      <span class="ss-permissions-toggle">
                        <input type="checkbox" data-role-permission="${escapeHtml(key)}" ${checked} ${disabledAttr} />
                        <span>${checked ? "Allowed" : "Denied"}</span>
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

  function renderUserEditor() {
    if (!el.userEditor) return;
    const account = getSelectedAccount();
    if (!account) {
      el.userEditor.innerHTML = '<div class="ss-permissions-empty">Select a developer-capable account to edit user overrides.</div>';
      return;
    }
    const disabledAttr = !state.canManage || state.pending ? "disabled" : "";
    const groups = groupEntries(getLiveEntries());
    el.userEditor.innerHTML = groups
      .map(
        (group) => `
          <section class="ss-permissions-group">
            <div class="ss-permissions-group-head">
              <div>
                <h4>${escapeHtml(group.label)}</h4>
                <p class="muted">Per-user overrides for ${escapeHtml(account.display_name || account.user_code || account.email || "selected account")}.</p>
              </div>
            </div>
            <div class="ss-permissions-group-list">
              ${group.items
                .map((entry) => {
                  const key = coerceText(entry?.key);
                  const overrideMode = coerceText(state.userOverrideDraft?.[key]?.mode).toLowerCase();
                  return `
                    <div class="ss-permissions-row">
                      <span class="ss-permissions-row-copy">
                        <span class="ss-permissions-row-title">${escapeHtml(entry?.label || key)}</span>
                        <span class="ss-permissions-row-meta">${escapeHtml(entry?.description || "")}</span>
                        <span class="ss-permissions-row-key">${escapeHtml(key)}</span>
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
    el.userList.innerHTML = state.filteredAccounts
      .map((account) => {
        const selected = String(account?.id || "") === state.selectedUserId;
        const overrideCount = Object.keys(account?.admin_permissions_overrides || {}).length;
        const adminAccess = account?.admin_access || {};
        const accessBadge = adminAccess?.allowed
          ? '<span class="ss-badge ss-badge-success">Dashboard access</span>'
          : '<span class="ss-badge ss-badge-warning">No dashboard access</span>';
        return `
          <button type="button" class="ss-permissions-user-card${selected ? " is-active" : ""}" data-select-user="${escapeHtml(account?.id || "")}">
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
    const overrideKeys = Object.keys(account?.admin_permissions_overrides || {});
    el.selectedUser.innerHTML = `
      <div class="ss-permissions-selected-grid">
        <div class="ss-permissions-selected-card">
          <span class="ss-permissions-card-kicker">Account</span>
          <strong>${escapeHtml(account.display_name || account.user_code || account.email || "Unknown")}</strong>
          <p class="muted">${escapeHtml(account.email || account.user_code || "")}</p>
        </div>
        <div class="ss-permissions-selected-card">
          <span class="ss-permissions-card-kicker">Effective access</span>
          <strong>${access?.allowed ? "Dashboard enabled" : "Dashboard blocked"}</strong>
          <p class="muted">${escapeHtml(access?.reason || "unknown")}</p>
        </div>
        <div class="ss-permissions-selected-card">
          <span class="ss-permissions-card-kicker">Effective live permissions</span>
          <strong>${escapeHtml(String(enabledKeys.length))}</strong>
          <p class="muted">${escapeHtml(`${overrideKeys.length} user override${overrideKeys.length === 1 ? "" : "s"}`)}</p>
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
    const scopeLabel = state.scope === "user" ? "Selected user effective result" : "Developer role default baseline";
    const activePolicy =
      state.scope === "user" && account
        ? selectedAccess
        : {
            allowed: state.rolePolicyDraft["admin.dashboard.access"] === true,
            effective_permission_keys: Object.keys(state.rolePolicyDraft).filter(
              (permissionKey) => state.rolePolicyDraft[permissionKey] === true
            ),
            resolution_order:
              state.payload?.authority_model?.resolution_order || currentAdminAccess?.resolutionOrder || []
          };
    const resolutionOrder = Array.isArray(activePolicy?.resolution_order)
      ? activePolicy.resolution_order
      : Array.isArray(state.payload?.authority_model?.resolution_order)
        ? state.payload.authority_model.resolution_order
        : [];
    el.effectiveSummary.innerHTML = `
      <div class="ss-permissions-selected-card">
        <span class="ss-permissions-card-kicker">${escapeHtml(scopeLabel)}</span>
        <strong>${activePolicy?.allowed ? "Dashboard access resolves to allow" : "Dashboard access resolves to deny"}</strong>
        <p class="muted">${state.scope === "user" ? "Selected account payload, already resolved by StreamSuites." : "Role default snapshot before any individual override is applied."}</p>
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
          <dt>Current operator</dt>
          <dd>${escapeHtml(currentAdminAccess?.allowed ? "Authorized" : "Read-only or unavailable")}</dd>
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
    el.scopeSwitch?.querySelectorAll("[data-permissions-scope]").forEach((button) => {
      const active = button.getAttribute("data-permissions-scope") === state.scope;
      button.classList.toggle("ss-btn-primary", active);
      button.classList.toggle("ss-btn-secondary", !active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    el.editorTitle.textContent = isUser ? "User overrides" : "Role defaults";
    el.editorCopy.textContent = isUser
      ? "User overrides sit on top of the developer role baseline and can allow or deny individual live permissions."
      : "Developer role policy is the shared baseline for dashboard access before any per-user override is applied.";
    el.roleEditor.classList.toggle("hidden", isUser);
    el.userEditor.classList.toggle("hidden", !isUser);
    el.saveRole.classList.toggle("hidden", isUser);
    el.saveUser.classList.toggle("hidden", !isUser);
  }

  function renderSummary() {
    if (!el.summaryGrid) return;
    const rolePolicy = state.payload?.role_policies?.developer || {};
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
        <p class="muted">Live permissions currently enabled in the developer role default.</p>
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
      el.modeChip.textContent = state.canManage ? "Editable policy surface" : "Read-only inspection";
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

  function renderAll() {
    renderSummary();
    renderMeta();
    renderRoleEditor();
    renderUserEditor();
    renderUserList();
    renderSelectedUser();
    renderEffectiveSummary();
    renderScaffolds();
    syncEditorScope();
  }

  async function hydrate() {
    setStatus("Loading authoritative permission registry…");
    setBanner("");
    try {
      const permissionsPayload = await requestJson(PERMISSIONS_ENDPOINT);
      state.payload = permissionsPayload;
      state.accounts = normalizeAccounts({
        accounts: Array.isArray(permissionsPayload?.accounts) ? permissionsPayload.accounts : []
      });
      state.rolePolicyDraft = {
        ...(permissionsPayload?.role_policies?.developer || permissionsPayload?.defaults?.developer || {})
      };
      if (!state.selectedUserId && state.accounts[0]?.id) {
        state.selectedUserId = String(state.accounts[0].id);
      }
      resetSelectedUserDraft();
      applySearch();
      state.canManage =
        window.StreamSuitesDashboardPermissions?.has?.("admin.dashboard.manage.permissions") ===
        true;
      renderAll();
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
    if (!state.canManage || state.pending) return;
    state.pending = true;
    setStatus("Saving developer role policy…");
    try {
      state.payload = await requestJson(PERMISSIONS_ENDPOINT, {
        method: "PUT",
        body: JSON.stringify({
          role_policies: {
            developer: state.rolePolicyDraft
          }
        })
      });
      setBanner("Developer role policy saved to StreamSuites.", "success");
      renderAll();
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
    if (!state.canManage || state.pending || !account?.id) return;
    state.pending = true;
    setStatus(`Saving overrides for ${account.display_name || account.user_code || account.email || account.id}…`);
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
      resetSelectedUserDraft();
      applySearch();
      setBanner("User override policy saved to StreamSuites.", "success");
      renderAll();
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
      void hydrate();
    });
    el.scopeSwitch?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-permissions-scope]");
      if (!(button instanceof HTMLButtonElement)) return;
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
      state.selectedUserId = coerceText(button.getAttribute("data-select-user"));
      resetSelectedUserDraft();
      state.scope = "user";
      renderAll();
    });
    el.roleEditor?.addEventListener("change", (event) => {
      const input = event.target.closest("[data-role-permission]");
      if (!(input instanceof HTMLInputElement)) return;
      state.rolePolicyDraft[input.getAttribute("data-role-permission")] = input.checked;
      renderEffectiveSummary();
    });
    el.userEditor?.addEventListener("change", (event) => {
      const select = event.target.closest("[data-user-permission]");
      if (!(select instanceof HTMLSelectElement)) return;
      const permissionKey = coerceText(select.getAttribute("data-user-permission"));
      const mode = coerceText(select.value).toLowerCase();
      if (!mode) {
        delete state.userOverrideDraft[permissionKey];
      } else {
        state.userOverrideDraft[permissionKey] = { mode };
      }
      renderEffectiveSummary();
    });
    el.saveRole?.addEventListener("click", () => {
      void saveRolePolicy();
    });
    el.saveUser?.addEventListener("click", () => {
      void saveUserOverrides();
    });
  }

  function cacheElements() {
    el.banner = $("permissions-banner");
    el.status = $("permissions-status");
    el.modeChip = $("permissions-mode-chip");
    el.summaryGrid = $("permissions-summary-grid");
    el.scopeSwitch = $("permissions-scope-switch");
    el.registryVersion = $("permissions-registry-version");
    el.resolutionOrder = $("permissions-resolution-order");
    el.liveCount = $("permissions-live-count");
    el.developerCount = $("permissions-developer-count");
    el.refresh = $("permissions-refresh");
    el.editorTitle = $("permissions-editor-title");
    el.editorCopy = $("permissions-editor-copy");
    el.saveRole = $("permissions-save-role");
    el.saveUser = $("permissions-save-user");
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
    void hydrate();
  }

  function destroy() {}

  window.PermissionsView = {
    init,
    destroy
  };
})();

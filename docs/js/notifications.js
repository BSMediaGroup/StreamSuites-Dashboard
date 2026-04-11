(() => {
  "use strict";

  const PREFS_STORAGE_KEY = "streamsuites.notifications.prefs.v1";
  const PREVIEW_LIMIT = 5;
  const NOTIFICATIONS_EVENT = "streamsuites:notifications-updated";
  const NOTIFICATIONS_ENDPOINT_PATH = "/api/admin/notifications";
  const NOTIFICATIONS_DEFAULT_LIMIT = 50;

  const DEFAULT_PREFS = Object.freeze({
    muteAll: false,
    mutedTypes: [],
    mutedSeverities: [],
    showMuted: false
  });

  const state = {
    items: [],
    prefs: {
      muteAll: DEFAULT_PREFS.muteAll,
      mutedTypes: new Set(DEFAULT_PREFS.mutedTypes),
      mutedSeverities: new Set(DEFAULT_PREFS.mutedSeverities),
      showMuted: DEFAULT_PREFS.showMuted
    },
    filters: {
      status: "all",
      severity: "all",
      type: "all",
      query: ""
    },
    bound: false,
    initialized: false,
    centerBound: false,
    loaded: false,
    loading: false,
    mutating: false,
    totalCount: 0,
    unreadCount: 0,
    scope: "",
    notes: [],
    lastError: null
  };

  const el = {
    root: null,
    toggle: null,
    badge: null,
    dropdown: null,
    list: null,
    markAll: null,
    viewAll: null
  };

  const center = {
    root: null,
    count: null,
    unread: null,
    markAll: null,
    toggleRead: null,
    filterStatus: null,
    filterSeverity: null,
    filterType: null,
    filterSearch: null,
    list: null,
    empty: null,
    muteAll: null,
    showMuted: null,
    muteTypes: null,
    muteSeverities: null
  };

  function cacheDropdownElements() {
    el.root = document.querySelector("[data-notifications-widget]");
    el.toggle = document.getElementById("notifications-toggle");
    el.badge = document.getElementById("notifications-badge");
    el.dropdown = document.getElementById("notifications-dropdown");
    el.list = document.getElementById("notifications-list");
    el.markAll = document.getElementById("notifications-mark-all");
    el.viewAll = document.getElementById("notifications-view-all");

    return Boolean(
      el.root &&
        el.toggle &&
        el.badge &&
        el.dropdown &&
        el.list &&
        el.markAll &&
        el.viewAll
    );
  }

  function cacheCenterElements() {
    center.root = document.getElementById("notifications-center-root");
    center.count = document.getElementById("notifications-center-count");
    center.unread = document.getElementById("notifications-center-unread");
    center.markAll = document.getElementById("notifications-center-mark-all");
    center.toggleRead = document.getElementById("notifications-center-toggle-read");
    center.filterStatus = document.getElementById("notifications-filter-status");
    center.filterSeverity = document.getElementById("notifications-filter-severity");
    center.filterType = document.getElementById("notifications-filter-type");
    center.filterSearch = document.getElementById("notifications-filter-search");
    center.list = document.getElementById("notifications-center-list");
    center.empty = document.getElementById("notifications-center-empty");
    center.muteAll = document.getElementById("notifications-mute-all");
    center.showMuted = document.getElementById("notifications-show-muted");
    center.muteTypes = document.getElementById("notifications-mute-types");
    center.muteSeverities = document.getElementById("notifications-mute-severities");

    return Boolean(
      center.root &&
        center.count &&
        center.unread &&
        center.markAll &&
        center.toggleRead &&
        center.filterStatus &&
        center.filterSeverity &&
        center.filterType &&
        center.filterSearch &&
        center.list &&
        center.empty &&
        center.muteAll &&
        center.showMuted &&
        center.muteTypes &&
        center.muteSeverities
    );
  }

  function isDropdownOpen() {
    return !el.dropdown?.classList.contains("hidden");
  }

  function setDropdownOpen(open) {
    if (!el.dropdown || !el.toggle) return;
    el.dropdown.classList.toggle("hidden", !open);
    el.toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function sanitizeStringList(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
      .filter(Boolean);
  }

  function loadPrefs() {
    if (typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      state.prefs.muteAll = parsed.muteAll === true;
      state.prefs.mutedTypes = new Set(sanitizeStringList(parsed.mutedTypes));
      state.prefs.mutedSeverities = new Set(sanitizeStringList(parsed.mutedSeverities));
      state.prefs.showMuted = parsed.showMuted === true;
    } catch (err) {
      console.warn("[Notifications] Failed to load preferences", err);
    }
  }

  function persistPrefs() {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(
        PREFS_STORAGE_KEY,
        JSON.stringify({
          muteAll: state.prefs.muteAll,
          mutedTypes: Array.from(state.prefs.mutedTypes),
          mutedSeverities: Array.from(state.prefs.mutedSeverities),
          showMuted: state.prefs.showMuted
        })
      );
    } catch (err) {
      console.warn("[Notifications] Failed to persist preferences", err);
    }
  }

  function normalizeSeverity(value) {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (normalized === "warn") return "warning";
    if (normalized === "warning" || normalized === "critical" || normalized === "info" || normalized === "error") {
      return normalized;
    }
    return "info";
  }

  function normalizeType(value) {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    return normalized || "system";
  }

  function normalizeLink(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeDate(value) {
    if (!(typeof value === "string" || typeof value === "number")) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  function normalizeNotification(raw, index) {
    if (!raw || typeof raw !== "object") return null;
    const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `notification-${index + 1}`;
    const createdAtDate = normalizeDate(raw.created_at || raw.createdAt || "");
    const readAtDate = normalizeDate(raw.read_at || raw.readAt || "");
    const title =
      typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Untitled notification";
    const message = typeof raw.message === "string" && raw.message.trim() ? raw.message.trim() : "";
    return {
      id,
      type: normalizeType(raw.type),
      severity: normalizeSeverity(raw.severity),
      createdAtIso: createdAtDate ? createdAtDate.toISOString() : null,
      createdAtMs: createdAtDate ? createdAtDate.getTime() : 0,
      readAtIso: readAtDate ? readAtDate.toISOString() : null,
      isRead: raw.is_read === true || raw.isRead === true || Boolean(readAtDate),
      title,
      message,
      link: normalizeLink(raw.link),
      source: typeof raw.source === "string" && raw.source.trim() ? raw.source.trim() : "",
      searchText: `${title} ${message}`.toLowerCase()
    };
  }

  function extractNotifications(payload) {
    if (payload && typeof payload === "object" && Array.isArray(payload.items)) return payload.items;
    if (payload && typeof payload === "object" && Array.isArray(payload.notifications)) return payload.notifications;
    if (Array.isArray(payload)) return payload;
    return [];
  }

  function resolveApiBase() {
    const explicitBase =
      window.StreamSuitesAdminAuth?.config?.baseUrl ||
      document.querySelector('meta[name="streamsuites-auth-base"]')?.getAttribute("content") ||
      "";
    return explicitBase ? String(explicitBase).replace(/\/+$/, "") : "";
  }

  function buildApiUrl(path) {
    const base = resolveApiBase();
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return base ? `${base}${normalized}` : normalized;
  }

  function normalizeErrorFromResponse(status, payload) {
    const message =
      (payload && typeof payload.error === "string" && payload.error.trim()) ||
      (payload && typeof payload.message === "string" && payload.message.trim()) ||
      `Notifications request failed with status ${status}.`;
    return { status, message };
  }

  async function fetchNotificationsFromApi() {
    const endpoint = buildApiUrl(NOTIFICATIONS_ENDPOINT_PATH);
    const url = `${endpoint}?limit=${encodeURIComponent(String(NOTIFICATIONS_DEFAULT_LIMIT))}`;
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (err) {
      payload = null;
    }
    if (!response.ok) {
      throw normalizeErrorFromResponse(response.status, payload);
    }
    return payload && typeof payload === "object" ? payload : {};
  }

  function applyPayload(payload) {
    const list = extractNotifications(payload)
      .map((entry, index) => normalizeNotification(entry, index))
      .filter(Boolean)
      .sort((a, b) => b.createdAtMs - a.createdAtMs || String(b.id).localeCompare(String(a.id)));

    state.items = list;
    state.totalCount = Number.isFinite(payload?.total_count) ? Math.max(0, Number(payload.total_count)) : list.length;
    state.unreadCount = Number.isFinite(payload?.unread_count)
      ? Math.max(0, Number(payload.unread_count))
      : list.reduce((count, item) => count + (item.isRead ? 0 : 1), 0);
    state.scope = typeof payload?.scope === "string" ? payload.scope : "";
    state.notes = Array.isArray(payload?.notes)
      ? payload.notes.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [];
    state.lastError = null;
    state.loaded = true;
  }

  function applyFailure(errorLike) {
    const status = Number.isFinite(Number(errorLike?.status)) ? Number(errorLike.status) : null;
    const message =
      typeof errorLike?.message === "string" && errorLike.message.trim()
        ? errorLike.message.trim()
        : "Notifications are temporarily unavailable.";
    state.items = [];
    state.totalCount = 0;
    state.unreadCount = 0;
    state.scope = "";
    state.lastError = status ? { status, message } : { message };
    state.notes =
      status === 401 || status === 403
        ? ["Sign in again to load admin notifications."]
        : ["Notifications are temporarily unavailable."];
    state.loaded = true;
  }

  async function loadNotifications(options = {}) {
    const showLoader = options.showLoader !== false;
    const loaderToken =
      showLoader && !state.loaded
        ? window.StreamSuitesGlobalLoader?.startLoading?.("Hydrating notifications...")
        : null;

    state.loading = true;
    render();
    try {
      const payload = await fetchNotificationsFromApi();
      applyPayload(payload);
    } catch (err) {
      applyFailure(err);
    } finally {
      state.loading = false;
      render();
      if (loaderToken) {
        window.StreamSuitesGlobalLoader?.stopLoading?.(loaderToken);
      }
    }
  }

  async function requestMutation(payload) {
    state.mutating = true;
    render();
    try {
      const response = await fetch(buildApiUrl(NOTIFICATIONS_ENDPOINT_PATH), {
        method: "PATCH",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload || {})
      });
      let body = null;
      try {
        body = await response.json();
      } catch (err) {
        body = null;
      }
      if (!response.ok) {
        throw normalizeErrorFromResponse(response.status, body);
      }
      await loadNotifications({ showLoader: false });
    } catch (err) {
      applyFailure(err);
      render();
    } finally {
      state.mutating = false;
      render();
    }
  }

  function formatTimestamp(isoValue, millisValue) {
    if (!isoValue || !millisValue) return "Unknown time";
    const diffMs = Date.now() - millisValue;
    if (diffMs >= 0 && diffMs < 60 * 1000) return "just now";
    if (diffMs >= 0 && diffMs < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diffMs / (60 * 1000)))}m ago`;
    if (diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000) return `${Math.max(1, Math.floor(diffMs / (60 * 60 * 1000)))}h ago`;
    if (diffMs >= 0 && diffMs < 7 * 24 * 60 * 60 * 1000) return `${Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)))}d ago`;
    try {
      const date = new Date(isoValue);
      const currentYear = new Date().getFullYear();
      const options =
        date.getFullYear() === currentYear
          ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
          : { year: "numeric", month: "short", day: "numeric" };
      return date.toLocaleString(undefined, options);
    } catch (err) {
      return "Unknown time";
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatTypeLabel(type) {
    const safe = typeof type === "string" ? type : "system";
    return safe.charAt(0).toUpperCase() + safe.slice(1);
  }

  function formatSeverityLabel(severity) {
    const safe = normalizeSeverity(severity);
    return safe.charAt(0).toUpperCase() + safe.slice(1);
  }

  function isRead(item) {
    return Boolean(item?.isRead);
  }

  function isMuted(item) {
    return (
      state.prefs.muteAll ||
      state.prefs.mutedTypes.has(item.type) ||
      state.prefs.mutedSeverities.has(item.severity)
    );
  }

  function getUnreadCount() {
    return Math.max(0, Number(state.unreadCount) || 0);
  }

  function getTypeValues() {
    return Array.from(new Set(state.items.map((item) => item.type))).sort();
  }

  function getSeverityValues() {
    return Array.from(new Set(state.items.map((item) => item.severity))).sort((a, b) => {
      const order = ["info", "warning", "error", "critical"];
      return order.indexOf(a) - order.indexOf(b);
    });
  }

  function getFilteredItems(options = {}) {
    const showMuted = options.showMuted === true;
    const status = options.status || "all";
    const severity = options.severity || "all";
    const type = options.type || "all";
    const query = (options.query || "").trim().toLowerCase();
    return state.items.filter((item) => {
      const read = isRead(item);
      const muted = isMuted(item);
      if (!showMuted && muted) return false;
      if (status === "read" && !read) return false;
      if (status === "unread" && read) return false;
      if (severity !== "all" && item.severity !== severity) return false;
      if (type !== "all" && item.type !== type) return false;
      if (query && !item.searchText.includes(query)) return false;
      return true;
    });
  }

  function formatBadgeCount(unreadCount) {
    if (unreadCount <= 0) return "";
    return unreadCount > 99 ? "99+" : String(unreadCount);
  }

  function renderBadge(unreadCount) {
    if (!el.badge || !el.toggle) return;
    const visible = unreadCount > 0;
    el.badge.classList.toggle("hidden", !visible);
    el.badge.textContent = visible ? formatBadgeCount(unreadCount) : "";
    el.toggle.setAttribute("aria-label", visible ? `Open notifications (${unreadCount} unread)` : "Open notifications");
  }

  function renderDropdownList() {
    if (!el.list) return;
    const preview = getFilteredItems({
      showMuted: false,
      status: "all",
      severity: "all",
      type: "all",
      query: ""
    }).slice(0, PREVIEW_LIMIT);

    if (!preview.length) {
      const noteText = state.notes.length ? `<div class="ss-notifications-empty muted">${escapeHtml(state.notes.join(" "))}</div>` : "";
      if (state.loading) {
        el.list.innerHTML = '<div class="ss-notifications-empty">Refreshing runtime notifications...</div>';
        return;
      }
      if (state.lastError) {
        el.list.innerHTML = `
          <div class="ss-notifications-empty">Notifications unavailable.</div>
          ${noteText}
        `;
        return;
      }
      el.list.innerHTML = `
        <div class="ss-notifications-empty">No notifications available.</div>
        ${noteText}
      `;
      return;
    }

    el.list.innerHTML = preview
      .map((item) => {
        const title = escapeHtml(item.title);
        const message = escapeHtml(item.message);
        const timestamp = escapeHtml(formatTimestamp(item.createdAtIso, item.createdAtMs));
        const source = item.source ? ` • ${escapeHtml(item.source)}` : "";
        return `
          <button
            type="button"
            class="ss-notification-item${isRead(item) ? " is-read" : ""}"
            data-notification-id="${escapeHtml(item.id)}"
            data-notification-link="${escapeHtml(item.link)}"
          >
            <div class="ss-notification-topline">
              <span class="ss-notification-title">${title}</span>
              <span class="ss-notification-severity ${escapeHtml(item.severity)}">${escapeHtml(
                formatSeverityLabel(item.severity)
              )}</span>
            </div>
            <p class="ss-notification-message">${message || "No summary available."}</p>
            <span class="ss-notification-meta">${timestamp}${source}</span>
          </button>
        `;
      })
      .join("");
  }

  function renderMarkAllState(unreadCount) {
    if (el.markAll) {
      el.markAll.disabled = unreadCount <= 0 || state.mutating;
      el.markAll.classList.toggle("disabled", el.markAll.disabled);
    }
    if (center.markAll) {
      center.markAll.disabled = unreadCount <= 0 || state.mutating;
    }
  }

  function renderFilterOptions(select, values, labelFormatter) {
    if (!select) return;
    const current = select.value || "all";
    const options = [`<option value="all">All ${select.id.includes("type") ? "types" : "severities"}</option>`]
      .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labelFormatter(value))}</option>`))
      .join("");
    select.innerHTML = options;
    if (values.includes(current)) {
      select.value = current;
    } else {
      select.value = "all";
      if (select === center.filterType) state.filters.type = "all";
      if (select === center.filterSeverity) state.filters.severity = "all";
    }
  }

  function renderMuteList(container, values, setRef, name, labelFormatter) {
    if (!container) return;
    if (!values.length) {
      container.innerHTML = '<p class="muted">No values available.</p>';
      return;
    }
    container.innerHTML = values
      .map((value) => {
        const checked = setRef.has(value) ? "checked" : "";
        return `
          <label class="ss-notifications-setting-toggle small ss-checkbox-wrapper">
            <input type="checkbox" data-mute-group="${name}" value="${escapeHtml(value)}" ${checked} />
            <div class="ss-checkbox"></div>
            <span class="ss-checkbox-text">${escapeHtml(labelFormatter(value))}</span>
          </label>
        `;
      })
      .join("");
  }

  function renderCenterEmpty(filtered, unreadCount) {
    if (!center.empty) return;
    if (filtered.length) {
      center.empty.classList.add("hidden");
      return;
    }
    center.empty.classList.remove("hidden");
    const title = center.empty.querySelector("h3");
    const text = center.empty.querySelector("p.muted");
    if (state.loading) {
      if (title) title.textContent = "Refreshing notifications";
      if (text) text.textContent = "Waiting for the runtime notification feed.";
      return;
    }
    if (state.lastError?.status === 401 || state.lastError?.status === 403) {
      if (title) title.textContent = "Session required";
      if (text) text.textContent = "Sign in again to load admin notifications.";
      return;
    }
    if (state.lastError) {
      if (title) title.textContent = "Notifications unavailable";
      if (text) text.textContent = state.notes[0] || "Runtime notification hydration failed.";
      return;
    }
    if (!state.items.length && unreadCount === 0) {
      if (title) title.textContent = "Inbox is clear";
      if (text) text.textContent = "No runtime notifications are currently scoped to this account.";
      return;
    }
    if (title) title.textContent = "No notifications found";
    if (text) text.textContent = "Adjust filters or show muted notifications to broaden results.";
  }

  function renderCenterList() {
    if (!center.root || !center.list || !center.empty) return;
    const filtered = getFilteredItems({
      showMuted: state.prefs.showMuted,
      status: state.filters.status,
      severity: state.filters.severity,
      type: state.filters.type,
      query: state.filters.query
    });
    const unreadCount = getUnreadCount();

    center.count.textContent = `${state.totalCount} total`;
    center.unread.textContent = `${unreadCount} unread`;
    center.toggleRead.textContent = state.filters.status === "unread" ? "Show read" : "Hide read";
    center.filterStatus.value = state.filters.status;
    center.filterSearch.value = state.filters.query;
    center.muteAll.checked = state.prefs.muteAll;
    center.showMuted.checked = state.prefs.showMuted;

    renderFilterOptions(center.filterSeverity, getSeverityValues(), formatSeverityLabel);
    renderFilterOptions(center.filterType, getTypeValues(), formatTypeLabel);
    renderMuteList(center.muteTypes, getTypeValues(), state.prefs.mutedTypes, "type", formatTypeLabel);
    renderMuteList(center.muteSeverities, getSeverityValues(), state.prefs.mutedSeverities, "severity", formatSeverityLabel);
    renderCenterEmpty(filtered, unreadCount);

    if (!filtered.length) {
      center.list.innerHTML = "";
      return;
    }

    center.list.innerHTML = filtered
      .map((item) => {
        const muted = isMuted(item);
        const classes = ["ss-notifications-center-item"];
        if (!isRead(item)) classes.push("is-unread");
        if (isRead(item)) classes.push("is-read");
        if (muted) classes.push("is-muted");
        const timestamp = escapeHtml(formatTimestamp(item.createdAtIso, item.createdAtMs));
        const source = item.source ? ` • ${escapeHtml(item.source)}` : "";
        const linkAction = item.link
          ? `<button type="button" class="ss-btn ss-btn-secondary ss-btn-small ss-notifications-action-go" data-action="go" data-id="${escapeHtml(
              item.id
            )}" data-link="${escapeHtml(item.link)}">Go to</button>`
          : "";
        return `
          <article class="${classes.join(" ")}" data-item-id="${escapeHtml(item.id)}">
            <div class="ss-notifications-center-indicator" aria-hidden="true"></div>
            <div class="ss-notifications-center-content">
              <div class="ss-notifications-center-title-row">
                <h3>${escapeHtml(item.title)}</h3>
                <div class="ss-notifications-center-chips">
                  <span class="ss-notification-severity ${escapeHtml(item.severity)}">${escapeHtml(
                    formatSeverityLabel(item.severity)
                  )}</span>
                  <span class="ss-chip ss-notifications-type-chip">${escapeHtml(formatTypeLabel(item.type))}</span>
                  ${muted ? '<span class="ss-chip ss-notifications-muted-chip">Muted</span>' : ""}
                </div>
              </div>
              <p>${escapeHtml(item.message || "No summary available.")}</p>
              <div class="ss-notifications-center-meta">${timestamp}${source}</div>
            </div>
            <div class="ss-notifications-center-row-actions">
              <button type="button" class="ss-btn ss-btn-secondary ss-btn-small" data-action="toggle-read" data-id="${escapeHtml(
                item.id
              )}" ${state.mutating ? "disabled" : ""}>${isRead(item) ? "Mark unread" : "Mark read"}</button>
              ${linkAction}
            </div>
          </article>
        `;
      })
      .join("");
  }

  function emitUpdate() {
    try {
      window.dispatchEvent(
        new CustomEvent(NOTIFICATIONS_EVENT, {
          detail: {
            unread: getUnreadCount(),
            total: state.totalCount,
            scope: state.scope,
            loading: state.loading,
            mutating: state.mutating,
            lastError: state.lastError
          }
        })
      );
    } catch (err) {
      // Ignore dispatch failures in restricted environments.
    }
  }

  function render() {
    const unreadCount = getUnreadCount();
    renderBadge(unreadCount);
    renderDropdownList();
    renderMarkAllState(unreadCount);
    renderCenterList();
    emitUpdate();
  }

  function navigateToLink(link) {
    const normalized = typeof link === "string" ? link.trim() : "";
    if (!normalized) return;
    if (normalized.startsWith("#")) {
      const route = window.StreamSuitesAdminRoutes?.resolveViewFromHash?.(normalized);
      if (route?.view) {
        window.StreamSuitesAdminRoutes.navigateToView(route.view, { params: route.queryString });
        return;
      }
      window.location.hash = normalized;
      return;
    }
    if (normalized.startsWith("/")) {
      window.location.assign(normalized);
      return;
    }
    if (/^https?:\/\//i.test(normalized)) {
      window.location.assign(normalized);
      return;
    }
    const route = window.StreamSuitesAdminRoutes?.resolveViewFromHash?.(`#${normalized.replace(/^#+/, "")}`);
    if (route?.view) {
      window.StreamSuitesAdminRoutes.navigateToView(route.view, { params: route.queryString });
      return;
    }
    window.location.hash = `#${normalized.replace(/^#+/, "")}`;
  }

  async function markRead(id) {
    if (!id) return;
    await requestMutation({ notification_ids: [id], read: true });
  }

  async function markUnread(id) {
    if (!id) return;
    await requestMutation({ notification_ids: [id], read: false });
  }

  async function toggleRead(id) {
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return;
    if (item.isRead) {
      await markUnread(id);
      return;
    }
    await markRead(id);
  }

  async function markAllRead() {
    await requestMutation({ mark_all: true, read: true });
  }

  function updateMuteSetFromCheckbox(container, targetSet) {
    targetSet.clear();
    if (!container) return;
    container.querySelectorAll('input[type="checkbox"]:checked').forEach((input) => {
      const value = typeof input.value === "string" ? input.value.trim().toLowerCase() : "";
      if (value) targetSet.add(value);
    });
  }

  function bindEvents() {
    if (state.bound) return;
    state.bound = true;

    if (el.toggle) {
      el.toggle.addEventListener("click", async () => {
        setDropdownOpen(!isDropdownOpen());
        if (isDropdownOpen() && !state.loading) {
          await loadNotifications({ showLoader: false });
        }
      });
    }

    if (el.list) {
      el.list.addEventListener("click", async (event) => {
        const button = event.target.closest(".ss-notification-item");
        if (!button) return;
        const id = button.dataset.notificationId || "";
        const link = button.dataset.notificationLink || "";
        const item = state.items.find((entry) => entry.id === id);
        if (item && !item.isRead) {
          await markRead(id);
        }
        setDropdownOpen(false);
        navigateToLink(link);
      });
    }

    if (el.markAll) {
      el.markAll.addEventListener("click", () => {
        void markAllRead();
      });
    }

    if (el.viewAll) {
      el.viewAll.addEventListener("click", () => {
        setDropdownOpen(false);
      });
    }

    document.addEventListener("click", (event) => {
      if (!isDropdownOpen()) return;
      if (el.root?.contains(event.target)) return;
      setDropdownOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      setDropdownOpen(false);
    });
  }

  function bindCenterEvents() {
    if (!center.root || state.centerBound) return;
    state.centerBound = true;

    center.markAll.addEventListener("click", () => {
      void markAllRead();
    });

    center.toggleRead.addEventListener("click", () => {
      state.filters.status = state.filters.status === "unread" ? "all" : "unread";
      render();
    });

    center.filterStatus.addEventListener("change", () => {
      state.filters.status = center.filterStatus.value || "all";
      render();
    });

    center.filterSeverity.addEventListener("change", () => {
      state.filters.severity = center.filterSeverity.value || "all";
      render();
    });

    center.filterType.addEventListener("change", () => {
      state.filters.type = center.filterType.value || "all";
      render();
    });

    center.filterSearch.addEventListener("input", () => {
      state.filters.query = center.filterSearch.value || "";
      render();
    });

    center.muteAll.addEventListener("change", () => {
      state.prefs.muteAll = center.muteAll.checked;
      persistPrefs();
      render();
    });

    center.showMuted.addEventListener("change", () => {
      state.prefs.showMuted = center.showMuted.checked;
      persistPrefs();
      render();
    });

    center.muteTypes.addEventListener("change", (event) => {
      if (!event.target.matches('input[type="checkbox"]')) return;
      updateMuteSetFromCheckbox(center.muteTypes, state.prefs.mutedTypes);
      persistPrefs();
      render();
    });

    center.muteSeverities.addEventListener("change", (event) => {
      if (!event.target.matches('input[type="checkbox"]')) return;
      updateMuteSetFromCheckbox(center.muteSeverities, state.prefs.mutedSeverities);
      persistPrefs();
      render();
    });

    center.list.addEventListener("click", async (event) => {
      const actionTarget = event.target.closest("[data-action]");
      if (!actionTarget) return;
      const action = actionTarget.dataset.action || "";
      const id = actionTarget.dataset.id || "";
      if (action === "toggle-read") {
        await toggleRead(id);
        return;
      }
      if (action === "go") {
        const item = state.items.find((entry) => entry.id === id);
        if (item && !item.isRead) {
          await markRead(id);
        }
        navigateToLink(actionTarget.dataset.link || "");
      }
    });
  }

  function unbindCenterState() {
    state.centerBound = false;
    center.root = null;
    center.count = null;
    center.unread = null;
    center.markAll = null;
    center.toggleRead = null;
    center.filterStatus = null;
    center.filterSeverity = null;
    center.filterType = null;
    center.filterSearch = null;
    center.list = null;
    center.empty = null;
    center.muteAll = null;
    center.showMuted = null;
    center.muteTypes = null;
    center.muteSeverities = null;
  }

  async function ensureLoaded() {
    if (state.loaded) return;
    await loadNotifications();
  }

  async function init() {
    if (!cacheDropdownElements()) return;
    if (!state.initialized) {
      state.initialized = true;
      loadPrefs();
      bindEvents();
      await ensureLoaded();
    }
    render();
    if (cacheCenterElements()) {
      bindCenterEvents();
      render();
    }
  }

  async function initCenter() {
    if (!cacheCenterElements()) {
      unbindCenterState();
      return;
    }
    await ensureLoaded();
    bindCenterEvents();
    render();
  }

  function destroyCenter() {
    unbindCenterState();
  }

  async function refresh() {
    await loadNotifications({ showLoader: false });
  }

  window.StreamSuitesNotifications = {
    init,
    initCenter,
    destroyCenter,
    refresh,
    markAllRead,
    getState() {
      return {
        total: state.totalCount,
        unread: getUnreadCount(),
        scope: state.scope,
        notes: state.notes.slice(),
        lastError: state.lastError ? { ...state.lastError } : null,
        prefs: {
          muteAll: state.prefs.muteAll,
          mutedTypes: Array.from(state.prefs.mutedTypes),
          mutedSeverities: Array.from(state.prefs.mutedSeverities),
          showMuted: state.prefs.showMuted
        }
      };
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    void init();
  }
})();

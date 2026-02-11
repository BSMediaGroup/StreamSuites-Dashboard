(() => {
  "use strict";

  const READ_IDS_STORAGE_KEY = "streamsuites.notifications.readIds.v1";
  const PREVIEW_LIMIT = 5;
  const DATA_SOURCES = [
    "runtime/exports/notifications.json",
    "runtime/exports/admin/notifications.json",
    "data/notifications.json"
  ];

  const state = {
    items: [],
    readIds: new Set(),
    bound: false,
    initialized: false
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

  function cacheElements() {
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

  function isDropdownOpen() {
    return !el.dropdown?.classList.contains("hidden");
  }

  function setDropdownOpen(open) {
    if (!el.dropdown || !el.toggle) return;

    el.dropdown.classList.toggle("hidden", !open);
    el.toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function loadReadIds() {
    if (typeof localStorage === "undefined") return;

    try {
      const raw = localStorage.getItem(READ_IDS_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      state.readIds = new Set(
        parsed
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter(Boolean)
      );
    } catch (err) {
      console.warn("[Notifications] Failed to load read IDs", err);
    }
  }

  function persistReadIds() {
    if (typeof localStorage === "undefined") return;

    try {
      localStorage.setItem(READ_IDS_STORAGE_KEY, JSON.stringify(Array.from(state.readIds)));
    } catch (err) {
      console.warn("[Notifications] Failed to persist read IDs", err);
    }
  }

  function normalizeSeverity(value) {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (normalized === "warning" || normalized === "critical" || normalized === "info") {
      return normalized;
    }
    return "";
  }

  function normalizeLink(value) {
    if (typeof value !== "string") return "";
    return value.trim();
  }

  function normalizeDate(value) {
    if (typeof value !== "string") return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  function normalizeNotification(raw, index) {
    if (!raw || typeof raw !== "object") return null;

    const idSource =
      typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `notification-${index + 1}`;

    const createdAtRaw =
      typeof raw.created_at === "string"
        ? raw.created_at
        : typeof raw.createdAt === "string"
          ? raw.createdAt
          : "";

    const createdAtDate = normalizeDate(createdAtRaw);

    return {
      id: idSource,
      type: typeof raw.type === "string" && raw.type.trim() ? raw.type.trim() : "system",
      severity: normalizeSeverity(raw.severity),
      createdAtIso: createdAtDate ? createdAtDate.toISOString() : null,
      createdAtMs: createdAtDate ? createdAtDate.getTime() : 0,
      title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Untitled notification",
      message: typeof raw.message === "string" && raw.message.trim() ? raw.message.trim() : "",
      link: normalizeLink(raw.link),
      source: typeof raw.source === "string" && raw.source.trim() ? raw.source.trim() : ""
    };
  }

  function extractNotifications(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === "object" && Array.isArray(payload.notifications)) {
      return payload.notifications;
    }
    return [];
  }

  async function fetchNotificationsFrom(relativePath) {
    const url = new URL(relativePath, document.baseURI);
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return null;

      const payload = await response.json();
      const list = extractNotifications(payload)
        .map((entry, index) => normalizeNotification(entry, index))
        .filter(Boolean)
        .sort((a, b) => b.createdAtMs - a.createdAtMs);

      return list;
    } catch (err) {
      return null;
    }
  }

  async function loadNotifications() {
    for (const source of DATA_SOURCES) {
      const list = await fetchNotificationsFrom(source);
      if (Array.isArray(list)) {
        state.items = list;
        return;
      }
    }

    state.items = [];
  }

  function formatTimestamp(isoValue, millisValue) {
    if (!isoValue || !millisValue) return "Unknown time";

    const now = Date.now();
    const diffMs = now - millisValue;

    if (diffMs >= 0 && diffMs < 60 * 1000) return "just now";
    if (diffMs >= 0 && diffMs < 60 * 60 * 1000) {
      return `${Math.max(1, Math.floor(diffMs / (60 * 1000)))}m ago`;
    }
    if (diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000) {
      return `${Math.max(1, Math.floor(diffMs / (60 * 60 * 1000)))}h ago`;
    }
    if (diffMs >= 0 && diffMs < 7 * 24 * 60 * 60 * 1000) {
      return `${Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)))}d ago`;
    }

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
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getUnreadCount() {
    return state.items.reduce((count, item) => {
      return state.readIds.has(item.id) ? count : count + 1;
    }, 0);
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

    const ariaLabel = visible
      ? `Open notifications (${unreadCount} unread)`
      : "Open notifications";
    el.toggle.setAttribute("aria-label", ariaLabel);
  }

  function renderList() {
    if (!el.list) return;

    const preview = state.items.slice(0, PREVIEW_LIMIT);
    if (!preview.length) {
      el.list.innerHTML = '<div class="ss-notifications-empty">No notifications available.</div>';
      return;
    }

    const html = preview
      .map((item) => {
        const isRead = state.readIds.has(item.id);
        const title = escapeHtml(item.title);
        const message = escapeHtml(item.message);
        const timestamp = escapeHtml(formatTimestamp(item.createdAtIso, item.createdAtMs));
        const source = item.source ? ` \u2022 ${escapeHtml(item.source)}` : "";
        const severity = item.severity
          ? `<span class="ss-notification-severity ${item.severity}">${escapeHtml(item.severity)}</span>`
          : "";

        return `
          <button
            type="button"
            class="ss-notification-item${isRead ? " is-read" : ""}"
            data-notification-id="${escapeHtml(item.id)}"
            data-notification-link="${escapeHtml(item.link)}"
          >
            <div class="ss-notification-topline">
              <span class="ss-notification-title">${title}</span>
              ${severity}
            </div>
            <p class="ss-notification-message">${message}</p>
            <span class="ss-notification-meta">${timestamp}${source}</span>
          </button>
        `;
      })
      .join("");

    el.list.innerHTML = html;
  }

  function renderMarkAllState(unreadCount) {
    if (!el.markAll) return;
    el.markAll.disabled = unreadCount <= 0;
    el.markAll.classList.toggle("disabled", unreadCount <= 0);
  }

  function render() {
    const unreadCount = getUnreadCount();
    renderBadge(unreadCount);
    renderList();
    renderMarkAllState(unreadCount);
  }

  function markNotificationRead(id) {
    if (!id) return;
    state.readIds.add(id);
    persistReadIds();
    render();
  }

  function markAllRead() {
    state.items.forEach((item) => {
      state.readIds.add(item.id);
    });
    persistReadIds();
    render();
  }

  function navigateToLink(link) {
    const normalized = typeof link === "string" ? link.trim() : "";
    if (!normalized) return;

    if (normalized.startsWith("#")) {
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

    window.location.hash = `#${normalized.replace(/^#+/, "")}`;
  }

  function bindEvents() {
    if (state.bound) return;
    state.bound = true;

    el.toggle.addEventListener("click", () => {
      setDropdownOpen(!isDropdownOpen());
    });

    el.list.addEventListener("click", (event) => {
      const button = event.target.closest(".ss-notification-item");
      if (!button) return;

      const id = button.dataset.notificationId || "";
      const link = button.dataset.notificationLink || "";
      markNotificationRead(id);
      setDropdownOpen(false);
      navigateToLink(link);
    });

    el.markAll.addEventListener("click", () => {
      markAllRead();
    });

    el.viewAll.addEventListener("click", () => {
      setDropdownOpen(false);
    });

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

  async function init() {
    if (!cacheElements()) return;
    if (state.initialized) return;
    state.initialized = true;

    loadReadIds();
    bindEvents();
    await loadNotifications();
    render();
  }

  window.StreamSuitesNotifications = {
    init,
    markAllRead
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

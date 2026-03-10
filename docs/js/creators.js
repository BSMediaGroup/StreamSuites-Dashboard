/* ============================================================
   StreamSuites Dashboard - creators.js (identity linkage)
   ============================================================ */

(() => {
  "use strict";

  const CREATORS_ENDPOINT = "/api/admin/creators";
  const BACKFILL_ENDPOINT = "/api/admin/creators/backfill";

  const el = {
    tableBody: null,
    emptyState: null,
    btnRefresh: null,
    btnBackfill: null,
    btnAddCreator: null,
    btnImport: null,
    btnExport: null,
    editorPanel: null,
    errorBox: null,
    errorText: null,
    backfillStatus: null,
    linkNote: null
  };

  const state = {
    creators: [],
    onRefreshClick: null,
    onBackfillClick: null,
    onTableClick: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getLinkageNavState() {
    if (!window.StreamSuitesIdentityLinkageNav || typeof window.StreamSuitesIdentityLinkageNav !== "object") {
      window.StreamSuitesIdentityLinkageNav = {};
    }
    return window.StreamSuitesIdentityLinkageNav;
  }

  function navigateToView(viewName) {
    if (!viewName) return;
    if (window.StreamSuitesAdminRoutes?.navigateToView) {
      window.StreamSuitesAdminRoutes.navigateToView(viewName);
      return;
    }
    window.location.hash = `#${viewName}`;
  }

  function resolveApiBase() {
    const base =
      window.StreamSuitesAdminAuth?.config?.baseUrl ||
      document
        .querySelector('meta[name="streamsuites-auth-base"]')
        ?.getAttribute("content") ||
      "";
    return base ? base.replace(/\/$/, "") : "";
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
    } catch (err) {
      return null;
    }
  }

  function setError(message) {
    if (!el.errorBox || !el.errorText) return;
    const text = String(message || "").trim();
    el.errorText.textContent = text;
    el.errorBox.classList.toggle("hidden", !text);
  }

  function setBackfillStatus(message) {
    if (!el.backfillStatus) return;
    const text = String(message || "").trim();
    el.backfillStatus.textContent = text;
    el.backfillStatus.classList.toggle("hidden", !text);
  }

  function setLinkNote(message) {
    if (!el.linkNote) return;
    const text = String(message || "").trim();
    el.linkNote.textContent = text;
    el.linkNote.classList.toggle("hidden", !text);
  }

  function normalizedCreators(payload) {
    const rows = Array.isArray(payload?.creators) ? payload.creators : [];
    return rows
      .map((entry) => {
        const userCode = String(entry?.user_code || entry?.creator_id || "").trim();
        if (!userCode) return null;
        const account = entry?.account && typeof entry.account === "object" ? entry.account : {};
        const accountId = String(entry?.account_id || account?.account_id || "").trim();
        const accountEmail = String(entry?.email || account?.email || "").trim();
        const displayName = String(entry?.display_name || account?.display_name || userCode).trim() || userCode;
        const avatarUrl = String(entry?.avatar_url || account?.avatar_url || "").trim();
        const publicProfile = account?.public_profile && typeof account.public_profile === "object" ? account.public_profile : {};
        const status = String(entry?.status || "").trim().toLowerCase() || "pending";
        return {
          user_code: userCode,
          creator_id: userCode,
          display_name: displayName,
          avatar_url: avatarUrl,
          badges: Array.isArray(entry?.badges) ? entry.badges : Array.isArray(account?.badges) ? account.badges : [],
          bio: String(publicProfile?.bio || "").trim(),
          social_links: publicProfile?.social_links && typeof publicProfile.social_links === "object" ? publicProfile.social_links : {},
          cover_image_url: String(publicProfile?.cover_image_url || publicProfile?.banner_image_url || "").trim(),
          public_slug: String(publicProfile?.public_slug || "").trim(),
          status,
          account_id: accountId || "",
          account_email: accountEmail || "",
          orphaned: Boolean(entry?.orphaned || !accountId),
          created_at: entry?.created_at || null,
          activated_at: entry?.activated_at || null
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.user_code.localeCompare(b.user_code));
  }

  function formatTimestamp(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    try {
      return date.toLocaleString(undefined, { hour12: false });
    } catch (err) {
      return String(value);
    }
  }

  function renderStatus(status) {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "active") {
      return '<span class="ss-badge ss-badge-success">Active</span>';
    }
    if (normalized === "suspended") {
      return '<span class="ss-badge ss-badge-danger">Suspended</span>';
    }
    return '<span class="ss-badge ss-badge-warning">Pending</span>';
  }

  function renderAccountLink(creator) {
    const userCode = escapeHtml(creator.user_code);
    const displayName = escapeHtml(creator.display_name || creator.user_code);
    const accountId = escapeHtml(creator.account_id || "");
    const orphaned = creator.orphaned || !creator.account_id;
    const profileHref = `https://streamsuites.app/u/${encodeURIComponent(creator.public_slug || creator.user_code || "")}`;
    const badgeJson = escapeHtml(JSON.stringify(Array.isArray(creator.badges) ? creator.badges : []));
    const socialJson = escapeHtml(JSON.stringify(creator.social_links || {}));
    return `
      <button
        type="button"
        class="ss-link-btn accounts-hover-button"
        data-creator-open-account="${userCode}"
        data-account-id="${accountId}"
        data-orphaned="${orphaned ? "1" : "0"}"
        data-ss-profile-hover-trigger="true"
        data-ss-user-code="${userCode}"
        data-ss-user-id="${accountId}"
        data-ss-display-name="${displayName}"
        data-ss-role="CREATOR"
        data-ss-avatar-url="${escapeHtml(creator.avatar_url || "")}"
        data-ss-cover-url="${escapeHtml(creator.cover_image_url || "")}"
        data-ss-bio="${escapeHtml(creator.bio || "")}"
        data-ss-tier="core"
        data-ss-badges="${badgeJson}"
        data-ss-social-links="${socialJson}"
        data-ss-profile-href="${escapeHtml(profileHref)}"
      >
        <code>${userCode}</code>
      </button>
    `;
  }

  function renderAvatarCell(creator) {
    const displayName = escapeHtml(creator.display_name || creator.user_code);
    const avatarUrl = escapeHtml(creator.avatar_url || "");
    const fallback = escapeHtml(String(creator.display_name || creator.user_code || "NA").trim().slice(0, 2).toUpperCase());
    return `
      <span
        class="accounts-table-avatar${avatarUrl ? " has-image" : ""}"
        data-ss-profile-hover-trigger="true"
        data-ss-user-code="${escapeHtml(creator.user_code)}"
        data-ss-user-id="${escapeHtml(creator.account_id || "")}"
        data-ss-display-name="${displayName}"
        data-ss-role="CREATOR"
        data-ss-avatar-url="${avatarUrl}"
        data-ss-cover-url="${escapeHtml(creator.cover_image_url || "")}"
        data-ss-bio="${escapeHtml(creator.bio || "")}"
        data-ss-tier="core"
        data-ss-badges="${escapeHtml(JSON.stringify(Array.isArray(creator.badges) ? creator.badges : []))}"
        data-ss-social-links="${escapeHtml(JSON.stringify(creator.social_links || {}))}"
        data-ss-profile-href="${escapeHtml(`https://streamsuites.app/u/${encodeURIComponent(creator.public_slug || creator.user_code || "")}`)}"
      >
        ${avatarUrl ? `<img src="${avatarUrl}" alt="${displayName} avatar" loading="lazy" decoding="async" />` : `<span>${fallback}</span>`}
      </span>
    `;
  }

  function renderDisplayNameCell(creator) {
    const displayName = escapeHtml(creator.display_name || creator.user_code);
    return `
      <span
        class="accounts-cell-ellipsis accounts-hover-link"
        data-ss-profile-hover-trigger="true"
        data-ss-user-code="${escapeHtml(creator.user_code)}"
        data-ss-user-id="${escapeHtml(creator.account_id || "")}"
        data-ss-display-name="${displayName}"
        data-ss-role="CREATOR"
        data-ss-avatar-url="${escapeHtml(creator.avatar_url || "")}"
        data-ss-cover-url="${escapeHtml(creator.cover_image_url || "")}"
        data-ss-bio="${escapeHtml(creator.bio || "")}"
        data-ss-tier="core"
        data-ss-badges="${escapeHtml(JSON.stringify(Array.isArray(creator.badges) ? creator.badges : []))}"
        data-ss-social-links="${escapeHtml(JSON.stringify(creator.social_links || {}))}"
        data-ss-profile-href="${escapeHtml(`https://streamsuites.app/u/${encodeURIComponent(creator.public_slug || creator.user_code || "")}`)}"
        title="${displayName}"
      >${displayName}</span>
    `;
  }

  function consumePendingCreatorHighlight() {
    const navState = getLinkageNavState();
    const pendingUserCode = String(navState.userCode || "").trim();
    const from = String(navState.from || "").trim().toLowerCase();
    if (!pendingUserCode || from !== "accounts") {
      return "";
    }
    navState.userCode = "";
    navState.from = "";
    return pendingUserCode;
  }

  function highlightCreatorRow(userCode) {
    if (!el.tableBody || !userCode) return;
    const rows = Array.from(el.tableBody.querySelectorAll("tr[data-creator-row]"));
    let target = null;
    for (const row of rows) {
      if (!(row instanceof HTMLTableRowElement)) continue;
      if (String(row.getAttribute("data-user-code") || "").trim() === userCode) {
        target = row;
        break;
      }
    }
    if (!target) return;
    target.classList.add("creators-row-highlight");
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    window.setTimeout(() => target.classList.remove("creators-row-highlight"), 2200);
  }

  function renderCreators() {
    if (!el.tableBody) return;
    el.tableBody.innerHTML = "";

    if (!state.creators.length) {
      el.emptyState?.classList.remove("hidden");
      return;
    }
    el.emptyState?.classList.add("hidden");

    state.creators.forEach((creator) => {
      const tr = document.createElement("tr");
      tr.setAttribute("data-creator-row", "1");
      tr.setAttribute("data-user-code", creator.user_code);
      tr.setAttribute("data-account-id", creator.account_id || "");
      tr.innerHTML = `
        <td>${renderAvatarCell(creator)}</td>
        <td>${renderAccountLink(creator)}</td>
        <td>${renderDisplayNameCell(creator)}</td>
        <td>${renderStatus(creator.status)}</td>
        <td>${escapeHtml(creator.account_email || (creator.orphaned ? "—" : "-"))}</td>
        <td>${creator.account_id ? `<span class="accounts-cell-ellipsis accounts-hover-link" data-ss-profile-hover-trigger="true" data-ss-user-code="${escapeHtml(creator.user_code)}" data-ss-user-id="${escapeHtml(creator.account_id)}" data-ss-display-name="${escapeHtml(creator.display_name || creator.user_code)}" data-ss-role="CREATOR" data-ss-avatar-url="${escapeHtml(creator.avatar_url || "")}" data-ss-cover-url="${escapeHtml(creator.cover_image_url || "")}" data-ss-bio="${escapeHtml(creator.bio || "")}" data-ss-tier="core" data-ss-badges="${escapeHtml(JSON.stringify(Array.isArray(creator.badges) ? creator.badges : []))}" data-ss-social-links="${escapeHtml(JSON.stringify(creator.social_links || {}))}" data-ss-profile-href="${escapeHtml(`https://streamsuites.app/u/${encodeURIComponent(creator.public_slug || creator.user_code || "")}`)}" title="${escapeHtml(creator.account_id)}"><code>${escapeHtml(creator.account_id)}</code></span>` : "—"}</td>
        <td>${escapeHtml(formatTimestamp(creator.activated_at))}</td>
        <td>${escapeHtml(formatTimestamp(creator.created_at))}</td>
        <td class="align-right">
          <button class="ss-btn ss-btn-small ss-btn-secondary" data-copy-creator-id="${escapeHtml(
            creator.user_code
          )}">
            Copy User Code
          </button>
        </td>
      `;
      el.tableBody.appendChild(tr);
    });

    highlightCreatorRow(consumePendingCreatorHighlight());
  }

  async function copyCreatorId(creatorId) {
    const text = String(creatorId || "").trim();
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch (err) {
      // Fallback below for locked clipboard APIs.
    }
    const temp = document.createElement("input");
    temp.type = "text";
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    temp.remove();
  }

  async function hydrateCreators() {
    setError("");
    setLinkNote("");
    try {
      const response = await fetch(buildApiUrl(CREATORS_ENDPOINT), {
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      const payload = await readJsonSafe(response);
      if (!response.ok || payload?.success === false) {
        const detail = String(payload?.error || payload?.message || `Request failed (${response.status})`);
        state.creators = [];
        renderCreators();
        setError(detail);
        return;
      }
      state.creators = normalizedCreators(payload);
      renderCreators();
    } catch (err) {
      state.creators = [];
      renderCreators();
      setError("Unable to load creator identities from /api/admin/creators.");
    }
  }

  async function runBackfill() {
    if (!el.btnBackfill) return;
    const originalLabel = el.btnBackfill.textContent || "Backfill Creator Identities";
    el.btnBackfill.disabled = true;
    el.btnBackfill.textContent = "Backfilling...";
    setBackfillStatus("");
    setError("");
    try {
      const response = await fetch(buildApiUrl(BACKFILL_ENDPOINT), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: "{}"
      });
      const payload = await readJsonSafe(response);
      if (!response.ok || payload?.success === false) {
        const detail = String(payload?.error || payload?.message || `Backfill failed (${response.status})`);
        setError(detail);
        return;
      }
      const created = Number(payload?.identities_created || 0);
      const already = Number(payload?.already_had_identity || 0);
      const scanned = Number(payload?.accounts_scanned || 0);
      setBackfillStatus(
        `Backfill complete. Scanned ${scanned}, created ${created}, already linked ${already}.`
      );
      await hydrateCreators();
    } catch (err) {
      setError("Backfill request failed. Retry when admin API is available.");
    } finally {
      el.btnBackfill.disabled = false;
      el.btnBackfill.textContent = originalLabel;
    }
  }

  function openLinkedAccount(button) {
    const orphaned = button.getAttribute("data-orphaned") === "1";
    if (orphaned) {
      setLinkNote("Orphan (not linked)");
      return;
    }
    const accountId = String(button.getAttribute("data-account-id") || "").trim();
    if (!accountId) {
      setLinkNote("Orphan (not linked)");
      return;
    }
    setLinkNote("");
    const navState = getLinkageNavState();
    navState.accountId = accountId;
    navState.from = "creators";
    navState.ts = Date.now();
    navigateToView("accounts");
  }

  function wireReadOnlyUi() {
    [el.btnAddCreator, el.btnImport, el.btnExport].forEach((button) => {
      if (!button) return;
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
      button.title = "Runtime creators registry is read-only in this view.";
    });
    if (el.editorPanel) {
      el.editorPanel.classList.add("hidden");
    }
  }

  function init() {
    el.tableBody = $("creators-table-body");
    el.emptyState = $("creators-empty");
    el.btnRefresh = $("btn-refresh-creators");
    el.btnBackfill = $("btn-backfill-creators");
    el.btnAddCreator = $("btn-add-creator");
    el.btnImport = $("btn-import-creators");
    el.btnExport = $("btn-export-creators");
    el.editorPanel = $("creator-editor");
    el.errorBox = $("creators-import-error");
    el.errorText = $("creators-import-error-text");
    el.backfillStatus = $("creators-backfill-status");
    el.linkNote = $("creators-link-note");

    wireReadOnlyUi();

    state.onRefreshClick = () => {
      void hydrateCreators();
    };
    el.btnRefresh?.addEventListener("click", state.onRefreshClick);

    state.onBackfillClick = () => {
      void runBackfill();
    };
    el.btnBackfill?.addEventListener("click", state.onBackfillClick);

    state.onTableClick = (event) => {
      const copyButton = event.target.closest("[data-copy-creator-id]");
      if (copyButton instanceof HTMLButtonElement) {
        const creatorId = copyButton.getAttribute("data-copy-creator-id") || "";
        void copyCreatorId(creatorId);
        return;
      }
      const openAccountButton = event.target.closest("[data-creator-open-account]");
      if (openAccountButton instanceof HTMLButtonElement) {
        openLinkedAccount(openAccountButton);
      }
    };
    el.tableBody?.addEventListener("click", state.onTableClick);

    void hydrateCreators();
  }

  function destroy() {
    if (state.onRefreshClick && el.btnRefresh) {
      el.btnRefresh.removeEventListener("click", state.onRefreshClick);
    }
    if (state.onBackfillClick && el.btnBackfill) {
      el.btnBackfill.removeEventListener("click", state.onBackfillClick);
    }
    if (state.onTableClick && el.tableBody) {
      el.tableBody.removeEventListener("click", state.onTableClick);
    }
    state.creators = [];
    state.onRefreshClick = null;
    state.onBackfillClick = null;
    state.onTableClick = null;
  }

  function exportCreators() {
    // Keep method for existing view-scoped handlers; creators are runtime-authoritative.
  }

  function importCreatorsFromFile() {
    // Keep method for existing view-scoped handlers; creators are runtime-authoritative.
  }

  window.CreatorsView = {
    init,
    destroy,
    exportCreators,
    importCreatorsFromFile
  };
})();

(() => {
  "use strict";

  const PROFILE_RESET_LABELS = {
    bio: "Clear bio",
    social_links: "Clear social links",
    custom_links: "Clear custom links",
    avatar_image: "Clear avatar image",
    cover_image: "Clear cover image",
    background_image: "Clear background image",
    visibility: "Reset public visibility",
    findmehere_theme: "Reset FindMeHere theme"
  };
  const BADGE_ORDER = ["admin", "core", "gold", "pro", "founder", "moderator", "developer"];
  const HIDDEN_BADGE_GOVERNANCE_SURFACES = new Set(["creator_surface", "admin_surface", "public_surface", "directory"]);

  const state = {
    userCode: "",
    payload: null,
    loadToken: 0,
    boundRouteChange: null
  };

  const el = {
    root: null,
    banner: null,
    heading: null,
    subheading: null,
    generatedAt: null,
    statusPill: null,
    routeLabel: null,
    refresh: null,
    hero: null,
    kpis: null,
    profile: null,
    identity: null,
    auth: null,
    creatorPosture: null,
    billing: null,
    management: null,
    badges: null,
    profileControls: null,
    platforms: null,
    triggersBody: null
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

  function coerceText(value, fallback = "") {
    if (value === undefined || value === null) return fallback;
    const normalized = String(value).trim();
    return normalized || fallback;
  }

  function coerceInteger(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.trunc(parsed);
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

  async function requestJson(path, options = {}) {
    const response = await fetch(buildApiUrl(path), {
      cache: "no-store",
      credentials: "include",
      timeoutMs: options.timeoutMs || 7000,
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    const rawText = await response.text();
    let payload = {};
    if (rawText) {
      try {
        payload = JSON.parse(rawText);
      } catch (_err) {
        payload = { message: rawText };
      }
    }
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
    }
    return payload || {};
  }

  function formatTimestamp(value) {
    if (!value) return "-";
    if (typeof window.StreamSuitesState?.formatTimestamp === "function") {
      const formatted = window.StreamSuitesState.formatTimestamp(value);
      if (formatted) return formatted;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, {
      hour12: false,
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function formatCurrencyCents(cents, currency = "USD", fallback = "—") {
    const parsed = Number(cents);
    if (!Number.isFinite(parsed)) return fallback;
    const amount = parsed / 100;
    const currencyCode = coerceText(currency, "USD").toUpperCase();
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (_err) {
      return `${currencyCode} ${amount.toFixed(2)}`;
    }
  }

  function formatBadgeLabel(value) {
    const text = coerceText(value, "Unknown");
    if (!text || text === "-" || text === "—") return "Unknown";
    return text
      .replace(/[_-]+/g, " ")
      .split(" ")
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : ""))
      .join(" ");
  }

  function humanizeToken(value, fallback = "—") {
    const normalized = coerceText(value).replace(/_/g, " ").trim();
    if (!normalized) return fallback;
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function renderBadge(label, tone = "") {
    const classes = ["ss-badge", tone].filter(Boolean).join(" ");
    return `<span class="${classes}">${escapeHtml(formatBadgeLabel(label))}</span>`;
  }

  function badgeIconPath(key) {
    const normalized = coerceText(key).toLowerCase();
    const srcMap = {
      admin: "/assets/icons/tierbadge-admin.svg",
      core: "/assets/icons/tierbadge-core.svg",
      gold: "/assets/icons/tierbadge-gold.svg",
      pro: "/assets/icons/tierbadge-pro.svg",
      founder: "/assets/icons/founder-gold.svg",
      moderator: "/assets/icons/modgavel-blue.svg",
      developer: "/assets/icons/dev-green.svg"
    };
    return srcMap[normalized] || "";
  }

  function renderBadgeChoiceLabel(key, meta = "") {
    const iconPath = badgeIconPath(key);
    return `
      <span class="accounts-badge-choice-label-wrap">
        ${iconPath ? `<img class="accounts-badge-choice-icon" src="${escapeHtml(iconPath)}" alt="" aria-hidden="true" />` : ""}
        <span class="accounts-badge-choice-copy">
          <span class="accounts-badge-choice-label">${escapeHtml(formatBadgeLabel(key))}</span>
          ${meta ? `<span class="accounts-badge-choice-meta">${escapeHtml(meta)}</span>` : ""}
        </span>
      </span>
    `;
  }

  function renderBooleanBadge(value, trueLabel, falseLabel, falseTone = "ss-badge-warning") {
    return value
      ? renderBadge(trueLabel, "ss-badge-success")
      : renderBadge(falseLabel, falseTone);
  }

  function badgeToneForStatus(value) {
    const normalized = coerceText(value).toLowerCase();
    if (["active", "enabled", "completed", "ready"].includes(normalized)) return "ss-badge-success";
    if (["suspended", "disabled", "deleted", "blocked", "banned"].includes(normalized)) return "ss-badge-danger";
    if (["required", "pending", "warning", "incomplete"].includes(normalized)) return "ss-badge-warning";
    return "";
  }

  function setStatusPill(text, tone = "subtle") {
    if (!el.statusPill) return;
    el.statusPill.classList.remove("success", "subtle", "warning");
    el.statusPill.classList.add(tone);
    const dot = el.statusPill.querySelector(".status-dot");
    el.statusPill.textContent = text || "";
    if (dot) el.statusPill.prepend(dot);
  }

  function setBanner(message, variant = "danger") {
    if (!el.banner) return;
    const text = String(message || "").trim();
    if (!text) {
      el.banner.textContent = "";
      el.banner.className = "ss-alert hidden";
      return;
    }
    el.banner.textContent = text;
    el.banner.className = `ss-alert ss-alert-${variant}`;
  }

  function resolveCurrentRoute() {
    return window.StreamSuitesAdminRoutes?.resolveLocation?.() || null;
  }

  function resolveUserCodeFromRoute() {
    const route = resolveCurrentRoute();
    const routeUserCode = String(route?.params?.user_code || "").trim();
    if (routeUserCode) return routeUserCode;
    const params = new URLSearchParams(window.location.search || "");
    return String(params.get("user_code") || "").trim();
  }

  function summarizeTriggerContribution(trigger) {
    const applicability = trigger?.platform_applicability && typeof trigger.platform_applicability === "object"
      ? trigger.platform_applicability
      : {};
    const ready = [];
    const limited = [];
    Object.entries(applicability).forEach(([platform, entry]) => {
      if (entry?.trigger_execution_eligible && entry?.chat_capable) {
        ready.push(platform);
      } else {
        limited.push(platform);
      }
    });
    if (ready.length && !limited.length) return `Ready on ${ready.join(", ")}`;
    if (ready.length) return `Ready on ${ready.join(", ")}; limited on ${limited.join(", ")}`;
    if (limited.length) return `Limited on ${limited.join(", ")}`;
    return "No platform applicability";
  }

  function describeSupporterState(summary) {
    const source = coerceText(summary?.supporter_source || summary?.supporterSource).toLowerCase();
    if (source === "subscription_and_donation") return "Subscription + donation";
    if (source === "subscription") return "Subscription supporter";
    if (source === "donation") return "One-off donation";
    return "No supporter history";
  }

  function describeRecurringState(summary) {
    const status = coerceText(summary?.recurring_status || summary?.recurringStatus).toLowerCase();
    if (!status || status === "not_tracked") return "No tracked recurring billing";
    if (status === "active") return "Active recurring billing";
    if (status === "trialing") return "Trialing recurring billing";
    if (status === "canceled") return "Canceled recurring billing";
    if (status === "past_due") return "Past-due recurring billing";
    return humanizeToken(status, "Recurring state unknown");
  }

  function describeGrantDuration(summary) {
    if (!(summary?.is_admin_granted_tier || summary?.isAdminGrantedTier)) return "No admin grant";
    if (summary?.admin_grant_is_lifetime || summary?.adminGrantIsLifetime) return "Lifetime";
    const expiresAt = summary?.admin_grant_expires_at || summary?.adminGrantExpiresAt;
    if (expiresAt) return `Ends ${formatTimestamp(expiresAt)}`;
    const durationUnit = coerceText(summary?.admin_grant_duration_unit || summary?.adminGrantDurationUnit);
    const durationValue = coerceInteger(summary?.admin_grant_duration_value || summary?.adminGrantDurationValue);
    if (durationUnit && durationValue) return `${durationValue} ${durationUnit}`;
    return "Timed grant";
  }

  function formatDiscountValue(discountType, discountValue, currency = "usd") {
    const value = Number(discountValue);
    if (!Number.isFinite(value) || value <= 0) return "Unknown discount";
    if (coerceText(discountType).toLowerCase() === "percent") {
      return `${value}% off`;
    }
    return `${formatCurrencyCents(value, currency, "—")} off`;
  }

  function resolveAvatarInitials(account) {
    const preferred = coerceText(account?.display_name || account?.user_code || account?.email, "User");
    const parts = preferred.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return preferred.slice(0, 2).toUpperCase();
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  function describeSurfaceReason(value) {
    const normalized = coerceText(value).toLowerCase();
    if (!normalized) return "No status reason provided.";
    if (normalized === "visible") return "Visible on the canonical public surface.";
    if (normalized === "missing_public_slug") return "Missing canonical public slug.";
    if (normalized === "disabled_by_account") return "Disabled at the account level.";
    if (normalized === "creator_capable_required") return "Requires a creator-capable account.";
    return formatBadgeLabel(normalized);
  }

  function renderKeyValueGrid(items, extraClass = "") {
    return `
      <div class="accounts-details-meta-grid ${extraClass}">
        ${items.map((item) => `
          <div>
            <span class="label">${escapeHtml(item.label)}</span>
            <span class="value">${item.value}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderMediaReference(url, media, emptyLabel) {
    const safeUrl = coerceText(url);
    if (!safeUrl) {
      return `<span class="accounts-details-keyline-value accounts-system-text is-muted">${escapeHtml(emptyLabel)}</span>`;
    }
    const label = coerceText(media?.asset_key || media?.assetKey || safeUrl);
    return `<a class="ss-link accounts-details-keyline-value accounts-system-text" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  }

  function renderBadgeIconStrip(items, emptyLabel = "No enabled badges") {
    const badges = Array.isArray(items) ? items : [];
    if (!badges.length) return `<span class="muted">${escapeHtml(emptyLabel)}</span>`;
    return badges
      .map((badge) => {
        const key = coerceText(badge?.key).toLowerCase();
        const src = badgeIconPath(key);
        return src
          ? `<img class="accounts-details-preview-badge" src="${escapeHtml(src)}" alt="${escapeHtml(formatBadgeLabel(badge?.label || key))}" title="${escapeHtml(formatBadgeLabel(badge?.title || badge?.label || key))}" />`
          : "";
      })
      .filter(Boolean)
      .join("");
  }

  function getBadgeSurfaceCatalog(source) {
    const surfaceCatalog = source?.surface_catalog;
    if (Array.isArray(surfaceCatalog) && surfaceCatalog.length) {
      return surfaceCatalog
        .map((entry) => ({
          key: coerceText(entry?.key),
          label: coerceText(entry?.label || entry?.key)
        }))
        .filter((entry) => entry.key && !HIDDEN_BADGE_GOVERNANCE_SURFACES.has(entry.key));
    }
    return [
      { key: "streamsuites_profile", label: "SS Profile" },
      { key: "findmehere_profile", label: "FMH Profile" },
      { key: "profile_card", label: "Profile Cards" },
      { key: "user_widget", label: "User Widget" }
    ];
  }

  function renderVisibilityGlyph(visible, label) {
    return `
      <span class="badge-governance-state${visible ? " is-visible" : " is-hidden"}" title="${escapeHtml(label)}">
        <span class="badge-governance-glyph${visible ? " is-visible" : " is-hidden"}" aria-hidden="true"></span>
        <span class="badge-governance-state-text">${escapeHtml(visible ? "Visible" : "Hidden")}</span>
      </span>
    `;
  }

  function buildBadgeMatrixCellMap(rows) {
    const map = Object.create(null);
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const key = coerceText(row?.key || row?.value).toLowerCase();
      if (!key) return;
      map[key] = row?.surfaces && typeof row.surfaces === "object" ? row.surfaces : {};
    });
    return map;
  }

  function getCurrentAccount() {
    return state.payload?.account && typeof state.payload.account === "object" ? state.payload.account : {};
  }

  function getCurrentAccountId() {
    return coerceText(getCurrentAccount().id);
  }

  function getCurrentRoutes() {
    const management = state.payload?.management && typeof state.payload.management === "object" ? state.payload.management : {};
    return management.routes && typeof management.routes === "object" ? management.routes : {};
  }

  function buildPublicProfileHref(account) {
    return coerceText(account?.streamsuites_profile_url || account?.public_profile?.streamsuites_profile_url);
  }

  function renderHero(account, summary) {
    if (!el.hero) return;
    const publicProfile = account?.public_profile && typeof account.public_profile === "object" ? account.public_profile : {};
    const title = coerceText(account?.display_name || account?.user_code, "User detail");
    const subtitle = coerceText(account?.email || account?.user_code, "Loading user context");
    const coverImage = coerceText(publicProfile.cover_image_url || account?.cover_image_url || publicProfile.background_image_url);
    const avatarUrl = coerceText(account?.avatar_url);
    const publicProfileHref = buildPublicProfileHref(account);
    const avatarMarkup = avatarUrl
      ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(title)} avatar" loading="lazy" decoding="async" />`
      : `<span>${escapeHtml(resolveAvatarInitials(account))}</span>`;
    const heroBadges = [
      renderBadge(account?.role || "unknown", badgeToneForStatus(account?.account_status)),
      renderBadge(account?.tier || "core"),
      renderBooleanBadge(account?.creator_capable, "Creator-capable", "Viewer-only", "ss-badge-danger"),
      renderBadge(summary?.readiness_label || "Unknown", summary?.bot_deploy_eligible ? "ss-badge-success" : "ss-badge-warning")
    ].join("");
    el.hero.innerHTML = `
      <div class="user-detail-hero-shell">
        <div class="user-detail-hero-cover"${coverImage ? ` style="background-image:url('${escapeHtml(coverImage)}')"` : ""}></div>
        <div class="user-detail-hero-content">
          <div class="user-detail-hero-avatar${avatarUrl ? " has-image" : ""}">${avatarMarkup}</div>
          <div class="user-detail-hero-copy">
            <span class="user-detail-hero-kicker">Authoritative admin surface</span>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(subtitle)}</p>
            <div class="user-detail-hero-badges">${heroBadges}</div>
          </div>
          <div class="user-detail-hero-actions">
            ${publicProfileHref ? `<a class="ss-btn ss-btn-primary" href="${escapeHtml(publicProfileHref)}" target="_blank" rel="noopener noreferrer">Open public profile</a>` : ""}
            <a class="ss-btn ss-btn-secondary" href="/users" data-view="accounts">Accounts table</a>
            <a class="ss-btn ss-btn-secondary" href="${escapeHtml(getCurrentRoutes().creator_integrations || "/profiles/integrations")}" data-view="creator-integrations">Creator integrations</a>
          </div>
        </div>
      </div>
    `;
  }

  function renderKpis(summary, account) {
    if (!el.kpis) return;
    const cards = [
      { label: "User code", value: coerceText(account?.user_code, "-"), tone: "is-neutral" },
      { label: "Creator posture", value: summary?.creator_capable ? "Creator-capable" : "Not creator-capable", tone: summary?.creator_capable ? "is-good" : "is-warn" },
      { label: "Linked platforms", value: `${Number(summary?.linked_platform_count || 0)}/${Number(summary?.total_platform_count || 0)}`, tone: "is-neutral" },
      { label: "Deployable", value: String(summary?.deployable_platform_count || 0), tone: summary?.deployable_platform_count ? "is-good" : "is-warn" },
      { label: "Foundation triggers", value: `${Number(summary?.enabled_foundational_trigger_count || 0)}/${Number(summary?.foundational_trigger_count || 0)}`, tone: summary?.foundational_trigger_ready ? "is-good" : "is-warn" },
      { label: "Account status", value: coerceText(account?.account_status, "-"), tone: account?.account_status === "active" ? "is-good" : "is-warn" }
    ];
    el.kpis.innerHTML = cards
      .map((card) => `
        <article class="creator-integrations-kpi-card ${escapeHtml(card.tone)}">
          <span class="label">${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
        </article>
      `)
      .join("");
  }

  function renderProfile(account) {
    if (!el.profile) return;
    const publicProfile = account?.public_profile && typeof account.public_profile === "object" ? account.public_profile : {};
    const title = coerceText(account?.display_name || account?.user_code, "Account");
    const roleLabel = [account?.role, publicProfile?.public_surface_account_type].filter(Boolean).map((item) => formatBadgeLabel(item)).join(" · ");
    const previewHref = buildPublicProfileHref(account);
    const socialLinks = publicProfile?.social_links && typeof publicProfile.social_links === "object" ? publicProfile.social_links : {};
    const customLinks = Array.isArray(publicProfile?.custom_links) ? publicProfile.custom_links : [];
    const socialMarkup = Object.entries(socialLinks)
      .filter(([, url]) => coerceText(url))
      .map(([label, url]) => `<a class="ss-link" href="${escapeHtml(coerceText(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(formatBadgeLabel(label))}</a>`)
      .join(" · ");
    const customMarkup = customLinks.length
      ? customLinks.map((item) => `<span>${escapeHtml(item?.label || item?.url || "Link")}</span>`).join(" · ")
      : '<span class="muted">No custom links saved.</span>';
    const avatarMarkup = account?.avatar_url
      ? `<img src="${escapeHtml(account.avatar_url)}" alt="${escapeHtml(title)} avatar" loading="lazy" decoding="async" />`
      : `<span>${escapeHtml(resolveAvatarInitials(account))}</span>`;
    el.profile.innerHTML = `
      <article class="accounts-details-profile-card glass-card user-detail-profile-card">
        <div class="accounts-details-preview-cover"${publicProfile?.cover_image_url ? ` style="background-image:url('${escapeHtml(publicProfile.cover_image_url)}')"` : ""}></div>
        <div class="accounts-details-profile-head">
          <div class="accounts-details-avatar${account?.avatar_url ? " has-image" : ""}" aria-hidden="true">${avatarMarkup}</div>
          <div class="accounts-details-identity">
            <strong class="accounts-details-name">${escapeHtml(title)}</strong>
            <span class="accounts-details-user-code">${escapeHtml(coerceText(account?.user_code, "—"))}</span>
            <div class="accounts-details-role-row">
              ${renderBadge(account?.role || "unknown")}
              ${renderBadge(account?.tier || "core")}
              ${renderBooleanBadge(account?.creator_capable, "Creator-capable", "Viewer-only", "ss-badge-danger")}
              ${previewHref ? `<a class="ss-btn ss-btn-small ss-btn-primary" href="${escapeHtml(previewHref)}" target="_blank" rel="noopener noreferrer">Open public profile</a>` : ""}
            </div>
          </div>
        </div>
        ${renderKeyValueGrid([
          { label: "Role surface", value: escapeHtml(roleLabel || "Unknown") },
          { label: "Public slug", value: `<span class="accounts-system-text">${escapeHtml(coerceText(publicProfile?.public_slug, "—"))}</span>` },
          { label: "Slug aliases", value: `<span class="accounts-system-text">${escapeHtml((publicProfile?.slug_aliases || []).join(", ") || "—")}</span>` },
          { label: "Bio", value: escapeHtml(coerceText(publicProfile?.bio, "No public bio saved")) },
          { label: "Social links", value: socialMarkup || '<span class="muted">No social links saved.</span>' },
          { label: "Custom links", value: customMarkup }
        ], "user-detail-profile-meta-grid")}
      </article>
    `;
  }

  function renderIdentity(account) {
    if (!el.identity) return;
    const publicProfile = account?.public_profile && typeof account.public_profile === "object" ? account.public_profile : {};
    el.identity.innerHTML = renderKeyValueGrid([
      { label: "Display name", value: escapeHtml(coerceText(account?.display_name, "-")) },
      { label: "Email", value: escapeHtml(coerceText(account?.email, "-")) },
      { label: "Internal account id", value: `<span class="accounts-system-text">${escapeHtml(coerceText(account?.id, "-"))}</span>` },
      { label: "User code", value: `<span class="accounts-system-text">${escapeHtml(coerceText(account?.user_code, "-"))}</span>` },
      { label: "Role", value: renderBadge(account?.role || "unknown") },
      { label: "Tier", value: renderBadge(account?.tier || "unknown") },
      { label: "Created", value: escapeHtml(formatTimestamp(account?.created_at)) },
      { label: "Last login", value: escapeHtml(formatTimestamp(account?.last_login_at)) },
      { label: "Pending email", value: escapeHtml(coerceText(account?.pending_email, "—")) },
      { label: "Pending email expiry", value: escapeHtml(formatTimestamp(account?.email_change_expires_at)) },
      { label: "Public slug", value: `<span class="accounts-system-text">${escapeHtml(coerceText(publicProfile?.public_slug, "—"))}</span>` },
      { label: "Account status", value: renderBadge(account?.account_status || "unknown", badgeToneForStatus(account?.account_status)) }
    ]);
  }

  function renderAuthOverview(authOverview, account) {
    if (!el.auth) return;
    const providers = Array.isArray(authOverview?.providers) ? authOverview.providers : [];
    el.auth.innerHTML = `
      <div class="user-detail-pill-row">
        ${renderBooleanBadge(authOverview?.email_verified, "Email verified", "Email unverified")}
        ${renderBooleanBadge(authOverview?.password_set, "Password set", "No password set", "ss-badge-danger")}
        ${renderBadge(authOverview?.role || "unknown")}
        ${renderBadge(authOverview?.tier || "unknown")}
      </div>
      ${renderKeyValueGrid([
        { label: "Provider count", value: escapeHtml(String(authOverview?.provider_count || 0)) },
        { label: "Providers", value: escapeHtml(providers.length ? providers.join(", ") : "None linked") },
        { label: "Account status", value: renderBadge(authOverview?.account_status || account?.account_status || "unknown", badgeToneForStatus(authOverview?.account_status || account?.account_status)) },
        { label: "Pending email change", value: escapeHtml(coerceText(account?.pending_email, "None")) }
      ])}
    `;
  }

  function renderCreatorPosture(posture, summary) {
    if (!el.creatorPosture) return;
    el.creatorPosture.innerHTML = `
      <div class="user-detail-pill-row">
        ${renderBooleanBadge(posture?.creator_capable, "Creator-capable", "Not creator-capable", "ss-badge-danger")}
        ${renderBooleanBadge(posture?.viewer_only, "Viewer-only", "Not viewer-only")}
        ${renderBooleanBadge(posture?.streamsuites_profile_visible, "StreamSuites visible", "StreamSuites hidden")}
        ${renderBooleanBadge(posture?.findmehere_visible, "FindMeHere visible", "FindMeHere hidden")}
      </div>
      ${renderKeyValueGrid([
        { label: "Public surface type", value: escapeHtml(coerceText(posture?.public_surface_account_type, "-")) },
        { label: "Readiness", value: renderBadge(summary?.readiness_label || "Unknown", summary?.bot_deploy_eligible ? "ss-badge-success" : "ss-badge-warning") },
        { label: "Needs attention", value: renderBooleanBadge(summary?.needs_attention, "Yes", "No") },
        { label: "Limited platforms", value: escapeHtml(String(summary?.limited_platform_count || 0)) }
      ])}
    `;
  }

  function renderBillingHistory(account) {
    const billingAdminSummary = account?.billing_admin_summary && typeof account.billing_admin_summary === "object"
      ? account.billing_admin_summary
      : {};
    const interventions = Array.isArray(billingAdminSummary.interventions) ? billingAdminSummary.interventions : [];
    if (!interventions.length) {
      return `
        <div class="accounts-details-placeholder-block">
          <div class="accounts-details-placeholder-title">No billing interventions</div>
          <div class="accounts-details-placeholder-value">No account-specific billing overrides recorded yet.</div>
        </div>
      `;
    }
    return interventions
      .slice(0, 8)
      .map((item) => {
        let summary = humanizeToken(item.kind, "Intervention");
        if (item.kind === "gifted_tier") {
          summary = `${String(item.tier_id || item.tierId || "core").toUpperCase()} grant`;
        } else if (item.kind === "discount" || item.kind === "discount_code_assignment") {
          summary = `${item.code ? `${item.code} · ` : ""}${formatDiscountValue(item.discount?.type || item.discountType, item.discount?.value || item.discountValue, item.discount?.currency || item.currency)}`;
        } else if (item.kind === "credit" || item.kind === "writeoff") {
          summary = `${formatCurrencyCents(item.ledger?.amount_cents || item.ledger?.amountCents, item.ledger?.currency || "usd", "—")} ${item.kind}`;
        }
        return `
          <div class="accounts-details-placeholder-block">
            <div class="accounts-details-placeholder-title">${escapeHtml(summary)}</div>
            <div class="accounts-details-placeholder-value">
              ${escapeHtml(`${humanizeToken(item.status, "Active")} · ${item.reason || item.reason_code || item.reasonCode || "No reason recorded"}`)}
              <br />
              ${escapeHtml(`Created ${item.created_at ? formatTimestamp(item.created_at) : item.createdAt ? formatTimestamp(item.createdAt) : "—"}`)}
              ${item.ends_at || item.endsAt ? `<br />${escapeHtml(`Ends ${formatTimestamp(item.ends_at || item.endsAt)}`)}` : ""}
            </div>
            ${coerceText(item.status).toLowerCase() === "active"
              ? `<button type="button" class="ss-btn ss-btn-small ss-btn-secondary" data-user-detail-billing-revoke="${escapeHtml(coerceText(item.id))}">Revoke</button>`
              : ""}
          </div>
        `;
      })
      .join("");
  }

  function renderBilling(account) {
    if (!el.billing) return;
    const summary = account?.payment_summary && typeof account.payment_summary === "object" ? account.payment_summary : {};
    const supporterState = describeSupporterState(summary);
    const recurringState = describeRecurringState(summary);
    el.billing.innerHTML = `
      <div class="accounts-details-kpi-row">
        ${renderBadge(summary?.plan_name || summary?.planName || account?.tier || "Plan")}
        ${renderBadge(supporterState, summary?.is_supporter || summary?.isSupporter ? "ss-badge-success" : "ss-badge-warning")}
        ${renderBadge(recurringState, summary?.has_active_subscription || summary?.hasActiveSubscription ? "ss-badge-success" : "")}
      </div>
      ${renderKeyValueGrid([
        { label: "Plan status", value: escapeHtml(humanizeToken(summary?.plan_status || summary?.planStatus, "Active")) },
        { label: "Supporter source", value: escapeHtml(supporterState) },
        { label: "Lifetime paid", value: escapeHtml(formatCurrencyCents(summary?.lifetime_total_paid_cents || summary?.lifetimeTotalPaidCents, summary?.currency, "No payments")) },
        { label: "Donation total", value: escapeHtml(formatCurrencyCents(summary?.donation_total_paid_cents || summary?.donationTotalPaidCents, summary?.currency, "No donation history")) },
        { label: "Last payment amount", value: escapeHtml(formatCurrencyCents(summary?.last_payment_amount_cents || summary?.lastPaymentAmountCents, summary?.currency, "Not captured")) },
        { label: "Last payment date", value: escapeHtml(summary?.last_payment_at || summary?.lastPaymentAt ? formatTimestamp(summary?.last_payment_at || summary?.lastPaymentAt) : "No payment recorded") },
        { label: "Next renewal", value: escapeHtml(summary?.next_due_at || summary?.nextDueAt ? formatTimestamp(summary?.next_due_at || summary?.nextDueAt) : "Not scheduled") },
        { label: "Grant duration", value: escapeHtml(describeGrantDuration(summary)) }
      ], "user-detail-key-grid user-detail-billing-summary-grid")}
      <section class="accounts-details-group">
        <h5 class="accounts-details-group-title">Billing interventions</h5>
        <div class="user-detail-form-grid user-detail-billing-interventions-grid">
          <div class="accounts-details-group" data-user-detail-billing-form="gifted_tier">
            <h5 class="accounts-details-group-title">Gift paid tier</h5>
            <div class="user-detail-control-stack">
              <select class="ss-input" data-user-detail-billing-tier>
                <option value="GOLD">GOLD</option>
                <option value="PRO">PRO</option>
              </select>
              <div class="user-detail-inline-grid">
                <select class="ss-input" data-user-detail-billing-duration-unit>
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                  <option value="lifetime">Lifetime</option>
                </select>
                <input class="ss-input" type="number" min="1" value="30" data-user-detail-billing-duration-value />
              </div>
              <textarea class="ss-input" rows="3" placeholder="Reason required" data-user-detail-billing-reason></textarea>
              <button type="button" class="ss-btn ss-btn-primary" data-user-detail-billing-submit="gifted_tier">Create gifted tier</button>
            </div>
          </div>
          <div class="accounts-details-group" data-user-detail-billing-form="discount">
            <h5 class="accounts-details-group-title">Per-user discount</h5>
            <div class="user-detail-control-stack">
              <div class="user-detail-inline-grid">
                <select class="ss-input" data-user-detail-billing-discount-type>
                  <option value="percent">Percent</option>
                  <option value="amount">Amount</option>
                </select>
                <input class="ss-input" type="number" min="1" value="10" data-user-detail-billing-discount-value />
              </div>
              <textarea class="ss-input" rows="3" placeholder="Reason required" data-user-detail-billing-reason></textarea>
              <button type="button" class="ss-btn ss-btn-primary" data-user-detail-billing-submit="discount">Apply discount</button>
            </div>
          </div>
          <div class="accounts-details-group" data-user-detail-billing-form="discount_code_assignment">
            <h5 class="accounts-details-group-title">Per-user discount code</h5>
            <div class="user-detail-control-stack">
              <input class="ss-input" type="text" placeholder="Code" data-user-detail-billing-code />
              <input class="ss-input" type="text" placeholder="Label (optional)" data-user-detail-billing-label />
              <div class="user-detail-inline-grid">
                <select class="ss-input" data-user-detail-billing-discount-type>
                  <option value="percent">Percent</option>
                  <option value="amount">Amount</option>
                </select>
                <input class="ss-input" type="number" min="1" value="10" data-user-detail-billing-discount-value />
              </div>
              <textarea class="ss-input" rows="3" placeholder="Reason required" data-user-detail-billing-reason></textarea>
              <button type="button" class="ss-btn ss-btn-primary" data-user-detail-billing-submit="discount_code_assignment">Issue per-user code</button>
            </div>
          </div>
          <div class="accounts-details-group" data-user-detail-billing-form="ledger">
            <h5 class="accounts-details-group-title">Credits / write-offs</h5>
            <div class="user-detail-control-stack">
              <div class="user-detail-inline-grid">
                <select class="ss-input" data-user-detail-billing-ledger-kind>
                  <option value="credit">Credit</option>
                  <option value="writeoff">Write-off</option>
                </select>
                <input class="ss-input" type="number" min="0.01" step="0.01" value="5.00" data-user-detail-billing-amount />
              </div>
              <textarea class="ss-input" rows="3" placeholder="Reason required" data-user-detail-billing-reason></textarea>
              <button type="button" class="ss-btn ss-btn-primary" data-user-detail-billing-submit="ledger">Post adjustment</button>
            </div>
          </div>
        </div>
      </section>
      <section class="accounts-details-group">
        <h5 class="accounts-details-group-title">Billing history</h5>
        <div class="accounts-details-placeholder-group user-detail-billing-history-grid">${renderBillingHistory(account)}</div>
      </section>
    `;
  }

  function renderManagement(management, account) {
    if (!el.management) return;
    const routes = management?.routes && typeof management.routes === "object" ? management.routes : {};
    const status = coerceText(account?.account_status).toLowerCase();
    const isDeleted = status === "deleted";
    const isSuspended = status === "suspended";
    const currentTier = coerceText(account?.tier, "CORE").toUpperCase();
    const providers = Array.isArray(account?.providers) ? account.providers : [];
    const hasEmail = Boolean(coerceText(account?.email));
    const canVerifyEmail = hasEmail && !account?.email_verified;
    const providerLabels = providers.map((provider) => coerceText(provider.provider || provider.label)).filter(Boolean);
    el.management.innerHTML = `
      <div class="user-detail-management-shell">
        <div class="user-detail-management-primary">
          <div class="platform-actions">
            ${routes.public_profile ? `<a class="ss-btn ss-btn-primary" href="${escapeHtml(routes.public_profile)}" target="_blank" rel="noopener noreferrer">Open public profile</a>` : ""}
            <a class="ss-btn ss-btn-secondary" href="/users" data-view="accounts">Accounts table</a>
            <a class="ss-btn ss-btn-secondary" href="${escapeHtml(routes.creator_integrations || "/profiles/integrations")}" data-view="creator-integrations">Creator integrations</a>
            <a class="ss-btn ss-btn-secondary" href="${escapeHtml(routes.creator_stats || "/profiles/stats")}" data-view="creator-stats">Creator stats</a>
          </div>
          <div class="accounts-row-actions-grid">
            <div class="accounts-row-actions-tier">
              <select id="user-detail-tier-select" class="ss-input"${isDeleted ? " disabled" : ""}>
                <option value="CORE"${currentTier === "CORE" ? " selected" : ""}>CORE</option>
                <option value="GOLD"${currentTier === "GOLD" ? " selected" : ""}>GOLD</option>
                <option value="PRO"${currentTier === "PRO" ? " selected" : ""}>PRO</option>
                <option value="DEVELOPER"${currentTier === "DEVELOPER" ? " selected" : ""}>DEVELOPER</option>
              </select>
              <button type="button" class="ss-btn ss-btn-primary" data-user-detail-action="tier"${isDeleted ? " disabled" : ""}>Update tier</button>
            </div>
            <div class="accounts-row-actions-buttons user-detail-action-buttons">
              <button type="button" class="ss-btn ss-btn-secondary" data-user-detail-action="${escapeHtml(isSuspended ? "unsuspend" : "suspend")}"${isDeleted ? " disabled" : ""}>${escapeHtml(isSuspended ? "Unsuspend" : "Suspend")}</button>
              <button type="button" class="ss-btn ss-btn-secondary" data-user-detail-action="reset-onboarding"${isDeleted ? " disabled" : ""}>Reset onboarding</button>
              <button type="button" class="ss-btn ss-btn-secondary" data-user-detail-action="force-email-reverify"${!hasEmail || isDeleted ? " disabled" : ""}>Force email reverify</button>
              <button type="button" class="ss-btn ss-btn-secondary" data-user-detail-action="mark-email-verified"${!canVerifyEmail || isDeleted ? " disabled" : ""}>Mark email verified</button>
              <button type="button" class="ss-btn ss-btn-secondary" data-user-detail-action="admin-email-change"${isDeleted ? " disabled" : ""}>Change email</button>
              <button type="button" class="ss-btn ss-btn-secondary" data-user-detail-action="admin-auth-unlink"${!providerLabels.length || isDeleted ? " disabled" : ""}>Unlink method</button>
              <button type="button" class="ss-btn ss-btn-secondary" data-user-detail-action="invalidate-sessions">Force logout</button>
              <button type="button" class="ss-btn ss-btn-danger" data-user-detail-action="delete"${isDeleted ? " disabled" : ""}>Delete</button>
            </div>
          </div>
        </div>
        <div class="user-detail-callout user-detail-management-callout">
          <strong>Available sign-in methods</strong>
          <p class="muted">${escapeHtml(providerLabels.length ? providerLabels.join(", ") : "No linked providers returned.")}</p>
        </div>
      </div>
    `;
  }

  function renderBadges(account) {
    if (!el.badges) return;
    const badgeState = account?.badge_state && typeof account.badge_state === "object" ? account.badge_state : {};
    const entitlements = badgeState.entitlements && typeof badgeState.entitlements === "object" ? badgeState.entitlements : {};
    const visibilityOverrides = badgeState.visibility_overrides && typeof badgeState.visibility_overrides === "object"
      ? badgeState.visibility_overrides
      : {};
    const surfaceCatalog = getBadgeSurfaceCatalog(badgeState);
    const badgeSurfaceMap = buildBadgeMatrixCellMap(badgeState.applicable);
    const governedKeys = Array.from(new Set([
      ...Object.keys(badgeState.default_visibility || {}),
      ...Object.keys(visibilityOverrides || {}),
      ...Object.keys(entitlements || {}),
      ...(Array.isArray(badgeState.applicable) ? badgeState.applicable.map((item) => item?.key) : []),
      "founder",
      "moderator"
    ]))
      .map((item) => coerceText(item).toLowerCase())
      .filter(Boolean)
      .sort((left, right) => {
        const leftIndex = BADGE_ORDER.indexOf(left);
        const rightIndex = BADGE_ORDER.indexOf(right);
        return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
      });
    const visibleCellCount = governedKeys.reduce((count, key) => {
      const surfaceStates = badgeSurfaceMap[key] && typeof badgeSurfaceMap[key] === "object" ? badgeSurfaceMap[key] : {};
      return count + surfaceCatalog.filter((surface) => surfaceStates[surface.key]?.visible === true).length;
    }, 0);
    const matrixRows = governedKeys
      .map((key) => {
        const surfaceStates = badgeSurfaceMap[key] && typeof badgeSurfaceMap[key] === "object" ? badgeSurfaceMap[key] : {};
        const cells = surfaceCatalog
          .map((surface) => {
            const cell = surfaceStates[surface.key] && typeof surfaceStates[surface.key] === "object" ? surfaceStates[surface.key] : null;
            if (!cell || cell.supported === false) {
              return '<td class="badge-governance-cell is-unsupported"><span class="badge-governance-empty">—</span></td>';
            }
            const overrideEntry =
              visibilityOverrides[key] && typeof visibilityOverrides[key] === "object"
                ? visibilityOverrides[key][surface.key]
                : null;
            const value =
              overrideEntry && typeof overrideEntry === "object" && overrideEntry.visible === true
                ? "show"
                : overrideEntry && typeof overrideEntry === "object" && overrideEntry.visible === false
                ? "hide"
                : "default";
            const helper =
              cell.state === "admin_hidden"
                ? "Hidden by admin override"
                : cell.state === "global_hidden"
                ? "Hidden by global default"
                : cell.state === "creator_hidden"
                ? "Hidden by creator preference"
                : "Visible";
            return `
              <td class="badge-governance-cell${cell.locked ? " is-locked" : ""}">
                <div class="badge-governance-cell-stack">
                  ${renderVisibilityGlyph(cell.visible === true, helper)}
                  <select class="ss-input badge-governance-cell-select" data-user-detail-badge-visibility="${escapeHtml(key)}" data-user-detail-badge-surface="${escapeHtml(surface.key)}" ${cell.locked ? "disabled" : ""}>
                    <option value="default"${value === "default" ? " selected" : ""}>Default</option>
                    <option value="show"${value === "show" ? " selected" : ""}>Show</option>
                    <option value="hide"${value === "hide" ? " selected" : ""}>Hide</option>
                  </select>
                </div>
              </td>
            `;
          })
          .join("");
        return `
          <tr>
            <th scope="row" class="badge-governance-row-label">${renderBadgeChoiceLabel(key)}</th>
            ${cells}
          </tr>
        `;
      })
      .join("");
    el.badges.innerHTML = `
      <p class="muted badge-governance-intro">Effective visibility by surface. Unsupported cells are omitted and admin-hidden cells stay locked.</p>
      <div class="user-detail-badge-governance-grid">
        <div class="accounts-details-placeholder-block badge-governance-summary-card user-detail-badge-summary-card">
          <div class="badge-governance-card-head">
            <div class="accounts-details-placeholder-title">Effective badges</div>
            <span class="badge-governance-card-note">${escapeHtml(String(visibleCellCount || 0))} visible cells</span>
          </div>
          <div class="accounts-details-placeholder-value badge-governance-icon-strip">${renderBadgeIconStrip(account?.badges, "No effective badge icons")}</div>
          <div class="accounts-details-placeholder-title">Manual entitlements</div>
          <div class="accounts-details-placeholder-value user-detail-checkbox-grid">
            ${["founder", "moderator"].map((key) => `
              <label class="accounts-badge-inline-option muted ss-checkbox-wrapper">
                <input type="checkbox" data-user-detail-badge-entitlement="${escapeHtml(key)}"${entitlements[key]?.enabled === true ? " checked" : ""} />
                <div class="ss-checkbox"></div>
                ${renderBadgeChoiceLabel(key)}
              </label>
            `).join("")}
          </div>
        </div>
        <div class="accounts-details-placeholder-block badge-governance-matrix-card user-detail-badge-matrix-card">
          <div class="badge-governance-card-head">
            <div class="accounts-details-placeholder-title">Surface matrix</div>
            <span class="badge-governance-card-note">${escapeHtml(String(surfaceCatalog.length || 0))} remaining surfaces</span>
          </div>
          <div class="accounts-details-placeholder-value badge-governance-table-scroll">
            <table class="badge-governance-table">
              <thead>
                <tr>
                  <th>Badge</th>
                  ${surfaceCatalog.map((surface) => `<th>${escapeHtml(surface.label)}</th>`).join("")}
                </tr>
              </thead>
              <tbody>${matrixRows}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="accounts-inline-actions user-detail-badge-actions">
        <button type="button" class="ss-btn ss-btn-primary" data-user-detail-badge-save>Save badge settings</button>
      </div>
    `;
  }

  function renderProfileControls() {
    if (!el.profileControls) return;
    const resetGroups = [
      {
        title: "Clear profile copy",
        text: "Remove bio, social links, and custom links while preserving the user code and canonical slug.",
        operations: ["bio", "social_links", "custom_links"]
      },
      {
        title: "Clear profile media",
        text: "Remove avatar, cover image, and background image references from the authoritative profile record.",
        operations: ["avatar_image", "cover_image", "background_image"]
      },
      {
        title: "Reset public visibility",
        text: "Restore StreamSuites / FindMeHere visibility toggles and public-listing flags to safe defaults.",
        operations: ["visibility"]
      },
      {
        title: "Reset FindMeHere theme",
        text: "Revert FindMeHere presentation overrides back to the backend defaults.",
        operations: ["findmehere_theme"]
      }
    ];
    el.profileControls.innerHTML = `
      <div class="user-detail-reset-grid">
        ${resetGroups.map((group) => `
          <article class="accounts-details-placeholder-block user-detail-reset-card">
            <div class="accounts-details-placeholder-title">${escapeHtml(group.title)}</div>
            <div class="accounts-details-placeholder-value">${escapeHtml(group.text)}</div>
            <button
              type="button"
              class="ss-btn ss-btn-secondary"
              data-user-detail-profile-reset="${escapeHtml(group.operations.join(","))}"
            >
              ${escapeHtml(group.title)}
            </button>
          </article>
        `).join("")}
      </div>
      <div class="user-detail-callout">
        <strong>Confirmation boundary</strong>
        <p class="muted">These actions clear creator-facing profile state through runtime/Auth. They do not edit provider secrets or invent dashboard-owned data.</p>
      </div>
    `;
  }

  function renderPlatformCards(integrations) {
    if (!el.platforms) return;
    const items = Array.isArray(integrations) ? integrations : [];
    el.platforms.innerHTML = items.length
      ? items.map((item) => {
          const deployment = item.deployment && typeof item.deployment === "object" ? item.deployment : {};
          const capabilities = item.capabilities && typeof item.capabilities === "object" ? item.capabilities : {};
          const reasons = Array.isArray(deployment.reasons) ? deployment.reasons : [];
          const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
          const safeMeta = [];
          if (item.connection_method) safeMeta.push(`Connection: ${item.connection_method}`);
          if (item.auth_mode) safeMeta.push(`Auth: ${item.auth_mode}`);
          if (item.channel_handle) safeMeta.push(`Handle: ${item.channel_handle}`);
          if (item.public_url) safeMeta.push(`URL: ${item.public_url}`);
          if (metadata.workspace_note) safeMeta.push(`Note: ${metadata.workspace_note}`);
          if (item.platform_key === "rumble") {
            safeMeta.push(item.secret_present ? `Credential: ${item.secret_mask || "Configured"}` : "Credential: not stored");
          }
          return `
            <article class="creator-integrations-platform-card">
              <div class="creator-integrations-platform-head">
                <h4>${escapeHtml(item.platform_key || "platform")}</h4>
                ${renderBadge(
                  deployment.can_deploy ? "Ready" : (item.status === "linked" ? "Linked but limited" : item.status || "Unknown"),
                  deployment.can_deploy ? "ss-badge-success" : (item.status === "linked" ? "ss-badge-warning" : "")
                )}
              </div>
              <div class="creator-integrations-platform-meta">
                <span>${renderBooleanBadge(item.status === "linked", "Linked", "Not linked")}</span>
                <span>${renderBooleanBadge(Boolean(capabilities.trigger_execution_eligible), "Trigger-capable", "Not trigger-capable")}</span>
                <span>${renderBooleanBadge(Boolean(item.provider_linked), "Provider linked", "Provider not linked")}</span>
              </div>
              <ul class="creator-integrations-platform-list">
                ${safeMeta.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}
                <li>Last checked: ${escapeHtml(formatTimestamp(item.last_checked_at))}</li>
                <li>Verified: ${escapeHtml(formatTimestamp(item.verified_at))}</li>
                <li>Checks enabled: ${escapeHtml(item.checks_enabled ? "Yes" : "No")}</li>
                <li>Config state: ${escapeHtml(item.config_state || "-")}</li>
              </ul>
              <p class="creator-integrations-platform-note">${escapeHtml(item.ui_message || "No admin-safe note available.")}</p>
              <div class="creator-integrations-platform-reasons">
                ${
                  reasons.length
                    ? reasons.map((reason) => `<span class="creator-integrations-reason-chip">${escapeHtml(reason)}</span>`).join("")
                    : '<span class="muted">No blocking reasons reported.</span>'
                }
              </div>
            </article>
          `;
        }).join("")
      : '<div class="muted">No platform integration rows were returned for this account.</div>';
  }

  function renderTriggers(triggers) {
    if (!el.triggersBody) return;
    const items = Array.isArray(triggers) ? triggers : [];
    if (!items.length) {
      el.triggersBody.innerHTML = `
        <tr>
          <td colspan="5" class="muted">No trigger registry rows returned for this account.</td>
        </tr>
      `;
      return;
    }
    el.triggersBody.innerHTML = items
      .map((trigger) => `
        <tr>
          <td>
            <strong>${escapeHtml(trigger.command_text || trigger.trigger_id || "-")}</strong>
            <div class="muted">${escapeHtml(trigger.trigger_id || "-")}</div>
          </td>
          <td>${escapeHtml(Array.isArray(trigger.scope?.platforms) ? trigger.scope.platforms.join(", ") : "-")}</td>
          <td>${trigger.enabled ? renderBadge("Enabled", "ss-badge-success") : renderBadge("Disabled", "ss-badge-warning")}</td>
          <td>${escapeHtml(summarizeTriggerContribution(trigger))}</td>
          <td class="align-right">
            <button
              type="button"
              class="ss-btn ss-btn-small ss-btn-secondary"
              data-user-detail-trigger="${escapeHtml(trigger.trigger_id || "")}"
              data-next-enabled="${trigger.enabled ? "false" : "true"}"
            >
              ${escapeHtml(trigger.enabled ? "Disable" : "Enable")}
            </button>
          </td>
        </tr>
      `)
      .join("");
  }

  function render(payload) {
    state.payload = payload && typeof payload === "object" ? payload : null;
    const account = getCurrentAccount();
    const creatorIntegrations = state.payload?.creator_integrations && typeof state.payload.creator_integrations === "object"
      ? state.payload.creator_integrations
      : {};
    const summary = creatorIntegrations.summary || {};
    if (el.heading) {
      el.heading.textContent = account.display_name || account.user_code || state.userCode || "User detail";
    }
    window.StreamSuitesAdminShell?.setTopbarTitleOverride?.(
      account.display_name || account.user_code || state.userCode || "User Detail"
    );
    if (el.subheading) {
      el.subheading.textContent = account.email
        ? `${account.email} · ${account.user_code || state.userCode || "unknown user code"}`
        : account.user_code || state.userCode || "Loading account context";
    }
    if (el.generatedAt) {
      el.generatedAt.textContent = formatTimestamp(state.payload?.generated_at);
    }
    if (el.routeLabel) {
      el.routeLabel.textContent = state.userCode ? `/users/${state.userCode}` : "No user_code route selected";
    }

    renderHero(account, summary);
    renderKpis(summary, account);
    renderProfile(account);
    renderIdentity(account);
    renderAuthOverview(state.payload?.auth_overview || {}, account);
    renderCreatorPosture(state.payload?.creator_posture || {}, summary);
    renderBilling(account);
    renderManagement(state.payload?.management || {}, account);
    renderBadges(account);
    renderProfileControls();
    renderPlatformCards(creatorIntegrations.integrations || []);
    renderTriggers(creatorIntegrations.triggers || []);

    setStatusPill(
      summary?.bot_deploy_eligible ? "Deployable path present" : summary?.creator_capable ? "Needs readiness work" : "Creator posture blocked",
      summary?.bot_deploy_eligible ? "success" : "warning"
    );
    setBanner("");
  }

  function renderEmpty(message) {
    const html = `<div class="muted">${escapeHtml(message || "No account payload loaded.")}</div>`;
    if (el.hero) el.hero.innerHTML = html;
    if (el.kpis) el.kpis.innerHTML = "";
    if (el.profile) el.profile.innerHTML = html;
    if (el.identity) el.identity.innerHTML = html;
    if (el.auth) el.auth.innerHTML = html;
    if (el.creatorPosture) el.creatorPosture.innerHTML = html;
    if (el.billing) el.billing.innerHTML = html;
    if (el.management) el.management.innerHTML = html;
    if (el.badges) el.badges.innerHTML = html;
    if (el.profileControls) el.profileControls.innerHTML = html;
    if (el.platforms) el.platforms.innerHTML = html;
    if (el.triggersBody) {
      el.triggersBody.innerHTML = `<tr><td colspan="5" class="muted">${escapeHtml(message || "No trigger rows loaded.")}</td></tr>`;
    }
  }

  async function loadUserDetail(userCode) {
    const normalizedUserCode = String(userCode || "").trim();
    if (!normalizedUserCode) {
      state.userCode = "";
      state.payload = null;
      window.StreamSuitesAdminShell?.clearTopbarTitleOverride?.();
      setStatusPill("Awaiting route", "subtle");
      renderEmpty("Select an account or open a /users/{user_code} route.");
      return;
    }
    const token = ++state.loadToken;
    state.userCode = normalizedUserCode;
    window.StreamSuitesAdminShell?.setTopbarTitleOverride?.(normalizedUserCode);
    if (el.routeLabel) {
      el.routeLabel.textContent = `/users/${normalizedUserCode}`;
    }
    setStatusPill("Loading", "subtle");
    setBanner("");
    try {
      const payload = await requestJson(`/api/admin/users/${encodeURIComponent(normalizedUserCode)}`);
      if (token !== state.loadToken) return;
      render(payload);
    } catch (err) {
      if (token !== state.loadToken) return;
      state.payload = null;
      setStatusPill("Load failed", "warning");
      setBanner(err?.message || "Unable to load user detail.");
      renderEmpty(err?.message || "Unable to load user detail.");
    }
  }

  function getActionPrompt(action, account) {
    const name = coerceText(account?.display_name || account?.user_code, "this account");
    if (action === "suspend") return `Suspend ${name}? This logs them out immediately.`;
    if (action === "unsuspend") return `Unsuspend ${name}?`;
    if (action === "reset-onboarding") return `Reset onboarding for ${name}? This invalidates existing sessions.`;
    if (action === "force-email-reverify") return `Force email re-verification for ${name}? This logs them out and sends a verification email when configured.`;
    if (action === "mark-email-verified") return `Mark ${name} as email verified?`;
    if (action === "admin-email-change") return `Change the email address for ${name}?`;
    if (action === "admin-auth-unlink") return `Unlink a sign-in method for ${name}?`;
    if (action === "invalidate-sessions") return `Force logout ${name}?`;
    if (action === "delete") return `Delete ${name}? This is a destructive soft-delete action.`;
    return "";
  }

  function shouldConfirmAction(action) {
    return [
      "suspend",
      "unsuspend",
      "reset-onboarding",
      "force-email-reverify",
      "mark-email-verified",
      "admin-email-change",
      "admin-auth-unlink",
      "invalidate-sessions",
      "delete"
    ].includes(action);
  }

  function setButtonLoading(button, isLoading, loadingLabel = "Working...") {
    if (!(button instanceof HTMLButtonElement)) return;
    if (isLoading) {
      button.dataset.originalDisabled = button.disabled ? "true" : "false";
      button.dataset.originalLabel = button.textContent || "";
      button.disabled = true;
      button.textContent = loadingLabel;
      return;
    }
    if (button.dataset.originalLabel !== undefined) {
      button.textContent = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
    }
    if (button.dataset.originalDisabled !== undefined) {
      button.disabled = button.dataset.originalDisabled === "true";
      delete button.dataset.originalDisabled;
    }
  }

  async function handleAdminAction(action, button) {
    const account = getCurrentAccount();
    const accountId = getCurrentAccountId();
    if (!accountId || !action) return;
    if (shouldConfirmAction(action)) {
      const message = getActionPrompt(action, account);
      if (message && !window.confirm(message)) return;
    }

    let endpoint =
      action === "delete"
        ? `/admin/accounts/${encodeURIComponent(accountId)}`
        : `/admin/accounts/${encodeURIComponent(accountId)}/${encodeURIComponent(action)}`;
    let method = action === "delete" ? "DELETE" : "POST";
    let body = null;

    if (action === "admin-email-change") {
      const nextEmail = window.prompt("New email address:", coerceText(account.email));
      if (!nextEmail) return;
      const normalizedEmail = String(nextEmail).trim().toLowerCase();
      if (!normalizedEmail.includes("@")) {
        setBanner("Enter a valid email address.");
        setStatusPill("Validation failed", "warning");
        return;
      }
      const forceNow = window.confirm("Force change and mark verified now? Select Cancel to require email verification.");
      endpoint = `/api/admin/accounts/${encodeURIComponent(accountId)}/email/change`;
      method = "POST";
      body = JSON.stringify({
        new_email: normalizedEmail,
        require_verification: !forceNow,
        force_verified: forceNow
      });
    } else if (action === "admin-auth-unlink") {
      const currentProviders = Array.isArray(account.providers) ? account.providers : [];
      const providerOptions = currentProviders
        .map((provider) => coerceText(provider.provider || provider.label).toLowerCase())
        .filter(Boolean);
      if (!providerOptions.length) {
        setBanner("No linked providers to unlink.");
        setStatusPill("Nothing to unlink", "warning");
        return;
      }
      const provider = window.prompt(`Provider to unlink (${providerOptions.join(", ")}):`, providerOptions[0] || "");
      if (!provider) return;
      const override = window.confirm("Allow override if this is the last sign-in method?");
      endpoint = `/api/admin/accounts/${encodeURIComponent(accountId)}/auth-methods/unlink`;
      method = "POST";
      body = JSON.stringify({
        provider: String(provider).trim().toLowerCase(),
        override_last_method: override
      });
    } else if (action === "tier") {
      const tierSelect = document.getElementById("user-detail-tier-select");
      const selectedTier = tierSelect instanceof HTMLSelectElement ? tierSelect.value : "";
      if (!selectedTier) {
        setBanner("Select a tier before updating.");
        setStatusPill("Tier missing", "warning");
        return;
      }
      endpoint = `/admin/accounts/${encodeURIComponent(accountId)}/tier`;
      method = "PATCH";
      body = JSON.stringify({ tier: selectedTier });
    }

    setButtonLoading(button, true);
    setStatusPill("Saving", "subtle");
    setBanner("");
    try {
      const payload = await requestJson(endpoint, { method, body });
      await loadUserDetail(account.user_code || state.userCode);
      setStatusPill("Updated", "success");
      if (payload?.verification_url) {
        setBanner("Email reverify forced. Verification email was not sent automatically; copy the generated link from the API response if needed.", "warning");
      }
    } catch (err) {
      setStatusPill("Action failed", "warning");
      setBanner(err?.message || "Unable to apply the requested action.");
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function saveBadgeGovernance(button) {
    const accountId = getCurrentAccountId();
    if (!accountId) return;
    const entitlements = {};
    const visibility_overrides = {};
    document.querySelectorAll("[data-user-detail-badge-entitlement]").forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      const key = input.getAttribute("data-user-detail-badge-entitlement") || "";
      if (!key) return;
      entitlements[key] = input.checked;
    });
    document.querySelectorAll("[data-user-detail-badge-visibility]").forEach((select) => {
      if (!(select instanceof HTMLSelectElement)) return;
      const key = select.getAttribute("data-user-detail-badge-visibility") || "";
      const surface = select.getAttribute("data-user-detail-badge-surface") || "";
      if (!key || !surface) return;
      if (!visibility_overrides[key] || typeof visibility_overrides[key] !== "object") {
        visibility_overrides[key] = {};
      }
      visibility_overrides[key][surface] = select.value === "default" ? null : select.value === "show";
    });
    setButtonLoading(button, true);
    setStatusPill("Saving badges", "subtle");
    setBanner("");
    try {
      await requestJson(`/admin/accounts/${encodeURIComponent(accountId)}/badges`, {
        method: "PATCH",
        body: JSON.stringify({ entitlements, visibility_overrides })
      });
      await loadUserDetail(state.userCode);
      setStatusPill("Badge settings saved", "success");
    } catch (err) {
      setStatusPill("Badge save failed", "warning");
      setBanner(err?.message || "Unable to save badge settings.");
    } finally {
      setButtonLoading(button, false);
    }
  }

  function buildBillingPayload(formKind, form) {
    const reasonInput = form.querySelector("[data-user-detail-billing-reason]");
    const reason = reasonInput instanceof HTMLTextAreaElement ? reasonInput.value.trim() : "";
    if (!reason) {
      throw new Error("A reason is required for billing interventions.");
    }
    let payload = { kind: formKind, reason };
    if (formKind === "gifted_tier") {
      const tierInput = form.querySelector("[data-user-detail-billing-tier]");
      const durationUnitInput = form.querySelector("[data-user-detail-billing-duration-unit]");
      const durationValueInput = form.querySelector("[data-user-detail-billing-duration-value]");
      payload = {
        ...payload,
        tier: tierInput instanceof HTMLSelectElement ? tierInput.value : "GOLD",
        duration_unit: durationUnitInput instanceof HTMLSelectElement ? durationUnitInput.value : "days",
        duration_value: durationValueInput instanceof HTMLInputElement ? Number(durationValueInput.value || 0) : 0
      };
      if (payload.duration_unit === "lifetime") delete payload.duration_value;
      return payload;
    }
    if (formKind === "discount") {
      const typeInput = form.querySelector("[data-user-detail-billing-discount-type]");
      const valueInput = form.querySelector("[data-user-detail-billing-discount-value]");
      return {
        ...payload,
        discount_type: typeInput instanceof HTMLSelectElement ? typeInput.value : "percent",
        discount_value: valueInput instanceof HTMLInputElement ? Number(valueInput.value || 0) : 0
      };
    }
    if (formKind === "discount_code_assignment") {
      const codeInput = form.querySelector("[data-user-detail-billing-code]");
      const labelInput = form.querySelector("[data-user-detail-billing-label]");
      const typeInput = form.querySelector("[data-user-detail-billing-discount-type]");
      const valueInput = form.querySelector("[data-user-detail-billing-discount-value]");
      return {
        ...payload,
        code: codeInput instanceof HTMLInputElement ? codeInput.value.trim().toUpperCase() : "",
        label: labelInput instanceof HTMLInputElement ? labelInput.value.trim() : "",
        discount_type: typeInput instanceof HTMLSelectElement ? typeInput.value : "percent",
        discount_value: valueInput instanceof HTMLInputElement ? Number(valueInput.value || 0) : 0
      };
    }
    const ledgerKindInput = form.querySelector("[data-user-detail-billing-ledger-kind]");
    const amountInput = form.querySelector("[data-user-detail-billing-amount]");
    return {
      ...payload,
      kind: ledgerKindInput instanceof HTMLSelectElement ? ledgerKindInput.value : "credit",
      amount: amountInput instanceof HTMLInputElement ? Number(amountInput.value || 0) : 0
    };
  }

  async function submitBillingIntervention(formKind, button) {
    const accountId = getCurrentAccountId();
    if (!accountId) return;
    const form = button.closest("[data-user-detail-billing-form]");
    if (!(form instanceof HTMLElement)) return;
    const payload = buildBillingPayload(formKind, form);
    setButtonLoading(button, true);
    setStatusPill("Saving billing", "subtle");
    setBanner("");
    try {
      await requestJson(`/api/admin/accounts/${encodeURIComponent(accountId)}/billing-interventions`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      await loadUserDetail(state.userCode);
      setStatusPill("Billing updated", "success");
    } catch (err) {
      setStatusPill("Billing update failed", "warning");
      setBanner(err?.message || "Unable to save billing intervention.");
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function revokeBillingIntervention(interventionId, button) {
    const accountId = getCurrentAccountId();
    if (!accountId || !interventionId) return;
    const reason = window.prompt("Reason for revoking this billing intervention:");
    if (!reason) return;
    setButtonLoading(button, true);
    setStatusPill("Revoking billing", "subtle");
    setBanner("");
    try {
      await requestJson(`/api/admin/accounts/${encodeURIComponent(accountId)}/billing-interventions/revoke`, {
        method: "POST",
        body: JSON.stringify({ intervention_id: interventionId, reason: reason.trim() })
      });
      await loadUserDetail(state.userCode);
      setStatusPill("Billing revoked", "success");
    } catch (err) {
      setStatusPill("Billing revoke failed", "warning");
      setBanner(err?.message || "Unable to revoke billing intervention.");
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function resetProfile(operations, button) {
    const normalized = operations.map((item) => coerceText(item).toLowerCase()).filter(Boolean);
    if (!normalized.length) return;
    const labels = normalized.map((item) => PROFILE_RESET_LABELS[item] || formatBadgeLabel(item));
    if (!window.confirm(`Apply the following profile reset actions?\n\n${labels.join("\n")}`)) {
      return;
    }
    setButtonLoading(button, true);
    setStatusPill("Resetting profile", "subtle");
    setBanner("");
    try {
      await requestJson(`/api/admin/users/${encodeURIComponent(state.userCode)}/profile/reset`, {
        method: "POST",
        body: JSON.stringify({ operations: normalized })
      });
      await loadUserDetail(state.userCode);
      setStatusPill("Profile reset applied", "success");
    } catch (err) {
      setStatusPill("Profile reset failed", "warning");
      setBanner(err?.message || "Unable to reset public profile state.");
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function updateTrigger(triggerId, enabled, button) {
    const accountId = getCurrentAccountId();
    if (!accountId || !triggerId) return;
    setButtonLoading(button, true);
    setStatusPill("Saving trigger", "subtle");
    setBanner("");
    try {
      await requestJson(`/api/admin/accounts/${encodeURIComponent(accountId)}/creator-triggers/${encodeURIComponent(triggerId)}`, {
        method: "PATCH",
        timeoutMs: 7000,
        body: JSON.stringify({ enabled })
      });
      await loadUserDetail(state.userCode);
      setStatusPill("Trigger updated", "success");
    } catch (err) {
      setStatusPill("Trigger update failed", "warning");
      setBanner(err?.message || "Unable to update creator trigger.");
    } finally {
      setButtonLoading(button, false);
    }
  }

  function handleRouteChange() {
    const nextUserCode = resolveUserCodeFromRoute();
    if (!nextUserCode) {
      void loadUserDetail("");
      return;
    }
    if (nextUserCode !== state.userCode || !state.payload) {
      void loadUserDetail(nextUserCode);
    }
  }

  function handleRootClick(event) {
    const actionButton = event.target.closest("[data-user-detail-action]");
    if (actionButton instanceof HTMLButtonElement) {
      void handleAdminAction(actionButton.getAttribute("data-user-detail-action") || "", actionButton);
      return;
    }
    const badgeSave = event.target.closest("[data-user-detail-badge-save]");
    if (badgeSave instanceof HTMLButtonElement) {
      void saveBadgeGovernance(badgeSave);
      return;
    }
    const billingSubmit = event.target.closest("[data-user-detail-billing-submit]");
    if (billingSubmit instanceof HTMLButtonElement) {
      void submitBillingIntervention(billingSubmit.getAttribute("data-user-detail-billing-submit") || "", billingSubmit);
      return;
    }
    const billingRevoke = event.target.closest("[data-user-detail-billing-revoke]");
    if (billingRevoke instanceof HTMLButtonElement) {
      void revokeBillingIntervention(billingRevoke.getAttribute("data-user-detail-billing-revoke") || "", billingRevoke);
      return;
    }
    const profileReset = event.target.closest("[data-user-detail-profile-reset]");
    if (profileReset instanceof HTMLButtonElement) {
      const operations = String(profileReset.getAttribute("data-user-detail-profile-reset") || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      void resetProfile(operations, profileReset);
      return;
    }
    const triggerButton = event.target.closest("[data-user-detail-trigger]");
    if (triggerButton instanceof HTMLButtonElement) {
      void updateTrigger(
        triggerButton.getAttribute("data-user-detail-trigger") || "",
        triggerButton.getAttribute("data-next-enabled") === "true",
        triggerButton
      );
    }
  }

  function bindEvents() {
    el.refresh?.addEventListener("click", () => {
      void loadUserDetail(resolveUserCodeFromRoute());
    });
    el.root?.addEventListener("click", handleRootClick);
    state.boundRouteChange = () => {
      handleRouteChange();
    };
    window.addEventListener("streamsuites:routechange", state.boundRouteChange);
  }

  function unbindEvents() {
    if (el.root) {
      el.root.removeEventListener("click", handleRootClick);
    }
    if (state.boundRouteChange) {
      window.removeEventListener("streamsuites:routechange", state.boundRouteChange);
    }
    state.boundRouteChange = null;
  }

  function init() {
    el.root = document.querySelector("[data-user-detail-root=\"true\"]");
    if (!(el.root instanceof HTMLElement)) return;
    el.banner = $("user-detail-banner");
    el.heading = document.querySelector("[data-user-detail-heading=\"true\"]");
    el.subheading = document.querySelector("[data-user-detail-subheading=\"true\"]");
    el.generatedAt = document.querySelector("[data-user-detail-generated-at=\"true\"]");
    el.statusPill = document.querySelector("[data-user-detail-status-pill=\"true\"]");
    el.routeLabel = document.querySelector("[data-user-detail-route-label=\"true\"]");
    el.refresh = $("user-detail-refresh");
    el.hero = $("user-detail-hero");
    el.kpis = $("user-detail-kpis");
    el.profile = $("user-detail-profile");
    el.identity = $("user-detail-identity");
    el.auth = $("user-detail-auth");
    el.creatorPosture = $("user-detail-creator-posture");
    el.billing = $("user-detail-billing");
    el.management = $("user-detail-management");
    el.badges = $("user-detail-badges");
    el.profileControls = $("user-detail-profile-controls");
    el.platforms = $("user-detail-platforms");
    el.triggersBody = $("user-detail-triggers-body");
    bindEvents();
    handleRouteChange();
  }

  function destroy() {
    unbindEvents();
    state.userCode = "";
    state.payload = null;
    state.loadToken += 1;
    window.StreamSuitesAdminShell?.clearTopbarTitleOverride?.();
  }

  window.UserDetailView = {
    init,
    destroy
  };
})();

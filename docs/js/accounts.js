/* ============================================================
   StreamSuites Dashboard — Accounts view (admin actions)
   ============================================================ */

(() => {
  "use strict";

  const RUNTIME_ENDPOINT = "/admin/accounts";
  const BADGE_GOVERNANCE_ENDPOINT = "/admin/badge-governance";
  const BADGE_RECONCILE_ENDPOINT = "/admin/badge-governance/reconcile-founder";
  const BILLING_DISCOUNT_CODES_ENDPOINT = "/api/admin/billing-discount-codes";
  const BADGE_ORDER = ["admin", "core", "gold", "pro", "founder", "moderator", "developer"];
  const COLUMN_WIDTH_STORAGE_KEY = "ss_admin_accounts_colwidths_v3";
  const ROW_CLICK_DELAY_MS = 240;
  const SEARCH_FIELDS = [
    "userCode",
    "email",
    "displayName",
    "accountType",
    "role",
    "tier",
    "accountStatus",
    "onboardingStatus",
    "emailVerifiedLabel",
    "supporterLabel",
    "lifetimeTotalPaidLabel",
    "lastPaymentDateLabel"
  ];

  const state = {
    raw: [],
    manager: null,
    sourceLabel: "—",
    selfId: "",
    selfEmail: "",
    canManage: false,
    sourceMode: "runtime",
    exportLoading: false,
    openDrawerId: "",
    pendingNavAccountId: "",
    drawerDetailToken: 0,
    badgeGovernance: null,
    badgeGovernanceLoading: false,
    billingDiscountCodes: [],
    columnResize: null,
    columnResizeHydrated: false,
    escapeBound: false,
    rowClickTimer: null,
    drawerCloseTimer: null
  };

  const el = {
    banner: null,
    status: null,
    source: null,
    count: null,
    body: null,
    table: null,
    tableScroll: null,
    appMain: null,
    pagination: null,
    empty: null,
    search: null,
    pageSize: null,
    typeFilter: null,
    roleFilter: null,
    tierFilter: null,
    providerFilter: null,
    idToggle: null,
    exportJson: null,
    exportCsv: null,
    exportStatus: null,
    badgeGovernanceBanner: null,
    badgeGovernanceStatus: null,
    badgeGovernancePanel: null,
    billingCodesBanner: null,
    billingCodesStatus: null,
    billingCodesPanel: null,
    detailsBackdrop: null,
    detailsDrawer: null,
    detailsContent: null,
    detailsClose: null,
    detailsTitle: null,
    detailsSubtitle: null,
    detailsProfile: null,
    detailsActions: null,
    detailsProfileSection: null,
    detailsActionsSection: null,
    detailsActionsHeading: null
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

  function consumePendingAccountFocus() {
    const navState = getLinkageNavState();
    const accountId = String(navState.accountId || "").trim();
    const from = String(navState.from || "").trim().toLowerCase();
    if (!accountId || from !== "creators") {
      return "";
    }
    navState.accountId = "";
    navState.from = "";
    return accountId;
  }

  function formatBadgeLabel(value) {
    if (value === undefined || value === null) return "Unknown";
    const text = String(value).trim();
    if (!text || text === "-" || text === "—") return "Unknown";
    return text
      .replace(/[_-]+/g, " ")
      .split(" ")
      .map((part) =>
        part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : ""
      )
      .join(" ");
  }

  function normalizeTierLabel(value) {
    if (value === undefined || value === null) return "";
    const text = String(value).trim();
    if (!text) return "";
    const normalized = text.toLowerCase();
    if (normalized === "open") return "Core";
    return text;
  }

  function normalizeAccountType(value) {
    const normalized = String(value || "").trim().toUpperCase();
    if (normalized === "PUBLIC" || normalized === "CREATOR" || normalized === "ADMIN") {
      return normalized;
    }
    return "";
  }

  function coerceText(value, fallback = "") {
    if (value === undefined || value === null) return fallback;
    const normalized = String(value).trim();
    return normalized || fallback;
  }

  function coerceBoolean(value, fallback = false) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(normalized)) return true;
      if (["false", "0", "no", "off"].includes(normalized)) return false;
    }
    return fallback;
  }

  function serializeDataAttr(value) {
    if (value == null) return "";
    try {
      return JSON.stringify(value);
    } catch (_err) {
      return "";
    }
  }

  function escapeSelectorValue(value) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(String(value || ""));
    }
    return String(value || "").replace(/"/g, '\\"');
  }

  function resolveAccountType(raw = {}) {
    return (
      normalizeAccountType(raw.account_type || raw.accountType || raw.type) ||
      normalizeAccountType(raw.role || raw.account_role) ||
      "PUBLIC"
    );
  }

  function resolveTierData(value) {
    if (value === undefined || value === null) return "";
    const text = String(value).trim().toLowerCase();
    if (!text) return "";
    if (text === "open" || text === "core") return "CORE";
    if (text === "gold") return "GOLD";
    if (text === "pro") return "PRO";
    return "";
  }

  function badgeToneForStatus(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized || normalized === "-" || normalized === "—") return "";
    if (["active", "enabled", "completed"].includes(normalized)) {
      return "ss-badge-success";
    }
    if (["suspended", "disabled", "deleted", "blocked", "banned"].includes(normalized)) {
      return "ss-badge-danger";
    }
    if (["required", "pending", "incomplete"].includes(normalized)) {
      return "ss-badge-warning";
    }
    return "";
  }

  function renderBadge(value, tone) {
    const classes = ["ss-badge", tone].filter(Boolean).join(" ");
    const tier = resolveTierData(value);
    const tierAttr = tier ? ` data-tier="${tier}"` : "";
    return `<span class="${classes}"${tierAttr}>${escapeHtml(formatBadgeLabel(value))}</span>`;
  }

  function renderBadgeChoiceLabel(key, meta = "") {
    const iconPath = badgeIconPath(key);
    const label = renderBadgeKeyLabel(key);
    return `
      <span class="accounts-badge-choice-label-wrap">
        ${iconPath ? `<img class="accounts-badge-choice-icon" src="${escapeHtml(iconPath)}" alt="" aria-hidden="true" />` : ""}
        <span class="accounts-badge-choice-copy">
          <span class="accounts-badge-choice-label">${escapeHtml(label)}</span>
          ${meta ? `<span class="accounts-badge-choice-meta">${escapeHtml(meta)}</span>` : ""}
        </span>
      </span>
    `;
  }

  function badgeIconPath(key) {
    const normalized = String(key || "").trim().toLowerCase();
    const map = {
      admin: "/assets/icons/tierbadge-admin.svg",
      core: "/assets/icons/tierbadge-core.svg",
      gold: "/assets/icons/tierbadge-gold.svg",
      pro: "/assets/icons/tierbadge-pro.svg",
      founder: "/assets/icons/founder-gold.svg",
      moderator: "/assets/icons/modgavel-blue.svg",
      developer: "/assets/icons/dev-green.svg"
    };
    return map[normalized] || "";
  }

  function normalizeBadgeItems(items) {
    const normalized = (Array.isArray(items) ? items : [])
      .map((badge) => {
        if (!badge || typeof badge !== "object") return null;
        const key = String(badge.key || badge.icon_key || badge.iconKey || badge.value || "").trim().toLowerCase();
        if (!badgeIconPath(key)) return null;
        return {
          key,
          kind: String(badge.kind || "").trim().toLowerCase(),
          label: String(badge.label || badge.title || key).trim() || key,
          title: String(badge.title || badge.label || key).trim() || key,
          visible: badge.visible !== false
        };
      })
      .filter(Boolean);
    const hasAdminBadge = normalized.some((badge) => badge?.key === "admin");
    const hasDeveloperBadge = normalized.some((badge) => badge?.key === "developer");
    return normalized
      .filter(
        (badge) =>
          !(
            (hasAdminBadge && ["core", "gold", "pro"].includes(badge?.key)) ||
            (hasDeveloperBadge && badge?.key === "pro")
          )
      )
      .sort((left, right) => BADGE_ORDER.indexOf(left.key) - BADGE_ORDER.indexOf(right.key));
  }

  function renderBadgeIconStrip(items, emptyLabel = "No enabled badges") {
    const badges = normalizeBadgeItems(items);
    if (!badges.length) return `<span class="muted">${escapeHtml(emptyLabel)}</span>`;
    return badges
      .map((badge) => {
        const src = badgeIconPath(badge.key);
        return src
          ? `<img class="accounts-details-preview-badge" src="${escapeHtml(src)}" alt="${escapeHtml(badge.label)}" title="${escapeHtml(badge.title)}" />`
          : "";
      })
      .filter(Boolean)
      .join("");
  }

  function resolveEmailVerifiedLabel(value) {
    if (value === true) return "Verified";
    if (value === false) return "Not Verified";
    return "Unknown";
  }

  function renderEmailVerified(value) {
    if (value === true) return renderBadge("Verified", "ss-badge-success");
    if (value === false) return renderBadge("Not Verified", "ss-badge-warning");
    return renderBadge("Unknown", "");
  }

  function formatTimestamp(value) {
    if (typeof window.StreamSuitesState?.formatTimestamp === "function") {
      return window.StreamSuitesState.formatTimestamp(value) || "—";
    }
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return date.toISOString().replace("T", " ").replace("Z", " UTC");
  }

  function formatCurrencyCents(cents, currency, fallback = "—") {
    const parsed = Number(cents);
    if (!Number.isFinite(parsed)) return fallback;
    const amount = parsed / 100;
    const currencyCode = coerceText(currency || "USD").toUpperCase() || "USD";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch (_err) {
      return `${currencyCode} ${amount.toFixed(2)}`.trim();
    }
  }

  function coerceInteger(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.trunc(parsed);
  }

  function humanizeSummaryToken(value, fallback = "—") {
    const normalized = coerceText(value).replace(/_/g, " ").trim();
    if (!normalized) return fallback;
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function supporterLabelFromSource(source, isSupporter) {
    const normalized = coerceText(source).toLowerCase();
    if (normalized === "subscription_and_donation") return "Both";
    if (normalized === "subscription") return "Subscription";
    if (normalized === "donation") return "Donation";
    return isSupporter ? "Yes" : "No";
  }

  function supporterToneFromSource(source, isSupporter) {
    return isSupporter ? "ss-badge-success" : "";
  }

  function normalizePaymentSummary(raw, fallbackTier) {
    if (!raw || typeof raw !== "object") {
      return {
        planName: normalizeTierLabel(fallbackTier || "Core"),
        planTier: coerceText(fallbackTier || "core").toLowerCase(),
        planStatus: "",
        recurringStatus: "not_tracked",
        billingInterval: "",
        nextDueAt: "",
        currency: "",
        isSupporter: false,
        supporterSource: "none",
        hasAnyPayment: false,
        hasOneoffDonation: false,
        hasActiveSubscription: false,
        lifetimeTotalPaidCents: 0,
        subscriptionTotalPaidCents: null,
        donationTotalPaidCents: 0,
        lastPaymentAmountCents: null,
        lastPaymentAt: "",
        lastPaymentSource: "",
        donationCount: 0,
        effectiveTierSource: "account_tier",
        isAdminGrantedTier: false,
        adminGrantIsLifetime: false,
        adminGrantStartedAt: "",
        adminGrantExpiresAt: "",
        adminGrantDurationUnit: "",
        adminGrantDurationValue: null,
        hasDiscount: false,
        activeDiscounts: [],
        creditTotalCents: 0,
        writeoffTotalCents: 0,
        balanceReliefTotalCents: 0,
      };
    }
    return {
      planName: coerceText(raw.plan_name || raw.planName) || normalizeTierLabel(fallbackTier || "Core"),
      planTier: coerceText(raw.plan_tier || raw.planTier).toLowerCase() || coerceText(fallbackTier || "core").toLowerCase(),
      planStatus: coerceText(raw.plan_status || raw.planStatus).toLowerCase(),
      recurringStatus: coerceText(raw.recurring_status || raw.recurringStatus).toLowerCase(),
      billingInterval: coerceText(raw.billing_interval || raw.billingInterval).toLowerCase(),
      nextDueAt: coerceText(raw.next_due_at || raw.nextDueAt),
      currency: coerceText(raw.currency).toLowerCase(),
      isSupporter: raw.is_supporter === true || raw.isSupporter === true,
      supporterSource: coerceText(raw.supporter_source || raw.supporterSource).toLowerCase() || "none",
      hasAnyPayment: raw.has_any_payment === true || raw.hasAnyPayment === true,
      hasOneoffDonation: raw.has_oneoff_donation === true || raw.hasOneoffDonation === true,
      hasActiveSubscription: raw.has_active_subscription === true || raw.hasActiveSubscription === true,
      lifetimeTotalPaidCents: coerceInteger(raw.lifetime_total_paid_cents ?? raw.lifetimeTotalPaidCents) || 0,
      subscriptionTotalPaidCents: coerceInteger(raw.subscription_total_paid_cents ?? raw.subscriptionTotalPaidCents),
      donationTotalPaidCents: coerceInteger(raw.donation_total_paid_cents ?? raw.donationTotalPaidCents) || 0,
      lastPaymentAmountCents: coerceInteger(raw.last_payment_amount_cents ?? raw.lastPaymentAmountCents),
      lastPaymentAt: coerceText(raw.last_payment_at || raw.lastPaymentAt),
      lastPaymentSource: coerceText(raw.last_payment_source || raw.lastPaymentSource).toLowerCase(),
      donationCount: coerceInteger(raw.donation_count ?? raw.donationCount) || 0,
      effectiveTierSource: coerceText(raw.effective_tier_source || raw.effectiveTierSource).toLowerCase() || "account_tier",
      isAdminGrantedTier: raw.is_admin_granted_tier === true || raw.isAdminGrantedTier === true,
      adminGrantIsLifetime: raw.admin_grant_is_lifetime === true || raw.adminGrantIsLifetime === true,
      adminGrantStartedAt: coerceText(raw.admin_grant_started_at || raw.adminGrantStartedAt),
      adminGrantExpiresAt: coerceText(raw.admin_grant_expires_at || raw.adminGrantExpiresAt),
      adminGrantDurationUnit: coerceText(raw.admin_grant_duration_unit || raw.adminGrantDurationUnit).toLowerCase(),
      adminGrantDurationValue: coerceInteger(raw.admin_grant_duration_value ?? raw.adminGrantDurationValue),
      hasDiscount: raw.has_discount === true || raw.hasDiscount === true,
      activeDiscounts: Array.isArray(raw.active_discounts || raw.activeDiscounts)
        ? (raw.active_discounts || raw.activeDiscounts)
        : [],
      creditTotalCents: coerceInteger(raw.credit_total_cents ?? raw.creditTotalCents) || 0,
      writeoffTotalCents: coerceInteger(raw.writeoff_total_cents ?? raw.writeoffTotalCents) || 0,
      balanceReliefTotalCents: coerceInteger(raw.balance_relief_total_cents ?? raw.balanceReliefTotalCents) || 0,
    };
  }

  function normalizeBillingAdminSummary(raw) {
    if (!raw || typeof raw !== "object") {
      return { interventions: [], discountCodes: [] };
    }
    const interventions = Array.isArray(raw.interventions)
      ? raw.interventions
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            return {
              id: coerceText(item.id),
              kind: coerceText(item.kind).toLowerCase(),
              status: coerceText(item.status).toLowerCase(),
              tierId: coerceText(item.tier_id || item.tierId).toLowerCase(),
              durationUnit: coerceText(item.duration_unit || item.durationUnit).toLowerCase(),
              durationValue: coerceInteger(item.duration_value ?? item.durationValue),
              startsAt: coerceText(item.starts_at || item.startsAt),
              endsAt: coerceText(item.ends_at || item.endsAt),
              reason: coerceText(item.reason),
              reasonCode: coerceText(item.reason_code || item.reasonCode),
              createdAt: coerceText(item.created_at || item.createdAt),
              createdBy: item.created_by && typeof item.created_by === "object" ? item.created_by : {},
              revokedAt: coerceText(item.revoked_at || item.revokedAt),
              revokedBy: item.revoked_by && typeof item.revoked_by === "object" ? item.revoked_by : {},
              discount: item.discount && typeof item.discount === "object" ? item.discount : {},
              ledger: item.ledger && typeof item.ledger === "object" ? item.ledger : {},
              code: coerceText(item.code).toUpperCase(),
              label: coerceText(item.label),
            };
          })
          .filter(Boolean)
      : [];
    const discountCodes = Array.isArray(raw.discount_codes || raw.discountCodes)
      ? (raw.discount_codes || raw.discountCodes)
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            return {
              id: coerceText(item.id),
              code: coerceText(item.code).toUpperCase(),
              label: coerceText(item.label),
              scope: coerceText(item.scope).toLowerCase(),
              status: coerceText(item.status).toLowerCase(),
              discountType: coerceText(item.discount_type || item.discountType).toLowerCase(),
              discountValue: coerceInteger(item.discount_value ?? item.discountValue),
              currency: coerceText(item.currency).toLowerCase(),
              startsAt: coerceText(item.starts_at || item.startsAt),
              endsAt: coerceText(item.ends_at || item.endsAt),
              reason: coerceText(item.reason),
              createdAt: coerceText(item.created_at || item.createdAt),
              createdBy: item.created_by && typeof item.created_by === "object" ? item.created_by : {},
            };
          })
          .filter(Boolean)
      : [];
    return { interventions, discountCodes };
  }

  function describeSupporterState(summary) {
    const source = coerceText(summary?.supporterSource).toLowerCase();
    if (source === "subscription_and_donation") return "Subscription + donation";
    if (source === "subscription") return "Subscription supporter";
    if (source === "donation") return "One-off donation";
    return "No supporter history";
  }

  function describeRecurringState(summary) {
    const status = coerceText(summary?.recurringStatus).toLowerCase();
    if (!status || status === "not_tracked") return "No recurring renewal tracked";
    if (status === "active") return "Active recurring billing";
    if (status === "trialing") return "Trialing recurring billing";
    return humanizeSummaryToken(status, "No recurring renewal tracked");
  }

  function redactId(value) {
    if (!value) return "";
    const text = String(value);
    if (text.length <= 6) return text;
    return `${text.slice(0, 3)}…${text.slice(-2)}`;
  }

  function resolveProviders(rawProviders) {
    if (!rawProviders) return [];
    if (Array.isArray(rawProviders)) {
      return rawProviders
        .map((entry) => {
          if (typeof entry === "string") return { label: entry };
          if (entry && typeof entry === "object") {
            return {
              label: entry.provider || entry.type || entry.name || "provider",
              id: entry.id || entry.providerId || entry.uid || ""
            };
          }
          return null;
        })
        .filter(Boolean);
    }
    if (typeof rawProviders === "object") {
      return Object.keys(rawProviders).map((key) => ({
        label: key,
        id: rawProviders[key]?.id || rawProviders[key]?.uid || ""
      }));
    }
    return [];
  }

function normalizeUser(raw = {}) {
    const providers = resolveProviders(raw.providers || raw.authProviders || raw.auth_providers);
    const accountType = resolveAccountType(raw);
    const publicProfile =
      raw.public_profile && typeof raw.public_profile === "object" ? raw.public_profile : {};
    const publicSlug = coerceText(raw.public_slug || raw.slug || publicProfile.public_slug);
    const publicSurfaceAccountType = coerceText(
      raw.public_surface_account_type || publicProfile.public_surface_account_type
    );
    const creatorCapable = coerceBoolean(
      raw.creator_capable ?? publicProfile.creator_capable,
      accountType !== "PUBLIC"
    );
    const viewerOnly = coerceBoolean(raw.viewer_only ?? publicProfile.viewer_only, accountType === "PUBLIC");
    const streamsuitesProfileEnabled = coerceBoolean(
      raw.streamsuites_profile_enabled ?? publicProfile.streamsuites_profile_enabled,
      true
    );
    const streamsuitesProfileEligible = coerceBoolean(
      raw.streamsuites_profile_eligible ?? publicProfile.streamsuites_profile_eligible,
      Boolean(publicSlug)
    );
    const streamsuitesProfileVisible = coerceBoolean(
      raw.streamsuites_profile_visible ?? publicProfile.streamsuites_profile_visible,
      false
    );
    const streamsuitesProfileStatusReason = coerceText(
      raw.streamsuites_profile_status_reason || publicProfile.streamsuites_profile_status_reason
    );
    const streamsuitesProfileUrl = coerceText(
      raw.streamsuites_profile_url || raw.streamsuites_share_url || publicProfile.streamsuites_profile_url
    );
    const streamsuitesShareUrl = coerceText(
      raw.streamsuites_share_url || publicProfile.streamsuites_share_url || streamsuitesProfileUrl
    );
    const findMeHereEnabled = coerceBoolean(
      raw.findmehere_enabled ?? publicProfile.findmehere_enabled,
      true
    );
    const findMeHereEligible = coerceBoolean(
      raw.findmehere_eligible ?? publicProfile.findmehere_eligible,
      false
    );
    const findMeHereVisible = coerceBoolean(
      raw.findmehere_visible ?? publicProfile.findmehere_visible,
      false
    );
    const findMeHereStatusReason = coerceText(
      raw.findmehere_status_reason || publicProfile.findmehere_status_reason
    );
    const findMeHereProfileUrl = coerceText(
      raw.findmehere_profile_url || raw.findmehere_share_url || publicProfile.findmehere_profile_url
    );
    const findMeHereShareUrl = coerceText(
      raw.findmehere_share_url || publicProfile.findmehere_share_url || findMeHereProfileUrl
    );
    const coverImageUrl = coerceText(
      raw.cover_image_url || raw.banner_image_url || publicProfile.cover_image_url || publicProfile.banner_image_url
    );
    const backgroundImageUrl = coerceText(raw.background_image_url || publicProfile.background_image_url);
    const avatarUrl = coerceText(raw.avatar_url || publicProfile.avatar_url);
    const avatarMedia = normalizeMediaMeta(raw.avatar_media || publicProfile.avatar_media, avatarUrl, "avatar");
    const coverMedia = normalizeMediaMeta(raw.cover_media || publicProfile.cover_media, coverImageUrl, "cover");
    const bio = coerceText(raw.bio || publicProfile.bio);
    const socialLinks =
      raw.social_links && typeof raw.social_links === "object"
        ? raw.social_links
        : publicProfile.social_links && typeof publicProfile.social_links === "object"
        ? publicProfile.social_links
        : {};
    const badgeItems = Array.isArray(raw.badges)
      ? raw.badges
      : Array.isArray(publicProfile.badges)
      ? publicProfile.badges
      : [];
    const findmehereBadgeItems = Array.isArray(raw.findmehere_badges || raw.findmehereBadges)
      ? raw.findmehere_badges || raw.findmehereBadges
      : Array.isArray(publicProfile.findmehere_badges || publicProfile.findmehereBadges)
      ? publicProfile.findmehere_badges || publicProfile.findmehereBadges
      : [];
    const badgeState =
      raw.badge_state && typeof raw.badge_state === "object"
        ? raw.badge_state
        : raw.badgeState && typeof raw.badgeState === "object"
        ? raw.badgeState
        : {};
    let internalId =
      raw.internal_id || raw.internalId || raw.id || raw.uuid || raw.user_id || raw.userId || "";
    if (!String(internalId || "").trim() || String(internalId).trim() === "—") {
      internalId =
        raw.user_code ||
        raw.userCode ||
        raw.email ||
        raw.email_address ||
        raw.username ||
        "";
    }
    if (!String(internalId || "").trim()) {
      internalId = "—";
    }
    const emailVerifiedRaw =
      typeof raw.email_verified === "boolean"
        ? raw.email_verified
        : typeof raw.emailVerified === "boolean"
        ? raw.emailVerified
        : typeof raw.email_verified === "number"
        ? raw.email_verified === 1
        : typeof raw.emailVerified === "number"
        ? raw.emailVerified === 1
        : null;
    const paymentSummary = normalizePaymentSummary(raw.payment_summary || raw.paymentSummary, raw.tier || raw.account_tier || raw.plan);
    const billingAdminSummary = normalizeBillingAdminSummary(raw.billing_admin_summary || raw.billingAdminSummary);
    const supporterLabel = supporterLabelFromSource(paymentSummary.supporterSource, paymentSummary.isSupporter);
    const lastPaymentAtSort = paymentSummary.lastPaymentAt ? Date.parse(paymentSummary.lastPaymentAt) || 0 : 0;
    return {
      id: internalId,
      userCode: raw.user_code || raw.userCode || raw.code || raw.handle || "—",
      email: raw.email || raw.email_address || raw.username || "—",
      pendingEmail: raw.pending_email || raw.pendingEmail || "",
      emailChangeExpiresAt: raw.email_change_expires_at || raw.emailChangeExpiresAt || "",
      emailVerified: emailVerifiedRaw,
      emailVerifiedLabel: resolveEmailVerifiedLabel(emailVerifiedRaw),
      displayName: raw.display_name || raw.displayName || raw.name || "—",
      publicSlug,
      publicSurfaceAccountType,
      creatorCapable,
      viewerOnly,
      streamsuitesProfileEnabled,
      streamsuitesProfileEligible,
      streamsuitesProfileVisible,
      streamsuitesProfileStatusReason,
      streamsuitesProfileUrl,
      streamsuitesShareUrl,
      findMeHereEnabled,
      findMeHereEligible,
      findMeHereVisible,
      findMeHereStatusReason,
      findMeHereProfileUrl,
      findMeHereShareUrl,
      coverImageUrl,
      bannerImageUrl: coverImageUrl,
      backgroundImageUrl,
      avatarUrl,
      avatarMedia,
      coverMedia,
      bio,
      socialLinks,
      badges: badgeItems,
      findmehereBadges: findmehereBadgeItems,
      badgeState,
      isAnonymous: coerceBoolean(raw.is_anonymous ?? publicProfile.is_anonymous, false),
      isListed: coerceBoolean(raw.is_listed ?? publicProfile.is_listed, true),
      slugAliases: Array.isArray(raw.slug_aliases || publicProfile.slug_aliases)
        ? (raw.slug_aliases || publicProfile.slug_aliases).map((item) => coerceText(item)).filter(Boolean)
        : [],
      accountType,
      role: raw.role || raw.account_role || accountType || "—",
      tier: normalizeTierLabel(raw.tier || raw.account_tier || raw.plan || "Core"),
      paymentSummary,
      billingAdminSummary,
      supporterLabel,
      supporterTone: supporterToneFromSource(paymentSummary.supporterSource, paymentSummary.isSupporter),
      lifetimeTotalPaidCents: paymentSummary.lifetimeTotalPaidCents || 0,
      lifetimeTotalPaidLabel: formatCurrencyCents(
        paymentSummary.lifetimeTotalPaidCents,
        paymentSummary.currency,
        paymentSummary.hasAnyPayment ? "—" : "No payments"
      ),
      lastPaymentAt: paymentSummary.lastPaymentAt || "",
      lastPaymentAtSort,
      lastPaymentDateLabel: paymentSummary.lastPaymentAt ? formatTimestamp(paymentSummary.lastPaymentAt) : "—",
      accountStatus: raw.account_status || raw.accountStatus || raw.status || "—",
      onboardingStatus: raw.onboarding_status || raw.onboardingStatus || raw.onboarding || "—",
      providers,
      providersLabel: providers
        .map((provider) => {
          const label = provider.label || "provider";
          const id = provider.id ? ` (${redactId(provider.id)})` : "";
          return `${label}${id}`;
        })
        .join(", ") || "—",
      createdAt: raw.created_at || raw.createdAt || raw.created || null,
      lastLogin:
        raw.last_login_at ||
        raw.lastLoginAt ||
        raw.last_login ||
        raw.lastLogin ||
        raw.last_seen ||
        null
    };
  }

  function resolveSessionEndpoint() {
    return (
      window.StreamSuitesAdminAuth?.config?.endpoints?.session ||
      document.querySelector('meta[name="streamsuites-auth-session"]')?.getAttribute("content") ||
      ""
    );
  }

  function resolveApiBase() {
    if (window.StreamSuitesApi?.getApiBase) {
      return window.StreamSuitesApi.getApiBase();
    }
    const base = window.StreamSuitesAdminAuth?.config?.baseUrl || "";
    return base ? String(base).replace(/\/$/, "") : "";
  }

  function buildApiUrl(path, baseOverride) {
    if (window.StreamSuitesApi?.buildApiUrl) {
      return window.StreamSuitesApi.buildApiUrl(path, baseOverride || resolveApiBase());
    }
    const base = typeof baseOverride === "string" ? baseOverride.replace(/\/$/, "") : resolveApiBase();
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

  function setInlineError(message, options = {}) {
    setStatus(message);
    setBanner(message, true, { ...options, inline: false });
  }

  async function readErrorMessage(res) {
    if (!res) return "";
    const contentType = res.headers?.get("content-type") || "";
    try {
      if (contentType.includes("application/json")) {
        const payload = await res.json();
        if (typeof payload?.message === "string") return payload.message;
        if (typeof payload?.error === "string") return payload.error;
      }
      const text = await res.text();
      return text.trim();
    } catch (err) {
      return "";
    }
  }

  async function loadAdminIdentity() {
    const endpoint = resolveSessionEndpoint();
    if (!endpoint) return;
    try {
      const res = await fetchJson(endpoint, { method: "GET" });
      if (!res.ok) return;
      const payload = await res.json();
      const user = payload?.user || payload?.session?.user || payload?.session || {};
      state.selfId = String(user.internal_id || user.id || user.user_id || "").trim();
      const email = (user.email || "").toString().trim().toLowerCase();
      state.selfEmail = email;
      applyFilters();
    } catch (err) {
      console.warn("[Accounts] Admin session introspection failed", err);
    }
  }

  function normalizeStatus(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isSelfAccount(user) {
    if (!user) return false;
    if (state.selfId && user.id === state.selfId) return true;
    const email = String(user.email || "").trim().toLowerCase();
    if (state.selfEmail && email && email === state.selfEmail) return true;
    return false;
  }

  function normalizeAccountId(value) {
    if (value === undefined || value === null) return "";
    return String(value).trim();
  }

  function renderActionButton({ label, action, tone, disabled, title, accountId }) {
    const classes = ["ss-btn", "ss-btn-small", tone].filter(Boolean).join(" ");
    const disabledAttr = disabled ? " disabled" : "";
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    const accountAttr = accountId ? ` data-account-id="${escapeHtml(accountId)}"` : "";
    return `
      <button
        type="button"
        class="${classes}"
        data-account-action="${action}"
       ${accountAttr}
       ${disabledAttr}
       ${titleAttr}
      >${escapeHtml(label)}</button>
    `;
  }

  function formatDiscountValue(discountType, discountValue, currency = "usd") {
    const value = Number(discountValue);
    if (!Number.isFinite(value) || value <= 0) return "Unknown discount";
    if (String(discountType || "").trim().toLowerCase() === "percent") {
      return `${value}% off`;
    }
    return `${formatCurrencyCents(value, currency, "—")} off`;
  }

  function formatActorSummary(actor = {}) {
    const display = coerceText(actor.display_name || actor.displayName);
    const userCode = coerceText(actor.user_code || actor.userCode);
    const email = coerceText(actor.email);
    return display || userCode || email || "System";
  }

  function describeGrantDuration(summary) {
    if (!summary?.isAdminGrantedTier) return "No admin grant";
    if (summary.adminGrantIsLifetime) return "Lifetime";
    if (summary.adminGrantExpiresAt) return `Ends ${formatTimestamp(summary.adminGrantExpiresAt)}`;
    if (summary.adminGrantDurationUnit && summary.adminGrantDurationValue) {
      return `${summary.adminGrantDurationValue} ${summary.adminGrantDurationUnit}`;
    }
    return "Timed grant";
  }

  function renderBillingAdminHistory(user) {
    const interventions = Array.isArray(user?.billingAdminSummary?.interventions)
      ? user.billingAdminSummary.interventions
      : [];
    const codes = Array.isArray(user?.billingAdminSummary?.discountCodes)
      ? user.billingAdminSummary.discountCodes
      : [];
    const interventionMarkup = interventions.length
      ? interventions.slice(0, 8).map((item) => {
          let summary = humanizeSummaryToken(item.kind, "Intervention");
          if (item.kind === "gifted_tier") {
            summary = `${String(item.tierId || "core").toUpperCase()} grant`;
          } else if (item.kind === "discount" || item.kind === "discount_code_assignment") {
            summary = `${item.code ? `${item.code} · ` : ""}${formatDiscountValue(item.discount?.type || item.discountType, item.discount?.value || item.discountValue, item.discount?.currency || item.currency)}`;
          } else if (item.kind === "credit" || item.kind === "writeoff") {
            summary = `${formatCurrencyCents(item.ledger?.amount_cents || item.ledger?.amountCents, item.ledger?.currency || "usd", "—")} ${item.kind}`;
          }
          const revokeButton = item.status === "active"
            ? `<button type="button" class="ss-btn ss-btn-small ss-btn-secondary" data-account-billing-revoke="${escapeHtml(item.id)}" data-account-id="${escapeHtml(normalizeAccountId(user.id))}">Revoke</button>`
            : "";
          return `
            <div class="accounts-details-placeholder-block">
              <div class="accounts-details-placeholder-title">${escapeHtml(summary)}</div>
              <div class="accounts-details-placeholder-value">
                ${escapeHtml(`${humanizeSummaryToken(item.status, "Active")} · ${item.reason || item.reasonCode || "No reason recorded"}`)}
                <br />
                ${escapeHtml(`Created ${item.createdAt ? formatTimestamp(item.createdAt) : "—"} by ${formatActorSummary(item.createdBy)}`)}
                ${item.endsAt ? `<br />${escapeHtml(`Ends ${formatTimestamp(item.endsAt)}`)}` : ""}
              </div>
              ${revokeButton}
            </div>
          `;
        }).join("")
      : '<div class="accounts-details-placeholder-block"><div class="accounts-details-placeholder-title">No billing interventions</div><div class="accounts-details-placeholder-value">No account-specific billing overrides recorded yet.</div></div>';
    const codeMarkup = codes.length
      ? codes.slice(0, 6).map((item) => `
          <div class="accounts-details-placeholder-block">
            <div class="accounts-details-placeholder-title">${escapeHtml(item.code || "Code")}</div>
            <div class="accounts-details-placeholder-value">
              ${escapeHtml(`${formatDiscountValue(item.discountType, item.discountValue, item.currency)} · ${humanizeSummaryToken(item.status, "Active")}`)}
              <br />
              ${escapeHtml(`${humanizeSummaryToken(item.scope, "Global")} · ${item.reason || "No reason recorded"}`)}
            </div>
          </div>
        `).join("")
      : '<div class="accounts-details-placeholder-block"><div class="accounts-details-placeholder-title">No attached codes</div><div class="accounts-details-placeholder-value">No active or historical discount codes on this account.</div></div>';
    return `
      <div class="accounts-details-placeholder-group" style="margin-top:14px;">
        ${interventionMarkup}
      </div>
      <div class="accounts-details-placeholder-group" style="margin-top:14px;">
        ${codeMarkup}
      </div>
    `;
  }

  function renderBillingInterventionControls(user, { manageDisabled = false, isDeleted = false } = {}) {
    const accountId = normalizeAccountId(user?.id);
    const disabledAttr = manageDisabled || isDeleted ? "disabled" : "";
    return `
      <section class="accounts-details-group" style="margin-top:18px;">
        <h5 class="accounts-details-group-title">Billing Interventions</h5>
        <div class="accounts-details-group-grid">
          <div class="accounts-details-group" data-billing-form-kind="gifted_tier">
            <h5 class="accounts-details-group-title">Gift Paid Tier</h5>
            <div style="display:grid;gap:10px;">
              <select class="ss-input" data-billing-tier ${disabledAttr}>
                <option value="GOLD">GOLD</option>
                <option value="PRO">PRO</option>
              </select>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <select class="ss-input" data-billing-duration-unit ${disabledAttr}>
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                  <option value="lifetime">Lifetime</option>
                </select>
                <input class="ss-input" type="number" min="1" value="30" data-billing-duration-value ${disabledAttr} />
              </div>
              <textarea class="ss-input" rows="3" placeholder="Reason required" data-billing-reason ${disabledAttr}></textarea>
              <button type="button" class="ss-btn ss-btn-primary" data-account-billing-submit="gifted_tier" data-account-id="${escapeHtml(accountId)}" ${disabledAttr}>Create Gifted Tier</button>
            </div>
          </div>
          <div class="accounts-details-group" data-billing-form-kind="discount">
            <h5 class="accounts-details-group-title">Per-User Discount</h5>
            <div style="display:grid;gap:10px;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <select class="ss-input" data-billing-discount-type ${disabledAttr}>
                  <option value="percent">Percent</option>
                  <option value="amount">Amount</option>
                </select>
                <input class="ss-input" type="number" min="1" value="10" data-billing-discount-value ${disabledAttr} />
              </div>
              <textarea class="ss-input" rows="3" placeholder="Reason required" data-billing-reason ${disabledAttr}></textarea>
              <button type="button" class="ss-btn ss-btn-primary" data-account-billing-submit="discount" data-account-id="${escapeHtml(accountId)}" ${disabledAttr}>Apply Discount</button>
            </div>
          </div>
          <div class="accounts-details-group" data-billing-form-kind="discount_code_assignment">
            <h5 class="accounts-details-group-title">Per-User Discount Code</h5>
            <div style="display:grid;gap:10px;">
              <input class="ss-input" type="text" placeholder="Code" data-billing-code ${disabledAttr} />
              <input class="ss-input" type="text" placeholder="Label (optional)" data-billing-label ${disabledAttr} />
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <select class="ss-input" data-billing-discount-type ${disabledAttr}>
                  <option value="percent">Percent</option>
                  <option value="amount">Amount</option>
                </select>
                <input class="ss-input" type="number" min="1" value="10" data-billing-discount-value ${disabledAttr} />
              </div>
              <textarea class="ss-input" rows="3" placeholder="Reason required" data-billing-reason ${disabledAttr}></textarea>
              <button type="button" class="ss-btn ss-btn-primary" data-account-billing-submit="discount_code_assignment" data-account-id="${escapeHtml(accountId)}" ${disabledAttr}>Issue Per-User Code</button>
            </div>
          </div>
          <div class="accounts-details-group" data-billing-form-kind="ledger">
            <h5 class="accounts-details-group-title">Credits / Write-Offs</h5>
            <div style="display:grid;gap:10px;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <select class="ss-input" data-billing-ledger-kind ${disabledAttr}>
                  <option value="credit">Credit</option>
                  <option value="writeoff">Write-off</option>
                </select>
                <input class="ss-input" type="number" min="0.01" step="0.01" value="5.00" data-billing-amount ${disabledAttr} />
              </div>
              <textarea class="ss-input" rows="3" placeholder="Reason required" data-billing-reason ${disabledAttr}></textarea>
              <button type="button" class="ss-btn ss-btn-primary" data-account-billing-submit="ledger" data-account-id="${escapeHtml(accountId)}" ${disabledAttr}>Post Adjustment</button>
            </div>
          </div>
        </div>
        <div style="margin-top:18px;">
          <h5 class="accounts-details-group-title">Billing History</h5>
          ${renderBillingAdminHistory(user)}
        </div>
      </section>
    `;
  }

  function renderActions(user) {
    const status = normalizeStatus(user.accountStatus);
    const isDeleted = status === "deleted";
    const isSuspended = status === "suspended";
    const isActive = status === "active";
    const isSelf = isSelfAccount(user);
    const manageDisabled = !state.canManage;
    const isEmailVerified = user.emailVerified === true;
    const hasEmail = Boolean(user.email && user.email !== "—");
    const tiers = ["CORE", "GOLD", "PRO"];
    const currentTier = String(user.tier || "CORE").toUpperCase();
    const accountId = normalizeAccountId(user.id);

    const actions = [];
    if (isActive) {
      actions.push(
        renderActionButton({
          label: "Suspend",
          action: "suspend",
          tone: "ss-btn-secondary",
          disabled: manageDisabled || isDeleted,
          accountId
        })
      );
    } else if (isSuspended) {
      actions.push(
        renderActionButton({
          label: "Unsuspend",
          action: "unsuspend",
          tone: "ss-btn-secondary",
          disabled: manageDisabled || isDeleted,
          accountId
        })
      );
    } else {
      actions.push(
        renderActionButton({
          label: "Suspend",
          action: "suspend",
          tone: "ss-btn-secondary",
          disabled: true,
          title: "Suspend only available for active accounts.",
          accountId
        })
      );
    }

    actions.push(
      renderActionButton({
        label: "Reset Onboarding",
        action: "reset-onboarding",
        tone: "ss-btn-secondary",
        disabled: manageDisabled || isDeleted,
        title: isDeleted ? "Cannot reset a deleted account." : "",
        accountId
      })
    );

    actions.push(
      renderActionButton({
        label: "Force Email Reverify",
        action: "force-email-reverify",
        tone: "ss-btn-secondary",
        disabled: manageDisabled || isDeleted || !hasEmail,
        title: !hasEmail ? "No email on file." : "",
        accountId
      })
    );

    actions.push(
      renderActionButton({
        label: "Mark Email Verified",
        action: "mark-email-verified",
        tone: "ss-btn-secondary",
        disabled: manageDisabled || isDeleted || !hasEmail || isEmailVerified,
        title: isEmailVerified ? "Email already verified." : !hasEmail ? "No email on file." : "",
        accountId
      })
    );

    actions.push(
      renderActionButton({
        label: "Change Email",
        action: "admin-email-change",
        tone: "ss-btn-secondary",
        disabled: manageDisabled || isDeleted,
        accountId
      })
    );

    actions.push(
      renderActionButton({
        label: "Unlink Method",
        action: "admin-auth-unlink",
        tone: "ss-btn-secondary",
        disabled: manageDisabled || isDeleted,
        accountId
      })
    );

    actions.push(
      renderActionButton({
        label: "Force Logout",
        action: "invalidate-sessions",
        tone: "ss-btn-secondary",
        disabled: manageDisabled,
        accountId
      })
    );

    actions.push(
      renderActionButton({
        label: "Delete",
        action: "delete",
        tone: "ss-btn-danger",
        disabled: manageDisabled || isDeleted || isSelf,
        title: isSelf ? "Cannot delete your own account." : isDeleted ? "Account already deleted." : "",
        accountId
      })
    );

    return `
      <div class="accounts-row-actions-grid">
        <div class="accounts-row-actions-tier">
          <select class="ss-input" data-account-tier data-account-id="${escapeHtml(accountId)}" ${manageDisabled || isDeleted ? "disabled" : ""}>
          ${tiers
            .map((tier) => `<option value="${tier}"${tier === currentTier ? " selected" : ""}>${tier}</option>`)
            .join("")}
          </select>
        ${renderActionButton({
          label: "Update Tier",
          action: "tier",
          tone: "ss-btn-primary",
          disabled: manageDisabled || isDeleted,
          title: isDeleted ? "Cannot change tier on deleted accounts." : "",
          accountId
        })}
        </div>
        <div class="accounts-row-actions-buttons">
        ${actions.join("")}
        </div>
        ${renderAccountBadgeGovernance(user)}
        ${renderBillingInterventionControls(user, { manageDisabled, isDeleted })}
      </div>
    `;
  }

  function renderBadgeKeyLabel(key) {
    return formatBadgeLabel(key);
  }

  function sortBadgeKeys(keys = []) {
    return [...new Set((Array.isArray(keys) ? keys : []).map((item) => String(item || "").trim().toLowerCase()).filter(Boolean))]
      .sort((left, right) => {
        const leftIndex = BADGE_ORDER.indexOf(left);
        const rightIndex = BADGE_ORDER.indexOf(right);
        return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
      });
  }

  function getGovernedBadgeKeys(user) {
    const badgeState = user?.badgeState && typeof user.badgeState === "object" ? user.badgeState : {};
    const governanceCatalog = Array.isArray(state.badgeGovernance?.catalog) ? state.badgeGovernance.catalog : [];
    return sortBadgeKeys([
      ...Object.keys(badgeState.default_visibility || {}),
      ...Object.keys(badgeState.visibility_overrides || {}),
      ...Object.keys(badgeState.entitlements || {}),
      ...governanceCatalog.map((item) => item?.key)
    ]);
  }

  function renderBadgeStateSummary(items, emptyLabel) {
    return renderBadgeIconStrip(items, emptyLabel);
  }

  function renderAccountBadgeGovernance(user) {
    const badgeState = user?.badgeState && typeof user.badgeState === "object" ? user.badgeState : {};
    const entitlements = badgeState.entitlements && typeof badgeState.entitlements === "object" ? badgeState.entitlements : {};
    const visibilityOverrides =
      badgeState.visibility_overrides && typeof badgeState.visibility_overrides === "object"
        ? badgeState.visibility_overrides
        : {};
    const managedKeys = ["founder", "moderator", "developer"];
    const visibilityKeys = getGovernedBadgeKeys(user);
    const accountId = normalizeAccountId(user?.id);
    const entitlementRows = managedKeys
      .map((key) => {
        const enabled = entitlements[key]?.enabled === true;
        return `
          <label class="accounts-badge-inline-option muted">
            <input type="checkbox" data-account-badge-entitlement="${escapeHtml(key)}" data-account-id="${escapeHtml(accountId)}"${enabled ? " checked" : ""} />
            ${renderBadgeChoiceLabel(key, enabled ? "Enabled for this account" : "Not manually enabled")}
          </label>
        `;
      })
      .join("");
    const visibilityRows = visibilityKeys
      .map((key) => {
        const override = visibilityOverrides[key];
        const value =
          override && typeof override === "object" && override.visible === true
            ? "show"
            : override && typeof override === "object" && override.visible === false
            ? "hide"
            : "default";
        return `
          <label class="accounts-badge-visibility-row muted">
            ${renderBadgeChoiceLabel(
              key,
              value === "default"
                ? "Using system default"
                : value === "show"
                ? "Forced visible"
                : "Hidden on this account"
            )}
            <select class="ss-input" data-account-badge-visibility="${escapeHtml(key)}" data-account-id="${escapeHtml(accountId)}">
              <option value="default"${value === "default" ? " selected" : ""}>Use system default</option>
              <option value="show"${value === "show" ? " selected" : ""}>Force visible</option>
              <option value="hide"${value === "hide" ? " selected" : ""}>Hide</option>
            </select>
          </label>
        `;
      })
      .join("");
    return `
      <section class="accounts-details-group" style="margin-top:18px;">
        <h5 class="accounts-details-group-title">Badge Governance</h5>
        <div class="accounts-details-kpi-row">
          ${renderBadge("Visible", "ss-badge-success")}
          <span>${renderBadgeStateSummary(badgeState.visible, "No visible badges")}</span>
        </div>
        <div class="accounts-details-kpi-row">
          ${renderBadge("Hidden", "ss-badge-warning")}
          <span>${renderBadgeStateSummary(badgeState.hidden, "No hidden badges")}</span>
        </div>
        <div class="accounts-details-kpi-row">
          ${renderBadge("FindMeHere", "")}
          <span>${renderBadgeStateSummary(user.findmehereBadges, "No FindMeHere badges")}</span>
        </div>
        <div class="accounts-details-placeholder-group" style="margin-top:12px;">
          <div class="accounts-details-placeholder-block">
            <div class="accounts-details-placeholder-title">Manual entitlements</div>
            <div class="accounts-details-placeholder-value">${entitlementRows}</div>
          </div>
          <div class="accounts-details-placeholder-block">
            <div class="accounts-details-placeholder-title">Per-user visibility</div>
            <div class="accounts-details-placeholder-value">${visibilityRows}</div>
          </div>
        </div>
        <div class="accounts-inline-actions" style="margin-top:12px;">
          <button type="button" class="ss-btn ss-btn-small ss-btn-primary" data-account-badge-governance-save data-account-id="${escapeHtml(accountId)}">Save badge settings</button>
        </div>
      </section>
    `;
  }

  function renderSystemBadgeGovernancePanel() {
    if (!el.badgeGovernancePanel) return;
    const governance = state.badgeGovernance;
    if (!governance) {
      el.badgeGovernancePanel.innerHTML = '<div class="muted">Badge governance is unavailable.</div>';
      return;
    }
    const defaultVisibility = governance.default_visibility && typeof governance.default_visibility === "object" ? governance.default_visibility : {};
    const founder = governance.founder_reconcile || {};
    const governedKeys = sortBadgeKeys([
      ...Object.keys(defaultVisibility),
      ...((Array.isArray(governance.catalog) ? governance.catalog : []).map((item) => item?.key))
    ]);
    const visibleCount = governedKeys.filter((key) => defaultVisibility[key]).length;
    const visibilityRows = governedKeys
      .map((key) => `
        <label class="accounts-badge-choice">
          <input type="checkbox" data-system-badge-visibility="${escapeHtml(key)}"${defaultVisibility[key] ? " checked" : ""} />
          ${renderBadgeChoiceLabel(
            key,
            defaultVisibility[key] ? "Shown by default" : "Hidden by default"
          )}
        </label>
      `)
      .join("");
    el.badgeGovernancePanel.innerHTML = `
      <div class="accounts-governance-layout">
        <section class="accounts-governance-card accounts-governance-card-primary">
          <div class="accounts-governance-card-head">
            <div>
              <span class="accounts-governance-kicker">Founder Governance</span>
              <h5 class="accounts-details-group-title">Founder cutoff</h5>
            </div>
            <span class="ss-chip">${escapeHtml(String(governedKeys.length || 0))} governed badges</span>
          </div>
          <div class="accounts-governance-summary-grid">
            <div class="accounts-governance-stat">
              <span class="label">Eligible existing accounts</span>
              <strong class="value">${escapeHtml(String(founder.eligible_existing_accounts || 0))}</strong>
            </div>
            <div class="accounts-governance-stat">
              <span class="label">Founder enabled</span>
              <strong class="value">${escapeHtml(String(founder.enabled_accounts || 0))}</strong>
            </div>
            <div class="accounts-governance-stat">
              <span class="label">Pending reconcile</span>
              <strong class="value">${escapeHtml(String(founder.pending_accounts || 0))}</strong>
            </div>
            <div class="accounts-governance-stat">
              <span class="label">Visible by default</span>
              <strong class="value">${escapeHtml(String(visibleCount))}</strong>
            </div>
          </div>
          <div class="accounts-governance-controls">
            <label class="accounts-governance-date-field">
              <span class="label">Founder cutoff date</span>
              <input id="accounts-founder-cutoff-date" class="ss-input" type="date" value="${escapeHtml(governance.founder_cutoff_date || "")}" />
            </label>
            <div class="accounts-inline-actions accounts-governance-actions">
              <button type="button" id="accounts-badge-governance-save" class="ss-btn ss-btn-primary">Save governance</button>
              <button type="button" id="accounts-founder-reconcile" class="ss-btn ss-btn-secondary">Reconcile founder</button>
            </div>
          </div>
        </section>
        <section class="accounts-governance-card">
          <div class="accounts-governance-card-head">
            <div>
              <span class="accounts-governance-kicker">Surface Defaults</span>
              <h5 class="accounts-details-group-title">System default visibility</h5>
            </div>
            <span class="accounts-governance-muted">${escapeHtml(String(governedKeys.length || 0))} badge options</span>
          </div>
          <div class="accounts-governance-badge-grid">
            ${visibilityRows}
          </div>
        </section>
      </div>
    `;
  }

  function extractUsers(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.users)) return payload.users;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
  }

  function setBanner(message, visible, options = {}) {
    if (visible && message) {
      window.StreamSuitesToast?.[options.tone || "warning"]?.(message, {
        key: options.key || "accounts-banner",
        title: options.title || "Accounts",
        autoDismissMs: options.autoDismissMs
      });
    } else if (!visible) {
      window.StreamSuitesToast?.dismiss?.(options.key || "accounts-banner");
    }
    if (!el.banner) return;
    if (options.inline === false) {
      el.banner.innerHTML = "";
      el.banner.classList.add("hidden");
      return;
    }
    el.banner.innerHTML = "";
    if (visible) {
      const text = document.createElement("span");
      text.textContent = message;
      el.banner.appendChild(text);
      if (options.retryAction) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ss-btn ss-btn-secondary ss-btn-small";
        button.setAttribute("data-accounts-retry", options.retryAction);
        button.textContent = "Retry";
        el.banner.appendChild(document.createTextNode(" "));
        el.banner.appendChild(button);
      }
    }
    el.banner.classList.toggle("hidden", !visible);
  }

  function setStatus(message) {
    if (el.status) el.status.textContent = message;
  }

  function setSource(label) {
    state.sourceLabel = label;
    if (el.source) el.source.textContent = label;
  }

  function setExportStatus(message) {
    if (!el.exportStatus) return;
    el.exportStatus.textContent = message;
  }

  function setExportButtonsLoading(isLoading) {
    state.exportLoading = isLoading;
    [el.exportJson, el.exportCsv].forEach((button) => {
      if (!button) return;
      if (isLoading) {
        button.dataset.originalLabel = button.textContent || "";
        button.disabled = true;
        button.textContent = "Exporting...";
      } else {
        const original = button.dataset.originalLabel;
        if (original !== undefined) {
          button.textContent = original;
          delete button.dataset.originalLabel;
        }
        button.disabled = false;
      }
    });
  }

  function updateEmptyStateMessage(filteredCount) {
    if (!el.empty) return;
    const hasFilters =
      Boolean(el.typeFilter?.value) ||
      Boolean(el.roleFilter?.value) ||
      Boolean(el.tierFilter?.value) ||
      Boolean(el.providerFilter?.value) ||
      Boolean(el.search?.value);
    if (state.raw.length === 0) {
      el.empty.textContent =
        "No accounts available yet. Confirm the runtime is connected, then refresh.";
      return;
    }
    if (filteredCount === 0 && hasFilters) {
      el.empty.textContent = "No accounts match these filters. Clear filters or search to see all accounts.";
      return;
    }
    el.empty.textContent = "No accounts to display right now.";
  }

  function updateFilterOptions(items) {
    const accountTypes = new Set();
    const roles = new Set();
    const tiers = new Set();
    const providers = new Set();

    items.forEach((item) => {
      if (item.accountType && item.accountType !== "—") accountTypes.add(item.accountType);
      if (item.role && item.role !== "—") roles.add(item.role);
      if (item.tier && item.tier !== "—") tiers.add(item.tier);
      (item.providers || []).forEach((provider) => {
        if (provider?.label) providers.add(provider.label);
      });
    });

    fillSelect(el.typeFilter, accountTypes, "All account types");
    fillSelect(el.roleFilter, roles, "All roles");
    fillSelect(el.tierFilter, tiers, "All tiers");
    fillSelect(el.providerFilter, providers, "All providers");
  }

  function fillSelect(selectEl, values, placeholder) {
    if (!selectEl) return;
    const current = selectEl.value;
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
    Array.from(values)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        selectEl.appendChild(option);
      });
    selectEl.value = current || "";
  }

  function getFilteredData() {
    const accountType = el.typeFilter?.value || "";
    const role = el.roleFilter?.value || "";
    const tier = el.tierFilter?.value || "";
    const provider = el.providerFilter?.value || "";

    return state.raw.filter((item) => {
      if (accountType && String(item.accountType).toLowerCase() !== accountType.toLowerCase()) {
        return false;
      }
      if (role && String(item.role).toLowerCase() !== role.toLowerCase()) {
        return false;
      }
      if (tier && String(item.tier).toLowerCase() !== tier.toLowerCase()) {
        return false;
      }
      if (provider) {
        const hasProvider = (item.providers || []).some((p) =>
          String(p.label || "").toLowerCase() === provider.toLowerCase()
        );
        if (!hasProvider) return false;
      }
      return true;
    });
  }

  function getSearchFilteredCount(baseItems) {
    const term = el.search?.value || "";
    if (window.SearchPagination?.filterData) {
      return window.SearchPagination.filterData(baseItems, term, SEARCH_FIELDS).length;
    }
    return baseItems.length;
  }

  function applyFilters() {
    const filtered = getFilteredData();
    state.manager?.setData(filtered);
    updateEmptyStateMessage(getSearchFilteredCount(filtered));
  }

  function syncAccountsPageSizeControl(value) {
    if (!(el.pageSize instanceof HTMLSelectElement)) return;
    const numericValue = Number(value);
    const safeValue = Number.isFinite(numericValue)
      ? Math.min(100, Math.max(5, Math.trunc(numericValue)))
      : 10;
    el.pageSize.value = String(safeValue);
  }

  function toggleIdColumn(show) {
    if (!el.table) return;
    const columns = el.table.querySelectorAll(".accounts-id-column");
    columns.forEach((col) => col.classList.toggle("hidden", !show));
    const idCol = el.table.querySelector('col[data-col-key="internalId"]');
    if (idCol) {
      idCol.classList.toggle("hidden", !show);
    }
  }

  function renderTextValue(value, fallback = "—") {
    const normalized =
      value === undefined || value === null || String(value).trim() === ""
        ? fallback
        : String(value);
    return `<span class="accounts-cell-ellipsis" title="${escapeHtml(normalized)}">${escapeHtml(
      normalized
    )}</span>`;
  }

  function buildProfileHoverAttrs(user, options = {}) {
    const profile = user && typeof user === "object" ? user : {};
    const displayName = String(
      options.displayName || profile.displayName || profile.userCode || profile.email || "Account"
    ).trim();
    const userCode = String(options.userCode || profile.userCode || "").trim();
    const userId = normalizeAccountId(options.userId || profile.id || "");
    const role = String(options.role || profile.role || profile.accountType || "PUBLIC")
      .trim()
      .toUpperCase();
    const profileHref = userCode
      ? user.streamsuitesProfileUrl || `https://streamsuites.app/u/${encodeURIComponent(user.publicSlug || userCode)}`
      : userId
      ? user.streamsuitesProfileUrl || `https://streamsuites.app/community/profile.html?id=${encodeURIComponent(userId)}`
      : "";
    const badges = serializeDataAttr(options.badges || profile.badges || []);
    const socialLinks = serializeDataAttr(options.socialLinks || profile.socialLinks || {});
    const attrs = [
      'data-ss-profile-hover-trigger="true"',
      `data-ss-display-name="${escapeHtml(displayName || "Account")}"`,
      `data-ss-role="${escapeHtml(role || "PUBLIC")}"`,
      `data-ss-user-code="${escapeHtml(userCode)}"`,
      `data-ss-user-id="${escapeHtml(userId)}"`,
      `data-ss-profile-href="${escapeHtml(profileHref)}"`,
      `data-ss-avatar-url="${escapeHtml(coerceText(options.avatarUrl || profile.avatarUrl))}"`,
      `data-ss-cover-url="${escapeHtml(coerceText(options.coverImageUrl || profile.coverImageUrl || profile.bannerImageUrl))}"`,
      `data-ss-bio="${escapeHtml(coerceText(options.bio || profile.bio))}"`,
      `data-ss-tier="${escapeHtml(coerceText(options.tier || profile.tier))}"`,
      `data-ss-badges="${escapeHtml(badges)}"`,
      `data-ss-social-links="${escapeHtml(socialLinks)}"`
    ];
    return attrs.join(" ");
  }

  function renderAccountIdValue(user) {
    const accountId = normalizeAccountId(user?.id);
    if (!accountId || accountId === "—") {
      return renderTextValue(accountId || "—");
    }
    const hoverAttrs = buildProfileHoverAttrs(user, { userId: accountId });
    return `<span class="accounts-cell-ellipsis accounts-hover-link accounts-table-system-value" ${hoverAttrs} title="${escapeHtml(accountId)}">${escapeHtml(accountId)}</span>`;
  }

  function renderAvatarValue(user) {
    const displayName = coerceText(user?.displayName || user?.userCode || user?.email, "Account");
    const avatarUrl = coerceText(user?.avatarUrl);
    const content = avatarUrl
      ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)} avatar" loading="lazy" decoding="async" />`
      : `<span>${escapeHtml(resolveAvatarInitials(user))}</span>`;
    return `<span class="accounts-table-avatar${avatarUrl ? " has-image" : ""}" ${buildProfileHoverAttrs(user, { displayName, avatarUrl })}>${content}</span>`;
  }

  function renderDisplayNameValue(user) {
    const displayName = String(user?.displayName || "—").trim() || "—";
    const hoverAttrs = buildProfileHoverAttrs(user, { displayName });
    return `<span class="accounts-cell-ellipsis accounts-hover-link" ${hoverAttrs} title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>`;
  }

  function renderUserCodeLink(user) {
    const userCode = String(user?.userCode || "").trim();
    if (!userCode || userCode === "—") {
      return renderTextValue(userCode || "—");
    }
    return `
      <button
        type="button"
        class="ss-link-btn accounts-hover-button accounts-table-system-link"
        data-account-open-creator="${escapeHtml(userCode)}"
        ${buildProfileHoverAttrs(user, { userCode })}
      >
        <code class="accounts-table-system-value">${escapeHtml(userCode)}</code>
      </button>
    `;
  }

  function renderActionsToggle(user) {
    const accountId = normalizeAccountId(user.id);
    const userCode = escapeHtml(user.userCode || "");
    const displayName = escapeHtml(user.displayName || user.userCode || user.email || "account");
    return `
      <div class="accounts-inline-actions" role="group" aria-label="Actions for ${displayName}">
        <button
          type="button"
          class="ss-btn ss-btn-small ss-btn-primary accounts-actions-primary"
          title="Open full user details"
          data-account-open-user-detail="${userCode}"
        >
          Details
        </button>
        <button
          type="button"
          class="ss-btn ss-btn-small ss-btn-secondary ss-btn-icon-only accounts-icon-action"
          data-account-open-integrations
          data-account-id="${escapeHtml(accountId)}"
          data-account-user-code="${userCode}"
          aria-label="Open creator integrations for ${displayName}"
          title="Open creator integrations"
        >
          <span
            class="ss-btn-icon-glyph"
            aria-hidden="true"
            style="--ss-btn-icon: url('/assets/icons/ui/integrations.svg')"
          ></span>
        </button>
        <button
          type="button"
          class="ss-btn ss-btn-small ss-btn-secondary ss-btn-icon-only accounts-icon-action"
          data-account-open-stats
          data-account-id="${escapeHtml(accountId)}"
          aria-label="Open creator stats for ${displayName}"
          title="Open creator stats"
        >
          <span
            class="ss-btn-icon-glyph"
            aria-hidden="true"
            style="--ss-btn-icon: url('/assets/icons/ui/querystats.svg')"
          ></span>
        </button>
      </div>
    `;
  }

  function renderRow(user) {
    const accountId = normalizeAccountId(user.id);
    return `
      <td class="accounts-id-column" data-account-id="${escapeHtml(accountId)}">${renderAccountIdValue(user)}</td>
      <td>${renderAvatarValue(user)}</td>
      <td>${renderUserCodeLink(user)}</td>
      <td>${renderTextValue(user.email)}</td>
      <td>${renderEmailVerified(user.emailVerified)}</td>
      <td>${renderDisplayNameValue(user)}</td>
      <td>${renderBadge(user.role)}</td>
      <td>${renderBadge(user.tier)}</td>
      <td>${renderBadge(user.supporterLabel, user.supporterTone)}</td>
      <td>${renderTextValue(user.lifetimeTotalPaidLabel)}</td>
      <td>${renderTextValue(user.lastPaymentDateLabel)}</td>
      <td>${renderBadge(user.accountStatus, badgeToneForStatus(user.accountStatus))}</td>
      <td>${renderBadge(user.onboardingStatus, badgeToneForStatus(user.onboardingStatus))}</td>
      <td>${renderTextValue(user.providersLabel)}</td>
      <td>${renderTextValue(formatTimestamp(user.createdAt))}</td>
      <td>${renderTextValue(formatTimestamp(user.lastLogin))}</td>
      <td class="align-right accounts-actions-cell">${renderActionsToggle({ ...user, id: accountId })}</td>
    `;
  }

  function getUserById(accountId) {
    const id = normalizeAccountId(accountId);
    if (!id) return null;
    return state.raw.find((entry) => normalizeAccountId(entry?.id) === id) || null;
  }

  function openCreatorIdentity(userCode) {
    const normalizedCode = String(userCode || "").trim();
    if (!normalizedCode || normalizedCode === "—") return;
    const navState = getLinkageNavState();
    navState.userCode = normalizedCode;
    navState.from = "accounts";
    navState.ts = Date.now();
    navigateToView("creators");
  }

  function openCreatorStats(accountId) {
    const normalizedId = normalizeAccountId(accountId);
    if (!normalizedId || normalizedId === "—") return;
    if (!window.StreamSuitesCreatorStatsNav || typeof window.StreamSuitesCreatorStatsNav !== "object") {
      window.StreamSuitesCreatorStatsNav = {};
    }
    window.StreamSuitesCreatorStatsNav.accountId = normalizedId;
    window.StreamSuitesCreatorStatsNav.from = "accounts";
    window.StreamSuitesCreatorStatsNav.ts = Date.now();
    if (window.StreamSuitesAdminRoutes?.navigateToView) {
      window.StreamSuitesAdminRoutes.navigateToView("creator-stats", {
        params: { account_id: normalizedId }
      });
      return;
    }
    window.location.hash = `#creator-stats?account_id=${encodeURIComponent(normalizedId)}`;
  }

  function openUserDetail(userCode) {
    const normalizedUserCode = String(userCode || "").trim();
    if (!normalizedUserCode || normalizedUserCode === "—") return;
    if (window.StreamSuitesAdminRoutes?.navigateToView) {
      window.StreamSuitesAdminRoutes.navigateToView("user-detail", {
        params: { user_code: normalizedUserCode }
      });
      return;
    }
    window.location.hash = `#users/${encodeURIComponent(normalizedUserCode)}`;
  }

  function openCreatorIntegrations(accountId, userCode) {
    const normalizedId = normalizeAccountId(accountId);
    const normalizedUserCode = String(userCode || "").trim();
    if ((!normalizedId || normalizedId === "—") && !normalizedUserCode) return;
    if (
      !window.StreamSuitesCreatorIntegrationsNav ||
      typeof window.StreamSuitesCreatorIntegrationsNav !== "object"
    ) {
      window.StreamSuitesCreatorIntegrationsNav = {};
    }
    window.StreamSuitesCreatorIntegrationsNav.accountId = normalizedId;
    window.StreamSuitesCreatorIntegrationsNav.userCode = normalizedUserCode;
    window.StreamSuitesCreatorIntegrationsNav.from = "accounts";
    window.StreamSuitesCreatorIntegrationsNav.ts = Date.now();
    if (window.StreamSuitesAdminRoutes?.navigateToView) {
      window.StreamSuitesAdminRoutes.navigateToView("creator-integrations", {
        params: normalizedUserCode ? { user_code: normalizedUserCode } : { account_id: normalizedId }
      });
      return;
    }
    window.location.hash = normalizedUserCode
      ? `#creator-integrations?user_code=${encodeURIComponent(normalizedUserCode)}`
      : `#creator-integrations?account_id=${encodeURIComponent(normalizedId)}`;
  }

  function getBaseRowByAccountId(accountId) {
    const id = normalizeAccountId(accountId);
    if (!el.body || !id) return null;
    const rows = el.body.querySelectorAll('tr[data-row-type="account"][data-account-id]');
    for (const row of rows) {
      if (normalizeAccountId(row.getAttribute("data-account-id")) === id) {
        return row;
      }
    }
    const triggers = el.body.querySelectorAll("[data-account-open-actions]");
    for (const trigger of triggers) {
      if (normalizeAccountId(trigger.getAttribute("data-account-id")) !== id) continue;
      return trigger.closest("tr");
    }
    return null;
  }

  function setDrawerToggleState(row, isOpen) {
    if (!row) return;
    const trigger = row.querySelector("[data-account-open-actions]");
    if (!(trigger instanceof HTMLButtonElement)) return;
    trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    trigger.classList.toggle("is-open", isOpen);
  }

  function isDetailsDrawerOpen() {
    return Boolean(el.detailsDrawer && !el.detailsDrawer.classList.contains("hidden"));
  }

  function syncDrawerToggleStates() {
    if (!el.body) return;
    const rows = el.body.querySelectorAll('tr[data-row-type="account"]');
    rows.forEach((row) => {
      const rowId = normalizeAccountId(row.getAttribute("data-account-id"));
      const isSelected = isDetailsDrawerOpen() && Boolean(state.openDrawerId) && rowId === state.openDrawerId;
      setDrawerToggleState(row, isSelected);
    });
  }

  function syncSelectedRowState() {
    if (!el.body) return;
    const rows = el.body.querySelectorAll('tr[data-row-type="account"]');
    rows.forEach((row) => {
      const rowId = normalizeAccountId(row.getAttribute("data-account-id"));
      const isSelected = isDetailsDrawerOpen() && Boolean(state.openDrawerId) && rowId === state.openDrawerId;
      row.classList.toggle("accounts-row-selected", isSelected);
    });
    syncDrawerToggleStates();
  }

  function clearRowClickTimer() {
    if (!state.rowClickTimer) return;
    clearTimeout(state.rowClickTimer);
    state.rowClickTimer = null;
  }

  function clearDrawerCloseTimer() {
    if (!state.drawerCloseTimer) return;
    clearTimeout(state.drawerCloseTimer);
    state.drawerCloseTimer = null;
  }

  function resolveRoleList(roleValue) {
    const normalized = String(roleValue || "").trim();
    if (!normalized || normalized === "—") return ["Unknown"];
    const roles = normalized
      .split(/[|,]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    return roles.length > 0 ? roles : [normalized];
  }

  function resolveAvatarInitials(user) {
    const preferred = String(user.displayName || user.userCode || user.email || "").trim();
    if (!preferred) return "NA";
    const parts = preferred.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  function humanizeSurfaceReason(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return "No status reason provided.";
    switch (normalized) {
      case "visible":
        return "Visible on the saved canonical profile.";
      case "missing_public_slug":
        return "Missing canonical public slug.";
      case "disabled_by_account":
        return "Disabled at the account level.";
      case "creator_capable_required":
        return "Requires a creator-capable account.";
      default:
        return formatBadgeLabel(normalized);
    }
  }

  function renderBooleanBadge(value, trueLabel, falseLabel, falseTone = "") {
    return renderBadge(value ? trueLabel : falseLabel, value ? "ss-badge-success" : falseTone);
  }

  function renderUrlValue(url, emptyLabel) {
    if (!url) {
      return `<span class="accounts-details-keyline-value accounts-system-text is-muted">${escapeHtml(
        emptyLabel
      )}</span>`;
    }
    return `
      <a class="ss-link accounts-details-keyline-value accounts-system-text" href="${escapeHtml(
        url
      )}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>
    `;
  }

  function isInlineDataUrl(value) {
    return String(value || "").trim().toLowerCase().startsWith("data:");
  }

  function truncateMiddle(value, max = 72) {
    const text = coerceText(value);
    if (!text || text.length <= max) return text;
    const lead = Math.max(16, Math.floor((max - 3) / 2));
    const tail = Math.max(12, max - lead - 3);
    return `${text.slice(0, lead)}...${text.slice(text.length - tail)}`;
  }

  function normalizeMediaMeta(rawMedia, fallbackUrl, slot) {
    if (!rawMedia || typeof rawMedia !== "object") return null;
    const normalizedSlot = coerceText(rawMedia.slot || slot).toLowerCase();
    if (!normalizedSlot) return null;
    return {
      slot: normalizedSlot,
      sourceType: coerceText(rawMedia.source_type || rawMedia.sourceType || "uploaded").toLowerCase(),
      storageBackend: coerceText(rawMedia.storage_backend || rawMedia.storageBackend),
      assetKey: coerceText(rawMedia.asset_key || rawMedia.assetKey),
      publicUrl: coerceText(rawMedia.public_url || rawMedia.publicUrl || fallbackUrl),
      mimeType: coerceText(rawMedia.mime_type || rawMedia.mimeType),
      version: rawMedia.version ?? null,
      width: rawMedia.width ?? null,
      height: rawMedia.height ?? null,
      fileSize: rawMedia.file_size ?? rawMedia.fileSize ?? null,
      uploadedAt: coerceText(rawMedia.uploaded_at || rawMedia.uploadedAt),
    };
  }

  function renderMediaReference(url, media, emptyLabel) {
    const safeUrl = coerceText(url);
    if (!safeUrl) {
      return `<span class="accounts-details-keyline-value accounts-system-text is-muted">${escapeHtml(
        emptyLabel
      )}</span>`;
    }
    if (isInlineDataUrl(safeUrl)) {
      return `<span class="accounts-details-keyline-value accounts-system-text">${escapeHtml(
        `Legacy inline data URL (${safeUrl.length} chars)`
      )}</span>`;
    }
    const href = escapeHtml(safeUrl);
    const label = escapeHtml(truncateMiddle(media?.assetKey || safeUrl));
    return `<a class="ss-link accounts-details-keyline-value accounts-system-text" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  }

  function renderDrawerProfileSummary(user) {
    const title = user.displayName || user.userCode || user.email || "Account";
    const subtitle = user.userCode || "—";
    const paymentSummary = user.paymentSummary && typeof user.paymentSummary === "object"
      ? user.paymentSummary
      : normalizePaymentSummary(null, user.tier);
    const previewHref = user.streamsuitesProfileUrl || `https://streamsuites.app/u/${encodeURIComponent(user.publicSlug || user.userCode || "")}`;
    const roleBadges = [
      ...resolveRoleList(user.role).map((role) => renderBadge(role)),
      renderBadge(
        user.creatorCapable ? "Creator-capable" : "Viewer-only",
        user.creatorCapable ? "ss-badge-success" : ""
      ),
      user.publicSurfaceAccountType
        ? renderBadge(formatBadgeLabel(user.publicSurfaceAccountType))
        : ""
    ]
      .filter(Boolean)
      .join("");
    const roleLabel = resolveRoleList(user.role)
      .map((role) => formatBadgeLabel(role))
      .join(", ");
    const identitySummary = user.creatorCapable
      ? "Creator-capable account"
      : user.viewerOnly
      ? "Viewer-only public account"
      : "Account capability unknown";
    const streamsuitesVisibilitySummary = user.streamsuitesProfileVisible
      ? "Visible"
      : user.streamsuitesProfileEligible
      ? "Hidden"
      : "Ineligible";
    const findMeHereVisibilitySummary = user.findMeHereVisible
      ? "Listed"
      : user.findMeHereEligible
      ? "Not listed"
      : "Ineligible";
    const supporterState = describeSupporterState(paymentSummary);
    const recurringState = describeRecurringState(paymentSummary);
    const lifetimePaidLabel = formatCurrencyCents(
      paymentSummary.lifetimeTotalPaidCents,
      paymentSummary.currency,
      paymentSummary.hasAnyPayment ? "—" : "No payments"
    );
    const donationPaidLabel = formatCurrencyCents(
      paymentSummary.donationTotalPaidCents,
      paymentSummary.currency,
      paymentSummary.hasOneoffDonation ? "—" : "No donation history"
    );
    const lastPaymentAmountLabel = formatCurrencyCents(
      paymentSummary.lastPaymentAmountCents,
      paymentSummary.currency,
      "Not captured"
    );
    const lastPaymentDateLabel = paymentSummary.lastPaymentAt ? formatTimestamp(paymentSummary.lastPaymentAt) : "No payment recorded";
    const nextDueLabel = paymentSummary.nextDueAt ? formatTimestamp(paymentSummary.nextDueAt) : "Not scheduled";
    const balanceReliefLabel = formatCurrencyCents(
      paymentSummary.balanceReliefTotalCents,
      paymentSummary.currency,
      "No adjustments"
    );
    const activeDiscountSummary = Array.isArray(paymentSummary.activeDiscounts) && paymentSummary.activeDiscounts.length
      ? paymentSummary.activeDiscounts
          .slice(0, 3)
          .map((item) => {
            const code = coerceText(item.code).toUpperCase();
            const descriptor = formatDiscountValue(item.discount_type || item.discountType, item.discount_value || item.discountValue, item.currency);
            return code ? `${code} (${descriptor})` : descriptor;
          })
          .join(", ")
      : "No active discounts";
    const effectiveTierSourceLabel = paymentSummary.isAdminGrantedTier
      ? "Admin-granted tier"
      : paymentSummary.effectiveTierSource === "account_tier"
      ? "Account tier"
      : humanizeSummaryToken(paymentSummary.effectiveTierSource, "Account tier");
    const adminGrantDurationLabel = describeGrantDuration(paymentSummary);
    const badgeIcons = renderBadgeIconStrip(user.badges);
    const socialLinks = user.socialLinks && typeof user.socialLinks === "object" ? user.socialLinks : {};
    const socialMarkup = Object.entries(socialLinks)
      .filter(([, url]) => coerceText(url))
      .slice(0, 6)
      .map(
        ([label, url]) =>
          `<a class="ss-link" href="${escapeHtml(coerceText(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(
            formatBadgeLabel(label)
          )}</a>`
      )
      .join(" · ");
    const avatarMarkup = user.avatarUrl
      ? `<img src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(title)} avatar" loading="lazy" decoding="async" />`
      : `<span>${escapeHtml(resolveAvatarInitials(user))}</span>`;
    return `
      <article class="accounts-details-profile-card glass-card">
        <div class="accounts-details-preview-cover"${user.coverImageUrl ? ` style="background-image:url('${escapeHtml(user.coverImageUrl)}')"` : ""}></div>
        <div class="accounts-details-profile-head">
          <div class="accounts-details-avatar${user.avatarUrl ? " has-image" : ""}" aria-hidden="true">${avatarMarkup}</div>
          <div class="accounts-details-identity">
            <strong class="accounts-details-name">${escapeHtml(title)}</strong>
            <span class="accounts-details-user-code">${escapeHtml(subtitle)}</span>
            <div class="accounts-details-role-row">${roleBadges}</div>
          </div>
        </div>
        <div class="accounts-details-meta-grid">
          <div><span class="label">Role</span><span class="value">${escapeHtml(roleLabel || "Unknown")}</span></div>
          <div><span class="label">Tier</span><span class="value">${renderBadge(user.tier || "—")}</span></div>
          <div><span class="label">Public Surface Type</span><span class="value">${renderBadge(
            user.publicSurfaceAccountType || "Unknown",
            user.creatorCapable ? "ss-badge-success" : ""
          )}</span></div>
          <div><span class="label">Capability</span><span class="value">${renderBadge(
            user.creatorCapable ? "Creator-capable" : "Viewer-only",
            user.creatorCapable ? "ss-badge-success" : ""
          )}</span></div>
          <div><span class="label">Status</span><span class="value">${renderBadge(
            user.accountStatus || "—",
            badgeToneForStatus(user.accountStatus)
          )}</span></div>
          <div><span class="label">Onboarding</span><span class="value">${renderBadge(
            user.onboardingStatus || "—",
            badgeToneForStatus(user.onboardingStatus)
          )}</span></div>
          <div><span class="label">Email</span><span class="value">${escapeHtml(user.email || "—")}</span></div>
          <div><span class="label">Pending Email</span><span class="value">${escapeHtml(user.pendingEmail || "—")}</span></div>
          <div><span class="label">Created</span><span class="value">${escapeHtml(
            formatTimestamp(user.createdAt)
          )}</span></div>
          <div><span class="label">Pending Expires</span><span class="value">${escapeHtml(
            formatTimestamp(user.emailChangeExpiresAt)
          )}</span></div>
          <div><span class="label">Last Login</span><span class="value">${escapeHtml(
            formatTimestamp(user.lastLogin)
          )}</span></div>
          <div>
            <span class="label">Profile Surface</span>
            <span class="value"><a class="ss-link" href="${escapeHtml(
              previewHref
            )}" target="_blank" rel="noopener noreferrer">Open profile</a></span>
          </div>
        </div>
      </article>
      <section class="accounts-details-group accounts-details-inline-preview">
        <h5 class="accounts-details-group-title">Inline Public Preview</h5>
        <div class="accounts-details-preview-card">
          <div class="accounts-details-preview-media"${user.coverImageUrl ? ` style="background-image:url('${escapeHtml(user.coverImageUrl)}')"` : ""}></div>
          <div class="accounts-details-preview-body">
            <div class="accounts-details-preview-avatar${user.avatarUrl ? " has-image" : ""}">${avatarMarkup}</div>
            <div class="accounts-details-preview-head">
              <strong>${escapeHtml(title)}</strong>
              <span>${escapeHtml(formatBadgeLabel(user.publicSurfaceAccountType || user.role || "Public"))}</span>
            </div>
            <div class="accounts-details-preview-badges">${badgeIcons || '<span class="muted">No enabled badges</span>'}</div>
            <p class="accounts-details-preview-bio">${escapeHtml(user.bio || "No public bio saved.")}</p>
            <div class="accounts-details-preview-links">${socialMarkup || '<span class="muted">No public social links saved.</span>'}</div>
          </div>
        </div>
      </section>
      <div class="accounts-details-group-grid">
        <section class="accounts-details-group">
          <h5 class="accounts-details-group-title">Public Identity</h5>
          <div class="accounts-details-kpi-row">
            ${renderBadge(identitySummary, user.creatorCapable ? "ss-badge-success" : "")}
            ${renderBooleanBadge(user.viewerOnly, "Viewer-only", "Not viewer-only")}
            ${renderBooleanBadge(user.creatorCapable, "Creator-capable", "Not creator-capable")}
          </div>
          <div class="accounts-details-meta-grid">
            <div><span class="label">Canonical Slug</span><span class="value accounts-system-text">${escapeHtml(
              user.publicSlug || "—"
            )}</span></div>
            <div><span class="label">Slug Aliases</span><span class="value accounts-system-text">${escapeHtml(
              user.slugAliases.length ? user.slugAliases.join(", ") : "—"
            )}</span></div>
            <div><span class="label">Avatar Reference</span>${renderMediaReference(
              user.avatarUrl,
              user.avatarMedia,
              "No avatar URL"
            )}</div>
            <div><span class="label">User Code</span><span class="value accounts-system-text">${escapeHtml(
              user.userCode || "—"
            )}</span></div>
          </div>
        </section>
        <section class="accounts-details-group">
          <h5 class="accounts-details-group-title">StreamSuites Profile State</h5>
          <div class="accounts-details-kpi-row">
            ${renderBooleanBadge(user.streamsuitesProfileEligible, "Eligible", "Ineligible")}
            ${renderBooleanBadge(user.streamsuitesProfileEnabled, "Enabled", "Disabled", "ss-badge-danger")}
            ${renderBadge(
              streamsuitesVisibilitySummary,
              user.streamsuitesProfileVisible
                ? "ss-badge-success"
                : user.streamsuitesProfileEligible
                ? "ss-badge-warning"
                : ""
            )}
          </div>
          <div class="accounts-details-meta-grid">
            <div><span class="label">Visibility Reason</span><span class="value">${escapeHtml(
              humanizeSurfaceReason(user.streamsuitesProfileStatusReason)
            )}</span></div>
            <div><span class="label">Raw Reason</span><span class="value accounts-system-text">${escapeHtml(
              user.streamsuitesProfileStatusReason || "—"
            )}</span></div>
          </div>
        </section>
        <section class="accounts-details-group">
          <h5 class="accounts-details-group-title">FindMeHere State</h5>
          <div class="accounts-details-kpi-row">
            ${renderBooleanBadge(user.findMeHereEligible, "Eligible", "Ineligible")}
            ${renderBooleanBadge(user.findMeHereEnabled, "Enabled", "Disabled", "ss-badge-danger")}
            ${renderBadge(
              findMeHereVisibilitySummary,
              user.findMeHereVisible
                ? "ss-badge-success"
                : user.findMeHereEligible
                ? "ss-badge-warning"
                : ""
            )}
          </div>
          <div class="accounts-details-meta-grid">
            <div><span class="label">Visibility Reason</span><span class="value">${escapeHtml(
              humanizeSurfaceReason(user.findMeHereStatusReason)
            )}</span></div>
            <div><span class="label">Raw Reason</span><span class="value accounts-system-text">${escapeHtml(
              user.findMeHereStatusReason || "—"
            )}</span></div>
          </div>
        </section>
        <section class="accounts-details-group">
          <h5 class="accounts-details-group-title">Canonical URLs &amp; Share Targets</h5>
          <div class="accounts-details-link-grid">
            <div class="accounts-details-url-card">
              <span class="accounts-details-keyline-label">StreamSuites profile URL</span>
              ${renderUrlValue(user.streamsuitesProfileUrl, "No canonical StreamSuites URL")}
              <span class="accounts-details-url-note">${escapeHtml(
                user.streamsuitesShareUrl
                  ? "Canonical StreamSuites share target is live."
                  : humanizeSurfaceReason(user.streamsuitesProfileStatusReason)
              )}</span>
            </div>
            <div class="accounts-details-url-card">
              <span class="accounts-details-keyline-label">FindMeHere profile URL</span>
              ${renderUrlValue(user.findMeHereProfileUrl, "No canonical FindMeHere URL")}
              <span class="accounts-details-url-note">${escapeHtml(
                user.findMeHereShareUrl
                  ? "Canonical FindMeHere share target is live."
                  : humanizeSurfaceReason(user.findMeHereStatusReason)
              )}</span>
            </div>
          </div>
        </section>
        <section class="accounts-details-group">
          <h5 class="accounts-details-group-title">Media Fields</h5>
          <div class="accounts-details-media-grid">
            <div class="accounts-details-keyline">
              <span class="accounts-details-keyline-label">Avatar</span>
              ${renderMediaReference(user.avatarUrl, user.avatarMedia, "No avatar URL")}
            </div>
            <div class="accounts-details-keyline">
              <span class="accounts-details-keyline-label">Avatar asset key</span>
              <div class="accounts-details-keyline-value accounts-system-text">${escapeHtml(
                user.avatarMedia?.assetKey || "—"
              )}</div>
            </div>
            <div class="accounts-details-keyline">
              <span class="accounts-details-keyline-label">Avatar backend / version</span>
              <div class="accounts-details-keyline-value accounts-system-text">${escapeHtml(
                user.avatarMedia
                  ? `${user.avatarMedia.storageBackend || "local"} / v${user.avatarMedia.version || "?"}`
                  : "—"
              )}</div>
            </div>
            <div class="accounts-details-keyline">
              <span class="accounts-details-keyline-label">Cover / banner image</span>
              ${renderMediaReference(user.coverImageUrl, user.coverMedia, "No cover image URL")}
            </div>
            <div class="accounts-details-keyline">
              <span class="accounts-details-keyline-label">Cover asset key</span>
              <div class="accounts-details-keyline-value accounts-system-text">${escapeHtml(
                user.coverMedia?.assetKey || "—"
              )}</div>
            </div>
            <div class="accounts-details-keyline">
              <span class="accounts-details-keyline-label">Cover backend / version</span>
              <div class="accounts-details-keyline-value accounts-system-text">${escapeHtml(
                user.coverMedia
                  ? `${user.coverMedia.storageBackend || "local"} / v${user.coverMedia.version || "?"}`
                  : "—"
              )}</div>
            </div>
            <div class="accounts-details-keyline">
              <span class="accounts-details-keyline-label">Background image URL</span>
              ${renderMediaReference(user.backgroundImageUrl, null, "No background image URL")}
            </div>
          </div>
        </section>
        <section class="accounts-details-group">
          <h5 class="accounts-details-group-title">Creator Readiness</h5>
          <div class="accounts-details-kpi-row">
            ${renderBooleanBadge(user.creatorCapable, "Creator-capable", "Not creator-capable", "ss-badge-danger")}
            ${renderBadge(user.userCode || "No user code")}
          </div>
          <div class="accounts-details-keyline">
            <span class="accounts-details-keyline-label">Integration snapshot</span>
            <div class="accounts-details-keyline-value" data-account-creator-detail="${escapeHtml(user.userCode || "")}">
              Loading creator integration posture...
            </div>
          </div>
          <div class="accounts-inline-actions">
            <button
              type="button"
              class="ss-btn ss-btn-small ss-btn-primary accounts-details-primary-cta"
              data-account-open-user-detail="${escapeHtml(user.userCode || "")}"
            >
              Open user page
            </button>
            <button
              type="button"
              class="ss-btn ss-btn-small ss-btn-secondary"
              data-account-open-integrations
              data-account-id="${escapeHtml(normalizeAccountId(user.id))}"
              data-account-user-code="${escapeHtml(user.userCode || "")}"
            >
              Open integrations
            </button>
            <button
              type="button"
              class="ss-btn ss-btn-small ss-btn-secondary"
              data-account-open-stats
              data-account-id="${escapeHtml(normalizeAccountId(user.id))}"
            >
              Stats
            </button>
          </div>
        </section>
        <section class="accounts-details-group">
          <h5 class="accounts-details-group-title">Billing &amp; Supporter</h5>
          <div class="accounts-details-kpi-row">
            ${renderBadge(paymentSummary.planName || user.tier || "Plan")}
            ${renderBadge(
              supporterState,
              paymentSummary.isSupporter ? "ss-badge-success" : "ss-badge-warning"
            )}
            ${renderBadge(
              recurringState,
              paymentSummary.hasActiveSubscription ? "ss-badge-success" : ""
            )}
          </div>
          <div class="accounts-details-meta-grid">
            <div><span class="label">Plan status</span><span class="value">${escapeHtml(
              humanizeSummaryToken(paymentSummary.planStatus, "Active")
            )}</span></div>
            <div><span class="label">Supporter source</span><span class="value">${escapeHtml(supporterState)}</span></div>
            <div><span class="label">Lifetime paid</span><span class="value">${escapeHtml(lifetimePaidLabel)}</span></div>
            <div><span class="label">Donation total</span><span class="value">${escapeHtml(donationPaidLabel)}</span></div>
            <div><span class="label">Last payment amount</span><span class="value">${escapeHtml(lastPaymentAmountLabel)}</span></div>
            <div><span class="label">Last payment date</span><span class="value">${escapeHtml(lastPaymentDateLabel)}</span></div>
            <div><span class="label">Next renewal</span><span class="value">${escapeHtml(nextDueLabel)}</span></div>
            <div><span class="label">Recurring status</span><span class="value">${escapeHtml(recurringState)}</span></div>
            <div><span class="label">Effective tier source</span><span class="value">${escapeHtml(effectiveTierSourceLabel)}</span></div>
            <div><span class="label">Grant duration</span><span class="value">${escapeHtml(adminGrantDurationLabel)}</span></div>
            <div><span class="label">Active discounts</span><span class="value">${escapeHtml(activeDiscountSummary)}</span></div>
            <div><span class="label">Credits / write-offs</span><span class="value">${escapeHtml(balanceReliefLabel)}</span></div>
          </div>
        </section>
      </div>
      <div class="accounts-details-placeholder-group">
        <div class="accounts-details-placeholder-block">
          <div class="accounts-details-placeholder-title">Admin Notes</div>
          <div class="accounts-details-placeholder-value">No admin notes yet.</div>
        </div>
        <div class="accounts-details-placeholder-block">
          <div class="accounts-details-placeholder-title">Security Flags</div>
          <div class="accounts-details-placeholder-value">No risk flags captured.</div>
        </div>
      </div>
    `;
  }

  function renderDrawerCreatorSnapshotLoading(user) {
    const container = document.querySelector(`[data-account-creator-detail="${escapeSelectorValue(user.userCode || "")}"]`);
    if (!(container instanceof HTMLElement)) return;
    container.innerHTML = '<span class="muted">Loading creator integration posture...</span>';
  }

  function renderDrawerCreatorSnapshot(user, payload) {
    const container = document.querySelector(`[data-account-creator-detail="${escapeSelectorValue(user.userCode || "")}"]`);
    if (!(container instanceof HTMLElement)) return;
    const summary = payload?.creator_integrations?.summary || {};
    const integrations = Array.isArray(payload?.creator_integrations?.integrations)
      ? payload.creator_integrations.integrations
      : [];
    const linked = integrations.filter((item) => item?.status === "linked").length;
    const deployable = integrations.filter((item) => item?.deployment?.can_deploy).length;
    container.innerHTML = `
      <div class="accounts-details-kpi-row">
        ${renderBadge(summary?.readiness_label || "Unknown", summary?.bot_deploy_eligible ? "ss-badge-success" : "ss-badge-warning")}
        ${renderBooleanBadge(summary?.foundational_trigger_ready, "Foundation ready", "Foundation missing")}
      </div>
      <div class="accounts-details-meta-grid">
        <div><span class="label">Linked platforms</span><span class="value">${escapeHtml(`${linked}/${Number(summary?.total_platform_count || integrations.length || 0)}`)}</span></div>
        <div><span class="label">Deployable</span><span class="value">${escapeHtml(String(deployable))}</span></div>
        <div><span class="label">Limited</span><span class="value">${escapeHtml(String(summary?.limited_platform_count || 0))}</span></div>
      </div>
    `;
  }

  async function hydrateDrawerCreatorDetail(user) {
    const userCode = String(user?.userCode || "").trim();
    const currentDrawerId = normalizeAccountId(state.openDrawerId);
    if (!userCode) return;
    const token = ++state.drawerDetailToken;
    renderDrawerCreatorSnapshotLoading(user);
    try {
      const response = await fetchJson(
        buildApiUrl(`/api/admin/users/${encodeURIComponent(userCode)}`),
        { timeoutMs: 6500 }
      );
      if (!response.ok) {
        const message = await readErrorMessage(response);
        throw new Error(message || `Request failed (${response.status})`);
      }
      const payload = await response.json();
      if (token !== state.drawerDetailToken || normalizeAccountId(state.openDrawerId) !== currentDrawerId) return;
      renderDrawerCreatorSnapshot(user, payload);
    } catch (_err) {
      const container = document.querySelector(`[data-account-creator-detail="${escapeSelectorValue(user.userCode || "")}"]`);
      if (container instanceof HTMLElement) {
        container.innerHTML = '<span class="muted">Unable to load creator integration posture.</span>';
      }
    }
  }

  function renderDrawerForAccount(user) {
    if (!el.detailsDrawer) return;
    const title = user.displayName || user.userCode || user.email || "Account";
    const subtitle = user.email || user.userCode || "—";
    if (el.detailsTitle) {
      el.detailsTitle.textContent = title;
    }
    if (el.detailsSubtitle) {
      el.detailsSubtitle.textContent = subtitle;
    }
    if (el.detailsProfile) {
      el.detailsProfile.innerHTML = renderDrawerProfileSummary(user);
    }
    if (el.detailsActions) {
      el.detailsActions.innerHTML = renderActions(user);
    }
    void hydrateDrawerCreatorDetail(user);
  }

  function closeOpenDrawer(options = {}) {
    const keepState = options.keepState === true;
    clearDrawerCloseTimer();
    if (el.detailsDrawer) {
      el.detailsDrawer.classList.remove("is-open");
      el.detailsDrawer.setAttribute("aria-hidden", "true");
    }
    if (el.detailsBackdrop) {
      el.detailsBackdrop.classList.remove("is-open");
      el.detailsBackdrop.setAttribute("aria-hidden", "true");
    }
    state.drawerCloseTimer = setTimeout(() => {
      if (el.detailsDrawer && !el.detailsDrawer.classList.contains("is-open")) {
        el.detailsDrawer.classList.add("hidden");
      }
      if (el.detailsBackdrop && !el.detailsBackdrop.classList.contains("is-open")) {
        el.detailsBackdrop.classList.add("hidden");
      }
      state.drawerCloseTimer = null;
    }, 220);
    if (!keepState) {
      state.openDrawerId = "";
    }
    syncSelectedRowState();
  }

  function focusProfileSection() {
    if (el.detailsContent) {
      el.detailsContent.scrollTo({ top: 0, behavior: "auto" });
    }
    el.detailsDrawer?.focus({ preventScroll: true });
  }

  function focusActionsSection() {
    if (el.detailsActionsSection) {
      el.detailsActionsSection.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    }
    el.detailsActionsHeading?.focus({ preventScroll: true });
  }

  function openDrawer(accountId, options = {}) {
    const id = normalizeAccountId(accountId);
    if (!id || !el.detailsDrawer || !el.detailsBackdrop) return;
    const user = getUserById(id);
    if (!user) {
      state.openDrawerId = "";
      closeOpenDrawer({ keepState: false });
      return;
    }

    state.openDrawerId = id;
    clearDrawerCloseTimer();
    renderDrawerForAccount(user);
    el.detailsBackdrop.classList.remove("hidden");
    el.detailsBackdrop.setAttribute("aria-hidden", "false");
    el.detailsDrawer.classList.remove("hidden");
    el.detailsDrawer.setAttribute("aria-hidden", "false");
    window.requestAnimationFrame(() => {
      el.detailsBackdrop?.classList.add("is-open");
      el.detailsDrawer?.classList.add("is-open");
    });
    syncSelectedRowState();

    if (options.focusActions) {
      window.requestAnimationFrame(() => {
        focusActionsSection();
      });
      return;
    }
    if (!options.preserveScroll) {
      focusProfileSection();
    }
  }

  function restoreOpenDrawer() {
    if (!state.openDrawerId) {
      closeOpenDrawer({ keepState: true });
      return;
    }
    openDrawer(state.openDrawerId, { preserveScroll: true });
  }

  function applyPendingAccountFocus() {
    const accountId = normalizeAccountId(state.pendingNavAccountId);
    if (!accountId) return;
    state.pendingNavAccountId = "";
    openDrawer(accountId);
    const row = getBaseRowByAccountId(accountId);
    if (!(row instanceof HTMLTableRowElement)) return;
    row.classList.add("accounts-row-jump-highlight");
    row.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    window.setTimeout(() => row.classList.remove("accounts-row-jump-highlight"), 2200);
  }

  function isBaseAccountRow(row) {
    if (!(row instanceof HTMLTableRowElement)) return false;
    const rowType = row.getAttribute("data-row-type");
    if (rowType) {
      return rowType === "account";
    }
    return true;
  }

  function getAccountIdFromBaseRow(row) {
    if (!isBaseAccountRow(row)) return "";
    const rowAccountId = row.getAttribute("data-account-id");
    if (rowAccountId) return normalizeAccountId(rowAccountId);
    const idCell = row.querySelector(".accounts-id-column[data-account-id]");
    if (!(idCell instanceof HTMLElement)) return "";
    return normalizeAccountId(idCell.getAttribute("data-account-id"));
  }

  function isInteractiveRowTarget(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        "button, a, input, select, textarea, label, [data-account-action], [data-account-open-actions], [data-account-close-details], [data-account-tier]"
      )
    );
  }

  function getEventTargetElement(event) {
    return event?.target instanceof Element ? event.target : null;
  }

  async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeoutMs = typeof options.timeoutMs === "number" ? options.timeoutMs : 2000;
    const { timeoutMs: _timeoutMs, ...requestOptions } = options;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        cache: "no-store",
        credentials: "include",
        ...requestOptions,
        signal: controller.signal
      });
      if (res.status === 401 || res.status === 403) {
        promptAdminReauth();
      }
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  
  async function loadUsers() {
    setStatus("Loading live accounts...");
    setBanner("", false);

    try {
      const res = await fetchJson(buildApiUrl(RUNTIME_ENDPOINT));
      if (res.status === 401 || res.status === 403) {
        setStatus("Admin session required. Sign in to view accounts.");
        setSource("Unauthorized");
        state.raw = [];
        state.canManage = false;
        state.sourceMode = "unauthorized";
        state.manager?.setData([]);
        updateEmptyStateMessage(0);
        setBanner("Your admin session is missing or expired. Sign in to continue.", true);
        return;
      }
      if (!res.ok) throw new Error(`Runtime error ${res.status}`);
      const payload = await res.json();
      const normalized = extractUsers(payload).map(normalizeUser);
      state.raw = normalized;
      state.canManage = true;
      state.sourceMode = "runtime";
      updateFilterOptions(normalized);
      applyFilters();
      setBanner("", false);
      setStatus("Live runtime data");
      setSource("Runtime API");
    } catch (err) {
      console.warn("[Accounts] Failed to load runtime accounts", err);
      setStatus("Runtime API unavailable. Retry or contact an admin.");
      setSource("Unavailable");
      state.raw = [];
      state.canManage = false;
      state.sourceMode = "unavailable";
      state.manager?.setData([]);
      updateEmptyStateMessage(0);
      setBanner("Runtime API unavailable. Retry or check runtime connectivity.", true, {
        retryAction: "accounts",
        tone: "warning",
        key: "accounts-runtime-unavailable",
        title: "Accounts unavailable",
        autoDismissMs: 6800
      });
    }
  }

  function setBadgeGovernanceStatus(message) {
    if (el.badgeGovernanceStatus) el.badgeGovernanceStatus.textContent = message;
  }

  function setBadgeGovernanceBanner(message, visible, options = {}) {
    if (!el.badgeGovernanceBanner) return;
    el.badgeGovernanceBanner.innerHTML = visible ? escapeHtml(message) : "";
    el.badgeGovernanceBanner.classList.toggle("hidden", !visible);
    if (visible && message) {
      window.StreamSuitesToast?.[options.tone || "info"]?.(message, {
        key: options.key || "accounts-badge-governance",
        title: options.title || "Badge Governance",
        autoDismissMs: options.autoDismissMs
      });
    } else if (!visible) {
      window.StreamSuitesToast?.dismiss?.(options.key || "accounts-badge-governance");
    }
  }

  async function loadBadgeGovernance() {
    setBadgeGovernanceStatus("Loading...");
    try {
      const res = await fetchJson(buildApiUrl(BADGE_GOVERNANCE_ENDPOINT));
      if (res.status === 401 || res.status === 403) {
        state.badgeGovernance = null;
        renderSystemBadgeGovernancePanel();
        setBadgeGovernanceStatus("Admin session required");
        return;
      }
      if (!res.ok) throw new Error(`Badge governance error ${res.status}`);
      state.badgeGovernance = await res.json();
      renderSystemBadgeGovernancePanel();
      setBadgeGovernanceStatus("Live runtime data");
      setBadgeGovernanceBanner("", false);
    } catch (err) {
      console.warn("[Accounts] Failed to load badge governance", err);
      state.badgeGovernance = null;
      renderSystemBadgeGovernancePanel();
      setBadgeGovernanceStatus("Unavailable");
      setBadgeGovernanceBanner("Badge governance data is unavailable. Retry after runtime recovery.", true, {
        tone: "warning",
        title: "Badge governance unavailable",
        autoDismissMs: 6800
      });
    }
  }

  async function saveSystemBadgeGovernance() {
    const cutoffInput = document.getElementById("accounts-founder-cutoff-date");
    const payload = {
      founder_cutoff_date: cutoffInput instanceof HTMLInputElement ? cutoffInput.value : "",
      default_visibility: {}
    };
    document.querySelectorAll("[data-system-badge-visibility]").forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      const key = input.getAttribute("data-system-badge-visibility") || "";
      if (!key) return;
      payload.default_visibility[key] = input.checked;
    });
    setBadgeGovernanceStatus("Saving...");
    const res = await fetchJson(buildApiUrl(BADGE_GOVERNANCE_ENDPOINT), {
      method: "PUT",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) {
      throw new Error((await readErrorMessage(res)) || `Save failed (${res.status})`);
    }
    state.badgeGovernance = await res.json();
    renderSystemBadgeGovernancePanel();
    setBadgeGovernanceStatus("Saved");
    setBadgeGovernanceBanner("Badge governance saved.", true, {
      tone: "success",
      title: "Saved",
      autoDismissMs: 3200
    });
  }

  async function reconcileFounderBadges() {
    setBadgeGovernanceStatus("Reconciling founder badges...");
    const res = await fetchJson(buildApiUrl(BADGE_RECONCILE_ENDPOINT), {
      method: "POST"
    });
    if (!res.ok) {
      throw new Error((await readErrorMessage(res)) || `Reconcile failed (${res.status})`);
    }
    const payload = await res.json();
    await Promise.all([loadBadgeGovernance(), loadUsers()]);
    setBadgeGovernanceStatus("Founder reconcile complete");
    setBadgeGovernanceBanner(
      `Founder reconcile applied to ${payload.updated_accounts || 0} eligible account(s).`,
      true,
      { tone: "success", title: "Founder reconcile", autoDismissMs: 4200 }
    );
  }

  function setBillingCodesStatus(message) {
    if (el.billingCodesStatus) el.billingCodesStatus.textContent = message;
  }

  function setBillingCodesBanner(message, visible, options = {}) {
    if (!el.billingCodesBanner) return;
    el.billingCodesBanner.innerHTML = visible ? escapeHtml(message) : "";
    el.billingCodesBanner.classList.toggle("hidden", !visible);
    if (visible && message) {
      window.StreamSuitesToast?.[options.tone || "info"]?.(message, {
        key: options.key || "accounts-billing-codes",
        title: options.title || "Billing Codes",
        autoDismissMs: options.autoDismissMs
      });
    } else if (!visible) {
      window.StreamSuitesToast?.dismiss?.(options.key || "accounts-billing-codes");
    }
  }

  function renderBillingCodesPanel() {
    if (!el.billingCodesPanel) return;
    const rows = Array.isArray(state.billingDiscountCodes)
      ? state.billingDiscountCodes.filter((item) => coerceText(item.scope).toLowerCase() === "global")
      : [];
    const listMarkup = rows.length
      ? rows
          .map((item) => `
            <div class="accounts-details-placeholder-block">
              <div class="accounts-details-placeholder-title">${escapeHtml(item.code || "Code")}</div>
              <div class="accounts-details-placeholder-value">
                ${escapeHtml(`${formatDiscountValue(item.discount_type || item.discountType, item.discount_value || item.discountValue, item.currency)} · ${humanizeSummaryToken(item.status || item.state, "Active")}`)}
                <br />
                ${escapeHtml(`${humanizeSummaryToken(item.scope, "Global")} · ${item.reason || "No reason recorded"}`)}
              </div>
              ${String(item.status || item.state).toLowerCase() === "active" ? `<button type="button" class="ss-btn ss-btn-small ss-btn-secondary" data-billing-code-revoke="${escapeHtml(item.id)}">Revoke</button>` : ""}
            </div>
          `)
          .join("")
      : '<div class="accounts-details-placeholder-block"><div class="accounts-details-placeholder-title">No global discount codes</div><div class="accounts-details-placeholder-value">Create the first authoritative runtime discount code here.</div></div>';
    el.billingCodesPanel.innerHTML = `
      <div class="accounts-details-group-grid">
        <section class="accounts-details-group">
          <h5 class="accounts-details-group-title">Create Global Discount Code</h5>
          <div style="display:grid;gap:10px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <input id="accounts-billing-code" class="ss-input" type="text" placeholder="Code" />
              <input id="accounts-billing-label" class="ss-input" type="text" placeholder="Label (optional)" />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <select id="accounts-billing-discount-type" class="ss-input">
                <option value="percent">Percent</option>
                <option value="amount">Amount</option>
              </select>
              <input id="accounts-billing-discount-value" class="ss-input" type="number" min="1" value="10" />
            </div>
            <textarea id="accounts-billing-reason" class="ss-input" rows="3" placeholder="Reason required"></textarea>
            <button id="accounts-billing-code-save" class="ss-btn ss-btn-primary" type="button">Create Global Code</button>
          </div>
        </section>
        <section class="accounts-details-group">
          <h5 class="accounts-details-group-title">Current Global Codes</h5>
          <div class="accounts-details-placeholder-group">${listMarkup}</div>
        </section>
      </div>
    `;
  }

  async function loadBillingCodes() {
    setBillingCodesStatus("Loading...");
    try {
      const res = await fetchJson(buildApiUrl(BILLING_DISCOUNT_CODES_ENDPOINT));
      if (res.status === 401 || res.status === 403) {
        state.billingDiscountCodes = [];
        renderBillingCodesPanel();
        setBillingCodesStatus("Admin session required");
        return;
      }
      if (!res.ok) throw new Error(`Billing code load failed (${res.status})`);
      const payload = await res.json();
      state.billingDiscountCodes = Array.isArray(payload.items) ? payload.items : [];
      renderBillingCodesPanel();
      setBillingCodesStatus("Live runtime data");
      setBillingCodesBanner("", false);
    } catch (err) {
      console.warn("[Accounts] Failed to load billing codes", err);
      state.billingDiscountCodes = [];
      renderBillingCodesPanel();
      setBillingCodesStatus("Unavailable");
      setBillingCodesBanner("Billing discount code data is unavailable. Retry after runtime recovery.", true, {
        tone: "warning",
        title: "Billing codes unavailable",
        autoDismissMs: 6800
      });
    }
  }

  async function createGlobalBillingCode() {
    const codeInput = document.getElementById("accounts-billing-code");
    const labelInput = document.getElementById("accounts-billing-label");
    const discountTypeInput = document.getElementById("accounts-billing-discount-type");
    const discountValueInput = document.getElementById("accounts-billing-discount-value");
    const reasonInput = document.getElementById("accounts-billing-reason");
    const payload = {
      code: codeInput instanceof HTMLInputElement ? codeInput.value.trim().toUpperCase() : "",
      label: labelInput instanceof HTMLInputElement ? labelInput.value.trim() : "",
      discount_type: discountTypeInput instanceof HTMLSelectElement ? discountTypeInput.value : "percent",
      discount_value: discountValueInput instanceof HTMLInputElement ? Number(discountValueInput.value || 0) : 0,
      reason: reasonInput instanceof HTMLTextAreaElement ? reasonInput.value.trim() : "",
      scope: "global"
    };
    setBillingCodesStatus("Saving...");
    const res = await fetchJson(buildApiUrl(BILLING_DISCOUNT_CODES_ENDPOINT), {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) {
      throw new Error((await readErrorMessage(res)) || `Billing code save failed (${res.status})`);
    }
    const responsePayload = await res.json();
    state.billingDiscountCodes = Array.isArray(responsePayload.items) ? responsePayload.items : state.billingDiscountCodes;
    renderBillingCodesPanel();
    setBillingCodesStatus("Saved");
    setBillingCodesBanner("Global billing discount code saved.", true, {
      tone: "success",
      title: "Saved",
      autoDismissMs: 3200
    });
  }

  async function revokeGlobalBillingCode(codeId) {
    const reason = window.prompt("Reason for revoking this billing discount code:");
    if (!reason) return;
    const res = await fetchJson(buildApiUrl(`${BILLING_DISCOUNT_CODES_ENDPOINT}/revoke`), {
      method: "POST",
      body: JSON.stringify({ code_id: codeId, reason: reason.trim() }),
      headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) {
      throw new Error((await readErrorMessage(res)) || `Billing code revoke failed (${res.status})`);
    }
    const payload = await res.json();
    state.billingDiscountCodes = Array.isArray(payload.items) ? payload.items : state.billingDiscountCodes;
    renderBillingCodesPanel();
    setBillingCodesStatus("Updated");
    setBillingCodesBanner("Billing discount code revoked.", true, {
      tone: "success",
      title: "Updated",
      autoDismissMs: 3200
    });
  }

  function getActionPrompt(action, user) {
    const name = user.displayName || user.email || user.userCode || "this account";
    if (action === "suspend") {
      return `Suspend ${name}?`;
    }
    if (action === "unsuspend") {
      return `Unsuspend ${name}?`;
    }
    if (action === "reset-onboarding") {
      return `Reset onboarding for ${name}? This forces the user to complete onboarding again.`;
    }
    if (action === "force-email-reverify") {
      return `Force email re-verification for ${name}? This logs them out and sends a verification email.`;
    }
    if (action === "mark-email-verified") {
      return `Mark ${name} as email verified?`;
    }
    if (action === "delete") {
      return `Delete ${name}? This is a destructive action and will soft-delete the account.`;
    }
    if (action === "admin-email-change") {
      return `Change email for ${name}?`;
    }
    if (action === "admin-auth-unlink") {
      return `Unlink a sign-in method for ${name}?`;
    }
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
      "delete"
    ].includes(action);
  }

  function updateUserAfterAction(userId, action, payload) {
    const index = state.raw.findIndex((item) => item.id === userId);
    if (index === -1) return;
    const current = state.raw[index];
    if (payload?.account && typeof payload.account === "object") {
      state.raw[index] = normalizeUser(payload.account);
      return;
    }
    const next = { ...current };

    if (action === "suspend") {
      next.accountStatus = payload?.account_status || "suspended";
    } else if (action === "unsuspend") {
      next.accountStatus = payload?.account_status || "active";
    } else if (action === "delete") {
      next.accountStatus = payload?.account_status || "deleted";
    } else if (action === "reset-onboarding") {
      next.onboardingStatus = payload?.onboarding_status || "required";
    } else if (action === "force-email-reverify") {
      next.emailVerified = false;
      next.emailVerifiedLabel = resolveEmailVerifiedLabel(false);
    } else if (action === "mark-email-verified") {
      next.emailVerified = true;
      next.emailVerifiedLabel = resolveEmailVerifiedLabel(true);
    } else if (action === "tier") {
      next.tier = normalizeTierLabel(payload?.tier || next.tier);
    }

    state.raw[index] = next;
  }

  function setRowActionLoading(row, activeButton, isLoading) {
    if (!row) return;
    const buttons = row.querySelectorAll("[data-account-action], [data-account-billing-submit], [data-account-billing-revoke]");
    const tierSelect = row.querySelector("[data-account-tier]");
    buttons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      if (isLoading) {
        button.dataset.originalDisabled = button.disabled ? "true" : "false";
        button.disabled = true;
        if (button === activeButton) {
          button.dataset.originalLabel = button.textContent || "";
          button.textContent = "Working...";
        }
      } else {
        if (button.dataset.originalDisabled === undefined) {
          return;
        }
        const wasDisabled = button.dataset.originalDisabled === "true";
        button.disabled = wasDisabled;
        delete button.dataset.originalDisabled;
        if (button.dataset.originalLabel !== undefined) {
          button.textContent = button.dataset.originalLabel;
          delete button.dataset.originalLabel;
        }
      }
    });
    if (tierSelect instanceof HTMLSelectElement) {
      if (isLoading) {
        tierSelect.dataset.originalDisabled = tierSelect.disabled ? "true" : "false";
        tierSelect.disabled = true;
      } else {
        if (tierSelect.dataset.originalDisabled === undefined) {
          return;
        }
        tierSelect.disabled = tierSelect.dataset.originalDisabled === "true";
        delete tierSelect.dataset.originalDisabled;
      }
    }
  }

  async function saveAccountBadgeGovernance(user, scope, button) {
    if (!user) return;
    const accountId = normalizeAccountId(user.id);
    const entitlements = {};
    const visibility_overrides = {};
    document.querySelectorAll(`[data-account-badge-entitlement][data-account-id="${escapeSelectorValue(accountId)}"]`).forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      const key = input.getAttribute("data-account-badge-entitlement") || "";
      if (!key) return;
      entitlements[key] = input.checked;
    });
    document.querySelectorAll(`[data-account-badge-visibility][data-account-id="${escapeSelectorValue(accountId)}"]`).forEach((select) => {
      const key = select.getAttribute("data-account-badge-visibility") || "";
      const value = select instanceof HTMLSelectElement ? select.value : "default";
      if (!key) return;
      visibility_overrides[key] = value === "default" ? null : value === "show";
    });

    setStatus("Saving badge governance...");
    setRowActionLoading(scope, button, true);
    try {
      const res = await fetchJson(buildApiUrl(`/admin/accounts/${encodeURIComponent(accountId)}/badges`), {
        method: "PATCH",
        body: JSON.stringify({ entitlements, visibility_overrides }),
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        throw new Error((await readErrorMessage(res)) || `Badge save failed (${res.status})`);
      }
      await Promise.all([loadUsers(), loadBadgeGovernance()]);
      setStatus("Badge governance saved.");
    } finally {
      setRowActionLoading(scope, button, false);
    }
  }

  
  async function handleAccountAction(user, action, row, button) {
    if (!user || !action) return;
    if (!state.canManage) return;

    if (shouldConfirmAction(action)) {
      const message = getActionPrompt(action, user);
      if (message && !window.confirm(message)) return;
    }

    const base = "/admin/accounts";
    let endpoint =
      action === "delete"
        ? `${base}/${encodeURIComponent(user.id)}`
        : `${base}/${encodeURIComponent(user.id)}/${action}`;
    const forceApiBase = null;
    try {
      let method = "POST";
      let body = null;
      if (action === "admin-email-change") {
        const nextEmail = window.prompt("New email address:", user.email && user.email !== "—" ? user.email : "");
        if (!nextEmail) return;
        const normalizedEmail = String(nextEmail).trim().toLowerCase();
        if (!normalizedEmail.includes("@")) {
          setInlineError("Enter a valid email address.", {
            tone: "error",
            key: "accounts-email-validation",
            title: "Validation"
          });
          return;
        }
        const forceNow = window.confirm(
          "Force change + mark verified now?\nSelect Cancel to require email verification by link."
        );
        endpoint = `/api/admin/accounts/${encodeURIComponent(user.id)}/email/change`;
        method = "POST";
        body = JSON.stringify({
          new_email: normalizedEmail,
          require_verification: !forceNow,
          force_verified: forceNow
        });
      } else if (action === "admin-auth-unlink") {
        const currentProviders = Array.isArray(user.providers) ? user.providers : [];
        const providerOptions = currentProviders.map((provider) => provider.label).filter(Boolean);
        if (!providerOptions.length) {
          setInlineError("No linked providers to unlink.", {
            tone: "warning",
            key: "accounts-unlink-none",
            title: "Nothing to unlink"
          });
          return;
        }
        const provider = window.prompt(
          `Provider to unlink (${providerOptions.join(", ")}):`,
          providerOptions[0] || ""
        );
        if (!provider) return;
        const override = window.confirm("Allow override if this is the last sign-in method?");
        endpoint = `/api/admin/accounts/${encodeURIComponent(user.id)}/auth-methods/unlink`;
        method = "POST";
        body = JSON.stringify({
          provider: String(provider).trim().toLowerCase(),
          override_last_method: override
        });
      }
      if (action === "delete") {
        method = "DELETE";
      } else if (action === "tier") {
        const tierSelect = row?.querySelector("[data-account-tier]");
        const selectedTier = tierSelect?.value || "";
        if (!selectedTier) {
          setStatus("Select a tier before updating.");
          return;
        }
        method = "PATCH";
        body = JSON.stringify({ tier: selectedTier });
      }
      setStatus(`Applying ${action.replace("-", " ")}...`);
      setBanner("", false);
      setRowActionLoading(row, button, true);
      const res = await fetchJson(buildApiUrl(endpoint, forceApiBase), {
        method,
        body,
        headers: body ? { "Content-Type": "application/json" } : undefined
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setInlineError("Admin session expired. Sign in again to continue.", {
            tone: "error",
            key: "accounts-action-session",
            title: "Session expired",
            autoDismissMs: 6800
          });
          return;
        }
        const message = await readErrorMessage(res);
        console.warn("[Accounts] Action failed", action, message || res.status);
        const detail = message ? ` (${message})` : "";
        setInlineError(`Action failed${detail}. Retry or refresh your admin session.`, {
          tone: "error",
          key: "accounts-action-failed",
          title: "Action failed",
          autoDismissMs: 6800
        });
        return;
      }
      let payload = null;
      try {
        payload = await res.json();
      } catch (err) {
        payload = null;
      }
      updateUserAfterAction(user.id, action, payload);
      applyFilters();
      setStatus("Action complete. Refreshing...");
      await loadUsers();
    } catch (err) {
      console.warn("[Accounts] Action error", action, err);
      setInlineError("Action failed. Retry or contact an admin if it persists.", {
        tone: "error",
        key: "accounts-action-error",
        title: "Action failed",
        autoDismissMs: 6800
      });
    } finally {
      setRowActionLoading(row, button, false);
    }
  }

  async function submitAccountBillingIntervention(user, scope, button) {
    if (!user || !button) return;
    const accountId = normalizeAccountId(user.id);
    const form = button.closest("[data-billing-form-kind]");
    if (!(form instanceof HTMLElement)) return;
    const formKind = form.getAttribute("data-billing-form-kind") || button.getAttribute("data-account-billing-submit") || "";
    const reasonInput = form.querySelector("[data-billing-reason]");
    const reason = reasonInput instanceof HTMLTextAreaElement ? reasonInput.value.trim() : "";
    if (!reason) {
      throw new Error("A reason is required for billing interventions.");
    }
    let payload = { kind: formKind, reason };
    if (formKind === "gifted_tier") {
      const tierInput = form.querySelector("[data-billing-tier]");
      const durationUnitInput = form.querySelector("[data-billing-duration-unit]");
      const durationValueInput = form.querySelector("[data-billing-duration-value]");
      payload = {
        ...payload,
        kind: "gifted_tier",
        tier: tierInput instanceof HTMLSelectElement ? tierInput.value : "GOLD",
        duration_unit: durationUnitInput instanceof HTMLSelectElement ? durationUnitInput.value : "days",
        duration_value: durationValueInput instanceof HTMLInputElement ? Number(durationValueInput.value || 0) : 0,
      };
      if (payload.duration_unit === "lifetime") {
        delete payload.duration_value;
      }
    } else if (formKind === "discount") {
      const typeInput = form.querySelector("[data-billing-discount-type]");
      const valueInput = form.querySelector("[data-billing-discount-value]");
      payload = {
        ...payload,
        kind: "discount",
        discount_type: typeInput instanceof HTMLSelectElement ? typeInput.value : "percent",
        discount_value: valueInput instanceof HTMLInputElement ? Number(valueInput.value || 0) : 0,
      };
    } else if (formKind === "discount_code_assignment") {
      const codeInput = form.querySelector("[data-billing-code]");
      const labelInput = form.querySelector("[data-billing-label]");
      const typeInput = form.querySelector("[data-billing-discount-type]");
      const valueInput = form.querySelector("[data-billing-discount-value]");
      payload = {
        ...payload,
        kind: "discount_code_assignment",
        code: codeInput instanceof HTMLInputElement ? codeInput.value.trim().toUpperCase() : "",
        label: labelInput instanceof HTMLInputElement ? labelInput.value.trim() : "",
        discount_type: typeInput instanceof HTMLSelectElement ? typeInput.value : "percent",
        discount_value: valueInput instanceof HTMLInputElement ? Number(valueInput.value || 0) : 0,
      };
    } else {
      const ledgerKindInput = form.querySelector("[data-billing-ledger-kind]");
      const amountInput = form.querySelector("[data-billing-amount]");
      payload = {
        ...payload,
        kind: ledgerKindInput instanceof HTMLSelectElement ? ledgerKindInput.value : "credit",
        amount: amountInput instanceof HTMLInputElement ? Number(amountInput.value || 0) : 0,
      };
    }
    setStatus("Saving billing intervention...");
    setRowActionLoading(scope, button, true);
    try {
      const res = await fetchJson(buildApiUrl(`/api/admin/accounts/${encodeURIComponent(accountId)}/billing-interventions`), {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        throw new Error((await readErrorMessage(res)) || `Billing intervention failed (${res.status})`);
      }
      await Promise.all([loadUsers(), loadBillingCodes()]);
      setStatus("Billing intervention saved.");
    } finally {
      setRowActionLoading(scope, button, false);
    }
  }

  async function revokeAccountBillingIntervention(user, interventionId, button) {
    if (!user || !interventionId) return;
    const reason = window.prompt("Reason for revoking this billing intervention:");
    if (!reason) return;
    setStatus("Revoking billing intervention...");
    setRowActionLoading(el.detailsActions || el.detailsDrawer, button, true);
    try {
      const res = await fetchJson(
        buildApiUrl(`/api/admin/accounts/${encodeURIComponent(normalizeAccountId(user.id))}/billing-interventions/revoke`),
        {
          method: "POST",
          body: JSON.stringify({ intervention_id: interventionId, reason: reason.trim() }),
          headers: { "Content-Type": "application/json" }
        }
      );
      if (!res.ok) {
        throw new Error((await readErrorMessage(res)) || `Billing revoke failed (${res.status})`);
      }
      await Promise.all([loadUsers(), loadBillingCodes()]);
      setStatus("Billing intervention revoked.");
    } finally {
      setRowActionLoading(el.detailsActions || el.detailsDrawer, button, false);
    }
  }

  function parseFilename(headers, fallback) {
    const disposition = headers.get("content-disposition") || "";
    const match = disposition.match(/filename\*?=\"?([^\";]+)\"?/i);
    if (match && match[1]) return match[1];
    return fallback;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  
  async function triggerExport(format) {
    if (!el.exportStatus) return;
    const endpoint = `/admin/accounts/export.${format}`;
    setExportStatus("Exporting...");
    setExportButtonsLoading(true);

    try {
      const res = await fetch(buildApiUrl(endpoint), {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json, text/csv, application/octet-stream"
        }
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setExportStatus("Admin session required to export.");
          return;
        }
        throw new Error(`Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const filename = parseFilename(res.headers, `users.${format}`);
      downloadBlob(blob, filename);
      setExportStatus("Export ready");
    } catch (err) {
      console.warn("[Accounts] Export failed", err);
      setExportStatus("Export failed. Retry or contact an admin.");
    } finally {
      setExportButtonsLoading(false);
    }
  }

  function bindEvents() {
    el.typeFilter?.addEventListener("change", applyFilters);
    el.roleFilter?.addEventListener("change", applyFilters);
    el.tierFilter?.addEventListener("change", applyFilters);
    el.providerFilter?.addEventListener("change", applyFilters);
    el.pageSize?.addEventListener("change", (event) => {
      const nextValue = Number(event.target?.value);
      const safeValue = Number.isFinite(nextValue)
        ? Math.min(100, Math.max(5, Math.trunc(nextValue)))
        : 10;
      syncAccountsPageSizeControl(safeValue);
      state.manager?.setPageSize(safeValue, { resetPage: true });
    });
    el.search?.addEventListener("input", () => {
      const filtered = getFilteredData();
      updateEmptyStateMessage(getSearchFilteredCount(filtered));
    });
    el.idToggle?.addEventListener("change", (event) => {
      toggleIdColumn(event.target.checked);
    });
    el.exportJson?.addEventListener("click", () => triggerExport("json"));
    el.exportCsv?.addEventListener("click", () => triggerExport("csv"));
    el.badgeGovernancePanel?.addEventListener("click", (event) => {
      const target = getEventTargetElement(event);
      if (!target) return;
      if (target.id === "accounts-badge-governance-save") {
        event.preventDefault();
        void saveSystemBadgeGovernance().catch((err) => {
          console.warn("[Accounts] Badge governance save failed", err);
          setBadgeGovernanceBanner(err?.message || "Failed to save badge governance.", true, {
            tone: "error",
            title: "Save failed",
            autoDismissMs: 6800
          });
          setBadgeGovernanceStatus("Save failed");
        });
        return;
      }
      if (target.id === "accounts-founder-reconcile") {
        event.preventDefault();
        if (!window.confirm("Apply founder entitlement to existing eligible accounts that do not already have an explicit founder decision?")) {
          return;
        }
        void reconcileFounderBadges().catch((err) => {
          console.warn("[Accounts] Founder reconcile failed", err);
          setBadgeGovernanceBanner(err?.message || "Founder reconcile failed.", true, {
            tone: "error",
            title: "Founder reconcile failed",
            autoDismissMs: 6800
          });
          setBadgeGovernanceStatus("Reconcile failed");
        });
      }
    });
    el.billingCodesPanel?.addEventListener("click", (event) => {
      const target = getEventTargetElement(event);
      if (!target) return;
      if (target.id === "accounts-billing-code-save") {
        event.preventDefault();
        void createGlobalBillingCode().catch((err) => {
          console.warn("[Accounts] Billing code save failed", err);
          setBillingCodesBanner(err?.message || "Failed to save billing discount code.", true, {
            tone: "error",
            title: "Billing code save failed",
            autoDismissMs: 6800
          });
          setBillingCodesStatus("Save failed");
        });
        return;
      }
      const revokeButton = target.closest("[data-billing-code-revoke]");
      if (revokeButton) {
        event.preventDefault();
        const codeId = revokeButton.getAttribute("data-billing-code-revoke") || "";
        void revokeGlobalBillingCode(codeId).catch((err) => {
          console.warn("[Accounts] Billing code revoke failed", err);
          setBillingCodesBanner(err?.message || "Failed to revoke billing discount code.", true, {
            tone: "error",
            title: "Billing code revoke failed",
            autoDismissMs: 6800
          });
          setBillingCodesStatus("Update failed");
        });
      }
    });
    el.banner?.addEventListener("click", (event) => {
      const retryButton = event.target.closest("[data-accounts-retry]");
      if (!retryButton) return;
      const action = retryButton.getAttribute("data-accounts-retry");
      if (action === "accounts") {
        void loadUsers();
      }
    });

    if (!state.escapeBound) {
      state.escapeBound = true;
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (state.openDrawerId) {
          closeOpenDrawer();
        }
      });
    }

    el.body?.addEventListener("dblclick", (event) => {
      const target = getEventTargetElement(event);
      if (!target) return;
      if (isInteractiveRowTarget(target)) return;
      const row = target.closest("tr");
      if (!isBaseAccountRow(row)) return;
      const accountId = getAccountIdFromBaseRow(row);
      if (!accountId) return;
      clearRowClickTimer();
      openDrawer(accountId, { focusActions: true });
    });

    el.body?.addEventListener("click", (event) => {
      const target = getEventTargetElement(event);
      if (!target) return;
      const drawerToggle = target.closest("[data-account-open-actions]");
      if (drawerToggle) {
        event.preventDefault();
        clearRowClickTimer();
        const accountId = normalizeAccountId(drawerToggle.getAttribute("data-account-id"));
        openDrawer(accountId, { focusActions: true });
        return;
      }
      const creatorLink = target.closest("[data-account-open-creator]");
      if (creatorLink) {
        event.preventDefault();
        clearRowClickTimer();
        const userCode = creatorLink.getAttribute("data-account-open-creator") || "";
        openCreatorIdentity(userCode);
        return;
      }
      const statsButton = target.closest("[data-account-open-stats]");
      if (statsButton) {
        event.preventDefault();
        clearRowClickTimer();
        const accountId = normalizeAccountId(statsButton.getAttribute("data-account-id"));
        openCreatorStats(accountId);
        return;
      }
      const userDetailButton = target.closest("[data-account-open-user-detail]");
      if (userDetailButton) {
        event.preventDefault();
        clearRowClickTimer();
        const userCode = userDetailButton.getAttribute("data-account-open-user-detail") || "";
        openUserDetail(userCode);
        return;
      }
      const integrationsButton = target.closest("[data-account-open-integrations]");
      if (integrationsButton) {
        event.preventDefault();
        clearRowClickTimer();
        const accountId = normalizeAccountId(integrationsButton.getAttribute("data-account-id"));
        const userCode = integrationsButton.getAttribute("data-account-user-code") || "";
        openCreatorIntegrations(accountId, userCode);
        return;
      }
      if (isInteractiveRowTarget(target)) return;
      const row = target.closest("tr");
      if (!isBaseAccountRow(row)) return;
      const accountId = getAccountIdFromBaseRow(row);
      if (!accountId) return;
      clearRowClickTimer();
      state.rowClickTimer = setTimeout(() => {
        state.rowClickTimer = null;
        openDrawer(accountId);
      }, ROW_CLICK_DELAY_MS);
    });

    el.detailsBackdrop?.addEventListener("click", () => {
      clearRowClickTimer();
      closeOpenDrawer();
    });

    el.detailsClose?.addEventListener("click", (event) => {
      event.preventDefault();
      clearRowClickTimer();
      closeOpenDrawer();
    });

    el.detailsDrawer?.addEventListener("click", (event) => {
      const target = getEventTargetElement(event);
      if (!target) return;
      const closeButton = target.closest("[data-account-close-details]");
      if (closeButton) {
        event.preventDefault();
        closeOpenDrawer();
        return;
      }

      const userDetailButton = target.closest("[data-account-open-user-detail]");
      if (userDetailButton) {
        event.preventDefault();
        const userCode = userDetailButton.getAttribute("data-account-open-user-detail") || "";
        openUserDetail(userCode);
        return;
      }

      const integrationsButton = target.closest("[data-account-open-integrations]");
      if (integrationsButton) {
        event.preventDefault();
        const accountId = normalizeAccountId(integrationsButton.getAttribute("data-account-id"));
        const userCode = integrationsButton.getAttribute("data-account-user-code") || "";
        openCreatorIntegrations(accountId, userCode);
        return;
      }

      const statsButton = target.closest("[data-account-open-stats]");
      if (statsButton) {
        event.preventDefault();
        const accountId = normalizeAccountId(statsButton.getAttribute("data-account-id"));
        openCreatorStats(accountId);
        return;
      }

      const button = target.closest("[data-account-action]");
      const billingSubmit = target.closest("[data-account-billing-submit]");
      if (billingSubmit) {
        event.preventDefault();
        const accountId = normalizeAccountId(billingSubmit.getAttribute("data-account-id"));
        const user = getUserById(accountId);
        if (!user) return;
        void submitAccountBillingIntervention(user, el.detailsActions || el.detailsDrawer, billingSubmit).catch((err) => {
          console.warn("[Accounts] Billing intervention save failed", err);
          setInlineError(err?.message || "Failed to save billing intervention.", {
            tone: "error",
            key: "accounts-billing-save-failed",
            title: "Billing save failed",
            autoDismissMs: 6800
          });
        });
        return;
      }
      const billingRevoke = target.closest("[data-account-billing-revoke]");
      if (billingRevoke) {
        event.preventDefault();
        const accountId = normalizeAccountId(billingRevoke.getAttribute("data-account-id"));
        const user = getUserById(accountId);
        if (!user) return;
        const interventionId = billingRevoke.getAttribute("data-account-billing-revoke") || "";
        void revokeAccountBillingIntervention(user, interventionId, billingRevoke).catch((err) => {
          console.warn("[Accounts] Billing intervention revoke failed", err);
          setInlineError(err?.message || "Failed to revoke billing intervention.", {
            tone: "error",
            key: "accounts-billing-revoke-failed",
            title: "Billing revoke failed",
            autoDismissMs: 6800
          });
        });
        return;
      }
      const badgeSave = target.closest("[data-account-badge-governance-save]");
      if (badgeSave) {
        event.preventDefault();
        const accountId = normalizeAccountId(badgeSave.getAttribute("data-account-id"));
        const user = getUserById(accountId);
        if (!user) return;
        void saveAccountBadgeGovernance(user, el.detailsActions || el.detailsDrawer, badgeSave).catch((err) => {
          console.warn("[Accounts] Account badge governance save failed", err);
          setInlineError(err?.message || "Failed to save account badge governance.", {
            tone: "error",
            key: "accounts-badge-save-failed",
            title: "Badge save failed",
            autoDismissMs: 6800
          });
        });
        return;
      }
      if (!button) return;
      if (button.disabled) return;
      const action = button.getAttribute("data-account-action") || "";
      const accountId = normalizeAccountId(button.getAttribute("data-account-id"));
      const user = getUserById(accountId);
      if (!user || !action) return;
      const scope = el.detailsActions || el.detailsDrawer;
      void handleAccountAction(user, action, scope, button);
    });
  }

  function markRenderedAccountRows(renderedItems = []) {
    if (!el.body) return;
    const rows = Array.from(el.body.querySelectorAll("tr"));
    rows.forEach((row, index) => {
      if (!(row instanceof HTMLTableRowElement)) return;
      const item = renderedItems[index];
      const accountId = normalizeAccountId(item?.id) || getAccountIdFromBaseRow(row);
      row.setAttribute("data-row-type", "account");
      if (accountId) {
        row.setAttribute("data-account-id", accountId);
      }
    });
    syncSelectedRowState();
  }

  function handleTableRender(renderedItems = []) {
    markRenderedAccountRows(renderedItems);
    restoreOpenDrawer();
    applyPendingAccountFocus();
    toggleIdColumn(el.idToggle?.checked !== false);
    if (!state.columnResizeHydrated && renderedItems.length > 0) {
      state.columnResizeHydrated = true;
      state.columnResize?.refresh?.();
    }
  }

  function initColumnResize() {
    if (!el.table || !window.TableResize?.initResizableTable) return;
    state.columnResize = window.TableResize.initResizableTable({
      table: el.table,
      storageKey: COLUMN_WIDTH_STORAGE_KEY,
      minWidth: 0,
      maxWidth: 980,
      skipLastHandle: false,
      excludedColumnKeys: ["actions"],
      defaultColumnWidths: {
        actions: 208
      }
    });
  }

  function initTable() {
    if (!window.SearchPagination) return;
    state.manager = window.SearchPagination.createTableManager({
      data: [],
      searchFields: SEARCH_FIELDS,
      defaultSortField: "createdAt",
      defaultSortDirection: "desc",
      pageSize: Number(el.pageSize?.value) || 10,
      table: el.table,
      tableBody: el.body,
      emptyState: el.empty,
      countLabel: el.count,
      paginationContainer: el.pagination,
      searchInput: el.search,
      renderRow,
      onRender: handleTableRender
    });
    syncAccountsPageSizeControl(state.manager.getState?.().pageSize || 10);
  }

  async function init() {
    el.banner = $("accounts-snapshot-banner");
    el.status = $("accounts-status");
    el.source = $("accounts-source");
    el.count = $("accounts-count");
    el.body = $("accounts-body");
    el.table = $("accounts-table");
    el.tableScroll = $("accounts-table-scroll");
    el.appMain = $("app-main");
    el.pagination = $("accounts-pagination");
    el.empty = $("accounts-empty");
    el.search = $("accounts-search");
    el.pageSize = $("accounts-page-size");
    el.typeFilter = $("accounts-type-filter");
    el.roleFilter = $("accounts-role-filter");
    el.tierFilter = $("accounts-tier-filter");
    el.providerFilter = $("accounts-provider-filter");
    el.idToggle = $("accounts-id-toggle");
    el.exportJson = $("accounts-export-json");
    el.exportCsv = $("accounts-export-csv");
    el.exportStatus = $("accounts-export-status");
    el.badgeGovernanceBanner = $("accounts-badge-governance-banner");
    el.badgeGovernanceStatus = $("accounts-badge-governance-status");
    el.badgeGovernancePanel = $("accounts-badge-governance-panel");
    el.billingCodesBanner = $("accounts-billing-codes-banner");
    el.billingCodesStatus = $("accounts-billing-codes-status");
    el.billingCodesPanel = $("accounts-billing-codes-panel");
    el.detailsBackdrop = $("accounts-details-backdrop");
    el.detailsDrawer = $("accounts-details-drawer");
    el.detailsContent = $("accounts-details-content");
    el.detailsClose = $("accounts-details-close");
    el.detailsTitle = $("accounts-details-title");
    el.detailsSubtitle = $("accounts-details-subtitle");
    el.detailsProfile = $("accounts-details-profile");
    el.detailsActions = $("accounts-details-actions");
    el.detailsProfileSection = $("accounts-details-profile-section");
    el.detailsActionsSection = $("accounts-details-actions-section");
    el.detailsActionsHeading = $("accounts-details-actions-heading");
    state.openDrawerId = "";
    state.pendingNavAccountId = consumePendingAccountFocus();
    state.columnResizeHydrated = false;
    clearRowClickTimer();
    closeOpenDrawer({ keepState: true });

    initTable();
    if (state.columnResize?.destroy) {
      state.columnResize.destroy();
    }
    state.columnResize = null;
    initColumnResize();
    bindEvents();
    toggleIdColumn(true);
    if (window.StreamSuitesGlobalLoader?.trackAsync) {
      await window.StreamSuitesGlobalLoader.trackAsync(
        () => Promise.all([loadAdminIdentity(), loadUsers(), loadBadgeGovernance(), loadBillingCodes()]),
        "Hydrating accounts..."
      );
      return;
    }

    await Promise.all([loadAdminIdentity(), loadUsers(), loadBadgeGovernance(), loadBillingCodes()]);
  }

  window.AccountsView = {
    init
  };
})();

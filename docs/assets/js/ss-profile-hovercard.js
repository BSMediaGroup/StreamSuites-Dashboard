(() => {
  const TRIGGER_SELECTOR = '[data-ss-profile-hover-trigger="true"]';
  const OPTOUT_SELECTOR = '[data-ss-profile-hover="off"], .ss-no-profile-hover';
  const PROFILE_ENDPOINT = "https://api.streamsuites.app/api/public/profile";
  const HIDE_DELAY_MS = 120;
  const OFFSET = 10;
  const VIEWPORT_GAP = 12;
  const ROLE_ICON_MAP = Object.freeze({
    admin: "/assets/icons/tierbadge-admin.svg"
  });
  const TIER_ICON_MAP = Object.freeze({
    core: "/assets/icons/tierbadge-core.svg",
    gold: "/assets/icons/tierbadge-gold.svg",
    pro: "/assets/icons/tierbadge-pro.svg"
  });
  const SOCIAL_ICON_MAP = Object.freeze({
    youtube: "/assets/icons/youtube.svg",
    rumble: "/assets/icons/rumble.svg",
    discord: "/assets/icons/discord.svg",
    x: "/assets/icons/x.svg",
    twitter: "/assets/icons/twitter.svg",
    twitch: "/assets/icons/twitch.svg",
    kick: "/assets/icons/kick.svg",
    tiktok: "/assets/icons/ui/widget.svg",
    github: "/assets/icons/github.svg",
    website: "/assets/icons/ui/globe.svg",
    instagram: "/assets/icons/ui/widget.svg"
  });
  const SOCIAL_ORDER = Object.freeze([
    "x",
    "twitter",
    "youtube",
    "rumble",
    "twitch",
    "kick",
    "discord",
    "instagram",
    "tiktok",
    "github",
    "website"
  ]);

  let card = null;
  let activeTrigger = null;
  let hideTimer = 0;
  let fetchController = null;
  let activeFetchToken = 0;
  let cardHovered = false;

  const profileCache = new Map();

  function safeText(value, fallback = "") {
    const text = String(value || "").trim();
    return text || fallback;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function parseJsonObject(value) {
    const raw = safeText(value);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  }

  function textInitial(value) {
    return safeText(value, "P").charAt(0).toUpperCase();
  }

  function normalizeRole(value) {
    const raw = safeText(value).toUpperCase();
    if (raw.includes("ADMIN")) return "ADMIN";
    if (raw.includes("CREATOR")) return "CREATOR";
    if (raw.includes("VIEWER")) return "VIEWER";
    return raw || "PUBLIC";
  }

  function normalizeTier(value) {
    const tier = safeText(value).toLowerCase();
    return tier === "gold" || tier === "pro" ? tier : "core";
  }

  function normalizeSocialLinks(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.entries(value).reduce((acc, [key, raw]) => {
      const normalizedKey = safeText(key).toLowerCase();
      const normalizedValue = safeText(raw);
      if (!normalizedKey || !normalizedValue) return acc;
      acc[normalizedKey] = normalizedValue;
      return acc;
    }, {});
  }

  function normalizeExternalUrl(url) {
    const raw = safeText(url);
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^(mailto:|tel:)/i.test(raw)) return raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return "";
    return `https://${raw.replace(/^\/+/, "")}`;
  }

  function normalizeLiveStatus(value) {
    if (!value || typeof value !== "object") return null;
    const provider = safeText(value.provider || value.active_provider || value.activeProvider).toLowerCase();
    const viewerCount = Number(value.viewerCount ?? value.viewer_count);
    return {
      isLive: value.isLive === true || value.is_live === true,
      provider,
      providerLabel: safeText(
        value.providerLabel || (provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "Live")
      ),
      title: safeText(value.title || value.live_title || value.liveTitle),
      url: safeText(value.url || value.live_url || value.liveUrl),
      viewerCount: Number.isFinite(viewerCount) && viewerCount >= 0 ? Math.round(viewerCount) : null
    };
  }

  function collectSocialEntries(value) {
    const normalized = normalizeSocialLinks(value);
    const entries = [];
    const seen = new Set();
    SOCIAL_ORDER.forEach((network) => {
      if (!normalized[network]) return;
      const url = normalizeExternalUrl(normalized[network]);
      if (!url) return;
      entries.push({ network, url });
      seen.add(network);
    });
    Object.entries(normalized).forEach(([network, rawUrl]) => {
      if (seen.has(network)) return;
      const url = normalizeExternalUrl(rawUrl);
      if (!url) return;
      entries.push({ network, url });
    });
    return entries;
  }

  function socialIconPath(network) {
    return SOCIAL_ICON_MAP[safeText(network).toLowerCase()] || "/assets/icons/ui/globe.svg";
  }

  function buildBadgesFromRole(role, tier = "core") {
    const normalizedRole = normalizeRole(role);
    if (normalizedRole === "ADMIN") return [{ kind: "role", value: "admin" }];
    if (normalizedRole === "CREATOR") return [{ kind: "tier", value: normalizeTier(tier) }];
    return [];
  }

  function normalizeBadges(value, role, tier) {
    const source = Array.isArray(value) ? value : buildBadgesFromRole(role, tier);
    return source
      .map((badge) => {
        if (!badge || typeof badge !== "object") return null;
        const rawKind = safeText(badge.kind).toLowerCase();
        const badgeValue = safeText(badge.value).toLowerCase();
        if (!rawKind || !badgeValue) return null;
        const kind = rawKind.includes("tier") ? "tier" : rawKind.includes("role") ? "role" : "";
        if (!kind) return null;
        if (kind === "role" && badgeValue !== "admin") return null;
        if (kind === "tier" && !TIER_ICON_MAP[badgeValue]) return null;
        return { kind, value: badgeValue };
      })
      .filter(Boolean);
  }

  function resolveBadgeIconPath(kind, value) {
    if (kind === "role") return ROLE_ICON_MAP[value] || "";
    if (kind === "tier") return TIER_ICON_MAP[value] || "";
    return "";
  }

  function normalizeProfileLookup(value) {
    return safeText(value)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function buildCanonicalProfileHref(profile) {
    const slug = normalizeProfileLookup(
      profile?.public_slug || profile?.publicSlug || profile?.slug || profile?.user_code || profile?.userCode
    );
    return slug ? `/u/${encodeURIComponent(slug)}` : "";
  }

  function isInOptOutZone(node) {
    return Boolean(node?.closest(OPTOUT_SELECTOR));
  }

  function getTrigger(node) {
    if (!(node instanceof Element)) return null;
    const trigger = node.closest(TRIGGER_SELECTOR);
    if (!trigger || isInOptOutZone(trigger)) return null;
    return trigger;
  }

  function parseTriggerData(trigger) {
    const ds = trigger?.dataset || {};
    const role = normalizeRole(ds.ssRole);
    return {
      displayName:
        safeText(ds.ssDisplayName) || safeText(trigger?.getAttribute("aria-label")) || safeText(trigger?.textContent, "Public User"),
      userCode: safeText(ds.ssUserCode),
      userId: safeText(ds.ssUserId),
      avatarUrl: safeText(ds.ssAvatarUrl),
      role,
      bio: safeText(ds.ssBio),
      profileHref: safeText(ds.ssProfileHref) || safeText(trigger?.getAttribute("href")),
      coverImageUrl: safeText(ds.ssCoverUrl || ds.ssCoverImageUrl),
      socialLinks: normalizeSocialLinks(parseJsonObject(ds.ssSocialLinks)),
      badges: normalizeBadges(parseJsonObject(ds.ssBadges), role, safeText(ds.ssTier)),
      tier: normalizeTier(ds.ssTier),
      liveStatus: normalizeLiveStatus(parseJsonObject(ds.ssLiveStatus))
    };
  }

  function createCard() {
    if (card) return card;
    card = document.createElement("aside");
    card.className = "ss-profile-hovercard";
    card.setAttribute("role", "tooltip");
    card.setAttribute("aria-hidden", "true");
    card.innerHTML = `
      <div class="ss-profile-hovercard-cover">
        <img class="ss-profile-hovercard-cover-image" data-slot="cover-image" alt="" loading="eager" decoding="async" hidden />
      </div>
      <div class="ss-profile-hovercard-body">
        <div class="ss-profile-hovercard-avatar" data-slot="avatar"></div>
        <div class="ss-profile-hovercard-head">
          <div class="ss-profile-hovercard-name-row">
            <h3 class="ss-profile-hovercard-name" data-slot="name">Public User</h3>
            <span class="ss-profile-hovercard-badges" data-slot="badges"></span>
          </div>
          <p class="ss-profile-hovercard-subtitle" data-slot="subtitle">PUBLIC</p>
        </div>
        <p class="ss-profile-hovercard-bio" data-slot="bio"></p>
        <div class="ss-profile-hovercard-social-row" data-slot="social-row"></div>
        <div class="ss-profile-hovercard-actions" data-slot="actions">
          <a class="ss-profile-hovercard-action" data-slot="profile-link" href="/community/profile.html">View Profile</a>
        </div>
        <div class="ss-profile-hovercard-skeleton" aria-hidden="true">
          <span class="ss-profile-hovercard-skeleton-line"></span>
          <span class="ss-profile-hovercard-skeleton-line"></span>
        </div>
      </div>
    `;
    const coverImage = getSlot("cover-image");
    if (coverImage) {
      coverImage.addEventListener("load", () => {
        card?.classList.add("has-cover-image");
        coverImage.hidden = false;
      });
      coverImage.addEventListener("error", () => {
        card?.classList.remove("has-cover-image");
        coverImage.hidden = true;
      });
    }
    card.addEventListener("mouseenter", () => {
      cardHovered = true;
      clearHideTimer();
    });
    card.addEventListener("mouseleave", () => {
      cardHovered = false;
      scheduleHide();
    });
    document.body.appendChild(card);
    return card;
  }

  function getSlot(name) {
    return card?.querySelector(`[data-slot="${name}"]`) || null;
  }

  function renderBadgeSuffix(row, badges) {
    if (!row) return;
    row.textContent = "";
    normalizeBadges(badges, "PUBLIC", "core").forEach((badge) => {
      const iconPath = resolveBadgeIconPath(badge.kind, badge.value);
      if (!iconPath) return;
      const icon = document.createElement("img");
      icon.className = "ss-profile-hovercard-badge ss-hover-badge-icon";
      icon.src = iconPath;
      icon.alt = "";
      row.appendChild(icon);
    });
    row.hidden = row.childElementCount === 0;
  }

  function renderSocialRow(row, socialLinks) {
    if (!row) return;
    row.innerHTML = "";
    const links = collectSocialEntries(socialLinks);
    if (!links.length) {
      row.hidden = true;
      return;
    }
    links.forEach(({ network, url }) => {
      const anchor = document.createElement("a");
      anchor.className = "ss-profile-hovercard-social";
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.setAttribute("aria-label", network);
      const icon = document.createElement("img");
      icon.src = socialIconPath(network);
      icon.alt = "";
      anchor.appendChild(icon);
      row.appendChild(anchor);
    });
    row.hidden = false;
  }

  function setCoverImage(url, displayName) {
    const coverImage = getSlot("cover-image");
    if (!coverImage) return;
    const source = safeText(url);
    card?.classList.remove("has-cover-image");
    if (!source) {
      coverImage.hidden = true;
      coverImage.removeAttribute("src");
      return;
    }
    coverImage.hidden = false;
    coverImage.alt = `${safeText(displayName, "Public User")} cover`;
    coverImage.src = source;
  }

  function buildLiveBadge(liveStatus) {
    if (!liveStatus?.isLive) return null;
    const badge = document.createElement("span");
    badge.className = "ss-profile-hovercard-live-badge";
    badge.textContent = "LIVE";
    badge.setAttribute("aria-label", `${liveStatus.providerLabel || "Live"} live now`);
    return badge;
  }

  function updateCardContent(profile) {
    if (!card) return;
    const avatarEl = getSlot("avatar");
    const nameEl = getSlot("name");
    const badgesEl = getSlot("badges");
    const subtitleEl = getSlot("subtitle");
    const bioEl = getSlot("bio");
    const socialRowEl = getSlot("social-row");
    const profileLink = getSlot("profile-link");
    if (avatarEl) {
      avatarEl.classList.toggle("is-live", Boolean(profile.liveStatus?.isLive));
      if (profile.avatarUrl) {
        avatarEl.style.backgroundImage = `url(${profile.avatarUrl})`;
        avatarEl.textContent = "";
      } else {
        avatarEl.style.backgroundImage = "";
        avatarEl.textContent = textInitial(profile.displayName);
      }
    }
    if (nameEl) {
      nameEl.textContent = safeText(profile.displayName, "Public User");
    }
    if (badgesEl) {
      renderBadgeSuffix(badgesEl, profile.badges);
      const liveBadge = buildLiveBadge(profile.liveStatus);
      if (liveBadge) badgesEl.appendChild(liveBadge);
    }
    if (subtitleEl) {
      const parts = [safeText(profile.role, "PUBLIC")];
      if (profile.liveStatus?.isLive) {
        parts.push(
          profile.liveStatus.viewerCount != null ? `${profile.liveStatus.viewerCount.toLocaleString()} watching` : "Live now"
        );
      }
      subtitleEl.textContent = parts.join(" · ");
    }
    if (bioEl) {
      bioEl.textContent = safeText(profile.bio, "Profile details are being updated.");
    }
    if (socialRowEl) {
      renderSocialRow(socialRowEl, profile.socialLinks);
    }
    setCoverImage(profile.coverImageUrl, profile.displayName);
    if (profileLink) {
      const href = safeText(profile.profileHref);
      if (href) {
        profileLink.href = href;
        profileLink.removeAttribute("aria-disabled");
        profileLink.removeAttribute("tabindex");
      } else {
        profileLink.href = "/community/profile.html";
        profileLink.setAttribute("aria-disabled", "true");
        profileLink.setAttribute("tabindex", "-1");
      }
    }
  }

  function setLoading(isLoading) {
    if (!card) return;
    card.classList.toggle("is-loading", Boolean(isLoading));
  }

  function showCard() {
    if (!card) return;
    card.classList.add("is-visible");
    card.setAttribute("aria-hidden", "false");
  }

  function hideCard() {
    activeTrigger = null;
    cardHovered = false;
    clearHideTimer();
    abortFetch();
    if (!card) return;
    card.classList.remove("is-visible", "is-loading");
    card.setAttribute("aria-hidden", "true");
  }

  function clearHideTimer() {
    if (!hideTimer) return;
    window.clearTimeout(hideTimer);
    hideTimer = 0;
  }

  function scheduleHide() {
    clearHideTimer();
    hideTimer = window.setTimeout(() => {
      if (!cardHovered) hideCard();
    }, HIDE_DELAY_MS);
  }

  function positionCard(trigger) {
    if (!card || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const preferRight = rect.left + cardRect.width + OFFSET <= window.innerWidth - VIEWPORT_GAP;
    const rawLeft = preferRight ? rect.left : rect.right - cardRect.width;
    const left = clamp(rawLeft, VIEWPORT_GAP, window.innerWidth - cardRect.width - VIEWPORT_GAP);
    let top = rect.bottom + OFFSET;
    if (top + cardRect.height > window.innerHeight - VIEWPORT_GAP) {
      top = rect.top - cardRect.height - OFFSET;
    }
    if (top < VIEWPORT_GAP) {
      top = clamp(rect.top + OFFSET, VIEWPORT_GAP, window.innerHeight - cardRect.height - VIEWPORT_GAP);
    }
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
  }

  function mergeProfile(base, next) {
    const role = normalizeRole(next?.role || base.role);
    return {
      displayName: safeText(next?.displayName, base.displayName),
      userCode: safeText(next?.userCode, base.userCode),
      userId: safeText(next?.userId, base.userId),
      avatarUrl: safeText(next?.avatarUrl, base.avatarUrl),
      role,
      bio: safeText(next?.bio, base.bio),
      profileHref: safeText(next?.profileHref, base.profileHref),
      coverImageUrl: safeText(next?.coverImageUrl, base.coverImageUrl),
      socialLinks: normalizeSocialLinks(next?.socialLinks || base.socialLinks),
      badges: normalizeBadges(next?.badges ?? base.badges, role, safeText(next?.tier || base?.tier || "core")),
      tier: normalizeTier(next?.tier || base?.tier),
      liveStatus: normalizeLiveStatus(next?.liveStatus) || normalizeLiveStatus(base?.liveStatus)
    };
  }

  function normalizeFetchedProfile(payload, fallback) {
    const profile = payload?.profile && typeof payload.profile === "object" ? payload.profile : payload;
    const accountType = normalizeRole(profile?.account_type || profile?.accountType || profile?.role || fallback.role);
    const tier = normalizeTier(profile?.tier || fallback.tier);
    return {
      displayName: safeText(profile?.display_name || profile?.displayName || profile?.name, fallback.displayName),
      userCode: safeText(profile?.user_code || profile?.userCode, fallback.userCode),
      userId: safeText(profile?.id, fallback.userId),
      avatarUrl: safeText(profile?.avatar_url || profile?.avatarUrl || profile?.avatar, fallback.avatarUrl),
      role: accountType,
      bio: safeText(profile?.bio || profile?.summary, fallback.bio),
      profileHref:
        safeText(profile?.streamsuites_profile_url) || buildCanonicalProfileHref(profile) || fallback.profileHref,
      coverImageUrl: safeText(
        profile?.banner_image_url ||
          profile?.bannerImageUrl ||
          profile?.cover_image_url ||
          profile?.coverImageUrl ||
          profile?.profile_cover ||
          profile?.banner_url ||
          profile?.bannerUrl ||
          profile?.cover_url ||
          profile?.coverUrl,
        fallback.coverImageUrl
      ),
      socialLinks: normalizeSocialLinks(profile?.social_links || profile?.socialLinks || fallback.socialLinks),
      badges: normalizeBadges(profile?.badges, accountType, tier),
      tier,
      liveStatus: normalizeLiveStatus(profile?.live_status || profile?.liveStatus || fallback.liveStatus)
    };
  }

  function shouldFetchProfile(profile) {
    return Boolean(profile.userCode) && !profileCache.has(profile.userCode);
  }

  function abortFetch() {
    if (!fetchController) return;
    fetchController.abort();
    fetchController = null;
  }

  async function fetchProfileData(baseProfile, token) {
    if (!baseProfile.userCode) return;
    abortFetch();
    fetchController = new AbortController();
    const endpoint = new URL(PROFILE_ENDPOINT);
    endpoint.searchParams.set("u", baseProfile.userCode);
    try {
      const response = await fetch(endpoint.toString(), {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json" },
        signal: fetchController.signal
      });
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({}));
      const profile = normalizeFetchedProfile(payload, baseProfile);
      profileCache.set(profile.userCode || baseProfile.userCode, profile);
      if (token !== activeFetchToken || !activeTrigger) return;
      updateCardContent(mergeProfile(baseProfile, profile));
      setLoading(false);
      positionCard(activeTrigger);
    } catch (_err) {
      if (token === activeFetchToken) setLoading(false);
    } finally {
      fetchController = null;
    }
  }

  function openForTrigger(trigger) {
    if (!trigger) return;
    createCard();
    clearHideTimer();
    const initial = parseTriggerData(trigger);
    const cached = initial.userCode ? profileCache.get(initial.userCode) : null;
    const merged = cached ? mergeProfile(initial, cached) : initial;
    activeTrigger = trigger;
    updateCardContent(merged);
    setLoading(false);
    showCard();
    positionCard(trigger);
    if (!shouldFetchProfile(merged)) return;
    setLoading(true);
    activeFetchToken += 1;
    fetchProfileData(merged, activeFetchToken);
  }

  function sameProfileIdentity(left, right) {
    if (!(left instanceof Element) || !(right instanceof Element)) return false;
    const leftUserCode = safeText(left.getAttribute("data-ss-user-code"));
    const rightUserCode = safeText(right.getAttribute("data-ss-user-code"));
    if (leftUserCode && rightUserCode && leftUserCode === rightUserCode) return true;
    const leftUserId = safeText(left.getAttribute("data-ss-user-id"));
    const rightUserId = safeText(right.getAttribute("data-ss-user-id"));
    return Boolean(leftUserId && rightUserId && leftUserId === rightUserId);
  }

  function handlePointerOver(event) {
    const trigger = getTrigger(event.target);
    if (!trigger || trigger === activeTrigger) return;
    openForTrigger(trigger);
  }

  function handlePointerOut(event) {
    if (!activeTrigger || !card) return;
    if (!activeTrigger.contains(event.target)) return;
    const next = event.relatedTarget;
    if (next && (activeTrigger.contains(next) || card.contains(next))) return;
    const nextTrigger = getTrigger(next);
    if (sameProfileIdentity(activeTrigger, nextTrigger)) return;
    scheduleHide();
  }

  function handleFocusIn(event) {
    const trigger = getTrigger(event.target);
    if (!trigger) return;
    openForTrigger(trigger);
  }

  function handleFocusOut(event) {
    if (!card || !activeTrigger) return;
    const next = event.relatedTarget;
    if (next && (activeTrigger.contains(next) || card.contains(next))) return;
    const nextTrigger = getTrigger(next);
    if (sameProfileIdentity(activeTrigger, nextTrigger)) return;
    scheduleHide();
  }

  function handleEscape(event) {
    if (event.key === "Escape") hideCard();
  }

  function handleViewportChange() {
    if (!card || !activeTrigger || !card.classList.contains("is-visible")) return;
    positionCard(activeTrigger);
  }

  function init() {
    document.addEventListener("mouseover", handlePointerOver, true);
    document.addEventListener("mouseout", handlePointerOut, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("focusout", handleFocusOut, true);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

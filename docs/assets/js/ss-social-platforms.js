(() => {
  const SOCIAL_PLATFORM_REGISTRY = Object.freeze([
    { key: "rumble", label: "Rumble", icon: "/assets/icons/rumble.svg", aliases: ["rumble"], tier: "first-class" },
    { key: "youtube", label: "YouTube", icon: "/assets/icons/youtube.svg", aliases: ["youtube", "yt"], tier: "first-class" },
    { key: "twitch", label: "Twitch", icon: "/assets/icons/twitch.svg", aliases: ["twitch"], tier: "first-class" },
    { key: "kick", label: "Kick", icon: "/assets/icons/kick.svg", aliases: ["kick"], tier: "first-class" },
    { key: "pilled", label: "Pilled", icon: "/assets/icons/pilled.svg", aliases: ["pilled"], tier: "first-class" },
    { key: "discord", label: "Discord", icon: "/assets/icons/discord.svg", aliases: ["discord"], tier: "first-class" },
    { key: "x", label: "X", icon: "/assets/icons/x.svg", aliases: ["x", "twitter"], tier: "first-class" },
    { key: "instagram", label: "Instagram", icon: "/assets/icons/instagram.svg", aliases: ["instagram", "insta"], tier: "first-class" },
    { key: "tiktok", label: "TikTok", icon: "/assets/icons/tiktok.svg", aliases: ["tiktok", "tik_tok"], tier: "first-class" },
    { key: "facebook", label: "Facebook", icon: "/assets/icons/facebook.svg", aliases: ["facebook", "fb"], tier: "first-class" },
    { key: "threads", label: "Threads", icon: "/assets/icons/threads.svg", aliases: ["threads"], tier: "first-class" },
    { key: "reddit", label: "Reddit", icon: "/assets/icons/reddit.svg", aliases: ["reddit"], tier: "first-class" },
    { key: "telegram", label: "Telegram", icon: "/assets/icons/telegram.svg", aliases: ["telegram"], tier: "first-class" },
    {
      key: "whatsappchannels",
      label: "WhatsApp Channels",
      icon: "/assets/icons/whatsapp.svg",
      aliases: ["whatsappchannels", "whatsappchannel", "whatsapp_channels", "whatsapp_channel", "whatsapp"],
      tier: "first-class"
    },
    { key: "patreon", label: "Patreon", icon: "/assets/icons/patreon.svg", aliases: ["patreon"], tier: "first-class" },
    { key: "substack", label: "Substack", icon: "/assets/icons/substack.svg", aliases: ["substack"], tier: "first-class" },
    { key: "soundcloud", label: "SoundCloud", icon: "/assets/icons/soundcloud.svg", aliases: ["soundcloud", "sound_cloud"], tier: "first-class" },
    {
      key: "applepodcasts",
      label: "Apple Podcasts",
      icon: "/assets/icons/applepodcasts.svg",
      aliases: ["applepodcasts", "apple_podcasts", "applepodcast", "apple_podcast"],
      tier: "first-class"
    },
    { key: "website", label: "Website", icon: "/assets/icons/website.svg", aliases: ["website", "site", "web", "url", "homepage"], tier: "first-class" },
    { key: "bluesky", label: "Bluesky", icon: "/assets/icons/bluesky.svg", aliases: ["bluesky", "bsky"], tier: "extended" },
    { key: "locals", label: "Locals", icon: "/assets/icons/locals.svg", aliases: ["locals"], tier: "extended" },
    { key: "spotify", label: "Spotify", icon: "/assets/icons/spotify.svg", aliases: ["spotify"], tier: "extended" },
    { key: "vimeo", label: "Vimeo", icon: "/assets/icons/vimeo.svg", aliases: ["vimeo"], tier: "extended" },
    { key: "dailymotion", label: "Dailymotion", icon: "/assets/icons/dailymotion.svg", aliases: ["dailymotion"], tier: "extended" },
    { key: "odysee", label: "Odysee", icon: "/assets/icons/odysee.svg", aliases: ["odysee"], tier: "extended" },
    { key: "trovo", label: "Trovo", icon: "/assets/icons/trovo.svg", aliases: ["trovo"], tier: "extended" },
    { key: "snapchat", label: "Snapchat", icon: "/assets/icons/snapchat.svg", aliases: ["snapchat"], tier: "extended" },
    { key: "pinterest", label: "Pinterest", icon: "/assets/icons/pinterest.svg", aliases: ["pinterest"], tier: "extended" },
    { key: "kofi", label: "Ko-fi", icon: "/assets/icons/kofi.svg", aliases: ["kofi", "ko-fi", "ko_fi"], tier: "extended" },
    { key: "github", label: "GitHub", icon: "/assets/icons/github.svg", aliases: ["github"], tier: "extended" },
    { key: "minds", label: "Minds", icon: "/assets/icons/minds.svg", aliases: ["minds"], tier: "extended" },
    { key: "custom", label: "Custom", icon: "/assets/icons/link.svg", aliases: ["custom", "link"], tier: "extended" }
  ]);
  const SOCIAL_PLATFORM_METADATA = Object.freeze(
    SOCIAL_PLATFORM_REGISTRY.reduce((acc, entry, index) => {
      acc[entry.key] = Object.freeze({ ...entry, order: index });
      return acc;
    }, {})
  );
  const SOCIAL_PLATFORM_ALIAS_MAP = Object.freeze(
    SOCIAL_PLATFORM_REGISTRY.reduce((acc, entry) => {
      entry.aliases.forEach((alias) => {
        acc[alias.replace(/[\s_-]+/g, "").toLowerCase()] = entry.key;
      });
      return acc;
    }, {})
  );
  const SOCIAL_PLATFORM_ORDER = Object.freeze(SOCIAL_PLATFORM_REGISTRY.map((entry) => entry.key));

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeSocialNetworkKey(value) {
    const normalized = normalizeText(value)
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
    if (!normalized) return "";
    return SOCIAL_PLATFORM_ALIAS_MAP[normalized] || normalized;
  }

  function normalizeSocialLinks(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.entries(value).reduce((acc, [key, raw]) => {
      const normalizedKey = normalizeSocialNetworkKey(key);
      const normalizedValue = normalizeText(raw);
      if (!normalizedKey || !normalizedValue) return acc;
      if (!acc[normalizedKey]) acc[normalizedKey] = normalizedValue;
      return acc;
    }, {});
  }

  function normalizeExternalUrl(url) {
    const raw = normalizeText(url);
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^(mailto:|tel:)/i.test(raw)) return raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return "";
    return `https://${raw.replace(/^\/+/, "")}`;
  }

  function socialPlatformMeta(key) {
    return SOCIAL_PLATFORM_METADATA[normalizeSocialNetworkKey(key)] || null;
  }

  function socialIconPath(key) {
    return socialPlatformMeta(key)?.icon || "/assets/icons/link.svg";
  }

  function socialLabel(key) {
    const meta = socialPlatformMeta(key);
    if (meta?.label) return meta.label;
    const raw = normalizeText(key).replace(/[_-]+/g, " ");
    return raw ? raw.replace(/\b\w/g, (char) => char.toUpperCase()) : "Custom";
  }

  function collectOrderedSocialEntries(value) {
    const normalized = normalizeSocialLinks(value);
    const entries = [];
    const seen = new Set();
    SOCIAL_PLATFORM_ORDER.forEach((network) => {
      const url = normalizeExternalUrl(normalized[network]);
      if (!url) return;
      entries.push({
        network,
        url,
        label: socialLabel(network),
        iconPath: socialIconPath(network),
        tier: socialPlatformMeta(network)?.tier || "extended"
      });
      seen.add(network);
    });
    Object.entries(normalized).forEach(([network, rawUrl]) => {
      if (seen.has(network)) return;
      const url = normalizeExternalUrl(rawUrl);
      if (!url) return;
      entries.push({
        network,
        url,
        label: socialLabel(network),
        iconPath: socialIconPath(network),
        tier: socialPlatformMeta(network)?.tier || "extended"
      });
    });
    return entries;
  }

  window.StreamSuitesSocialPlatforms = Object.freeze({
    SOCIAL_PLATFORM_ORDER,
    collectOrderedSocialEntries,
    normalizeExternalUrl,
    normalizeSocialLinks,
    normalizeSocialNetworkKey,
    socialIconPath,
    socialLabel,
    socialPlatformMeta
  });
})();

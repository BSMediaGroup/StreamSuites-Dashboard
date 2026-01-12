/* ======================================================================
   StreamSuites™ Dashboard — Discord Guild Context
   - Tracks active guild selection
   - Filters eligible guilds from Discord OAuth session
   - Applies UI gating for Discord-specific views
   ====================================================================== */

(() => {
  "use strict";

  const ACTIVE_GUILD_KEY = "streamsuites.discord.activeGuild";
  const DISCORD_PERMISSION_ADMINISTRATOR = 0x8n;
  const DISCORD_PERMISSION_MANAGE_GUILD = 0x20n;

  const el = {
    selector: null,
    status: null
  };

  const state = {
    activeGuildId: null,
    authorizedGuilds: new Map(),
    unauthorizedGuilds: new Map(),
    runtimeGuilds: new Map(),
    runtimeOverrideDetected: false,
    runtimeLoaded: false,
    status: "missing",
    session: null
  };

  function coerceText(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value.trim();
    return String(value).trim();
  }

  function parsePermissionBits(value) {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isFinite(value)) {
      return BigInt(value);
    }
    if (typeof value === "string" && value.trim()) {
      try {
        return BigInt(value);
      } catch (err) {
        return 0n;
      }
    }
    return 0n;
  }

  function hasGuildAccess(guild) {
    if (!guild || typeof guild !== "object") return false;
    if (guild.owner === true) return true;
    const permissions = parsePermissionBits(guild.permissions);
    if ((permissions & DISCORD_PERMISSION_ADMINISTRATOR) === DISCORD_PERMISSION_ADMINISTRATOR) {
      return true;
    }
    return (
      (permissions & DISCORD_PERMISSION_MANAGE_GUILD) ===
      DISCORD_PERMISSION_MANAGE_GUILD
    );
  }

  function parseBooleanFlag(value) {
    if (value === true) return true;
    if (value === false) return false;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string" && value.trim()) {
      const normalized = value.trim().toLowerCase();
      if (["true", "yes", "1", "enabled", "active"].includes(normalized)) return true;
      if (["false", "no", "0", "disabled", "inactive"].includes(normalized)) return false;
    }
    return null;
  }

  function normalizeOverrideUserIds(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((entry) => coerceText(entry)).filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(/[,\s]+/)
        .map((entry) => coerceText(entry))
        .filter(Boolean);
    }
    return [];
  }

  function getRuntimeAdminOverrideSignal(runtimeGuild, oauthUserId) {
    if (!runtimeGuild || typeof runtimeGuild !== "object") return false;

    const directFlag = parseBooleanFlag(
      runtimeGuild.authorized_by_admin_override ??
        runtimeGuild.admin_override ??
        runtimeGuild.admin_override_active ??
        runtimeGuild.adminOverrideActive
    );
    if (directFlag === true) return true;

    const overrideUsers = normalizeOverrideUserIds(
      runtimeGuild.admin_override_user_ids ??
        runtimeGuild.admin_override_users ??
        runtimeGuild.adminOverrideUserIds ??
        runtimeGuild.adminOverrideUsers ??
        runtimeGuild.authorized_admin_ids
    );

    if (oauthUserId && overrideUsers.includes(oauthUserId)) return true;

    const nestedOverride = runtimeGuild.admin_override;
    if (nestedOverride && typeof nestedOverride === "object") {
      const nestedFlag = parseBooleanFlag(
        nestedOverride.authorized ?? nestedOverride.active ?? nestedOverride.enabled
      );
      if (nestedFlag === true) return true;

      const nestedUsers = normalizeOverrideUserIds(
        nestedOverride.user_ids ?? nestedOverride.users ?? nestedOverride.userIds
      );
      if (oauthUserId && nestedUsers.includes(oauthUserId)) return true;
    }

    return false;
  }

  function resolveOAuthPermissionsValid(runtimeGuild, oauthGuild) {
    if (runtimeGuild && typeof runtimeGuild === "object") {
      const runtimeFlag = parseBooleanFlag(runtimeGuild.oauth_permissions_valid);
      if (runtimeFlag === true || runtimeFlag === false) return runtimeFlag === true;
    }
    return hasGuildAccess(oauthGuild);
  }

  function parseBotPresence(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string" && value.trim()) {
      const normalized = value.trim().toLowerCase();
      return normalized !== "false" && normalized !== "0" && normalized !== "no";
    }
    return true;
  }

  function extractRuntimeGuildList(raw) {
    if (!raw || typeof raw !== "object") return [];
    if (Array.isArray(raw.guilds)) return raw.guilds;
    if (Array.isArray(raw.connected_guilds)) return raw.connected_guilds;
    if (Array.isArray(raw.discord?.guilds)) return raw.discord.guilds;
    if (Array.isArray(raw.discord_bot?.guilds)) return raw.discord_bot.guilds;
    return [];
  }

  function normalizeRuntimeGuilds(raw) {
    const guilds = extractRuntimeGuildList(raw);
    const normalized = new Map();

    guilds.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const id = coerceText(entry.guild_id || entry.id || entry.guildId);
      if (!id) return;
      const botPresent = parseBotPresence(entry.bot_present);
      if (!botPresent) return;
      const name = coerceText(entry.guild_name || entry.name || entry.label);
      normalized.set(id, {
        ...entry,
        guild_id: id,
        guild_name: name,
        bot_present: true
      });
    });

    return normalized;
  }

  function buildAuthorizedGuilds(session, runtimeGuilds) {
    const authorized = new Map();
    const unauthorized = new Map();
    const oauthGuilds = Array.isArray(session?.guilds) ? session.guilds : [];
    const oauthGuildMap = new Map(
      oauthGuilds
        .map((guild) => [coerceText(guild?.id), guild])
        .filter(([id]) => id)
    );
    const oauthUserId = coerceText(session?.user?.id);

    runtimeGuilds.forEach((runtimeGuild, id) => {
      const oauthGuild = oauthGuildMap.get(id) || null;
      const oauthValid = resolveOAuthPermissionsValid(runtimeGuild, oauthGuild);
      const adminOverride = getRuntimeAdminOverrideSignal(runtimeGuild, oauthUserId);

      if (oauthValid || adminOverride) {
        authorized.set(id, {
          ...runtimeGuild,
          ...(oauthGuild || {}),
          runtime: runtimeGuild,
          adminOverride
        });
        return;
      }

      unauthorized.set(id, {
        ...runtimeGuild,
        ...(oauthGuild || {}),
        runtime: runtimeGuild,
        adminOverride
      });
    });

    oauthGuilds.forEach((guild) => {
      const id = coerceText(guild?.id);
      if (!id || runtimeGuilds.has(id)) return;
      if (hasGuildAccess(guild)) {
        unauthorized.set(id, guild);
      }
    });
    return { authorized, unauthorized };
  }

  function loadActiveGuildId() {
    try {
      return coerceText(localStorage.getItem(ACTIVE_GUILD_KEY));
    } catch (err) {
      return "";
    }
  }

  function saveActiveGuildId(guildId) {
    try {
      if (!guildId) {
        localStorage.removeItem(ACTIVE_GUILD_KEY);
        return;
      }
      localStorage.setItem(ACTIVE_GUILD_KEY, guildId);
    } catch (err) {
      console.warn("[Discord Guild] Failed to persist active guild.", err);
    }
  }

  function setStatus(status, detail = {}) {
    state.status = status;

    document.body.classList.toggle("discord-guild-ready", status === "ready");
    document.body.classList.toggle("discord-guild-missing", status === "missing");
    document.body.classList.toggle(
      "discord-guild-unauthorized",
      status === "unauthorized"
    );
    document.body.classList.toggle("discord-guild-no-access", status === "no-access");

    applyGuildLocks(status);
    updateStatusText(detail);
    emitChange();
  }

  function applyGuildLocks(status) {
    const locked = status !== "ready";
    const nav = document.querySelector("[data-discord-nav]");
    if (nav) {
      nav.classList.toggle("is-locked", locked);
      nav.setAttribute("aria-disabled", locked ? "true" : "false");
    }
    const containers = document.querySelectorAll("[data-discord-guild-locked]");
    containers.forEach((container) => {
      container.classList.toggle("is-guild-locked", locked);
      container.setAttribute("aria-disabled", locked ? "true" : "false");
      const controls = container.querySelectorAll(
        "input, select, textarea, button"
      );
      controls.forEach((control) => {
        if (locked) {
          if (!control.dataset.discordGuildLock) {
            control.dataset.discordGuildLock = control.disabled ? "preserve" : "locked";
          }
          if (control.dataset.discordGuildLock === "locked") {
            control.disabled = true;
          }
          return;
        }

        if (control.dataset.discordGuildLock === "locked") {
          control.disabled = false;
        }
        delete control.dataset.discordGuildLock;
      });
    });
  }

  function formatGuildLabel(guild) {
    if (!guild) return "Unknown guild";
    const name = coerceText(guild.name) || "Unknown guild";
    const id = coerceText(guild.id);
    return id ? `${name} (${id})` : name;
  }

  function updateSelectorOptions() {
    if (!el.selector) return;
    const option = document.createElement("option");
    option.value = "";
    option.textContent = state.session
      ? state.runtimeLoaded
        ? "Select an eligible guild"
        : "Loading runtime guilds…"
      : "Login to load guilds";

    el.selector.innerHTML = "";
    el.selector.appendChild(option);

    if (!state.session || !state.runtimeLoaded) {
      el.selector.disabled = true;
      return;
    }

    const eligible = Array.from(state.authorizedGuilds.values()).sort((a, b) => {
      const nameA = coerceText(a?.name).toLowerCase();
      const nameB = coerceText(b?.name).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    if (eligible.length === 0) {
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "No authorized guilds";
      empty.disabled = true;
      el.selector.appendChild(empty);
      el.selector.disabled = true;
      return;
    }

    eligible.forEach((guild) => {
      const guildId = coerceText(guild.id);
      if (!guildId) return;
      const opt = document.createElement("option");
      opt.value = guildId;
      const label = formatGuildLabel(guild);
      opt.textContent = guild.adminOverride ? `${label} — Authorized (Admin Override)` : label;
      el.selector.appendChild(opt);
    });

    el.selector.disabled = false;
  }

  function updateSelectorValue() {
    if (!el.selector) return;
    if (state.authorizedGuilds.has(state.activeGuildId)) {
      el.selector.value = state.activeGuildId;
    } else {
      el.selector.value = "";
    }
  }

  function updateStatusText(detail = {}) {
    if (!el.status) return;

    if (!state.session) {
      el.status.textContent = "Discord login required for guild selection.";
      return;
    }

    if (!state.runtimeLoaded) {
      el.status.textContent = "Loading runtime guild access.";
      return;
    }

    if (state.status === "unauthorized") {
      el.status.textContent =
        "Active guild not authorized for this Discord login.";
      return;
    }

    if (state.status === "no-access") {
      el.status.textContent =
        "You do not have permission to manage any guilds where the StreamSuites bot is installed.";
      return;
    }

    if (!state.activeGuildId) {
      const message =
        state.authorizedGuilds.size === 0
          ? "You do not have permission to manage any guilds where the StreamSuites bot is installed."
          : "Select a Discord guild to manage settings.";
      el.status.textContent = message;
      return;
    }

    const activeGuild = state.authorizedGuilds.get(state.activeGuildId);
    if (activeGuild) {
      const overrideTag = activeGuild.adminOverride
        ? " (Authorized by Admin Override)"
        : "";
      el.status.textContent = `Active: ${formatGuildLabel(activeGuild)}${overrideTag}`;
      return;
    }

    el.status.textContent = "Active guild selected.";
  }

  function evaluateStatus() {
    if (!state.session) {
      setStatus("missing");
      return;
    }

    if (!state.runtimeLoaded) {
      setStatus("missing");
      return;
    }

    if (state.authorizedGuilds.size === 0) {
      setStatus("no-access");
      return;
    }

    if (!state.activeGuildId) {
      setStatus("missing");
      return;
    }

    if (!state.authorizedGuilds.has(state.activeGuildId)) {
      setStatus("unauthorized");
      return;
    }

    setStatus("ready");
  }

  function emitChange() {
    const detail = {
      status: state.status,
      activeGuildId: state.activeGuildId,
      activeGuild: state.authorizedGuilds.get(state.activeGuildId) || null,
      eligibleGuilds: state.authorizedGuilds,
      authorizedGuilds: state.authorizedGuilds,
      unauthorizedGuilds: state.unauthorizedGuilds,
      runtimeGuilds: state.runtimeGuilds
    };

    window.dispatchEvent(new CustomEvent("streamsuites:discord-guild", { detail }));
  }

  function logGuildCounts() {
    const oauthCount = Array.isArray(state.session?.guilds) ? state.session.guilds.length : 0;
    const runtimeCount = state.runtimeGuilds.size;
    const authorizedCount = state.authorizedGuilds.size;
    console.info(
      `[Discord Guild] OAuth guilds: ${oauthCount} | Runtime guilds: ${runtimeCount} | Authorized guilds: ${authorizedCount}`
    );
    console.info(
      `[Discord Guild] Runtime admin override detected: ${state.runtimeOverrideDetected}`
    );
  }

  function updateAuthorization() {
    const { authorized, unauthorized } = buildAuthorizedGuilds(
      state.session,
      state.runtimeGuilds
    );
    state.authorizedGuilds = authorized;
    state.unauthorizedGuilds = unauthorized;
    state.runtimeOverrideDetected = Array.from(state.runtimeGuilds.values()).some(
      (guild) =>
        getRuntimeAdminOverrideSignal(
          guild,
          coerceText(state.session?.user?.id)
        )
    );
    updateSelectorOptions();
    updateSelectorValue();
    evaluateStatus();
    logGuildCounts();
  }

  function handleAuthEvent(event) {
    state.session = event?.detail?.session || window.StreamSuitesAuth?.session || null;
    const oauthUserId = coerceText(state.session?.user?.id);
    if (oauthUserId) {
      console.info(`[Discord Guild] OAuth user ID: ${oauthUserId}`);
    }
    if (state.runtimeLoaded) {
      updateAuthorization();
      return;
    }
    updateSelectorOptions();
    evaluateStatus();
  }

  async function loadRuntimeGuilds() {
    const loader = window.StreamSuitesState?.loadStateJson;
    if (typeof loader !== "function") {
      console.warn("[Discord Guild] Runtime guild loader unavailable.");
      state.runtimeLoaded = true;
      updateAuthorization();
      return;
    }

    try {
      const runtime = await loader("discord/runtime.json");
      state.runtimeGuilds = normalizeRuntimeGuilds(runtime);
    } catch (err) {
      console.warn("[Discord Guild] Failed to load runtime guilds.", err);
      state.runtimeGuilds = new Map();
    }

    state.runtimeLoaded = true;
    console.info(
      `[Discord Guild] Runtime guild count: ${state.runtimeGuilds.size}`
    );
    updateAuthorization();
  }

  function setActiveGuildId(guildId) {
    const normalized = coerceText(guildId);
    state.activeGuildId = normalized;
    saveActiveGuildId(normalized);
    updateSelectorValue();
    evaluateStatus();
    console.info(`[Discord Guild] Active guild ID changed: ${normalized || "none"}`);
  }

  function bindEvents() {
    if (el.selector) {
      el.selector.addEventListener("change", () => {
        const selected = coerceText(el.selector.value);
        if (selected && !state.authorizedGuilds.has(selected)) {
          return;
        }
        setActiveGuildId(selected);
      });
    }

    window.addEventListener("streamsuites:discord-auth", handleAuthEvent);
  }

  function cacheElements() {
    el.selector = document.getElementById("discord-active-guild");
    el.status = document.getElementById("discord-guild-status");
  }

  function init() {
    cacheElements();
    state.activeGuildId = loadActiveGuildId();
    state.session = window.StreamSuitesAuth?.session || null;
    updateSelectorOptions();
    updateSelectorValue();
    bindEvents();
    loadRuntimeGuilds();
    evaluateStatus();
  }

  window.StreamSuitesDiscordGuild = {
    getActiveGuildId: () => state.activeGuildId,
    getActiveGuild: () => state.authorizedGuilds.get(state.activeGuildId) || null,
    getEligibleGuilds: () => state.authorizedGuilds,
    getAuthorizedGuilds: () => state.authorizedGuilds,
    getUnauthorizedGuilds: () => state.unauthorizedGuilds,
    getRuntimeGuilds: () => state.runtimeGuilds,
    getStatus: () => state.status,
    setActiveGuildId
  };

  document.addEventListener("DOMContentLoaded", init);
})();

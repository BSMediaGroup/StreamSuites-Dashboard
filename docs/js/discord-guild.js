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
    const guilds = Array.isArray(session?.guilds) ? session.guilds : [];
    guilds.forEach((guild) => {
      const id = coerceText(guild?.id);
      if (!id) return;
      const runtimeGuild = runtimeGuilds.get(id) || null;
      const hasAccess = hasGuildAccess(guild);
      if (runtimeGuild && hasAccess) {
        authorized.set(id, {
          ...guild,
          runtime: runtimeGuild
        });
        return;
      }
      if (runtimeGuild || hasAccess) {
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

    applyGuildLocks(status);
    updateStatusText(detail);
    emitChange();
  }

  function applyGuildLocks(status) {
    const locked = status !== "ready";
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
      opt.textContent = formatGuildLabel(guild);
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
          : "Select an eligible guild to unlock Discord settings.";
      el.status.textContent = message;
      return;
    }

    const activeGuild = state.authorizedGuilds.get(state.activeGuildId);
    el.status.textContent = activeGuild
      ? `Active: ${formatGuildLabel(activeGuild)}`
      : "Active guild selected.";
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
  }

  function updateAuthorization() {
    const { authorized, unauthorized } = buildAuthorizedGuilds(
      state.session,
      state.runtimeGuilds
    );
    state.authorizedGuilds = authorized;
    state.unauthorizedGuilds = unauthorized;
    updateSelectorOptions();
    updateSelectorValue();
    evaluateStatus();
    logGuildCounts();
  }

  function handleAuthEvent(event) {
    state.session = event?.detail?.session || window.StreamSuitesAuth?.session || null;
    updateAuthorization();
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
    updateAuthorization();
  }

  function setActiveGuildId(guildId) {
    const normalized = coerceText(guildId);
    state.activeGuildId = normalized;
    saveActiveGuildId(normalized);
    updateSelectorValue();
    evaluateStatus();
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
    updateAuthorization();
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

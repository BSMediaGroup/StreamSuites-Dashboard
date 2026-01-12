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
    eligibleGuilds: new Map(),
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

  function buildEligibleGuilds(session) {
    const eligible = new Map();
    const guilds = Array.isArray(session?.guilds) ? session.guilds : [];
    guilds.forEach((guild) => {
      const id = coerceText(guild?.id);
      if (!id) return;
      if (!hasGuildAccess(guild)) return;
      eligible.set(id, guild);
    });
    return eligible;
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
      ? "Select an eligible guild"
      : "Login to load guilds";

    el.selector.innerHTML = "";
    el.selector.appendChild(option);

    if (!state.session) {
      el.selector.disabled = true;
      return;
    }

    const eligible = Array.from(state.eligibleGuilds.values()).sort((a, b) => {
      const nameA = coerceText(a?.name).toLowerCase();
      const nameB = coerceText(b?.name).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    if (eligible.length === 0) {
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "No eligible guilds";
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
    if (state.eligibleGuilds.has(state.activeGuildId)) {
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

    if (state.status === "unauthorized") {
      el.status.textContent =
        "Active guild not authorized for this Discord login.";
      return;
    }

    if (!state.activeGuildId) {
      const message =
        state.eligibleGuilds.size === 0
          ? "No eligible guilds available for this account."
          : "Select an eligible guild to unlock Discord settings.";
      el.status.textContent = message;
      return;
    }

    const activeGuild = state.eligibleGuilds.get(state.activeGuildId);
    el.status.textContent = activeGuild
      ? `Active: ${formatGuildLabel(activeGuild)}`
      : "Active guild selected.";
  }

  function evaluateStatus() {
    if (!state.session) {
      setStatus("missing");
      return;
    }

    if (!state.activeGuildId) {
      setStatus("missing");
      return;
    }

    if (!state.eligibleGuilds.has(state.activeGuildId)) {
      setStatus("unauthorized");
      return;
    }

    setStatus("ready");
  }

  function emitChange() {
    const detail = {
      status: state.status,
      activeGuildId: state.activeGuildId,
      activeGuild: state.eligibleGuilds.get(state.activeGuildId) || null,
      eligibleGuilds: state.eligibleGuilds
    };

    window.dispatchEvent(new CustomEvent("streamsuites:discord-guild", { detail }));
  }

  function handleAuthEvent(event) {
    state.session = event?.detail?.session || window.StreamSuitesAuth?.session || null;
    state.eligibleGuilds = buildEligibleGuilds(state.session);
    updateSelectorOptions();
    updateSelectorValue();
    evaluateStatus();
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
        if (selected && !state.eligibleGuilds.has(selected)) {
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
    state.eligibleGuilds = buildEligibleGuilds(state.session);
    updateSelectorOptions();
    updateSelectorValue();
    bindEvents();
    evaluateStatus();
  }

  window.StreamSuitesDiscordGuild = {
    getActiveGuildId: () => state.activeGuildId,
    getActiveGuild: () => state.eligibleGuilds.get(state.activeGuildId) || null,
    getEligibleGuilds: () => state.eligibleGuilds,
    getStatus: () => state.status,
    setActiveGuildId
  };

  document.addEventListener("DOMContentLoaded", init);
})();

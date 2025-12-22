/* ============================================================
   StreamSuites Dashboard — creators.js
   ============================================================

   Responsibilities:
   - Manage creator records (UI-side)
   - Populate creators table
   - Handle add/edit/soft-disable flows
   - Toggle platform-specific config blocks
   - Persist drafts to localStorage (via ConfigState)
   - Export deterministic creators.json for runtime consumption

   ============================================================ */

(() => {
  "use strict";

  const ADMIN_DEFAULT_TIER = "open";
  const PLATFORM_KEYS = ["youtube", "twitch", "rumble", "discord"];

  const el = {};

  let creators = [];
  let editingCreatorId = null;
  let wired = false;

  /* ------------------------------------------------------------
     INIT / DESTROY
     ------------------------------------------------------------ */

  async function init() {
    cacheElements();
    wireEvents();
    await hydrateCreators();
  }

  function destroy() {
    creators = [];
    editingCreatorId = null;
    wired = false;
  }

  /* ------------------------------------------------------------
     DOM CACHE + EVENTS
     ------------------------------------------------------------ */

  function cacheElements() {
    el.tableBody = document.getElementById("creators-table-body");
    el.emptyState = document.getElementById("creators-empty");

    el.btnAddCreator = document.getElementById("btn-add-creator");
    el.btnRefresh = document.getElementById("btn-refresh-creators");
    el.btnCancelEdit = document.getElementById("btn-cancel-edit");
    el.btnImport = document.getElementById("btn-import-creators");
    el.btnExport = document.getElementById("btn-export-creators");
    el.importInput = document.getElementById("creators-import-file");

    el.editorPanel = document.getElementById("creator-editor");
    el.editorTitle = document.getElementById("creator-editor-title");
    el.creatorForm = document.getElementById("creator-form");

    el.inputCreatorId = document.getElementById("creator-id");
    el.inputDisplayName = document.getElementById("creator-name");
    el.inputNotes = document.getElementById("creator-notes");
    el.checkboxActive = document.getElementById("creator-active");

    el.checkboxYouTube = document.getElementById("platform-youtube");
    el.checkboxTwitch = document.getElementById("platform-twitch");
    el.checkboxRumble = document.getElementById("platform-rumble");
    el.checkboxDiscord = document.getElementById("platform-discord");

    el.rumbleConfig = document.getElementById("rumble-config");
    el.inputRumbleWatchUrl = document.getElementById("rumble-watch-url");
    el.inputRumbleChannelUrl = document.getElementById("rumble-channel-url");
    el.inputRumbleManualWatchUrl = document.getElementById("rumble-manual-watch-url");
    el.inputRumbleApiEnvKey = document.getElementById("rumble-api-env-key");
  }

  function wireEvents() {
    if (wired) return;

    el.btnAddCreator?.addEventListener("click", () => openEditor());
    el.btnRefresh?.addEventListener("click", () => hydrateCreators(true));
    el.btnCancelEdit?.addEventListener("click", closeEditor);

    el.checkboxRumble?.addEventListener("change", () => {
      if (!el.rumbleConfig) return;
      el.rumbleConfig.classList.toggle(
        "hidden",
        !el.checkboxRumble.checked
      );
    });

    el.creatorForm?.addEventListener("submit", onSubmitCreator);

    wired = true;
  }

  /* ------------------------------------------------------------
     DATA HYDRATION
     ------------------------------------------------------------ */

  async function hydrateCreators(forceReload = false) {
    try {
      creators =
        (await window.ConfigState?.loadCreators({ forceReload })) || [];
    } catch (err) {
      console.warn("[Creators] Failed to load creators, using empty list", err);
      creators = [];
    }

    renderCreators();
  }

  function persistCreators() {
    if (!window.ConfigState?.saveCreators) return;
    creators = window.ConfigState.saveCreators(creators);
  }

  /* ------------------------------------------------------------
     RENDERING
     ------------------------------------------------------------ */

  function renderCreators() {
    if (!el.tableBody) return;
    el.tableBody.innerHTML = "";

    if (!creators.length) {
      el.emptyState?.classList.remove("hidden");
      return;
    }

    el.emptyState?.classList.add("hidden");

    creators.forEach((creator) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${escapeHtml(creator.creator_id)}</td>
        <td>${escapeHtml(creator.display_name || "")}</td>
        <td>${renderPlatforms(creator)}</td>
        <td>${renderStatus(creator)}</td>
        <td>${renderNotes(creator)}</td>
        <td class="align-right">
          <button class="ss-btn ss-btn-small" data-action="edit">Edit</button>
          <button class="ss-btn ss-btn-small ${creator.disabled ? "ss-btn-primary" : "ss-btn-secondary"}" data-action="toggle">
            ${creator.disabled ? "Enable" : "Disable"}
          </button>
        </td>
      `;

      tr.querySelector('[data-action="edit"]')?.addEventListener("click", () => {
        openEditor(creator);
      });

      tr.querySelector('[data-action="toggle"]')?.addEventListener("click", () => {
        toggleCreatorActive(creator.creator_id);
      });

      el.tableBody.appendChild(tr);
    });
  }

  function renderPlatforms(creator) {
    const flags = creator.platforms_enabled || {};
    const enabled = PLATFORM_KEYS.filter((key) => flags[key]);
    return enabled.length ? enabled.join(", ") : "—";
  }

  function renderStatus(creator) {
    return creator.disabled
      ? '<span class="muted">Disabled</span>'
      : '<span class="status-pill success">Active</span>';
  }

  function renderNotes(creator) {
    if (!creator.notes) return "—";
    return `<span class="muted">${escapeHtml(creator.notes)}</span>`;
  }

  /* ------------------------------------------------------------
     EDITOR PANEL
     ------------------------------------------------------------ */

  function openEditor(creator = null) {
    el.editorPanel?.classList.remove("hidden");

    if (creator) {
      editingCreatorId = creator.creator_id;
      el.editorTitle.textContent = "Edit Creator";

      el.inputCreatorId.value = creator.creator_id;
      el.inputCreatorId.disabled = true;

      el.inputDisplayName.value = creator.display_name || "";
      el.inputNotes.value = creator.notes || "";
      el.checkboxActive.checked = creator.disabled !== true;

      setPlatformCheckboxes(creator.platforms_enabled);

      const rumble = creator.platforms?.rumble;
      el.checkboxRumble.checked = !!rumble?.enabled;
      el.rumbleConfig?.classList.toggle("hidden", !el.checkboxRumble.checked);
      el.inputRumbleWatchUrl.value = rumble?.watch_url || "";

      el.inputRumbleChannelUrl.value = creator.rumble_channel_url || "";
      el.inputRumbleManualWatchUrl.value =
        creator.rumble_manual_watch_url || "";
      el.inputRumbleApiEnvKey.value =
        creator.rumble_livestream_api_env_key || "";
    } else {
      editingCreatorId = null;
      el.editorTitle.textContent = "Add Creator";
      el.creatorForm?.reset();
      el.inputCreatorId.disabled = false;
      el.checkboxActive.checked = true;
      setPlatformCheckboxes(null);
      el.rumbleConfig?.classList.add("hidden");
    }
  }

  function closeEditor() {
    el.editorPanel?.classList.add("hidden");
    el.creatorForm?.reset();
    editingCreatorId = null;
  }

  function setPlatformCheckboxes(platformsEnabled) {
    const flags = platformsEnabled || {};
    el.checkboxYouTube.checked = !!flags.youtube;
    el.checkboxTwitch.checked = !!flags.twitch;
    el.checkboxRumble.checked = !!flags.rumble;
    el.checkboxDiscord.checked = !!flags.discord;
  }

  /* ------------------------------------------------------------
     SAVE / SOFT DISABLE
     ------------------------------------------------------------ */

  function onSubmitCreator(event) {
    event.preventDefault();

    const formData = readForm();
    if (!formData) return;

    const idx = creators.findIndex((c) => c.creator_id === formData.creator_id);

    if (idx >= 0) {
      creators[idx] = formData;
    } else {
      creators.push(formData);
    }

    persistCreators();
    closeEditor();
    renderCreators();
  }

  function readForm() {
    const creatorId = el.inputCreatorId?.value.trim();
    if (!creatorId) return null;

    const platformsEnabled = {
      youtube: el.checkboxYouTube.checked,
      twitch: el.checkboxTwitch.checked,
      rumble: el.checkboxRumble.checked,
      discord: el.checkboxDiscord.checked
    };

    const payload = {
      creator_id: creatorId,
      display_name: el.inputDisplayName?.value.trim() || creatorId,
      notes: el.inputNotes?.value.trim() || "",
      disabled: !el.checkboxActive.checked,
      tier: ADMIN_DEFAULT_TIER,
      platforms_enabled: platformsEnabled,
      platforms: {
        youtube: { enabled: platformsEnabled.youtube },
        twitch: { enabled: platformsEnabled.twitch },
        rumble: {
          enabled: platformsEnabled.rumble,
          watch_url: el.inputRumbleWatchUrl?.value.trim() || ""
        },
        discord: { enabled: platformsEnabled.discord }
      }
    };

    if (el.inputRumbleChannelUrl?.value.trim()) {
      payload.rumble_channel_url = el.inputRumbleChannelUrl.value.trim();
    }

    if (el.inputRumbleManualWatchUrl?.value.trim()) {
      payload.rumble_manual_watch_url =
        el.inputRumbleManualWatchUrl.value.trim();
    }

    if (el.inputRumbleApiEnvKey?.value.trim()) {
      payload.rumble_livestream_api_env_key =
        el.inputRumbleApiEnvKey.value.trim();
    }

    const existing = creators.find((c) => c.creator_id === creatorId);
    if (existing?.limits) payload.limits = existing.limits;
    if (existing?.tier) payload.tier = existing.tier;

    return payload;
  }

  function toggleCreatorActive(creatorId) {
    const idx = creators.findIndex((c) => c.creator_id === creatorId);
    if (idx === -1) return;

    creators[idx].disabled = !creators[idx].disabled;
    persistCreators();
    renderCreators();
  }

  /* ------------------------------------------------------------
     IMPORT / EXPORT
     ------------------------------------------------------------ */

  function exportCreators() {
    window.ConfigState?.exportCreatorsFile?.(creators);
  }

  function importCreatorsFromFile(file, onError) {
    App.storage.importJsonFromFile(file)
      .then((data) => {
        try {
          const payload = data?.payload ?? data;
          const imported =
            window.ConfigState?.applyCreatorsImport?.(payload);
          if (!imported) throw new Error("Invalid creators payload");
          creators = imported;
          renderCreators();
        } catch (err) {
          console.error("[Creators] Import failed", err);
          onError?.("Invalid creators file structure");
        }
      })
      .catch((err) => {
        console.error("[Creators] Import failed", err);
        onError?.("Failed to import file");
      });
  }

  /* ------------------------------------------------------------
     UTILS
     ------------------------------------------------------------ */

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* ------------------------------------------------------------
     PUBLIC API (for view wiring)
     ------------------------------------------------------------ */

  window.CreatorsView = {
    init,
    destroy,
    exportCreators,
    importCreatorsFromFile
  };

})();

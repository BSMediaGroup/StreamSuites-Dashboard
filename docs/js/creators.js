/* ============================================================
   StreamSuites Dashboard — creators.js
   ============================================================

   Responsibilities:
   - Manage creator records (UI-side)
   - Populate creators table
   - Handle add/edit/delete flows
   - Toggle platform-specific config blocks
   - Prepare data for future API / file persistence

   This file is SAFE for:
   - GitHub Pages
   - iframe embedding (Wix)
   - later backend replacement

   ============================================================ */

(() => {
  "use strict";

  /* ------------------------------------------------------------
     CONSTANTS
     ------------------------------------------------------------ */

  const STORAGE_KEY = "creators";

  /* ------------------------------------------------------------
     DOM REFERENCES
     ------------------------------------------------------------ */

  const tableBody = document.getElementById("creators-table-body");
  const emptyState = document.getElementById("creators-empty");

  const btnAddCreator = document.getElementById("btn-add-creator");
  const btnRefresh = document.getElementById("btn-refresh-creators");
  const btnCancelEdit = document.getElementById("btn-cancel-edit");

  const editorPanel = document.getElementById("creator-editor");
  const editorTitle = document.getElementById("creator-editor-title");
  const creatorForm = document.getElementById("creator-form");

  const inputCreatorId = document.getElementById("creator-id");
  const inputDisplayName = document.getElementById("creator-name");

  const checkboxRumble = document.getElementById("platform-rumble");
  const rumbleConfig = document.getElementById("rumble-config");
  const inputRumbleWatchUrl = document.getElementById("rumble-watch-url");

  /* ------------------------------------------------------------
     ADDITIVE: ADVANCED / ADMIN FIELDS (NO UI YET)
     ------------------------------------------------------------ */

  // These fields are intentionally NOT exposed in the UI yet.
  // They are persisted so the dashboard becomes the source of truth.
  //
  // Future UI will surface these behind an admin gate.

  const ADMIN_DEFAULT_TIER = "open";

  /* ------------------------------------------------------------
     STATE
     ------------------------------------------------------------ */

  /** @type {Array<Object>} */
  let creators = [];

  /** @type {string|null} */
  let editingCreatorId = null;

  /* ------------------------------------------------------------
     INIT
     ------------------------------------------------------------ */

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    wireEvents();
    loadCreators();
    renderCreators();
  }

  /* ------------------------------------------------------------
     EVENT WIRING
     ------------------------------------------------------------ */

  function wireEvents() {
    btnAddCreator.addEventListener("click", () => openEditor());
    btnRefresh.addEventListener("click", renderCreators);
    btnCancelEdit.addEventListener("click", closeEditor);

    checkboxRumble.addEventListener("change", () => {
      rumbleConfig.classList.toggle("hidden", !checkboxRumble.checked);
    });

    creatorForm.addEventListener("submit", onSubmitCreator);
  }

  /* ------------------------------------------------------------
     DATA LOADING / PERSISTENCE
     ------------------------------------------------------------ */

  function loadCreators() {
    const stored = App.storage.loadFromLocalStorage(STORAGE_KEY, []);
    creators = Array.isArray(stored) ? stored : [];
  }

  function persistCreators() {
    App.storage.saveToLocalStorage(STORAGE_KEY, creators);
  }

  /* ------------------------------------------------------------
     RENDERING
     ------------------------------------------------------------ */

  function renderCreators() {
    tableBody.innerHTML = "";

    if (!creators.length) {
      emptyState.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");

    creators.forEach((creator) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${escapeHtml(creator.creator_id)}</td>
        <td>${escapeHtml(creator.display_name || "")}</td>
        <td>${renderPlatforms(creator)}</td>
        <td>${renderStatus(creator)}</td>
        <td class="align-right">
          <button class="ss-btn ss-btn-small" data-action="edit">Edit</button>
          <button class="ss-btn ss-btn-small ss-btn-danger" data-action="delete">Delete</button>
        </td>
      `;

      tr.querySelector('[data-action="edit"]').addEventListener("click", () => {
        openEditor(creator);
      });

      tr.querySelector('[data-action="delete"]').addEventListener("click", () => {
        deleteCreator(creator.creator_id);
      });

      tableBody.appendChild(tr);
    });
  }

  function renderPlatforms(creator) {
    const platforms = [];

    if (creator.platforms?.rumble?.enabled) platforms.push("Rumble");
    if (creator.platforms?.youtube?.enabled) platforms.push("YouTube");
    if (creator.platforms?.twitch?.enabled) platforms.push("Twitch");

    return platforms.length ? platforms.join(", ") : "—";
  }

  function renderStatus(_creator) {
    return `<span class="muted">Idle</span>`;
  }

  /* ------------------------------------------------------------
     EDITOR PANEL
     ------------------------------------------------------------ */

  function openEditor(creator = null) {
    editorPanel.classList.remove("hidden");

    if (creator) {
      editingCreatorId = creator.creator_id;
      editorTitle.textContent = "Edit Creator";

      inputCreatorId.value = creator.creator_id;
      inputCreatorId.disabled = true;

      inputDisplayName.value = creator.display_name || "";

      const rumble = creator.platforms?.rumble;
      checkboxRumble.checked = !!rumble?.enabled;
      rumbleConfig.classList.toggle("hidden", !checkboxRumble.checked);
      inputRumbleWatchUrl.value = rumble?.watch_url || "";

    } else {
      editingCreatorId = null;
      editorTitle.textContent = "Add Creator";
      creatorForm.reset();

      inputCreatorId.disabled = false;
      rumbleConfig.classList.add("hidden");
    }
  }

  function closeEditor() {
    editorPanel.classList.add("hidden");
    creatorForm.reset();
    editingCreatorId = null;
  }

  /* ------------------------------------------------------------
     SAVE / DELETE
     ------------------------------------------------------------ */

  function onSubmitCreator(event) {
    event.preventDefault();

    const creatorId = inputCreatorId.value.trim();
    if (!creatorId) return;

    const payload = {
      creator_id: creatorId,
      display_name: inputDisplayName.value.trim(),
      tier: ADMIN_DEFAULT_TIER, // admin-controlled, persisted
      platforms: {}
    };

    if (checkboxRumble.checked) {
      payload.platforms.rumble = {
        enabled: true,
        watch_url: inputRumbleWatchUrl.value.trim()
      };
    }

    if (editingCreatorId) {
      const idx = creators.findIndex(c => c.creator_id === editingCreatorId);
      if (idx !== -1) {
        payload.tier = creators[idx].tier || ADMIN_DEFAULT_TIER;
        creators[idx] = payload;
      }
    } else {
      creators.push(payload);
    }

    persistCreators();
    closeEditor();
    renderCreators();
  }

  function deleteCreator(creatorId) {
    if (!confirm(`Delete creator "${creatorId}"?`)) return;
    creators = creators.filter(c => c.creator_id !== creatorId);
    persistCreators();
    renderCreators();
  }

  /* ------------------------------------------------------------
     IMPORT / EXPORT (LOGIC ONLY)
     ------------------------------------------------------------ */

  function exportCreators() {
    App.storage.exportJsonToDownload("streamsuites-creators.json", creators);
  }

  function importCreatorsFromFile(file, onError) {
    App.storage.importJsonFromFile(file)
      .then((data) => {
        if (!validateCreatorsPayload(data)) {
          onError?.("Invalid creators file structure");
          return;
        }
        creators = data;
        persistCreators();
        renderCreators();
      })
      .catch((err) => {
        console.error("[Creators] Import failed", err);
        onError?.("Failed to import file");
      });
  }

  /* ------------------------------------------------------------
     LIGHTWEIGHT SCHEMA VALIDATION
     ------------------------------------------------------------ */

  function validateCreatorsPayload(data) {
    if (!Array.isArray(data)) return false;

    return data.every((c) => {
      if (typeof c !== "object") return false;
      if (typeof c.creator_id !== "string") return false;
      if ("display_name" in c && typeof c.display_name !== "string") return false;
      if ("platforms" in c && typeof c.platforms !== "object") return false;
      if ("tier" in c && typeof c.tier !== "string") return false;
      return true;
    });
  }

  /* ------------------------------------------------------------
     UTILS
     ------------------------------------------------------------ */

  function escapeHtml(str) {
    return String(str)
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
    exportCreators,
    importCreatorsFromFile
  };

})();

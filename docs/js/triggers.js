/* ============================================================
   StreamSuites Dashboard — triggers.js
   ============================================================

   Responsibilities:
   - Manage chat trigger rules
   - Import / Export chat_behaviour.json
   - Persist state via App.storage
   - Match runtime trigger schema EXACTLY

   Runtime target:
   shared/config/chat_behaviour.json

   ============================================================ */

(() => {
  "use strict";

  /* ------------------------------------------------------------
     CONSTANTS
     ------------------------------------------------------------ */

  const STORAGE_KEY = "chat_behaviour";

  /* ------------------------------------------------------------
     DOM REFERENCES
     ------------------------------------------------------------ */

  const tableBody = document.getElementById("triggers-table-body");
  const emptyState = document.getElementById("triggers-empty");

  const editorPanel = document.getElementById("trigger-editor");
  const editorTitle = document.getElementById("trigger-editor-title");

  const form = document.getElementById("trigger-form");
  const inputMatch = document.getElementById("trigger-match");
  const inputMatchMode = document.getElementById("trigger-match-mode");
  const inputResponse = document.getElementById("trigger-response");
  const inputCooldown = document.getElementById("trigger-cooldown");

  const btnAdd = document.getElementById("btn-add-trigger");
  const btnCancel = document.getElementById("btn-cancel-trigger");
  const btnRefresh = document.getElementById("btn-refresh-triggers");

  /* ------------------------------------------------------------
     STATE
     ------------------------------------------------------------ */

  let triggers = [];
  let editIndex = null;

  /* ------------------------------------------------------------
     INIT
     ------------------------------------------------------------ */

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    wireEvents();
    loadTriggers();
    renderTriggers();
    hideEditor();
  }

  /* ------------------------------------------------------------
     EVENTS
     ------------------------------------------------------------ */

  function wireEvents() {
    btnAdd.addEventListener("click", () => {
      resetForm();
      showEditor("Add Trigger");
    });

    btnCancel.addEventListener("click", hideEditor);

    btnRefresh.addEventListener("click", () => {
      loadTriggers();
      renderTriggers();
    });

    tableBody.addEventListener("click", onTableClick);
    form.addEventListener("submit", onSubmit);
  }

  /* ------------------------------------------------------------
     LOAD / SAVE (SHARED STORAGE)
     ------------------------------------------------------------ */

  function loadTriggers() {
    const data = App.storage.loadFromLocalStorage(STORAGE_KEY, null);

    if (data && Array.isArray(data.triggers)) {
      triggers = data.triggers;
    } else {
      triggers = [];
    }
  }

  function saveTriggers() {
    const payload = {
      poll_seconds: 2,
      send_cooldown_seconds: 0.75,
      startup_announcement: "🤖 StreamSuites bot online",
      enable_startup_announcement: true,
      baseline_mode: "latest_seen",
      baseline_grace_seconds: 0,
      triggers: triggers
    };

    App.storage.saveToLocalStorage(STORAGE_KEY, payload);
  }

  /* ------------------------------------------------------------
     IMPORT / EXPORT
     ------------------------------------------------------------ */

  function exportTriggers() {
    const payload = App.storage.loadFromLocalStorage(STORAGE_KEY, {
      triggers
    });

    App.storage.exportJsonToDownload("chat_behaviour.json", payload);
  }

  function importTriggersFromFile(file, onError) {
    App.storage.importJsonFromFile(file)
      .then((data) => {
        if (!validateChatBehaviour(data)) {
          onError?.("Invalid chat_behaviour.json structure");
          return;
        }

        triggers = data.triggers;
        saveTriggers();
        renderTriggers();
      })
      .catch((err) => {
        console.error("[Triggers] Import failed", err);
        onError?.("Failed to import file");
      });
  }

  /* ------------------------------------------------------------
     RENDERING
     ------------------------------------------------------------ */

  function renderTriggers() {
    tableBody.innerHTML = "";

    if (!triggers.length) {
      emptyState.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");

    triggers.forEach((trig, index) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${escapeHtml(trig.match)}</td>
        <td>${escapeHtml(trig.match_mode)}</td>
        <td>${escapeHtml(trig.response)}</td>
        <td>${trig.cooldown_seconds ?? ""}</td>
        <td class="align-right">
          <button class="ss-btn ss-btn-small" data-edit="${index}">Edit</button>
          <button class="ss-btn ss-btn-small ss-btn-danger" data-delete="${index}">Delete</button>
        </td>
      `;

      tableBody.appendChild(row);
    });
  }

  /* ------------------------------------------------------------
     EDITOR
     ------------------------------------------------------------ */

  function showEditor(title) {
    editorTitle.textContent = title;
    editorPanel.classList.remove("hidden");
  }

  function hideEditor() {
    editorPanel.classList.add("hidden");
    resetForm();
  }

  function resetForm() {
    form.reset();
    editIndex = null;
  }

  /* ------------------------------------------------------------
     TABLE ACTIONS
     ------------------------------------------------------------ */

  function onTableClick(e) {
    const editBtn = e.target.closest("[data-edit]");
    const deleteBtn = e.target.closest("[data-delete]");

    if (editBtn) {
      const idx = Number(editBtn.dataset.edit);
      const trig = triggers[idx];
      if (!trig) return;

      editIndex = idx;
      inputMatch.value = trig.match;
      inputMatchMode.value = trig.match_mode;
      inputResponse.value = trig.response;
      inputCooldown.value = trig.cooldown_seconds ?? "";

      showEditor("Edit Trigger");
    }

    if (deleteBtn) {
      const idx = Number(deleteBtn.dataset.delete);
      if (!confirm("Delete this trigger?")) return;

      triggers.splice(idx, 1);
      saveTriggers();
      renderTriggers();
    }
  }

  /* ------------------------------------------------------------
     SUBMIT
     ------------------------------------------------------------ */

  function onSubmit(e) {
    e.preventDefault();

    const match = inputMatch.value.trim();
    const matchMode = inputMatchMode.value;
    const response = inputResponse.value.trim();
    const cooldownRaw = inputCooldown.value.trim();

    if (!match || !response) {
      return;
    }

    const trigger = {
      match,
      match_mode: matchMode,
      response
    };

    if (cooldownRaw !== "") {
      const cd = Number(cooldownRaw);
      if (!isNaN(cd)) {
        trigger.cooldown_seconds = cd;
      }
    }

    if (editIndex !== null) {
      triggers[editIndex] = trigger;
    } else {
      triggers.push(trigger);
    }

    saveTriggers();
    renderTriggers();
    hideEditor();
  }

  /* ------------------------------------------------------------
     VALIDATION (LIGHTWEIGHT)
     ------------------------------------------------------------ */

  function validateChatBehaviour(data) {
    if (!data || typeof data !== "object") return false;
    if (!Array.isArray(data.triggers)) return false;

    return data.triggers.every((t) => {
      if (typeof t.match !== "string") return false;
      if (typeof t.match_mode !== "string") return false;
      if (typeof t.response !== "string") return false;
      if ("cooldown_seconds" in t && typeof t.cooldown_seconds !== "number") return false;
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
     PUBLIC API
     ------------------------------------------------------------ */

  window.TriggersView = {
    init,
    exportTriggers,
    importTriggersFromFile
  };

})();

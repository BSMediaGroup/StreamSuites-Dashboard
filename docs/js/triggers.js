/* ============================================================
   StreamSuites Dashboard — triggers.js
   ============================================================

   Responsibilities:
   - Render and edit creator-scoped triggers from runtime snapshot
   - Export admin-safe triggers.json (no live effects)
   - Persist drafts locally for a single creator

   Runtime target:
   docs/shared/state/admin/triggers.json

   ============================================================ */

(() => {
  "use strict";

  /* ------------------------------------------------------------
     CONSTANTS
     ------------------------------------------------------------ */

  const STORAGE_KEY = "triggers.admin.draft";
  const MATCH_MODES = ["equals_icase", "contains_icase"];

  /* ------------------------------------------------------------
     DOM REFERENCES
     ------------------------------------------------------------ */

  const bannerNotice = document.getElementById("triggers-banner");
  const runtimeState = document.getElementById("triggers-runtime-state");
  const runtimeMissing = document.getElementById("triggers-runtime-missing");
  const runtimeActionsMissing = document.getElementById("triggers-actions-missing");
  const saveNotice = document.getElementById("triggers-save-notice");
  const messageBox = document.getElementById("triggers-message");
  const creatorLabel = document.getElementById("triggers-creator-label");
  const snapshotLabel = document.getElementById("triggers-snapshot-label");

  const tableBody = document.getElementById("triggers-table-body");
  const emptyState = document.getElementById("triggers-empty");

  const editorPanel = document.getElementById("trigger-editor");
  const editorTitle = document.getElementById("trigger-editor-title");
  const editorCreator = document.getElementById("trigger-editor-creator");

  const form = document.getElementById("trigger-form");
  const inputEnabled = document.getElementById("trigger-enabled");
  const inputMatch = document.getElementById("trigger-match");
  const inputMatchMode = document.getElementById("trigger-match-mode");
  const inputAction = document.getElementById("trigger-action");

  const btnAdd = document.getElementById("btn-add-trigger");
  const btnCancel = document.getElementById("btn-cancel-trigger");
  const btnRefresh = document.getElementById("btn-refresh-triggers");
  const btnSave = document.getElementById("btn-save-triggers");

  /* ------------------------------------------------------------
     STATE
     ------------------------------------------------------------ */

  let availableActions = [];
  let triggers = [];
  let currentCreator = null;
  let editIndex = null;
  let snapshotGeneratedAt = null;

  /* ------------------------------------------------------------
     INIT
     ------------------------------------------------------------ */

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    wireEvents();
    hideEditor();
    hydrateFromRuntime();
    renderBanner();
  }

  /* ------------------------------------------------------------
     EVENTS
     ------------------------------------------------------------ */

  function wireEvents() {
    btnAdd?.addEventListener("click", onAddTrigger);
    btnCancel?.addEventListener("click", hideEditor);
    btnRefresh?.addEventListener("click", () => hydrateFromRuntime(true));
    btnSave?.addEventListener("click", onSaveDraft);

    tableBody?.addEventListener("click", onTableClick);
    form?.addEventListener("submit", onSubmit);
  }

  /* ------------------------------------------------------------
     LOAD FROM RUNTIME SNAPSHOT
     ------------------------------------------------------------ */

  async function hydrateFromRuntime(forceReload = false) {
    setMessage("", false);
    saveNotice?.classList.add("hidden");

    const snapshot = await ConfigState.loadRuntimeSnapshot({ forceReload });
    const adminTriggers = snapshot?.triggers;

    if (!adminTriggers) {
      renderRuntimeMissing("Runtime not reporting triggers");
      return;
    }

    availableActions = (adminTriggers.actions || []).filter((action) =>
      typeof action?.id === "string" && action.id.trim() !== ""
    );

    snapshotGeneratedAt = adminTriggers.generatedAt || snapshot?.generatedAt || null;

    if (!availableActions.length) {
      renderRuntimeMissing("Runtime not reporting trigger actions", true);
      return;
    }

    const creator = pickCreator(adminTriggers.creators);
    if (!creator) {
      renderRuntimeMissing("Runtime not reporting triggers for any creator");
      return;
    }

    currentCreator = creator;
    populateActionSelect();
    renderRuntimeMeta();

    const draft = loadDraftForCreator(creator.creator_id);
    triggers = sanitizeTriggers(draft.length ? draft : creator.triggers || []);

    renderTriggers();
    hideEditor();
  }

  function pickCreator(list) {
    if (!Array.isArray(list) || !list.length) return null;
    const creator = list[0];
    if (typeof creator?.creator_id !== "string") return null;
    return {
      creator_id: creator.creator_id.trim(),
      display_name:
        typeof creator.display_name === "string" && creator.display_name.trim()
          ? creator.display_name.trim()
          : creator.creator_id,
      triggers: Array.isArray(creator.triggers) ? creator.triggers : []
    };
  }

  function sanitizeTriggers(list) {
    const actionIds = new Set(availableActions.map((a) => a.id));
    const seenIds = new Set();

    return (list || [])
      .map((entry, idx) => {
        const match = typeof entry?.match === "string" ? entry.match.trim() : "";
        const action = typeof entry?.action === "string" ? entry.action.trim() : "";
        if (!match || !actionIds.has(action)) return null;

        const matchMode = MATCH_MODES.includes(entry.match_mode)
          ? entry.match_mode
          : "equals_icase";

        const idBase =
          typeof entry?.id === "string" && entry.id.trim()
            ? entry.id.trim()
            : `${slugify(match)}-${idx + 1}`;

        const id = seenIds.has(idBase) ? `${idBase}-${idx + 1}` : idBase;
        seenIds.add(id);

        return {
          id,
          creator_id: currentCreator?.creator_id || entry.creator_id || "",
          enabled: entry.enabled !== false,
          match,
          match_mode: matchMode,
          action,
          notes:
            typeof entry.notes === "string" && entry.notes.trim()
              ? entry.notes.trim()
              : undefined
        };
      })
      .filter(Boolean);
  }

  /* ------------------------------------------------------------
     RENDERING
     ------------------------------------------------------------ */

  function renderBanner() {
    if (!bannerNotice) return;
    bannerNotice.textContent =
      "Triggers are evaluated at runtime startup. Restart StreamSuites to apply changes.";
  }

  function renderRuntimeMeta() {
    runtimeMissing?.classList.add("hidden");
    runtimeActionsMissing?.classList.add("hidden");
    btnAdd?.removeAttribute("disabled");
    btnSave?.removeAttribute("disabled");

    if (creatorLabel) {
      creatorLabel.textContent = currentCreator?.display_name || "—";
    }

    if (snapshotLabel) {
      snapshotLabel.textContent = formatTimestampDisplay(snapshotGeneratedAt);
    }

    if (runtimeState) {
      runtimeState.classList.remove("hidden");
      runtimeState.textContent = `Loaded from runtime snapshot for ${
        currentCreator?.display_name || "creator"
      }.`;
    }
  }

  function renderRuntimeMissing(message, missingActions = false) {
    btnAdd?.setAttribute("disabled", "disabled");
    btnSave?.setAttribute("disabled", "disabled");

    if (runtimeMissing) {
      runtimeMissing.textContent = message || "Runtime not reporting triggers";
      runtimeMissing.classList.remove("hidden");
    }

    if (missingActions && runtimeActionsMissing) {
      runtimeActionsMissing.classList.remove("hidden");
    }

    if (runtimeState) {
      runtimeState.classList.add("hidden");
    }

    tableBody.innerHTML = "";
    emptyState?.classList.add("hidden");
  }

  function renderTriggers() {
    tableBody.innerHTML = "";

    if (!Array.isArray(triggers) || !triggers.length) {
      emptyState?.classList.remove("hidden");
      return;
    }

    emptyState?.classList.add("hidden");

    triggers.forEach((trig, index) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${trig.enabled ? "Enabled" : "Disabled"}</td>
        <td>${escapeHtml(trig.match)}</td>
        <td>${escapeHtml(formatMatchMode(trig.match_mode))}</td>
        <td>${escapeHtml(resolveActionLabel(trig.action))}</td>
        <td>${escapeHtml(currentCreator?.display_name || trig.creator_id || "")}</td>
        <td class="align-right">
          <button class="ss-btn ss-btn-small" data-edit="${index}">Edit</button>
          <button class="ss-btn ss-btn-small ss-btn-danger" data-delete="${index}">Delete</button>
        </td>
      `;

      tableBody.appendChild(row);
    });
  }

  function formatMatchMode(mode) {
    if (mode === "contains_icase") return "Contains (case-insensitive)";
    return "Equals (case-insensitive)";
  }

  function resolveActionLabel(actionId) {
    const found = availableActions.find((a) => a.id === actionId);
    return found?.label || actionId || "";
  }

  /* ------------------------------------------------------------
     EDITOR
     ------------------------------------------------------------ */

  function onAddTrigger() {
    if (!currentCreator) return;
    resetForm();
    showEditor("Add Trigger");
  }

  function showEditor(title) {
    editorTitle.textContent = title;
    editorCreator.textContent = currentCreator?.display_name || "";
    editorPanel.classList.remove("hidden");
  }

  function hideEditor() {
    editorPanel.classList.add("hidden");
    resetForm();
  }

  function resetForm() {
    form.reset();
    editIndex = null;
    inputEnabled.checked = true;
    inputMatchMode.value = MATCH_MODES[0];
  }

  function onTableClick(e) {
    const editBtn = e.target.closest("[data-edit]");
    const deleteBtn = e.target.closest("[data-delete]");

    if (editBtn) {
      const idx = Number(editBtn.dataset.edit);
      const trig = triggers[idx];
      if (!trig) return;

      editIndex = idx;
      inputEnabled.checked = trig.enabled !== false;
      inputMatch.value = trig.match;
      inputMatchMode.value = MATCH_MODES.includes(trig.match_mode)
        ? trig.match_mode
        : MATCH_MODES[0];
      inputAction.value = trig.action;

      showEditor("Edit Trigger");
    }

    if (deleteBtn) {
      const idx = Number(deleteBtn.dataset.delete);
      if (!confirm("Delete this trigger?")) return;

      triggers.splice(idx, 1);
      persistDraft();
      renderTriggers();
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    setMessage("", false);

    const match = inputMatch.value.trim();
    const matchMode = MATCH_MODES.includes(inputMatchMode.value)
      ? inputMatchMode.value
      : MATCH_MODES[0];
    const action = inputAction.value;
    const enabled = inputEnabled.checked;

    if (!match) {
      setMessage("Match pattern is required", true);
      return;
    }

    if (!availableActions.find((a) => a.id === action)) {
      setMessage("Select a valid action", true);
      return;
    }

    const trigger = {
      id:
        editIndex !== null && triggers[editIndex]
          ? triggers[editIndex].id
          : generateTriggerId(match),
      creator_id: currentCreator?.creator_id || "",
      enabled,
      match,
      match_mode: matchMode,
      action,
      notes:
        editIndex !== null && triggers[editIndex]?.notes
          ? triggers[editIndex].notes
          : undefined
    };

    if (editIndex !== null) {
      triggers[editIndex] = trigger;
    } else {
      triggers.push(trigger);
    }

    persistDraft();
    renderTriggers();
    hideEditor();
    setMessage("Trigger saved to draft. Export to apply on next restart.", false);
  }

  /* ------------------------------------------------------------
     SAVE / EXPORT
     ------------------------------------------------------------ */

  function onSaveDraft() {
    if (!currentCreator) return;

    const payload = buildExportPayload();
    persistDraft();

    App.storage.downloadJson("shared/state/admin/triggers.json", payload);
    saveNotice?.classList.remove("hidden");
    saveNotice.textContent = "Trigger changes apply on next runtime restart.";
  }

  function buildExportPayload() {
    return {
      schema: "streamsuites.triggers.admin.v1",
      generated_at: new Date().toISOString(),
      actions: availableActions,
      creators: [
        {
          creator_id: currentCreator?.creator_id || "",
          display_name: currentCreator?.display_name || "",
          triggers: sanitizeTriggers(triggers)
        }
      ]
    };
  }

  function persistDraft() {
    if (!currentCreator) return;
    const drafts = App.storage.loadFromLocalStorage(STORAGE_KEY, {});
    drafts[currentCreator.creator_id] = sanitizeTriggers(triggers);
    App.storage.saveToLocalStorage(STORAGE_KEY, drafts);
  }

  function loadDraftForCreator(creatorId) {
    if (!creatorId) return [];
    const drafts = App.storage.loadFromLocalStorage(STORAGE_KEY, {});
    const draftList = drafts?.[creatorId];
    return Array.isArray(draftList) ? draftList : [];
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

  function formatTimestampDisplay(timestamp) {
    if (!timestamp) return "unknown time";
    try {
      const parsed = new Date(timestamp);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString(undefined, { hour12: false });
      }
    } catch (err) {
      console.warn("[Triggers] Failed to format timestamp", err);
    }
    return timestamp;
  }

  function slugify(str) {
    return String(str)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
      .slice(0, 32) || "trigger";
  }

  function generateTriggerId(match) {
    const base = slugify(match);
    const existing = new Set(triggers.map((t) => t.id));
    let candidate = base;
    let counter = 1;
    while (existing.has(candidate)) {
      candidate = `${base}-${counter++}`;
    }
    return candidate;
  }

  function setMessage(msg, isError) {
    if (!messageBox) return;
    if (!msg) {
      messageBox.classList.add("hidden");
      messageBox.textContent = "";
      return;
    }
    messageBox.textContent = msg;
    messageBox.classList.toggle("ss-alert-danger", !!isError);
    messageBox.classList.remove("hidden");
  }

  function populateActionSelect() {
    if (!inputAction) return;
    inputAction.innerHTML = "";
    availableActions.forEach((action) => {
      const opt = document.createElement("option");
      opt.value = action.id;
      opt.textContent = action.label || action.id;
      inputAction.appendChild(opt);
    });
  }

  /* ------------------------------------------------------------
     PUBLIC API
     ------------------------------------------------------------ */

  window.TriggersView = {
    init,
    destroy: hideEditor
  };
})();

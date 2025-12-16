/* ============================================================
   StreamSuites Dashboard — Triggers UI
   Temporary localStorage-backed implementation
   ============================================================ */

const STORAGE_KEY = "streamsuites.chat.triggers";

/* ------------------------------------------------------------
   DOM references
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
   State
------------------------------------------------------------ */

let triggers = [];
let editIndex = null;

/* ------------------------------------------------------------
   Utilities
------------------------------------------------------------ */

function loadTriggers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.error("Failed to load triggers:", err);
    return [];
  }
}

function saveTriggers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(triggers, null, 2));
}

function resetForm() {
  form.reset();
  editIndex = null;
}

function showEditor(title) {
  editorTitle.textContent = title;
  editorPanel.classList.remove("hidden");
}

function hideEditor() {
  editorPanel.classList.add("hidden");
  resetForm();
}

/* ------------------------------------------------------------
   Rendering
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
   Event handlers
------------------------------------------------------------ */

btnAdd.addEventListener("click", () => {
  resetForm();
  showEditor("Add Trigger");
});

btnCancel.addEventListener("click", () => {
  hideEditor();
});

btnRefresh.addEventListener("click", () => {
  triggers = loadTriggers();
  renderTriggers();
});

tableBody.addEventListener("click", (e) => {
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
    inputCooldown.value =
      trig.cooldown_seconds !== undefined ? trig.cooldown_seconds : "";

    showEditor("Edit Trigger");
  }

  if (deleteBtn) {
    const idx = Number(deleteBtn.dataset.delete);
    if (!confirm("Delete this trigger?")) return;

    triggers.splice(idx, 1);
    saveTriggers();
    renderTriggers();
  }
});

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const match = inputMatch.value.trim();
  const matchMode = inputMatchMode.value;
  const response = inputResponse.value.trim();
  const cooldownRaw = inputCooldown.value.trim();

  if (!match || !response) {
    alert("Match and response are required.");
    return;
  }

  const trigger = {
    match: match,
    match_mode: matchMode,
    response: response
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
});

/* ------------------------------------------------------------
   Helpers
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
   Init
------------------------------------------------------------ */

function init() {
  triggers = loadTriggers();
  renderTriggers();
  hideEditor();
}

init();

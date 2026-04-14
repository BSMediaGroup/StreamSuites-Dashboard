(() => {
  "use strict";

  const state = {
    creators: [],
    selectedUserCode: "",
    detail: null,
    editTriggerId: null,
    abortController: null,
    initialized: false,
  };

  const el = {};

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    if (value === undefined || value === null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resolveApiBase() {
    const base =
      window.StreamSuitesAdminAuth?.config?.baseUrl ||
      document.querySelector('meta[name="streamsuites-auth-base"]')?.getAttribute("content") ||
      "";
    return base ? String(base).replace(/\/+$/, "") : "";
  }

  function buildApiUrl(path) {
    const base = resolveApiBase();
    if (!base) return path;
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${base}${normalized}`;
  }

  async function requestJson(path, options = {}) {
    const response = await fetch(buildApiUrl(path), {
      cache: "no-store",
      credentials: "include",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const payload = await readJsonSafe(response);
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
    }
    return payload || {};
  }

  async function readJsonSafe(response) {
    try {
      return await response.json();
    } catch (_err) {
      return null;
    }
  }

  function formatTimestamp(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, {
      hour12: false,
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function setBanner(message, tone = "") {
    if (!(el.banner instanceof HTMLElement)) return;
    el.banner.textContent = message || "";
    el.banner.className = "ss-alert";
    if (message) {
      if (tone === "danger" || tone === "warning") el.banner.classList.add("ss-alert-danger");
      if (tone === "success") el.banner.classList.add("ss-alert-success");
    }
  }

  function setMessage(message, tone = "") {
    if (!(el.message instanceof HTMLElement)) return;
    if (!message) {
      el.message.classList.add("hidden");
      el.message.textContent = "";
      return;
    }
    el.message.className = "ss-alert";
    if (tone === "danger" || tone === "warning") el.message.classList.add("ss-alert-danger");
    if (tone === "success") el.message.classList.add("ss-alert-success");
    el.message.textContent = message;
    el.message.classList.remove("hidden");
  }

  function selectedCreator() {
    return state.creators.find((item) => item?.user_code === state.selectedUserCode) || null;
  }

  function currentAccountId() {
    return String(state.detail?.account?.id || "").trim();
  }

  function renderCreatorOptions() {
    if (!(el.creatorSelect instanceof HTMLSelectElement)) return;
    const options = state.creators.map((item) => {
      const label = item?.display_name || item?.user_code || "Unknown creator";
      return `<option value="${escapeHtml(item.user_code || "")}">${escapeHtml(label)}</option>`;
    });
    el.creatorSelect.innerHTML = options.join("");
    if (state.selectedUserCode) {
      el.creatorSelect.value = state.selectedUserCode;
    }
  }

  function summarizeScope(scope) {
    const platforms = Array.isArray(scope?.platforms) ? scope.platforms : [];
    return platforms.length ? platforms.join(", ") : "—";
  }

  function summarizeTriggerContribution(trigger) {
    const rumble = trigger?.platform_applicability?.rumble || {};
    if (rumble.trigger_execution_eligible) return "Operational for Rumble";
    if (rumble.chat_capable) return "Linked but blocked";
    return "Not operational in this phase";
  }

  function canDelete(trigger) {
    return !trigger?.metadata?.builtin;
  }

  function renderTriggers(triggers) {
    if (!(el.tableBody instanceof HTMLElement)) return;
    const items = Array.isArray(triggers) ? triggers : [];
    if (!items.length) {
      el.tableBody.innerHTML = "";
      el.empty?.classList.remove("hidden");
      return;
    }
    el.empty?.classList.add("hidden");
    el.tableBody.innerHTML = items.map((trigger) => `
      <tr>
        <td>
          <strong>${escapeHtml(trigger.command_text || trigger.trigger_id || "-")}</strong>
          <div class="muted">${escapeHtml(trigger.response_preview || trigger.response_template || "-")}</div>
        </td>
        <td>${escapeHtml(summarizeScope(trigger.scope))}</td>
        <td>${trigger.enabled ? '<span class="ss-badge ss-badge-success">Enabled</span>' : '<span class="ss-badge ss-badge-warning">Disabled</span>'}</td>
        <td>${escapeHtml(summarizeTriggerContribution(trigger))}</td>
        <td class="align-right">
          <button class="ss-btn ss-btn-small ss-btn-secondary" type="button" data-trigger-toggle="${escapeHtml(trigger.trigger_id || "")}" data-next-enabled="${trigger.enabled ? "false" : "true"}">
            ${escapeHtml(trigger.enabled ? "Disable" : "Enable")}
          </button>
          <button class="ss-btn ss-btn-small ss-btn-secondary" type="button" data-trigger-edit="${escapeHtml(trigger.trigger_id || "")}">
            Edit
          </button>
          ${canDelete(trigger)
            ? `<button class="ss-btn ss-btn-small ss-btn-danger" type="button" data-trigger-delete="${escapeHtml(trigger.trigger_id || "")}">Delete</button>`
            : '<span class="muted">Built-in</span>'}
        </td>
      </tr>
    `).join("");
  }

  function renderManualSend(detail) {
    const integration = (() => {
      const items = Array.isArray(detail?.creator_integrations?.integrations) ? detail.creator_integrations.integrations : [];
      return items.find((item) => item?.platform_key === "rumble") || null;
    })();
    const dispatch = integration?.managed_dispatch || null;
    const session = integration?.managed_session || null;
    const transportReady = ["attached", "listening", "running"].includes(String(session?.transport_status || "").trim().toLowerCase());
    if (el.sessionLabel instanceof HTMLElement) {
      el.sessionLabel.textContent = session?.session_id || "No managed session";
    }
    if (el.manualStatus instanceof HTMLElement) {
      if (!session) {
        el.manualStatus.textContent = "No managed Rumble session is currently exported for this creator.";
      } else if (!transportReady) {
        el.manualStatus.textContent = session?.status_reason || session?.blocking_reason || "Managed send is blocked.";
      } else if (dispatch?.summary?.latest_status) {
        el.manualStatus.textContent = `Latest dispatch: ${dispatch.summary.latest_status} via ${dispatch.summary.latest_request_source || "runtime"}.`;
      } else {
        el.manualStatus.textContent = "Managed Rumble session is ready. No recent dispatch row is exported yet.";
      }
    }
    const items = Array.isArray(dispatch?.items) ? dispatch.items : [];
    if (items.length) {
      el.activityEmpty?.classList.add("hidden");
      el.activityList.innerHTML = items.slice(0, 6).map((item) => {
        const source = String(item?.request_source || "").trim().toLowerCase();
        const kind = source === "trigger_runtime"
          ? "Automatic trigger reply"
          : source === "creator_dashboard"
            ? "Manual creator send"
            : "Manual admin send";
        const blocking = item?.error_code ? ` (${item.error_code})` : "";
        return `<li>${escapeHtml(kind)}: ${escapeHtml(item?.status || "unknown")} · ${escapeHtml(item?.message_preview || "No preview")} · ${escapeHtml(item?.requested_at || "Pending")}${escapeHtml(blocking)}</li>`;
      }).join("");
    } else {
      el.activityList.innerHTML = "";
      el.activityEmpty?.classList.remove("hidden");
    }
  }

  function renderDetail(payload) {
    state.detail = payload && typeof payload === "object" ? payload : null;
    const account = state.detail?.account || {};
    const triggers = state.detail?.creator_integrations?.triggers || [];
    if (el.runtimeState instanceof HTMLElement) {
      el.runtimeState.textContent = state.detail
        ? "Hydrated from runtime/Auth creator trigger authority."
        : "No creator detail loaded.";
    }
    if (el.creatorLabel instanceof HTMLElement) {
      el.creatorLabel.textContent = account.display_name || account.user_code || "—";
    }
    if (el.snapshotLabel instanceof HTMLElement) {
      el.snapshotLabel.textContent = formatTimestamp(state.detail?.generated_at);
    }
    if (el.editorCreator instanceof HTMLElement) {
      el.editorCreator.textContent = account.display_name || account.user_code || "—";
    }
    renderTriggers(triggers);
    renderManualSend(payload);
  }

  async function loadCreators() {
    const payload = await requestJson("/api/admin/creator-integrations");
    state.creators = Array.isArray(payload?.items) ? payload.items : [];
    if (!state.selectedUserCode && state.creators[0]?.user_code) {
      state.selectedUserCode = state.creators[0].user_code;
    }
    renderCreatorOptions();
  }

  async function loadDetail() {
    if (!state.selectedUserCode) return;
    const payload = await requestJson(`/api/admin/users/${encodeURIComponent(state.selectedUserCode)}`);
    renderDetail(payload);
  }

  function openEditor(trigger = null) {
    state.editTriggerId = trigger?.trigger_id || null;
    el.editor?.classList.remove("hidden");
    el.editorTitle.textContent = trigger ? `Edit ${trigger.command_text}` : "Add Rumble text trigger";
    el.commandText.value = trigger?.command_text || "";
    el.responseText.value = trigger?.response_template || "";
    el.triggerEnabled.checked = trigger?.enabled !== false;
    el.cooldownSeconds.value = String(Number(trigger?.cooldown_seconds ?? 5));
  }

  function closeEditor() {
    state.editTriggerId = null;
    el.editor?.classList.add("hidden");
    el.triggerForm?.reset();
    if (el.triggerEnabled instanceof HTMLInputElement) el.triggerEnabled.checked = true;
    if (el.cooldownSeconds instanceof HTMLInputElement) el.cooldownSeconds.value = "5";
  }

  async function saveTrigger() {
    const accountId = currentAccountId();
    if (!accountId) return;
    const payload = {
      command_text: el.commandText.value.trim(),
      response_template: el.responseText.value.trim(),
      enabled: el.triggerEnabled.checked,
      cooldown_seconds: Number(el.cooldownSeconds.value || 5),
      scope: { mode: "platform_list", platforms: ["rumble"] },
    };
    if (state.editTriggerId) {
      await requestJson(`/api/admin/accounts/${encodeURIComponent(accountId)}/creator-triggers/${encodeURIComponent(state.editTriggerId)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      await requestJson(`/api/admin/accounts/${encodeURIComponent(accountId)}/creator-triggers`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    closeEditor();
    await loadDetail();
    setMessage("Trigger saved through the authoritative runtime/Auth path.", "success");
  }

  async function toggleTrigger(triggerId, enabled) {
    const accountId = currentAccountId();
    if (!accountId || !triggerId) return;
    await requestJson(`/api/admin/accounts/${encodeURIComponent(accountId)}/creator-triggers/${encodeURIComponent(triggerId)}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
    await loadDetail();
  }

  async function deleteTrigger(triggerId) {
    const accountId = currentAccountId();
    if (!accountId || !triggerId) return;
    await requestJson(`/api/admin/accounts/${encodeURIComponent(accountId)}/creator-triggers/${encodeURIComponent(triggerId)}`, {
      method: "DELETE",
    });
    await loadDetail();
  }

  async function sendManualMessage() {
    const accountId = currentAccountId();
    const integration = (() => {
      const items = Array.isArray(state.detail?.creator_integrations?.integrations) ? state.detail.creator_integrations.integrations : [];
      return items.find((item) => item?.platform_key === "rumble") || null;
    })();
    await requestJson("/api/admin/runtime/rumble-dispatch", {
      method: "POST",
      body: JSON.stringify({
        creator_account_id: accountId,
        session_id: integration?.managed_session?.session_id || null,
        message_text: el.manualMessage.value.trim(),
        reason: "operator_manual_send",
      }),
    });
    el.manualSendForm.reset();
    await loadDetail();
    setMessage("Controlled admin Rumble send submitted.", "success");
  }

  async function init() {
    if (state.abortController) {
      state.abortController.abort();
    }
    state.abortController = new AbortController();
    const signal = state.abortController.signal;

    el.banner = $("triggers-banner");
    el.runtimeState = $("triggers-runtime-state");
    el.creatorSelect = $("triggers-creator-select");
    el.creatorLabel = $("triggers-creator-label");
    el.snapshotLabel = $("triggers-snapshot-label");
    el.sessionLabel = $("triggers-session-label");
    el.message = $("triggers-message");
    el.tableBody = $("triggers-table-body");
    el.empty = $("triggers-empty");
    el.activityList = $("triggers-activity-list");
    el.activityEmpty = $("triggers-activity-empty");
    el.manualStatus = $("triggers-manual-status");
    el.manualSendForm = $("triggers-manual-send-form");
    el.manualMessage = $("triggers-manual-message");
    el.editor = $("trigger-editor");
    el.editorTitle = $("trigger-editor-title");
    el.editorCreator = $("trigger-editor-creator");
    el.triggerForm = $("trigger-form");
    el.triggerEnabled = $("trigger-enabled");
    el.commandText = $("trigger-command-text");
    el.responseText = $("trigger-response-text");
    el.cooldownSeconds = $("trigger-cooldown-seconds");

    $("btn-refresh-triggers")?.addEventListener("click", () => {
      void loadDetail().catch((err) => setBanner(err?.message || "Unable to refresh trigger oversight.", "danger"));
    }, { signal });
    $("btn-add-trigger")?.addEventListener("click", () => openEditor(null), { signal });
    $("btn-cancel-trigger")?.addEventListener("click", closeEditor, { signal });
    el.creatorSelect?.addEventListener("change", () => {
      state.selectedUserCode = el.creatorSelect.value;
      void loadDetail().catch((err) => setBanner(err?.message || "Unable to load creator detail.", "danger"));
    }, { signal });
    el.tableBody?.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const triggerId = target.closest("[data-trigger-edit]")?.getAttribute("data-trigger-edit");
      if (triggerId) {
        const trigger = (state.detail?.creator_integrations?.triggers || []).find((item) => item?.trigger_id === triggerId) || null;
        openEditor(trigger);
        return;
      }
      const toggleButton = target.closest("[data-trigger-toggle]");
      if (toggleButton instanceof HTMLElement) {
        void toggleTrigger(
          toggleButton.getAttribute("data-trigger-toggle") || "",
          toggleButton.getAttribute("data-next-enabled") === "true",
        ).catch((err) => setBanner(err?.message || "Unable to update trigger.", "danger"));
        return;
      }
      const deleteButton = target.closest("[data-trigger-delete]");
      if (deleteButton instanceof HTMLElement) {
        if (!window.confirm("Delete this trigger?")) return;
        void deleteTrigger(deleteButton.getAttribute("data-trigger-delete") || "").catch((err) => {
          setBanner(err?.message || "Unable to delete trigger.", "danger");
        });
      }
    }, { signal });
    el.triggerForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      void saveTrigger().catch((err) => setBanner(err?.message || "Unable to save trigger.", "danger"));
    }, { signal });
    el.manualSendForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      void sendManualMessage().catch((err) => setBanner(err?.message || "Unable to send manual test.", "danger"));
    }, { signal });

    try {
      await loadCreators();
      await loadDetail();
      setBanner("");
    } catch (err) {
      setBanner(err?.message || "Unable to load trigger oversight.", "danger");
    }
  }

  window.TriggersView = {
    init,
    destroy() {
      closeEditor();
      if (state.abortController) {
        state.abortController.abort();
        state.abortController = null;
      }
      state.detail = null;
      state.editTriggerId = null;
    },
  };
})();

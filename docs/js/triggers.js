(() => {
  "use strict";

  const state = {
    creators: [],
    selectedUserCode: "",
    detail: null,
    editTriggerId: null,
    abortController: null,
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

  async function readJsonSafe(response) {
    try {
      return await response.json();
    } catch (_err) {
      return null;
    }
  }

  async function requestJson(path, options = {}) {
    const response = await fetch(buildApiUrl(path), {
      cache: "no-store",
      credentials: "include",
      signal: options.signal,
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
    if (!message) return;
    if (tone === "danger" || tone === "warning") el.banner.classList.add("ss-alert-danger");
    if (tone === "success") el.banner.classList.add("ss-alert-success");
  }

  function setMessage(message, tone = "") {
    if (!(el.message instanceof HTMLElement)) return;
    if (!message) {
      el.message.className = "ss-alert hidden";
      el.message.textContent = "";
      return;
    }
    el.message.className = "ss-alert";
    if (tone === "danger" || tone === "warning") el.message.classList.add("ss-alert-danger");
    if (tone === "success") el.message.classList.add("ss-alert-success");
    el.message.textContent = message;
  }

  function setRuntimeState(message) {
    if (el.runtimeState instanceof HTMLElement) {
      el.runtimeState.textContent = message || "";
    }
  }

  function selectedCreator() {
    return state.creators.find((item) => item?.user_code === state.selectedUserCode) || null;
  }

  function currentAccountId() {
    return String(state.detail?.account?.id || state.detail?.summary?.account_id || selectedCreator()?.account_id || "").trim();
  }

  function normalizeSelectorSummary(item) {
    return {
      user_code: String(item?.user_code || "").trim(),
      account_id: String(item?.account_id || "").trim(),
      display_name: String(item?.display_name || item?.user_code || "Unknown creator").trim() || "Unknown creator",
      readiness_label: String(item?.readiness_label || "").trim() || "Unclassified",
      creator_capable: Boolean(item?.creator_capable),
      linked_platform_count: Number(item?.linked_platform_count || 0),
      deployable_platform_count: Number(item?.deployable_platform_count || 0),
      enabled_foundational_trigger_count: Number(item?.enabled_foundational_trigger_count || 0),
      foundational_trigger_count: Number(item?.foundational_trigger_count || 0),
      source: "summary",
    };
  }

  function normalizeSelectorRegistry(item) {
    const account = item?.account && typeof item.account === "object" ? item.account : {};
    return {
      user_code: String(item?.user_code || "").trim(),
      account_id: String(item?.account_id || account.account_id || "").trim(),
      display_name: String(item?.display_name || account.display_name || item?.user_code || "Unknown creator").trim() || "Unknown creator",
      readiness_label: String(item?.status || "").trim() || "Registered creator",
      creator_capable: true,
      linked_platform_count: 0,
      deployable_platform_count: 0,
      enabled_foundational_trigger_count: 0,
      foundational_trigger_count: 0,
      source: "registry",
    };
  }

  function mergeCreators(summaryItems, registryItems) {
    const merged = new Map();
    summaryItems.forEach((item) => {
      const normalized = normalizeSelectorSummary(item);
      if (!normalized.user_code) return;
      merged.set(normalized.user_code, normalized);
    });
    registryItems.forEach((item) => {
      const normalized = normalizeSelectorRegistry(item);
      if (!normalized.user_code) return;
      const existing = merged.get(normalized.user_code);
      merged.set(normalized.user_code, {
        ...normalized,
        ...existing,
        account_id: existing?.account_id || normalized.account_id,
        display_name: existing?.display_name || normalized.display_name,
      });
    });
    return Array.from(merged.values()).sort((left, right) => {
      const readinessRank = (item) => {
        if ((item.deployable_platform_count || 0) > 0) return 0;
        if ((item.linked_platform_count || 0) > 0) return 1;
        return 2;
      };
      const rankDiff = readinessRank(left) - readinessRank(right);
      if (rankDiff !== 0) return rankDiff;
      return left.display_name.localeCompare(right.display_name);
    });
  }

  function renderCreatorOptions() {
    if (!(el.creatorSelect instanceof HTMLSelectElement)) return;
    const options = state.creators.map((item) => {
      const footing = item.deployable_platform_count > 0
        ? "ready"
        : item.linked_platform_count > 0
          ? "linked"
          : "registered";
      return `<option value="${escapeHtml(item.user_code)}">${escapeHtml(`${item.display_name} (${footing})`)}</option>`;
    });
    el.creatorSelect.innerHTML = options.join("");
    if (state.selectedUserCode) {
      el.creatorSelect.value = state.selectedUserCode;
    }
  }

  function renderSelectorSummary() {
    const creator = selectedCreator();
    if (!(creator && el.selectorSummary instanceof HTMLElement)) return;
    el.selectorSummary.innerHTML = [
      `<span class="ss-chip">Creator: ${escapeHtml(creator.display_name)}</span>`,
      `<span class="ss-chip">User code: ${escapeHtml(creator.user_code)}</span>`,
      `<span class="ss-chip">Readiness: ${escapeHtml(creator.readiness_label || "Unknown")}</span>`,
      `<span class="ss-chip">Linked: ${escapeHtml(String(creator.linked_platform_count || 0))}</span>`,
      `<span class="ss-chip">Deployable: ${escapeHtml(String(creator.deployable_platform_count || 0))}</span>`,
      `<span class="ss-chip">Foundation triggers: ${escapeHtml(`${creator.enabled_foundational_trigger_count || 0}/${creator.foundational_trigger_count || 0}`)}</span>`,
    ].join("");
  }

  function normalizeDetailPayload(payload) {
    if (payload?.creator_integrations && typeof payload.creator_integrations === "object") {
      return {
        account: payload.account || {},
        summary: payload.creator_integrations.summary || {},
        integrations: Array.isArray(payload.creator_integrations.integrations) ? payload.creator_integrations.integrations : [],
        triggers: Array.isArray(payload.creator_integrations.triggers) ? payload.creator_integrations.triggers : [],
        generated_at: payload.generated_at,
      };
    }
    return {
      account: payload?.account || {},
      summary: payload?.summary || {},
      integrations: Array.isArray(payload?.integrations) ? payload.integrations : [],
      triggers: Array.isArray(payload?.triggers) ? payload.triggers : [],
      generated_at: payload?.generated_at,
    };
  }

  function rumbleIntegration(detail) {
    const items = Array.isArray(detail?.integrations) ? detail.integrations : [];
    return items.find((item) => String(item?.platform_key || "").trim().toLowerCase() === "rumble") || null;
  }

  function triggerPhaseSupport(trigger) {
    const platforms = Array.isArray(trigger?.scope?.platforms) ? trigger.scope.platforms.map((item) => String(item || "").trim().toLowerCase()) : [];
    const rumbleScoped = platforms.includes("rumble");
    const responseMode = String(trigger?.response_mode || "").trim().toLowerCase();
    const triggerType = String(trigger?.trigger_type || "").trim().toLowerCase();
    const supportsText = !responseMode || responseMode === "text";
    const supportsTriggerType = !triggerType || triggerType === "command_text";
    const supported = rumbleScoped && supportsText && supportsTriggerType;
    return {
      supported,
      label: supported ? "Phase-one supported" : "Visible only",
      detail: supported
        ? "Basic Rumble text reply."
        : "Outside first-phase Rumble text trigger scope.",
    };
  }

  function summarizeTriggerContribution(trigger) {
    const rumble = trigger?.platform_applicability?.rumble || {};
    if (rumble.trigger_execution_eligible) return "Operational for Rumble";
    if (rumble.chat_capable) return "Rumble linked, runtime still blocked";
    return "Not operational in this phase";
  }

  function canDelete(trigger) {
    return !trigger?.metadata?.builtin;
  }

  function renderOverview(detail) {
    if (!(el.overview instanceof HTMLElement)) return;
    const summary = detail?.summary || {};
    const rumble = rumbleIntegration(detail) || {};
    const dispatch = rumble?.managed_dispatch?.summary || {};
    const session = rumble?.managed_session || {};
    const cards = [
      { label: "Readiness", value: summary.readiness_label || "Unknown", tone: summary.bot_deploy_eligible ? "success" : "warning" },
      { label: "Rumble status", value: rumble.status || "not_configured", tone: rumble.status === "linked" ? "success" : "warning" },
      { label: "Managed session", value: session.lifecycle_state || "Not exported", tone: session.session_id ? "success" : "subtle" },
      { label: "Transport", value: session.transport_status || "Not attached", tone: ["attached", "listening", "running"].includes(String(session.transport_status || "").trim().toLowerCase()) ? "success" : "warning" },
      { label: "Dispatch lane", value: dispatch.latest_request_source || "No recent sends", tone: dispatch.latest_request_source ? "subtle" : "warning" },
      { label: "Snapshot", value: formatTimestamp(detail?.generated_at), tone: "subtle" },
    ];
    el.overview.innerHTML = cards.map((item) => `
      <article class="ss-stat-card">
        <div class="muted">${escapeHtml(item.label)}</div>
        <strong>${escapeHtml(item.value)}</strong>
        <span class="ss-badge ${item.tone === "success" ? "ss-badge-success" : item.tone === "warning" ? "ss-badge-warning" : ""}">${escapeHtml(item.tone === "success" ? "Live" : item.tone === "warning" ? "Attention" : "Info")}</span>
      </article>
    `).join("");
  }

  function renderTriggerRows(triggers) {
    if (!(el.tableBody instanceof HTMLElement)) return;
    const items = Array.isArray(triggers) ? triggers : [];
    if (!items.length) {
      el.tableBody.innerHTML = "";
      el.empty?.classList.remove("hidden");
      return;
    }
    el.empty?.classList.add("hidden");
    el.tableBody.innerHTML = items.map((trigger) => {
      const support = triggerPhaseSupport(trigger);
      const applicability = summarizeTriggerContribution(trigger);
      return `
        <tr>
          <td>
            <strong>${escapeHtml(trigger.command_text || trigger.trigger_id || "-")}</strong>
            <div class="muted">${escapeHtml(trigger.response_preview || trigger.response_template || "-")}</div>
          </td>
          <td>${escapeHtml(Array.isArray(trigger?.scope?.platforms) ? trigger.scope.platforms.join(", ") : "—")}</td>
          <td>${trigger.enabled ? '<span class="ss-badge ss-badge-success">Enabled</span>' : '<span class="ss-badge ss-badge-warning">Disabled</span>'}</td>
          <td>
            <div>${escapeHtml(support.label)}</div>
            <div class="muted">${escapeHtml(applicability)}</div>
          </td>
          <td>${escapeHtml(formatTimestamp(trigger.updated_at || trigger.created_at))}</td>
          <td class="align-right">
            <button class="ss-btn ss-btn-small ss-btn-secondary" type="button" data-trigger-toggle="${escapeHtml(trigger.trigger_id || "")}" data-next-enabled="${trigger.enabled ? "false" : "true"}">
              ${escapeHtml(trigger.enabled ? "Disable" : "Enable")}
            </button>
            <button class="ss-btn ss-btn-small ss-btn-secondary" type="button" data-trigger-edit="${escapeHtml(trigger.trigger_id || "")}" ${support.supported ? "" : "disabled"}>
              Edit
            </button>
            ${canDelete(trigger)
              ? `<button class="ss-btn ss-btn-small ss-btn-danger" type="button" data-trigger-delete="${escapeHtml(trigger.trigger_id || "")}" ${support.supported ? "" : "disabled"}>Delete</button>`
              : '<span class="muted">Built-in</span>'}
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderPhaseNotes(triggers) {
    if (!(el.phaseNotes instanceof HTMLElement)) return;
    const items = Array.isArray(triggers) ? triggers : [];
    const unsupported = items.filter((trigger) => !triggerPhaseSupport(trigger).supported);
    const notes = [
      "Manual admin send uses the admin runtime dispatch path.",
      "Manual creator send is visible in dispatch history but remains creator-controlled.",
      "Automatic trigger reply rows come from the trigger runtime only.",
    ];
    if (unsupported.length) {
      notes.push(`${unsupported.length} trigger row(s) are visible but outside first-phase Rumble text support.`);
    } else {
      notes.push("Unsupported trigger types are not currently exported for this creator.");
    }
    el.phaseNotes.innerHTML = notes.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  }

  function dispatchLabel(source) {
    if (source === "trigger_runtime") return "Automatic trigger reply";
    if (source === "creator_dashboard") return "Manual creator send";
    return "Manual admin send";
  }

  function renderManualSend(detail) {
    const integration = rumbleIntegration(detail);
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
        el.manualStatus.textContent = `Latest dispatch: ${dispatch.summary.latest_status} via ${dispatchLabel(String(dispatch.summary.latest_request_source || "").trim().toLowerCase())}.`;
      } else {
        el.manualStatus.textContent = "Managed Rumble session is ready. No recent dispatch row is exported yet.";
      }
    }
    const items = Array.isArray(dispatch?.items) ? dispatch.items : [];
    if (items.length) {
      el.activityEmpty?.classList.add("hidden");
      el.activityList.innerHTML = items.slice(0, 6).map((item) => `
        <li>
          <strong>${escapeHtml(dispatchLabel(String(item?.request_source || "").trim().toLowerCase()))}</strong>
          <span> · ${escapeHtml(item?.status || "unknown")}</span>
          <span> · ${escapeHtml(item?.message_preview || "No preview")}</span>
          <span> · ${escapeHtml(formatTimestamp(item?.requested_at))}</span>
          ${item?.error_code ? `<span> · ${escapeHtml(item.error_code)}</span>` : ""}
        </li>
      `).join("");
    } else {
      el.activityList.innerHTML = "";
      el.activityEmpty?.classList.remove("hidden");
    }
  }

  function renderDetail(detail) {
    state.detail = detail && typeof detail === "object" ? detail : null;
    const account = state.detail?.account || {};
    if (el.creatorLabel instanceof HTMLElement) {
      el.creatorLabel.textContent = account.display_name || account.user_code || selectedCreator()?.display_name || "—";
    }
    if (el.snapshotLabel instanceof HTMLElement) {
      el.snapshotLabel.textContent = formatTimestamp(state.detail?.generated_at);
    }
    renderOverview(state.detail);
    renderTriggerRows(state.detail?.triggers);
    renderManualSend(state.detail);
    renderPhaseNotes(state.detail?.triggers);
  }

  async function loadCreators() {
    const signal = state.abortController?.signal;
    const [summaryResult, registryResult] = await Promise.allSettled([
      requestJson("/api/admin/creator-integrations", { signal }),
      requestJson("/api/admin/creators", { signal }),
    ]);
    const summaryItems = summaryResult.status === "fulfilled" && Array.isArray(summaryResult.value?.items)
      ? summaryResult.value.items
      : [];
    const registryItems = registryResult.status === "fulfilled"
      ? (Array.isArray(registryResult.value?.items)
        ? registryResult.value.items
        : Array.isArray(registryResult.value?.creators)
          ? registryResult.value.creators
          : [])
      : [];
    state.creators = mergeCreators(summaryItems, registryItems);
    if (!state.creators.length) {
      throw new Error("No registered creators were returned by the authoritative admin/runtime contract.");
    }
    if (!state.selectedUserCode || !state.creators.some((item) => item.user_code === state.selectedUserCode)) {
      state.selectedUserCode = state.creators[0].user_code;
    }
    renderCreatorOptions();
    renderSelectorSummary();
  }

  async function loadDetail() {
    const creator = selectedCreator();
    if (!creator?.user_code) return;
    const signal = state.abortController?.signal;
    let payload = null;
    if (creator.account_id) {
      payload = await requestJson(`/api/admin/accounts/${encodeURIComponent(creator.account_id)}/creator-integrations`, { signal });
    } else {
      payload = await requestJson(`/api/admin/users/${encodeURIComponent(creator.user_code)}`, { signal });
    }
    renderDetail(normalizeDetailPayload(payload));
  }

  function findTrigger(triggerId) {
    const items = Array.isArray(state.detail?.triggers) ? state.detail.triggers : [];
    return items.find((item) => item?.trigger_id === triggerId) || null;
  }

  function openEditor(trigger = null) {
    state.editTriggerId = trigger?.trigger_id || null;
    el.editor?.classList.remove("hidden");
    if (el.editorTitle instanceof HTMLElement) {
      el.editorTitle.textContent = trigger ? `Edit ${trigger.command_text}` : "Add Rumble text trigger";
    }
    if (el.editorMode instanceof HTMLElement) {
      el.editorMode.textContent = trigger
        ? "Editing the authoritative runtime/Auth trigger row."
        : "Creating a new first-phase Rumble text trigger.";
    }
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
    if (!accountId) throw new Error("No creator account is selected.");
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
    await loadCreators();
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
    await loadCreators();
    await loadDetail();
    setMessage(`Trigger ${triggerId} updated.`, "success");
  }

  async function deleteTrigger(triggerId) {
    const accountId = currentAccountId();
    if (!accountId || !triggerId) return;
    await requestJson(`/api/admin/accounts/${encodeURIComponent(accountId)}/creator-triggers/${encodeURIComponent(triggerId)}`, {
      method: "DELETE",
    });
    await loadCreators();
    await loadDetail();
    setMessage(`Trigger ${triggerId} deleted.`, "success");
  }

  async function sendManualMessage() {
    const accountId = currentAccountId();
    const integration = rumbleIntegration(state.detail);
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

  async function refreshAll() {
    setRuntimeState("Refreshing authoritative trigger oversight...");
    setBanner("");
    setMessage("");
    await loadCreators();
    await loadDetail();
    setRuntimeState("Hydrated from runtime/Auth creator-integrations authority.");
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
    el.selectorSummary = $("triggers-selector-summary");
    el.creatorLabel = $("triggers-creator-label");
    el.snapshotLabel = $("triggers-snapshot-label");
    el.sessionLabel = $("triggers-session-label");
    el.message = $("triggers-message");
    el.overview = $("triggers-overview-cards");
    el.tableBody = $("triggers-table-body");
    el.empty = $("triggers-empty");
    el.phaseNotes = $("triggers-phase-notes");
    el.activityList = $("triggers-activity-list");
    el.activityEmpty = $("triggers-activity-empty");
    el.manualStatus = $("triggers-manual-status");
    el.manualSendForm = $("triggers-manual-send-form");
    el.manualMessage = $("triggers-manual-message");
    el.editor = $("trigger-editor");
    el.editorTitle = $("trigger-editor-title");
    el.editorMode = $("trigger-editor-mode");
    el.triggerForm = $("trigger-form");
    el.triggerEnabled = $("trigger-enabled");
    el.commandText = $("trigger-command-text");
    el.responseText = $("trigger-response-text");
    el.cooldownSeconds = $("trigger-cooldown-seconds");

    $("btn-refresh-triggers")?.addEventListener("click", () => {
      void refreshAll().catch((err) => setBanner(err?.message || "Unable to refresh trigger oversight.", "danger"));
    }, { signal });
    $("btn-add-trigger")?.addEventListener("click", () => openEditor(null), { signal });
    $("btn-cancel-trigger")?.addEventListener("click", closeEditor, { signal });
    el.creatorSelect?.addEventListener("change", () => {
      state.selectedUserCode = el.creatorSelect.value;
      renderSelectorSummary();
      void loadDetail().catch((err) => setBanner(err?.message || "Unable to load creator detail.", "danger"));
    }, { signal });
    el.tableBody?.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const editButton = target.closest("[data-trigger-edit]");
      if (editButton instanceof HTMLElement) {
        const triggerId = editButton.getAttribute("data-trigger-edit") || "";
        const trigger = findTrigger(triggerId);
        if (trigger && triggerPhaseSupport(trigger).supported) {
          openEditor(trigger);
        }
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
      await refreshAll();
    } catch (err) {
      setBanner(err?.message || "Unable to load trigger oversight.", "danger");
      setRuntimeState("Trigger oversight failed to hydrate from runtime/Auth.");
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
      state.creators = [];
      state.detail = null;
      state.editTriggerId = null;
    },
  };
})();

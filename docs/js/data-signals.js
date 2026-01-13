/* ============================================================
   StreamSuites Dashboard — Data & Signals view
   - Read-only CMS/observability surface backed by static JSON
   - Reuses SearchPagination for filtering + pagination
   ============================================================ */

(() => {
  "use strict";

  const DATA_ROOT = "data";
  const POLL_INTERVAL_MS = 15000;

  const ENTITY_CONFIGS = {
    clips: {
      path: `${DATA_ROOT}/clips.json`,
      property: "items",
      searchFields: ["id", "title", "state", "creator"],
      defaultSortField: "updated_at",
      defaultSortDirection: "desc",
      countLabel: "clips-count",
      tableBody: "clips-table-body",
      table: "clips-table",
      pagination: "clips-pagination",
      empty: "clips-empty",
      searchInput: "clips-search",
      renderRow: (clip) => {
        return `
          <td>${escapeHtml(clip.id)}</td>
          <td>${escapeHtml(clip.title || "—")}</td>
          <td>${renderState(clip.state)}</td>
          <td>${escapeHtml(clip.creator || "—")}</td>
          <td>${formatTimestamp(clip.created_at)}</td>
          <td>${formatTimestamp(clip.updated_at)}</td>
          <td>${renderBoolean(clip.public)}</td>
        `;
      }
    },
    polls: {
      path: `${DATA_ROOT}/polls.json`,
      property: "items",
      searchFields: ["id", "title", "state", "creator"],
      defaultSortField: "updated_at",
      defaultSortDirection: "desc",
      countLabel: "polls-count",
      tableBody: "polls-table-body",
      table: "polls-table",
      pagination: "polls-pagination",
      empty: "polls-empty",
      searchInput: "polls-search",
      renderRow: (poll) => {
        return `
          <td>${escapeHtml(poll.id)}</td>
          <td>${escapeHtml(poll.title || poll.question || "—")}</td>
          <td>${renderState(poll.state)}</td>
          <td>${escapeHtml(poll.creator || "—")}</td>
          <td>${formatTimestamp(poll.created_at)}</td>
          <td>${formatTimestamp(poll.updated_at)}</td>
          <td>${renderBoolean(poll.public)}</td>
        `;
      }
    },
    tallies: {
      path: `${DATA_ROOT}/tallies.json`,
      property: "items",
      searchFields: ["id", "name", "state", "creator"],
      defaultSortField: "updated_at",
      defaultSortDirection: "desc",
      countLabel: "tallies-count",
      tableBody: "tallies-table-body",
      table: "tallies-table",
      pagination: "tallies-pagination",
      empty: "tallies-empty",
      searchInput: "tallies-search",
      renderRow: (tally) => {
        return `
          <td>${escapeHtml(tally.id)}</td>
          <td>${escapeHtml(tally.name || "—")}</td>
          <td>${renderState(tally.state)}</td>
          <td>${escapeHtml(tally.creator || "—")}</td>
          <td>${formatTimestamp(tally.created_at)}</td>
          <td>${formatTimestamp(tally.updated_at)}</td>
          <td>${renderBoolean(tally.public)}</td>
        `;
      }
    },
    scoreboards: {
      path: `${DATA_ROOT}/scoreboards.json`,
      property: "items",
      searchFields: ["id", "name", "state", "creator"],
      defaultSortField: "updated_at",
      defaultSortDirection: "desc",
      countLabel: "scoreboards-count",
      tableBody: "scoreboards-table-body",
      table: "scoreboards-table",
      pagination: "scoreboards-pagination",
      empty: "scoreboards-empty",
      searchInput: "scoreboards-search",
      renderRow: (scoreboard) => {
        return `
          <td>${escapeHtml(scoreboard.id)}</td>
          <td>${escapeHtml(scoreboard.name || "—")}</td>
          <td>${renderState(scoreboard.state)}</td>
          <td>${escapeHtml(scoreboard.creator || "—")}</td>
          <td>${formatTimestamp(scoreboard.created_at)}</td>
          <td>${formatTimestamp(scoreboard.updated_at)}</td>
          <td>${renderBoolean(scoreboard.public)}</td>
        `;
      }
    }
  };

  const SIGNAL_CONFIGS = {
    chatEvents: {
      path: `${DATA_ROOT}/chat_events.json`,
      property: "items",
      searchFields: ["type", "source", "entity_id", "summary"],
      defaultSortField: "timestamp",
      defaultSortDirection: "desc",
      countLabel: "chat-events-count",
      tableBody: "chat-events-body",
      table: "chat-events-table",
      pagination: "chat-events-pagination",
      empty: "chat-events-empty",
      searchInput: "chat-events-search",
      renderRow: (event) => {
        return `
          <td>${formatTimestamp(event.timestamp)}</td>
          <td>${escapeHtml(event.type || "chat_event")}</td>
          <td>${escapeHtml(event.source || "—")}</td>
          <td>${escapeHtml(event.entity_id || "—")}</td>
          <td><span class="muted">${escapeHtml(event.summary || event.preview || "—")}</span></td>
        `;
      }
    },
    pollVotes: {
      path: `${DATA_ROOT}/poll_votes.json`,
      property: "items",
      searchFields: ["type", "source", "poll_id", "summary", "voter"],
      defaultSortField: "timestamp",
      defaultSortDirection: "desc",
      countLabel: "poll-votes-count",
      tableBody: "poll-votes-body",
      table: "poll-votes-table",
      pagination: "poll-votes-pagination",
      empty: "poll-votes-empty",
      searchInput: "poll-votes-search",
      renderRow: (vote) => {
        const summary = vote.summary || `${vote.voter || "—"} -> ${vote.option || ""}`;
        return `
          <td>${formatTimestamp(vote.timestamp)}</td>
          <td>${escapeHtml(vote.type || "poll_vote")}</td>
          <td>${escapeHtml(vote.source || "—")}</td>
          <td>${escapeHtml(vote.poll_id || "—")}</td>
          <td><span class="muted">${escapeHtml(summary)}</span></td>
        `;
      }
    },
    tallyEvents: {
      path: `${DATA_ROOT}/tally_events.json`,
      property: "items",
      searchFields: ["type", "source", "tally_id", "summary"],
      defaultSortField: "timestamp",
      defaultSortDirection: "desc",
      countLabel: "tally-events-count",
      tableBody: "tally-events-body",
      table: "tally-events-table",
      pagination: "tally-events-pagination",
      empty: "tally-events-empty",
      searchInput: "tally-events-search",
      renderRow: (event) => {
        const summary = event.summary || `+${event.increment || 1} to ${event.tally_id || "tally"}`;
        return `
          <td>${formatTimestamp(event.timestamp)}</td>
          <td>${escapeHtml(event.type || "tally_increment")}</td>
          <td>${escapeHtml(event.source || "—")}</td>
          <td>${escapeHtml(event.tally_id || "—")}</td>
          <td><span class="muted">${escapeHtml(summary)}</span></td>
        `;
      }
    },
    scoreEvents: {
      path: `${DATA_ROOT}/score_events.json`,
      property: "items",
      searchFields: ["type", "source", "scoreboard_id", "summary", "team"],
      defaultSortField: "timestamp",
      defaultSortDirection: "desc",
      countLabel: "score-events-count",
      tableBody: "score-events-body",
      table: "score-events-table",
      pagination: "score-events-pagination",
      empty: "score-events-empty",
      searchInput: "score-events-search",
      renderRow: (event) => {
        const summary = event.summary || `${event.team || "team"} ${event.delta || 0} (${event.context || "score"})`;
        return `
          <td>${formatTimestamp(event.timestamp)}</td>
          <td>${escapeHtml(event.type || "score_update")}</td>
          <td>${escapeHtml(event.source || "—")}</td>
          <td>${escapeHtml(event.scoreboard_id || "—")}</td>
          <td><span class="muted">${escapeHtml(summary)}</span></td>
        `;
      }
    }
  };

  const ADMIN_CONFIGS = {
    creators: {
      path: `${DATA_ROOT}/creators.json`,
      property: "creators",
      searchFields: ["creator_id", "display_name", "status", "platform_summary"],
      defaultSortField: "creator_id",
      countLabel: "admin-creators-count",
      tableBody: "admin-creators-body",
      table: "admin-creators-table",
      pagination: "admin-creators-pagination",
      empty: "admin-creators-empty",
      searchInput: "admin-creators-search",
      mapItem: (creator) => ({
        ...creator,
        platform_summary: renderPlatforms(creator.platforms_enabled)
      }),
      renderRow: (creator) => {
        return `
          <td>${escapeHtml(creator.creator_id)}</td>
          <td>${escapeHtml(creator.display_name || "—")}</td>
          <td>${escapeHtml(renderPlatforms(creator.platforms_enabled))}</td>
          <td>${escapeHtml(creator.status || (creator.disabled ? "disabled" : "active"))}</td>
          <td>${formatTimestamp(creator.created_at)}</td>
        `;
      }
    },
    chatTriggers: {
      path: `${DATA_ROOT}/chat_triggers.json`,
      property: "items",
      searchFields: ["phrase", "module", "creator", "summary"],
      defaultSortField: "phrase",
      countLabel: "chat-triggers-count",
      tableBody: "chat-triggers-body",
      table: "chat-triggers-table",
      pagination: "chat-triggers-pagination",
      empty: "chat-triggers-empty",
      searchInput: "chat-triggers-search",
      renderRow: (trigger) => {
        return `
          <td>${escapeHtml(trigger.phrase)}</td>
          <td>${escapeHtml(trigger.module || "—")}</td>
          <td>${escapeHtml(trigger.creator || "—")}</td>
          <td>${renderBoolean(trigger.enabled)}</td>
          <td>${formatTimestamp(trigger.last_fired_at)}</td>
        `;
      }
    },
    jobs: {
      path: `${DATA_ROOT}/jobs.json`,
      property: "items",
      searchFields: ["id", "type", "state", "reason"],
      defaultSortField: "last_run",
      defaultSortDirection: "desc",
      countLabel: "jobs-count",
      tableBody: "jobs-body",
      table: "jobs-table",
      pagination: "jobs-pagination",
      empty: "jobs-empty",
      searchInput: "jobs-search",
      renderRow: (job) => {
        const enablement = normalizeJobEnablement(job);
        return `
          <td>${escapeHtml(job.id)}</td>
          <td>${escapeHtml(job.type)}</td>
          <td>${renderState(job.state)}</td>
          <td>${renderEnablementBadge(enablement)}</td>
          <td>${renderRestartBadge(enablement)}</td>
          <td>${escapeHtml(enablement.reason || job.reason)}</td>
          <td>${formatTimestamp(job.last_run)}</td>
          <td>${formatTimestamp(job.next_run)}</td>
        `;
      }
    },
    rateLimits: {
      path: `${DATA_ROOT}/rate_limits.json`,
      property: "items",
      searchFields: ["scope", "status"],
      defaultSortField: "scope",
      countLabel: "rate-limits-count",
      tableBody: "rate-limits-body",
      table: "rate-limits-table",
      pagination: "rate-limits-pagination",
      empty: "rate-limits-empty",
      searchInput: "rate-limits-search",
      renderRow: (limit) => {
        const windowLabel = limit.window ? `${limit.window}s` : "—";
        return `
          <td>${escapeHtml(limit.scope)}</td>
          <td>${escapeHtml(String(limit.limit || "—"))}</td>
          <td>${escapeHtml(windowLabel)}</td>
          <td>${escapeHtml(limit.status || "—")}</td>
        `;
      }
    },
    integrations: {
      path: `${DATA_ROOT}/integrations.json`,
      property: "items",
      searchFields: ["id", "provider", "status", "scope"],
      defaultSortField: "created_at",
      defaultSortDirection: "desc",
      countLabel: "integrations-count",
      tableBody: "integrations-body",
      table: "integrations-table",
      pagination: "integrations-pagination",
      empty: "integrations-empty",
      searchInput: "integrations-search",
      renderRow: (integration) => {
        return `
          <td>${escapeHtml(integration.id)}</td>
          <td>${escapeHtml(integration.provider)}</td>
          <td>${escapeHtml(integration.scope || "—")}</td>
          <td>${escapeHtml(integration.status || "—")}</td>
          <td>${formatTimestamp(integration.created_at)}</td>
        `;
      }
    },
    permissions: {
      path: `${DATA_ROOT}/permissions.json`,
      property: "items",
      searchFields: ["principal", "role", "status"],
      defaultSortField: "created_at",
      defaultSortDirection: "desc",
      countLabel: "permissions-count",
      tableBody: "permissions-body",
      table: "permissions-table",
      pagination: "permissions-pagination",
      empty: "permissions-empty",
      searchInput: "permissions-search",
      renderRow: (permission) => {
        return `
          <td>${escapeHtml(permission.principal)}</td>
          <td>${escapeHtml(permission.role)}</td>
          <td>${escapeHtml(permission.status || "—")}</td>
          <td>${formatTimestamp(permission.created_at)}</td>
        `;
      }
    }
  };

  const state = {
    managers: {},
    pollHandle: null,
    totals: {
      entities: 0,
      signals: 0,
      admin: 0
    }
  };
  let runtimePollingLogged = false;

  function escapeHtml(value) {
    if (value === null || value === undefined) return "—";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatTimestamp(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    try {
      return date.toLocaleString(undefined, { hour12: false });
    } catch (err) {
      return escapeHtml(value);
    }
  }

  function renderBoolean(value) {
    return value ? "Yes" : "No";
  }

  function renderState(state) {
    if (!state) return "—";
    return state;
  }

  function renderPlatforms(flags) {
    if (!flags || typeof flags !== "object") return "—";
    const enabled = Object.entries(flags)
      .filter(([, on]) => on)
      .map(([key]) => key)
      .join(", ");
    return enabled || "—";
  }

  function normalizeJobEnablement(job) {
    const enablementBlock =
      job && typeof job.enablement === "object" ? job.enablement : null;

    const enabled = pickBoolean(
      job?.enabled,
      job?.enable,
      enablementBlock?.enabled,
      enablementBlock?.enable
    );

    const restartRequired = pickBoolean(
      job?.restart_required,
      job?.restartRequired,
      enablementBlock?.restart_required,
      enablementBlock?.requires_restart
    );

    const reason = pickReason([
      job?.disable_reason,
      job?.disabled_reason,
      job?.reason,
      enablementBlock?.reason,
      enablementBlock?.note,
      enablementBlock?.message
    ]);

    return {
      enabled,
      restartRequired: restartRequired === true,
      reason
    };
  }

  function renderEnablementBadge(enablement) {
    if (enablement.enabled === true) {
      return '<span class="ss-badge ss-badge-success">Enabled</span>';
    }
    if (enablement.enabled === false) {
      return '<span class="ss-badge ss-badge-warning">Disabled</span>';
    }
    return '<span class="muted">Unknown</span>';
  }

  function renderRestartBadge(enablement) {
    if (enablement.restartRequired) {
      return '<span class="ss-badge ss-badge-warning">Restart required</span>';
    }
    return '<span class="muted" title="Job toggles apply after restart">Restart-applied</span>';
  }

  function pickBoolean(...values) {
    for (const value of values) {
      if (value === true) return true;
      if (value === false) return false;
    }
    return null;
  }

  function pickReason(values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  async function fetchJson(path) {
    const runtimePath = path?.startsWith(`${DATA_ROOT}/`)
      ? path.replace(`${DATA_ROOT}/`, "")
      : null;

    if (runtimePath && typeof window.StreamSuitesState?.loadStateJson === "function") {
      const runtimeData = await window.StreamSuitesState.loadStateJson(runtimePath);
      if (runtimeData) return runtimeData;
    }

    try {
      const res = await fetch(new URL(path, document.baseURI));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`[DataSignals] Failed to load ${path}`, err);
      return null;
    }
  }

  function extractItems(data, property) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (property && Array.isArray(data[property])) return data[property];
    if (Array.isArray(data.items)) return data.items;
    return [];
  }

  function wireTabs(groupName) {
    const tablist = document.querySelector(`[data-tab-group="${groupName}"]`);
    if (!tablist) return;
    const tabs = Array.from(tablist.querySelectorAll(".ss-tab"));
    const panels = Array.from(
      document.querySelectorAll(`.ss-tabpanel[data-tab^="${groupName}"]`)
    );

    function activate(target) {
      tabs.forEach((btn) => {
        const isActive = btn.getAttribute("data-tab-target") === target;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      panels.forEach((panel) => {
        const isActive = panel.getAttribute("data-tab") === target;
        panel.classList.toggle("active", isActive);
      });
    }

    const initial = tabs.find((btn) => btn.getAttribute("aria-selected") === "true")
      || tabs[0];
    activate(initial?.getAttribute("data-tab-target"));

    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-tab-target");
        activate(target);
      });
    });
  }

  async function hydrateSection(configs, groupKey) {
    if (window.__STREAMSUITES_RUNTIME_OFFLINE__) {
      return;
    }

    let total = 0;
    for (const [key, cfg] of Object.entries(configs)) {
      const data = await fetchJson(cfg.path);
      const items = extractItems(data, cfg.property);
      const prepared = cfg.mapItem ? items.map(cfg.mapItem) : items;

      ensureManager(cfg, key, prepared);
      total += prepared.length;
    }
    updateGroupCount(groupKey, total);
  }

  function ensureManager(cfg, key, data) {
    if (state.managers[key]) {
      state.managers[key].setData(data);
      return;
    }

    const manager = SearchPagination.createTableManager({
      data,
      searchFields: cfg.searchFields,
      defaultSortField: cfg.defaultSortField,
      defaultSortDirection: cfg.defaultSortDirection,
      tableBody: document.getElementById(cfg.tableBody),
      table: document.getElementById(cfg.table),
      paginationContainer: document.getElementById(cfg.pagination),
      emptyState: document.getElementById(cfg.empty),
      searchInput: document.getElementById(cfg.searchInput),
      countLabel: document.getElementById(cfg.countLabel),
      renderRow: cfg.renderRow
    });

    state.managers[key] = manager;
    manager.setData(data);
  }

  function updateGroupCount(groupKey, total) {
    state.totals[groupKey] = total;
    if (groupKey === "entities") {
      const el = document.getElementById("entities-count");
      if (el) el.textContent = `${total} entity records`;
    }
    if (groupKey === "signals") {
      const el = document.getElementById("signals-count");
      if (el) el.textContent = `${total} signal events`;
    }
    if (groupKey === "admin") {
      const el = document.getElementById("admin-count");
      if (el) el.textContent = `${total} admin rows`;
    }
  }

  function init() {
    wireTabs("entities");
    wireTabs("signals");

    setTimeout(() => {
      (async () => {
        await hydrateSection(ENTITY_CONFIGS, "entities");
        await hydrateSection(SIGNAL_CONFIGS, "signals");
        await hydrateSection(ADMIN_CONFIGS, "admin");
        startPolling();
      })();
    }, 0);
  }

  function destroy() {
    stopPolling();
    state.managers = {};
  }

  function startPolling() {
    if (window.__RUNTIME_AVAILABLE__ !== true) {
      if (!runtimePollingLogged) {
        console.info("[Dashboard] Runtime unavailable. Polling disabled.");
        runtimePollingLogged = true;
      }
      return;
    }
    if (state.pollHandle) return;
    state.pollHandle = setInterval(async () => {
      await hydrateSection(ENTITY_CONFIGS, "entities");
      await hydrateSection(SIGNAL_CONFIGS, "signals");
      await hydrateSection(ADMIN_CONFIGS, "admin");
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (!state.pollHandle) return;
    clearInterval(state.pollHandle);
    state.pollHandle = null;
  }

  window.DataSignalsView = { init, destroy };
})();

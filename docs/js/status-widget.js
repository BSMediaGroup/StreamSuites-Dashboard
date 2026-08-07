(() => {
  "use strict";

  const API_BASE = "https://v0hwlmly3pd2.statuspage.io/api/v2";
  const ENDPOINTS = Object.freeze({
    summary: `${API_BASE}/summary.json`,
    incidents: `${API_BASE}/incidents.json`,
    maintenances: `${API_BASE}/scheduled-maintenances.json`,
  });
  const PRIMARY_STATUS_URL = "https://streamsuites.app/status";
  const ATLASSIAN_STATUS_URL = "https://streamsuites.statuspage.io/";
  const ROOT_ID = "ss-status-indicator";
  const DETAILS_ID = "ss-status-details";
  const POLL_INTERVAL_MS = 60000;
  const REQUEST_TIMEOUT_MS = 8000;

  const INDICATOR_META = Object.freeze({
    none: { state: "operational", label: "OPERATIONAL", description: "All Systems Operational" },
    minor: { state: "degraded", label: "DEGRADED", description: "Degraded performance" },
    major: { state: "partial", label: "PARTIAL OUTAGE", description: "Partial system outage" },
    critical: { state: "critical", label: "CRITICAL", description: "Critical system outage" },
  });

  const COMPONENT_META = Object.freeze({
    operational: { state: "operational", label: "Operational" },
    degraded_performance: { state: "degraded", label: "Degraded performance" },
    partial_outage: { state: "partial", label: "Partial outage" },
    major_outage: { state: "critical", label: "Major outage" },
    under_maintenance: { state: "maintenance", label: "Maintenance" },
  });

  if (document.getElementById(ROOT_ID)) return;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  const normalizeComponent = (component) => {
    const meta = COMPONENT_META[component?.status] || { state: "unknown", label: "Unknown / unavailable" };
    return { ...component, normalizedState: meta.state, statusLabel: meta.label };
  };

  const inferCategory = (component) => {
    const name = String(component?.name || "").toLowerCase();
    if (/runtime|auth api|login|account session|automation|trigger|telemetry|usage/.test(name)) return "core";
    if (/streamsuites/.test(name) && /dashboard|studio|public|support|docs|console|creator|admin|pages/.test(name)) return "surfaces";
    if (/cloudflare|edge|network|cdn|pages/.test(name)) return "edge";
    return "dependencies";
  };

  const GROUP_LABELS = Object.freeze({
    core: "Core services",
    surfaces: "Product surfaces",
    edge: "Delivery & edge",
    dependencies: "External dependencies",
    other: "Other components",
  });

  const groupComponents = (components) => {
    const source = Array.isArray(components) ? components : [];
    const parentGroups = new Map(
      source.filter((component) => component?.group && component?.id)
        .map((component) => [component.id, component.name || "Component group"])
    );
    const groups = new Map();
    source.filter((component) => !component?.group)
      .map(normalizeComponent)
      .sort((a, b) => {
        const aPosition = Number.isFinite(Number(a.position)) ? Number(a.position) : Number.MAX_SAFE_INTEGER;
        const bPosition = Number.isFinite(Number(b.position)) ? Number(b.position) : Number.MAX_SAFE_INTEGER;
        if (aPosition !== bPosition) return aPosition - bPosition;
        return String(a.name || "").localeCompare(String(b.name || ""));
      })
      .forEach((component) => {
        const id = component.group_id && parentGroups.has(component.group_id)
          ? `statuspage:${component.group_id}`
          : inferCategory(component) || "other";
        const label = id.startsWith("statuspage:")
          ? parentGroups.get(component.group_id)
          : GROUP_LABELS[id] || GROUP_LABELS.other;
        if (!groups.has(id)) groups.set(id, { id, label, components: [] });
        groups.get(id).components.push(component);
      });
    const order = ["core", "surfaces", "edge", "dependencies", "other"];
    return [...groups.values()].sort((a, b) => {
      const aIndex = order.indexOf(a.id);
      const bIndex = order.indexOf(b.id);
      if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      return a.label.localeCompare(b.label);
    });
  };

  const activeIncidents = (incidents) => (Array.isArray(incidents) ? incidents : [])
    .filter((incident) => !["resolved", "postmortem"].includes(String(incident?.status || "").toLowerCase()));

  const activeMaintenances = (maintenances) => (Array.isArray(maintenances) ? maintenances : [])
    .filter((maintenance) => String(maintenance?.status || "").toLowerCase() !== "completed");

  const latestUpdate = (event) => Array.isArray(event?.incident_updates) && event.incident_updates.length
    ? event.incident_updates[0]
    : null;

  const truncate = (value, limit = 150) => {
    const text = String(value || "").trim();
    if (text.length <= limit) return text;
    const slice = text.slice(0, limit);
    const space = slice.lastIndexOf(" ");
    return `${slice.slice(0, space > 70 ? space : limit)}…`;
  };

  const formatRelative = (value) => {
    const timestamp = Date.parse(value || "");
    if (!Number.isFinite(timestamp)) return "Time unavailable";
    const delta = Date.now() - timestamp;
    const absolute = Math.abs(delta);
    for (const [unit, size] of [["day", 86400000], ["hour", 3600000], ["minute", 60000]]) {
      if (absolute >= size) {
        return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(-Math.round(delta / size), unit);
      }
    }
    return "Just now";
  };

  const createActions = () => {
    const actions = element("div", "ss-status-actions");
    const primary = element("a", "ss-status-action ss-status-action--primary", "Full StreamSuites status");
    primary.href = PRIMARY_STATUS_URL;
    const external = element("a", "ss-status-action", "Atlassian page ↗");
    external.href = ATLASSIAN_STATUS_URL;
    external.target = "_blank";
    external.rel = "noopener noreferrer";
    actions.append(primary, external);
    return actions;
  };

  const createWidget = () => {
    const root = element("div", "ss-status-indicator");
    root.id = ROOT_ID;
    root.dataset.state = "unknown";
    root.dataset.layout = "inline";
    root.dataset.expanded = "false";

    const toggle = element("button", "ss-status-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", DETAILS_ID);
    toggle.setAttribute("aria-label", "Open complete StreamSuites service status");
    const dot = element("span", "ss-status-dot");
    dot.setAttribute("aria-hidden", "true");
    const label = element("span", "ss-status-label", "UNKNOWN");
    const icon = document.createElement("img");
    icon.className = "ss-status-expand-icon";
    icon.src = "/assets/icons/ui/plus.svg";
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    toggle.append(dot, label, icon);

    const details = element("section", "ss-status-details");
    details.id = DETAILS_ID;
    details.hidden = true;
    details.setAttribute("aria-label", "Detailed StreamSuites service status");
    details.setAttribute("aria-live", "polite");
    root.append(toggle, details);
    return { root, toggle, dot, label, icon, details };
  };

  const setSummaryState = (widget, summary) => {
    const indicator = String(summary?.status?.indicator || "").toLowerCase();
    const meta = INDICATOR_META[indicator] || { state: "unknown", label: "UNKNOWN", description: "Status unavailable" };
    widget.root.dataset.state = meta.state;
    widget.label.textContent = meta.label;
    return meta;
  };

  const appendHeader = (widget, description, snapshot) => {
    const header = element("header", "ss-status-header");
    const copy = element("div", "ss-status-header-copy");
    copy.append(
      element("p", "ss-status-eyebrow", snapshot.live ? "Live Atlassian Statuspage" : snapshot.stale ? "Last successful public read" : "Public read unavailable"),
      element("h2", "ss-status-title", description),
      element("span", "ss-status-freshness", `Checked ${formatRelative(snapshot.checkedAt)}${snapshot.latencyMs == null ? "" : ` · ${snapshot.latencyMs} ms`}`)
    );
    const close = element("button", "ss-status-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close status details");
    header.append(copy, close);
    widget.details.appendChild(header);
    return close;
  };

  const appendStats = (widget, components, incidents, maintenances, snapshot) => {
    const operational = components.filter((component) => component.normalizedState === "operational").length;
    const stats = element("div", "ss-status-stats");
    for (const [value, label] of [
      [String(components.length), "Components"],
      [String(components.length - operational), "Attention"],
      [String(incidents.length), "Incidents"],
      [snapshot.latencyMs == null ? "—" : `${snapshot.latencyMs}ms`, "Response"],
    ]) {
      const item = element("div");
      item.append(element("strong", "", value), element("span", "", label));
      stats.appendChild(item);
    }
    widget.details.appendChild(stats);
  };

  const appendComponentGroup = (root, group) => {
    const section = element("section", "ss-status-section");
    const heading = element("div", "ss-status-section-head");
    const operational = group.components.filter((component) => component.normalizedState === "operational").length;
    heading.append(element("h3", "", group.label), element("span", "", `${operational}/${group.components.length} operational`));
    const list = element("ul", "ss-status-list");
    group.components.forEach((component) => {
      const item = element("li", "ss-status-component");
      item.dataset.state = component.normalizedState;
      item.append(
        element("span", "ss-status-component-dot"),
        element("span", "ss-status-component-name", component.name || "Unnamed component"),
        element("span", "ss-status-component-state", component.statusLabel)
      );
      list.appendChild(item);
    });
    section.append(heading, list);
    root.appendChild(section);
  };

  const appendEventSection = (root, title, items, kind) => {
    const section = element("section", "ss-status-section");
    const heading = element("div", "ss-status-section-head");
    heading.append(element("h3", "", title), element("span", "", String(items.length)));
    section.appendChild(heading);
    if (!items.length) {
      section.appendChild(element("p", "ss-status-empty", kind === "incident" ? "No active incidents reported." : "No active maintenance windows reported."));
    } else {
      items.forEach((item) => {
        const update = latestUpdate(item);
        const card = element("article", "ss-status-event");
        card.append(
          element("h4", "", item.name || (kind === "incident" ? "Untitled incident" : "Scheduled maintenance")),
          element("p", "", truncate(update?.body || "No additional detail is available."))
        );
        const meta = element("div", "ss-status-event-meta");
        meta.append(element("span", "", String(item.status || "unknown").replaceAll("_", " ")), element("span", "", formatRelative(item.updated_at || update?.created_at || item.created_at)));
        card.appendChild(meta);
        section.appendChild(card);
      });
    }
    root.appendChild(section);
  };

  const render = (widget, snapshot, closeDetails) => {
    const summary = snapshot?.data;
    const meta = setSummaryState(widget, summary);
    widget.root.dataset.stale = String(Boolean(snapshot?.stale));
    widget.details.innerHTML = "";
    const close = appendHeader(widget, summary?.status?.description || meta.description, snapshot);
    close.addEventListener("click", closeDetails);

    if (snapshot.stale) {
      const stale = element("div", "ss-status-stale");
      stale.append(element("span", "", "!"), element("span", "", "Live refresh failed. Showing the last successful in-memory state."));
      widget.details.appendChild(stale);
    }

    const components = (Array.isArray(summary?.components) ? summary.components : [])
      .filter((component) => !component?.group)
      .map(normalizeComponent);
    const incidents = activeIncidents(summary?.incidents);
    const maintenances = activeMaintenances(summary?.scheduled_maintenances);
    appendStats(widget, components, incidents, maintenances, snapshot);

    const scroll = element("div", "ss-status-scroll");
    if (summary) {
      groupComponents(summary.components).forEach((group) => appendComponentGroup(scroll, group));
    } else {
      scroll.appendChild(element("p", "ss-status-empty", "The read-only Atlassian Statuspage feed could not be reached. No local or fabricated operational state is substituted."));
    }
    appendEventSection(scroll, "Active incidents", incidents, "incident");
    appendEventSection(scroll, "Scheduled maintenance", maintenances, "maintenance");
    widget.details.append(scroll, createActions());
  };

  const fetchJson = async (url) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Status fetch failed (${response.status})`);
      return await response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const init = () => {
    const host = document.querySelector("[data-status-slot][data-status-slot-mode='inline']") || document.querySelector("#app-footer [data-status-slot]");
    if (!host) return;
    const footer = host.closest("#app-footer");
    const widget = createWidget();
    host.appendChild(widget.root);

    let pinned = false;
    let hovered = false;
    let focused = false;
    let lastSuccessfulData = null;
    let lastSuccessfulLatency = null;
    let inFlight = null;

    const setExpanded = (expanded) => {
      const next = Boolean(expanded);
      widget.root.dataset.expanded = String(next);
      widget.toggle.setAttribute("aria-expanded", String(next));
      widget.toggle.setAttribute("aria-label", `${next ? "Close" : "Open"} complete StreamSuites service status`);
      widget.details.hidden = !next;
      widget.icon.src = next ? "/assets/icons/ui/cross.svg" : "/assets/icons/ui/plus.svg";
      footer?.classList.toggle("ss-status-details-visible", next);
    };
    const syncExpanded = () => setExpanded(pinned || hovered || focused);
    const closeDetails = () => {
      pinned = false;
      hovered = false;
      focused = false;
      setExpanded(false);
    };

    widget.toggle.addEventListener("click", () => {
      pinned = !pinned;
      syncExpanded();
    });
    widget.root.addEventListener("mouseenter", () => { hovered = true; syncExpanded(); });
    widget.root.addEventListener("mouseleave", () => { hovered = false; syncExpanded(); });
    widget.root.addEventListener("focusin", () => { focused = true; syncExpanded(); });
    widget.root.addEventListener("focusout", () => window.requestAnimationFrame(() => {
      focused = widget.root.contains(document.activeElement);
      syncExpanded();
    }));
    widget.root.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      closeDetails();
      widget.toggle.focus();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!pinned || widget.root.contains(event.target)) return;
      pinned = false;
      syncExpanded();
    });

    const refresh = () => {
      if (inFlight) return inFlight;
      const started = performance.now();
      inFlight = Promise.allSettled([
        fetchJson(ENDPOINTS.summary),
        fetchJson(ENDPOINTS.incidents),
        fetchJson(ENDPOINTS.maintenances),
      ]).then((results) => {
        if (results[0].status !== "fulfilled") throw results[0].reason;
        const data = { ...results[0].value };
        if (Array.isArray(results[1].value?.incidents)) data.incidents = results[1].value.incidents;
        if (Array.isArray(results[2].value?.scheduled_maintenances)) data.scheduled_maintenances = results[2].value.scheduled_maintenances;
        if (!Array.isArray(data.incidents)) data.incidents = [];
        if (!Array.isArray(data.scheduled_maintenances)) data.scheduled_maintenances = [];
        lastSuccessfulData = data;
        lastSuccessfulLatency = Math.max(0, Math.round(performance.now() - started));
        render(widget, { data, live: true, stale: false, checkedAt: new Date().toISOString(), latencyMs: lastSuccessfulLatency }, closeDetails);
      }).catch(() => {
        render(widget, {
          data: lastSuccessfulData,
          live: false,
          stale: Boolean(lastSuccessfulData),
          checkedAt: new Date().toISOString(),
          latencyMs: lastSuccessfulLatency,
        }, closeDetails);
      }).finally(() => { inFlight = null; });
      return inFlight;
    };

    void refresh();
    window.setInterval(refresh, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void refresh();
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

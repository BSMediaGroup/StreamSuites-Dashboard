(() => {
  const API_URL = "https://v0hwlmly3pd2.statuspage.io/api/v2/summary.json";
  const STATUS_URL = "https://streamsuites.statuspage.io/";
  const ROOT_ID = "ss-status-indicator";
  const DETAILS_ID = "ss-status-details";
  const FOOTER_EDGE_SELECTOR = '[data-ss-footer-edge="true"]';

  if (document.getElementById(ROOT_ID)) return;

  const parsePixels = (value, fallback = 0) => {
    const next = Number.parseFloat(value);
    return Number.isFinite(next) ? next : fallback;
  };

  const toTitle = (value) => {
    if (!value) return "";
    return String(value)
      .replace(/_/g, " ")
      .split(" ")
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
      .join(" ");
  };

  const truncateText = (value, limit) => {
    if (!value) return "";
    const text = String(value).trim();
    if (text.length <= limit) return text;
    const slice = text.slice(0, limit);
    const lastSpace = slice.lastIndexOf(" ");
    if (lastSpace > 40) {
      return `${slice.slice(0, lastSpace)}...`;
    }
    return `${slice}...`;
  };

  const buildSection = (titleText, items) => {
    const section = document.createElement("div");
    section.className = "ss-status-section";
    const title = document.createElement("div");
    title.className = "ss-status-section-title";
    title.textContent = titleText;
    const list = document.createElement("ul");
    list.className = "ss-status-list";
    items.forEach((item) => list.appendChild(item));
    section.append(title, list);
    return section;
  };

  const createListItem = ({ title, meta, body }) => {
    const item = document.createElement("li");
    item.className = "ss-status-item";

    const titleEl = document.createElement("div");
    titleEl.className = "ss-status-item-title";
    titleEl.textContent = title;
    item.appendChild(titleEl);

    if (meta) {
      const metaEl = document.createElement("div");
      metaEl.className = "ss-status-item-meta";
      metaEl.textContent = meta;
      item.appendChild(metaEl);
    }

    if (body) {
      const bodyEl = document.createElement("div");
      bodyEl.className = "ss-status-item-body";
      bodyEl.textContent = body;
      item.appendChild(bodyEl);
    }

    return item;
  };

  const createLink = () => {
    const link = document.createElement("a");
    link.className = "ss-status-link";
    link.href = STATUS_URL;
    link.rel = "noreferrer";
    link.target = "_blank";
    link.textContent = "View full status →";
    return link;
  };

  const computeState = (components) => {
    if (components.some((component) => component.status === "major_outage")) {
      return "major";
    }
    if (
      components.some(
        (component) =>
          component.status === "partial_outage" ||
          component.status === "degraded_performance"
      )
    ) {
      return "partial";
    }
    return "operational";
  };

  const createWidgetElements = () => {
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "ss-status-indicator";
    root.dataset.state = "unknown";
    root.dataset.expanded = "false";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "ss-status-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", DETAILS_ID);
    toggle.setAttribute("aria-label", "Service status details");

    const dot = document.createElement("span");
    dot.className = "ss-status-dot";
    dot.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "ss-status-label";
    label.textContent = "Status";

    const details = document.createElement("div");
    details.id = DETAILS_ID;
    details.className = "ss-status-details";
    details.hidden = true;

    toggle.append(dot, label);
    root.append(toggle, details);
    return { root, toggle, details };
  };

  const renderUnavailable = ({ root, details }) => {
    root.dataset.state = "unknown";
    details.innerHTML = "";
    const summary = document.createElement("div");
    summary.className = "ss-status-summary";
    summary.textContent = "Status unavailable.";
    details.append(summary, createLink());
  };

  const renderSummary = ({ root, details }, summary) => {
    const components = Array.isArray(summary?.components) ? summary.components : [];
    const incidents = Array.isArray(summary?.incidents) ? summary.incidents : [];
    const maintenances = Array.isArray(summary?.scheduled_maintenances)
      ? summary.scheduled_maintenances
      : [];

    const impactedComponents = components.filter(
      (component) => component.status !== "operational"
    );

    root.dataset.state = computeState(components);
    details.innerHTML = "";

    const description = summary?.status?.description || "Status unavailable.";
    const summaryEl = document.createElement("div");
    summaryEl.className = "ss-status-summary";
    summaryEl.textContent = description;
    details.appendChild(summaryEl);

    if (impactedComponents.length) {
      const items = impactedComponents.map((component) =>
        createListItem({
          title: component.name || "Unnamed Component",
          meta: toTitle(component.status) || "Status Unknown",
        })
      );
      details.appendChild(buildSection("Components", items));
    }

    const unresolvedIncidents = incidents.filter(
      (incident) => incident.status !== "resolved"
    );
    if (unresolvedIncidents.length) {
      const items = unresolvedIncidents.map((incident) => {
        const update = Array.isArray(incident.incident_updates)
          ? incident.incident_updates[0]
          : null;
        return createListItem({
          title: incident.name || "Untitled Incident",
          meta: toTitle(incident.status) || "Unknown",
          body: truncateText(update?.body || "", 180) || null,
        });
      });
      details.appendChild(buildSection("Incidents", items));
    }

    const activeMaintenances = maintenances.filter(
      (maintenance) => maintenance.status !== "completed"
    );
    if (activeMaintenances.length) {
      const items = activeMaintenances.map((maintenance) =>
        createListItem({
          title: maintenance.name || "Scheduled Maintenance",
          meta: toTitle(maintenance.status) || "Scheduled",
        })
      );
      details.appendChild(buildSection("Maintenance", items));
    }

    details.appendChild(createLink());
    return incidents.length > 0 || impactedComponents.length > 0;
  };

  const isVisibleElement = (value) => {
    if (!(value instanceof HTMLElement)) return false;
    const rect = value.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const resolveFooterEdgeTarget = () => {
    const preferred = document.querySelector(FOOTER_EDGE_SELECTOR);
    if (isVisibleElement(preferred)) return preferred;

    const selectors = [
      ".footer-shell",
      "#app-footer.creator-footer",
      "footer.creator-footer",
      "footer.public-footer",
      "footer.ss-footer",
      "footer",
      "[role='contentinfo']",
    ];
    const seen = new Set();
    const candidates = [];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((candidate) => {
        if (!(candidate instanceof HTMLElement) || seen.has(candidate)) return;
        seen.add(candidate);
        if (!isVisibleElement(candidate)) return;
        candidates.push(candidate);
      });
    });

    if (!candidates.length) return null;
    return candidates.reduce((best, candidate) => {
      if (!best) return candidate;
      return candidate.getBoundingClientRect().top > best.getBoundingClientRect().top
        ? candidate
        : best;
    }, null);
  };

  const initFooterAvoidance = (root, hasFooterSlot) => {
    let footerOffsetRaf = 0;
    let observedFooter = null;
    let footerObserver = null;

    const readBaseBottom = () => {
      const inlineBottom = root.style.bottom;
      root.style.bottom = "";
      const baseBottom = parsePixels(window.getComputedStyle(root).bottom, 10);
      root.style.bottom = inlineBottom;
      return baseBottom;
    };

    const getFooterEdge = () =>
      isVisibleElement(observedFooter) ? observedFooter : resolveFooterEdgeTarget();

    const applyFooterOffset = () => {
      footerOffsetRaf = 0;

      if (hasFooterSlot) {
        root.style.bottom = "";
        return;
      }

      const footerEdge = getFooterEdge();
      if (!footerEdge) {
        root.style.bottom = "";
        return;
      }

      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const overlap = Math.max(0, viewportHeight - footerEdge.getBoundingClientRect().top);
      const baseBottom = readBaseBottom();
      const clearance = 8;
      const downwardShift = 20;
      root.style.bottom =
        overlap > 0
          ? `${Math.ceil(baseBottom + overlap + clearance - downwardShift)}px`
          : "";
    };

    const requestFooterOffsetUpdate = () => {
      if (footerOffsetRaf) return;
      footerOffsetRaf = window.requestAnimationFrame(applyFooterOffset);
    };

    const bindFooterEdge = () => {
      const nextFooter = resolveFooterEdgeTarget();
      if (nextFooter === observedFooter) return;

      observedFooter = nextFooter;
      if (footerObserver) {
        footerObserver.disconnect();
        footerObserver = null;
      }

      if (observedFooter && "ResizeObserver" in window) {
        footerObserver = new ResizeObserver(requestFooterOffsetUpdate);
        footerObserver.observe(observedFooter);
      }

      requestFooterOffsetUpdate();
    };

    if (!hasFooterSlot) {
      bindFooterEdge();
      if ("MutationObserver" in window) {
        const mutationObserver = new MutationObserver(bindFooterEdge);
        mutationObserver.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "style", "data-ss-footer-edge"],
        });
      }
    }

    const scrollRoots = [window];
    const appMain = document.getElementById("app-main");
    if (appMain) {
      scrollRoots.push(appMain);
    }
    scrollRoots.forEach((target) => {
      target.addEventListener("scroll", requestFooterOffsetUpdate, { passive: true });
    });

    window.addEventListener("resize", requestFooterOffsetUpdate);
    window.addEventListener("load", requestFooterOffsetUpdate, { once: true });
    requestFooterOffsetUpdate();
  };

  const initStatusWidget = () => {
    const widget = createWidgetElements();
    const { root, toggle, details } = widget;

    const host = document.querySelector("[data-status-slot]");
    if (host) {
      host.appendChild(root);
    } else {
      document.body.appendChild(root);
    }
    const hasFooterSlot = Boolean(host);

    let userToggled = false;
    const setExpanded = (expanded) => {
      const isExpanded = Boolean(expanded);
      root.dataset.expanded = String(isExpanded);
      toggle.setAttribute("aria-expanded", String(isExpanded));
      details.hidden = !isExpanded;
    };

    toggle.addEventListener("click", () => {
      userToggled = true;
      setExpanded(root.dataset.expanded !== "true");
    });

    const fetchStatus = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(API_URL, {
          signal: controller.signal,
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("status fetch failed");

        const data = await response.json();
        const shouldExpand = renderSummary(widget, data);
        if (!userToggled) {
          setExpanded(shouldExpand);
        }
      } catch (error) {
        renderUnavailable(widget);
      } finally {
        clearTimeout(timeout);
      }
    };

    fetchStatus();
    initFooterAvoidance(root, hasFooterSlot);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStatusWidget, { once: true });
  } else {
    initStatusWidget();
  }
})();

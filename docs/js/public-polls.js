(() => {
  const POLL_INTERVAL_MS = 12000;
  const RUNTIME_POLL_PATH = "./shared/state/polls.json";

  const grid = document.getElementById("polls-grid");
  const emptyState = document.getElementById("polls-empty");
  let pollTimer = null;
  let runtimePollingLogged = false;
  let runtimeProbeComplete = false;

  function renderSkeleton(count = 4) {
    if (!grid) return;
    grid.innerHTML = "";
    for (let i = 0; i < count; i += 1) {
      const card = document.createElement("div");
      card.className = "card";

      const body = document.createElement("div");
      body.className = "card-body";

      const lineA = document.createElement("div");
      lineA.className = "skeleton-line skeleton";

      const lineB = document.createElement("div");
      lineB.className = "skeleton-line skeleton short";

      const lineC = document.createElement("div");
      lineC.className = "skeleton-line skeleton medium";

      body.append(lineA, lineB, lineC);
      card.appendChild(body);
      grid.appendChild(card);
    }
  }

  function buildResultRow(option) {
    const row = document.createElement("div");
    row.className = "result-row";

    const label = document.createElement("div");
    label.className = "result-label";
    label.innerHTML = `<span>${option.label}</span><span>${option.percent}%</span>`;

    const bar = document.createElement("div");
    bar.className = "result-bar";
    const fill = document.createElement("span");
    fill.style.width = `${Math.min(option.percent, 100)}%`;
    bar.appendChild(fill);

    row.append(label, bar);
    return row;
  }

  function buildPiePreview(poll) {
    const preview = document.createElement("div");
    preview.className = "pie-preview";

    const pie = document.createElement("div");
    pie.className = "pie-chart";

    const legend = document.createElement("div");
    legend.className = "pie-legend";

    const swatches = ["primary", "secondary", "tertiary"];
    (poll.options || []).slice(0, 3).forEach((option, index) => {
      const item = document.createElement("div");
      item.className = "pie-legend-item";
      const swatch = document.createElement("span");
      swatch.className = `pie-swatch ${swatches[index] || "primary"}`;
      const label = document.createElement("span");
      label.textContent = `${option.label} • ${option.percent}%`;
      item.append(swatch, label);
      legend.appendChild(item);
    });

    preview.append(pie, legend);
    return preview;
  }

  function buildPollCard(poll) {
    const link = document.createElement("a");
    link.className = "card-link";
    link.href = `/polls/detail.html?id=${encodeURIComponent(poll.id)}`;

    const card = document.createElement("article");
    card.className = "card";

    const body = document.createElement("div");
    body.className = "card-body";

    const heading = document.createElement("div");
    heading.className = "title";
    heading.textContent = poll.question;

    const meta = document.createElement("div");
    meta.className = "meta-row";

    const creator = document.createElement("span");
    creator.textContent = poll.creator?.name || poll.creator || "Creator";

    const divider = document.createElement("span");
    divider.className = "divider";
    divider.textContent = "•";

    const status = document.createElement("span");
    const statusClass = (poll.status || "").toLowerCase();
    status.className = `poll-status ${statusClass}`;
    status.textContent = poll.status || "Pending";

    const timestamp = document.createElement("span");
    timestamp.className = "timestamp";
    timestamp.textContent = poll.timestamp || "Scheduled";

    meta.append(creator, divider, status, divider.cloneNode(true), timestamp);

    const results = document.createElement("div");
    results.className = "results";
    if ((poll.chartType || "").toLowerCase() === "pie") {
      results.appendChild(buildPiePreview(poll));
    } else {
      (poll.options || []).forEach((option) => {
        results.appendChild(buildResultRow(option));
      });
    }

    const footer = document.createElement("div");
    footer.className = "meta-row";

    const idLabel = document.createElement("span");
    idLabel.textContent = poll.id;

    const more = document.createElement("span");
    more.className = "more-link";
    more.innerHTML = "View details →";

    footer.append(idLabel, more);

    body.append(heading, meta, results, footer);
    card.appendChild(body);
    link.appendChild(card);
    return link;
  }

  function renderPolls(items) {
    if (!grid || !emptyState) return;
    grid.innerHTML = "";

    if (!items || items.length === 0) {
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    const fragment = document.createDocumentFragment();
    items.forEach((poll) => fragment.appendChild(buildPollCard(poll)));
    grid.appendChild(fragment);
  }

  function formatTimestamp(value) {
    if (!value) return "Scheduled";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, { hour12: false });
  }

  function normalizeOptions(options = []) {
    const normalized = Array.isArray(options) ? options : [];
    const totalVotes = normalized.reduce((sum, option) => {
      const votes = option?.votes ?? option?.count ?? option?.value ?? 0;
      return sum + (Number.isFinite(votes) ? votes : 0);
    }, 0);

    return normalized.map((option) => {
      const votes = option?.votes ?? option?.count ?? option?.value ?? 0;
      const percent =
        typeof option?.percent === "number"
          ? option.percent
          : totalVotes > 0
            ? Math.round((votes / totalVotes) * 100)
            : 0;
      return {
        label: option?.label || option?.name || option?.option || "Option",
        votes: Number.isFinite(votes) ? votes : 0,
        percent
      };
    });
  }

  function normalizePoll(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = raw.id || raw.poll_id || raw.pollId;
    if (!id) return null;

    return {
      id,
      question: raw.question || raw.title || "Creator poll",
      creator: raw.creator || "Creator",
      status: raw.status || raw.state || "Pending",
      timestamp: formatTimestamp(raw.opened_at || raw.created_at || raw.createdAt),
      summary: raw.summary || raw.description || "",
      chartType: raw.chart_type || raw.chartType || "bar",
      options: normalizeOptions(raw.options || raw.choices || []),
      createdAt: formatTimestamp(raw.created_at || raw.opened_at || raw.createdAt),
      updatedAt: formatTimestamp(raw.updated_at || raw.updatedAt || raw.closed_at),
      closesAt: formatTimestamp(raw.closed_at || raw.closes_at || raw.closesAt)
    };
  }

  function normalizePollsPayload(payload) {
    if (!payload) return [];
    const items =
      payload.polls ||
      payload.items ||
      (Array.isArray(payload) ? payload : null);
    if (!Array.isArray(items)) return [];
    return items.map(normalizePoll).filter(Boolean);
  }

  async function fetchRuntimePolls() {
    const loader = window.StreamSuitesState?.loadStateJson;
    if (typeof loader === "function") {
      const data = await loader("polls.json");
      return normalizePollsPayload(data);
    }

    try {
      const res = await fetch(new URL(RUNTIME_POLL_PATH, document.baseURI), {
        cache: "no-store"
      });
      if (!res.ok) {
        window.__RUNTIME_AVAILABLE__ = false;
        return null;
      }
      const data = await res.json();
      window.__RUNTIME_AVAILABLE__ = true;
      return normalizePollsPayload(data);
    } catch (err) {
      window.__RUNTIME_AVAILABLE__ = false;
      console.warn("[Polls] Failed to load runtime polls", err);
      return null;
    }
  }

  function getFallbackPolls() {
    const fallback = window.publicPolls || [];
    if (Array.isArray(fallback) && fallback.length > 0 && fallback[0]?.options) {
      return fallback;
    }
    return normalizePollsPayload(fallback);
  }

  async function hydratePolls() {
    let runtimePolls = null;
    if (window.__RUNTIME_AVAILABLE__ === true || !runtimeProbeComplete) {
      runtimePolls = await fetchRuntimePolls();
      runtimeProbeComplete = true;
    }
    const items = runtimePolls && runtimePolls.length > 0 ? runtimePolls : getFallbackPolls();
    window.publicPolls = items;
    window.publicPollMap = items.reduce((acc, poll) => {
      acc[poll.id] = poll;
      return acc;
    }, {});
    renderPolls(items);
  }

  function startPolling() {
    if (window.__RUNTIME_AVAILABLE__ !== true) {
      if (!runtimePollingLogged) {
        console.info("[Dashboard] Runtime unavailable. Polling disabled.");
        runtimePollingLogged = true;
      }
      return;
    }
    if (pollTimer) return;
    pollTimer = setInterval(hydratePolls, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  function handleVisibility() {
    if (document.visibilityState === "visible") {
      hydratePolls();
      startPolling();
    } else {
      stopPolling();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!grid) return;
    renderSkeleton();
    requestAnimationFrame(() => {
      hydratePolls();
      startPolling();
    });
    document.addEventListener("visibilitychange", handleVisibility);
  });
})();

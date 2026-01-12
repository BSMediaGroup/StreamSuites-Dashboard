(() => {
  const params = new URLSearchParams(window.location.search);
  const pollId = params.get("id");
  const RUNTIME_POLL_PATH = "../shared/state/polls.json";
  const POLL_REFRESH_MS = 12000;
  let poll = null;
  let pollTimer = null;
  let runtimePollingLogged = false;
  let initialized = false;
  const defaultPalette = ["#8cc736", "#ffae00", "#5bc0de", "#7e03aa"];

  const metaEl = document.getElementById("poll-meta");
  const voteListEl = document.getElementById("vote-list");
  const timestampsEl = document.getElementById("poll-timestamps");
  const titleEl = document.getElementById("poll-title");
  const subtitleEl = document.getElementById("poll-subtitle");
  const vizToggleButtons = document.querySelectorAll(".viz-toggle-btn");
  const vizViews = document.querySelectorAll(".viz-view");
  const pieLegend = document.getElementById("pie-legend");
  const barRows = document.getElementById("bar-rows");
  const interactivePies = document.querySelectorAll(".interactive-pie");
  const colorToggle = document.getElementById("color-toggle");
  const colorPanel = document.getElementById("color-panel");
  const colorPanelBody = document.getElementById("color-panel-body");
  const colorClose = document.getElementById("color-close");
  const maximizeToggle = document.getElementById("maximize-toggle");
  const visualizationPanel = document.querySelector(".visualization-panel");
  const vizOverlay = document.getElementById("viz-overlay");

  const formatTimestamp = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, { hour12: false });
  };

  const normalizeOptions = (options = []) => {
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
        percent,
        color: option?.color || null
      };
    });
  };

  const normalizePoll = (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const id = raw.id || raw.poll_id || raw.pollId;
    if (!id) return null;

    return {
      id,
      question: raw.question || raw.title || "Creator poll",
      summary: raw.summary || raw.description || "",
      creator: raw.creator || "Creator",
      status: raw.status || raw.state || "Pending",
      options: normalizeOptions(raw.options || raw.choices || []),
      chartType: raw.chart_type || raw.chartType || "bar",
      createdAt: formatTimestamp(raw.created_at || raw.opened_at || raw.createdAt),
      updatedAt: formatTimestamp(raw.updated_at || raw.updatedAt || raw.closed_at),
      closesAt: formatTimestamp(raw.closed_at || raw.closes_at || raw.closesAt)
    };
  };

  const normalizePollsPayload = (payload) => {
    if (!payload) return [];
    const items =
      payload.polls ||
      payload.items ||
      (Array.isArray(payload) ? payload : null);
    if (!Array.isArray(items)) return [];
    return items.map(normalizePoll).filter(Boolean);
  };

  const fetchRuntimePolls = async () => {
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
      console.warn("[Poll Detail] Failed to load runtime polls", err);
      return null;
    }
  };

  const resolvePoll = async () => {
    const runtimePolls = await fetchRuntimePolls();
    const runtimeMatch = runtimePolls?.find((item) => item.id === pollId);
    if (runtimeMatch) return runtimeMatch;

    const fallback = window.publicPollMap?.[pollId] || (window.publicPolls || [])[0];
    return normalizePoll(fallback) || fallback || null;
  };

  const normalizeHex = (value) => {
    if (!value || typeof value !== "string") return null;
    const trimmed = value.trim();
    const match = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (!match) return null;
    const hex = match[1];
    if (hex.length === 3) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase();
    }
    return `#${hex.toLowerCase()}`;
  };

  const getColor = (option, index) => {
    const normalized = normalizeHex(option.color);
    const resolved = normalized || defaultPalette[index % defaultPalette.length];
    option.color = resolved;
    return resolved;
  };

  const toRgba = (hex, alpha = 0.25) => {
    if (!hex || typeof hex !== "string") return `rgba(0, 255, 251, ${alpha})`;
    const normalized = hex.replace("#", "");
    const isShort = normalized.length === 3;
    const r = parseInt(isShort ? normalized[0] + normalized[0] : normalized.substring(0, 2), 16);
    const g = parseInt(isShort ? normalized[1] + normalized[1] : normalized.substring(2, 4), 16);
    const b = parseInt(isShort ? normalized[2] + normalized[2] : normalized.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  function buildAvatar(creator = {}) {
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    if (creator.avatar) {
      avatar.style.backgroundImage = `url(${creator.avatar})`;
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
      avatar.style.border = "1px solid rgba(255, 255, 255, 0.12)";
    } else {
      avatar.classList.add("fallback");
    }
    return avatar;
  }

  function renderMeta() {
    if (!metaEl) return;
    metaEl.innerHTML = "";

    const creatorRow = document.createElement("div");
    creatorRow.className = "creator";
    creatorRow.append(buildAvatar(poll.creator || {}), document.createTextNode(poll.creator?.name || "Creator"));

    const statusRow = document.createElement("div");
    statusRow.className = "meta-row";
    const statusLabel = document.createElement("span");
    statusLabel.className = "label";
    statusLabel.textContent = "Status";
    const statusChip = document.createElement("span");
    statusChip.className = `poll-status ${(poll.status || "").toLowerCase()}`;
    statusChip.textContent = poll.status || "Pending";
    statusRow.append(statusLabel, statusChip);

    const idRow = document.createElement("div");
    idRow.className = "meta-row";
    idRow.innerHTML = `<span class="label">Poll ID</span> <span>${poll.id}</span>`;

    metaEl.append(creatorRow, statusRow, idRow);
  }

  function renderVotes() {
    if (!voteListEl) return;
    voteListEl.innerHTML = "";

    (poll.options || []).forEach((option) => {
      const li = document.createElement("li");
      li.className = "vote-item";
      const label = document.createElement("strong");
      label.textContent = option.label;
      const meta = document.createElement("span");
      meta.className = "timestamp";
      meta.textContent = `${option.percent}% • ${option.votes || 0} votes`;
      li.append(label, meta);
      voteListEl.appendChild(li);
    });
  }

  function renderCharts() {
    const swatches = ["primary", "secondary", "tertiary"];
    const pieSurfaces = document.querySelectorAll(".pie-surface");

    const buildLegend = (targetEl) => {
      if (!targetEl) return;
      targetEl.innerHTML = "";
      (poll.options || []).slice(0, 3).forEach((option, index) => {
        const item = document.createElement("div");
        item.className = "pie-legend-item";
        const swatch = document.createElement("span");
        swatch.className = `pie-swatch ${swatches[index] || "primary"}`;
        swatch.style.background = getColor(option, index);
        const label = document.createElement("span");
        label.textContent = `${option.label} • ${option.percent}%`;
        item.append(swatch, label);
        targetEl.appendChild(item);
      });
    };

    const buildBars = () => {
      if (!barRows) return;
      barRows.innerHTML = "";
      (poll.options || []).forEach((option, index) => {
        const row = document.createElement("div");
        row.className = "bar-row";
        const label = document.createElement("div");
        label.className = "bar-label";
        label.textContent = `${option.label}`;
        const meter = document.createElement("div");
        meter.className = "bar-meter";
        const fill = document.createElement("span");
        const baseColor = getColor(option, index);
        fill.style.width = `${option.percent}%`;
        fill.style.background = `linear-gradient(90deg, ${baseColor}, ${baseColor})`;
        fill.style.boxShadow = `0 8px 20px ${toRgba(baseColor, 0.25)}`;
        meter.appendChild(fill);
        const meta = document.createElement("div");
        meta.className = "bar-meta";
        meta.textContent = `${option.percent}% • ${option.votes || 0} votes`;
        row.append(label, meter, meta);
        barRows.appendChild(row);
      });
    };

    const buildPieGradients = () => {
      const options = poll.options || [];
      const totalPercent = options.reduce((acc, opt) => acc + (opt.percent || 0), 0);
      const useTotal = totalPercent > 0 ? totalPercent : 100;
      const slices = options.length || 1;
      let start = 0;
      const stops = options.map((opt, idx) => {
        const percent = totalPercent > 0 ? opt.percent : 100 / slices;
        const end = start + (percent / useTotal) * 360;
        const color = getColor(opt, idx);
        const segment = `${color} ${start}deg ${end}deg`;
        start = end;
        return segment;
      });

      if (!stops.length) {
        stops.push(`${defaultPalette[0]} 0deg 360deg`);
      }

      pieSurfaces.forEach((surface) => {
        surface.style.background = `conic-gradient(${stops.join(",")})`;
      });
    };

    buildLegend(pieLegend);
    buildBars();
    buildPieGradients();
  }

  function buildColorControls() {
    if (!colorPanelBody) return;
    colorPanelBody.innerHTML = "";
    const options = poll.options || [];
    if (!options.length) {
      const empty = document.createElement("span");
      empty.className = "timestamp";
      empty.textContent = "No slice colors available yet.";
      colorPanelBody.appendChild(empty);
      return;
    }

    options.forEach((option, index) => {
      let resolvedColor = getColor(option, index);
      const row = document.createElement("div");
      row.className = "color-row";

      const labelWrap = document.createElement("div");
      labelWrap.className = "color-label";
      const label = document.createElement("span");
      label.textContent = option.label;
      const swatch = document.createElement("span");
      swatch.className = "color-swatch";
      swatch.style.background = resolvedColor;
      labelWrap.append(label, swatch);

      const inputs = document.createElement("div");
      inputs.className = "color-inputs";
      const picker = document.createElement("input");
      picker.type = "color";
      picker.value = resolvedColor;
      const hexInput = document.createElement("input");
      hexInput.type = "text";
      hexInput.value = resolvedColor;
      hexInput.maxLength = 7;
      hexInput.placeholder = "#RRGGBB";

      const applyColor = (value) => {
        const normalized = normalizeHex(value) || resolvedColor;
        resolvedColor = normalized;
        option.color = normalized;
        picker.value = normalized;
        hexInput.value = normalized;
        swatch.style.background = normalized;
        renderCharts();
      };

      picker.addEventListener("input", () => applyColor(picker.value));
      hexInput.addEventListener("change", () => applyColor(hexInput.value));
      hexInput.addEventListener("blur", () => applyColor(hexInput.value));

      inputs.append(picker, hexInput);
      row.append(labelWrap, inputs);
      colorPanelBody.appendChild(row);
    });
  }

  function toggleColorPanel(forceOpen) {
    if (!colorPanel || !colorToggle) return;
    const isOpen = typeof forceOpen === "boolean" ? forceOpen : colorPanel.hidden;
    colorPanel.hidden = !isOpen;
    colorToggle.setAttribute("aria-expanded", String(isOpen));
  }

  function bindColorPanel() {
    if (!colorPanel || !colorToggle) return;
    colorToggle.addEventListener("click", () => toggleColorPanel());
    if (colorClose) {
      colorClose.addEventListener("click", () => toggleColorPanel(false));
    }
    document.addEventListener("click", (event) => {
      if (colorPanel.hidden) return;
      const target = event.target;
      if (colorPanel.contains(target) || colorToggle.contains(target)) return;
      toggleColorPanel(false);
    });
  }

  function setActiveView(view) {
    vizToggleButtons.forEach((btn) => {
      const isActive = btn.dataset.view === view;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
    vizViews.forEach((panel) => {
      const isActive = panel.dataset.view === view;
      panel.classList.toggle("active", isActive);
      panel.hidden = !isActive;
    });
  }

  function bindToggles() {
    vizToggleButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        setActiveView(btn.dataset.view);
      });
    });
  }

  function bindMaximize() {
    if (!maximizeToggle || !visualizationPanel) return;
    const setMaximized = (force) => {
      const shouldExpand =
        typeof force === "boolean" ? force : !visualizationPanel.classList.contains("is-expanded");
      visualizationPanel.classList.toggle("is-expanded", shouldExpand);
      document.body.classList.toggle("viz-expanded", shouldExpand);
      if (vizOverlay) vizOverlay.hidden = !shouldExpand;
      maximizeToggle.textContent = shouldExpand ? "Restore view" : "Maximize";
      maximizeToggle.setAttribute("aria-pressed", String(shouldExpand));
    };

    maximizeToggle.addEventListener("click", () => setMaximized());
    if (vizOverlay) {
      vizOverlay.addEventListener("click", () => setMaximized(false));
    }
    window.addEventListener("keyup", (event) => {
      if (event.key === "Escape") setMaximized(false);
    });
  }

  function bindPieRotation() {
    const isTabVisible = () => document.visibilityState !== "hidden";
    interactivePies.forEach((pie) => {
      let isDragging = false;
      let startAngle = 0;
      let currentRotation = 0;
      let velocity = 0;
      let lastMoveTime = performance.now();
      let lastFrameTime = 0;

      const surface = pie.querySelector(".pie-surface");
      if (!surface) return;
      const applyRotation = () => {
        pie.style.setProperty("--pie-rotation", `${currentRotation}deg`);
      };

      const onDown = (event) => {
        event.preventDefault();
        isDragging = true;
        pie.classList.add("is-dragging");
        const rect = pie.getBoundingClientRect();
        const center = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
        const angle = Math.atan2(event.clientY - center.y, event.clientX - center.x);
        startAngle = angle - (currentRotation * Math.PI) / 180;
        velocity = 0;
        lastMoveTime = performance.now();
      };

      const onMove = (event) => {
        if (!isDragging) return;
        const rect = pie.getBoundingClientRect();
        const center = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
        const angle = Math.atan2(event.clientY - center.y, event.clientX - center.x);
        const newRotation = ((angle - startAngle) * 180) / Math.PI;
        const now = performance.now();
        const deltaTime = Math.max(now - lastMoveTime, 1);
        velocity = Math.max(Math.min((newRotation - currentRotation) / deltaTime, 0.8), -0.8);
        currentRotation = newRotation;
        lastMoveTime = now;
        applyRotation();
      };

      const onUp = () => {
        if (!isDragging) return;
        isDragging = false;
        pie.classList.remove("is-dragging");
        lastFrameTime = performance.now();
      };

      surface.addEventListener("mousedown", onDown);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);

      const tick = (timestamp) => {
        if (!lastFrameTime) {
          lastFrameTime = timestamp;
          requestAnimationFrame(tick);
          return;
        }
        const delta = timestamp - lastFrameTime;
        lastFrameTime = timestamp;

        if (!isTabVisible()) {
          requestAnimationFrame(tick);
          return;
        }

        if (!isDragging) {
          const spinRate = 0.0045; // degrees per ms
          if (Math.abs(velocity) > 0.0005) {
            currentRotation += velocity * delta;
            const friction = 0.92 ** (delta / 16);
            velocity *= friction;
            if (Math.abs(velocity) < 0.0005) velocity = 0;
          }
          currentRotation += spinRate * delta;
          applyRotation();
        }

        requestAnimationFrame(tick);
      };

      document.addEventListener("visibilitychange", () => {
        lastFrameTime = performance.now();
      });

      applyRotation();
      requestAnimationFrame(tick);
    });
  }

  function renderHeader() {
    if (titleEl) titleEl.textContent = poll.question || "Creator poll";
    if (subtitleEl) {
      subtitleEl.textContent =
        poll.summary || "Community voting details and breakdown.";
    }
    if (timestampsEl) {
      const created = poll.createdAt ? `Created ${poll.createdAt}` : null;
      const updated = poll.updatedAt ? `Updated ${poll.updatedAt}` : null;
      const closes = poll.closesAt ? `Closes ${poll.closesAt}` : null;
      timestampsEl.textContent = [created, updated, closes].filter(Boolean).join(" • ");
    }
  }

  function applyPoll(nextPoll, preserveView = true) {
    poll = nextPoll;
    renderHeader();
    renderMeta();
    renderVotes();
    renderCharts();
    buildColorControls();

    const activeView = preserveView
      ? document.querySelector(".viz-toggle-btn.is-active")?.dataset.view
      : null;
    setActiveView(activeView || "bar");

    if (!initialized) {
      bindToggles();
      bindColorPanel();
      bindMaximize();
      bindPieRotation();
      initialized = true;
    }
  }

  async function refreshPoll() {
    const runtimePolls = await fetchRuntimePolls();
    const next = pollId
      ? runtimePolls?.find((item) => item.id === pollId)
      : runtimePolls?.[0];
    if (next) {
      applyPoll(next, true);
    }
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
    pollTimer = setInterval(refreshPoll, POLL_REFRESH_MS);
  }

  function stopPolling() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  async function init() {
    poll = await resolvePoll();
    if (!poll) {
      if (titleEl) titleEl.textContent = "Poll not found";
      if (subtitleEl) {
        subtitleEl.textContent =
          "The requested poll ID is unavailable. Please return to the polls grid.";
      }
      return;
    }

    applyPoll(poll, false);
    startPolling();

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        refreshPoll();
        startPolling();
      } else {
        stopPolling();
      }
    });
  }

  init();
})();

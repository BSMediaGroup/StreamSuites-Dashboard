(() => {
  const params = new URLSearchParams(window.location.search);
  const pollId = params.get("id");
  const poll = window.publicPollMap?.[pollId] || (window.publicPolls || [])[0];
  const defaultPalette = ["#8cc736", "#ffae00", "#5bc0de", "#7e03aa"];

  const metaEl = document.getElementById("poll-meta");
  const voteListEl = document.getElementById("vote-list");
  const timestampsEl = document.getElementById("poll-timestamps");
  const titleEl = document.getElementById("poll-title");
  const subtitleEl = document.getElementById("poll-subtitle");
  const vizToggleButtons = document.querySelectorAll(".viz-toggle-btn");
  const vizViews = document.querySelectorAll(".viz-view");
  const pieLegend = document.getElementById("pie-legend");
  const customLegend = document.getElementById("custom-legend");
  const barRows = document.getElementById("bar-rows");
  const interactivePies = document.querySelectorAll(".interactive-pie");

  if (!poll) {
    if (titleEl) titleEl.textContent = "Poll not found";
    if (subtitleEl) subtitleEl.textContent = "The requested poll ID is unavailable. Please return to the polls grid.";
    return;
  }

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
    const getColor = (option, index) => option.color || defaultPalette[index % defaultPalette.length];
    const toRgba = (hex, alpha = 0.25) => {
      if (!hex || typeof hex !== "string") return `rgba(0, 255, 251, ${alpha})`;
      const normalized = hex.replace("#", "");
      const isShort = normalized.length === 3;
      const r = parseInt(isShort ? normalized[0] + normalized[0] : normalized.substring(0, 2), 16);
      const g = parseInt(isShort ? normalized[1] + normalized[1] : normalized.substring(2, 4), 16);
      const b = parseInt(isShort ? normalized[2] + normalized[2] : normalized.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

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
    buildLegend(customLegend);
    buildBars();
    buildPieGradients();
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

  function bindPieRotation() {
    interactivePies.forEach((pie) => {
      let isDragging = false;
      let startAngle = 0;
      let currentRotation = 0;

      const surface = pie.querySelector(".pie-surface");
      if (!surface) return;
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
      };

      const onMove = (event) => {
        if (!isDragging) return;
        const rect = pie.getBoundingClientRect();
        const center = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
        const angle = Math.atan2(event.clientY - center.y, event.clientX - center.x);
        currentRotation = ((angle - startAngle) * 180) / Math.PI;
        pie.style.setProperty("--pie-rotation", `${currentRotation}deg`);
      };

      const onUp = () => {
        if (!isDragging) return;
        isDragging = false;
        pie.classList.remove("is-dragging");
      };

      surface.addEventListener("mousedown", onDown);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
  }

  if (titleEl) titleEl.textContent = poll.question || "Creator poll";
  if (subtitleEl) subtitleEl.textContent = poll.summary || "Community voting details and breakdown.";
  if (timestampsEl) {
    const created = poll.createdAt ? `Created ${poll.createdAt}` : null;
    const updated = poll.updatedAt ? `Updated ${poll.updatedAt}` : null;
    const closes = poll.closesAt ? `Closes ${poll.closesAt}` : null;
    timestampsEl.textContent = [created, updated, closes].filter(Boolean).join(" • ");
  }

  renderMeta();
  renderVotes();
  renderCharts();
  setActiveView((poll.chartType || "pie").toLowerCase());
  bindToggles();
  bindPieRotation();
})();

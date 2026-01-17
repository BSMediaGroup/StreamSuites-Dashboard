(() => {
  const params = new URLSearchParams(window.location.search);
  const tallyId = params.get("id");
  const tally = window.publicTallyMap?.[tallyId] || (window.publicTallies || [])[0];
  const defaultPalette = ["#8cc736", "#ffae00", "#5bc0de", "#7e03aa"];
  const defaultLogoPath = "/assets/logos/logocircle.png";

  const metaEl = document.getElementById("tally-meta");
  const tallyListEl = document.getElementById("tally-list");
  const timestampsEl = document.getElementById("tally-timestamps");
  const titleEl = document.getElementById("tally-title");
  const subtitleEl = document.getElementById("tally-subtitle");
  const vizToggleButtons = document.querySelectorAll(".viz-toggle-btn");
  const vizViews = document.querySelectorAll(".viz-view");
  const pieLegend = document.getElementById("pie-legend");
  const customLegend = document.getElementById("custom-legend");
  const barRows = document.getElementById("bar-rows");
  const interactivePies = document.querySelectorAll(".interactive-pie");
  const colorToggle = document.getElementById("color-toggle");
  const colorPanel = document.getElementById("color-panel");
  const colorPanelBody = document.getElementById("color-panel-body");
  const colorClose = document.getElementById("color-close");
  const maximizeToggle = document.getElementById("maximize-toggle");
  const visualizationPanel = document.querySelector(".visualization-panel");
  const vizOverlay = document.getElementById("viz-overlay");
  const customLogoImg = document.getElementById("custom-pie-logo");

  if (!tally) {
    if (titleEl) titleEl.textContent = "Tally not found";
    if (subtitleEl) subtitleEl.textContent = "The requested tally ID is unavailable. Please return to the tallies grid.";
    return;
  }

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

  const getColor = (entry, index) => {
    const normalized = normalizeHex(entry.color);
    const resolved = normalized || defaultPalette[index % defaultPalette.length];
    entry.color = resolved;
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

  function setCustomLogo() {
    if (!customLogoImg) return;
    const fallbackUrl = new URL(defaultLogoPath, window.location.href).toString();
    const customLogo = tally.centerLogo || tally.customLogo || window.customPieLogo || window.streamSuitesCustomLogo || defaultLogoPath;
    customLogoImg.src = customLogo;
    customLogoImg.alt = tally.creator?.name ? `${tally.creator.name} logo` : "StreamSuites logo";
    customLogoImg.onerror = () => {
      if (customLogoImg.src !== fallbackUrl) {
        customLogoImg.src = fallbackUrl;
      }
    };
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
    creatorRow.append(buildAvatar(tally.creator || {}), document.createTextNode(tally.creator?.name || "Creator"));

    const statusRow = document.createElement("div");
    statusRow.className = "meta-row";
    const statusLabel = document.createElement("span");
    statusLabel.className = "label";
    statusLabel.textContent = "Status";
    const statusChip = document.createElement("span");
    statusChip.className = `poll-status ${(tally.status || "").toLowerCase()}`;
    statusChip.textContent = tally.status || "Pending";
    statusRow.append(statusLabel, statusChip);

    const idRow = document.createElement("div");
    idRow.className = "meta-row";
    idRow.innerHTML = `<span class="label">Tally ID</span> <span>${tally.id}</span>`;

    metaEl.append(creatorRow, statusRow, idRow);
  }

  function renderEntries() {
    if (!tallyListEl) return;
    tallyListEl.innerHTML = "";

    (tally.entries || []).forEach((entry) => {
      const li = document.createElement("li");
      li.className = "vote-item";
      const label = document.createElement("strong");
      label.textContent = entry.label;
      const meta = document.createElement("span");
      meta.className = "timestamp";
      const votesLabel = entry.count != null ? `${entry.count} counts` : `${entry.votes || 0} votes`;
      meta.textContent = `${entry.percent}% • ${votesLabel}`;
      li.append(label, meta);
      tallyListEl.appendChild(li);
    });
  }

  function renderCharts() {
    const swatches = ["primary", "secondary", "tertiary"];
    const pieSurfaces = document.querySelectorAll(".pie-surface");

    const buildLegend = (targetEl) => {
      if (!targetEl) return;
      targetEl.innerHTML = "";
      (tally.entries || []).slice(0, 3).forEach((entry, index) => {
        const item = document.createElement("div");
        item.className = "pie-legend-item";
        const swatch = document.createElement("span");
        swatch.className = `pie-swatch ${swatches[index] || "primary"}`;
        swatch.style.background = getColor(entry, index);
        const label = document.createElement("span");
        label.textContent = `${entry.label} • ${entry.percent}%`;
        item.append(swatch, label);
        targetEl.appendChild(item);
      });
    };

    const buildBars = () => {
      if (!barRows) return;
      barRows.innerHTML = "";
      (tally.entries || []).forEach((entry, index) => {
        const row = document.createElement("div");
        row.className = "bar-row";
        const label = document.createElement("div");
        label.className = "bar-label";
        label.textContent = `${entry.label}`;
        const meter = document.createElement("div");
        meter.className = "bar-meter";
        const fill = document.createElement("span");
        const baseColor = getColor(entry, index);
        fill.style.width = `${entry.percent}%`;
        fill.style.background = `linear-gradient(90deg, ${baseColor}, ${baseColor})`;
        fill.style.boxShadow = `0 8px 20px ${toRgba(baseColor, 0.25)}`;
        meter.appendChild(fill);
        const meta = document.createElement("div");
        meta.className = "bar-meta";
        const votesLabel = entry.count != null ? `${entry.count} counts` : `${entry.votes || 0} votes`;
        meta.textContent = `${entry.percent}% • ${votesLabel}`;
        row.append(label, meter, meta);
        barRows.appendChild(row);
      });
    };

    const buildPieGradients = () => {
      const entries = tally.entries || [];
      const totalPercent = entries.reduce((acc, opt) => acc + (opt.percent || 0), 0);
      const useTotal = totalPercent > 0 ? totalPercent : 100;
      const slices = entries.length || 1;
      let start = 0;
      const stops = entries.map((opt, idx) => {
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

  function buildColorControls() {
    if (!colorPanelBody) return;
    colorPanelBody.innerHTML = "";
    const entries = tally.entries || [];
    if (!entries.length) {
      const empty = document.createElement("span");
      empty.className = "timestamp";
      empty.textContent = "No slice colors available yet.";
      colorPanelBody.appendChild(empty);
      return;
    }

    entries.forEach((entry, index) => {
      let resolvedColor = getColor(entry, index);
      const row = document.createElement("div");
      row.className = "color-row";

      const labelWrap = document.createElement("div");
      labelWrap.className = "color-label";
      const label = document.createElement("span");
      label.textContent = entry.label;
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
        entry.color = normalized;
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

  if (titleEl) titleEl.textContent = tally.title || "Programmatic tally";
  if (subtitleEl) {
    const description = tally.summary || "Aggregated results refreshed on a cadence.";
    subtitleEl.textContent = description;
  }
  if (timestampsEl) {
    const windowLabel = tally.window ? `${tally.window}` : null;
    const refreshed = tally.updatedAt ? `Updated ${tally.updatedAt}` : null;
    const scope = tally.scope ? `${tally.scope}` : null;
    timestampsEl.textContent = [windowLabel, refreshed, scope].filter(Boolean).join(" • ");
  }

  setCustomLogo();
  renderMeta();
  renderEntries();
  renderCharts();
  buildColorControls();
  setActiveView("bar");
  bindToggles();
  bindColorPanel();
  bindMaximize();
  bindPieRotation();
})();

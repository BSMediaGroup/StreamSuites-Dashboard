(() => {
  const params = new URLSearchParams(window.location.search);
  const clipId = params.get("id");
  const data = window.publicClipMap?.[clipId] || (window.publicClips || [])[0];

  const titleEl = document.getElementById("clip-title");
  const subtitleEl = document.getElementById("clip-subtitle");
  const mediaEl = document.getElementById("clip-media");
  const bodyEl = document.getElementById("clip-body");
  const metaEl = document.getElementById("clip-meta");
  const statusEl = document.getElementById("clip-status");

  if (!data) {
    if (titleEl) titleEl.textContent = "Clip not found";
    if (subtitleEl) subtitleEl.textContent = "The requested clip ID is unavailable. Please return to the gallery.";
    if (bodyEl) bodyEl.innerHTML = "<p class=\"description\">No clip data to display.</p>";
    return;
  }

  function platformClass(platform = "") {
    const normalized = platform.toLowerCase();
    if (["rumble", "youtube", "twitch", "twitter"].includes(normalized)) return normalized;
    return "generic";
  }

  function platformIcon(platform = "") {
    const normalized = platform.toLowerCase();
    const iconMap = {
      rumble: "../assets/icons/rumble.svg",
      youtube: "../assets/icons/youtube.svg",
      twitch: "../assets/icons/twitch.svg",
      twitter: "../assets/icons/twitter.svg",
    };
    return iconMap[normalized] || "../assets/icons/pilled.svg";
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

  function renderPlatformBadge(platform = "Platform") {
    const badge = document.createElement("span");
    badge.className = `platform-badge ${platformClass(platform)}`;
    const icon = document.createElement("img");
    icon.src = platformIcon(platform);
    icon.alt = `${platform} icon`;
    icon.className = "badge-icon";
    const label = document.createElement("span");
    label.textContent = platform.toUpperCase();
    badge.append(icon, label);
    return badge;
  }

  function setStatus(el, status = "Pending") {
    if (!el) return;
    el.className = "status-chip";
    el.classList.add((status || "").toLowerCase());
    el.textContent = status;
  }

  function renderMedia() {
    if (!mediaEl) return;
    const fallback = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="640" height="360" viewBox="0 0 640 360" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgDetail" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1b1e24"/>
            <stop offset="100%" stop-color="#0f1116"/>
          </linearGradient>
        </defs>
        <rect width="640" height="360" fill="url(#bgDetail)" />
        <rect x="24" y="24" width="592" height="312" rx="14" stroke="#3b3f4a" stroke-width="2" fill="none"/>
        <text x="50%" y="50%" fill="#8cc736" font-family="SuiGenerisRg, Arial, sans-serif" font-size="20" text-anchor="middle">Video placeholder</text>
      </svg>
    `)}`;
    const source = data.thumbnail || fallback;
    mediaEl.style.background = `url(${source}) center/cover, radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.05), rgba(0, 0, 0, 0.5))`;
    const placeholder = mediaEl.querySelector(".placeholder");
    if (placeholder) placeholder.textContent = "Video placeholder";
  }

  function renderBody() {
    if (!bodyEl) return;
    const summary = document.createElement("p");
    summary.className = "description";
    summary.textContent = data.summary || "Clip summary coming soon.";

    const footer = document.createElement("div");
    footer.className = "detail-footer";
    footer.innerHTML = `
      <span class="label">Clip ID</span> <span>${data.id}</span>
      <span class="divider">•</span>
      <span class="label">Duration</span> <span>${data.duration || "—"}</span>
      <span class="divider">•</span>
      <span class="label">Date</span> <span>${data.date || "—"}</span>
    `;

    bodyEl.innerHTML = "";
    bodyEl.append(summary, footer);
  }

  function renderMeta() {
    if (!metaEl) return;
    metaEl.innerHTML = "";

    const creatorRow = document.createElement("div");
    creatorRow.className = "creator";
    creatorRow.append(buildAvatar(data.creator || {}), document.createTextNode(data.creator?.name || "Creator"));

    const platformRow = document.createElement("div");
    platformRow.className = "meta-row";
    platformRow.append(renderPlatformBadge(data.platform || "Platform"));

    const statusRow = document.createElement("div");
    statusRow.className = "meta-row";
    const statusLabel = document.createElement("span");
    statusLabel.className = "label";
    statusLabel.textContent = "Status";
    const statusValue = document.createElement("span");
    statusValue.className = `status-chip ${(data.status || "").toLowerCase()}`;
    statusValue.textContent = data.status || "Pending";
    statusRow.append(statusLabel, statusValue);

    const timingRow = document.createElement("div");
    timingRow.className = "meta-row";
    timingRow.innerHTML = `<span class="label">Duration</span> <span>${data.duration || "—"}</span> <span class="divider">•</span> <span class="label">Date</span> <span>${data.date || "—"}</span>`;

    metaEl.append(creatorRow, platformRow, statusRow, timingRow);
  }

  if (titleEl) titleEl.textContent = data.title || "Clip";
  if (subtitleEl) subtitleEl.textContent = data.summary || "Clip details and metadata.";
  renderMedia();
  renderBody();
  renderMeta();
  setStatus(statusEl, data.status);
})();

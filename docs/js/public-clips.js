(() => {
  const grid = document.getElementById("clips-grid");
  const emptyState = document.getElementById("clips-empty");

  const fallbackThumb = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg width="640" height="360" viewBox="0 0 640 360" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1b1e24"/>
          <stop offset="100%" stop-color="#0f1116"/>
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill="url(#bg)" />
      <rect x="24" y="24" width="592" height="312" rx="14" stroke="#3b3f4a" stroke-width="2" fill="none"/>
      <text x="50%" y="50%" fill="#8cc736" font-family="SuiGenerisRg, Arial, sans-serif" font-size="20" text-anchor="middle">Thumbnail pending</text>
    </svg>
  `)}`;

  function platformClass(platform = "") {
    const normalized = platform.toLowerCase();
    if (["rumble", "youtube", "twitch", "twitter"].includes(normalized)) return normalized;
    return "generic";
  }

  function platformIcon(platform = "") {
    const normalized = platform.toLowerCase();
    const iconMap = {
      rumble: "./assets/icons/rumble.svg",
      youtube: "./assets/icons/youtube.svg",
      twitch: "./assets/icons/twitch.svg",
      twitter: "./assets/icons/twitter.svg",
    };
    return iconMap[normalized] || "./assets/icons/pilled.svg";
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

  function renderSkeleton(count = 6) {
    if (!grid) return;
    grid.innerHTML = "";
    for (let i = 0; i < count; i += 1) {
      const card = document.createElement("div");
      card.className = "card";

      const thumb = document.createElement("div");
      thumb.className = "thumb skeleton skeleton-thumb";

      const body = document.createElement("div");
      body.className = "card-body";

      const lineA = document.createElement("div");
      lineA.className = "skeleton-line skeleton";

      const lineB = document.createElement("div");
      lineB.className = "skeleton-line skeleton short";

      const lineC = document.createElement("div");
      lineC.className = "skeleton-line skeleton medium";

      body.appendChild(lineA);
      body.appendChild(lineB);
      body.appendChild(lineC);
      card.appendChild(thumb);
      card.appendChild(body);
      grid.appendChild(card);
    }
  }

  function buildClipCard(clip) {
    const link = document.createElement("a");
    link.className = "card-link";
    link.href = `./clips/detail.html?id=${encodeURIComponent(clip.id)}`;

    const card = document.createElement("article");
    card.className = "card";

    const thumb = document.createElement("div");
    thumb.className = "thumb";

    const img = document.createElement("img");
    img.src = clip.thumbnail || fallbackThumb;
    img.alt = `${clip.title} thumbnail`;
    img.onerror = () => {
      img.onerror = null;
      img.src = fallbackThumb;
    };

    const duration = document.createElement("div");
    duration.className = "duration";
    duration.textContent = clip.duration || "Soon";

    thumb.appendChild(img);
    thumb.appendChild(duration);

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = clip.title;

    const metaRow = document.createElement("div");
    metaRow.className = "meta-row";

    const creator = document.createElement("span");
    creator.className = "creator";
    const avatar = buildAvatar(clip.creator || {});
    const creatorName = document.createElement("span");
    creatorName.textContent = clip.creator?.name || clip.creator || "Creator";
    creator.append(avatar, creatorName);

    const divider = document.createElement("span");
    divider.className = "divider";
    divider.textContent = "•";

    const platform = document.createElement("span");
    platform.className = `platform-badge ${platformClass(clip.platform)}`;
    const platformIconEl = document.createElement("img");
    platformIconEl.src = platformIcon(clip.platform);
    platformIconEl.alt = `${clip.platform || "Platform"} icon`;
    platformIconEl.className = "badge-icon";
    const platformLabel = document.createElement("span");
    platformLabel.textContent = (clip.platform || "Platform").toUpperCase();
    platform.append(platformIconEl, platformLabel);

    const status = document.createElement("span");
    const statusClass = (clip.status || "").toLowerCase();
    status.className = `status-chip ${statusClass}`;
    status.textContent = clip.status || "Pending";

    metaRow.append(creator, divider, platform, status);

    const footer = document.createElement("div");
    footer.className = "clip-footer";
    footer.innerHTML = `<span>${clip.id}</span><span>${clip.date || "—"}</span>`;

    body.append(title, metaRow, footer);
    card.append(thumb, body);
    link.appendChild(card);
    return link;
  }

  function renderClips(items) {
    if (!grid || !emptyState) return;
    grid.innerHTML = "";

    if (!items || items.length === 0) {
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    const fragment = document.createDocumentFragment();
    items.forEach((clip) => {
      fragment.appendChild(buildClipCard(clip));
    });
    grid.appendChild(fragment);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!grid) return;
    renderSkeleton(6);
    requestAnimationFrame(() => renderClips(window.publicClips || []));
  });
})();

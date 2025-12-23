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

  const clips = [
    {
      id: "rumble-2481",
      title: "Aftershow highlight: Community AMA",
      creator: "NovaByte",
      platform: "Rumble",
      status: "Published",
      duration: "08:42",
      url: "https://rumble.com/streamsuites",
      thumbnail: null,
    },
    {
      id: "yt-9921",
      title: "Feature walkthrough: Scoreboards primer",
      creator: "Aster",
      platform: "YouTube",
      status: "Encoding",
      duration: "05:12",
      url: "https://youtube.com/@StreamSuites",
      thumbnail: "./assets/backgrounds/seodash.jpg",
    },
    {
      id: "tw-5577",
      title: "Live capture: Chat replay stress test",
      creator: "RelayOps",
      platform: "Twitch",
      status: "Pending",
      duration: "12:01",
      url: "https://twitch.tv",
      thumbnail: null,
    },
    {
      id: "rumble-3180",
      title: "Creator onboarding: Clips pipeline",
      creator: "StreamLabs",
      platform: "Rumble",
      status: "Published",
      duration: "03:48",
      url: "https://rumble.com/streamsuites",
      thumbnail: "./assets/logos/LOG2-3D-SML.png",
    },
    {
      id: "ss-4412",
      title: "Platform badge routing demo",
      creator: "Internal QA",
      platform: "Twitter",
      status: "Published",
      duration: "02:16",
      url: "https://twitter.com",
      thumbnail: null,
    },
    {
      id: "yt-0044",
      title: "Studio feed: Lighting adjustments",
      creator: "NovaByte",
      platform: "YouTube",
      status: "Encoding",
      duration: "09:34",
      url: "https://youtube.com/@StreamSuites",
      thumbnail: null,
    },
    {
      id: "rumble-9011",
      title: "Creator spotlight: Weekend recap",
      creator: "Harbor",
      platform: "Rumble",
      status: "Published",
      duration: "04:55",
      url: "https://rumble.com/streamsuites",
      thumbnail: null,
    },
    {
      id: "ss-7718",
      title: "Pipeline health: placeholder ingest",
      creator: "RelayOps",
      platform: "Generic",
      status: "Pending",
      duration: "06:03",
      url: "https://example.com",
      thumbnail: null,
    },
  ];

  function platformClass(platform = "") {
    const normalized = platform.toLowerCase();
    if (["rumble", "youtube", "twitch", "twitter"].includes(normalized)) return normalized;
    return "generic";
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
    link.href = clip.url || "#";
    link.target = "_blank";
    link.rel = "noopener noreferrer";

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
    creator.innerHTML = `<span class="dot"></span>${clip.creator}`;

    const divider = document.createElement("span");
    divider.className = "divider";
    divider.textContent = "•";

    const platform = document.createElement("span");
    platform.className = `platform-badge ${platformClass(clip.platform)}`;
    platform.textContent = clip.platform || "Platform";

    const status = document.createElement("span");
    const statusClass = (clip.status || "").toLowerCase();
    status.className = `status-chip ${statusClass}`;
    status.textContent = clip.status || "Pending";

    metaRow.append(creator, divider, platform, status);

    const footer = document.createElement("div");
    footer.className = "clip-footer";
    footer.innerHTML = `<span>${clip.id}</span><span>${clip.duration || "—"}</span>`;

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
    requestAnimationFrame(() => renderClips(clips));
  });
})();

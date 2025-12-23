(() => {
  const params = new URLSearchParams(window.location.search);
  const pollId = params.get("id");
  const poll = window.publicPollMap?.[pollId] || (window.publicPolls || [])[0];

  const questionEl = document.getElementById("poll-question");
  const statusEl = document.getElementById("poll-status");
  const metaEl = document.getElementById("poll-meta");
  const summaryEl = document.getElementById("poll-summary");
  const voteListEl = document.getElementById("vote-list");
  const timestampsEl = document.getElementById("poll-timestamps");
  const titleEl = document.getElementById("poll-title");
  const subtitleEl = document.getElementById("poll-subtitle");

  if (!poll) {
    if (questionEl) questionEl.textContent = "Poll not found";
    if (summaryEl) summaryEl.textContent = "The requested poll ID is unavailable. Please return to the polls grid.";
    return;
  }

  function setStatus(el, status = "Pending") {
    if (!el) return;
    el.className = "poll-status";
    el.classList.add((status || "").toLowerCase());
    el.textContent = status;
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

  if (questionEl) questionEl.textContent = poll.question || "Poll question";
  if (titleEl) titleEl.textContent = poll.question || "Creator poll";
  if (subtitleEl) subtitleEl.textContent = poll.summary || "Community voting details and breakdown.";
  if (summaryEl) summaryEl.textContent = poll.summary || "Poll overview.";
  if (timestampsEl) {
    const created = poll.createdAt ? `Created ${poll.createdAt}` : null;
    const updated = poll.updatedAt ? `Updated ${poll.updatedAt}` : null;
    const closes = poll.closesAt ? `Closes ${poll.closesAt}` : null;
    timestampsEl.textContent = [created, updated, closes].filter(Boolean).join(" • ");
  }

  renderMeta();
  renderVotes();
  setStatus(statusEl, poll.status);
})();

(() => {
  const grid = document.getElementById("tallies-grid");
  const emptyState = document.getElementById("tallies-empty");

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

  function buildResultRow(entry) {
    const row = document.createElement("div");
    row.className = "result-row";

    const label = document.createElement("div");
    label.className = "result-label";
    label.innerHTML = `<span>${entry.label}</span><span>${entry.percent}%</span>`;

    const bar = document.createElement("div");
    bar.className = "result-bar";
    const fill = document.createElement("span");
    fill.style.width = `${Math.min(entry.percent, 100)}%`;
    bar.appendChild(fill);

    row.append(label, bar);
    return row;
  }

  function buildTalliesCard(tally) {
    const link = document.createElement("a");
    link.className = "card-link";
    link.href = `./tallies/detail.html?id=${encodeURIComponent(tally.id)}`;

    const card = document.createElement("article");
    card.className = "card";

    const body = document.createElement("div");
    body.className = "card-body";

    const heading = document.createElement("div");
    heading.className = "title";
    heading.textContent = tally.title;

    const meta = document.createElement("div");
    meta.className = "meta-row";

    const creator = document.createElement("span");
    creator.textContent = tally.creator?.name || tally.creator || "Creator";

    const divider = document.createElement("span");
    divider.className = "divider";
    divider.textContent = "•";

    const status = document.createElement("span");
    const statusClass = (tally.status || "").toLowerCase();
    status.className = `poll-status ${statusClass}`;
    status.textContent = tally.status || "Pending";

    const timestamp = document.createElement("span");
    timestamp.className = "timestamp";
    timestamp.textContent = tally.window || "Time window";

    meta.append(creator, divider, status, divider.cloneNode(true), timestamp);

    const results = document.createElement("div");
    results.className = "results";
    (tally.entries || []).forEach((entry) => {
      results.appendChild(buildResultRow(entry));
    });

    const footer = document.createElement("div");
    footer.className = "meta-row";

    const idLabel = document.createElement("span");
    idLabel.textContent = tally.id;

    const more = document.createElement("span");
    more.className = "more-link";
    more.innerHTML = "View details →";

    footer.append(idLabel, more);

    body.append(heading, meta, results, footer);
    card.appendChild(body);
    link.appendChild(card);
    return link;
  }

  function renderTallies(items) {
    if (!grid || !emptyState) return;
    grid.innerHTML = "";

    if (!items || items.length === 0) {
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    const fragment = document.createDocumentFragment();
    items.forEach((tally) => fragment.appendChild(buildTalliesCard(tally)));
    grid.appendChild(fragment);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!grid) return;
    renderSkeleton();
    requestAnimationFrame(() => renderTallies(window.publicTallies || []));
  });
})();

(() => {
  "use strict";

  const basePath =
    (window.Versioning && window.Versioning.resolveBasePath &&
      window.Versioning.resolveBasePath()) ||
    (() => {
      const parts = window.location.pathname.split("/").filter(Boolean);
      if (!parts.length) return "";
      const root = parts[0] === "docs" ? "docs" : parts[0];
      return `/${root}`;
    })();

  const dataPath = `${basePath || ""}/data/changelog.json`.replace(/\/+/g, "/");
  const CATEGORY_ORDER = ["Added", "Changed", "Fixed", "Removed"];

  function formatDate(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function renderEntry(entry) {
    if (!entry) return "";
    if (typeof entry === "string") return `<li>${entry}</li>`;

    const content = entry.link
      ? `<a href="${entry.link}" target="_blank" rel="noreferrer">${entry.text}</a>`
      : entry.text;

    return `<li>${content}</li>`;
  }

  function renderCategory(name, items) {
    if (!Array.isArray(items) || items.length === 0) return "";
    return `
      <div class="changelog-category">
        <h4>${name}</h4>
        <ul class="public-list">${items.map(renderEntry).join("")}</ul>
      </div>
    `;
  }

  function renderRelease(release) {
    const dateLabel = formatDate(release.date);
    const categories = CATEGORY_ORDER
      .map((cat) => renderCategory(cat, release?.changes?.[cat]))
      .filter(Boolean)
      .join("");

    return `
      <article class="public-glass-card changelog-entry">
        <div class="section-heading">
          <div class="changelog-title">
            <h3>${release.version || "Unversioned"}</h3>
            ${dateLabel ? `<span class="lede">${dateLabel}</span>` : ""}
          </div>
          ${release.summary ? `<span class="lede">${release.summary}</span>` : ""}
        </div>
        <div class="changelog-body">${categories || "<p class=\"muted\">No entries available.</p>"}</div>
      </article>
    `;
  }

  function renderError(message) {
    const container = document.getElementById("changelog-container");
    if (!container) return;
    container.innerHTML = `
      <article class="public-glass-card changelog-error">
        <div class="section-heading">
          <h3>Unable to load changelog</h3>
          <span class="lede">${message}</span>
        </div>
        <p class="muted">Please refresh the page or try again later.</p>
      </article>
    `;
  }

  async function loadChangelog() {
    try {
      const res = await fetch(dataPath, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      return Array.isArray(payload) ? payload : [];
    } catch (err) {
      console.warn("[Changelog] Failed to load data", err);
      renderError("Changelog data is temporarily unavailable.");
      return [];
    }
  }

  async function init() {
    const container = document.getElementById("changelog-container");
    if (!container) return;

    const releases = await loadChangelog();
    if (!releases.length) {
      renderError("No changelog entries found.");
      return;
    }

    const sorted = [...releases].sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return new Date(b.date) - new Date(a.date);
    });

    container.innerHTML = sorted.map(renderRelease).join("");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

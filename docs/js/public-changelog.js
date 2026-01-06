(() => {
  "use strict";

  const SCOPE_COLORS = {
    dashboard: {
      background: "linear-gradient(135deg, rgba(104, 158, 238, 0.22), rgba(60, 100, 170, 0.32))",
      border: "rgba(114, 168, 240, 0.65)",
      color: "#dbe8ff"
    },
    runtime: {
      background: "linear-gradient(135deg, rgba(240, 181, 95, 0.22), rgba(184, 120, 26, 0.32))",
      border: "rgba(240, 181, 95, 0.7)",
      color: "#ffe8c4"
    },
    global: {
      background: "linear-gradient(135deg, rgba(92, 187, 125, 0.22), rgba(52, 129, 81, 0.32))",
      border: "rgba(92, 187, 125, 0.7)",
      color: "#d8f5e3"
    }
  };

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

  function parseDateToTime(value, label = "") {
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      const suffix = label ? ` for entry: ${label}` : "";
      console.warn(`[Changelog] Unrecognized date ${value}${suffix}`);
      return Number.NEGATIVE_INFINITY;
    }
    return parsed.getTime();
  }

  function renderScopeTag(scope) {
    if (!scope) return "";
    const scopeKey = String(scope).toLowerCase();
    const colors = SCOPE_COLORS[scopeKey] || {
      background: "rgba(255, 255, 255, 0.05)",
      border: "var(--border-subtle)",
      color: "var(--text-secondary)"
    };
    const label = scopeKey.charAt(0).toUpperCase() + scopeKey.slice(1);
    const style = `background:${colors.background};border-color:${colors.border};color:${colors.color};`;
    return `<span class="pill changelog-scope" data-scope="${scopeKey}" style="${style}">${label}</span>`;
  }

  function renderLatestTag(isLatest) {
    if (!isLatest) return "";
    return `<span class="pill pill-success changelog-current" aria-label="Latest release">Latest</span>`;
  }

  function renderDetail(detail) {
    if (!detail) return "";
    if (typeof detail === "string") return `<li>${detail}</li>`;

    const content = detail.link
      ? `<a href="${detail.link}" target="_blank" rel="noreferrer">${detail.text}</a>`
      : detail.text;

    return `<li>${content}</li>`;
  }

  function resolveDetails(release) {
    if (Array.isArray(release?.details) && release.details.length) return release.details;
    if (Array.isArray(release?.entries) && release.entries.length) return release.entries;
    if (Array.isArray(release?.changes) && release.changes.length) return release.changes;
    if (Array.isArray(release?.items) && release.items.length) return release.items;
    if (Array.isArray(release?.bullets) && release.bullets.length) return release.bullets;
    if (release?.summary) return [release.summary];
    if (release?.description) return [release.description];
    return [];
  }

  function renderDetails(details) {
    if (!Array.isArray(details) || !details.length) {
      return "<p class=\"muted\">No entries available.</p>";
    }
    return `<ul class="public-list">${details.map(renderDetail).join("")}</ul>`;
  }

  function renderTags(tags) {
    if (!Array.isArray(tags) || !tags.length) return "";
    return tags.map((tag) => `<span class="pill">${tag}</span>`).join("");
  }

  function renderRelease(release, isCurrent) {
    const dateLabel = formatDate(release.date);
    const scopeTag = renderScopeTag(release.scope);
    const isLatest = isCurrent;
    const versionTag = release.version
      ? `<span class="pill ss-tag-version">Version ${release.version}</span>`
      : "";
    const changeTags = renderTags(release.tags);
    const titleText = release.title || release.version || "Unversioned";
    const displayTitle = isLatest ? `⭐ ${titleText}` : titleText;
    const tagsRow = scopeTag || changeTags
      ? `<div class="changelog-tags-row">${scopeTag}${changeTags}</div>`
      : "";

    return `
      <article class="public-glass-card changelog-entry"${release.scope ? ` data-scope="${release.scope}"` : ""}>
        <div class="section-heading">
          <div class="changelog-header-row">
            <h3 class="changelog-title">${displayTitle}</h3>
            <div class="changelog-meta">
              ${versionTag}
              ${dateLabel ? `<span class="lede">${dateLabel}</span>` : ""}
            </div>
          </div>
          ${release.summary ? `<span class="lede">${release.summary}</span>` : ""}
        </div>
        <div class="changelog-body">${tagsRow}${renderDetails(resolveDetails(release))}</div>
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
      const { loadMergedChangelog } = await import("./changelog-merge.js");
      const entries = await loadMergedChangelog();
      return Array.isArray(entries) ? entries : [];
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
      const aTime = parseDateToTime(a?.date, a?.title || a?.version || "");
      const bTime = parseDateToTime(b?.date, b?.title || b?.version || "");

      if (aTime === bTime) {
        const aKey = a?.id || a?.title || "";
        const bKey = b?.id || b?.title || "";
        return String(aKey).localeCompare(String(bKey));
      }

      return bTime - aTime;
    });

    container.innerHTML = sorted
      .map((release, index) => renderRelease(release, index === 0))
      .join("");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

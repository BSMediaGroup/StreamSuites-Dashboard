/* ======================================================================
   StreamSuites™ Dashboard — About View Logic (JSON-driven)
   Project: StreamSuites™
   Version: v0.2.0-alpha
   Owner: Daniel Clancy
   Copyright: © 2025 Brainstream Media Group
   ====================================================================== */

(() => {
  "use strict";

  let cleanupFns = [];

  function sectionAnchor(sectionId) {
    return `about-${sectionId}`;
  }

  function entryAnchor(sectionId, entryId) {
    return `about-${sectionId}-${entryId}`;
  }

  function renderErrors(errors = []) {
    const container = document.getElementById("about-error-container");
    if (!container) return;

    if (!errors.length) {
      container.innerHTML = "";
      container.style.display = "none";
      return;
    }

    const list = errors
      .map(
        (err) =>
          `<li><strong>${err.source}:</strong> ${err.message || "Unknown error"}</li>`
      )
      .join("");

    container.innerHTML = `<div class="ss-alert ss-alert-warning"><p><strong>About data issues</strong></p><ul>${list}</ul></div>`;
    container.style.display = "block";
  }

  function renderMeta(version, lastUpdated) {
    const versionEl = document.getElementById("about-version-meta");
    if (versionEl) {
      versionEl.textContent = version || "Unavailable";
    }

    const updatedEl = document.getElementById("about-updated-meta");
    if (updatedEl) {
      updatedEl.textContent = lastUpdated || "Unknown";
    }
  }

  function renderSections(sections = []) {
    const container = document.getElementById("about-sections");
    if (!container) return;

    if (!sections.length) {
      container.innerHTML = `<p class="muted">No about sections available.</p>`;
      return;
    }

    const content = sections
      .map((section) => {
        const entries = Array.isArray(section.entries) ? section.entries : [];
        const entryMarkup = entries
          .filter((entry) => entry?.developer)
          .map((entry) => {
            const entryId = entryAnchor(section.id, entry.id);
            const title = entry.developer?.title || entry.consumer?.title || "Untitled";
            const body = entry.developer?.body || "";

            return `
              <article class="ss-about-entry" id="${entryId}">
                <header class="ss-about-entry-header">
                  <a class="ss-anchor" href="#${entryId}">${title}</a>
                </header>
                <div class="ss-about-entry-body">
                  <p>${body}</p>
                </div>
              </article>
            `;
          })
          .join("");

        return `
          <section class="ss-about-section" id="${sectionAnchor(section.id)}">
            <header class="ss-about-section-header">
              <a class="ss-anchor" href="#${sectionAnchor(section.id)}">${section.title}</a>
            </header>
            <div class="ss-about-section-body">
              ${entryMarkup || '<p class="muted">No developer entries in this section.</p>'}
            </div>
          </section>
        `;
      })
      .join("");

    container.innerHTML = content;
  }

  function scrollToHashTarget() {
    const targetId = (location.hash || "").replace(/^#/, "");
    if (!targetId) return;

    requestAnimationFrame(() => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  async function init() {
    if (!window.AboutData) {
      console.warn("[AboutView] AboutData loader is missing.");
      return;
    }

    const data = await AboutData.load();
    renderMeta(data.version, data.lastUpdated);
    renderErrors(data.errors);
    renderSections(data.sections);
    scrollToHashTarget();

    const hashHandler = () => scrollToHashTarget();
    window.addEventListener("hashchange", hashHandler);
    cleanupFns.push(() => window.removeEventListener("hashchange", hashHandler));
  }

  function destroy() {
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];

    const container = document.getElementById("about-sections");
    if (container) container.innerHTML = "";

    const errorContainer = document.getElementById("about-error-container");
    if (errorContainer) {
      errorContainer.innerHTML = "";
      errorContainer.style.display = "none";
    }
  }

  window.AboutView = {
    init,
    destroy
  };
})();

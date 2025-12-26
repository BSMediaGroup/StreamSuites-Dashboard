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
  }

  function initSkillBars(rows) {
    if (!rows || rows.length === 0) return;

    rows.forEach((wrapper) => {
      const fill = wrapper.querySelector(".ss-skill-fill");
      if (!fill) return;

      let score = parseFloat(wrapper.getAttribute("data-score"));
      if (isNaN(score) || score < 0) score = 0;
      if (score > 10) score = 10;

      const targetWidth = (score / 10) * 100;
      const transitionTiming =
        "width 1200ms cubic-bezier(0.19, 1, 0.22, 1)";

      function animateFill() {
        fill.classList.remove("pulsing");
        fill.style.transition = "none";
        fill.style.width = "0%";

        void fill.offsetWidth;

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

  function initSkillToggles(rows) {
    if (!rows || rows.length === 0) return;

    rows.forEach((row) => {
      const desc = row.querySelector(".ss-skill-description");
      const toggle = row.querySelector(".ss-skill-toggle");

      if (desc) {
        desc.style.maxHeight = "0px";
        desc.setAttribute("aria-hidden", "true");
      }

      const handler = () => {
        const isOpen = row.classList.contains("is-open");

        if (openRow && openRow !== row) {
          setRowExpanded(openRow, false);
          openRow = null;
        }

        setRowExpanded(row, !isOpen);
        if (isOpen) openRow = null;
      };

      const clickTargets = [row];
      if (toggle) clickTargets.push(toggle);

      clickTargets.forEach((target) => {
        const boundHandler = (event) => {
          if (target !== row) event.stopPropagation();
          event.preventDefault();
          handler();
        };

        target.addEventListener("click", boundHandler);
        cleanupFns.push(() =>
          target.removeEventListener("click", boundHandler)
        );
      });

      const keyHandler = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        handler();
      };

      row.addEventListener("keydown", keyHandler);
      cleanupFns.push(() =>
        row.removeEventListener("keydown", keyHandler)
      );
    });

    const resizeHandler = () => {
      if (!openRow) return;
      setRowExpanded(openRow, true);
    };

    window.addEventListener("resize", resizeHandler);
    cleanupFns.push(() =>
      window.removeEventListener("resize", resizeHandler)
    );
  }

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

  function renderVersionMetaFromRuntime() {
    if (!window.Versioning) return;

    Versioning.loadVersion().then((info) => {
      if (!info) return;

      const ownerEl = document.getElementById("about-owner-meta");
      if (ownerEl && info.owner) {
        ownerEl.textContent = info.owner;
      }

      const copyrightEl = document.getElementById("about-copyright-meta");
      if (copyrightEl && info.copyright) {
        copyrightEl.textContent = info.copyright;
      }

      const versionEl = document.getElementById("about-version-meta");
      const currentVersionText = versionEl ? versionEl.textContent.trim() : "";
      if (
        versionEl &&
        (!currentVersionText || currentVersionText === "Unavailable" || currentVersionText.includes("Loading"))
      ) {
        versionEl.textContent = Versioning.formatDisplayVersion(info);
      }
    });
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
    const hash = location.hash || "";
    const targetId = hash.replace(/^#/, "");
    if (!targetId) return;

    const parts = hash.split("&");
    const scrollParam = parts.find((p) => p.startsWith("scroll="));
    const scrollTarget = scrollParam ? scrollParam.split("=")[1] : targetId;

    requestAnimationFrame(() => {
      const el = document.getElementById(scrollTarget);
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
    renderVersionMetaFromRuntime();
    renderErrors(data.errors);
    renderSections(data.sections);
    const roadmap = await loadRoadmapData();
    const rows = renderRoadmapRows(roadmap);
    initSkillBars(rows);
    initSkillToggles(rows);
    scrollToHashTarget();

    const hashHandler = () => scrollToHashTarget();
    window.addEventListener("hashchange", hashHandler);
    cleanupFns.push(() => window.removeEventListener("hashchange", hashHandler));
  }

  function destroy() {
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
    openRow = null;

    const container = document.getElementById("about-sections");
    if (container) container.innerHTML = "";

    const errorContainer = document.getElementById("about-error-container");
    if (errorContainer) {
      errorContainer.innerHTML = "";
      errorContainer.style.display = "none";
    }

    const roadmapContainer = document.getElementById("ss-roadmap-rows");
    if (roadmapContainer) roadmapContainer.innerHTML = "";
  }

  window.AboutView = {
    init,
    destroy
  };
})();

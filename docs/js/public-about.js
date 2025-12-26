/* ======================================================================
   StreamSuites™ Public — About Page (Manifest-driven)
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
    const container = document.getElementById("public-about-errors");
    if (!container) return;

    if (!errors.length) {
      container.innerHTML = "";
      container.style.display = "none";
      return;
    }

    const items = errors
      .map(
        (err) =>
          `<li><strong>${err.source}:</strong> ${err.message || "Unknown error"}</li>`
      )
      .join("");

    container.innerHTML = `<div class="public-alert public-alert-warning"><p><strong>About data issues</strong></p><ul>${items}</ul></div>`;
    container.style.display = "block";
  }

  function setDeveloperExpanded(button, body, expanded) {
    if (!button || !body) return;
    button.setAttribute("aria-expanded", expanded ? "true" : "false");
    button.textContent = expanded ? "Hide technical details" : "Show technical details";
    body.hidden = !expanded;
  }

  function attachDeveloperToggles() {
    const toggles = Array.from(
      document.querySelectorAll(".public-about-toggle[data-target]")
    );

    toggles.forEach((btn) => {
      const targetId = btn.getAttribute("data-target");
      const target = document.getElementById(targetId);
      if (!target) return;

      setDeveloperExpanded(btn, target, false);

      const handler = () => {
        const isExpanded = btn.getAttribute("aria-expanded") === "true";
        setDeveloperExpanded(btn, target, !isExpanded);
      };

      btn.addEventListener("click", handler);
      cleanupFns.push(() => btn.removeEventListener("click", handler));
    });
  }

  function renderSections(sections = []) {
    const container = document.getElementById("public-about-sections");
    if (!container) return;

    if (!sections.length) {
      container.innerHTML = `<p class="muted">No about sections available.</p>`;
      return;
    }

    const markup = sections
      .map((section) => {
        const entries = Array.isArray(section.entries) ? section.entries : [];
        const entryMarkup = entries
          .map((entry) => {
            const entryId = entryAnchor(section.id, entry.id);
            const consumer = entry.consumer;
            const developer = entry.developer;

            const consumerBlock = consumer
              ? `
                <div class="public-about-consumer">
                  <h4>${consumer.title || "Untitled"}</h4>
                  <p>${consumer.body || ""}</p>
                </div>
              `
              : "";

            const developerBlock = developer
              ? `
                <div class="public-about-developer">
                  <button class="public-about-toggle" type="button" data-target="${entryId}-developer" aria-expanded="false">
                    Show technical details
                  </button>
                  <div class="public-about-developer-body" id="${entryId}-developer" hidden>
                    <h5>${developer.title || "Technical details"}</h5>
                    <p>${developer.body || ""}</p>
                  </div>
                </div>
              `
              : "";

            return `
              <article class="public-about-entry" id="${entryId}">
                <header class="public-about-entry-header">
                  <a class="public-about-anchor" href="#${entryId}">${consumer?.title || developer?.title || "Untitled"}</a>
                </header>
                ${consumerBlock}
                ${developerBlock}
              </article>
            `;
          })
          .join("");

        return `
          <section class="public-about-section" id="${sectionAnchor(section.id)}">
            <header class="public-about-section-header">
              <a class="public-about-anchor" href="#${sectionAnchor(section.id)}">${section.title}</a>
            </header>
            <div class="public-about-section-body">
              ${entryMarkup}
            </div>
          </section>
        `;
      })
      .join("");

    container.innerHTML = markup;
    attachDeveloperToggles();
  }

  function handleHashNavigation() {
    const targetId = (location.hash || "").replace(/^#/, "");
    if (!targetId) return;

    requestAnimationFrame(() => {
      const el = document.getElementById(targetId);
      if (el) {
        const toggle = el.querySelector(".public-about-toggle[data-target]");
        if (toggle) {
          const target = document.getElementById(toggle.getAttribute("data-target"));
          setDeveloperExpanded(toggle, target, true);
        }
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  async function init() {
    if (!window.AboutData) {
      console.warn("[PublicAbout] AboutData loader is missing.");
      return;
    }

    const data = await AboutData.load();
    renderErrors(data.errors);
    renderSections(data.sections);
    handleHashNavigation();

    const hashHandler = () => handleHashNavigation();
    window.addEventListener("hashchange", hashHandler);
    cleanupFns.push(() => window.removeEventListener("hashchange", hashHandler));
  }

  function destroy() {
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];

    const container = document.getElementById("public-about-sections");
    if (container) container.innerHTML = "";

    const errorContainer = document.getElementById("public-about-errors");
    if (errorContainer) {
      errorContainer.innerHTML = "";
      errorContainer.style.display = "none";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  window.PublicAbout = {
    destroy
  };
})();

// UI refinement: About page container simplification, title deduplication,
// scope grouping, and hover glow alignment with Changelog roadmap
/* ======================================================================
   StreamSuites™ Public — About Page (Manifest-driven)
   Project: StreamSuites™
   Version: v0.2.2-alpha
   Owner: Daniel Clancy
   Copyright: © 2026 Brainstream Media Group
   ====================================================================== */

(() => {
  "use strict";

  let cleanupFns = [];

  const SCOPE_CONFIG = {
    "about_part1_core.json": {
      title: "Core System Overview",
      tone: "core"
    },
    "about_part2_platforms_interfaces.json": {
      title: "Platform Integrations",
      tone: "platforms"
    },
    "about_part3_about_system_spec.json": {
      title: "Architecture & Documentation",
      tone: "architecture"
    }
  };

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

  function normalizeEntry(entry) {
    return {
      id: entry?.id || "",
      order: Number(entry?.order) || 0,
      consumer: entry?.consumer ? { ...entry.consumer } : null,
      developer: entry?.developer ? { ...entry.developer } : null
    };
  }

  function normalizeSection(section) {
    const entries = Array.isArray(section?.entries)
      ? [...section.entries]
          .map(normalizeEntry)
          .sort((a, b) => a.order - b.order)
      : [];

    return {
      id: section?.id || "",
      order: Number(section?.order) || 0,
      title: section?.title || "",
      entries
    };
  }

  function buildAboutPath(path) {
    if (window.AboutData?.buildUrl) return AboutData.buildUrl(path);
    const base = window.AboutData?.resolveBasePath?.() || "";
    return `${base || ""}/${path}`.replace(/\\+/g, "/");
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  }

  async function loadScopedSections() {
    try {
      const manifest = await fetchJson(buildAboutPath("about/about.manifest.json"));
      const sources = Array.isArray(manifest?.sources) ? manifest.sources : [];

      const scopedSections = [];

      for (const source of sources) {
        let payload;
        try {
          payload = await fetchJson(buildAboutPath(`about/${source}`));
        } catch (err) {
          console.warn(`[PublicAbout] Failed to load scoped source ${source}`, err);
          continue;
        }

        const sections = Array.isArray(payload?.sections)
          ? [...payload.sections].map(normalizeSection).sort((a, b) => a.order - b.order)
          : [];

        const config = SCOPE_CONFIG[source] || {};
        scopedSections.push({
          key: source.replace(/\.json$/, ""),
          title: config.title || source,
          tone: config.tone || "general",
          sections
        });
      }

      return scopedSections;
    } catch (err) {
      console.warn("[PublicAbout] Failed to derive scoped sections", err);
      return [];
    }
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

  function renderSections(scopes = []) {
    const container = document.getElementById("public-about-sections");
    if (!container) return;

    if (!scopes.length) {
      container.innerHTML = `<p class="muted">No about sections available.</p>`;
      return;
    }

    const markup = scopes
      .map((scope) => {
        const sectionMarkup = (Array.isArray(scope.sections) ? scope.sections : [])
          .map((section) => {
            const entries = Array.isArray(section.entries) ? section.entries : [];
            const entryMarkup = entries
              .map((entry) => {
                const entryId = entryAnchor(section.id, entry.id);
                const consumer = entry.consumer;
                const developer = entry.developer;
                const title = consumer?.title || developer?.title || "Untitled";

                const consumerBlock = consumer
                  ? `<p class="public-about-body">${consumer.body || ""}</p>`
                  : "";

                const developerBlock = developer
                  ? `
                    <div class="public-about-developer">
                      <button class="public-about-toggle" type="button" data-target="${entryId}-developer" aria-expanded="false">
                        Show technical details
                      </button>
                      <div class="public-about-developer-body" id="${entryId}-developer" hidden>
                        <p>${developer.body || ""}</p>
                      </div>
                    </div>
                  `
                  : "";

                return `
                  <article class="public-about-entry" id="${entryId}" data-scope-tone="${scope.tone}">
                    <header class="public-about-entry-header">
                      <a class="public-about-anchor" href="#${entryId}">${title}</a>
                    </header>
                    ${consumerBlock}
                    ${developerBlock}
                  </article>
                `;
              })
              .join("");

            return `
              <div class="public-about-section" id="${sectionAnchor(section.id)}" data-scope-tone="${scope.tone}">
                <header class="public-about-section-header">
                  <a class="public-about-anchor" href="#${sectionAnchor(section.id)}">${section.title}</a>
                </header>
                <div class="public-about-section-body">
                  ${entryMarkup || '<p class="muted">No entries available.</p>'}
                </div>
              </div>
            `;
          })
          .join("");

        return `
          <section class="public-about-scope" data-scope-tone="${scope.tone}" aria-label="${scope.title}">
            <div class="public-about-scope-header">
              <div class="public-about-scope-bar"></div>
              <div class="public-about-scope-title-row">
                <h3 class="public-about-scope-title">${scope.title}</h3>
              </div>
            </div>
            <div class="public-about-scope-body">
              ${sectionMarkup || '<p class="muted">No sections available.</p>'}
            </div>
          </section>
        `;
      })
      .join("");

    container.innerHTML = markup;
    attachDeveloperToggles();
  }

  function renderMeta(version, lastUpdated, build) {
    const versionEl = document.getElementById("public-about-version-meta");
    if (versionEl) {
      versionEl.textContent = version || "Unavailable";
    }

    const buildEl = document.getElementById("public-about-build-meta");
    if (buildEl) {
      buildEl.textContent = build || "Unknown";
    }

    const updatedEl = document.getElementById("public-about-updated-meta");
    if (updatedEl) {
      updatedEl.textContent = lastUpdated || "Unknown";
    }
  }

  function renderRuntimeMetaFromVersioning() {
    if (!window.Versioning) return;

    Versioning.loadVersion().then((info) => {
      if (!info) return;

      const ownerEl = document.getElementById("public-about-owner-meta");
      if (ownerEl && info.owner) {
        ownerEl.textContent = info.owner;
      }

      const copyrightEl = document.getElementById("public-about-copyright-meta");
      if (copyrightEl && info.copyright) {
        copyrightEl.textContent = info.copyright;
      }

      const buildEl = document.getElementById("public-about-build-meta");
      if (buildEl && info.build) {
        buildEl.textContent = info.build;
      }

      const versionEl = document.getElementById("public-about-version-meta");
      const currentVersionText = versionEl ? versionEl.textContent.trim() : "";
      if (
        versionEl &&
        (!currentVersionText || currentVersionText === "Unavailable" || currentVersionText.includes("Loading"))
      ) {
        versionEl.textContent = Versioning.formatDisplayVersion(info);
      }
    });
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
    const scopedSections = await loadScopedSections();

    const scopesToRender = scopedSections.length
      ? scopedSections
      : [
          {
            key: "about",
            title: "About StreamSuites",
            tone: "general",
            sections: Array.isArray(data.sections) ? data.sections : []
          }
        ];

    renderMeta(data.version, data.lastUpdated, data.build);
    renderRuntimeMetaFromVersioning();
    renderErrors(data.errors);
    renderSections(scopesToRender);
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

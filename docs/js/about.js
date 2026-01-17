// UI refinement: About page container simplification, title deduplication,
// scope grouping, and hover glow alignment with Changelog roadmap
/* ======================================================================
   StreamSuites™ Dashboard — About View Logic (JSON-driven)
   Project: StreamSuites™
   Owner: Daniel Clancy
   Copyright: © 2026 Brainstream Media Group
   ====================================================================== */

// Fix: restored missing roadmap interaction helper (setRowExpanded)
// Reason: initSkillToggles depends on this function; omission caused runtime crash
// Fix: restored complete roadmap rendering helper chain
// Includes: formatScore, buildSkillRow, renderRoadmapRows
// Reason: functions were referenced but missing, causing runtime crashes

// Fix: restored missing renderRoadmapRows() required by AboutView.init
// Reason: function was referenced but not present in executed file state
// Impact: restores roadmap rendering and progress bars on About page

// Maintenance note: duplicate definitions of sectionAnchor, entryAnchor, renderErrors, and renderSections were removed; initSkillBars was repaired to close braces and restore animation logic; file is now syntactically complete.

(() => {
  "use strict";

  let cleanupFns = [];
  let openRow = null;

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

  const basePath =
    (window.Versioning && window.Versioning.resolveBasePath &&
      window.Versioning.resolveBasePath()) ||
    (() => {
      const parts = window.location.pathname.split("/").filter(Boolean);
      if (!parts.length) return "";
      const docsIndex = parts.indexOf("docs");
      if (docsIndex === -1) {
        return `/${parts[0]}`;
      }

      const rootParts = parts.slice(0, docsIndex + 1);
      return `/${rootParts.join("/")}`;
    })();

  function resolveRoadmapPath() {
    return "/runtime/exports/roadmap.json";
  }

  function resolveAssetPath(asset) {
    if (!asset) return "";
    if (/^(https?:)?\/\//.test(asset) || asset.startsWith("/")) return asset;
    const trimmed = asset.replace(/^\.\//, "");
    return `${basePath || ""}/${trimmed}`.replace(/\\+/g, "/");
  }

  function buildAboutPath(path) {
    if (window.AboutData?.buildUrl) return AboutData.buildUrl(path);
    return `${basePath || ""}/${path}`.replace(/\\+/g, "/");
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

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
          console.warn(`[AboutView] Failed to load scoped source ${source}`, err);
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
      console.warn("[AboutView] Failed to derive scoped sections", err);
      return [];
    }
  }

  function formatScore(percent) {
    const score = percent / 10;
    return Number.isInteger(score) ? score.toFixed(1) : score.toFixed(1);
  }

  function buildSkillRow(entry) {
    const score = Math.max(0, Math.min(100, Number(entry.percent) || 0));
    const normalizedScore = formatScore(score);
    const pulseClass = entry.pulse ? " pulsing" : "";
    const pausedClass = entry.status === "paused" ? " is-paused" : "";

    const icon = resolveAssetPath(entry.icon || "assets/icons/ui/widget.svg");
    const statusBadge =
      entry.status === "paused"
        ? '<span class="public-roadmap-status paused">Paused</span>'
        : "";

    return `
    <div class="ss-progress-card ss-progress-row ss-skill-row" data-score="${normalizedScore}" title="${entry.tooltip || ""}" role="button" tabindex="0">
      <div class="ss-progress-label">
        <div class="ss-progress-main">
          <span class="ss-progress-title">
            <span class="ss-progress-icon" aria-hidden="true" style="--progress-icon: url('${icon}')"></span>
            ${entry.title}
          </span>
        </div>
        <div class="ss-progress-right">
          <span class="ss-progress-meta">${entry.meta} ${statusBadge}</span>
          <button class="ss-progress-toggle ss-skill-toggle" type="button" aria-expanded="false" aria-label="Toggle detail">
            <span>▸</span>
          </button>
        </div>
      </div>
      <div class="ss-skill-description" aria-hidden="true">
        <div class="ss-skill-description-inner">
          <p class="muted">${entry.description}</p>
        </div>
      </div>
      <div class="ss-skill-wrapper">
        <div class="ss-skill-track">
          <div class="ss-skill-fill${pulseClass}${pausedClass}"></div>
        </div>
      </div>
    </div>`;
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

  async function loadRoadmapData() {
    try {
      const response = await fetch(resolveRoadmapPath(), { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load roadmap data");
      const payload = await response.json();
      return Array.isArray(payload) ? payload : [];
    } catch (err) {
      console.warn("Unable to load roadmap data", err);
      return [];
    }
  }

  function renderRoadmapRows(data) {
    const container = document.getElementById("ss-roadmap-rows");
    if (!container || !Array.isArray(data)) return [];

    const sorted = [...data].sort((a, b) => (a.order || 0) - (b.order || 0));
    container.innerHTML = sorted.map(buildSkillRow).join("");

    return Array.from(container.querySelectorAll(".ss-skill-row"));
  }

  function setRowExpanded(row, shouldExpand) {
    const desc = row.querySelector(".ss-skill-description");
    const toggle = row.querySelector(".ss-skill-toggle");
    if (!desc || !toggle) return;

    if (shouldExpand) {
      row.classList.add("is-open");
      desc.style.maxHeight = `${desc.scrollHeight}px`;
      desc.setAttribute("aria-hidden", "false");
      toggle.setAttribute("aria-expanded", "true");
      openRow = row;
      return;
    }

    row.classList.remove("is-open");
    desc.style.maxHeight = "0px";
    desc.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
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

        fill.style.transition = transitionTiming;
        fill.style.width = `${targetWidth}%`;
      }

      const observer = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            animateFill();
            obs.unobserve(entry.target);
          });
        },
        { threshold: 0.4 }
      );

      observer.observe(wrapper);
      cleanupFns.push(() => observer.disconnect());
    });
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

  function renderMeta(lastUpdated) {
    const versionEl = document.getElementById("about-version-meta");
    if (versionEl) {
      versionEl.textContent = "Loading…";
    }

    const buildEl = document.getElementById("about-build-meta");
    if (buildEl) {
      buildEl.textContent = "Loading…";
    }

    const updatedEl = document.getElementById("about-updated-meta");
    if (updatedEl) {
      updatedEl.textContent = lastUpdated || "Unknown";
    }
  }

  function renderVersionMetaFromRuntime() {
    if (!window.Versioning) return;

    Versioning.loadVersion().then((info) => {
      const ownerEl = document.getElementById("about-owner-meta");
      if (ownerEl) {
        ownerEl.textContent = info?.owner || "Unavailable";
      }

      const copyrightEl = document.getElementById("about-copyright-meta");
      if (copyrightEl) {
        copyrightEl.textContent = info?.copyright || "Unavailable";
      }

      const buildEl = document.getElementById("about-build-meta");
      if (buildEl) {
        buildEl.textContent = info?.build || "Unavailable";
      }

      const versionEl = document.getElementById("about-version-meta");
      if (versionEl) {
        versionEl.textContent = Versioning.formatDisplayVersion(info);
      }
    });
  }

  function renderSections(scopes = []) {
    const container = document.getElementById("about-sections");
    if (!container) return;

    if (!scopes.length) {
      container.innerHTML = `<p class="muted">No about sections available.</p>`;
      return;
    }

    const content = scopes
      .map((scope) => {
        const sectionMarkup = (Array.isArray(scope.sections) ? scope.sections : [])
          .map((section) => {
            const entries = Array.isArray(section.entries) ? section.entries : [];
            const entryMarkup = entries
              .filter((entry) => entry?.developer)
              .map((entry) => {
                const entryId = entryAnchor(section.id, entry.id);
                const title = entry.developer?.title || entry.consumer?.title || "Untitled";
                const body = entry.developer?.body || "";

                return `
                  <article class="ss-about-entry" id="${entryId}" data-scope-tone="${scope.tone}">
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
              <div class="ss-about-section" id="${sectionAnchor(section.id)}" data-scope-tone="${scope.tone}">
                <header class="ss-about-section-header">
                  <a class="ss-anchor" href="#${sectionAnchor(section.id)}">${section.title}</a>
                </header>
                <div class="ss-about-section-body">
                  ${entryMarkup || '<p class="muted">No developer entries in this section.</p>'}
                </div>
              </div>
            `;
          })
          .join("");

        return `
          <section class="ss-about-scope" data-scope-tone="${scope.tone}" aria-label="${scope.title}">
            <div class="ss-about-scope-header">
              <div class="ss-about-scope-bar"></div>
              <div class="ss-about-scope-title-row">
                <h3 class="ss-about-scope-title">${scope.title}</h3>
              </div>
            </div>
            <div class="ss-about-scope-body">
              ${sectionMarkup || '<p class="muted">No sections available.</p>'}
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

  function init() {
    if (!window.AboutData) {
      console.warn("[AboutView] AboutData loader is missing.");
      return;
    }

    setTimeout(() => {
      (async () => {
        let data;
        try {
          data = await AboutData.load();
        } catch (err) {
          console.warn("[AboutView] Failed to load about data", err);
          renderErrors([
            {
              source: "about",
              message: err?.message || "Unexpected error loading about data"
            }
          ]);
          return;
        }

        const scopedSections = await loadScopedSections();

        renderMeta(data.lastUpdated);
        renderVersionMetaFromRuntime();
        renderErrors(data.errors);
        renderSections(
          scopedSections.length
            ? scopedSections
            : [
                {
                  key: "about",
                  title: "About StreamSuites",
                  tone: "general",
                  sections: Array.isArray(data.sections) ? data.sections : []
                }
              ]
        );
        const roadmap = await loadRoadmapData();
        const rows = renderRoadmapRows(roadmap);
        initSkillBars(rows);
        initSkillToggles(rows);
        scrollToHashTarget();

        const hashHandler = () => scrollToHashTarget();
        window.addEventListener("hashchange", hashHandler);
        cleanupFns.push(() => window.removeEventListener("hashchange", hashHandler));
      })();
    }, 0);
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

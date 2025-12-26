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

  const dataPath = `${basePath || ""}/data/roadmap.json`.replace(/\/+/g, "/");
  const fillGradient = "linear-gradient(90deg, #57b9ff, #63ffa2)";
  const animationDuration = 1400;
  const hoverDuration = 950;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let cleanupFns = [];
  let openCard = null;

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function resolveAssetPath(asset) {
    if (!asset) return "";
    if (/^(https?:)?\/\//.test(asset) || asset.startsWith("/")) return asset;
    const trimmed = asset.replace(/^\.\//, "");
    return `${basePath || ""}/${trimmed}`.replace(/\/+/g, "/");
  }

  async function loadData() {
    try {
      const response = await fetch(dataPath, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load roadmap data");
      const payload = await response.json();
      return Array.isArray(payload) ? payload : [];
    } catch (err) {
      console.warn("Unable to load roadmap", err);
      return [];
    }
  }

  function buildCard(entry) {
    const percent = Math.max(0, Math.min(100, Number(entry.percent) || 0));
    const icon = resolveAssetPath(entry.icon || "assets/icons/ui/widget.svg");

    return `
    <article class="public-glass-card public-roadmap-card ss-progress-row" data-score="${percent}" data-id="${entry.id}" title="${entry.tooltip || ""}" role="button" tabindex="0">
      <div class="ss-progress-label">
        <div class="ss-progress-main">
          <span class="ss-progress-title">
            <span class="ss-progress-icon" aria-hidden="true" style="--progress-icon: url('${icon}')"></span>
            ${entry.title}
          </span>
        </div>
        <div class="ss-progress-right">
          <span class="ss-progress-meta">${entry.meta}</span>
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
      <div class="public-progress-wrapper">
        <progress class="public-roadmap-progress" value="0" max="100" style="--fill:${fillGradient};" aria-label="${entry.title} progress"></progress>
      </div>
    </article>`;
  }

  function render(data) {
    const container = document.getElementById("public-roadmap-list");
    if (!container) return [];

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = `
        <article class="public-glass-card changelog-error">
          <div class="section-heading">
            <h3>Roadmap unavailable</h3>
            <span class="lede">No roadmap entries could be loaded.</span>
          </div>
          <p class="muted">Please refresh to retry.</p>
        </article>`;
      return [];
    }

    const sorted = [...data].sort((a, b) => (a.order || 0) - (b.order || 0));
    container.innerHTML = sorted.map(buildCard).join("");
    return Array.from(container.querySelectorAll(".public-roadmap-card"));
  }

  function setExpanded(card, shouldExpand) {
    const desc = card.querySelector(".ss-skill-description");
    const toggle = card.querySelector(".ss-progress-toggle");
    if (!desc || !toggle) return;

    if (shouldExpand) {
      card.classList.add("is-open");
      desc.style.maxHeight = `${desc.scrollHeight}px`;
      desc.setAttribute("aria-hidden", "false");
      toggle.setAttribute("aria-expanded", "true");
      openCard = card;
      return;
    }

    card.classList.remove("is-open");
    desc.style.maxHeight = "0px";
    desc.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
  }

  function initToggles(cards) {
    cards.forEach((card) => {
      const desc = card.querySelector(".ss-skill-description");
      const toggle = card.querySelector(".ss-progress-toggle");

      if (desc) {
        desc.style.maxHeight = "0px";
        desc.setAttribute("aria-hidden", "true");
      }

      const handler = () => {
        const isOpen = card.classList.contains("is-open");
        if (openCard && openCard !== card) {
          setExpanded(openCard, false);
          openCard = null;
        }
        setExpanded(card, !isOpen);
        if (isOpen) openCard = null;
      };

      const clickTargets = [card];
      if (toggle) clickTargets.push(toggle);

      clickTargets.forEach((target) => {
        const boundHandler = (event) => {
          if (target !== card) event.stopPropagation();
          event.preventDefault();
          handler();
        };
        target.addEventListener("click", boundHandler);
        cleanupFns.push(() => target.removeEventListener("click", boundHandler));
      });

      const keyHandler = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        handler();
      };
      card.addEventListener("keydown", keyHandler);
      cleanupFns.push(() => card.removeEventListener("keydown", keyHandler));
    });

    const resizeHandler = () => {
      if (!openCard) return;
      setExpanded(openCard, true);
    };

    window.addEventListener("resize", resizeHandler);
    cleanupFns.push(() => window.removeEventListener("resize", resizeHandler));
  }

  function animateBar(progress, target, duration = animationDuration) {
    if (!progress) return;

    if (prefersReducedMotion.matches) {
      progress.value = target;
      return;
    }

    if (progress._frame) cancelAnimationFrame(progress._frame);
    const start = performance.now();
    progress.value = 0;

    const step = (timestamp) => {
      const elapsed = timestamp - start;
      const pct = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(pct);
      progress.value = target * eased;
      if (pct < 1) {
        progress._frame = requestAnimationFrame(step);
      }
    };

    progress._frame = requestAnimationFrame(step);
  }

  function animateProgress(cards) {
    cards.forEach((card) => {
      const progress = card.querySelector(".public-roadmap-progress");
      if (!progress) return;
      const target = Math.max(0, Math.min(100, Number(card.getAttribute("data-score")) || 0));

      animateBar(progress, target);

      const hoverHandler = () => {
        progress.classList.add("is-hover");
        animateBar(progress, target, hoverDuration);
        setTimeout(() => progress.classList.remove("is-hover"), 320);
      };

      card.addEventListener("mouseenter", hoverHandler);
      cleanupFns.push(() => card.removeEventListener("mouseenter", hoverHandler));
    });
  }

  function destroy() {
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
    openCard = null;
  }

  async function init() {
    const data = await loadData();
    const cards = render(data);
    initToggles(cards);
    animateProgress(cards);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.PublicRoadmap = { init, destroy };
})();

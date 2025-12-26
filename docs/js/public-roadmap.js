(() => {
  "use strict";

  const dataPath = "./data/roadmap.json";
  const gradients = [
    "linear-gradient(90deg, #5e7de7, #c05bff)",
    "linear-gradient(90deg, #f4d35e, #f76c6c)",
    "linear-gradient(90deg, #5bd0ff, #63ffa2)",
    "linear-gradient(90deg, #9bb7ff, #ff7ad1)",
    "linear-gradient(90deg, #5ff0ff, #7d7bff)",
    "linear-gradient(90deg, #9cf39b, #4dc5ff)"
  ];

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let cleanupFns = [];
  let openCard = null;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
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

  function buildCard(entry, index) {
    const gradient = entry.gradient || gradients[index % gradients.length];
    const percent = Math.max(0, Math.min(100, Number(entry.percent) || 0));

    return `
    <article class="public-glass-card public-roadmap-card ss-progress-row" data-score="${percent}" data-id="${entry.id}" title="${entry.tooltip || ""}" role="button" tabindex="0">
      <div class="ss-progress-label">
        <div class="ss-progress-main">
          <span class="ss-progress-title">
            <span class="ss-progress-icon" aria-hidden="true" style="--progress-icon: url('${entry.icon}')"></span>
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
        <progress class="public-roadmap-progress" value="0" max="100" style="--fill:${gradient};" aria-label="${entry.title} progress"></progress>
      </div>
    </article>`;
  }

  function render(data) {
    const container = document.getElementById("public-roadmap-list");
    if (!container) return [];

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

  function animateProgress(cards) {
    cards.forEach((card) => {
      const progress = card.querySelector(".public-roadmap-progress");
      if (!progress) return;
      const target = Math.max(0, Math.min(100, Number(card.getAttribute("data-score")) || 0));

      if (prefersReducedMotion.matches) {
        progress.value = target;
        return;
      }

      const duration = 1200;
      const start = performance.now();

      const step = (timestamp) => {
        const elapsed = timestamp - start;
        const pct = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(pct);
        progress.value = target * eased;
        if (pct < 1) requestAnimationFrame(step);
      };

      requestAnimationFrame(step);

      const hoverHandler = () => {
        progress.classList.add("is-hover");
        setTimeout(() => progress.classList.remove("is-hover"), 260);
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

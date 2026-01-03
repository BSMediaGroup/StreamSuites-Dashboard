(() => {
  "use strict";

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

  const dataPath = `${basePath || ""}/data/roadmap.json`.replace(/\/+/g, "/");
  const fillGradient = "linear-gradient(90deg, #57b9ff, #63ffa2)";
  const pausedGradient = "linear-gradient(90deg, #ff5f6d, #ffc371)";
  const animationDuration = 1200;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let cleanupFns = [];
  let openCard = null;
  let hasAnimated = false;

  function createBezierEasing(p1x, p1y, p2x, p2y) {
    const NEWTON_ITERATIONS = 4;
    const NEWTON_MIN_SLOPE = 0.001;
    const SUBDIVISION_PRECISION = 0.0000001;
    const SUBDIVISION_MAX_ITERATIONS = 10;
    const kSplineTableSize = 11;
    const kSampleStepSize = 1.0 / (kSplineTableSize - 1.0);
    const sampleValues = new Float32Array(kSplineTableSize);

    function calcBezier(t, a1, a2) {
      return ((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t * t + 3 * a1 * t;
    }

    function getSlope(t, a1, a2) {
      return 3 * (1 - 3 * a2 + 3 * a1) * t * t + 2 * (3 * a2 - 6 * a1) * t + 3 * a1;
    }

    for (let i = 0; i < kSplineTableSize; i++) {
      sampleValues[i] = calcBezier(i * kSampleStepSize, p1x, p2x);
    }

    function getTForX(x) {
      let intervalStart = 0;
      let currentSample = 1;
      const lastSample = kSplineTableSize - 1;

      for (; currentSample !== lastSample && sampleValues[currentSample] <= x; ++currentSample) {
        intervalStart += kSampleStepSize;
      }

      --currentSample;

      const dist =
        (x - sampleValues[currentSample]) /
        (sampleValues[currentSample + 1] - sampleValues[currentSample]);
      let guessForT = intervalStart + dist * kSampleStepSize;
      const initialSlope = getSlope(guessForT, p1x, p2x);

      if (initialSlope >= NEWTON_MIN_SLOPE) {
        for (let i = 0; i < NEWTON_ITERATIONS; ++i) {
          const currentSlope = getSlope(guessForT, p1x, p2x);
          if (currentSlope === 0) return guessForT;
          const currentX = calcBezier(guessForT, p1x, p2x) - x;
          guessForT -= currentX / currentSlope;
        }
        return guessForT;
      }

      if (initialSlope === 0) return guessForT;

      let t0 = intervalStart;
      let t1 = intervalStart + kSampleStepSize;
      guessForT = (t1 - t0) * 0.5 + t0;

      for (let i = 0; i < SUBDIVISION_MAX_ITERATIONS; ++i) {
        const currentX = calcBezier(guessForT, p1x, p2x) - x;
        if (Math.abs(currentX) < SUBDIVISION_PRECISION) break;
        if (currentX > 0) {
          t1 = guessForT;
        } else {
          t0 = guessForT;
        }
        guessForT = (t1 - t0) * 0.5 + t0;
      }

      return guessForT;
    }

    return function easing(x) {
      if (p1x === p1y && p2x === p2y) return x;
      return calcBezier(getTForX(x), p1y, p2y);
    };
  }

  const bezierEase = createBezierEasing(0.19, 1, 0.22, 1);

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
    const isPaused = entry.status === "paused" || entry.id === "rumble-sse";
    const statusBadge = isPaused
      ? '<span class="public-roadmap-status paused">Paused</span>'
      : "";
    const barFill = isPaused ? pausedGradient : fillGradient;

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
      <div class="public-progress-wrapper">
        <progress class="public-roadmap-progress${isPaused ? " is-paused" : ""}" value="0" max="100" style="--fill:${barFill};" aria-label="${entry.title} progress"></progress>
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

  const renderRoadmapRows = render;
  // Exposed for reuse by Dashboard About view (read-only).
  window.renderRoadmapRows = renderRoadmapRows;

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
      progress.classList.add("is-animated");
      return;
    }

    if (progress._frame) cancelAnimationFrame(progress._frame);
    const start = performance.now();
    progress.value = 0;

    const step = (timestamp) => {
      const elapsed = timestamp - start;
      const pct = Math.min(elapsed / duration, 1);
      const eased = bezierEase(pct);
      progress.value = target * eased;
      if (pct < 1) {
        progress._frame = requestAnimationFrame(step);
      } else {
        progress.classList.add("is-animated");
      }
    };

    progress._frame = requestAnimationFrame(step);
  }

  function attachHoverGlow(cards) {
    cards.forEach((card) => {
      const progress = card.querySelector(".public-roadmap-progress");
      if (!progress) return;

      const addGlow = () => progress.classList.add("is-glow");
      const removeGlow = () => progress.classList.remove("is-glow");

      card.addEventListener("mouseenter", addGlow);
      card.addEventListener("mouseleave", removeGlow);
      card.addEventListener("focusin", addGlow);
      card.addEventListener("focusout", removeGlow);

      cleanupFns.push(() => {
        card.removeEventListener("mouseenter", addGlow);
        card.removeEventListener("mouseleave", removeGlow);
        card.removeEventListener("focusin", addGlow);
        card.removeEventListener("focusout", removeGlow);
      });
    });
  }

  function animateProgress(cards) {
    if (!cards.length || hasAnimated) return;

    cards.forEach((card) => {
      const progress = card.querySelector(".public-roadmap-progress");
      if (!progress) return;
      const target = Math.max(0, Math.min(100, Number(card.getAttribute("data-score")) || 0));

      animateBar(progress, target);
    });

    hasAnimated = true;
  }

  function destroy() {
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
    openCard = null;
    hasAnimated = false;
  }

  async function init() {
    const data = await loadData();
    const cards = render(data);
    initToggles(cards);
    animateProgress(cards);
    attachHoverGlow(cards);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.PublicRoadmap = { init, destroy };
})();

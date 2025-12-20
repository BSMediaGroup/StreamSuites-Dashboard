(() => {
  "use strict";

  function initSkillBars() {
    const rows = document.querySelectorAll(".ss-skill-row");
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

        // Force reflow
        void fill.offsetWidth;

        fill.style.transition = transitionTiming;
        fill.style.width = targetWidth + "%";

        setTimeout(() => {
          fill.classList.add("pulsing");
        }, 1300);
      }

      animateFill();
      wrapper.addEventListener("mouseenter", animateFill);
    });
  }

  function init() {
    // Delay ensures DOM is fully injected by SPA
    requestAnimationFrame(() => {
      initSkillBars();
    });
  }

  function destroy() {
    // No-op (kept for symmetry & future use)
  }

  window.AboutView = {
    init,
    destroy
  };
})();

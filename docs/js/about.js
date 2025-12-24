(() => {
  "use strict";

  let cleanupFns = [];
  let openRow = null;

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

        // Force reflow
        void fill.offsetWidth;

        fill.style.transition = transitionTiming;
        fill.style.width = targetWidth + "%";

        setTimeout(() => {
          fill.classList.add("pulsing");
        }, 1300);
      }

      animateFill();
      const mouseHandler = animateFill;
      wrapper.addEventListener("mouseenter", mouseHandler);
      cleanupFns.push(() =>
        wrapper.removeEventListener("mouseenter", mouseHandler)
      );
    });
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

  /**
   * SPA-safe scroll handling.
   * Supports URLs like:
   *   #about&scroll=roadmap
   */
  function scrollToAnchorIfRequested() {
    const hash = location.hash || "";
    if (!hash.includes("scroll=")) return;

    const params = hash.split("&").slice(1);
    const scrollParam = params.find(p => p.startsWith("scroll="));
    if (!scrollParam) return;

    const targetId = scrollParam.split("=")[1];
    if (!targetId) return;

    requestAnimationFrame(() => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    });
  }

  function init() {
    // Delay ensures DOM is fully injected by SPA
    requestAnimationFrame(() => {
      const rows = Array.from(
        document.querySelectorAll(".ss-skill-row")
      );

      initSkillBars(rows);
      initSkillToggles(rows);
      scrollToAnchorIfRequested();
    });

    window.addEventListener("hashchange", scrollToAnchorIfRequested);
    cleanupFns.push(() =>
      window.removeEventListener("hashchange", scrollToAnchorIfRequested)
    );
  }

  function destroy() {
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
    openRow = null;
  }

  window.AboutView = {
    init,
    destroy
  };
})();

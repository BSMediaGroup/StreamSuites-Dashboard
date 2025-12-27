(() => {
  const bannerId = "ss-suspension-banner";

  function setBannerHeight() {
    const banner = document.getElementById(bannerId);
    if (!banner) return;
    const height = banner.offsetHeight || 0;
    document.documentElement.style.setProperty("--ss-suspension-banner-h", `${height}px`);
    document.body.classList.add("ss-has-suspension-banner");
  }

  function createBanner() {
    if (document.getElementById(bannerId)) {
      setBannerHeight();
      return;
    }

    const banner = document.createElement("div");
    banner.id = bannerId;
    banner.setAttribute("role", "note");
    banner.setAttribute("aria-label", "Project status notice");

    banner.innerHTML = `
      <div class="ss-suspension-inner">
        <div class="ss-suspension-title">PROJECT SUSPENDED — INDEFINITELY</div>
        <div class="ss-suspension-body">StreamSuites is paused due to unresolved reliability issues in the Rumble chat ingest/control path (the bot can post but cannot consistently read/respond, and repeated attempts risk account/API disruption). Development is suspended pending a stable, verifiable integration approach.</div>
        <div class="ss-suspension-meta">Last updated: 2025-12-28</div>
      </div>
    `;

    if (document.body.firstChild) {
      document.body.insertBefore(banner, document.body.firstChild);
    } else {
      document.body.appendChild(banner);
    }

    requestAnimationFrame(setBannerHeight);
  }

  function initSuspensionBanner() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", createBanner, { once: true });
    } else {
      createBanner();
    }
  }

  window.addEventListener("hashchange", createBanner, false);
  initSuspensionBanner();
})();

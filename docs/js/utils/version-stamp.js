/* ======================================================================
   StreamSuites™ Dashboard — Version Stamp Helper
   Project: StreamSuites™
   Owner: Daniel Clancy
   Copyright: © 2026 Brainstream Media Group
   ====================================================================== */

(() => {
  "use strict";

  const pathname = window.location?.pathname || "";
  if (pathname.includes("/livechat/")) return;

  function shouldBlockDashboardRuntime() {
    const guard = window.StreamSuitesDashboardGuard;
    if (guard && typeof guard.shouldBlock === "boolean") {
      return guard.shouldBlock;
    }

    const pathname = (window.location?.pathname || "").toLowerCase();
    const standaloneFlagDefined = typeof window.__STREAMSUITES_STANDALONE__ !== "undefined";
    const isLivechatPath =
      pathname.startsWith("/streamsuites-dashboard/livechat") ||
      pathname.endsWith("/livechat/") ||
      pathname.endsWith("/livechat/index.html");

    return standaloneFlagDefined || isLivechatPath;
  }

  if (shouldBlockDashboardRuntime()) return;
  if (!window.Versioning) return;

  function ensureElement(parent, selector, tagName, className) {
    const existing = selector ? parent.querySelector(selector) : null;
    if (existing) return existing;

    const el = document.createElement(tagName);
    if (className) el.className = className;
    parent.appendChild(el);
    return el;
  }

  function stampAppFooter(meta) {
    const footer = document.getElementById("app-footer");
    if (!footer) return;

    const metaGroup =
      footer.querySelector("[data-footer-meta]") ||
      footer.querySelector(".footer-left") ||
      footer.querySelector(".footer-center") ||
      footer;

    const versionEl = ensureElement(metaGroup, "#footer-version", "span", "footer-version");
    versionEl.id = "footer-version";
    versionEl.textContent = meta.versionText;

    const copyrightEl = ensureElement(metaGroup, "#footer-copyright", "a", "footer-copyright");
    copyrightEl.id = "footer-copyright";
    if (meta.copyrightText) {
      copyrightEl.textContent = meta.copyrightText;
    }
    if (!copyrightEl.getAttribute("href")) {
      copyrightEl.href = "https://brainstream.media";
      copyrightEl.target = "_blank";
      copyrightEl.rel = "noopener noreferrer";
    }
  }

  function stampPublicFooter(footer, meta) {
    const link = footer.querySelector("a");

    const versionEl = ensureElement(footer, ".footer-version", "span", "footer-version");
    versionEl.textContent = meta.versionText;

    const copyrightEl = ensureElement(footer, ".footer-copyright", "span", "footer-copyright");
    if (meta.copyrightText) {
      copyrightEl.textContent = meta.copyrightText;
    }

    if (link && link.parentElement === footer) {
      footer.insertBefore(versionEl, link);
      footer.insertBefore(copyrightEl, link);
    }
  }

  function stampSectionFooter(footer, meta) {
    const versionEl = ensureElement(footer, ".footer-version", "span", "footer-version");
    versionEl.textContent = meta.versionText;

    const copyrightEl = ensureElement(footer, ".footer-copyright", "span", "footer-copyright");
    if (meta.copyrightText) {
      copyrightEl.textContent = meta.copyrightText;
    }
  }

  function stampBrandFooter(meta) {
    document.querySelectorAll(".footer-brand").forEach((brand) => {
      const versionEl = ensureElement(brand, ".footer-version", "span", "footer-version");
      versionEl.textContent = meta.versionText;

      if (brand.hasAttribute("data-no-copyright")) return;

      const copyrightAnchor = brand.querySelector("a");
      if (copyrightAnchor && meta.copyrightText) {
        copyrightAnchor.textContent = meta.copyrightText;
      } else {
        const copyrightEl = ensureElement(
          brand,
          ".footer-copyright",
          "span",
          "footer-copyright"
        );
        if (meta.copyrightText) {
          copyrightEl.textContent = meta.copyrightText;
        }
      }
    });
  }

  async function stampFooters() {
    const info = await Versioning.loadVersion();

    const meta = {
      versionText: Versioning.formatDisplayVersion(info),
      copyrightText: ""
    };

    stampAppFooter(meta);

    stampBrandFooter(meta);

    document.querySelectorAll(".public-footer").forEach((footer) => {
      stampPublicFooter(footer, meta);
    });

    document.querySelectorAll(".ss-footer").forEach((footer) => {
      stampSectionFooter(footer, meta);
    });
  }

  Versioning.stampFooters = stampFooters;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", stampFooters);
  } else {
    stampFooters();
  }
})();

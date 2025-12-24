/* ======================================================================
   StreamSuites™ Dashboard — Version Stamp Helper
   Project: StreamSuites™
   Version: v0.2.0-alpha
   Owner: Daniel Clancy
   Copyright: © 2025 Brainstream Media Group
   ====================================================================== */

(() => {
  "use strict";

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

    const center = footer.querySelector(".footer-center") || footer;
    const versionEl = ensureElement(center, "#footer-version", "span", "footer-version");
    versionEl.id = "footer-version";
    versionEl.textContent = meta.versionText;

    const copyrightEl = ensureElement(center, "#footer-copyright", "a", "footer-copyright");
    copyrightEl.id = "footer-copyright";
    copyrightEl.textContent = meta.copyrightText;
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
    copyrightEl.textContent = meta.copyrightText || meta.ownerText;

    if (link && link.parentElement === footer) {
      footer.insertBefore(versionEl, link);
      footer.insertBefore(copyrightEl, link);
    }
  }

  function stampSectionFooter(footer, meta) {
    const versionEl = ensureElement(footer, ".footer-version", "span", "footer-version");
    versionEl.textContent = meta.versionText;

    const copyrightEl = ensureElement(footer, ".footer-copyright", "span", "footer-copyright");
    copyrightEl.textContent = meta.copyrightText || meta.ownerText;
  }

  function stampBrandFooter(meta) {
    document.querySelectorAll(".footer-brand").forEach((brand) => {
      const versionEl = ensureElement(brand, ".footer-version", "span", "footer-version");
      versionEl.textContent = meta.versionText;

      const copyrightAnchor = brand.querySelector("a");
      if (copyrightAnchor) {
        copyrightAnchor.textContent = meta.copyrightText;
      } else {
        const copyrightEl = ensureElement(
          brand,
          ".footer-copyright",
          "span",
          "footer-copyright"
        );
        copyrightEl.textContent = meta.copyrightText || meta.ownerText;
      }
    });
  }

  async function stampFooters() {
    const info = await Versioning.loadVersion();
    if (!info) return;

    const meta = {
      versionText: Versioning.formatDisplayVersion(info),
      copyrightText: info.copyright || "",
      ownerText: info.owner || ""
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

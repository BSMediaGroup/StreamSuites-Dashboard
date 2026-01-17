/* ======================================================================
   StreamSuites™ Dashboard — Versioning Utilities
   Project: StreamSuites™
   Version: v0.2.2-alpha
   Owner: Daniel Clancy
   Copyright: © 2026 Brainstream Media Group
   ====================================================================== */

(() => {
  "use strict";

  const Versioning = {
    _cache: null,

    resolveVersionUrl() {
      const cacheBust =
        window.__STREAMSUITES_VERSION_BUILD__ ||
        window.StreamSuitesVersionBuild ||
        window.StreamSuitesBuild ||
        Date.now();
      return `/version.json?v=${encodeURIComponent(cacheBust)}`;
    },

    async loadVersion() {
      if (this._cache) return this._cache;

      const url = this.resolveVersionUrl();
      this._cache = fetch(url, {
        cache: "no-store",
        mode: "cors",
        credentials: "omit",
        referrerPolicy: "no-referrer"
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          const info = {
            name: data.name || "StreamSuites™",
            version: data.version || "",
            build: data.build || "",
            owner: data.owner || "",
            copyright: data.copyright || "",
            license: data.license || ""
          };

          window.StreamSuitesVersion = info;
          return info;
        })
        .catch((err) => {
          console.warn("[Versioning] Failed to load version.json", err);
          this._cache = null;
          return null;
        });

      return this._cache;
    },

    formatDisplayVersion(info) {
      if (!info) return "";
      const name = info.name || "StreamSuites™";
      const version = info.version ? ` v${info.version}` : "";
      const build = info.build ? ` (build ${info.build})` : "";
      return `${name}${version}${build}`;
    },

    async applyVersionToElements(selectors = {}) {
      const info = await this.loadVersion();
      if (!info) return null;

      const versionText = this.formatDisplayVersion(info);
      const copyrightText = info.copyright || "";
      const ownerText = info.owner || "";

      const applyText = (targets, text) => {
        if (!text || !targets) return;
        const nodes = Array.isArray(targets)
          ? targets.flatMap((sel) => Array.from(document.querySelectorAll(sel)))
          : Array.from(document.querySelectorAll(targets));

        nodes.forEach((node) => {
          node.textContent = text;
        });
      };

      applyText(selectors.version, versionText);
      applyText(selectors.copyright, copyrightText);
      applyText(selectors.owner, ownerText);

      return info;
    }
  };

  window.Versioning = Versioning;
})();

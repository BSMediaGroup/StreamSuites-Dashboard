/* ======================================================================
   StreamSuites™ Dashboard — Versioning Utilities
   Project: StreamSuites™
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
      return `/runtime/exports/version.json?v=${encodeURIComponent(cacheBust)}`;
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
            project: data?.project || "",
            version: data?.version || "",
            build: data?.build || "",
            generated_at: data?.generated_at || "",
            source: data?.source || ""
          };

          window.StreamSuitesVersion = info;
          return info;
        })
        .catch((err) => {
          console.warn("[Versioning] Failed to load runtime version metadata", err);
          this._cache = null;
          return null;
        });

      return this._cache;
    },

    formatDisplayVersion(info) {
      if (!info || !info.version) return "Version unavailable";
      const name = info.project || "StreamSuites";
      const versionLabel = info.version.startsWith("v")
        ? info.version
        : `v${info.version}`;
      const build = info.build ? ` (build ${info.build})` : "";
      return `${name} ${versionLabel}${build}`.trim();
    },

    async applyVersionToElements(selectors = {}) {
      const info = await this.loadVersion();
      const versionText = this.formatDisplayVersion(info);
      const ownerText = "";

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
      applyText(selectors.owner, ownerText);

      return info;
    }
  };

  window.Versioning = Versioning;
})();

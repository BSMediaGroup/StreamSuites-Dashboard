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

    resolveMetaUrl() {
      return `${window.ADMIN_BASE_PATH}/runtime/exports/version.json`;
    },

    resolveBasePath() {
      return window.ADMIN_BASE_PATH;
    },

    resolveRuntimeUrl(file) {
      const normalized = String(file || "").replace(/^\/+/, "");
      return `${window.ADMIN_BASE_PATH}/runtime/exports/${normalized}`;
    },

    async loadVersion() {
      if (this._cache) return this._cache;

      const url = this.resolveMetaUrl();
      this._cache = (async () => {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) {
            console.warn("[Versioning] Meta export unavailable", res.status);
            return null;
          }
          const data = await res.json();
          if (!data) return null;

          const info = {
            project: data?.project || data?.meta?.project || "StreamSuites",
            version: data?.version || data?.meta?.version || "",
            build: data?.build || data?.meta?.build || "",
            generated_at: data?.generated_at || data?.meta?.generated_at || "",
            source: data?.source || data?.meta?.source || ""
          };

          if (!info.version) return null;

          window.StreamSuitesVersion = info;
          return info;
        } catch (err) {
          console.warn("[Versioning] Failed to load runtime version metadata", err);
          this._cache = null;
          return null;
        }
      })();

      return this._cache;
    },

    formatDisplayVersion(info) {
      if (!info || !info.version) return "Unavailable";
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

/* ======================================================================
   StreamSuites™ Dashboard — Versioning Utilities
   Project: StreamSuites™
   Owner: Daniel Clancy
   Copyright: © 2026 Brainstream Media Group
   ====================================================================== */

(() => {
  "use strict";

  const ADMIN_BASE_PATH =
    window.ADMIN_BASE_PATH ??
    (window.location.pathname.startsWith("/docs") ? "/docs" : "");
  window.ADMIN_BASE_PATH = ADMIN_BASE_PATH;

  const Versioning = {
    _cache: null,

    resolveMetaUrl() {
      return `${ADMIN_BASE_PATH}/runtime/exports/meta.json`;
    },

    resolveBasePath() {
      return ADMIN_BASE_PATH;
    },

    resolveRuntimeUrl(file) {
      const normalized = String(file || "").replace(/^\/+/, "");
      return `${ADMIN_BASE_PATH}/runtime/exports/${normalized}`;
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
          const metaVersion =
            data?.version ||
            data?.meta?.version ||
            data?.runtime?.version ||
            data?.meta?.runtime_version ||
            "";

          if (metaVersion) {
            const info = {
              project: data?.project || data?.meta?.project || "StreamSuites",
              version: metaVersion,
              build: data?.build || data?.meta?.build || "",
              generated_at: data?.meta?.generated_at || data?.generated_at || "",
              source: data?.meta?.source || data?.source || ""
            };
            window.StreamSuitesVersion = info;
            return info;
          }

          const exportsList = Array.isArray(data?.exports) ? data.exports : [];
          const versionExport = exportsList.find((entry) =>
            typeof entry?.file === "string"
              ? entry.file.endsWith("version.json")
              : false
          );

          if (!versionExport) return null;

          const versionUrl = this.resolveRuntimeUrl(versionExport.file);
          const versionResponse = await fetch(versionUrl, {
            cache: "no-store"
          });
          if (!versionResponse.ok) {
            console.warn(
              "[Versioning] Version export unavailable",
              versionResponse.status
            );
            return null;
          }
          const versionData = await versionResponse.json();

          const info = {
            project: versionData?.project || "",
            version: versionData?.version || "",
            build: versionData?.build || "",
            generated_at: versionData?.generated_at || "",
            source: versionData?.source || ""
          };

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

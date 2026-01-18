/* ======================================================================
   StreamSuites™ Dashboard — Canonical About Data Loader
   Project: StreamSuites™
   Owner: Daniel Clancy
   Copyright: © 2026 Brainstream Media Group
   ====================================================================== */

(() => {
  "use strict";

  function resolveBasePath() {
    return window.ADMIN_BASE_PATH || "/docs";
  }

  function buildUrl(path) {
    const base = resolveBasePath();
    return `${base || ""}/${path}`.replace(/\/+/g, "/");
  }

    async function fetchJson(url) {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      try {
        return await response.json();
      } catch (err) {
        throw new Error(`Invalid JSON (${err.message || err})`);
      }
    }

  function normalizeEntry(entry) {
    return {
      id: entry?.id || "",
      order: Number(entry?.order) || 0,
      consumer: entry?.consumer ? { ...entry.consumer } : null,
      developer: entry?.developer ? { ...entry.developer } : null
    };
  }

  function normalizeSection(section) {
    const entries = Array.isArray(section?.entries)
      ? [...section.entries]
          .map(normalizeEntry)
          .sort((a, b) => a.order - b.order)
      : [];

    return {
      id: section?.id || "",
      order: Number(section?.order) || 0,
      title: section?.title || "",
      entries
    };
  }

  async function loadAboutData() {
    const result = {
      version: null,
      lastUpdated: null,
      sections: [],
      errors: []
    };

    let manifest;
    try {
      manifest = await fetchJson(buildUrl("about/about.manifest.json"));
    } catch (err) {
      result.errors.push({
        source: "manifest",
        message: `Failed to load about.manifest.json (${err.message || err})`
      });
      return result;
    }

    const sources = Array.isArray(manifest?.sources) ? manifest.sources : [];
    if (!sources.length) {
      result.errors.push({
        source: "manifest",
        message: "Manifest is missing a sources array"
      });
      return result;
    }

    for (const source of sources) {
      const url = buildUrl(`about/${source}`);
      let data;
      try {
        data = await fetchJson(url);
      } catch (err) {
        result.errors.push({
          source,
          message: `Failed to load ${source} (${err.message || err})`
        });
        continue;
      }

      if (!data || typeof data !== "object") {
        result.errors.push({
          source,
          message: `${source} did not return JSON`
        });
        continue;
      }

      if (!Array.isArray(data.sections)) {
        result.errors.push({
          source,
          message: `${source} is missing required fields (sections[])`
        });
        continue;
      }

      if (!result.version && data.version) {
        result.version = data.version;
      }

      if (!result.lastUpdated && data.lastUpdated) {
        result.lastUpdated = data.lastUpdated;
      }

      const normalizedSections = [...data.sections]
        .map(normalizeSection)
        .sort((a, b) => a.order - b.order);

      result.sections.push(...normalizedSections);
    }

    return result;
  }

  window.AboutData = {
    load: loadAboutData,
    buildUrl,
    resolveBasePath
  };
})();

/* ======================================================================
   StreamSuites™ Dashboard — Standalone Guard
   Ensures dashboard runtime never boots inside standalone apps (LiveChat)
   ====================================================================== */

(() => {
  "use strict";

  const pathname = (window.location?.pathname || "").toLowerCase();
  const standaloneFlagDefined = typeof window.__STREAMSUITES_STANDALONE__ !== "undefined";
  const isLivechatPath =
    pathname.startsWith("/streamsuites-dashboard/livechat") ||
    pathname.endsWith("/livechat/") ||
    pathname.endsWith("/livechat/index.html");

  const existing = window.StreamSuitesDashboardGuard || {};
  const shouldBlock = Boolean(existing.shouldBlock || standaloneFlagDefined || isLivechatPath);

  window.StreamSuitesDashboardGuard = {
    ...existing,
    standaloneFlagDefined,
    isLivechatPath,
    shouldBlock
  };
})();

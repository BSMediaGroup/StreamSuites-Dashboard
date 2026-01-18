/* ======================================================================
   StreamSuites™ Dashboard — View Loader Bootstrap
   Ensures ADMIN_BASE_PATH is established before view fetches.
   ====================================================================== */

(() => {
  "use strict";

  const ADMIN_BASE_PATH = window.ADMIN_BASE_PATH || "/docs";
  window.ADMIN_BASE_PATH = ADMIN_BASE_PATH;

  window.StreamSuitesViewLoader = window.StreamSuitesViewLoader || {
    basePath: ADMIN_BASE_PATH
  };
})();

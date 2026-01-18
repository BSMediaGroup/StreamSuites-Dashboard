/* ======================================================================
   StreamSuites™ Dashboard — View Loader Bootstrap
   Ensures ADMIN_BASE_PATH is established before view fetches.
   ====================================================================== */

(() => {
  "use strict";

  window.StreamSuitesViewLoader = window.StreamSuitesViewLoader || {
    basePath: window.ADMIN_BASE_PATH
  };
})();

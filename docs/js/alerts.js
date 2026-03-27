(() => {
  "use strict";

  function init() {
    return window.StreamSuitesAnalyticsAlerting?.init?.();
  }

  function destroy() {
    window.StreamSuitesAnalyticsAlerting?.destroy?.();
  }

  window.StreamSuitesAlertsView = {
    init,
    destroy
  };
})();

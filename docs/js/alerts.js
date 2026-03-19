(() => {
  "use strict";

  function init() {
    window.StreamSuitesAnalyticsAlerting?.init?.();
  }

  function destroy() {
    window.StreamSuitesAnalyticsAlerting?.destroy?.();
  }

  window.StreamSuitesAlertsView = {
    init,
    destroy
  };
})();

(function () {
  'use strict';

  var config = window.__OUTREACH_CONFIG__ || {};

  window.fireOutreachEvent = function (event, extra) {
    extra = extra || {};
    var payload = Object.assign({}, config, { event: event }, extra);

    fetch('/api/outreach-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(function () {
      // Fire-and-forget — ignore errors silently
    });
  };

  // Auto-fire page_visit on load
  if (config.slug) {
    window.fireOutreachEvent('page_visit');
  }
})();

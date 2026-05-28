/**
 * context_init.js — Stella context initializer for orphan pages.
 * Inject BEFORE the Stella widget loads.
 */
(function () {
  "use strict";
  var sellerName      = "STELLA_SELLER_NAME_PLACEHOLDER";
  var propertyAddress = "STELLA_PROPERTY_ADDRESS_PLACEHOLDER";
  var contextType     = "STELLA_CONTEXT_TYPE_PLACEHOLDER";
  var captureGoalsRaw = "STELLA_CAPTURE_GOALS_PLACEHOLDER";
  var captureGoals = [];
  try {
    var parsed = JSON.parse(captureGoalsRaw);
    if (Array.isArray(parsed)) { captureGoals = parsed; }
  } catch (e) {
    if (typeof console !== "undefined" && console.debug) {
      console.debug("[stella/context_init] Failed to parse STELLA_CAPTURE_GOALS:", captureGoalsRaw);
    }
  }
  var ctx = {
    seller_name:      sellerName,
    property_address: propertyAddress,
    context:          contextType,
    capture_goals:    captureGoals
  };
  window.STELLA_CONTEXT = ctx;
  try {
    sessionStorage.setItem("stella_context", JSON.stringify(ctx));
  } catch (e) {
    if (typeof console !== "undefined" && console.debug) {
      console.debug("[stella/context_init] sessionStorage write failed:", e);
    }
  }
  if (typeof console !== "undefined" && console.debug) {
    console.debug(
      "[stella/context_init] context set — address=" + propertyAddress +
      " context=" + contextType +
      " goals=" + JSON.stringify(captureGoals)
    );
  }
})();

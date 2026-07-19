'use strict';

// Shared by routes/admin-events.js and routes/admin-lore.js — split out of
// routes/admin.js (A2-9, 2026-07-19).

/** Register canonical kebab path plus legacy snake_plural alias (alpha backward compat). */
function dualRoute(router, method, canonical, legacy, ...handlers) {
  router[method](canonical, ...handlers);
  if (legacy && legacy !== canonical) {
    router[method](legacy, ...handlers);
  }
}

module.exports = { dualRoute };

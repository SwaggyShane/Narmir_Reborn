const express = require("express");
const { requireAdmin, requireCsrfToken, ensureCsrfToken } = require("./middleware");

// Central composition for all admin routes — split out of a single 2363-line
// file into domain routers (A2-9, 2026-07-19), mirroring routes/kingdom.js's
// composition pattern. Order is not precedence-sensitive here (every sub-file
// owns disjoint paths, verified via route-inventory scan), but is listed
// explicitly for the same reason kingdom.js is: one place to see what's
// mounted.
module.exports = function (db, io) {
  const router = express.Router();

  // All admin routes require admin JWT — applied once here, not per sub-file,
  // so it can never be silently forgotten when adding a new domain router.
  router.use(requireAdmin);
  // Issue CSRF cookie on read requests when an admin session exists
  router.use(ensureCsrfToken);
  // All state-changing admin routes require matching CSRF header + cookie
  router.use((req, res, next) => {
    if (!["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) return next();
    return requireCsrfToken(req, res, next);
  });

  const orderedRouters = [
    { name: 'kingdoms', factory: require('./admin-kingdoms') },
    { name: 'ai', factory: require('./admin-ai') },
    { name: 'events', factory: require('./admin-events') },
    { name: 'lore', factory: require('./admin-lore') },
    { name: 'goals', factory: require('./admin-goals') },
    { name: 'config', factory: require('./admin-config') },
    { name: 'audit', factory: require('./admin-audit') },
  ];

  for (const { factory } of orderedRouters) {
    router.use(factory(db, io));
  }

  return router;
};

// Re-exported for lib/boot.js, which calls this once at server startup to
// apply admin_goal_definitions DB overrides on top of game/goals.js defaults.
module.exports.refreshInMemoryGoals = require('./admin-goals').refreshInMemoryGoals;

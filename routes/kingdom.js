const express = require('express');

// Central composition for all kingdom routes.
// Order is EXPLICIT and the source of truth to reduce shadowing bugs.
// More specific routers MUST come before general catch-all routers.
// This addresses M1-1 router order-dependency.
module.exports = function (db) {
  const router = express.Router();

  // Explicit ordered list of sub-routers (specific first).
  // Adding to this array is the only way to change mount order.
  const orderedRouters = [
    { name: 'build', factory: require('./kingdom-build') },
    { name: 'warfare', factory: require('./kingdom-warfare') },
    { name: 'economy', factory: require('./kingdom-economy') },
    { name: 'research', factory: require('./kingdom-research') },
    { name: 'profile', factory: require('./kingdom-profile') },
    { name: 'turn', factory: require('./kingdom-turn') },
    { name: 'forge', factory: require('./kingdom-forge') },
    { name: 'prestige', factory: require('./kingdom-prestige') },
    { name: 'attunements', factory: require('./kingdom-attunements') },
    { name: 'worldmap', factory: require('./kingdom-worldmap') },
    { name: 'gameplay', factory: require('./kingdom-gameplay') },
  ];

  for (const { factory } of orderedRouters) {
    router.use(factory(db));
  }

  router.use(require('./kingdom-exploration')(db));

  return router;
};

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
    { name: 'gameplay', factory: require('./kingdom-gameplay') },
  ];

  let kingdomGameplayRouter = null;

  for (const { name, factory } of orderedRouters) {
    const sub = factory(db);
    if (name === 'gameplay') {
      kingdomGameplayRouter = sub;
    }
    router.use(sub);
  }

  // Exploration depends on the gameplay router for some helpers (must be after)
  if (kingdomGameplayRouter) {
    router.use(require('./kingdom-exploration')(db, kingdomGameplayRouter));
  } else {
    router.use(require('./kingdom-exploration')(db, null));
  }

  return router;
};

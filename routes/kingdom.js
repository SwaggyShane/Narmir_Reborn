const express = require('express');

// Central composition for all kingdom routes.
// This array is the ONLY source of truth for mount order (A2-10) — docs
// (docs/API_ENDPOINTS.md) describe it but must defer to this file if they
// ever disagree. Order is EXPLICIT to reduce shadowing bugs: Express matches
// the first router that defines a given path+method, so where two files
// define the same route, the earlier-mounted one wins.
//
// `gameplay` MUST stay last in this array — it was the original monolith
// and remains the catch-all for anything never assigned its own file
// (the original M1-1 router-order-dependency concern). `kingdom-exploration`
// is mounted separately below, after the loop, for the same reason: it's
// never been checked for path overlaps against the others.
//
// `turn`, `forge`, `prestige`, `attunements`, `worldmap`, and `social` (all
// split out of `gameplay` in A2-3 through A2-8) have NO ordering constraint
// relative to each other or to build/warfare/economy/research/profile —
// each was verified to own disjoint paths at extraction time. Their
// position here is extraction order, not a precedence requirement.
module.exports = function (db) {
  const router = express.Router();

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
    { name: 'social', factory: require('./kingdom-social') },
    { name: 'gameplay', factory: require('./kingdom-gameplay') },
  ];

  for (const { factory } of orderedRouters) {
    router.use(factory(db));
  }

  router.use(require('./kingdom-exploration')(db));

  return router;
};

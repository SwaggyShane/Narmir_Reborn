const express = require('express');

// Central composition for all kingdom routes.
// This replaces the previous pattern of multiple top-level app.use('/api/kingdom')
// calls. Order here determines precedence (more specific routers first).
module.exports = function (db) {
  const router = express.Router();

  // Common middleware for all kingdom endpoints (rate limiting, auth, etc.)
  // is applied at the top level in index.js when mounting this router.

  // Specific domain routers first (they take precedence over the general gameplay router)
  router.use(require('./kingdom-build')(db));
  router.use(require('./kingdom-warfare')(db));
  router.use(require('./kingdom-economy')(db));
  router.use(require('./kingdom-research')(db));
  router.use(require('./kingdom-profile')(db));

  // Main gameplay router (handles turn, hire, most general actions)
  const kingdomGameplayRouter = require('./kingdom-gameplay')(db);
  router.use(kingdomGameplayRouter);

  // Exploration depends on the gameplay router for some helpers
  router.use(require('./kingdom-exploration')(db, kingdomGameplayRouter));

  return router;
};

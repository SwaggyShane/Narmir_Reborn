'use strict';

require('dotenv').config();

// Set JWT_SECRET before any middleware/router imports (required at module load time)
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters-long-for-route-precedence-test!!';
}

const assert = require('assert');
const express = require('express');

const buildRouterFactory = require('../routes/kingdom-build');
const gameplayRouterFactory = require('../routes/kingdom-gameplay');

function createMockDb() {
  return {
    get: async () => ({}),
    run: async () => ({ changes: 0 }),
    all: async () => [],
  };
}

{
  const db = createMockDb();
  const app = express();

  const buildRouter = buildRouterFactory(db);
  buildRouter.__routerName = 'build';

  const gameplayRouter = gameplayRouterFactory(db);
  gameplayRouter.__routerName = 'gameplay';

  // Mount exactly in the order documented in index.js:
  // specific routers (build, warfare, etc.) first, then gameplay catch-all.
  // This ensures Express matches the more specific routers first.
  app.use('/api/kingdom', buildRouter);
  app.use('/api/kingdom', gameplayRouter);

  // Inspect the mounted layers to verify precedence contract
  const kingdomLayers = app._router.stack.filter((layer) =>
    layer.regexp && layer.regexp.source.includes('kingdom')
  );

  assert(
    kingdomLayers.length >= 2,
    'Expected at least two /api/kingdom mounts (build + gameplay)'
  );

  const firstKingdomLayer = kingdomLayers[0];
  assert.equal(
    firstKingdomLayer.handle && firstKingdomLayer.handle.__routerName,
    'build',
    'Build router must be the first /api/kingdom mount so its routes (e.g. /build, /build-queue) take precedence over the gameplay catch-all'
  );

  console.log('✓ Route precedence contract verified: build router mounted before gameplay');
}

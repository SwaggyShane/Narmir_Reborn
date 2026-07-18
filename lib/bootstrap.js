'use strict';

/**
 * Full boot sequence, extracted from index.js's former start(): rate-limit and
 * monitoring config, feature flags, app middleware, secrets validation, Vite (dev
 * only), DB init + boot data + regen catch-up + schedulers, route mounting, and
 * finalize (serving + listen + post-init).
 *
 * DB-init errors are caught and recorded via bootErrorRef so the server can still
 * boot in a degraded "DB offline" mode (see lib/setup-routes.js's /health
 * endpoint); errors anywhere else in this function are caught by the outer
 * try/catch and also recorded — matches the original index.js behavior exactly.
 */
async function bootstrap({ app, server, io, PORT, HOST, isBootedRef, bootErrorRef }) {
  const { initDb } = require('../db/schema');

  const {
    applyCrashSafeRegenCatchup,
    patchDefaultHeroAbilities,
    startRegenAndMarketSchedulers,
    loadBootData,
  } = require('./boot');

  const { logRateLimitConfig, generalLimiter } = require('../config/rate-limiting');
  logRateLimitConfig();

  const { logMonitoringConfig } = require('../config/monitoring');
  logMonitoringConfig();

  // Initialize feature flags for elevation system (Phases 1-3)
  const { initializeFlags } = require('../game/feature-flags');
  initializeFlags({
    FEATURE_ELEVATION_COMBAT: process.env.FEATURE_ELEVATION_COMBAT,
    FEATURE_ELEVATION_MOVEMENT: process.env.FEATURE_ELEVATION_MOVEMENT,
    FEATURE_ELEVATION_SPELLS: process.env.FEATURE_ELEVATION_SPELLS,
  });

  const { setupAppMiddleware } = require('./middleware');
  setupAppMiddleware(app);

  app.use(generalLimiter);

  console.log('[boot] Starting Narmir server...');

  const SecretsManager = require('../utils/secrets');
  const secretsManager = new SecretsManager();
  secretsManager.ensureSecretsConfigured();
  const railwayConfig = SecretsManager.validateRailwayConfig();
  if (railwayConfig) {
    console.log(`[boot] Running on Railway: ${railwayConfig.environment} (${railwayConfig.service})`);
  }

  let vite = null;
  try {
    if (process.env.NODE_ENV !== 'production') {
      const { setupVite } = require('./vite-setup');
      vite = await setupVite(app, server);
    }

    let db = null;
    try {
      db = await initDb();
      // (world-seed + fog init happens inside initDb)

      await loadBootData(db);

      await applyCrashSafeRegenCatchup(db);
      await patchDefaultHeroAbilities(db);
      startRegenAndMarketSchedulers(db, io);
    } catch (err) {
      bootErrorRef.value = err;
      console.error('[boot] DB ERROR (offline mode):', err.message);
    }

    const setupRoutes = require('./setup-routes');
    setupRoutes(app, { db, io, getBootError: () => bootErrorRef.value });

    const finalizeBoot = require('./finalize-boot');
    await finalizeBoot({
      app,
      server,
      PORT,
      HOST,
      vite,
      bootError: bootErrorRef.value,
      isBootedRef,
      db,
    });

    // Mark boot as complete so SIGTERM can close the pool safely
    if (db && db.bootComplete !== undefined) {
      db.bootComplete = true;
    }
  } catch (err) {
    bootErrorRef.value = err;
    console.error('[boot] FATAL:', err.message);
  }
}

module.exports = bootstrap;

require('dotenv').config();
// Railway binds NODE_ENV to the environment's display name ("Production"), but Express,
// Vite, and our own checks all compare against the lowercase Node convention 'production'.
// Canonicalize here — before the Express app is created or anything reads NODE_ENV — so a
// capitalized value can't silently leave the server running in dev mode (Vite dev server,
// CORS '*', no view caching). Trim whitespace to guard against cloud platform UI quirks.
// Mutating process.env is safe: libraries read it lazily.
if ((process.env.NODE_ENV || '').trim().toLowerCase() === 'production') process.env.NODE_ENV = 'production';

// Server logging to secure logs directory (not public) — extracted to lib/logger
require('./lib/logger').setupFileLogging();

// Initial boot state
const isBootedRef = { value: false };
let bootError = null;

const { app, server, io, PORT, HOST } = require('./lib/server')();

async function start() {
  const { initDb } = require('./db/schema');

  const {
    applyCrashSafeRegenCatchup,
    patchDefaultHeroAbilities,
    startRegenAndMarketSchedulers,
    loadBootData
  } = require('./lib/boot');

  const {
    logRateLimitConfig,
    turnLimiter,
    generalLimiter,
    adminLimiter,
    authSensitiveLimiter,
    adminIpCheck
  } = require('./config/rate-limiting');

  logRateLimitConfig();

  const { logMonitoringConfig } = require('./config/monitoring');
  logMonitoringConfig();

  // Initialize feature flags for elevation system (Phases 1-3)
  const { initializeFlags } = require('./game/feature-flags');
  initializeFlags({
    FEATURE_ELEVATION_COMBAT: process.env.FEATURE_ELEVATION_COMBAT,
    FEATURE_ELEVATION_MOVEMENT: process.env.FEATURE_ELEVATION_MOVEMENT,
    FEATURE_ELEVATION_SPELLS: process.env.FEATURE_ELEVATION_SPELLS,
  });

  const { setupAppMiddleware } = require('./lib/middleware');
  setupAppMiddleware(app);

  app.use(generalLimiter);

  console.log('[boot] Starting Narmir server...');

  const SecretsManager = require('./utils/secrets');
  const secretsManager = new SecretsManager();
  secretsManager.ensureSecretsConfigured();
  const railwayConfig = SecretsManager.validateRailwayConfig();
  if (railwayConfig) {
    console.log(`[boot] Running on Railway: ${railwayConfig.environment} (${railwayConfig.service})`);
  }

  let vite = null;
  try {
    if (process.env.NODE_ENV !== 'production') {
      const { setupVite } = require('./lib/vite-setup');
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
      bootError = err;
      console.error('[boot] DB ERROR (offline mode):', err.message);
    }

    const setupRoutes = require('./lib/setup-routes');

    const instrument = require('./instrument');

    setupRoutes(app, {
      db,
      io,
      getBootError: () => bootError, // Pass getter instead of stale value
      authSensitiveLimiter,
      turnLimiter,
      adminLimiter,
      adminIpCheck,
      requireAuth: require('./routes/middleware').requireAuth,
      setupApiGuards: require('./lib/middleware').setupApiGuards,
      apiNotFoundHandler: require('./lib/middleware').apiNotFoundHandler,
      setupSentryErrorHandler: require('./lib/error-handlers').setupSentryErrorHandler,
      createErrorHandlerMiddleware: require('./lib/error-handlers').createErrorHandlerMiddleware,
      Sentry: instrument.Sentry,
      sentryEnabled: instrument.sentryEnabled,
    });

    const finalizeBoot = require('./lib/finalize-boot');
    await finalizeBoot({
      app,
      server,
      PORT,
      HOST,
      vite,
      bootError,
      isBootedRef,
      Sentry: instrument.Sentry,
      sentryEnabled: instrument.sentryEnabled,
      db,
    });

    // Mark boot as complete so SIGTERM can close the pool safely
    if (db && db.bootComplete !== undefined) {
      db.bootComplete = true;
    }
    } catch (err) {
      bootError = err;
      console.error('[boot] FATAL:', err.message);
    }
  }

// Graceful shutdown handler (Priority #1 for Railway stability)
const gracefulShutdown = async (exitCode = 0) => {
  console.log('[shutdown] Received termination signal...');

  // Set a fallback timeout to force exit if graceful shutdown hangs
  const forceExitTimeout = setTimeout(() => {
    console.error('[shutdown] Graceful shutdown timed out after 10 seconds. Forcing exit...');
    process.exit(exitCode);
  }, 10000);
  forceExitTimeout.unref(); // Don't keep process alive for this timeout

  try {
    // Stop accepting new connections
    if (server) {
      await new Promise((resolve) => {
        server.close(() => {
          console.log('[shutdown] HTTP server closed');
          resolve();
        });
      });
    }

    // Close Socket.io before closing connections
    if (io) {
      await new Promise((resolve) => {
        io.close(() => {
          console.log('[shutdown] Socket.io closed');
          resolve();
        });
      });
    }

    // Shutdown audit scheduler if it exists
    if (global._audit_scheduler) {
      try {
        global._audit_scheduler.shutdown();
        console.log('[shutdown] Audit scheduler shut down');
      } catch (err) {
        console.error('[shutdown] Error closing audit scheduler:', err.message);
      }
    }

    console.log('[shutdown] Cleanup complete. Process will exit after all handles close.');
    clearTimeout(forceExitTimeout); // Cancel fallback timeout
    // Don't call process.exit() here - let process exit naturally when all handles close.
    // This allows db/schema.js shutdownPool to complete its async pool.end() call.
    // The fallback timeout above will force exit if it takes > 10 seconds.
  } catch (err) {
    console.error('[shutdown] Error during graceful shutdown:', err.message);
    clearTimeout(forceExitTimeout);
    // On error, use fallback timeout to force exit since it's already running
  }
};

process.on('SIGTERM', () => gracefulShutdown(0));
process.on('SIGINT', () => gracefulShutdown(0));

// Unhandled rejection handler - log but don't crash immediately
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise);
  console.error('[CRITICAL] Reason:', reason instanceof Error ? reason.message : reason);
  // Don't exit - let graceful shutdown handler manage process lifecycle
});

// Uncaught exception handler - log and trigger graceful shutdown with error code
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err.message);
  console.error('[CRITICAL] Stack:', err.stack);
  // Exit with code 1 to signal container orchestrator of crash
  gracefulShutdown(1).catch(() => process.exit(1));
});

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

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
      bootError,
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
const gracefulShutdown = async () => {
  console.log('[shutdown] Received termination signal...');

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      console.log('[shutdown] HTTP server closed');
    });
  }

  // Close Socket.io before closing connections
  if (io) {
    io.close(() => {
      console.log('[shutdown] Socket.io closed');
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

  console.log('[shutdown] Cleanup complete. Exiting...');
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Unhandled rejection handler - log but don't crash immediately
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise);
  console.error('[CRITICAL] Reason:', reason instanceof Error ? reason.message : reason);
  // Don't exit - let graceful shutdown handler manage process lifecycle
});

// Uncaught exception handler - log and trigger graceful shutdown
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err.message);
  console.error('[CRITICAL] Stack:', err.stack);
  // Trigger graceful shutdown after logging
  gracefulShutdown().catch(() => process.exit(1));
});

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

'use strict';

const { ensureCsrfToken, cleanupOrphanedTransactions, cacheKingdomId, requireAuth } = require('../routes/middleware');
const { setupApiGuards, apiNotFoundHandler } = require('./middleware');
const { setupSentryErrorHandler, createErrorHandlerMiddleware } = require('./error-handlers');
const { turnLimiter, adminLimiter, authSensitiveLimiter, adminIpCheck } = require('../config/rate-limiting');
const { Sentry, sentryEnabled } = require('../instrument');

const engine = require('../game/engine');
const config = require('../game/config');
const pkg = require('../package.json');
const { rankingsCache } = require('../cache.js');
const setupSockets = require('../game/sockets');

// Only db, io, and getBootError are genuinely per-boot runtime values — everything
// else above is a stateless module require with a single implementation, so there
// is no reason to thread it through index.js as an injected dependency (was a
// 14-property DI bag; those 11 module requires are the same every time).
module.exports = function setupRoutes(app, { db, io, getBootError }) {
  // Health check endpoint - Railway load balancer uses this for liveness checks
  // Does NOT require database, so it works even if boot is in progress
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: Math.floor(Date.now() / 1000),
      booted: getBootError() === null, // true if boot succeeded (calls getter to get fresh value)
    });
  });

  setupApiGuards(app, { getBootError });

  app.use('/api/auth',         authSensitiveLimiter, require('../routes/auth')(db));
  app.use('/api/forum',        ensureCsrfToken, require('../routes/forum')(db));

  const kingdomRouter = require('../routes/kingdom')(db);
  app.use('/api/kingdom', turnLimiter, cacheKingdomId(db), ensureCsrfToken, cleanupOrphanedTransactions(db), kingdomRouter);
  app.use('/api/hero',         turnLimiter, cacheKingdomId(db), ensureCsrfToken,  require('../routes/hero')(db));
  const adminRouter = require('../routes/admin')(db, io);
  app.use('/api/admin', adminLimiter, adminIpCheck, adminRouter);
  app.use('/api/discord', require('../routes/discord')(db));

  app.use('/api/alliance', require('../routes/alliance')(db));

  app.use('/api/world', require('../routes/bounties')(db));

  app.use('/api/messages', requireAuth, require('../routes/messages')(db, io));

  app.use('/api', require('../routes/public')(db, engine, config, rankingsCache, pkg));
  
  app.use('/api', require('../routes/feedback')(db, io, config));

  app.use('/api', require('../routes/test-results')(db, io));

  app.all('/api/*', apiNotFoundHandler());

  setupSentryErrorHandler(app, Sentry, sentryEnabled);
  app.use(createErrorHandlerMiddleware(Sentry, sentryEnabled));

  setupSockets(io, db);
  engine.io = io;
  console.log('[socket.io] Real-time handlers registered');

  // Note: setupPostInitBoot and setupAuditScheduler are called from caller after this
  // to keep ordering explicit in index bootstrap.
};

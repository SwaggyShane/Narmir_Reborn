'use strict';

const { ensureCsrfToken, cleanupOrphanedTransactions, cacheKingdomId } = require('../routes/middleware');

const engine = require('../game/engine');
const config = require('../game/config');
const pkg = require('../package.json');
const { rankingsCache } = require('../cache.js');
const setupSockets = require('../game/sockets');

module.exports = function setupRoutes(app, {
  db,
  io,
  bootError,
  authSensitiveLimiter,
  turnLimiter,
  adminLimiter,
  adminIpCheck,
  requireAuth,
  setupApiGuards,
  apiNotFoundHandler,
  setupSentryErrorHandler,
  createErrorHandlerMiddleware,
  Sentry,
  sentryEnabled,
}) {
  setupApiGuards(app, { getBootError: () => bootError });

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

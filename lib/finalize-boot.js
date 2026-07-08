'use strict';

const { setupPostInitBoot, setupAuditScheduler } = require('./boot');
const { flushSentry, setupProcessErrorHandlers } = require('./error-handlers');

module.exports = async function finalizeBoot({
  app,
  server,
  PORT,
  HOST,
  vite,
  bootError,
  isBootedRef, // { value: boolean } to mutate outer isBooted
  Sentry,
  sentryEnabled,
  db,
}) {
  const { setupServing } = require('./serve')(vite, bootError, isBootedRef.value, PORT, HOST, server);
  setupServing(app);

  await setupPostInitBoot(db);
  await setupAuditScheduler(db);

  setupProcessErrorHandlers(Sentry, sentryEnabled, flushSentry);

  isBootedRef.value = true;
  console.log('[boot] Startup complete.');

  server.listen(PORT, HOST, () => {
    console.log(`[boot] Server listening on http://localhost:${PORT}`);
  });
};

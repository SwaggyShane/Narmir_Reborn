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

  // Add timeout to prevent boot from hanging indefinitely (Railway container has ~60s limit)
  const bootTimeout = setTimeout(() => {
    console.error('[boot] TIMEOUT: Post-init boot took too long, proceeding without full initialization');
  }, 50000); // 50 seconds - leave 10s buffer for Railway's timeout

  try {
    await setupPostInitBoot(db);
    await setupAuditScheduler(db);
  } catch (err) {
    console.error('[boot] Error during post-init setup:', err.message);
    // Don't re-throw; continue with partial initialization
  } finally {
    clearTimeout(bootTimeout);
  }

  setupProcessErrorHandlers(Sentry, sentryEnabled, flushSentry);

  isBootedRef.value = true;
  console.log('[boot] Startup complete.');

  server.listen(PORT, HOST, () => {
    console.log(`[boot] Server listening on http://localhost:${PORT}`);
  });
};

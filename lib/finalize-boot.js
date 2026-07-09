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
  let bootTimeout;
  const timeoutPromise = new Promise((_, reject) => {
    bootTimeout = setTimeout(() => {
      reject(new Error('Post-init boot took too long (50s timeout reached)'));
    }, 50000); // 50 seconds - leave 10s buffer for Railway's timeout
  });

  try {
    await Promise.race([
      (async () => {
        await setupPostInitBoot(db);
        await setupAuditScheduler(db);
      })(),
      timeoutPromise
    ]);
  } catch (err) {
    console.error('[boot] Error or timeout during post-init setup:', err.message);
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

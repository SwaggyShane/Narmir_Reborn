'use strict';

const { setupPostInitBoot, setupAuditScheduler } = require('./boot');

// unhandledRejection/uncaughtException have exactly one owner now: index.js
// registers them once, early, via lib/error-handlers.js's setupProcessErrorHandlers
// — before this ever ran. Do not add a second registration here (see lib/BOOT.md).
module.exports = async function finalizeBoot({
  app,
  server,
  PORT,
  HOST,
  vite,
  bootError,
  isBootedRef, // { value: boolean } to mutate outer isBooted
  db,
}) {
  const { setupServing } = require('./serve')(vite, bootError, isBootedRef.value, PORT, HOST, server);
  setupServing(app);

  isBootedRef.value = true;

  // Start server listening immediately — post-init tasks run in background
  server.listen(PORT, HOST, () => {
    console.log(`[boot] Server listening on http://localhost:${PORT}`);
  });

  // Run post-init tasks in background (don't block server startup)
  // These tasks can take time but shouldn't block health checks or client connections
  (async () => {
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
      // Continue with partial initialization — don't crash server
    } finally {
      clearTimeout(bootTimeout);
    }
  })().catch((err) => {
    console.error('[boot] Uncaught error in post-init background tasks:', err.message);
  });
};

'use strict';

// Single owner of graceful shutdown: stop accepting connections, close Socket.io,
// shut down the audit scheduler (if booted), then let the process exit naturally
// once all handles close (db/schema.js's pool.end() needs that). A fallback timeout
// forces exit if any of that hangs.
function createGracefulShutdown({ server, io }) {
  return async function gracefulShutdown(exitCode = 0) {
    const forceExitTimeout = setTimeout(() => {
      console.error('[shutdown] Graceful shutdown timed out after 10 seconds. Forcing exit...');
      process.exit(exitCode);
    }, 10000);
    forceExitTimeout.unref();

    try {
      if (server) {
        await new Promise((resolve) => {
          server.close(() => resolve());
        });
      }

      if (io) {
        await new Promise((resolve) => {
          io.close(() => resolve());
        });
      }

      if (global._audit_scheduler) {
        try {
          global._audit_scheduler.shutdown();
        } catch (err) {
          console.error('[shutdown] Error closing audit scheduler:', err.message);
        }
      }

      clearTimeout(forceExitTimeout);
      // Don't call process.exit() here — let the process exit naturally once all
      // handles close, so db/schema.js's shutdownPool can finish pool.end(). The
      // fallback timeout above forces exit if that takes too long.
    } catch (err) {
      console.error('[shutdown] Error during graceful shutdown:', err.message);
      // Deliberately do NOT clear forceExitTimeout here — if shutdown itself threw,
      // handles may never close on their own, so the timeout must stay armed as the
      // safety net that forces exit in 10s. (The original inline version cleared it
      // here too, which silently disabled the safety net on exactly the path that
      // needed it most — fixed, not carried forward.)
    }
  };
}

module.exports = { createGracefulShutdown };

'use strict';

// Re-create flushSentry here (moved from index monolith)
async function flushSentry(Sentry, sentryEnabled, timeoutMs = 2000) {
  if (!sentryEnabled || !Sentry) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch (err) {
    console.error('[sentry] Flush failed:', err?.message || err);
  }
}

// Express error handler middleware (final one, after routes)
function createErrorHandlerMiddleware(_Sentry, _sentryEnabled) {
  return (err, req, res, _next) => {
    // Normalize err to ensure safe property access (handle null, undefined, primitives)
    const errorObj = err instanceof Error
      ? err
      : (typeof err === 'object' && err !== null
          ? err
          : new Error(err ? String(err) : 'An unknown error occurred'));

    const requestId = Math.random().toString(36).slice(2, 11);
    const statusCode = errorObj.statusCode || errorObj.status || 500;
    const isDev = process.env.NODE_ENV !== 'production';

    // Log error with context
    const errorLog = {
      requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      status: statusCode,
      errorName: errorObj.name || 'Error',
      errorMessage: errorObj.message || 'An unknown error occurred',
      ...(isDev && { stack: errorObj.stack })
    };

    if (statusCode >= 500) {
      console.error('[ERROR]', JSON.stringify(errorLog));
    } else if (statusCode >= 400) {
      console.warn('[WARN]', JSON.stringify(errorLog));
    }

    // Send error response
    if (!res.headersSent) {
      res.status(statusCode).json({
        error: isDev ? errorObj.message : 'Internal server error',
        ...(isDev && { requestId, stack: errorObj.stack })
      });
    }
  };
}

// Recoverable PG / system errors (don't crash server)
const RECOVERABLE_PG_CODES = new Set([
  '25P03', // idle_in_transaction_session_timeout
  '57P01', // admin_shutdown / terminating connection due to administrator command
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08006', // connection_failure
  '08003', // connection_does_not_exist
  '08000', // connection_exception
]);
const RECOVERABLE_SYSTEM_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT']);

function isRecoverablePgError(error) {
  return !!error && (RECOVERABLE_PG_CODES.has(error.code) || RECOVERABLE_SYSTEM_CODES.has(error.code));
}

// Setup process-level error handlers (unhandledRejection, uncaughtException).
// Single owner: index.js must not register its own listeners for these events —
// Node calls every registered listener, so a second registration elsewhere means
// both fire (previously: this handler's process.exit(1) raced index.js's separate
// graceful-shutdown attempt, and index.js's copy had no idea a PG error was
// recoverable and would try to tear the server down anyway).
function setupProcessErrorHandlers(Sentry, sentryEnabled, { flushSentry: flushSentryFn, gracefulShutdown } = {}) {
  // Global error handlers to prevent silent crashes
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
    if (sentryEnabled && Sentry) {
      Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
    }
  });

  process.on('uncaughtException', async (error) => {
    if (isRecoverablePgError(error)) {
      console.error(`[db] Recovered from PG connection error (${error.code}): ${error.message} — pool will reconnect, not exiting.`);
      if (sentryEnabled && Sentry) {
        Sentry.captureMessage(`Recovered PG connection error: ${error.code}`, {
          level: 'warning',
          tags: { area: 'database', recoverable: 'true' },
          extra: { message: error.message },
        });
      }
      return;
    }
    console.error('[CRITICAL] Uncaught Exception:', error);
    if (sentryEnabled && Sentry) {
      Sentry.captureException(error);
    }
    if (flushSentryFn) {
      await flushSentryFn(Sentry, sentryEnabled);
    }
    // Cannot safely recover — application is in undefined state. Use the single
    // graceful-shutdown path (closes server/io/audit-scheduler, then exits) rather
    // than a raw process.exit, so in-flight connections and the DB pool get a
    // chance to close cleanly; gracefulShutdown's own timeout forces exit if that
    // hangs, so this still can't hang forever.
    if (gracefulShutdown) {
      await gracefulShutdown(1);
    } else {
      process.exit(1);
    }
  });
}

// Optionally register Sentry's express error handler if enabled (call before final custom handler)
function setupSentryErrorHandler(app, Sentry, sentryEnabled) {
  if (!sentryEnabled || !Sentry || !app || !Sentry.setupExpressErrorHandler) return;
  Sentry.setupExpressErrorHandler(app, {
    shouldHandleError(error) {
      const statusCode =
        Number.parseInt(String(error?.statusCode || error?.status || error?.status_code || error?.output?.statusCode || 500), 10)
        || 500;
      return statusCode >= 500;
    },
  });
}

module.exports = {
  flushSentry,
  createErrorHandlerMiddleware,
  setupProcessErrorHandlers,
  setupSentryErrorHandler,
  isRecoverablePgError,
};

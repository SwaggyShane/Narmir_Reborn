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

let Sentry, sentryEnabled;
try {
  ({ Sentry, sentryEnabled } = require('./instrument'));
} catch (err) {
  // instrument.js not found; proceed without Sentry
  Sentry = null;
  sentryEnabled = false;
}
const { flushSentry, setupProcessErrorHandlers } = require('./lib/error-handlers');
const { createGracefulShutdown } = require('./lib/shutdown');
const bootstrap = require('./lib/bootstrap');

// Initial boot state
const isBootedRef = { value: false };
const bootErrorRef = { value: null };

const { app, server, io, PORT, HOST } = require('./lib/server')();

// Single owner of graceful shutdown (see lib/shutdown.js) and of the
// unhandledRejection/uncaughtException listeners (see lib/error-handlers.js) —
// register both here, once, before bootstrap() runs, so a crash during boot
// itself gets the same handling as one after boot completes. See lib/BOOT.md.
const gracefulShutdown = createGracefulShutdown({ server, io });
process.on('SIGTERM', () => gracefulShutdown(0));
process.on('SIGINT', () => gracefulShutdown(0));
setupProcessErrorHandlers(Sentry, sentryEnabled, { flushSentry, gracefulShutdown });

bootstrap({ app, server, io, PORT, HOST, isBootedRef, bootErrorRef }).catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

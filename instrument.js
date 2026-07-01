const Sentry = require('@sentry/node');

const sentryEnabled =
  process.env.SENTRY_ENABLED === 'true'
  || (process.env.SENTRY_ENABLED !== 'false' && !!process.env.SENTRY_DSN);

if (sentryEnabled && process.env.SENTRY_DSN) {
  const tracesSampleRate = Number.parseFloat(process.env.SENTRY_SAMPLE_RATE || '0.1');

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
    sendDefaultPii: false,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
  });
}

module.exports = {
  Sentry,
  sentryEnabled,
};

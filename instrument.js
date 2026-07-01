const Sentry = require('@sentry/node');

const hasSentryDsn = typeof process.env.SENTRY_DSN === 'string' && process.env.SENTRY_DSN.trim().length > 0;
const sentryEnabled =
  hasSentryDsn
  && (process.env.SENTRY_ENABLED === 'true' || process.env.SENTRY_ENABLED !== 'false');

if (sentryEnabled) {
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

'use strict';

const { monitoringConfig } = require('../config/monitoring');
const { Sentry, sentryEnabled } = require('../instrument');

// HTTPS redirect (prod only)
function httpsRedirectMiddleware() {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'production' && !req.secure) {
      const host = req.get('host');
      if (!host) {
        return res.status(400).send('Bad Request: Missing Host header');
      }
      return res.redirect(301, `https://${host}${req.originalUrl}`);
    }
    next();
  };
}

// Security headers (HSTS, CSP, etc)
function securityHeadersMiddleware() {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production' && req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Content-Security-Policy.
    //   - In production we ship a strict-ish CSP: only same-origin scripts, plus
    //     'unsafe-inline' because the legacy client/index.html still relies on
    //     inline event handlers and inline <script> blocks. Crucially we drop
    //     'unsafe-eval' and forbid third-party script origins — neither of which
    //     the app needs. Fonts/styles are whitelisted to Google Fonts.
    //   - In development we keep the permissive policy so hot-reload, Vite's
    //     dev-server hooks, and local tooling don't trip the policy.
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: blob:",
          "media-src 'self'",
          "connect-src 'self' ws: wss:",
          "frame-ancestors 'none'",
          "form-action 'self'",
          "base-uri 'self'",
          "object-src 'none'",
        ].join("; "),
      );
    } else {
      res.setHeader(
        "Content-Security-Policy",
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * 'unsafe-inline' 'unsafe-eval' ws: wss:;",
      );
    }
    next();
  };
}

// Response time monitoring (warn on slow endpoints per config)
function responseTimeMonitoringMiddleware() {
  return (req, res, next) => {
    if (!monitoringConfig.responseTimeTracking.enabled) return next();

    const startedAt = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const pathOnly = String(req.path || req.originalUrl || req.url || '').split('?')[0];
      const baseline = monitoringConfig.responseTimeBaselines[pathOnly];
      const thresholdMs = baseline?.alert || monitoringConfig.responseTimeTracking.slowThresholdMs;

      if (durationMs >= thresholdMs) {
        console.warn(
          `[monitoring] Slow endpoint: ${req.method} ${pathOnly} ${durationMs}ms status=${res.statusCode}`
        );
        if (sentryEnabled) {
          Sentry.captureMessage(`Slow endpoint: ${req.method} ${pathOnly}`, {
            level: 'warning',
            tags: { area: 'monitoring', endpoint: pathOnly, method: req.method },
            extra: { durationMs, statusCode: res.statusCode },
          });
        }
      }
    });

    next();
  };
}

// Dev-only request logging middleware (for main.js / index debug)
function devRequestDebugMiddleware() {
  const path = require('path');
  const fs = require('fs');
  return (req, res, next) => {
    if (req.url.includes('main.js')) {
      const checkPath = path.join(__dirname, '..', req.url.split('?')[0]);
      console.log(`[debug] [${new Date().toISOString()}] Request for main.js: ${req.url}. Physical path: ${checkPath}. Exists: ${fs.existsSync(checkPath)}`);
    }
    if (req.url === '/' || req.url.includes('index.html')) {
      console.log(`[debug] [${new Date().toISOString()}] Request for index: ${req.method} ${req.url}`);
    }
    next();
  };
}

function setupAppMiddleware(app) {
  // Order matters: redirect -> headers -> parsers (already in index) -> monitoring
  app.use(httpsRedirectMiddleware());
  app.use(securityHeadersMiddleware());
  app.use(responseTimeMonitoringMiddleware());
}

// Guard all /api before routes if boot failed (prevents leaking to HTML etc)
function createBootErrorApiGuard(getBootError) {
  return (req, res, next) => {
    const bootError = getBootError && getBootError();
    if (bootError) {
      const details = process.env.NODE_ENV === 'production'
        ? 'Service temporarily unavailable'
        : (bootError.message || String(bootError));
      return res.status(500).json({
        status: 'error',
        error: 'Service Unavailable',
        details
      });
    }
    next();
  };
}

// Catch-all API 404 to avoid falling through to HTML responses for unknown API paths
function apiNotFoundHandler() {
  return (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
  };
}

function setupApiGuards(app, { getBootError } = {}) {
  app.use('/api/', createBootErrorApiGuard(getBootError));
  // Note: specific routes mount after this; the 404 after routes
}

module.exports = {
  httpsRedirectMiddleware,
  securityHeadersMiddleware,
  responseTimeMonitoringMiddleware,
  devRequestDebugMiddleware,
  setupAppMiddleware,
  createBootErrorApiGuard,
  apiNotFoundHandler,
  setupApiGuards,
};

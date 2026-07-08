// Rate Limiting Configuration
// Controls API request limits to prevent DDoS and abuse
// Configure via environment variables (see RATE_LIMITING_GUIDE.md)

const path = require('path');
const fs = require('fs');

const isProd = process.env.NODE_ENV === 'production';

// Ensure logs dir for rate limit hits (mirrors setup in index.js)
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const rateLimitLogFilePath = path.join(logsDir, 'rate-limits.log');

// Parse integer from environment variable with fallback default
function getEnvInt(envVar, defaultValue) {
  const value = process.env[envVar];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

const rateLimitConfig = {
  // Authentication (login/register) rate limiting
  // Strict to prevent brute-force attacks
  auth: {
    max: getEnvInt('RATE_LIMIT_AUTH_MAX', isProd ? 10 : 60),
    windowMs: getEnvInt('RATE_LIMIT_AUTH_WINDOW_MS', 60 * 1000),
    description: 'Login and registration attempts (brute-force protection)'
  },

  // Turn/action rate limiting
  // Applies to all game mutations (turn, attack, build, research, hire, etc.)
  // 300/min = 5 requests/sec, realistic for human players
  turn: {
    max: getEnvInt('RATE_LIMIT_TURN_MAX', 300),
    windowMs: getEnvInt('RATE_LIMIT_TURN_WINDOW_MS', 60 * 1000),
    description: 'Game mutations (/turn, /attack, /build, /research, /hire, etc.)'
  },

  // General API rate limiting
  // Read-heavy endpoints like rankings, forums, market queries
  general: {
    max: getEnvInt('RATE_LIMIT_GENERAL_MAX', 500),
    windowMs: getEnvInt('RATE_LIMIT_GENERAL_WINDOW_MS', 60 * 1000),
    description: 'General API endpoints (read-only, rankings, forums, etc.)'
  },

  // Admin operations rate limiting
  // Very strict to prevent accidental mass changes or mischief
  admin: {
    max: getEnvInt('RATE_LIMIT_ADMIN_MAX', isProd ? 30 : 120),
    windowMs: getEnvInt('RATE_LIMIT_ADMIN_WINDOW_MS', 60 * 1000),
    description: 'Admin operations (strict to prevent accidental bulk changes)'
  }
};

// Validate configuration
function validateRateLimitConfig() {
  const issues = [];

  for (const [tier, config] of Object.entries(rateLimitConfig)) {
    if (!Number.isInteger(config.max) || config.max < 1) {
      issues.push(`Invalid ${tier}.max: must be positive integer, got ${config.max}`);
    }
    if (!Number.isInteger(config.windowMs) || config.windowMs < 1000) {
      issues.push(`Invalid ${tier}.windowMs: must be >= 1000ms, got ${config.windowMs}`);
    }
  }

  if (issues.length > 0) {
    console.error('[Rate Limiting] Configuration errors:');
    issues.forEach(issue => console.error(`  - ${issue}`));
    throw new Error('Rate limiting configuration invalid');
  }
}

// Log active configuration on startup
function logRateLimitConfig() {
  console.log('[Rate Limiting] Configuration:');
  for (const [tier, config] of Object.entries(rateLimitConfig)) {
    const reqPerSec = (config.max / (config.windowMs / 1000)).toFixed(1);
    console.log(`  ${tier.padEnd(10)}: ${config.max} req/min (${reqPerSec} req/sec)`);
  }
}

// ── Rate limiting helpers and factory (moved from index.js for better separation) ──

function normalizeClientIp(rawIp) {
  let clientIp = rawIp || '';
  if (clientIp.startsWith('::ffff:')) {
    clientIp = clientIp.substring(7);
  }
  return clientIp;
}

function getAllowedAdminIps() {
  return String(process.env.ADMIN_ALLOWED_IPS || '')
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean);
}

function isAllowedAdminIp(req) {
  const allowedIps = getAllowedAdminIps();
  if (allowedIps.length === 0) return false;
  return allowedIps.includes(normalizeClientIp(req.ip || req.socket?.remoteAddress || ''));
}

function isAdminRoute(req) {
  const reqPath = String(req.path || req.url || '').split('?')[0];
  return reqPath.startsWith('/api/admin');
}

function logRateLimitHit(req, maxRequests, windowMs) {
  if (process.env.NODE_ENV !== 'production') return;

  const entry = [
    new Date().toISOString(),
    '429',
    normalizeClientIp(req.ip || req.socket?.remoteAddress || 'unknown'),
    String(req.method || 'GET'),
    String(req.originalUrl || req.url || ''),
    `${maxRequests}/${windowMs}ms`
  ].join(' | ');

  try {
    fs.appendFileSync(rateLimitLogFilePath, `${entry}\n`);
  } catch {}
}

function makeRateLimiter(maxRequests, windowMs, options = {}) {
  const hits = new Map();
  const { bypass } = options;

  // Periodically prune stale entries to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    const staleThreshold = now - windowMs;
    for (const [key, timestamps] of hits) {
      if (timestamps.length === 0 || timestamps[timestamps.length - 1] < staleThreshold) {
        hits.delete(key);
      }
    }
  }, windowMs);

  return function(req, res, next) {
    if (typeof bypass === 'function' && bypass(req)) {
      return next();
    }

    const key = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create request timestamps for this IP
    let timestamps = hits.get(key) || [];

    // Remove timestamps outside the sliding window
    timestamps = timestamps.filter(timestamp => timestamp > windowStart);

    // Cap array size to prevent memory exhaustion from attackers
    if (timestamps.length <= maxRequests) {
      timestamps.push(now);
    }

    // Update the map
    hits.set(key, timestamps);

    // Check if limit exceeded
    if (timestamps.length > maxRequests) {
      logRateLimitHit(req, maxRequests, windowMs);
      return res.status(429).json({ error: 'Too many requests — slow down' });
    }

    next();
  };
}

const authAttemptLimiter = makeRateLimiter(rateLimitConfig.auth.max, rateLimitConfig.auth.windowMs, {
  bypass: () => process.env.NODE_ENV !== 'production',
});
const turnLimiter = makeRateLimiter(rateLimitConfig.turn.max, rateLimitConfig.turn.windowMs, {
  bypass: () => process.env.NODE_ENV !== 'production',
});
const generalLimiter = makeRateLimiter(rateLimitConfig.general.max, rateLimitConfig.general.windowMs, {
  bypass: (req) => process.env.NODE_ENV !== 'production' || (isAdminRoute(req) && isAllowedAdminIp(req))
});
const adminLimiter = makeRateLimiter(rateLimitConfig.admin.max, rateLimitConfig.admin.windowMs, {
  bypass: isAllowedAdminIp
});

function isAuthSensitiveRoute(req) {
  if (req.method !== 'POST') return false;
  const path = String(req.path || req.url || '').split('?')[0];
  return path.endsWith('/login') || path.endsWith('/register');
}

function authSensitiveLimiter(req, res, next) {
  if (!isAuthSensitiveRoute(req)) return next();
  return authAttemptLimiter(req, res, next);
}

function adminIpCheck(req, res, next) {
  if (getAllowedAdminIps().length === 0) return next();

  if (!isAllowedAdminIp(req)) {
    return res.status(403).json({ error: 'Admin access denied' });
  }
  next();
}

// Validate on module load
validateRateLimitConfig();

module.exports = {
  rateLimitConfig,
  logRateLimitConfig,
  isProd,
  // Limiters and helpers (extracted from index.js)
  authAttemptLimiter,
  turnLimiter,
  generalLimiter,
  adminLimiter,
  authSensitiveLimiter,
  adminIpCheck,
  normalizeClientIp,
  getAllowedAdminIps,
  isAllowedAdminIp,
  isAdminRoute,
  makeRateLimiter
};

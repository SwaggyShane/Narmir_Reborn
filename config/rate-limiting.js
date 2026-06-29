// Rate Limiting Configuration
// Controls API request limits to prevent DDoS and abuse
// Configure via environment variables (see RATE_LIMITING_GUIDE.md)

const isProd = process.env.NODE_ENV === 'production';

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

// Validate on module load
validateRateLimitConfig();

module.exports = {
  rateLimitConfig,
  logRateLimitConfig,
  isProd
};

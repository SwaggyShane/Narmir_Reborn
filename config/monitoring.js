// Monitoring & Alerting Configuration
// Defines alert thresholds and monitoring settings

const isProd = process.env.NODE_ENV === 'production';

const monitoringConfig = {
  // Error tracking
  sentry: {
    enabled: !!process.env.SENTRY_DSN,
    dsn: process.env.SENTRY_DSN || '',
    environment: process.env.SENTRY_ENVIRONMENT || (isProd ? 'production' : 'development'),
    sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '0.1'),
    maxBreadcrumbs: 50,
  },

  // Alert thresholds
  alerts: {
    errorRatePercent: parseFloat(process.env.ALERT_ERROR_RATE || '1'),
    rateLimitedPercent: parseFloat(process.env.ALERT_RATE_LIMIT || '5'),

    // Response time thresholds (milliseconds)
    p95ResponseTimeMs: parseInt(process.env.ALERT_P95_MS || '500', 10),
    p99ResponseTimeMs: parseInt(process.env.ALERT_P99_MS || '1000', 10),
    slowEndpointMs: parseInt(process.env.ALERT_SLOW_ENDPOINT_MS || '1000', 10),

    // Database alerts
    dbPoolAvailableConnections: parseInt(process.env.ALERT_DB_POOL_MIN || '2', 10),
    dbWaitingRequests: parseInt(process.env.ALERT_DB_WAITING || '5', 10),
    slowQueryMs: parseInt(process.env.ALERT_SLOW_QUERY_MS || '1000', 10),

    // System alerts
    memoryUsagePercent: parseInt(process.env.ALERT_MEMORY_PERCENT || '80', 10),
    cpuUsagePercent: parseInt(process.env.ALERT_CPU_PERCENT || '80', 10),
    diskUsagePercent: parseInt(process.env.ALERT_DISK_PERCENT || '85', 10),
  },

  // Critical endpoints to monitor closely
  criticalEndpoints: [
    '/api/turn',
    '/api/attack',
    '/api/spell',
    '/api/covert',
    '/api/fire',
    '/api/expedition',
    '/api/kingdom/build',
    '/api/rankings',
    '/api/auth/me',
  ],

  // Response time baselines by endpoint
  responseTimeBaselines: {
    '/api/turn': { p95: 200, p99: 500, alert: 1000 },
    '/api/attack': { p95: 200, p99: 500, alert: 1000 },
    '/api/spell': { p95: 200, p99: 500, alert: 1000 },
    '/api/expedition': { p95: 150, p99: 300, alert: 750 },
    '/api/rankings': { p95: 100, p99: 200, alert: 500 },
    '/api/forum': { p95: 100, p99: 300, alert: 500 },
    '/api/market': { p95: 100, p99: 300, alert: 500 },
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || (isProd ? 'warn' : 'debug'),
    slowQueryLogFile: process.env.SLOW_QUERY_LOG || './logs/slow-queries.log',
    rateLimitLogFile: process.env.RATE_LIMIT_LOG || './logs/rate-limits.log',
    serverLogFile: process.env.SERVER_LOG || './logs/server.log',
    logRotationDays: parseInt(process.env.LOG_RETENTION_DAYS || '7', 10),
  },

  // Database pool monitoring
  poolMonitoring: {
    checkIntervalMs: 60000, // Check every 60 seconds
    alertOnWaiting: true,
    alertOnLowAvailable: true,
  },

  // Response time tracking
  responseTimeTracking: {
    enabled: true,
    slowThresholdMs: 1000,
    sampleRate: isProd ? 0.1 : 1.0, // 10% in prod, 100% in dev
  },
};

// Validate configuration
function validateMonitoringConfig() {
  const issues = [];

  if (monitoringConfig.sentry.enabled && !monitoringConfig.sentry.dsn) {
    issues.push('SENTRY_DSN environment variable required when error tracking is enabled');
  }

  for (const [key, value] of Object.entries(monitoringConfig.alerts)) {
    if (typeof value === 'number' && (isNaN(value) || value < 0)) {
      issues.push(`Invalid alert threshold ${key}: ${value}`);
    }
  }

  if (issues.length > 0) {
    console.warn('[Monitoring] Configuration warnings:');
    issues.forEach(issue => console.warn(`  - ${issue}`));
  }
}

// Log active configuration
function logMonitoringConfig() {
  console.log('[Monitoring] Alert Thresholds:');
  console.log(`  Error rate: ${monitoringConfig.alerts.errorRatePercent}%`);
  console.log(`  Rate limited: ${monitoringConfig.alerts.rateLimitedPercent}%`);
  console.log(`  P95 response: ${monitoringConfig.alerts.p95ResponseTimeMs}ms`);
  console.log(`  P99 response: ${monitoringConfig.alerts.p99ResponseTimeMs}ms`);
  console.log(`  Slow endpoint: ${monitoringConfig.alerts.slowEndpointMs}ms`);

  if (monitoringConfig.sentry.enabled) {
    console.log(`[Sentry] Error tracking enabled (${monitoringConfig.sentry.environment})`);
  } else {
    console.log('[Sentry] Error tracking disabled (set SENTRY_DSN to enable)');
  }
}

validateMonitoringConfig();

module.exports = {
  monitoringConfig,
  logMonitoringConfig,
  isProd,
};

# Monitoring & Alerting Setup

**Status:** ✅ Infrastructure Documented  
**Last Updated:** 2026-06-29  
**Environment:** Production + Development  

---

## Overview

Narmir Reborn monitoring strategy covers three critical areas:

1. **Application Performance** — Response times, error rates, throughput
2. **Database Health** — Query performance, connection pool saturation, slow queries
3. **System Health** — Memory usage, CPU, disk space, uptime

### Alert Response SLA

| Severity | SLA | Action |
|----------|-----|--------|
| **Critical** | 5 minutes | Page on-call engineer |
| **High** | 15 minutes | Email + Slack notification |
| **Medium** | 1 hour | Slack notification + log analysis |
| **Low** | 24 hours | Daily digest |

---

## Error Tracking (Sentry / Error Monitoring)

### Setup

**Recommended:** Use Sentry (sentry.io) for error tracking

**Environment Variables:**
```bash
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
SENTRY_ENVIRONMENT=production
SENTRY_SAMPLE_RATE=0.1  # 10% sampling in production (adjust based on volume)
```

### Integration Points

**Application Startup:**
```javascript
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || 'development',
  tracesSampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '0.1'),
  attachStacktrace: true,
  maxBreadcrumbs: 50,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

**Error Capture:**
- All unhandled exceptions automatically captured
- Manual error logging: `Sentry.captureException(error)`
- Context tagging: `Sentry.setContext('kingdomId', { id: kingdomId })`

### Critical Errors to Track

| Error | Alert Level | Action |
|-------|------------|--------|
| Database connection failed | Critical | Page engineer, check PostgreSQL status |
| 500 Internal Server Error | High | Review error logs, check application health |
| Rate limiter exhaustion | Medium | Analyze traffic patterns, check for DDoS |
| Transaction deadlock | High | Review concurrent operations, check lock ordering |
| Memory leak detected | High | Restart application, analyze heap dumps |

---

## Slow Query Detection

### PostgreSQL Configuration

Enable slow query logging in PostgreSQL:

```sql
-- Connect to production database as superuser
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1 second
ALTER SYSTEM SET log_statement = 'all';              -- Log all statements
ALTER SYSTEM SET log_duration = on;                  -- Include duration
SELECT pg_reload_conf();                             -- Reload without restart
```

**Log Location (Railway):**
```bash
# View PostgreSQL logs via Railway dashboard
# Or via Railway CLI:
railway logs --service postgres
```

### Query Performance Baselines

| Endpoint | Baseline | Alert Threshold | Action |
|----------|----------|---|--------|
| `/api/turn` | <200ms | >1000ms | Check query plans, add indexes |
| `/api/expedition` | <100ms | >500ms | Check expedition query volume |
| `/api/rankings` | <50ms | >200ms | Check cache, analyze query |
| `/api/forum/*` | <100ms | >500ms | Index forum tables |
| `/api/market/*` | <100ms | >500ms | Check market price updates |

### Query Analysis (EXPLAIN PLAN)

For slow queries, analyze execution:

```sql
-- Example: Analyze slow expedition query
EXPLAIN ANALYZE
SELECT * FROM expeditions 
WHERE kingdom_id = $1 
AND status = 'active' 
ORDER BY created_at DESC 
LIMIT 20;

-- Look for:
-- - Sequential scans (should be index scans)
-- - High estimated rows vs actual rows (poor statistics)
-- - Nested loop joins (consider materialization)
```

### Indexes to Monitor

```javascript
// Critical indexes for game performance
const CRITICAL_INDEXES = [
  'idx_kingdoms_player_id',      // Player lookup
  'idx_expeditions_kingdom_id',  // Expedition filtering
  'idx_combat_log_attacker_id',  // Combat history
  'idx_kingdoms_active_turn',    // Turn-based queries
  'idx_market_prices_current',   // Market lookups
];

// Check index sizes monthly
SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## Connection Pool Monitoring

### Health Metrics

Monitor database connection pool in `index.js`:

```javascript
// Every 60 seconds, log pool stats if concerning
const poolStatsInterval = setInterval(() => {
  const available = pool.totalCount - pool.waitingCount;
  const utilizationPercent = ((pool.totalCount - available) / pool.max) * 100;
  
  if (pool.waitingCount > 0) {
    console.warn(`[ALERT] Waiting connections: ${pool.waitingCount}`);
    Sentry.captureMessage('Connection pool saturation', 'warning', {
      available,
      waiting: pool.waitingCount,
      utilization: utilizationPercent
    });
  }
  
  if (available < pool.max * 0.2) {
    console.error(`[CRITICAL] Low available connections: ${available}/${pool.max}`);
    Sentry.captureMessage('Connection pool low', 'error', {
      available,
      utilization: utilizationPercent
    });
  }
}, 60000);
```

### Alert Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Available connections | < 2 | Critical - increase pool or block IPs |
| Waiting requests | > 5 | High - check for slow queries |
| Pool utilization | > 80% | Medium - monitor, prepare scale-up |

---

## Response Time Monitoring

### Server Metrics

Track response times by endpoint:

```javascript
// Middleware to track response times
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const endpoint = req.path.split('?')[0];
    
    // Log slow responses
    if (duration > 1000) {
      console.warn(`[SLOW] ${req.method} ${endpoint} - ${duration}ms`);
      Sentry.captureMessage(`Slow endpoint: ${endpoint}`, 'warning', {
        method: req.method,
        endpoint,
        duration,
        status: res.statusCode
      });
    }
    
    // Prometheus/StatsD metric
    // metrics.histogram('http.response_time', duration, { endpoint, method: req.method });
  });
  next();
});
```

### Alert Thresholds by Endpoint

| Endpoint | P95 Target | P99 Target | Alert |
|----------|-----------|-----------|-------|
| `/api/turn` | 200ms | 500ms | > 1000ms |
| `/api/attack` | 200ms | 500ms | > 1000ms |
| `/api/rankings` | 100ms | 200ms | > 500ms |
| `/api/expedition` | 150ms | 300ms | > 750ms |
| `/api/forum/*` | 100ms | 300ms | > 500ms |

---

## Rate Limiting Monitoring

### Track Rate Limit Incidents

```javascript
// In makeRateLimiter function
if (timestamps.length > maxRequests) {
  // Log rate limit event
  console.warn(`[RATE_LIMIT] IP: ${key}, Endpoint: ${req.path}, Limit: ${maxRequests}/min`);
  
  // Send to monitoring
  Sentry.captureMessage('Rate limit exceeded', 'info', {
    ip: key,
    endpoint: req.path,
    limit: maxRequests,
    window: windowMs
  });
  
  return res.status(429).json({ error: 'Too many requests — slow down' });
}
```

### Alert Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| 429 responses > 5% of traffic | Alert | Investigate attack pattern |
| 429 responses sustained > 1 hour | Critical | Activate DDoS mitigation |
| Single IP > 100 429s/min | Block | Auto-block or manual review |

---

## Log Aggregation Strategy

### Local Logging

**Server Logs:**
```
logs/
├── server.log           # Application logs (startup, errors, warnings)
├── rate-limits.log      # Rate limiting incidents (production only)
└── slow-queries.log     # PostgreSQL slow query log (symlink)
```

**Log Rotation:**
```bash
# Keep 7 days of logs, rotate daily
/home/narmir/logs/*.log {
  daily
  rotate 7
  compress
  delaycompress
  missingok
  notifempty
}
```

### Cloud Log Aggregation (Railway)

**Using Railway Built-in Logs:**
```bash
# View application logs
railway logs --service api

# View PostgreSQL logs
railway logs --service postgres

# Stream logs in real-time
railway logs --follow
```

**Alternative: CloudWatch / Datadog**
```bash
# Option 1: CloudWatch (AWS)
# Configure Railway environment to send logs to CloudWatch

# Option 2: Datadog
# Install Datadog agent, configure log forwarding
```

### Log Format Standardization

**JSON Logging for Parsing:**
```javascript
// Structure all logs as JSON for aggregation tools
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'error',
  service: 'api',
  endpoint: '/api/turn',
  duration_ms: 1500,
  status: 500,
  error: 'Database connection timeout',
  kingdom_id: 12345,
  trace_id: 'abc123def456'
}));
```

---

## Alert Thresholds Reference

### Application-Level Alerts

```javascript
const ALERT_THRESHOLDS = {
  // Error rates
  error_rate_percent: 1,        // Alert if >1% requests return 5xx
  http_429_percent: 5,          // Alert if >5% requests rate-limited
  
  // Response times
  p95_response_time_ms: 500,    // Alert if P95 > 500ms
  p99_response_time_ms: 1000,   // Alert if P99 > 1000ms
  slow_endpoint_ms: 1000,       // Alert if any endpoint > 1000ms
  
  // Database
  db_pool_available: 2,         // Alert if < 2 connections available
  db_waiting_requests: 5,       // Alert if > 5 requests waiting
  slow_query_ms: 1000,          // Alert if query > 1 second
  
  // System
  memory_usage_percent: 80,     // Alert if memory > 80%
  cpu_usage_percent: 80,        // Alert if CPU > 80%
  disk_usage_percent: 85,       // Alert if disk > 85%
  
  // Uptime
  downtime_seconds: 0,          // Alert on any unplanned downtime
};
```

### Critical Endpoints to Monitor

```javascript
const CRITICAL_ENDPOINTS = [
  '/api/turn',           // Game progression
  '/api/attack',         // PvP actions
  '/api/expedition',     // Exploration
  '/api/kingdom/build',  // Building placement
  '/api/rankings',       // Public data (high volume)
  '/api/auth/me',        // Authentication (high volume)
];
```

---

## Dashboard Setup

### Recommended Metrics Dashboard

**Display:**
- Request volume (req/sec)
- Error rate (% of 5xx)
- P95/P99 response times
- Rate limit incidents (429s)
- Database pool utilization
- Slow query count (per endpoint)

**Update Interval:** Real-time (or 5-second buckets)

**Tools:**
- Sentry dashboard (errors, performance)
- Railway dashboard (logs, metrics)
- Grafana + Prometheus (if self-hosted)

---

## Production Deployment Checklist

Before going to production:

- [ ] Sentry DSN configured in Railway environment
- [ ] PostgreSQL slow query logging enabled
- [ ] Log rotation configured (7-day retention)
- [ ] Alert thresholds defined in monitoring tool
- [ ] Critical endpoints identified and monitored
- [ ] On-call rotation established
- [ ] Runbook created for common alerts
- [ ] Team trained on alert procedures

---

## Testing Monitoring

### Smoke Test Monitoring Setup

```bash
# 1. Trigger an error and verify Sentry captures it
curl -X POST http://localhost:3000/api/admin/trigger-error \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 2. Check Sentry dashboard — error should appear within 10 seconds

# 3. Trigger slow query and verify detection
# (Insert slow query via database)

# 4. Check slow query logs
tail -f logs/slow-queries.log

# 5. Verify rate limiting alerts
for i in {1..1000}; do curl -s http://localhost:3000/api/rankings > /dev/null; done
# Check logs for rate limit alerts
```

---

## Runbook: Common Alerts & Responses

### Alert: Error Rate > 1%

**Symptoms:** Sentry showing spike in errors, user reports of failures

**Investigation:**
1. Check Sentry for error type and stack trace
2. Check application logs for correlation
3. Check database logs for slow queries or connection errors
4. Check rate limiting logs for DDoS pattern

**Response:**
1. **High error rate:** Consider emergency restart or rollback
2. **Database issue:** Check connection pool, run VACUUM, add indexes if needed
3. **DDoS attack:** Block IPs via admin panel or WAF

---

### Alert: Response Time P99 > 1000ms

**Symptoms:** Dashboard shows spike in response times

**Investigation:**
1. Identify which endpoint is slow (check logs)
2. Run `EXPLAIN ANALYZE` on slow query
3. Check database load and connection pool

**Response:**
1. **Slow query:** Optimize query or add index
2. **Connection pool saturation:** Increase `DATABASE_MAX_POOL`
3. **High load:** Enable caching, consider scaling

---

### Alert: Connection Pool Low (< 2 available)

**Symptoms:** "connection pool exhausted" errors, new requests timing out

**Investigation:**
1. Check for long-running queries: `SELECT * FROM pg_stat_activity WHERE state != 'idle'`
2. Check connection pool stats in application logs
3. Identify which queries are holding connections

**Response:**
1. **Kill long-running query:** `SELECT pg_terminate_backend(pid) FROM ...`
2. **Increase pool:** `DATABASE_MAX_POOL=50` (if Railway plan supports)
3. **Optimize queries:** Reduce query execution time

---

## References

- Sentry Documentation: https://docs.sentry.io/
- PostgreSQL Logging: https://www.postgresql.org/docs/12/runtime-config-logging.html
- Railway Logs: https://docs.railway.app/reference/logs
- Response Time Goals: https://www.nngroup.com/articles/response-times-3-important-limits/

---

**Maintained by:** Claude Code  
**Session:** https://claude.ai/code/session_011GvnfKpUY6sK4vDK9YoSrw  
**Next Review:** Post-beta launch (refine thresholds based on real data)

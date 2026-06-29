# Monitoring and Alerting Guide

Comprehensive guide for monitoring Narmir Reborn health and setting up alerts in production.

## Overview

Production monitoring ensures early detection of issues before they impact users. This guide covers:
- Key metrics to monitor
- Setting up alerts with Railway
- Logging and log analysis
- Performance dashboards
- Incident response procedures

**Goals:**
- Detect failures within seconds
- Alert relevant teams immediately
- Enable rapid diagnosis and recovery
- Maintain visibility into system health

## Key Metrics to Monitor

### Server Health

| Metric | Normal Range | Warning | Critical |
|--------|--------------|---------|----------|
| CPU Usage | 20-40% | >60% | >80% |
| Memory Usage | 30-50% | >70% | >85% |
| Disk Usage | <50% | >80% | >95% |
| Open Connections | <1000 | >3000 | >5000 |
| Response Time (p95) | <200ms | >500ms | >1000ms |
| Error Rate | <1% | >5% | >10% |
| Database Connections | <10 | >20 | >30 |

### Application Metrics

| Metric | Collection | Alert Threshold |
|--------|-----------|-----------------|
| HTTP 5xx Errors | Per endpoint | >5 errors/min |
| Rate Limit Hits (429) | Per IP | >100 errors/min = possible attack |
| Database Query Time | Per query | >1000ms = performance issue |
| Auth Failures | Per endpoint | >10/min = brute-force attempt |
| Deployment Errors | Per deploy | >0 = rollback needed |

### Custom Metrics (To Implement)

- Active player count
- Turn processing time
- Battle simulation time
- Combat validation errors
- Orphaned transaction cleanup count

## Railway Built-In Monitoring

### 1. Railway Logs

**Access:** Railway Dashboard → Your Service → Logs

**What's logged:**
- Server startup/shutdown
- Database connections
- Errors and exceptions
- Rate limiting hits
- Failed auth attempts

**Log Format:**
```
[timestamp] [tag] Message
[2026-06-29 06:55:00] [boot] Server listening on http://localhost:3000
[2026-06-29 06:55:05] [db] ✅ PostgreSQL connected successfully
[2026-06-29 06:56:00] [rate-limit] IP 203.0.113.42 hit auth limit (11/10 requests)
[2026-06-29 06:56:15] [error] Database query timeout on /api/kingdom/troops
```

**Searching logs:**
```
# Error logs
[error]

# Database issues
[db] ERROR

# Rate limiting
[rate-limit]

# Authentication issues
[auth]

# Specific IP abuse
IP 203.0.113.42
```

### 2. Railway Metrics Dashboard

**Access:** Railway Dashboard → Your Service → Metrics

**Available Metrics:**
- CPU usage (%)
- Memory usage (MB)
- Network I/O (bytes/sec)
- HTTP requests/sec
- HTTP error rates

**Interpreting Metrics:**
- **CPU spikes:** High load, check logs for errors
- **Memory climb:** Possible memory leak, check application logs
- **Network drops:** Temporary connectivity issues, check database

## Setting Up Alerts

### Option A: Email Alerts (Railway)

1. Go to Railway Dashboard
2. Click Settings → Notifications
3. Enable email alerts
4. Set thresholds for:
   - Memory > 80%
   - CPU > 80%
   - Service crashed (auto-detected)

### Option B: Discord Alerts (Recommended)

**Step 1: Create Discord Webhook**
1. Go to your Discord server
2. Channel Settings → Integrations → Webhooks
3. Create New Webhook
4. Copy the webhook URL

**Step 2: Configure in Application**

The application already has Discord integration for bug reports and updates. Extend it for monitoring:

```javascript
// In index.js (add to monitoring section)
const DISCORD_ALERTS_WEBHOOK = process.env.DISCORD_ALERTS_WEBHOOK;

async function alertDiscord(title, message, severity = 'info') {
  if (!DISCORD_ALERTS_WEBHOOK) return;
  
  const color = severity === 'critical' ? 0xff0000 : severity === 'warning' ? 0xffaa00 : 0x00aa00;
  
  await fetch(DISCORD_ALERTS_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: title,
        description: message,
        color: color,
        timestamp: new Date().toISOString()
      }]
    })
  });
}
```

**Step 3: Add Environment Variable**

In Railway Web service → Environment:
```
DISCORD_ALERTS_WEBHOOK=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

### Option C: Uptime Monitoring (External Service)

Use a free uptime monitor like UptimeRobot or Pingdom:

1. Sign up for free tier account
2. Add monitor for: `https://narmirreborn.com/api/auth/me`
3. Set interval: Every 5 minutes
4. Set alert: After 2 failed checks
5. Configure notifications: Email + Discord webhook

## Key Alerts to Set Up

### Critical Alerts (Page Immediately)

1. **Service Down**
   - Trigger: HTTP 503 for 5 consecutive checks
   - Action: Check logs, verify database, restart if needed
   - Escalation: Contact DevOps/Platform team

2. **Database Connection Failed**
   - Trigger: `[db] ERROR` in logs
   - Action: Check PostgreSQL service status, verify DATABASE_URL
   - Escalation: Contact Railway support if persists

3. **Out of Memory**
   - Trigger: Memory > 90% for > 2 minutes
   - Action: Check for memory leaks, consider scaling
   - Escalation: Restart service (unsafe, data loss risk)

4. **High Error Rate**
   - Trigger: HTTP 5xx > 10% of requests
   - Action: Check error logs, identify failing endpoint
   - Escalation: Rollback if recent deployment, debug issue

### Warning Alerts (Check within 1 hour)

1. **Slow Responses**
   - Trigger: p95 response time > 500ms
   - Action: Check database query performance, CPU usage
   - Investigation: Profile hot endpoints

2. **High Rate Limiting**
   - Trigger: > 100 rate limit hits/min from single IP
   - Action: Check if legitimate traffic or attack
   - Investigation: Analyze IP patterns, consider blocking

3. **Database Slow Queries**
   - Trigger: Any query > 1000ms
   - Action: Check query plans, add indexes if needed
   - Investigation: Use pg_stat_statements

4. **Disk Space Low**
   - Trigger: Database disk > 80% used
   - Action: Check for large tables, plan cleanup
   - Investigation: Query table sizes, identify bloat

### Informational Alerts (Log & Review)

- Daily summary of statistics
- Deployment events
- Database backups completed
- Significant traffic changes

## Logging Best Practices

### What to Log

```javascript
// In application code

// ✅ Good: Actionable information
logger.info('User login attempt', { userId: 123, ip: req.ip, success: true });
logger.error('Database query timeout', { query: 'SELECT ...', duration: 5000 });

// ❌ Bad: Too verbose or not helpful
logger.debug('loop iteration 5431');
logger.info('Processing request');
```

### Log Severity Levels

```javascript
logger.debug('Detailed debugging info');      // Development only
logger.info('Important application events');   // Always log
logger.warn('Recoverable issues');             // Alert if critical
logger.error('Application failures');          // Always alert
logger.fatal('System failures');               // Immediate page
```

### Structured Logging

Use JSON format for logs:
```javascript
logger.info({
  event: 'login',
  userId: 123,
  ip: '203.0.113.42',
  result: 'success',
  duration: 250
});
```

This enables:
- Easy searching and filtering
- Metrics extraction
- Integration with log aggregation services

## Log Analysis

### Finding Issues in Logs

**Search for errors:**
```
[error]
```

**Search by endpoint:**
```
/api/kingdom/troops
```

**Search by user/IP:**
```
userId: 123
IP: 203.0.113.42
```

**Search by time:**
```
After: 2026-06-29T10:00:00Z
Before: 2026-06-29T11:00:00Z
```

### Common Issues & Their Patterns

**Memory Leak:**
```
Memory usage climbing steadily
Garbage collection pauses increasing
No corresponding traffic increase
```

**Database Overload:**
```
[error] Database query timeout
Multiple queries on same table
Connection pool exhausted
```

**Rate Limiting Attack:**
```
[rate-limit] High volume from same IP
All hitting /api/auth endpoints
Sharp spike in traffic
```

**Deployment Issue:**
```
[error] Application crashed
Timestamp matches recent deploy
Check deploy notes for changes
```

## Performance Dashboards

### Railway Metrics Dashboard

**What to check daily:**
1. CPU average (should be stable)
2. Memory trend (watch for creep)
3. Network traffic (compare to baseline)
4. HTTP error rate (should be < 1%)

**Red flags:**
- CPU spiking above 70%
- Memory not recovering after traffic drop
- Error rate increasing
- Sudden traffic drop (service might be down)

### PostgreSQL Monitoring

**Check database health:**
```sql
-- Connection count
SELECT count(*) FROM pg_stat_activity;

-- Slow queries
SELECT query, mean_time FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

-- Table sizes
SELECT schemaname, tablename, 
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables WHERE schemaname='public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan 
FROM pg_stat_user_indexes 
WHERE idx_scan = 0;  -- Unused indexes
```

## Incident Response

### When an Alert Fires

1. **Acknowledge the alert** (if using Slack/Discord)
2. **Check the dashboard** (CPU, memory, error rate)
3. **Read the logs** (find the root cause)
4. **Assess impact** (how many users affected?)
5. **Take action** (fix, rollback, or scale)
6. **Document** (what happened, what was done)

### Recovery Procedures

**Application Crashed:**
```bash
# Check logs for crash reason
# If memory: Reduce concurrent connections or check for leaks
# If error: Rollback recent deployment
# Restart: Railway redeploys automatically
```

**Database Unresponsive:**
```bash
# Check Railway PostgreSQL service logs
# Verify connection count (might be exhausted)
# Restart database (last resort - 30-60 second outage)
```

**Rate Limiting Attack:**
```bash
# Identify attacking IP from logs
# Consider IP blocklist if available
# Escalate to hosting provider if persistent
# Monitor for other attacks
```

**Memory Leak Suspected:**
```bash
# Enable --inspect for heap dumps
# Take heap snapshot at different times
# Compare snapshots to identify leaking objects
# Fix the retention issue
```

## Implementation Checklist

Before going to production, ensure:

### Monitoring
- [ ] Railway metrics dashboard is accessible
- [ ] CPU/Memory alerts configured
- [ ] Error rate alerts set up
- [ ] Service uptime monitor configured
- [ ] Logs are being collected and searchable
- [ ] Database performance monitoring enabled

### Alerting
- [ ] Alert notification method configured (Discord/email)
- [ ] Critical alerts configured (service down, errors)
- [ ] Warning alerts configured (slow responses, high rate limits)
- [ ] Escalation contacts documented
- [ ] On-call rotation established
- [ ] Alert channels tested (send test alerts)

### Logging
- [ ] Application logs structured (JSON format)
- [ ] Error severity levels configured
- [ ] Sensitive data not logged (passwords, tokens)
- [ ] Log retention policy set (>30 days)
- [ ] Log rotation configured
- [ ] High-traffic endpoints logged at INFO level

### Dashboards
- [ ] PostgreSQL health dashboard created
- [ ] Application performance dashboard created
- [ ] Traffic/load dashboard created
- [ ] Error dashboard created
- [ ] Custom metrics dashboard created

### Documentation
- [ ] Runbook created for common issues
- [ ] On-call guide updated
- [ ] Escalation procedures documented
- [ ] Recovery procedures documented
- [ ] Team trained on alert response

## Further Reading

- [Railway Monitoring Docs](https://docs.railway.app/guides/monitoring)
- [Node.js Profiling](https://nodejs.org/en/docs/guides/simple-profiling/)
- [PostgreSQL Query Optimization](https://www.postgresql.org/docs/current/sql-analyze.html)
- [Uptime Monitoring Best Practices](https://www.datadoghq.com/blog/monitoring-uptime/)
- [Incident Response Guide](https://www.atlassian.com/incident-management/incident-response)

## Quick Reference: Alert Thresholds

```
Critical (Page immediately):
- Service down (HTTP 503)
- Database connection failed
- Error rate > 10%
- Memory > 90%
- CPU > 80% for > 5 minutes

Warning (Check within 1 hour):
- Response time p95 > 500ms
- Rate limit hits > 100/min
- Database slow queries (> 1s)
- Disk space > 80%
- Memory creeping upward

Info (Review in daily standup):
- Deployments (successful and failed)
- Database backups (completed)
- Traffic patterns (hourly summary)
- Error trends (compare to previous day)
```

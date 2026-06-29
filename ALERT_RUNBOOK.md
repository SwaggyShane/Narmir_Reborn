# Alert Response Runbook

**Purpose:** Quick reference for on-call engineers responding to production alerts  
**Last Updated:** 2026-06-29  
**Escalation:** Page engineer if SLA will be breached  

---

## Alert: High Error Rate (> 1% of requests returning 5xx)

**Severity:** 🔴 CRITICAL  
**SLA:** 5 minutes  

### Symptoms
- Sentry showing error spike
- Users reporting "server error" messages
- Error logs filling up

### Investigation (2 minutes)

```bash
# 1. Check Sentry dashboard
# - Identify error type (ConnectionError, TimeoutError, etc.)
# - Check which endpoint is affected
# - Look for stack trace pattern

# 2. Check application logs
tail -f logs/server.log | grep ERROR

# 3. Check database status
# Connect to production database:
psql $DATABASE_URL -c "SELECT datname, numbackends FROM pg_stat_database WHERE datname='narmir';"

# 4. Check if deployed recently
git log --oneline origin/main | head -5
```

### Root Cause Check

| Error Type | Check | Action |
|-----------|-------|--------|
| **PostgreSQL Connection Error** | `SELECT version()` from psql | Restart Railway Postgres or page DBA |
| **Timeout** | `SELECT count(*) FROM pg_stat_activity;` | Kill slow queries, increase timeout |
| **Memory Error** | Check Node process memory | Restart application |
| **Unknown** | Check deployment logs | Rollback if recent deploy |

### Response

**If database issue:**
```bash
# Kill long-running queries
psql $DATABASE_URL -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE state = 'active' 
  AND now() - query_start > interval '30 seconds';
"
```

**If application issue:**
```bash
# Restart application via Railway dashboard
# Or: railway redeploy
```

**If recent deploy caused issue:**
```bash
# Rollback to previous version via Railway dashboard
# Or contact deployment manager
```

### Escalation

- If not resolved in 5 minutes → Page on-call engineer
- If still unresolved in 15 minutes → Page manager

---

## Alert: High Response Time (P99 > 1000ms)

**Severity:** 🟠 HIGH  
**SLA:** 15 minutes  

### Symptoms
- Dashboard showing response time spike
- Users report slow interface
- Load test reports increased latency

### Investigation (5 minutes)

```bash
# 1. Identify slow endpoint
tail -f logs/server.log | grep "SLOW\|duration"

# 2. Check database load
psql $DATABASE_URL -c "
  SELECT query, calls, total_time, mean_time 
  FROM pg_stat_statements 
  ORDER BY mean_time DESC 
  LIMIT 10;
"

# 3. Check connection pool status
# Look for: waiting connections, available < 2

# 4. Check recent queries
psql $DATABASE_URL -c "
  SELECT pid, usename, query, query_start 
  FROM pg_stat_activity 
  WHERE state != 'idle' 
  ORDER BY query_start;
"
```

### Root Cause Analysis

| Cause | Evidence | Fix |
|-------|----------|-----|
| **Slow query** | EXPLAIN ANALYZE shows sequential scan | Add index or optimize query |
| **Full table scan** | High rows returned, few estimated | Rebuild statistics: ANALYZE table_name |
| **Connection pool low** | waiting_count > 0, available < 2 | Kill long queries or increase pool |
| **Network latency** | All queries slow equally | Check Railway network, restart if needed |

### Response

**Optimize slow query:**
```sql
-- Get query plan
EXPLAIN ANALYZE <slow_query>

-- Add missing index
CREATE INDEX idx_kingdoms_player_id ON kingdoms(player_id);
```

**Increase connection pool:**
```bash
# Set environment variable in Railway
DATABASE_MAX_POOL=30  # Increase from default 20
```

**Kill stuck query:**
```bash
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = <pid>;"
```

---

## Alert: Rate Limiting Active (> 5% of requests 429)

**Severity:** 🟡 MEDIUM  
**SLA:** 1 hour  

### Symptoms
- Users getting "Too many requests" errors
- Sentry showing 429 spike
- Load test or attack in progress

### Investigation (5 minutes)

```bash
# 1. Check rate limit log (production only)
tail -f logs/rate-limits.log | tail -100

# 2. Analyze IP patterns
grep "RATE_LIMIT" logs/rate-limits.log | cut -d' ' -f3 | sort | uniq -c | sort -rn | head -20

# 3. Check if legitimate spike (new feature launch, etc.)
# Or check if under attack (rapid repeated requests from few IPs)
```

### Response

**If legitimate traffic spike:**
- Monitor and let rate limiting protect server
- Increase limits if needed: `RATE_LIMIT_TURN_MAX=400`
- Consider caching if it's read-heavy endpoint

**If DDoS attack:**
```bash
# 1. Identify attacker IPs
grep "RATE_LIMIT" logs/rate-limits.log | awk '{print $NF}' | sort | uniq -c | sort -rn | head -5

# 2. Block via admin panel or WAF (if available)
# Or use Railway's DDoS protection (if enabled)

# 3. Monitor attack in progress
watch -n 1 'grep "RATE_LIMIT" logs/rate-limits.log | tail -20'

# 4. Once mitigated, analyze logs for pattern
```

---

## Alert: Connection Pool Saturation (Available < 2)

**Severity:** 🔴 CRITICAL  
**SLA:** 5 minutes  

### Symptoms
- "too many clients already" errors
- New requests timeout
- Response times spike to 5000ms+

### Investigation (2 minutes)

```bash
# 1. Get connection status
psql $DATABASE_URL -c "
  SELECT 
    count(*) as total,
    count(*) FILTER (WHERE state = 'active') as active,
    count(*) FILTER (WHERE state = 'idle') as idle,
    max(now() - backend_start) as oldest_connection
  FROM pg_stat_activity;
"

# 2. Identify idle connections (leak)
psql $DATABASE_URL -c "
  SELECT pid, usename, application_name, state, 
         now() - query_start as idle_duration
  FROM pg_stat_activity 
  WHERE state = 'idle' 
  ORDER BY query_start DESC;
"

# 3. Check if high load is expected
# (e.g., during peak hours, load test, etc.)
```

### Response

**Immediate (1-2 minutes):**
```bash
# Kill idle connections from aborted clients
psql $DATABASE_URL -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE state = 'idle in transaction' 
  AND now() - query_start > interval '5 minutes';
"
```

**Short-term (5-15 minutes):**
```bash
# Increase pool size in Railway
DATABASE_MAX_POOL=40  # Up from default 20
# Restart application to apply
```

**Investigate connection leak:**
```bash
# Check application code for connections not being released
# Look for: query timeouts, unhandled errors, transaction hangs
```

---

## Alert: Slow Query Detected (> 1 second)

**Severity:** 🟡 MEDIUM  
**SLA:** 1 hour  

### Response

**Quick fix:**
```sql
-- Analyze table statistics
ANALYZE <table_name>;

-- Check index usage
SELECT indexname, idx_scan 
FROM pg_stat_user_indexes 
WHERE idx_scan = 0 
ORDER BY idx_blks_read DESC;

-- Add missing index
CREATE INDEX idx_<table>_<column> ON <table>(<column>);
```

**Example: Slow expedition query**
```sql
-- Before
EXPLAIN ANALYZE SELECT * FROM expeditions WHERE kingdom_id = 123;
-- Seq Scan on expeditions (rows=1000) → SLOW!

-- After creating index
CREATE INDEX idx_expeditions_kingdom_id ON expeditions(kingdom_id);
EXPLAIN ANALYZE SELECT * FROM expeditions WHERE kingdom_id = 123;
-- Index Scan on idx_expeditions_kingdom_id (rows=20) → FAST!
```

---

## Alert: Memory Usage High (> 80%)

**Severity:** 🟠 HIGH  
**SLA:** 15 minutes  

### Symptoms
- Node.js process using >1GB RAM
- System becoming sluggish
- OOM killer might terminate process

### Investigation

```bash
# Check Node process memory
ps aux | grep node | grep -v grep

# Get heap dump (if available)
# or check for memory leaks in code
```

### Response

**Immediate:**
```bash
# Restart application (Railway)
railway redeploy
```

**Investigation:**
- Check for unclosed database connections
- Look for unbounded arrays/caches in memory
- Review recent code changes

---

## Alert: Disk Usage High (> 85%)

**Severity:** 🟠 HIGH  
**SLA:** 15 minutes  

### Likely Cause
- PostgreSQL WAL (write-ahead log) files accumulating
- Large log files not rotating

### Response

```bash
# Check disk usage
df -h /

# Check PostgreSQL data directory
du -sh /var/lib/postgresql/*

# Force WAL cleanup (if safe)
psql $DATABASE_URL -c "CHECKPOINT;"

# Rotate logs
logrotate -f /etc/logrotate.conf
```

---

## Escalation Procedures

### Page Engineer (Severity: CRITICAL)

**When:** Error rate > 5% AND unresolved for 5 minutes
- Page on-call engineer with alert summary
- Include: error type, affected endpoint, investigation results

**Message Template:**
```
🚨 PRODUCTION ALERT: High Error Rate

Endpoint: /api/turn
Error: PostgreSQL connection timeout
Requests affected: 5,000+ 
Duration: 5 minutes

Investigation: Database connection pool exhausted
Action taken: Killed idle connections, awaiting response

Please respond within 5 minutes
```

### Notify Manager (Severity: HIGH)

**When:** Incident ongoing for 15 minutes
- Send update to engineering manager
- Include: ETA for resolution, impact assessment

### Post-Incident

**After resolution:**
1. Create incident report with root cause
2. Document fix applied
3. File improvement task (if needed)
4. Update runbook with new findings

---

## Quick Reference Cards

### Critical Endpoints Health Check

```bash
#!/bin/bash
for endpoint in \
  "/api/turn" \
  "/api/attack" \
  "/api/rankings" \
  "/api/expedition" \
  "/api/auth/me"
do
  response=$(curl -s -w "%{http_code}" "http://localhost:3000$endpoint")
  status=${response: -3}
  echo "$endpoint: HTTP $status"
done
```

### Database Quick Health Check

```sql
-- All-in-one database health check
SELECT 
  'Database' as check,
  CASE WHEN pg_is_in_recovery() THEN 'Replica' ELSE 'Primary' END as role,
  pg_postmaster_uptime() as uptime,
  (SELECT count(*) FROM pg_stat_activity) as connections,
  (SELECT max(now() - pg_postmaster_start_time())) as server_uptime
UNION ALL
SELECT 
  'Table Sizes',
  '', 
  null, 
  (SELECT sum(pg_total_relation_size(schemaname||'.'||tablename))::text FROM pg_tables WHERE schemaname='public'),
  null
UNION ALL
SELECT 
  'Index Health',
  '', 
  null, 
  (SELECT count(*) FROM pg_stat_user_indexes WHERE idx_scan = 0)::text || ' unused',
  null;
```

---

**On-Call Contact:** See engineering team Slack channel  
**Incident Log:** See #production-incidents channel  
**Escalation:** Contact engineering manager (list in team wiki)

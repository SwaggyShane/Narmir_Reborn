# Support Runbook

Quick reference guide for responding to production issues in Narmir Reborn.

## Immediate Response (First 5 Minutes)

### 1. Acknowledge the Issue
- Check Slack/Discord for reported problems
- Note the affected users/systems
- Start monitoring logs and metrics
- Set status: "Investigating" if using status page

### 2. Assess Impact
- How many users affected?
- Is the core game playable?
- Are payments affected?
- Is data at risk?

**Severity Levels:**
- **Critical (Red):** Complete outage, data loss risk, payments down
- **High (Orange):** Major features broken, significant user impact
- **Medium (Yellow):** Some features broken, minor user impact
- **Low (Green):** Non-critical features affected

### 3. Check System Status
```bash
# SSH into Railway web service
# Check CPU, memory, disk
ps aux | grep node
df -h

# Check database
# Via Railway dashboard → PostgreSQL → Logs
# Look for connection errors, query timeouts

# Check application logs
# Railway dashboard → Web service → Logs
# Search for [error], [CRITICAL], EXCEPTION
```

---

## Common Issues & Quick Fixes

### Issue: Service Returns HTTP 503 (Service Unavailable)

**Diagnosis:**
1. Check Railway dashboard for crash notifications
2. Check logs for startup errors
3. Verify DATABASE_URL is valid
4. Check memory usage (if >95%, OOM likely)

**Quick Fix:**
```bash
# If application crashed:
# Railway auto-restarts every few minutes
# Monitor logs to confirm startup completed successfully

# If database connection issue:
# 1. Verify DATABASE_URL in Railway environment
# 2. Check PostgreSQL service status on Railway
# 3. Restart PostgreSQL (last resort, causes brief outage)

# If memory exhausted:
# 1. Check for memory leaks in logs
# 2. Identify memory-consuming operation (query, cache growth)
# 3. Scale up instance (increase RAM)
```

**Expected Resolution Time:** 2-10 minutes (auto-recovery) or 30+ minutes (scaling needed)

### Issue: High Latency (Response Times >1000ms)

**Diagnosis:**
```bash
# Check metrics dashboard
# Is CPU high (>70%)?
# Is memory high (>80%)?
# Is disk I/O high?

# Check logs for slow queries
# Look for: [error] Database query timeout

# Check rate limiter
# High 429 responses = under attack or rate limit too strict
```

**Quick Fix:**
1. **CPU high:** Check for specific slow endpoint in logs
2. **Memory high:** Consider scaling up or restarting to clear cache
3. **Database slow:** Check query performance with pgAdmin
4. **Rate limited:** Check if legitimate traffic or attack

**Expected Resolution Time:** 5-30 minutes

### Issue: Database Connection Failed

**Diagnosis:**
```bash
# Check Railway PostgreSQL service
# Dashboard → PostgreSQL → Logs
# Look for connection pool exhaustion or connection errors

# Check application logs
# Search for [db] ERROR
```

**Quick Fix:**
1. Check if PostgreSQL service is running
2. Verify DATABASE_URL is still valid (check logs for exact error)
3. Check connection pool size (defaults: 10 min, 30 max)
4. If persists, restart PostgreSQL (causes 30-60s outage)

**Expected Resolution Time:** 5-15 minutes

### Issue: Rate Limit Attack (Many 429 Responses)

**Diagnosis:**
```bash
# Check logs for [rate-limit] messages
# Identify attacking IPs
# Check if legitimate traffic or bot

# Examples of legitimate:
# - Mobile app retry loop (use exponential backoff)
# - Load test (schedule outside peak hours)

# Examples of attack:
# - Brute-force auth from multiple IPs
# - DDoS attempting to exhaust resources
```

**Quick Fix:**
1. **Legitimate:** Communicate with user/team about rate limits
2. **Attack:** Monitor the IP, consider blocklist (if available)
3. Verify rate limits are appropriate for expected load

**Expected Resolution Time:** 5-30 minutes (varies by root cause)

### Issue: Disk Space Running Low (>85%)

**Diagnosis:**
```bash
# Check Railway PostgreSQL disk usage
# Dashboard → PostgreSQL → Logs or support ticket

# Check what's using space
# Via pgAdmin: pg_stat_statements, table sizes
```

**Quick Fix:**
1. Check for large temporary tables
2. Consider archiving old data (expeditions, battles > 1 year)
3. Check for unused indexes
4. If urgent, scale up database instance

**Expected Resolution Time:** 1-3 hours (involves data cleanup)

### Issue: Users Report Losing Progress

**Diagnosis:**
1. Check if recent backup restore happened
2. Check application logs for transaction errors
3. Query database for user's last update timestamp
4. Check if user had orphaned transaction (long-running query)

**Quick Fix:**
1. **If recent restore:** Explain to users, apologize
2. **If transaction rollback:** Check application logs for error
3. **If long-running query killed:** Communicate timeout policy
4. Consider enabling point-in-time recovery

**Expected Resolution Time:** 30-60 minutes + communication

---

## Emergency Procedures

### Complete Service Outage (Everything Down)

**Timeline:** Respond within 2-5 minutes

1. **Acknowledge** in status page / Discord: "Investigating complete outage"
2. **Check Rails dashboard:**
   - Is web service running? (check for crash)
   - Is PostgreSQL running? (check connection)
   - Is disk space available?
3. **Restart service:**
   - If web crashed: Wait for auto-restart or trigger manual
   - If database down: Restart PostgreSQL (30-60s outage)
4. **Verify recovery:**
   - Can you connect to API?
   - Check application logs for startup errors
   - Run health check: `curl https://narmirreborn.com/api/auth/me`
5. **Communicate:**
   - Update status page: "Service recovered" with timeline
   - Post in Discord: Explain issue and recovery steps
   - Apologize for inconvenience

**Expected Resolution:** 5-30 minutes
**Action:** Post-incident: Review logs to prevent recurrence

### Data Corruption or Loss Detected

**Timeline:** Respond within 5 minutes

1. **Stop the spread:**
   - Set application to read-only (if possible)
   - Or shut down web service to prevent further corruption
2. **Assess damage:**
   - How much data is affected?
   - Is it recoverable from backup?
   - What's the blast radius?
3. **Restore from backup:**
   - Identify latest good backup before corruption
   - Restore to new database on Railway
   - Verify data looks correct
   - Update DATABASE_URL to point to restored database
4. **Communicate:**
   - Update status page: "Data recovery in progress"
   - Post in Discord: Explain issue, ETA for recovery
   - Be honest about data loss (if any)
5. **Post-incident:**
   - Investigate root cause of corruption
   - Review backup testing procedures
   - Consider point-in-time recovery for future

**Expected Resolution:** 30-120 minutes
**Action:** Full post-incident review required

### Suspected Security Breach

**Timeline:** Respond within 1-2 minutes

1. **Assess threat level:**
   - What was accessed? (user data, admin panel, payment info)
   - By whom? (specific IP, account compromised)
   - Is it ongoing?
2. **Immediate containment:**
   - If credentials leaked: Force password reset for affected users
   - If admin compromised: Rotate admin secrets immediately
   - If payments: Notify payment processor and affected users
3. **Investigate:**
   - Check application logs for suspicious activity
   - Review access logs for unauthorized access
   - Check for malicious code commits (if any)
4. **Communicate:**
   - Contact affected users if their data was exposed
   - File incident report (required by privacy laws)
   - Update status page with security incident notice
5. **Recovery:**
   - Rotate all secrets (JWT_SECRET, ADMIN_SECRET, etc.)
   - Audit user permissions and roles
   - Consider password reset for all users
   - Review and strengthen security measures

**Expected Resolution:** 2-24 hours
**Action:** Mandatory post-incident security review

---

## Escalation Procedures

### When to Escalate

**Escalate to Platform Team (Railway Support):**
- PostgreSQL service crashes or won't restart
- Out of disk space on database
- Network connectivity issues
- TLS certificate errors
- Platform-level incidents

**Escalate to Lead Developer:**
- Application logic error (queries returning wrong data)
- Memory leak suspected (memory constantly growing)
- Performance issue with unclear root cause
- Third-party integration failure (Discord, payments)

**Escalate to Executive Team:**
- Severe data loss or corruption
- Security breach confirmed
- Widespread user impact (>50% of users affected)
- Payment system failure or fraud

### Escalation Template

```
Priority: [Critical/High/Medium]
Issue: [Brief description]
Impact: [Number of users, features affected]
Status: [Current state]
Immediate Actions: [What we've done]
Next Steps: [What we're doing]
ETA: [Estimated time to resolution]
Owner: [Who's leading the response]
```

---

## Monitoring & Prevention

### Daily Monitoring Checklist

- [ ] Check error rate from previous 24 hours (should be <1%)
- [ ] Check response time trends (p95 should be <500ms)
- [ ] Review rate limit hits (should be <10/hour)
- [ ] Check database query performance (no queries >1000ms)
- [ ] Verify backups completed successfully (should be daily)
- [ ] Check disk space (should be <70% used)
- [ ] Monitor CPU/memory usage (should be stable)
- [ ] Review security audit results (if scheduled)

### Weekly Monitoring Checklist

- [ ] Run load test (validate 1000+ concurrent handles <500ms)
- [ ] Test backup restore procedure (ensure recovery works)
- [ ] Review rate limiting logs (identify suspicious patterns)
- [ ] Audit admin access (who accessed admin panel)
- [ ] Check for unused database indexes (clean up if found)
- [ ] Review error logs for patterns (do we need to fix anything?)
- [ ] Verify SSL/TLS certificate validity (not expiring soon)

### Monthly Procedures

- [ ] Full disaster recovery test (restore from backup to new DB)
- [ ] Security audit (run SQL injection scanner, check permissions)
- [ ] Performance profiling (identify hot endpoints)
- [ ] Database maintenance (VACUUM, ANALYZE)
- [ ] Review and update runbook based on incidents
- [ ] Capacity planning (project growth over next quarter)
- [ ] Test failover procedures (if redundancy implemented)

---

## Communication Templates

### Status Page Update: Investigating

```
⚠️ INVESTIGATING: Service Degradation

We're aware of users experiencing slow responses/errors starting at [TIME] UTC.
Our team is investigating the root cause.

Last Update: [TIME] UTC
```

### Status Page Update: Resolved

```
✅ RESOLVED: Service Restored

The issue has been resolved as of [TIME] UTC. 
All services are operating normally.

Root Cause: [Brief explanation]
Impact: [Number of users, duration]
Actions Taken: [What we did to fix and prevent recurrence]
```

### Discord Notification: Critical Issue

```
🚨 **CRITICAL: Service Outage**

Service is currently unavailable.
Status: Investigating
Owner: @[Name]
ETA: [Time]

[Updates will follow]
```

### Discord Notification: Resolved

```
✅ **RESOLVED: Service Restored**

The outage has been resolved. All services are online.

Duration: [X minutes]
Impact: [Brief description]
Root Cause: [One sentence explanation]

Thank you for your patience!
```

---

## Documentation Links

- [Monitoring & Alerting Guide](MONITORING_ALERTING.md) — Dashboard access, alert thresholds
- [Backup & Restore Guide](BACKUP_RESTORE.md) — Disaster recovery procedures
- [Railway Setup Guide](RAILWAY_SETUP.md) — Environment configuration
- [Load Testing Guide](LOAD_TESTING.md) — Performance validation
- [Security Audit Guide](../SECURITY_AUDIT.md) — Automated security checks
- [API Rate Limiting Guide](API_RATE_LIMITING.md) — Rate limit configuration

---

## Quick Reference: Key Contacts

**Internal:**
- Lead Developer: [Name] (@slack_handle)
- DevOps Engineer: [Name] (@slack_handle)
- Product Manager: [Name] (@slack_handle)

**External:**
- Railway Support: https://railway.app/support
- PostgreSQL Documentation: https://www.postgresql.org/docs/
- Node.js Documentation: https://nodejs.org/en/docs/

---

## Incident Post-Mortem Template

After any critical incident, complete this template:

**Incident:** [Title]
**Duration:** [Start time] - [End time] UTC ([X minutes])
**Impact:** [Number of users, services affected]

**Root Cause:** [What actually happened]

**Detection:** [How did we find out?]
**Response:** [Timeline of actions taken]
**Resolution:** [How was it fixed?]

**Lessons Learned:**
- [ ] What went well?
- [ ] What could be better?
- [ ] What process changes are needed?

**Action Items:**
- [ ] [Action 1] - Owner: [Name] - Deadline: [Date]
- [ ] [Action 2] - Owner: [Name] - Deadline: [Date]
- [ ] [Action 3] - Owner: [Name] - Deadline: [Date]

---

## Further Resources

- [Incident Response Best Practices](https://www.atlassian.com/incident-management/incident-response)
- [Chaos Engineering for Production Testing](https://principlesofchaos.org/)
- [PostgreSQL Troubleshooting Guide](https://www.postgresql.org/docs/current/runtime.html)
- [Node.js Performance Monitoring](https://nodejs.org/en/docs/guides/nodejs-performance-monitoring/)

# Production Configuration Verification

Verification checklist and procedures for confirming Narmir Reborn is ready for production deployment on Railway.

## Prerequisites

- Railway account access with `narmirreborn` project
- PostgreSQL admin credentials for production database
- Production API URL: `https://narmirreborn.com`
- Access to pgAdmin4 (Railway PostgreSQL admin tool)

---

## 1. Verify Production Database URL

### 1.1 Check Railway Environment Variables

**Via Railway Dashboard:**
1. Go to https://railway.app/
2. Select the **narmirreborn** project
3. Click **Web Service** → **Variables**
4. Confirm `DATABASE_URL` is set and uses production PostgreSQL connection string format:
   ```
   postgresql://[user]:[password]@[host]:[port]/[database]
   ```
5. Verify the host is NOT `localhost` (should be Railway PostgreSQL service hostname)

**Expected format:**
```
postgresql://postgres:*****@postgres-prod-******.railway.app:5432/railway
```

**Do NOT use:**
- `localhost` — only for local development
- `127.0.0.1` — only for local development
- Outdated credentials

### 1.2 Verify JWT_SECRET is Set

1. In Railway Variables, confirm `JWT_SECRET` is a strong random string (minimum 32 characters)
2. Confirm `ADMIN_SECRET` is set for admin panel access
3. Do NOT commit secrets to git — they must only exist in Railway environment

### 1.3 Test Database Connection

**From your local machine (after deployment):**

```bash
# Option 1: Test via API endpoint (requires server running)
curl -s https://narmirreborn.com/api/auth/me | jq .

# Expected response (unauthenticated):
# {"error":"Not authenticated"}

# Option 2: Direct psql test (if you have production credentials)
psql "postgresql://[user]:[password]@[host]:5432/railway" -c "SELECT version();"
```

**Expected:**
- API responds within 1000ms
- No "connection refused" or "timeout" errors
- Database version query returns PostgreSQL version

---

## 2. Verify Automated Backups

### 2.1 Check PostgreSQL Backup Configuration (Railway)

**Via Railway Dashboard:**
1. Go to **Databases** → **PostgreSQL**
2. Click the PostgreSQL service
3. Under **Settings**, verify:
   - ✅ **Backups Enabled** — should be ON
   - ✅ **Backup Frequency** — should be daily (minimum)
   - ✅ **Retention Period** — should be 30+ days minimum

**Screenshot location:** Railway Dashboard → PostgreSQL → Settings tab

### 2.2 Verify Recent Backups Exist

**Via Railway Dashboard:**
1. Go to **Databases** → **PostgreSQL**
2. Click **Backups** tab
3. Confirm at least one backup from today or yesterday exists
4. Check backup file size (should be >1MB for a populated database)

**Expected:**
- At least one backup per day
- Recent backup (within 24 hours)
- Backup size > 100KB (even empty database)

### 2.3 Verify Point-in-Time Recovery (PITR)

Railway PostgreSQL includes automatic PITR. Verify:
1. Go to PostgreSQL **Settings**
2. Look for **WAL Archiving** or **Replication** — should be enabled
3. PITR retention typically 7 days (check if adequate)

---

## 3. Test Database Restore Procedure

### 3.1 Schedule a Test Restore (Monthly Procedure)

**Create a temporary restore database:**
1. In Railway PostgreSQL **Backups** tab
2. Click the most recent backup
3. Select **Restore to new database**
4. Choose name: `narmir_test_restore_YYYY-MM-DD`
5. Wait 5-30 minutes for restore to complete

### 3.2 Verify Restored Data

Once restore completes:

```bash
# Connect to restored database
psql "postgresql://[user]:[password]@[host]:5432/narmir_test_restore_YYYY-MM-DD" << 'EOF'
-- Check row counts
SELECT 'kingdoms' as table_name, COUNT(*) FROM kingdoms
UNION ALL
SELECT 'players', COUNT(*) FROM players
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'forum_posts', COUNT(*) FROM forum_posts;

-- Check recent data
SELECT MAX(updated_at) as latest_update FROM kingdoms;
EOF
```

**Expected:**
- Row counts match production database
- Latest updates are recent (within hours, not days)
- No null or corrupted values

### 3.3 Clean Up Test Database

After verification:
1. In Railway PostgreSQL **Backups** tab or **Databases**
2. Delete the test restore database
3. Confirm deletion

---

## 4. Production Deployment Checklist

Before deploying to production:

- [ ] DATABASE_URL set in Railway (not localhost)
- [ ] JWT_SECRET set and strong (32+ characters)
- [ ] ADMIN_SECRET set for admin panel
- [ ] Backups enabled (daily or better)
- [ ] At least one recent backup exists
- [ ] Test restore completed successfully (monthly)
- [ ] API endpoint responds within 1000ms
- [ ] HTTPS enforced (TLS certificate valid)
- [ ] Rate limiting configured (see API_RATE_LIMITING.md)
- [ ] Monitoring and alerting set up (see MONITORING_ALERTING.md)
- [ ] Support runbook in place (see SUPPORT_RUNBOOK.md)

---

## 5. Troubleshooting Production Database Issues

### Connection Refused / Timeout

**Diagnosis:**
1. Check DATABASE_URL format in Railway Variables
2. Verify PostgreSQL service is running (Railway Dashboard → PostgreSQL → Logs)
3. Check for firewall/network issues
4. Verify credentials are correct

**Fix:**
```bash
# Restart PostgreSQL service (causes brief downtime)
# Via Railway Dashboard: PostgreSQL → Restart
```

### Database Disk Space Exhausted

**Diagnosis:**
```bash
# Via pgAdmin4 Query Tool:
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;

SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

**Fix:**
1. Archive old expeditions, battles, or messages
2. Run VACUUM and ANALYZE
3. Delete unused indexes
4. Scale up database instance (Railway → PostgreSQL → Change Plan)

### Backup Failed / Not Running

**Diagnosis:**
1. Check PostgreSQL logs for errors
2. Verify backup storage has space
3. Check if PostgreSQL is accepting connections

**Fix:**
1. Via Railway PostgreSQL Settings: Re-enable backups
2. Trigger manual backup if available
3. Contact Railway support if persistent

---

## 6. Ongoing Verification Schedule

### Daily
- [ ] Check API responds (curl https://narmirreborn.com/api/auth/me)
- [ ] Review error logs for database-related issues

### Weekly
- [ ] Verify latest backup exists and is within 7 days
- [ ] Check database disk usage is <85%
- [ ] Review slow query logs (see MONITORING_ALERTING.md)

### Monthly
- [ ] Test database restore to new instance
- [ ] Run full disaster recovery drill
- [ ] Update this verification document if issues found
- [ ] Review backup retention policy

---

## 7. Security Considerations

### DATABASE_URL Protection

- Never commit DATABASE_URL to git
- Never log or expose in error messages
- Rotate credentials if accidentally exposed
- Use Railway's environment variable management

### Backup Security

- Backups should be encrypted at rest
- Access to backups restricted to database admins only
- Test restore in isolated environment (not production)
- Document backup retention and deletion policy

### Production Access

- Use IAM/role-based access control for Railway
- Limit who can modify database configuration
- Audit logs enabled for schema changes
- SSH access to production database disabled

---

## 8. Escalation

If any verification step fails:

1. **Database Connection Issues** → Contact Railway Support
2. **Backup Not Running** → Check PostgreSQL logs, restart if needed
3. **Data Corruption** → Trigger restore to point before corruption detected
4. **Performance Issues** → Review MONITORING_ALERTING.md, consider scaling up

See SUPPORT_RUNBOOK.md for incident response procedures.

---

## References

- [Railway PostgreSQL Documentation](https://docs.railway.app/databases/postgresql)
- [PostgreSQL Backup Best Practices](https://www.postgresql.org/docs/current/backup.html)
- [BACKUP_RESTORE.md](BACKUP_RESTORE.md) — Detailed backup/restore procedures
- [SUPPORT_RUNBOOK.md](SUPPORT_RUNBOOK.md) — Incident response guide
- [MONITORING_ALERTING.md](MONITORING_ALERTING.md) — Monitoring setup

# Database Backup & Restore Workflow

Comprehensive guide for backing up and restoring Narmir Reborn PostgreSQL data.

## Overview

Production data requires multi-layered protection:
- **Automatic backups** via Railway (daily, retained 30 days)
- **Manual backups** for point-in-time recovery and testing
- **Restore verification** to ensure data integrity
- **Disaster recovery** procedures for critical failures

## Railway Automatic Backups

### Verification: Are Backups Enabled?

**Step 1: Check Railway Dashboard**
1. Log in to [railway.app](https://railway.app)
2. Navigate to your Narmir Reborn project
3. Click on the **PostgreSQL** service
4. Look for a **Backups** tab

**Step 2: Verify Backup Schedule**
- Expected: Daily automatic backups
- Retention: 30 days minimum
- Status: Should show "Automatic backups enabled"

**Step 3: Confirm Latest Backup**
```
Backup tab should show:
✅ Last backup: [Today's date] at [time] UTC
✅ Status: Completed
✅ Restore available: Yes
```

If backups are not enabled, enable them immediately in the Railway dashboard.

### Manual Restore from Railway Backup

**When to use:** Data corruption, accidental deletions, or point-in-time recovery

**Step 1: Access Railway Backups UI**
1. Go to your PostgreSQL service → **Backups** tab
2. Find the backup you want to restore (listed by timestamp)
3. Click **Restore** next to the backup

**Step 2: Select Restore Target**
- **Option A**: Restore to existing database (overwrites all data)
  - Recommended for disaster recovery only
  - Will disconnect all clients during restore
  - Takes 5-30 minutes depending on size
  
- **Option B**: Restore to new database
  - Recommended for testing restore verification
  - Keep old database until new one is verified
  - Requires updating `DATABASE_URL` to point to new database

**Step 3: Monitor Restore Progress**
- Railway shows restore status in real-time
- Look for: "Restore completed successfully"

**Step 4: Verify Restored Data**
```bash
# Test connectivity to restored database
curl https://narmirreborn.com/api/forum/boards
# Expected: List of forum boards with correct data

curl https://narmirreborn.com/api/auth/me
# Expected: Auth response (may be 401 if not authenticated)
```

**Step 5: (If Restore to New DB) Switch Database Connection**
```bash
# In Railway Web service → Environment variables
# Update DATABASE_URL to point to the new database
DATABASE_URL="postgresql://user:pass@new-host:5432/new-db-name"
```

## Manual Backups

### Creating a Manual Backup

**Why manually backup:**
- Before major code deployments
- Before database schema changes
- For compliance/audit trails
- For off-site backup redundancy

**Step 1: Get Database Connection String**
```bash
# From Railway Environment variables
echo $DATABASE_URL
# Format: postgresql://user:pass@host:5432/database
```

**Step 2: Create Backup File**
```bash
# On your local machine (requires PostgreSQL client tools)
pg_dump "postgresql://user:pass@host:5432/database" > narmir_backup_$(date +%Y%m%d_%H%M%S).sql

# Example with example credentials:
pg_dump "postgresql://postgres:mypassword@db.railway.internal:5432/railway" > narmir_backup_20260629_143022.sql
```

**Step 3: Verify Backup File**
```bash
# Check file size (should be non-trivial for production data)
ls -lh narmir_backup_*.sql

# Check it contains SQL commands
head -20 narmir_backup_*.sql | grep -E "CREATE|INSERT|ALTER"
# Expected: SQL DDL and DML statements
```

**Step 4: Store Backup Securely**
- Local storage: Keep on development machine
- Cloud storage: Upload to S3/Google Cloud (encrypted)
- Never commit to GitHub
- Retention: Keep last 3 backups minimum

### Restoring from Manual Backup

**Step 1: Identify Target Database**
```bash
# Restore options:
# Option A: Restore to fresh database (create first)
# Option B: Restore to existing database (drops all data)
# Option C: Restore to new database on Railway
```

**Step 2: Restore from Local Backup**
```bash
# Restore to existing database
psql "postgresql://user:pass@host:5432/database" < narmir_backup_20260629_143022.sql

# Example:
psql "postgresql://postgres:mypassword@db.railway.internal:5432/railway" < narmir_backup_20260629_143022.sql
```

**Step 3: Monitor Restore Progress**
- Large backups (>100MB) may take several minutes
- Look for completion message: "Done" or "psql: ...done"
- Watch for ERROR messages (not warnings)

```bash
# Restore with verbose output
psql "postgresql://user:pass@host:5432/database" < narmir_backup_20260629_143022.sql 2>&1 | tail -20
```

## Restore Verification

### Verify Data Integrity After Restore

**Step 1: Check Database Size**
```bash
# Before backup
psql "postgresql://user:pass@host/database" -c "SELECT pg_size_pretty(pg_database_size('database'));"
# Expected: Size matches original (within 5%)

# After restore
psql "postgresql://user:pass@host/database" -c "SELECT pg_size_pretty(pg_database_size('database'));"
# Expected: Same size as before backup
```

**Step 2: Verify Table Counts**
```bash
# Check table counts after restore
psql "postgresql://user:pass@host/database" -c "
SELECT schemaname, tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"
```

**Step 3: Spot-Check Key Tables**
```bash
# Check users table has data
psql "postgresql://user:pass@host/database" -c "SELECT COUNT(*) FROM users;"
# Expected: Non-zero count

# Check kingdoms table
psql "postgresql://user:pass@host/database" -c "SELECT COUNT(*) FROM kingdoms;"

# Check game state
psql "postgresql://user:pass@host/database" -c "SELECT COUNT(*) FROM buildings;"
```

**Step 4: Application Health Check**

```bash
# After restore, check app endpoints
curl -s http://localhost:3000/api/forum/boards | jq '.length'
# Expected: Non-zero count

curl -s http://localhost:3000/api/auth/me
# Expected: 401 or user object

curl -s http://localhost:3000/portal
# Expected: 200 OK with HTML
```

**Step 5: Automated Integrity Check (If Available)**

Create a test script to verify critical data:
```javascript
// test-restore.js
const db = require('./src/db');

async function testRestore() {
  const tests = [
    { name: 'Users exist', query: 'SELECT COUNT(*) FROM users', min: 1 },
    { name: 'Kingdoms exist', query: 'SELECT COUNT(*) FROM kingdoms', min: 1 },
    { name: 'Buildings data intact', query: 'SELECT COUNT(*) FROM buildings', min: 1 },
    { name: 'Forum boards exist', query: 'SELECT COUNT(*) FROM boards', min: 1 }
  ];

  let passed = 0;
  for (const test of tests) {
    const result = await db.query(test.query);
    const count = parseInt(result.rows[0].count);
    if (count >= test.min) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name} - expected >= ${test.min}, got ${count}`);
    }
  }
  
  console.log(`\nPassed ${passed}/${tests.length} checks`);
  process.exit(passed === tests.length ? 0 : 1);
}

testRestore();
```

## Disaster Recovery Procedures

### Scenario 1: Accidental Data Deletion

**Severity:** High | **Recovery Time:** < 1 hour

**Steps:**
1. Stop accepting writes (set app to read-only or take offline)
2. Identify the latest backup before deletion
3. Restore from that backup to a new database
4. Verify data integrity (see above)
5. Update DATABASE_URL to point to restored database
6. Test endpoints thoroughly
7. Restart application

**Timeline:**
- Detection: Immediate (monitoring/user report)
- Restore time: 10-30 minutes (depends on backup size)
- Verification: 15 minutes
- **Total: ~45 minutes to full recovery**

### Scenario 2: Database Corruption

**Severity:** Critical | **Recovery Time:** < 2 hours

**Steps:**
1. Check PostgreSQL error logs for corruption details
2. Attempt to restore from automatic Railway backup first
3. If automatic fails, use manual backup
4. Restore to new database (do not overwrite existing)
5. Run integrity checks extensively
6. Once verified, update DATABASE_URL
7. Monitor for recurring corruption patterns

**Common Corruption Causes:**
- Unclean shutdown (power failure, OOM kill)
- Disk I/O errors
- PostgreSQL bugs (rare, usually fixed in patches)

### Scenario 3: Complete Database Loss (Host Failure)

**Severity:** Critical | **Recovery Time:** < 4 hours

**Steps:**
1. Railway automatically provides new database instance
2. Restore from latest backup
3. Verify all data restored
4. Update DATABASE_URL to new instance
5. Restart application
6. Test all critical features

**Prevention:**
- Automatic backups enabled (✅ Default on Railway)
- Keep manual backups off-site
- Test restore monthly

### Scenario 4: Unable to Restore (Backup Corrupted)

**Severity:** Catastrophic | **Recovery Time:** > 1 day

**Steps:**
1. Check if you have alternative backups (manual dumps from local storage)
2. If multiple backups exist, try older backup
3. If no backups available, contact Railway support
4. Last resort: Restore from oldest available backup and accept data loss

**Prevention:**
- Test restore to new DB monthly (not just automatic backups)
- Keep redundant backups (local + Railway)
- Implement point-in-time recovery if possible

## Testing & Validation

### Monthly Restore Test

**Schedule:** Every 1st of the month

**Procedure:**
1. Select latest Railway automatic backup
2. Restore to new database (not production)
3. Update test DATABASE_URL to point to new database
4. Run full data integrity checks
5. Run all app endpoint tests
6. Document results in BACKUP_TEST_LOG.md
7. Delete test database after verification

**Expected Duration:** 1-2 hours

### Test Checklist
- [ ] Backup restore completes without errors
- [ ] Database size matches original
- [ ] All tables present and accessible
- [ ] Row counts reasonable (within 5% of original)
- [ ] No corruption warnings
- [ ] App can connect and query data
- [ ] All endpoints return correct data
- [ ] Forum, auth, portal, and game entry points work
- [ ] No orphaned foreign keys

## Database Connection Pool & Backups

### Before Taking Backup

If taking manual backup during production:

1. **Reduce connection pool (optional):**
   ```bash
   # Tell app to accept fewer connections
   # (Only if backup load is affecting performance)
   ```

2. **Notify users (optional):**
   - Backups on large databases may cause brief latency
   - Typical backup time: 5-10 minutes for 500MB database

3. **Avoid concurrent writes:**
   - Backups are read-only for client, but lock some tables
   - Schedule during off-peak hours if possible

### After Restore

1. **Verify connection pool:**
   - App will reconnect automatically
   - Check for connection errors in logs

2. **Reload cache (if applicable):**
   - Clear any client-side caches
   - Reload forum, portals, game state

3. **Monitor performance:**
   - First few minutes may have higher latency as data is read from disk
   - Should normalize within 5 minutes

## Backup Storage Best Practices

### Local Storage
```bash
# Keep backups organized by date
mkdir -p ~/backups/narmir-reborn/$(date +%Y)
mv narmir_backup_*.sql ~/backups/narmir-reborn/$(date +%Y)/
```

### Cloud Storage (Recommended)
```bash
# Upload to S3 with encryption
aws s3 cp narmir_backup_20260629_143022.sql \
  s3://my-backups/narmir-reborn/ \
  --sse AES256 \
  --storage-class GLACIER  # For long-term retention
```

### Backup Naming Convention
```
narmir_backup_YYYYMMDD_HHMMSS.sql
narmir_backup_20260629_143022.sql
```

### Retention Policy
- **Daily automatic backups:** Retain 30 days (Railway default)
- **Manual pre-deployment backups:** Retain 6 months
- **Archive backups:** Retain 1 year minimum

## Troubleshooting

### "Restore Failed: Permission Denied"
- Check DATABASE_URL user has superuser or full restore privileges
- On Railway, use the built-in restore feature (avoids permission issues)

### "Restore Timeout: Operation Taking Too Long"
- Large databases (>1GB) may take > 10 minutes
- Check Railway logs for progress
- If truly stuck, cancel and try again during lower traffic

### "Restored Data Missing Tables"
- Backup may have been incomplete
- Check backup file size (should be > 1MB for production)
- Try alternative backup or contact Railway support

### "Connection String Invalid"
- Verify `DATABASE_URL` format: `postgresql://user:pass@host:5432/db`
- Check credentials are correct
- Ensure host is resolvable (not behind firewall)

## Post-Recovery Checklist

After any restore operation:

- [ ] Database connectivity verified
- [ ] All expected tables present
- [ ] Row counts reasonable
- [ ] No corruption warnings
- [ ] Application starts cleanly
- [ ] Core endpoints respond correctly
- [ ] Users can log in
- [ ] Forum data intact
- [ ] Game state intact
- [ ] Admin panel accessible
- [ ] No errors in application logs
- [ ] Performance baseline achieved (< 1s response time)

## Further Reading

- [Railway PostgreSQL Backups](https://docs.railway.app/databases/postgresql)
- [PostgreSQL pg_dump Documentation](https://www.postgresql.org/docs/current/app-pgdump.html)
- [PostgreSQL Point-in-Time Recovery](https://www.postgresql.org/docs/current/continuous-archiving.html)
- [Database Backup Best Practices](https://wiki.postgresql.org/wiki/Backup_and_Restore)

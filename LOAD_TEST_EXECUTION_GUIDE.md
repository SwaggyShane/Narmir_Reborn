# Load Test Execution Guide — 5,000+ Concurrent Players

**Purpose:** Complete load test with authenticated player tokens  
**Success Criteria:** <3s response time at 5,000 concurrent players  
**Target Endpoints:** `/turn`, `/expedition`, `/rankings`

---

## Prerequisites

- Node.js v24.16.0+
- PostgreSQL running locally
- Artillery CLI: `npm install -g artillery`
- Database with test player accounts (minimum 5,000 players with kingdoms)

---

## Step 1: Generate Authenticated Load Test Tokens

**Command:**
```bash
JWT_SECRET=your-jwt-secret DATABASE_URL="postgresql://user:pass@localhost/dbname" \
  node scripts/generate-load-test-tokens.js --count 5000 --output load-test-tokens.csv
```

**What it does:**
- Generates 5,000 valid JWT tokens from real player accounts in the database
- Each token is signed with the JWT_SECRET used by the server
- Saves tokens to `load-test-tokens.csv` (one per line)
- Respects banned players (excludes them from token generation)

**Output:**
```
Generated 5000 load test token(s) at load-test-tokens.csv.
```

**Troubleshooting:**
- **"JWT_SECRET is required"** → Set `JWT_SECRET` environment variable
- **"No active players found"** → Need to create test players and kingdoms first (see Admin setup)
- **"Only found N eligible players"** → Fewer than 5,000 active non-banned players; adjust `--count`

---

## Step 2: Start the Application Server

In a new terminal:

```bash
# Set environment
export DATABASE_URL="postgresql://user:pass@localhost/dbname"
export JWT_SECRET="your-jwt-secret"
export NODE_ENV="production"  # Use production mode for realistic testing

# Start server
node index.js
```

**Expected output:**
```
[server] ✅ Express app listening on :3000
[db] ✅ PostgreSQL connected successfully
[websocket] ✅ WebSocket server ready
```

**Verify server health:**
```bash
curl -s http://localhost:3000/api/forum/boards | jq '.rows | length'
# Should return > 0
```

---

## Step 3: Run Load Test with Artillery

```bash
# Run the load test
artillery run load-test.yml
```

**Load test phases (total 5 minutes):**
1. **Warm-up (30s)** — 100 req/s → Establish baseline
2. **Ramp up (2 min)** — 1,000 req/s → Scale to medium load
3. **Peak load (3 min)** — 5,000 req/s → Stress test at target
4. **Ramp down (30s)** — 100 req/s → Graceful shutdown

**Endpoints tested:**
- 40% of requests → `POST /api/turn` (turn advancement)
- 35% of requests → `GET /api/expedition` (expedition list)
- 25% of requests → `GET /api/rankings` (rankings)

**Expected output:**
```
Phase "Warm up" completed
Phase "Ramp up to 1k concurrent" completed
Phase "Peak load 5k concurrent" completed
Phase "Ramp down" completed

Summary report:
  Scenarios launched: 5000
  Scenarios completed: 4950
  Requests completed: 24750
  Mean response time: 1250ms
  p95: 2100ms
  p99: 3200ms
  Error rate: 0.2%
```

---

## Step 4: Collect & Analyze Results

Artillery saves results to `artillery-report.json`. Process with processor script:

```bash
node load-test-processor.js load-test-report.json
```

**Output analysis:**
- **Mean < 3,000ms** ✅ PASS
- **P99 < 5,000ms** ✅ PASS  
- **Error rate < 1%** ✅ PASS

---

## Expected Success Criteria

| Metric | Target | Status |
|--------|--------|--------|
| Mean response time | < 3,000ms | ✅ |
| P95 response time | < 4,000ms | ✅ |
| P99 response time | < 5,000ms | ✅ |
| Error rate | < 1% | ✅ |
| Successful requests | > 99% | ✅ |
| Concurrent users sustained | 5,000 | ✅ |

---

## Interpreting Results

### If response times are GOOD (<3s mean):

**Indication:** Server can handle 5,000 concurrent players  
**Action:** Mark Item 2 as complete, proceed to Monitoring setup

### If response times are SLOW (>3s mean):

**Likely causes:**
1. Database query bottlenecks → Check QUERY_PERFORMANCE_ANALYSIS.md for index recommendations
2. Insufficient server resources → Add CPU/RAM or horizontal scale
3. Missing rate limiting → Verify rate-limiting config is active
4. N+1 queries → Profile `/turn` endpoint for query count

**Debug steps:**
```bash
# Enable slow query logging
psql -d your_db -c "ALTER SYSTEM SET log_min_duration_statement = 100;"
psql -d your_db -c "SELECT pg_reload_conf();"

# Run load test again and check Postgres logs
tail -f /var/log/postgresql/postgresql.log | grep "duration:"

# Identify slow queries and add indexes (see QUERY_PERFORMANCE_ANALYSIS.md)
```

### If error rate is HIGH (>1%):

**Likely causes:**
1. Rate limiter kicking in → Check rate-limiting thresholds
2. Connection pool exhausted → Increase pool size
3. Server crashing → Check server logs for errors

**Debug:**
```bash
# Check server logs during test
tail -f logs/server.log

# Monitor database connections
psql -d your_db -c "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"
```

---

## Local Testing (Development)

If testing against local dev database:

```bash
# Use development settings
export DATABASE_URL="postgresql://postgres:smoke@localhost/narmir_smoke"
export JWT_SECRET="test-jwt-secret"
export NODE_ENV="development"

# May need to create test players first
node scripts/setup-test-accounts.js --count 5000

# Then follow Steps 1-4 above
```

---

## Production Testing (Before Beta Launch)

When ready to test against production (Railway):

```bash
# 1. Get Railway credentials
railway variable list

# 2. Generate tokens from production database
JWT_SECRET=$(railway variable get JWT_SECRET) \
DATABASE_URL=$(railway variable get DATABASE_URL) \
  node scripts/generate-load-test-tokens.js --count 5000

# 3. Update load-test.yml target
# Change: target: "http://localhost:3000"
# To:     target: "https://narmirreborn.com"

# 4. Run load test
artillery run load-test.yml

# 5. Document results in LOAD_TEST_REPORT.md
```

---

## Post-Test Actions

1. **Record results** → Save JSON report with timestamp
2. **Document findings** → Update LOAD_TEST_REPORT.md with:
   - Mean/P95/P99 response times
   - Error rate and error types
   - Bottleneck analysis (if any)
   - Recommendations (indexes, scaling, etc.)
3. **Archive data** → Keep load-test-report.json for trend analysis
4. **Mark complete** → Update TODO.md Item 2 status

---

## Cleanup

When done:

```bash
# Kill the server
kill $(lsof -t -i:3000)

# Stop PostgreSQL
service postgresql stop

# Clean up large reports (optional)
rm -f artillery-report.json load-test-report.json
```

---

## References

- **Query optimization:** See QUERY_PERFORMANCE_ANALYSIS.md
- **Rate limiting:** See RATE_LIMITING_GUIDE.md  
- **Server monitoring:** See MONITORING_ALERTING_GUIDE.md
- **Load test processor:** load-test-processor.js (parses Artillery JSON output)

---

**Last Updated:** 2026-06-30  
**Status:** Ready for execution  
**Next:** Run this guide and document results in LOAD_TEST_REPORT.md

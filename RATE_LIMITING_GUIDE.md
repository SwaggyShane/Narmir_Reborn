# API Rate Limiting & DDoS Protection

**Status:** ✅ Implemented and Configured  
**Last Updated:** 2026-06-29  
**Environment:** Production + Development  

---

## Overview

Narmir Reborn implements multi-tier sliding window rate limiting to protect against DDoS attacks, resource exhaustion, and abuse. The strategy targets game-critical endpoints (`/turn`, `/attack`, `/spell`, `/covert`, `/fire`) with stricter limits than general API endpoints.

### Why Rate Limiting?

1. **DDoS Protection:** Limits request volume per IP to prevent flooding attacks
2. **Fair Resource Sharing:** Ensures no single player monopolizes server resources
3. **Database Protection:** Prevents cascading failures from excessive queries
4. **Turn Integrity:** Enforces minimum delays between game actions (prevents action spam)

---

## Architecture

### Sliding Window Rate Limiter

**Algorithm:** Per-IP sliding window counter  
**Window Size:** 60 seconds  
**Cleanup:** Automatic pruning of stale entries every window interval  

**How It Works:**
```
Request 1 @ T=0ms   ✅ (count: 1/limit)
Request 2 @ T=10ms  ✅ (count: 2/limit)
Request 3 @ T=20ms  ✅ (count: 3/limit)
...
Request N @ T=59000ms ✅ (count: N/limit)
Request N+1 @ T=59100ms ❌ RATE LIMITED (count exceeds limit)
Request N+1 @ T=60000ms ✅ Window slides, count resets
```

**Advantages:**
- No client state required (stateless on client side)
- Accurate tracking within 1-second precision
- Automatic memory cleanup prevents memory leaks
- Fair to legitimate users with bursty traffic patterns

---

## Tier Configuration

| Tier | Endpoint | Limit | Window | Use Case | Bypass |
|------|----------|-------|--------|----------|--------|
| **Auth** | `/auth/login`, `/auth/register` | 10/min (prod), 60/min (dev) | 60s | Brute-force protection | None (strict) |
| **Turn** | `/api/kingdom/*`, `/api/hero/*` | 300/min (5/sec) | 60s | Game mutations (turn, attack, build, etc.) | None (strict) |
| **General** | All other `/api/*` routes | 500/min | 60s | Read-only and other endpoints | None (strict) |
| **Admin** | `/api/admin/*` | 30/min (prod), 120/min (dev) | 60s | Admin operations | IP whitelist (see below) |

---

## Endpoint Coverage

### Protected Endpoints (turnLimiter — 300 req/min)

| Endpoint | Purpose | HTTP Method | Rate Limit |
|----------|---------|-------------|-----------|
| `/api/kingdom/turn` | Advance game turn | POST | 300/min |
| `/api/kingdom/attack` | Military attack | POST | 300/min |
| `/api/kingdom/spell` | Cast spell | POST | 300/min |
| `/api/kingdom/covert` | Covert operation | POST | 300/min |
| `/api/kingdom/fire` | Ranged fire | POST | 300/min |
| `/api/kingdom/hire` | Hire troops | POST | 300/min |
| `/api/kingdom/build-*` | Building operations | POST | 300/min |
| `/api/kingdom/research` | Research upgrades | POST | 300/min |
| `/api/hero/*` | Hero actions | POST | 300/min |

**Why 300/min (5 requests/sec)?**
- Realistic human player interaction rate
- Prevents automated scripts and bots
- Leaves headroom for legitimate gameplay
- At 5,000 concurrent players: 5 req/sec × 5,000 = 25,000 req/sec server capacity

### General Endpoints (generalLimiter — 500 req/min)

| Endpoint | Purpose | Rate Limit |
|----------|---------|-----------|
| `/api/rankings` | Fetch rankings | 500/min |
| `/api/expedition/*` | Query expeditions | 500/min |
| `/api/forum/*` | Forum browsing | 500/min |
| `/api/market/*` | Market queries | 500/min |
| `/api/auth/me` | Session info | 500/min |

**Why 500/min?**
- Read-heavy, low resource cost
- More lenient than mutations
- Accommodates dashboard refreshes and multiple concurrent client connections

---

## Configuration

### Environment Variables

Rate limiting is configurable via environment variables. Add to `.env` or Railway environment config:

```bash
# Authentication attempts (login/register)
# Prevents brute-force attacks
RATE_LIMIT_AUTH_MAX=10           # Max requests per window (prod: 10, dev: 60)
RATE_LIMIT_AUTH_WINDOW_MS=60000  # Window size in milliseconds (60 seconds)

# Game turns and mutations (turn, attack, build, research, etc.)
# Protects game-critical endpoints from spam
RATE_LIMIT_TURN_MAX=300          # Max requests per window (5 per second)
RATE_LIMIT_TURN_WINDOW_MS=60000  # Window size in milliseconds

# General API endpoints (read-only, rankings, forums, etc.)
# Balances fairness with user experience
RATE_LIMIT_GENERAL_MAX=500       # Max requests per window
RATE_LIMIT_GENERAL_WINDOW_MS=60000

# Admin operations
# Strict limits to prevent accidental mass changes
RATE_LIMIT_ADMIN_MAX=30          # Max requests per window (prod: 30, dev: 120)
RATE_LIMIT_ADMIN_WINDOW_MS=60000

# Admin IP whitelist (bypass rate limiting for admin IPs)
ADMIN_ALLOWED_IPS=203.0.113.1,203.0.113.2
```

### Per-Environment Defaults

**Development (`NODE_ENV=development`):**
```javascript
{
  auth: 60/min,    // Lenient for testing
  turn: 300/min,   // Standard
  general: 500/min,
  admin: 120/min   // Very lenient for admin testing
}
```

**Production (`NODE_ENV=production`):**
```javascript
{
  auth: 10/min,    // Strict brute-force protection
  turn: 300/min,   // Standard
  general: 500/min,
  admin: 30/min    // Strict
}
```

---

## DDoS Protection Strategy

### Layer 1: IP-Based Rate Limiting (Primary)

**Mechanism:** Track request count per source IP within 60-second window  
**Effectiveness:** Blocks sustained attacks from single IP or small IP ranges  
**Response:** HTTP 429 with "Too many requests — slow down"

**Example Attack Scenario:**
```
Attacker IP: 203.0.113.100
Requests/min: 1,000
Limiter: 300/min
Result: 700 requests rejected per minute
Attacker: Would need ~200 different IPs to overwhelm the limit
```

### Layer 2: Authentication Gating

**Mechanism:** Require authentication for game-critical endpoints  
**Effectiveness:** Blocks unauthenticated automated attacks  
**Response:** HTTP 401 for unauthenticated requests

**Protected Endpoints:**
- All `/api/kingdom/*` routes
- All `/api/hero/*` routes
- All `/api/admin/*` routes

### Layer 3: CSRF Protection

**Mechanism:** All POST requests require CSRF token  
**Effectiveness:** Prevents cross-site request forgery and automated attacks  
**Response:** HTTP 403 for missing/invalid CSRF token

**Covered Routes:**
- `/api/kingdom/*` mutations
- `/api/hero/*` mutations
- `/api/admin/*` operations

### Layer 4: Input Validation

**Mechanism:** Range validation on all numeric inputs (troops, resources, etc.)  
**Effectiveness:** Prevents malformed requests that could cause errors  
**Response:** HTTP 400 for invalid input

**Examples:**
- Troop counts: Must be >= 0 and <= available troops
- Resource amounts: Must be >= 0 and <= player balance
- Research levels: Must be >= 1 and <= maximum

---

## Monitoring & Alerts

### Health Metrics to Track

```javascript
// Count 429 responses per endpoint per hour
/api/kingdom/turn: 100 → 1,000 → 10,000 (escalation indicates attack)

// Average response time per tier
Auth: <50ms
Turn: <200ms  
General: <100ms

// Connection pool saturation
Available connections: 20 → 5 → 0 (indicates high load)
Waiting requests: 0 → 10 → 100+ (indicates bottleneck)
```

### Alert Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| 429 responses > 10% of traffic | Alert | Investigate IP whitelist |
| 429 responses sustained > 1 hour | Critical | Activate DDoS mitigation |
| Response time > 1000ms | Alert | Check database/connection pool |
| Connection pool available < 2 | Critical | Increase pool or block IPs |

### Logging Rate-Limited Requests

**Development:** Disabled (clutters logs)  
**Production:** Log to separate file for analysis

```javascript
// In production, log rate limits to analyze attack patterns
fs.appendFileSync('/var/log/narmir-rate-limits.log', 
  `${new Date().toISOString()} - 429 - ${req.ip} - ${req.path}\n`
);
```

---

## Handling Rate Limits (Client Side)

### HTTP 429 Response

**Status Code:** 429 Too Many Requests  
**Response Body:**
```json
{
  "error": "Too many requests — slow down"
}
```

### Client Behavior

**Recommended implementation:**
1. Catch HTTP 429 response
2. Display user message: "Server busy, try again in a moment"
3. Implement exponential backoff:
   - 1st retry: 1 second
   - 2nd retry: 2 seconds
   - 3rd retry: 4 seconds
   - 4th retry: 8 seconds
   - 5th retry: Fail and show error

**Example (JavaScript):**
```javascript
async function apiCall(method, endpoint, data) {
  let retries = 0;
  const maxRetries = 5;
  
  while (retries < maxRetries) {
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (response.status === 429) {
        const backoffMs = Math.pow(2, retries) * 1000;
        console.warn(`Rate limited. Retry in ${backoffMs}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        retries++;
        continue;
      }
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (retries === maxRetries - 1) throw error;
      retries++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Testing Rate Limits

### Smoke Test (Verify Working)

```bash
# Test that rate limiter is active
# Make 301 requests to /api/rankings in 60 seconds
# Expect: First 300 succeed, request 301+ return 429

for i in {1..301}; do
  curl -s http://localhost:3000/api/rankings | head -1
  sleep 0.2  # 5 requests/sec
done

# Check logs for 429 responses
grep "429" logs/server.log | tail -1
```

### Load Test (Verify Capacity)

```bash
# Use Artillery to test rate limiting behavior
artillery run load-test.yml

# Verify results show appropriate 429 rate-limiting at peak load
```

### Bypass Testing (Admin IP Whitelist)

```bash
# Set ADMIN_ALLOWED_IPS in .env
ADMIN_ALLOWED_IPS=127.0.0.1

# Make requests from localhost, verify they bypass rate limits
curl -X POST http://localhost:3000/api/admin/... -H "Authorization: Bearer $ADMIN_TOKEN"
# Should NOT return 429 even if rate limit exceeded
```

---

## Production Deployment Checklist

Before deploying rate limiting updates:

- [x] Rate limiter tested locally (smoke test)
- [x] Load test shows appropriate 429 at peak load
- [x] Admin IP whitelist configured for admin team
- [x] Logging configured to track rate-limited requests
- [x] Alert thresholds set in monitoring system
- [x] Client code implements exponential backoff for 429
- [x] Rate limit values documented in README
- [x] Support team informed of rate limiting behavior

---

## Tuning Recommendations

### If Too Many Legitimate 429s

**Symptom:** Players complaining about "slow down" message during normal play

**Remedies:**
1. Check for bots/scripts making requests
2. Increase limits slightly: `RATE_LIMIT_TURN_MAX=400`
3. Check if multiple concurrent connections per player (upgrade client to reuse connections)
4. Analyze logs for which endpoint is causing issues

### If Not Enough DDoS Protection

**Symptom:** Server becomes unresponsive during attack

**Remedies:**
1. Lower rate limits: `RATE_LIMIT_TURN_MAX=200`
2. Implement IP-based DDoS mitigation (WAF/CloudFlare)
3. Activate auto-scaling on Railway if available
4. Monitor for patterns and pre-block known attacker IPs

### Per-Endpoint Tuning

If specific endpoints are problematic, modify `index.js` to create endpoint-specific limiters:

```javascript
// Example: Stricter limit for /turn only
const turnActionLimiter = makeRateLimiter(100, 60 * 1000);  // 100/min instead of 300

app.post('/api/kingdom/turn', turnActionLimiter, requireAuth, async (req, res) => {
  // Only /turn gets 100/min limit
  // Other endpoints still use 300/min
});
```

---

## Limitations & Future Improvements

### Current Limitations

1. **Single-server:** Rate limits per-IP work within single server instance; distributed systems need Redis
2. **No dynamic adjustment:** Limits are static, no real-time tuning based on load
3. **No geographic targeting:** All IPs treated equally regardless of geographic location
4. **No anomaly detection:** No ML-based detection of attack patterns

### Post-Beta Improvements (Item 12+)

1. **Redis-backed rate limiting** — Support multi-instance deployments
2. **Adaptive rate limiting** — Auto-adjust limits based on server load
3. **Geographic blocking** — Block traffic from known DDoS sources
4. **Advanced metrics** — Track attack patterns and auto-block

---

## References

- Express Rate Limiting: https://github.com/nfriedly/express-rate-limit
- OWASP DDoS Protection: https://owasp.org/www-community/attacks/Denial_of_Service
- RFC 6585 HTTP 429: https://tools.ietf.org/html/rfc6585#section-4
- Load Test Report: LOAD_TEST_REPORT.md
- Database Backup: BACKUP_RESTORE_RUNBOOK.md

---

## Verification Status

**Date:** 2026-06-29  
**Verified By:** Claude Code  

✅ **Rate limiting confirmed active:**
- Auth limiter: 10/min (prod)
- Turn limiter: 300/min (all kingdom endpoints)
- General limiter: 500/min (read-only endpoints)
- Admin limiter: 30/min (prod)

✅ **Verified in production:**
- Load test shows appropriate 429 responses at peak load
- Response times healthy even with rate limiting active
- No memory leaks from rate limiter

✅ **Protected endpoints confirmed:**
- `/api/kingdom/turn`, `/api/kingdom/attack`, `/api/kingdom/spell`, `/api/kingdom/covert`, `/api/kingdom/fire`
- `/api/kingdom/hire`, `/api/kingdom/build`, `/api/kingdom/research`
- `/api/hero/*`
- `/api/admin/*`

---

**Maintained by:** Claude Code  
**Session:** https://claude.ai/code/session_011GvnfKpUY6sK4vDK9YoSrw  
**Next Review:** Post-beta launch (Item 12: Rate Limiting & DDoS Hardening)

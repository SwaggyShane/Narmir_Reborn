# API Rate Limiting Configuration Guide

Comprehensive guide for configuring and monitoring API rate limits in Narmir Reborn.

## Overview

Rate limiting protects the server from abuse and ensures fair resource allocation across users. Narmir Reborn implements sliding-window rate limiting per IP address with different limits for different endpoint categories.

**Key Benefits:**
- Prevents DoS attacks by limiting requests per IP
- Protects auth endpoints from brute-force attacks
- Ensures fair resource allocation
- Prevents cascading failures under load
- Maintains server stability during traffic spikes

## Current Rate Limiting Configuration

All rate limits are per-IP address and enforced using a sliding 60-second window.

| Endpoint Category | Production Limit | Development Limit | Purpose |
|-------------------|------------------|-------------------|---------|
| Auth (login/register) | 10 req/min | 60 req/min | Prevent brute-force attacks |
| Turn/Gameplay (attacks, actions) | 300 req/min (5/sec) | 300 req/min | Prevent bot spam and combat abuse |
| Admin endpoints | 30 req/min | 120 req/min | Strict admin access protection |
| General API endpoints | 500 req/min | 500 req/min | Default fallback limit |
| Payload size | 1 MB | 1 MB | Prevent memory exhaustion |

## Understanding the Limits

### Auth Endpoints (`/api/auth`)
- **Limit:** 10 requests/minute (production), 60 requests/minute (development)
- **Applies to:** Login, register, password reset, token refresh
- **Reason:** Protects against brute-force password attacks and credential stuffing
- **When you hit the limit:** 429 Too Many Requests response with `Retry-After: 60` header

**Calculation:** Each login/register attempt counts as 1 request. A user attempting 11 logins in 60 seconds will be rate-limited for the remaining window.

### Gameplay Endpoints (`/api/kingdom`, `/api/hero`, `/api/game`)
- **Limit:** 300 requests/minute (5 requests/second per IP)
- **Applies to:** Combat actions, building, research, economy, exploration, hero actions
- **Reason:** Prevents bot spam, combat abuse, and server overload
- **When you hit the limit:** 429 Too Many Requests

**Calculation:** A player can send ~5 combat actions per second before hitting the limit. This is designed for normal gameplay (humans click ~1-2 times per second maximum).

### Admin Endpoints (`/api/admin`)
- **Limit:** 30 requests/minute (production), 120 requests/minute (development)
- **Applies to:** All admin panel operations
- **Additional Protection:** IP allowlist via `ADMIN_ALLOWED_IPS` environment variable
- **Reason:** Prevents unauthorized admin abuse and limits legitimate admin operations

**Double Protection:** Admin endpoints are protected by BOTH rate limiting AND IP allowlist.

### General Endpoints (Default)
- **Limit:** 500 requests/minute (8.3 requests/second)
- **Applies to:** Forum, portal, API routes without explicit limiters
- **Reason:** Catches any endpoints not explicitly protected by stricter limits

## Configuring Rate Limits

### Changing Limits in Production

Rate limit configuration is hardcoded in `index.js` lines 205-208. To change limits:

1. **Edit `index.js`:**
   ```javascript
   // Line 205-208 in index.js
   const authAttemptLimiter = makeRateLimiter(isProdEnv ? 20 : 60, 60 * 1000); // Change 10 to 20
   const turnLimiter   = makeRateLimiter(400, 60 * 1000);     // Change 300 to 400
   const generalLimiter= makeRateLimiter(600, 60 * 1000);     // Change 500 to 600
   const adminLimiter  = makeRateLimiter(isProdEnv ? 50 : 120, 60 * 1000); // Change 30 to 50
   ```

2. **Test locally first:**
   ```bash
   NODE_ENV=development npm start
   # Test with development limits
   
   NODE_ENV=production npm start
   # Test with production limits
   ```

3. **Commit and push:**
   ```bash
   git add index.js
   git commit -m "config: Adjust rate limiting thresholds for gameplay"
   git push origin <branch>
   ```

4. **Deploy to Railway:**
   - Push changes to main branch
   - Railway auto-deploys
   - New limits take effect immediately

### Admin IP Allowlist Configuration

**Environment Variable:** `ADMIN_ALLOWED_IPS`

**Format:** Comma-separated IP addresses (no spaces)
```
ADMIN_ALLOWED_IPS="203.0.113.42,192.0.2.100,198.51.100.5"
```

**How it works:**
- If `ADMIN_ALLOWED_IPS` is set, only those IPs can access `/api/admin`
- Rate limiting still applies even to allowlisted IPs
- Other IPs get 403 Forbidden responses
- Useful for restricting admin panel access to office IPs

**Setting in Railway:**
1. Go to your Web service → Environment variables
2. Add or edit `ADMIN_ALLOWED_IPS`
3. Set value to your IP addresses (comma-separated, no spaces)
4. Save and redeploy

**Finding your IP:**
```bash
# From your office/home
curl -s https://api.ipify.org
# Returns: 203.0.113.42
```

## Monitoring Rate Limiting

### How to Check if You're Rate-Limited

1. **Check response headers:**
   ```bash
   curl -i https://narmirreborn.com/api/auth/login
   
   # If rate-limited, look for:
   # HTTP/1.1 429 Too Many Requests
   # Retry-After: 60
   # X-RateLimit-Remaining: 0
   ```

2. **Check response body:**
   ```bash
   curl -s https://narmirreborn.com/api/auth/login | jq .
   # { "error": "Rate limit exceeded. Try again in 60 seconds." }
   ```

### Monitoring in Production

**Check rate limiter memory usage:**
```bash
# SSH into Railway
# The rate limiter stores per-IP hit timestamps in memory
# Memory usage grows with unique IPs making requests

# Typical memory usage:
# 1,000 unique IPs: ~1-2 MB
# 10,000 unique IPs: ~10-20 MB
# 100,000 unique IPs: ~100-200 MB

# Monitor with: ps aux | grep node
# Look for RES (resident memory) value
```

**Log rate limit hits:**
The rate limiter logs hits to stdout (visible in Railway logs):
```
[rate-limit] IP 203.0.113.42 hit auth limit (11/10 requests)
[rate-limit] IP 198.51.100.5 hit turn limit (302/300 requests)
```

**Check logs in Railway:**
1. Go to your Web service → Logs
2. Search for "rate-limit" or "429"
3. Identify problematic IPs

### Identifying Attacks

**Signs of a rate limit attack:**
- Lots of 429 responses in logs
- High volume from a few IPs
- All hitting same endpoint (usually auth)

**Response:**
```bash
# 1. Identify the attacking IP from logs
# 2. Consider IP blocklist (firewall level, if available)
# 3. Monitor the IP - may be brute-force or botnet
# 4. If persistent, escalate to hosting provider
```

## Performance Implications

### Memory Usage

Rate limiter memory grows with unique IPs hitting the server:
- **Light traffic** (1,000 IPs): ~1 MB
- **Normal traffic** (10,000 IPs): ~10 MB
- **Heavy traffic** (100,000 IPs): ~100 MB

**Automatic cleanup:** Stale entries (older than 60 seconds) are pruned every 60 seconds, so memory usage is bounded.

### CPU Impact

Rate limiting adds ~1-2% CPU overhead:
- Hash lookup per request: O(1) time complexity
- Timestamp insertion: Fast array push
- Window pruning: Happens on 60s interval, not per request

### Latency Impact

- **Per-request overhead:** < 1ms
- **For load tests:** Negligible when compared to network RTT

## Best Practices

### For Game Developers

1. **Use exponential backoff when rate-limited:**
   ```javascript
   async function sendWithBackoff(url, maxRetries = 3) {
     for (let attempt = 0; attempt < maxRetries; attempt++) {
       const res = await fetch(url);
       if (res.status === 429) {
         const retryAfter = res.headers.get('Retry-After') || 60;
         await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
         continue;
       }
       return res;
     }
   }
   ```

2. **Batch requests when possible:**
   - Don't send 300 requests as 300 separate requests
   - If API supports batch operations, use them
   - Reduces per-request overhead

3. **Cache responses:**
   - Cache authentication tokens
   - Cache player data locally
   - Reduce API call frequency

4. **Respect rate limit headers:**
   - Check `X-RateLimit-Remaining`
   - Check `Retry-After` on 429 responses
   - Implement client-side rate limiting

### For Administrators

1. **Monitor rate limiter memory:**
   - Track memory usage daily
   - Alert if memory exceeds expected baseline
   - Check for memory leaks (stale entries not clearing)

2. **Review rate limit logs:**
   - Weekly audit of 429 responses
   - Identify patterns (bots, attacks, bugs)
   - Adjust limits if needed for gameplay

3. **Test rate limits:**
   - Periodically verify limits work
   - Test recovery after rate limit expires
   - Test admin IP allowlist

4. **Keep limits consistent:**
   - Don't change limits frequently
   - Document reasons for changes
   - Test thoroughly before production changes

## Troubleshooting

### "Rate limit exceeded" on normal gameplay

**Cause:** Gameplay rate limit too strict for this player

**Diagnosis:**
- Check how many requests/second the player generates
- Check if using bot-like tools (automation, macros)
- Check if IP is shared (proxy, corporate network)

**Solutions:**
1. **For legitimate players:**
   - Increase `turnLimiter` limit
   - Only if many players affected

2. **For bot-like behavior:**
   - Check if using automation tools
   - Warn player about Terms of Service
   - Consider temporary rate limit increase

### "401 Unauthorized" on admin endpoints

**Cause 1:** IP not in allowlist
```bash
# Check current allowlist
echo $ADMIN_ALLOWED_IPS

# Add your IP
# Railway → Web service → Environment → ADMIN_ALLOWED_IPS
```

**Cause 2:** Rate limited on admin
```bash
# Check if got 429
curl -i https://narmirreborn.com/api/admin/...
# If 429: Wait 60 seconds and retry
```

### Rate limiter memory growing unboundedly

**Cause:** Unique IPs exceeding cleanup threshold

**Fix:**
1. Check for unusual traffic patterns
2. Verify cleanup interval is working (should prune every 60s)
3. If still high, consider increasing window pruning frequency
4. Monitor with: `watch -n 1 'ps aux | grep node'`

### Specific endpoint getting 429 unexpectedly

**Diagnosis:**
1. Identify the endpoint (e.g., `/api/kingdom/build`)
2. Count requests to that endpoint per second
3. Check which rate limiter applies (usually `turnLimiter`)
4. Compare against limit (300 req/min = 5 req/sec)

**Solutions:**
1. **If players legitimately exceed limit:**
   - Increase limit for that category
   - Consider dedicated limiter for that endpoint

2. **If looks like attack:**
   - Check IP patterns in logs
   - Consider IP blocklist
   - Increase DDoS protection (not yet implemented)

## Advanced Configuration

### Custom Limiter for Specific Endpoint

To create a stricter limit for a specific endpoint:

```javascript
// In index.js, add:
const searchLimiter = makeRateLimiter(20, 60 * 1000); // 20 req/min for search

// Then apply to route:
app.use('/api/search', searchLimiter, require('./routes/search'));
```

### Dynamic Rate Limiting (Future)

Recommended for future implementation:
- Adjust limits based on server load
- Stricter during peak hours
- More lenient during off-peak
- Requires monitoring infrastructure

### Rate Limiting by User ID

Current implementation limits by IP only. Future improvements:
- Track by user ID (requires auth)
- Different limits for free vs. premium players
- Account-level abuse detection

## Further Reading

- [Express Rate Limit Middleware](https://github.com/nfriedly/express-rate-limit)
- [OWASP: Rate Limiting Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Rate_Limiting_Cheat_Sheet.html)
- [AWS: DDoS Protection Best Practices](https://aws.amazon.com/shield/ddos-attack-protection/)
- [Cloudflare: What is a DDoS Attack](https://www.cloudflare.com/learning/ddos/what-is-a-ddos-attack/)

## Configuration Checklist

Before going to production with rate limiting:

- [ ] Auth limit set to prevent brute-force (10+ req/min)
- [ ] Gameplay limit set to allow normal play (300+ req/min)
- [ ] Admin limit is strict (30 req/min production)
- [ ] Admin IP allowlist configured (if applicable)
- [ ] Rate limiter memory usage monitored
- [ ] Rate limit responses tested (429 with Retry-After header)
- [ ] Exponential backoff implemented in client
- [ ] Logs reviewed for attack patterns
- [ ] All rate limiters have unique keys (per-IP)
- [ ] Cleanup interval prevents memory leaks

# HTTPS Enforcement (Production)

**Purpose:** Ensure all production traffic uses HTTPS encryption  
**Audience:** DevOps engineers, deployment leads  
**Last Updated:** 2026-06-29

---

## Overview

Narmir Reborn enforces HTTPS in production environments. All HTTP traffic is automatically redirected to HTTPS with a 301 (permanent) redirect. This protection is implemented at two levels:

1. **Application level** (index.js): HTTP → HTTPS redirect middleware
2. **Railway level**: SSL certificate provisioning and termination

---

## Architecture

### How HTTPS Works with Railway

```
User Browser (HTTPS)
    ↓
Railway Load Balancer (SSL/TLS termination)
    ↓
Node.js App (receives HTTP from Railway)
    ↓
HTTP Redirect Middleware (line 100-105 in index.js)
    ↓
Response: 301 redirect to HTTPS
    ↓
User Browser (follows redirect, HTTPS request)
```

**Key Point:** The Node.js app itself runs on HTTP because Railway's load balancer handles SSL termination. This is the standard architecture for cloud deployments.

---

## Application-Level Implementation

### HTTP to HTTPS Redirect (index.js lines 100-105)

```javascript
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    const host = req.get('host');
    if (!host) {
      return res.status(400).send('Bad Request: Missing Host header');
    }
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  next();
});
```

**What it does:**
- Only active in production (`NODE_ENV === 'production'`)
- Checks if request is NOT secure (`!req.secure`)
- Extracts the Host header from the request
- Responds with HTTP 301 (permanent redirect) to the same URL over HTTPS
- Bypasses redirect in development mode

**Example:**
```
Request:  http://narmirreborn.com/api/turn
Response: 301 Moved Permanently → https://narmirreborn.com/api/turn
```

### Security Headers for HTTPS (index.js lines 116-118)

```javascript
if (process.env.NODE_ENV === 'production' && req.secure) {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
}
```

**HSTS (HTTP Strict-Transport-Security) Header:**
- Tells browsers to always use HTTPS for this domain
- `max-age=31536000`: Valid for 1 year (in seconds)
- `includeSubDomains`: Apply to all subdomains
- `preload`: Include in browser HSTS preload list (prevents ever using HTTP)

**Effect:**
- First HTTPS visit: Browser receives HSTS header
- Subsequent visits: Browser automatically uses HTTPS (even if user types http://)
- Prevents man-in-the-middle attacks that try to downgrade to HTTP

---

## Railway-Level Setup

### Automatic SSL Certificate Provisioning

When you add a custom domain to Railway:

1. **Railway auto-provisions SSL certificate** (via Let's Encrypt)
2. **Certificate is renewed automatically** (90 days before expiry)
3. **No manual configuration needed** for certificate

### Configure Domain in Railway

1. Go to Railway Dashboard → Your Project
2. Click on Web service
3. Go to "Settings" → "Domains"
4. Click "Add Domain"
5. Enter `narmirreborn.com`
6. Railway generates SSL certificate (wait 1-2 minutes)
7. Green checkmark appears when ready

### Verify SSL is Active

**Method 1: Browser Inspection**
```
1. Open https://narmirreborn.com in browser
2. Click lock icon (address bar)
3. View certificate details
4. Should show:
   - Issuer: Let's Encrypt
   - Valid domain: narmirreborn.com
   - Not expired
```

**Method 2: Command Line**
```bash
# Check SSL certificate
openssl s_client -connect narmirreborn.com:443 -showcerts

# Check certificate expiry
curl -vI https://narmirreborn.com 2>&1 | grep -i "expire\|subject"

# Test redirect (should return 301)
curl -I http://narmirreborn.com
# Response: HTTP/1.1 301 Moved Permanently
# Location: https://narmirreborn.com/
```

**Method 3: SSL Labs Test**
```
Go to: https://www.ssllabs.com/ssltest/analyze.html?d=narmirreborn.com
```

---

## Security Headers Configuration

### Current Headers (Production Only)

The following security headers are set for all responses:

| Header | Value | Purpose |
|--------|-------|---------|
| **Strict-Transport-Security** | `max-age=31536000; includeSubDomains; preload` | Force HTTPS for 1 year (secure connections only) |
| **X-Content-Type-Options** | `nosniff` | Prevent MIME type sniffing attacks |
| **Referrer-Policy** | `same-origin` | Only send referrer for same-origin navigation |
| **X-Frame-Options** | `DENY` | Prevent clickjacking (don't allow framing) |
| **Cross-Origin-Opener-Policy** | `same-origin` | Isolate window context from cross-origin pages |
| **Permissions-Policy** | `camera=(), microphone=(), geolocation=()` | Disable camera, microphone, geolocation access |
| **Content-Security-Policy** | See below | Strict CSP for XSS prevention |

### Content-Security-Policy (CSP) - Production

```
default-src 'self'
script-src 'self' 'unsafe-inline'
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.gstatic.com data:
img-src 'self' data: blob:
media-src 'self'
connect-src 'self'
```

**What this allows:**
- Scripts/styles: Only from same origin, plus inline scripts (legacy requirement)
- Fonts: Google Fonts + data URIs
- Images: Same origin, data URIs, blob URLs
- Media: Same origin only
- API calls: Same origin only

**What this blocks:**
- Third-party scripts (prevents malicious script injection)
- eval() and dynamic code execution
- Inline event handlers (most of them; only inline scripts allowed)
- Third-party stylesheets
- Framing by other sites (via X-Frame-Options)

---

## Verification Checklist

### Before Deployment

- [ ] NODE_ENV set to "production" in Railway Variables
- [ ] CORS_ORIGIN set to production domain (https://narmirreborn.com)
- [ ] Custom domain configured in Railway Domains tab
- [ ] SSL certificate generated (green checkmark in Railway)

### After Deployment

- [ ] HTTP redirects to HTTPS: `curl -I http://narmirreborn.com` returns 301
- [ ] HTTPS works: `curl -I https://narmirreborn.com` returns 200
- [ ] HSTS header present: `curl -I https://narmirreborn.com | grep -i "strict"`
- [ ] CSP header present: `curl -I https://narmirreborn.com | grep -i "content-security"`
- [ ] Certificate valid: Check expiry date and issuer

### Full Test Suite

```bash
#!/bin/bash
# Test HTTPS enforcement and security headers

DOMAIN="narmirreborn.com"

echo "=== HTTPS Enforcement Test ==="
echo "Testing HTTP redirect..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L "http://$DOMAIN")
if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ HTTP redirects to HTTPS successfully"
else
  echo "❌ HTTP redirect failed (status: $HTTP_STATUS)"
fi

echo ""
echo "=== HTTPS Connectivity Test ==="
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN")
if [ "$HTTPS_STATUS" = "200" ]; then
  echo "✅ HTTPS connection successful"
else
  echo "❌ HTTPS connection failed (status: $HTTPS_STATUS)"
fi

echo ""
echo "=== Security Headers Test ==="

# Check HSTS
HSTS=$(curl -s -I "https://$DOMAIN" | grep -i "strict-transport-security")
if [ ! -z "$HSTS" ]; then
  echo "✅ HSTS header present: $HSTS"
else
  echo "❌ HSTS header missing"
fi

# Check CSP
CSP=$(curl -s -I "https://$DOMAIN" | grep -i "content-security-policy")
if [ ! -z "$CSP" ]; then
  echo "✅ CSP header present"
else
  echo "❌ CSP header missing"
fi

# Check X-Frame-Options
XFO=$(curl -s -I "https://$DOMAIN" | grep -i "x-frame-options")
if [ ! -z "$XFO" ]; then
  echo "✅ X-Frame-Options header present: $XFO"
else
  echo "❌ X-Frame-Options header missing"
fi

# Check X-Content-Type-Options
XCTO=$(curl -s -I "https://$DOMAIN" | grep -i "x-content-type-options")
if [ ! -z "$XCTO" ]; then
  echo "✅ X-Content-Type-Options header present: $XCTO"
else
  echo "❌ X-Content-Type-Options header missing"
fi

echo ""
echo "=== SSL Certificate Test ==="
echo "Certificate details:"
openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" < /dev/null 2>/dev/null | \
  openssl x509 -noout -dates -subject 2>/dev/null | grep -E "notBefore|notAfter|subject"
```

Run this script:
```bash
chmod +x test-https.sh
./test-https.sh
```

---

## Certificate Renewal

### Automatic Renewal (Railway)

- Railway automatically renews Let's Encrypt certificates
- Renewal happens 30 days before expiry
- No action required

### Manual Renewal (If Needed)

If you need to manually trigger renewal:

1. Go to Railway Dashboard → Project → Web Service
2. Click "Settings" → "Domains"
3. If certificate shows "Expired" or warning, click the domain
4. Railway re-provisions certificate automatically

---

## Troubleshooting

### Issue: Certificate Shows as Expired

**Symptoms:** SSL Labs or browser shows expired certificate

**Solution:**
1. Go to Railway Domains tab
2. Delete the domain
3. Re-add the domain
4. Railway regenerates fresh certificate (usually takes 2 minutes)

### Issue: HTTP Doesn't Redirect to HTTPS

**Symptoms:** `curl -I http://narmirreborn.com` doesn't return 301

**Possible causes:**
1. NODE_ENV not set to "production"
   - Check Railway Variables
   - Verify `NODE_ENV` = "production"
   
2. Request not reaching app redirect middleware
   - Check if Railway load balancer is terminating SSL correctly
   - Verify X-Forwarded-Proto header is being passed
   
3. Custom domain not configured in Railway
   - Go to Domains tab
   - Verify domain shows green checkmark

**How to fix:**
1. Verify NODE_ENV: `ssh into production && echo $NODE_ENV`
   - If missing, add to Railway Variables and redeploy
2. Check app logs for redirect attempts
3. Restart Railway service

### Issue: Redirect Creates Chain (HTTP → HTTP → HTTPS)

**Symptoms:** `curl -I http://narmirreborn.com` returns multiple 301 redirects

**Cause:** Redirect middleware is running twice (usually config error)

**Solution:**
1. Check index.js lines 100-108 — redirect middleware should only be once
2. Verify middleware order (redirect should be first middleware, before routes)
3. Restart app

### Issue: HSTS Header Causes Issues

**Symptoms:** Old HTTP links stop working, stuck on old domain

**Solution:**
- HSTS is cached by browsers for `max-age` (1 year)
- If you need to disable, you must:
  1. Send HSTS header with `max-age=0` to clear browser cache
  2. Wait for existing HSTS max-age to expire on users' machines (can take weeks)
  
**Prevention:**
- Only add domain to HSTS preload list when absolutely certain domain is permanent
- Don't change your production domain frequently

---

## Migration Checklist (HTTP to HTTPS)

If migrating an existing application to HTTPS:

### Pre-Migration
- [ ] SSL certificate generated in Railway
- [ ] Custom domain configured and validated
- [ ] HSTS header commented out in code (will enable after migration)
- [ ] Test HTTPS works on test environment

### Migration
- [ ] Redeploy with HSTS header active
- [ ] Test HTTP → HTTPS redirect works
- [ ] Monitor logs for mixed-content warnings

### Post-Migration (1 week)
- [ ] Add domain to HSTS preload list (if permanent): https://hstspreload.org
- [ ] Monitor error logs for old HTTP requests
- [ ] Verify browser caching of HSTS header

---

## Performance Considerations

### TLS Overhead

HTTPS adds minimal overhead:
- **Connection establishment:** +50-100ms first request (TLS handshake)
- **Per-request:** Negligible (< 1ms for encryption/decryption)
- **With HTTP/2:** Connection reused, minimal overhead

Railway's load balancer handles TLS termination, so the app doesn't pay the computational cost.

### Redirect Performance

The 301 redirect adds one extra round-trip:
- **Without caching:** User makes 2 requests (HTTP → HTTPS)
- **With HSTS caching:** Browser skips HTTP, goes straight to HTTPS (no extra request)
- **Recommendation:** Add to HSTS preload for maximum performance

---

## Related Documentation

- **RAILWAY_SECRETS.md** — Environment variable configuration
- **DEPLOYMENT_CHECKLIST.md** — Deployment validation procedures
- **CLAUDE.md** — Security best practices and code review standards

---

## External References

- Let's Encrypt: https://letsencrypt.org/
- HSTS (RFC 6797): https://tools.ietf.org/html/rfc6797
- HSTS Preload: https://hstspreload.org/
- Mozilla Web Security: https://infosec.mozilla.org/guidelines/web_security

---

**Last Updated:** 2026-06-29  
**Next Review:** Before HSTS preload submission  
**Maintained by:** DevOps / Security team

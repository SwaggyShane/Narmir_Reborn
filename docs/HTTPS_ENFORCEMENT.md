# HTTPS Enforcement & TLS Configuration

Production deployment guide for secure HTTPS connections.

## Overview

HTTPS is mandatory in production to protect:
- User authentication credentials
- Session tokens and cookies
- API request/response data
- User location and activity patterns

## Automatic HTTPS Enforcement

### HTTP to HTTPS Redirect

In production (`NODE_ENV=production`), all HTTP requests are automatically redirected to HTTPS with a 301 permanent redirect:

```
Client: GET http://example.com/api/game
Server: 301 Moved Permanently
        Location: https://example.com/api/game
```

This redirect is applied **before** any other middleware, ensuring:
- No credentials are sent over HTTP
- Optimal performance (permanent redirect cached by browsers)
- Consistent security across all endpoints

### HSTS (HTTP Strict-Transport-Security)

All HTTPS responses include the HSTS header:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Effects:**
- `max-age=31536000` — 1 year of HSTS enforcement
- `includeSubDomains` — All subdomains must use HTTPS
- `preload` — Eligible for HSTS preload list (prevents even the first HTTP request)

**Benefits:**
- Browsers refuse to load over HTTP for 1 year
- Prevents downgrade attacks (MITM forcing HTTP)
- Eliminates need for redirect on subsequent visits
- Protects against active network attacks

## TLS/SSL Configuration

### Railway

Railway automatically:
- Provisions free TLS certificates (Let's Encrypt)
- Handles certificate renewal
- Enforces HTTPS at the edge (before reaching your app)
- Redirects HTTP to HTTPS

**No configuration needed** — Railway handles all TLS setup.

### Local Development

Local development uses HTTP (NODE_ENV != production):
- No HTTPS redirect
- No HSTS header
- Simpler development setup

To test HTTPS locally:
```bash
NODE_ENV=production npm start
# Will require HTTPS or handle redirects
```

## Security Headers Summary

All production responses include:

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | max-age=31536000; includeSubDomains; preload | Force HTTPS |
| `X-Content-Type-Options` | nosniff | Prevent MIME sniffing |
| `X-Frame-Options` | DENY | Prevent clickjacking |
| `Referrer-Policy` | same-origin | Limit referrer leakage |
| `Permissions-Policy` | camera=(), microphone=(), ... | Disable dangerous APIs |
| `Content-Security-Policy` | ... | Prevent XSS and injections |
| `Cross-Origin-Opener-Policy` | same-origin | Prevent cross-origin popups |

## HSTS Preload List

The HSTS preload list is a hardcoded list in browsers of domains that require HTTPS.

### Adding to Preload List

1. Ensure HSTS header includes `preload` directive ✅ (already done)
2. Domain must be registered and have valid certificate ✅ (Railway)
3. Submit to [hstspreload.org](https://hstspreload.org)
   - Verify domain ownership
   - Allow 2-6 weeks for processing
   - Takes 2-4 browser releases to include

**Benefits:**
- Even first visit uses HTTPS (no redirect)
- Extreme protection against downgrade attacks
- Shows up as "Preloaded" in browser security info

## Configuration

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | development | Controls HTTPS enforcement |

### Code

HTTPS enforcement is automatic based on `NODE_ENV`:
- Production: Enforced
- Development: Disabled

No additional configuration needed.

## Troubleshooting

### Mixed Content Warnings

**Error:** "This page contains insecure resources"

**Cause:** Page loaded over HTTPS but contains HTTP resources

**Fix:** Update resource URLs to use HTTPS:
```javascript
// ❌ Wrong
const url = 'http://api.example.com/resource';

// ✅ Correct
const url = 'https://api.example.com/resource';
```

### Certificate Errors

**Error:** "Your connection is not secure" / "NET::ERR_CERT_INVALID"

**Cause:** TLS certificate issues

**Fix on Railway:**
1. Verify custom domain is configured
2. Check Railway dashboard for certificate status
3. Ensure DNS records point to Railway
4. Wait up to 30 minutes for certificate provisioning

**Local development:**
1. Set NODE_ENV to "development" (HTTP OK)
2. Or accept the self-signed certificate warning

### HSTS Errors

**Error:** "HSTS policy error" / "Insecure connection refused"

**Cause:** Browser cached HSTS policy for domain

**Fix:**
1. Clear site data: Settings → Security → Clear Browsing Data → "Cookies and other site data"
2. Or use private/incognito window
3. Wait for HSTS max-age to expire (1 year)

### Redirect Loops

**Error:** "Too many redirects"

**Cause:** Reverse proxy or load balancer not properly detecting HTTPS

**Fix on Railway:**
1. Railway handles this automatically
2. App sees `req.secure = true` for HTTPS requests
3. If using custom proxy, ensure `X-Forwarded-Proto: https` is set

## Testing

### Verify HTTPS Enforcement

```bash
# Should redirect
curl -i http://narmirreborn.com/api/auth/me
# Expected: 301 Moved Permanently
#          Location: https://narmirreborn.com/api/auth/me

# Should return 401 (valid HTTPS)
curl -i https://narmirreborn.com/api/auth/me
# Expected: 401 Unauthorized (correct behavior - no token)
```

### Check Security Headers

```bash
curl -I https://narmirreborn.com/

# Expected headers:
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Content-Security-Policy: ...
```

### Verify Certificate

```bash
# Check certificate details
openssl s_client -connect narmirreborn.com:443

# Should show:
# - Subject: CN = narmirreborn.com
# - Issuer: Let's Encrypt
# - Not expired
```

## Performance Implications

### Positive

- HTTPS has similar performance to HTTP (TLS 1.3)
- HTTP/2 multiplexing over HTTPS improves performance
- Browsers prefer HTTPS-first
- Connection pooling works over TLS

### Optimization

Railway and modern CDNs already optimize:
- TLS session resumption
- Certificate compression
- Connection keep-alive
- Early Hints (early data)

No additional tuning needed.

## Compliance

### Standards Met

- ✅ NIST SP 800-52 Rev. 2 (TLS 1.2+)
- ✅ PCI DSS 3.2.1 (TLS 1.2 or higher)
- ✅ OWASP Top 10 A05 (Broken Access Control)
- ✅ CWE-295 (Improper Certificate Validation)

### Browser Compatibility

- ✅ All modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ TLS 1.2 / TLS 1.3
- ✅ Modern cipher suites (Railway provides)

## Further Reading

- [OWASP: Transport Layer Protection](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)
- [Mozilla: Web Security](https://infosec.mozilla.org/)
- [HSTS Preload List](https://hstspreload.org)
- [Railway: Custom Domains](https://docs.railway.app/guides/custom-domain)

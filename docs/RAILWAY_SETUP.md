# Railway Deployment Configuration

Complete guide for deploying Narmir Reborn on Railway.

## Quick Start

1. [Sign up for Railway](https://railway.app)
2. Connect your GitHub repository
3. Set up PostgreSQL database
4. Configure environment variables (see below)
5. Deploy

## Environment Variables

### Required Secrets

All of these MUST be configured before the server will start:

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for signing JWT tokens (min 32 chars) | `your-super-secret-key-min-32-characters` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/narmir` |
| `CORS_ORIGIN` | Frontend URL for CORS | `https://narmirreborn.com` |
| `ADMIN_SECRET` | Secret for admin endpoints (min 16 chars) | `your-admin-secret-key` |

### Optional Secrets

| Variable | Description |
|----------|-------------|
| `CONFIRM_SECRET` | Secret for email confirmation tokens (min 16 chars) |
| `DISCORD_BOT_TOKEN` | Discord bot token for integrations |
| `DISCORD_UPDATES_CHANNEL_ID` | Channel ID for changelog updates |
| `DISCORD_BUG_REPORTS_CHANNEL_ID` | Channel ID for bug reports |
| `DISCORD_UPDATES_WEBHOOK_URL` | Webhook URL for updates channel |
| `DISCORD_BUG_REPORTS_WEBHOOK_URL` | Webhook URL for bug reports channel |
| `ADMIN_ALLOWED_IPS` | Comma-separated list of IPs allowed to access `/api/admin` |

### Production Settings

| Variable | Value | Note |
|----------|-------|------|
| `NODE_ENV` | `production` | Controls logging, CORS, and error handling |

## Setting Up on Railway

### 1. Create a PostgreSQL Service

1. Click **+ New** → **Database** → **PostgreSQL**
2. Railway automatically configures `DATABASE_URL`
3. Note the connection details for backups

### 2. Configure Web Service

1. Go to your **Web** service settings
2. Click **Environment** tab
3. Add variables from the "Required Secrets" table above
4. For `JWT_SECRET` and `ADMIN_SECRET`, generate strong random values:

```bash
# Generate a strong random secret
openssl rand -hex 32
```

### 3. Add Discord Integration (Optional)

1. Create a Discord bot on [Discord Developer Portal](https://discord.com/developers/applications)
2. Copy the bot token
3. In Railway, set `DISCORD_BOT_TOKEN` to the token
4. Set `DISCORD_UPDATES_CHANNEL_ID` and `DISCORD_BUG_REPORTS_CHANNEL_ID` (get from Discord)

### 4. Configure Admin IP Access (Optional)

To restrict admin endpoint access:

1. Find your admin IP(s) — these are the IPs from which you'll access admin endpoints
2. Set `ADMIN_ALLOWED_IPS` to comma-separated list:
   ```
   203.0.113.42,192.0.2.100,198.51.100.5
   ```
3. If not set, admin endpoints are accessible from any IP (but rate-limited)

## Railway Environment Detection

The server automatically detects Railway deployments via:
- `RAILWAY_ENVIRONMENT_NAME` — Environment name (e.g., "Production")
- `RAILWAY_SERVICE_NAME` — Service name (e.g., "web")
- `RAILWAY_PRIVATE_DOMAIN` — Internal domain for inter-service communication

Logged at startup: `[boot] Running on Railway: Production (web)`

## Verifying Secrets

The server validates all required secrets on startup:

```
[secrets] ✅ All required secrets configured
```

If any secrets are missing:

```
[secrets] Configuration errors:
  ❌ JWT_SECRET: Secret key for JWT token signing (REQUIRED)
  ❌ DATABASE_URL: PostgreSQL database connection string (REQUIRED)
[secrets] ❌ Server startup blocked due to missing secrets
[secrets] Copy .env.example to .env and fill in all required values
```

## Database Backups

### Automatic Backups

Railway automatically backs up PostgreSQL databases. To restore:

1. Go to your **PostgreSQL** service
2. Click **Backups** tab
3. Restore a backup to a new database or the existing one

### Manual Backups

```bash
# Backup to local file
pg_dump $DATABASE_URL > narmir_backup.sql

# Restore from file
psql $DATABASE_URL < narmir_backup.sql
```

## Rate Limiting & DDoS Protection

### Configured Limits

- **Auth endpoints** (login/register): 10 requests/min per IP
- **Gameplay endpoints**: 300 requests/min per IP
- **General endpoints**: 500 requests/min per IP
- **Admin endpoints**: 30 requests/min per IP
- **Max payload size**: 1 MB (JSON + URL-encoded)

### Socket.IO Timeouts

- Ping interval: 25 seconds
- Ping timeout: 60 seconds
- Max buffer size: 1 MB per message

### HTTP Timeouts

- Headers timeout: 70 seconds
- Request timeout: 75 seconds
- Keep-alive timeout: 65 seconds

These prevent slowloris attacks and connection exhaustion.

## Health Checks

To verify the server is running:

```bash
curl https://narmirreborn.com/api/auth/me
# Expected: 401 Not authenticated (or logged-in user if authenticated)

curl https://narmirreborn.com/portal
# Expected: 200 OK with portal HTML

curl https://narmirreborn.com/game
# Expected: 200 OK with game entry point
```

## Troubleshooting

### Secrets Missing Error

**Error:** `[secrets] ❌ Server startup blocked due to missing secrets`

**Fix:** Go to Railway → Web service → Environment → add all required variables from the table above

### Database Connection Error

**Error:** `[db] ❌ DATABASE ERROR: Server starting up in OFFLINE/ERROR state`

**Fix:**
1. Verify `DATABASE_URL` is correct (format: `postgresql://user:pass@host:port/db`)
2. Check PostgreSQL service is running (Railway dashboard)
3. Verify network connectivity between web and database services

### Rate Limit Hits

**Error:** 429 Too Many Requests

**Fix:**
- If from known IPs, check rate limit configuration
- If unexpected, may indicate a DoS attack — check logs and IP patterns
- Adjust `ADMIN_ALLOWED_IPS` if admin endpoints are being blocked

### High Memory Usage

**Fix:**
- Check rate limiter memory (stores per-IP hit timestamps)
- Limiter automatically prunes old entries every `windowMs` (1 minute default)
- Monitor with: `ps aux | grep node`

## Production Checklist

Before going live:

- [ ] `JWT_SECRET` set to strong random value (32+ chars)
- [ ] `DATABASE_URL` points to production PostgreSQL
- [ ] `CORS_ORIGIN` set to your frontend domain
- [ ] `ADMIN_SECRET` set to strong random value (16+ chars)
- [ ] `NODE_ENV` set to `production`
- [ ] Discord bot token configured (if using Discord integrations)
- [ ] Database backups enabled in Railway
- [ ] Admin IP allowlist configured (if needed)
- [ ] Health checks passing (see above)
- [ ] SSL/TLS certificate active (Railway provides automatic)
- [ ] Logs reviewed for startup errors

## Further Reading

- [Railway Documentation](https://docs.railway.app)
- [PostgreSQL on Railway](https://docs.railway.app/databases/postgresql)
- [Environment Variables](https://docs.railway.app/reference/environment-variables)
- [Deploying Node.js](https://docs.railway.app/getting-started)

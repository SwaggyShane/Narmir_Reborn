# Railway Secrets & Environment Configuration

**Purpose:** Guide for securely managing Narmir Reborn secrets in Railway production environment  
**Audience:** DevOps engineers, deployment leads  
**Last Updated:** 2026-06-29

---

## Overview

Narmir Reborn uses Railway's environment variable system to manage production secrets. All sensitive configuration (database credentials, JWT secrets, API keys) must be set via Railway's dashboard, **never** committed to `.env` files in the repository.

### Key Principles

✅ **DO:**
- Store all secrets in Railway Variables (dashboard UI)
- Use Railway's auto-generated DATABASE_URL for PostgreSQL
- Rotate secrets regularly (JWT_SECRET, ADMIN_SECRET, CONFIRM_SECRET)
- Use strong, randomly generated secrets (minimum 32 characters for JWT_SECRET)
- Keep `.env` in `.gitignore` (never commit production secrets)

❌ **DON'T:**
- Commit `.env` with production secrets to GitHub
- Hardcode secrets in code
- Use default/demo values in production
- Reuse secrets across environments
- Share production DATABASE_URL via email

---

## Required Secrets

### Tier 1: Critical (Server Won't Start Without These)

| Variable | Format | Example | Purpose |
|----------|--------|---------|---------|
| `JWT_SECRET` | String, 32+ chars | `your-random-string-min-32-characters-long` | JWT token signing & verification |
| `DATABASE_URL` | PostgreSQL URL | `postgresql://user:pass@host:5432/dbname` | PostgreSQL connection string |

### Tier 2: Production Required

| Variable | Format | Example | Purpose |
|----------|--------|---------|---------|
| `CORS_ORIGIN` | HTTPS URL | `https://narmirreborn.com` | Frontend origin for CORS (required in production) |
| `NODE_ENV` | Literal | `production` | Server mode (auto-detected on Railway) |

### Tier 3: Strongly Recommended

| Variable | Format | Example | Purpose |
|----------|--------|---------|---------|
| `ADMIN_SECRET` | String, 16+ chars | `strong-admin-secret-min-16-chars` | Admin endpoint authentication |
| `CONFIRM_SECRET` | String, 16+ chars | `confirm-token-secret-min-16-chars` | Email confirmation token signing |

### Tier 4: Optional

| Variable | Format | Example | Purpose |
|----------|--------|---------|---------|
| `DISCORD_BOT_TOKEN` | Discord token | `MTk4NjIyNDgzNTEwNDg4OTcx...` | Discord integration (if enabled) |
| `DISCORD_UPDATES_CHANNEL_ID` | Numeric ID | `123456789` | Discord channel for update announcements |
| `DISCORD_BUG_REPORTS_CHANNEL_ID` | Numeric ID | `987654321` | Discord channel for bug reports |
| `ADMIN_ALLOWED_IPS` | Comma-separated IPs | `203.0.113.42,192.0.2.100` | Whitelist IPs for admin endpoints |

---

## Railway Database Setup

### Automatic PostgreSQL Database

Railway simplifies database management. When you add PostgreSQL to your Railway project:

1. **Railway auto-generates DATABASE_URL** with the format:
   ```
   postgresql://[user]:[password]@[host].railway.internal:5432/[database]
   ```

2. **Auto-injected into Variables** — You don't manually set DATABASE_URL; Railway provides it

3. **SSL auto-enabled** for connections outside Railway (internal .railway.internal connections use cleartext)

### Verifying Database Connection

After Railway deploys:

```bash
# Option 1: Check Railway dashboard
# Navigate to PostgreSQL service → Logs
# Look for "ready to accept connections"

# Option 2: Test via Railway CLI
railway psql
# This opens a psql shell to your production database
```

If DATABASE_URL is not appearing in your Variables tab, re-link your PostgreSQL service:
1. Go to your Web service
2. Click "Dependencies" or "Plugins"
3. Add PostgreSQL if not already linked
4. Railway will re-generate DATABASE_URL

---

## Step-by-Step: Configure Railway Secrets

### Step 1: Create Railway Project

1. Go to https://railway.app
2. Click "New Project"
3. Choose "GitHub Repo"
4. Select `SwaggyShane/Narmir_Reborn`
5. Click "Deploy"

### Step 2: Add PostgreSQL Database

1. In your Railway project, click "Add Service"
2. Select "PostgreSQL"
3. Wait for provisioning (usually 1-2 minutes)
4. **Do NOT manually set DATABASE_URL** — Railway provides it automatically

### Step 3: Set Critical Secrets (Web Service Variables)

1. Click on your Web service (should be named `web` or similar)
2. Go to the "Variables" tab
3. Add the following:

#### JWT_SECRET
- **Name:** `JWT_SECRET`
- **Value:** Generate a strong random string (32+ chars)
  ```bash
  # On your local machine:
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  # Copy the output into Railway
  ```

#### CORS_ORIGIN
- **Name:** `CORS_ORIGIN`
- **Value:** `https://narmirreborn.com` (your production frontend domain)

#### ADMIN_SECRET
- **Name:** `ADMIN_SECRET`
- **Value:** Generate another strong random string (16+ chars)
  ```bash
  node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
  ```

#### CONFIRM_SECRET
- **Name:** `CONFIRM_SECRET`
- **Value:** Generate another strong random string (16+ chars)
  ```bash
  node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
  ```

#### NODE_ENV (Optional — Auto-Set by Railway)
- **Name:** `NODE_ENV`
- **Value:** `production`
- **Note:** Railway auto-sets this to the environment name ("Production"), but we canonicalize it in index.js line 8

#### DISCORD_BOT_TOKEN (If Using Discord Integration)
- **Name:** `DISCORD_BOT_TOKEN`
- **Value:** Your Discord bot token (obtain from https://discord.com/developers/applications)

#### DISCORD_UPDATES_CHANNEL_ID (If Using Discord)
- **Name:** `DISCORD_UPDATES_CHANNEL_ID`
- **Value:** Channel ID as a string (e.g., `"1234567890"`)
- **Note:** Get this from Discord: Enable "Developer Mode" → right-click channel → "Copy channel ID"

#### ADMIN_ALLOWED_IPS (If Restricting Admin Access)
- **Name:** `ADMIN_ALLOWED_IPS`
- **Value:** Comma-separated IPs (e.g., `203.0.113.42,192.0.2.100`)
- **Note:** Optional; only set if you want to IP-restrict admin endpoints

### Step 4: Verify DATABASE_URL is Present

1. Still in Variables tab
2. Scroll down — you should see `DATABASE_URL` (auto-set by Railway)
3. **Do NOT edit or delete it**
4. If missing:
   - Go to PostgreSQL service → Links
   - Click "Link to service"
   - Select your Web service
   - Railway re-generates DATABASE_URL

### Step 5: Deploy

1. Click the deploy button or push a commit to main
2. Watch the deployment logs for:
   ```
   [secrets] ✅ All required secrets configured
   [db] ✅ PostgreSQL connected successfully
   ```

3. If you see `[secrets] ❌ Server startup blocked due to missing secrets`:
   - Check Variables tab — missing required variable
   - Add it and redeploy

---

## Secret Rotation

### When to Rotate

- **JWT_SECRET:** After any suspected compromise, or annually
- **ADMIN_SECRET:** When admin team changes, or annually
- **CONFIRM_SECRET:** When GDPR/privacy audit requires it
- **DATABASE_URL:** When security audit mandates password change

### How to Rotate

1. Generate new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. In Railway dashboard:
   - Select Web service → Variables
   - Click the secret you're rotating
   - Replace value with new one
   - Save

3. Railway auto-redeploys
   - Existing JWT tokens remain valid (they were signed with old secret)
   - New tokens will use new secret
   - Old tokens will fail verification after 24 hours (when they expire)

4. **DATABASE_URL rotation requires extra caution:**
   - Backup production database first
   - Change PostgreSQL password in Railway PostgreSQL service settings
   - Copy new DATABASE_URL from Variables
   - Test connection via Railway CLI before pushing

---

## Common Issues & Troubleshooting

### Issue: "JWT_SECRET is not set"

**Symptoms:** Deployment fails with `[secrets] ❌ Server startup blocked due to missing secrets`

**Solution:**
1. Go to Railway dashboard → Web service → Variables
2. Add `JWT_SECRET` with a strong random value (32+ chars)
3. Redeploy (push a commit or use Deploy button)

### Issue: "DATABASE_URL not found" or "Connection refused"

**Symptoms:** App starts but crashes when trying to query database

**Solution:**
1. Check PostgreSQL service is running (should have green status)
2. Verify PostgreSQL is linked to Web service:
   - Click Web service → Dependencies
   - PostgreSQL should be listed
3. Check Variables — `DATABASE_URL` should be present
4. If missing:
   - Unlink PostgreSQL
   - Re-add PostgreSQL service
   - Railway regenerates DATABASE_URL
5. Redeploy

### Issue: "CORS_ORIGIN mismatch" or frontend can't connect

**Symptoms:** Frontend gets CORS error, can't reach API

**Solution:**
1. Verify `CORS_ORIGIN` in Variables matches your frontend domain
2. Should be `https://narmirreborn.com` (exact match, including protocol)
3. If changing domains:
   - Update CORS_ORIGIN
   - Redeploy
   - Clear browser cache (frontend may cache the old origin)

### Issue: Admin endpoints return 403 "Unauthorized"

**Symptoms:** Requests to admin endpoints fail despite correct admin-secret header

**Solution:**
1. Verify `ADMIN_SECRET` is set in Variables
2. Verify the request includes: `Authorization: Bearer <admin-secret-value>`
3. If secrets recently rotated, old values won't work
4. Regenerate and redeploy

### Issue: Deployment logs show warnings about short JWT_SECRET

**Symptoms:** Server starts but logs: `⚠️ JWT_SECRET: Short secret detected`

**Solution:**
- Acceptable for development, but production requires 32+ characters
- Regenerate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Update in Railway Variables
- Redeploy

---

## Local Development (`.env`)

For local development, use `.env` with dev values:

```bash
# Copy template to local .env
cp .env.example .env

# Edit .env with local values (dev database, short secrets OK)
JWT_SECRET="dev-secret-32-chars-minimum-ok"
DATABASE_URL="postgresql://postgres:smoke@localhost/narmir_smoke"
CORS_ORIGIN="http://localhost:5173"
NODE_ENV="development"
```

**Important:** Never commit `.env` to Git. It's in `.gitignore` for a reason.

---

## Security Best Practices

### 1. Use Strong Secrets

- Minimum 32 characters for JWT_SECRET
- Use cryptographic randomness (`node crypto.randomBytes()`)
- Avoid dictionary words, names, or patterns

### 2. Rotate Regularly

- Set a calendar reminder to rotate secrets annually
- Rotate immediately after suspected compromise
- Rotate when team members with access leave

### 3. Limit Who Can See Secrets

- Only authorized DevOps engineers should access Railway dashboard
- Use Railway organization roles (Admin, Developer, Viewer)
- Audit access via Railway audit logs

### 4. Monitor Secret Usage

- Check Railway logs for failed auth attempts
- Watch for suspicious queries in PostgreSQL logs
- Alert if ADMIN_SECRET is used from unexpected IPs

### 5. Avoid Logging Secrets

- SecretsManager.sanitizeForLogging() redacts secrets before logging
- Never paste DATABASE_URL or JWT_SECRET in logs/documentation
- Check Railway logs to ensure secrets aren't exposed

### 6. Backup DATABASE_URL

- Store Railway DATABASE_URL in secure location (e.g., 1Password, Vault)
- If lost, regenerate via PostgreSQL password reset
- Test restoration procedure quarterly

---

## Automation & CI/CD

### GitHub Actions Integration

If using GitHub Actions for deployment:

1. **Do NOT store secrets in GitHub Secrets** (they won't reach Railway)
2. **Use Railway's deployment token:**
   - Go to Railway Account → Tokens
   - Generate deployment token
   - Store in GitHub Secrets as `RAILWAY_TOKEN`
3. **GitHub Actions workflow should:**
   ```yaml
   - name: Deploy to Railway
     uses: railway-app/cli-action@v1
     with:
       token: ${{ secrets.RAILWAY_TOKEN }}
       service: web
   ```

### Railway Auto-Deploy from GitHub

Railway's default: Auto-deploy on push to main

- No manual intervention needed
- Railway reads Variables from dashboard
- All secrets already in Railway — GitHub never sees them

---

## Verification Checklist

Before considering deployment production-ready:

- [ ] JWT_SECRET set (32+ chars, strong random)
- [ ] DATABASE_URL present and linked to PostgreSQL
- [ ] CORS_ORIGIN set to production frontend domain
- [ ] ADMIN_SECRET set (16+ chars, strong random)
- [ ] CONFIRM_SECRET set (16+ chars, strong random)
- [ ] NODE_ENV = "production" (auto-set by Railway)
- [ ] PostgreSQL service running and linked
- [ ] Deployment logs show "All required secrets configured"
- [ ] Deployment logs show "PostgreSQL connected successfully"
- [ ] Test API endpoints return 200 OK
- [ ] Test admin endpoints require authorization
- [ ] Secrets are NOT in `.env` file in Git
- [ ] All logs are free of secret exposure

---

## Reference

**Related Documents:**
- `.env.railway` — Template showing all environment variables
- `utils/secrets.js` — SecretsManager validation code
- `DEPLOYMENT_CHECKLIST.md` — Step-by-step deployment guide
- `CLAUDE.md` — Git workflow and commit practices

**External Links:**
- Railway Docs: https://docs.railway.app/
- Railway Variables: https://docs.railway.app/develop/variables
- PostgreSQL Connection Strings: https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING

---

**Last Updated:** 2026-06-29  
**Next Review:** Before next Railway deployment  
**Maintained by:** DevOps / Deployment team

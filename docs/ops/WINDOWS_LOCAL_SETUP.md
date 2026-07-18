# Narmir Reborn - Windows Local Development Setup

Complete guide to set up Narmir Reborn locally on Windows with PostgreSQL.

## Prerequisites
- Windows 10/11 (any version)
- Administrator access to install software
- ~2GB free disk space
- Internet connection

---

## Step 1: Install Node.js

Node.js is required to run the server. We'll install a compatible version.

### Download & Install

1. **Go to:** https://nodejs.org/
2. **Download:** LTS version (currently 22.x - matches project requirement)
3. **Run the installer:**
   - Accept license
   - Choose installation path (default is fine: `C:\Program Files\nodejs\`)
   - Check "Add to PATH" ✓
   - Install NPM checksum tool ✓
   - Click "Install"
   - Allow admin access when prompted

### Verify Installation

Open **Command Prompt** (Win+R, type `cmd`, press Enter):

```cmd
node --version
npm --version
```

Expected output:
```
v22.x.x (or higher)
9.x.x (or higher)
```

If these commands don't work, restart your computer and try again.

---

## Step 2: Install PostgreSQL

PostgreSQL is the database matching production.

### Download & Install

1. **Go to:** https://www.postgresql.org/download/windows/
2. **Download:** Latest stable version (15 or 16)
3. **Run installer:**
   - Accept license
   - Installation directory: `C:\Program Files\PostgreSQL\16\` (default)
   - Uncheck "Stack Builder" at the end (we don't need it)

### Configuration During Install

When prompted:

| Setting | Value |
|---------|-------|
| **Port** | `5432` (default) |
| **Superuser** | `postgres` |
| **Password** | `postgres` (for local dev - use something you remember) |
| **Data Directory** | `C:\Program Files\PostgreSQL\16\data` (default) |

### Verify Installation

Open **Command Prompt:**

```cmd
psql --version
```

Expected output: `psql (PostgreSQL) 16.x`

---

## Step 3: Clone the Repository

You need Git to clone the repository. If you don't have it installed:

1. **Go to:** https://git-scm.com/download/win
2. **Download & Install:** Use all default settings

Then clone the project:

```cmd
# Open Command Prompt and navigate to where you want the project
# For example:
cd C:\Users\YourName\projects

# Clone the repository
git clone https://github.com/SwaggyShane/Narmir_Reborn.git

# Navigate into the project
cd Narmir_Reborn
```

---

## Step 4: Create Local Database

PostgreSQL is running, now we'll create the database.

### Open PostgreSQL Command Line

```cmd
psql -U postgres
```

When prompted for password, enter: `postgres`

You should see the prompt: `postgres=#`

### Create Database & User

Copy and paste these commands into the PostgreSQL prompt:

```sql
-- Create a database for local development
CREATE DATABASE narmir_local;

-- Create a user for the application
CREATE USER narmir_dev WITH PASSWORD 'narmir_local_dev';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE narmir_local TO narmir_dev;
GRANT ALL PRIVILEGES ON SCHEMA public TO narmir_dev;

-- Verify creation
\l
```

You should see `narmir_local` in the list of databases.

Exit PostgreSQL:
```sql
\q
```

---

## Step 5: Set Up Environment Configuration

The project needs environment variables to know how to connect to the database.

### Create `.env` File

In your `Narmir_Reborn` folder, create a new file named `.env`:

**File:** `C:\Users\YourName\projects\Narmir_Reborn\.env`

**Content:**
```
# Database Connection
DATABASE_URL=postgresql://narmir_dev:narmir_local_dev@localhost:5432/narmir_local

# Server
PORT=3000
NODE_ENV=development

# Discord Bot (optional - leave blank for testing)
DISCORD_TOKEN=

# JWT Secret (generate a random string)
JWT_SECRET=narmir_local_dev_secret_key_123

# Environment
ENVIRONMENT=local
```

**Save the file** with UTF-8 encoding (not ANSI).

---

## Step 6: Install Project Dependencies

Open **Command Prompt** in your project folder:

```cmd
cd C:\Users\YourName\projects\Narmir_Reborn

# Install all dependencies
npm install
```

This will download ~500MB of packages. It may take 5-10 minutes.

Expected output at the end:
```
added X packages, and audited X packages in XXs
```

---

## Step 7: Initialize Database Schema

The project includes a schema script that will create all tables.

```cmd
# This runs the schema initialization
node db/init-schema.js
```

If this fails, check:
1. PostgreSQL is running
2. `.env` file has correct DATABASE_URL
3. Database `narmir_local` exists

---

## Step 8: Start the Local Server

```cmd
# Start the development server
npm run dev
```

Expected output:
```
Server running on port 3000
Database connected successfully
```

Open your browser and go to: **http://localhost:3000**

You should see the Narmir Reborn login page.

---

## Step 9: Verify Everything Works

### Test 1: Access the Web Interface
- Go to http://localhost:3000
- You should see the login page ✓

### Test 2: Create an Account
- Click "Sign Up"
- Create a test account
- Log in ✓

### Test 3: Check Database
Open PostgreSQL to verify data is being stored:

```cmd
psql -U narmir_dev -d narmir_local

-- List tables
\dt

-- Check kingdoms table
SELECT COUNT(*) FROM kingdoms;

\q
```

---

## Pre-Commit Smoke Test (Windows)

Run this before every commit (also documented in `Claude.md`). It must be a **fresh server boot** with a confirmed DB connection — not curls against a server that has been running for hours.

### One-time: optional isolated smoke database

`narmir_dev` cannot create databases. To use a separate `narmir_smoke` DB (like Linux CI), run once as the postgres superuser in pgAdmin or:

```cmd
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres
```

```sql
CREATE DATABASE narmir_smoke;
GRANT ALL PRIVILEGES ON DATABASE narmir_smoke TO narmir_dev;
\c narmir_smoke
GRANT ALL ON SCHEMA public TO narmir_dev;
\q
```

After that, point smoke tests at `narmir_smoke` instead of `narmir_local`.

### Every commit: baseline smoke (PowerShell)

From the project root, with PostgreSQL running:

```powershell
# 1. Stop anything on port 3000
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

# 2. Start fresh server using .env credentials
$env:DATABASE_URL = "postgresql://narmir_dev:narmir_local_dev@localhost:5432/narmir_local"
$env:JWT_SECRET   = "narmir_local_dev_secret_key_123"
$env:NODE_ENV     = "development"
node index.js
```

Wait for boot log: **`[db] ✅ PostgreSQL connected successfully!`** and **`Server listening on http://localhost:3000`**.

Open a **second** PowerShell window for checks (use `curl.exe`, not `curl`):

```powershell
curl.exe -s http://localhost:3000/api/forum/boards | Select-String "General"    # expect match
curl.exe -s http://localhost:3000/api/auth/me | Select-String "Not authenticated" # expect match
curl.exe -s http://localhost:3000/portal | Select-String "portal-root"           # expect match
curl.exe -s http://localhost:3000/game | Select-String "main.jsx"                # expect match
```

Stop the smoke server with `Ctrl+C` in the first window, or:

```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
```

### What does NOT count as smoke

- Curling `localhost:3000` while `npm run dev` has been up for a long time, without confirming a fresh boot
- Using `postgres:smoke@localhost/narmir_smoke` — that user/password is not configured on a standard Windows install
- A server boot log showing `password authentication failed` or `OFFLINE/ERROR state`

---

## Useful Commands

### Start the Server
```cmd
npm run dev
```

### Run Linter
```cmd
npm run lint
```

### Run Tests
```cmd
npm test
```

### Stop the Server
Press `Ctrl+C` in Command Prompt

### Access PostgreSQL
```cmd
psql -U narmir_dev -d narmir_local
```

### Reset Database (⚠️ Deletes all data)
```cmd
psql -U postgres

DROP DATABASE narmir_local;
CREATE DATABASE narmir_local;
GRANT ALL PRIVILEGES ON DATABASE narmir_local TO narmir_dev;
\q

node db/init-schema.js
```

---

## Troubleshooting

### "Port 3000 is already in use"
Another application is using port 3000. Either:
- Close the other application, or
- Change PORT in `.env` to `3001` and restart

### "Database connection failed"
Check:
1. PostgreSQL is running (check Windows Services)
2. `.env` DATABASE_URL is correct
3. Database and user exist: `psql -U postgres` → `\l`

### "npm install fails"
- Restart Command Prompt
- Try: `npm cache clean --force`
- Then: `npm install` again

### "node command not found"
Restart Command Prompt or computer after Node.js installation.

### PostgreSQL won't start
- Check Windows Services (Services.msc)
- Look for "postgresql-x64-16"
- If stopped, right-click → Start

---

## Next Steps

Once the server is running locally:

1. **Test the Combat System:**
   ```cmd
   npm run lint    # Should show 0 errors
   ```

2. **Run Tests:**
   ```cmd
   node test/combat-comparative.test.js
   ```

3. **Push Combat Changes:**
   - Create new branches as needed
   - Test locally before pushing to production

4. **Monitor the Server:**
   - Keep the terminal open to see logs
   - Logs show database queries, errors, etc.

---

## Production vs Local

| Aspect | Production (Railway) | Local (Your PC) |
|--------|----------------------|-----------------|
| **URL** | https://narmirreborn.com | http://localhost:3000 |
| **Database** | Production PostgreSQL | Local PostgreSQL |
| **Data** | Live game data | Test data |
| **Speed** | Network latency | Instant (local) |
| **Safety** | Live/critical | Safe to experiment |

Use local for testing, production for live.

---

## Support

If you get stuck:
1. Check the Troubleshooting section above
2. Verify each step completed successfully
3. Check that all services are running

Good luck! 🚀

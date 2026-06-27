# Claude Code Workflow Guide

## PR Workflow

### Before Every Push — No Exceptions
#### DO NOT TAKE THE PATH OF LEAST RESISTANCEE
1. Confirm you are on the correct branch:
   ```bash
   git branch --show-current
   # Must match the designated feature branch. If wrong, stop and ask.
   ```

2. Confirm there are commits to push:
   ```bash
   git fetch origin main
   git log --oneline origin/main..HEAD
   # If 0 commits, nothing to push. Do not push.
   ```

3. Check for an existing open PR on this branch before creating a new one:
   ```bash
   # Via GitHub MCP tool — run mcp__github__list_pull_requests with:
   # owner: swaggyshane, repo: narmir_reborn, head: <branch>, state: open
   ```
   - If an open PR exists: push to it, no new PR needed.
   - If no open PR exists (previous one was merged or never created): open a new draft PR **immediately after the push**. Do not wait for the user to notice.
   - "I forgot to check" is not valid. Run this before every push. No exceptions.

### Always Create PRs as Drafts

Always create PRs with `draft: true`. No exceptions.

### Workflow Steps
1. Make code changes on feature branch
2. Run quality checks (lint → smoke → sanity) — see below
3. Stage and commit: `git add <files>` → `git commit -m "..."`
4. Confirm branch and commits (see above)
5. Push: `git push -u origin <branch>`
6. Create or update draft PR
7. Address review feedback with new commits
8. Merge to main only after review approval

---

## Quality Checks — Required Before Every Commit

Run all three. In order. Every time. **Exception: Documentation-only changes (*.md files only) skip lint + smoke tests — commit directly after sanity check.**

### 1. Lint

```bash
npm run lint
```

- **0 errors** required. The pre-commit hook enforces this mechanically.
- Warnings must be individually justified in the commit message or fixed outright.
- Do not let warning count grow. If a warning existed before your change, note it. If you introduced it, fix it.

#### ⚠️ Lint Warnings — No Benign Debt

**Nothing is benign.** ESLint warnings compound into maintenance friction and mask real issues.

**Rule: Complete your current task, then immediately fix all warnings before moving on to the next task.**

Examples of "innocent" warnings that became malignant:
- Unused imports → shadowed module state → hard-to-trace bugs
- Undefined variables → incorrect assumptions about which functions exist → breaking refactors
- Unused variables → confusion about which code paths run → security gaps

**When you see a warning:**
1. Finish the current task (e.g., complete the module extraction, finish the feature)
2. **Immediately after task completion**, diagnose and fix every warning:
   - Unused import? Remove it or use it.
   - Undefined variable? Add the import or check if function exists.
   - Unused constant? Delete it or document why it's there.
3. Do not defer. Do not ignore. Do not rationalize. Fix it now.

**Never commit with warnings.** If you inherit warnings from a prior merge, address them in the next task as a quick separate PR.

Warnings are the system's way of saying "pay attention here." Pay attention.

### 2. Smoke Test

PostgreSQL is installed locally. Use it. Every time.

A valid smoke pass requires **all three**:
1. A **fresh server boot** (not curls against a stale `npm run dev` from hours ago)
2. Boot log shows **`PostgreSQL connected successfully`** (not offline/error mode)
3. All four baseline checks pass (forum, auth, portal, game entry)

Use the platform block that matches the machine you are on. See `WINDOWS_LOCAL_SETUP.md` for full Windows setup.

#### Linux / WSL / macOS

```bash
# Step 1: Start PostgreSQL
service postgresql start

# Step 2: Ensure smoke DB exists (safe to run every time)
sudo -u postgres psql -c "CREATE DATABASE narmir_smoke;" 2>/dev/null || true
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'smoke';" 2>/dev/null || true

# Step 3: Start the server (kill anything already on :3000 first)
kill $(lsof -t -i:3000) 2>/dev/null
DATABASE_URL="postgresql://postgres:smoke@localhost/narmir_smoke" JWT_SECRET=test-smoke-secret node index.js &
sleep 4

# Step 4: Run baseline checks — always, regardless of what you changed
curl -s http://localhost:3000/api/forum/boards | grep -q "General" && echo "✅ Forum boards" || echo "❌ Forum boards"
curl -s http://localhost:3000/api/auth/me | grep -q "Not authenticated" && echo "✅ Auth/me" || echo "❌ Auth/me"
curl -s http://localhost:3000/portal | grep -q "portal-root" && echo "✅ Portal" || echo "❌ Portal"
curl -s http://localhost:3000/game | grep -q "main.jsx" && echo "✅ Game entry" || echo "❌ Game entry"

# Step 5: Test the specific endpoints affected by your change

# Step 6: Kill server
kill $(lsof -t -i:3000) 2>/dev/null
```

#### Windows (PowerShell)

Windows dev setups use `narmir_dev` / `narmir_local` from `.env` — **not** `postgres:smoke`. The `postgres:smoke` recipe fails on Windows unless you manually create `narmir_smoke` as the postgres superuser (see `WINDOWS_LOCAL_SETUP.md`).

```powershell
# Step 1: Ensure PostgreSQL is running
Get-Service postgresql* | Where-Object Status -ne Running | Start-Service

# Step 2: Read credentials from .env (defaults shown — match your file)
#   DATABASE_URL=postgresql://narmir_dev:narmir_local_dev@localhost:5432/narmir_local
#   JWT_SECRET=narmir_local_dev_secret_key_123

# Step 3: Kill anything on :3000, then start a FRESH server
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

$env:DATABASE_URL = "postgresql://narmir_dev:narmir_local_dev@localhost:5432/narmir_local"
$env:JWT_SECRET   = "narmir_local_dev_secret_key_123"
$env:NODE_ENV     = "development"
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "index.js" -WorkingDirectory (Get-Location)
Start-Sleep -Seconds 5
# Confirm boot log contains: [db] ✅ PostgreSQL connected successfully!

# Step 4: Baseline checks (use curl.exe — PowerShell aliases curl to Invoke-WebRequest)
curl.exe -s http://localhost:3000/api/forum/boards | Select-String "General"
curl.exe -s http://localhost:3000/api/auth/me | Select-String "Not authenticated"
curl.exe -s http://localhost:3000/portal | Select-String "portal-root"
curl.exe -s http://localhost:3000/game | Select-String "main.jsx"

# Step 5: Test endpoints affected by your change

# Step 6: Kill server
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
```

**Do not** report smoke as green if you only curled an already-running dev server without confirming a fresh boot and DB connection.

**"DATABASE_URL not set" is not a valid excuse. Set it yourself.**
**"I can't test this without a DB" is not a valid excuse. Start one.**
**Skipping smoke because "I only changed CSS" is not valid. Run the baseline.**

### 3. Sanity Check

Before committing, answer each of these explicitly:

1. **What does this change break, if anything?** Name it or confirm nothing.
2. **Did I read every file I edited top to bottom after editing?** If not, do it now.
3. **Did I grep for all usages of any symbol I renamed, removed, or changed the signature of?** If not, do it now.
4. **Does the change work in both contexts it touches?** (e.g. portal AND game, mobile AND desktop)
5. **Did I introduce any new CSS variables, classes, or JS globals that might not exist in all contexts?**

Self-certification without answering these is not a sanity check.

### When to Refuse to Commit

- ❌ Any lint error
- ❌ Server crashes on start
- ❌ Any baseline smoke check fails
- ❌ You cannot answer the sanity questions confidently
- ❌ You are on the wrong branch

---

## Commit Messages

Every commit message must end with the session URL:

```
https://claude.ai/code/session_<SESSION_ID>
```

Use the actual session ID from this session. Do not use a placeholder.

---

## Database Rules

### Local Smoke DB

**Linux / WSL / macOS (preferred isolated DB):**
- DB name: `narmir_smoke`
- User: `postgres`, password: `smoke`

**Windows (typical dev setup — see `WINDOWS_LOCAL_SETUP.md`):**
- DB name: `narmir_local` (or `narmir_smoke` if you created it via postgres superuser)
- User: `narmir_dev`, password: `narmir_local_dev`
- `narmir_dev` cannot `CREATE DATABASE`; use pgAdmin or `psql -U postgres` once to add `narmir_smoke` if you want an isolated DB on Windows.

Always test schema changes against a local DB before pushing.
"Test on local dev environment if possible" means **always**. Remove "if possible" from your thinking.

### Production (Railway)

- **Production URL**: https://narmirreborn.com
- Deployed via Railway
- **Railway has no shell.** Do not try to run scripts on Railway directly.
- For schema changes: write the migration SQL, test it against `narmir_smoke`, then execute via pgAdmin4 Query Tool against the Railway DB.

---

## High Priority Issues

When fixing high-priority issues:
- [ ] Security vulnerabilities (SQL injection, XSS, etc.)
- [ ] Race conditions / transaction safety
- [ ] Memory leaks / resource management
- [ ] Critical performance bottlenecks
- [ ] Code review feedback from automated tools

Always push as draft PRs. Never self-merge high-priority fixes.

---

## Code Review Feedback (Gemini / Automated Tools)

Automated reviewers are helpful but sometimes wrong. Before applying any suggestion:

1. **Understand what it's actually saying.** Don't apply it blindly.
2. **Check if the suggestion would break existing behavior.** Especially around CSS variables, panel display systems, or React reconciliation.
3. **If it conflicts with how the game's panel system works, reject it and explain why in a reply comment.**

Example of a bad suggestion that was applied: removing `style={{ display: 'none' }}` from React panels. The game's `switchTab()` requires it. Applying it broke the forum panel entirely.

---

## Post-Merge Housekeeping — No Exceptions

After every PR merge to main:

1. **Update ROADMAP.md** — Mark completed work, update status lines, move sprint items to ✅ Done
   - Commit message: `docs: Update ROADMAP — <track/phase> complete`
   - Create a draft PR immediately for the roadmap update
   - Merge when CI passes

2. **Delete the feature branch** — Clean up merged branches to keep repo tidy
   ```bash
   git push -d origin <branch-name>
   git branch -d <branch-name>
   ```
   - If remote deletion fails (permissions), note it but do not block progress
   - Local deletion should always succeed

**Why:** Prevents stale branches cluttering the repo; keeps roadmap in sync with actual work so future sessions know what's done.

---

## Notes

- The pre-commit hook in `.git/hooks/pre-commit` enforces lint on every commit.
- Never use `--no-verify` to bypass it unless explicitly told to by the user.
- Always run `git branch --show-current` before pushing.
- The designated development branch is specified at the start of each session. Push only to that branch.

# Claude Code Workflow Guide

## PR Workflow

### Before Every Push — No Exceptions

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

3. Check for an existing open PR on this branch before creating a new one.
   If the previous PR was merged, open a new draft PR immediately after the next push.

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

Run all three. In order. Every time. No exceptions.

### 1. Lint

```bash
npm run lint
```

- **0 errors** required. The pre-commit hook enforces this mechanically.
- Warnings must be individually justified in the commit message or fixed outright.
- Do not let warning count grow. If a warning existed before your change, note it. If you introduced it, fix it.

### 2. Smoke Test

PostgreSQL is installed locally. Use it. Every time.

```bash
# Step 1: Start PostgreSQL
service postgresql start

# Step 2: Ensure smoke DB exists (safe to run every time)
sudo -u postgres psql -c "CREATE DATABASE narmir_smoke;" 2>/dev/null || true
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'smoke';" 2>/dev/null || true

# Step 3: Start the server
DATABASE_URL="postgresql://postgres:smoke@localhost/narmir_smoke" JWT_SECRET=test-smoke-secret node index.js &
sleep 4

# Step 4: Run baseline checks — always, regardless of what you changed
curl -s http://localhost:3000/api/forum/boards | grep -q "General" && echo "✅ Forum boards" || echo "❌ Forum boards"
curl -s http://localhost:3000/api/auth/me | grep -q "Not authenticated" && echo "✅ Auth/me" || echo "❌ Auth/me"
curl -s http://localhost:3000/portal | grep -qc "NARMIR" && echo "✅ Portal" || echo "❌ Portal"

# Step 5: Test the specific endpoints affected by your change

# Step 6: Kill server
kill $(lsof -t -i:3000) 2>/dev/null
```

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

- DB name: `narmir_smoke`
- User: `postgres`, password: `smoke`
- Always test schema changes against this DB before pushing.
- "Test on local dev environment if possible" means **always**. Remove "if possible" from your thinking.

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

## Notes

- The pre-commit hook in `.git/hooks/pre-commit` enforces lint on every commit.
- Never use `--no-verify` to bypass it unless explicitly told to by the user.
- Always run `git branch --show-current` before pushing.
- The designated development branch is specified at the start of each session. Push only to that branch.

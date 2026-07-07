# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ FIRST: Check Memory

**On every session start:** Read `C:\Users\king_\.claude\projects\C--Users-king-\memory\MEMORY.md` to understand prior learnings, known issues, and project context. This is non-negotiable.

---

## Development Quick Start

### Prerequisites
- Node.js 20.19.0+ (check with `node --version`)
- PostgreSQL 12+ for local development
- `.env` file configured (copy from `.env.example`)

### Common Commands

```bash
# Development (watches files, rebuilds on change)
npm run dev              # Start dev server with Vite (includes HMR)

# Production (builds dist/ first, then serves from there)
npm run build            # Compile React client to dist/ (Vite)
npm start                # Start production server using dist/

# Quality checks (MUST pass before push)
npm run lint             # Run ESLint on all .js files (except client tests)
npm test                 # Run server tests (Node scripts/run-tests.js)
npm run test:components  # Run React component tests (Vitest)

# Game-specific testing
npm run smoke:combat-v2      # Smoke test for advanced combat system
npm run scenario:combat-v2   # Run combat scenario tests
npm run route-smoke:combat-v2 # Test route persistence for combat
```

### Local Database Setup

```bash
# Using Docker (recommended):
docker run --name postgres -e POSTGRES_PASSWORD=smoke -p 5432:5432 postgres:15
docker exec postgres psql -U postgres -c "CREATE DATABASE narmir_smoke;"

# Or system postgres:
sudo -u postgres createdb narmir_smoke
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'smoke';"

# Test connection:
psql postgresql://postgres:smoke@localhost/narmir_smoke
```

---

## Architecture Overview

### Dual-Module Design: Server (Node.js/CommonJS) + Client (React/ES Modules)

The codebase is split into two distinct systems that **cannot directly import from each other** due to build system constraints:

#### Server-Side (CommonJS)
- **Root files:** `index.js` (entry point), `discord-bot.js` (bot)
- **Routes:** `/routes/*.js` - Express route handlers (auth, kingdom, hero, forum, etc.)
- **Game logic:** `/game/*.js` - Core game engine, mechanics, rules
- **Database:** `/db/schema.js` - PostgreSQL schema and migrations
- **Utilities:** `/lib/*.js` - Shared utilities (changelog, audit scheduler, etc.)

**Key pattern:** Server uses `module.exports` and `require()`. Test server code with `npm test`.

#### Client-Side (React/ES Modules)
- **Entry points:** `/client/*.html` files (index.html, splash.html, portal.html, admin.html)
- **Main apps:** `/client/src/*-main.jsx` (main.jsx, splash-main.jsx, etc.)
- **Shell/Layout:** `/client/src/GameShell.jsx` - Main app container
- **Components:** `/client/src/components/react/*.jsx` - React components
- **Utilities:** `/client/src/utils/*.js` - Client-side utilities
- **State:** `/client/src/stores/` - Zustand store definitions
- **Styles:** `/client/src/tailwind.css`, `/client/src/tailwind-theme.css`

**Key pattern:** Client uses ES6 `import`/`export`. Test with `npm run test:components`.

**Build process:** Vite compiles client to `/dist/` on `npm run build`. The server serves this static build in production via `app.use('/dist', express.static(...))`.

### Canonical Module Locations & Mirrors

When utilities must work on both server and client, they live in two places (**not because of duplication, but because of build system constraints**):

**Example: Timestamp utilities**
- **Server canonical:** `game/lib/timestamp.js` (CommonJS) — source of truth
- **Client mirror:** `client/src/utils/timestamp.js` (ES modules) — kept in sync manually

See `/game/ARCHITECTURE.md` for detailed patterns and import rules.

---

## Data Flow & Key Systems

### Real-Time Architecture
- **WebSocket server:** Socket.io in `/game/sockets.js`
- **Client connection:** `/client/src/socket-client.js` connects to server
- **Game state sync:** Server pushes updates; client stores in Zustand (`/client/src/stores/`)

### Game Tick System
- **Turn timer:** `/game/turn.js` - increments every 25 minutes
- **Resource regen:** Turn tick triggers regen, scout progress, market changes
- **Execution:** Server-side only; client receives updates via Socket.io

### Database
- **Migrations:** Applied on server start from `/db/schema.js`
- **Queries:** Use parameterized queries (`WHERE id = $1`) to prevent SQL injection
- **Connection pool:** Configured in `index.js` (min=2, max=20 by default)

### Authentication
- **JWT tokens:** Signed with `JWT_SECRET` from `.env`
- **Storage:** httpOnly cookie (secure) + localStorage (fallback)
- **Routes:** Protected by `/routes/middleware.js` middleware

---

## Deployment to Railway

### Pre-Deployment Checklist
1. **Branch & PR:** Create a feature branch, pass code review
2. **Quality gates:** `npm run lint` and `npm test` must pass
3. **Build locally:** `npm run build` must complete without errors
4. **Environment:** All production secrets in Railway Variables tab (see `RAILWAY_SECRETS.md`)

### Deployment Process
1. Merge to `main` (auto-deploys via Railway webhook)
2. Railway runs `npm run build` (Procfile specifies this)
3. Server starts with `npm start` (serves pre-built `/dist/` folder)
4. Database connection via `DATABASE_URL` env var (auto-injected by Railway)

**Important:** The `Procfile` must contain `web: npm run build && npm start` to ensure the client is rebuilt on every deploy.

---

## Critical Known Issues & Patterns

### 1. Stride Migration (Visibility/Fog of War)
- **Issue:** Server migrated `CELL_INDEX_STRIDE` from 32 to 48 for visibility bitmaps
- **Where:** `game/visibility.js` uses stride-48; `client/src/components/react/HexSelectionModal.jsx` must match
- **Status:** See `memory/MEMORY.md` for tracking details

### 2. Browser Automation Testing
- **Pattern:** Real pointer events > synthetic/mocked clicks
- **Issue:** Manually-dispatched click events skip pointer-capture retargeting
- **Solution:** Use real event sequences in tests, not forced synthetic clicks

### 3. Module Import Discipline
- **Rule:** Server code NEVER imports from `/client/src/`; client code NEVER imports from `/game/` or `/lib/`
- **Exception:** Canonical utilities (like timestamp) are mirrored in both locations
- **Why:** Build system separation (CommonJS on server, ES modules on client)

---

## PR Workflow

#### *****DO NOT TAKE THE PATH OF LEAST RESISTANCE*****

### Before Every Push — No Exceptions

1. **Confirm branch:**
   ```bash
   git branch --show-current
   # Must match the designated feature branch. If wrong, stop and ask.
   ```

2. **Confirm commits:**
   ```bash
   git fetch origin main
   git log --oneline origin/main..HEAD
   # If 0 commits, nothing to push. Do not push.
   ```

3. **Check for open PR:**
   ```bash
   # Via GitHub: owner=swaggyshane, repo=narmir_reborn, head=<branch>, state=open
   ```
   - If open PR exists: push to it, no new PR needed
   - If no open PR: create one **immediately after push**. Do not wait.

### Workflow Steps

1. Make code changes on feature branch
2. Run quality checks (lint → smoke → sanity):
   ```bash
   npm run lint
   npm test
   npm run smoke:combat-v2  # if combat-related
   ```
   - If any error: fix it and retest. Do not push with failing tests.
3. Stage and commit: `git add <files>` → `git commit -m "..."`
4. Confirm branch and commits (step 1-3 above)
5. Push: `git push`

6. **Create or update PR:**
   - Existing PR: push to it automatically
   - New PR: create immediately after push

7. **Actively monitor until merge:**
   - Monitor CI status continuously
   - Gemini will post ONE review; address it immediately
   - Do NOT merge while waiting for review

8. **Address Gemini's feedback:**
   - Fix code, commit, and push
   - Do NOT wait for Gemini to review your fixes (it won't)
   - Move to step 9 once addressed

9. **Update docs:**
   - Move finished items to `ARCHIVAL.md` with date
   - Commit and push docs update
   - Monitor CI in parallel

10. **Self-merge when CI passes:**
    - Wait for all CI checks to pass (monitor actively)
    - Merge to main
    - Delete feature branch locally and remotely
    - Done. Do not wait for anything else.

---

## Important Files & References

### Documentation
- **TODO.md** — Development roadmap (source of truth for tasks)
- **ARCHIVAL.md** — Completed features (historical record)
- **game/ARCHITECTURE.md** — Module organization & canonical locations
- **RAILWAY_SECRETS.md** — Production secrets management

### Setup & Deployment
- **.env.example** — Environment template (copy to .env)
- **Procfile** — Railway deployment config
- **railway.json** — Vite build config for Railway
- **vite.config.js** — Client build config (Vite)
- **eslint.config.mjs** — Linter rules

### Key Runtime Files
- **index.js** — Server entry point
- **discord-bot.js** — Discord bot entry point
- **db/schema.js** — Database schema & migrations

---

## Testing Strategy

### When to Test
- **Always before push:** `npm run lint && npm test`
- **Combat-related changes:** `npm run smoke:combat-v2` or `npm run scenario:combat-v2`
- **Route/API changes:** `npm test` includes route persistence tests

### Test Organization
- **Server tests:** `/test-combat-harness/`, `scripts/run-tests.js`
- **React tests:** Vitest in `/client/src/**/*.test.jsx`
- **Smoke tests:** Combat harness (`v2-*.js` files)

---

## Discipline Reminders

1. **Do NOT:** Push code without running `npm run lint` and `npm test`
2. **Do NOT:** Make multiple rapid commits without coordination
3. **Do NOT:** Import across module boundaries (server ↔ client)
4. **Do NOT:** Commit `.env` files or production secrets
5. **Do NOT:** Merge to main without PR review and CI passing

**Why:** The codebase has a long history of issues caused by lack of discipline. Enforce these rules rigorously.

# Narmir Reborn — Maintenance & Health Report

*Last assessed: 2026-06-25*

---

## Overall Health: GOOD with critical gaps

**Strengths:** SQL parameterization, XSS protection, auth security, transaction handling, no hardcoded secrets.
**Weaknesses:** Broken lint enforcement, missing admin CSRF protection, no CI test execution, monolithic files.

---

## Critical Issues

### 1. ESLint is broken
`npm run lint` fails — `@eslint/js` module cannot be resolved in ESM mode. The pre-commit hook that enforces lint is **non-functional**. Code quality enforcement has silently been off.

- **Fix:** Upgrade to ESLint 9+ with a working flat-config, or pin to a compatible config.

---

### 2. Admin routes missing CSRF protection
`requireCsrfToken` middleware exists and is used elsewhere, but is **not applied** to most POST/DELETE routes in `routes/admin.js`, including `/ban`, `/unban`, `/reset-kingdom`, `/delete-kingdom`, and others.

- **Risk:** A logged-in admin visiting a malicious site could be tricked into performing destructive actions.
- **Fix:** Add `requireCsrfToken` to all state-changing admin routes.

---

### 3. No tests run in CI
45+ unit tests exist (combat, economy, magic, heroes, happiness, covert ops, etc.) but the GitHub Actions pipeline (`security.yml`) **never executes them**. Regressions can ship to production silently.

- **Fix:** Add a test job to `.github/workflows/`.

---

## High Priority

### Dependency Vulnerabilities

| Package | Severity | Issue | Fix |
|---|---|---|---|
| `vite` 8.0.12 | HIGH | Server FS bypass + NTLM hash leak (Windows) | Upgrade to 8.1.0+ |
| `undici` (via discord.js) | HIGH | HTTP header injection, WebSocket DoS, response queue poisoning | Upgrade discord.js when upstream fixes land |
| `multer` 2.1.1 | HIGH | DoS via deeply nested field names | Already at latest; await upstream fix |
| `ws` (via socket.io) | HIGH | Memory exhaustion DoS via tiny fragments | Upgrade when upstream fixes land |

Vite is the easiest immediate win — bump the version.

---

### Monolithic Files

| File | Lines | Notes |
|---|---|---|
| `game/engine.js` | 6,242 | Turn processing, upkeep, combat wrapper all combined |
| `routes/kingdom.js` | 5,906 | All kingdom actions in one file |
| `game/magic.js` | 2,988 | Spell casting, school validation, mana costs |
| `game/config.js` | 3,054 | Game constants and spell definitions |
| `db/schema.js` | 2,072 | DB adapter + all schema migrations |
| `game/combat-resolver.js` | 1,247 | V2 combat execution (incomplete — see below) |
| `game/combat.js` | 1,424 | V1 combat (legacy) |
| `routes/admin.js` | 1,578 | Admin panel endpoints |

Not bugs, but a significant maintenance liability. Any refactoring will be painful.

---

### Combat V2 Incomplete
V2 combat (`game/combat-resolver.js`) is feature-flagged behind `USE_COMBAT_V2=1` and marked as incomplete in `TODO.md`. V1 and V2 both live in the codebase simultaneously.

- **Decision needed:** Complete the V2 migration and remove V1, or remove V2 and commit to V1.

---

## Medium Priority

### Inconsistent Error Handling
- ~195 try-catch blocks in `kingdom.js` alone; many swallow errors silently (`catch {}`)
- No centralized error handler middleware for unhandled promise rejections
- Generic "Server error" responses in production hide root causes

**Fix:** Add Express global error handler middleware; audit silent catch blocks.

---

### No Input Range Validation
Numeric inputs use `parseInt()` with fallbacks but no min/max bounds. Game balance exploitation is possible if action quantities are not clamped server-side.

**Fix:** Add range validation for all numeric game action inputs (troop counts, research allocation, build amounts, etc.).

---

### Frontend State Management
React 19 components are in use but no Context API or Redux is present. Global state likely still relies on `window`-scoped variables from the pre-React vanilla JS era.

**Fix:** Migrate to React Context or a lightweight state manager as panels are converted.

---

### No Frontend Tests
Zero component tests exist. The test suite covers game logic only.

---

## What Is Working Well

| Area | Status | Notes |
|---|---|---|
| SQL injection | Clean | All queries fully parameterized |
| XSS | Clean | `sanitizeHtml()` wraps all `dangerouslySetInnerHTML` uses |
| Password hashing | Good | bcrypt with 10-round salt |
| JWT auth | Good | httpOnly cookies in production; server crashes if `JWT_SECRET` missing |
| CSRF tokens | Good | `crypto.randomBytes(32)`; enforced on non-admin routes |
| Security headers | Good | HSTS, strict CSP, X-Frame-Options, CORP all set correctly |
| CORS | Good | Restricted to `CORS_ORIGIN` env var in production |
| Database transactions | Robust | Savepoints, AsyncLocalStorage isolation, 10-min reaper for leaked connections |
| Rate limiting | Good | Custom in-memory limiter: auth (10/min), turns (300/min), general (500/min) |
| Hardcoded secrets | None | All credentials from env vars |
| File upload security | Good | Whitelist, MIME check, magic byte validation, size limit, path traversal check |
| Game logic tests | Good | 45+ tests covering core systems |

---

## Recommended Fix Order

1. **Fix ESLint** — restore the enforcement mechanism that's supposed to be running
2. **Add CSRF to admin routes** — quick security fix with high impact
3. **Bump Vite to 8.1.0+** — one-line dependency update
4. **Add CI test job** — make the existing 45+ tests actually gate deploys
5. **Centralized error handler** — catch unhandled rejections at the Express layer
6. **Input range validation** — clamp numeric game inputs server-side
7. **Begin `kingdom.js` refactor** — split into `build`, `warfare`, `economy`, `research` modules
8. **Decide on Combat V2** — complete the migration or remove the dead branch
9. **Migrate frontend state** — incrementally adopt React Context as panels convert
10. **Add frontend component tests** — extend coverage beyond game logic

---

## CI/CD Gaps

The current pipeline (`.github/workflows/security.yml`) only checks:
- `.gitignore` presence
- `CODEOWNERS` format
- Text encoding (mojibake scan)

Missing:
- Lint job
- Test job
- `npm audit` scan
- Vite build validation
- Deployment pipeline (currently manual/external via Railway)

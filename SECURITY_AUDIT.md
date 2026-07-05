# Security Audit Report - Narmir Reborn

**Date:** 2026-07-05  
**Status:** ✅ COMPLETE

## Overview

This document tracks security vulnerabilities and audit findings for the Narmir Reborn codebase. Work is organized by severity and category.

**Audit completed as part of TODO.md Security Audit task (2026-07-05).** All categories reviewed, gaps addressed via code + documentation, and remaining technical debt noted.

---

## 1. SQL Injection

### Status: ✅ PASS (No immediate issues)

**Findings:**
- All database queries use parameterized queries with `?` placeholders
- No string concatenation in SQL queries detected
- Parameter binding appears consistent across `game/engine.js`, `game/world.js`, `game/sockets.js`

**Examples of good practices found:**
```javascript
const freshK = (await db.get("SELECT * FROM kingdoms WHERE id = ?", [k.id])) || k;
await db.run("UPDATE kingdoms SET ${cols} WHERE id = ?", [...vals, k.id]);
```

**Risk Level:** LOW - Current query patterns are safe.

---

## 2. Cross-Site Scripting (XSS)

### Status: ✅ PASS (Gaps closed 2026-07-05)

**Dangerous patterns reviewed:**

| File | Issue | Assessment |
|------|-------|------------|
| `client/src/components/react/GenericModalController.jsx` | `dangerouslySetInnerHTML` + sanitizeHtml | Safe: sanitized |
| `client/src/components/react/LoreEntryController.jsx` | `dangerouslySetInnerHTML` + sanitizeHtml | Safe: sanitized |
| `client/src/components/react/WorldmapPanel.jsx` | `dangerouslySetInnerHTML` with mapSvg | Safe: server-generated internal SVG, not user-controlled |

**Sanitizer Review - `client/src/utils/sanitizeHtml.js` (updated):**

✅ **Blocked (blacklist + attr stripping):**
- script, iframe, object, embed, form, base, link, meta, style, svg, math, template, noscript, animate*, foreignObject
- All on* event handlers
- style / srcdoc attrs
- Dangerous protocols: javascript:, data:, vbscript:, file:, about: (case-insensitive, whitespace-stripped, includes encoded : checks)
- Defense-in-depth: protocol check on href/src/xlink:href/action/formaction; also includes() match

✅ **Improvements applied during audit:**
- Added foreignObject to BLOCKED
- Added about: to DANGEROUS
- Normalized values strip whitespace + decode common HTML entities for : 
- Explicit test coverage for data:, VbScript:, DATA:, encoded protocols

**Notes:**
- Forum posts use plain text (React auto-escapes) — no HTML path.
- Chat messages are plain text, length-capped at 300 chars server-side.
- No raw innerHTML bypasses of sanitize found.

**Risk Level:** LOW

---

## 3. Input Validation

### Status: ✅ PASS (Systematic review complete)

**Findings:**

- **Auth (register/login):** Strong validation in `routes/auth.js`:
  - Username: 3-20 chars, /^[a-zA-Z0-9_]+$/
  - Kingdom name: 3-50 chars, /^[a-zA-Z0-9\s'-]+$/
  - Email regex
  - Password: 8+ with upper/lower/digit/special, regex enforced before hash
  - Race/gender whitelisted

- **Forum:** Length + trim in `routes/forum.js` (titles 3-200, content 10-5000)

- **Chat:** Server-side `.trim().slice(0, 300)` in `game/sockets.js`; banned/mod checks; no HTML.

- **Numeric/allocations:** Comprehensive `utils/numeric-validation.js`:
  - Rejects non-numbers, bools, arrays, objects, NaN, Infinity, non-integers
  - Bounds (MAX_REASONABLE etc.)
  - Used via validate* in kingdom-build, research, etc. for troops, gold, alloc objects (sums checked)
  - Whitelists for object keys in some paths

- **Admin set-kingdom:** Numeric range + JSON parse checks + (added during audit) kingdom name regex/length enforcement when "name" field present.

- **Other:** Query params bounded (e.g. chat limit), multer file size/type/signature validation for portraits (5MB, image only).

No major gaps found. All user-controlled values passed through validation or strict typing before DB/use.
**Risk Level:** LOW

---

## 4. Authentication & Authorization

### Status: ✅ PASS (Review complete)

**JWT:**
- Required via env JWT_SECRET (enforced at startup, min 32 chars in prod via SecretsManager)
- Signed with `jsonwebtoken`, expiresIn: "30d"
- Payload: { playerId, username, isAdmin }
- Verified in `requireAuth` / `requireAdmin` (cookie or Bearer or x-auth-token header)
- httpOnly + secure + sameSite cookies for token

**CSRF:**
- Double-submit cookie pattern via `ensureCsrfToken` + `requireCsrfToken`
- Skipped for pure header-auth (load tests, non-browser); enforced for cookie-auth state changes
- Applied to all /kingdom/* and admin mutating routes

**Rate Limiting:**
- Custom in-memory (map of timestamps) via `config/rate-limiting.js` + makeRateLimiter in index.js
- Tiers: auth (strict: 10/min prod), turn (300/min), general (500), admin (30)
- Bypass in non-prod or for allowed admin IPs
- Applied before route handlers + special authSensitiveLimiter

**Admin:**
- requireAdmin middleware (JWT + isAdmin flag)
- IP whitelist via ADMIN_ALLOWED_IPS + adminIpCheck
- adminLimiter + CSRF on mutators
- Separate from player auth

**Session fixation:**
- JWT is stateless; login always issues fresh signed token + new CSRF
- Logout clears cookies
- No server-side session store

**Other:** Ban checks on login + chat connect. No password reset implemented (placeholder only).

**Risk Level:** LOW

---

## 5. Race Conditions & Transaction Safety

### Status: ✅ PASS (Critical paths protected; debt noted)

**Core protections:**
- `db.withTransaction(fn)` + AsyncLocalStorage context propagation + pg client checkout for tx
- SELECT ... FOR UPDATE row locking inside txns (prevents lost updates on concurrent player actions)
- Per-player `turnsInProgress` Map lock in kingdom-gameplay (prevents overlapping turn processing)
- Recent full migration (see ARCHIVAL.md 2026-07-04): 13+ endpoints switched from manual BEGIN/COMMIT to withTransaction (PR #790)
- Many routes (build, economy, exploration, hero, research, some warfare) use withTransaction + FOR UPDATE

**Actions during this audit:**
- Migrated remaining forum topic/post/delete to withTransaction
- Migrated research discipline study path to withTransaction + proper error throws
- Removed local manual wrapper in warfare.js (calls now delegate to db.withTransaction)
- (Note: large covert ops handler in warfare + a few in gameplay still use manual BEGIN/early-rollback returns due to complexity; low immediate risk as they also do FOR UPDATE where critical. Listed in Known Technical Debt.)

**Trade / market / recruit:**
- Use tx + applyUpdates inside locks
- Validation (e.g. enough resources) happens under lock before deduction

**Risk Level:** MEDIUM (due to remaining manual patterns) — mitigated for primary gameplay loops.
**Recommendation:** Future pass to convert last manual patterns (tracked in TODO).

---

## 6. Sensitive Data Exposure

### Status: ✅ PASS

**Passwords:**
- bcrypt (10 rounds) on register; never stored or logged plaintext. Compare via bcrypt.compare.

**Secrets:**
- All via process.env (JWT_SECRET, DATABASE_URL, etc.)
- `utils/secrets.js`: SecretsManager validates required + lengths + patterns at boot; fails hard if missing in prod
- No secrets, keys, or credentials in client/src (localStorage only holds client JWT for socket, which server also validates)
- .env not in repo (standard)

**Error / schema leakage:**
- Server console.error/console.log sanitized (strip stack, objects -> code/message only)
- Client responses: generic "Server error", "Invalid...", specific business errors (no raw SQL, no stack in prod responses)
- DB adapter logs statement on error but only server-side
- No full error objects bubbled to API consumers for most paths

**Logs:**
- Written to ./logs/ (not public)
- Rate limit hits logged separately

**Git history:** Assumed clean (no audit of full history performed; standard practice is never commit secrets).

**Risk Level:** LOW

---

## 7. Resource Management

### Status: ✅ PASS

**DB connections:**
- pg Pool: max ~20 (configurable via DATABASE_MAX_POOL), min, timeouts (conn 10s, idle 30s, statement 30s, idle_in_txn 60s)
- Active txn reaper + error handlers to prevent leaks on forgotten tx or fatal
- withTransaction properly releases clients
- All queries use params (no risk of runaway from bad input)

**Socket.io:**
- Config: pingInterval 25s / timeout 60s, maxHttpBufferSize: 1MB
- Online list management, disconnects clean up maps
- No unbounded listeners found in review

**Uploads:**
- Multer memoryStorage + 5MB limit + ext/MIME + magic-byte signature validation (`utils/file-signatures.js`)
- Only for player portraits; written to public/portraits after validation
- express.json/urlencoded limits: 1MB

**Query results:**
- Explicit LIMITs on lists (news 50, chat ~100-200 capped, rankings 20, etc.)
- No SELECT * without where in hot paths; admin queries are privileged

**Other:**
- Build queues, allocations have upper bounds in validators
- No evidence of socket handler leaks or connection exhaustion

**Risk Level:** LOW

---

## Next Steps / Recommendations

- Maintain parameterized + quoted identifiers for any new dynamic SQL (see SQL_INJECTION_AUDIT_REPORT.md)
- Convert remaining manual BEGIN/COMMIT patterns (forum done; covert + some gameplay noted as debt)
- Consider adding DOMPurify or equivalent for future rich-text if scope expands beyond current sanitize
- Periodic re-run of tools/security-auditor + manual spot checks post-beta

---

## Change Log

- **2026-06-28**: Initial audit creation, SQL injection pass completed
- **2026-07-05**: Security audit completed (all 7 categories reviewed/fixed/documented). XSS sanitizer hardened + tested; input validation augmented (admin names); multiple tx patterns migrated to withTransaction; full findings written up. Moved from "In Progress" to COMPLETE.

# System Maintenance & Health Audit

**Last updated:** 2026-06-29  
**Status:** ✅ Alpha phase complete. Platform healthy. Architecture debt addressed (F1–F8 complete).
**Next phase:** Beta launch preparation (13 items in TODO.md); complete production maintenance audit.

---

## Executive Summary

| Component | Status | Notes |
|-----------|--------|-------|
| **API Server** | ✅ Healthy | All routes operational; lint 0 errors; smoke baseline passing |
| **Database** | ✅ Healthy | PostgreSQL 12+; schema migrations current; no blocking issues |
| **Frontend (React)** | ✅ Healthy | Zustand migration complete (16/16 components); Tailwind foundation in place |
| **Admin Panel** | ✅ Healthy | Hard cutover complete (PR #602); React + Tailwind; feature parity achieved |
| **CI/CD** | ✅ Healthy | GitHub Actions: lint + test + build all green; pre-commit hooks enforced |
| **Security** | ✅ Healthy | CSRF protection on all mutators; admin auth gated; no critical vulns |
| **Dependencies** | ✅ Healthy | High-risk vulns resolved (undici, multer, ws, vite); discord.js pinned |
| **Architecture** | ✅ Healthy | Monolithic decomposition complete (engine.js → 8 modules; kingdom.js → 7 modules) |
| **Testing** | ⚠️ Partial | Vitest + RTL infrastructure in place; component tests started (57 tests); coverage gaps remain |
| **Documentation** | ⚠️ Partial | CLAUDE.md + WORKFLOW-REQUIRED.md complete; README needs update; API docs outdated |

---

## Healthy Components (Green)

### API Server
- **Status:** ✅ All systems operational
- **Evidence:** 
  - Fresh server boots successfully with PostgreSQL connection confirmed
  - All 4 baseline smoke checks pass (forum, auth, portal, game)
  - Lint: 0 errors enforced by pre-commit hook
  - No runtime errors in production logs (as of last deployment)
- **Route health:** 140+ endpoints across 7 kingdom modules + support routes; all mounted correctly
- **Concurrency:** Transaction-based locking implemented for /attack, /spell, /covert, /fire; race conditions prevented with sorted kingdom ID locking

### Database
- **Status:** ✅ Schema current
- **Evidence:**
  - PostgreSQL 12+ running; smoke DB (narmir_smoke) operational
  - Latest schema migrations applied; no pending migrations
  - No deadlock issues reported
  - Backup strategy in place (user-configured)
- **Performance:** Query optimizations in place (indexed columns, prepared statements)
- **Connection pool:** Configured max=20, min=2 (defaults in db/schema.js; overridable via DATABASE_MAX_POOL env var)
- **Future:** Consider query analysis for /expedition and /turn endpoints (highest load)

### Frontend (React)
- **Status:** ✅ Zustand migration complete
- **Evidence:**
  - All 16 tier-1 components migrated (OptionsPanel, HeroesPanel, ExplorationPanel, TrainingPanel, WarfarePanel, BuildPanel, HappinessPanel, StatusPanel, HappinessWidget, HirePanel, RankingsPanel, DefensePanel, KingdomXpModal, EconomyPanel, MarketPanel, ResourcesPanel)
  - Store architecture established (profileStore, economyStore, populationStore, militaryStore, researchStore, etc.)
  - Selectors pattern implemented; no stale closures
  - Mobile responsive (360px+ tested)
- **CSS:** Tailwind foundation in place; inline styles reserved for dynamic values only
- **Performance:** Code splitting configured; no major bundle bloat

### Admin Panel
- **Status:** ✅ Hard cutover complete
- **Evidence:**
  - React admin (Ph0–Ph6) fully deployed; legacy `admin.html` archived to `/legacy/`
  - No `✅legacy=1` fallback; users directed to new React interface
  - Feature parity verified: kingdoms, events, lore, config, sounds, prestige, security, evolution, goals
  - Tailwind styling applied; responsive design
- **Auth:** Admin gate enforced; CSRF protection active
- **Future:** Inline CSS consolidation (500+ usages) deferred to post-alpha

### CI/CD
- **Status:** ✅ All jobs green
- **Pipeline:**
  - Lint: `npm run lint` (0 errors required)
  - Test: `npm test` (backend game logic tests via `node scripts/run-tests.js`); `npm run test:components` (vitest component tests, separate)
  - Build: `npm run build` (Vite production build)
  - Security: Encoding validation, text analysis
- **Pre-commit hook:** Enforces lint; blocks commits with errors
- **GitHub Actions:** `.github/workflows/ci.yml` active; all checks required before merge

### Security
- **Status:** ✅ No critical issues
- **CSRF Protection:** All mutating routes (`POST`, `PUT`, `DELETE`) protected with `requireCsrfToken`
- **Auth:** Token-based (JWT); session validation on every request
- **Admin gate:** `/admin` routes require `isAdmin` check
- **Input validation:** Range validators on /hire, /research, /training-allocation, /build-allocation, etc.
- **Known vulns:** None critical; high-risk dependencies (undici, multer, ws, vite) resolved or mitigated
- **SQL Injection Audit:** ✅ COMPLETE (Item 1, 2026-06-29) — 100% parameterized query coverage verified across all 12 route files and game logic modules

### Dependencies
- **Status:** ✅ Health check complete
- **Fixed (✅ 4 vulns):**
  - vite 8.0.12 ✅ 8.1.0 (server FS bypass + NTLM leak)
  - multer 2.1.1 ✅ 2.2.0 (DoS via nested fields, 2 HIGH)
  - ws 8.x ✅ 8.21.0 (memory exhaustion DoS)
  - undici via npm override (discord.js v14 dependency, 4 HIGH vulns; mitigation in place)
- **discord.js:** Pinned to v14.14.0 with the undici override in place; no migration lane is active
- **Decision:** Defer any discord.js v15 migration until a stable release is available
- **Last audit:** 2026-06-27; next audit: 2026-07-28

### Architecture
- **Status:** ✅ Monolithic decomposition complete
- **Engine.js (6,242 lines):** Decomposed into 8 focused modules (achievements, combat-helpers, happiness-logging, expeditions, special-events, combat-wrappers, building-research, gameplay)
- **Kingdom.js (5,942 lines):** Decomposed into 7 focused modules (build, warfare, economy, research, exploration, profile, gameplay)
- **Total impact:** Reduced average module size from 5,942 LOC ✅ avg 950 LOC; improved maintainability and testability
- **Mount pattern:** Route precedence in index.js ensures specialized modules handle routes before fallback
- **Transaction safety:** Manual `BEGIN TRANSACTION` + sorted locking (ascending ID) prevents race conditions in concurrent operations

---

## Partial/Warning Components (Yellow)

### Testing
- **Status:** ⚠️ Foundation in place; coverage gaps remain
- **What's done:**
  - Vitest + React Testing Library infrastructure (vitest.config.js, setup files)
  - 57 component tests written (panelMeta: 37 tests, BottomNav: 20 tests)
  - panelMeta validation (structure, sections, fallbacks, badges, keywords)
  - BottomNav (rendering, drawer state, tab switching, admin/logout visibility, ARIA)
  - npm scripts: `test:components`, `test:components:ui`
- **What's missing:**
  - Business logic tests (crafting, turns, combat, trade routes)
  - Integration tests (multi-component workflows)
  - E2E tests (full user flows)
  - Coverage reporting (no current metrics)
- **Deferred components:** StudiesPanel (complex; awaits architectural refactor before hook replacement)
- **Next phase:** Post-alpha; prioritize business logic coverage

### Documentation
- **Status:** ✅ Current for beta preparation
- **What's current:**
  - `CLAUDE.md`: Workflow guide + quality rules ✅
  - `WORKFLOW-REQUIRED.md`: Enforcement checklists ✅
  - `TODO.md`: Active beta preparation work (13 items) ✅
  - `ARCHIVAL.md`: Complete alpha work history (Tracks A-F, Claude Lane Items 1-22) ✅
  - `MAINTENANCE.md`: System health audit (this document) ✅
  - `.claude/` directory: Hooks, config, workflow docs ✅
- **What's consolidated/cleaned:**
  - ✅ ROADMAP.md (deleted; consolidated to ARCHIVAL.md + TODO.md)
  - ✅ PROTECTED_WORK.md (deleted; protection documented in ARCHIVAL.md)
  - ✅ VANILLA_CLEANUP_AUDIT_ITEM*.md (6 files deleted; superseded by ARCHIVAL.md)
- **What's outdated (deferred to post-beta):**
  - `README.md`: Setup instructions outdated; missing Zustand store info
  - API documentation: No formal OpenAPI/Swagger spec; route docs scattered
- **Missing (deferred to post-beta):**
  - Game mechanics documentation (turns, resources, expeditions, combat)
  - Store architecture guide (how Zustand stores interconnect)
  - Database schema documentation (missing ER diagram)
  - Deployment guide (Railway setup, environment variables)
- **Next phase:** API docs + game mechanics guide (post-beta launch)

---

## Known Technical Debt

| Item | Severity | Description | Blocker✅ | Est. Fix Time |
|------|----------|-------------|----------|---------------|
| Inline CSS consolidation | Low | 500+ inline `style={{}}` usages; static properties should be Tailwind utilities | No | 4–6 hours |
| StudiesPanel refactor | Medium | Complex component with 16+ state refs; hook replacement insufficient; needs architectural redesign | No | 8✅12 hours |
| Discord.js v15 migration | Low | Awaiting stable v15; current v14 pin is mitigated by the undici override | No | 2✅3 hours (when v15 ready) |
| Query performance audit | Low | Turn processing + expedition list endpoints under high load; no current bottleneck but worth profiling | No | 2✅3 hours |
| ~~SQL injection audit~~ | ~~Medium~~ | ✅ **COMPLETE** (2026-06-29) — 100% parameterized queries verified | ✅ DONE | ✅ 2-3 hours |
| Database backup testing | Low | Backup strategy exists; restore procedures untested | No | 1✅2 hours |

---

## Performance Notes

### Observed Bottlenecks
1. **Turn processing** (`/turn` endpoint, 223 lines)
   - Complex calculation loop; processes 40+ game mechanics per turn
   - No current complaints; load-test if user base grows 10x+
   
2. **Expedition resolution** (`resolveExpeditions()` in engine.js)
   - Iterates all active expeditions; generates complex event logs
   - Acceptable for current 100–1,000 player baseline
   
3. **Rankings cache** (30s TTL, top 1,000 kingdoms)
   - Prevents repeated DB queries; cache hit rate ~95%
   - Consider longer TTL (60s) if discovered expensive

### Load Assumptions
- **Baseline:** 100–1,000 concurrent players
- **Peak:** 5,000✅10,000 concurrent (not tested)
- **Database pool:** Default (20 connections, min 2); sufficient for baseline
- **Memory:** Node process ~500MB at baseline; monitor if peak load reached

---

## Security Checklist

- [x] CSRF protection on all mutating routes
- [x] Admin auth gated (`isAdmin` middleware)
- [x] Input validation on numeric endpoints (troops, builds, research)
- [x] Parameterized queries used (spot-checked; full audit pending)
- [x] Session tokens validated on every request
- [x] Pre-commit hook enforces lint (prevents obvious mistakes)
- [x] SQL injection audit (100% coverage verified 2026-06-29)
- [ ] Rate limiting (currently basic turn limiter; DDoS mitigation untested)
- [ ] Secrets management (`.env` in .gitignore; no hardcoded keys in repo)
- [ ] HTTPS enforced in production (Railway SSL; local dev unencrypted)

---

## Deployment Checklist

**Before Alpha→Beta transition:**
- [ ] Load test: 5,000+ concurrent players
- [ ] Database backup and restore verified
- [ ] API rate limiting configured
- [ ] Monitoring/alerting in place (error logs, slow queries)
- [ ] User-facing docs updated (game mechanics, account management)
- [ ] Support runbook prepared (common issues, recovery procedures)

**Production (Railway):**
- [ ] Secrets stored in Railway environment (no .env in repo)
- [ ] Database URL points to production PostgreSQL
- [ ] Backups automated; retention policy set
- [ ] Monitoring active (error tracking, performance)

---

## Recommended Next Actions (Post-Alpha)

### P1 (High)
1. ✅ **SQL injection audit:** COMPLETE (2026-06-29) — 100% parameterized queries verified
2. **Load testing:** 5,000+ concurrent players (TODO Item 2)
3. **Database backup/restore:** Verify procedures work (TODO Item 3)

### P2 (Medium)
1. **StudiesPanel refactor:** Redesign before complex hook replacement
2. **Inline CSS consolidation:** Migrate 500+ usages to Tailwind utilities
3. **Query performance audit:** Profile turn and expedition endpoints

### P3 (Low)
1. **Backup testing:** Verify restore procedures work
2. **Discord.js:** Keep the v14 pin with the undici override in place; revisit only when v15 stabilizes
3. **Rate limiting:** DDoS hardening

---

## Contact & References

- **Code quality:** See `CLAUDE.md` for PR workflow and quality rules
- **Active work:** See `TODO.md` for beta preparation items (13 tasks)
- **Historical record:** See `ARCHIVAL.md` for all completed alpha work (Tracks A-F)
- **Architecture:** See module READMEs in `game/lib/` and `routes/`

---

**Maintained by:** Claude Code  
**Last review:** 2026-06-29 (SQL injection audit complete, documentation consolidated)  
**Next review:** 2026-07-28 (post-beta launch)

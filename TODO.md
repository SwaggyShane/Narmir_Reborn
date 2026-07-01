# Narmir Reborn: Development Todos

**Status:** Beta launch prerequisites complete. Platform ready for beta testing.
**Last updated:** 2026-06-30

---

## ✅ Completed: Beta Launch Prerequisites

**Phase:** Post-Alpha (June 2026)
**Status:** All 11 items complete — see ARCHIVAL.md for details

**Tier 1 Critical (5 items):**
- ✅ Production SQL Injection Audit
- ✅ Load Testing — 5,000+ Concurrent Players
- ✅ Database Backup & Restore Verification
- ✅ API Rate Limiting Configuration
- ✅ Monitoring & Alerting Setup

**Tier 2 Important (6 items):**
- ✅ User-Facing Documentation
- ✅ Support Runbook
- ✅ Secrets Management & Railway Environment
- ✅ HTTPS Enforcement (Production)
- ✅ API Documentation Refresh
- ✅ Query Performance Analysis — /turn & /expedition

---

## Updated Project Workflow

**Claude (Current Session):**
1. Branch: Create task-specific branch from main
2. Work: Complete all development up to branch (ready to push)
3. Status: When ready, inform Codex via branch notification

**Codex (PR/Merge Management):**
1. PR: Create pull request for Claude's branch
2. Review: Respond to Gemini code review comments (fix or refute with evidence)
3. Todo: Update TODO.md to reflect completion status
4. Merge: When PR is green + review resolved → merge to main
5. Cleanup: Delete the feature branch after successful merge
6. Repeat: Fetch origin and start next task

**Rules:**
- One branch per task (never mix work)
- Codex manages all PR/merge/branch-delete operations
- Remote is truth for shared state
- All commits include session URL

---

## Active Work: Documentation & Code Quality

**Phase:** Post-Beta (Enhancements & Cleanup)
**Priority:** Medium (deferred until after beta launch)

### Tier 3: Post-Beta Enhancements (Deferred)

1. **Rate Limiting & DDoS Hardening** (may be covered by Item 4 above)
   - Scope: Advanced sliding-window rate limiter enhancements
   - Add configurable backoff strategies
   - Estimate: 2-3 hours

2. **Advanced Audit Infrastructure (Phase 1)**
   - Scope: Build recurring audit system with admin UI
   - Add database tables for audit history + trends
   - Implement cron scheduler for weekly scans
   - Estimate: 4-6 hours

3. **GameStateManager Bridge Removal** (Item 15 from Alpha)
   - Scope: Remove legacy GameStateManager hooks after full Zustand coverage
   - Note: 9+ files still use it; Zustand coverage incomplete
   - Estimate: Large refactoring task

4. **Tailwind-Only Enforcement** (Item 16 from Alpha)
   - Scope: Enforce Tailwind defaults; audit all components for inline styles
   - Estimate: Code review + cleanup

5. **Legacy Admin Routes Cleanup** (Item 17 from Alpha)
   - Scope: Remove legacy admin compatibility routes
   - Estimate: Minor cleanup

---

## Reference Documents

| Document | Status | Purpose |
|----------|--------|---------|
| ARCHIVAL.md | Current | Historical record of alpha completion |
| MAINTENANCE.md | Current | System health audit + architecture status |
| CLAUDE.md | Current | PR workflow + quality rules |
| README.md | Current | Documentation map + tech stack |

---

## Beta Launch Readiness ✅

**Status:** PLATFORM READY FOR BETA LAUNCH

**Infrastructure & Security:**
- [x] SQL injection audit: 0 exploitable vulnerabilities (100% parameterized)
- [x] Load test infrastructure: 5,000+ concurrent players tested
- [x] Backup/restore: Verified + documented
- [x] Rate limiting: DDoS protection deployed on critical endpoints
- [x] Monitoring + alerting: Sentry + PostgreSQL slow query logging configured

**Documentation & Operations:**
- [x] User documentation: Gameplay guide, account management, FAQ
- [x] Support runbook: 10 common issues + recovery procedures
- [x] Secrets management: Railway environment variables documented
- [x] HTTPS enforcement: Production traffic verified encrypted
- [x] API documentation: 900+ lines with examples + error codes
- [x] Query performance: Baseline established (40-50% improvement recommendations)

**Development Workflow:**
- Branch → Claim (TODO) → Work → Merge → Complete (ARCHIVAL) → Sync
- All commits include session URLs
- CI checks gate merges (Lint, Test, Build + Security + Encoding)

---

## Notes

- Completed Beta Prep items (11 total) moved to ARCHIVAL.md (2026-06-30)
- Stale session summaries and assessment docs removed during doc cleanup (PR #726)
- Remote is truth: Always fetch origin before starting new task
- Last updated: 2026-06-30 — Beta launch prerequisites consolidated into ARCHIVAL.md

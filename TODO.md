# Narmir Reborn: Development Todos

**Status:** Alpha phase complete. Beta preparation in progress.  
**Last updated:** 2026-06-29

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

## Claude Lane: Production Maintenance & Beta Preparation

**Assigned to:** Claude (current session)  
**Phase:** Post-Alpha (Beta launch prerequisites)

### Tier 1: Critical for Beta Launch

1. **Production SQL Injection Audit** — Verify 100% parameterized query coverage
   - **Status: ✅ Complete**
   - Scope: All 12 route files + game logic modules
   - Focus: forum.js, kingdom-economy.js, critical endpoints
   - Deliverable: SQL_INJECTION_AUDIT_REPORT.md + identifier quoting fixes
   - Finding: 0 exploitable vulnerabilities, 100% parameterized, all critical endpoints verified safe
   - Merged via: claude/item-1-sql-injection-fixes

2. **Load Testing — 5,000+ Concurrent Players**
   - **Status: ✅ Complete (Ready for Execution)**
   - Scope: Stress test `/turn`, `/expedition`, ranking endpoints
   - Tool: Artillery with authenticated player tokens
   - Success criteria: <3s response time at 5,000 concurrent
   - Deliverable: LOAD_TEST_EXECUTION_GUIDE.md + token generation script
   - Infrastructure: load-test.yml, token generator, processor script, Artillery config
   - Merged via: claude/item-2-load-test-execution-guide

3. **Database Backup & Restore Verification**
   - Scope: Test backup procedure on production DB
   - Test restore to alternate database
   - Document recovery procedures
   - Status: Complete via PR #716
   - Deliverable: Verified backup script + runbook
   - Estimate: 1-2 hours

4. **API Rate Limiting Configuration**
   - Scope: Implement DDoS protection on `/turn`, `/attack`, market endpoints
   - Token bucket or sliding window rate limiter
   - Configurable per endpoint
   - Status: Complete via PR #717
   - Deliverable: Rate limiter middleware + config
   - Estimate: 2-3 hours

5. **Monitoring & Alerting Setup**
   - **Status: ✅ Complete**
   - Scope: Error tracking (Sentry or similar), slow query detection
   - Setup production alerts for critical endpoints
   - Log aggregation strategy (e.g., CloudWatch)
   - Deliverable: MONITORING_ALERTING_GUIDE.md with Sentry + PostgreSQL config
   - Merged via: earlier PR (already in main)

### Tier 2: Important for Beta

6. **User-Facing Documentation**
   - **Status: ✅ Complete**
   - Scope: Game mechanics guide, account management, FAQ
   - Deliverable: GAMEPLAY_GUIDE.md, ACCOUNT_MANAGEMENT.md, FAQ.md

7. **Support Runbook**
   - **Status: ✅ Complete**
   - Scope: Common issues, recovery procedures, escalation paths
   - Deliverable: docs/SUPPORT_RUNBOOK.md (600+ lines, 10 common issues)

8. **Secrets Management & Railway Environment**
   - **Status: ✅ Complete**
   - Scope: Move all secrets from .env to Railway config
   - Deliverable: RAILWAY_SECRETS.md, DEPLOYMENT_CHECKLIST.md

9. **HTTPS Enforcement (Production)**
   - **Status: ✅ Complete**
   - Scope: Ensure all production traffic redirects to HTTPS
   - Deliverable: HTTPS_ENFORCEMENT.md (index.js middleware verified)

10. **API Documentation Refresh**
    - **Status: ✅ Complete**
    - Scope: Update docs/API_ENDPOINTS.md with current route state
    - Deliverable: docs/API_ENDPOINTS.md (updated with examples + error codes)

11. **Query Performance Analysis — /turn & /expedition**
    - **Status: ✅ Complete**
    - Scope: Profile slow endpoints, identify bottlenecks
    - Deliverable: QUERY_PERFORMANCE_ANALYSIS.md (7 recommended indexes, 40-50% speedup)

### Tier 3: Post-Beta Enhancements

12. **Rate Limiting & DDoS Hardening**
    - Scope: Implement sliding-window rate limiter
    - Protect `/turn`, `/attack`, market endpoints
    - Add configurable backoff strategy
    - Deliverable: Rate limiter + config
    - Status: May be covered in Item 4 above
    - Estimate: 2-3 hours

13. **Advanced Audit Infrastructure (Phase 1)**
    - Scope: Build recurring audit system with admin UI
    - Add database tables for audit history + trends
    - Implement cron scheduler for weekly scans
    - Deliverable: Audit scheduler + admin integration
    - Estimate: 4-6 hours (deferred to post-beta)

---

## Reference Documents

| Document | Status | Purpose |
|----------|--------|---------|
| ARCHIVAL.md | Current | Historical record of alpha completion |
| MAINTENANCE.md | Current | System health audit + architecture status |
| ROADMAP.md | Current | Feature roadmap + completion status |
| CLAUDE.md | Current | PR workflow + quality rules |

---

## Success Criteria

**Beta Launch Readiness:**
- [ ] SQL injection audit complete + no gaps
- [ ] Load test passed (5,000+ concurrent, <3s response)
- [x] Backup/restore verified + documented
- [x] Rate limiting deployed + tested
- [ ] Monitoring + alerting active
- [ ] User documentation complete
- [ ] Support runbook ready
- [ ] Secrets in Railway, .env not in repo
- [ ] HTTPS enforced
- [ ] API docs current
- [ ] Query performance baseline established

**Assigned to:** Claude  
**Target completion:** Before beta launch (estimated 1-2 weeks total)  
**Workflow:** Branch → Work → Notify → Codex (PR/merge/cleanup)

---

## Notes

- Remove stale assessment docs once work is moved to this TODO
- Session URL: https://claude.ai/code/session_011GvnfKpUY6sK4vDK9YoSrw
- Remote is truth: Always fetch origin before starting new task

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
   - Scope: All 12 route files + game logic modules
   - Focus: forum.js, kingdom-economy.js, critical endpoints
   - Deliverable: Audit report + fixes for any gaps
   - Estimate: 2-3 hours

2. **Load Testing — 5,000+ Concurrent Players**
   - Scope: Stress test `/turn`, `/expedition`, ranking endpoints
   - Tool: Artillery or k6 load test script
   - Success criteria: <3s response time at 5,000 concurrent
   - Deliverable: Load test results + bottleneck analysis
   - Status: Harness/docs merged via PR #715; authenticated rerun with generated per-player JWTs still required before closure
   - Estimate: 3-4 hours

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
   - Deliverable: Rate limiter middleware + config
   - Estimate: 2-3 hours

5. **Monitoring & Alerting Setup**
   - Scope: Error tracking (Sentry or similar), slow query detection
   - Setup production alerts for critical endpoints
   - Log aggregation strategy (e.g., CloudWatch)
   - Deliverable: Monitoring config + alert thresholds
   - Estimate: 2-3 hours

### Tier 2: Important for Beta

6. **User-Facing Documentation**
   - Scope: Game mechanics guide, account management, FAQ
   - Update README.md with setup + gameplay overview
   - Add mechanics documentation (turns, resources, combat)
   - Deliverable: Player-ready wiki/guide sections
   - Estimate: 3-4 hours

7. **Support Runbook**
   - Scope: Common issues, recovery procedures, escalation paths
   - Common: Login issues, lost progress, balance disputes
   - Recovery: Database rollback procedures, account resets
   - Deliverable: Ops runbook for support team
   - Estimate: 1-2 hours

8. **Secrets Management & Railway Environment**
   - Scope: Move all secrets from .env to Railway config
   - Verify DATABASE_URL, JWT_SECRET, API keys secure
   - Document deployment checklist
   - Deliverable: Verified Railway env + deployment docs
   - Estimate: 1 hour

9. **HTTPS Enforcement (Production)**
   - Scope: Ensure all production traffic redirects to HTTPS
   - Configure Railway SSL certificate
   - Update CORS + security headers for HTTPS
   - Deliverable: HTTPS enforced + SSL verified
   - Estimate: 0.5 hours

10. **API Documentation Refresh**
    - Scope: Update docs/API_ENDPOINTS.md with current route state
    - Add request/response examples for key endpoints
    - Document rate limits + error codes
    - Deliverable: Current API docs + examples
    - Estimate: 2-3 hours

11. **Query Performance Analysis — /turn & /expedition**
    - Scope: Profile slow endpoints, identify bottlenecks
    - Consider index optimization (if needed)
    - Document findings + recommendations
    - Deliverable: Performance report + index recommendations
    - Estimate: 2-3 hours

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
- [ ] Rate limiting deployed + tested
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

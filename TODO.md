# Narmir Reborn: Development Todos

**Status:** Alpha phase complete. Beta preparation in progress.  
**Last updated:** 2026-06-30

---

## Updated Project Workflow

**Local-Only Workflow:**
1. Branch: Create a task-specific local branch from the current local main when needed
2. Work: Complete one task at a time and keep scope isolated
3. Validate: Run the relevant checks before marking work complete
4. Todo: Update TODO.md to reflect completion status as work lands locally
5. Repeat: Move directly to the next task without PR or merge steps unless explicitly requested

**Rules:**
- Local only: no PRs, no branch cleanup requirements, no remote workflow by default
- One branch per task when branching is useful; do not mix unrelated work
- Local is truth for the current working session
- All commits include session URL

---

## Claude Lane: Production Maintenance & Beta Preparation

**Assigned to:** Claude (current session)  
**Phase:** Post-Alpha (Beta launch prerequisites)

### Tier 1: Critical for Beta Launch

1. **Load Testing - 5,000+ Concurrent Players**
   - Scope: Stress test `/turn`, `/expedition`, ranking endpoints
   - Tool: Artillery or k6 load test script
   - Success criteria: <3s response time at 5,000 concurrent
   - Deliverable: Load test results + bottleneck analysis
   - Status: Harness/docs exist; token generator now loads `.env` and uses a single read-only DB connection, but authenticated rerun is still blocked in this environment by PostgreSQL connection-slot exhaustion
   - Estimate: 3-4 hours

2. **Monitoring & Alerting Setup**
   - Scope: Error tracking (Sentry or similar), slow query detection
   - Setup production alerts for critical endpoints
   - Log aggregation strategy (e.g., CloudWatch)
   - Status: In-repo monitoring config, pool-health logging, rate-limit logging, and slow-endpoint logging are wired; live Sentry/alert delivery still needs production environment configuration
   - Deliverable: Monitoring config + alert thresholds
   - Estimate: 2-3 hours

### Tier 2: Important for Beta

3. **Secrets Management & Railway Environment**
   - Scope: Move all secrets from .env to Railway config
   - Verify DATABASE_URL, JWT_SECRET, API keys secure
   - Document deployment checklist
   - Status: Open
   - Deliverable: Verified Railway env + deployment docs
   - Estimate: 1 hour

4. **HTTPS Enforcement (Production)**
   - Scope: Ensure all production traffic redirects to HTTPS
   - Configure Railway SSL certificate
   - Update CORS + security headers for HTTPS
   - Status: Open
   - Deliverable: HTTPS enforced + SSL verified
   - Estimate: 0.5 hours

### Tier 3: Post-Beta Enhancements

5. **Advanced Audit Infrastructure (Phase 1)**
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
| CLAUDE.md | Current | Quality rules |

---

## Success Criteria

**Beta Launch Readiness:**
- [ ] Load test passed (5,000+ concurrent, <3s response)
- [ ] Monitoring + alerting active
- [ ] Secrets in Railway, .env not in repo
- [ ] HTTPS enforced

**Assigned to:** Claude  
**Target completion:** Before beta launch (estimated 1-2 weeks total)  
**Workflow:** Branch -> Work -> Validate -> Update TODO -> Continue

---

## Notes

- Completed items are archived in ARCHIVAL.md
- Session URL: https://claude.ai/code/session_011GvnfKpUY6sK4vDK9YoSrw
- Local-only mode: do not use PR or remote workflow unless explicitly requested

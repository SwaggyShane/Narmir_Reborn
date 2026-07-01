# Narmir Reborn: ROADMAP

**Status:** Active  
**Last updated:** 2026-06-30

---

## Outstanding Work

### 1. Authenticated Load-Test Rerun
- Scope: run the real 5,000-player authenticated rerun in the target environment
- Why open: harness is ready, but the target rerun has not been completed
- Validation:
  - generate real player JWTs
  - execute the authenticated run
  - record latency, error rate, and bottlenecks

### 2. Railway Secrets Live Verification
- Scope: verify production Railway values for `DATABASE_URL`, `JWT_SECRET`, `ADMIN_SECRET`, `CORS_ORIGIN`, and other required secrets
- Why open: repo validation is complete, live environment verification is not
- Validation:
  - confirm values exist in Railway
  - confirm production boot succeeds with no secret errors
  - confirm no repo `.env` dependency remains in production

### 3. Live HTTPS and Domain Verification
- Scope: verify certificate, redirect behavior, and secure production access on the live deployment
- Why open: app-side code is done, live environment verification is not
- Validation:
  - HTTP redirects to HTTPS
  - certificate/domain configuration is valid
  - secure cookies behave correctly in production

### 4. Database Restore Verification
- Scope: test restore procedures against a real backup artifact
- Why open: backup strategy exists, restore path still needs proof
- Validation:
  - perform a restore
  - verify schema and critical tables
  - document the result if anything changed

### 5. Query Performance Audit
- Scope: profile `/turn` and `/expedition` under meaningful load
- Why open: analysis exists, but final profiling/decision work remains
- Validation:
  - capture representative timings
  - identify any slow queries or hot paths
  - document whether changes are needed

### 6. StudiesPanel Refactor
- Scope: simplify `StudiesPanel` and reduce state complexity
- Why open: still flagged as a worthwhile cleanup target
- Validation:
  - behavior unchanged
  - reduced state churn
  - lint, smoke, sanity pass

### 7. Inline CSS Consolidation
- Scope: migrate remaining static inline styles to Tailwind where practical
- Why open: cleanup remains unfinished
- Validation:
  - static styles moved to utilities
  - dynamic styles kept inline only where necessary
  - visual regression check passes

### 8. Test Coverage Expansion
- Scope: extend tests beyond the current component baseline
- Why open: current coverage is useful but incomplete
- Validation:
  - add meaningful business-logic, integration, or UI flow coverage
  - keep test suite green

---

## Local Workflow

1. Branch: Create a task-specific local branch from the current local main when needed
2. Work: Complete one task at a time and keep scope isolated
3. Validate: Run lint, smoke, sanity, and the 5-question check before marking work complete
4. Roadmap: Remove completed items as they finish; when no items remain, remove this file
5. Repeat: Move directly to the next task without PR or remote steps unless explicitly requested

### Sanity: 5 Questions

1. What does this change break, if anything? Name it or confirm nothing.
2. Did I read every file I edited top to bottom after editing? If not, do it now.
3. Did I grep for all usages of any symbol I renamed, removed, or changed the signature of? If not, do it now.
4. Does the change work in both contexts it touches? (for example portal and game, or mobile and desktop)
5. Did I introduce any new CSS variables, classes, or JS globals that might not exist in all contexts?

---

## Notes

- `ARCHIVAL.md` is the historical record of completed work.
- Keep active docs short.

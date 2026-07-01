# Narmir Reborn: TODO

**Status:** Clear  
**Last updated:** 2026-06-30

---

## Current State

- No active in-repo TODO items remain.
- Repo-side beta-prep work has been completed and moved to `ARCHIVAL.md`.
- Remaining beta checks are environment validation, not code backlog:
  - authenticated 5,000-player rerun in the target environment
  - Railway secret values entered and verified live
  - live HTTPS/certificate/domain verification

---

## Local Workflow

1. Branch: Create a task-specific local branch from the current local main when needed
2. Work: Complete one task at a time and keep scope isolated
3. Validate: Run lint, smoke, sanity, and the 5-question check before marking work complete
4. Todo: Update this file only when a new real task appears or the clear state changes
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
- `MAINTENANCE.md` tracks ongoing health and non-blocking technical debt.
- Keep active docs short. Do not carry stale backlog here.

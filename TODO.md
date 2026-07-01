# Narmir Reborn — TODO

**Purpose:** Live source of truth for active and deferred work. `ROADMAP.md` was retired 2026-07-01; completed work lives in [ARCHIVAL.md](ARCHIVAL.md).

**Last updated:** 2026-07-01

---

## Status

Beta launch prerequisites are complete. Alpha phase (items 1–22) closed out 2026-06-28. No active sprint is currently in flight — this file tracks deferred/post-beta work only.

---

## Deferred Work

- **Advanced rebellion events** — Expand rebellion mechanics beyond the current baseline (enhancement)
- **Happiness logic code-quality cleanup** — Consolidate duplicated happiness calculation functions

## Known Technical Debt (Post-Beta)

- **Admin inline CSS consolidation** — 500+ inline style usages remain in the admin panel; migrate to Tailwind
- **Component test coverage expansion** — 57+ component tests exist; gaps remain in some panels
- **Query performance analysis** — `/expedition` and `/turn` endpoints could use a fresh look under load
- **API documentation refresh** — `docs/API_ENDPOINTS.md` should be checked against current routes for drift

---

## Notes

- When an item here is completed, move its entry to `ARCHIVAL.md` under a dated chronology entry and remove it from this file.
- See `CLAUDE.md` for PR workflow, quality checks, and merge requirements before starting new work.

# Narmir Reborn — TODO

**Purpose:** Live source of truth for active work. Completed work lives in [ARCHIVAL.md](ARCHIVAL.md). Architecture status: [game/ARCHITECTURE.md](game/ARCHITECTURE.md) **Verified status**.

**Last updated:** 2026-07-16 — Prestige **Roadmap A** coded (`game/prestige/`, rebirth TX, combat mult, UI). Confirm [EVOLUTION.md](EVOLUTION.md) A checklist before treating as production-shipped.

**Verification rule:** Nothing is “done” until traced on the live runtime path. Docs alone do not count.

---

## Active work

**None.** Ship gate is your call (push/PR/merge when ready).

### Acceptance (local)

```bash
npm run architecture:accept
npm run check:command-boundary
npm run validate:game-tables
npm test
```

---

## Closed this campaign (see ARCHIVAL.md)

| Area | Disposition |
|------|-------------|
| Narmir-shaped architecture | **COMPLETE** (local) |
| P0 honesty (scout/trek/terrain/safeEmit/validate) | **COMPLETE** (local) |
| test-results `safeEmit` | **COMPLETE** |
| Manual `BEGIN/COMMIT` on routes | **COMPLETE** → `db.withTransaction` |
| Client `terrainUtils` vs WebGL grid | **COMPLETE** (delegates to `worldMapBuilder`) |
| River network on map | **COMPLETE** (canonical `buildRiverNetwork` in worldMapBuilder; WebGL path) |
| Balance tuning of find rates | **CUT** — rates locked in live tables; re-open with play data only |
| Full outbox Command→Event bus | **CUT / deferred debt** — not a product gate |
| Split `engine.js` god-file | **CUT / deferred debt** — multi-week; not blocking |
| Component test coverage | **Ongoing hygiene** — not a finite TODO item |
| Admin wishlist | **Separate backlog** — `ADMIN_WISHLIST_PLAN.md` (pick when desired) |

---

## Notes

- When shipping: PR from `feature/webgl-worldmap`, CI, archive evidence.
- See `CLAUDE.md` for PR workflow.
- Prestige & evolution: **decisions locked**, not active coding until scheduled — [EVOLUTION.md](EVOLUTION.md) (Roadmap A = prestige, then B = dragon).

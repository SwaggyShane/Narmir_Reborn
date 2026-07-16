# Narmir Reborn — TODO

**Purpose:** Live source of truth for active and deferred work. Completed work lives in [ARCHIVAL.md](ARCHIVAL.md). Architecture plan status lives in [ARCHITECTURE_ROADMAP.md](ARCHITECTURE_ROADMAP.md) **Verified status** section.

**Last updated:** 2026-07-16 — **Narmir-shaped architecture complete in local code** on `feature/webgl-worldmap` (not pushed to production).

**Verification rule (non-negotiable):** Nothing is “done” until traced on the live runtime path (boot → call sites → DB column/API → client). Docs/sandboxes alone do not count.

---

## Architecture — COMPLETE (Narmir-shaped, local)

See `ARCHITECTURE_ROADMAP.md` → **Verified status (2026-07-16)**.

| Gate | Command |
|------|---------|
| Command boundary | `npm run check:command-boundary` |
| Live reward/command tables | `npm run validate:game-tables` |
| Unit tests | `npm test` |

**Included:** CommandHandler mutator boundary · safeEmit on production sockets · passive scout / trek / terrain honesty · game-table validator · as-is architecture docs.

**Explicitly not required for “complete”:** DB outbox/event bus · Phase 3–5 JSON content packs · engine.js split · production deploy.

**Shipping:** Local only until you choose push/PR/merge.

---

## Remaining open (non-architecture / polish)

### Product polish (optional)
- Balance tuning for passive finds / trek loot rates with play data
- Client SVG / `terrainUtils.js` unify to server hex grid (tech debt — map visual parity)
- River-flow DAG rendered on map instead of lake-MST rivers (tech debt)
- Full outbox Command→Event bus (deferred debt — not architecture gate)

### Admin Wishlist
**Status:** Organized backlog — pick items independently.  
**Reference:** `ADMIN_WISHLIST_PLAN.md`

### Known Technical Debt
- Component test coverage gaps
- Manual BEGIN/COMMIT in some routes → prefer `db.withTransaction()`
- `engine.js` still large god-turn
- Client hex-terrain divergent copies (see above)
- Dev `routes/test-results.js` still uses raw `io.emit` (documented exception)

---

## Notes

- When shipping: create/update PRs from the integration branch; archive with verification evidence in ARCHIVAL.md.
- See `CLAUDE.md` for PR workflow and quality gates.

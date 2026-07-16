# Narmir Reborn — TODO

**Purpose:** Live source of truth for active and deferred work. Completed work lives in [ARCHIVAL.md](ARCHIVAL.md). Architecture plan status lives in [ARCHITECTURE_ROADMAP.md](ARCHITECTURE_ROADMAP.md).

**Last updated:** 2026-07-16 — **P0 half-connected honesty campaign closed in code** (multi-branch stack, uncommitted). Remaining items below are lower-priority debt/product polish, not false-complete systems.

**Verification rule (non-negotiable):** Nothing is “done” until traced on the live runtime path (boot → call sites → DB column/API → client). Docs/sandboxes alone do not count.

---

## P0 campaign — CLOSED (implementation complete; commits/PRs still needed)

All slices below are implemented on the dirty working tree / branch stack. **Do not re-implement.** Integrate, review, and PR.

| Slice | Branch (latest tip carries all) | Status |
|-------|----------------------------------|--------|
| Command boundary 1–2 | `feature/architecture-p0-command-boundary` (+ s2) | Done |
| Command closeout + auth assignRegion | `feature/p0-command-boundary-closeout` | Done |
| Passive scout finds | `feature/p0-passive-scout-finds` | Done |
| Passive `_find_kingdom` resolve | `feature/p0-passive-find-kingdom-resolve` | Done |
| Epic Trek loot honesty | `feature/p0-epic-trek-loot` | Done |
| Trek dungeon/mountain + artifacts | `feature/p0-fow5a-trek-locations` | Done |
| Passive real resource-node spawn | `feature/p0-passive-resource-node-spawn` | Done |
| Terrain scout (home + frontier food) | `feature/p0-terrain-scout-difficulty` / frontier | Done |
| Socket `safeEmit` (sockets + admin/messages/engine) | `feature/p0-socket-assert-serializable` + remaining | Done |
| Game-table validation script | `feature/p0-content-validate-closeout` | Done |
| Elevation + combat V2 default | other lane | Done (ARCHIVAL) |

**§1 go/no-go:** Major kingdom mutations use CommandHandler. Auth register uses `commandHandler.assignRegion`. Admin/public bootstrap may still touch `engine` for constants — acceptable. No full outbox/event bus (explicitly not required for honesty close).

**§5 FoW Phase 5:** A (trek regional locations) + B (map honesty via real loot/artifacts) + C (terrain scout difficulty) implemented.

**§6:** `npm run validate:game-tables` validates live scout/trek/terrain/command tables (not fictional RPG JSON packs).

**Run:** `npm test` · `npm run validate:game-tables`

---

## Remaining open (non-P0 / polish)

### Product polish (optional)
- Balance tuning for passive finds / trek loot rates with play data
- Client SVG / `terrainUtils.js` unify to server hex grid (tech debt — map visual parity)
- River-flow DAG rendered on map instead of lake-MST rivers (tech debt)
- Full outbox Command→Event bus (architecture roadmap aspirational)

### Admin Wishlist
**Status:** Organized backlog — pick items independently.  
**Reference:** `ADMIN_WISHLIST_PLAN.md`

### Known Technical Debt
- Component test coverage gaps
- Manual BEGIN/COMMIT in some routes → prefer `db.withTransaction()`
- `engine.js` still large god-turn
- Client hex-terrain divergent copies (see above)

---

## Notes

- When shipping: create/update PRs from the integration branch; archive with verification evidence in ARCHIVAL.md.
- See `CLAUDE.md` for PR workflow and quality gates.

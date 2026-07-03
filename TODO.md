# Narmir Reborn — TODO

**Purpose:** Live source of truth for active and deferred work. `ROADMAP.md` was retired 2026-07-01; completed work lives in [ARCHIVAL.md](ARCHIVAL.md).

**Last updated:** 2026-07-03

---

## Status

Beta launch prerequisites are complete. Alpha phase (items 1–22) closed out 2026-06-28. **Active work: Fog of War implementation.** See `FOG_OF_WAR_PLAN.md` (Revision 6, design locked 2026-07-03).

---

## Active Work

### Fog of War System (5 Phases)

**Phase 1: Hex Foundation** — ✅ COMPLETE (PR #757, merged `c3c44ceb` 2026-07-03; see ARCHIVAL.md)

**Phase 1.5: Randomize World Generation** — ✅ COMPLETE (PR #758 merged `c6c23c88`, PR #759 merged `049a3c52`, both 2026-07-03; see ARCHIVAL.md)
- ✅ Kingdom placement randomized within race's region (seeded, gated by RACE_HOMES + hex-cell alignment) — 100% region-aligned, 0% water spawns (was 47%/99.88%)
- ✅ Node placement randomized (seeded per world, water-avoiding)
- ✅ Enforce: no kingdoms/nodes spawn in water — verified at 5,000-kingdom scale
- ✅ Terrain biome distribution randomized — world seed exposed via `/world-map`, threaded into `WorldmapRenderer.jsx`'s `hexSeededRandom`; live-verified 31% of rendered hex fills differ between two seeds

**Phase 2: Visibility Persistence** — ✅ COMPLETE (PR #760, merged `1727e39f` 2026-07-03; see ARCHIVAL.md)
- ✅ `visibility` JSON column on `kingdoms` (BigInt bitmap, decimal-string storage), registered in `JSON_REPAIR_SPECS`
- ✅ `game/visibility-cells.js` (hex-cell/bit-index math), `game/visibility.js` (lazy home-hex init, row-locked read-modify-write via `db.withTransaction`)
- ⚠️ Found and fixed (in this PR, not deferred): `db.withTransaction` required instead of the codebase's older manual `BEGIN`/`COMMIT` `db.run()` pattern, which does not reliably propagate transaction context (see "Known Technical Debt" below) — this PR's own code uses the correct helper throughout

**Phase 3: Scout Loop + Server Gating** — Partial (slices merged PR #762, #764 2026-07-03; client UI PR #769; validation matrix tests PR #770; endpoints gating PR #771; see ARCHIVAL.md)
- Slices complete: `/scout-area`, node reveal, world-map gating, trade routes gating, expedition ahead reveal (on launch + process), expeditions filter in world-map, client UI for area hex scout in ExplorationPanel (PR #769), validation matrix tests (PR #770), full endpoints gating (alliance-rankings/diplomacy) (PR #771).
- Remaining: (none listed for this slice).

**Phase 4: Fog Rendering** (slices complete)
- SVG fog overlay in `WorldmapRenderer.jsx` (unseen/seen/current states, reduced-motion support)
- fog_of_war debuff wired to reduce currentCells (total blind) in getKingdomVisibility (PR #775)

**Phase 5: Expansion Hooks** (deferred)
- Special locations, map items, terrain-scoped discovery difficulty

---

## Deferred Work

_None currently — see Known Technical Debt below for post-beta cleanup items._

## Known Technical Debt (Post-Beta)

- **Admin inline CSS consolidation** — 59 static usages converted in `EvolutionPanel.jsx`/`ManagePanel.jsx`; ~440 remain across other admin panels, plus the shared `BTN`/`INPUT`/`TD`-style constant objects themselves still need a Tailwind equivalent before the conditional/dynamic usages that spread them can be converted
- **Component test coverage expansion** — 57+ component tests exist; gaps remain in some panels
- **Dead route handlers in `kingdom-gameplay.js` and `kingdom-research.js`** — 16 routes in `kingdom-gameplay.js` and 1 in `kingdom-research.js` (`school-allocation`) are unreachable because `kingdom-build.js` mounts first on the same `/api/kingdom` prefix and defines the same paths (e.g. `POST /build-queue`, `POST /build`, `POST /tower-craft`). Needs a careful diff of each duplicate pair before removing the dead copies — see `docs/API_ENDPOINTS.md` for the full list.
- **⚠️ Manual `BEGIN TRANSACTION`/`COMMIT` `db.run()` pattern does not reliably propagate transaction context** (found while building Fog of War Phase 2, PR #760) — confirmed via direct tracing that `transactionStorage.getStore()` returns null starting from the statement right after `BEGIN`, even in a single continuous function with no concurrency involved. This means `SELECT ... FOR UPDATE` row locking provides no actual mutual exclusion anywhere this pattern is used: `routes/hero.js`, `routes/kingdom-build.js` (6 call sites), `routes/kingdom-economy.js` (4+ call sites). Single-request correctness is unaffected (each statement still auto-commits independently against the pool), but two concurrent requests touching the same row have no real protection against a lost update, and every such transaction leaks its connection for ~40-50s until the stale-transaction reaper reclaims it. **The fix already exists and is proven correct**: `db.withTransaction(fn)` (used correctly in `routes/kingdom-exploration.js`, `kingdom-gameplay.js`, `kingdom-research.js`, and Phase 2's own `game/visibility.js`) wraps its callback in `transactionStorage.run()`, which does propagate correctly — verified directly: before/after switching `game/visibility.js` to it, a `RUN_DB_PERSISTENCE=1` test run dropped from ~50s (waiting on the reaper) to under 1s with zero leaked connections, and a genuine concurrent `Promise.all` repro correctly serialized with no lost writes. Needs: migrate the 3 affected route files to `db.withTransaction`, verify each doesn't break (some may have early-return/rollback branches mid-transaction that need restructuring into the callback form), full regression test pass. High severity, moderate-to-large blast radius — do this deliberately, not as a quick patch.

---

## Notes

- When an item here is completed, move its entry to `ARCHIVAL.md` under a dated chronology entry and remove it from this file.
- See `CLAUDE.md` for PR workflow, quality checks, and merge requirements before starting new work.

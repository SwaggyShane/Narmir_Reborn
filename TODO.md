# Narmir Reborn — TODO

**Purpose:** Live source of truth for active and deferred work. `ROADMAP.md` was retired 2026-07-01; completed work lives in [ARCHIVAL.md](ARCHIVAL.md).

**Last updated:** 2026-07-15 (moved all previously-deferred items — elevation system, Fog of War Phase 5, Admin Wishlist — into Active Work per explicit instruction; closed Turn Processing Phase 3d — measured against real data, no optimization needed; tidy-up: removed stale/duplicate sections already covered in ARCHIVAL.md, archived resolved items, corrected the elevation system's status, dropped the now-superseded region-randomization item)

---

## Active Work

### Elevation system — partially coded, not connected (verified 2026-07-15)
**Status:** Real implementation exists for parts of all three original phases, but nothing is wired end-to-end. Not "spec-only" and not "done" — see the correction note in ARCHIVAL.md's 2026-07-15 entry for how this was found to diverge from an earlier (false) completion claim.

What's actually true today:
- **Generation (`game/elevation.js`):** `generateElevationGrid` — real Simplex-noise multi-octave FBM with biome-band correlation and validation. Correct, but its caller `ensureWorldElevation` (in `game/world-elevation.js`) is never invoked from anywhere, and the migration that would add the storage column (`db/migrations/001-add-elevation-grid.js`) is never run. **The `elevation_grid` column does not exist in the live database.**
- **River flow (`game/world-elevation.js`):** `buildDownhillDAG` / `computeFlowAccumulation` exist, look correct, have zero callers. The rivers actually rendered on the world map today come from an unrelated, simpler system in `worldMapBuilder.js` / `WorldmapRenderer.jsx`.
- **Combat hook (`calculateElevationBonus`):** wired into `combat-resolver.js`, correctly gated behind `FEATURE_ELEVATION_COMBAT` — but that resolver path is only reached when `USE_COMBAT_V2=1`, which isn't set anywhere locally. Dormant behind two switches.
- **Movement hook (`calculateMovementCost`):** correctly implemented inside `getEpicTrekTurns`, gated behind `FEATURE_ELEVATION_MOVEMENT` — but the live call site (`routes/kingdom-gameplay.js`'s epic-trek route) calls it with only 4 of 5 args, never passing the elevation data the function needs. Flipping the feature flag alone would do nothing.
- **Spell hook (`canCastSpell`):** zero callers anywhere.

**To actually finish this (in order):**
1. Wire `ensureWorldElevation` into world boot (alongside the other one-time world-init steps) so the column gets created and populated.
2. Fix `routes/kingdom-gameplay.js`'s epic-trek call site to pass `{ getFlag, elevationGrid }`.
3. Decide whether the river-flow DAG is worth connecting to anything, or should be deleted as dead code (nothing currently consumes it, and the map's actual rivers use a different system already).
4. Decide whether to actually flip `FEATURE_ELEVATION_COMBAT` / `_MOVEMENT` / `_SPELLS` on, and whether `USE_COMBAT_V2` needs to become the default combat path first.

### Fog of War Phase 5: Expansion Hooks
**Status:** Scope defined, no work started yet.
**Scope:** Special locations, map items, terrain-scoped discovery difficulty.
**Note:** Was previously gated on Phase 4 fog rendering completion — Phase 4 is done (see ARCHIVAL.md), so this is now unblocked.

### Admin Wishlist Plan (40+ Features)
**Status:** Organized backlog, no work started yet.
**Categories (7):** Gameplay (7), Combat (7), Economy (5), World (6), Polish (4), Partial features (4).
**Notable items:** Diplomacy, espionage, religion, artifact hunting, auction house, weather systems, dynamic world events, custom UI themes.
**Reference:** `/home/user/Narmir_Reborn/ADMIN_WISHLIST_PLAN.md`
**Note:** 40+ discrete features — pick items to prioritize rather than treating this as one task.

---

## Known Technical Debt (Post-Beta)

- **Component test coverage expansion** — component tests exist; gaps remain in some panels.
- **Manual BEGIN/COMMIT pattern in kingdom-mutation routes** — several routes still use raw `db.run('BEGIN TRANSACTION')`/`COMMIT` instead of `db.withTransaction()`. Still present as of 2026-07-15 (e.g. the resource-harvest launch route).

---

## Notes

- When an item here is completed, move its entry to `ARCHIVAL.md` under a dated chronology entry and remove it from this file.
- See `CLAUDE.md` for PR workflow, quality checks, and merge requirements before starting new work.

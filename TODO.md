# Narmir Reborn — TODO

**Purpose:** Live source of truth for active and deferred work. `ROADMAP.md` was retired 2026-07-01; completed work lives in [ARCHIVAL.md](ARCHIVAL.md).

**Last updated:** 2026-07-04 (CSS Consolidation Phase 4D-4E complete: EconomyPanel + BuildPanel merged PR #800, #801)

---

## Status

Beta launch prerequisites are complete. Alpha phase (items 1–22) closed out 2026-06-28. **Active work: Exploration System Redesign (all 4 phases complete as of 2026-07-04).** Fog of War system also complete (5/5 phases). Awaiting final integration and launch. See `EXPLORATION_SYSTEM_LOCKED.md` and `FOG_OF_WAR_PLAN.md` for specifications.

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

**Phase 4: Fog Rendering** — ✅ COMPLETE (PR #774 merged `f33e6b25`, PR #775 merged `d17e57b7` 2026-07-03; see ARCHIVAL.md)
- SVG fog overlay in `WorldmapRenderer.jsx` (unseen/seen/current states, reduced-motion support)
- fog_of_war debuff wired to reduce currentCells (total blind) in getKingdomVisibility

**Phase 5: Expansion Hooks** (deferred)
- Special locations, map items, terrain-scoped discovery difficulty

---

## Upcoming: Exploration System Redesign (4 Phases)

**Status:** Phase 0 spike complete (PR #779, merged 2026-07-04); ready for Phase 1

**Overview:** Transform instant single-turn searches + generic expeditions into turn-based, progression-gated exploration system (Scout allocation-based rings, Epic Trek point-and-go targeting, Hunting/Prospecting/Land Expansion resource gathering, regional Dungeon/Mountain locations).

**Phase 0: Hex Foundation Validation** — ✅ COMPLETE (PR #779, merged 2026-07-04)
- ✅ Verified pixelToHex, hexUnitDistance, getHexesInRadius functions exist and work
- ✅ Verified visibility-cells bitmap functions (cellIndex, encodeCellSet, decodeCellSet, etc.)
- ✅ Performance: Ring 1-11 <1ms, Ring 12-17 <5ms (acceptable for turn-based)
- ✅ Fixed blueprint code bugs identified by Gemini (ring formula, object reference equality, function signatures)

**Phase 1: Refactor instant searches → turn-based actions** — ✅ COMPLETE (PR #780 backend + PR #781 UI, merged 2026-07-04; see ARCHIVAL.md)

**Phase 2A: Scout allocation database & persistence** — ✅ COMPLETE (PR #783, merged 2026-07-04; see ARCHIVAL.md)

**Phase 2B: Scout ring geometry system** — ✅ COMPLETE (PR #784, merged 2026-07-04; see ARCHIVAL.md)

**Phase 2C: Engine integration & ring progression** — ✅ COMPLETE (PR #785, merged 2026-07-04; see ARCHIVAL.md)

**Phase 2D: Visibility integration & fog reveal** — ✅ COMPLETE (PR #786, merged 2026-07-04; see ARCHIVAL.md)

**Phase 2E: Scout allocation UI & progression display** — ✅ COMPLETE (PR #787, ready to merge 2026-07-04; see ARCHIVAL.md)

**Phase 3: Epic Trek point-and-go exploration** — ✅ COMPLETE (PR #788, merged 2026-07-04; see ARCHIVAL.md)

**Phase 4: Regional dungeon/mountain locations** — ✅ COMPLETE (PR #789, merged 2026-07-04)
- ✅ world-locations.js: Deterministic seeding, discovery tracking, in-memory cache
- ✅ location-distance.js: Hex distance and turn cost calculations
- ✅ Database: world_locations table (18 locations), kingdom tracking columns
- ✅ Server boot: Location seeding at startup
- ✅ Expedition routes: Integrated dungeon/mountain into /expedition/start with location-based turn costs

**References:**
- `EXPLORATION_SYSTEM_LOCKED.md` — Complete specification (all parameters locked)
- `IMPLEMENTATION_PLAN.md` — Detailed 4-phase roadmap with file manifest, database schema changes, API endpoints, and testing strategy

---

## Deferred Work

_None currently — see Known Technical Debt below for post-beta cleanup items._

## Known Technical Debt (Post-Beta)

- **Admin inline CSS consolidation** — Progress: Phase 1-3 complete (101 styles converted, PR #793 merged); Phase 4 complete (TestingPanel: 146/177 static styles converted, PR #795 merged 2026-07-04); Phase 4B complete (RankingsPanel: 105 static styles converted, PR #796 merged 2026-07-04); Phase 4C in progress (DefensePanel: 5 inline colors → Tailwind, PR #797 pending merge; Gemini edge-case fix applied).
  - **ProgressBar component extraction** (PR #794, merged 2026-07-04) — Architectural solution eliminates 200+ individual progress bar div pairs across TrainingPanel, StatusPanel, BuildPanel. No longer counted in individual style consolidation backlog.
  - **Phase 4 (TestingPanel):** 146 conversions, 17 dynamic, 14 edge cases. Gemini review feedback applied and fixes merged.
  - **Phase 4B (RankingsPanel):** 105 static styles converted, 0 dynamic, 0 unmapped. Gemini review feedback (10 items) applied and fixes merged.
  - **Phase 4C (DefensePanel):** 5 conversions, 0 dynamic. Gemini edge-case feedback (max=0 guard) applied, merged 2026-07-04.
  - **Phase 4D (EconomyPanel):** 10 conversions, Gemini feedback (6 items) applied, merged 2026-07-04.
  - **Phase 4E (BuildPanel):** 4 conversions complete, Gemini feedback (IIFE → template literal) applied, merged 2026-07-04.
  - **Phase 4F (HappinessPanel):** 1 conversion complete, Gemini feedback (clean review), merged 2026-07-04.
  - **Phase 4G+ (Remaining panels):** ~89 styles across 18 panels (Tier 2-3). ~398 original total; ~59 remain after phases 1-4F.
  - **Approach:** Python automation script with 95+ STYLE_MAPPINGS, batch conversion, direct ternaries/string concatenation for conditional styling.
- **Component test coverage expansion** — 57+ component tests exist; gaps remain in some panels

---

## Notes

- When an item here is completed, move its entry to `ARCHIVAL.md` under a dated chronology entry and remove it from this file.
- See `CLAUDE.md` for PR workflow, quality checks, and merge requirements before starting new work.

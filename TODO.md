# Narmir Reborn — TODO

**Purpose:** Live source of truth for active and deferred work. `ROADMAP.md` was retired 2026-07-01; completed work lives in [ARCHIVAL.md](ARCHIVAL.md).

**Last updated:** 2026-07-05 (Terrain System & Admin CSS Phase 4R verified complete; TODO audit corrections)

---

## Status

Beta launch prerequisites are complete. Alpha phase (items 1–22) closed out 2026-06-28. **Active work: Exploration System Redesign (all 4 phases complete as of 2026-07-04).** Fog of War system also complete (5/5 phases). Awaiting final integration and launch. See `EXPLORATION_SYSTEM_LOCKED.md` and `FOG_OF_WAR_PLAN.md` for specifications.

---

## Active Work — Current Sprint

### Production Incident Recovery (2026-07-05) — COMPLETED
**Status:** ✅ RESOLVED  
**Issue:** Commit 27031fa introduced turn endpoint profiling code that caused a syntax error, crashing production server (Railway)
**Root Cause:** Unknown—code parsed locally but failed at runtime on production (possible encoding/environment issue)
**Recovery:**
- Identified syntax error in production logs (`FATAL startup error: /app/routes/kingdom-gameplay.js:328`)
- Reverted faulty profiling commit (27031fa) with revert commit 9b2b7ec
- Verified local smoke test passes after revert
- Pushed fix to main; server recovering on next deployment
**Lesson:** Profiling instrumentation must be reviewed more carefully before production merge; consider adding integration tests for production environment code paths

### Critical Bug Fix: Hunting/Prospecting Expeditions (PR #825) — COMPLETED
**Status:** ✅ MERGED 2026-07-05  
**Details:**
- Bug: Hunting and prospecting expeditions returned with 0 rangers/engineers and no resource rewards
- Root cause: `expeditionRewards()` function missing case handling for these types, returning empty rewards array that overwrote pre-calculated amounts
- Fix: Extended function signature to accept original rewards, parse stored JSON, properly award food/gold to kingdom treasury
- Also: Prospecting now correctly returns engineers instead of rangers
- PR #825: Merged, all CI checks passed (Lint, Security, Text Encoding)

### Security Audit — In Progress — MEDIUM-HIGH PRIORITY
**Status:** 6 categories require review/completion  
**Completed:**
- ✅ SQL Injection: PASS (all parameterized)

**In Progress:**
- XSS Vulnerabilities (sanitizeHtml gaps: data: URIs, vbscript:, SVG vectors, case-sensitivity)
- Input Validation (systematic review: usernames, passwords, kingdom names, chat, numeric, arrays/objects)
- Authentication & Authorization (JWT, CSRF, rate limiting, session fixation, admin checks)
- Race Conditions & Transaction Safety (concurrent updates, building queues, trades, troops, resources)
- Sensitive Data Exposure (password hashing, API keys, git history, error details)
- Resource Management (Socket.io leaks, connection pooling, uploads, query bounds)

**Reference:** `/home/user/Narmir_Reborn/SECURITY_AUDIT.md`

---

## Previous Work

### Admin CSS Consolidation Phase 4R (PR #814) — ✅ COMPLETE
**Status:** ✅ MERGED & COMPLETE (2026-07-05)
**Details:**
- ✅ PR #814 merged 2026-07-05 (commit 82d1296)
- ✅ Converted ~45 inline styles in ResourcesPanel to Tailwind CSS
- ✅ CI: All 3 checks passed (Lint, Test/Build, Security)
- ✅ Smoke test: Green, no functional regressions
- ✅ Gemini feedback addressed (commit 3425b85)
- ✅ Phase 4S (PR #815) completed as follow-up

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

### Terrain System (3 Phases)

**Phase 1+2: Terrain Data & Visuals** — ✅ COMPLETE (PR #751, squash-merged `79a5ae72` 2026-07-04; see ARCHIVAL.md)
- ✅ Terrain type system (`game/terrain.js`: TERRAIN_TYPES, modifiers, RACE_TO_TERRAIN mapping)
- ✅ Terrain column on resource_nodes with idempotent backfill
- ✅ Toggleable terrain visual layer (biome fills, GSAP animation, hover tooltips)
- ✅ Expedition travel time & loot yield respond to destination terrain via getTerrainModifiers()

**Phase 3: Combat Modifiers** — ✅ COMPLETE (commit b22962f 2026-07-04)
- ✅ CombatDef/Atk modifiers wired into calculateCombatPower
- ✅ Terrain added to battle reports

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

## Deferred Work — Post-Beta / Future Phases

### Elevation System Plan (Complete Spec) — POST-BETA
**Status:** SPECIFICATION COMPLETE, IMPLEMENTATION DEFERRED  
**Priority:** HIGH (strategic depth, exploration complexity, combat mechanics)  
**Scope:**
- **Phase 1:** FBM (Fractional Brownian Motion) noise-based elevation generation, seeded & reproducible
- **Phase 2:** River/water flow simulation with DAG validation
- **Phase 3:** Combat modifier integration, movement cost scaling, spell interactions

**Features:** Organic topography, river pathfinding, terrain-aware combat bonuses/penalties, elevation-based movement costs  
**Gate:** Feature flags (FEATURE_ELEVATION_COMBAT, FEATURE_ELEVATION_MOVEMENT, FEATURE_ELEVATION_SPELLS) for safe rollout  
**Reference:** `/home/user/Narmir_Reborn/ELEVATION_SYSTEM_PLAN.md` (production-ready specification)  
**Dependencies:** Perlin/Simplex noise library, biome-aware elevation normalization, per-hex storage

### Fog of War Phase 5: Expansion Hooks — POST-PHASE 4
**Status:** DEFERRED, SCOPE DEFINED  
**Scope:** Special locations, map items, terrain-scoped discovery difficulty  
**Details:** Leave room for discovery expansion; explicitly not first-build (matches MAP_TERRAIN.md Phase 5 pattern)  
**Gate:** Deferred post-Phase 4 fog rendering completion

### World Generation Randomization (FOG_OF_WAR_PLAN Phase 1.5) — VALIDATION COMPLETE, DEFERRED
**Status:** Validation findings show necessity; implementation deferred  
**Findings (2026-07-03):**
- 47% region misalignment in human kingdoms (systemic issue)
- 0.12% water spawns (real, affects reference kingdoms)
- ✅ REGION_SEEDS/RACE_HOMES realignment confirmed necessary

**Scope:** Randomize kingdom placement (per-race region), node placement, terrain biome distribution, water prohibition enforcement  
**When:** May be inserted before Phase 2 if resources permit; otherwise scheduled post-Phase 1 completion

### Admin Wishlist Plan (40+ Deferred Features) — LONG-TERM BACKLOG
**Status:** BACKLOG, ORGANIZED  
**Categories (7):** Gameplay (7), Combat (7), Economy (5), World (6), Polish (4), Partial features (4)  
**Notable Items:** Diplomacy, espionage, religion, artifact hunting, auction house, weather systems, dynamic world events, custom UI themes  
**Reference:** `/home/user/Narmir_Reborn/ADMIN_WISHLIST_PLAN.md`  
**Timeline:** Post-Beta features; prioritize based on player feedback

---

## Known Technical Debt (Post-Beta)

- **Component test coverage expansion** — 57+ component tests exist; gaps remain in some panels
- **Manual BEGIN/COMMIT pattern in kingdom-mutation routes** — Use `db.withTransaction()` instead (see FOG_OF_WAR Phase 2 for pattern)

---

## Notes

- When an item here is completed, move its entry to `ARCHIVAL.md` under a dated chronology entry and remove it from this file.
- See `CLAUDE.md` for PR workflow, quality checks, and merge requirements before starting new work.

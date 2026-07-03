# Narmir Reborn — TODO

**Purpose:** Live source of truth for active and deferred work. `ROADMAP.md` was retired 2026-07-01; completed work lives in [ARCHIVAL.md](ARCHIVAL.md).

**Last updated:** 2026-07-01

---

## Status

Beta launch prerequisites are complete. Alpha phase (items 1–22) closed out 2026-06-28. **Active work: Fog of War implementation.** See `FOG_OF_WAR_PLAN.md` (Revision 6, design locked 2026-07-03).

---

## Active Work

### Fog of War System (5 Phases)

**Phase 1: Hex Foundation** (IN PROGRESS)
- Extract `hexCenter`, `hexNeighborKeys`, direction tables from `WorldmapRenderer.jsx` into shared `game/hex-utils.js`
- Implement missing `pixelToHex(x, y)` using fractional axial → cube rounding
- Validate all kingdoms/nodes land in correct visual hex cells (alignment check vs. REGION_SEEDS/RACE_HOMES)
- Unit tests: round-trip conversion, boundary cases, neighbor/distance math, frontier detection

**Phase 1.5: Randomize World Generation** (pending Phase 1)
- Remove deterministic REGION_SEEDS; randomize kingdom placement within their race's region (gated by nearest RACE_HOMES)
- Randomize node placement (completely random, different per reset)
- Randomize terrain biome distribution (prevent memorization across resets)
- Enforce: no kingdoms/nodes spawn in water (ocean/lake hexes)
- Goal: prevent players from memorizing optimal routes across resets

**Phase 2: Visibility Persistence** (pending Phase 1.5)
- Add `visibility` JSON column to `kingdoms` table (seen_cells, current_cells, version)
- Register in `JSON_REPAIR_SPECS.kingdoms` for auto-repair on startup
- Implement read/write with row-level `FOR UPDATE` locking (concurrency-safe)

**Phase 3: Scout Loop + Server Gating** (blocked on cost formulas)
- Implement `/scout-area` (frontier-only reveal, ranger/food costs, validation matrix)
- Gate all kingdom/node/expedition endpoints by `seen_cells` (trade routes, diplomacy, /world-map, etc.)
- Validate ranger/expedition allocation overlap
- Auto-add kingdoms to `discovered_kingdoms` on first scout

**Phase 4: Fog Rendering** (pending Phase 2)
- SVG fog overlay in `WorldmapRenderer.jsx` (unseen/seen/current states, reduced-motion support)

**Phase 5: Expansion Hooks** (deferred)
- Special locations, map items, terrain-scoped discovery difficulty

**Still open (Phase 3 blockers):**
- Baseline visibility radius (hexes)
- fog_of_war debuff radius
- Scout cost formulas (ranger/food per hex, scaling, caps)
- Expedition-as-reveal mechanics (one hex ahead, full route, current position only?)

---

## Deferred Work

_None currently — see Known Technical Debt below for post-beta cleanup items._

## Known Technical Debt (Post-Beta)

- **Admin inline CSS consolidation** — 59 static usages converted in `EvolutionPanel.jsx`/`ManagePanel.jsx`; ~440 remain across other admin panels, plus the shared `BTN`/`INPUT`/`TD`-style constant objects themselves still need a Tailwind equivalent before the conditional/dynamic usages that spread them can be converted
- **Component test coverage expansion** — 57+ component tests exist; gaps remain in some panels
- **Dead route handlers in `kingdom-gameplay.js` and `kingdom-research.js`** — 16 routes in `kingdom-gameplay.js` and 1 in `kingdom-research.js` (`school-allocation`) are unreachable because `kingdom-build.js` mounts first on the same `/api/kingdom` prefix and defines the same paths (e.g. `POST /build-queue`, `POST /build`, `POST /tower-craft`). Needs a careful diff of each duplicate pair before removing the dead copies — see `docs/API_ENDPOINTS.md` for the full list.

---

## Notes

- When an item here is completed, move its entry to `ARCHIVAL.md` under a dated chronology entry and remove it from this file.
- See `CLAUDE.md` for PR workflow, quality checks, and merge requirements before starting new work.

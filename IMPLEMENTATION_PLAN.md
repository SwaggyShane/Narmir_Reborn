# Exploration System Implementation Plan

**Status:** Ready for review & approval  
**Date:** 2026-07-04  
**Scope:** Complete redesign of exploration/scouting system  
**Specification:** See `EXPLORATION_SYSTEM_LOCKED.md` (design locked)

---

## Non-Goals (Out of Scope)

- Regional randomization or procedural generation (regions/locations are seeded deterministically at boot, not randomized per kingdom)
- PvP-specific exploration gating (exploration gating is progression-based, not faction/alliance-based)
- Persistent expedition state (expeditions are discrete turn-based actions; no pausing/resuming mid-journey)
- Expedition waypoints or multi-step routes (Epic Trek is one-way; no mid-journey redirect)
- Terrain-based movement penalties (hexes have equal cost; terrain affects reward yields, not travel time, except for region boundaries)
- Expedition parties or fleet mechanics (single unit pool per action; no combined arms)
- Discovery leaderboards or social sharing of artifacts (discoveries are kingdom-scoped; no cross-kingdom discovery sharing)

---

## Overview

Transform exploration from instant single-turn searches + generic expeditions into a rich, progression-gated system with:
- **Scout**: Allocation-based ring reveal (passive, free, 1000+ turns to complete)
- **Epic Trek**: Point-and-go targeted exploration (gated at Ring 2)
- **Hunting/Prospecting/Land**: Turn-based resource gathering (5 turns each, free/cost scaled)
- **Dungeon/Mountain**: Regional combat expeditions (hidden until found)

---

## Phase Breakdown

### Phase 0: Hex Foundation Prerequisite ⚠️ CRITICAL (est. 0-2 files)

**Objective:** Ensure shared hex utilities are in place and integrated for all downstream phases

**Status:** Likely complete (from Fog of War Phase 1); verify before proceeding to Phase 1.

**Existing Code to Verify:**
- `game/hex-utils.js` — Hex geometry (pixelToHex, hexCenter, hexNeighborKeys, hexUnitDistance, isFrontier, getHexesInRadius)
- `game/visibility-cells.js` — Hex-cell bitmap math (hex ↔ bit-index)
- `test/hex-utils.test.js` — Full test coverage
- `test/visibility-cells.test.js` — Bitmap operation tests

**Critical Dependencies (all phases rely on these):**
- Scout ring calculation → needs `getHexesInRadius(center, radius)` to enumerate ring hexes
- Scout distance scaling → needs `hexUnitDistance(hex1, hex2)` for turn cost scaling
- Epic Trek pathfinding → needs `pixelToHex()` for target coordinate conversion and `getPathHexes()` for line-of-sight hex enumeration
- Visibility updates → needs `visibility-cells.js` bitmap encode/decode for seen_cells persistence

**Completion Criteria:**
- [ ] `hex-utils.js` exports: hexCenter, pixelToHex, hexNeighborKeys, hexUnitDistance, isFrontier, getHexesInRadius
- [ ] `visibility-cells.js` exports: cellToBitIndex, bitIndexToCell, encodeBitmap, decodeBitmap
- [ ] All hex utilities have unit test coverage (round-trip, boundaries, performance)
- [ ] No duplicated hex math across game/ or routes/ files
- [ ] Confirm Fog of War Phase 1–2 integration is still sound (no regressions)

**Files to Create (if missing):**
- `game/epic-trek-paths.js` — Path calculation helpers (uses hex-utils)

**Dependencies:** None (foundational layer for all phases)

---

### Phase 1: Refactor Instant Searches → Turn-Based (est. 8-10 files)

**Objective:** Convert `/search/gold`, `/search/food`, `/search/land` to turn-based actions in ExplorationPanel

**Database:**
- No schema changes (existing `resource_expeditions` table used)
- Expeditions table already supports custom `type` field

**Files to Create:**
- `game/hunting-economy.js` — 10 food per ranger L1, terrain scaling
- `game/prospecting-economy.js` — 5 gold per engineer L1, terrain scaling
- `game/land-expansion.js` — 10 rangers = 1 land, population deduction, race mods

**Files to Modify:**
- `routes/kingdom-exploration.js` — Add `/expedition/start` handler for new types
- `client/src/components/react/ExplorationPanel.jsx` — New action buttons (Hunting, Prospecting, Land Expansion), remove old search UI
- `game/ranger-allocation.js` — Extend to include prospecting/hunting/land allocation validation
- `game/config.js` — Add turn costs (5 turns each)
- `test/` — New tests for economy formulas

**Endpoints Modified:**
- `POST /expedition/start` — Accept `type: "hunting" | "prospecting" | "land-expansion"`

**Completion Criteria:**
- [ ] Hunting launches 5-turn expedition, returns food
- [ ] Prospecting launches 5-turn expedition, returns gold
- [ ] Land Expansion instant action, costs 100 pop per land
- [ ] All use ranger/engineer allocation pattern
- [ ] Food costs scale by unit count × level × terrain
- [ ] Race modifiers apply to Land Expansion

**Dependencies:** None (can run in parallel)

---

### Phase 2: Scout System — Allocation Model (est. 10-12 files)

**Objective:** Implement Scout allocation pool with ring-based progression

**Database:**
- `kingdoms` table: Add `scout_allocation` INT DEFAULT 0 (rangers allocated to scouting)
- `kingdoms.visibility` column: Update to track which rings are complete
  - Add `completed_rings` array/bitmask to visibility JSON
  - Add `current_ring` INT to track progression

**Files to Create:**
- `game/scout-rings.js` — Ring geometry, hex counts, completion tracking
  - `getRingHexes(ring_number)` → list of hex coordinates
  - `getTotalHexesInRings(ring_count)` → cumulative
  - `calculateRingTurns(ring, rangers, level, race_mod)` → 20 + (ring-1)*5 scaled
- `game/scout-allocation.js` — Allocation validation, progress tracking
  - `allocateRangersToScout(kingdom, rangers)` → persist allocation
  - `progressScoutRing(kingdom)` → advance ring when complete
- `routes/scout-allocation.js` — New route file for scout allocation endpoints

**Files to Modify:**
- `routes/kingdom-exploration.js` — Add `/scout/allocate`, `/scout/release-all` endpoints
- `client/src/components/react/ExplorationPanel.jsx` — Scout allocation UI (Allocate button, ranger slider, release all)
- `game/visibility.js` — Integrate ring completion into visibility updates
- `db/schema.js` — Add `scout_allocation` column, update visibility registration
- `test/` — Scout ring math, allocation validation tests

**Endpoints New:**
- `POST /scout/allocate` — Allocate N rangers to scouting
- `POST /scout/release-all` — Release all scouts
- `GET /scout/status` — Get current ring, completion %, ETA

**Engine Integration:**
- Modify `processTurn()` in `game/engine.js` to tick scout progress per turn
- Update visibility calculation to include completed rings

**Completion Criteria:**
- [ ] Scout allocation persists across turns
- [ ] Rings auto-advance on completion
- [ ] Ring turn costs scale: Ring N = 20 + (N-1) × 5
- [ ] Fog reveals progressively (or full-ring on complete)
- [ ] Scout greyed out only at Ring 17
- [ ] Scout discoveries (locations, lore, junk) show in log
- [ ] Race modifiers apply to ring progression

**Dependencies:** Phase 1 (uses allocation pattern)

---

### Phase 3: Epic Trek — Point-and-Go Exploration (est. 8-10 files)

**Objective:** Implement targeted exploration with en-route fog reveal and location discovery

**Database:**
- `kingdoms.visibility` — Track `epic_trek_discovered_hexes` bitmask
- No new tables (reuse `resource_expeditions` with type `"epic-trek"`)

**Files to Create:**
- `game/epic-trek-paths.js` — Path calculation, line-of-sight hex enumeration
  - `getPathHexes(start_x, start_y, target_x, target_y)` → ordered hex list (straight-line, no obstacles, no terrain penalties)
  - `getDistanceInHexes(start, target)` → Manhattan/hex distance
  - **Pathfinding Rules (LOCKED):** 
    - Use straight-line hex enumeration (Bresenham or similar for hexes), NOT A* or obstacle avoidance
    - No terrain-based movement penalties (all hexes cost 1.5 turns regardless of biome)
    - Region boundaries do NOT block travel; pathfinding is unrestricted across regions
    - Ocean hexes are crossed normally (no water-based obstacles; player can explore over ocean if within bounds)
    - Path is direct line from start to target; no waypoints or intermediate stops
- `game/epic-trek-discovery.js` — Random location discovery per hex crossed
  - `rollDiscovery(hex, terrain)` → { found: true, type: "kingdom"|"artifact", ... }

**Files to Modify:**
- `routes/kingdom-gameplay.js` — Add `POST /expedition/epic-trek` endpoint
  - Validate target coordinate within map bounds
  - Calculate distance, turn cost (1.5 × hex_distance)
  - Check Ring 2 completion (gating)
- `client/src/components/react/ExplorationPanel.jsx` — Epic Trek UI
  - Hidden until Ring 2 complete
  - Click-to-target on world map
  - Distance & ETA display
- `client/src/components/react/WorldmapRenderer.jsx` — Map interaction
  - Add click handler for target selection
  - Show path preview overlay (optional, nice-to-have)
- `game/visibility.js` — Update for epic-trek discoveries
- `test/` — Path calculation, discovery chance tests

**Endpoints New:**
- `POST /expedition/epic-trek` — Start Epic Trek to target
  - Body: `{ target_x, target_y }`
  - Returns: expedition details, ETA, path

**Completion Criteria:**
- [ ] Epic Trek hidden until Ring 2 Scout complete
- [ ] Target selection on map UI works
- [ ] Path calculation correct (1.5 turns/hex)
- [ ] Fog reveals along path (hexes crossed become visible)
- [ ] Locations discovered per hex (random chance, same as Deep Expedition)
- [ ] Kingdoms auto-added to discovered_kingdoms
- [ ] One-way (no mid-journey redirect)
- [ ] Food cost scales by ranger count (Deep Expedition formula)

**Dependencies:** Phase 2 (requires Ring 2 gating check), Phase 1 (allocation pattern)

---

### Phase 4: Dungeon Raid + Mountain's Heart Regional Locations (est. 6-8 files)

**Objective:** Implement region-scoped dungeon/mountain locations with distance-based turn costs

**Database:**
- `world_locations` table (new):
  ```sql
  CREATE TABLE world_locations (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20), -- 'dungeon' | 'mountain'
    region_name VARCHAR(50),
    x NUMERIC, y NUMERIC,
    discovered_by_kingdom_ids TEXT[] DEFAULT '{}'
  );
  ```
- `kingdoms` — Add `first_dungeon_found_turn INT`, `first_mountain_found_turn INT`

**Files to Create:**
- `game/world-locations.js` — Location seeding, discovery tracking
  - `getRegionLocations(region)` → dungeon, mountain for that region
  - `markLocationDiscovered(kingdom_id, location_id)` → flag found
- `game/location-distance.js` — Distance calc from kingdom to location
  - `getDistanceToLocation(kingdom, location)` → hex distance

**Files to Modify:**
- `db/schema.js` — Create `world_locations` table, add discovery flags to kingdoms
- `routes/kingdom-gameplay.js` — Update Dungeon Raid / Mountain endpoints
  - Add distance calculation to turn cost (50 + dist×1.5, 100 + dist×1.5)
  - Check gating (first location found)
- `client/src/components/react/ExplorationPanel.jsx` — Dungeon/Mountain UI
  - Hidden until each first location discovered
  - Display available locations + distances
- `test/` — Location discovery, distance calc tests

**Endpoints Modified:**
- `POST /expedition/dungeon` → Include distance calc
- `POST /expedition/mountain` → Include distance calc

**Boot Sequence & Seeding Rules:**
- On server start, seed one dungeon + one mountain per region (if not exists)
- **Deterministic Seeding (LOCKED):** Use world_seed + region_name to generate reproducible coordinates (seeded random, not fully random)
  - Seeding function: `getRegionLocationCoords(region_name, location_type, world_seed)` → (x, y)
  - Ensures same region/world produces same location coordinates across restarts
  - Use same seed mechanism as kingdom/node placement (world_state.seed)
- **Collision & Validation Rules:**
  - Generated coordinates must be within region bounds (use `RACE_HOMES` region geometry to validate)
  - Generated coordinates must NOT be in water hexes (validate via `terrain.js` or `world-regions.js`)
  - If collision detected (already occupied by kingdom/node), regenerate using next iteration of seeded random
  - Max 10 retries per location; if all fail, log error and skip that region's location (acceptable fallback)
- **Memory Cache:** Load all `world_locations` into memory at boot (full table scan on startup); maintain as in-memory map `{regionName: {dungeon: {...}, mountain: {...}}}`
- **Discovery Tracking:** When kingdom discovers location (via Scout or Epic Trek), atomically update `discovered_by_kingdom_ids` array in `world_locations` row

**Completion Criteria:**
- [ ] One dungeon per region created/seeded at boot
- [ ] One mountain per region created/seeded at boot
- [ ] Dungeon hidden until first dungeon location discovered
- [ ] Mountain hidden until first mountain location discovered
- [ ] Turn costs: 50 + (distance × 1.5) and 100 + (distance × 1.5)
- [ ] Distance calculated in hex units from kingdom to location
- [ ] Equipment looting per troop (same as previous Dungeon Raid)
- [ ] Combat rewards same as previous
- [ ] Locations persist discovery flag (same kingdom can raid same location multiple times)

**Dependencies:** Phase 3 (discoveries via Epic Trek), Phase 2 (visibility system)

---

## Database Schema Changes

### New Columns (kingdoms table)
```sql
ALTER TABLE kingdoms ADD COLUMN scout_allocation INT DEFAULT 0;
ALTER TABLE kingdoms ADD COLUMN first_dungeon_found_turn INT;
ALTER TABLE kingdoms ADD COLUMN first_mountain_found_turn INT;

-- visibility column (existing, needs updates)
-- Add to existing JSON: completed_rings (array), current_ring (int)
```

### New Table (world_locations)
```sql
CREATE TABLE world_locations (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  region_name VARCHAR(50) NOT NULL,
  x NUMERIC NOT NULL,
  y NUMERIC NOT NULL,
  discovered_by_kingdom_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(type, region_name)
);
```

### Migration Strategy
- Phase 1: No migration (uses existing expeditions table)
- Phase 2: Add `scout_allocation`, backfill visibility with `completed_rings: []`
- Phase 3: No migration (uses existing tables)
- Phase 4: Create `world_locations`, add `first_dungeon_found_turn`, `first_mountain_found_turn`

---

## Technical Decisions

### Visibility Storage Strategy (Phase 2)

**Decision: Keep using `kingdoms.visibility` JSON column (from Fog of War Phase 2), do NOT switch to dedicated `map_visibility` table**

**Rationale:**
- Fog of War Phase 2 already implemented `kingdoms.visibility` with seen_cells/current_cells bitmaps
- Phase 2 adds `completed_rings` and `current_ring` to the same JSON column
- Dedicated `map_visibility` table would require refactoring Fog of War's existing visibility system (high risk, out of scope)
- Kingdom-scoped JSON approach is proven to work (already in production via Fog of War phases)

**Implementation Detail:**
- `kingdoms.visibility` JSON structure:
  ```json
  {
    "seen_cells": "1234567890...",
    "current_cells": "9876543210...",
    "completed_rings": [1, 2, 3],
    "current_ring": 4,
    "epic_trek_discovered_hexes": "..."
  }
  ```
- Use `db.withTransaction()` for atomic read-modify-write on visibility updates
- Lazy initialization: backfill home-hex visibility on first read via `getInitialVisibility()` (proven pattern from Fog of War)

### Hex Grid Design

**Coordinate System (Locked):**
- **Game data:** X,Y continuous (not hex-aligned) — kingdoms, nodes, land all use this
- **Visibility overlay:** Hex grid (odd-r offset, pointy-top) — visual/fog of war only
- **Conversion:** `pixelToHex(x, y)` converts game coordinates to hex cells for visibility checks
- **Distance metric:** `hexUnitDistance(hex1, hex2)` for turn cost scaling (used by Scout rings and Epic Trek)

**Ring Definition (Locked):**
- Ring N = all hexes at exactly distance N from home hex (concentric rings outward)
- Ring 0 = home hex only (always visible)
- Ring 1 = 6 hexes (hex neighbors)
- Ring N ≈ 6×N hexes (approximation; exact count varies at boundaries)
- Max rings = 17 (covers full map, ~918 hexes at 34 pixels/hex = 1999×1380 map)

### Gating & Validation (Server-Side Enforcement Required)

**All gating must be enforced on the server, not just UI-hidden.**

- **Epic Trek Gating:** `/expedition/epic-trek` endpoint MUST check `kingdoms.visibility.completed_rings >= 2` before allowing launch. Return 403 if Ring 2 not complete.
- **Dungeon Raid Gating:** `/expedition/dungeon` endpoint MUST check `kingdoms.first_dungeon_found_turn IS NOT NULL` before allowing launch. Return 403 if no dungeon discovered yet.
- **Mountain's Heart Gating:** `/expedition/mountain` endpoint MUST check `kingdoms.first_mountain_found_turn IS NOT NULL` before allowing launch. Return 403 if no mountain discovered yet.
- **Scout Allocation:** `/scout/allocate` MUST validate ranger count against total available rangers (via `validateRangerAllocation()`). Return 400 if insufficient.
- **Land Expansion:** `/expedition/start` (land-expansion type) MUST validate population cost upfront (100 pop per land). Return 400 if cost exceeds available population.

**Rationale:** UI hiding is UX; server validation is security. A determined player (or bot) can bypass UI, so all gating must be server-enforced to prevent exploits and maintain game integrity.

### Naming Standardization (Enforce Across Implementation)

**Action Names (consistent across UI, routes, and game logic):**
- ✅ "Scout" (not "Scout Expedition", not "Scout Action")
- ✅ "Epic Trek" (not "Deep Expedition", not "Extended Expedition")
- ✅ "Hunting" (not "Hunt", not "Food Search")
- ✅ "Prospecting" (not "Prospect", not "Gold Search")
- ✅ "Land Expansion" (not "Land Search", not "Expand Land")
- ✅ "Dungeon Raid" (not "Dungeon", not "Dungeon Combat")
- ✅ "Mountain's Heart" (not "Mountains Heart", not "Mountain Heart")

**File/Route Naming (snake_case for files, kebab-case for routes):**
- Game logic files: `game/scout-allocation.js`, `game/scout-rings.js`, `game/epic-trek-paths.js`, `game/dungeon-locations.js`, `game/mountain-locations.js`
- Routes: `POST /scout/allocate`, `POST /scout/release-all`, `POST /expedition/epic-trek`, `POST /expedition/dungeon`, `POST /expedition/mountain`
- Database columns: `scout_allocation`, `completed_rings`, `current_ring`, `first_dungeon_found_turn`, `first_mountain_found_turn`
- Config keys: `SCOUT_BASE_TURNS`, `EPIC_TREK_TURNS_PER_HEX`, `HUNTING_TURN_COST`, `PROSPECTING_TURN_COST`, etc.

---

## Core Formulas Reference (Canonical)

**Scout Ring Turn Cost (Allocation-Based):**
```
turns_per_ring(ring_number, ranger_count, ranger_level, race_modifier) =
  (20 + (ring_number - 1) × 5) ÷ (ranger_count × level_multiplier(ranger_level) × race_modifier)
  
Where:
  level_multiplier(L) = 1 + (L - 1) × 0.05  [L=1 → 1.0x, L=100 → 5.95x]
  race_modifier = varies by race (e.g., 0.9–1.1x)
```

**Hunting Reward (5 turns, no food cost):**
```
food_reward = 10 × ranger_count × level_multiplier(ranger_level) × forest_terrain_modifier × race_modifier

Where:
  forest_terrain_modifier = 1.0 (forest), 0.8 (other biomes)
  race_modifier = race-dependent bonuses/penalties
```

**Prospecting Reward (5 turns, deep expedition food cost):**
```
gold_reward = 5 × engineer_count × level_multiplier(engineer_level) × mountain_terrain_modifier × race_modifier
food_cost = (engineer_count × level_multiplier(engineer_level)) × BASE_FOOD_COST_PER_HEX

Where:
  mountain_terrain_modifier = 1.0 (mountain), 0.8 (other biomes)
  BASE_FOOD_COST_PER_HEX = floored per unit level, matches Deep Expedition formula
```

**Land Expansion Reward (Instant, 100 pop per land discovered):**
```
lands_discovered = (ranger_count ÷ 10) × level_multiplier(ranger_level) × race_modifier × terrain_modifier
population_cost = lands_discovered × 100

Where:
  base_unit = 10 rangers L1 = 1 land
  race_modifier = varies by race (e.g., humans 1.0x, elves 1.1x, etc.)
  terrain_modifier = race-dependent biome preference
```

**Epic Trek Turn Cost (Point-and-Go):**
```
total_turns = 1.5 × hex_distance(kingdom_hex, target_hex)
food_cost = (ranger_count × level_multiplier(ranger_level)) × BASE_FOOD_COST_PER_HEX

Where:
  hex_distance = Manhattan/hex distance in hex units
  BASE_FOOD_COST_PER_HEX = matches Deep Expedition formula
```

**Dungeon Raid Turn Cost (Regional Location):**
```
total_turns = 50 + (1.5 × hex_distance(kingdom, dungeon_location))
```

**Mountain's Heart Turn Cost (Regional Location):**
```
total_turns = 100 + (1.5 × hex_distance(kingdom, mountain_location))
```

---

## API Endpoints Summary

### Phase 1 (Modified)
- `POST /expedition/start` — Accept type: "hunting" | "prospecting" | "land-expansion"

### Phase 2 (New)
- `POST /scout/allocate` — `{ rangers: number }`
- `POST /scout/release-all` — Release all scouts
- `GET /scout/status` — Get current progress, ETA

### Phase 3 (New)
- `POST /expedition/epic-trek` — `{ target_x: number, target_y: number }`

### Phase 4 (Modified)
- `POST /expedition/dungeon` — Add distance calculation
- `POST /expedition/mountain` — Add distance calculation

---

## UI Changes

### ExplorationPanel.jsx (Major Refactor)

**Remove:**
- Single-turn search buttons (land, gold, food)
- Old Scout Expedition / Deep Expedition tabs

**Add:**
- **Scout Section:**
  - Ranger allocation slider
  - Current ring display with progress bar
  - Allocate / Release All buttons
  - ETA calculation display
  - Status: "Ring 1 of 17 | 45% complete | ~15 turns remaining"
  - Greyed out at Ring 17

- **Epic Trek Section:**
  - Hidden until Ring 2 complete
  - "Click on map to target" instruction
  - Targeted hex display
  - Distance + ETA
  - Launch button

- **Resource Gathering Section:**
  - Hunting: Ranger allocation, 5 turn ETA
  - Prospecting: Engineer allocation, 5 turn ETA
  - Land Expansion: Ranger allocation, instant, population cost display

- **Combat Expeditions:**
  - Dungeon Raid: Hidden until first dungeon found, location selector, distance calc
  - Mountain's Heart: Hidden until first mountain found, location selector, distance calc

**World Map Integration (WorldmapRenderer.jsx):**
- Click handler for Epic Trek target selection
- Optional: Path preview overlay (nice-to-have, not required)

---

## Testing Strategy

### Unit Tests (game/*)
- Ring geometry: hex counts, completion calcs, turn costs
- Scout allocation: validation, progress tracking
- Hunting/Prospecting/Land: economy formulas with level/race modifiers
- Path calculation: hex enumeration, distance calcs
- Location discovery: random chance, artifact tiers
- World location seeding: deterministic generation, collision avoidance, bounds validation

### Integration Tests
- Scout ring auto-advance on completion
- Visibility update when ring completes
- Epic Trek fog reveal along path
- Location discovery during Epic Trek
- Gating: Epic Trek at Ring 2, Dungeons/Mountains at first find (server-side enforcement)
- Turn deduction across all action types

### **Performance Tests (CRITICAL for Phase 2)**
- **processTurn() Impact:** Measure turn processing time before/after Phase 2 implementation
  - Baseline: measure fresh run with no scout allocation
  - Load: measure with 1,000 kingdoms each with active scout allocation
  - Target: processTurn() should remain <10ms per turn at 1,000 concurrent allocations
  - Mitigation if over: implement ring calculation caching, batch visibility updates, profile bottlenecks
- **Ring Calculation Cost:** Unit test ring enumeration performance for Ring 1–17 (should be sub-millisecond)
- **World Location Lookup:** Memory cache lookup should be O(1); verify <1ms boot and <1μs lookup

### Smoke Tests (after each phase)
- Fresh server boot with test kingdom
- Launch Hunting → verify 5 turns spent
- Allocate to Scout → verify rangers persist, turn processing doesn't lag
- Epic Trek → verify path calculation, fog reveal
- Dungeon Raid → verify distance calc, server-side gating enforced
- World locations → verify seeding determinism (same seed = same coordinates)

---

## Risk Areas & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Visibility bitmaps too granular (sub-hex) | Rendering complexity | Use fallback: full-ring reveal (simpler) |
| Scout allocation TPS impact (ticking per turn) | Server load | Batch updates, cache ring calculations; profile processTurn() |
| Ring calculations heavy on every turn (Phase 2) | CPU/latency | Precompute ring hexes at boot; cache scout progress state |
| Epic Trek pathfinding slow on large distances | Turn lag | Use straight-line hex enumeration (Bresenham/hex line), not A* |
| Epic Trek mobile click handling (targeting on map) | UX broken, misclicks | Validate click bounds, snap to nearest visible hex, visual feedback overlay |
| Dungeon/Mountain seeding overlaps/invalid | UX broken | Validate coordinates within region bounds + water-avoiding before inserting; test boot sequence |
| Race modifiers not balanced (Hunting/Prospecting/Land) | Game economy broken | Start with small values (0.9–1.1x); tie to terrain modifiers; tune via playtesting |
| Migration safety for existing kingdoms (visibility data) | Data corruption | Backfill kingdoms.visibility on first boot (lazy init in getKingdomVisibility); test against 5K+ kingdom DB |
| Concurrency on scout allocation updates | Lost updates (race condition) | Use db.withTransaction for allocation updates; test concurrent updates in integration tests |
| Hex coordinate system confusion (pixels vs hex vs game coords) | Integration bugs | Keep coords separate: X,Y continuous (game data), hex visual only; document clearly in Phase 0 |

---

## File Manifest

### New Files
```
game/hunting-economy.js
game/prospecting-economy.js
game/land-expansion.js
game/scout-rings.js
game/scout-allocation.js
game/epic-trek-paths.js
game/epic-trek-discovery.js
game/world-locations.js
game/location-distance.js
routes/scout-allocation.js
test/hunting-economy.test.js
test/prospecting-economy.test.js
test/scout-rings.test.js
test/scout-allocation.test.js
test/epic-trek-paths.test.js
test/world-locations.test.js
```

### Modified Files
```
routes/kingdom-exploration.js — Phase 1,2,3
routes/kingdom-gameplay.js — Phase 1,3,4
client/src/components/react/ExplorationPanel.jsx — Phase 1,2,3,4
client/src/components/react/WorldmapRenderer.jsx — Phase 3
game/visibility.js — Phase 2,3
game/ranger-allocation.js — Phase 1,2
game/config.js — Phase 1
game/engine.js — Phase 2
db/schema.js — Phase 2,4
test/ranger-allocation.test.js — Phase 1,2
```

---

## Implementation Order

1. **Phase 1** → Phase 2 (parallel OK, but Phase 2 uses Phase 1 patterns)
2. **Phase 2** → Phase 3 (Phase 3 needs Ring 2 gating)
3. **Phase 3** → Phase 4 (Phase 4 needs discovery mechanic from Phase 3)

**Estimated Timeline (1-2 developers, part-time with code review):**
- Phase 0 (Verification): 1 day (mostly confirmation of existing hex-utils)
- Phase 1 (Instant Searches → Turn-Based): 4-5 days
- Phase 2 (Scout Allocation + Rings): 5-6 days
- Phase 3 (Epic Trek): 3-4 days
- Phase 4 (Regional Locations): 2-3 days
- **Total: 4-6 weeks** (includes code review cycles, smoke testing, and risk mitigation validation)

**Effort Breakdown per Phase:**
- Phase 0: ~4 hours (hex-utils verification + gap analysis)
- Phase 1: ~32-40 hours (3 economy modules, endpoint integration, UI updates, tests)
- Phase 2: ~40-48 hours (2 core modules, DB migration, engine integration, allocation validation, UI, tests)
- Phase 3: ~24-32 hours (2 core modules, pathfinding, discovery mechanics, gating, tests)
- Phase 4: ~16-24 hours (location seeding, distance calc, dungeon/mountain gating, tests)

---

## Quality Gates (Per Phase)

Before commit:
- [ ] `npm run lint` — 0 errors
- [ ] `npm test` — All tests passing
- [ ] Fresh PostgreSQL smoke boot
- [ ] Manual verification of new features
- [ ] No hardcoded values (use game config)
- [ ] Code comments for non-obvious logic

Before merge to main:
- [ ] Gemini Code Assist review approved
- [ ] CI pipeline green
- [ ] No performance regressions

---

## Success Criteria (Complete Implementation)

- [ ] All 8 exploration actions fully functional (Hunting, Prospecting, Land Expansion, Scout, Epic Trek, Dungeon Raid, Mountain's Heart)
- [ ] Scout allocation progresses through 17 rings without player action
- [ ] Epic Trek unlocks at Ring 2 (via gating check) and reveals fog en route
- [ ] Dungeon/Mountain hidden until first location of each type discovered
- [ ] Turn costs match spec (Hunt/Prospect 5 turns, Dungeon 50+dist×1.5, Mountain 100+dist×1.5)
- [ ] Food costs match spec (Hunt free, Prospect deep-exp formula, Land free, others per type)
- [ ] Race modifiers apply correctly to Scout rings, Land Expansion, and Hunting/Prospecting terrain scaling
- [ ] All formulas scale by count × level × terrain_modifier × race_modifier
- [ ] No crashes or data corruption in extended gameplay (test with 100+ turns of allocation)
- [ ] UI intuitive and responsive (map click targeting works on mobile, allocation sliders smooth, gating clear)
- [ ] All tests passing (unit + integration + smoke at each phase)
- [ ] Hex coordinate system separation maintained (no confusion between pixel X/Y, hex grid, game data coords)

---

## Notes for Reviewers

1. **Path of Least Resistance:** Fog reveal via full-ring on Scout completion is acceptable if sub-hex incremental is too complex. Can iterate later.

2. **Regional Locations:** Seeding can be simple (one per region at boot). Coordinates should be random within region bounds, validated against water hexes.

3. **No New Hard Caps:** Scout allocation has unlimited ranger assignment (unlike Epic Trek). This is intentional for late-game progression.

4. **Achievement Compatibility:** Scout stays available after full reveal (Ring 1-16) for achievement hunters seeking junk prizes.

5. **Gating is Soft:** Epic Trek/Dungeon/Mountain are hidden in UI, but no server-side block. If player discovers location via other means, they can attempt expedition. UI gating is for UX, not security.

---

**Ready for review. Awaiting approval to begin Phase 1 coding.**


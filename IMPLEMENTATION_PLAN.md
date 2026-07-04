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

### Phase 2: Scout System — Allocation Model (est. 10-12 files, 4 milestones)

**Objective:** Implement Scout allocation pool with ring-based progression

**BROKEN INTO 4 INTERNAL MILESTONES (testable checkpoints):**

#### Phase 2A: Database & Allocation Persistence
**Scope:** Schema migration + basic allocation API
- `kingdoms` table: Add `scout_allocation INT DEFAULT 0`
- `kingdoms.visibility`: Add `highest_completed_ring INT DEFAULT 0` (canonical storage; current ring derived)
- Files: `game/scout-allocation.js`, `routes/kingdom-exploration.js` (new `/scout/allocate`, `/scout/release-all`)
- Tests: Allocation validation, persistence
- **Gate to 2B:** Allocation persists across restarts; can allocate/release without errors

#### Phase 2B: Engine Integration & Ring Progression
**Scope:** Turn processing + ring advancement logic
- `game/scout-rings.js` — Ring geometry (getRingHexes, getTotalHexesInRings, getNextRingTurnsRequired)
- `game/engine.js` — processTurn() calls scout progress ticking
- `game/visibility.js` — Ring completion → visibility update trigger
- Tests: Ring progression math, turn costs, ring advancement logic
- **Gate to 2C:** Rings advance on completion; processTurn() <2ms at 100 kingdoms baseline

#### Phase 2C: Visibility Integration & Fog Reveal
**Scope:** Visibility bitmap updates when rings complete
- `game/visibility.js` — Integrate ring completion into visibility updates
- Database: visibility JSON updates atomic
- Tests: Visibility updates correct, no data loss
- **Gate to 2D:** Fog reveal works correctly; visibility persists accurately

#### Phase 2D: UI & UX
**Scope:** Frontend allocation interface + progress display
- `client/src/components/react/ExplorationPanel.jsx` — Scout allocation UI (Allocate button, ranger slider, release all)
- ETA calculation display
- Status: "Ring 1 of 17 | 45% complete | ~15 turns remaining"
- Tests: UI displays correct data, updates on state change
- **Gate to Phase 3:** UI is responsive, calculations accurate

**All Phase 2 Milestones Completion Criteria:**
- [ ] Scout allocation persists across server restarts
- [ ] Rings auto-advance on completion (no manual trigger)
- [ ] Ring turn costs scale: Ring N = 20 + (N-1) × 5 (via SCOUT_BASE_TURNS + SCOUT_RING_INCREMENT)
- [ ] Fog reveals on ring completion (hexes in ring become visible)
- [ ] Scout greyed out only at Ring 17 (highest_completed_ring == 17)
- [ ] Scout discoveries (locations, lore, junk) show in log
- [ ] Race modifiers apply to ring progression
- [ ] processTurn() performance: <2ms @100 kingdoms → <10ms @1000 kingdoms → <40ms @5000 kingdoms

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
-- Add to existing JSON: highest_completed_ring INT DEFAULT 0
-- (DO NOT store current_ring separately; derive it as highest_completed_ring + 1)
```

### New Table (world_locations)
```sql
CREATE TABLE world_locations (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  region_name VARCHAR(50) NOT NULL,
  x NUMERIC NOT NULL,
  y NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(type, region_name)
);
```

### New Table (kingdom_location_discoveries) — Join table for scalability
```sql
CREATE TABLE kingdom_location_discoveries (
  id SERIAL PRIMARY KEY,
  kingdom_id INT NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  location_id INT NOT NULL REFERENCES world_locations(id) ON DELETE CASCADE,
  discovered_via VARCHAR(20) NOT NULL DEFAULT 'unknown',
    -- 'scout', 'epic-trek', 'manual' (for admin testing)
  discovered_turn INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(kingdom_id, location_id),
  INDEX idx_kingdom_id (kingdom_id),
  INDEX idx_location_id (location_id),
  INDEX idx_discovered_via (discovered_via)
);
```
**Why:** Replaces `discovered_by_kingdom_ids TEXT[]` in world_locations. Avoids large array accumulation, enables proper indexing, supports analytics queries (e.g., "which kingdoms discovered this dungeon?", "how many discoveries via Scout vs Epic Trek?"), and keeps query performance constant O(1) instead of O(array_length).

**Analytics Benefits:**
- Track discovery method distribution (Scout vs Epic Trek prevalence)
- Measure Epic Trek adoption rate (% of dungeons found via Epic Trek)
- Identify which discovery method is more efficient for players

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
- Phase 2 adds scout progression tracking to the same JSON column
- Dedicated `map_visibility` table would require refactoring Fog of War's existing visibility system (high risk, out of scope)
- Kingdom-scoped JSON approach is proven to work (already in production via Fog of War phases)

**Implementation Detail - NO DUPLICATED STATE:**
- `kingdoms.visibility` JSON structure (canonical):
  ```json
  {
    "seen_cells": "1234567890...",
    "current_cells": "9876543210...",
    "highest_completed_ring": 3,
    "epic_trek_discovered_hexes": "..."
  }
  ```
- **Current ring is DERIVED:** `current_ring = highest_completed_ring + 1` (not stored separately)
- **Why:** Avoids data corruption from state divergence (if current_ring and highest_completed_ring disagree, which is authoritative?)
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

### Visibility Interaction with Ring Completion (Fog Reveal Strategy)

**How `seen_cells` / `current_cells` interact with scout ring progression:**

- **seen_cells (canonical):** Cumulative set of all hexes ever revealed (never shrinks)
  - Updated atomically when: (1) Ring completes, (2) Epic Trek path crossed, (3) fog_of_war debuff expires
  - Persisted in `kingdoms.visibility.seen_cells` bitmask
  - Represents "what the kingdom has discovered over all time"

- **current_cells (derived):** Visible hexes right now (affected by active debuffs)
  - Computed from `seen_cells` but may be temporarily reduced by fog_of_war spell (enemy-cast)
  - fog_of_war debuff overrides to home-hex-only for 3 turns (locked from Fog of War Phase 4)
  - After debuff expires, current_cells reverts to full seen_cells
  - Does NOT update seen_cells (debuff is temporary vision loss, not permanent discovery loss)

- **Ring completion fog reveal:**
  - When ring N completes (highest_completed_ring increments), all hexes in Ring N are added to seen_cells
  - Option A (preferred): Incremental reveal — hexes revealed gradually as ring progresses (0.25 hex per tick)
  - Option B (fallback): Full ring reveal — all hexes in ring revealed atomically on completion
  - Both approaches update seen_cells atomically via `updateKingdomVisibility()` with db.withTransaction
  - Visibility JSON updated: `seen_cells` bitmap + `highest_completed_ring` counter

- **Epic Trek fog reveal:**
  - Each hex crossed on Epic Trek path is added to seen_cells
  - Path hexes revealed atomically after expedition completes
  - Kingdom auto-discovers any kingdoms in revealed hexes (added to discovered_kingdoms)

**No conflict between systems:** seen_cells only grows; ring completion and Epic Trek both safely append to it.

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

## Configuration Constants (Canonical)

**All magic numbers must be defined in `game/config.js` and imported by all game modules. Never hardcode numbers in code.**

```javascript
// game/config.js

// Scout System
SCOUT_BASE_TURNS: 20,              // Ring 1 cost
SCOUT_RING_INCREMENT: 5,           // Per ring increase
SCOUT_MAX_RINGS: 17,               // Maximum ring progression

// Epic Trek
EPIC_TREK_TURNS_PER_HEX: 1.5,      // Distance cost multiplier

// Resource Gathering
HUNTING_TURN_COST: 5,
HUNTING_FOOD_PER_RANGER_L1: 10,
HUNTING_BASE_FOOD_COST: 0,         // No food cost for hunting

PROSPECTING_TURN_COST: 5,
PROSPECTING_GOLD_PER_ENGINEER_L1: 5,
PROSPECTING_FOOD_COST_PER_HEX: 50, // Deep Expedition formula

LAND_EXPANSION_RANGERS_PER_LAND: 10,
LAND_EXPANSION_POP_COST_PER_LAND: 100,
LAND_EXPANSION_TURN_COST: 0,       // Instant

// Regional Expeditions
DUNGEON_BASE_TURNS: 50,
DUNGEON_TURNS_PER_HEX: 1.5,

MOUNTAIN_BASE_TURNS: 100,
MOUNTAIN_TURNS_PER_HEX: 1.5,

// Modifiers (locked)
RANGER_LEVEL_BONUS_PER_LEVEL: 0.05, // Level 100 = 5.95x

// Terrain Modifiers (examples; tune via playtesting)
TERRAIN_MODIFIER_FOREST: 1.0,       // Hunting favorable
TERRAIN_MODIFIER_MOUNTAIN: 1.0,     // Prospecting favorable
TERRAIN_MODIFIER_OTHER: 0.8,
```

**Usage Example in Code:**
```javascript
// game/scout-rings.js
function calculateRingTurns(ring, rangerCount, rangerLevel, raceMod) {
  const baseTurns = CONFIG.SCOUT_BASE_TURNS + (ring - 1) * CONFIG.SCOUT_RING_INCREMENT;
  return baseTurns / (rangerCount * levelMult(rangerLevel) * raceMod);
}
```

**Benefits:**
- Single source for all tunable values
- Easy balancing (change one number, everywhere updates)
- Prevents hardcoded value inconsistencies
- Clear configuration surface for admins/balancers

---

## Core Formulas Reference (Canonical)

**Scout Ring Turn Cost (Allocation-Based):**
```
turns_per_ring(ring_number, ranger_count, ranger_level, race_modifier) =
  (SCOUT_BASE_TURNS + (ring_number - 1) × SCOUT_RING_INCREMENT) 
  ÷ (ranger_count × level_multiplier(ranger_level) × race_modifier)
  
Where:
  SCOUT_BASE_TURNS = 20 (config)
  SCOUT_RING_INCREMENT = 5 (config)
  level_multiplier(L) = 1 + (L - 1) × RANGER_LEVEL_BONUS_PER_LEVEL
  RANGER_LEVEL_BONUS_PER_LEVEL = 0.05 (config) [L=1 → 1.0x, L=100 → 5.95x]
  race_modifier = varies by race (e.g., 0.9–1.1x, from RACE_MODIFIERS config)
```

**Hunting Reward (HUNTING_TURN_COST turns, no food cost):**
```
food_reward = HUNTING_FOOD_PER_RANGER_L1 
            × ranger_count 
            × level_multiplier(ranger_level) 
            × terrain_modifier(biome) 
            × race_modifier

Where:
  HUNTING_FOOD_PER_RANGER_L1 = 10 (config)
  HUNTING_TURN_COST = 5 (config)
  HUNTING_BASE_FOOD_COST = 0 (config) — no food cost
  terrain_modifier = TERRAIN_MODIFIER_FOREST (1.0), TERRAIN_MODIFIER_OTHER (0.8)
  race_modifier = from RACE_MODIFIERS config
```

**Prospecting Reward (PROSPECTING_TURN_COST turns, deep expedition food cost):**
```
gold_reward = PROSPECTING_GOLD_PER_ENGINEER_L1 
            × engineer_count 
            × level_multiplier(engineer_level) 
            × terrain_modifier(biome) 
            × race_modifier

food_cost = (engineer_count × level_multiplier(engineer_level)) 
          × PROSPECTING_FOOD_COST_PER_HEX

Where:
  PROSPECTING_GOLD_PER_ENGINEER_L1 = 5 (config)
  PROSPECTING_TURN_COST = 5 (config)
  PROSPECTING_FOOD_COST_PER_HEX = 50 (config, matches Deep Expedition)
  terrain_modifier = TERRAIN_MODIFIER_MOUNTAIN (1.0), TERRAIN_MODIFIER_OTHER (0.8)
```

**Land Expansion Reward (LAND_EXPANSION_TURN_COST, 100 pop per land):**
```
lands_discovered = (ranger_count ÷ LAND_EXPANSION_RANGERS_PER_LAND) 
                 × level_multiplier(ranger_level) 
                 × race_modifier 
                 × terrain_modifier

population_cost = lands_discovered × LAND_EXPANSION_POP_COST_PER_LAND

Where:
  LAND_EXPANSION_RANGERS_PER_LAND = 10 (config) — base unit
  LAND_EXPANSION_POP_COST_PER_LAND = 100 (config)
  LAND_EXPANSION_TURN_COST = 0 (config) — instant
  race_modifier = from RACE_MODIFIERS config
  terrain_modifier = race-dependent biome preference (config)
```

**Epic Trek Turn Cost (Point-and-Go):**
```
total_turns = EPIC_TREK_TURNS_PER_HEX × hex_distance(kingdom_hex, target_hex)
food_cost = (ranger_count × level_multiplier(ranger_level)) 
          × PROSPECTING_FOOD_COST_PER_HEX

Where:
  EPIC_TREK_TURNS_PER_HEX = 1.5 (config)
  hex_distance = Manhattan/hex distance in hex units
  PROSPECTING_FOOD_COST_PER_HEX = 50 (config, matches Deep Expedition)
```

**Dungeon Raid Turn Cost (Regional Location):**
```
total_turns = DUNGEON_BASE_TURNS + (DUNGEON_TURNS_PER_HEX × hex_distance)

Where:
  DUNGEON_BASE_TURNS = 50 (config)
  DUNGEON_TURNS_PER_HEX = 1.5 (config)
  hex_distance = from kingdom position to dungeon location
```

**Mountain's Heart Turn Cost (Regional Location):**
```
total_turns = MOUNTAIN_BASE_TURNS + (MOUNTAIN_TURNS_PER_HEX × hex_distance)

Where:
  MOUNTAIN_BASE_TURNS = 100 (config)
  MOUNTAIN_TURNS_PER_HEX = 1.5 (config)
  hex_distance = from kingdom position to mountain location
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

## State Ownership & Architectural Boundaries

**Critical for preventing concurrency bugs and architectural debt.** These rules must be enforced in code review.

| Component | Owner | Allowed Mutations | Read-Only Access | Notes |
|-----------|-------|-------------------|------------------|-------|
| `scout_allocation` | `game/scout-allocation.js` via `/scout/*` routes | `/scout/allocate`, `/scout/release-all` | All routes via `validateRangerAllocation()` | No other route may mutate |
| `highest_completed_ring` | `game/engine.js` processTurn() | processTurn() only via scout ticking | All modules via getter | UI/API may read only |
| `kingdoms.visibility` | `game/visibility.js` | Only `updateKingdomVisibility()` | All modules via `getKingdomVisibility()` | Use db.withTransaction atomicity |
| `world_locations` | Bootstrap @ server start | None (immutable after creation) | All modules via cache lookup | Discoveries tracked separately in `kingdom_location_discoveries` |
| `kingdom_location_discoveries` | Routes discovering locations | INSERT only (no UPDATE/DELETE) | All modules via query | One entry per kingdom+location pair |

---

## Failure Cases & Edge Cases (Expected Behavior)

These must be handled explicitly in code; no silent failures.

### Scout System

- **Rangers die while scouting:** Scout allocation decreases; progress ticks slower until restored
- **Player reallocates units:** Allocation updates immediately; progress rate changes on next turn
- **Allocation exceeds available rangers:** Route rejects with 400 + error message (enforced by validateRangerAllocation)
- **Scout reaches Ring 17:** Scout becomes greyed out; no further progress; "Full map revealed" message in log
- **Ring completion while offline:** Ring advances on next turn after login (processTurn catches up)
- **Visibility corruption (highest_completed_ring incorrect):** On first getKingdomVisibility call, lazy backfill recomputes from seen_cells and corrects value

### Epic Trek

- **Destination becomes invalid (e.g., out of map bounds):** Route rejects target with 400 before expedition starts
- **Kingdom destroyed mid-expedition:** Expedition completes normally (no special case); results delivered even if kingdom no longer exists (handled by engine)
- **Food depletes mid-expedition:** Expedition completes (expedition food cost is pre-deducted); no interruption
- **Player cancelled expedition:** Follow existing `DELETE /expedition/:id` pattern; turns refunded, no partial progress
- **Pathfinding crosses own kingdom:** Normal behavior; path includes home hex if target is within one hex

### Dungeon Raid / Mountain's Heart

- **Dungeon/Mountain seeded in water:** Boot validation prevents this (collision detection + water-avoidance check)
- **Region has no dungeon:** Endpoint returns 404 with message "Dungeon not discovered"; does not auto-create
- **Distance calculation overflow (extreme map distance):** Turn cost capped at MAX_TURN_COST to prevent integer overflow
- **Gating check race condition:** Server enforces at request time; two concurrent requests may both pass or both fail (consistent)

---

## Rollback Strategy (Production Safety)

Every deployment must be reversible. If validation fails, rollback to previous stable state within **<5 minutes** of detection.

### Rollback Actions (in order)

1. **Disable new endpoints** (returns 403)
   - Disable `/scout/allocate`, `/scout/release-all`, `/scout/status` routes
   - Disable `/expedition/epic-trek` route
   - Disable `/expedition/dungeon`, `/expedition/mountain` distance-based turn costs (revert to old formula if present)

2. **Preserve existing data**
   - Leave all `scout_allocation` and visibility JSON data untouched (can inspect later)
   - Leave `world_locations` table untouched (no data loss)
   - Existing kingdoms remain playable with pre-Phase features

3. **Restore previous deployment**
   - Redeploy previous container image
   - Restart application server
   - Clear any caches

4. **Validate restoration**
   - Confirm `/turn` endpoint still responds
   - Confirm expeditions still work with old formula
   - Confirm no 500 errors on login

### Rollback Triggers

- ❌ processTurn() average latency > 50ms (2x target)
- ❌ Visibility data corruption detected (highest_completed_ring inconsistency)
- ❌ World location seeding produces invalid coordinates (in-water, out-of-bounds)
- ❌ Scout allocation total exceeds available rangers (concurrency bug)
- ❌ API errors on `/turn` endpoint > 1% of requests (5-min window)

### Validation Before Production

- [ ] Load test: 1,000 concurrent kingdoms with scout allocations; processTurn() <10ms
- [ ] Integrity check: Scan 5K+ kingdom DB for visibility corruption; all should match expectations
- [ ] Functional test: Smoke test all 4 phases in staging replica
- [ ] Gating test: Attempt Epic Trek/Dungeon/Mountain before gating conditions met; all should 403

---

## Measurable Performance Targets

All metrics are per-kingdom, averaged over 100+ consecutive turns.

### processTurn() Latency (CRITICAL)

| Scenario | Target | Threshold | Action if Exceeded |
|----------|--------|-----------|-------------------|
| 100 kingdoms, no scouts | <2ms | >3ms | Investigate baseline |
| 100 kingdoms, 50% with scout alloc | <2.5ms | >3.5ms | Profile scout tick code |
| 1,000 kingdoms, 50% with scout alloc | <10ms | >15ms | Cache ring calculations |
| 5,000 kingdoms, 50% with scout alloc | <40ms | >60ms | Consider batching or async |

### Ring Calculation Performance

| Operation | Target | Threshold |
|-----------|--------|-----------|
| getRingHexes(ring 1-17) | <1ms | >2ms |
| Ring completion check | <100μs | >200μs |

### World Location Lookup

| Operation | Target | Threshold |
|-----------|--------|-----------|
| Boot cache load (all regions) | <250ms | >500ms |
| Memory cache lookup | <1μs | >5μs |

### Database Queries

| Query | Target | Threshold |
|-------|--------|-----------|
| INSERT kingdom_location_discoveries | <5ms | >10ms |
| SELECT discovered_by kingdom_id | <2ms | >5ms |

---

## Architecture Decision Records (ADR)

Key decisions that influenced the design. Reference these in code reviews to maintain consistency.

### ADR-001: kingdoms.visibility JSON Storage (Fog of War Phase 2)

**Status:** Accepted  
**Decided:** 2026-07-04  

**Decision:** Store visibility in kingdoms.visibility JSON column, not dedicated map_visibility table.

**Rationale:**
- Fog of War Phase 2 already uses this structure
- Avoids breaking existing visibility system
- Kingdom-scoped data naturally fits kingdom row
- Proven in production

**Consequences:**
- JSON updates must be atomic (use db.withTransaction)
- Backfill required for new kingdoms
- No visibility table normalization (acceptable trade-off)

---

### ADR-002: Canonical Scout State (highest_completed_ring)

**Status:** Accepted  
**Decided:** 2026-07-04  

**Decision:** Store only `highest_completed_ring` in visibility JSON. Derive current_ring as `highest_completed_ring + 1`.

**Rationale:**
- Prevents state divergence (duplicated state = data corruption risk)
- Single source of truth is always consistent
- No need for migration if highest_completed_ring is missing (defaults to 0 = Ring 1)

**Consequences:**
- All code must use getter function, never hardcode `current_ring`
- Ring display logic: `currentRing = visibility.highest_completed_ring + 1`
- Adding ring 0 (home hex always visible) doesn't require schema change

---

### ADR-003: World Location Discoveries (Join Table)

**Status:** Accepted  
**Decided:** 2026-07-04  

**Decision:** Use `kingdom_location_discoveries` join table instead of `discovered_by_kingdom_ids TEXT[]` array.

**Rationale:**
- Arrays grow unbounded (1000 kingdoms = 1000-element array per location)
- Proper indexing enables fast queries (who discovered this dungeon?)
- Analytics queries natural (e.g., discovery rates by region)
- O(1) membership tests via database

**Consequences:**
- Requires separate table and schema migration for Phase 4
- Queries use JOIN instead of array containment
- Adds 2 indexes (by kingdom_id, by location_id)

---

### ADR-004: Configuration Constants in game/config.js

**Status:** Accepted  
**Decided:** 2026-07-04  

**Decision:** All magic numbers (turn costs, food costs, etc.) defined as constants in game/config.js.

**Rationale:**
- Single source for all tunable values
- Easy balancing (change one place, everywhere updates)
- Prevents copy-paste errors
- Clear configuration surface

**Consequences:**
- Import CONFIG from game/config.js in all game modules
- Database migrations may reference constants
- Admin tools can read CONFIG for display/validation

---

### ADR-005: Server-Side Gating (Not UI-Only)

**Status:** Accepted  
**Decided:** 2026-07-04  

**Decision:** All progression gates enforced server-side with 403 responses. UI hiding is UX, not security.

**Rationale:**
- Prevents exploits (players can bypass UI)
- Ensures consistent game state across all clients
- Supports API-only clients (bots, scripts)

**Consequences:**
- Every gated action must validate server-side
- UI is a reflection of server state, not a gatekeeper
- Test concurrent requests for gate race conditions

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
game/visibility-utils.js — Bitmap encoding/decoding helpers (keeps visibility.js clean)
routes/scout-allocation.js
test/hunting-economy.test.js
test/prospecting-economy.test.js
test/scout-rings.test.js
test/scout-allocation.test.js
test/epic-trek-paths.test.js
test/world-locations.test.js
```

**Note on visibility-utils.js:** Bitmap math (cellToBitIndex, bitIndexToCell, encodeBitmap, decodeBitmap) is likely already in `game/visibility-cells.js` from Fog of War Phase 2. If not present, extract/create as new utility to keep visibility.js focused on logic, not bitwise operations.

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

## Notes for Implementers

1. **Phase 0 is critical:** Verify hex-utils completeness before starting Phase 1. No showstoppers expected (Fog of War Phase 1 proved the foundation), but confirm all functions are tested.

2. **Phase 2 milestones are gated:** Each sub-phase (2A, 2B, 2C, 2D) must pass its gate before proceeding. This prevents massive integration surprises.

3. **Visibility interaction is delicate:** seen_cells (cumulative) and current_cells (temporary, debuff-aware) must stay synchronized. Use atomicity (db.withTransaction) strictly. See "Visibility Interaction with Ring Completion" section.

4. **Analytics wins via discovered_via:** Track "scout" vs "epic-trek" discoveries. This data will inform future balancing and progression decisions.

5. **Performance targets are real SLOs:** processTurn() <10ms at 1000 kingdoms is not aspirational. If you hit >15ms during Phase 2B testing, stop and profile before proceeding.

6. **No New Hard Caps (Scout):** Scout allocation has unlimited ranger assignment. This is intentional for late-game progression and allows creative player strategies.

7. **Achievement Compatibility:** Scout stays available after Ring 17 (highest_completed_ring == 17) for completionists seeking junk prizes.

8. **Server-Side Gating (Not UI):** Epic Trek/Dungeon/Mountain are hidden in UI for UX, but all gating is enforced server-side (403 responses). No exceptions.

---

## Status: Ready for Implementation

✅ **Design locked** (EXPLORATION_SYSTEM_LOCKED.md)  
✅ **Plan complete** (IMPLEMENTATION_PLAN.md)  
✅ **Team feedback incorporated** (9.5/10 → production-ready)  
✅ **All 4 phases detailed** (with Phase 2 broken into 4 testable milestones)  
✅ **Config constants defined** (all magic numbers in one place)  
✅ **Formulas canonical** (single source of truth)  
✅ **State ownership clear** (architectural boundaries documented)  
✅ **Performance targets measurable** (concrete SLOs with thresholds)  
✅ **Rollback strategy documented** (production safety)  
✅ **ADRs recorded** (decisions for future maintenance)  

**Next Step:** Phase 0 verification (confirm hex-utils completeness, then proceed to Phase 1).


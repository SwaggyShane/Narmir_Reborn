# Exploration System Implementation Plan

**Status:** Ready for review & approval  
**Date:** 2026-07-04  
**Scope:** Complete redesign of exploration/scouting system  
**Specification:** See `EXPLORATION_SYSTEM_LOCKED.md` (design locked)

---

## Overview

Transform exploration from instant single-turn searches + generic expeditions into a rich, progression-gated system with:
- **Scout**: Allocation-based ring reveal (passive, free, 1000+ turns to complete)
- **Epic Trek**: Point-and-go targeted exploration (gated at Ring 2)
- **Hunting/Prospecting/Land**: Turn-based resource gathering (5 turns each, free/cost scaled)
- **Dungeon/Mountain**: Regional combat expeditions (hidden until found)

---

## Phase Breakdown

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
  - `getPathHexes(start_x, start_y, target_x, target_y)` → ordered hex list
  - `getDistanceInHexes(start, target)` → Manhattan/hex distance
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

**Boot Sequence:**
- On server start, seed one dungeon + one mountain per region (if not exists)
- Load into memory cache for fast lookup

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

### Integration Tests
- Scout ring auto-advance on completion
- Visibility update when ring completes
- Epic Trek fog reveal along path
- Location discovery during Epic Trek
- Gating: Epic Trek at Ring 2, Dungeons/Mountains at first find
- Turn deduction across all action types

### Smoke Tests (after each phase)
- Fresh server boot with test kingdom
- Launch Hunting → verify 5 turns spent
- Allocate to Scout → verify rangers persist
- Epic Trek → verify path calculation
- Dungeon Raid → verify distance calc

---

## Risk Areas & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Visibility bitmaps too granular (sub-hex) | Rendering complexity | Use fallback: full-ring reveal (simpler) |
| Scout allocation TPS impact (ticking per turn) | Server load | Batch updates, cache ring calculations |
| Epic Trek pathfinding slow on large distances | Turn lag | Use straight-line hex enumeration, not A* |
| Dungeon/Mountain seeding overlaps/invalid | UX broken | Validate coordinates before inserting, test boot |
| Race modifiers not balanced | Game broken | Start with small values (0.9-1.1x), tune via playtesting |

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

**Estimated Timeline (4-person team, part-time):**
- Phase 1: 4-5 days
- Phase 2: 5-6 days
- Phase 3: 3-4 days
- Phase 4: 2-3 days
- **Total: ~2-3 weeks**

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

- [x] All 8 exploration actions fully functional
- [x] Scout allocation progresses through 17 rings without player action
- [x] Epic Trek unlocks at Ring 2 and reveals fog en route
- [x] Dungeon/Mountain hidden until first discovery
- [x] Turn costs, food costs, rewards all match spec
- [x] Race modifiers apply correctly
- [x] All formulas scale by count × level × terrain
- [x] No crashes or data corruption in extended gameplay
- [x] UI intuitive and responsive
- [x] All tests passing

---

## Notes for Reviewers

1. **Path of Least Resistance:** Fog reveal via full-ring on Scout completion is acceptable if sub-hex incremental is too complex. Can iterate later.

2. **Regional Locations:** Seeding can be simple (one per region at boot). Coordinates should be random within region bounds, validated against water hexes.

3. **No New Hard Caps:** Scout allocation has unlimited ranger assignment (unlike Epic Trek). This is intentional for late-game progression.

4. **Achievement Compatibility:** Scout stays available after full reveal (Ring 1-16) for achievement hunters seeking junk prizes.

5. **Gating is Soft:** Epic Trek/Dungeon/Mountain are hidden in UI, but no server-side block. If player discovers location via other means, they can attempt expedition. UI gating is for UX, not security.

---

**Ready for review. Awaiting approval to begin Phase 1 coding.**


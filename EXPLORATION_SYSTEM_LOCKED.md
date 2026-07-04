# Exploration System — COMPLETE LOCKED SPECIFICATION

**Locked:** 2026-07-04  
**Status:** Ready for implementation (all questions resolved, all math verified)

---

## 1. MAP DIMENSIONS & HEX GRID

**World size:** 1999 × 1380 pixels  
**Hex system:** 34 pixels per hex (pointy-top, odd-r offset)
- HEX_W = √3 × 34 ≈ 58.9 pixels
- HEX_VERT = 34 × 1.5 = 51 pixels
- **Total hexes:** ~34 wide × 27 tall = **918 hexes**

**CRITICAL ARCHITECTURE:**
- **Hex grid:** Used ONLY for visibility/fog of war rendering
- **Game data:** X,Y continuous coordinates (NOT hex-aligned)
- Kingdom positions: X,Y (continuous)
- Resource nodes: X,Y (continuous)
- Land plots: X,Y (continuous)
- These systems are separate; hex is a visual overlay only

---

## 2. PLAYER SCALE & LAND CAP

**Concurrent players:**
- Goal: 1,000 players
- Happy: 100 active players
- Lands per player: 1,000,000 (hard cap)
- **Total lands on map:** 1 billion theoretical max
- **Lands per hex:** ~1.09 million

**Land subsections per hex:** 1,090,000 subsections (at 1k player scale)
- One player could theoretically own entire map (given enough time/turns)
- Land discovery is instant but costly (100 population per land)

---

## 3. SCOUTING SYSTEM (LOCKED 2026-07-04)

**Two separate scout systems:**

### A. SCOUT — ALLOCATION-BASED (Passive Ring Reveal) — LOCKED

**Mechanic:** Assign rangers to scouting pool; rings auto-advance over time

**UI:**
- Allocate button (like building)
- Release All button
- Greyed out ONLY when final ring (Ring 17) is complete
- Available through Ring 1-16 regardless of Epic Trek progress

**Ranger allocation:**
- NO hard cap (unlimited rangers can be assigned)
- Scales by: ranger_count × level_multiplier × race_modifier

**Ring progression formula (LOCKED):**
```
turns_per_ring = 20 + (ring_number - 1) × 5

Ring 1: 20 turns
Ring 2: 25 turns
Ring 3: 30 turns
...
Ring 17: 100 turns
TOTAL: ~1,020 turns (at 50 rangers L1)
```

**Scaling example:**
- 50 rangers L1, no race mod: 1,020 turns full map
- 100 rangers L1, no race mod: 510 turns full map
- 50 rangers L100 (5.95x): ~171 turns full map

**Behavior:**
- Ring-based progression (Ring 1 = 6 hexes, Ring 2 = 12 hexes, Ring N ≈ 6N hexes)
- Auto-advances to next ring when current completes
- Discovers: locations, lore, junk prizes, kingdoms
- Adds discovered kingdoms to `discovered_kingdoms`
- Food cost: FREE

**Fog reveal:**
- Preferred: Incremental (0.25 hex per tick as ring progresses)
- Fallback: Full ring reveal on completion (if incremental too complex)
- Path of least resistance allowed this time only

---

### B. EPIC TREK — POINT-AND-GO (Active Exploration) — LOCKED

**Mechanic:** Player selects target coordinate on map, expedition travels there revealing fog en route

**Turn Cost (LOCKED):**
- **Formula: 1.5 turns per hex distance traveled**
- Example: 10 hex journey = 15 turns

**Behavior:**
- One-way ticket (no mid-journey redirect)
- Reveals only hexes in path (no corridor, just the cells crossed)
- Discovers via random chance per hex (same as Deep Expedition)
- Reveals: kingdoms, nodes, prices, artifacts
- Adds kingdoms to `discovered_kingdoms`
- Food cost: Same as Deep Expedition formula (scales by ranger count)

**Discovery (LOCKED):**
- Each hex crossed has random chance to find locations/artifacts
- Same probabilities as previous Deep Expedition
- Does NOT grey out Scout (achievements require scouting junk prizes)

---

## 4. HUNTING — TURN-BASED FOOD GATHERING (LOCKED)

**Turn cost:** 5 turns per hunt  
**Units:** Rangers  
**Reward:** 10 food per ranger at level 1  
**Food cost:** NONE (no food cost for hunting)  
**Terrain:** Forest biome (forests are better for hunting)

### Formula
```
food_reward = 10 × ranger_count × level_multiplier × forest_terrain_modifier
```

**Mechanics:**
- No food cost upfront
- No population cost
- Scales by ranger count and level
- Terrain modifier: Forest bonus, other biomes penalty
- Turn-based (takes 5 turns per action)

---

## 5. PROSPECTING — TURN-BASED GOLD GATHERING (LOCKED)

**Turn cost:** 5 turns per prospecting action  
**Units:** Engineers  
**Reward:** 5 gold per engineer at level 1  
**Food cost:** Same as Deep Expedition formula (scales by engineer count)  
**Terrain:** Mountain biome (mountains are better for prospecting)

### Formula
```
gold_reward = 5 × engineer_count × level_multiplier × mountain_terrain_modifier
food_cost = (engineer_count × level_multiplier) × (Deep_Exp_base_per_unit)
```

**Mechanics:**
- Food cost upfront (scales by engineers sent)
- No population cost
- Scales by engineer count and level
- Terrain modifier: Mountain bonus, other biomes penalty
- Turn-based (takes 5 turns per action)

---

## 6. LAND EXPANSION — INSTANT LAND DISCOVERY (LOCKED)

**Turn cost:** None (instant)  
**Units:** Population + Rangers  
**Population cost:** 100 population per land discovered (deducted from kingdom pool)  
**Reward:** Land (X,Y subsection within a hex)

### Formula
```
lands_discovered = (ranger_count / 10) × level_multiplier × race_modifier × terrain_modifier
population_deducted = lands_discovered × 100
```

**Base unit:** 10 rangers level 1 = 1 land discovered

**Race modifiers:** Use same as current "search for land" formula (varies by race)

**Terrain modifier:** Race-dependent biome preference

**Mechanics:**
- Instant action (no turn cost, no food cost)
- Costs population upfront (100 per land, deducted immediately)
- Rangers improve discovery rate
- Race modifier affects efficiency
- Discovers X,Y subsections within hexes
- If population cost exceeds available population, action rejected

---

## 7. DUNGEON RAID — TURN-BASED COMBAT EXPEDITION (LOCKED)

**Turn cost:** 50 turns + (hex_distance_to_location × 1.5 turns/hex)  
**Units:** Rangers + Fighters  
**Reward:** Weapons, Armor (per-troop equippable), Combat rewards
**Gating:** Hidden until player finds at least 1 dungeon location (via Scout or Epic Trek)

### Formula
```
total_turns = 50 + distance_in_hexes
combat_reward = (fighter_count × level_multiplier) + weapon_tier_bonus
armor_yield = fighter_count × armor_quality_tier × terrain_modifier
```

### Mechanics
- Turn-based expedition (takes 50+ turns)
- Distance calculated in hex units from home
- 1 hex distance = 1 turn added to base 50
- Returns weapons/armor tied to specific troop types
- Rewards scale by fighter count, level, terrain

---

## 8. MOUNTAIN'S HEART — TURN-BASED COMBAT EXPEDITION (LOCKED)

**Turn cost:** 100 turns + (hex_distance_to_location × 1.5 turns/hex)  
**Units:** Rangers (only)  
**Reward:** Combat rewards
**Gating:** Hidden until player finds at least 1 mountain location (via Scout or Epic Trek)

### Formula
```
total_turns = 100 + distance_in_hexes
combat_reward = (ranger_count × level_multiplier) × terrain_modifier
```

### Mechanics
- Turn-based expedition (takes 100+ turns)
- Distance calculated in hex units from home
- 1 hex distance = 1 turn added to base 100
- Rangers only (no fighters)
- Rewards scale by ranger count, level, terrain

---

## 9. LOCATION DISCOVERY (LOCKED)

**Scout sources:**
- Scout (allocation): Discovers locations, lore, junk prizes
- Epic Trek (point-and-go): Discovers locations via random chance per hex crossed

**Location handling:**
- When Scout or Epic Trek reveals a hex containing a kingdom, it's auto-added to `discovered_kingdoms`
- Same discovery mechanic as previous Scout/Deep Expedition

---

## 10. EXPEDITION MECHANICS (ALL TURN-BASED ACTIONS)

**Endpoint:** `POST /expedition/start` (existing pattern)

### Shared Rules
- Uses ranger/engineer allocation pool (validate against total available)
- All turn-based actions deduct turns from kingdom turn budget
- Results delivered when turn completes (async)
- Can be queued/cancelled per existing expedition system
- Food costs apply upfront

### Food Cost Pattern
```
food_cost = hex_count × (BASE_FOOD_COST - (level_multiplier × FOOD_DISCOUNT))
floored at MIN_FOOD_COST
```

---

## 11. IMPLEMENTATION PHASES

### Phase 1: Refactor Instant Searches → Turn-Based
1. Convert `/search/land` → turn-based Land Expansion (instant action with population cost)
2. Convert `/search/gold` → turn-based Prospecting (5 turns, food cost)
3. Convert `/search/food` → turn-based Hunting (5 turns, no food cost)
4. Update ExplorationPanel UI for turn-based actions
5. Use same allocation validation as existing turn-based expeditions

### Phase 2: Scout System — Allocation Model
1. Implement Scout allocation pool (assign rangers to scouting)
2. Ring-based reveal (Ring 1 → Ring 2 → etc. auto-advance)
3. UI: Allocate/Release All buttons (matching building interface)
4. Grey out when full map revealed
5. Discovers same as previous Scout Expedition: locations, lore, junk prizes

### Phase 3: Epic Trek — Point-and-Go Exploration
1. Enable player to select target coordinate on map (X,Y)
2. Calculate distance in hex units (1.22 turns per hex)
3. Implement pathfinding along route
4. Progressive fog reveal per hex crossed
5. Random discovery chance per hex (same as Deep Expedition)
6. Food cost: Deep Expedition formula, scaled by ranger count
7. Adds discovered kingdoms to `discovered_kingdoms`

### Phase 4: Dungeon Raid + Mountain's Heart (Regional)
1. Update turn costs: 50 + distance, 100 + distance
2. Implement distance calculation (hex units from home)
3. Implement equipment looting per troop type
4. Define one Dungeon per region (deferred)
5. Define one Mountain per region (deferred)

---

## 11. COORDINATE SYSTEMS (LOCKED)

### Hexes (Visibility Only)
- Used for fog of war, scouting reveal rings
- Odd-r offset: (col, row)
- ~918 total on the map
- Rendering only (SVG overlay in WorldmapRenderer.jsx)

### X,Y Continuous (Game Data)
- Used for all kingdom/node/land positions
- Kingdom positions stored as X,Y
- Resource nodes stored as X,Y
- Land subsections stored as X,Y (within hex regions)
- Distance calculations use continuous coordinates
- Hex assignment: `pixelToHex(x, y)` converts X,Y to (col, row) for visibility checks

---

## 12. KNOWN UNKNOWNS (TO SPECIFY LATER)

- [ ] Exact terrain modifiers per biome (for Hunting, Prospecting, etc.)
- [ ] Base lands discovered per Land Expansion action
- [ ] Food cost amounts for each turn-based action
- [ ] Epic Trek reward formula (artifacts, rare prizes tiers)
- [ ] Combat reward exact amounts for Dungeon Raid / Mountain's Heart
- [ ] Regional location definitions (1 Dungeon, 1 Mountain per region)

---

## 13. VERIFICATION CHECKLIST

Before coding each phase:

- [ ] No more than 3 files modified per commit
- [ ] Scout/Hunting/Prospecting use same allocation validation pattern
- [ ] All turn-based actions use `/expedition/start` endpoint
- [ ] Hex system stays separate from X,Y data system
- [ ] Food costs validated upfront before action launches
- [ ] Terrain modifiers applied consistently across all rewards
- [ ] Distance calculations use hex units (not pixels)
- [ ] ExplorationPanel UI updated for new action names/costs

---

## COMPLETE REFERENCE (LOCKED 2026-07-04)

**Map & Scale:**
- Size: 1999 × 1380 pixels, 918 hexes (~17 rings)
- Players: 1000 goal, 100 happy, 1M lands/player cap
- Total lands: 1 billion max, ~1.09M per hex

**SCOUT SYSTEM (COMPLETE):**

*Scout (Allocation-based):*
- No hard cap on rangers (unlimited allocation)
- Ring progression: Ring N = 20 + (N-1) × 5 turns
- Base: 50 rangers L1 = ~1,020 turns full map
- Scales by: ranger_count × level_multiplier × race_modifier
- FREE (no food cost)
- Fog reveal: Incremental preferred, full-ring fallback
- Greyed out ONLY at Ring 17 (final ring)
- Available through Ring 1-16 regardless of Epic Trek progress
- Discovers: locations, lore, junk prizes, kingdoms
- Gating: None (available from start)

*Epic Trek (Point-and-go):*
- Turn cost: 1.5 turns per hex distance
- Reveals en route (kingdoms, nodes, prices, artifacts)
- Random discovery chance per hex (same as Deep Expedition)
- Food cost: Deep Expedition formula
- ONE-WAY (no mid-journey redirect)
- Gating: Hidden until Ring 2 Scout complete
- Does NOT grey out Scout

*Dungeon Raid:*
- Turn cost: 50 + (distance × 1.5)
- Units: Rangers + Fighters
- Loot: Same as previous (weapons, armor, combat rewards)
- Gating: Hidden until 1 dungeon found

*Mountain's Heart:*
- Turn cost: 100 + (distance × 1.5)
- Units: Rangers only
- Loot: Same as previous (combat rewards)
- Gating: Hidden until 1 mountain found

**TURN-BASED ACTIONS:**
- Hunting: 5 turns, 10 food/ranger L1, Forest, NO food cost
- Prospecting: 5 turns, 5 gold/engineer L1, Mountain, Deep-Exp food cost
- Land Expansion: Instant, 10 rangers = 1 land, 100 pop/land, Race mods

**COMPLETE MAPPINGS:**
- search for gold → Prospecting ✅
- search for food → Hunting ✅
- search for land → Land Expansion ✅
- search for locations → Epic Trek + Scout ✅
- Scout Expedition → Scout (allocation) ✅
- Deep Expedition → Epic Trek (point-and-go) ✅
- Dungeon Raid → Regional-specific, hidden until found ✅
- Mountain's Heart → Regional-specific, hidden until found ✅

---

## IMPLEMENTATION READY

**ALL PARAMETERS LOCKED.** NO MORE CHANGES.
This is the source of truth. NO MORE RE-EXPLAINING.


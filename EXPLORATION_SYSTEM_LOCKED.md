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

## 3. SCOUTING — CONCENTRIC RING MODEL (LOCKED)

**System:** Progressive reveal outward from home kingdom (Ring 0 → Ring N)

### Scout Economy Constants

```
BASE_HEX_EXPLORATION_PER_RANGER: 0.00001
MAX_SCOUTING_RANGERS: 10,000
RANGER_LEVEL_BONUS_PER_LEVEL: 0.05 (level 100 = 5.95x)
```

### Scout Formulas

**Hexes explored per action:**
```
hexes = rangers_sent × level_multiplier × 0.00001
```

**Examples:**
- 1 ranger level 1 = 0.00001 hexes per action
- 10,000 rangers level 1 = 0.1 hexes per action
- 10,000 rangers level 100 = 0.595 hexes per action
- Full map (195 hexes visible) in ~328 turns at level 100

**Food cost per hex:** 50 - (level_multiplier × 30), floored at 20

### Scout Mechanics

- No targeting UI (auto-advances to next unrevealed ring)
- Each action reveals next concentric ring outward
- Reveals locations and resource nodes in hexes
- Auto-adds discovered kingdoms to `discovered_kingdoms`
- **No turn cost** for scout action itself (not turn-based expedition)

---

## 4. HUNTING — TURN-BASED FOOD GATHERING

**Turn cost:** 5 turns per hunt  
**Units:** Rangers  
**Reward:** 10 food per ranger at level 1

### Formula
```
food_reward = 10 × ranger_count × level_multiplier × terrain_modifier
```

**Terrain scaling:** TBD by biome (forest better, desert worse, etc.)

### Mechanics
- Costs food to launch (TBD amount)
- No population cost
- Scales by ranger count and level
- Turn-based (takes 5 turns per action)

---

## 5. PROSPECTING — TURN-BASED GOLD GATHERING

**Turn cost:** 5 turns per prospecting action  
**Units:** Engineers  
**Reward:** 5 gold per engineer at level 1

### Formula
```
gold_reward = 5 × engineer_count × level_multiplier × terrain_modifier
```

**Terrain scaling:** TBD by biome (mountains better, swamps worse, etc.)

### Mechanics
- Costs food to launch (TBD amount)
- No population cost
- Scales by engineer count and level
- Turn-based (takes 5 turns per action)

---

## 6. LAND EXPANSION — INSTANT LAND DISCOVERY

**Turn cost:** None (instant)  
**Units:** Population + Rangers  
**Cost:** 100 population per land discovered  
**Reward:** Land (X,Y subsection within a hex)

### Formula
```
lands_discovered = base_amount × (ranger_count × level_multiplier) × terrain_modifier
base_amount = TBD (TBD how many lands per instant action)
```

**Mechanics:**
- Instant action (no turn cost)
- Costs population upfront
- Rangers improve discovery rate (more lands per action)
- Terrain affects efficiency
- Discovers X,Y subsections within hexes

---

## 7. DUNGEON RAID — TURN-BASED COMBAT EXPEDITION

**Turn cost:** 50 turns + (hex_distance_to_location × 1 turn/hex)  
**Units:** Rangers + Fighters  
**Reward:** Weapons, Armor (per-troop equippable), Combat rewards

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

## 8. MOUNTAIN'S HEART — TURN-BASED COMBAT EXPEDITION

**Turn cost:** 100 turns + (hex_distance_to_location × 1 turn/hex)  
**Units:** Rangers (only)  
**Reward:** Combat rewards

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

## 9. EXPEDITION MECHANICS (ALL TURN-BASED ACTIONS)

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

## 10. IMPLEMENTATION PHASES

### Phase 1: Refactor Instant Searches → Turn-Based
1. Convert `/search/land` → turn-based Land Expansion
2. Convert `/search/gold` → turn-based Prospecting
3. Convert `/search/food` → turn-based Hunting
4. Update ExplorationPanel UI for turn-based actions

### Phase 2: Rename Scout/Deep → Scout/Epic Trek
1. Rename Scout Expedition → Scout
2. Rename Deep Expedition → Epic Trek
3. Implement concentric ring model (remove col/row targeting)
4. Update ExplorationPanel labels

### Phase 3: Dungeon Raid + Mountain's Heart
1. Update turn costs to 50 + distance and 100 + distance
2. Implement distance calculation (hex units)
3. Implement equipment looting per troop

### Phase 4: Regional Locations (Deferred)
1. Define one Dungeon per region
2. Define one Mountain per region
3. Gate access by region discovery

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

## REFERENCE

- Map: 1999 × 1380 pixels, 918 hexes
- Scouts: 0.00001 hexes/ranger level 1, 10k cap, concentric rings
- Hunting: 5 turns, 10 food/ranger level 1
- Prospecting: 5 turns, 5 gold/engineer level 1
- Land: instant, 100 population per land
- Dungeon: 50 + distance turns, fighters + rangers
- Mountain: 100 + distance turns, rangers only
- 1 billion lands max (1000 players × 1M each)
- ~1.09M lands per hex

**This document is the source of truth. No more re-explaining.**


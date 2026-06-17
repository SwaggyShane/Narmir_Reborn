# Building System Implementation Plan

## Overview
Implement an 8-tier building system with progressive costs and times. Engineer level affects build speed. Racial and world fragment modifiers apply.

## Building Tier Structure

### Tier 1: Farms
- Land: 0, Wood: 0, Stone: 0, Iron: 0
- Time: 100 engineers × 10 turns
- Count: 1 building (Farms)

### Tier 2: Housing, Granaries, Taverns
- Land: 50, Wood: 200, Stone: 100, Iron: 50
- Time: 100 engineers × 100 turns
- Count: 3 buildings

### Tier 3: Markets, Barracks, Libraries, Schools, Shrines, Mausoleums
- Land: 150, Wood: 800, Stone: 500, Iron: 200
- Time: 100 engineers × 500 turns
- Count: 6 buildings

### Tier 4: Guard Towers
- Land: 300, Wood: 2000, Stone: 1500, Iron: 500
- Time: 100 engineers × 2500 turns
- Count: 1 building

### Tier 5: Walls, Outposts, Smithies
- Land: 500, Wood: 5000, Stone: 5000, Iron: 1500
- Time: 100 engineers × 10000 turns
- Count: 3 buildings

### Tier 6: Armories, Vaults, Mage Towers
- Land: 750, Wood: 7500, Stone: 12500, Iron: 3000
- Time: 100 engineers × 25000 turns
- Count: 3 buildings

### Tier 7: Training Fields
- Land: 850, Wood: 8500, Stone: 17500, Iron: 4000
- Time: 100 engineers × 35000 turns
- Count: 1 building

### Tier 8: Castles
- Land: 1000, Wood: 10000, Stone: 25000, Iron: 5000
- Time: 100 engineers × 50000 turns
- Count: 1 building

---

## Engineer XP/Leveling System

### Schema Changes (db/schema.js)
Add to `kingdoms` table:
```sql
engineer_level INTEGER NOT NULL DEFAULT 1,
engineer_xp INTEGER NOT NULL DEFAULT 0
```

### Config Changes (game/config.js)
Create ENGINEER_LEVELS object (scales to level 25+ for dwarf solo-crew):
```javascript
ENGINEER_LEVELS: {
  1: { xp_needed: 0, construction_mult: 1.0, description: "Apprentice Mason" },
  2: { xp_needed: 1000, construction_mult: 1.05, description: "Journeyman Mason" },
  5: { xp_needed: 5000, construction_mult: 1.1, description: "Master Mason" },
  10: { xp_needed: 15000, construction_mult: 1.15, description: "Grand Architect" },
  15: { xp_needed: 30000, construction_mult: 1.18, description: "Supreme Builder" },
  25: { xp_needed: 75000, construction_mult: 1.25, description: "Legendary Craftsman", dwarf_solo_crew: true },
  // Level 25+ grants dwarves solo-crew ability for war machines
}
```

### XP Gain
Engineers gain XP when buildings complete. XP amount = base_build_time / 100 (scales with building complexity).

### Level Progression
When engineer_xp >= required XP for next level, auto-level and reset XP.

---

## Build Time Calculation

### Formula
```
base_time = tier_time / (100 engineers)
adjusted_time = base_time / engineer_construction_mult
racial_adjusted = adjusted_time / racial_construction_mult
final_time = racial_adjusted / world_fragment_construction_mult
```

### Modifiers Applied (in order)
1. **Engineer Level Multiplier** (1.0 - 1.2+)
2. **Racial Modifier** (Dwarf 1.5×, Human 1.1×, etc.)
3. **World Fragment Modifier** (various bonuses/penalties)

---

## Resource Cost Calculation

### Formula
Costs apply the same multipliers as time:
```
final_cost = base_cost / (racial_resource_mult * world_fragment_resource_mult)
```

Example: Dwarf building Guard Tower
- Base: 300 land, 2000 wood, 1500 stone, 500 iron
- Dwarf construction bonus (1.5×) reduces actual cost by ~15-20%
- Final cost: ~255 land, 1700 wood, 1275 stone, 425 iron

---

## Implementation Files

### 1. Database Schema (db/schema.js)
- [ ] Add `engineer_level` and `engineer_xp` columns to kingdoms table
- [ ] Add migration for existing kingdoms (set engineer_level = 1, engineer_xp = 0)

### 2. Config (game/config.js)
- [ ] Add ENGINEER_LEVELS object with progression
- [ ] Add BUILDING_COSTS object mapping tier → costs
- [ ] Add BUILDING_TIMES object mapping tier → base time
- [ ] Add BUILDING_TIERS mapping building → tier number

### 3. Engine (game/engine.js)
- [ ] Create `calculateBuildTime(kingdom, tier)` function
- [ ] Create `calculateBuildCost(kingdom, tier)` function
- [ ] Create `awardEngineerXp(kingdom, xp_earned)` function
- [ ] Create `levelUpEngineer(kingdom)` function (auto-level on XP threshold)
- [ ] Apply to turn processing when buildings complete

### 4. Routes (routes/kingdom.js)
- [ ] `/api/kingdom/build` endpoint
  - Validate cost/land availability
  - Check engineer availability
  - Create building record with turn calculation
  - Deduct resources from kingdom
- [ ] `/api/kingdom/cancel-building` endpoint (refund resources, cancel build)
- [ ] `/api/kingdom/overview` returns engineer level/xp

### 5. Frontend (client/src/components/react/BuildPanel.jsx)
- [ ] Display available buildings with costs/times
- [ ] Show engineer level and progress to next level
- [ ] Build button that calculates adjusted times/costs
- [ ] Building queue showing current constructions
- [ ] Cancel button for in-progress buildings

---

## Verification Checklist

- [ ] Engineer level displays correctly
- [ ] XP gain works when buildings complete
- [ ] Auto-leveling triggers at correct thresholds
- [ ] Build time scales with engineer level
- [ ] Racial modifiers apply correctly
- [ ] World fragment modifiers apply correctly
- [ ] Resource costs deducted properly
- [ ] Building queue persists across turns
- [ ] Buildings complete and award XP
- [ ] All 19 buildings are buildable

---

## Racial Unit Level 25+ Milestones

All races unlock special abilities when their primary unit reaches level 25+:

### By Race & Unit Type

| Race | Unit | Level 25+ Ability | Implementation |
|------|------|-------------------|-----------------|
| **Dwarf** | Engineers | Solo-crew war machines (1 instead of 2) | Check in WM crew validation |
| **High Elf** | Mages | Produce 2 scrolls per craft instead of 1 | Check in research/craft system |
| **Orc** | Fighters | Passively generate free trainees each turn | Award bonus fighters during turn processing |
| **Dark Elf** | Ninjas | Silent assassinations (hidden from news) | Set news flag to hidden for covert ops |
| **Dire Wolf** | Rangers | Execute expeditions at much faster pace | Apply speed multiplier to expeditions |
| **Human** | Clerics | Radiate healing aura (restore happiness) | Award happiness bonus each turn |
| **Vampire** | Thieves | Higher theft/sabotage success rates | Apply success multiplier to covert ops |

### Implementation Approach
Create UNIT_LEVEL_25_BONUSES in config.js:
```javascript
UNIT_LEVEL_25_BONUSES: {
  dwarf: { unit: "engineers", bonus: "solo_crew_wm" },
  high_elf: { unit: "mages", bonus: "double_scroll_craft" },
  orc: { unit: "fighters", bonus: "free_trainee_generation" },
  dark_elf: { unit: "ninjas", bonus: "silent_assassination" },
  dire_wolf: { unit: "rangers", bonus: "fast_expeditions" },
  human: { unit: "clerics", bonus: "happiness_aura" },
  vampire: { unit: "thieves", bonus: "theft_boost" },
}
```

Then check these bonuses in relevant systems during turn processing.

---

## Notes

- Buildings are persistent (not removed when complete, just increment count)
- Engineer level caps at 25 (allows dwarf solo-crew unlock)
- XP requirement scales per level (exponential: 1k, 5k, 15k, 30k, 75k)
- Multiple buildings can be queued simultaneously (if design allows)
- Dwarf solo-crew milestone at level 25 is critical for late-game war machine economy

# Exploration System Redesign

**Status:** Design locked (2026-07-03)  
**Scope:** Replace instant single-turn searches + expeditions with turn-based actions scaled by unit type, count, level, and terrain.

---

## Current System (Being Replaced)

- **Scout Expedition** — 10 turn scout expedition
- **Deep Expedition** — 25 turn deep expedition  
- **Dungeon Raid** — 50 turn dungeon raid
- **Mountain's Heart** — 100 turn mountain's heart
- **Instant searches** — single-turn land, gold, food, target discovery

## New System (Locked Design)

| Feature | Old Name | New Name | Units | Cost | Rewards |
|---------|----------|----------|-------|------|---------|
| Scout (near) | Scout Expedition | Scout | Rangers | Food | Visibility, locations, nodes |
| Scout (far) | Deep Expedition | Epic Trek | Rangers | Food | Visibility (extended range), locations, nodes, **artifacts, rare prizes** (same tiers) |
| Land | Land search | Land Expansion | Population + Rangers | 100 pop = 1 land | Land (rangers/level expedite) |
| Gold | Gold search | Prospecting | Engineers | Food | Gold (terrain-dependent) |
| Food | Food search | Hunting | Rangers | None | Food (terrain-dependent, rangers/level scale rewards) |
| Combat (low) | Dungeon Raid | Dungeon Raid | Rangers + Fighters | Food | Weapons, Armor (per-troop equip), combat rewards |
| Combat (high) | Mountain's Heart | Mountain's Heart | Rangers | Food | Combat rewards |

---

## Key Design Decisions

### Rewards Scale By
- **Unit count** (more rangers = more food/visibility)
- **Unit level** (higher level = better rewards, faster completion)
- **Terrain** (biome modifiers apply to rewards)

### Turn Cost Model (TBD)
- Baseline turn costs per action type (e.g., Scout = 10 turns, Epic Trek = 25 turns)
- Modifiers by unit count and level (more rangers may reduce turn cost or increase reward)

### Artifacts & Rare Prizes (Epic Trek Only)
- Epic Trek finds same tier artifacts/prizes as current Deep Expedition
- Scout does not find artifacts (lower tier)

### Equipment System (Dungeon Raid)
- Each troop type loots weapons/armor
- Must equip looted items to individual troop instances
- Combat rewards follow existing system

### Regional Dungeons/Mountains (Future)
- Dungeons and Mountains should be **one per region** (not global arbitrary expeditions)
- Deferred to Phase 2 of this redesign

---

## Terrain Scaling

All turn-based actions scale rewards by terrain modifier:
- **Hunting:** Food yield affected by biome (forest better for hunting, desert worse)
- **Prospecting:** Gold yield affected by biome (mountains better, swamps worse)
- **Scout/Epic Trek:** Visibility/findings affected by terrain (clearer terrain easier scouting)
- **Land Expansion:** Population efficiency affected by terrain (fertile land easier expansion)

---

## Implementation Phases

### Phase 1: Refactor Instant Searches → Turn-Based Actions
1. Convert `POST /search/land` → `POST /expedition/land-expansion` (turn-based)
2. Convert `POST /search/gold` → `POST /expedition/prospecting` (turn-based)
3. Convert `POST /search/food` → `POST /expedition/hunting` (turn-based)
4. Update `ExplorationPanel.jsx` to launch turn-based actions instead of instant searches

### Phase 2: Rename Scout/Deep → Scout/Epic Trek
1. Rename Scout Expedition → Scout
2. Rename Deep Expedition → Epic Trek
3. Update ExplorationPanel labels and metadata
4. Ensure Epic Trek still finds artifacts/rare prizes

### Phase 3: Equipment System for Dungeon Raid
1. Implement per-troop equipment looting
2. Update combat resolver to use looted equipment
3. Display equipment on troop status

### Phase 4: Regional Dungeons/Mountains
1. Define region-scoped dungeon/mountain locations
2. One Dungeon Raid location per region
3. One Mountain's Heart location per region
4. Gate access by region discovery or scouting

---

## Notes

- All turn-based actions use the same `POST /expedition/launch` pattern as current expeditions
- Rewards formulas should follow the existing pattern: `base * unit_count * level_multiplier * terrain_modifier`
- Artifact/rare prize logic remains unchanged from current Deep Expedition
- Equipment looting replaces current flat combat rewards for Dungeon Raid


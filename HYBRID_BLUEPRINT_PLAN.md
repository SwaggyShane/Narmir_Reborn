# Hybrid Blueprint & World Fragment Bonuses - Implementation Plan

## Implementation Status

| Component | Status |
|---|---|
| Backend API endpoints (`get-buildings`, `confirm-assignment`, `assign-hybrid-blueprint`) | ✅ Implemented (`routes/kingdom.js`) |
| Database schema (`hybrid_blueprints`, `fragment_bonuses` columns) | ✅ Implemented |
| Fragment bonus manager (`game/fragment-bonus-manager.js`) | ✅ Implemented |
| Fragment bonuses in engine calculations (housing, barracks, schools, libraries, etc.) | ✅ Integrated (`game/engine.js`) |
| Vanilla JS frontend (Library panel + `assignHybridBlueprint()`) | ✅ Implemented (`client/index.html`) |
| React frontend (`HybridBlueprintPanel.jsx`, `HybridBlueprintModal.jsx`) | ⏳ Pending — part of vanilla → React migration |
| Special mechanics (map theft block, void randomness, etc.) | ⚠️ Partial — varies by fragment type |
| Fragment bonuses in combat calculations | ⚠️ Partial — see `WORLD_FRAGMENT_SYSTEM.md` pending items |

---

## Overview
Complete workflow for applying world fragments to buildings through hybrid blueprints:
1. Fragment is found/obtained
2. Fragment is studied (scribe work)
3. Fragment transcribed to hybrid blueprint (scribe work)
4. Hybrid blueprint stored in Library panel
5. Player selects building via modal with double warning
6. Bonuses applied permanently and irreversibly

## Components

### 1. Database Schema
**Table: kingdom_fragment_bonuses** (new)
- `id` (primary key)
- `kingdom_id` (foreign key)
- `building_type` (e.g., 'farms', 'smithies')
- `fragment_name` (e.g., 'Volcanic Rock')
- `applied_at` (timestamp)
- `turn_applied` (game turn)

**Update: kingdoms table**
- Add `fragment_bonuses` TEXT column (JSON object mapping building => fragment)

### 2. Backend API Endpoints

**POST /api/library/hybrid-blueprints/select**
- Validates hybrid blueprint exists and unassigned
- Displays available buildings (all building types)
- Each building shows:
  - Name
  - Current count
  - Fragment bonus preview
  - Passive bonuses (multipliers)
  - Special mechanics (description)

**POST /api/library/hybrid-blueprints/assign**
- First confirmation: receives building selection
- Returns: Detailed bonus info + "Are you sure?" warning
- Second confirmation: player confirms with `confirmed: true`
- On confirmation:
  - Cost: 500k gold, 100k mana
  - Mark hybrid blueprint as assigned
  - Apply fragment to building
  - Store in fragment_bonuses table
  - Return to UI

### 3. Frontend Components

**HybridBlueprintPanel.jsx** (new)
- Display when kingdom has unassigned hybrid blueprints
- List view of available blueprints with fragment names
- Click to open selection modal

**HybridBlueprintModal.jsx** (new)
- Shows all available buildings with their bonus previews
- Grid/list of buildings organized by category:
  - Combat (barracks, training, etc.)
  - Defense (walls, towers, etc.)
  - Economy (markets, vaults, etc.)
  - Magic (mage_towers, shrines, etc.)
  - Production (farms, resource buildings, etc.)
  - Other

**Building Selection Card Component**
- Building name + current count
- Bonus name + description
- Passive multipliers displayed
- Special mechanics explained
- "Select" button

**Double Confirmation Dialog**
```
First modal: "Select Building"
├─ Building details
├─ Bonuses preview
└─ "Select This Building" button

Second modal: "Confirm Irreversible Choice"
├─ "You are applying [Fragment] to [Building]"
├─ List all benefits
├─ "This cannot be undone!"
├─ Checkbox: "I understand this is permanent"
├─ Cancel / Confirm buttons
```

### 4. Game Logic Integration

**ApplyFragmentBonus.js** (new utility)
- Takes: fragment name, building type, kingdom
- Returns: bonus object with:
  - passive: { production, capacity, speed, defense, etc. }
  - special: { name, description, effect_function }

**Building Calculation Updates**
- farms.js: Apply production/consumption multipliers from FRAGMENT_BONUSES
- walls.js: Apply defense/regen multipliers
- shrines.js: Apply healing/capacity multipliers
- mage_towers.js: Apply mana/spell multipliers
- smithies.js: Apply quality/durability multipliers
- etc.

Each building's calculation should:
1. Check if kingdom has fragment_bonuses[building_type]
2. Load bonus from FRAGMENT_BONUSES config
3. Apply passive multipliers
4. Apply special mechanics

### 5. Special Mechanics Implementation

Some fragments have special mechanics beyond multipliers:

**Dwarven Star-Metal on Library**
- Effect: "Impenetrable Box" - Maps cannot be stolen/lost
- Implementation: Check in map-stealing code

**Void Essence on Granaries**
- Effect: Unlimited storage but 10% random spoilage
- Implementation: Volatile storage mechanic

**Tears of the World Tree on Farms**
- Effect: Crops never fail, multiply if overabundant
- Implementation: Override blight/disaster effects

**Celestial Feather on Shrines**
- Effect: No limit on injured troops healing
- Implementation: Remove capacity checks in healing

## Database Migration
```sql
-- Add column to track applied fragments per building
ALTER TABLE kingdoms ADD COLUMN fragment_bonuses TEXT NOT NULL DEFAULT '{}';

-- Example data structure:
{
  "farms": {
    "fragment": "Volcanic Rock",
    "applied_turn": 125,
    "passive": { "production": 0.15 },
    "special": "Geothermal Fertility"
  },
  "smithies": {
    "fragment": "Dwarven Star-Metal",
    "applied_turn": 130,
    "passive": { "quality": 0.35, "durability": 0.50 },
    "special": "Master Forge"
  }
}
```

## Implementation Order
1. ✓ World fragment bonuses config created (game/world-fragment-bonuses.js)
2. Database schema migration (add fragment_bonuses column)
3. Backend API endpoint for blueprint selection + assignment
4. Utility function to apply/calculate bonuses
5. Frontend modal for building selection + double warning
6. Library panel to display hybrid blueprints
7. Integration into game calculations (farms, walls, towers, etc.)
8. Test with all 10 fragments × ~25 buildings

## Cost & Constraints
- **Cost to assign**: 500k gold, 100k mana (already in code)
- **Irrevocable**: Choice cannot be undone
- **One per building**: Each building can only have one fragment applied
- **Visual feedback**: Applied fragments visible in building info panels

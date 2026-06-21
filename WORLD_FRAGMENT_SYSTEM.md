# World Fragment Bonus System - Implementation Guide

## Overview

Complete system for applying world fragment bonuses to buildings through hybrid blueprints. The workflow is designed to be intentional, permanent, and impactful.

## System Architecture

### 1. Fragment Discovery & Preparation
```
1. Player finds a World Fragment (10 types available)
   → Stored in kingdom.world_fragments (array)
   
2. Player uses Library to STUDY fragment (Scribe task)
   → Requires: 50 scribes, 200 turns
   → Consumes: 1 world fragment
   → Produces: Study fragment complete
   
3. Player TRANSCRIBES studied fragment to hybrid blueprint (Scribe task)
   → Requires: 100 scribes, 300 turns
   → Consumes: studied fragment
   → Produces: 1 hybrid blueprint
   → Stored in: kingdom.hybrid_blueprints (unassigned)
```

### 2. Fragment Application Workflow

**Stage 1: Selection**
```
User clicks "Apply" on hybrid blueprint in library panel
→ HybridBlueprintModal opens with GET /hybrid-blueprint/get-buildings
→ Returns: List of all buildings + their potential bonuses
→ User sees:
   - Building name & current count
   - Bonus name (special ability)
   - Bonus description
   - Passive multipliers (if any)
   - Organized grid layout
```

**Stage 2: Confirmation**
```
User clicks building → Modal switches to confirmation stage
→ Shows detailed bonus information
→ Displays cost (500k gold, 100k mana)
→ Shows WARNING: "This choice is PERMANENT"
→ Requires TWO checkboxes:
   ☐ "I understand this choice is permanent"
   ☐ "I confirm I want to apply this fragment"
→ Disabled submit button until both checked
```

**Stage 3: Application**
```
User clicks "APPLY FRAGMENT" → POST /hybrid-blueprint/confirm-assignment
→ Validates:
   - Gold ≥ 500k
   - Mana ≥ 100k
   - Building not already assigned
   - Fragment config exists
→ If valid:
   - Deduct 500k gold, 100k mana
   - Mark hybrid blueprint as assigned
   - Store in kingdom.fragment_bonuses
   - Insert news entry
   - Return success
→ Updates UI with new gold/mana
```

## Database Schema

### kingdoms table
```javascript
{
  // ... existing columns ...
  
  // New columns for fragment system:
  world_fragments: JSON,        // Array of fragment names found
  hybrid_blueprints: JSON,      // { id: { fragment, assigned, building } }
  fragment_bonuses: JSON        // { building: { fragment, passive, special } }
}
```

### fragment_bonuses structure
```javascript
{
  "farms": {
    "fragment": "Volcanic Rock",
    "applied_turn": 125,
    "passive": {
      "production": 0.15,
      "consumption": 0.05
    },
    "special": {
      "name": "Geothermal Fertility",
      "desc": "Heat accelerates growth but increases population hunger"
    }
  },
  "smithies": {
    "fragment": "Dwarven Star-Metal",
    "applied_turn": 130,
    "passive": {
      "quality": 0.35,
      "durability": 0.50
    },
    "special": {
      "name": "Master Forge",
      "desc": "All equipment becomes legendary; +40% effectiveness, never breaks"
    }
  }
}
```

## API Endpoints

### POST /api/kingdom/hybrid-blueprint/get-buildings
Returns available buildings for a specific hybrid blueprint with bonus previews.

**Request:**
```javascript
{
  blueprintId: "abc123"
}
```

**Response:**
```javascript
{
  ok: true,
  fragment: "Volcanic Rock",
  blueprintId: "abc123",
  availableBuildings: [
    {
      buildingType: "farms",
      name: "Farms",
      count: 42,
      bonus: {
        name: "Geothermal Fertility",
        desc: "Heat accelerates growth...",
        passive: { production: 0.15, consumption: 0.05 }
      }
    },
    // ... more buildings ...
  ]
}
```

### POST /api/kingdom/hybrid-blueprint/confirm-assignment
Two-step endpoint for building selection and final confirmation.

**Request (First call - no confirmation):**
```javascript
{
  blueprintId: "abc123",
  buildingType: "farms",
  confirmed: false
}
```

**Response (Warning):**
```javascript
{
  ok: false,
  warning: true,
  message: "This choice is PERMANENT and cannot be undone",
  details: {
    fragment: "Volcanic Rock",
    building: "farms",
    bonus: { /* full bonus config */ },
    cost: { gold: 500000, mana: 100000 }
  }
}
```

**Request (Second call - confirmed):**
```javascript
{
  blueprintId: "abc123",
  buildingType: "farms",
  confirmed: true
}
```

**Response (Success):**
```javascript
{
  ok: true,
  message: "Fragment bonus applied successfully",
  applied: {
    fragment: "Volcanic Rock",
    applied_turn: 125,
    passive: { production: 0.15, consumption: 0.05 },
    special: { name: "Geothermal Fertility", desc: "..." }
  },
  gold: 12500000,
  mana: 95000
}
```

## Game Logic Integration

### Bonus Manager (game/fragment-bonus-manager.js)

Core utility functions:

```javascript
// Parse bonuses from kingdom JSON
getKingdomFragmentBonuses(kingdom) → object

// Check if building has fragment
getFragmentForBuilding(kingdom, buildingType) → object|null

// Get bonus config for fragment+building
getBonusConfig(fragmentName, buildingType) → object|null

// Apply fragment to building
applyFragmentBonus(kingdom, fragmentName, buildingType) → result

// Get available buildings for modal
getAvailableBuildingsWithBonuses(kingdom, fragmentName) → array

// Calculate bonus multiplier for stat
getBonusMultiplier(kingdom, buildingType, statType) → number

// Apply bonus multiplier to value
applyFragmentMultiplier(kingdom, buildingType, baseValue, statType) → number

// Get special mechanics for building
getSpecialEffect(kingdom, buildingType) → object|null
```

### Integration Points

**1. Production Calculations (farms, granaries, etc.)**
```javascript
// In engine.js or production calculator:
const baseYield = 100;
const multiplier = fragmentBonusManager.getBonusMultiplier(
  kingdom,
  'farms',
  'production'
);
const finalYield = baseYield * multiplier;
```

**2. Defense Calculations (walls, towers, etc.)**
```javascript
const baseDefense = 1000;
const multiplier = fragmentBonusManager.getBonusMultiplier(
  kingdom,
  'walls',
  'defense'
);
const finalDefense = baseDefense * multiplier;
```

**3. Special Mechanics (Dwarven Star-Metal on Library)**
```javascript
const effect = fragmentBonusManager.getSpecialEffect(kingdom, 'libraries');
if (effect && effect.name === 'Impenetrable Box') {
  // Maps cannot be stolen
  canStealMaps = false;
}
```

## 10 World Fragments & Their Effects

### 1. **Volcanic Rock** - Fire, Creation, Forge
- **Smithies**: +40% quality/durability, eternal forge
- **Farms**: +15% yield, +5% consumption
- **War Machines**: +25% damage, heated metal
- **Walls**: +10% defense, lava moat damage to siegers
- **Mage Towers**: +20% mana regen, fire spells 20% stronger

### 2. **Ancient Elven Wood** - Nature, Magic, Timeless
- **Farms**: +20% yield, immune to blight
- **Granaries**: +50% capacity, food ages like fine wine
- **Libraries**: +25% speed, scrolls cannot be forgotten
- **Lumber Camp**: +40% production, living forests regrow
- **Mage Towers**: +25% mana, become ley-line anchor

### 3. **Dragon Scale** - Power, Combat, Dominance
- **Barracks**: +25% training, soldiers feel draconic strength
- **Training**: +20% speed, graduates become permanent veterans
- **War Machines**: +20% damage vs walls
- **Weapons**: +20% damage, dragonbane edge
- **Castles**: +30% defense, dragon's seat inspires defenders

### 4. **Abyssal Crystal** - Void, Chaos, Forbidden Power
- **Mage Towers**: +40% mana, tap void directly
- **Vaults**: +150% capacity, 1% gold randomly vanishes
- **Granaries**: +100% capacity, 10% food becomes unstable
- **War Machines**: +30% damage, ignore 50% of wall defense
- **Deep Mines**: +50% production, find impossible ores

### 5. **Celestial Feather** - Light, Hope, Divine
- **Shrines**: +35% healing, no limit on injured troops
- **Taverns**: +30% happiness, never drops below 50%
- **Walls**: +25% defense, first attack reflected
- **Mage Towers**: +20% mana, healing spells affect adjacent kingdoms
- **Guards**: +25% power, can detect covert ops

### 6. **Dwarven Star-Metal** - Craftsmanship, Eternal Quality
- **Libraries**: Special - "Impenetrable Box", maps cannot be stolen
- **Smithies**: +35% quality, all equipment becomes legendary
- **Vaults**: +60% capacity, gold gains +5% interest per turn
- **Walls**: +40% defense, walls repair themselves
- **War Machines**: +45% durability, never need maintenance

### 7. **Cursed Bloodstone** - Sacrifice, Dark Magic
- **Barracks**: +30% strength, -25% cost, troops lose 1% HP per turn
- **Training**: +35% power, scarred graduates relentless
- **Mage Towers**: +40% power, cast for free but -population per spell
- **Mausoleums**: +50% power, dead rise as powerful undead
- **Walls**: +20% defense, attacks reflected back

### 8. **Tears of the World Tree** - Life, Healing, Renewal
- **Farms**: +35% yield, crops never fail
- **Shrines**: +50% healing, wounded troops recover with +10% HP bonus
- **Housing**: +30% capacity, population reproduces faster
- **Walls**: +15% regeneration, heal 2% max HP per turn
- **Lumber Camp**: +30% production, trees regrow immediately

### 9. **Void Essence** - Ultimate Power, Chaos, Reality Warping
- **Farms**: +100% production, crops either triple or fail
- **Granaries**: +200% capacity, food randomly appears/disappears
- **Vaults**: +300% capacity, 10% gold randomly vanishes
- **Mage Towers**: +100% power, unlimited spell casting, sanity cost
- **Walls**: +50% defense, attacks sometimes pass through

### 10. **Titan Bone** - Ancient Strength, Permanence, Massive Scale
- **Castles**: +50% size/majesty, house entire armies
- **Walls**: +60% health, impossible heights, first assault always fails
- **Barracks**: +30% training, soldiers grow to giant size
- **War Machines**: +40% damage, destroy walls in seconds
- **Guard Towers**: +50% reach, vision range tripled

## UI Components

### HybridBlueprintPanel
- Located in Library section
- Shows when kingdom has unassigned blueprints
- Click blueprint → Opens HybridBlueprintModal

### HybridBlueprintModal
- **Stage 1 (Selection)**: Grid of buildings with bonus previews
- **Stage 2 (Confirmation)**: Double warning + checkboxes
- Beautiful neon cyan styling matching game aesthetic
- Responsive design for mobile

## Implementation Checklist

- [x] World fragment bonuses configuration (250+ effects)
- [x] Database schema (fragment_bonuses column)
- [x] Fragment bonus manager utility (`game/fragment-bonus-manager.js`)
- [x] Backend API endpoints (get-buildings, confirm-assignment, assign-hybrid-blueprint)
- [x] Vanilla JS frontend (Library panel + assign flow in `client/index.html`)
- [x] Styling (neon theme, responsive design)
- [x] Integrate into building calculations — housing, barracks, schools, libraries, mage towers wired in `game/engine.js`
- [ ] React frontend components (`HybridBlueprintPanel.jsx`, `HybridBlueprintModal.jsx`) — pending vanilla → React migration
- [ ] Add special mechanics (immovable maps, void randomness, reflection) — partial; varies by fragment
- [ ] Integrate fragment bonuses into combat calculations (walls, defense, war machines)
- [ ] Display applied fragment bonuses in building info panels
- [ ] Add fragment bonus summary to kingdom status display
- [ ] Test coverage: all 10 fragments × ~25 buildings
- [ ] Admin commands for testing fragment application

## Example Flow

```
1. Player finds "Dwarven Star-Metal" fragment
2. Studies it in library (50 scribes, 200 turns)
3. Transcribes to hybrid blueprint (100 scribes, 300 turns)
4. Opens library panel, sees unassigned blueprint
5. Clicks "Apply" → Selection modal opens
6. Modal shows all buildings that can use this fragment
7. Player clicks "Libraries" → Sees bonus preview:
   "Impenetrable Box - Maps cannot be stolen, lost, or forgotten"
8. Panel switches to confirmation stage
9. Player reads warning: "This choice is PERMANENT"
10. Player checks both boxes confirming understanding
11. Player clicks "APPLY FRAGMENT"
12. Cost deducted (500k gold, 100k mana)
13. News entry: "✨ Applied Dwarven Star-Metal to Libraries! Bonuses unlocked: Impenetrable Box"
14. Now library has special effect: maps cannot be stolen
15. In future, if attacker tries to steal maps from this kingdom, the check fails with "Maps secured in Impenetrable Lockbox"
```

## Testing Recommendations

1. **Test each fragment** on at least 2-3 buildings
2. **Verify double confirmation** works correctly
3. **Check gold/mana deduction** is correct
4. **Test special mechanics**:
   - Dwarven Star-Metal: Map theft blocked
   - Void Essence: Random events
   - Celestial Feather: Unlimited healing
5. **Verify permanence**: Try to reassign or undo (should fail)
6. **Test edge cases**:
   - Building already has fragment (should fail)
   - Not enough gold/mana (should fail)
   - Blueprint already assigned (should fail)

## Future Enhancements

- Ability to view applied fragments in building detail panels
- Fragment transfer system (extremely expensive, one-time only)
- Fragment fusion (combine weak fragments into stronger ones)
- Seasonal fragment effects (different bonuses each season)
- Fragment trading between kingdoms (market system)
- Fragment collection rewards (collect all 10 = bonus effect)

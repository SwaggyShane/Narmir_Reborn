# Game Architecture Roadmap

## Executive Summary

The project is at an inflection point. We're moving from "a game with lots of code" to "a game engine." This requires a deliberate architectural shift to prevent coupling explosion and enable scalable content creation.

**Key principle:** Systems should communicate through explicit data flows, not through mutual references. Content should be data-driven, not behavior-driven. Managers should fade away as systems become independent.

---

## Current State vs. Target State

### Current Architecture (Tangled)
```
Renderer
    ↓ references
Game State
    ↓ references
World
    ↓ references
Entities
    ↓ references
UI + Combat + Inventory + Quests + ...
```

**Problems:**
- Everything knows about everything
- Adding a feature touches 5+ systems
- Testing individual systems is hard
- Changing one system risks breaking others
- Managers proliferate: CombatManager, QuestManager, InventoryManager, etc.

### Target Architecture (Clean)
```
Input (Keyboard, UI, Network)
    ↓
Commands (structured intent)
    ↓
Simulation (pure game logic)
    ↓
Events (broadcast results)
    ↓
Renderer (consume state, display)
```

**Benefits:**
- Clear data flow
- Systems are testable in isolation
- New mechanics mostly = new data, not new code
- Easier to add multiplayer, replay, AI, etc.

---

## Phase 1: Foundation & Visibility (Weeks 1-2)

### 1.1 Document Current Architecture
Create `ARCHITECTURE.md` that describes:
- Entity lifecycle (how entities are created, updated, destroyed)
- Turn processing pipeline (input → simulation → render)
- Combat flow (turn structure, targeting, damage)
- World simulation (time, weather, NPC movement)
- Data flow between systems
- Current manager responsibilities

**Why first:** You can't improve what you don't understand. This also becomes the reference design document for the next 6 months.

**Success criteria:** Team can read the doc and explain how a combat turn flows through the system.

### 1.2 Identify Coupling Points
Audit the codebase for:
- Classes/modules that import from 5+ other modules
- Circular dependencies
- Systems that call methods on each other (instead of using events)
- State owned by multiple managers

**Output:** A coupling map (could be a simple list or diagram) showing which systems depend on which.

**Why:** You need to see the problem before you solve it. This also identifies which systems are "safest" to refactor first (ones with fewer dependents).

### 1.3 Set Up Validation Tooling
Build one quick validation script that runs pre-commit or in CI:

```javascript
// validateContent.js
const fs = require('fs');
const path = require('path');

// Check 1: No duplicate IDs across all data files
// Check 2: All item references point to valid items
// Check 3: All location references point to valid locations
// Check 4: All NPC references are valid
// Check 5: No orphaned asset references

if (errors.length > 0) {
  console.error('Content validation failed:');
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
}
```

**Why now:** This catches errors early and gets people into the habit of "data quality matters." Even a basic version saves hours of debugging.

---

## Phase 2: Decoupling (Weeks 3-6)

### 2.1 Establish Command Pattern
Introduce a thin command layer between input and simulation:

```typescript
// Input never calls simulation directly
// Instead: create Command objects

type Command = 
  | { type: 'MOVE'; entityId: string; position: Vector }
  | { type: 'ATTACK'; attackerId: string; targetId: string }
  | { type: 'USE_ITEM'; entityId: string; itemId: string }
  | ...

// Simulation processes commands
function processCommand(world: World, cmd: Command): Event[] {
  switch (cmd.type) {
    case 'MOVE': return handleMove(world, cmd);
    case 'ATTACK': return handleAttack(world, cmd);
    ...
  }
}
```

**Benefits:**
- Input doesn't know about simulation details
- Commands can be logged, replayed, networked
- Easy to add undo/redo or command queues

**Starting point:** Pick one system (movement) and refactor it to use commands. Leave everything else as-is for now.

### 2.2 Introduce Event System
Replace method calls with event broadcasts:

**Before:**
```typescript
combatManager.onEntityDamaged(entity, 30);
uiManager.updateHealth(entity, 30);
questManager.checkObjectives(entity, 30);
```

**After:**
```typescript
events.emit('entity:damaged', { entity, amount: 30 });
// Handlers subscribe independently:
uiManager.on('entity:damaged', (e) => updateHealth(e.entity, e.amount));
questManager.on('entity:damaged', (e) => checkObjectives(e.entity, e.amount));
```

**Benefits:**
- Systems don't need to know about each other
- Adding a new system (like achievements) doesn't require modifying existing code
- Easy to log or replay all events

**Starting point:** Pick the system that currently has the most cross-system calls and refactor it to emit events instead.

### 2.3 Reduce Manager Responsibilities
Take the largest manager (probably CombatManager or WorldManager) and extract specific concerns:

**Example:** If CombatManager does damage, healing, buffs, and effects:
```
CombatManager (orchestrates turns)
  ↓ calls
DamageCalculator (pure function)
EffectApplier (pure function)
TurnQueue (data structure)
```

Managers should *orchestrate* (decide what happens), not *execute* (do all the work).

**Success criteria:** The largest manager shrinks by 30-40% in size.

---

## Phase 3: Data-Driven Design (Weeks 7-10)

### 3.1 Pick a System: Start with Items
Move item definitions out of code into data files:

**Before:**
```typescript
class Sword extends Weapon {
  name = 'Iron Sword';
  damage = 10;
  rarity = 'common';
  onUse(target) {
    target.takeDamage(this.damage);
  }
}
```

**After:**
```json
{
  "id": "item_iron_sword",
  "type": "weapon",
  "name": "Iron Sword",
  "damage": 10,
  "rarity": "common",
  "behavior": "weapon:basic_damage"
}
```

```typescript
// Behavior lookup
const behaviors = {
  'weapon:basic_damage': (item, target) => target.takeDamage(item.damage),
  'weapon:fire_damage': (item, target) => {
    target.takeDamage(item.damage);
    target.addEffect('burning', 3);
  },
  ...
};

function useItem(item, target) {
  const behavior = behaviors[item.behavior];
  if (behavior) behavior(item, target);
}
```

**Benefits:**
- Adding new items = writing JSON, not code
- Balance changes don't require recompiles
- Easy to audit all items at once (validation scripts!)
- Non-programmers can add content

**Steps:**
1. Create `data/items.json` with all current items
2. Create `ItemLoader` that parses the JSON
3. Create behavior lookup table
4. Update code to use ItemLoader instead of hardcoded classes
5. Add validation: ensure all behavior references are valid

**Success criteria:** You can add a new item by editing JSON and it works immediately.

### 3.2 Repeat for Monsters
Same pattern as items:
```json
{
  "id": "monster_goblin",
  "type": "monster",
  "name": "Goblin",
  "health": 15,
  "damage": 5,
  "ai": "monster:basic_aggro",
  "loot": ["item_gold_coin"]
}
```

### 3.3 Repeat for Locations/World
Same pattern for map data:
```json
{
  "id": "location_forest",
  "name": "Dark Forest",
  "terrain": "forest",
  "biome": "temperate",
  "connections": {
    "north": "location_mountains",
    "east": "location_village"
  },
  "spawns": [
    { "monsterId": "monster_goblin", "weight": 0.6 },
    { "monsterId": "monster_wolf", "weight": 0.4 }
  ]
}
```

---

## Phase 4: Automation & Docs (Weeks 11-12)

### 4.1 Expand Validation Scripts

```javascript
// validateContent.js (enhanced)

// Check that all monster loot references valid items
// Check that all location connections point to valid locations
// Check for orphaned data (items with no source, locations with no path to them)
// Check for ID collisions
// Check that all referenced NPC IDs exist
// Check that all quest chains are valid (steps reference valid objectives)
// Warn if any system is unused

// Output a report:
console.log(`Validation complete:
  ✓ 247 items verified
  ✓ 43 monsters verified
  ✓ 18 locations verified
  ✗ 3 broken references found
  ⚠ 2 unused items detected`);
```

### 4.2 Write Permanent Architecture Docs

Create these files:

**ARCHITECTURE.md** (already started in Phase 1)
- System overview
- Data flow diagrams
- Design principles

**ENTITY_LIFECYCLE.md**
- How entities spawn
- State transitions
- Despawn process

**TURN_PROCESSING.md**
- Input → Command conversion
- Simulation steps
- Event generation
- Rendering

**COMBAT_PIPELINE.md**
- Turn order
- Action resolution
- Damage/healing calculation
- Effect application

**CONTENT_AUTHORING.md**
- How to add items
- How to add monsters
- How to add locations
- Data schema reference

**Why:** This becomes the onboarding document for new developers and the reference for design discussions.

### 4.3 Create Content Templates
```
data/
  items.json (template with examples)
  monsters.json (template)
  locations.json (template)
  quests.json (template)
  behaviors.ts (all registered behaviors, documented)
```

---

## Phase 5: Content Scaling (Weeks 13+)

Once the engine is solid, content creation should accelerate because:
- New items = JSON
- New monsters = JSON + existing AI
- New locations = JSON + terrain
- New quest types = JSON + existing quest engine

This is where you see the payoff: your development velocity increases because you're mostly writing data, not debugging code.

---

## Current System Analysis

### Systems to Decouple (Priority Order)

1. **Combat System** (HIGH)
   - Currently tightly coupled to entities
   - Touches damage, effects, UI, quests
   - Refactoring here unblocks a lot
   - **Plan:** Extract turn queue, damage calculation, effect application

2. **Terrain/World System** (HIGH)
   - Multiple unfinished versions (see memory: PR #753, Phase 3)
   - This creates coupling uncertainty
   - **Plan:** Finish data spec first, then implement as clean config-based system

3. **Inventory System** (MEDIUM)
   - Likely intertwined with items, UI, quests
   - Benefit from item-as-data refactor
   - **Plan:** Move after items are data-driven

4. **Quest System** (MEDIUM)
   - Probably hooks into everything
   - Hard to refactor before combat/inventory work
   - **Plan:** Phase 3-4

5. **UI System** (MEDIUM)
   - Should be read-only consumer of events
   - Likely currently calls back into game state
   - **Plan:** Refactor after event system is in place

### Managers to Consolidate

- WorldManager → WorldData (no manager needed for static config)
- CombatManager → Split into TurnOrchestrator + DamageCalculator + EffectApplier
- InventoryManager → ItemContainer (simple data structure)
- QuestManager → QuestTracker (event listener, no orchestration)

---

## Success Metrics

### Phase 1
- [x] Architecture document exists and matches reality
- [x] Coupling map identifies problem areas
- [x] Validation script catches 3+ types of errors

### Phase 2
- [x] Commands are used for 50% of input paths
- [x] Events are used for 50% of cross-system communication
- [x] Largest manager reduced by 30%

### Phase 3
- [x] Items are data-driven (>80% of items in JSON)
- [x] Can add new item without touching code
- [x] Monster definitions in JSON
- [x] Location definitions in JSON

### Phase 4
- [x] Validation script runs in CI and catches real bugs
- [x] Permanent architecture docs exist and are accurate
- [x] Onboarding takes <2 hours vs. current "read the whole codebase"

### Phase 5
- [x] New content additions are data-only 80%+ of the time
- [x] No new "Manager" classes created; orchestration via events
- [x] Coupling map shows <5 critical dependencies (vs. current high count)

---

## Decision Points & Risks

### Should we refactor everything at once?
**No.** The phased approach lets you validate each step before committing to the next. If Phase 2 (commands) feels clunky, fix it before moving to Phase 3.

### What if halfway through we realize the architecture is still wrong?
**That's fine.** The goal is to build visibility (docs) and reduce coupling. If you discover a better approach mid-way, you'll have the flexibility to pivot because systems are decoupled.

### What about existing content/features?
**Don't migrate them all at once.** Pick one system (items) as the pilot. Once that works and the team believes in the approach, migrate others. Some old systems can coexist with new ones temporarily.

### Performance concerns?
**Address after architecture stabilizes.** Decoupling often makes optimization easier (you can profile individual systems in isolation). Don't optimize for coupling you're about to remove.

---

## Timeline Estimate

- **Phase 1:** 2 weeks (mostly documentation and analysis)
- **Phase 2:** 4 weeks (commands + events, refactor largest manager)
- **Phase 3:** 4 weeks (items → monsters → locations as data)
- **Phase 4:** 2 weeks (expand validation, write permanent docs)
- **Phase 5:** Ongoing (content scales naturally)

**Total:** ~12 weeks to a fundamentally more scalable architecture.

---

## Next Immediate Step

**Week 1 action:** 
1. Write `ARCHITECTURE.md` describing how things work now
2. Create a simple coupling map (spreadsheet or diagram)
3. Build the first validation script (ID collision checker)
4. Pick one system (suggest: Items) as the Phase 3 pilot

This gives you full visibility before any refactoring, which makes all future decisions better.

---

## Notes

- This roadmap assumes the codebase is in TypeScript/JavaScript. Adjust language-specific examples as needed.
- The phased approach is deliberate. Each phase should feel solid before starting the next.
- Documentation is listed late but should be *kept up to date* as you work, not written at the end.
- If you hit unexpected complexity in any phase, that's a signal to revisit the architecture doc—it means the system is more coupled than you thought.

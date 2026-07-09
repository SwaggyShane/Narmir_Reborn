# Coupling Analysis: Current System Dependencies

**Purpose:** Identify tightly coupled systems that need decoupling in Phase 2.

**Date:** 2026-07-08  
**Status:** Current state baseline

---

## Coupling Relationships

### Tier 1: Routes → Engine (Highest Priority)

Routes depend directly on engine functions, creating tight coupling.

**Routes that call engine directly:**

| Route | Functions Called | Problem |
|-------|-----------------|---------|
| kingdom-gameplay.js | processTurn, awardHeroXp, applyHeroTurnBonuses, resolveExpeditions, calculateScore | Route logic mixed with game logic |
| kingdom-build.js | (references engine) | Potential direct calls to builders |
| kingdom-economy.js | (references engine) | Potential direct calls to economy |
| kingdom-exploration.js | (references engine) | Potential direct calls to expeditions |

**Coupling issue:** Routes call game functions directly without abstraction.
- If engine function changes signature, all routes break
- Route validation doesn't match engine validation
- Impossible to mock engine for route testing

**Decoupling strategy (Phase 2):**
```javascript
// Before: Route → Engine
engine.processTurn(kingdom, db)

// After: Route → CommandHandler → Engine
commandHandler.handle(
  { type: 'turn', kingdomId },
  { kingdom, db }
)
```

---

### Tier 2: Engine → Game Modules (Very High)

processTurn() calls 80+ game modules directly. Each is a tight coupling point.

**Major engine dependencies:**

```javascript
// From game/engine.js imports (first 100 lines)

const { processScoutProgress } = require("./scout-progress")
const { revealRingHexes } = require("./visibility")
const { raceBonus } = require('./lib/race-bonus')
const { getUnitName, awardTroopXp, unitLevelMult } = require('./lib/troops')
const { getSynergyPassiveBonusMultiplier } = require('./lib/synergy-cache')
const { addItemToInventory } = require('./lib/items')
const { applyWarmachineDamage } = require('./lib/defense')
const { checkAchievements, calculateScore } = require('./lib/achievements')
const { happinessMult, formatCombatV2NewsBlurb } = require('./lib/combat-helpers')
const { processLocationMapsWip, computeExpeditionTransitions } = require('./lib/expeditions')
const { rebellionCheck, raidTradeRoute, resolveAllianceDefense } = require('./lib/special-events')
const { resolveMilitaryAttack } = require('./lib/combat-wrappers')
const { studyDiscipline, queueBuildings, processBuildQueue } = require('./lib/building-research')
const { processMercenaries, expeditionRewards, processActiveEffects } = require('./lib/gameplay')

// ... plus 40+ more imports
```

**Coupling issue:** processTurn knows about all these systems.
- Adding new system requires modifying processTurn
- Reusing a system in different context requires careful coordination
- Can't test systems in isolation without running full processTurn

**Decoupling strategy (Phase 2):**
```javascript
// Before: processTurn directly calls subsystems
processScoutProgress(kingdom, db)
revealRingHexes(db, kingdom.id, updates)
processActiveEffects(kingdom, updates)

// After: Systems registered in composition root
const systems = [
  new ScoutSystem(),
  new VisibilitySystem(),
  new EffectSystem(),
  // ...
]
for (const system of systems) {
  system.process(state, updates, events)
}
```

---

### Tier 3: Engine → Database (High)

processTurn receives db parameter and calls it directly.

```javascript
// From game/engine.js
if (db && k.id) {
  recordHappinessHistory(db, k.id, updates.turn, happinessResult).catch(...)
  revealRingHexes(db, k.id, updates, scoutResult.completed_ring_number).catch(...)
}
```

**Coupling issue:**
- processTurn is not pure (makes side effects)
- Hard to test without real DB
- DB calls are async but buried inside processTurn
- Failures are caught silently

**Decoupling strategy (Phase 2):**
```javascript
// Before: processTurn calls DB directly
db.recordHappiness(...)

// After: Collect writes, apply at end in transaction
const writes = []
for (const system of systems) {
  const systemWrites = system.process(state)
  writes.push(...systemWrites)
}
await db.applyWrites(writes)
```

---

### Tier 4: Systems → Systems (High)

Different game subsystems call each other directly.

**Examples:**

```javascript
// Combat system calls effect applier
const damage = calculateDamage(attacker, defender, weapon)
applyEffect(defender, 'bleeding', 3)

// Construction calls economy
const cost = calculateBuildCost(building, level)
spendGold(kingdom, cost)

// Expedition calls combat
const casualty = combatResolution(attacker, defender)

// Scout system calls visibility
revealRingHexes(kingdom, ring)
```

**Coupling issue:**
- Systems can't be reused independently
- Order of operations matters (scout before visibility, etc.)
- Hard to add new systems without changing existing ones

**Decoupling strategy (Phase 2):**
```javascript
// Before: System A calls System B directly
classA.method().then(() => classB.method())

// After: Event-based coordination
classA.process() → emits('ring-completed')
eventBus.on('ring-completed') → classB.process()
```

---

## Specific Coupling Points

### Food System → Attunement System
```javascript
// processTurn line 455-604
const foodUpdates = processFoodEconomy(kingdom, events)
const granaryUpdates = processGranaryAttunements(kingdom, events)
const vaultUpdates = processVaultAttunements(kingdom, events)
// ... 13 attunement systems
```

**Problem:** Each attunement has unique logic hardcoded.
**Needs:** Data-driven attunement system with behavior loaded from config.

### Scout System → Visibility System
```javascript
// processTurn line 606-624
const scoutResult = processScoutProgress(kingdom, db)
if (scoutResult.ring_completed && db) {
  revealRingHexes(db, kingdom.id, updates, ring).catch(...)
}
```

**Problem:** Scout progress triggers visibility changes, but async call buried in processTurn.
**Needs:** Scout completion emits event → visibility system listens.

### Combat System → XP System
```javascript
// Damage calculation tied to attacker/defender XP
const damage = damageWithXpBonus(attacker)
applyDamage(defender, damage)
awardCombatXp(attacker, damage)
```

**Problem:** Damage and XP are intertwined.
**Needs:** Combat emits 'damage-dealt' event → XP system listens.

### Research System → Level System
```javascript
// Auto-research affects kingdom level
updates.xp += researchBonus
if (currentLevel > prevLevel) {
  checkMilestones(kingdom, prevLevel, currentLevel)
}
```

**Problem:** Research and leveling are separate but interdependent.
**Needs:** Research emits 'xp-granted' event → level system listens.

### Building System → Economy
```javascript
// Construction completion affects production buildings
if (buildJob.building === 'farm') {
  foodProduction += getFarmYield(kingdom)
}
```

**Problem:** Building completion immediately affects next turn's production.
**Needs:** Building completion event → economy system recalculates.

---

## Import Dependency Tree

Simplified view of import structure:

```
routes/*.js
  ↓
game/engine.js (1 import point)
  ↓
game/lib/*.js (80+ modules)
  ├── game/lib/troops.js
  ├── game/lib/combat-helpers.js
  ├── game/lib/expeditions.js
  ├── game/lib/effects.js
  ├── game/lib/buildings.js
  ├── game/lib/synergy-cache.js
  └── ... (70+ more)
  ↓
game/config.js (shared constants)
  ↓
game/data/
  ├── balance sheets
  └── formulas

Plus circular imports:
  engine.js ← → lib/gameplay.js
  engine.js ← → lib/expeditions.js
  lib/troops.js ← → lib/synergy-cache.js
```

**Issue:** Deep tree makes it hard to:
- Change any file without checking 20+ dependents
- Reuse modules in different contexts
- Test in isolation

---

## Modules with Multiple Responsibilities

These modules do multiple unrelated things and should be split:

| Module | Responsibilities | Should Split Into |
|--------|-----------------|-------------------|
| engine.js | Turn orchestration + happiness + resources + research + training | TurnOrchestrator, HappinessCalculator, ResourceCalculator, ResearchProcessor, TrainingProcessor |
| lib/gameplay.js | Mercenaries + expeditions + rewards + effects | MercenarySystem, ExpeditionSystem, RewardSystem, EffectSystem |
| lib/building-research.js | Construction + research + tool forging | BuildingSystem, ResearchSystem, ToolForgingSystem |
| lib/combat-wrappers.js | Combat resolution + XP awarding + news formatting | CombatResolver, XPAwarder, NewsFormatter |

---

## Circular Dependencies

These should be eliminated in Phase 2:

```javascript
// Currently possible:
engine.js requires lib/gameplay.js
lib/gameplay.js requires engine.js (for shared functions)

// This creates circular dependency
```

---

## Global State Issues

Coupling through global state:

```javascript
// config.js — reads once at boot
const config = require('./config')
config.EXPEDITION_TURNS = 5  // Constants, OK

// cache.js — mutable global
const cache = require('../cache')
cache.get(key)
cache.set(key, value)  // ⚠️ Mutable

// profiling.js — global profiler state
const { getProfiler } = require('./profiling')
const profiler = getProfiler()  // ⚠️ Singleton
profiler.start()
profiler.end()
```

**Problem:** Global mutable state makes testing and parallelization hard.

---

## Decoupling Roadmap (Phase 2)

### Step 1: Introduce Mediator
```javascript
// game/turn-mediator.js
class TurnMediator {
  async processTurn(kingdom, db) {
    const context = new TurnContext(kingdom, db)
    
    for (const system of this.systems) {
      await system.execute(context)
    }
    
    return context.getUpdates()
  }
}
```

### Step 2: Event Bus
```javascript
// game/event-bus.js
class EventBus {
  on(event, handler) { ... }
  emit(event, data) { ... }
}

// Systems listen to events
scoutSystem.on('ring-completed', (ring) => {
  visibilitySystem.reveal(ring)
})
```

### Step 3: System Composition
```javascript
// game/turn-systems.js
const systems = [
  new GoldIncomeSystem(),
  new ManaRegenSystem(),
  new PopulationGrowthSystem(),
  new FoodEconomySystem(),
  new ScoutProgressSystem(),
  // ... etc
]
```

### Step 4: Remove Circular Imports
Replace with:
- Dependency injection
- Factory functions
- Registry pattern

---

## Summary

| Tier | Coupling | Impact | Priority |
|------|----------|--------|----------|
| Routes → Engine | Very High | Routes can't evolve | High |
| Engine → Modules | Very High | Can't reuse modules | High |
| Systems → Systems | High | Can't test in isolation | High |
| Modules → DB | High | Not pure, hard to test | Medium |
| Global State | Medium | Hard to parallelize | Medium |
| Circular Imports | Low-Medium | Fragile builds | Low |

**Phase 2 should focus on Tier 1 and 2 first.**

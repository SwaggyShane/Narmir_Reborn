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

**Owner:** Lead Architect  
**Timeline:** 2 weeks  
**Goal:** Full visibility into current architecture and coupling points

### 1.1 Document Current Architecture
Create `ARCHITECTURE.md` that describes:
- Entity lifecycle (how entities are created, updated, destroyed)
- Turn processing pipeline (input → simulation → render)
- Combat flow (turn structure, targeting, damage)
- World simulation (time, weather, NPC movement)
- Data flow between systems
- Current manager responsibilities

**Success criteria:** Team can read the doc and explain how a combat turn flows through the system.

**Acceptance criteria:**
- [ ] Document is 2000-3000 words, includes diagrams
- [ ] All team members read and sign off
- [ ] No unexplained manager responsibilities

### 1.2 Identify Coupling Points
Quick audit of codebase for:
- Modules that import from 5+ other modules
- Circular dependencies (use static analysis)
- Cross-system method calls

**Output:** A coupling map (simple spreadsheet) showing:
- System A depends on System B (reason: X)
- Number of cross-system calls per system pair

**Acceptance criteria:**
- [ ] Coupling map lists 10+ dependencies
- [ ] Identifies the 3-5 most coupled pairs
- [ ] Suggests which to decouple first

**Why:** Take 3-4 days max. You don't need a perfect map, just enough to identify problem areas and the safest system to refactor first.

---

## Phase 2: Decoupling (Weeks 3-5)

**Owner:** Combat/Engine Lead  
**Timeline:** 3 weeks (not 4)  
**Goal:** Pick ONE system (movement), decouple it completely. Validate the pattern works.

### 2.1 Refactor Movement to Use Commands + Events
Pick movement because:
- Smallest scope (fewer dependents)
- Validates command + event pattern
- Isolatable test surface

**Do:**
1. Create `command/moveCommand.ts` 
2. Movement input → MoveCommand creation (old code stays)
3. Simulation processes MoveCommand → MoveExecuted event
4. Update UI via event listener, not method calls
5. Write test: MoveCommand → MoveExecuted event

**Don't:**
- Refactor combat yet (too big)
- Refactor inventory (depends on items)
- Add undo/redo (future optimization)

```typescript
// All this is new; old movement code stays untouched for now
type MoveCommand = { type: 'MOVE'; entityId: string; targetPos: Vector };
function processMove(world: World, cmd: MoveCommand): Event[] {
  const entity = world.getEntity(cmd.entityId);
  if (!entity || !isValidMove(entity, cmd.targetPos)) return [];
  
  entity.position = cmd.targetPos;
  return [{ type: 'entity:moved', entityId: entity.id, position: cmd.targetPos }];
}
```

**Acceptance criteria:**
- [ ] Movement works without calling into UI directly
- [ ] Events are emitted for all move outcomes (success, blocked, out-of-range)
- [ ] 3+ test cases pass (valid move, blocked move, out of range)
- [ ] No breaking changes to existing movement (old code still works)

### 2.2 Introduce Event Broadcasting for Movement Results
Only movement systems emit/listen to events for now. Don't touch combat or inventory yet.

**Acceptance criteria:**
- [ ] UI updates via `events.on('entity:moved', ...)`
- [ ] Quest system can listen to `entity:moved` without touching movement code
- [ ] Event system is documented (what events exist, what data they carry)

### 2.3 (Skip for now)
Don't reduce manager responsibilities yet. That comes after Phase 3 when patterns are proven.

---

## Migration & Coexistence Policy

During Phase 2 and 3, old and new systems will coexist. Here's how:

### Rule 1: Create Adapters, Not Rewrites
Old code stays. New code wraps it with adapters:

```typescript
// OLD: CombatManager.onEntityDamaged(entity, 30) called from everywhere
// NEW: Events are emitted instead
// COEXISTENCE: Old code continues to work; damage pipeline gradually switches to events

// Adapter layer:
function damageEntity(world: World, entity: Entity, amount: number): Event[] {
  // Old behavior (for backward compatibility)
  const oldManager = world.combatManager;
  if (oldManager) oldManager.onEntityDamaged(entity, amount); // Still works
  
  // New behavior (what we're moving to)
  events.emit('entity:damaged', { entity, amount });
  
  return [{type: 'entity:damaged', entity, amount}];
}
```

### Rule 2: Boundary Between Old & New is Clear
- **Old world:** CombatManager, InventoryManager, etc. call each other directly
- **New world:** Systems emit events, don't call each other
- **Boundary:** Adapters live in `/adapters/` directory
- **Never mix:** Don't half-refactor a system (don't emit events AND call methods from the same code path)

### Rule 3: New Content Uses New Patterns Immediately
- Items added in Phase 3 are JSON + behavior lookup, never hardcoded classes
- Monsters added in Phase 3 are data-driven
- This forces a "commit point" — once Phase 3 content is added, you can't easily go back to old patterns

### Rule 4: Data Files Are Never Old
Once you create `data/items.json` in Phase 3, there's no "old item system" vs "new item system" — there's just the new one. This prevents hybrid confusion.

---

## State Ownership Matrix

Clarify who owns what state to prevent fights during refactoring:

| State | Owner System | Source of Truth | Who Can Write | Observers |
|-------|--------------|-----------------|---------------|-----------|
| Entity Position | World/Movement | World state | Movement command handler | UI (reads), Combat (validates range), Visibility (updates sight lines) |
| Entity Health | Combat/Entities | Entity object in world | Damage/heal functions | UI (reflects bar), Quest system (checks objectives), Effects system |
| Inventory Items | Inventory | Player entity's items array | Inventory add/remove functions | UI (shows items), Crafting (checks requirements), Quests |
| Active Effects | Combat/Effects | Entity's effects array | Effect applicator | Combat (damage modifiers), UI (shows icons), Rendering |
| World State (time, weather) | World/Sim | World object | Turn processor | Rendering (affects visuals), Spawn system (affects spawns), UI (displays) |
| Turn Queue | Combat | Queue data structure | Turn processor | UI (shows order), Combat actions (process in order) |

**Rule:** Each state has exactly ONE owner. Other systems can read, but only the owner can write.

**During transition:**
- Mark old code that violates this rule with `// DEPRECATED: use X instead`
- Don't enforce during Phase 1-2; just document
- Enforce in Phase 3 (new data files must follow these rules)

---

## Testing Strategy Matrix

Define testing approach for each component type:

| Component Type | Test Strategy | Tools | Examples |
|---|---|---|---|
| **Commands** | Unit test: input → command → events | Jest/Vitest | MoveCommand, AttackCommand, UseItemCommand |
| **Events** | Integration test: command → event → listener side effects | Jest + event listener mocks | DamageEvent → UI updates, DamageEvent → Quest checks |
| **Data Files (JSON)** | Validation script catches schema errors and references | Custom validator | All items.json, monsters.json reference valid behaviors |
| **Behaviors (pure functions)** | Unit test: input → output | Jest | damage calculation, heal calculation, effect logic |
| **Simulation (world state changes)** | Integration test: command → simulation → world state | Harness + world inspection | Move command changes position, combat changes health |
| **UI (render state)** | End-to-end browser test | Playwright/Cypress | UI updates when damage event fires, health bar reflects state |
| **Adapters** | Smoke test: old system + new system produce same results | Jest | Old CombatManager.onDamage + new events.emit produce same world state |

**Phase 1-2 focus:** Unit tests for commands, integration tests for events, adapters  
**Phase 3+ focus:** Expand validation scripts to catch data errors  

**Budget:** If a system has 0% test coverage, start with 50% (happy path + one failure case).

---

## Phase 3: Data-Driven Design (Weeks 6-9)

**Owner:** Content Lead  
**Timeline:** 4 weeks  
**Goal:** Prove that content can be data-only; no code changes needed to add items/monsters

### 3.1 Migrate Items to JSON (Week 6)
Move item definitions out of code into `data/items.json`:

**Deliverables:**
1. `data/items.json` schema + examples (with 10+ existing items)
2. `game/loaders/ItemLoader.js` (parses JSON, returns usable items)
3. `game/behaviors/itemBehaviors.js` (lookup table: `weapon:basic_damage` → function)
4. Validation: `scripts/validate-items.js` (checks IDs, behavior references)
5. Test: 5+ test cases (item creation, behavior execution, edge cases)

**Acceptance criteria:**
- [ ] All existing items are in `data/items.json`
- [ ] ItemLoader produces functionally identical item objects to old system
- [ ] Can add a new item (edit JSON) without touching code
- [ ] Validation script catches bad behavior references
- [ ] All 5 tests pass

**Example item in JSON:**
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

### 3.2 Migrate Monsters to JSON (Week 7)
Same pattern as items:

**Deliverables:**
1. `data/monsters.json` schema + examples
2. `game/loaders/MonsterLoader.js`
3. `game/behaviors/aiPatterns.js` (lookup: `monster:basic_aggro` → function)
4. Validation: `scripts/validate-monsters.js`
5. Test: 5+ test cases

**Acceptance criteria:**
- [ ] All existing monsters are in `data/monsters.json`
- [ ] MonsterLoader produces functionally identical objects to old system
- [ ] AI behaviors execute correctly from JSON reference
- [ ] Validation catches invalid item references in loot

**Example monster in JSON:**
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

### 3.3 Migrate Locations/World to JSON (Week 8-9)
Same pattern for map/world data:

**Deliverables:**
1. `data/locations.json` with all map data
2. `game/loaders/LocationLoader.js`
3. Validation: check all location connections point to valid locations
4. Test: 5+ test cases (connections, spawns, terrain)

**Acceptance criteria:**
- [ ] All world locations in `data/locations.json`
- [ ] LocationLoader produces identical terrain/connection data
- [ ] Validation catches broken location references
- [ ] Can add a new location by editing JSON

**Example location in JSON:**
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

**Milestone (end of Phase 3):** 
All core world data (items, monsters, locations) is in JSON files. Adding new content requires 0 code changes.

---

## Phase 4: Automation & Docs (Weeks 10-11)

**Owner:** QA Lead + Documentation Owner  
**Timeline:** 2 weeks  
**Goal:** Automate quality checks; codify design decisions

### 4.1 Expand Validation Scripts (Week 10)

**Deliverables:**
1. `scripts/validate-content.js` (consolidated validator)
2. Hook into pre-commit (run validation before commit)
3. CI integration (fail build if validation fails)
4. Documentation of validation rules

**Validation checks:**
- [ ] No duplicate IDs across all JSON files
- [ ] All monster loot references point to valid items
- [ ] All location connections point to valid locations
- [ ] All behavior references exist in behavior lookup tables
- [ ] No orphaned data (unused items, unreachable locations)
- [ ] No circular location connections
- [ ] ID naming convention enforced (e.g., `item_*`, `monster_*`, `location_*`)

**Acceptance criteria:**
- [ ] Validation script catches 3+ real errors in sample data
- [ ] Output is human-readable (shows which file, which line, what's wrong)
- [ ] Pre-commit hook blocks commits with validation errors
- [ ] CI fails if validation fails (gated on merge)

**Example validation output:**
```
✓ 247 items verified
✓ 43 monsters verified
✓ 18 locations verified
✗ 3 broken references found:
  - monster.json line 45: loot references item_invalid_gold
  - location.json line 12: connection "north" points to location_does_not_exist
  - item.json line 89: behavior reference "weapon:fire_blaze" not found
```

### 4.2 Write Permanent Architecture Docs (Week 11)

**Deliverables:**

1. **ARCHITECTURE_EXECUTION.md** (from Phase 1 ARCHITECTURE.md)
   - Finalized entity lifecycle diagrams
   - Turn processing with timing info
   - Data ownership rules (from migration policy)
   - 2000 words

2. **ENTITY_LIFECYCLE.md**
   - How entities spawn (from input to world state)
   - State transitions (alive → dead → despawned)
   - Event timeline per transition
   - 500 words + diagrams

3. **TURN_PROCESSING.md**
   - Input → Command → Simulation → Events → Render
   - Timing budget per stage
   - Concurrency rules (single-threaded? turn-locked?)
   - 800 words + sequence diagram

4. **COMBAT_PIPELINE.md**
   - Turn order determination
   - Action resolution (sequence of steps)
   - Damage/heal calculation
   - Effect application order
   - 600 words + flowchart

5. **CONTENT_AUTHORING.md**
   - How to add items (step-by-step)
   - How to add monsters (step-by-step)
   - How to add locations (step-by-step)
   - How to add behaviors (where to register, how to test)
   - JSON schema reference
   - 1000 words + examples

**Acceptance criteria:**
- [ ] All 5 docs exist and are linked together
- [ ] New team member can onboard in <2 hours using these docs
- [ ] Docs match actual code (not aspirational)
- [ ] Diagrams are included (at least one per doc)

---

## Phase 5: Content Scaling (Weeks 12+)

**Owner:** Game Designer / Content Team  
**Timeline:** Ongoing  
**Goal:** Prove engine is stable; content velocity increases

**Milestones:**
1. **Week 12:** Add 10+ new items to items.json (content team only, 0 code changes)
2. **Week 13:** Add 5+ new monsters (content team only)
3. **Week 14:** Add 1+ new location (designer adds it, validates with validation script)

**Success criteria (end of Phase 5):**
- [ ] 80%+ of new content additions are JSON-only
- [ ] No new "Manager" classes created in Phase 5
- [ ] Content validation catches all proposed errors before merge
- [ ] Content team can work independently (no code review needed for JSON)

**When this works:**
- New items added in 5 minutes (vs. 30 min with code changes)
- New monsters balanced by editing JSON numbers
- New locations added without touching game code
- Non-programmers can contribute mechanics

This is where you see the payoff: development velocity increases because you're mostly writing data, not debugging code.

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

## Phase Recap & Success Criteria

| Phase | Owner | Weeks | Key Deliverable | Go/No-Go Criteria |
|-------|-------|-------|---|---|
| **Phase 1** | Lead Architect | 1-2 | ARCHITECTURE.md + coupling map | Team reads docs; no major surprises in coupling analysis |
| **Phase 2** | Combat/Engine Lead | 3-5 | Movement refactored to commands + events | Movement works; zero regressions in existing code |
| **Checkpoint** | — | — | **Pattern validation** | Does command + event pattern feel right? If not, iterate Phase 2 before continuing. |
| **Phase 3** | Content Lead | 6-9 | Items, monsters, locations in JSON | 0 code changes to add new item/monster/location |
| **Checkpoint** | — | — | **Content author test** | Non-programmer can add item by editing JSON alone |
| **Phase 4** | QA + Docs | 10-11 | Validation in CI + 5 arch docs | Pre-commit blocks bad data; new hire onboards in <2h |
| **Phase 5** | Content Team | 12+ | New content velocity | 80%+ of additions are JSON-only |

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

- **Phase 1:** 2 weeks (documentation, coupling analysis)
- **Phase 2:** 3 weeks (movement only; commands + events)
- **Checkpoint:** Team validates pattern works (1-2 days, no phase time)
- **Phase 3:** 4 weeks (items → monsters → locations as data)
- **Checkpoint:** Content author test (1-2 days)
- **Phase 4:** 2 weeks (validation scripting + docs)
- **Phase 5:** Ongoing (content team uses the engine)

**Total:** ~11 weeks to a fundamentally more scalable architecture.

**Key difference from first plan:**
- Phase 2 was 4 weeks (too big); now 3 weeks (movement only)
- Phase 3 unchanged; this is where the big payoff starts
- Checkpoints added to validate approach before investing further

---

## Execution Readiness Checklist

Before starting Phase 1, confirm:
- [ ] Lead Architect assigned (owns ARCHITECTURE.md)
- [ ] Combat/Engine Lead assigned (owns Phase 2)
- [ ] Content Lead assigned (owns Phase 3)
- [ ] QA Lead assigned (owns Phase 4)
- [ ] This roadmap is read by all stakeholders
- [ ] Checkpoints understood (pattern validation after Phase 2)
- [ ] Timeline is realistic for team size (adjust if needed)

## Week 1 Action Items (Phase 1, Week 1)

**Lead Architect:**
1. Create `docs/ARCHITECTURE.md` (stub with outline)
2. Schedule 3-4 interviews with team members: "Walk me through how a combat turn works"
3. Create coupling map spreadsheet (columns: Module A, Module B, # of calls)
4. Post-kickoff meeting: share initial findings, get feedback

**No code changes in Week 1.** Pure documentation and discovery.

---

## Critical Success Factors

1. **Checkpoints are go/no-go decisions.** Don't proceed to Phase 3 if Phase 2 pattern feels wrong. Fix it first.
2. **Reduce scope, not ambition.** Phase 2 is movement ONLY (not combat). This focuses validation and lets you catch issues early.
3. **Owners are real people with time.** If roles aren't filled, delay start. Don't proceed with "everyone owns it."
4. **Migration policy prevents chaos.** Systems coexist during transition. Old code doesn't disappear; it adapts via bridges.

---

## Notes

- This roadmap assumes Node.js/TypeScript codebase. Adjust language examples as needed.
- The phased approach is deliberate. Each phase should feel solid before starting the next.
- Documentation should be *kept up to date during work*, not written at the end.
- If you hit unexpected complexity, that signals the system is more coupled than your ARCHITECTURE.md reflected. Update the doc.

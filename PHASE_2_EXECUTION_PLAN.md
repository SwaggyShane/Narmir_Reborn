# Phase 2: Command → Simulation → Events - Execution Plan

**Status:** Planning  
**Target:** Complete architectural decoupling in sandbox environment  
**Constraint:** 1 focused commit per branch, surgical changes

---

## Phase 2 Slices (Logical Breakdown)

### Slice 1: CommandHandler Abstraction (Tier 1 - Routes → Engine)
**Branch:** `phase-2-command-handler`  
**Goal:** Decouple routes from direct engine calls  
**Files to change:**
- `game/command-handler.js` (new) — Command router and executor
- `routes/kingdom-gameplay.js` — Replace `engine.processTurn()` calls with `commandHandler.handle()`
- `routes/kingdom-build.js` — Same pattern for build commands
- `routes/kingdom-economy.js` — Same pattern for economy commands

**Testing:**
- Verify existing `/turn`, `/build`, `/train` routes still work
- Test that commands are routed correctly
- Confirm no regressions in route behavior

**Dependencies:** None (foundational)

---

### Slice 2: Event Bus Foundation (Tier 2 & 4 - System Coordination)
**Branch:** `phase-2-event-bus`  
**Goal:** Create event emission/listening infrastructure  
**Files to change:**
- `game/event-bus.js` (new) — Central event registry
- `game/engine.js` — Inject EventBus, prepare for event emissions

**Testing:**
- Test event emission and subscription
- Verify events fire in correct order
- No logic changes yet, just infrastructure

**Dependencies:** None (foundational)

---

### Slice 3: System Composition (Tier 2 - Engine → Modules)
**Branch:** `phase-2-system-composition`  
**Goal:** Replace hardcoded subsystem calls with registered systems  
**Files to change:**
- `game/turn-systems/index.js` (new) — System registry
- `game/turn-systems/gold-income.js` (new) — Extract goldPerTurn logic
- `game/turn-systems/mana-regen.js` (new) — Extract mana logic
- `game/turn-systems/population-growth.js` (new) — Extract population logic
- `game/engine.js` — Replace inline logic with `for (system of systems) system.process(state, updates, events)`

**Testing:**
- Verify turn output is identical to original
- Compare gold/mana/population changes before/after
- No behavioral changes, just reorganization

**Dependencies:** Slice 2 (EventBus should be available)

---

### Slice 4: Food Economy System Extraction (Tier 2)
**Branch:** `phase-2-food-economy`  
**Goal:** Extract food + 13 attunements into composable systems  
**Files to change:**
- `game/turn-systems/food-economy.js` (new) — Food production/consumption
- `game/turn-systems/attunements/index.js` (new) — Attunement registry
- `game/turn-systems/attunements/granary.js` (new) — Extract granary attunement
- `game/turn-systems/attunements/vault.js` (new) — Extract vault attunement
- (... one per attunement type)
- `game/engine.js` — Replace inline attunement processing with system calls

**Testing:**
- Compare food changes before/after
- Verify each attunement still triggers correctly
- Check that bonuses apply in correct order

**Dependencies:** Slice 3 (System Composition pattern)

---

### Slice 5: Scout & Visibility Event Decoupling (Tier 4 - Systems → Systems)
**Branch:** `phase-2-scout-visibility`  
**Goal:** Scout completion emits event instead of calling visibility directly  
**Files to change:**
- `game/turn-systems/scout-progress.js` (refactor) — Emit 'ring-completed' event
- `game/turn-systems/visibility-reveal.js` (new) — Listen to ring-completed, call revealRingHexes
- `game/engine.js` — Remove direct revealRingHexes call

**Testing:**
- Verify ring completion still reveals hexes
- Check that async DB call still happens
- Confirm no visibility regressions

**Dependencies:** Slice 2 (EventBus) + Slice 3 (System Composition)

---

### Slice 6: Combat → XP Event Decoupling (Tier 4)
**Branch:** `phase-2-combat-xp`  
**Goal:** Combat emits 'damage-dealt' event instead of hardcoding XP awards  
**Files to change:**
- `game/lib/combat-wrappers.js` (refactor) — Emit 'damage-dealt' with attacker/damage
- `game/turn-systems/xp-award.js` (new) — Listen to damage-dealt, award XP
- `game/engine.js` — Remove direct combat XP calls

**Testing:**
- Verify XP still awarded after combat
- Check combat damage is unchanged
- Confirm XP calculations are identical

**Dependencies:** Slice 2 (EventBus)

---

### Slice 7: Research → Level Event Decoupling (Tier 4)
**Branch:** `phase-2-research-level`  
**Goal:** Research completion emits event, level system listens  
**Files to change:**
- `game/turn-systems/auto-research.js` (refactor) — Emit 'research-xp-awarded'
- `game/turn-systems/level-up.js` (refactor) — Listen to research-xp, recalculate levels
- `game/engine.js` — Remove direct research-to-level coupling

**Testing:**
- Verify research still grants XP
- Check level-ups still trigger milestones
- Confirm no regression in advancement

**Dependencies:** Slice 2 (EventBus) + Slice 3 (System Composition)

---

### Slice 8: Transaction Wrapper & Outbox Pattern (Tier 3 - Engine → Database)
**Branch:** `phase-2-outbox-pattern`  
**Goal:** Wrap turn in explicit transaction, collect events in outbox  
**Files to change:**
- `game/turn-transaction.js` (new) — Explicit transaction wrapper
- `db/outbox.js` (new) — Outbox table management
- `routes/kingdom-gameplay.js` — Wrap processTurn in transaction, insert events to outbox
- `game/engine.js` — Return events in structured format

**Testing:**
- Verify turn completes atomically
- Check that events are persisted before broadcast
- Simulate server crash, verify events still broadcast

**Dependencies:** All previous slices (puts it all together)

---

### Slice 9: Pre-Parsing JSON Optimization (Tier 3)
**Branch:** `phase-2-json-caching`  
**Goal:** Cache parsed JSON fields to avoid repeat parsing  
**Files to change:**
- `game/turn-cache.js` (new) — JSON field cache
- `game/engine.js` — Use cached values instead of parse-on-each-use

**Testing:**
- Verify turn latency improved
- Check that all fields still have correct values
- Confirm no behavioral changes

**Dependencies:** All previous slices (optimization pass)

---

## Execution Order (Dependencies)

1. **Slice 1** — CommandHandler (foundation for routes)
2. **Slice 2** — Event Bus (foundation for all systems)
3. **Slice 3** — System Composition (foundation for extraction)
4. **Slice 4** — Food Economy (medium complexity system)
5. **Slice 5** — Scout & Visibility (event coordination example)
6. **Slice 6** — Combat & XP (event coordination example)
7. **Slice 7** — Research & Level (event coordination example)
8. **Slice 8** — Transaction & Outbox (persistence layer)
9. **Slice 9** — JSON Caching (optimization)

---

## Testing Strategy Per Slice

**Per-Slice Testing:**
- Run full test suite: `npm test`
- Run lint: `npm run lint`
- Start postgres, boot app, verify no crashes
- Manual smoke test: take turn, verify output

**Regression Testing:**
- Compare turn output (gold, food, population, etc.) before/after
- Run combat tests
- Verify all routes still accessible
- Check Socket.io broadcasts still work

**Load Testing (if time):**
- Time turn execution before/after optimization slices
- Verify latency improvements

---

## Success Criteria

- ✅ All slices complete with 1 commit each
- ✅ No regressions (turn output identical)
- ✅ All tests pass per slice
- ✅ Code is cleaner and decoupled
- ✅ Bottlenecks identified in Phase 1 addressed

---

## Notes

- Each slice should be independently testable
- No monolithic changes
- Prioritize correctness over speed
- Show all test output, not summaries
- Keep branches local until user approval

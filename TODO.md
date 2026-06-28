# Narmir Reborn: Development Todos

## Security & Auditing

### Weekly Deep Audit Feature
**Status:** Planned  
**Complexity:** Medium (5-9 hours)  
**Description:** Extend security auditor with scheduled weekly analysis

**Tasks:**
- [ ] Add schedule UI to admin panel
  - Day/time picker for weekly runs
  - Directory selection for deep scan
  - Email notification toggle
- [ ] Create database tables for audit schedules and history
- [ ] Implement cron job scheduler (node-cron)
- [ ] Add API endpoints for schedule management
- [ ] Expand auditor to scan full codebase recursively
- [ ] Generate comparison reports between audits
- [ ] Add trend visualization (findings over time)
- [ ] Implement notifications (email/Slack on new issues)
- [ ] Investigate what is corrupting JSON rows in the database and add a repeatable guard or repair path

**Priority:** Medium  
**Estimated Effort:** 5-9 hours

---

## Combat
**Status:** ✅ COMPLETE (alpha-ready)
**Files:** `game/combat-new.js`, `game/combat-resolver.js`, `game/lib/combat-wrappers.js`
**Description:** Advanced combat is a complete individual troop HP/DMG/injury system replacing the legacy percentage model. It is feature-flagged behind `USE_COMBAT_V2=1` and validated across 26.8 million simulated combats with balanced 48–52% outcomes.
**See:** PROTECTED_WORK.md, test-combat-harness/

**Completed Tasks:**
- [x] Individual troop HP tracking and injury states (healthy/lightly/moderately/heavily wounded)
- [x] Critical hit system with kill tracking
- [x] Equipment capture/loss/recovery mechanics
- [x] Thief sabotage targeting war machines
- [x] Cleric rescue logic
- [x] Ladder walls requiring engineer levels
- [x] Structure defense budgets (walls/castles/towers/outposts)
- [x] War machine crew requirements (race-dependent, dwarf solo at level 25)
- [x] Wall HP persistence and wall damage tracking
- [x] Compatibility aliases in combat report (atkFightersLost, defPower, landTransferred, etc.)
- [x] Database schema support (injured_troops, wall_hp, equipment_levels columns)
- [x] Route-level persistence for all combat updates
- [x] Feature flag wiring (USE_COMBAT_V2 environment variable)
- [x] Diagnostic reporting (HP by type, DMG by type, crew details)
- [x] Test harnesses (smoke, scenario, route-persistence, dwarf-sweep, broad-sweep, overnight-balance-log)
- [x] 26.8 million simulated combats across 56 sweeps (race matrix, archetype balance, fragment synergies)
- [x] Fix legacy combat system label for test compatibility

**Test Results (All Green):**
- ✅ smoke:combat-v2 (current combat plus advanced adapter)
- ✅ scenario:combat-v2 (14 scenarios)
- ✅ route-smoke:combat-v2 (DB persistence)
- ✅ sweep:combat-v2-dwarf (crew balance testing)
- ✅ sweep:combat-v2-broad (50+ race/archetype combos)
- ✅ overnight:combat-v2 (26.8M combats, balanced outcomes)

---

## World Fragment Combat Balance
**Status:** Planned  
**Priority:** High  
**Description:** Add balance rails for world fragment and synergy bonuses so combat offense/defense modifiers stay exciting without runaway stacking.

**Tasks:**
- [x] Classify fragment bonuses into buckets: economy, production, research, combat_offense, combat_defense, utility, special
- [x] Add explicit caps or budgets for fragment-driven combat offense and combat defense
- [x] Audit multiplier stacking across walls, guard towers, castles, outposts, armories, war machines, and global synergies
- [x] Add combat simulations for high-risk synergies like Blessed Citadel, Void Convergence, Primordial Awakening, and war-machine builds
- [x] Normalize stat naming where practical (`manaRegen` vs `mana_regen`, `speed` vs `research_speed`, `power` vs `damage`)
- [x] Verify dwarf/war-machine balance with fragments applied, especially wall-mounted and solo-crewed war machines
- [x] Review live magic/combat risks: tier 5 spell mana fallback, socket spell validation parity, and transactional spell/attack updates

---

## Battle Outcome Animation
**Status:** Planned
**Priority:** Low
**Description:** Use GSAP to animate combat outcome presentation after battle resolution without changing combat logic.

**Tasks:**
- [ ] Animate win/loss banners in combat results
- [ ] Animate casualty and critical hit counters
- [ ] Animate HP, wall, or power bars when results are shown
- [ ] Keep combat resolution deterministic and presentation-only

---

## Happiness System
**Status:** ✅ IMPLEMENTED  
**Description:** Population happiness framework replaces entertainment-gated happiness

**Completed Components:**
- ✅ Happiness calculation engine (food, entertainment, safety, prosperity, race modifiers)
- ✅ Population growth scaling based on happiness thresholds
- ✅ Production efficiency multiplier (affected by happiness)
- ✅ Rebellion event system (triggered by low happiness)
- ✅ Entertainment research mechanic (drives recovery speed)
- ✅ Combat happiness multiplier tied to happiness
- ✅ Spell integrations (Bless, Divine Favor, etc.)
- ✅ World fragment bonuses for happiness
- ✅ Database schema (kingdoms.happiness column)

**Potential Enhancements:**
- [ ] UI happiness breakdown display (show component breakdown to players)
- [ ] Historical happiness tracking in news/events
- [ ] Advanced rebellion event variations
- [ ] Happiness trends/graphs in game UI

### Happiness System — Code Quality Cleanup
**Status:** Planned
**Priority:** Medium
**Description:** The happiness logic is solid but has structural debt that needs addressing.

**Tasks:**
- [ ] Consolidate `calculateHappiness`, `getHappinessRecoveryRate`, `recordHappinessHistory`, `logHappinessEvent` — currently duplicated across `game/happiness.js`, `game/turn.js`, and `game/engine.js`. Single source in `game/happiness.js`, imported elsewhere.
- [ ] Add `overcrowding` component to `game/happiness.js` — it exists in `engine.js` only, but the DB schema has an `overcrowding_component` column, so stored values are wrong for callers that bypass engine.js
- [ ] Pull race modifiers out of the inline table in `calculateHappiness` — `game/config.js` already has `RACE_BONUSES` with happiness data; use it
- [ ] Extract magic numbers to named constants: recovery rate bounds (0.5/5.0), tax baseline (42), safety curve (-10/+3/10 turns), rebellion cooldown (20 turns), final clamp (-50/120)
- [ ] Audit `||` vs `??` null coalescing across happiness reads — `||` coerces 0 to default

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

## Combat Redesign
**Status:** Local V2 integration recovered; cleanup remains
**Files:** `game/combat-new.js`, `game/combat-resolver.js`
**Description:** Combat V2 is the intended HP/DMG/injury system. Current `engine.js` combat is V1 legacy/power-percent combat by default, but a default-off V2 adapter path exists behind `USE_COMBAT_V2=1`. Keep cleanup focused on docs, diagnostics, and balance review rather than integration recovery.
**See:** PROTECTED_WORK.md

**Phase 1 Recovery Tasks:**
- [x] Mark live `engine.js` combat as V1 legacy combat
- [x] Mark `combat-new.js` and `combat-resolver.js` as V2 intended combat
- [x] Note that current V1 balance reports are useful only as legacy references
- [x] Add a default-off `USE_COMBAT_V2` adapter path
- [x] Add V2 diagnostics to the combat report contract

### Combat Redesign Cleanup
**Status:** Planned
**Priority:** High
**Description:** Finish tightening the V2 combat stack after the initial recovery and balance passes.

**Tasks:**
- [x] Restore useful combat redesign docs locally
- [x] Reconcile `TODO.md`, `PROTECTED_WORK.md`, and `COMBAT_V2_RECOVERY_PLAN.md` with the current integration state
- [ ] Review the remaining outlier cases from the latest broad V2 sweep
- [ ] Re-run the combat V2 regression suite after any code cleanup changes

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

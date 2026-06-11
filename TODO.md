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

**Priority:** Medium  
**Estimated Effort:** 5-9 hours

---

## Combat Redesign
**Status:** CRITICAL - PHASE 1 RECOVERY STARTED  
**Files:** `game/combat-new.js`, `game/combat-resolver.js`  
**Description:** Combat V2 is the intended HP/DMG/injury system. Current `engine.js` combat is V1 legacy/power-percent combat and should not be treated as the final balance target. Pause balance tuning until V2 is wired behind a feature flag and diagnostics confirm troops, clerics, war machines, ladders, and walls are engaging correctly.  
**See:** PROTECTED_WORK.md

**Phase 1 Recovery Tasks:**
- [x] Mark live `engine.js` combat as V1 legacy combat
- [x] Mark `combat-new.js` and `combat-resolver.js` as V2 intended combat
- [x] Note that current V1 balance reports are useful only as legacy references
- [ ] Recover feature-flag integration from `origin/claude/combat-redesign-integration`
- [ ] Restore or recreate V2 diagnostics before further balance testing

---

## World Fragment Combat Balance
**Status:** Planned  
**Priority:** High  
**Description:** Add balance rails for world fragment and synergy bonuses so combat offense/defense modifiers stay exciting without runaway stacking.

**Tasks:**
- [ ] Classify fragment bonuses into buckets: economy, production, research, combat_offense, combat_defense, utility, special
- [ ] Add explicit caps or budgets for fragment-driven combat offense and combat defense
- [ ] Audit multiplier stacking across walls, guard towers, castles, outposts, armories, war machines, and global synergies
- [ ] Add combat simulations for high-risk synergies like Blessed Citadel, Void Convergence, Primordial Awakening, and war-machine builds
- [ ] Normalize stat naming where practical (`manaRegen` vs `mana_regen`, `speed` vs `research_speed`, `power` vs `damage`)
- [ ] Verify dwarf/war-machine balance with fragments applied, especially wall-mounted and solo-crewed war machines
- [ ] Review live magic/combat risks: tier 5 spell mana fallback, socket spell validation parity, and transactional spell/attack updates

---

## Happiness System
**Status:** ✅ IMPLEMENTED  
**Description:** Population happiness framework replaces entertainment-gated morale

**Completed Components:**
- ✅ Happiness calculation engine (food, entertainment, safety, prosperity, race modifiers)
- ✅ Population growth scaling based on happiness thresholds
- ✅ Production efficiency multiplier (affected by happiness)
- ✅ Rebellion event system (triggered by low happiness)
- ✅ Entertainment research mechanic (drives recovery speed)
- ✅ Combat morale multiplier tied to happiness
- ✅ Spell integrations (Bless, Divine Favor, etc.)
- ✅ World fragment bonuses for happiness
- ✅ Database schema (kingdoms.happiness column)

**Potential Enhancements:**
- [ ] UI happiness breakdown display (show component breakdown to players)
- [ ] Historical happiness tracking in news/events
- [ ] Advanced rebellion event variations
- [ ] Happiness trends/graphs in game UI

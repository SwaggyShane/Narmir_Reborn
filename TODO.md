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
**Status:** CRITICAL - DO NOT TOUCH until explicit approval  
**Files:** `game/combat-new.js`, `game/combat-resolver.js`  
**Description:** Complete combat system overhaul - waiting for other systems to be finalized first  
**See:** PROTECTED_WORK.md

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

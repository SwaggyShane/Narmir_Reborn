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

## Happiness System Redesign
**Status:** Design Complete, Ready for Implementation  
**Complexity:** High (major system overhaul)  
**Description:** Replace entertainment-gated morale with intuitive population happiness framework

**Core Components:**
- [ ] Implement happiness calculation engine
  - Food happiness (0-30 points)
  - Entertainment happiness (0-20 points)
  - Safety happiness (-30 to +20 points)
  - Prosperity happiness (0-20 points)
  - Race modifiers (-10 to +10 points)
- [ ] Update population growth calculations (affected by happiness thresholds)
- [ ] Implement production efficiency multiplier (affected by happiness)
- [ ] Add rebellion event system (triggered by low happiness)
- [ ] Refactor entertainment research mechanic (now drives recovery speed)
- [ ] Update all happiness-affecting spells and buildings
- [ ] Create/update UI happiness display and tooltips
- [ ] Database schema updates (add happiness column, deprecate morale)
- [ ] Integration with combat morale system
- [ ] News/event logging for happiness changes
- [ ] Tax integration refinement

**Database Changes:**
- Add `kingdoms.happiness` INT column
- Add `kingdoms.last_attack_turn` INT
- Add `kingdoms.rebellion_cooldown` INT
- Keep `kingdoms.res_entertainment` (now drives recovery)

**Priority:** High  
**Estimated Effort:** 20-30 hours  
**See:** Plan file (/root/.claude/plans/) for full specification

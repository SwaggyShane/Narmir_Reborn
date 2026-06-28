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
**Status:** ✅ ARCHIVED (See ARCHIVAL.md)
**Completion date:** 2026-Q2
**Reference:** ARCHIVAL.md — Track F2, PROTECTED_WORK.md, test-combat-harness/

---

## World Fragment Combat Balance
**Status:** ✅ ARCHIVED (See ARCHIVAL.md)
**Completion date:** 2026-Q2
**Reference:** ARCHIVAL.md — Combat section

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
**Status:** ✅ ARCHIVED (See ARCHIVAL.md)
**Completion date:** 2026-Q2
**Reference:** ARCHIVAL.md — Features section

**Deferred Code Quality Cleanup:** Post-alpha initiative  
- Consolidate duplicated happiness calculation functions
- Add overcrowding component to game/happiness.js
- Extract race modifiers to game/config.js
- Replace magic numbers with named constants
- Audit null coalescing patterns

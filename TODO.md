# Narmir Reborn — TODO

**Purpose:** Live source of truth for active and deferred work. `ROADMAP.md` was retired 2026-07-01; completed work lives in [ARCHIVAL.md](ARCHIVAL.md).

**Last updated:** 2026-07-05 (Terrain System & Admin CSS Phase 4R verified complete; TODO audit corrections)

---

## Status

Beta launch prerequisites are complete. Alpha phase (items 1–22) closed out 2026-06-28. **Active work: Exploration System Redesign (all 4 phases complete as of 2026-07-04).** Fog of War system also complete (5/5 phases). Awaiting final integration and launch. See `EXPLORATION_SYSTEM_LOCKED.md` and `FOG_OF_WAR_PLAN.md` for specifications.

---

## Active Work — Current Sprint

### Security Audit — In Progress — MEDIUM-HIGH PRIORITY
**Status:** 6 categories require review/completion  
**Completed:**
- ✅ SQL Injection: PASS (all parameterized)

**In Progress:**
- XSS Vulnerabilities (sanitizeHtml gaps: data: URIs, vbscript:, SVG vectors, case-sensitivity)
- Input Validation (systematic review: usernames, passwords, kingdom names, chat, numeric, arrays/objects)
- Authentication & Authorization (JWT, CSRF, rate limiting, session fixation, admin checks)
- Race Conditions & Transaction Safety (concurrent updates, building queues, trades, troops, resources)
- Sensitive Data Exposure (password hashing, API keys, git history, error details)
- Resource Management (Socket.io leaks, connection pooling, uploads, query bounds)

**Reference:** `/home/user/Narmir_Reborn/SECURITY_AUDIT.md`

---

## Completed Systems (See ARCHIVAL.md)

- **Fog of War System** (5 phases, all complete) — See ARCHIVAL.md for phase-by-phase details
- **Terrain System** (3 phases, all complete) — PR #751 (Phase 1+2), commit b22962f (Phase 3)
- **Admin CSS Consolidation** (Phase 4R complete) — PR #814, Phase 4S follow-up also complete
- **Exploration System Redesign** (4 phases, all complete) — See section below

---

## Deferred Work — Post-Beta / Future Phases

### Elevation System Plan (Complete Spec) — POST-BETA
**Status:** SPECIFICATION COMPLETE, IMPLEMENTATION DEFERRED  
**Priority:** HIGH (strategic depth, exploration complexity, combat mechanics)  
**Scope:**
- **Phase 1:** FBM (Fractional Brownian Motion) noise-based elevation generation, seeded & reproducible
- **Phase 2:** River/water flow simulation with DAG validation
- **Phase 3:** Combat modifier integration, movement cost scaling, spell interactions

**Features:** Organic topography, river pathfinding, terrain-aware combat bonuses/penalties, elevation-based movement costs  
**Gate:** Feature flags (FEATURE_ELEVATION_COMBAT, FEATURE_ELEVATION_MOVEMENT, FEATURE_ELEVATION_SPELLS) for safe rollout  
**Reference:** `/home/user/Narmir_Reborn/ELEVATION_SYSTEM_PLAN.md` (production-ready specification)  
**Dependencies:** Perlin/Simplex noise library, biome-aware elevation normalization, per-hex storage

### Fog of War Phase 5: Expansion Hooks — POST-PHASE 4
**Status:** DEFERRED, SCOPE DEFINED  
**Scope:** Special locations, map items, terrain-scoped discovery difficulty  
**Details:** Leave room for discovery expansion; explicitly not first-build (matches MAP_TERRAIN.md Phase 5 pattern)  
**Gate:** Deferred post-Phase 4 fog rendering completion

### World Generation Randomization (FOG_OF_WAR_PLAN Phase 1.5) — VALIDATION COMPLETE, DEFERRED
**Status:** Validation findings show necessity; implementation deferred  
**Findings (2026-07-03):**
- 47% region misalignment in human kingdoms (systemic issue)
- 0.12% water spawns (real, affects reference kingdoms)
- ✅ REGION_SEEDS/RACE_HOMES realignment confirmed necessary

**Scope:** Randomize kingdom placement (per-race region), node placement, terrain biome distribution, water prohibition enforcement  
**When:** May be inserted before Phase 2 if resources permit; otherwise scheduled post-Phase 1 completion

### Admin Wishlist Plan (40+ Deferred Features) — LONG-TERM BACKLOG
**Status:** BACKLOG, ORGANIZED  
**Categories (7):** Gameplay (7), Combat (7), Economy (5), World (6), Polish (4), Partial features (4)  
**Notable Items:** Diplomacy, espionage, religion, artifact hunting, auction house, weather systems, dynamic world events, custom UI themes  
**Reference:** `/home/user/Narmir_Reborn/ADMIN_WISHLIST_PLAN.md`  
**Timeline:** Post-Beta features; prioritize based on player feedback

---

## Known Technical Debt (Post-Beta)

- **Component test coverage expansion** — 57+ component tests exist; gaps remain in some panels
- **Manual BEGIN/COMMIT pattern in kingdom-mutation routes** — Use `db.withTransaction()` instead (see FOG_OF_WAR Phase 2 for pattern)

---

## Notes

- When an item here is completed, move its entry to `ARCHIVAL.md` under a dated chronology entry and remove it from this file.
- See `CLAUDE.md` for PR workflow, quality checks, and merge requirements before starting new work.

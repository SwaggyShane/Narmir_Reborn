# Narmir Reborn — TODO

**Purpose:** Live source of truth for active and deferred work. `ROADMAP.md` was retired 2026-07-01; completed work lives in [ARCHIVAL.md](ARCHIVAL.md).

**Last updated:** 2026-07-10 (All major systems complete — Exploration, Fog of War, GameStateManager migration, Security audit, Upgrade UX fixes)

---

## Status

✅ **ALL MAJOR SYSTEMS COMPLETE:**
- GameStateManager → Zustand migration: Complete (single sprint, all 6 phases)
- Exploration System Redesign: Complete (4 phases, fully deployed)
- Fog of War system: Complete (5 phases, integrated)
- Security Audit: Complete (all 7 categories passing)
- Upgrade UX: Complete (validation toast + dynamic refresh)

See [ARCHIVAL.md](ARCHIVAL.md) for detailed completion records.

---

## Active Work — Current Sprint

### Security Audit — COMPLETE (2026-07-05)
**Status:** All 7 categories reviewed and documented ✅  
**Summary:**
- ✅ SQL Injection: PASS (100% parameterized + identifier quoting per SQL_INJECTION_AUDIT_REPORT)
- ✅ XSS: PASS (sanitizeHtml hardened for data:/vbscript:/SVG/case; tests added; only safe internal dangerouslySetInnerHTML usage)
- ✅ Input Validation: PASS (auth, forum, chat, numeric validators, admin set-kingdom name rules)
- ✅ Authentication & Authorization: PASS (JWT, CSRF double-submit, tiered rate limits, admin IP+JWT)
- ✅ Race Conditions: PASS on critical paths (withTransaction + FOR UPDATE + player turn locks); some manual patterns remain as tech debt
- ✅ Sensitive Data: PASS (bcrypt, SecretsManager, sanitized logs/errors)
- ✅ Resource Management: PASS (pool sizing/timeouts, 1-5MB limits, signature-validated uploads, bounded queries)

**References:** `SECURITY_AUDIT.md`, `SQL_INJECTION_AUDIT_REPORT.md`

### Turn Processing Fix Phase 2 — ANALYSIS & VERIFICATION COMPLETE
**Status:** Phase 2 analysis found critical correctness constraint; Phase 2b deferred
**Phase 1 (Complete):** PR #845 (2026-07-07) — Moved init/refresh queries outside transaction, reduced per-turn from 1,641ms to ~924ms. Also fixed discovered kingdoms name display bug in fog of war.
**Phase 2 Analysis (PR #835, merged):**
- **2a (Complete):** Batch expedition updates with CASE/WHEN — already implemented
- **2b (DEFERRED):** Remove kingdom fetch — Analysis found critical data corruption risk; Gemini review confirmed. The passed-in kingdom object contains stale in-memory state (not updated with applyUpdates changes). Removing the fetch causes silent data loss when resolveExpeditions recalculates XP/rewards. Solution: Retain the database fetch with correctness constraint documented in code.
- **2c (Complete):** Batch hero XP updates with CASE/WHEN — already implemented

**Key Finding:** The optimization assumption (kingdom state is fresh) is incorrect. processTurn returns updates but doesn't mutate the in-memory object. Without the database fetch, resolveExpeditions silently corrupts the database with stale values.

**Lessons:** Phase 1 (moving reads outside txn) was safe. Phase 2b (removing the fetch) is not safe without a deep merge of all updates first. Verified by Gemini review, fix committed, CI green.

---

## Completed Systems (See ARCHIVAL.md)

- **Phase 1: Architecture Documentation (M1-4)** (complete 2026-07-09, PR #851) — Comprehensive baseline architectural analysis: current-state documentation (ARCHITECTURE.md), detailed turn pipeline with bottleneck analysis (TURN_PIPELINE.md), state persistence model (STATE_PERSISTENCE_MODEL.md), coupling analysis (COUPLING_ANALYSIS.md). Ready for Phase 2 refactoring. See ARCHIVAL.md.
- **Visibility Unification (M1-2) + Container/DB Stability** (complete 2026-07-08, PR #850) — Unified server/client cellIndex (removed duplicate, added bounds). Fixed hardcoded PORT and shutdown issues causing restarts and SSL errors in logs. See ARCHIVAL.md.
- **Turn Healing Extraction (M1-3)** (complete on feature/turn-healing-local) — Expanded healKingdomForTurn to cover 15+ JSON fields, added ensureArray/getXpSources, extracted logic from processTurn, dedicated tests. Local only per instructions.
- **Router Order Reduction (M1-1)** (started on feature/router-order-local) — Made sub-router mounting explicit via ordered array in kingdom.js to reduce shadowing. Enhanced precedence test. Limited commits.
- **DB Schema Modularization / Bloat Reduction** (complete 2026-07-08, PR #849) — Major extraction of monolithic db/schema.js. All CREATE TABLEs moved to ddl.js, seeds and column initializers to init-data.js, helpers extracted. See ARCHIVAL.md.
- **Fog of War System** (5 phases, all complete) — See ARCHIVAL.md for phase-by-phase details
- **Terrain System** (3 phases, all complete) — PR #751 (Phase 1+2), commit b22962f (Phase 3)
- **Admin CSS Consolidation** (Phase 4R complete) — PR #814, Phase 4S follow-up also complete
- **Exploration System Redesign** (4 phases, all complete) — See section below

---

## Active Work — Phase 3 (Conditional CPU Optimization)

### Turn Processing Fix Phase 3 — CPU OPTIMIZATION (3a–3b COMPLETE, 3c PENDING)
**Status:** Profiling infrastructure created and integrated; conditional optimization pending  
**Phase 1 Result:** Reduced per-turn from 1,641ms to ~924ms (44% latency reduction)  
**Phase 2 Result:** Deferred 2b due to data corruption risk; identified critical correctness constraint  
**Conditional Gate (Phase 3c):** Only proceed if profiling data shows JSON cost >100ms OR slow attunements >10ms OR synergy lookups >100/turn

**Phase 3 Work:**
- **3a (Complete — PR #837):** Profile CPU-bound operations to identify bottlenecks
  - ✅ TurnProfiler class: JSON ops timing, attunement call measurements, synergy lookup counting
  - ✅ AsyncLocalStorage for thread-safe per-request profiling
  - ✅ performance.now() for high-resolution timing
  - ✅ Measurement script with detailed profiling reports
- **3b (Complete — PR #838):** Integrate profiler into processTurn and /turn route
  - ✅ Profiler initialized and started in processTurn
  - ✅ Profiler context propagated via AsyncLocalStorage
  - ✅ Instrumented 5 attunement functions (granary, vault, barracks, walls, guard tower) with measureAttunement()
  - ✅ Console logging of profiling metrics (total time, JSON costs, slow attunements)
  - ⏳ Next step: extend instrumentation to all 18 attunements for complete profiling data
- **3c (Complete — PR #839):** Measurement infrastructure for exploration optimization (user hypothesis: exploration is bottleneck)
  - ✅ All 18 attunement functions fully instrumented with measureAttunement()
  - ✅ Scout progress function instrumented (processScoutProgress - key exploration function)
  - ✅ Created measure-turn-real.js: enhanced measurement script for real kingdom profiling
  - ✅ Database connection cleanup fixed (Gemini feedback addressed)
  - ✅ Ready for deployment: run `node game/measure-turn-real.js <kingdomId>` to capture profiling data
  - **Next phase (conditional 3d):** Implement targeted optimizations based on profiling results
    - Cache parsed objects if JSON bottleneck detected (>100ms or >20% of total)
    - Refactor slow attunement functions (>10ms max time) — likely scout/exploration related
    - Add caching for synergy lookups if high volume detected (>100/turn)

**Profiling Infrastructure:**
- TurnProfiler class: Tracks JSON ops, attunement calls, synergy lookups
- Measurement script: Runs profiling on real game engine with detailed reporting
- Report format: Total time, JSON breakdown, slow attunements, optimization targets

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

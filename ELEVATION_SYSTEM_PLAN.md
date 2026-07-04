# Elevation System — Future Implementation Plan

**Status:** Deferred (Post-Beta)  
**Created:** 2026-07-04  
**Priority:** High (blocks organic rivers + combat depth)

---

## Overview

The world map currently lacks elevation data, which gates multiple features:

1. **Organic river flow** — Currently constrained to hex-to-hex paths; elevation would enable natural downhill hydrology
2. **Combat mechanics** — Elevation advantage/penalty not implemented (high ground bonus, siege penalties, etc.)
3. **Exploration gameplay** — Mountain passes, canyon routes, natural fortifications not possible
4. **Visual depth** — Terrain patterns alone don't convey topographic variation

---

## Feature Flags

All post-Beta phases are gated behind feature flags for safe rollout and rollback.

- **FEATURE_ELEVATION_COMBAT** — Phase 3A: High-ground combat modifier (+7% defense). Default: disabled. Enable after Phase 1 validation.
- **FEATURE_ELEVATION_MOVEMENT** — Phase 3B: Movement penalties and elevation fatigue. Default: disabled. Enable after 1–2 weeks Phase 3A playtesting.
- **FEATURE_ELEVATION_SPELLS** — Phase 3C: Spell LOS checks and siege bonuses. Default: disabled. Enable after Phase 3B validation.

Feature flags are **independent**: can enable 3A without 3B, or 3B without 3C. Allows safe incremental testing and immediate rollback if issues detected.

---

## Save Compatibility

Existing kingdoms and worlds must migrate safely to elevation system.

**New Fields (with defaults):**

Kingdoms:
```json
{
  elevation: 0,           // kingdom position elevation (default: 0 = plains)
  elevation_cached_at: null,  // last time elevation was queried (cache timestamp)
}
```

Worlds:
```json
{
  elevation_bands: {
    ocean: [0, 0],
    coast: [1, 30],
    plains: [31, 90],
    hills: [91, 149],
    mountains: [150, 255]
  },
  elevation_generated_at: null,  // first time elevation was generated (immutable)
}
```

**Migration Notes:**
- Existing kingdoms get elevation = 0 (plains, neutral starting point)
- No exploration/combat data lost (new fields are additive)
- Elevation cache is empty until first world load (lazy generation)
- Worlds generated before elevation system have no elevation_generated_at timestamp (flag for one-time generation on next load)

---

## Architecture

### Phase 1: Elevation Data Generation

**What:** Generate elevation values per hex during world generation using multi-octave Perlin noise, as a shared world primitive in the generation pipeline.

**Implementation:**

1. **Noise Generation:**
   - Use multi-octave Perlin/Simplex noise (Fractional Brownian Motion) for natural mountain/valley distribution
   - Seed with world seed for perfect reproducibility across resets
   - Combine 3-4 octaves at decreasing amplitude for varied topography

2. **Post-Processing & Correlation (Biome-Aware Normalization):**
   - Apply terrain-type constraints to deterministically map elevation to explicit, non-overlapping bands:
     - Ocean: 0 (sea level)
     - Coast: 1–30
     - Plains: 31–90
     - Hills: 91–149
     - Mountains: 150–255
   - Normalization step: After Perlin noise generation, apply biome rules to shape elevation (don't use raw noise alone)
   - Optional: Add small random perturbation or erosion pass for extra realism

3. **Data Structure:**
   ```javascript
   {
     col, row, x, y,
     race, terrain,
     elevation,  // 0-255 (sea level to peak), mapped to explicit bands above
   }
   ```

**Architecture:**
- **Elevation is a shared world primitive** generated in the world-generation pipeline (server + client, if needed)
- Not isolated to `WorldmapRenderer.jsx`; owned by generation system to ensure server/client consistency
- Precomputed once at world load, cached, never recomputed
- Seeded with world seed for perfect reproducibility across resets

**Files to modify:**
- Server-side world-generation pipeline — Add elevation generation with seeding
- `client/src/components/react/WorldmapRenderer.jsx` — Consume elevation from pipeline (don't generate)
- Database schema (if persisting elevation) — Store or regenerate from seeded pipeline

**Critical:** Elevation must be fully seeded with world seed to guarantee consistency across resets and client/server sync. Store in DB after first generation; do not regenerate (seeding drift breaks reproducibility).

**Performance Note:** Precompute during world generation; O(hex count) one-time cost, zero runtime cost during gameplay.

**Rollback Strategy (Phase 1):**
- If elevation generation causes world corruption or incorrect bands:
  - Disable world load (prevent further corruption)
  - Restore backup of `worlds` table before elevation addition
  - Database migration remains (unused) — no data loss
  - No player data affected (elevation is read-only, additive)
  - Re-enable after validation

**Migration Validation (Phase 1):**
After migration, verify:
- All hexes have elevation value (no NULLs)
- Elevation bands match terrain type (mountains are 150+, oceans are 0)
- Row count unchanged (all hexes present)
- Indexes on elevation column exist
- Deterministic: two worlds with same seed have identical elevation grids

---

### Phase 2: Organic River Flow

**What:** Build river networks using a flow-map (downhill neighbor graph) derived from elevation, rendering rivers proportional to accumulated flow.

**How:**
- Replace ad hoc pathfinding with explicit **downhill neighbor graph** (DAG) based on steepest descent
- Compute **flow accumulation**: for each hex, count all uphill cells draining to it (this is river volume)
- Define **sink rules**: lakes serve as intermediate sinks, ocean as final sink
- **Render after topology validation**: Apply Bezier smoothing only after DAG is validated (avoid hiding pathing bugs)

**Concrete Algorithm:**
1. **Flow Direction Mapping:** For each hex, compute steepest-downhill neighbor (8-neighbor gradient check all neighbors, pick minimum elevation)
2. **Flow Accumulation:** Initialize all hexes to 1 unit of flow. Iterate: for each hex, add its flow to its downhill neighbor's accumulation
3. **Sink Rules:** Ocean hexes receive flow but don't propagate. Lakes (if implemented) act as intermediate sinks (receive and pool, limited outflow)
4. **Path Construction:** Trace from peaks downslope following neighbors; tributaries naturally converge where multiple paths flow to same sink
5. **Rendering:** Render rivers proportional to accumulated flow (thick for major rivers, thin for tributaries), then apply Bezier curves for smooth visual

**Implementation:**
- New `buildElevationHydrology()` function to replace current `buildRiverNetwork()`
- Build DAG structure: `{ hex: [downhill_neighbor], flow_volume: N }`
- Validate DAG: ensure no cycles, all paths reach ocean
- Store flow accumulation in intermediate structure (not persisted; precomputed per world boot)
- Group rivers by flow volume (major rivers >500 flow, tributaries 100-500, streams <100)
- Render major rivers with stroke-width ∝ flow_volume, tributaries thinner

**Visual:**
- Rivers follow natural topography, not hex boundaries
- Tributary confluence visible at collection points (where flow converges)
- Main river channels stand out from smaller streams (proportional stroke width)
- Visual represents actual water flow hierarchy (emergent from DAG)

**Performance Note:** Precompute flow accumulation at world generation; O(hex count) one-time cost, zero runtime cost during gameplay.

**Validation Before Rendering:**
- Ensure DAG is acyclic (no circular flows)
- Ensure all non-ocean hexes eventually reach ocean (no dead-end flows)
- Check flow conservation (sum of inflows ≈ outflow for each hex)

**Files:**
- `client/src/components/react/WorldmapRenderer.jsx` — Build downhill neighbor DAG + flow accumulation + topology validation + Bezier rendering

**Rollback Strategy (Phase 2):**
- If rivers look wrong (infinite loops, invalid sinks, poor visual flow):
  - Disable river rendering (show placeholder or old BFS rivers)
  - Keep elevation data (not affected)
  - Revert WorldmapRenderer changes
  - No player data loss
  - Re-enable after DAG fix

---

### Phase 3: Combat & Gameplay Integration

**What:** Elevation affects military engagement and exploration mechanics.

**Combat Integration (Feature-Flagged Rollout):**

**Phase 3A: High-Ground Modifier Only (Behind FEATURE_ELEVATION_COMBAT flag)**
- **High Ground Advantage:** Defender elevation > attacker elevation → defender +7% damage reduction
  - Conservative starting point (+7% in 5–10% window); allows safe tuning
  - Only applies if elevation difference ≥ 1 unit
  - Attacker damage output unmodified (test bonus in isolation before stacking)
- **Battle Outcome Logging:** Log all combat results (damage dealt, defender elevation, attacker elevation) to guide balance tuning

**Phase 3B: Movement Penalties (Behind FEATURE_ELEVATION_MOVEMENT flag) — After 1–2 weeks balance data**
- **Mountain Terrain Penalty:** Units crossing mountains suffer -30% movement speed penalty
  - Siege engines (slow units) suffer additional -15% (cumulative -45% if on mountain high ground)
  - Applies to both expeditions (exploration speed) and army movement
- **Elevation Fatigue:** Each 10 elevation units of uphill movement costs 1 fatigue point per unit
  - Downhill movement has no penalty (gravity-assisted)

**Phase 3C: Spell & Siege Rules (Behind FEATURE_ELEVATION_SPELLS flag) — After movement validation**
- **Line-of-sight elevation checking:** Spell ranges require unobstructed elevation path (can't cast over mountains to adjacent valleys without LOS breach)
- **High-ground casters:** Get +5% spell damage (modest, tunable separately)
- **Area effects (AoE):** Ignore elevation (fire-and-forget patterns)
- **Siege Mechanics:** Defending from mountains/hills grants +10% structure HP (revised from +15%, scaled conservatively)
- **Siege engines:** On flat ground can suppress castle elevation penalty by targeting siege weapons

**Exploration Mechanics (Independent of Phase 3A/B/C, implement with rivers):**
- Expeditions through mountains cost +50% turns vs. plains (terrain + elevation compound)
- Scout rings reveal more slowly in mountains (-20% ring-per-turn advancement)
- Mountain passes (low-elevation hex paths between peaks) become strategic chokepoints

**Bonus Cap:**
- Combined elevation + terrain + unit-type bonuses capped at +15% total (prevent stacking spiral)
- Feature flags allow safe incremental testing; disable any phase if it breaks balance

**Implementation:**
1. Add `elevation` field to kingdom position, cache during world load
2. Elevation lookup during combat: `getElevationDifference(attacker, defender)`
3. Movement pathfinding: Incorporate elevation cost into A* heuristic
4. Spell range validation: Bresenham + elevation check for LOS
5. Expedition speed: Already has terrain cost; add elevation multiplier

**Files:**
- `server/game/combat.js` — `calculateDamageBonus(attacker, defender)` with elevation check
- `server/game/units.js` — Movement speed calculation with elevation fatigue
- `server/game/expeditions.js` — Expedition turn cost with elevation factor
- `server/game/spells.js` — Range/LOS validation with elevation blocking
- `client/src/components/react/WorldmapRenderer.jsx` — Preload elevation cache on world spawn

**Rollback Strategy (Phase 3A/B/C):**
- If combat breaks PvP balance or movement creates dead zones:
  - Disable FEATURE_ELEVATION_COMBAT/MOVEMENT/SPELLS flag (immediate rollback)
  - Revert code changes
  - No player data loss (elevation bonuses were temporary)
  - Fix issue, re-enable after validation
- Each sub-phase (3A/3B/3C) can be rolled back independently

**Failure Scenarios & Error Codes (Phase 3A/3B/C):**

Combat Calculation Failures:
- `ELEVATION_LOOKUP_FAILED` (400) — Attacker or defender elevation not found
- `INVALID_ELEVATION_DIFFERENCE` (400) — Elevation difference calculation failed
- `COMBAT_LOCKED` (409) — Battle already locked by concurrent request (retry)

Movement Failures:
- `ELEVATION_PATHFINDING_FAILED` (500) — A* pathfinding error with elevation cost
- `MOVEMENT_DEAD_ZONE` (403) — Target unreachable due to elevation penalties (dead zone detected)
- `INSUFFICIENT_MOVEMENT_POINTS` (403) — Unit doesn't have enough moves after elevation fatigue

Spell/LOS Failures:
- `SPELL_LOS_BLOCKED` (403) — Target not in line-of-sight due to elevation obstruction
- `ELEVATION_ADVANTAGE_REQUIRED` (403) — Spell requires high ground, attacker on low ground

**Concurrency & Atomicity (Phase 3A/B/C):**
- Combat calculations must be transaction-locked: `SELECT...FOR UPDATE` on both kingdoms
- Elevation bonus applied atomically (all-or-nothing)
- Battle outcome logged in same transaction
- If server crashes during combat: entire transaction rolls back (no partial state)

---

## Technical Considerations

### Client/Server Sync
- **Elevation is a shared world primitive** owned by the generation pipeline (server + client if needed), not isolated to renderer
- Elevation data is **deterministic and fully seeded**, same as terrain — generated once at world load
- No client-side elevation randomness; server authoritative on elevation for combat/movement validation
- Cache elevation grid on server startup (single O(hex count) pass); elevation precomputed, never regenerated
- Client consumes elevation from `/world-map` endpoint (already seeded, no extra request needed)
- **Data storage**: Elevation generated from world seed + stored in DB after first generation (prevents regeneration drift)

### Performance
- **Phase 1 (Elevation Generation):** O(hex count), precomputed once at boot, no runtime cost
- **Phase 2 (Flow Accumulation):** O(hex count), precomputed at boot, memoized per world
- **Phase 3 (Combat/Movement):** Elevation lookup O(1), no per-tick recalculation; cached in kingdom context
- **Pathfinding:** A* with elevation heuristic adds ~5-10% to movement path calculation (acceptable)

### React Architecture
- Elevation colors optional (terrain colors sufficient; elevation is mechanical, not visual)
- If visual elevation gradient is desired, add optional SVG layer with darkened mountains (post-Phase 2)
- No state bloat; elevation is purely data lookup

### Debug Mode
- Visual: Overlay elevation heatmap (blue=low, red=high) on worldmap for development
- Command: `/debug elevation` toggles visualization
- Export: `/world-map?debug=elevation` returns JSON of elevation grid for offline analysis

### Configuration Parameters

Gather all configurable values in one place to avoid magic numbers scattered in code:

| Parameter | Value | Unit | Notes |
|-----------|-------|------|-------|
| **Elevation Bands** | | | |
| Ocean elevation | 0 | int | Sea level |
| Coast elevation | 1–30 | int | Shallow water, beaches |
| Plains elevation | 31–90 | int | Flat terrain |
| Hills elevation | 91–149 | int | Rolling terrain |
| Mountains elevation | 150–255 | int | High peaks |
| **Combat** | | | |
| High ground modifier (Phase 3A) | +7% | percent | Defender damage reduction |
| Movement penalty (mountains) | -30% | percent | Phase 3B |
| Elevation fatigue cost | 1 point per 10 units | int | Uphill only, Phase 3B |
| Siege structure HP bonus | +10% | percent | Phase 3C |
| Spell LOS distance check | elevation-aware | bool | Phase 3C |
| Combined bonus cap | +15% | percent | Max elevation + terrain + unit stacking |
| **Noise Generation** | | | |
| Octave count | 3–4 | int | Perlin/Simplex octaves |
| Base frequency | 0.01 | float | Initial scale |
| Amplitude decay | 0.5 | float | Per-octave reduction |
| Normalization strength | 1.0 | float | How strongly biome rules apply |

### Cache Invalidation

Elevation data is static per world, but cache must be invalidated at specific times:

- **Server Restart**: Elevation cache cleared, regenerated from world seed on first load
- **World Regeneration**: Old elevation cache discarded, new elevation generated
- **Admin Map Reset**: Clear elevation cache, rebuild from current terrain
- **Kingdom Creation**: Assign current world elevation to new kingdom (one-time lookup)

Never serve stale elevation data after these events.

### Logging Events

Log the following events for debugging, balance tuning, and audit trails:

**Phase 1:**
- `elevation_generation_started` (world_id, hex_count, noise_params)
- `elevation_band_assigned` (hex_id, elevation, band_name, terrain_type)
- `elevation_generation_complete` (world_id, total_hexes, min_elev, max_elev, band_distribution)

**Phase 2:**
- `river_dag_built` (world_id, hex_count, sink_count, branch_count)
- `river_topology_validated` (world_id, acyclic: bool, all_reach_ocean: bool, flow_conservation: bool)

**Phase 3A:**
- `battle_started` (attacker_elev, defender_elev, elev_diff)
- `elevation_bonus_applied` (kingdom_id, bonus_percent, damage_modified)
- `battle_outcome` (winner_id, attacker_damage, defender_damage, bonus_applied)

**Phase 3B/3C:**
- `movement_elevation_cost` (kingdom_id, hex_from, hex_to, elev_change, fatigue_cost)
- `spell_los_check` (caster_elev, target_elev, line_blocked: bool)
- `feature_flag_toggled` (flag_name, enabled: bool, timestamp)

### Performance Targets

Elevation system must scale to:

- **5000 kingdoms** (estimated upper bound for single-server deployment)
- **~20,000 hexes** (hex count for large maps)
- **100,000+ expeditions** (total historical, not concurrent)
- Elevation generation: < 100ms per world (O(hex count) precomputed once)
- Combat elevation lookup: < 1ms (O(1) cache hit)
- River DAG validation: < 500ms per world (O(hex count), one-time)

No architecture changes required up to these scales.

### Deterministic Seeding

Anywhere randomness exists, it must be seeded for reproducibility:

**Elevation Generation:**
- Seed: `world_seed` (global, immutable)
- Result: Identical elevation grids for same world_seed (crucial for reset/replay)

**River Generation (if any randomness):**
- Seed: `world_seed + hex_coordinate` (location-specific randomness)
- No per-kingdom randomness (ensures rivers are universal)

**Discovery Randomness (Phase 2):**
- Seed: `world_seed + expedition_id + turn_number` (unique per action)
- Allows deterministic replay of any expedition

Never use unseeded randomness (Math.random()). Always derive seed from immutable world state.

---

## Risks to Watch

1. **Elevation Consistency:** If seeding drifts (e.g., noise library version changes), worlds break.
   - *Mitigation*: Store elevation in DB after first generation; do not regenerate. Add regression tests for seed stability.

2. **Combat Balance:** Stacking elevation + terrain + unit type could spiral balance.
   - *Mitigation*: Start with modest +7% modifier (Phase 3A only). Feature flags allow safe toggle. Log battle outcomes to tune. Cap combined bonuses at +15% total. Gradual rollout: Phase 3A → playtesting → Phase 3B → Phase 3C.

3. **Perlin Noise Artifacts:** Raw Perlin noise can create awkward coastlines or mountain clusters.
   - *Mitigation*: Biome-aware normalization step shapes elevation after noise (don't use raw noise). Elevation bands correlate with terrain type.

4. **Movement Pathfinding:** Elevation costs compound with terrain costs (mountains already -30%, adding elevation fatigue stacks).
   - *Mitigation*: Test pathfinding doesn't create movement dead-zones. Feature flag (FEATURE_ELEVATION_MOVEMENT) allows disabling if problematic.

5. **River Topology Bugs:** Bezier smoothing can hide pathing bugs (cycles, dead-end flows).
   - *Mitigation*: Validate DAG (acyclic, all paths reach ocean) before applying Bezier smoothing. Add regression tests for topology.

6. **Spell Targeting:** LOS elevation checking could create invisible "no-cast zones" if overzealous.
   - *Mitigation*: Test from valley vs. peak explicitly. Feature flag (FEATURE_ELEVATION_SPELLS) allows disabling for debugging.

7. **Data Migration:** Existing worlds pre-elevation need backfill.
   - *Mitigation*: Plan migration script to generate elevation retroactively on first load post-launch using same seeding pipeline.

---

## Suggested Implementation Order

**Order matters for stability and testing. All phases use feature flags for safe rollout:**

1. **Phase 1 (Elevation Generation Pipeline)** — Move elevation generation to world-generation pipeline (server + client), implement explicit elevation bands, biome-aware normalization
   - Add regression tests: Verify seed stability (same seed = identical elevation grid), terrain/elevation correlation (mountains always 150+, oceans always 0)
   - 3-4 hours + 1-2 hours testing

2. **Phase 2 (River Flow with DAG)** — Build downhill neighbor graph, flow accumulation, sink rules; validate DAG before Bezier smoothing
   - Add regression tests: DAG acyclicity, flow conservation, all paths reach ocean
   - Test visual: tributaries merge, river width proportional to flow
   - 6-8 hours + 2-3 hours testing

3. **Phase 3A (Combat High Ground Only)** — Implement +7% defense bonus behind FEATURE_ELEVATION_COMBAT flag (conservative, tunable)
   - Log all battle outcomes (damage, elevations, modifier applied)
   - Test with closed group: Does +7% feel fair? Too weak? Too strong?
   - 2-3 hours + 1-2 weeks playtesting

4. **Balance Tuning Phase 3A** — Analyze battle logs, adjust modifier if needed (e.g., move from +7% to +8% or +10%), ensure PvP doesn't feel cheap
   - 1-2 hours analysis

5. **Phase 3B (Movement + Fatigue)** — Add movement penalties behind FEATURE_ELEVATION_MOVEMENT flag; test pathfinding doesn't create dead zones
   - Verify combined bonus (high ground + movement penalty) doesn't exceed +15% cap
   - 2-3 hours + 1-2 hours testing

6. **Phase 3C (Spells + Siege)** — Add spell LOS, siege bonuses behind FEATURE_ELEVATION_SPELLS flag; test edge cases (valley vs. peak casting)
   - Ensure spell bonus cap enforced
   - 2-3 hours + 1-2 hours testing

7. **Full Balance Pass** — Playtest 8-hour game with all flags enabled, validate no broken mechanics, no dead zones, siege feels meaningful
   - Iterate on any balance issues

**Estimated Timeline (with regression testing and feature-flag rollout):**
- Phase 1 + Regression Tests: 4-6 hours
- Phase 2 + Regression Tests: 8-11 hours
- Phase 3A + Playtesting: 3-5 hours (+ 1-2 weeks playtesting)
- Balance Tuning: 1-2 hours
- Phase 3B + Tests: 3-5 hours
- Phase 3C + Tests: 3-5 hours
- Full Balance Pass: 4-6 hours
- **Total: ~30-40 hours** (with playtesting; ~24-30 hours code/testing)

---

## Phase 3A Sequence Diagram (Combat with Elevation Check)

```
Battle Start (attacker vs defender)
  ↓
Lookup Elevation (attacker_pos, defender_pos) [SELECT elevation FROM kingdoms]
  ↓
Calculate Elevation Difference (defender_elev - attacker_elev)
  ↓
Check Feature Flag (FEATURE_ELEVATION_COMBAT) [if disabled, skip to "Apply Damage"]
  ↓
Apply Elevation Bonus (if diff >= 1, defender damage reduction += 7%)
  ↓
Log Battle Start (with elevations)
  ↓
BEGIN TRANSACTION [SELECT...FOR UPDATE on both kingdoms]
  ↓
Apply Damage (with elevation modifier)
  ↓
Update Kingdom HP
  ↓
Log Battle Outcome (attacker damage, defender damage, elevation bonus applied)
  ↓
COMMIT TRANSACTION
  ↓
Return Result (attacker_damage, defender_damage, bonus_applied)
  ↓
Notify Player
```

**Key points:**
- Elevation lookup is O(1) cache hit
- All combat updates atomic (transaction-locked)
- Feature flag allows disable without code change
- Logging happens inside transaction (all-or-nothing)
- If server crashes: transaction rolls back, no partial state

---

## Out-of-Scope Features (Prevent Scope Creep)

The following features are NOT included in Phases 1-3 and should be deferred:

- **Naval exploration** — Elevation doesn't affect water travel; defer to separate naval system
- **Scout heroes** — Heroes with elevation bonuses; defer to hero system expansion
- **Shared discoveries** — Multiple kingdoms sharing discovered locations; defer to social features
- **Multi-destination expeditions** — Epic Trek to multiple targets in one turn; defer to routing system
- **Random encounters** — Bandits, monsters on elevation; defer to encounters system
- **Treasure maps** — Special high-elevation rewards; defer to treasure system
- **Scout experience** — Scouts level up with exploration; defer to unit progression
- **Expedition upgrades** — Better scouts, faster travel; defer to upgrade system
- **Escort caravans** — Protected expeditions; defer to escort mechanics
- **Dynamic elevation changes** — Mountains erode, islands sink; defer to world evolution system

**Rationale:** These would expand scope significantly. Focus on core elevation mechanics (generation, rivers, combat) first.

---

## Future Extensions (Post-Launch)

Once elevation system proves stable:
- **Settlements on High Ground** — Capital placement prefers hilltops (strategic advantage at start)
- **Natural Chokepoints** — Mountain passes rare; expeditions gain bonus resource discovery in passes (rare strategic routes)
- **Weather System** — Snow-capped mountains, avalanche risk in winter expeditions
- **Dynamic Erosion** — Over world time, elevation shifts (slow mountain wear, coastal erosion)
- **Expeditions Find Passes** — Scout discovery mechanic reveals optimal low-elevation routes through ranges

---

## Implementation Summary

**Phase 1 (Elevation Generation):**
- 3-4 hours (noise generation, seeding, terrain correlation)

**Phase 2 (Organic Rivers):**
- 6-8 hours (gradient descent, flow accumulation, Bezier rendering)

**Phase 3 (Combat & Gameplay):**
- 8-10 hours (combat bonuses, movement fatigue, spell LOS, siege mechanics, exploration costs)

**Visualization & Balance Testing:**
- 4-6 hours (debug heatmap, visual validation, PvP balance testing, pathfinding edge cases)

**Total:** ~25-31 hours of development (includes full validation & balance pass)

**Critical Path:** Phase 1 → Phase 2 → Phase 3 (sequenced; Phase 2 requires Phase 1, Phase 3 benefits from testing Phase 2)

---

## Success Criteria (Post-Launch Validation)

- ✅ Elevation persists across world resets (seeding consistency) — validate seed stability tests pass
- ✅ Elevation bands are deterministic (ocean 0, coast 1–30, plains 31–90, hills 91–149, mountains 150+)
- ✅ Rivers flow downhill following DAG; tributaries merge naturally; river width proportional to flow
- ✅ DAG is acyclic and all paths reach ocean (topology validation passes)
- ✅ High ground provides +5–10% defense bonus; feels fair to PvP players (not "cheap")
- ✅ Feature flags allow safe toggle: FEATURE_ELEVATION_COMBAT, FEATURE_ELEVATION_MOVEMENT, FEATURE_ELEVATION_SPELLS
- ✅ Combined bonuses (elevation + terrain + unit type) capped at +15% max (no stacking spiral)
- ✅ Mountain movement penalties don't create dead zones (pathfinding still finds routes)
- ✅ Spell LOS elevation checks work from both peak and valley (no invisible no-cast zones)
- ✅ Sieges on mountains feel meaningfully harder (not trivial, not impossible) — validated via playtesting
- ✅ Expeditions route logically through mountain passes when available (strategic chokepoints)

---

---

## Release Checklist

**This checklist gates release. All items must pass before merge to main.**

### Phase 1 (Elevation Generation)
- [ ] Elevation column added to hex/world tables
- [ ] Migration verified: all hexes have elevation, no NULLs
- [ ] Seed stability test passes: two worlds with same seed have identical elevation
- [ ] Band correlation test passes: mountains always 150+, oceans always 0
- [ ] Generation time < 100ms per world
- [ ] Lint: 0 errors, 0 warnings
- [ ] Smoke test: server boots, elevation loads, `/world-map` returns elevation data

### Phase 2 (River Flow)
- [ ] DAG algorithm implemented in WorldmapRenderer
- [ ] Topology validation passes: no cycles, all paths reach ocean
- [ ] Flow conservation test passes: inflow ≈ outflow for each hex
- [ ] River rendering proportional to accumulated flow (visual QA)
- [ ] Tributaries merge naturally (visual QA)
- [ ] No infinite loops or stuck rivers
- [ ] Lint: 0 errors, 0 warnings
- [ ] Smoke test: rivers render, match topography, no visual corruption
- [ ] Mobile verified: rivers render on mobile viewport

### Phase 3A (Combat High Ground)
- [ ] FEATURE_ELEVATION_COMBAT flag implemented and disabled by default
- [ ] Combat modifier +7% applied only when enabled
- [ ] Elevation lookup O(1) cache hit
- [ ] Battle outcome logging complete
- [ ] Error codes defined: ELEVATION_LOOKUP_FAILED, INVALID_ELEVATION_DIFFERENCE, COMBAT_LOCKED
- [ ] Concurrency: SELECT...FOR UPDATE on both kingdoms during combat
- [ ] Transaction atomicity: if crash, entire transaction rolls back
- [ ] Rollback procedure tested: disable flag, code reverts, no player data loss
- [ ] PvP balance test: +7% bonus feels fair (1-2 weeks playtesting)
- [ ] No lint warnings
- [ ] Smoke test: combat calculates correctly, logging works, feature flag toggles

### Phase 3B (Movement + Fatigue)
- [ ] FEATURE_ELEVATION_MOVEMENT flag implemented and disabled by default
- [ ] Movement penalty -30% applied when enabled
- [ ] Elevation fatigue: 1 point per 10 units uphill
- [ ] Pathfinding A* with elevation cost (no dead zones)
- [ ] Error codes defined: ELEVATION_PATHFINDING_FAILED, MOVEMENT_DEAD_ZONE, INSUFFICIENT_MOVEMENT_POINTS
- [ ] Combined bonus cap enforced: elevation + terrain + unit type <= +15%
- [ ] Rollback procedure tested: disable flag, old pathfinding restored
- [ ] No lint warnings
- [ ] Smoke test: movement costs calculate, A* finds routes, no dead zones

### Phase 3C (Spells + Siege)
- [ ] FEATURE_ELEVATION_SPELLS flag implemented and disabled by default
- [ ] Spell LOS elevation check implemented (Bresenham + elevation)
- [ ] Siege HP bonus +10% applied when enabled
- [ ] Error codes defined: SPELL_LOS_BLOCKED, ELEVATION_ADVANTAGE_REQUIRED
- [ ] LOS test from valley: spells blocked correctly
- [ ] LOS test from peak: spells succeed
- [ ] Rollback procedure tested: disable flag, spells unblock
- [ ] No lint warnings
- [ ] Smoke test: spell LOS works, siege feels meaningful, no invisible no-cast zones

### Full Balance & Integration
- [ ] 8-hour gameplay test with all flags enabled (no crashes, no balance issues)
- [ ] Save compatibility verified: existing kingdoms migrate without data loss
- [ ] Mobile viewport verified: all features work on phone/tablet
- [ ] Desktop viewport verified: all features work on desktop
- [ ] Performance benchmarks pass: elevation lookup < 1ms, generation < 100ms
- [ ] No TODO comments in code
- [ ] All feature flags configured in config
- [ ] Telemetry logging verified (events appear in logs)
- [ ] Cache invalidation tested: server restart, world regen both clear cache
- [ ] No SQL warnings or slow queries
- [ ] Code review passed (changes meet project standards)

**Status:** Ready for release only when ALL checkboxes pass.

---

## Notes

- **Deferred Post-Beta.** This system should have been included in Fog of War Phase 1 but was not; elevation blocks organic rivers and combat depth.
- **Design Locked (Integrated Expert Feedback).** 
  - Elevation is a shared world primitive owned by generation pipeline (not client-only renderer)
  - Explicit non-overlapping elevation bands (ocean 0, coast 1–30, plains 31–90, hills 91–149, mountains 150+)
  - River generation uses concrete DAG algorithm with flow accumulation + topology validation (not ad hoc path tracing)
  - Combat uses conservative +5–10% modifier with feature flags (not full system at once) for safe post-Beta rollout
- **Feature-Flagged Rollout.** All combat phases gated behind feature flags: FEATURE_ELEVATION_COMBAT, FEATURE_ELEVATION_MOVEMENT, FEATURE_ELEVATION_SPELLS. Allows safe incremental testing and rollback if balance breaks.
- **Independent Phases.** Phase 2 (rivers) requires Phase 1 (elevation); Phase 3 (combat) is independent and can be prioritized separately.
- **Data Stability.** Elevation is deterministic; generate from world seed, store in DB after first generation. Do not regenerate (seeding drift breaks reproducibility). Add regression tests for seed stability.
- **Regression Testing.** Add explicit regression tests after Phase 1 (seed stability, terrain/elevation correlation) and Phase 2 (DAG acyclicity, flow conservation). Ensures robustness before rollout.
- **API Versioning (Minor).** Use `/api/v1/elevation/...` pattern if elevation system is ever exposed as public API (future-proofing).

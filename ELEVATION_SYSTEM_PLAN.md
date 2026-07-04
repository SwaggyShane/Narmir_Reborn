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

## Architecture

### Phase 1: Elevation Data Generation

**What:** Generate elevation values per hex during world generation using multi-octave Perlin noise.

**Implementation:**

1. **Noise Generation:**
   - Use multi-octave Perlin/Simplex noise (Fractional Brownian Motion) for natural mountain/valley distribution
   - Seed with world seed for perfect reproducibility across resets
   - Combine 3-4 octaves at decreasing amplitude for varied topography

2. **Post-Processing & Correlation:**
   - Apply terrain-type constraints to strongly correlate elevation:
     - Mountains: 150-255
     - Hills: 80-150
     - Plains/Coasts: 20-80
     - Ocean: 0 (sea level)
   - Optional: Add small random perturbation or erosion pass for extra realism

3. **Data Structure:**
   ```javascript
   {
     col, row, x, y,
     race, terrain,
     elevation,  // 0-255 (sea level to peak)
   }
   ```

**Files to modify:**
- `client/src/components/react/WorldmapRenderer.jsx` — `buildHexGrid()` function (add elevation generation)
- Server-side hex generation (if world generation is server-driven)

**Critical:** Elevation must be fully seeded with world seed to guarantee consistency across resets and client/server sync.

**Performance Note:** Precompute during world generation; elevation values are static per world.

---

### Phase 2: Organic River Flow

**What:** Rewrite river pathfinding to follow elevation downhill with flow accumulation.

**How:**
- Replace BFS pathfinding with gradient descent algorithm from peaks to ocean/lakes
- Track flow accumulation: each cell contributes to downstream cells, creating variable river width
- Allow tributaries to merge naturally based on accumulated flow
- Use Bezier or Catmull-Rom splines to smooth visual rendering without snapping to hex boundaries

**Algorithm Overview:**
1. **Flow Direction Mapping:** For each cell, find steepest downhill neighbor (8-neighbor gradient)
2. **Flow Accumulation:** Count how many uphill cells drain to each cell (flow volume indicator)
3. **Path Construction:** Trace from peaks downslope, merging tributaries at collection points
4. **Rendering:** Convert discrete hex paths to smooth curves, vary stroke width by accumulated flow

**Implementation:**
- New `buildElevationHydrology()` function to replace current `buildRiverNetwork()`
- Store flow direction and accumulation in intermediate structure (not persisted; precomputed per world boot)
- Group rivers by flow volume (major rivers vs. tributaries vs. streams)
- Render major rivers with thicker strokes, tributaries thinner

**Visual:**
- Rivers follow natural topography, not hex boundaries
- Tributary confluence visible at collection points
- Main river channels stand out from smaller streams
- Visual represents actual water flow hierarchy

**Performance Note:** Precompute flow accumulation at world generation; O(hex count) one-time cost, zero runtime cost during gameplay.

**Files:**
- `client/src/components/react/WorldmapRenderer.jsx` — Gradient descent pathfinding + flow accumulation + Bezier rendering

---

### Phase 3: Combat & Gameplay Integration

**What:** Elevation affects military engagement and exploration mechanics.

**Combat Integration:**
- **High Ground Advantage:** Defender elevation > attacker elevation → defender +12% damage reduction, attacker -10% damage output
  - Scale conservatively to avoid breaking PvP balance (NOT +50% defense)
  - Only applies if elevation difference ≥ 1 unit
- **Mountain Terrain Penalty:** Units crossing mountains suffer -30% movement speed penalty
  - Siege engines (slow units) suffer additional -15% (cumulative -45% if on mountain high ground)
  - Applies to both expeditions (exploration speed) and army movement
- **Elevation Fatigue:** Each 10 elevation units of uphill movement costs 1 fatigue point per unit
  - Downhill movement has no penalty (gravity-assisted)
- **Siege Mechanics:** Defending from mountains/hills grants +15% structure HP
  - Siege engines on flat ground can ignore castle elevation penalty by targeting siege weapons

**Spell & Targeting:**
- Line-of-sight ranges require unobstructed elevation path (can't cast over mountains to adjacent valleys without LOS breach)
- High-ground casters get +10% spell damage (elevation advantage applies to magic)
- Area effects (AoE) ignore elevation (fire-and-forget patterns)

**Exploration Mechanics:**
- Expeditions through mountains cost +50% turns vs. plains (terrain + elevation compound)
- Scout rings reveal more slowly in mountains (-20% ring-per-turn advancement)
- Mountain passes (low-elevation hex paths between peaks) become strategic chokepoints

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

---

## Technical Considerations

### Client/Server Sync
- Elevation data is **deterministic and fully seeded**, same as terrain
- No client-side elevation randomness; server authoritative on elevation for combat/movement validation
- Cache elevation grid on server startup (single O(hex count) pass)
- Client requests elevation via `/world-map` endpoint (already seeded, no extra request needed)

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

---

## Risks to Watch

1. **Elevation Consistency:** If seeding drifts (e.g., noise library version changes), worlds break. Store elevation in DB after first generation, do not regenerate.
2. **Combat Balance:** High ground advantage is +12% defense, not +50%. PvP will feel cheap if too high. Run internal balance tests before launch.
3. **Movement Pathfinding:** Elevation costs compound with terrain costs (mountains already -30%, adding elevation fatigue stacks). Test that pathfinding doesn't create movement dead-zones.
4. **Spell Targeting:** LOS elevation checking could create invisible "no-cast zones" if implementation is overzealous. Test from valley vs. peak explicitly.
5. **Data Migration:** Existing worlds pre-elevation need backfill. Plan migration script to generate elevation retroactively on first load post-launch.

---

## Suggested Implementation Order

**Order matters for stability and testing:**

1. **Phase 1 (Elevation Generation)** — Generate + validate elevation grid, test seeding consistency
2. **Visualization Layer (Optional but Recommended)** — Add SVG heatmap debug overlay; validate elevation visually on worldmap
3. **Phase 2 (Organic Rivers)** — Rewrite river pathfinding to use elevation; test visual river flow matches topography
4. **Phase 3A (Combat High Ground)** — Implement combat bonus only (+12% defense); test PvP balance with closed group
5. **Phase 3B (Movement + Fatigue)** — Add movement speed penalties and fatigue cost; test pathfinding stability
6. **Phase 3C (Spells + Advanced Mechanics)** — Add spell LOS checks and siege bonuses; test edge cases (valley casters, mountain fortresses)
7. **Full Balance Pass** — Playtest 8-hour game, validate no broken mechanics, no dead zones, siege feels meaningful

**Estimated Timeline (with concurrent testing):**
- Phase 1 + Visualization: 5-6 hours
- Phase 2: 8-10 hours
- Phase 3A-C + Balance: 12-15 hours
- **Total: ~25-31 hours**

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

- ✅ Elevation persists across world resets (seeding consistency)
- ✅ Rivers flow downhill, tributaries merge naturally
- ✅ High ground provides +12% defense bonus without breaking PvP
- ✅ Mountain movement penalties don't create dead zones
- ✅ Spell LOS elevation checks work from both peak and valley
- ✅ Sieges on mountains feel meaningfully harder (not trivial, not impossible)
- ✅ Expeditions route logically through mountain passes when available

---

## Notes

- **Deferred Post-Beta.** This system should have been included in Fog of War Phase 1 but was not; elevation blocks organic rivers and combat depth.
- **Design Locked.** Conservative combat bonuses (+12% defense, not +50%) chosen to avoid PvP imbalance.
- **Independent Phases.** Phase 3 (combat) is mechanically independent of Phase 2 (rivers); can be prioritized separately if needed.
- **Data Stability.** Elevation is deterministic; store in DB after generation to avoid regeneration drift (noise library version changes).

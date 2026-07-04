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

**What:** Generate elevation values per hex during world generation.

**How:**
- Add elevation field to hex cell structure in `buildHexGrid()`
- Use Perlin noise or similar for realistic mountain/valley distribution
- Seed elevation with world seed (consistent across resets)
- Clamp to 0-255 range (8-bit elevation)

**Data structure:**
```javascript
{
  col, row, x, y,
  race, terrain,
  elevation,  // 0-255 (sea level to peak)
}
```

**Files to modify:**
- `client/src/components/react/WorldmapRenderer.jsx` — `buildHexGrid()` function
- Server-side hex generation (if exists)

**Constraints:**
- Mountains should have high elevation (150+)
- Plains/coasts should have low elevation (20-80)
- Ocean should be 0 (sea level)
- Elevation should correlate with terrain type

---

### Phase 2: Organic River Flow

**What:** Rewrite river pathfinding to follow elevation downhill.

**How:**
- Instead of BFS between random cells, trace water flow from high to low elevation
- Use gradient descent from mountain peaks toward lakes/ocean
- Allow tributaries to merge naturally (multiple downhill paths → one main river)
- Smooth paths with Bezier curves for organic appearance

**Implementation:**
- New `buildElevationHydrology()` function to replace current `buildRiverNetwork()`
- For each high-elevation cell, trace downhill until reaching water (lake/ocean)
- Merge paths that flow into the same cell

**Visual:**
- Rivers will wind naturally, not snap to hex boundaries
- Multiple tributaries feeding main rivers
- Rivers flow logically from mountains → valleys → coast

**Files:**
- `client/src/components/react/WorldmapRenderer.jsx` — River pathfinding logic

---

### Phase 3: Combat Integration

**What:** Elevation affects military engagement.

**How:**
- High ground: +10% defense / -10% attacker damage
- Mountain terrain: -30% movement speed (siege engines slower)
- Canyon/valley: +% ambush chance
- Crossing elevation: fatigue cost per unit

**Implementation:**
- Add elevation check to combat calculation
- Modify unit movement speed based on elevation change
- Factor into spell targeting (can't cast over mountains without penalty)

**Files:**
- `server/game/combat.js` — Add elevation bonus/penalty
- `server/game/units.js` — Movement speed calculation
- `server/game/spells.js` — Range/targeting adjustments

---

## Challenges

1. **Seed consistency** — Elevation must use same seeding as terrain so it stays consistent across world resets
2. **Gameplay balance** — Need to ensure elevation advantage doesn't break PvP (high ground shouldn't be +50% defense)
3. **Exploration routing** — Pathfinding for expeditions may need elevation cost (harder to cross mountains)
4. **Performance** — Per-hex elevation math during combat could add overhead if not optimized

---

## Timeline Estimate

- **Phase 1 (elevation generation):** 3-4 hours
- **Phase 2 (organic rivers):** 6-8 hours (requires Phase 1)
- **Phase 3 (combat):** 8-10 hours

**Total:** ~20-24 hours of development

---

## Post-Implementation

Once elevation exists:
- Siege mechanics become depth-based (defend high ground)
- Exploration has terrain cost (mountains slow expeditions)
- Rivers become visual showcase of world hydrology
- Future: Settlements on high ground, natural chokepoints, map strategy depth

---

## Notes

- This should have been included in Fog of War Phase 1 (world generation)
- Current terrain colors work independently; elevation can layer on top
- Organic rivers depend entirely on Phase 1 elevation data being correct
- Combat integration is independent; could be done separately

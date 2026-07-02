# Narmir Reborn — World Map Terrain System

## Overview
Terrain adds strategic depth and visual interest to the world map. It affects **combat**, **expeditions**, **world events**, **resources**, and more, while providing tasteful pizazz through the existing SVG + GSAP setup (without going overboard).

**Goals**:
- Strategic layer that feels alive and meaningful.
- Visual enhancements that build on current layers (regions, nodes, expeditions).
- Minimal GSAP usage focused on entrance, feedback, and light ambient effects.
- Easy to extend and toggle.

**Current Foundation** (from code review):
- SVG rendering in `client/src/components/react/WorldmapRenderer.jsx` (900×650 viewBox, layered `<g class="wm-layer">`).
- Background: ocean gradient, grid, vignette, region paths with water shelves/coastlines.
- Layers: kingdoms, nodes, routes, expeditions (toggleable).
- GSAP (`client/src/utils/worldMapGsap.js`): staggered entrance, node selection (scale + halo), line draw-in/flow, pulsing, reduced-motion support.

## Terrain Types (Proposed)
Define these as an enum or similar in backend data and map generation.

- **Plains**: Fertile, open. Green hues.
- **Forest**: Dense, tactical. Dark greens.
- **Mountains**: Defensive, rugged. Browns/grays.
- **Desert**: Harsh, resource-scarce. Tans/oranges.
- **Swamp**: Mysterious, hazardous. Dark greens/browns.
- **Hills**: Balanced. Lighter greens/browns.
- **Coast**: Naval/trade potential. Blues/greens.

(Expandable later: ruins, volcanoes, etc.)

## Visual Implementation
### 1. Terrain Layer
- Add `terrain: true` to `DEFAULT_LAYERS` in `WorldmapRenderer.jsx`.
- Insert new `<g class="wm-layer wm-layer-terrain">` early in the SVG (under regions for z-order).
- Use:
  - Base fill paths/polygons per biome (color + opacity).
  - SVG `<defs><pattern>` for textures (grass, ridges, sand, reeds — lightweight and crisp).
  - Decorative elements: small grouped icons (trees, peaks, dunes) inside terrain zones for targeted animation.

**Example Pattern Sketch** (add to `<defs>`):
```svg
<pattern id="forestPattern" patternUnits="userSpaceOnUse" width="40" height="40">
  <!-- Simple tree/leaf shapes -->
</pattern>
```

### 2. Pizazz & Animations (Light GSAP)
Focus on existing utilities — extend sparingly.

- **Entrance Animation**:
  - Stagger terrain features (forests "grow" with scale + back.ease, mountains fade + slight lift).
  - Extend `animateWorldMap` or create `animateTerrainEntrance`.

- **Hover / Selection**:
  - Light scale (1.01–1.02) + saturation/glow on hovered region (reuse/extend `highlightSelectedNode`).
  - Tooltip: Terrain name + quick mechanical summary.

- **Expedition/Travel Feedback**:
  - Existing dashed line flow can vary by terrain (speed or style).
  - Small moving scout marker along path, with terrain-influenced pacing.

- **Ambient (Optional, Minimal)**:
  - Gentle tree sway in forests (slow yoyo scale/rotate on select elements).
  - Water shimmer or dune shift — only one or two low-intensity loops.
  - Always gate with `prefersReducedMotion()`.

- **Reveal / Dynamic**:
  - New terrain or event changes: quick pop or dissolve animation.

**Performance Note**: Keep decorative elements sparse. Use groups and CSS classes for easy targeting.

### 3. Layer & UI Integration
- Add terrain toggle in `WorldmapPanel.jsx` controls.
- Respect existing `layerVisibilityStyle`.
- Optional filters (e.g., fog/blight overlay that can be applied dynamically over terrain).

## Gameplay Mechanics
Terrain should influence multiple systems for depth.

### Combat
- **Modifiers**:
  - Mountains: Defender +15–25% defense, attacker movement penalty.
  - Forest: Ambush/flanking bonuses, higher covert success.
  - Desert: Attrition or fatigue for attackers.
  - Plains: Speed/mobility bonus.
- Special events or battle report flavor based on terrain.

### Expeditions & Exploration
- **Path Costs**: Terrain types add multipliers to travel time/success (plains fast, mountains slow).
- **Rewards**: Bonus loot or resources in matching terrain (e.g., ancient artifacts in mountains).
- Visual: Lanes highlight terrain difficulty.

### World Events
- **Biasing**: Terrain increases probability of related events (sandstorms in desert, ambushes in forest, etc.).
- **Dynamic Changes**: Events can temporarily modify terrain visuals/effects (e.g., blight overlay reducing bonuses).

### Resources & Economy
- Nodes in fertile terrain (plains/forest) yield more.
- Kingdom expansion or building bonuses based on local terrain.
- Racial synergies (e.g., Dwarves thrive in mountains).

### Other Systems
- Scouting difficulty / fog of war.
- Happiness or starting advantages.
- Future: Seasons that shift terrain effects visually and mechanically.

## Data Model Suggestions
- Assign `terrain` to regions, nodes, or coordinate-based tiles.
- Store in DB alongside map data.
- Example: `{ regionId: "...", terrain: "forest", modifiers: { combatDef: 1.2, expSpeed: 0.9 } }`

## Implementation Roadmap
1. **Data & Backend**: Define types, assign to existing map data.
2. **Core Visual Layer**: Add terrain group + basic fills/patterns in Renderer.
3. **GSAP Integration**: Extend entrance/selection in worldMapGsap.js.
4. **One Mechanic**: Wire combat or expedition modifier as proof-of-concept.
5. **Polish & Toggle**: UI controls, tooltips, layer visibility.
6. **Iteration**: Add decorations, more mechanics, dynamic events.

## Potential Challenges & Mitigations
- **Performance**: Limit decorative SVGs; test with many nodes.
- **Balance**: Start conservative with modifiers; tune via existing test harnesses.
- **Mobile**: Ensure SVG scales well with existing pan/zoom.
- **Art Style**: Keep consistent with current dark/ocean theme — subtle, not cartoonish.

## Future Expansions
- Procedural map generation with terrain biomes.
- Player influence on terrain (terraforming?).
- Seasonal cycles with visual transitions.
- More biomes or special terrain (ruins, magical zones).

---

**Next Steps Recommendation**: Start with the visual terrain layer + entrance animation, then hook into expeditions or combat. This will feel impactful quickly.

This doc can live in `/docs/` or root. Update as implemented and move completed parts to ARCHIVAL.md.
## Handoff History (Condensed & Cleaned)

**Phase 0 (Grok lane)**: Delivered the authoritative spec ("Phase 0 Grok-Led Deliverables" section above) including:
- Data model (resource_nodes.terrain + computed on kingdoms via race)
- TERRAIN_DATA with conservative modifiers
- Exact RACE_TO_TERRAIN bootstrap mapping
- File-by-file implementation targets and acceptance criteria for Phase 1

**Phase 1 Implementation (Claude lane)**:
- Core changes landed in commit 6fe14654: new game/terrain.js, schema column + backfill, route updates for /world-map and /scout-node, basic wm-layer-terrain in WorldmapRenderer (solid fills before regions), toggle in WorldmapPanel, GSAP layer support.
- Critical fix in bc1a7d72 (on feature/terrain-phase1): Fixed broken dynamic UPDATE in resolveExpeditions (was hardcoding every column to $1 + reusing $1 in WHERE, causing Postgres type error on mixed columns and transaction abort). Now uses pgSetClauseWithNextPlaceholder for correct incrementing placeholders. Verified: load-test kingdoms now advance turns; full smoke passes.

**Validation (Codex lane)**:
- 2026-07-02 03:53 UTC block: Identified the turn 500 blocker on seeded load-test runs (even baseline failed early). This was the real initial report.
- Subsequent claims of "500-turn validation complete" (around 12:00 UTC) were based on user signals rather than verifiable post-fix artifacts matching the fix commit time. Claude lane correctly flagged this gap and has not treated Phase 1 as validated on that basis.

**Current Status (as of 2026-07-02)**:
- Phase 1 code (data + basic visuals) is present on feature/terrain-phase1.
- Turn processing blocker fixed.
- Draft PR #751 open.
- A real post-fix 500-turn baseline vs. terrain comparison from Codex is still required for full validation and to unblock merge / Phase 2.
- All future lane handoffs must use the standardized template below. No more "assumed" or signal-based blocks.

**Standardized Template (use for every new update):**
```
### [GROK|CLAUDE|CODEX] UPDATE - YYYY-MM-DD HH:MM UTC
**Status:** ...
**Actions Performed:**
- ...
**Results:**
- ...
**Metrics / Key Data:**
- ...
**Observations / Issues:**
- ...
**Handoffs:**
- To Grok: ...
- To Claude: ...
- To Codex: ...
**Next for this lane:**
- ...
```

**Next Milestone**: Codex posts a genuine post-bc1a7d72 500-turn block with verifiable timestamps/numbers. Then Claude can update PR status. Grok will synthesize for Phase 2 (GSAP + first mechanic) only after that.

### GROK UPDATE - 2026-07-02 12:30 UTC
**Status:** HANDOFF HISTORY CLEANED / AWAITING GENUINE CODEX RE-RUN BLOCK
**Actions Performed:**
- Consolidated all prior overlapping/disputed lane blocks into the single condensed history above.
- Removed duplicative "assumed" updates while preserving factual milestones and the Claude lane's accurate gap flag.
- Preserved the standardized template for future use.
- Verified current verifiable artifacts (commits 6fe14654, bc1a7d72; Phase 1 files present; PR #751 referenced).
**Results:**
- The file is now a clean handshake document. No more conflicting signals in the history.
**Handoffs:**
- To Codex: Please run the baseline and terrain-labeled 500-turn passes against the landed fix (bc1a7d72) on feature/terrain-phase1. Overwrite the report/log artifacts with fresh post-fix data. Append a real CODEX UPDATE using the template above with actual numbers and timestamps.
- To Claude: The history is cleaned. When you have the real Codex block, update PR #751 status in a new CLAUDE UPDATE (template format). Do not merge Phase 1 until genuine validation + lane alignment.
- To Grok: Will draft Phase 2 (GSAP entrance + expeditions as POC mechanic) once a real Codex validation block is posted.
**Next for this lane:**
- Monitor the file for the next real CODEX UPDATE.
- If a genuine block arrives with positive validation, immediately prepare and append Phase 2 design notes.


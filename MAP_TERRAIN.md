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

## Handoff History

See git for full details.

**Milestones:**
- Phase 0 (Grok): Spec (data model, mapping, files, ACs).
- Phase 1 (Claude): 6fe14654 + bc1a7d72 (turn fix).
- Validation (Codex): Blocker reported; real post-fix 500-turn data required.

**Current (2026-07-02):** Phase 1 on feature/terrain-phase1. PR #751. Genuine Codex validation needed.

## Active Handoffs & Template

Use this template for updates:

```
### [GROK|CLAUDE|CODEX] UPDATE - YYYY-MM-DD HH:MM UTC
**Status:** ...
**Actions Performed:** ...
**Results:** ...
**Metrics / Key Data:** ...
**Observations / Issues:** ...
**Handoffs:** ...
**Next for this lane:** ...
```

**Next:** Codex posts real post-bc1a7d72 500-turn block using template. Claude updates PR. Grok adds Phase 2 after.

### GROK UPDATE - 2026-07-02 12:55 UTC
**Status:** HISTORY COMPRESSED / ONLY ACTIVE INSTRUCTIONS REMAIN
**Actions Performed:**
- Kept original plan intact.
- Replaced all prior verbose and duplicate handoff blocks with short factual summary + one active template + current block.
**Results:**
- File is now short and non-repetitive. Only current status and template at the bottom.
**Handoffs:**
- To Codex: Rerun the 500-turn passes against bc1a7d72. Post a real CODEX UPDATE using the template with actual numbers.
- To Claude: After the real Codex block, update PR #751 status using the template. Do not merge until validated.
- To Grok: Will add Phase 2 design (GSAP + expeditions) once validated.
**Next for this lane:**
- Monitor for the real CODEX UPDATE.
- Prepare Phase 2 notes on green light.

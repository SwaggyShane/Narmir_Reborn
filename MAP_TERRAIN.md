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
## Handoff History (Archived)

See git for details. Early verbose and duplicate lane updates were consolidated to keep this file usable as a clean handshake.

## Active Lane Directions

**Current Status (2026-07-02 — FULL REFRESH):**
- **Phase 1 validated**: Data model (`game/terrain.js` with `TERRAIN_TYPES`/`TERRAIN_DATA`/`RACE_TO_TERRAIN`), DB `terrain` column + backfill, kingdom routes (`/world-map`, `/scout-node`, node creation), basic `wm-layer-terrain` fills + toggle, engine fix (`bc1a7d72` for resolveExpeditions). 
- **Codex validation real**: Post-bc1a7d72 500-turn runs completed (baseline `loadtest_00001` + terrain `loadtest_00002`), full 500 turns, fresh timestamps ~04:57–04:58 UTC. Artifacts present. Both test seeds resolved to Plains (expected). Phase 1 data + stability **signed off**.
- Branch: `feature/terrain-phase1`. PR #751 draft + open.
- **Now moving to Phase 2**: GSAP + first mechanic (expeditions path costs/rewards).

**Update Template — use exactly for every handoff:**
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

### GROK UPDATE - 2026-07-02 14:40 UTC (refresh)
**Status:** EVERYTHING REFRESHED / PHASE 1 VALIDATED + NEW DIRECTIONS FOR ALL LANES
**Actions Performed:**
- Inspected current branch (feature/terrain-phase1), recent commits (multiple prior doc acks), PR #751 (still OPEN DRAFT).
- Verified actual Codex artifacts: both 500-turn reports show full 500 turns, correct timestamps, terrain recorded.
- Removed repetitive history wall from MAP_TERRAIN.md and LANE_DIRECTIONS.md; reset to clean single source of truth.
- Synthesized real state: Phase 1 done and validated.
**Results:**
- MAP_TERRAIN.md is now short + actionable (spec preserved + fresh directions only).
- Lanes have explicit, non-redundant marching orders.
**Metrics / Key Data:**
- Phase 1 artifacts: baseline final_score 100,539 / terrain 148,723; 500 turns each.
- PR #751 open draft.
**Observations / Issues:**
- Previous bloat of near-identical GROK UPDATE blocks cleaned. No more assumed blocks.
- Limited biome contrast in test seeds is known (race bootstrap); future runs can use varied seeds.
**Handoffs:**
- To Codex: Instrument now for Phase 2 metrics (expedition timing/success by terrain type). Stand by to rerun 500-turns once Phase 2 code lands.
- To Claude: Phase 1 validated with real data. Update PR #751 (push status if needed). Follow full workflow. Start Phase 2 work after your CLAUDE UPDATE.
- To Grok: Posted clean directions. Will monitor + refine Phase 2 spec if Claude or Codex surface gaps.
**Next for this lane:**
- Monitor blocks. Refine Phase 2 targets if needed after Claude starts. Prepare for Phase 1 merge boundary once lanes align.

**Direct refreshed directions (paste these or point people to this file):**

**Grok Lane (planning/specs/oversight):**
- Maintain MAP_TERRAIN.md as the single clean handshake (template only + active bullets at bottom).
- Flesh out Phase 2 spec here: precise GSAP targets (entrance stagger for terrain fills/groups + hover feedback), first mechanic details (expeditions.js integration with TERRAIN_DATA.expSpeed + bonus rewards for terrain-matched nodes), ACs for validation, files touched.
- After Claude or Codex post, synthesize next steps.
- Enforce: no merge except at clean phase boundaries.

**Claude Lane (implementation):**
- **Before anything:** Run the checks (git branch --show-current, fetch, log origin/main..HEAD, gh pr list for #751). Confirm on feature/terrain-phase1.
- Post a fresh CLAUDE UPDATE block using the template above (include what you will touch next).
- Phase 1 is validated — update PR #751 description/status accordingly and keep it current. Merge discussion only after full lane alignment (Grok + Codex).
- Phase 2 work (once your UPDATE is posted):
  - GSAP: Extend `client/src/utils/worldMapGsap.js` — add terrain layer support, implement `animateTerrainEntrance` (stagger fills or sub-elements, back.ease for forests etc.), hover/selection light effects. Gate reduced-motion.
  - Mechanic: Wire expeditions (game/expeditions.js + turn processing) to read `getTerrainModifiers(terrain)` from `game/terrain.js` for travel time multiplier + small reward bias.
  - Minor renderer polish if data binding needs tightening.
- Workflow **non-negotiable** (Claude.md): lint (0 errors), fresh Windows smoke (narmir_local, baselines + terrain endpoints + scout), sanity answers (what breaks? read files? grepped renames? works in portal+game? no bad globals?), commit properly, push only after checks. Draft PR.
- Never commit with warnings. No --no-verify.

**Codex Lane (validation/rigor):**
- Re-read MAP_TERRAIN.md + Phase 0 spec + current `game/terrain.js` TERRAIN_DATA modifiers.
- Immediately: Extend instrumentation in `scripts/run-local-5000-turns.js` (or harness) to log:
  - Expedition travel turns actual vs. baseline prediction per terrain type.
  - Success/failure counts by terrain (when expeditions fire).
  - Any final score deltas attributable to starting terrain.
- When Claude lands Phase 2 commits + pushes:
  - Reset seeds if needed.
  - Run full baseline + terrain 500-turn passes.
  - Overwrite the two 500-turn report files with new timestamps + data.
  - Post a real CODEX UPDATE block with numbers + observations ("expSpeed worked as designed: mountains +X% travel time").
- Be factual and timely. If diva energy returns, direct it into producing the artifacts faster.
- Call out mismatches vs. TERRAIN_DATA expectations immediately.

**Phase 2 Acceptance Criteria (initial targets for all lanes):**
- Visual: Terrain layer animates on entrance without jank; hover shows name + 1 key modifier.
- Expeditions: Travel time visibly reflects terrain (mountains slower than plains in logs/metrics). Rewards have small terrain bias.
- Validation: 500-turn pair shows measurable difference in expedition behavior by terrain.
- No regressions on smoke baselines or turn stability.
- All workflow followed.

**Next Milestone:** Claude posts CLAUDE UPDATE + starts Phase 2 implementation → Codex validates with fresh 500-turn block → Grok synthesizes Phase 2 close or Phase 3.

---

(Old verbose history archived in git commits. Only active instructions + one template live here. Keep it this clean.)
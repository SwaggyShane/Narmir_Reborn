# TODO

## Terrain / World Map

### File-Level Plan

1. Establish one shared terrain source of truth.
- Define map size, biome anchors, biome labels, terrain types, and placement rules in one shared module.
- Store terrain definitions server-side and treat the client as a renderer only.
- Remove duplicated kingdom-placement constants from client rendering code.

2. Formalize the biome model.
- Give each major biome a first-class definition with name, palette, anchor region, terrain traits, and gameplay modifiers.
- Keep the biome set limited and intentional.

3. Make each biome mechanically distinct.
- Mountains: defense, fortification, slower movement.
- Forests: scouting, ambushes, scribing, hidden routes.
- Plains: balanced growth and trade efficiency.
- Swamps: stealth, attrition, expedition risk.
- Desert: sparse resources with high-risk, high-reward outcomes.
- Frozen zones: travel and sustainment penalties.
- Any special endgame terrain should be deliberate, not accidental.

4. Add backend terrain helpers.
- Standardize terrain effects as a `TerrainModifierObject` in the backend.
- Keep combat and expedition calculations authoritative on the server.
- Add a validation script that fails if any `regionId` lacks a valid terrain type.

5. Connect terrain to gameplay systems.
- Resource node distribution
- Trade route value
- Combat modifiers
- Exploration outcomes
- Expedition difficulty
- Build and research emphasis

6. Refactor rendering to consume shared terrain data.
- Split `WorldmapRenderer.jsx` into smaller layers/components instead of one large renderer.
- The map renderer should not invent its own region logic.
- SVG paths and visual styling can remain client-side, but they should be driven by the shared terrain definitions.
- Use sparse SVG groups and `defs` patterns for textures instead of heavy decorative DOM.
- Keep terrain visuals under regions, nodes, and labels so legibility stays intact.

7. Preserve determinism.
- Kingdom placement must stay stable by ID.
- Resource node placement must stay stable by kingdom/node identity.
- Biome assignment should not shift between reloads or environments.

8. Add narrow tests.
- Verify terrain anchors do not drift.
- Verify kingdom coordinates stay deterministic.
- Verify biome metadata is shared consistently by server and client.
- Verify the renderer still produces the expected regions and labels.
- Add a small balance harness for combat and expedition terrain modifiers before expanding the system.

9. Consider terrain synergies only after the base system is stable.
- Add synergy effects only when the core terrain model is proven.
- Keep optional bonuses separate from the first implementation pass.

### Implementation Sequence

1. Create shared terrain data.
- Add a backend/shared terrain module for biome definitions, map anchors, and terrain types.
- Put the authoritative biome and region metadata there.

2. Add backend terrain helpers.
- Add `TerrainModifierObject` helpers in the server/game layer.
- Add validation to fail if any `regionId` is missing a valid terrain type.

3. Split the renderer.
- Break `client/src/components/react/WorldmapRenderer.jsx` into layers:
  - terrain
  - regions
  - nodes
  - routes
  - kingdom labels
- Keep the SVG visual work client-side, but driven by the shared data.

4. Remove duplicated placement logic.
- Stop redefining kingdom seeds and fallback placement in the renderer.
- Consume the shared placement helpers from one source.

5. Wire gameplay systems.
- Connect terrain to resource nodes, trade routes, combat, exploration, and expeditions.
- Keep authoritative calculations on the backend.

6. Add tests.
- Deterministic placement
- Terrain validation
- Shared biome metadata
- Renderer output sanity
- Terrain modifier balance harness

7. Add optional synergies only after the base system is stable.
- Treat terrain synergies as a later enhancement, not part of the base pass.

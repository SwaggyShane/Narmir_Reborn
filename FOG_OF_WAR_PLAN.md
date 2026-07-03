# Narmir Reborn — Fog of War + Incremental Scouting Plan

**Status:** reviewer-verified draft (Revision 6), grounded against the codebase as of `main@71b07e2` (post PR #754). **Ready for Phase 1 implementation.** Five critical gaps resolved 2026-07-03; see "Assumptions & Decisions" and "Still Open — Phase 3 Blockers" below.

---

## Implementation Readiness — 2026-07-03

Five design questions that blocked previous revisions have been locked:

✅ **Scoped visibility systems:** Scouting a hex auto-adds any kingdoms/nodes in it to `discovered_kingdoms`. One integrated system, not parallel.

✅ **Server-side gating:** ALL endpoints returning kingdom/node/expedition info (not just `/world-map`) must filter by `seen_cells`. Trade routes, diplomacy, expeditions — no leaks.

✅ **Own territory rules:** Your kingdom always visible. Your resource nodes are NOT (must be discovered). Your expeditions actively remove fog as they cross hexes. Start state: fog everywhere except your kingdom hex.

✅ **fog_of_war spell:** Enemy-cast debuff with a defined radius, no automatic tick (must be reapplied when it expires). Reduces `current` visibility, never clears `seen_cells`.

✅ **REGION_SEEDS/RACE_HOMES alignment:** Defer until Phase 1 validation gives us data. If misalignment is rare, document it; if common, realign seeds.

**Remaining open** (Phase 3 blockers, not architectural): baseline visibility radius, debuff target radius, scout cost formulas (rangers/food per hex, scaling curves), expedition reveal mechanics. Lock these after Phase 1 & 2 are complete.

---

## Current Foundation (from code review)

- **A hex grid already exists, but only client-side.** `client/src/components/react/WorldmapRenderer.jsx` (added by PR #754, the terrain redesign) contains a working hex tessellation over the 900×650 world-map canvas: `HEX_SIZE = 34`, pointy-top, odd-row ("odd-r") offset coordinates, `hexNeighborKeys(col, row)` returning `"col,row"` keys, `hexCenter(col, row) -> {x, y}`. This is the exact grid every revision of this plan has assumed exists — it does now, but it lives entirely inside a browser-only React component (JSX, Vite-bundled) that the server cannot `require()`.
- **No `pixelToHex()` exists anywhere yet**, client or server. Only the hex→pixel direction (`hexCenter`) exists. The reverse — needed to place a kingdom's continuous `map_x`/`map_y` into a hex cell for visibility checks — has not been written.
- Kingdom and resource-node placement is **continuous**, not hex-snapped: `game/world-map-coords.js` places kingdoms via seeded per-race region anchors (`REGION_SEEDS`) plus jitter, and resource nodes via polar coordinates around the kingdom. This is a **separate** seed system from `WorldmapRenderer.jsx`'s own `RACE_HOMES` (used only for hex-tessellation race assignment) — the two are not the same points today.
- `WorldmapRenderer.jsx` renders as one SVG string, not canvas.
- `discovered_kingdoms` (JSON column) and `found`/`mapped` kingdom-discovery logic already exist (`routes/kingdom-gameplay.js`) and should stay unchanged.
- `fog_of_war` already exists as a spell — an **enemy-cast** offensive debuff (`game/config.js`: tier 1, "Blinds enemy rangers for 3 turns", 3-turn duration), not a passive/self-toggle. This plan repurposes it to reduce `current` visibility radius without touching `seen_cells`; keep that framing explicit wherever the spell is referenced.
- `POST /scout-node` already exists (`routes/kingdom-gameplay.js`) — pays 500 gold to generate a random resource node. Unrelated to hex-area fog reveal; naming for this plan's action should avoid colliding with "scout-node" terminology.
- `kingdoms.id` is `SERIAL PRIMARY KEY` (integer) — any FK into a visibility table must be `INTEGER`, not `UUID`.
- Rate limiting is already categorized by route (`auth`, `turn`, `general`, `admin` — see `RATE_LIMITING_GUIDE.md`); a new scouting action should register under an existing category rather than getting a bespoke limiter.

## Summary

Add hex-based fog of war and incremental scouting on top of the existing continuous world map. Kingdom and resource-node positions remain unchanged in v1. Visibility is computed through shared hex helpers — **extracted from the hex logic `WorldmapRenderer.jsx` already has**, not reinvented — stored safely per kingdom, and rendered as an SVG overlay.

## Key Changes

- Extract `hexCenter`, `hexNeighborKeys`, and the odd-r direction tables out of `WorldmapRenderer.jsx` into a shared `game/` module so both client and server use identical hex math. Add the still-missing `pixelToHex(x, y)` there.
- Keep map geometry unchanged; the hex layer is only a visibility/scouting overlay.
- Store visibility as:
  - `seen_cells` — permanent memory.
  - `current_cells` — derived snapshot from active reveal sources, not a separate source of truth.
  - `version` and lightweight metadata for safe future evolution.
- v1 rules:
  - Frontier-only reveal. Frontier = any seen hex with at least one unseen neighbor.
  - Already-seen hexes reject with **no cost charged** (400 before any deduction) — `current_cells` refreshes automatically from active sources, so there's never a legitimate reason to pay to re-target a hex already in `seen_cells`.
  - Synchronous scouting only — no queue, no cancellation, no deferred jobs.
  - `fog_of_war` reduces current visibility only, never clears `seen_cells`.
- Render fog as an SVG layer, above terrain/world geometry but below labels and UI; respect `prefers-reduced-motion`.
- Gate hidden content **on the server**, not just visually: `GET /world-map` must not include kingdoms/nodes/expeditions outside `seen_cells` in the response payload at all — a client-side-only SVG hide is an information-disclosure bug, not fog.

## Scout Request Validation (resolved)

Every open question here was carried unaddressed through Revisions 1–4; Revision 6 closed all but one:

1. **Re-scouting an already-seen hex → reject, don't charge.** ✅ Resolved.
2. **Expedition/ranger overlap → shared allocation pool.** ⚠️ Named in Rev 6 ("enforce validation for ranger allocation") but the mechanism isn't spelled out. Recommendation: reuse the same total-vs-available validation pattern already used for engineer allocation (`build-allocation`'s `allocValidation.total + resourceTotal > k.engineers` check), applied to rangers.
3. **Queuing/cancellation → none in v1.** ✅ Resolved, stated explicitly.
4. **Rate limiting / blanket-reveal exploit → per-turn reveal budget.** ✅ Resolved — Rev 6 names this directly in Phase 3 validation (independent of request count, since reveal radius scales with rangers sent, not turn cost).

## Phases

**Initial Visibility (Locked):** Home hex only. Fog covers entire map except the kingdom's own hex cell. No baseline radius beyond home territory.

---

1. **Hex Foundation**
   - Extract `hexCenter`/`hexNeighborKeys`/direction tables from `WorldmapRenderer.jsx` into a shared `game/` module (do not reimplement independently — a second, subtly different hex system would visually misalign with the terrain tessellation already rendered).
   - Implement the missing `pixelToHex(x, y)` using fractional axial coordinates + cube rounding (naive rounding of offset coordinates directly fails near hex boundaries):
     ```javascript
     // 1. continuous (x, y) -> fractional axial (q, r)
     const r = y / (HEX_SIZE * 1.5);
     const q = (x / (HEX_SIZE * Math.sqrt(3))) - r / 2;
     // 2. axial -> fractional cube
     const cubeX = q, cubeZ = r, cubeY = -q - r;
     // 3. round to nearest integer cube, fixing up the largest-error axis
     let rx = Math.round(cubeX), ry = Math.round(cubeY), rz = Math.round(cubeZ);
     const dx = Math.abs(rx - cubeX), dy = Math.abs(ry - cubeY), dz = Math.abs(rz - cubeZ);
     if (dx > dy && dx > dz) rx = -ry - rz;
     else if (dy > dz) ry = -rx - rz;
     else rz = -rx - ry;
     // 4. rounded cube -> odd-r offset (col, row), matching hexCenter's layout
     const row = rz;
     const col = rx + (rz - (rz & 1)) / 2;
     ```
   - Validate current kingdoms and resource nodes against the hex helper output (spot-check that a kingdom's continuous coordinate lands in the hex cell it visually renders inside).
   - Tests: round-trip conversion (including near hex-boundary coordinates, where naive rounding breaks), neighbor/distance math, frontier detection.

1.5. **Randomize World Generation** (deferred, explicit scope)

   **Goal:** Remove deterministic seeding; prevent players from memorizing optimal routes across server resets.

   **Scope (locked):**
   - Kingdom placement: randomize within their race's region (keep RACE_HOMES gating for strategic structure, replace REGION_SEEDS determinism with RNG per reset)
   - Node placement: completely random per server reset (no memorizable patterns)
   - Terrain biome distribution: randomized per reset (changes which areas favor which biomes)
   - Water prohibition: enforce that no kingdoms or nodes spawn in ocean/lake hexes

   **Not in scope:**
   - Visibility system (Phase 2)
   - Scouting/exploration (Phase 3)
   - Fog rendering (Phase 4)

   **Status:** Documented here; implementation deferred post-Phase 1 fog-of-war v1 (may be inserted before Phase 2 if resources permit, or scheduled after Phase 4 ships).

   **Validation findings (2026-07-03, `scripts/validate-kingdom-hex-placement.js` against local DB, 5,000 kingdoms):**
   - **Region alignment: only 2,333/5,000 (47%) land in a hex region matching their own race.** Not a rare edge case — systemic, and concentrated almost entirely in `human` kingdoms, whose region seeds sit close enough to `dire_wolf`'s RACE_HOMES point that `nearestRaceHome`'s Voronoi assignment routinely misclassifies them. **This moves Phase 1.5's REGION_SEEDS/RACE_HOMES realignment from "if common" to confirmed-required.**
   - **Water spawns: 6/5,000 (0.12%) land in an ocean/tundra-band hex** — including kingdom #1 "Stolice" (dwarf) and the "AI Dwarf", "AI Wood Elf" kingdoms. Rare in proportion but real, and hits the primary reference kingdom used throughout dev/testing. Confirms Phase 1.5's water-spawn prohibition is necessary, not precautionary.

2. **Visibility Persistence**
   - Kingdom-scoped visibility storage using the repo's existing JSON-in-`TEXT` convention (not a separate table).
   - `seen_cells` authoritative, `current_cells` derived.
   - Row-locked (`FOR UPDATE`) writes — concurrency-safe, matching the pattern other kingdom-mutation routes in this codebase already use.
   - Register the new column in `JSON_REPAIR_SPECS.kingdoms` (`db/schema.js`) with an object fallback (e.g. `{ seen_cells: [], current_cells: [], version: 1 }`), same as every other JSON-in-`TEXT` kingdom column — this repo already runs `repairJsonRows` on startup to auto-fix corrupted/missing JSON, and skipping registration would leave this one column unprotected.
   - **Open:** define what a `version` bump actually does (recompute-on-read vs. one-time migration script) — mentioned as a field and as a test case ("version bump handling") in every revision so far, never defined as a mechanism.

3. **Scout Loop + Server Gating**
   - Reveal only frontier-adjacent cells; reject non-frontier targets.
   - Scouting a hex with kingdoms/nodes in it auto-adds them to `discovered_kingdoms`.
   - **Server-side gating (locked):** `GET /world-map`, trade routes, diplomacy endpoints, and expedition routes must all filter by `seen_cells` before leaving the server. Hiding in SVG only is an information-disclosure bug.
   - Apply turn/ranger/food costs. **Still open:** concrete formulas needed — ranger cost per hex, food cost per hex, reveal-radius-per-ranger curve, cap. These need real numbers before Phase 3 can be estimated.
   - Apply the four validation rules above.
   - Register `POST /scout-area` (or equivalent) under the existing `turn` rate-limit category.
   - Validate ranger/expedition allocation overlap using the same pattern as engineer allocation (`allocValidation.rangers + expeditionRangers > k.rangers` check).

4. **Fog Rendering**
   - SVG fog overlay in `WorldmapRenderer.jsx` (no canvas — matches how the rest of the map already renders).
   - Above terrain/world geometry, below labels/UI.
   - Unseen obscured, seen dimmed, current fully visible.
   - Respect `prefers-reduced-motion`.

5. **Expansion Hooks (deferred)**
   - Leave room for later discovery expansion (special locations, map items). Explicitly not first-build — matches `MAP_TERRAIN.md`'s own "Scouting difficulty / fog of war" listing as a future terrain-system phase.

## Test Plan

- Hex round-trip, frontier detection, ring expansion, distance math (Phase 1).
- Concurrent visibility read/write integration test (Phase 2).
- Scout validation matrix (Phase 3): valid frontier reveal, non-frontier leapfrog rejection, already-seen hex rejection with zero cost charged, ranger-pool contention with an active expedition, per-turn reveal-budget cap.
- World map render test: unseen/seen/current states, reduced-motion behavior (Phase 4).
- Regression: existing mapped kingdom interactions, trade, spells, terrain rendering, and expeditions still behave normally under fog.

## Assumptions & Decisions (Locked 2026-07-03)

**Architecture:**
- Kingdom/resource-node placement stays on the current continuous coordinate system in v1.
- Visibility persists as a kingdom-scoped JSON-in-`TEXT` column, not a separate grid table (at `HEX_SIZE = 34` over 900×650, only ~195 hex cells total — no scale concern).
- No dungeon raids, Mountain Hearts, or rare region item tables in v1.
- No scout queue or cancellation in v1.

**Visibility Rules:**
- **Scouting a hex with kingdoms/nodes in it auto-adds them to `discovered_kingdoms`.** One system, not two; simplifies client logic.
- **All endpoints returning kingdom/node/expedition data must filter by `seen_cells`.** Includes `/world-map`, trade routes, diplomacy, expedition routes — no exceptions. Server-side gating is mandatory.
- **Own kingdom always visible.** Own resource nodes are NOT — must be discovered via scouting. Active expeditions reveal fog as they cross hexes (treat as mobile reveal sources, not permanent visibility).
- **Fog of War initial state:** everywhere except own kingdom's hex.

**Spell Mechanics:**
- `fog_of_war` (enemy-cast debuff) reduces `current` visibility radius, does NOT clear `seen_cells`.
- No tick-based degradation — debuff lasts until duration expires, then must be reapplied (no auto-renewal).
- Debuff has a defined radius (e.g. "normal radius 2 hexes, debuff reduces to 0").

**Phase 1 Alignment:**
- REGION_SEEDS vs RACE_HOMES misalignment: defer decision until Phase 1 validation runs. If common, realign seeds; if rare, document as edge case.

---

## Phase 3 Blockers — RESOLVED 2026-07-03

All previously-open scout-economy numbers are now locked. Implemented in `game/scout-economy.js` and `game/ranger-allocation.js`, tested in `test/scout-economy.test.js`. Values are a playtesting starting point, not final — tune via the constants in `game/scout-economy.js`, not by changing the formula shapes below without discussion.

1. **Baseline current visibility radius** — 0 (home hex only, already locked in Phase 1/2).
2. **fog_of_war debuff radius** — 0 (total blind for the spell's 3-turn duration, no tick — must be recast to reapply once it expires).
3. **Scout cost formulas:**
   - Ranger cost: `min(rangers_sent, 1000)` (hard cap) × a level multiplier (`1 + (level-1) × 0.05`) → "effective power"
   - Reveal radius: `floor(sqrt(effective_power) / 12)` hexes of bonus splash around the targeted frontier hex (the targeted hex itself is always revealed regardless — radius 0 just means no bonus spread, not "nothing happens")
   - Food cost per hex: `50 / level_multiplier`, floored at 20 (higher-level rangers scout more cheaply)
   - No separate turn cost beyond the existing `turn` rate-limit category `/scout-area` will register under
4. **Expedition-as-reveal mechanics** — `'ahead'`: expeditions reveal fog in front of their movement (pre-move scouting), not the full route retroactively or just their current tile.
5. **Ranger/expedition allocation** — player-assigned (matches the existing engineer-allocation pattern: `validateRangerAllocation({ scouting, expeditions }, totalRangers)` in `game/ranger-allocation.js`), not an automatic priority system.
6. **Node delivery turns** (bonus, was also a Phase 1 TBD) — `ceil(distance_hexes ^ 1.2)`: turns-per-hex *increases* with distance, not flat — a node 4x farther costs more than 4x the turns.

Phase 3 (Scout Loop + Server Gating) is now unblocked and ready to estimate/start.

---

## Review Log

### CLAUDE UPDATE - 2026-07-03 00:23 UTC

Reviewed Revisions 1 through 6 of this plan against the live codebase. Summary of what changed round to round:

- **Rev 1–3**: plan claimed to reuse an existing hex grid in `WorldmapRenderer.jsx`. At the time, no hex grid existed anywhere in the codebase — kingdoms/nodes used continuous seeded-polar placement (`game/world-map-coords.js`), and `WorldmapRenderer.jsx`'s only "hex" reference was decorative region silhouettes. Flagged as a foundational blocker.
- **Rev 3 (a differently-numbered inline-pasted draft)**: proposed a dedicated `map_visibility` table with `kingdom_id UUID PRIMARY KEY REFERENCES kingdoms(id)`. `kingdoms.id` is actually `SERIAL` (integer) — this draft appears abandoned; later revisions correctly returned to a kingdom-scoped JSON column.
- **Rev 4**: reviewer-authored draft elevating scout-request validation (re-scout/expedition-overlap/queuing/rate-limiting) to blocking status, since it had gone unaddressed for three rounds.
- **Rev 6**: resolved the storage-architecture question (kingdom-scoped JSON-in-`TEXT`, confirmed), resolved re-scout rejection, resolved no-queue-in-v1, resolved the per-turn reveal budget. Ranger/expedition-overlap mechanism still soft. No concrete cost formulas in any revision's body text.
- **This session**: local `main` had drifted 39 commits behind `origin/main` (other lanes pushed PRs #749–755 directly, including #754 which added the terrain hex tessellation) — resynced before this update. Discovered `WorldmapRenderer.jsx` now contains a real, working hex grid (`HEX_SIZE = 34`, odd-r offset, `hexCenter`/`hexNeighborKeys`) matching exactly what Rev 1–3 incorrectly assumed existed. This flips the original blocker: the hex math no longer needs inventing, but it does need extracting into a server-importable module, and `pixelToHex` still needs writing since only the hex→pixel direction exists today.

Net: no architectural blockers remain. Phase 1 (renamed "Hex Foundation" here) should start with the extraction described above rather than an independent hex implementation. Remaining open items before Phase 3 can be estimated: concrete scout-cost formulas, the ranger/expedition-overlap validation mechanism, and `version`-bump semantics.

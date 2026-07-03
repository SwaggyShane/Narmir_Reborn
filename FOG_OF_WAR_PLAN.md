# Narmir Reborn — Fog of War + Incremental Scouting Plan

**Status:** reviewer-verified draft (Revision 6), grounded against the codebase as of `main@71b07e2` (post PR #754). Not yet implemented — no branch or PR exists for this feature.

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

2. **Visibility Persistence**
   - Kingdom-scoped visibility storage using the repo's existing JSON-in-`TEXT` convention (not a separate table).
   - `seen_cells` authoritative, `current_cells` derived.
   - Row-locked (`FOR UPDATE`) writes — concurrency-safe, matching the pattern other kingdom-mutation routes in this codebase already use.
   - Register the new column in `JSON_REPAIR_SPECS.kingdoms` (`db/schema.js`) with an object fallback (e.g. `{ seen_cells: [], current_cells: [], version: 1 }`), same as every other JSON-in-`TEXT` kingdom column — this repo already runs `repairJsonRows` on startup to auto-fix corrupted/missing JSON, and skipping registration would leave this one column unprotected.
   - **Open:** define what a `version` bump actually does (recompute-on-read vs. one-time migration script) — mentioned as a field and as a test case ("version bump handling") in every revision so far, never defined as a mechanism.

3. **Scout Loop**
   - Reveal only frontier-adjacent cells; reject non-frontier targets.
   - Apply turn/ranger/food costs. **Open:** no revision has stated concrete formulas — ranger cost per hex, food cost per hex, reveal-radius-per-ranger curve, and its cap all need real numbers before this phase can be estimated or balanced.
   - Apply the four validation rules above.
   - Register `POST /scout-area` (or equivalent) under the existing `turn` rate-limit category.
   - **Server-side gating is mandatory, not optional.** `GET /world-map` (`routes/kingdom-gameplay.js`) must filter kingdoms, resource nodes, and active expeditions down to `seen_cells` before the response ever leaves the server. Hiding unseen items only in the SVG overlay (`WorldmapRenderer.jsx`) is not sufficient — the raw data would still be visible in the API response to anyone inspecting network traffic, defeating the fog entirely.

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

## Assumptions

- Kingdom/resource-node placement stays on the current continuous coordinate system in v1.
- Visibility persists as a kingdom-scoped JSON-in-`TEXT` column, not a separate grid table, unless scale forces a change (at `HEX_SIZE = 34` over 900×650, the full map is only ~195 hex cells — a `Set` of short string keys, not a scale concern).
- No dungeon raids, Mountain Hearts, or rare region item tables in v1.
- No scout queue or cancellation in v1.
- `fog_of_war` modifies `current` visibility only, is enemy-cast, and never clears `seen_cells`.

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

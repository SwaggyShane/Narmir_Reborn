# Directions for Claude and Codex Lanes (Terrain System) — REFRESHED 2026-07-02

Copy/paste from this file is easy — open it in Notepad, VS Code, or any editor.

**Primary source of truth:** MAP_TERRAIN.md (read it fully on every handoff). Use the exact UPDATE template for every block.

## Current State (after refresh)
- Phase 1 (data model + basic visual layer + turn fix bc1a7d72) **validated** by real post-fix Codex 500-turn runs (baseline loadtest_00001 + terrain loadtest_00002, both 500 turns, artifacts ~04:57-04:58 UTC).
- Branch: feature/terrain-phase1
- PR #751: draft, open
- Moving to **Phase 2**: GSAP entrance/hover for terrain + first mechanic (expeditions using TERRAIN_DATA modifiers for path cost + rewards)

## For your Claude session (paste this whole section)

Read the full current `MAP_TERRAIN.md` (spec + Active Lane Directions + the one fresh GROK UPDATE).

**Before any code or commit:**
1. Run and paste:
   ```
   git branch --show-current
   git fetch origin
   git log --oneline origin/main..HEAD
   gh pr list --head feature/terrain-phase1 --state open --repo swaggyshane/narmir_reborn
   ```
2. Post a **CLAUDE UPDATE** block in MAP_TERRAIN.md using the exact template from the bottom of MAP_TERRAIN.md.

**Phase 2 implementation targets (after your UPDATE block):**
- GSAP: Extend `client/src/utils/worldMapGsap.js` (terrain layer entrance stagger + light hover). Keep minimal, respect reduced motion.
- First mechanic: Wire expeditions (game/expeditions.js + related turn paths) to use terrain modifiers from `game/terrain.js` (expSpeed for timing, small reward bias).
- Minor: Ensure renderer data binding is solid; tooltips for terrain name + 1 modifier.
- Every step: lint (0 errors), fresh Windows smoke (narmir_local DB, full baseline checks + terrain + scout endpoints), sanity checklist answers internally.
- Update PR #751 with status. Do not merge until Grok + Codex alignment. Use draft PRs.

Follow CLAUDE.md **exactly** (pre-push checks, no warnings, proper commits).

## For your Codex session (paste this whole section)

Read the full current `MAP_TERRAIN.md` (especially TERRAIN_DATA, Phase 0/1/2 targets, and Active Lane Directions).

**Immediate action:**
- Extend the 500-turn harness (`scripts/run-local-5000-turns.js` or similar) to capture:
  - Actual expedition travel time vs. predicted by terrain expSpeed.
  - Expedition success counts by terrain type.
  - Score / resource deltas tied to terrain.

When Claude pushes Phase 2 code:
- Run baseline (`loadtest_00001`) + terrain (`loadtest_00002`) 500-turn passes for real.
- Let runner overwrite the report files with fresh timestamps + full 500.
- Post a **real CODEX UPDATE** block with numbers + direct observations ("mountains showed ~20% longer travel as specified").

Use the template. Be data-only. No stale claims.

## Standardized Template (copy-paste ready)

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

Quick tips: Select with mouse, Ctrl+C / Ctrl+V. Or open this file or MAP_TERRAIN.md in an editor for easy copy.

All coordination stays in MAP_TERRAIN.md. Post blocks there.

Grok lane standing by for synthesis after your blocks.
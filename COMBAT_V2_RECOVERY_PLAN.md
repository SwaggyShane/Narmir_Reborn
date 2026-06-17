# Combat V2 Recovery Plan

**Status:** Local V2 integration and structure pass verified locally
**Scope:** Local recovery only. Do not push or write to GitHub remote.

## Vocabulary

- **Local:** This machine, this worktree, and the local development server.
- **Remote:** GitHub or any pushed branch/PR.

## Current Finding

The default live combat path in `game/engine.js` remains V1: aggregate power and percentage casualties, but a default-off V2 adapter path already exists behind `USE_COMBAT_V2=1`.

The intended Combat V2 files exist locally:

- `game/combat-new.js` - HP/DMG, injury states, wall HP helpers
- `game/combat-resolver.js` - V2 combat execution scaffold

The database schema already includes the V2 persistence fields:

- `injured_troops`
- `wall_hp`

## Git History Reference

- `74cf8ac` restored Combat V2 files for integration planning.
- `58fe554` added a feature-flag wrapper concept in `game/engine.js`.
- `2fbfed9` deleted Combat V2 files during audit cleanup; do not repeat.
- `origin/claude/combat-redesign-integration` contains useful docs and wrapper notes, but must not be merged wholesale because it would delete newer local files/assets/test harness work.

## Recovery Rule

Use old commits as reference material only. Do not cherry-pick or merge the integration branch wholesale.

## Phase 2 Tasks

- [x] Confirm V2 files exist locally
- [x] Confirm schema fields exist locally
- [x] Inspect old feature-flag wrapper
- [x] Identify that old wrapper is too shallow to copy directly
- [x] Restore useful combat redesign docs locally
- [x] Add a safe feature flag defaulted off
- [x] Add a real V2 adapter that calls `combat-resolver.executeCombat`
- [x] Preserve the V1 `resolveMilitaryAttack` output contract
- [x] Add diagnostic report fields before any balance testing resumes

## Phase 3 Tasks

- [x] Document the intended Combat V2 HP/DMG model
- [x] Document current V2 scaffold defects separately from intended design
- [x] Define required V2 diagnostics before balance testing resumes
- [x] Decide whether V2 integration should be sync/pure or route-level async
- [x] Repair first-pass V2 resolver defects before wiring the feature flag

## Phase 3 Reference

See `COMBAT_V2_MODEL.md` for the local V2 model specification.

## Phase 4 Local Repair Notes

- `game/combat-resolver.js` is now sync/pure internally; it does not await or write through `db`.
- V2 combat diagnostics now include HP budgets, DMG budgets, research inputs, race modifiers, and war-machine crew state.
- V2 war machines now honor crew requirements.
- Dwarf war-machine solo-crew unlock is level 25.
- Repelled attacks now damage the attacker more heavily instead of only damaging the defender.
- Cleric rescue logic now applies to the attacker's injured troops after an attacker victory.
- Ladder wall damage now uses attacker engineer level and requires attacker ladders.
- Thief sabotage now reduces effective defending war machines for the V2 power calculation.
- Troop level parsing now supports both numeric levels and stored `{ level, xp }` troop-level objects.
- `game/engine.js` now has a default-off `USE_COMBAT_V2=1` adapter path.
- The V2 adapter maps sent units into `combat-resolver.executeCombat` and returns the existing `resolveMilitaryAttack` contract.
- V1 remains the default combat path unless the local environment explicitly sets `USE_COMBAT_V2=1`.
- `npm run smoke:combat-v2` verifies the default V1 path, opt-in V2 adapter path, diagnostics, thief sabotage, and dwarf level-25 war-machine crew perk.
- The V2 adapter now exposes V1-compatible report aliases such as `atkFightersLost`, `defFightersLost`, `atkPower`, `defPower`, `landTransferred`, `steps`, and wall HP diagnostics.
- `npm run scenario:combat-v2` runs focused V2 named scenarios for dwarf war-machine crew thresholds, thief sabotage, ladder wall damage, cleric rescue reporting, and mage combat participation.
- Named scenarios caught and fixed a V2 gap where mages and clerics were present in diagnostics but did not contribute to military combat power.
- Local server foreground boot was verified with `USE_COMBAT_V2=1`; PostgreSQL connected and the app reached ready state.
- The real attack route's optimized SELECT list now includes V2 fields: `res_war_machines`, magic research, `injured_troops`, `wall_hp`, `wall_defense_type`, and `discovered_kingdoms`.
- `npm run route-smoke:combat-v2` creates temporary local DB kingdoms, runs V2 through the route-equivalent persistence path, applies updates with `applyKingdomUpdates`, writes a war-log detail, verifies `injured_troops`, `wall_hp`, diagnostics, and cleans up its temp rows.
- Route persistence smoke caught negative total XP on combat loss; `awardXp` now clamps total XP at zero while preserving the combat-loss penalty behavior.
- `npm run sweep:combat-v2-dwarf` runs a focused 200-run-per-case V2 dwarf/war-machine/wall sweep.
- First dwarf sweep findings: human baseline landed near 50%; dwarf without machines was not overpowered; level-24 and level-25 dwarf war-machine cases were close together; walls were present but weak in the current V2 power equation because `wall_hp * 0.1` adds only about 1,000 defender power against roughly 100,000 power armies in the sweep setup.
- First sweep recommendation: do a deliberate V2 wall/structure formula pass before broad balance testing. Do not randomly tune dwarf war machines yet.
- Structure defense pass replaced raw `wall_hp * 0.1` with a diagnostic structure budget using wall HP, defense tier, castles, guard towers, outposts, patrol rangers, wall-mounted machines, research, race modifiers, and wall/defense upgrades.
- Post-structure dwarf sweep findings: human baseline stayed near 50%; dwarf level-25 with 60 machines was 56% into no walls; fortified walls pulled that to 43% without ladders and 49% with ladders; walled defender machines held 42.5% attacker wins without thieves and 52% with thief sabotage disabling about 22 defender machines on average.
- Current structure-pass read: walls now matter without dominating the entire fight, ladders matter, and thief sabotage creates a visible tactical swing against defending machines. This is ready for broader local balance sweeps, not final tuning.
- `npm run sweep:combat-v2-broad` now runs a broad local V2 data sweep and writes JSON/Markdown reports under `test-results`.
- First broad sweep used 192 cases at 100 runs per case: open race matrix averaged 51.8% attacker wins, wall tier checks averaged 45.3%, archetype pressure checks averaged 48.3%, and no case crossed the extreme 25%/75% dominance bands.
- Broad sweep flagged citadel and machine-wall defenses as naturally defender-favored, plus high-elf mage-heavy pressure as the strongest attacker-side outlier. Treat these as observation points only; do not tune from one run.
- Broad sweep now supports reproducible runs with `--runs=N` and `--seed=name`, for example `npm run sweep:combat-v2-broad -- --runs=1000 --seed=v2-broad-002`.
- Higher-volume broad sweeps completed locally:
  - 500 runs per case, seed `v2-broad-001`, 96,000 simulated combats: race matrix 52.6%, wall tiers 46.1%, archetypes 47.9%; flagged only dark-elf covert support into machine walls and high-elf siege into citadel.
  - 1,000 runs per case, seed `v2-broad-002`, 192,000 simulated combats: race matrix 52.7%, wall tiers 45.4%, archetypes 48.2%; flagged only high-elf siege into citadel and human siege into citadel.
- Current data read: broad V2 outcomes are stable enough to continue expanding datasets. The persistent signal is citadel-level defense being meaningfully defender-favored; no high-volume run showed an extreme attacker- or defender-dominance band.
- V2 now gates normal troop weapon and armor research through `weapons_stockpile` and `armor_stockpile`. Diagnostics report equipment coverage by troop type. Fully stocked test kingdoms should remain comparable to prior broad sweeps; low-stockpile tests should now show reduced DMG/HP budgets.
- V2 now subtracts equipped weapons and armor from the troop owner's stockpile when equipped troops die, then recovers that lost gear into the defender's stockpile. Injured troops keep their gear. Scenario and route persistence smoke tests cover returned updates, defender recovery, and persisted stockpile changes.
- V2 now persists `equipment_levels` for weapon/armor quality using the same `{ level, xp, count }` shape as `troop_levels`. Captured gear keeps source quality and dilutes into the defender's weapon/armor average by count. Legacy stockpiles without metadata derive initial quality from current weapon/armor research.
- 2026-06-11 continuation verification passed locally: `npm.cmd run smoke:combat-v2`, `npm.cmd run scenario:combat-v2`, `npm.cmd run route-smoke:combat-v2`, and scoped eslint over the V2 adapter/route/harness files.
- A quick report-pipeline sanity sweep also passed with `npm.cmd run sweep:combat-v2-broad -- --runs=5 --seed=continue-sanity`, writing `test-results/combat-v2-broad-sweep-2026-06-11T06-45-52-864Z.json` and `.md`. Treat this as pipeline verification only, not balance evidence.
- 2026-06-11 integration branch `codex/combat-v2-integrate-main` was created from current `main` at `2e48192`. Combat V2 files, adapter, docs, and V2 harnesses were replayed onto the spell/hero/lore audit stack. Verification passed: `npm.cmd run smoke:combat-v2`, `npm.cmd run scenario:combat-v2`, `npm.cmd run route-smoke:combat-v2`, and scoped eslint.
- Combat V2 damage now resolves as individual in-memory unit hits instead of cumulative spillover damage pools. Healthy troops remain aggregate DB counts, but each participating unit damages one target, overkill is wasted, and surviving damaged units are persisted as individual `injured_troops` entries. Injured entries can carry equipment quality metadata so gear loss/recovery stays correct if that unit dies later.
- Critical hits were added as the V2 lethality layer. A 100-run broad smoke (`--seed=crit-smoke-v2`) kept suite win rates centered while producing about 19-21 critical hits and 1.7-1.8 critical kills per battle on average, with injuries still around 200+ per battle.
- A conservative 5% global V2 troop damage increase was added after critical hits. A 100-run broad smoke (`--seed=damage-105-smoke-v2`) kept suite win rates centered and moved average deaths from roughly 1.7-1.8 to roughly 2.0-2.3 per battle while preserving 200+ average injuries.

## Local Verification Commands

- `npm run smoke:combat-v2`
- `npm run scenario:combat-v2`
- `npm run route-smoke:combat-v2`
- `npm run sweep:combat-v2-dwarf`
- `npm run sweep:combat-v2-broad`
- `npm.cmd exec eslint routes/kingdom.js game/engine.js game/combat-resolver.js test-combat-harness/v2-adapter-smoke.js test-combat-harness/v2-scenario-runner.js test-combat-harness/v2-route-persistence-smoke.js test-combat-harness/v2-dwarf-war-machine-sweep.js test-combat-harness/v2-broad-balance-sweep.js`

## Adapter Requirements

The V2 adapter must return the same top-level shape as V1:

- `win`
- `report`
- `attackerUpdates`
- `defenderUpdates`
- `atkEvent`
- `defEvent`
- optional `shameEvent`

The V2 report must include diagnostics before balance testing:

- attacker/defender HP budget
- attacker/defender DMG budget
- killed troops by type
- injured troops by type
- cleric rescues/healing
- war machines sent and crewed
- engineers available
- ladders sent and active
- wall HP before/after

## Do Not Tune Yet

No dwarf, war-machine, mage, wall, structure, or fragment balance tuning should be treated as final until the current cleanup docs are reconciled and the latest V2 sweeps and outlier cases have been reviewed.

# Engine.js Surgical Extract Plan

**Status:** Ready to implement  
**Date:** 2026-07-22  
**Scope:** **LOCAL ONLY** — no `git push`, no origin, no PRs, no remote review until the **entire** campaign (S00–S14) is complete **and** verified on the local dev/test stack.  
**Campaign track:** **A** (turn purity first) — locked  
**Baseline:** `game/engine.js` ≈ **2724** total lines (≈2495 non-blank).  
`processTurn` starts at the live `function processTurn` marker (currently ~391). Non-turn bulk: `resolveEpicTrek`, `resolveExpeditions`, `resolveResourceHarvests`, `resolveRegions`, plus re-export barrel.

**Do not trust stored line numbers.** Before every slice, re-anchor from the live file:

```powershell
Select-String -Path game/engine.js -Pattern "function processTurn|// ── |async function resolve|module\.exports"
```

`game/TURN_PIPELINE.md` is a secondary phase-name reference only; its line map is often stale.

---

## Constraints (non-negotiable)

| Rule | Why |
|------|-----|
| No big-bang split | Merge risk; already cut in architecture docs |
| No turn-systems registry / plugins | Dead scaffolding was deleted (A3-8); would re-break pre-merge happiness→gold timing |
| `processTurn` stays **sync** | Cannot `await`; fire-and-forget DB stays at orchestration with existing retry semantics |
| Never “fix” pre-merge `k` vs `{...k,...updates}` | Gold income must still respect rebellion-written `updates.gold` |
| Production entry unchanged | `commandHandler.handle({ type: 'turn' })` → `engine.processTurn` |
| Policy B domains stay put | Forge / prestige / attunements / evolution — turn only **calls** them |
| One branch = one commit | Revert unit is a single SHA |
| No parallel extracts on `engine.js` | Sequential on local `main` only |
| **LOCAL ONLY until campaign done** | **No** `git push`, **no** `origin`, **no** PRs, **no** remote CI babysitting while slices land. All work, merges, and acceptance run on this machine. Remote is forbidden until S00–S14 are complete **and** user-confirmed local testing passes. |

---

## Goals

1. Collapse `processTurn` into an ordered **phase playlist**.
2. Move expedition/region resolvers out of `engine.js`.
3. Soften barrel gravity later (docs; no mass test rewrite).
4. Every slice independently mergeable and revertable.

**Non-goals:** balance changes, async turn, event bus, CommandHandler policy rewrite, TypeScript, deleting the export barrel.

**Released when:** code in canonical module; `engine` calls or re-exports it; acceptance green (§ Acceptance); single commit on branch.

---

## Workflow (local only)

```
extract/engine-S##-short-slug
commit: extract(engine): S## short description
```

```bash
git checkout main
git checkout -b extract/engine-S##-slug
# implement slice only
npm run lint
npm run architecture:accept
npm run check:command-boundary
npm run validate:game-tables
npm test
# + turn/expedition extras below when applicable
git add -A
git commit -m "extract(engine): S## short description"
# merge into LOCAL main only (e.g. git checkout main && git merge --ff-only extract/engine-S##-slug)
# do not open S(n+1) until S(n) is on local main
# NEVER: git push / gh pr create / origin/* updates for this campaign until complete
```

**If broken after merge:** fix-forward if trivial; else `git revert <sha>`. Never stack the next extract on a broken one.

**Commit rules:** no drive-by renames; no export renames until S14; no mid-file `require` in new modules; no gameplay intentional changes.

**Remote gate (end of campaign only):** after S14 + full local acceptance + live local turn/smoke the user accepts, *then* ask before any push. Until that moment, treat origin as out of scope.

---

## TurnContext (S00 — land once)

`game/lib/turn-context.js`:

```js
/**
 * @typedef {object} TurnContext
 * @property {object} k
 * @property {object|null} db
 * @property {object} updates
 * @property {object[]} events
 * @property {object} xpSourcesAccum   // set in prelude
 * @property {object} [happinessResult]
 * @property {object} [profiler]
 */

function createTurnContext(k, db) { /* heal JSON fields; seed updates.turn + updated_at; events=[] */ }
function mergeState(ctx) { return { ...ctx.k, ...ctx.updates }; }
function assignUpdates(ctx, partial) { Object.assign(ctx.updates, partial); }
```

**Rules:**

- Phases mutate `ctx.updates` / `ctx.events` in place.
- Pre-merge reads use `ctx.k` (or an explicit snapshot already used today).
- Merged reads use `mergeState(ctx)`.
- Attunements keep their own per-processor merge (do not fold into ctx helpers).

**Phase signature:** `function runFooPhase(ctx) { /* void */ }`

**End-state playlist (after S10):**

```js
function processTurn(k, db = null) {
  const ctx = createTurnContext(k, db);
  runPrelude(ctx);
  runIncomePhase(ctx);
  runBuildingAttunements(ctx.k, ctx.updates, ctx.events);
  runProductionPhase(ctx);
  runLoreAndBuildings(ctx);
  runUpkeepAndFlavor(ctx);
  runResearchPhase(ctx);
  runQueuesPhase(ctx);
  runTrainingAndXpPhase(ctx);
  return finalizeTurn(ctx);
}
```

Order is fixed. Names match slice cards.

---

## Golden fixtures (required for any turn-body move)

Extend `test/process-turn-regression.test.js` (do not replace).

Per turn slice:

1. Minimal fixture + fat fixture for the touched phase (research/training/build_queue/`active_effects` as needed).
2. Stabilize `Math.random` when the phase rolls.
3. Assert: sorted `updates` keys; values for keys the phase owns; event type multiset (and message text if deterministic).
4. Prefer identity vs a snapshot taken on the pre-extract base for that phase.

No new CI infrastructure required.

---

## Acceptance

**Every slice:**

```bash
npm run lint
npm run architecture:accept
npm run check:command-boundary
npm run validate:game-tables
npm test
```

**Turn body (S01–S10):** also `npm run test:systems` + phase unit tests.  
**S11–S12:** also `npm run test:systems`.  
**Live smoke (S02+, S11–S12):** clean boot; one real `processTurn` / turn on a fat local kingdom — no new response-shape warnings.

Docs alone never count as done.

---

## Target layout

```
game/
  engine.js                    # playlist + re-export barrel
  lib/
    turn-context.js            # S00
    turn-prelude.js            # S01
    turn-income.js             # S02
    turn-production.js         # S03  (not attunements)
    turn-lore-buildings.js     # S04
    turn-upkeep-flavor.js      # S05
    turn-research.js           # S06
    turn-queues.js             # S07
    turn-training-xp.js        # S08
    turn-finalize.js           # S09
    turn-pipeline.js           # S10 optional home for playlist
    expedition-resolution.js   # S11
    region-resolution.js       # S12 (or world-regions.js if natural)
    turn-attunements.js        # S13
    fire-and-forget.js         # S13
```

Do **not** use `game/systems/`.

---

## Campaign order (Track A — locked)

```
S00 → S01 → … → S10 → S11 → S12 → S13 → S14
```

(Track B — expeditions first — rejected for this campaign.)

---

## Slice cards

Re-grep markers before each slice. Marker strings below are anchors, not line contracts.

### S00 — Turn context

| | |
|--|--|
| Branch | `extract/engine-S00-turn-ctx` |
| Commit | `extract(engine): S00 add turn context helper for processTurn extracts` |
| Risk | Low |

**Do:**

1. Add `game/lib/turn-context.js` (`createTurnContext`, `mergeState`, `assignUpdates`).
2. **Wire** init only in `processTurn` (heal JSON fields + seed `updates`/`events`/`turn`/`updated_at`). No phase moves.
3. Unit test: healed fields, `updates.turn === k.turn + 1`, parity with current init.

**Out:** happiness, income, anything after init.

---

### S01 — Prelude

| | |
|--|--|
| Branch | `extract/engine-S01-turn-prelude` |
| Commit | `extract(engine): S01 extract processTurn prelude into turn-prelude.js` |
| Risk | High (evolution / happiness / rebellion order) |
| Anchor | After init → just before `// ── 1. Gold income` |

**Move:** evolution tick (+ in-memory `k.evolution_*` sync), `progressGoal` turn_taken, `xpSourcesAccum` init, happiness + fragment decay, happiness history fire-and-forget, happiness event, `rebellionCheck`.

**Preserve:** happiness-before-decay order; history not awaited; rebellion may set `updates.gold` for S02.

**Export:** `runPrelude(ctx)`.

---

### S02 — Income core

| | |
|--|--|
| Branch | `extract/engine-S02-income-core` |
| Commit | `extract(engine): S02 extract gold/mana/pop/food phases into turn-income.js` |
| Risk | Medium |
| Anchor | `// ── 1. Gold income` → end of food economy (before attunements) |

**Move:** gold + trade + `gold_income` + income event; mana; population; food economy.

**Preserve:** `goldBase = updates.gold !== undefined ? updates.gold : k.gold`; exact pre-merge vs merge reads.

**Out:** attunements, resource production (4b).

---

### S03 — Production / scout

| | |
|--|--|
| Branch | `extract/engine-S03-production-scout` |
| Commit | `extract(engine): S03 extract resource/merc/maps/scout phases into turn-production.js` |
| Risk | Medium (fire-and-forget scout) |
| Anchor | After `runBuildingAttunements` → end of scout ring (`// ── 4e-i`) |

**Move:** resource production; tavern disabled path; mercs; location maps WIP; active event tick-down; scout ring / passive finds / fog+reveal scheduling.

**Preserve:** `fireAndForgetWithRetry` on `revealRingHexes` (A3-5). Attunements stay a separate call between S02 and S03. Leave `fireAndForgetWithRetry` in engine until S13 unless this slice forces a clean util extract.

---

### S04 — Lore + free buildings

| | |
|--|--|
| Branch | `extract/engine-S04-lore-buildings` |
| Commit | `extract(engine): S04 extract lore and free building completion into turn-lore-buildings.js` |
| Risk | Low–medium (RNG) |
| Anchor | `// ── 5. Lore Events` → end of `// ── 5b. Building completion` |

**Out:** engineer build queue (S07). Fix RNG in goldens.

---

### S05 — Upkeep + flavor

| | |
|--|--|
| Branch | `extract/engine-S05-upkeep-flavor` |
| Commit | `extract(engine): S05 extract troop upkeep and happiness flavor events` |
| Risk | Medium (large threshold block + rolls) |
| Anchor | `// ── 6. Troop upkeep` → end of `// ── 6b. Happiness Threshold Events` |

Includes low-tax event (duplicate “6” label — keep behavior).

---

### S06 — Research

| | |
|--|--|
| Branch | `extract/engine-S06-research` |
| Commit | `extract(engine): S06 extract auto-research and mage research into turn-research.js` |
| Risk | Medium–high (largest pure block) |
| Anchor | `// ── 7. Auto-research` → end of `// ── 7b. Mage research` |

**Out:** section-8 library/tower **crafting** processors (S07). Fat fixture: researchers, focus, allocations, mage progress.

---

### S07 — Queues + building processors

| | |
|--|--|
| Branch | `extract/engine-S07-queues` |
| Commit | `extract(engine): S07 extract build queue, forge ticks, and building processors` |
| Risk | Medium |
| Anchor | `// ── 8. Build queue` → end of `// ── 8e. Active effects` |

**Move in exact current order:** build queue → charcoal tick → barge tick → library → legacy trade income → defense tiers → mage tower → shrines → active effects. Top-level requires in the new module (no mid-file requires).

**Out:** training (9).

---

### S08 — Training + XP

| | |
|--|--|
| Branch | `extract/engine-S08-training-xp` |
| Commit | `extract(engine): S08 extract training, racial passives, and XP milestones` |
| Risk | Medium |
| Anchor | `// ── 9. Training fields` → end of racial unlock (before EOT gold summary) |

**Depends on:** `ctx.xpSourcesAccum` from prelude.

---

### S09 — Finalize

| | |
|--|--|
| Branch | `extract/engine-S09-finalize` |
| Commit | `extract(engine): S09 extract end-of-turn finalize into turn-finalize.js` |
| Risk | Low |
| Anchor | EOT gold summary → `return { updates, events, _profileReport }` |

**Export:** `finalizeTurn(ctx)` → same return shape as today.

---

### S10 — Pipeline collapse

| | |
|--|--|
| Branch | `extract/engine-S10-pipeline` |
| Commit | `extract(engine): S10 collapse processTurn to phase playlist` |
| Risk | Low if S01–S09 complete |

`processTurn` is only ordered phase calls + finalize. Optional: `game/lib/turn-pipeline.js` with engine re-export. Same commit: update `game/TURN_PIPELINE.md` to module map. Full goldens + `npm test` + `test:systems`.

---

### S11 — Expeditions

| | |
|--|--|
| Branch | `extract/engine-S11-expeditions` |
| Commit | `extract(engine): S11 move resolveExpeditions/EpicTrek/harvests to expedition-resolution.js` |
| Risk | Medium–high (async, SQL) |
| Move | `resolveEpicTrek`, `resolveExpeditions`, `resolveResourceHarvests` |

**Live fact (2026-07-22):** third arg `engine` is used only as `engine.io` for Throne `safeEmit` chat broadcast — not as a full mutator bag. Prefer:

```js
async function resolveExpeditions(db, k, { io } = {}) { ... }
```

Keep `engine.resolveExpeditions` re-export; CommandHandler can keep `this.engine.resolveExpeditions(db, kingdom, this.engine)` if re-export adapts, or pass `{ io: this.engine.io }` — **choose the smaller blast-radius option in the slice**, preserve call-site behavior.

Top-level requires only (drop mid-function `require('./safe-socket-emit')` etc.).

---

### S12 — Regions

| | |
|--|--|
| Branch | `extract/engine-S12-regions` |
| Commit | `extract(engine): S12 move resolveRegions out of engine.js` |
| Risk | Medium (`io` / `safeEmit`) |

Home: `game/lib/region-resolution.js` or existing world-region module if it already owns this. Grep call sites; re-export from engine. No emit-name or capture-rule changes.

---

### S13 — Helpers

| | |
|--|--|
| Branch | `extract/engine-S13-turn-helpers` |
| Commit | `extract(engine): S13 relocate attunement runner and fire-and-forget helper` |
| Risk | Low |

`runBuildingAttunements` / `measureAttunement` / `fireAndForgetWithRetry` → lib modules; engine re-exports for existing tests.

---

### S14 — Export diet (docs only)

| | |
|--|--|
| Branch | `extract/engine-S14-export-diet` |
| Commit | `extract(engine): S14 document engine export diet and stop new barrel usage` |
| Risk | Low |

Comment above `module.exports` with canonical homes; note in `game/ARCHITECTURE.md`; mark this plan complete. **No** mass test rewrite, no barrel deletion, no new CI gate unless trivially free.

---

## End state

`engine.js`: domain requires + re-export barrel + `processTurn` (or one-line re-export from `turn-pipeline.js`).

CommandHandler:

```js
handleTurn(kingdom, db) {
  return this.engine.processTurn(kingdom, db);
}
```

---

## Risks

| Risk | Mitigation |
|------|------------|
| Hidden phase order deps | Relocate only; never reorder |
| Pre-merge vs merge bugs | Checklist every moved read of `k` |
| Async creep | Reject `async` phases inside `processTurn` |
| Test hits dead path | Unit-test new module; integration still hits `engine.processTurn` |
| Parallel agents | One extract branch at a time |
| Require cycles | Top-level requires; shared pure bits → `lib/` |
| S11 `engine` arg | Narrow to `{ io }` with adapter re-export |

---

## Per-slice checklist

- [ ] Single commit on branch
- [ ] Merged to **local** `main` only (no push / no PR)
- [ ] No intentional gameplay change
- [ ] Phase order unchanged
- [ ] Public `engine` export names preserved (re-export if moved)
- [ ] No new mid-file requires
- [ ] Acceptance green (§ Acceptance)
- [ ] Goldens updated if turn body moved
- [ ] `TURN_PIPELINE.md` updated on S10 (optional one-liner earlier)

---

## Progress

| ID | Slice | Status |
|----|--------|--------|
| S00 | Turn context | DONE (local) |
| S01 | Prelude | DONE (local) |
| S02 | Income | DONE (local) |
| S03 | Production / scout | DONE (local) |
| S04 | Lore / free buildings | DONE (local) |
| S05 | Upkeep / flavor | DONE (local) |
| S06 | Research | DONE (local) |
| S07 | Queues | TODO |
| S08 | Training / XP | TODO |
| S09 | Finalize | TODO |
| S10 | Pipeline | TODO |
| S11 | Expeditions | TODO |
| S12 | Regions | TODO |
| S13 | Helpers | TODO |
| S14 | Export diet | TODO |

---

## Start here

1. Branch `extract/engine-S00-turn-ctx` from clean **local** `main` (no fetch/push required for this campaign).
2. Implement S00 only; acceptance; one commit; **merge to local `main` only**.
3. Open S01 only after S00 is on local `main`.
4. Repeat through S14. **Do not push** until the full campaign is done and local testing is signed off.

### Commit subjects

```
extract(engine): S00 add turn context helper for processTurn extracts
extract(engine): S01 extract processTurn prelude into turn-prelude.js
extract(engine): S02 extract gold/mana/pop/food phases into turn-income.js
extract(engine): S03 extract resource/merc/maps/scout phases into turn-production.js
extract(engine): S04 extract lore and free building completion into turn-lore-buildings.js
extract(engine): S05 extract troop upkeep and happiness flavor events
extract(engine): S06 extract auto-research and mage research into turn-research.js
extract(engine): S07 extract build queue, forge ticks, and building processors
extract(engine): S08 extract training, racial passives, and XP milestones
extract(engine): S09 extract end-of-turn finalize into turn-finalize.js
extract(engine): S10 collapse processTurn to phase playlist
extract(engine): S11 move resolveExpeditions/EpicTrek/harvests to expedition-resolution.js
extract(engine): S12 move resolveRegions out of engine.js
extract(engine): S13 relocate attunement runner and fire-and-forget helper
extract(engine): S14 document engine export diet and stop new barrel usage
```

### Related

- `game/ARCHITECTURE.md` — mutator policy  
- `game/TURN_PIPELINE.md` — phase names / timing notes (line map often stale)  
- `game/COMMAND_COVERAGE.md` — CommandHandler vs domain routes  
- A3-8 attunement extract — mechanical extract template  

---

## Review disposition (folded in; comments removed)

| Feedback | Call | Plan change |
|----------|------|-------------|
| Strategy / TurnContext / sync playlist / single-commit | **Concur** | Kept |
| Stale ~2495 header (true total ~2724) | **Concur** | Header fixed; non-blank noted |
| Line ranges as facts | **Concur** | Re-grep mandatory; TURN_PIPELINE secondary |
| Track A vs B open | **Concur need lock** | **Track A locked**; Track B rejected |
| LOCAL ONLY; no origin until full campaign + local test sign-off | **Concur** | Scope + workflow; remote forbidden mid-campaign |
| S11 `engine` self-ref | **Concur, tightened** | Live use is `engine.io` only → `{ io }` |
| Optional dual path on S00 (“wire or not”) | **Reject soft option** | S00 **must** wire init |
| Barrel CI gate | **Defer** | S14 docs only; no new tooling unless free |
| Encoding / prose nits | **Concur** | Cleaned in rewrite |

Implementation starts with S00 when requested.

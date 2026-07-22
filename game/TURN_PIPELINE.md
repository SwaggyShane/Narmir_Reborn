# Turn Pipeline: Detailed Flow & Bottlenecks

**Purpose:** Document the exact sequence of operations during a single turn, including real measured timing and state mutation points.

**Date:** 2026-07-22 (S10 module map update). Prior rewrite 2026-07-18.

**Status:** Living reference. After the engine extract campaign (S00–S10), `processTurn` is a short playlist in `game/lib/turn-pipeline.js` (wired from `engine.processTurn`). Do not trust old line numbers in this file; use the module map below.

**Verification rule this doc follows:** every number below is either (a) measured directly from a live call into `processTurn`, with methodology shown, or (b) explicitly marked as not individually instrumented. No estimates are presented as measurements.

---

## High-Level Turn Lifecycle (verified against live route code)

```
Input: HTTP POST /api/kingdom/turn  (routes/kingdom-turn.js)
  ↓
requireAuth, requireCsrfToken
  ↓
withTurnLock(playerId) — serializes concurrent turn requests per player
  ↓
PREFETCH (outside transaction, parallel):
  - SELECT kingdom by player_id
  - loadTurnContext: region ownership, alliance, idle heroes, trade routes
      (3 independent queries run via Promise.all + 1 trade-routes query)
  ↓
TRANSACTION (db.withTransaction):
  - SELECT kingdom ... FOR UPDATE  (row lock + authoritative fresh snapshot)
  - commandHandler.handle({type:'turn'}) → engine.processTurn(lockedK, db)
      (wrapped in runWithProfiler() outside production — see "Real measured
      timing" below)
  - commitTurnResults(): applyUpdates (persist columns), hero XP batch UPDATE,
    news dedup + bulkInsertNews, kingdom-discovery flag resolution,
    commandHandler.handle({type:'expeditions'}) (resolveExpeditions + resource
    harvests), more bulkInsertNews for expedition events
  ↓
POSTFETCH (outside transaction):
  - SELECT refreshed fields expeditions may have changed via raw SQL
  - unread news COUNT
  - commandHandler.handle({type:'calculate-score'})
  ↓
structureUpdates(txUpdates) — flat DB columns → domain-shaped bag
  ↓
res.json({ ok: true, updates, events })   ← plain HTTP response, synchronous
  ↓
Client: apiCall('/api/kingdom/turn') → applyResult(data,'turn') →
        normalizeAndRouteResponse → Zustand stores → React re-render
```

**Correction from the previous version of this doc:** there is no Socket.io broadcast in this path. `routes/kingdom-turn.js` never calls `io.emit`; the client (`client/src/hooks/useGameActions.js:58` `takeTurn()`) gets the full result back as the HTTP response body and applies it directly. The old doc's "Socket.io broadcast (game:turn event)" step in the lifecycle diagram did not correspond to any code in this path — sockets are used elsewhere (chat, other players' presence, etc.), not for your own turn result.

---

## `processTurn()` — module map (S10, 2026-07-22)

Entry: `engine.processTurn(k, db)` → `game/lib/turn-pipeline.js` `processTurn(k, db, helpers)`.

Order is fixed. Pre-merge `k` vs `{...k,...updates}` semantics live inside each phase module.

| Step | Module | Function | Notes |
|------|--------|----------|--------|
| Init | `game/lib/turn-context.js` | `createTurnContext` | JSON heal + seed updates/events |
| Prelude | `game/lib/turn-prelude.js` | `runPrelude` | Evolution, goals, happiness, rebellion |
| Income | `game/lib/turn-income.js` | `runIncomePhase` | Gold, mana, pop, food |
| Attunements | `game/engine.js` | `runBuildingAttunements` | Still on engine until S13; injected into pipeline |
| Production | `game/lib/turn-production.js` | `runProductionPhase` | Resources, mercs, maps, scout (+ fire-and-forget helpers) |
| Lore / free builds | `game/lib/turn-lore-buildings.js` | `runLoreAndBuildings` | Lore drop + 5b queue completion |
| Upkeep / flavor | `game/lib/turn-upkeep-flavor.js` | `runUpkeepAndFlavor` | Troop upkeep, low tax, happiness thresholds |
| Research | `game/lib/turn-research.js` | `runResearchPhase` | Auto-research + mage research |
| Queues | `game/lib/turn-queues.js` | `runQueuesPhase` | Build queue, forge ticks, library/tower/shrine/effects |
| Training / XP | `game/lib/turn-training-xp.js` | `runTrainingAndXpPhase` | Training, racials, XP, milestones |
| Finalize | `game/lib/turn-finalize.js` | `finalizeTurn` | EOT gold, achievements, profiler end |

`resolveEpicTrek` / `resolveExpeditions` / `resolveResourceHarvests` / `resolveRegions` remain on `game/engine.js` (or later S11–S12 extracts) and are **not** part of `processTurn`.

---

## Real measured timing (A3-3)

**Methodology:** `game/profiling.js`'s `TurnProfiler` is already wired into the live `/turn` route (`routes/kingdom-turn.js:400-405`, active automatically whenever `NODE_ENV !== 'production'`) but its `_profileReport` is only `console.log`'d server-side, never returned in the HTTP response. To capture it directly, `processTurn` was called out-of-band against the live Postgres data for the most built-up real kingdom in the local database (`id=1`, "Stolice", turn 132, land 64330, 2258 total building count across all types — the largest of any kingdom on this instance), wrapped in `runWithProfiler(initProfiler(), () => engine.processTurn(k, null))`. `db=null` was passed deliberately: `processTurn`'s only DB use is fire-and-forget `.catch()`-only writes (happiness history, fog/ring discovery reveals) that are not awaited and are not part of the timed critical path, so passing `null` measures the same synchronous compute without mutating this kingdom's live history data. 8 runs were captured.

**What `TurnProfiler` actually instruments:** JSON parse/stringify time+count, synergy-lookup count, and **per-attunement** timing (`recordAttunementCall`, one entry per attunement function, storing `{count, totalTime, maxTime}`). It does **not** individually instrument the other ~20 phases (gold income, mana regen, population growth, food economy itself, lore events, building completion, troop upkeep, happiness events, auto-research, build queue, training fields, XP/milestone/racial-unlock checks) — those are only reflected in the overall `totalTime`, not broken out. That gap is a real, current limitation of the profiler, not an oversight in this doc.

**Results (8 runs, kingdom id=1, land=64330, 2258 buildings):**

| Metric | Run 1 (cold) | Runs 2–8 (steady-state) |
|---|---|---|
| `totalTime` | 62.92ms | 3.28–6.15ms (avg 4.84ms) |
| `jsonOperations.totalTime` | 0.29ms | 0.08–0.14ms |
| `synergyLookups` | 7 | 7 (constant across all 8 runs) |

Run 1's outlier is JIT warm-up (V8 compiling the code paths on first execution), not representative of a warm server process — the production server stays warm between requests, so runs 2–8 are the realistic figure.

**Per-attunement average (aggregated across all 8 runs, ms per call):**

| Attunement | avg ms | max ms |
|---|---|---|
| processMarketAttunements | 0.225 | 0.80 |
| processScoutProgress | 0.170 | 0.68 |
| processGranaryAttunements | 0.140 | 0.46 |
| processVaultAttunements | 0.135 | 0.40 |
| processLibraryAttunements | 0.123 | 0.30 |
| processWallsAttunements | 0.121 | 0.31 |
| processOutpostAttunements | 0.119 | 0.32 |
| processCastleAttunements | 0.119 | 0.40 |
| processBarracksAttunements | 0.118 | 0.31 |
| processGuardTowerAttunements | 0.116 | 0.29 |
| processTrainingAttunements | 0.113 | 0.31 |
| processMageTowerAttunements | 0.105 | 0.28 |
| processMausoleumAttunements | 0.101 | 0.29 |
| processSmithyAttunements | 0.101 | 0.28 |
| processHousingAttunements | 0.099 | 0.27 |
| processFarmAttunements | 0.098 | 0.33 |
| processShrineAttunements | 0.094 | 0.24 |
| processTavernAttunements | 0.091 | 0.25 |
| processSchoolAttunements | 0.091 | 0.28 |

Sum of the 18 attunement averages ≈ 2.1ms — roughly half of the ~4.84ms steady-state `totalTime` for this kingdom. The remaining ~2.7ms covers everything else in the function (pre-phase, gold/mana/population/food, research, training fields, XP/milestone checks) as an undifferentiated block, per the profiler gap noted above.

---

## What this means for the reported production latency

TODO.md's Problem #2 records production `/turn` latency at roughly 3000–4000ms, unmeasured at the time. The measurement above shows `processTurn`'s own synchronous compute is **single-digit milliseconds even for the single largest kingdom in the database** (2258 buildings, 18 active attunement types). That rules out the phase logic itself as the source of multi-second production latency.

Given the route code in `routes/kingdom-turn.js`, the real cost is almost certainly in the HTTP-layer I/O around `processTurn`, not inside it:
- PREFETCH: kingdom SELECT + 3 parallel context queries + trade-routes query
- TRANSACTION: `FOR UPDATE` row lock acquisition/wait, `applyUpdates` column UPDATE, hero XP batch UPDATE, news dedup SELECT + bulk INSERT, `resolveExpeditions` (a separate, unmeasured function that does its own DB reads/writes), a second bulk news INSERT
- POSTFETCH: refresh SELECT + unread-count SELECT

All of the above already have `console.time`/`console.timeEnd` markers in the live route code (`[turn] prefetch`, `[turn] transaction`, `[turn] postfetch`, `[turn-{id}] applyUpdates`, `[turn-{id}] resolveExpeditions`, etc.) but those numbers are not aggregated anywhere — they only appear in server stdout. Getting a real production latency breakdown means reading those log lines from a production request (or shipping them to structured logging), not adding more instrumentation to `processTurn`. This is a distinct, still-open item from `TODO.md`'s Problem #2 and from `project_production_turn_delay.md` in memory (which already suspected "mixed biomes or DB query issue" over compute) — this measurement is consistent with that suspicion and narrows it: the compute layer is now ruled out, the DB/transaction layer is not.

---

## State Persistence After Turn

1. `processTurn()` returns `{ updates, events, _profileReport }` — pure computation, no DB writes of its own (aside from the fire-and-forget `.catch()`-only calls noted above).
2. `commitTurnResults()` (inside the transaction) calls `applyUpdates(db, k.id, updates)` — the actual column UPDATE — plus hero XP, news, discovery-flag resolution, and expedition resolution.
3. `structureUpdates(txUpdates)` reshapes the flat updates into the domain-bag shape the client stores expect (`routes/response-structurer.js`).
4. `res.json({ ok: true, updates, events })` — synchronous HTTP response, no socket involved.
5. Client: `applyResult(data, 'turn')` → `normalizeAndRouteResponse` → per-store `receiveServerSnapshot` → React re-render.

---

## Known gaps (accurate as of this measurement, not fixed here)

- Non-attunement phases (~20 of them) have no individual timing — only attunements, JSON, and synergy lookups are instrumented by `TurnProfiler`. If a specific phase besides attunements needs isolating, that requires new instrumentation, scoped as its own task.
- `_profileReport` is computed on every non-production request but discarded after a console.log — it is not persisted, aggregated, or exposed anywhere for trend analysis.
- Production-layer latency (prefetch/transaction/postfetch) is timed in code but never captured in this doc — it needs a real production log sample, which this local measurement cannot substitute for.
- The duplicate/missing comment-label inconsistencies in `game/engine.js` listed in the phase map above are unfixed (out of scope here).

---

## What changed from the 2026-07-08 version of this doc

- Fixed line reference: `processTurn` starts at line 340, not "line 330".
- Fixed size claim: 1432 lines, not "1429 lines, 16 major phases" (the real phase count is ~35+ distinct marked sections).
- Removed the fabricated "Socket.io broadcast" step — verified not present in the actual `/turn` code path.
- Replaced every "Estimated time" range (which were never measured — confirmed by the absence of any profiling methodology in the old doc) with real measured numbers from a live call into `processTurn`, explicitly separating what is measured from what is not.
- Replaced the "Bottleneck Summary" table's guesses (e.g. "Attunement processing: 50-200ms", "Auto-research: 20-50ms") with the actual finding: attunements collectively cost ~2ms, not 50-200ms, for the largest kingdom in the database — the old numbers were off by roughly two orders of magnitude.
- Removed the "Architecture Issues" / "Next: Phase 2 Improvements" sections — those described a pre-CommandHandler architecture; `game/COMMAND_COVERAGE.md` and `game/ARCHITECTURE.md` are now the source of truth for that, and duplicating stale architecture claims here caused drift.

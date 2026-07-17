# Narmir Reborn - Prestige and Evolution

**Document version:** v1.4 - 2026-07-17  
**Status:** **Roadmap A complete** on `feature/prestige-rebirth`. **Roadmap B (dragon) complete on this branch** — module, trek egg, schema, turn hook, stacking, HTTP, Settings UI, live+HTTP tests.  
**Operator:** Sole implementer.  
**Ship model:** All or nothing - one wipe contract, one bonus table, one dragon definition. No dual V1/V2 paths.

---

## 0. Decision criteria

| Criterion | Meaning |
|-----------|---------|
| Sole implementer | Few files, no empty scaffolding, tests you maintain. |
| All or nothing | One final contract. Ship complete slices only. |
| Discipline | Real failure modes first; no gold-plating. |

### Scrutinized engineering ideas (baseline)

| Idea | Call |
|------|------|
| Thin `game/prestige/` (index, wipe, balance) | **Do** |
| Dual wipe policies / form versions | **Don't** |
| Balance numbers in `prestige/balance.js` | **Do** |
| Phase feature-flag matrix | **Don't** |
| Event bus | **Don't** - news after commit |
| Atomic TX + lock | **Do - core safety invariant** |
| Thin combat checks at dragon ship | **Do** |
| Other forms / Ember / stubs | **Don't** until a full later slice |
| Multi-gate evolution | **Final:** prestige >= 8 + `dragon_egg` + ritual |

### Review pass v1.1 (contract clarity)

| Suggestion | Call | Notes |
|------------|------|--------|
| NULL / 0 / missing edge cases | **Do** | Section 3.2-3.3 |
| Hero top-3 tie-breaker | **Do** | Level DESC, id ASC |
| Expeditions cancel no reward | **Do** | Rewards **lost** |
| Trade routes zero + table | **Do** | Plus partner cascade (v1.2) |
| Player-visible impact column | **Do** | Wipe table |
| FOR UPDATE / isolation | **Do** | Section 3.1 |
| Single combat apply + 1.05 test | **Do** | Section 3.5 |
| Data-driven wipe | **Do** | Section 3.3.1 WIPE_RULES shape |
| Risks / ship announce / ARCHIVAL | **Do** | Sections 9-11 |
| Admin-edit all constants / prestige history / ritual grace | **Defer** | |

### Architecture validation pass v1.2

| Suggestion | Call | Notes |
|------------|------|--------|
| Atomic TX + news after commit validated | **Concur** | Matches section 3.1; READ COMMITTED + FOR UPDATE serializes double-click |
| Explicit WIPE_RULES config object | **Do** | Section 3.3.1 - implement wipe.js this way |
| Schema reflection test (every kingdoms column mapped) | **Do (pragmatic)** | Every **mutable gameplay column** must be keep/zero/empty/formula/starter/side. Skip pure system columns only if listed in KEEP_OR_IGNORE whitelist with comment |
| Turn tick vs rebirth race (25 min clock) | **Do** | Both paths FOR UPDATE same kingdom row - turn already locks; rebirth must too. Section 3.1.1 |
| Global execution lock for whole turn engine | **Defer** | Row lock is enough; no global mutex for sole-impl footprint |
| Trade partner JSON cascade | **Do** | Delete routes both directions; scrub partner `active_trade_routes` in same TX |
| Isolated combat unit test (10000 -> 10500) | **Do** | Exact sample in section 3.5 |

---

## 1. Purpose

| Layer | Role |
|-------|------|
| **Prestige** | Full rebirth cost; small permanent mults; XP tax already in leveling. |
| **Evolution** | Optional endgame identity (**dragon** only). Tradeoff profile, not prestige-plus-combat. |

Principles: server-authoritative; one wipe contract; one implementation path; hard-capped mults; UI matches code; button off until A is complete.

---

## 2. Current-state audit (Roadmap A complete on branch)

| Area | Reality | Evidence |
|------|---------|----------|
| Live prestige | `game/prestige/` (balance, wipe, combat, index) | engine + route import |
| Old stubs | Removed; re-exports / comments only | special-events, `game/prestige.js`, world |
| Wipe | Full contract 3.3 + side effects in TX | `wipe.js` + live DB tests |
| Rebirth API | `POST /api/kingdom/rebirth` FOR UPDATE + TX | `routes/kingdom-gameplay.js` |
| News | Best-effort after commit | same route |
| XP tax | Wired | `game/xp.js` |
| Combat mult | Once via `applyPrestigeCombatMultiplier` | `combat-resolver.js` |
| Econ / bldCap / pop | `PRESTIGE_MODIFIERS` from balance via config re-export | economy, recruitment, population |
| Legacy trade INT | econ mult only (not +10%/rank) | `engine.js` 8d |
| unitLevelMult | No +5%/prestige stack; legendary identity only | `lib/troops.js` |
| CommandHandler | `prestige` fenced (must use HTTP rebirth) | `command-handler.js` |
| UI | Settings rebirth panel; L500 + cooldown; seeds/mults from client mirror | `OptionsPanel.jsx`, `prestigeBalance.js` |
| Admin | Mult table from client mirror | `PrestigePanel.jsx` |
| Evolution | None (Roadmap B) | - |

---

## 3. Locked design

### 3.1 Core safety invariant: atomic rebirth

**Non-negotiable for Roadmap A.**

```
withTransaction (Postgres; use db.withTransaction):
  1. Lock kingdom row: SELECT ... FOR UPDATE
     - Default pool isolation (typically READ COMMITTED) + FOR UPDATE is enough.
     - Double-click / spam: second request blocks on lock, then revalidate fails cleanly
       (level reset or cooldown after first commit).
     - Comment in route: "FOR UPDATE prevents two-tab double prestige."
  2. Revalidate canPrestige (level, cooldown, not channeling)
  3. processPrestige -> { updates, sideEffects }
  4. applyUpdates + side effects (heroes, expeditions, trade routes + partners) inside same TX
  5. COMMIT
after successful commit only:
  6. INSERT news (best-effort)
  7. JSON response with structureUpdates (client may reload)
```

**Failure recovery:**

| Failure point | Expected behavior |
|---------------|-------------------|
| canPrestige fails under lock | Rollback; 400; no state change |
| applyUpdates / related deletes throw | Rollback; 500; no prestige, no wipe |
| Commit succeeds, news INSERT fails | Prestige **stands**. Log error. Still `ok: true`. Do not un-prestige. |
| Response/socket fails after commit | Prestige stands; client reloads to sync |

News is outside kingdom-state TX. Kingdom truth > news row.

#### 3.1.1 Turn clock vs rebirth (async race)

Turn advances on a **~25 minute** wall clock (`CLAUDE.md` / CHANGELOG). A catastrophic race: turn processing uses pre-wipe buildings while a concurrent rebirth applies post-wipe seeds (or the reverse).

**Lock (required):**

| Path | Requirement |
|------|-------------|
| `/turn` (and any processTurn entry) | Already: `SELECT ... FOR UPDATE` on kingdom inside `withTransaction` (see `routes/kingdom-gameplay.js`) - **keep** |
| `/rebirth` | Same: `SELECT ... FOR UPDATE` on the same kingdom row before wipe |
| Effect | Turn and rebirth **serialize** on that row. Mid-rebirth turn waits; after rebirth commit, turn sees wiped state only |

**Do not** require a global process-wide mutex for the whole turn engine (overkill for sole implementer). Row lock is the contract.

If a future path runs processTurn **without** FOR UPDATE, that is a bug - fix that path, do not special-case prestige alone.

### 3.2 Module layout

```
game/prestige/
  index.js      # canPrestige, processPrestige
  wipe.js       # data-driven rules from section 3.3 -> updates + sideEffects
  balance.js    # gates, formulas, starter, modifiers, cooldown + rationale comments
  combat.js     # applyPrestigeCombatMultiplier ONLY (optional thin file, or export from balance)
```

`wipe.js` implements an explicit **WIPE_RULES** map (section 3.3.1). Tests import it. Comment at top: `// Contract: EVOLUTION.md section 3.3`.

After migration: delete prestige bodies from special-events, world, root prestige.js; leave a one-line comment pointing at this file.

### 3.3 Canonical wipe contract (single source of truth)

**Implement and test against this table only.**

#### Field / edge conventions

| Input shape | Rule |
|-------------|------|
| `last_prestige_turn` missing, null, undefined, or `0` | Treat as **never prestiged** for cooldown (see canPrestige) |
| `last_prestige_turn` > 0 | Cooldown applies |
| `evolution_form` / `evolution_ritual` missing or null | Treat as no evolution / not channeling |
| JSON columns missing or corrupt | After wipe: set to schema empty defaults (`{}` / `[]`), not leave corrupt |

#### Handling kinds

| Kind | Meaning |
|------|---------|
| **Keep** | Do not change field (or re-write same value) |
| **Zero** | Set numeric field to `0` |
| **Empty** | JSON/text to schema empty (`{}`, `[]`, or documented default) |
| **Formula** | Compute from new prestige / balance constants |
| **Starter** | Fixed starter building count |
| **Side** | Related table work inside same TX (heroes, expeditions, trade_routes rows + partners) |
| **Keep** (in code map) | Explicit keep entries so schema reflection tests can require full coverage |

#### 3.3.1 WIPE_RULES shape (implement this)

```js
// game/prestige/wipe.js
// Contract: EVOLUTION.md section 3.3

const STARTER = { bld_farms: 5, bld_barracks: 2, bld_schools: 1, bld_housing: 100 };

// Every kingdoms column is either in WIPE_RULES or KEEP_COLUMNS (or SIDE handled separately).
const ZERO_FIELDS = [ /* troops, resources, bld_* except starter, res_*, tools, ... */ ];
const EMPTY_JSON = {
  active_effects: '{}', // or object then stringify at apply - match applyUpdates convention
  items: '[]',
  active_trade_routes: '[]',
  // ... queues, fragments, etc.
};
const KEEP_COLUMNS = [
  'id', 'player_id', 'name', 'race', 'turn', 'maps', /* discovery, achievements, lore, ... */
];

// Formulas applied in buildWipeUpdates(k):
// newP = (k.prestige_level||0)+1
// land = 500+50*newP, gold = 25000+10000*newP, ...
// last_prestige_turn = k.turn, level=1, xp=0, starter buildings

// SIDE (same TX, not kingdom column updates alone):
// - heroes: keep top 3 level DESC, id ASC; delete rest
// - expeditions*: cancel, no reward
// - trade_routes: DELETE WHERE kingdom_id = id OR partner_id = id
// - for each deleted partner_id: scrub that kingdom's active_trade_routes JSON of this kingdom
```

**Schema reflection test (Roadmap A):** load kingdom column names (from `information_schema` or a maintained list derived from schema). Assert every column is in ZERO_FIELDS, EMPTY_JSON keys, formula/starter set, KEEP_COLUMNS, or documented IGNORE_SYSTEM (if any). Fail CI if a new column is unmapped - prevents orphaned production buildings surviving prestige.

#### Master table

| Field / domain | Kind | Detail | Player-visible impact |
|----------------|------|--------|------------------------|
| `prestige_level` | Formula | old + 1 | New prestige rank |
| `last_prestige_turn` | Formula | set to current kingdom `turn` | Starts 200-turn cooldown |
| `level` | Formula | 1 | Back to level 1 |
| `xp` | Formula | 0 | XP bar reset |
| `land` | Formula | `500 + 50 * newP` | New land (old land **gone**) |
| `gold` | Formula | `25000 + 10000 * newP` | New gold seed |
| `population` | Formula | 5000 | Pop reset |
| `food` | Formula | 25000 | Food seed |
| `mana` | Formula | 1000 | Mana seed |
| `wood`, `stone`, `iron`, `coal`, `steel` | Zero | | Resources gone |
| All troop unit columns | Zero | fighters, rangers, clerics, mages, thieves, ninjas, researchers, engineers, scribes, thralls | Army wiped |
| `war_machines`, `ballistae` | Zero | if present | Siege wiped |
| stockpiles weapons/armor/ladders | Zero | if present | Stockpiles wiped |
| tools / hammers / scaffolding / blueprints stored | Zero | | Crafting stock wiped |
| `bld_farms` | Starter | 5 | Starter farms only |
| `bld_barracks` | Starter | 2 | Starter barracks only |
| `bld_schools` | Starter | 1 | Starter school only |
| `bld_housing` | Starter | 100 | Starter housing only |
| All other `bld_*` listed below | Zero | including **castles** | Buildings gone; rebuild castles |
| Queues / progress / allocations | Empty | build, research, training, smithy, mage, shrine | Queues cleared |
| `active_effects` | Empty | `{}` or schema default | Effects cleared |
| bank deposits / related | Empty / Zero | as schema requires | Bank cleared |
| `mercenaries` | Empty | | Mercs dismissed |
| Active expeditions (all expedition tables for kingdom) | Side | **Cancel; pending rewards LOST; no grant** | Expeditions aborted, no payout |
| `trade_routes` (kingdom INT) | Zero | | Route count 0 |
| `active_trade_routes` | Empty | `[]` | |
| `trade_routes` table rows | Side | `DELETE FROM trade_routes WHERE kingdom_id = $id OR partner_id = $id` | Routes broken both ways |
| Partner kingdoms' `active_trade_routes` | Side | After delete, for each affected partner: rewrite JSON array removing entries that reference this kingdom (dead FK hygiene) | Partner UI does not point at ghost routes |
| `world_fragments`, attunement, `fragment_bonuses` | Empty | | **Fragments and attunements wiped** |
| `items` | Empty | `[]` | Inventory wiped |
| Research school / progress / upgrade JSON blobs | Empty | | Research progress wiped |
| `res_*` research levels | Zero / schema default | explicit in wipe rules | Research levels reset |
| Heroes (`heroes` table) | Side | Keep top **3** by **level DESC, id ASC** (stable tie-break); delete or soft-remove rest | At most 3 heroes kept |
| `maps` | Keep | | Maps kept |
| Fog / discovered_kingdoms | Keep | | Discovery kept |
| achievements, lore, description, cosmetics | Keep | | Meta progress kept |
| `race`, name, id, player link | Keep | | Identity kept |
| `turn` | Keep | | Calendar continues |
| `evolution_form`, `evolution_ritual` | Keep | if set; missing = none | Form persists if already evolved |

**Buildings forced to 0 (complete):**  
`bld_granaries`, `bld_outposts`, `bld_guard_towers`, `bld_armories`, `bld_vaults`, `bld_smithies`, `bld_markets`, `bld_mage_towers`, `bld_shrines`, `bld_training`, `bld_castles`, `bld_libraries`, `bld_taverns`, `bld_mausoleums`, `bld_walls`, `bld_woodyard`, `bld_lumber_camp`, `bld_sawmill`, `bld_gravel_pit`, `bld_blockfield`, `bld_stone_quarry`, `bld_open_pit`, `bld_strip_mine`, `bld_deep_mine`.

**Starter rationale (also in balance.js):**

```js
// bld_farms: 5      - food baseline; avoid instant starvation
// bld_barracks: 2   - minimal military presence
// bld_schools: 1    - can restart research
// bld_housing: 100  - matches common new-kingdom housing scale
// Intent: path to self-sufficiency without old empire shell
```

**Land / gold rationale:**

```js
// land = 500 + 50*newP  - not punitive vs brand-new kingdoms; no land snowball from pre-wipe
// gold = 25000 + 10000*newP - small seed scales with commitment, not 50k*P windfall
```

**Fragments wipe is final.** Post-ship escape hatch if backlash: QoL re-attune help at P>=1 - **not** keep-all fragments without a full redesign ship. Log in ARCHIVAL.

### 3.4 canPrestige (explicit)

```js
function canPrestige(k) {
  if (!k) return false;
  if ((k.level || 0) < 500) return false;

  // Fresh / never prestiged: missing, null, or 0 => no cooldown.
  // First prestige at level >= 500 is always OK.
  const last = Number(k.last_prestige_turn);
  const lastTurn = Number.isFinite(last) ? last : 0;
  if (lastTurn > 0) {
    const turn = Number(k.turn) || 0;
    if (turn - lastTurn < PRESTIGE_COOLDOWN_TURNS) return false; // 200
  }

  const ritual = parseRitual(k.evolution_ritual); // missing/null => not channeling
  if (ritual && ritual.state === 'CHANNELING') return false;

  return true;
}
```

```js
PRESTIGE_COOLDOWN_TURNS: 200
// 200 * 25 min = 5000 min ~ 83.3 hours ~ 3.5 days wall clock
// Flat at all prestige levels
```

After success: `last_prestige_turn = k.turn` (turn kept through wipe).

### 3.5 Permanent mults and combat

| P | bldCap | econ | combat | pop |
|---|--------|------|--------|-----|
| 1 | 1.10 | 1.03 | 1.00 | 1.00 |
| 2 | 1.20 | 1.06 | 1.00 | 1.00 |
| 3 | 1.30 | 1.09 | 1.02 | 1.00 |
| 4 | 1.40 | 1.12 | 1.03 | 1.05 |
| 5 | 1.50 | 1.15 | 1.05 | 1.10 |
| 6+ | same as P5 | | | |

```js
// Why: P5 combat 1.05 is meaningful but not dominant vs gear/investment/army size.
// Econ/bldCap capped so prestige is a long-game edge, not a snowball god-mode.
// Lookup: min(prestige_level, 5)
```

Titles: 0 Mortal; 1-2 Awakened; 3-4 Bloodmarked; 5-6 Ascendant; 7-8 Primordial; 9+ Worldscarred.

**XP tax:** keep `game/xp.js` (`1 + prestige * 0.2`).

**Single combat apply site (required):**

```js
// game/prestige/combat.js
// SINGLE SOURCE OF TRUTH for prestige combat - never multiply prestige combat elsewhere.
function applyPrestigeCombatMultiplier(power, prestigeLevel) {
  const p = Math.min(Math.max(Number(prestigeLevel) || 0, 0), 5);
  const mult = (PRESTIGE_MODIFIERS[p] && PRESTIGE_MODIFIERS[p].combat) || 1.0;
  return Math.round(Number(power) * mult);
}
```

**Isolated unit test sample (required):**

```js
// basePower 10000:
//   applyPrestigeCombatMultiplier(10000, 0) === 10000
//   applyPrestigeCombatMultiplier(10000, 5) === 10500
//   10500 / 10000 === 1.05
```

Assertions:

1. Called **exactly once** per documented power aggregation in combat resolution.
2. P5 from base 10000 => **10500**; mult never above 1.05.
3. P0 => **10000**.
4. Combat path must not call the helper twice on the same intermediate power.
5. Wire into resolver; never ship dead 1.05 UI claims.

### 3.6 Evolution - dragon (Roadmap B)

**Role:** Optional **endgame identity**, not midgame progression. Prestige ladder first; dragon is a late optional form with tradeoffs.

**Intended power curve:** A well-played **P8 dragon** should be roughly competitive with a highly optimized **P5-P7 non-dragon** of similar land and investment - not a free win over the server.

Stacking:

```
1. Base army power
2. Prestige combat mult once (<= 1.05)
3. Dragon: NO second global combat %
4. Dragon-only: defenseMult (~0.92), upkeepMult (~1.10), terror vs lower P, optional hoard econ
```

Ritual: 50 turns; channel defenseMult 0.85; fail if `bld_castles < 1` at start of processTurn; abort allowed; egg consumed on start.

**Grace / warning if castles low:** Defer for post-B polish. Core B ships without grace period. Optional later: UI warn when castles == 1 during channel.

**Egg:** Primary only - epic trek rare (`dragon_egg` in trek loot / TREK_ARTIFACTS with `EGG_TREK_WEIGHT` in evolution balance). Log drop for tuning. Fallback dungeon path only if trek cannot persist items (decision gate before B coding - implement one path only).

---

## 4. Roadmap A - Prestige

### Linear order

1. `balance.js` with rationales  
2. `wipe.js` data-driven from section 3.3 + sideEffects  
3. `index.js` canPrestige + processPrestige  
4. `combat.js` single multiplier function; wire combat path  
5. CommandHandler/engine; **delete** old prestige code (comment -> this file)  
6. Route: FOR UPDATE TX path; full SELECT; side table work in TX; news after commit  
7. Schema `last_prestige_turn`  
8. Economy/housing use same mult table  
9. UI preflight then enable  
10. Admin shows live mults (read-only is enough for A)  
11. Tests  
12. Manual smoke  
13. Ship when checklist green  

### UI preflight

```
[x] Server contract on feature/prestige-rebirth
[x] Button disabled if level < 500
[x] Button disabled if last_prestige_turn > 0 and turn-last < 200
[x] Confirm dialog shows THIS prestige exact seeds (landSeed/goldSeed)
[x] Confirm lists army wipe, building wipe, fragment wipe, expedition cancel, hero keep top 3
[x] Bonus text matches balance (preview mults for next P)
[x] Success toast highlights permanent bonuses from API modifiers
[x] Failure: error toast; kingdom unchanged
[ ] Production merge / enable — operator ship decision (not auto)
```

### A - Done definition

Safe prestige; no land/building snowball; contract 3.3; UI true; one path; TX-safe; combat once; tests pass.

### A - Verification checklist

```
[x] wipe rules in code match section 3.3 (importable/assertable)
[x] land/gold formulas; castles 0; four starter buildings only
[x] last_prestige_turn 0/missing/null => first prestige OK at level >= 500
[x] last_prestige_turn > 0 => cooldown 200
[x] concurrent rebirths serialize: second fails canPrestige after first (live DB FOR UPDATE)
[x] commit OK + news fail => kingdom still prestiged (route try/catch + unit contract test)
[x] combat: applyPrestigeCombatMultiplier only; P5/P0 ratio 1.05 isolated; unitLevelMult no rank stack
[x] heroes: top 3 by level DESC, id ASC
[x] expeditions cancelled with no reward
[x] trade_routes INT 0 + active_trade_routes [] + rows deleted both kingdom_id and partner_id
[x] partner active_trade_routes scrubbed of prestiging kingdom
[x] after prestige, one turn process: no throw (live DB)
[x] API round-trip: POST rebirth -> DB state + news row (when news succeeds)
[x] schema reflection: every kingdoms column mapped keep/wipe/side
[x] rebirth and turn both FOR UPDATE same row
[x] UI preflight complete (Playwright + Settings panel)
[x] old prestige implementations removed
[x] single mult source: balance.js; config re-exports; client mirror prestigeBalance.js
[x] ladder P0→P10 mult hard-cap + titles (prestige-ladder-live-db)
[x] CommandHandler prestige fenced to HTTP rebirth only
```

---

## 5. Roadmap B - Dragon (after A)

1. Confirm trek can grant items; implement `dragon_egg` there only  
2. Thin evolution module + balance  
3. Schema form/ritual  
4. Turn hook  
5. Start ritual gates  
6. UI  
7. Stacking  
8. Tests + fixed-army budget (P8 dragon vs P5-P7 peer)  
9. Ship when complete  

### B checklist

```
[x] Egg without admin (trek primary) — dragon_egg in epic-trek artifact rolls
[x] No egg => cannot start (unit + API)
[x] castles 0 mid-channel => fail next tick (processEvolutionTurn)
[x] Success => evolution_form=dragon
[x] Prestige mult once; no second global combat % from dragon (terror/defense/upkeep/hoard only)
[x] Fixed-army ratio recorded (FIXED_ARMY_BUDGET + evolution.test.js)
[x] Schema evolution_form / evolution_ritual
[x] Turn hook processEvolutionTurn in processTurn
[x] POST /evolution/start | abort | GET /evolution
[x] Client UI for start/abort/status (Options → Dragon Evolution panel)
[x] Live DB + HTTP e2e for ritual start/abort + turn complete/fail
```

---

## 6. Out of scope

Lich/colossus/world-tree, Ember, quest gates, seasonal forms, event bus, dual wipe policies, form versions, dual egg loot paths, prestige history UI (until chosen), ritual grace period (until post-B polish), live admin editing of all balance constants (until needed).

---

## 7. Quick lock summary

| Topic | Lock |
|-------|------|
| Wipe | Section 3.3 only; data-driven in wipe.js |
| First prestige | last_prestige_turn 0/null/missing => no cooldown |
| Cooldown | 200 turns (~3.5 days) |
| Heroes | Top 3: level DESC, id ASC |
| Expeditions | Cancel, **rewards lost** |
| Trade | Zero INT + empty JSON + DELETE both sides + partner JSON scrub |
| Atomic TX | FOR UPDATE; news after commit best-effort |
| Turn vs rebirth | Both FOR UPDATE same kingdom row |
| Combat | One function; P0=10000 P5=10500 from base 10000 |
| Wipe code | WIPE_RULES / explicit maps; schema reflection test |
| Egg | Trek primary only |

---

## 8. File touch list

| Slice | Files |
|-------|--------|
| A | `game/prestige/*`, purge old prestige, command-handler, engine, rebirth route, combat consumer, OptionsPanel, PrestigePanel, schema, expedition/trade side cleanup, tests |
| B | `game/evolution/*`, epic-trek egg, schema, turn hook, client UI, tests |

---

## 9. Ship gate and ARCHIVAL

| Slice | Ship when |
|-------|-----------|
| **A** | Section 4 checklist all true |
| **B** | Section 5 checklist all true + egg non-admin |

**Immediately after A ships**, add ARCHIVAL entry with:

- Date  
- Branch / commit  
- Checklist evidence (tests run)  
- Live metrics if available: count of kingdoms by prestige_level before/after window  
- Observed issues / hotfixes  

---

## 10. Risks

| Risk | Mitigation |
|------|------------|
| Player backlash on fragment wipe | Honest confirm dialog; QoL re-attune escape hatch later without reversing wipe |
| Cooldown feels too long/short | 200 is locked for A; change only with play data + ARCHIVAL note |
| First prestige feels weak/strong | Starter kit + land/gold formulas tuned in balance.js; adjust only with evidence |
| Double prestige race | FOR UPDATE + revalidate |
| Combat double-dip | Single apply function + ratio test |
| UI ahead of server | UI preflight; button off until A green |

---

## 11. Player impact summary (for ship announcement)

Use when announcing Roadmap A:

| What changes | Player-facing |
|--------------|---------------|
| When | Kingdom level 500 (max); then 200 turns (~3.5 days) between rebirths |
| You keep | Race, maps, discovery, achievements, lore, cosmetics, top 3 heroes |
| You lose | Army, almost all buildings (incl. castles), land (replaced by seed), most resources, fragments/attunements, items, research progress, trade routes, active expeditions (no payout) |
| You gain | Prestige rank; permanent mults (capped); new land/gold/pop/food seed; starter farms/barracks/school/housing |
| Permanent mults (P1-P5) | Building caps, economy, small combat (max +5% at P5), pop housing |

Dragon (B, later): optional form with tradeoffs; requires prestige 8+, rare egg, 50-turn ritual while holding a castle.

# Forge & Lava Industry — Design Freeze (FINAL)

**Status:** **FINAL** — product design locked for implementation.  
**Last updated:** 2026-07-17  
**Internal metal id:** `tempered_steel` (UI name is race-specific)

**Scope:** Build panel upgrades, Forge tab, charcoal/steel/tempered steel, Flux-Barges, lava expeditions, volcanic hex UI, racial industry mults.

**Out of scope here:** PR plan, route names, DB migration SQL (follow this doc when coding).

---

## 1. Goals

- Mid-game industrial pillar: tools → skilled labor → forge → steel → contested lava → racial master metal.
- **Coal** = bulk fuel (charcoal). **Lava** = prestige fuel for tempered steel only.
- **Hide until available** — no greyed spoiler UI.
- Racial asymmetry: dwarves lead forge/lava; elves lead charcoal; dire wolves are intentionally weak here.
- Lava draws are hard-won (time, food, crew lock, arrival race) and pay **lava + crew XP**.

---

## 2. Build panel

### 2.1 Tabs

| Tab | Visible when | Contents |
|-----|----------------|----------|
| **Build** | Always | Buildings + footer upgrade chain |
| **Forge** | After **Forge** upgrade | Fuel (charcoal), steel, barges, crucible/lava, tempered gear |

### 2.2 Footer upgrade chain (Build tab only)

Show **only the next** upgrade. Do not preview future tiers.

| # | Name | Cost | Effect |
|---|------|------|--------|
| 1 | **Toolwright’s Yard** | Like other buildings; **heavy stone + iron** | Hammer gold cost **×0.90**; scaffolding use **×0.90** |
| 2 | **Engineers’ Lodge** | Same | Engineer XP **×1.15**; construction speed **×1.10** |
| 3 | **Forge** | Same; still stone/iron-heavy | Unlocks **Forge tab**; crucible included; **1 free Flux-Barge** |

After Forge: footer shows **Forge online**. Day-to-day industry is only on the **Forge tab**.

**Upgrade build costs (implement defaults — heavy stone/iron):**

| Upgrade | Wood | Stone | Iron | Gold | Turns |
|---------|------|-------|------|------|-------|
| Toolwright’s Yard | 500 | **2,000** | **1,500** | 50,000 | 25 |
| Engineers’ Lodge | 500 | **2,500** | **2,000** | 75,000 | 30 |
| Forge | 800 | **4,000** | **3,500** | 150,000 | 40 |

---

## 3. Production & stockpiles

### 3.1 Chains

```
Wood  →  Charcoal pit (Forge tab)  →  Coal
Iron + Coal  →  Steel  →  Steel weapons / Steel armor
Steel + Lava  →  tempered_steel  →  Racial tempered weapons / armor
```

### 3.2 Stockpiles

| Id / stock | When UI appears |
|------------|-----------------|
| `coal` | After Forge UI (column **pre-existed** — do **not** add `coal_stored`) |
| `steel` | After Forge UI (column **pre-existed** — do **not** add `steel_stored`) |
| `steel_weapons` / `steel_armor` | After Forge (never merge with iron-era weapons/armor) |
| `lava_stored` | After Forge; row may stay hidden until first lava > 0 (no empty spoiler required) |
| `tempered_steel` | When first attained |
| Tempered weapons / armor | When first attained |

**Amendment (schema):** Kingdoms already had `coal` and `steel`. Forge **reuses those columns**. Duplicate `coal_stored` / `steel_stored` must not be migrated or written.

Iron-era `weapons` / `armor` unchanged.

### 3.3 Charcoal pit (Forge tab module)

- Not a world building; section under Forge → **Fuel**.
- Unlocked with Forge.
- Each turn: consume allocated wood → produce coal.
- **Rate:** `coal_gained = floor(wood_spent × 0.25 × race_charcoal_mult)`  
  Example at mult 1.0: **40 wood → 10 coal**.
- Cap allocation by available wood; no eng level-50 gate.
- **Coal storage cap:** `5,000 + (forge related; flat 5,000 v1)`.

### 3.4 Smelt & temper recipes

| Recipe | Inputs | Output |
|--------|--------|--------|
| Smelt steel | **20 iron + 10 coal** | **1 steel** |
| Temper | **1 steel + 2 lava** | **1 tempered_steel** |

- Smelt: engineers any level; batch craft from Forge → Steel (quantity selector).
- Temper: eng level ≥ 50; Forge → Crucible.
- Race **smelt** mult on output: pay inputs for `n` batches, gain `max(1, floor(n × race_smelt_mult))` steel when `n ≥ 1` and mult > 0.
- Race **lava** mult on draw yield only (temper recipe stays 1 steel + 2 lava → 1 tempered_steel).

### 3.5 Gear craft (implement defaults)

| Product | Inputs | Notes |
|---------|--------|--------|
| Steel weapons | **5 steel + 10,000 gold** | +1 stock `steel_weapons` |
| Steel armor | **5 steel + 12,000 gold** | +1 stock `steel_armor` |
| Tempered weapons | **3 tempered_steel + 25,000 gold** | Racial name in UI |
| Tempered armor | **3 tempered_steel + 30,000 gold** | Racial name in UI |

Combat power of steel/tempered gear: wire in combat pass (not required to block economy ship); economy craft + stockpiles ship first if sliced.

### 3.6 `tempered_steel` display names

| Race | Name |
|------|------|
| High Elf | Runesteel |
| Dwarf | Stonesteel |
| Human | Crownsteel |
| Dire Wolf | Rimesteel |
| Vampire | Cruorsteel |
| Ogre | Slagmetal |
| Wood Elf | Briersteel |
| Orc | Killsteel |
| Dark Elf | Vipersteel |

Storage id always `tempered_steel`.

---

## 4. Gates

| Action | Requirement |
|--------|-------------|
| Footer upgrades | Cost + chain order |
| Charcoal / smelt steel / steel gear | Forge; engineers **any level** for smelt/gear |
| Extra Flux-Barges | Forge; eng level **≥ 50** |
| Lava draw; temper; tempered gear | Eng **≥ 50**; mage **≥ 25**; crew + barge |

Engineer level cap: **100**. Lava industrial band: eng **≥ 50**. Barge mages: **≥ 25**.

---

## 5. Flux-Barge

| Rule | Spec |
|------|------|
| First barge | Free when Forge completes |
| Max owned | **3** |
| Extra cost | **100 steel + 150,000 gold + 1,000 stone** |
| Extra build time | **20 turns** |
| Hull | **100**; destroyed at **0** (**no repair**) |
| Wear success | **−20** (5 full trips from full) |
| Wear empty-handed | **−5** |
| Cancel | **None** |
| Deploy | `deployed` barge cannot launch until return |
| Breach | **None** if crew gates met |

**Crew per launch:**

- **25 engineers**, eng level **≥ 50**
- **5 mages**, mage level **≥ 25**

**Crew commitment:** On launch, remove 25 eng + 5 mages from available pool; return on resolution only. Competes with Build queue on purpose.

---

## 6. Lava expedition

### 6.1 Targeting

- **Hex card** Draw (when eligible), or **Forge tab** map pick.
- Same Epic Trek–style **choose hex on map**; one shared launch implementation.
- Valid targets: volcanic vents passing gates.

### 6.2 Timeline

| Phase | Behavior |
|--------|----------|
| Food | Full trip (normal expedition food rules) |
| Travel | Expedition distance/terrain |
| Path fog | **Reveal hexes on route** (no-roll) |
| Path finds | Travel finds table only (while traveling) |
| Arrival | Occupied → empty-handed return; Free → claim + draw |
| On-site | **+100 turns**; no finds during draw |
| Return | Travel home |
| Cancel | None |
| Success | **Lava** + **crew XP** (§6.4). No trek end-loot table |

### 6.3 Vent state

| Rule | Spec |
|------|------|
| ACTIVE | Can be drawn; yields lava |
| DORMANT | Cannot start draw; show status on hex |
| After successful draw **resolves** (lava delivered / job complete) | Vent → **DORMANT on a real-time countdown** (see below) |
| Contestation | One kingdom on-site at a time |
| Occupation (on-site phase) | Still job-based: claim on arrival → clear when on-site draw ends (expedition state), not wall-clock |
| Lava yield (success) | **`max(1, floor(8 × race_lava_mult))`** lava |

#### Dormancy = wall clock (not turns)

**Problem with turn dormancy:** Game turns keep advancing on the server whether a player is online or not. “40 turns” becomes an opaque real-time window (and feels wrong if someone draws, goes to sleep, and wakes up to a free vent that “suddenly” cooled off on the turn clock). Dormancy must not depend on who is taking turns.

**Rule (locked):**

- Store **`dormant_until`** as an absolute timestamp (UTC) on the vent / volcanic hex.
- On successful draw resolution:  
  `dormant_until = now + 3 hours`  
  (fixed **3h** real time for all kingdoms — shared vent cooldown, not personal).
- Vent is **DORMANT** while `now < dormant_until`; else **ACTIVE**.
- Hex card shows remaining real time (e.g. *Dormant — ready in 1h 42m*), not “N turns.”
- **Unaffected by:** who is online, whose kingdom turn ran, AFK, or sleep. The clock only cares about wall time.
- Empty-handed arrival does **not** start dormancy (only a completed successful draw does).
- While a kingdom is **on-site drawing**, occupation is still the expedition lock (one at a time); dormancy starts when that **successful** job fully resolves, so the next window is predictable in real time.

### 6.4 Crew XP (final)

Award on job **resolve** (with crew return).

| Outcome | Engineer XP | Mage XP |
|---------|-------------|---------|
| Success | **10,000** | **2,500** |
| Empty-handed | **1,500** | **400** |

- Kingdom pool totals; do **not** × headcount again.
- Lodge ×1.15 on engineer grant only → success **11,500** / empty **1,725**.
- Use `awardTroopXp`; sync `engineer_level` / `engineer_xp` if that column still gates forge (mirror construction).
- No XP from smelt/steel craft/barge build in this design.

**Calibration:** ~10 successful draws per eng level at 50→51 (~102k XP); mountain ~2.5k for 25 rangers; lava eng success = 4× that class of grant for a much longer job.

---

## 7. Volcanic hex card

| Stage | Control |
|--------|---------|
| Revealed, no Forge | *“This could lead to something good.”* |
| Forge, not eligible | *“Heat sleeps here. A deeper craft might wake it.”* |
| Eligible | **Draw** |

Always show: vent ACTIVE/DORMANT, Free/Occupied — Kingdom.  
Hide Draw until eligible — never grey.

**Eligible (all):**

- Forge installed  
- Eng level ≥ 50, mage level ≥ 25  
- 25 eng + 5 mages free  
- Barge hull > 0, not deployed  
- Vent **ACTIVE**

---

## 8. Racial multipliers (final implement table)

| Race | Charcoal | Smelt | Lava / temper yield | Specialty |
|------|----------|-------|---------------------|-----------|
| Dwarf | 0.80 | 1.25 | 1.25 | Forge & lava |
| High Elf | 1.25 | 1.10 | 0.80 | Charcoal quality; armor lean |
| Wood Elf | 1.25 | 1.00 | 0.75 | Charcoal volume; ranger steel |
| Orc | 1.00 | 1.10 | 1.10 | Weapons lean |
| Ogre | 0.85 | 1.20 | 1.10 | Bulk / siege |
| Human | 1.10 | 1.10 | 1.00 | Balanced |
| Dark Elf | 0.85 | 1.05 | 1.05 | Vipersteel / covert weapons |
| Vampire | 0.95 | 1.00 | 1.00 | Thrall charcoal; ritual armor |
| Dire Wolf | 0.70 | 0.70 | 0.65 | Intentionally poor |

Lava mult applies to **draw yield** only (§6.3). Charcoal/smelt mults apply to those recipes (§3.3–3.4).

---

## 9. UI rules

1. Hide locked features; never grey spoilers.  
2. Build footer = upgrade chain only.  
3. Forge tab = Fuel / Steel / Barges / Crucible.  
4. Tempered UI populates when first earned.  
5. Two fixed hex teasers only; then Draw.

```
[ Fuel ]  [ Steel ]  [ Barges ]  [ Crucible ]
```

| Section | Contents |
|---------|----------|
| Fuel | Charcoal allocation, coal stock |
| Steel | Smelt, steel stock, steel weapons/armor |
| Barges | List + hull; queue extras (max 3) |
| Crucible | Lava; temper; tempered craft; launch map target |

---

## 10. Happy path

1. Toolwright’s Yard → Engineers’ Lodge → Forge.  
2. Forge tab: free barge; charcoal → coal → steel → steel gear.  
3. Volcanic hex → teasers until ready.  
4. Eng ≥ 50, mages ≥ 25, barge ready → Draw.  
5. Full food; path reveal + finds; arrival race; 100-turn draw or empty home.  
6. Resolve: crew XP; lava if success; hull wear.  
7. Steel + lava → tempered_steel; tempered gear when first made.

---

## 11. Canonical inventory

### Upgrades

`toolwright_yard`, `engineers_lodge`, `forge` (or `forge_level ≥ 1`)

### Stocks

`coal`, `steel` (pre-existing — no `*_stored` dupes), `tempered_steel`, `lava_stored`,  
`steel_weapons`, `steel_armor`, tempered weapons/armor fields

### Entities

- `flux_barges[]`: `{ id, integrity, status: idle | building | deployed }`
- Vent: `occupying_kingdom_id`, job id, **`dormant_until`** (UTC timestamp; ACTIVE when `now >= dormant_until` or null)
- Lava expedition: trek target, full food, path reveal + finds, crew hold, lava + XP on resolve  

### Display-only

Race → metal name string; storage remains `tempered_steel`.

---

## 12. Locked checklist (all final)

| Item | Value |
|------|--------|
| Upgrade chain | Yard → Lodge → Forge |
| Upgrade costs/turns | §2.2 table |
| Yard / Lodge effects | ×0.90 tools/scaffold; ×1.15 eng XP; ×1.10 construct |
| Charcoal | Forge tab; 0.25 wood→**`coal`** × race |
| Smelt | 20 iron + 10 **`coal`** → 1 **`steel`** |
| Temper | 1 steel + 2 lava → 1 tempered_steel |
| Gear costs | §3.5 |
| Barge | Free first; max 3; 100 steel / 150k gold / 1k stone; 20 turns |
| Hull | −20 success, −5 empty; no repair; no cancel |
| Crew | 25 eng (Lv≥50) + 5 mages (Lv≥25); full-trip reserve |
| On-site | +100 turns |
| Lava yield | max(1, floor(8 × race_lava_mult)) |
| Dormancy | **3 hours real time** after successful draw (`dormant_until` timestamp); UI shows countdown, not turns |
| XP success | Eng 10,000 / Mage 2,500 |
| XP empty | Eng 1,500 / Mage 400 |
| Path | Fog reveal + travel finds; no trek end-loot |
| UI | Hide-not-grey; two teasers; dual launch |
| Racial mults | §8 table |
| Racial names | §3.6 |

---

## 13. Implementation notes

- Reuse Epic Trek targeting, expedition food, travel finds, path fog reveal, troop XP helpers, volcanic terrain.  
- Atomic resolve: crew return, hull wear, XP, lava or empty, vent occupation/dormancy — no half state.  
- Acceptance tests and PR plan are separate work.

---

## 14. Decision summary

| Topic | Decision |
|--------|----------|
| Delivery | Build footer upgrades; industry on Forge tab |
| Charcoal | Forge tab module @ 25% wood→coal |
| Metal | Steel then tempered_steel (racial names) |
| Barge | Consumable; 1 free; max 3; fixed extra cost |
| Crew | Reserved full trip; eng+mage XP on resolve |
| Lava | No cancel; arrival race; +100; path reveal; lava + XP |
| Risk | Intentional (time, food, crew, empty race) |

---

## 15. Implementation roadmap — 2-lane parallel build

**This section is the handshake.** Everything below — field names, endpoint names, request/response shapes — is the contract both lanes build against. Neither lane waits on the other's branches to merge; they only synchronize at the final integration slice (§15.4). If a name here needs to change during implementation, update this table first and treat that as the new contract, not a silent drift.

### 15.1 Why this split

Lane A = server (`db/`, `game/`, `routes/`). Lane B = client (`client/src/`). This is not an arbitrary cut — it's the module boundary this repo already enforces (CLAUDE.md: *"Server code NEVER imports from `/client/src/`; client code NEVER imports from `/game/` or `/lib/`"*). No slice in either lane touches a file the other lane touches, at any point, so the two lanes can run fully concurrently in separate worktrees with zero merge-conflict risk. Slices *within* a lane are sequential (each builds on the previous slice's branch); slices *across* lanes are independent.

**Workflow per slice (every row below):** new branch off the latest tip of that lane → one commit → PR → quality gate (`npm run lint`, `npm test`, `npm run test:components`, and `npm run build` for Lane B) → merge → delete branch. Follow the existing PR Workflow in CLAUDE.md exactly; nothing about this feature changes that process.

### 15.2 Lane A — Server

| # | Branch | Scope | Files touched | Depends on | Status |
|---|--------|-------|----------------|------------|--------|
| A1 | `forge/a1-schema` | Migration only, no logic: upgrade flags (`toolwright_yard`, `engineers_lodge`, `forge`), stocks (`tempered_steel`, `lava_stored`, `steel_weapons`, `steel_armor`, tempered weapons/armor fields) + **reuse existing `coal`/`steel` (do not add `coal_stored`/`steel_stored`)**, `flux_barges` JSON column, vent fields (`occupying_kingdom_id`, `dormant_until`) on the volcanic hex/location data | `db/ddl.js`, `db/init-data.js`, `db/schema.js` | — | **done** — also landed on local `main` as `a499dfc6` (see §15.5) |
| A2 | `forge/a2-upgrade-chain` | Install validation + chain-order enforcement for Yard/Lodge/Forge; apply §2.2 effects (hammer ×0.90, scaffold ×0.90, eng XP ×1.15, construction ×1.10); Forge install grants first free barge (stub call into A4) | `game/config.js`, new `game/forge-upgrades.js`, `routes/kingdom-gameplay.js` | A1 | **done** — `bb8b1dc8` |
| A3 | `forge/a3-charcoal-steel` | Charcoal pit (`floor(wood × 0.25 × race_charcoal_mult)`), smelt (20 iron + 10 coal → 1 steel, race smelt mult on output), steel/tempered gear craft per §3.5 costs | new `game/forge-production.js`, `routes/kingdom-gameplay.js` | A1, A2 | **done** — `7332724a` |
| A4 | `forge/a4-flux-barge` | Barge entity (`{ id, integrity, status }`); free-barge grant hook; extra-barge build queue (100 steel/150k gold/1k stone, 20 turns); hull wear (−20 success / −5 empty); max-3 cap; deployed-lock | new `game/flux-barge.js`, `game/engine.js` (turn-tick for barge queue), `routes/kingdom-gameplay.js` | A1, A2 | **done** — `13f8711d` |
| A5 | `forge/a5-vent-dormancy` | Vent ACTIVE/DORMANT via `dormant_until` UTC compare-on-read (no cron, no turn dependency); occupation contestation (one kingdom on-site at a time); lava yield `max(1, floor(8 × race_lava_mult))` | new `game/lava-vents.js` | A1 | **done** — `536f0a35` |
| A6 | `forge/a6-lava-expedition` | Full lava-draw resolver: crew reservation (pool commit/return, mirrors `resolveEpicTrek`'s pattern), path fog-reveal + travel-finds reuse, arrival race against A5's vent state, +100-turn on-site simulate-at-resolution, all-or-nothing outcome, hull wear via A4, dormancy set via A5, XP on resolve — `awardTroopXp('mages', …)` **and** `awardTroopXp('engineers', …)` **and** `awardEngineerXp` (both engineer systems, per §6.4) | new `game/lava-expedition.js`, `game/engine.js` (resolver hookup), `routes/kingdom-gameplay.js` (`POST /api/kingdom/expedition/lava-draw`) | A1–A5 | **next** — branch off `forge/a5-vent-dormancy` (`536f0a35`) |

### 15.3 Lane B — Client

| # | Branch | Scope | Files touched | Depends on | Status |
|---|--------|-------|----------------|------------|--------|
| B1 | `forge/b1-footer-upgrade-chain` | Build-tab footer widget: show only the next available upgrade; collapse to "Forge online" once complete | `client/src/components/react/BuildPanel.jsx`, `client/src/stores/economyStore.js`, `client/src/stores/index.js` (new selectors) | — | **done** — `5259dc0a` |
| B2 | `forge/b2-forge-tab-shell` | New Forge tab, gated on `forge` flag; 4-section scaffold (Fuel/Steel/Barges/Crucible), empty sections | new `client/src/components/react/ForgeTab.jsx`, `BuildPanel.jsx` (tab registration) | B1 | **done** — `dd37d7d0` |
| B3 | `forge/b3-fuel-steel-sections` | Fuel section (charcoal wood allocation, coal stock) + Steel section (smelt batch control, steel stock, steel gear craft) | new `client/src/components/react/ForgeFuelSection.jsx`, `ForgeSteelSection.jsx` | B2 | **done** — `2c59283a` |
| B4 | `forge/b4-barges-section` | Barge list + hull bars; queue-extra-barge control (cost/turns/max-3 display) | new `client/src/components/react/ForgeBargesSection.jsx` | B2 | **done** — `ed5f1aff` |
| B5 | `forge/b5-crucible-lava-launch` | Crucible section (lava stock, temper control, tempered gear craft when unlocked); **the one shared lava-draw launch flow** (§6.1 — hex-select + submit), reusing the existing hex-modal pattern established for `epic_trek` | new `client/src/components/react/ForgeCrucibleSection.jsx`, new `client/src/utils/lavaDrawLaunch.js` (shared `submitLavaDraw` + `clientLavaDrawGates`), extend `client/src/components/react/HexSelectionModal.jsx` (new `lava_draw` context type) | B2 | **done** — `9ef62698` |
| B6 | `forge/b6-volcanic-hex-card` | Volcanic hex card: two fixed teasers by stage, ACTIVE/DORMANT + Free/Occupied-Kingdom display with real-time countdown, Draw control hidden until all 5 gates pass (client-side mirror of §7 — server remains source of truth). Calls into **B5's shared `lavaDrawLaunch.js`**, does not duplicate it | new `client/src/components/react/VolcanicHexCard.jsx` (or extends whatever component the world map currently uses for hex info cards — confirm exact target at implement time) | B5 | **next** — branch off `forge/b5-crucible-lava-launch` (`9ef62698`) |

### 15.4 Handshake contract (freeze before either lane starts)

| Contract item | Shape |
|---|---|
| Kingdom flags | `toolwright_yard: bool`, `engineers_lodge: bool`, `forge: bool` |
| Stocks | **`coal`**, **`steel`** (pre-existing columns — **never** `coal_stored` / `steel_stored`), `tempered_steel`, `lava_stored`, `steel_weapons`, `steel_armor`, `tempered_weapons`, `tempered_armor` — all `int`, synced like existing resource fields |
| Barges | `flux_barges: [{ id, integrity: int, status: 'idle'\|'building'\|'deployed' }]` |
| Vent (per volcanic hex) | `{ active: bool, occupying_kingdom_id, occupying_kingdom_name, dormant_until: ISOString\|null }` |
| `POST /api/kingdom/forge/install-upgrade` | `{ upgrade: 'toolwright_yard'\|'engineers_lodge'\|'forge' }` |
| `POST /api/kingdom/forge/charcoal-allocate` | `{ wood: int }` |
| `POST /api/kingdom/forge/smelt` | `{ batches: int }` |
| `POST /api/kingdom/forge/craft-gear` | `{ type: 'steel_weapons'\|'steel_armor'\|'tempered_weapons'\|'tempered_armor', qty: int }` |
| `POST /api/kingdom/forge/temper` | `{ batches: int }` |
| `POST /api/kingdom/forge/build-barge` | *(no body — queues one extra barge)* |
| `POST /api/kingdom/expedition/lava-draw` | `{ target_x: int, target_y: int, barge_id: int }` *(crew is the fixed 25 eng + 5 mage requirement, not player-selectable — no crew count field, unlike Epic Trek's ranger count)* |

**If this table changes after Lane B has already branched off it, Lane B must rebase.** This already happened once in Lane A itself: A1's original schema briefly introduced `coal_stored`/`steel_stored` before the bug was caught and the contract corrected to reuse the pre-existing `coal`/`steel` columns (row above). Every slice built on top of that A1 commit (A2, A3, A4) had to be rebased onto the fix, in each case propagating a rename of every reference to the old field names. The same failure mode applies across lanes: if Lane A amends a field name, endpoint shape, or gate value in this table *after* Lane B has already coded against it, Lane B is now stale in exactly the way A2–A4 were — rebase onto Lane A's corrected commit and re-grep for every reference to the old contract value before re-verifying. Don't assume "my lane's tests still pass" is sufficient; the whole point of a shared contract is that a silent drift on one side breaks the other side's assumptions without either lane's own test suite ever catching it.

### 15.5 What actually happened (2026-07-17) and the corrected process going forward

**This subsection is now the single source of truth for coordination status.** A second document, `FORGE_HANDSHAKE.md`, was created alongside this one during implementation — that was a mistake; this file's §15 was always meant to be the one handshake, per the explicit instruction that started this roadmap. `FORGE_HANDSHAKE.md`'s content has been folded in below and the file removed. If anyone goes looking for it and it's back, that's drift — this file wins.

**The mistake:** the `coal_stored`/`steel_stored` bug (and a small unrelated lint bug — unused catch bindings in `game/prestige/wipe.js`) got found and fixed, but the fix was made *only* inside Lane A's own branch chain — `forge/a1-schema` was amended, then `forge/a2-upgrade-chain` and `forge/a4-flux-barge` (holding A3+A4) were each rebased onto the fix in turn. None of that touched local `main`. Lane B was told to rebase off "the fix on main," and there was nothing there — main was still sitting at the commit it had been on before any Forge work started. A fix kept inside one lane's private branch history doesn't count as fixed from a coordination standpoint, no matter how well-tested it is, because the other lane has no way to discover it.

**The corrected rule — read this before touching either lane again:** local `main` is the only place both lanes actually share. Any bug found in shared/foundational code (schema, contract shape, anything upstream of both lanes — not lane-internal implementation detail) gets fixed with a **real local commit on `main`** before either lane keeps building on top of the old, wrong assumption. Not a push (nothing leaves this machine), not a merge of a branch's full history (that's a separate, later step — see §15.7) — a direct, deliberate, well-tested commit on `main` that both lanes can `git rebase` onto. This is now the standing process, not a one-time exception.

**The correction actually done:** the corrected A1 schema (plus an unrelated pre-existing expeditions migration that was already sitting on `main`'s working tree uncommitted from earlier, unrelated work) is now commit `a499dfc6` on local `main`. Lane A's entire chain was rebased onto it and re-verified (lint clean, live `initDb()` against local Postgres, `npm test` — only the pre-existing unrelated `evolution-http.test.js` gap remains, which needs a separately-running server on a different port):

| Branch | Commit (after rebase onto `main`) |
|---|---|
| `forge/a1-schema` | `a499dfc6` (identical to `main` — nothing left unique once its diff landed there) |
| `forge/a2-upgrade-chain` | `bb8b1dc8` |
| `forge/a3-charcoal-steel` | `7332724a` |
| `forge/a4-flux-barge` | `13f8711d` |
| `forge/a5-vent-dormancy` | `536f0a35` |

**What Lane B does now:**

1. `git rebase main` on whichever `forge/b*` branch is your current tip (`forge/b5-crucible-lava-launch`, `9ef62698`, per §15.3). Earlier B branches in your chain (b1–b4) follow by moving their refs to point at the corresponding rebased commit, same as `forge/a3-charcoal-steel`'s ref was moved after A4's rebase.
2. `grep -rn "coal_stored\|steel_stored" client/src/` — should find nothing. §15.4's contract table has said `coal`/`steel` since the correction; anything else means you coded from an earlier/incorrect read of it — rename to match.
3. Re-run your quality gate (`npm run lint`, `npm run test:components`, `npm run build`) after the rebase.
4. B3's response-aliasing note below still applies until this rebase happens — see the contract matrix.

### 15.6 Contract matrix (who implements what, folded in from the retired handshake log)

| Contract item | Server slice | Client slice | Notes |
|---|---|---|---|
| Flags `toolwright_yard`/`engineers_lodge`/`forge` | A1–A2 | B1 | |
| Stocks (`coal`/`steel`/tempered/gear) | A1, A3 | B1 snapshot, B3 UI | B3 built against a pre-correction response shape and added a **legacy response-alias fallback** (accepts old field names once) — remove that fallback once B rebases per §15.6 |
| `flux_barges[]` | A1 (schema), A2 (free grant), A4 (queue/tick/wear) | B1 store, B4 UI (hull bars, queue) | |
| `POST /forge/build-barge` | A4 | B4 | empty body; costs are **`steel`**, not `steel_stored` |
| Vent `dormant_until` / occupancy | A1 (table), A5 (logic) | B6 (display) | |
| `POST /forge/install-upgrade` | A2 | B1 | |
| `POST /forge/charcoal-allocate` | A3 | B3 | body `{ wood }` |
| `POST /forge/smelt` | A3 | B3 | body `{ batches }` — response uses `coal`/`steel` |
| `POST /forge/craft-gear` | A3 | B3 | steel/tempered weapons+armor |
| `POST /forge/temper` | A3 | B5 | body `{ batches }` |
| `POST /expedition/lava-draw` | A6 | B5 (`client/src/utils/lavaDrawLaunch.js` — shared `submitLavaDraw` + `clientLavaDrawGates`, B6 calls into this rather than duplicating) | `{ target_x, target_y, barge_id }` |

**B5 already built the shared launch util** (`client/src/utils/lavaDrawLaunch.js`) that §15.3's B6 row requires — B6 must call it, not re-implement hex-select + submit.

### 15.7 Integration (the actual handshake moment)

`forge/z-integration` — after **both** A6 and B6 are merged to main: point Lane B's calls at the real Lane A endpoints (if B was built against this contract without a live backend), run the full quality gate, then walk the §10 happy path live in the browser end-to-end (Yard→Lodge→Forge, charcoal→coal→steel→gear, Draw a lava vent, resolve win and resolve loss). One commit. This is the only point where the two lanes' work actually meets.

---

**Design FINAL. Ready for implementation planning.**

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

**This section is the direction, not the handshake.** §15.1–§15.4 below is the fixed instruction set — the split rationale, each lane's task list, and the contract shape both lanes build against. It does not change once work starts except by deliberate amendment (§15.4's rule on that). Live coordination — status, what actually happened, corrections, what to do right now — is a **separate, appended section at the very end of this document: "Appendix: Handshake Log."** Read the roadmap to know what to build. Read the appendix to know what's actually going on.

### 15.1 Why this split

Lane A = server (`db/`, `game/`, `routes/`). Lane B = client (`client/src/`). This is not an arbitrary cut — it's the module boundary this repo already enforces (CLAUDE.md: *"Server code NEVER imports from `/client/src/`; client code NEVER imports from `/game/` or `/lib/`"*). No slice in either lane touches a file the other lane touches, at any point, so the two lanes can run fully concurrently in separate worktrees with zero merge-conflict risk. Slices *within* a lane are sequential (each builds on the previous slice's branch); slices *across* lanes are independent.

**Workflow per slice (every row below):** new branch off the latest tip of that lane → one commit → PR → quality gate (`npm run lint`, `npm test`, `npm run test:components`, and `npm run build` for Lane B) → merge → delete branch. Follow the existing PR Workflow in CLAUDE.md exactly; nothing about this feature changes that process.

### 15.2 Lane A — Server

| # | Branch | Scope | Files touched | Depends on | Status |
|---|--------|-------|----------------|------------|--------|
| A1 | `forge/a1-schema` | Migration only, no logic: upgrade flags (`toolwright_yard`, `engineers_lodge`, `forge`), stocks (`tempered_steel`, `lava_stored`, `steel_weapons`, `steel_armor`, tempered weapons/armor fields) + **reuse existing `coal`/`steel` (do not add `coal_stored`/`steel_stored`)**, `flux_barges` JSON column, vent fields (`occupying_kingdom_id`, `dormant_until`) on the volcanic hex/location data | `db/ddl.js`, `db/init-data.js`, `db/schema.js` | — | done — see Appendix |
| A2 | `forge/a2-upgrade-chain` | Install validation + chain-order enforcement for Yard/Lodge/Forge; apply §2.2 effects (hammer ×0.90, scaffold ×0.90, eng XP ×1.15, construction ×1.10); Forge install grants first free barge (stub call into A4) | `game/config.js`, new `game/forge-upgrades.js`, `routes/kingdom-gameplay.js` | A1 | done — see Appendix |
| A3 | `forge/a3-charcoal-steel` | Charcoal pit (`floor(wood × 0.25 × race_charcoal_mult)`), smelt (20 iron + 10 coal → 1 steel, race smelt mult on output), steel/tempered gear craft per §3.5 costs | new `game/forge-production.js`, `routes/kingdom-gameplay.js` | A1, A2 | done — see Appendix |
| A4 | `forge/a4-flux-barge` | Barge entity (`{ id, integrity, status }`); free-barge grant hook; extra-barge build queue (100 steel/150k gold/1k stone, 20 turns); hull wear (−20 success / −5 empty); max-3 cap; deployed-lock | new `game/flux-barge.js`, `game/engine.js` (turn-tick for barge queue), `routes/kingdom-gameplay.js` | A1, A2 | done — see Appendix |
| A5 | `forge/a5-vent-dormancy` | Vent ACTIVE/DORMANT via `dormant_until` UTC compare-on-read (no cron, no turn dependency); occupation contestation (one kingdom on-site at a time); lava yield `max(1, floor(8 × race_lava_mult))` | new `game/lava-vents.js` | A1 | done — see Appendix |
| A6 | `forge/a6-lava-expedition` | Full lava-draw resolver: crew reservation (pool commit/return, mirrors `resolveEpicTrek`'s pattern), path fog-reveal + travel-finds reuse, arrival race against A5's vent state, +100-turn on-site simulate-at-resolution, all-or-nothing outcome, hull wear via A4, dormancy set via A5, XP on resolve — `awardTroopXp('mages', …)` **and** `awardTroopXp('engineers', …)` **and** `awardEngineerXp` (both engineer systems, per §6.4) | new `game/lava-expedition.js`, `game/engine.js` (resolver hookup), `routes/kingdom-gameplay.js` (`POST /api/kingdom/expedition/lava-draw`) | A1–A5 | next — see Appendix for branch-off point |

### 15.3 Lane B — Client

| # | Branch | Scope | Files touched | Depends on | Status |
|---|--------|-------|----------------|------------|--------|
| B1 | `forge/b1-footer-upgrade-chain` | Build-tab footer widget: show only the next available upgrade; collapse to "Forge online" once complete | `client/src/components/react/BuildPanel.jsx`, `client/src/stores/economyStore.js`, `client/src/stores/index.js` (new selectors) | — | done — see Appendix |
| B2 | `forge/b2-forge-tab-shell` | New Forge tab, gated on `forge` flag; 4-section scaffold (Fuel/Steel/Barges/Crucible), empty sections | new `client/src/components/react/ForgeTab.jsx`, `BuildPanel.jsx` (tab registration) | B1 | done — see Appendix |
| B3 | `forge/b3-fuel-steel-sections` | Fuel section (charcoal wood allocation, coal stock) + Steel section (smelt batch control, steel stock, steel gear craft) | new `client/src/components/react/ForgeFuelSection.jsx`, `ForgeSteelSection.jsx` | B2 | done — see Appendix |
| B4 | `forge/b4-barges-section` | Barge list + hull bars; queue-extra-barge control (cost/turns/max-3 display) | new `client/src/components/react/ForgeBargesSection.jsx` | B2 | done — see Appendix |
| B5 | `forge/b5-crucible-lava-launch` | Crucible section (lava stock, temper control, tempered gear craft when unlocked); **the one shared lava-draw launch flow** (§6.1 — hex-select + submit), reusing the existing hex-modal pattern established for `epic_trek` | new `client/src/components/react/ForgeCrucibleSection.jsx`, new `client/src/utils/lavaDrawLaunch.js` (shared `submitLavaDraw` + `clientLavaDrawGates`), extend `client/src/components/react/HexSelectionModal.jsx` (new `lava_draw` context type) | B2 | done — see Appendix |
| B6 | `forge/b6-volcanic-hex-card` | Volcanic hex card: two fixed teasers by stage, ACTIVE/DORMANT + Free/Occupied-Kingdom display with real-time countdown, Draw control hidden until all 5 gates pass (client-side mirror of §7 — server remains source of truth). Calls into **B5's shared `lavaDrawLaunch.js`**, does not duplicate it | new `client/src/components/react/VolcanicHexCard.jsx` (or extends whatever component the world map currently uses for hex info cards — confirm exact target at implement time) | B5 | done — see Appendix |

### 15.4 Contract shape (frozen before either lane starts)

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

**If this table is amended after a lane has already branched off it, that lane must rebase.** This is a rule of the roadmap; the actual instance of it happening, what was done about it, and what to do next live in the Appendix — not here. This section states the rule; it does not narrate events.

### 15.5 Integration (the final step, not a running log)

`forge/z-integration` — after **both** A6 and B6 are merged to main: point Lane B's calls at the real Lane A endpoints (if B was built against this contract without a live backend), run the full quality gate, then walk the §10 happy path live in the browser end-to-end (Yard→Lodge→Forge, charcoal→coal→steel→gear, Draw a lava vent, resolve win and resolve loss). One commit. This is the only point where the two lanes' work actually meets.

---

**Design FINAL. Ready for implementation planning.**

---

## Appendix: Handshake Log — live coordination between the two lanes

**This is the handshake.** The roadmap above (§15) is fixed direction — what to build. This appendix is not fixed — it is a running log of actual status, problems found, corrections made, and what each lane must do right now. Check this before starting or resuming any slice. It gets rewritten as things happen; the roadmap does not.

### A. What went wrong (2026-07-17)

A schema bug was found in A1: it had introduced brand-new `coal_stored`/`steel_stored` columns, duplicating pre-existing `coal`/`steel` columns that were already fully wired through the rest of the app. It was fixed — but only inside Lane A's own private branch chain (`forge/a1-schema` amended, then `forge/a2-upgrade-chain` and `forge/a4-flux-barge`, which holds A3+A4, each rebased onto the fix in turn). None of that touched local `main`. Lane B was then told to rebase off "the fix on main" — and there was nothing on `main` to rebase onto, because the fix had never actually landed there. A fix that only exists inside one lane's private branch history is not fixed from a coordination standpoint, no matter how well-tested — the other lane has no way to discover it.

A second problem compounded this: a separate document, `FORGE_HANDSHAKE.md`, had been created during implementation to track exactly this kind of status — outside of this roadmap's intended single-appendix design. It independently found and documented the same `coal_stored`/`steel_stored` bug (confirming the diagnosis was right), but its existence as a second "source of truth" alongside this roadmap's own appendix is itself part of what caused the confusion. It has been deleted; everything useful in it is folded into this appendix.

### B. The rule, going forward

**Local `main` is the only thing both lanes actually share.** Any bug found in shared/foundational code — schema, contract shape (§15.4), anything upstream of both lanes, as opposed to a lane-internal implementation detail — gets fixed with a real local commit on `main` *before* either lane keeps building on the old, wrong assumption. Not a push (nothing leaves this machine). Not a merge of a branch's full history (that's §15.5's job, later, once). A direct, deliberate, quality-gated commit on `main` that both lanes then `git rebase` onto. Whoever finds a shared-foundation bug fixes it on `main` and writes what they did in this appendix — they do not just fix it in their own branch and move on.

### C. What was actually done about it

The corrected A1 schema (plus an unrelated pre-existing expeditions migration that happened to already be sitting uncommitted on `main`'s working tree from earlier, unrelated work) landed as commit `a499dfc6` on local `main`. This document itself landed as `d7aa6308`, then was restructured into its current roadmap/appendix split as `c2064a32`.

A second shared-foundation bug was found and fixed the same way while building A6: `parseTroopLevel` was required from `game/lib/troops.js` throughout the routes (including A3's and A4's own route handlers), but only ever existed as a private, unexported function inside `game/combat-resolver.js` — every call site outside that file was destructuring `undefined`. This meant **A3's and A4's actual HTTP routes were broken the whole time**; earlier verification of those slices only exercised the underlying pure functions directly (`smeltSteel`, `queueExtraBarge`, etc.), never the routes themselves, so the gap went undetected until A6 needed the same import. Fixed on `main` as commit `2abe45ae` (moved the canonical implementation to `troops.js`, exported it, `combat-resolver.js` now imports from there), then the entire Lane A chain was rebased onto it a second time.

Lane A's chain was re-verified after each `main` landing — lint clean, live `initDb()` against local Postgres succeeds, `npm test` passes (aside from the pre-existing, unrelated `evolution-http.test.js`/`prestige-http-rebirth.test.js` gaps that need separately-running servers).

| Branch | Commit (current tip, rebased onto `main`) |
|---|---|
| `forge/a1-schema` | `2abe45ae` (identical to `main` — nothing left unique once its diffs landed there) |
| `forge/a2-upgrade-chain` | `8adc106d` |
| `forge/a3-charcoal-steel` | `0a6992ed` |
| `forge/a4-flux-barge` | `0e055668` |
| `forge/a5-vent-dormancy` | `37e2ce58` |
| `forge/a6-lava-expedition` | `700b9c74` — **done**, see H |
| `forge/b1-footer-upgrade-chain` | `de41aeb2` (rebased onto `main` as of `c2064a32`; **not yet rebased onto `2abe45ae`** — see D) |
| `forge/b2-forge-tab-shell` | `78c667fd` (same caveat) |
| `forge/b3-fuel-steel-sections` | `595285d4` (same caveat) |
| `forge/b4-barges-section` | `329a4e3d` (same caveat) |
| `forge/b5-crucible-lava-launch` | `3e8e5483` (same caveat) |
| `forge/b6-volcanic-hex-card` | `738a1dc1` (same caveat) — **done**, see G |

### D. What Lane B must do right now

**Already done (2026-07-18, Lane B worker), before A6 landed:**
1. Rebased onto `main` at `c2064a32`, moved b1–b4 HEADs to match.
2. Confirmed no `coal_stored`/`steel_stored` in `client/src/`.
3. Removed legacy `*_stored` response-alias fallbacks (`3e8e5483`).
4. Full quality gate passed on B5.
5. Built B6 (`738a1dc1`) — done, see G.

**New, as of A6 landing (`700b9c74`) — do this now:**
1. `git rebase main` on `forge/b6-volcanic-hex-card` (your current tip) — `main` has moved twice since your last rebase (`c2064a32` → `a499dfc6`-family already absorbed → now `2abe45ae`, the `parseTroopLevel` fix). Move b1–b5 refs the same way you did last time.
2. **`GET /api/kingdom/lava-vent?hex_col=&hex_row=` now exists** (added in A6, commit `700b9c74`) — the thing you flagged as missing in your G note. Returns exactly `getVentState`'s shape: `{ hex_col, hex_row, active, occupying_kingdom_id, occupying_kingdom_name, dormant_until }`. Wire B6 to it if it was still using the "no endpoint, assume ACTIVE + Free" fallback.
3. Re-run your full quality gate after the rebase.
4. After that: **Lane B is done.** Nothing else is scoped for B.

### E. Contract matrix (who implements what)

| Contract item | Server slice | Client slice | Notes |
|---|---|---|---|
| Flags `toolwright_yard`/`engineers_lodge`/`forge` | A1–A2 | B1 | |
| Stocks (`coal`/`steel`/tempered/gear) | A1, A3 | B1 snapshot, B3 UI | legacy alias fallback already removed (D) |
| `flux_barges[]` | A1 (schema), A2 (free grant), A4 (queue/tick/wear) | B1 store, B4 UI (hull bars, queue) | |
| `POST /forge/build-barge` | A4 | B4 | empty body; costs are **`steel`**, not `steel_stored` |
| `GET /lava-vent?hex_col=&hex_row=` | **A6** (new, `700b9c74`) | B6 | see D.2 |
| Vent `dormant_until` / occupancy | A1 (table), A5 (logic), A6 (claim/release wired into resolver) | B6 (display) | |
| `POST /forge/install-upgrade` | A2 | B1 | |
| `POST /forge/charcoal-allocate` | A3 | B3 | body `{ wood }` |
| `POST /forge/smelt` | A3 | B3 | body `{ batches }` — response uses `coal`/`steel` |
| `POST /forge/craft-gear` | A3 | B3 | steel/tempered weapons+armor |
| `POST /forge/temper` | A3 | B5 | body `{ batches }` |
| `POST /expedition/lava-draw` | **A6** (done, `700b9c74`) | B5's `lavaDrawLaunch.js`, called by B6 | `{ target_x, target_y, barge_id }` — crew is fixed 25 eng + 5 mage, no count field |

### F. Next up

- **Lane A: done.** A1–A6 all committed, rebased onto current `main`, and verified. Nothing further scoped for Lane A unless Integration (§15.5) surfaces a gap.
- **Lane B:** rebase onto `main` (`2abe45ae`) and wire the new vent-read endpoint — see D. Otherwise done.
- **Nobody yet:** the integration slice (§15.5, `forge/z-integration`) — both A6 and B6 are functionally done, but Lane B needs to complete D above first. Once that's confirmed, Integration can start.

### G. B6 notes (Lane B)

- `VolcanicHexCard.jsx` wired into `WorldmapPanel` when `clickedHex.terrain === 'volcanic'`.
- Draw uses **only** `lavaDrawLaunch.js` (`submitLavaDraw` + `clientLavaDrawGates`).
- Vent status fetch: `GET /api/kingdom/lava-vent?hex_col=&hex_row=` — **now built, see D.2 and E**.

### H. A6 notes (Lane A)

- `game/lava-expedition.js`: `canLaunch`/`buildLaunch` (pure, launch-time gate + debit computation) and `resolveLavaDraw` (async, called from `game/engine.js`'s `resolveExpeditions` the same way `resolveEpicTrek` is).
- Full round trip (outbound + 100 on-site + return) is one `turns_total` computed at launch — this codebase has no live per-tick expedition state, everything multi-turn resolves in one batch at completion (same pattern as mountain expeditions and Epic Trek). The "arrival race" is simulated at that single resolution moment via `claimVent`.
- Crew (25 eng + 5 mage) debited at launch, always returns at resolution — no casualty mechanic, only barge hull wear (-20 success / -5 empty, via A4's `applyHullWear`).
- XP on resolve: `awardTroopXp` for both `engineers` and `mages` troop levels, **and** `awardEngineerXp` for the separate construction-skill column, Lodge ×1.15 on the engineer grant only — matches §6.4 exactly. Verified with direct functional tests against live Postgres for both outcomes (win: correct race-multiplied yield + XP; lose: correct occupant name surfaced, correct empty-handed XP) — see the A6 commit message for exact numbers checked.
- `GET /api/kingdom/lava-vent` added on top of the original A6 scope once Lane B's G note flagged it was missing — small, directly related addition, folded into the same commit rather than a separate slice.

*Last updated 2026-07-18, after A6 landed and the parseTroopLevel shared-foundation fix.*

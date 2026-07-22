# Mutator Policy Clarification Plan

**Purpose:** Make Policy A (CommandHandler) vs Policy B (domain module + route transaction) obvious, honest in architecture docs, and cheap to re-verify — without forcing every mutator through CommandHandler.

**Status:** **COMPLETE (local)** — M0–M6 landed on local `main`.  
**Date:** 2026-07-22  
**Related:** `game/COMMAND_COVERAGE.md` (existing matrix + A5-2 policy), `game/ARCHITECTURE.md`, `scripts/check-command-boundary.js`, `game/command-handler.js`.  
**Sibling campaign:** Engine extract (`docs/dev/ENGINE_EXTRACT_PLAN.md`) is complete (local); this plan does **not** re-open engine slicing.

**Scope of implementation (when greenlit):** Policy + docs + inventory + optional light automation. **Not** a mass migration of Policy B routes into CommandHandler.

---

## 1. Problem

The dual mutator policy already exists in code and in `COMMAND_COVERAGE.md`, but it is easy to misread:

| Source | What it implies | Reality |
|--------|------------------|---------|
| `ARCHITECTURE.md` data-flow diagram | Almost every mutator → `CommandHandler` | ~13 CH routes; ~70 domain-module / route-txn (2026-07-19 snapshot) |
| `check:command-boundary` | “Mutator boundary is healthy” | Only bans **direct** forbidden `engine.*` mutators on scanned files — not “must call `handle`” |
| `COMMAND_COVERAGE.md` | Honest Policy A / Policy B | Good core text; snapshot dated **2026-07-19**; some wording may be stale after engine extract / A5-5 |
| New contributors / agents | “Everything must go through CH” **or** “anything goes” | Neither is true |

After the engine extract, “classic systems live in `engine.js`” is also stale: turn lives in `game/lib/turn-pipeline.js`, expeditions/regions in lib modules. The **policy still holds**, but the **map of where simulation code lives** needs updating.

**Key sentence for all docs:**  
*Where simulation lives ≠ which façade routes use. CommandHandler is a route-facing façade for classic sim verbs, not a requirement that logic sit in `engine.js`.*

---

## 2. Goals

1. **One readable policy** a human (or agent) can apply in ~30 seconds when adding a route.  
2. **Honest architecture docs** (no CH-only pipeline diagram).  
3. **Fresh coverage matrix** after engine extract + current routes.  
4. **Decision rule** for “new system → Policy A or B?” so Prestige is not re-litigated every time.  
5. **Optional light automation** so policy does not rot — without a high-noise “must call `handle`” gate (already declined as A5-8).

## 3. Non-goals

- Forcing Forge / Prestige / Evolution / attunements through CommandHandler.  
- Growing CommandHandler into a transaction manager.  
- Full transaction-safety audit of every `direct` row (later campaign).  
- Client `structureUpdates` / `apiCallAndSync` work (related **response-contract** track — separate plan).  
- Big-bang renames of modules.  
- Reopening A5-8-style permanent POSTs-must-handle-or-allowlist CI gate unless the user explicitly reopens it.

---

## 4. Target policy (restate; do not invent)

Name clearly in docs as **Policy A / Policy B / Policy S**.

### 4.1 Policy A — CommandHandler path

**When:** Classic sim actions that fit  
`handle(type, payload) → { updates, events }` (or a small fixed result shape) and are already (or naturally) wired through `COMMAND_TYPES`.

**Examples today:** turn, combat, spell, covert-*, expeditions (resolution via CH), hire/recruit, queue/demolish buildings, study/school, purchase-upgrade, score, trade-route raid, legacy forge-tools, award-xp / award-troop-xp.

**Rules:**

- Routes must not call forbidden `engine.*` mutators (`npm run check:command-boundary`).  
- Prefer `commandHandler.handle` (or the default export singleton / `createCommandHandler`).  
- Simulation may live in the `engine` barrel, `turn-pipeline`, `game/lib/*`, or domain modules — **CH is the route-facing façade**, not “must be a function still sitting in `engine.js`”.

### 4.2 Policy B — Domain module + route transaction

**When:** Multi-step atomic flows, bespoke persistence, or already-modular systems that do not fit CH’s simple shape.

**Examples today:** Prestige rebirth, Forge & Lava Industry, Dragon Evolution, attunements/synergies, most allocations, market/bank, many build/exploration helpers.

**Rules:**

1. No forbidden `engine.*` mutators from scanned routes (same gate as Policy A).  
2. **Single domain home** (real module, not large inline SQL/logic in the route).  
3. Multi-write → `db.withTransaction` (or document single-statement atomicity).  
4. **Response contract (companion rule):** where the client expects store updates, return domain-shaped `updates` via `structureUpdates` / `apiCallAndSync` — document as required; implement under a separate track if gaps remain.  
5. Document the system on the Policy B allowlist / matrix in the coverage doc.

**Precedent for refusing CH:** `handlePrestige()` throws and directs callers to `POST /rebirth` because atomic wipe TX does not fit `handle(type) → { updates, events }` without CH owning transactions.

### 4.3 Policy S — System / tick (not player HTTP mutators)

**When:** Server jobs with no player “command verb” shape (or not player-initiated HTTP).

**Examples:** regen timer, `resolveRegions` on tick, boot repair, scheduled audits.

**Rules:** Must not reintroduce player combat/spell/covert as raw socket mutators bypassing HTTP+CH. Classify clearly so agents do not force these into Policy A.

### 4.4 Out of band (label, do not force into A/B)

- Admin routes, public bootstrap, forum/social may follow different conventions — call out as **Other** in the matrix so they are not mis-filed.

### 4.5 Decision tree (to put in the doc)

```text
Is this a player HTTP mutator?
├─ No → Policy S (regen, boot, admin-internal jobs) or Other / N/A
└─ Yes
   ├─ Needs multi-table atomic TX or domain already owns TX shape?
   │  └─ Yes → Policy B (domain module + route txn); list in coverage matrix
   ├─ Fits CH handle(type) → updates/events and is classic sim?
   │  └─ Yes → Policy A (COMMAND_TYPES + handle)
   └─ Unsure → gray-area log entry; default to B if a domain module exists, else discuss
```

**Default for brand-new greenfield features:**

- Prefer **Policy B** if the feature owns its own tables/modules (Forge-like).  
- Prefer **Policy A** if it is another verb on the shared kingdom sim result bag (attack / spell / turn-like).

---

## 5. Deliverables

### D1 — Canonical policy doc (source of truth)

Expand `game/COMMAND_COVERAGE.md` (preferred single home) or split only if the matrix becomes huge:

- Policy A / B / S definitions and the decision tree above.  
- “When to add a `COMMAND_TYPES` entry” vs “when to refuse and use Policy B” (Prestige fence as template).  
- Replace “engine.js-rooted” language with **“classic sim façade via CommandHandler”** + pointers to `turn-pipeline`, `expedition-resolution`, etc.  
- Retire stale claims (e.g. sockets still calling combat/spell mutators if A5-5 deleted those handlers); document current `check:command-boundary` scan list including `game/sockets.js`.  
- **How to re-generate the matrix** (exact commands) so tables stay maintainable.

### D2 — Architecture honesty pass

Edit `game/ARCHITECTURE.md` (and CLAUDE.md only if it overclaims):

- Replace the single CH pipeline with **two player paths** + Policy S ticks.  
- Decoupling row: “PARTIAL by design for Policy B; CH required only for Policy A types.”  
- Link `COMMAND_COVERAGE.md` as authoritative for per-route classification.  
- Keep engine-extract status accurate; do not re-open extract work.

### D3 — Refreshed coverage matrix (inventory)

One-time audit (read-only inventory, then write tables):

1. List all mutating routes in `routes/kingdom-*.js` and `routes/hero.js`; decide whether `alliance.js` / `forum.js` / admin are in-scope for A/B or **Other**.  
2. Classify each: `CH:<type>` | `direct+txn` | `direct` | `read-only/validation` | `fence`.  
3. Cross-check every `COMMAND_TYPES` entry has ≥1 live caller **or** is an intentional fence (`prestige`).  
4. Flag **gray-area** routes (looks Policy A but is `direct`) for human disposition — do not auto-migrate.  
5. Replace 2026-07-19 counts with current numbers.

### D4 — Decision checklist (PRs / agents)

Short checklist in `COMMAND_COVERAGE.md` and/or `CLAUDE.md`:

```text
New mutating endpoint?
[ ] Fits handle() → { updates, events } without owning multi-table TX? → Policy A + COMMAND_TYPES
[ ] Multi-table atomic wipe / long domain TX / already modular domain? → Policy B + named module + withTransaction
[ ] Server tick / regen / no player HTTP? → Policy S
[ ] Forbidden engine mutators from routes/sockets? → never
[ ] Client expects updates? → structureUpdates / apiCallAndSync (pointer; separate track)
```

### D5 — Light automation (optional, low noise)

Pick **at most one** class of tooling (prefer cheapest):

| Option | What it does | Noise risk |
|--------|----------------|------------|
| **A. Doc-gen / print script** | Prints matrix candidates from grep; human pastes into md | Low |
| **B. Fence test** | `prestige` still throws; each `COMMAND_TYPES` entry still in `handle` switch | Low |
| **C. Soft inventory in CI** | Fail only if `COMMAND_TYPES` has types not in switch | Low |
| **D. POSTs must `handle` or allowlist** | Permanent allowlist of Policy B routes | **High — declined as A5-8; do not implement unless user reopens** |

**Recommend for this campaign:** D5-A and/or D5-B only. **Skip D5-D.**

### D6 — Gray-area disposition log

Short table of misclassified-looking routes. Each row: **keep B** / **migrate to A later** / **needs investigation**.  
No code migrations in this plan unless a follow-up campaign is approved.

---

## 6. Work slices (one commit each when implementing)

| ID | Slice | Output | Acceptance |
|----|--------|--------|------------|
| **M0** | Recon only | Live `COMMAND_TYPES`, every `handle({ type`, mutating POST counts; stale-doc list | Written recon notes; no behavior change |
| **M1** | Policy rewrite | COMMAND_COVERAGE policy + decision tree; fix sockets/engine wording | Doc-only; matches live CH + boundary script |
| **M2** | Architecture fix | ARCHITECTURE pipeline + coupling text honest | Doc-only; no “all mutators via CH” |
| **M3** | Matrix refresh | Full route tables + counts | Spot-check ≥5 random routes vs source; CH types have callers or fence |
| **M4** | Agent checklist | CLAUDE.md and/or COMMAND_COVERAGE “new route” checklist | One page; no new gates |
| **M5** | Optional scripts/tests | e.g. `scripts/print-mutator-matrix.js` and/or fence unit test | Script runs; `npm test` green |
| **M6** | Gray-area log only | Disposition table | No migrations without separate approval |

**Order:** M0 → M1 → M2 → M3 → M4 → (M5 optional) → M6.

**Suggested first greenlight step:** M0 recon only — dump live CH types and call sites, produce a one-page “stale vs true” note before rewriting docs.

---

## 7. Operating model (if implemented)

- Prefer **one branch = one commit** per slice (`docs/mutator-M##-…` or `docs/mutator-policy-M##-…`).  
- Default **local-only** until the user asks for push/PR (same discipline as engine extract unless overridden).  
- Surgical: no drive-by route rewrites while documenting.  
- Re-verify matrix commands before trusting line counts in any future PR.

---

## 8. Risks

| Risk | Mitigation |
|------|------------|
| Agents still “CH everything” | Decision tree + fix ARCHITECTURE diagram early (M1–M2) |
| Matrix goes stale again | Document re-gen commands; optional print script (M5-A) |
| Scope creep into migrations | M6 log-only; no “while we’re here” CH rewires |
| Confusing engine extract with mutator policy | Explicit: *where simulation lives ≠ which façade routes use* |
| High-noise CI gate | Do not implement A5-8-style allowlist unless reopened |

---

## 9. Related tracks (separate plans — do not fold in)

| Track | Why separate |
|-------|----------------|
| Response contract (`structureUpdates` + `apiCallAndSync`) | Stops silent UI desync; applies to both A and B success paths |
| Transaction audit of `direct` multi-statement routes | Safety, not policy clarity |
| Engine barrel diet | Continue reducing `require('game/engine')` for helpers (S14 started docs only) |

---

## 10. Done when

1. A new contributor can classify a new endpoint as A, B, or S without reading the whole matrix.  
2. ARCHITECTURE diagram matches dual policy.  
3. Coverage matrix is regenerated post–engine-extract and has no known-stale socket-combat claims.  
4. No forced uniformity migration; Prestige/Forge remain Policy B by design.  
5. Optional: one low-noise script or fence test so the next drift is cheap to spot.

---

## 11. Progress

| ID | Slice | Status |
|----|--------|--------|
| M0 | Recon | **DONE (local)** |
| M1 | Policy rewrite | **DONE (local)** |
| M2 | Architecture honesty | **DONE (local)** |
| M3 | Matrix refresh | **DONE (local)** |
| M4 | Agent checklist | **DONE (local)** |
| M5 | Optional automation | **DONE (local)** — D5-A only, D5-B already covered by existing test/command-handler.test.js |
| M6 | Gray-area log | **DONE (local)** |

---

## 12. References

- `game/COMMAND_COVERAGE.md` — existing A5-2 policy + 2026-07-19 matrix  
- `game/ARCHITECTURE.md` — coupling + (currently oversimplified) data-flow  
- `scripts/check-command-boundary.js` — forbidden `engine.*` list + scanned files  
- `game/command-handler.js` — `COMMAND_TYPES`, fences (`prestige`)  
- `docs/dev/ENGINE_EXTRACT_PLAN.md` — completed; do not reopen for this work  
- Historical: A5-8 declined (handle-or-allowlist gate); A5-4/A5-5 sockets boundary + dead handler removal  

---

## 13. M0 Recon Notes (2026-07-22)

Read-only inventory. No doc rewrites yet — that's M1/M2. No behavior change.

**Live `COMMAND_TYPES` (22 entries, `game/command-handler.js`):** turn, expeditions, combat, spell, covert-spy, covert-loot, covert-assassinate, covert-sabotage, hire-units, hire-mercenaries, recruit-hero, queue-buildings, demolish-building, study-discipline, select-school, purchase-upgrade, prestige (fenced — throws), calculate-score, raid-trade-route, forge-tools, award-xp, award-troop-xp. Every entry has a matching `case` in `handle()`'s switch — no orphaned types, no missing fences.

**Files that actually call `commandHandler.handle`:** `hero.js`, `kingdom-build.js`, `kingdom-economy.js`, `kingdom-exploration.js`, `kingdom-gameplay.js`, `kingdom-profile.js`, `kingdom-research.js`, `kingdom-turn.js`, `kingdom-warfare.js` — 9 route files.

**Mutating route recount (`router.post|put|patch|delete`), `kingdom-*` + `hero`:** **82**, vs. `COMMAND_COVERAGE.md`'s stated **83** (2026-07-19). Off by one — not re-derived here (that's M3's job, needs the actual route-by-route list, not just a count), but flagging now so M3 doesn't silently inherit a stale number.

**Not currently classified anywhere in the coverage matrix** (plan §5/D3 flags this as a decision needed): `alliance.js` (7 mutating routes), `forum.js` (13 mutating routes), admin routes (47 mutating routes total across `routes/admin*.js`). All candidates for the **Other** label per §4.4 rather than forcing into A/B.

**Stale-doc finding — confirmed, not hypothetical, and wider than the plan's own example anticipated.** Both `game/ARCHITECTURE.md` (lines 26 and 128–134) **and** `game/COMMAND_COVERAGE.md` (lines 45–49 and 263–264) currently assert `game/sockets.js` "calls `engine.resolveMilitaryAttack`/`engine.castSpell` directly" and call this "a real gap" / "the one real gap." Grepped `game/sockets.js` directly: **zero matches for either call.** `TODO.md`'s A5-5 entry (2026-07-19) confirms why — the socket attack/spell/covert handlers referenced by that claim were **deleted outright** (~340 lines removed, user chose delete over migrate, per that entry), not fixed by routing them through CommandHandler. Both docs still describe a gap that no longer exists in the code. This is now a concrete M1 (COMMAND_COVERAGE.md) + M2 (ARCHITECTURE.md) fix, not a maybe.

**No behavior-change risk identified in this recon pass** — everything above is doc/inventory accuracy, consistent with M0's scope.

---

*Implementation starts only when explicitly requested, one slice at a time.*

# Narmir Reborn — TODO

**Purpose:** Live source of truth for *open* work only. Completed work lives in [ARCHIVAL.md](ARCHIVAL.md). Architecture status: [game/ARCHITECTURE.md](game/ARCHITECTURE.md). Optional ideas: [ADMIN_WISHLIST_PLAN.md](ADMIN_WISHLIST_PLAN.md).

**Last updated:** 2026-07-23 — refreshed after engine extract S00–S14, mutator policy M0–M6, half-wire closeout (injuries / combat terrain / race specials / volcanic), and Tier‑1 residual wires (worldmap `structureUpdates`, elevation flat-path cost, player `active_effects` UI).

**Mode:** Commits on local branches → verify → merge to local `main` → push `origin/main` when the user asks (no Gemini PR loop).

**Verification rule:** Nothing is "done" until traced on the live runtime path. Docs alone do not count.

**Execution rule:** Surgical changes only — fix root causes, no bandaids, do not ignore warnings/errors.

---

## Local acceptance baseline

```bash
npm run lint
npm run architecture:accept
npm run check:command-boundary
npm run validate:game-tables
npm test
```

Optional for route-heavy work:

```bash
npm run test:systems
```

---

## Open work items

| ID | Item | Status |
|----|------|--------|
| — | *(none queued)* | Open product backlog is in `ADMIN_WISHLIST_PLAN.md` (partial systems + missing features). Pick intentionally; do not invent scope. |

---

## Recently closed (pointers only — detail in ARCHIVAL / git)

| When | What |
|------|------|
| 2026-07-23 | Injury recovery on `processTurn` + Status/Warfare wounded UI; combat hex terrain; Wood Elf / Ogre specials; volcanic biome loot; full-path elevation trek cost |
| 2026-07-23 | Worldmap steal-map `structureUpdates`; elevation movement **no** 1.3× on flat/downhill; player Status **Active effects** from `active_effects` |
| 2026-07-24 | Dead migration cleanup: SVG worldmap `_archive`, unused GSM bridges, never-mounted `HexMapProvider`/`createHexContext`, unused `uiStore` (panel nav is `useActivePanel`), legacy admin HTML |
| 2026-07-22 | Engine extract S00–S14 complete (local → later on origin); mutator policy campaign M0–M6 |
| 2026-07-19 | A1–A5 architecture series (boot, route splits, turn pipeline honesty, client normalizer, CommandHandler boundary) — see ARCHIVAL.md |

---

## Guardrails (not open bugs)

| ID | Note |
|----|------|
| R-1 | Production turn latency — historical 2026-07-08 report, not reproduced; local `processTurn` compute ruled out. If it returns, check HTTP/transaction layer first. |
| Prestige-HTTP tests | `prestige-http-rebirth.test.js` needs a live server on `:3000`. Start `npm run dev` before full `npm test` if that file is included. |

---

## Explicit cuts (do not schedule)

| Item | Why |
|------|-----|
| Full event-bus / outbox rewrite | Wrong model for Narmir |
| Big-bang `engine.js` re-split | S00–S14 extract already shipped |
| Force all mutators through CommandHandler | Policy B systems are intentional (`game/COMMAND_COVERAGE.md`) |
| JSON content-pack “engine” vision | Cut — wrong model |

---

## Notes

- **Do not re-inflate `index.js`** — new boot concerns go under `lib/`.
- **Do not** treat stale memory files as open bugs without re-tracing live code (e.g. Combat V2 *is* the live path; scout reload *is* fixed).
- Elevation **visual** polish (3D hex flatness, border cosmetics) is separate from server movement/combat wiring — only touch if sessioned.
- Systems harness recovery tip if ever needed: `b04214e2` / `chore/test-systems-harness`.

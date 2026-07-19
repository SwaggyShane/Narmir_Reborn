# Narmir Reborn — TODO

**Purpose:** Live source of truth for active work. Completed work lives in [ARCHIVAL.md](ARCHIVAL.md). Architecture status: [game/ARCHITECTURE.md](game/ARCHITECTURE.md).

**Last updated:** 2026-07-19 — cleaned up after the A1–A2 series (boot cleanup, full kingdom-route + admin-route splits) and the A3/A4/A5 partial work completed this session. See the 2026-07-19 entry at the top of [ARCHIVAL.md](ARCHIVAL.md) for what was done and why. This file now holds only what's still open.

**Mode: LOCAL ONLY.** Commits on local branches / local `main`. No PRs, no remote review loop.

**Verification rule:** Nothing is "done" until traced on the live runtime path. Docs alone do not count.

**Execution rule:** Surgical changes only — fix root causes, no bandaids, do not ignore warnings/errors. Test + document each item before moving to the next.

---

## Local acceptance baseline

Run before considering any item done:

```bash
npm run lint
npm run architecture:accept
npm run check:command-boundary
npm run validate:game-tables
npm test
```

Optional, recommended for anything touching routes:

```bash
npm run test:systems
npm run smoke:combat-v2
```

---

## Open work items

### Turn pipeline (§3 of the original assessment — see ARCHIVAL.md for A3-1/A3-3/A3-4)

| ID | Item | Status |
|----|------|--------|
| A3-2 | Rename or document `game/turn.js` (not the pipeline — only map WIP helpers; the name is misleading). | **DONE** (2026-07-19) — scope changed on investigation: the file wasn't just misleadingly named, it was **completely unreferenced** (`calcDiscoveryChance`/`processLocationMapsWip`, its only two functions, both had separate, actually-used implementations elsewhere — `game/lib/data-transformations.js` and `game/lib/expeditions.js` respectively). Deleted rather than renamed/documented, since documenting dead code just leaves it around to confuse the next reader. While comparing the duplicate implementations, found a **real, live P0-class bug** in the actual production copy (`game/lib/expeditions.js`, called from `game/engine.js`'s `processTurn`): `processLocationMapsWip` re-read `k.discovered_kingdoms` fresh on every loop iteration instead of accumulating, so whenever 2+ scribe location-maps completed in the same turn for the same kingdom, each iteration silently overwrote the previous one's discovery — only the last-processed map survived. A third, test-only copy in `game/location-maps.js` (used by `test/kingdom-discovery-paths.test.js`, never by production) had already fixed this independently but was never wired into the real code, meaning the existing test provided **zero regression coverage for production** — exactly the "test exercises a different implementation than production" pattern already flagged once this session (see ARCHIVAL.md's Forge entry). Fixed the real bug in `game/lib/expeditions.js`; repointed the test to import from the production module instead of the dead one; added a new regression case (`path 3b`) for the two-completions-in-one-call scenario, verified it fails against the pre-fix code and passes against the fix (not just written and trusted). Deleted both dead files (`game/turn.js`, `game/location-maps.js`); fixed a stale `CLAUDE.md` claim that the turn-regen timer lived in `game/turn.js` (it never did — the real timer is `lib/boot.js`'s `setInterval`); removed the dead `game/turn.js` entry from `test-systems-harness`'s module-surface check. Full acceptance baseline green (lint, architecture:accept, `npm test` 84/84 incl. the new regression case, `npm run test:systems` 82/82), plus a direct live `processTurn` call against the largest kingdom in the local DB confirming no regression. |
| A3-5 | Audit fire-and-forget DB writes in `processTurn` (happiness history record is `.catch()`-only, not awaited). | **TODO** |
| A3-6 | Document all 5 `type: 'turn'` call sites and why research double-runs a turn. | **TODO** |
| A3-7 | Align postfetch + `structureUpdates` field lists with client domains. | **TODO** |
| A3-8 | Incremental extract of attunement blocks / turn-systems registry (behavior-preserving). | **TODO** |

### Client state path (§4 — see ARCHIVAL.md for A4-1/A4-2/A4-9/A4-10)

| ID | Item | Status |
|----|------|--------|
| A4-3 | Eliminate direct `receiveServerSnapshot` outside the normalizer (HirePanel, AuthModal, BuildPanel, ExplorationPanel, HeroesPanel, WarfarePanel, TrainingPanel, Forge sections, HappinessWidget, RankingsPanel, StatusPanel, VolcanicHexCard, useRegenCountdown, etc.). **Blocked on tracing each of the 12 raw-response sites (found in A4-1) against its actual client call site first** — some may be intentionally raw for a CommandHandler-bypass system (forge/evolution) consumed by a matching direct-snapshot call; wrapping in `structureUpdates` blind risks breaking currently-working client code. Do this per-route, not in bulk. | **TODO** |
| A4-4 | Unify `client/src/utils/api.js` / `api.mjs` (dual modules, ~30 vs ~27 import sites). | **TODO** |
| A4-5 | `apiCallAndSync` when `updates` present in a response. | **TODO** |
| A4-6 | Socket action results → same client apply path as HTTP (may not currently share it). | **TODO** |
| A4-7 | Single auth/bootstrap hydrate (`/kingdom/me` fragmented across multiple AuthModal snapshots). | **TODO** |
| A4-8 | Scout progress full-reload bug (ties R-2). | **TODO** |

### Mutator boundary / CommandHandler (§5 — see ARCHIVAL.md for A5-1/A5-2/A5-3/A5-6/A5-7)

| ID | Item | Status |
|----|------|--------|
| A5-4 | Expand boundary tooling: scan **`game/sockets.js`** for the same forbidden `engine.*` mutators; fail the local gate. | **DONE** (2026-07-19) — generalized `check-command-boundary.js` to scan files outside `routes/` (new `STRICT_FILES_ABSOLUTE` list, `game/sockets.js` added). Also found and fixed a second, separate gap in the same pass: `engine.covertSpy`/`covertLoot`/`covertAssassinate` were never in the `FORBIDDEN` pattern list at all (only attack/spell were covered) — meaning the check would have missed covert-mutator violations in *any* scanned file, not just sockets.js. Sanity-tested the gate actually catches a real violation before trusting it (temporarily reintroduced a forbidden call into a scratch copy, confirmed `check:command-boundary` fails with the right file:line, restored, confirmed clean again). |
| A5-5 | Migrate socket attack/spell/covert to `commandHandler.handle` (parity with HTTP warfare). | **DONE** (2026-07-19) — **scope changed after investigation, user confirmed.** Comparing the socket handlers against the real HTTP `/attack`/`/spell`/`/covert` routes in `kingdom-warfare.js` found the socket versions weren't just architecturally non-compliant — their business logic had drifted far behind: no available-units validation, no newbie-protection (turn<400) gate, no fog-of-war/visibility gate, only 2 of 9 attack unit types, no hero XP, no bounty claiming, no watchtower/signal-tower notifications. Then confirmed via `grep` across `client/src` that the shipped client **never emits any of these socket events** (`socket-client.js` only emits `chat:request_online`/`chat:global`/`chat:alliance`) — the handlers were unreachable dead code, still technically exploitable by a raw socket.io client bypassing the web UI and skipping newbie protection + fog-of-war entirely. Presented the user three options (delete / bring to full parity / flag-and-defer); user chose delete. Removed `action:attack`/`action:spell`/`action:spy`/`action:loot`/`action:assassinate` (~340 lines) plus the now-dead helpers they alone used (`withTransaction`, `applyUpdates`, `insertNews`, `notifyUnread`) and now-dead imports (`engine`, `incrementUnread`, `unreadNewsCache`). Real combat/spell/covert already works correctly via HTTP + CommandHandler — untouched, still 100% covered by `test:systems`'s `combat`/`spells`/`covert` checks (all green). No client-visible behavior change (nothing used these). Full acceptance baseline green (lint zero warnings, architecture:accept, check:command-boundary 24 files, validate:game-tables, `npm test` 84/84, `npm run test:systems` 83/83). |
| A5-8 | Optionally extend boundary check to flag new kingdom POSTs that never call `handle` and never appear on an allowlist. Low priority, high noise. | **TODO** |

### Git hygiene (local)

| ID | Item | Status |
|----|------|--------|
| G-1 | Local branch prune — many local branches still show `[origin/X: gone]` (remote deleted, local ref not cleaned up). Confirmed still present as of 2026-07-19 (`git branch -vv`). Needs explicit user go-ahead before pruning (destructive). | **TODO** |
| G-2 | Worktree inventory; close finished lanes. `git worktree list` currently shows only the main worktree — likely already resolved, re-check before acting. | **TODO** |
| G-3 | Ignore agent noise (`logs/`, `terminals/`, smoke logs) in `.gitignore`. | **TODO** |
| G-4 | Reconcile local `main` ↔ `origin/main` — **only when the user chooses.** Currently 203 ahead / 8 behind. Not part of any assessment; not a PR. | **TODO** |

### Player-facing reliability

| ID | Item | Status |
|----|------|--------|
| R-1 | Production turn latency — **guardrail, not an active issue.** Historical 2026-07-08 report, not reproduced since; local `processTurn` compute measured and ruled out as a cause (see ARCHIVAL.md A3-3). If latency reports return, check the HTTP/transaction layer first, not turn logic. | **GUARDRAIL** |
| R-2 | Scout progress resets on full page reload (ties A4-8). | **TODO** |
| R-3 | Worldmap smoke test (load, markers, fog stride 48 client/server parity). | **TODO** |

### Explicit cuts (do not schedule)

| Item | Why |
|------|-----|
| Full event-bus / outbox rewrite | Wrong model for Narmir |
| Big-bang `engine.js` split | Multi-week; use incremental A3-8 instead |
| PR/CI gate redesign for this campaign | Local only |

---

## Notes

- **Do not implement** speculative work beyond what's listed above without the user sessioning it on first.
- **Do not** re-inflate `index.js` — new boot concerns go under `lib/`.
- `CLAUDE.md`'s PR workflow does **not** apply to this local-only campaign.
- Systems harness recovery tip if ever needed: `b04214e2` / `chore/test-systems-harness`.

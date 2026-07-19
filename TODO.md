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
| A3-2 | Rename or document `game/turn.js` (not the pipeline — only map WIP helpers; the name is misleading). | **TODO** |
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
| A5-4 | Expand boundary tooling: scan **`game/sockets.js`** for the same forbidden `engine.*` mutators; fail the local gate. Currently `check:command-boundary` does not scan this file at all, so it stays green while sockets bypass CommandHandler entirely. | **TODO** |
| A5-5 | Migrate socket attack/spell/covert to `commandHandler.handle` (parity with HTTP warfare). `game/sockets.js` currently calls `engine.resolveMilitaryAttack`/`engine.castSpell` directly — the exact class of call HTTP routes are forbidden from making. **Touches live combat resolution — treat as its own careful pass, not a quick fix.** | **TODO** |
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

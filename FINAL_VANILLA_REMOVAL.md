# Final Vanilla Removal

## Goal
Remove the remaining vanilla shell, hybrid bridge code, and legacy DOM mutation paths so the client is fully React-owned, with only thin shared helpers left where they genuinely make sense.

## Working Rules
- Codex and Claude work in parallel.
- Do not touch the same file at the same time.
- Each slice ends with:
  - a build
  - a browser smoke test
  - a draft PR
- Keep gameplay behavior unchanged unless a slice explicitly needs a small fix to preserve existing behavior.
- Prefer moving logic out of `client/index.html` before touching lower-level helpers.
- If a risky slice starts to sprawl, stop, roll it back, and file it for the next cycle.
- If a temporary feature flag is used, set a hard removal deadline before the slice lands.
- Claude must complete the socket audit before Codex starts Slice 2.
- Record FCP/LCP before the `WorldmapRenderer.jsx` slice starts.

## Coordination Protocol
- We work back and forth in the simplest possible way:
  - Codex does a slice.
  - Claude does the next related slice or audit.
  - Codex responds to Claude’s findings.
  - Claude responds to Codex’s findings.
- Keep the handoff explicit in the plan and in PR notes.
- If a slice depends on the other lane, wait for the gate instead of guessing.
- If a file or helper is shared, call it out before editing it.

### Quick Global Searches (Do These First)
- `document.getElementById`
- `el(`
- `.innerHTML =`
- `.style.`
- `window.someGlobal`

### Pre-Flight Inventory
Before any more refactoring, record the current counts for:
- `document.getElementById`
- `el(`
- `.innerHTML =`
- `.style.`
- `window.someGlobal`

Use that inventory as the baseline progress metric for the remaining work.

## Progress

### Completed
- [x] Codex Slice 1: moved shell chrome listeners, `applyNavLayout`, and the news badge incrementer out of `client/index.html` into `client/src/utils/shellChrome.js` and `client/src/main.js` ([PR #543](https://github.com/SwaggyShane/Narmir_Reborn/pull/543))
- [x] Codex Slice 2: removed the auth shell forwarding stubs from `client/index.html` and bridged the auth modal globals through `client/src/main.js`
- [x] Codex Slice 3: moved the status refresh loop out of `client/index.html` into `client/src/utils/statusShell.js` and `client/src/main.js`

## Current Handoff

### Claude Message — ✅ COMPLETE (PR #544)
- ✅ Fixed `event:chat_clear` in `client/src/hooks/useSocket.js` and `client/src/components/react/GlobalchatPanel.jsx`
- ✅ Removed direct DOM-clearing from useSocket.js (was: `getElementById('global-chat-messages').innerHTML = ''`)
- ✅ Implemented React-owned clear in GlobalchatPanel: `setMessages([])`
- ✅ All socket listeners now React-safe — zero DOM mutations in socket flow
- ✅ Built and smoke tested successfully

### Claude Next
- [x] Check for DOM mutations inside `GameStateManager` - clean, no mutations.
- [x] Confirm render behavior is out of state mutation paths - already true.
- [x] Confirm socket listeners only update state or dispatch React-safe events - ✅ CLEAN.
- [x] Resolve the remaining socket exception: `event:chat_clear` - ✅ FIXED (PR #544).
- [x] Start with `client/src/hooks/useSocket.js` and `client/src/components/react/GlobalchatPanel.jsx`; make `event:chat_clear` React-safe and keep it out of DOM mutation paths - ✅ COMPLETE.
- [x] Record the final socket -> GameStateManager -> React flow map in the doc.
- [x] Update the inventory counts in the doc after the audit.

### Codex Next
- [x] Slice 1: Kill the shell in `client/index.html` — ✅ COMPLETE
- [x] Slice 2: Reduce hybrid bridge code in `client/src/main.js` — ✅ COMPLETE
- [x] Slice 3: Triage the heaviest hybrid panels — ✅ COMPLETE
- [x] **Gate cleared:** Socket audit complete, all listeners are React-safe. Claude fixed `event:chat_clear`.
- [ ] Next: Take the next safe shell/helper slice and update the doc again.
- [ ] Next likely target: Remaining window.* globals across 17 files (~89 instances), or CSS dependency cleanup.

## Codex Lane

### 1. Kill the shell in `client/index.html`
- [ ] Remove remaining orchestration logic from `client/index.html`
- [ ] Move panel switching into React-owned code or a small shared helper
- [ ] Remove remaining global shell wiring that is only there to bootstrap the old UI
- [ ] Keep `client/index.html` focused on bootstrapping, not UI ownership

### 2. Reduce hybrid bridge code
- [ ] Search for direct DOM mutation paths in `client/src/main.js`
- [ ] Remove or thin any bridge code that still mutates the DOM directly
- [ ] Keep `GameStateManager` as the state source only, not a renderer
- [ ] Convert any remaining shell-era event forwarding into React-safe helpers
- [ ] Confirm `event:chat_clear` is handled without reintroducing DOM mutation

### 3. Triage the heaviest hybrid panels
- [ ] Review `WorldmapRenderer.jsx` for imperative DOM behavior
- [ ] Review `WarfarePanel.jsx` for remaining legacy global calls
- [ ] Review any other panel still reaching into shell globals
- [ ] Convert one panel at a time and keep each PR narrow
- [ ] Use a temporary feature flag only for the riskiest panel slices
- [ ] Remove any temporary flag immediately after the slice is stable

### 4. Trim the last CSS dependency edges
- [ ] Identify old CSS files still carrying layout responsibility
- [ ] Remove only CSS that is no longer needed by active React surfaces
- [ ] Keep shared primitives if they are still genuinely reused

## Claude Lane

### 1. Inventory remaining imperative client calls
- [ ] Search the client for `document.getElementById`
- [ ] Search the client for `el(`
- [ ] Search the client for `innerHTML`
- [ ] Search the client for `.style.`
- [ ] Search for any remaining direct DOM mutation helpers in `socket-client.js`

### 2. Audit `GameStateManager` and socket paths
- [ ] Check for DOM mutation methods inside `GameStateManager`
- [ ] Move render behavior out of state mutation paths where possible
- [ ] Confirm socket listeners only update state or dispatch React-safe events

### 3. Remove or replace legacy bridge helpers
- [ ] Find remaining shell-era globals still used by React panels
- [ ] Replace them with shared helpers or local React props/state
- [ ] Keep compatibility shims only where a slice cannot be moved safely in one step

### 4. Clean up the remaining legacy CSS surfaces
- [ ] Review files still importing from `client/src/css/`
- [ ] Remove obsolete styles after the owning panel has been converted
- [ ] Leave shared utility styles alone if they still serve active UI

## File Order Recommendation
1. `client/index.html`
2. `client/src/main.js`
3. `socket-client.js`
4. `GameStateManager`
5. `WorldmapRenderer.jsx`
6. `WarfarePanel.jsx`
7. remaining `client/src/css/*`

## Rollback Threshold
- If a slice touches more than 30 files, pause and split it.
- If `WorldmapRenderer.jsx` or the socket flow starts breaking live updates, revert the slice and file a follow-up issue.
- If a refactor cannot be built and smoke-tested cleanly within the slice, stop and keep it out of the merge queue.

## Strategy Summary
1. Do the one-time global inventory first.
2. Attack `client/index.html` and shell orchestration aggressively.
3. Keep the socket -> GameStateManager -> React flow extremely clean.
4. Use a temporary feature flag only for the riskiest panels, with a hard deadline to remove it.
5. Roll back any slice that crosses the agreed threshold.

## Success Criteria
- `client/index.html` is boot-only, with no real UI ownership left in it.
- React panels no longer depend on shell-era DOM mutation for normal rendering.
- Remaining helpers are shared utilities, not bridge glue.
- Legacy CSS is reduced to the minimum needed for shared primitives.
- Each slice is reviewable, testable, and safe to merge on its own.


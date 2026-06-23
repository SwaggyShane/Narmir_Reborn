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
- [x] Codex Slice 4: moved `appendNewsItems` out of `client/index.html` into `client/src/utils/newsShell.js` and bridged it through `client/src/main.js`
- [x] Codex Slice 5: moved shell toast rendering out of `client/index.html` into `client/src/utils/toastShell.js` and bridged it through `client/src/main.js`
- [x] Codex Slice 6: bridged `loadKingdom` and `openKingdomProfile` through React-owned helpers so the shell no longer owns the kingdom profile/auth refresh path
- [x] Codex Slice 7: bridged `openLoreModal` and `closeLoreModal` through `client/src/utils/loreShell.js`
- [x] Codex Slice 8: bridged `showXpModal` and `closeXpModal` through `client/src/utils/xpShell.js` and `client/src/utils/showHeroXpModal.js`
- [x] Codex Slice 9: bridged `openSchoolModal` and `closeSchoolModal` through `client/src/utils/schoolShell.js`
- [x] Codex Slice 10: bridged `openGenericModal` and `closeGenericModal` through `client/src/utils/genericShell.js`
- [x] Codex Slice 11: bridged the fragment attunement modal cluster through `client/src/utils/attunementShell.js`

## Current Handoff

### Claude Message — ✅ COMPLETE (PR #546)
- ✅ Removed window globals from 7 React panels: NewsPanel, RankingsPanel, BountiesPanel, RacesPanel, KingdomProfileModal, EconomyPanel, WarfarePanel (partial)
- ✅ Created 3 new shared modules: racePortraits.js, raceData.js, economyConstants.js
- ✅ Fixed BountiesPanel regression: WarfarePanel now writes rankingsCache to GameStateManager
- ✅ ResourceStrip de-duplicated its local FARM_WORKERS_PER (now imports from economyConstants.js)
- ✅ CSS audit complete — client/src/css/ has only forum.css, all actively used
- ✅ Built and smoke tested clean

### Claude Next
- [x] All lanes from prior sessions complete — see PR #546 for full scope
- [x] WarfarePanel globals sweep — ✅ COMPLETE (in PR #546): all 16 remaining globals resolved; 1 deferred (showBattleReport, live vanilla)
- [x] MarketPanel window.targets — ✅ COMPLETE (in PR #546)
- [x] showBattleReport modal — ✅ COMPLETE (in PR #546): BattleReportModal.jsx React portal; no more window.showBattleReport in WarfarePanel
- [ ] Next: EconomyPanel upgrade defs (4 window.*_UPGRADES, requires React upgrade rendering — own slice)
- [ ] AlliancesPanel: deferred; alliance backend not yet implemented
- [x] CSS: no action needed — audit found only forum.css, all active

### Codex Next
- [x] Slice 1: Kill the shell in `client/index.html` — ✅ COMPLETE
- [x] Slice 2: Reduce hybrid bridge code in `client/src/main.js` — ✅ COMPLETE
- [x] Slice 3: Triage the heaviest hybrid panels — ✅ COMPLETE
- [x] **Gate cleared:** Socket audit complete, all listeners are React-safe. Claude fixed `event:chat_clear`.
- [x] Slice 4: moved `appendNewsItems` out of `client/index.html` into `client/src/utils/newsShell.js` and bridged it through `client/src/main.js`
- [x] Slice 5: moved shell toast rendering out of `client/index.html` into `client/src/utils/toastShell.js` and bridged it through `client/src/main.js`
- [x] Slice 6: bridged `loadKingdom` and `openKingdomProfile` through React-owned helpers
- [x] Slice 7: bridged `openLoreModal` and `closeLoreModal` through `client/src/utils/loreShell.js`
- [x] Slice 8: bridged `showXpModal` and `closeXpModal` through `client/src/utils/xpShell.js` and `client/src/utils/showHeroXpModal.js`
- [x] Slice 9: bridged `openSchoolModal` and `closeSchoolModal` through `client/src/utils/schoolShell.js`
- [x] Slice 10: bridged `openGenericModal` and `closeGenericModal` through `client/src/utils/genericShell.js`
- [x] Slice 11: bridged the fragment attunement modal cluster through `client/src/utils/attunementShell.js`
- [ ] Next: React panel window.* globals now essentially clear (PR #546). Next likely targets: port `showBattleReport` to React (removes last live vanilla bridge in WarfarePanel), EconomyPanel upgrade rendering (callIfAvailable → React), or `showHeroLore`/`openRaceLore` shell helper cluster.
- [ ] Ongoing: confirm `client/index.html` is still boot-only after Slices 1-11.

### Current Inventory Snapshot
- document.getElementById: 239
- el(: 98
- .innerHTML =: 80
- .style.: 207
- window.someGlobal: 0

## Codex Lane

### 1. Kill the shell in `client/index.html`
- [ ] Remove remaining orchestration logic from `client/index.html`
- [ ] Move panel switching into React-owned code or a small shared helper
- [ ] Remove remaining global shell wiring that is only there to bootstrap the old UI
- [ ] Keep `client/index.html` focused on bootstrapping, not UI ownership
- [ ] Use the new attunement shell helper as the pattern for the next modal/helper slice

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
- [x] Search the client for `document.getElementById` — 96 instances
- [x] Search the client for `el(` — 26 instances
- [x] Search the client for `innerHTML` — 23 instances
- [x] Search the client for `.style.` — 82 instances
- [x] Search for direct DOM mutation helpers in `socket-client.js` — createMessageRow, renderOnlineList, etc. (moved to React)

### 2. Audit `GameStateManager` and socket paths
- [x] Check for DOM mutation methods inside `GameStateManager` — CLEAN
- [x] Move render behavior out of state mutation paths — already true
- [x] Confirm socket listeners only update state or dispatch React-safe events — ✅ CLEAN

### 3. Remove or replace legacy bridge helpers — ✅ COMPLETE (all tractable globals done; 3 items correctly deferred)
- [x] Find remaining shell-era globals — ✅ Found in 7 React panels
- [x] WorldmapPanel (3 globals) — ✅ COMPLETE (PR #545): openKingdomProfile, targetFromRankings, establishTradeRoute (with auto-refresh callback for better UX)
- [x] NewsPanel (1 cache) — ✅ COMPLETE (PR #546): removed window.newsCache (write-only, never read)
- [x] KingdomProfileModal + RacesPanel (1 utility) — ✅ COMPLETE (in PR #546): getRacePortrait → new helper module client/src/utils/racePortraits.js
- [x] RankingsPanel (2 write-only caches) — ✅ COMPLETE (in PR #546): window.rankingsCache/allianceRankingsCache → GameStateManager.setState()
- [x] BountiesPanel (1 read fallback) — ✅ COMPLETE (in PR #546): removed window.rankingsCache fallback, now reads entirely from state.rankingsCache
- [x] RacesPanel (3 data globals) — ✅ COMPLETE (in PR #546): window.RACE_LORE/REGION_META/REGION_BONUSES → new data module client/src/utils/raceData.js
- [x] EconomyPanel (3 constants) — ✅ COMPLETE (in PR #546): window.FARM_WORKERS_PER/COMMODITY_VALUES/COMMODITY_RACE_DISCOUNT → new module client/src/utils/economyConstants.js; ResourceStrip also de-duplicated its local copy
- [x] WarfarePanel (window.rankingsCache + window.warLogCache writes) — ✅ COMPLETE (in PR #546): both migrated to setState()
- [x] AuthModal (window.initSocket) — ✅ COMPLETE (in PR #546): → getSocket() from socket-client.js
- [x] TestingPanel (window.socket) — ✅ COMPLETE (in PR #546): → getSocket().then() with proper off() cleanup
- [x] replayWarReport.js (window.warLogCache read) — ✅ COMPLETE (in PR #546): → gameStateManager.getState().warLogCache
- [x] WarfarePanel (16 remaining globals) — ✅ COMPLETE (in PR #546): window.spyReportsCache/allianceIntelCache/targets → setState(); window.setWarfareTab → registerWarfareTab(); window.switchTab → direct import from panelNav.js; 6 dead globals removed (castWspell, doWcovert, updateWspellCalc, initWspells, initWcovert, selectedTargetW — none defined anywhere in codebase); window.wcovTargetRaceChange uses standard browser event API
- [x] MarketPanel (window.targets read) — ✅ COMPLETE (in PR #546): → gameStateManager.getState().targets
- [x] WarfarePanel (window.showBattleReport) — ✅ COMPLETE (in PR #546): new BattleReportModal.jsx React portal; WarfarePanel uses setBattleReport() local state; vanilla battle-overlay in index.html is now unreachable from the React attack flow (Codex to remove when vanilla spell path is ported)
- [ ] EconomyPanel (4 upgrade defs) — deferred: window.*_UPGRADES passed through callIfAvailable vanilla bridge; requires converting upgrade rendering to React
- [ ] AlliancesPanel (10 vanilla delegates) — deferred; underlying alliance API not yet implemented (foundAlliance, loadAllianceSearch, etc. have no backend routes)

### 4. Clean up the remaining legacy CSS surfaces — ✅ COMPLETE (audit)
- [x] Review files still importing from `client/src/css/` — only `forum.css` exists and is actively used by main.js and Portal.jsx; nothing to remove
- [x] No obsolete styles found; shared primitives are all in active use

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

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
- Merge a slice as soon as it is finished, green, and documented. Do not park clean work unless it is blocked by an unmerged dependency.
- New protocol: after each slice, the lane owner updates this doc, runs the build + smoke test, opens the draft PR, and merges immediately if the slice is green. Claude and Codex both follow that rule for their own lanes. This doc is the only handoff needed.
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
- [x] Codex Slice 12: bridged the hero lore / race lore helper cluster through `client/src/utils/showHeroLore.js` and `client/src/utils/closeRaceLore.js`; `RacesPanel.jsx` now owns the hero lore callback directly and `client/index.html` only delegates thin wrappers
- [x] Codex Slice 13: removed the EconomyPanel `callIfAvailable` bridge, switched upgrade rendering to client-owned data helpers in `client/src/utils/economyUpgrades.js`, and kept the economy panel rendering on the React side
- [x] Codex Slice 14: bridged the battle report modal through `client/src/utils/showBattleReport.js` and `WarfarePanel.jsx`, then removed the shell-owned battle report body from `client/index.html`
- [x] Codex Slice 15: bridged the spy report modal through `client/src/utils/showSpyReport.js` and removed the shell-owned spy report body from `client/index.html`
- [x] Codex Slice 16: bridged the war replay modal through `client/src/utils/replayWarReport.js` and removed the shell-owned replay body from `client/index.html`
- [x] Codex Slice 17: removed the shell-only `showRegionDetails` helper from `client/index.html`
- [x] Codex Slice 18: removed the dead `loadAvailableSounds` shell bootstrap, wired the shared sound library through `client/src/audio.js`, and kept `playGameSound` backed by React bootstrap state

## Open PR Assessment

- [x] PR #545 merged cleanly to main.
- [x] PR #546 merged cleanly to main.
- [x] PR #543 preserved as historical branch; shell work represented by later Codex slices.
- [x] PR #544 merged cleanly to main — UpgradesList.jsx + economyUpgrades.js landed; EconomyPanel callIfAvailable fully removed.

### Current Open Queue
*(none)*

## Current Handoff

### Live Status
- Codex slices 1 through 18 are complete.
- Claude’s tracked DOM-mutation cleanup is complete for the tractable panels.
- PR queue is empty.
- `client/index.html` is still shrinking, but the remaining work is now mostly larger panel-level or backend-dependent seams.

### Claude Lane
- [x] TrainingPanel.jsx DOM mutations removed (PR #548)
- [x] StudiesPanel.jsx DOM mutations removed (PR #549)
- [x] replayWarReport.js DOM mutations removed (PR #550)
- [x] EconomyPanel.jsx DOM mutations removed (PR #552)
- [x] EconomyPanel ledger follow-up (PR #554): live financial ledger and trade route normalization fixes landed
- [x] WarfarePanel.jsx DOM mutations removed (PR #556): 19 → 0; controlled atkQty state for all troop inputs; updateAtkEstimateW replaced with atkEstimate useMemo; estimate display panel now actually renders (was computed but never shown); stale-closure bug in launchAttackW fixed; fmtN dedup removed
- [ ] AlliancesPanel remains deferred until backend routes exist

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
- [x] Slice 12: bridged the hero lore / race lore helper cluster through `client/src/utils/showHeroLore.js` and `client/src/utils/closeRaceLore.js`
- [x] Slice 13: removed the EconomyPanel `callIfAvailable` bridge, switched upgrade rendering to client-owned data helpers in `client/src/utils/economyUpgrades.js`, and kept the economy panel rendering on the React side
- [x] Slice 14: bridged the battle report modal through `client/src/utils/showBattleReport.js` and `WarfarePanel.jsx`, then removed the shell-owned battle report body from `client/index.html`
- [x] Slice 15: bridged the spy report modal through `client/src/utils/showSpyReport.js` and removed the shell-owned spy report body from `client/index.html`
- [x] Slice 16: bridged the war replay modal through `client/src/utils/replayWarReport.js` and removed the shell-owned replay body from `client/index.html`
- [x] Slice 17: removed the shell-only `showRegionDetails` helper from `client/index.html`
- [x] Slice 18: removed the dead `loadAvailableSounds` shell bootstrap, wired the shared sound library through `client/src/utils/audio.js`, and kept `playGameSound` backed by React bootstrap state
- [ ] Next: finish the last shell helper seams that still have a small, safe extraction path; otherwise move to the remaining panel-level cleanup or backend-dependent deferred items.
- [ ] Ongoing: confirm `client/index.html` keeps trending toward boot-only after Slices 1-18.

### Current Inventory Snapshot (updated 2026-06-24 post-PR #556)
- document.getElementById: 160 total (134 in index.html [Codex target], 26 in client/src/)
  - Biggest src concentrations: panelNav.js 5, socket-client.js 5, GlobalchatPanel 4, MarketPanel 2; WarfarePanel now 0; EconomyPanel 1 (renderUpgrades export for DefensePanel)
- el(: 20 in index.html (local variable pattern, not a helper); ~18 in client/src/
- .innerHTML =: 72 total (45 in index.html, 27 in client/src/)
- .style.: 167 total (46 in index.html, 121 in client/src/)
- window.* globals (non-bootstrap): 10 AlliancesPanel deferred; main.js bootstrap exports (~31); socket-client.js bootstrap (4); 1 GameStateManager; 0 in utils (clean)

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
- [x] EconomyPanel (4 upgrade defs) — ✅ COMPLETE (PR #544): UpgradesList.jsx + economyUpgrades.js; all callIfAvailable removed
- [ ] AlliancesPanel (10 vanilla delegates) — deferred; underlying alliance API not yet implemented (foundAlliance, loadAllianceSearch, etc. have no backend routes)
- [x] TrainingPanel.jsx (13 DOM mutations) — ✅ COMPLETE: all removed; Max/Distribute buttons fixed; toast imported
- [x] StudiesPanel.jsx (14 DOM mutations) — ✅ COMPLETE (PR #549): all removed; controlled inputs; JSX rendering; useRef focus guards; server sync
- [x] replayWarReport.js (21 DOM mutations) — ✅ COMPLETE (PR #550): ReplayModal.jsx React portal; vanilla bridge function and replay-modal div removed from index.html
- [x] EconomyPanel.jsx (27 → 1 DOM mutations) — ✅ COMPLETE (PR #552): converted all 27 getElementById calls to React state; removed dead exports (loadEconomy, renderCommodityMarket, renderActiveMercs); replaced innerHTML upgrade containers with UpgradesList component; bank visibility now driven by state.bld_vaults; tax rate initialized from state.tax; applyGameMutation/syncUI wired to all mutating handlers; 1 getElementById remains in exported renderUpgrades() which DefensePanel imports directly
- [x] EconomyPanel ledger follow-up — ✅ COMPLETE (PR #554): extended /economy/overview to compute and return taxIncome, marketIncome, tradeRouteIncome, totalIncome, troopUpkeep, netIncome; uses loadTradeRoutes() helper for normalization; applies SUPPORT_CAP_RACE multipliers and fragmentBonusManager barracks discount to match processTurn exactly; financial ledger in EconomyPanel now shows real values instead of hardcoded zeros
- [x] WarfarePanel.jsx (19 → 0 DOM mutations) — ✅ COMPLETE (PR #556): atkQty controlled state for all 9 troop inputs; updateAtkEstimateW callback + useEffect replaced with atkEstimate useMemo; estimate display panel added to JSX (was computed but elements were missing, so it was never visible); setMaxValue DOM write replaced with setAtkMax; launchAttackW stale-closure bug fixed (atkQty added to deps); fmtN removed (duplicate of fmt)

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

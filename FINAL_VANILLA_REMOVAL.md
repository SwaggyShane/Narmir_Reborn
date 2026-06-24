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
- [x] Codex Slice 19: major `client/index.html` cleanup — removed inline shell CSS/JS; boot-only entry (modals as empty containers)
- [x] Codex Slice 20: `GameShell.jsx` + `main.jsx` — React owns the full shell; `main.js` deleted
- [x] Codex Slice 21 (`GameShell_migration` branch): pure Tailwind grid shell, React panel routing via `useActivePanel`, `panelNav` DOM toggles removed, panel wrappers normalized
- [x] WarfarePanel.jsx DOM mutations removed (PR #556, cherry-picked onto `GameShell_migration`): 19 → 0; controlled `atkQty` state; `atkEstimate` useMemo; `targetKey()` retained from Slice 21

## Open PR Assessment

- [x] PR #545 merged cleanly to main.
- [x] PR #546 merged cleanly to main.
- [x] PR #543 preserved as historical branch; shell work represented by later Codex slices.
- [x] PR #544 merged cleanly to main — UpgradesList.jsx + economyUpgrades.js landed; EconomyPanel callIfAvailable fully removed.

### Current Open Queue
*(none)*

## Current Handoff

### Live Status
- **Active branch:** `gameshell-local` (local source of truth; cherry-pick of PR #558 + follow-up slices)
- Codex slices 1 through 26 complete; post-merge local work: AlliancesPanel, MessagesPanel, portal auth, splash routing.
- `client/index.html` is boot-only (~70 lines): mount point, error logging, empty modal containers.
- `main.jsx` is minimal (~26 lines): `escapeHtml` polyfill + `GameShell` mount. `main.js` is deleted.
- Shell layout and panel routing are React-owned (`GameShell.jsx`, `useActivePanel`, Tailwind grid).
- Remaining optional debt: none tracked in `client/src` panel/shell DOM inventory; merge `gameshell-local` → `main` when ready.

### Claude Lane
- [x] TrainingPanel.jsx DOM mutations removed (PR #548)
- [x] StudiesPanel.jsx DOM mutations removed (PR #549)
- [x] replayWarReport.js DOM mutations removed (PR #550)
- [x] EconomyPanel.jsx DOM mutations removed (PR #552)
- [x] EconomyPanel ledger follow-up (PR #554): live financial ledger and trade route normalization fixes landed
- [x] WarfarePanel.jsx DOM mutations removed (PR #556): 19 → 0; controlled `atkQty` state for all 9 troop inputs; `atkEstimate` useMemo (estimate panel now renders in JSX); `setAtkMax` replaces setMaxValue DOM write; stale-closure fix in `launchAttackW`; `targetKey()` from Slice 21 retained; fmtN dedup removed
- [x] AlliancesPanel.jsx — React-only; wired to /api/alliance/* routes and socket alliance chat

### Codex Next (post-Slice 21)
- [x] Slice 19–21: shell kill + GameShell + pure Tailwind layout — ✅ COMPLETE on `GameShell_migration`
- [x] **Slice 22a:** Mount global overlays in `GameShell` — `AuthModal`, `KingdomProfileModal`, `SchoolSelectionController`; fixed `fixed inset-0 z-modal` positioning on auth/profile backdrops
- [x] **Slice 22b:** Gut `syncUI()` — removed zombie DOM writes from `panelNav.js`, dropped `gameStateManager.subscribe(syncUI)`, removed calls from Economy/Market/UpgradesList
- [x] **Slice 23:** Globalchat + `socket-client.js` chat rendering → React-only (`GlobalchatPanel` state, `ChatMessageRow`, slim `socket-client.js`)
- [x] **Slice 24:** Modal migration — `ToastProvider`, `HeroXpModalController`, `LoreEntryController`, `GenericModalController`, `SpyReportModalController`; shell bridges thinned
- [x] **Slice 25:** Dead code purge — deleted orphan shells (`newsShell`, `attunementShell`, `schoolShell`, `renderTargets`, `toastShell`, `loreShell`, `genericShell`, `xpShell`, `closeRaceLore`); replaced `applyNavLayout` body classes with `useNavLayout` hook; removed ResourceStrip legacy metric ids
- [x] **Slice 26:** Worldmap React migration — deleted `WorldmapLegend.jsx`; region legend + highlight in `WorldmapPanel`; SVG uses `data-kingdom-id` + click delegation (no broken `onclick` globals); `event:world_updated` → `narmir:worldmap-refresh`
- [x] **Slice 27 (local):** AlliancesPanel, MessagesPanel, DefensePanel UpgradesList, MarketPanel trade DOM purge
- [x] **Slice 28 (local):** BuildPanel — 0 getElementById; unified `ba-*` allocation keys; React build queue + hammer durability; vampire shrine/mausoleum visibility
- [x] **Slice 29 (local):** `useRegenCountdown` hook (Topbar + useGameActions); expedition log event bridge replaces `expeditionLog.mjs` DOM injection
- [x] **Slice 30 (local):** `socket-client.js` npm `socket.io-client` import (0 DOM); dropped `window.__narmir*` / `gameStateManager` / `closeGenericModal` / `escapeHtml` globals; shared `escapeHtml.js` util
- [ ] Ongoing: validate locally on `gameshell-local`; merge to `main` when ready (draft PR #559 on remote)

### Current Inventory Snapshot (updated 2026-06-24 post-Slice 30 local)
- document.getElementById: **0 in index.html**, **3 in client/src/** (React mount roots only: `app`, `portal-root`, `splash-root`)
- el(: 0 in index.html; ~18 in client/src/
- .innerHTML =: **0 in index.html**, **0 in client/src/**
- .style.: **0 in index.html**, ~30 in client/src/ (inline React handlers only; no socket-client DOM)
- window.* globals (non-event-bus): **0** — remaining `window.dispatchEvent` / `addEventListener` are intentional React event bus

## Codex Lane

### 1. Kill the shell in `client/index.html` — ✅ COMPLETE (Slices 19–21)
- [x] Remove remaining orchestration logic from `client/index.html`
- [x] Move panel switching into React-owned code (`useActivePanel`, `GameShell.jsx`)
- [x] Remove remaining global shell wiring that is only there to bootstrap the old UI
- [x] Keep `client/index.html` focused on bootstrapping, not UI ownership
- [x] Modal portals mounted in `GameShell` (Slice 24); attunement shell deleted in Slice 25

### 2. Reduce hybrid bridge code — COMPLETE
- [x] `main.js` deleted; `main.jsx` is mount-only (no bridge exports)
- [x] Remove `syncUI()` zombie DOM writes in `panelNav.js` (Slice 22b)
- [x] `GameStateManager` is the state source; panels render from React hooks
- [x] `event:chat_clear` handled without reintroducing shell DOM mutation
- [x] Convert remaining `*Shell` modal bridges to React portals (Slice 24)

### 3. Triage the heaviest hybrid panels — WarfarePanel done; chat remains
- [x] Review `WorldmapRenderer.jsx` for imperative DOM behavior — Slice 26: legend DOM removed; renderer is pure SVG string builder
- [x] `WarfarePanel.jsx` — 0 `getElementById` (PR #556)
- [x] `GlobalchatPanel.jsx` + `socket-client.js` — chat rendering React-only (Slice 23)
- [x] Convert one panel at a time and keep each PR narrow — all tractable panels done

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
- [x] AlliancesPanel (10 vanilla delegates) — COMPLETE: full React state, API + socket chat, no window.* bridges
- [x] TrainingPanel.jsx (13 DOM mutations) — ✅ COMPLETE: all removed; Max/Distribute buttons fixed; toast imported
- [x] StudiesPanel.jsx (14 DOM mutations) — ✅ COMPLETE (PR #549): all removed; controlled inputs; JSX rendering; useRef focus guards; server sync
- [x] replayWarReport.js (21 DOM mutations) — ✅ COMPLETE (PR #550): ReplayModal.jsx React portal; vanilla bridge function and replay-modal div removed from index.html
- [x] EconomyPanel.jsx (27 → 0 DOM mutations) — COMPLETE: UpgradesList everywhere; removed renderUpgrades/buyUpgrade DOM exports (Slice 27 local)
- [x] DefensePanel.jsx — COMPLETE (Slice 27 local): wall/tower/outpost upgrades via UpgradesList; 0 getElementById
- [x] MarketPanel.jsx — COMPLETE (Slice 27 local): removed renderTradeOffers innerHTML bridge; trade lists fully React
- [x] MessagesPanel.jsx — COMPLETE (Slice 27 local): /api/messages inbox + socket message:received
- [x] BuildPanel.jsx — COMPLETE (Slice 28 local): 0 getElementById; ba-* allocation keys unified; React build queue + hammer durability; vampire shrine/mausoleum toggle
- [x] useGameActions.js + Topbar.jsx — COMPLETE (Slice 29 local): `useRegenCountdown` replaces `#regen-countdown` DOM read
- [x] expeditionLog — COMPLETE (Slice 29 local): deleted `expeditionLog.mjs` innerHTML bridge; `narmir:expedition-log-entry` event from ResourcesPanel to ExplorationPanel
- [x] socket-client.js — COMPLETE (Slice 30 local): `socket.io-client` npm import; 0 DOM; dropped `window.__narmir*` bootstrap
- [x] Bootstrap globals purge — COMPLETE (Slice 30 local): `gameStateManager`, `closeGenericModal`, `escapeHtml` window exports removed; `escapeHtml.js` shared util
- [x] App event bus — COMPLETE (Slice 31 local): `appEvents.js` + `useAppEvent` replace all `window.dispatchEvent`/`addEventListener` cross-panel bridges; `BottomNav` badges are React state; dead `game-data-updated` and `wcovTargetRaceChange` listeners removed
- [x] EconomyPanel ledger follow-up — ✅ COMPLETE (PR #554): extended /economy/overview to compute and return taxIncome, marketIncome, tradeRouteIncome, totalIncome, troopUpkeep, netIncome; uses loadTradeRoutes() helper for normalization; applies SUPPORT_CAP_RACE multipliers and fragmentBonusManager barracks discount to match processTurn exactly; financial ledger in EconomyPanel now shows real values instead of hardcoded zeros
- [x] WarfarePanel.jsx (19 → 0 DOM mutations) — ✅ COMPLETE (PR #556): `atkQty` controlled state for all 9 troop inputs; `atkEstimate` useMemo; estimate display panel in JSX; `setAtkMax` replaces setMaxValue DOM write; `launchAttackW` stale-closure fix; `targetKey()` from Slice 21 retained; fmtN removed (duplicate of fmt)

### 4. Clean up the remaining legacy CSS surfaces — shell CSS removed in Slice 21
- [x] Shell layout CSS (`.game-shell`, `.resource-strip`, `.shell-footer`, etc.) removed from `tailwind.css`; layout is pure Tailwind in `GameShell.jsx`
- [x] Review files still importing from `client/src/css/` — only `forum.css` exists and is actively used by Portal.jsx; nothing to remove
- [x] No obsolete styles found; shared primitives are all in active use

## File Order Recommendation (post-Slice 21)
1. ~~`client/src/utils/panelNav.js` — gut `syncUI()` (Slice 22b)~~ ✅
2. ~~`client/src/socket-client.js` + `GlobalchatPanel.jsx` — chat DOM (Slice 23)~~ ✅
3. ~~`*Shell` modal helpers — React portals (Slice 24)~~ ✅
4. ~~Dead code purge (Slice 25)~~ ✅
5. ~~`WorldmapRenderer.jsx` — audit imperative DOM (Slice 26)~~ ✅
6. Merge `gameshell-local` → `main` **← next** (draft PR #559)
7. Merge `gameshell-local` → `main` (draft PR #559 stale vs local)

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

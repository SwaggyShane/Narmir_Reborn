# Vanilla → React Migration Plan

Divide-and-conquer migration of all vanilla JS action files into React components and hooks.
Each slice is a single PR. Slices are worked one at a time as directed. Do not touch files
outside the slice currently assigned.

---

## File Ownership Rules

- Only modify files listed under the active slice's **Touches** section.
- If a file is not listed, do not touch it — even to "clean up" something noticed in passing.
- `PROTECTED_WORK.md` files (`game/combat-new.js`, `game/combat-resolver.js`) are off-limits always.

---

## Slice 0 — Foundation

**Goal:** Replace the `window.*` interop layer with proper React primitives. All other slices
depend on this landing first.

**Touches:**
- `client/src/hooks/useGameState.js` — finish / wire `useGameMetrics`
- `client/src/hooks/useActivePanel.js` — finish / wire
- `client/src/hooks/useGameActions.js` — create (takeTurn, quickSearch, castSpell, attack)
- `client/src/hooks/usePanelState.js` — create
- `client/src/GameStateManager.js` — audit; remove any direct DOM calls
- `client/src/utils/switchTab.js` — migrate logic into `useActivePanel`, then delete
- `client/src/utils/gameMutations.js` — migrate into `useGameActions`, then delete
- `client/src/utils/socketHandlers.js` — convert to `useSocket` hook in `hooks/useSocket.js`
- `client/src/utils/shellBridge.js` — delete once `window.*` assignments are removed
- `client/src/utils/applyNavLayout.js` — audit; delete if layout is owned by Sidebar/BottomNav JSX
- `client/src/main.js` — remove `window.*` assignments as each is replaced

**Creates:**
- `client/src/hooks/useGameActions.js`
- `client/src/hooks/usePanelState.js`
- `client/src/hooks/useSocket.js`

**Does NOT touch:** any panel JSX, any action file, any game/ server code.

---

## Slice 1 — Economy

**Goal:** Absorb all economy action files into the existing React economy panels.

**Touches:**
- `client/src/actions/loadEconomy.js` — delete after migrating
- `client/src/actions/economyUpgrades.js` — delete after migrating
- `client/src/actions/economyTrades.js` — delete after migrating
- `client/src/actions/economyRenderers.js` — delete after migrating
- `client/src/actions/buyUpgrade.js` — delete after migrating
- `client/src/components/react/EconomyPanel.jsx` — absorbs load + upgrade logic
- `client/src/components/react/MarketPanel.jsx` — absorbs trade logic

**Does NOT touch:** any other action file, any other panel, Slice 0 hooks (consume only).

---

## Slice 2 — Warfare

**Goal:** Absorb all warfare action files into the existing React warfare panels.

**Touches:**
- `client/src/actions/loadWarfarePanel.js` — delete after migrating
- `client/src/actions/renderTargets.js` — delete after migrating
- `client/src/actions/renderWarfareTargets.js` — delete after migrating
- `client/src/actions/replayWarReport.js` — delete after migrating
- `client/src/components/react/WarfarePanel.jsx` — absorbs load logic
- `client/src/components/react/WarfareIntelTab.jsx` — absorbs target rendering
- `client/src/components/react/WarfareReportsTab.jsx` — absorbs replay logic

**Does NOT touch:** any other action file, any other panel, Slice 0 hooks (consume only).

---

## Slice 3 — World Map

**Goal:** Absorb all world map action files into `WorldmapPanel.jsx`.

**Touches:**
- `client/src/actions/renderWorldMap.js` — delete after migrating
- `client/src/actions/loadWorldMap.js` — delete after migrating
- `client/src/actions/worldMapLegend.js` — delete after migrating
- `client/src/actions/showMapKingdomCard.js` — delete after migrating
- `client/src/components/react/WorldmapPanel.jsx` — absorbs all map logic

**Creates (if needed):**
- `client/src/components/react/WorldmapLegend.jsx`
- `client/src/components/react/MapKingdomCard.jsx`

**Does NOT touch:** any other action file, any other panel.

---

## Slice 4 — Auth / Profile

**Goal:** Replace DOM-based auth modal and kingdom profile modal with React components.

**Touches:**
- `client/src/actions/authModal.js` — delete after migrating
- `client/src/actions/logout.js` — delete after migrating
- `client/src/actions/openKingdomProfile.js` — delete after migrating
- `client/src/actions/loadKingdom.js` — delete after migrating
- `client/src/utils/kingdomProfileModal.js` — delete after migrating
- `client/src/components/react/Topbar.jsx` — wire logout + auth trigger
- `client/src/components/react/OptionsPanel.jsx` — wire logout if applicable

**Creates:**
- `client/src/components/react/AuthModal.jsx`
- `client/src/components/react/KingdomProfileModal.jsx`

**Does NOT touch:** any other action file, any other panel.

---

## Slice 5 — Lore / Heroes

**Goal:** Replace DOM-based lore modals with React components.

**Touches:**
- `client/src/actions/openRaceLore.js` — delete after migrating
- `client/src/actions/showHeroLore.js` — delete after migrating
- `client/src/utils/loreModal.js` — delete after migrating
- `client/src/components/react/RacesPanel.jsx` — inline lore trigger
- `client/src/components/react/HeroesPanel.jsx` — inline lore pane

**Creates:**
- `client/src/components/react/LoreModal.jsx`

**Does NOT touch:** any other action file, any other panel.

---

## Slice 6 — Turn + Final Cleanup

**Goal:** Migrate the last action file, remove all remaining `window.*` globals, clean `main.js`.

**Touches:**
- `client/src/actions/takeTurn.js` — delete after migrating into `useGameActions`
- `client/src/utils/shellBridge.js` — delete (should be empty by now)
- `client/src/main.js` — final cleanup; only `ReactDOM.createRoot(...).render(<App />)` remains
- Any surviving `window.*` references across the client tree

**Does NOT touch:** game/ server code, any panel not already cleaned.

---

## Pure Utilities — Do Not Migrate

These are already clean and framework-agnostic. Leave them alone:

- `client/src/utils/api.js`
- `client/src/utils/fmt.js`
- `client/src/utils/numberFormat.js`
- `client/src/utils/xp.js`
- `client/src/utils/toast.js`
- `client/src/utils/repairMojibake.js`

---

## Sequencing

```
Slice 0 (foundation)
    └── Slice 1 (economy)   ─┐
    └── Slice 2 (warfare)   ─┤ parallel after Slice 0 lands
    └── Slice 3 (world map) ─┤
    └── Slice 4 (auth)      ─┘
    └── Slice 5 (lore)      ─┘
        └── Slice 6 (final cleanup)
```

---

## Status

| Slice | Status |
|---|---|
| 0 — Foundation | ⬜ Not started |
| 1 — Economy | ⬜ Not started |
| 2 — Warfare | ⬜ Not started |
| 3 — World Map | ⬜ Not started |
| 4 — Auth / Profile | ⬜ Not started |
| 5 — Lore / Heroes | ⬜ Not started |
| 6 — Final Cleanup | ⬜ Not started |

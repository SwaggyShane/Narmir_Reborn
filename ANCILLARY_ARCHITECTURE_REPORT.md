# Ancillary Architecture Report

**Scope:** Vanilla JS removal, Tailwind purity, Zustand migration, legacy admin cleanup, and monolith avoidance.

**Date:** 2026-06-27

## Current State

- Tailwind is the default React styling path, but not the only one.
- Zustand is established, but `GameStateManager` is still active.
- Legacy admin is archived in docs, but fallback routes still exist in `index.js`.
- Large coordination files still exist, so monolith drift is still possible.

## Main Gaps

- Tailwind is dominant, not pure.
- Zustand migration is incomplete.
- Legacy admin runtime compatibility still exists.
- Legacy bridge files still exist for panel state and mutation flow.

## Cleanup Order

1. Finish Zustand cutover.
2. Remove `GameStateManager` consumers.
3. Delete `GameStateManager.js` after imports are gone.
4. Enforce Tailwind-only defaults for static styling.
5. Remove legacy admin compatibility after verification.
6. Add guardrails so new work does not recreate monoliths.

## Remaining Zustand Bridges

- `client/src/hooks/useGameState.js`
- `client/src/hooks/usePanelState.js`
- `client/src/hooks/useGameActions.js`
- `client/src/hooks/useKingdomRank.js`
- `client/src/hooks/useRegenCountdown.js`
- `client/src/utils/gameMutations.js`
- `client/src/utils/panelNav.js`
- `client/src/utils/replayWarReport.js`
- `client/src/components/react/AuthModal.jsx`
- `client/src/components/react/EconomyPanel.jsx`
- `client/src/components/react/DefensePanel.jsx`
- `client/src/components/react/MarketPanel.jsx`
- `client/src/components/react/ResourcesPanel.jsx`
- `client/src/components/react/SchoolSelectionController.jsx`
- `client/src/components/react/StudiesPanel.jsx`
- `client/src/components/react/WorldmapRenderer.jsx`
- `client/src/components/react/MapKingdomCard.jsx`

## Low-Risk First Targets

- `HappinessPanel`
- `HappinessWidget`
- `NewsPanel`
- `ExplorationPanel`

## Rules

- Static layout and typography should use Tailwind.
- Inline styles should stay limited to computed values or CSS variables.
- New code should not add new `GameStateManager` dependencies.
- Legacy admin fallbacks should be removed after verification.

## Red Flags

- new `GameStateManager` imports
- new hooks that read state from a singleton instead of stores
- new static inline styles
- new one-off CSS files
- new admin fallback flags
- large patches that mix `index.js` and game logic

## Bottom Line

The repo is moving the right way, but it is not pure yet.
The next clean phase is Zustand completion, then Tailwind tightening, then legacy admin removal.

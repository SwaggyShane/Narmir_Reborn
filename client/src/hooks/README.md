# Game State Hooks

Legacy compatibility hooks for older code paths that still depend on the singleton bridge.
New work should use the domain stores in `client/src/stores/`.

## Keep Using These For

- `useActivePanel()` for active-panel tracking
- `usePanelState()` for legacy per-panel state
- `useGameActions()` for older action flows
- `useGameMetrics()` and `useGameState()` only where the singleton bridge is still required

## What This Folder Is

- A bridge, not the destination
- A compatibility layer for remaining legacy consumers
- A place to keep older flows working while they are retired

## What New Code Should Do

- Read from Zustand selectors
- Write through store actions
- Avoid adding new `GameStateManager` dependencies

## Migration Rule

If a panel can be expressed with the stores, do that instead of extending this layer.

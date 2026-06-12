import { useSyncExternalStore } from 'react';
import { gameStateManager } from '../GameStateManager';

// Subscribes a component to the shared kingdom state. The component re-renders
// whenever any field changes. Reads pull from gameStateManager.getState().
export function useGameState() {
  const state = useSyncExternalStore(
    (listener) => gameStateManager.subscribe(listener),
    () => gameStateManager.getState()
  );

  const applyUpdates = (updates, reason = 'update') => {
    gameStateManager.applyUpdates(updates, reason);
  };

  return { state, applyUpdates };
}

// Back-compat alias for existing call sites.
export function useGameMetrics() {
  const { state, applyUpdates } = useGameState();
  return { metrics: state, updateMetrics: (u) => applyUpdates(u, 'metrics_update') };
}

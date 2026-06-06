import { useSyncExternalStore } from 'react';
import { gameStateManager } from '../GameStateManager';

export function useGameMetrics() {
  const metrics = useSyncExternalStore(
    (listener) => gameStateManager.subscribe(listener),
    () => gameStateManager.getMetrics()
  );

  const updateMetrics = (updates) => {
    gameStateManager.updateMetrics(updates);
  };

  return { metrics, updateMetrics };
}

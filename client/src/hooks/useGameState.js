/**
 * DEPRECATED: This hook is no longer functional.
 *
 * GameStateManager has been removed. All state must use Zustand domain stores in `client/src/stores/`.
 * Migrate any code using this hook to use the appropriate Zustand store directly.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';

export function useGameState() {
  throw new Error('useGameState is deprecated. Use Zustand stores directly instead.');

  const applyUpdates = useCallback((updates, context) => {
    gameStateManager.applyUpdates(updates, context);
  }, []);

  return { state, setState, applyUpdates };
}

export function useGameSelector(selector, fallback) {
  const { state } = useGameState();
  try {
    return selector(state);
  } catch {
    return fallback;
  }
}

export function useGameMutationEvents(listener) {
  useEffect(() => {
    if (typeof listener !== 'function') return undefined;
    return gameStateManager.subscribeToMutations(listener);
  }, [listener]);
}

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

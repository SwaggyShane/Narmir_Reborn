import { useEffect, useSyncExternalStore } from 'react';
import { gameStateManager } from '../GameStateManager';

export function useGameState() {
  const state = useSyncExternalStore(
    (listener) => gameStateManager.subscribe(listener),
    () => gameStateManager.getState()
  );

  const setState = (nextState, context) => {
    gameStateManager.setState(nextState, context);
  };

  const applyUpdates = (updates, context) => {
    gameStateManager.applyUpdates(updates, context);
  };

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

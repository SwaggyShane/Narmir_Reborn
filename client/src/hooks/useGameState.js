import { useEffect } from 'react';

export function useGameMutationEvents(listener) {
  // No-op: GameStateManager removed. Components should use store subscriptions directly.
  useEffect(() => {
    if (typeof listener !== 'function') return undefined;
    // Mutation events no longer needed - state updates trigger Zustand re-renders automatically
    return undefined;
  }, [listener]);
}

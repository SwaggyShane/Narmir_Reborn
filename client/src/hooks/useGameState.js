/**
 * DEPRECATED: All functions in this file are no longer functional.
 *
 * GameStateManager has been removed. All state must use Zustand domain stores in `client/src/stores/`.
 * Migrate any code using these hooks to use the appropriate Zustand store directly.
 */
import { useEffect } from 'react';

export function useGameState() {
  throw new Error('useGameState is deprecated. Use Zustand stores directly instead.');
}

export function useGameSelector(selector, fallback) {
  throw new Error('useGameSelector is deprecated. Use Zustand stores directly instead.');
}

export function useGameMutationEvents(listener) {
  // No-op: GameStateManager removed. Components should use store subscriptions directly.
  useEffect(() => {
    if (typeof listener !== 'function') return undefined;
    // Mutation events no longer needed - state updates trigger Zustand re-renders automatically
    return undefined;
  }, [listener]);
}

export function useGameMetrics() {
  throw new Error('useGameMetrics is deprecated. Use Zustand stores directly instead.');
}

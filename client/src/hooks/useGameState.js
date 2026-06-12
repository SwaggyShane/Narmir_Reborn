import { useSyncExternalStore, useRef, useCallback } from 'react';
import { gameStateManager } from '../GameStateManager';

// Subscribes a component to the shared kingdom state. The component re-renders
// whenever ANY field changes. Use useGameSelector() instead if you only need
// a slice of state and want to avoid unnecessary re-renders.
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

// Narrow subscription: component only re-renders when the selected slice
// changes (compared with Object.is). Use for components that read one or
// two fields out of many — avoids re-renders on unrelated mutations.
//
//   const gold = useGameSelector(s => s.gold);
//   const { fighters, rangers } = useGameSelector(
//     s => ({ fighters: s.fighters, rangers: s.rangers }),
//     shallowEqual,
//   );
//
// For object selections, pass an `isEqual` comparator to avoid re-renders
// from new object identity each call. A shallowEqual is exported below.
export function useGameSelector(selector, isEqual = Object.is) {
  // Cache the last-derived slice ACROSS renders so getSnapshot returns a
  // stable reference when the underlying state changes but the selected
  // slice does not. Without this, object selectors would re-render on
  // every mutation because { fighters, rangers } is a fresh object each call.
  const cacheRef = useRef({ has: false, value: undefined });

  const getSnapshot = useCallback(() => {
    const next = selector(gameStateManager.getState());
    if (cacheRef.current.has && isEqual(cacheRef.current.value, next)) {
      return cacheRef.current.value;
    }
    cacheRef.current = { has: true, value: next };
    return next;
  }, [selector, isEqual]);

  return useSyncExternalStore(
    (listener) => gameStateManager.subscribe(listener),
    getSnapshot,
  );
}

export function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.is(a[k], b[k])) return false;
  return true;
}

// Back-compat alias for existing call sites.
export function useGameMetrics() {
  const { state, applyUpdates } = useGameState();
  return { metrics: state, updateMetrics: (u) => applyUpdates(u, 'metrics_update') };
}

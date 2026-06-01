import { useSyncExternalStore } from 'react';

let listeners = new Set();
let snapshot = window.gameState ? { ...window.gameState } : {};

export function notifyGameStateChange() {
  snapshot = { ...window.gameState };
  listeners.forEach(l => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

export function useGameState() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

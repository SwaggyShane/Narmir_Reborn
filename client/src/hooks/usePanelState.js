/**
 * Legacy panel-state bridge.
 *
 * This keeps older panels working while the Zustand migration finishes.
 * Prefer domain stores and selectors for new panel state.
 */
import { useState } from 'react';
import { gameStateManager } from '../GameStateManager.js';

export function usePanelState(panelName, initialState = {}) {
  const [state, setState] = useState(() => {
    return gameStateManager.getPanelState(panelName) ?? initialState;
  });

  const setPanelState = (nextState) => {
    const prevState = gameStateManager.getPanelState(panelName) ?? {};
    const merged = typeof nextState === 'function'
      ? nextState(prevState)
      : { ...prevState, ...nextState };
    gameStateManager.setPanelState(panelName, merged);
    setState(merged);
  };

  return { state, setState: setPanelState };
}

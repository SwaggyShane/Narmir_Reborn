import { useState } from 'react';
import { gameStateManager } from '../GameStateManager.js';

export function usePanelState(panelName, initialState = {}) {
  const [state, setState] = useState(() => {
    return gameStateManager.getPanelState(panelName) ?? initialState;
  });

  const setPanelState = (nextState) => {
    const merged = typeof nextState === 'function'
      ? nextState(state)
      : { ...state, ...nextState };
    gameStateManager.setPanelState(panelName, merged);
    setState(merged);
  };

  return { state, setState: setPanelState };
}

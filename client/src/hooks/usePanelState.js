import { useState } from 'react';
import { gameStateManager } from '../GameStateManager.js';

export function usePanelState(panelName, initialState = {}) {
  const [state, setState] = useState(() => {
    return gameStateManager.getPanelState(panelName) ?? initialState;
  });

  const setPanelState = (nextState) => {
    setState((prevState) => {
      const merged = typeof nextState === 'function'
        ? nextState(prevState)
        : { ...prevState, ...nextState };
      gameStateManager.setPanelState(panelName, merged);
      return merged;
    });
  };

  return { state, setState: setPanelState };
}

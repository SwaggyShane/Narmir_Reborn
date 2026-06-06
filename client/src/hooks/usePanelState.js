import { useState, useEffect } from 'react';
import { useActivePanel } from './useActivePanel';
import { gameStateManager } from '../GameStateManager';

export function usePanelState(panelName, initialState) {
  const { activePanel } = useActivePanel();
  const [state, setState] = useState(() => {
    // Try to restore from global manager first, fall back to initial state
    const savedState = gameStateManager.getPanelState(panelName);
    return savedState !== undefined ? savedState : initialState;
  });

  useEffect(() => {
    // Save state to global manager whenever it changes
    gameStateManager.setPanelState(panelName, state);
  }, [panelName, state]);

  return {
    state,
    setState,
    isActive: activePanel === panelName
  };
}

import { useState } from 'react';
import { useActivePanel } from './useActivePanel';

export function usePanelState(panelName, initialState) {
  const [state, setState] = useState(initialState);
  const { activePanel } = useActivePanel();

  return {
    state,
    setState,
    isActive: activePanel === panelName
  };
}

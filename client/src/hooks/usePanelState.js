/**
 * Legacy panel-state hook (deprecated).
 *
 * GameStateManager removed. This now just provides local component state.
 * Prefer domain stores and selectors for new panels.
 */
import { useState } from 'react';

export function usePanelState(panelName, initialState = {}) {
  const [state, setState] = useState(initialState);

  const setPanelState = (nextState) => {
    setState((prevState) =>
      typeof nextState === 'function'
        ? nextState(prevState)
        : { ...prevState, ...nextState }
    );
  };

  return { state, setState: setPanelState };
}

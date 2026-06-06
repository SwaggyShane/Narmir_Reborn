import { useState, useEffect } from 'react';
import { gameStateManager } from '../GameStateManager';

let activePanel = 'news';
const activePanelListeners = new Set();

export function setActivePanelGlobal(panelName) {
  activePanel = panelName;
  activePanelListeners.forEach(listener => {
    try {
      listener(panelName);
    } catch (e) {
      console.error('[setActivePanel] Listener error:', e);
    }
  });
}

export function useActivePanel() {
  const [currentPanel, setCurrentPanel] = useState(activePanel);

  useEffect(() => {
    activePanelListeners.add(setCurrentPanel);
    return () => activePanelListeners.delete(setCurrentPanel);
  }, []);

  return {
    activePanel: currentPanel,
    setActivePanel: setActivePanelGlobal,
  };
}

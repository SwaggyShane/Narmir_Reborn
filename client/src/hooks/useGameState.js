import { useState, useEffect } from 'react';
import { gameStateManager } from '../GameStateManager';

export function useGameMetrics() {
  const [metrics, setMetrics] = useState(() => gameStateManager.getMetrics());

  useEffect(() => {
    const unsubscribe = gameStateManager.subscribe((updatedMetrics) => {
      setMetrics(updatedMetrics);
    });

    return unsubscribe;
  }, []);

  const updateMetrics = (updates) => {
    gameStateManager.updateMetrics(updates);
  };

  return { metrics, updateMetrics };
}

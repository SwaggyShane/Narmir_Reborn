import { useCallback, useEffect, useState } from 'react';
import { apiCall } from '../utils/api';
import { useGameMutationEvents } from './useGameState.js';

export function useActiveExpeditionsSummary() {
  const [active, setActive] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const data = await apiCall('/api/kingdom/expedition/list');
      const rows = Array.isArray(data?.active) ? data.active : [];
      setActive(rows.filter((row) => Number(row?.turns_left ?? 0) > 0 || row?.rewards == null));
    } catch (err) {
      console.error('[expeditions] summary refresh failed:', err);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useGameMutationEvents(
    useCallback((event) => {
      const reason = String(event?.reason || '');
      if (
        reason === 'turn' ||
        reason === 'expedition-start' ||
        reason === 'expedition-complete' ||
        reason === 'expedition-cancel' ||
        reason.startsWith('expedition')
      ) {
        void refresh();
      }
    }, [refresh]),
  );

  return active;
}
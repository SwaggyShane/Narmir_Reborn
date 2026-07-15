import { useCallback, useEffect, useState } from 'react';
import { apiCall } from '../utils/api';
import { useGameMutationEvents } from './useGameState.js';

export function useActiveExpeditionsSummary() {
  const [active, setActive] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const [data, harvests] = await Promise.all([
        apiCall('/api/kingdom/expedition/list'),
        apiCall('/api/kingdom/resource-harvests'),
      ]);
      const rows = Array.isArray(data?.active) ? data.active : [];
      const harvestRows = Array.isArray(harvests)
        ? harvests.map((h) => ({ id: `harvest-${h.id}`, type: 'resource-harvest', turns_left: h.turns_left }))
        : [];
      setActive([
        ...rows.filter((row) => Number(row?.turns_left ?? 0) > 0 || row?.rewards == null),
        ...harvestRows,
      ]);
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
        reason === 'resources-refresh' || // fired after launching a resource harvest
        reason.startsWith('expedition') ||
        reason.startsWith('epic-trek')
      ) {
        void refresh();
      }
    }, [refresh]),
  );

  return active;
}
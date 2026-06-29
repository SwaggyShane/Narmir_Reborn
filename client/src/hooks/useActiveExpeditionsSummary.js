import { useCallback, useEffect, useState } from 'react';
import { apiCall } from '../utils/api';

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
    // Periodically refresh expedition status
    const interval = setInterval(() => void refresh(), 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return active;
}
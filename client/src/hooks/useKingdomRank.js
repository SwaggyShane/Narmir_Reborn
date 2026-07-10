import { useEffect, useState } from 'react';
import { apiCall } from '../utils/api.mjs';
import { useProfileStore } from '../stores/index.js';

export function useKingdomRank() {
  const kingdomId = useProfileStore((state) => state?.id);
  const [rank, setRank] = useState(null);

  useEffect(() => {
    if (!kingdomId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await apiCall('/api/kingdom/rankings');
        if (cancelled || res?.error) return;
        const kingdoms = Array.isArray(res?.rankings) ? res.rankings : [];
        const me = kingdoms.find((row) => String(row.id) === String(kingdomId));
        if (!cancelled) {
          setRank(me?.rank ?? null);
        }
      } catch (err) {
        console.warn('[useKingdomRank] Failed to load rank:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kingdomId]);

  return rank;
}

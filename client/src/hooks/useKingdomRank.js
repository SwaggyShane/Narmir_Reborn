import { useEffect, useMemo } from 'react';
import { apiCall } from '../utils/api.mjs';
import { useGameState } from './useGameState';
import { applyGameMutation } from '../utils/gameMutations.js';

function kingdomIdFromState(state) {
  return state?.kingdomId ?? state?.id ?? null;
}

function rankFromCache(state) {
  const kid = kingdomIdFromState(state);
  if (!kid || !Array.isArray(state?.rankingsCache)) return null;
  const row = state.rankingsCache.find((r) => String(r.id) === String(kid));
  return row?.rank != null ? Number(row.rank) : null;
}

function rankFromState(state) {
  const direct = state?.rank ?? state?.kingdom_rank ?? state?.position;
  if (direct != null && Number.isFinite(Number(direct)) && Number(direct) > 0) {
    return Number(direct);
  }
  return rankFromCache(state);
}

export function useKingdomRank() {
  const { state } = useGameState();
  const kingdomId = kingdomIdFromState(state);

  const rank = useMemo(
    () => rankFromState(state),
    [state?.rank, state?.kingdom_rank, state?.position, state?.rankingsCache, state?.kingdomId, state?.id],
  );

  useEffect(() => {
    if (!kingdomId) return undefined;
    if (rank != null) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const res = await apiCall('/api/kingdom/rankings');
        if (cancelled || res?.error) return;
        const kingdoms = Array.isArray(res?.rankings) ? res.rankings : [];
        const me = kingdoms.find((row) => String(row.id) === String(kingdomId));
        applyGameMutation(
          {
            rankingsCache: kingdoms,
            kingdomId,
            rank: me?.rank ?? null,
          },
          { reason: 'rank-bootstrap' },
        );
      } catch (err) {
        console.warn('[useKingdomRank] Failed to load rank:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kingdomId, rank]);

  return rank;
}
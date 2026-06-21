import { useCallback, useState } from 'react';
import { apiCall } from '../utils/api.js';
import { toast } from '../utils/toast.js';
import { gameStateManager } from '../GameStateManager.js';

function applyResult(data, reason) {
  const updates = data?.updates || data?.kUpdates || null;
  if (updates) gameStateManager.applyUpdates(updates, { reason, payload: updates });
  return data;
}

export function useGameActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const takeTurn = useCallback(async () => {
    if ((gameStateManager.getState()?.turns_stored || 0) < 1) {
      toast('No turns available.', 'warning');
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiCall('/api/kingdom/turn', { method: 'POST' });
      if (data.error) {
        toast(data.error, data.error.includes('No turns') ? 'warning' : 'error');
        return null;
      }
      applyResult(data, 'turn');
      if (data.events) {
        window.dispatchEvent(new CustomEvent('narmir:news-items', { detail: data.events }));
        window.appendNewsItems?.(data.events);
      }
      return data;
    } catch (err) {
      setError(err.message);
      toast('Failed to take turn: ' + err.message, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // type: 'food' | 'gold' | 'land', rangers: number
  const search = useCallback(async (type, rangers) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiCall('/api/kingdom/search', { method: 'POST', body: { type, rangers } });
      if (data.error) { toast(data.error, 'error'); return null; }
      applyResult(data, 'search');
      return data;
    } catch (err) {
      setError(err.message);
      toast('Search failed: ' + err.message, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const castSpell = useCallback(async (spellId, targetId, obscure = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiCall('/api/kingdom/spell', { method: 'POST', body: { spellId, targetId, obscure } });
      if (data.error) { toast(data.error, 'error'); return null; }
      applyResult(data, 'spell');
      return data;
    } catch (err) {
      setError(err.message);
      toast('Spell failed: ' + err.message, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const attack = useCallback(async (targetId, units) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiCall('/api/kingdom/attack', { method: 'POST', body: { targetId, units } });
      if (data.error) { toast(data.error, 'error'); return null; }
      applyResult(data, 'attack');
      return data;
    } catch (err) {
      setError(err.message);
      toast('Attack failed: ' + err.message, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { takeTurn, search, castSpell, attack, loading, error };
}

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
  const [loading, setLoading] = useState({
    takeTurn: false,
    search: false,
    castSpell: false,
    attack: false,
  });
  const [errors, setErrors] = useState({
    takeTurn: null,
    search: null,
    castSpell: null,
    attack: null,
  });

  const setActionLoading = (action, value) =>
    setLoading((prev) => ({ ...prev, [action]: value }));
  const setActionError = (action, value) =>
    setErrors((prev) => ({ ...prev, [action]: value }));

  const takeTurn = useCallback(async () => {
    if ((gameStateManager.getState()?.turns_stored || 0) < 1) {
      toast('No turns available.', 'warning');
      return null;
    }
    setActionLoading('takeTurn', true);
    setActionError('takeTurn', null);
    try {
      const data = await apiCall('/api/kingdom/turn', { method: 'POST' });
      if (data.error) {
        setActionError('takeTurn', data.error);
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
      setActionError('takeTurn', err.message);
      toast('Failed to take turn: ' + err.message, 'error');
      return null;
    } finally {
      setActionLoading('takeTurn', false);
    }
  }, []);

  // type: 'food' | 'gold' | 'land', rangers: number
  const search = useCallback(async (type, rangers) => {
    setActionLoading('search', true);
    setActionError('search', null);
    try {
      const data = await apiCall('/api/kingdom/search', { method: 'POST', body: { type, rangers } });
      if (data.error) {
        setActionError('search', data.error);
        toast(data.error, 'error');
        return null;
      }
      applyResult(data, 'search');
      return data;
    } catch (err) {
      setActionError('search', err.message);
      toast('Search failed: ' + err.message, 'error');
      return null;
    } finally {
      setActionLoading('search', false);
    }
  }, []);

  const castSpell = useCallback(async (spellId, targetId, obscure = false) => {
    setActionLoading('castSpell', true);
    setActionError('castSpell', null);
    try {
      const data = await apiCall('/api/kingdom/spell', { method: 'POST', body: { spellId, targetId, obscure } });
      if (data.error) {
        setActionError('castSpell', data.error);
        toast(data.error, 'error');
        return null;
      }
      applyResult(data, 'spell');
      return data;
    } catch (err) {
      setActionError('castSpell', err.message);
      toast('Spell failed: ' + err.message, 'error');
      return null;
    } finally {
      setActionLoading('castSpell', false);
    }
  }, []);

  const attack = useCallback(async (targetId, units) => {
    setActionLoading('attack', true);
    setActionError('attack', null);
    try {
      const data = await apiCall('/api/kingdom/attack', { method: 'POST', body: { targetId, units } });
      if (data.error) {
        setActionError('attack', data.error);
        toast(data.error, 'error');
        return null;
      }
      applyResult(data, 'attack');
      return data;
    } catch (err) {
      setActionError('attack', err.message);
      toast('Attack failed: ' + err.message, 'error');
      return null;
    } finally {
      setActionLoading('attack', false);
    }
  }, []);

  return { takeTurn, search, castSpell, attack, loading, errors };
}

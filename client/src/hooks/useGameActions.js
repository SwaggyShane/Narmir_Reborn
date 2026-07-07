import { useCallback, useRef, useState } from 'react';
import { apiCall } from '../utils/api.mjs';
import { toast } from '../utils/toast.js';
import { gameStateManager } from '../GameStateManager.js';
import { playGameSound } from '../utils/audio.js';
import { getRegenCountdownLabel } from './useRegenCountdown.js';
import { AppEvent, emitAppEvent } from '../utils/appEvents.js';
import { useProfileStore } from '../stores/profileStore.js';
import { setLastSpellTarget } from '../utils/spellTargetHistory.js';

function applyResult(data, reason) {
  const updates = data?.updates || data?.kUpdates || null;
  if (updates) gameStateManager.applyUpdates(updates, { reason, payload: updates });
  return data;
}

const playAchievementSound = () => {
  try {
    const audio = new Audio('/sound/achievement.mp3');
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
};

export function useGameActions() {
  const turnInProgressRef = useRef(false);
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

  const setActionLoading = useCallback((action, value) =>
    setLoading((prev) => ({ ...prev, [action]: value })), []);
  const setActionError = useCallback((action, value) =>
    setErrors((prev) => ({ ...prev, [action]: value })), []);

  const takeTurn = useCallback(async () => {
    if (turnInProgressRef.current) return null;
    if ((gameStateManager.getState()?.turns_stored || 0) < 1) {
      const countdown = getRegenCountdownLabel();
      toast(`No turns available. Refills in ${countdown}`, 'warning');
      return null;
    }
    turnInProgressRef.current = true;
    setActionLoading('takeTurn', true);
    setActionError('takeTurn', null);
    playGameSound('take_turn');
    try {
      const data = await apiCall('/api/kingdom/turn', { method: 'POST' });
      if (data.error) {
        setActionError('takeTurn', data.error);
        toast(data.error, data.error.includes('No turns') ? 'warning' : 'error');
        return null;
      }
      applyResult(data, 'turn');
      const updatedState = gameStateManager.getState();
      useProfileStore.getState().receiveServerSnapshot({
        turn: updatedState.turn,
        turns_stored: updatedState.turns_stored,
        scout_progress: updatedState.scout_progress,
        scout_allocation: updatedState.scout_allocation
      });

      let completedBuildingsMsg = '';
      if (Array.isArray(data.events)) {
        emitAppEvent(AppEvent.NEWS_ITEMS, data.events);
        for (const ev of data.events) {
          const msg = ev?.message || '';
          if (msg.includes('Completed: ')) {
            const idx = msg.indexOf('Completed: ');
            const endPart = msg.substring(idx + 'Completed: '.length);
            const periodIdx = endPart.indexOf('.');
            completedBuildingsMsg = periodIdx !== -1 ? endPart.substring(0, periodIdx) : endPart;
          }
          if (msg.includes('ACHIEVEMENT UNLOCKED')) playAchievementSound();
        }
      }

      const state = gameStateManager.getState();
      const turnsLeft = state?.turns_stored ?? 0;
      const currentTurn = state?.turn;
      const turnStatus = `Turn ${currentTurn || '?'} - ${turnsLeft} turns left`;
      const buildStatus = completedBuildingsMsg
        ? `Completed: ${completedBuildingsMsg}!`
        : '';

      if ((state?.food || 0) < 1000) {
        toast(`Warning: Food levels are dangerously low!\n${buildStatus ? `${buildStatus}\n` : ''}${turnStatus}`, 'warning');
      } else if ((state?.gold || 0) < 1000) {
        toast(`Warning: Gold reserves are almost empty!\n${buildStatus ? `${buildStatus}\n` : ''}${turnStatus}`, 'warning');
      } else {
        toast(buildStatus ? `${buildStatus}\n${turnStatus}` : turnStatus, 'success');
      }
      return data;
    } catch (err) {
      setActionError('takeTurn', err.message);
      toast('Failed to take turn: ' + err.message, 'error');
      return null;
    } finally {
      turnInProgressRef.current = false;
      setActionLoading('takeTurn', false);
    }
  }, [setActionLoading, setActionError]);

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
  }, [setActionLoading, setActionError]);

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
      if (spellId && targetId) {
        setLastSpellTarget(spellId, targetId);
      }
      return data;
    } catch (err) {
      setActionError('castSpell', err.message);
      toast('Spell failed: ' + err.message, 'error');
      return null;
    } finally {
      setActionLoading('castSpell', false);
    }
  }, [setActionLoading, setActionError]);

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
  }, [setActionLoading, setActionError]);

  return { takeTurn, search, castSpell, attack, loading, errors };
}

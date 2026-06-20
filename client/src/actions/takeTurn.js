import { apiCall } from '../utils/api';
import { toast } from '../utils/toast.js';
import { applyGameMutation } from '../utils/gameMutations.js';
import { gameStateManager } from '../GameStateManager.js';

let canonicalTurnInProgress = false;

const getState = () => gameStateManager.getState();

const playAchievementSound = () => {
  try {
    const audio = new Audio('/sound/achievement.mp3');
    audio.volume = 0.7;
    audio.play().catch(() => {
      console.debug('[audio] Achievement sound failed to play');
    });
  } catch (err) {
    console.debug('[audio] Error playing sound:', err.message);
  }
};

export const takeTurn = async () => {
  if (canonicalTurnInProgress) return;
  if ((getState()?.turns_stored || 0) < 1) {
    const countdown = document.getElementById('regen-countdown')?.textContent || '25:00';
    toast(`No turns available. Refills in ${countdown}`, 'warning');
    return;
  }

  canonicalTurnInProgress = true;
  const btn = document.querySelector('.turn-btn');
  if (btn) btn.style.opacity = '0.6';
  window.playGameSound?.('take_turn');

  try {
    const data = await apiCall('POST', '/api/kingdom/turn');
    if (data.error) {
      toast(data.error, data.error.includes('No turns available') ? 'warning' : 'error');
      console.error('[turn] error:', data.error);
      return;
    }
    if (!data.ok) return;

    const turnUpdates = { ...(data.updates || {}) };
    if (data.turns_stored !== undefined && turnUpdates.turns_stored === undefined) {
      turnUpdates.turns_stored = data.turns_stored;
    }
    if (Object.keys(turnUpdates).length) {
      data.updates = turnUpdates;
      applyGameMutation(data, { reason: 'turn' });
      window.syncFromState?.();
    }

    const currentTurn = getState()?.turn || data.updates?.turn;
    const turnEl = document.getElementById('turn-num');
    if (turnEl && currentTurn !== undefined) turnEl.textContent = currentTurn;
    const newsTurn = document.getElementById('news-turn-num');
    if (newsTurn && currentTurn !== undefined) newsTurn.textContent = currentTurn;

    let completedBuildingsMsg = '';
    const blurbs = [];
    if (data.events) {
      window.appendNewsItems?.(data.events);
      for (const ev of data.events) {
        const msg = ev.message || '';
        if (msg.includes('Completed: ')) {
          const index = msg.indexOf('Completed: ');
          const endPart = msg.substring(index + 'Completed: '.length);
          const periodIndex = endPart.indexOf('.');
          completedBuildingsMsg = periodIndex !== -1 ? endPart.substring(0, periodIndex) : endPart;
        }
        if (ev.message?.includes('ACHIEVEMENT UNLOCKED')) {
          playAchievementSound();
        }
      }
      if (completedBuildingsMsg && window.getCompletionBlurb) {
        completedBuildingsMsg.split(',').forEach((item) => {
          const blurb = window.getCompletionBlurb(item.trim());
          if (blurb) blurbs.push(blurb);
        });
      }
    }

    const turnsLeft = getState()?.turns_stored ?? data.updates?.turns_stored ?? 0;
    if (btn) btn.style.opacity = turnsLeft > 0 ? '1' : '0.4';
    const turnStatus = `Turn ${currentTurn || '?'} - ${turnsLeft} turns left`;
    const buildStatus = completedBuildingsMsg
      ? `Completed: ${completedBuildingsMsg}!\n${blurbs.join('\n') || ''}`
      : '';

    if ((getState()?.food || 0) < 1000) {
      toast(`Warning: Food levels are dangerously low!\n${buildStatus ? `${buildStatus}\n` : ''}${turnStatus}`, 'warning');
    } else if ((getState()?.gold || 0) < 1000) {
      toast(`Warning: Gold reserves are almost empty!\n${buildStatus ? `${buildStatus}\n` : ''}${turnStatus}`, 'warning');
    } else {
      toast(buildStatus ? `${buildStatus}\n${turnStatus}` : turnStatus, 'success');
    }
  } catch (error) {
    console.error('[turn] Error taking turn:', error);
    toast('Failed to take turn: ' + error.message, 'error');
  } finally {
    canonicalTurnInProgress = false;
    if (btn && (getState()?.turns_stored || 0) > 0) btn.style.opacity = '1';
  }
};

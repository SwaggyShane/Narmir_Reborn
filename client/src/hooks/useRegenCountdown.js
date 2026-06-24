import { useEffect, useState } from 'react';
import { gameStateManager } from '../GameStateManager.js';

export const REGEN_AMOUNT = 7;
export const REGEN_MAX = 400;
export const REGEN_INTERVAL_SEC = 25 * 60;

const subscribers = new Set();
let countdownSeconds = REGEN_INTERVAL_SEC;

function formatCountdown(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function notifySubscribers() {
  const label = formatCountdown(countdownSeconds);
  subscribers.forEach((fn) => {
    try {
      fn(label);
    } catch (err) {
      console.error('[regen] subscriber error:', err);
    }
  });
}

function tickRegenCountdown() {
  countdownSeconds -= 1;
  if (countdownSeconds < 0) {
    countdownSeconds = REGEN_INTERVAL_SEC;
    const state = gameStateManager.getState();
    const next = Math.min(REGEN_MAX, (state?.turns_stored || 0) + REGEN_AMOUNT);
    gameStateManager.applyUpdates({ turns_stored: next }, { reason: 'regen-optimistic' });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('narmir:turn-regen'));
    }
  }
  notifySubscribers();
}

let regenTickerId = null;

function ensureRegenTicker() {
  if (typeof window === 'undefined') return;
  if (regenTickerId != null) return;
  regenTickerId = setInterval(tickRegenCountdown, 1000);
}

export function getRegenCountdownLabel() {
  return formatCountdown(countdownSeconds);
}

export function useRegenCountdown() {
  const [label, setLabel] = useState(getRegenCountdownLabel);

  useEffect(() => {
    ensureRegenTicker();
    subscribers.add(setLabel);
    setLabel(getRegenCountdownLabel());
    return () => subscribers.delete(setLabel);
  }, []);

  return label;
}

ensureRegenTicker();
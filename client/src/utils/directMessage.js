import { switchTab } from './panelNav.js';

let openDirectMessageImpl = null;
let pendingTarget = null;

export function registerOpenDirectMessage(fn) {
  openDirectMessageImpl = typeof fn === 'function' ? fn : null;
  if (openDirectMessageImpl && pendingTarget) {
    openDirectMessageImpl(pendingTarget);
    pendingTarget = null;
  }
  return () => {
    if (openDirectMessageImpl === fn) openDirectMessageImpl = null;
  };
}

export function openDirectMessage(playerId, name) {
  const target = {
    playerId,
    name: String(name || '').trim(),
  };
  switchTab('messages');
  if (openDirectMessageImpl) {
    return openDirectMessageImpl(target);
  }
  pendingTarget = target;
  return null;
}
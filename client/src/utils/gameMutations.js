import { gameStateManager } from '../GameStateManager.js';
import { normalizeMutationUpdates } from './upgradeUtils.js';

export function applyServerUpdates(updates, context = {}) {
  if (!updates) return null;
  return gameStateManager.applyUpdates(normalizeMutationUpdates(updates), context);
}

export function applyGameMutation(resultOrUpdates, context = {}) {
  if (!resultOrUpdates) return null;
  const updates = resultOrUpdates.updates || resultOrUpdates;
  if (!updates) return null;
  return applyServerUpdates(updates, context);
}

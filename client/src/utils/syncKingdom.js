import { applyGameMutation } from './gameMutations.js';
import { AppEvent, emitAppEvent } from './appEvents.js';

export function syncKingdom(data, reason = 'sync') {
  if (!data) return null;

  console.log(`🔗 syncKingdom(${reason}):`, data);

  // Apply to all Zustand stores
  applyGameMutation(data, { reason });

  // Emit event for any listeners
  emitAppEvent(new AppEvent(`kingdom:${reason}`, data));

  return data;
}

import { normalizeAndRouteResponse } from './responseNormalizer.js';
import { AppEvent, emitAppEvent } from './appEvents.js';

export function syncKingdom(data, reason = 'sync') {
  if (!data) return null;

  // Apply to all Zustand stores
  normalizeAndRouteResponse(data, { reason });

  // Emit event for any listeners
  emitAppEvent(new AppEvent(`kingdom:${reason}`, data));

  return data;
}

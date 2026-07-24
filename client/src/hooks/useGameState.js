import { useAppEvent } from './useAppEvent.js';
import { AppEvent } from '../utils/appEvents.js';

/**
 * Subscribe to GAME_MUTATION events from normalizeAndRouteResponse.
 * State lives in Zustand; this is only for "something just happened" side
 * effects (refresh lists, etc.). Filename kept for import stability.
 */
export function useGameMutationEvents(listener) {
  useAppEvent(AppEvent.GAME_MUTATION, listener);
}

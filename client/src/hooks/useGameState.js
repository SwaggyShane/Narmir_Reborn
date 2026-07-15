import { useAppEvent } from './useAppEvent.js';
import { AppEvent } from '../utils/appEvents.js';

// Successor to the old GameStateManager mutation-event pipeline. State
// updates themselves flow through Zustand (components re-render on their
// own), but some components still need to react to *what just happened*
// (e.g. "a turn was taken" or "an expedition launched") rather than just
// the resulting values -- normalizeAndRouteResponse emits AppEvent.GAME_MUTATION
// with the calling context (including `reason`) every time it routes a
// server response, and this hook is just a thin subscription to that.
export function useGameMutationEvents(listener) {
  useAppEvent(AppEvent.GAME_MUTATION, listener);
}

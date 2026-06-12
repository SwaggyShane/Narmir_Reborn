// Single source of truth for kingdom state across the entire app.
//
// Every server response and every game action funnels through applyUpdates().
// React components subscribe via subscribe() and re-render on state changes.
// Side-effect listeners (active panel refresh, toasts, sound) subscribe via
// subscribeMutation() and react to specific mutation reasons.

class GameStateManager {
  constructor() {
    this.state = {};
    this.stateListeners = new Set();
    this.mutationListeners = new Set();
  }

  // ── Reads ───────────────────────────────────────────────────────────────
  getState() {
    return this.state;
  }

  // ── Mutations ───────────────────────────────────────────────────────────

  // Replace the entire state. Used during init and full reloads.
  setState(next) {
    if (!next || typeof next !== 'object') return;
    this.state = { ...next };
    this._notify();
    this.emitMutation('replace', this.state);
  }

  // Merge a partial update into state. THIS IS THE SINGLE MUTATION ENTRY POINT
  // for every server action result. Pass a reason so mutation listeners can
  // decide whether to react (e.g. only refresh active panel on 'turn_taken').
  applyUpdates(updates, reason = 'update') {
    if (!updates || typeof updates !== 'object') return;
    this.state = { ...this.state, ...updates };
    this._notify();
    this.emitMutation(reason, updates);
  }

  // ── Subscriptions ───────────────────────────────────────────────────────

  // React store subscription — fires on every state change.
  // Returns an unsubscribe function.
  subscribe(listener) {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  // Side-effect subscription — fires after subscribe() listeners, with
  // (reason, payload). Reasons currently emitted:
  //   'replace'         — setState was called
  //   'server_update'   — applyServerUpdates received a server response
  //   'turn_taken'      — window.takeTurn succeeded
  //   'init'            — initGameStateManager seeded from window.gameState
  //   'react_sync'      — triggerReactUpdates pushed window.gameState
  //   'update'          — generic / default reason
  // Returns an unsubscribe function.
  subscribeMutation(listener) {
    this.mutationListeners.add(listener);
    return () => this.mutationListeners.delete(listener);
  }

  emitMutation(reason, payload) {
    this.mutationListeners.forEach(l => {
      try { l(reason, payload); } catch (e) {
        console.error('[GameStateManager] mutation listener error:', e);
      }
    });
  }

  // ── Internal ────────────────────────────────────────────────────────────
  _notify() {
    this.stateListeners.forEach(l => {
      try { l(this.state); } catch (e) {
        console.error('[GameStateManager] state listener error:', e);
      }
    });
  }
}

export const gameStateManager = new GameStateManager();

if (typeof window !== 'undefined') {
  window.gameStateManager = gameStateManager;
}

// Global state manager for multi-root React app
// All panels share this state without needing a single React root

class GameStateManager {
  constructor() {
    this.listeners = new Set();
    this.state = {
      gold: 0,
      mana: 0,
      population: 0,
      happiness: 50,
      food: 0,
      land: 0,
      turn: 0,
      mana_regen: 0,
      gold_income: 0,
      food_balance: 0,
      tax: 42,
    };
    this.snapshot = { ...this.state };
    this.metrics = this.snapshot;
    this.panelState = new Map();
    this.mutationListeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.snapshot = { ...this.state };
    this.metrics = this.snapshot;
    this.listeners.forEach(listener => {
      try {
        listener(this.snapshot);
      } catch (e) {
        console.error('[GameStateManager] Listener error:', e);
      }
    });
  }

  subscribeToMutations(listener) {
    this.mutationListeners.add(listener);
    return () => this.mutationListeners.delete(listener);
  }

  emitMutation(reason = 'unknown', payload = {}) {
    const event = {
      reason,
      payload,
      state: this.snapshot,
      at: Date.now(),
    };
    this.mutationListeners.forEach(listener => {
      try {
        listener(event);
      } catch (e) {
        console.error('[GameStateManager] Mutation listener error:', e);
      }
    });
  }

  setState(nextState = {}, context = {}) {
    for (const [key, value] of Object.entries(nextState || {})) {
      if (value !== undefined) this.state[key] = value;
    }
    this.notify();
    if (context.reason) this.emitMutation(context.reason, context.payload || nextState);
    return this.snapshot;
  }

  applyUpdates(updates = {}, context = {}) {
    return this.setState(updates, context);
  }

  updateMetrics(updates) {
    return this.applyUpdates(updates, { reason: 'metrics', payload: updates });
  }

  setPanelState(panelName, state) {
    this.panelState.set(panelName, state);
  }

  getPanelState(panelName) {
    return this.panelState.get(panelName);
  }

  getMetrics() {
    return this.snapshot;
  }

  getState() {
    return this.snapshot;
  }

  getMutableState() {
    return this.state;
  }
}

export const gameStateManager = new GameStateManager();

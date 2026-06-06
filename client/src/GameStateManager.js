// Global state manager for multi-root React app
// All panels share this state without needing a single React root

class GameStateManager {
  constructor() {
    this.listeners = new Set();
    this.metrics = {
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
    this.panelState = new Map();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(listener => {
      try {
        listener(this.metrics);
      } catch (e) {
        console.error('[GameStateManager] Listener error:', e);
      }
    });
  }

  updateMetrics(updates) {
    this.metrics = { ...this.metrics, ...updates };
    this.notify();
  }

  setPanelState(panelName, state) {
    this.panelState.set(panelName, state);
  }

  getPanelState(panelName) {
    return this.panelState.get(panelName);
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

export const gameStateManager = new GameStateManager();

// Make globally accessible for vanilla JS code
if (typeof window !== 'undefined') {
  window.gameStateManager = gameStateManager;
}

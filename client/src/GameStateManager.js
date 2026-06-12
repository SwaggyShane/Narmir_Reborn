// Global state manager for multi-root React app
// All panels share this state without needing a single React root

const HOUSING_CAP_BY_RACE = {
  dwarf: 975,
  orc: 900,
  human: 750,
  dark_elf: 675,
  high_elf: 525,
  dire_wolf: 1050,
  vampire: 600,
};

const LAND_COST = {
  bld_farms: 1,
  bld_granaries: 2,
  bld_barracks: 3,
  bld_outposts: 5,
  bld_guard_towers: 5,
  bld_armories: 5,
  bld_vaults: 10,
  bld_schools: 10,
  bld_smithies: 20,
  bld_markets: 25,
  bld_shrines: 10,
  bld_libraries: 20,
  bld_housing: 2,
  bld_mausoleums: 25,
  bld_mage_towers: 75,
  bld_training: 250,
  bld_castles: 1000,
  bld_taverns: 5,
  bld_walls: 3,
};

class GameStateManager {
  constructor() {
    this.listeners = new Set();
    this.metrics = {
      // Core economy
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
      score: 0,
      // Turns
      turns_stored: 0,
      // Units
      fighters: 0,
      rangers: 0,
      mages: 0,
      clerics: 0,
      thieves: 0,
      ninjas: 0,
      thralls: 0,
      researchers: 0,
      engineers: 0,
      // Identity
      race: '',
      name: '',
      gender: '',
      region: '',
      // Defense
      defense_rating: 0,
      bld_walls: 0,
      // Buildings (for derived calculations)
      bld_farms: 0,
      bld_granaries: 0,
      bld_barracks: 0,
      bld_outposts: 0,
      bld_guard_towers: 0,
      bld_armories: 0,
      bld_vaults: 0,
      bld_schools: 0,
      bld_smithies: 0,
      bld_markets: 0,
      bld_shrines: 0,
      bld_libraries: 0,
      bld_housing: 0,
      bld_mausoleums: 0,
      bld_mage_towers: 0,
      bld_training: 0,
      bld_castles: 0,
      bld_taverns: 0,
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
    return this.metrics;
  }

  // Derived computations exposed for convenience
  getPopCap() {
    const capPerBuilding = HOUSING_CAP_BY_RACE[this.metrics.race] || 500;
    return (this.metrics.bld_housing || 0) * capPerBuilding;
  }

  getLandUsed() {
    return Object.entries(LAND_COST).reduce((sum, [k, cost]) => {
      return sum + (this.metrics[k] || 0) * cost;
    }, 0);
  }

  getFreeLand() {
    return Math.max(0, (this.metrics.land || 0) - this.getLandUsed());
  }

  getThrallCap() {
    return (this.metrics.bld_mausoleums || 0) * 100;
  }
}

export const gameStateManager = new GameStateManager();
export { HOUSING_CAP_BY_RACE, LAND_COST };

// Make globally accessible for vanilla JS code
if (typeof window !== 'undefined') {
  window.gameStateManager = gameStateManager;
}

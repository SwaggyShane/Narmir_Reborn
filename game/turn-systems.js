// game/turn-systems.js
// Slice 3: System composition foundation for Phase 2 refactoring.
// Systems are registered and executed in sequence; foundation for decoupling.
// Actual system implementations follow in later slices.

// ── Base System Class ──
class TurnSystem {
  constructor(name) {
    this.name = name;
  }

  /**
   * Process this system's logic for the turn.
   * @param {object} state - Full kingdom state + updates so far
   * @param {array} events - Accumulated events
   * @returns {object} { updates: {...}, events: [...] } or null if no changes
   */
  process(state, events) {
    throw new Error(`${this.name}.process() not implemented`);
  }
}

// ── System Registry ──
class SystemRegistry {
  constructor() {
    this.systems = [];
  }

  /**
   * Register a system to be executed during turn processing.
   * @param {TurnSystem} system - System instance
   */
  register(system) {
    if (!(system instanceof TurnSystem)) {
      throw new Error(`System must extend TurnSystem: ${system.name}`);
    }
    this.systems.push(system);
  }

  /**
   * Execute all registered systems in order.
   * Each system receives current state (kingdom + accumulated updates).
   * Returns accumulated updates and events from all systems.
   *
   * @param {object} kingdom - Initial kingdom state
   * @param {object} initialUpdates - Any pre-existing updates (e.g., from prior phases)
   * @param {array} initialEvents - Any pre-existing events
   * @returns {object} { updates: {...}, events: [...] }
   */
  processAll(kingdom, initialUpdates = {}, initialEvents = []) {
    const updates = initialUpdates;
    const events = initialEvents;

    // Merge accumulated updates into kingdom view for each system
    // This ensures each system sees the result of all prior systems
    for (const system of this.systems) {
      const stateWithUpdates = { ...kingdom, ...updates };
      const result = system.process(stateWithUpdates, events);
      if (result) {
        Object.assign(updates, result.updates);
        // Append new events
        if (result.events && result.events.length > 0) {
          events.push(...result.events);
        }
      }
    }

    return { updates, events };
  }

  /**
   * Get list of registered systems (for debugging/testing).
   * @returns {array} System instances
   */
  getSystems() {
    return [...this.systems];
  }

  /**
   * Clear all registered systems (for testing).
   */
  clear() {
    this.systems = [];
  }

  /**
   * Get count of registered systems (for testing).
   * @returns {number}
   */
  count() {
    return this.systems.length;
  }
}

// ── Global Registry Instance ──
const registry = new SystemRegistry();

// Systems are registered in engine.js to avoid circular dependencies

module.exports = {
  registry,
  SystemRegistry,
  TurnSystem,
};

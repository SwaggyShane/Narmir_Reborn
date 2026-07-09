// game/systems/gold-income.js
// GoldIncomeSystem: Extracted from engine.processTurn()
// Calculates and applies gold income for a kingdom each turn

const { TurnSystem } = require('../turn-systems');
const { goldPerTurn } = require('../economy');

class GoldIncomeSystem extends TurnSystem {
  constructor() {
    super('gold-income');
  }

  // Signature: process(stateWithUpdates, events) where stateWithUpdates is merged kingdom+updates
  process(stateWithUpdates, events) {
    // Calculate gold income for this turn
    const income = goldPerTurn(stateWithUpdates);

    // Return updates to apply
    const updates = {
      gold: stateWithUpdates.gold + income,
      _incomeBreakdown: { gold: income },
    };

    // Emit event for systems that care about gold generation
    const newEvents = [{
      type: 'gold-generated',
      kingdomId: stateWithUpdates.id,
      amount: income,
      timestamp: Date.now(),
    }];

    return { updates, events: newEvents };
  }
}

module.exports = new GoldIncomeSystem();

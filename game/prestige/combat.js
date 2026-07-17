'use strict';
// SINGLE SOURCE OF TRUTH for prestige combat — never multiply prestige combat elsewhere.
// Contract: EVOLUTION.md section 3.5

const { getPrestigeModifiers } = require('./balance');

/**
 * @param {number} power
 * @param {number} prestigeLevel
 * @returns {number}
 */
function applyPrestigeCombatMultiplier(power, prestigeLevel) {
  const mult = getPrestigeModifiers(prestigeLevel).combat || 1.0;
  return Math.round(Number(power) * mult);
}

module.exports = {
  applyPrestigeCombatMultiplier,
};

'use strict';

/**
 * Parse training_allocation JSON and extract ranger count.
 * training_allocation is stored as JSON string: { "rangers": N, "fighters": N, ... }
 */
function getTrainingRangers(kingdom) {
  if (!kingdom || !kingdom.training_allocation) {
    return 0;
  }

  try {
    const training = typeof kingdom.training_allocation === 'string'
      ? JSON.parse(kingdom.training_allocation)
      : kingdom.training_allocation;
    return Number(training.rangers || 0);
  } catch {
    return 0;
  }
}

/**
 * Validate scout allocation against kingdom state.
 * Does not perform database operations; validates based on provided kingdom data.
 * Accounts for rangers in training (which cannot be allocated to scouts).
 *
 * @param {object} kingdom - Kingdom object with rangers, scout_allocation, training_allocation fields
 * @param {number} rangerCount - Number of rangers to allocate
 * @returns {object} Validation result: {valid: boolean, reason?: string, available?: number}
 */
function validateAllocation(kingdom, rangerCount) {
  const requested = Math.max(0, Math.floor(Number(rangerCount) || 0));

  if (requested <= 0) {
    return { valid: false, reason: 'Must allocate at least 1 ranger' };
  }

  if (!kingdom) {
    return { valid: false, reason: 'Kingdom not found' };
  }

  const totalRangers = Number(kingdom.rangers || 0);
  const allocated = Number(kingdom.scout_allocation || 0);
  const inTraining = getTrainingRangers(kingdom);
  const availableRangers = Math.max(0, totalRangers - allocated - inTraining);

  if (requested > availableRangers) {
    return {
      valid: false,
      reason: `Not enough available rangers. Available: ${availableRangers}, Requested: ${requested}`,
      available: availableRangers,
    };
  }

  return { valid: true, available: availableRangers };
}

/**
 * Calculate scout allocation result.
 * Given current state and request, returns the resulting allocation amounts.
 * Accounts for rangers in training.
 *
 * @param {object} kingdom - Kingdom object
 * @param {number} rangerCount - Rangers to allocate
 * @returns {object} Result: {allocated: number, newTotal: number, remainingAvailable: number}
 */
function calculateAllocationResult(kingdom, rangerCount) {
  if (!kingdom) {
    return { allocated: 0, newTotal: 0, remainingAvailable: 0 };
  }

  const requested = Math.max(0, Math.floor(Number(rangerCount) || 0));
  const currentAllocation = Number(kingdom.scout_allocation || 0);
  const newAllocation = currentAllocation + requested;
  const totalRangers = Number(kingdom.rangers || 0);
  const inTraining = getTrainingRangers(kingdom);
  const remainingAvailable = Math.max(0, totalRangers - newAllocation - inTraining);

  return {
    allocated: requested,
    newTotal: newAllocation,
    remainingAvailable,
  };
}

/**
 * Get scout allocation status for a kingdom.
 * Accounts for rangers in training (unavailable).
 *
 * @param {object} kingdom - Kingdom object
 * @returns {object} Status: {allocated: number, available: number, totalRangers: number}
 */
function getAllocationStatus(kingdom) {
  if (!kingdom) {
    return { allocated: 0, available: 0, totalRangers: 0 };
  }

  const totalRangers = Number(kingdom.rangers || 0);
  const allocated = Number(kingdom.scout_allocation || 0);
  const inTraining = getTrainingRangers(kingdom);
  const available = Math.max(0, totalRangers - allocated - inTraining);

  return {
    allocated,
    available,
    totalRangers,
  };
}

module.exports = {
  validateAllocation,
  calculateAllocationResult,
  getAllocationStatus,
};

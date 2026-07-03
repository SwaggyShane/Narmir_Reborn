// game/ranger-allocation.js
// Ranger pool management: expeditions and scouting compete for the same rangers

/**
 * Allocate rangers for a task (scouting or expedition).
 * Rangers are a shared pool: both active expeditions and scouting requests compete for them.
 *
 * @param {string} taskType - 'scouting' or 'expedition'
 * @param {number} amount - how many rangers needed
 * @param {number} priority - 1 = highest, 10 = lowest (used for allocation priority)
 * @param {object} kingdomState - { rangers_available, rangers_in_expeditions, rangers_scouting }
 * @returns {object} - { allocated: number, overflow: number, reason: string }
 *
 * CURRENT (Phase 2+): Follows the engineer allocation pattern.
 * FUTURE: May be refined based on playtesting to add soft caps, priority queues, penalties, etc.
 */
function allocateRangers(taskType, amount, priority, kingdomState) {
  const {
    rangers_available = 0,
    rangers_in_expeditions = 0,
    rangers_scouting = 0,
  } = kingdomState;

  const totalRangers = rangers_available + rangers_in_expeditions + rangers_scouting;
  const allocated = Math.min(amount, rangers_available);
  const overflow = Math.max(0, amount - allocated);

  return {
    allocated,
    overflow,
    reason: overflow > 0 ? `Only ${allocated}/${amount} rangers available` : 'OK',
  };
}

/**
 * Validate that ranger assignments don't exceed total available rangers.
 * (Mirrors the engineer allocation validation pattern.)
 *
 * @param {object} assignments - { scouting: number, expeditions: number }
 * @param {number} totalRangers - total rangers the kingdom has
 * @returns {object} - { valid: boolean, reason: string }
 */
function validateRangerAllocation(assignments, totalRangers) {
  const { scouting = 0, expeditions = 0 } = assignments;
  const total = scouting + expeditions;

  if (total > totalRangers) {
    return {
      valid: false,
      reason: `Rangers requested (${total}) exceed available (${totalRangers})`,
    };
  }

  return {
    valid: true,
    reason: 'OK',
  };
}

module.exports = {
  allocateRangers,
  validateRangerAllocation,
};

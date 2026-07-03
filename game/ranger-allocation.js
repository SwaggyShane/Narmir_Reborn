// game/ranger-allocation.js
// Ranger pool management: scouting and expeditions draw from the same pool.
//
// LOCKED (2026-07-03): player-assigned allocation, matching the existing
// engineer-allocation pattern (routes/kingdom-build.js's
// validateAllocationObject + total-vs-capacity check) — the player
// explicitly sets how many rangers go to scouting vs. how many remain
// available for expeditions, rather than an automatic priority/queue
// system deciding for them.

/**
 * Validate that a player's ranger assignment doesn't exceed what the
 * kingdom actually has. Mirrors the engineer-allocation validation used
 * throughout routes/kingdom-build.js (e.g. build-allocation's
 * `allocValidation.total + resourceTotal > k.engineers` check).
 *
 * @param {object} assignments - { scouting: number, expeditions: number }
 * @param {number} totalRangers - total rangers the kingdom has
 * @returns {object} - { valid: boolean, reason: string }
 */
function validateRangerAllocation(assignments, totalRangers) {
  if (!assignments || typeof assignments !== 'object') {
    return { valid: false, reason: 'Assignments must be a valid object' };
  }

  const scouting = assignments.scouting ?? 0;
  const expeditions = assignments.expeditions ?? 0;

  // Reject non-integers (including NaN) up front, not just negatives — a
  // negative value here would otherwise let a negative `scouting` cancel
  // out a legitimate `expeditions` total, passing the total<=totalRangers
  // check below while still allocating more rangers than actually exist.
  if (!Number.isInteger(scouting) || !Number.isInteger(expeditions)) {
    return { valid: false, reason: 'Ranger assignments must be integers' };
  }
  if (scouting < 0 || expeditions < 0) {
    return { valid: false, reason: 'Ranger assignments cannot be negative' };
  }

  const total = scouting + expeditions;
  if (total > totalRangers) {
    return {
      valid: false,
      reason: `Rangers assigned (${total}) exceed available (${totalRangers})`,
    };
  }

  return {
    valid: true,
    reason: 'OK',
  };
}

module.exports = {
  validateRangerAllocation,
};

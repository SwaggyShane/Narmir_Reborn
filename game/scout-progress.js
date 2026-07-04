'use strict';

const { getCompletedRing } = require('./scout-rings');

/**
 * Calculate scout-turns gained this turn from allocated rangers.
 * Formula: allocated_rangers × level_multiplier × race_modifier × 1 turn
 *
 * @param {object} kingdom - Kingdom object with rangers, scout_allocation, ranger_level, race
 * @returns {number} Scout-turns gained this turn
 */
function getScoutProgressThisTurn(kingdom) {
  const allocated = Math.max(0, Math.floor(Number(kingdom.scout_allocation) || 0));
  if (allocated === 0) return 0;

  const rangerLevel = Math.max(1, Number(kingdom.ranger_level) || 1);
  const race = kingdom.race || 'human';

  // Base: 1 scout-turn per allocated ranger
  let progress = allocated;

  // Ranger level multiplier: level increases scout efficiency
  // Formula: 1 + (level - 1) * 0.1 (so L1 = 1x, L2 = 1.1x, L10 = 1.9x)
  const levelMultiplier = 1 + (rangerLevel - 1) * 0.1;
  progress *= levelMultiplier;

  // Race modifiers (from exploration spec): scout_rate
  const RACE_MODIFIERS = {
    human: 1.0,
    orc: 1.1,     // Orcs are better scouts
    elf: 1.15,    // Elves are best scouts
    dwarf: 0.9,   // Dwarves prefer underground
    halfling: 1.05,
    beastfolk: 1.2,
  };
  const raceModifier = RACE_MODIFIERS[race.toLowerCase()] || 1.0;
  progress *= raceModifier;

  return Math.floor(progress);
}

/**
 * Process scout progression for a kingdom's turn.
 * Accumulates progress, detects ring completion, updates visibility.
 * Must be called during processTurn() after kingdom is loaded.
 *
 * @param {object} kingdom - Kingdom object with scout_allocation, scout_progress fields
 * @param {object} db - Database connection for visibility updates (optional, for tests)
 * @returns {object} Result: { progress_gained, new_total, ring_completed, completed_ring_number }
 */
function processScoutProgress(kingdom, db = null) {
  const previousRing = getCompletedRing(Number(kingdom.scout_progress) || 0);
  const progressGained = getScoutProgressThisTurn(kingdom);
  const newTotal = (Number(kingdom.scout_progress) || 0) + progressGained;
  const newRing = getCompletedRing(newTotal);

  const result = {
    progress_gained: progressGained,
    new_total: newTotal,
    ring_completed: newRing > previousRing,
    completed_ring_number: newRing > previousRing ? newRing : null,
    previous_ring: previousRing,
  };

  // If a ring was completed, reveal its hexes in visibility
  if (result.ring_completed && db && kingdom.id && kingdom.location) {
    // Defer visibility update to be batched with kingdom updates
    result.visibility_update_needed = true;
    result.home_hex = kingdom.location;
    result.completed_ring = newRing;
  }

  return result;
}

module.exports = {
  getScoutProgressThisTurn,
  processScoutProgress,
};

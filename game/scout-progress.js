'use strict';

const { getCompletedRing } = require('./scout-rings');
const { safeJsonParse } = require('../utils/helpers');
const { getKingdomMapCoords } = require('./world-map-coords');
const { pixelToHex } = require('./hex-utils');

/**
 * Calculate scout-turns gained this turn from allocated rangers.
 * Formula: allocated_rangers × level_multiplier × race_modifier × 1 turn
 *
 * @param {object} kingdom - Kingdom object with rangers, scout_allocation, ranger_level, race
 * @returns {number} Scout-turns gained this turn
 */
function getScoutProgressThisTurn(kingdom) {
  const allocated = Math.max(0, Math.floor(Number(kingdom.scout_allocation) || 0));
  if (allocated === 0) {
    console.log('[scout-progress] No scouts allocated', { kingdom_id: kingdom.id, scout_allocation: kingdom.scout_allocation });
    return 0;
  }
  console.log('[scout-progress] Processing scouts', { kingdom_id: kingdom.id, allocated, level: kingdom.ranger_level, race: kingdom.race });

  let rangerLevel = 1;
  if (kingdom.troop_levels) {
    const troopLevels = typeof kingdom.troop_levels === 'string'
      ? safeJsonParse(kingdom.troop_levels, {}, 'scout-progress:troop_levels')
      : kingdom.troop_levels;
    rangerLevel = troopLevels.rangers?.level || 1;
  }
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
    orc: 1.1,           // Orcs are better scouts
    high_elf: 1.15,     // Elves are best scouts
    dark_elf: 1.15,
    wood_elf: 1.15,
    dwarf: 0.9,         // Dwarves prefer underground
    dire_wolf: 1.0,
    vampire: 1.0,
    ogre: 1.0,
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
  console.log('[scout-progress] Result', { kingdom_id: kingdom.id, previous_progress: Number(kingdom.scout_progress) || 0, progress_gained: progressGained, new_total: newTotal });
  const newRing = getCompletedRing(newTotal);

  const result = {
    progress_gained: progressGained,
    new_total: newTotal,
    ring_completed: newRing > previousRing,
    completed_ring_number: newRing > previousRing ? newRing : null,
    previous_ring: previousRing,
  };

  // If a ring was completed, flag for visibility update
  if (result.ring_completed && db && kingdom.id) {
    try {
      const { map_x, map_y } = getKingdomMapCoords(kingdom);
      const hex = pixelToHex(map_x, map_y);
      const homeHex = `${hex.col},${hex.row}`;

      result.visibility_update_needed = true;
      result.home_hex = homeHex;
      result.completed_ring = newRing;
    } catch (err) {
      // If coordinate extraction fails, skip visibility update (not fatal)
      console.warn('[scout-progress] Failed to get kingdom coordinates for visibility update:', err.message);
    }
  }

  return result;
}

module.exports = {
  getScoutProgressThisTurn,
  processScoutProgress,
};

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
    return 0;
  }

  let rangerLevel = 1;
  if (kingdom.troop_levels) {
    const troopLevels = typeof kingdom.troop_levels === 'string'
      ? safeJsonParse(kingdom.troop_levels, {}, 'scout-progress:troop_levels')
      : kingdom.troop_levels;
    rangerLevel = troopLevels.rangers?.level || 1;
  }
  const race = kingdom.race || 'human';

  // Base: 0.001 scout-turns per allocated ranger (1000 rangers = 1 turn of progress)
  let progress = allocated * 0.001;

  // Ranger level multiplier: level increases scout efficiency
  // Formula: 1 + (level - 1) * 0.1 (so L1 = 1x, L2 = 1.1x, L10 = 1.9x)
  const levelMultiplier = 1 + (rangerLevel - 1) * 0.1;
  progress *= levelMultiplier;

  // Race modifiers (from exploration spec): scout_rate
  const RACE_MODIFIERS = {
    human: 1.0,
    orc: 1.05,          // 5% faster scouts
    high_elf: 0.95,     // Slightly lower than human
    dark_elf: 0.95,     // Just above dwarf
    wood_elf: 1.15,     // 15% faster scouts
    dwarf: 0.9,         // Dwarves prefer underground
    dire_wolf: 1.1,     // 10% faster scouts
    vampire: 0.98,      // 2% slower
    ogre: 0.8,          // 20% slower
  };
  const raceModifier = RACE_MODIFIERS[race.toLowerCase()] || 1.0;
  progress *= raceModifier;

  // FoW Phase 5C: home-hex terrain scout rate (plains faster, mountains/swamp slower).
  // Uses cached world hex grid when available; race-biome fallback otherwise.
  try {
    const { getKingdomScoutRate } = require('./terrain-scout');
    progress *= getKingdomScoutRate(kingdom);
  } catch {
    // terrain-scout missing or placement error — leave progress unchanged
  }

  return Math.round(progress * 100) / 100;
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
